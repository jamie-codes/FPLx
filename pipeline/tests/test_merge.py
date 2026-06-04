"""Unit tests for pipeline/merge.py form-signal field write and blend integration (Phase 42, ACC-01).

Wave 0 RED — these will fail until Task 3 wires the form signal write
and Task 4 wires the blend into _xpts_ngw inputs.
"""

import pytest
from merge import merge_players, _cs_prob, _compute_xpts_fixture, _cs_prob_1gw_for_fixtures


class TestCsProbKwargs:
    def test_default_values_unchanged(self):
        """Default call must produce same result as before — backward compat."""
        result = _cs_prob(0.5, 60.0)
        # cs_prob_raw = max(0.10, min(0.65, 0.40 - 0.5*0.30)) = 0.25; mins_factor = 1.0
        assert abs(result - 0.25) < 1e-9

    def test_custom_base_raises_cs_prob(self):
        """Higher cs_prob_base → higher cs_prob output."""
        default = _cs_prob(0.0, 90.0)
        custom  = _cs_prob(0.0, 90.0, cs_prob_base=0.55)
        assert custom > default

    def test_custom_slope_changes_sensitivity(self):
        """Lower cs_prob_slope → less sensitive to difficulty."""
        low_slope  = _cs_prob(1.0, 90.0, cs_prob_slope=0.15)
        high_slope = _cs_prob(1.0, 90.0, cs_prob_slope=0.40)
        assert low_slope > high_slope

    def test_clamp_still_applies_with_custom_params(self):
        """Result must stay in [0.10, 0.65] regardless of params."""
        result = _cs_prob(1.0, 90.0, cs_prob_base=0.10, cs_prob_slope=0.40)
        assert result >= 0.10

    def test_compute_xpts_fixture_forwards_cs_prob_kwargs(self):
        """Different cs_prob_base values must produce different cs_pts."""
        low  = _compute_xpts_fixture(0.2, 0.1, 1.0, 90.0, 2, 0.5, cs_prob_base=0.25)
        high = _compute_xpts_fixture(0.2, 0.1, 1.0, 90.0, 2, 0.5, cs_prob_base=0.55)
        assert high['cs_pts'] > low['cs_pts']

    def test_compute_xpts_fixture_default_unchanged(self):
        """Calling without kwargs must produce identical result to before."""
        result = _compute_xpts_fixture(0.3, 0.1, 1.0, 90.0, 3, 0.4)
        assert result['total'] > 0  # sanity; exact value comes from existing tests

    def test_cs_prob_1gw_for_fixtures_forwards_kwargs(self):
        """cs_prob_1gw_for_fixtures must forward cs_prob_base/slope to _cs_prob."""
        # Build a minimal fixtures list: one GW, one fixture
        fixtures = [{'event_id': 1, 'defensive_difficulty': 0.0}]
        lo = _cs_prob_1gw_for_fixtures(fixtures, 90.0, cs_prob_base=0.25)
        hi = _cs_prob_1gw_for_fixtures(fixtures, 90.0, cs_prob_base=0.55)
        assert hi > lo


def _hist(round_, minutes, total_points, xg=0.0, xa=0.0):
    return {
        'round': round_,
        'minutes': minutes,
        'total_points': total_points,
        'expected_goals': xg,
        'expected_assists': xa,
        'goals_scored': 0,
        'assists': 0,
        'starts': 1 if minutes >= 45 else 0,
    }


