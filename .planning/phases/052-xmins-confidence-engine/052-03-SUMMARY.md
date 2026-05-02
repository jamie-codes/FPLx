---
phase: 052
plan: 03
subsystem: pipeline
tags: [python, flag-gate, integration, merge, accuracy, run]
dependency_graph:
  requires: [052-01, 052-02]
  provides: [xmins_v2_enabled flag threading end-to-end, mins_60_prob/sub_risk_label in merged_players.json]
  affects: [pipeline/merge.py, pipeline/run.py, pipeline/accuracy.py]
tech_stack:
  added: []
  patterns: [flag-gate mirroring form_signal_enabled, preserve-on-disk pattern, gated kwarg threading]
key_files:
  created: []
  modified:
    - pipeline/merge.py
    - pipeline/run.py
    - pipeline/accuracy.py
    - pipeline/tests/test_run.py
decisions:
  - Extended _xpts_ngw (intermediary helper) with xmins_v2_enabled/mins_60_prob kwargs to thread flag through to _compute_xpts_fixture without bypassing the abstraction layer
  - Added cache_dir: str = '' parameter to compute_accuracy_backtest so accuracy.py can read existing flag from disk (backward compatible — existing callers pass nothing)
  - Added json/os imports to accuracy.py (were absent; required by _read_existing_xmins_v2_flag helper)
  - xmins_v2_enabled added to _empty_backtest() summary shape for consistency
metrics:
  duration: 12 min
  completed: "2026-05-02"
  tasks_completed: 3
  files_changed: 4
---

# Phase 52 Plan 03: xmins_v2_enabled Flag Threading Summary

**One-liner:** End-to-end flag gate (`xmins_v2_enabled`) threaded from `accuracy_backtest.json` through `run.py` → `merge_players()` → 3 `_cs_prob` call sites; `mins_60_prob` and `sub_risk_label` always written to every player (D-03).

**Status:** Complete
**Wave:** 2

## What was done

- Extended `merge_players()` signature with `xmins_v2_enabled: bool = False` kwarg (backward compatible)
- Extended per-player copy block to write `player['mins_60_prob']` and `player['sub_risk_label']` unconditionally (D-03 — always written so BENCH-01 and MinsRiskBadge tooltip can consume them regardless of flag state)
- Extended `_xpts_ngw`, `_cs_prob_1gw_for_fixtures`, `_compute_xpts_fixture`, and `_compute_xpts_sigma` with `xmins_v2_enabled` and `mins_60_prob` kwargs
- Updated all 3 `_cs_prob` call sites to use gated pattern: `mins_60_prob=mins_60_prob if xmins_v2_enabled else None`
- Updated all callers inside `merge_players()` to pass `xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob`
- Extended `run.py` gate-read block to also read `xmins_v2_enabled` from `accuracy_backtest.json.summary` (mirrors `form_signal_enabled` pattern)
- Added `print(f"xMins v2 ...")` status line to `run.py` stdout
- Passed `xmins_v2_enabled=xmins_v2_enabled` to `merge_players()` call in `run.py`
- Added `_read_existing_xmins_v2_flag(cache_dir)` helper to `accuracy.py` (preserve-on-disk pattern)
- Added `cache_dir: str = ''` parameter to `compute_accuracy_backtest` and passed it from `run.py`
- Added `'xmins_v2_enabled': xmins_v2_enabled` to `accuracy.py` summary dict (after `form_signal_enabled`)
- Added `'xmins_v2_enabled': False` to `_empty_backtest()` for shape consistency
- Added 3 tests to `test_run.py`: default-False when missing, reads-True-from-file, source-level guard

## Verification

- All 60 pipeline tests pass (`python3 -m pytest pipeline/tests/ -q`)
- `merge_players()` accepts `xmins_v2_enabled` kwarg
- Copy block writes both `mins_60_prob` and `sub_risk_label` to every player
- `run.py` reads and propagates the flag (17 occurrences of `xmins_v2_enabled` in merge.py, 5+ in run.py)
- `accuracy.py` writes the flag to summary dict with preserve-on-disk pattern
- `grep -c "mins_60_prob=mins_60_prob if xmins_v2_enabled else None" pipeline/merge.py` returns 3

