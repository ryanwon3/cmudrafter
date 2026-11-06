"use client";

import { useEffect, useState } from "react";
import { useDraft } from "@/components/use-draft";
import {
  Header,
  Arrow,
  ConfirmDialog,
  ErrorNotice,
  type Confirmation,
} from "@/components/ui";
import { PlayerPool } from "@/components/player-pool";
import { TeamGrid } from "@/components/team-grid";
import { AdminAttendance } from "@/components/admin-attendance";
import { currentCaptain } from "@/lib/draft";
import { request } from "@/lib/client";

const ADMIN_SESSION = "cmu-pitt-admin-key";
export default function Admin() {
  const { state, error, setError, connected, refresh } = useDraft(false);
  const [key, setKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const onClock = state ? currentCaptain(state) : undefined;

  async function verify(candidate: string) {
    setBusy(true);
    setError("");
    try {
      await request("/api/admin", { action: "verify" }, candidate);
      setKey(candidate);
      setAuthorized(true);
      try {
        sessionStorage.setItem(ADMIN_SESSION, candidate);
      } catch {
        setNotice(
          "Admin access lasts until this page closes; session storage is unavailable.",
        );
      }
    } catch (e) {
      setAuthorized(false);
      setError(e instanceof Error ? e.message : "Admin verification failed.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_SESSION);
      if (saved) void verify(saved);
    } catch {
      /* Manual sign-in remains available. */
    }
  }, []);
  useEffect(() => {
    if (state) setAnnouncement(state.draft.announcement || "");
  }, [state?.draft.announcement]);
  async function action(name: string, payload: Record<string, unknown> = {}) {
    await request("/api/admin", { action: name, ...payload }, key);
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setConfirmation(null);
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed.");
      setConfirmation(null);
    } finally {
      await refresh(true);
      setBusy(false);
    }
  }
  const confirm = (
    title: string,
    description: string,
    label: string,
    fn: () => Promise<void>,
    danger = false,
  ) => setConfirmation({ title, description, label, onConfirm: fn, danger });

  return (
    <>
      <Header phase={state?.draft.phase} connected={connected} admin />
      <main className="main-shell admin-shell">
        <ErrorNotice message={error} onDismiss={() => setError("")} />
        <div className="admin-title">
          <div>
            <h1>Admin</h1>
          </div>
          <a className="button secondary" href="/">
            View draft <Arrow diagonal />
          </a>
        </div>
        {!authorized ? (
          <form
            className="admin-login"
            onSubmit={(e) => {
              e.preventDefault();
              void verify(key);
            }}
          >
            <h2>Admin login</h2>
            <label htmlFor="admin-key">Admin password</label>
            <input
              id="admin-key"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter admin password"
              required
            />
            <button className="button primary" disabled={busy || !key}>
              {busy ? "Signing in…" : "Log in as admin"}
            </button>
          </form>
        ) : (
          <>
            {notice && (
              <div className="success-notice" role="status">
                ✓ {notice}
              </div>
            )}
            <div className="admin-session">
              <span>Signed in</span>
              <button
                className="text-button"
                onClick={() => {
                  setAuthorized(false);
                  setKey("");
                  try {
                    sessionStorage.removeItem(ADMIN_SESSION);
                  } catch {
                    /* Cleared in memory. */
                  }
                }}
              >
                Log out
              </button>
            </div>
            {state ? (
              <>
                <section className="admin-controls">
                  <div className="admin-control-card">
                    <h2>
                      {state.draft.phase === "lobby"
                        ? "Lobby"
                        : state.draft.phase === "drafting"
                          ? `Pick ${state.draft.pick_index + 1} · ${onClock?.display_name}`
                          : state.draft.phase === "review"
                            ? "Review teams"
                            : "Results published"}
                    </h2>
                    <p>
                      {state.captains.filter((c) => c.ready).length}/8 captains
                      ready · {state.players.filter((p) => p.present).length}/{state.players.length}{" "}
                      players present · {state.draft.pick_index}/32 picks made
                    </p>
                    <div className="control-buttons">
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          state.draft.phase !== "lobby"
                        }
                        onClick={() =>
                          confirm(
                            "Start the draft now?",
                            `${state.players.filter((p) => p.present).length} players are present for 32 picks. Attendance will close. ${state.captains.filter((c) => c.ready).length}/8 captains are ready. You can pick for unclaimed seats and finish with incomplete teams.`,
                            "Start draft",
                            () => action("start"),
                          )
                        }
                      >
                        Start draft
                      </button>
                      {state.draft.phase === "drafting" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            confirm(
                              "Finish drafting?",
                              `${state.draft.pick_index}/32 picks made. Current picks will be kept, empty team slots will remain unfilled, and everyone will move to team review.`,
                              "Finish draft",
                              () => action("finish"),
                            )
                          }
                        >
                          Finish draft
                        </button>
                      )}
                      {state.draft.phase === "review" && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            confirm(
                              "Publish the final teams?",
                              "Confirm these rosters and move everyone to the results phase. You can still undo a pick if needed.",
                              "Publish results",
                              () => action("publish"),
                            )
                          }
                        >
                          Publish results
                        </button>
                      )}
                      <button
                        className="button secondary"
                        disabled={busy || state.draft.pick_index === 0}
                        onClick={() =>
                          confirm(
                            "Undo the last pick?",
                            "The player will return to the pool and the turn will return to that captain.",
                            "Undo pick",
                            () => action("undo"),
                          )
                        }
                      >
                        Undo last pick ↶
                      </button>
                    </div>
                  </div>
                  <form
                    className="admin-control-card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(() =>
                        action("announcement", { message: announcement }),
                      );
                    }}
                  >
                    <h2>Announcement</h2>
                    <div className="settings-input">
                      <label className="sr-only" htmlFor="announcement">
                        Announcement
                      </label>
                      <textarea
                        id="announcement"
                        maxLength={500}
                        rows={3}
                        value={announcement}
                        onChange={(event) =>
                          setAnnouncement(event.target.value)
                        }
                        disabled={busy}
                        placeholder="Message shown to everyone…"
                      />
                      <button className="button secondary" disabled={busy}>
                        Publish announcement
                      </button>
                    </div>
                  </form>
                </section>
                <AdminAttendance
                  players={state.players}
                  lobby={state.draft.phase === "lobby"}
                  busy={busy}
                  onToggle={(p) =>
                    confirm(
                      `${p.present ? "Mark absent" : "Mark present"}: ${p.display_name}?`,
                      p.present
                        ? "This removes the player from the eligible pool and revokes their check-in token."
                        : "This confirms the player is here and eligible for drafting.",
                      p.present ? "Mark absent" : "Mark present",
                      () =>
                        action("attendance", {
                          playerId: p.id,
                          present: !p.present,
                        }),
                    )
                  }
                />
                <section className="admin-seats">
                  <div className="section-heading">
                    <div>
                      <h2>Captain seats</h2>
                    </div>
                  </div>
                  <div className="admin-seat-list">
                    {state.captains.map((c) => (
                      <div key={c.id}>
                        <span className="captain-slot">
                          {String(c.slot).padStart(2, "0")}
                        </span>
                        <strong>{c.display_name}</strong>
                        <span
                          className={
                            "seat-badge " +
                            (c.ready ? "ready" : c.claimed ? "claimed" : "")
                          }
                        >
                          {c.ready ? "Ready" : c.claimed ? "Claimed" : "Open"}
                        </span>
                        <button
                          className="text-button"
                          disabled={!c.claimed || busy}
                          onClick={() =>
                            confirm(
                              `Release ${c.display_name}?`,
                              "This browser’s current captain token will stop working immediately. The seat will reopen for claiming.",
                              "Release seat",
                              () => action("release", { captainId: c.id }),
                            )
                          }
                        >
                          Release seat
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                {state.draft.phase === "drafting" && (
                  <>
                    <div className="section-divider">
                      <h2>Admin pick</h2>
                      <span>ON THE CLOCK: {onClock?.display_name}</span>
                    </div>
                    <PlayerPool
                      players={state.players.filter((p) => p.present)}
                      disabled={busy}
                      onPick={(p) =>
                        confirm(
                          `Draft ${p.display_name} for ${onClock?.display_name}?`,
                          `This records pick ${state.draft.pick_index + 1} and advances the draft for everyone.`,
                          "Confirm admin pick",
                          () =>
                            action("pick", {
                              playerId: p.id,
                              expectedPickIndex: state.draft.pick_index,
                            }),
                        )
                      }
                    />
                  </>
                )}
                <div className="section-divider">
                  <h2>Teams</h2>
                </div>
                <TeamGrid state={state} activeId={onClock?.id} />
                <section className="reset-panel">
                  <div>
                    <h2>Reset</h2>
                    <p>Returns the draft to the lobby.</p>
                  </div>
                  <div className="control-buttons">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        confirm(
                          "Reset the draft, keep seats?",
                          "All picks and Ready statuses will be cleared. Captain seats and player attendance will be kept.",
                          "Reset draft",
                          () => action("reset"),
                          true,
                        )
                      }
                    >
                      Reset draft
                    </button>
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() =>
                        confirm(
                          "Full reset: clear every seat?",
                          "All picks, captain claims and player attendance will be cleared. Everyone must check in again.",
                          "Full reset",
                          () => action("full-reset"),
                          true,
                        )
                      }
                    >
                      Full reset
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <div className="loading-state">
                <h2>Loading board…</h2>
              </div>
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
