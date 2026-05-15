---
phase: 111
plan: 4
subsystem: fixture-heatmap
tags: [fpl, heatmap, ui, react, tdd, fixtures, gap-closure, dgw]
dependency_graph:
  requires: [111-02, 111-03]
  provides: [partially-played-dgw-cell, cr02-sort-hardening]
  affects: [FixtureHeatMap.tsx, club-form.ts]
tech_stack:
  patterns: [TDD RED-GREEN, tooltip composition, defensive sort hardening]
key_files:
  modified:
    - src/components/club-form/FixtureHeatMap.tsx
    - src/components/club-form/FixtureHeatMap.test.tsx
    - src/lib/club-form.ts
    - src/lib/club-form.test.ts
decisions:
  - "Mixed-state (partially-played DGW) visual: tooltip-only treatment — upcoming fixture stays dominant at full opacity; played leg(s) surfaced via title attribute suffix ' / OPP (H/A) — Played'"
  - "CR-02 hardening scoped to .filter().sort().slice(-1) — sort applied to filtered copy only, no mutation of bootstrap.events"
metrics:
  duration: "3m 35s"
  completed: "2026-05-15T12:21:53Z"
  tasks: 3
  files: 4
---

# Phase 111 Plan 04: Partially-played DGW Cell + CR-02 Sort Hardening Summary

Closed the single BLOCKER gap identified in 111-VERIFICATION.md: the `HeatMapRow` cell render map had no branch for the partially-played DGW case (`fixtures.length >= 1 && playedFixtures.length >= 1`). Also hardened the CR-02 fallback-GW sort issue in `club-form.ts`.

## One-liner

Tooltip-suffix mixed-state DGW branch in HeatMapRow + `.sort((a,b) => a.id-b.id)` before fallback `.slice(-1)` in club-form.ts, backed by 3 new TDD-locked tests.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | RED — add failing tests for partially-played DGW mixed-state tooltip | 5bdd3dd | FixtureHeatMap.test.tsx |
| 2 | GREEN — add partially-played DGW render branch to HeatMapRow | 4a3d593 | FixtureHeatMap.tsx |
| 3 | CR-02 hardening — sort events by id ascending before fallback slice | 314dd86 | club-form.ts, club-form.test.ts |

## Files Modified

### src/components/club-form/FixtureHeatMap.tsx

**Lines changed:** 1 line removed, 4 lines added (in the single-upcoming fallthrough branch at the bottom of the `grid.allEventIds.map(gw => ...)` block).

Before:
```typescript
const tooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${(diff ?? 0).toFixed(2)}`
```

After:
```typescript
const baseTooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${(diff ?? 0).toFixed(2)}`
const playedSuffix = playedFixtures
  .map(pf => `${pf.opponent_team} (${pf.is_home ? 'H' : 'A'}) — Played`)
  .join(' / ')
const tooltip = playedSuffix.length > 0 ? `${baseTooltip} / ${playedSuffix}` : baseTooltip
```

This handles `fixtures.length === 1 && playedFixtures.length >= 1` because: the fall-through only reaches this branch when neither `fixtures.length === 0` nor `fixtures.length >= 2` matched, and `playedFixtures` is already in scope from line 88.

All four existing render branches remain untouched:
- BGW: `fixtures.length === 0 && playedFixtures.length === 0`
- DGW all-played: `fixtures.length === 0 && playedFixtures.length >= 2`
- Single played: `fixtures.length === 0 && playedFixtures.length === 1`
- DGW upcoming: `fixtures.length >= 2`

### src/components/club-form/FixtureHeatMap.test.tsx

**Added:** Banner comment + 2 new `it(...)` blocks after the existing FIX-01 tests at line 495.

New test cases:
1. `FIX-01 (gap): partially-played DGW (1 upcoming + 1 played) tooltip contains both opponents and '— Played' marker` — asserts `'PSG (H) — 0.28 / MCI (H) — Played'`
2. `FIX-01 (gap): partially-played DGW (1 upcoming + 2 played) tooltip lists all three opponents in order` — asserts `'LIV (A) — 0.71 / MCI (H) — Played / CHE (A) — Played'`

