---
phase: 127
plan: 01
subsystem: pipeline + api + types
tags:
  - pipeline
  - python
  - api
  - types
  - greedy
  - squad-health
dependency_graph:
  requires:
    - "126-03: buildPreSeasonSquad() greedy TS builder"
    - "126-04: /api/pre-season-squad route (Phase 126 NSP-02)"
    - "pipeline/suggest_squad.py (ILP squad builder)"
  provides:
    - "pipeline/squad_health.py: budget sweep + health artifact writer"
    - "pipeline/tests/test_squad_health.py: GREEDY-01 contract tests"
    - "src/lib/types.ts: SquadHealth + PreSeasonSquadResponse interfaces"
    - "src/lib/pre-season-squad.ts: diagnoseBuildPreSeasonSquad() function"
    - "/api/pre-season-squad: { squad, health, solver } envelope (D-05)"
  affects:
    - "Plans 02-04 (consume PreSeasonSquadResponse and SquadHealth types)"
    - "Phase 128 auto-activation (reads health.min_feasible_budget_greedy)"
    - "Phase 129 budget slider (extends PreSeasonSquadResponse with inputs)"
tech_stack:
  added:
    - "pipeline/squad_health.py: Python greedy sweep module"
  patterns:
    - "Promise.all parallel Blob reads for envelope side-read (D-06)"
    - "satisfies clause for compile-time envelope shape enforcement"
    - "Python port of TypeScript greedy algorithm (D-01)"
    - "TDD RED/GREEN cycle for both TypeScript and Python"
key_files:
  created:
    - pipeline/squad_health.py
    - pipeline/tests/test_squad_health.py
  modified:
    - src/lib/types.ts
    - src/lib/pre-season-squad.ts
    - src/lib/pre-season-squad.test.ts
    - src/app/api/pre-season-squad/route.ts
    - pipeline/run.py
decisions:
  - "greedy_optimality_gap_avg set to null — ILP comparison deferred to future phase (D-02)"
  - "_load_archive() extracted as testable helper to enable monkeypatching in tests"
  - "diagnoseBuildPreSeasonSquad uses budget-free greedy pass to detect unmet_min_slots before budget-constrained pass for incomplete_squad"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-19"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 7
---

# Phase 127 Plan 01: Squad Health Foundation Summary

Plan 01 delivers the Phase 127 backend foundation: Python budget-sweep pipeline, new TypeScript interfaces, a diagnostic function, and the /api/pre-season-squad envelope refactor — all prerequisites for Plans 02-04.

## What Was Built

**Task 1 — Types + diagnoseBuildPreSeasonSquad (TS)**

Added two new exported interfaces to `src/lib/types.ts` immediately after `PreSeasonSquad`:

- `SquadHealth`: 7 fields matching the Python output shape (`greedy_null_rate`, `min_feasible_budget_greedy`, `greedy_optimality_gap_avg`, `budget_sweep_min`, `budget_sweep_max`, `budget_sweep_step`, `sweep_count`)
- `PreSeasonSquadResponse`: 3-field envelope (`squad`, `health`, `solver`) per D-05

Added `diagnoseBuildPreSeasonSquad()` to `src/lib/pre-season-squad.ts`:
- Returns null when squad is buildable
- Returns `{ reason: 'no_eligible_players' }` when scoreMap is empty
- Returns `{ reason: 'unmet_min_slots' }` when position minimums cannot be met regardless of budget
- Returns `{ reason: 'incomplete_squad' }` when budget is too tight but position minimums could theoretically be met

4 new diagnose tests added to `pre-season-squad.test.ts` via TDD RED/GREEN cycle. All 8 tests pass.

**Task 2 — squad_health.py + tests + run.py wiring**

Created `pipeline/squad_health.py` with:
- `MIN_SLOTS`, `MAX_SLOTS`, `TEAM_CAP`, `MIN_MINUTES` constants
- `_greedy_build()`: Python port of TypeScript `buildPreSeasonSquad()` greedy algorithm
- `_compute_score_map()`: mirrors suggest_squad.py helper (PPM, ≥500 minutes)
- `_load_archive()`: loads `season_archive_gw38.json` from Blob or local cache
- `compute_squad_health()`: sweeps `range(800, 1205, 5)` = 81 iterations, writes `pre_season_squad_health.json` via `save()`