def _build_minimal_inputs(player_history_by_id, finished_gws=10):
    """Build (bootstrap, fixtures, understat, id_map, xmins_stats, summaries)."""
    elements = []
    for pid in player_history_by_id:
        elements.append({
            'id': pid,
            'web_name': f'Player{pid}',
            'element_type': 3,
            'team': 14,
            'now_cost': 70,
            'selected_by_percent': '5.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': 5,
            'assists': 3,
            'expected_goals': '4.5',
            'expected_assists': '2.5',
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': None,
            'penalties_order': None,
            'corners_and_indirect_freekicks_order': None,
        })

    bootstrap = {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1, 'short_name': 'ARS'},
        ],
        'events': [{'id': i, 'finished': i <= finished_gws, 'is_current': False} for i in range(1, finished_gws + 6)],
    }
    # Mark the next unfinished event as current
    for ev in bootstrap['events']:
        if not ev['finished']:
            ev['is_current'] = True
            break

    fixtures = []
    for gw in range(1, finished_gws + 1):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': True,
            'team_h_score': 1, 'team_a_score': 1,
        })
    for gw in range(finished_gws + 1, finished_gws + 6):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': False,
        })

    understat = {}
    id_map = {str(pid): {'understat_id': None} for pid in player_history_by_id}
    xmins_stats = {pid: {'xmins': 90.0, 'start_prob': 1.0, 'mins_risk': 'safe'} for pid in player_history_by_id}
    summaries = {pid: {'history': hist} for pid, hist in player_history_by_id.items()}
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_merge_writes_form_signal():
    """ACC-01: merge_players writes form_xgxa_per90 and form_xgxa_window_gws on every player."""
    # Player 1: enough history for form signal (5 GWs, 90 min each, total 450 min > 270)
    history_full = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    # Player 2: insufficient history (only 2 GWs)
    history_short = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 3)]

    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({
        1: history_full, 2: history_short,
    })

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               xmins_stats=xmins_stats, summaries=summaries)
    p1 = next(p for p in merged if p['id'] == 1)
    p2 = next(p for p in merged if p['id'] == 2)

    assert 'form_xgxa_per90' in p1
    assert 'form_xgxa_window_gws' in p1
    assert p1['form_xgxa_per90'] is not None
    assert p1['form_xgxa_window_gws'] >= 3

    assert 'form_xgxa_per90' in p2
    assert 'form_xgxa_window_gws' in p2
    assert p2['form_xgxa_per90'] is None
    assert p2['form_xgxa_window_gws'] == 0


def _build_minimal_inputs_override(player_history_by_id, finished_gws=10,
                                    goals_scored=5, assists=3):
    """Variant of _build_minimal_inputs with configurable goals_scored/assists."""
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs(
        player_history_by_id, finished_gws=finished_gws
    )
    # Override goals_scored/assists for player 1 to control season per-90 rate
    for el in bootstrap['elements']:
        if el['id'] == 1:
            el['goals_scored'] = goals_scored
            el['assists'] = assists
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_blend_changes_xpts_when_enabled():
    """ACC-01: form_signal_enabled=True with hot form lifts xPts_1gw above the disabled baseline.

    Season per-90 (from goals_scored/assists): (1+0)/900*90 = 0.1 per 90 (cold player).
    Form per-90 (from last 5 GWs): only GW10 has xG=2.0+xA=1.0 => ~0.8 per 90 (hot form).
    Blend = (0.6)*0.1 + (0.4)*0.8 = 0.38 != 0.1, so xPts must change.
    """
    # 9 cold GWs (xG+xA = 0), 1 very hot GW
    history = [_hist(gw, 90, 6, xg=0.0, xa=0.0) for gw in range(1, 10)]
    history.append(_hist(10, 90, 6, xg=2.0, xa=1.0))

    # Use very low season goals/assists so season per-90 (0.1/90) != form per-90 (0.8/90)
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs_override(
        {1: history}, goals_scored=1, assists=0
    )

    merged_baseline, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                        xmins_stats=xmins_stats, summaries=summaries,
                                        form_signal_enabled=False)
    merged_blended, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                       xmins_stats=xmins_stats, summaries=summaries,
                                       form_signal_enabled=True)

    baseline_xpts = next(p['xPts_1gw'] for p in merged_baseline if p['id'] == 1)
    blended_xpts = next(p['xPts_1gw'] for p in merged_blended if p['id'] == 1)

    assert blended_xpts != baseline_xpts, \
        f"blend must change xPts when form differs from season; got baseline={baseline_xpts}, blended={blended_xpts}"


