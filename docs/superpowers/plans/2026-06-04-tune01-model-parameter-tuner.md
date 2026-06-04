# TUNE-01 Model Parameter Tuner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coordinate-descent parameter tuner to the pipeline that automatically finds better values for `BLEND_ALPHA`, `FORM_WINDOW_GWS`, `cs_prob_base`, and `cs_prob_slope` using a three-metric hold-out validated backtest, promoting improvements safely via the existing gate-flag pattern.

**Architecture:** A new `pipeline/tune.py` module reuses `_reconstruct_xpts` and `_reconstruct_form_signal` from `accuracy.py` to evaluate each parameter candidate over all finished GWs, split into train/validate sets. `run.py` calls `tune.run_tuner()` after the accuracy backtest and merges the result into `accuracy_backtest.json`. Promoted values land in `summary` and are read back the same way `blend_alpha_used` is today.

**Tech Stack:** Python 3.11, pytest, no new dependencies. All computation is pure arithmetic — no HTTP calls, no new file I/O beyond reading/writing the existing `accuracy_backtest.json`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `pipeline/merge.py` | Modify | Add `cs_prob_base`, `cs_prob_slope` kwargs to `_cs_prob`, `_compute_xpts_fixture`, `_cs_prob_1gw_for_fixtures`, `_xpts_ngw`, `_xpts_per_gw`; add `cs_prob_base`, `cs_prob_slope`, `form_window_gws` to `merge_players` |
| `pipeline/accuracy.py` | Modify | Add `cs_prob_base`, `cs_prob_slope`, `form_window_gws` kwargs to `_reconstruct_xpts`, `_reconstruct_xpts_with_form`, `compute_accuracy_backtest`; add public `build_fixture_difficulty_lookup()`, `build_per_gw_rows()`, `compute_metrics_for_gws()`; refactor `compute_accuracy_backtest` to use `build_per_gw_rows` |
| `pipeline/tune.py` | Create | `_promotion_gates()`, `_combined_score()`, `_read_prior_params()`, `_sweep_param()`, `run_tuner()` |
| `pipeline/run.py` | Modify | Read `cs_prob_base_used`, `cs_prob_slope_used`, `form_window_gws_used` from prior backtest; pass all four tuned params to `merge_players()` and `compute_accuracy_backtest()`; call `tune.run_tuner()` and merge result before saving |
| `pipeline/tests/test_merge.py` | Modify | Add tests for `cs_prob_base`/`cs_prob_slope` kwargs backward compatibility and effect |
| `pipeline/tests/test_accuracy.py` | Modify | Add tests for `build_per_gw_rows()` and `compute_metrics_for_gws()` |
| `pipeline/tests/test_tune.py` | Create | All tuner tests: promotion gates, sweep, coordinate descent, skipping logic |

**All test commands are run from the `pipeline/` directory.**

---

## Task 1: Parameterise `_cs_prob` and `_compute_xpts_fixture` in merge.py

**Files:**
- Modify: `pipeline/merge.py:184-208` (`_cs_prob`)
- Modify: `pipeline/merge.py:248-333` (`_compute_xpts_fixture`)
- Modify: `pipeline/merge.py:211-245` (`_cs_prob_1gw_for_fixtures`)
- Test: `pipeline/tests/test_merge.py`

- [ ] **Step 1: Write failing tests for cs_prob kwargs**

Add to `pipeline/tests/test_merge.py` (after existing imports):

```python
from merge import _cs_prob, _compute_xpts_fixture, _cs_prob_1gw_for_fixtures


class TestCsProbKwargs:
    def test_default_values_unchanged(self):
        """Default call must produce same result as before — backward compat."""
        result = _cs_prob(0.5, 60.0)
        # cs_prob_raw = max(0.10, min(0.65, 0.40 - 0.5*0.30)) = 0.25; mins_factor = 1.0
        assert abs(result - 0.25) < 1e-9

    def test_custom_base_raises_cs_prob(self):
        """Higher cs_prob_base → higher cs_prob output."""
        default = _cs_prob(0.0, 90.0)
        custom  = _cs_prob(0.0, 90.0, cs_prob_base=0.55)
        assert custom > default

    def test_custom_slope_changes_sensitivity(self):
        """Lower cs_prob_slope → less sensitive to difficulty."""
        low_slope  = _cs_prob(1.0, 90.0, cs_prob_slope=0.15)
        high_slope = _cs_prob(1.0, 90.0, cs_prob_slope=0.40)
        assert low_slope > high_slope

    def test_clamp_still_applies_with_custom_params(self):
        """Result must stay in [0.10, 0.65] regardless of params."""
        result = _cs_prob(1.0, 90.0, cs_prob_base=0.10, cs_prob_slope=0.40)
        assert result >= 0.10

    def test_compute_xpts_fixture_forwards_cs_prob_kwargs(self):
        """Different cs_prob_base values must produce different cs_pts."""
        low  = _compute_xpts_fixture(0.2, 0.1, 1.0, 90.0, 2, 0.5, cs_prob_base=0.25)
        high = _compute_xpts_fixture(0.2, 0.1, 1.0, 90.0, 2, 0.5, cs_prob_base=0.55)
        assert high['cs_pts'] > low['cs_pts']

    def test_compute_xpts_fixture_default_unchanged(self):
        """Calling without kwargs must produce identical result to before."""
        result = _compute_xpts_fixture(0.3, 0.1, 1.0, 90.0, 3, 0.4)
        assert result['total'] > 0  # sanity; exact value comes from existing tests
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest tests/test_merge.py::TestCsProbKwargs -v
```

Expected: `FAILED` / `AttributeError` — `_cs_prob` does not yet accept those kwargs.

- [ ] **Step 3: Update `_cs_prob` in merge.py**

Replace the function signature and formula at `merge.py:184`:

```python
def _cs_prob(defensive_difficulty: float, xmins: float, mins_60_prob: float | None = None,
             cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30) -> float:
    """Compute effective CS probability for a fixture (Phase 28 CR-01, WR-01).
    ...existing docstring...
    cs_prob_base: base CS probability vs average opposition (default 0.40; tunable via TUNE-01).
    cs_prob_slope: sensitivity to defensive_difficulty (default 0.30; tunable via TUNE-01).
    """
    cs_prob_raw = max(0.10, min(0.65, cs_prob_base - defensive_difficulty * cs_prob_slope))
    if mins_60_prob is not None:
        mins_factor = mins_60_prob
    else:
        mins_factor = min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor
```

- [ ] **Step 4: Update `_cs_prob_1gw_for_fixtures` signature and call site**

At `merge.py:211`, add kwargs to signature and call:

```python
def _cs_prob_1gw_for_fixtures(fixtures: list, xmins: float,
                               xmins_v2_enabled: bool = False,
                               mins_60_prob: float | None = None,
                               cs_prob_base: float = 0.40,
                               cs_prob_slope: float = 0.30) -> float:
```

Inside the function body, update the `_cs_prob` call (currently line ~243):

```python
        p = _cs_prob(dd, xmins,
                     mins_60_prob=mins_60_prob if xmins_v2_enabled else None,
                     cs_prob_base=cs_prob_base,
                     cs_prob_slope=cs_prob_slope)
```

- [ ] **Step 5: Update `_compute_xpts_fixture` signature and call site**

At `merge.py:248`, add kwargs to the end of the parameter list (before the closing `)`):

```python
def _compute_xpts_fixture(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    defensive_difficulty: float,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,
    opponent_xg_per_game: float = 0.0,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> dict:
```

Update the `_cs_prob` call inside `_compute_xpts_fixture` (currently around line 298):

