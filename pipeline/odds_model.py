"""ODDS-01: convert bookmaker closing odds into per-team expected goals (lambda),
clean-sheet probability, and goal-expectation. Pure math, no I/O.

Approach A (independent Poisson, supremacy/total): de-vig the closing 1X2 and
over/under-2.5 markets, recover total-goals lambda from P(over 2.5), recover
supremacy (lam_home - lam_away) from the de-vigged home-win probability, then
split into per-team lambdas. CS-prob(team) = P(opponent scores 0) = exp(-lam_opp).
"""
import math

_GOAL_GRID = 11  # goals 0..10 — beyond this Poisson mass is negligible for EPL lambdas


def poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam) * lam ** k / math.factorial(k)


def devig(decimal_odds: list[float]) -> list[float]:
    """Normalise reciprocal decimal odds to sum to 1 (removes the bookmaker margin)."""
    inv = [1.0 / o for o in decimal_odds]
    s = sum(inv)
    return [x / s for x in inv]


def _p_over_25(lam_total: float) -> float:
    """P(total goals > 2.5) under Poisson(lam_total). Monotonic increasing in lam_total."""
    return 1.0 - sum(poisson_pmf(k, lam_total) for k in range(3))


def _p_home_win(lam_h: float, lam_a: float) -> float:
    ph = [poisson_pmf(i, lam_h) for i in range(_GOAL_GRID)]
    pa = [poisson_pmf(j, lam_a) for j in range(_GOAL_GRID)]
    return sum(ph[i] * pa[j] for i in range(_GOAL_GRID) for j in range(_GOAL_GRID) if i > j)


def _solve_lambda_total(p_over: float, lo: float = 0.05, hi: float = 10.0,
                        tol: float = 1e-7) -> float:
    """Bisection: find lam_total with _p_over_25(lam_total) == p_over."""
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if _p_over_25(mid) < p_over:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    return (lo + hi) / 2.0


def _solve_supremacy(p_home: float, lam_total: float, tol: float = 1e-7) -> float:
    """Bisection: find supremacy s in [-lam_total, lam_total] with
    _p_home_win((lam_total+s)/2, (lam_total-s)/2) == p_home. Monotonic increasing in s."""
    lo, hi = -lam_total, lam_total
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if _p_home_win((lam_total + mid) / 2.0, (lam_total - mid) / 2.0) < p_home:
            lo = mid
        else:
            hi = mid
        if hi - lo < tol:
            break
    return (lo + hi) / 2.0


def lambdas_from_odds(odds_1x2, odds_ou25) -> tuple[float, float]:
    """odds_1x2 = (home, draw, away) decimal odds; odds_ou25 = (over2.5, under2.5).
    Returns (lam_home, lam_away)."""
    p_h, _p_d, _p_a = devig(list(odds_1x2))
    p_over, _p_under = devig(list(odds_ou25))
    lam_total = _solve_lambda_total(p_over)
    s = _solve_supremacy(p_h, lam_total)
    lam_h = max(0.0, (lam_total + s) / 2.0)
    lam_a = max(0.0, (lam_total - s) / 2.0)
    return lam_h, lam_a


def cs_prob(lam_opp: float) -> float:
    """Clean-sheet probability for a team = P(opponent scores 0) = exp(-lam_opp)."""
    return math.exp(-lam_opp)
