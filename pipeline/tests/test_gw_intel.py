"""Unit tests for pipeline/gw_intel.py (Phase 80 GWI-01..GWI-04)."""

from gw_intel import (
    _apply_rotation_risk,
    _compute_table_stakes,
    _detect_dgw_bgw,
    _difficulty_label,
    compute_gw_intel,
)
from merge import _xpts_per_gw


def _minimal_bootstrap(team_specs):
    """team_specs: list of (id, short_name, position) tuples."""
    return {
        'teams': [
            {'id': tid, 'short_name': sn, 'position': pos}
            for tid, sn, pos in team_specs
        ],
        'elements': [],
        'events': [{'id': gw, 'finished': True} for gw in range(1, 33)],
    }


def _finished_fixture(h, a, h_score, a_score, gw=1):
    return {
        'team_h': h, 'team_a': a,
        'team_h_score': h_score, 'team_a_score': a_score,
        'event': gw, 'finished': True,
    }


def _upcoming_fixture(h, a, gw, kickoff_time):
    return {
        'team_h': h, 'team_a': a,
        'finished': False,
        'kickoff_time': kickoff_time,
        'event': gw,
    }


def test_rotation_risk_detection():
    """GWI-01: cup date within +-3 days of PL fixture flags both teams' players."""
    fixtures = [_upcoming_fixture(1, 2, 36, '2026-05-10T14:00:00Z')]
    merged = [{'id': 1, 'team': 1}, {'id': 2, 'team': 2}, {'id': 3, 'team': 3}]
    european_cup_dates = {1: ['2026-05-11']}
    result = _apply_rotation_risk(merged, fixtures, european_cup_dates)
    assert result[0]['rotation_risk'] is True
    assert result[1]['rotation_risk'] is False  # team 2 has no cup date
    assert result[2]['rotation_risk'] is False


def test_rotation_risk_no_clash():
    """GWI-01: rotation_risk=False when cup date is outside 3-day window."""
    fixtures = [_upcoming_fixture(1, 2, 36, '2026-05-10T14:00:00Z')]
    merged = [{'id': 1, 'team': 1}]
    european_cup_dates = {1: ['2026-05-20']}
    result = _apply_rotation_risk(merged, fixtures, european_cup_dates)
    assert result[0]['rotation_risk'] is False


def test_rotation_risk_handles_finished_pl_fixture():
    """GWI-01: finished PL fixtures are not considered."""
    fixtures = [{**_upcoming_fixture(1, 2, 1, '2025-08-15T14:00:00Z'), 'finished': True}]
    merged = [{'id': 1, 'team': 1}]
    european_cup_dates = {1: ['2025-08-16']}
    result = _apply_rotation_risk(merged, fixtures, european_cup_dates)
    assert result[0]['rotation_risk'] is False


def test_table_stakes_gate():
    """GWI-03: table_stakes returns [] when more than 6 GWs remaining."""
    bootstrap = _minimal_bootstrap([(1, 'A', 1), (2, 'B', 2)])
    result = _compute_table_stakes(bootstrap, [], finished_gws=20)
    assert result == []


def test_table_stakes_labels():
    """GWI-03 (D-13): position 1 -> title battle, 17-20 -> relegation, 2-6 -> European chase."""
    bootstrap = _minimal_bootstrap([
        (1, 'AAA', 1), (2, 'BBB', 5), (3, 'CCC', 10), (4, 'DDD', 18),
    ])
    # finished_gws=33 -> 38-33=5 (within final 6 window)
    result = _compute_table_stakes(bootstrap, [], finished_gws=33)
    labels = {r['team_id']: r['label'] for r in result}
    assert labels[1] == 'title battle'
    assert labels[2] == 'European chase'
    assert labels[3] == 'nothing-to-play-for'
    assert labels[4] == 'relegation battle'


def test_compute_team_points_ignores_bootstrap_points():
    """Pitfall 1: points must come from finished fixtures, NOT bootstrap (always 0)."""
    from gw_intel import _compute_team_points_from_fixtures
    # Team 1 won 1, drew 1 -> 4 pts; Team 2 drew 1, lost 1 -> 1 pt
    fixtures = [
        _finished_fixture(1, 2, 2, 0, gw=1),
        _finished_fixture(1, 2, 1, 1, gw=2),
    ]
    pts = _compute_team_points_from_fixtures(fixtures)
    assert pts[1] == 4
    assert pts[2] == 1


def test_xpts_per_gw_dgw_combined():
    """GWI-04 (D-12): DGW (2 fixtures same event_id) sums into one entry; length==unique GWs."""
    fixtures = [
        {'event_id': 36, 'defensive_difficulty': 0.5},
        {'event_id': 36, 'defensive_difficulty': 0.5},
        {'event_id': 37, 'defensive_difficulty': 0.5},
    ]
    result = _xpts_per_gw(0.5, 0.3, 0.9, 80, 3, fixtures, 3)
    assert isinstance(result, list)
    assert len(result) == 2  # GW36 (DGW) + GW37
    assert result[0] > result[1]  # DGW combined > single fixture


def test_xpts_per_gw_empty_guard():
    """GWI-04: empty fixtures or zero start_prob -> [0.0] * n_gws."""
    assert _xpts_per_gw(0, 0, 0, 0, 3, [], 3) == [0.0, 0.0, 0.0]
    assert _xpts_per_gw(0.5, 0.3, 0, 80, 3, [{'event_id': 36}], 3) == [0.0, 0.0, 0.0]


