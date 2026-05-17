---
phase: 116-prose-staleness-model-versioning-v1-21
plan: 03
subsystem: pipeline
tags: [python, accuracy, pipeline, typescript, types, schema]

# Dependency graph
requires:
  - phase: 63-model-versioning-calibration-charts
    provides: accuracy.py version record schema and VersionRecord TypeScript interface foundations
provides:
  - accuracy.py writes sample_gws integer field on both populated and empty backtest version records
  - VersionRecord TypeScript interface exposes sample_gws?: number (optional, backward compat)
  - Three regression tests covering populated, cold-start, and legacy-preservation cases
affects:
  - 116-04 (Wave 2 plan consuming sample_gws from VersionRecord for cold-start labeling in VersionHistoryTable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional field with ?? 0 defaulting — legacy cache backward compat pattern (established by CalibrationBucket.predicted_mean)"
    - "TDD RED/GREEN cycle for pure schema extension: tests assert key presence, value, and non-mutation of legacy entries"

key-files:
  created: []
  modified:
    - pipeline/accuracy.py
    - pipeline/tests/test_accuracy.py
    - src/lib/types.ts

key-decisions:
  - "sample_gws placed at end of dict literal (after gate_flags) in both write sites — any position is valid Python; end avoids merge conflicts with other gate_flags entries"
  - "Legacy version entries without sample_gws are preserved verbatim (not mutated) — existing read-and-append logic unchanged; UI consumers apply ?? 0 defaulting"
  - "TypeScript field is optional (sample_gws?: number) for backward compat with caches written before Phase 116"

patterns-established:
  - "Phase 116 VER-01 write-site pattern: add 'sample_gws': len(target_gws_desc) after gate_flags in new_version_record"
  - "Phase 116 cold-start pattern: add 'sample_gws': 0 after gate_flags in _empty_backtest version record"

requirements-completed:
  - VER-01

# Metrics
duration: 15min
completed: 2026-05-17
---

# Phase 116 Plan 03: sample_gws Schema Extension Summary

**accuracy.py version records gain sample_gws integer (len of finished GWs or 0 for cold start); VersionRecord TypeScript type gains sample_gws?: number; three regression tests cover populated, cold-start, and legacy-preservation cases**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-17T13:00:00Z
- **Completed:** 2026-05-17T13:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `compute_accuracy_backtest` in `accuracy.py` now writes `'sample_gws': len(target_gws_desc)` on the new version record (D-09)
- `_empty_backtest` now writes `'sample_gws': 0` on the cold-start version record (D-10)
- `VersionRecord` TypeScript interface gains `sample_gws?: number` with backward-compat semantics (D-11)
- Three new regression tests: populated count, cold-start zero, legacy non-mutation (T-116-03-01)
- All 46 accuracy tests pass; no new TypeScript compilation errors

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for sample_gws** - `0166883` (test)
2. **Task 1 GREEN: Add sample_gws to accuracy.py** - `e9fde9a` (feat)
3. **Task 2: Add sample_gws?: number to VersionRecord** - `117dc6e` (feat)

_Note: TDD tasks have multiple commits (test RED → feat GREEN)_

## Files Created/Modified
- `pipeline/accuracy.py` - Added `'sample_gws': len(target_gws_desc)` to `new_version_record` and `'sample_gws': 0` to `_empty_backtest` version record
- `pipeline/tests/test_accuracy.py` - Added three new tests for VER-01 (91 lines)
- `src/lib/types.ts` - Added `sample_gws?: number` field to `VersionRecord` interface

## Decisions Made
- sample_gws is placed at the end of each dict literal (after gate_flags) — valid Python dict order, minimizes future merge conflicts
- TypeScript field uses `?` (optional) rather than `| undefined` to match the existing CalibrationBucket.predicted_mean pattern
- Legacy entries in prior_cache are preserved verbatim (non-mutation) — the existing read-and-append dedup logic already provides this guarantee; test `test_legacy_version_records_without_sample_gws_are_preserved` enforces it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript error in `src/app/api/decision-history/route.test.ts` (Buffer type mismatch) — confirmed pre-existing via git stash check, not introduced by this plan's changes. Out of scope per deviation rule scope boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (Wave 2) is unblocked: `VersionRecord.sample_gws` is available for cold-start labeling in `VersionHistoryTable`
- `accuracy_backtest.json` production cache will be refreshed with `sample_gws` on the next pipeline run
- VER-01 requirement is closed

---
*Phase: 116-prose-staleness-model-versioning-v1-21*
*Completed: 2026-05-17*
