---
phase: 19-data-quality-and-value-gems-polish
plan: "01"
subsystem: pipeline + types + gem-scoring
tags: [data-quality, pipeline, typescript, gem-score, defcon, vg]
dependency_graph:
  requires: []
  provides: [xg-proxy-all-players, pts-last3gw-pipeline, pts-last5gw-pipeline, defcon-5game-threshold]
  affects: [merged_players.json, gem-score.ts, types.ts, defcon_stats.json]
tech_stack:
  added: []
  patterns: [FPL-goals-assists-xg-proxy, element-summary-history-aggregation]
key_files:
  created: []
  modified:
    - pipeline/merge.py
    - pipeline/defcon.py
    - pipeline/run.py
    - src/lib/types.ts
    - src/lib/gem-score.ts
    - tests/lib/gem-score.test.ts
    - tests/lib/captaincy-engine.test.ts
    - tests/lib/explain.test.ts
    - tests/lib/recommend.test.ts
    - tests/lib/replacement-shortlist.test.ts
    - tests/lib/transfer-engine.test.ts
decisions:
  - "xG proxy uses FPL goals_scored/assists divided by minutes * 90 — matches existing Understat per-90 formula, produces 0.0 for GKs with 0 goals"
  - "pts_last3gw/pts_last5gw use partial sums for players with fewer GWs than window — never null"
  - "DefCon threshold raised from == 0 to < 5 to eliminate noise from low-appearance players"
  - "test fixtures updated rather than using Partial type workaround — stricter type safety"
metrics:
  duration: "~3 min"
  completed: "2026-04-02"
  tasks_completed: 2
  files_changed: 11
---

# Phase 19 Plan 01: Pipeline Data Quality and Value Gems Foundation Summary

xG/xA proxy from FPL goals/assists for all unmatched players, DefCon threshold raised to 5 games, and pts_last3gw/pts_last5gw/pts_gw_count added to pipeline output and TypeScript types.

## What Was Built

**Task 1: Pipeline data quality (merge.py, defcon.py, run.py)**

- DQ-01: Added FPL goals/assists proxy block in `merge_players()` — when `xg_per90` is still `None` after Understat lookup, computes `xg_per90 = (goals_scored / minutes) * 90` and `xa_per90 = (assists / minutes) * 90`. Players with zero minutes get `0.0`. This ensures every player with playing time gets numeric xG/xA values in the output.
- DQ-02: DefCon `games_played` threshold changed from `== 0` to `< 5` — eliminates noise from players with 1-4 appearances.
- VG-01: Added `pts_last3gw`, `pts_last5gw`, `pts_gw_count` computation in `merge_players()` using the element-summary `history` array (last N entries). Players with fewer GWs than the window get a partial sum.
- Added `summaries: dict | None = None` parameter to `merge_players()` signature; run.py updated to pass `summaries=summaries`.
- Added `goals_scored` and `assists` fields to the player dict output.

**Task 2: TypeScript types and Gem scoring (types.ts, gem-score.ts)**

- Added `goals_scored: number`, `assists: number`, `pts_last3gw: number`, `pts_last5gw: number`, `pts_gw_count: number` to `MergedPlayer` interface.
- Updated `gem-score.ts` xG/xA null guards to also check `!== undefined` with DQ-01 comment.
- `ScoredPlayer extends MergedPlayer` — inherits all new fields automatically.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `90f9eca` | feat(19-01): pipeline data quality — xG proxy, DefCon threshold, historical points |
| 2 | `cd300f9` | feat(19-01): TypeScript types and Gem scoring proxy |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 6 test factory functions with new required fields**
- **Found during:** Task 2 — `npx tsc --noEmit` reported type errors in tests
- **Issue:** `MergedPlayer` now requires `goals_scored`, `assists`, `pts_last3gw`, `pts_last5gw`, `pts_gw_count`. All 6 test `makeScoredPlayer`/`makeMergedPlayer` factory functions were missing these fields.
- **Fix:** Added 5 new fields with sensible defaults (goals_scored: 5, assists: 3, pts_last3gw: 15, pts_last5gw: 25, pts_gw_count: 30) to each factory function.
- **Files modified:** tests/lib/gem-score.test.ts, tests/lib/captaincy-engine.test.ts, tests/lib/explain.test.ts, tests/lib/recommend.test.ts, tests/lib/replacement-shortlist.test.ts, tests/lib/transfer-engine.test.ts
- **Commit:** `cd300f9`

## Verification Results

- `python -c "from pipeline.merge import merge_players; from pipeline.defcon import compute_defcon_stats; print('imports OK')"` — PASSED
- `npx tsc --noEmit` — PASSED (zero errors)
- `grep "pts_last3gw" pipeline/merge.py` — 4 matches (parameter docs, computation, dict assignment)
- `grep "pts_last3gw" src/lib/types.ts` — 1 match
- `grep "games_played < 5" pipeline/defcon.py` — 1 match
- `grep "goals_scored" src/lib/types.ts` — 2 matches (goals_scored field + ClubForm.goals_scored)

## Known Stubs

None — all fields are wired from pipeline through to TypeScript types. The UI display of `pts_last3gw`/`pts_last5gw` columns in the Value Gems table is handled by Plan 19-02 (VG-02).

## Self-Check: PASSED
