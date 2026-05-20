---
phase: 128-pre-season-auto-activation
plan: 02
subsystem: pipeline
tags: [python, pipeline, orchestration, pre-season, activation, idempotency]

# Dependency graph
requires:
  - phase: 128-01
    provides: suggest_squad(force=False) kwarg — Plan 01 added force param; Plan 02 calls suggest_squad(force=True) in activation block
  - phase: 126-next-season-planner
    provides: suggest_squad.py dual-path idempotency baseline; archive_season.py GW38 pattern
provides:
  - pipeline/run.py activation block: IS_OFF_SEASON-guarded tri-state predicate + pre_season_active.json write + force-recompute on first detection
  - pipeline/suggest_squad.py: force=False parameter applied (worktree did not inherit Plan 01 changes; applied here as Rule 3 fix)
affects: [128-03, 128-04, 128-pre-season-auto-activation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-fatal try/except activation gate: mirrors IS_GW38 suggest_squad wrapper pattern in run.py"
    - "Dual-path artifact existence check: blob list + local path, same pattern as IS_GW38 archive-load"
    - "if not force: wrapping both idempotency branches in suggest_squad — prevents force=True from aborting early in local dev"

key-files:
  created: []
  modified:
    - pipeline/run.py
    - pipeline/suggest_squad.py

key-decisions:
  - "season_id derivation corrected to str(_year-1)[-2:]+str(_year)[-2:] — plan's formula f'{_year-1}{str(_year)[2:]}' produced '202526' not '2526' (Rule 1 auto-fix)"
  - "suggest_squad.py force parameter applied in this worktree — Plan 01 added it to main but this worktree predates that merge (Rule 3 blocking fix)"
  - "Activation block placed at top-level inside run() function, after IS_GW38 block closes, guarded by new if IS_OFF_SEASON: — not nested inside existing else: branch"
  - "archive-absent path: pre_season_active.json still written; squad recompute skipped with non-fatal stderr log"

patterns-established:
  - "Pattern: activation artifact gate mirrors IS_GW38 archive-load dual-path (blob list + local os.path.exists)"
  - "Pattern: from suggest_squad import suggest_squad inside try block (not module-level) — matches IS_GW38 import pattern"

requirements-completed: [AUTO-01, AUTO-02]

# Metrics
duration: 15min
completed: 2026-05-20
---

# Phase 128 Plan 02: Pre-season activation block in pipeline/run.py

**IS_OFF_SEASON-guarded tri-state predicate writes pre_season_active.json on first detection of next-season bootstrap and calls suggest_squad(force=True) to force-recompute the ILP squad against fresh prices**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-20T07:10:00Z
- **Completed:** 2026-05-20T07:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `pipeline/run.py` gains the Phase 128 activation block: positioned after IS_GW38 closes (line 245), before `if not IS_OFF_SEASON:` (line 310), guarded by its own `if IS_OFF_SEASON:` wrapper
- Tri-state predicate evaluates `len(events) >= 38 and not any(e.get('finished') for e in events) and bool(events[0].get('deadline_time') if events else None)` with correct short-circuit ordering
- Dual-path idempotency: blob list check (USE_BLOB=true) / local os.path.exists (dev) before any write
- First activation: writes `pre_season_active.json` with `{activated_at, season_id}` then calls `suggest_squad(bootstrap, _arch, force=True)`; archive-absent path logs stderr and continues
- Subsequent runs: prints "already activated — skipping" and exits block cleanly
- Exception in block is caught by non-fatal `try/except Exception as _pa_exc` — pipeline never crashes
- `suggest_squad.py` updated with `force: bool = False` parameter and both idempotency branches wrapped in `if not force:` (required by this worktree; Plan 01 changes not present)

## Task Commits

1. **Task 1: Insert Phase 128 activation block in pipeline/run.py** - `e6d093e` (feat)
2. **Task 2: Smoke test + season_id bug fix** - `6ef150d` (fix)

## Files Created/Modified
- `pipeline/run.py` - Activation block inserted (57 lines); season_id derivation corrected
- `pipeline/suggest_squad.py` - force=False param added; both idempotency branches wrapped in if not force:

## Decisions Made
- Placed activation block with its own `if IS_OFF_SEASON:` guard at top-level (not inside the existing `else:` branch of `if not IS_OFF_SEASON:`) — ensures the block runs in the same scope as IS_GW38 where `cache_dir` and `events` are accessible
- Used `import vercel_blob as _vb` and `import vercel_blob as _vb2` inside the try block for the two blob-path branches — matches IS_GW38 late-import pattern; avoids module-level side effects

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected season_id derivation formula**
- **Found during:** Task 2 (smoke test)
- **Issue:** Plan formula `f"{_year-1}{str(_year)[2:]}"` with `_year=2026` produces `"202526"` (appends integer 2025 and string "26"). CONTEXT.md example shows `"2526"` but the formula gives a 6-digit string.
- **Fix:** Changed to `f"{str(_year - 1)[-2:]}{str(_year)[-2:]}"` — takes last 2 digits of both year-1 and year, giving `"25"+"26"="2526"` for 2026.
- **Files modified:** `pipeline/run.py`
- **Verification:** Smoke test asserted `_season_id == '2526'`; also verified 2026/27 gives `"2627"`
- **Committed in:** `6ef150d`

**2. [Rule 3 - Blocking] Applied suggest_squad force parameter to this worktree**
- **Found during:** Task 1 (reading worktree's suggest_squad.py)
- **Issue:** This worktree was forked before Phase 128 Plan 01 ran. Plan 01 added `force: bool = False` to `suggest_squad.py` and wrapped idempotency in `if not force:`. Without this, `suggest_squad(bootstrap, _arch, force=True)` would fail with `TypeError: suggest_squad() got an unexpected keyword argument 'force'`.
- **Fix:** Applied same `force` parameter refactor to worktree's `suggest_squad.py` — added `force: bool = False`, wrapped both blob-path and local-path idempotency in single `if not force:` block, updated docstring.
- **Files modified:** `pipeline/suggest_squad.py`
- **Verification:** `python -m py_compile pipeline/suggest_squad.py` passes; 288 tests GREEN
- **Committed in:** `e6d093e`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** Both fixes necessary for correctness. season_id fix prevents malformed artifact. force param fix prevents TypeError crash. No scope creep.

## Issues Encountered
- Accidental commit to `main` branch (reverted via `git revert`) before discovering the worktree requires all operations in `.claude/worktrees/agent-a454633a9d8be1acb/`. Reverted cleanly; all subsequent commits correctly target the worktree branch.

## Known Stubs
None — activation block writes a real artifact when triggered; no placeholder data.

## Threat Flags
None — `pre_season_active.json` is a pipeline-internal artifact (no user input; written by trusted pipeline code; read-only via API). No new network endpoints, auth paths, or schema changes in this plan.

## Next Phase Readiness
- `pipeline/run.py` activation block is complete; `pre_season_active.json` will be written on next pipeline run where the tri-state predicate is True and the artifact is absent
- `suggest_squad(force=True)` will force-recompute the ILP squad against newly published next-season prices
- Plan 03 (API route + usePreSeasonActive hook) and Plan 04 (UI pill + banner in NextSeasonPlannerTab) can proceed — they read `pre_season_active.json` which this plan writes
- No blockers

## Self-Check

- `pipeline/run.py` contains `Phase 128 AUTO-01/02`: FOUND (line 247)
- `pipeline/run.py` contains `pre_season_active.json`: FOUND (2 occurrences)
- `pipeline/run.py` contains `force=True`: FOUND (1 occurrence — line 295)
- `pipeline/run.py` contains `Pre-season activation non-fatal error`: FOUND (1 occurrence)
- `pipeline/suggest_squad.py` contains `force: bool = False`: FOUND
- `pipeline/suggest_squad.py` contains `if not force:` (exactly one): FOUND
- `python -m py_compile pipeline/run.py`: PASSED
- `python -m pytest pipeline/tests/ -x`: 288/288 GREEN
- Commit `e6d093e` exists: FOUND (feat(128-02))
- Commit `6ef150d` exists: FOUND (fix(128-02))

## Self-Check: PASSED

---
*Phase: 128-pre-season-auto-activation*
*Completed: 2026-05-20*
