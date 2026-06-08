# FRM-01: Actual G+A Blend in Form Signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend actual goals+assists per-90 into the xG+xA form signal via a new `FORM_ACTUAL_BETA` weight tuned by TUNE-01's coordinate descent.

**Architecture:** `_compute_form_signal` in `merge.py` gains a `beta` parameter; the same blend is mirrored in `accuracy.py`'s `_reconstruct_form_signal` for backtest fidelity; `tune.py` adds `FORM_ACTUAL_BETA` as parameter 5 in the coordinate descent sweep; `run.py` reads and threads the tuned value. Default `beta=0.0` preserves existing behaviour exactly.

**Tech Stack:** Python 3.11, pytest. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `pipeline/merge.py` | `_compute_form_signal` gains `beta`; `merge_players` gains `form_actual_beta` kwarg |
| `pipeline/accuracy.py` | `_group_history_by_gw` tracks `goals_scored`+`assists`; `_reconstruct_form_signal` gains `beta`; `build_per_gw_rows` gains `form_actual_beta`; new constant `FORM_ACTUAL_BETA = 0.0` |
| `pipeline/tune.py` | `FORM_ACTUAL_BETA` added as parameter 5 in coordinate descent |
| `pipeline/run.py` | reads `form_actual_beta_used` from summary; passes to `merge_players`; writes back after tuning |
| `pipeline/tests/test_form_signal.py` | 6 new tests appended |
| `pipeline/tests/test_tune.py` | 2 new tests + 2 existing tests updated |

---

## Task 1: Extend `_compute_form_signal` with `beta` param

**Files:**
- Modify: `pipeline/merge.py` (function `_compute_form_signal` at line ~541; function `merge_players` at line ~764)
- Modify: `pipeline/tests/test_form_signal.py` (append 6 new tests)

### Background for the implementer

`_compute_form_signal` is in `pipeline/merge.py`. It currently aggregates `expected_goals`+`expected_assists` per round (with DGW summing), applies linear recency weights (0.5→1.0 oldest→newest), and returns `(form_per90, n_gws_used)`.

The FPL element-summary history dict has fields: `round`, `minutes`, `expected_goals`, `expected_assists`, `goals_scored`, `assists`, `total_points`, `starts`, etc.

`merge_players` (line ~764) currently accepts `form_window_gws: int = 5` as a TUNE-01 parameter. The new `form_actual_beta` follows the same pattern.

The test runner is: `cd pipeline && python -m pytest tests/test_form_signal.py -v`

---

- [ ] **Step 1: Append 6 new tests to `pipeline/tests/test_form_signal.py`**

