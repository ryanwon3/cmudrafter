"use client";

import { Fragment } from "react";
import { bracketMatches, effectiveBracket, type BracketMatch } from "@/lib/bracket";
import type { BracketMatchId, DraftState } from "@/lib/types";

const rounds: BracketMatch["round"][] = ["Quarterfinals", "Semifinals", "Final"];
const positions = [[70, 210, 350, 490], [140, 420], [280]];
const sources: Partial<Record<BracketMatchId, [string, string]>> = {
  sf1: ["Quarterfinal 1", "Quarterfinal 2"],
  sf2: ["Quarterfinal 3", "Quarterfinal 4"],
  final: ["Semifinal 1", "Semifinal 2"],
};

export function TournamentBracket({
  state,
  busy = false,
  onResult,
}: {
  state: DraftState;
  busy?: boolean;
  onResult?: (match: BracketMatchId, winnerCaptainId: number | null) => void;
}) {
  const matches = bracketMatches(effectiveBracket(state));
  const championId = matches.find((match) => match.id === "final")?.winnerId;
  const champion = state.captains.find((captain) => captain.id === championId);
  const editable = !!onResult && state.draft.phase === "complete";

  return (
    <div className="tournament-bracket">
      <div
        className="bracket-scroll"
        role="region"
        aria-label="Tournament bracket, scroll horizontally to view all rounds"
        tabIndex={0}
      >
        <div className="bracket-board">
          {rounds.map((round, roundIndex) => (
            <Fragment key={round}>
              <section className="bracket-round" aria-label={round}>
                <h3 className="bracket-round-title">{round}</h3>
                <div className="bracket-round-matches">
                  {matches.filter((match) => match.round === round).map((match, index) => {
                    const ready = match.teamIds.every((id) => id !== null);
                    return (
                      <article
                        key={match.id}
                        className="bracket-match"
                        aria-label={match.label}
                        style={{ top: positions[roundIndex][index] - 64 }}
                      >
                        <h4 className="bracket-match-label">{match.label}</h4>
                        {match.teamIds.map((id, teamIndex) => {
                          const captain = state.captains.find((candidate) => candidate.id === id);
                          const selected = id !== null && id === match.winnerId;
                          const className = "bracket-team" + (selected ? " bracket-team-winner" : "");
                          const content = captain ? (
                            <>
                              <span className="bracket-team-slot">Team {captain.slot}</span>
                              <strong title={captain.display_name}>{captain.display_name}</strong>
                              {selected && <span className="bracket-winner-marker" aria-label="Winner">✓</span>}
                            </>
                          ) : (
                            <span className="bracket-placeholder">
                              {sources[match.id]?.[teamIndex]
                                ? `Winner of ${sources[match.id]![teamIndex]}`
                                : "Team to be determined"}
                            </span>
                          );
                          return editable && captain ? (
                            <button
                              key={teamIndex}
                              type="button"
                              className={className}
                              aria-label={`Advance ${captain.display_name} from ${match.label}`}
                              aria-pressed={selected}
                              disabled={busy || !ready || selected}
                              onClick={() => onResult?.(match.id, captain.id)}
                            >
                              {content}
                            </button>
                          ) : (
                            <div className={className} key={teamIndex}>{content}</div>
                          );
                        })}
                        <div className="bracket-match-footer">
                          {editable && match.winnerId !== null ? (
                            <button
                              type="button"
                              className="text-button"
                              disabled={busy}
                              aria-label={`Clear result for ${match.label}`}
                              onClick={() => onResult?.(match.id, null)}
                            >
                              Clear result
                            </button>
                          ) : (
                            <span>{match.winnerId !== null ? "Complete" : ready ? "Awaiting result" : "Awaiting teams"}</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
              {roundIndex < 2 && (
                <div className="bracket-connectors" aria-hidden="true">
                  <svg viewBox="0 0 48 560" preserveAspectRatio="none">
                    {positions[roundIndex].filter((_, index) => index % 2 === 0).map((top, index) => {
                      const bottom = positions[roundIndex][index * 2 + 1];
                      const middle = (top + bottom) / 2;
                      return <path key={top} d={`M0 ${top} H24 V${bottom} H0 M24 ${middle} H48`} />;
                    })}
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
      <div className={"bracket-champion" + (champion ? " bracket-champion-decided" : "")} role="status" aria-label="Tournament champion">
        <span className="eyebrow">Champion</span>
        {champion ? (
          <div><strong>{champion.display_name}</strong><span>Team {champion.slot}</span></div>
        ) : <p>Winner of the final</p>}
      </div>
    </div>
  );
}
