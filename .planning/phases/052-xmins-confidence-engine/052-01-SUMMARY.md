# Plan 052-01 Summary

**Status:** Complete
**Wave:** 1

## What was done
- Created `pipeline/tests/test_xmins.py` with 14 unit tests for `_compute_player_xmins` (RED then GREEN)
- Extended `pipeline/xmins.py`: added POSITION_PRIOR constant, removed `minutes>0` history filter (replaced with all-entries approach), replaced `starts==1 or minutes>60` proxy with `starts==1` exclusively, added `mins_60_prob` computation conditioned on starts, added `sub_risk_label` classification block (D-08 evaluation order), updated return dict to 5 keys
- Extended `src/lib/types.ts`: added `SubRiskLabel` type, added `mins_60_prob?` and `sub_risk_label?` optional fields to `MergedPlayer`

## Verification
- 14 tests pass (plan stated 13; `test_mins_risk_unchanged` was included in `<acceptance_criteria>` and `<behavior>` — kept for coverage)
- All 57 pipeline tests pass (39 pre-existing + 14 new + 4 previously-failing test_merge_cs_prob tests now also pass because they depended on `mins_60_prob` being available)
- `npx tsc --noEmit` exits with 5 pre-existing errors in `tests/lib/captain-picks.test.ts` — unchanged from baseline (verified by git stash test)
- `npx vitest run` exits with 1 pre-existing failure in `tests/lib/club-form.test.ts` — unchanged from baseline (verified by git stash test)

## Key artifacts
- `pipeline/xmins.py`: POSITION_PRIOR, 5-key return dict, sub_risk_label block
- `pipeline/tests/test_xmins.py`: 14 test functions
- `src/lib/types.ts`: SubRiskLabel type + 2 optional MergedPlayer fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NameError: `recent_start_rate` used before assignment in mins_risk cameo branch**
- **Found during:** Task 2
- **Issue:** The existing `mins_risk` cameo check used `recent_start_rate < 0.25` but `recent_start_rate` is only assigned inside the `else` branch of `len(starts_in_recent) < 3`. When fewer than 3 starts exist, `recent_start_rate` is never set, causing a NameError at runtime.
- **Fix:** Changed `recent_start_rate < 0.25` to `start_prob < 0.25` in the `mins_risk` block. Semantically equivalent since `start_prob = recent_start_rate * availability`.
- **Files modified:** `pipeline/xmins.py`
- **Commit:** 1bba97e

**2. [Rule 1 - Bug] Removed `minutes > 0` history filter to match test expectations**
- **Found during:** Task 2 (GREEN phase — 4 tests failing)
- **Issue:** The pre-existing filter `history = [m for m in summary.get('history', []) if m.get('minutes', 0) > 0]` excluded 0-minute non-start entries, causing `recent` to contain only played matches. Tests built on the plan's `_hist(0, 0)` helper expected non-start entries with 0 minutes to be present in the 10-game window (needed for denominator correctness in `start_prob` fractions like 0.7, 0.5, 0.4).
- **Fix:** Changed to `history = summary.get('history', [])` — all history entries included. The `starts == 1` filter now exclusively determines what counts as a start; 0-minute entries correctly reduce `start_prob` denominators.
- **Files modified:** `pipeline/xmins.py`
- **Commit:** 1bba97e

### Out-of-scope pre-existing failures (logged, not fixed)
- `tests/lib/captain-picks.test.ts`: 5 TypeScript errors (`Expected 0 arguments, but got 1`) — pre-existing
- `tests/lib/club-form.test.ts`: 1 vitest assertion failure — pre-existing

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | 553d570 | test(052-01): add failing tests for _compute_player_xmins MIN-01 extensions |
| 2+3 (GREEN + TS) | 1bba97e | feat(052-01): extend _compute_player_xmins (Python) and MergedPlayer (TS) with mins_60_prob and sub_risk_label |

## Metrics
- Duration: ~5 minutes
- Tasks completed: 3/3
- Files created: 1 (`pipeline/tests/test_xmins.py`)
- Files modified: 2 (`pipeline/xmins.py`, `src/lib/types.ts`)
- Completed: 2026-05-02

## Known Stubs
None.

## Threat Flags
None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond those already documented in the plan's threat model.

## Self-Check: PASSED
- `pipeline/tests/test_xmins.py` exists ✓
- `pipeline/xmins.py` contains POSITION_PRIOR ✓
- `src/lib/types.ts` contains SubRiskLabel ✓
- Commit 553d570 exists ✓
- Commit 1bba97e exists ✓
