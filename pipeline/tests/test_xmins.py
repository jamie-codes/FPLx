"""Pytest unit tests for _compute_player_xmins (Phase 52 MIN-01)."""

from xmins import _compute_player_xmins


def _element(element_type=3, starts=10, minutes=900, status='a', news='', chance=None):
    return {
        'id': 1,
        'element_type': element_type,
        'starts': starts,
        'minutes': minutes,
        'status': status,
        'news': news,
        'chance_of_playing_next_round': chance,
    }


def _hist(minutes, starts_field):
    return {'minutes': minutes, 'starts': starts_field}


def _summary(entries):
    return {'history': entries}


def test_returns_mins_60_prob_and_sub_risk_label():
    """Return dict has keys {'xmins','start_prob','mins_risk','mins_60_prob','sub_risk_label'}."""
    history = [_hist(90, 1)] * 10
    result = _compute_player_xmins(_element(), _summary(history), 10)
    assert {'xmins', 'start_prob', 'mins_risk', 'mins_60_prob', 'sub_risk_label'}.issubset(result.keys())
    assert {'xmins_adjusted', 'difficulty_rotation_risk', 'difficulty_rotation_factor', 'availability_risk', 'availability_factor'}.issubset(result.keys())


def test_new_signing_fallback_blends_position_prior_with_evidence():
    """STALE-01: with 2 starts in the recent 10, the position prior is BLENDED
    with the observed rate, not returned outright.

    The old contract returned the flat prior (0.65-0.90), rating a player who
    started 2 of 10 games as a 65-90% starter. Blending pulls that down toward
    the evidence — the same mechanism that pulls a 2-of-2 starter UP instead of
    leaving them on last season's rate."""
    # Build summary: 2 entries with starts=1, 8 with starts=0
    history = [_hist(90, 1)] * 2 + [_hist(0, 0)] * 8

    # GK (element_type=1) -> prior 0.90, no chance flag -> availability=1.0
    result = _compute_player_xmins(_element(element_type=1, starts=2, minutes=180), _summary(history), 10)
    assert result['start_prob'] == round((2 + 0.90 * 2) / 12, 4), f"GK: got {result['start_prob']}"

    # DEF (element_type=2) -> prior 0.75
    result = _compute_player_xmins(_element(element_type=2, starts=2, minutes=180), _summary(history), 10)
    assert result['start_prob'] == round((2 + 0.75 * 2) / 12, 4), f"DEF: got {result['start_prob']}"

    # MID (element_type=3) -> prior 0.65
    result = _compute_player_xmins(_element(element_type=3, starts=2, minutes=180), _summary(history), 10)
    assert result['start_prob'] == round((2 + 0.65 * 2) / 12, 4), f"MID: got {result['start_prob']}"

    # FWD (element_type=4) -> prior 0.60
    result = _compute_player_xmins(_element(element_type=4, starts=2, minutes=180), _summary(history), 10)
    assert result['start_prob'] == round((2 + 0.60 * 2) / 12, 4), f"FWD: got {result['start_prob']}"


def test_starts_field_used_exclusively():
    """History entries with starts=0 and minutes=70 do NOT count as starts (D-05.3 proxy removed)."""
    # 2 entries with starts=1, 8 with starts=0 but minutes=70 (would have counted with old proxy)
    history = [_hist(90, 1)] * 2 + [_hist(70, 0)] * 8
    # Only 2 starts qualify -> falls into position-prior branch (< 3 starts)
    result = _compute_player_xmins(_element(element_type=3, starts=2, minutes=250), _summary(history), 10)
    # Only the 2 real starts count. If the minutes>60 proxy were still active
    # there would be 10 starts and start_prob would be ~1.0, not the blended
    # 2-of-10 value below (STALE-01 changed the number, not this contract).
    assert result['start_prob'] == round((2 + 0.65 * 2) / 12, 4), (
        f"Expected blended 2-of-10 value but got {result['start_prob']} — minutes>60 proxy still active?"
    )


