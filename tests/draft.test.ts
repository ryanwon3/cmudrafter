import test from "node:test";
import assert from "node:assert/strict";
import {
  captainSlotAt,
  visiblePlayers,
  resultsText,
  resultsCsv,
} from "../src/lib/draft";
import type { DraftState, Player } from "../src/lib/types";

const p = (
  id: number,
  name: string,
  rank: number,
  team: number | null = null,
): Player => ({
  id,
  present: true,
  display_name: name,
  riot_id: `${name}#NA1`,
  opgg_url: "https://op.gg",
  peak_rank: "Diamond 1",
  rank_score: rank,
  team_captain_id: team,
  pick_number: team ? id : null,
});
const state: DraftState = {
  mode: "local",
  draft: {
    id: 1,
    phase: "complete",
    pick_index: 32,
    picks_per_team: 4,
    started_at: null,
    updated_at: "",
    announcement: "",
  },
  captains: [
    {
      id: 1,
      slot: 1,
      display_name: "Chomania",
      riot_id: "Thechomania2#SION",
      opgg_url: "https://op.gg",
      peak_rank: "Diamond 4",
      rank_score: 24,
      claimed: true,
      ready: true,
    },
  ],
  players: [p(1, 'A, "player"', 38.41, 1), p(2, "moon", 20)],
};

test("snake turns repeat only at the round boundaries", () => {
  assert.deepEqual(
    Array.from({ length: 32 }, (_, i) => captainSlotAt(i)),
    [
      1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6, 7, 8, 8,
      7, 6, 5, 4, 3, 2, 1,
    ],
  );
});
test("pool excludes picked players and searches Riot IDs without changing original order", () => {
  const pool = [p(1, "zulu", 19), p(2, "Alpha", 38.41), p(3, "Picked", 40, 1)];
  assert.deepEqual(
    visiblePlayers(pool, "", "rank").map((p) => p.id),
    [2, 1],
  );
  assert.deepEqual(
    visiblePlayers(pool, "ZULU#", "name").map((p) => p.id),
    [1],
  );
  assert.deepEqual(
    pool.map((p) => p.id),
    [1, 2, 3],
  );
});
test("result export includes captain, roster and undrafted players", () => {
  const text = resultsText(state);
  assert.match(text, /Chomania/);
  assert.match(text, /A, "player"/);
  assert.match(text, /Undrafted[\s\S]*moon/);
});
test("CSV escapes quotes, commas and formula-leading names", () => {
  const csv = resultsCsv({
    ...state,
    players: [...state.players, p(3, "=FORMULA()", 12)],
  });
  assert.ok(csv.includes('"A, ""player"""'));
  assert.ok(csv.includes("'=FORMULA()"));
  assert.ok(csv.includes("Undrafted"));
});
