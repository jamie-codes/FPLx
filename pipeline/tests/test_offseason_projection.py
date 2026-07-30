"""Off-season projection mode: merge/xmins off_season flag + run wiring."""
import pytest
from merge import merge_players


def _offseason_bootstrap(elements):
    return {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV', 'code': 14},
            {'id': 1, 'short_name': 'ARS', 'code': 3},
        ],
        # off-season: NO event has is_current
        'events': [
            {'id': i, 'finished': False, 'is_current': False, 'is_next': (i == 1),
             'deadline_time': '2026-08-21T17:30:00Z'}
            for i in range(1, 39)
        ],
    }


def _fixtures():
    return [
        {'event': gw, 'team_h': 14, 'team_a': 1,
         'team_h_difficulty': 3, 'team_a_difficulty': 3, 'finished': False}
        for gw in range(1, 6)
    ]


def _element(pid, code, now_cost=70, minutes=2953, starts=34, element_type=3):
    return {
        'id': pid, 'code': code, 'web_name': f'P{pid}', 'element_type': element_type,
        'team': 14, 'now_cost': now_cost, 'selected_by_percent': '5.0', 'form': '0',
        'status': 'a', 'minutes': minutes, 'starts': starts, 'total_points': 150,
        'goals_scored': 20, 'assists': 5, 'expected_goals': '18.0', 'expected_assists': '4.0',
        'cost_change_event': 0, 'cost_change_start': 0, 'penalties_text': '',
        'direct_freekicks_text': '', 'corners_and_indirect_freekicks_text': '', 'news': '',
        'defensive_contribution': None, 'clearances_blocks_interceptions': None,
        'direct_freekicks_order': None, 'penalties_order': None,
        'corners_and_indirect_freekicks_order': None, 'chance_of_playing_next_round': None,
    }


def test_offseason_forces_pure_prior_per90():
    """off_season=True must use the modest prior per-90 (w=0), not the high residual."""
    el = _element(1, code=100, minutes=2953, starts=34)  # residual per90 ~0.55
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    prior = {100: {'xg_per90': 0.20, 'xa_per90': 0.05, 'total_minutes': 3000,
                   'start_rate': 0.9, 'mins_per_start': 85}}
    buckets = {(3, 1): {'xg_per90': 0.15, 'xa_per90': 0.05}}
    id_map = {'1': {'understat_id': None}}
    xmins = {1: {'xmins': 80.0, 'start_prob': 0.9, 'mins_risk': 'nailed'}}
    common = dict(xmins_stats=xmins, summaries=None, prior_lookup=prior, bucket_priors=buckets)

    on, _ = merge_players(bs, fx, {}, id_map, off_season=True, **common)
    off, _ = merge_players(bs, fx, {}, id_map, off_season=False, **common)
    p_on = next(p for p in on if p['id'] == 1)
    p_off = next(p for p in off if p['id'] == 1)

    assert p_on['xPts_5gw'] > 0
    assert p_on['xPts_5gw'] < p_off['xPts_5gw']  # pure prior 0.20 < residual ~0.55


def test_offseason_flag_off_is_noop():
    """Default off_season=False must match not passing the flag at all."""
    el = _element(1, code=100, minutes=2953, starts=34)
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    prior = {100: {'xg_per90': 0.20, 'xa_per90': 0.05, 'total_minutes': 3000,
                   'start_rate': 0.9, 'mins_per_start': 85}}
    buckets = {(3, 1): {'xg_per90': 0.15, 'xa_per90': 0.05}}
    id_map = {'1': {'understat_id': None}}
    xmins = {1: {'xmins': 80.0, 'start_prob': 0.9, 'mins_risk': 'nailed'}}
    common = dict(xmins_stats=xmins, summaries=None, prior_lookup=prior, bucket_priors=buckets)

    a, _ = merge_players(bs, fx, {}, id_map, **common)
    b, _ = merge_players(bs, fx, {}, id_map, off_season=False, **common)
    pa = next(p for p in a if p['id'] == 1)
    pb = next(p for p in b if p['id'] == 1)
    assert pa['xPts_5gw'] == pb['xPts_5gw']
