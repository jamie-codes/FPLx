---
phase: 59
plan: 01
subsystem: manual-plan-engine
tags:
  - manual-plan
  - free-transfer-engine
  - localStorage
  - planner
  - tdd
dependency_graph:
  requires:
    - src/lib/free-transfer-engine.ts   # computeNextFTState, computeHitCost, snapshotSquad
    - src/lib/types.ts                  # PlannerHorizon, PlannerChip, FTState, ScoredPlayer
    - src/lib/squad-adapter.ts          # SquadPick
  provides:
    - src/lib/manual-plan.ts            # engine + types + persistence
  affects:
    - src/components/planner/ManualPlanTab.tsx  # Plan 02 (next plan) consumes this
tech_stack:
  added: []
  patterns:
    - Pure TypeScript engine module (no React, no hooks)
    - TDD RED/GREEN cycle (Vitest, jsdom environment)
    - localStorage SSR-safe pattern (typeof window guard + try/catch)
    - Phase 56 FT engine verbatim reuse (computeNextFTState, computeHitCost, snapshotSquad)
    - Free Hit squad revert pattern (snapshot before step, restore after push)
key_files:
  created:
    - src/lib/manual-plan.ts
    - src/lib/manual-plan.test.ts
  modified: []
decisions:
  - Test fixture Map entries: put filler entries before specific player entries so specific entries override any id collisions (discovered during GREEN phase)
  - Free Hit squad revert: snapshot currentSquad+currentPositions before applying FH transfers; restore after pushing DerivedStep so next step starts from pre-FH squad
  - xPts_1gw fallback in computeManualPlanSummary: undefined xPts falls back to 0 via `?? 0`; break-even only computed when delta > 0
metrics:
  duration: "~6 min (RED 4 min, GREEN 2 min)"
  completed: "2026-05-04"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
---

# Phase 59 Plan 01: Manual Plan Engine Summary

Pure TypeScript engine powering the Manual Transfer Planner: types, step-state derivation with FT/hit propagation, Free Hit squad revert, summary stats, and SSR-safe localStorage persistence. Phase 56 FT engine reused verbatim — no reimplementation of FT bank rules.

## Engine API

### Types

```typescript
export interface ManualTransfer { sellId: number; buyId: number }
export interface ManualStep { gw: number; chip: PlannerChip; transfers: ManualTransfer[] }
export interface ManualPlan { version: 1; horizon: PlannerHorizon; steps: ManualStep[] }
export interface DerivedStep {
  gw: number; chip: PlannerChip; transfers: ManualTransfer[]
  hitCost: number           // 0 or negative multiple of 4
  freeTransfersAvailable: number   // FTs available BEFORE this step
  bankAfter: number         // tenths of £1m
  squadAfter: number[]      // 15 player IDs post-step
  positionsAfter: Record<number, number>  // playerId → 1..15
  ftAfter: FTState          // FT state entering next step
}
export interface ManualPlanSummary {
  totalTransfers: number; totalHits: number
  totalHitCostPts: number   // sum of step.hitCost; 0 or negative
  avgBreakEvenGws: number | null  // mean over positive-delta hits; null when none
}
```

### Functions

| Function | Signature | Units |
|----------|-----------|-------|
| `freshPlan` | `(horizon, startingGw) → ManualPlan` | — |
| `truncateOrExtendSteps` | `(steps, newHorizon, startingGw) → ManualStep[]` | — |
| `deriveStepStates` | `(DeriveStepStatesArgs) → DerivedStep[]` | bank in tenths of £1m |
| `computeManualPlanSummary` | `(derived, playerMap) → ManualPlanSummary` | hitCostPts in FPL points |
| `persistManualPlan` | `(plan) → void` | SSR-safe, try/catch |
| `loadManualPlan` | `() → ManualPlan \| null` | validates version, schema |
| `clearManualPlan` | `() → void` | SSR-safe, try/catch |

### Key Behaviours

