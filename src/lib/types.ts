export type DraftPhase = "lobby" | "drafting" | "review" | "complete";
export type BracketMatchId = "qf1" | "qf2" | "qf3" | "qf4" | "sf1" | "sf2" | "final";
export interface TournamentBracket {
  seeds: number[];
  winners: Partial<Record<BracketMatchId, number>>;
}
export interface Draft {
  id: number;
  phase: DraftPhase;
  pick_index: number;
  picks_per_team: number;
  started_at: string | null;
  updated_at: string;
  announcement: string;
  bracket: TournamentBracket | null;
  bracket_revision: number;
}
export interface Captain {
  id: number;
  slot: number;
  display_name: string;
  riot_id: string;
  opgg_url: string;
  peak_rank: string;
  rank_score: number;
  claimed: boolean;
  ready: boolean;
}
export interface Player {
  id: number;
  display_name: string;
  riot_id: string;
  opgg_url: string;
  peak_rank: string;
  rank_score: number;
  team_captain_id: number | null;
  pick_number: number | null;
  present: boolean;
}
export interface DraftState {
  draft: Draft;
  captains: Captain[];
  players: Player[];
  mode: "supabase" | "local";
}
