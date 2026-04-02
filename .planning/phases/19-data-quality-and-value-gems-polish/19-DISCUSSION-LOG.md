# Phase 19: Data Quality and Value Gems Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 19-data-quality-and-value-gems-polish
**Areas discussed:** xG proxy formula, DefCon minimum games threshold, pts history data path, points columns layout

---

## xG Proxy Formula

| Option | Description | Selected |
|--------|-------------|----------|
| goals→xG, assists→xA per 90 | goals_scored / total_minutes * 90 as xg_per90; assists / total_minutes * 90 as xa_per90. Direct and position-appropriate. | ✓ |
| goals+assists combined → both dims | (goals_scored + assists) / total_minutes * 90 applied to both dimensions. Simpler but conflates signals. | |
| Skip both xG/xA dims for proxied players | Keep current null-skip behaviour; fix display only. No score improvement for unmatched players. | |

**User's choice:** goals→xG, assists→xA per 90
**Notes:** GKs with 0 goals get xg_per90 = 0. No UI proxy badge required (Claude's discretion).

---

## DefCon Minimum Games Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 5 games | Aligns with fixture-correlation bucket threshold. Removes players with 1–4 appearances. | ✓ |
| 3 games | Lower bar — more inclusive but some hit rates will be noisy (e.g. 1/3 = 33%). | |
| 10 games | Strict — excludes January signings and promoted-team players for most of the season. | |

**User's choice:** 5 games
**Notes:** Only the main row filter changes (games_played >= 5). Fixture correlation insufficient_data check (< 5 per bucket) is unchanged.

---

## pts_last3gw / pts_last5gw Data Path

| Option | Description | Selected |
|--------|-------------|----------|
| merged_players.json, null when insufficient | Add to main blob; null when < 3 or 5 GWs available. Consistent with xG/xA null pattern. | |
| merged_players.json, partial sum when insufficient | Same placement; use available GWs rather than null. Always a number. | ✓ |
| Separate blob (pts_history.json) | Isolated; requires new API route and hook. More complexity for minor dataset. | |

**User's choice:** merged_players.json, partial sum when insufficient
**Notes:** run.py already fetches element-summary for all starts > 0 players — pass summaries into merge.py.

---

## Points Columns Layout in ValueGemsTable

| Option | Description | Selected |
|--------|-------------|----------|
| Replace 'Pts' with 3 columns | Remove current Pts column; add Total Pts, Pts L5, Pts L3 in sequence. Mobile hides L5/L3. | ✓ |
| Keep 'Pts', add 2 new columns after | Preserve existing column as-is; append Pts L5 and Pts L3. Duplicates Total Pts. | |
| Single toggling Pts column | One column cycling Total / Last 5 / Last 3. Saves space but awkward sorting. | |

**User's choice:** Replace 'Pts' with 3 columns
**Notes:** Follow-up confirmed: partial windows show asterisk (e.g. `12*`) with tooltip clarifying "N of M gameweeks".

---

## Claude's Discretion

- Proxy badge on Gem score for players using FPL goals/assists — implementation details TBD
- Tooltip/asterisk style and placement for partial pts windows

## Deferred Ideas

None.
