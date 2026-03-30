---
phase: 07-pipeline-schema-extension
plan: 01
subsystem: pipeline
tags: [python, fpl-api, element-summary, xmins, minutes-risk, defcon]

# Dependency graph
requires:
  - phase: 04-defcon-analysis
    provides: defcon.py compute_defcon_stats and element-summary fetch pattern

provides:
  - defcon.py refactored to accept pre-fetched summaries dict (pure computation, no I/O)
  - xmins.py new module computing xmins, start_prob, mins_risk for every player

affects:
  - 07-02 (run.py must be updated to pass summaries dict to both compute_defcon_stats and compute_xmins_stats)
  - 07-03 (TypeScript MergedPlayer type extension needs these computed fields)
  - 08-decision-engine (consumes mins_risk, start_prob, xmins from merged_players.json)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure computation modules: defcon.py and xmins.py are I/O-free; all API fetching lifted to run.py"
    - "Shared element-summary cache: run.py fetches once, passes dict to all consumers"

key-files:
  created:
    - pipeline/xmins.py
  modified:
    - pipeline/defcon.py

key-decisions:
  - "defcon.py accepts summaries dict — pure computation module with no I/O, all fetching in run.py"
  - "xmins.py processes ALL players including GKs (unlike defcon.py which skips GKs by design)"
  - "mins_risk classification: status='a' + blank news gates rotation classification (locked decision)"
  - "chance_of_playing_next_round=None treated as 100% available per Research Pitfall 3"
  - "recent_start_rate threshold for cameo set at 0.25 (slightly more conservative than 0.2)"

patterns-established:
  - "Pipeline modules accept pre-fetched data dicts rather than fetching internally"
  - "mins_risk enum: nailed / likely_start / rotation_risk / cameo / injured"

requirements-completed: [MINS-01]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 07 Plan 01: Pipeline Schema Extension — defcon.py Refactor + xmins.py Creation Summary

**defcon.py refactored as pure computation module accepting pre-fetched summaries dict; new xmins.py computes xmins/start_prob/mins_risk for all players using locked status-gated classification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T06:31:43Z
- **Completed:** 2026-03-30T06:33:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Refactored `compute_defcon_stats` signature to accept `summaries: dict` third parameter, removing all internal I/O (no more `get_element_summary()` calls, no `time.sleep`, no try/except around HTTP fetch)
- Created `pipeline/xmins.py` with `compute_xmins_stats(bootstrap, summaries, finished_gws)` covering all 825 players (including GKs, 0-start players) with element-summary history preferred and bootstrap fallback
- mins_risk classification follows locked decision: only `status='a'` with blank `news` triggers rotation classification; all others classified as `injured`

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor defcon.py to accept pre-fetched summaries dict** - `9ed8524` (feat)
2. **Task 2: Create xmins.py module for expected minutes and risk classification** - `d236075` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `pipeline/defcon.py` - Removed internal element-summary fetching; accepts summaries dict parameter; pure computation
- `pipeline/xmins.py` - New module: compute_xmins_stats + _compute_player_xmins; all 5 mins_risk categories; statistics stdlib only

## Decisions Made

- defcon.py drops `import time` and `from fpl_client import get_element_summary` entirely — the rate-limiting sleep moves to run.py's shared fetch loop in Plan 02
- xmins.py covers GKs (element_type=1) unlike defcon.py — per Research Anti-Pattern note "GKs need xmins too"
- `m.get('starts') is None` fallback to `minutes > 60` threshold for element-summary history where `starts` field may be absent (Research Open Question 1)
- cameo threshold set at `recent_start_rate < 0.25` (plan spec: slightly more conservative than 0.2 research variant)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (run.py shared cache wiring) can now update the call site: `compute_defcon_stats(bootstrap, difficulty_scores, summaries)` and add `compute_xmins_stats(bootstrap, summaries, finished_gws)` call
- Both modules are importable: `python -c "from defcon import compute_defcon_stats; from xmins import compute_xmins_stats"` passes
- Blocker for Plan 02: run.py still calls `compute_defcon_stats(bootstrap, difficulty_scores)` with old 2-arg signature — this will raise TypeError until Plan 02 updates the call site

---
*Phase: 07-pipeline-schema-extension*
*Completed: 2026-03-30*
