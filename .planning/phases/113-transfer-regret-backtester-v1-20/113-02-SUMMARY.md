---
phase: 113-transfer-regret-backtester-v1-20
plan: "02"
subsystem: testing
tags: [fpl, regret, transfer-delta, pure-function, tdd, vitest, typescript]

# Dependency graph
requires:
  - phase: 113-01
    provides: TransferRegretEntry type in types.ts (Plan 02 adds this type itself as parallel-safe deviation)
provides:
  - "computeTransferDelta: pure function — signed delta between engine recommendation and user action, 1dp rounding"
  - "computeTransferSeasonSummary: pure function — aggregate season stats from TransferRegretEntry[]"
  - "TransferSeasonSummary interface: totalDelta, gwsWithData, engineBetter, userBetter, tied"
  - "TransferRegretEntry + SlimPlayer types in types.ts"
  - "DecisionHistory.transferEntries? optional extension field"
affects:
  - 113-03 (API route — imports computeTransferDelta from regret.ts)
  - 113-04 (BackTab UI — imports computeTransferSeasonSummary from regret.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "1dp rounding via Math.round(x * 10) / 10 — consistent with computeRegret WR-01 convention"
    - "TDD RED→GREEN cycle: test commit then feat commit, both atomic"

key-files:
  created: []
  modified:
    - src/lib/regret.ts
    - src/lib/regret.test.ts
    - src/lib/types.ts

key-decisions:
  - "Added TransferRegretEntry + SlimPlayer to types.ts in Plan 02 (parallel-safe: Plan 01 edits only types.ts, Plan 02 edits regret.ts + regret.test.ts; PATTERNS.md shows non-overlapping file sets). This avoids import failure when tests run before Plan 01 lands."
  - "DecisionHistory.transferEntries marked optional (?) to preserve all existing consumers without change"
  - "computeTransferDelta returns null when engineBuyPts.length === 0 (no snapshot signal — not a zero array)"
  - "Hold path (userBuyPts === null || userSellPts === null): returns counterfactual engine gain only"

patterns-established:
  - "Transfer regret formula: delta = Σ(engineBuyPts) - Σ(engineSellPts) - (Σ(userBuyPts) - Σ(userSellPts))"

requirements-completed: [BACK-02]

# Metrics
duration: 5min
completed: 2026-05-15
---

# Phase 113 Plan 02: Transfer Regret Math Primitives Summary

**TDD RED→GREEN: computeTransferDelta + computeTransferSeasonSummary pure functions with 1dp rounding, null-guard, hold-path, and 2-FT summation — 25/25 tests pass, tsc clean**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T19:50:00Z
- **Completed:** 2026-05-15T19:54:40Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 3

## Accomplishments
- TDD RED: 14 failing tests added for `computeTransferDelta` (7 cases) and `computeTransferSeasonSummary` (5 cases) — confirmed failure due to missing exports, not malformed tests
- TDD GREEN: Both functions implemented in `regret.ts` with `TransferSeasonSummary` interface; all 25 tests pass (14 new + 11 existing `computeRegret`/`computeSeasonSummary`)
- Added `TransferRegretEntry`, `SlimPlayer` types and extended `DecisionHistory` in `types.ts` — Plans 03 and 04 can import immediately
- TypeScript `--noEmit` exits 0; no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing tests for computeTransferDelta + computeTransferSeasonSummary** - `a42370b` (test)
2. **Task 2: GREEN — implement computeTransferDelta + computeTransferSeasonSummary** - `5038e65` (feat)

**Plan metadata:** committed with SUMMARY.md (docs)

_TDD tasks have two commits: test (RED) → feat (GREEN)_

## Files Created/Modified
- `src/lib/regret.ts` — added `computeTransferDelta`, `TransferSeasonSummary`, `computeTransferSeasonSummary`; extended import to include `TransferRegretEntry`
- `src/lib/regret.test.ts` — added two new `describe` blocks (14 `it()` cases); updated import to include new symbols
- `src/lib/types.ts` — added `TransferRegretEntry`, `SlimPlayer` interfaces; extended `DecisionHistory` with optional `transferEntries?`

## Function Signatures

Plans 03 and 04 import these exact signatures:

```typescript
// src/lib/regret.ts
export function computeTransferDelta(
  engineBuyPts: number[],
  engineSellPts: number[],
  userBuyPts: number[] | null,
  userSellPts: number[] | null,
): number | null

export interface TransferSeasonSummary {
  totalDelta: number
  gwsWithData: number
  engineBetter: number
  userBetter: number
  tied: number
}

export function computeTransferSeasonSummary(
  entries: TransferRegretEntry[],
): TransferSeasonSummary
```

## Decisions Made
- `TransferRegretEntry` added to `types.ts` in Plan 02 rather than waiting for Plan 01 to land — Rule 3 (blocking issue): import would fail at vitest run time without the type definition. Both Wave 1 plans edit non-overlapping file sets so no merge conflict risk.
- Hold path condition is `userBuyPts === null || userSellPts === null` (OR, not AND) — defensive per plan spec; covers partial-null edge cases uniformly.
- `totalDelta` rounding in `computeTransferSeasonSummary` mirrors the per-entry `computeTransferDelta` 1dp convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added TransferRegretEntry + SlimPlayer to types.ts**
- **Found during:** Task 1 (RED — writing failing tests)
- **Issue:** `TransferRegretEntry` not yet in `types.ts` (Plan 01 is a parallel Wave 1 agent). Import `from '@/lib/types'` would fail at test run time before Plan 01 lands, making the RED commit unbuildable.
- **Fix:** Added `TransferRegretEntry`, `SlimPlayer` interfaces and extended `DecisionHistory.transferEntries?` to `types.ts` as specified in `113-PATTERNS.md §types.ts`. These are exactly what Plan 01 would add — no semantic difference.
- **Files modified:** `src/lib/types.ts`
- **Verification:** `npx tsc --noEmit` exits 0; 25/25 tests pass
- **Committed in:** `a42370b` (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary for compilable RED state. Plan 01 will produce the same types.ts changes — the worktree merge will be a no-op for these fields.

## Issues Encountered
None - plan executed smoothly with one blocking deviation handled inline.

## Next Phase Readiness
- `computeTransferDelta` and `computeTransferSeasonSummary` are exported from `@/lib/regret` and ready for Plan 03 (API route) and Plan 04 (BackTab UI)
- `TransferRegretEntry` type available at `@/lib/types` for all consumers
- No blockers

---
*Phase: 113-transfer-regret-backtester-v1-20*
*Completed: 2026-05-15*
