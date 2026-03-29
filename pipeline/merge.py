"""Merge FPL bootstrap data with Understat xG/xA, compute per-90 metrics,
custom FDR from rolling goals conceded, and next 5 fixture difficulty scores."""

from typing import Optional


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _compute_difficulty_score(team_xga: float, min_xga: float, max_xga: float) -> float:
    """Normalise team xGA to 0.0–1.0 difficulty score.

    0.0 = easiest fixture (opponent concedes most goals — highest xGA).
    1.0 = hardest fixture (opponent concedes fewest goals — lowest xGA).
    """
    if max_xga == min_xga:
        return 0.5
    return 1.0 - (team_xga - min_xga) / (max_xga - min_xga)


def _difficulty_tier(score: float, easy_threshold: float, hard_threshold: float) -> str:
    """Map normalised difficulty score to a tier string.

    easy_threshold: score below this is 'easy' (low xGA opponent = easy to attack)
    hard_threshold: score above this is 'hard' (high xGA opponent = hard to attack)
    """
    if score <= easy_threshold:
        return 'easy'
    elif score >= hard_threshold:
        return 'hard'
    else:
        return 'medium'


def _compute_difficulty_scores(bootstrap: dict, fixtures: list) -> dict[int, float]:
    """Compute team difficulty scores from rolling xGA. Exported for defcon.py.

    Args:
        bootstrap: FPL bootstrap-static JSON (used for teams dict).
        fixtures:  FPL fixtures list (used for rolling goals-conceded xGA proxy).

    Returns:
        Dict mapping team_id (int) -> difficulty score (0.0-1.0).
        0.0 = easiest fixture (opponent concedes most), 1.0 = hardest.
    """
    teams = {t['id']: t for t in bootstrap.get('teams', [])}

    ROLLING_WINDOW = 6

    finished = sorted(
        [f for f in fixtures if f.get('finished') and f.get('event') is not None],
        key=lambda f: f['event'],
    )

    team_goals_conceded: dict[int, list[int]] = {t_id: [] for t_id in teams}

    for fix in finished:
        h_id = fix['team_h']
        a_id = fix['team_a']
        h_score = fix.get('team_h_score') or 0
        a_score = fix.get('team_a_score') or 0

        if h_id in team_goals_conceded:
            team_goals_conceded[h_id].append(a_score)
        if a_id in team_goals_conceded:
            team_goals_conceded[a_id].append(h_score)

    team_xga: dict[int, float] = {}
    for t_id, conceded_list in team_goals_conceded.items():
        last_n = conceded_list[-ROLLING_WINDOW:]
        team_xga[t_id] = sum(last_n) / len(last_n) if last_n else 0.0

    xga_values = sorted(team_xga.values())
    min_xga = min(xga_values) if xga_values else 0.0
    max_xga = max(xga_values) if xga_values else 1.0

    difficulty_scores: dict[int, float] = {}
    for t_id in teams:
        xga = team_xga.get(t_id, 0.0)
        difficulty_scores[t_id] = _compute_difficulty_score(xga, min_xga, max_xga)

    return difficulty_scores


