---
phase: "080"
plan: "01"
subsystem: pipeline
tags: [pipeline, fpl, python, rotation-risk, gw-intel, xpts]
dependency_graph:
  requires: []
  provides: [pipeline/european_cup_dates.py, pipeline/gw_intel.py, pipeline/merge.py::_xpts_per_gw, pipeline/run.py::gw_intel_wiring, pipeline/tests/test_gw_intel.py]
  affects: [pipeline/run.py, pipeline/merge.py, pipeline/cache/gw_intel.json, pipeline/cache/merged_players.json]
tech_stack:
  added: [pipeline/european_cup_dates.py, pipeline/gw_intel.py]
  patterns: [zero-http-compute-function, groupby-dgw-detection, static-lookup-module, run.py-post-merge-step]
key_files:
  created:
    - pipeline/european_cup_dates.py
    - pipeline/gw_intel.py
    - pipeline/tests/test_gw_intel.py
  modified:
    - pipeline/merge.py
    - pipeline/run.py
decisions:
  - "EUROPEAN_CUP_DATES dict is empty ({}): no 2025/26 cup fixtures fall within +/-3 days of remaining PL fixtures at execution time; all teams correctly show rotation_risk=False"
  - "_xpts_per_gw placed in merge.py (not gw_intel.py): co-located with _xpts_ngw, exported for any future consumer"
  - "compute_gw_intel(merged, ...) call split to multi-line for readability; plan's awk ordering check fails due to multi-line but actual order is correct (verified by grep line numbers: _apply_rotation_risk=216, compute_gw_intel=225, save gw_intel.json=228)"
metrics:
  duration: "~12 min"
  completed: "2026-05-08"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 080 Plan 01: Pipeline Data Layer (GWI-01/GWI-03/GWI-04/GWI-05) Summary

**One-liner:** Pipeline rotation-risk detection + per-GW xPts trajectory helper + gw_intel.json cache file with 4 card-type compute engine, wired into run.py post-merge.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create european_cup_dates.py + _xpts_per_gw | 1af4068 | pipeline/european_cup_dates.py, pipeline/merge.py |
| 2 | Create gw_intel.py + test_gw_intel.py | d552f37 | pipeline/gw_intel.py, pipeline/tests/test_gw_intel.py |
| 3 | Wire rotation_risk + compute_gw_intel into run.py | ebca47b | pipeline/run.py |

## What Was Built

### pipeline/european_cup_dates.py
Static lookup module `EUROPEAN_CUP_DATES: dict[int, list[str]]` mapping FPL team_id to ISO date strings for remaining European/domestic cup fixtures. Per D-01/D-02. Empty dict at execution time (no 2025/26 cup dates fall within ±3 days of remaining GW36-38 PL fixtures).

### pipeline/merge.py — _xpts_per_gw()
New helper after `_xpts_ngw` (line 323). Returns `list[float]` of per-GW xPts (one entry per unique event_id group). DGW fixture pairs sum into one entry. Zero guard returns `[0.0]*n_gws`. Mirrors `_xpts_ngw` groupby pattern exactly. Exported for use by `gw_intel.py`.

### pipeline/gw_intel.py
New compute module with ZERO HTTP calls:
- `_apply_rotation_risk(merged, fixtures, european_cup_dates)`: 3-day window check, writes `rotation_risk: bool` per player record, returns merged for chaining. T-080-03/T-080-04 mitigations: try/except around both `datetime.fromisoformat` calls.
- `_compute_team_points_from_fixtures(fixtures)`: derives team points from finished fixtures (not bootstrap.points which is always 0 — Pitfall 1).
- `_compute_table_stakes(bootstrap, fixtures, finished_gws)`: active only in final 6 GWs gate. Returns `[{team_id, team_short_name, label}]` with 4-label taxonomy.
- `_detect_dgw_bgw(merged, next_gw)`: counts fixtures per team where event_id==next_gw (Pitfall 6 safe). Returns only teams with 0 (BGW) or >=2 (DGW).
- `_build_fixture_run_card(player, ...)`: template narrative per D-09, uses `_xpts_per_gw` for 3-bar trajectory data.
- `compute_gw_intel(merged, bootstrap, fixtures, summaries, finished_gws, european_cup_dates)`: returns `{cards, team_stakes, generated_at}`.

