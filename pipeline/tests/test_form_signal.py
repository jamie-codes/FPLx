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
    # Without recency (equal weights): per-90 = 1.0/5 * 90/90 = 0.2 per GW per 90.
    # With linear weights 0.5..1.0 most-recent-weighted: form > 0.2 (above non-recency baseline).
    # Exact calculation: weighted_xgxa=1.0, weighted_mins=337.5, form=0.2667.
    assert form is not None
    assert form > 0.22  # recency boost confirmed: 0.2667 > 0.22 > non-recency 0.2
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


# ── FRM-01: actual G+A blend tests ──────────────────────────────────────────

def test_beta_zero_backward_compatible():
    """FRM-01: beta=0.0 (default) produces identical result when goals_scored absent."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1}
        for i in range(1, 6)
    ]
    result_default, n1 = _compute_form_signal(history)
    result_explicit, n2 = _compute_form_signal(history, beta=0.0)
    assert result_default == result_explicit
    assert n1 == n2 == 5


def test_beta_one_returns_pure_actual_ga():
    """FRM-01: beta=1.0 returns recency-weighted actual G+A per-90 only.

    5 GWs × 90 min × (1 goal + 1 assist) → actual_ga_per90 = 2.0 exactly.
    (Recency weights cancel out: every entry has same G+A per minute.)
    """
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 1}
        for i in range(1, 6)
    ]
    form, n = _compute_form_signal(history, beta=1.0)
    assert form is not None
    assert abs(form - 2.0) < 0.01
    assert n == 5


def test_beta_half_is_blend():
    """FRM-01: beta=0.5 result is between pure xG+xA and pure actual."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 1}
        for i in range(1, 6)
    ]
    pure_xgxa, _ = _compute_form_signal(history, beta=0.0)
    pure_actual, _ = _compute_form_signal(history, beta=1.0)
    blend, _ = _compute_form_signal(history, beta=0.5)
    assert blend is not None
    assert min(pure_xgxa, pure_actual) <= blend <= max(pure_xgxa, pure_actual)


def test_outperformer_higher_with_positive_beta():
    """FRM-01: player scoring more than xG (outperformer) gets higher form when beta>0."""
    # xG+xA = 0.3 per 90; actual = 1.0 per 90 (outperforming)
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 0}
        for i in range(1, 6)
    ]
    form_no_actual, _ = _compute_form_signal(history, beta=0.0)
    form_with_actual, _ = _compute_form_signal(history, beta=0.3)
    assert form_with_actual > form_no_actual


def test_underperformer_lower_with_positive_beta():
    """FRM-01: player scoring less than xG (underperformer) gets lower form when beta>0."""
    # xG+xA = 1.1 per 90; actual = 0.0 per 90 (underperforming)
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.3,
         'goals_scored': 0, 'assists': 0}
        for i in range(1, 6)
    ]
    form_no_actual, _ = _compute_form_signal(history, beta=0.0)
    form_with_actual, _ = _compute_form_signal(history, beta=0.3)
    assert form_with_actual < form_no_actual


def test_dgw_aggregates_goals_and_assists():
    """FRM-01: DGW round sums goals_scored and assists across both entries."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'goals_scored': 0, 'assists': 0},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 0, 'assists': 0},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.2, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 0},   # DGW match 1
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'goals_scored': 1, 'assists': 1},   # DGW match 2 — same round
    ]
    # With beta=1.0: only actual G+A matters.
    # Round 3 total: 2 goals + 1 assist = 3 G+A in 150 min.
    # weights (n=3): [0.5, 0.75, 1.0]
    # weighted_actual = 0*0.5 + 0*0.75 + 3*1.0 = 3.0
    # weighted_mins   = 90*0.5 + 90*0.75 + 150*1.0 = 262.5
    # actual_ga_per90 = 3.0/262.5 * 90 ≈ 1.0286
    form_actual, n = _compute_form_signal(history, beta=1.0)
    assert n == 3   # 3 unique rounds, not 4 entries
    assert form_actual is not None
    assert abs(form_actual - round(3.0 / 262.5 * 90, 4)) < 0.001


# ── FRM-02: fixture-difficulty-weighted form tests ───────────────────────────

def test_gamma_zero_backward_compatible():
    """FRM-02: gamma=0.0 (default) produces identical result when difficulty absent."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1}
        for i in range(1, 6)
    ]
    result_default, n1 = _compute_form_signal(history)
    result_explicit, n2 = _compute_form_signal(history, gamma=0.0)
    assert result_default == result_explicit
    assert n1 == n2 == 5


def test_gamma_one_hard_fixture_higher_weight():
    """FRM-02: at gamma=1.0, hard-fixture rounds with higher xG+xA contribute more weight."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 4, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 5, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
    ]
    form_no_weight, _ = _compute_form_signal(history, gamma=0.0)
    form_weighted, _ = _compute_form_signal(history, gamma=1.0)
    assert form_no_weight is not None
    assert form_weighted is not None
    assert form_weighted > form_no_weight


def test_gamma_half_is_between_zero_and_one():
    """FRM-02: gamma=0.5 result is between gamma=0.0 and gamma=1.0 results."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.5, 'expected_assists': 0.0,
         'difficulty': 5 if i % 2 == 1 else 1}
        for i in range(1, 6)
    ]
    form_0, _ = _compute_form_signal(history, gamma=0.0)
    form_1, _ = _compute_form_signal(history, gamma=1.0)
    form_half, _ = _compute_form_signal(history, gamma=0.5)
    assert form_half is not None
    assert min(form_0, form_1) <= form_half <= max(form_0, form_1)


def test_hard_fixture_scorer_higher_with_positive_gamma():
    """FRM-02: player whose xG+xA came in difficulty-5 GWs gets higher form at gamma>0."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 4, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 5, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 5},
    ]
    form_base, _ = _compute_form_signal(history, gamma=0.0)
    form_diff, _ = _compute_form_signal(history, gamma=0.4)
    assert form_diff > form_base


def test_easy_fixture_scorer_lower_with_positive_gamma():
    """FRM-02: player whose xG+xA came in difficulty-1 GWs gets lower form at gamma>0."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.0, 'difficulty': 1},
        {'round': 4, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 5},
        {'round': 5, 'minutes': 90, 'expected_goals': 0.1, 'expected_assists': 0.0, 'difficulty': 5},
    ]
    form_base, _ = _compute_form_signal(history, gamma=0.0)
    form_diff, _ = _compute_form_signal(history, gamma=0.4)
    assert form_diff < form_base


def test_missing_difficulty_defaults_to_midrange():
    """FRM-02: history entries without 'difficulty' key treated as difficulty=3 (factor=1.0)."""
    history_no_diff = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1}
        for i in range(1, 6)
    ]
    history_mid_diff = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1,
         'difficulty': 3}
        for i in range(1, 6)
    ]
    form_no, n1 = _compute_form_signal(history_no_diff, gamma=0.8)
    form_mid, n2 = _compute_form_signal(history_mid_diff, gamma=0.8)
    assert form_no == form_mid
    assert n1 == n2 == 5


def test_dgw_difficulty_averaged():
    """FRM-02: DGW round averages difficulty across both entries.

    Round 3 has two entries with difficulty=2 and difficulty=4 → avg=3 → factor=1.0 at any gamma.
    """
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 3},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 3},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 2},
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1, 'difficulty': 4},
    ]
    form_0, n0 = _compute_form_signal(history, gamma=0.0)
    form_1, n1 = _compute_form_signal(history, gamma=1.0)
    assert n0 == n1 == 3
    assert form_0 == form_1
