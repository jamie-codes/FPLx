"""Pytest unit tests for merge.py bonus_predictor_enabled flag gate (Phase 53 BPS-01).

Tests the flag-gated bonus_pts computation in _compute_xpts_fixture and verifies
kwarg propagation through _xpts_ngw and _compute_xpts_sigma.
"""

import pytest

# conftest.py inserts pipeline/ onto sys.path — bare imports
from merge import (
    BONUS_RATE,
    _compute_xpts_fixture,
    _compute_xpts_sigma,
    _xpts_ngw,
)


def _fixture(event_id: int, dd: float = 0.5):
    """Minimal fixture dict matching the shape produced by pipeline upstream."""
    return {
        'event_id': event_id,
        'opponent_team': 'X',
        'opponent_short': 'X',
        'is_home': True,
        'difficulty_score': 0.5,
        'attacking_difficulty': 0.5,
        'defensive_difficulty': dd,
    }


def test_flat_rate_used_when_flag_off():
    """Flag OFF: bonus_pts uses BONUS_RATE[element_type] even if bonus_ev is provided."""
    result = _compute_xpts_fixture(
        xg_per90=0.0, xa_per90=0.0, start_prob=1.0, xmins=90.0,
        element_type=3, defensive_difficulty=0.5,
        bonus_predictor_enabled=False, bonus_ev=2.0,  # bonus_ev=2.0 must be ignored
    )
    expected_bonus = BONUS_RATE[3] * (90.0 / 90.0)
    assert result['bonus_pts'] == pytest.approx(expected_bonus, abs=0.001), \
        f"Flag OFF must use BONUS_RATE[3]={BONUS_RATE[3]}, not bonus_ev=2.0; got {result['bonus_pts']}"


def test_per_player_rate_used_when_flag_on():
    """Flag ON: bonus_pts uses per-player bonus_ev (not BONUS_RATE)."""
    bonus_ev = 1.5
    result = _compute_xpts_fixture(
        xg_per90=0.0, xa_per90=0.0, start_prob=1.0, xmins=90.0,
        element_type=3, defensive_difficulty=0.5,
        bonus_predictor_enabled=True, bonus_ev=bonus_ev,
    )
    expected_bonus = bonus_ev * (90.0 / 90.0)
    assert result['bonus_pts'] == pytest.approx(expected_bonus, abs=0.001), \
        f"Flag ON must use bonus_ev={bonus_ev}, not BONUS_RATE; got {result['bonus_pts']}"


def test_low_sample_uses_flat_rate():
    """Flag ON but bonus_ev is None (low-sample player) -> falls back to BONUS_RATE."""
    result = _compute_xpts_fixture(
        xg_per90=0.0, xa_per90=0.0, start_prob=1.0, xmins=90.0,
        element_type=2, defensive_difficulty=0.5,
        bonus_predictor_enabled=True, bonus_ev=None,
    )
    expected_bonus = BONUS_RATE[2] * (90.0 / 90.0)
    assert result['bonus_pts'] == pytest.approx(expected_bonus, abs=0.001), \
        f"Flag ON + bonus_ev=None must fall back to BONUS_RATE[2]={BONUS_RATE[2]}; got {result['bonus_pts']}"


def test_xpts_ngw_threads_bonus_kwargs():
    """_xpts_ngw with flag ON propagates bonus_ev to nested _compute_xpts_fixture (DGW case)."""
    fixtures = [_fixture(event_id=33, dd=0.5), _fixture(event_id=33, dd=0.5)]
    bonus_ev = 1.0
    total, components = _xpts_ngw(
        xg_per90=0.0, xa_per90=0.0, start_prob=1.0, xmins=90.0,
        element_type=4, fixtures=fixtures, n_gws=1,
        bonus_predictor_enabled=True, bonus_ev=bonus_ev,
    )
    assert components is not None
    # Two fixtures, each contributing bonus_ev * (90/90) = 1.0; sum = 2.0
    assert components['bonus_pts'] == pytest.approx(2.0, abs=0.01), \
        f"DGW bonus_pts must sum two per-fixture rates of {bonus_ev}; got {components['bonus_pts']}"


def test_compute_xpts_sigma_accepts_bonus_kwargs():
    """_compute_xpts_sigma must accept the two new kwargs without raising (signature parity)."""
    fixtures = [_fixture(event_id=33, dd=0.5)]
    sigma = _compute_xpts_sigma(
        xg_per90=0.4, xa_per90=0.2, start_prob=1.0, xmins=90.0,
        element_type=3, fixtures=fixtures, n_gws=1,
        bonus_predictor_enabled=True, bonus_ev=1.5,
    )
    # Sigma is non-negative; no exception thrown is the primary contract.
    assert sigma >= 0.0


# ---- Integration tests: BPS-01 bonus fields written to player dict ----
from merge import merge_players


def _build_minimal_player(player_id: int = 1):
    """Minimal merge_players input: one MID on team 14 with 900 minutes played."""
    bootstrap = {
        'teams': [
            {'id': 14, 'short_name': 'T14'},
            {'id': 1, 'short_name': 'T01'},
        ],
        'elements': [{
            'id': player_id,
            'web_name': 'TestPlayer',
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
            'expected_goals': '0.5',
            'expected_assists': '0.3',
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
        }],
        'events': [{'id': 33, 'is_next': True, 'is_current': True, 'finished': False}],
    }
    return bootstrap, [], {}, {str(player_id): {'understat_id': None}}


def test_merge_writes_bonus_ev_when_bonus_stats_provided():
    """BPS-01: merge_players writes bonus_ev and bonus_source to player dict."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    bonus_stats = {1: {'bonus_ev': 0.85, 'n_starts': 15, 'source': 'learned'}}
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               bonus_stats=bonus_stats)
    p = merged[0]
    assert p['bonus_ev'] == pytest.approx(0.85), \
        f"Expected bonus_ev=0.85, got {p.get('bonus_ev')}"
    assert p['bonus_source'] == 'learned', \
        f"Expected bonus_source='learned', got {p.get('bonus_source')}"


def test_merge_writes_none_when_bonus_stats_is_none():
    """BPS-01: bonus_ev and bonus_source are None when bonus_stats is not provided."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               bonus_stats=None)
    p = merged[0]
    assert p['bonus_ev'] is None, \
        f"Expected bonus_ev=None when bonus_stats=None, got {p.get('bonus_ev')}"
    assert p['bonus_source'] is None, \
        f"Expected bonus_source=None when bonus_stats=None, got {p.get('bonus_source')}"


def test_merge_writes_none_for_player_absent_from_bonus_stats():
    """BPS-01: bonus_ev and bonus_source are None when player_id not in bonus_stats."""
    bootstrap, fixtures, understat, id_map = _build_minimal_player(player_id=1)
    bonus_stats = {99: {'bonus_ev': 0.5, 'n_starts': 10, 'source': 'learned'}}  # player 1 absent
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map,
                               bonus_stats=bonus_stats)
    p = merged[0]
    assert p['bonus_ev'] is None, \
        f"Expected bonus_ev=None for absent player, got {p.get('bonus_ev')}"
    assert p['bonus_source'] is None, \
        f"Expected bonus_source=None for absent player, got {p.get('bonus_source')}"