```python
    effective_cs_prob = _cs_prob(defensive_difficulty, xmins,
                                 mins_60_prob=mins_60_prob if xmins_v2_enabled else None,
                                 cs_prob_base=cs_prob_base,
                                 cs_prob_slope=cs_prob_slope)
```

- [ ] **Step 6: Run tests to confirm they pass**

```
cd pipeline && python -m pytest tests/test_merge.py::TestCsProbKwargs -v
```

Expected: 6 passed.

- [ ] **Step 7: Run full merge test suite to confirm no regressions**

```
cd pipeline && python -m pytest tests/test_merge.py -v
```

Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```
git add pipeline/merge.py pipeline/tests/test_merge.py
git commit -m "feat(tune-01): parameterise _cs_prob and _compute_xpts_fixture with cs_prob kwargs"
```

---

## Task 2: Thread cs_prob + form_window_gws through `_xpts_ngw`, `_xpts_per_gw`, `merge_players`

**Files:**
- Modify: `pipeline/merge.py:336-397` (`_xpts_ngw`)
- Modify: `pipeline/merge.py:400-450` (`_xpts_per_gw`)
- Modify: `pipeline/merge.py:737-750` (`merge_players` signature)
- Modify: `pipeline/merge.py:1148-1152` (`_compute_form_signal` call site)
- Test: `pipeline/tests/test_merge.py`

- [ ] **Step 1: Write failing tests**

Add to `pipeline/tests/test_merge.py`:

```python
class TestMergePlayersTunedParams:
    """merge_players must accept and apply cs_prob_base, cs_prob_slope, form_window_gws."""

    def test_merge_players_accepts_cs_prob_kwargs(self, tmp_path):
        """merge_players must not raise when passed cs_prob_base and cs_prob_slope."""
        inputs = _build_minimal_inputs({1: [_hist(r, 90, 6, xg=0.3, xa=0.1) for r in range(1, 11)]})
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = inputs
        # Should not raise:
        merged, _ = merge_players(
            bootstrap, fixtures, understat, id_map,
            xmins_stats=xmins_stats, summaries=summaries,
            cs_prob_base=0.50, cs_prob_slope=0.25, form_window_gws=4,
        )
        assert len(merged) > 0

    def test_cs_prob_base_affects_xpts(self, tmp_path):
        """Higher cs_prob_base should increase xPts for defenders (element_type=2)."""
        # Build a DEF player with fixtures
        history = [_hist(r, 90, 6, xg=0.05, xa=0.05) for r in range(1, 11)]
        inputs_lo = _build_minimal_inputs({1: history}, element_type=2)
        inputs_hi = _build_minimal_inputs({1: history}, element_type=2)
        bootstrap, fixtures, understat, id_map, xmins_stats, summaries = inputs_lo
        lo, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries,
                              cs_prob_base=0.25)
        hi, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries,
                              cs_prob_base=0.55)
        lo_xpts = next(p['xPts_1gw'] for p in lo if p['id'] == 1)
        hi_xpts = next(p['xPts_1gw'] for p in hi if p['id'] == 1)
        assert hi_xpts > lo_xpts
```