## Key artifacts

- `pipeline/merge.py`: signature extended, copy block extended, 4 helpers updated (incl. `_xpts_ngw`), 6 callers updated
- `pipeline/run.py`: flag read + print + propagation to `merge_players` + `cache_dir` passed to `compute_accuracy_backtest`
- `pipeline/accuracy.py`: `json`/`os` imports added, `_read_existing_xmins_v2_flag` helper, `cache_dir` param on `compute_accuracy_backtest`, `xmins_v2_enabled` in both main and empty summary dicts
- `pipeline/tests/test_run.py`: 3 new `test_xmins_v2_enabled_*` tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Extended `_xpts_ngw` intermediary with flag kwargs**
- **Found during:** Task 1 Edit 4
- **Issue:** `_xpts_ngw` is an intermediary that calls `_compute_xpts_fixture` — updating only `_compute_xpts_fixture` and the direct callers inside `merge_players()` would leave `_xpts_ngw`'s internal call with `xmins_v2_enabled=False` always. The 3 `_xpts_ngw` calls inside `merge_players()` use the xPts engine (1GW/3GW/5GW windows); they must thread the flag.
- **Fix:** Extended `_xpts_ngw` signature with `xmins_v2_enabled` and `mins_60_prob` kwargs; updated internal `_compute_xpts_fixture` call to pass them through; updated the 3 `_xpts_ngw` callers in `merge_players()` to pass `xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob`.
- **Files modified:** `pipeline/merge.py`

**2. [Rule 2 - Missing critical functionality] Added `cache_dir` parameter to `compute_accuracy_backtest`**
- **Found during:** Task 3
- **Issue:** `compute_accuracy_backtest` had no `cache_dir` parameter, so `_read_existing_xmins_v2_flag(cache_dir)` could not be called within it. Plan noted this contingency: "If not, you'll need to find where `accuracy_backtest.json` is written and pass the directory appropriately."
- **Fix:** Added `cache_dir: str = ''` as optional parameter (defaults empty → helper returns False on cold start). Updated `run.py` call to pass `cache_dir=cache_dir`.
- **Files modified:** `pipeline/accuracy.py`, `pipeline/run.py`

**3. [Rule 2 - Missing critical functionality] Added `json`/`os` imports and `xmins_v2_enabled` to `_empty_backtest()`**
- **Found during:** Task 3
- **Issue:** `accuracy.py` docstring claimed "No HTTP calls, no file I/O" and had no `os`/`json` imports. The helper requires both. Also `_empty_backtest()` lacked the new key, making the shape inconsistent between empty and populated backtest dicts.
- **Fix:** Added `import json` and `import os` at top. Added `'xmins_v2_enabled': False` to `_empty_backtest()` summary.
- **Files modified:** `pipeline/accuracy.py`

## Known Stubs

None — all new fields (`mins_60_prob`, `sub_risk_label`) are populated from `xmins_stats` which is produced by `_compute_player_xmins` (Plan 01). The `xmins_v2_enabled` flag is gated off by default; this is intentional (D-02 — flip after 5-GW shadow run).

## Threat Flags

None — threat mitigations T-052-11 through T-052-16 are all implemented:
- `bool()` coercion on flag read (T-052-12)
- try/except on file read with OSError (T-052-15)
- print statement in run.py for audit (T-052-13)
- Default False on cold start (T-052-11, T-052-16)

## Self-Check: PASSED

- `pipeline/merge.py` modified: confirmed (74413ba)
- `pipeline/run.py` modified: confirmed (4e42b1f, 79eb7d8)
- `pipeline/accuracy.py` modified: confirmed (79eb7d8)
- `pipeline/tests/test_run.py` modified: confirmed (4e42b1f)
- All 60 tests pass
- `grep -c "mins_60_prob=mins_60_prob if xmins_v2_enabled else None" pipeline/merge.py` = 3
- `grep -q "xmins_v2_enabled: bool = False" pipeline/merge.py` succeeds
- `grep -q "'xmins_v2_enabled': xmins_v2_enabled" pipeline/accuracy.py` succeeds
- `grep -q "def test_xmins_v2_enabled" pipeline/tests/test_run.py` succeeds
