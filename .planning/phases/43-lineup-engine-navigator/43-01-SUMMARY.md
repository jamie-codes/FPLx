---
phase: 43
plan: 01
subsystem: optimiser-engine
tags: [typescript, engine, vitest, fpl, optimiser, tdd]
dependency_graph:
  requires: []
  provides:
    - OptimiserHorizon type (src/lib/types.ts)
    - OptimisedLineup type (src/lib/types.ts)
    - optimiseLineup pure function (src/lib/optimise-lineup.ts)
    - HORIZON_FIELD constant (src/lib/optimise-lineup.ts)
    - OptimiserPanel stub component (src/components/optimiser/OptimiserPanel.tsx)
  affects:
    - src/lib/types.ts (types added)
    - Plan 02 (imports OptimiserPanel for nav wiring)
    - Plan 03 (replaces OptimiserPanel stub with full implementation)
tech_stack:
  added: []
  patterns:
    - Pure TS combinatorial enumeration C(15,11)=1365 subsets
    - TDD RED->GREEN cycle with vitest
    - chip-strategy-engine.ts import discipline (no React, no side effects)
key_files:
  created:
    - src/lib/optimise-lineup.ts (154 lines)
    - src/lib/optimise-lineup.test.ts (235 lines)
    - src/components/optimiser/OptimiserPanel.tsx (24 lines)
    - src/components/optimiser/OptimiserPanel.test.tsx (18 lines)
  modified:
    - src/lib/types.ts (+15 lines: OptimiserHorizon + OptimisedLineup)
decisions:
  - "Engine returns null for <11 eligible players to safely handle BGW scenarios"
  - "BGW exclusion uses === 0 (exact), not undefined — Pitfall 1 preserved as a feature"
  - "Tie-break uses > not >= per chip-strategy-engine convention (first-found wins)"
  - "Captain fallback chain: xPts_90th_1gw ?? xPts_1gw ?? 0"
  - "OptimiserPanel stub exists only to enable Plan 02 import and Plan 03 mock — no UI logic"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-30"
  tasks_completed: 4
  files_created: 4
  files_modified: 1
  tests_added: 15
---

# Phase 43 Plan 01: Lineup Engine and OptimiserPanel Stub Summary

**One-liner:** Pure TS optimiseLineup engine (C(15,11) enumeration, BGW exclusion, horizon scoring, captain fallback chain) with 13 TDD unit tests covering OPT-01..OPT-05, plus OptimiserPanel stub for Plan 02 nav wiring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add OptimiserHorizon and OptimisedLineup types | 8214c19 | src/lib/types.ts |
| 2 | Write RED test stubs for engine (OPT-01..OPT-05) | 77edbee | src/lib/optimise-lineup.test.ts |
| 3 | Implement optimiseLineup engine (GREEN) | e626391 | src/lib/optimise-lineup.ts, src/lib/optimise-lineup.test.ts |
| 4 | Create OptimiserPanel stub + test stubs | db221e5 | src/components/optimiser/OptimiserPanel.tsx, src/components/optimiser/OptimiserPanel.test.tsx |

## Test Results

```
npx vitest run src/lib/optimise-lineup.test.ts src/components/optimiser/OptimiserPanel.test.tsx

 Test Files  2 passed (2)
      Tests  15 passed (15)
```

- 13 engine tests (OPT-01..OPT-05 across 5 describe groups)
- 2 OptimiserPanel stub tests

## TDD Gate Compliance

- RED gate: `test(43-01)` commit 77edbee — 13 failing stubs (Cannot find module)
- GREEN gate: `feat(43-01)` commit e626391 — all 13 tests pass
- REFACTOR gate: Minor fix applied inline (duplicate property TS2783 in makePlayer factory)

## Verification

- `grep -c "export type OptimiserHorizon = 1 | 3 | 5" src/lib/types.ts` → 1
- `grep -c "export interface OptimisedLineup" src/lib/types.ts` → 1
- `grep -c "export function optimiseLineup" src/lib/optimise-lineup.ts` → 1
- `grep -c "export const HORIZON_FIELD" src/lib/optimise-lineup.ts` → 1
- No React imports in engine file
- `npx tsc --noEmit` → clean (only pre-existing captain-picks.test.ts errors unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate property TS2783 in makePlayer test factory**
- **Found during:** Task 3 TypeScript check
- **Issue:** `makePlayer()` explicitly set `id: overrides.id` and `element_type: overrides.element_type` then also spread `...overrides` at the end, causing TS2783 "specified more than once" errors
- **Fix:** Removed the explicit `id:` and `element_type:` lines; the `...overrides` spread at the end already sets them correctly
- **Files modified:** src/lib/optimise-lineup.test.ts
- **Commit:** e626391 (included in Task 3 commit)

## Known Stubs

- `src/components/optimiser/OptimiserPanel.tsx`: Intentional stub — renders placeholder div only. Full pitch-layout implementation ships in Plan 03. Plan 02 requires this file to exist for nav wiring imports.

## Threat Surface Scan

No new threat surface introduced. Engine is a pure function with no network calls, no user inputs, and no API endpoints. OptimiserPanel stub renders only static placeholder text with no data.

## Self-Check: PASSED

Files created:
- [x] src/lib/optimise-lineup.ts exists
- [x] src/lib/optimise-lineup.test.ts exists
- [x] src/components/optimiser/OptimiserPanel.tsx exists
- [x] src/components/optimiser/OptimiserPanel.test.tsx exists

Types in src/lib/types.ts:
- [x] OptimiserHorizon exported
- [x] OptimisedLineup exported
- [x] MergedPlayer unchanged (1 interface definition)

Commits verified:
- [x] 8214c19 — feat(43-01): add OptimiserHorizon and OptimisedLineup types
- [x] 77edbee — test(43-01): add RED test stubs
- [x] e626391 — feat(43-01): implement optimiseLineup engine
- [x] db221e5 — feat(43-01): add OptimiserPanel stub component
