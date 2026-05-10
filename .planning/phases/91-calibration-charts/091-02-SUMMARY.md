---
phase: 91
plan: "02"
subsystem: calibration-charts
tags: [calibration, tdd, green-phase, pipeline, python, phase-91, CAL-01]
dependency_graph:
  requires:
    - "091-01: 6 RED pytest cases in pipeline/tests/test_accuracy.py"
  provides:
    - "pipeline/accuracy.py: _compute_calibration_data emits predicted_mean/actual_mean per bucket"
    - "accuracy_backtest.json: calibration buckets carry predicted_mean and actual_mean (float, 2dp)"
  affects:
    - "src/lib/types.ts (Plan 091-03 will add optional predicted_mean/actual_mean to CalibrationBucket)"
    - "src/components/accuracy/AccuracyTab.tsx (Plan 091-04 will render xPts-mean chart)"
tech_stack:
  added: []
  patterns:
    - "defaultdict(lambda: defaultdict(float)) accumulator pattern — mirrors existing bucket_haul/bucket_total int accumulators"
    - "Sparse-filter guard ordering: means computed AFTER if total < 5: continue (Pitfall 6)"
    - "round(x, 2) on pipeline floats — matches UI toFixed(2) and avoids IEEE-754 fixture drift (Pitfall 7)"
key_files:
  created: []
  modified:
    - path: pipeline/accuracy.py
      description: "_compute_calibration_data extended: 2 accumulator dicts, 2 loop accumulations, 2 emit keys"
      lines_added: 10
      lines_deleted: 0
decisions:
  - "Extension-only approach (D-07): no new helper function, no change to _empty_backtest or call site — literal in-place extension of Phase 63 code"
  - "Float accumulators default to 0.0 via defaultdict(lambda: defaultdict(float)) — no ZeroDivisionError risk because means are divided by total which is already >= 5 after the guard"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-10"
  tasks_completed: 1
  files_modified: 1
---

# Phase 91 Plan 02: Wave 1 GREEN — xPts Mean Accumulators in Pipeline Summary

Wave 1 GREEN phase extending `pipeline/accuracy.py::_compute_calibration_data` with `bucket_sum_predicted`/`bucket_sum_actual` float accumulators, turning all 6 RED pytest cases from Plan 091-01 GREEN with 10 lines added and zero existing behavior changed.

## Tasks Completed

### Task 1: Extend _compute_calibration_data with xPts mean accumulators

**Commit:** `05ae4f8` — `feat(91): emit predicted_mean/actual_mean per calibration bucket (CAL-01)`

**File modified:** `pipeline/accuracy.py`

**Three localized changes inside `_compute_calibration_data` only:**

**Change 1 — Two new accumulator dicts (lines 513–515):**
```python
# Phase 91 CAL-01 (D-07): xPts-mean accumulators — float sums for predicted_mean / actual_mean
bucket_sum_predicted: dict = defaultdict(lambda: defaultdict(float))
bucket_sum_actual: dict = defaultdict(lambda: defaultdict(float))
```
Added immediately after `bucket_total` declaration, matching existing indentation pattern.

**Change 2 — Two accumulation statements inside inner loop (lines 530–532):**
```python
# Phase 91 CAL-01: accumulate xPts sums for mean computation
bucket_sum_predicted[pk][decile] += row['xpts_predicted']
bucket_sum_actual[pk][decile]    += row['actual_pts']
```
Added inside the existing `for pk in ('all', pos_key):` block, alongside `bucket_haul` and `bucket_total` increments.

**Change 3 — Two new keys in bucket emit dict (lines 550–553):**
```python
# Phase 91 CAL-01 (D-07): xPts means; round to 2dp matches UI toFixed(2)
# and avoids IEEE-754 drift in test fixtures (Pitfall 7).
'predicted_mean': round(bucket_sum_predicted[pos_key][d] / total, 2),
'actual_mean':    round(bucket_sum_actual[pos_key][d]    / total, 2),
```
Added inside the `buckets.append({...})` dict, AFTER the existing `if total < 5: continue` guard (Pitfall 6 — ZeroDivisionError prevention).

**Verification output:**
```
pipeline/tests/test_accuracy.py::test_calibration_structure PASSED
pipeline/tests/test_accuracy.py::test_calibration_sparse_filter PASSED
pipeline/tests/test_accuracy.py::test_calibration_by_position PASSED
pipeline/tests/test_accuracy.py::test_calibration_includes_xpts_means PASSED
pipeline/tests/test_accuracy.py::test_calibration_xpts_means_descending_by_decile PASSED
pipeline/tests/test_accuracy.py::test_calibration_xpts_means_by_position PASSED
pipeline/tests/test_accuracy.py::test_calibration_xpts_means_5gw_window PASSED
pipeline/tests/test_accuracy.py::test_calibration_xpts_means_sample_n_integrity PASSED
pipeline/tests/test_accuracy.py::test_calibration_xpts_means_cold_start_absence PASSED

9 passed, 20 deselected in 0.14s

Full suite: 194 passed in 0.73s
```

## Deviations from Plan

None — plan executed exactly as written. Three localized changes in `_compute_calibration_data`, zero changes to `_empty_backtest`, call site, or any other function. No new imports. Extension-only.

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "bucket_sum_predicted" pipeline/accuracy.py` >= 3 | 3 (declaration + inner loop + emit) |
| `grep -c "bucket_sum_actual" pipeline/accuracy.py` >= 3 | 3 (declaration + inner loop + emit) |
| `grep -c "'predicted_mean': round(bucket_sum_predicted"` = 1 | 1 |
| `grep -c "'actual_mean':"` = 1 | 1 |
| `_empty_backtest` unchanged | 0 lines changed (confirmed via git diff) |
| Sparse-filter guard before predicted_mean emit | Line 47 (guard) before line 57 (emit) in function |
| Calibration tests PASSED count = 9 | 9 |
| Calibration tests FAILED count = 0 | 0 |
| Full suite green | 194 passed |
| No new imports | 0 new import lines (confirmed via git diff) |

## Known Stubs

None — this is a pure pipeline extension with no UI rendering. No hardcoded values, no placeholder text.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The `predicted_mean`/`actual_mean` fields are aggregate statistics over public FPL data written to the existing `accuracy_backtest.json` cache. T-91-04 (ZeroDivisionError) and T-91-05 (round() precision) mitigations are in place as per the threat model — means are only computed after the `if total < 5: continue` guard, and rounded to 2dp.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `pipeline/accuracy.py` exists and modified | FOUND |
| Commit `05ae4f8` exists | FOUND |
| 9 calibration tests pass | VERIFIED |
| 194 full suite tests pass | VERIFIED |
| `_empty_backtest` unchanged | VERIFIED (0 diff lines) |
| No new imports | VERIFIED (0 new import lines) |