def test_window_alignment_10_games():
    """15 history entries — start_prob and mins_60_prob computed on recent[-10:] only."""
    # First 5: starts=1, minutes=90 (outside recent[-10:] window)
    # Last 10: starts=1, minutes=30 (within recent[-10:] window)
    history = [_hist(90, 1)] * 5 + [_hist(30, 1)] * 10
    result = _compute_player_xmins(_element(starts=15, minutes=1200), _summary(history), 15)
    # recent[-10:] = 10 entries all with starts=1, minutes=30
    assert result['start_prob'] == round(10 / 10 * 1.0, 4), f"Expected start_prob=1.0, got {result['start_prob']}"
    assert result['mins_60_prob'] == round(0 / 10, 4), f"Expected mins_60_prob=0.0, got {result['mins_60_prob']}"


def test_mins_60_prob_denominator_conditioned_on_starts():
    """mins_60_prob denominator is count(starts==1), not total entries."""
    # 5 starts: 4 with minutes=70 (>=60), 1 with minutes=30 (<60)
    # 5 non-starts: minutes=10
    history = [_hist(70, 1)] * 4 + [_hist(30, 1)] * 1 + [_hist(10, 0)] * 5
    result = _compute_player_xmins(_element(starts=5, minutes=430), _summary(history), 10)
    # mins_60_prob = 4/5 = 0.8 (conditioned on starts, not total 10 entries)
    assert result['mins_60_prob'] == round(4 / 5, 4), f"Expected 0.8, got {result['mins_60_prob']}"
    # start_prob = 5/10 = 0.5
    assert result['start_prob'] == round(5 / 10, 4), f"Expected 0.5, got {result['start_prob']}"


def test_mins_60_prob_zero_when_no_starts():
    """No starts in recent -> mins_60_prob == 0.0."""
    history = [_hist(70, 0)] * 10
    result = _compute_player_xmins(_element(starts=0, minutes=0), _summary(history), 10)
    assert result['mins_60_prob'] == 0.0, f"Expected 0.0, got {result['mins_60_prob']}"


def test_sub_risk_label_nailed():
    """start_prob>=0.90 AND mins_60_prob>=0.80 -> sub_risk_label='nailed'."""
    history = [_hist(90, 1)] * 10  # 10 starts, all >=80 min
    result = _compute_player_xmins(_element(starts=10, minutes=900), _summary(history), 10)
    assert result['start_prob'] == 1.0, f"Expected start_prob=1.0, got {result['start_prob']}"
    assert result['mins_60_prob'] == 1.0, f"Expected mins_60_prob=1.0, got {result['mins_60_prob']}"
    assert result['sub_risk_label'] == 'nailed', f"Expected 'nailed', got {result['sub_risk_label']}"


def test_sub_risk_label_sub_risk():
    """start_prob>=0.65 (but not nailed because mins_60_prob<0.80) -> sub_risk_label='sub_risk'."""
    # 7 starts all minutes=50 (below 60 -> mins_60_prob=0), 3 non-starts
    history = [_hist(50, 1)] * 7 + [_hist(0, 0)] * 3
    result = _compute_player_xmins(_element(starts=7, minutes=350), _summary(history), 10)
    assert result['start_prob'] == round(7 / 10, 4), f"Expected 0.7, got {result['start_prob']}"
    assert result['mins_60_prob'] == 0.0, f"Expected 0.0, got {result['mins_60_prob']}"
    assert result['sub_risk_label'] == 'sub_risk', f"Expected 'sub_risk', got {result['sub_risk_label']}"
    # mins_risk uses the different 0.65 threshold -> 'likely_start' (not 'sub_risk')
    assert result['mins_risk'] == 'likely_start', (
        f"mins_risk should be 'likely_start' (0.65 threshold), got {result['mins_risk']}"
    )


