---
phase: 063
plan: 02
subsystem: accuracy-pipeline
tags: [accuracy, calibration, versioning, pipeline, python, green-state]
dependency_graph:
  requires: [063-01-test-stubs]
  provides: [063-02-accuracy-py-versioning-calibration]
  affects: [063-03-PLAN, 063-04-PLAN]
tech_stack:
  added: []
  patterns: [read-existing-flag-pattern, dedup-append, decile-bucketing]
key_files:
  created: []
  modified:
    - pipeline/accuracy.py
decisions:
  - "FORMULA_VERSION = 'v1.12-a' constant at module top; pattern v{milestone}-{letter} for manual bumping"
  - "_read_existing_versions reads top-level 'versions' key (NOT nested under 'summary') — mirrors existing flag-preservation helpers"
  - "Version dedup-append guards empty list before subscripting (Pitfall 7): `not versions or versions[-1].get(...) != FORMULA_VERSION`"
  - "hit_rate in version record uses overall_xpts_blended_hit (Pitfall 1 — blended, not baseline)"
  - "_compute_calibration_data placed after _empty_backtest in Private helpers section"
  - "predicted_rate == bucket_mid (Open Question 1 resolution: decile midpoint as predicted rate)"
  - "_empty_backtest cold-start returns full shape with both 'versions' (from disk) and 'calibration' (empty arrays)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 63 Plan 02: Python Backend for VER-01/CAL-01/CAL-02 Summary

Python implementation extending `pipeline/accuracy.py` with FORMULA_VERSION versioning and decile calibration bucketing. All 6 RED Python stubs from Plan 01 turn GREEN; full 105-test Python suite passes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add FORMULA_VERSION constant, _read_existing_versions helper, version dedup-append | 08b4805 | pipeline/accuracy.py |
| 2 | Add _compute_calibration_data helper and 'calibration' key to compute_accuracy_backtest and _empty_backtest | 8faa6b0 | pipeline/accuracy.py |

## What Was Built

### Task 1 — FORMULA_VERSION + version history (pipeline/accuracy.py)

- `FORMULA_VERSION = 'v1.12-a'` constant added after `FORM_MIN_MINUTES` at module top (VER-01 / D-01)
- `_read_existing_versions(cache_dir)` helper with identical three-exception guard `(FileNotFoundError, json.JSONDecodeError, OSError)` as existing flag helpers; reads `prev.get('versions', [])` from TOP LEVEL (not nested under `summary`) — Pitfall 2 avoided
- Version dedup-append block inside `compute_accuracy_backtest` after the bonus predictor flag read: reads prior versions, builds new record with `formula_version`, `recorded_at`, `hit_rate` (blended — Pitfall 1), and `gate_flags` dict; D-03 dedup guard: `not versions or versions[-1].get('formula_version') != FORMULA_VERSION` (Pitfall 7 — empty list guard before subscripting)
- `'versions': versions` added to `compute_accuracy_backtest` return dict

### Task 2 — Calibration decile bucketing (pipeline/accuracy.py)

- `_compute_calibration_data(per_gw_rows)` helper added (56 lines) implementing rank-percentile decile bucketing (D-05/D-06):
  - Iterates all GW rows, ranks players by `xpts_predicted` descending, assigns `decile = min(int(rank_idx * 10 / n), 9)`
  - Accumulates haul count (`actual_pts >= HAULTER_THRESHOLD`) and total count per `(pos_key, decile)` pair for all positions plus aggregate `'all'`
  - `pos_key = str(row['element_type'])` — Pitfall 3 (element_type is int 1-4, must convert to string)
  - D-07 sparse-bucket filter: `if total < 5: continue` — omits, does not zero
  - `bucket_mids = [round(d * 0.1 + 0.05, 2) for d in range(10)]` produces midpoints 0.05..0.95
  - `predicted_rate = bucket_mids[d]` — Open Question 1 resolution
  - Returns `{'by_position': {'all': [...], '1': [...], '2': [...], '3': [...], '4': [...]}}`
- `calibration = _compute_calibration_data(per_gw_rows)` precompute call inserted before `overall_xpts_hit` computation
- `'calibration': calibration` added to `compute_accuracy_backtest` return dict
- `_empty_backtest` extended with both new keys: `'versions': _read_existing_versions(cache_dir)` (preserves history on cold start) and `'calibration': {'by_position': {'all': [], '1': [], '2': [], '3': [], '4': []}}` (full shape with empty arrays — Open Question 2 resolution)

## Verification Results

All 6 Phase 63 Python tests turn GREEN:
```
test_version_record_appended  PASSED
test_version_dedup            PASSED
test_version_cold_start       PASSED
test_calibration_structure    PASSED
test_calibration_sparse_filter PASSED
test_calibration_by_position  PASSED
```

Full Python suite: **105 passed** (no regressions).

Acceptance criteria string literals all present in `pipeline/accuracy.py` (15/15 checks pass).

`pipeline/accuracy.py` final line count: 629 (requirement: min 600).

## Deviations from Plan

None — plan executed exactly as written. All four edits in Task 1 and all three edits in Task 2 applied as specified.

## Known Stubs

None — all implementation is complete. `_compute_calibration_data` produces real decile data from `per_gw_rows`; no hardcoded returns or placeholder values.

## Threat Flags

No new threat surface introduced. The `_read_existing_versions` helper follows the identical three-exception guard pattern as the existing `_read_existing_xmins_v2_flag` and `_read_existing_bonus_predictor_flag` helpers (T-063-03 mitigated). No new HTTP calls, no new API routes, no user input handling.

## Self-Check

- [x] `pipeline/accuracy.py` modified with FORMULA_VERSION, _read_existing_versions, _compute_calibration_data
- [x] Commit 08b4805 exists (Task 1)
- [x] Commit 8faa6b0 exists (Task 2)
- [x] All 6 Phase 63 Python tests GREEN confirmed
- [x] Full 105-test Python suite passes (no regressions)
- [x] All 15 acceptance criteria string literals present in accuracy.py
- [x] Line count: 629 >= 600 (min_lines requirement met)

## Self-Check: PASSED
