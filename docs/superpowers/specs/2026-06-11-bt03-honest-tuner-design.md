# BT-03: Honest Tuner — TUNE-01 evaluates on the leakage-free harness

**Feature ID:** BT-03
**Date:** 2026-06-11 (autonomous overnight session — user pre-authorized)
**Status:** Approved (top item of the 2026/27 roadmap)

---

## Problem

TUNE-01's coordinate descent evaluates every candidate with `accuracy.build_per_gw_rows`, which reconstructs each GW's "prediction" from that GW's **own** xG and minutes (contemporaneous leakage). The tuner therefore optimises formula self-consistency, not forward predictive skill. Tonight's experiments showed the two objectives genuinely diverge (e.g. leaky haul-hit 19% vs honest 10%; parameters that flatter the leaky metric lose on honest validation).

## Goal

`tune.py::run_tuner` evaluates candidates with `backtest.run_backtest` (BT-02's leakage-free, as-of-GW reconstruction) in **deploy mode** — the deadline-day reality the tuner should optimise. The display backtest (`compute_accuracy_backtest` → `accuracy_backtest.json`) is explicitly **out of scope** and unchanged.

## Design

### Archive-shaped live data

`run_tuner` already receives `bootstrap`, `fixtures`, `summaries`. Build once:

```python
archive = {'bootstrap': bootstrap, 'fixtures': fixtures, 'understat': {},
           'summaries': summaries, 'manifest': {'season': 'live'}}
```

This is exactly the shape `run_backtest(archive=...)` consumes (verified: BT-02's smoke test and `load_season_archive` produce the same keys; `summaries` is int-keyed in run.py).

### Parameter mapping (13 TUNE-01 params)

| TUNE-01 param | BT-02 param | Swept honestly? |
|---|---|---|
| `blend_alpha` | `blend_alpha` | yes |
| `form_window_gws` | `form_window_gws` | yes |
| `cs_prob_base` | `cs_prob_base` | yes |
| `cs_prob_slope` | `cs_prob_slope` | yes |
| `cs_team_form_slope` | `cs_team_form_slope` | yes |
| `cs_def_form_window_gws` | `cs_def_form_window_gws` | yes |
| `atf_slope` | `atf_slope` | yes |
| `atf_window_gws` | `atf_window_gws` | yes |
| `fas_slope` | **`fixture_attack_slope`** (name differs) | yes |
| `defcon_scale` | `defcon_scale` | yes |
| `form_actual_beta` | — (unsupported by BT-02 v1) | **frozen at prior** |
| `form_difficulty_gamma` | — (unsupported) | **frozen at prior** |
| `sub_appear_window_gws` | — (unsupported; BT-02 derives sub_appear from `xmins_window`) | **frozen at prior** |

Frozen params: removed from `sweep_order`, but still read by `_read_prior_params`, still present in `params` and `promoted_params`, still written by run.py — the run.py contract is unchanged. A module comment documents why (BT-02 v1's simplified form signal; honest lab found beta/gamma effects minor).

### Sweep mechanics

- `_sweep_param` is replaced by an honest evaluator: per candidate, `run_backtest(archive, params=mapped(candidate_params), mode='deploy', first_gw=train_first, last_gw=train_last)`; selection on the train metrics via the existing `_combined_score`.
- Train/validate split: keep the existing rule (last ⌊N/3⌋ finished GWs = validation; requires `MIN_FINISHED_GWS = 13`). Finished GWs are contiguous in practice; convert to ranges with `train_first = max(finished[0], 5)` (burn-in floor — BT-02's `min_prior_minutes` handles player-level cold start; the floor avoids degenerate GW1-4 team-form normalisation).
- Promotion gates `_promotion_gates` and `_combined_score` keep their thresholds, fed honest metrics. Metric keys used: `haul_hit_rate` (BT-02: pooled hits/haulers — note `None` when no haulers → treat as 0.0), `rmse`, `captain_hit_rate`.
- The per-candidate `team_def_form`/`team_atf`/`defcon` lookup rebuilds disappear — `run_backtest` builds its own lookups per call (window params flow through `params`). Runtime: ~50 honest runs × ~1s ≈ 1 min in CI (acceptable; the element-summary fetch already takes several minutes).

### What stays

- `_read_prior_params` (all 13 keys), `params` dict, `promoted_params` output shape, run.py read/write contract, candidate lists, gates, `MIN_FINISHED_GWS`.
- `accuracy.build_per_gw_rows` and friends — still used by `compute_accuracy_backtest` (display). tune.py simply stops importing them for evaluation.

## Testing

`test_tune.py` surgery:
- `TestSweepParam`-style tests rebuilt on archive-shaped synthetic data (reuse the synthetic-archive helper pattern from `test_backtest.py`)
- Sweep-coverage test: expects the 10 swept params (frozen 3 asserted ABSENT from sweep, PRESENT in promoted_params at their priors)
- New: `test_fas_slope_maps_to_fixture_attack_slope` (the one name translation)
- New: `test_haul_hit_none_treated_as_zero` (no-hauler GW range)
- Locking/promoted-params/contract tests updated to the new internals
- run.py contract tests unchanged (interface stable) — verify they still pass untouched

## Risks / rollback

Single-commit-series on tune.py only; the suite gates each commit. If honest tuning misbehaves in-season, rollback = revert tune.py commits (run.py contract unchanged). MIN_FINISHED_GWS unchanged means the tuner stays dormant until ~GW13 of 2026/27 — ample time to observe.

## Out of scope

- Display backtest (accuracy.py) remains leaky — it is a calibration view, not the optimisation target; revisit later
- Extending BT-02 with form_actual_beta / form_difficulty_gamma / per-param sub_appear window
- SA-02 (in-season archive) — separate infra decision with the user
