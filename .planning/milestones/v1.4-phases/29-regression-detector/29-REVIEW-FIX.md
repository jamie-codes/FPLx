---
phase: 29-regression-detector
fixed_at: 2026-04-28T11:41:00Z
review_path: .planning/phases/29-regression-detector/29-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

**Fixed at:** 2026-04-28T11:41:00Z
**Source review:** .planning/phases/29-regression-detector/29-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Neutral-zone players get `regression_signal: null` written — violates D-03 absence contract

**Files modified:** `pipeline/merge.py`
**Commit:** 1c5220f
**Applied fix:** Changed gate condition from `if reg_signal is not None or reg_delta is not None:` to `if reg_signal is not None:`. This ensures neutral-zone players (signal=None, delta in [-0.5, 0.5]) produce no `regression_signal` or `actual_vs_xg_delta` fields in the player dict, satisfying the D-03 absence contract and matching the TypeScript `regression_signal?` optional field definition.

### WR-01: Duplicate `transition-*` utilities in `GwToggle` button — CSS override bug

**Files modified:** `src/components/gem-table/GwToggle.tsx`
**Commit:** bb38747
**Applied fix:** Replaced the conflicting `transition-colors ... transition-transform` pair with a single `transition-all` class. This resolves the CSS specificity conflict where `transition-transform` was silently overriding `transition-colors`, suppressing animated color transitions on hover.

### WR-02: `RegressionSignalBadge.tsx` missing `'use client'` directive

**Files modified:** `src/components/gem-table/RegressionSignalBadge.tsx`
**Commit:** cedf683
**Applied fix:** Added `'use client'` as the first line of `RegressionSignalBadge.tsx`, consistent with sibling presentational components (`GwToggle.tsx`, `VarianceBadge.tsx`). This prevents runtime errors if the component is ever imported from a server-component context.

### WR-03: SELL tooltip hardcodes `+` sign prefix — latent `+-0.82` bug

**Files modified:** `src/components/gem-table/RegressionSignalBadge.tsx`
**Commit:** 27c51f6
**Applied fix:** Changed `deltaStr` computation from `delta.toFixed(2)` to `delta >= 0 ? \`+${delta.toFixed(2)}\` : delta.toFixed(2)`. Updated SELL tooltip to use `${deltaStr}` without a hardcoded leading `+`. The BUY tooltip already used `${deltaStr}` without a prefix and continues to work correctly (delta is negative for BUY signals). Both branches now produce well-formed sign strings in all cases.

---

_Fixed: 2026-04-28T11:41:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
