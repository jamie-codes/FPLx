# ATF-01: Attack Team Form

**Feature ID:** ATF-01  
**Date:** 2026-06-10  
**Status:** Approved

---

## Goal

Extend the xPts scoring model to account for the player's own team's recent attacking record. Currently a player's expected goals and assists are driven solely by their individual form signal — a striker on a team in poor attacking form receives the same xG/xA scaling as one on a team firing on all cylinders.

The new term corrects this by incorporating `norm_attack_rate` — the player's team's rolling goals-scored rate, min-max normalised across all teams — as a symmetric multiplicative scale on both `xg_per90` and `xa_per90`:

```
atf_scale = 1.0 + (norm_attack_rate - 0.5) × atf_slope
xg = max(0.0, xg_per90 × atf_scale)
xa = max(0.0, xa_per90 × atf_scale)
```

`norm_attack_rate` = 0.5 (neutral/average) → `atf_scale = 1.0` → no change.  
`norm_attack_rate` = 1.0 (best attack), `atf_slope = 0.30` → `atf_scale = 1.15` → +15% on xG and xA.  
`norm_attack_rate` = 0.0 (worst attack), `atf_slope = 0.30` → `atf_scale = 0.85` → −15% on xG and xA.

The multiplicative form is intentional: proportional scaling preserves relative differences across player types (a striker with `xg_per90=0.50` and a midfielder with `xg_per90=0.10` both move by the same percentage). An additive offset to `lam_g` would disproportionately affect low-volume players.

---

## Architecture

Pipeline-only change. No new output fields, no `types.ts` changes, no UI changes. `xpts_1gw`, `xpts_3gw`, `xpts_5gw` continue to carry the (now more accurate) xPts values.

**Two new TUNE-01 parameters:**

| Parameter | Default | Candidates | Meaning |
|---|---|---|---|
| `atf_slope` | `0.0` | `[0.0, 0.10, 0.20, 0.30, 0.40]` | Strength of team attack form effect on xG/xA |
| `atf_window_gws` | `6` | `[3, 5, 6, 8, 10]` | Rolling window for goals-scored average |

Default `atf_slope=0.0` → `atf_scale=1.0` → additive term vanishes → **backward-compatible no-op**.

**`norm_attack_rate`** is computed from team-level fixture results (goals scored per game, rolling `atf_window_gws`-game average), min-max normalised across all teams at each point in time. 0 = worst attack (fewest goals scored), 1 = best.

**Total sweep evaluations:** 72 (current 62 + 5 + 5).

**Modified files:**
- `pipeline/merge.py` — `_compute_xpts_fixture` gains `norm_attack_rate`/`atf_slope`; `_xpts_ngw`, `_xpts_per_gw`, `_cs_prob_1gw_for_fixtures` extract `team_atf_form` per fixture; `merge_players` gains `atf_slope`/`atf_window_gws`, computes `norm_atf_form`, injects `'team_atf_form'` into fixture dicts
- `pipeline/accuracy.py` — new `build_team_atf_lookup`; `ATF_SLOPE` and `ATF_WINDOW_GWS` constants; `_reconstruct_xpts` and `_reconstruct_xpts_with_form` gain `norm_attack_rate`/`atf_slope`; `build_per_gw_rows` gains lookup param and `atf_slope`; `compute_accuracy_backtest` builds lookup once
- `pipeline/tune.py` — parameters 10 and 11 in coordinate descent
- `pipeline/run.py` — read/init/pass/write both new params
- `pipeline/tests/test_merge_xpts_components.py` — 3 new tests
- `pipeline/tests/test_accuracy.py` — 4 new tests
- `pipeline/tests/test_tune.py` — 2 new + 4 updated
- `pipeline/tests/test_run.py` — extend `_read_tuner_params` + both contract tests

---

## `build_team_atf_lookup` (new, in `accuracy.py`)

```python
def build_team_atf_lookup(fixtures: list, window_gws: int = ATF_WINDOW_GWS) -> dict:
    """(gw, team_id) → norm_attack_rate for each GW a team plays.

    For each (gw, team_id) pair: collects the last window_gws finished fixtures
    for that team STRICTLY BEFORE gw (no leakage), computes mean goals scored.
    Denominator = actual entries seen (sparse-safe, matches xmins.py convention).
    Min-max normalises across all teams for that GW.
    Returns 0.5 for teams with no prior fixtures (neutral/unknown).
    Returns 0.5 for all teams if all have identical scoring rates (cold-start guard).
    """
```

