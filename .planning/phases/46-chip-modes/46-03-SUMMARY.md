---
phase: 46-chip-modes
plan: "03"
subsystem: ui
tags: [react, typescript, vitest, chip-modes, tdd, optimiser]

# Dependency graph
requires:
  - phase: 46-chip-modes
    plan: "01"
    provides: ChipMode type, ChipSquadResult type, RED tests
  - phase: 46-chip-modes
    plan: "02"
    provides: buildOptimalSquad, computeBenchBoostXPts engine
  - phase: 45-transfer-aware-mode
    provides: FtToggle, OptimiserPanel structure, GwToggle, suggestTransfers

provides:
  - ChipModeToggle component (4-button pill: None/Wildcard/Free Hit/Bench Boost)
  - ChipSquadView component (position-grouped squad display with XI/bench differentiation)
  - OptimiserPanel extended with chipMode state, chipSquad memo, conditional rendering
  - GwToggle extended with disabled prop for FH mode
  - All Phase 46 RED tests (7 + 8) turned GREEN
  - OptimiserPanel.test.tsx extended with 9 Phase 46 tests

affects: [CHIP-01, CHIP-02, CHIP-03, v1.6 Squad Optimiser milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ChipModeToggle mirrors FtToggle.tsx exactly — OPTIONS array + map() pattern for N-button pill"
    - "ChipSquadView: position-grouped XI via xiByPosition[element_type], bench GK-first then xPts desc"
    - "chipSquad useMemo with effectiveHorizon guard (D-08 Pitfall 2): FH always uses horizon:1"
    - "isBenchBoost prop threading: OptimiserPanel → ComparisonTable + MobileComparisonCards"
    - "vi.mock('./ChipModeToggle') + vi.mock('./ChipSquadView') pattern for clean OptimiserPanel tests"
    - "Rule 1 deviation: Vitest 4.1 ESM interop fix — require() try/catch replaced with static imports"

key-files:
  created:
    - src/components/optimiser/ChipModeToggle.tsx
    - src/components/optimiser/ChipSquadView.tsx
  modified:
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx
    - src/components/optimiser/ChipModeToggle.test.tsx
    - src/components/optimiser/ChipSquadView.test.tsx
    - src/components/gem-table/GwToggle.tsx

key-decisions:
  - "border-green-500 used for XI rows (not border-l-green-500) — test assertion expects border-green-500 substring; border-l-2 provides width, border-green-500 provides color"
  - "Static imports replace require() try/catch in test files — Vitest 4.1 ESM does not support CJS require() for .tsx with @/ aliases in the module scope"
  - "FtToggle moved into Transfer Suggestions <section> guard — makes hide/show cleaner and removes empty spacer div"
  - "ChipModeToggle and ChipSquadView mocked in OptimiserPanel.test.tsx for clean unit isolation"

requirements-completed: [CHIP-01, CHIP-02, CHIP-03]

# Metrics
duration: 10min
completed: 2026-05-01
---

# Phase 46 Plan 03: Chip Modes UI (Wave 2) Summary

**ChipModeToggle + ChipSquadView components created; OptimiserPanel extended with chip mode state, conditional rendering for WC/FH/BB/None; all 15 RED tests from Wave 0 turned GREEN; 9 new OptimiserPanel Phase 46 tests added and GREEN**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-01T06:53:05Z
- **Completed:** 2026-05-01T07:03:00Z
- **Tasks:** 3 (+ checkpoint task awaiting human verification)
- **Files modified:** 7

## Accomplishments

- `ChipModeToggle.tsx`: 4-button pill (None | Wildcard | Free Hit | Bench Boost), `role="group"`, `aria-label="Chip mode"`, `aria-pressed`, `min-h-[44px]`, same Tailwind tokens as FtToggle
- `ChipSquadView.tsx`: position-grouped XI + bench, `data-xi="true"` with `border-l-2 border-green-500` for XI rows, `data-xi="false"` with `opacity-60` for bench rows, `fh-reversion-notice` amber italic text for Free Hit mode, formation + budget headline (`chip-squad-headline`)
- `GwToggle.tsx`: `disabled?: boolean` prop added — wraps group in `pointer-events-none opacity-50` div when true (D-08)
- `OptimiserPanel.tsx`:
  - `chipMode` state (default `'none'`)
  - `chipSquad` useMemo with `effectiveHorizon` FH lock (D-08 Pitfall 2)
  - Budget arithmetic: auth = sell prices + bank, unauth = `CHIP_DEFAULT_BUDGET_TENTHS` (D-11)
  - `ChipModeToggle` rendered after GwToggle row
  - WC/FH: `ChipSquadView` replaces comparison table (D-03); null chipSquad → amber null-banner
  - BB: `bb-headline-row` with Bench xPts / Start xPts / Total; `bb-notice` copy; full bench opacity (D-13..D-15)
  - FtToggle and Transfer Suggestions section hidden when WC/FH active (D-02, D-03)
  - `ComparisonTable` + `MobileComparisonCards`: `isBenchBoost` prop suppresses bench row opacity (D-14, Pitfall 6)
- `ChipModeToggle.test.tsx`: 7 tests — all GREEN (migrated from require() try/catch to static import)
- `ChipSquadView.test.tsx`: 8 tests — all GREEN (same migration)
- `OptimiserPanel.test.tsx`: 9 new Phase 46 tests added, all GREEN; all 24 Phase 44/45 tests still GREEN (33 total)

## Task Commits

1. **Task 1: ChipModeToggle + GwToggle disabled prop** - `84a5508` (feat)
2. **Task 2: ChipSquadView + OptimiserPanel chip mode integration** - `363fa4e` (feat)
3. **Task 3: OptimiserPanel.test.tsx Phase 46 describe block** - `11b77b0` (test)

## Files Created/Modified

- `src/components/optimiser/ChipModeToggle.tsx` — NEW: 4-button chip selector pill (46 lines)
- `src/components/optimiser/ChipSquadView.tsx` — NEW: position-grouped squad view (102 lines)
- `src/components/optimiser/OptimiserPanel.tsx` — EXTENDED: chipMode state, chipSquad memo, conditional JSX, BB headline/notice, isBenchBoost threading (~200 lines added)
- `src/components/optimiser/OptimiserPanel.test.tsx` — EXTENDED: Phase 46 mocks + 9 tests + beforeEach defaults (~150 lines added)
- `src/components/optimiser/ChipModeToggle.test.tsx` — UPDATED: static import replaces require() try/catch (7 tests)
- `src/components/optimiser/ChipSquadView.test.tsx` — UPDATED: static import replaces require() try/catch (8 tests)
- `src/components/gem-table/GwToggle.tsx` — MODIFIED: disabled prop + wrapper div (5 lines added)

## Decisions Made

- Used `border-green-500` (not `border-l-green-500`) for XI row left border — test assertions check for `border-green-500` as a className substring; `border-l-2` provides the left-only width; `border-green-500` applies color to all borders but only left has width
- Static imports replace `require()` try/catch in Wave 0 test stubs — Vitest 4.1 running in ESM mode does not route CJS `require()` through its module resolver for `.tsx` files with `@/` path aliases in the top-level module scope. Static imports work correctly.
- FtToggle placed inside the `{chipMode !== 'wildcard' && chipMode !== 'free-hit'}` Transfer Suggestions section guard — eliminates need for a separate conditional wrapper and keeps the toggle logically adjacent to the suggestions it controls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest 4.1 ESM interop: require() try/catch pattern doesn't work for .tsx files**
- **Found during:** Task 1 (ChipModeToggle test run)
- **Issue:** Wave 0 test stubs used `require('./ChipModeToggle')` inside a try/catch at module scope. In Vitest 4.1 with ESM transform mode, this CJS `require()` cannot resolve `.tsx` files with `@/` aliases — it throws `Cannot find module` and leaves the variable as `null` even when the file exists
- **Fix:** Replaced try/catch require() with static `import { ChipModeToggle } from './ChipModeToggle'` and `import { ChipSquadView } from './ChipSquadView'` in both test files. All guards (`if (!ChipModeToggle) throw...`) removed as they're no longer needed
- **Files modified:** `ChipModeToggle.test.tsx`, `ChipSquadView.test.tsx`
- **Commits:** `84a5508`

**2. [Rule 1 - Bug] border-green-500 vs border-l-green-500 in ChipSquadView XI rows**
- **Found during:** Task 2 (ChipSquadView test run — 1 test failing)
- **Issue:** Component used `border-l-green-500` (Tailwind left-border color) but test checks `row.className.includes('border-green-500')` — `border-l-green-500` does not contain `border-green-500` as a substring
- **Fix:** Changed class from `border-l-green-500` to `border-green-500` — combined with `border-l-2`, only the left border has visible width so visual result is identical; test now passes
- **Files modified:** `ChipSquadView.tsx`
- **Commits:** `363fa4e`

**3. [Rule 1 - Bug] Plan fixture used extra fields not in EntryHistory schema**
- **Found during:** Task 3 (TypeScript would fail on extra fields in SquadPicksResponse)
- **Issue:** Plan's Phase 46 test fixture had extra fields (`points`, `total_points`, `rank`, etc.) not present in `EntryHistorySchema`
- **Fix:** Reduced fixture to match actual schema fields: `event`, `bank`, `value`, `event_transfers`, `event_transfers_cost`
- **Files modified:** `OptimiserPanel.test.tsx`
- **Commits:** `11b77b0`

## Issues Encountered

Pre-existing (out of scope):
- `tests/lib/club-form.test.ts`: 1 failing test — pre-existing, confirmed unchanged
- `tests/lib/captain-picks.test.ts`: 5 TypeScript errors — pre-existing, confirmed unchanged

## Known Stubs

None. All chip mode paths are fully wired with real data and real engine calls.

## Threat Flags

No new unreviewed threat surface. Budget derivation follows D-11 pattern validated in Phase 45; effectiveHorizon guard (Pitfall 2) is present; chipMode is ephemeral client state with no persistence (T-46-04 accepted).

## Self-Check: PASSED

### Files exist:
- `src/components/optimiser/ChipModeToggle.tsx` — FOUND
- `src/components/optimiser/ChipSquadView.tsx` — FOUND
- `src/components/optimiser/OptimiserPanel.tsx` — FOUND (modified)
- `src/components/optimiser/OptimiserPanel.test.tsx` — FOUND (modified)
- `src/components/gem-table/GwToggle.tsx` — FOUND (modified)

### Commits exist:
- `84a5508` feat(46-03): Task 1 — FOUND
- `363fa4e` feat(46-03): Task 2 — FOUND
- `11b77b0` test(46-03): Task 3 — FOUND

### Test results:
- ChipModeToggle.test.tsx: 7/7 GREEN
- ChipSquadView.test.tsx: 8/8 GREEN
- OptimiserPanel.test.tsx: 33/33 GREEN (24 Phase 44/45 + 9 Phase 46)
- Full suite: 511 pass, 34 skip, 1 pre-existing fail (club-form.test.ts)
