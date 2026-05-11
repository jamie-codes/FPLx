---
phase: 94-rejection-explainer-enhancements
plan: "01"
subsystem: rejection-engine
tags: [tdd, engine, explain, lifecycle, composition]
dependency_graph:
  requires: []
  provides: [computeRejection-8-predicates, computeHeadToHead-composition, REJECTION_FORM_THRESHOLD, REJECTION_PRICE_FALLING]
  affects: [src/lib/explain.ts, src/lib/__tests__/rejection.test.ts, src/components/gem-table/GemTable.tsx]
tech_stack:
  added: []
  patterns: [TDD RED-GREEN, pure-function composition (SC-4), 3rd-required-param extension]
key_files:
  created: []
  modified:
    - src/lib/explain.ts
    - src/lib/__tests__/rejection.test.ts
    - src/components/gem-table/GemTable.tsx
decisions:
  - "computeRejection 3rd param is required (not optional) — forces all callers to explicitly pass new Map() when no squad context; prevents silent predicate suppression (D-05)"
  - "computeHeadToHead is strictly composition — calls computeRejection(x) and computeRejection(y) then diffs reasons[]; zero predicate duplication (SC-4)"
  - "lifecycle predicate fires only for 'sell' and 'sell_soon'; all other labels (hold, buy_next_week, hold_one_more, minutes_trap, fixture_trap) are silent (D-03/D-04)"
  - "D-06 cascade order: rank → start_prob → form → fixture → price → fragility → lifecycle → ownership"
  - "Zero-predicate D-11 test uses two 'strong' players (gem_score >= posAvg, no fragility, start_prob >= 0.70) — both return reasons=[], diff is empty"
metrics:
  duration: "~5 min"
  completed: "2026-05-11T07:45:18Z"
  tasks: 2
  files: 3
---

# Phase 94 Plan 01: Rejection Engine 8-Predicates + computeHeadToHead (SC-4) Summary

**One-liner:** Extended `computeRejection` from 5 to 8 predicates (form, price, lifecycle) with new 3rd `lifecycleLabels` required param, plus composition-based `computeHeadToHead` helper that diffs two `computeRejection` results (SC-4).

## What Was Built

### Engine layer: `src/lib/explain.ts`

**New exports:**
- `REJECTION_FORM_THRESHOLD = 3.0` — D-01 form rejection gate
- `REJECTION_PRICE_FALLING = 0` — D-02 price sentinel (fires when `cost_change_event < 0`)
- `export function computeHeadToHead(x, y, allPlayers, lifecycleLabels?) => string[]` — SC-4 composition helper

**Signature change:**
```typescript
export function computeRejection(
  player: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  lifecycleLabels: Map<number, LifecycleLabel>,  // 3rd required param (D-05)
): RejectionResult
```

**D-06 cascade order (8 predicates):**

| Step | Label | Predicate | Copy string emitted |
|------|-------|-----------|---------------------|
| 3a | rank | always when not strong | `Ranked #N at POS by xPts` |
| 3b | start_prob | `start_prob < 0.70` | `Rotation risk — start probability NN%` |
| 3c | form | `form_pts_per90 < 3.0` | `Poor form — X.X pts/90 last 5 GWs` |
| 3d | fixture | `fixtures[0].difficulty_tier === 'hard'` | `Difficult fixture (FDR hard)` |
| 3e | price | `cost_change_event < 0` | `Price falling this GW (-X.Xm)` |
| 3f | fragility | delegated to `computeFragility` | `Fragile: no longer recommended if: <reason>` |
| 3g | lifecycle | `sell` or `sell_soon` label only | `Lifecycle: Sell — significantly below position average` / `Lifecycle: Sell soon — approaching sell threshold` |
| 3h | ownership | always when not strong | `Owned by N% of managers` |

