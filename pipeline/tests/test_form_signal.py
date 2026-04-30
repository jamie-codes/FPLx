"""Unit tests for pipeline/merge.py::_compute_form_signal (Phase 42, ACC-01).

Wave 0 RED — these will fail with ImportError until Task 1 adds the function.
Mirrors test_accuracy.py structure (pytest + conftest.py sys.path injection).
"""

import pytest
from merge import _compute_form_signal


def test_form_signal_returns_none_when_insufficient_history():
    """ACC-01: form signal returns (None, 0) when fewer than 3 GWs played."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.0},
    ]
    form, n = _compute_form_signal(history)
    assert form is None
    assert n == 0


def test_form_signal_recency_weighting():
    """ACC-01: most recent GW dominates via linear weights (1.0 most recent → 0.5 oldest)."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.0, 'expected_assists': 0.0}
        for i in range(1, 5)
    ]
    history.append({'round': 5, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.2})
    form, n = _compute_form_signal(history, window_gws=5)
    # Without recency: simple mean = 1.0/5 = 0.222 per 90.
    # With linear weights 0.5..1.0 most-recent-weighted: form > 0.30
    assert form is not None
    assert form > 0.30
    assert n == 5


def test_form_signal_dgw_aggregation():
    """ACC-01: DGW entries (same round) sum, not duplicate. n == unique rounds."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.4, 'expected_assists': 0.2},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.2, 'expected_assists': 0.1},  # DGW match 1
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.2},  # DGW match 2
    ]
    form, n = _compute_form_signal(history)
    assert form is not None
    assert n == 3   # 3 unique rounds, not 4 entries


def test_form_signal_min_minutes_threshold():
    """ACC-01: returns (None, 0) when total minutes in window < min_minutes (default 270)."""
    # 4 GWs × 60 min = 240 mins (below 270 threshold)
    history = [
        {'round': i, 'minutes': 60, 'expected_goals': 0.5, 'expected_assists': 0.3}
        for i in range(1, 5)
    ]
    form, n = _compute_form_signal(history, window_gws=5, min_minutes=270)
    assert form is None
    assert n == 0


def test_form_signal_handles_string_expected_goals():
    """Pitfall 7: FPL element-summary returns expected_goals as string decimals."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': '0.5', 'expected_assists': '0.3'}
        for i in range(1, 6)
    ]
    form, n = _compute_form_signal(history)
    assert form is not None
    assert n == 5
