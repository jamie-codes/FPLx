"""Merge FPL bootstrap data with Understat xG/xA, compute per-90 metrics,
custom FDR from rolling goals conceded, and next 5 fixture difficulty scores."""

from typing import Optional
from saves import poisson_floor_save_pts, AWAY_FACTOR, HOME_FACTOR


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

# Phase FLOOR-01: historical consistency rate constants.
# Thresholds: minimum pts a player must score in a start to "return".
CONSISTENCY_THRESHOLD = {1: 6, 2: 6, 3: 5, 4: 5}  # by position code (GK/DEF >=6, MID/FWD >=5)
CONSISTENCY_MIN_STARTS = 4   # fewer than 4 qualifying starts in window -> report None
CONSISTENCY_WINDOW = 10      # look back over last N starts


def _compute_consistency_rate(
    history: list,
    element_type: int,
    window: int = CONSISTENCY_WINDOW,
) -> float | None:
    """% of recent starts where player returned >= position threshold points.

    Returns None when fewer than CONSISTENCY_MIN_STARTS starts exist in window.
    Position thresholds: GK/DEF >= 6 pts (CS-level), MID/FWD >= 5 pts (goal-level).
    """
    threshold = CONSISTENCY_THRESHOLD.get(element_type, 5)
    starts = [h for h in history if h.get('starts') == 1][-window:]
    if len(starts) < CONSISTENCY_MIN_STARTS:
        return None
    qualifying = sum(1 for h in starts if h.get('total_points', 0) >= threshold)
    return qualifying / len(starts)


def _compute_streak(history: list, element_type: int) -> int | None:
    """Count of consecutive most-recent starts returning >= position threshold.

    Returns None when no starts exist in history.
    Returns 0 when the most recent start missed the threshold.
    Reuses CONSISTENCY_THRESHOLD from FLOOR-01.
    """
    threshold = CONSISTENCY_THRESHOLD.get(element_type, 5)
    starts = [h for h in history if h.get('starts') == 1]
    if not starts:
        return None
    streak = 0
    for h in reversed(starts):
        if h.get('total_points', 0) >= threshold:
            streak += 1
        else:
            break
    return streak


def _compute_form_delta(history: list) -> float | None:
    """Last-5-starts avg pts minus season avg pts per start.

    Positive = currently above own seasonal baseline (hot streak).
    Negative = currently below baseline (cold run).
    Returns None when fewer than 6 starts exist (need at least one
    start outside the last-5 window for a meaningful comparison).
    """
    starts = [h for h in history if h.get('starts') == 1]
    if len(starts) < 6:
        return None
    season_avg = sum(h.get('total_points', 0) for h in starts) / len(starts)
    last5_avg = sum(h.get('total_points', 0) for h in starts[-5:]) / 5
    return round(last5_avg - season_avg, 2)


# Phase 42 ACC-01: blend coefficient for form-signal-into-xPts. 0.4 means
# form contributes 40% of the per-90 input. Tunable via merge_players kwarg —
# pipeline/run.py reads the runtime value from accuracy_backtest.json.summary.blend_alpha_used.
BLEND_ALPHA = 0.4


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




def _cs_prob(defensive_difficulty: float, xmins: float, mins_60_prob: float | None = None,
             cs_prob_base: float = 0.40, cs_prob_slope: float = 0.30) -> float:
    """Compute effective CS probability for a fixture (Phase 28 CR-01, WR-01).

    defensive_difficulty — opponent's attacking threat (0.0=weak attacker, 1.0=strong).
      Derived from _compute_offensive_difficulty_score (goals-scored rolling average).
      0.0 → opponent rarely scores → keeper likely to get CS → high cs_prob.
      1.0 → opponent scores often → CS unlikely → low cs_prob.

    Formula is inverse of defensive_difficulty so direction is correct:
      dd=0.0 → cs_prob_raw = 0.40 (good CS chance)
      dd=1.0 → cs_prob_raw = 0.10 (poor CS chance)

    xmins scales down when expected minutes < 60 (FPL awards CS pts at 60+ min only).

    Phase 52 D-01: when mins_60_prob is provided, it replaces min(1.0, xmins/60.0) as the
    mins_factor (semantically correct — mins_60_prob IS P(player earns CS pts)). When None
    or omitted, the existing xmins-based formula is used unchanged (backward compatible).
    The decision to pass mins_60_prob lives at the call site (Plan 03).

    cs_prob_base: base CS probability vs average opposition (default 0.40; tunable via TUNE-01).
    cs_prob_slope: sensitivity to defensive_difficulty (default 0.30; tunable via TUNE-01).
    """
    cs_prob_raw = max(0.10, min(0.65, cs_prob_base - defensive_difficulty * cs_prob_slope))
    if mins_60_prob is not None:
        mins_factor = mins_60_prob
    else:
        mins_factor = min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor


def _cs_prob_1gw_for_fixtures(fixtures: list, xmins: float,
                               xmins_v2_enabled: bool = False,
                               mins_60_prob: float | None = None,
                               cs_prob_base: float = 0.40,
                               cs_prob_slope: float = 0.30) -> float:
    """Aggregate clean-sheet probability for the next 1 GW (Phase 47 CS-01, CS-02).

    Mirrors _xpts_ngw groupby semantics so DGW handling is consistent:
    - Single-fixture GW: returns _cs_prob(dd, xmins) for that fixture.
    - DGW (>=2 fixtures in same event_id group): returns combined probability
      1 - product(1 - p_i) over the i fixtures in the FIRST event group.
    - BGW (no upcoming fixtures): returns 0.0 (D-10).
    - xmins == 0: returns 0.0 (no minutes -> no CS chance, mirrors mins_factor in _cs_prob).

    Only the FIRST event_id group counts toward the 1GW window; later GWs are ignored.
    """
    from itertools import groupby

    if not fixtures or xmins <= 0:
        return 0.0

    # Take the first event_id group only (the upcoming 1GW).
    first_group = []
    for _event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        first_group = list(group)
        break

    if not first_group:
        return 0.0

    # Combined probability across DGW: 1 - prod(1 - p_i)
    prob_no_cs = 1.0
    for fix in first_group:
        dd = fix.get('defensive_difficulty', 0.5)
        p = _cs_prob(dd, xmins,
                     mins_60_prob=mins_60_prob if xmins_v2_enabled else None,
                     cs_prob_base=cs_prob_base,
                     cs_prob_slope=cs_prob_slope)
        prob_no_cs *= (1.0 - p)
    return round(1.0 - prob_no_cs, 6)


