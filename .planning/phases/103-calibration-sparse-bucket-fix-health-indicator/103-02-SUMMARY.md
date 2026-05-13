---
phase: 103-calibration-sparse-bucket-fix-health-indicator
plan: "02"
subsystem: ui
tags: [calibration, react, decision-summary, accuracy-tab, tailwind]

# Dependency graph
requires:
  - phase: 103-01
    provides: Python sparse-bucket threshold lift and pool-total guard in pipeline/accuracy.py
provides:
  - CalibrationHealthIndicator component (good/fair/poor tier, cold-start, absent-guard)
  - AccuracyTab CalibrationSection without TS-side sample_n filters
  - AccuracyTab CalibrationSection cold-start banner (gws_covered < 3)
  - DecisionSummaryTab renders one-line calibration health row between 4-card grid and ProseSummaryBlock
affects:
  - AccuracyTab
  - DecisionSummaryTab
  - CAL-01
  - CAL-02

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optional calibration data guard pattern at call site (accuracyData &&) letting component handle all sub-states
    - TDD RED/GREEN test-first for new React component with vitest + jsdom + @testing-library/react

key-files:
  created:
    - src/components/squad/CalibrationHealthIndicator.tsx
    - src/components/squad/CalibrationHealthIndicator.test.tsx
  modified:
    - src/components/accuracy/AccuracyTab.tsx
    - src/components/squad/DecisionSummaryTab.tsx

key-decisions:
  - "Python is the single sparse-bucket gate — no double-filtering in TypeScript (D-02)"
  - "Cold-start guard (gws_covered < 3) checked before chartData.length === 0 per D-06"
  - "CalibrationHealthIndicator reads calibration.by_position.all (aggregate, ~200 obs/decile) for most stable signal"
  - "Call-site guard is accuracyData && — component handles all sub-states internally (absent/empty/cold-start/tier)"
  - "No barrel index.ts — import by full path matching established pattern"

patterns-established:
  - "Optional query data guard at call site, sub-state handling inside component — clean separation of loading vs. data states"

requirements-completed: [CAL-01, CAL-02]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase 103 Plan 02: Calibration UI Fixes & Health Indicator Summary

**AccuracyTab CalibrationSection de-doubled (Python is single gate), cold-start banner added, and CalibrationHealthIndicator one-line row wired into DecisionSummaryTab with good/fair/poor tier derived from max haul-rate deviation across all-position deciles**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-13T15:03:00Z
- **Completed:** 2026-05-13T15:08:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Removed both TypeScript `sample_n >= 5` filters from `CalibrationSection` — Python is now the single sparse-bucket gate (CAL-01 TS half)
- Added cold-start banner "Calibration evidence will appear after 3+ completed GWs." checked before the chartData.length === 0 branch (D-06)
- Updated insufficient-data banner copy to "Insufficient data for {position} at this sample size." (D-04)
- Created `CalibrationHealthIndicator` component with 6 documented render states: absent, empty, cold-start, good, fair, poor (CAL-02)
- Slotted `CalibrationHealthIndicator` into `DecisionSummaryTab` between the 4-card grid and `ProseSummaryBlock` using shared TanStack Query cache via `useAccuracy()` — zero additional network calls
- 9 TDD tests (RED → GREEN), 27 AccuracyTab regression tests, TypeScript clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Update CalibrationSection — remove TS sample_n filters, add cold-start guard, update banner** - `57686b0` (feat)
2. **Task 2 RED: Failing tests for CalibrationHealthIndicator** - `dac69bf` (test)
3. **Task 2 GREEN: Implement CalibrationHealthIndicator component** - `c3eb099` (feat)
4. **Task 3: Slot CalibrationHealthIndicator into DecisionSummaryTab** - `9a9798b` (feat)

_Note: Task 2 has RED (test) + GREEN (feat) commits per TDD protocol._

## Files Created/Modified
- `src/components/accuracy/AccuracyTab.tsx` - Removed sample_n >= 5 filters, added cold-start guard, updated insufficient-data banner
- `src/components/squad/CalibrationHealthIndicator.tsx` - New component: one-line health row with good/fair/poor tier, cold-start prompt, null for absent/empty calibration
- `src/components/squad/CalibrationHealthIndicator.test.tsx` - 9 render-path tests: null states, cold-start, tier boundaries (5pp, 10pp), role=status
- `src/components/squad/DecisionSummaryTab.tsx` - Added useAccuracy hook call + CalibrationHealthIndicator render between 4-card grid and ProseSummaryBlock

## Decisions Made
- Python is the single sparse-bucket gate — AccuracyTab TS filters removed entirely (D-02). Any data Python writes is what gets rendered.
- Cold-start guard lives exclusively in TypeScript reading `data.gws_covered.length < 3` (D-05/D-06). No pipeline changes needed.
- `CalibrationHealthIndicator` reads `calibration.by_position.all` (aggregate position) as the most stable signal with ~200 obs/decile (D-08).
- Tier thresholds: good < 5pp, fair <= 10pp, poor > 10pp max haul-rate deviation (D-10). Good is strict `<`, ensuring 5pp exactly falls into fair.
- Call-site guard is `{accuracyData && ...}` — the component handles absent/empty/cold-start/tier sub-states internally.

## Deviations from Plan

None — plan executed exactly as written. All three edits were surgical as specified. The accidental commit to main (vs. worktree branch) was a CWD issue resolved by re-applying edits in the worktree.

## Issues Encountered
- First commit accidentally went to the main branch rather than the worktree branch due to CWD not being set to the worktree path. Resolved by re-applying all edits in the worktree directory and committing on the correct `worktree-agent-add3b6f3239795ed5` branch. The main branch has a duplicate commit `baafb60` that will need cleanup after the worktree merge.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 103 complete: both CAL-01 (Python pipeline fix + TS filter removal) and CAL-02 (health indicator) delivered
- DecisionSummaryTab now shows a live calibration health row — once the pipeline runs with the updated accuracy.py (Plan 01), the health row will populate automatically
- Phase 104 (SENS-01 + WHY-01) can proceed independently

---
*Phase: 103-calibration-sparse-bucket-fix-health-indicator*
*Completed: 2026-05-13*
