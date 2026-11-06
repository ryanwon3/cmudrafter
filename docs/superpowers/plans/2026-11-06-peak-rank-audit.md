# Peak Rank Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct every roster entry to its highest recorded solo/duo rank available on its OP.GG profile.

**Architecture:** Audit all 44 players and eight captains against live public OP.GG profiles, including current Top tier and historical peak/end records. Update seed metadata and apply an identity-matched, atomic database migration that changes only peak_rank and rank_score.

**Tech Stack:** Next.js, TypeScript, Supabase/PostgreSQL, PGlite.

**Spec:** User request dated November 6, 2026: check each player's peak solo/duo rank against OP.GG and fix mismatches, including Yazurak Diamond 3 → Diamond 2.

## Global Constraints

- Exclude Flex and ranked team queues.
- Preserve player/captain IDs, seats, attendance, claims, readiness, tokens, picks, phase, announcements, bracket and revision.
- Do not infer unrecorded historical peaks; describe the OP.GG coverage limitation in the audit.
- Keep fresh installs, local practice and hosted production metadata consistent.

## Review Focus

- Historical peaks can exceed current Top tier or season-end ranks: compare all available records.
- Comma-separated LP and apex division artifacts: interpret 1,041 as 1041 and omit division for Master.
- Rank-only migration during an active draft or bracket: preserve all other columns and token rows.
- Missing or duplicated roster identities: fail atomically rather than partially updating.
- Numeric ordering: include verified LP within each division without altering captain slots.

### Task 1: Audit and apply rank metadata

**Files:** `docs/peak-rank-audit-2026-11-06.md`, `docs/peak-rank-audit-2026-11-06.json`, `src/lib/server/seed-data.ts`, `supabase/seed.sql`, new `supabase/migrations/*_audit_opgg_peak_ranks.sql`, `tests/rank-audit-migration.test.ts`.

**Interfaces:** Consumes existing Riot IDs and public OP.GG profile data; produces an evidence table and rank-only SQL update.

- [x] Check all 52 public profiles and independently cross-check three batches.
- [x] Write and run a migration test that starts with an occupied draft, verifies Yazurak D2 31 LP, preserves all other state, and proves idempotence and atomic failure for a missing identity.
- [x] Update rank labels/scores in both seeds and create the identity-matched migration.
- [x] Run the targeted test and full test suite/build; review the final changes. (75/75 tests; production build passed; independent review found no actionable issues.)

### Task 2: Publish and verify

**Files:** Existing GitHub/Vercel deployment and hosted Supabase project `jsnhoolidghbdtrciapo`.

**Interfaces:** Consumes the verified migration and seeds; produces matching live state and a ready production deployment.

- [x] Apply the tested migration and compare all 52 hosted ranks, retaining the original event state. (Hosted migration `20261106222042`; all non-rank fields and token digests preserved.)
- [ ] Commit/push to the authorized repository; confirm production deploys the exact commit.
- [ ] Verify the public API and visible lobby show the corrected ranks; provide the audit report.
