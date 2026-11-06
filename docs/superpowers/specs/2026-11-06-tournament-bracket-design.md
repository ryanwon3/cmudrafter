# Tournament bracket

Add `/bracket` after published draft results. All eight captain-led teams enter a single-elimination tournament: four quarterfinals, two semifinals and one final. Default quarterfinal pairings use draft slots 1–8, 4–5, 2–7, 3–6. The admin can rearrange all eight teams, select each match winner, and clear/correct results. Reseeding clears results; correcting a result clears its descendants while preserving the opposite branch. Publishing results remains separate from recording tournament outcomes.

Use the current minimal UI and existing admin authentication. The bracket is public and read-only; edits are server-authorized and available only after results are published. No extra draft phase or dependencies are needed. Existing captain IDs are preserved and differ from their slots.

Store `draft.bracket` as nullable JSON `{seeds:number[], winners:Partial<Record<MatchId,number>>}` and `draft.bracket_revision` as an integer starting at zero. Match IDs are `qf1`, `qf2`, `qf3`, `qf4`, `sf1`, `sf2`, `final`. Null bracket derives the default pairings from actual captain IDs by slot. All edits require the expected revision, increment it and touch the draft for realtime updates. Draft reset and undo clear bracket data and increment the revision, preventing stale edits after a restart. New migration preserves all current event data.

Two RPCs: `admin_bracket_seeds(p_captain_ids int[],p_expected_revision int)` and `admin_bracket_result(p_match text,p_winner int,p_expected_revision int)`. Both lock draft first, require phase `complete`, validate inputs and reject stale revisions. Null winner clears a result. Execution stays service-role-only with fixed search paths and explicit mutation filters.