def test_difficulty_label_thresholds():
    """GWI-04 (D-10): <=2.0 easy, 2.1-3.0 manageable, >=3.1 tough."""
    assert _difficulty_label(1.5) == 'easy'
    assert _difficulty_label(2.0) == 'easy'
    assert _difficulty_label(2.5) == 'manageable'
    assert _difficulty_label(3.1) == 'tough'
    assert _difficulty_label(4.0) == 'tough'


def test_no_dgw_bgw_when_all_single():
    """Pitfall 6: when all teams have exactly 1 fixture for next_gw, _detect_dgw_bgw returns empty."""
    merged = [
        {'team': 1, 'fixtures': [{'event_id': 36}]},
        {'team': 2, 'fixtures': [{'event_id': 36}]},
    ]
    result = _detect_dgw_bgw(merged, next_gw=36)
    assert result == {}


def test_dgw_detection_by_event_id():
    """Pitfall 6: team with 2 fixtures sharing event_id flagged as DGW."""
    merged = [
        {'team': 1, 'fixtures': [{'event_id': 36}, {'event_id': 36}, {'event_id': 37}]},
        {'team': 2, 'fixtures': [{'event_id': 36}]},
    ]
    result = _detect_dgw_bgw(merged, next_gw=36)
    assert result.get(1) == 'dgw'
    assert 2 not in result


def test_bgw_detection():
    """BGW: team with 0 fixtures matching next_gw flagged."""
    merged = [
        {'team': 1, 'fixtures': [{'event_id': 37}]},  # skips 36
        {'team': 2, 'fixtures': [{'event_id': 36}]},
    ]
    result = _detect_dgw_bgw(merged, next_gw=36)
    assert result.get(1) == 'bgw'


def test_compute_gw_intel_returns_required_shape():
    """GWI-02: compute_gw_intel returns dict with cards, team_stakes, generated_at."""
    bootstrap = _minimal_bootstrap([(1, 'AAA', 1), (2, 'BBB', 2)])
    merged = [
        {
            'id': 1, 'team': 1, 'web_name': 'Test', 'element_type': 3,
            'xg_per90': 0.4, 'xa_per90': 0.2, 'start_prob': 0.9, 'xmins': 80,
            'selected_by_percent': 30, 'xPts_3gw': 12.5, 'rotation_risk': False,
            'fixtures': [{'event_id': 33, 'defensive_difficulty': 0.4, 'is_home': True}],
        },
    ]
    result = compute_gw_intel(merged, bootstrap, [], {}, finished_gws=32, european_cup_dates={})
    assert 'cards' in result
    assert 'team_stakes' in result
    assert 'generated_at' in result
    assert isinstance(result['cards'], list)
    assert isinstance(result['team_stakes'], list)


def test_narrative_template():
    """GWI-04 (D-09): narrative matches '{web_name}: {n} {difficulty} {venue} fixtures -- {verdict}'."""
    bootstrap = _minimal_bootstrap([(1, 'AAA', 1)])
    merged = [{
        'id': 1, 'team': 1, 'web_name': 'Salah', 'element_type': 3,
        'xg_per90': 0.6, 'xa_per90': 0.4, 'start_prob': 0.95, 'xmins': 85,
        'selected_by_percent': 40, 'xPts_3gw': 18.0, 'rotation_risk': False,
        'fixtures': [
            {'event_id': 33, 'defensive_difficulty': 0.3, 'is_home': True},
            {'event_id': 34, 'defensive_difficulty': 0.4, 'is_home': True},
            {'event_id': 35, 'defensive_difficulty': 0.5, 'is_home': True},
        ],
    }]
    result = compute_gw_intel(merged, bootstrap, [], {}, finished_gws=32, european_cup_dates={})
    run_cards = [c for c in result['cards'] if c['type'] == 'fixture_run']
    assert len(run_cards) == 1
    # Easy difficulty (avg 0.4 <= 2.0), all home, prime hold
    assert run_cards[0]['narrative'] == 'Salah: 3 easy home fixtures — prime hold'


def test_compute_gw_intel_forwards_cs_prob_kwargs():
    """compute_gw_intel must forward cs_prob kwargs to _build_fixture_run_card.
    Uses a minimal player with a fixture so _build_fixture_run_card is actually called."""
    from gw_intel import compute_gw_intel
    player = {
        'id': 1, 'web_name': 'Tester', 'element_type': 2,
        'team': 1, 'xg_per90': 0.05, 'xa_per90': 0.03,
        'start_prob': 0.9, 'xmins': 80.0,
        'xPts_3gw': 4.5, 'xPts_1gw': 1.5,
        'selected_by_percent': 10.0,
        'fixtures': [
            {'event_id': 11, 'defensive_difficulty': 0.4,
             'opponent_xg_per_game': 1.1, 'is_home': True},
        ],
        'haul_prob': 0.1, 'form': 5.0,
    }
    bootstrap = {
        'elements': [player],
        'teams': [{'id': 1, 'short_name': 'TST'}],
        'events': [{'id': 10, 'finished': True}, {'id': 11, 'finished': False}],
    }
    # Should not raise with non-default kwargs; _build_fixture_run_card called for this player
    result = compute_gw_intel(
        merged=[player],
        bootstrap=bootstrap,
        fixtures=[{'event': 11, 'team_h': 1, 'team_a': 2,
                   'team_h_difficulty': 3, 'team_a_difficulty': 4,
                   'finished': False, 'kickoff_time': '2026-11-01T15:00:00Z'}],
        summaries={},
        finished_gws=10,
        european_cup_dates={},
        cs_prob_base=0.50,
        cs_prob_slope=0.25,
    )
    assert 'cards' in result
