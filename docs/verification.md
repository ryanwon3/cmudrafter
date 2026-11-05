# Verification record — November 5, 2026

Claude authored the initial database, server adapters, API routes and backend tests. Codex authored the UI, shared contracts and integration tests, and completed integration and hosted setup. Independent review identified and covered authorization and synchronization regressions.

## Source and database checks

- Node 24: `npm test` — 29 passed, 0 failed.
- Node 24: `npm run build` — Next.js 16.4.5 webpack production build and TypeScript checks passed.
- Local HTTP smoke covers an eight-way claim race, all eight Ready actions, the full 32-pick snake order, duplicate rejection, completion, three undrafted players, undo, release, token revocation, reclaim and resets.
- The real schema and standalone SQL acceptance script run in isolated PGlite PostgreSQL databases. Regressions cover lock-before-token ordering, fixed function search paths, preservation of unrelated function privileges, cross-route error identity, slow polling, cross-tab captain recovery and hosted/local authorization-status parity.
- Supabase project `jsnhoolidghbdtrciapo` is initialized with eight captains and 35 players. Tracked migrations are under `supabase/migrations/`. Realtime publication includes `draft`, `captains` and `players`.
- Hosted REST checks confirm that the publishable key can read captains and cannot read captain tokens. The token table intentionally has RLS with no public policy; its informational advisor notice reflects the intended deny-by-default access model.
- Claude independently reported PostgreSQL 16 concurrency checks: a queued revoked-token pick fails after the lock fix; ten simultaneous claims/picks each produce exactly one success.

## Production target

- GitHub: `ryanwon3/cmudrafter`, production branch `main`.
- Vercel: `ryanwon3/cmudrafter`, project `prj_QA3SOlz0Q7gWresAlIUAbjxGKLWY`, Node 24, region `iad1`.
- Production variables are configured in Vercel. Server credentials remain outside Git. The generated admin key is also retained in the ignored local `.env.production.local` for the organizer.
- `.vercelignore` explicitly excludes local environment files, credentials, dependencies and build output from source uploads.

## Hosted acceptance procedure

Hosted smoke tests require explicit operator approval, an HTTPS URL, an unused lobby and `--hosted-reset`. Without that flag the script refuses a Supabase-backed board. After approval, run with the production URL and ADMIN_KEY supplied through the environment; the script restores a fresh lobby afterward. Release verification should also observe public Realtime events on all three tables and check both `/` and `/admin`.

## Verification limits

The browser bridge could not reliably navigate or capture page screenshots. Desktop/mobile visual checks, nine isolated browser windows, and actual clipboard/download button clicks are not covered by the API/SQL tests. DOM tests cover captain storage events and export helpers cover Discord text and CSV escaping.

Node 24 is required. The computer's default Node 20.17 fails current DOM-test dependencies and the Tailwind compiler; `.nvmrc` and package engines record the supported runtime.
