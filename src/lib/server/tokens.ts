import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DraftError } from './errors';

/** A random captain claim token. Returned to the browser once; only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Throws unless the x-admin-key header matches ADMIN_KEY. */
export function requireAdmin(req: Request): void {
  const expected = process.env.ADMIN_KEY;
  if (!expected) throw new DraftError('ADMIN_KEY is not set on the server', 500);
  const given = req.headers.get('x-admin-key') ?? '';
  // Compare hashes so lengths always match and timing doesn't leak the key.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  if (!given || !timingSafeEqual(a, b)) throw new DraftError('Wrong admin key', 401);
}
