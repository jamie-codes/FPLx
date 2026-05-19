---
phase: 126-next-season-planner
plan: 02
subsystem: pipeline
tags: [python, pulp, blob-storage, concurrent-fetch, ilp, archive, gw38-gate]

# Dependency graph
requires:
  - phase: 126-01
    provides: pre-season types in types.ts, pulp>=2.7.0 in requirements.txt, RED test scaffold for archive_season

provides:
  - pipeline/archive_season.py — NSP-01 season archive (concurrent fetch, idempotent Blob write, 50% partial-write guard)
  - pipeline/suggest_squad.py — NSP-02 ILP fallback via PuLP (budget/size/position/team-cap constraints)
  - GW38 gate in pipeline/run.py (IS_GW38 flag, non-fatal invocations before IS_OFF_SEASON block)
affects: [126-03, 126-04]

# Tech tracking
tech-stack:
  added: [pulp 3.3.1 (COIN-BC ILP solver, already in requirements.txt from Plan 01), concurrent.futures.ThreadPoolExecutor (stdlib)]
  patterns:
    - GW38 gate pattern in run.py — IS_GW38 derived from current_event_entry vs last_event_id; positioned BEFORE IS_OFF_SEASON block
    - Idempotency-first pattern — _blob_exists() is the first statement in archive_season(); prevents partial re-run overwrite
    - Per-future exception catch in as_completed loop — allows _fetch_one to raise without aborting the batch
    - Non-fatal re-raise pattern in suggest_squad() — errors logged and re-raised; outer caller (run.py) catches and continues

key-files:
  created:
    - pipeline/archive_season.py
    - pipeline/suggest_squad.py
  modified:
    - pipeline/run.py

key-decisions:
  - "archive_season.py uses import-inside-function for vercel_blob in _blob_exists() so unit tests can monkeypatch without loading SDK"
  - "_fetch_all_summaries() catches exceptions from future.result() individually — allows _fetch_one to raise (test pattern) without aborting the concurrent batch"
  - "GW38 gate inserted between IS_OFF_SEASON assignment and if not IS_OFF_SEASON: block (Pitfall 1 prevention)"
  - "suggest_squad ILP fallback reads local archive from pipeline/cache/ after archive_season writes it; skips gracefully on Blob-only path"
  - "suggest_squad() wraps body in try/except that logs and re-raises — run.py outer wrapper handles non-fatal isolation"

patterns-established:
  - "Idempotency-first: _blob_exists() call must be the FIRST statement in any one-time-per-season pipeline function"
  - "Per-future exception catch: when patching _fetch_one in tests to raise, as_completed loop must catch from future.result()"
  - "GW38 gate: positioned BEFORE IS_OFF_SEASON block in run.py; uses is_current event detection not off-season flag"

requirements-completed: [NSP-01, NSP-02]

# Metrics
duration: 35min
completed: 2026-05-19
---

# Phase 126 Plan 02: Next Season Planner Pipeline Summary

**Concurrent season archive pipeline step (ThreadPoolExecutor, 50% partial-write guard, idempotent Blob write) + PuLP ILP fallback squad builder wired into run.py behind GW38 gate**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-19T11:30:00Z
- **Completed:** 2026-05-19T12:05:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created `pipeline/archive_season.py` (NSP-01): concurrent element-summary fetcher with `ThreadPoolExecutor(max_workers=10)`, idempotency check via `_blob_exists()` as first statement, 50% partial-write guard, per-future exception handling; all 4 RED pytest tests transitioned GREEN
- Created `pipeline/suggest_squad.py` (NSP-02 Python side): PuLP ILP solver with budget (<=1000 tenths), squad size (==15), position MIN/MAX, and team cap (<=3) constraints; `_compute_score_map()` applies 500-min eligibility filter (D-02); derives starters/bench/formation string; writes `pre_season_squad.json` via `save()`
- Modified `pipeline/run.py`: inserted GW38 gate (IS_GW38 from `current_event_entry` vs `last_event_id`) BEFORE the IS_OFF_SEASON block, with non-fatal try/except for both archive_season and suggest_squad invocations

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement pipeline/archive_season.py** - `15cc2c7` (feat)
2. **Task 2: Implement pipeline/suggest_squad.py** - `036c028` (feat)
3. **Task 3: Add GW38 gate in pipeline/run.py** - `42be26d` (feat)

## Files Created/Modified

- `pipeline/archive_season.py` — Per-player season archive: `archive_season()`, `_blob_exists()`, `_fetch_one()`, `_fetch_all_summaries()` with MAX_WORKERS=10 and 50% guard
- `pipeline/suggest_squad.py` — PuLP ILP fallback: `suggest_squad()`, `_solve_ilp()`, `_compute_score_map()`, `_derive_squad_dict()`; writes `pre_season_squad.json`
- `pipeline/run.py` — Added IS_GW38 detection block + non-fatal archive_season + suggest_squad invocations before IS_OFF_SEASON gate

## Decisions Made

- `vercel_blob` imported lazily inside `_blob_exists()` (not at module level) so unit tests can monkeypatch `archive_season._blob_exists` without the SDK being loaded
- `_fetch_all_summaries()` catches exceptions from `future.result()` individually — when the test patches `_fetch_one` to raise, the exception propagates through the ThreadPoolExecutor future; catching at the `future.result()` call site makes per-player failures non-fatal in all code paths
- GW38 gate position: immediately before the IS_OFF_SEASON-guarded block (Pitfall 1 from RESEARCH.md); archive runs during GW38 when `is_current=True`, not after rollover
- `suggest_squad()` reads local `pipeline/cache/season_archive_gw38.json` after `archive_season()` writes it (local dev path); skips gracefully when archive not on disk (Blob-only production path)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Test `test_non_fatal_player_failures_do_not_abort` patches `_fetch_one` to raise an exception (not return `(id, None)`). This means exceptions propagate from `future.result()` in `_fetch_all_summaries()`. The initial PATTERNS.md pattern only showed a `(pid, None)` return path; the implementation needed an additional `try/except` around `future.result()` to handle raised exceptions from the patched function. Added inline, all 4 tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `pipeline/archive_season.py` ready for Plan 03/04 (TypeScript greedy builder reads `season_archive_gw38.json` via API route)
- `pipeline/suggest_squad.py` writes `pre_season_squad.json` as ILP fallback when greedy returns null
- Run `python -m pytest pipeline/test_archive_season.py` to verify GREEN status (4/4 pass)
- `pulp` installed in local env (3.3.1); must also be available in GitHub Actions runner when `pipeline/run.py` runs with IS_GW38=True

---
*Phase: 126-next-season-planner*
*Completed: 2026-05-19*