def _compute_xpts_fixture(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    defensive_difficulty: float,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,           # Phase 83 GK-01
    opponent_xg_per_game: float = 0.0,              # Phase 83 GK-01 / D-02 (lambda for poisson_floor_save_pts)
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
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
        return {'total': 0.0, 'goal_pts': 0.0, 'assist_pts': 0.0, 'cs_pts': 0.0, 'bonus_pts': 0.0, 'appearance_pts': 0.0, 'save_pts': 0.0}

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
    effective_cs_prob = _cs_prob(defensive_difficulty, xmins,
                                 mins_60_prob=mins_60_prob if xmins_v2_enabled else None,
                                 cs_prob_base=cs_prob_base,
                                 cs_prob_slope=cs_prob_slope)
    cs_pts = effective_cs_prob * CS_PTS[element_type]

    # Bonus: flat position-average rate, scaled by expected minutes only.
    # xmins already encodes start_prob (unconditional semantics) — do NOT
    # re-apply start_prob here (CR-02 fix: removes double-scaling).
    # Phase 53 BPS-01: per-player bonus EV when gate is ON and a sample-sufficient
    # bonus_ev was supplied; otherwise the flat per-position fallback (Pitfall C1).
    if bonus_predictor_enabled and bonus_ev is not None:
        rate = bonus_ev
    else:
        rate = BONUS_RATE[element_type]
    bonus_pts = rate * (xmins / 90.0)

    # Appearance: FPL awards 2pts for starting; D-01 Phase 48. NOT scaled by xmins/90 —
    # appearance points are per game started, not per minute.
    appearance_pts = start_prob * 2

    # Phase 83 GK-01: save points for GKs when gate ON. element_type guard lives
    # here, NOT in saves.poisson_floor_save_pts (CONTEXT.md D-03 / Pitfall 3).
    if element_type == 1 and save_predictor_enabled:
        save_pts = poisson_floor_save_pts(opponent_xg_per_game)
    else:
        save_pts = 0.0

    total = goal_pts + assist_pts + cs_pts + bonus_pts + appearance_pts + save_pts
    return {
        'total': round(total, 3),
        'goal_pts': round(goal_pts, 3),
        'assist_pts': round(assist_pts, 3),
        'cs_pts': round(cs_pts, 3),
        'bonus_pts': round(bonus_pts, 3),
        'appearance_pts': round(appearance_pts, 3),
        'save_pts': round(save_pts, 3),  # Phase 83 GK-01 — always present (0.0 for non-GK / gate-OFF)
    }


def _xpts_ngw(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,   # Phase 83 GK-01
    cs_prob_base: float = 0.40,             # TUNE-01: tunable via accuracy_backtest.json.summary
    cs_prob_slope: float = 0.30,            # TUNE-01: tunable via accuracy_backtest.json.summary
) -> tuple:
    """Project xPts across N upcoming GWs, DGW-aware (Phase 28 DATA-02 D-04, D-06).

    Returns (total_xPts, components_for_first_gw_only_or_none).
    Components are summed across fixtures within the first GW group
    (matches DGW behaviour for the 1-GW window). For 3GW and 5GW
    windows the second tuple element is None — CONTEXT.md specifies
    xPts_components_1gw only.

    Mirrors the per-fixture loop pattern.
    """
    from itertools import groupby

    if not fixtures or start_prob <= 0 or xmins <= 0:
        return 0.0, None

    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total = 0.0
    first_gw_components = {'goal_pts': 0.0, 'assist_pts': 0.0, 'cs_pts': 0.0, 'bonus_pts': 0.0, 'appearance_pts': 0.0, 'save_pts': 0.0}

    for gw_idx, (_event_id, gw_fixtures) in enumerate(grouped[:n_gws]):
        for fix in gw_fixtures:
            result = _compute_xpts_fixture(
                xg_per90 if xg_per90 is not None else 0.0,
                xa_per90 if xa_per90 is not None else 0.0,
                start_prob,
                xmins,
                element_type,
                fix.get('defensive_difficulty', 0.5),
                xmins_v2_enabled=xmins_v2_enabled,
                mins_60_prob=mins_60_prob,
                bonus_predictor_enabled=bonus_predictor_enabled,
                bonus_ev=bonus_ev,
                save_predictor_enabled=save_predictor_enabled,                          # Phase 83 GK-01
                opponent_xg_per_game=fix.get('opponent_xg_per_game', 0.0),               # Phase 83 GK-01 / D-02
                cs_prob_base=cs_prob_base,                                               # TUNE-01
                cs_prob_slope=cs_prob_slope,                                             # TUNE-01
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


def _xpts_per_gw(
    xg_per90: float | None,
    xa_per90: float | None,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,   # Phase 83 GK-01
    cs_prob_base: float = 0.40,             # TUNE-01: tunable via accuracy_backtest.json.summary
    cs_prob_slope: float = 0.30,            # TUNE-01: tunable via accuracy_backtest.json.summary
) -> list[float]:
    """Return list of xPts per GW group (Phase 80 GWI-04, D-12).

    Length: min(n_gws, available_gws_in_fixtures). Each entry is the sum of
    xPts across all fixtures that share the same event_id (DGW combined).
    Mirrors _xpts_ngw groupby pattern; returns per-GW breakdown instead of total.
    Empty/zero guard: returns [0.0] * n_gws.
    """
    from itertools import groupby

    if not fixtures or start_prob <= 0 or xmins <= 0:
        return [0.0] * n_gws

    grouped: list[tuple[int, list]] = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    result: list[float] = []
    for _event_id, gw_fixtures in grouped[:n_gws]:
        gw_total = 0.0
        for fix in gw_fixtures:
            comp = _compute_xpts_fixture(
                xg_per90 if xg_per90 is not None else 0.0,
                xa_per90 if xa_per90 is not None else 0.0,
                start_prob,
                xmins,
                element_type,
                fix.get('defensive_difficulty', 0.5),
                xmins_v2_enabled=xmins_v2_enabled,
                mins_60_prob=mins_60_prob,
                bonus_predictor_enabled=bonus_predictor_enabled,
                bonus_ev=bonus_ev,
                save_predictor_enabled=save_predictor_enabled,                          # Phase 83 GK-01
                opponent_xg_per_game=fix.get('opponent_xg_per_game', 0.0),               # Phase 83 GK-01 / D-02
                cs_prob_base=cs_prob_base,                                               # TUNE-01
                cs_prob_slope=cs_prob_slope,                                             # TUNE-01
            )
            gw_total += comp['total']
        result.append(round(gw_total, 2))
    return result


def _compute_xpts_sigma(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,   # Phase 83 GK-01
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
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

    if not fixtures or start_prob <= 0 or xmins <= 0:
        return 0.0

    xg = xg_per90 if xg_per90 is not None else 0.0
    xa = xa_per90 if xa_per90 is not None else 0.0

    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total_var = 0.0
    for _event_id, gw_fixtures in grouped[:n_gws]:
        for fix in gw_fixtures:
            dd = fix.get('defensive_difficulty', 0.5)
            cs_prob = _cs_prob(
                dd, xmins,
                mins_60_prob=mins_60_prob if xmins_v2_enabled else None,
                cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
            )

            lam_g = xg * (xmins / 90.0)
            lam_a = xa * (xmins / 90.0)

            var_goal = (GOAL_PTS[element_type] ** 2) * lam_g
            var_assist = (ASSIST_PTS ** 2) * lam_a
            var_cs = cs_prob * (1 - cs_prob) * (CS_PTS[element_type] ** 2)

            total_var += var_goal + var_assist + var_cs

            # Phase 83 GK-01 / D-11: save variance for GKs when gate ON.
            # Var[floor(N/3)] ~ lambda/9 (continuous approximation; acceptable for ceiling classification).
            if element_type == 1 and save_predictor_enabled:
                lam_saves = fix.get('opponent_xg_per_game', 0.0)
                total_var += lam_saves / 9.0

    return math.sqrt(total_var)


def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,
    beta: float = 0.0,   # FRM-01: actual G+A blend weight; 0.0 = pure xG+xA (backward-compatible)
) -> tuple:
    """Compute recency-weighted form per-90 over the last window_gws unique rounds (Phase 42 ACC-01).

    FRM-01: When beta > 0, blends actual goals+assists per-90 into the form signal:
        form = (1 - beta) * xg_xa_per90 + beta * actual_ga_per90
    beta=0.0 (default) is the arithmetic identity for the pre-FRM-01 behaviour.
    beta is tuned by TUNE-01 coordinate descent; see pipeline/tune.py.

    Returns (form_per90, gws_used) or (None, 0) when insufficient data.
    form_per90 is a blend of xG+xA per-90 and actual G+A per-90 weighted by beta.

    Insufficient = fewer than 3 played rounds in window, OR sum(minutes) < min_minutes.
    Rationale: form requires at least 3 GWs of signal; <270 min total is too noisy.
    Mirrors _compute_regression_signal's data shape (history list from FPL element-summary)
    but uses recency weighting and per-90 normalisation rather than mean delta.

    Recency weight: linear from 1.0 (most recent round in window) to 0.5 (oldest in window).
    Linear is inspectable; no backtest evidence supports exotic decay (RESEARCH.md Pitfall 8).

    DGW handling: entries sharing a round are summed (minutes + xG + xA + goals + assists), not
    double-counted, so n == unique rounds played, not number of history entries.
    """
    if not history:
        return None, 0

    history_sorted = sorted(history, key=lambda h: h['round'])
    unique_rounds = sorted({h['round'] for h in history_sorted})
    last_rounds = set(unique_rounds[-window_gws:])

    # DGW aggregation — same shape as accuracy._group_history_by_gw
    by_round: dict = {}
    for entry in history_sorted:
        r = entry.get('round')
        if r is None or r not in last_rounds:
            continue
        agg = by_round.setdefault(r, {
            'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0,
            'goals_scored': 0, 'assists': 0,   # FRM-01
        })
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
        agg['goals_scored'] += int(entry.get('goals_scored', 0) or 0)   # FRM-01
        agg['assists'] += int(entry.get('assists', 0) or 0)              # FRM-01

    played = [by_round[r] for r in sorted(by_round.keys()) if by_round[r]['minutes'] > 0]
    total_mins = sum(p['minutes'] for p in played)
    if len(played) < 3 or total_mins < min_minutes:
        return None, 0

    # Linear recency weights: oldest=0.5, most recent=1.0
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]

    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_actual = sum(
        (p.get('goals_scored', 0) + p.get('assists', 0)) * w      # FRM-01
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))

    if weighted_mins <= 0:
        return None, 0

    xg_xa_per90     = (weighted_xgxa   / weighted_mins) * 90
    actual_ga_per90 = (weighted_actual / weighted_mins) * 90  # FRM-01
    blended         = (1.0 - beta) * xg_xa_per90 + beta * actual_ga_per90  # FRM-01

    form_per90 = round(blended, 4)
    return form_per90, len(played)


