# Phase 29: Regression Detector - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the pipeline to fetch per-player per-match xG/xA from Understat using the soccerdata library, compute a regression signal (actual G+A vs xG+xA over the last 5 GW), and surface BUY/SELL badges in a dedicated sortable Signal column in GemTable. No new tabs or panels — signals live in the existing main table. Players below 900 minutes played over the window are excluded.

</domain>

<decisions>
## Implementation Decisions

### Per-match data fetch (DATA-03)

- **D-01:** Use the **soccerdata library** to fetch per-player per-match xG/xA from Understat. soccerdata is already listed in the tech stack (requirements: `pipeline/requirements.txt` or `pyproject.toml`); this avoids building a bespoke 782-player scraper loop.
- **D-02:** Pipeline writes per-match data to a **separate intermediate cache file** (e.g., `pipeline/cache/understat_per_match.json`). `merge.py` reads the cache, computes the regression signal fields, and attaches them to each player in `merged_players.json`. The UI only sees the pre-computed signal (`regression_signal`, `actual_vs_xg_delta`) — no raw per-match rows in `merged_players.json`.
- **D-03:** If the per-match fetch fails (soccerdata error, network outage, Understat down), the pipeline **skips regression signal fields gracefully** and does not hard-fail. Players will have no `regression_signal` field; the UI renders `—` in the Signal column. Consistent with existing `understat_client.py` fallback pattern.

### Signal display location (REG-01, REG-02)

- **D-04:** BUY signal is a **green pill badge** labeled "BUY"; SELL signal is an **amber pill badge** labeled "SELL". Follows the `VarianceBadge` / `MinsRiskBadge` visual envelope (text-xs, rounded, px-2 py-1).
- **D-05:** Signals appear in a **dedicated "Signal" column** in GemTable — narrow, sortable. User can sort ascending/descending to surface all buy or sell candidates at once.
- **D-06:** Signal column follows the **landscape-aware responsive visibility** pattern: hidden on mobile portrait, visible on landscape and desktop. User turns phone sideways to see the column. Consistent with the landscape tip UX from Phase 26.

### GW window & threshold

- **D-07:** Fixed **5 GW lookback window**. No toggle. Captures recent form without being too slow to react.
- **D-08:** Fixed **absolute threshold: ±0.5 xG+xA per match**. A player whose average (actual G+A) per match is more than 0.5 below their average (xG+xA) per match over the last 5 GW gets a BUY signal. Reverse for SELL.
- **D-09:** **Combined signal**: `delta = mean(actual_goals + actual_assists) − mean(xG + xA)` per match, averaged over the 5-GW window. One number, one signal. If `delta < −0.5` → BUY (underperforming luck). If `delta > +0.5` → SELL (overperforming luck). Otherwise → no signal.
- **D-10:** **Minimum 900 minutes** played over the 5-GW window (per REG-01/REG-02 requirements). Players below this gate are excluded from signal computation and show `—` in the Signal column.

### Claude's Discretion

- **Tooltip content**: Claude decides the hover/tap tooltip text explaining the signal (e.g., "Underperforming xG+xA over last 5 GW — may regress upward. Consider buying."). Use `title` attribute, matching project tooltip pattern (no Radix).
- **Column position**: Claude decides where Signal sits in GemTable column order (suggest: after xPts, before Fixture Badges — near forward-looking data).
- **soccerdata cache TTL**: Claude decides the cache lifetime for per-match data (suggest: 24h, matching existing `understat_current.json` TTL).
- **Pipeline module location**: Claude decides whether per-match fetch lives in a new `understat_per_match_client.py` or extends the existing `understat_client.py`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline — existing patterns to follow
- `pipeline/understat_client.py` — existing direct-HTTP scraper (season aggregates). Per-match module follows same caching/fallback pattern. Note: per-match uses soccerdata, not direct HTTP.
- `pipeline/merge.py` — `merge_players()` result dict structure (lines ~460–475). New `regression_signal` and `actual_vs_xg_delta` fields slot in at the same point as `xPts_*` fields from Phase 28. Follow same `?: number` optional pattern.
- `pipeline/run.py` — pipeline entry point showing how `merge_players()` is called and how outputs are written to Blob/local.

### TypeScript types
- `src/lib/types.ts` — `MergedPlayer` interface (~line 90–165). New optional fields: `regression_signal?: 'buy' | 'sell' | null`, `actual_vs_xg_delta?: number | null`. Follow existing `?: number` optional convention.

### UI — GemTable patterns
- `src/components/gem-table/columns.tsx` — column definitions. Signal column follows same `col.accessor(...)` pattern. For mobile/landscape visibility, check how existing columns use TanStack `columnVisibility`.
- `src/components/gem-table/VarianceBadge.tsx` — established badge visual envelope to match (text-xs, font-normal, rounded, px-2 py-1, bg-color/dark variant, title tooltip).
- `src/components/shared/MinsRiskBadge.tsx` — another badge pattern reference for BUY/SELL pill styling.
- `src/components/gem-table/GwToggle.tsx` — note: no new toggle needed for Phase 29. Signal column does NOT hook into the GW toggle.

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-03 (per-match pipeline), REG-01 (buy signal), REG-02 (sell signal).
- `.planning/ROADMAP.md` — Phase 29 success criteria (3 items).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VarianceBadge` component pattern — BUY/SELL badges should use the same visual envelope: `text-xs font-normal rounded px-2 py-1` with colour variants and `title` tooltip. Create a parallel `RegressionSignalBadge` component following this pattern.
- `understat_client.py` cache pattern — `_is_cache_fresh()` / `_load_cache()` / `_write_cache()` trio. Per-match client follows identical structure with its own cache path.
- `merge_players()` result dict — new `regression_signal` and `actual_vs_xg_delta` fields attach at the same point as `xPts_1gw` (around line 468). If per-match fetch failed/skipped, both fields are omitted (undefined in JSON) rather than null-filled.
- Mobile column visibility — existing `columnVisibility` state in GemTable hides columns at breakpoints. Signal column uses the same `sm:hidden` / responsive breakpoint approach to be invisible on portrait mobile.

### Established Patterns
- Optional field rollout: new pipeline fields are `?: number | null` in TypeScript until stable. Follow the `xPts_1gw?: number` pattern from Phase 28.
- Fallback rendering: when a field is absent/null, render `—` (em-dash), not 0 or empty. Pattern used in xG/xA display throughout GemTable.
- Separate pipeline JSON file for intermediate data (e.g., `pipeline/cache/defcon_stats.json`, `set_piece_changes.json`). Per-match xG data follows the same cached-intermediate pattern.

### Integration Points
- `merge_players()` result dict → gains `regression_signal` (`'buy' | 'sell' | None`) and `actual_vs_xg_delta` (float, signed).
- `MergedPlayer` TypeScript interface → gains the two fields above (optional).
- GemTable `columns.tsx` → new `Signal` column definition with `RegressionSignalBadge` cell renderer.
- `merged_players.json` size — currently ~300KB; two scalar fields per player adds negligible weight.

</code_context>

<specifics>
## Specific Ideas

- Mobile visibility: user explicitly wants the Signal column hidden on portrait mobile and visible when the phone is rotated to landscape. Match this with the existing `columnVisibility` / responsive breakpoint pattern.
- Signal threshold is auditable and fixed (±0.5 per match, 5 GW window, 900-min gate) — not dynamic. This keeps the signal stable and explainable.
- Combined G+A vs xG+xA (not goals-only or assists-only) — FPL managers think in "goal involvements", so the combined signal maps directly to how they evaluate players.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 29-Regression Detector*
*Context gathered: 2026-04-28*
