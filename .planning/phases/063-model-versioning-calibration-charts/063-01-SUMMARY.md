---
phase: 063
plan: 01
subsystem: accuracy-pipeline-tests
tags: [testing, calibration, versioning, tdd, red-state]
dependency_graph:
  requires: []
  provides: [063-01-test-stubs]
  affects: [063-02-PLAN, 063-03-PLAN, 063-04-PLAN]
tech_stack:
  added: []
  patterns: [nyquist-wave-0, red-green-refactor]
key_files:
  created: []
  modified:
    - pipeline/tests/test_accuracy.py
    - src/components/accuracy/AccuracyTab.test.tsx
decisions:
  - "Wave 0 RED-only plan: test stubs written before any implementation lands; both files intentionally fail"
  - "fixtureWithVersionsAndCalibration added as separate fixture alongside unchanged fixtureBacktest to avoid touching legacy fixture"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 63 Plan 01: RED Test Stubs for VER-01/VER-02/CAL-01/CAL-02 Summary

Wave 0 Nyquist RED test stubs committed to establish the verification contract for Phase 63 — 6 Python stubs for `FORMULA_VERSION` import + VER-01/CAL-01/CAL-02, and 6 React stubs for `VersionHistoryTable`, `CalibrationSection`, and `PositionTabSelector` (VER-02/CAL-01/CAL-02). Both files fail in intentional RED state pending Plan 02 implementation.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add 6 RED Python test stubs (VER-01/CAL-01/CAL-02) | d44b1db | pipeline/tests/test_accuracy.py |
| 2 | Add 6 RED React test stubs (VER-02/CAL-01/CAL-02) | 3a21a71 | src/components/accuracy/AccuracyTab.test.tsx |

## What Was Built

### Task 1 — Python RED stubs (pipeline/tests/test_accuracy.py)

- Updated import line to reference `FORMULA_VERSION` (causes intentional `ImportError` at collection time until Plan 02 adds the constant)
- Added 3 VER-01 tests: `test_version_record_appended`, `test_version_dedup`, `test_version_cold_start`
- Added 3 CAL-01/CAL-02 tests: `test_calibration_structure`, `test_calibration_sparse_filter`, `test_calibration_by_position`
- Total test count: 23 (was 17 before this plan)
- RED state: `ImportError: cannot import name 'FORMULA_VERSION'` at collection

### Task 2 — React RED stubs (src/components/accuracy/AccuracyTab.test.tsx)

- Added `fixtureWithVersionsAndCalibration` fixture with 2 version records and calibration by_position data
- Added Phase 63 describe block with 6 new it() stubs covering VER-02 and CAL-01/CAL-02
- Total it() count: 11 (was 5 before this plan)
- RED state: 5/6 new tests fail with `Unable to find element` (VersionHistoryTable/CalibrationSection don't exist yet); 1/6 (legacy-cache suppression) passes spuriously but is still a meaningful future-behaviour contract

## Verification Results

Python RED state confirmed:
```
ImportError: cannot import name 'FORMULA_VERSION' from 'accuracy'
```

React RED state confirmed:
```
5 tests | 5 failed
TestingLibraryElementError: Unable to find an element with the text: Model Version History
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan only adds test stubs (Wave 0). No production code or data was stubbed.

## Threat Flags

None — this plan only modifies test files; no production code, API surface, user input handling, or auth paths introduced.

## Self-Check

- [x] pipeline/tests/test_accuracy.py modified with 6 new test functions
- [x] src/components/accuracy/AccuracyTab.test.tsx modified with 6 new it() blocks
- [x] Both commits exist: d44b1db, 3a21a71
- [x] Python RED state: ImportError on FORMULA_VERSION confirmed
- [x] React RED state: 5 failures on missing components confirmed
- [x] Existing tests untouched (17 Python tests + 5 React tests unchanged)

## Self-Check: PASSED
