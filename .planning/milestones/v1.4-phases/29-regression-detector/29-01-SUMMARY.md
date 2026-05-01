---
phase: 29-regression-detector
plan: "01"
subsystem: pipeline + types
tags: [regression-signal, pipeline, types, wave-0, tdd]
dependency_graph:
  requires: []
  provides: [regression_signal, actual_vs_xg_delta, MergedPlayer-regression-fields, regression-signal-test-stubs]
  affects: [pipeline/merge.py, src/lib/types.ts, tests/lib/regression-signal.test.ts]
tech_stack:
  added: []
  patterns: [tdd-wave-0-stubs, _safe_float-cast-pattern, summaries-dict-integration]
key_files:
  created:
    - tests/lib/regression-signal.test.ts
  modified:
    - pipeline/merge.py
    - src/lib/types.ts
decisions:
  - "D-01/D-02 deviation confirmed: FPL element-summary expected_goals/expected_assists used instead of soccerdata + intermediate cache"
  - "Regression block placed after xPts_components_1gw, before sigma computation, inside merge_players() loop"
  - "D-03 graceful fallback: regression fields absent (not null-filled) when gate fails"
metrics:
  duration: "~2m 15s"
  completed: "2026-04-28"
  tasks_completed: 3
  files_modified: 3
---

# Phase 29 Plan 01: Regression Signal Pipeline + Types Summary

**One-liner:** _compute_regression_signal() helper using FPL element-summary per-match xG/xA, last-5-unique-rounds window, 900-min gate, ±0.5 threshold, with MergedPlayer optional fields and Wave 0 Vitest stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 test stubs (TDD RED) | 84b25c6 | tests/lib/regression-signal.test.ts |
| 2 | _compute_regression_signal() + merge_players() integration | 5f950e6 | pipeline/merge.py |
| 3 | MergedPlayer regression fields | ba4703d | src/lib/types.ts |

## What Was Built

### pipeline/merge.py
- Added `_compute_regression_signal(history, window_gws=5, min_minutes=900, threshold=0.5) -> tuple` helper immediately before `def merge_players()` at line 331.
- Computes last 5 unique GW round values from element-summary history (handles DGW correctly — 2 entries per round both contribute to means).
- Excludes `minutes == 0` entries from delta computation but their round still consumes a window slot.
- 900-minute gate: returns `(None, None)` when total played minutes below threshold.
- Uses `_safe_float()` for all `expected_goals`/`expected_assists` casts (T-29-01 threat mitigation).
- `delta = round(mean_actual - mean_xgxa, 4)` — BUY if `delta < -0.5`, SELL if `delta > 0.5`.
- Integration block in `merge_players()` after `player['xPts_components_1gw']`, before sigma computation: only writes fields when at least one of `reg_signal`/`reg_delta` is not None (D-03 graceful fallback).

### src/lib/types.ts
- Added `regression_signal?: 'buy' | 'sell' | null` and `actual_vs_xg_delta?: number | null` to `MergedPlayer` interface, after `xPts_components_1gw` block.

### tests/lib/regression-signal.test.ts
- Wave 0 Nyquist stubs: 5 integration `it.skip()` tests reading merged_players.json (require pipeline run), 6 component `it.todo()` stubs for RegressionSignalBadge (Wave 2 Task 1).
- Passing placeholder: `it('Wave 0 stub file created...')`.
- Full suite: 265 passed | 21 skipped | 6 todo (25 test files).

## Deviations from Plan

### Auto-documented Deviations (from PLAN.md frontmatter)

**D-01/D-02 deviation — confirmed and implemented:**
- CONTEXT.md locked soccerdata + understat_per_match.json cache
- RESEARCH.md found FPL element-summary already provides expected_goals/expected_assists per match in the summaries dict already passed to merge_players()
- Zero new HTTP calls, zero new dependencies, no intermediate cache file needed
- Deviation documented in merge.py comments and type comments per plan instructions

No unplanned deviations — plan executed exactly as written (the D-01/D-02 deviation was pre-documented in the plan frontmatter).

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-29-01 Tampering: FPL API strings | Mitigated — `_safe_float()` for all expected_goals/expected_assists casts |
| T-29-02 DoS: missing summaries/history | Mitigated — `if summaries and fpl_id in summaries` guard + empty history returns `(None, None)` |
| T-29-03 Info Disclosure: merged_players.json | Accepted — pre-computed constants from public FPL data |
| T-29-04 EoP: pipeline execution | Accepted — no user-controlled input in Phase 29 computation |

## Known Stubs

- `describe('Phase 29: RegressionSignalBadge component')` — 6 `it.todo()` stubs, all intentional. RegressionSignalBadge.tsx does not exist yet; it is Wave 2 Task 1 scope (plan 29-02). These stubs will be filled when the component is created.

## Self-Check: PASSED

- [x] `tests/lib/regression-signal.test.ts` exists
- [x] `grep -c "def _compute_regression_signal(" pipeline/merge.py` returns 1
- [x] `grep -c "regression_signal" pipeline/merge.py` returns 3 (function def line + reg_signal assignment + actual_vs_xg_delta assignment)
- [x] `grep -c "regression_signal" src/lib/types.ts` returns 1
- [x] `grep -c "actual_vs_xg_delta" src/lib/types.ts` returns 1
- [x] `npx vitest run tests/lib/regression-signal.test.ts` exits 0
- [x] `npx vitest run` exits 0 (25 files, 265 passed)
- [x] `npx tsc --noEmit` exits 0
- [x] Commits 84b25c6, 5f950e6, ba4703d all exist
