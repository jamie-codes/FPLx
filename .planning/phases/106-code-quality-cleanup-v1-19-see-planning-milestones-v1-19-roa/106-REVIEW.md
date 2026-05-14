---
phase: 106-code-quality-cleanup
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/squad/DecisionSummaryTab.tsx
  - src/lib/decision-severity.ts
  - src/lib/__tests__/decision-severity.test.ts
  - src/components/nav/MobileNav.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 106: Code Review Report

**Reviewed:** 2026-05-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed: the `DecisionSummaryTab` component, the `decision-severity` pure classifier, its unit test suite, and the `MobileNav` component test suite. The `decision-severity` module is clean — correct logic, well-structured tests with full branch coverage, and no security or data issues. The `MobileNav` test has a test reliability defect where two tests make conflicting assertions about the Plan section pill count, and one test uses a filter-subset that masks the real count. The `DecisionSummaryTab` component has two code-quality warnings: a function-inside-render pattern that is only correct by accident (ordering dependency on post-guard code), and a misleading inline comment. One JSX indentation inconsistency is flagged as info.

## Warnings

### WR-01: MobileNav.test.tsx — NAV-03 pill count assertion is vacuously weak and masks real count

**File:** `src/components/nav/MobileNav.test.tsx:66-67`
**Issue:** The NAV-03 test title claims "renders 3 pills with mobile labels Planner/Values/Rivals" but the filter on line 66 queries only those 3 labels, guaranteeing the count will be exactly 3 as long as those 3 buttons exist — regardless of how many total Plan pills are rendered. A later test (line 102-103) establishes that Plan actually renders 6 pills (Planner, Manual, Routes, Rank Sim, Values, Rivals). The NAV-03 assertion cannot catch a regression where extra pills are added, because its filter always self-limits the result set.

**Fix:** Restructure the assertion to query all Plan pills and assert the full expected count, consistent with the Phase 62 test:
```ts
// Replace lines 65-70:
const allPlanPills = allButtons.filter(b =>
  ['Planner', 'Manual', 'Routes', 'Rank Sim', 'Values', 'Rivals'].includes(b.textContent ?? '')
)
expect(allPlanPills).toHaveLength(6)
expect(allPlanPills[0].textContent).toBe('Planner')
// etc.
```
If Plan intentionally only shows 3 pills (not 6), then the Phase 62 test at line 103 (`toHaveLength(6)`) is wrong and must be fixed instead — the two tests cannot both be correct.

---

### WR-02: DecisionSummaryTab.tsx — `scoresForChip` / `bestGwForChip` defined inside render body after early returns; functions re-created on every render

**File:** `src/components/squad/DecisionSummaryTab.tsx:436-445`
**Issue:** `scoresForChip` and `bestGwForChip` are plain function declarations inside the component body, defined after the loading/error early returns at lines 399-430. They close over `bbScores`, `tcScores`, and `fhResult` which are all memoized values. Two concerns:

1. These functions are re-created as new objects on every render, and then immediately passed as inline callbacks into the `unusedChipCodes.map(...)` render loop. While this does not cause a correctness bug, it is a code smell — the intent to avoid per-render allocation is clearly stated elsewhere in the component (all heavy derivations use `useMemo`) but these helpers are exempt without explanation.

2. The placement after early returns means any future early return inserted between lines 430 and 436 would silently prevent these functions from ever being declared for the render paths above it, causing a runtime `ReferenceError`. The current early returns happen before these declarations, so the bug is latent, not active.

**Fix:** Hoist these two functions above the early returns (e.g., after `unusedChipCodes` is derived at line 434, move the declarations to before line 399), or extract them as module-level pure functions taking `bbScores`, `tcScores`, `fhResult` as parameters:
```ts
// Module-level, outside the component:
function scoresForChip(
  code: 'bboost' | '3xc' | 'freehit',
  bbScores: GWEaseScore[],
  tcScores: GWEaseScore[],
  fhScores: GWEaseScore[],
): GWEaseScore[] {
  if (code === 'bboost') return bbScores
  if (code === '3xc') return tcScores
  return fhScores
}
```

---

### WR-03: DecisionSummaryTab.tsx — `hasAvailableChip` not memoized but used as `useMemo` dependency

**File:** `src/components/squad/DecisionSummaryTab.tsx:375-396`
**Issue:** `hasAvailableChip` is a non-memoized boolean (plain `const`) derived from `usedChips` (a memoized `Map`). It is then listed as a dependency of the `severity` `useMemo` at line 395. This is technically correct because React's dependency comparison uses `Object.is()`, and booleans compare by value. However, it creates an invisible invariant: if `hasAvailableChip` were ever changed to a non-primitive (e.g., a derived object or array), the `useMemo` would stop invalidating correctly.

More concretely, `hasAvailableChip` is evaluated on every render, meaning if the parent re-renders without `usedChips` changing, `hasAvailableChip` is still a new evaluation — but since it's a boolean, React's dep-array comparison catches it correctly. The inconsistency (all other severity inputs are memoized; this one is not) is a maintenance hazard.

**Fix:** Wrap in `useMemo` for consistency with the rest of the severity inputs:
```ts
const hasAvailableChip = useMemo(
  () => !usedChips.has('bboost') || !usedChips.has('3xc') || !usedChips.has('freehit'),
  [usedChips],
)
```

---

## Info

### IN-01: decision-severity.ts — header comment omits the `LOW` case for captain severity

**File:** `src/lib/decision-severity.ts:7`
**Issue:** The header comment block (lines 7-11) documents captain severity as "HIGH when top1 >= 2*top2; else MEDIUM" but the actual code has a third branch: `candidates.length < 2 → LOW`. The omission makes the spec comment an incomplete contract description.

**Fix:** Update line 7 to:
```
//   - Captain: LOW when fewer than 2 candidates; HIGH when top1 >= 2*top2 (with top2 > 0 guard); else MEDIUM.
```

---

### IN-02: DecisionSummaryTab.tsx — misleading comment at proseRefreshPayload chip derivation

**File:** `src/components/squad/DecisionSummaryTab.tsx:339`
**Issue:** The comment reads "inline derivation (avoids hoisting bestGwForChip out of render body)". This is inaccurate: `bestGwForChip` is already inside the render body (defined at line 442). The real reason the inline derivation is necessary is that `bestGwForChip` is declared after the early returns, making it unavailable inside the `proseRefreshPayload` `useMemo` that runs before the early return guards.

**Fix:** Update the comment to accurately reflect the constraint:
```ts
// Chip: inline derivation — bestGwForChip is declared after the early-return guards
// (lines 436-445) and is therefore unavailable here inside useMemo.
```

---

### IN-03: DecisionSummaryTab.tsx — JSX indentation inconsistency at lines 487-491

**File:** `src/components/squad/DecisionSummaryTab.tsx:487`
**Issue:** The `{isAuthenticated && (...)}` expression at line 487 is indented with 10 spaces, while its sibling JSX (the `<form>` above, the `</div>` below) is at 8 spaces. This is a stray 2-space over-indent that breaks visual alignment inside the Load Squad card.

**Fix:** Outdent lines 487-491 by 2 spaces:
```tsx
        {isAuthenticated && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            FPL account connected — exact sell prices will be used.
          </p>
        )}
```

---

_Reviewed: 2026-05-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
