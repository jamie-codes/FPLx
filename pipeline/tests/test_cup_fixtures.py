"""CUP-01: European + domestic cup dates, fetched rather than hardcoded.

`european_cup_dates.EUROPEAN_CUP_DATES` was an empty dict that a comment asked
someone to fill in "per actual cup fixture calendar at execution time". Nobody
ever did, so the rotation-risk flag resolved to False for every team all
season — City played a Champions League matchday three days before a Saturday
14:00 kickoff and nothing in the app knew (2026-09-01).

A hardcoded list would rot the same way, so these dates come from api-football
and refresh weekly, like the photo map.
"""
import json

import cup_fixtures


def _fx(team_h, team_a, date, league=2, h_id=None, a_id=None):
    return {
        'fixture': {'id': 1, 'date': date},
        'league': {'id': league},
        'teams': {'home': {'name': team_h, 'id': h_id},
                  'away': {'name': team_a, 'id': a_id}},
    }


BOOTSTRAP = {
    'teams': [
        {'id': 14, 'name': 'Man City', 'short_name': 'MCI'},
        {'id': 1, 'name': 'Arsenal', 'short_name': 'ARS'},
        {'id': 12, 'name': 'Liverpool', 'short_name': 'LIV'},
    ],
    'elements': [],
}


class TestParse:
    def test_extracts_both_teams_and_the_date(self):
        rows = cup_fixtures.parse_cup_fixtures([
            _fx('Manchester City', 'Real Madrid', '2026-10-13T20:00:00+00:00',
                h_id=50, a_id=541)])
        assert rows == [
            {'team_name': 'Manchester City', 'team_af_id': 50,
             'date': '2026-10-13', 'league_id': 2},
            {'team_name': 'Real Madrid', 'team_af_id': 541,
             'date': '2026-10-13', 'league_id': 2}]

    def test_skips_records_missing_a_date_or_teams(self):
        assert cup_fixtures.parse_cup_fixtures([
            {'fixture': {'date': None}, 'teams': {'home': {'name': 'A'}, 'away': {'name': 'B'}}},
            {'fixture': {'date': '2026-10-13T20:00:00+00:00'}, 'teams': {}},
        ]) == []


class TestBuildMap:
    def test_maps_english_clubs_to_fpl_team_ids(self):
        rows = cup_fixtures.parse_cup_fixtures([
            _fx('Manchester City', 'Real Madrid', '2026-10-13T20:00:00+00:00'),
            _fx('Arsenal', 'Bayern Munich', '2026-11-03T20:00:00+00:00'),
        ])
        m = cup_fixtures.build_cup_date_map(rows, BOOTSTRAP)
        assert m == {'14': ['2026-10-13'], '1': ['2026-11-03']}

    def test_non_english_opponents_are_dropped(self):
        rows = cup_fixtures.parse_cup_fixtures(
            [_fx('Real Madrid', 'Bayern Munich', '2026-10-13T20:00:00+00:00')])
        assert cup_fixtures.build_cup_date_map(rows, BOOTSTRAP) == {}

    def test_dates_are_deduped_and_sorted(self):
        rows = cup_fixtures.parse_cup_fixtures([
            _fx('Manchester City', 'Real Madrid', '2026-11-03T20:00:00+00:00'),
            _fx('Manchester City', 'Arsenal', '2026-10-13T20:00:00+00:00'),
            _fx('Arsenal', 'Manchester City', '2026-10-13T18:00:00+00:00'),
        ])
        assert cup_fixtures.build_cup_date_map(rows, BOOTSTRAP)['14'] == \
            ['2026-10-13', '2026-11-03']


