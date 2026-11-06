"use client";

import { useEffect, useState } from "react";
import { useDraft } from "@/components/use-draft";
import {
  Header,
  Footer,
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
      setNotice("Board updated. All viewers will receive the change.");
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
            <span className="eyebrow">
              <span className="red-rule" /> ORGANIZER’S DESK
            </span>
            <h1>
              Draft control<span className="accent">.</span>
            </h1>
            <p>Keep the lobby moving. Put the board back on track.</p>
          </div>
          <a className="button secondary" href="/">
            View live board <Arrow diagonal />
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
            <span className="eyebrow">ORGANIZER ACCESS</span>
            <h2>Admin login</h2>
            <p>
              Enter the organizer password to manage attendance, draft phases
              and resets.
            </p>
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
              <Arrow />
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
              <span>✓ Organizer session active</span>
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
                Lock controls
              </button>
            </div>
            {state ? (
              <>
                <section className="admin-controls">
                  <div className="admin-control-card">
                    <span className="eyebrow">DRAFT STATUS</span>
                    <h2>
                      {state.draft.phase === "lobby"
                        ? "Waiting in lobby"
                        : state.draft.phase === "drafting"
                          ? `Pick ${state.draft.pick_index + 1} · ${onClock?.display_name}`
                          : state.draft.phase === "review"
                            ? "Review final teams"
                            : "Results published"}
                    </h2>
                    <p>
                      {state.captains.filter((c) => c.ready).length}/8 captains
                      ready · {state.players.filter((p) => p.present).length}/35
                      players present · {state.draft.pick_index}/32 picks made
                    </p>
                    <p>
                      Eight teams · four picks each. At least 32 present players
                      are required. Readiness never starts the draft
                      automatically.
                    </p>
                    <div className="control-buttons">
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          state.draft.phase !== "lobby" ||
                          state.players.filter((p) => p.present).length < 32
                        }
                        onClick={() =>
                          confirm(
                            "Start the draft now?",
                            `Attendance will close and drafting will begin for everyone. ${state.captains.filter((c) => c.ready).length}/8 captains are ready. You can pick for captains who have not checked in.`,
                            "Start draft",
                            () => action("start"),
                          )
                        }
                      >
                        Confirm draft start <Arrow />
                      </button>
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
                          Confirm teams &amp; publish results <Arrow />
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
                    <span className="eyebrow">NEXT PHASE</span>
                    <h2>Tell everyone what’s next</h2>
                    <p>
                      Publish a lobby update, start time or next-phase
                      announcement. It appears on the live board for everyone.
                    </p>
                    <div className="settings-input">
                      <label htmlFor="announcement">Announcement</label>
                      <textarea
                        id="announcement"
                        maxLength={500}
                        rows={3}
                        value={announcement}
                        onChange={(event) =>
                          setAnnouncement(event.target.value)
                        }
                        disabled={busy}
                        placeholder="Draft begins at 7:30 PM after attendance is confirmed."
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
                      <span className="eyebrow">CAPTAIN ACCESS</span>
                      <h2>Manage seats</h2>
                    </div>
                  </div>
                  <p className="muted">
                    Releasing a seat revokes its old token. The captain can
                    claim it again on another device.
                  </p>
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
                          Release seat <Arrow />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                {state.draft.phase === "drafting" && (
                  <>
                    <div className="section-divider">
                      <span>PICK FOR AN ABSENT CAPTAIN</span>
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
                  <span>CURRENT ROSTERS</span>
                  <span>{state.draft.pick_index} PICKS MADE</span>
                </div>
                <TeamGrid state={state} activeId={onClock?.id} />
                <section className="reset-panel">
                  <div>
                    <span className="eyebrow">START OVER</span>
                    <h2>Reset the board</h2>
                    <p>
                      These controls remove all picks and return everyone to the
                      lobby.
                    </p>
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
                      Full reset <Arrow />
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
