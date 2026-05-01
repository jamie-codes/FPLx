---
phase: 37-gem-table-view-presets
fixed_at: 2026-04-29T00:00:00Z
review_path: .planning/phases/37-gem-table-view-presets/37-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 37: Code Review Fix Report

**Fixed at:** 2026-04-29
**Source review:** .planning/phases/37-gem-table-view-presets/37-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `HIDDEN_COLUMN_LABELS` uses wrong key for `regression_signal` — mobile expanded row never renders Signal

**Files modified:** `src/components/gem-table/GemTable.tsx`
**Commit:** 553fe2b
**Applied fix:** Renamed the key `signal` to `regression_signal` at line 41 of `HIDDEN_COLUMN_LABELS`. The TanStack column accessor ID is `regression_signal`, so the lookup `HIDDEN_COLUMN_LABELS[cell.column.id]` was always returning `undefined` for that column. The mobile drilldown now correctly shows the Signal value in the expanded row.

---

### WR-02: Silent no-op fallback for `onPresetChange` hides a missing prop wiring

**Files modified:** `src/components/gem-table/GemTable.tsx`
**Commit:** 042185d
**Applied fix:** Implemented option B from the review. Replaced the silent `(() => {})` no-op with a fallback that emits `console.warn('GemTable: onPresetChange not provided; preset change ignored', p)` in non-production environments. The prop remains optional (backwards-compatible), but misuse is now immediately visible during development. Production builds are unaffected.

---

### WR-03: `PresetToggle` buttons lack a minimum touch-target height

**Files modified:** `src/components/gem-table/PresetToggle.tsx`
**Commit:** 2b2c212
**Applied fix:** Added `min-h-[44px] sm:min-h-0` to the button `className` at line 28, matching the pattern established by the sibling `GwToggle` component. Buttons meet the 44px touch-target recommendation on narrow-landscape tablets where the toggle is visible but touch-operated; the `sm:min-h-0` resets height on larger screens so layout is unchanged.

---

_Fixed: 2026-04-29_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
