---
phase: 40-accuracy-pipeline
plan: "02"
subsystem: pipeline
tags:
  - python
  - pytest
  - accuracy
  - backtest
  - tdd
  - wave-1

dependency_graph:
  requires:
    - phase: 40-01
      provides: Seven RED unit tests in pipeline/tests/test_accuracy.py pinning compute_accuracy_backtest and build_predictions_snapshot contract
  provides:
    - pipeline/accuracy.py with compute_accuracy_backtest() and build_predictions_snapshot()
    - Pre-aggregated accuracy_backtest.json structure (D-08) via pure Python transform
    - Prediction snapshot format (D-12) for future backtest replay accumulation
  affects:
    - 40-03 (run.py integration — imports accuracy.py and wires save() calls)
    - 41-accuracy-ui (consumes accuracy_backtest.json pre-aggregated output)

tech-stack:
  added: []
  patterns:
    - defcon.py module pattern — top-level docstring, constants, public functions, private helpers with _ prefix, no HTTP calls, no file I/O
    - Cross-module private import (from merge import _compute_xpts_fixture) — established pattern from run.py
    - DGW aggregation via defaultdict summing minutes/total_points/xG/xA by round
    - Binary start_prob proxy for historical reconstruction (D-04: >=45 min = 1.0)
    - FPL 1-5 difficulty to 0-1 linear map: (d-1)/4.0 (D-03)

key-files:
  created:
    - pipeline/accuracy.py
  modified: []

key-decisions:
  - "MIN_MINUTES = 10 (Claude's Discretion): players who played <10 minutes excluded from GW backtest entries to filter DNP noise"
  - "Fixture difficulty keyed by (gw, player_own_team_id) not opponent_team — avoids Pitfall 1"
  - "Per-player gws list appended in target_gws_desc order so most recent GW appears first"
  - "delta convention: actual_pts - predicted (positive = surprise haul per CONTEXT.md Claude's Discretion)"

patterns-established:
  - "accuracy.py pattern: pure Python transform receiving summaries/finished_gws/bootstrap/fixtures from run.py, no re-fetching"
  - "Two-pass ranking: build all per-GW rows first, then rank across all players before haulter flagging (avoids Pitfall 4)"

requirements-completed:
  - ACC-01

duration: 6min
completed: "2026-04-29"
---

# Phase 40 Plan 02: Implement pipeline/accuracy.py (Wave 1 GREEN Gate) Summary

**`pipeline/accuracy.py` created with `compute_accuracy_backtest()` and `build_predictions_snapshot()` — pure Python backtest transform using historical `history[]` data and `_compute_xpts_fixture` from merge.py, turning all 7 Plan 01 RED tests GREEN in 0.04s**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-29T21:09:00Z
- **Completed:** 2026-04-29T21:15:43Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `pipeline/accuracy.py` created with 6 functions, 358 lines, zero new dependencies
- All 7 Wave 0 RED tests transition to GREEN (`python -m pytest pipeline/tests/test_accuracy.py -x` exits 0)
- D-01 through D-12 locked decisions all honoured in implementation
- Pitfall 1 (own team_id vs opponent_team for fixture lookup) mitigated by `fixture_difficulty[(gw, player_team_id)]` keying
- Pitfall 2 (starts==0 and missing summaries guards) both present
- Pitfall 4 (two-pass ranking over all players before haulter flagging) correctly implemented

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement pipeline/accuracy.py with backtest + snapshot functions** - `cf19ee1` (feat)

**Plan metadata:** (SUMMARY commit — see below)

## Files Created/Modified

- `pipeline/accuracy.py` - compute_accuracy_backtest(), build_predictions_snapshot(), plus private helpers _empty_backtest(), _group_history_by_gw(), _reconstruct_xpts(), _reconstruct_proj_pts()

## Decisions Made

- `MIN_MINUTES = 10` (Claude's Discretion from CONTEXT.md): excludes sub-cameo entries (<10 min) that add noise without meaningful prediction signal. Documented in module docstring.
- `actual_pts - predicted` delta convention (positive = surprise haul) per CONTEXT.md Claude's Discretion.
- Two-pass algorithm: build all per-GW rows in pass 1, then rank all players per GW before haulter flagging in pass 2 (required to satisfy Pitfall 4 — ranking pool must be complete).
- `fixture_difficulty` dict keyed by `(gw, player_own_team_id)` not `history[]['opponent_team']` (Pitfall 1 mitigation).

## Deviations from Plan

None - plan executed exactly as written. The plan provided complete implementation code; the module was written verbatim from the `<action>` block with minor cosmetic adaptation (type annotations simplified for Python 3.11 compatibility — `dict[tuple[int, int], float]` changed to `dict` to avoid runtime issues).

## Issues Encountered

None. All 7 tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. All functions are fully implemented with real logic.

## Threat Flags

None. `pipeline/accuracy.py` is a pure internal Python transform:
- No network endpoints introduced
- No auth paths added
- No file writes (file I/O delegated to run.py via save())
- Input data is already-validated FPL data from the pipeline's existing summaries dict
- T-40-03 mitigation present: all numeric reads use `entry.get(field, 0) or 0` pattern throughout

## Next Phase Readiness

- `pipeline/accuracy.py` is ready for import by Plan 03 (`run.py` integration)
- `compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures)` matches the call signature expected in 40-CONTEXT.md Integration Points
- `build_predictions_snapshot(merged, current_gw)` matches D-12 snapshot format exactly
- Plan 03 wires these two functions into run.py with two new `save()` calls

## Self-Check

- `pipeline/accuracy.py` exists: confirmed
- Commit `cf19ee1` exists: confirmed
- All 7 tests GREEN: confirmed (0.04s, 7 passed)
- `HAULTER_THRESHOLD = 10`, `TOP_N_PREDICTED = 10`, `BACKTEST_GWS = 5`, `MIN_MINUTES = 10`: confirmed (printed `10 10 5 10`)
- `from merge import _compute_xpts_fixture` present: confirmed
- `def compute_accuracy_backtest(` present: confirmed
- `def build_predictions_snapshot(` present: confirmed
- `(fix.get('team_h_difficulty', 3) - 1) / 4.0` present: confirmed
- `1.0 - (difficulty_score * 0.5)` present: confirmed
- `if element.get('starts', 0) == 0:` present: confirmed
- `if summary is None:` present: confirmed
- `grep -c "^def " pipeline/accuracy.py` = 6 (>=5): confirmed

## Self-Check: PASSED

---
*Phase: 40-accuracy-pipeline*
*Completed: 2026-04-29*
