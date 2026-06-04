# Model Parameter Tuner — Design Spec

**Date:** 2026-06-04  
**Feature ID:** TUNE-01  
**Status:** Approved — ready for implementation planning  

---

## Problem

The FPLx xPts model has four key parameters currently set by engineering judgment, not data:

- `BLEND_ALPHA = 0.4` — form-signal blend weight
- `FORM_WINDOW_GWS = 5` — recency window for form signal
- `cs_prob_base = 0.40` — base CS probability against average opposition
- `cs_prob_slope = 0.30` — how steeply CS probability drops vs stronger attacks

There is no mechanism to answer "would a different value have performed better over last season's 38 GWs?" The existing accuracy backtest only covers the last 5 GWs and computes a single hit-rate metric. Parameter changes are manual and unvalidated.

---

## Goal

An automatic coordinate-descent parameter tuner that runs in CI each pipeline run, sweeps candidate values for each parameter, validates improvements against a held-out GW window, and promotes better values into production without human intervention — and can never make the model worse.

---

## Architecture

### New module: `pipeline/tune.py`

Called from `run.py` after `accuracy.py`, wrapped in `try/except` (non-fatal). Gated:

- **Minimum data gate:** `finished_gws >= 13` (enough for a meaningful hold-out split)
- **Season gate:** skipped entirely when `IS_OFF_SEASON = True`

### Data source

Reuses the element-summary `history` already fetched by `run.py` — **zero new API calls**. Reuses `_reconstruct_xpts` and `_reconstruct_form_signal` from `accuracy.py`, expanding the evaluation window from `BACKTEST_GWS = 5` to **all finished GWs**.

### Hold-out split

- **Train set:** GW 1 through GW ⌊N × 2/3⌋ (approximately first two-thirds of season)
- **Validate set:** remaining ⌊N/3⌋ GWs (approximately last third)
- Split is recomputed each run as `finished_gws` grows — no hardcoded GW numbers

### Coordinate descent order

Parameters are swept in sequence. Each parameter is locked at its best-found value before the next sweep begins:

1. `BLEND_ALPHA`
2. `FORM_WINDOW_GWS`
3. `cs_prob_base`
4. `cs_prob_slope`

### Result storage

Results are written to `accuracy_backtest.json` under a new top-level `tuner` key. Promoted values are also written into `summary` — the same channel `run.py` already reads to configure `blend_alpha_used`. Three new summary fields are added: `cs_prob_base_used`, `cs_prob_slope_used`, `form_window_gws_used`.

---

## Parameters and Sweep Candidates

| # | Parameter | Current | Candidates | Notes |
|---|-----------|---------|------------|-------|
| 1 | `BLEND_ALPHA` | 0.40 | 0.0, 0.1, 0.2, … 1.0 (11 values) | Highest impact; controls form vs season-average weighting |
| 2 | `FORM_WINDOW_GWS` | 5 | 3, 4, 5, 6, 7, 8 (6 values) | Too short = noise; too long = stale signal |
| 3 | `cs_prob_base` | 0.40 | 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55 (7 values) | Base CS probability vs average-strength attack |
| 4 | `cs_prob_slope` | 0.30 | 0.15, 0.20, 0.25, 0.30, 0.35, 0.40 (6 values) | Sensitivity of CS prob to opponent attacking strength |

**Total evaluations per run:** 11 + 6 + 7 + 6 = **30 sweeps**  
**Expected CI time:** 2–5 seconds (pure arithmetic over ~700 players × N GWs, no I/O)

`BONUS_RATE` is excluded — per-player bonus EV from `bonus.py` already handles position-level bonus more precisely than a flat constant tuner could.

---

## Metrics

Each candidate value is scored on three metrics, computed **separately** over train and validate GWs:

| Metric | Definition | Direction |
|--------|-----------|-----------|
| **Haul hit rate** | Fraction of ≥10pt scorers ranked in model's top 10 | ↑ higher better |
| **xPts RMSE** | √mean((predicted − actual)²), all players with ≥10 min played | ↓ lower better |
| **Captain hit rate** | Fraction of GWs where rank-1 player scored the most points that GW | ↑ higher better |

---

## Promotion Gates

A candidate value is promoted only when **all four conditions hold**:

1. **Training improvement** — candidate beats current value on haul hit rate by `> GATE_MARGIN_PP = 0.02` (2 percentage points) on the training set. Matches existing form-signal gate pattern; prevents noise-driven promotion.
2. **Validation holds** — candidate also beats current value on haul hit rate on the hold-out set (no margin required — must simply not regress).
3. **No metric regression** — xPts RMSE must not worsen by more than 5% AND captain hit rate must not drop by more than 2pp vs current value on the validation set (matching `GATE_MARGIN_PP` tolerance; captain hit rate is volatile enough that zero-tolerance would block valid promotions).
4. **Best candidate only** — if multiple candidates pass all gates, the one with the highest combined validation score is promoted. Combined score normalises all three metrics to fractional improvement over current: `Δhaul_hit_rate + (rmse_current − rmse_candidate) / rmse_current + Δcaptain_hit_rate`. All three terms are on comparable scales (fractional change); a large RMSE gain cannot dominate at the expense of hit rates.

