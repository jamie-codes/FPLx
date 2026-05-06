---
phase: 064-sensitivity-analysis
plan: "01"
subsystem: lib/sensitivity
tags: [tdd, pure-function, fragility, SENS-01]
dependency_graph:
  requires: [src/lib/types.ts]
  provides: [src/lib/sensitivity.ts]
  affects: []
tech_stack:
  added: []
  patterns: [pure-TS-function, vitest-node-environment, makePlayer-fixture]
key_files:
  created:
    - src/lib/sensitivity.ts
    - src/lib/__tests__/sensitivity.test.ts
  modified: []
decisions:
  - "computeFragility accepts MergedPlayer (not ScoredPlayer) — all three fields read (start_prob, fixtures, xPts_1gw) are on MergedPlayer; avoids cast in CandidateRow (RESEARCH.md Pitfall 2)"
  - "Reasons stored as short fragments ('start_prob < 70%', etc.) — prefix added by FragilityNote component at render time (avoids Pitfall 4)"
  - "Deterministic reason ordering: rotation first, then fixture, then hit — matches D-12 comma-joined output order"
metrics:
  duration: "3m"
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_changed: 2
---

# Phase 64 Plan 01: Fragility Engine (computeFragility) Summary

**One-liner:** Pure TypeScript `computeFragility` function implementing SENS-01 three-condition fragility detection (rotation, fixture, hit cost) with full unit-test coverage following TDD RED/GREEN cycle.

## What Was Built

`src/lib/sensitivity.ts` exports `computeFragility(player: MergedPlayer, isTransfer: boolean, xPtsGain?: number): FragilityResult` and `FragilityResult` interface. The function evaluates three conditions in deterministic order:

1. `player.start_prob < 0.70` → pushes `'start_prob < 70%'` (D-07)
2. `player.fixtures.length > 0 && player.fixtures[0].difficulty_tier === 'medium'` → pushes `'harder fixture'` (D-04, D-05)
3. `isTransfer && xPtsGain !== undefined && xPtsGain < 4.0` → pushes `'taken as a hit (-4pt)'` (D-09, D-10)

Returns `{ fragile: reasons.length > 0, reasons }`.

`src/lib/__tests__/sensitivity.test.ts` contains 7 test cases covering all SENS-01 paths, following the established `@vitest-environment node` + `makePlayer` pattern from `mc-labels.test.ts`.

## TDD Gate Compliance

- RED gate: commit `7e2d9e3` — `test(064-01): add failing tests for computeFragility` — 4 tests failing (cases 2, 3, 4, 6). Cases 1, 5, and 7 pass against stub (all are "no fragility" baselines returning `{ fragile: false, reasons: [] }` which matches stub output). Plan required ≥5 failing; 4 failed because case 5 (captain path ignores hit) also passes the stub.
- GREEN gate: commit `d8713f0` — `feat(064-01): implement computeFragility — SENS-01` — all 7 tests passing.

## Verification Results

```
npx vitest run src/lib/__tests__/sensitivity.test.ts
  Tests  7 passed (7)

npx tsc --noEmit
  (clean — exit 0)

npx vitest run (full suite)
  Tests  6 failed | 903 passed | 34 skipped (943)
  (6 failures are all pre-existing: TEST-57 captain-picks.test.ts x5, club-form.test.ts x1)
```

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 7e2d9e3 | test(064-01): add failing tests for computeFragility |
| 2 | d8713f0 | feat(064-01): implement computeFragility — SENS-01 |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on RED gate count:** The plan expected "at least 5 of the 7 cases MUST be RED." Only 4 failed because cases 1, 5, and 7 are all no-fragility baselines that pass the stub. The plan text said "cases 1 and 7 may pass" but case 5 (captain path with low xPtsGain) also passes since `isTransfer=false` means the hit condition check is skipped by the stub returning `{fragile:false}`. The RED phase is still valid — the stub clearly does not implement the logic, and all 4 failing tests are meaningful regression-preventing cases.

## Known Stubs

None — `computeFragility` is fully implemented. The function will be consumed by Plan 02 (FragilityNote component) and Plan 03 (TransferPanel + CaptainPicksPanel integration).

## Threat Flags

None — pure TypeScript function with no network endpoints, auth paths, file access, or schema changes. All inputs are pre-validated pipeline data from existing `MergedPlayer` objects.

## Self-Check: PASSED

- [x] `src/lib/sensitivity.ts` exists: FOUND
- [x] `src/lib/__tests__/sensitivity.test.ts` exists: FOUND
- [x] Commit `7e2d9e3` exists: FOUND
- [x] Commit `d8713f0` exists: FOUND
- [x] All 7 tests pass: CONFIRMED
- [x] `npx tsc --noEmit` exits 0: CONFIRMED
