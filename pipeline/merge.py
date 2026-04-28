"""Merge FPL bootstrap data with Understat xG/xA, compute per-90 metrics,
custom FDR from rolling goals conceded, and next 5 fixture difficulty scores."""

from typing import Optional


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


# FPL scoring constants for xPts engine (Phase 28 — DATA-02, D-01..D-09)
# Position code: 1=GK, 2=DEF, 3=MID, 4=FWD
GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3  # all positions
CS_PTS = {1: 6, 2: 6, 3: 1, 4: 0}
# Flat position-average bonus rate (pts/game) — INDEPENDENT of cs_prob to avoid
# double-counting defensive quality (CS_PTS already pays for defensive quality once).
# See STATE.md blocker + 28-RESEARCH.md Common Pitfalls Pitfall 1.
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}


def _compute_difficulty_score(team_xga: float, min_xga: float, max_xga: float) -> float:
    """Normalise team xGA to 0.0–1.0 difficulty score.

    0.0 = easiest fixture (opponent concedes most goals — highest xGA).
    1.0 = hardest fixture (opponent concedes fewest goals — lowest xGA).
    """
    if max_xga == min_xga:
        return 0.5
    return 1.0 - (team_xga - min_xga) / (max_xga - min_xga)


def _compute_offensive_difficulty_score(team_xgs: float, min_xgs: float, max_xgs: float) -> float:
    """Normalise team goals-scored to 0.0–1.0 defensive_difficulty score.

    0.0 = easiest CS (opponent rarely scores — low goals_scored).
    1.0 = hardest CS (opponent scores often — high goals_scored).

    NOTE: NOT inverted. Unlike `_compute_difficulty_score()` which uses `1.0 - ...`
    because high-xGA opponents are EASIER to attack, here high-goals-scored
    opponents are HARDER to keep a clean sheet against, so direction is preserved.
    """
    if max_xgs == min_xgs:
        return 0.5
    return (team_xgs - min_xgs) / (max_xgs - min_xgs)


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


def _proj_pts_ngw(
    ppg: float,
    start_prob: float,
    fixtures: list,
    n_gws: int,
) -> float:
    """Project points across N upcoming GWs, DGW-aware.

    Groups fixtures by event_id. A DGW produces 2 fixtures in the same
    event_id group — both contribute to that GW's projected points.
    BGW gaps are implicit (team simply has no fixture for that GW).
    """
    from itertools import groupby

    if not fixtures or ppg == 0 or start_prob == 0:
        return 0.0

    # Group by event_id (fixtures are pre-sorted by event in merge_players)
    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total = 0.0
    for _event_id, gw_fixtures in grouped[:n_gws]:
        for fix in gw_fixtures:
            # difficulty_modifier: easy fixtures (low score) -> more expected pts
            # score 0.0 -> modifier 1.0 (easiest), score 1.0 -> modifier 0.5 (hardest)
            difficulty_modifier = 1.0 - (fix['difficulty_score'] * 0.5)
            total += ppg * start_prob * difficulty_modifier
    return round(total, 2)


def _cs_prob(defensive_difficulty: float, xmins: float) -> float:
    """Compute effective CS probability for a fixture (Phase 28 CR-01, WR-01).

    defensive_difficulty — opponent's attacking threat (0.0=weak attacker, 1.0=strong).
      Derived from _compute_offensive_difficulty_score (goals-scored rolling average).
      0.0 → opponent rarely scores → keeper likely to get CS → high cs_prob.
      1.0 → opponent scores often → CS unlikely → low cs_prob.

    Formula is inverse of defensive_difficulty so direction is correct:
      dd=0.0 → cs_prob_raw = 0.40 (good CS chance)
      dd=1.0 → cs_prob_raw = 0.10 (poor CS chance)

    xmins scales down when expected minutes < 60 (FPL awards CS pts at 60+ min only).
    """
    cs_prob_raw = max(0.10, min(0.65, 0.40 - defensive_difficulty * 0.30))
    mins_factor = min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor


def _compute_xpts_fixture(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    defensive_difficulty: float,
) -> dict:
    """Compute expected FPL points for a single fixture (Phase 28 DATA-02).

    Inputs:
      xg_per90, xa_per90      — Understat (or DQ-01 FPL proxy) per-90 rates
      start_prob              — probability of starting (0.0-1.0)
      xmins                   — unconditional expected minutes (start_prob already embedded)
      element_type            — FPL position code (1=GK, 2=DEF, 3=MID, 4=FWD)
      defensive_difficulty    — opponent's attacking threat (0.0=weak, 1.0=strong)

    Returns dict with keys: total, goal_pts, assist_pts, cs_pts, bonus_pts.
    Components are independently computed — bonus does NOT depend on cs_prob
    (avoids double-counting defensive quality, per STATE.md blocker).

    xmins is treated as unconditional expected minutes (xmins ≈ start_prob × avg_mins).
    start_prob is therefore NOT re-applied to goal/assist/bonus components — they all
    use xmins/90.0 as the scaling factor, consistent with lam_g and lam_a (CR-02).
    """
    # Guard against degenerate inputs
    if xmins <= 0 or start_prob <= 0:
        return {'total': 0.0, 'goal_pts': 0.0, 'assist_pts': 0.0, 'cs_pts': 0.0, 'bonus_pts': 0.0}

    xg = xg_per90 if xg_per90 is not None else 0.0
    xa = xa_per90 if xa_per90 is not None else 0.0

    # Poisson rates: scale per-90 rate to expected for this fixture's minutes.
    # xmins is unconditional expected minutes — start_prob already embedded.
    lam_g = xg * (xmins / 90.0)
    lam_a = xa * (xmins / 90.0)

    # Expected goal/assist points: linearity of expectation E[c*X] = c*E[X],
    # and Poisson E[X] = lambda — so E[goal_pts] = lambda_g * pts_per_goal.
    goal_pts = lam_g * GOAL_PTS[element_type]
    assist_pts = lam_a * ASSIST_PTS

    # CS probability: Bernoulli, parameterised from defensive_difficulty via helper.
    # See _cs_prob() docstring for direction rationale (CR-01 fix).
    effective_cs_prob = _cs_prob(defensive_difficulty, xmins)
    cs_pts = effective_cs_prob * CS_PTS[element_type]

    # Bonus: flat position-average rate, scaled by expected minutes only.
    # xmins already encodes start_prob (unconditional semantics) — do NOT
    # re-apply start_prob here (CR-02 fix: removes double-scaling).
    bonus_pts = BONUS_RATE[element_type] * (xmins / 90.0)

    total = goal_pts + assist_pts + cs_pts + bonus_pts
    return {
        'total': round(total, 3),
        'goal_pts': round(goal_pts, 3),
        'assist_pts': round(assist_pts, 3),
        'cs_pts': round(cs_pts, 3),
        'bonus_pts': round(bonus_pts, 3),
    }


def _xpts_ngw(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
) -> tuple:
    """Project xPts across N upcoming GWs, DGW-aware (Phase 28 DATA-02 D-04, D-06).

    Returns (total_xPts, components_for_first_gw_only_or_none).
    Components are summed across fixtures within the first GW group
    (matches DGW behaviour for the 1-GW window). For 3GW and 5GW
    windows the second tuple element is None — CONTEXT.md specifies
    xPts_components_1gw only.

    Mirrors _proj_pts_ngw() loop structure (lines 104-133).
    """
    from itertools import groupby

    if not fixtures or start_prob == 0 or xmins == 0:
        return 0.0, None

    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total = 0.0
    first_gw_components = {'goal_pts': 0.0, 'assist_pts': 0.0, 'cs_pts': 0.0, 'bonus_pts': 0.0}

    for gw_idx, (_event_id, gw_fixtures) in enumerate(grouped[:n_gws]):
        for fix in gw_fixtures:
            result = _compute_xpts_fixture(
                xg_per90 if xg_per90 is not None else 0.0,
                xa_per90 if xa_per90 is not None else 0.0,
                start_prob,
                xmins,
                element_type,
                fix.get('defensive_difficulty', 1.0 - fix.get('attacking_difficulty', 0.5)),
            )
            total += result['total']
            if gw_idx == 0 and n_gws == 1:
                for k in first_gw_components:
                    first_gw_components[k] += result[k]

    components = first_gw_components if n_gws == 1 else None
    if components is not None:
        # Round component sums to 3 decimals to match _compute_xpts_fixture
        components = {k: round(v, 3) for k, v in components.items()}
    return round(total, 2), components


