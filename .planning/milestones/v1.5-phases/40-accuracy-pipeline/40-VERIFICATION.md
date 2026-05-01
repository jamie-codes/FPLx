---
phase: 40-accuracy-pipeline
verified: 2026-04-29T22:35:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `python pipeline/run.py` (without USE_BLOB) and inspect pipeline/cache/accuracy_backtest.json and pipeline/cache/predictions_snapshot.json"
    expected: "Both files exist and are non-empty. accuracy_backtest.json has top-level keys generated_at, gws_covered (5 GWs descending), summary (with xpts_hit_rate, proj_pts_hit_rate, gws array), haulters (entries with actual_pts >= 10), players (with gws sub-arrays). predictions_snapshot.json has keys gw, run_at (ISO 8601), players (matching merged_players.json count, each with id/proj_pts_1gw/xPts_1gw only). Haulter deltas are positive for surprise haulers (actual - predicted > 0) and negative for underperformers."
    why_human: "The live pipeline run requires real FPL credentials and network access. The Plan 03 SUMMARY states a human checkpoint was approved, but the verifier cannot re-run the pipeline to independently confirm the live JSON output shape. Automated tests confirm the unit-level contract; the live end-to-end shape must be confirmed manually or accepted via the Plan 03 checkpoint record."
---

# Phase 40: Accuracy Pipeline Verification Report

**Phase Goal:** Pipeline produces a per-GW backtest record comparing both projection models (proj_pts and xPts) against actual FPL points over the last 5 completed gameweeks, providing the data foundation for accuracy analysis
**Verified:** 2026-04-29T22:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `compute_accuracy_backtest()` and `build_predictions_snapshot()` exist in `pipeline/accuracy.py` | VERIFIED | File at pipeline/accuracy.py lines 37 and 233 define both functions |
| 2 | `compute_accuracy_backtest()` returns D-08 shape covering last 5 finished GWs | VERIFIED | All 7 pytest tests pass (7 passed in 0.02s); test_backtest_structure asserts gws_covered == [28..32] and all required top-level keys |
| 3 | `build_predictions_snapshot()` returns D-12 snapshot shape | VERIFIED | test_snapshot_format passes; function returns {gw, run_at, players} |
| 4 | Players who scored 10+ actual points appear in haulters[] | VERIFIED | HAULTER_THRESHOLD=10 constant at line 27; test_haulter_detection passes |
| 5 | Players ranked top-10 by xpts_predicted or proj_pts_predicted are flagged | VERIFIED | TOP_N_PREDICTED=10 at line 28; two-pass ranking implemented at lines 147-162 |
| 6 | DGW entries (same round) are aggregated into one entry per GW | VERIFIED | _group_history_by_gw() at line 272 sums minutes/total_points/xG/xA; test_dgw_aggregation passes |
| 7 | All 7 Plan 01 tests are GREEN | VERIFIED | `python -m pytest pipeline/tests/test_accuracy.py -x -v` — 7 passed in 0.02s |
| 8 | `run.py` imports and calls both functions, saving both output files | VERIFIED | Line 20: `from accuracy import compute_accuracy_backtest, build_predictions_snapshot`; lines 207-218: both functions called; both save() calls present |
| 9 | Accuracy block is positioned after DefCon block and before last_updated write | VERIFIED | compute_defcon_stats call at line 201; compute_accuracy_backtest call at line 207; last_updated write at line 243 |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/tests/__init__.py` | Python package marker | VERIFIED | Exists (33 bytes), confirmed via `ls -la` |
| `pipeline/tests/conftest.py` | sys.path injection | VERIFIED | Contains `sys.path.insert` and `PIPELINE_DIR` at lines 13-15 |
| `pipeline/tests/test_accuracy.py` | 7 RED-then-GREEN test functions | VERIFIED | 7 functions present, all pass; contains `from accuracy import compute_accuracy_backtest, build_predictions_snapshot` |
| `pipeline/accuracy.py` | compute_accuracy_backtest() + build_predictions_snapshot() | VERIFIED | 359 lines, 6 functions, all required constants and pitfall guards present |
| `pipeline/run.py` | Wired to call both functions | VERIFIED | Import at line 20, calls at lines 207/217, save() at lines 208/218, Blob upload at lines 221-224 |
| `pipeline/cache/accuracy_backtest.json` | Produced on pipeline run | HUMAN NEEDED | Cannot verify without live pipeline run; Plan 03 human checkpoint claims approval |
| `pipeline/cache/predictions_snapshot.json` | Produced on pipeline run | HUMAN NEEDED | Cannot verify without live pipeline run; Plan 03 human checkpoint claims approval |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/tests/conftest.py` | `pipeline/` (parent dir) | `sys.path.insert(0, PIPELINE_DIR)` | WIRED | Line 15 injects pipeline/ onto sys.path; PIPELINE_DIR computed at line 13 |
| `pipeline/tests/test_accuracy.py` | `pipeline/accuracy.py` | `from accuracy import compute_accuracy_backtest, build_predictions_snapshot` | WIRED | Line 21; imports resolve (7 tests pass) |
| `pipeline/accuracy.py` | `pipeline/merge.py` | `from merge import _compute_xpts_fixture` | WIRED | Line 25; import resolves (tests pass with merge in sys.path) |
| `pipeline/run.py` | `pipeline/accuracy.py` | `from accuracy import compute_accuracy_backtest, build_predictions_snapshot` | WIRED | Line 20; dry-run exits 0 confirming import resolves |
| `pipeline/run.py` | `pipeline/upload.py` | `save('accuracy_backtest.json', ...)` + `save('predictions_snapshot.json', ...)` + conditional `upload_json()` | WIRED | Lines 208, 218, 222-224; pattern matches existing save() usage |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `pipeline/accuracy.py::compute_accuracy_backtest` | `summaries`, `bootstrap`, `fixtures` | Passed in from `run.py` which fetches via `get_element_summary()`, `get_bootstrap_static()`, `get_fixtures()` | Yes — real FPL API data | FLOWING (unit-test verified; live-run human-needed) |
| `pipeline/accuracy.py::build_predictions_snapshot` | `merged` (list), `current_gw` (int) | `merged` from `merge_players()` containing real proj_pts_1gw and xPts_1gw | Yes — real merged player data | FLOWING |
| `pipeline/run.py` accuracy block | `backtest_data`, `snapshot_data` | Return values of `compute_accuracy_backtest()` and `build_predictions_snapshot()` | Yes — real computed dicts | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 7 unit tests pass | `python -m pytest pipeline/tests/test_accuracy.py -x -v` | 7 passed in 0.02s | PASS |
| accuracy.py parses as valid Python | `python -c "import ast; ast.parse(open('pipeline/accuracy.py').read())"` | OK parse | PASS |
| run.py parses as valid Python | `python -c "import ast; ast.parse(open('pipeline/run.py').read())"` | OK parse | PASS |
| dry-run exits 0 (imports resolve) | `python pipeline/run.py --dry-run` | "Dry run complete — USE_BLOB=false, source=local" | PASS |
| Constants present and correct values | grep HAULTER_THRESHOLD / TOP_N_PREDICTED / BACKTEST_GWS / MIN_MINUTES | 10 / 10 / 5 / 10 at lines 27-30 | PASS |
| accuracy block after defcon, before last_updated | grep -n on run.py | defcon call=201, accuracy call=207, last_updated write=243 | PASS |
| Live pipeline produces shaped JSON files | `python pipeline/run.py` (requires FPL network + credentials) | SKIP — needs live environment | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ACC-01 | 40-01, 40-02, 40-03 | Pipeline computes per-GW actual vs predicted delta for both proj_pts_1gw and xPts_1gw over the last 5 completed gameweeks using actual points from FPL element-summary history | SATISFIED | compute_accuracy_backtest() implements D-01..D-10; build_predictions_snapshot() implements D-11/D-12; both wired into run.py; all 7 tests GREEN |

