---
phase: 29-regression-detector
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - pipeline/merge.py
  - src/components/gem-table/GemTable.tsx
  - src/components/gem-table/GwToggle.tsx
  - src/components/gem-table/RegressionSignalBadge.tsx
  - src/components/gem-table/columns.tsx
  - src/lib/types.ts
  - tests/lib/regression-signal.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase ships the regression signal pipeline and the `RegressionSignalBadge` / Signal column UI. The pipeline logic in `merge.py` is generally sound, but there is one blocker: the gate condition that decides whether to write `regression_signal` / `actual_vs_xg_delta` to the player dict is wrong. Players in the neutral zone (signal=None, but delta computed) get both fields written with `regression_signal=null`, violating the D-03 design contract that the field must be **absent** (not `null`) when no signal fires. This will cause the Phase 29 pipeline integration tests to fail if they are ever unskipped, and it breaks the TypeScript contract in `types.ts` (field is `optional`, not always-present-nullable).

Three additional warnings cover a real CSS precedence bug in `GwToggle`, a fragile but currently-safe signed-delta assumption in `RegressionSignalBadge`, and a missing `'use client'` directive on `RegressionSignalBadge.tsx`. Two informational items cover test anti-patterns.

---

## Critical Issues

### CR-01: Neutral-zone players get `regression_signal: null` written — violates D-03 absence contract

**File:** `pipeline/merge.py:751-753`

**Issue:** `_compute_regression_signal` returns `(None, delta)` for players whose minutes gate passes but whose delta falls in the neutral range `[-threshold, +threshold]` (i.e. `abs(delta) <= 0.5`). The guard at line 751:

```python
if reg_signal is not None or reg_delta is not None:
    player['regression_signal'] = reg_signal   # writes None
    player['actual_vs_xg_delta'] = reg_delta   # writes the neutral delta
```

evaluates to `True` whenever `reg_delta` is a float (even 0.0 is not None), so `regression_signal: null` and the delta number are written for every neutral-zone player. This contradicts three sources of contract:

1. **`types.ts` line 159** — `regression_signal?` is an optional field; the `?` implies absence, not always-null.
2. **The comment at line 746** — "fields simply omit from dict (no hard-fail)".
3. **Test at `tests/lib/regression-signal.test.ts` line 45-54** — explicitly asserts that when no signal fires the field must be *absent* (`undefined`), not `null`.

The correct gate is `reg_signal is not None` — only write the fields when a directional signal ('buy' or 'sell') is returned. If you also want `actual_vs_xg_delta` visible in the neutral zone for debugging, it should be a separate decision with a separate field name, but the current coupling causes type-contract breakage.

**Fix:**
```python
# Only write to player dict when a directional signal fired.
# Neutral-zone (signal=None, delta in [-0.5, 0.5]) must produce absent fields per D-03.
if reg_signal is not None:
    player['regression_signal'] = reg_signal
    player['actual_vs_xg_delta'] = reg_delta
```

---

## Warnings

### WR-01: Duplicate `transition-*` utilities in `GwToggle` button — CSS override bug

**File:** `src/components/gem-table/GwToggle.tsx:53`

**Issue:** The button `className` string contains both `transition-colors` and `transition-transform` in the same class list:

```
transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px]
```

In Tailwind CSS v3+ both utilities generate a `transition-property: ...` declaration. When two `transition-property` rules are in the same specificity layer, the **last one wins**. Since `transition-transform` appears after `transition-colors`, the hover color transition (`bg-zinc-50`, `bg-zinc-700`) will be unanimated on browsers that apply only the later declaration. The `active:scale-95` animation still fires (it's covered by `transition-transform`), but color transitions are silently dropped.

**Fix:**
```tsx
// Replace the two conflicting utilities with a single `transition-all`
// (or enumerate both properties explicitly with `[transition:colors,transform]`).
className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
  ...
}`}
```

### WR-02: `RegressionSignalBadge.tsx` missing `'use client'` directive

**File:** `src/components/gem-table/RegressionSignalBadge.tsx:1`

**Issue:** This file has no `'use client'` directive. It is rendered inside `GemTable.tsx` which is a client component (`'use client'` on line 1), so in practice Next.js will treat it as a client component transitively. However:

- The file exports a React component that renders JSX — under RSC (React Server Component) rules, any component without a directive is assumed to be a server component.
- Sibling components in the same directory (`GwToggle.tsx` line 1, `VarianceBadge.tsx` etc.) use `'use client'`.
- If `RegressionSignalBadge` is ever imported from a server-component context (e.g. a new page), it will error at runtime in Next.js 13+/App Router because it returns JSX without being a client component.

This is consistent with project conventions: all interactive/presentational leaf components in `src/components/` carry the directive.

**Fix:** Add `'use client'` as the first line of `RegressionSignalBadge.tsx`.

```tsx
'use client'

export function RegressionSignalBadge({ ... }) {
```

### WR-03: SELL tooltip hardcodes `+` sign prefix but relies on pipeline invariant being correct

**File:** `src/components/gem-table/RegressionSignalBadge.tsx:31`

**Issue:** The SELL tooltip constructs:

```tsx
title={`Overperforming xG+xA over last 5 GW (delta +${deltaStr} per match). ...`}
```

`deltaStr` is `delta.toFixed(2)`, and `toFixed` on a positive number does **not** include a `+` sign. So for `delta = 0.82` the tooltip reads `delta +0.82` — correct. But `toFixed` on a negative number produces `"-0.82"`, giving `delta +-0.82`. This cannot happen today because SELL only fires when `delta > threshold > 0`, but it is a latent bug: if `threshold` were ever set to a negative value in `_compute_regression_signal`, or if the function is called directly from another path, the tooltip could produce `+−0.82`.

The BUY branch (line 21) has no sign prefix and is safe in all cases.

**Fix:** Compute an explicit `+` prefix only when delta is non-negative, or use `Math.abs(delta)`:

```tsx
const deltaStr = delta != null ? (delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : ''
// ... in SELL title:
title={`Overperforming xG+xA over last 5 GW (delta ${deltaStr} per match). ...`}
```

---

## Info

### IN-01: Tests call React component as a plain function — should use JSX

**File:** `tests/lib/regression-signal.test.ts:73, 82, 89, 97, 106, 115`

**Issue:** Every `render()` call in the component tests invokes `RegressionSignalBadge` as a plain function:

```ts
render(RegressionSignalBadge({ signal: 'buy', delta: -0.75 }))
```

The correct pattern is JSX:

```tsx
render(<RegressionSignalBadge signal="buy" delta={-0.75} />)
```

Calling a component as a plain function works when the component has no hooks and no context dependencies (as is currently the case), but it bypasses React's reconciler. If hooks (e.g. `useContext`) are added to `RegressionSignalBadge` in the future, these tests will silently break with confusing hook-order errors instead of failing at the call site.

**Fix:** Replace all direct function call invocations with JSX syntax in the test file.

### IN-02: Top-level trivial stub test leaks outside `describe` blocks

**File:** `tests/lib/regression-signal.test.ts:124-126`

**Issue:**

```ts
it('Wave 0 stub file created — replace with real tests after implementation', () => {
  expect(true).toBe(true)
})
```

This test sits at module scope outside any `describe` block and always passes. It is a placeholder that was not removed after implementation. It adds noise to the test report and will continue to pass silently regardless of whether the real implementation is correct.

**Fix:** Remove this test. The real tests in the two `describe` blocks are sufficient.

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
