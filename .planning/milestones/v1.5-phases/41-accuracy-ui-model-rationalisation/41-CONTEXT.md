# Phase 41: Accuracy UI & Model Rationalisation - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface the Phase 40 backtest data as UI in a new "Accuracy" sub-tab within the Analyse section. Add last-GW actual points column to GemTable. Include a human checkpoint to review live hit-rate data and confirm which model to remove, then cut the loser's column and pipeline code entirely.

No new pipeline computation — `accuracy_backtest.json` is pre-aggregated by Phase 40.

</domain>

<decisions>
## Implementation Decisions

### Accuracy Tab Location

- **D-01:** Add a new **"Accuracy"** sub-tab to the Analyse section (alongside Gem Ratings, Insights, DefCon Analysis, Set Pieces). Mobile label: **"Acc"**.
- **D-02:** Tab is a single scrollable page — no sub-tabs within Accuracy. Three stacked sections: GW summary table → haulter list → player delta table.

### Accuracy UI Layout (ACC-02/03/04)

- **D-03:** **Top section — GW summary table (ACC-02):** 5 rows (one per GW in `gws_covered`). Columns: GW, Haulter Count, xPts Flagged, xPts Hit Rate %, proj_pts Flagged, proj_pts Hit Rate %. Shows overall hit rates from `summary.xpts_hit_rate` and `summary.proj_pts_hit_rate` as a summary row.
- **D-04:** **Middle section — Haulter list (ACC-03):** All haulter entries from `accuracy_backtest.json haulters[]` across the 5 GWs. Shows: Player, GW, Actual Pts, xPts pred, xPts rank, xPts flagged ✓/✗, proj_pts pred, proj_pts rank, proj_pts flagged ✓/✗. Sorted by GW desc, then actual_pts desc.
- **D-05:** **Bottom section — Player delta table (ACC-04):** All `players[].gws[]` entries flattened. Default sort: xPts delta ascending (most negative = biggest over-prediction first, i.e. "worst misses"). Columns: Player, Team, GW, Actual Pts, xPts Pred, xPts Δ, proj_pts Pred, proj_pts Δ. Both models shown side-by-side until rationalisation removes one. Sortable by any column header click.

### Model Rationalisation (ACC-06)

- **D-06:** **Human checkpoint before removal.** Phase 41 Plan 03 (or similar) is `autonomous: false` with a `checkpoint:human-verify` task. Executor displays live hit rates from `accuracy_backtest.json` (overall `xpts_hit_rate` vs `proj_pts_hit_rate` plus per-GW breakdown). User confirms which model to remove. Executor then proceeds with deletion.
- **D-07:** **Removal = full cut:** Delete the loser model's GemTable column from `columns.tsx`, remove its `merged_players.json` field from `merge.py` and related type definitions in `types.ts`, and remove its display from all UI components that reference it. No dead code retained. No feature flag.
- **D-08:** Model winner is determined at execution time from live `accuracy_backtest.json` data — not pre-decided in this context. The checkpoint in D-06 is the decision gate.

### GemTable Actuals Column (ACC-05)

- **D-09:** Add a **"GW{N} Pts"** column to GemTable (dynamic label — GW number from `accuracy_backtest.json gws_covered[0]`). Positioned immediately right of the surviving model's xPts/proj_pts column.
- **D-10:** Column visible in **Default and Analysis presets** only — not Compact. Null/missing entries (players who didn't play that GW or have no backtest entry) show as `—`.
- **D-11:** Data source: `accuracy_backtest.json players[]` keyed by `player_id`. The API route serving this data must join `merged_players.json` with `accuracy_backtest.json` to add `last_gw_actual_pts` to each player row.

### Claude's Discretion

- Ordering of the three Accuracy sections (GW table first, then haulters, then player deltas) — natural narrative flow from aggregate → specific.
- Whether the Accuracy tab shows a loading skeleton or empty state message when `accuracy_backtest.json` is not yet available (e.g., pipeline hasn't run).
- Whether the player delta table is paginated or shows all rows (use existing GemTable patterns for consistency).
- API route structure — whether to add a new `/api/accuracy` route or extend an existing route.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Data
- `pipeline/cache/accuracy_backtest.json` — Phase 40 output. Pre-aggregated D-08 shape. Contains `gws_covered`, `summary`, `haulters[]`, `players[]`.
- `.planning/phases/40-accuracy-pipeline/40-CONTEXT.md` — D-01 through D-12 document the exact shape and field semantics the UI must consume.

### Existing UI Patterns
- `src/app/page.tsx` — Nav structure. `Section` and `SubTab` types, `sections` config array. New 'accuracy' sub-tab wires in here.
- `src/components/gem-table/columns.tsx` — Column definitions. ACC-05 actuals column and ACC-06 loser removal happen here.
- `src/components/gem-table/GwToggle.tsx` — Preset toggle. D-10 requires Default and Analysis presets to show actuals column; Compact does not.
- `src/components/insights/InsightsTab.tsx` — Reference pattern for a data-fetching tab component (fetches JSON, renders tables).
- `src/lib/types.ts` — MergedPlayer type. ACC-06 removal touches this file.

### Requirements
- `.planning/REQUIREMENTS.md` §Projection Accuracy — ACC-02, ACC-03, ACC-04, ACC-05, ACC-06 (all in this phase).

### Pipeline
- `pipeline/merge.py` — Contains the loser model's computation code. ACC-06 removal cuts it here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/gem-table/GemTable.tsx` — Table with sorting, filtering, preset support. Player delta table (ACC-04) should use the same table primitive or GemTable directly if the data shape fits.
- `src/components/insights/InsightsTab.tsx` — Pattern: fetch JSON from `/api/insights`, render with loading/error states. Accuracy tab follows same pattern with `/api/accuracy`.
- Existing badge components (`VerdictBadge`, `DifferentialBadge`) — ✓/✗ flagged indicators in haulter list can use a similar pattern.

### Integration Points
- New API route `/api/accuracy` — serves `accuracy_backtest.json` from Vercel Blob (production) or `pipeline/cache/accuracy_backtest.json` (local). Follows pattern of `/api/defcon`, `/api/insights`.
- `src/app/page.tsx` `sections` array — add `{ id: 'accuracy' as SubTab, label: 'Accuracy', mobileLabel: 'Acc' }` to the `analyse` section's `subTabs`.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-accuracy-ui-model-rationalisation*
*Context gathered: 2026-04-30*
