---
phase: 39-player-comparison-modal
plan: 1
subsystem: gem-table/testing
tags:
  - tests
  - wave-0
  - player-comparison
  - tdd-red
dependency_graph:
  requires: []
  provides:
    - RED test stubs for CMP-01 through CMP-06 (PlayerComparisonModal)
    - RED test stub for createColumns compare icon (CMP-01 columns)
    - RED test stub for GemTable→modal wiring at page level (CMP-01 page)
  affects:
    - src/components/gem-table/PlayerComparisonModal.test.tsx
    - src/components/gem-table/columns.test.tsx
    - src/app/page.test.tsx
tech_stack:
  added: []
  patterns:
    - Vitest jsdom environment with HTMLDialogElement polyfill
    - RTL render + fireEvent for modal interaction tests
    - vi.mock for internal data hooks (usePlayers, computeAllGemScores)
    - ScoredPlayer fixtures cast via `as unknown as ScoredPlayer`
key_files:
  created:
    - src/components/gem-table/PlayerComparisonModal.test.tsx
    - src/components/gem-table/columns.test.tsx
  modified:
    - src/app/page.test.tsx
decisions:
  - Used correct FixtureEntry field names (opponent_team, event_id, difficulty_score, difficulty_tier) — the plan listed shorthand names (opponent_short, gw, difficulty) which do not match the actual TypeScript interface
  - FixtureBadges CMP-05 test asserts opponent names with /BUR/i and /AVL/i regex patterns since FixtureBadges renders "{opponent_team} H/A" format
metrics:
  duration: "~3 minutes"
  completed: "2026-04-29"
  tasks_completed: 3
  files_changed: 3
---

# Phase 39 Plan 1: Wave 0 RED Test Stubs Summary

Wave 0 RED test stubs for PlayerComparisonModal and GemTable compare-icon wiring across three test files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PlayerComparisonModal.test.tsx (CMP-01..CMP-06) | 4fe2f0f | src/components/gem-table/PlayerComparisonModal.test.tsx |
| 2 | Create columns.test.tsx compare icon stub (CMP-01 cell) | 8e8803f | src/components/gem-table/columns.test.tsx |
| 3 | Extend page.test.tsx Phase 39 modal mount stub (CMP-01 page) | 5151743 | src/app/page.test.tsx |

## Test File Details

### PlayerComparisonModal.test.tsx (created — 246 lines)

Six failing `it()` blocks covering all requirements:

- **CMP-01** — Modal renders in open state with playerA name visible
- **CMP-02** — Search input filters scored players; selecting result populates Player B
- **CMP-03** — xPts section renders 1gw/3gw/5gw and 90th-percentile values for both players
- **CMP-04** — Gem Scores section renders composite + 7 component scores as 0-100 integers
- **CMP-05** — Fixtures section renders FixtureBadges for both players (BUR + AVL assertions)
- **CMP-06** — Signals section renders BUY/SELL, DIFF/TRAP badges for both players

Test infrastructure: HTMLDialogElement polyfill, `vi.mock` for `usePlayers` + `computeAllGemScores`, complete PLAYER_A (Salah) and PLAYER_B (Haaland) fixtures with all `ScoredPlayer` fields.

### columns.test.tsx (created — 44 lines)

Single failing test asserting:
- `createColumns(onCompare)` is callable as a factory
- Column 0 has `accessorKey === 'web_name'`
- Cell renderer outputs player name + `aria-label="Compare Salah"` button
- Clicking the button fires `onCompare(PLAYER_A)`

Fails RED because `columns.tsx` exports static `columns` array, not `createColumns` factory.

### page.test.tsx (extended — 145 lines total, 29 lines added)

Three changes applied:
1. GemTable mock updated to accept and expose `onCompare` prop via `gem-table-compare-trigger` button
2. `PlayerComparisonModal` mock added — renders `data-testid="comparison-modal"` only when `open` is true
3. New `describe('Phase 39: player comparison modal mount', ...)` block with one failing test asserting clicking the trigger mounts the modal with `TestPlayer` text

## Test Results

```
Test Files: 3 failed (all Phase 39 test files RED as required)
Tests:      2 failed (Phase 39) | 5 passed (Phase 36) = 7 total
```

Phase 36 tests remain GREEN (5 passing). Phase 39 stubs are RED:
- `PlayerComparisonModal.test.tsx` — fails on module resolution (component does not exist)
- `columns.test.tsx` — fails with `TypeError: createColumns is not a function` (factory not yet exported)
- `page.test.tsx` — Phase 39 test fails `expected null not to be null` (page.tsx not wired); Phase 36 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected FixtureEntry field names in test fixtures**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `opponent_short`, `gw`, `difficulty` as fixture fields. The actual `FixtureEntry` interface uses `opponent_team`, `event_id`, `difficulty_score`, `difficulty_tier`.
- **Fix:** Used correct field names from `src/lib/types.ts` FixtureEntry interface; also updated CMP-05 assertions to `/BUR/i` regex since FixtureBadges renders `{opponent_team} H/A` (e.g., "BUR H").
- **Files modified:** `PlayerComparisonModal.test.tsx`
- **Impact:** Tests will correctly exercise the real FixtureBadges component when Plan 02 implements the modal.

## Production Component Status

`src/components/gem-table/PlayerComparisonModal.tsx` — **does not exist** (confirmed). Plan 02 creates this component to flip CMP-01..CMP-06 from RED to GREEN.

## Self-Check: PASSED

- [x] `src/components/gem-table/PlayerComparisonModal.test.tsx` exists (246 lines)
- [x] `src/components/gem-table/columns.test.tsx` exists (44 lines)
- [x] `src/app/page.test.tsx` extended (145 lines, Phase 36 block intact)
- [x] Commit 4fe2f0f exists (PlayerComparisonModal.test.tsx)
- [x] Commit 8e8803f exists (columns.test.tsx)
- [x] Commit 5151743 exists (page.test.tsx extension)
- [x] No production `PlayerComparisonModal.tsx` exists
- [x] Phase 36 tests all GREEN, Phase 39 stubs all RED