def test_sub_risk_label_cameo_low_avg_mins():
    """avg_mins_started<40 with start_prob in [0.25, 0.65) -> sub_risk_label='cameo'."""
    # 5 starts with minutes=35, 5 non-starts
    history = [_hist(35, 1)] * 5 + [_hist(0, 0)] * 5
    result = _compute_player_xmins(_element(starts=5, minutes=175), _summary(history), 10)
    assert result['start_prob'] == 0.5, f"Expected 0.5, got {result['start_prob']}"
    assert result['sub_risk_label'] == 'cameo', f"Expected 'cameo', got {result['sub_risk_label']}"


def test_sub_risk_label_cameo_low_start_prob():
    """start_prob<0.25 -> sub_risk_label='cameo' (even if avg_mins_started is reasonable)."""
    # 2 starts (triggers position-prior fallback), element_type=4 (FWD prior=0.60)
    # chance=20 -> availability=0.20 -> start_prob = 0.60 * 0.20 = 0.12
    history = [_hist(80, 1)] * 2 + [_hist(0, 0)] * 8
    result = _compute_player_xmins(
        _element(element_type=4, starts=2, minutes=160, chance=20),
        _summary(history),
        10,
    )
    expected = round(((2 + 0.60 * 2) / 12) * 0.20, 4)
    assert result['start_prob'] == expected, f"Expected {expected}, got {result['start_prob']}"
    assert result['sub_risk_label'] == 'cameo', f"Expected 'cameo', got {result['sub_risk_label']}"


def test_sub_risk_label_injured_status():
    """status='i' -> sub_risk_label='injured' regardless of probabilities."""
    history = [_hist(90, 1)] * 10
    result = _compute_player_xmins(
        _element(status='i', starts=10, minutes=900),
        _summary(history),
        10,
    )
    assert result['sub_risk_label'] == 'injured', f"Expected 'injured', got {result['sub_risk_label']}"


def test_sub_risk_label_injured_news():
    """status='a' but news present -> sub_risk_label='injured'."""
    history = [_hist(90, 1)] * 10
    result = _compute_player_xmins(
        _element(status='a', news='Knock - 75% chance', starts=10, minutes=900),
        _summary(history),
        10,
    )
    assert result['sub_risk_label'] == 'injured', f"Expected 'injured', got {result['sub_risk_label']}"


def test_sub_risk_label_rotation_risk():
    """start_prob in [0.25, 0.65) and avg_mins_started>=40 -> sub_risk_label='rotation_risk'."""
    # 4 starts in 10 games, all minutes=80 (so mins_60_prob=1.0, avg=80)
    # start_prob = 4/10 = 0.4 (in [0.25, 0.65) range)
    history = [_hist(80, 1)] * 4 + [_hist(0, 0)] * 6
    result = _compute_player_xmins(_element(starts=4, minutes=320), _summary(history), 10)
    assert result['start_prob'] == round(4 / 10, 4), f"Expected 0.4, got {result['start_prob']}"
    assert result['mins_60_prob'] == 1.0, f"Expected 1.0, got {result['mins_60_prob']}"
    assert result['sub_risk_label'] == 'rotation_risk', f"Expected 'rotation_risk', got {result['sub_risk_label']}"


def test_mins_risk_unchanged():
    """Verify mins_risk thresholds are preserved; both fields co-exist with distinct values."""
    # 8 starts with minutes=50 (mins_60_prob=0), 2 non-starts
    # start_prob = 8/10 = 0.8 -> mins_risk='likely_start' (0.65 threshold, below 0.85 nailed)
    history = [_hist(50, 1)] * 8 + [_hist(0, 0)] * 2
    result = _compute_player_xmins(_element(starts=8, minutes=400), _summary(history), 10)
    assert result['start_prob'] == round(8 / 10, 4), f"Expected 0.8, got {result['start_prob']}"
    # mins_risk uses the existing 0.65 threshold
    assert result['mins_risk'] == 'likely_start', (
        f"mins_risk should be 'likely_start' (existing threshold), got {result['mins_risk']}"
    )
    # sub_risk_label is different — start_prob=0.8 >= 0.65 but mins_60_prob=0.0 < 0.80 -> 'sub_risk'
    assert result['sub_risk_label'] == 'sub_risk', (
        f"sub_risk_label should be 'sub_risk', got {result['sub_risk_label']}"
    )


