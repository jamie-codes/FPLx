---
phase: 91-calibration-charts
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/accuracy.py
  - pipeline/tests/test_accuracy.py
  - src/lib/types.ts
  - src/components/accuracy/AccuracyTab.tsx
  - src/components/accuracy/AccuracyTab.test.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 91 adds `predicted_mean`/`actual_mean` per calibration bucket (pipeline side) and a new
"Predicted vs Actual xPts" chart (UI side). The review examined correctness of the mean
accumulation, null-safety of the tooltip and `useMemo` hooks, type-system coverage of the new
fields, and test quality.

The core finding is that the Phase 91 backend changes do not yet exist: `predicted_mean` and
`actual_mean` are not computed anywhere in `pipeline/accuracy.py`, the `CalibrationBucket`
interface in `src/lib/types.ts` does not declare the new optional fields, and the "Predicted
vs Actual xPts" chart container (`data-testid="calibration-xpts-chart"`) and its heading
("Predicted vs Actual xPts") are absent from `AccuracyTab.tsx`. The six Phase-91-specific Python
tests and the five Phase-91-specific component tests will all fail — this is the intended Wave-0
RED state. However, there are additional correctness and type-safety defects in the existing
(already-GREEN) code that would survive into the GREEN phase unchanged if not addressed.

---

## Critical Issues

### CR-01: `predicted_mean` and `actual_mean` are not accumulated in `_compute_calibration_data`

**File:** `pipeline/accuracy.py:510-547`
**Issue:** The Phase 91 contract (per `test_calibration_includes_xpts_means`) requires every
emitted `CalibrationBucket` to carry `predicted_mean` (mean `xpts_predicted` for all rows in the
bucket) and `actual_mean` (mean `actual_pts`). `_compute_calibration_data` accumulates only
`bucket_haul` and `bucket_total` — there are no `xpts_sum` or `actual_sum` accumulators, and the
`buckets.append()` call on line 538 does not include these keys. All six
`test_calibration_xpts_means_*` tests will fail with `KeyError` / assertion failure.

**Fix:**
```python
# Add two new accumulator dicts alongside bucket_haul / bucket_total (line ~511):
bucket_xpts_sum: dict = defaultdict(lambda: defaultdict(float))
bucket_actual_sum: dict = defaultdict(lambda: defaultdict(float))

# Inside the per-row loop (after line 525):
for pk in ('all', pos_key):
    bucket_haul[pk][decile] += is_haul
    bucket_total[pk][decile] += 1
    bucket_xpts_sum[pk][decile] += row['xpts_predicted']     # NEW
    bucket_actual_sum[pk][decile] += row['actual_pts']        # NEW

# In buckets.append() (line 538):
buckets.append({
    'bucket_mid': bucket_mids[d],
    'predicted_rate': bucket_mids[d],
    'actual_rate': round(haul / total, 4),
    'sample_n': total,
    'predicted_mean': round(bucket_xpts_sum[pos_key][d] / total, 2),  # NEW
    'actual_mean': round(bucket_actual_sum[pos_key][d] / total, 2),   # NEW
})
```

The division `/ total` is safe here because the `if total < 5` guard on line 536 already ensures
`total >= 5` before `append()` is reached.

---

### CR-02: `CalibrationBucket` in `types.ts` is missing the new optional fields

**File:** `src/lib/types.ts:454-459`
**Issue:** The component tests cast `fixtureWithXptsMeans` as `unknown as AccuracyBacktest`
specifically because `CalibrationBucket` does not yet carry `predicted_mean` or `actual_mean`.
Until these fields are declared, TypeScript will not catch any typo in the field names in the UI,
the tooltip, or any future consumer. Any chart code that reads `b.predicted_mean` will be typed
`any` (via the cast), silently widening the type.

**Fix:**
```typescript
export interface CalibrationBucket {
  bucket_mid: number
  predicted_rate: number
  actual_rate: number
  sample_n: number
  // Phase 91 CAL-01 — mean xPts per bucket; absent on legacy cache pre-dating Phase 91
  predicted_mean?: number   // mean xpts_predicted across all rows in this decile
  actual_mean?: number      // mean actual_pts across all rows in this decile
}
```

Making them optional (`?`) preserves backward-compat with pre-Phase-91 cache, which is the
same pattern used for all other progressive Phase additions in this file.

