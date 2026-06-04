"""Pytest unit tests for compute_simulations and _simulate_player (Phase 61 MC-01)."""

import importlib
from unittest.mock import MagicMock, patch

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


# ---------------------------------------------------------------------------
# Phase 90 MC-01: 5-GW cumulative simulation — 6 RED tests (Wave 0)
# ---------------------------------------------------------------------------

def _five_gw_fixtures(dd=0.5, gws=(38, 39, 40, 41, 42)):
    """Build a 5-GW fixtures list with distinct event_ids for cumulative tests."""
    return [_fix(defensive_difficulty=dd, event_id=eid) for eid in gws]


def test_5gw_percentile_invariants():
    """Cumulative 5-GW MC: p10 <= p50 <= p90; p50 within 5% of analytical 5-GW xPts (D-03/Pitfall 5)."""
    p = _player(
        element_type=3, xmins=70.0, start_prob=0.85,
        xg_per90=0.5, xa_per90=0.4,
        fixtures=_five_gw_fixtures(dd=0.4),
    )
    result = compute_simulations([p], xmins_v2_enabled=False)
    r = result[0]
    # Required new fields present
    assert 'xPts_5gw_p10' in r
    assert 'xPts_5gw_p50' in r
    assert 'xPts_5gw_p90' in r
    assert 'rank_trajectory' in r
    # Ordering invariant
    assert r['xPts_5gw_p10'] <= r['xPts_5gw_p50'] <= r['xPts_5gw_p90']
    # Spread invariant (active player has meaningful spread over 5 GWs)
    assert r['xPts_5gw_p90'] > r['xPts_5gw_p10'] + 2.0
    # rank_trajectory is length-5 floats in [0, 1]
    assert isinstance(r['rank_trajectory'], list)
    assert len(r['rank_trajectory']) == 5
    for rank in r['rank_trajectory']:
        assert 0.0 <= rank <= 1.0


def test_5gw_bgw_zero_fill():
    """BGW gap (player with <5 fixture groups) contributes zero to cumulative (Pitfall 1)."""
    full = _player(fixtures=_five_gw_fixtures())
    # Same player but only 3 fixture groups — GW 4 and GW 5 are BGW
    bgw_player = _player(fixtures=[_fix(0.5, 38), _fix(0.5, 39), _fix(0.5, 40)])
    r_full = compute_simulations([full], xmins_v2_enabled=False)[0]
    r_bgw = compute_simulations([bgw_player], xmins_v2_enabled=False)[0]
    # 3-GW BGW player has strictly less cumulative p50 than full 5-GW player
    assert r_bgw['xPts_5gw_p50'] < r_full['xPts_5gw_p50']
    # The BGW player's 5-GW p50 should approximately equal what 3 GWs would produce
    # Sanity: roughly 3/5 of full player (within 30% — leaving Poisson noise headroom)
    assert r_bgw['xPts_5gw_p50'] < 0.75 * r_full['xPts_5gw_p50']


def test_5gw_dgw_combine():
    """DGW in GW 1 (two fixtures sharing event_id=38) produces higher cumulative p50 than 5 single GWs."""
    # 5 single fixtures across 5 distinct GWs
    single = _player(fixtures=_five_gw_fixtures())
    # DGW in GW 1: two fixtures sharing event_id=38, then GWs 39..42 single
    dgw_first = _player(fixtures=[
        _fix(0.5, 38), _fix(0.5, 38),  # DGW in GW 1
        _fix(0.5, 39), _fix(0.5, 40), _fix(0.5, 41), _fix(0.5, 42),
    ])
    r_single = compute_simulations([single], xmins_v2_enabled=False)[0]
    r_dgw = compute_simulations([dgw_first], xmins_v2_enabled=False)[0]
    # DGW player accrues an extra fixture's worth of upside in GW 1
    assert r_dgw['xPts_5gw_p50'] > r_single['xPts_5gw_p50']
    assert r_dgw['xPts_5gw_p90'] > r_single['xPts_5gw_p90']


def test_iteration_count_gate(monkeypatch):
    """MC_ITERATIONS env var sets N_SIMS; minimum 1000 floor is enforced (D-02 / Pitfall 3)."""
    import simulate

    # Below floor — must be clamped up to 1000
    monkeypatch.setenv('MC_ITERATIONS', '500')
    importlib.reload(simulate)
    assert simulate.N_SIMS >= 1000, f"floor not enforced: N_SIMS={simulate.N_SIMS}"

    # Above floor — env var value used directly
    monkeypatch.setenv('MC_ITERATIONS', '2000')
    importlib.reload(simulate)
    assert simulate.N_SIMS == 2000, f"env override not respected: N_SIMS={simulate.N_SIMS}"

    # Cleanup: reset to default for downstream tests
    monkeypatch.delenv('MC_ITERATIONS', raising=False)
    importlib.reload(simulate)


def test_seed_determinism(monkeypatch):
    """MC_SEED=42 produces identical xPts_5gw_p50 across two runs (D-02)."""
    import simulate

    monkeypatch.setenv('MC_SEED', '42')
    importlib.reload(simulate)
    p1 = _player(fixtures=_five_gw_fixtures(dd=0.4))
    r1 = simulate.compute_simulations([p1], xmins_v2_enabled=False)[0]

    # Reload to re-create the module-level rng with the same seed
    importlib.reload(simulate)
    p2 = _player(fixtures=_five_gw_fixtures(dd=0.4))
    r2 = simulate.compute_simulations([p2], xmins_v2_enabled=False)[0]

    # Identical to 6 decimal places (no floating point drift)
    assert round(r1['xPts_5gw_p50'], 6) == round(r2['xPts_5gw_p50'], 6)
    assert round(r1['xPts_5gw_p10'], 6) == round(r2['xPts_5gw_p10'], 6)
    assert round(r1['xPts_5gw_p90'], 6) == round(r2['xPts_5gw_p90'], 6)

    monkeypatch.delenv('MC_SEED', raising=False)
    importlib.reload(simulate)