**`computeHeadToHead` interface:**
```typescript
export function computeHeadToHead(
  x: ScoredPlayer,
  y: ScoredPlayer,
  allPlayers: ScoredPlayer[],
  lifecycleLabels?: Map<number, LifecycleLabel>,
): string[]
```
Returns Y's rejection reason strings that X does NOT share. Body is strictly composition — no predicate logic duplicated (SC-4):
```typescript
const xResult = computeRejection(x, allPlayers, labels)
const yResult = computeRejection(y, allPlayers, labels)
return yResult.reasons.filter(r => !xResult.reasons.includes(r))
```

**Semantics for downstream Plan 02/03 consumers:** The returned strings ARE Y's rejection reasons verbatim (e.g. `'Poor form — 2.1 pts/90 last 5 GWs'`, `'Difficult fixture (FDR hard)'`). Interpreted as "X beats Y because Y was penalised for: [reasons]."

### Tests: `src/lib/__tests__/rejection.test.ts`

**Final test count: 25 tests (all pass)**
- 14 Phase 65 existing tests — updated to 3-arg form (`computeRejection(target, population, new Map())`)
- 8 Phase 94 new predicate tests (`describe('computeRejection — Phase 94 new predicates')`)
- 3 Phase 94 h2h composition tests (`describe('computeHeadToHead — Phase 94 WHY-01-B (composition per SC-4)')`)
  - Includes dedicated SC-4 composition assertion (Test 9) — **PASSED**

**SC-4 composition test confirmed:** The case asserts `computeHeadToHead(x, y, population, labels)` strictly equals `yResult.reasons.filter(r => !xResult.reasons.includes(r))` for independently computed results.

### Call site: `src/components/gem-table/GemTable.tsx`

Line ~299 updated:
```typescript
// Before:
const rejection = computeRejection(row.original, scoredPlayers)
// After (D-05: GemTable has no squad context, lifecycle predicate intentionally silent):
const rejection = computeRejection(row.original, scoredPlayers, new Map())
```

No other call sites required changes (GemTable was the only consumer of `computeRejection` in the production codebase).

## Exact Copy Strings Emitted by New Predicates

For Plan 02/03 renderers to match callout text exactly:

| Predicate | Example output |
|-----------|---------------|
| form (D-01) | `Poor form — 2.5 pts/90 last 5 GWs` (literal em-dash U+2014, `.toFixed(1)`) |
| price (D-02) | `Price falling this GW (-0.1m)` (tenths/10 formatted `.toFixed(1)`, no extra sign prefix) |
| lifecycle sell (D-04) | `Lifecycle: Sell — significantly below position average` |
| lifecycle sell_soon (D-04) | `Lifecycle: Sell soon — approaching sell threshold` |

Note: `computeExplanations` (the positive "why" engine) uses Unicode escape `—` for em-dash in its form strings. `computeRejection` uses literal em-dash `—`. Both render identically in browsers.

## TDD Gate Compliance

- RED commit: `f04e933` — `test(94-01): add failing tests for Phase 94 predicates + computeHeadToHead composition (SC-4)`
- GREEN commit: `0033508` — `feat(94-01): extend computeRejection to 8 predicates + add composition-based computeHeadToHead (SC-4)`

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed zero-predicate test design for D-11 case**
- **Found during:** Task 1 (RED verification)
- **Issue:** Plan's Test 8 used `makePopulation(x, { sameposBetter: 1 })` which produces x and y at different rank positions (rank #2 vs rank #3), so their "Ranked #N" strings differ — `computeHeadToHead` would never return `[]` for players with different IDs in the same population
- **Fix:** Rewrote Test 8 to use two "strong" players (gem_score >= posAvg, start_prob 0.95, no fragility) so `computeRejection` returns `reasons=[]` for both — diff is provably empty
- **Files modified:** `src/lib/__tests__/rejection.test.ts`
- **Commit:** `f04e933` (part of RED commit)

## Self-Check

- [x] `src/lib/explain.ts` exists with 8-predicate cascade
- [x] `src/lib/__tests__/rejection.test.ts` exists with 25 tests (all pass)
- [x] `src/components/gem-table/GemTable.tsx` call site updated to 3-arg form

## Self-Check: PASSED
