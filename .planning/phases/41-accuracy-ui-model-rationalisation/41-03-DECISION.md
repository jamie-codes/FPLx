# Phase 41 ACC-06 Model Removal Decision

**Date:** 2026-04-30T08:53:05+00:00
**Source data:** pipeline/cache/accuracy_backtest.json (generated_at: 2026-04-30T08:41:19+00:00)

## Live Hit Rates (at decision time)

| Model    | Overall hit rate |
|----------|------------------|
| xPts     | 16.7% |
| proj_pts | 9.0% |

Per-GW:

| GW | Haulters | xPts % | proj_pts % |
|----|----------|--------|-----------|
| 34 | 10 | 0.0% | 10.0% |
| 33 | 29 | 20.7% | 10.3% |
| 32 | 16 | 18.8% | 12.5% |
| 31 | 10 | 20.0% | 10.0% |
| 30 | 13 | 15.4% | 0.0% |

## Removal Decision

Removed model: **proj_pts**
Surviving model: **xPts**

xPts outperforms proj_pts in 4 of 5 GWs and has nearly double the overall hit rate (16.7% vs 9.0%). User confirmed removal of proj_pts.

## Removal Log (Plan 03 Task 2)

Completed: 2026-04-30

| File | Change |
|------|--------|
| `pipeline/merge.py` | Deleted `_proj_pts_ngw()` function; removed `proj_pts_1gw/3gw/5gw` player dict assignments |
| `src/lib/types.ts` | Removed `proj_pts_1gw/3gw/5gw` from `MergedPlayer`; updated `ScoredTransfer` comment and `AccuracyGwSummary` comment |
| `src/lib/planning-engine.ts` | `proj_pts_1gw` → `xPts_1gw ?? 0` (4 callsites) |
| `src/lib/captaincy-engine.ts` | `proj_pts_1gw` → `xPts_1gw` in filter, score calc, and comments |
| `src/lib/chip-strategy-engine.ts` | Removed `proj_pts_1gw` from TC fallback chain; updated comments |
| `src/lib/explain.ts` | `proj_pts_1gw` → `xPts_1gw ?? 0` |
| `src/lib/replacement-shortlist.ts` | `proj_pts_1gw` → `xPts_1gw ?? 0` (filter + delta calc) |
| `src/components/planner/PlannerTab.tsx` | `proj_pts_1gw` → `xPts_1gw ?? 0` (BB/TC bonus calc) |
| `src/components/planner/PlayerPickerModal.tsx` | `proj_pts_1gw` → `xPts_1gw ?? 0` (sort + display) |
| `src/components/transfers/TransferPanel.tsx` | `proj_pts_1gw` → `xPts_1gw ?? 0`; label updated to "xPts (1 GW)" |
| `src/components/accuracy/AccuracyTab.tsx` | proj_pts columns removed from GwSummaryTable, HaulterList, PlayerDeltaTable |
| Test fixtures (9 files) | `proj_pts_1gw/3gw/5gw` → `xPts_*` equivalents |
