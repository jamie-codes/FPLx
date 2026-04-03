---
phase: 25-manual-edit-mode
plan: "02"
subsystem: planner
tags: [manual-edit, player-picker, re-scoring, immer, react, planner]

# Dependency graph
requires:
  - phase: 25-manual-edit-mode/25-01
    provides: [generatePlanFrom, ftStateAfterStepIndex, PlayerPickerModal, PlanResult.originalSteps]
provides:
  - handleManualEdit callback in PlannerTab wired to re-scoring engine
  - handleRestoreSuggested callback restoring originalSteps player
  - Pencil icon on transfer In cells opening PlayerPickerModal
  - Undo icon (arrow) visible when current In differs from originalSteps
  - originalSteps populated via structuredClone at generation time
  - Hold rows have no edit control
affects: [PlannerTab.tsx, TransferPlanTable.tsx]

# Tech tracking
tech-stack:
  added: []
  patterns: [compute-before-immer-mutation, single-immer-draft-splice, structuredClone-at-generation]

key-files:
  created: []
  modified:
    - src/components/planner/PlannerTab.tsx
    - src/components/planner/TransferPlanTable.tsx

key-decisions:
  - "Compute all re-scoring values (syntheticPicks, bankAfterStepX, ftAfterX, newStepsFromXPlus1) before entering Immer draft — single mutation avoids draft-read issues"
  - "originalSteps populated with structuredClone(result.steps) in handleGeneratePlan — only place it is ever set; never touched again"
  - "openPicker reads suggestedPlayerId from originalSteps (not current steps) — ensures suggested always shows engine original"
  - "PlayerPickerModal always in DOM (not conditional) — follows Phase 25 Plan 01 native-dialog pattern"

patterns-established:
  - "compute-before-immer-mutation: all derived values computed outside draft callback, only state written inside"
  - "single-draft-splice: steps[stepIndex+1..] replaced atomically with newStepsFromXPlus1 using splice"

requirements-completed: [PLAN-04]

# Metrics
duration: ~10min
completed: 2026-04-03
---

# Phase 25 Plan 02: Manual Edit Wiring Summary

**Pencil and undo icons wired into TransferPlanTable In cell, with PlayerPickerModal integration and full re-scoring via generatePlanFrom after each manual pick or restore**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Tasks:** 2 (Task 1 auto + Task 2 checkpoint:human-verify — approved)
- **Files modified:** 2

## Accomplishments

- `handleManualEdit(stepIndex, newBuyId)` in PlannerTab: derives new squad state, bank, FT state, calls `generatePlanFrom` for remaining steps, splices result into Immer draft in a single mutation
- `handleRestoreSuggested(stepIndex)` delegates to `handleManualEdit` using `originalSteps[stepIndex].transfersIn[0]`
- `handleGeneratePlan` updated to set `originalSteps: structuredClone(result.steps)` — baseline frozen at generation time
- `TransferPlanTable` extended with `onManualEdit`, `onRestoreSuggested` props, `pickerState`, `openPicker` helper
- Pencil icon (✏) on every transfer row In cell — always visible, opens picker for that row's position
- Undo arrow (↩) appears next to In player name only when current transfersIn[0] differs from originalSteps transfersIn[0]
- `PlayerPickerModal` rendered always in DOM at bottom of `TransferPlanTable` — `squadIds` excludes current squad members
- Hold rows (colSpan=2) untouched — no edit control

## Task Commits

1. **Task 1: PlannerTab callbacks + TransferPlanTable wiring** - `524510a` (feat)
2. **Task 2: Verify manual edit flow end-to-end** - checkpoint:human-verify — Approved by user

## Files Created/Modified

- `src/components/planner/PlannerTab.tsx` - Added handleManualEdit, handleRestoreSuggested, updated handleGeneratePlan to set originalSteps, pass new props to TransferPlanTable
- `src/components/planner/TransferPlanTable.tsx` - Added PlayerPickerModal import, extended props, added pickerState + openPicker, updated In cell rendering with pencil/undo buttons, rendered PlayerPickerModal

## Decisions Made

- Compute-before-immer-mutation pattern: all derived values (`newSquadAfter`, `newPositionsAfter`, `bankAfterStepX`, `ftAfterX`, `syntheticPicks`, `newStepsFromXPlus1`) computed outside the Immer draft callback, then written atomically inside.
- `openPicker` reads `suggestedPlayerId` from `planResult.originalSteps[stepIndex]?.transfersIn[0]` — ensures the picker always pins the engine's original suggestion, not the current (possibly edited) player.
- `PlayerPickerModal` always mounted in DOM (never conditional) — matches `AuthModal` pattern established in Phase 20.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. All callbacks are fully wired. `PlayerPickerModal` receives live `scoredPlayers` data. Re-scoring calls real `generatePlanFrom`. Undo reads real `originalSteps`.

## Next Phase Readiness

- PLAN-04 complete: manual edit mode fully wired
- Phase 25 is the final phase of v1.3 — human verification confirmed, milestone complete
- All 240+ tests pass

## Self-Check: PASSED

- `/c/users/jamie/fplx/src/components/planner/PlannerTab.tsx` — contains `handleManualEdit`, `handleRestoreSuggested`, `structuredClone`
- `/c/users/jamie/fplx/src/components/planner/TransferPlanTable.tsx` — contains `PlayerPickerModal`, `openPicker`, pencil/undo icons
- Commit `524510a` verified in git log

---
*Phase: 25-manual-edit-mode*
*Completed: 2026-04-03*
