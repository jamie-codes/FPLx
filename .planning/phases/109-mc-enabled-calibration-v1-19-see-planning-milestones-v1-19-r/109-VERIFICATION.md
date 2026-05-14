---
phase: 109-mc-enabled-calibration-v1-19-see-planning-milestones-v1-19-r
verified: 2026-05-14T14:20:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 109: MC-Enabled Calibration Verification Report

**Phase Goal:** User trusts the calibration evidence more because predicted haul rates are now grounded in actual 10k-sim MC `haul_prob` percentiles rather than an analytical xPts decile-rank proxy — and the CalibrationHealthIndicator on the Decision Summary labels which mode the calibration is running in so the manager knows whether they are looking at MC-grounded or analytical-fallback evidence.
**Verified:** 2026-05-14T14:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Calibration backtest uses MC `haul_prob` as `predicted_rate` per decile bin, replacing xPts decile-rank proxy, gated by `mc_enabled` flag | ✓ VERIFIED | `_compute_calibration_data` lines 562-618: MC path sorts by `merged_haul_lookup.get(player_id, 0.0)` and sets `predicted_rate = round(bucket_sum_haul_prob[pos_key][d] / total, 4)`. Analytical path unchanged with `predicted_rate = bucket_mids[d]`. `calibration_mode` written to summary on both `compute_accuracy_backtest` (line 423) and `_empty_backtest` (line 506). Gate: `use_mc = mc_enabled and coverage_pct >= 0.80` (line 381). |
| 2 | `CalibrationHealthIndicator` renders a distinguishing mode label (teal `MC` badge or zinc `Analytical` badge) derived from `accuracy_backtest.json.summary.calibration_mode`; no new fetch or endpoint | ✓ VERIFIED | Component lines 17-28: `MODE_BADGE_CLASSES` and `MODE_BADGE_LABEL` Records; line 72: `calibrationMode` read from `data.summary?.calibration_mode`; lines 89-96: conditional badge render in populated branch only; 14 vitest tests pass (9 pre-existing + 5 new), all 14 green. |
| 3 | Graceful degradation: players missing `haul_prob` contribute `effective_haul_prob = 0.0`; `calibration_mode = 'mc'` still reported when ≥80% covered; never NaN, never empty chart | ✓ VERIFIED | `pipeline/accuracy.py` line 576: `effective_haul_prob = merged_haul_lookup.get(row['player_id'], 0.0) if use_mc else 0.0`. Coverage gate uses `len(merged_haul_lookup) / total_elements`. Tests: `test_mc_calibration_missing_player_gets_zero_haul_prob` (no KeyError, no NaN), `test_mc_calibration_mode_analytical_when_coverage_below_threshold` (below 80% → analytical). |

