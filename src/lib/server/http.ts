import { NextResponse } from 'next/server';
import { DraftError } from './errors';

export async function body(req: Request): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new DraftError('The request body must be JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new DraftError('The request body must be a JSON object');
  return data as Record<string, unknown>;
}

export function intField(b: Record<string, unknown>, key: string): number {
  const v = b[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new DraftError(`${key} must be a whole number`);
  return v;
}

export function optionalIntField(b: Record<string, unknown>, key: string): number | undefined {
  return b[key] === undefined || b[key] === null ? undefined : intField(b, key);
}

export function tokenField(b: Record<string, unknown>): string {
  const v = b.token;
  if (typeof v !== 'string' || v.length < 10 || v.length > 200) throw new DraftError('You are not a captain', 403);
  return v;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Runs a handler and turns errors into { error } JSON responses. */
export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof DraftError) return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    console.error(e);
    return NextResponse.json({ error: 'Something went wrong on the server.' }, { status: 500, headers: NO_STORE });
  }
}
