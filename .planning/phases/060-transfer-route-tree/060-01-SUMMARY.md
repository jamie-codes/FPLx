---
phase: 60
plan: 01
subsystem: transfer-route-tree
tags: [transfer-route-tree, greedy-engine, tdd, pure-typescript]
dependency_graph:
  requires:
    - src/lib/free-transfer-engine.ts   # computeNextFTState, computeHitCost, snapshotSquad
    - src/lib/planning-engine.ts         # fixtureCountForGw
    - src/lib/types.ts                   # ScoredPlayer, FTState, PlannerHorizon, PlannerChip
    - src/lib/squad-adapter.ts           # SquadPick
  provides:
    - src/lib/transfer-route-tree.ts     # buildTransferRouteTree + 4 exported types
  affects: []
tech_stack:
  added: []
  patterns:
    - Pure-function engine module (no React, no side effects) — mirrors suggest-transfers.ts
    - Greedy multi-branch transfer loop with forced root sell in GW1
    - sellValueFor sell-price fallback pattern (verbatim from suggest-transfers.ts)
    - fixtureCountForGw DGW/BGW multiplier for per-leg xPts scoring
    - snapshotSquad for mutation-safe branch isolation
key_files:
  created:
    - src/lib/transfer-route-tree.ts    # 430 lines — pure engine + types
    - tests/lib/transfer-route-tree.test.ts  # 854 lines — 31 tests across 9 describe blocks
  modified: []
decisions:
  - GW1 with 2 FTs: forced root transfer uses 1 FT, then a second positive-gain greedy leg is attempted (D-04). The root sell is computed first, then pickBestPositiveGain is called on the working state after applying the root transfer.
  - forceRootReplacement sorts by (xPts_1gw * fixtureCount) descending to pick the best available buy, even when gain is non-positive (RESEARCH.md A1 / CONTEXT D-03).
  - Branch dropped when forceRootReplacement returns null (no budget-passing, position-matched candidate exists at all) — not when gain is merely negative.
  - Tie-break sort: xPts_1gw asc → now_cost asc → id asc for determinism (Pitfall 8).
metrics:
  duration: "~20 minutes"
  completed: "2026-05-04T12:01:09Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 60 Plan 01: Transfer Route Tree Engine (TDD) Summary

## One-Liner

Pure-TypeScript `buildTransferRouteTree` greedy engine with 3-branch sell-root selection, per-leg positive-gain enforcement (D-01/D-04), DGW/BGW-aware xPts scoring, and FT propagation via Phase 56 engine.

## Files Created

| File | Lines | Key Exports |
|------|-------|-------------|
| `src/lib/transfer-route-tree.ts` | 430 | `buildTransferRouteTree`, `RouteNode`, `RoutePath`, `TransferRouteTree`, `BuildTransferRouteTreeArgs` |
| `tests/lib/transfer-route-tree.test.ts` | 854 | 31 test cases across 9 describe blocks |

## Test Counts Per Describe Block

| Describe Block | Cases | Requirements Covered |
|---------------|-------|---------------------|
| sell-root selection | 5 (A1–A5) | TRT-01, D-03, Pitfall 8 |
| greedy continuation | 5 (B1–B5) | TRT-01, D-01, D-04, Pitfalls 1, 2 |
| node shape | 5 (C1–C5) | TRT-03 |
| path metrics | 5 (D1–D5) | TRT-02, Pitfall 3 |
| chip mode | 4 (E1–E4) | TRT-06 |
| budget | 2 (F1–F2) | D-04 cross-cutting |
| position matching | 2 (G1–G2) | D-03 position lock |
| forced root replacement | 2 (H1–H2) | Pitfall 9, RESEARCH.md A1 |
| no-LLM contract | 1 (I1) | TRT-01 no-async proof |
| **Total** | **31** | |

## Algorithm Anchor Citations