If no candidate clears all gates, the current production value is preserved. **The tuner can only improve or hold — never worsen.**

---

## Output Shape

New `tuner` key in `accuracy_backtest.json`:

```json
"tuner": {
  "last_run_at": "2026-06-04T12:00:00Z",
  "finished_gws": 38,
  "gws_train": [1, 2, ..., 25],
  "gws_validate": [26, 27, ..., 38],
  "sweep": {
    "blend_alpha": {
      "current": 0.4,
      "best": 0.35,
      "promoted": true,
      "train_haul_hit_rate": 0.71,
      "train_rmse": 3.12,
      "train_captain_hit_rate": 0.58,
      "validate_haul_hit_rate": 0.68,
      "validate_rmse": 3.21,
      "validate_captain_hit_rate": 0.55
    },
    "form_window_gws": {
      "current": 5,
      "best": 5,
      "promoted": false
    },
    "cs_prob_base": {
      "current": 0.40,
      "best": 0.45,
      "promoted": true,
      "train_haul_hit_rate": 0.72,
      "train_rmse": 3.08,
      "train_captain_hit_rate": 0.60,
      "validate_haul_hit_rate": 0.69,
      "validate_rmse": 3.18,
      "validate_captain_hit_rate": 0.56
    },
    "cs_prob_slope": {
      "current": 0.30,
      "best": 0.30,
      "promoted": false
    }
  }
}
```

Promoted values are also written to `summary`:

```json
"summary": {
  "blend_alpha_used": 0.35,
  "form_window_gws_used": 5,
  "cs_prob_base_used": 0.45,
  "cs_prob_slope_used": 0.30,
  ...
}
```

---

## Integration with Existing Pipeline

### `run.py` changes (minimal)
- Call `tune.run_tuner(summaries, finished_gws, bootstrap, fixtures, cache_dir)` after `compute_accuracy_backtest(...)`, wrapped in `try/except`
- Read `cs_prob_base_used`, `cs_prob_slope_used`, `form_window_gws_used` from the prior `accuracy_backtest.json` (same pattern as `blend_alpha_used` today)
- Pass all four tuned parameters into `merge_players()` and `compute_accuracy_backtest()`

### `merge.py` changes
- `_cs_prob()` accepts `cs_prob_base` and `cs_prob_slope` kwargs (defaulting to current constants) instead of hardcoded `0.40` and `0.30`
- `merge_players()` accepts and threads through `cs_prob_base`, `cs_prob_slope`, `form_window_gws`
- Constants `BLEND_ALPHA`, `BLEND_ALPHA` remain as defaults — no behaviour change when kwargs are absent

### `accuracy.py` changes
- `compute_accuracy_backtest()` accepts `form_window_gws`, `cs_prob_base`, `cs_prob_slope` kwargs
- `_reconstruct_xpts()` and `_reconstruct_form_signal()` accept and use tuned params
- Existing `BLEND_ALPHA`, `FORM_WINDOW_GWS` constants remain as fallback defaults

### `tune.py` (new)
- Imports `_reconstruct_xpts`, `_reconstruct_form_signal`, `GATE_MARGIN_PP` from `accuracy.py`
- Public API: `run_tuner(summaries, finished_gws, bootstrap, fixtures, cache_dir) -> dict`
- Pure transform: no HTTP calls, no file I/O except reading prior `accuracy_backtest.json` and writing result dict (caller handles the `save()`)
- Returns a `tuner` dict that `run.py` merges into the backtest result before saving

---

## Testing

`pipeline/tests/test_tune.py`:

1. **No-promotion test** — current values are already optimal; assert all `promoted: false`
2. **Single promotion test** — feed data where one parameter clearly improves; assert correct field promoted, others unchanged
3. **Regression guard test** — candidate has better haul hit rate but worse RMSE beyond 5% threshold; assert promotion blocked
4. **Hold-out regression test** — candidate wins on train set but loses on validate; assert promotion blocked
5. **Multi-candidate tie-break test** — two candidates pass all gates; assert the higher combined-score one is promoted
6. **IS_OFF_SEASON / finished_gws gate test** — tuner skips when `finished_gws < 13`; returns prior values untouched
7. **Coordinate locking test** — second parameter sweep uses the best value from first sweep, not the original constant
8. **xPts RMSE metric test** — unit test for RMSE computation with known inputs/outputs
9. **Captain hit rate metric test** — unit test for captain metric with known per-GW rank-1 results

---

## Non-Goals

- Does not tune `BONUS_RATE` (handled by per-player bonus EV model)
- Does not tune `GOAL_PTS` or `CS_PTS` (fixed FPL scoring rules)
- Does not tune `HAULTER_THRESHOLD` (definitional, not a model parameter)
- Does not implement Bayesian optimisation or gradient descent — coordinate descent is sufficient for this parameter count and budget
- Does not expose tuner results in the UI in this phase (accuracy tab extension is a follow-on)
