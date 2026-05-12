---
phase: 101
plan: "03"
subsystem: ux
tags: [ux, label-rename, gw-toggle, fpl-analyst]
one_liner: "GwToggle button labels renamed from '{N} GW' to 'Next N GW(s)' with correct singular/plural handling"
dependency_graph:
  requires: []
  provides: [UX-01]
  affects: [GwToggle, FixtureEaseRankingPanel, OptimiserPanel]
tech_stack:
  added: []
  patterns: ["JSX inline ternary for singular/plural label"]
key_files:
  modified:
    - src/components/gem-table/GwToggle.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx
    - tests/components/club-form/FixtureEaseRankingPanel.test.tsx
decisions:
  - "HorizonSelector.tsx (PlannerHorizon 1-5) and its test at page.test.tsx:294 are intentionally left unchanged per scope_audit — they are a different component with a different aria-label and different UX context"
  - "PlayerComparisonModal.tsx '1 GW'/'3 GW'/'5 GW' static row labels are intentionally left unchanged per scope_audit"
metrics:
  duration: "~5 min"
  completed: "2026-05-12"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
---

# Phase 101 Plan 03: GwToggle UX-01 Label Rename Summary

GwToggle button labels renamed from `{N} GW` to `Next N GW / Next N GWs` (singular/plural) per decision D-12. Pure display-string change — zero data-logic impact.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rename GwToggle button label + update test assertions | 406f4ed | GwToggle.tsx, OptimiserPanel.test.tsx, FixtureEaseRankingPanel.test.tsx |

## Changes Made

### GwToggle.tsx (line 115)

Before:
```tsx
{gw} GW
```

After:
```tsx
Next {gw} GW{gw === 1 ? '' : 's'}
```

Produces:
- `gw === 1` → "Next 1 GW" (singular)
- `gw === 3` → "Next 3 GWs" (plural)
- `gw === 5` → "Next 5 GWs" (plural)

### OptimiserPanel.test.tsx (lines 208-209)

Before:
```typescript
// Click the 5GW toggle button (GwToggle renders "5 GW" — note the space)
const fiveGwBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === '5 GW')
```

After:
```typescript
// Click the 5GW toggle button (Phase 101 UX-01: GwToggle now renders "Next 5 GWs")
const fiveGwBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Next 5 GWs')
```

### FixtureEaseRankingPanel.test.tsx (lines 114, 195) — Rule 1 auto-fix

`FixtureEaseRankingPanel` imports `GwToggle` directly, so the label change broke 2 existing tests. Auto-fixed:
- Line 114: `getByRole('button', { name: '3 GW' })` → `getByRole('button', { name: 'Next 3 GWs' })`
- Line 195: `getByRole('button', { name: '5 GW' })` → `getByRole('button', { name: 'Next 5 GWs' })`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FixtureEaseRankingPanel test queries for old GW label text**
- **Found during:** Task 1 verification (full test suite run)
- **Issue:** `FixtureEaseRankingPanel.tsx` imports and renders `GwToggle` directly. Two tests in `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` queried `'3 GW'` and `'5 GW'` by ARIA name, which broke when labels changed to `'Next 3 GWs'` / `'Next 5 GWs'`.
- **Fix:** Updated the two test assertions to use the new label text.
- **Files modified:** `tests/components/club-form/FixtureEaseRankingPanel.test.tsx`
- **Commit:** 406f4ed (bundled into same task commit)

## Scope Boundary Confirmation

Out-of-scope files are **UNCHANGED** — verified with `git diff`:
- `src/components/planner/HorizonSelector.tsx` — still renders `{gw} GW` (different component, PlannerHorizon 1-5, aria-label="Planning horizon")
- `src/app/page.test.tsx` — still queries `'1 GW'` in `aria-label="Planning horizon"` group (HorizonSelector button, not GwToggle)
- `src/components/gem-table/PlayerComparisonModal.tsx` — static `'1 GW'` / `'3 GW'` / `'5 GW'` row labels left as-is
- `src/components/gem-table/PlayerComparisonModal.test.tsx` — assertions for modal row labels left as-is
- `src/components/squad/DecisionSummaryTab.tsx` — static labels left as-is
- `src/lib/explain.ts` — prose strings left as-is
- `src/components/gem-table/RegressionSignalBadge.tsx` — tooltip strings left as-is

## Test Results

### Targeted suite (plan-specified)
`npx vitest run src/components/gem-table/GwToggle src/components/optimiser/OptimiserPanel src/app/page`
- **Result:** 68 tests passed, 0 failed

### Full suite
`npx vitest run`
- **Result:** 1170 passed, 25 failed, 34 skipped
- The 25 failures are pre-existing (verified by stashing changes and re-running):
  - `captain-picks.test.ts` (5) — Invalid hook call errors, pre-existing from Phase 57 (listed in STATE.md Deferred Items as TEST-57)
  - `club-form.test.ts` (1) — difficulty tier test, pre-existing
  - `MobileNav.test.tsx` (10) — pre-existing nav pill count failures (listed in STATE.md WR-03/04)
  - `useRivals.test.ts` (9) — fetch timing failures, pre-existing

### TypeScript
`npx tsc --noEmit` — exits 0 (clean)

## Grep Audit (post-execution)

Remaining `'1 GW'` / `'3 GW'` / `'5 GW'` references in test/src files (all intentionally untouched):
- `src/app/page.test.tsx:294` — HorizonSelector button (out of scope)
- `src/components/gem-table/PlayerComparisonModal.test.tsx:195-197` — modal row labels (out of scope)

No in-scope file (`GwToggle.tsx`, `OptimiserPanel.test.tsx`) retains old label patterns.

## Known Stubs

None — this plan delivers complete UX-01 label rename with no stubs or placeholders.

## Threat Flags

None — pure display string change, no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] `src/components/gem-table/GwToggle.tsx` exists and contains `Next {gw} GW{gw === 1 ? '' : 's'}`
- [x] `src/components/optimiser/OptimiserPanel.test.tsx` contains `'Next 5 GWs'`
- [x] `tests/components/club-form/FixtureEaseRankingPanel.test.tsx` updated for new labels
- [x] Commit 406f4ed exists
- [x] HorizonSelector.tsx and page.test.tsx are unchanged (out-of-scope boundary respected)
- [x] Full targeted test suite: 68/68 pass
- [x] `npx tsc --noEmit` exits 0
