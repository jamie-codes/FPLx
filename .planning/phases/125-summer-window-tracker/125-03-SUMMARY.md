---
phase: 125
plan: "03"
subsystem: summer-window-tracker
tags: [cleanup, prop-rename, import-fix]
dependency_graph:
  requires: [125-01, 125-02]
  provides: [summer-window-integration-complete]
  affects: [page.tsx, ConfirmedSigningBadge, GemTable, OpportunityCostTable]
tech_stack:
  added: []
  patterns: [prop-rename, dead-code-removal]
key_files:
  modified:
    - src/app/page.tsx
    - src/components/shared/ConfirmedSigningBadge.tsx
    - src/components/shared/ConfirmedSigningBadge.test.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/transfers/OpportunityCostTable.tsx
  deleted:
    - src/components/summer-window/SummerWindowTab.tsx
    - src/components/summer-window/SummerWindowTab.test.tsx
decisions:
  - Renamed ConfirmedSigningBadge prop from title to tooltipText per spec D-15 for clarity
  - Deleted duplicate summer-window/ directory created by Plan 01 scope-overrun
metrics:
  duration: "~5 minutes"
  completed: "2026-05-19"
  tasks_completed: 4
  files_changed: 7
---

# Phase 125 Plan 03: Summer Window Tracker — Cleanup and Spec Compliance Summary

Fix Wave 1 scope-overrun deviations: correct import path, remove duplicate dead code directory, rename ConfirmedSigningBadge prop from `title` to `tooltipText` across component, tests, and all call sites.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Fix page.tsx import path (summer-window -> news/) | d4dca1c |
| 2 | Delete src/components/summer-window/ (dead code) | d4dca1c |
| 3 | Rename ConfirmedSigningBadge prop title -> tooltipText | d4dca1c |
| 4 | Update all call sites in GemTable and OpportunityCostTable | d4dca1c |

## Verification

- `npx tsc --noEmit`: passes (only pre-existing decision-history/route.test.ts error)
- `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx src/components/news/SummerWindowTab.test.tsx`: 17 tests passed (2 files)
- `npx vitest run src/app/page.test.tsx`: 17 tests passed
- `npm test` (full suite): 1492 tests passed | 34 skipped (117 test files)

## Deviations from Plan

### Plan 01 Scope-Overrun (inherited, now resolved)

**[Rule 1 - Bug] Wrong import path in page.tsx**
- **Found during:** Pre-execution analysis (deviation_context)
- **Issue:** Plan 01 added `import { SummerWindowTab } from '@/components/summer-window/SummerWindowTab'` pointing to a duplicate file that doesn't exist at the correct path
- **Fix:** Updated import to `@/components/news/SummerWindowTab` (the correct component created by Plan 02)
- **Files modified:** src/app/page.tsx
- **Commit:** d4dca1c

**[Rule 2 - Cleanup] Duplicate summer-window/ directory with TypeScript errors**
- **Found during:** Pre-execution analysis (deviation_context)
- **Issue:** Plan 01 created `src/components/summer-window/SummerWindowTab.tsx` and `SummerWindowTab.test.tsx` with TypeScript errors (`article_count` not in `SourceHealth` type); dead code not referenced by any correct import
- **Fix:** Deleted both files and the directory
- **Files deleted:** src/components/summer-window/SummerWindowTab.tsx, src/components/summer-window/SummerWindowTab.test.tsx
- **Commit:** d4dca1c

**[Rule 1 - Bug] ConfirmedSigningBadge prop named `title` instead of spec-required `tooltipText`**
- **Found during:** Pre-execution analysis (deviation_context)
- **Issue:** Plan 01 used prop name `title` which collides with the HTML title attribute semantics. Spec D-15 specifies `tooltipText` as the prop name for clarity.
- **Fix:** Renamed prop to `tooltipText` in component + test + GemTable + OpportunityCostTable
- **Files modified:** ConfirmedSigningBadge.tsx, ConfirmedSigningBadge.test.tsx, GemTable.tsx, OpportunityCostTable.tsx
- **Commit:** d4dca1c

## Known Stubs

None — all integrations wired correctly by Wave 1 plans.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- src/app/page.tsx — modified, import points to @/components/news/SummerWindowTab
- src/components/shared/ConfirmedSigningBadge.tsx — prop renamed to tooltipText
- src/components/summer-window/ — directory deleted
- Commit d4dca1c — verified in git log
- All 1492 tests passing
