---
phase: 055-bench-order-optimiser
plan: "01"
subsystem: optimiser
tags: [optimiser, bench, pure-function, tdd]
requirements: [BENCH-01]

dependency_graph:
  requires:
    - src/lib/optimise-lineup.ts (existing optimiseLineup function)
    - src/lib/types.ts (MergedPlayer, OptimiserHorizon)
  provides:
    - benchOrder() exported from src/lib/optimise-lineup.ts
    - BENCH-01 unit tests (4 cases) in src/lib/optimise-lineup.test.ts
  affects:
    - optimiseLineup() bench slot ordering (replaced naïve horizonScore sort)

tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN/REFACTOR cycle
    - Pure function — no React imports, no side effects, ?? 0 fallback pattern
    - Partition-then-sort pattern (BGW/active split, formation-valid/invalid groups)

key_files:
  created: []
  modified:
    - src/lib/optimise-lineup.ts
    - src/lib/optimise-lineup.test.ts

decisions:
  - benchOrder uses fixtures.length === 0 for BGW detection (not xPts_1gw === 0 — different semantics from starter BGW filter)
  - Formation-legality is a demotion tie-breaker not a hard exclusion — candidates always returned
  - BGW players sort among themselves by horizon xPts desc for deterministic multi-BGW ordering

metrics:
  duration: ~3 minutes
  completed: 2026-05-03
  tasks_completed: 3
  files_modified: 2
---

# Phase 55 Plan 01: Bench Order Optimiser (benchOrder pure function) Summary

## One-liner

`benchOrder()` exported from `optimise-lineup.ts` ranks outfield bench slots by `start_prob × xPts_horizon × fixtures.length` EV, with BGW forced to slot 3 and formation-invalid candidates demoted.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: Add 4 failing BENCH-01 tests + import benchOrder | a8740df | src/lib/optimise-lineup.test.ts |
| 2 | GREEN: Implement benchOrder() + integrate into optimiseLineup() | 3010550 | src/lib/optimise-lineup.ts |
| 3 | REFACTOR + verify: Full type-check and regression check | (no changes needed) | — |

## What Was Built

### `benchOrder()` pure function (src/lib/optimise-lineup.ts)

New exported function appended after `optimiseLineup()`. Accepts `benchOutfield: MergedPlayer[]`, `starters: MergedPlayer[]`, `horizon: OptimiserHorizon`. Returns a reordered array (same length, no mutation).

Algorithm:
1. Count starter DEF/MID/FWD positions to evaluate formation-legality of bench candidates.
2. Partition bench candidates into BGW set (`fixtures.length === 0`) and active set.
3. For active set: compute EV = `start_prob × (xPts_horizon ?? 0) × fixtures.length`. Sort formation-valid first (within group: EV desc), formation-invalid second (within group: EV desc).
4. For BGW set: sort by horizon xPts desc (EV is 0 for all — deterministic tie-breaker for multiple BGW players).
5. Concatenate: `[...activeSorted, ...bgwSorted]`.

### Integration in `optimiseLineup()` (OPT-04 bench block)

Replaced the single-line `.sort((a, b) => horizonScore(b) - horizonScore(a))` with:
```typescript
const starterPlayers = bestStarterIds.map(id => playerMap.get(id)!)
const benchOutfieldRaw = benchPicks.filter(p => p.element_type !== GK)
const benchOutfield = benchOrder(benchOutfieldRaw, starterPlayers, horizon)
```

### 4 BENCH-01 test cases (src/lib/optimise-lineup.test.ts)

All 4 test cases added under `describe('BENCH-01 benchOrder()')`:
- EV ranking: `start_prob × xPts × fixtures.length` determines order (D-03)
- BGW to slot 3: BGW player with xPts=99 ends up last regardless of EV (D-05/D-06)
- DGW double-weight: `fixtures.length=2` doubles EV automatically (D-07)
- Formation demotion: DEF candidate demoted when starters already have 5 DEFs (D-08/D-09)

## Test Results

- 17 total tests pass (13 existing OPT-01..OPT-05 + 4 new BENCH-01)
- 0 failures
- chip-modes.test.ts: 18/18 pass (no regressions in optimiseLineup consumer)
- TypeScript: `npx tsc --noEmit` reports 0 errors in files modified by this plan (pre-existing errors in `tests/lib/captain-picks.test.ts` are out of scope)

## TDD Gate Compliance

- RED gate: commit `a8740df` — `test(055-01): add failing BENCH-01 benchOrder() tests (RED)` — 4 tests failed as expected
- GREEN gate: commit `3010550` — `feat(055-01): implement benchOrder() and integrate into optimiseLineup() (GREEN)` — all 17 tests pass
- REFACTOR gate: No code changes needed — implementation was already clean

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `benchOrder()` is fully wired into `optimiseLineup()` and exercised by the test suite.

## Threat Flags

None — pure computation function with no network calls, no data persistence, no auth surface, no PII. Consistent with T-055-01 accept disposition.

## Self-Check: PASSED

- `src/lib/optimise-lineup.ts` exists and contains `export function benchOrder(` ✓
- `src/lib/optimise-lineup.test.ts` exists and contains `describe('BENCH-01 benchOrder()'` ✓
- Commits `a8740df` and `3010550` exist in git log ✓
- All 17 tests pass ✓
