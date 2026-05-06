---
phase: 063-model-versioning-calibration-charts
verified: 2026-05-06T09:10:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visit /accuracy in dev mode with a real pipeline-generated accuracy_backtest.json that contains versions and calibration fields. Confirm: (1) Version History table renders above GW Summary with correct (current) marker on last row; (2) Calibration chart renders the y=x reference diagonal; (3) switching position pills re-renders chart without animation jank; (4) GK pill (or any sparse position) shows 'Insufficient sample' overlay when no buckets pass n>=5"
    expected: "VersionHistoryTable renders with version strings, hit rate badges, delta cells, and gate-flag chips. CalibrationSection renders a recharts ComposedChart with a dashed diagonal ReferenceLine and an actual_rate Line. Pill switching is responsive. Sparse-position overlay reads exactly: 'Insufficient sample (n<5) for GK this window.'"
    why_human: "recharts ResponsiveContainer renders zero-height in jsdom; the test suite mocks it via data-testid only. Real SVG rendering and interactive chart behaviour require a browser. The pipeline-generated JSON with real calibration data is also required to verify the diagonal line traces near the diagonal (well-calibration signal)."
  - test: "Confirm dark mode renders correctly — both VersionHistoryTable and CalibrationSection respect zinc dark surface tokens. Verify HitRateBadge tier colours (green/amber/zinc) are readable in both modes."
    expected: "No washed-out text or invisible elements in dark mode."
    why_human: "Dark mode cannot be verified programmatically without a browser rendering engine."
---

# Phase 63: Model Versioning & Calibration Charts Verification Report

