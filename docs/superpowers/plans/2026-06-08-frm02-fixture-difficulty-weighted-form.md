# FRM-02: Fixture-Difficulty-Weighted Form Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weight each GW in the form window by opponent difficulty (FDR 1–5) so high-quality performances against tough sides carry more signal than easy-fixture output.

**Architecture:** A new `FORM_DIFFICULTY_GAMMA` scalar (default 0.0 = backward-compatible) multiplies the recency weight for each GW by `1.0 + gamma * (norm_difficulty - 0.5)`. The change flows through `merge.py` → `accuracy.py` → `tune.py` → `run.py` identically to the FRM-01 `form_actual_beta` pattern. TUNE-01 coordinate descent finds the optimal gamma each season.

**Tech Stack:** Python 3.11, pytest — no new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `pipeline/merge.py` | Add `_difficulty_factor()` helper; extend `_compute_form_signal` with `gamma`; extend `merge_players` with `form_difficulty_gamma` |
| `pipeline/accuracy.py` | Add `FORM_DIFFICULTY_GAMMA` constant; extend `_group_history_by_gw`, `_reconstruct_form_signal`, `build_per_gw_rows` |
| `pipeline/tune.py` | Import `FORM_DIFFICULTY_GAMMA`; add candidates; extend `_read_prior_params`, `params`, `sweep_order`, both `build_per_gw_rows` calls in `_sweep_param` |
| `pipeline/run.py` | Read/init/pass/write `form_difficulty_gamma_used` — identical pattern to `form_actual_beta_used` |
| `pipeline/tests/test_form_signal.py` | Append 7 new FRM-02 tests |
| `pipeline/tests/test_tune.py` | 2 new tests + 3 updated tests; update `TestSweepParam` params dicts |
| `pipeline/tests/test_run.py` | Extend `_read_tuner_params` helper + both contract tests |

---

## Task 1: `_difficulty_factor` helper + `_compute_form_signal` gamma param

**Files:**
- Modify: `pipeline/merge.py`
- Modify: `pipeline/tests/test_form_signal.py`

### Scene

`_compute_form_signal` (around line 541) currently weights GWs by recency only. We add a `_difficulty_factor` module-level helper just before it, then thread `gamma` through the function and up to `merge_players`.

The FPL element-summary history entries already carry a `difficulty` field (int, 1–5 FDR). We accumulate `difficulty_sum` and `difficulty_n` in the DGW aggregation dict and average them per round before computing the factor.

- [ ] **Step 1: Write the 7 failing FRM-02 tests**

Append to `pipeline/tests/test_form_signal.py` after the last FRM-01 test (line 167):

