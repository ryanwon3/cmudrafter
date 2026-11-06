import { DraftError, getStore, hashToken, newToken } from '@/lib/server';
import { body, handle, intField } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const store = getStore();
    if (b.action === 'check-in') {
      const playerId = intField(b, 'playerId');
      const token = newToken();
      await store.checkIn(playerId, hashToken(token));
      return { token, playerId };
    }
    if (b.action !== 'me' && b.action !== 'leave') throw new DraftError('Unknown attendance action', 400);
    if (typeof b.token !== 'string' || b.token.length < 10 || b.token.length > 200) throw new DraftError('You are not checked in', 403);
    const hash = hashToken(b.token);
    if (b.action === 'me') return { playerId: await store.playerForToken(hash) };
    await store.leave(hash);
    return {ok:true};
  });
}
