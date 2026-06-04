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
)


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


# ── run_tuner gate tests ─────────────────────────────────────────────────────

class TestRunTunerGates:
    def test_skips_when_insufficient_gws(self, tmp_path):
        """run_tuner returns skipped dict when finished_gws < MIN_FINISHED_GWS."""
        result = run_tuner({}, MIN_FINISHED_GWS - 1, {}, [], str(tmp_path))
        assert result.get('skipped') is True

    def test_skips_at_zero_gws(self, tmp_path):
        result = run_tuner({}, 0, {}, [], str(tmp_path))
        assert result.get('skipped') is True
