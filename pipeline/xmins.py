"""Compute expected minutes, start probability, and rotation risk classification."""

import statistics

from news_classifier import classify_availability

# Phase 52 D-06: position-prior fallback for new signings / post-injury return
POSITION_PRIOR = {1: 0.90, 2: 0.75, 3: 0.65, 4: 0.60}


def build_next_gw_team_fdr(fixtures: list, next_gw_id: int) -> dict:
    """Build a mapping of team_id → fixture_difficulty for the given gameweek.

    Args:
        fixtures:    FPL fixture dicts from /fixtures/ endpoint. Each must have
                     'event', 'team_h', 'team_a', 'team_h_difficulty', 'team_a_difficulty'.
        next_gw_id:  FPL event id (gameweek number) to look up.

    Returns:
        dict mapping team_id (int) → difficulty (int 1–5).
        Teams with a blank GW are absent from the dict.

        For double-gameweek teams, the last fixture processed overwrites the first
        (dict key collision). This is acceptable because DGW rotation risk is
        indeterminate; both fixtures' difficulties are reasonable inputs.
    """
    team_fdr: dict = {}
    for fixture in fixtures:
        if fixture.get('event') != next_gw_id:
            continue
        home_team = fixture.get('team_h')
        away_team = fixture.get('team_a')
        home_diff = fixture.get('team_h_difficulty')
        away_diff = fixture.get('team_a_difficulty')
        if home_team and home_diff:
            team_fdr[int(home_team)] = int(home_diff)
        if away_team and away_diff:
            team_fdr[int(away_team)] = int(away_diff)
    return team_fdr


def compute_rotation_risk(history: list, next_fixture_difficulty: int | None) -> dict:
    """Compute fixture-difficulty-aware rotation risk for a player.

    Bins historical games into easy (FDR 1–2) / medium (FDR 3) / hard (FDR 4–5)
    using the 'difficulty' field from element-summary history. Computes average
    minutes per bucket vs. player unconditional average, then classifies the next
    fixture's bucket as low / medium / high rotation risk.

    Args:
        history:                  Per-GW history list from element-summary/{id}/,
                                  each dict with 'minutes' (int) and 'difficulty' (int 1–5).
        next_fixture_difficulty:  FPL difficulty (1–5) for next GW fixture;
                                  None when player has a blank GW or data is unavailable.

    Returns:
        dict with keys:
            rotation_risk:   'low' | 'medium' | 'high' | 'unknown'
            rotation_factor: float  (1.0, 0.87, or 0.75)
    """
    UNKNOWN = {'rotation_risk': 'unknown', 'rotation_factor': 1.0}

    if not history or next_fixture_difficulty is None or len(history) < 5:
        return UNKNOWN

    def _bucket(diff: int) -> str:
        if diff <= 2:
            return 'easy'
        if diff == 3:
            return 'medium'
        return 'hard'

    next_bucket = _bucket(int(next_fixture_difficulty))

    bucket_minutes: dict[str, list] = {'easy': [], 'medium': [], 'hard': []}
    all_minutes: list = []

    for game in history:
        diff = game.get('difficulty')
        mins = int(game.get('minutes', 0))
        all_minutes.append(mins)
        if diff is not None:
            bucket_minutes[_bucket(int(diff))].append(mins)

    if not all_minutes:
        return UNKNOWN

    avg_all = sum(all_minutes) / len(all_minutes)
    if avg_all == 0:
        return UNKNOWN

    bucket_games = bucket_minutes.get(next_bucket, [])
    if len(bucket_games) < 3:
        return UNKNOWN  # sparse bucket — no reliable signal

    avg_bucket = sum(bucket_games) / len(bucket_games)
    ratio = avg_bucket / avg_all

    if ratio >= 0.90:
        return {'rotation_risk': 'low', 'rotation_factor': 1.0}
    if ratio >= 0.75:
        return {'rotation_risk': 'medium', 'rotation_factor': 0.87}
    return {'rotation_risk': 'high', 'rotation_factor': 0.75}


