"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/lib/types";
import { visiblePlayers } from "@/lib/draft";
import { Arrow, Rank } from "./ui";

export function PlayerPool({
  players,
  onPick,
  disabled = false,
  complete = false,
}: {
  players: Player[];
  onPick?: (p: Player) => void;
  disabled?: boolean;
  complete?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"rank" | "name">("rank");
  const pool = useMemo(
    () => visiblePlayers(players, query, sort),
    [players, query, sort],
  );
  const available = players.filter((p) => p.team_captain_id === null).length;
  return (
    <section className="pool-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {complete ? "THE FREE AGENTS" : "SCOUT YOUR NEXT PICK"}
          </span>
          <h2>
            {complete ? "Undrafted players" : "Player pool"}{" "}
            <span className="count-pill">{available}</span>
          </h2>
        </div>
        <span className="quiet-label">PEAK SOLO / DUO</span>
      </div>
      <div className="pool-tools">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search players"
            placeholder="Search name, Riot ID, or rank…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              ×
            </button>
          )}
        </label>
        <label className="sort-field">
          <span className="sr-only">Sort players</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "rank" | "name")}
          >
            <option value="rank">Rank: highest first</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="player-table">
          <thead>
            <tr>
              <th>PLAYER</th>
              <th>PEAK RANK</th>
              <th>RIOT ID</th>
              {onPick && (
                <th>
                  <span className="sr-only">Draft action</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pool.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <div className="player-name">
                    <span className="player-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <strong>{p.display_name}</strong>
                  </div>
                </td>
                <td>
                  <Rank rank={p.peak_rank} />
                </td>
                <td>
                  <a
                    className="riot-link"
                    href={p.opgg_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.riot_id}
                    <Arrow diagonal />
                  </a>
                </td>
                {onPick && (
                  <td>
                    <button
                      className="draft-button"
                      disabled={disabled}
                      onClick={() => onPick(p)}
                      aria-label={`Draft ${p.display_name}`}
                    >
                      Draft <Arrow />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pool.length === 0 && (
        <div className="empty-state">
          {query
            ? "No players match your search."
            : complete
              ? "Every player has a team."
              : "The pool is empty."}
        </div>
      )}
      <div className="pool-bottom">
        <span>
          {query
            ? `${pool.length} matching players`
            : `${available} players available`}
        </span>
        <span>
          Ranks are from the sign-up snapshot <span aria-hidden="true">↗</span>
        </span>
      </div>
    </section>
  );
}
