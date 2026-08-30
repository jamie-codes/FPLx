"""Tests for pipeline/odds_live.py — ODDS-02 (live pre-match odds)."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import odds_live
from odds_live import build_live_odds_lookup, parse_rows
from odds_model import cs_prob, lambdas_from_odds

# Fixture metadata as /fixtures returns it, keyed by API-FOOTBALL fixture id.
META = {9001: {'home': 'Manchester City', 'away': 'Everton', 'date': '2026-08-15'}}


def _winner_record(h, d, a, fixture_id=9001):
    """An /odds record shaped like the REAL API.

    Regression origin (2026-08-30): this helper used to synthesise a `teams`
    object and a fixture `date`. The live endpoint returns neither — its keys
    are league/fixture/update/bookmakers — so parse_rows dropped every row and
    production printed "Live odds: 0 fixture(s) priced" indefinitely. The test
    passed because the fixture was wrong about the API, so keep this shape
    faithful: identity comes from fixture.id alone.
    """
    return {
        'league': {'id': 39},
        'fixture': {'id': fixture_id, 'timezone': 'UTC'},
        'update': '2026-08-15T00:00:00+00:00',
        'bookmakers': [{'bets': [{'id': 1, 'values': [
            {'value': 'Home', 'odd': str(h)},
            {'value': 'Draw', 'odd': str(d)},
            {'value': 'Away', 'odd': str(a)},
        ]}]}],
    }


def _totals_record(over, under, fixture_id=9001):
    return {
        'fixture': {'id': fixture_id},
        'bookmakers': [{'bets': [{'id': 5, 'values': [
            {'value': 'Over 2.5', 'odd': str(over)},
            {'value': 'Under 2.5', 'odd': str(under)},
        ]}]}],
    }


def test_parse_rows_happy_path():
    raw = [{'winner': _winner_record(1.30, 5.5, 9.0),
            'totals': _totals_record(1.55, 2.40)}]
    rows = parse_rows(raw, META)
    assert len(rows) == 1
    r = rows[0]
    # Team names + date come from the /fixtures lookup, not the odds record.
    assert r['home'] == 'Manchester City' and r['away'] == 'Everton'
    assert r['date'] == '2026-08-15'
    assert r['odds_1x2'] == [1.30, 5.5, 9.0]
    assert r['odds_ou25'] == [1.55, 2.40]


def test_parse_rows_drops_when_totals_missing():
    raw = [{'winner': _winner_record(1.5, 4.2, 6.5), 'totals': None}]
    assert parse_rows(raw, META) == []


def test_parse_rows_drops_fixtures_not_in_upcoming_meta():
    """/odds paging reaches back over the season; records outside the upcoming
    fixture map are played games and must be skipped."""
    raw = [{'winner': _winner_record(1.5, 4.2, 6.5, fixture_id=999999),
            'totals': _totals_record(1.55, 2.40, fixture_id=999999)}]
    assert parse_rows(raw, META) == []


def test_fetch_upcoming_fixtures_queries_league_season_next(monkeypatch):
    seen = {}

    def fake_get(endpoint, params):
        seen['endpoint'], seen['params'] = endpoint, params
        return {'response': [{
            'fixture': {'id': 1557379, 'date': '2026-09-05T14:00:00+00:00'},
            'teams': {'home': {'name': 'Chelsea'}, 'away': {'name': 'Fulham'}},
        }]}

    monkeypatch.setattr(odds_live, '_get', fake_get)
    meta = odds_live.fetch_upcoming_fixtures(season=2026, next_n=10)
    assert seen['endpoint'] == 'fixtures'
    assert seen['params'] == {'league': 39, 'season': 2026, 'next': 10}
    assert meta == {1557379: {'home': 'Chelsea', 'away': 'Fulham',
                              'date': '2026-09-05'}}


def test_fetch_upcoming_fixtures_skips_incomplete_records(monkeypatch):
    monkeypatch.setattr(odds_live, '_get', lambda e, p: {'response': [
        {'fixture': {'id': None, 'date': '2026-09-05T14:00:00+00:00'},
         'teams': {'home': {'name': 'A'}, 'away': {'name': 'B'}}},
        {'fixture': {'id': 5, 'date': '2026-09-05T14:00:00+00:00'}, 'teams': {}},
    ]})
    assert odds_live.fetch_upcoming_fixtures(season=2026) == {}


BOOTSTRAP = {'teams': [
    {'id': 1, 'name': 'Manchester City', 'short_name': 'MCI'},
    {'id': 2, 'name': 'Everton', 'short_name': 'EVE'},
]}
FIXTURES = [{'id': 501, 'event': 1, 'team_h': 1, 'team_a': 2,
             'kickoff_time': '2026-08-15T14:00:00Z'}]


def test_build_lookup_joins_and_computes_cs_prob():
    rows = [{'home': 'Manchester City', 'away': 'Everton', 'date': '2026-08-15',
             'odds_1x2': [1.30, 5.5, 9.0], 'odds_ou25': [1.55, 2.40]}]
    lookup = build_live_odds_lookup(rows, BOOTSTRAP, FIXTURES)
    assert (501, 1) in lookup and (501, 2) in lookup
    lam_h, lam_a = lambdas_from_odds([1.30, 5.5, 9.0], [1.55, 2.40])
    # Heavy favourite at home: their CS prob comes from the opponent's lambda.
    assert abs(lookup[(501, 1)]['cs_prob'] - cs_prob(lam_a)) < 1e-9
    assert lookup[(501, 1)]['cs_prob'] > lookup[(501, 2)]['cs_prob']


def test_build_lookup_skips_unjoinable_rows():
    rows = [{'home': 'Real Madrid', 'away': 'Everton', 'date': '2026-08-15',
             'odds_1x2': [1.3, 5.5, 9.0], 'odds_ou25': [1.55, 2.4]},
            {'home': 'Manchester City', 'away': 'Everton', 'date': '2026-09-01',
             'odds_1x2': [1.3, 5.5, 9.0], 'odds_ou25': [1.55, 2.4]}]
    assert build_live_odds_lookup(rows, BOOTSTRAP, FIXTURES) == {}


def test_run_py_odds_block_present():
    """Structural guard mirroring test_run_avail_wiring."""
    run_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'run.py')
    src = open(run_path, encoding='utf-8').read()
    assert 'from odds_live import get_live_odds_lookup' in src
    assert 'odds_lookup=odds_lookup' in src
    assert 'ODDS_ENABLED' in src
    assert 'odds_cs_weight=1.0 if odds_lookup else 0.0' in src


def test_merge_blends_market_cs_prob():
    """A defender's xPts_1gw must rise when the market says higher CS prob."""
    from merge import _compute_xpts_fixture
    base = _compute_xpts_fixture(
        xg_per90=0.05, xa_per90=0.05, start_prob=1.0, xmins=90, element_type=2,
        defensive_difficulty=0.5, mins_60_prob=1.0, sub_appear_prob=0.0,
        cs_prob_base=0.40, cs_prob_slope=0.30)
    blended = _compute_xpts_fixture(
        xg_per90=0.05, xa_per90=0.05, start_prob=1.0, xmins=90, element_type=2,
        defensive_difficulty=0.5, mins_60_prob=1.0, sub_appear_prob=0.0,
        cs_prob_base=0.40, cs_prob_slope=0.30,
        odds_cs_prob=0.75, odds_cs_weight=1.0)
    assert blended['total'] > base['total']