Note: `_build_minimal_inputs` in `test_merge.py` may need an `element_type` parameter — check its signature and add one if needed (default 3 keeps existing tests unchanged).

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest tests/test_merge.py::TestMergePlayersTunedParams -v
```

Expected: `TypeError` — `merge_players` does not accept those kwargs yet.

- [ ] **Step 3: Update `_xpts_ngw` signature and `_compute_xpts_fixture` call**

At `merge.py:336`, add `cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30` to the parameter list:

```python
def _xpts_ngw(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> tuple:
```

Update the `_compute_xpts_fixture` call inside `_xpts_ngw` (around line 374):

```python
            result = _compute_xpts_fixture(
                xg_per90 if xg_per90 is not None else 0.0,
                xa_per90 if xa_per90 is not None else 0.0,
                start_prob,
                xmins,
                element_type,
                fix.get('defensive_difficulty', 0.5),
                xmins_v2_enabled=xmins_v2_enabled,
                mins_60_prob=mins_60_prob,
                bonus_predictor_enabled=bonus_predictor_enabled,
                bonus_ev=bonus_ev,
                save_predictor_enabled=save_predictor_enabled,
                opponent_xg_per_game=fix.get('opponent_xg_per_game', 0.0),
                cs_prob_base=cs_prob_base,
                cs_prob_slope=cs_prob_slope,
            )
```

- [ ] **Step 4: Update `_xpts_per_gw` the same way**

Add the same two kwargs to `_xpts_per_gw` signature (around line 400) and update its internal `_compute_xpts_fixture` call (around line 434) identically.

- [ ] **Step 5: Update `merge_players` signature**

At `merge.py:737`, add three new kwargs to `merge_players`:

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
    save_predictor_enabled: bool = False,
    cs_prob_base: float = 0.40,        # TUNE-01: tunable via accuracy_backtest.json.summary
    cs_prob_slope: float = 0.30,       # TUNE-01: tunable via accuracy_backtest.json.summary
    form_window_gws: int = 5,          # TUNE-01: tunable via accuracy_backtest.json.summary
) -> tuple[list, dict]:
```

- [ ] **Step 6: Thread cs_prob kwargs through `_xpts_ngw` calls inside `merge_players`**

Search for every call to `_xpts_ngw(` inside `merge_players` body (there will be multiple — one for 1GW, 3GW, 5GW). Add `cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope` to each call site. Example:

```python
xpts_1gw, xpts_components_1gw = _xpts_ngw(
    xg_per90, xa_per90, start_prob, xmins,
    element_type, upcoming_fixtures, n_gws=1,
    xmins_v2_enabled=xmins_v2_enabled,
    mins_60_prob=mins_60_prob,
    bonus_predictor_enabled=bonus_predictor_enabled,
    bonus_ev=bonus_ev_val,
    save_predictor_enabled=save_predictor_enabled,
    cs_prob_base=cs_prob_base,
    cs_prob_slope=cs_prob_slope,
)
```

Do the same for every `_xpts_per_gw(` call.

- [ ] **Step 7: Thread `form_window_gws` through the `_compute_form_signal` call**

Find the call at `merge.py:1150`:

```python
form_per90, form_n_gws = _compute_form_signal(
    summaries[fpl_id].get('history', [])
)
```

Update to:

```python
form_per90, form_n_gws = _compute_form_signal(
    summaries[fpl_id].get('history', []),
    window_gws=form_window_gws,
)
```

- [ ] **Step 8: Run tests**

```
cd pipeline && python -m pytest tests/test_merge.py -v
```

Expected: all pass including the two new classes.

- [ ] **Step 9: Commit**

```
git add pipeline/merge.py pipeline/tests/test_merge.py
git commit -m "feat(tune-01): thread cs_prob and form_window_gws through merge_players call chain"
```

---

## Task 3: Parameterise accuracy.py and extract shared helper functions

**Files:**
- Modify: `pipeline/accuracy.py:657-691` (`_reconstruct_xpts`)
- Modify: `pipeline/accuracy.py:733-786` (`_reconstruct_xpts_with_form`)
- Modify: `pipeline/accuracy.py:122-436` (`compute_accuracy_backtest` — refactor inner loop)
- Add to `pipeline/accuracy.py`: `build_fixture_difficulty_lookup()`, `build_per_gw_rows()`, `compute_metrics_for_gws()`
- Test: `pipeline/tests/test_accuracy.py`

- [ ] **Step 1: Write failing tests for new public functions**

Add to `pipeline/tests/test_accuracy.py` (after existing imports, add `build_per_gw_rows`, `compute_metrics_for_gws`, `build_fixture_difficulty_lookup` to the import line):

```python
from accuracy import (
    compute_accuracy_backtest, build_predictions_snapshot, FORMULA_VERSION,
    build_fixture_difficulty_lookup, build_per_gw_rows, compute_metrics_for_gws,
)
import math


class TestBuildFixtureDifficultyLookup:
    def test_maps_team_and_gw_to_difficulty(self):
        fixtures = [
            {'event': 1, 'team_h': 10, 'team_a': 5, 'team_h_difficulty': 3, 'team_a_difficulty': 5},
        ]
        lookup = build_fixture_difficulty_lookup(fixtures)
        # team_h difficulty for team 10 in GW1: (3-1)/4.0 = 0.5
        assert abs(lookup[(1, 10)] - 0.5) < 1e-9
        # team_a difficulty for team 5 in GW1: (5-1)/4.0 = 1.0
        assert abs(lookup[(1, 5)] - 1.0) < 1e-9

    def test_skips_fixtures_without_event(self):
        fixtures = [{'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 3}]
        lookup = build_fixture_difficulty_lookup(fixtures)
        assert len(lookup) == 0


class TestComputeMetricsForGws:
    """compute_metrics_for_gws must return haul_hit_rate, rmse, captain_hit_rate."""

    def _make_rows(self, player_specs):
        """player_specs: list of (player_id, actual_pts, xpts_blended_predicted)."""
        rows = []
        for pid, actual, xpred in player_specs:
            rows.append({
                'player_id': pid,
                'player_name': f'P{pid}',
                'team_short': 'TST',
                'element_type': 3,
                'actual_pts': actual,
                'xpts_predicted': xpred,
                'xpts_blended_predicted': xpred,
            })
        return rows

    def test_haul_hit_rate_perfect(self):
        """Haulter is ranked #1 → haul_hit_rate = 1.0."""
        rows = self._make_rows([(1, 12, 8.0), (2, 4, 3.0)])  # P1 hauls + is rank-1
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['haul_hit_rate'] == 1.0

    def test_haul_hit_rate_zero(self):
        """Haulter ranked outside top 10 → haul_hit_rate = 0.0."""
        # Build 11 players with higher xpts_blended, 1 haulter ranked last
        rows = [{'player_id': i, 'player_name': f'P{i}', 'team_short': 'T',
                 'element_type': 3, 'actual_pts': 2, 'xpts_predicted': 10.0 - i * 0.5,
                 'xpts_blended_predicted': 10.0 - i * 0.5} for i in range(1, 12)]
        rows.append({'player_id': 99, 'player_name': 'Haulter', 'team_short': 'T',
                     'element_type': 3, 'actual_pts': 15, 'xpts_predicted': 0.1,
                     'xpts_blended_predicted': 0.1})  # ranked last
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['haul_hit_rate'] == 0.0

    def test_rmse_exact(self):
        """RMSE = sqrt(mean((pred - actual)^2))."""
        rows = self._make_rows([(1, 4.0, 6.0), (2, 8.0, 6.0)])  # both 2pt error
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        expected_rmse = math.sqrt((4.0 + 4.0) / 2)  # = 2.0
        assert abs(metrics['rmse'] - expected_rmse) < 0.001

    def test_captain_hit_rate_win(self):
        """Rank-1 player scores most points → captain_hit_rate = 1.0."""
        rows = self._make_rows([(1, 14, 9.0), (2, 6, 5.0)])  # P1 highest xpts AND highest actual
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['captain_hit_rate'] == 1.0

    def test_captain_hit_rate_miss(self):
        """Rank-1 player doesn't score most → captain_hit_rate = 0.0."""
        rows = self._make_rows([(1, 4, 9.0), (2, 14, 5.0)])  # P1 top xpts but P2 scores more
        per_gw_rows = {1: rows}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics['captain_hit_rate'] == 0.0

    def test_empty_gws_returns_zeros(self):
        per_gw_rows = {1: []}
        metrics = compute_metrics_for_gws(per_gw_rows, [1])
        assert metrics == {'haul_hit_rate': 0.0, 'rmse': 0.0, 'captain_hit_rate': 0.0}

    def test_multi_gw_aggregation(self):
        """Metrics aggregate correctly over multiple GWs."""
        gw1 = self._make_rows([(1, 12, 9.0), (2, 4, 5.0)])  # haul hit, captain hit
        gw2 = self._make_rows([(1, 4, 9.0), (2, 14, 5.0)])  # haul miss, captain miss
        per_gw_rows = {1: gw1, 2: gw2}
        metrics = compute_metrics_for_gws(per_gw_rows, [1, 2])
        assert abs(metrics['haul_hit_rate'] - 0.5) < 0.001
        assert abs(metrics['captain_hit_rate'] - 0.5) < 0.001
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest tests/test_accuracy.py::TestBuildFixtureDifficultyLookup tests/test_accuracy.py::TestComputeMetricsForGws -v
```

Expected: `ImportError` — functions don't exist yet.

- [ ] **Step 3: Add `build_fixture_difficulty_lookup` to accuracy.py**

Add as a new public function after the `FORMULA_VERSION` constant (around line 39), before the private helpers:

```python
def build_fixture_difficulty_lookup(fixtures: list) -> dict:
    """Build (gw, team_id) -> difficulty_score lookup from the fixtures list.

    Extracted from compute_accuracy_backtest inner setup so tune.py can reuse it
    without calling the full backtest. Identical mapping to the original inline block.

    difficulty_score = (raw_difficulty - 1) / 4.0  (1=easiest → 0.0, 5=hardest → 1.0)
    """
    lookup: dict = {}
    for fix in fixtures:
        gw = fix.get('event')
        if gw is None:
            continue
        lookup[(gw, fix['team_h'])] = (fix.get('team_h_difficulty', 3) - 1) / 4.0
        lookup[(gw, fix['team_a'])] = (fix.get('team_a_difficulty', 3) - 1) / 4.0
    return lookup
```

- [ ] **Step 4: Add `compute_metrics_for_gws` to accuracy.py**

Add after `build_fixture_difficulty_lookup`:

```python
def compute_metrics_for_gws(per_gw_rows: dict, gws: list) -> dict:
    """Compute haul hit rate, xPts RMSE, and captain hit rate over the given GWs.

    Args:
        per_gw_rows: dict mapping gw (int) -> list of player-row dicts. Each row must
                     have: player_id, actual_pts, xpts_blended_predicted, element_type.
        gws:         List of GW numbers to include in the metric computation.

    Returns:
        {'haul_hit_rate': float, 'rmse': float, 'captain_hit_rate': float}
        All values are rounded to 4 decimal places. Returns all-zero dict for empty input.
    """
    import math as _math
    total_haulters = 0
    total_flagged = 0
    squared_errors: list = []
    captain_hits = 0
    captain_gws = 0

    for gw in gws:
        rows = per_gw_rows.get(gw, [])
        if not rows:
            continue

        # Rank all players by blended xPts descending for this GW
        ranked = sorted(rows, key=lambda r: r['xpts_blended_predicted'], reverse=True)
        rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(ranked)}

        # Haul hit rate: haulters (≥10 actual pts) ranked in top 10
        gw_haulters = [r for r in rows if r['actual_pts'] >= HAULTER_THRESHOLD]
        total_haulters += len(gw_haulters)
        total_flagged += sum(
            1 for r in gw_haulters
            if rank_by_id.get(r['player_id'], 9999) <= TOP_N_PREDICTED
        )

        # RMSE: all players in this GW
        for r in rows:
            err = r['xpts_blended_predicted'] - r['actual_pts']
            squared_errors.append(err * err)

        # Captain hit rate: did rank-1 player score the highest actual pts?
        if ranked:
            captain_id = ranked[0]['player_id']
            max_actual = max(r['actual_pts'] for r in rows)
            captain_actual = next(
                r['actual_pts'] for r in rows if r['player_id'] == captain_id
            )
            captain_hits += 1 if captain_actual >= max_actual else 0
            captain_gws += 1

    haul_hit_rate = total_flagged / total_haulters if total_haulters > 0 else 0.0
    rmse = _math.sqrt(sum(squared_errors) / len(squared_errors)) if squared_errors else 0.0
    captain_hit_rate = captain_hits / captain_gws if captain_gws > 0 else 0.0

    return {
        'haul_hit_rate': round(haul_hit_rate, 4),
        'rmse': round(rmse, 4),
        'captain_hit_rate': round(captain_hit_rate, 4),
    }
```

- [ ] **Step 5: Add `build_per_gw_rows` to accuracy.py**

Add after `compute_metrics_for_gws`:

```python
def build_per_gw_rows(
    summaries: dict,
    target_gws: list,
    bootstrap: dict,
    fixture_difficulty: dict,
    teams_by_id: dict,
    blend_alpha: float = BLEND_ALPHA,
    form_window_gws: int = FORM_WINDOW_GWS,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> dict:
    """Build per-GW player rows with reconstructed xPts for the given target_gws.

    Extracted from compute_accuracy_backtest so tune.py can call it with
    different parameter values without running the full backtest pipeline.

    Args:
        summaries:         dict mapping player_id (int) -> element-summary dict.
        target_gws:        list of GW numbers to build rows for.
        bootstrap:         FPL bootstrap-static JSON (elements, teams).
        fixture_difficulty: dict from build_fixture_difficulty_lookup().
        teams_by_id:       dict mapping team_id (int) -> team dict.
        blend_alpha:       form signal blend weight (TUNE-01).
        form_window_gws:   recency window for form signal (TUNE-01).
        cs_prob_base:      base CS probability (TUNE-01).
        cs_prob_slope:     CS probability difficulty slope (TUNE-01).

    Returns:
        dict mapping gw -> list of player-row dicts (same shape as compute_accuracy_backtest
        internal per_gw_rows; each row has player_id, player_name, team_short, element_type,
        actual_pts, xpts_predicted, xpts_blended_predicted).
    """
    per_gw_rows: dict = {gw: [] for gw in target_gws}

    for element in bootstrap.get('elements', []):
        element_id = element['id']
        if element.get('starts', 0) == 0:
            continue
        summary = summaries.get(element_id)
        if summary is None:
            continue

        history = summary.get('history', []) or []
        grouped = _group_history_by_gw(history)
        element_type = element.get('element_type', 3)
        player_team_id = element['team']
        player_name = element.get('web_name', f'P{element_id}')
        team_short = teams_by_id.get(player_team_id, {}).get('short_name', '')

        for gw in target_gws:
            entry = grouped.get(gw)
            if entry is None:
                continue
            if entry['minutes'] < MIN_MINUTES:
                continue

            actual_pts = entry['total_points']
            difficulty_score = fixture_difficulty.get((gw, player_team_id), 0.5)

            xpts_predicted = _reconstruct_xpts(
                entry, element_type, difficulty_score,
                cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
            )
            form_per90_at_gw = _reconstruct_form_signal(grouped, gw, window_gws=form_window_gws)
            xpts_blended_predicted = _reconstruct_xpts_with_form(
                entry, element_type, difficulty_score, form_per90_at_gw,
                blend_alpha=blend_alpha,
                cs_prob_base=cs_prob_base,
                cs_prob_slope=cs_prob_slope,
            )

            per_gw_rows[gw].append({
                'player_id': element_id,
                'player_name': player_name,
                'team_short': team_short,
                'element_type': element_type,
                'actual_pts': actual_pts,
                'xpts_predicted': xpts_predicted,
                'xpts_blended_predicted': xpts_blended_predicted,
            })

    return per_gw_rows
```

- [ ] **Step 6: Update `_reconstruct_xpts` to accept cs_prob kwargs**

At `accuracy.py:657`, update signature and the `_compute_xpts_fixture` call:

```python
def _reconstruct_xpts(entry: dict, element_type: int, difficulty_score: float,
                       cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30) -> float:
```

Inside the body, update the `_compute_xpts_fixture` call:

```python
    result = _compute_xpts_fixture(
        xg_per90=xg_per90,
        xa_per90=xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )
```

- [ ] **Step 7: Update `_reconstruct_xpts_with_form` to accept cs_prob and blend_alpha kwargs**

At `accuracy.py:733`, update signature:

```python
def _reconstruct_xpts_with_form(
    entry: dict,
    element_type: int,
    difficulty_score: float,
    form_per90: 'float | None',
    blend_alpha: float = BLEND_ALPHA,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> float:
```

Update the `_compute_xpts_fixture` call inside it (near the end of the function):

```python
    result = _compute_xpts_fixture(
        xg_per90=blended_xg_per90,
        xa_per90=blended_xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )
```

Also update the fallback call (when `form_per90 is None`):

```python
    if form_per90 is None:
        return _reconstruct_xpts(entry, element_type, difficulty_score,
                                  cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope)
```

- [ ] **Step 8: Refactor `compute_accuracy_backtest` to use `build_per_gw_rows` and add param kwargs**

Add `blend_alpha`, `form_window_gws`, `cs_prob_base`, `cs_prob_slope` kwargs to `compute_accuracy_backtest` signature (after `cache_dir`, before the body):

```python
def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
    cache_dir: str = '',
    merged_haul_lookup: Optional[dict] = None,
    blend_alpha: float = BLEND_ALPHA,
    form_window_gws: int = FORM_WINDOW_GWS,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
) -> dict:
```

Replace the existing per-player inner loop (the block that builds `per_gw_rows`) with a call to `build_per_gw_rows`:

```python
    # Replace the existing fixture_difficulty / teams_by_id + inner loop with:
    fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
    teams_by_id = {t['id']: t for t in bootstrap.get('teams', [])}

    per_gw_rows = build_per_gw_rows(
        summaries=summaries,
        target_gws=target_gws,
        bootstrap=bootstrap,
        fixture_difficulty=fixture_difficulty,
        teams_by_id=teams_by_id,
        blend_alpha=blend_alpha,
        form_window_gws=form_window_gws,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
    )
```

Remove the duplicate `fixture_difficulty` and `teams_by_id` build blocks that previously existed inline. The second pass (ranking, haulters, etc.) remains unchanged.

Also update the `_reconstruct_form_signal` call in the old inner loop — this is now gone since `build_per_gw_rows` handles it.

- [ ] **Step 9: Run all accuracy tests**

```
cd pipeline && python -m pytest tests/test_accuracy.py -v
```

Expected: all existing tests pass; new `TestBuildFixtureDifficultyLookup` and `TestComputeMetricsForGws` tests pass.

- [ ] **Step 10: Commit**

```
git add pipeline/accuracy.py pipeline/tests/test_accuracy.py
git commit -m "feat(tune-01): parameterise accuracy.py helpers; add build_per_gw_rows + compute_metrics_for_gws"
```

---

## Task 4: Create `tune.py` — promotion gates, combined score, prior params

**Files:**
- Create: `pipeline/tune.py`
- Create: `pipeline/tests/test_tune.py`

- [ ] **Step 1: Create `pipeline/tests/test_tune.py` with promotion gate tests**

```python
"""Tests for pipeline/tune.py — TUNE-01 coordinate descent parameter tuner."""

import json
import os
import tempfile
import pytest

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
)


# ── Promotion gate tests ─────────────────────────────────────────────────────

class TestPromotionGates:
    def _metrics(self, haul=0.60, rmse=3.0, captain=0.50):
        return {'haul_hit_rate': haul, 'rmse': rmse, 'captain_hit_rate': captain}

    def test_all_gates_pass(self):
        """Candidate better on all metrics → True."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.48)
        candidate_train  = self._metrics(haul=0.60, rmse=3.0, captain=0.52)   # +5pp haul
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.49)   # val improves
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is True

    def test_fails_insufficient_train_improvement(self):
        """Candidate only 1pp better on train haul hit rate (< 2pp margin) → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.48)
        candidate_train  = self._metrics(haul=0.56, rmse=3.0, captain=0.52)   # only +1pp
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.49)
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_fails_validation_haul_regression(self):
        """Candidate wins on train but loses on validate haul hit rate → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=3.0, captain=0.52)   # +7pp train
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.47)
        candidate_val    = self._metrics(haul=0.50, rmse=3.1, captain=0.49)   # val regression
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_fails_rmse_regression_beyond_threshold(self):
        """RMSE worsens >5% on validate → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.0, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=2.8, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.0, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.20, captain=0.49)  # 6.7% worse
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_passes_rmse_within_threshold(self):
        """RMSE worsens by exactly 4% (within 5% threshold) → gates still pass."""
        current_train    = self._metrics(haul=0.55, rmse=3.0, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=2.9, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.0, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.12, captain=0.49)  # 4% worse — ok
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is True

    def test_fails_captain_rate_drops_more_than_2pp(self):
        """Captain hit rate drops >2pp on validate → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.50)
        candidate_train  = self._metrics(haul=0.62, rmse=3.0, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.50)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.47)   # -3pp captain
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_passes_captain_rate_drops_exactly_2pp(self):
        """Captain hit rate drops exactly 2pp → allowed (boundary condition)."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.50)
        candidate_train  = self._metrics(haul=0.62, rmse=3.0, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.50)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.48)   # -2pp exactly
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is True


# ── Combined score tests ─────────────────────────────────────────────────────

class TestCombinedScore:
    def _m(self, haul, rmse, captain):
        return {'haul_hit_rate': haul, 'rmse': rmse, 'captain_hit_rate': captain}

    def test_positive_when_all_metrics_improve(self):
        current   = self._m(0.55, 3.0, 0.50)
        candidate = self._m(0.60, 2.8, 0.55)
        assert _combined_score(current, candidate) > 0

    def test_zero_when_identical(self):
        m = self._m(0.55, 3.0, 0.50)
        assert abs(_combined_score(m, m)) < 1e-9

    def test_higher_is_better(self):
        current = self._m(0.55, 3.0, 0.50)
        good    = self._m(0.65, 2.5, 0.60)
        ok      = self._m(0.57, 2.9, 0.51)
        assert _combined_score(current, good) > _combined_score(current, ok)


# ── _read_prior_params tests ─────────────────────────────────────────────────

class TestReadPriorParams:
    def test_returns_defaults_when_no_cache_file(self, tmp_path):
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == 0.4
        assert params['form_window_gws'] == 5
        assert abs(params['cs_prob_base'] - 0.40) < 1e-9
        assert abs(params['cs_prob_slope'] - 0.30) < 1e-9

    def test_reads_promoted_values_from_cache(self, tmp_path):
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
        assert abs(params['blend_alpha'] - 0.3) < 1e-9
        assert params['form_window_gws'] == 4
        assert abs(params['cs_prob_base'] - 0.45) < 1e-9
        assert abs(params['cs_prob_slope'] - 0.25) < 1e-9

    def test_returns_defaults_on_malformed_json(self, tmp_path):
        (tmp_path / 'accuracy_backtest.json').write_text('not json')
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == 0.4


# ── run_tuner gate tests ─────────────────────────────────────────────────────

class TestRunTunerGates:
    def test_skips_when_insufficient_gws(self, tmp_path):
        """run_tuner returns skipped dict when finished_gws < MIN_FINISHED_GWS."""
        result = run_tuner({}, MIN_FINISHED_GWS - 1, {}, [], str(tmp_path))
        assert result.get('skipped') is True

    def test_skips_at_zero_gws(self, tmp_path):
        result = run_tuner({}, 0, {}, [], str(tmp_path))
        assert result.get('skipped') is True
```

- [ ] **Step 2: Run tests to confirm they fail (ImportError)**

```
cd pipeline && python -m pytest tests/test_tune.py -v
```

Expected: `ImportError: No module named 'tune'`

- [ ] **Step 3: Create `pipeline/tune.py` with constants and helpers**

```python
"""Coordinate descent parameter tuner for the xPts model (TUNE-01).

Sweeps BLEND_ALPHA, FORM_WINDOW_GWS, cs_prob_base, cs_prob_slope in sequence.
Each parameter is evaluated on three metrics (haul hit rate, xPts RMSE, captain
hit rate) over a held-out GW window. Promotes a value only when it passes all
safety gates. Non-fatal: run.py wraps the call in try/except.

Public API:
    run_tuner(summaries, finished_gws, bootstrap, fixtures, cache_dir='') -> dict
        Returns a 'tuner' dict for merging into accuracy_backtest.json.
"""

import json
import os
from datetime import datetime, timezone

from accuracy import (
    build_fixture_difficulty_lookup,
    build_per_gw_rows,
    compute_metrics_for_gws,
    GATE_MARGIN_PP,
    BLEND_ALPHA,
    FORM_WINDOW_GWS,
)

# ── Candidate sweep grids ────────────────────────────────────────────────────
BLEND_ALPHA_CANDIDATES = [round(x * 0.1, 1) for x in range(11)]   # 0.0 … 1.0
FORM_WINDOW_CANDIDATES = [3, 4, 5, 6, 7, 8]
CS_PROB_BASE_CANDIDATES = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55]
CS_PROB_SLOPE_CANDIDATES = [0.15, 0.20, 0.25, 0.30, 0.35, 0.40]

# ── Safety thresholds ────────────────────────────────────────────────────────
MIN_FINISHED_GWS = 13             # need at least this many GWs for a meaningful split
RMSE_REGRESSION_THRESHOLD = 0.05  # max allowed fractional RMSE worsening (5%)
CAPTAIN_REGRESSION_PP = 0.02      # max allowed captain hit rate drop (2pp)

# ── Default production parameter values (read from accuracy_backtest.json on run) ──
_DEFAULT_CS_PROB_BASE = 0.40
_DEFAULT_CS_PROB_SLOPE = 0.30


# ── Public helpers (used in tests) ───────────────────────────────────────────

def _read_prior_params(cache_dir: str) -> dict:
    """Read current production parameter values from accuracy_backtest.json summary.

    Falls back to defaults when the file is missing or malformed (cold start).
    Returns dict with keys: blend_alpha, form_window_gws, cs_prob_base, cs_prob_slope.
    """
    path = os.path.join(cache_dir, 'accuracy_backtest.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        summary = data.get('summary', {})
        return {
            'blend_alpha':     float(summary.get('blend_alpha_used', BLEND_ALPHA)),
            'form_window_gws': int(summary.get('form_window_gws_used', FORM_WINDOW_GWS)),
            'cs_prob_base':    float(summary.get('cs_prob_base_used', _DEFAULT_CS_PROB_BASE)),
            'cs_prob_slope':   float(summary.get('cs_prob_slope_used', _DEFAULT_CS_PROB_SLOPE)),
        }
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, ValueError):
        return {
            'blend_alpha': BLEND_ALPHA,
            'form_window_gws': FORM_WINDOW_GWS,
            'cs_prob_base': _DEFAULT_CS_PROB_BASE,
            'cs_prob_slope': _DEFAULT_CS_PROB_SLOPE,
        }


def _promotion_gates(
    current_train: dict,
    candidate_train: dict,
    current_val: dict,
    candidate_val: dict,
) -> bool:
    """Return True only when all four promotion conditions are satisfied.

    Gate 1: candidate beats current by >GATE_MARGIN_PP on training haul hit rate.
    Gate 2: candidate does not regress on validation haul hit rate.
    Gate 3: validation RMSE does not worsen by more than RMSE_REGRESSION_THRESHOLD (5%).
    Gate 4: validation captain hit rate does not drop by more than CAPTAIN_REGRESSION_PP (2pp).
    """
    # Gate 1: training improvement > 2pp
    if candidate_train['haul_hit_rate'] - current_train['haul_hit_rate'] <= GATE_MARGIN_PP:
        return False
    # Gate 2: validation haul hit rate must not regress
    if candidate_val['haul_hit_rate'] < current_val['haul_hit_rate']:
        return False
    # Gate 3: validation RMSE must not worsen by >5%
    if current_val['rmse'] > 0:
        rmse_change = (candidate_val['rmse'] - current_val['rmse']) / current_val['rmse']
        if rmse_change > RMSE_REGRESSION_THRESHOLD:
            return False
    # Gate 4: validation captain hit rate must not drop >2pp
    if current_val['captain_hit_rate'] - candidate_val['captain_hit_rate'] > CAPTAIN_REGRESSION_PP:
        return False
    return True


def _combined_score(current_metrics: dict, candidate_metrics: dict) -> float:
    """Normalised combined improvement score for tie-breaking multiple promoted candidates.

    All three terms are fractional improvements over current, keeping them on comparable scales.
    Score = Δhaul_hit_rate + (rmse_improvement_fraction) + Δcaptain_hit_rate
    """
    delta_haul = candidate_metrics['haul_hit_rate'] - current_metrics['haul_hit_rate']
    rmse_improvement = 0.0
    if current_metrics['rmse'] > 0:
        rmse_improvement = (current_metrics['rmse'] - candidate_metrics['rmse']) / current_metrics['rmse']
    delta_captain = candidate_metrics['captain_hit_rate'] - current_metrics['captain_hit_rate']
    return delta_haul + rmse_improvement + delta_captain
```

- [ ] **Step 4: Run promotion gate + helper tests**

```
cd pipeline && python -m pytest tests/test_tune.py::TestPromotionGates tests/test_tune.py::TestCombinedScore tests/test_tune.py::TestReadPriorParams tests/test_tune.py::TestRunTunerGates -v
```

Expected: all pass (note: `run_tuner` gate tests need the function stub — add a minimal stub before running):

Temporarily add to `tune.py` so the gate tests can run:

```python
def run_tuner(summaries, finished_gws, bootstrap, fixtures, cache_dir=''):
    if finished_gws < MIN_FINISHED_GWS:
        return {'skipped': True, 'reason': f'finished_gws={finished_gws} < {MIN_FINISHED_GWS}'}
    return {}  # stub — full implementation in Task 5
```

- [ ] **Step 5: Commit**

```
git add pipeline/tune.py pipeline/tests/test_tune.py
git commit -m "feat(tune-01): create tune.py with promotion gates, combined score, prior param reader"
```

---

## Task 5: Create `tune.py` — `_sweep_param` and full `run_tuner`

**Files:**
- Modify: `pipeline/tune.py`
- Modify: `pipeline/tests/test_tune.py`

- [ ] **Step 1: Write failing tests for `_sweep_param` and `run_tuner`**

Add to `pipeline/tests/test_tune.py`:

```python
from tune import _sweep_param


def _make_summaries_and_bootstrap(n_players=5, n_gws=20, xg=0.3, xa=0.1, actual_pts_fn=None):
    """Build minimal summaries + bootstrap for tuner testing.

    actual_pts_fn: callable(player_id, gw) -> int. Defaults to 5 for all.
    """
    if actual_pts_fn is None:
        actual_pts_fn = lambda pid, gw: 5

    elements = []
    summaries = {}
    for pid in range(1, n_players + 1):
        elements.append({
            'id': pid, 'web_name': f'P{pid}',
            'element_type': 3, 'team': 14, 'starts': n_gws,
        })
        history = []
        for gw in range(1, n_gws + 1):
            history.append({
                'round': gw, 'minutes': 90,
                'total_points': actual_pts_fn(pid, gw),
                'expected_goals': xg, 'expected_assists': xa,
                'starts': 1,
            })
        summaries[pid] = {'history': history}

    teams = [{'id': 14, 'short_name': 'TST'}]
    bootstrap = {'elements': elements, 'teams': teams}
    fixtures = [
        {'event': gw, 'team_h': 14, 'team_a': 1,
         'team_h_difficulty': 3, 'team_a_difficulty': 3}
        for gw in range(1, n_gws + 1)
    ]
    return summaries, bootstrap, fixtures


class TestSweepParam:
    def test_no_promotion_when_all_candidates_equal(self, tmp_path):
        """If no candidate improves over current, promoted=False and best=current."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap()
        fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
        teams_by_id = {14: {'short_name': 'TST'}}
        all_gws = list(range(1, 21))
        gws_train = all_gws[:13]
        gws_val = all_gws[13:]
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30}

        result = _sweep_param(
            param_name='blend_alpha',
            candidates=[0.4],   # only the current value — nothing to improve
            current_val=0.4,
            params=params,
            summaries=summaries,
            all_gws=all_gws,
            bootstrap=bootstrap,
            fixture_difficulty=fixture_difficulty,
            teams_by_id=teams_by_id,
            gws_train=gws_train,
            gws_validate=gws_val,
        )
        assert result['promoted'] is False
        assert result['best'] == 0.4

    def test_result_has_required_keys(self, tmp_path):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap()
        fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
        teams_by_id = {14: {'short_name': 'TST'}}
        all_gws = list(range(1, 21))
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30}
        result = _sweep_param(
            'blend_alpha', [0.4], 0.4, params,
            summaries, all_gws, bootstrap, fixture_difficulty,
            {14: {'short_name': 'TST'}}, all_gws[:13], all_gws[13:],
        )
        assert 'current' in result
        assert 'best' in result
        assert 'promoted' in result


class TestRunTunerFull:
    def test_run_tuner_returns_expected_keys(self, tmp_path):
        """run_tuner must return a dict with tuner metadata keys."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        assert 'last_run_at' in result
        assert 'gws_train' in result
        assert 'gws_validate' in result
        assert 'sweep' in result
        assert 'promoted_params' in result

    def test_run_tuner_sweep_covers_all_parameters(self, tmp_path):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        sweep = result['sweep']
        assert 'blend_alpha' in sweep
        assert 'form_window_gws' in sweep
        assert 'cs_prob_base' in sweep
        assert 'cs_prob_slope' in sweep

    def test_run_tuner_promoted_params_contains_all_four(self, tmp_path):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'blend_alpha' in pp
        assert 'form_window_gws' in pp
        assert 'cs_prob_base' in pp
        assert 'cs_prob_slope' in pp

    def test_run_tuner_train_validate_split_correct(self, tmp_path):
        """Train + validate together must cover all finished GWs with no gaps or overlap."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        train = result['gws_train']
        validate = result['gws_validate']
        assert set(train) | set(validate) == set(range(1, 21))
        assert set(train) & set(validate) == set()

    def test_coordinate_locking_uses_prior_sweep_value(self, tmp_path):
        """If blend_alpha sweep promotes a new value, form_window sweep uses that new value."""
        # We can't easily force a promotion in a unit test, but we can verify structure:
        # promoted_params must reflect the locked-in values from all four sweeps in order.
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        # promoted_params['blend_alpha'] must equal sweep['blend_alpha']['best']
        assert result['promoted_params']['blend_alpha'] == result['sweep']['blend_alpha']['best']
        assert result['promoted_params']['cs_prob_base'] == result['sweep']['cs_prob_base']['best']
```

Also add the missing import at the top of `test_tune.py`:

```python
from accuracy import build_fixture_difficulty_lookup
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest tests/test_tune.py::TestSweepParam tests/test_tune.py::TestRunTunerFull -v
```

Expected: `ImportError` — `_sweep_param` not yet defined.

- [ ] **Step 3: Add `_sweep_param` to `tune.py`**

Add after `_combined_score`:

```python
def _sweep_param(
    param_name: str,
    candidates: list,
    current_val,
    params: dict,
    summaries: dict,
    all_gws: list,
    bootstrap: dict,
    fixture_difficulty: dict,
    teams_by_id: dict,
    gws_train: list,
    gws_validate: list,
) -> dict:
    """Sweep one parameter over all candidates. Returns result dict.

    Args:
        param_name:         key in params dict being swept (e.g. 'blend_alpha').
        candidates:         list of candidate values to evaluate.
        current_val:        current production value (read from prior backtest).
        params:             current locked-in values for all four parameters.
        summaries:          element-summary dict from run.py.
        all_gws:            all finished GW numbers (train + validate combined).
        bootstrap:          FPL bootstrap-static JSON.
        fixture_difficulty: lookup built by build_fixture_difficulty_lookup().
        teams_by_id:        dict mapping team_id (int) -> team dict.
        gws_train:          GW numbers for training set.
        gws_validate:       GW numbers for validation set.

    Returns:
        dict with keys: current, best, promoted, and (when promoted=True) per-metric
        train/validate values.
    """
    # Baseline: current production metrics using current params
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
    )
    current_train    = compute_metrics_for_gws(baseline_rows, gws_train)
    current_validate = compute_metrics_for_gws(baseline_rows, gws_validate)

    best_val = current_val
    best_combined: float | None = None
    best_train = current_train
    best_validate = current_validate
    promoted = False

    for candidate in candidates:
        if candidate == current_val:
            continue
        candidate_params = {**params, param_name: candidate}
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
        )
        train_metrics    = compute_metrics_for_gws(candidate_rows, gws_train)
        validate_metrics = compute_metrics_for_gws(candidate_rows, gws_validate)

        if not _promotion_gates(current_train, train_metrics, current_validate, validate_metrics):
            continue

        combined = _combined_score(current_validate, validate_metrics)
        if best_combined is None or combined > best_combined:
            best_combined    = combined
            best_val         = candidate
            best_train       = train_metrics
            best_validate    = validate_metrics
            promoted         = True

    result: dict = {'current': current_val, 'best': best_val, 'promoted': promoted}
    if promoted:
        result.update({
            'train_haul_hit_rate':     best_train['haul_hit_rate'],
            'train_rmse':              best_train['rmse'],
            'train_captain_hit_rate':  best_train['captain_hit_rate'],
            'validate_haul_hit_rate':  best_validate['haul_hit_rate'],
            'validate_rmse':           best_validate['rmse'],
            'validate_captain_hit_rate': best_validate['captain_hit_rate'],
        })
    return result
```

- [ ] **Step 4: Replace the `run_tuner` stub with the full implementation**

```python
def run_tuner(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
    cache_dir: str = '',
) -> dict:
    """Run coordinate descent parameter tuner over all four tunable parameters.

    Skips when finished_gws < MIN_FINISHED_GWS (not enough data for a hold-out split).
    Non-fatal: all exceptions should be caught by the caller (run.py).

    Returns a dict suitable for merging into accuracy_backtest.json under the 'tuner' key.
    Includes a 'promoted_params' sub-dict with the final locked-in values for all four
    parameters; run.py writes these into the summary for next-run consumption.
    """
    if finished_gws < MIN_FINISHED_GWS:
        return {
            'skipped': True,
            'reason': f'finished_gws={finished_gws} < MIN_FINISHED_GWS={MIN_FINISHED_GWS}',
        }

    prior = _read_prior_params(cache_dir)

    # Hold-out split: last ⌊N/3⌋ GWs for validation, remainder for training
    all_gws = list(range(1, finished_gws + 1))
    n_validate = max(1, finished_gws // 3)
    gws_validate = all_gws[-n_validate:]
    gws_train    = all_gws[:-n_validate]

    fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
    teams_by_id = {t['id']: t for t in bootstrap.get('teams', [])}

    # Active params: updated after each sweep locks in the best value
    params = {
        'blend_alpha':     prior['blend_alpha'],
        'form_window_gws': prior['form_window_gws'],
        'cs_prob_base':    prior['cs_prob_base'],
        'cs_prob_slope':   prior['cs_prob_slope'],
    }

    sweep_results: dict = {}

    # Coordinate descent: sweep each parameter in order
    sweep_order = [
        ('blend_alpha',     BLEND_ALPHA_CANDIDATES,     prior['blend_alpha']),
        ('form_window_gws', FORM_WINDOW_CANDIDATES,     prior['form_window_gws']),
        ('cs_prob_base',    CS_PROB_BASE_CANDIDATES,    prior['cs_prob_base']),
        ('cs_prob_slope',   CS_PROB_SLOPE_CANDIDATES,   prior['cs_prob_slope']),
    ]

    for param_name, candidates, current_val in sweep_order:
        result = _sweep_param(
            param_name=param_name,
            candidates=candidates,
            current_val=current_val,
            params=params,
            summaries=summaries,
            all_gws=all_gws,
            bootstrap=bootstrap,
            fixture_difficulty=fixture_difficulty,
            teams_by_id=teams_by_id,
            gws_train=gws_train,
            gws_validate=gws_validate,
        )
        sweep_results[param_name] = result
        if result['promoted']:
            params[param_name] = result['best']  # lock in for next sweep

    return {
        'last_run_at':    datetime.now(timezone.utc).isoformat(),
        'finished_gws':   finished_gws,
        'gws_train':      gws_train,
        'gws_validate':   gws_validate,
        'sweep':          sweep_results,
        'promoted_params': dict(params),  # copy of final locked-in values
    }
```

- [ ] **Step 5: Run all tune tests**

```
cd pipeline && python -m pytest tests/test_tune.py -v
```

Expected: all tests pass.

- [ ] **Step 6: Run full pipeline test suite**

```
cd pipeline && python -m pytest tests/ -v
```

Expected: all tests pass (no regressions in merge, accuracy, or other modules).

- [ ] **Step 7: Commit**

```
git add pipeline/tune.py pipeline/tests/test_tune.py
git commit -m "feat(tune-01): implement _sweep_param and run_tuner coordinate descent"
```

---

## Task 6: Wire `run.py` — read tuned params, call tuner, promote results

**Files:**
- Modify: `pipeline/run.py` (two sections: param-read block ~line 350, accuracy block ~line 465)

- [ ] **Step 1: Write a contract test for the new run.py read pattern**

Add to `pipeline/tests/test_run.py` (after the existing `_read_xmins_v2_gate` pattern, using the same replica style — do NOT import run.py directly):

```python
def _read_tuner_params(cache_dir: str) -> dict:
    """Replica of the run.py tuner-param read pattern (TUNE-01 contract test).
    Production code in run.py MUST use this exact shape.
    """
    import json, os
    backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
    defaults = {
        'form_window_gws_used': 5,
        'cs_prob_base_used': 0.40,
        'cs_prob_slope_used': 0.30,
    }
    try:
        with open(backtest_path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        summary = prev.get('summary', {})
        return {
            'form_window_gws_used': int(summary.get('form_window_gws_used', defaults['form_window_gws_used'])),
            'cs_prob_base_used':    float(summary.get('cs_prob_base_used',    defaults['cs_prob_base_used'])),
            'cs_prob_slope_used':   float(summary.get('cs_prob_slope_used',   defaults['cs_prob_slope_used'])),
        }
    except (FileNotFoundError, json.JSONDecodeError):
        return defaults


def test_read_tuner_params_defaults_on_missing_file(tmp_path):
    params = _read_tuner_params(str(tmp_path))
    assert params['form_window_gws_used'] == 5
    assert abs(params['cs_prob_base_used']  - 0.40) < 1e-9
    assert abs(params['cs_prob_slope_used'] - 0.30) < 1e-9


def test_read_tuner_params_reads_promoted_values(tmp_path):
    import json
    data = {'summary': {
        'form_window_gws_used': 4,
        'cs_prob_base_used': 0.45,
        'cs_prob_slope_used': 0.25,
    }}
    (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
    params = _read_tuner_params(str(tmp_path))
    assert params['form_window_gws_used'] == 4
    assert abs(params['cs_prob_base_used']  - 0.45) < 1e-9
    assert abs(params['cs_prob_slope_used'] - 0.25) < 1e-9
```

- [ ] **Step 2: Run contract test to confirm it passes (pure Python, no run.py import)**

```
cd pipeline && python -m pytest tests/test_run.py::test_read_tuner_params_defaults_on_missing_file tests/test_run.py::test_read_tuner_params_reads_promoted_values -v
```

Expected: both pass.

- [ ] **Step 3: Update the param-read block in `run.py`**

Find the existing block that reads `form_signal_enabled` and `blend_alpha_used` from `accuracy_backtest.json` (around line 350). Add three new reads immediately after `blend_alpha_used`:

```python
            form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
            blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
            xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
            save_predictor_enabled = prev_backtest.get('summary', {}).get('save_predictor_enabled', False)
            # TUNE-01: read tuned parameter values (default to production constants on cold start)
            form_window_gws_used = int(prev_backtest.get('summary', {}).get('form_window_gws_used', 5))
            cs_prob_base_used    = float(prev_backtest.get('summary', {}).get('cs_prob_base_used', 0.40))
            cs_prob_slope_used   = float(prev_backtest.get('summary', {}).get('cs_prob_slope_used', 0.30))
```

Also add defaults in the `except` branch:

```python
        except (FileNotFoundError, json.JSONDecodeError):
            pass
    # Defaults when no prior cache (keep existing defaults, add new ones)
    form_window_gws_used = locals().get('form_window_gws_used', 5)
    cs_prob_base_used    = locals().get('cs_prob_base_used', 0.40)
    cs_prob_slope_used   = locals().get('cs_prob_slope_used', 0.30)
```

Note: the cleaner approach is to initialise the three variables before the `try` block (same pattern as `form_signal_enabled = False` above the `try`):

```python
        form_window_gws_used = 5
        cs_prob_base_used    = 0.40
        cs_prob_slope_used   = 0.30
        try:
            with open(backtest_path, 'r', encoding='utf-8') as f:
                prev_backtest = json.load(f)
            ...
            form_window_gws_used = int(prev_backtest.get('summary', {}).get('form_window_gws_used', 5))
            cs_prob_base_used    = float(prev_backtest.get('summary', {}).get('cs_prob_base_used', 0.40))
            cs_prob_slope_used   = float(prev_backtest.get('summary', {}).get('cs_prob_slope_used', 0.30))
        except (FileNotFoundError, json.JSONDecodeError):
            pass
```

- [ ] **Step 4: Pass tuned params into `merge_players` call**

Find the `merge_players(...)` call in run.py (around line 366). Add the three new kwargs:

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
                cs_prob_base=cs_prob_base_used,       # TUNE-01
                cs_prob_slope=cs_prob_slope_used,     # TUNE-01
                form_window_gws=form_window_gws_used, # TUNE-01
            )
