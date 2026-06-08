"""Compute per-player bonus EV from BPS-calibrated history (BPS-02).

Mirrors pipeline/xmins.py shape: pre-merge module that reads the shared
element-summary cache and returns a dict keyed by FPL player_id. Output is
consumed by pipeline/merge.py via the bonus_predictor_enabled gate.

Algorithm (two-pass BPS-02):
  Pass 1 — build_bps_calibration(): fit a global OLS curve (avg_bps → avg_bonus)
    from all players with ≥ MIN_STARTS_GATE starts. Returns None early in the
    season when fewer than 20 players qualify.
  Pass 2 — _compute_player_bonus_ev(): shrink per-player avg_bps toward
    BPS_POSITION_PRIOR, then project through the calibration curve. Falls back to a
    position-prior ratio when calibration is None.
  GK/DEF (element_type in {1, 2}): residualise against historical CS rate to
    mitigate BPS-CS double-counting (Pitfall M3): bonus_ev = max(0, raw - 0.5 * cs_rate)
  MID/FWD (element_type in {3, 4}): bonus_ev = max(0, raw) (no residualisation)
"""

import statistics

# Position-prior fallback — matches merge.BONUS_RATE exactly (used as Bayesian prior)
POSITION_PRIOR = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}

# Shrinkage parameters
RECENT_WINDOW = 10        # mirror xmins.py recent[-10:] window
MIN_STARTS_GATE = 4       # below this -> position-prior only
SHRINKAGE_K = 12          # smoothing constant; w = min(1.0, n_starts / SHRINKAGE_K)

# BPS-CS double-counting mitigation (Pitfall M3) — applied to GK and DEF only
BONUS_CS_RESIDUAL_FACTOR = 0.5

# BPS-02: position-prior average BPS per start (empirical, used for BPS shrinkage).
BPS_POSITION_PRIOR = {1: 18, 2: 20, 3: 22, 4: 24}


def build_bps_calibration(summaries: dict, bootstrap: dict) -> tuple[float, float] | None:
    """Fit a global BPS→bonus OLS calibration curve from all qualifying players.

    Collects one (avg_bps, avg_bonus) data point per player with ≥ MIN_STARTS_GATE
    starts across their full history. Uses ALL history entries (not the recent window)
    to maximise calibration data.

    Args:
        summaries: dict mapping player_id (int) → element-summary dict.
        bootstrap: FPL bootstrap-static JSON (elements list).

    Returns:
        (slope, intercept) tuple such that bonus_ev ≈ slope * bps + intercept,
        or None when fewer than 20 players qualify (early season / sparse data).
    """
    data_points: list[tuple[float, float]] = []
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        summary = summaries.get(player_id)
        if not summary:
            continue
        history = summary.get('history', [])
        starts = [m for m in history if m.get('starts') == 1]
        if len(starts) < MIN_STARTS_GATE:
            continue
        avg_bps = statistics.mean(m.get('bps', 0) for m in starts)
        avg_bonus = statistics.mean(m.get('bonus', 0) for m in starts)
        data_points.append((avg_bps, avg_bonus))

    if len(data_points) < 20:
        return None

    bps_vals = [p[0] for p in data_points]
    bonus_vals = [p[1] for p in data_points]
    bps_mean = statistics.mean(bps_vals)
    bonus_mean = statistics.mean(bonus_vals)

    numerator = sum(
        (b - bps_mean) * (bn - bonus_mean) for b, bn in zip(bps_vals, bonus_vals)
    )
    denominator = sum((b - bps_mean) ** 2 for b in bps_vals)

    if denominator == 0:
        return None

    slope = numerator / denominator
    intercept = bonus_mean - slope * bps_mean
    return (slope, intercept)


def compute_bonus_predictions(bootstrap: dict, summaries: dict, finished_gws: int) -> dict:
    """Compute per-player bonus EV from rolling BPS history.

    Args:
        bootstrap: FPL bootstrap-static JSON (elements list).
        summaries: dict mapping player_id (int) -> element-summary dict.
                   Pre-fetched by run.py shared cache. Players absent from this dict
                   (e.g. 0-starts promoted-team players) receive the flat position prior.
        finished_gws: Number of completed gameweeks. Accepted for signature parity
                      with compute_xmins_stats but currently unused — bonus EV is
                      derived from the recent window of element-summary history alone.

    Returns:
        dict mapping player_id (int) -> {bonus_ev: float (4dp), n_starts: int,
        source: 'learned_calibrated' | 'learned_uncalibrated' | 'prior'}. Every player in bootstrap['elements']
        gets an entry.
    """
    results = {}
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_bonus_ev(element, summaries.get(player_id))
    return results


def _compute_player_bonus_ev(
    element: dict,
    summary: dict | None,
    calibration: tuple[float, float] | None = None,
) -> dict:
    """Compute bonus EV for a single player using BPS-calibrated shrinkage.

    Two-pass algorithm (BPS-02):
      1. Shrink per-player avg BPS toward BPS_POSITION_PRIOR.
      2. Project smoothed BPS through the calibration curve (or ratio fallback).

    Args:
        element:     FPL element dict (needs 'element_type').
        summary:     element-summary dict with 'history' list; None for no-data players.
        calibration: (slope, intercept) tuple from build_bps_calibration(), or None when
                     fewer than 20 qualifying players exist (early season).

    Returns:
        dict with keys: bonus_ev (float, 4dp), avg_bps (float|None), n_starts (int),
        source ('learned_calibrated' | 'learned_uncalibrated' | 'prior').
    """
    element_type = element.get('element_type', 3)
    prior = POSITION_PRIOR[element_type]
    bps_prior = BPS_POSITION_PRIOR[element_type]

    # Guard 1: no element-summary at all (e.g. promoted-team player, 0 starts)
    if not summary:
        return {'bonus_ev': prior, 'avg_bps': None, 'n_starts': 0, 'source': 'prior'}

    history = summary.get('history', [])
    recent = history[-RECENT_WINDOW:]
    starts_in_recent = [m for m in recent if m.get('starts') == 1]
    n_starts = len(starts_in_recent)

    # Guard 2: insufficient sample → flat fallback
    if n_starts < MIN_STARTS_GATE:
        return {'bonus_ev': prior, 'avg_bps': None, 'n_starts': n_starts, 'source': 'prior'}

    # BPS-based shrinkage estimator
    avg_bps = statistics.mean(m.get('bps', 0) for m in starts_in_recent)
    w = min(1.0, n_starts / SHRINKAGE_K)
    smoothed_bps = w * avg_bps + (1.0 - w) * bps_prior

    # Calibration curve or uncalibrated ratio fallback
    if calibration is not None:
        slope, intercept = calibration
        bonus_ev_raw = slope * smoothed_bps + intercept
        source = 'learned_calibrated'
    else:
        bonus_ev_raw = smoothed_bps * (prior / bps_prior)
        source = 'learned_uncalibrated'

    # BPS-CS double-counting mitigation for GK/DEF only (Pitfall M3).
    if element_type in (1, 2):
        cs_count = sum(1 for m in starts_in_recent if m.get('clean_sheets', 0) == 1)
        cs_rate = cs_count / n_starts
        bonus_ev = max(0.0, bonus_ev_raw - BONUS_CS_RESIDUAL_FACTOR * cs_rate)
    else:
        bonus_ev = max(0.0, bonus_ev_raw)

    return {
        'bonus_ev': round(bonus_ev, 4),
        'avg_bps': round(avg_bps, 2),
        'n_starts': n_starts,
        'source': source,
    }