def _compute_xpts_sigma(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
) -> float:
    """Analytical sigma for xPts across an N-GW window (Phase 28 XPTS-02 D-09).

    Var(goals_pts)  = pts_per_goal^2 * lambda_g    (Poisson variance property)
    Var(assist_pts) = pts_per_assist^2 * lambda_a  (Poisson variance property)
    Var(cs_pts)     = p*(1-p) * pts_per_cs^2       (Bernoulli variance property)
    Bonus variance is omitted — small relative to goal/CS variance for most players.

    Variances are additive across independent fixtures (DGW assumed independent),
    so total Var = sum_fixtures Var_per_fixture; sigma = sqrt(total Var).
    """
    import math
    from itertools import groupby

    if not fixtures or start_prob == 0 or xmins == 0:
        return 0.0

    xg = xg_per90 if xg_per90 is not None else 0.0
    xa = xa_per90 if xa_per90 is not None else 0.0

    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total_var = 0.0
    for _event_id, gw_fixtures in grouped[:n_gws]:
        for fix in gw_fixtures:
            dd = fix.get('defensive_difficulty', 1.0 - fix.get('attacking_difficulty', 0.5))
            cs_prob = _cs_prob(dd, xmins)

            lam_g = xg * (xmins / 90.0)
            lam_a = xa * (xmins / 90.0)

            var_goal = (GOAL_PTS[element_type] ** 2) * lam_g
            var_assist = (ASSIST_PTS ** 2) * lam_a
            var_cs = cs_prob * (1 - cs_prob) * (CS_PTS[element_type] ** 2)

            total_var += var_goal + var_assist + var_cs

    return math.sqrt(total_var)


