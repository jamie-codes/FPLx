"""Pytest unit tests for _compute_xpts_fixture and _xpts_ngw appearance_pts extension.

Phase 48 XPT-01 / XPT-02 — appearance_pts component and sum invariant.
Run: python -m pytest pipeline/tests/test_merge_xpts_components.py -q
"""

import pytest

# conftest.py inserts pipeline/ onto sys.path — use bare import.
from merge import _compute_xpts_fixture, _xpts_ngw


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


def test_symbol_exists():
    """Precondition: _compute_xpts_fixture and _xpts_ngw must be importable."""
    assert _compute_xpts_fixture is not None
    assert _xpts_ngw is not None


def test_xpts_components_sum_to_total_single_fixture():
    """XPT-02: components sum to total within ±0.01 for a regular GW player."""
    result = _compute_xpts_fixture(
        xg_per90=0.4,
        xa_per90=0.2,
        start_prob=0.9,
        xmins=81.0,
        element_type=3,
        defensive_difficulty=0.5,
    )
    component_sum = (
        result['goal_pts']
        + result['assist_pts']
        + result['cs_pts']
        + result['bonus_pts']
        + result['appearance_pts']
    )
    assert abs(component_sum - result['total']) < 0.01


def test_xpts_components_sum_to_total_dgw():
    """XPT-02 / D-05: DGW components sum invariant holds across two fixtures in same event."""
    fixtures = [_fixture(event_id=33, dd=0.3), _fixture(event_id=33, dd=0.7)]
    total, components = _xpts_ngw(
        xg_per90=0.4,
        xa_per90=0.2,
        start_prob=0.9,
        xmins=81.0,
        element_type=3,
        fixtures=fixtures,
        n_gws=1,
    )
    assert components is not None
    component_sum = sum(components.values())
    assert abs(component_sum - total) < 0.01


def test_appearance_pts_formula():
    """D-01: appearance_pts = start_prob × 2, independent of xmins scaling."""
    result = _compute_xpts_fixture(
        xg_per90=0.0,
        xa_per90=0.0,
        start_prob=0.8,
        xmins=72.0,
        element_type=4,
        defensive_difficulty=0.5,
    )
    assert result['appearance_pts'] == pytest.approx(0.8 * 2, abs=0.001)