```python
# ── FRM-02: fixture-difficulty-weighted form tests ───────────────────────────

def test_gamma_zero_backward_compatible():
    """FRM-02: gamma=0.0 (default) produces identical result when difficulty absent."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1}
        for i in range(1, 6)
    ]
    result_default, n1 = _compute_form_signal(history)
    result_explicit, n2 = _compute_form_signal(history, gamma=0.0)
    assert result_default == result_explicit
    assert n1 == n2 == 5


def test_gamma_one_hard_fixture_higher_weight():
    """FRM-02: at gamma=1.0, difficulty-5 GW contributes more than difficulty-1 GW.

    5 GWs, same xG+xA=0.5 each, alternating difficulty 5/1/5/1/5.
    Hard GWs (difficulty=5) get factor=1.5; easy GWs get factor=0.5.
    So hard-GW weight = recency * 1.5; easy-GW weight = recency * 0.5.
    With recency weights [0.5, 0.625, 0.75, 0.875, 1.0]:
      w=[0.5*1.5, 0.625*0.5, 0.75*1.5, 0.875*0.5, 1.0*1.5]
       =[0.75,    0.3125,    1.125,    0.4375,    1.5]
    The result must NOT equal gamma=0.0 result (same xG+xA but harder GWs weighted up).
    """
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.5, 'expected_assists': 0.0,
         'difficulty': 5 if i % 2 == 1 else 1}
        for i in range(1, 6)
    ]
    form_no_weight, _ = _compute_form_signal(history, gamma=0.0)
    form_weighted, _ = _compute_form_signal(history, gamma=1.0)
    assert form_no_weight is not None
    assert form_weighted is not None
    # gamma=0.0: all GWs weighted equally by recency → per-90 = 0.5 (constant xG)
    # gamma=1.0: hard GWs up-weighted → harder GWs dominate → form > gamma=0 (hard GWs are latest: 1,3,5)
    # Round 5 (hardest, most recent, weight=1.5) dominates → result > gamma=0 baseline
    assert abs(form_no_weight - 0.5) < 0.01  # sanity: same xG every GW → 0.5 per90
    assert form_weighted != form_no_weight    # difficulty weighting changed the result


def test_gamma_half_is_between_zero_and_one():
    """FRM-02: gamma=0.5 result is between gamma=0.0 and gamma=1.0 results."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.5, 'expected_assists': 0.0,
         'difficulty': 5 if i % 2 == 1 else 1}
        for i in range(1, 6)
    ]
    form_0, _ = _compute_form_signal(history, gamma=0.0)
    form_1, _ = _compute_form_signal(history, gamma=1.0)
    form_half, _ = _compute_form_signal(history, gamma=0.5)
    assert form_half is not None
    assert min(form_0, form_1) <= form_half <= max(form_0, form_1)


def test_hard_fixture_scorer_higher_with_positive_gamma():
    """FRM-02: player whose xG+xA came in difficulty-5 GWs gets higher form at gamma>0."""
    # Rounds 4 and 5 (most recent) have difficulty=5 and high xG; rounds 1-3 easy + low xG
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 4, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 5, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
    ]
    form_base, _ = _compute_form_signal(history, gamma=0.0)
    form_diff, _ = _compute_form_signal(history, gamma=0.4)
    # Most recent hard GWs are up-weighted → form_diff > form_base
    assert form_diff > form_base


def test_easy_fixture_scorer_lower_with_positive_gamma():
    """FRM-02: player whose xG+xA came in difficulty-1 GWs gets lower form at gamma>0."""
    # Rounds 4 and 5 (most recent) have difficulty=1 and high xG; rounds 1-3 hard + low xG
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 4, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 5, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
    ]
    form_base, _ = _compute_form_signal(history, gamma=0.0)
    form_diff, _ = _compute_form_signal(history, gamma=0.4)
    # Most recent easy GWs are down-weighted → form_diff < form_base
    assert form_diff < form_base


def test_missing_difficulty_defaults_to_midrange():
    """FRM-02: history entries without 'difficulty' key treated as difficulty=3 (factor=1.0)."""
    history_no_diff = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1}
        for i in range(1, 6)
    ]
    history_mid_diff = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'difficulty': 3}
        for i in range(1, 6)
    ]
    form_no, n1 = _compute_form_signal(history_no_diff, gamma=0.8)
    form_mid, n2 = _compute_form_signal(history_mid_diff, gamma=0.8)
    assert form_no == form_mid
    assert n1 == n2 == 5


def test_dgw_difficulty_averaged():
    """FRM-02: DGW round averages difficulty across both entries.

    Round 3 has two entries with difficulty=2 and difficulty=4 → avg=3 → factor=1.0 at any gamma.
    So at gamma=1.0 the DGW round behaves identically to gamma=0.0 for that round.
    """
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 3},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 3},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 2},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 4},
    ]
    # avg difficulty for round 3 = (2+4)/2 = 3 → norm=0.5 → factor = 1.0 + gamma*(0.5-0.5) = 1.0
    # So gamma=1.0 result must equal gamma=0.0 result (all factors are 1.0)
    form_0, n0 = _compute_form_signal(history, gamma=0.0)
    form_1, n1 = _compute_form_signal(history, gamma=1.0)
    assert n0 == n1 == 3
    assert form_0 == form_1
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest tests/test_form_signal.py -k "frm02 or gamma or difficulty" -v
```

Expected: 7 failures — `TypeError: _compute_form_signal() got an unexpected keyword argument 'gamma'`

- [ ] **Step 3: Add `_difficulty_factor` helper to `merge.py`**

Insert this module-level function immediately **before** the `def _compute_form_signal(` line (currently around line 541). Do not place it inside `_compute_form_signal`.

```python
def _difficulty_factor(agg: dict, gamma: float) -> float:
    """FRM-02: compute difficulty weight multiplier for one aggregated GW.

    gamma=0.0 fast-path returns 1.0 (no-op — backward-compatible with pre-FRM-02).
    avg_diff defaults to 3.0 (mid-range, FDR=3) when no difficulty data is present,
    giving a factor of exactly 1.0 regardless of gamma.

    Args:
        agg:   aggregated GW dict with 'difficulty_sum' and 'difficulty_n' keys.
               Uses .get() so old test fixtures lacking these keys are safe.
        gamma: difficulty scaling factor; 0.0 = no-op.

    Returns:
        float multiplier in range [1 + gamma*(0-0.5), 1 + gamma*(1-0.5)]
        = [1 - 0.5*gamma, 1 + 0.5*gamma].
    """
    if gamma == 0.0:
        return 1.0
    avg_diff = agg.get('difficulty_sum', 0.0) / max(agg.get('difficulty_n', 0), 1)
    norm = (avg_diff - 1) / 4   # FDR 1–5 → 0.0–1.0
    return 1.0 + gamma * (norm - 0.5)
```

