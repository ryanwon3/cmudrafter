import type { Captain, DraftState, Player } from '../types';
import { DraftError } from './errors';
import { slotOnClock, N_CAPTAINS } from './rules';
import { CAPTAINS, PLAYERS } from './seed-data';
import type { DraftStore, PickResult } from './store';

/**
 * In-memory draft for local development without Supabase. Mirrors the Postgres
 * functions in supabase/schema.sql. Every method runs synchronously before its
 * first await, so each one is atomic within a single Node process.
 * Never used in production (see getStore).
 */
export class LocalStore implements DraftStore {
  mode = 'local' as const;
  private state!: Omit<DraftState, 'mode'>;
  private tokens = new Map<number, string>(); // captain id -> token hash

  constructor() {
    this.seed();
  }

  private seed() {
    this.state = {
      draft: { id: 1, phase: 'lobby', pick_index: 0, picks_per_team: 4, started_at: null, updated_at: now() },
      captains: CAPTAINS.map((c) => ({ ...c, claimed: false, ready: false })),
      players: PLAYERS.map((p, i) => ({ ...p, id: i + 1, team_captain_id: null, pick_number: null })),
    };
    this.tokens.clear();
  }

  private touch() {
    this.state.draft.updated_at = now();
  }

  private captain(id: number): Captain {
    const c = this.state.captains.find((x) => x.id === id);
    if (!c) throw new DraftError("That captain doesn't exist");
    return c;
  }

  private tokenCaptain(tokenHash: string): number | null {
    for (const [id, hash] of this.tokens) if (hash === tokenHash) return id;
    return null;
  }

  private requireCaptain(tokenHash: string): number {
    const id = this.tokenCaptain(tokenHash);
    if (id === null) throw new DraftError('You are not a captain', 403);
    return id;
  }

  async getState(): Promise<DraftState> {
    const s = structuredClone(this.state);
    s.captains.sort((a, b) => a.slot - b.slot);
    s.players.sort((a, b) => b.rank_score - a.rank_score || a.id - b.id);
    return { ...s, mode: 'local' };
  }

  async captainForToken(tokenHash: string) {
    return this.tokenCaptain(tokenHash);
  }

  async claim(captainId: number, tokenHash: string) {
    if (this.state.draft.phase === 'complete') throw new DraftError('The draft is over');
    const c = this.captain(captainId);
    if (c.claimed) throw new DraftError('Already taken', 409);
    c.claimed = true;
    c.ready = false;
    this.tokens.set(captainId, tokenHash);
    this.touch();
  }

  async release(tokenHash: string) {
    const id = this.requireCaptain(tokenHash);
    if (this.state.draft.phase !== 'lobby') throw new DraftError('Names can only be released in the lobby. Ask the admin.');
    this.unclaim(id);
  }

  private unclaim(id: number) {
    const c = this.captain(id);
    c.claimed = false;
    c.ready = false;
    this.tokens.delete(id);
    this.touch();
  }

  async setReady(tokenHash: string, ready: boolean) {
    const id = this.requireCaptain(tokenHash);
    if (this.state.draft.phase !== 'lobby') throw new DraftError('The draft has already started');
    this.captain(id).ready = ready;
    const started = this.state.captains.filter((c) => c.claimed && c.ready).length === N_CAPTAINS;
    if (started) this.start();
    this.touch();
    return { started };
  }

  private start() {
    Object.assign(this.state.draft, { phase: 'drafting', pick_index: 0, started_at: now() });
  }

  private doPick(captainId: number | null, playerId: number, expected?: number): PickResult {
    const d = this.state.draft;
    if (d.phase !== 'drafting') throw new DraftError('The draft is not running');
    if (expected !== undefined && expected !== d.pick_index) throw new DraftError('The board changed. Try again.', 409);
    const onClock = this.state.captains.find((c) => c.slot === slotOnClock(d.pick_index))!;
    if (captainId !== null && captainId !== onClock.id) throw new DraftError(`It's ${onClock.display_name}'s pick`, 409);
    const p: Player | undefined = this.state.players.find((x) => x.id === playerId);
    if (!p) throw new DraftError("That player doesn't exist");
    if (p.team_captain_id !== null) throw new DraftError(`${p.display_name} was already drafted`, 409);
    p.team_captain_id = onClock.id;
    p.pick_number = d.pick_index + 1;
    d.pick_index += 1;
    if (d.pick_index >= N_CAPTAINS * d.picks_per_team) d.phase = 'complete';
    this.touch();
    return { pick: p.pick_number, captain: onClock.display_name, player: p.display_name };
  }

  async pick(tokenHash: string, playerId: number, expected?: number) {
    return this.doPick(this.requireCaptain(tokenHash), playerId, expected);
  }

  async adminRelease(captainId: number) {
    this.captain(captainId);
    this.unclaim(captainId);
  }

  async adminStart() {
    if (this.state.draft.phase !== 'lobby') throw new DraftError('The draft has already started');
    this.start();
    this.touch();
  }

  async adminPick(playerId: number, expected?: number) {
    return this.doPick(null, playerId, expected);
  }

  async adminUndo() {
    const d = this.state.draft;
    if (d.pick_index === 0 || d.phase === 'lobby') throw new DraftError('No picks to undo');
    const p = this.state.players.find((x) => x.pick_number === d.pick_index);
    if (p) {
      p.team_captain_id = null;
      p.pick_number = null;
    }
    d.pick_index -= 1;
    d.phase = 'drafting';
    this.touch();
  }

  async adminSetPicksPerTeam(picks: number) {
    if (this.state.draft.phase !== 'lobby') throw new DraftError('Picks per team can only change in the lobby');
    const max = Math.floor(this.state.players.length / N_CAPTAINS);
    if (picks < 1 || picks > max) throw new DraftError(`Picks per team must be between 1 and ${max}`);
    this.state.draft.picks_per_team = picks;
    this.touch();
  }

  async adminReset(full: boolean) {
    for (const p of this.state.players) {
      p.team_captain_id = null;
      p.pick_number = null;
    }
    for (const c of this.state.captains) {
      c.ready = false;
      if (full) c.claimed = false;
    }
    if (full) this.tokens.clear();
    Object.assign(this.state.draft, { phase: 'lobby', pick_index: 0, started_at: null });
    this.touch();
  }
}

function now() {
  return new Date().toISOString();
}
