"use client";

import { useState } from "react";
import type { Player } from "@/lib/types";

export function AdminAttendance({
  players,
  lobby,
  busy,
  onToggle,
}: {
  players: Player[];
  lobby: boolean;
  busy: boolean;
  onToggle: (player: Player) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = players.filter((p) =>
    `${p.display_name} ${p.riot_id}`.toLowerCase().includes(q),
  );
  return (
    <section className="attendance-panel">
      <div className="section-heading">
        <div>
          <h2>Attendance</h2>
        </div>
        <span className="count-pill">
          {players.filter((p) => p.present).length}/35 present
        </span>
      </div>
      {!lobby && <p>Attendance locked.</p>}
      <label className="search-field attendance-search">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Search attendance"
          placeholder="Search player or Riot ID…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="attendance-admin-list">
        {visible.map((p) => (
          <div key={p.id}>
            <div>
              <strong>{p.display_name}</strong>
              <small>{p.riot_id}</small>
            </div>
            <span
              className={"attendance-badge " + (p.present ? "present" : "")}
            >
              {p.present ? "✓ Present" : "Not checked in"}
            </span>
            <button
              className="button secondary"
              disabled={busy || !lobby}
              onClick={() => onToggle(p)}
              aria-label={`${p.present ? "Mark absent" : "Mark present"}: ${p.display_name}`}
            >
              {p.present ? "Mark absent" : "Mark present"}
            </button>
          </div>
        ))}
      </div>
      {!visible.length && (
        <p className="empty-state">No players match your search.</p>
      )}
    </section>
  );
}