| Decision | Citation |
|----------|---------|
| Per-GW xPts: `xPts_1gw * fixtureCountForGw(player, gw)` | `planning-engine.ts:120` (gwScore) |
| Per-leg positive-gain gate: `if (gain <= 0) continue` | `suggest-transfers.ts:175,179` |
| sellValueFor sell-price fallback | `suggest-transfers.ts:55–67` |
| FT bank propagation via `computeNextFTState` | `free-transfer-engine.ts:3–25` |
| Top-20 candidate pool per position | `planning-engine.ts:10` (CANDIDATES_PER_POSITION) |
| Forced root sell always fires (GW1) | `RESEARCH.md §Assumption A1` and `CONTEXT D-03` |
| Tie-break: `xPts_1gw asc → now_cost asc → id asc` | `RESEARCH.md §Pitfall 8` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GW1 2-FT case required separate handling for second leg**

- **Found during:** Task 2 (GREEN phase) — test B3 failed with 1 transfer instead of 2
- **Issue:** The original implementation only applied the forced root transfer in GW1 and stopped, even when `ft.available >= 2`. The second FT was not used.
- **Fix:** Added a second-leg attempt in `buildBranch` when `ft.available >= 2` at h=0: after applying the root transfer to working state, `pickBestPositiveGain` is called to find a second positive-gain leg (D-04 compliant).
- **Files modified:** `src/lib/transfer-route-tree.ts`
- **Commit:** `14ebbcc`

**2. [Rule 1 - Bug] TypeScript `any[]` type error on empty `bgwFixture` array in test**

- **Found during:** Post-commit `npx tsc --noEmit` verification
- **Issue:** `const bgwFixture = []` was implicitly typed as `any[]`, causing TS7034/TS7005 errors.
- **Fix:** Added explicit `FixtureEntry[]` type annotation.
- **Files modified:** `tests/lib/transfer-route-tree.test.ts`
- **Commit:** `9be3f7d`

## D-01/D-04/Pitfall 8/Pitfall 9 Invariant Confirmation

| Invariant | Status |
|-----------|--------|
| D-01: `totalHits === 0` for every path | VERIFIED — engine uses `maxTransfers = ft.available`, never exceeds FTs; `hitCost` always set to literal `0` |
| D-01: `totalHitCostPts === 0` for every path | VERIFIED — same |
| D-04: second leg only fires when individually positive | VERIFIED — `pickBestPositiveGain` uses `if (gain > bestGain)` starting at `bestGain = 0`, so only positive gains qualify |
| Pitfall 8: deterministic sell-root order | VERIFIED — sort uses `xPts_1gw asc → now_cost asc → id asc` three-key stable comparator |
| Pitfall 9: branch dropped only when no candidate exists | VERIFIED — `forceRootReplacement` returns `null` only when `affordable.length === 0`; non-positive gain still fires the transfer |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (failing test suite) | `bdb0ee7` — `test(060-01): add failing test suite for buildTransferRouteTree` | PASSED — confirmed `Failed to resolve import @/lib/transfer-route-tree` |
| GREEN (all tests pass) | `14ebbcc` — `feat(060-01): implement buildTransferRouteTree pure engine` | PASSED — 31/31 tests green |
| REFACTOR | N/A | No refactor needed — implementation was clean on first pass after B3 fix |

## Known Stubs

None. The engine is fully implemented — no hardcoded empty values, no placeholder text.

## Threat Flags

None. Engine is a pure function over already-validated client-side data. No new network endpoints, auth paths, or file access patterns introduced. T-60-01-03 (DoS) mitigation confirmed: `TOP_N_PER_POSITION = 20` bounds worst-case to ~22,500 ops.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/lib/transfer-route-tree.ts` exists | FOUND |
| `tests/lib/transfer-route-tree.test.ts` exists | FOUND |
| Commit `bdb0ee7` (RED test suite) exists | FOUND |
| Commit `14ebbcc` (GREEN implementation) exists | FOUND |
| Commit `9be3f7d` (type fix) exists | FOUND |
| 31/31 tests pass | CONFIRMED |
| `npx tsc --noEmit` exits 0 | CONFIRMED |
