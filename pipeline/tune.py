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


# ── Public helpers (used in tests) ───────────────────────────────────────────

def _read_prior_params(cache_dir: str) -> dict:
    """Read current production parameter values from accuracy_backtest.json summary.

    Falls back to defaults when the file is missing or malformed (cold start).
    Returns dict with keys: blend_alpha, form_window_gws, cs_prob_base, cs_prob_slope.
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
            'blend_alpha':     float(summary.get('blend_alpha_used', BLEND_ALPHA)),
            'form_window_gws': int(summary.get('form_window_gws_used', FORM_WINDOW_GWS)),
            'cs_prob_base':    float(summary.get('cs_prob_base_used', CS_PROB_BASE)),
            'cs_prob_slope':   float(summary.get('cs_prob_slope_used', CS_PROB_SLOPE)),
        }
    except (FileNotFoundError, json.JSONDecodeError, OSError, KeyError, ValueError):
        return {
            'blend_alpha': BLEND_ALPHA,
            'form_window_gws': FORM_WINDOW_GWS,
            'cs_prob_base': CS_PROB_BASE,
            'cs_prob_slope': CS_PROB_SLOPE,
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


def run_tuner(summaries, finished_gws, bootstrap, fixtures, cache_dir=''):
    """Stub — full implementation added in Task 5."""
    if finished_gws < MIN_FINISHED_GWS:
        return {'skipped': True, 'reason': f'finished_gws={finished_gws} < {MIN_FINISHED_GWS}'}
    return {}  # stub — Task 5 replaces this