```python
# ── FRM-01: actual G+A blend tests ──────────────────────────────────────────

def test_beta_zero_backward_compatible():
    """FRM-01: beta=0.0 (default) produces identical result when goals_scored absent."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1}
        for i in range(1, 6)
    ]
    result_default, n1 = _compute_form_signal(history)
    result_explicit, n2 = _compute_form_signal(history, beta=0.0)
    assert result_default == result_explicit
    assert n1 == n2 == 5


def test_beta_one_returns_pure_actual_ga():
    """FRM-01: beta=1.0 returns recency-weighted actual G+A per-90 only.

    5 GWs × 90 min × (1 goal + 1 assist) → actual_ga_per90 = 2.0 exactly.
    (Recency weights cancel out: every entry has same G+A per minute.)
    """
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 1}
        for i in range(1, 6)
    ]
    form, n = _compute_form_signal(history, beta=1.0)
    assert form is not None
    assert abs(form - 2.0) < 0.01
    assert n == 5


def test_beta_half_is_blend():
    """FRM-01: beta=0.5 result is between pure xG+xA and pure actual."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 1}
        for i in range(1, 6)
    ]
    pure_xgxa, _ = _compute_form_signal(history, beta=0.0)
    pure_actual, _ = _compute_form_signal(history, beta=1.0)
    blend, _ = _compute_form_signal(history, beta=0.5)
    assert blend is not None
    assert min(pure_xgxa, pure_actual) <= blend <= max(pure_xgxa, pure_actual)


def test_outperformer_higher_with_positive_beta():
    """FRM-01: player scoring more than xG (outperformer) gets higher form when beta>0."""
    # xG+xA = 0.3 per 90; actual = 1.0 per 90 (outperforming)
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 0}
        for i in range(1, 6)
    ]
    form_no_actual, _ = _compute_form_signal(history, beta=0.0)
    form_with_actual, _ = _compute_form_signal(history, beta=0.3)
    assert form_with_actual > form_no_actual


def test_underperformer_lower_with_positive_beta():
    """FRM-01: player scoring less than xG (underperformer) gets lower form when beta>0."""
    # xG+xA = 1.1 per 90; actual = 0.0 per 90 (underperforming)
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.3,
         'goals_scored': 0, 'assists': 0}
        for i in range(1, 6)
    ]
    form_no_actual, _ = _compute_form_signal(history, beta=0.0)
    form_with_actual, _ = _compute_form_signal(history, beta=0.3)
    assert form_with_actual < form_no_actual


def test_dgw_aggregates_goals_and_assists():
    """FRM-01: DGW round sums goals_scored and assists across both entries."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'goals_scored': 0, 'assists': 0},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 0, 'assists': 0},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 0},   # DGW match 1
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 1},   # DGW match 2 — same round
    ]
    # With beta=1.0: only actual G+A matters.
    # Round 3 total: 2 goals + 1 assist = 3 G+A in 150 min.
    # weights (n=3): [0.5, 0.75, 1.0]
    # weighted_actual = 0*0.5 + 0*0.75 + 3*1.0 = 3.0
    # weighted_mins   = 90*0.5 + 90*0.75 + 150*1.0 = 262.5
    # actual_ga_per90 = 3.0/262.5 * 90 ≈ 1.0286
    form_actual, n = _compute_form_signal(history, beta=1.0)
    assert n == 3   # 3 unique rounds, not 4 entries
    assert form_actual is not None
    assert abs(form_actual - round(3.0 / 262.5 * 90, 4)) < 0.001
```

