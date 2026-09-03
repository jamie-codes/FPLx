"""TEAM-01: direction-specific home/away team priors from a completed season."""
import pytest

from team_priors import (
    build_team_season_rates,
    build_promoted_bucket,
    build_prior_difficulty_scores,
    build_team_priors,
)


def _teams(*names):
    return [{'id': i + 1, 'short_name': n} for i, n in enumerate(names)]


def _fix(h, a, hs, as_, finished=True):
    return {'team_h': h, 'team_a': a, 'team_h_score': hs, 'team_a_score': as_,
            'finished': finished, 'event': 1}


class TestSeasonRates:
    def test_splits_scoring_and_conceding_by_venue(self):
        teams = _teams('AAA', 'BBB')
        # AAA at home: 3-0. AAA away: 1-2.
        rates = build_team_season_rates(
            [_fix(1, 2, 3, 0), _fix(2, 1, 2, 1)], teams)
        a = rates['AAA']
        assert (a['gf_home'], a['ga_home']) == (3.0, 0.0)
        assert (a['gf_away'], a['ga_away']) == (1.0, 2.0)
        b = rates['BBB']
        assert (b['gf_home'], b['ga_home']) == (2.0, 1.0)
        assert (b['gf_away'], b['ga_away']) == (0.0, 3.0)

    def test_averages_over_multiple_games_at_each_venue(self):
        teams = _teams('AAA', 'BBB', 'CCC')
        rates = build_team_season_rates(
            [_fix(1, 2, 4, 0), _fix(1, 3, 0, 0),      # AAA home: 4 and 0
             _fix(2, 1, 1, 1), _fix(3, 1, 1, 3)],     # AAA away: 1 and 3
            teams)
        assert rates['AAA']['gf_home'] == 2.0
        assert rates['AAA']['gf_away'] == 2.0

    def test_recomputes_points_from_results(self):
        """The archived bootstrap reads 0 points after FPL's season reset, so
        the table has to come from the scores themselves."""
        teams = _teams('AAA', 'BBB')
        rates = build_team_season_rates(
            [_fix(1, 2, 2, 0), _fix(2, 1, 1, 1)], teams)
        assert rates['AAA']['points'] == 4       # win + draw
        assert rates['BBB']['points'] == 1       # loss + draw

    def test_ignores_unfinished_and_scoreless_fixtures(self):
        teams = _teams('AAA', 'BBB')
        rates = build_team_season_rates([
            _fix(1, 2, 3, 0),
            _fix(2, 1, 9, 9, finished=False),
            {'team_h': 2, 'team_a': 1, 'team_h_score': None,
             'team_a_score': None, 'finished': True},
        ], teams)
        assert rates == {}   # AAA never played away, BBB never played home

    def test_omits_teams_with_no_games_rather_than_reporting_zeros(self):
        """A team with no record must be absent, not present with 0.0 rates —
        0.0 reads as 'never scores', which is a strong and wrong signal."""
        teams = _teams('AAA', 'BBB', 'GHOST')
        rates = build_team_season_rates([_fix(1, 2, 1, 1), _fix(2, 1, 1, 1)], teams)
        assert 'GHOST' not in rates
        assert set(rates) == {'AAA', 'BBB'}


class TestPromotedBucket:
    def test_averages_the_bottom_three_by_points(self):
        rates = {
            f'T{i}': {'gf_home': float(i), 'ga_home': 1.0, 'gf_away': 1.0,
                      'ga_away': 1.0, 'points': i}
            for i in range(1, 7)
        }
        bucket = build_promoted_bucket(rates)
        assert bucket['gf_home'] == pytest.approx(2.0)   # teams 1,2,3

    def test_returns_none_when_the_league_is_too_small_to_have_a_bottom(self):
        rates = {'A': {'gf_home': 1.0, 'ga_home': 1.0, 'gf_away': 1.0,
                       'ga_away': 1.0, 'points': 1}}
        assert build_promoted_bucket(rates) is None