def merge_players(
    bootstrap: dict,
    fixtures: list,
    understat: dict,
    id_map: dict,
) -> list:
    """Merge FPL bootstrap + Understat xG/xA into a unified player list.

    Args:
        bootstrap: FPL bootstrap-static JSON (elements, teams, events).
        fixtures:  FPL fixtures list.
        understat: Dict keyed by Understat player ID (string) with xG/xA/minutes.
        id_map:    player_id_map.json — keyed by FPL id string, value has understat_id.

    Returns:
        List of merged player dicts with all D-01 through D-06 fields.
    """
    # ------------------------------------------------------------------ #
    # 1. Build team lookup
    # ------------------------------------------------------------------ #
    teams = {t['id']: t for t in bootstrap['teams']}
    events = bootstrap.get('events', [])

    # ------------------------------------------------------------------ #
    # 2. Determine current GW
    # ------------------------------------------------------------------ #
    current_gw: Optional[int] = None
    for event in events:
        if event.get('is_current'):
            current_gw = event['id']
            break
    if current_gw is None:
        # Fall back to last finished event
        finished_events = [e for e in events if e.get('finished')]
        if finished_events:
            current_gw = finished_events[-1]['id']
        else:
            current_gw = 1

    # ------------------------------------------------------------------ #
    # 3. Compute rolling xGA per team (D-02)
    #    FPL fixtures lack true xGA; use goals conceded (6-game rolling avg)
    # ------------------------------------------------------------------ #
    ROLLING_WINDOW = 6

    # Collect finished fixtures sorted by event (GW)
    finished = sorted(
        [f for f in fixtures if f.get('finished') and f.get('event') is not None],
        key=lambda f: f['event'],
    )

    # Per team: list of goals conceded in chronological order
    team_goals_conceded: dict[int, list[int]] = {t_id: [] for t_id in teams}

    for fix in finished:
        h_id = fix['team_h']
        a_id = fix['team_a']
        h_score = fix.get('team_h_score') or 0
        a_score = fix.get('team_a_score') or 0

        if h_id in team_goals_conceded:
            team_goals_conceded[h_id].append(a_score)  # home team conceded away goals
        if a_id in team_goals_conceded:
            team_goals_conceded[a_id].append(h_score)  # away team conceded home goals

    # Rolling 6-game average goals conceded — this is our "xGA proxy"
    team_xga: dict[int, float] = {}
    for t_id, conceded_list in team_goals_conceded.items():
        last_n = conceded_list[-ROLLING_WINDOW:]
        team_xga[t_id] = sum(last_n) / len(last_n) if last_n else 0.0

    # ------------------------------------------------------------------ #
    # 4. Compute difficulty tiers (D-05) via percentile thresholds
    # ------------------------------------------------------------------ #
    xga_values = sorted(team_xga.values())
    n = len(xga_values)

    if n >= 3:
        # Bottom third: lowest xGA = hardest to score against (score near 1.0)
        # Top third:    highest xGA = easiest to score against (score near 0.0)
        easy_idx = int(n * 2 / 3)   # top third starts here (high xGA = easy)
        hard_idx = int(n * 1 / 3)   # bottom third ends here (low xGA = hard)

        easy_xga_threshold = xga_values[easy_idx]   # xGA above this = easy fixture
        hard_xga_threshold = xga_values[hard_idx]   # xGA below this = hard fixture
    else:
        easy_xga_threshold = max(xga_values) if xga_values else 1.0
        hard_xga_threshold = min(xga_values) if xga_values else 0.0

    min_xga = min(xga_values) if xga_values else 0.0
    max_xga = max(xga_values) if xga_values else 1.0

    # Precompute per-team difficulty score and tier
    difficulty_scores: dict[int, float] = {}
    difficulty_tiers: dict[int, str] = {}
    for t_id in teams:
        xga = team_xga.get(t_id, 0.0)
        score = _compute_difficulty_score(xga, min_xga, max_xga)
        difficulty_scores[t_id] = score

        # Convert xGA thresholds to score thresholds for tier classification:
        # high xGA (easy fixture) → low score → 'easy'
        easy_score = _compute_difficulty_score(easy_xga_threshold, min_xga, max_xga)
        hard_score = _compute_difficulty_score(hard_xga_threshold, min_xga, max_xga)
        difficulty_tiers[t_id] = _difficulty_tier(score, easy_score, hard_score)

    # ------------------------------------------------------------------ #
    # 5. Build upcoming fixtures per team (D-03, D-04)
    # ------------------------------------------------------------------ #
    FIXTURE_LOOKAHEAD = 5

    upcoming = sorted(
        [f for f in fixtures if not f.get('finished') and f.get('event') is not None],
        key=lambda f: f['event'],
    )

    # Per team: next 5 upcoming fixture dicts
    team_fixtures: dict[int, list[dict]] = {t_id: [] for t_id in teams}

    for fix in upcoming:
        h_id = fix['team_h']
        a_id = fix['team_a']
        event_id = fix['event']

        # Home team perspective
        if h_id in team_fixtures and len(team_fixtures[h_id]) < FIXTURE_LOOKAHEAD:
            opp_id = a_id
            team_fixtures[h_id].append({
                'opponent_team': teams[opp_id]['short_name'] if opp_id in teams else str(opp_id),
                'is_home': True,
                'event_id': event_id,
                'difficulty_score': difficulty_scores.get(opp_id, 0.5),
                'difficulty_tier': difficulty_tiers.get(opp_id, 'medium'),
            })

        # Away team perspective
        if a_id in team_fixtures and len(team_fixtures[a_id]) < FIXTURE_LOOKAHEAD:
            opp_id = h_id
            team_fixtures[a_id].append({
                'opponent_team': teams[opp_id]['short_name'] if opp_id in teams else str(opp_id),
                'is_home': False,
                'event_id': event_id,
                'difficulty_score': difficulty_scores.get(opp_id, 0.5),
                'difficulty_tier': difficulty_tiers.get(opp_id, 'medium'),
            })

    # ------------------------------------------------------------------ #
    # 6. Build reverse lookup: understat_id (int) → Understat row
    # ------------------------------------------------------------------ #
    # understat dict is keyed by string player ID from soccerdata
    # id_map values have understat_id (int or null)

    # Build lookup: understat_id (as string) → stats dict
    understat_by_id: dict[str, dict] = {str(k): v for k, v in understat.items()}

    # ------------------------------------------------------------------ #
    # 7. Merge into output list (D-06)
    # ------------------------------------------------------------------ #
    result = []

    for element in bootstrap.get('elements', []):
        fpl_id = element['id']
        id_entry = id_map.get(str(fpl_id))

        understat_id_val = None
        xg_per90 = None
        xa_per90 = None

        if id_entry:
            raw_us_id = id_entry.get('understat_id')
            if raw_us_id is not None:
                understat_id_val = raw_us_id
                us_stats = understat_by_id.get(str(raw_us_id))
                if us_stats:
                    us_minutes = us_stats.get('minutes', 0)
                    if us_minutes and us_minutes > 0:
                        xg_val = us_stats.get('xG', 0.0)
                        xa_val = us_stats.get('xA', 0.0)
                        xg_per90 = round((xg_val / us_minutes) * 90, 4)
                        xa_per90 = round((xa_val / us_minutes) * 90, 4)
                    # If minutes == 0, leave xg_per90/xa_per90 as None (no data to derive per-90)

        # Per-90 form metrics (D-01)
        minutes = element.get('minutes', 0)
        starts = element.get('starts', 0)
        minutes_per90 = round(minutes / starts, 1) if starts and starts > 0 else 0.0
        form_pts_per90 = _safe_float(element.get('form', '0'), 0.0)

        team_id = element['team']

        player = {
            # Core FPL identity
            'id': fpl_id,
            'web_name': element['web_name'],
            'team': team_id,
            'team_short_name': teams[team_id]['short_name'] if team_id in teams else '',
            'element_type': element['element_type'],
            'now_cost': element['now_cost'],
            'selected_by_percent': element['selected_by_percent'],
            'form': element['form'],
            'status': element['status'],
            'minutes': minutes,
            'starts': starts,
            'total_points': element['total_points'],
            # Set-piece / defensive flags
            'defensive_contribution': element.get('defensive_contribution'),
            'clearances_blocks_interceptions': element.get('clearances_blocks_interceptions'),
            'direct_freekicks_order': element.get('direct_freekicks_order'),
            'penalties_order': element.get('penalties_order'),
            'corners_and_indirect_freekicks_order': element.get('corners_and_indirect_freekicks_order'),
            'news': element.get('news', ''),
            # Price trend (VAL-03)
            'cost_change_event': element.get('cost_change_event', 0),
            'cost_change_start': element.get('cost_change_start', 0),
            # Understat fields (null for unmatched — Phase 1 D-02: never exclude, show dash)
            'understat_id': understat_id_val,
            'xg_per90': xg_per90,
            'xa_per90': xa_per90,
            # Form metrics (D-01)
            'minutes_per90': minutes_per90,
            'form_pts_per90': form_pts_per90,
            # Next 5 fixtures (D-03)
            'fixtures': team_fixtures.get(team_id, []),
        }
        result.append(player)

    return result