def _compute_regression_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 900,
    threshold: float = 0.5,
) -> tuple:
    """Compute regression signal from FPL element-summary history.

    Uses per-match expected_goals / expected_assists (StatsBomb model via FPL API).
    D-01/D-02 deviation: FPL element-summary supersedes soccerdata / understat_per_match.json.
    See 29-RESEARCH.md Critical Finding.

    Returns (signal, delta) where:
      signal: 'buy' | 'sell' | None
      delta:  float (mean actual G+A - mean xG+xA per played match) | None

    Window = last window_gws unique round values present in history.
    Entries with minutes == 0 excluded from means (DNP entries) but their
    round still consumes one of the window_gws slots (BGW/benched).
    """
    if not history:
        return None, None

    # Qualification check: total season minutes across full history (not just the window).
    # 900-min threshold requires ~10 starts — ensures meaningful xG/xA sample.
    season_mins = sum(h.get('minutes', 0) for h in history)
    if season_mins < min_minutes:
        return None, None

    history_sorted = sorted(history, key=lambda h: h['round'])

    unique_rounds = sorted({h['round'] for h in history_sorted})
    last_rounds = set(unique_rounds[-window_gws:])

    window = [h for h in history_sorted if h['round'] in last_rounds]
    played = [h for h in window if h.get('minutes', 0) > 0]

    n = len(played)
    if n == 0:
        return None, None

    mean_actual = sum(h.get('goals_scored', 0) + h.get('assists', 0) for h in played) / n
    mean_xgxa = sum(
        _safe_float(h.get('expected_goals', 0)) + _safe_float(h.get('expected_assists', 0))
        for h in played
    ) / n

    delta = round(mean_actual - mean_xgxa, 4)

    if delta < -threshold:
        return 'buy', delta
    elif delta > threshold:
        return 'sell', delta
    else:
        return None, delta