---

### CR-03: `data-testid="calibration-xpts-chart"` and "Predicted vs Actual xPts" chart are absent from `AccuracyTab.tsx`

**File:** `src/components/accuracy/AccuracyTab.tsx` (entire file)
**Issue:** Five component tests in the Phase 91 `describe` block assert:
1. `container.querySelector('[data-testid="calibration-xpts-chart"]')` is not null (lines 381, 387, 416).
2. `getByText('Predicted vs Actual xPts')` resolves (line 398).
3. Exactly one `[role="tablist"]` exists (i.e., both charts share one `PositionTabSelector`) (lines 405-417).
4. The xPts chart shows an empty-state overlay when the active position has no usable buckets (line 431).

None of these can pass because the `CalibrationSection` component renders only the haul-rate
chart (`data-testid="calibration-chart"`). There is no second `ComposedChart` for xPts means,
no second `data-testid`, and no second heading. This is the planned RED state, but it must be
fixed in Plan 091-04.

**Fix:** Add a second `ComposedChart` inside `CalibrationSection` (after the existing haul-rate
chart) that:
- Has `data-testid="calibration-xpts-chart"`
- Is preceded by an `<h3>` (or `<h2>`) reading "Predicted vs Actual xPts"
- Plots `predicted_mean` (Line dataKey) and `actual_mean` (Line dataKey) against `bucket_mid` on X
- Filters `chartData` to only buckets where `b.predicted_mean !== undefined` (Pitfall 5 — drops legacy buckets)
- Reuses the shared `position` state from `useState<CalibrationPosition>` so no second tablist appears

---

## Warnings

### WR-01: `CalibrationTooltip` uses `TooltipContentProps` without generic parameters — type unsafety

**File:** `src/components/accuracy/AccuracyTab.tsx:251`
**Issue:** `function CalibrationTooltip({ active, payload }: TooltipContentProps)` uses
`TooltipContentProps` with default generics (`ValueType = number | string | readonly (number|string)[]`,
`NameType = number | string`). The `payload[0].payload` field is typed `any` in recharts, so the
cast on line 253 (`as CalibrationBucket`) is unchecked. If recharts ever changes how it passes the
payload object, the cast silently hides the mismatch. More immediately: the `payload` field in
`TooltipContentProps` is `TooltipPayload` (a branded type from recharts internals), which is
always present on the concrete `TooltipContentProps` (not optional), yet the guard on line 252
checks `!payload?.length` — the optional chaining is redundant and masks any future case where
`payload` could actually be undefined if the type is used more loosely.

**Fix:**
```typescript
function CalibrationTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]?.payload as CalibrationBucket | undefined
  if (!p) return null
  // ... rest unchanged
}
```

---

### WR-02: `test_calibration_xpts_means_descending_by_decile` makes a weak monotonicity assertion

**File:** `pipeline/tests/test_accuracy.py:584-601`
**Issue:** The test asserts only `means[0] >= means[-1]` (first >= last). With uniform
`xg=0.3, xa=0.2` for all 50 players, every decile will produce the same `predicted_mean` (the
xPts formula gives an identical output for every row). The assertion trivially passes even if
`predicted_mean` is identically constant across all buckets, meaning the test does not actually
verify that top-decile players have higher mean predicted xPts than bottom-decile players in a
meaningful way. The test does not catch regressions where the accumulator sums the wrong field.

**Fix:** Use varied xG/xA across players so that the ranked deciles genuinely have different
`predicted_mean` values, then assert full monotonicity:
```python
# Use histories that differ in xG so xpts_predicted varies meaningfully across players:
player_histories = {
    pid: [_hist(gw, 90, 6, xg=0.05 * pid, xa=0.02 * pid) for gw in range(1, 33)]
    for pid in range(1, 51)
}
# ... (run backtest, get all_buckets) ...
means = [b['predicted_mean'] for b in all_buckets]
for i in range(len(means) - 1):
    assert means[i] >= means[i + 1], (
        f"predicted_mean must be non-increasing: bucket {i} ({means[i]}) < bucket {i+1} ({means[i+1]})"
    )
```

---

### WR-03: Phase 91 component tests rely on counting recharts `<circle>` DOM elements — fragile

