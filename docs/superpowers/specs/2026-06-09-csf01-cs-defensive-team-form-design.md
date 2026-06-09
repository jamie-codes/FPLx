# CSF-01: CS Defensive Team Form

**Feature ID:** CSF-01  
**Date:** 2026-06-09  
**Status:** Approved

---

## Goal

Extend the clean sheet model from a single-predictor (opponent attack only) to a two-predictor linear model that also accounts for the player's own team's recent defensive record:

```
cs_prob_raw = max(0.10, min(0.65,
    cs_prob_base
    − defensive_difficulty × cs_prob_slope       # existing: opponent attack quality
    − norm_concede_rate × cs_team_form_slope))   # new: own team's defensive form
```

The current model treats CS as a function of the opponent's goals-scored rate alone. A notoriously leaky defence facing a mid-table attacker receives the same CS probability as a miserly defence in the same fixture. The new term corrects this by incorporating `norm_concede_rate` — the player's team's rolling goals-conceded rate, min-max normalised across all teams.

---

## Architecture

Pipeline-only change. No new output fields, no `types.ts` changes, no UI changes. `cs_prob_1gw` continues to carry the (now more accurate) CS probability.

**Two new TUNE-01 parameters:**

| Parameter | Default | Candidates | Meaning |
|---|---|---|---|
| `cs_team_form_slope` | `0.0` | `[0.0, 0.05, 0.10, 0.15, 0.20]` | How much the team's concede rate reduces CS prob |
| `cs_def_form_window_gws` | `6` | `[3, 5, 6, 8, 10]` | Rolling window for goals-conceded average |

Default `cs_team_form_slope=0.0` → additive term vanishes → **backward-compatible no-op**. Unlike FRM-02/APM-01 this is not a multiplicative factor but an additive term in the existing linear model, so there is no separate "gamma=0" no-op path needed.

**`norm_concede_rate`** is computed from team-level fixture results (goals conceded per game, rolling `cs_def_form_window_gws`-game average), min-max normalised across all teams at each point in time. 0 = best defence (fewest goals conceded), 1 = worst.

**Total sweep evaluations:** 52 (current) + 5 + 5 = **62 per run**.

**Modified files:**
- `pipeline/accuracy.py` — new `build_team_def_form_lookup`; `CS_TEAM_FORM_SLOPE` and `CS_DEF_FORM_WINDOW_GWS` constants; `_reconstruct_xpts` and `_reconstruct_xpts_with_form` gain `norm_concede_rate`/`cs_team_form_slope`; `build_per_gw_rows` gains lookup param and `cs_team_form_slope`
- `pipeline/merge.py` — `_cs_prob`, `_cs_prob_1gw_for_fixtures`, `_compute_xpts_fixture`, `_xpts_ngw`, `merge_players` gain new params; per-team `norm_concede_rate` computed in `merge_players` and injected into fixture dicts
- `pipeline/tune.py` — parameters 8 and 9 in coordinate descent
- `pipeline/run.py` — read/init/pass/write both new params
- `pipeline/tests/test_merge_xpts_components.py` — 3 new tests
- `pipeline/tests/test_accuracy.py` — 4 new tests
- `pipeline/tests/test_tune.py` — 2 new + 4 updated
- `pipeline/tests/test_run.py` — extend `_read_tuner_params` + both contract tests

---

## `build_team_def_form_lookup` (new, in `accuracy.py`)

```python
def build_team_def_form_lookup(fixtures: list, window_gws: int = 6) -> dict:
    """(gw, team_id) → norm_concede_rate for each GW a team plays.

    For each (gw, team_id) pair: collects the last window_gws finished fixtures
    for that team STRICTLY BEFORE gw (no leakage), computes mean goals conceded.
    Denominator = actual entries seen (sparse-safe, matches xmins.py convention).
    Min-max normalises across all teams for that GW.
    Returns 0.5 for teams with no prior fixtures (neutral/unknown).
    Returns 0.5 for all teams if all have identical concede rates (cold-start guard).
    """
```

**Algorithm:**
1. Filter finished fixtures (those with `team_h_score` and `team_a_score`). Group by team: for team `t`, append `a_score` when home, `h_score` when away, keyed by GW.
2. For each `(gw, team_id)` pair in `fixtures`: find the last `window_gws` finished fixtures for team `t` with GW strictly less than `gw`. Average goals conceded; denominator = actual entries seen.
3. Collect raw averages for all teams in that GW. Min-max normalise: `norm = (xgc − min_xgc) / max(max_xgc − min_xgc, 1e-6)`. If all equal → `0.5`.
4. Missing entries (no prior data) default to `0.5`.

