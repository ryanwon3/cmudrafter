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
      default:
        throw new DraftError('Unknown admin action', 400);
    }
  });
}
