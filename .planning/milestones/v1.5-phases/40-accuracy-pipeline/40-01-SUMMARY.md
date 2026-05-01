---
phase: 40
plan: "01"
subsystem: pipeline/tests
tags:
  - python
  - pytest
  - accuracy
  - backtest
  - tdd
  - wave-0
dependency_graph:
  requires: []
  provides:
    - pipeline/tests/ pytest package with conftest sys.path injection
    - Seven RED unit tests pinning contract for pipeline/accuracy.py (Plan 02)
  affects:
    - pipeline/accuracy.py (Plan 02 must make these tests GREEN)
tech_stack:
  added: []
  patterns:
    - pytest package discovery via __init__.py + conftest.py
    - sys.path.insert mirroring run.py import style
    - Wave 0 TDD RED gate: tests exist before implementation
key_files:
  created:
    - pipeline/tests/__init__.py
    - pipeline/tests/conftest.py
    - pipeline/tests/test_accuracy.py
  modified: []
decisions:
  - conftest PIPELINE_DIR resolves to pipeline/ (parent of tests/) matching run.py line 8 pattern
  - No pytest.ini or pyproject.toml introduced per VALIDATION.md "Config file: None"
  - pipeline/__init__.py NOT created; pipeline/ remains a non-package to match production import style
metrics:
  duration: "1m 51s"
  completed: "2026-04-29"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 40 Plan 01: Test Scaffold (Wave 0 RED Gate) Summary

Pytest package under `pipeline/tests/` created with `conftest.py` injecting `pipeline/` onto sys.path, plus seven failing unit tests in `test_accuracy.py` that pin the contract for `pipeline/accuracy.py` (created in Plan 02). All seven tests produce `ModuleNotFoundError: No module named 'accuracy'` — Wave 0 RED gate satisfied per VALIDATION.md.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create pipeline/tests package with conftest.py | 88edd2e | pipeline/tests/__init__.py, pipeline/tests/conftest.py |
| 2 | Write seven RED unit tests | 66cc578 | pipeline/tests/test_accuracy.py |

## Verification Results

| Check | Result |
|-------|--------|
| `pipeline/tests/__init__.py` exists | PASS |
| `conftest.py` contains `sys.path.insert` and `PIPELINE_DIR` | PASS |
| `grep -c "^def test_" test_accuracy.py` == 7 | PASS |
| Valid Python via `ast.parse` | PASS |
| `python -m pytest ... -x` exits non-zero (exit code 2) | PASS |
| ModuleNotFoundError on `accuracy` in pytest output | PASS |
| No `pipeline/__init__.py` created | PASS |

## Seven Test Functions (RED State)

1. `test_backtest_structure` — D-08 top-level keys (`generated_at`, `gws_covered`, `summary`, `haulters`, `players`) and last-5-GW coverage
2. `test_haulter_detection` — D-09 threshold: `total_points >= 10` fires haulter; `total_points < 10` does not
3. `test_hit_rate_computation` — D-10: `xpts_hit_rate = xpts_flagged / haulter_count`, bounded [0, 1]
4. `test_xpts_reconstruction` — D-02/D-03/D-04: reconstructed xPts in sane bounds (0, 20)
5. `test_proj_pts_reconstruction` — D-05/D-06: rolling PPG × difficulty_modifier; expects ≈ 4.5 for constant-6-pt player at difficulty 3
6. `test_dgw_aggregation` — DGW: two history entries for same round sum to one aggregated backtest entry
7. `test_snapshot_format` — D-12: `build_predictions_snapshot` returns `{gw, run_at, players}` shape exactly

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. This plan creates test scaffolding only; no implementation code with stub values.

## Threat Flags

None. Tests use synthetic in-memory fixtures only; no network I/O, no real player data, no file writes.

## Self-Check: PASSED

- `pipeline/tests/__init__.py` exists: confirmed
- `pipeline/tests/conftest.py` exists: confirmed
- `pipeline/tests/test_accuracy.py` exists: confirmed
- Commit 88edd2e exists: confirmed (Task 1)
- Commit 66cc578 exists: confirmed (Task 2)
- All 7 test functions present: confirmed
- RED state (exit code 2): confirmed