def merge_players(
    bootstrap: dict,
    fixtures: list,
    understat: dict,
    id_map: dict,
    xmins_stats: dict | None = None,
    summaries: dict | None = None,
) -> list:
    """Merge FPL bootstrap + Understat xG/xA into a unified player list.

    Args:
        bootstrap:   FPL bootstrap-static JSON (elements, teams, events).
        fixtures:    FPL fixtures list.
        understat:   Dict keyed by Understat player ID (string) with xG/xA/minutes.
        id_map:      player_id_map.json — keyed by FPL id string, value has understat_id.
        xmins_stats: Optional dict from xmins.py mapping player_id (int) ->
                     {xmins, start_prob, mins_risk}. When provided, used to populate
                     the 6 new projected-pts and minutes-risk fields. Defaults to None
                     for backward compatibility.
        summaries:   Optional dict from run.py mapping player_id (int) -> element-summary
                     response dict. When provided, used to compute pts_last3gw,
                     pts_last5gw, and pts_gw_count for each player. Defaults to None.

    Returns:
        List of merged player dicts with all D-01 through D-06 fields plus
        projected points and minutes risk fields when xmins_stats is provided.
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
    ROLLING_WINDOW = 6        # existing — defensive xGA proxy (goals conceded)
    OFFENSIVE_ROLLING = 3     # NEW — offensive proxy (goals scored), shorter window for hot-streak reactivity (D-02)

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

    # NEW: parallel goals-scored aggregation for defensive_difficulty (DATA-01, D-02)
    team_goals_scored: dict[int, list[int]] = {t_id: [] for t_id in teams}

    for fix in finished:
        h_id = fix['team_h']
        a_id = fix['team_a']
        h_score = fix.get('team_h_score') or 0
        a_score = fix.get('team_a_score') or 0

        if h_id in team_goals_scored:
            team_goals_scored[h_id].append(h_score)   # home team scored own goals
        if a_id in team_goals_scored:
            team_goals_scored[a_id].append(a_score)   # away team scored own goals

    # Rolling 3-game average goals scored — "offensive proxy"
    team_xgs: dict[int, float] = {}
    for t_id, scored_list in team_goals_scored.items():
        last_n = scored_list[-OFFENSIVE_ROLLING:]
        team_xgs[t_id] = sum(last_n) / len(last_n) if last_n else 0.0

    # Independent normalization across xgs values (D-04)
    xgs_values = sorted(team_xgs.values())
    min_xgs = min(xgs_values) if xgs_values else 0.0
    max_xgs = max(xgs_values) if xgs_values else 1.0

    defensive_difficulty_scores: dict[int, float] = {}
    for t_id in teams:
        xgs = team_xgs.get(t_id, 0.0)
        defensive_difficulty_scores[t_id] = _compute_offensive_difficulty_score(xgs, min_xgs, max_xgs)

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
                'difficulty_score': difficulty_scores.get(opp_id, 0.5),                      # UNCHANGED
                'difficulty_tier': difficulty_tiers.get(opp_id, 'medium'),                   # UNCHANGED
                'attacking_difficulty': difficulty_scores.get(opp_id, 0.5),                  # NEW (DATA-01, D-01) — same as difficulty_score
                'defensive_difficulty': defensive_difficulty_scores.get(opp_id, 0.5),        # NEW (DATA-01, D-02)
            })

        # Away team perspective
        if a_id in team_fixtures and len(team_fixtures[a_id]) < FIXTURE_LOOKAHEAD:
            opp_id = h_id
            team_fixtures[a_id].append({
                'opponent_team': teams[opp_id]['short_name'] if opp_id in teams else str(opp_id),
                'is_home': False,
                'event_id': event_id,
                'difficulty_score': difficulty_scores.get(opp_id, 0.5),                      # UNCHANGED
                'difficulty_tier': difficulty_tiers.get(opp_id, 'medium'),                   # UNCHANGED
                'attacking_difficulty': difficulty_scores.get(opp_id, 0.5),                  # NEW
                'defensive_difficulty': defensive_difficulty_scores.get(opp_id, 0.5),        # NEW
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

        # DQ-01: FPL goals/assists proxy when Understat data missing
        if xg_per90 is None:
            fpl_minutes = element.get('minutes', 0)
            if fpl_minutes > 0:
                xg_per90 = round((element.get('goals_scored', 0) / fpl_minutes) * 90, 4)
                xa_per90 = round((element.get('assists', 0) / fpl_minutes) * 90, 4)
            else:
                xg_per90 = 0.0
                xa_per90 = 0.0

        # VG-01: Historical points from element-summary
        pts_last3gw = 0
        pts_last5gw = 0
        total_gws_available = 0
        if summaries and fpl_id in summaries:
            history = summaries[fpl_id].get('history', [])
            # history is chronological — take last N entries
            if history:
                total_gws_available = len(history)
                last3 = history[-3:] if len(history) >= 3 else history
                last5 = history[-5:] if len(history) >= 5 else history
                pts_last3gw = sum(m.get('total_points', 0) for m in last3)
                pts_last5gw = sum(m.get('total_points', 0) for m in last5)

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
            'goals_scored': element.get('goals_scored', 0),
            'assists': element.get('assists', 0),
            # Set-piece / defensive flags
            'defensive_contribution': element.get('defensive_contribution'),
            'clearances_blocks_interceptions': element.get('clearances_blocks_interceptions'),
            'direct_freekicks_order': element.get('direct_freekicks_order'),
            'penalties_order': element.get('penalties_order'),
            'corners_and_indirect_freekicks_order': element.get('corners_and_indirect_freekicks_order'),
            'penalties_text': element.get('penalties_text', ''),
            'direct_freekicks_text': element.get('direct_freekicks_text', ''),
            'corners_and_indirect_freekicks_text': element.get('corners_and_indirect_freekicks_text', ''),
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
            # Historical points (VG-01 — from element-summary history)
            'pts_last3gw': pts_last3gw,
            'pts_last5gw': pts_last5gw,
            'pts_gw_count': total_gws_available,
            # Next 5 fixtures (D-03)
            'fixtures': team_fixtures.get(team_id, []),
        }

        # ---- Projected points (PROJ-01/02/03) ----
        ep_next = float(element.get('ep_next', 0) or 0)
        chance = element.get('chance_of_playing_next_round')
        availability = (chance / 100.0) if chance is not None else 1.0
        proj_pts_1gw = round(ep_next * availability, 2)

        ppg = float(element.get('points_per_game', 0) or 0)
        player_fixtures = team_fixtures.get(team_id, [])

        # Get start_prob from xmins_stats if available, else estimate from bootstrap
        if xmins_stats and fpl_id in xmins_stats:
            sp = xmins_stats[fpl_id]['start_prob']
        else:
            sp = (starts / current_gw) if current_gw and starts > 0 else 0.0

        proj_pts_3gw = _proj_pts_ngw(ppg, sp, player_fixtures, 3)
        proj_pts_5gw = _proj_pts_ngw(ppg, sp, player_fixtures, 5)

        # ---- Minutes risk fields (MINS-01) ----
        if xmins_stats and fpl_id in xmins_stats:
            xm = xmins_stats[fpl_id]
            player_xmins = xm['xmins']
            player_start_prob = xm['start_prob']
            player_mins_risk = xm['mins_risk']
        else:
            player_xmins = 0.0
            player_start_prob = 0.0
            player_mins_risk = 'injured'

        player['proj_pts_1gw'] = proj_pts_1gw
        player['proj_pts_3gw'] = proj_pts_3gw
        player['proj_pts_5gw'] = proj_pts_5gw
        player['xmins'] = player_xmins
        player['start_prob'] = player_start_prob
        player['mins_risk'] = player_mins_risk

        # ---- xPts engine (Phase 28 DATA-02, XPTS-02, D-01..D-09) ----
        xpts_1gw, xpts_components_1gw = _xpts_ngw(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 1,
        )
        xpts_3gw, _ = _xpts_ngw(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 3,
        )
        xpts_5gw, _ = _xpts_ngw(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 5,
        )
        player['xPts_1gw'] = xpts_1gw
        player['xPts_3gw'] = xpts_3gw
        player['xPts_5gw'] = xpts_5gw
        player['xPts_components_1gw'] = xpts_components_1gw  # may be None for BGW

        # Sigma per window (used for ceiling classification post-loop)
        player['_sigma_1gw'] = _compute_xpts_sigma(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 1,
        )
        player['_sigma_3gw'] = _compute_xpts_sigma(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 3,
        )
        player['_sigma_5gw'] = _compute_xpts_sigma(
            xg_per90, xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 5,
        )

        result.append(player)

    # ---- xPts ceiling classification (Phase 28 XPTS-02 D-09) ----
    # Top-tercile sigma per GW window -> high-ceiling boolean.
    for window in (1, 3, 5):
        sigma_key = f'_sigma_{window}gw'
        ceiling_key = f'xPts_ceiling_{window}gw'
        sigmas = [p[sigma_key] for p in result]
        sorted_sigmas = sorted(sigmas)
        n = len(sorted_sigmas)
        if n >= 3:
            # int(n * 2/3) gives the start-index of the top tercile in a sorted list.
            # Mirrors _difficulty_tier easy_idx = int(n * 2 / 3) at line 257.
            tercile_idx = int(n * 2 / 3)
            threshold = sorted_sigmas[tercile_idx]
        else:
            threshold = 0.0
        for p in result:
            p[ceiling_key] = bool(p[sigma_key] >= threshold) if n >= 3 else False

    # Strip scratch sigma fields — only the boolean ceiling flags ship in JSON.
    for p in result:
        del p['_sigma_1gw']
        del p['_sigma_3gw']
        del p['_sigma_5gw']

    return result
