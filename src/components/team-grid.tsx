import { teamPlayers } from "@/lib/draft";
import type { DraftState } from "@/lib/types";
import { Rank } from "./ui";

export function TeamGrid({
  state,
  activeId,
  compact = false,
}: {
  state: DraftState;
  activeId?: number;
  compact?: boolean;
}) {
  return (
    <div className={"team-grid " + (compact ? "compact" : "")}>
      {state.captains.map((c) => {
        const players = teamPlayers(state, c.id);
        return (
          <article
            className={"team-card " + (activeId === c.id ? "on-clock" : "")}
            key={c.id}
          >
            <div className="team-card-heading">
              <span className="team-index">Team {c.slot}</span>
              {activeId === c.id ? (
                <span className="clock-label">
                  <i /> Picking
                </span>
              ) : (
                <span className="team-size">
                  {players.length + 1}/{state.draft.picks_per_team + 1}
                </span>
              )}
            </div>
            <div className="team-captain">
              <div>
                <h3>{c.display_name}</h3>
                <Rank rank={c.peak_rank} />
              </div>
              <span className="captain-marker" title="Captain">
                C
              </span>
            </div>
            <ol className="team-roster">
              {Array.from({ length: state.draft.picks_per_team }, (_, i) => {
                const p = players[i];
                return (
                  <li key={i} className={p ? "filled" : ""}>
                    <span className="roster-position">
                      {p ? `#${p.pick_number}` : String(i + 1).padStart(2, "0")}
                    </span>
                    {p ? (
                      <>
                        <strong>{p.display_name}</strong>
                        <span className="roster-rank">
                          {p.peak_rank.replace(/ \(.*\)/, "")}
                        </span>
                      </>
                    ) : (
                      <span className="empty-slot">—</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
