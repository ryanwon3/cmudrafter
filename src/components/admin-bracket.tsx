"use client";

import { useEffect, useId, useState } from "react";
import { effectiveBracket } from "@/lib/bracket";
import type { BracketMatchId, DraftState } from "@/lib/types";
import { TournamentBracket } from "./tournament-bracket";

export function AdminBracket({
  state,
  busy,
  onSeeds,
  onResult,
}: {
  state: DraftState;
  busy: boolean;
  onSeeds: (captainIds: number[], expectedRevision: number) => void;
  onResult: (match: BracketMatchId, winnerCaptainId: number | null, expectedRevision: number) => void;
}) {
  const editorId = useId();
  const [editor, setEditor] = useState<{
    seeds: number[];
    revision: number;
    submittedRevision?: number;
  } | null>(null);
  const captains = [...state.captains].sort((a, b) => a.slot - b.slot);
  const validSeeds = editor !== null && editor.seeds.length === 8 &&
    new Set(editor.seeds).size === 8 && captains.length === 8 &&
    captains.every((captain) => editor.seeds.includes(captain.id));
  const currentSeeds = effectiveBracket(state).seeds;
  const changedSeeds = editor !== null && (
    editor.seeds.length !== currentSeeds.length ||
    editor.seeds.some((id, index) => id !== currentSeeds[index])
  );
  const published = state.draft.phase === "complete";
  const persistedBracket = state.draft.bracket;
  const revision = state.draft.bracket_revision;

  useEffect(() => {
    if (
      editor?.submittedRevision !== undefined &&
      revision > editor.submittedRevision &&
      persistedBracket &&
      Object.keys(persistedBracket.winners).length === 0 &&
      persistedBracket.seeds.length === editor.seeds.length &&
      persistedBracket.seeds.every((id, index) => id === editor.seeds[index])
    ) {
      setEditor(null);
    }
  }, [editor, persistedBracket, revision]);

  return (
    <section className="admin-bracket" aria-label="Tournament bracket administration">
      <div className="section-heading">
        <h2>Tournament bracket</h2>
        <div className="bracket-admin-actions">
          <a className="button secondary" href="/bracket">View public bracket</a>
          {!editor && <button
            type="button"
            className="button secondary"
            disabled={busy || !published}
            onClick={() => setEditor({
              seeds: [...effectiveBracket(state).seeds],
              revision: state.draft.bracket_revision,
            })}
          >Edit matchups</button>}
        </div>
      </div>
      {!published ? <p className="bracket-help">Publish draft results to edit the tournament bracket.</p> : <>
        <p className="bracket-help">Select a team to advance it. Changing a winner clears its later results.</p>
        {editor && <form className="bracket-editor" onSubmit={(event) => {
          event.preventDefault();
          if (validSeeds && changedSeeds && !busy) {
            setEditor({ ...editor, submittedRevision: revision });
            onSeeds([...editor.seeds], editor.revision);
          }
        }}>
          <div className="bracket-editor-grid">
            {[0, 1, 2, 3].map((matchIndex) => <fieldset key={matchIndex} disabled={busy}>
              <legend>Quarterfinal {matchIndex + 1}</legend>
              {[0, 1].map((teamIndex) => {
                const index = matchIndex * 2 + teamIndex;
                const label = `Quarterfinal ${matchIndex + 1}, team ${teamIndex + 1}`;
                return <label key={teamIndex} htmlFor={`${editorId}-${index}`}>
                  <span>Team {teamIndex + 1}</span>
                  <select
                    id={`${editorId}-${index}`}
                    aria-label={label}
                    value={editor.seeds[index]}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setEditor((current) => current && ({
                        ...current,
                        seeds: current.seeds.map((id, seedIndex) => seedIndex === index ? value : id),
                        submittedRevision: undefined,
                      }));
                    }}
                  >
                    {captains.map((captain) => <option value={captain.id} key={captain.id}>
                      Team {captain.slot} · {captain.display_name}
                    </option>)}
                  </select>
                </label>;
              })}
            </fieldset>)}
          </div>
          {!validSeeds && <p className="bracket-editor-error" role="alert">Choose each of the eight teams exactly once.</p>}
          {editor.revision !== state.draft.bracket_revision && <p className="bracket-editor-status" role="status" aria-label="Matchup changes">
            The bracket changed while you were editing. Cancel and reopen to load the latest matchups.
          </p>}
          <p className="bracket-help">Changing matchups clears all tournament results.</p>
          <div className="control-buttons">
            <button className="button primary" type="submit" disabled={busy || !validSeeds || !changedSeeds}>Save matchups</button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>}
        <TournamentBracket state={state} busy={busy} onResult={(match, winner) => onResult(match, winner, state.draft.bracket_revision)} />
      </>}
    </section>
  );
}