def compute_xmins_stats(
    bootstrap: dict,
    summaries: dict,
    finished_gws: int,
    fixtures: list | None = None,    # MIN-02: for rotation risk (optional, backward-compat)
    next_gw_id: int | None = None,   # MIN-02: for rotation risk (optional, backward-compat)
) -> dict:
    """
    Compute xmins, start_prob, mins_risk for every player.

    Args:
        bootstrap:    FPL bootstrap-static JSON (elements list).
        summaries:    dict mapping player_id (int) -> element-summary dict.
                      Pre-fetched by run.py shared cache.
        finished_gws: Number of completed gameweeks (for season start_rate fallback).
        fixtures:     FPL fixture list (optional). Passed for MIN-02 rotation risk.
                      If None, rotation_risk defaults to 'unknown' for all players.
        next_gw_id:   FPL event id of the next gameweek (optional). Required with fixtures.

    Returns:
        dict mapping player_id (int) -> per-player stats dict with keys:
            xmins, xmins_adjusted, start_prob, mins_risk, mins_60_prob, sub_risk_label,
            rotation_risk, rotation_factor, availability_risk, availability_factor.
        Every player in bootstrap['elements'] gets an entry (including GKs and 0-start players).
    """
    # Build next-GW team FDR map for rotation risk computation (MIN-02).
    # Empty dict when fixtures/next_gw_id not provided — rotation risk defaults to unknown.
    team_fdr: dict = {}
    if fixtures and next_gw_id:
        team_fdr = build_next_gw_team_fdr(fixtures, next_gw_id)

    results = {}

    for element in bootstrap.get('elements', []):
        player_id = element['id']
        next_fixture_difficulty = team_fdr.get(element.get('team'))
        results[player_id] = _compute_player_xmins(
            element, summaries.get(player_id), finished_gws, next_fixture_difficulty,
        )

    return results


def _compute_player_xmins(
    element: dict,
    summary: dict | None,
    finished_gws: int,
    next_fixture_difficulty: int | None = None,   # MIN-02: for rotation risk
) -> dict:
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

    # MIN-02: Rotation risk (fixture-difficulty-aware).
    # Re-fetch history here (works for both branches above — the if-branch sets a
    # local `history` var inside its scope; this fetch handles the else-branch too).
    history = (summary or {}).get('history', [])
    rotation_result = compute_rotation_risk(history, next_fixture_difficulty)

    # MIN-02: Availability classification (FPL status → chance → keyword fallback).
    availability_result = classify_availability(
        status=element.get('status', 'a'),
        chance=element.get('chance_of_playing_next_round'),
        news_text=element.get('news', ''),
    )

    # Combined xmins adjustment.
    # Guard against double-penalty: start_prob already incorporates chance_of_playing via
    # the `availability = chance/100` multiplier above. When chance is set and > 0, use
    # adjustment_availability_factor=1.0 to avoid discounting twice. The availability_risk
    # label is still preserved in the return dict for display purposes.
    # availability_factor is only applied when:
    #   - status is i/u/s (outright unavailable, no chance set)
    #   - chance is null and keywords indicate doubt/out
    #   - chance == 0 (already gives xmins ≈ 0 via start_prob=0, factor enforces it)
    _chance = element.get('chance_of_playing_next_round')
    if _chance is not None and _chance > 0:
        # start_prob already reflects this chance — no additional factor needed.
        adjustment_availability_factor = 1.0
    else:
        adjustment_availability_factor = availability_result['availability_factor']
    xmins_adjusted = round(
        xmins * rotation_result['rotation_factor'] * adjustment_availability_factor,
        1,
    )

    return {
        'xmins': xmins,
        'xmins_adjusted': xmins_adjusted,                               # MIN-02
        'start_prob': start_prob,
        'mins_risk': mins_risk,
        'mins_60_prob': mins_60_prob,
        'sub_risk_label': sub_risk_label,
        'rotation_risk': rotation_result['rotation_risk'],              # MIN-02
        'rotation_factor': rotation_result['rotation_factor'],          # MIN-02
        'availability_risk': availability_result['availability_risk'],  # MIN-02
        'availability_factor': availability_result['availability_factor'],  # MIN-02
    }
