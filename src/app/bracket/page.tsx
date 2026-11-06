"use client";

import { useDraft } from "@/components/use-draft";
import { ErrorNotice, Header } from "@/components/ui";
import { TournamentBracket } from "@/components/tournament-bracket";

export default function BracketPage() {
  const { state, connected, error, setError, refresh } = useDraft(false);

  return <>
    <Header phase={state?.draft.phase} connected={connected} activePage="bracket" />
    <main className="main-shell">
      <ErrorNotice message={error} onDismiss={() => setError("")} />
      {state?.draft.announcement && <aside className="organizer-announcement" role="status">
        <span className="eyebrow">Announcement</span>
        <p>{state.draft.announcement}</p>
      </aside>}
      <div className="page-heading">
        <h1>Tournament bracket</h1>
        <a className="button secondary" href="/">View results</a>
      </div>
      {!state ? <section className="loading-state">
        <h2>Loading bracket…</h2>
        <p>{error ? "Unable to load the bracket." : "Connecting…"}</p>
        {error && <button className="button primary" onClick={() => void refresh()}>Try again</button>}
      </section> : state.draft.phase !== "complete" ? <section className="bracket-waiting">
        <h2>Awaiting published results</h2>
        <p>The tournament bracket will be available after the admin publishes the draft results.</p>
        <a className="button secondary" href="/">View draft</a>
      </section> : <>
        {state.mode === "local" && <div className="local-notice">Local practice</div>}
        <p className="bracket-help">Eight teams · Single elimination</p>
        <TournamentBracket state={state} />
      </>}
    </main>
  </>;
}
