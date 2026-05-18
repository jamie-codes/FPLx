---
phase: 122-polish-carry-forwards
plan: 02
subsystem: ui
tags: [mins-risk-badge, opportunity-cost, verify-only, tailwind, react, vitest]

# Dependency graph
requires:
  - phase: 122-01
    provides: ChipToggle state wiring and Transfer Hits label fix in RouteTreeTab (POL-01/POL-02)

provides:
  - MinsRiskBadge wired into OpportunityCostTable buy-player cluster (POL-04)
  - Source-pinned verification record for POL-03 (SquadView), POL-05 (GemTable column), POL-06 (PlayerComparisonModal)
  - 122-VERIFY-EXISTING.md with PASS decisions for all three already-implemented requirements

affects: [transfers, opportunity-cost, squad-view, gem-table]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MinsRiskBadge cluster ordering in OCS: RotationRiskBadge → StatusLabelBadge → MinsRiskBadge → NewsBanner"
    - "TDD RED→GREEN for badge insertion: failing test written before import/JSX change"

key-files:
  created:
    - .planning/phases/122-polish-carry-forwards/122-VERIFY-EXISTING.md
  modified:
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx

key-decisions:
  - "MinsRiskBadge placed between StatusLabelBadge and NewsBanner in buy cluster per D-05 and badge cluster ordering convention"
  - "mins60Prob prop omitted from OCS MinsRiskBadge — OCS transfer legs do not carry that field on ScoredPlayer"
  - "No conditional wrapper around MinsRiskBadge — component already returns null for undefined and 'injured'"

patterns-established:
  - "Badge cluster in PlayerMoveCell: always render unconditionally; let each badge component self-suppress via null return"

requirements-completed: [POL-03, POL-04, POL-05, POL-06]

# Metrics
duration: 15min
completed: 2026-05-18
---

# Phase 122 Plan 02: Polish Carry-Forwards (OCS Badge + Verification) Summary

**MinsRiskBadge slotted into OpportunityCostTable buy cluster (POL-04) via TDD RED→GREEN; POL-03/POL-05/POL-06 verified PASS with live source line numbers in 122-VERIFY-EXISTING.md**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-18T15:30:00Z
- **Completed:** 2026-05-18T15:45:12Z
- **Tasks:** 2
- **Files modified:** 3 (OpportunityCostTable.tsx, OpportunityCostTable.test.tsx, 122-VERIFY-EXISTING.md)

## Accomplishments

- POL-04: `MinsRiskBadge` imported and inserted between `StatusLabelBadge` and `NewsBanner` in the buy-player badge cluster of `OpportunityCostTable.PlayerMoveCell` with `minsRisk={t.buy.mins_risk}` and no `mins60Prob`
- TDD: failing test written first (RED confirmed), then implementation (GREEN — 20/20 tests pass including 2 new)
- 122-VERIFY-EXISTING.md: three PASS decisions with live line-number evidence for POL-03 (SquadView:224), POL-05 (columns.tsx:271–276), POL-06 (PlayerComparisonModal:172)

## Task Commits

1. **Task 1: Add MinsRiskBadge to OpportunityCostTable buy cluster (POL-04)** - `c381e3a` (feat/test — TDD RED→GREEN)
2. **Task 2: Produce source-pinned verification record for POL-03/05/06** - `bcecf62` (docs)

## Files Created/Modified

- `src/components/transfers/OpportunityCostTable.tsx` — Added `import { MinsRiskBadge }` and `<MinsRiskBadge minsRisk={t.buy.mins_risk} />` between StatusLabelBadge and NewsBanner in buy cluster
- `src/components/transfers/OpportunityCostTable.test.tsx` — Added 2 new tests: rotation_risk renders badge; injured renders nothing
- `.planning/phases/122-polish-carry-forwards/122-VERIFY-EXISTING.md` — PASS decisions for POL-03/05/06 with live source line numbers and test coverage evidence

## Decisions Made

- Buy-only insertion per CONTEXT.md D-05: MinsRiskBadge goes on the buy player only; sell side already has rejection reasons
- `mins60Prob` omitted: OCS table's `ScoredPlayer` legs carry `mins_risk` but not `mins_60_prob`; consistent with SquadView and PlayerComparisonModal analogs which also omit `mins60Prob`
- Unconditional render: `MinsRiskBadge` already returns `null` for `undefined` and `'injured'` — no wrapping conditional needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `src/app/api/decision-history/route.test.ts` (Buffer/SharedArrayBuffer type mismatch) was present before this plan and is out of scope. No new TypeScript errors introduced by this plan's changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 122 POL-01/02 (RouteTreeTab ChipToggle + label) done in plan 01; POL-03/04/05/06 done in plan 02 — phase 122 is complete
- All 4 carry-forward requirements (POL-03/04/05/06) verified with evidence; 122-VERIFY-EXISTING.md serves as the audit record
- Ready for Phase 123 (SCRAPER-02 pipeline) which has no dependency on Phase 122

---
*Phase: 122-polish-carry-forwards*
*Completed: 2026-05-18*