- [ ] **Step 4: Extend `_compute_form_signal` signature**

Find `def _compute_form_signal(` and add the `gamma` parameter:

```python
def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,
    beta: float = 0.0,    # FRM-01: actual G+A blend weight; 0.0 = pure xG+xA (backward-compatible)
    gamma: float = 0.0,   # FRM-02: difficulty weight scaling; 0.0 = current behaviour (backward-compatible)
) -> tuple:
```

Also update the docstring to mention FRM-02:

```
FRM-02: When gamma > 0, each GW weight is multiplied by _difficulty_factor(agg, gamma),
which up-weights performances against tough opponents (high FDR) and down-weights
easy-fixture output. gamma=0.0 (default) is the arithmetic identity.
```

- [ ] **Step 5: Extend the DGW aggregation dict to collect difficulty**

Find the `by_round.setdefault(r, {...})` block inside `_compute_form_signal`. Change it from:

```python
        agg = by_round.setdefault(r, {
            'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0,
            'goals_scored': 0, 'assists': 0,   # FRM-01
        })
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
        agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)   # FRM-01
        agg['assists']      += int(entry.get('assists', 0) or 0)        # FRM-01
```

To:

```python
        agg = by_round.setdefault(r, {
            'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0,
            'goals_scored': 0, 'assists': 0,           # FRM-01
            'difficulty_sum': 0.0, 'difficulty_n': 0,  # FRM-02
        })
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
        agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)   # FRM-01
        agg['assists']      += int(entry.get('assists', 0) or 0)        # FRM-01
        agg['difficulty_sum'] += float(entry.get('difficulty', 3) or 3)  # FRM-02
        agg['difficulty_n']   += 1                                        # FRM-02
```

- [ ] **Step 6: Replace recency-only weights with combined weights**

Find the weights computation block:

```python
    # Linear recency weights: oldest=0.5, most recent=1.0
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
```

Replace with:

```python
    # Linear recency weights: oldest=0.5, most recent=1.0
    n = len(played)
    recency_weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
    # FRM-02: multiply by difficulty factor (no-op when gamma=0.0)
    weights = [
        rw * _difficulty_factor(p, gamma)
        for rw, p in zip(recency_weights, played)
    ]
```

- [ ] **Step 7: Extend `merge_players` signature and call site**

In `merge_players` function signature, add the new parameter after `form_actual_beta`:

```python
    form_actual_beta: float = 0.0,          # FRM-01: actual G+A blend weight, tunable via TUNE-01
    form_difficulty_gamma: float = 0.0,     # FRM-02: difficulty weight scaling, tunable via TUNE-01
```

Add a docstring Args entry for `form_difficulty_gamma` after the `form_actual_beta` entry:

```
        form_difficulty_gamma: FRM-02. Difficulty weight scaling for form signal.
                             Each GW weight is multiplied by
                             1 + gamma * (norm_fdr - 0.5), where norm_fdr normalises
                             FDR 1–5 to 0–1. Default 0.0 = no scaling (backward-compatible).
                             Tunable via TUNE-01 coordinate descent.
```

Find the `_compute_form_signal` call (look for `beta=form_actual_beta`):

```python
            form_per90, form_n_gws = _compute_form_signal(
                summaries[fpl_id].get('history', []),
                window_gws=form_window_gws,
                beta=form_actual_beta,   # FRM-01
            )
```

Change to:

```python
            form_per90, form_n_gws = _compute_form_signal(
                summaries[fpl_id].get('history', []),
                window_gws=form_window_gws,
                beta=form_actual_beta,       # FRM-01
                gamma=form_difficulty_gamma, # FRM-02
            )
```

- [ ] **Step 8: Run all form signal tests**

```
cd pipeline && python -m pytest tests/test_form_signal.py -v
```

Expected: **18 passed** (11 pre-existing + 7 new FRM-02 tests). Zero failures.

- [ ] **Step 9: Commit**

```
git add pipeline/merge.py pipeline/tests/test_form_signal.py
git commit -m "feat(frm-02): add gamma param to _compute_form_signal for difficulty-weighted form"
```

