"use client";

import { useState } from "react";
import { useDraft } from "@/components/use-draft";
import {
  Header,
  Rank,
  ConfirmDialog,
  ErrorNotice,
  type Confirmation,
} from "@/components/ui";
import { PlayerPool } from "@/components/player-pool";
import { TeamGrid } from "@/components/team-grid";
import { AttendancePanel } from "@/components/attendance-panel";
import {
  captainSlotAt,
  currentCaptain,
  resultsCsv,
  resultsText,
} from "@/lib/draft";
import { request } from "@/lib/client";
import type { Captain, Player } from "@/lib/types";

export default function Home() {
  const {
    state,
    error,
    setError,
    token,
    captainId,
    remember,
    spectator,
    watch,
    connected,
    refresh,
  } = useDraft();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const me = state?.captains.find((c) => c.id === captainId);
  const onClock = state ? currentCaptain(state) : undefined;
  const isMyTurn = !!me && !spectator && onClock?.id === me.id;
  const total = state ? state.captains.length * state.draft.picks_per_team : 32;
  const claimed = state?.captains.filter((c) => c.claimed).length || 0;
  const ready = state?.captains.filter((c) => c.ready).length || 0;
  const round = state
    ? Math.min(
        Math.floor(state.draft.pick_index / 8) + 1,
        state.draft.picks_per_team,
      )
    : 1;
  const last = state?.players
    .filter((p) => p.pick_number !== null)
    .sort((a, b) => b.pick_number! - a.pick_number!)[0];

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setConfirmation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setConfirmation(null);
    } finally {
      await refresh(true);
      setBusy(false);
    }
  }
  function claim(c: Captain) {
    setConfirmation({
      title: `Join as ${c.display_name}?`,
      description: <p>Select your own captain name.</p>,
      label: "Claim captain seat",
      onConfirm: async () => {
        const result = await request<{ token: string; captainId: number }>(
          "/api/claim",
          { captainId: c.id },
        );
        remember(result.token, result.captainId);
        watch(false);
      },
    });
  }
  function pick(p: Player) {
    if (!state) return;
    setConfirmation({
      title: `Draft ${p.display_name}?`,
      description: (
        <p>
          <strong>{p.riot_id}</strong> · {p.peak_rank}
          <br />
          Pick {state.draft.pick_index + 1} will add this player to{" "}
          {me?.display_name}&apos;s team.
        </p>
      ),
      label: "Confirm draft pick",
      onConfirm: async () => {
        await request("/api/pick", {
          token,
          playerId: p.id,
          expectedPickIndex: state.draft.pick_index,
        });
      },
    });
  }
  async function copyResults() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(resultsText(state));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Clipboard access failed. Download the CSV instead.");
    }
  }
  function download() {
    if (!state) return;
    const url = URL.createObjectURL(
      new Blob([resultsCsv(state)], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "draft-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Header phase={state?.draft.phase} connected={connected} />
      <main className="main-shell">
        <ErrorNotice message={error} onDismiss={() => setError("")} />
        {!state ? (
          <section className="loading-state">
            <h1>Loading draft…</h1>
            <p>{error ? "Unable to load the draft." : "Connecting…"}</p>
            {error && (
              <button className="button primary" onClick={() => void refresh()}>
                Try again
              </button>
            )}
          </section>
        ) : (
          <>
            {state.mode === "local" && (
              <div className="local-notice">Local practice</div>
            )}
            {state.draft.announcement && (
              <aside className="organizer-announcement" role="status">
                <span className="eyebrow">Announcement</span>
                <p>{state.draft.announcement}</p>
              </aside>
            )}
            <div className="page-heading">
              <h1>
                {state.draft.phase === "lobby"
                  ? "Lobby"
                  : state.draft.phase === "drafting"
                    ? "Draft"
                    : state.draft.phase === "review"
                      ? "Review"
                      : "Results"}
              </h1>
            </div>

            {state.draft.phase === "lobby" ? (
              <>
                <section className="lobby-status">
                  <div>
                    <span className="status-dot" />
                    <strong>Waiting for admin</strong>
                  </div>
                  <div className="lobby-counts">
                    <span>
                      Claimed{" "}
                      <strong>
                        {claimed}
                        <small>/8</small>
                      </strong>
                    </span>
                    <span>
                      Ready{" "}
                      <strong>
                        {ready}
                        <small>/8</small>
                      </strong>
                    </span>
                  </div>
                </section>
                {me && !spectator ? (
                  <section
                    className={"my-seat " + (me.ready ? "seat-ready" : "")}
                  >
                    <div>
                      <span className="eyebrow">Your seat</span>
                      <h2>{me.display_name}</h2>

                      <button
                        className="button secondary unselect-seat"
                        disabled={busy}
                        onClick={() =>
                          setConfirmation({
                            title: "Release your captain seat?",
                            description:
                              "Your name will be available for someone else to claim.",
                            label: "Release seat",
                            onConfirm: async () => {
                              await request("/api/release", { token });
                              remember("", null);
                            },
                          })
                        }
                      >
                        Unselect seat
                      </button>
                    </div>
                    <button
                      className={
                        "button " + (me.ready ? "secondary" : "primary")
                      }
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await request("/api/ready", {
                            token,
                            ready: !me.ready,
                          });
                        })
                      }
                    >
                      {busy ? "Updating…" : me.ready ? "Unready" : "Ready"}
                    </button>
                  </section>
                ) : (
                  <div className="lobby-intro">
                    <div>
                      <h2>{spectator ? "Spectating" : "Captains"}</h2>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => watch(!spectator)}
                    >
                      {spectator
                        ? me
                          ? "Captain view"
                          : "I’m a captain"
                        : "Spectate"}
                      <span aria-hidden="true">{spectator ? "→" : "◉"}</span>
                    </button>
                  </div>
                )}
                <div className="captain-grid">
                  {state.captains.map((c) => (
                    <article
                      key={c.id}
                      className={
                        "captain-card " +
                        (c.claimed ? "taken" : "available") +
                        (me?.id === c.id ? " mine" : "")
                      }
                    >
                      <div className="captain-card-top">
                        <span className="captain-slot">#{c.slot}</span>
                        <span
                          className={
                            "seat-badge " +
                            (c.ready ? "ready" : c.claimed ? "claimed" : "")
                          }
                        >
                          {c.ready
                            ? "✓ Ready"
                            : c.claimed
                              ? "Not ready"
                              : "Open seat"}
                        </span>
                      </div>
                      <h3>{c.display_name}</h3>
                      <Rank rank={c.peak_rank} />
                      <div className="captain-card-bottom">
                        {!c.claimed && !spectator && !me ? (
                          <button onClick={() => claim(c)} disabled={busy}>
                            Claim seat
                          </button>
                        ) : (
                          <span>
                            {me?.id === c.id
                              ? "Your seat"
                              : c.claimed
                                ? "Claimed"
                                : spectator
                                  ? "Open"
                                  : "Open"}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <AttendancePanel
                  players={state.players}
                  onChanged={() => refresh(true)}
                  onError={setError}
                />
                <PlayerPool players={state.players} showAttendance />
              </>
            ) : (
              <>
                {state.draft.phase === "drafting" ? (
                  <>
                    <section
                      className={"turn-banner " + (isMyTurn ? "your-turn" : "")}
                    >
                      <div className="turn-pick">
                        <span className="eyebrow">Pick</span>
                        <strong>
                          {String(state.draft.pick_index + 1).padStart(2, "0")}
                          <span> / {total}</span>
                        </strong>
                      </div>
                      <div className="turn-name">
                        <span className="eyebrow">
                          {isMyTurn ? "Your turn" : `Round ${round}`}
                        </span>
                        <h2>{onClock?.display_name}</h2>
                      </div>
                    </section>
                    <div className="order-strip">
                      <span className="order-label">Next</span>
                      <div className="order-picks">
                        {Array.from(
                          {
                            length: Math.min(8, total - state.draft.pick_index),
                          },
                          (_, i) => {
                            const k = state.draft.pick_index + i;
                            const c = state.captains.find(
                              (c) => c.slot === captainSlotAt(k),
                            );
                            return (
                              <div
                                className={
                                  i === 0 ? "next-pick active" : "next-pick"
                                }
                                key={k}
                              >
                                <span>#{k + 1}</span>
                                <strong>{c?.display_name}</strong>
                                {i === 0 && <i />}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                    {last && (
                      <p className="last-pick">
                        <span>LAST PICK</span>{" "}
                        {
                          state.captains.find(
                            (c) => c.id === last.team_captain_id,
                          )?.display_name
                        }{" "}
                        drafted <strong>{last.display_name}</strong>{" "}
                        <span className="pick-muted">
                          · Pick {last.pick_number}
                        </span>
                      </p>
                    )}
                    {spectator && (
                      <div className="watch-banner">
                        <span>Spectating</span>
                        <button
                          className="text-button"
                          onClick={() => watch(false)}
                        >
                          {me ? "Captain view" : "I’m a captain"}
                        </button>
                      </div>
                    )}
                    {!me &&
                      !spectator &&
                      state.captains.some((c) => !c.claimed) && (
                        <section className="reclaim-panel">
                          <h3>Available captain seats</h3>
                          <div>
                            {state.captains
                              .filter((c) => !c.claimed)
                              .map((c) => (
                                <button
                                  className="button secondary"
                                  key={c.id}
                                  onClick={() => claim(c)}
                                  disabled={busy}
                                >
                                  {c.display_name}
                                </button>
                              ))}
                          </div>
                        </section>
                      )}
                    <PlayerPool
                      players={state.players.filter((p) => p.present)}
                      onPick={isMyTurn ? pick : undefined}
                      disabled={busy}
                    />
                    <div className="section-divider">
                      <h2>Teams</h2>
                    </div>
                    <TeamGrid state={state} activeId={onClock?.id} />
                  </>
                ) : (
                  <>
                    <section className="results-banner">
                      <div>
                        <div>
                          {state.draft.phase === "review" && (
                            <h2>Awaiting admin approval</h2>
                          )}
                          <p>
                            {total} picks made ·{" "}
                            {
                              state.players.filter(
                                (p) => p.present && p.team_captain_id === null,
                              ).length
                            }{" "}
                            players undrafted
                          </p>
                        </div>
                      </div>
                      {state.draft.phase === "complete" && (
                        <div className="results-actions">
                          <button
                            className="button primary"
                            onClick={() => void copyResults()}
                          >
                            {copied ? "Copied" : "Copy results"}
                          </button>
                          <button
                            className="button secondary"
                            onClick={download}
                          >
                            Download CSV <span aria-hidden="true">↓</span>
                          </button>
                        </div>
                      )}
                    </section>
                    <TeamGrid state={state} />
                    <PlayerPool
                      players={state.players.filter((p) => p.present)}
                      complete
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
      <ConfirmDialog
        confirmation={confirmation}
        busy={busy}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation && void run(confirmation.onConfirm)}
      />
    </>
  );
}
