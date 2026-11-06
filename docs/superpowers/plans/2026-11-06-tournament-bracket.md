# Tournament Bracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an editable eight-team single-elimination bracket after draft results.

**Architecture:** Shared TypeScript bracket derivation, matching LocalStore and Supabase mutation rules, and reusable public/admin bracket components. Persist bracket data and a monotonic revision on the draft row so existing state fetches and realtime work unchanged.

**Tech Stack:** Existing Next.js 16, React, TypeScript, Supabase/Postgres and PGlite tests.

**Spec:** `docs/superpowers/specs/2026-11-06-tournament-bracket-design.md`

## Global Constraints

- Preserve all current event data and captain IDs; never assume captain IDs equal slots.
- Only admin can edit, only after phase `complete`; everyone can view.
- Keep minimal functional UI and support mobile through a horizontally scrollable bracket.
- Use existing admin key, fixed SQL search paths, service-role-only RPC access and explicit mutation filters.

## Review Focus

- A stale admin action must not overwrite another result or a reset event.
- A correction must clear dependent results without clearing unrelated matches.
- A winner must belong to a match with both participants determined.
- Reseeding requires all eight teams exactly once and clears prior results.
- Undo/reset must invalidate the bracket without breaking existing reset safety rules.

## Tasks

1. [x] Add failing LocalStore tests for default seeds, progression, validation, corrections, stale writes, reseeding and draft invalidation. Implement shared `defaultBracket`, `effectiveBracket`, `bracketMatches`, types and LocalStore/API/SupabaseStore methods. Run targeted tests.
2. [x] Add failing PGlite tests and a CLI-generated non-destructive migration for the two columns, two RPCs, helper, reset/undo invalidation, grants and locking. Run SQL tests without hosted mutations.
3. [x] Build reusable bracket and admin matchup editor, public `/bracket`, results link and header link. Check callbacks and accessibility, then visually verify a local published draft. The hidden browser remained at 1280px despite viewport overrides, so phone-size visual inspection was unavailable; the bracket uses horizontal overflow for narrow screens.
4. [ ] Run all tests, build and local HTTP tournament flow including wrong-key rejection and the seven matches. Request independent review, fix findings, apply migration, push/deploy, and verify live pages and state without changing the event's phase or picks.

Verification before deployment: 67 tests passed, production build passed, local HTTP acceptance passed through all seven matches and corrections, and browser checks confirmed public champion updates, duplicate-team prevention, edited seeds and editor closure. Independent review findings were fixed and rechecked. Hosted migration preserves the lobby, existing profiles, check-ins and picks.
