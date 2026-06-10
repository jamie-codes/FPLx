"""Tests for pipeline/tune.py — TUNE-01 coordinate descent parameter tuner.

BT-03: _sweep_param now uses the leakage-free run_backtest evaluator.
Tests rebuilt on archive-shaped synthetic data (same pattern as test_backtest.py).
"""

import json
import os
import tempfile
import pytest

from tune import (
    _promotion_gates,
    _combined_score,
    _read_prior_params,
    _map_tune_to_bt_params,
    _safe_haul_hit,
    run_tuner,
    MIN_FINISHED_GWS,
    BLEND_ALPHA_CANDIDATES,
    FORM_WINDOW_CANDIDATES,
    CS_PROB_BASE_CANDIDATES,
    CS_PROB_SLOPE_CANDIDATES,
    FORM_ACTUAL_BETA_CANDIDATES,
    FORM_DIFFICULTY_GAMMA_CANDIDATES,   # FRM-02
    SUB_APPEAR_WINDOW_CANDIDATES,   # APM-01
    CS_TEAM_FORM_SLOPE_CANDIDATES,  # CSF-01
    CS_DEF_FORM_WINDOW_CANDIDATES,  # CSF-01
    _FROZEN_PARAMS,
    _SWEEP_ORDER_NAMES,
)
from tune import _sweep_param
from accuracy import FORM_ACTUAL_BETA, FORM_DIFFICULTY_GAMMA, SUB_APPEAR_WINDOW_GWS  # APM-01


# ── Synthetic archive helpers (BT-03: mirrors test_backtest.py pattern) ──────

def _entry(rnd, fixture_id, minutes=90, xg=0.3, xa=0.1, pts=2, starts=1,
           was_home=True, dc=0, xgc=0.0, saves=0):
    return {
        'round': rnd, 'fixture': fixture_id, 'minutes': minutes,
        'expected_goals': str(xg), 'expected_assists': str(xa),
        'total_points': pts, 'starts': starts, 'was_home': was_home,
        'opponent_team': 2 if was_home else 1,
        'defensive_contribution': dc,
        'expected_goals_conceded': xgc,
        'saves': saves,
    }


def _make_tune_archive(n_gws=20, n_players=5, xg=0.3, xa=0.1, pts=2):
    """Build a minimal archive-shaped dict for tune.py honest-evaluator tests.

    Two teams (1, 2); fixtures have id, event, team_h/a, difficulty fields.
    Players belong to team 1; each has n_gws entries of 90 min.
    Players need at least 270 prior minutes to be eligible (first eligible GW = 4).
    """
    fixtures = []
    for g in range(1, n_gws + 1):
        fixtures.append({
            'id': 100 + g, 'event': g, 'team_h': 1, 'team_a': 2,
            'team_h_score': 1, 'team_a_score': 1, 'finished': True,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
        })

    elements = []
    summaries = {}
    for pid in range(1, n_players + 1):
        elements.append({
            'id': pid, 'web_name': f'P{pid}',
            'element_type': 3, 'team': 1,
        })
        history = []
        for g in range(1, n_gws + 1):
            e = _entry(g, 100 + g, minutes=90, xg=xg, xa=xa, pts=pts,
                       was_home=True)
            history.append(e)
        summaries[pid] = {'history': history}

    bootstrap = {
        'elements': elements,
        'events': [{'id': g, 'finished': True} for g in range(1, n_gws + 1)],
        'teams': [{'id': 1, 'short_name': 'TST'}, {'id': 2, 'short_name': 'OPP'}],
    }
    return {
        'bootstrap': bootstrap,
        'fixtures': fixtures,
        'understat': {},
        'summaries': summaries,
        'manifest': {'season': 'synthetic'},
    }