---

## Task 2: Mirror in `accuracy.py`

**Files:**
- Modify: `pipeline/accuracy.py`

### Scene

`accuracy.py`'s `_reconstruct_form_signal` mirrors `merge.py`'s `_compute_form_signal`. It must get the same `gamma` treatment. `_group_history_by_gw` needs to track `difficulty_sum`/`difficulty_n`, and `build_per_gw_rows` gets the new `form_difficulty_gamma` kwarg.

`_difficulty_factor` is **duplicated inline** in accuracy.py (three lines) rather than imported from merge.py, to avoid a cross-module import at module level. The `.get()` defaults make it safe for old test fixtures that lack `difficulty_sum`/`difficulty_n`.

- [ ] **Step 1: Add the `FORM_DIFFICULTY_GAMMA` constant**

Find the constants block near the top of `accuracy.py`. Add immediately after the `FORM_ACTUAL_BETA` line:

```python
FORM_ACTUAL_BETA = 0.0       # FRM-01: actual G+A blend weight (default 0.0 = pure xG+xA)
FORM_DIFFICULTY_GAMMA = 0.0  # FRM-02: difficulty weight scaling (default 0.0 = no-op)
```

- [ ] **Step 2: Run existing tests to establish baseline**

```
cd pipeline && python -m pytest tests/test_accuracy.py tests/test_form_signal.py -q
```

Expected: all pass. Note the count.

- [ ] **Step 3: Extend `_group_history_by_gw` defaultdict and loop**

Find `_group_history_by_gw`. Its `defaultdict` currently has:

```python
    by_round: dict = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
        'goals_scored': 0, 'assists': 0,   # FRM-01
    })
```

Change to:

```python
    by_round: dict = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
        'goals_scored': 0, 'assists': 0,           # FRM-01
        'difficulty_sum': 0.0, 'difficulty_n': 0,  # FRM-02
    })
```

In the loop body, after the `agg['assists'] += ...` line, add:

```python
        agg['difficulty_sum'] += float(entry.get('difficulty', 3) or 3)   # FRM-02
        agg['difficulty_n']   += 1                                          # FRM-02
```

- [ ] **Step 4: Extend `_reconstruct_form_signal` with `gamma`**

Find `def _reconstruct_form_signal(`. Its current signature is:

```python
def _reconstruct_form_signal(
    grouped: dict,
    current_gw: int,
    window_gws: int = FORM_WINDOW_GWS,
    min_minutes: int = FORM_MIN_MINUTES,
    beta: float = 0.0,   # FRM-01: actual G+A blend weight
) -> 'float | None':
```

Change to:

```python
def _reconstruct_form_signal(
    grouped: dict,
    current_gw: int,
    window_gws: int = FORM_WINDOW_GWS,
    min_minutes: int = FORM_MIN_MINUTES,
    beta: float = 0.0,    # FRM-01: actual G+A blend weight
    gamma: float = 0.0,   # FRM-02: difficulty weight scaling
) -> 'float | None':
```

Also update the docstring to mention FRM-02:

```
FRM-02: When gamma > 0, each GW weight is multiplied by a difficulty factor derived from
the averaged FDR (1–5) stored in the grouped dict. gamma=0.0 (default) is the arithmetic identity.
```

Now replace the weights computation. Find this block inside `_reconstruct_form_signal`:

```python
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
```

Replace with:

```python
    n = len(played)
    recency_weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
    # FRM-02: difficulty factor (duplicated from merge._difficulty_factor to avoid cross-module import)
    def _diff_factor(agg: dict, g: float) -> float:
        if g == 0.0:
            return 1.0
        avg_d = agg.get('difficulty_sum', 0.0) / max(agg.get('difficulty_n', 0), 1)
        return 1.0 + g * ((avg_d - 1) / 4 - 0.5)
    weights = [rw * _diff_factor(p, gamma) for rw, p in zip(recency_weights, played)]
```

- [ ] **Step 5: Extend `build_per_gw_rows` signature and call site**

Find `def build_per_gw_rows(`. Add the new parameter after `form_actual_beta`:

```python
    form_actual_beta: float = FORM_ACTUAL_BETA,    # FRM-01
    form_difficulty_gamma: float = FORM_DIFFICULTY_GAMMA,  # FRM-02
```

Add to the docstring Args block (after the `form_actual_beta` entry):

```
        form_difficulty_gamma: difficulty weight scaling for form signal (FRM-02).
```

Find the `_reconstruct_form_signal` call inside `build_per_gw_rows`:

```python
            form_per90_at_gw = _reconstruct_form_signal(
                grouped, gw, window_gws=form_window_gws, beta=form_actual_beta,   # FRM-01
            )
```

Change to:

```python
            form_per90_at_gw = _reconstruct_form_signal(
                grouped, gw, window_gws=form_window_gws,
                beta=form_actual_beta,           # FRM-01
                gamma=form_difficulty_gamma,     # FRM-02
            )
```

- [ ] **Step 6: Run all accuracy and form signal tests**

```
cd pipeline && python -m pytest tests/test_accuracy.py tests/test_form_signal.py -v 2>&1 | tail -20
```

Expected: all pass (same count as baseline + 18 form signal tests).

- [ ] **Step 7: Commit**

```
git add pipeline/accuracy.py
git commit -m "feat(frm-02): mirror difficulty-weighted form in accuracy.py _reconstruct_form_signal"
```

---

## Task 3: Add `FORM_DIFFICULTY_GAMMA` to TUNE-01

**Files:**
- Modify: `pipeline/tune.py`
- Modify: `pipeline/tests/test_tune.py`

### Scene

TUNE-01 coordinate descent sweeps 5 parameters. We add `form_difficulty_gamma` as parameter 6. The pattern is identical to `form_actual_beta` (Task 3 of FRM-01): import the constant, add candidates, update `_read_prior_params` (both branches), extend `params` and `sweep_order` in `run_tuner`, and pass it through both `build_per_gw_rows` calls in `_sweep_param`.

- [ ] **Step 1: Write the new failing tests for `test_tune.py`**

First, note the current state of `TestSweepParam` — it has `params` dicts that need `'form_difficulty_gamma': 0.0` added. Also add 2 new tests and update 3 existing ones.

**a) Update `TestSweepParam` — add `'form_difficulty_gamma': 0.0` to ALL params dicts in that class.**

Find `class TestSweepParam:`. There are two params dicts:

```python
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30,
                  'form_actual_beta': 0.0}
```

Change both to:

```python
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30,
                  'form_actual_beta': 0.0, 'form_difficulty_gamma': 0.0}
```

**b) In `TestReadPriorParams`, add:**

```python
    def test_form_difficulty_gamma_default_in_read_prior_params(self, tmp_path):
        """Missing form_difficulty_gamma_used in summary → returns FORM_DIFFICULTY_GAMMA (0.0)."""
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert abs(params['form_difficulty_gamma'] - FORM_DIFFICULTY_GAMMA) < 1e-9
```

**c) In `test_run_tuner_sweep_covers_all_parameters`, add one assertion:**

```python
        assert 'form_difficulty_gamma' in sweep
```

**d) In `test_run_tuner_promoted_params_contains_all_params`, add one assertion:**

```python
        assert 'form_difficulty_gamma' in pp
```

**e) In `test_coordinate_locking_uses_prior_sweep_value`, add one assertion:**

```python
        assert result['promoted_params']['form_difficulty_gamma'] == result['sweep']['form_difficulty_gamma']['best']
```

Also update its docstring from "five sweeps" to "six sweeps".

**f) Add new test in `TestRunTunerFull`:**

```python
    def test_form_difficulty_gamma_in_promoted_params(self, tmp_path):
        """promoted_params dict contains form_difficulty_gamma key with value in [0.0, 1.0]."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'form_difficulty_gamma' in pp
        assert pp['form_difficulty_gamma'] >= 0.0
        assert pp['form_difficulty_gamma'] <= 1.0
```

Also update the imports in `test_tune.py` — add `FORM_DIFFICULTY_GAMMA_CANDIDATES` to the tune imports and `FORM_DIFFICULTY_GAMMA` to the accuracy imports:

```python
from tune import (
    _promotion_gates,
    _combined_score,
    _read_prior_params,
    run_tuner,
    MIN_FINISHED_GWS,
    BLEND_ALPHA_CANDIDATES,
    FORM_WINDOW_CANDIDATES,
    CS_PROB_BASE_CANDIDATES,
    CS_PROB_SLOPE_CANDIDATES,
    FORM_ACTUAL_BETA_CANDIDATES,
    FORM_DIFFICULTY_GAMMA_CANDIDATES,   # FRM-02
)
from tune import _sweep_param
from accuracy import build_fixture_difficulty_lookup, FORM_ACTUAL_BETA, FORM_DIFFICULTY_GAMMA  # FRM-02
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```
cd pipeline && python -m pytest tests/test_tune.py -k "difficulty" -v
```

Expected: ImportError or KeyError — `FORM_DIFFICULTY_GAMMA_CANDIDATES` not in tune yet.

- [ ] **Step 3: Update `tune.py` imports**

Find the `from accuracy import (...)` block:

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
    FORM_ACTUAL_BETA,
)
```

