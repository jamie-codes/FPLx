---
phase: 06-club-form-value-gems-and-polish
plan: "03"
subsystem: ui-value-gems
tags: [value-gems, price-trend, filter-pills, tanstack-table, transfer-panel]
dependency_graph:
  requires:
    - plan-06-01 (isCheapGem, isLowOwned predicates; cost_change fields on MergedPlayer)
    - plan-06-02 (FixtureBadges, LastUpdated components)
  provides:
    - ValueGemsTable component with filter pills (Cheap/Low-owned/All)
    - Price trend column (GW primary + season sub-text) on GemTable, ValueGemsTable, TransferPanel
    - Value Gems tab wired in page.tsx
  affects:
    - src/app/page.tsx (value-gems tab now renders ValueGemsTable)
    - src/components/gem-table/columns.tsx (new trend column)
    - src/components/transfers/TransferPanel.tsx (trend on sell/buy rows)
tech_stack:
  added: []
  patterns:
    - TanStack Table v8 with filter state (FilterMode enum)
    - Extracted predicate imports (isCheapGem, isLowOwned) for testable filtering
    - Inline PriceTrendCell component pattern for dual-display (GW + season)
key_files:
  created:
    - src/components/value-gems/ValueGemsTable.tsx
    - src/components/value-gems/columns.tsx
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/transfers/TransferPanel.tsx
    - src/app/page.tsx
    - src/lib/types.ts
    - tests/lib/transfer-engine.test.ts
decisions:
  - "PriceTrendCell shows cost_change_event as primary (GW arrow + amount) and cost_change_start as secondary sub-text per CONTEXT.md locked decision"
  - "ValueGemsTable default filter is Cheap (not All) — most actionable view for budget-conscious managers"
  - "TransferPanel trend is inline compact (no block layout) to keep transfer rows readable"
  - "cost_change_event/cost_change_start added to MergedPlayer in this plan (auto-fix: Plan 01 only added to FPLElement)"
metrics:
  duration_seconds: 150
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_created: 2
  files_modified: 5
---

# Phase 06 Plan 03: Value Gems Tab + Price Trend Columns Summary

**One-liner:** ValueGemsTable with Cheap/Low-owned/All filter pills using extracted predicates, plus price trend (GW primary + season sub-text) on GemTable, ValueGemsTable, and TransferPanel.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create ValueGemsTable with filter pills, price trend, fixture badges | 0e0716d | src/components/value-gems/ValueGemsTable.tsx, src/components/value-gems/columns.tsx, src/lib/types.ts, tests/lib/transfer-engine.test.ts |
| 2 | Price trend on GemTable + TransferPanel, wire ValueGemsTable into page | 3fb8430 | src/components/gem-table/columns.tsx, src/components/transfers/TransferPanel.tsx, src/app/page.tsx |

## What Was Built

### ValueGemsTable (Task 1)

New component at `src/components/value-gems/ValueGemsTable.tsx`:
- Filter pills: Cheap (£6m-), Low-owned (<10%), All — uses `isCheapGem` and `isLowOwned` extracted predicates from Plan 01
- Default filter: Cheap
- Default sort: gem_score descending
- Columns: Player, Pos, Team, Price, Own%, Pts, Gem score, Price Trend, Next 5 fixtures
- Renders `<LastUpdated />` below table
- Loading/error states matching GemTable pattern

New `src/components/value-gems/columns.tsx` with `PriceTrendCell`:
- Green ↑ arrow for rising price (cost_change_event > 0)
- Red ↓ arrow for falling price (cost_change_event < 0)
- Grey — dash for stable
- Season total as secondary sub-text (e.g. "+0.2m season") when non-zero

### Price Trend on GemTable (Task 2)

Added trend column to `src/components/gem-table/columns.tsx` before the fixtures column — same dual display as ValueGemsTable.

### Price Trend on TransferPanel (Task 2)

Added inline price trend indicators to both sell and buy player rows in both single-transfer suggestions and 2-transfer combo display. Compact format (no block layout) to preserve readability. Season sub-text in parentheses format.

### Page Wiring (Task 2)

`src/app/page.tsx` now imports and renders `<ValueGemsTable />` in the value-gems tab, replacing the "Coming soon..." placeholder.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added cost_change_event/cost_change_start to MergedPlayer**
- **Found during:** Task 1 — writing columns.tsx that access `row.original.cost_change_event`
- **Issue:** Plan 01 added these fields to `FPLElement` only, not to `MergedPlayer`. Since `ScoredPlayer extends MergedPlayer`, the fields were inaccessible on scored players used in table cells.
- **Fix:** Added `cost_change_event: number` and `cost_change_start: number` to `MergedPlayer` after the `news` field in `src/lib/types.ts`
- **Files modified:** src/lib/types.ts, tests/lib/transfer-engine.test.ts (factory updated with defaults)
- **Commit:** 0e0716d

## Test Results

```
Test Files  9 passed (9)
     Tests  86 passed | 2 skipped (88)
```

All 9 test files in `tests/lib/` pass. Build completes without errors.

## Known Stubs

None — all implementations use live data from `usePlayers()` + `computeAllGemScores()`. No placeholder data.

## Self-Check: PASSED
