---
phase: 27-fdr-plus-plus-pipeline
plan: "01"
subsystem: pipeline-and-api
tags: [fdr, pipeline, club-form, types, vitest, jsdom, rtl, data]
dependency_graph:
  requires: []
  provides:
    - "pipeline/merge.py emits attacking_difficulty + defensive_difficulty per fixture"
    - "computeClubForm() returns attacking_ease_{1,3,5}gw + defensive_ease_{1,3,5}gw per team"
    - "*.test.tsx files execute in jsdom via RTL (@testing-library/react + jsdom devDependencies)"
  affects:
    - "src/app/api/club-form/route.ts (ClubForm type now has 6 new fields)"
    - "pipeline/cache/merged_players.json (2 new fields per fixture entry)"
tech_stack:
  added:
    - "@testing-library/react ^16"
    - "@testing-library/jest-dom ^6"
    - "jsdom ^25"
  patterns:
    - "3-game OFFENSIVE_ROLLING window for goals-scored proxy (mirrors existing 6-game ROLLING for xGA)"
    - "Non-inverted difficulty helper: (x - min) / (max - min) vs existing 1 - (x - min) / (max - min)"
    - "meanEase() inverts difficulty to ease: null for BGW (zero fixtures in window)"
    - "TDD RED/GREEN cycle for all new FDR++ unit tests"
key_files:
  created:
    - "tests/smoke.test.tsx (TEMPORARY — delete in Phase 27 Wave 2)"
  modified:
    - "pipeline/merge.py"
    - "src/lib/types.ts"
    - "src/lib/club-form.ts"
    - "tests/lib/club-form.test.ts"
    - "vitest.config.ts"
    - "package.json"
    - "package-lock.json"
decisions:
  - "vitest.config.ts uses environment: jsdom globally (not environmentMatchGlobs) — Vitest v4 removed environmentMatchGlobs; jsdom is a safe DOM-agnostic superset, all 246 existing node-env tests pass unchanged"
  - "OFFENSIVE_ROLLING = 3 in both pipeline/merge.py and src/lib/club-form.ts independently (pipeline-mirror invariant: they are separate re-implementations)"
  - "attacking_difficulty is optional (?) in FixtureEntry but required in ClubFormFixture — FixtureEntry represents pipeline-sourced data (backward compat during rollout); ClubFormFixture is computed locally (always present)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-28"
  tasks_completed: 3
  files_modified: 7
  files_created: 1
---

# Phase 27 Plan 01: FDR++ Pipeline Foundation Summary

One-liner: FDR++ foundation — pipeline emits attacking_difficulty + defensive_difficulty per fixture (3-game goals-scored rolling window), TypeScript mirror in computeClubForm() with 6 ease aggregates per team, RTL + jsdom devDependencies installed for Wave 2 component tests.

## What Was Built

### Task 1: Pipeline Math (DATA-01)
Added `_compute_offensive_difficulty_score()` to `pipeline/merge.py` — a parallel helper to the existing `_compute_difficulty_score()` that computes a 0.0–1.0 score from goals scored over a 3-game rolling window (`OFFENSIVE_ROLLING = 3`). The critical distinction: it does NOT invert via `1.0 - ...`. High-scoring opponents (high `team_xgs`) produce HIGH `defensive_difficulty`, correctly indicating they're hard to keep a clean sheet against.

Both `attacking_difficulty` (= `difficulty_score` — additive field, same xGA math) and `defensive_difficulty` (from new goals-scored window) are now emitted on every fixture entry in `merged_players.json`. The existing `difficulty_score` and `difficulty_tier` fields are byte-for-byte unchanged.

### Task 2: TypeScript Mirror + Types + Tests (DATA-01, FIX-01)
`src/lib/club-form.ts` mirrors the pipeline math independently (per the pipeline-mirror invariant). A new `teamGoalsScored` / `defScore()` block runs alongside the existing `teamXga` / `diffScore()` block, using `OFFENSIVE_ROLLING = 3`. The `meanEase()` helper (placed outside `computeClubForm`) inverts difficulty to ease (1.0 = easiest), returning `null` when the fixture window has zero entries (correct BGW handling — not 0, not NaN).

`src/lib/types.ts` was extended:
- `FixtureEntry`: added `attacking_difficulty?: number`, `defensive_difficulty?: number` (optional for backward compat during pipeline rollout)
- `ClubFormFixture`: added `attacking_difficulty: number`, `defensive_difficulty: number` (required — computed locally)
- `ClubForm`: added 6 ease aggregates (`attacking_ease_{1,3,5}gw`, `defensive_ease_{1,3,5}gw` as `number | null`)

`tests/lib/club-form.test.ts` received 6 new TDD tests covering: fields present, D-01 invariant (attacking_difficulty equals difficulty_score), ease arrays valid, BGW null handling, 3-game window direction, and ease direction. All 13 tests pass (7 existing + 6 FDR++). Full 246-test suite runs green with zero regressions.

### Task 3: RTL + jsdom Tooling (Wave 0)
Installed `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `jsdom@^25` as devDependencies. Updated `vitest.config.ts` to use `environment: 'jsdom'` globally (Vitest v4 removed `environmentMatchGlobs` — see deviation below). A temporary smoke test `tests/smoke.test.tsx` proves RTL can render JSX in the jsdom environment. Full suite: 22 test files, 247 tests pass.

## Pipeline-Mirror Invariant

`pipeline/merge.py` and `src/lib/club-form.ts` are independent re-implementations of the same fixture math. The API route `src/app/api/club-form/route.ts` reads `fpl_fixtures.json` + `fpl_bootstrap.json` directly — it does NOT read `merged_players.json`. Therefore both files MUST be edited as a pair whenever fixture math changes. This was honored in Wave 1: Task 1 edits pipeline, Task 2 edits TS mirror.

## Pointer to Wave 2

Wave 2 (27-02-PLAN.md) surfaces the new ease aggregates in the UI:
- `FixtureEaseRankingPanel` component showing teams ranked by 1GW/3GW/5GW ease
- Extending `ClubFormTable` with ease columns
- Deleting `tests/smoke.test.tsx` (replaced by real component test in `tests/components/club-form/`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest v4 removed `environmentMatchGlobs` config option**
- **Found during:** Task 3
- **Issue:** Plan specified `environmentMatchGlobs: [['**/*.test.tsx', 'jsdom'], ...]` in `vitest.config.ts`. Vitest v4.1.2 does not include this config key — `grep -r "environmentMatchGlobs" node_modules/vitest/dist/` returns no results. The smoke test failed with `ReferenceError: document is not defined`.
- **Fix:** Also tried `projects` array config (Vitest v4 workspace approach), but it caused test count regression (19 files instead of 22 — excluded `tests/components/planner/plan-helpers.test.ts` and smoke test). Final fix: set `environment: 'jsdom'` globally. All 246 existing unit tests are DOM-agnostic and pass unchanged in jsdom. The jsdom environment is a superset for this codebase.
- **Files modified:** `vitest.config.ts`
- **Commit:** a47e030

## Known Stubs

None. All new fields are wired to real computation, not placeholder values.

## Threat Flags

None. No new trust boundaries, network endpoints, or auth surfaces introduced. All new fields are derived from the same cached FPL JSON already in use.

## Self-Check: PASSED

All files created/modified exist on disk. All task commits verified in git log:
- 1858e99: Task 1 (pipeline/merge.py)
- d0bc288: Task 2 RED (tests)
- 1285f27: Task 2 GREEN (club-form.ts, types.ts)
- a47e030: Task 3 (vitest.config.ts, package.json, smoke.test.tsx)