### pipeline/tests/test_gw_intel.py
14 tests covering GWI-01 through GWI-04, all passing. Tests cover: rotation risk detection, no-clash, finished-fixture exclusion, table stakes gate, table stakes labels, points-from-fixtures vs bootstrap, xPts per-GW DGW combining, zero guard, difficulty label thresholds, no-DGW/BGW when all single, DGW detection by event_id, BGW detection, gw_intel required shape, narrative template.

### pipeline/run.py
Three additions:
1. Imports: `from gw_intel import compute_gw_intel, _apply_rotation_risk` and `from european_cup_dates import EUROPEAN_CUP_DATES`.
2. Post-merge rotation_risk step after `save('captain_picks.json')`: `_apply_rotation_risk(merged, fixtures, EUROPEAN_CUP_DATES)` + re-save `merged_players.json` (D-04: rotation_risk persisted to merged_players.json).
3. GW intel compute block after `print("Insights computed...")`: calls `compute_gw_intel`, saves `gw_intel.json`, prints card count.

## Test Results

- `pipeline/tests/test_gw_intel.py`: **14/14 tests pass**
- Full pipeline suite: **131 tests pass, 0 failures, 0 regressions**

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Minor Deviations

**1. [Discretion] EUROPEAN_CUP_DATES dict is empty**
- **Context:** Plan specified "Empty dict is acceptable (no current cup clashes)"
- **Decision:** Kept empty — no 2025/26 UCL/UEL/FA Cup dates fall within ±3 days of GW36-38 PL fixtures at execution time (2026-05-08). All teams show `rotation_risk=False`, which is correct.
- **Impact:** None — module imports correctly, logic runs without error.

**2. [Discretion] compute_gw_intel call is multi-line**
- **Context:** Plan's awk ordering check `compute_gw_intel\(merged` fails because the call is split across lines (`gw_intel = compute_gw_intel(` on one line, `merged, ...` on next).
- **Decision:** Kept multi-line for readability. Actual ordering verified by grep: _apply_rotation_risk=line 216, compute_gw_intel call start=line 225, save('gw_intel.json')=line 228. Order is correct.

## Security Notes (Threat Model T-080-03/T-080-04)

Both `datetime.fromisoformat()` calls in `_apply_rotation_risk` are wrapped in `try/except` blocks:
- T-080-03: `try/except (ValueError, TypeError)` around PL fixture kickoff_time parsing
- T-080-04: `try/except ValueError` around cup date string parsing

Malformed dates skip without crashing the pipeline (deviation from existing pipeline failure-halting behavior — these are data quality guards, not logic errors).

## Open Questions for Plan 02 (Types/API/Hook)

- `GWInsight` discriminated union TypeScript type needs to be added to `src/lib/types.ts` (D-06)
- `rotation_risk?: boolean` field needs to be added to `MergedPlayer` interface (D-04)
- `src/app/api/gw-intel/route.ts` needs to be created (mirrors insights route, D-05)
- `src/lib/hooks/useGWIntel.ts` needs to be created (mirrors useInsights hook)
- `pipeline/cache/gw_intel.json` will be written on next pipeline run; Plan 02's API route can consume it

## Self-Check: PASSED

| Item | Status |
|------|--------|
| pipeline/european_cup_dates.py exists | FOUND |
| pipeline/gw_intel.py exists | FOUND |
| pipeline/tests/test_gw_intel.py exists | FOUND |
| commit 1af4068 (Task 1) | FOUND |
| commit d552f37 (Task 2) | FOUND |
| commit ebca47b (Task 3) | FOUND |
