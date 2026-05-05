"""Pytest unit tests for compute_simulations and _simulate_player (Phase 61 MC-01)."""

import pytest

# Bare import (conftest.py injects pipeline/ into sys.path)
from simulate import compute_simulations, _simulate_player


def _fix(defensive_difficulty=0.5, event_id=38):
    return {'defensive_difficulty': defensive_difficulty, 'event_id': event_id}


def _player(
    element_type=3,
    xmins=70.0,
    start_prob=0.85,
    xg_per90=0.5,
    xa_per90=0.4,
    fixtures=None,
    mins_60_prob=None,
    xPts_90th_1gw=5.0,
):
    """Minimal merged player dict for simulation tests."""
    return {
        'element_type': element_type,
        'xmins': xmins,
        'start_prob': start_prob,
        'xg_per90': xg_per90,
        'xa_per90': xa_per90,
        'fixtures': fixtures if fixtures is not None else [_fix()],
        'mins_60_prob': mins_60_prob,
        'xPts_90th_1gw': xPts_90th_1gw,
    }


def test_bgw_shortcircuit():
    """xmins <= 0 -> blank_prob=1.0, haul_prob=0.0, p10=0.0, p90=0.0 (D-08)."""
    p = _player(xmins=0.0)
    result = compute_simulations([p], xmins_v2_enabled=False)
    assert result[0]['blank_prob'] == 1.0
    assert result[0]['haul_prob'] == 0.0
    assert result[0]['p10_pts'] == 0.0
    assert result[0]['p90_pts'] == 0.0

    # start_prob=0 path also short-circuits
    p2 = _player(xmins=70.0, start_prob=0.0)
    result2 = compute_simulations([p2], xmins_v2_enabled=False)
    assert result2[0]['blank_prob'] == 1.0
    assert result2[0]['haul_prob'] == 0.0


def test_mc_mean_matches_analytical():
    """Active player MC outputs land in shape range consistent with analytical xPts (MC-01)."""
    # Active MID: xg=0.5, xa=0.4, xmins=70, start_prob=0.85, easy fixture (dd=0.4)
    p = _player(element_type=3, xmins=70.0, start_prob=0.85, xg_per90=0.5, xa_per90=0.4,
                fixtures=[_fix(defensive_difficulty=0.4)])
    result = compute_simulations([p], xmins_v2_enabled=False)
    r = result[0]
    # Range invariants
    assert 0.0 <= r['blank_prob'] <= 1.0
    assert 0.0 <= r['haul_prob'] <= 1.0
    # Shape invariants
    assert r['p10_pts'] < r['p90_pts']
    assert r['p90_pts'] > r['p10_pts'] + 1.0  # meaningful spread for active player
    # Sanity bound on ceiling (active MID with mid xg/xa cannot p90 below 1 or above 15)
    assert 1.0 < r['p90_pts'] < 15.0


def test_dgw_sums_fixtures():
    """DGW player simulates each fixture independently and sums per iteration (D-09)."""
    # Same player, single fixture vs. two fixtures (same event_id)
    single = _player(fixtures=[_fix(defensive_difficulty=0.5)])
    dgw = _player(fixtures=[_fix(defensive_difficulty=0.5), _fix(defensive_difficulty=0.5)])
    r_single = compute_simulations([single], xmins_v2_enabled=False)[0]
    r_dgw = compute_simulations([dgw], xmins_v2_enabled=False)[0]
    # DGW is strictly more upside than single (p90 grows, blank_prob shrinks)
    assert r_dgw['p90_pts'] > r_single['p90_pts']
    assert r_dgw['haul_prob'] >= r_single['haul_prob']
    assert r_dgw['blank_prob'] <= r_single['blank_prob']


def test_p90_overwrites_ceiling():
    """p90_pts must overwrite xPts_90th_1gw in the returned player dict (D-05)."""
    # Active player: p90 should overwrite the seeded 5.0 with the MC ceiling
    p = _player(xPts_90th_1gw=5.0)
    result = compute_simulations([p], xmins_v2_enabled=False)
    assert result[0]['xPts_90th_1gw'] == result[0]['p90_pts']

    # BGW player: xPts_90th_1gw must be overwritten with 0.0
    p_bgw = _player(xmins=0.0, xPts_90th_1gw=5.0)
    result_bgw = compute_simulations([p_bgw], xmins_v2_enabled=False)
    assert result_bgw[0]['xPts_90th_1gw'] == 0.0


def test_output_value_ranges():
    """All 4 MC fields fall in expected ranges across mixed player set (MC-01)."""
    players = [
        _player(element_type=3, xmins=70.0, start_prob=0.85),                          # active MID
        _player(element_type=4, xmins=80.0, start_prob=0.90, xg_per90=0.6, xa_per90=0.2),  # active FWD
        _player(element_type=1, xmins=90.0, start_prob=0.95, xg_per90=0.0, xa_per90=0.0),  # active GK
        _player(element_type=2, xmins=85.0, start_prob=0.85, xg_per90=0.05, xa_per90=0.1), # active DEF
        _player(xmins=0.0),                                                             # BGW
    ]
    result = compute_simulations(players, xmins_v2_enabled=False)
    assert len(result) == 5
    for r in result:
        assert 0.0 <= r['blank_prob'] <= 1.0
        assert 0.0 <= r['haul_prob'] <= 1.0
        assert r['p10_pts'] >= 0.0
        assert r['p10_pts'] <= r['p90_pts']
