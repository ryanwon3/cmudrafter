export type DraftPhase = "lobby" | "drafting" | "complete";
export interface Draft {
  id: number;
  phase: DraftPhase;
  pick_index: number;
  picks_per_team: number;
  started_at: string | null;
  updated_at: string;
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
}
export interface DraftState {
  draft: Draft;
  captains: Captain[];
  players: Player[];
  mode: "supabase" | "local";
}
