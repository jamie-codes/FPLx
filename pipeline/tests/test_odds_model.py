# pipeline/tests/test_odds_model.py
import math
import pytest
from odds_model import devig, poisson_pmf, lambdas_from_odds, cs_prob, _p_over_25, _p_home_win


def _fair_odds_for(lam_h, lam_a):
    """Generate fair (vig-free) 1X2 and O/U2.5 decimal odds from known lambdas."""
    grid = 15
    ph = [poisson_pmf(i, lam_h) for i in range(grid)]
    pa = [poisson_pmf(j, lam_a) for j in range(grid)]
    p_home = sum(ph[i] * pa[j] for i in range(grid) for j in range(grid) if i > j)
    p_draw = sum(ph[i] * pa[i] for i in range(grid))
    p_away = sum(ph[i] * pa[j] for i in range(grid) for j in range(grid) if i < j)
    p_over = _p_over_25(lam_h + lam_a)
    p_under = 1.0 - p_over
    return (1/p_home, 1/p_draw, 1/p_away), (1/p_over, 1/p_under)


def test_devig_sums_to_one():
    out = devig([2.0, 4.0, 4.0])  # implied 0.5/0.25/0.25 = 1.0 already (no vig)
    assert abs(sum(out) - 1.0) < 1e-9
    # with vig (sums > 1), still normalises to 1
    out2 = devig([1.9, 3.6, 4.2])
    assert abs(sum(out2) - 1.0) < 1e-9
    assert out2[0] > out2[1]  # shortest price -> highest prob


def test_poisson_pmf_basic():
    assert abs(poisson_pmf(0, 1.0) - math.exp(-1.0)) < 1e-9
    assert poisson_pmf(0, 0.0) == 1.0
    assert poisson_pmf(2, 0.0) == 0.0


def test_p_over_25_monotonic():
    assert _p_over_25(0.5) < _p_over_25(3.0) < _p_over_25(6.0)


def test_lambdas_round_trip_recovers_known_values():
    for lam_h, lam_a in [(1.8, 1.0), (1.2, 1.2), (2.5, 0.6), (0.9, 1.7)]:
        o1x2, ou = _fair_odds_for(lam_h, lam_a)
        got_h, got_a = lambdas_from_odds(o1x2, ou)
        assert abs(got_h - lam_h) < 0.06, (lam_h, lam_a, got_h)
        assert abs(got_a - lam_a) < 0.06, (lam_h, lam_a, got_a)


def test_symmetric_odds_give_equal_lambdas():
    o1x2, ou = _fair_odds_for(1.3, 1.3)
    h, a = lambdas_from_odds(o1x2, ou)
    assert abs(h - a) < 1e-3


def test_heavy_favourite_high_home_lambda():
    o1x2, ou = _fair_odds_for(2.6, 0.5)
    h, a = lambdas_from_odds(o1x2, ou)
    assert h > a
    assert h > 2.0 and a < 1.0


def test_cs_prob_monotonic_decreasing_in_lambda():
    assert cs_prob(0.5) > cs_prob(1.5) > cs_prob(3.0)
    assert abs(cs_prob(0.0) - 1.0) < 1e-9