def _compute_differential_flag(
    xpts_1gw: float,
    selected_by_percent: str,
    status: str,
    position_median: float,
) -> str | None:
    """Classify a player as 'diff', 'trap', or None (Phase 30 TMPL-01, TMPL-02).

    DIFF gate (D-03): xpts_1gw > position_median AND ownership < 5.0 AND status == 'a'.
    TRAP gate (D-04): xpts_1gw < position_median AND ownership > 15.0.
                      Status exclusion does NOT apply to TRAP (D-12: an injured
                      template player is still a sell-trap signal).

    D-12 asymmetry: injury/suspension excludes from DIFF only — a 3%-owned injured
    player is not a buy. The same player below median xPts and >15% owned IS a TRAP.

    Returns:
        'diff' | 'trap' | None
    """
    ownership = _safe_float(selected_by_percent, 0.0)

    if xpts_1gw > position_median and ownership < 5.0 and status == 'a':
        return 'diff'
    if xpts_1gw < position_median and ownership > 15.0:
        return 'trap'
    return None


def _compute_captain_picks(result: list, gameweek: int | None = None) -> dict:
    """Pick ceiling and EO-adjusted captain candidates from the merged player list.

    Both picks require status == 'a' (D-04, D-07).

    Ceiling (D-04): the player with the highest ``xPts_90th_1gw`` (which is
    ``xPts_1gw + 1.28 * _sigma_1gw`` written by the post-loop block).

    EO-adjusted (D-06/D-08): the highest-xPts_90th_1gw player whose
    ``selected_by_percent`` is below 25.0; if none qualifies, retry at 35.0;
    if still none, fall back to the ceiling pick (D-08).

    Phase 31 — CAP-03, CAP-04.

    Args:
        result:    list of merged player dicts (must already have xPts_90th_1gw).
        gameweek:  optional GW number to embed in the output payload.

    Returns:
        Dict matching the captain_picks.json schema (D-09).
    """
    from datetime import datetime, timezone

    POSITION_MAP = {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}

    eligible = [p for p in result if p.get('status') == 'a' and p.get('element_type') != 1]   # Phase 83 GK-03 / D-10 — exclude GKs from captaincy

    def _pick_dict(p: dict, *, eo_threshold: float | None = None) -> dict:
        d = {
            'id': p['id'],
            'name': p.get('web_name', ''),
            'team': p.get('team_short_name', ''),
            'position': POSITION_MAP.get(p.get('element_type'), ''),
            'now_cost': p.get('now_cost', 0),
            'xPts_1gw': p.get('xPts_1gw', 0.0),
            'xPts_90th_1gw': p.get('xPts_90th_1gw', 0.0),
            'selected_by_percent': p.get('selected_by_percent', '0'),
        }
        if eo_threshold is not None:
            d['eo_threshold_used'] = eo_threshold
        return d

    if not eligible:
        return {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'gameweek': gameweek,
            'ceiling': None,
            'eo_adjusted': None,
        }

    ceiling = max(eligible, key=lambda p: p.get('xPts_90th_1gw', 0.0))

    eo = None
    threshold_used: float | None = None
    for threshold in (25.0, 35.0):
        candidates = [
            p for p in eligible
            if _safe_float(p.get('selected_by_percent'), 0.0) < threshold
        ]
        if candidates:
            eo = max(candidates, key=lambda p: p.get('xPts_90th_1gw', 0.0))
            threshold_used = threshold
            break

    if eo is None:
        # D-08 final fallback: EO pick = ceiling pick (no threshold annotation).
        eo_dict = _pick_dict(ceiling)
    else:
        eo_dict = _pick_dict(eo, eo_threshold=threshold_used)

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gameweek': gameweek,
        'ceiling': _pick_dict(ceiling),
        'eo_adjusted': eo_dict,
    }


