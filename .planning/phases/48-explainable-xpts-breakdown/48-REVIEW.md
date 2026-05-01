---
phase: 48-explainable-xpts-breakdown
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - pipeline/merge.py
  - pipeline/tests/test_merge_xpts_components.py
  - src/components/gem-table/PlayerComparisonModal.test.tsx
  - src/components/gem-table/columns.test.tsx
  - src/components/gem-table/columns.tsx
  - src/lib/types.ts
  - tests/components/gem-table/XPtsCell.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 48: Code Review Report

**Reviewed:** 2026-05-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 48 adds `appearance_pts` as a new xPts breakdown component, exposing a per-fixture hover card in the GemTable `XPtsCell` column. The pipeline change in `merge.py` is structurally sound and the sum invariant holds for both single-fixture and DGW cases. The TypeScript component implementation has one critical bug (NaN guard failure), one type error, and one sigma/blend inconsistency. Test coverage for edge cases is thin.

---

## Critical Issues

### CR-01: NaN passes the XPtsCell guard and renders "NaN" to the DOM

**File:** `src/components/gem-table/columns.tsx:52`

**Issue:** The comment on line 49 explicitly claims "NaN short-circuit" is handled by the guard, but the guard condition is wrong. In JavaScript, `NaN <= 0` evaluates to `false`, so a `NaN` value bypasses the early-return branch entirely. Execution continues to `(NaN).toFixed(1)` which returns the string `"NaN"`, then falls through to compute `showBreakdown` and potentially renders the hover card with `"NaN"` values in every number slot.

This can occur in practice during a partial pipeline failure or BGW cache serve — exactly the scenario the comment documents. The comment documents the intent correctly but the implementation does not deliver it.

```tsx
// CURRENT — NaN slips through:
if (value === undefined || value === null || value <= 0) {
  return <span>{display}</span>
}

// FIX — add explicit NaN guard:
if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) {
  return <span>{display}</span>
}
```

Note: `Number.isFinite(NaN)` is `false` and `Number.isFinite(Infinity)` is also `false`, which correctly handles both edge cases. The companion `display` computation on line 47 also needs guarding:

```tsx
const display = Number.isFinite(value ?? 0) ? (value ?? 0).toFixed(1) : '0.0'
```

No test covers the `value=NaN` case — adding one in `XPtsCell.test.tsx` would lock in the fix.

---

## Warnings

### WR-01: `MinsRiskBadge` receives `null` but its prop type only accepts `MinsRisk`

**File:** `src/components/gem-table/columns.tsx:115`

**Issue:** `minsRisk` on `XPtsCell` is typed as `minsRisk?: MinsRisk` (optional, meaning `MinsRisk | undefined`). Inside `XPtsCell`, the badge is rendered as `<MinsRiskBadge minsRisk={minsRisk ?? null} />`. When `minsRisk` is `undefined`, this passes `null`. The `MinsRiskBadge` component's prop signature is `{ minsRisk: MinsRisk }` — `null` is not in the `MinsRisk` union, making this a TypeScript type error that `tsc --noEmit` will surface.

At runtime `getMinsRiskConfig` has a `!minsRisk` guard so `null` is handled gracefully and no crash occurs, but the type violation means TypeScript type-safety is silently broken here.

**Fix:**
```tsx
// Option A — pass undefined (matches the optional prop better):
<MinsRiskBadge minsRisk={minsRisk} />

// Option B — widen MinsRiskBadge prop to accept null:
export function MinsRiskBadge({ minsRisk }: { minsRisk: MinsRisk | null | undefined }) {
```

Option A is the smallest change and matches how the badge is called everywhere else in the codebase.

---

### WR-02: Sigma uses unblended season rates when form blending is active

**File:** `pipeline/merge.py:973-984`

**Issue:** When `form_signal_enabled=True`, the xPts calculations use blended per-90 rates (`xpts_xg_per90`, `xpts_xa_per90`). However, the sigma calculations on lines 973–984 pass the raw season rates (`xg_per90`, `xa_per90`) instead of the blended rates:

