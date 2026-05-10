---
phase: 90-monte-carlo-simulation-pipeline
plan: 03
subsystem: pipeline
tags: [monte-carlo, pipeline, accuracy, gate, cold-start, phase-90, tdd]

# Dependency graph
requires:
  - phase: 90-01
    provides: Wave 0 RED tests + MergedPlayer types
  - phase: 90-02
    provides: simulate.py 5-GW extension + run.py mc_enabled gate (parallel Wave 1 Plan A)
provides:
  - _read_existing_mc_enabled_flag helper in pipeline/accuracy.py
  - mc_enabled gate plumbing in compute_accuracy_backtest (summary + version gate_flags)
  - mc_enabled cold-start preservation in _empty_backtest (summary + version gate_flags)
  - test_accuracy_mc_enabled_cold_start in pipeline/tests/test_simulate.py
affects:
  - accuracy_backtest.json shape (mc_enabled key added to summary + gate_flags)
  - plan 90-02 run.py gate reads mc_enabled FROM accuracy_backtest.json (written here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Gate flag read-and-preserve pattern (mirrors _read_existing_save_predictor_flag exactly)
    - Cold-start warm-start preservation via _empty_backtest + _read_existing_cache
    - Version-record gate_flags parity across both main and cold-start write paths

key-files:
  created: []
  modified:
    - pipeline/accuracy.py
    - pipeline/tests/test_simulate.py

key-decisions:
  - "mc_enabled added in both main compute_accuracy_backtest path AND _empty_backtest cold-start path for full parity (T-90-04)"
  - "_read_existing_mc_enabled_flag helper preserved as standalone function (mirrors the three existing save/xmins/bonus helpers exactly) for callers that may use it directly"
  - "mc_enabled placed after save_predictor_enabled and before news_flag_enabled in both summary dicts to maintain chronological phase ordering"

requirements-completed: [MC-01]

# Metrics
duration: 18min
completed: 2026-05-10
---

# Phase 90 Plan 03: mc_enabled Gate Plumbing in accuracy.py — Wave 1 Plan B

**mc_enabled gate preservation added to pipeline/accuracy.py in 5 insertions; one cold-start pytest case verifies False-default and True-preservation semantics**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-10T12:00:00Z
- **Completed:** 2026-05-10T12:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `_read_existing_mc_enabled_flag` helper to `pipeline/accuracy.py` — mirrors `_read_existing_save_predictor_flag` exactly with `'mc_enabled'` key and Phase 90 MC-01 docstring
- Added `mc_enabled = bool(prior_cache.get('summary', {}).get('mc_enabled', False))` read in both `compute_accuracy_backtest` and `_empty_backtest` — derives from `_read_existing_cache` (WR-02 pattern: single file open per run)
- Added `'mc_enabled': mc_enabled` to the main summary dict in `compute_accuracy_backtest` return (after `save_predictor_enabled`, before `news_flag_enabled`)
- Added `'mc_enabled': mc_enabled` to the version-record `gate_flags` dict in both `compute_accuracy_backtest` and `_empty_backtest` — ensures parity between the two write paths (T-90-04 mitigation)
- Added `test_accuracy_mc_enabled_cold_start` to `pipeline/tests/test_simulate.py` — verifies cold start writes `mc_enabled=False`, warm start preserves `mc_enabled=True`, and `_read_existing_mc_enabled_flag` mirrors both behaviours; version-record gate_flags parity also asserted
- Total tests in `test_simulate.py`: 12 (5 Phase 61 + 6 Plan 01 + 1 Plan 03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mc_enabled gate plumbing to pipeline/accuracy.py** — `2d20e76` (feat)
2. **Task 2: Add cold-start pytest case to pipeline/tests/test_simulate.py** — `b4dabd0` (test)

## Files Created/Modified

- `pipeline/accuracy.py` — 5 insertions: new `_read_existing_mc_enabled_flag` helper; `mc_enabled` read in `compute_accuracy_backtest`; `mc_enabled` in main summary dict; `mc_enabled` in main version gate_flags; `mc_enabled` read + summary + gate_flags in `_empty_backtest`
- `pipeline/tests/test_simulate.py` — 1 new test function `test_accuracy_mc_enabled_cold_start` appended at end of file

## Decisions Made

- Plan 01 Wave 0 RED tests (tests 6-11 in test_simulate.py) remain failing — they require Plan 02 changes to `simulate.py` and `run.py` which are running in parallel; this is expected and documented in the plan specification
- `mc_enabled` read placed in both `compute_accuracy_backtest` (via `prior_cache`) and `_empty_backtest` (via `prior_cache`) independently rather than calling `_read_existing_mc_enabled_flag` — mirrors the existing pattern exactly (xmins/bonus/save flags all use `prior_cache.get()` directly in both functions rather than calling their helpers)
- Merged `main` into worktree at execution start to incorporate Plan 01 commits (00f0817 + a2e2dab merged via 18aafdf) — worktree was created before Plan 01 ran

## Deviations from Plan

**[Rule 3 - Blocking] Merged main branch into worktree to get Plan 01 changes**
- **Found during:** Execution start
- **Issue:** The worktree was branched from `f086deb` (Phase 89 completion) before Plan 01 ran. `pipeline/tests/test_simulate.py` only had 5 tests; Plan 01's 6 RED tests were absent.
- **Fix:** `git merge main --no-edit` fast-forwarded to `18aafdf` (the Plan 01 merge commit), providing the 11-test baseline this plan builds on.
- **Files modified:** None (merge only; no content conflicts)

## Issues Encountered

None. The `test_accuracy_mc_enabled_cold_start` test passed on first run without iteration.

## Known Stubs

None — all insertions are functional gate-preservation logic with no placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. All changes are pure Python with local filesystem reads (accuracy_backtest.json) guarded by the existing `(FileNotFoundError, json.JSONDecodeError, OSError)` exception pattern.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan 02 (`simulate.py` + `run.py` implementation) can now be merged. After merge:
- `test_mc_enabled_off_skip` will pass (run.py has the `mc_enabled` gate read + `if mc_enabled:` guard)
- `test_5gw_percentile_invariants`, `test_5gw_bgw_zero_fill`, `test_5gw_dgw_combine`, `test_iteration_count_gate`, `test_seed_determinism` will all pass (simulate.py has 5-GW extension + env-var constants)
- Full 12-test suite in `test_simulate.py` will be GREEN

---
*Phase: 90-monte-carlo-simulation-pipeline*
*Completed: 2026-05-10*
