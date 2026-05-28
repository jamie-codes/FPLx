"""Unit tests for merge._compute_consistency_rate (FLOOR-01)."""
import pytest
from merge import _compute_consistency_rate


def _make_history(entries):
    """Build a list of history dicts from (started, total_points) tuples."""
    return [{'starts': s, 'total_points': p} for s, p in entries]


def test_all_returns_mid():
    """element_type=3 (MID), 10 starts all >= 5 pts -> 1.0"""
    h = _make_history([(1, 5)] * 10)
    assert _compute_consistency_rate(h, element_type=3) == pytest.approx(1.0)


def test_partial_returns_mid():
    """element_type=3, 6 of 10 starts >= 5 pts -> 0.6"""
    h = _make_history([(1, 5)] * 6 + [(1, 4)] * 4)
    assert _compute_consistency_rate(h, element_type=3) == pytest.approx(0.6)


def test_def_threshold_six():
    """element_type=2 (DEF), threshold is 6 — a 5-pt start counts as a miss."""
    h = _make_history([(1, 6)] * 5 + [(1, 5)] * 5)
    # 5 qualifying out of 10 starts
    assert _compute_consistency_rate(h, element_type=2) == pytest.approx(0.5)


def test_fewer_than_min_starts_returns_none():
    """Fewer than CONSISTENCY_MIN_STARTS (4) starts in window -> None."""
    h = _make_history([(1, 10)] * 3)
    assert _compute_consistency_rate(h, element_type=3) is None


def test_window_uses_last_ten_only():
    """15 starts in history -> only last 10 counted."""
    # First 5: all below threshold, last 10: all above
    h = _make_history([(1, 1)] * 5 + [(1, 5)] * 10)
    assert _compute_consistency_rate(h, element_type=3) == pytest.approx(1.0)


def test_gk_threshold_six():
    """element_type=1 (GK), threshold is 6."""
    h = _make_history([(1, 6)] * 8 + [(1, 5)] * 2)
    # 8 qualifying out of 10
    assert _compute_consistency_rate(h, element_type=1) == pytest.approx(0.8)


def test_fwd_threshold_five():
    """element_type=4 (FWD), threshold is 5."""
    h = _make_history([(1, 5)] * 7 + [(1, 4)] * 3)
    assert _compute_consistency_rate(h, element_type=4) == pytest.approx(0.7)


def test_all_bench_returns_none():
    """All history entries have starts=0 -> None (no qualifying starts)."""
    h = _make_history([(0, 10)] * 10)
    assert _compute_consistency_rate(h, element_type=3) is None


def test_empty_history_returns_none():
    """Empty history -> None."""
    assert _compute_consistency_rate([], element_type=3) is None
