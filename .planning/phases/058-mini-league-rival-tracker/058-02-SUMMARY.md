---
phase: 058-mini-league-rival-tracker
plan: 02
subsystem: pure-functions
tags: [rival-intel, differential, position-median, tdd, vitest]

# Dependency graph
requires:
  - phase: 058-01
    provides: "RivalPick, RivalEntry, RivalLeagueResult types in types.ts; useRivals hook; rivals-adapter Zod schemas"
provides:
  - src/lib/rival-intel.ts: six pure exported functions (computeShared, computeUserAdvantage, computePositionMedians, computeRivalThreats, computeBlockingMoves, computeCaptainEdge)
  - src/lib/rival-intel.test.ts: 23 Vitest unit tests covering ML-03..ML-07 + position-median helper
affects: [058-03-ui-components, 058-04-page-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function module with no 'use client' directive — importable from server and client (mirrors eo-candidates.ts)"
    - "Position-median algorithm replicates pipeline/merge.py _compute_differential_flag: exclude xPts_1gw === undefined and <= 0"
    - "computeRivalThreats: strict > median (not >=) consistent with D-08 and Phase 30 differential flag semantics"
    - "computeBlockingMoves: combo qualifies when ANY leg's buy satisfies both conditions (non-rival AND above median)"

key-files:
  created:
    - src/lib/rival-intel.ts
    - src/lib/rival-intel.test.ts
  modified: []

key-decisions:
  - "Position-median excludes xPts_1gw === 0 (BGW/pre-pipeline rows) and undefined — matches pipeline/merge.py semantics from Phase 30"
  - "computeRivalThreats uses strict > (not >=) for position median — consistent with D-08 'above position median' language and test contract"
  - "computeBlockingMoves: combo included when ANY leg qualifies — test contract says a partial qualifying leg is sufficient for a blocking move"
  - "computeCaptainEdge accepts (MergedPlayer | null, MergedPlayer | null) — null on either side returns null, covering pre-deadline rival captain and no-squad-loaded user cases"

patterns-established:
  - "rival-intel.ts pattern: pure TS differential engine importable by Wave 3 components without coupling to hooks or fetch"
  - "TDD RED→GREEN: test file committed first with Cannot-find-module failure; implementation committed separately when all 23 tests pass"

requirements-completed: [ML-03, ML-04, ML-05, ML-06, ML-07]

# Metrics
duration: 3min
completed: 2026-05-04
---

# Phase 58 Plan 02: Mini-League Rival Tracker — Differential Engine Summary

**Six pure-function differential intelligence operations (shared/advantage/threats/blocking/captain edge + position-median helper) with 23 Vitest tests, fully TDD RED→GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-04T06:43:27Z
- **Completed:** 2026-05-04T06:45:45Z
- **Tasks:** 2 (1 RED + 1 GREEN)
- **Files modified:** 2 (2 created, 0 modified)

## Accomplishments

- Created `src/lib/rival-intel.test.ts` with 23 Vitest unit tests covering all six functions across ML-03..ML-07 (RED phase committed as `3d1282b`)
- Created `src/lib/rival-intel.ts` with six exported pure functions; all 23 tests pass (GREEN phase committed as `95de383`)
- TypeScript `--noEmit` compilation clean; no `'use client'`, no `fetch`, no `Date.now`, no React hooks

## Task Commits

1. **Task 1 (RED): Write rival-intel.test.ts with failing tests** - `3d1282b` (test)
2. **Task 2 (GREEN): Implement rival-intel.ts to make all tests pass** - `95de383` (feat)

## Files Created/Modified

- `src/lib/rival-intel.ts` - Six exported pure functions: computeShared, computeUserAdvantage, computePositionMedians, computeRivalThreats, computeBlockingMoves, computeCaptainEdge
- `src/lib/rival-intel.test.ts` - 23 unit tests: 3 for ML-03, 3 for ML-04, 5 for position-median, 3 for ML-05, 4 for ML-06, 5 for ML-07

## Exported Function Signatures

```typescript
computeShared(userIds: Set<number>, rivalIds: Set<number>): number[]
computeUserAdvantage(userIds: Set<number>, rivalIds: Set<number>): number[]
computePositionMedians(players: MergedPlayer[]): Map<PositionCode, number>
computeRivalThreats(rivalIds: Set<number>, userIds: Set<number>, playerById: Map<number, MergedPlayer>, posMedians: Map<PositionCode, number>): MergedPlayer[]
computeBlockingMoves(suggestions: TransferSuggestion[], rivalIds: Set<number>, posMedians: Map<PositionCode, number>): TransferSuggestion[]
computeCaptainEdge(userCaptain: MergedPlayer | null, rivalCaptain: MergedPlayer | null): number | null
```

## Decisions Made

- **Position-median excludes 0 and undefined:** Matches `pipeline/merge.py _compute_differential_flag` behavior (Phase 30). BGW players have xPts_1gw=0; pre-pipeline players may have undefined. Both excluded from median computation.
- **Strict > for threats and blocking:** D-08 says "above position median" — strict greater-than, not >=. Tests enforce this explicitly (equal-to-median is excluded in `computeRivalThreats`).
- **Combo blocking: ANY leg qualifies:** For `computeBlockingMoves`, a 'combo' suggestion is included if at least one of its two buy legs is both non-rival-owned and above position median. This is the most useful definition for the UI (if either buy blocks a rival move, the whole transfer is a blocking move).
- **captainEdge null handling:** Both `userCaptain` and `rivalCaptain` are typed as `MergedPlayer | null`. The function returns null when either side is null or when `xPts_90th_1gw` is undefined — covering pre-deadline rival (no captain visible) and unauthenticated user (no squad loaded).

## Deviations from Plan

None — plan executed exactly as written. The test file and implementation match the plan's code examples verbatim; all acceptance criteria verified.

## Known Stubs

None — no stub values, hardcoded empty arrays, or placeholder text in any created/modified files.

## Threat Flags

No new threat surface. All inputs (`Set<number>`, `Map<number, MergedPlayer>`, `TransferSuggestion[]`) originate from already-validated sources. T-58-06 and T-58-07 dispositions from the plan's threat model are satisfied: inputs validated upstream (Wave 1 Zod), output is public FPL data (no PII).

## TDD Gate Compliance

- RED gate: `3d1282b` — `test(058-02): add failing tests for rival-intel pure functions` committed with Cannot-find-module failure
- GREEN gate: `95de383` — `feat(058-02): implement rival-intel differential engine` committed with 23/23 tests passing

## Issues Encountered

None.

## Next Phase Readiness

Wave 3 (058-03) can now import:
```typescript
import {
  computeShared,
  computeUserAdvantage,
  computePositionMedians,
  computeRivalThreats,
  computeBlockingMoves,
  computeCaptainEdge,
} from '@/lib/rival-intel'
```

No blockers for Phase 58 Plan 03 (UI components).

## Self-Check

- `src/lib/rival-intel.test.ts` exists: FOUND
- `src/lib/rival-intel.ts` exists: FOUND
- RED commit `3d1282b`: FOUND (git log)
- GREEN commit `95de383`: FOUND (git log)
- Test count: 23 (>= 12 required)
- Export count: 6 (exactly 6 required)
- `npx tsc --noEmit`: exits 0

## Self-Check: PASSED

---
*Phase: 058-mini-league-rival-tracker*
*Completed: 2026-05-04*
