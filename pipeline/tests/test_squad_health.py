"""Contract tests for pipeline/squad_health.py (Phase 127 GREEDY-01).

Tests run via: python -m pytest pipeline/tests/test_squad_health.py -x
Imports work via conftest.py sys.path injection (bare name: from squad_health import ...).
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from squad_health import (
    _greedy_build,
    compute_squad_health,
    MIN_SLOTS,
    MAX_SLOTS,
    TEAM_CAP,
)


# ---------------------------------------------------------------------------
# Player factory helper
# ---------------------------------------------------------------------------

def _make_players(
    n_gk: int = 4,
    n_def: int = 10,
    n_mid: int = 10,
    n_fwd: int = 6,
    base_cost: int = 60,
) -> list:
    """Produce a player list with enough players to fill a valid squad.

    Each player gets a unique team (pid == team) to avoid team-cap issues.
    All players have 600 minutes so they pass the MIN_MINUTES threshold.
    Score is set so all players are eligible (score_map key present).
    """
    players = []
    pid = 1
    for pos, count in [(1, n_gk), (2, n_def), (3, n_mid), (4, n_fwd)]:
        for _ in range(count):
            players.append({
                'id': pid,
                'element_type': pos,
                'team': pid,   # unique team per player avoids TEAM_CAP issues
                'now_cost': base_cost,
            })
            pid += 1
    return players


def _score_map_for(players: list) -> dict:
    """Return a score map (id -> 0.5 ppm) for every player in the list."""
    return {p['id']: 0.5 for p in players}


# ---------------------------------------------------------------------------
# _greedy_build tests
# ---------------------------------------------------------------------------

def test_greedy_build_returns_squad_at_high_budget():
    """Sanity: feasible pool produces a 15-player squad at budget=1200."""
    players = _make_players()
    score_map = _score_map_for(players)

    result = _greedy_build(players, score_map, budget=1200)

    assert result is not None
    assert len(result) == 15


def test_greedy_build_returns_none_at_low_budget():
    """Squad infeasible when budget=400 with all players cost=60 (need 15*60=900)."""
    players = _make_players(base_cost=60)
    score_map = _score_map_for(players)

    result = _greedy_build(players, score_map, budget=400)

    assert result is None


def test_greedy_build_respects_min_slots():
    """All MIN_SLOTS positions must be satisfied; else returns None."""
    # Only 1 GK eligible (need 2) — should return None
    players = _make_players(n_gk=1, n_def=10, n_mid=10, n_fwd=6, base_cost=40)
    score_map = _score_map_for(players)

    result = _greedy_build(players, score_map, budget=1200)

    assert result is None


def test_greedy_build_respects_team_cap():
    """No team should contribute more than TEAM_CAP players."""
    # All players on team 1 — only TEAM_CAP (3) can be picked
    players = [
        {'id': i, 'element_type': (i % 4) + 1, 'team': 1, 'now_cost': 50}
        for i in range(1, 20)
    ]
    score_map = {p['id']: 0.5 for p in players}

    result = _greedy_build(players, score_map, budget=1500)

    # Can't build 15 from one team with TEAM_CAP=3
    assert result is None


# ---------------------------------------------------------------------------
# compute_squad_health tests
# ---------------------------------------------------------------------------

def _make_mock_bootstrap(players: list) -> dict:
    """Build a minimal bootstrap dict from a player list."""
    return {
        'elements': [
            {
                'id': p['id'],
                'element_type': p['element_type'],
                'team': p['team'],
                'now_cost': p['now_cost'],
                'web_name': f"P{p['id']}",
            }
            for p in players
        ],
        'teams': [{'id': p['team'], 'short_name': f"T{p['team']}"} for p in players],
    }


def _make_mock_archive(players: list, minutes: int = 600, points: int = 300) -> dict:
    """Build a minimal season archive dict from a player list."""
    archive = {}
    for p in players:
        archive[str(p['id'])] = {
            'history': [
                {'total_points': points, 'minutes': minutes}
            ]
        }
    return archive


def test_compute_squad_health_zero_null_rate_when_all_feasible(monkeypatch, tmp_path):
    """Mock a 81-pass case: null_rate=0, min_feasible_budget=80.0."""
    players = _make_players(base_cost=40)
    bootstrap = _make_mock_bootstrap(players)
    archive = _make_mock_archive(players)

    # Patch _greedy_build to always return a 15-player list (all budgets succeed)
    mock_squad = players[:15]

    with patch('squad_health._greedy_build', return_value=mock_squad) as mock_build, \
         patch('squad_health._load_archive', return_value=archive), \
         patch('squad_health.save') as mock_save:

        result = compute_squad_health(bootstrap)

    assert result is not None
    assert result['greedy_null_rate'] == 0.0
    assert result['min_feasible_budget_greedy'] == 80.0
    assert result['greedy_optimality_gap_avg'] is None
    assert result['budget_sweep_min'] == 80.0
    assert result['budget_sweep_max'] == 120.0
    assert result['budget_sweep_step'] == 0.5
    assert result['sweep_count'] == 81
    mock_save.assert_called_once()


def test_compute_squad_health_all_null_handles_gracefully(monkeypatch):
    """Mock 81-fail case: null_rate=1.0, min_feasible_budget=None."""
    players = _make_players()
    bootstrap = _make_mock_bootstrap(players)
    archive = _make_mock_archive(players)

    with patch('squad_health._greedy_build', return_value=None) as mock_build, \
         patch('squad_health._load_archive', return_value=archive), \
         patch('squad_health.save') as mock_save:

        result = compute_squad_health(bootstrap)

    assert result is not None
    assert result['greedy_null_rate'] == 1.0
    assert result['min_feasible_budget_greedy'] is None
    mock_save.assert_called_once()


def test_compute_squad_health_writes_correct_envelope(monkeypatch):
    """Assert save() is called with the seven expected SquadHealth keys."""
    players = _make_players(base_cost=50)
    bootstrap = _make_mock_bootstrap(players)
    archive = _make_mock_archive(players)

    # Greedy succeeds for all 81 budgets
    mock_squad = players[:15]
    with patch('squad_health._greedy_build', return_value=mock_squad), \
         patch('squad_health._load_archive', return_value=archive), \
         patch('squad_health.save') as mock_save:

        compute_squad_health(bootstrap)

    assert mock_save.call_count == 1
    call_args = mock_save.call_args
    filename = call_args[0][0]
    health_dict = call_args[0][1]

    assert filename == 'pre_season_squad_health.json'
    expected_keys = {
        'greedy_null_rate',
        'min_feasible_budget_greedy',
        'greedy_optimality_gap_avg',
        'budget_sweep_min',
        'budget_sweep_max',
        'budget_sweep_step',
        'sweep_count',
    }
    assert set(health_dict.keys()) == expected_keys


def test_compute_squad_health_sweeps_exactly_81_budgets(monkeypatch):
    """The budget loop covers exactly 81 values (range(800, 1205, 5))."""
    players = _make_players()
    bootstrap = _make_mock_bootstrap(players)
    archive = _make_mock_archive(players)

    call_count = {'n': 0}

    def counting_greedy(players, score_map, budget):
        call_count['n'] += 1
        return None  # all fail; we only care about call count

    with patch('squad_health._greedy_build', side_effect=counting_greedy), \
         patch('squad_health._load_archive', return_value=archive), \
         patch('squad_health.save'):

        compute_squad_health(bootstrap)

    assert call_count['n'] == 81
