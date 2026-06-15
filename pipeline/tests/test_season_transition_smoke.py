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


def test_extract_ts_record_keys_reads_team_colours():
    from season_transition_smoke import _extract_ts_record_keys, _TEAM_COLOURS_TS
    badge = _extract_ts_record_keys(_TEAM_COLOURS_TS, 'TEAM_BADGE_CODE')
    colours = _extract_ts_record_keys(_TEAM_COLOURS_TS, 'TEAM_COLOURS')
    assert 'ARS' in badge and 'LIV' in badge      # known real entries
    assert 'ARS' in colours and 'MUN' in colours
    assert 'XYZ' not in badge                       # fabricated club absent


def test_coverage_report_flags_fabricated_clubs():
    from season_transition_smoke import build_synthetic_transition, coverage_report
    from capture_season import load_season_archive
    syn = build_synthetic_transition(load_season_archive())
    rep = coverage_report(syn['bootstrap_live'])
    # all four tables present in the report
    assert set(rep) == {'TEAM_BADGE_CODE', 'TEAM_COLOURS',
                        'FOOTBALL_DATA_TO_FPL', 'WIKI_CLUB_TO_FPL'}
    # the 3 fabricated clubs are missing from the short-name-keyed asset tables
    for sn in ('XYZ', 'QQQ', 'ZZZ'):
        assert sn in rep['TEAM_BADGE_CODE']
        assert sn in rep['TEAM_COLOURS']


def test_run_smoke_passes_on_synthetic_transition(tmp_path):
    from season_transition_smoke import run_smoke
    result = run_smoke()
    assert result['ok'] is True, result['hard_checks']
    hc = result['hard_checks']
    assert hc['no_exception'] is True
    assert hc['offseason_gate'] is True       # IS_OFF_SEASON True for offseason boot
    assert hc['live_gate'] is True            # IS_OFF_SEASON False for live boot
    assert hc['season_label'] is True
    assert hc['artefacts_present'] is True
    assert hc['no_unknown_team'] is True
    assert hc['coldstart_engaged'] is True
    assert 'coverage' in result


def test_run_smoke_detects_unknown_team(tmp_path):
    # a player on a non-existent team id must trip no_unknown_team
    from season_transition_smoke import run_smoke, build_synthetic_transition
    from capture_season import load_season_archive
    syn = build_synthetic_transition(load_season_archive())
    syn['bootstrap_live']['elements'][0]['team'] = 9999  # orphan team id
    result = run_smoke(bootstrap=syn['bootstrap_live'], fixtures=syn['fixtures'],
                       summaries=syn['summaries'], _offseason_bootstrap=syn['bootstrap_offseason'])
    assert result['hard_checks']['no_unknown_team'] is False
    assert result['ok'] is False


def test_run_smoke_writes_nothing_to_real_cache(tmp_path):
    import os
    before = set(os.listdir('pipeline/cache')) if os.path.isdir('pipeline/cache') else set()
    from season_transition_smoke import run_smoke
    run_smoke()
    after = set(os.listdir('pipeline/cache')) if os.path.isdir('pipeline/cache') else set()
    assert before == after, 'smoke must not write to the real cache'
