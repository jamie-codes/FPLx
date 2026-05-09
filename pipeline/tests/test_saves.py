"""Pytest unit tests for pipeline/saves.py (Phase 83, GK-01).

Run: python -m pytest pipeline/tests/test_saves.py -q
"""

import math
import pytest

# conftest.py inserts pipeline/ onto sys.path -- use bare import.
from saves import poisson_floor_save_pts


def test_symbol_exists():
    """Precondition: poisson_floor_save_pts must be importable."""
    assert poisson_floor_save_pts is not None


def test_bgw_returns_zero():
    """GK-01: lambda=0 (blank GW) returns exactly 0.0."""
    assert poisson_floor_save_pts(0.0) == 0.0


def test_negative_lambda_returns_zero():
    """Guard: negative lambda treated as zero."""
    assert poisson_floor_save_pts(-1.0) == 0.0


def test_known_value_lambda_1():
    """GK-01: lambda=1.0 -- E[floor(N/3)] ~= 0.0809 (NOT naive lambda/3 = 0.333).

    Manual derivation:
      P(N>=3 | lambda=1) = 1 - (P(0)+P(1)+P(2)) = 1 - e^-1 * (1 + 1 + 0.5) ~= 0.0803
      P(N>=6 | lambda=1) ~= 0.0006 (negligible)
      Total ~= 0.0809
    """
    result = poisson_floor_save_pts(1.0)
    assert abs(result - 0.0809) < 1e-3, f"Expected ~0.0809, got {result}"


def test_known_value_lambda_3():
    """GK-01: lambda=3.0 -- E[floor(N/3)] ~= 0.665 (NOT naive lambda/3 = 1.0).

    Manual derivation:
      P(N>=3 | lambda=3) = 1 - CDF(2,3) ~= 0.5768
      P(N>=6 | lambda=3) ~= 0.0839
      P(N>=9 | lambda=3) ~= 0.0038
      Total ~= 0.6645
    """
    result = poisson_floor_save_pts(3.0)
    assert abs(result - 0.665) < 5e-3, f"Expected ~0.665, got {result}"


def test_naive_formula_is_different():
    """GK-01 / RESEARCH Pitfall 2: floor-EV must NOT equal naive lambda/3.

    The Poisson-floor expectation is strictly less than lambda/3 for moderate
    lambda. If a future refactor accidentally uses the naive formula, this
    test will fail.
    """
    lam = 3.0
    floor_ev = poisson_floor_save_pts(lam)
    naive = lam / 3.0
    assert abs(floor_ev - naive) > 0.1, (
        f"Poisson-floor result {floor_ev} must differ from naive {naive} by >0.1"
    )
