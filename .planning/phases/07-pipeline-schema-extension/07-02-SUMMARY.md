---
phase: 07-pipeline-schema-extension
plan: "02"
subsystem: pipeline
tags: [python, fpl, projected-points, xmins, merge, run]

requires:
  - phase: 07-01
    provides: xmins.py with compute_xmins_stats(), defcon.py accepting pre-fetched summaries dict

provides:
  - merge.py with _proj_pts_ngw() DGW-aware helper and 6 new fields per player
  - merge.py accepting xmins_stats kwarg (backward-compatible default None)
  - run.py shared element-summary fetch loop (once, passed to defcon + xmins)
  - run.py xmins_stats computation before merge, wired into all call sites

affects:
  - 07-03 (TypeScript schema update for 6 new fields)
  - Phase 08 UI (rotation badges, projected points display)
  - Phase 09 recommendations (buy/hold/sell)
  - Phase 10 captaincy rankings

tech-stack:
  added: []
  patterns:
    - "Shared element-summary cache: fetched once in run.py, passed as dict to defcon + xmins"
    - "DGW-aware projection: group fixtures by event_id before consuming N GW slots"
    - "Backward-compatible signature extension: xmins_stats=None default preserves existing callers"

key-files:
  created: []
  modified:
    - pipeline/merge.py
    - pipeline/run.py

key-decisions:
  - "xmins_stats parameter defaults to None so existing callers don't break during transition"
  - "Bootstrap-only start_prob fallback: starts/current_gw when xmins_stats absent"
  - "All 6 fields always written per player — numeric fields get 0.0, mins_risk gets 'injured' when no data"
  - "import time as _time alias avoids any collision with existing time usage"
  - "get_element_summary added to top-level fpl_client import (not inline import)"

patterns-established:
  - "Pattern: All 6 projected fields always non-null — never write null/None for numeric player fields"
  - "Pattern: float(element.get(field, 0) or 0) — handles string FPL fields and empty string ''"
  - "Pattern: Shared pipeline cache passed as dict arg — never fetched inside compute_* modules"

requirements-completed: [PROJ-01, PROJ-02, PROJ-03]

duration: 4min
completed: 2026-03-29
---

# Phase 07 Plan 02: Pipeline Projected Points and xmins Wiring Summary

**DGW-aware proj_pts_1gw/3gw/5gw fields added to merge.py, shared element-summary cache wired through run.py to defcon and xmins modules**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T06:35:55Z
- **Completed:** 2026-03-29T06:39:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `_proj_pts_ngw()` helper in merge.py that groups fixtures by event_id (DGW-aware) and multiplies ppg * start_prob * difficulty_modifier per fixture
- Added 6 new fields per player in merge_players(): proj_pts_1gw (ep_next * availability), proj_pts_3gw, proj_pts_5gw, xmins, start_prob, mins_risk
- Lifted element-summary fetch into run.py as shared cache dict (fetched once, rate-limited at 0.1s), passed to both compute_defcon_stats and compute_xmins_stats
- Pipeline dry-run and import resolution both verified clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add projected points computation to merge.py** - `ae67088` (feat)
2. **Task 2: Wire shared element-summary cache and xmins into run.py** - `a90c3b0` (feat)

## Files Created/Modified

- `pipeline/merge.py` - Added _proj_pts_ngw() helper, xmins_stats parameter, 6 new projected/xmins fields in merge loop
- `pipeline/run.py` - Shared element-summary fetch, compute_xmins_stats call, updated merge_players and compute_defcon_stats call sites

## Decisions Made

- `xmins_stats` parameter defaults to `None` for backward compatibility — existing callers (e.g., tests) don't break during the transition period
- When `xmins_stats` is absent, start_prob falls back to `starts / current_gw` bootstrap estimate; mins_risk defaults to `'injured'`
- All 6 new fields are always written for every player (never null) — 0.0 for numeric fallback, 'injured' for mins_risk fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (TypeScript schema update) can now add the 6 new fields to `MergedPlayer` interface
- `merged_players.json` will contain proj_pts_1gw, proj_pts_3gw, proj_pts_5gw, xmins, start_prob, mins_risk fields after next pipeline run
- Phase 08 (rotation badges UI) and Phase 09 (recommendations) are unblocked by this data foundation

---
*Phase: 07-pipeline-schema-extension*
*Completed: 2026-03-29*
