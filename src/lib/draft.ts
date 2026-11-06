import type { Captain, DraftState, Player } from "./types";

export function captainSlotAt(index: number, count = 8): number {
  const round = Math.floor(index / count);
  return round % 2 === 0 ? (index % count) + 1 : count - (index % count);
}
export function currentCaptain(state: DraftState): Captain | undefined {
  if (state.draft.phase !== "drafting") return undefined;
  return state.captains.find(
    (c) =>
      c.slot === captainSlotAt(state.draft.pick_index, state.captains.length),
  );
}
export function visiblePlayers(
  players: Player[],
  search: string,
  sort: "name" | "rank",
): Player[] {
  const q = search.trim().toLocaleLowerCase();
  return players
    .filter(
      (p) =>
        p.team_captain_id === null &&
        `${p.display_name} ${p.riot_id} ${p.peak_rank}`
          .toLocaleLowerCase()
          .includes(q),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.display_name.localeCompare(b.display_name)
        : b.rank_score - a.rank_score ||
          a.display_name.localeCompare(b.display_name),
    );
}
export function teamPlayers(state: DraftState, captainId: number): Player[] {
  return state.players
    .filter((p) => p.team_captain_id === captainId)
    .sort((a, b) => (a.pick_number ?? 0) - (b.pick_number ?? 0));
}
export function resultsText(state: DraftState): string {
  return [
    "CMU × PITT · IN-HOUSE DRAFT",
    "",
    ...state.captains.flatMap((c) => [
      `Team ${c.slot} · ${c.display_name} (captain)`,
      ...teamPlayers(state, c.id).map(
        (p) => `  ${p.display_name} · ${p.riot_id} · ${p.peak_rank}`,
      ),
      "",
    ]),
    "Undrafted",
    ...state.players
      .filter((p) => p.present && p.team_captain_id === null)
      .map((p) => `${p.display_name} · ${p.riot_id} · ${p.peak_rank}`),
  ].join("\n");
}
export function resultsCsv(state: DraftState): string {
  const cell = (value: string | number) => {
    let s = String(value);
    if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const rows: (string | number)[][] = [
    ["Team", "Captain", "Player", "Riot ID", "Peak rank", "Pick"],
  ];
  for (const captain of state.captains) {
    rows.push([
      captain.slot,
      captain.display_name,
      captain.display_name,
      captain.riot_id,
      captain.peak_rank,
      "Captain",
    ]);
    for (const p of teamPlayers(state, captain.id))
      rows.push([
        captain.slot,
        captain.display_name,
        p.display_name,
        p.riot_id,
        p.peak_rank,
        p.pick_number ?? "",
      ]);
  }
  for (const p of state.players.filter((p) => p.present && p.team_captain_id === null))
    rows.push(["Undrafted", "", p.display_name, p.riot_id, p.peak_rank, ""]);
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
