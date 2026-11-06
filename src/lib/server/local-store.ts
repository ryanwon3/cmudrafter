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
  private playerTokens = new Map<number, string>();

  constructor() {
    this.seed();
  }

  private seed() {
    this.state = {
      draft: { id: 1, phase: 'lobby', pick_index: 0, picks_per_team: 4, started_at: null, updated_at: now(), announcement: '' },
      captains: CAPTAINS.map((c) => ({ ...c, claimed: false, ready: false })),
      players: PLAYERS.map((p, i) => ({ ...p, id: i + 1, team_captain_id: null, pick_number: null, present: false })),
    };
    this.tokens.clear();
    this.playerTokens.clear();
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
    this.touch();
    return { started: false };
  }

  private start() {
    Object.assign(this.state.draft, { phase: 'drafting', pick_index: 0, started_at: now() });
  }

  private doPick(captainId: number | null, playerId: number, expected?: number): PickResult {
    const d = this.state.draft;
    if (d.phase !== 'drafting') throw new DraftError('The draft is not running', 409);
    if (expected !== undefined && expected !== d.pick_index) throw new DraftError('The board changed. Try again.', 409);
    const onClock = this.state.captains.find((c) => c.slot === slotOnClock(d.pick_index))!;
    if (captainId !== null && captainId !== onClock.id) throw new DraftError(`It's ${onClock.display_name}'s pick`, 409);
    const p: Player | undefined = this.state.players.find((x) => x.id === playerId);
    if (!p) throw new DraftError("That player doesn't exist");
    if (p.team_captain_id !== null) throw new DraftError(`${p.display_name} was already drafted`, 409);
    if (!p.present) throw new DraftError(`${p.display_name} is not marked present`, 409);
    p.team_captain_id = onClock.id;
    p.pick_number = d.pick_index + 1;
    d.pick_index += 1;
    if (d.pick_index >= N_CAPTAINS * d.picks_per_team) d.phase = 'review';
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

  async adminFinish() {
    if (this.state.draft.phase !== 'drafting') throw new DraftError('The draft is not running', 409);
    this.state.draft.phase = 'review';
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
    if (picks !== 4) throw new DraftError('This event uses four picks per captain', 409);
    this.state.draft.picks_per_team = picks;
    this.touch();
  }

  async adminReset(full: boolean) {
    for (const p of this.state.players) {
      p.team_captain_id = null;
      p.pick_number = null;
      if (full) p.present = false;
    }
    for (const c of this.state.captains) {
      c.ready = false;
      if (full) c.claimed = false;
    }
    if (full) { this.tokens.clear(); this.playerTokens.clear(); }
    Object.assign(this.state.draft, { phase: 'lobby', pick_index: 0, started_at: null, announcement: '' });
    this.touch();
  }

  private attendanceLobby() {
    if (this.state.draft.phase !== 'lobby') throw new DraftError('Attendance can only change in the lobby', 409);
  }
  private player(id: number) {
    const player = this.state.players.find(p => p.id === id);
    if (!player) throw new DraftError("That player doesn't exist");
    return player;
  }
  async checkIn(playerId: number, tokenHash: string) {
    this.attendanceLobby();
    const p = this.player(playerId);
    if (p.present) throw new DraftError('That player is already checked in', 409);
    if ([...this.playerTokens.values()].includes(tokenHash)) throw new DraftError('This attendance token is already in use', 409);
    p.present = true;
    this.playerTokens.set(playerId, tokenHash);
    this.touch();
  }
  private tokenPlayer(tokenHash: string) {
    for (const [id, hash] of this.playerTokens) if (hash === tokenHash) return id;
    return null;
  }
  async playerForToken(tokenHash: string) { return this.tokenPlayer(tokenHash); }
  async leave(tokenHash: string) {
    this.attendanceLobby();
    const id = this.tokenPlayer(tokenHash);
    if (id === null) throw new DraftError('You are not checked in', 403);
    this.player(id).present = false;
    this.playerTokens.delete(id);
    this.touch();
  }
  async adminSetAttendance(playerId: number, present: boolean) {
    this.attendanceLobby();
    this.player(playerId).present = present;
    if (!present) this.playerTokens.delete(playerId);
    this.touch();
  }
  async adminAnnouncement(message: string) {
    if (message.length > 500) throw new DraftError('Announcement must be 500 characters or fewer');
    this.state.draft.announcement = message.trim();
    this.touch();
  }
  async adminPublish() {
    if (this.state.draft.phase !== 'review') throw new DraftError('Results can only be published after draft review', 409);
    this.state.draft.phase = 'complete';
    this.touch();
  }
}

function now() {
  return new Date().toISOString();
}
