# Joint feature verification — November 6, 2026

Codex and Claude verified the current eight-captain, 44-player draft application. The story checked was: player/captain lobby actions → authenticated API routes → serialized draft rules → synchronized public/admin screens → reviewed results → editable single-elimination tournament.

Claude independently reviewed the source, database functions, routes, component bindings, exports and tests. Claude then implemented the reset-verifier safeguards and their tests. Codex reproduced findings, implemented the attendance/UI fixes, ran the checks below, and exercised the browser flows. A separate read-only reviewer found no remaining actionable defects in the changes.

## Results

| Check | Evidence |
|---|---|
| Automated suite | **94 passed, 0 failed** on Node 24: unit, DOM, API, real embedded PostgreSQL, migration, identity-race and reset-verifier checks |
| TypeScript | `npm run typecheck` passed |
| Production build | `npm run build` passed with Next.js 16.4.5 and webpack |
| Complete HTTP event | Eight-way claim race, eight captain identities, 32 snake picks, incorrect-turn/replay rejection, publication, seven-match tournament, corrections, reseeding, stale revisions, undo, release/reclaim and both resets passed |
| Actual reset-verifier CLI | Passed against the disposable local Next.js API after publishing a zero-player event; restored the local lobby |
| Browser | Lobby, draft, review, results, bracket and administration exercised in the in-app WebKit browser; no browser console errors in the home, admin or bracket checks |
| Hosted database drift | All **25** application function definitions matched the tested local schema exactly after whitespace normalization |
| Hosted privileges | All 25 functions use the fixed public search path, permit service_role and deny anon/authenticated execution. All five application tables have RLS enabled |
| Hosted public access | Public reads returned 44 players, eight captains and one draft. Both private token tables and a public-key mutation RPC returned HTTP 401 |
| Hosted admin verification | Configured password accepted (200); incorrect password rejected (401). No credentials printed or added to source |
| Hosted Realtime | Public subscription reached `SUBSCRIBED` for draft, captains and players; the publication contains exactly these three tables |
| Event preservation | Production public state was byte-for-byte equivalent before and after verification: lobby, zero picks/check-ins/claims, 44 players, eight captains |
| Credential exposure | Production password absent from Git source and public build files |

## Phase coverage

| Phase | Executed checks |
|---|---|
| Lobby | Claim/cancel/release/reclaim; Ready/Unready without automatic start; own-player attendance, withdrawal and reload recovery; admin attendance correction; search by name/Riot ID/rank and alphabetical sort; per-tab spectator preference; cross-tab updates; announcements; session recovery |
| Draft | Started with two present players and one ready captain; only those two players appeared in the eligible pool. Confirm/cancel captain pick; turn advances; out-of-turn and spectator draft controls absent; admin pick for an unclaimed seat; stale admin confirmation rejected; undo/re-pick; admin seat release and public reclaim. Full 32-pick sequence and races also passed over HTTP/SQL |
| Review | Early finish kept both picks and empty team slots; public page awaited admin approval; result export controls absent; direct bracket page showed its unpublished-results gate |
| Results | Admin publication exposed all eight teams, bracket link and exports. Actual clipboard content included all eight captain teams. Actual CSV download contained the header, eight captains and two drafted players with the expected BOM/CRLF format. Absent undrafted players are excluded by both export helpers |
| Bracket | All four quarterfinals, two semifinals and the final advanced through the admin UI; public champion updated. Public bracket has no advance controls. Correcting a quarterfinal cleared only dependent later results; another semifinal remained intact. Clearing a result, duplicate-team rejection, matchup cancellation, valid reseeding and stale editor rejection all passed. Reseeding cleared recorded results |
| Admin/reset | Incorrect login, successful login, session restoration, logout and reload; announcements and attendance locks; start/finish/publish controls by phase. Undo from published results returned to drafting and cleared the bracket. Regular reset retained captain/player identities and attendance while clearing picks/readiness/announcement/bracket. Full reset reopened all eight seats and removed player check-in identities |
| Zero-attendance edge | Local admin started, finished and published with zero present players and no claimed/ready captains. Results still showed eight teams; results → bracket → results navigation worked |
| Transitions | Actual phase-change dialog measured 1280×720 at x=0/y=0 in a 1280×720 viewport; video uses `object-fit: cover`, duration **1.8 seconds**, zero skip buttons, and releases the page on completion. Results-to-bracket navigation played the transition. Automated tests cover first entry, unchanged-screen refreshes, reduced motion, playback failure and stall recovery |

## Findings resolved

1. **Attendance recovery could starve during roster updates.** A fresh `players` snapshot canceled an otherwise valid pending identity response. The regression failed before correction. Responses now remain eligible while their token is current and the component is mounted; token replacement/revocation and unmount still reject obsolete responses. Tests also prove that an older successful response cannot restore a revoked identity.
2. **Bracket spectators missed announcements.** Reproduced in the browser with an announcement visible on results and absent on the bracket. The public bracket now renders the same announcement. Verified in the browser after the change.
3. **Admin confirmations omitted effects on published results, announcements and the bracket.** Undo, regular reset and full reset now disclose those effects. The revised dialogs were checked against the actual resulting states.
4. **The hosted reset-verification helper could clear Ready/announcement state in an occupied lobby.** Claude added pre-mutation guards for lobby phase, Ready captains, announcements, bracket and store mode, plus postconditions for bracket clearing and increasing revision. Eighteen tests passed. Removing the new guards in a temporary copy caused seven relevant tests to fail, without changing the real script or any hosted state.

Two conditional review concerns did not reproduce: the 1.8-second video finishes well before its five-second fail-safe, and the actual WebKit CSV download completed and contained the correct data. No speculative changes were made for those concerns.

## Verification limits

- State-changing event flows ran against disposable local state and isolated PostgreSQL databases. Production was not advanced or reset. The hosted PostgREST safe-update extension was not exercised by a fresh destructive reset; live function definitions match the tested schema, and their UPDATE/DELETE statements retain explicit predicates.
- Hosted Realtime connection and publication were verified without generating a production database event. Actual cross-view updates were exercised locally through the application's polling/refresh path. This run does not claim a new hosted event-delivery test.
- Browser checks used the in-app WebKit browser at its normal desktop viewport. This is not an exhaustive Safari/Chrome/Firefox/mobile-device certification or a load/availability guarantee.
- Eight independent captain identities were exercised over HTTP; eight separate concurrent browser profiles were not opened.
- Dated rank metadata remains the separate OP.GG snapshot described in the rank-audit report; this verification does not add automatic rank synchronization.

The local test board was restored to an empty lobby and its server stopped. The verification fixes require no database migration.
