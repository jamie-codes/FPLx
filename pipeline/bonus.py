"""Compute per-player bonus EV from rolling BPS history (Phase 53 BPS-01).

Mirrors pipeline/xmins.py shape: pre-merge module that reads the shared
element-summary cache and returns a dict keyed by FPL player_id. Output is
consumed by pipeline/merge.py via the bonus_predictor_enabled gate (Plan 02).

Algorithm:
  - Recent[-10:] window over history[i] entries with starts == 1
  - n_starts < 4 -> flat position prior (POSITION_PRIOR[element_type])
  - n_starts >= 4 -> shrinkage: w * empirical_mean + (1-w) * prior, w = min(1, n/12)
  - GK/DEF (element_type in {1, 2}) -> residualise against historical CS rate to
    mitigate BPS-CS double-counting (Pitfall M3): bonus_ev = max(0, raw - 0.5 * cs_rate)
  - MID/FWD (element_type in {3, 4}) -> plain shrinkage (no residualisation)
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
        source: 'learned' | 'flat_default'}. Every player in bootstrap['elements']
        gets an entry.
    """
    results = {}
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_bonus_ev(element, summaries.get(player_id))
    return results


def _compute_player_bonus_ev(element: dict, summary: dict | None) -> dict:
    """Compute bonus EV for a single player using shrinkage estimator.

    Returns {bonus_ev, n_starts, source}. source is 'flat_default' for guard
    fallbacks (no summary OR n_starts < gate) and 'learned' for shrunk EVs.
    """
    element_type = element.get('element_type', 3)
    prior = POSITION_PRIOR[element_type]

    # Guard 1: no element-summary at all (e.g. promoted-team player, 0 starts)
    if not summary:
        return {'bonus_ev': prior, 'n_starts': 0, 'source': 'flat_default'}

    history = summary.get('history', [])
    recent = history[-RECENT_WINDOW:]
    starts_in_recent = [m for m in recent if m.get('starts') == 1]
    n_starts = len(starts_in_recent)

    # Guard 2: insufficient sample -> flat fallback
    if n_starts < MIN_STARTS_GATE:
        return {'bonus_ev': prior, 'n_starts': n_starts, 'source': 'flat_default'}

    # Shrinkage estimator
    empirical_mean = statistics.mean(m.get('bonus', 0) for m in starts_in_recent)
    w = min(1.0, n_starts / SHRINKAGE_K)
    bonus_ev_raw = w * empirical_mean + (1.0 - w) * prior

    # BPS-CS double-counting mitigation for GK/DEF only (Pitfall M3).
    # For attackers, raw bonus is mostly attacking-action driven (key passes,
    # shots, goals/assists) — no double-counting risk vs cs_pts component.
    if element_type in (1, 2):
        cs_count = sum(1 for m in starts_in_recent if m.get('clean_sheets', 0) == 1)
        cs_rate = cs_count / n_starts
        bonus_ev = max(0.0, bonus_ev_raw - BONUS_CS_RESIDUAL_FACTOR * cs_rate)
    else:
        bonus_ev = bonus_ev_raw

    return {
        'bonus_ev': round(bonus_ev, 4),
        'n_starts': n_starts,
        'source': 'learned',
    }
