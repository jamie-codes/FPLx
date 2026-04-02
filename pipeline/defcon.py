"""Compute DefCon stats from FPL element-summary per-match history."""

DEFCON_THRESHOLD = {2: 10, 3: 12, 4: 12}  # position_code -> threshold


def compute_defcon_stats(bootstrap: dict, difficulty_scores: dict, summaries: dict) -> list:
    """
    For each DEF/MID/FWD player with starts > 0, look up element-summary from
    the pre-fetched summaries dict and compute hit rate, avg per90, distance to
    threshold, and fixture correlation.

    Args:
        bootstrap: Full FPL bootstrap-static JSON
        difficulty_scores: dict mapping team_id (int) -> difficulty score (0.0-1.0),
                          computed by merge.py from rolling xGA
        summaries: dict mapping player_id (int) -> element-summary response dict.
                   Pre-fetched by run.py shared cache.
    Returns:
        List of dicts matching DefConPlayer interface shape
    """
    teams = {t['id']: t for t in bootstrap.get('teams', [])}
    results = []

    for element in bootstrap['elements']:
        pos = element['element_type']
        if pos not in (2, 3, 4):
            continue
        if element.get('starts', 0) == 0:
            continue

        threshold = DEFCON_THRESHOLD[pos]

        summary = summaries.get(element['id'])
        if summary is None:
            continue

        history = [m for m in summary.get('history', []) if m['minutes'] > 0]
        games_played = len(history)
        if games_played < 5:
            continue

        hits = sum(1 for m in history if m.get('defensive_contribution', 0) >= threshold)
        hit_rate = round(hits / games_played, 4)

        avg_per90 = element.get('defensive_contribution_per_90') or 0.0
        distance = round(threshold - avg_per90, 2)

        # DEF-03: fixture difficulty correlation
        fixture_correlation = _compute_fixture_correlation(history, difficulty_scores, threshold)

        team_id = element['team']
        results.append({
            'id': element['id'],
            'web_name': element['web_name'],
            'element_type': pos,
            'team': team_id,
            'team_short_name': teams.get(team_id, {}).get('short_name', ''),
            'threshold': threshold,
            'hit_rate': hit_rate,
            'hits': hits,
            'games_played': games_played,
            'avg_per90': round(float(avg_per90), 2),
            'distance_to_threshold': distance,
            'fixture_correlation': fixture_correlation,
        })

    return results


def _compute_fixture_correlation(history: list, difficulty_scores: dict, threshold: int) -> dict:
    """Split games into easy vs hard fixtures and compare hit rates.

    Easy = opponent difficulty_score < 0.4 (opponent concedes many goals)
    Hard = opponent difficulty_score > 0.6 (opponent concedes few goals)
    Returns insufficient_data: true when either bucket has < 5 games.
    """
    easy_games = [m for m in history if difficulty_scores.get(m.get('opponent_team'), 0.5) < 0.4]
    hard_games = [m for m in history if difficulty_scores.get(m.get('opponent_team'), 0.5) > 0.6]

    if len(easy_games) < 5 or len(hard_games) < 5:
        return {
            'insufficient_data': True,
            'easy_n': len(easy_games),
            'hard_n': len(hard_games),
        }

    easy_hits = sum(1 for m in easy_games if m.get('defensive_contribution', 0) >= threshold)
    hard_hits = sum(1 for m in hard_games if m.get('defensive_contribution', 0) >= threshold)

    return {
        'insufficient_data': False,
        'easy_hit_rate': round(easy_hits / len(easy_games), 4),
        'hard_hit_rate': round(hard_hits / len(hard_games), 4),
        'easy_n': len(easy_games),
        'hard_n': len(hard_games),
    }