# ---------------------------------------------------------------------------
# MIN-02: compute_rotation_risk and build_next_gw_team_fdr
# ---------------------------------------------------------------------------
from xmins import compute_rotation_risk, build_next_gw_team_fdr


def make_history(difficulties: list, minutes: list) -> list:
    """Build minimal history list from parallel difficulty/minutes lists."""
    return [
        {'difficulty': d, 'minutes': m, 'was_home': True, 'opponent_team': 1}
        for d, m in zip(difficulties, minutes)
    ]


class TestComputeRotationRisk:
    def test_high_risk_for_easy_fixtures_when_historically_rested(self):
        # Easy bucket avg=30, hard bucket avg=80 → overall avg=55
        # ratio = 30/55 ≈ 0.545 < 0.75 → high
        history = (
            make_history([1, 1, 1, 1, 1], [30, 30, 30, 30, 30]) +
            make_history([5, 5, 5, 5, 5], [80, 80, 80, 80, 80])
        )
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'high'
        assert result['rotation_factor'] == 0.75

    def test_low_risk_when_minutes_consistent_across_difficulty(self):
        # All difficulty=1, all 90 min → avg_bucket = avg_all = 90 → ratio=1.0 → low
        history = make_history([1] * 10, [90] * 10)
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'low'
        assert result['rotation_factor'] == 1.0

    def test_medium_risk_when_ratio_in_0_75_to_0_90(self):
        # Easy avg=70, hard avg=90 → overall avg=80
        # ratio = 70/80 = 0.875 → 0.75 ≤ ratio < 0.90 → medium
        history = (
            make_history([1, 1, 1, 1, 1], [70, 70, 70, 70, 70]) +
            make_history([5, 5, 5, 5, 5], [90, 90, 90, 90, 90])
        )
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'medium'
        assert result['rotation_factor'] == 0.87

    def test_fewer_than_5_total_games_returns_unknown(self):
        history = make_history([1, 1, 2], [90, 90, 90])  # only 3 games
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0

    def test_fewer_than_3_games_in_bucket_falls_back_to_unknown(self):
        # Only 2 easy fixtures — sparse bucket → unknown
        history = (
            make_history([1, 1], [30, 30]) +
            make_history([5, 5, 5, 5, 5], [90, 90, 90, 90, 90])
        )
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0

    def test_no_next_fixture_returns_unknown(self):
        history = make_history([1] * 10, [90] * 10)
        result = compute_rotation_risk(history, next_fixture_difficulty=None)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0

    def test_empty_history_returns_unknown(self):
        result = compute_rotation_risk([], next_fixture_difficulty=3)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0


class TestBuildNextGwTeamFdr:
    def test_returns_correct_difficulties_for_target_gw(self):
        fixtures = [
            {'event': 38, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 4},
            {'event': 38, 'team_h': 3, 'team_a': 4, 'team_h_difficulty': 2, 'team_a_difficulty': 5},
            {'event': 37, 'team_h': 5, 'team_a': 6, 'team_h_difficulty': 1, 'team_a_difficulty': 1},
        ]
        result = build_next_gw_team_fdr(fixtures, next_gw_id=38)
        assert result[1] == 3   # team 1 home difficulty
        assert result[2] == 4   # team 2 away difficulty
        assert result[3] == 2   # team 3 home difficulty
        assert result[4] == 5   # team 4 away difficulty
        assert 5 not in result  # GW37 not included
        assert 6 not in result  # GW37 not included

    def test_empty_fixtures_returns_empty_dict(self):
        assert build_next_gw_team_fdr([], next_gw_id=38) == {}

    def test_no_fixtures_for_target_gw_returns_empty_dict(self):
        fixtures = [
            {'event': 37, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 4},
        ]
        assert build_next_gw_team_fdr(fixtures, next_gw_id=38) == {}

    def test_dgw_team_second_fixture_difficulty_wins(self):
        # Team 1 has two fixtures in GW38 — last one processed wins
        fixtures = [
            {'event': 38, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 2, 'team_a_difficulty': 4},
            {'event': 38, 'team_h': 3, 'team_a': 1, 'team_h_difficulty': 5, 'team_a_difficulty': 3},
        ]
        result = build_next_gw_team_fdr(fixtures, next_gw_id=38)
        # Team 1 appears as away in the second fixture → away_diff=3 wins
        assert result[1] == 3


