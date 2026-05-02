# Phase 54: Price Change Predictor - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A new vertical slice delivering daily price rise/fall predictions for all FPL players. Includes:
- `pipeline/price_changes.py` — computes `direction`, `confidence_pct`, `eta_days` from cumulative net-transfer snapshots
- `pipeline/cache/price_changes_snapshot.json` + `pipeline/cache/price_changes.json` — state file and output artifact
- `/api/price-changes` route (USE_BLOB toggle, 30-min cache)
- `usePriceChanges` hook (TanStack Query, 30-min staleTime)
- `PriceChangePanel` — new Analyse sub-tab

**Explicitly out of scope for Phase 54:**
- 5th card in `DecisionSummaryTab` (squad-owned price impact) — deferred
- Writing `predicted_rise`/`predicted_fall` onto `MergedPlayer` — deferred to v1.8.1
- Per-club rotation priors or ML model training

</domain>

<decisions>
## Implementation Decisions

### UI Placement
- **D-01:** `PriceChangePanel` ships as a new sub-tab under the **Analyse** section only. No change to `DecisionSummaryTab` in this phase. Add `'price-changes'` to the `SubTab` union, `SECTIONS` constant, and corresponding render in `page.tsx`.

### Progress Indicator
- **D-02:** The "progress indicator" from the ROADMAP goal is a **mini progress bar per player row**, visually filling left-to-right as cumulative net transfers accumulate toward the price-change threshold. Conveys "how close" at a glance without requiring the user to parse numbers.

### Prediction Algorithm
- **D-03:** Threshold-based approach modelling FPL's actual price-change rule:
  - `confidence_pct = clamp(cumulative_net_transfers / threshold, 0.0, 1.0) × 100`
  - `threshold` ≈ FPL's rule: roughly 1000 net transfers per 1% ownership (i.e., `threshold = selected_by_percent × 10` — this approximation can be tuned after initial shadow run)
  - `eta_days` derived from daily net-transfer velocity: `eta_days = max(0, threshold - cumulative_net) / avg_daily_net_velocity`
  - Snapshot delta = `transfers_in_event - transfers_out_event` accumulated across days since last price change
  - `direction` is `'rise'` when cumulative_net > 0 and confidence_pct ≥ some minimum, `'fall'` when cumulative_net < 0, `'stable'` otherwise

### Panel Layout
- **D-04:** Direction-first layout in `PriceChangePanel`:
  - Section 1: "Predicted to rise" — rows sorted by `confidence_pct` descending
  - Section 2: "Predicted to fall" — rows sorted by `confidence_pct` descending
  - Stable players omitted (not shown unless user explicitly wants them)
  - Each row: player name, team, `now_cost`, mini progress bar, `confidence_pct` label (HIGH ≥ 70%, MEDIUM 40–69%, LOW < 40%), `eta_days` text

### Cold-Start / Early Data
- **D-05:** `price_changes.json` is seeded to `{ predictions: [] }` on cold start so `/api/price-changes` never 500s on fresh checkout (ROADMAP SC-5 locked).
- **D-06:** "Early data" flag shown until ≥14 days of snapshots are available (ROADMAP SC-4 locked). Confidence badges (HIGH/MEDIUM/LOW) suppressed below 70% precision threshold — until enough snapshot history exists to validate, show raw confidence_pct without tier labels.

### Claude's Discretion
- Exact FPL threshold formula to use until calibration data is available — Claude's choice; the `selected_by_percent × 10` approximation is a starting point
- Whether `stable` players get a collapsed/hidden section vs. full omission
- Panel mobile layout: stacked rows same as InsightsTab pattern
- Internal naming of snapshot helper functions within `price_changes.py`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Roadmap and Requirements
- `.planning/ROADMAP.md` §"Phase 54: Price Change Predictor" — Goal, success criteria SC-1 through SC-5, depends-on notes
- `.planning/notes/feature-backlog.md` §"PRC-01: Price Change Predictor" — original scope definition, output fields, data source notes

### Pre-Research (MUST read — architecture decisions already made)
- `.planning/research/ARCHITECTURE.md` §"PRC-01 — Price Change Predictor" (lines 145–190) — file list (new + modified), data flow diagram, critical decision on MergedPlayer fields (NO for v1.8), recommended build order

### Template Files (MUST read and clone for new files)
- `src/app/api/set-pieces/route.ts` — USE_BLOB toggle template; clone for `/api/price-changes/route.ts` (change `s-maxage` to 1800 for 30-min cache instead of 3600)
- `src/lib/hooks/useSetPieces.ts` — hook template; clone for `usePriceChanges.ts` with `staleTime: 30 * 60 * 1000`

