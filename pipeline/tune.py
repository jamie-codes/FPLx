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
    CS_PROB_BASE,
    CS_PROB_SLOPE,
    FORM_ACTUAL_BETA,
    FORM_DIFFICULTY_GAMMA,   # FRM-02
    SUB_APPEAR_WINDOW_GWS,   # APM-01
    CS_TEAM_FORM_SLOPE,      # CSF-01
    CS_DEF_FORM_WINDOW_GWS,  # CSF-01
    build_team_def_form_lookup,  # CSF-01
)

# ── Candidate sweep grids ────────────────────────────────────────────────────
BLEND_ALPHA_CANDIDATES = [round(x * 0.1, 1) for x in range(11)]   # 0.0 … 1.0
FORM_WINDOW_CANDIDATES = [3, 4, 5, 6, 7, 8]
CS_PROB_BASE_CANDIDATES = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55]
CS_PROB_SLOPE_CANDIDATES = [0.15, 0.20, 0.25, 0.30, 0.35, 0.40]
FORM_ACTUAL_BETA_CANDIDATES = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
FORM_DIFFICULTY_GAMMA_CANDIDATES = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]  # FRM-02
SUB_APPEAR_WINDOW_CANDIDATES = [10, 12, 15, 18, 20]                  # APM-01
CS_TEAM_FORM_SLOPE_CANDIDATES  = [0.0, 0.05, 0.10, 0.15, 0.20]  # CSF-01
CS_DEF_FORM_WINDOW_CANDIDATES  = [3, 5, 6, 8, 10]                # CSF-01

# ── Safety thresholds ────────────────────────────────────────────────────────
MIN_FINISHED_GWS = 13             # need at least this many GWs for a meaningful split
RMSE_REGRESSION_THRESHOLD = 0.05  # max allowed fractional RMSE worsening (5%)
CAPTAIN_REGRESSION_PP = 0.02      # max allowed captain hit rate drop (2pp)


# ── Public helpers (used in tests) ───────────────────────────────────────────

