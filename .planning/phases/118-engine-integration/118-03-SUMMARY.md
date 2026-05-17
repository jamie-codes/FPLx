---
phase: 118-engine-integration
plan: "03"
subsystem: engine
tags:
  - optimiser
  - bench-order
  - lineup-news
  - absent-exclusion
  - tdd
  - vitest

dependency_graph:
  requires:
    - "118-01: lineupNewsSelect staleness gate — returns Map<number, LineupNewsPlayer> | undefined"
    - "117-02: LineupNewsPlayer, StatusLabel, LineupNews types in src/lib/types.ts"
  provides:
    - "optimiseLineup() accepts optional lineupNewsMap?: Map<number, LineupNewsPlayer> (4th param)"
    - "benchOrder() accepts optional lineupNewsMap?: Map<number, LineupNewsPlayer> (4th param)"
    - "confirmed_absent players excluded from C(15,11) starter enumeration (D-05)"
    - "eligible < 11 after absent exclusion → null return (D-07 reuses BGW null path)"
    - "confirmed_absent bench outfield players get evScore=0 → sink to last bench slot (D-06)"
    - "doubted players not excluded/zeroed — only confirmed_absent triggers ENGN-02 treatment (D-08)"
    - "lineupNewsMap=undefined produces identical output to pre-Phase-118 call (regression gate)"
  affects:
    - "118-04 and beyond: Phase 119 UI wiring (TransferPanel, OptimiserTab, DecisionSummaryTab)"

tech-stack:
  added: []
  patterns:
    - "Optional-with-undefined-equals-disabled param pattern: lineupNewsMap?: Map<number, LineupNewsPlayer>"
    - "Early-return in evScore lambda for absent-player zero-out (block-body arrow function)"
    - "Extending eligible filter with a secondary guard after existing BGW exclusion"

key-files:
  created: []
  modified:
    - src/lib/optimise-lineup.ts
    - src/lib/optimise-lineup.test.ts

key-decisions:
  - "D-05/D-08: Only status_label === 'confirmed_absent' triggers exclusion from starter enumeration — doubted players (0.25–0.75 availability_factor) are NOT excluded; their buy-side deprioritisation is handled by ENGN-01 in suggest-transfers.ts"
  - "D-07: Absent exclusion reuses the existing eligible.length < 11 null-return path — no new code path needed; confirmed_absent players simply reduce the eligible count naturally"
  - "D-06: evScore early-return 0 for confirmed_absent sinks absent bench players without disrupting the BGW partition logic (fixtures.length === 0 already produces 0 via formula; absent players with fixtures also need explicit 0)"
  - "Thread lineupNewsMap through optimiseLineup's internal benchOrder call so bench ordering sees the same gate without requiring callers to call benchOrder separately"

patterns-established:
  - "ENGN-02 absent-exclusion pattern: extend existing guard chain in eligible filter, check lineupNewsMap first before extending to new conditions"
  - "evScore block-body for conditional early returns: when the lambda needs a branch, expand single-expression to block-body with explicit return"

requirements-completed:
  - ENGN-02

duration: ~10min
completed: "2026-05-17"
---

# Phase 118 Plan 03: Absent-Player Exclusion in optimiseLineup + benchOrder Summary

**`optimiseLineup()` and `benchOrder()` extended with optional `lineupNewsMap` param — confirmed-absent players excluded from C(15,11) starter enumeration and zeroed in bench EV scoring via 6-test TDD RED→GREEN cycle**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-17T21:38:00Z
- **Completed:** 2026-05-17T21:42:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 3 (optimise-lineup.ts, optimise-lineup.test.ts, types.ts prereq)

## Accomplishments

- Wrote 6 failing ENGN-02 tests (RED gate) covering D-05 absent exclusion, D-06 bench zero EV, D-07 null return when eligible < 11, D-08 doubted-not-excluded, and regression guard
- Extended `optimiseLineup()` eligible filter to exclude `confirmed_absent` players when `lineupNewsMap` is provided
- Extended `benchOrder()` `evScore` lambda to return 0 for `confirmed_absent` bench players
- Threaded `lineupNewsMap` through `optimiseLineup`'s internal `benchOrder` call
- All 23 tests pass (6 new ENGN-02 + 17 pre-existing OPT-01..OPT-05 + BENCH-01)
- Applied Phase 117 `LineupNewsPlayer`/`StatusLabel` types and Phase 118-01 `useLineupNews` hook as worktree prerequisites (missing due to wave timing)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Add ENGN-02 failing tests** - `3949c54` (test)
2. **Task 2: GREEN — Extend optimiseLineup + benchOrder** - `b0ee0da` (feat)

