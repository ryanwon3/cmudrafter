import { getStore, hashToken, newToken } from '@/lib/server';
import { body, handle, intField } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => {
    const captainId = intField(await body(req), 'captainId');
    const token = newToken();
    await getStore().claim(captainId, hashToken(token));
    // The raw token is returned exactly once; only its hash is stored.
    return { token, captainId };
  });
}
