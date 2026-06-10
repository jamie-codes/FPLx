"""Coordinate descent parameter tuner for the xPts model (TUNE-01).

Sweeps 10 parameters in sequence using the leakage-free backtest harness
(BT-02 `run_backtest` in deploy mode). Each parameter is evaluated on three
metrics (haul hit rate, xPts RMSE, captain hit rate) over a held-out GW
window. Promotes a value only when it passes all safety gates.
Non-fatal: run.py wraps the call in try/except.

BT-03 frozen parameters — excluded from sweep but retained in priors,
params dict and promoted_params so that the run.py contract is unchanged:
  • form_actual_beta       — BT-02 v1's simplified form signal does not
                             expose this knob; honest lab found the effect
                             minor relative to blend_alpha.
  • form_difficulty_gamma  — likewise unsupported by BT-02 v1.
  • sub_appear_window_gws  — BT-02 derives sub appearance from xmins_window;
                             the per-param sub-appear window is future work.

Public API:
    run_tuner(summaries, finished_gws, bootstrap, fixtures, cache_dir='') -> dict
        Returns a 'tuner' dict for merging into accuracy_backtest.json.
"""

import json
import os
from datetime import datetime, timezone

from accuracy import (
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
    ATF_SLOPE,               # ATF-01
    ATF_WINDOW_GWS,          # ATF-01
    FAS_SLOPE,               # FAS-01
    DEFCON_SCALE,            # DC-01
)

from backtest import run_backtest

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
ATF_SLOPE_CANDIDATES   = [0.0, 0.10, 0.20, 0.30, 0.40]  # ATF-01
ATF_WINDOW_CANDIDATES  = [3, 5, 6, 8, 10]                # ATF-01
FAS_SLOPE_CANDIDATES    = [0.0, 0.2, 0.4, 0.6]          # FAS-01
DEFCON_SCALE_CANDIDATES = [0.0, 0.25, 0.5, 0.75, 1.0]   # DC-01

# ── Safety thresholds ────────────────────────────────────────────────────────
MIN_FINISHED_GWS = 13             # need at least this many GWs for a meaningful split
RMSE_REGRESSION_THRESHOLD = 0.05  # max allowed fractional RMSE worsening (5%)
CAPTAIN_REGRESSION_PP = 0.02      # max allowed captain hit rate drop (2pp)

# Names of the three frozen parameters (not swept; kept at prior values).
_FROZEN_PARAMS = frozenset({'form_actual_beta', 'form_difficulty_gamma', 'sub_appear_window_gws'})

# ── Sweep order: 10 actively swept parameters (BT-03) ───────────────────────
# form_actual_beta, form_difficulty_gamma, sub_appear_window_gws are FROZEN
# (see module docstring). They remain in params/promoted_params at their prior
# values so the run.py read/write contract is unchanged.
_SWEEP_ORDER_NAMES = [
    'blend_alpha',
    'form_window_gws',
    'cs_prob_base',
    'cs_prob_slope',
    'cs_team_form_slope',
    'cs_def_form_window_gws',
    'atf_slope',
    'atf_window_gws',
    'fas_slope',
    'defcon_scale',
]


# ── Public helpers (used in tests) ───────────────────────────────────────────

def _map_tune_to_bt_params(tune_params: dict) -> dict:
    """Translate TUNE-01 parameter names to BT-02 parameter names.

    All names are identical except:
      fas_slope  →  fixture_attack_slope

    Returns a new dict suitable for passing to run_backtest(params=...).
    Only keys that BT-02 knows about are emitted; frozen TUNE-01-only keys
    (form_actual_beta, form_difficulty_gamma, sub_appear_window_gws) are
    silently dropped because BT-02 v1 does not support them.
    """
    bt_keys = {
        'blend_alpha', 'form_window_gws',
        'cs_prob_base', 'cs_prob_slope',
        'cs_team_form_slope', 'cs_def_form_window_gws',
        'atf_slope', 'atf_window_gws',
        'defcon_scale',
    }
    out = {k: v for k, v in tune_params.items() if k in bt_keys}
    # Name translation: fas_slope -> fixture_attack_slope
    if 'fas_slope' in tune_params:
        out['fixture_attack_slope'] = tune_params['fas_slope']
    return out


def _safe_haul_hit(metrics: dict) -> float:
    """Return haul_hit_rate from a metrics dict, treating None as 0.0.

    run_backtest returns None for haul_hit_rate when a GW range contains no
    haulers (rare in short train windows). Treat as 0.0 for scoring/gates.
    """
    v = metrics.get('haul_hit_rate')
    return 0.0 if v is None else float(v)


def _safe_captain(metrics: dict) -> float:
    """Return captain_hit_rate from a metrics dict, treating None as 0.0."""
    v = metrics.get('captain_hit_rate')
    return 0.0 if v is None else float(v)


def _safe_rmse(metrics: dict) -> float:
    """Return rmse from a metrics dict, treating None as 0.0."""
    v = metrics.get('rmse')
    return 0.0 if v is None else float(v)