Output envelope exactly matches `SquadHealth` TypeScript interface.

8 contract tests in `pipeline/tests/test_squad_health.py` covering: feasible build, infeasible build, min_slots enforcement, team cap, zero null rate, all-null case, envelope key validation, and 81-sweep count assertion.

`pipeline/run.py` wired with a try/except block calling `compute_squad_health(bootstrap)` inside `if IS_GW38:` after the `suggest_squad` try/except, matching the existing non-fatal error pattern.

Full pipeline suite: 288/288 tests pass.

**Task 3 — /api/pre-season-squad envelope refactor**

Updated `src/app/api/pre-season-squad/route.ts`:
- Added `SquadHealth` and `PreSeasonSquadResponse` to the `@/lib/types` import
- Replaced single `readBlobOrLocal('pre_season_squad.json')` call with `Promise.all([readBlobOrLocal('pre_season_squad.json'), readBlobOrLocal('pre_season_squad_health.json')])` running both reads in parallel (T-127-03 mitigation)
- Resolution 1 (ILP path): returns `{ squad, health, solver: 'ilp' } satisfies PreSeasonSquadResponse`
- Resolution 2 (greedy path): returns `{ squad, health, solver: 'greedy' } satisfies PreSeasonSquadResponse`
- Error paths (404/503/500) unchanged — still return plain `{ error: '...' }` bodies per D-07

## Verification

- `npx vitest run src/lib/pre-season-squad.test.ts` — 8/8 pass
- `python -m pytest pipeline/tests/test_squad_health.py -x` — 8/8 pass
- `python -m pytest pipeline/tests/ -x` — 288/288 pass
- `npx vitest run` — 1470/1504 pass (34 skipped, same as before)
- `npx tsc --noEmit` — 1 pre-existing error in `decision-history/route.test.ts` (Buffer type incompatibility, unrelated to this plan); 0 new errors
- `satisfies PreSeasonSquadResponse` count: 2 (one per success branch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing testable abstraction] Extracted _load_archive() as a named helper**
- **Found during:** Task 2 test implementation
- **Issue:** Tests needed to monkeypatch the archive load to avoid disk I/O. Inlining the load in `compute_squad_health()` would require patching `open()` or `vercel_blob`, which is fragile.
- **Fix:** Extracted `_load_archive(bootstrap)` as a named private function, allowing `patch('squad_health._load_archive', return_value=archive)` in tests.
- **Files modified:** `pipeline/squad_health.py`
- **Commit:** 4c26099

None of the plan's required implementation steps were omitted or changed in architecture.

## Known Stubs

None. All fields are wired; `greedy_optimality_gap_avg` is intentionally `null` per D-02 (ILP comparison deferred to a future phase — documented in the type definition and Python output).

## Threat Flags

T-127-03 mitigation implemented: `Promise.all` parallel reads for the health side-read run in the same network round-trip as the primary squad read. Existing `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` absorbs traffic via the Vercel edge cache — net per-request latency unchanged.

T-127-04 mitigation confirmed: `JSON.parse(healthData)` runs inside the existing route `try/catch`; any malformed JSON throws and routes to the `500` error path which returns `{ error: 'Failed to load pre-season squad' }`. No partial-envelope leaks.

## Self-Check: PASSED

All files exist:
- FOUND: src/lib/types.ts
- FOUND: pipeline/squad_health.py
- FOUND: pipeline/tests/test_squad_health.py
- FOUND: src/lib/pre-season-squad.ts
- FOUND: src/app/api/pre-season-squad/route.ts

All commits exist:
- ea57fd0: test(127-01): add failing tests for diagnoseBuildPreSeasonSquad
- b0715e7: feat(127-01): add SquadHealth + PreSeasonSquadResponse types and diagnoseBuildPreSeasonSquad
- d633792: test(127-01): add failing tests for squad_health.py
- 4c26099: feat(127-01): create squad_health.py budget sweep + wire into run.py IS_GW38 block
- 926e8b2: feat(127-01): refactor /api/pre-season-squad to return envelope shape with health side-read
