"""Pytest unit tests for pipeline/saves.py (Phase 83, GK-01).

Run: python -m pytest pipeline/tests/test_saves.py -q
"""

import math
import pytest

# conftest.py inserts pipeline/ onto sys.path -- use bare import.
from saves import poisson_floor_save_pts
from merge import _compute_xpts_fixture, _compute_xpts_sigma, _compute_captain_picks


def test_symbol_exists():
    """Precondition: poisson_floor_save_pts must be importable."""
    assert poisson_floor_save_pts is not None


def test_bgw_returns_zero():
    """GK-01: lambda=0 (blank GW) returns exactly 0.0."""
    assert poisson_floor_save_pts(0.0) == 0.0


def test_negative_lambda_returns_zero():
    """Guard: negative lambda treated as zero."""
    assert poisson_floor_save_pts(-1.0) == 0.0


def test_known_value_lambda_1():
    """GK-01: lambda=1.0 -- E[floor(N/3)] ~= 0.0809 (NOT naive lambda/3 = 0.333).

    Manual derivation:
      P(N>=3 | lambda=1) = 1 - (P(0)+P(1)+P(2)) = 1 - e^-1 * (1 + 1 + 0.5) ~= 0.0803
      P(N>=6 | lambda=1) ~= 0.0006 (negligible)
      Total ~= 0.0809
    """
    result = poisson_floor_save_pts(1.0)
    assert abs(result - 0.0809) < 1e-3, f"Expected ~0.0809, got {result}"


def test_known_value_lambda_3():
    """GK-01: lambda=3.0 -- E[floor(N/3)] ~= 0.665 (NOT naive lambda/3 = 1.0).

    Manual derivation:
      P(N>=3 | lambda=3) = 1 - CDF(2,3) ~= 0.5768
      P(N>=6 | lambda=3) ~= 0.0839
      P(N>=9 | lambda=3) ~= 0.0038
      Total ~= 0.6645
    """
    result = poisson_floor_save_pts(3.0)
    assert abs(result - 0.665) < 5e-3, f"Expected ~0.665, got {result}"


def test_naive_formula_is_different():
    """GK-01 / RESEARCH Pitfall 2: floor-EV must NOT equal naive lambda/3.

    The Poisson-floor expectation is strictly less than lambda/3 for moderate
    lambda. If a future refactor accidentally uses the naive formula, this
    test will fail.
    """
    lam = 3.0
    floor_ev = poisson_floor_save_pts(lam)
    naive = lam / 3.0
    assert abs(floor_ev - naive) > 0.1, (
        f"Poisson-floor result {floor_ev} must differ from naive {naive} by >0.1"
    )


# ---- Phase 83 Plan 02 integration tests (83-02-01..83-02-04) ----
# Tests against the merge.py public API to verify end-to-end GK save-point
# integration, sigma var_saves contribution, and captain GK exclusion.


def _gk_fixture(event_id: int = 33, opponent_xg_per_game: float = 1.2,
                defensive_difficulty: float = 0.5):
    """Fixture dict matching the shape produced by merge_players upstream
    (mirrors test_merge_xpts_components._fixture but adds opponent_xg_per_game)."""
    return {
        'event_id': event_id,
        'opponent_team': 'X',
        'opponent_short': 'X',
        'is_home': True,
        'difficulty_score': 0.5,
        'attacking_difficulty': 0.5,
        'defensive_difficulty': defensive_difficulty,
        'opponent_xg_per_game': opponent_xg_per_game,
    }


def test_integration_with_fixture():
    """GK-01: GK with gate ON receives save_pts > 0 and total includes it."""
    result = _compute_xpts_fixture(
        xg_per90=0.0,
        xa_per90=0.0,
        start_prob=1.0,
        xmins=90.0,
        element_type=1,
        defensive_difficulty=0.5,
        save_predictor_enabled=True,
        opponent_xg_per_game=1.2,
    )
    assert 'save_pts' in result
    assert result['save_pts'] > 0.0, f"GK with lambda=1.2 should produce save_pts > 0, got {result['save_pts']}"
    component_sum = (
        result['goal_pts']
        + result['assist_pts']
        + result['cs_pts']
        + result['bonus_pts']
        + result['appearance_pts']
        + result['save_pts']
    )
    assert abs(component_sum - result['total']) < 0.01, (
        f"Total {result['total']} must equal sum {component_sum} within 0.01"
    )


def test_save_pts_omitted_when_gate_off():
    """GK-01 / D-09: GK with gate OFF produces save_pts == 0.0 (always-present field for shape consistency)."""
    result = _compute_xpts_fixture(
        xg_per90=0.0,
        xa_per90=0.0,
        start_prob=1.0,
        xmins=90.0,
        element_type=1,
        defensive_difficulty=0.5,
        save_predictor_enabled=False,
        opponent_xg_per_game=1.2,
    )
    assert result['save_pts'] == 0.0


def test_save_pts_zero_for_non_gk():
    """D-03 / Pitfall 3: non-GK players never accumulate save_pts even when gate ON."""
    result = _compute_xpts_fixture(
        xg_per90=0.4,
        xa_per90=0.2,
        start_prob=1.0,
        xmins=90.0,
        element_type=3,                    # MID
        defensive_difficulty=0.5,
        save_predictor_enabled=True,
        opponent_xg_per_game=1.2,
    )
    assert result['save_pts'] == 0.0


def test_var_saves_increases_sigma_for_gk():
    """GK-01 / D-11: _compute_xpts_sigma adds var_saves = lambda/9 for GKs when gate ON."""
    fixtures = [_gk_fixture(opponent_xg_per_game=1.5)]
    sigma_off = _compute_xpts_sigma(
        xg_per90=0.0, xa_per90=0.0,
        start_prob=1.0, xmins=90.0,
        element_type=1, fixtures=fixtures, n_gws=1,
        save_predictor_enabled=False,
    )
    sigma_on = _compute_xpts_sigma(
        xg_per90=0.0, xa_per90=0.0,
        start_prob=1.0, xmins=90.0,
        element_type=1, fixtures=fixtures, n_gws=1,
        save_predictor_enabled=True,
    )
    assert sigma_on > sigma_off, (
        f"sigma_on={sigma_on} must exceed sigma_off={sigma_off} (var_saves should add ~lambda/9 = ~0.167)"
    )


def test_captain_excludes_gks():
    """GK-03 / D-10: _compute_captain_picks must exclude element_type=1 from eligible."""
    high_xpts_gk = {
        'id': 1, 'web_name': 'GK_top', 'team_short_name': 'AAA',
        'element_type': 1, 'now_cost': 50, 'status': 'a',
        'xPts_1gw': 9.0, 'xPts_90th_1gw': 12.0,
        'selected_by_percent': '5.0',
    }
    high_xpts_mid = {
        'id': 2, 'web_name': 'MID_top', 'team_short_name': 'BBB',
        'element_type': 3, 'now_cost': 100, 'status': 'a',
        'xPts_1gw': 8.5, 'xPts_90th_1gw': 11.0,
        'selected_by_percent': '15.0',
    }
    picks = _compute_captain_picks([high_xpts_gk, high_xpts_mid], gameweek=33)
    assert picks['ceiling'] is not None
    assert picks['ceiling']['position'] == 'MID', (
        f"Ceiling pick must be the MID, not the GK. Got: {picks['ceiling']}"
    )
    assert picks['ceiling']['id'] == 2