# ---------------------------------------------------------------------------
# MIN-02: Integration tests — xmins_adjusted, rotation_risk, availability_risk
# ---------------------------------------------------------------------------
from xmins import compute_xmins_stats


def _make_bootstrap_element(player_id=1, team=1, status='a', chance=None, news=''):
    return {
        'id': player_id,
        'team': team,
        'element_type': 3,
        'status': status,
        'news': news,
        'chance_of_playing_next_round': chance,
        'starts': 10,
        'minutes': 800,
    }


def _make_bootstrap(elements):
    return {'elements': elements}


def test_xmins_adjusted_equals_xmins_times_both_factors():
    """xmins_adjusted = xmins_base * rotation_factor * availability_factor."""
    # 3 easy games at 30 min, 7 hard games at 90 min
    # Easy avg=30, overall avg=(30*3 + 90*7)/10=72 → ratio=30/72≈0.417 < 0.75 → high rotation risk
    history_data = make_history([1, 1, 1, 5, 5, 5, 5, 5, 5, 5], [30, 30, 30, 90, 90, 90, 90, 90, 90, 90])
    summaries = {1: {'history': history_data}}
    bootstrap = _make_bootstrap([_make_bootstrap_element(player_id=1, team=1)])
    # next GW fixture has difficulty=1 (easy) for team 1 → high rotation risk
    fixtures = [
        {'event': 38, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 1, 'team_a_difficulty': 3},
    ]
    result = compute_xmins_stats(bootstrap, summaries, finished_gws=10, fixtures=fixtures, next_gw_id=38)
    player = result[1]
    # rotation_factor=0.75 (high risk), availability_factor=1.0 (status='a', no chance, no news)
    expected_adjusted = round(player['xmins'] * player['difficulty_rotation_factor'] * 1.0, 1)
    assert player['xmins_adjusted'] == expected_adjusted
    assert player['difficulty_rotation_risk'] == 'high'
    assert player['difficulty_rotation_factor'] == 0.75  # high risk factor
    assert player['availability_risk'] == 'unknown'


def test_availability_factor_zero_gives_zero_xmins_adjusted():
    """An injured player (status='i') has xmins_adjusted=0 regardless of rotation."""
    history_data = make_history([3] * 10, [90] * 10)
    summaries = {1: {'history': history_data}}
    bootstrap = _make_bootstrap([_make_bootstrap_element(player_id=1, status='i')])
    result = compute_xmins_stats(bootstrap, summaries, finished_gws=10)
    player = result[1]
    assert player['xmins_adjusted'] == 0.0
    assert player['availability_risk'] == 'out'


def test_no_fixtures_passed_gives_unknown_rotation_risk():
    """When fixtures/next_gw_id are not provided, rotation_risk defaults to unknown."""
    summaries = {1: {'history': make_history([1] * 10, [90] * 10)}}
    bootstrap = _make_bootstrap([_make_bootstrap_element(player_id=1)])
    result = compute_xmins_stats(bootstrap, summaries, finished_gws=10)
    assert result[1]['difficulty_rotation_risk'] == 'unknown'
    assert result[1]['difficulty_rotation_factor'] == 1.0


# ── APM-01: sub_appear_prob tests ─────────────────────────────────────────────

def test_sub_appear_prob_in_return_dict():
    """APM-01: _compute_player_xmins must return 'sub_appear_prob' key."""
    history = [_hist(90, 1)] * 10
    result = _compute_player_xmins(_element(), _summary(history), 10)
    assert 'sub_appear_prob' in result