Change to:

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
    FORM_ACTUAL_BETA,
    FORM_DIFFICULTY_GAMMA,   # FRM-02
)
```

- [ ] **Step 4: Add candidates constant**

Find the candidates block (lines with `BLEND_ALPHA_CANDIDATES`, `FORM_WINDOW_CANDIDATES`, etc.). Add after `FORM_ACTUAL_BETA_CANDIDATES`:

```python
FORM_ACTUAL_BETA_CANDIDATES = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
FORM_DIFFICULTY_GAMMA_CANDIDATES = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]  # FRM-02
```

- [ ] **Step 5: Update `_read_prior_params` — both return paths**

Find the `try` block return:

```python
        return {
            'blend_alpha':       float(summary.get('blend_alpha_used', BLEND_ALPHA)),
            'form_window_gws':   int(summary.get('form_window_gws_used', FORM_WINDOW_GWS)),
            'cs_prob_base':      float(summary.get('cs_prob_base_used', CS_PROB_BASE)),
            'cs_prob_slope':     float(summary.get('cs_prob_slope_used', CS_PROB_SLOPE)),
            'form_actual_beta':  float(summary.get('form_actual_beta_used', FORM_ACTUAL_BETA)),
        }
```

Change to:

```python
        return {
            'blend_alpha':            float(summary.get('blend_alpha_used', BLEND_ALPHA)),
            'form_window_gws':        int(summary.get('form_window_gws_used', FORM_WINDOW_GWS)),
            'cs_prob_base':           float(summary.get('cs_prob_base_used', CS_PROB_BASE)),
            'cs_prob_slope':          float(summary.get('cs_prob_slope_used', CS_PROB_SLOPE)),
            'form_actual_beta':       float(summary.get('form_actual_beta_used', FORM_ACTUAL_BETA)),
            'form_difficulty_gamma':  float(summary.get('form_difficulty_gamma_used', FORM_DIFFICULTY_GAMMA)),  # FRM-02
        }
```

Find the `except` block return:

```python
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, ValueError):
        return {
            'blend_alpha':      BLEND_ALPHA,
            'form_window_gws':  FORM_WINDOW_GWS,
            'cs_prob_base':     CS_PROB_BASE,
            'cs_prob_slope':    CS_PROB_SLOPE,
            'form_actual_beta': FORM_ACTUAL_BETA,
        }
```

Change to:

```python
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, ValueError):
        return {
            'blend_alpha':           BLEND_ALPHA,
            'form_window_gws':       FORM_WINDOW_GWS,
            'cs_prob_base':          CS_PROB_BASE,
            'cs_prob_slope':         CS_PROB_SLOPE,
            'form_actual_beta':      FORM_ACTUAL_BETA,
            'form_difficulty_gamma': FORM_DIFFICULTY_GAMMA,   # FRM-02
        }
```

- [ ] **Step 6: Update `params` dict in `run_tuner`**

Find the `params = {` block:

```python
    params = {
        'blend_alpha':      prior['blend_alpha'],
        'form_window_gws':  prior['form_window_gws'],
        'cs_prob_base':     prior['cs_prob_base'],
        'cs_prob_slope':    prior['cs_prob_slope'],
        'form_actual_beta': prior['form_actual_beta'],
    }
```

Change to:

```python
    params = {
        'blend_alpha':           prior['blend_alpha'],
        'form_window_gws':       prior['form_window_gws'],
        'cs_prob_base':          prior['cs_prob_base'],
        'cs_prob_slope':         prior['cs_prob_slope'],
        'form_actual_beta':      prior['form_actual_beta'],
        'form_difficulty_gamma': prior['form_difficulty_gamma'],   # FRM-02
    }
```

- [ ] **Step 7: Add 6th entry to `sweep_order`**

Find:

```python
    sweep_order = [
        ('blend_alpha',      BLEND_ALPHA_CANDIDATES,        prior['blend_alpha']),
        ('form_window_gws',  FORM_WINDOW_CANDIDATES,        prior['form_window_gws']),
        ('cs_prob_base',     CS_PROB_BASE_CANDIDATES,       prior['cs_prob_base']),
        ('cs_prob_slope',    CS_PROB_SLOPE_CANDIDATES,      prior['cs_prob_slope']),
        ('form_actual_beta', FORM_ACTUAL_BETA_CANDIDATES,   prior['form_actual_beta']),
    ]
```

Change to:

```python
    sweep_order = [
        ('blend_alpha',           BLEND_ALPHA_CANDIDATES,            prior['blend_alpha']),
        ('form_window_gws',       FORM_WINDOW_CANDIDATES,            prior['form_window_gws']),
        ('cs_prob_base',          CS_PROB_BASE_CANDIDATES,           prior['cs_prob_base']),
        ('cs_prob_slope',         CS_PROB_SLOPE_CANDIDATES,          prior['cs_prob_slope']),
        ('form_actual_beta',      FORM_ACTUAL_BETA_CANDIDATES,       prior['form_actual_beta']),
        ('form_difficulty_gamma', FORM_DIFFICULTY_GAMMA_CANDIDATES,  prior['form_difficulty_gamma']),  # FRM-02
    ]
```

- [ ] **Step 8: Add `form_difficulty_gamma` to both `build_per_gw_rows` calls in `_sweep_param`**

Find the baseline `build_per_gw_rows` call:

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
        form_actual_beta=params['form_actual_beta'],
    )
```

Change to:

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
        form_actual_beta=params['form_actual_beta'],
        form_difficulty_gamma=params['form_difficulty_gamma'],   # FRM-02
    )
