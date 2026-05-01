---
phase: 46-chip-modes
plan: "02"
subsystem: engine
tags: [typescript, vitest, chip-modes, tdd, greedy-algorithm]

# Dependency graph
requires:
  - phase: 46-chip-modes
    plan: "01"
    provides: chip-modes.ts skeleton + 18 RED unit tests + types
  - phase: 43-optimiser
    provides: optimiseLineup, HORIZON_FIELD, OptimisedLineup
  - phase: 45-transfer-aware-mode
    provides: MergedPlayer, OptimiserHorizon, SquadPick

provides:
  - buildOptimalSquad real implementation (greedy 15-player engine)
  - computeBenchBoostXPts real implementation (horizon xPts sum)
  - All 18 chip-modes.test.ts unit tests GREEN

affects: [46-chip-modes Wave 2 UI — OptimiserPanel, ChipModeToggle, ChipSquadView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Greedy slot-fill: sort by horizon score desc + cost tie-break, filledSlots/MAX_SLOTS quota, teamCap guard, budget guard"
    - "Synthetic picks pattern: squad.map((p, i) => ({ element: p.id, position: i+1, ... })) for optimiseLineup call"
    - "Pitfall guard: pass MergedPlayer[] (not ChipSquadPlayer[]) to optimiseLineup"

key-files:
  created: []
  modified:
    - src/lib/chip-modes.ts

key-decisions:
  - "BGW filter uses xPts_1gw !== 0 (not falsy) — undefined players (missing pipeline data) are NOT excluded, only exact zero"
  - "computeBenchBoostXPts uses playerMap for O(1) lookup rather than array.find per bench player"
  - "void MIN_SLOTS retained at end of file to suppress unused-variable warning (MIN_SLOTS exported for internal use but not yet consumed by callers)"

patterns-established:
  - "Wave 1 TDD GREEN: replace skeleton stub with real algorithm; existing RED tests become GREEN"

requirements-completed: [CHIP-01, CHIP-02]

# Metrics
duration: 5min
completed: 2026-05-01
---

# Phase 46 Plan 02: Chip Modes Engine (Wave 1) Summary

**buildOptimalSquad greedy engine implemented with full constraint enforcement — all 18 chip-modes.test.ts RED tests turned GREEN**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-01T07:49:00Z
- **Completed:** 2026-05-01T07:54:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Real `buildOptimalSquad` replaces the Wave 0 null stub in `src/lib/chip-modes.ts`
- Eligibility filter: `status === 'a' AND xPts_1gw !== 0` — exact zero excluded (BGW proxy), `undefined` correctly passes
- Greedy sort: horizon field descending, lower `now_cost` as tie-break for better budget utilisation
- `filledSlots` / `MAX_SLOTS` quota enforcement: exactly 2 GK, 3-5 DEF, 2-5 MID, 1-3 FWD
- `teamCap=3` guard (default FPL club limit)
- Running budget guard: `runningCost + player.now_cost <= budget`
- `null` return when fewer than 15 slots filled
- `bestXI` derived via `optimiseLineup(syntheticPicks, squadPlayers, horizon)` — passes full `MergedPlayer[]`, not `ChipSquadPlayer[]`
- Real `computeBenchBoostXPts` sums `HORIZON_FIELD[horizon]` per bench player using `playerMap` for O(1) lookup
- All 18 chip-modes.test.ts unit tests GREEN (were 12 RED in Wave 0)

## Task Commits

1. **Task 1: Implement real buildOptimalSquad() greedy engine** - `fd3209a` (feat)

## Files Created/Modified

- `src/lib/chip-modes.ts` — skeleton replaced with real algorithm (77 insertions, 15 deletions)

## Decisions Made

- Used `p.xPts_1gw !== 0` (not `!!p.xPts_1gw`) for eligibility — `undefined !== 0` evaluates `true`, correctly including players with missing pipeline data
- `computeBenchBoostXPts` builds a `playerMap` rather than calling `array.find` for each bench ID — O(n) setup vs O(n*m) per-ID scan
- Pre-existing TypeScript errors in `tests/lib/captain-picks.test.ts` (5 errors) confirmed unrelated to Phase 46 — not fixed per scope boundary rule

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing (out of scope):
- 5 TypeScript errors in `tests/lib/captain-picks.test.ts` — confirmed pre-existing, unchanged by Phase 46
- 1 failing test in `tests/lib/club-form.test.ts` — pre-existing, unrelated to chip-modes
- 15 RED component tests (ChipModeToggle + ChipSquadView) — expected Wave 0 RED tests, will be turned GREEN in Wave 2

## User Setup Required

None.

## Next Phase Readiness

- Wave 2 (46-03) can now implement `ChipModeToggle.tsx` and `ChipSquadView.tsx` — engine contract is solid and tested
- `buildOptimalSquad` is callable from `OptimiserPanel` via `useMemo` as planned in Wave 2
- `computeBenchBoostXPts` ready for bench boost xPts headline in `ChipSquadView`

---
*Phase: 46-chip-modes*
*Completed: 2026-05-01*

## Self-Check: PASSED

All modified files exist on disk:
- `src/lib/chip-modes.ts` — FOUND
- Task commit `fd3209a` — FOUND in git log
- All 18 chip-modes.test.ts tests GREEN — VERIFIED
