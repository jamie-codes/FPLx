---
phase: 43
plan: 03
subsystem: optimiser-ui
tags: [react, tailwind, fpl, optimiser, ui, pitch, rtl, vitest]
dependency_graph:
  requires:
    - optimiseLineup pure function (src/lib/optimise-lineup.ts) from Plan 01
    - OptimiserHorizon/OptimisedLineup types (src/lib/types.ts) from Plan 01
    - OptimiserPanel stub (src/components/optimiser/OptimiserPanel.tsx) from Plan 01
    - Squad sub-tab nav wiring + teamId prop from Plan 02
  provides:
    - Full OptimiserPanel pitch UI (src/components/optimiser/OptimiserPanel.tsx)
    - RTL integration tests for OPT-01..OPT-05 (src/components/optimiser/OptimiserPanel.test.tsx)
  affects:
    - src/lib/types.ts (OptimiserHorizon + OptimisedLineup types added — pre-existing gap from Plan 01 worktree merge)
    - Plan 03 Task 3 (human-verify checkpoint — PENDING)
tech_stack:
  added: []
  patterns:
    - FPL pitch convention: FWD top, MID, DEF, GK bottom (4 positional rows)
    - useMemo wrapping optimiseLineup (stable deps: squadData, playersData, horizon)
    - GwToggle reuse — direct import, no wrapper, accepts OptimiserHorizon (1|3|5)
    - RTL integration test: hooks mocked, real engine runs (no engine mock)
    - Bench-aware selector: filter bench-row children from pitch children for starter assertions
key_files:
  created: []
  modified:
    - src/components/optimiser/OptimiserPanel.tsx (stub replaced — 24 lines → 291 lines, +267 net)
    - src/components/optimiser/OptimiserPanel.test.tsx (stub replaced — 18 lines → 300 lines, +282 net)
    - src/lib/types.ts (+12 lines: OptimiserHorizon + OptimisedLineup types — Rule 3 fix)
decisions:
  - "startersByPosition replaced with flat variables (starterGks/Defs/Mids/Fwds) to avoid TypeScript implicit-any on computed object keys"
  - "OPT-02 test uses bench-aware selector (filters out bench-row children) to isolate starter circles"
  - "makePlayer factory: removed explicit id/element_type fields; spread overrides at end handles them (fixes TS2783)"
  - "OptimiserHorizon/OptimisedLineup types added to types.ts (pre-existing gap from Plan 01 worktree not merged)"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-30"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
  tests_added: 13
---

# Phase 43 Plan 03: Full OptimiserPanel UI Summary

**One-liner:** Full FPL pitch UI replacing Plan 01 stub — green pitch with FWD/MID/DEF/GK rows, (C)/(VC) badges, bench GK slot with divider, horizon toggle, BGW banners, 13 RTL integration tests covering OPT-01..OPT-05.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace OptimiserPanel stub with full pitch UI implementation | 86e7ec1 | src/components/optimiser/OptimiserPanel.tsx, src/lib/types.ts |
| 2 | Replace OptimiserPanel stub tests with full RTL integration suite | 0e86c76 | src/components/optimiser/OptimiserPanel.test.tsx |

## Test Results

```
npx vitest run src/components/optimiser/OptimiserPanel.test.tsx

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  17:33:49
   Duration  686ms
```

- 4 state branch tests (empty, loading, error, fallback error)
- 3 OPT-01 pitch/formation tests (pitch presence, bg-green-950, 11 starter circles)
- 1 OPT-02 horizon toggle test (5GW re-optimises lineup)
- 2 OPT-03 captain/VC badge tests (count + colour classes)
- 1 OPT-04 bench row test (GK slot, divider, 3 outfield slots)
- 2 OPT-05 BGW banner tests (critical null-lineup, soft partial-exclusion)

## TypeScript Status

Pre-existing errors remain (not caused by this plan):
- `src/app/page.tsx(131,15)` — TS2367 pre-existing from Plan 02
- `src/components/nav/MobileNav.tsx(20,13)` — TS2367 pre-existing from Plan 02
- `tests/lib/captain-picks.test.ts(158-212)` — TS2554 pre-existing from Phase 31

