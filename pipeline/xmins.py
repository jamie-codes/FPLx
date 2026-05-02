"""Compute expected minutes, start probability, and rotation risk classification."""

import statistics

# Phase 52 D-06: position-prior fallback for new signings / post-injury return
POSITION_PRIOR = {1: 0.90, 2: 0.75, 3: 0.65, 4: 0.60}


def compute_xmins_stats(bootstrap: dict, summaries: dict, finished_gws: int) -> dict:
    """
    Compute xmins, start_prob, mins_risk for every player.

    Args:
        bootstrap: FPL bootstrap-static JSON (elements list).
        summaries: dict mapping player_id (int) -> element-summary dict.
                   Pre-fetched by run.py shared cache.
        finished_gws: Number of completed gameweeks (for season start_rate fallback).

    Returns:
        dict mapping player_id (int) -> {xmins: float, start_prob: float, mins_risk: str}
        Every player in bootstrap['elements'] gets an entry (including GKs and 0-start players).
    """
    results = {}

    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_xmins(element, summaries.get(player_id), finished_gws)

    return results


def _compute_player_xmins(element: dict, summary: dict | None, finished_gws: int) -> dict:
    """Compute xmins stats for a single player."""
    starts = element.get('starts', 0)
    minutes = element.get('minutes', 0)
    chance = element.get('chance_of_playing_next_round')
    availability = (chance / 100.0) if chance is not None else 1.0

    # Per-match data from element-summary (preferred when available)
    if summary and starts > 0:
        history = summary.get('history', [])
        recent = history[-10:]  # last 10 GW entries
        starts_in_recent = [m for m in recent if m.get('starts') == 1]

        # D-05.1: < 3 starts in recent window -> position-prior fallback (D-06)
        element_type = element.get('element_type', 3)
        # avg_mins_started must be computed independently (Pitfall 2 — needed for xmins and sub_risk_label cameo)
        if starts_in_recent:
            avg_mins_started = statistics.mean(m['minutes'] for m in starts_in_recent)
        else:
            avg_mins_started = 0.0

        if len(starts_in_recent) < 3:
            start_prob = round(POSITION_PRIOR.get(element_type, 0.65) * availability, 4)
        else:
            recent_start_rate = len(starts_in_recent) / max(len(recent), 1)
            start_prob = round(recent_start_rate * availability, 4)

        # D-05.4 + D-03: mins_60_prob on same recent[-10:] window, conditioned on starts
        if starts_in_recent:
            mins_60_count = sum(1 for m in starts_in_recent if m.get('minutes', 0) >= 60)
            mins_60_prob = round(mins_60_count / len(starts_in_recent), 4)
        else:
            mins_60_prob = 0.0
    else:
        # Bootstrap-only fallback: no element-summary history available
        element_type = element.get('element_type', 3)
        avg_mins_started = minutes / starts if starts > 0 else 0.0
        # D-05.1 applies in bootstrap too: zero or sub-3 starts -> position prior
        if starts < 3:
            start_prob = round(POSITION_PRIOR.get(element_type, 0.65) * availability, 4)
        else:
            recent_start_rate = starts / finished_gws if finished_gws > 0 else 0.0
            start_prob = round(recent_start_rate * availability, 4)
        mins_60_prob = 0.0  # no per-match data to compute from

    xmins = round(avg_mins_started * start_prob, 1)

    # mins_risk classification (locked decision: status='a' + blank news gates rotation classification)
    status = element.get('status', 'a')
    news = element.get('news', '')
    if status != 'a' or news:
        mins_risk = 'injured'
    elif start_prob >= 0.85:
        mins_risk = 'nailed'
    elif start_prob >= 0.65:
        mins_risk = 'likely_start'
    elif avg_mins_started < 30 or start_prob < 0.25:
        mins_risk = 'cameo'
    else:
        mins_risk = 'rotation_risk'

    # D-08: sub_risk_label — probability-derived, additive (mins_risk preserved unchanged)
    if status != 'a' or news:
        sub_risk_label = 'injured'
    elif start_prob >= 0.90 and mins_60_prob >= 0.80:
        sub_risk_label = 'nailed'
    elif start_prob >= 0.65:
        sub_risk_label = 'sub_risk'
    elif avg_mins_started < 40 or start_prob < 0.25:
        sub_risk_label = 'cameo'
    else:
        sub_risk_label = 'rotation_risk'

    return {
        'xmins': xmins,
        'start_prob': start_prob,
        'mins_risk': mins_risk,
        'mins_60_prob': mins_60_prob,
        'sub_risk_label': sub_risk_label,
    }
