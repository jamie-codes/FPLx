---
phase: 051-weekly-decision-summary
plan: "01"
subsystem: decision-severity
tags: [decision-summary, severity, pure-fn, tdd, wds-03, wds-05]
dependency_graph:
  requires:
    - src/lib/captaincy-engine.ts
    - src/lib/lifecycle-label.ts
  provides:
    - src/lib/decision-severity.ts
  affects:
    - src/components/squad/DecisionSummaryTab.tsx (Plan 02 consumer)
tech_stack:
  added: []
  patterns:
    - Pure TypeScript module (no 'use client', no React, no I/O)
    - TDD RED/GREEN cycle matching opportunity-cost.ts pattern
key_files:
  created:
    - src/lib/decision-severity.ts
    - src/lib/__tests__/decision-severity.test.ts
  modified: []
decisions:
  - "SeverityLevel union is 'HIGH' | 'MEDIUM' | 'LOW'; captain has no LOW (D-12: HIGH/MEDIUM only)"
  - "risk and transfer share the exact same computed value (not computed independently) — satisfies D-12 'worst flag' invariant"
  - "top2 > 0 guard prevents the zero-division / single-candidate edge case from returning HIGH"
  - "chip MEDIUM branch gates only on hasRecommendedChip (not hasAvailableChip) — per D-12 spec; Test 20 verifies"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-02"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 51 Plan 01: Decision Severity Classifier — Summary

Pure-TypeScript severity classifier `computeDecisionSeverity()` with full 21-case Vitest suite; rules locked from CONTEXT.md D-12 and tested TDD-first before Plan 02 UI composition.

## What Was Built

### `src/lib/decision-severity.ts` — Public Exports

```typescript
import type { CaptaincyCandidate } from './captaincy-engine'
import type { LifecycleLabel } from './lifecycle-label'

export type SeverityLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DecisionSeverity {
  captain: SeverityLevel
  transfer: SeverityLevel
  chip: SeverityLevel
  risk: SeverityLevel
}

export interface ComputeDecisionSeverityArgs {
  candidates: CaptaincyCandidate[]    // top-N captaincy candidates, pre-sorted desc
  riskLabels: LifecycleLabel[]        // labels from STARTING XI only (position < 12 — caller filters)
  isDGW: boolean
  isBGW: boolean
  hasAvailableChip: boolean           // true when at least one of bboost/3xc/freehit is unused
  hasRecommendedChip: boolean         // true when at least one chip's bestGw aligns with the next GW
}

export function computeDecisionSeverity(
  args: ComputeDecisionSeverityArgs,
): DecisionSeverity
```

### Rules Implemented

| Card | Rule | Notes |
|------|------|-------|
| Captain | HIGH if `top2 > 0 && top1 >= 2 * top2`; else MEDIUM | Boundary `>=` not `>`. No LOW for captain. |
| Transfer | HIGH if any `sell`/`minutes_trap`; MEDIUM if any `sell_soon`/`fixture_trap`; else LOW | |
| Risk | Identical to Transfer | Same computed value shared — D-12 "worst-severity flag" |
| Chip | HIGH if `(isDGW\|\|isBGW) && hasAvailableChip && hasRecommendedChip`; MEDIUM if `hasRecommendedChip`; else LOW | MEDIUM does NOT gate on hasAvailableChip |

### Test Suite

**File:** `src/lib/__tests__/decision-severity.test.ts`
**Run command:** `npx vitest run src/lib/__tests__/decision-severity.test.ts`
**Result:** 21/21 passing

| Describe block | Cases | What is covered |
|----------------|-------|-----------------|
| captain | Tests 1–6 | HIGH/MEDIUM boundary, empty candidates, single candidate, top2=0 guard |
| transfer | Tests 7–13 | sell HIGH, minutes_trap HIGH, mixed urgency, sell_soon MEDIUM, fixture_trap MEDIUM, non-risk labels LOW, empty LOW |
| risk | Test 14 | risk===transfer invariant across three scenarios (forEach) |
| chip | Tests 15–20 | DGW HIGH, BGW HIGH, no-special-GW MEDIUM, no-recommend LOW, both-false LOW, availability-false MEDIUM |
| return shape | Test 21 | Object.keys() sort check — exactly 4 keys |

## TDD Gate Compliance

- RED commit: `378da9c` — `test(051-01): RED — decision-severity suite (21 cases) for WDS-03/WDS-05`
- GREEN commit: `ae6a210` — `feat(051-01): GREEN — implement computeDecisionSeverity for WDS-03/WDS-05`

Both gates present in order. No REFACTOR needed — implementation was clean on first pass.

## Deviations from Plan

None — plan executed exactly as written. The plan specified 18 test cases in the objective but corrected to 21 cases in the task body; the implementation follows the task body (21 cases).

## Known Stubs

None. This is a pure function with no UI rendering.

## Threat Flags

None. Per the plan's threat model: no new network endpoints, no auth paths, no user input parsing. Pure in-process function over already-trusted in-memory data.

## Self-Check: PASSED

- `src/lib/decision-severity.ts` exists: FOUND
- `src/lib/__tests__/decision-severity.test.ts` exists: FOUND
- RED commit `378da9c` exists: FOUND
- GREEN commit `ae6a210` exists: FOUND
- 21/21 tests passing: CONFIRMED
- No `'use client'` in decision-severity.ts: CONFIRMED
- Relative imports `./captaincy-engine`, `./lifecycle-label`: CONFIRMED
- Pre-existing `club-form.test.ts` failure is not caused by this plan: CONFIRMED
