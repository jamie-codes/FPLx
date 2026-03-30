---
phase: 08-minutes-risk-ui-transfer-integration
plan: "01"
subsystem: ui-components
tags: [mins-risk, badge, squad-view, gem-table, tdd]
dependency_graph:
  requires: [07-03]
  provides: [MinsRiskBadge, Risk column in SquadView, Risk column in GemTable]
  affects: [SquadView, GemTable, columns.tsx]
tech_stack:
  added: []
  patterns: [shared component, TDD red-green, TanStack display column]
key_files:
  created:
    - src/components/shared/MinsRiskBadge.tsx
    - tests/lib/mins-risk-badge.test.ts
  modified:
    - src/components/squad/SquadView.tsx
    - src/components/gem-table/columns.tsx
decisions:
  - getMinsRiskConfig returns null for both 'injured' and falsy/undefined values
  - Test file uses explicit vitest imports matching existing project convention (not globals)
metrics:
  duration: "~5 minutes"
  completed: "2026-03-30T08:02:09Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 8 Plan 01: MinsRisk Badge and Risk Column Summary

**One-liner:** MinsRiskBadge shared component with color-coded risk pills added to SquadView and GemTable Risk columns, backed by 7-case unit tests.

## What Was Built

Created `MinsRiskBadge.tsx` as a shared component mapping `MinsRisk` values to colored inline spans. The component exposes two exports: `getMinsRiskConfig` (pure function, testable) and `MinsRiskBadge` (React component). Added a Risk column to both SquadView (hand-rolled table) and GemTable (TanStack display column) between Status and Trend positions.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create MinsRiskBadge component with testable helper | cf731e8 | src/components/shared/MinsRiskBadge.tsx, tests/lib/mins-risk-badge.test.ts |
| 2 | Add Risk column to SquadView and GemTable | 8e519c7 | src/components/squad/SquadView.tsx, src/components/gem-table/columns.tsx, tests/lib/mins-risk-badge.test.ts |

## Verification

- `npx tsc --noEmit` passes (0 errors)
- `npx vitest run` passes (10 test files, 97 tests + 8 skipped)
- MinsRiskBadge renders green/blue/amber/zinc pills per risk level
- Returns null for `injured` and undefined/null inputs
- Risk column in SquadView after Status (column order: Player | Team | Price | Own% | Mins | Gem | Status | Risk)
- Risk column in GemTable between Status and Trend (... | Status | Risk | Trend | Next 5)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file used Vitest globals instead of explicit imports**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** Test was written using `describe`/`it`/`expect` as globals, but `vitest.config.ts` has `globals: true` for Vitest itself. However, TypeScript's `tsc --noEmit` errors on these as unknown names because the project doesn't include `@types/jest` or vitest global type declarations in `tsconfig.json`. Existing test files all use explicit `import { describe, it, expect } from 'vitest'`.
- **Fix:** Added `import { describe, it, expect } from 'vitest'` to match existing project convention.
- **Files modified:** tests/lib/mins-risk-badge.test.ts
- **Commit:** 8e519c7

## Known Stubs

None — all data flows from `player.mins_risk` on `ScoredPlayer` which is already non-nullable per Phase 7 pipeline schema.

## Self-Check: PASSED