```python
player['_sigma_1gw'] = _compute_xpts_sigma(
    xg_per90, xa_per90, ...   # should be xpts_xg_per90, xpts_xa_per90
)
```

This means `xPts_ceiling_*` and `xPts_90th_1gw` are computed from different inputs than `xPts_1gw`, `xPts_3gw`, `xPts_5gw`. For players where form diverges significantly from season rate (the exact cases form blending targets), the 90th-percentile ceiling value will be mis-calibrated.

**Fix:**
```python
player['_sigma_1gw'] = _compute_xpts_sigma(
    xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
    element['element_type'], player_fixtures, 1,
)
player['_sigma_3gw'] = _compute_xpts_sigma(
    xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
    element['element_type'], player_fixtures, 3,
)
player['_sigma_5gw'] = _compute_xpts_sigma(
    xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
    element['element_type'], player_fixtures, 5,
)
```

---

### WR-03: `test_merge_xpts_components.py` lacks integration test verifying `xPts_components_1gw` is written to the merged player dict

**File:** `pipeline/tests/test_merge_xpts_components.py`

**Issue:** The three tests only cover `_compute_xpts_fixture` and `_xpts_ngw` in isolation. There is no test that calls `merge_players` and asserts that `xPts_components_1gw` is present and correctly shaped in the output dict. The pipeline integration path (which sets `player['xPts_components_1gw'] = xpts_components_1gw` at line 953 of `merge.py`) is untested by the new test file.

If the field name, key order, or type were changed in `merge.py`, all three existing tests would still pass but the downstream UI would silently receive `undefined` components and the hover card would not render.

**Fix:** Add an integration test using a minimal bootstrap + fixtures setup that calls `merge_players` and asserts `xPts_components_1gw` has all five required keys and that `sum(values()) == xPts_1gw` (within tolerance). The existing `test_merge.py` or the new file are both suitable locations.

---

## Info

### IN-01: `appearance_pts` formula comment is inaccurate per FPL scoring rules

**File:** `pipeline/merge.py:228-230`

**Issue:** The comment reads "FPL awards 2pts for starting". The actual FPL scoring rule is: 1 pt for playing < 60 min (substitute appearance), 2 pts for playing 60+ min. Using `start_prob * 2` ignores the 1 pt earned by sub appearances, understating expected appearance contribution by approximately `(1 - start_prob) * sub_appearance_prob * 1`. The current formula is a documented simplification, but the comment should state it explicitly to avoid future maintainers adding a "sub appearance" branch and double-counting.

**Fix:** Update the comment:
```python
# Appearance: simplified model — FPL awards 1pt for any appearance, 2pts for 60+ min.
# We model only starter appearances (start_prob × 2) as a simplification;
# sub appearances (1pt) contribute a small additional expected value not modelled here.
```

---

### IN-02: `_xpts_ngw` components accumulation condition is needlessly restrictive

**File:** `pipeline/merge.py:285`

**Issue:** The condition `if gw_idx == 0 and n_gws == 1:` is correct but the `n_gws == 1` part is redundant — for any `n_gws > 1` call, the outer guard `components = first_gw_components if n_gws == 1 else None` already discards the accumulated values. The inner check therefore serves no functional purpose but adds cognitive overhead when reading the DGW loop.

Additionally, accumulating components only when `n_gws == 1` means a future caller wanting first-GW breakdown from a 3GW call would need to refactor rather than just read a pre-accumulated value. Decoupling the accumulation from the `n_gws == 1` guard (and letting the outer assignment handle which windows get returned) would make the intent clearer.

**Fix:** Accumulate for all first-GW iterations and let the return assignment gate exposure:
```python
if gw_idx == 0:  # always accumulate first GW components
    for k in first_gw_components:
        first_gw_components[k] += result[k]
```
This is a pure refactor — no behavior change for current callers.

---

_Reviewed: 2026-05-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
