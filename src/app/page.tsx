"use client";

import { useState } from "react";
import { useDraft } from "@/components/use-draft";
import {
  Header,
  Footer,
  Arrow,
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
      description: (
        <p>
          This browser will be your captain seat. Choose your own name; the
          organizer can help if you need to switch devices.
        </p>
      ),
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
    a.download = "cmu-pitt-draft-results.csv";
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
            <span className="eyebrow">CMU × PITT IN-HOUSE</span>
            <h1>
              Getting the board ready<span className="accent">.</span>
            </h1>
            <p>
              {error
                ? "The board is temporarily unavailable. Your seat is safe."
                : "Connecting to the live draft…"}
            </p>
            {error && (
              <button className="button primary" onClick={() => void refresh()}>
                Try again <Arrow />
              </button>
            )}
          </section>
        ) : (
          <>
            {state.mode === "local" && (
              <div className="local-notice">
                <span className="local-tag">LOCAL PRACTICE</span> Shared across
                tabs on this server. Connect Supabase before hosting your live
                event.
              </div>
            )}
            {state.draft.announcement && (
              <aside className="organizer-announcement" role="status">
                <span className="eyebrow">FROM THE ORGANIZER</span>
                <p>{state.draft.announcement}</p>
              </aside>
            )}
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="red-rule" /> LEAGUE OF LEGENDS · COMMUNITY
                  IN-HOUSE
                </div>
                <h1>
                  {state.draft.phase === "lobby" ? (
                    <>
                      Rivals on campus.
                      <br />
                      Teammates on the Rift<span className="accent">.</span>
                    </>
                  ) : state.draft.phase === "drafting" ? (
                    <>
                      The next pick
                      <br />
                      changes everything<span className="accent">.</span>
                    </>
                  ) : state.draft.phase === "review" ? (
                    <>
                      Every pick is in<span className="accent">.</span>
                    </>
                  ) : (
                    <>
                      The teams are set<span className="accent">.</span>
                    </>
                  )}
                </h1>
                <p>
                  {state.draft.phase === "lobby"
                    ? "Eight captains. One snake draft. Find your seat and build your five."
                    : state.draft.phase === "drafting"
                      ? "Make your read. Trust your team. Follow every pick as it happens."
                      : state.draft.phase === "review"
                        ? "The organizer is reviewing the teams before confirming the next phase."
                        : "From the draft board to the Rift. Here’s your CMU × Pitt lineup."}
                </p>
              </div>
              <div className="event-ticket">
                <div className="ticket-top">
                  <span>
                    CMU <span className="ticket-x">×</span> PITT
                  </span>
                  <span className="ticket-icon">↗</span>
                </div>
                <div className="ticket-stats">
                  <div>
                    <strong>08</strong>
                    <span>CAPTAINS</span>
                  </div>
                  <div>
                    <strong>
                      {String(state.draft.picks_per_team).padStart(2, "0")}
                    </strong>
                    <span>ROUNDS</span>
                  </div>
                  <div>
                    <strong>{String(total).padStart(2, "0")}</strong>
                    <span>PICKS</span>
                  </div>
                </div>
                <div className="ticket-bottom">
                  <span>
                    {state.draft.phase === "lobby"
                      ? "WAITING FOR CAPTAINS"
                      : state.draft.phase === "drafting"
                        ? "THE DRAFT IS LIVE"
                        : "DRAFT COMPLETE"}
                  </span>
                  <span className="barcode" aria-hidden="true">
                    ▥▥▥▥
                  </span>
                </div>
              </div>
            </section>

            {state.draft.phase === "lobby" ? (
              <>
                <section className="lobby-status">
                  <div>
                    <span className="status-dot" />
                    <strong>
                      {ready === 8 ? "Everyone is ready." : "The lobby is open"}
                    </strong>
                    <span className="status-caption">
                      The organizer starts the draft after reviewing attendance
                      and captain readiness.
                    </span>
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
                  <div
                    className="readiness-track"
                    aria-label={`${ready} of 8 captains ready`}
                  >
                    {state.captains.map((c) => (
                      <i
                        key={c.id}
                        className={
                          c.ready ? "ready" : c.claimed ? "claimed" : ""
                        }
                      />
                    ))}
                  </div>
                </section>
                {me && !spectator ? (
                  <section
                    className={"my-seat " + (me.ready ? "seat-ready" : "")}
                  >
                    <span className="seat-check">{me.ready ? "✓" : "C"}</span>
                    <div>
                      <span className="eyebrow">YOUR CAPTAIN SEAT</span>
                      <h2>You are {me.display_name}</h2>
                      <p>
                        {me.ready
                          ? "You’re ready. Waiting for the organizer to start the draft."
                          : "Take a breath, check your pool, then ready up."}
                      </p>
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
                      {busy
                        ? "Updating…"
                        : me.ready
                          ? "✓ Ready · click to unready"
                          : "I’m ready"}
                      {!me.ready && <Arrow />}
                    </button>
                  </section>
                ) : (
                  <div className="lobby-intro">
                    <div>
                      <span className="eyebrow">
                        {spectator
                          ? "YOU’RE WATCHING THE DRAFT"
                          : "STEP 01 · TAKE YOUR SEAT"}
                      </span>
                      <h2>
                        {spectator
                          ? "A front-row seat."
                          : "Captains, check in."}
                      </h2>
                      <p>
                        {spectator
                          ? "Sit tight. The board will switch to the draft automatically."
                          : "Choose your captain name below. Just here for the show?"}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => watch(!spectator)}
                    >
                      {spectator
                        ? me
                          ? "Return to captain view"
                          : "I’m a captain"
                        : "Watch as spectator"}
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
                        <span className="captain-slot">
                          CAPTAIN {String(c.slot).padStart(2, "0")}
                        </span>
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
                      <span className="captain-avatar">
                        {c.display_name[0]}
                      </span>
                      <h3>{c.display_name}</h3>
                      <Rank rank={c.peak_rank} />
                      <div className="captain-card-bottom">
                        {!c.claimed && !spectator && !me ? (
                          <button onClick={() => claim(c)} disabled={busy}>
                            Claim seat <Arrow />
                          </button>
                        ) : (
                          <span>
                            {me?.id === c.id
                              ? "Your seat"
                              : c.claimed
                                ? "Captain checked in"
                                : spectator
                                  ? "Awaiting captain"
                                  : "Seat available"}
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
                <div className="section-divider">
                  <span>THE LINEUP</span>
                  <span>
                    {state.players.length} PLAYERS ·{" "}
                    {state.draft.picks_per_team + 1} PER TEAM
                  </span>
                </div>
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
                        <span className="eyebrow">ON THE BOARD</span>
                        <strong>
                          {String(state.draft.pick_index + 1).padStart(2, "0")}
                          <span> / {total}</span>
                        </strong>
                      </div>
                      <div className="turn-name">
                        <span className="eyebrow">
                          {isMyTurn
                            ? "YOUR PICK · YOU’RE ON THE CLOCK"
                            : `ROUND ${round} · ON THE CLOCK`}
                        </span>
                        <h2>{onClock?.display_name}</h2>
                        <p>
                          {isMyTurn
                            ? "Your team is waiting. Choose a player from the pool."
                            : "Watching the next team take shape."}
                        </p>
                      </div>
                      <div className="turn-format">
                        <span className="snake-symbol" aria-hidden="true">
                          ↝
                        </span>
                        <strong>SNAKE DRAFT</strong>
                        <span>
                          {state.draft.picks_per_team} rounds · No pick timer
                        </span>
                      </div>
                    </section>
                    <div className="order-strip">
                      <span className="order-label">
                        UP NEXT <Arrow />
                      </span>
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
                    {(!me || spectator) && (
                      <div className="watch-banner">
                        <span>◉</span>
                        <p>
                          You’re watching live. Every pick appears here
                          automatically.
                        </p>
                        {spectator && (
                          <button
                            className="text-button"
                            onClick={() => watch(false)}
                          >
                            {me ? "Return to captain view" : "I’m a captain"}
                          </button>
                        )}
                      </div>
                    )}
                    {!me &&
                      !spectator &&
                      state.captains.some((c) => !c.claimed) && (
                        <section className="reclaim-panel">
                          <h3>Rejoining the draft?</h3>
                          <p>
                            The organizer released these seats. Claim your name
                            to continue.
                          </p>
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
                                  <Arrow />
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
                      <span>THE TEAMS</span>
                      <span>EVERY ROSTER, IN REAL TIME</span>
                    </div>
                    <TeamGrid state={state} activeId={onClock?.id} />
                  </>
                ) : (
                  <>
                    <section className="results-banner">
                      <div>
                        <span className="complete-check">✓</span>
                        <div>
                          <span className="eyebrow">GG, WELL DRAFTED</span>
                          <h2>
                            {state.draft.phase === "review"
                              ? "Teams drafted. Awaiting admin confirmation."
                              : "Eight teams. Ready for the Rift."}
                          </h2>
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
                            {copied ? "✓ Copied for Discord" : "Copy results"}
                            <Arrow />
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
                    <div className="section-divider">
                      <span>STILL IN THE POOL</span>
                      <span>UNDRAFTED PLAYERS</span>
                    </div>
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
      <Footer />
      <ConfirmDialog
        confirmation={confirmation}
        busy={busy}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation && void run(confirmation.onConfirm)}
      />
    </>
  );
}
