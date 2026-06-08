# FRM-02: Fixture-Difficulty-Weighted Form Signal

**Feature ID:** FRM-02  
**Date:** 2026-06-08  
**Status:** Approved

---

## Goal

Improve the xPts form signal by weighting each GW's contribution by the difficulty of the opponent faced. A goal against a difficulty-5 side provides stronger form evidence than one against a difficulty-1 side. A new parameter `FORM_DIFFICULTY_GAMMA` scales the effect and is tuned automatically by TUNE-01's coordinate descent.

The motivation: recency-only weighting treats a hat-trick against bottom-of-the-table with the same signal strength as one against the league's best defence. Difficulty weighting amplifies high-quality form performances and discounts easy-fixture output, improving the signal-to-noise ratio of the form window.

---

## Architecture

The change is entirely inside the pipeline. No new output fields, no `types.ts` changes, no UI changes. `form_xgxa_per90` in `players.json` continues to hold the (now difficulty-adjusted) form value.

**Default `FORM_DIFFICULTY_GAMMA = 0.0`** everywhere preserves current behaviour exactly — `difficulty_factor = 1.0` for all GWs when `gamma=0.0`.

The difficulty weighting stacks naturally on top of FRM-01's actual G+A blend — both use the same combined weights.

**Data source:** The `difficulty` field (FDR 1–5) is already present in every FPL element-summary history entry. No external data dict is needed. Missing `difficulty` defaults to 3 (mid-range) → factor = 1.0.

**Modified files:**
- `pipeline/merge.py` — `_compute_form_signal` gains `gamma` param; `merge_players` gains `form_difficulty_gamma` kwarg
- `pipeline/accuracy.py` — `_group_history_by_gw` tracks `difficulty_sum`/`difficulty_n`; `_reconstruct_form_signal` gains `gamma`; `build_per_gw_rows` gains `form_difficulty_gamma`; new constant `FORM_DIFFICULTY_GAMMA = 0.0`
- `pipeline/tune.py` — `FORM_DIFFICULTY_GAMMA` added as parameter 6 in the coordinate descent sweep
- `pipeline/run.py` — reads `form_difficulty_gamma_used` from backtest summary; passes to `merge_players`; writes back after tuning
- `pipeline/tests/test_form_signal.py` — 7 new tests appended to existing file
- `pipeline/tests/test_tune.py` — 2 new tests + 3 updated existing tests

---

## Formula

```
combined_weight_i   = recency_weight_i × difficulty_factor_i

difficulty_factor_i = 1.0 + gamma × (norm_difficulty_i - 0.5)
norm_difficulty_i   = (avg_difficulty_i - 1) / 4     # FDR 1–5 → 0.0–1.0

gamma = 0.0  →  factor = 1.0 for all GWs  →  current behaviour (backward-compatible)
gamma = 1.0  →  factor ranges 0.5 (difficulty-1) to 1.5 (difficulty-5)
```

DGW rounds: `difficulty` is **averaged** across the two entries before the factor is applied.

---

## `_compute_form_signal` change (`merge.py`)

Signature gains `gamma: float = 0.0`:

```python
def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,
    beta: float = 0.0,    # FRM-01: actual G+A blend weight; 0.0 = pure xG+xA
    gamma: float = 0.0,   # FRM-02: difficulty weight scaling; 0.0 = current behaviour
) -> tuple:
```

The DGW aggregation dict gains two fields:

```python
agg = by_round.setdefault(r, {
    'minutes': 0,
    'expected_goals': 0.0, 'expected_assists': 0.0,
    'goals_scored': 0, 'assists': 0,           # FRM-01
    'difficulty_sum': 0.0, 'difficulty_n': 0,  # FRM-02
})
agg['difficulty_sum'] += float(entry.get('difficulty', 3) or 3)
agg['difficulty_n']   += 1
```

A module-level helper computes the per-GW factor:

```python
def _difficulty_factor(agg: dict, gamma: float) -> float:
    """FRM-02: compute difficulty weight multiplier for one aggregated GW.

    gamma=0.0 fast-path returns 1.0 (no-op, backward-compatible).
    avg_diff defaults to 3.0 (mid-range) if no difficulty data present.
    """
    if gamma == 0.0:
        return 1.0
    avg_diff = agg['difficulty_sum'] / max(agg['difficulty_n'], 1)
    norm     = (avg_diff - 1) / 4   # FDR 1–5 → 0.0–1.0
    return 1.0 + gamma * (norm - 0.5)
```

Combined weights replace the recency-only weights:

```python
n = len(played)
recency_weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]

weights = [
    rw * _difficulty_factor(p, gamma)
    for rw, p in zip(recency_weights, played)
]
```

The rest of the formula (`weighted_xgxa`, `weighted_actual`, `weighted_mins`, blend) uses these combined weights unchanged.

`merge_players` gains `form_difficulty_gamma: float = 0.0` kwarg and passes it to `_compute_form_signal`.

---

## `accuracy.py` changes

**New constant** alongside existing form constants:
```python
FORM_DIFFICULTY_GAMMA = 0.0   # FRM-02: default difficulty weight scaling
```

**`_group_history_by_gw`** — adds difficulty accumulation:

```python
by_round: dict = defaultdict(lambda: {
    'round': 0, 'minutes': 0, 'total_points': 0,
    'expected_goals': 0.0, 'expected_assists': 0.0,
    'goals_scored': 0, 'assists': 0,               # FRM-01
    'difficulty_sum': 0.0, 'difficulty_n': 0,      # FRM-02
})
# in the loop:
agg['difficulty_sum'] += float(entry.get('difficulty', 3) or 3)
agg['difficulty_n']   += 1
```

