import { getStore, hashToken } from '@/lib/server';
import { body, handle, tokenField } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => {
    await getStore().release(hashToken(tokenField(await body(req))));
    return { ok: true };
  });
}