**Score:** 3/3 truths verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MC-CAL-01 | 109-01-PLAN.md | Calibration pipeline uses MC `haul_prob` as `predicted_rate`, replacing analytical proxy | ✓ SATISFIED | `pipeline/accuracy.py`: `_compute_calibration_data` MC path, `compute_accuracy_backtest` calibration_mode, `run.py` haul_lookup wire-up. 43 Python tests pass. |
| MC-CAL-02 | 109-02-PLAN.md | `CalibrationHealthIndicator` surfaces MC-based calibration evidence with mode label | ✓ SATISFIED | `CalibrationHealthIndicator.tsx`: teal MC / zinc Analytical badge, D-11 bug fix (predicted_rate not bucket_mid in maxDeviation). 14 component tests pass. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/accuracy.py` | `_compute_calibration_data` with `use_mc + merged_haul_lookup`; `calibration_mode` in summary | ✓ VERIFIED | Signature at line 520-524; `use_mc` branch at 562-568; `bucket_sum_haul_prob` accumulator at 556; `calibration_mode` written at line 423 and 506. Substantive — not a stub. |
| `pipeline/accuracy.py::_empty_backtest` | `calibration_mode: 'analytical'` in summary | ✓ VERIFIED | Line 506: `'calibration_mode': 'analytical', # Phase 109 MC-CAL-01: no merged data in empty path` |
| `pipeline/run.py` | `haul_lookup` built from merged list, passed to `compute_accuracy_backtest` | ✓ VERIFIED | Line 326-328: dict comprehension built, coverage print on line 327, passed as `merged_haul_lookup=haul_lookup` on line 328. |
| `src/lib/types.ts` | `AccuracySummary.calibration_mode?: 'mc' \| 'analytical'` | ✓ VERIFIED | Line 358: `calibration_mode?: 'mc' \| 'analytical'  // Phase 109 MC-CAL-01`. `CalibrationBucket.predicted_rate` comment updated to mention MC mode at line 464. |
| `src/components/squad/CalibrationHealthIndicator.tsx` | `MODE_BADGE_CLASSES`, `MODE_BADGE_LABEL`, conditional badge render, D-11 bug fix | ✓ VERIFIED | Lines 17-28: both Records present with exact Tailwind classes. Line 70: `Math.abs(b.actual_rate - b.predicted_rate)` (D-11 fix). Lines 89-96: conditional badge render. Cold-start branch (lines 54-66) unchanged — no badge there. |
| `pipeline/tests/test_accuracy.py` | MC calibration tests covering mode field, predicted_rate, fallback, coverage threshold, missing haul_prob | ✓ VERIFIED | 9 new MC tests (lines 842-1011); all pass (43 total Python tests green). |
| `src/components/squad/CalibrationHealthIndicator.test.tsx` | 5 new tests: MC badge, Analytical badge, undefined null-render, cold-start absence, D-11 bug fix | ✓ VERIFIED | Lines 141-195; `makeMcBucket` helper at lines 12-19; all 14 tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/run.py` | `pipeline/accuracy.py::compute_accuracy_backtest` | `merged_haul_lookup=haul_lookup` | ✓ WIRED | Line 328: `compute_accuracy_backtest(..., merged_haul_lookup=haul_lookup)`. No `total_merged_count` (see Notes). |
| `pipeline/accuracy.py::compute_accuracy_backtest` | `pipeline/accuracy.py::_compute_calibration_data` | `use_mc=use_mc, merged_haul_lookup=merged_haul_lookup` | ✓ WIRED | Lines 386-390: `_compute_calibration_data(per_gw_rows, use_mc=use_mc, merged_haul_lookup=merged_haul_lookup)`. |
| `pipeline/accuracy.py` output dict | `accuracy_backtest.json.summary` | `'calibration_mode': calibration_mode` | ✓ WIRED | Line 423: `'calibration_mode': calibration_mode, # Phase 109 MC-CAL-01`. |
| `src/components/squad/CalibrationHealthIndicator.tsx` | `data.summary.calibration_mode` | `calibrationMode` local const + conditional render | ✓ WIRED | Line 72: `const calibrationMode = data.summary?.calibration_mode as CalibrationMode \| undefined`. Lines 89-96: `{calibrationMode && (...)}`. |
| `src/components/squad/CalibrationHealthIndicator.tsx::computeTier` | `b.predicted_rate` | `maxDeviation` deviation calculation | ✓ WIRED | Line 70: `Math.max(...buckets.map((b) => Math.abs(b.actual_rate - b.predicted_rate)))`. No reference to `b.bucket_mid` in deviation calc. |
| `src/lib/types.ts::AccuracySummary` | `CalibrationHealthIndicator.tsx` | `calibration_mode` optional field | ✓ WIRED | TypeScript compiles cleanly (`npx tsc --noEmit` exits 0). Field accessed at line 72 without type error. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `CalibrationHealthIndicator.tsx` | `calibrationMode` | `data.summary?.calibration_mode` from `useAccuracy` hook → `accuracy_backtest.json` | YES — pipeline writes `'mc'` or `'analytical'` on every run; optional field degrades gracefully to `undefined` for legacy caches | ✓ FLOWING |
| `_compute_calibration_data` MC path | `predicted_rate` per bucket | `bucket_sum_haul_prob / total` — accumulated from `merged_haul_lookup.get(player_id, 0.0)` | YES — lookup built from live `merged` list which has `haul_prob` from 10k MC sims (Phase 102) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Python MC tests pass | `python -m pytest pipeline/tests/test_accuracy.py -q` | 43 passed in 0.18s | ✓ PASS |
| All component tests pass (14 total) | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | 14 passed | ✓ PASS |
| TypeScript compilation clean | `npx tsc --noEmit` | Exit 0, no errors | ✓ PASS |
| `calibration_mode` field present in summary dict | grep `'calibration_mode': calibration_mode` in accuracy.py | Found at line 423 | ✓ PASS |
| `calibration_mode: 'analytical'` in `_empty_backtest` | grep in accuracy.py | Found at line 506 | ✓ PASS |
| `haul_lookup` wired in run.py | grep `merged_haul_lookup=haul_lookup` in run.py | Found at line 328 | ✓ PASS |

