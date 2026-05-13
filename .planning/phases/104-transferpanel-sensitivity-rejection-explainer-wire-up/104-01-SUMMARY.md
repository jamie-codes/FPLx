---
phase: 104-transferpanel-sensitivity-rejection-explainer-wire-up
plan: "01"
subsystem: transfers
tags:
  - transfer-panel
  - ocs-table
  - rejection-explainer
  - why-01
  - sensitivity
dependency_graph:
  requires:
    - src/lib/explain.ts (computeRejection — unit-tested in Phase 65/94, unchanged)
    - src/lib/lifecycle-label.ts (LifecycleLabel type, computeLifecycleLabels — unchanged)
    - src/lib/sensitivity.ts (computeFragility — Phase 93, unchanged)
    - src/components/shared/FragilityBadge.tsx (SENS-01 artefact — unchanged)
  provides:
    - WHY-01: sell-side rejection reasons inline in OCS table rows
    - Two new required props on OpportunityCostTable: allPlayers, lifecycleLabels
  affects:
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
    - src/components/squad/DecisionSummaryTab.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx
tech_stack:
  added: []
  patterns:
    - computeRejection call co-located with computeFragility in PlayerMoveCell (per-leg)
    - QueryClientProvider wrapper in test for components using useQuery hooks
    - as unknown as ScoredPlayer cast for MergedPlayer-typed OCS transfers at runtime
key_files:
  created: []
  modified:
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
    - src/components/squad/DecisionSummaryTab.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx
decisions:
  - "Used as unknown as ScoredPlayer cast in PlayerMoveCell since OCSRow types t.sell as MergedPlayer but runtime data is ScoredPlayer (from scoredPlayers memo)"
  - "Added QueryClientProvider wrapper helper in test file — NewsBanner calls useNewsFlagEnabled which calls useQuery; roll-row tests work without it because PlayerMoveCell returns early"
  - "Combined ScoredPlayer import with OptimiserHorizon on one line (import type { OptimiserHorizon, ScoredPlayer } from '@/lib/types') — functionally equivalent to separate line"
metrics:
  duration: "~15 min"
  completed: "2026-05-13"
  tasks: 3
  files: 4
---

# Phase 104 Plan 01: WHY-01 sell-rejection-reasons wire-up to OCS table Summary

WHY-01 (rejection explainer) wired onto sell side of every OCS row in TransferPanel and DecisionSummaryTab via two new required props on OpportunityCostTable, calling the existing unit-tested `computeRejection` engine per transfer leg.

## What Was Built

**SENS-01:** Already satisfied by Phase 93 `FragilityBadge` on buy candidates. No new code.

**WHY-01:** `computeRejection` is now called per transfer leg's `t.sell` inside `PlayerMoveCell`. Up to 4 rejection reasons render always-visible inline directly below the sell player name as `<p className="text-xs text-zinc-500 dark:text-zinc-400">` elements. Strong sells (empty reasons) render nothing. Multi-leg combo rows render per-leg independently.

## Files Changed (4)

| File | Change |
|------|--------|
| `src/components/transfers/OpportunityCostTable.tsx` | Added `allPlayers`, `lifecycleLabels` required props; call `computeRejection` per leg; render sell-reasons block |
| `src/components/transfers/TransferPanel.tsx` | Pass `allPlayers={scoredPlayers}` and `lifecycleLabels={lifecycleLabels}` to `<OpportunityCostTable>` |
| `src/components/squad/DecisionSummaryTab.tsx` | Same prop threading for second production consumer |
| `src/components/transfers/OpportunityCostTable.test.tsx` | 6 existing tests updated with new required props; 4 new WHY-01 tests added |

## Tests

- **Tests added:** 4 (empty-reasons silence, weak-sell reasons render, slice-cap at 4, per-leg combo independence)
- **Tests updated:** 6 (column-header tests — added `allPlayers={[]}` and `lifecycleLabels={new Map()}`)
- **TDD cycle:** RED (fca24d9) → GREEN (2180a5f)
- **Total test file:** 10 tests, all passing

