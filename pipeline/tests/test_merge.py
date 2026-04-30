"""Unit tests for pipeline/merge.py form-signal field write and blend integration (Phase 42, ACC-01).

Wave 0 RED — these will fail until Task 3 wires the form signal write
and Task 4 wires the blend into _xpts_ngw inputs.
"""

import pytest
from merge import merge_players


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


def test_blend_changes_xpts_when_enabled():
    """ACC-01: form_signal_enabled=True with hot form lifts xPts_1gw above the disabled baseline."""
    # 9 cold GWs (xG+xA = 0), 1 very hot GW
    history = [_hist(gw, 90, 6, xg=0.0, xa=0.0) for gw in range(1, 10)]
    history.append(_hist(10, 90, 6, xg=2.0, xa=1.0))

    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = _build_minimal_inputs({1: history})

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
