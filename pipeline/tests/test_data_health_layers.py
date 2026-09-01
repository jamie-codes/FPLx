"""Health checks for the external data layers (2026-08-30).

Motivation: three separate silent-zero failures shipped and survived in
production because a dead layer looks exactly like a quiet one —
  * AVAIL-01 injuries queried a foreign fixture-id namespace -> empty 200s,
  * ODDS-02 read a `teams` object the endpoint never returns -> every row
    dropped,
  * merge.py tiered every fixture 'easy' when no games had been played.
Each was found by chance. These checks make the same class of failure surface
in data_health.json (and therefore the UI) instead of waiting to be noticed.
"""
import data_health


def _fixtures(tiers):
    return [{'difficulty_tier': t} for t in tiers]


class TestInjuryMappedCheck:
    def test_zero_mapped_is_an_error(self):
        c = data_health._check_injury_mapped(0)
        assert c['id'] == 'injury_players_mapped'
        assert c['status'] == 'error'

    def test_thin_coverage_warns(self):
        assert data_health._check_injury_mapped(4)['status'] == 'warn'

    def test_healthy_coverage_ok(self):
        c = data_health._check_injury_mapped(80)
        assert c['status'] == 'ok'
        assert c['value'] == 80


class TestOddsPricedCheck:
    def test_zero_priced_is_an_error(self):
        c = data_health._check_odds_priced(0)
        assert c['id'] == 'odds_fixtures_priced'
        assert c['status'] == 'error'

    def test_partial_coverage_warns(self):
        assert data_health._check_odds_priced(3)['status'] == 'warn'

    def test_full_gameweek_ok(self):
        assert data_health._check_odds_priced(12)['status'] == 'ok'


class TestFdrSpreadCheck:
    def test_single_tier_across_the_league_is_an_error(self):
        """The exact shape of the GW1 bug: every fixture rated 'easy'."""
        merged = [{'fixtures': _fixtures(['easy'] * 5)} for _ in range(20)]
        c = data_health._check_fdr_spread(merged)
        assert c['id'] == 'fdr_tier_spread'
        assert c['status'] == 'error'

    def test_near_degenerate_spread_warns(self):
        merged = [{'fixtures': _fixtures(['easy'] * 5)} for _ in range(19)]
        merged.append({'fixtures': _fixtures(['hard'] * 5)})
        assert data_health._check_fdr_spread(merged)['status'] == 'warn'

    def test_healthy_spread_ok(self):
        merged = [{'fixtures': _fixtures(['easy', 'medium', 'hard', 'medium', 'easy'])}
                  for _ in range(20)]
        assert data_health._check_fdr_spread(merged)['status'] == 'ok'

    def test_no_fixture_data_is_omitted_not_failed(self):
        # Off-season / empty merge must not raise or cry error.
        assert data_health._check_fdr_spread([]) is None
        assert data_health._check_fdr_spread([{'fixtures': []}]) is None


class TestStartProbStaleness:
    """STALE-01: ever-present players rated as benchwarmers means the prior is
    overpowering this season's evidence — the Kinsky-at-18% failure."""

    def _squad(self, n, start_prob):
        merged = [{'id': i, 'start_prob': start_prob} for i in range(n)]
        summaries = {i: {'history': [{'starts': 1}, {'starts': 1}]} for i in range(n)}
        return merged, summaries

    def test_majority_understated_is_an_error(self):
        merged, summaries = self._squad(30, 0.18)
        c = data_health._check_start_prob_staleness(merged, summaries)
        assert c['id'] == 'start_prob_staleness'
        assert c['status'] == 'error'

    def test_healthy_ratings_are_ok(self):
        merged, summaries = self._squad(30, 0.95)
        assert data_health._check_start_prob_staleness(merged, summaries)['status'] == 'ok'

    def test_omitted_when_too_few_ever_presents_to_judge(self):
        merged, summaries = self._squad(5, 0.18)
        assert data_health._check_start_prob_staleness(merged, summaries) is None

    def test_rotated_players_are_not_counted_as_ever_present(self):
        # A player who genuinely did not start every game must not make a low
        # start_prob look like a fault.
        merged = [{'id': i, 'start_prob': 0.2} for i in range(30)]
        summaries = {i: {'history': [{'starts': 1}, {'starts': 0}]} for i in range(30)}
        assert data_health._check_start_prob_staleness(merged, summaries) is None

    def test_omitted_without_summaries(self):
        assert data_health._check_start_prob_staleness([{'id': 1}], None) is None


class TestWiring:
    def _ts(self):
        return {'merged_players.json': '2026-01-01T00:00:00+00:00'}

    def test_layer_checks_are_omitted_when_counts_are_none(self, tmp_path):
        merged = [{'understat_id': 1, 'xg_per90': 0.5}]
        result = data_health.compute_data_health(merged, self._ts(), str(tmp_path))
        ids = {c['id'] for c in result['sanity_checks']}
        assert 'injury_players_mapped' not in ids
        assert 'odds_fixtures_priced' not in ids

    def test_layer_checks_appear_when_counts_supplied(self, tmp_path):
        merged = [{'understat_id': 1, 'xg_per90': 0.5,
                   'fixtures': _fixtures(['easy', 'medium', 'hard'])}]
        result = data_health.compute_data_health(
            merged, self._ts(), str(tmp_path),
            injury_mapped_count=80, odds_priced_count=12)
        by_id = {c['id']: c for c in result['sanity_checks']}
        assert by_id['injury_players_mapped']['status'] == 'ok'
        assert by_id['odds_fixtures_priced']['status'] == 'ok'
        assert by_id['fdr_tier_spread']['status'] == 'ok'

    def test_run_py_passes_the_real_counts(self):
        """Structural guard: the checks are worthless if run.py never supplies
        the counts (mirrors test_run_avail_wiring's approach)."""
        import os
        run_path = os.path.join(os.path.dirname(__file__), '..', 'run.py')
        with open(run_path, encoding='utf-8') as f:
            src = f.read()
        assert 'injury_mapped_count=injury_mapped_count' in src
        assert 'odds_priced_count=odds_priced_count' in src
        assert 'injury_mapped_count = len(_built)' in src

    def test_dead_layers_drive_overall_status_to_error(self, tmp_path):
        merged = [{'understat_id': 1, 'xg_per90': 0.5}]
        result = data_health.compute_data_health(
            merged, self._ts(), str(tmp_path),
            injury_mapped_count=0, odds_priced_count=0)
        by_id = {c['id']: c for c in result['sanity_checks']}
        assert by_id['injury_players_mapped']['status'] == 'error'
        assert by_id['odds_fixtures_priced']['status'] == 'error'
