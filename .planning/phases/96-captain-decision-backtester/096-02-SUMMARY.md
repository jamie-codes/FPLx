---
phase: 96-captain-decision-backtester
plan: "02"
subsystem: pipeline
tags: [python, vercel-blob, snapshot, back-01, pipeline]

# Dependency graph
requires:
  - phase: 96-01
    provides: pipeline/tests/test_captain_snapshots.py (Wave 1 RED test)
provides:
  - pipeline/captain_snapshots.py with write_captain_snapshot() exported
  - pipeline/run.py wired to call write_captain_snapshot(captain_picks, current_gw) after predictions snapshot block
  - test_captain_snapshots.py extended with run.py contract regression test (5 tests total)
affects:
  - 96-03 (API route that reads captain_picks_gw{N}.json from Blob)
  - 96-04 (UI that consumes the API route)

# Tech tracking
tech-stack:
  added: [vercel-blob (already in requirements.txt, installed for test environment)]
  patterns:
    - Deferred import pattern for Blob uploads (import inside function, not at module top)
    - Source-code contract test pattern (read run.py as text, assert ordering invariants)

key-files:
  created:
    - pipeline/captain_snapshots.py
    - pipeline/tests/test_captain_snapshots.py
  modified:
    - pipeline/run.py

key-decisions:
  - "Deferred import of upload_json inside write_captain_snapshot() — matches existing project convention, enables monkeypatching in tests without module-level import failures"
  - "Call placed after predictions snapshot block (line ~344) not after line 227 — both captain_picks and current_gw must be in scope"
  - "No top-level vercel_blob import — keeps cold-start cost minimal, consistent with predictions snapshot pattern"

patterns-established:
  - "write_captain_snapshot() is the seam for Blob side-writes — callers (run.py) delegate to this module, tests mock vercel_blob.put directly"
  - "Contract regression tests read run.py as text (not import) to avoid dotenv side effects"

requirements-completed:
  - BACK-01

# Metrics
duration: 15min
completed: 2026-05-11
---

# Phase 96 Plan 02: Captain Decision Backtester — Pipeline Snapshot Summary

**Per-GW captain snapshot side-write via `write_captain_snapshot()` in new `pipeline/captain_snapshots.py`, wired into `pipeline/run.py` after the Phase 41 predictions snapshot block — SC-1 satisfied, all 5 contract tests GREEN**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T15:29:00Z
- **Completed:** 2026-05-11T15:44:02Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Created `pipeline/captain_snapshots.py` exposing a single function `write_captain_snapshot(captain_picks, current_gw)` that uploads to Vercel Blob when `USE_BLOB=true`, and is a no-op otherwise
- Wired the call into `pipeline/run.py` immediately after the existing predictions snapshot Blob side-write at line 342 — additive, existing `captain_picks.json` save at line 227 untouched
- Extended `pipeline/tests/test_captain_snapshots.py` with a 5th contract regression test that reads run.py as text and asserts ordering invariants (captain call must follow predictions block)
- Full pipeline test suite: 203/203 passing, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pipeline/captain_snapshots.py** - `ea50100` (feat)
2. **Task 2: Wire write_captain_snapshot into pipeline/run.py** - `4b6269e` (feat)
3. **Task 3: Add run.py contract regression test** - `873e85b` (test)

## Files Created/Modified

- `pipeline/captain_snapshots.py` - New module; single exported function `write_captain_snapshot(captain_picks, current_gw)` encapsulating the Blob side-write seam
- `pipeline/tests/test_captain_snapshots.py` - Wave 1 RED test (copied from main repo) + 5th regression test appended; all 5 pass
- `pipeline/run.py` - 5-line insertion (1 blank, 2 comment, 1 import, 1 call) at line ~344 after predictions snapshot block

## Decisions Made

- Deferred import of `upload_json` inside `write_captain_snapshot()` rather than at module top — matches existing project convention in `run.py` predictions block and avoids cold-start vercel_blob dependency when USE_BLOB is false
- Call placed at line ~344 (after predictions snapshot block) not at line ~228 (immediately after `save('captain_picks.json')`) — the plan's insertion point is the only location where both `captain_picks` and `current_gw` (assigned at line 333) are simultaneously in scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing vercel-blob package for test environment**
- **Found during:** Task 1 (running test_captain_snapshots.py)
- **Issue:** `vercel_blob` not installed in the worktree's Python environment; tests use `patch('vercel_blob.put')` which requires the module to exist
- **Fix:** `pip install vercel-blob` — package was already in `pipeline/requirements.txt`
- **Files modified:** None (environment-only)
- **Verification:** `python -c "import vercel_blob; print('OK')"` succeeded; all 4 tests then passed
- **Committed in:** n/a (environment setup, not code change)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking install)
**Impact on plan:** Install was required for test execution; package was already declared in requirements.txt. No scope creep.

## Issues Encountered

- Test file `pipeline/tests/test_captain_snapshots.py` existed in the main repo (created by Wave 1 / Plan 01) but was not present in the worktree. Copied it at the start of Task 1 execution.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The Blob write path (`pipeline/captain_snapshots.py`) is covered by T-96-04 through T-96-08 in the plan's threat model. No new threat flags.

## Next Phase Readiness

- SC-1 satisfied: `pipeline/run.py` will write `captain_picks_gw{N}.json` to Vercel Blob on each production run
- Plan 03 (API route `/api/captain-history`) can now read these Blob objects — the filename convention `captain_picks_gw{N}.json` is established
- Plan 04 (UI BacktesterTab) depends on Plan 03 which depends on this plan — dependency chain complete

---
*Phase: 96-captain-decision-backtester*
*Completed: 2026-05-11*
