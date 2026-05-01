---
phase: 47
plan: "03"
subsystem: pipeline
tags:
  - pipeline
  - python
  - cs-probability
  - tdd
dependency_graph:
  requires:
    - "47-01"
  provides:
    - "cs_prob_1gw field in merged_players.json"
  affects:
    - "47-04 (GemTable CS% column reads this field)"
    - "48 (xPts breakdown CS component)"
tech_stack:
  added: []
  patterns:
    - "itertools.groupby(fixtures, key=lambda f: f['event_id']) — DGW-aware grouping, mirrors _xpts_ngw"
    - "Combined DGW CS probability: 1 - prod(1 - p_i)"
key_files:
  created:
    - pipeline/tests/test_merge_cs_prob.py
  modified:
    - pipeline/merge.py
decisions:
  - "cs_prob_1gw delegates entirely to existing _cs_prob() — no duplicate math"
  - "Only the FIRST event_id group is counted for the 1GW window, matching _xpts_ngw semantics"
  - "BGW (empty fixtures) and zero xmins return exactly 0.0 per D-10 contract"
  - "Result rounded to 6 decimal places to keep JSON stable across runs"
  - "Field written immediately after player['xPts_components_1gw'] for co-location with xPts block"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-01"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 47 Plan 03: cs_prob_1gw Pipeline Field Summary

**One-liner:** DGW-aware clean-sheet probability aggregation via `_cs_prob_1gw_for_fixtures()` exposing `cs_prob_1gw` on every merged player record, covering BGW/single/DGW branches with `1-(1-p1)*(1-p2)` formula.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write failing pytest covering cs_prob_1gw branches | e41bbd3 | pipeline/tests/test_merge_cs_prob.py |
| 2 (GREEN) | Implement _cs_prob_1gw_for_fixtures and write cs_prob_1gw | 8a7e102 | pipeline/merge.py |

## What Was Built

### RED Phase (Task 1)

Created `pipeline/tests/test_merge_cs_prob.py` with 7 tests (1 precondition + 6 behavioral):

1. `test_symbol_exists` — precondition: function must be importable
2. `test_regular_gw_single_fixture` — single fixture returns `_cs_prob(dd, xmins)` exactly
3. `test_dgw_combined_probability` — two same-event fixtures return `1-(1-p1)*(1-p2)`
4. `test_bgw_empty_fixtures` — empty fixtures list returns exact `0.0`
5. `test_zero_xmins_injured` — zero xmins returns exact `0.0`
6. `test_multi_gw_only_first_event_group_counts` — 3 fixtures across 3 events: only first event counted
7. `test_dgw_plus_later_gw_only_first_event_group_combined` — DGW event + later event: only DGW combined

Used `getattr` import pattern so the entire file collects and fails deterministically (not a collection-error ImportError) in the RED phase.

### GREEN Phase (Task 2)

Two edits to `pipeline/merge.py`:

**(a)** Added `_cs_prob_1gw_for_fixtures(fixtures, xmins)` at line 141 (immediately after `_cs_prob`):
- Returns `0.0` for empty fixtures or `xmins <= 0`
- Groups by `event_id` using the same `itertools.groupby` semantics as `_xpts_ngw`
- Takes only the FIRST event group for the 1GW window
- Computes combined probability `1 - prod(1 - _cs_prob(dd, xmins))` over that group
- Rounds to 6 decimal places

**(b)** Added `player['cs_prob_1gw'] = _cs_prob_1gw_for_fixtures(player_fixtures, player_xmins)` at line 951, immediately after `player['xPts_components_1gw']`.

## Test Results

- `python -m pytest pipeline/tests/test_merge_cs_prob.py` — 7/7 passed
- `python -m pytest pipeline/tests/` — 33/33 passed (no regressions)

## Deviations from Plan

None — plan executed exactly as written. The test file uses `from merge import ...` (bare name matching conftest.py's sys.path injection) rather than `from pipeline.merge import ...` as the plan pseudocode showed — this is the established pattern in the test suite and is correct for the test environment.

## Known Stubs

None.

## Threat Flags

None — `_cs_prob_1gw_for_fixtures` is a pure function bounded by the existing FIXTURE_LOOKAHEAD cap. No new network surface, auth paths, or schema changes at trust boundaries beyond the planned `cs_prob_1gw` field addition to `merged_players.json`.

## TDD Gate Compliance

- RED gate: commit `e41bbd3` — `test(47-03): add failing tests for cs_prob_1gw aggregation`
- GREEN gate: commit `8a7e102` — `feat(47-03): expose cs_prob_1gw on merged_players output`
- REFACTOR gate: not needed — implementation is minimal and clean

## Self-Check: PASSED

- [x] `pipeline/tests/test_merge_cs_prob.py` exists (107 lines, 7 test functions)
- [x] `pipeline/merge.py` contains exactly 1 definition of `_cs_prob_1gw_for_fixtures` (line 141)
- [x] `pipeline/merge.py` contains exactly 1 `player['cs_prob_1gw']` assignment (line 951)
- [x] `player['cs_prob_1gw']` appears after `player['xPts_components_1gw']` (line 948 → 951)
- [x] Commit `e41bbd3` exists (RED)
- [x] Commit `8a7e102` exists (GREEN)
- [x] No modifications to STATE.md or ROADMAP.md
