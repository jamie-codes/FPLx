---
phase: 111
plan: 01
subsystem: club-form-data-layer
tags: [fpl, club-form, fixtures, typescript, tdd, fix]
dependency_graph:
  requires: []
  provides: [ClubForm.current_gw_played, computeClubForm.events-param, route.events-passthrough]
  affects: [src/lib/types.ts, src/lib/club-form.ts, src/app/api/club-form/route.ts]
tech_stack:
  added: []
  patterns: [TDD RED→GREEN, Map-per-team builder, optional-chaining fallback]
key_files:
  created:
    - src/lib/club-form.test.ts
  modified:
    - src/lib/types.ts
    - src/lib/club-form.ts
    - src/app/api/club-form/route.ts
decisions:
  - "current_gw_played is a required (non-optional) field on ClubForm, consistent with all other fields"
  - "RawBootstrap.events is optional (events?: RawEvent[]) for backward compatibility"
  - "currentGw derivation uses is_current first, fallback to last-finished event — matches pipeline/merge.py pattern"
  - "4 existing test helpers makeClubForm() updated to include current_gw_played: [] (Rule 1 auto-fix for TS compilation)"
metrics:
  duration: "5 minutes"
  completed: "2026-05-15T09:51:11Z"
  tasks: 3
  files: 7
---

# Phase 111 Plan 01: FIX-01 Data Layer — ClubForm.current_gw_played Summary

**One-liner:** Add `current_gw_played: ClubFormFixture[]` to `ClubForm`, derive active GW from `bootstrap.events` in `computeClubForm`, and pass `events` through the club-form route so mid-week played fixtures are distinguishable from true BGWs.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | RED — failing tests for current_gw_played | 92f5a32 | src/lib/club-form.test.ts (created) |
| 2 | GREEN — extend types + computeClubForm | 9cb4902 | src/lib/types.ts, src/lib/club-form.ts, 4 test helpers |
| 3 | Wire route — pass bootstrap.events | 9709172 | src/app/api/club-form/route.ts |

## Test Cases Added (6)

1. **populates current_gw_played with finished fixtures from the active GW only** — verifies A vs C GW35 appears but A vs B GW34 does not; team B (played only GW34) gets `[]`
2. **leaves current_gw_played empty when no fixtures are finished in current GW** — all upcoming, nothing finished → every team gets `[]`
3. **does NOT include historical finished fixtures in current_gw_played** — only GW34 finished, current is GW35 → every team gets `[]`
4. **populates current_gw_played for both home and away teams of a finished fixture** — A(home) vs B(away) → A gets is_home=true/opp=TMB, B gets is_home=false/opp=TMA; all difficulty fields numeric
5. **current_gw_played is [] when events array is not provided (backward compat)** — no events key → every team gets `[]`
6. **falls back to last finished event when no event has is_current** — events=[{id:35,is_current:false,finished:true},{id:36,is_current:false,finished:false}] → GW35 fixture appears in current_gw_played

## Implementation Notes

- `RawEvent { id: number; is_current: boolean; finished: boolean }` added above `RawBootstrap` in `club-form.ts`
- `currentGw` derivation: `bootstrap.events?.find(e => e.is_current)?.id ?? bootstrap.events?.filter(e => e.finished).slice(-1)[0]?.id ?? null`
- `teamPlayedCurrentGw` built by iterating `finished.filter(f => f.event === currentGw)` and pushing home/away entries with identical field shape as `upcoming_fixtures` builder
- Route change: `computeClubForm({ teams: bootstrap.teams }, fixtures)` → `computeClubForm({ teams: bootstrap.teams, events: bootstrap.events }, fixtures)` — single token change

## Plan 02 Readiness

Plan 02 (FixtureHeatMap rendering) can now consume `current_gw_played` directly from `useClubForm()` data. No additional data-layer work is needed. The field is:
- Non-empty in production when teams have played current-GW fixtures (GW35 all 10 fixtures finished per RESEARCH)
- Guaranteed `[]` when no current GW is detected (backward compat)
- Typed as `ClubFormFixture[]` — same type as `upcoming_fixtures` — so the rendering layer can reuse `TIER_CLASSES` and `currentTier()` without any type changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 4 test helper makeClubForm() functions in existing test files**

- **Found during:** Task 2 (`npx tsc --noEmit`)
- **Issue:** Adding `current_gw_played: ClubFormFixture[]` as a required field caused TS2741/TS2322 errors in 4 test files that built `ClubForm` objects without the new field
- **Files modified:** `src/components/planner/ChipStrategyPanel.test.tsx`, `src/lib/chip-strategy-engine.test.ts`, `tests/components/club-form/FixtureEaseRankingPanel.test.tsx`, `src/lib/__tests__/lifecycle-label.test.ts`
- **Fix:** Added `current_gw_played: []` (or `current_gw_played: overrides.current_gw_played ?? []` for partial-override pattern) to each `makeClubForm()` helper
- **Commit:** 9cb4902 (bundled with the GREEN task commit)

Note: `src/components/club-form/FixtureHeatMap.test.tsx` was NOT modified — the existing test helper uses `as ClubForm` cast which silences the missing field. Plan 02 will update that helper (as specified in the plan).

## Pre-existing Failures (Not Caused by This Plan)

25 test failures existed before this plan and remain unchanged:
- `tests/lib/captain-picks.test.ts` (5 failures)
- `src/components/nav/MobileNav.test.tsx` (9 failures)
- `src/lib/hooks/useRivals.test.ts` (3 failures)
- `tests/lib/club-form.test.ts` (1 failure — `difficulty_score` assertion on test data with equal team goals, edge case in defScore normalisation)
- Others (7 failures)

Pre-existing TypeScript error: `src/app/api/decision-history/route.test.ts` — Buffer/SharedArrayBuffer type compatibility (Node 25 / TypeScript), unrelated to this plan.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/club-form.test.ts | FOUND |
| src/lib/club-form.ts | FOUND |
| src/lib/types.ts | FOUND |
| src/app/api/club-form/route.ts | FOUND |
| commit 92f5a32 (test RED) | FOUND |
| commit 9cb4902 (feat GREEN) | FOUND |
| commit 9709172 (fix route) | FOUND |
| 6 tests passing (src/lib/club-form.test.ts) | PASSED |
| 23 tests passing (FixtureHeatMap.test.tsx) | PASSED |
| TypeScript clean (1 pre-existing error only) | PASSED |
