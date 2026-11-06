import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DraftState } from "../types";
import { DraftError } from "./errors";
import type { DraftStore, PickResult } from "./store";

export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export class SupabaseStore implements DraftStore {
  mode = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.db = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async call<T>(
    fn: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) {
      // P0001 = RAISE EXCEPTION in our functions: a plain message for the user.
      if (error.code === "P0001") {
        throw new DraftError(
          error.message,
          error.message === "You are not a captain" || error.message === "You are not checked in" ? 403 : 409,
        );
      }
      console.error(`Supabase ${fn} failed`, error);
      throw new DraftError(
        "The database is unavailable. Try again in a moment.",
        503,
      );
    }
    return data as T;
  }

  async getState(): Promise<DraftState> {
    const state = await this.call<Omit<DraftState, "mode">>("get_state");
    if (!state?.draft)
      throw new DraftError(
        "The database has not been seeded. Run supabase/seed.sql.",
        503,
      );
    return { ...state, mode: "supabase" };
  }
  captainForToken(tokenHash: string) {
    return this.call<number | null>("captain_for_token", {
      p_token_hash: tokenHash,
    });
  }
  async claim(captainId: number, tokenHash: string) {
    await this.call("claim_captain", {
      p_captain_id: captainId,
      p_token_hash: tokenHash,
    });
  }
  async release(tokenHash: string) {
    await this.call("release_captain", { p_token_hash: tokenHash });
  }
  setReady(tokenHash: string, ready: boolean) {
    return this.call<{ started: boolean }>("set_ready", {
      p_token_hash: tokenHash,
      p_ready: ready,
    });
  }
  pick(tokenHash: string, playerId: number, expectedPickIndex?: number) {
    return this.call<PickResult>("make_pick", {
      p_token_hash: tokenHash,
      p_player_id: playerId,
      p_expected_pick_index: expectedPickIndex ?? null,
    });
  }
  async adminRelease(captainId: number) {
    await this.call("admin_release", { p_captain_id: captainId });
  }
  async adminStart() {
    await this.call("admin_force_start");
  }
  async adminFinish() {
    await this.call("admin_finish_draft");
  }
  adminPick(playerId: number, expectedPickIndex?: number) {
    return this.call<PickResult>("admin_pick", {
      p_player_id: playerId,
      p_expected_pick_index: expectedPickIndex ?? null,
    });
  }
  async adminUndo() {
    await this.call("admin_undo");
  }
  async adminSetPicksPerTeam(picks: number) {
    await this.call("admin_set_picks_per_team", { p_picks: picks });
  }
  async adminReset(full: boolean) {
    await this.call("admin_reset", { p_full: full });
  }
  async checkIn(playerId: number, tokenHash: string) {
    await this.call('check_in_player', {p_player_id: playerId, p_token_hash: tokenHash});
  }
  playerForToken(tokenHash: string) {
    return this.call<number | null>('player_for_token', {p_token_hash: tokenHash});
  }
  async leave(tokenHash: string) { await this.call('release_player', {p_token_hash: tokenHash}); }
  async adminSetAttendance(playerId: number, present: boolean) {
    await this.call('admin_set_attendance', {p_player_id: playerId, p_present: present});
  }
  async adminAnnouncement(message: string) { await this.call('admin_announcement', {p_message: message}); }
  async adminPublish() { await this.call('admin_publish_results'); }
}