Total: 30 tests passing (28 pre-existing + 2 new).

### src/lib/club-form.ts

**Line changed:** 1 line (line 140).

Before:
```typescript
bootstrap.events?.filter(e => e.finished).slice(-1)[0]?.id ??
```

After:
```typescript
bootstrap.events?.filter(e => e.finished).sort((a, b) => a.id - b.id).slice(-1)[0]?.id ??
```

`.filter()` returns a fresh array — the in-place `.sort()` does NOT mutate `bootstrap.events`.

### src/lib/club-form.test.ts

**Added:** 1 new `it(...)` block after the existing `'falls back to last finished event...'` test.

New test case:
3. `CR-02: fallback picks max finished event id regardless of array order` — passes `[rawEvent(36, false, true), rawEvent(35, false, true)]` in descending order; asserts `current_gw_played[0].event_id === 36`.

Total: 7 tests passing (6 existing + 1 new).

## Gap Closure Confirmation

**BLOCKER gap from 111-VERIFICATION.md:** CLOSED.

The gap described at lines 7–22 of 111-VERIFICATION.md:
> "The partially-played DGW case (fixtures>=1 AND playedFixtures>=1) has no render branch — the code falls through to the final fixtures[0] single-upcoming branch at line 166, silently discarding the played-fixture signal entirely."

Status after this plan: The single-upcoming branch now appends played-leg tooltips via `playedSuffix`. The played-fixture signal is never discarded. Both scenarios (1 played + 1 upcoming, 2 played + 1 upcoming) are now locked by regression tests.

**Re-verification note:** Re-running `/gsd-verify-work 111` should now produce a clean PASS for FIX-01 with score 3/3. The gap truth "User can view the fixture heat map mid-week ... [partially-played DGW]" is backed by:
- Two new tests in `FixtureHeatMap.test.tsx` (lines 499–536)
- Direct inspection of the new `playedSuffix` logic in `FixtureHeatMap.tsx`

## CR-02 Hardening Confirmation

**WARNING from 111-VERIFICATION.md line 137:** HARDENED.

> "`bootstrap.events?.filter(e => e.finished).slice(-1)[0]?.id` — no sort before slice"

The `.sort((a, b) => a.id - b.id)` is now present. The fallback picks the actual max-id finished event regardless of FPL API response ordering. A regression test (`CR-02:` named) locks this contract — it fails without the sort.

## TDD Gate Compliance

Gate sequence in git log:
1. `test(111-04):` commit 5bdd3dd — RED gate (2 new failing tests)
2. `feat(111-04):` commit 4a3d593 — GREEN gate (all 30 pass)
3. `fix(111-04):` commit 314dd86 — CR-02 hardening (serves as REFACTOR/hardening step)

## Deviations from Plan

None. Plan executed exactly as written.

- Task 1 RED: 2 tests failed as expected for the right reason (upcoming-single tooltip with no `— Played` suffix).
- Task 2 GREEN: 3-line change to the single-upcoming fall-through branch made all 30 tests green.
- Task 3 CR-02: 1-line sort addition + 1 regression test. All 7 club-form tests pass.

## Known Stubs

None. All data flows are wired. No placeholder values or TODO markers were introduced.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. Threat register items T-111-06 (visual signal misleading) and T-111-07 (bootstrap.events order) are both mitigated by the new code and tests.

## Self-Check

Files created/modified:
- `src/components/club-form/FixtureHeatMap.tsx` — modified
- `src/components/club-form/FixtureHeatMap.test.tsx` — modified
- `src/lib/club-form.ts` — modified
- `src/lib/club-form.test.ts` — modified

Commits:
- `5bdd3dd` — test(111-04): add failing tests for partially-played DGW mixed-state cell
- `4a3d593` — feat(111-04): surface played leg in partially-played DGW cell tooltip
- `314dd86` — fix(111-04): sort events by id before fallback slice to harden CR-02