def _metrics_from_backtest(bt_result: dict) -> dict:
    """Extract the three gate/scoring metrics from a run_backtest result dict.

    Normalises None values (no haulers, no GWs) to 0.0.
    """
    m = bt_result['metrics']
    return {
        'haul_hit_rate':    _safe_haul_hit(m),
        'rmse':             _safe_rmse(m),
        'captain_hit_rate': _safe_captain(m),
    }


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
            'atf_slope':      float(summary.get('atf_slope_used',      ATF_SLOPE)),      # ATF-01
            'atf_window_gws': int(summary.get('atf_window_gws_used',   ATF_WINDOW_GWS)), # ATF-01
            'fas_slope':      float(summary.get('fas_slope_used',      FAS_SLOPE)),      # FAS-01
            'defcon_scale':   float(summary.get('defcon_scale_used',   DEFCON_SCALE)),   # DC-01
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
            'atf_slope':      ATF_SLOPE,      # ATF-01
            'atf_window_gws': ATF_WINDOW_GWS, # ATF-01
            'fas_slope':      FAS_SLOPE,      # FAS-01
            'defcon_scale':   DEFCON_SCALE,   # DC-01
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

    haul_hit_rate may be None from run_backtest (no haulers in range); treat as 0.0.
    """
    cur_train_haul = _safe_haul_hit(current_train)
    cand_train_haul = _safe_haul_hit(candidate_train)
    cur_val_haul = _safe_haul_hit(current_val)
    cand_val_haul = _safe_haul_hit(candidate_val)
    cur_val_rmse = _safe_rmse(current_val)
    cand_val_rmse = _safe_rmse(candidate_val)
    cur_val_cap = _safe_captain(current_val)
    cand_val_cap = _safe_captain(candidate_val)

    # Gate 1: training improvement > 2pp
    if cand_train_haul - cur_train_haul <= GATE_MARGIN_PP:
        return False
    # Gate 2: validation haul hit rate must not regress
    if cand_val_haul < cur_val_haul:
        return False
    # Gate 3: validation RMSE must not worsen by >5%
    if cur_val_rmse > 0:
        rmse_change = (cand_val_rmse - cur_val_rmse) / cur_val_rmse
        if rmse_change > RMSE_REGRESSION_THRESHOLD:
            return False
    elif cand_val_rmse > 0:
        # Base RMSE is zero but candidate is non-zero — reject (cannot be better)
        return False
    # Gate 4: validation captain hit rate must not drop >2pp (epsilon for float safety)
    if cur_val_cap - cand_val_cap > CAPTAIN_REGRESSION_PP + 1e-9:
        return False
    return True


def _combined_score(current_metrics: dict, candidate_metrics: dict) -> float:
    """Normalised combined improvement score for tie-breaking multiple promoted candidates.

    All three terms are fractional improvements over current, keeping them on comparable scales.
    Score = Δhaul_hit_rate + (rmse_improvement_fraction) + Δcaptain_hit_rate

    haul_hit_rate / captain_hit_rate may be None; treated as 0.0.
    """
    cur_haul = _safe_haul_hit(current_metrics)
    cand_haul = _safe_haul_hit(candidate_metrics)
    cur_rmse = _safe_rmse(current_metrics)
    cand_rmse = _safe_rmse(candidate_metrics)
    cur_cap = _safe_captain(current_metrics)
    cand_cap = _safe_captain(candidate_metrics)

    delta_haul = cand_haul - cur_haul
    rmse_improvement = 0.0
    if cur_rmse > 0:
        rmse_improvement = (cur_rmse - cand_rmse) / cur_rmse
    delta_captain = cand_cap - cur_cap
    return delta_haul + rmse_improvement + delta_captain


def _sweep_param(
    param_name: str,
    candidates: list,
    current_val,
    params: dict,
    archive: dict,
    train_first: int,
    train_last: int,
    val_first: int,
    val_last: int,
) -> dict:
    """Sweep one parameter over all candidates using the honest BT-02 evaluator.

    Evaluates each candidate via run_backtest(archive, mapped_params, mode='deploy')
    on the training range. Gates on train AND val metrics via _promotion_gates.
    Selects best promoted candidate by _combined_score on val metrics.

    Args:
        param_name:   key in TUNE-01 params being swept (e.g. 'blend_alpha').
        candidates:   list of candidate values to evaluate.
        current_val:  current production value (read from prior backtest).
        params:       current locked-in TUNE-01 values for all parameters.
        archive:      archive-shaped dict passed to run_backtest.
        train_first:  first GW of the training range.
        train_last:   last GW of the training range.
        val_first:    first GW of the validation range.
        val_last:     last GW of the validation range.

    Returns:
        dict with keys: current, best, promoted, and (when promoted=True) per-metric
        train/validate values.
    """
    # Invariant: current_val must match what params currently holds for this param.
    assert params.get(param_name) == current_val, (
        f"_sweep_param invariant: params['{param_name}']={params.get(param_name)} "
        f"!= current_val={current_val}"
    )

    # Baseline: current production metrics using current params
    bt_base = _map_tune_to_bt_params(params)
    base_train = _metrics_from_backtest(
        run_backtest(archive=archive, params=bt_base, mode='deploy',
                     first_gw=train_first, last_gw=train_last)
    )
    base_val = _metrics_from_backtest(
        run_backtest(archive=archive, params=bt_base, mode='deploy',
                     first_gw=val_first, last_gw=val_last)
    )

    best_val = current_val
    best_combined: float | None = None
    best_train = base_train
    best_validate = base_val
    promoted = False

    for candidate in candidates:
        if candidate == current_val:
            continue
        candidate_params = {**params, param_name: candidate}
        bt_cand = _map_tune_to_bt_params(candidate_params)
        train_metrics = _metrics_from_backtest(
            run_backtest(archive=archive, params=bt_cand, mode='deploy',
                         first_gw=train_first, last_gw=train_last)
        )
        validate_metrics = _metrics_from_backtest(
            run_backtest(archive=archive, params=bt_cand, mode='deploy',
                         first_gw=val_first, last_gw=val_last)
        )

        if not _promotion_gates(base_train, train_metrics, base_val, validate_metrics):
            continue

        combined = _combined_score(base_val, validate_metrics)
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
    """Run coordinate descent parameter tuner over all tunable parameters.

    Skips when finished_gws < MIN_FINISHED_GWS (not enough data for a hold-out split).
    Non-fatal: all exceptions should be caught by the caller (run.py).

    Builds an archive-shaped dict from live data and evaluates every candidate via
    run_backtest(archive, params, mode='deploy') on the training range (BT-03).
    Three parameters are frozen at their prior values and not swept (see module
    docstring); they are still written to promoted_params so run.py contract is intact.

    Returns a dict suitable for merging into accuracy_backtest.json under the 'tuner' key.
    Includes a 'promoted_params' sub-dict with the final locked-in values for all
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

    # Burn-in floor: BT-02's min_prior_minutes handles player-level cold start;
    # the floor here avoids degenerate GW1-4 team-form normalisation.
    train_first = max(gws_train[0], 5)
    train_last  = gws_train[-1]
    val_first   = gws_validate[0]
    val_last    = gws_validate[-1]

    # Build archive-shaped dict from live data — run_backtest consumes this exact shape.
    archive = {
        'bootstrap': bootstrap,
        'fixtures':  fixtures,
        'understat': {},
        'summaries': summaries,
        'manifest':  {'season': 'live'},
    }

    # Active params: updated after each sweep locks in the best value.
    # Frozen params start at prior and remain unchanged throughout.
    params = {
        'blend_alpha':      prior['blend_alpha'],
        'form_window_gws':  prior['form_window_gws'],
        'cs_prob_base':     prior['cs_prob_base'],
        'cs_prob_slope':    prior['cs_prob_slope'],
        'form_actual_beta': prior['form_actual_beta'],          # frozen
        'form_difficulty_gamma': prior['form_difficulty_gamma'],  # frozen
        'sub_appear_window_gws': prior['sub_appear_window_gws'],  # frozen
        'cs_team_form_slope':     prior['cs_team_form_slope'],
        'cs_def_form_window_gws': prior['cs_def_form_window_gws'],
        'atf_slope':      prior['atf_slope'],
        'atf_window_gws': prior['atf_window_gws'],
        'fas_slope':      prior['fas_slope'],
        'defcon_scale':   prior['defcon_scale'],
    }

    sweep_results: dict = {}

    # Candidate grids for the 10 actively swept parameters
    _candidates = {
        'blend_alpha':           BLEND_ALPHA_CANDIDATES,
        'form_window_gws':       FORM_WINDOW_CANDIDATES,
        'cs_prob_base':          CS_PROB_BASE_CANDIDATES,
        'cs_prob_slope':         CS_PROB_SLOPE_CANDIDATES,
        'cs_team_form_slope':    CS_TEAM_FORM_SLOPE_CANDIDATES,
        'cs_def_form_window_gws': CS_DEF_FORM_WINDOW_CANDIDATES,
        'atf_slope':             ATF_SLOPE_CANDIDATES,
        'atf_window_gws':        ATF_WINDOW_CANDIDATES,
        'fas_slope':             FAS_SLOPE_CANDIDATES,
        'defcon_scale':          DEFCON_SCALE_CANDIDATES,
    }

    # Coordinate descent: sweep each active parameter in order
    for param_name in _SWEEP_ORDER_NAMES:
        candidates = _candidates[param_name]
        current_val = params[param_name]
        result = _sweep_param(
            param_name=param_name,
            candidates=candidates,
            current_val=current_val,
            params=params,
            archive=archive,
            train_first=train_first,
            train_last=train_last,
            val_first=val_first,
            val_last=val_last,
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
