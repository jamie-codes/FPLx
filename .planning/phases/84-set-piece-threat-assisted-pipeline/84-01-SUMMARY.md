---
phase: 84
plan: 01
subsystem: pipeline
tags: [pipeline, python, pytest, scrape, understat, set-pieces, eb-shrinkage, tdd]
dependency_graph:
  requires: [pipeline/understat_client.py, pipeline/bonus.py, pipeline/upload.py]
  provides: [pipeline/set_piece_quality.py, pipeline/cache/sp_quality.json]
  affects: [pipeline/run.py]
tech_stack:
  added: []
  patterns: [eb-shrinkage, 24h-disk-cache, try-except-isolation, bare-import-test]
key_files:
  created:
    - pipeline/set_piece_quality.py
    - pipeline/tests/test_set_piece_quality.py
  modified:
    - pipeline/run.py
decisions:
  - "[84-01] SHRINKAGE_K=20 (not k=12 like bonus.py) per SPQ-02 spec; intentional divergence"
  - "[84-01] Single combined sp_shots_cache.json for all teams (not per-team files) per D-03 Claude's Discretion"
  - "[84-01] sp_unmatched_count=None initialised BEFORE try block per D-05/Pitfall 2; avoids false 0 on failure"
  - "[84-01] compute_data_health() call in run.py left unchanged; Plan 02 adds sp_unmatched_count kwarg after data_health.py adds the matching parameter"
metrics:
  duration: ~3 minutes
  completed: 2026-05-09
  tasks_completed: 3
  files_changed: 3
---

# Phase 84 Plan 01: Set-Piece Threat Assisted Pipeline — SPQ Module Summary

**One-liner:** Understat shot scrape, FromCorner/DirectFreekick aggregation by deliverer (Pitfall 1), EB shrinkage k=20, sp_quality.json writer with 24h disk cache and try/except isolation in run.py.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write pytest test file (RED gate) | a494d5f | pipeline/tests/test_set_piece_quality.py |
| 2 | Create set_piece_quality.py module (GREEN gate) | 57dc9bb | pipeline/set_piece_quality.py |
| 3 | Wire run.py try/except isolation | e973264 | pipeline/run.py |

## TDD Gate Compliance

- RED gate (a494d5f): 12 test functions written; collection failed with `ModuleNotFoundError: No module named 'set_piece_quality'` (confirmed).
- GREEN gate (57dc9bb): all 12 tests pass; full suite 168/168.
- REFACTOR: no cleanup needed; implementation matched spec exactly.

## Pytest Counts

- Existing tests: 156
- New tests: 12 (test_set_piece_quality.py)
- Total after Plan 01: **168 passed**

## Key Implementation Details

### set_piece_quality.py

Module constants: `SHRINKAGE_K=20`, `CORNER_SITUATION='FromCorner'`, `FK_SITUATION='DirectFreekick'`, `CORNER_MIN_N=5`, `FK_MIN_N=3`, `REQUEST_PACING_SECONDS=0.5`

Public API: `run_sp_quality(understat_data: dict, id_map: dict, cache_dir: str) -> int | None`
- Returns unmatched Understat ID count on success, None on failure (sp_quality.json stale file preserved per D-07)

Critical invariant (Pitfall 1 guard): `_aggregate_shots()` groups by `player_assisted_id` (deliverer) NOT `player_id` (shooter). Tested by `test_only_corner_and_fk_counted` and `test_aggregates_by_deliverer_not_shooter`.

All `open()` calls pass `encoding='utf-8'` (4 instances, Pitfall 3 guard).

### run.py insertion point

Block inserted between:
- Line 228: `timestamps['merged_players.json'] = _dt_dh.now(_tz_dh.utc).isoformat()` (rotation_risk re-save)
- Line 248: `# Phase 33 INS-02/03/04 — pattern statements with confidence weights`

`sp_unmatched_count = None` is at run.py line 237 (confirmed between GWI-01 at 225 and INS-02 at 248).

### compute_data_health() call site (for Plan 02 handoff)

The existing call at run.py line 414 is UNCHANGED:
```python
compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False)
```
Plan 02 must replace this with:
```python
compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False,
                    sp_unmatched_count=sp_unmatched_count)
```
after extending `data_health.py` with `sp_unmatched_count: int | None = None` parameter.

### sp_quality.json structure (for Phase 85 consumer)

```json
{
  "233": {
    "corner_danger_score": 0.142,
    "fk_danger_score": null,
    "delivery_quality_rank": 0.138,
    "sp_sample_n": 7,
    "understat_id": 9876
  }
}
```
Keyed by FPL player ID string. `corner_danger_score` null when n_corner < 5; `fk_danger_score` null when n_fk < 3; `delivery_quality_rank` null when both are null.

## Verification Results

All plan verification checks pass:
- `python -m pytest pipeline/tests/test_set_piece_quality.py -q` — 12 passed
- `python -m pytest pipeline/tests/ -q` — 168 passed
- `python -c "import ast; ast.parse(open('pipeline/run.py', encoding='utf-8').read())"` — OK
- `grep -c "from set_piece_quality import run_sp_quality" pipeline/run.py` — 1
- `grep -c "^SHRINKAGE_K = 20" pipeline/set_piece_quality.py` — 1
- `grep -v '^#' pipeline/set_piece_quality.py | grep -c "player_assisted_id"` — 6
- `grep -c "lambda_opp / 3" pipeline/set_piece_quality.py` — 0 (no Phase 83 leak)
- `grep -v '^#' pipeline/set_piece_quality.py | grep -c "encoding='utf-8'"` — 4

## Deviations from Plan

None — plan executed exactly as written. The test file contains 12 test functions (plan specified 11); the extra `test_xg_string_coerced_to_float` was included in the plan's provided content block, so it was intentionally included.

## Known Stubs

None.

## Threat Flags

None — all trust boundary mitigations from the plan's threat model are implemented:
- T-84-01-01/02: float/int coercion with try/except in `_aggregate_shots()`
- T-84-01-03: run.py try/except isolation; run_sp_quality internal try/except; D-07 stale file preservation
- T-84-01-04: `_is_sp_cache_fresh()` wraps json.load in try/except, returns False on corrupt JSON
- T-84-01-05: `_parse_shots()` returns [] when shotsData not found

## Self-Check

File existence:
- pipeline/set_piece_quality.py: FOUND
- pipeline/tests/test_set_piece_quality.py: FOUND

Commits:
- a494d5f: FOUND (test RED gate)
- 57dc9bb: FOUND (feat GREEN gate)
- e973264: FOUND (feat run.py wiring)

## Self-Check: PASSED
