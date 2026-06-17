import experiments.exp12_avail as exp12


def test_verdict_ship_when_better_and_beats_placebo():
    base = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    treat = {'top10_mean_pts': 5.3, 'captain_return_rate': 0.33, 'rmse': 1.95}
    placebo = {'top10_mean_pts': 5.05, 'captain_return_rate': 0.30, 'rmse': 2.0}
    assert exp12.decide_verdict(base, treat, placebo) == 'SHIP'


def test_verdict_no_ship_when_treatment_no_better_than_placebo():
    base = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    treat = {'top10_mean_pts': 5.3, 'captain_return_rate': 0.33, 'rmse': 1.95}
    placebo = {'top10_mean_pts': 5.32, 'captain_return_rate': 0.34, 'rmse': 1.94}
    assert exp12.decide_verdict(base, treat, placebo) == 'NO_SHIP'


def test_verdict_no_ship_when_rmse_worsens():
    base = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    treat = {'top10_mean_pts': 5.4, 'captain_return_rate': 0.35, 'rmse': 2.2}
    placebo = {'top10_mean_pts': 5.0, 'captain_return_rate': 0.30, 'rmse': 2.0}
    assert exp12.decide_verdict(base, treat, placebo) == 'NO_SHIP'


def test_placebo_lookup_is_same_size_and_deterministic():
    eligible = [(g, p) for g in range(7, 20) for p in range(100, 130)]
    a = exp12.make_placebo_lookup(eligible, n=25, seed=42)
    b = exp12.make_placebo_lookup(eligible, n=25, seed=42)
    assert len(a) == 25 and a == b
    assert all(v == 'out' for v in a.values())
