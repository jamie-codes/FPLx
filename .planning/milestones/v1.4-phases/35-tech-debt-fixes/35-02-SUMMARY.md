---
phase: 35-tech-debt-fixes
plan: 02
status: complete
completed: "2026-04-29"
---

# Plan 35-02 Summary: TypeScript/frontend tech-debt fixes

## What was built

Three targeted correctness and clarity fixes to TypeScript/frontend code — no new behaviour, audit compliance only.

## Affects

- `src/components/gem-table/GwToggle.tsx`
- `src/components/insights/InsightsTab.test.tsx`
- `src/components/planner/ChipStrategyPanel.tsx`

## Fixes applied

- **WR-01**: Renamed `signal: false` to `regression_signal: false` in `MOBILE_HIDDEN_COLUMNS`. The TanStack column accessor is `regression_signal` — the old key `signal` never matched, so the Signal column was never hidden on mobile viewports.
- **WR-04**: Added `as Insight[]` type assertion to `data: []` in the empty-state test mock. TypeScript was inferring `never[]` for the bare `[]` literal, causing a TS2352 type-overlap error when casting to `ReturnType<typeof useInsights>`.
- **WR-07**: Added a JSX comment above the `FHChipRow` `bestGw` prop explaining why the `> 0` guard is always valid (FPL GW numbers start at 1; 0 only occurs if the engine received no fixture data at all).

## Self-Check: PASSED

- `grep -n "regression_signal: false" src/components/gem-table/GwToggle.tsx` → 1 match ✓
- `grep -n "  signal: false" src/components/gem-table/GwToggle.tsx` → 0 matches ✓
- `grep -n "data: \[\] as Insight\[\]" src/components/insights/InsightsTab.test.tsx` → 1 match ✓
- `grep -n "FPL GW numbers are always" src/components/planner/ChipStrategyPanel.tsx` → 1 match ✓
- `npx vitest run src/components/insights/InsightsTab.test.tsx` → 12/12 passed ✓
- `npx vitest run src/components/gem-table/GwToggle.test.ts` → 6/6 passed ✓
- Pre-existing TS errors in `tests/lib/captain-picks.test.ts` (TS2554) are unrelated and pre-dated this phase.

## Key files

- `src/components/gem-table/GwToggle.tsx` — `MOBILE_HIDDEN_COLUMNS` column key fix
- `src/components/insights/InsightsTab.test.tsx` — `data: [] as Insight[]` type cast
- `src/components/planner/ChipStrategyPanel.tsx` — bestGw guard comment

## Notable deviations

None — all changes exactly as specified in plan.
