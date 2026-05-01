---
phase: 48-explainable-xpts-breakdown
fixed_at: 2026-05-01T00:00:00Z
review_path: .planning/phases/48-explainable-xpts-breakdown/48-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 48: Code Review Fix Report

**Fixed at:** 2026-05-01T00:00:00Z
**Source review:** .planning/phases/48-explainable-xpts-breakdown/48-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: NaN passes the XPtsCell guard and renders "NaN" to the DOM

**Files modified:** `src/components/gem-table/columns.tsx`
**Commit:** 28ae9b7
**Applied fix:** Two changes applied together. (1) The `display` line was changed from `(value ?? 0).toFixed(1)` to `Number.isFinite(value ?? 0) ? (value ?? 0).toFixed(1) : '0.0'` so NaN cannot produce a "NaN" string. (2) The early-return guard was widened from `value === undefined || value === null || value <= 0` to `value === undefined || value === null || !Number.isFinite(value) || value <= 0`, correctly short-circuiting NaN and Infinity before they reach `.toFixed()` or the hover card renderer.

---

### WR-01: `MinsRiskBadge` receives `null` but its prop type only accepts `MinsRisk`

**Files modified:** `src/components/gem-table/columns.tsx`
**Commit:** 7fd36e3
**Applied fix:** Removed the `?? null` coercion on line 115. The call site now reads `<MinsRiskBadge minsRisk={minsRisk} />`, passing `undefined` when `minsRisk` is absent. This matches the `minsRisk?: MinsRisk` optional prop signature on `MinsRiskBadge` (Option A from the review suggestion) and resolves the TypeScript type error without widening the badge's own prop type.

---

### WR-02: Sigma uses unblended season rates when form blending is active

**Files modified:** `pipeline/merge.py`
**Commit:** a4d599e
**Applied fix:** In the sigma computation block (lines 973-984), replaced the three `xg_per90, xa_per90` argument pairs with `xpts_xg_per90, xpts_xa_per90` for all three window calls (`_sigma_1gw`, `_sigma_3gw`, `_sigma_5gw`). These blended variables are set earlier in the same player loop and reflect the form-blended rates when `form_signal_enabled=True`, ensuring the 90th-percentile ceiling is calibrated from the same inputs as xPts_1gw/3gw/5gw.

---

### WR-03: `test_merge_xpts_components.py` lacks integration test verifying `xPts_components_1gw` is written

**Files modified:** `pipeline/tests/test_merge_xpts_components.py`
**Commit:** 71d66fc
**Applied fix:** Added `test_merge_players_writes_xpts_components_1gw` to the test file. The test calls `merge_players` with a minimal one-player bootstrap, asserts `xPts_components_1gw` is present in the output dict, verifies all five required keys (`appearance_pts`, `goal_pts`, `assist_pts`, `cs_pts`, `bonus_pts`) are present with no extras, and checks that `sum(components.values()) == xPts_1gw` within ±0.01 (XPT-02 sum invariant). A local `_build_minimal_inputs_for_components` helper was added following the same pattern used in `test_merge.py`.

---

_Fixed: 2026-05-01T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
