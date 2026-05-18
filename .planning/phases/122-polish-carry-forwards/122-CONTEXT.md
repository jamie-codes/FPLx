# Phase 122: Polish Carry-Forwards - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire three pre-built but unwired/disabled UI components into their target surfaces:
ChipToggle state into RouteTreeTab (POL-01), the "Transfer Hits" label fix in RouteTreeTab (POL-02), and MinsRiskBadge into OpportunityCostTable's buy-player cluster (POL-04 partial). Zero new infrastructure, zero new types or routes.

Three requirements (POL-03, POL-05, POL-06) are **already implemented** in the committed codebase and require verification only — not new work.

</domain>

<decisions>
## Implementation Decisions

### ChipToggle Wiring (POL-01)
- **D-01:** Enable all 4 chips (wildcard / freehit / bboost / 3xc) in RouteTreeTab — same scope as ManualPlanTab. Engine already accepts all four via `buildTransferRouteTree({ chipMode })`.
- **D-02:** Toggle-deselect behavior: clicking the active chip again sets chipMode back to `null`. Same pattern as ManualPlanTab's `handleChipToggle`.
- **D-03:** Implementation: replace `const chipMode: PlannerChip = null` (line 90) with `const [chipMode, setChipMode] = useState<PlannerChip>(null)`. Wire `onToggle={(chip) => setChipMode(prev => prev === chip ? null : chip)}` and remove `disabled={true}` from the ChipToggle render (lines 234–239). Pass `activeChip={chipMode}`.

### Transfer Hits Label (POL-02)
- **D-04:** One-liner: change column header from `"Hits"` to `"Transfer Hits"` in RouteTreeTab table (line 269 of `RouteTreeTab.tsx`).

### OCS Table Badge (POL-04)
- **D-05:** Add MinsRiskBadge for the **buy player only** — appended after `StatusLabelBadge` in the existing buy-player badge cluster (`OpportunityCostTable.tsx` around line 142). Sell player already has rejection reasons covering the sell decision; buy player badge cluster is the right location.

### Already-Done Items — Verify Only
- **D-06:** POL-03 (SquadView) — `MinsRiskBadge` already rendered at `SquadView.tsx:224`. Confirm visible in the Transfers tab player rows; no code change needed.
- **D-07:** POL-05 (GemTable) — `mins_risk` column already defined in `createColumns` at `columns.tsx:271–276`. Confirm visible in the default preset; no code change needed.
- **D-08:** POL-06 (PlayerComparisonModal) — `MinsRiskBadge` already in `renderSignalsColumn` at `PlayerComparisonModal.tsx:172`, shown for both compared players. Confirm visible; no code change needed.

### Claude's Discretion
- Exact position of MinsRiskBadge within the buy cluster (before or after StatusLabelBadge) — follow the existing left-to-right signal ordering already established in the cluster.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Targets
- `src/components/planner/RouteTreeTab.tsx` — ChipToggle wiring (POL-01) and label fix (POL-02); `chipMode` hardcoded at line 90, ChipToggle disabled at lines 234–239, label "Hits" at line 269
- `src/components/transfers/OpportunityCostTable.tsx` — buy-player badge cluster at lines 139–142; MinsRiskBadge goes after StatusLabelBadge (POL-04)

### Reference Patterns
- `src/components/planner/ManualPlanTab.tsx` — canonical ChipToggle wiring: `handleChipToggle` at line 191, toggle-deselect pattern
- `src/components/planner/ChipToggle.tsx` — component interface (`activeChip`, `onToggle`, `disabled`)

### Shared Component
- `src/components/shared/MinsRiskBadge.tsx` — the badge to add; accepts `minsRisk: MinsRisk`

### Already-Done Files (verify only)
- `src/components/squad/SquadView.tsx:224` — POL-03 MinsRiskBadge
- `src/components/gem-table/columns.tsx:271–276` — POL-05 mins_risk column in createColumns
- `src/components/gem-table/PlayerComparisonModal.tsx:172` — POL-06 MinsRiskBadge in renderSignalsColumn

### Requirements
- `.planning/REQUIREMENTS.md` — POL-01 through POL-06 requirement text

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChipToggle` — already imported in RouteTreeTab; just needs state wiring and `disabled` removed
- `MinsRiskBadge` — already imported in OpportunityCostTable? Check; if not, add import from `@/components/shared/MinsRiskBadge`
- `useState<PlannerChip>` — PlannerChip type already imported in RouteTreeTab (line 16)

### Established Patterns
- ChipToggle toggle-deselect: `prev === chip ? null : chip` (ManualPlanTab pattern)
- Buy-player badge cluster order in OCS: RotationRiskBadge → StatusLabelBadge → (MinsRiskBadge)
- Column visibility in GemTable: `mins_risk` not in any hidden-columns preset → always visible on desktop

### Integration Points
- `buildTransferRouteTree` already consumes `chipMode` in its options object; no engine changes needed
- `OCSRow.legs[n].buy` carries `ScoredPlayer` which has `mins_risk: MinsRisk` — field already available

</code_context>

<specifics>
## Specific Ideas

- ChipToggle in RouteTreeTab should NOT remain disabled once state is wired — remove `disabled={true}` entirely
- MinsRiskBadge in OCS table: buy cluster only, not the sell-player name span

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 122-Polish Carry-Forwards*
*Context gathered: 2026-05-18*
