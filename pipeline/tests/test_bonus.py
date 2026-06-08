"""Pytest unit tests for compute_bonus_predictions and _compute_player_bonus_ev (Phase 53 BPS-01)."""

import pytest

from bonus import _compute_player_bonus_ev, compute_bonus_predictions, build_bps_calibration


def _element(element_type=3, player_id=1):
    return {'id': player_id, 'element_type': element_type}


def _hist(bonus_pts, starts_field=1, minutes=90, clean_sheet=0, bps=20):
    """One element-summary history row.

    bonus_pts: 0/1/2/3
    starts_field: 0 or 1 (history[i].starts)
    minutes: ignored by bonus.py but required by schema
    clean_sheet: 0 or 1 (history[i].clean_sheets) — used for GK/DEF residualisation only
    bps: raw BPS score — used by BPS-02 calibration path (default 20)
    """
    return {
        'minutes': minutes,
        'starts': starts_field,
        'bonus': bonus_pts,
        'clean_sheets': clean_sheet,
        'bps': bps,
        'round': 1,
    }


def _summary(entries):
    return {'history': entries}


def test_returns_per_player_dict():
    """Return dict has keys {'bonus_ev', 'avg_bps', 'n_starts', 'source'}."""
    history = [_hist(1, bps=22)] * 10
    result = _compute_player_bonus_ev(_element(), _summary(history))
    assert set(result.keys()) == {'bonus_ev', 'avg_bps', 'n_starts', 'source'}


def test_missing_summary_falls_back():
    """No element-summary -> flat position prior, source='prior', avg_bps=None."""
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), None)
        assert result['bonus_ev'] == prior, f"element_type={element_type} expected {prior}, got {result['bonus_ev']}"
        assert result['n_starts'] == 0
        assert result['source'] == 'prior'
        assert result['avg_bps'] is None


def test_low_sample_falls_back():
    """n_starts < 4 in recent[-10:] -> flat position prior, source='prior', avg_bps=None."""
    history = [_hist(1, bps=22)] * 3 + [_hist(0, starts_field=0)] * 7
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), _summary(history))
        assert result['bonus_ev'] == prior, f"element_type={element_type} expected {prior}, got {result['bonus_ev']}"
        assert result['source'] == 'prior'
        assert result['n_starts'] == 3
        assert result['avg_bps'] is None


def test_sufficient_sample_bps_shrinkage():
    """n_starts=10, MID, bps=25, calibration=None -> uncalibrated BPS shrinkage formula."""
    # BPS_POSITION_PRIOR[3]=22, POSITION_PRIOR[3]=0.60
    # w = 10/12; smoothed_bps = w*25 + (1-w)*22
    # bonus_ev = smoothed_bps * (0.60 / 22)
    bps_val = 25
    history = [_hist(1, bps=bps_val)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = min(1.0, 10 / 12.0)
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_uncalibrated'
    assert result['n_starts'] == 10
    assert result['avg_bps'] == pytest.approx(float(bps_val), abs=0.01)


def test_shrinkage_formula_at_gate_boundary():
    """n_starts=4 (gate boundary), MID, bps=20.0, calibration=None -> w=4/12."""
    bps_val = 20
    history = [_hist(1, bps=bps_val)] * 4 + [_hist(0, starts_field=0)] * 6
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = 4 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_uncalibrated'
    assert result['n_starts'] == 4


def test_shrinkage_uses_recent_10_window():
    """n_starts=12 → only last 10 contribute (window=10); w = 10/12."""
    bps_val = 30
    history = [_hist(2, bps=bps_val)] * 12
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    # last 10 all have bps=30; avg_bps=30; w=10/12
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)


def test_window_uses_recent_10_only():
    """15 history entries: first 5 have bps=40, last 10 have bps=15 — only last 10 used."""
    history = [_hist(3, bps=40)] * 5 + [_hist(0, bps=15)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    # avg_bps from last 10 = 15.0 (all starts=1 by default)
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * 15.0 + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)