- `deriveStepStates` propagates bank, squad, FT state step-by-step using Phase 56 engine
- Sell price: uses `sellPrices.get(sellId)` if present (authenticated path D-12), else `playerMap.get(sellId)?.now_cost ?? 0` (unauthenticated path D-13)
- Free Hit: squad reverts to pre-FH state after pushing the derived step; next step continues from registered squad
- T-59-04: missing playerMap entries → bank delta = 0, buyId appended to squad without throw
- Break-even: `4 / (xPts_1gw_buy - xPts_1gw_sell)` for positive-delta hit transfers only; null avg when set empty

## Test Coverage

17/17 tests passing (Vitest). Coverage:

| Tests | What they verify |
|-------|-----------------|
| 1 | freshPlan structure and gw sequence |
| 2–3 | truncateOrExtendSteps shrink and grow, no mutation |
| 4–6 | Bank delta with now_cost, sellPrices override, undefined fallback |
| 7–8 | FT propagation across steps; hit cost -4 when transfers exceed FT |
| 9–10 | Wildcard = 0 hits; Free Hit = FT banked preserved via Phase 56 engine |
| 11–12 | Squad replay single and multi-step; position tracking |
| 13 | Summary totalHits and totalHitCostPts |
| 14–16 | Break-even: positive delta, negative delta excluded, all-negative = null |
| 17 | Graceful playerMap miss: no throw, bank delta 0, buyId in squad |

Requirements satisfied: MTP-03 (bank tracking), MTP-04 (FT + hit propagation), MTP-05 (break-even + summary), MTP-06 (squad replay), MTP-08 (localStorage persistence)

## localStorage Schema

```json
{
  "version": 1,
  "horizon": 3,
  "steps": [
    { "gw": 33, "chip": null, "transfers": [{ "sellId": 123, "buyId": 456 }] },
    { "gw": 34, "chip": "wildcard", "transfers": [] },
    { "gw": 35, "chip": null, "transfers": [] }
  ]
}
```

Key: `fplx_manual_plan` (D-05 convention). `loadManualPlan` validates: version===1, horizon in [1,5], steps.length in [1,5], each step has numeric gw and array transfers. Returns null on any mismatch (T-59-01 tamper protection). Steps beyond length=5 rejected (T-59-02 DoS protection).

## Phase 56 FT Engine Reuse Confirmed

`computeNextFTState`, `computeHitCost`, and `snapshotSquad` are imported directly from `src/lib/free-transfer-engine.ts` and called verbatim. No FT logic reimplemented. Import confirmed at line 3 of `src/lib/manual-plan.ts`.

## TDD Gate Compliance

- RED commit: `55cce24` — `test(59-01): RED — failing tests for manual-plan engine` (17 failing)
- GREEN commit: `74c4cc4` — `feat(59-01): GREEN — implement manual-plan engine + persistence` (17 passing)
- REFACTOR: not required; implementation is clean as written

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture Map entry ordering caused id conflicts**
- **Found during:** Task 2 (GREEN phase debug)
- **Issue:** Tests 4-6, 13-16 built playerMaps with `Array.from` filler entries placed AFTER specific player entries. JavaScript Map preserves insertion order but spreads allow later entries to override earlier ones with the same key. The filler's sequential ids (2-15) collided with the specific player ids (10, 11, 12), overwriting them with players lacking `xPts_1gw`.
- **Fix:** Reordered all affected tests to spread filler entries FIRST, then explicit player entries last so they correctly override any filler conflicts.
- **Files modified:** `src/lib/manual-plan.test.ts`
- **Commit:** `74c4cc4` (included in GREEN commit)

## Known Stubs

None — all functions fully implemented and tested.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. localStorage access is browser-local only (T-59-03 accepted per threat model).

## Self-Check: PASSED

- `src/lib/manual-plan.ts` exists: FOUND
- `src/lib/manual-plan.test.ts` exists: FOUND
- RED commit `55cce24`: FOUND
- GREEN commit `74c4cc4`: FOUND
- 17/17 tests passing: CONFIRMED
- 0 TypeScript errors: CONFIRMED
