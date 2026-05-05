---
phase: 061-mc-simulation-core
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pipeline/simulate.py
  - pipeline/run.py
  - pipeline/requirements.txt
  - pipeline/tests/test_simulate.py
  - src/components/gem-table/columns.tsx
  - src/lib/types.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 061: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The Phase 61 MC simulation core (`pipeline/simulate.py`) is a clean, well-structured Poisson/Bernoulli Monte Carlo engine. The algorithmic design is sound and the module-level docstring accurately describes the implemented algorithm. `run.py` integration is straightforward and the feature flags are threaded correctly. `src/lib/types.ts` is correctly extended with the four new optional MC fields.

Two concerns require immediate attention before the code ships: a `KeyError` crash path in `_simulate_player` for players with unexpected `element_type` values (critical), and a test suite that imports but never exercises the private `_simulate_player` function — which means the function is only tested indirectly and its edge-case behaviour (especially the BGW short-circuit returning the wrong shape) is never unit-tested in isolation (warning). Additional warnings cover non-deterministic test assertions and a redundant guard expression.

---

## Critical Issues

### CR-01: `KeyError` crash for unexpected `element_type` values

**File:** `pipeline/simulate.py:87`
**Issue:** `GOAL_PTS`, `CS_PTS`, and `BONUS_RATE` are all keyed on `{1, 2, 3, 4}`. The guard on line 72 — `et = p.get('element_type', 3) or 3` — only coerces falsy values (None, 0, False) to 3. Any truthy integer outside the set (e.g. `element_type=5`, which could appear if FPL ever adds a new position code or if a corrupted player record slips through) will produce `GOAL_PTS[5]` → `KeyError`. This crash propagates through `compute_simulations` and, since `run.py` wraps the entire pipeline in a single try/except at line 363, it marks the entire run as stale rather than skipping just the bad player.

**Fix:**
```python
et = p.get('element_type', 3) or 3
if et not in GOAL_PTS:
    et = 3  # safe fallback; unknown position treated as MID
```
Or use `.get()` with defaults on each dict access:
```python
goal_multiplier = GOAL_PTS.get(et, GOAL_PTS[3])
cs_multiplier   = CS_PTS.get(et, CS_PTS[3])
bonus_rate      = BONUS_RATE.get(et, BONUS_RATE[3])
```

---

## Warnings

### WR-01: `_simulate_player` imported in tests but never called

**File:** `pipeline/tests/test_simulate.py:6`
**Issue:** `_simulate_player` is imported on line 6 but no test in the file calls it directly. Every test goes through `compute_simulations`. This means the BGW short-circuit return value (line 68 in `simulate.py`) is tested only as observed through the public wrapper, not in isolation. If `_simulate_player` ever gets a different signature or its return dict gains a field, the discrepancy will not be caught at the unit level. The dead import also causes linters to flag the file, and signals that planned direct-unit tests were never written.

**Fix:** Either add a direct `_simulate_player` test, or remove the import if the function is intentionally tested only via `compute_simulations`:
```python
# Option A — remove dead import
from simulate import compute_simulations

# Option B — add a direct test
def test_simulate_player_bgw_direct():
    import numpy as np
    rng = np.random.default_rng(42)
    p = _player(xmins=0.0)
    result = _simulate_player(p, xmins_v2_enabled=False, rng=rng)
    assert result == {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}
```

### WR-02: Non-deterministic RNG makes stochastic test assertions fragile

**File:** `pipeline/simulate.py:131` / `pipeline/tests/test_simulate.py:62-65`
**Issue:** `rng = np.random.default_rng()` creates a randomly-seeded RNG. `test_mc_mean_matches_analytical` asserts `r['p90_pts'] > r['p10_pts'] + 1.0` (meaningful spread) and `1.0 < r['p90_pts'] < 15.0` against a live MC run. With N_SIMS=10,000 the law of large numbers makes these assertions almost always pass, but there is no seed, so a CI run cannot be reproduced exactly on failure and in theory can produce a different ordering on a bad seed. `test_dgw_sums_fixtures` also makes strict ordering assertions (`r_dgw['p90_pts'] > r_single['p90_pts']`) that could fail in extremely unlucky runs (though very unlikely at 10k sims).

**Fix:** Accept a `seed` parameter in `compute_simulations` defaulting to `None` (preserving production behaviour) and pass a fixed seed in tests:
```python
# simulate.py
def compute_simulations(merged: list, xmins_v2_enabled: bool, seed: int | None = None) -> list:
    rng = np.random.default_rng(seed)
    ...

# test_simulate.py
result = compute_simulations([p], xmins_v2_enabled=False, seed=42)
```

### WR-03: Redundant `window === 1` check inside a branch that is already gated on `window === 1`

**File:** `src/components/gem-table/columns.tsx:88`
**Issue:** `showMC` is computed at line 88 only when `showBreakdown` is true (line 70 guarantees `window === 1` at that point). The `window === 1` condition inside `showMC` is therefore always `true` and can never gate anything. If the structure of the function changes (e.g., `showBreakdown` is refactored away), the redundant check silently fails to protect the MC block. The guard also gives a false sense of security — a future developer may believe that `showMC` is independently safe to render outside a `window===1` context.

**Fix:**
```tsx
// window === 1 is already guaranteed by the showBreakdown gate above
const showMC =
  blankProb !== undefined &&
  haulProb !== undefined &&
  p10Pts !== undefined &&
  p90Pts !== undefined
```

---

## Info

### IN-01: `simulate.py` ignores `bonus_predictor_enabled` flag — diverges silently from `merge.py`

**File:** `pipeline/simulate.py:87`
**Issue:** When `bonus_predictor_enabled` is `True`, `merge.py` uses per-player learned bonus EV (`bonus_ev` from `bonus_stats`) instead of the position-prior `BONUS_RATE[et]`. `simulate.py` always uses `BONUS_RATE[et]` regardless of the flag (the flag is not even passed to `compute_simulations`). This means the MC simulation's `blank_prob` / `haul_prob` values are computed with a different bonus model than the analytical `xPts_1gw` displayed alongside them in the UI, creating an inconsistency between the two signals once `bonus_predictor_enabled` flips `True`. The divergence is not documented in the module docstring.

**Fix:** Either document the divergence explicitly (if intentional for Phase 61), or thread `bonus_predictor_enabled` and per-player `bonus_ev` into `compute_simulations` for consistency with the analytical path:
```python
def compute_simulations(merged: list, xmins_v2_enabled: bool,
                        bonus_predictor_enabled: bool = False) -> list:
    ...
    # inside _simulate_player:
    if bonus_predictor_enabled and p.get('bonus_ev') is not None:
        bonus_det = p['bonus_ev'] * (xmins / 90.0)
    else:
        bonus_det = BONUS_RATE[et] * (xmins / 90.0)
```

### IN-02: `selected_by_percent` column in `columns.tsx` has no cell renderer — displays raw string

**File:** `src/components/gem-table/columns.tsx:236-238`
**Issue:** The `selected_by_percent` accessor has a header but no `cell` override. TanStack Table will render the raw FPL string value (e.g. `"12.5"`) directly. This is visually inconsistent with other percentage columns that append `%` (e.g. `cs_prob_1gw`). This predates Phase 61 but is visible in the reviewed file.

**Fix:**
```tsx
col.accessor('selected_by_percent', {
  header: H('Own%', 'FPL ownership percentage — how many managers own this player'),
  cell: (info) => `${info.getValue()}%`,
}),
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
