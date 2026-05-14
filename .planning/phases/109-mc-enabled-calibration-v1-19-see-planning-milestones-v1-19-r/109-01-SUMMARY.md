---
phase: 109
plan: 01
subsystem: pipeline/calibration
tags: [mc-calibration, accuracy, python, typescript, testing]
requires: [102-01, 103-01]
provides: [calibration_mode_field, mc_bucketing, mode_badge_ui]
affects: [pipeline/accuracy.py, pipeline/run.py, src/lib/types.ts, src/components/squad/CalibrationHealthIndicator.tsx]
tech-stack:
  added: []
  patterns: [mc-coverage-gate, calibration-mode-badge]
key-files:
  created: []
  modified:
    - pipeline/accuracy.py
    - pipeline/run.py
    - pipeline/tests/test_accuracy.py
    - src/lib/types.ts
    - src/components/squad/CalibrationHealthIndicator.tsx
    - src/components/squad/CalibrationHealthIndicator.test.tsx
decisions:
  - use_mc derived from mc_enabled AND coverage >= 80% per D-03
  - predicted_rate = mean(haul_prob) per bucket in MC mode; bucket_mid preserved for backward compat
  - MODE_BADGE_CLASSES uses teal for MC (visual parity with MCDistributionBar), zinc for Analytical
  - maxDeviation bug fix uses b.predicted_rate not b.bucket_mid (D-11 correction)
metrics:
  duration: ~30min
  completed: 2026-05-14
  tasks: 5
  files: 6
---

# Phase 109 Plan 01: MC-Enabled Calibration Summary

MC calibration path wired end-to-end: `pipeline/accuracy.py` now sorts calibration deciles by `haul_prob` and sets `predicted_rate = mean(haul_prob)` per bucket when `mc_enabled=True` and coverage >= 80%. `calibration_mode: 'mc' | 'analytical'` written to `accuracy_backtest.json` summary. `CalibrationHealthIndicator` gains a teal `[MC]` or zinc `[Analytical]` mode badge after the tier badge, plus the `maxDeviation` bug fixed to use `b.predicted_rate` instead of `b.bucket_mid`. 43 Python + 16 component tests GREEN.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add `calibration_mode` to `AccuracySummary` type | ad85f2e | src/lib/types.ts |
| 2 | MC calibration bucketing in accuracy.py | 4ef60a1 | pipeline/accuracy.py |
| 3 | Wire `merged_haul_lookup` in run.py | d706b59 | pipeline/run.py |
| 4 | Mode badge + maxDeviation fix in component | 97d23c6 | CalibrationHealthIndicator.tsx |
| 5 | Python + component tests | c0151b7 | test_accuracy.py, CalibrationHealthIndicator.test.tsx |

## Implementation Details

### pipeline/accuracy.py

`_compute_calibration_data()` gains `use_mc: bool = False` and `merged_haul_lookup: dict = None` parameters:
- MC path: sorts players by `merged_haul_lookup.get(player_id, 0.0)` descending; accumulates `bucket_sum_haul_prob` per decile; `predicted_rate = round(sum_haul_prob / total, 4)`
- Analytical path: unchanged — sorts by `xpts_predicted`, `predicted_rate = bucket_mid`
- `bucket_mid` field preserved in both modes for backward compat with existing charts

`compute_accuracy_backtest()` gains `merged_haul_lookup: dict = None` parameter:
- Derives `use_mc` from `mc_enabled AND coverage_pct >= 0.80` (D-03)
- Writes `calibration_mode: 'mc' | 'analytical'` to summary (D-04)
- Passes `use_mc` and `merged_haul_lookup` to `_compute_calibration_data`

### pipeline/run.py

Builds `haul_lookup = {p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}` immediately before the `compute_accuracy_backtest` call and passes it as `merged_haul_lookup=haul_lookup`. Logs coverage percentage for diagnostics.

### src/lib/types.ts

`AccuracySummary` gains `calibration_mode?: 'mc' | 'analytical'` (optional for legacy cache compat).

### src/components/squad/CalibrationHealthIndicator.tsx

- `MODE_BADGE_CLASSES` and `MODE_BADGE_LABEL` records added adjacent to `TIER_BADGE_CLASSES`
- `CalibrationMode = 'mc' | 'analytical'` local type
- Mode badge rendered after tier badge, before sentence: conditional on `data.summary?.calibration_mode` being defined
- Not rendered in cold-start branch (preserves Phase 103 cold-start UX unchanged)
- `maxDeviation` bug fixed: `b.actual_rate - b.predicted_rate` replaces `b.actual_rate - b.bucket_mid`

## Test Results

- Python: 43 tests pass (33 pre-existing + 10 new MC-CAL-01 tests)
- TypeScript: 16 component tests pass (9 pre-existing + 7 new mode badge + D-11 fix tests)
- Pre-existing failures unchanged: 4 test files (captain-picks, club-form, MobileNav, useRivals — out of scope)

## Deviations from Plan

None — plan executed exactly as specified in CONTEXT.md and UI-SPEC.md.

## Known Stubs

None — all MC fields are live in production (`MC_ENABLED = True` since Phase 102). The `calibration_mode` field will appear in `accuracy_backtest.json` on the next daily pipeline run.

## Threat Flags

None — no new network endpoints or auth paths introduced. Changes are internal pipeline and UI badge only.

## Self-Check: PASSED

- [x] pipeline/accuracy.py modified with MC calibration path
- [x] pipeline/run.py wired with haul_lookup
- [x] src/lib/types.ts updated with calibration_mode
- [x] CalibrationHealthIndicator.tsx updated with mode badge and D-11 fix
- [x] 43 Python tests pass
- [x] 16 component tests pass
- [x] SUMMARY.md committed before narration
- [x] Commits: ad85f2e, 4ef60a1, d706b59, 97d23c6, c0151b7