def merge_players(
    bootstrap: dict,
    fixtures: list,
    understat: dict,
    id_map: dict,
    xmins_stats: dict | None = None,
    summaries: dict | None = None,
    form_signal_enabled: bool = False,
    blend_alpha: float = BLEND_ALPHA,
    xmins_v2_enabled: bool = False,
    bonus_stats: dict | None = None,
    bonus_predictor_enabled: bool = False,
    save_predictor_enabled: bool = False,   # Phase 83 GK-01 / GK-03
    cs_prob_base: float = 0.40,             # TUNE-01: tunable via accuracy_backtest.json.summary
    cs_prob_slope: float = 0.30,            # TUNE-01: tunable via accuracy_backtest.json.summary
    form_window_gws: int = 5,               # TUNE-01: tunable via accuracy_backtest.json.summary
    form_actual_beta: float = 0.0,          # FRM-01: actual G+A blend weight, tunable via TUNE-01
) -> tuple[list, dict]:
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
        form_signal_enabled: Phase 42 ACC-01 gate. When True AND a player has a
                             valid form_xgxa_per90, blend the form signal into
                             the per-90 inputs of _xpts_ngw before computing
                             xPts. Default False — preserves baseline.
        blend_alpha:         Phase 42 ACC-01. Weight of form signal in blended
                             per-90 (0.0=pure season, 1.0=pure form). Default
                             BLEND_ALPHA=0.4. run.py overrides this with the
                             value persisted by accuracy.compute_accuracy_backtest
                             (which is whatever Plan 02 ships — currently a fixed 0.4).
        bonus_stats:         Phase 53 BPS-01. Optional dict from bonus.py mapping
                             player_id (int) -> {bonus_ev, avg_bps, n_starts, source}. Per-player
                             learned EV used in place of BONUS_RATE[element_type] when
                             bonus_predictor_enabled is True. Default None preserves baseline.
        bonus_predictor_enabled: Phase 53 BPS-01 gate. When True AND a sample-sufficient
                             bonus_ev is available, the per-player rate replaces the flat
                             BONUS_RATE in _compute_xpts_fixture. Default False preserves
                             baseline behaviour. Manually flipped after non-regression
                             shadow run (Phase 52 D-02 mirror).
        form_actual_beta:    FRM-01. Weight of actual G+A per-90 blended into the form
                             signal: form = (1-beta)*xg_xa_per90 + beta*actual_ga_per90.
                             Default 0.0 = pure xG+xA (backward-compatible). Tunable via
                             TUNE-01 coordinate descent.

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
    FIXTURE_LOOKAHEAD = 32

    upcoming = sorted(
        [f for f in fixtures if not f.get('finished') and f.get('event') is not None],
        key=lambda f: f['event'],
    )

    # Per team: next 32 upcoming fixture dicts
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
                'opponent_xg_per_game': round(team_xgs.get(opp_id, 0.0) * AWAY_FACTOR, 4),  # Phase 83 GK-01 / D-02 — opponent is traveling (is_home=True for our team)
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
                'opponent_xg_per_game': round(team_xgs.get(opp_id, 0.0) * HOME_FACTOR, 4),  # Phase 83 GK-01 / D-02 — opponent is at home (is_home=False for our team)
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
            'code': element.get('code', 0),
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
            # FPL StatsBomb season-total xG/xA (Phase 32 TGT-02, D-09).
            # Source: bootstrap elements.expected_goals / expected_assists (string decimals).
            # Used by src/lib/xgi.ts computeXgiInvolvement for per-player team-share %.
            'expected_goals': float(element.get('expected_goals', 0) or 0),
            'expected_assists': float(element.get('expected_assists', 0) or 0),
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
            # Phase 88 SCRAPER-01: news availability fields
            'news_added': element.get('news_added', ''),
            'chance_of_playing_next_round': element.get('chance_of_playing_next_round'),
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

        player_fixtures = team_fixtures.get(team_id, [])

        # ---- Minutes risk fields (MINS-01) ----
        if xmins_stats and fpl_id in xmins_stats:
            xm = xmins_stats[fpl_id]
            # MIN-02: use xmins_adjusted (rotation + availability factors applied).
            # Fallback to xmins for backward compat if running against old cache.
            player_xmins = xm.get('xmins_adjusted', xm['xmins'])
            player_start_prob = xm['start_prob']
            player_mins_risk = xm['mins_risk']
        else:
            player_xmins = 0.0
            player_start_prob = 0.0
            player_mins_risk = 'injured'

        player['xmins'] = player_xmins
        player['start_prob'] = player_start_prob
        player['mins_risk'] = player_mins_risk

        # Phase 52 D-03: mins_60_prob and sub_risk_label always written (consumed by BENCH-01, MinsRiskBadge tooltip).
        # Only the _cs_prob formula swap (below) is gated by xmins_v2_enabled.
        if xmins_stats and fpl_id in xmins_stats:
            xm = xmins_stats[fpl_id]
            player['mins_60_prob'] = xm.get('mins_60_prob', 0.0)
            player['sub_risk_label'] = xm.get('sub_risk_label', 'injured')
            player['difficulty_rotation_risk'] = xm.get('difficulty_rotation_risk', 'unknown')  # MIN-02
            player['availability_risk'] = xm.get('availability_risk', 'unknown')                  # MIN-02
        else:
            player['mins_60_prob'] = 0.0
            player['sub_risk_label'] = 'injured'
        player_mins_60_prob = player['mins_60_prob']

        # Phase 53 BPS-01: per-player bonus EV unpacking. Falls back to None when
        # bonus_stats is absent OR the player is missing OR the bonus.py guard returned
        # source='prior' for low-sample players (handled at _compute_xpts_fixture
        # via Pitfall C1 fallback).
        if bonus_stats and fpl_id in bonus_stats:
            player_bonus_ev = bonus_stats[fpl_id].get('bonus_ev')
            player_bonus_source = bonus_stats[fpl_id].get('source')
            player_avg_bps = bonus_stats[fpl_id].get('avg_bps')   # BPS-02
            # When bonus.py marked source='prior', the flat rate is identical to
            # POSITION_PRIOR — so passing the prior through is harmless. We still pass it
            # so the gate uses the documented per-player path consistently.
        else:
            player_bonus_ev = None
            player_bonus_source = None
            player_avg_bps = None                                   # BPS-02
        # BPS-01/BPS-02: persist bonus signals so the frontend can surface them per-player.
        player['bonus_ev'] = player_bonus_ev
        player['bonus_source'] = player_bonus_source
        player['avg_bps'] = player_avg_bps                          # BPS-02

        # ---- Consistency rate (FLOOR-01) ----
        # Historical % of starts where player returned >= position threshold points.
        # None when fewer than CONSISTENCY_MIN_STARTS starts in last CONSISTENCY_WINDOW GWs.
        if summaries and fpl_id in summaries:
            cons_history = summaries[fpl_id].get('history', [])
            cons_rate = _compute_consistency_rate(cons_history, element['element_type'])
        else:
            cons_rate = None
        player['cons_rate'] = cons_rate

        # ---- Streak + form delta (STREAK-01) ----
        # streak: consecutive starts returning >= position threshold (CONSISTENCY_THRESHOLD).
        # form_delta: last-5-starts avg pts minus season avg pts per start.
        if summaries and fpl_id in summaries:
            streak_history = summaries[fpl_id].get('history', [])
            streak = _compute_streak(streak_history, element['element_type'])
            form_delta = _compute_form_delta(streak_history)
        else:
            streak = None
            form_delta = None
        player['streak'] = streak
        player['form_delta'] = form_delta

        # ---- Form signal (Phase 42 ACC-01) ----
        # Recency-weighted xG+xA per-90 over last 3-5 GWs from element-summary history.
        # Always write the field (None + 0 when insufficient) so MergedPlayer is shape-consistent
        # across players and downstream consumers can rely on the key being present.
        # PLACEMENT NOTE: this block sits BEFORE the xPts engine because Task 4 reads
        # `form_per90` as a local variable inside the engine block to drive the blend.
        if summaries and fpl_id in summaries:
            form_per90, form_n_gws = _compute_form_signal(
                summaries[fpl_id].get('history', []),
                window_gws=form_window_gws,
                beta=form_actual_beta,   # FRM-01
            )
        else:
            form_per90, form_n_gws = None, 0
        player['form_xgxa_per90'] = form_per90
        player['form_xgxa_window_gws'] = form_n_gws

        # ---- xPts engine (Phase 28 DATA-02, XPTS-02, D-01..D-09) ----
        # Phase 42 ACC-01: optionally blend form signal into per-90 inputs before scoring.
        # When form_signal_enabled is False OR form_xgxa_per90 is None, use season per-90 unchanged.
        # When True AND form is available, blend = (1-alpha)*season + alpha*form, then re-split
        # the blended xGI total proportionally to the season xG/xA ratio so goal-heavy strikers
        # do not erroneously gain assist points (RESEARCH.md Pitfall 2).
        xpts_xg_per90 = xg_per90 if xg_per90 is not None else 0.0
        xpts_xa_per90 = xa_per90 if xa_per90 is not None else 0.0
        if form_signal_enabled and form_per90 is not None:
            season_xgxa_per90 = xpts_xg_per90 + xpts_xa_per90
            blended_xgxa_per90 = (1.0 - blend_alpha) * season_xgxa_per90 + blend_alpha * form_per90
            if season_xgxa_per90 > 0:
                xg_share = xpts_xg_per90 / season_xgxa_per90
                xpts_xg_per90 = blended_xgxa_per90 * xg_share
                xpts_xa_per90 = blended_xgxa_per90 * (1.0 - xg_share)
            else:
                # No season data (promoted-team players) — split 50/50.
                xpts_xg_per90 = blended_xgxa_per90 * 0.5
                xpts_xa_per90 = blended_xgxa_per90 * 0.5

        xpts_1gw, xpts_components_1gw = _xpts_ngw(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 1,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,  # TUNE-01
        )
        xpts_3gw, _ = _xpts_ngw(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 3,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,  # TUNE-01
        )
        xpts_5gw, _ = _xpts_ngw(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 5,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,  # TUNE-01
        )
        player['xPts_1gw'] = xpts_1gw
        player['xPts_3gw'] = xpts_3gw
        player['xPts_5gw'] = xpts_5gw
        player['xPts_components_1gw'] = xpts_components_1gw  # may be None for BGW
        # Phase 47 CS-01/CS-02 (D-08/D-10): expose cs_prob_1gw alongside xPts_1gw.
        # BGW players: 0.0 (no fixture). DGW players: combined 1-(1-p1)*(1-p2).
        player['cs_prob_1gw'] = _cs_prob_1gw_for_fixtures(
            player_fixtures, player_xmins,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,  # TUNE-01
        )

        # ---- Regression signal (Phase 29 DATA-03, REG-01, REG-02) ----
        # D-01/D-02 deviation: uses FPL element-summary expected_goals/expected_assists
        # from existing summaries dict — zero new HTTP calls (see 29-RESEARCH.md).
        # D-03: if summaries absent/player missing, fields simply omit from dict (no hard-fail).
        if summaries and fpl_id in summaries:
            reg_signal, reg_delta = _compute_regression_signal(
                summaries[fpl_id].get('history', [])
            )
            # Only write to player dict when a directional signal fired.
            # Neutral-zone (signal=None, delta in [-0.5, 0.5]) must produce absent fields per D-03.
            if reg_signal is not None:
                player['regression_signal'] = reg_signal
                player['actual_vs_xg_delta'] = reg_delta

        # Sigma per window (used for ceiling classification post-loop)
        player['_sigma_1gw'] = _compute_xpts_sigma(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 1,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
        )
        player['_sigma_3gw'] = _compute_xpts_sigma(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 3,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
        )
        player['_sigma_5gw'] = _compute_xpts_sigma(
            xpts_xg_per90, xpts_xa_per90, player_start_prob, player_xmins,
            element['element_type'], player_fixtures, 5,
            xmins_v2_enabled=xmins_v2_enabled, mins_60_prob=player_mins_60_prob,
            bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev,
            save_predictor_enabled=save_predictor_enabled,   # Phase 83 GK-01
            cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
        )

        result.append(player)

    # ---- Differential flag (Phase 30 TMPL-01, TMPL-02) ----
    # D-01: position-relative median across all players in result.
    # D-05: pre-classify in pipeline; UI reads pre-computed flag (no client-side median).
    # D-12: status='a' gate is enforced inside _compute_differential_flag for DIFF only.
    from statistics import median
    pos_xpts: dict[int, list[float]] = {1: [], 2: [], 3: [], 4: []}
    for p in result:
        xpts_val = p.get('xPts_1gw')
        if xpts_val is not None and xpts_val > 0:  # exclude BGW players (xPts_1gw=None or 0 — no fixture this week)
            pos_xpts[p['element_type']].append(xpts_val)
    pos_median: dict[int, float] = {
        et: median(vals) if vals else 0.0
        for et, vals in pos_xpts.items()
    }
    for p in result:
        if p.get('xPts_1gw') is None or p.get('xPts_1gw') <= 0:  # BGW player — no fixture; skip differential classification
            continue
        flag = _compute_differential_flag(
            p['xPts_1gw'],
            p.get('selected_by_percent', '0'),
            p.get('status', ''),
            pos_median[p['element_type']],
        )
        if flag is not None:
            p['differential_flag'] = flag

    # ---- Routes to points (Phase 76 RTP-01) ----
    # Counts distinct point-scoring routes (0..5) per player. Mirrors the differential-flag
    # pass shape above. Five routes:
    #   1 penalty taker (penalties_order == 1)
    #   2 direct FK taker (direct_freekicks_order == 1)
    #   3 corner taker (corners_and_indirect_freekicks_order == 1)
    #   4 above-median xG/90 in team (xg_per90 strictly > team median)
    #   5 above-median xA/90 in team (xa_per90 strictly > team median)
    # `None` xg_per90 / xa_per90 (promoted-team unmatched players) cleanly skip routes 4-5.
    # Teams with zero non-null per-90 entries produce no median entry; their players
    # therefore cannot satisfy routes 4-5 (acceptable per RESEARCH Pitfall 4).
    team_xg_values: dict[int, list[float]] = {}
    team_xa_values: dict[int, list[float]] = {}
    for p in result:
        if p.get('xg_per90') is not None:
            team_xg_values.setdefault(p['team'], []).append(p['xg_per90'])
        if p.get('xa_per90') is not None:
            team_xa_values.setdefault(p['team'], []).append(p['xa_per90'])

    team_xg_med: dict[int, float] = {t: median(vals) for t, vals in team_xg_values.items() if vals}
    team_xa_med: dict[int, float] = {t: median(vals) for t, vals in team_xa_values.items() if vals}

    for p in result:
        routes = 0
        if p.get('penalties_order') == 1:
            routes += 1
        if p.get('direct_freekicks_order') == 1:
            routes += 1
        if p.get('corners_and_indirect_freekicks_order') == 1:
            routes += 1
        xg = p.get('xg_per90')
        team_xg_threshold = team_xg_med.get(p['team'])
        if xg is not None and team_xg_threshold is not None and xg > team_xg_threshold:
            routes += 1
        xa = p.get('xa_per90')
        team_xa_threshold = team_xa_med.get(p['team'])
        if xa is not None and team_xa_threshold is not None and xa > team_xa_threshold:
            routes += 1
        p['routes_to_points'] = routes

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

    # ---- Captain picks per GW (Phase 31 CAP-03, CAP-04) ----
    # D-11: write xPts_90th_1gw per player into merged_players.json
    # so future GemTable sort/filter can use it (Phase 32+).
    # Z=1.28 is the 90th-percentile z-score (standard normal approximation
    # of the Poisson xPts variance from Phase 28 _compute_xpts_sigma).
    for p in result:
        p['xPts_90th_1gw'] = round(
            (p.get('xPts_1gw') or 0.0) + 1.28 * (p.get('_sigma_1gw') or 0.0), 3
        )

    # D-04, D-06, D-08: pick ceiling + EO-adjusted captains for this GW.
    captain_picks_payload = _compute_captain_picks(result, gameweek=current_gw)

    # Strip scratch sigma fields — only the boolean ceiling flags ship in JSON.
    for p in result:
        del p['_sigma_1gw']
        del p['_sigma_3gw']
        del p['_sigma_5gw']

    return result, captain_picks_payload