class TestPriorDifficultyScores:
    @staticmethod
    def _league():
        """Six teams: FORT concedes nothing, LEAK concedes heavily,
        GUNS score freely, BLUNT do not."""
        base = dict(gf_home=1.0, ga_home=1.0, gf_away=1.0, ga_away=1.0, points=20)
        out = {n: dict(base) for n in ('MID1', 'MID2', 'MID3', 'FORT', 'LEAK', 'GUNS')}
        out['FORT'].update(ga_home=0.0, ga_away=0.0, points=90)
        out['LEAK'].update(ga_home=3.0, ga_away=3.0, points=5)
        out['GUNS'].update(gf_home=3.0, gf_away=3.0, points=80)
        return out

    def test_attacking_difficulty_is_inverted_conceding(self):
        """Hard to score against == high attacking difficulty."""
        s = build_prior_difficulty_scores(
            self._league(), {1: 'FORT', 2: 'LEAK'})
        assert s[1]['att_home'] == pytest.approx(1.0)   # concede nothing
        assert s[2]['att_home'] == pytest.approx(0.0)   # concede freely

    def test_defensive_difficulty_is_not_inverted_scoring(self):
        """Hard to keep a clean sheet against == high defensive difficulty."""
        s = build_prior_difficulty_scores(
            self._league(), {1: 'GUNS', 2: 'MID1'})
        assert s[1]['def_home'] > s[2]['def_home']

    def test_the_two_directions_are_independent(self):
        """The whole point: one number could not say FORT is hard to score
        against AND unthreatening going forward. Two numbers can."""
        s = build_prior_difficulty_scores(self._league(), {1: 'FORT'})
        assert s[1]['att_home'] == pytest.approx(1.0)   # very hard to score against
        assert s[1]['def_home'] < 0.5                   # but not a scoring threat

    def test_home_and_away_are_rated_separately(self):
        rates = self._league()
        rates['MID1'].update(ga_home=0.0, ga_away=3.0)
        s = build_prior_difficulty_scores(rates, {1: 'MID1'})
        assert s[1]['att_home'] > s[1]['att_away']

    def test_promoted_team_takes_the_bucket_prior_and_is_flagged(self):
        s = build_prior_difficulty_scores(self._league(), {1: 'FORT', 99: 'NEWLY'})
        assert 99 in s
        assert s[99]['is_bucket'] is True
        assert s[1]['is_bucket'] is False
        # Bottom-three mean, so a promoted side must not out-rate the best defence.
        assert s[99]['att_home'] < s[1]['att_home']

    def test_scores_stay_within_the_unit_interval(self):
        s = build_prior_difficulty_scores(self._league(), {i: n for i, n in
                                                           enumerate(self._league(), 1)})
        for v in s.values():
            for k in ('att_home', 'att_away', 'def_home', 'def_away'):
                assert 0.0 <= v[k] <= 1.0

    def test_a_league_with_no_spread_has_no_opinion(self):
        flat = {n: dict(gf_home=1.0, ga_home=1.0, gf_away=1.0, ga_away=1.0, points=10)
                for n in ('A', 'B', 'C', 'D', 'E')}
        s = build_prior_difficulty_scores(flat, {1: 'A'})
        assert s[1]['att_home'] == pytest.approx(0.5)
        assert s[1]['def_home'] == pytest.approx(0.5)

    def test_empty_rates_yield_no_scores(self):
        assert build_prior_difficulty_scores({}, {1: 'AAA'}) == {}


class TestBuildTeamPriors:
    def test_thin_archive_is_refused_rather_than_trusted(self):
        """Half a season of results is not a season rate — callers must fall
        back to the official prior instead of getting a shaky one."""
        teams = _teams('AAA', 'BBB')
        archive = {'fixtures': [_fix(1, 2, 1, 0)] * 10,
                   'bootstrap': {'teams': teams}}
        assert build_team_priors(archive, {'teams': teams}) == {}

    def test_full_archive_produces_scores_keyed_by_live_id(self):
        """Team ids are re-issued each season, so the mapping must go through
        short_name — a live id absent from the archive still resolves."""
        arch_teams = _teams('AAA', 'BBB')          # ids 1, 2 last season
        fixtures = ([_fix(1, 2, 2, 0)] * 100) + ([_fix(2, 1, 1, 1)] * 100)
        archive = {'fixtures': fixtures, 'bootstrap': {'teams': arch_teams}}
        # Same clubs, different ids this season.
        live = {'teams': [{'id': 77, 'short_name': 'BBB'},
                          {'id': 88, 'short_name': 'AAA'}]}
        scores = build_team_priors(archive, live)
        assert set(scores) == {77, 88}
        # AAA won at home 2-0 all season, so they are the harder team to score against.
        assert scores[88]['att_home'] > scores[77]['att_home']
