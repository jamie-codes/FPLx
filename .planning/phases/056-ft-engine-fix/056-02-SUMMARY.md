---
phase: 056-ft-engine-fix
plan: "02"
subsystem: planner
tags: [free-transfers, planner, authenticated-state, useMemo, FTX-01]
dependency_graph:
  requires: [056-01]
  provides: [FTX-01-consumer]
  affects: [src/components/planner/PlannerTab.tsx]
tech_stack:
  added: []
  patterns: [useMemo-authenticated-derivation]
key_files:
  created: []
  modified:
    - src/components/planner/PlannerTab.tsx
decisions:
  - "Mirrored TransferPanel.derivedFtCount useMemo pattern (CONTEXT D-06) verbatim — same dependency array and branch order — to keep the two derivations consistent and reviewable side by side"
  - "Exposed banked count explicitly (banked: 0 | 1) to give the engine a correct starting bank, not just the available count"
metrics:
  duration: "~35 minutes (Task 1 implementation + human-verify review)"
  completed: "2026-05-03"
  tasks_completed: 2
  files_modified: 1
---

# Phase 056 Plan 02: PlannerTab initialFTState Fix Summary

**One-liner:** Replaced hardcoded `const initialFTState` with `useMemo<FTState>` deriving authenticated rolled-FT state — closing the consumer-facing half of FTX-01 in the multi-GW planner.

## What Was Built

`src/components/planner/PlannerTab.tsx` — `initialFTState` converted from a static constant to a reactive `useMemo` that derives the starting FT state from the authenticated user's `myTeamData.entry_history.event_transfers` field. When an authenticated user has rolled their free transfer (`event_transfers === 0`) with no active chip, the planner now seeds step 0 with `{ available: 2, banked: 1 }` instead of the previous hardcoded `{ available: 1, banked: 0 }`.

## Before / After Diff (lines 54–55 → lines 54–67)

```diff
-  // Conservative default FT state when exact count is unknown
-  const initialFTState: FTState = { available: 1, banked: 0 }
+  // Initial FT state — mirrors TransferPanel.derivedFtCount pattern (CONTEXT D-06).
+  // Authenticated path: derive from event_transfers (0 → rolled FT → available: 2, banked: 1).
+  // Active WC/FH chip GW: planner displays as if 1 FT for the current GW.
+  // Unauthenticated or pre-load: safe default { available: 1, banked: 0 }.
+  const initialFTState: FTState = useMemo(() => {
+    if (!isAuthenticated || !myTeamData) return { available: 1, banked: 0 }
+    const chip = squadData?.active_chip
+    if (chip === 'wildcard' || chip === 'freehit') return { available: 1, banked: 0 }
+    const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
+    const banked: 0 | 1 = available === 2 ? 1 : 0
+    return { available, banked }
+  }, [isAuthenticated, myTeamData, squadData])
```

## No New Imports Required

`useMemo` was already imported at line 3: `import { useState, useMemo } from 'react'`. `FTState` was already imported from `@/lib/types` at line 16. `isAuthenticated`, `myTeamData`, and `squadData` were already destructured from their hooks at lines 29–35. Zero import changes were needed.

## Downstream Consumer Verification

All three downstream consumers pass `initialFTState` unchanged — no modifications required:

| Line | Usage | Context |
|------|-------|---------|
| 78 | `generatePlan(..., initialFTState, ...)` | Planner engine entry point — seeds step 0 |
| 120 | `ftStateAfterStepIndex(planResult.steps, stepIndex, initialFTState)` | FT badge for individual GW steps |
| 216–217 | `? initialFTState : ftStateAfterStepIndex(planResult.steps, stepIndex - 1, initialFTState)` | GW0 branch vs subsequent steps |

The `FTState` interface is unchanged and both the old const and new useMemo return the same type — consumers require no modification.

## Human-Verify Outcome (Task 2 — Approved)

Both required paths confirmed correct by the user:

| Path | Precondition | Observed GW1 freeTransfersAvailable |
|------|-------------|-------------------------------------|
| Authenticated + rolled FT | `event_transfers === 0`, no active chip | **2** (correct — rolled FT reflected) |
| Unauthenticated | Signed out / pre-load | **1** (correct — safe default preserved) |

No console errors or React Hook order warnings observed. User response: "Approved."

## TypeScript Check Results

`npx tsc --noEmit` — no errors in `src/components/planner/PlannerTab.tsx`.

Five pre-existing errors exist in `tests/lib/captain-picks.test.ts` (TS2554: argument count mismatch at lines 158, 175, 189, 199, 212) — present before this plan, unrelated to `initialFTState`, and out of scope.

## Vitest Results

`npx vitest run tests/lib/free-transfer-engine.test.ts`:
- 1 test file passed, 31 tests passed

`npx vitest run` (full suite):
- 50 test files passed, 1 pre-existing failure (`tests/lib/club-form.test.ts` — difficulty tier assertion introduced before this phase, unrelated to FT engine)
- 605 tests passed, 1 failed (pre-existing), 34 skipped
- No regressions introduced by this plan

## FTX-01 Resolution Status

FTX-01 ("initial FT state incorrect — planner always seeds with { available: 1 }") is **fully addressed** by this plan in combination with plan 056-01:

- **056-01** fixed `computeNextFTState` to correctly advance the bank across GWs (engine correctness)
- **056-02** (this plan) fixed `initialFTState` to seed step 0 with the authenticated user's real FT count (consumer correctness)

Both the engine and the planner entry point are now correct. An authenticated user who rolled their FT will see `freeTransfersAvailable: 2` in GW1 of the multi-GW planner and will not be charged a hit for using both of their available transfers.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/components/planner/PlannerTab.tsx` — modified and committed at ec2fc2e
- Commit ec2fc2e exists in git log
- SUMMARY.md created at `.planning/phases/056-ft-engine-fix/056-02-SUMMARY.md`
- No STATE.md or ROADMAP.md modifications made