- [ ] **Step 2: Run to verify tests FAIL (function doesn't accept `beta` yet)**

```
cd pipeline && python -m pytest tests/test_form_signal.py::test_beta_zero_backward_compatible tests/test_form_signal.py::test_beta_one_returns_pure_actual_ga -v
```

Expected: FAIL — `TypeError: _compute_form_signal() got an unexpected keyword argument 'beta'`

- [ ] **Step 3: Replace `_compute_form_signal` in `pipeline/merge.py`**

Find and replace the entire function (currently lines ~541–598). The new version:

```python
def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,
    beta: float = 0.0,   # FRM-01: actual G+A blend weight; 0.0 = pure xG+xA (backward-compatible)
) -> tuple:
    """Compute recency-weighted form per-90 over the last window_gws unique rounds (Phase 42 ACC-01).

    FRM-01: When beta > 0, blends actual goals+assists per-90 into the form signal:
        form = (1 - beta) * xg_xa_per90 + beta * actual_ga_per90
    beta=0.0 (default) is the arithmetic identity for the pre-FRM-01 behaviour.
    beta is tuned by TUNE-01 coordinate descent; see pipeline/tune.py.

    Returns (form_xgxa_per90, gws_used) or (None, 0) when insufficient data.

    Insufficient = fewer than 3 played rounds in window, OR sum(minutes) < min_minutes.
    Rationale: form requires at least 3 GWs of signal; <270 min total is too noisy.
    Mirrors _compute_regression_signal's data shape (history list from FPL element-summary)
    but uses recency weighting and per-90 normalisation rather than mean delta.

    Recency weight: linear from 1.0 (most recent round in window) to 0.5 (oldest in window).
    Linear is inspectable; no backtest evidence supports exotic decay (RESEARCH.md Pitfall 8).

    DGW handling: entries sharing a round are summed (minutes + xG + xA + goals + assists), not
    double-counted, so n == unique rounds played, not number of history entries.
    """
    if not history:
        return None, 0

    history_sorted = sorted(history, key=lambda h: h['round'])
    unique_rounds = sorted({h['round'] for h in history_sorted})
    last_rounds = set(unique_rounds[-window_gws:])

    # DGW aggregation — same shape as accuracy._group_history_by_gw
    by_round: dict = {}
    for entry in history_sorted:
        r = entry.get('round')
        if r is None or r not in last_rounds:
            continue
        agg = by_round.setdefault(r, {
            'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0,
            'goals_scored': 0, 'assists': 0,   # FRM-01
        })
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
        agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)   # FRM-01
        agg['assists'] += int(entry.get('assists', 0) or 0)              # FRM-01

    played = [by_round[r] for r in sorted(by_round.keys()) if by_round[r]['minutes'] > 0]
    total_mins = sum(p['minutes'] for p in played)
    if len(played) < 3 or total_mins < min_minutes:
        return None, 0

    # Linear recency weights: oldest=0.5, most recent=1.0
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]

    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_actual = sum(
        (p['goals_scored'] + p['assists']) * w      # FRM-01
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))

    if weighted_mins <= 0:
        return None, 0

    xg_xa_per90     = (weighted_xgxa   / weighted_mins) * 90
    actual_ga_per90 = (weighted_actual / weighted_mins) * 90  # FRM-01
    blended         = (1.0 - beta) * xg_xa_per90 + beta * actual_ga_per90  # FRM-01

    form_per90 = round(blended, 4)
    return form_per90, len(played)
```

- [ ] **Step 4: Add `form_actual_beta` kwarg to `merge_players` in `pipeline/merge.py`**

In the `merge_players` function signature (line ~764), add one new parameter after `form_window_gws`:

```python
def merge_players(
    bootstrap: dict,
    fixtures: list,
    understat: dict,
    id_map: dict,
    xmins_stats: dict | None = None,
    summaries: dict | None = None,
    form_signal_enabled: bool = False,
    blend_alpha: float = BLEND_ALPHA,
    xmins_v2_enabled: bool = False,
    bonus_stats: dict | None = None,
    bonus_predictor_enabled: bool = False,
    save_predictor_enabled: bool = False,   # Phase 83 GK-01 / GK-03
    cs_prob_base: float = 0.40,             # TUNE-01: tunable via accuracy_backtest.json.summary
    cs_prob_slope: float = 0.30,            # TUNE-01: tunable via accuracy_backtest.json.summary
    form_window_gws: int = 5,               # TUNE-01: tunable via accuracy_backtest.json.summary
    form_actual_beta: float = 0.0,          # FRM-01: actual G+A blend weight, tunable via TUNE-01
) -> tuple[list, dict]:
```

Then find the `_compute_form_signal` call site inside `merge_players` (line ~1187). It currently reads:

```python
form_per90, form_n_gws = _compute_form_signal(
    summaries[fpl_id].get('history', []),
    window_gws=form_window_gws,
)
```

Add `beta=form_actual_beta`:

```python
form_per90, form_n_gws = _compute_form_signal(
    summaries[fpl_id].get('history', []),
    window_gws=form_window_gws,
    beta=form_actual_beta,   # FRM-01
)
```

- [ ] **Step 5: Run all 11 form signal tests to verify they pass**

```
cd pipeline && python -m pytest tests/test_form_signal.py -v
```

Expected: 11 passed (5 existing + 6 new)

- [ ] **Step 6: Run full suite to confirm no regressions**

```
cd pipeline && python -m pytest tests/ -v --tb=short
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```
git add pipeline/merge.py pipeline/tests/test_form_signal.py
git commit -m "feat(frm-01): add beta param to _compute_form_signal for actual G+A blend"
```

---

## Task 2: Mirror the blend in `accuracy.py`

**Files:**
- Modify: `pipeline/accuracy.py` (`_group_history_by_gw` at line ~777; `_reconstruct_form_signal` at line ~840; `build_per_gw_rows` at line ~126; constants block at line ~29)

### Background for the implementer

`accuracy.py` reconstructs the form signal historically for the backtest (and for TUNE-01's sweep). It must mirror `_compute_form_signal` exactly, otherwise the tuner evaluates a different signal than what `merge.py` actually computes in production.

`_group_history_by_gw` (line ~777) aggregates player history by GW — it currently doesn't include `goals_scored`/`assists`. `_reconstruct_form_signal` (line ~840) uses the grouped dict.

`build_per_gw_rows` (line ~126) is the entry point called by both `compute_accuracy_backtest` and `tune.py`. It calls `_reconstruct_form_signal`.

No new test file needed for this task — the changes are backward-compatible (defaults to 0.0) and the existing `test_accuracy.py` suite provides the regression guard.

---

- [ ] **Step 1: Add `FORM_ACTUAL_BETA = 0.0` constant to `pipeline/accuracy.py`**

In the constants block (line ~38), alongside the other form signal constants:

```python
BLEND_ALPHA = 0.4            # Phase 42 ACC-01: form-signal blend coefficient (matches merge.BLEND_ALPHA)
FORM_WINDOW_GWS = 5          # Phase 42 ACC-01: same window as merge._compute_form_signal default
FORM_MIN_MINUTES = 270       # Phase 42 ACC-01: same minutes floor as merge._compute_form_signal default
FORM_ACTUAL_BETA = 0.0       # FRM-01: actual G+A blend weight (default 0.0 = pure xG+xA)
```

- [ ] **Step 2: Update `_group_history_by_gw` to track `goals_scored` and `assists`**

Find `_group_history_by_gw` (line ~777). Replace the `defaultdict` lambda and the aggregation loop body:

```python
def _group_history_by_gw(history: list) -> dict:
    """Aggregate DGW entries (same `round`) into one entry per GW (Pattern 4).

    Sums minutes, total_points, expected_goals, expected_assists, goals_scored, assists.
    Captures the player's own team_id from the first entry encountered for that round.
    """
    by_round: dict = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
        'goals_scored': 0, 'assists': 0,   # FRM-01
    })
    for entry in history:
        r = entry.get('round')
        if r is None:
            continue
        agg = by_round[r]
        agg['round'] = r
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['total_points'] += int(entry.get('total_points', 0) or 0)
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
        agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)   # FRM-01
        agg['assists'] += int(entry.get('assists', 0) or 0)              # FRM-01
    return dict(by_round)