**Usage:**
- `accuracy.py` `compute_accuracy_backtest`: builds once with `CS_DEF_FORM_WINDOW_GWS`, passes to `build_per_gw_rows`.
- `tune.py` `_sweep_param`: rebuilds for each `candidate_params['cs_def_form_window_gws']` before each `build_per_gw_rows` call.

---

## `merge.py` changes

**`_cs_prob`** gains two parameters:

```python
def _cs_prob(
    defensive_difficulty: float,
    xmins: float,
    mins_60_prob: float | None = None,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
    norm_concede_rate: float = 0.5,    # CSF-01: own team's goals-conceded rate (normalised)
    cs_team_form_slope: float = 0.0,   # CSF-01: weight for team defensive form
) -> float:
```

Formula:
```python
cs_prob_raw = max(0.10, min(0.65,
    cs_prob_base
    - defensive_difficulty * cs_prob_slope
    - norm_concede_rate * cs_team_form_slope   # CSF-01
))
```

**`_compute_xpts_fixture`** gains `norm_concede_rate: float = 0.5` and `cs_team_form_slope: float = 0.0`, passes both to `_cs_prob`.

**`_xpts_ngw`** gains `cs_team_form_slope: float = 0.0` as a parameter. Inside the per-fixture loop, `norm_concede_rate` is extracted as `fix.get('team_def_form', 0.5)` (a per-fixture local, not a function parameter — same pattern as `defensive_difficulty`). Both are passed to `_compute_xpts_fixture`.

**`_cs_prob_1gw_for_fixtures`** gains `cs_team_form_slope: float = 0.0`. Inside its per-fixture loop, `norm_concede_rate` is extracted as `fix.get('team_def_form', 0.5)` and passed to `_cs_prob`. This keeps `cs_prob_1gw` consistent with the xPts computation.

**`merge_players`** gains `cs_team_form_slope: float = 0.0` and `cs_def_form_window_gws: int = 6`. Inside, alongside the existing `team_xgs` rolling computation, computes `team_xgc[team_id]` — rolling `cs_def_form_window_gws`-game goals conceded per team. Min-max normalises to `norm_def_form[team_id]`. Injects `'team_def_form': norm_def_form.get(t_id, 0.5)` into each fixture dict during fixture building (the existing home/away loop that builds `team_fixtures`), so it is present when `_xpts_ngw` and `_cs_prob_1gw_for_fixtures` iterate over fixtures. Passes `cs_team_form_slope` to `_xpts_ngw` and `_cs_prob_1gw_for_fixtures`.

### `test_merge_xpts_components.py` tests (3 new)

| Test | Assertion |
|---|---|
| `test_cs_prob_form_slope_zero_no_change` | `cs_team_form_slope=0.0`, any `norm_concede_rate` → identical to old formula |
| `test_cs_prob_leaky_defence_reduces_prob` | `norm_concede_rate=1.0`, `cs_team_form_slope=0.2` → lower `cs_prob` than slope=0 baseline |
| `test_cs_prob_solid_defence_increases_prob` | `norm_concede_rate=0.0`, `cs_team_form_slope=0.2` → same `cs_prob` as slope=0 baseline (term = 0.0×0.2 = 0; no penalty for solid defence) |

---

## `accuracy.py` changes

**New constants** (alongside existing):
```python
CS_TEAM_FORM_SLOPE   = 0.0  # CSF-01: default no-op
CS_DEF_FORM_WINDOW_GWS = 6  # CSF-01: rolling window for team goals-conceded
```

**`_reconstruct_xpts`** gains `norm_concede_rate: float = 0.5` and `cs_team_form_slope: float = 0.0`, passes both to `_compute_xpts_fixture`. (Same pattern as `mins_60_prob` and `sub_appear_prob` from APM-01.)

**`_reconstruct_xpts_with_form`** gains the same two params; threads through the `form_per90 is None` fallback to `_reconstruct_xpts` and through the `_compute_xpts_fixture` call.

**`build_per_gw_rows`** gains:
- `team_def_form_lookup: dict` (pre-built, passed in; default `{}`)
- `cs_team_form_slope: float = CS_TEAM_FORM_SLOPE`

Inside the per-player, per-GW loop, after the existing `difficulty_score` lookup:
```python
norm_concede_rate_at_gw = team_def_form_lookup.get((gw, player_team_id), 0.5)
```
Passed to both `_reconstruct_xpts` and `_reconstruct_xpts_with_form`.

**`compute_accuracy_backtest`** builds `team_def_form_lookup = build_team_def_form_lookup(fixtures, CS_DEF_FORM_WINDOW_GWS)` once and passes it to `build_per_gw_rows`.

