import { DraftError, getStore, requireAdmin } from '@/lib/server';
import { body, handle, intField, optionalIntField } from '@/lib/server/http';

// POST /api/admin  header x-admin-key: <ADMIN_KEY>  body { action, ...payload }
export async function POST(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const b = await body(req);
    const store = getStore();
    switch (b.action) {
      case 'verify':
        return { ok: true, mode: store.mode };
      case 'release':
        await store.adminRelease(intField(b, 'captainId'));
        return { ok: true };
      case 'start':
        await store.adminStart();
        return { ok: true };
      case 'finish':
        await store.adminFinish();
        return { ok: true };
      case 'pick':
        return { ok: true, ...(await store.adminPick(intField(b, 'playerId'), optionalIntField(b, 'expectedPickIndex'))) };
      case 'undo':
        await store.adminUndo();
        return { ok: true };
      case 'settings':
        await store.adminSetPicksPerTeam(intField(b, 'picksPerTeam'));
        return { ok: true };
      case 'reset':
        await store.adminReset(false);
        return { ok: true };
      case 'full-reset':
        await store.adminReset(true);
        return { ok: true };
      case 'attendance':
        if (typeof b.present !== 'boolean') throw new DraftError('present must be true or false', 400);
        await store.adminSetAttendance(intField(b, 'playerId'), b.present);
        return {ok:true};
      case 'announcement':
        if (typeof b.message !== 'string' || b.message.length > 500) throw new DraftError('Announcement must be 500 characters or fewer', 400);
        await store.adminAnnouncement(b.message);
        return {ok:true};
      case 'publish':
        await store.adminPublish();
        return {ok:true};
      case 'bracket-seeds':
        if(!Array.isArray(b.captainIds)||b.captainIds.length!==8||!b.captainIds.every(id=>Number.isSafeInteger(id)&&id>0)) {
          throw new DraftError('Choose all eight teams exactly once',400);
        }
        await store.adminBracketSeeds(b.captainIds,intField(b,'expectedRevision'));
        return {ok:true};
      case 'bracket-result':
        if(typeof b.match!=='string') throw new DraftError('Choose a bracket match',400);
        await store.adminBracketResult(b.match,b.winnerCaptainId===null?null:intField(b,'winnerCaptainId'),intField(b,'expectedRevision'));
        return {ok:true};
      default:
        throw new DraftError('Unknown admin action', 400);
    }
  });
}
