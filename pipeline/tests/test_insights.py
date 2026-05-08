"""Unit tests for pipeline/insights.py (Phase 79 INS-01/INS-02/INS-06).

Tests assert all new structured fields are present on every insight dict,
and that _signal_label() implements the D-04 rule matrix correctly.
"""

# conftest.py at pipeline/tests/conftest.py auto-injects pipeline/ on sys.path,
# so we can import insights by bare name (matches test_accuracy.py pattern).
from insights import (
    compute_insights,
    _signal_label,
    BENCHMARK_DEFAULTS,
    INSIGHT_TITLES,
    INSIGHT_ACTION_HINTS,
)


REQUIRED_NEW_FIELDS = {
    'title', 'metric_value', 'metric_label', 'takeaway', 'action_hint',
    'benchmark_value', 'gw_coverage', 'player_ids', 'team_ids',
    'player_names', 'team_names', 'signal_label',
}


def _minimal_bootstrap(team_ids=(1, 2)):
    return {
        'teams': [
            {'id': tid, 'short_name': f'TM{tid}', 'position': i + 1}
            for i, tid in enumerate(team_ids)
        ],
        'elements': [],
        'events': [{'id': gw, 'finished': True} for gw in range(1, 35)],
    }


def _finished_fixture(h, a, h_score, a_score, gw=1):
    return {
        'team_h': h, 'team_a': a,
        'team_h_score': h_score, 'team_a_score': a_score,
        'event': gw, 'finished': True,
    }


def test_signal_label_rules():
    """INS-02 / D-04: _signal_label() rule matrix.

    Category-specific overrides run BEFORE generic threshold checks.
    """
    # Category overrides
    assert _signal_label('player', 65, 'x') == 'Hidden gem'
    assert _signal_label('player', 64, 'x') == 'Watchlist'   # below override; generic 55-69 bucket
    assert _signal_label('attacking', 44, 'x') == 'Trap risk'
    assert _signal_label('player', 44, 'x') == 'Trap risk'
    assert _signal_label('defensive', 44, 'x') == 'Regression risk'
    assert _signal_label('defensive', 30, 'x') == 'Regression risk'  # < 45 override
    # Generic thresholds (no category override applies)
    assert _signal_label('defensive', 70, 'x') == 'Strong signal'
    assert _signal_label('captaincy', 75, 'x') == 'Strong signal'
    assert _signal_label('attacking', 57, 'x') == 'Watchlist'
    assert _signal_label('captaincy', 30, 'x') == 'Weak signal'   # no category override for captaincy


def test_insight_metadata_constants_complete():
    """Every documented insight ID has a benchmark default, title, and action hint."""
    expected_ids = {
        'def_cs_home_vs_away', 'def_cs_rate_top6_vs_rest', 'def_cs_streak_ge2',
        'att_top_xg_overperformers', 'att_home_goal_share', 'att_top_team_goal_share',
        'player_buy_signal_count', 'player_sell_signal_count',
        'player_diff_count', 'player_template_trap_count',
        'cap_top3_xpts_share', 'cap_double_digit_haul_rate',
    }
    assert expected_ids.issubset(BENCHMARK_DEFAULTS.keys())
    assert expected_ids.issubset(INSIGHT_TITLES.keys())
    assert expected_ids.issubset(INSIGHT_ACTION_HINTS.keys())


def test_each_insight_has_structured_fields():
    """INS-01 / D-01: every insight dict carries all 11 new structured fields + signal_label.

    Wave 0 stub — passes once Task 2 wires the new fields into every out.append() site.
    """
    bootstrap = _minimal_bootstrap()
    fixtures = [_finished_fixture(1, 2, 1, 0, gw) for gw in range(1, 35)]
    result = compute_insights(
        merged=[], bootstrap=bootstrap,
        fixtures=fixtures, summaries={}, finished_gws=34,
    )
    # Result may be small with empty merged/summaries, but every emitted dict must be complete.
    for ins in result:
        missing = REQUIRED_NEW_FIELDS - ins.keys()
        assert not missing, f"{ins['id']} missing fields: {missing}"


def test_gw_coverage_present():
    """INS-06 / D-01: every emitted insight carries gw_coverage as a non-empty string."""
    bootstrap = _minimal_bootstrap()
    fixtures = [_finished_fixture(1, 2, 1, 0, gw) for gw in range(1, 35)]
    result = compute_insights(
        merged=[], bootstrap=bootstrap,
        fixtures=fixtures, summaries={}, finished_gws=34,
    )
    for ins in result:
        assert isinstance(ins.get('gw_coverage'), str), f"{ins['id']} gw_coverage missing or wrong type"
        assert ins['gw_coverage'].strip() != '', f"{ins['id']} gw_coverage is empty"


def test_signal_label_in_emitted_insights():
    """INS-02: every emitted insight carries a signal_label drawn from the 6-label vocabulary."""
    valid = {'Strong signal', 'Watchlist', 'Weak signal', 'Trap risk', 'Regression risk', 'Hidden gem'}
    bootstrap = _minimal_bootstrap()
    fixtures = [_finished_fixture(1, 2, 1, 0, gw) for gw in range(1, 35)]
    result = compute_insights(
        merged=[], bootstrap=bootstrap,
        fixtures=fixtures, summaries={}, finished_gws=34,
    )
    for ins in result:
        assert ins.get('signal_label') in valid, f"{ins['id']} signal_label='{ins.get('signal_label')}' invalid"
