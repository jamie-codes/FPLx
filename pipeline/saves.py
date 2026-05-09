"""Poisson-floor save-point math for goalkeeper xPts (Phase 83 GK-01, D-04).

Public API:
  poisson_floor_save_pts(lambda_opp: float) -> float
      Returns E[floor(N/3)] = sum_{k=1}^inf P(N >= 3k) for N ~ Poisson(lambda_opp).
      FPL awards 1 save point per 3 saves; this is the EXACT expectation of
      floor(saves/3) -- NOT the naive lambda_opp/3 approximation (RESEARCH Pitfall 2).

Module constants (consumed by pipeline/merge.py at the lambda-construction site,
per CONTEXT.md D-02):
  AWAY_FACTOR = 0.85   # opponent traveling -> fewer goals expected
  HOME_FACTOR = 1.15   # opponent at home   -> more goals expected

scipy is NOT available in the runtime environment (verified against
pipeline/requirements.txt). Poisson PMF/CDF are computed via math.exp +
math.factorial; for k <= 15 (lambda up to ~10) there is no overflow risk.
"""

import math


# Phase 83 GK-01 / CONTEXT.md D-02: hardcoded home/away factors for opponent xG
# adjustment. Multiplied into team_xgs[opp_id] when the fixture entry is built
# inside merge_players (see merge.py team_fixtures construction). NOT
# configurable for this phase -- PL home/away effect is stable season to season.
AWAY_FACTOR: float = 0.85   # opponent is playing AWAY (is_home=True for GK's team)
HOME_FACTOR: float = 1.15   # opponent is playing AT HOME (is_home=False for GK's team)


def _poisson_pmf(k: int, lam: float) -> float:
    """P(N = k) for N ~ Poisson(lam). Returns 1.0 if k==0 and lam<=0, else 0.0."""
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam) * (lam ** k) / math.factorial(k)


def _poisson_cdf(k: int, lam: float) -> float:
    """P(N <= k) for N ~ Poisson(lam). Sums PMFs from i=0..k inclusive."""
    return sum(_poisson_pmf(i, lam) for i in range(k + 1))


def poisson_floor_save_pts(lambda_opp: float) -> float:
    """E[floor(N/3)] = sum_{k=1}^inf P(N >= 3k) for N ~ Poisson(lambda_opp).

    FPL awards 1 save point per 3 saves made by a goalkeeper. This computes the
    EXACT expectation of floor(saves/3) via the identity
        E[floor(X/n)] = sum_{k=1}^inf P(X >= n*k)
    NOT the naive approximation lambda_opp/3 (CONTEXT.md D-03, RESEARCH Pitfall 2).

    The series terminates as soon as a term falls below 1e-9; for lambda_opp <= ~5
    this happens within k <= 6 iterations (no factorial overflow risk).

    Args:
        lambda_opp: adjusted opponent xG per game (already includes home/away
                    factor from merge.py). Represents expected saves for the GK
                    in this fixture (saves ~~ shots-on-target-against ~~ lambda
                    with the standard saves-to-goals ratio absorbed).

    Returns:
        Expected save-point contribution (float >= 0.0). Returns 0.0 immediately
        when lambda_opp <= 0 (BGW guard).
    """
    if lambda_opp <= 0:
        return 0.0
    total = 0.0
    k = 1
    THRESHOLD = 1e-9
    while True:
        term = 1.0 - _poisson_cdf(3 * k - 1, lambda_opp)
        if term < THRESHOLD:
            break
        total += term
        k += 1
    return total
