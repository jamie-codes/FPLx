---
phase: 128-pre-season-auto-activation
plan: 01
subsystem: pipeline
tags: [python, pytest, idempotency, ilp, pre-season, tdd, replica-function]

# Dependency graph
requires:
  - phase: 126-next-season-planner
    provides: suggest_squad.py with dual-path idempotency check (blob + local)
provides:
  - suggest_squad(bootstrap, archive, force=False) — force kwarg with both idempotency branches wrapped in if not force:
  - test_suggest_squad.py — 6 replica-function contract tests locking D-03/D-04 force param contract
  - _evaluate_activation_predicate replica in test_run_offseason.py — 7 new tests locking AUTO-01 predicate edge cases
affects: [128-02, 128-pre-season-auto-activation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Replica-function contract test: mirror production logic in test file to avoid importing PuLP/run.py side effects"
    - "force=False default kwarg: idempotency bypass without changing default caller behaviour"

key-files:
  created:
    - pipeline/tests/test_suggest_squad.py
  modified:
    - pipeline/suggest_squad.py
    - pipeline/tests/test_run_offseason.py

key-decisions:
  - "Both blob-path AND local-path idempotency checks wrapped in single if not force: block (D-03) — wrapping only one would allow force=True to still abort early in local dev"
  - "Replica-function pattern for test_suggest_squad.py avoids importing PuLP at test time; mirrors test_run_offseason.py precedent"
  - "Task 3 adds a 7th test (39-events DGW scenario) to the 6 required by the plan — covers the DGW edge case from project memory (GW33/GW36 DGW)"

patterns-established:
  - "Pattern: wrap idempotency-only guards in if not force: leaving all subsequent logic (ILP solve, save) unchanged"
  - "Pattern: replica-function contract tests for pipeline modules with import side effects"

requirements-completed: [AUTO-01, AUTO-02]

# Metrics
duration: 3min
completed: 2026-05-20
---

# Phase 128 Plan 01: suggest_squad force parameter + activation predicate tests

**suggest_squad gains force=False keyword arg wrapping dual-path idempotency in one if not force: block; 13 new tests lock the D-03/D-04 force contract and AUTO-01 tri-state predicate with empty-list short-circuit safety**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-20T07:03:35Z
- **Completed:** 2026-05-20T07:05:56Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `suggest_squad.py` refactored: `force: bool = False` param added; both blob-path and local-path idempotency guards moved inside single `if not force:` block; docstring updated per D-04
- New `test_suggest_squad.py`: 6 replica-function tests cover all force/path/presence combinations for D-03/D-04 contract; no PuLP import at test time
- Extended `test_run_offseason.py`: `_evaluate_activation_predicate` replica function added; 7 new tests cover 38-event happy path, DGW 39-event case, any-finished false-path, len<38 false-path, deadline_time absent/None false-path, empty list no-IndexError

## Task Commits

1. **Task 1: Refactor suggest_squad.py — wrap idempotency in `if not force:`** - `1f62b25` (feat)
2. **Task 2: Create pipeline/tests/test_suggest_squad.py — force param contract tests** - `1a1af96` (test)
3. **Task 3: Extend test_run_offseason.py with Phase 128 activation predicate tests** - `3d96b45` (test)

## Files Created/Modified
- `pipeline/suggest_squad.py` - Added `force: bool = False` parameter; wrapped dual-path idempotency in `if not force:`; updated docstring
- `pipeline/tests/test_suggest_squad.py` - New file: `_should_skip_due_to_idempotency` replica + 6 contract tests (force=False+blob/local skip/proceed; force=True+blob/local bypass)
- `pipeline/tests/test_run_offseason.py` - Appended `_evaluate_activation_predicate` replica function + 7 predicate edge-case tests

## Decisions Made
- Used single `if not force:` block wrapping both Blob and local path checks (not two separate `if not force:` guards) — matches D-03 intent and Pattern 1 in PATTERNS.md; plan docs Pitfall 3 as the regression risk if only one branch is wrapped
- Added an extra 39-event DGW test (test_activation_predicate_true_when_39_events_with_dgw) beyond the 6 required by the plan's behavior block, covering GW33/GW36 DGW scenario from project memory — minor additive deviation that strengthens the predicate contract

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The extra DGW test is an additive enhancement within the task scope, not a bug fix.

## Issues Encountered
None. All tests green on first run. Full pipeline suite: 301/301 GREEN.

## Known Stubs
None.

## Threat Flags
None — this plan modifies Python pipeline test files only; no new network endpoints, auth paths, or schema changes.

## Next Phase Readiness
- `suggest_squad(bootstrap, archive, force=True)` is ready for the Plan 02 activation block in `run.py`
- Both AUTO-01 and AUTO-02 contracts are locked under regression tests before Plan 02 integrates them
- No blockers

## Self-Check

- `pipeline/suggest_squad.py` contains `force: bool = False`: FOUND
- `pipeline/suggest_squad.py` contains `if not force:` (exactly one): FOUND
- `pipeline/tests/test_suggest_squad.py` exists: FOUND
- `pipeline/tests/test_run_offseason.py` contains `_evaluate_activation_predicate`: FOUND
- Commit `1f62b25` exists: FOUND
- Commit `1a1af96` exists: FOUND
- Commit `3d96b45` exists: FOUND

## Self-Check: PASSED

---
*Phase: 128-pre-season-auto-activation*
*Completed: 2026-05-20*
