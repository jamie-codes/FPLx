# ACC-05: Honest Displayed Accuracy

**Feature ID:** ACC-05 (Improvement #1)
**Date:** 2026-06-14
**Status:** Approved
**Basis:** BT-02/BT-03 made the tuner honest; the Accuracy tab still *displays* the leaky `compute_accuracy_backtest` hit-rates (inflated ~19% vs honest ~10%). Approach (b)+(c): surface the already-computed honest harness, relabel the leaky sections as calibration. Exploration confirmed the honest harness already runs in-pipeline and most of its metrics are discarded.

---

## Goal

Stop the Accuracy tab presenting in-sample (leaky) hit-rates as the model's forward skill. Add a "Forward Skill" panel fed by the leakage-free harness (`backtest.run_backtest`, already computed in-pipeline); relabel the existing leaky blocks as model-fit calibration. Purely additive — no change to the leaky writer, tuner, calibration deciles, version history, or the `*_used` params.

## Pipeline change (additive, `pipeline/run.py`)

`compute_honest_metrics` (run.py ~129-154) already calls `run_backtest(mode='deploy')` and computes the full `metrics` dict, but persists only 5 fields. Widen the persisted `summary.honest_metrics` to include what the harness already returns:

```python
return {
    'top10_mean_pts':      _r('top10_mean_pts', 2),
    'haul_capture_20':     _r('haul_capture_20', 4),
    'captain_return_rate': _r('captain_return_rate', 4),
    'haul_hit_rate':       _r('haul_hit_rate', 4),
    'mid_tier_hit_rate':   _r('mid_tier_hit_rate', 4),   # NEW
    'captain_hit_rate':    _r('captain_hit_rate', 4),    # NEW
    'rmse':                _r('rmse', 4),                # NEW
    'mae':                 _r('mae', 4),                 # NEW
    'spearman':            _r('spearman', 4),            # NEW
    'by_position':         m.get('by_position'),         # NEW (rmse/n/n_haulers per GKP/DEF/MID/FWD)
    'per_gw':              _slim_per_gw(m.get('per_gw', [])),  # NEW
    'n_gws':               m.get('n_gws'),
    'mode':                'deploy',                      # NEW (provenance label)
}
```
`_slim_per_gw` keeps only display fields per GW: `{gw, n_haulers, haul_hits, haul_hit_rate, top10_mean_pts, spearman, captain_actual, captain_name}` (these already exist in `run_backtest`'s `per_gw`). Same `n_gws >= 8` gate; same non-fatal try/except; no other write touched. Existing `compute_honest_metrics` tests extended for the new keys; the `_run_backtest_for_picks` seam stays mockable.

## Types (`src/lib/types.ts`)

Extend `HonestMetrics` with the new optional fields (keep existing required ones for back-compat with the ConfidenceStrip):
```ts
mid_tier_hit_rate?: number | null
captain_hit_rate?: number | null
rmse?: number | null
mae?: number | null
spearman?: number | null
mode?: string
by_position?: Record<'GKP'|'DEF'|'MID'|'FWD', { n: number; rmse: number; n_haulers: number }>
per_gw?: { gw: number; n_haulers: number; haul_hits: number; haul_hit_rate: number | null;
           top10_mean_pts: number; spearman: number; captain_actual: number; captain_name: string }[]
```

## UI (`src/components/accuracy/`)

### New `ForwardSkillPanel.tsx` (UIX primitives, tokens only)
Rendered at the TOP of the Summary sub-tab in `AccuracyTab.tsx`, above the existing hit-rate blocks.
- Header: `SectionHeader` "Forward Skill (leakage-free)" + a one-line explainer ("what the model would have picked *before* each GW — the honest measure").
- `Stat` row: Haul capture (top-20) as "~1 in N" (reuse `haulCaptureLabel` from `picks.ts`), Top-10 mean pts, Captain returns 6+ (%), RMSE, Spearman.
- Honest per-GW `TableShell`: GW, haulers, hits, haul-hit-rate, top-10 pts, Spearman, captain (name + actual).
- By-position mini-table: GKP/DEF/MID/FWD rmse + n_haulers.
- Source/provenance line: "deploy mode · {n_gws} GWs this season" OR the fallback caption below.
- **States** (mirror `ConfidenceStrip`): `honest_metrics` present & `n_gws >= 8` → live; else → 2025/26 validation baseline constants (the same numbers ConfidenceStrip falls back to: top10 5.66, haul_capture_20 0.194, captain_return 0.60) with caption "measured on 2025/26 — switches to live after GW8", and the per-GW/by-position tables hidden (no live per-GW yet) with a muted "Per-gameweek detail appears once the season is underway."

### Relabel the leaky blocks (`AccuracyTab.tsx`)
- The existing "xPts Hit Rate" / overall hit-rate badge + `GwSummaryTable` get a `SectionHeader` "In-sample calibration" + caption: "Uses each gameweek's own xG and minutes — a model-fit diagnostic, not forward skill. For forward skill see the panel above." (text only; no logic change to the leaky data.)
- `HitRateBadge` tier thresholds unchanged; just recaptioned.
- Calibration and Versions sub-tabs: add a one-line caption noting they're in-sample diagnostics. No data change.

## Testing

- Pipeline: `compute_honest_metrics` returns the widened dict (mock `_run_backtest_for_picks` with a full metrics fixture → assert all new keys + `_slim_per_gw` shape); gate <8 GWs still → None.
- UI: `ForwardSkillPanel.test.tsx` — live state (honest_metrics with n_gws=12) renders the Stat values + per-GW rows + by-position; fallback state (<8 / absent) shows the baseline constants + "switches to live after GW8" + hides per-GW; AccuracyTab renders the panel above the relabelled calibration block; the relabel caption present.
- Grep gate on new component (zero raw palette); full vitest; tsc 0; contrast 30; e2e 65; pipeline suite green.

## Out of scope

- Replacing/removing the leaky backtest (it powers calibration deciles, version history, per-player drill-downs — kept)
- Honest per-player calibration deciles (would need honest per-player rows persisted — future)
- Backtest/tuner changes (already honest)
