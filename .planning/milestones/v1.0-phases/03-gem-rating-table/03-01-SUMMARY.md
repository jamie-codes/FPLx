---
phase: 03-gem-rating-table
plan: 01
subsystem: scoring-algorithm
tags: [tdd, gem-score, normalisation, tanstack-table]
dependency_graph:
  requires: [02-03]
  provides: [ScoredPlayer, computeAllGemScores]
  affects: [03-02, 03-03]
tech_stack:
  added: ["@tanstack/react-table@8.21.3"]
  patterns: ["min-max normalisation", "two-pass algorithm", "null-dimension exclusion"]
key_files:
  created:
    - src/lib/gem-score.ts
    - tests/lib/gem-score.test.ts
  modified:
    - src/lib/types.ts
    - package.json
    - package-lock.json
decisions:
  - "DefCon likelihood dimension deferred to Phase 4 — per-match element-summary data not yet available"
  - "xG/xA excluded from composite when null (not zero-filled) per Pitfall 12"
  - "Min-max normalisation over full population, not filtered subset"
metrics:
  duration: "2m28s"
  completed: "2026-03-28T12:29:28Z"
  tasks_completed: 3
  files_modified: 5
---

# Phase 3 Plan 1: Gem Scoring Algorithm Summary

Two-pass min-max normalisation scoring algorithm producing `ScoredPlayer[]` with composite gem_score across 7 dimensions (FDR, form, xG, xA, ownership, minutes, set piece), with xG/xA conditionally null when Understat data unavailable.

## What Was Built

- `@tanstack/react-table@8.21.3` installed as dependency
- `ScoredPlayer` interface extending `MergedPlayer` with `gem_score` and 7 dimension scores
- `computeAllGemScores(players: MergedPlayer[]): ScoredPlayer[]` pure function
- 11 unit tests covering all edge cases

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @tanstack/react-table and add ScoredPlayer type | af3768a | package.json, src/lib/types.ts |
| 2 | RED - Write failing tests for computeAllGemScores | a246871 | tests/lib/gem-score.test.ts |
| 3 | GREEN - Implement computeAllGemScores | 7b565ec | src/lib/gem-score.ts |

## Algorithm Design

**Two-pass approach:**
1. Pass 1: collect raw values per dimension across all players, compute min/max (DimensionStats)
2. Pass 2: normalise each player's dimensions using population stats, compute composite as mean of non-null dims

**Key normalisation rules:**
- `normalise(value, stats)` returns `0.5` when `stats.max === stats.min` (single player or uniform population)
- `xg_score` / `xa_score` are `null` when `xg_per90` / `xa_per90` are null; excluded from composite denominator
- FDR: `1.0 - avgDifficulty` (low difficulty score = good = high fdr_score)
- Ownership: `1.0 - (selected_by_percent / 100)` (low owned = high score)
- Set piece: `setpieceRank` returns 2 (primary taker), 1 (secondary), 0 (none)

## Decisions Made

- **DefCon deferred to Phase 4**: per-match hit rate data requires `element-summary` endpoint not yet fetched. Phase 3 gem_score covers 7 available dimensions; xG/xA conditional on Understat availability means minimum 5 active dims.
- **Null = excluded, not zero**: zero-filling xG/xA for promoted-team players would distort gem scores (per Research Pitfall 12)
- **Population-wide normalisation**: stats computed on full `players` array before any filtering — prevents gem_score from changing when user applies position filter in UI

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx vitest run tests/lib/gem-score.test.ts`: 11/11 tests pass
- `npx vitest run`: 23/23 tests pass (full suite green, no regressions)
- `npm ls @tanstack/react-table`: 8.21.3 installed
- `grep "ScoredPlayer" src/lib/types.ts`: interface exists

## Self-Check: PASSED

- `src/lib/gem-score.ts` exists and exports `computeAllGemScores`
- `src/lib/types.ts` contains `ScoredPlayer extends MergedPlayer`
- `tests/lib/gem-score.test.ts` exists with 11 test cases
- Commits af3768a, a246871, 7b565ec all present in git log
