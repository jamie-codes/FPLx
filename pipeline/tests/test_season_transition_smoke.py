# pipeline/tests/test_season_transition_smoke.py
import copy
from capture_season import load_season_archive, season_label
from season_transition_smoke import build_synthetic_transition

_ARCHIVE = load_season_archive()


def test_synthetic_bumps_season_label_to_2026_27():
    syn = build_synthetic_transition(_ARCHIVE)
    assert season_label(syn['bootstrap_live']) == '2026-27'
    assert season_label(syn['bootstrap_offseason']) == '2026-27'


def test_offseason_has_no_current_event_live_has_gw1_current():
    syn = build_synthetic_transition(_ARCHIVE)
    off = syn['bootstrap_offseason']['events']
    live = syn['bootstrap_live']['events']
    assert not any(e.get('is_current') for e in off)
    assert any(e.get('is_current') for e in live)
    assert all(not e.get('finished') for e in live)  # 0 finished GWs


def test_three_clubs_swapped_with_novel_short_names():
    syn = build_synthetic_transition(_ARCHIVE)
    teams = syn['bootstrap_live']['teams']
    assert len(teams) == 20
    shorts = {t['short_name'] for t in teams}
    assert set(syn['new_short_names']) <= shorts
    assert set(syn['new_short_names']) == {'XYZ', 'QQQ', 'ZZZ'}
    # every player references a team that exists
    team_ids = {t['id'] for t in teams}
    for el in syn['bootstrap_live']['elements']:
        assert el['team'] in team_ids


def test_current_stats_zeroed_for_coldstart():
    syn = build_synthetic_transition(_ARCHIVE)
    for el in syn['bootstrap_live']['elements']:
        assert int(el.get('minutes', 0)) == 0
        assert float(el.get('expected_goals', 0) or 0) == 0.0
        assert int(el.get('total_points', 0)) == 0


def test_fixtures_are_gw1_future_unfinished():
    syn = build_synthetic_transition(_ARCHIVE)
    assert syn['fixtures'], 'must produce fixtures'
    for f in syn['fixtures']:
        assert f['event'] == 1
        assert f['finished'] is False
        assert f.get('team_h_score') is None
        assert 'kickoff_time' in f
