---
phase: 05-squad-view-transfer-suggestions
plan: 02
subsystem: transfer-engine
tags: [tdd, pure-function, transfer-suggestions, budget, chip-guard, multi-transfer]
dependency_graph:
  requires: [05-01]
  provides: [transfer-engine-function, squad-adapter-types]
  affects: [transfer-panel-ui, squad-view-ui]
tech_stack:
  added: []
  patterns: [pure-function, tdd-red-green, integer-position-codes, budget-as-tenths]
key_files:
  created:
    - src/lib/transfer-engine.ts
    - src/lib/squad-adapter.ts
    - tests/lib/transfer-engine.test.ts
  modified: []
decisions:
  - "Sort suggestions: affordable (budget_sufficient=true) before unaffordable, then gem_delta desc within each tier — plan said 'below' which means budget_sufficient is primary sort key"
  - "squad-adapter.ts created as Rule 3 fix: Plan 01 parallel dependency not yet landed; minimal Zod schema added to unblock transfer engine tests"
metrics:
  duration_seconds: 160
  completed_date: "2026-03-29"
  tasks_completed: 1
  files_touched: 3
---

# Phase 05 Plan 02: Transfer Engine Summary

**One-liner:** Pure `computeTransferSuggestions` function with chip guard, position-locked replacements, approximate budget enforcement, SAVE recommendation, and 2-transfer combo — fully TDD with 22 passing tests.

## What Was Built

`src/lib/transfer-engine.ts` — a pure TypeScript function that takes a squad, all scored players, bank balance, free transfer count, and active chip state, and returns a `TransferResult`:

- **CHIP_WARNING** when `activeChip` is `'freehit'` or `'wildcard'` (returned immediately, no suggestion logic runs)
- **SAVE** when no available transfer has `gem_delta > 0`
- **SUGGESTIONS** with ordered `SingleTransfer[]` and optional `two_transfer_combo`

`src/lib/squad-adapter.ts` — Zod schema and types for the FPL picks endpoint response (`SquadPick`, `EntryHistory`, `SquadPicksResponse`). Added as a Rule 3 fix because Plan 01 (parallel wave) had not yet landed.

`tests/lib/transfer-engine.test.ts` — 22 unit tests covering all 6 TRF requirements plus duplicate prevention.

## Algorithm

1. Chip guard (freehit/wildcard → immediate CHIP_WARNING)
2. Build `squadIds` Set for O(1) exclusion; build `playerMap` for fast player lookup
3. Extract starting XI (positions 1-11), sort by `gem_score` ascending → sell candidates
4. For each sell candidate: filter `allPlayers` by `element_type` integer (position lock) + not in squad → sort by `gem_score` desc → take top 3 → compute `SingleTransfer`
5. Sort all suggestions: `budget_sufficient=true` first, then `gem_delta` desc within each tier
6. Save check: if no `gem_delta > 0`, return SAVE
7. Two-transfer combo (if `freeTransfers >= 2`): pick best suggestion + next with distinct buy/sell IDs
8. Return SUGGESTIONS

## Tests

| Suite | Tests | Coverage |
|-------|-------|---------|
| Chip guard | 4 | freehit, wildcard warn; bboost, null pass through |
| Sell candidates (TRF-01) | 2 | bench excluded; worst gem first |
| Replacements (TRF-02/03) | 5 | position lock, no duplicates, max 3, sorted, gem_delta calc |
| Budget (TRF-04) | 4 | available_budget formula, budget_sufficient flags, sort order |
| Multi-transfer (TRF-05) | 4 | combo populated, distinct buys, distinct sells, absent for freeTransfers=1 |
| Save recommendation (TRF-06) | 2 | SAVE when all delta<=0; SUGGESTIONS when any delta>0 |
| Duplicate prevention | 1 | squad members never appear as buy candidates |
| **Total** | **22** | All passing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] squad-adapter.ts created as parallel-wave dependency**
- **Found during:** Task 1 (RED phase — import resolution)
- **Issue:** `tests/lib/transfer-engine.test.ts` imports `SquadPick` from `@/lib/squad-adapter`, but Plan 01 (which creates `squad-adapter.ts`) is executing in parallel and had not yet landed in this worktree
- **Fix:** Created `src/lib/squad-adapter.ts` with the canonical Zod schema from the research document — identical to what Plan 01 would produce. This matches the types referenced in the plan's context section
- **Files modified:** `src/lib/squad-adapter.ts` (new)
- **Commit:** 4f7c380

**2. [Rule 1 - Bug] Sort order: affordable-first is primary key, not secondary**
- **Found during:** GREEN phase — test "unaffordable suggestions sorted below affordable ones" failed
- **Issue:** Initial implementation sorted by `gem_delta` desc first, then `budget_sufficient` as tiebreaker. The test sets up a scenario where the unaffordable player has a *higher* gem_delta — but per the plan spec, unaffordable suggestions must be below affordable ones regardless of delta
- **Fix:** Changed sort to: `budget_sufficient` as primary key (true first), then `gem_delta` desc within each tier
- **Files modified:** `src/lib/transfer-engine.ts`
- **Commit:** 021ef89 (part of GREEN phase commit)

## Known Stubs

None. The function is fully implemented with no placeholder returns or hardcoded data.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/lib/transfer-engine.ts` | FOUND |
| `src/lib/squad-adapter.ts` | FOUND |
| `tests/lib/transfer-engine.test.ts` | FOUND |
| `05-02-SUMMARY.md` | FOUND |
| RED commit `4f7c380` | FOUND |
| GREEN commit `021ef89` | FOUND |
| All 22 tests passing | CONFIRMED |
| Full suite (64 tests) green | CONFIRMED |
