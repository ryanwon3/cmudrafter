# Attendance and organizer implementation

Goal: make attendance, seat correction and organizer phase approval usable on the deployed event site.

Architecture: extend DraftStore and the existing locked Postgres RPCs. Keep private attendance tokens separate from public state. Extend the current UI without changing the framework or roster.

Spec: docs/superpowers/specs/2026-11-05-attendance-admin-design.md

Review focus: attendance spoofing/withdrawal, absent picks through admin routes, start with too few players, all-ready auto-start regression, and reset token revocation.

- [x] Add failing local/Postgres tests for attendance ownership, frozen attendance after start, absent-pick rejection, manual start, review/publish, announcements and reset behavior.
- [x] Add present, announcement, review phase and private attendance token storage through a non-destructive migration. Implement matching local store and Supabase adapter methods.
- [x] Add /api/attendance actions check-in, me, leave. Extend protected /api/admin with attendance, announcement and publish actions.
- [x] Add lobby check-in component, explicit Unselect seat, eligible player filtering, clear Admin login and password form, attendance management, start checklist, announcements and publish controls.
- [x] Extend DOM and HTTP smoke coverage; run all tests, typecheck and production build. Independently review changes.
- [ ] Push to GitHub and verify the resulting Vercel deployment and live read-only checks. Migration applied and production password updated; existing captain claim preserved.
