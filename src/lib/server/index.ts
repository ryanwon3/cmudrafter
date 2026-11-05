import { DraftError } from './errors';
import { LocalStore } from './local-store';
import type { DraftStore } from './store';
import { SupabaseStore, supabaseConfig } from './supabase-store';

export { DraftError } from './errors';
export { hashToken, newToken, requireAdmin } from './tokens';

const g = globalThis as unknown as { __draftStore?: DraftStore };

export function isProductionRuntime(env = process.env): boolean {
  return env.NODE_ENV === 'production' || !!env.VERCEL;
}

/**
 * Supabase when its server env is set. Otherwise, only in local development,
 * an in-memory store shared by every browser window on this dev server.
 */
export function getStore(): DraftStore {
  if (g.__draftStore) return g.__draftStore;
  const cfg = supabaseConfig();
  if (cfg) {
    g.__draftStore = new SupabaseStore(cfg.url, cfg.key);
  } else if (!isProductionRuntime()) {
    g.__draftStore = new LocalStore();
  } else {
    throw new DraftError('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 503);
  }
  return g.__draftStore;
}