**Algorithm** (mirrors `build_team_def_form_lookup` exactly, using goals scored):
1. Filter finished fixtures (those with `team_h_score` and `team_a_score`). Group by team: for team `t`, append `h_score` when home, `a_score` when away, keyed by GW.
2. For each `(gw, team_id)` pair in `fixtures`: find the last `window_gws` finished fixtures for team `t` with GW strictly less than `gw`. Average goals scored; denominator = actual entries seen.
3. Collect raw averages for all teams in that GW. Min-max normalise: `norm = (xgs − min_xgs) / max(max_xgs − min_xgs, 1e-6)`. If all equal → `0.5`.
4. Missing entries (no prior data) default to `0.5`.

**Usage:**
- `accuracy.py` `compute_accuracy_backtest`: builds once with `ATF_WINDOW_GWS`, passes to `build_per_gw_rows`.
- `tune.py` `_sweep_param`: rebuilds for each `candidate_params['atf_window_gws']` before each `build_per_gw_rows` call (alongside the existing `team_def_form_lookup` rebuild).

---

## `merge.py` changes

**`_compute_xpts_fixture`** gains two parameters after `cs_team_form_slope`:

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
    sub_appear_prob: float = 0.0,
    norm_concede_rate: float = 0.5,
    cs_team_form_slope: float = 0.0,
    norm_attack_rate: float = 0.5,    # ATF-01: own team's goals-scored rate (normalised)
    atf_slope: float = 0.0,           # ATF-01: weight for team attack form
) -> dict:
```

Formula (applied before Poisson rate computation):
```python
atf_scale = 1.0 + (norm_attack_rate - 0.5) * atf_slope   # ATF-01
xg = max(0.0, xg_per90 * atf_scale)
xa = max(0.0, xa_per90 * atf_scale)
lam_g = xg * (xmins / 90.0)
lam_a = xa * (xmins / 90.0)
```

**`_xpts_ngw`**, **`_xpts_per_gw`**, **`_cs_prob_1gw_for_fixtures`** each gain `atf_slope: float = 0.0`. Inside their per-fixture loops, `norm_attack_rate` is extracted as `fix.get('team_atf_form', 0.5)` (a per-fixture local, same pattern as `norm_concede_rate` / `defensive_difficulty`). Both are passed to `_compute_xpts_fixture`.

**`merge_players`** gains `atf_slope: float = 0.0` and `atf_window_gws: int = 6`. Inside, alongside the existing CSF-01 `norm_def_form` block, computes `norm_atf_form` from the already-built `team_goals_scored` dict:

```python
# ATF-01: normalised team attack form
team_xgs_atf: dict[int, float] = {}
for t_id, scored_list in team_goals_scored.items():
    last_n = scored_list[-atf_window_gws:]
    team_xgs_atf[t_id] = sum(last_n) / len(last_n) if last_n else 0.0
xgs_values = list(team_xgs_atf.values())
min_xgs = min(xgs_values) if xgs_values else 0.0
max_xgs = max(xgs_values) if xgs_values else 1.0
norm_atf_form: dict[int, float] = {}
for t_id, xgs in team_xgs_atf.items():
    if max_xgs - min_xgs > 1e-6:
        norm_atf_form[t_id] = (xgs - min_xgs) / (max_xgs - min_xgs)
    else:
        norm_atf_form[t_id] = 0.5
