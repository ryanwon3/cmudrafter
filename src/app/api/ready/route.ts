import { DraftError, getStore, hashToken } from '@/lib/server';
import { body, handle, tokenField } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const token = tokenField(b);
    if (typeof b.ready !== 'boolean') throw new DraftError('ready must be true or false');
    const { started } = await getStore().setReady(hashToken(token), b.ready);
    return { ok: true, started };
  });
}
