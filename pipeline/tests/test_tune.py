"""Tests for pipeline/tune.py — TUNE-01 coordinate descent parameter tuner."""

import json
import os
import tempfile
import pytest

from tune import (
    _promotion_gates,
    _combined_score,
    _read_prior_params,
    run_tuner,
    MIN_FINISHED_GWS,
    BLEND_ALPHA_CANDIDATES,
    FORM_WINDOW_CANDIDATES,
    CS_PROB_BASE_CANDIDATES,
    CS_PROB_SLOPE_CANDIDATES,
    FORM_ACTUAL_BETA_CANDIDATES,
    FORM_DIFFICULTY_GAMMA_CANDIDATES,   # FRM-02
    SUB_APPEAR_WINDOW_CANDIDATES,   # APM-01
)
from tune import _sweep_param
from accuracy import build_fixture_difficulty_lookup, FORM_ACTUAL_BETA, FORM_DIFFICULTY_GAMMA, SUB_APPEAR_WINDOW_GWS  # APM-01


def _make_summaries_and_bootstrap(n_players=5, n_gws=20, xg=0.3, xa=0.1, actual_pts_fn=None):
    """Build minimal summaries + bootstrap for tuner testing.

    actual_pts_fn: callable(player_id, gw) -> int. Defaults to 5 for all.
    """
    if actual_pts_fn is None:
        actual_pts_fn = lambda pid, gw: 5

    elements = []
    summaries = {}
    for pid in range(1, n_players + 1):
        elements.append({
            'id': pid, 'web_name': f'P{pid}',
            'element_type': 3, 'team': 14, 'starts': n_gws,
        })
        history = []
        for gw in range(1, n_gws + 1):
            history.append({
                'round': gw, 'minutes': 90,
                'total_points': actual_pts_fn(pid, gw),
                'expected_goals': xg, 'expected_assists': xa,
                'starts': 1,
            })
        summaries[pid] = {'history': history}

    teams = [{'id': 14, 'short_name': 'TST'}]
    bootstrap = {'elements': elements, 'teams': teams}
    fixtures = [
        {'event': gw, 'team_h': 14, 'team_a': 1,
         'team_h_difficulty': 3, 'team_a_difficulty': 3}
        for gw in range(1, n_gws + 1)
    ]
    return summaries, bootstrap, fixtures


# ── Promotion gate tests ─────────────────────────────────────────────────────

