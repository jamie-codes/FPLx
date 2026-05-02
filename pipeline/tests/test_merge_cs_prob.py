"""Pytest unit tests for _cs_prob_1gw_for_fixtures (Phase 47 CS-01, CS-02).

Tests cover the three branches:
  - Regular GW (single upcoming fixture)
  - DGW (two fixtures in the same event_id group)
  - BGW (no upcoming fixtures)
  - Zero xmins (injured / no play time expected)
  - Multi-GW span (only the first event group counts)
  - DGW + later GW interleave (only first event group combined)
"""

import pytest

# Import using bare name — conftest.py inserts pipeline/ onto sys.path.
from merge import _cs_prob, _cs_prob_1gw_for_fixtures


def test_symbol_exists():
    """Precondition: _cs_prob_1gw_for_fixtures must be importable from merge."""
    assert _cs_prob_1gw_for_fixtures is not None, (
        "_cs_prob_1gw_for_fixtures not found in merge.py"
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


def test_regular_gw_single_fixture():
    """Test 1 (regular GW, GK): Single fixture — cs_prob_1gw == _cs_prob(dd, xmins)."""
    result = _cs_prob_1gw_for_fixtures([_fixture(33, 0.5)], xmins=90.0)
    expected = _cs_prob(0.5, 90.0)
    assert result == pytest.approx(expected)


def test_dgw_combined_probability():
    """Test 2 (DGW, DEF): Two fixtures in same event_id — combined 1-(1-p1)*(1-p2)."""
    fixtures = [_fixture(33, 0.3), _fixture(33, 0.7)]
    result = _cs_prob_1gw_for_fixtures(fixtures, xmins=90.0)
    p1 = _cs_prob(0.3, 90.0)
    p2 = _cs_prob(0.7, 90.0)
    expected = 1.0 - (1.0 - p1) * (1.0 - p2)
    assert result == pytest.approx(expected, abs=1e-6)


def test_bgw_empty_fixtures():
    """Test 3 (BGW): No upcoming fixtures — cs_prob_1gw must be exactly 0.0 (D-10)."""
    result = _cs_prob_1gw_for_fixtures([], xmins=90.0)
    assert result == 0.0


def test_zero_xmins_injured():
    """Test 4 (zero xmins / injured): xmins==0 — cs_prob_1gw must be exactly 0.0."""
    result = _cs_prob_1gw_for_fixtures([_fixture(33, 0.5)], xmins=0.0)
    assert result == 0.0


def test_multi_gw_only_first_event_group_counts():
    """Test 5 (multi-GW span): 3 fixtures across 3 event_ids — only event_id=33 counts.

    event_id=33 dd=0.4, event_id=34 dd=0.6, event_id=35 dd=0.8.
    cs_prob_1gw should equal _cs_prob(0.4, 90) — the other events are ignored.
    """
    fixtures = [
        _fixture(33, 0.4),
        _fixture(34, 0.6),
        _fixture(35, 0.8),
    ]
    result = _cs_prob_1gw_for_fixtures(fixtures, xmins=90.0)
    expected = _cs_prob(0.4, 90.0)
    assert result == pytest.approx(expected)


def test_dgw_plus_later_gw_only_first_event_group_combined():
    """Test 6 (DGW + later GW interleave): event_id=33 twice + event_id=34 once.

    cs_prob_1gw uses ONLY the two event_id=33 fixtures combined.
    event_id=34 is ignored (belongs to next GW window).
    """
    fixtures = [
        _fixture(33, 0.3),
        _fixture(33, 0.5),
        _fixture(34, 0.7),
    ]
    result = _cs_prob_1gw_for_fixtures(fixtures, xmins=90.0)
    p1 = _cs_prob(0.3, 90.0)
    p2 = _cs_prob(0.5, 90.0)
    expected = 1.0 - (1.0 - p1) * (1.0 - p2)
    assert result == pytest.approx(expected, abs=1e-6)


def test_cs_prob_backward_compat_no_mins_60_prob():
    """Phase 52 D-01: _cs_prob with no mins_60_prob arg uses existing min(1.0, xmins/60) formula."""
    result = _cs_prob(0.5, 45.0)
    cs_raw = max(0.10, min(0.65, 0.40 - 0.5 * 0.30))   # = 0.25
    expected = cs_raw * min(1.0, 45.0 / 60.0)          # = 0.25 * 0.75 = 0.1875
    assert result == pytest.approx(expected)


def test_cs_prob_mins_60_prob_used_when_provided():
    """Phase 52 D-01: _cs_prob(dd, xmins, mins_60_prob=X) uses X as mins_factor (xmins ignored for mins_factor)."""
    result = _cs_prob(0.5, 45.0, mins_60_prob=0.90)
    cs_raw = max(0.10, min(0.65, 0.40 - 0.5 * 0.30))   # = 0.25
    expected = cs_raw * 0.90                            # = 0.225
    assert result == pytest.approx(expected)


def test_cs_prob_mins_60_prob_none_fallback():
    """Phase 52 D-01: explicit mins_60_prob=None matches no-arg call (default None preserved)."""
    result_explicit_none = _cs_prob(0.5, 45.0, mins_60_prob=None)
    result_no_arg = _cs_prob(0.5, 45.0)
    assert result_explicit_none == pytest.approx(result_no_arg)


def test_cs_prob_mins_60_prob_zero_gates_to_zero():
    """Phase 52 D-01: mins_60_prob=0.0 fully gates the CS contribution (semantically: never starts -> never gets CS pts)."""
    result = _cs_prob(0.5, 45.0, mins_60_prob=0.0)
    assert result == pytest.approx(0.0)


def test_cs_prob_mins_60_prob_one_full_credit():
    """Phase 52 D-01: mins_60_prob=1.0 gives full cs_raw credit (always reaches 60 min)."""
    result = _cs_prob(0.5, 45.0, mins_60_prob=1.0)
    cs_raw = max(0.10, min(0.65, 0.40 - 0.5 * 0.30))
    assert result == pytest.approx(cs_raw)
