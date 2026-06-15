# ML Shadow-Model Groundwork

**Feature ID:** ML-01 (season-launch readiness §3 / §6 #5 — ML shadow model groundwork)
**Date:** 2026-06-15
**Status:** Approved — groundwork build (lab harness + in-sample shadow read; NO live wiring, NO promotion; true validation gated on 2026/27)

---

## Problem & honest framing

The formula xPts model is the production engine. An ML model (gradient-boosted trees over the same leakage-free signals) has a higher accuracy ceiling and could eventually run as a shadow / ensemble — but it can only be *validated* with a true cold cross-season test, which needs a second season (2026/27 + the committed 2025/26 archive). This build stands up the **feature-extraction + position-specific train/eval harness now**, against the 2025/26 archive, so that validation is a one-call run the moment season 2 accrues — and runs an **in-sample shadow comparison** today as a sanity/smoke check.

**The central caveat (stated loudly in code, output, and here):** with only one season, the train(GW7-28)→test(GW29-38) split shares the same players across both halves. A tree model can memorize player-level scoring level from H1 and reapply it in H2 — a gift a real cold cross-season model would NOT receive. So the in-sample numbers **overstate true edge**. The exp11 output is a *smoke/sanity demonstration* (does the harness work end-to-end; does ML look competitive in-sample), **not** a promotion signal. There is deliberately **no SHIP/NO_SHIP verdict**. Promotion is gated on a cold 2026/27 cross-season test (train on 2025/26, predict 2026/27 unseen), which this harness is built to run unchanged.

## Scope decisions (from brainstorming)

- **Model library: xgboost** (pinned). Higher ceiling than sklearn; prebuilt wheels on CI (ubuntu) + local Windows — no compiler. Imported only by the lab module + its tests; the production `run.py` never imports it.
- **Eval: in-sample shadow now, loudly caveated** (not deferred). Proves the harness works on real data and surfaces obvious bugs.
- **Position-specific models** (one per element_type) — matches the readiness plan and domain sense (GK vs FWD scoring dynamics differ).
- **Groundwork only** — nothing wired into the live pipeline, nothing promoted.

## Dependency

Add `xgboost` (pinned, current stable compatible with `numpy>=2.2`, e.g. `xgboost==2.1.4` — implementer pins the latest stable that resolves) to:
- `pipeline/requirements.txt`
- the `pip install` line in `.github/workflows/pipeline.yml` (so the CI test job can import `pipeline/ml/`).

numpy is already a CI dependency (used by `simulate.py`). No other new deps (the stdlib `_spearman` in backtest.py is reused via `compute_metrics`; no scipy needed).

## Architecture

### `pipeline/ml/features.py` — leakage-free feature extraction
- `build_feature_row(history, gw, params, fixture_ctx) -> dict | None` — returns a flat `{feature_name: float}` from:
  - the 12 `build_asof_signals` as-of signals (xg_per90, xa_per90, season_xg90, season_xa90, cum_minutes, xmins, start_prob, mins_60_prob, sub_appear_prob, dc_rate_10, dc_rate_12, saves_per90),
  - fixture-level leakage-free signals from `fixture_ctx`: `norm_concede_rate` (def_form), `norm_attack_rate` (atf_form), normalized `difficulty`, and ODDS-01 `odds_cs_prob` + `attack_difficulty` when a lookup is supplied (else neutral 0.5 / 0.0),
  - static features: `now_cost` (price), `was_home` (0/1), `n_fixtures` (DGW count).
  - Returns `None` when `build_asof_signals` returns `None` (no prior data). `element_type` is NOT a feature — it is the model-split key.
- `build_dataset(archive, params, first_gw=7, last_gw=38, odds_lookup=None) -> tuple[list[dict], list[str]]` — iterates `summaries[pid]['history']` exactly as `run_backtest` (group by `round`, gate on `cum_minutes >= min_prior_minutes` and `xmins > 0`), producing one row per (player, gw):
  `{'features': {...}, 'label': actual_pts, 'element_type': int, 'player_id': int, 'web_name': str, 'gw': int, 'actual_minutes': int, 'n_fixtures': int}`.
  `label = sum(total_points)` over that GW's entries; `n_fixtures = len(entries)`. Returns the rows + the stable ordered `feature_names`. Strictly leakage-free: only `round < gw` feeds features; `round == gw` is the label.

### `pipeline/ml/model.py` — position-specific xgboost
- `rows_to_matrix(rows, feature_names) -> np.ndarray` — stack `features` in `feature_names` order.
- `train_position_models(train_rows, feature_names, seed=42) -> dict[int, XGBRegressor]` — one `xgboost.XGBRegressor` per `element_type` ∈ {1,2,3,4}, fixed `random_state=seed`, regularized defaults (`n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8`), target = `label`. A position with too few rows (<50) still trains (xgboost handles small N) — logged.
- `predict(models, rows, feature_names) -> list[float]` — routes each row to `models[row['element_type']]`; returns predictions aligned to `rows`.
- Deterministic: same seed + same data → identical predictions (asserted in tests).

### `pipeline/experiments/exp11_ml_shadow.py` (+ `.json`)
1. `build_dataset` over GW7-38 (optionally with the ODDS-01 lookup for the odds features).
2. Split **train = GW7-28**, **test = GW29-38**.
3. Train position models on train rows; predict on test rows; assemble rows in the **exact `run_backtest` schema** (`xpts_pred` = ML prediction, `actual_pts`, `element_type`, `gw`, `n_fixtures`, `web_name`, `player_id`, plus `actual_minutes`); call **`compute_metrics`** → ML metrics + per_gw.
4. Run the **formula model**: `run_backtest(archive, mode='deploy', first_gw=29, last_gw=38)` → formula metrics on the same window.
5. Build a side-by-side comparison of ML vs formula on every BT-02 metric (top10_mean_pts, haul_hit_rate, haul_capture_20, mid_tier_hit_rate, captain_hit_rate, captain_return_rate, rmse, mae, spearman, by_position) + per-position xgboost feature importances.
6. Write `exp11_ml_shadow.json` = `{ml_metrics, formula_metrics, feature_importances, caveat, config}`. Print the table + the `CAVEAT`. **No SHIP/NO_SHIP** — groundwork, not validation. CLI `python -m experiments.exp11_ml_shadow`.

The `CAVEAT` string (verbatim in output + json): *"IN-SAMPLE shadow over one season — train/test share players across halves, so the model memorizes player-level scoring and these numbers OVERSTATE true edge. This is a harness sanity check, NOT a promotion signal. Promotion is gated on a cold 2026/27 cross-season test (train 2025/26 → predict 2026/27 unseen)."*

## Testing

- `features.py`:
  - feature row has all expected keys, all values numeric (float); `None` when no prior data.
  - **Leakage test:** appending/mutating a future entry (`round >= gw`) does not change the feature row for that gw.
  - `build_dataset` admits the same (player, gw) rows as `run_backtest` (same gating) and labels match `sum(total_points)`.
- `model.py`:
  - `train_position_models` + `predict` on a small synthetic dataset returns finite numbers, one per row.
  - position routing: a GK (element_type 1) row is scored by the GK model.
  - determinism: same seed → identical predictions.
- `exp11_ml_shadow.py`:
  - runs end-to-end on the archive; returns `ml_metrics` + `formula_metrics` dicts (finite, plausible ranges) + the `caveat` string; writes the json. Mark `slow` if it dominates suite runtime.
- Full pipeline suite green; xgboost import confined to `pipeline/ml/` + its tests (the prod `run.py` import graph is unchanged — assert/verify run.py does not import ml).

## Out of scope

- Any live wiring: no `ml_xpts` / `ensemble_xpts` / `model_disagreement` field in `merged_players.json`; no `run.py` import of `ml/`. (Post-validation work.)
- Any promotion or live default change.
- The true cold 2026/27 cross-season validation (gated on that season; the harness is built ready to run it).
- Hyperparameter tuning beyond sane defaults, ensembling/stacking, per-component targets, model serialization/persistence. (YAGNI for groundwork.)
- Any UI change.