def test_blend_disabled_matches_baseline():
    """ACC-01: form_signal_enabled=False produces identical xPts_1gw to the pre-flag pipeline."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 11)]
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})

    # Default kwarg (no flag) and explicit False must produce the same numbers
    merged_default, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                       xmins_stats=xmins_stats, summaries=summaries)
    merged_explicit_false, _ = merge_players(bootstrap, fixtures, understat, id_map,
                                              xmins_stats=xmins_stats, summaries=summaries,
                                              form_signal_enabled=False)

    d_xpts = next(p['xPts_1gw'] for p in merged_default if p['id'] == 1)
    f_xpts = next(p['xPts_1gw'] for p in merged_explicit_false if p['id'] == 1)
    assert d_xpts == f_xpts, "default and explicit-False must produce identical xPts (default IS False)"


def _build_lookahead_inputs(n_future_fixtures: int):
    """Build minimal inputs with two teams and n_future_fixtures unfinished fixtures."""
    elements = [
        {
            'id': 1,
            'web_name': 'PlayerLIV',
            'element_type': 3,
            'team': 14,
            'now_cost': 70,
            'selected_by_percent': '5.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': 5,
            'assists': 3,
            'expected_goals': '4.5',
            'expected_assists': '2.5',
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': None,
            'penalties_order': None,
            'corners_and_indirect_freekicks_order': None,
        },
        {
            'id': 2,
            'web_name': 'PlayerARS',
            'element_type': 3,
            'team': 1,
            'now_cost': 80,
            'selected_by_percent': '8.0',
            'form': '0',
            'status': 'a',
            'minutes': 900,
            'starts': 10,
            'total_points': 60,
            'goals_scored': 5,
            'assists': 3,
            'expected_goals': '4.5',
            'expected_assists': '2.5',
            'cost_change_event': 0,
            'cost_change_start': 0,
            'penalties_text': '',
            'direct_freekicks_text': '',
            'corners_and_indirect_freekicks_text': '',
            'news': '',
            'defensive_contribution': None,
            'clearances_blocks_interceptions': None,
            'direct_freekicks_order': None,
            'penalties_order': None,
            'corners_and_indirect_freekicks_order': None,
        },
    ]

    bootstrap = {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1, 'short_name': 'ARS'},
        ],
        'events': [{'id': i, 'finished': False, 'is_current': i == 1} for i in range(1, n_future_fixtures + 2)],
    }

    fixtures = []
    for gw in range(1, n_future_fixtures + 1):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': False,
        })

    understat = {}
    id_map = {'1': {'understat_id': None}, '2': {'understat_id': None}}
    xmins_stats = {
        1: {'xmins': 90.0, 'start_prob': 1.0, 'mins_risk': 'safe'},
        2: {'xmins': 90.0, 'start_prob': 1.0, 'mins_risk': 'safe'},
    }
    summaries = {1: {'history': []}, 2: {'history': []}}
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_fixture_lookahead_caps_at_32():
    """Phase 75 HEAT-06: FIXTURE_LOOKAHEAD=32 — upcoming_fixtures capped at 32 per team."""
    # Build inputs with 40 unfinished fixtures — more than the 32 cap
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_lookahead_inputs(40)

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)

    # Each player has 'fixtures' (upcoming_fixtures list in player dict); check both teams
    liv_player = next(p for p in merged if p['id'] == 1)
    ars_player = next(p for p in merged if p['id'] == 2)

    assert len(liv_player['fixtures']) == 32, (
        f"Expected LIV fixtures capped at 32, got {len(liv_player['fixtures'])}"
    )
    assert len(ars_player['fixtures']) == 32, (
        f"Expected ARS fixtures capped at 32, got {len(ars_player['fixtures'])}"
    )


def test_fixture_lookahead_no_padding_below_32():
    """Phase 75 HEAT-06: upcoming fixtures not padded when fewer than 32 fixtures exist."""
    # Build inputs with only 10 unfinished fixtures
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_lookahead_inputs(10)

    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                              xmins_stats=xmins_stats, summaries=summaries)

    liv_player = next(p for p in merged if p['id'] == 1)
    assert len(liv_player['fixtures']) == 10, (
        f"Expected LIV fixtures=10, got {len(liv_player['fixtures'])}"
    )