def test_defender_bonus_residualised_against_cs():
    """GK/DEF: BPS-based bonus_ev_raw reduced by 0.5 * cs_rate, floored at 0."""
    # GK (element_type=1): 10 starts, 8 with CS, bps=25
    # BPS_PRIOR[1]=18, POSITION_PRIOR[1]=0.30
    # cs_rate = 8/10 = 0.8
    # w=10/12; smoothed_bps=(10/12)*25+(2/12)*18
    # bonus_ev_raw = smoothed_bps * (0.30/18)
    # bonus_ev = max(0, bonus_ev_raw - 0.5*0.8)
    bps_val = 25
    history = [_hist(1, clean_sheet=1, bps=bps_val)] * 8 + [_hist(1, clean_sheet=0, bps=bps_val)] * 2
    result = _compute_player_bonus_ev(_element(element_type=1), _summary(history))
    bps_prior = 18
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    bonus_ev_raw = smoothed_bps * (0.30 / bps_prior)
    expected = max(0.0, bonus_ev_raw - 0.5 * 0.8)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_uncalibrated'


def test_attacker_bonus_not_residualised():
    """MID (element_type=3): no residualisation even with high CS rate."""
    bps_val = 22
    history = [_hist(1, clean_sheet=1, bps=bps_val)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    # Plain BPS shrinkage value, NOT reduced by CS penalty
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001), \
        "MID/FWD must NOT be residualised against CS — only GK (1) and DEF (2)."


def test_top_level_returns_dict_keyed_by_player_id():
    """compute_bonus_predictions returns dict[player_id] -> per-player dict.
    2-player bootstrap: only 1 qualifying player → calibration=None → learned_uncalibrated.
    """
    bootstrap = {
        'elements': [
            {'id': 100, 'element_type': 3},
            {'id': 200, 'element_type': 4},
        ],
    }
    summaries = {
        100: _summary([_hist(2, bps=22)] * 10),
        # 200 absent — should fall back to prior
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=10)
    assert set(result.keys()) == {100, 200}
    # Player 100: learned path, calibration=None (only 1 qualifying player < 20 threshold)
    assert result[100]['source'] == 'learned_uncalibrated'
    assert result[100]['avg_bps'] == pytest.approx(22.0, abs=0.01)
    # Player 200: no summary → FWD prior 0.70
    assert result[200]['bonus_ev'] == 0.70
    assert result[200]['source'] == 'prior'
    assert result[200]['avg_bps'] is None


# ── Task 1: build_bps_calibration ──────────────────────────────────────────


def _calibration_data(n_players: int, slope: float = 0.05, intercept: float = 0.10) -> tuple:
    """Generate (summaries, bootstrap) where avg_bonus = slope * avg_bps + intercept exactly."""
    elements = []
    summaries: dict = {}
    for i in range(1, n_players + 1):
        avg_bps = 15.0 + i * 0.5          # spread: 15.5, 16.0, 16.5, …
        avg_bonus = slope * avg_bps + intercept
        history = [
            {'starts': 1, 'bps': avg_bps, 'bonus': avg_bonus, 'minutes': 90, 'clean_sheets': 0}
            for _ in range(4)              # exactly MIN_STARTS_GATE starts each
        ]
        summaries[i] = {'history': history}
        elements.append({'id': i, 'element_type': 3})
    return summaries, {'elements': elements}


def test_build_bps_calibration_ols():
    """25 players with exact linear BPS→bonus → slope and intercept match OLS."""
    slope_true, intercept_true = 0.05, 0.10
    summaries, bootstrap = _calibration_data(25, slope=slope_true, intercept=intercept_true)
    result = build_bps_calibration(summaries, bootstrap)
    assert result is not None
    slope, intercept = result
    assert slope == pytest.approx(slope_true, rel=1e-6)
    assert intercept == pytest.approx(intercept_true, rel=1e-6)


def test_build_bps_calibration_fewer_than_20_returns_none():
    """Fewer than 20 qualifying players → returns None."""
    summaries, bootstrap = _calibration_data(15)
    assert build_bps_calibration(summaries, bootstrap) is None


def test_build_bps_calibration_excludes_low_starts():
    """Players with < MIN_STARTS_GATE (4) starts do not count toward the 20-player threshold.

    19 qualifying players + 10 with only 3 starts each = 29 total elements.
    Because only 19 qualify, the function must return None (below 20 threshold).
    """
    elements = []
    summaries: dict = {}
    for i in range(1, 30):
        n_starts = 4 if i <= 19 else 3
        avg_bps = 15.0 + i * 0.5
        avg_bonus = 0.05 * avg_bps + 0.10
        history = [
            {'starts': 1, 'bps': avg_bps, 'bonus': avg_bonus, 'minutes': 90, 'clean_sheets': 0}
        ] * n_starts
        summaries[i] = {'history': history}
        elements.append({'id': i, 'element_type': 3})
    bootstrap = {'elements': elements}
    assert build_bps_calibration(summaries, bootstrap) is None


