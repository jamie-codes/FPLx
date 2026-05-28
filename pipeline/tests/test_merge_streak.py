"""Unit tests for merge._compute_streak and merge._compute_form_delta (STREAK-01)."""
import pytest
from merge import _compute_streak, _compute_form_delta


def _start(pts: int) -> dict:
    return {'starts': 1, 'total_points': pts}


def _bench(pts: int = 0) -> dict:
    return {'starts': 0, 'total_points': pts}


# ─── _compute_streak ──────────────────────────────────────────────────────────

def test_streak_four_consecutive():
    """4 consecutive qualifying starts → 4."""
    h = [_start(6)] * 4
    assert _compute_streak(h, element_type=3) == 4


def test_streak_broken_on_last_start():
    """Last start missed threshold → 0."""
    h = [_start(6), _start(6), _start(4)]
    assert _compute_streak(h, element_type=3) == 0


def test_streak_counts_from_most_recent_only():
    """3 qualifying, 1 miss, 2 qualifying → 2 (counts from most recent end)."""
    h = [_start(5), _start(5), _start(5), _start(4), _start(5), _start(5)]
    assert _compute_streak(h, element_type=3) == 2


def test_streak_def_threshold_six():
    """element_type=2 (DEF), threshold 6 — a 5-pt start breaks the streak."""
    h = [_start(6), _start(6), _start(5)]
    assert _compute_streak(h, element_type=2) == 0


def test_streak_gk_threshold_six():
    """element_type=1 (GK), threshold 6."""
    h = [_start(6), _start(7), _start(6)]
    assert _compute_streak(h, element_type=1) == 3


def test_streak_no_starts_returns_none():
    """No starts in history → None."""
    assert _compute_streak([], element_type=3) is None


def test_streak_all_bench_returns_none():
    """All entries have starts=0 → None."""
    h = [_bench(10)] * 5
    assert _compute_streak(h, element_type=3) is None


# ─── _compute_form_delta ──────────────────────────────────────────────────────

def test_form_delta_hot_streak():
    """10 starts, last 5 avg = 8.0, season avg = 5.5 → positive delta."""
    # First 5: 3 pts each (avg 3.0), last 5: 8 pts each (avg 8.0)
    # season_avg = (5*3 + 5*8) / 10 = 55/10 = 5.5; last5_avg = 8.0; delta = 2.5
    h = [_start(3)] * 5 + [_start(8)] * 5
    result = _compute_form_delta(h)
    assert result == pytest.approx(2.5)


def test_form_delta_cold_run():
    """10 starts, last 5 avg = 3.0, season avg = 5.5 → negative delta."""
    h = [_start(8)] * 5 + [_start(3)] * 5
    result = _compute_form_delta(h)
    assert result == pytest.approx(-2.5)


def test_form_delta_on_baseline():
    """All starts same pts → delta = 0.0."""
    h = [_start(5)] * 10
    result = _compute_form_delta(h)
    assert result == pytest.approx(0.0)


def test_form_delta_fewer_than_six_returns_none():
    """Fewer than 6 starts → None."""
    h = [_start(5)] * 5
    assert _compute_form_delta(h) is None


def test_form_delta_exactly_six_starts():
    """Exactly 6 starts → computed (not None)."""
    # First 1: 2 pts, last 5: 7 pts each
    # season_avg = (2 + 5*7) / 6 = 37/6 ≈ 6.167; last5_avg = 7.0; delta ≈ 0.83
    h = [_start(2)] + [_start(7)] * 5
    result = _compute_form_delta(h)
    assert result is not None
    assert result == pytest.approx(round(7.0 - (2 + 35) / 6, 2))
