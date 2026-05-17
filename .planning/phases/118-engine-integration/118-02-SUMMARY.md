---
phase: 118-engine-integration
plan: "02"
subsystem: transfer-engine
tags:
  - transfer-engine
  - lineup-news
  - availability-penalty
  - tdd
  - suggest-transfers

dependency_graph:
  requires:
    - "118-01: lineupNewsSelect staleness gate in useLineupNews (provides Map<number, LineupNewsPlayer> | undefined)"
    - "117-02: LineupNewsPlayer type in src/lib/types.ts"
  provides:
    - "suggestTransfers() with optional lineupNewsMap?: Map<number, LineupNewsPlayer> param"
    - "availFactor closure: 1.0 for no-map/null/absent-from-map; Math.max(0.01, af) otherwise"
    - "scoreBuyCandidate = scorePlayer * availFactor — applies to all 4 buy-side call sites"
    - "Confirmed-absent players score near-zero (0.01 floor) and sink to bottom of position buckets"
    - "Doubted players deprioritized proportionally to availability_factor value"
    - "Sell-side unchanged — PHY-01 rejection reasons and WHY-01 surfaces unaffected"
  affects:
    - "118-03: optimiseLineup / benchOrder ENGN-02 extends same lineupNewsMap pattern"
    - "119-01..04: UI wiring will pass lineupNewsMap from useLineupNews hook to suggestTransfers"

tech_stack:
  added: []
  patterns:
    - "availFactor closure pattern: guards !lineupNewsMap → returns 1.0; handles null availability_factor as 1.0 (D-03); applies Math.max(0.01, af) floor (D-02)"
    - "scoreBuyCandidate wraps scorePlayer with penalty for buy side only — sell side left at raw scorePlayer"
    - "optional-with-undefined-equals-disabled: lineupNewsMap follows targetGw? precedent from Phase 101"

key_files:
  created:
    - src/lib/suggest-transfers.test.ts (Phase 118 ENGN-01 describe block appended — 6 tests)
  modified:
    - src/lib/suggest-transfers.ts

key-decisions:
  - "scoreBuyCandidate = scorePlayer * availFactor rather than post-hoc xPtsGain adjustment — penalty drives in-pool Top-30 sort so absent players don't even reach candidate phase"
  - "0.01 floor (not 0.0) for confirmed_absent: prevents exact-zero xPtsGain which would filter players entirely, allowing UI to show them at bottom rather than silently omitting"
  - "null availability_factor → 1.0 (no penalty): unknown status = no assumption (D-03)"
  - "Sell side stays unpenalized: WHY-01 rejection reasons and Phase 119 Team News Alert surface sell urgency independently"

requirements-completed:
  - ENGN-01

metrics:
  duration: ~8 min
  completed: "2026-05-17"
  tasks_completed: 2
  files_changed: 2
---

# Phase 118 Plan 02: suggestTransfers lineupNewsMap Availability Penalty Summary

**`suggestTransfers()` extended with `lineupNewsMap?: Map<number, LineupNewsPlayer>` — confirmed-absent players multiply by 0.01 floor and sink to the bottom of every position bucket; doubted players are deprioritized proportionally; sell side stays unpenalized.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-17T20:37:42Z
- **Completed:** 2026-05-17T20:46:00Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 2

## Accomplishments

- Extended `SuggestTransfersParams` interface with `lineupNewsMap?: Map<number, LineupNewsPlayer>` following the Phase 101 `targetGw?` optional-with-undefined-equals-disabled pattern
- Introduced `availFactor` closure and `scoreBuyCandidate = scorePlayer * availFactor` replacing `scorePlayer` at exactly 4 buy-side call sites (in-pool sort, 1-FT xPtsGain, 2-FT gain1, 2-FT gain2)
- Sell-side `scorePlayer` calls (sellScore, sell1Pts, sell2Pts) left unchanged per D-01 spec
- 6 TDD tests covering absent/doubted/no-map/null-factor/sell-unpenalized/2FT-combo cases; 32 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Add ENGN-01 failing tests** - `53b229f` (test)
2. **Task 2: GREEN — Extend SuggestTransfersParams and apply availability penalty** - `f919e48` (feat)

## Files Created/Modified

- `src/lib/suggest-transfers.ts` — Added `LineupNewsPlayer` import, `lineupNewsMap?` param to interface and destructure, `availFactor` + `scoreBuyCandidate` closures, 4 buy-side scoreBuyCandidate substitutions
- `src/lib/suggest-transfers.test.ts` — Added `LineupNewsPlayer` + `StatusLabel` to imports, `makeLineupNewsPlayer` factory, `describe('Phase 118 ENGN-01: lineupNewsMap availability penalty')` block with 6 tests

## Decisions Made

- Used `scoreBuyCandidate` (penalty applied inside score function) rather than a post-hoc `xPtsGain` multiplier so the in-pool Top-30 sort reflects the penalized ranking — absent players won't make the candidate pool at all (D-04)
- `Math.max(0.01, af)` floor for `availability_factor=0.0` prevents the filtered-absent-due-to-negative-xPtsGain scenario (D-02)
- `null` factor treated as `1.0` (no penalty) — no information = no assumption (D-03)
- Merged main into worktree branch to bring Phase 117 types and 118-01 hook into the working tree before implementing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged main into worktree branch to resolve missing Phase 117 types**
- **Found during:** Task 1 (RED phase setup)
- **Issue:** Worktree was forked from main before Phase 117 commits landed; `src/lib/types.ts` was missing `LineupNewsPlayer`, `StatusLabel`, `LineupNewsSource` types required by ENGN-01 tests
- **Fix:** `git merge main --no-edit` (fast-forward); brought Phase 117 + 118-01 commits into the worktree
- **Files modified:** 29 files merged (Phase 117 pipeline, hook, types; 118-01 SUMMARY)
- **Verification:** `grep "LineupNewsPlayer" src/lib/types.ts` confirmed presence; tests then compiled correctly
- **Committed in:** merge commit (not a separate task commit — merge was a prerequisite step)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking: missing dependency)
**Impact on plan:** Merge was necessary prerequisite. All plan tasks executed as written after merge.

## Known Stubs

None.

## Threat Flags

None — this plan modifies only a pure TypeScript engine function and its test file. No new network endpoints, auth paths, or file access patterns introduced.

## TDD Gate Compliance

- RED gate: `53b229f` (`test(118-02): add failing ENGN-01 tests for lineupNewsMap penalty`) — 3 tests failing, exit code 1
- GREEN gate: `f919e48` (`feat(118-02): apply lineupNewsMap availability penalty to suggestTransfers buy side`) — 32/32 tests passing

## Self-Check: PASSED

- `src/lib/suggest-transfers.ts` — FOUND (modified)
- `src/lib/suggest-transfers.test.ts` — FOUND (modified)
- Commit `53b229f` — RED gate
- Commit `f919e48` — GREEN gate
- `npx vitest run src/lib/suggest-transfers.test.ts` — 32 passed

## Next Phase Readiness

- `suggestTransfers()` now fully ENGN-01 compliant — ready for Phase 119 UI-01 wiring (`TransferPanel` passes `lineupNewsMap` from `useLineupNews` hook)
- Phase 118 Plan 03 (`optimiseLineup` / `benchOrder` ENGN-02) can proceed independently in parallel

---
*Phase: 118-engine-integration*
*Completed: 2026-05-17*
