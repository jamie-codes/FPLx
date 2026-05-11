---
phase: 95
plan: "01"
subsystem: set-pieces
tags: [tdd, red-phase, set-pieces, league-table, pure-functions]
dependency_graph:
  requires: []
  provides: [setPieceLeague-stubs, SetPieceLeagueTable-stub, Wave0-RED-gate]
  affects: [src/lib/setPieceLeague.ts, src/components/set-pieces/SetPieceLeagueTable.tsx]
tech_stack:
  added: []
  patterns: [tdd-red-phase, vitest-node-env, vitest-jsdom-env, mock-hoisting]
key_files:
  created:
    - src/lib/setPieceLeague.ts
    - src/lib/setPieceLeague.test.ts
    - src/components/set-pieces/SetPieceLeagueTable.tsx
    - src/components/set-pieces/SetPieceLeagueTable.test.tsx
  modified: []
decisions:
  - "Stub functions throw 'not implemented' (not return null) so all 8 unit tests fail with runtime errors rather than assertion mismatches"
  - "Component stub renders <div data-testid> with no content so all 5 component tests fail as assertions (not compilation errors)"
  - "formatScore mock inlined into vi.mock factory so component tests can verify em-dash cells without depending on stub impl"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_created: 4
---

# Phase 95 Plan 01: Set-Piece League Table RED Phase Summary

Wave 0 TDD RED phase: 13 failing test cases establish the behaviour contract for `aggregateSetPieceLeague`, `computeCompositeScore`, `formatScore`, and `SetPieceLeagueTable` before any implementation is written.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write RED unit tests for setPieceLeague pure functions | 2e426cb | src/lib/setPieceLeague.ts, src/lib/setPieceLeague.test.ts |
| 2 | Write RED component tests for SetPieceLeagueTable | 756bb47 | src/components/set-pieces/SetPieceLeagueTable.tsx, src/components/set-pieces/SetPieceLeagueTable.test.tsx |

## Wave 0 Gate Verification

```
npx vitest run src/lib/setPieceLeague.test.ts src/components/set-pieces/SetPieceLeagueTable.test.tsx

Test Files  2 failed (2)
      Tests  13 failed (13)
```

All 13 tests confirmed RED. TypeScript compiles clean (zero new errors).

## TDD Gate Compliance

This is a Wave 0 RED-only plan (type: tdd). The RED gate is confirmed:
- `test(95-01)` commit `2e426cb` — 8 unit test cases RED
- `test(95-01)` commit `756bb47` — 5 component test cases RED
- GREEN gate belongs to Wave 1 (095-02-PLAN.md)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All stubs are intentional Wave 0 placeholders:

| File | Stub | Reason |
|------|------|--------|
| src/lib/setPieceLeague.ts | `computeCompositeScore` throws | Wave 0: RED phase requires all functions to throw |
| src/lib/setPieceLeague.ts | `formatScore` throws | Wave 0: RED phase requires all functions to throw |
| src/lib/setPieceLeague.ts | `aggregateSetPieceLeague` throws | Wave 0: RED phase requires all functions to throw |
| src/components/set-pieces/SetPieceLeagueTable.tsx | Renders empty `<div>` | Wave 0: Component stub for RED test phase |

Wave 1 (095-02-PLAN.md) replaces all stubs with real implementations.

## Threat Flags

None — pure client-side display code with no new trust boundaries. No new API endpoints, no new data sources. Consistent with the accepted threat disposition in the plan's threat model (T-95-01 and T-95-02 both accepted).

## Self-Check: PASSED

- [x] src/lib/setPieceLeague.ts — FOUND
- [x] src/lib/setPieceLeague.test.ts — FOUND
- [x] src/components/set-pieces/SetPieceLeagueTable.tsx — FOUND
- [x] src/components/set-pieces/SetPieceLeagueTable.test.tsx — FOUND
- [x] Commit 2e426cb — FOUND
- [x] Commit 756bb47 — FOUND
- [x] 13 tests failing, 0 passing — CONFIRMED
- [x] TypeScript compiles clean — CONFIRMED