def _read_prior_params(cache_dir: str) -> dict:
    """Read current production parameter values from accuracy_backtest.json summary.

    Falls back to defaults when the file is missing or malformed (cold start).
    Returns dict with keys: blend_alpha, form_window_gws, cs_prob_base, cs_prob_slope,
    form_actual_beta, form_difficulty_gamma, sub_appear_window_gws.
    """
    # Note: blend_alpha_used is written by accuracy.py (summary block).
    # form_window_gws_used, cs_prob_base_used, cs_prob_slope_used are written
    # by run.py after tune.run_tuner() promotes values (Task 6). On the first
    # cold-start run these keys won't exist; defaults are used until Task 6 writes them.
    path = os.path.join(cache_dir, 'accuracy_backtest.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        summary = data.get('summary', {})
        return {
            'blend_alpha':       float(summary.get('blend_alpha_used', BLEND_ALPHA)),
            'form_window_gws':   int(summary.get('form_window_gws_used', FORM_WINDOW_GWS)),
            'cs_prob_base':      float(summary.get('cs_prob_base_used', CS_PROB_BASE)),
            'cs_prob_slope':     float(summary.get('cs_prob_slope_used', CS_PROB_SLOPE)),
            'form_actual_beta':  float(summary.get('form_actual_beta_used', FORM_ACTUAL_BETA)),
            'form_difficulty_gamma':  float(summary.get('form_difficulty_gamma_used', FORM_DIFFICULTY_GAMMA)),  # FRM-02
            'sub_appear_window_gws':  int(summary.get('sub_appear_window_gws_used', SUB_APPEAR_WINDOW_GWS)),  # APM-01
            'cs_team_form_slope':     float(summary.get('cs_team_form_slope_used', CS_TEAM_FORM_SLOPE)),  # CSF-01
            'cs_def_form_window_gws': int(summary.get('cs_def_form_window_gws_used', CS_DEF_FORM_WINDOW_GWS)),  # CSF-01
        }
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, ValueError):
        return {
            'blend_alpha':      BLEND_ALPHA,
            'form_window_gws':  FORM_WINDOW_GWS,
            'cs_prob_base':     CS_PROB_BASE,
            'cs_prob_slope':    CS_PROB_SLOPE,
            'form_actual_beta': FORM_ACTUAL_BETA,
            'form_difficulty_gamma': FORM_DIFFICULTY_GAMMA,   # FRM-02
            'sub_appear_window_gws': SUB_APPEAR_WINDOW_GWS,   # APM-01
            'cs_team_form_slope':     CS_TEAM_FORM_SLOPE,     # CSF-01
            'cs_def_form_window_gws': CS_DEF_FORM_WINDOW_GWS, # CSF-01
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
    elif candidate_val['rmse'] > 0:
        # Base RMSE is zero but candidate is non-zero — reject (cannot be better)
        return False
    # Gate 4: validation captain hit rate must not drop >2pp (epsilon for float safety)
    if current_val['captain_hit_rate'] - candidate_val['captain_hit_rate'] > CAPTAIN_REGRESSION_PP + 1e-9:
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


def _sweep_param(
    param_name: str,
    candidates: list,
    current_val,
    params: dict,
    summaries: dict,
    all_gws: list,
    bootstrap: dict,
    fixture_difficulty: dict,
    fixtures: list,          # CSF-01: needed to rebuild team_def_form_lookup per candidate
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
        fixtures:           raw fixture list; used to rebuild team_def_form_lookup per candidate.
        teams_by_id:        dict mapping team_id (int) -> team dict.
        gws_train:          GW numbers for training set.
        gws_validate:       GW numbers for validation set.

    Returns:
        dict with keys: current, best, promoted, and (when promoted=True) per-metric
        train/validate values.
    """
    # Invariant: current_val must match what params currently holds for this param.
    # If they diverge, the skip guard and result['current'] will be inconsistent.
    assert params.get(param_name) == current_val, (
        f"_sweep_param invariant: params['{param_name}']={params.get(param_name)} "
        f"!= current_val={current_val}"
    )
    # Baseline: current production metrics using current params
    baseline_team_def_form = build_team_def_form_lookup(
        fixtures, params['cs_def_form_window_gws']
    )  # CSF-01
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
        sub_appear_window_gws=params['sub_appear_window_gws'],   # APM-01
        team_def_form_lookup=baseline_team_def_form,             # CSF-01
        cs_team_form_slope=params['cs_team_form_slope'],         # CSF-01
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
        candidate_team_def_form = build_team_def_form_lookup(
            fixtures, candidate_params['cs_def_form_window_gws']
        )  # CSF-01
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
            sub_appear_window_gws=candidate_params['sub_appear_window_gws'],   # APM-01
            team_def_form_lookup=candidate_team_def_form,                      # CSF-01
            cs_team_form_slope=candidate_params['cs_team_form_slope'],         # CSF-01
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
            'train_haul_hit_rate':       best_train['haul_hit_rate'],
            'train_rmse':                best_train['rmse'],
            'train_captain_hit_rate':    best_train['captain_hit_rate'],
            'validate_haul_hit_rate':    best_validate['haul_hit_rate'],
            'validate_rmse':             best_validate['rmse'],
            'validate_captain_hit_rate': best_validate['captain_hit_rate'],
        })
    return result


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
        'blend_alpha':      prior['blend_alpha'],
        'form_window_gws':  prior['form_window_gws'],
        'cs_prob_base':     prior['cs_prob_base'],
        'cs_prob_slope':    prior['cs_prob_slope'],
        'form_actual_beta': prior['form_actual_beta'],
        'form_difficulty_gamma': prior['form_difficulty_gamma'],   # FRM-02
        'sub_appear_window_gws': prior['sub_appear_window_gws'],   # APM-01
        'cs_team_form_slope':     prior['cs_team_form_slope'],     # CSF-01
        'cs_def_form_window_gws': prior['cs_def_form_window_gws'], # CSF-01
    }

    sweep_results: dict = {}

    # Coordinate descent: sweep each parameter in order
    sweep_order = [
        ('blend_alpha',      BLEND_ALPHA_CANDIDATES,        prior['blend_alpha']),
        ('form_window_gws',  FORM_WINDOW_CANDIDATES,        prior['form_window_gws']),
        ('cs_prob_base',     CS_PROB_BASE_CANDIDATES,       prior['cs_prob_base']),
        ('cs_prob_slope',    CS_PROB_SLOPE_CANDIDATES,      prior['cs_prob_slope']),
        ('form_actual_beta', FORM_ACTUAL_BETA_CANDIDATES,   prior['form_actual_beta']),
        ('form_difficulty_gamma', FORM_DIFFICULTY_GAMMA_CANDIDATES,  prior['form_difficulty_gamma']),  # FRM-02
        ('sub_appear_window_gws', SUB_APPEAR_WINDOW_CANDIDATES, prior['sub_appear_window_gws']),  # APM-01
        ('cs_team_form_slope',     CS_TEAM_FORM_SLOPE_CANDIDATES,    prior['cs_team_form_slope']),     # CSF-01
        ('cs_def_form_window_gws', CS_DEF_FORM_WINDOW_CANDIDATES,    prior['cs_def_form_window_gws']), # CSF-01
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
            fixtures=fixtures,         # CSF-01
            teams_by_id=teams_by_id,
            gws_train=gws_train,
            gws_validate=gws_validate,
        )
        sweep_results[param_name] = result
        if result['promoted']:
            params[param_name] = result['best']  # lock in for next sweep

    return {
        'last_run_at':     datetime.now(timezone.utc).isoformat(),
        'finished_gws':    finished_gws,
        'gws_train':       gws_train,
        'gws_validate':    gws_validate,
        'sweep':           sweep_results,
        'promoted_params': dict(params),  # copy of final locked-in values
    }
