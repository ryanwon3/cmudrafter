import { getStore, hashToken } from '@/lib/server';
import { body, handle } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => {
    const token = (await body(req)).token;
    if (typeof token !== 'string' || !token || token.length > 200) return { captainId: null };
    return { captainId: await getStore().captainForToken(hashToken(token)) };
  });
}