def test_build_bps_calibration_zero_variance_returns_none():
    """All players with identical avg_bps → denominator = 0 → returns None."""
    elements = []
    summaries: dict = {}
    for i in range(1, 26):
        # All players have same avg_bps=20.0, different bonus — zero BPS variance
        history = [
            {'starts': 1, 'bps': 20.0, 'bonus': float(i), 'minutes': 90, 'clean_sheets': 0}
        ] * 4
        summaries[i] = {'history': history}
        elements.append({'id': i, 'element_type': 3})
    bootstrap = {'elements': elements}
    assert build_bps_calibration(summaries, bootstrap) is None


# ── Task 2 new tests ────────────────────────────────────────────────────────


def test_calibrated_path_uses_curve():
    """When calibration=(slope, intercept), bonus_ev = slope*smoothed_bps + intercept."""
    bps_val = 22
    history = [_hist(1, bps=bps_val)] * 10
    slope, intercept = 0.05, 0.10
    result = _compute_player_bonus_ev(
        _element(element_type=3), _summary(history), calibration=(slope, intercept)
    )
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = slope * smoothed_bps + intercept
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_calibrated'


def test_partial_shrinkage_smoothed_bps_between_extremes():
    """n_starts=6 → smoothed_bps is between avg_bps and BPS_PRIOR (w=0.5)."""
    bps_val = 30          # above BPS_PRIOR[3]=22
    history = [_hist(1, bps=bps_val)] * 6 + [_hist(0, starts_field=0)] * 4
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = 6 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior   # = 26.0
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    # smoothed_bps lies strictly between avg_bps and BPS_PRIOR
    assert bps_prior < smoothed_bps < bps_val


def test_avg_bps_populated_for_learned_players():
    """avg_bps field is populated (not None) when n_starts >= MIN_STARTS_GATE."""
    history = [_hist(1, bps=24)] * 8
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    assert result['avg_bps'] is not None
    assert result['avg_bps'] == pytest.approx(24.0, abs=0.01)


def test_high_bps_player_higher_bonus_ev():
    """Higher avg BPS → higher bonus_ev (monotone calibration-curve behaviour)."""
    history_high = [_hist(1, bps=35)] * 10
    history_low  = [_hist(1, bps=15)] * 10
    result_high = _compute_player_bonus_ev(_element(element_type=3), _summary(history_high))
    result_low  = _compute_player_bonus_ev(_element(element_type=3), _summary(history_low))
    assert result_high['bonus_ev'] > result_low['bonus_ev']


def test_calibrated_path_floors_at_zero_for_attacker():
    """Calibrated path with negative raw result → bonus_ev floored at 0.0 for MID/FWD."""
    history = [_hist(1, bps=5)] * 10   # low BPS player
    # slope=0.01, intercept=-5.0 → bonus_ev_raw will be negative for bps≈5
    result = _compute_player_bonus_ev(
        _element(element_type=3), _summary(history), calibration=(0.01, -5.0)
    )
    assert result['bonus_ev'] >= 0.0, "bonus_ev must be non-negative even on calibrated path"
    assert result['source'] == 'learned_calibrated'


# ── Task 3: compute_bonus_predictions wiring ───────────────────────────────


def test_compute_bonus_predictions_calibrated_when_enough_players():
    """≥ 20 qualifying players → calibration built → source='learned_calibrated'."""
    bootstrap = {'elements': [{'id': i, 'element_type': 3} for i in range(1, 26)]}
    summaries = {
        i: {'history': [
            {'starts': 1, 'bps': 18.0 + i * 0.5, 'bonus': 1.0, 'minutes': 90, 'clean_sheets': 0}
        ] * 10}
        for i in range(1, 26)
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=25)
    for player_id in range(1, 26):
        assert result[player_id]['source'] == 'learned_calibrated', \
            f"player {player_id}: expected learned_calibrated, got {result[player_id]['source']}"


def test_compute_bonus_predictions_uncalibrated_when_few_players():
    """< 20 qualifying players → calibration=None → learned players get source='learned_uncalibrated'."""
    bootstrap = {'elements': [{'id': i, 'element_type': 3} for i in range(1, 6)]}
    summaries = {
        i: {'history': [
            {'starts': 1, 'bps': 20.0, 'bonus': 1.0, 'minutes': 90, 'clean_sheets': 0}
        ] * 10}
        for i in range(1, 6)
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=5)
    for player_id in range(1, 6):
        assert result[player_id]['source'] == 'learned_uncalibrated'
