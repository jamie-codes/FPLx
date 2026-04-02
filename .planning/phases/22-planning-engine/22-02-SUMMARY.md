---
phase: 22-planning-engine
plan: 02
subsystem: ui
tags: [react, planner, planning-engine, tanstack-query, fpl]

# Dependency graph
requires:
  - phase: 22-planning-engine/22-01
    provides: generatePlan function in src/lib/planning-engine.ts
  - phase: 21-planner-tab-shell-and-state-model
    provides: PlannerTab shell with HorizonSelector and disabled button
provides:
  - Generate Plan button wired to planning engine in PlannerTab
  - PlanResult stored in component state after button click
  - Hybrid squad data flow (myTeamData auth upgrade over squadData public)
  - Minimal result indicator showing step count and starting GW
affects: [23-planner-output-table, 24-squad-snapshot, 25-manual-edit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid squad data: prefer myTeamData (authenticated) over squadData (Team-ID-only) for sell prices and bank"
    - "computeAllGemScores in useMemo pattern (same as GemTable) to convert MergedPlayer[] → ScoredPlayer[]"
    - "startingGw derived from first fixture event_id on scoredPlayers[0]"

key-files:
  created: []
  modified:
    - src/components/planner/PlannerTab.tsx

key-decisions:
  - "useMyTeam(isAuthenticated) — pass isAuthenticated bool from useAuthStatus (actual API requires boolean, not zero args as documented in plan interfaces)"
  - "Conservative default FTState { available: 1, banked: 0 } when exact FT count unknown — plan-specified"

patterns-established:
  - "PlannerTab uses hybrid squad data pattern: myTeamData?.picks ?? squadData?.picks"

requirements-completed: [PLAN-02]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 22 Plan 02: Planning Engine UI Wiring Summary

**Generate Plan button in PlannerTab wired to generatePlan engine — hybrid squad data (auth upgrade), ScoredPlayer[] via useMemo, PlanResult in state with minimal result indicator**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T15:28:00Z
- **Completed:** 2026-04-02T15:33:00Z
- **Tasks:** 2 of 2 (Task 1 auto + Task 2 human-verify — approved)
- **Files modified:** 1

## Accomplishments
- PlannerTab now imports and calls `generatePlan` from planning-engine
- Button enabled state gated on picks + scoredPlayers + startingGw all loaded
- Hybrid squad: authenticated my-team data (with exact sell prices) preferred over public squad data
- PlanResult stored in `useState<PlanResult | null>` with minimal "Plan generated: N gameweek(s) starting GWN" indicator below button
- All 222 tests pass, Next.js build succeeds

## Task Commits

1. **Task 1: Wire Generate Plan button to engine** - `7b52cb3` (feat)
2. **Task 2: Verify Generate Plan works in browser** - checkpoint:human-verify — approved by user

## Files Created/Modified
- `src/components/planner/PlannerTab.tsx` - Fully wired component with hooks, engine call, and result display

## Decisions Made
- `useMyTeam` actual signature is `useMyTeam(enabled: boolean)` — plan's interface doc showed zero-arg form. Used `useAuthStatus().isAuthenticated` as the `enabled` argument (Rule 1 auto-fix for API correctness).
- Conservative `FTState { available: 1, banked: 0 }` default as specified in plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useMyTeam called with enabled boolean, not zero args**
- **Found during:** Task 1 (Wire Generate Plan button)
- **Issue:** Plan's `<interfaces>` showed `useMyTeam(): UseQueryResult<MyTeamResponse>` with no arguments, but the actual hook at `src/lib/hooks/useMyTeam.ts` requires `useMyTeam(enabled: boolean)`
- **Fix:** Called `useMyTeam(isAuthenticated)` using `useAuthStatus().isAuthenticated` as the enabled flag — consistent with how other components (TransferPanel etc.) control the hook
- **Files modified:** src/components/planner/PlannerTab.tsx
- **Verification:** Build passes, TypeScript errors none
- **Committed in:** 7b52cb3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect interface in plan docs)
**Impact on plan:** Necessary correction for TypeScript validity. No scope creep.

## Issues Encountered
None — plan executed cleanly once interface mismatch resolved.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PlannerTab button is active and functional — ready for Phase 23 to render the PlanResult as a proper transfer table
- PlanResult shape: `{ steps: PlanStep[], horizon: PlannerHorizon, startingGw: number }` — Phase 23 needs to read `planResult.steps` to build the output table
- Hybrid squad data pattern established and tested — Phase 23 inherits this intact

---
*Phase: 22-planning-engine*
*Completed: 2026-04-02*
