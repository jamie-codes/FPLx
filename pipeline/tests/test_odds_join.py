# pipeline/tests/test_odds_join.py
import math
import pytest
from odds_join import FOOTBALL_DATA_TO_FPL, resolve_team_ids, build_odds_lookup


def _archive(teams, fixtures):
    return {'bootstrap': {'teams': teams}, 'fixtures': fixtures}


# Minimal 2-team archive across one GW
_TEAMS = [
    {'id': 1, 'name': 'Liverpool', 'short_name': 'LIV'},
    {'id': 2, 'name': 'Bournemouth', 'short_name': 'BOU'},
    {'id': 3, 'name': 'Manchester Utd', 'short_name': 'MUN'},
    {'id': 4, 'name': 'Tottenham Hotspur', 'short_name': 'TOT'},
]
_FIXTURES = [
    {'id': 10, 'event': 1, 'team_h': 1, 'team_a': 2, 'kickoff_time': '2025-08-15T19:00:00Z'},
    {'id': 11, 'event': 1, 'team_h': 3, 'team_a': 4, 'kickoff_time': '2025-08-16T14:00:00Z'},
]


def test_aliases_resolve_against_bootstrap():
    name_to_id = resolve_team_ids(_TEAMS)
    # football-data names map through the alias table to FPL team ids
    assert name_to_id['Liverpool'] == 1
    assert name_to_id['Man United'] == 3      # alias -> 'Manchester Utd'
    assert name_to_id['Tottenham'] == 4       # alias -> 'Tottenham Hotspur'


def test_build_lookup_keys_and_cs_prob():
    rows = [
        {'date': '15/08/2025', 'home': 'Liverpool', 'away': 'Bournemouth',
         'fthg': 4, 'ftag': 2, 'odds_1x2': (1.29, 6.02, 8.68), 'odds_ou25': (1.36, 3.05)},
        {'date': '16/08/2025', 'home': 'Man United', 'away': 'Tottenham',
         'fthg': 0, 'ftag': 1, 'odds_1x2': (2.1, 3.4, 3.5), 'odds_ou25': (2.0, 1.8)},
    ]
    lk = build_odds_lookup(rows, _archive(_TEAMS, _FIXTURES))
    # every team in both fixtures present, keyed by (gw, team_id)
    assert set(lk.keys()) == {(1, 1), (1, 2), (1, 3), (1, 4)}
    # Liverpool (heavy favourite) CS-prob = exp(-lam_bournemouth); Bournemouth low
    assert lk[(1, 1)]['cs_prob'] > lk[(1, 2)]['cs_prob']
    # attack_difficulty is 0..1 and inverse to goal_exp within the GW
    for v in lk.values():
        assert 0.0 <= v['attack_difficulty'] <= 1.0
        assert v['goal_exp'] >= 0.0
    # team with the highest goal_exp has the lowest attack_difficulty
    hi = max(lk.values(), key=lambda v: v['goal_exp'])
    lo_diff = min(lk.values(), key=lambda v: v['attack_difficulty'])
    assert hi is lo_diff


def test_unmapped_team_raises():
    rows = [{'date': '15/08/2025', 'home': 'Liverpool', 'away': 'Nonexistent FC',
             'fthg': 1, 'ftag': 0, 'odds_1x2': (1.5, 4.0, 6.0), 'odds_ou25': (1.7, 2.1)}]
    with pytest.raises(Exception):
        build_odds_lookup(rows, _archive(_TEAMS, _FIXTURES))


def test_unmatched_fixture_raises():
    rows = [{'date': '01/01/2099', 'home': 'Liverpool', 'away': 'Bournemouth',
             'fthg': 1, 'ftag': 0, 'odds_1x2': (1.5, 4.0, 6.0), 'odds_ou25': (1.7, 2.1)}]
    with pytest.raises(Exception):
        build_odds_lookup(rows, _archive(_TEAMS, _FIXTURES))
