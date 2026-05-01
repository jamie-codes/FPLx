---
phase: 37-gem-table-view-presets
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/gem-table/GwToggle.tsx
  - src/components/gem-table/GwToggle.test.ts
  - src/components/gem-table/PresetToggle.tsx
  - src/components/gem-table/GemTable.tsx
  - src/app/page.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The phase adds a `ViewPreset` type, a `PresetToggle` component, and wires preset state from `page.tsx` down through `GemTable`. The column-visibility logic in `getColumnVisibility` is clean and the test suite is thorough. Three correctness issues were found: a stale column-ID key in `HIDDEN_COLUMN_LABELS` that silently breaks the mobile expand-row feature for one column, a silent no-op fallback for `onPresetChange`, and a missing touch-target on `PresetToggle` buttons. Two info-level items cover dead-code/naming inconsistency.

---

## Warnings

### WR-01: `HIDDEN_COLUMN_LABELS` uses wrong key for `regression_signal` — mobile expanded row never renders Signal

**File:** `src/components/gem-table/GemTable.tsx:41`

**Issue:** `HIDDEN_COLUMN_LABELS` maps `signal: 'Signal'` (line 41), but the actual TanStack column ID defined in `columns.tsx` is `regression_signal` (column accessor at line 161 of that file). The expanded-row detail panel filters cells with:

```ts
.filter(cell => HIDDEN_COLUMN_LABELS[cell.column.id])
```

Because `cell.column.id` will be `"regression_signal"`, the lookup against `"signal"` always returns `undefined` (falsy). The regression signal value is therefore never shown in the mobile drilldown, silently dropping a column that `MOBILE_HIDDEN_COLUMNS` explicitly hides (and that users need to see on mobile via the expand).

**Fix:**
```ts
// GemTable.tsx — HIDDEN_COLUMN_LABELS
- signal: 'Signal',
+ regression_signal: 'Signal',
```

---

### WR-02: Silent no-op fallback for `onPresetChange` hides a missing prop wiring

**File:** `src/components/gem-table/GemTable.tsx:130`

**Issue:**
```ts
<PresetToggle preset={preset} onPresetChange={onPresetChange ?? (() => {})} />
```
When `GemTable` is used without passing `onPresetChange`, clicking any preset button silently does nothing — no error, no state change, no visual feedback. The preset toggle appears interactive (fully styled, pressable) but has no effect. A developer rendering `<GemTable />` standalone would get a broken UI with no diagnostic signal.

`page.tsx` always passes both props (lines 124), so the production path is fine today, but the fallback makes misuse invisible. Either the fallback should be removed (forcing callers to always provide the handler) or a `console.warn` in development should fire.

**Fix (option A — remove fallback, make prop required):**
```ts
// GemTableProps
interface GemTableProps {
  preset: ViewPreset
  onPresetChange: (p: ViewPreset) => void
}
// Remove `= {}` default from destructure — call sites must provide both props.
```

**Fix (option B — keep optional but warn in dev):**
```ts
const handlePresetChange = onPresetChange ?? ((p: ViewPreset) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('GemTable: onPresetChange not provided; preset change ignored', p)
  }
})
// Then pass handlePresetChange to PresetToggle
```

---

### WR-03: `PresetToggle` buttons lack a minimum touch-target height

**File:** `src/components/gem-table/PresetToggle.tsx:28`

**Issue:** The `PresetToggle` buttons use `px-3 py-1` (4px vertical padding) and have no `min-h` guard, making them approximately 28–30px tall. `GwToggle` (line 102 of `GwToggle.tsx`) explicitly sets `min-h-[44px]` to meet the 44px touch-target recommendation. `PresetToggle` is hidden on mobile (`hidden sm:flex`), but on a narrow landscape tablet it can be visible while still being touch-operated. The inconsistency also violates the pattern established by the sibling component.

**Fix:**
```tsx
// PresetToggle.tsx line 28 — add min-h-[44px] sm:min-h-0 to match GwToggle pattern
className={`px-3 py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] sm:min-h-0 ${
```

---

## Info

### IN-01: `MOBILE_HIDDEN_COLUMNS` is a duplicate of `PRESET_COLUMN_VISIBILITY['compact']` plus two extra keys

**File:** `src/components/gem-table/GwToggle.tsx:5-23` and `25-44`

**Issue:** `MOBILE_HIDDEN_COLUMNS` (17 keys) is almost a strict superset of `PRESET_COLUMN_VISIBILITY.compact` (17 keys). The two differ only by `MOBILE_HIDDEN_COLUMNS` including `now_cost` and `status`, which are also present in `compact`. In practice they are identical. The duplication means future column additions must be added in two places, risking divergence. Consider whether `MOBILE_HIDDEN_COLUMNS` can be derived from or merged with the `compact` preset.

**Fix (suggestion):** Define `MOBILE_HIDDEN_COLUMNS` as a const derived from the `compact` preset extended with any mobile-only overrides, so there is a single source of truth.

---

### IN-02: Test file uses `.ts` extension for a file that imports from a TSX module

**File:** `src/components/gem-table/GwToggle.test.ts:1`

**Issue:** The test file has extension `.ts` but imports from `GwToggle.tsx` (a JSX-capable module). The tests themselves only test the exported pure functions (`getColumnVisibility`, `MOBILE_HIDDEN_COLUMNS`) and never render JSX, so this works in Vitest with the current config. However the conventional extension for test files that live alongside `.tsx` source files in this project is `.test.tsx`. Using `.ts` may cause confusion when adding future tests that do render components, and inconsistency if the project enforces extension-based linting rules.

**Fix:** Rename `GwToggle.test.ts` to `GwToggle.test.tsx` to match project convention for component test files.

---

_Reviewed: 2026-04-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
