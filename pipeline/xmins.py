"""Compute expected minutes, start probability, and rotation risk classification."""

import statistics


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
        history = [m for m in summary.get('history', []) if m.get('minutes', 0) > 0]
        recent = history[-10:]  # last 10 appearances with minutes
        # Use 'starts' field if available, fall back to minutes > 60 threshold
        starts_in_recent = [m for m in recent if m.get('starts', 0) == 1 or (m.get('starts') is None and m.get('minutes', 0) > 60)]
        if starts_in_recent:
            avg_mins_started = statistics.mean(m['minutes'] for m in starts_in_recent)
            recent_start_rate = len(starts_in_recent) / max(len(recent), 1)
        else:
            avg_mins_started = 0.0
            recent_start_rate = 0.0
    else:
        # Bootstrap-only fallback (no element-summary or 0 starts)
        avg_mins_started = minutes / starts if starts > 0 else 0.0
        recent_start_rate = starts / finished_gws if finished_gws > 0 else 0.0

    start_prob = round(recent_start_rate * availability, 4)
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
    elif avg_mins_started < 30 or recent_start_rate < 0.25:
        mins_risk = 'cameo'
    else:
        mins_risk = 'rotation_risk'

    return {'xmins': xmins, 'start_prob': start_prob, 'mins_risk': mins_risk}
