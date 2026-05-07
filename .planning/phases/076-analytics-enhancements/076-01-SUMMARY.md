---
phase: 076-analytics-enhancements
plan: 01
subsystem: pipeline
tags: [python, pipeline, merge, routes_to_points, statistics, median, pytest]

# Dependency graph
requires:
  - phase: 075-fixture-heat-map-v2
    provides: LOOKAHEAD infra and heat map v2 components (no pipeline dependency for this plan)
  - phase: 030-differential-tracker
    provides: differential-flag post-loop pass pattern that routes_to_points mirrors exactly
provides:
  - "routes_to_points (integer 0..5) field on every player in merged_players.json"
  - "pipeline/tests/test_merge_routes.py with 5 pytest cases (RED→GREEN TDD cycle)"
  - "REQUIREMENTS.md RTP-01 range corrected to 0–5"
affects: [076-02-plan, gem-table-columns, routes-column-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-loop pass after differential-flag pass: collect team-scoped values, compute medians, iterate again to write field — mirrors lines 1074–1098 exactly"
    - "DQ-01 proxy awareness in tests: use goals_scored/assists to control xg_per90/xa_per90 values (xg_per90 = goals_scored/10 at minutes=900)"
    - "Per-team median scope (no league-median fallback): teams with zero non-null entries produce no median entry; their players cannot satisfy routes 4–5"

key-files:
  created:
    - "pipeline/tests/test_merge_routes.py — 5 pytest unit tests for routes_to_points pass"
  modified:
    - "pipeline/merge.py — routes_to_points post-loop pass (40 lines after line 1098)"
    - ".planning/REQUIREMENTS.md — RTP-01 range 1–5 → 0–5"

key-decisions:
  - "routes_to_points range is 0..5 (not 1..5): zero is a meaningful signal — players with no point-scoring routes should be visibly distinguishable from those with at least one"
  - "Per-team median scope only: no league-wide median fallback for teams with zero non-null per-90 entries (RESEARCH Pitfall 4 — a fallback median would mix across positions/roles)"
  - "DQ-01 proxy always fills xg_per90 (never None in final dict): tests use goals_scored/assists to control per-90 values rather than understat dict format"
  - "Strict inequality for above-median check (> not >=): players exactly at the median do not satisfy routes 4–5"

patterns-established:
  - "TDD test helper pattern: _build_two_player_team() uses DQ-01-aware goals_scored scaling (goals = xg * 10 at minutes=900) to produce deterministic per-90 values without understat dict setup"

requirements-completed: [RTP-01]

# Metrics
duration: 3min
completed: 2026-05-07
---

# Phase 76 Plan 01: Routes to Points Pipeline Pass Summary

**`routes_to_points` (0..5) post-loop pass in pipeline/merge.py computing pen-taker, FK-taker, corner-taker, above-median-xG, and above-median-xA routes per player — TDD RED→GREEN cycle with 5 pytest cases**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-07T11:19:15Z
- **Completed:** 2026-05-07T11:22:09Z
- **Tasks:** 3 (Task 1: RED tests, Task 2: GREEN implementation, Task 3: REQUIREMENTS alignment)
- **Files modified:** 3

## Accomplishments

- Implemented `routes_to_points` (integer 0..5) post-loop pass in `pipeline/merge.py`, inserted after the differential-flag pass (line 1098) and before the xPts-ceiling pass (line 1100)
- Created `pipeline/tests/test_merge_routes.py` with 5 pytest unit tests covering all route combinations, the zero-routes case, the null-xg/xa case, and the 0..5 range invariant
- Updated `REQUIREMENTS.md` RTP-01 range from "1–5" to "0–5" to align with UI-SPEC §Copywriting decision
- All 112 pipeline tests pass (0 regressions)

## Task Commits

1. **Task 1: Wave 0 — Write failing pytest cases (RED)** - `fcdd06e` (test)
2. **Task 2: Add routes_to_points post-loop pass (GREEN)** - `89925e7` (feat)
3. **Task 3: Update REQUIREMENTS.md RTP-01 range** - `1f5d7f4` (chore)

## Files Created/Modified

- `pipeline/tests/test_merge_routes.py` — 5 pytest unit tests for routes_to_points (TDD RED→GREEN)
- `pipeline/merge.py` — 40-line routes_to_points post-loop pass between differential-flag and ceiling passes
- `.planning/REQUIREMENTS.md` — RTP-01 entry range corrected from "1–5" to "0–5"

## Route Definitions (Verbatim)

| Route | Field | Condition |
|-------|-------|-----------|
| 1 | `penalties_order` | `== 1` |
| 2 | `direct_freekicks_order` | `== 1` |
| 3 | `corners_and_indirect_freekicks_order` | `== 1` |
| 4 | `xg_per90` | strictly `>` per-team median (non-null values only) |
| 5 | `xa_per90` | strictly `>` per-team median (non-null values only) |

## Pytest Output

```
pipeline\tests\test_merge_routes.py .....                                [100%]
5 passed in 0.04s
```

All 112 pipeline tests:
```
112 passed in 2.89s
```

## Decisions Made

1. **Range 0..5 (not 1..5):** Zero is a meaningful signal — a player with no point-scoring routes is exactly the kind of player the user should NOT transfer in. Clamping to 1 would inflate the bottom of the distribution and hide the most informative signal. The `0` digit is rendered directly (not as an em-dash, which is reserved for absent/null data).

2. **Per-team median only (no league fallback):** Teams with zero non-null per-90 entries produce no median entry; their players cannot satisfy routes 4–5. A league-wide median fallback would conflate across positions and roles, producing spurious route firings. This matches RESEARCH Pitfall 4.

3. **Strict `>` for above-median:** A player exactly at the team median is NOT above median. Consistent with how a tied player at the median is below the threshold by definition.

4. **DQ-01 proxy awareness in tests:** The pipeline's DQ-01 fallback always fills `xg_per90 = goals_scored / minutes * 90` when understat data is absent. Tests use `goals_scored = xg * 10` at `minutes=900` to get deterministic per-90 values without needing the full understat dict format.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test helper to use DQ-01-compatible understat/id_map format**
- **Found during:** Task 1 (test file creation)
- **Issue:** The plan's `_build_two_player_team` template passed `understat` as a list of dicts (with `id`, `xG_per90` keys) and `id_map` as `{1: 1, 2: 2}`. The actual `merge_players` signature expects `understat: dict` keyed by string player ID with `xG`, `xA`, `minutes` values, and `id_map: dict` keyed by string FPL ID with `{'understat_id': int|None}` values.
- **Fix:** Used `understat = {}` (empty dict) and `id_map = {str(pid): {'understat_id': None}}` so DQ-01 proxy fills `xg_per90` from `goals_scored / minutes * 90`. Set `goals_scored = round(xg * 10)` (with minutes=900) to achieve target per-90 values.
- **Files modified:** `pipeline/tests/test_merge_routes.py`
- **Verification:** All 5 tests pass; `merge_players` call succeeds without TypeError

**2. [Rule 1 - Bug] Fixed test_routes_none_xg_xa_skipped assertion**
- **Found during:** Task 1 (test file creation)
- **Issue:** The plan's test 4 asserted `p1.get('xg_per90') is None`. This can never be true in the current pipeline — DQ-01 always overwrites a None xg_per90 with `goals_scored/minutes*90` (producing 0.0 when goals_scored=0).
- **Fix:** Updated assertion to `p1.get('xg_per90') == 0.0`. The test still verifies the routes_to_points logic handles zero xg_per90 correctly (routes 4 and 5 evaluate False when xg=0.0 < positive team median).
- **Files modified:** `pipeline/tests/test_merge_routes.py`
- **Verification:** Test passes and correctly verifies routes_to_points=1 (only pen-taker route fires)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test helper bugs in plan template)
**Impact on plan:** Both fixes were necessary for the tests to call merge_players correctly. The functional intent of all 5 tests is preserved; only the input construction and one assertion were corrected to match actual pipeline behavior.

## Issues Encountered

- None beyond the deviations documented above.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The `routes_to_points` field is derived solely from already-public FPL bootstrap fields and existing per-90 values that are already shipped to the client. No new sensitive data.

## Next Phase Readiness

- `routes_to_points` field is available on every player dict in `merged_players.json` after any pipeline run
- Plan 02 (Wave 2, GemTable Routes column) can now read `player.routes_to_points` and render it as a sortable integer column
- No blockers

## Self-Check: PASSED

- FOUND: `pipeline/tests/test_merge_routes.py`
- FOUND: `pipeline/merge.py` (routes_to_points pass)
- FOUND: `.planning/REQUIREMENTS.md` (RTP-01 range updated)
- FOUND: `.planning/phases/076-analytics-enhancements/076-01-SUMMARY.md`
- Commits verified: `fcdd06e`, `89925e7`, `1f5d7f4`
- 112/112 pipeline tests pass

---

*Phase: 076-analytics-enhancements*
*Completed: 2026-05-07*