```

- [ ] **Step 3: Update `_reconstruct_form_signal` to accept and use `beta`**

Find `_reconstruct_form_signal` (line ~840). Replace the entire function:

```python
def _reconstruct_form_signal(
    grouped: dict,
    current_gw: int,
    window_gws: int = FORM_WINDOW_GWS,
    min_minutes: int = FORM_MIN_MINUTES,
    beta: float = 0.0,   # FRM-01: actual G+A blend weight
) -> 'float | None':
    """Reconstruct the form signal at GW `current_gw` from STRICTLY PRIOR rounds (Phase 42 ACC-02).

    FRM-01: When beta > 0, blends actual G+A per-90 into the form signal — mirrors
    merge._compute_form_signal(beta=beta). beta=0.0 (default) is backward-compatible.

    `grouped` is the output of _group_history_by_gw — DGW already aggregated.
    We must NOT include `current_gw` itself: the player's GW-N actuals are the
    thing we are predicting; including them is a leak (Pitfall 6).

    Returns None when fewer than 3 prior played GWs exist in the window or
    total minutes < min_minutes. Otherwise returns recency-weighted blended
    per-90 (linear weights 0.5..1.0, oldest..most recent).

    Mirrors merge._compute_form_signal but operates on grouped dict + GW filter.
    """
    prior_gws = [g for g in sorted(grouped.keys()) if g < current_gw]
    if not prior_gws:
        return None
    last_gws = prior_gws[-window_gws:]
    played = [grouped[g] for g in last_gws if grouped[g]['minutes'] > 0]
    total_mins = sum(p['minutes'] for p in played)
    if len(played) < 3 or total_mins < min_minutes:
        return None

    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_actual = sum(
        (p.get('goals_scored', 0) + p.get('assists', 0)) * w   # FRM-01
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))
    if weighted_mins <= 0:
        return None
    xg_xa_per90     = (weighted_xgxa   / weighted_mins) * 90
    actual_ga_per90 = (weighted_actual / weighted_mins) * 90   # FRM-01
    return round((1.0 - beta) * xg_xa_per90 + beta * actual_ga_per90, 4)