def test_sub_appear_prob_consistent_sub():
    """APM-01: player with 3 sub appearances in 15 entries → sub_appear_prob = 3/15 = 0.2."""
    # 12 full starts + 3 sub appearances (0 < minutes < 45)
    history = [_hist(90, 1)] * 12 + [_hist(30, 0)] * 3
    result = _compute_player_xmins(_element(starts=12, minutes=1080), _summary(history), 15,
                                    sub_appear_window_gws=15)
    assert abs(result['sub_appear_prob'] - round(3/15, 4)) < 1e-4


def test_sub_appear_prob_full_starters():
    """APM-01: player whose all entries are >= 45 minutes → sub_appear_prob == 0.0."""
    history = [_hist(90, 1)] * 15
    result = _compute_player_xmins(_element(starts=15, minutes=1350), _summary(history), 15,
                                    sub_appear_window_gws=15)
    assert result['sub_appear_prob'] == 0.0


def test_sub_appear_prob_sparse_history():
    """APM-01: player with only 5 history entries, window=15 → denominator = 5 (actual entries)."""
    # 3 full starts + 2 sub appearances in only 5 entries total
    history = [_hist(90, 1)] * 3 + [_hist(25, 0)] * 2
    result = _compute_player_xmins(_element(starts=3, minutes=270), _summary(history), 5,
                                    sub_appear_window_gws=15)
    assert abs(result['sub_appear_prob'] - round(2/5, 4)) < 1e-4


def test_sub_appear_prob_dgw_counts_two():
    """APM-01: window containing two sub-appearance entries (e.g. from same DGW) counts both."""
    # 10 full starts + 2 sub-appearance entries
    history = [_hist(90, 1)] * 10 + [_hist(20, 0), _hist(30, 0)]
    result = _compute_player_xmins(_element(starts=10, minutes=900), _summary(history), 12,
                                    sub_appear_window_gws=12)
    assert abs(result['sub_appear_prob'] - round(2/12, 4)) < 1e-4


# ── COLD-01: prior start seed tests ──────────────────────────────────────────

def test_cold_player_with_prior_start_uses_prior_start_rate():
    """COLD-01 + STALE-01: cold player blends prior_start with observed starts."""
    from xmins import _compute_player_xmins
    prior_start = {'start_rate': 0.88, 'mins_per_start': 85.0}
    # 2 starts in recent → position-prior branch normally; prior should override
    history = [_hist(90, 1)] * 2 + [_hist(0, 0)] * 8
    result = _compute_player_xmins(
        _element(element_type=3, starts=2, minutes=180),
        _summary(history),
        10,
        prior_start=prior_start,
    )
    # 2 starts of 10 observed, prior 0.88 worth 2 pseudo-games.
    expected = round((2 + 0.88 * 2) / 12, 4)
    assert result['start_prob'] == expected, (
        f"Expected blended start_prob={expected}, got {result['start_prob']}"
    )


def test_cold_player_with_prior_start_seeds_avg_mins():
    """COLD-01: when avg_mins_started=0 in cold branch, prior seeds it → xmins > 0."""
    from xmins import _compute_player_xmins
    prior_start = {'start_rate': 0.80, 'mins_per_start': 80.0}
    # 0 starts in recent history → avg_mins_started=0.0 normally
    history = [_hist(0, 0)] * 10
    result = _compute_player_xmins(
        _element(element_type=3, starts=0, minutes=0),
        _summary(history),
        10,
        prior_start=prior_start,
    )
    # xmins = avg_mins_started * start_prob; both seeded from prior → xmins > 0
    assert result['xmins'] > 0, f"Expected xmins > 0 (seeded from prior), got {result['xmins']}"


def test_cold_player_without_prior_start_uses_position_prior():
    """COLD-01 + STALE-01: with no prior_start the POSITION_PRIOR is blended in."""
    from xmins import _compute_player_xmins, POSITION_PRIOR
    history = [_hist(90, 1)] * 2 + [_hist(0, 0)] * 8
    result = _compute_player_xmins(
        _element(element_type=3, starts=2, minutes=180),
        _summary(history),
        10,
        prior_start=None,
    )
    expected = round((2 + POSITION_PRIOR[3] * 2) / 12, 4)
    assert result['start_prob'] == expected, (
        f"Expected blended POSITION_PRIOR start_prob={expected}, got {result['start_prob']}"
    )