def _make_summaries_and_bootstrap(n_players=5, n_gws=20, xg=0.3, xa=0.1, actual_pts_fn=None):
    """Build minimal summaries + bootstrap for tuner testing.

    actual_pts_fn: callable(player_id, gw) -> int. Defaults to 5 for all.
    Returns (summaries, bootstrap, fixtures) where fixtures have id fields
    compatible with run_backtest.
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
                'starts': 1, 'fixture': 100 + gw, 'was_home': True,
                'defensive_contribution': 0,
                'expected_goals_conceded': 0.0,
                'saves': 0,
            })
        summaries[pid] = {'history': history}

    teams = [{'id': 14, 'short_name': 'TST'}, {'id': 1, 'short_name': 'OPP'}]
    bootstrap = {
        'elements': elements,
        'teams': teams,
        'events': [{'id': g, 'finished': True} for g in range(1, n_gws + 1)],
    }
    fixtures = [
        {'id': 100 + gw, 'event': gw, 'team_h': 14, 'team_a': 1,
         'team_h_difficulty': 3, 'team_a_difficulty': 3,
         'team_h_score': 1, 'team_a_score': 1, 'finished': True}
        for gw in range(1, n_gws + 1)
    ]
    return summaries, bootstrap, fixtures


def _default_tune_params():
    """Return a full set of TUNE-01 params for tests."""
    return {
        'blend_alpha': 0.4, 'form_window_gws': 5,
        'cs_prob_base': 0.40, 'cs_prob_slope': 0.30,
        'form_actual_beta': 0.0, 'form_difficulty_gamma': 0.0,
        'sub_appear_window_gws': 15,
        'cs_team_form_slope': 0.0, 'cs_def_form_window_gws': 6,
        'atf_slope': 0.0, 'atf_window_gws': 6,
        'fas_slope': 0.4, 'defcon_scale': 0.0,
    }


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

    def test_haul_hit_none_treated_as_zero(self):
        """haul_hit_rate=None (no haulers in GW range) is treated as 0.0 in gates.

        A candidate with None haul (= 0.0) cannot beat a current with None (= 0.0)
        by more than GATE_MARGIN_PP (0.02), so Gate 1 must fail.
        """
        none_metrics = {'haul_hit_rate': None, 'rmse': 3.0, 'captain_hit_rate': 0.5}
        assert _promotion_gates(none_metrics, none_metrics, none_metrics, none_metrics) is False

    def test_none_haul_candidate_vs_nonzero_current_fails_gate1(self):
        """Candidate with None haul (=0.0) vs current with haul=0.5: cannot promote."""
        current  = {'haul_hit_rate': 0.5, 'rmse': 3.0, 'captain_hit_rate': 0.5}
        cand_none = {'haul_hit_rate': None, 'rmse': 2.5, 'captain_hit_rate': 0.6}
        assert _promotion_gates(current, cand_none, current, cand_none) is False


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
        from accuracy import BLEND_ALPHA, FORM_WINDOW_GWS
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == BLEND_ALPHA
        assert params['form_window_gws'] == FORM_WINDOW_GWS
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
        from accuracy import BLEND_ALPHA
        (tmp_path / 'accuracy_backtest.json').write_text('not json')
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == BLEND_ALPHA

    def test_returns_defaults_on_wrong_type(self, tmp_path):
        """Non-numeric blend_alpha_used triggers ValueError -> falls back to defaults."""
        from accuracy import BLEND_ALPHA
        data = {'summary': {'blend_alpha_used': 'not_a_float'}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert params['blend_alpha'] == BLEND_ALPHA

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

    def test_cs_team_form_slope_default_in_read_prior_params(self, tmp_path):
        """Missing cs_team_form_slope_used in summary → returns CS_TEAM_FORM_SLOPE (0.0)."""
        from accuracy import CS_TEAM_FORM_SLOPE
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert abs(params['cs_team_form_slope'] - CS_TEAM_FORM_SLOPE) < 1e-9

    def test_cs_def_form_window_default_in_read_prior_params(self, tmp_path):
        """Missing cs_def_form_window_gws_used in summary → returns CS_DEF_FORM_WINDOW_GWS (6)."""
        from accuracy import CS_DEF_FORM_WINDOW_GWS
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert params['cs_def_form_window_gws'] == CS_DEF_FORM_WINDOW_GWS


def test_atf_slope_default_in_read_prior_params():
    """Missing key in summary → returns ATF_SLOPE default."""
    from tune import _read_prior_params
    from accuracy import ATF_SLOPE
    result = _read_prior_params(cache_dir='nonexistent_dir_xyz')
    assert result['atf_slope'] == ATF_SLOPE


def test_atf_window_default_in_read_prior_params():
    """Missing key in summary → returns ATF_WINDOW_GWS default."""
    from tune import _read_prior_params
    from accuracy import ATF_WINDOW_GWS
    result = _read_prior_params(cache_dir='nonexistent_dir_xyz')
    assert result['atf_window_gws'] == ATF_WINDOW_GWS


def test_fas_slope_default_in_read_prior_params():
    """Missing key in summary → returns FAS_SLOPE default."""
    from tune import _read_prior_params
    from accuracy import FAS_SLOPE
    result = _read_prior_params(cache_dir='nonexistent_dir_xyz')
    assert result['fas_slope'] == FAS_SLOPE


def test_defcon_scale_default_in_read_prior_params():
    """Missing key in summary → returns DEFCON_SCALE default."""
    from tune import _read_prior_params
    from accuracy import DEFCON_SCALE
    result = _read_prior_params(cache_dir='nonexistent_dir_xyz')
    assert result['defcon_scale'] == DEFCON_SCALE


# ── Param mapping tests (BT-03) ──────────────────────────────────────────────

def test_fas_slope_maps_to_fixture_attack_slope():
    """_map_tune_to_bt_params translates fas_slope to fixture_attack_slope."""
    tune_p = _default_tune_params()
    bt_p = _map_tune_to_bt_params(tune_p)
    assert 'fixture_attack_slope' in bt_p
    assert bt_p['fixture_attack_slope'] == tune_p['fas_slope']
    assert 'fas_slope' not in bt_p


def test_map_tune_to_bt_params_all_other_names_unchanged():
    """All BT-02-supported params (except fas_slope) pass through unchanged."""
    tune_p = _default_tune_params()
    bt_p = _map_tune_to_bt_params(tune_p)
    for key in ['blend_alpha', 'form_window_gws', 'cs_prob_base', 'cs_prob_slope',
                'cs_team_form_slope', 'cs_def_form_window_gws',
                'atf_slope', 'atf_window_gws', 'defcon_scale']:
        assert key in bt_p
        assert bt_p[key] == tune_p[key]


def test_map_tune_frozen_params_dropped():
    """Frozen TUNE-01 params (not supported by BT-02 v1) are dropped from the mapping."""
    tune_p = _default_tune_params()
    bt_p = _map_tune_to_bt_params(tune_p)
    for frozen in _FROZEN_PARAMS:
        assert frozen not in bt_p, f"Frozen param '{frozen}' should not appear in BT-02 params"


# ── Haul-hit-rate None handling tests (BT-03) ────────────────────────────────

def test_haul_hit_none_treated_as_zero():
    """_safe_haul_hit returns 0.0 for None haul_hit_rate (no haulers in range)."""
    assert _safe_haul_hit({'haul_hit_rate': None}) == 0.0
    assert _safe_haul_hit({'haul_hit_rate': 0.5}) == pytest.approx(0.5)
    assert _safe_haul_hit({'haul_hit_rate': 0.0}) == 0.0


def test_combined_score_none_haul_as_zero():
    """_combined_score handles None haul_hit_rate on either side without error."""
    current  = {'haul_hit_rate': None, 'rmse': 3.0, 'captain_hit_rate': 0.5}
    better   = {'haul_hit_rate': 0.1,  'rmse': 2.8, 'captain_hit_rate': 0.6}
    score = _combined_score(current, better)
    # 0.1 - 0.0 = +0.1 haul; RMSE improvement > 0; captain improvement > 0 -> positive
    assert score > 0


# ── run_tuner gate tests ─────────────────────────────────────────────────────

class TestRunTunerGates:
    def test_skips_when_insufficient_gws(self, tmp_path):
        """run_tuner returns skipped dict when finished_gws < MIN_FINISHED_GWS."""
        result = run_tuner({}, MIN_FINISHED_GWS - 1, {}, [], str(tmp_path))
        assert result.get('skipped') is True

    def test_skips_at_zero_gws(self, tmp_path):
        result = run_tuner({}, 0, {}, [], str(tmp_path))
        assert result.get('skipped') is True


# ── _sweep_param tests (BT-03: honest evaluator, archive-shaped data) ────────

class TestSweepParam:
    def _make_archive_and_params(self, n_gws=20):
        """Return (archive, params, train_first, train_last, val_first, val_last)."""
        archive = _make_tune_archive(n_gws=n_gws)
        params = _default_tune_params()
        all_gws = list(range(1, n_gws + 1))
        n_validate = max(1, n_gws // 3)
        gws_validate = all_gws[-n_validate:]
        gws_train = all_gws[:-n_validate]
        train_first = max(gws_train[0], 5)
        train_last = gws_train[-1]
        val_first = gws_validate[0]
        val_last = gws_validate[-1]
        return archive, params, train_first, train_last, val_first, val_last

    def test_no_promotion_when_only_current_candidate(self):
        """If the only candidate equals current_val, promoted=False and best=current."""
        archive, params, tf, tl, vf, vl = self._make_archive_and_params()
        result = _sweep_param(
            param_name='blend_alpha',
            candidates=[0.4],   # only the current value — nothing to improve
            current_val=0.4,
            params=params,
            archive=archive,
            train_first=tf,
            train_last=tl,
            val_first=vf,
            val_last=vl,
        )
        assert result['promoted'] is False
        assert result['best'] == 0.4

    def test_result_has_required_keys(self):
        archive, params, tf, tl, vf, vl = self._make_archive_and_params()
        result = _sweep_param(
            param_name='blend_alpha',
            candidates=[0.4],
            current_val=0.4,
            params=params,
            archive=archive,
            train_first=tf,
            train_last=tl,
            val_first=vf,
            val_last=vl,
        )
        assert 'current' in result
        assert 'best' in result
        assert 'promoted' in result

    def test_promoted_result_has_metric_keys(self):
        """When a promotion happens, the result dict has train/validate metric keys."""
        # We can't easily force a promotion with synthetic uniform data;
        # verify the key set by constructing a promotion via monkey-patching.
        # Instead, just verify non-promoted result does NOT have metric keys.
        archive, params, tf, tl, vf, vl = self._make_archive_and_params()
        result = _sweep_param(
            param_name='blend_alpha',
            candidates=[0.4],
            current_val=0.4,
            params=params,
            archive=archive,
            train_first=tf,
            train_last=tl,
            val_first=vf,
            val_last=vl,
        )
        # Non-promoted: no metric keys
        assert 'train_haul_hit_rate' not in result
        assert 'validate_haul_hit_rate' not in result


# ── run_tuner full integration tests ─────────────────────────────────────────

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

    def test_run_tuner_sweep_covers_exactly_10_active_params(self, tmp_path):
        """sweep dict must have exactly the 10 actively-swept parameters.

        The 3 frozen params (form_actual_beta, form_difficulty_gamma,
        sub_appear_window_gws) must be ABSENT from sweep.
        """
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        sweep = result['sweep']
        # Exactly the 10 swept params
        assert set(sweep.keys()) == set(_SWEEP_ORDER_NAMES)
        assert len(sweep) == 10
        # Frozen params must NOT be in sweep
        for frozen in _FROZEN_PARAMS:
            assert frozen not in sweep, f"Frozen param '{frozen}' must not appear in sweep"

    def test_run_tuner_sweep_contains_swept_params(self, tmp_path):
        """All 10 swept parameters appear in the sweep dict."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        sweep = result['sweep']
        for name in _SWEEP_ORDER_NAMES:
            assert name in sweep

    def test_run_tuner_promoted_params_contains_all_13_params(self, tmp_path):
        """promoted_params must have all 13 params (10 swept + 3 frozen)."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        all_params = list(_SWEEP_ORDER_NAMES) + list(_FROZEN_PARAMS)
        for name in all_params:
            assert name in pp, f"Expected '{name}' in promoted_params"
        # Total: exactly 13
        assert len(pp) == 13

    def test_frozen_params_present_in_promoted_params_at_priors(self, tmp_path):
        """Frozen params in promoted_params equal their prior (default) values."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert abs(pp['form_actual_beta'] - FORM_ACTUAL_BETA) < 1e-9
        assert abs(pp['form_difficulty_gamma'] - FORM_DIFFICULTY_GAMMA) < 1e-9
        assert pp['sub_appear_window_gws'] == SUB_APPEAR_WINDOW_GWS

    def test_run_tuner_train_validate_split_correct(self, tmp_path):
        """Train + validate together must cover all finished GWs with no gaps or overlap."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        train = result['gws_train']
        validate = result['gws_validate']
        assert set(train) | set(validate) == set(range(1, 21))
        assert set(train) & set(validate) == set()

    def test_coordinate_locking_uses_prior_sweep_value(self, tmp_path):
        """promoted_params must reflect locked-in values from all sweeps.

        The 10 swept params match their sweep's best value.
        The 3 frozen params are at their priors (not in sweep dict).
        """
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        sweep = result['sweep']
        # Swept params: promoted_params must match sweep best
        for name in _SWEEP_ORDER_NAMES:
            assert pp[name] == sweep[name]['best'], (
                f"promoted_params['{name}'] = {pp[name]} != sweep['{name}']['best'] = {sweep[name]['best']}"
            )
        # Frozen params: at their default priors
        assert abs(pp['form_actual_beta'] - FORM_ACTUAL_BETA) < 1e-9
        assert abs(pp['form_difficulty_gamma'] - FORM_DIFFICULTY_GAMMA) < 1e-9
        assert pp['sub_appear_window_gws'] == SUB_APPEAR_WINDOW_GWS

    def test_form_actual_beta_in_promoted_params(self, tmp_path):
        """promoted_params dict contains form_actual_beta key at its frozen prior."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'form_actual_beta' in pp
        assert abs(pp['form_actual_beta'] - FORM_ACTUAL_BETA) < 1e-9

    def test_form_difficulty_gamma_in_promoted_params(self, tmp_path):
        """promoted_params dict contains form_difficulty_gamma key at its frozen prior."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'form_difficulty_gamma' in pp
        assert abs(pp['form_difficulty_gamma'] - FORM_DIFFICULTY_GAMMA) < 1e-9

    def test_sub_appear_window_in_promoted_params(self, tmp_path):
        """promoted_params dict contains sub_appear_window_gws key at its frozen prior."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'sub_appear_window_gws' in pp
        assert pp['sub_appear_window_gws'] == SUB_APPEAR_WINDOW_GWS


