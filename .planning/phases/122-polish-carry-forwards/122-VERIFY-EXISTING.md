# Phase 122 — Verification of Already-Implemented Requirements

**Verified:** 2026-05-18
**Scope:** POL-03, POL-05, POL-06 (D-06, D-07, D-08 from 122-CONTEXT.md)

## POL-03 — SquadView Transfers tab MinsRiskBadge

- File: `src/components/squad/SquadView.tsx`
- Line: 224
- Code: `<MinsRiskBadge minsRisk={player.mins_risk} />`
- Context: The badge is inside a `<td className="px-3 py-2 whitespace-nowrap">` at line 223–225, which is part of the player picks table rendered by `SquadView`. This component is mounted in the Squad section of the app. All picks (starting XI + bench) render this row. The table is not tab-gated within SquadView itself — it renders whenever `SquadView` receives valid picks data. The `SquadView` component is consumed by `page.tsx` in the Squad section.
- Test coverage: `grep -n "MinsRiskBadge|mins_risk" src/components/squad/*.test.tsx` returns `src/components/squad/LineupTab.test.tsx:66: mins_risk: 'nailed'` (the LineupTab test sets `mins_risk` on player fixtures). No dedicated `SquadView.test.tsx` MinsRiskBadge assertion exists — coverage is via integration/visual only. This is acceptable: MinsRiskBadge has its own unit tests and is a pure presentational component.
- **Decision:** PASS — `<MinsRiskBadge minsRisk={player.mins_risk} />` is present at line 224 in the current source. The field `mins_risk` is always present on `ScoredPlayer` (defined in `src/lib/types.ts`). Component renders for every squad pick row.

## POL-05 — GemTable mins_risk column

- File: `src/components/gem-table/columns.tsx`
- Lines: 271–276
- Code: `col.display({ id: 'mins_risk', header: H('Risk', 'Minutes risk: Nailed (>85% start prob) · Likely (65–85%) · Rotation (40–65%) · Bench risk (<40%)'), enableSorting: false, cell: ({ row }) => <MinsRiskBadge minsRisk={row.original.mins_risk} /> })`
- Default-preset visibility: `mins_risk` is NOT listed in any hidden-columns preset. Evidence from `src/components/gem-table/GwToggle.tsx`:
  - `MOBILE_HIDDEN_COLUMNS` (lines 5–26): does not include `mins_risk`
  - `PRESET_COLUMN_VISIBILITY.compact` (lines 29–50): does not include `mins_risk`
  - `PRESET_COLUMN_VISIBILITY.default` (lines 51–62): does not include `mins_risk`
  - `PRESET_COLUMN_VISIBILITY.analysis` (lines 63–71): does not include `mins_risk`
  - Conclusion: `mins_risk` column is visible on all presets (default, compact, analysis) on desktop and mobile.
- Test coverage: `src/components/gem-table/columns.test.tsx` line 87 — `it('renders MinsRiskBadge inside card when minsRisk is rotation_risk (D-02)')` — dedicated test present and currently passing.
- **Decision:** PASS — `mins_risk` column defined at lines 271–276 with `MinsRiskBadge` in the cell renderer. Not hidden in any preset. Covered by a dedicated test at columns.test.tsx:87.

## POL-06 — PlayerComparisonModal MinsRiskBadge

- File: `src/components/gem-table/PlayerComparisonModal.tsx`
- Line: 172
- Code: `<MinsRiskBadge minsRisk={p.mins_risk} />`
- Both players coverage: `renderSignalsColumn` is defined at line 160 and invoked at:
  - Line 249: `{renderSignalsColumn(playerA)}` — first compared player
  - Line 250: `{playerB ? renderSignalsColumn(playerB) : renderPlaceholder()}` — second compared player (conditional on playerB being defined)
  - Result: when two players are compared, both trigger `renderSignalsColumn` and both render `<MinsRiskBadge minsRisk={p.mins_risk} />` at line 172.
- Test coverage: `src/components/gem-table/PlayerComparisonModal.test.tsx` — fixture at line 66 sets `mins_risk: 'nailed'` on playerA; fixture at line 137 sets `mins_risk: 'likely_start'` on playerB. Both compared players have `mins_risk` set in the test fixtures, confirming the badge path is exercised in tests.
- **Decision:** PASS — `<MinsRiskBadge minsRisk={p.mins_risk} />` is present at line 172 inside `renderSignalsColumn`. The function is called for both compared players (lines 249–250). Test fixtures include `mins_risk` for both players.

## Summary

| REQ-ID | Status | Evidence |
|--------|--------|----------|
| POL-03 | PASS | SquadView.tsx:224 — `<MinsRiskBadge minsRisk={player.mins_risk} />` in player picks table |
| POL-05 | PASS | columns.tsx:271–276 — `mins_risk` column defined with MinsRiskBadge; not hidden in any preset; columns.test.tsx:87 passes |
| POL-06 | PASS | PlayerComparisonModal.tsx:172 — `<MinsRiskBadge minsRisk={p.mins_risk} />` in renderSignalsColumn; called for both players at lines 249–250; test fixtures set mins_risk on both compared players |

All three requirements verified as already implemented. No remediation plan required.