### `test_accuracy.py` tests (4 new)

| Test | Assertion |
|---|---|
| `test_build_team_def_form_lookup_basic` | Team with higher goals conceded → higher `norm_concede_rate` than team with fewer |
| `test_build_team_def_form_lookup_cold_start` | No prior fixtures for a team → returns `0.5` |
| `test_build_team_def_form_lookup_sparse` | Only 2 prior games with window=6 → denominator = 2 (actual entries) |
| `test_build_team_def_form_lookup_all_equal` | All teams identical concede rate → returns `0.5` for all (division guard) |

---

## `tune.py` changes

```python
from accuracy import (
    ..., CS_TEAM_FORM_SLOPE, CS_DEF_FORM_WINDOW_GWS,
    build_team_def_form_lookup,
)

CS_TEAM_FORM_SLOPE_CANDIDATES  = [0.0, 0.05, 0.10, 0.15, 0.20]  # CSF-01
CS_DEF_FORM_WINDOW_CANDIDATES  = [3, 5, 6, 8, 10]                # CSF-01
```

`_read_prior_params` both branches gain:
```python
'cs_team_form_slope':    float(summary.get('cs_team_form_slope_used',    CS_TEAM_FORM_SLOPE)),
'cs_def_form_window_gws': int(summary.get('cs_def_form_window_gws_used', CS_DEF_FORM_WINDOW_GWS)),
```

`params` dict and `sweep_order` gain the 8th and 9th entries:
```python
('cs_team_form_slope',    CS_TEAM_FORM_SLOPE_CANDIDATES,  prior['cs_team_form_slope']),
('cs_def_form_window_gws', CS_DEF_FORM_WINDOW_CANDIDATES, prior['cs_def_form_window_gws']),
```

Both `build_per_gw_rows` calls in `_sweep_param` gain:
```python
team_def_form_lookup=build_team_def_form_lookup(
    fixtures, candidate_params['cs_def_form_window_gws']
),                                         # CSF-01
cs_team_form_slope=candidate_params['cs_team_form_slope'],  # CSF-01
```

### `test_tune.py` tests (2 new, 4 updated)

| Test | Change |
|---|---|
| `test_cs_team_form_slope_default_in_read_prior_params` | New — missing key → returns `CS_TEAM_FORM_SLOPE` |
| `test_cs_def_form_window_default_in_read_prior_params` | New — missing key → returns `CS_DEF_FORM_WINDOW_GWS` |
| `test_run_tuner_sweep_covers_all_parameters` | Add both new keys to assertion |
| `test_run_tuner_promoted_params_contains_all_params` | Add both new keys |
| `test_coordinate_locking_uses_prior_sweep_value` | Add assertions for both params; update docstring to "nine sweeps" |
| All `TestSweepParam` params dicts | Add `'cs_team_form_slope': 0.0, 'cs_def_form_window_gws': 6` |

---

## `run.py` changes

Identical read/pass/write pattern to all previous tunable parameters:

```python
cs_team_form_slope_used    = accuracy.CS_TEAM_FORM_SLOPE      # CSF-01: default
cs_def_form_window_gws_used = accuracy.CS_DEF_FORM_WINDOW_GWS  # CSF-01: default

# inside try:
cs_team_form_slope_used    = float(prev_backtest.get('summary', {}).get(
    'cs_team_form_slope_used', accuracy.CS_TEAM_FORM_SLOPE))
cs_def_form_window_gws_used = int(prev_backtest.get('summary', {}).get(
    'cs_def_form_window_gws_used', accuracy.CS_DEF_FORM_WINDOW_GWS))

# merge_players call:
merge.merge_players(...,
    cs_team_form_slope=cs_team_form_slope_used,
    cs_def_form_window_gws=cs_def_form_window_gws_used,
)

# after run_tuner:
backtest_data['summary']['cs_team_form_slope_used']    = pp['cs_team_form_slope']
backtest_data['summary']['cs_def_form_window_gws_used'] = pp['cs_def_form_window_gws']
```

`compute_xmins_stats` call gains `cs_def_form_window_gws` is not needed here (xmins is unaffected). The `build_team_def_form_lookup` call is inside `accuracy.compute_accuracy_backtest`, not `run.py` directly.

Print lines updated to include both new params in startup and `[tune]` output.

### `test_run.py` changes

Extend `_read_tuner_params` helper with both new keys (`cs_team_form_slope_used=0.0`, `cs_def_form_window_gws_used=6`). Update both contract tests: defaults test asserts both defaults; promoted-values test adds `cs_team_form_slope_used: 0.1` and `cs_def_form_window_gws_used: 5` with matching assertions.