### Anti-Patterns Found

No blockers found. Notable observations:

| File | Detail | Severity | Impact |
|------|--------|----------|--------|
| `pipeline/tests/test_accuracy.py` | Import line 21 does NOT include `_compute_calibration_data` (required by PLAN acceptance criteria). Tests use `_build_mc_inputs` helper instead of the planned `_seed_prior_cache`. Test names differ from PLAN spec (prefixed `test_mc_` not `test_calibration_`). | INFO | None — the 9 actual tests cover all functional MC behaviors. Tests are more numerous and pass 100%. PLAN acceptance criteria are internal to plan execution; ROADMAP SCs are the contract. |
| `pipeline/accuracy.py` | Coverage denominator uses `total_elements` (started bootstrap players) not `total_merged_count` from run.py (PLAN specified a `total_merged_count: int = 0` parameter). The parameter was not added. | INFO | The coverage gate still functions correctly — bootstrap started players is a valid and actually more conservative denominator. ROADMAP SC #3 is satisfied. `run.py` does not pass `total_merged_count` but also does not need to. |
| `pipeline/tests/test_accuracy.py` | No dedicated test for `_empty_backtest` having `calibration_mode='analytical'` (PLAN required `test_calibration_empty_backtest_has_calibration_mode`). The pre-existing `test_calibration_xpts_means_cold_start_absence` checks `calibration` presence but not `calibration_mode`. | INFO | The implementation is correct (line 506 confirmed). Only the test is absent. Not a ROADMAP blocker. |

### Human Verification Required

None — all observable behaviors are verifiable programmatically. The mode badge visual appearance (teal vs zinc colour in-browser) is covered by class-name assertions in the component tests.

### Notes on Plan Deviations

The implementation diverges from PLAN acceptance criteria in three places:

1. **`total_merged_count` parameter absent** — PLAN 109-01 specified `compute_accuracy_backtest(..., total_merged_count: int = 0)` and a corresponding pass from `run.py`. The implementation instead derives the denominator from `bootstrap.elements` directly inside `accuracy.py`. The functional result (80% coverage gate) is preserved and arguably more semantically correct.

2. **Test names and helpers differ** — PLAN 109-01 specified exact test function names (e.g. `test_calibration_mode_mc_written_to_summary`) and `_seed_prior_cache` / `_compute_calibration_data` import. The implementation uses `test_mc_*` prefixed names, `_build_mc_inputs` helper, and does not import `_compute_calibration_data` directly. The 9 implemented tests cover the same functional territory and all pass.

3. **No explicit empty-backtest calibration_mode test** — the code at line 506 is correct; the test gap is minor.

None of these deviations affect ROADMAP Success Criteria compliance.

---

_Verified: 2026-05-14T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
