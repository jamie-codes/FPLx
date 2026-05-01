# Phase 30: Differential Tracker - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the pipeline to classify each player as `differential`, `trap`, or neither using position-relative xPts median (from Phase 28) and fixed FPL ownership thresholds, then surface a sortable "Diff" column in GemTable alongside the existing Signal column. No new tabs or panels. Unavailable players (injured/suspended) are excluded from differential flagging. All computation happens in the pipeline — the UI reads pre-classified fields only.

</domain>

<decisions>
## Implementation Decisions

### Threshold Logic (TMPL-01, TMPL-02)

- **D-01:** **xPts threshold: position-relative median.** `merge.py` computes the median `xPts_1gw` per position group (element_type: 1=GK, 2=DEF, 3=MID, 4=FWD) across all available players. A player's xPts is classified "above average" if it exceeds their position group's median. This avoids the systematic bias of a global median (where all DEFs would appear below average).
- **D-02:** **Ownership threshold: fixed cutoffs.** `<5%` ownership = low (differential territory); `>15%` ownership = high (template territory). These are standard FPL community conventions. `selected_by_percent` is a string in the API — use `parseFloat()` before comparison.
- **D-03:** **Combined gate for DIFFERENTIAL flag (TMPL-01):** `xPts_1gw > position_median AND parseFloat(selected_by_percent) < 5 AND status == 'a'`. All three conditions must hold.
- **D-04:** **Combined gate for TEMPLATE-TRAP flag (TMPL-02):** `xPts_1gw < position_median AND parseFloat(selected_by_percent) > 15`. Status exclusion does NOT apply to TRAP — an injured template player is still a trap to hold if their xPts is below the position median.
- **D-05:** **Computed in pipeline.** `merge.py` pre-classifies each player and writes `differential_flag: 'diff' | 'trap' | None`. UI reads the pre-computed value — no client-side median computation.

### Flag Display (TMPL-01, TMPL-02)

- **D-06:** **Single "Diff" column in GemTable.** Follows the Signal column pattern from Phase 29 exactly: new `col.accessor('differential_flag', ...)` in `columns.tsx`, `DifferentialBadge` component using the same `text-xs font-normal rounded px-2 py-1` envelope.
- **D-07:** **DIFF = green pill, TRAP = amber pill, neither = em-dash.** Consistent with BUY/SELL color convention from Phase 29.
- **D-08:** **Sortable: ascending = DIFF first.** Sort order map: `{ diff: 0, trap: 2 }`, null = 1. Matches Signal column convention (BUY=0, null=1, SELL=2).
- **D-09:** **Column hidden on portrait mobile, visible on landscape and desktop.** Add `differential_flag: false` to `MOBILE_HIDDEN_COLUMNS` in `GwToggle.tsx` and `differential_flag: 'Diff'` to `HIDDEN_COLUMN_LABELS` in `GemTable.tsx`. Same two-map pattern as Signal column.

### Tooltip Content

- **D-10:** **Quantitative + actionable tooltip.** DIFF: `"Differential: {x}% owned, above-average xPts for position. Low ownership = rank gain potential."`. TRAP: `"Template trap: {x}% owned, below-average xPts for position. High ownership with weak projections."`. Render `{x}` from `actual_vs_diff_ownership` (or pass ownership directly as a prop to the badge component).

### Ownership Data Source

- **D-11:** Use `selected_by_percent` (FPL overall %, already in `MergedPlayer`). No new pipeline data source needed. This is the EO proxy per STATE.md — no official top-10k API exists.
- **D-12:** Unavailable players (status `'d'`, `'i'`, `'s'`, `'u'`, `'n'`) are **excluded from DIFFERENTIAL** flagging. An injured 3%-owned player is not a buy signal. They remain eligible for TRAP flagging (holding an injured template player is still a risk).

### Claude's Discretion

