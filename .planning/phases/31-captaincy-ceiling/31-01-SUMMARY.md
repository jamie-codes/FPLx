---
phase: 31-captaincy-ceiling
plan: 01
subsystem: pipeline
tags: [python, pipeline, captaincy, xpts, ownership, vitest]

# Dependency graph
requires:
  - phase: 28-xpts-engine
    provides: _compute_xpts_sigma() and _sigma_1gw scratch fields on each player
  - phase: 30-differential-tracker
    provides: _compute_differential_flag pattern and selected_by_percent ownership data
provides:
  - _compute_captain_picks(result, gameweek) helper in pipeline/merge.py
  - xPts_90th_1gw field on every player in merged_players.json (D-11)
  - captain_picks.json cache file written by pipeline/run.py
  - Wave 0 test stub file tests/lib/captain-picks.test.ts (8 skipped + 1 placeholder)
affects:
  - phase: 31-02 (UI panel, API route, hook, types — consume captain_picks.json)
  - phase: 32-team-target-list (may use xPts_90th_1gw for sort/filter)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pipeline tuple-return convention: merge_players() now returns (list, dict) not just list
    - captain_picks.json schema (D-09): ceiling + eo_adjusted picks with POSITION_MAP
    - EO threshold ladder: <25% → <35% → ceiling fallback (D-08)
    - _safe_float() for all ownership comparisons to handle FPL string values

key-files:
  created:
    - tests/lib/captain-picks.test.ts
  modified:
    - pipeline/merge.py
    - pipeline/run.py

key-decisions:
  - "D-04/CAP-03: Ceiling pick = status='a' player with max xPts_90th_1gw"
  - "D-05: xPts_90th_1gw = round(xPts_1gw + 1.28 * _sigma_1gw, 3) — Z=1.28 is 90th-percentile of standard normal"
  - "D-06/D-08/CAP-04: EO-adjusted pick uses threshold ladder 25%→35%→ceiling fallback"
  - "D-11: xPts_90th_1gw persisted in merged_players.json for future GemTable column (Phase 32+)"
  - "D-09: captain_picks.json schema with generated_at, gameweek, ceiling, eo_adjusted keys"
  - "T-31-01 mitigation: _safe_float(selected_by_percent) for ownership comparisons — FPL returns string not float"
  - "T-31-06 mitigation: captain picks block placed BEFORE sigma strip block to preserve _sigma_1gw access"

patterns-established:
  - "Pipeline tuple-return: merge_players() returns (result, captain_picks_payload) — callers must unpack"
  - "Post-loop insertion point: between xPts ceiling tercile block and sigma strip"
  - "_compute_captain_picks placed between _compute_differential_flag and merge_players definition"

requirements-completed: [CAP-03, CAP-04]

# Metrics
duration: 3min
completed: 2026-04-28
---

# Phase 31 Plan 01: Captaincy Ceiling Pipeline Summary

**`_compute_captain_picks()` helper + EO threshold ladder (25%/35%/fallback) added to pipeline/merge.py; xPts_90th_1gw written per player; captain_picks.json written by run.py; Wave 0 test stub committed**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-28T14:40:53Z
- **Completed:** 2026-04-28T14:43:51Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `_compute_captain_picks(result, gameweek)` helper implements D-04/D-06/D-08 algorithm: ceiling = max xPts_90th_1gw among status='a' players; EO-adjusted = best low-owned pick with threshold ladder 25%→35%→ceiling fallback
- `xPts_90th_1gw = round(xPts_1gw + 1.28 * _sigma_1gw, 3)` written onto every player in merge_players() BEFORE sigma strip (D-11, T-31-06 ordering preserved)
- `merge_players()` return type changed from `list` to `tuple[list, dict]`; `run.py` updated to unpack and call `save('captain_picks.json', captain_picks)`
- Wave 0 test stub file committed: 8 it.skip integration tests + 1 placeholder passing test; vitest exits 0 with 1 passed + 8 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 test stub file** - `1be10e5` (test)
2. **Task 2: Add _compute_captain_picks helper + post-loop block** - `06c4b12` (feat)
3. **Task 3: Update pipeline/run.py** - `33c4331` (feat)

## Files Created/Modified

- `tests/lib/captain-picks.test.ts` — Wave 0 stub: 8 it.skip integration tests against pipeline cache + 1 placeholder
- `pipeline/merge.py` — new `_compute_captain_picks()` helper, xPts_90th_1gw per-player write, post-loop captain picks block, tuple return type
- `pipeline/run.py` — tuple unpack of merge_players(), `save('captain_picks.json', captain_picks)` added

## Decisions Made

- D-04/CAP-03: ceiling = status='a' player with highest xPts_90th_1gw (no exclusions)
- D-05: Z=1.28 is 90th-percentile z-score for standard normal approximation of Poisson xPts variance
- D-06/D-08/CAP-04: EO-adjusted tries <25% threshold first, falls back to <35%, then ceiling — `eo_threshold_used` key annotates which threshold succeeded; absent when falling back to ceiling
- D-11: xPts_90th_1gw persisted in player JSON for future use in GemTable (Phase 32+)
- T-31-01: `_safe_float(p.get('selected_by_percent'), 0.0)` for all ownership comparisons — FPL API returns string
- T-31-06: captain picks block inserted BEFORE sigma strip so `_sigma_1gw` is still available when computing xPts_90th_1gw

## Deviations from Plan

None — plan executed exactly as written.

Note: The verify snippet in the Task 2 `<verify>` block expected `OK Saka Watkins 25.0` but the algorithm correctly produces `OK Saka Saka 25.0`. When both players (Saka 12.4% and Watkins 8.1%) are below the 25% threshold, Saka wins the EO pick too since his xPts_90th_1gw (9.2) > Watkins (7.9). This is correct per the D-06 spec ("highest-xPts_90th_1gw player with selected_by_percent < threshold"). The acceptance criterion greps all pass; this is a documentation error in the plan's illustrative example.

## Issues Encountered

None — all three tasks executed without surprises.

## User Setup Required

None — no external service configuration required.

**Manual gate before Plan 02:** Run `cd pipeline && python run.py` to produce `pipeline/cache/captain_picks.json`. Verify it contains `ceiling` and `eo_adjusted` keys with valid player data. This must be done before running Plan 02's unskipped integration tests.

## Next Phase Readiness

- Pipeline contract locked: `captain_picks.json` schema (D-09) and `xPts_90th_1gw` per player (D-11) are committed
- Plan 02 (Wave 2) can now build: `/api/captain-picks` route, `useCaptainPicks` hook, `CaptainPicksPanel` component, page mount, types, and unskip the 8 integration tests
- No blockers

---
*Phase: 31-captaincy-ceiling*
*Completed: 2026-04-28*