**`_reconstruct_form_signal`** — gains `gamma: float = 0.0` and mirrors the combined-weights logic:

```python
def _reconstruct_form_signal(
    grouped, current_gw, window_gws=FORM_WINDOW_GWS,
    min_minutes=FORM_MIN_MINUTES, beta: float = 0.0, gamma: float = 0.0,
):
    # ... existing filter, gates unchanged ...
    n = len(played)
    recency_weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
    weights = [
        rw * _difficulty_factor(p, gamma)   # FRM-02; uses .get() defaults for old fixtures
        for rw, p in zip(recency_weights, played)
    ]
    weighted_xgxa   = sum((p['expected_goals'] + p['expected_assists']) * w ...)
    weighted_actual = sum((p.get('goals_scored', 0) + p.get('assists', 0)) * w ...)
    weighted_mins   = sum(p['minutes'] * w ...)
    if weighted_mins <= 0:
        return None
    xg_xa_per90     = (weighted_xgxa   / weighted_mins) * 90
    actual_ga_per90 = (weighted_actual / weighted_mins) * 90
    return round((1.0 - beta) * xg_xa_per90 + beta * actual_ga_per90, 4)
```

`_difficulty_factor` is duplicated inline (three lines) to avoid a cross-module import from `merge.py`. Safe for test fixtures that lack `difficulty_sum`/`difficulty_n` via `.get()` defaults.

**`build_per_gw_rows`** — gains `form_difficulty_gamma: float = FORM_DIFFICULTY_GAMMA`; docstring Args entry added; passes `gamma=form_difficulty_gamma` to `_reconstruct_form_signal`.

---

## `tune.py` changes

**New constant and candidates:**
```python
from accuracy import (..., FORM_DIFFICULTY_GAMMA)

FORM_DIFFICULTY_GAMMA_CANDIDATES = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
```

**`_read_prior_params`** gains one key:
```python
'form_difficulty_gamma': float(summary.get('form_difficulty_gamma_used', FORM_DIFFICULTY_GAMMA)),
```

**`sweep_order`** gains parameter 6:
```python
('form_difficulty_gamma', FORM_DIFFICULTY_GAMMA_CANDIDATES, prior['form_difficulty_gamma']),
```

**`_sweep_param` → `build_per_gw_rows` calls** gain `form_difficulty_gamma=params['form_difficulty_gamma']` and `form_difficulty_gamma=candidate_params['form_difficulty_gamma']`.

**Total sweep evaluations:** 36 existing + 6 new = **42 per run**. Expected CI time remains 2–5 seconds.

---

## `run.py` changes

Identical read/pass/write pattern to `form_actual_beta`:

```python
form_difficulty_gamma_used = accuracy.FORM_DIFFICULTY_GAMMA   # default before try

# inside try:
form_difficulty_gamma_used = float(
    prev_backtest.get('summary', {}).get('form_difficulty_gamma_used', accuracy.FORM_DIFFICULTY_GAMMA)
)

# after run_tuner:
backtest_data['summary']['form_difficulty_gamma_used'] = pp['form_difficulty_gamma']

# merge_players call:
merge.merge_players(..., form_difficulty_gamma=form_difficulty_gamma_used)
```

---

## Testing

All new tests in `pipeline/tests/test_form_signal.py` (FRM-02 section, appended after FRM-01 tests).

### `_compute_form_signal` tests

| Test | Assertion |
|---|---|
| `test_gamma_zero_backward_compatible` | `_compute_form_signal(history, gamma=0.0)` returns same result as call without `gamma` arg |
| `test_gamma_one_hard_fixture_higher_weight` | Same xG+xA each GW but alternating difficulty: difficulty-5 GW contributes more than difficulty-1 GW at `gamma=1.0` |
| `test_gamma_half_is_blend` | At `gamma=0.5` result is between `gamma=0.0` and `gamma=1.0` |
| `test_hard_fixture_scorer_higher_with_positive_gamma` | Player whose xG+xA concentrated in difficulty-5 GWs gets higher form at `gamma=0.4` than `gamma=0.0` |
| `test_easy_fixture_scorer_lower_with_positive_gamma` | Player whose xG+xA concentrated in difficulty-1 GWs gets lower form at `gamma=0.4` than `gamma=0.0` |
| `test_missing_difficulty_defaults_to_midrange` | History entries without `difficulty` key → same result as all difficulty=3 |
| `test_dgw_difficulty_averaged` | Two entries in same round with difficulty=2 and difficulty=4 → avg=3 → factor=1.0 at any gamma |

### `test_tune.py` tests (2 new, 3 updated)

| Test | Change |
|---|---|
| `test_form_difficulty_gamma_default_in_read_prior_params` | New — missing key → returns `FORM_DIFFICULTY_GAMMA` |
| `test_form_difficulty_gamma_in_promoted_params` | New — `run_tuner` output contains key, value in [0.0, 1.0] |
| `test_run_tuner_sweep_covers_all_parameters` | Add `assert 'form_difficulty_gamma' in sweep` |
| `test_run_tuner_promoted_params_contains_all_params` | Add `assert 'form_difficulty_gamma' in pp` |
| `test_coordinate_locking_uses_prior_sweep_value` | Add `form_difficulty_gamma` assertion (6th param) |

### Regression guard

All existing `test_form_signal.py` tests call `_compute_form_signal` without `gamma` — `gamma=0.0` default gives `difficulty_factor=1.0` for all GWs, arithmetically identical to pre-FRM-02 behaviour.
