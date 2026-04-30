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

## Next Step

Plan 03 Task 2 (proj_pts-removal) executes the file-by-file deletion.
