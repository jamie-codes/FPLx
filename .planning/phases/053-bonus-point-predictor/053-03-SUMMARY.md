---
phase: 053-bonus-point-predictor
plan: "03"
subsystem: pipeline
tags: [pipeline, python, tdd, accuracy, gate, flag-persistence]
requirements: [BPS-01]

dependency_graph:
  requires:
    - pipeline/accuracy.py (existing Phase 40/42/52 module)
  provides:
    - pipeline/accuracy.py::_read_existing_bonus_predictor_flag
    - accuracy_backtest.json:summary.bonus_predictor_enabled
  affects:
    - pipeline/run.py (Plan 02 reads bonus_predictor_enabled from accuracy_backtest.json)

tech_stack:
  added: []
  patterns:
    - Flag-persistence helper pattern (mirror of _read_existing_xmins_v2_flag from Phase 52 D-02)
    - Manual-flip gate pattern: value set once externally, preserved across subsequent backtest runs
    - JSON try/except chain: FileNotFoundError, json.JSONDecodeError, OSError — default False on cold start

key_files:
  created: []
  modified:
    - pipeline/accuracy.py
    - pipeline/tests/test_accuracy.py

decisions:
  - Named helper function per flag (not factored into generic helper) — explicit named functions form audit trail matching Phase 42 form_signal_enabled and Phase 52 xmins_v2_enabled pattern
  - Flag inserted between xmins_v2_enabled and blend_alpha_used in summary dict — chronological/logical grouping of gate flags
  - bonus_predictor_enabled defaulted to False in _empty_backtest — cold-start consistency with all other gate flags

metrics:
  duration: "3 min"
  completed_date: "2026-05-02"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 53 Plan 03: bonus_predictor_enabled Flag Persistence in accuracy.py Summary

**One-liner:** `_read_existing_bonus_predictor_flag` helper added to `accuracy.py` (exact clone of Phase 52 xmins_v2_enabled pattern) writing `bonus_predictor_enabled` into the backtest summary dict and cold-start `_empty_backtest`, closing the flag-persistence loop for Plan 02's `run.py` reader.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 3 RED tests for bonus_predictor_enabled flag persistence | ac3af72 | pipeline/tests/test_accuracy.py |
| 2 | Add helper + summary writes in accuracy.py (GREEN) | e881da6 | pipeline/accuracy.py |

## What Was Built

### pipeline/accuracy.py

Three additive edits:

1. New `_read_existing_bonus_predictor_flag(cache_dir: str) -> bool` helper (lines 55-70) — exact structural clone of `_read_existing_xmins_v2_flag` with `'bonus_predictor_enabled'` as the dict key. Handles `(FileNotFoundError, json.JSONDecodeError, OSError)` with `False` default.

2. Call site in `compute_accuracy_backtest` immediately after `xmins_v2_enabled = _read_existing_xmins_v2_flag(cache_dir)`:
   ```python
   bonus_predictor_enabled = _read_existing_bonus_predictor_flag(cache_dir)  # Phase 53 BPS-01
   ```

3. Summary key in `compute_accuracy_backtest` return dict and `_empty_backtest` cold-start dict:
   ```python
   'bonus_predictor_enabled': bonus_predictor_enabled,  # compute_accuracy_backtest
   'bonus_predictor_enabled': False,                    # _empty_backtest
   ```

### pipeline/tests/test_accuracy.py

Three new test functions appended after existing Phase 42 ACC-04 tests:

- `test_backtest_writes_bonus_predictor_flag` — asserts `bonus_predictor_enabled` is present in summary and is a `bool`
- `test_bonus_predictor_flag_defaults_false_cold_start` — uses `tmp_path` (empty dir, no prior JSON) → asserts `False`
- `test_bonus_predictor_flag_persists_across_runs` — seeds `tmp_path/accuracy_backtest.json` with `bonus_predictor_enabled: true`, calls `compute_accuracy_backtest(cache_dir=tmp_path)`, asserts `True` is preserved

## TDD Gate Compliance

- RED gate: `test(053-03)` commit `ac3af72` — 3 tests, all failing with `KeyError: 'bonus_predictor_enabled'`
- GREEN gate: `feat(053-03)` commit `e881da6` — 3 new tests pass; 73 total pipeline tests pass

## Deviations from Plan

None — plan executed exactly as written. All four edits (helper definition, call site, summary dict, empty_backtest dict) applied verbatim per plan specification.

## Known Stubs

None. `bonus_predictor_enabled` defaults `False` correctly per the documented manual-flip enable path. No UI consumer exists in this phase (per plan objective note: `bonus_ev` on `MergedPlayer` is deferred per RESEARCH.md §Open Question 3).

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary schema changes introduced.
- T-053-13 (Spoofing via malformed JSON) is mitigated: `prev.get('summary', {}).get('bonus_predictor_enabled', False)` chain + outer try/except is in place.
- T-053-15 (Permission error on OS read) is mitigated: `OSError` is included in the except tuple.

## Self-Check: PASSED

- `pipeline/accuracy.py` exists: FOUND
- `pipeline/tests/test_accuracy.py` modified: FOUND
- `_read_existing_bonus_predictor_flag` defined in accuracy.py: CONFIRMED (grep count=1 definition, 2 total occurrences)
- `bonus_predictor_enabled` in compute_accuracy_backtest summary: CONFIRMED
- `bonus_predictor_enabled: False` in _empty_backtest: CONFIRMED
- Commit `ac3af72` (RED): FOUND in git log
- Commit `e881da6` (GREEN): FOUND in git log
- 73 pipeline tests pass: CONFIRMED (python -m pytest pipeline/tests/ -q → 73 passed)
- xmins_v2_enabled still present (2 occurrences, unchanged): CONFIRMED
