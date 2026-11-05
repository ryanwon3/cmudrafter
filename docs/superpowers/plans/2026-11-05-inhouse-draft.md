# In-House Draft Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; Claude and Codex coordinate separate files in COLLABORATION.md.

**Goal:** A functional synchronized snake draft matching the supplied PDF.

**Architecture:** Next.js routes perform authenticated mutations against transactional Supabase functions. The client subscribes to Realtime and reloads consistent snapshots. A development-only adapter supports local acceptance testing.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind, Supabase Postgres/Realtime.

**Spec:** docs/superpowers/specs/2026-11-05-inhouse-design.md; source PDF in /Users/moon/Downloads.

## Global Constraints
- Eight fixed captains, 35 players, four rounds, 32 picks, three undrafted players.
- Server enforces snake order, authorization, unique picks, phase rules and atomic index advancement.
- Public state never includes claim tokens or admin secrets.
- Vercel is the production target; do not use process-local state in production.

## Review Focus
- Concurrent claims/picks must reject conflicting requests without advancing twice.
- Consecutive snake-end turns must not permit stale requests to pick twice.
- Admin release must revoke tokens and permit reclaim during a draft.
- Undo from complete must restore the last turn; resets preserve/clear claims as requested.
- Offline, malformed requests and localStorage failures must show understandable errors.

### Task 1: Shared contracts and server (Claude)
- [x] Scaffold config and types (Codex); API contract in COLLABORATION.md.
- [x] Write failing tests for claims, all-ready transition, order, unauthorized picks, conflicts, completion, undo, reset and token revocation.
- [x] Implement SQL schema, seed, transaction functions, server adapters and API routes.
- [x] Verify backend suite, exact seed counts, public privileges and production refusal of local state.

### Task 2: Interface and client behavior (Codex)
- [x] Add failing helper tests asserting exact snake order, search/rank sort, complete results/CSV escaping.
- [x] Implement helpers in src/lib/draft.ts and accessible UI components.
- [x] Build responsive lobby, draft board, results and admin page; token restore, polling, Realtime and focus refresh.
- [x] Review pending states, action dialogs, spectator controls and reset confirmations in source; browser click checks remain unavailable.

### Task 3: Integration and handoff (Codex + Claude)
- [x] Run npm test, npm run typecheck, npm run build.
- [x] Run complete 32-pick flow with eight captain API clients and public-state reads, conflict and undo cases.
- [ ] Check desktop/mobile UI and nine isolated browser contexts; blocked by the browser bridge.
- [x] Document environment variables, SQL setup and Vercel deployment, and report unverified external steps in docs/verification.md.
