---
phase: 25-manual-edit-mode
plan: "01"
subsystem: planner
tags: [types, planning-engine, tdd, modal, manual-edit]
dependency_graph:
  requires: []
  provides: [PlanResult.originalSteps, generatePlanFrom, squadPicksFromStep, ftStateAfterStepIndex, PlayerPickerModal]
  affects: [src/lib/types.ts, src/lib/planning-engine.ts, src/components/planner/PlayerPickerModal.tsx]
tech_stack:
  added: []
  patterns: [native-dialog, tdd-red-green, readonly-field-immer-protection]
key_files:
  created:
    - src/lib/__tests__/planning-engine-rescore.test.ts
    - src/components/planner/PlayerPickerModal.tsx
  modified:
    - src/lib/types.ts
    - src/lib/planning-engine.ts
decisions:
  - "originalSteps set to [] in generatePlan — Plan 02 (PlannerTab wiring) will populate it with structuredClone(result.steps)"
  - "generatePlanFrom casts remainingHorizon as PlannerHorizon — callers must ensure value is 1-5 (enforced at call sites in Plan 02)"
  - "Test 2 uses synthetic PlanStep array to directly test ftStateAfterStepIndex — avoids coupling test outcome to engine's transfer-selection heuristic"
metrics:
  duration: "~12 min"
  completed_date: "2026-04-03"
  tasks: 2
  files_changed: 4
---

# Phase 25 Plan 01: Type Extension, generatePlanFrom, and PlayerPickerModal Summary

One-liner: Added `readonly originalSteps` to `PlanResult`, exported three re-scoring helpers (`generatePlanFrom`, `squadPicksFromStep`, `ftStateAfterStepIndex`), wrote 5 unit tests via TDD, and built `PlayerPickerModal` using the native dialog pattern from `AuthModal`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Type extension + generatePlanFrom + unit tests | 507a319 | src/lib/types.ts, src/lib/planning-engine.ts, src/lib/__tests__/planning-engine-rescore.test.ts |
| 2 | PlayerPickerModal component | 5433509 | src/components/planner/PlayerPickerModal.tsx |

## What Was Built

### Task 1: Type Extension + Engine Helpers

**`src/lib/types.ts`** — Added `readonly originalSteps: PlanStep[]` to `PlanResult`. The `readonly` modifier provides compile-time protection against Immer accidentally mutating the baseline, matching decision D-04 from the phase context.

**`src/lib/planning-engine.ts`** — Three new exports:
- `generatePlanFrom(picksAfterStep, allPlayers, remainingHorizon, startingGw, ftStateAfterStep, bankAfterStep, sellPrices?): PlanStep[]` — thin wrapper around `generatePlan` that accepts mid-plan squad state; returns only the steps array. Early-returns `[]` for `remainingHorizon <= 0`.
- `squadPicksFromStep(step: PlanStep): SquadPick[]` — reconstructs `SquadPick[]` from `step.squadAfter` and `step.positionsAfter`, used to seed re-scoring after a manual edit.
- `ftStateAfterStepIndex(steps, upToIndex, initialFT): FTState` — replays FT state transitions from `initialFT` through steps[0..upToIndex] inclusive using `computeNextFTState`.

Updated `generatePlan` return value to include `originalSteps: []` to keep the type correct; Plan 02 will populate it with `structuredClone(result.steps)`.

**`src/lib/__tests__/planning-engine-rescore.test.ts`** — 5 unit tests (TDD: RED then GREEN):
- Test 1: `generatePlanFrom` with horizon=2 returns 2 steps with correct gw numbers
- Test 2: `ftStateAfterStepIndex` after 1 FT used → available=1, banked=0
- Test 3: `ftStateAfterStepIndex` after hold (0 transfers) → available=2, banked=1
- Test 4: `generatePlanFrom` with horizon=0 returns empty array
- Test 5 (squadPicksFromStep): reconstructed picks match squadAfter IDs and have correct shape

### Task 2: PlayerPickerModal

**`src/components/planner/PlayerPickerModal.tsx`** — Native dialog component following the `AuthModal` pattern exactly:
- `useRef<HTMLDialogElement>` + `useEffect([open])` calling `showModal()` / `close()`
- Native `close` event listener syncs React state on Escape key
- Backdrop click: `if (e.target === dialogRef.current) onClose()`
- Always rendered in DOM (never conditionally) to avoid null-ref on first open
- Search input with `fontSize: 16px` (prevents iOS keyboard zoom), auto-focused on open via `useEffect` + 50ms debounce
- Suggested player pinned above search results in `bg-violet-50 dark:bg-violet-950/30` row
- Remaining players filtered by `web_name` (case-insensitive), sorted by `proj_pts_1gw` descending
- Backdrop styling from existing `dialog::backdrop` rule in `globals.css` (not Tailwind `backdrop:` prefix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 2 assertion corrected for actual engine behavior**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test 2 assumed the engine would always make a transfer in step 0, but with the default mock players (identical proj_pts, identical costs), no transfer yields positive netGain — the engine correctly holds. The assertion `expect(ftAfterStep0.available).toBe(1)` was failing with value `2`.
- **Fix:** Rewrote Test 2 to use a synthetic `PlanStep` array to directly test `ftStateAfterStepIndex` logic without depending on the engine's transfer-selection heuristic. This is more accurate and focused.
- **Files modified:** src/lib/__tests__/planning-engine-rescore.test.ts

## Known Stubs

None. All exported functions are fully implemented. `originalSteps: []` in `generatePlan` is intentional — documented in decisions above; Plan 02 is responsible for populating it.

## Self-Check: PASSED

All 4 key files confirmed present. Both task commits verified in git log.