- **Column position:** Claude decides where "Diff" sits relative to "Signal" — suggest: after Signal, before Trend (same neighbourhood of forward-looking intelligence columns).
- **Field name:** `differential_flag: 'diff' | 'trap' | None` in Python dict; `differential_flag?: 'diff' | 'trap' | null` in TypeScript.
- **Ownership prop:** Badge component receives `ownership: number` prop (after parseFloat) so it can render the actual % in the tooltip. Pipeline stores the pre-classified flag only; badge reads `selected_by_percent` from the row original for the tooltip.
- **Position median storage:** Claude decides whether medians are stored as a metadata object in `merged_players.json` (for auditability) or computed locally inside `merge.py` without persisting. Either is fine — the flag is the only output the UI needs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline — patterns to follow
- `pipeline/merge.py` — `_compute_regression_signal()` (lines 331–380) for the helper-before-merge_players() placement convention. New `_compute_differential_flag()` follows identical structure. `merge_players()` result dict (lines 743–760 area) for where the new field attaches.
- `pipeline/merge.py` — `merge_players()` signature: `summaries` dict access pattern for reading per-player data already in the function scope.

### TypeScript Types
- `src/lib/types.ts` — `MergedPlayer` interface (lines 155–162 area). `regression_signal` and `actual_vs_xg_delta` fields are the direct neighbors — `differential_flag` appends after them. Follow same `?: 'value' | null` optional pattern.

### UI — GemTable patterns
- `src/components/gem-table/columns.tsx` — Signal column definition (lines 160–175) is the exact template to replicate for Diff column.
- `src/components/gem-table/RegressionSignalBadge.tsx` — badge component to replicate for `DifferentialBadge.tsx` (same visual envelope, same `'use client'` directive, same null/undefined = em-dash pattern).
- `src/components/gem-table/GwToggle.tsx` — `MOBILE_HIDDEN_COLUMNS` map (add `differential_flag: false` after `signal: false`).
- `src/components/gem-table/GemTable.tsx` — `HIDDEN_COLUMN_LABELS` map (add `differential_flag: 'Diff'` after `signal: 'Signal'`).

### Requirements
- `.planning/REQUIREMENTS.md` — TMPL-01 (differential flag), TMPL-02 (template-trap flag).
- `.planning/ROADMAP.md` — Phase 30 success criteria (2 items).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RegressionSignalBadge.tsx` — direct template for `DifferentialBadge.tsx`. Copy structure, change colors/text/props.
- `_compute_regression_signal()` in `pipeline/merge.py` — helper placement and return-tuple pattern. `_compute_differential_flag()` follows the same before-merge_players() convention.
- `columns.tsx` Signal column definition — copy and adapt for Diff column (accessor, header H(), cell renderer, sortingFn with order map).
- `selected_by_percent` — already on `MergedPlayer` as a string; `parseFloat()` required before comparison.
- `xPts_1gw` — available on every player from Phase 28; position_median computed from `element_type` field (also already on MergedPlayer).

### Established Patterns
- Badge component: `'use client'` first line, `export function XxxBadge({ ... })`, null/undefined returns `<span className="text-zinc-400">&#8212;</span>`.
- Two-map column visibility: `MOBILE_HIDDEN_COLUMNS` in GwToggle.tsx + `HIDDEN_COLUMN_LABELS` in GemTable.tsx.
- sortingFn order map: `{ diff: 0, trap: 2 }` with `?? 1` for null/neutral.

### Integration Points
- `merge_players()` gains `differential_flag: 'diff' | 'trap' | None` — absent when unavailable player excluded from DIFF + neither condition met.
- `MergedPlayer` TypeScript interface gains `differential_flag?: 'diff' | 'trap' | null`.
- `columns.tsx` gains one new column accessor.
- GwToggle.tsx and GemTable.tsx each gain one entry in their visibility maps.

</code_context>

<specifics>
## Specific Ideas

- Exclusion rule for injured players is asymmetric: injury excludes from DIFF only (not TRAP). This is intentional — an injured player below-median xPts and >15% owned is still a "trap to sell" signal even if they're unavailable.
- The position-relative median removes the need for any position-specific fixed thresholds — one consistent logic for all four positions.
- Ownership thresholds (5% / 15%) are stable FPL conventions and should not change between seasons without explicit discussion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 30-Differential Tracker*
*Context gathered: 2026-04-28*
