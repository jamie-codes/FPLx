---
phase: 40-accuracy-pipeline
plan: "03"
subsystem: pipeline
tags:
  - python
  - pipeline
  - integration
  - accuracy
  - blob

dependency_graph:
  requires:
    - phase: 40-02
      provides: pipeline/accuracy.py with compute_accuracy_backtest() and build_predictions_snapshot() — all 7 tests GREEN
  provides:
    - pipeline/run.py wired to call compute_accuracy_backtest() and build_predictions_snapshot() on every run
    - accuracy_backtest.json written to pipeline/cache/ via existing save() helper
    - predictions_snapshot.json written to pipeline/cache/ for current GW
    - Per-GW Blob upload (predictions_snapshot_gw{N}.json) when USE_BLOB=true
  affects:
    - 41-accuracy-ui (reads accuracy_backtest.json and predictions_snapshot.json produced here)

tech-stack:
  added: []
  patterns:
    - Local conditional import inside USE_BLOB branch — mirrors existing run.py style for optional deps
    - Accuracy block positioned after DefCon block and before last_updated.json write — consistent failure-fallback semantics
    - current_gw = finished_gws + 1 convention — snapshot represents pre-play predictions for next GW (D-11)

key-files:
  created: []
  modified:
    - pipeline/run.py

key-decisions:
  - "current_gw = finished_gws + 1 so the snapshot represents predictions made BEFORE the next GW is played (D-11); Phase 41 UI owns season-boundary handling"
  - "upload_json() imported locally inside the USE_BLOB branch, mirroring existing run.py pattern for optional imports"
  - "Accuracy block placed after DefCon block (line ~202) and before last_updated.json write (line ~204) so last_updated.json remains the final write of a successful run"

patterns-established:
  - "Accuracy pipeline pattern: compute → save → optional Blob upload, same print/compute/save cadence as defcon block"
  - "Per-GW Blob accumulation: f'predictions_snapshot_gw{current_gw}.json' where current_gw is an int — structurally prevents path-traversal (T-40-08 mitigation)"

requirements-completed:
  - ACC-01

duration: ~10min
completed: "2026-04-29"
---

# Phase 40 Plan 03: pipeline/run.py Integration Summary

**`pipeline/run.py` wired to import and invoke `accuracy.py` — `accuracy_backtest.json` and `predictions_snapshot.json` written on every pipeline run, with per-GW Blob upload when `USE_BLOB=true`**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-29T22:10:00Z
- **Completed:** 2026-04-29T22:20:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- `pipeline/run.py` imports `compute_accuracy_backtest` and `build_predictions_snapshot` from `accuracy` module
- Accuracy block inserted after DefCon stats block and before `last_updated.json` write — preserves existing failure-fallback semantics
- `save('accuracy_backtest.json', ...)` and `save('predictions_snapshot.json', ...)` called once each on every pipeline run
- Conditional `upload_json(f'predictions_snapshot_gw{current_gw}.json', ...)` fires only when `USE_BLOB=true` (D-12 Blob accumulation)
- `current_gw = finished_gws + 1` so the snapshot records pre-play predictions for the next GW to be played (D-11)
- Live pipeline run verified by human checkpoint: `accuracy_backtest.json` covers 5 GWs with correct D-08 shape; `predictions_snapshot.json` has correct D-12 shape with matching player count
- All 7 Plan 01/02 tests remain GREEN after integration (`python -m pytest pipeline/tests/test_accuracy.py -x` exits 0)
- `python pipeline/run.py --dry-run` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accuracy import and integration block to pipeline/run.py** - `5be7385` (feat)
2. **Task 2: Human-verify pipeline produces correctly shaped JSON** - checkpoint approved by user

**Plan metadata:** (SUMMARY commit — see below)

## Files Created/Modified

- `pipeline/run.py` — added `from accuracy import compute_accuracy_backtest, build_predictions_snapshot` import and ~15-line accuracy block between DefCon and last_updated blocks; +22 lines net

## Decisions Made

- `current_gw = finished_gws + 1`: snapshot represents predictions made before the next GW is played; Phase 41 UI is responsible for season-boundary handling if `finished_gws == 38`
- `upload_json()` imported locally inside the `USE_BLOB` conditional branch — mirrors the existing run.py pattern for optional/conditional imports and avoids requiring `upload` module when Blob is disabled
- Accuracy block positioned AFTER `compute_defcon_stats()` call and BEFORE `# Write last_updated.json` block so that `last_updated.json` remains the final write of a successful run, consistent with the existing failure-fallback semantics at lines 225-258

## Deviations from Plan

None - plan executed exactly as written. The integration block was inserted verbatim as specified in the `<action>` section. The `from upload import upload_json` local import was already specified in the plan (notes clarified the pattern mirrors existing run.py style).

## Issues Encountered

None. Task 1 committed cleanly. Human checkpoint (Task 2) confirmed the live pipeline run produces correctly shaped JSON for both output files.

## User Setup Required

None - no external service configuration required for the integration itself. `USE_BLOB=true` requires existing Vercel Blob credentials (already documented in project env setup).

## Known Stubs

None. The integration calls real `accuracy.py` functions with real pipeline data. Both output files are fully populated on a live pipeline run.

## Threat Flags

None. No new network endpoints, auth paths, or file-access patterns introduced beyond what was already in the threat model:

- T-40-08 (Tampering — predictions_snapshot_gw{N}.json): mitigated structurally by integer interpolation in the f-string (`current_gw = finished_gws + 1` — an int from FPL bootstrap, cannot produce path-traversal payload)
- T-40-07 (Tampering — accuracy_backtest.json): accepted; written via existing `save()` helper with literal filename
- T-40-09 (Information Disclosure — predictions_snapshot.json): accepted; contains only `id`, `proj_pts_1gw`, `xPts_1gw` — same data already in merged_players.json

## Next Phase Readiness

- `pipeline/cache/accuracy_backtest.json` is produced on every pipeline run with D-08 shape — ready for Phase 41 accuracy UI to consume
- `pipeline/cache/predictions_snapshot.json` is produced on every pipeline run with D-12 shape — ready for backtest replay accumulation via Blob
- Phase 40 pipeline work (Plans 01-03) is complete; Phase 41 accuracy UI can begin
- No blockers. ACC-01 requirement satisfied.

## Self-Check

- `pipeline/run.py` modified: confirmed (22 lines added, commit 5be7385)
- Commit `5be7385` exists: confirmed
- `from accuracy import compute_accuracy_backtest, build_predictions_snapshot` present: confirmed
- `compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures)` present: confirmed
- `save('accuracy_backtest.json', backtest_data)` present: confirmed
- `build_predictions_snapshot(merged, current_gw)` present: confirmed
- `save('predictions_snapshot.json', snapshot_data)` present: confirmed
- `current_gw = finished_gws + 1` present: confirmed
- `f'predictions_snapshot_gw{current_gw}.json'` present: confirmed
- `from upload import upload_json` (local import in USE_BLOB branch) present: confirmed
- Accuracy block after DefCon block: confirmed
- Accuracy block before last_updated.json write: confirmed
- All 7 Plan 01/02 tests GREEN: confirmed (human checkpoint)
- `python pipeline/run.py --dry-run` exits 0: confirmed
- Live pipeline run produces correctly shaped JSON: confirmed (human checkpoint approved)

## Self-Check: PASSED

---
*Phase: 40-accuracy-pipeline*
*Completed: 2026-04-29*