**Note on ACC-02 through ACC-06:** These requirements are mapped to Phase 41 in REQUIREMENTS.md and are intentionally out of scope for Phase 40.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODOs, FIXMEs, stub returns, or placeholder patterns found in any Phase 40 files | — | — |

### Human Verification Required

#### 1. Live Pipeline Output Shape Verification

**Test:** From the project root, run `python pipeline/run.py` (without USE_BLOB). After completion:
1. Confirm `pipeline/cache/accuracy_backtest.json` exists and is non-zero bytes
2. Open it and confirm top-level keys: `generated_at`, `gws_covered`, `summary`, `haulters`, `players`
3. Confirm `gws_covered` lists 5 GWs in descending order (e.g. `[32, 31, 30, 29, 28]`)
4. Confirm `summary.gws` has 5 entries each with `gw`, `haulter_count`, `xpts_flagged`, `proj_pts_flagged`, `xpts_hit_rate`, `proj_pts_hit_rate`
5. Confirm `haulters` entries have `actual_pts >= 10`
6. Confirm `pipeline/cache/predictions_snapshot.json` exists with keys `gw`, `run_at` (ISO 8601), `players` (matching merged_players.json count, each with exactly `id`, `proj_pts_1gw`, `xPts_1gw`)
7. Spot-check a known haulter: confirm they appear in `haulters` with correct `actual_pts`
8. Confirm `xpts_delta` and `proj_pts_delta` signs: positive = surprise haul (actual > predicted), negative = underperformance

**Expected:** Both files exist with correct shapes; haulter detection matches actual FPL points; delta signs are correct.

**Why human:** Requires live FPL network access and credentials. The Plan 03 SUMMARY records a human checkpoint was approved by the user, but the verifier cannot independently re-execute the live pipeline run.

### Gaps Summary

No automated gaps found. All must-haves are VERIFIED by code inspection and test execution. The single human verification item (live pipeline output shape) cannot be confirmed programmatically and is marked `human_needed`. The Plan 03 SUMMARY records that the human checkpoint (Task 2) was approved by the user — this verification defers to that recorded approval pending independent confirmation.

---

_Verified: 2026-04-29T22:35:00Z_
_Verifier: Claude (gsd-verifier)_