**File:** `src/components/accuracy/AccuracyTab.test.tsx:389-392`
**Issue:**
```typescript
const dots = xptsChart.querySelectorAll('.recharts-line-dots circle, .recharts-line .recharts-line-dot')
expect(dots.length).toBe(3)
```
`recharts` renders dots into an SVG, but in a jsdom (non-browser) environment the recharts
`ResponsiveContainer` has zero width/height, causing it to render nothing or an empty SVG.
This test will either always return 0 dots (making it a false negative even when the chart renders
correctly) or become stale when recharts changes internal class names. The test is already
acknowledged as fragile in the comment on line 388, but it will produce misleading results.

**Fix:** Instead of counting SVG circles, assert the underlying data passed to recharts. The
safer approach is to expose a `data-testid` on a summary element, or to test the data shape at the
`useMemo` level rather than the rendered SVG:
```typescript
// Verify the computed xPts chart data length via a data attribute on the container:
// In the component: <div data-testid="calibration-xpts-chart" data-bucket-count={xptsChartData.length}>
const xptsChart = container.querySelector('[data-testid="calibration-xpts-chart"]')
expect(xptsChart?.getAttribute('data-bucket-count')).toBe('3')
```

---

### WR-04: `_compute_calibration_data` sorts rows per-GW but does not produce consistent tie-breaking for equal `xpts_predicted` values

**File:** `pipeline/accuracy.py:519`
**Issue:** `ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)` uses Python's
`sorted()`, which is stable but only breaks ties by insertion order (the order rows were appended
in the first pass). When many players share an identical `xpts_predicted` (e.g., all-zero players
filtered by the `MIN_MINUTES` guard, or players with identical xG/xA/minutes), their decile
assignment is arbitrary and depends on `element_id` iteration order from `bootstrap['elements']`,
which is not guaranteed to be stable across FPL API responses. This can cause decile boundaries
to shift non-deterministically between runs on identical inputs if the API returns elements in
different order, making calibration charts flicker.

**Fix:** Add a secondary sort key to enforce a deterministic tie-break:
```python
ranked = sorted(rows, key=lambda r: (r['xpts_predicted'], r['player_id']), reverse=True)
```

---

## Info

### IN-01: `_empty_backtest` cold-start calibration shape uses a bare `dict` literal, not the full position keys

**File:** `pipeline/accuracy.py:492`
**Issue:** The `calibration` value in `_empty_backtest` is:
```python
'calibration': {'by_position': {'all': [], '1': [], '2': [], '3': [], '4': []}},
```
This is correct, but `test_calibration_xpts_means_cold_start_absence` (line 675) imports
`_empty_backtest` directly and asserts the shape. If a future refactor changes the key list in
`_compute_calibration_data` (e.g., adding a '5' position or renaming a key), `_empty_backtest`
will silently diverge. Consider deriving the empty shape from a shared constant.

**Fix:** Extract position keys to a module-level constant:
```python
_POSITION_KEYS = ('all', '1', '2', '3', '4')
# In _empty_backtest:
'calibration': {'by_position': {pk: [] for pk in _POSITION_KEYS}},
# In _compute_calibration_data:
for pos_key in _POSITION_KEYS:
    ...
```

---

### IN-02: `fixtureWithXptsMeans` fixture comment contradicts Phase 91 test intent

**File:** `src/components/accuracy/AccuracyTab.test.tsx:113-116`
**Issue:** The comment reads:
> "Cast as AccuracyBacktest because predicted_mean/actual_mean fields are added to CalibrationBucket
> in Plan 091-03; using unknown cast to keep compile clean until then."

The `as unknown as AccuracyBacktest` cast is intentional for RED-phase tests, but the comment
references "Plan 091-03" (the types plan) while the fields are not yet present in any plan output.
Once Plan 091-03 adds the type fields, this comment and cast should both be removed; leaving it
as-is after Plan 091-03 completes will cause the cast to hide any future type errors silently.
A TODO comment pointing at the specific removal condition would be safer.

**Fix:**
```typescript
// TODO(091-03): remove `as unknown as AccuracyBacktest` cast once CalibrationBucket
// declares predicted_mean/actual_mean optional fields (Plan 091-03).
const fixtureWithXptsMeans = {
  ...
} as AccuracyBacktest  // safe after 091-03 adds the optional fields
```

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
