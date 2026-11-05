# CMU x PITT In-House Draft

A live snake draft for the CMU x PITT League in-house: 8 captains draft 4 players each from a pool of 35, and everyone (captains and spectators) watches the same board update live.

Built with Next.js (App Router, TypeScript, Tailwind), Supabase (Postgres + Realtime) and Vercel.

## How it works

- `/` shows whichever phase the draft is in: **Lobby** (captains claim their name and ready up), **Draft** (snake order, 32 picks), **Results** (final teams, Discord copy, CSV).
- `/admin` is the organizer's page. It asks for `ADMIN_KEY` and can release a name, force start, pick for the captain on the clock, undo the last pick, change picks per team (lobby only), reset, and full reset.
- Browsers never write to the database. They call the API routes in `src/app/api/`, which hold the secret key and call one Postgres function per action (`supabase/schema.sql`). Each function locks the single `draft` row first, so double clicks and simultaneous picks can't take the same player or skip a turn.
- Claim tokens are random, returned once, and stored in the captain's `localStorage`. The database keeps only a SHA-256 hash in `captain_tokens`, which the public key can't read.
- Every browser reloads `/api/state` on any Realtime change, every 5 seconds, and when the tab regains focus.

Defaults (from the spec): 4 picks per captain (teams of 5, 3 players undrafted), no pick timer, no claim password.

## Run it locally

Use **Node.js 24** (`nvm use` reads `.nvmrc`). The computer's older Node 20.17 cannot load the current Tailwind compiler. The scripts use webpack because Turbopack compiler subprocesses cannot open their IPC ports in some sandbox environments.

```bash
npm install
cp .env.example .env.local     # keep ADMIN_KEY=change-me-dev-admin-key, or set your own
npm run dev
```

Open http://127.0.0.1:3000. With no Supabase values in `.env.local`, the server uses an **in-memory store** shared by every window on that dev server (it resets when the dev server restarts, and is never used in production). The admin page is http://127.0.0.1:3000/admin with your `ADMIN_KEY`. Tabs in one browser profile share the same captain identity; use separate profiles or isolated browser contexts to simulate eight captains. Spectator mode is a per-tab preference.

On this computer, Node 24 is also bundled with Codex. If your shell still uses Node 20, you can run the installed app with:

```bash
ADMIN_KEY=change-me-dev-admin-key /Users/moon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1
```

To run locally against the real database instead, `vercel env pull .env.local` after the steps below, then add `ADMIN_KEY` if it isn't there.

## Deploy (Vercel + Supabase)

1. **Push this folder to a GitHub repo.**
2. **Import the repo in Vercel** (New Project → Import). Framework: Next.js, no build settings to change.
3. **Add Supabase** from the Vercel Marketplace (Project → Storage / Integrations → Supabase → Create). This creates the database and adds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or the newer publishable/secret key names, which also work) to the Vercel project.
4. **Create the tables.** In the Supabase dashboard → SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`. Schema enables Realtime on `draft`, `captains` and `players` for you (Database → Publications → `supabase_realtime` should list all three).
5. **Set `ADMIN_KEY`** in Vercel → Project → Settings → Environment Variables to a long random string (see `.env.example`). Don't prefix it with `NEXT_PUBLIC_`.
6. **Redeploy** (or push to `main`). Open the site, then `/admin` with your key.

Re-running `schema.sql` wipes everything; re-run `seed.sql` after it. To add late sign-ups, add rows to `supabase/seed.sql` and `src/lib/server/seed-data.ts` in the same format (the test suite checks they match), or insert them in the SQL editor before the draft starts.

## Tests

```bash
npm test                 # unit tests: draft rules, local store, tokens, admin key, seed data
npm run typecheck
npm run build
npm run test:smoke        # separate terminal; disposable local-practice server only
```

`npm test` also runs the actual schema and SQL acceptance script in an isolated embedded PostgreSQL database (PGlite), verifies lock-before-token ordering and unrelated RPC permissions, and tests captain storage events with the real API handlers in a DOM environment. The smoke script exercises an eight-way claim race and full 32-pick draft over HTTP, then restores a fresh lobby; it refuses to mutate a Supabase-backed board.

The Postgres functions also have a standalone self-checking test. Run it only against a **throwaway** database (it resets the draft):

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/schema.sql -f supabase/seed.sql -f supabase/tests/draft_test.sql
```

It plays a full 32-pick draft and checks snake order, every rejection message, undo, release, resets and that the public role can't read tokens or call functions. (On plain Postgres, first create roles `anon`, `authenticated`, `service_role` and `create publication supabase_realtime;`.)

## API

All endpoints return JSON; errors are `{ "error": "<message to show the user>" }` with a 4xx/5xx status.

| Endpoint | Body | Notes |
| --- | --- | --- |
| `GET /api/state` | | `{ draft, captains, players, mode }`, one consistent snapshot |
| `POST /api/claim` | `{ captainId }` | `{ token, captainId }`; "Already taken" if claimed |
| `POST /api/me` | `{ token }` | `{ captainId }` or `{ captainId: null }` |
| `POST /api/release` | `{ token }` | lobby only |
| `POST /api/ready` | `{ token, ready }` | starts the draft at 8/8 ready |
| `POST /api/pick` | `{ token, playerId, expectedPickIndex? }` | captain on the clock only |
| `POST /api/admin` | `{ action, ... }` + header `x-admin-key` | actions: `verify`, `release` (`captainId`), `start`, `pick` (`playerId`, `expectedPickIndex?`), `undo`, `settings` (`picksPerTeam`), `reset`, `full-reset` |

## Pre-draft checklist

- [ ] Open the site in 2 browsers: claiming a name disappears from the other within about a second.
- [ ] `/admin` rejects a wrong key and accepts yours.
- [ ] Do a full test draft with admin "Pick for captain on the clock", then **Full reset** before the real one.