```

- [ ] **Step 4: Add `form_actual_beta` kwarg to `build_per_gw_rows`**

Find `build_per_gw_rows` (line ~126). Add the new parameter to the signature after `cs_prob_slope`:

```python
def build_per_gw_rows(
    summaries: dict,
    target_gws: list,
    bootstrap: dict,
    fixture_difficulty: dict,
    teams_by_id: dict,
    blend_alpha: float = BLEND_ALPHA,
    form_window_gws: int = FORM_WINDOW_GWS,
    cs_prob_base: float = CS_PROB_BASE,
    cs_prob_slope: float = CS_PROB_SLOPE,
    form_actual_beta: float = FORM_ACTUAL_BETA,   # FRM-01
) -> dict:
```

Update the docstring Args block to add:
```
        form_actual_beta:  actual G+A blend weight for form signal (FRM-01).
```

Find the `_reconstruct_form_signal` call inside `build_per_gw_rows` (line ~189):

```python
form_per90_at_gw = _reconstruct_form_signal(grouped, gw, window_gws=form_window_gws)
```

Change to:

```python
form_per90_at_gw = _reconstruct_form_signal(
    grouped, gw, window_gws=form_window_gws, beta=form_actual_beta,   # FRM-01
)
```

- [ ] **Step 5: Run the accuracy test suite to verify backward compat**

```
cd pipeline && python -m pytest tests/test_accuracy.py -v --tb=short
```

Expected: all existing tests pass

- [ ] **Step 6: Run full suite**

```
cd pipeline && python -m pytest tests/ -v --tb=short
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```
git add pipeline/accuracy.py
git commit -m "feat(frm-01): mirror actual G+A blend in accuracy.py _reconstruct_form_signal"
```

---

## Task 3: Add `FORM_ACTUAL_BETA` to TUNE-01 coordinate descent

**Files:**
- Modify: `pipeline/tune.py`
- Modify: `pipeline/tests/test_tune.py` (2 new tests + 2 existing tests updated)

### Background for the implementer

`tune.py` runs coordinate descent over currently 4 parameters. It calls `build_per_gw_rows` (from `accuracy.py`) with different parameter values. The sweep loop reads prior values from `accuracy_backtest.json` summary, evaluates candidates, and promotes better values.

Each parameter follows the same pattern:
1. A constant (default value) and a candidates list
2. `_read_prior_params` reads `<name>_used` from the summary
3. `params` dict holds the current locked-in values
4. `sweep_order` list specifies the sweep sequence
5. After promotion, `promoted_params` contains the winning value

`_sweep_param` calls `build_per_gw_rows` twice: a baseline call using `params` and a candidate call using `{**params, param_name: candidate}`. Both must pass `form_actual_beta`.

The existing test `test_run_tuner_promoted_params_contains_all_four` checks for the current 4 keys — update it to include `form_actual_beta`. The existing `test_run_tuner_sweep_covers_all_parameters` similarly needs a new assertion.

---

- [ ] **Step 1: Write 2 new tests in `pipeline/tests/test_tune.py`**

Append to `TestReadPriorParams`:

```python
    def test_form_actual_beta_default_in_read_prior_params(self, tmp_path):
        """FRM-01: missing form_actual_beta_used in summary falls back to FORM_ACTUAL_BETA (0.0)."""
        from accuracy import FORM_ACTUAL_BETA
        # Summary has existing keys but NOT form_actual_beta_used
        data = {
            'summary': {
                'blend_alpha_used': 0.3,
                'form_window_gws_used': 4,
                'cs_prob_base_used': 0.45,
                'cs_prob_slope_used': 0.25,
            }
        }
        path = tmp_path / 'accuracy_backtest.json'
        path.write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert abs(params['form_actual_beta'] - FORM_ACTUAL_BETA) < 1e-9
```

Append to `TestRunTunerFull` class:

```python
    def test_form_actual_beta_in_promoted_params(self, tmp_path):
        """FRM-01: promoted_params dict contains form_actual_beta key."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'form_actual_beta' in pp
```

- [ ] **Step 2: Update 2 existing tests in `TestRunTunerFull`**

Find `test_run_tuner_sweep_covers_all_parameters` — add one assertion for the new sweep key (preserve the existing assertions unchanged):

```python
        assert 'form_actual_beta' in sweep   # FRM-01 — add this line after the existing assertions
```

Find `test_run_tuner_promoted_params_contains_all_four` — rename and add assertion:

```python
    def test_run_tuner_promoted_params_contains_all_params(self, tmp_path):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'blend_alpha' in pp
        assert 'form_window_gws' in pp
        assert 'cs_prob_base' in pp
        assert 'cs_prob_slope' in pp
        assert 'form_actual_beta' in pp   # FRM-01
```

- [ ] **Step 3: Run the tune tests to confirm they FAIL**

```
cd pipeline && python -m pytest tests/test_tune.py::TestReadPriorParams::test_form_actual_beta_default_in_read_prior_params tests/test_tune.py::TestRunTunerFull::test_form_actual_beta_in_promoted_params -v
```

Expected: FAIL — KeyError or AssertionError

- [ ] **Step 4: Update `pipeline/tune.py` — imports and candidates**

At the top of `tune.py`, update the import from `accuracy`:

```python
from accuracy import (
    build_fixture_difficulty_lookup,
    build_per_gw_rows,
    compute_metrics_for_gws,
    GATE_MARGIN_PP,
    BLEND_ALPHA,
    FORM_WINDOW_GWS,
    CS_PROB_BASE,
    CS_PROB_SLOPE,
    FORM_ACTUAL_BETA,   # FRM-01
)
```

After the existing candidates (line ~29), add:

```python
FORM_ACTUAL_BETA_CANDIDATES = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]   # FRM-01
```

- [ ] **Step 5: Update `_read_prior_params` in `pipeline/tune.py`**

Find the return dict in `_read_prior_params` (line ~57). Add the new key:

```python
    return {
        'blend_alpha':      float(summary.get('blend_alpha_used',      BLEND_ALPHA)),
        'form_window_gws':  int(  summary.get('form_window_gws_used',  FORM_WINDOW_GWS)),
        'cs_prob_base':     float(summary.get('cs_prob_base_used',     CS_PROB_BASE)),
        'cs_prob_slope':    float(summary.get('cs_prob_slope_used',    CS_PROB_SLOPE)),
        'form_actual_beta': float(summary.get('form_actual_beta_used', FORM_ACTUAL_BETA)),  # FRM-01
    }
```

Also update the except-branch fallback dict at line ~63:

```python
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, ValueError):
        return {
            'blend_alpha':      BLEND_ALPHA,
            'form_window_gws':  FORM_WINDOW_GWS,
            'cs_prob_base':     CS_PROB_BASE,
            'cs_prob_slope':    CS_PROB_SLOPE,
            'form_actual_beta': FORM_ACTUAL_BETA,   # FRM-01
        }
```

- [ ] **Step 6: Update `run_tuner` in `pipeline/tune.py`**

Find the `params` dict initialisation inside `run_tuner` (line ~254). Add the new key:

```python
    params = {
        'blend_alpha':      prior['blend_alpha'],
        'form_window_gws':  prior['form_window_gws'],
        'cs_prob_base':     prior['cs_prob_base'],
        'cs_prob_slope':    prior['cs_prob_slope'],
        'form_actual_beta': prior['form_actual_beta'],   # FRM-01
    }
```

Find the `sweep_order` list (line ~264). Add parameter 5:

```python
    sweep_order = [
        ('blend_alpha',       BLEND_ALPHA_CANDIDATES,       prior['blend_alpha']),
        ('form_window_gws',   FORM_WINDOW_CANDIDATES,        prior['form_window_gws']),
        ('cs_prob_base',      CS_PROB_BASE_CANDIDATES,       prior['cs_prob_base']),
        ('cs_prob_slope',     CS_PROB_SLOPE_CANDIDATES,      prior['cs_prob_slope']),
        ('form_actual_beta',  FORM_ACTUAL_BETA_CANDIDATES,   prior['form_actual_beta']),   # FRM-01
    ]
```

- [ ] **Step 7: Update `_sweep_param` — pass `form_actual_beta` to both `build_per_gw_rows` calls**

Inside `_sweep_param`, find the baseline `build_per_gw_rows` call (line ~158):

```python
    baseline_rows = build_per_gw_rows(
        summaries=summaries,
        target_gws=all_gws,
        bootstrap=bootstrap,
        fixture_difficulty=fixture_difficulty,
        teams_by_id=teams_by_id,
        blend_alpha=params['blend_alpha'],
        form_window_gws=params['form_window_gws'],
        cs_prob_base=params['cs_prob_base'],
        cs_prob_slope=params['cs_prob_slope'],
        form_actual_beta=params['form_actual_beta'],   # FRM-01
    )
```

Find the candidate `build_per_gw_rows` call (line ~182):

```python
        candidate_rows = build_per_gw_rows(
            summaries=summaries,
            target_gws=all_gws,
            bootstrap=bootstrap,
            fixture_difficulty=fixture_difficulty,
            teams_by_id=teams_by_id,
            blend_alpha=candidate_params['blend_alpha'],
            form_window_gws=candidate_params['form_window_gws'],
            cs_prob_base=candidate_params['cs_prob_base'],
            cs_prob_slope=candidate_params['cs_prob_slope'],
            form_actual_beta=candidate_params['form_actual_beta'],   # FRM-01
        )
```

- [ ] **Step 8: Run the tune tests**

```
cd pipeline && python -m pytest tests/test_tune.py -v --tb=short
```

Expected: all tests pass (including the 2 new ones and the 2 updated ones)

- [ ] **Step 9: Run full suite**

```
cd pipeline && python -m pytest tests/ -v --tb=short
```

Expected: all tests pass

- [ ] **Step 10: Commit**

```
git add pipeline/tune.py pipeline/tests/test_tune.py
git commit -m "feat(frm-01): add FORM_ACTUAL_BETA to TUNE-01 coordinate descent sweep"
```

---

## Task 4: Wire `form_actual_beta` through `run.py`

**Files:**
- Modify: `pipeline/run.py`

### Background for the implementer

`run.py` reads tuned parameter values from `accuracy_backtest.json` and passes them to `merge_players`. The pattern for all four existing TUNE-01 parameters is:

1. A default variable initialised before the `try` block (line ~358)
2. A read from the summary inside the `try` block (line ~369)
3. A `print` statement showing the current values (line ~380)
4. Passed as keyword argument to `merge_players` (line ~391)
5. Written back to the summary after `run_tuner` promotes values (line ~508)

`form_actual_beta` follows the same pattern as the fifth parameter. There is no test file to update for this task — run the full suite at the end to confirm nothing broke.

---

- [ ] **Step 1: Add default variable before the `try` block in `run.py`**

Find the block (line ~358):

```python
            form_window_gws_used = 5       # TUNE-01: default
            cs_prob_base_used    = 0.40    # TUNE-01: default
            cs_prob_slope_used   = 0.30    # TUNE-01: default
```

Add below it:

```python
            form_actual_beta_used = 0.0    # FRM-01: default
```

- [ ] **Step 2: Read `form_actual_beta_used` from the summary in the `try` block**

Find the try block reads (line ~369):

```python
                form_window_gws_used = int(prev_backtest.get('summary', {}).get('form_window_gws_used', 5))
                cs_prob_base_used    = float(prev_backtest.get('summary', {}).get('cs_prob_base_used', 0.40))
                cs_prob_slope_used   = float(prev_backtest.get('summary', {}).get('cs_prob_slope_used', 0.30))
```

Add below:

```python
                form_actual_beta_used = float(prev_backtest.get('summary', {}).get('form_actual_beta_used', 0.0))  # FRM-01
```

- [ ] **Step 3: Add `form_actual_beta` to the TUNE-01 print statement**

Find the print statement (line ~380):

```python
            print(f"TUNE-01 params: form_window={form_window_gws_used}, cs_prob_base={cs_prob_base_used}, cs_prob_slope={cs_prob_slope_used}")
```

Replace with:

```python
            print(f"TUNE-01 params: form_window={form_window_gws_used}, cs_prob_base={cs_prob_base_used}, cs_prob_slope={cs_prob_slope_used}, form_actual_beta={form_actual_beta_used}")
```

- [ ] **Step 4: Pass `form_actual_beta` to `merge_players`**

Find the `merge_players` call (line ~382). Add the new argument:

```python
            merged, captain_picks = merge_players(
                bootstrap, fixtures, understat, id_map,
                xmins_stats=xmins_stats,
                summaries=summaries,
                form_signal_enabled=True,
                blend_alpha=blend_alpha_used,
                xmins_v2_enabled=xmins_v2_enabled,
                bonus_stats=bonus_stats,
                bonus_predictor_enabled=bonus_predictor_enabled,
                save_predictor_enabled=save_predictor_enabled,
                cs_prob_base=cs_prob_base_used,
                cs_prob_slope=cs_prob_slope_used,
                form_window_gws=form_window_gws_used,
                form_actual_beta=form_actual_beta_used,   # FRM-01
            )
```

- [ ] **Step 5: Write `form_actual_beta_used` back to the summary after tuning**

Find the promoted_params block (line ~505):

```python
                    backtest_data['summary']['blend_alpha_used']     = pp['blend_alpha']
                    backtest_data['summary']['form_window_gws_used'] = pp['form_window_gws']
                    backtest_data['summary']['cs_prob_base_used']    = pp['cs_prob_base']
                    backtest_data['summary']['cs_prob_slope_used']   = pp['cs_prob_slope']
                    print(f"[tune] params: blend_alpha={pp['blend_alpha']}, "
                          f"form_window={pp['form_window_gws']}, "
                          f"cs_prob_base={pp['cs_prob_base']}, "
                          f"cs_prob_slope={pp['cs_prob_slope']}")
```

Replace with:

```python
                    backtest_data['summary']['blend_alpha_used']      = pp['blend_alpha']
                    backtest_data['summary']['form_window_gws_used']  = pp['form_window_gws']
                    backtest_data['summary']['cs_prob_base_used']     = pp['cs_prob_base']
                    backtest_data['summary']['cs_prob_slope_used']    = pp['cs_prob_slope']
                    backtest_data['summary']['form_actual_beta_used'] = pp['form_actual_beta']   # FRM-01
                    print(f"[tune] params: blend_alpha={pp['blend_alpha']}, "
                          f"form_window={pp['form_window_gws']}, "
                          f"cs_prob_base={pp['cs_prob_base']}, "
                          f"cs_prob_slope={pp['cs_prob_slope']}, "
                          f"form_actual_beta={pp['form_actual_beta']}")
```

- [ ] **Step 6: Run full test suite**

```
cd pipeline && python -m pytest tests/ -v --tb=short
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```
git add pipeline/run.py
git commit -m "feat(frm-01): wire form_actual_beta through run.py read/pass/write"
```
