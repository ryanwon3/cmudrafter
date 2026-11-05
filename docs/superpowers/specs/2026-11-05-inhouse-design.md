# CMU × Pitt In-House draft

Build the supplied twelve-page draft spec as a live Next.js application for eight captains and spectators. Each captain selects four of the 35 supplied players in the fixed snake order. Lobby, draft and results are one synchronized route; admin controls are at `/admin`.

The supplied stack is the appropriate approach: Next.js App Router, TypeScript, Tailwind and Supabase, deployable to Vercel. A static browser-only app cannot synchronize independent visitors or enforce turns; a custom websocket backend adds unnecessary operations. A local development adapter will allow testing without production credentials and must refuse production use.

Use a warm off-white tournament board with black typography, red CMU and blue Pitt accents, a compact live status header, captain grid, searchable ranked player table and team roster cards. Mobile cards stack below the table. Accessible dialogs confirm claims/picks and destructive resets, with pending and failure states.

Default to four picks per captain, no timer and no claim code. Preserve exact captain/player data from the PDF. Claim tokens use localStorage; admin key uses sessionStorage. Public database readers cannot see token hashes or invoke write functions. Each mutation locks the singleton draft row; checks and mutations run in the same transaction. Stale clients reload on rejection. Consistent snapshots, Realtime notifications, five-second polling and focus refresh keep browsers synchronized. Never ship production secrets to the browser.

Claude owns server/database work; Codex owns UI and integration verification. Interfaces are recorded in COLLABORATION.md and src/lib/types.ts. Provisioning hosted accounts is contingent on available credentials; finish and validate the local app regardless.
