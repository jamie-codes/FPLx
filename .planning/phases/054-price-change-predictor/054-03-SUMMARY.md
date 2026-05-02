---
phase: 054-price-change-predictor
plan: 03
subsystem: ui-component
tags: [typescript, react, vitest, tdd, price-changes, panel]
dependency_graph:
  requires:
    - src/lib/hooks/usePriceChanges.ts (Plan 02 hook)
    - src/lib/types.ts (PriceChangePrediction, PriceChanges from Plan 02)
    - pipeline/cache/price_changes.json (Plan 01 cold-start seed)
  provides:
    - PriceChangePanel React component
    - Analyse > Price Changes sub-tab in page.tsx
    - 4 Vitest tests for PriceChangePanel
  affects:
    - src/app/page.tsx (SubTab union, SECTIONS, render conditional, import)
tech_stack:
  added: []
  patterns:
    - InsightsTab.tsx analog for loading/error/empty guards and sectioned layout
    - Inline-style progress bar to avoid dynamic Tailwind class generation (Pitfall 4)
    - Phase 51 D-13 severity convention: HIGH=red, MEDIUM=amber, LOW=zinc
    - D-06 badge suppression when snapshot_days < 14
key_files:
  created:
    - src/components/price-changes/PriceChangePanel.tsx (139 lines)
    - src/components/price-changes/PriceChangePanel.test.tsx (79 lines)
  modified:
    - src/app/page.tsx (4 coordinated edits: import, SubTab union, SECTIONS entry, render conditional)
decisions:
  - "[054-03] .toBeInTheDocument() replaced with .toBeTruthy() — codebase does not import @testing-library/jest-dom; getByText already throws if element not found"
metrics:
  duration: 20 min
  completed: 2026-05-02
  tasks_completed: 3
  files_changed: 3
---

# Phase 54 Plan 03: PriceChangePanel Component Summary

**One-liner:** Client component rendering price-change predictions in rise-then-fall sections with inline-style confidence bars, D-06 badge suppression under 14 snapshot days, early-data amber banner, and four coordinated page.tsx edits wiring it as the Analyse > Price Changes sub-tab.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 — Vitest stubs for PriceChangePanel (4 cases) | e8ce0ed | src/components/price-changes/PriceChangePanel.test.tsx |
| 2 | Implement PriceChangePanel.tsx (all 4 tests GREEN) | 0039c7f | src/components/price-changes/PriceChangePanel.tsx, PriceChangePanel.test.tsx (deviation fix) |
| 3 | Wire PriceChangePanel into src/app/page.tsx | 8af3ef7 | src/app/page.tsx |

---

## Vitest Output Summary

```
Test Files  1 passed (1)
     Tests  4 passed (4)
  Start at  21:28:57
  Duration  594ms
```

All 4 Wave 0 test cases green:
- renders the loading state when isLoading=true: PASSED
- renders empty state when predictions list is empty: PASSED
- renders rise section before fall section: PASSED
- suppresses tier badges when snapshot_days < 14: PASSED

Full suite: 600/600 passed, 34 skipped, 1 pre-existing failure in club-form.test.ts (not introduced by this plan — confirmed identical on worktree base before any changes).

---

## TypeScript Check

`npx tsc --noEmit` produces only the 5 pre-existing errors in `tests/lib/captain-picks.test.ts` (documented in Plan 02 SUMMARY as out-of-scope). No new errors introduced.

---

## page.tsx Edits Confirmation

All four edits applied and verified:

| Edit | Change | Verified |
|------|--------|---------|
| EDIT A | `import { PriceChangePanel } from '@/components/price-changes/PriceChangePanel'` added after AccuracyTab import | grep -c = 1 |
| EDIT B | SubTab union extended with `'price-changes'` | grep -c = 1 |
| EDIT C | `{ id: 'price-changes' as SubTab, label: 'Price Changes', mobileLabel: 'Prices' }` added to analyse subTabs | grep -c = 1 |
| EDIT D | `{activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}` added after AccuracyTab line | grep -c = 1 |

Render conditional and SECTIONS entry ordering verified: accuracy entries appear before price-changes entries in both cases.

---

## Browser Verification (Task 4 — Pending)

Task 4 is a human-verify checkpoint. See the checkpoint state returned below for full verification instructions.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced `.toBeInTheDocument()` with `.toBeTruthy()` in 2 test assertions**
- **Found during:** Task 2 verification (GREEN phase)
- **Issue:** The plan's test contract specified `expect(...).toBeInTheDocument()` which requires `@testing-library/jest-dom` matchers. This package's setup is not configured in `vitest.config.ts` (no `setupFilesAfterFramework`). All other test files in this codebase (InsightsTab, AccuracyTab) use `.toBeTruthy()` or direct container queries.
- **Fix:** Changed 2 assertions in `PriceChangePanel.test.tsx` to use `.toBeTruthy()`. The semantic is equivalent: `getByText()` already throws if the element is not found, so `.toBeTruthy()` on the returned DOM element is the correct pattern here.
- **Files modified:** src/components/price-changes/PriceChangePanel.test.tsx
- **Commit:** 0039c7f

---

## Known Stubs

None. All data flows from `usePriceChanges()` hook → real pipeline output. Cold-start empty-state is by design (D-05), not a stub.

---

## Threat Surface Scan

No new threat surface introduced beyond what is documented in the plan's threat model:
- T-054-13 (empty/cold-start state): mitigated — `!data || data.predictions.length === 0` guard renders graceful section.
- T-054-14 (inline-style progress bar): mitigated — `confidence_pct` is a TypeScript `number`, not a user-controlled string; CSS injection impossible.
- No new network endpoints, auth paths, or PII exposure introduced.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/price-changes/PriceChangePanel.tsx | FOUND |
| src/components/price-changes/PriceChangePanel.test.tsx | FOUND |
| commit e8ce0ed (test stubs RED) | FOUND |
| commit 0039c7f (component + test fix GREEN) | FOUND |
| commit 8af3ef7 (page.tsx wiring) | FOUND |
| PriceChangePanel import in page.tsx | FOUND |
| 'price-changes' in SubTab union | FOUND |
| price-changes SECTIONS entry | FOUND |
| price-changes render conditional | FOUND |
