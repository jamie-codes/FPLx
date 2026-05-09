---
phase: 84
plan: 02
subsystem: pipeline
tags: [pipeline, python, pytest, data-health, sanity-checks, spq-02, tdd]
dependency_graph:
  requires: [pipeline/set_piece_quality.py, pipeline/run.py (Plan 01 sp_unmatched_count var)]
  provides: [pipeline/data_health.py (sp_unmatched_count kwarg), pipeline/cache/data_health.json (5th sanity check)]
  affects: [pipeline/run.py]
tech_stack:
  added: []
  patterns: [tdd-red-green, kwargs-default-none, conditional-append]
key_files:
  created: []
  modified:
    - pipeline/data_health.py
    - pipeline/tests/test_data_health.py
    - pipeline/run.py
decisions:
  - "[84-02] sp_unmatched_count=None default preserves existing 4-entry sanity_checks list (D-05/Pitfall 6) — existing test_compute_data_health_shape with assert len==4 passes unchanged"
  - "[84-02] _check_sp_unmatched thresholds mirror _check_missing_delta exactly: ok 0-5, warn 6-20, error >20 (D-04)"
  - "[84-02] Conditional append (if sp_unmatched_count is not None) placed AFTER sanity_checks list construction — minimal surgical edit per plan spec"
metrics:
  duration: ~4 minutes
  completed: 2026-05-09
  tasks_completed: 3
  files_changed: 3
---

# Phase 84 Plan 02: Set-Piece Threat Assisted Pipeline — Data Health Extension Summary

**One-liner:** sp_unmatched_count kwarg added to compute_data_health() with _check_sp_unmatched() helper (ok 0-5/warn 6-20/error >20); run.py call site threads the Plan 01 local variable; SPQ-02 data-health visibility requirement fully met.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write 5 new pytest cases (RED gate) | 1d90145 | pipeline/tests/test_data_health.py |
| 2 | Extend data_health.py with kwarg + helper (GREEN gate) | 8524e12 | pipeline/data_health.py |
| 3 | Update run.py compute_data_health() call site | a96d9d8 | pipeline/run.py |

## TDD Gate Compliance

- RED gate (1d90145): 5 test functions appended; 12 passed (11 existing + 1 negative case), 4 failed with `TypeError: compute_data_health() got an unexpected keyword argument 'sp_unmatched_count'` (confirmed).
- GREEN gate (8524e12): all 16 test_data_health.py tests pass; full suite 173/173.
- REFACTOR: no cleanup needed; implementation matched spec exactly.

## Pytest Counts

| File | Tests |
|------|-------|
| test_data_health.py | 16 (11 pre-existing + 5 new) |
| test_set_piece_quality.py | 12 (Plan 01 — unchanged) |
| All other pipeline tests | 145 (unchanged) |
| **Total** | **173 passed** |

## Key Implementation Details

### data_health.py changes

**New helper** (inserted before compute_data_health definition, after _check_pipeline_stale):
```python
def _check_sp_unmatched(count: int) -> dict:
    if count <= 5:
        status = 'ok'
    elif count <= 20:
        status = 'warn'
    else:
        status = 'error'
    return {'id': 'sp_unmatched_ids', 'status': status, 'value': count, 'threshold': '<= 5'}
```

**Signature extension** (sp_unmatched_count added as last kwarg):
```python
def compute_data_health(
    merged: list,
    timestamps: dict,
    cache_dir: str,
    pipeline_stale: bool = False,
    sp_unmatched_count: int | None = None,
) -> dict:
```

**Conditional append** (placed after existing 4-entry list, before result dict):
```python
if sp_unmatched_count is not None:
    sanity_checks.append(_check_sp_unmatched(sp_unmatched_count))
```

### run.py change (final form for future phases)

The compute_data_health() call at run.py line ~414 now reads:
```python
compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False,
                    sp_unmatched_count=sp_unmatched_count)
```

The `sp_unmatched_count` local variable was introduced by Plan 01 at run.py line 237:
```python
sp_unmatched_count = None  # initialized before try block
try:
    from set_piece_quality import run_sp_quality
    sp_unmatched_count = run_sp_quality(understat, id_map, cache_dir)
    ...
```

Both variables are inside the same top-level `try:` block in `main()` (run.py:139), so the kwarg reference is always in scope at the call site.

## Backward Compatibility

`test_compute_data_health_shape` (Phase 82 contract) asserts `len(result['sanity_checks']) == 4`. This test continues passing because the new kwarg defaults to None, leaving the list at 4 entries when sp_unmatched_count is not passed. The existing Phase 82 test suite is fully preserved.

## Verification Results

All plan verification checks pass:
- `python -m pytest pipeline/tests/test_data_health.py -q` — 16 passed
- `python -m pytest pipeline/tests/ -q` — 173 passed
- `python -c "import ast; ast.parse(open('pipeline/run.py', encoding='utf-8').read())"` — OK
- `grep -c "sp_unmatched_count=sp_unmatched_count" pipeline/run.py` — 1
- `grep -c "^def _check_sp_unmatched(" pipeline/data_health.py` — 1
- `grep -c "sp_unmatched_count: int | None = None" pipeline/data_health.py` — 1
- `grep -c "if sp_unmatched_count is not None:" pipeline/data_health.py` — 1
- `python -m pytest pipeline/tests/test_data_health.py::test_compute_data_health_shape -q` — 1 passed

## Deviations from Plan

None — plan executed exactly as written. The test_set_piece_quality.py count is 12 (not 11 as the plan's acceptance criteria mention); this is a carry-forward from Plan 01 which added 12 tests (documented in 84-01-SUMMARY.md as an intentional inclusion).

## Known Stubs

None.

## Threat Flags

None — all STRIDE threat mitigations from the plan's threat model are implemented:
- T-84-02-01: Threshold lock-down via test_sp_unmatched_threshold_ok/warn/error_boundary
- T-84-02-02: False "ok" on scrape failure prevented by D-05 None guard; test_sp_unmatched_check_omitted_when_none asserts this
- T-84-02-03: Existing test_compute_data_health_shape still passes (len==4 default preserved)
- T-84-02-04: Value field is a bounded int with no PII — accepted
- T-84-02-05: _check_sp_unmatched is O(1) — no allocation risk

## Note for /gsd-verify-work

Phase verification should run `python -m pytest pipeline/tests/ -q` and confirm:
- 173 tests pass (zero regressions versus pre-Phase-84 baseline of 156 tests)
- test_data_health.py: 16 passed
- test_set_piece_quality.py: 12 passed

## Self-Check

File checks:
- pipeline/data_health.py: FOUND
- pipeline/tests/test_data_health.py: FOUND

Commits:
- 1d90145: FOUND (test RED gate)
- 8524e12: FOUND (feat GREEN gate)
- a96d9d8: FOUND (feat run.py call site)

## Self-Check: PASSED
