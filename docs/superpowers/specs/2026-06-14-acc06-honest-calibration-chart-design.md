# ACC-06: Honest xPts Calibration Chart

**Feature ID:** ACC-06 (builds on ACC-05)
**Date:** 2026-06-14
**Status:** Approved

---

## Goal

Add the one calibration view the Accuracy tab lacks: **predicted-xPts bucket → mean actual points**, computed from the leakage-free BT-02 harness rows (not the leaky path). Answers "is the model over/under-confident at, say, 3–4 xPts?" — a player bucket predicted 3–4 should average ~3–4 actual over the season. Renders in the ACC-05 Forward Skill panel.

## Pipeline (`pipeline/run.py`, additive)

`compute_honest_metrics` already holds `result = _run_backtest_for_picks(...)` with `result['rows']` (each `{xpts_pred, actual_pts, element_type, ...}`). Add a `_honest_calibration(rows)` helper that buckets rows by `xpts_pred` into fixed bins and returns per-bucket aggregates:

```python
CALIB_BINS = [(0,1),(1,2),(2,3),(3,4),(4,5),(5,6),(6,8),(8,99)]  # last label "8+"

def _honest_calibration(rows: list) -> list:
    out = []
    for lo, hi in CALIB_BINS:
        b = [r for r in rows if lo <= r['xpts_pred'] < hi]
        if not b:
            continue
        out.append({
            'bin_lo': lo, 'bin_hi': hi, 'n': len(b),
            'mean_pred':   round(sum(r['xpts_pred'] for r in b) / len(b), 2),
            'mean_actual': round(sum(r['actual_pts'] for r in b) / len(b), 2),
        })
    return out
```

Persist as `honest_metrics['calibration'] = _honest_calibration(result['rows'])` (only the buckets with data; empty list if no rows). Same `n_gws >= 8` gate as the rest of `honest_metrics`; no other write touched. The `_run_backtest_for_picks` seam already returns the full dict (ACC-05), so `result['rows']` is available — confirm and use it.

## Types (`src/lib/types.ts`)

Extend `HonestMetrics`:
```ts
calibration?: { bin_lo: number; bin_hi: number; n: number; mean_pred: number; mean_actual: number }[]
```

## UI (`src/components/accuracy/ForwardSkillPanel.tsx`)

Add a calibration chart section below the existing Stat row + per-GW table, **only in the live state** (`n_gws >= 8` and `calibration` present & non-empty):
- Recharts scatter/line: x = `mean_pred`, y = `mean_actual` per bucket; plus a dashed **y = x reference line** (perfect calibration) spanning the data range. Tokens only — line/point `stroke/fill = var(--color-accent)`, reference line + grid via `color-mix(in srgb, var(--color-ink-muted) X%, transparent)` (same convention as the other migrated charts), axis ticks `currentColor`. Tooltip shows bin label ("3–4"), n, mean_pred, mean_actual.
- A compact companion table is acceptable instead of/alongside the chart if cleaner: bin | n | predicted | actual | Δ. Keep it tokenized + `.tabular`.
- Caption: "Each dot is a predicted-xPts bucket; on the dashed line = perfectly calibrated. Above = model under-predicted, below = over-predicted." `text-data text-ink-muted`.
- **Fallback / <8 GWs:** the chart is hidden (the panel's existing fallback already shows baseline Stats + "switches to live after GW8"); add a muted "Calibration appears once the season is underway." line where the chart would be. No fabricated data.

## Testing

- Pipeline: `_honest_calibration` buckets correctly (a row at xpts_pred=3.5 lands in [3,4); empty bins dropped; mean_actual averaged); `compute_honest_metrics` includes `calibration` when ≥8 GWs, gate <8 → None (unchanged).
- UI: `ForwardSkillPanel.test.tsx` — live state with a `calibration` array renders the chart/table (assert a bin label + actual value present); fallback/absent → chart hidden + the "appears once the season is underway" note; no crash when `calibration` is `[]`.
- Grep gate on the panel (zero raw palette); full vitest; tsc 0; contrast 30; e2e 65.

## Out of scope

- Touching the leaky `accuracy.py` calibration (the existing CS-prob calibration tab stays as an in-sample diagnostic, per ACC-05)
- Per-position honest calibration (the by_position rmse is already shown; this chart is pool-wide)
- Historical calibration trend across versions