```

- [ ] **Step 5: Pass tuned params into `compute_accuracy_backtest` call**

Find the `compute_accuracy_backtest(...)` call (around line 465). Add kwargs:

```python
            backtest_data = compute_accuracy_backtest(
                summaries, finished_gws, bootstrap, fixtures,
                cache_dir=cache_dir,
                merged_haul_lookup=haul_lookup,
                blend_alpha=blend_alpha_used,
                form_window_gws=form_window_gws_used,  # TUNE-01
                cs_prob_base=cs_prob_base_used,        # TUNE-01
                cs_prob_slope=cs_prob_slope_used,      # TUNE-01
            )
```

- [ ] **Step 6: Call `run_tuner` and merge result before saving the backtest**

Find the `save('accuracy_backtest.json', backtest_data)` line. Replace it with:

```python
            # TUNE-01: run coordinate descent tuner and merge result into backtest
            try:
                from tune import run_tuner
                tuner_result = run_tuner(
                    summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir
                )
                backtest_data['tuner'] = tuner_result
                # Promote any improved parameters into summary for next run
                if not tuner_result.get('skipped') and 'promoted_params' in tuner_result:
                    pp = tuner_result['promoted_params']
                    backtest_data['summary']['blend_alpha_used']     = pp['blend_alpha']
                    backtest_data['summary']['form_window_gws_used'] = pp['form_window_gws']
                    backtest_data['summary']['cs_prob_base_used']    = pp['cs_prob_base']
                    backtest_data['summary']['cs_prob_slope_used']   = pp['cs_prob_slope']
                    print(f"[tune] params: blend_alpha={pp['blend_alpha']}, "
                          f"form_window={pp['form_window_gws']}, "
                          f"cs_prob_base={pp['cs_prob_base']}, "
                          f"cs_prob_slope={pp['cs_prob_slope']}")
            except Exception as tune_exc:
                print(f'[tune] non-fatal error: {tune_exc}', file=sys.stderr)
            save('accuracy_backtest.json', backtest_data)
```

- [ ] **Step 7: Run full test suite**

```
cd pipeline && python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 8: Smoke test the pipeline locally (dry run)**

```
cd pipeline && USE_BLOB=false python run.py --dry-run
```

Expected output includes `Dry run complete`.

- [ ] **Step 9: Commit**

```
git add pipeline/run.py pipeline/tests/test_run.py
git commit -m "feat(tune-01): wire run.py to read tuned params and call run_tuner"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Architecture ✓, hold-out split ✓, 4 parameters with candidates ✓, 3 metrics ✓, 4 promotion gates ✓, combined score ✓, output shape ✓, run.py wiring ✓, 9 test categories ✓
- [x] **Placeholders:** None — every step has full code
- [x] **Type consistency:** `_sweep_param` returns same keys used in `run_tuner`; `compute_metrics_for_gws` returns `haul_hit_rate`/`rmse`/`captain_hit_rate` consistently; `_promotion_gates` uses those same keys
- [x] **Backward compat:** All new kwargs have defaults matching current production constants — existing callers require no changes
- [x] **Non-fatal gate:** `run_tuner` call in run.py is wrapped in `try/except` — a tuner crash cannot block the pipeline