class TestPromotionGates:
    def _metrics(self, haul=0.60, rmse=3.0, captain=0.50):
        return {'haul_hit_rate': haul, 'rmse': rmse, 'captain_hit_rate': captain}

    def test_all_gates_pass(self):
        """Candidate better on all metrics → True."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.48)
        candidate_train  = self._metrics(haul=0.60, rmse=3.0, captain=0.52)   # +5pp haul
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.49)   # val improves
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is True

    def test_fails_insufficient_train_improvement(self):
        """Candidate only 1pp better on train haul hit rate (< 2pp margin) → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.48)
        candidate_train  = self._metrics(haul=0.56, rmse=3.0, captain=0.52)   # only +1pp
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.49)
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_fails_validation_haul_regression(self):
        """Candidate wins on train but loses on validate haul hit rate → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=3.0, captain=0.52)   # +7pp train
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.47)
        candidate_val    = self._metrics(haul=0.50, rmse=3.1, captain=0.49)   # val regression
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_fails_rmse_regression_beyond_threshold(self):
        """RMSE worsens >5% on validate → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.0, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=2.8, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.0, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.20, captain=0.49)  # 6.7% worse
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_passes_rmse_within_threshold(self):
        """RMSE worsens by exactly 4% (within 5% threshold) → gates still pass."""
        current_train    = self._metrics(haul=0.55, rmse=3.0, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=2.9, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.0, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=3.12, captain=0.49)  # 4% worse — ok
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is True

    def test_fails_captain_rate_drops_more_than_2pp(self):
        """Captain hit rate drops >2pp on validate → False."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.50)
        candidate_train  = self._metrics(haul=0.62, rmse=3.0, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.50)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.47)   # -3pp captain
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False

    def test_passes_captain_rate_drops_exactly_2pp(self):
        """Captain hit rate drops exactly 2pp → allowed (boundary condition)."""
        current_train    = self._metrics(haul=0.55, rmse=3.2, captain=0.50)
        candidate_train  = self._metrics(haul=0.62, rmse=3.0, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=3.3, captain=0.50)
        candidate_val    = self._metrics(haul=0.58, rmse=3.1, captain=0.48)   # -2pp exactly
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is True

    def test_fails_when_current_rmse_zero_and_candidate_nonzero(self):
        """When current RMSE is 0, any positive candidate RMSE must fail gate 3."""
        current_train    = self._metrics(haul=0.55, rmse=0.0, captain=0.48)
        candidate_train  = self._metrics(haul=0.62, rmse=0.0, captain=0.52)
        current_val      = self._metrics(haul=0.54, rmse=0.0, captain=0.47)
        candidate_val    = self._metrics(haul=0.58, rmse=1.0,  captain=0.49)
        assert _promotion_gates(current_train, candidate_train, current_val, candidate_val) is False


# ── Combined score tests ─────────────────────────────────────────────────────

class TestCombinedScore:
    def _m(self, haul, rmse, captain):
        return {'haul_hit_rate': haul, 'rmse': rmse, 'captain_hit_rate': captain}

    def test_positive_when_all_metrics_improve(self):
        current   = self._m(0.55, 3.0, 0.50)
        candidate = self._m(0.60, 2.8, 0.55)
        assert _combined_score(current, candidate) > 0

    def test_zero_when_identical(self):
        m = self._m(0.55, 3.0, 0.50)
        assert abs(_combined_score(m, m)) < 1e-9

    def test_higher_is_better(self):
        current = self._m(0.55, 3.0, 0.50)
        good    = self._m(0.65, 2.5, 0.60)
        ok      = self._m(0.57, 2.9, 0.51)
        assert _combined_score(current, good) > _combined_score(current, ok)


# ── _read_prior_params tests ─────────────────────────────────────────────────

class TestReadPriorParams:
    def test_returns_defaults_when_no_cache_file(self, tmp_path):
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == 0.4
        assert params['form_window_gws'] == 5
        assert abs(params['cs_prob_base'] - 0.40) < 1e-9
        assert abs(params['cs_prob_slope'] - 0.30) < 1e-9

    def test_reads_promoted_values_from_cache(self, tmp_path):
        data = {
            'summary': {
                'blend_alpha_used': 0.3,
                'form_window_gws_used': 4,
                'cs_prob_base_used': 0.45,
                'cs_prob_slope_used': 0.25,
            }
        }
        path = tmp_path / 'accuracy_backtest.json'
        path.write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert abs(params['blend_alpha'] - 0.3) < 1e-9
        assert params['form_window_gws'] == 4
        assert abs(params['cs_prob_base'] - 0.45) < 1e-9
        assert abs(params['cs_prob_slope'] - 0.25) < 1e-9

    def test_returns_defaults_on_malformed_json(self, tmp_path):
        (tmp_path / 'accuracy_backtest.json').write_text('not json')
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == 0.4

    def test_returns_defaults_on_wrong_type(self, tmp_path):
        """Non-numeric blend_alpha_used triggers ValueError -> falls back to defaults."""
        data = {'summary': {'blend_alpha_used': 'not_a_float'}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == 0.4

    def test_form_actual_beta_default_in_read_prior_params(self, tmp_path):
        """Missing form_actual_beta_used in summary → returns FORM_ACTUAL_BETA (0.0)."""
        # Write a cache file with no form_actual_beta_used key
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert abs(params['form_actual_beta'] - FORM_ACTUAL_BETA) < 1e-9

    def test_form_difficulty_gamma_default_in_read_prior_params(self, tmp_path):
        """Missing form_difficulty_gamma_used in summary → returns FORM_DIFFICULTY_GAMMA (0.0)."""
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert abs(params['form_difficulty_gamma'] - FORM_DIFFICULTY_GAMMA) < 1e-9

    def test_sub_appear_window_default_in_read_prior_params(self, tmp_path):
        """Missing sub_appear_window_gws_used in summary → returns SUB_APPEAR_WINDOW_GWS (15)."""
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert params['sub_appear_window_gws'] == SUB_APPEAR_WINDOW_GWS


# ── run_tuner gate tests ─────────────────────────────────────────────────────

class TestRunTunerGates:
    def test_skips_when_insufficient_gws(self, tmp_path):
        """run_tuner returns skipped dict when finished_gws < MIN_FINISHED_GWS."""
        result = run_tuner({}, MIN_FINISHED_GWS - 1, {}, [], str(tmp_path))
        assert result.get('skipped') is True

    def test_skips_at_zero_gws(self, tmp_path):
        result = run_tuner({}, 0, {}, [], str(tmp_path))
        assert result.get('skipped') is True


class TestSweepParam:
    def test_no_promotion_when_all_candidates_equal(self, tmp_path):
        """If no candidate improves over current, promoted=False and best=current."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap()
        fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
        teams_by_id = {14: {'short_name': 'TST'}}
        all_gws = list(range(1, 21))
        gws_train = all_gws[:13]
        gws_val = all_gws[13:]
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30,
                  'form_actual_beta': 0.0, 'form_difficulty_gamma': 0.0,
                  'sub_appear_window_gws': 15}

        result = _sweep_param(
            param_name='blend_alpha',
            candidates=[0.4],   # only the current value — nothing to improve
            current_val=0.4,
            params=params,
            summaries=summaries,
            all_gws=all_gws,
            bootstrap=bootstrap,
            fixture_difficulty=fixture_difficulty,
            teams_by_id=teams_by_id,
            gws_train=gws_train,
            gws_validate=gws_val,
        )
        assert result['promoted'] is False
        assert result['best'] == 0.4

    def test_result_has_required_keys(self):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap()
        fixture_difficulty = build_fixture_difficulty_lookup(fixtures)
        all_gws = list(range(1, 21))
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30,
                  'form_actual_beta': 0.0, 'form_difficulty_gamma': 0.0,
                  'sub_appear_window_gws': 15}
        result = _sweep_param(
            'blend_alpha', [0.4], 0.4, params,
            summaries, all_gws, bootstrap, fixture_difficulty,
            {14: {'short_name': 'TST'}}, all_gws[:13], all_gws[13:],
        )
        assert 'current' in result
        assert 'best' in result
        assert 'promoted' in result


