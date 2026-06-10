# BT-02: Leakage-Free Full-Season Backtest Harness

**Feature ID:** BT-02
**Date:** 2026-06-10
**Status:** Approved (autonomous overnight session — user pre-authorized)

---

## Goal

An offline backtest "lab" that answers, honestly: *would the model have picked this player BEFORE the gameweek?* It consumes the SA-01 season archive (no network), reconstructs every model input strictly from data available before each target GW, predicts xPts for GWs 7–38 (~32 evaluation GWs vs today's 5), and scores predictions against actual points with picks-focused metrics.

## Why

The existing backtest (`accuracy.py::_reconstruct_xpts`) feeds each GW's **own** `expected_goals` and actual `minutes` into the "prediction" (accuracy.py:1068-1075). That measures formula calibration, not forward skill — a player's haul GW carries its own high xG into its own prediction. Every signal experiment we want to run (DefCon route, penalty uplift, xGC-based CS, re-tuning the 11 TUNE-01 parameters) needs an honest, fast, repeatable evaluation or we will tune the model to flatter itself.

`accuracy.py` and the live pipeline are **not modified** — BT-02 is a standalone lab. If the lab proves better tuning values, promoting them to the live pipeline is a separate, later change.

## Architecture

New module **`pipeline/backtest.py`** + tests. Reuses (imports, does not modify):
- `capture_season.load_season_archive()` — data source
- `merge._compute_xpts_fixture` — the leaf scoring function (single source of truth for the xPts formula, including CSF-01/ATF-01)
- `accuracy.build_fixture_difficulty_lookup`, `accuracy.build_team_def_form_lookup`, `accuracy.build_team_atf_lookup` — already strictly-prior, leakage-free

### Point-in-time signal construction (the core)

For each player, for each target GW `g` in the evaluation range, using only history rounds `r < g`:

| Signal | Honest construction |
|---|---|
| `xg_per90`, `xa_per90` (season) | cumulative `expected_goals`/`expected_assists`/`minutes` over rounds `< g`; per-90 only if cumulative minutes ≥ `MIN_PRIOR_MINUTES = 270`, else player is ineligible at `g` |
| form per-90 | same per-90 over the last `form_window_gws` rounds `< g` with minutes > 0; blended `(1-blend_alpha)*season + blend_alpha*form` when the form window has ≥ 90 prior minutes, else season only |
| `xmins` (deploy mode) | mean minutes over last `XMINS_WINDOW = 5` rounds `< g` |
| `start_prob` (deploy mode) | fraction of last 5 rounds `< g` with `starts ≥ 1` |
| `mins_60_prob` | fraction of last 5 rounds `< g` with `minutes ≥ 60` |
| `sub_appear_prob` | fraction of last 5 rounds `< g` with `0 < minutes < 45` |
| `defensive_difficulty` | `build_fixture_difficulty_lookup` (FPL pre-published difficulty — inherently pre-GW) |
| `norm_concede_rate`, `norm_attack_rate` | existing strict-prior lookups over archive fixtures |

**Two evaluation modes** (decomposes minutes-model error from rate-model error):
- **`deploy`** (headline): xmins/start_prob predicted from prior rounds as above. Eligibility: cumulative prior minutes ≥ 270 AND predicted xmins > 0. This is what a real user faces on deadline day.
- **`conditional`**: uses the target GW's actual minutes (binary start_prob = minutes ≥ 45, like today's backtest) and filters to rounds with minutes ≥ 10. Isolates the quality of the per-90/rate model. The per-90s remain strictly prior — only minutes are conditioned on.

**DGW handling**: history has one entry per fixture (`round` repeats in double GWs). Predicted xPts for GW `g` = **sum of per-fixture predictions** over all of that player's team's fixtures in `g` (difficulty/form per fixture); actual = sum of `total_points` across the GW's entries. DGWs are evaluated honestly, not skipped.

### Prediction

