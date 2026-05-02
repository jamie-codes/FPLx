# Plan 052-04 Summary

**Status:** Tasks 1-2 complete — Task 3 (human-verify checkpoint) pending
**Wave:** 2

## What was done

- Created `src/components/shared/MinsRiskBadge.test.tsx` with 8 test cases (RED->GREEN TDD)
- Extended `MinsRiskBadge.tsx` with optional `mins60Prob?: number` prop; tooltip format: `"<Label> — <X>% chance 60+ min"` (em-dash U+2014, integer percentage via Math.round)
- Wired `mins60Prob` at 3 D-10 call sites: TransferPanel (x2), CaptaincyPanel (x1), XPtsCell hover card (x1)
  - Also extended `XPtsCell` prop type and `createColumns` call site in `columns.tsx` to pass `info.row.original.mins_60_prob`
- 4 out-of-scope call sites (SquadView, DecisionSummaryTab, columns.tsx main cell at line 218, PlayerComparisonModal) unchanged

## Pending

- Task 3: Human verification of tooltip behavior in browser

## Verification

- 8 MinsRiskBadge tests pass
- npx tsc --noEmit: only pre-existing errors in `tests/lib/captain-picks.test.ts` (5 errors, pre-existed before this plan — verified by stash check)
- npx vitest run: 49/50 test files pass; 1 pre-existing failure in `tests/lib/club-form.test.ts` (verified pre-existing by stash check)
- Out-of-scope files have zero mins60Prob occurrences (verified by grep)

## Commits

| Hash | Message |
|------|---------|
| b739923 | test(052-04): add failing MinsRiskBadge tooltip tests for mins60Prob prop (D-09) |
| 9a95d24 | feat(052-04): add optional mins60Prob prop to MinsRiskBadge with em-dash tooltip (D-09) |
| c001a13 | feat(052-04): wire mins60Prob at TransferPanel, CaptaincyPanel, and XPtsCell hover-card badge sites (D-10) |

## Deviations from Plan

None - plan executed exactly as written. The XPtsCell `mins60Prob` prop addition and `createColumns` call-site update were implied by the plan's Task 2 description ("Extend XPtsCell to also receive and pass mins60Prob") and executed as specified.

## Known Stubs

None — `mins60Prob` is passed through correctly at all 3 D-10 call sites. When `merged_players.json` does not yet include `mins_60_prob` (pre-Plan-03 pipeline run), the prop arrives as `undefined` and the badge gracefully falls back to `config.title` (existing tooltip text). This is the intended undefined-fallback path, not a stub.
