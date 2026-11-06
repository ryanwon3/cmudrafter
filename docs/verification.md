# Verification record — November 5, 2026

## Attendance and organizer update

- Node 24: 39 tests passed, including the real PostgreSQL attendance lifecycle, non-destructive migration preserving an existing claim, API validation, private tokens and a DOM regression for delayed cross-tab attendance responses. Production build and TypeScript checks passed.
- Local HTTP acceptance passed: attendance ownership, start blocked below 32 present players, fixed four picks per captain, no auto-start on Ready, absent picks rejected, 32 snake picks, organizer result publication, undo and resets.
- Independent review found and reproduced one cross-tab token race; the fix and regression both pass, with no remaining actionable findings.
- The hosted attendance migration preserved the existing claimed captain seat and token. Hosted acceptance uses read-only checks and rejected operations; the current event is not reset for testing.
- The organizer password is configured only as a production Vercel Secret and in ignored local configuration. No password appears in source or public bundles.
- The live update at `https://cmudrafter.vercel.app` returned HTTP 200 for the home/admin pages, accepted the requested organizer password, rejected an incorrect password and unauthorized attendance corrections, enforced the 32-present-player gate, and denied browser-key reads of both token tables. The lobby retained one claim and zero picks/check-ins. Vercel request logs reported zero HTTP 5xx responses during these checks.
- Native Chrome navigation/capture is unreliable in this session, so the new UI has DOM coverage but final visual inspection remains limited.

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

Hosted smoke tests require explicit operator approval, an HTTPS URL, an unused lobby and `--hosted-reset`. Without that flag the script refuses a Supabase-backed board. The organizer explicitly approved the hosted test and reset.

- The production HTTP test passed at `https://cmudrafter.vercel.app`: eight-way claim race, authorization, 32 picks, replay protection, completion, undo, token revocation, reclaim and reset.
- A separate subscriber using the browser publishable key received public Realtime events for `captains`, `draft` and `players` during the test.
- The final state returned to a fresh lobby: eight captains, 35 available players, zero claims, zero ready captains and zero picks.
- The production deployment is linked to GitHub `main`, has status `READY`, and serves the `cmudrafter.vercel.app` alias. Request logs showed no HTTP 5xx responses during the hosted test.
- Native Chrome inspection confirmed live draft updates and the desktop layout. A 400px responsive viewport showed the mobile lobby, and spectator mode removed all claim buttons. A missing favicon identified in the console was corrected.

## Verification limits

The browser bridge could not reliably automate navigation, so native Chrome controls were used for desktop/mobile inspection. Nine isolated browser windows and actual clipboard/download button clicks are not covered by the API/SQL tests. DOM tests cover captain storage events and export helpers cover Discord text and CSV escaping.

Node 24 is required. The computer's default Node 20.17 fails current DOM-test dependencies and the Tailwind compiler; `.nvmrc` and package engines record the supported runtime.
