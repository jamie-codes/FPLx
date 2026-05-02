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


@pytest.mark.parametrize(
    "bonus_predictor_enabled,bonus_ev",
    [
        (False, None),
        (True, 1.2),
        (True, None),  # flag ON but no per-player rate -> fallback to BONUS_RATE
    ],
)
def test_xpts_components_sum_integrity_with_bonus_flag(bonus_predictor_enabled, bonus_ev):
    """Phase 53 BPS-01: sum invariant holds for all bonus_predictor_enabled combinations."""
    result = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=0.9, xmins=81.0,
        element_type=3, defensive_difficulty=0.5,
        bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=bonus_ev,
    )
    component_sum = (
        result['goal_pts']
        + result['assist_pts']
        + result['cs_pts']
        + result['bonus_pts']
        + result['appearance_pts']
    )
    assert abs(component_sum - result['total']) < 0.01, \
        f"Sum drift for flag={bonus_predictor_enabled}, ev={bonus_ev}: " \
        f"sum={component_sum:.4f}, total={result['total']:.4f}"


def test_xpts_components_sum_integrity_both_gates_on():
    """Phase 53 Pitfall 3: sum invariant holds with xmins_v2 AND bonus_predictor both ON."""
    result = _compute_xpts_fixture(
        xg_per90=0.4, xa_per90=0.2, start_prob=0.9, xmins=81.0,
        element_type=3, defensive_difficulty=0.5,
        xmins_v2_enabled=True, mins_60_prob=0.85,
        bonus_predictor_enabled=True, bonus_ev=1.2,
    )
    component_sum = (
        result['goal_pts']
        + result['assist_pts']
        + result['cs_pts']
        + result['bonus_pts']
        + result['appearance_pts']
    )
    # Pitfall 3: relaxed to ±0.02 to absorb cumulative rounding under two active gates.
    assert abs(component_sum - result['total']) < 0.02, \
        f"Both-gates sum drift exceeds ±0.02: sum={component_sum:.4f}, total={result['total']:.4f}"


# ---- Integration test (WR-03) ----
# Verifies that merge_players writes xPts_components_1gw with all five required keys
# and that the component sum equals xPts_1gw within tolerance.

from merge import merge_players


def _build_minimal_inputs_for_components():
    """Minimal bootstrap/fixtures/understat suitable for xPts_components_1gw integration check."""
    pid = 1
    elements = [{
        'id': pid,
        'web_name': 'PlayerA',
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
    }]
    finished_gws = 10
    bootstrap = {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV'},
            {'id': 1, 'short_name': 'ARS'},
        ],
        'events': [{'id': i, 'finished': i <= finished_gws, 'is_current': False}
                   for i in range(1, finished_gws + 6)],
    }
    for ev in bootstrap['events']:
        if not ev['finished']:
            ev['is_current'] = True
            break

    fixtures = []
    for gw in range(1, finished_gws + 1):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': True, 'team_h_score': 1, 'team_a_score': 1,
        })
    for gw in range(finished_gws + 1, finished_gws + 6):
        fixtures.append({
            'event': gw, 'team_h': 14, 'team_a': 1,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
            'finished': False,
        })

    understat = {}
    id_map = {str(pid): {'understat_id': None}}
    xmins_stats = {pid: {'xmins': 81.0, 'start_prob': 0.9, 'mins_risk': 'safe'}}
    summaries = {}
    return bootstrap, fixtures, understat, id_map, xmins_stats, summaries


def test_merge_players_writes_xpts_components_1gw():
    """WR-03 integration: merge_players must write xPts_components_1gw with all five keys,
    and component sum must equal xPts_1gw within ±0.01 (XPT-02 sum invariant)."""
    bootstrap, fixtures, understat, id_map, xmins_stats, summaries = (
        _build_minimal_inputs_for_components()
    )
    merged, _ = merge_players(bootstrap, fixtures, understat, id_map, xmins_stats, summaries)
    assert len(merged) == 1, "Expected exactly one player in output"
    player = merged[0]

    # Field must be present
    assert 'xPts_components_1gw' in player, (
        "xPts_components_1gw missing from merge_players output — pipeline integration broken"
    )
    components = player['xPts_components_1gw']

    # All five required keys must be present
    required_keys = {'appearance_pts', 'goal_pts', 'assist_pts', 'cs_pts', 'bonus_pts'}
    assert required_keys == set(components.keys()), (
        f"xPts_components_1gw has unexpected keys: {set(components.keys())}"
    )

    # Sum invariant: components sum == xPts_1gw within ±0.01
    xpts_1gw = player.get('xPts_1gw', 0.0) or 0.0
    component_sum = sum(components.values())
    assert abs(component_sum - xpts_1gw) < 0.01, (
        f"Component sum {component_sum:.4f} != xPts_1gw {xpts_1gw:.4f} (delta > 0.01)"
    )