No new TypeScript errors introduced by Plan 03.

## Checkpoint Status

**Task 3 (checkpoint:human-verify): PENDING**

Human verification of the live dev server is required before the plan is complete. The automated tasks (1 and 2) are complete and committed. The orchestrator will present the checkpoint to the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Add missing OptimiserHorizon and OptimisedLineup types to src/lib/types.ts**
- **Found during:** Task 1 — `npx tsc --noEmit` returned `error TS2305: Module '"@/lib/types"' has no exported member 'OptimiserHorizon'`
- **Issue:** The Plan 01 executor ran in a separate worktree and added these types. The worktree merge for this plan's base commit (`1ef724a`) did not include the types.ts update from that worktree
- **Fix:** Added `export type OptimiserHorizon = 1 | 3 | 5` and `export interface OptimisedLineup` to src/lib/types.ts after the MergedPlayer interface, before DefConPlayer
- **Files modified:** src/lib/types.ts
- **Commit:** 86e7ec1

**2. [Rule 1 - Bug] Refactored startersByPosition to flat variables to fix TypeScript implicit-any**
- **Found during:** Task 1 — `npx tsc --noEmit` returned TS7006 on filter callbacks inside computed property object
- **Issue:** `const startersByPosition = { [GK]: ..., [DEF]: ... }` uses numeric computed keys; TypeScript infers the callback `id` as `any` when mapping over `startersByPosition[FWD]`
- **Fix:** Replaced computed-key object with 4 flat variables (`starterGks`, `starterDefs`, `starterMids`, `starterFwds`) with explicit `(id: number)` type annotations
- **Files modified:** src/components/optimiser/OptimiserPanel.tsx
- **Commit:** 86e7ec1

**3. [Rule 1 - Bug] OPT-02 test used pitch-level selector that included bench circles**
- **Found during:** Task 2 — test `clicking 5GW changes the formation/lineup output` failed because `player-circle-3` appeared in the bench row (inside the pitch div)
- **Issue:** Selector `[data-testid="pitch"] > div [data-testid^="player-circle-"]` matched ALL circles inside the pitch, including bench players. Player 3 (xPts_1gw=0.1) was correctly benched at horizon=1 but the test treated it as a starter
- **Fix:** Added bench-aware selector — filters out circles that are children of `[data-testid="bench-row"]` to isolate only the starter circles
- **Files modified:** src/components/optimiser/OptimiserPanel.test.tsx
- **Commit:** 0e86c76

**4. [Rule 1 - Bug] Fixed TS2783 duplicate property in makePlayer factory**
- **Found during:** Task 2 tsc check — same issue as Plan 01 makePlayer factory
- **Issue:** `id` and `element_type` were set explicitly AND in `...overrides` spread
- **Fix:** Removed explicit `id` and `element_type` lines; spread handles them
- **Files modified:** src/components/optimiser/OptimiserPanel.test.tsx
- **Commit:** 0e86c76

## Known Stubs

None — all Plan 01 stubs replaced with full implementations.

## Threat Surface Scan

No new threat surface introduced beyond what was analyzed in the Plan 03 threat model. OptimiserPanel renders only data from `usePlayers` (existing `/api/players`) and `useSquad` (existing `/api/squad/[teamId]`). T-43-09 (DoS via useMemo) mitigated per plan — optimiseLineup wrapped in useMemo with stable deps.

## Self-Check: PASSED

Files modified (all tracked in git):
- [x] src/components/optimiser/OptimiserPanel.tsx — full pitch UI (291 lines)
- [x] src/components/optimiser/OptimiserPanel.test.tsx — 13 RTL tests (300 lines)
- [x] src/lib/types.ts — OptimiserHorizon + OptimisedLineup added

Commits verified:
- [x] 86e7ec1 — feat(43-03): replace OptimiserPanel stub with full pitch UI implementation
- [x] 0e86c76 — feat(43-03): replace OptimiserPanel stub tests with full RTL integration suite

Tests: 13 passed, 0 failed.
tsc: no new errors (pre-existing errors unchanged).
