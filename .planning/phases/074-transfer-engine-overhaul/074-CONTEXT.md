# Phase 74: Transfer Engine Overhaul - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 74 fixes and extends the `suggestTransfers()` engine (`src/lib/suggest-transfers.ts`) and the Transfer Opportunity Cost section in `TransferPanel` to:
1. Enforce the FPL 3-player-per-team cap in the buy candidate pool (TFX-01)
2. Prevent duplicate player moves across the multi-transfer combo (TFX-02)
3. Show all four cost scenarios simultaneously without a toggle: Roll / 1FT / 2FT / −4 Hit / −8 Hit (TFX-03)
4. Display remaining bank balance per scenario with affordability indicators (TFX-04)
5. Auto-populate bank from FPL (authenticated) or manual entry (unauthenticated) (TFX-05)

The older "Suggested Transfers" section (`computeTransferSuggestions` from `transfer-engine.ts`) is **removed entirely** from `TransferPanel`. No changes to `transfer-engine.ts` itself.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** OCS section only — `suggestTransfers()` in `src/lib/suggest-transfers.ts` and `src/lib/opportunity-cost.ts` + `src/components/transfers/OpportunityCostTable.tsx` are the targets. `src/lib/transfer-engine.ts` is NOT modified.
- **D-02:** The older "Suggested Transfers" section (rendered via `computeTransferSuggestions`) is removed entirely from `TransferPanel.tsx`. This eliminates two parallel transfer views and reduces visual clutter.

### Four-Scenario Display
- **D-03:** Remove the `FtToggle` from the OCS section header. The engine always computes all four scenario rows regardless of FT count. No toggle = no switching = all scenarios visible simultaneously (TFX-03).
- **D-04:** The `GwToggle` (1/3/5 GW horizon) stays in the OCS section header, same position as now. Only the FtToggle is removed.
- **D-05:** Unaffordable scenario rows are **shown-but-disabled** (visually greyed out/struck through) with a reason label (e.g. "Over budget by £0.5m"). They are NOT silently hidden. This satisfies TFX-04's "visually disabled rather than silently excluded" requirement.

### −8 Hit Modeling
- **D-06:** The engine always generates `cost: 8` combo suggestions — the −8 Hit row is always present, possibly shown-disabled if unaffordable. No conditional gating on FT count.
- **D-07:** The −8 Hit row reuses the same 2-transfer combo enumeration as the 2FT row. The best player pair is identical; only the cost label differs (`cost: 0` for 2FT row, `cost: 8` for −8 Hit row). `xPtsGainNet = xPtsGain − 8` for break-even math on the hit row.
- **D-08:** The user's actual FT count is derived from the existing `derivedFtCount` logic already in `TransferPanel` (authenticated: from `myTeamData.entry_history.event_transfers`; unauthenticated: defaults to 1). This is passed to the engine for correct row labeling (e.g. if `derivedFtCount = 2`, using 1 transfer is FREE — the "1FT" row shows cost:0, not cost:4).

### Bank Balance UX
- **D-09:** The manual bank balance input lives in the **"Load Your Squad" form** (same card as the Team ID and FT count inputs). Same form zone, same pattern — user fills it once when loading their squad.
- **D-10:** When **authenticated**, the bank balance field is **pre-populated from FPL sell prices** but **remains editable** (override mode). Useful when sell prices haven't updated or user is planning ahead.
- **D-11:** When **unauthenticated**, the field starts empty (or 0) and the user types their bank balance. No prefill available without FPL auth.
- **D-12:** Input accepts a **£m decimal** value (e.g. `2.5`), labelled with a `£m` suffix. Internally multiplied by 10 to convert to tenths before passing to the engine. Matches how FPL displays the bank to users.

### Claude's Discretion
- Row ordering in the OCS table (Roll / 1FT / 2FT / −4 Hit / −8 Hit)
- Visual treatment for disabled rows (opacity, strikethrough, "Over budget" badge colour)
- Break-even display on hit rows (how to show negative net gain when the hit isn't worth it)
- State management for the bank balance override field (useState local vs lifted)
- Whether `ocsFtCount` state remains (may no longer be needed if FtToggle is removed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` §Phase 74 — Goal, success criteria, TFX-01..TFX-05 requirement mapping
- `.planning/REQUIREMENTS.md` §Transfer Engine Fixes & Enhancements (TFX) — full requirement text for TFX-01..TFX-05

### Engine Files (primary targets)
- `src/lib/suggest-transfers.ts` — `suggestTransfers()` engine; add team cap (TFX-01), -8 hit combos (D-06/D-07)
- `src/lib/opportunity-cost.ts` — `computeOpportunityCostRows()`; add −8 Hit row + bank balance fields (TFX-04)
- `src/lib/suggest-transfers.test.ts` — existing Vitest tests; extend for new engine behaviour

### UI Files
- `src/components/transfers/TransferPanel.tsx` — remove FtToggle, remove old "Suggested Transfers" section, add bank balance field in Load Squad form
- `src/components/transfers/OpportunityCostTable.tsx` — update to render 5 rows (Roll + 4 scenarios), show disabled state with reason label

### Reference Patterns
- `src/components/optimiser/FtToggle.tsx` — existing FtToggle component; will be removed from TransferPanel (check for other usages before deleting)
- `src/components/gem-table/GwToggle.tsx` — GwToggle stays in OCS section header (reference pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FtToggle` — currently in OCS section header; will be removed. Check `OptimiserPanel` for other usages before deleting the component file.
- `GwToggle` — stays in the OCS header; no changes needed.
- `HighOwnershipCallout` — stays as-is; positioned above OCS section.
- `exactSellPrices` (Map<id, selling_price>) — already computed from `myTeamData` when authenticated; used for `sellValueFor()` in the engine.
- `derivedFtCount` (1|2) — already computed in TransferPanel from `myTeamData.entry_history.event_transfers`; pass to engine for label correctness.

### Established Patterns
- `suggestTransfers()` is a pure function with no React dependency — all engine fixes go into `suggest-transfers.ts` directly.
- `computeOpportunityCostRows()` is also a pure mapping function (no React) — importable in Vitest node tests.
- Engine complexity: 1-FT is ~450 pairs; 2-FT is ~94,500 combos worst case. The −8 hit row reuses the same 2-FT combos — no additional enumeration cost.
- `MergedPlayer` has `team_id: number` — already available for the 3-per-team cap filter (TFX-01).
- Bank is stored in tenths of £1m throughout (`now_cost`, `selling_price`, `entry_history.bank`). Manual bank input converts £m decimal × 10.

### Integration Points
- `TransferPanel` prop interface unchanged — `teamId`, `onTeamIdChange`, `submittedId`, `onSubmit` stay.
- `bank` currently sourced from `squadData.entry_history.bank`; Phase 74 adds a local `manualBank` state that overrides this. When authenticated, pre-filled with derived bank; always editable.
- `ocsFtCount` state in TransferPanel currently driven by FtToggle. After FtToggle removal, replaced by `derivedFtCount` passed directly to the engine.

</code_context>

<specifics>
## Specific Ideas

No specific UI references cited — standard app patterns apply (existing badge/disabled styles, zinc/red colour tokens already used in the panel).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 74-Transfer Engine Overhaul*
*Context gathered: 2026-05-06*
