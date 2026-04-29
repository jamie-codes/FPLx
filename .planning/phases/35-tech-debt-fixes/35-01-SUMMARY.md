---
phase: 35-tech-debt-fixes
plan: 01
status: complete
completed: "2026-04-29"
---

# Plan 35-01 Summary: Python pipeline tech-debt fixes

## What was built

Four correctness fixes to the Python pipeline backend — no new behaviour, audit compliance only.

## Affects

- `pipeline/merge.py`
- `pipeline/insights.py`
- `pipeline/upload.py`

## Fixes applied

- **WR-02**: Exclude BGW players (`xPts_1gw=0` or `None`) from the TRAP position-median build loop. Previously, blank-gameweek players were folded in as `0.0`, artificially depressing the median and causing false TRAP flags for the rest of the squad.
- **WR-03**: Change TRAP gate predicate from `not above_median` (catches `<= median`) to strict `xpts_1gw < position_median`, so exactly-median players are no longer flagged as template traps.
- **WR-05**: Wrap all four `out.append()` blocks in `_player_patterns` (buy, sell, diff, trap) with `if sample_n_X > 0:` guards. Zero-count insight strings ("0 of N regular starters carry a BUY signal") are trivially true and are excluded by INS-04 — they should never be emitted.
- **WR-06**: Fix `upload_json` signature from `data: dict` to `data: list | dict`. The insights payload is a list; the old annotation was incorrect and violated the type contract.

## Self-Check: PASSED

- `python -c "from pipeline.merge import _compute_differential_flag; assert _compute_differential_flag(5.0, '10', 'a', 5.0) is None; assert _compute_differential_flag(4.9, '20', 'a', 5.0) == 'trap'"` ✓
- `grep -c "if sample_n_" pipeline/insights.py` → 4 ✓
- `grep -n "data: list | dict" pipeline/upload.py` → 1 match ✓
- `python -c "from pipeline.merge import _compute_differential_flag; from pipeline.insights import _player_patterns; from pipeline.upload import upload_json; print('all imports OK')"` ✓
- `grep -n "not above_median\|above_median" pipeline/merge.py` → 0 matches ✓

## Key files

- `pipeline/merge.py` — `_compute_differential_flag` + median build loop
- `pipeline/insights.py` — `_player_patterns` (four guarded append blocks)
- `pipeline/upload.py` — `upload_json` signature

## Notable deviations

None — all changes exactly as specified in plan.