## Key Grep Evidence

```
grep -c "import { computeRejection } from '@/lib/explain'" src/components/transfers/OpportunityCostTable.tsx  => 1
grep -c "computeRejection(t.sell" src/components/transfers/OpportunityCostTable.tsx                          => 1
grep -c "sellReasons.slice(0, 4)" src/components/transfers/OpportunityCostTable.tsx                          => 1
grep -c 'data-testid="sell-rejection-reasons"' src/components/transfers/OpportunityCostTable.tsx             => 1
grep -c "allPlayers={scoredPlayers}" src/components/transfers/TransferPanel.tsx                               => 1 (new)
grep -c "allPlayers={scoredPlayers}" src/components/squad/DecisionSummaryTab.tsx                              => 1
grep -c "tier !== 'robust' && <FragilityBadge" src/components/transfers/OpportunityCostTable.tsx             => 1 (untouched)
git diff src/lib/explain.ts src/lib/sensitivity.ts src/lib/lifecycle-label.ts | wc -c                        => 0
```

## Verification Command Outputs

- `npx tsc --noEmit`: exit 0 (clean)
- `npx vitest run src/components/transfers/OpportunityCostTable.test.tsx`: 10/10 passed
- `npx next build`: exit 0 (clean)
- `npx eslint src/components/transfers/OpportunityCostTable.tsx src/components/squad/DecisionSummaryTab.tsx`: clean (pre-existing `Date.now()` purity error in TransferPanel.tsx:55 is out of scope)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | fca24d9 | test(104-01): add failing WHY-01 sell-rejection-reasons tests |
| 2 (GREEN) | 2180a5f | feat(104-01): add WHY-01 sell rejection reasons to OCS PlayerMoveCell |
| 3 | 19685a8 | feat(104-01): thread scoredPlayers + lifecycleLabels into OCS table call sites |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] QueryClientProvider wrapper in test**
- **Found during:** Task 1 (RED phase)
- **Issue:** New WHY-01 tests rendered `single-free` rows which trigger `PlayerMoveCell` full render path including `<NewsBanner>` which calls `useNewsFlagEnabled` (a `useQuery` hook). Tests failed with "No QueryClient set".
- **Fix:** Added `withQueryClient(ui)` helper that wraps the component in `QueryClientProvider` with a no-retry QueryClient. Used for all 4 WHY-01 tests. Column-header tests (roll rows only) continue without wrapper.
- **Files modified:** `src/components/transfers/OpportunityCostTable.test.tsx`
- **Commit:** fca24d9

**2. [Rule 1 - Bug] FixtureEntry type mismatch in test fixture**
- **Found during:** Task 2 TypeScript check
- **Issue:** Test factory used `opponent_team: 5` (number) but `FixtureEntry.opponent_team` is `string`. Also missing required `difficulty_score` field.
- **Fix:** Changed to `opponent_team: 'MCI'`/`'ARS'` and added `difficulty_score: 0.2`/`0.9`.
- **Files modified:** `src/components/transfers/OpportunityCostTable.test.tsx`
- **Commit:** 19685a8

**3. [Rule 1 - Bug] ScoredPlayer/MergedPlayer type mismatch at call site**
- **Found during:** Task 2 implementation
- **Issue:** `OCSRow.transfers[].sell` is typed as `MergedPlayer`, but `computeRejection` requires `ScoredPlayer`. Runtime data is `ScoredPlayer` (from `scoredPlayers` memo) but type system doesn't know this.
- **Fix:** Applied `t.sell as unknown as ScoredPlayer` cast with comment explaining the invariant. No runtime impact.
- **Files modified:** `src/components/transfers/OpportunityCostTable.tsx`
- **Commit:** 2180a5f

## Known Stubs

None. All sell-side reasons are computed from real `computeRejection` results. No placeholder or hardcoded empty values.

## Threat Flags

None. This plan adds no new network endpoints, auth paths, file access patterns, or schema changes. The change is purely presentational — reading from existing in-memory state.
