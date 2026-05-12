---
phase: 100-decision-history-analytics
plan: "01"
subsystem: types
tags: [types, regret, season-summary, captain-hit-rate, tdd, vitest, foundation]

# Dependency graph
requires:
  - phase: 96-captain-decision-backtester
    provides: RegretEntry, DecisionHistory types; computeSeasonSummary in regret.ts
provides:
  - ChipRoiEntry interface (chipName union 'bboost'|'3xc'|'freehit', event, gwPoints, seasonAvgPoints, delta)
  - HitTrackingEntry interface (event, elementIn/Out, names, cumulative pts, netPts, brokeEven)
  - SeasonAnalytics interface (chipRoi: ChipRoiEntry[], hitTracking: HitTrackingEntry[])
  - SeasonSummary extended with captainHitRate (number|null) and captainHits (number)
  - computeSeasonSummary returns D-02 captain hit rate fields
affects: [100-02, 100-03, 100-04, BackTab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-02 captain hit rate: hits = userWon + tied (regret <= 0); rate = null when gwsWithData === 0"
    - "Partial-failure nullability pattern (elementInPts/elementOutPts/netPts/brokeEven all nullable)"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/lib/regret.ts
    - src/lib/regret.test.ts

key-decisions:
  - "captainHitRate is null (not 0) when gwsWithData === 0 — prevents misleading 0% display"
  - "Tied GWs (regret === 0) count as hits per D-02 — regret <= 0 is the boundary condition"
  - "captainHits = userWon + tied stored as separate field for raw count display (N/M GWs format)"
  - "HitTrackingEntry uses nullable pts fields to handle partial element-summary fetch failures"
  - "ChipRoiEntry excludes Wildcard per D-04 — WC tracking requires separate analysis"

patterns-established:
  - "TDD RED→GREEN: test file updated first with failing assertions, then implementation"
  - "Additive-only changes to types.ts: no existing interface fields removed or modified"

requirements-completed: [HIST-01, HIST-02, HIST-03]

# Metrics
duration: 8min
completed: 2026-05-12
---

# Phase 100 Plan 01: Decision History Analytics Foundation Summary

**SeasonSummary extended with D-02 captain hit rate (captainHitRate/captainHits); ChipRoiEntry, HitTrackingEntry, SeasonAnalytics types added to unblock HIST-02/03 downstream plans**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-12T15:22:00Z
- **Completed:** 2026-05-12T15:30:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added three new exported interfaces to `src/lib/types.ts` immediately after `DecisionHistory` (insertion point: line 704): `ChipRoiEntry`, `HitTrackingEntry`, `SeasonAnalytics`
- Extended `SeasonSummary` interface in `src/lib/regret.ts` with two new required fields: `captainHitRate: number | null` and `captainHits: number`
- Extended `computeSeasonSummary` to compute those fields per D-02: `captainHits = userWon + tied`, `captainHitRate = gwsWithData > 0 ? captainHits / gwsWithData : null`
- TDD RED→GREEN cycle: 5 failing tests (2 updated toEqual + 3 new) turned green; all 11 regret tests passing; TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ChipRoiEntry / HitTrackingEntry / SeasonAnalytics types** - `9446522` (feat)
2. **Task 2: RED — extend regret.test.ts for captain hit rate** - `2a45741` (test)
3. **Task 3: GREEN — extend SeasonSummary + computeSeasonSummary** - `36a6920` (feat)

_TDD tasks have separate test (RED) and feat (GREEN) commits_

## Files Created/Modified
- `src/lib/types.ts` — Three new exported interfaces appended after `DecisionHistory` (line 703): `ChipRoiEntry`, `HitTrackingEntry`, `SeasonAnalytics`
- `src/lib/regret.ts` — `SeasonSummary` interface extended with `captainHitRate` + `captainHits`; `computeSeasonSummary` computes them post-loop per D-02
- `src/lib/regret.test.ts` — Two existing `toEqual` assertions updated to include new fields; three new test cases for null-when-empty, D-02 formula, and tied-counts-as-hit

## Decisions Made
- `captainHitRate` is `null` (not `0`) when `gwsWithData === 0` — prevents displaying a misleading 0% hit rate when no data is available; downstream rendering must guard for null
- Tied GWs (`regret === 0`) count as hits per D-02 locked decision — `regret <= 0` is the hit boundary; this is intentional and locked
- Stored `captainHits` as a separate field alongside the rate so UI can render "N/M GWs" without recomputing the numerator
- `HitTrackingEntry` uses nullable `pts` and `brokeEven` fields to match the partial-failure pattern already established in `/api/decision-history` (one element-summary fetch failure should not nullify the whole entry)
- `ChipRoiEntry.chipName` restricted to `'bboost' | '3xc' | 'freehit'` per D-04 — Wildcard excluded

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The insertion point in `types.ts` (line 703) was confirmed before editing. `computeSeasonSummary` loop logic was unchanged — the two new fields are derived after the loop, adding zero risk to existing consumers.

Pre-existing test failures in `captain-picks.test.ts` and `MobileNav.test.tsx` (documented in STATE.md under TEST-57 and WR-03/04) were present before and after this plan and are out of scope.

## Next Phase Readiness
- Plans 02, 03, 04 can now import `ChipRoiEntry`, `HitTrackingEntry`, `SeasonAnalytics` from `src/lib/types.ts`
- Plans 02, 03, 04 can read `summary.captainHitRate` and `summary.captainHits` from `computeSeasonSummary()` output
- `BackTab.tsx` (Plan 04) currently only destructures the original five `SeasonSummary` fields — no breaking change; it will add `captainHitRate` rendering in Plan 04

---
*Phase: 100-decision-history-analytics*
*Completed: 2026-05-12*
