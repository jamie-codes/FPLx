"""Tests for pipeline/odds_live.py — ODDS-02 (live pre-match odds)."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from odds_live import build_live_odds_lookup, parse_rows
from odds_model import cs_prob, lambdas_from_odds


def _winner_record(home, away, date, h, d, a):
    return {
        'fixture': {'id': 9001, 'date': f'{date}T15:00:00+00:00'},
        'teams': {'home': {'name': home}, 'away': {'name': away}},
        'bookmakers': [{'bets': [{'id': 1, 'values': [
            {'value': 'Home', 'odd': str(h)},
            {'value': 'Draw', 'odd': str(d)},
            {'value': 'Away', 'odd': str(a)},
        ]}]}],
    }


def _totals_record(over, under):
    return {
        'fixture': {'id': 9001},
        'bookmakers': [{'bets': [{'id': 5, 'values': [
            {'value': 'Over 2.5', 'odd': str(over)},
            {'value': 'Under 2.5', 'odd': str(under)},
        ]}]}],
    }


def test_parse_rows_happy_path():
    raw = [{'winner': _winner_record('Manchester City', 'Everton', '2026-08-15',
                                     1.30, 5.5, 9.0),
            'totals': _totals_record(1.55, 2.40)}]
    rows = parse_rows(raw)
    assert len(rows) == 1
    r = rows[0]
    assert r['home'] == 'Manchester City' and r['date'] == '2026-08-15'
    assert r['odds_1x2'] == [1.30, 5.5, 9.0]
    assert r['odds_ou25'] == [1.55, 2.40]


def test_parse_rows_drops_when_totals_missing():
    raw = [{'winner': _winner_record('Arsenal', 'Fulham', '2026-08-15', 1.5, 4.2, 6.5),
            'totals': None}]
    assert parse_rows(raw) == []


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
