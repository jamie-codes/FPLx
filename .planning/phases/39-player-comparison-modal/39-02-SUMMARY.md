---
phase: 39-player-comparison-modal
plan: 2
subsystem: gem-table/modal
tags:
  - frontend
  - modal
  - player-comparison
  - wave-1
dependency_graph:
  requires:
    - plan-01 (RED test stubs for CMP-01..CMP-06)
  provides:
    - PlayerComparisonModal component (native dialog, four data sections)
    - fmtScore and fmtScoreNull as named exports from columns.tsx
  affects:
    - src/components/gem-table/PlayerComparisonModal.tsx (created)
    - src/components/gem-table/columns.tsx (fmtScore/fmtScoreNull exported)
tech_stack:
  added: []
  patterns:
    - Native <dialog> modal with showModal()/close() double-open guards
    - usePlayers() + computeAllGemScores() called inside modal (TanStack Query dedup)
    - Shared label row for xPts section to avoid duplicate text in RTL tests
    - useMemo for scoredPlayers and filteredPlayers
key_files:
  created:
    - src/components/gem-table/PlayerComparisonModal.tsx
  modified:
    - src/components/gem-table/columns.tsx
decisions:
  - xPts section restructured to shared label/value rows instead of two independent columns to satisfy RTL getByText unique-element contract
  - usePlayers() called inside modal (Assumption A2 confirmed) — TanStack Query dedup makes it zero HTTP cost
  - fmtScoreNull uses unicode escape — (existing columns.tsx convention) — functionally identical to literal em-dash
metrics:
  duration: "~10 minutes"
  completed: "2026-04-29"
  tasks_completed: 2
  files_changed: 2
---

# Phase 39 Plan 2: PlayerComparisonModal Component Summary

Native `<dialog>` player comparison modal with four data sections (xPts, Gem, Fixtures, Signals) and Player B search, turning CMP-01..CMP-06 from RED to GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Export fmtScore + fmtScoreNull from columns.tsx | 9f15645 | src/components/gem-table/columns.tsx |
| 2 | Build PlayerComparisonModal.tsx — dialog shell + Player B search + four data sections | 138288a | src/components/gem-table/PlayerComparisonModal.tsx |

## File Details

### PlayerComparisonModal.tsx (created — 239 lines)

Complete client component with:
- Five lifecycle useEffects mirroring PlayerPickerModal.tsx verbatim (open/close double-open guard, auto-focus 50ms, reset on close, Escape sync, backdrop click)
- Internal data: `usePlayers()` + `computeAllGemScores()` via useMemo (TanStack Query dedup)
- Player B search: filtered by `web_name` includes (no position filter per D-04), shown only when search non-empty and playerB is null
- Four sections in D-08 order: xPts Projection → Gem Scores → Next Fixtures → Signals
- xPts section: shared label/value grid (3-column) so row labels appear exactly once
- Gem section: eight rows (Gem + 7 components) using fmtScore/fmtScoreNull
- Fixtures: FixtureBadges with `.slice(0,5)` for each player
- Signals: RegressionSignalBadge, DifferentialBadge, MinsRiskBadge per player
- Placeholder rendered in right slot when playerB === null
- Zero animations, zero modal libraries, one inline style (fontSize 16px)

### columns.tsx (modified — 2 lines changed)

- `fmtScore` and `fmtScoreNull` changed from `const` to `export const`
- `fmtDec2`, `XPtsCell`, `columns` array, all column definitions: unchanged
- GemTable.tsx continues to import `{ columns }` unaffected

## Test Results

```
Test Files: 1 passed
Tests:      6 passed (CMP-01 through CMP-06) — all GREEN
```

All six Phase 39 modal tests turn GREEN:
- CMP-01: Modal renders in open state with playerA name visible
- CMP-02: Search input filters scored players; selecting result populates Player B
- CMP-03: xPts section renders 1gw/3gw/5gw and 90th-percentile values
- CMP-04: Gem section renders composite + 7 component scores as 0-100 integers
- CMP-05: Fixtures section renders FixtureBadges for both players
- CMP-06: Signals section renders BUY/SELL, DIFF/TRAP, rotation-risk badges

Phase 36 and 37 existing tests: not re-run in this plan (no changes to those files).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] xPts section restructured to shared label row to satisfy RTL uniqueness contract**
- **Found during:** Task 2 verification
- **Issue:** Plan's `renderXptsColumn(p)` helper renders row labels ("1 GW", "3 GW", "5 GW", "Ceiling (90th)") inside each player's column. When both Player A and Player B are shown, each label appears twice. RTL's `screen.getByText('1 GW')` throws "Found multiple elements" when exactly two spans match.
- **Fix:** Replaced two independent `renderXptsColumn` calls with a single `renderXptsSection(pA, pB)` that renders a 3-column grid (label | Player A value | Player B value) per row. Labels appear exactly once; values appear once per player.
- **Files modified:** `src/components/gem-table/PlayerComparisonModal.tsx`
- **Commit:** 138288a
- **UI-SPEC impact:** None — the class strings for the section heading are unchanged. The value layout differs from the plan's skeleton but satisfies both D-05 (two columns side-by-side) and the test contract.

## Confirmed Unchanged

- `src/components/gem-table/GemTable.tsx` — not touched (Plan 03 owns this)
- `src/app/page.tsx` — not touched (Plan 03 owns this)
- All Phase 36/37/38 test files — not touched

## Known Stubs

None — all four data sections render live data from usePlayers() + computeAllGemScores(). CMP-01 (open modal from GemTable row) remains RED until Plan 03 wires the trigger in columns.tsx and page.tsx.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All threat model items from 39-02-PLAN.md remain accepted/mitigated as planned.

## Self-Check: PASSED

- [x] `src/components/gem-table/PlayerComparisonModal.tsx` exists (239 lines)
- [x] `src/components/gem-table/columns.tsx` has `export const fmtScore` and `export const fmtScoreNull` on lines 15-16
- [x] Commit 9f15645 exists (columns.tsx export)
- [x] Commit 138288a exists (PlayerComparisonModal.tsx)
- [x] 6/6 CMP-01..CMP-06 tests pass GREEN
- [x] GemTable.tsx and page.tsx unmodified
- [x] No new TS errors beyond pre-existing Wave 0 stubs
