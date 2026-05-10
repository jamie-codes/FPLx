---
phase: 89-event-aware-pipeline-scheduling
plan: 01
subsystem: testing
tags: [pytest, pipeline, refresh_gate, tdd, red-gate, github-actions]

# Dependency graph
requires:
  - phase: 82-data-health-dashboard
    provides: test_data_health.py pattern for RED-gate test structure, bare-import style, factory helper pattern
provides:
  - pipeline/tests/test_refresh_gate.py with 8 deterministic test cases for check_deadline_window() and main()
  - Locked contract: check_deadline_window(events, now, window_minutes) -> bool + main() catches all exceptions
affects:
  - 89-02 (implements refresh_gate.py to turn this RED gate GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 RED gate: test file created before implementation to lock function contract"
    - "Deterministic time injection: now= parameter avoids datetime.now() monkeypatching"
    - "patch.object on module-level import for HTTP failure simulation"

key-files:
  created:
    - pipeline/tests/test_refresh_gate.py
  modified: []

key-decisions:
  - "8 test cases instead of the 6 mentioned in CONTEXT.md — plan spec added test_naive_iso_string_treated_as_utc and clarified test_failure_skip vs test_cold_bootstrap as distinct cases"
  - "NOW fixed at datetime(2026, 8, 16, 9, 0, tzinfo=timezone.utc) — deterministic baseline for all window calculations"
  - "patch.object(refresh_gate, 'get_bootstrap_static') requires importing refresh_gate module inside test body to allow patch.object to work — matches RESEARCH.md A2 resolution"

patterns-established:
  - "RED gate test file: all check_deadline_window tests inject now=NOW and window_minutes=90 explicitly"
  - "Factory helper _events(*offsets_minutes): builds events list with Z-suffix ISO timestamps at NOW + offset"

requirements-completed:
  - REFRESH-01

# Metrics
duration: 10min
completed: 2026-05-10
---

# Phase 89 Plan 01: Event-Aware Pipeline Scheduling Summary

**Wave 0 RED gate: 8-case pytest contract for `check_deadline_window()` + `main()` deadline-window logic, failing at collection until Plan 02 creates `refresh_gate.py`**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-10T00:00:00Z
- **Completed:** 2026-05-10T00:10:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `pipeline/tests/test_refresh_gate.py` with 8 deterministic test functions
- Locked function contract: `check_deadline_window(events, now=None, window_minutes=None) -> bool`
- Locked module contract: `main()` catches all exceptions, writes `run=false` to `$GITHUB_OUTPUT`, always returns without raising
- Confirmed RED gate: `python -m pytest pipeline/tests/test_refresh_gate.py --collect-only` exits non-zero with `ModuleNotFoundError: No module named 'refresh_gate'`
- `conftest.py` left unmodified (sys.path injection inherited automatically)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RED test file with 6 boundary cases + main() failure-skip test** - `4d1de8c` (test)

**Plan metadata:** (to be committed with SUMMARY.md)

## Files Created/Modified
- `pipeline/tests/test_refresh_gate.py` - 8-case pytest contract for Phase 89 refresh_gate module; RED until Plan 02

## Decisions Made
- 8 test cases (plan spec expanded from CONTEXT.md's 6) — includes `test_naive_iso_string_treated_as_utc` (defensive tzinfo guard) and separates `test_failure_skip` (empty list) from `test_cold_bootstrap` (also empty list, but semantically end-of-season)
- Fixed NOW at `datetime(2026, 8, 16, 9, 0, tzinfo=timezone.utc)` for determinism — no datetime.now() monkeypatching needed

## Deviations from Plan

None - plan executed exactly as written. Test file content matches the exact specification in the plan's `<action>` block.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (GREEN): implement `pipeline/refresh_gate.py` with `check_deadline_window()` + `main()` to turn this RED gate GREEN
- Plan 02 must also update `.github/workflows/pipeline.yml` with concurrency guard, gate step, and two new dense cron entries
- All 8 test cases will pass once `refresh_gate.py` is created with correct implementation

---
*Phase: 89-event-aware-pipeline-scheduling*
*Completed: 2026-05-10*
