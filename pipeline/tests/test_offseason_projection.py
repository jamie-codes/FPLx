"""Off-season projection mode: merge/xmins off_season flag + run wiring."""
import pytest
from merge import merge_players
from xmins import _compute_player_xmins


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


def test_offseason_no_prior_zeroes_per90():
    """Guard (merge.py: `if off_season and prior is None`) must zero xg/xa_per90
    for a player with no code-match AND no bucket-match prior — not leak the
    player's high current-season residual per-90 into an off-season projection.
    """
    # code=999 is absent from both prior_lookup and bucket_priors below, so
    # prior_for() falls through to None. _element's defaults (minutes=2953,
    # goals_scored=20, expected_goals='18.0') yield a high residual per-90
    # via the DQ-01 Layer-2 goals/minutes fallback (no expected_goals_per_90
    # field set, so Layer 1 is skipped).
    el = _element(2, code=999)
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    id_map = {'2': {'understat_id': None}}
    xmins = {2: {'xmins': 80.0, 'start_prob': 0.9, 'mins_risk': 'nailed'}}
    common = dict(
        xmins_stats=xmins, summaries=None,
        prior_lookup={}, bucket_priors={},  # empty -> prior_for() returns None for any code/bucket
    )

    on, _ = merge_players(bs, fx, {}, id_map, off_season=True, **common)
    off, _ = merge_players(bs, fx, {}, id_map, off_season=False, **common)
    p_on = next(p for p in on if p['id'] == 2)
    p_off = next(p for p in off if p['id'] == 2)

    # Guard fires: no prior -> zeroed per-90, not the high residual.
    assert p_on['xg_per90'] == 0.0
    assert p_on['xa_per90'] == 0.0

    # Proves it's the off_season guard doing the zeroing, not something else:
    # with the flag off, the same inputs retain the (high) residual per-90.
    assert p_off['xg_per90'] > 0.0


def test_offseason_established_not_zeroed():
    """Residual starts>=3 + finished_gws=0 must NOT zero xmins in off_season mode."""
    el = _element(1, code=100, minutes=2953, starts=34)
    prior_start = {'start_rate': 0.9, 'mins_per_start': 85}
    r = _compute_player_xmins(el, None, finished_gws=0, prior_start=prior_start, off_season=True)
    assert r['start_prob'] > 0.5
    assert r['xmins'] > 50
    # Document the in-season bug this fixes: same inputs, off_season=False -> collapses to 0
    r_bug = _compute_player_xmins(el, None, finished_gws=0, prior_start=prior_start, off_season=False)
    assert r_bug['xmins'] == 0.0


def test_offseason_no_prior_uses_price_band():
    """No prior: premium price band gets higher start_prob/xmins than budget."""
    prem = _element(2, code=0, now_cost=95, minutes=0, starts=0)
    budg = _element(3, code=0, now_cost=45, minutes=0, starts=0)
    rp = _compute_player_xmins(prem, None, 0, prior_start=None, off_season=True)
    rb = _compute_player_xmins(budg, None, 0, prior_start=None, off_season=True)
    assert rp['start_prob'] > rb['start_prob']
    assert rp['xmins'] > rb['xmins']


def test_offseason_nailed_starter_gets_nailed_sub_risk_label():
    """OFFSEASON-01 fix: a nailed prior (start_rate=0.9, mins_per_start=85) must derive
    mins_60_prob from expected minutes-per-start, not hardcode 0.0 — otherwise
    sub_risk_label ('sub_risk') contradicts mins_risk ('nailed') for the same player.
    """
    el = _element(1, code=100, minutes=2953, starts=34)
    prior_start = {'start_rate': 0.9, 'mins_per_start': 85}
    r = _compute_player_xmins(el, None, finished_gws=0, prior_start=prior_start, off_season=True)
    assert r['mins_risk'] == 'nailed'
    assert r['sub_risk_label'] == 'nailed'

    # Low-minutes fringe player must NOT read 'nailed' for sub_risk_label.
    el_fringe = _element(4, code=101, minutes=2953, starts=34)
    prior_fringe = {'start_rate': 0.9, 'mins_per_start': 50}
    r_fringe = _compute_player_xmins(
        el_fringe, None, finished_gws=0, prior_start=prior_fringe, off_season=True
    )
    assert r_fringe['sub_risk_label'] != 'nailed'


def test_offseason_merge_produces_nonzero_xpts():
    from run import _offseason_merge
    el = _element(1, code=100, minutes=2953, starts=34)  # now_cost 70 -> band 1
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    prior = {100: {'xg_per90': 0.5, 'xa_per90': 0.1, 'total_minutes': 3000,
                   'start_rate': 0.9, 'mins_per_start': 85}}
    buckets = {(3, 1): {'xg_per90': 0.15, 'xa_per90': 0.05}}
    start_seed = {100: {'start_rate': 0.9, 'mins_per_start': 85}}
    id_map = {'1': {'understat_id': None}}

    merged, caps = _offseason_merge(bs, fx, id_map, prior, buckets, start_seed)
    p = next(p for p in merged if p['id'] == 1)
    assert p['xPts_5gw'] > 0
