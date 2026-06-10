# FAS-01 + DC-01: Model Upgrades from Honest Backtesting

**Feature IDs:** FAS-01 (Fixture Attack Scaling), DC-01 (DefCon Expected Points), plus honest-tuned defaults
**Date:** 2026-06-10 (autonomous overnight session — user pre-authorized)
**Status:** Approved (validated empirically in BT-02 lab, experiments exp01–exp05)

---

## Evidence base (BT-02 leakage-free backtest, 2025/26 season, GW7–38)

| Finding | Evidence | Decision |
|---|---|---|
| Attacking EV ignores opponent difficulty entirely (difficulty only drives CS prob) | `fixture_attack_slope=0.4`: RMSE improves monotonically on BOTH train (2.958→2.955) and validation (2.937→2.932); validation top10_mean_pts 5.45→5.66 (+0.21 pts/GW) | **FAS-01: promote, default slope 0.4** |
| DefCon (2 pts at 10/12 threshold) appears in 31% of hauls, 88% of those missed; EV `2 × prior threshold rate` is near-perfectly calibrated (DEF: predicted 0.540 vs realized 0.541) | Ranking impact mixed (+validation, −train) — flat EV adds mean, not ceiling | **DC-01: promote as tunable, default scale 0.0** (tuner decides; xPts display becomes honest for DC merchants either way when tuner promotes it) |
| Form blending has real honest value | `blend_alpha=0.2, form_window=4`: validation top10_mean 5.18→5.45, captain_return 50%→60%, RMSE 2.955→2.937 | **Defaults: `BLEND_ALPHA` 0.4→0.2, `FORM_WINDOW_GWS` 5→4** |
| Team defensive form (CSF-01, either goals- or xGC-based) improves RMSE but hurts picks | top10_mean drops at every slope > 0 on both splits | cs_team_form_slope stays 0.0 (no change needed — already default) |
| Ceiling-weighted and attacking-only ranking | Both lose 0.6–1.0 top10 pts vs mean ranking | Rejected — keep ranking by mean xPts |

## FAS-01: Fixture Attack Scaling

Opponent difficulty scales attacking EV, symmetric around the average opponent — the same shape as ATF-01:

```
fas_scale = max(0.0, 1.0 + (0.5 − attack_difficulty) × fas_slope)
xg = xg × fas_scale          # applied after the ATF-01 scale, before Poisson rates
xa = xa × fas_scale
```

- `attack_difficulty` ∈ [0,1]: the opponent's overall strength score — **already present in live fixture dicts as `'attacking_difficulty'`** (merge.py ~1117/1133)
- Neutral opponent (0.5) → no change; easiest → boost; hardest (1.0, e.g. MCI) → up to −50% × slope
- `fas_slope` default **0.4** (validated); TUNE-01 candidates `[0.0, 0.2, 0.4, 0.6]` (parameter 12)

## DC-01: DefCon Expected Points

New additive xPts component (the 2025/26 defensive-contribution rule: 2 pts when a player's per-GW `defensive_contribution` count reaches 10 (DEF) / 12 (MID/FWD); GKP never — thresholds already in `defcon.py::DEFCON_THRESHOLD`):

```
defcon_pts = 2.0 × defcon_rate × defcon_scale × min(1.0, xmins / 90.0)
```

- `defcon_rate` = player's prior P(reaching threshold | played 60+ minutes): fraction of prior 60+-minute games with `defensive_contribution ≥ threshold`. Computed in `merge_players` directly from `summaries` (no dependency on defcon.py call order); in the accuracy backtest via a new strictly-prior per-(player, gw) lookup.
- `defcon_scale` default **0.0** (no-op, backward compatible); TUNE-01 candidates `[0.0, 0.25, 0.5, 0.75, 1.0]` (parameter 13)
- `defcon_pts` joins the components dict (`xPts_components_1gw`) as `'defcon'`

## Default changes (accuracy.py constants)

| Constant | Old | New | Basis |
|---|---|---|---|
| `BLEND_ALPHA` | 0.4 | 0.2 | honest tune (validation top10 +0.27) |
| `FORM_WINDOW_GWS` | 5 | 4 | honest tune |
| `FAS_SLOPE` (new) | — | 0.4 | honest tune, both-split RMSE improvement |
| `DEFCON_SCALE` (new) | — | 0.0 | calibrated but ranking-neutral; tuner decides |

## Architecture

Identical promotion pattern to ATF-01 (commits `3f4ee26`…`34eb59a` are the canonical template):

- **merge.py**: `_compute_xpts_fixture` gains `attack_difficulty=0.5`, `fas_slope=0.0`, `defcon_rate=0.0`, `defcon_scale=0.0`; FAS scale applied after ATF scale; `defcon_pts` added to total and components. `_xpts_ngw`/`_xpts_per_gw` gain `fas_slope`/`defcon_rate`/`defcon_scale`, extract `attack_difficulty = fix.get('attacking_difficulty', 0.5)` per fixture. `merge_players` gains `fas_slope`/`defcon_scale`, computes per-player `defcon_rate` from summaries, passes everything down.
- **accuracy.py**: constants `FAS_SLOPE = 0.4`, `DEFCON_SCALE = 0.0`; `BLEND_ALPHA` → 0.2, `FORM_WINDOW_GWS` → 5→4; new `build_defcon_rate_lookup(summaries, elements) -> {(gw, player_id): rate}` (strictly prior, 60+-minute denominator); `_reconstruct_xpts` / `_reconstruct_xpts_with_form` / `build_per_gw_rows` / `compute_accuracy_backtest` thread the new params (attack_difficulty = the existing per-GW `difficulty_score` already passed for CS).
- **tune.py**: parameters 12 (`fas_slope`) and 13 (`defcon_scale`); `_sweep_param` passes both + the defcon lookup to `build_per_gw_rows`.
- **run.py**: read/init/pass/write `fas_slope_used`, `defcon_scale_used` — identical pattern to `atf_slope_used`.
- **backtest.py** (lab): no changes needed — it already has both signals (this spec promotes them).

Total sweep evaluations: 72 → **81** (+4 FAS, +5 DC).

Pipeline-only; no `types.ts`/UI changes (components dict gains a key, which the UI ignores gracefully — verify in review).

## Testing

Mirror the ATF-01 test pattern exactly:
- `test_merge_xpts_components.py`: FAS no-op at slope 0 / boost vs easy opponent / penalty vs hard; DC no-op at scale 0 / adds exactly `2×rate×scale×mins_factor` / appears in components
- `test_accuracy.py`: `build_defcon_rate_lookup` basic / strictly-prior / 60-minute-denominator / cold-start-zero
- `test_tune.py`: 2 new default tests; sweep-coverage/promoted-params/locking tests updated to 13 params
- `test_run.py`: helper + both contract tests extended
- Full suite green; expect ~525 + ~14 new

## Out of scope

- xGC-based defence form (rejected for picks; lab retains it for future research)
- Ranking-function changes (mean xPts confirmed best)
- UI changes
