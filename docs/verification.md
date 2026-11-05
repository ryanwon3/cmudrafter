# Verification — November 5, 2026

Claude authored the database, server adapters, API routes and backend tests. Codex authored the UI, shared contracts and integration tests, and completed the integration fixes. Both reviewed the merged application; an independent code review also checked synchronization and authorization.

## Passed on the final source

- Node 24: `npm test` — 27 passed, 0 failed.
- Node 24: `npm run build` — Next.js 16.4.5 webpack production build and TypeScript checks passed. Main/admin pages and all seven API routes compiled.
- `npm run test:smoke` against the running local-practice server — eight simultaneous claims produce one success, eight captain identities restore, the eighth Ready starts drafting, all 32 picks match the fixed snake order, unauthorized/replayed requests fail, exactly three players remain, undo returns to drafting, release revokes the old token, reclaim succeeds, reset retains claims, full reset clears them. The script leaves a fresh lobby.
- Actual schema, seeds and standalone SQL acceptance script run in isolated PGlite PostgreSQL instances, including public-role restrictions, complete draft, undo and resets.
- Regression tests fail before and pass after fixing token lookup before the draft lock, overly broad function permission changes, cross-route error constructor identity, slow polling, and captain storage events. A delayed revoked-token response cannot erase a newer saved session.
- Claude independently reported PostgreSQL 16 race verification: queued revoked-token pick rejected after the fix; ten simultaneous claims/picks each produce exactly one success.

## Limits and remaining setup

- Browser automation could not navigate or inspect the local site due errors in the browser bridge. Desktop/mobile visual checks, actual clipboard/download clicks, and nine isolated browser contexts remain unverified.
- No hosted Supabase or Vercel deployment was created. Vercel's connection can list the compass team/projects but returns 403 for integration configuration access. Supabase tools became available, but project/organization list requests repeatedly return an unknown-tool error. The connection must work before hosted resources can be selected/configured.
- Live Supabase Realtime broadcasts remain unverified against a hosted database. Local practice uses one-second polling; production uses Realtime plus five-second polling and focus refresh.
- Node 24 is required. The system Node 20.17 cannot load the installed Tailwind compiler. `.nvmrc` and package engines record this requirement; README includes the existing bundled Node path for this computer.

Source is preserved in the workspace. No Git repository existed, and no remote repository, production resource, or public audience was created or changed.
