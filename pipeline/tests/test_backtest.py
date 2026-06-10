"""Tests for backtest.py (BT-02). Synthetic data only — no network, no archive."""
import pytest

import backtest


# ── synthetic archive helpers ─────────────────────────────────────────────── #

def _entry(rnd, fixture_id, minutes=90, xg=0.3, xa=0.1, pts=2, starts=1,
           was_home=True):
    return {
        'round': rnd, 'fixture': fixture_id, 'minutes': minutes,
        'expected_goals': str(xg), 'expected_assists': str(xa),
        'total_points': pts, 'starts': starts, 'was_home': was_home,
        'opponent_team': 2 if was_home else 1,
    }


def _uniform_history(n_gws, minutes=90, xg=0.3, xa=0.1, pts=2):
    """One fixture per GW, fixture id = round number."""
    return [_entry(g, g, minutes=minutes, xg=xg, xa=xa, pts=pts)
            for g in range(1, n_gws + 1)]


def _params(**over):
    p = dict(backtest.DEFAULT_PARAMS)
    p.update(over)
    return p


# ── build_asof_signals ────────────────────────────────────────────────────── #

def test_asof_per90_uses_only_prior_rounds():
    """Cumulative per-90s at GW g must exclude GW g itself (the leak BT-02 fixes)."""
    hist = _uniform_history(10, xg=0.3)
    # Inflate GW 8's xG massively — signals AT GW 8 must not change
    hist_inflated = [dict(e) for e in hist]
    hist_inflated[7]['expected_goals'] = '9.9'
    base = backtest.build_asof_signals(hist, 8, _params())
    infl = backtest.build_asof_signals(hist_inflated, 8, _params())
    assert base['xg_per90'] == infl['xg_per90']
    # ...but signals at GW 9 DO see GW 8
    base9 = backtest.build_asof_signals(hist, 9, _params())
    infl9 = backtest.build_asof_signals(hist_inflated, 9, _params())
    assert infl9['xg_per90'] > base9['xg_per90']


def test_asof_cum_minutes_and_eligibility_threshold():
    """cum_minutes counts only prior rounds; 270-minute threshold is the caller's gate."""
    hist = _uniform_history(4, minutes=90)  # 90,90,90,90
    sig3 = backtest.build_asof_signals(hist, 3, _params())   # prior = GW1-2 = 180
    sig4 = backtest.build_asof_signals(hist, 4, _params())   # prior = GW1-3 = 270
    assert sig3['cum_minutes'] == 180
    assert sig4['cum_minutes'] == 270
    # No prior data at all -> None
    assert backtest.build_asof_signals(hist, 1, _params()) is None


def test_asof_xmins_window_and_probs():
    """Deploy-mode minutes signals come from the last 5 prior entries."""
    # Alternating 90/0: rounds 1..10 -> minutes 90,0,90,0,90,0,90,0,90,0
    hist = []
    for g in range(1, 11):
        m = 90 if g % 2 == 1 else 0
        hist.append(_entry(g, g, minutes=m, starts=1 if m else 0,
                           pts=2 if m else 0))
    sig = backtest.build_asof_signals(hist, 11, _params())
    # last 5 prior entries = rounds 6-10 = minutes 0,90,0,90,0 -> mean 36
    assert sig['xmins'] == pytest.approx(36.0)
    assert sig['start_prob'] == pytest.approx(2 / 5)
    assert sig['mins_60_prob'] == pytest.approx(2 / 5)
    assert sig['sub_appear_prob'] == 0.0  # 0-minute games are absences, not sub cameos