```

Find the candidate `build_per_gw_rows` call:

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
            form_actual_beta=candidate_params['form_actual_beta'],
        )
```

Change to:

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
            form_actual_beta=candidate_params['form_actual_beta'],
            form_difficulty_gamma=candidate_params['form_difficulty_gamma'],   # FRM-02
        )
```

- [ ] **Step 9: Run all tune tests**

```
cd pipeline && python -m pytest tests/test_tune.py -v 2>&1 | tail -20
```

Expected: all pass (28 tests — 26 existing + 2 new FRM-02 tests).

- [ ] **Step 10: Commit**

```
git add pipeline/tune.py pipeline/tests/test_tune.py
git commit -m "feat(frm-02): add FORM_DIFFICULTY_GAMMA as parameter 6 in tune.py coordinate descent"
```

---

## Task 4: Wire `form_difficulty_gamma` through `run.py`

**Files:**
- Modify: `pipeline/run.py`
- Modify: `pipeline/tests/test_run.py`

### Scene

Identical pattern to FRM-01's `form_actual_beta_used`. Four changes: (1) initialise before try, (2) read from prior summary inside try, (3) pass to `merge_players`, (4) write back after tuning.

- [ ] **Step 1: Initialise `form_difficulty_gamma_used` before the try block**

Find the line:

```python
            form_actual_beta_used = accuracy.FORM_ACTUAL_BETA  # FRM-01: default
```

Add immediately after it:

```python
            form_difficulty_gamma_used = accuracy.FORM_DIFFICULTY_GAMMA  # FRM-02: default
```

- [ ] **Step 2: Read from prior summary inside the try block**

Find:

```python
                form_actual_beta_used = float(prev_backtest.get('summary', {}).get('form_actual_beta_used', accuracy.FORM_ACTUAL_BETA))
```

Add immediately after it:

```python
                form_difficulty_gamma_used = float(prev_backtest.get('summary', {}).get('form_difficulty_gamma_used', accuracy.FORM_DIFFICULTY_GAMMA))  # FRM-02
```

- [ ] **Step 3: Update the TUNE-01 print line**

Find:

```python
            print(f"TUNE-01 params: form_window={form_window_gws_used}, cs_prob_base={cs_prob_base_used}, cs_prob_slope={cs_prob_slope_used}, form_actual_beta={form_actual_beta_used}")
```

Change to:

```python
            print(f"TUNE-01 params: form_window={form_window_gws_used}, cs_prob_base={cs_prob_base_used}, cs_prob_slope={cs_prob_slope_used}, form_actual_beta={form_actual_beta_used}, form_difficulty_gamma={form_difficulty_gamma_used}")
```

- [ ] **Step 4: Pass to `merge_players`**

Find the `merge_players(...)` call. Add `form_difficulty_gamma=form_difficulty_gamma_used` after `form_actual_beta=form_actual_beta_used`:

```python
            merged, captain_picks = merge_players(
                bootstrap, fixtures, understat, id_map,
                xmins_stats=xmins_stats, summaries=summaries,
                form_signal_enabled=form_signal_enabled,
                blend_alpha=blend_alpha_used,
                xmins_v2_enabled=xmins_v2_enabled,
                bonus_stats=bonus_stats,
                bonus_predictor_enabled=bonus_predictor_enabled,
                save_predictor_enabled=save_predictor_enabled,
                cs_prob_base=cs_prob_base_used,
                cs_prob_slope=cs_prob_slope_used,
                form_window_gws=form_window_gws_used,
                form_actual_beta=form_actual_beta_used,           # FRM-01
                form_difficulty_gamma=form_difficulty_gamma_used, # FRM-02
            )