# ── _sweep_param promotion/selection path tests (BT-03 CI gap) ───────────────
#
# Two variants as required by the review:
#   A) Monkeypatched run_backtest — deterministic gate+selection coverage.
#   B) Non-tied metrics test — proves candidates produce different scores.
#
# The monkeypatch variant is preferred for gate-logic coverage because the
# gates require >2pp train haul improvement, which is hard to guarantee with
# the uniform synthetic archive data.


def _make_bt_result(haul, rmse, captain):
    """Wrap raw metric values in the run_backtest return shape."""
    return {
        'metrics': {
            'haul_hit_rate': haul,
            'rmse': rmse,
            'captain_hit_rate': captain,
        }
    }


class TestSweepParamPromotion:
    """BT-03 CI gap: gate+selection path of _sweep_param (monkeypatch variant).

    run_backtest is patched in tune's namespace so call order is deterministic:
      call 0 — baseline train  (current_val=0.0, train range)
      call 1 — baseline val    (current_val=0.0, val range)
      call 2 — candidate train (candidate=0.8,   train range)
      call 3 — candidate val   (candidate=0.8,   val range)
    Baseline metrics are deliberately poor; candidate metrics are clearly better,
    clearing all four gates.
    """

    def _make_archive_and_params(self, n_gws=12):
        archive = _make_tune_archive(n_gws=n_gws)
        params = _default_tune_params()
        params['fas_slope'] = 0.0  # starting value to be swept
        all_gws = list(range(1, n_gws + 1))
        n_validate = max(1, n_gws // 3)
        gws_validate = all_gws[-n_validate:]
        gws_train = all_gws[:-n_validate]
        train_first = max(gws_train[0], 5)
        train_last = gws_train[-1]
        val_first = gws_validate[0]
        val_last = gws_validate[-1]
        return archive, params, train_first, train_last, val_first, val_last

    def test_promotion_and_winner_via_monkeypatch(self, monkeypatch):
        """Gate+selection path: monkeypatched run_backtest → asserts promoted=True,
        best=0.8, and train/validate metric keys present (non-vacuous evaluation).
        """
        import tune as tune_mod

        # Controlled metric sequence matching the 4 run_backtest calls in _sweep_param.
        bt_results = [
            _make_bt_result(haul=0.30, rmse=3.5, captain=0.30),  # call 0: baseline train
            _make_bt_result(haul=0.28, rmse=3.6, captain=0.29),  # call 1: baseline val
            _make_bt_result(haul=0.55, rmse=3.2, captain=0.50),  # call 2: candidate 0.8 train
            _make_bt_result(haul=0.50, rmse=3.3, captain=0.45),  # call 3: candidate 0.8 val
        ]
        call_iter = iter(bt_results)

        def fake_run_backtest(**kwargs):
            return next(call_iter)

        monkeypatch.setattr(tune_mod, 'run_backtest', fake_run_backtest)

        archive, params, tf, tl, vf, vl = self._make_archive_and_params()
        result = tune_mod._sweep_param(
            param_name='fas_slope',
            candidates=[0.0, 0.8],  # 0.0 == current_val is skipped; 0.8 is evaluated
            current_val=0.0,
            params=params,
            archive=archive,
            train_first=tf,
            train_last=tl,
            val_first=vf,
            val_last=vl,
        )

        # Core assertions: promotion happened, correct winner chosen.
        assert result['promoted'] is True, "Expected promotion with clearly better candidate"
        assert result['best'] == 0.8, f"Expected best=0.8, got {result['best']}"
        assert result['current'] == 0.0

        # Metric keys must be present on a promoted result (verifies non-vacuous evaluation).
        for key in ('train_haul_hit_rate', 'train_rmse',
                    'validate_haul_hit_rate', 'validate_rmse'):
            assert key in result, f"Expected '{key}' in promoted result"

        # Candidate metrics differ from baseline (proves evaluation was not vacuous).
        assert result['train_haul_hit_rate'] != pytest.approx(0.30)
        assert result['validate_haul_hit_rate'] != pytest.approx(0.28)

    def test_no_promotion_when_gates_fail_via_monkeypatch(self, monkeypatch):
        """Gate failure path: candidate train improvement is only 1pp (<2pp gate) → no promotion."""
        import tune as tune_mod

        bt_results = [
            _make_bt_result(haul=0.50, rmse=3.0, captain=0.50),  # baseline train
            _make_bt_result(haul=0.48, rmse=3.1, captain=0.49),  # baseline val
            _make_bt_result(haul=0.51, rmse=2.9, captain=0.52),  # candidate train: +1pp only
            _make_bt_result(haul=0.52, rmse=2.8, captain=0.53),  # candidate val
        ]
        call_iter = iter(bt_results)

        def fake_run_backtest(**kwargs):
            return next(call_iter)

        monkeypatch.setattr(tune_mod, 'run_backtest', fake_run_backtest)

        archive, params, tf, tl, vf, vl = self._make_archive_and_params()
        result = tune_mod._sweep_param(
            param_name='fas_slope',
            candidates=[0.0, 0.8],
            current_val=0.0,
            params=params,
            archive=archive,
            train_first=tf,
            train_last=tl,
            val_first=vf,
            val_last=vl,
        )

        assert result['promoted'] is False
        assert result['best'] == 0.0  # stays at current_val

    def test_best_of_two_promoted_candidates_selected_via_monkeypatch(self, monkeypatch):
        """Selection: two candidates both clear gates; higher combined score wins.

        Call sequence:
          call 0: baseline train, call 1: baseline val
          call 2: candidate 0.4 train, call 3: candidate 0.4 val
          call 4: candidate 0.8 train, call 5: candidate 0.8 val
        Candidate 0.8 has a better combined val score → must be chosen.
        """
        import tune as tune_mod

        bt_results = [
            _make_bt_result(haul=0.30, rmse=3.5, captain=0.30),  # call 0: baseline train
            _make_bt_result(haul=0.28, rmse=3.6, captain=0.29),  # call 1: baseline val
            # candidate 0.4: clears gates (>2pp train haul improvement)
            _make_bt_result(haul=0.55, rmse=3.3, captain=0.48),  # call 2: 0.4 train
            _make_bt_result(haul=0.50, rmse=3.4, captain=0.45),  # call 3: 0.4 val
            # candidate 0.8: also clears gates but has better val score
            _make_bt_result(haul=0.60, rmse=3.1, captain=0.52),  # call 4: 0.8 train
            _make_bt_result(haul=0.58, rmse=3.2, captain=0.50),  # call 5: 0.8 val
        ]
        call_iter = iter(bt_results)

        def fake_run_backtest(**kwargs):
            return next(call_iter)

        monkeypatch.setattr(tune_mod, 'run_backtest', fake_run_backtest)

        archive, params, tf, tl, vf, vl = self._make_archive_and_params()
        result = tune_mod._sweep_param(
            param_name='fas_slope',
            candidates=[0.0, 0.4, 0.8],  # 0.0 skipped; 0.4 and 0.8 evaluated
            current_val=0.0,
            params=params,
            archive=archive,
            train_first=tf,
            train_last=tl,
            val_first=vf,
            val_last=vl,
        )

        assert result['promoted'] is True
        # 0.8 must win: its val metrics (haul=0.58, rmse=3.2, captain=0.50) score
        # higher in _combined_score against baseline val (haul=0.28, rmse=3.6, captain=0.29)
        assert result['best'] == 0.8, f"Expected best=0.8 (higher combined score), got {result['best']}"


class TestSweepParamNonTiedMetrics:
    """Non-tied metrics variant: two candidates produce different _combined_score inputs.

    Uses _make_tune_archive helpers to build an archive with heterogeneous
    fixture difficulties so that fas_slope=0.0 vs fas_slope=0.8 yield different
    xPts predictions and therefore different metric values.
    """

    def _make_heterogeneous_archive(self, n_gws=12):
        """Build an archive where half the fixtures are easy (difficulty=2) and
        half are hard (difficulty=5), so fixture_attack_slope changes rankings.
        """
        fixtures = []
        for g in range(1, n_gws + 1):
            diff = 2 if g % 2 == 0 else 5  # alternate easy/hard
            fixtures.append({
                'id': 100 + g, 'event': g, 'team_h': 14, 'team_a': 1,
                'team_h_difficulty': diff, 'team_a_difficulty': diff,
                'team_h_score': 1, 'team_a_score': 1, 'finished': True,
            })

        elements = []
        summaries = {}
        n_players = 5
        for pid in range(1, n_players + 1):
            xg = 0.8 if pid == 1 else 0.1  # player 1 is the striker
            elements.append({
                'id': pid, 'web_name': f'P{pid}',
                'element_type': 3, 'team': 14,
            })
            history = []
            for g in range(1, n_gws + 1):
                pts = 10 if (pid == 1 and g % 2 == 0) else 2  # striker hauls in easy GWs
                history.append({
                    'round': g, 'fixture': 100 + g, 'minutes': 90,
                    'expected_goals': str(xg), 'expected_assists': '0.05',
                    'total_points': pts, 'starts': 1, 'was_home': True,
                    'opponent_team': 1,
                    'defensive_contribution': 0,
                    'expected_goals_conceded': 0.0,
                    'saves': 0,
                })
            summaries[pid] = {'history': history}

        bootstrap = {
            'elements': elements,
            'events': [{'id': g, 'finished': True} for g in range(1, n_gws + 1)],
            'teams': [{'id': 14, 'short_name': 'TST'}, {'id': 1, 'short_name': 'OPP'}],
        }
        return {
            'bootstrap': bootstrap,
            'fixtures': fixtures,
            'understat': {},
            'summaries': summaries,
            'manifest': {'season': 'synthetic'},
        }

    def test_different_fas_slope_candidates_produce_different_metrics(self):
        """fas_slope=0.0 and fas_slope=0.8 must produce different run_backtest metrics.

        This proves _sweep_param's evaluation loop is non-vacuous: varying the
        parameter changes the predictions and therefore the scored metrics.
        """
        from backtest import run_backtest as real_run_backtest
        from tune import _map_tune_to_bt_params, _metrics_from_backtest

        archive = self._make_heterogeneous_archive(n_gws=12)
        params_base = _default_tune_params()
        params_base['fas_slope'] = 0.0

        params_slope = _default_tune_params()
        params_slope['fas_slope'] = 0.8

        bt_base = _map_tune_to_bt_params(params_base)
        bt_slope = _map_tune_to_bt_params(params_slope)

        # Use a training range large enough for signal but not the whole archive
        result_0 = real_run_backtest(archive=archive, params=bt_base,
                                     mode='deploy', first_gw=5, last_gw=8)
        result_8 = real_run_backtest(archive=archive, params=bt_slope,
                                     mode='deploy', first_gw=5, last_gw=8)

        m0 = _metrics_from_backtest(result_0)
        m8 = _metrics_from_backtest(result_8)

        from tune import _combined_score
        score0 = _combined_score(m0, m0)   # baseline vs itself = 0
        score8 = _combined_score(m0, m8)   # baseline vs slope=0.8

        # The two candidates must produce different combined scores (non-tied evaluation)
        assert score0 != pytest.approx(score8), (
            f"Expected fas_slope=0.0 and fas_slope=0.8 to produce different combined "
            f"scores; got score0={score0:.6f} score8={score8:.6f}"
        )
