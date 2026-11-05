import { getStore } from '@/lib/server';
import { handle } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(() => getStore().getState());
}
