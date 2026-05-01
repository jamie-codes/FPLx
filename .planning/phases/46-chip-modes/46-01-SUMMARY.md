---
phase: 46-chip-modes
plan: "01"
subsystem: testing
tags: [typescript, vitest, chip-modes, tdd, types]

# Dependency graph
requires:
  - phase: 45-transfer-aware-mode
    provides: TransferSuggestion type, OptimiserHorizon, optimiseLineup engine used by chip-modes
  - phase: 43-optimiser
    provides: OptimisedLineup, HORIZON_FIELD, optimiseLineup signature

provides:
  - ChipMode union type exported from src/lib/types.ts
  - ChipSquadPlayer interface exported from src/lib/types.ts
  - ChipSquadResult interface exported from src/lib/types.ts
  - chip-modes.ts skeleton with buildOptimalSquad (returns null) and computeBenchBoostXPts (returns 0)
  - chip-modes.test.ts with 18 RED unit tests (12 failing on skeleton stubs)
  - ChipModeToggle.test.tsx with 7 RED component tests
  - ChipSquadView.test.tsx with 8 RED component tests

affects: [46-chip-modes Wave 1 engine, 46-chip-modes Wave 2 UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Wave 0: types + skeleton + RED tests before any implementation"
    - "Skeleton void-guard pattern: void params to suppress TS unused-variable warnings in stub functions"
    - "Try/catch require() pattern for RED component tests referencing non-existent files"

key-files:
  created:
    - src/lib/chip-modes.ts
    - src/lib/chip-modes.test.ts
    - src/components/optimiser/ChipModeToggle.test.tsx
    - src/components/optimiser/ChipSquadView.test.tsx
  modified:
    - src/lib/types.ts

key-decisions:
  - "ChipMode type uses string union not enum (consistent with existing OptimiserHorizon convention)"
  - "chip-modes.ts imports HORIZON_FIELD and optimiseLineup from optimise-lineup.ts (D-10) rather than re-implementing"
  - "MIN_SLOTS/MAX_SLOTS/CHIP_DEFAULT_BUDGET_TENTHS redeclared locally rather than importing from chip-strategy-engine.ts (D-07)"
  - "BGW exclusion: xPts_1gw === 0 (exact zero) excluded; xPts_1gw === undefined is NOT excluded (pipeline data gap)"
  - "Component RED tests use try/catch require() so missing file causes test failure not parse error"

patterns-established:
  - "Wave 0 TDD gate: types + skeleton + RED tests committed before Wave 1 implementation starts"
  - "makePlayer factory pattern with minimal MergedPlayer fields for unit test isolation"

requirements-completed: [CHIP-01, CHIP-02, CHIP-03]

# Metrics
duration: 5min
completed: 2026-05-01
---

# Phase 46 Plan 01: Chip Modes Types + Stubs Summary

**ChipMode/ChipSquadPlayer/ChipSquadResult types added to types.ts; buildOptimalSquad skeleton and 33 RED tests across engine + 2 UI components establish the TDD contract for Wave 1 and Wave 2**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-01T06:39:57Z
- **Completed:** 2026-05-01T06:44:31Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Three new type exports in src/lib/types.ts: `ChipMode`, `ChipSquadPlayer`, `ChipSquadResult`
- Skeleton chip-modes.ts with `buildOptimalSquad` (returns null) and `computeBenchBoostXPts` (returns 0), plus `CHIP_DEFAULT_BUDGET_TENTHS = 1000` constant
- 18 RED unit tests in chip-modes.test.ts covering budget filter, formation quotas, team cap, BGW exclusion, horizon lock, and bench boost xPts summation
- 7 RED component tests in ChipModeToggle.test.tsx covering 4-button render, aria-pressed state, onClick handlers, and role/aria-label
- 8 RED component tests in ChipSquadView.test.tsx covering squad render, XI highlight (border-green-500), bench opacity, FH reversion notice, budget display, and formation headline

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ChipMode / ChipSquadPlayer / ChipSquadResult types** - `b5bae07` (feat)
2. **Task 2: Create chip-modes.ts skeleton + chip-modes.test.ts RED stubs** - `47721e6` (test)
3. **Task 3: Create ChipModeToggle.test.tsx and ChipSquadView.test.tsx RED stubs** - `014b54b` (test)

## Files Created/Modified

- `src/lib/types.ts` - Added ChipMode union, ChipSquadPlayer interface, ChipSquadResult interface (24 lines inserted after TransferSuggestion)
- `src/lib/chip-modes.ts` - Skeleton engine: buildOptimalSquad returns null, computeBenchBoostXPts returns 0, CHIP_DEFAULT_BUDGET_TENTHS = 1000 exported
- `src/lib/chip-modes.test.ts` - 18 unit tests: 12 RED (skeleton returns null/0), 6 pass (constant check + null-expected tests)
- `src/components/optimiser/ChipModeToggle.test.tsx` - 7 RED tests using try/catch require() pattern (component not yet created)
- `src/components/optimiser/ChipSquadView.test.tsx` - 8 RED tests using try/catch require() pattern (component not yet created)

## Decisions Made

- Inserted ChipMode/ChipSquadPlayer/ChipSquadResult between TransferSuggestion and DefConPlayer in types.ts (logical grouping with related Phase 46 types together)
- Used `void param` pattern in skeleton functions to suppress TypeScript unused-variable warnings without disabling lint rules
- Component test files use `require()` inside try/catch rather than static import so missing files produce test failures (RED) not parse errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript errors present (5 errors in `tests/lib/captain-picks.test.ts`) are pre-existing and unrelated to Phase 46 changes — confirmed by checking out base commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 (46-02) can now implement `buildOptimalSquad` with the full greedy algorithm — tests in chip-modes.test.ts define the exact contract
- Wave 2 (46-03) can implement `ChipModeToggle.tsx` and `ChipSquadView.tsx` — tests define testids, aria attributes, and className expectations precisely
- All type contracts locked and cannot drift without breaking compilation

---
*Phase: 46-chip-modes*
*Completed: 2026-05-01*
