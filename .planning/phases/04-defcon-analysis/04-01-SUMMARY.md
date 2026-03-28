---
phase: 04-defcon-analysis
plan: "01"
subsystem: pipeline + types
tags: [bug-fix, pipeline, defcon, types, python]
dependency_graph:
  requires: []
  provides: [defensive_contribution-field-fix, DefConPlayer-type, defcon-stats-pipeline]
  affects: [src/lib/types.ts, src/lib/fpl-adapter.ts, pipeline/merge.py, pipeline/defcon.py, pipeline/run.py]
tech_stack:
  added: []
  patterns: [element-summary-batch-fetch, fixture-correlation-bucketing, difficulty-scores-extraction]
key_files:
  created:
    - pipeline/defcon.py
  modified:
    - src/lib/types.ts
    - src/lib/fpl-adapter.ts
    - pipeline/merge.py
    - pipeline/run.py
    - tests/fixtures/bootstrap-static-sample.json
    - tests/lib/fpl-adapter.test.ts
    - tests/lib/gem-score.test.ts
decisions:
  - "_compute_difficulty_scores extracted with (bootstrap, fixtures) signature — plan showed bootstrap-only but fixtures are required for rolling xGA computation"
  - "DefConPlayer fixture_correlation stored as summary object (not raw match history) to keep defcon_stats.json size manageable"
metrics:
  duration: 4 minutes
  completed: 2026-03-28
  tasks_completed: 2
  files_modified: 7
---

# Phase 4 Plan 1: Fix defensive_contribution Bug + DefCon Pipeline Summary

**One-liner:** Fixed defensive_contribution field name bug across 5 files (singular not plural), extracted difficulty score computation, and created pipeline/defcon.py computing per-match hit rates, avg_per90, distance_to_threshold, and fixture_correlation per DEF/MID/FWD player.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix defensive_contribution field name bug and add DefConPlayer type | faa2a55 | src/lib/types.ts, src/lib/fpl-adapter.ts, pipeline/merge.py, tests/fixtures/bootstrap-static-sample.json, tests/lib/fpl-adapter.test.ts |
| 2 | Create pipeline/defcon.py and integrate into run.py | c2d85d0 | pipeline/defcon.py, pipeline/run.py, pipeline/merge.py, tests/lib/gem-score.test.ts |

## What Was Built

### Task 1: Field Name Bug Fix

- `src/lib/types.ts`: Renamed `defensive_contributions` → `defensive_contribution` in `FPLElement` (line 19) and `MergedPlayer` (line 95). Added `defensive_contribution_per_90: number | null` to `FPLElement`. Added new `DefConPlayer` interface with all fields required by the DefCon UI plans.
- `src/lib/fpl-adapter.ts`: Fixed Zod schema — `defensive_contribution` (singular) + `defensive_contribution_per_90` (float, not `.int()`).
- `pipeline/merge.py`: Fixed `element.get('defensive_contributions')` → `element.get('defensive_contribution')` in the merge output dict.
- `tests/fixtures/bootstrap-static-sample.json`: Renamed all three elements' `defensive_contributions` → `defensive_contribution`, added `defensive_contribution_per_90` (Magalhaes=2.33, Saka=0.29, Wissa=0.41).
- `tests/lib/fpl-adapter.test.ts`: Updated test name and assertions to use singular field name.

### Task 2: DefCon Pipeline

- `pipeline/defcon.py` (new, 96 lines): Implements `compute_defcon_stats(bootstrap, difficulty_scores)` — iterates DEF/MID/FWD players with `starts > 0`, calls `get_element_summary()` per player with try/except skip on failure, filters history to `minutes > 0`, computes hit rate per-match against threshold, and calls `_compute_fixture_correlation()`. Also implements `_compute_fixture_correlation()` splitting games into easy (<0.4) and hard (>0.6) difficulty buckets with `insufficient_data: True` when either bucket has <5 games.
- `pipeline/merge.py`: Extracted `_compute_difficulty_scores(bootstrap, fixtures) -> dict[int, float]` as a standalone top-level function. The existing inline code in `merge_players` is left intact (duplicate for backward compatibility), and the new function is available for import by `defcon.py` via `run.py`.
- `pipeline/run.py`: Added `from defcon import compute_defcon_stats` import and DefCon step after `merged_players.json` save — calls `_compute_difficulty_scores`, then `compute_defcon_stats`, writes `defcon_stats.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed defensive_contributions plural in gem-score.test.ts**
- **Found during:** Task 2 — final grep check for remaining plural references
- **Issue:** `tests/lib/gem-score.test.ts` line 10 had `defensive_contributions: null` in the `makeMergedPlayer` factory function. Since `MergedPlayer` now has `defensive_contribution` (singular), this would cause TypeScript type errors when the codebase is compiled or type-checked.
- **Fix:** Renamed to `defensive_contribution: null` in gem-score.test.ts.
- **Files modified:** tests/lib/gem-score.test.ts
- **Commit:** c2d85d0

**2. [Rule 1 - Bug] Added fixtures parameter to _compute_difficulty_scores**
- **Found during:** Task 2 — plan showed `_compute_difficulty_scores(bootstrap)` but the function requires `fixtures` for rolling xGA computation (goals conceded from finished fixtures).
- **Issue:** The plan's function signature `_compute_difficulty_scores(bootstrap: dict) -> dict[int, float]` would produce broken code — difficulty scores depend on fixtures (rolling goals conceded), not just bootstrap data.
- **Fix:** Function signature is `_compute_difficulty_scores(bootstrap, fixtures)` and `run.py` calls it as `_compute_difficulty_scores(bootstrap, fixtures)`.
- **Files modified:** pipeline/merge.py, pipeline/run.py
- **Commit:** c2d85d0

## Verification Results

- All tests pass from worktree directory: 23/23 tests passed
- `python -c "from defcon import compute_defcon_stats"` exits 0
- No remaining `defensive_contributions` (plural) in src/, pipeline/, or tests/

## Known Stubs

None — all fields are wired to real data. `defcon_stats.json` will be written on next pipeline run.

## Self-Check: PASSED

- pipeline/defcon.py: FOUND
- pipeline/run.py contains `from defcon import compute_defcon_stats`: FOUND
- pipeline/merge.py contains `def _compute_difficulty_scores(`: FOUND
- src/lib/types.ts contains `export interface DefConPlayer`: FOUND
- Commits faa2a55 and c2d85d0: FOUND