**Phase Goal:** The accuracy pipeline tracks model version history, and AccuracyTab users can compare accuracy across multiple model versions and inspect calibration reliability diagrams broken out by position
**Verified:** 2026-05-06T09:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every pipeline run writes a version record to `accuracy_backtest.json` containing formula version string, data timestamp, and all active gate flag states | VERIFIED | `FORMULA_VERSION = 'v1.12-a'` at line 37 of `pipeline/accuracy.py`; `_read_existing_versions` helper at line 73; version dedup-append block at lines 330-346; `'versions': versions` in return dict at line 364; `_empty_backtest` also returns `'versions': _read_existing_versions(cache_dir)` at line 418. All 3 VER-01 Python tests pass (23/23 pytest passed). |
| 2 | AccuracyTab shows a version comparison table with hit rate per version and a delta indicator | VERIFIED | `function VersionHistoryTable` at line 105 of `AccuracyTab.tsx` renders 5 columns (Version/Recorded/Hit Rate/Δ/Active Gates); `DeltaCell` reused for delta column; em-dash for first row; `(current)` marker on last row. Guard `data.versions && data.versions.length >= 1` at render line 577. React tests 'VER-02: VersionHistoryTable renders heading' and 'VER-02: first version row delta is em-dash; second row delta is +4.0 pp' both pass (11/11). |
| 3 | AccuracyTab shows a calibration reliability diagram — players predicted at each haul% bracket show the actual observed haul rate | VERIFIED | `function CalibrationSection` at line 234 of `AccuracyTab.tsx`; recharts `ComposedChart` with `Line dataKey="actual_rate"`; `XAxis type="number" domain={[0,1]}`; `ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]}` for y=x diagonal; `data-testid="calibration-chart"` on wrapper div. `_compute_calibration_data` helper in `accuracy.py` at line 423 produces decile buckets with `actual_rate`, `bucket_mid`, `predicted_rate`, `sample_n`. CAL-01 React test passes. |
| 4 | Calibration diagram is broken out by position (GK / DEF / MID / FWD) so position-specific over/under-confidence is visible | VERIFIED | `PositionTabSelector` at line 178 of `AccuracyTab.tsx` renders 5 pills (All/GK/DEF/MID/FWD) with `role="tablist"` and `aria-label="Calibration position filter"`; `useState<CalibrationPosition>('all')` in `CalibrationSection`; `_compute_calibration_data` produces `by_position` with keys `'all', '1', '2', '3', '4'` in Python. `test_calibration_by_position` passes. CAL-02 React test passes. |
| 5 | Both version comparison and calibration diagram are populated from static `accuracy_backtest.json` — no additional API route required | VERIFIED | Data flows through existing `/api/accuracy` route → `useAccuracy` hook → `data.versions` and `data.calibration` optional fields on `AccuracyBacktest`. No new API routes or pipeline scripts modified. All type extensions are optional, preserving backward compat with legacy cache. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/accuracy.py` | FORMULA_VERSION + _read_existing_versions + _compute_calibration_data + versions/calibration keys | VERIFIED | All 4 additions present; 629 lines (>= 600 min_lines); `FORMULA_VERSION = 'v1.12-a'` at line 37 |
| `src/lib/types.ts` | VersionGateFlags, VersionRecord, CalibrationBucket, CalibrationData interfaces; optional fields on AccuracyBacktest/AccuracySummary | VERIFIED | All 4 interfaces exported; `versions?: VersionRecord[]` and `calibration?: CalibrationData` on AccuracyBacktest |
| `src/components/accuracy/AccuracyTab.tsx` | VersionHistoryTable, CalibrationSection, PositionTabSelector; recharts imports; conditional render guards | VERIFIED | 585 lines; all 3 components present; recharts ComposedChart + ReferenceLine wired; guards at lines 577-578 |
| `pipeline/tests/test_accuracy.py` | 6 Phase 63 test stubs (3 VER-01, 3 CAL-01/CAL-02) all GREEN | VERIFIED | 23/23 pytest passed |
| `src/components/accuracy/AccuracyTab.test.tsx` | fixtureWithVersionsAndCalibration + Phase 63 describe block with 6 it() stubs all GREEN | VERIFIED | 11/11 vitest tests passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `accuracy.py compute_accuracy_backtest` | `accuracy_backtest.json` top-level `versions` key | `return {'versions': versions, ...}` at line 364 | WIRED | Dedup logic reads prior versions, appends new record with FORMULA_VERSION, gate_flags, hit_rate |
| `accuracy.py compute_accuracy_backtest` | `accuracy_backtest.json` top-level `calibration` key | `return {'calibration': calibration, ...}` at line 365 | WIRED | `_compute_calibration_data(per_gw_rows)` called at line 313 before return |
| `AccuracyTab.tsx VersionHistoryTable` | `data.versions: VersionRecord[]` | `data.versions.map((v, i) => ...)` inside tbody at line 121 | WIRED | Guard `data.versions && data.versions.length >= 1` at line 577 |
| `AccuracyTab.tsx CalibrationSection` | recharts ComposedChart + ReferenceLine | `ResponsiveContainer > ComposedChart` at lines 267-309 | WIRED | `segment={[{x:0,y:0},{x:1,y:1}]}` y=x diagonal; `Line dataKey="actual_rate"` |
| `AccuracyTab.tsx PositionTabSelector` | `useState<CalibrationPosition>('all')` | controlled component pattern at line 235 | WIRED | Pill clicks call `setPosition`; `chartData` useMemo re-derives on position change |
| `src/lib/types.ts AccuracyBacktest` | `useAccuracy` hook | `useQuery<AccuracyBacktest>` in `src/lib/hooks/useAccuracy.ts` — unchanged | WIRED | Optional field additions flow through automatically; no hook code change required |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `AccuracyTab.tsx VersionHistoryTable` | `data.versions` | `compute_accuracy_backtest` return dict → `/api/accuracy` JSON response | Yes — Python builds live version record with `overall_xpts_blended_hit` (real computed float) | FLOWING |
| `AccuracyTab.tsx CalibrationSection` | `data.calibration.by_position[position]` | `_compute_calibration_data(per_gw_rows)` — decile bucketing over real GW player rows | Yes — iterates actual `per_gw_rows` data built from real FPL history; not hardcoded | FLOWING |
| `AccuracyTab.tsx` sparse filter | `chartData` (filtered by `b.sample_n >= 5`) | useMemo over `data.calibration.by_position[position]` | Yes — filter passes through real bucket data; empty-state overlay when filtered array is empty | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 23 Python tests pass (incl. 6 Phase 63) | `cd pipeline && python -m pytest tests/test_accuracy.py -x -q` | 23 passed in 0.06s | PASS |
| All 11 React tests pass (incl. 6 Phase 63) | `npm test -- --run AccuracyTab` | 11 passed in 1.09s | PASS |
| FORMULA_VERSION importable from accuracy module | `from accuracy import FORMULA_VERSION` | `'v1.12-a'` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VER-01 | 063-01, 063-02 | Every pipeline run writes a version record with formula version, timestamp, gate flags | SATISFIED | `FORMULA_VERSION`, `_read_existing_versions`, version dedup-append all present and tested |
| VER-02 | 063-01, 063-04 | AccuracyTab shows version comparison table with hit rate delta indicator | SATISFIED | `VersionHistoryTable` with `DeltaCell` + `HitRateBadge` + `GateFlagsCell` present; 2 VER-02 tests green |
| CAL-01 | 063-01, 063-02, 063-04 | AccuracyTab shows calibration reliability diagram with actual haul rate per predicted haul% bracket | SATISFIED | `_compute_calibration_data` decile bucketing in Python; `CalibrationSection` with recharts `ComposedChart` + `ReferenceLine` y=x; CAL-01 tests green |
| CAL-02 | 063-01, 063-02, 063-04 | Calibration diagram broken out by position (GK/DEF/MID/FWD) | SATISFIED | `by_position` dict with keys `'1','2','3','4'`in Python; `PositionTabSelector` 5 pills in React; CAL-02 test green |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AccuracyTab.tsx` | 534 | Zero-width space characters `{'​'}` around `{r.actual_pts}` in PlayerDeltaTable | Info | Pre-existing from Phase 41; not introduced by Phase 63; no functional impact |