Per eligible player per GW: call `merge._compute_xpts_fixture` once per fixture with the as-of-GW signals and the parameter set under test; sum across the GW's fixtures.

### Parameters under test

`run_backtest` accepts a `params` dict (defaults = current model defaults) covering: `blend_alpha`, `form_window_gws`, `cs_prob_base`, `cs_prob_slope`, `cs_team_form_slope`, `cs_def_form_window_gws`, `atf_slope`, `atf_window_gws`, plus BT-02-local `min_prior_minutes`, `xmins_window`. (`form_actual_beta`, `form_difficulty_gamma`, `sub_appear_window_gws` are accepted and threaded where applicable but BT-02's simplified form signal may not use all three — documented in code.)

### Metrics (overall + per-GW + per-position)

| Metric | Definition |
|---|---|
| `haul_hit_rate` | of actual haulers (≥10 pts) per GW, fraction ranked in model top-10 |
| `haul_capture_20` | same with top-20 |
| `mid_tier_hit_rate` | actual 6–9 pt scorers captured in model top-30 |
| `captain_hit_rate` | model rank-1 player is the GW's top actual scorer |
| `captain_return_rate` | model rank-1 player scored ≥ 6 (robust version) |
| `top10_mean_pts` | mean actual points of the model's top-10 — "what you'd have gotten following the picks" |
| `rmse`, `mae` | predicted vs actual per player-GW |
| `spearman` | per-GW rank correlation, averaged |

### Public API

```python
def run_backtest(archive: dict | None = None,    # default: load_season_archive()
                 params: dict | None = None,      # default: model defaults
                 mode: str = 'deploy',            # 'deploy' | 'conditional'
                 first_gw: int = 7, last_gw: int = 38) -> dict:
    """Returns {'metrics': {...}, 'per_gw': [{gw, haul_hit, n_haulers, top10_mean_pts, ...}],
    'rows': [{player_id, web_name, position, gw, xpts_pred, actual_pts, ...signals...}],
    'config': {mode, first_gw, last_gw, params}}"""
```

CLI: `python backtest.py [--mode deploy|conditional] [--first-gw 7] [--set key=value ...] [--json out.json]` — prints a metrics table; `--set` overrides individual params (repeatable).

## Testing

`pipeline/tests/test_backtest.py` with a synthetic archive builder (2 teams, ~6 players, 12 GWs, deterministic):

| Test | Assertion |
|---|---|
| `test_no_leakage_target_gw_excluded` | inflate a player's xG massively in GW `g` only → prediction for `g` is IDENTICAL to the un-inflated case (the leak the old backtest has) |
| `test_eligibility_min_prior_minutes` | player with < 270 prior minutes at `g` produces no row at `g`, appears later once over threshold |
| `test_dgw_sums_two_fixtures` | team with 2 fixtures in GW g → predicted = sum of 2 per-fixture predictions; actual = sum of both entries' points |
| `test_modes_differ_on_minutes` | rotation player (alternating 90/0 minutes): deploy-mode xmins ≈ 45, conditional uses actual |
| `test_param_override_changes_predictions` | `atf_slope=0.4` with non-neutral team form → different xpts than default |
| `test_haul_hit_rate_computation` | hand-built rows with known haulers/rankings → exact expected metric values |
| `test_spearman_perfect_and_inverted` | identical ranking → 1.0; inverted → -1.0 |
| `test_cli_set_parsing` | `--set atf_slope=0.2 --set form_window_gws=4` parses to typed values |

Plus a real-data smoke test (marked, runs only if `pipeline/data/season_2025_26/manifest.json` exists): `run_backtest(first_gw=35, last_gw=38)` completes, produces rows for ≥ 200 players/GW, metrics in [0,1] where applicable.

## Out of scope

- New signals (DefCon, penalty uplift, xGC CS) — separate experiments USING this harness
- Any modification to `accuracy.py`, `tune.py`, `run.py`, `merge.py`, or the live pipeline
- Multi-season support (only 2025/26 archived)
- Promoting tuned parameters to production
