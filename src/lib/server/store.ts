import type { DraftState } from '../types';

export type PickResult = { pick: number; captain: string; player: string };

/** Every draft action. Each call is one atomic transaction. Token arguments are hashes. */
export interface DraftStore {
  mode: DraftState['mode'];
  getState(): Promise<DraftState>;
  captainForToken(tokenHash: string): Promise<number | null>;
  claim(captainId: number, tokenHash: string): Promise<void>;
  release(tokenHash: string): Promise<void>;
  setReady(tokenHash: string, ready: boolean): Promise<{ started: boolean }>;
  pick(tokenHash: string, playerId: number, expectedPickIndex?: number): Promise<PickResult>;
  adminRelease(captainId: number): Promise<void>;
  adminStart(): Promise<void>;
  adminPick(playerId: number, expectedPickIndex?: number): Promise<PickResult>;
  adminUndo(): Promise<void>;
  adminSetPicksPerTeam(picks: number): Promise<void>;
  adminReset(full: boolean): Promise<void>;
}