```

Injects `'team_atf_form': norm_atf_form.get(h_id, 0.5)` (home) and `'team_atf_form': norm_atf_form.get(a_id, 0.5)` (away) into each fixture dict during fixture building, alongside the existing `'team_def_form'`. Passes `atf_slope` to `_xpts_ngw`, `_xpts_per_gw`, and `_cs_prob_1gw_for_fixtures`.

### `test_merge_xpts_components.py` tests (3 new)

| Test | Assertion |
|---|---|
| `test_atf_slope_zero_no_change` | `atf_slope=0.0`, any `norm_attack_rate` → identical xpts to current formula |
| `test_atf_best_attack_increases_xpts` | `norm_attack_rate=1.0`, `atf_slope=0.30` → higher xpts than slope=0 baseline |
| `test_atf_worst_attack_decreases_xpts` | `norm_attack_rate=0.0`, `atf_slope=0.30` → lower xpts than slope=0 baseline |

---

## `accuracy.py` changes

**New constants** (alongside CSF-01 constants):
```python
ATF_SLOPE      = 0.0  # ATF-01: default no-op; tunable via TUNE-01
ATF_WINDOW_GWS = 6    # ATF-01: rolling window for team goals-scored
```

**`_reconstruct_xpts`** gains `norm_attack_rate: float = 0.5` and `atf_slope: float = 0.0` after `cs_team_form_slope`, passes both to `_compute_xpts_fixture`.

**`_reconstruct_xpts_with_form`** gains the same two params; threads through the `form_per90 is None` fallback to `_reconstruct_xpts` and through the `_compute_xpts_fixture` call.

**`build_per_gw_rows`** gains:
- `team_atf_lookup: dict` (pre-built, passed in; default `{}`)
- `atf_slope: float = ATF_SLOPE`

Inside the per-player, per-GW loop, after the existing `norm_concede_rate_at_gw` lookup:
```python
norm_attack_rate_at_gw = team_atf_lookup.get((gw, player_team_id), 0.5)
```
Passed to both `_reconstruct_xpts` and `_reconstruct_xpts_with_form`.

**`compute_accuracy_backtest`** adds `team_atf_lookup = build_team_atf_lookup(fixtures, ATF_WINDOW_GWS)` after the existing `team_def_form_lookup` build; passes `team_atf_lookup` to `build_per_gw_rows`.

### `test_accuracy.py` tests (4 new)

| Test | Assertion |
|---|---|
| `test_build_team_atf_lookup_basic` | Team with more goals scored → higher `norm_attack_rate` than team with fewer |
| `test_build_team_atf_lookup_cold_start` | No prior fixtures for a team → returns `0.5` |
| `test_build_team_atf_lookup_sparse` | Only 2 prior games with window=6 → denominator = 2 (actual entries) |
| `test_build_team_atf_lookup_all_equal` | All teams identical scoring rate → returns `0.5` for all |

---

## `tune.py` changes

```python
from accuracy import (
    ..., ATF_SLOPE, ATF_WINDOW_GWS,
    build_team_atf_lookup,
)

ATF_SLOPE_CANDIDATES   = [0.0, 0.10, 0.20, 0.30, 0.40]  # ATF-01
ATF_WINDOW_CANDIDATES  = [3, 5, 6, 8, 10]                # ATF-01
```

`_read_prior_params` both branches gain:
```python
'atf_slope':      float(summary.get('atf_slope_used',      ATF_SLOPE)),
'atf_window_gws': int(summary.get('atf_window_gws_used',   ATF_WINDOW_GWS)),
```

`params` dict and `sweep_order` gain the 10th and 11th entries:
```python
('atf_slope',      ATF_SLOPE_CANDIDATES,  prior['atf_slope']),
('atf_window_gws', ATF_WINDOW_CANDIDATES, prior['atf_window_gws']),
```

Both `build_per_gw_rows` calls in `_sweep_param` gain:
```python
team_atf_lookup=build_team_atf_lookup(
    fixtures, candidate_params['atf_window_gws']
),                                             # ATF-01
atf_slope=candidate_params['atf_slope'],       # ATF-01
```

### `test_tune.py` tests (2 new, 4 updated)

| Test | Change |
|---|---|
| `test_atf_slope_default_in_read_prior_params` | New — missing key → returns `ATF_SLOPE` |
| `test_atf_window_default_in_read_prior_params` | New — missing key → returns `ATF_WINDOW_GWS` |
| `test_run_tuner_sweep_covers_all_parameters` | Add both new keys to assertion |
| `test_run_tuner_promoted_params_contains_all_params` | Add both new keys |
| `test_coordinate_locking_uses_prior_sweep_value` | Add assertions for both params; update docstring to "eleven sweeps" |
| All `TestSweepParam` params dicts | Add `'atf_slope': 0.0, 'atf_window_gws': 6` |

---

## `run.py` changes

Identical read/pass/write pattern to all previous tunable parameters:

```python
atf_slope_used      = accuracy.ATF_SLOPE       # ATF-01: default
atf_window_gws_used = accuracy.ATF_WINDOW_GWS  # ATF-01: default

# inside try:
atf_slope_used      = float(prev_backtest.get('summary', {}).get(
    'atf_slope_used', accuracy.ATF_SLOPE))
atf_window_gws_used = int(prev_backtest.get('summary', {}).get(
    'atf_window_gws_used', accuracy.ATF_WINDOW_GWS))

# merge_players call:
merge.merge_players(...,
    atf_slope=atf_slope_used,
    atf_window_gws=atf_window_gws_used,
)

# after run_tuner:
backtest_data['summary']['atf_slope_used']      = pp['atf_slope']
backtest_data['summary']['atf_window_gws_used'] = pp['atf_window_gws']
```

Print lines updated to include both new params in startup and `[tune]` output.

### `test_run.py` changes

Extend `_read_tuner_params` helper with both new keys (`atf_slope_used=0.0`, `atf_window_gws_used=6`). Update both contract tests: defaults test asserts both defaults; promoted-values test adds `atf_slope_used: 0.2` and `atf_window_gws_used: 5` with matching assertions.
