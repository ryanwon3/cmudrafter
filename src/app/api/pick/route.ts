import { getStore, hashToken } from '@/lib/server';
import { body, handle, intField, optionalIntField, tokenField } from '@/lib/server/http';

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const result = await getStore().pick(
      hashToken(tokenField(b)),
      intField(b, 'playerId'),
      optionalIntField(b, 'expectedPickIndex'),
    );
    return { ok: true, ...result };
  });
}
