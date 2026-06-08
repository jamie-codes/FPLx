# FRM-01: Actual G+A Blend in Form Signal

**Feature ID:** FRM-01  
**Date:** 2026-06-08  
**Status:** Approved

---

## Goal

Improve the xPts form signal by blending actual goals+assists per-90 with xG+xA per-90 inside `_compute_form_signal`. A new parameter `FORM_ACTUAL_BETA` controls the mix and is tuned automatically by TUNE-01's coordinate descent — the data decides how much actual performance improves predictions each season.

The motivation: xG+xA alone misses finishing runs (a striker converting 8G from 4xG is demonstrably in form), set-piece outperformance (actual G+A from headers/direct FKs not fully captured by xG), and momentum that pure expected stats cannot see. Blending in actual G+A at a minority weight captures this signal without overfitting to variance.

---

## Architecture

The change is entirely inside the pipeline. No new output fields, no `types.ts` changes, no UI changes. `form_xgxa_per90` in `players.json` continues to hold the (now hybrid) form value — the field name is preserved because the signal remains predominantly xG+xA-based.

**Default `FORM_ACTUAL_BETA = 0.0`** everywhere preserves current behaviour exactly — the blend is pure xG+xA until TUNE-01 promotes a non-zero value mid-season.

**Modified files:**
- `pipeline/merge.py` — `_compute_form_signal` gains `beta` param; `merge_players` gains `form_actual_beta` kwarg
- `pipeline/accuracy.py` — `_group_history_by_gw` tracks `goals_scored`+`assists`; `_reconstruct_form_signal` gains `beta`; `build_per_gw_rows` gains `form_actual_beta`; new constant `FORM_ACTUAL_BETA = 0.0`
- `pipeline/tune.py` — `FORM_ACTUAL_BETA` added as parameter 5 in the coordinate descent sweep
- `pipeline/run.py` — reads `form_actual_beta_used` from backtest summary; passes to `merge_players`
- `pipeline/tests/test_form_signal.py` — 6 new tests appended to existing file

---

## `_compute_form_signal` change (`merge.py`)

Signature gains `beta: float = 0.0`:

```python
def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,
    beta: float = 0.0,   # FRM-01: actual G+A blend weight; 0.0 = pure xG+xA
) -> tuple:
```

The DGW aggregation dict gains two fields collected in the same pass:

```python
agg = by_round.setdefault(r, {
    'minutes': 0,
    'expected_goals': 0.0, 'expected_assists': 0.0,
    'goals_scored': 0, 'assists': 0,   # FRM-01
})
agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)
agg['assists']      += int(entry.get('assists', 0) or 0)
```

At the end, both per-90 values are computed and blended:

```python
weighted_xgxa   = sum((p['expected_goals'] + p['expected_assists']) * w
                      for p, w in zip(played, weights))
weighted_actual = sum((p['goals_scored'] + p['assists']) * w
                      for p, w in zip(played, weights))
weighted_mins   = sum(p['minutes'] * w for p, w in zip(played, weights))

if weighted_mins <= 0:
    return None, 0

xg_xa_per90     = (weighted_xgxa   / weighted_mins) * 90
actual_ga_per90 = (weighted_actual / weighted_mins) * 90
blended         = (1.0 - beta) * xg_xa_per90 + beta * actual_ga_per90

return round(blended, 4), len(played)
```

`beta=0.0` arithmetically equals the current return value — fully backward compatible. The existing recency weights (linear 0.5→1.0, oldest→most recent) apply identically to both components.

`merge_players` gains `form_actual_beta: float = 0.0` and passes it to `_compute_form_signal`.

---

## `accuracy.py` changes

**`_group_history_by_gw`** — adds `goals_scored` and `assists` to its aggregation dict:

```python
by_round: dict = defaultdict(lambda: {
    'round': 0, 'minutes': 0, 'total_points': 0,
    'expected_goals': 0.0, 'expected_assists': 0.0,
    'goals_scored': 0, 'assists': 0,   # FRM-01
})
# in the loop:
agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)
agg['assists']      += int(entry.get('assists', 0) or 0)
```

**`_reconstruct_form_signal`** — gains `beta: float = 0.0` and mirrors the blend logic:

```python
def _reconstruct_form_signal(
    grouped, current_gw, window_gws=FORM_WINDOW_GWS,
    min_minutes=FORM_MIN_MINUTES, beta: float = 0.0,
):
    # ... existing filter, gates, weights unchanged ...
    weighted_xgxa   = sum((p['expected_goals'] + p['expected_assists']) * w ...)
    weighted_actual = sum((p.get('goals_scored', 0) + p.get('assists', 0)) * w ...)
    weighted_mins   = sum(p['minutes'] * w ...)
    if weighted_mins <= 0:
        return None
    xg_xa_per90     = (weighted_xgxa   / weighted_mins) * 90
    actual_ga_per90 = (weighted_actual / weighted_mins) * 90
    return round((1.0 - beta) * xg_xa_per90 + beta * actual_ga_per90, 4)
```

`.get('goals_scored', 0)` with a default means existing test fixtures that omit those fields remain valid.

**`build_per_gw_rows`** — gains `form_actual_beta: float = 0.0` and threads it to `_reconstruct_form_signal`.

**New constant** alongside existing form constants:
```python
FORM_ACTUAL_BETA = 0.0   # FRM-01: default actual G+A blend weight
```

---

## `tune.py` changes

**New constant and candidates:**
```python
from accuracy import (..., FORM_ACTUAL_BETA)

FORM_ACTUAL_BETA_CANDIDATES = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
```

**`_read_prior_params`** gains one key:
```python
'form_actual_beta': float(summary.get('form_actual_beta_used', FORM_ACTUAL_BETA)),
```

**`sweep_order`** gains parameter 5:
```python
('form_actual_beta', FORM_ACTUAL_BETA_CANDIDATES, prior['form_actual_beta']),
```

**`_sweep_param` → `build_per_gw_rows` calls** gain `form_actual_beta=params['form_actual_beta']`. The `promoted_params` dict gains the key automatically (it is a copy of `params`).

**Total sweep evaluations:** 30 existing + 6 new = **36 per run**. Expected CI time remains 2–5 seconds.

---

## `run.py` changes

Reads `form_actual_beta_used` from the backtest summary alongside the existing four tuned parameters:

```python
form_actual_beta = float(
    accuracy_summary.get('form_actual_beta_used', accuracy.FORM_ACTUAL_BETA)
)
```

Passes to `merge_players`:
```python
merge.merge_players(..., form_actual_beta=form_actual_beta)
```

Writes `form_actual_beta_used` into the summary after `run_tuner` promotes a value — same pattern as `cs_prob_base_used`, `cs_prob_slope_used`, etc.

---

## Testing

All new tests in `pipeline/tests/test_form_signal.py` (appended to the existing 5 tests).

### `_compute_form_signal` tests

| Test | Assertion |
|---|---|
| `test_beta_zero_backward_compatible` | `_compute_form_signal(history, beta=0.0)` returns same result as call without `beta` arg |
| `test_beta_one_returns_pure_actual_ga` | `beta=1.0` with known `goals_scored`/`assists` returns `actual_ga_per90` only |
| `test_beta_half_is_blend` | `beta=0.5` result is between the pure xG+xA value and the pure actual G+A value |
| `test_outperformer_higher_with_positive_beta` | Player with `goals_scored > expected_goals` gets higher form at `beta=0.3` than `beta=0.0` |
| `test_underperformer_lower_with_positive_beta` | Player with `goals_scored < expected_goals` gets lower form at `beta=0.3` than `beta=0.0` |
| `test_dgw_aggregates_goals_and_assists` | Two entries sharing the same round: `goals_scored` and `assists` summed before weighting |

### `test_tune.py` tests (2 new)

| Test | Assertion |
|---|---|
| `test_form_actual_beta_in_promoted_params` | `promoted_params` dict contains `form_actual_beta` key |
| `test_form_actual_beta_default_in_read_prior_params` | Missing `form_actual_beta_used` in summary → returns `FORM_ACTUAL_BETA` (0.0) |

### Regression guard

All 5 existing `test_form_signal.py` tests (which call `_compute_form_signal` without `beta`) continue passing — the default `beta=0.0` is the arithmetic identity for the current behaviour.