def test_warm_player_start_probe_unchanged_by_prior():
    """COLD-01: player with starts>=3 → existing path unchanged regardless of prior_start."""
    from xmins import _compute_player_xmins
    prior_start = {'start_rate': 0.1, 'mins_per_start': 10.0}  # very different from actual
    # 5 starts in recent history → sufficient → should use actual start rate
    history = [_hist(90, 1)] * 5 + [_hist(0, 0)] * 5
    result_with_prior = _compute_player_xmins(
        _element(element_type=3, starts=5, minutes=450),
        _summary(history),
        10,
        prior_start=prior_start,
    )
    result_no_prior = _compute_player_xmins(
        _element(element_type=3, starts=5, minutes=450),
        _summary(history),
        10,
        prior_start=None,
    )
    assert result_with_prior['start_prob'] == result_no_prior['start_prob'], (
        f"Warm player must not be affected by prior_start. "
        f"with={result_with_prior['start_prob']}, without={result_no_prior['start_prob']}"
    )


def test_cold_bootstrap_branch_with_prior_start():
    """COLD-01: bootstrap-only cold path (no summary) with prior_start → prior seeds start_prob."""
    from xmins import _compute_player_xmins
    prior_start = {'start_rate': 0.75, 'mins_per_start': 80.0}
    # No summary, starts=0 → bootstrap branch, starts<3
    result = _compute_player_xmins(
        _element(element_type=2, starts=0, minutes=0),
        None,  # no summary
        10,
        prior_start=prior_start,
    )
    expected = round(0.75 * 1.0, 4)
    assert result['start_prob'] == expected, (
        f"Expected prior start_prob={expected} in bootstrap cold branch, got {result['start_prob']}"
    )


# ── AVAIL-01: injury_lookup threading tests ───────────────────────────────────

def test_injury_lookup_gates_gap_bucket_player():
    # status 'a', no chance, no news -> normally 'unknown'/factor 1.0.
    # With an injury record for this element id, it becomes 'out'.
    element = {'id': 4242, 'element_type': 3, 'status': 'a',
               'chance_of_playing_next_round': None, 'news': ''}
    summary = {'history': [
        {'round': r, 'minutes': 90, 'starts': 1, 'total_points': 3} for r in range(1, 6)
    ]}
    result = _compute_player_xmins(
        element, summary, 10, next_fixture_difficulty=3,
        injury_lookup={4242: {'risk': 'out', 'reason': 'knee'}})
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0
    assert result['xmins_adjusted'] == 0.0


def test_injury_lookup_absent_is_noop():
    element = {'id': 4242, 'element_type': 3, 'status': 'a',
               'chance_of_playing_next_round': None, 'news': ''}
    summary = {'history': [
        {'round': r, 'minutes': 90, 'starts': 1, 'total_points': 3} for r in range(1, 6)
    ]}
    result = _compute_player_xmins(element, summary, 10, next_fixture_difficulty=3,
                                   injury_lookup=None)
    assert result['availability_risk'] == 'unknown'


def test_injury_lookup_gates_positive_xmins_to_zero():
    # Real start history -> base xmins > 0. status 'a', chance None -> gap bucket.
    # An 'out' injury must multiply xmins_adjusted through to 0.0 (proves the factor
    # applies, vs the gap-bucket test above where base xmins is 0 anyway).
    history = [_hist(90, 1)] * 10
    element = _element(element_type=3, starts=10, minutes=900)  # id=1, status='a', chance=None
    result = _compute_player_xmins(
        element, _summary(history), 10, next_fixture_difficulty=3,
        injury_lookup={1: {'risk': 'out', 'reason': 'knee'}})
    assert result['xmins'] > 0                      # base is positive (guards trivial pass)
    assert result['availability_factor'] == 0.0
    assert result['xmins_adjusted'] == 0.0          # factor applied through