### Pipeline (MUST read — snapshot/diff pattern to replicate)
- `pipeline/run.py` — after set-piece snapshot block (~line 215), add price_changes block; gate pattern reference for `form_signal_enabled` (lines 172–183)
- `pipeline/insights.py` — reference for pipeline module structure (alternatively `pipeline/defcon.py` for a simpler module shape)

### Navigation Structure (MUST read before modifying page.tsx)
- `src/app/page.tsx` — `SubTab` union, `SECTIONS` constant; add `'price-changes'` as a sub-tab under the `'analyse'` section

### Existing Component Analogs (read to understand reuse patterns)
- `src/components/insights/InsightsTab.tsx` — existing Analyse sub-tab; closest analog for layout, data loading pattern, and severity badge usage
- `src/components/set-pieces/SetPieceTakerPanel.tsx` — another Analyse sub-tab; reference for the hook → component wiring pattern
- `src/components/shared/` — shared badge and utility components; reuse severity badge styling (HIGH=red, MEDIUM=amber, LOW=zinc per Phase 51 D-13)

### TypeScript Types
- `src/lib/types.ts` — add `PriceChangePrediction` and `PriceChanges` types mirroring the JSON shape

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/set-pieces/route.ts`: direct clone template for the new route — USE_BLOB toggle, error handling, cache headers. Change filename from `set_piece_changes.json` to `price_changes.json` and set `s-maxage=1800`.
- `src/lib/hooks/useSetPieces.ts`: direct clone template for `usePriceChanges.ts`. Drop staleTime from 6h to 30 min.
- Severity badge components in `src/components/shared/` — already use HIGH=red, MEDIUM=amber, LOW=zinc. Reuse directly for confidence tier labels.

### Established Patterns
- Snapshot-diff pattern: `_extract_sp_snapshot` / `_diff_sp_snapshots` in `pipeline/set_pieces.py` (or similar) — replicate for price changes. Read prev snapshot → diff → write new snapshot + output artifact.
- `pipeline/run.py` save() helper: already used for writing pipeline/cache/*.json files. Price changes module should use the same `save()` call.
- New Analyse sub-tabs are rendered as inline conditionals in `page.tsx` (not separate files): `activeSection === 'analyse' && activeSubTab === 'price-changes' && <PriceChangePanel />`
- `'use client'` on all component files; no `'use client'` in lib files.
- TanStack Query hooks: single string key, `staleTime` in ms, no manual refetch needed.

### Integration Points
- `page.tsx` SECTIONS constant: add `{ id: 'price-changes' as SubTab, label: 'Price Changes', mobileLabel: 'Prices' }` to the `analyse` section's `subTabs` array.
- `SubTab` union type: add `'price-changes'`.
- `pipeline/run.py`: add price-changes block after the set-piece block — read prev snapshot, call `compute_price_change_predictions()`, save both output files.
- `pipeline/cache/price_changes.json`: seed file needed for cold-start (SC-5). Add to `pipeline/cache/` as `{ "predictions": [] }`.

</code_context>

<specifics>
## Specific Ideas

- Progress bar should fill proportionally to `confidence_pct` (0–100%), not eta_days. A player at 84% confidence shows a nearly-full bar; a player at 30% shows a shallow fill. The bar width IS the `confidence_pct`.
- Direction layout previewed during discussion: rise section first (actionable FOMO), fall section second (sell-before-drop). Within each section: highest confidence at top.
- FPL price change threshold approximation: `threshold ≈ selected_by_percent × 10`. This is a known FPL community approximation (e.g., a 10% owned player needs ~100 net transfers to trigger a rise). Can be adjusted after shadow-running against historical data.
- `eta_days` of 0 or < 0 → show "Tonight" label instead of a day count.

</specifics>

<deferred>
## Deferred Ideas

- **DecisionSummaryTab 5th card** ("Price changes affecting your squad"): highest-value integration point per ARCHITECTURE.md, filtered to owned players. Deferred to v1.8.1 — standalone panel ships first to prove the model.
- **`predicted_rise`/`predicted_fall` fields on `MergedPlayer`**: enables `PriceTrendCell` in GemTable. Deferred to v1.8.1 per ARCHITECTURE.md recommendation — no MergedPlayer schema bloat until standalone panel validates the data.
- **Precision tracking**: SC-4 references a 70% precision threshold for badge suppression. How precision is measured (ground truth comparison at midnight) is not specified — deferred to a follow-up calibration phase.

</deferred>

---

*Phase: 54-price-change-predictor*
*Context gathered: 2026-05-02*