class TestNamesakeRejection:
    """The live map put a cup date on 2026-09-05 for Man City — the same day as
    their league game, which no club can play. Name matching had let a namesake
    (women's/youth) side through. Matching on api-football team id fixes it."""

    PL_IDS = {50: 'Manchester City'}       # the real men's club

    def test_namesake_with_a_different_id_is_rejected(self):
        rows = cup_fixtures.parse_cup_fixtures([
            _fx('Manchester City W', 'Chelsea W', '2026-09-05T13:00:00+00:00',
                h_id=9999, a_id=9998)])
        assert cup_fixtures.build_cup_date_map(rows, BOOTSTRAP, self.PL_IDS) == {}

    def test_the_real_club_still_maps(self):
        rows = cup_fixtures.parse_cup_fixtures([
            _fx('Manchester City', 'Real Madrid', '2026-10-13T20:00:00+00:00',
                h_id=50, a_id=541)])
        assert cup_fixtures.build_cup_date_map(rows, BOOTSTRAP, self.PL_IDS) == \
            {'14': ['2026-10-13']}

    def test_falls_back_to_name_matching_without_ids(self):
        rows = cup_fixtures.parse_cup_fixtures([
            _fx('Manchester City', 'Real Madrid', '2026-10-13T20:00:00+00:00',
                h_id=50, a_id=541)])
        assert cup_fixtures.build_cup_date_map(rows, BOOTSTRAP, None) == \
            {'14': ['2026-10-13']}


class TestLoad:
    def test_load_returns_int_keys_for_the_rotation_consumer(self):
        """_apply_rotation_risk looks up by int FPL team_id; JSON keys are strings."""
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'm.json')
            with open(p, 'w', encoding='utf-8') as f:
                json.dump({'_season': 2026, 'dates': {'14': ['2026-10-13']}}, f)
            loaded = cup_fixtures.load_cup_dates(p)
            assert loaded == {14: ['2026-10-13']}
            assert all(isinstance(k, int) for k in loaded)

    def test_missing_or_corrupt_file_is_an_empty_map(self, tmp_path):
        assert cup_fixtures.load_cup_dates(str(tmp_path / 'nope.json')) == {}
        bad = tmp_path / 'bad.json'
        bad.write_text('{oops', encoding='utf-8')
        assert cup_fixtures.load_cup_dates(str(bad)) == {}


def test_rotation_risk_consumer_accepts_the_built_map():
    """End-to-end: a City cup date 3 days before a City PL fixture must flag."""
    from gw_intel import _apply_rotation_risk
    rows = cup_fixtures.parse_cup_fixtures(
        [_fx('Manchester City', 'Real Madrid', '2026-10-14T20:00:00+00:00')])
    built = cup_fixtures.build_cup_date_map(rows, BOOTSTRAP)
    dates = {int(k): v for k, v in built.items()}
    merged = [{'id': 1, 'team': 14}, {'id': 2, 'team': 12}]
    fixtures = [{'finished': False, 'kickoff_time': '2026-10-17T14:00:00Z',
                 'team_h': 14, 'team_a': 12}]
    out = _apply_rotation_risk(merged, fixtures, dates)
    assert out[0]['rotation_risk'] is True     # City: UCL Wed -> PL Sat
    assert out[1]['rotation_risk'] is False    # Liverpool: no cup date


def test_rotation_risk_only_considers_the_next_league_fixture():
    """CUP-01: scoping to the NEXT fixture is what makes the flag mean anything.

    Scanning every remaining fixture of the season flagged 569 of 626 players
    the moment real cup dates arrived — over a season almost every club has a
    cup game within 3 days of some league game.
    """
    from gw_intel import _apply_rotation_risk
    merged = [{'id': 1, 'team': 14}]
    fixtures = [
        # Next up: a clean weekend, nothing midweek before it.
        {'finished': False, 'kickoff_time': '2026-09-05T14:00:00Z',
         'team_h': 14, 'team_a': 1},
        # Months away, right after a cup date — must NOT flag today.
        {'finished': False, 'kickoff_time': '2026-10-17T14:00:00Z',
         'team_h': 14, 'team_a': 1},
    ]
    out = _apply_rotation_risk(merged, fixtures, {14: ['2026-10-14']})
    assert out[0]['rotation_risk'] is False

    # Once that congested round IS next, the flag fires.
    out = _apply_rotation_risk(merged, fixtures[1:], {14: ['2026-10-14']})
    assert out[0]['rotation_risk'] is True
