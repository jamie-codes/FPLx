---
phase: 45
plan: 02
subsystem: transfer-engine
tags: [engine, pure-function, tdd, housekeeping]
dependency_graph:
  requires:
    - 45-01   # TransferSuggestion type, SuggestTransfersParams interface, RED test suite
    - 44-01   # HORIZON_FIELD export in optimise-lineup.ts
  provides:
    - suggestTransfers()  # working engine consumed by Plan 03 OptimiserPanel integration
    - OptimiserPanel housekeeping (IN-01, CR-01)
  affects:
    - src/lib/suggest-transfers.ts
    - src/components/optimiser/OptimiserPanel.tsx
tech_stack:
  added: []
  patterns:
    - pure-function engine (mirrors optimise-lineup.ts)
    - position-keyed Map enumeration for top-30 pool
    - discriminated union TransferSuggestion (single | combo)
key_files:
  created: []
  modified:
    - src/lib/suggest-transfers.ts
    - src/components/optimiser/OptimiserPanel.tsx
decisions:
  - "2-FT xPtsGain uses additive approximation (sum of individual xPts deltas) not full optimiseLineup re-run per combo — 45-RESEARCH.md §Risk 7 / Open Question 1 resolved by plan spec"
  - "Engine emits both FREE (cost=0) and HIT (cost=4) variants for every 1-FT pair so UI ranks all options by gain"
  - "Pre-existing TypeScript errors in tests/lib/captain-picks.test.ts (5 TS2554 errors) exist before and after this plan — out of scope per deviation rules; deferred"
metrics:
  duration: ~10 minutes
  completed: "2026-04-30"
  tasks_completed: 2
  files_modified: 2
---

# Phase 45 Plan 02: suggestTransfers Engine Implementation Summary

**One-liner:** Real suggestTransfers engine implemented with top-30 per-position pool, budget filter, break-even formula, and 2-FT combo enumeration — all 13 RED tests turned GREEN. OptimiserPanel housekeeping fixes IN-01 (HORIZON_FIELD import) and CR-01 (pairSection bounds guard).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement real suggestTransfers engine | eebd736 | src/lib/suggest-transfers.ts |
| 2 | OptimiserPanel housekeeping IN-01 + CR-01 | cffcc99 | src/components/optimiser/OptimiserPanel.tsx |

## Test Results

### Engine tests (src/lib/suggest-transfers.test.ts) — 13/13 GREEN

```
 RUN  v4.1.2

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  22:27:07
   Duration  175ms
```

All test cases satisfied:
- Empty inputs → []
- No positive-gain candidates → []
- FREE single suggestion with correct buy player (id=20 for the stronger DEF)
- Sort descending by xPtsGain
- Hit suggestion with breakEvenGws = Math.max(1, Math.ceil(4 / xPtsGainPerGw))
- FREE suggestions have breakEvenGws === null
- xPtsGainPerGw === xPtsGain / horizon (within tolerance)
- Expensive buy filtered out by hard budget filter
- sellPrices Map used when provided
- now_cost fallback when sellPrices absent
- Currently-owned players not in buy pool
- Rank-41 DEF excluded by top-30 per-position filter
- 2-FT combo returned when ftCount=2, cost=0, transfers.length===2

### OptimiserPanel tests (src/components/optimiser/OptimiserPanel.test.tsx) — 15/15 GREEN (no regressions)

```
 Test Files  2 passed (2)
      Tests  28 passed (28)
   Start at  22:28:54
   Duration  739ms
```

## Acceptance Criteria Verified

### Task 1 — Engine

- `import { HORIZON_FIELD } from './optimise-lineup'` — present
- `const TOP_N_PER_POSITION = 30` — present
- `function breakEven(cost: 0 | 4, xPtsGainPerGw: number): number | null` — present
- `Math.max(1, Math.ceil(4 / xPtsGainPerGw))` — present
- `if (xPtsGain <= 0) continue` — present
- `if (bank + sellValue < buy.now_cost) continue` — present
- No eslint-disable-next-line — confirmed absent
- No `void params` or `void _HORIZON_FIELD` skeleton scaffolding — confirmed absent
- No `'use client'` — confirmed absent
- No React imports — confirmed absent
- Single `return []` (early-return for empty inputs only) — 1 match confirmed

### Task 2 — OptimiserPanel housekeeping

- `import { optimiseLineup, HORIZON_FIELD } from '@/lib/optimise-lineup'` — present (line 11)
- Local HORIZON_FIELD re-declaration removed — 0 matches for `^const HORIZON_FIELD: Record<OptimiserHorizon`
- `HORIZON_FIELD[horizon]` usage still present (line 228) — 1 match
- `i < sortedOptimised.length ? sortedOptimised[i] : currentId` — present (CR-01 fix)
- Old `sortedOptimised[i] ?? currentId` form — 0 matches (removed)
- `OptimiserHorizon` still imported — 2 matches (import + useState type arg)
- No new state/hooks (ftCount, useMyTeam, FtToggle, suggestTransfers) in OptimiserPanel — confirmed (Plan 03 owns those)

## Deviations from Plan

None - plan executed exactly as written. The complete engine code was provided in the plan and implemented verbatim.

## Known Stubs

None. The engine is fully functional. The integration with OptimiserPanel UI (Plan 03) is next.

## Deferred Issues

**Pre-existing TypeScript errors in tests/lib/captain-picks.test.ts** (5x TS2554 — Expected 0 arguments, but got 1):
- Exist in HEAD before and after this plan's changes
- Out of scope (different file, different subsystem)
- Will be tracked as: `deferred: tests/lib/captain-picks.test.ts TS2554 pre-existing errors`

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Engine is a pure function with no I/O. OptimiserPanel changes are import-only + 1-line guard change with no new data flows. No threat flags.

## Self-Check: PASSED

Files modified:
- [x] src/lib/suggest-transfers.ts — exists (184 lines of real engine)
- [x] src/components/optimiser/OptimiserPanel.tsx — exists (HORIZON_FIELD imported, local removed, CR-01 fixed)

Commits:
- [x] eebd736 — feat(45-02): implement real suggestTransfers engine
- [x] cffcc99 — refactor(45-02): OptimiserPanel housekeeping IN-01 + CR-01