```

- [ ] **Step 5: Write promoted value back to summary after tuning**

Find:

```python
                    backtest_data['summary']['form_actual_beta_used'] = pp['form_actual_beta']
```

Add immediately after it:

```python
                    backtest_data['summary']['form_difficulty_gamma_used'] = pp['form_difficulty_gamma']  # FRM-02
```

- [ ] **Step 6: Update the `[tune]` print line**

Find:

```python
                    print(f"[tune] params: blend_alpha={pp['blend_alpha']}, "
                          f"form_window={pp['form_window_gws']}, "
                          f"cs_prob_base={pp['cs_prob_base']}, "
                          f"cs_prob_slope={pp['cs_prob_slope']}, "
                          f"form_actual_beta={pp['form_actual_beta']}")
```

Change to:

```python
                    print(f"[tune] params: blend_alpha={pp['blend_alpha']}, "
                          f"form_window={pp['form_window_gws']}, "
                          f"cs_prob_base={pp['cs_prob_base']}, "
                          f"cs_prob_slope={pp['cs_prob_slope']}, "
                          f"form_actual_beta={pp['form_actual_beta']}, "
                          f"form_difficulty_gamma={pp['form_difficulty_gamma']}")
```

- [ ] **Step 7: Update `test_run.py` contract helper and tests**

Find `def _read_tuner_params(cache_dir: str) -> dict:` and apply these changes:

Add `form_difficulty_gamma_used = 0.0` after `form_actual_beta_used = 0.0`:

```python
    form_actual_beta_used = 0.0
    form_difficulty_gamma_used = 0.0   # FRM-02
```

Add `form_difficulty_gamma_used = float(summary.get('form_difficulty_gamma_used', 0.0))` after the `form_actual_beta_used` read:

```python
        form_actual_beta_used = float(summary.get('form_actual_beta_used', 0.0))
        form_difficulty_gamma_used = float(summary.get('form_difficulty_gamma_used', 0.0))  # FRM-02
```

Add `'form_difficulty_gamma_used': form_difficulty_gamma_used` to the returned dict:

```python
    return {
        'form_window_gws_used': form_window_gws_used,
        'cs_prob_base_used':    cs_prob_base_used,
        'cs_prob_slope_used':   cs_prob_slope_used,
        'form_actual_beta_used': form_actual_beta_used,
        'form_difficulty_gamma_used': form_difficulty_gamma_used,   # FRM-02
    }
```

In `test_read_tuner_params_defaults_on_missing_file`, add:

```python
        assert abs(params['form_difficulty_gamma_used'] - 0.0) < 1e-9
```

In `test_read_tuner_params_reads_promoted_values`, add `'form_difficulty_gamma_used': 0.4` to the data dict:

```python
        data = {'summary': {
            'form_window_gws_used': 4,
            'cs_prob_base_used': 0.45,
            'cs_prob_slope_used': 0.25,
            'form_actual_beta_used': 0.3,
            'form_difficulty_gamma_used': 0.4,   # FRM-02
        }}
```

And add the assertion:

```python
        assert abs(params['form_difficulty_gamma_used'] - 0.4) < 1e-9
```

- [ ] **Step 8: Run all pipeline tests**

```
cd pipeline && python -m pytest tests/ -q 2>&1 | tail -10
```

Expected: all pass. The total should be 458 + 10 = **468 tests** (7 new form signal + 2 new tune + 1 new assertion = ~10 net new tests depending on exact counting).

- [ ] **Step 9: Commit**

```
git add pipeline/run.py pipeline/tests/test_run.py
git commit -m "feat(frm-02): wire form_difficulty_gamma through run.py (read/pass/write)"
```

---

## Self-Review Checklist

After all 4 tasks are complete, run the full test suite one final time:

```
cd pipeline && python -m pytest tests/ -v 2>&1 | tail -20
```

Confirm:
- All tests pass
- `test_gamma_zero_backward_compatible` passes (backward compatibility)
- `test_coordinate_locking_uses_prior_sweep_value` passes (6th sweep included)