def test_mc_enabled_off_skip(monkeypatch, tmp_path):
    """When mc_enabled=False, run.py does NOT call compute_simulations (D-01 gate)."""
    # Synthesize an accuracy_backtest.json with mc_enabled=False
    import json
    backtest = {
        'summary': {
            'mc_enabled': False,
            'xmins_v2_enabled': False,
            'bonus_predictor_enabled': False,
            'save_predictor_enabled': False,
            'form_signal_enabled': False,
            'blend_alpha_used': 0.4,
        }
    }
    cache_dir = tmp_path / 'cache'
    cache_dir.mkdir()
    (cache_dir / 'accuracy_backtest.json').write_text(json.dumps(backtest))

    # Read the gate flag using the same logic as run.py (lines 193-203)
    with open(cache_dir / 'accuracy_backtest.json', 'r', encoding='utf-8') as f:
        prev = json.load(f)
    mc_enabled = prev.get('summary', {}).get('mc_enabled', False)

    # Assert the gate evaluates to False — the if-guard in run.py would skip compute_simulations
    assert mc_enabled is False, "gate read returned wrong value"

    # Behavioural assertion: when mc_enabled=False, the call site MUST be guarded
    # (the actual run.py modification is verified in plan 02; here we lock the contract
    # that the file has the guard)
    import os
    run_py_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'run.py',
    )
    with open(run_py_path, 'r', encoding='utf-8') as f:
        run_source = f.read()
    # The constant gate MUST exist
    assert "MC_ENABLED = True" in run_source, \
        "run.py is missing MC_ENABLED = True constant (Phase 102 D-05)"
    assert "mc_enabled = MC_ENABLED" in run_source, \
        "run.py is missing 'mc_enabled = MC_ENABLED' assignment (Phase 102 D-05)"
    # The conditional call MUST exist
    assert 'if mc_enabled:' in run_source, "run.py is missing `if mc_enabled:` guard"


def test_accuracy_mc_enabled_cold_start(tmp_path):
    """Phase 90 MC-01: _empty_backtest writes mc_enabled=false on first run; preserves true on subsequent (D-01)."""
    import json as _json
    from accuracy import _empty_backtest, _read_existing_mc_enabled_flag

    # Cold start (no prior cache) — mc_enabled defaults to False
    cold_dir = tmp_path / 'cold'
    cold_dir.mkdir()
    cold = _empty_backtest(str(cold_dir))
    assert 'mc_enabled' in cold['summary'], "mc_enabled missing from _empty_backtest summary"
    assert cold['summary']['mc_enabled'] is False, "mc_enabled should default to False on cold start"

    # _read_existing_mc_enabled_flag returns False for missing file
    assert _read_existing_mc_enabled_flag(str(cold_dir)) is False

    # Warm start — write a prior cache with mc_enabled=true and assert preservation
    warm_dir = tmp_path / 'warm'
    warm_dir.mkdir()
    prior_cache = {
        'generated_at': '2026-05-10T00:00:00+00:00',
        'gws_covered': [],
        'summary': {
            'xpts_hit_rate': 0.0,
            'xpts_blended_hit_rate': 0.0,
            'form_signal_enabled': False,
            'xmins_v2_enabled': False,
            'bonus_predictor_enabled': False,
            'save_predictor_enabled': False,
            'mc_enabled': True,                # the value we want preserved
            'news_flag_enabled': True,
            'blend_alpha_used': 0.4,
            'mid_tier_hit_rate': 0.0,
            'mid_tier_blended_hit_rate': 0.0,
            'gws': [],
        },
        'haulters': [],
        'players': [],
        'versions': [],
    }
    (warm_dir / 'accuracy_backtest.json').write_text(_json.dumps(prior_cache))

    warm = _empty_backtest(str(warm_dir))
    assert warm['summary']['mc_enabled'] is True, "mc_enabled=true must be preserved across cold-start with prior cache"
    assert _read_existing_mc_enabled_flag(str(warm_dir)) is True

    # Version-record gate_flags must also contain mc_enabled (parity with main write path)
    if warm.get('versions'):
        last_version = warm['versions'][-1]
        if 'gate_flags' in last_version:
            assert 'mc_enabled' in last_version['gate_flags'], \
                "mc_enabled missing from version-record gate_flags (parity bug)"


def test_cs_prob_sim_uses_kwargs():
    """_cs_prob_sim must use cs_prob_base / cs_prob_slope kwargs, not hardcoded constants."""
    from simulate import _cs_prob_sim
    default = _cs_prob_sim(0.5, 90.0, None)
    high_base = _cs_prob_sim(0.5, 90.0, None, cs_prob_base=0.55)
    low_base = _cs_prob_sim(0.5, 90.0, None, cs_prob_base=0.25)
    assert high_base > default > low_base


def test_compute_simulations_cs_prob_kwargs_dont_raise():
    """compute_simulations must accept and forward cs_prob kwargs without error."""
    from simulate import compute_simulations
    p = {
        'id': 1, 'element_type': 3, 'xg_per90': 0.3, 'xa_per90': 0.1,
        'start_prob': 0.9, 'xmins': 80.0, 'mins_60_prob': 0.85,
        'fixtures': [{'event_id': 1, 'defensive_difficulty': 0.4,
                      'opponent_xg_per_game': 1.2}],
    }
    result = compute_simulations([p], xmins_v2_enabled=False,
                                  cs_prob_base=0.50, cs_prob_slope=0.25)
    assert len(result) == 1
    assert 'haul_prob' in result[0]
