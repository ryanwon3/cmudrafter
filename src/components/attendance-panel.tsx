"use client";

import { useEffect, useRef, useState } from "react";
import type { Player } from "@/lib/types";
import { request } from "@/lib/client";

const STORAGE_KEY = "cmu-pitt-player-token";

export function AttendancePanel({
  players,
  onChanged,
  onError,
}: {
  players: Player[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [token, setToken] = useState("");
  const tokenRef = useRef("");
  const mountedRef = useRef(false);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const present = players.filter((p) => p.present).length;
  const me = players.find((p) => p.id === playerId && p.present);

  function remember(value: string, id: number | null) {
    tokenRef.current = value;
    setToken(value);
    setPlayerId(id);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      setNotice(
        "Browser storage is unavailable. Keep this tab open to retain your check-in.",
      );
    }
  }
  function forget(expectedToken: string) {
    if (tokenRef.current !== expectedToken) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== expectedToken) {
        tokenRef.current = saved;
        setToken(saved);
        setPlayerId(null);
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* The in-memory identity can still be cleared. */
    }
    tokenRef.current = "";
    setToken("");
    setPlayerId(null);
  }
  useEffect(() => {
    mountedRef.current = true;
    function sync() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || "";
        if (saved !== tokenRef.current) setPlayerId(null);
        tokenRef.current = saved;
        setToken(saved);
      } catch {
        /* Keep an in-memory check-in when storage is unavailable. */
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) sync();
    };
    sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
    };
  }, []);
  useEffect(() => {
    if (!token) {
      setPlayerId(null);
      return;
    }
    request<{ playerId: number | null }>("/api/attendance", {
      action: "me",
      token,
    })
      .then((result) => {
        // A fresh roster snapshot does not invalidate this token's pending
        // lookup. Token changes/revocation still reject older responses.
        if (!mountedRef.current || tokenRef.current !== token) return;
        setPlayerId(result.playerId);
        if (result.playerId === null) forget(token);
      })
      .catch(() => {
        /* A temporary sync failure must not discard a valid identity. */
      });
  }, [token, players]);

  async function update(leave = false) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (leave) {
        await request("/api/attendance", { action: "leave", token });
        forget(token);
      } else {
        const result = await request<{ token: string; playerId: number }>(
          "/api/attendance",
          { action: "check-in", playerId: Number(selected) },
        );
        remember(result.token, result.playerId);
        setSelected("");
      }
      await onChanged();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to update attendance.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="attendance-panel" aria-labelledby="attendance-title">
      <div className="section-heading">
        <div>
          <h2 id="attendance-title">Player check-in</h2>
        </div>
        <strong className="attendance-count">{present}/{players.length} present</strong>
      </div>
      <p>Players check in here. Captains use Ready.</p>
      {me ? (
        <div className="attendance-confirmed" role="status">
          <div>
            <strong>✓ Present: {me.display_name}</strong>
            <p>{me.riot_id}</p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void update(true)}
          >
            Withdraw attendance
          </button>
        </div>
      ) : (
        <form
          className="attendance-form"
          onSubmit={(event) => {
            event.preventDefault();
            void update();
          }}
        >
          <label htmlFor="player-check-in">Your player name</label>
          <select
            id="player-check-in"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={busy || (!!token && playerId === null)}
            required
          >
            <option value="">Select your name…</option>
            {players.map((p) => (
              <option value={p.id} key={p.id} disabled={p.present}>
                {p.display_name} · {p.riot_id}
                {p.present ? " — present" : ""}
              </option>
            ))}
          </select>
          <button className="button primary" disabled={busy || !selected}>
            {busy ? "Updating…" : "Confirm attendance"}
          </button>
        </form>
      )}
      <p className="attendance-help">
        Waiting for admin to start.
      </p>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
