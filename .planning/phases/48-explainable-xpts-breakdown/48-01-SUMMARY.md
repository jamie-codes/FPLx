---
phase: 48-explainable-xpts-breakdown
plan: "01"
subsystem: pipeline
tags: [xpts, pipeline, appearance-pts, tdd, sum-invariant]
dependency_graph:
  requires: []
  provides: [appearance_pts-in-pipeline, xpts-sum-invariant]
  affects: [merged_players.json, xPts_components_1gw, xPts_1gw values]
tech_stack:
  added: []
  patterns: [pytest-tdd-red-green, python-dict-extension]
key_files:
  created:
    - pipeline/tests/test_merge_xpts_components.py
  modified:
    - pipeline/merge.py
decisions:
  - "appearance_pts = start_prob × 2 (D-01): FPL awards 2pts for starting, NOT scaled by xmins/90"
  - "appearance_pts added to total in _compute_xpts_fixture so sum invariant holds without UI-side arithmetic"
  - "guard return at line 203 extended with appearance_pts: 0.0 to prevent KeyError in DGW accumulation loop"
metrics:
  duration: "95 seconds"
  completed: "2026-05-01"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 48 Plan 01: appearance_pts Pipeline Extension Summary

**One-liner:** Added `appearance_pts = start_prob × 2` as explicit scored component in `_compute_xpts_fixture`, satisfying the XPT-02 sum invariant so component breakdowns sum to headline `xPts_1gw`.

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Write RED tests for appearance_pts pipeline extension | TDD RED | caba788 | pipeline/tests/test_merge_xpts_components.py |
| 2 | Extend pipeline to make tests GREEN | TDD GREEN | 5490a03 | pipeline/merge.py |

## What Was Built

Extended `pipeline/merge.py` with `appearance_pts` as an explicit xPts component:

- `_compute_xpts_fixture` guard return (line 203): added `appearance_pts: 0.0` so DGW accumulation loop never hits `KeyError`
- `_compute_xpts_fixture` computation: `appearance_pts = start_prob * 2` (D-01 formula — FPL 2pt appearance bonus, not minute-scaled)
- `_compute_xpts_fixture` total: changed to `goal_pts + assist_pts + cs_pts + bonus_pts + appearance_pts` (XPT-02 invariant)
- `_compute_xpts_fixture` return dict: added `'appearance_pts': round(appearance_pts, 3)`
- `_xpts_ngw` accumulator: extended `first_gw_components` to include `'appearance_pts': 0.0`; the `for k in first_gw_components` loop picks it up automatically for DGW fixtures

Created `pipeline/tests/test_merge_xpts_components.py` with 4 tests (TDD RED→GREEN):
- `test_symbol_exists`: import precondition
- `test_xpts_components_sum_to_total_single_fixture`: XPT-02 sum invariant for single fixture
- `test_xpts_components_sum_to_total_dgw`: XPT-02 / D-05 sum invariant for DGW (two fixtures same event)
- `test_appearance_pts_formula`: D-01 formula verification (`start_prob × 2`)

## Verification

- `python -m pytest pipeline/tests/test_merge_xpts_components.py -q`: **4 passed**
- `python -m pytest pipeline/tests/ -q`: **37 passed** (no regressions from 33 prior tests)
- `grep -c "appearance_pts" pipeline/merge.py`: **5 occurrences** (guard return, computation, `appearance_pts = ...`, total line, normal return, accumulator init)

## TDD Gate Compliance

- RED gate: `test(48-01)` commit `caba788` — 2 tests failing with `KeyError: 'appearance_pts'`
- GREEN gate: `feat(48-01)` commit `5490a03` — all 4 tests passing
- REFACTOR gate: no cleanup needed; changes are minimal and clean

## Impact on xPts Values (Model Change)

Adding `appearance_pts` to `total` changes all players' `xPts_1gw` by `start_prob × 2`:
- Nailed starter (start_prob=1.0): +2.0 pts per fixture
- Likely starter (start_prob=0.75): +1.5 pts per fixture
- Rotation risk (start_prob=0.5): +1.0 pts per fixture
- DGW nailed starter: +4.0 pts total (2 × 2 pts)

This is intentional per D-01. Rankings by xPts are approximately preserved since all players shift upward similarly. The `xPts_components_1gw` breakdown now carries `appearance_pts` in `merged_players.json`, ready for Plans 48-02 and 48-03 to consume.

## Deviations from Plan

None — plan executed exactly as written. All 4 edits to `merge.py` applied as specified.

## Known Stubs

None — `appearance_pts` is wired end-to-end in the pipeline. Plans 48-02 and 48-03 extend the TypeScript type and UI hover card respectively.

## Self-Check: PASSED

- [x] `pipeline/tests/test_merge_xpts_components.py` exists with 4 tests
- [x] All 4 tests pass green
- [x] Full pipeline test suite passes (37 tests)
- [x] `pipeline/merge.py` contains `appearance_pts` in guard return, computation, normal return, and first_gw_components initialiser
- [x] `appearance_pts = start_prob * 2` (not scaled by xmins/90)
- [x] `total = goal_pts + assist_pts + cs_pts + bonus_pts + appearance_pts`
- [x] Commits `caba788` (RED) and `5490a03` (GREEN) exist in git log
