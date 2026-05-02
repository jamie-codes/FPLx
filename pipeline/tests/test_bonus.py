"""Pytest unit tests for compute_bonus_predictions and _compute_player_bonus_ev (Phase 53 BPS-01)."""

import pytest

from bonus import _compute_player_bonus_ev, compute_bonus_predictions


def _element(element_type=3, player_id=1):
    return {'id': player_id, 'element_type': element_type}


def _hist(bonus_pts, starts_field=1, minutes=90, clean_sheet=0):
    """One element-summary history row.

    bonus_pts: 0/1/2/3
    starts_field: 0 or 1 (history[i].starts)
    minutes: ignored by bonus.py but required by schema
    clean_sheet: 0 or 1 (history[i].clean_sheets) — used for GK/DEF residualisation only
    """
    return {
        'minutes': minutes,
        'starts': starts_field,
        'bonus': bonus_pts,
        'clean_sheets': clean_sheet,
        'round': 1,
    }


def _summary(entries):
    return {'history': entries}


def test_returns_per_player_dict():
    """Return dict has keys {'bonus_ev', 'n_starts', 'source'}."""
    history = [_hist(1)] * 10
    result = _compute_player_bonus_ev(_element(), _summary(history))
    assert set(result.keys()) == {'bonus_ev', 'n_starts', 'source'}


def test_missing_summary_falls_back():
    """No element-summary -> flat position prior, source='flat_default'."""
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), None)
        assert result['bonus_ev'] == prior, f"element_type={element_type} expected {prior}, got {result['bonus_ev']}"
        assert result['n_starts'] == 0
        assert result['source'] == 'flat_default'


def test_low_sample_falls_back():
    """n_starts < 4 in recent[-10:] -> flat position prior."""
    # 3 starts, 7 non-starts -> below MIN_STARTS_GATE=4
    history = [_hist(1)] * 3 + [_hist(0, starts_field=0)] * 7
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), _summary(history))
        assert result['bonus_ev'] == prior, f"element_type={element_type} expected {prior}, got {result['bonus_ev']}"
        assert result['source'] == 'flat_default'
        assert result['n_starts'] == 3


def test_sufficient_sample_blends():
    """n_starts=10, MID, bonus=[3,3,2,3,1,2,3,3,2,3] -> blended EV."""
    bonuses = [3, 3, 2, 3, 1, 2, 3, 3, 2, 3]
    history = [_hist(b) for b in bonuses]
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    empirical_mean = sum(bonuses) / len(bonuses)  # 2.5
    w = min(1.0, 10 / 12.0)
    expected = w * empirical_mean + (1.0 - w) * 0.60
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned'
    assert result['n_starts'] == 10


def test_shrinkage_formula():
    """n_starts=4 (gate boundary) with empirical mean=1.0, MID -> w=4/12, blended."""
    history = [_hist(1)] * 4 + [_hist(0, starts_field=0)] * 6
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    w = 4 / 12.0
    expected = w * 1.0 + (1.0 - w) * 0.60
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned'
    assert result['n_starts'] == 4


def test_shrinkage_full_weight_at_n12():
    """n_starts=12 -> w=1.0 -> bonus_ev equals empirical mean."""
    bonuses = [2] * 12
    history = [_hist(b) for b in bonuses]
    # Only recent[-10:] count -> 10 starts, w = min(1, 10/12) = 0.833
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    # window is last 10, all bonus=2; empirical_mean=2.0; w=10/12
    w = 10 / 12.0
    expected = w * 2.0 + (1.0 - w) * 0.60
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)


def test_window_uses_recent_10_only():
    """15 history entries — bonus_ev computed on recent[-10:] only."""
    # First 5: bonus=3 (outside window); last 10: bonus=0 (inside window)
    history = [_hist(3)] * 5 + [_hist(0)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    # empirical_mean over last 10 = 0.0; w = min(1, 10/12); prior MID = 0.60
    w = 10 / 12.0
    expected = w * 0.0 + (1.0 - w) * 0.60
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)


def test_defender_bonus_residualised_against_cs():
    """GK/DEF: bonus_ev_raw - 0.5 * cs_prob_estimate, max 0.0."""
    # GK (element_type=1) prior=0.30. 10 starts, 8 with CS, all bonus=1.
    # cs_prob_estimate = 8/10 = 0.8
    # empirical_mean = 1.0
    # w = 10/12 ≈ 0.833; bonus_ev_raw = 0.833*1.0 + 0.167*0.30 = 0.883
    # bonus_ev = max(0, 0.883 - 0.5*0.8) = max(0, 0.483) = 0.483
    history = [_hist(1, clean_sheet=1)] * 8 + [_hist(1, clean_sheet=0)] * 2
    result = _compute_player_bonus_ev(_element(element_type=1), _summary(history))
    w = 10 / 12.0
    raw = w * 1.0 + (1.0 - w) * 0.30
    expected = max(0.0, raw - 0.5 * 0.8)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned'


def test_attacker_bonus_not_residualised():
    """MID (element_type=3): no residualisation, plain shrinkage even with high CS rate."""
    # 10 starts, all bonus=1, all CS=1. If residualisation were applied,
    # bonus_ev would drop. Verify it does NOT drop.
    history = [_hist(1, clean_sheet=1)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    w = 10 / 12.0
    expected = w * 1.0 + (1.0 - w) * 0.60
    # Plain shrinkage value, NOT reduced by 0.5 * cs_prob
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001), \
        "MID/FWD must NOT be residualised against CS — only GK (1) and DEF (2)."


def test_top_level_returns_dict_keyed_by_player_id():
    """compute_bonus_predictions returns dict[player_id] -> per-player dict."""
    bootstrap = {
        'elements': [
            {'id': 100, 'element_type': 3},
            {'id': 200, 'element_type': 4},
        ],
    }
    summaries = {
        100: _summary([_hist(2)] * 10),
        # 200 absent — should fall back
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=10)
    assert set(result.keys()) == {100, 200}
    # Player 100: 10 starts, mean=2.0, MID prior=0.60, w=10/12
    w = 10 / 12.0
    expected_100 = w * 2.0 + (1.0 - w) * 0.60
    assert result[100]['bonus_ev'] == pytest.approx(round(expected_100, 4), abs=0.0001)
    assert result[100]['source'] == 'learned'
    # Player 200: no summary -> FWD prior 0.70
    assert result[200]['bonus_ev'] == 0.70
    assert result[200]['source'] == 'flat_default'
