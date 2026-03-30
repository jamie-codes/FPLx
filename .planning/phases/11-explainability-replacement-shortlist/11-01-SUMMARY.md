---
phase: 11-explainability-replacement-shortlist
plan: 01
subsystem: testing
tags: [vitest, tdd, explainability, pure-function, signals]

# Dependency graph
requires:
  - phase: 10-buy-hold-sell-captaincy-engines
    provides: ScoredPlayer type, recommend.ts patterns
  - phase: 07-pipeline-schema-extension
    provides: start_prob, xg_per90, xa_per90, fixtures, form_pts_per90, proj_pts_1gw fields
provides:
  - computeExplanations(player: ScoredPlayer): string[] pure function
  - 20 Vitest tests covering all D-03 signal branches
  - Exported threshold constants for test visibility
affects:
  - 11-02 (ExplainPanel component wires computeExplanations)
  - 11-03 (UI integration for explain panel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD red/green: stub first, failing tests, then full implementation
    - Exported threshold constants pattern from recommend.ts
    - parseFloat(selected_by_percent) for FPL string fields (Pitfall 2)

key-files:
  created:
    - src/lib/explain.ts
    - tests/lib/explain.test.ts
  modified: []

key-decisions:
  - "Low xG reason excluded for GK/DEF (element_type 1 and 2); only MID/FWD per Research open Q2"
  - "mins_risk and rotation excluded from reasons per D-03 -- already shown via MinsRiskBadge"
  - "Negative reasons (poor form, difficult fixtures, low start prob, low xG) implement EXP-02 risk flags per D-04"

patterns-established:
  - "computeExplanations follows same pure function pattern as computeVerdicts -- no side effects, takes ScoredPlayer"
  - "Threshold constants exported for test visibility (FORM_POSITIVE_THRESHOLD, etc.)"

requirements-completed: [EXP-01, EXP-02]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 11 Plan 01: computeExplanations TDD Summary

**Pure `computeExplanations(player: ScoredPlayer): string[]` function mapping all D-03 signals to natural-language reasons with 20 Vitest tests green**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T17:18:40Z
- **Completed:** 2026-03-30T17:20:33Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Implemented `computeExplanations` covering all D-03 signal table entries: fixture run, form, projected pts, start probability, xG/xA, set piece roles, differential
- EXP-02 risk flags implemented as negative reasons per D-04: poor form, difficult fixtures, low start prob, low xG
- Selected-by-percent correctly parsed as float (Pitfall 2 guard)
- Low xG reason excluded for GK/DEF positions (element_type 1 and 2) per Research Q2 findings
- Full test suite remains green (157 passed, 8 skipped across 15 test files)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- Write failing tests for computeExplanations** - `28eafed` (test)
2. **Task 2: GREEN -- Implement computeExplanations** - `f14de0d` (feat)

_Note: TDD tasks have two commits (test RED then feat GREEN)_

## Files Created/Modified

- `src/lib/explain.ts` - computeExplanations pure function with exported threshold constants
- `tests/lib/explain.test.ts` - 20 test cases across 8 describe blocks covering all D-03 signals

## Decisions Made

- Low xG reason only fires for MID (element_type=3) and FWD (element_type=4) -- not GK/DEF. This follows Research open Q2 finding that defenders rarely contribute xG so low xG is not meaningful for them.
- Negative reasons implement EXP-02 risk flags (D-04 decision) -- no separate chip/badge concept needed.
- `mins_risk` and `rotation` strings are explicitly absent from all reasons (D-03 exclusion) -- MinsRiskBadge already covers this in the existing row UI.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeExplanations` is ready for wiring into ExplainPanel component (Plan 02)
- All threshold constants exported, so UI can display or reference them if needed
- No blockers for Plan 02 (replacement shortlist) or Plan 03 (UI integration)

---
*Phase: 11-explainability-replacement-shortlist*
*Completed: 2026-03-30*