class TestRunTunerFull:
    def test_run_tuner_returns_expected_keys(self, tmp_path):
        """run_tuner must return a dict with tuner metadata keys."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        assert 'last_run_at' in result
        assert 'gws_train' in result
        assert 'gws_validate' in result
        assert 'sweep' in result
        assert 'promoted_params' in result

    def test_run_tuner_sweep_covers_all_parameters(self, tmp_path):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        sweep = result['sweep']
        assert 'blend_alpha' in sweep
        assert 'form_window_gws' in sweep
        assert 'cs_prob_base' in sweep
        assert 'cs_prob_slope' in sweep
        assert 'form_actual_beta' in sweep
        assert 'form_difficulty_gamma' in sweep
        assert 'sub_appear_window_gws' in sweep

    def test_run_tuner_promoted_params_contains_all_params(self, tmp_path):
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'blend_alpha' in pp
        assert 'form_window_gws' in pp
        assert 'cs_prob_base' in pp
        assert 'cs_prob_slope' in pp
        assert 'form_actual_beta' in pp
        assert 'form_difficulty_gamma' in pp
        assert 'sub_appear_window_gws' in pp

    def test_run_tuner_train_validate_split_correct(self, tmp_path):
        """Train + validate together must cover all finished GWs with no gaps or overlap."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        train = result['gws_train']
        validate = result['gws_validate']
        assert set(train) | set(validate) == set(range(1, 21))
        assert set(train) & set(validate) == set()

    def test_coordinate_locking_uses_prior_sweep_value(self, tmp_path):
        """promoted_params must reflect locked-in values from all seven sweeps in order.

        Note: this is a structural consistency test — it verifies that promoted_params
        is built from the locked-in values, not that locking actually changed a later
        sweep's outcome (which would require engineering a parameter interaction fixture).
        The implementation-level locking (params[param_name] = result['best']) is verified
        by reading the code; this test catches any regression where promoted_params diverges
        from sweep results.
        """
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        # All seven params in promoted_params must match their sweep's best value
        assert result['promoted_params']['blend_alpha']     == result['sweep']['blend_alpha']['best']
        assert result['promoted_params']['form_window_gws'] == result['sweep']['form_window_gws']['best']
        assert result['promoted_params']['cs_prob_base']    == result['sweep']['cs_prob_base']['best']
        assert result['promoted_params']['cs_prob_slope']   == result['sweep']['cs_prob_slope']['best']
        assert result['promoted_params']['form_actual_beta'] == result['sweep']['form_actual_beta']['best']
        assert result['promoted_params']['form_difficulty_gamma'] == result['sweep']['form_difficulty_gamma']['best']
        assert result['promoted_params']['sub_appear_window_gws'] == result['sweep']['sub_appear_window_gws']['best']

    def test_form_actual_beta_in_promoted_params(self, tmp_path):
        """promoted_params dict contains form_actual_beta key."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'form_actual_beta' in pp
        assert pp['form_actual_beta'] >= 0.0
        assert pp['form_actual_beta'] <= 0.5

    def test_form_difficulty_gamma_in_promoted_params(self, tmp_path):
        """promoted_params dict contains form_difficulty_gamma key with value in [0.0, 1.0]."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'form_difficulty_gamma' in pp
        assert pp['form_difficulty_gamma'] >= 0.0
        assert pp['form_difficulty_gamma'] <= 1.0

    def test_sub_appear_window_in_promoted_params(self, tmp_path):
        """promoted_params dict contains sub_appear_window_gws key with value in [10, 20]."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'sub_appear_window_gws' in pp
        assert pp['sub_appear_window_gws'] in [10, 12, 15, 18, 20]
