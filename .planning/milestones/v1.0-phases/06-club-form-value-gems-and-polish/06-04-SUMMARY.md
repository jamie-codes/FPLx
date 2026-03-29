---
phase: 06-club-form-value-gems-and-polish
plan: 04
subsystem: ui
tags: [club-form, price-trend, fixtures, difficulty-tier, tanstack-table]

# Dependency graph
requires:
  - phase: 06-club-form-value-gems-and-polish
    provides: "computeClubForm, PriceTrendCell, ValueGemsTable, TransferPanel"
provides:
  - "Corrected tier() function — high score maps to 'hard', low score to 'easy'"
  - "?? 0 guards on cost_change_event and cost_change_start in all three render sites"
  - "Regression test confirming tier direction is correct"
  - "Refreshed merged_players.json with cost_change fields from pipeline run"
affects: [fixture-badges, value-gems-table, gem-table, transfer-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nullish coalescing (?? 0) on optional numeric fields before rendering to prevent NaN"
    - "Difficulty score inversion: high diffScore = strong opponent = hard fixture"

key-files:
  created: []
  modified:
    - src/lib/club-form.ts
    - tests/lib/club-form.test.ts
    - src/components/value-gems/columns.tsx
    - src/components/gem-table/columns.tsx
    - src/components/transfers/TransferPanel.tsx

key-decisions:
  - "tier() bug was a return-value swap (easy/hard inverted) — fix is minimal and correct per the existing threshold calculation logic"
  - "?? 0 applied at render call-site rather than in data layer so existing type definitions are unchanged"

patterns-established:
  - "Pattern: All optional numeric FPL fields (cost_change_*) must be guarded with ?? 0 before arithmetic"

requirements-completed: [FFA-03, VAL-03, UIX-01]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 06 Plan 04: Gap Closure — Tier Inversion and NaN Price Trend Fixes Summary

**Swapped inverted tier() return values in computeClubForm and added ?? 0 guards on all cost_change_event/start render sites to eliminate NaN in Value Gems, Gem Table, and Transfer Panel**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-29T18:01:17Z
- **Completed:** 2026-03-29T18:05:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fixed bug in `tier()` function where 'easy' and 'hard' were swapped — Man City now shows as hard (red) fixtures, not easy (green)
- Added regression test confirming BUR (worst defensive record) produces non-hard tier for opponents
- Added `?? 0` guards in all three render sites (value-gems/columns.tsx, gem-table/columns.tsx, TransferPanel.tsx) preventing NaN when cost_change fields are undefined
- Re-ran pipeline to regenerate merged_players.json with populated cost_change fields
- Build passes clean with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix tier inversion in computeClubForm and add regression test** - `410d0ae` (fix)
2. **Task 2: Guard undefined cost_change fields and re-run pipeline** - `bbb568a` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/club-form.ts` - Corrected tier() function: `>= hardThreshScore` returns 'hard', `<= easyThreshScore` returns 'easy'
- `tests/lib/club-form.test.ts` - Added regression test confirming tier direction is correct (7 tests pass total)
- `src/components/value-gems/columns.tsx` - costChangeEvent/Start props now receive `?? 0` at call site
- `src/components/gem-table/columns.tsx` - ev/st variables now assigned with `?? 0`
- `src/components/transfers/TransferPanel.tsx` - All 8 occurrences of cost_change_event/start guarded with `?? 0` in both single and two-transfer combo render blocks

## Decisions Made
- Fixed the bug at the return-value level (not the threshold calculation) since thresholds were correct — weak teams (high xGA, low diffScore after inversion) were already being identified properly; only the mapping from score to label was wrong
- Applied `?? 0` at the render call-site rather than altering the type definition, keeping the existing `MergedPlayer` schema unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both UAT gaps resolved: tier inversion (UAT tests 2, 6) and NaN price trend (UAT tests 8, 9) are fixed
- All 4 outstanding UAT gaps from 06-UAT.md should now pass on visual verification
- Phase 06 gap closure complete

---
*Phase: 06-club-form-value-gems-and-polish*
*Completed: 2026-03-29*