**Plan metadata:** (SUMMARY.md commit follows)

_TDD: RED commit then GREEN commit per plan specification_

## Files Created/Modified

- `src/lib/optimise-lineup.ts` — Extended with optional `lineupNewsMap` param in both `optimiseLineup` and `benchOrder`; eligible filter excludes `confirmed_absent`; `evScore` lambda returns 0 for `confirmed_absent` bench players; internal `benchOrder` call threads the map through
- `src/lib/optimise-lineup.test.ts` — Added `makeLineupNewsPlayer` factory, `LineupNewsPlayer` + `StatusLabel` imports, and two new describe blocks (6 ENGN-02 tests)
- `src/lib/types.ts` — Phase 117 `LineupNewsSource`, `StatusLabel`, `LineupNewsPlayer`, `SourceHealth`, `LineupNews` types applied (worktree prerequisite gap)
- `src/lib/hooks/useLineupNews.ts` — Phase 118-01 `lineupNewsSelect` + `useLineupNews` hook applied (worktree prerequisite gap)

## Decisions Made

- D-08 doubted-not-excluded: only `status_label === 'confirmed_absent'` triggers the starter exclusion and bench zero-EV treatment; doubted players (0.25–0.75 availability_factor) remain selectable as starters — consistent with CONTEXT.md D-08 and the buy-side-only penalty approach in ENGN-01
- D-07 null return: the absent exclusion naturally reduces `eligible.length` and the existing `if (eligible.length < 11) return null` guard handles it without new code — no additional return needed
- Thread lineupNewsMap to internal benchOrder call: `optimiseLineup` holds the map as a parameter and passes it to `benchOrder` directly rather than re-looking it up — consistent with the single-source-of-truth pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied Phase 117 LineupNews types and Phase 118-01 useLineupNews hook to worktree**

- **Found during:** Task 1 (RED phase setup)
- **Issue:** Worktree forked from main at commit `08c4316` (Phase 116 WR-04), before Phase 117 types and Phase 118-01 hook were merged. `LineupNewsPlayer` and `StatusLabel` were absent from `src/lib/types.ts` (997 lines vs 1031 in main), and `src/lib/hooks/useLineupNews.ts` did not exist in the worktree.
- **Fix:** Appended Phase 117 type block (`LineupNewsSource`, `StatusLabel`, `LineupNewsPlayer`, `SourceHealth`, `LineupNews`) to worktree `types.ts`; created `useLineupNews.ts` in the worktree. Both are exact replicas of the main-repo versions from commits `e505a35` and `f869572`.
- **Files modified:** src/lib/types.ts, src/lib/hooks/useLineupNews.ts (created)
- **Verification:** `npx tsc --noEmit` produces no errors in modified files; Phase 118 ENGN-02 tests import `LineupNewsPlayer` cleanly
- **Committed in:** 3949c54 (Task 1 RED commit — prerequisites bundled with test additions)

---

**Total deviations:** 1 auto-fixed (1 blocking prerequisite gap)
**Impact on plan:** Gap was caused by wave timing — worktree pre-dated Phase 117/118-01 merges. Fix is a verbatim copy of the canonical main-repo versions, introducing no logic differences.

## Known Stubs

None — this plan adds engine function parameters only; no UI wiring, no data sourcing. Phase 119 is responsible for threading `lineupNewsMap` from the `useLineupNews` hook into component call sites.

## Threat Flags

None — this plan modifies pure TypeScript engine functions with no network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check

- `src/lib/optimise-lineup.ts` — FOUND
- `src/lib/optimise-lineup.test.ts` — FOUND  
- Commit 3949c54 (RED) — verified via `git log --oneline`
- Commit b0ee0da (GREEN) — verified via `git log --oneline`
- `npx vitest run src/lib/optimise-lineup.test.ts` — 23/23 passed
- `grep "LineupNewsPlayer" src/lib/optimise-lineup.ts` — FOUND in import + 2 param declarations
- `grep "status_label === 'confirmed_absent'" src/lib/optimise-lineup.ts` — FOUND × 2 (filter + evScore)
- `grep "benchOrder(benchOutfieldRaw.*lineupNewsMap" src/lib/optimise-lineup.ts` — FOUND

## Self-Check: PASSED

---

*Phase: 118-engine-integration*
*Completed: 2026-05-17*