No stub patterns, no hardcoded empty returns, no TODO/FIXME comments found in Phase 63 additions. `_compute_calibration_data` produces live decile data from `per_gw_rows`; no hardcoded returns. `_read_existing_versions` has correct three-exception guard pattern. All conditional render guards use real data fields.

### Human Verification Required

#### 1. Live Chart Rendering and Interactivity

**Test:** Run the dev server (`npm run dev`), navigate to the Accuracy tab. Load with a real `accuracy_backtest.json` that contains `versions` and `calibration` fields (requires a pipeline run after Phase 63 deployment).
**Expected:**
- Version History table appears above GW Summary, last row has `(current)` marker, delta cells show `—` for row 1 and a coloured `+N.N` for subsequent rows
- Calibration Reliability section renders below Version History with a recharts chart showing a near-diagonal line for actual_rate vs predicted_rate
- y=x dashed reference line is visible
- Switching position pills (GK/DEF/MID/FWD) re-renders the chart for that position; positions with no buckets passing n>=5 show the overlay "Insufficient sample (n<5) for {POSITION} this window."
**Why human:** recharts `ResponsiveContainer` renders zero-height in jsdom. The test suite asserts on `data-testid="calibration-chart"` DOM node but cannot verify SVG rendering, ReferenceLine visibility, or interactive chart behaviour. A real pipeline run with live calibration data is required to verify the diagonal signal.

#### 2. Dark Mode Appearance

**Test:** Toggle dark mode while on the Accuracy tab with both new sections visible.
**Expected:** VersionHistoryTable, GateFlagsCell chips, HitRateBadge, DeltaCell, PositionTabSelector pills, CalibrationTooltip, and the chart background all render correctly against dark zinc surfaces. No washed-out or invisible text.
**Why human:** Dark mode CSS cannot be verified programmatically without a browser rendering engine.

---

## Gaps Summary

No gaps found. All 5 must-have truths are VERIFIED. All required artifacts exist, are substantive, and are wired. Data flows from `_compute_calibration_data` → JSON → `useAccuracy` hook → `CalibrationSection` chart data without hollow props or hardcoded returns. All 4 requirement IDs (VER-01, VER-02, CAL-01, CAL-02) are fully satisfied.

Status is `human_needed` because live browser verification of recharts rendering and dark-mode appearance cannot be confirmed programmatically.

---

_Verified: 2026-05-06T09:10:00Z_
_Verifier: Claude (gsd-verifier)_
