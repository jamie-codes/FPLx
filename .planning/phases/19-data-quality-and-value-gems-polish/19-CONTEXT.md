# Phase 19: Data Quality and Value Gems Polish - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three silent data quality gaps and surface recent form points in the Value Gems table:
1. Players missing Understat xG/xA now get a Gem score using FPL goals/assists as proxy (not excluded)
2. DefCon table only shows players with enough match history to produce meaningful stats
3. Value Gems table shows Total Pts, Pts (last 5 GW), and Pts (last 3 GW) columns

New capabilities (auth UX, planner) belong in later phases.

</domain>

<decisions>
## Implementation Decisions

### DQ-01: xG/xA Proxy Formula

- **D-01:** For unmatched players (null Understat data), use `goals_scored / total_minutes * 90` as `xg_per90` proxy and `assists / total_minutes * 90` as `xa_per90` proxy. Computed in `merge.py` — these fields already exist in `MergedPlayer`.
- **D-02:** GKs with 0 goals get `xg_per90 = 0` (same as their real xG would be). No position-based special-casing needed.
- **D-03:** No UI indicator that a player's Gem score uses proxy data — the score just improves silently. Claude's discretion on whether to display a proxy badge.

### DQ-02: DefCon Minimum Games Threshold

- **D-04:** A player must have `games_played >= 5` to appear in the DefCon table at all. Raise from the current `games_played > 0` bar.
- **D-05:** The fixture correlation `insufficient_data` check (< 5 games per easy/hard bucket) is unchanged — it only affects the correlation sub-section, not the main row.

### VG-01: Historical Points Data Path

- **D-06:** `pts_last3gw` and `pts_last5gw` are added to `merged_players.json` alongside the existing `total_points` field. No separate blob or new API route needed.
- **D-07:** `run.py` already fetches element-summary for all players with `starts > 0`. Pass `summaries` into `merge.py` (same pattern as defcon/xmins).
- **D-08:** When a player has fewer GWs of history than the window (e.g. 2 of 3), use the partial sum — not null. These fields are always numbers, never null.

### VG-02: Points Columns in ValueGemsTable

- **D-09:** Remove the current `Pts` column and replace with three columns in sequence: `Total Pts`, `Pts L5`, `Pts L3`. The old `Pts` column becomes `Total Pts` (same data, new header).
- **D-10:** On mobile, hide `Pts L5` and `Pts L3` via `columnVisibility` to keep the table manageable (same pattern as MOB-TBL-04 in v1.2).
- **D-11:** When a pts window is partial (player has fewer GWs than the window size), show an asterisk (*) on the value — e.g. `12*`. A tooltip or footnote can clarify "partial window". Claude's discretion on tooltip implementation.

### Claude's Discretion

- Proxy badge on Gem score display: Claude decides whether to show a small indicator
- Tooltip implementation for partial pts asterisk: style and placement
- Whether `pts_last3gw` / `pts_last5gw` are included as `MergedPlayer` type fields or added to a sub-type

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline
- `pipeline/merge.py` — player merging, xG/xA assignment, output schema for merged_players.json
- `pipeline/defcon.py` — DefCon computation, current threshold logic, fixture correlation
- `pipeline/run.py` — element-summary fetching pattern (shared summaries cache); how to pass summaries to merge.py

### Types and Scoring
- `src/lib/types.ts` — `MergedPlayer` and `ScoredPlayer` interfaces; `goals_scored`, `assists`, `total_points` fields
- `src/lib/gem-score.ts` — `computeAllGemScores`; current null-skip logic for xg_per90/xa_per90 (lines 78–88)

### UI
- `src/components/value-gems/ValueGemsTable.tsx` — table component; columnVisibility pattern for mobile
- `src/components/value-gems/columns.tsx` — column definitions; where to add/replace the pts columns

### Requirements
- `.planning/REQUIREMENTS.md` — DQ-01, DQ-02, VG-01, VG-02 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `summaries` dict in `run.py` (line 66): already fetches element-summary for all `starts > 0` players — pass into `merge_players()` unchanged
- `columnVisibility` pattern in ValueGemsTable: already used for mobile column hiding — apply same to Pts L5/L3
- `MergedPlayer.goals_scored` and `MergedPlayer.assists` (types.ts line 181): already present, no pipeline changes needed to expose them

### Established Patterns
- Null guard: `?? 0` pattern used for `cost_change_event/start` — use same for partial pts if needed
- em-dash for null: existing convention in GemTable cells — apply if ever adding proxy badge display
- `DEFCON_THRESHOLD` dict in defcon.py: keyed by `element_type` (2=DEF, 3=MID, 4=FWD)

### Integration Points
- `merge_players()` in merge.py: add `summaries` parameter and compute pts_last3gw/pts_last5gw from `summaries[element['id']]['history']`
- `compute_defcon_stats()` in defcon.py: change `if games_played == 0: continue` to `if games_played < 5: continue`
- `computeAllGemScores()` in gem-score.ts: replace the null-skip block with proxy computation using `goals_scored`/`assists`/`minutes` fields

</code_context>

<specifics>
## Specific Ideas

- Partial pts asterisk: show `12*` in the cell with a tooltip clarifying "N of M gameweeks". Style TBD by Claude.
- DefCon threshold: raise from `games_played > 0` to `games_played >= 5`. No UI-side change needed — the backend just won't emit those rows.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-data-quality-and-value-gems-polish*
*Context gathered: 2026-04-02*
