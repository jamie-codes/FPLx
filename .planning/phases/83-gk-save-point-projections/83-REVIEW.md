---
phase: 83-gk-save-point-projections
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pipeline/accuracy.py
  - pipeline/merge.py
  - pipeline/run.py
  - pipeline/saves.py
  - pipeline/tests/test_merge_xpts_components.py
  - pipeline/tests/test_saves.py
  - src/components/gem-table/XPtsCell-saves.test.tsx
  - src/components/gem-table/columns.tsx
  - src/lib/types.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 83 adds GK save-point projections using a Poisson-floor model (`saves.py`), wires `opponent_xg_per_game` into fixture objects in `merge.py`, gates save_pts in `_compute_xpts_fixture`, adds a gate-preservation path in `accuracy.py`, and ships a `save_pts` row in the XPtsCell hover card. The core math (`poisson_floor_save_pts`) and the gate wiring are sound. However, two blockers exist: the `AccuracySummary` and `VersionGateFlags` TypeScript types are not updated to include `save_predictor_enabled`, breaking type-safety for any TS consumer that reads those shapes; and the legacy component-sum tests in `test_merge_xpts_components.py` silently omit `save_pts` from their sum, meaning they would spuriously pass for a GK player with the gate on (the XPT-02 invariant is tested against an incomplete sum). Three warnings cover the misleading `lambda_opp` semantics in `saves.py`, an infinite-loop risk for unexpectedly large lambda values, and a stale gate-read that opens a one-run data consistency window in `run.py`.

---

## Critical Issues

### CR-01: `AccuracySummary` and `VersionGateFlags` TypeScript types missing `save_predictor_enabled`

**File:** `src/lib/types.ts:331-343` and `src/lib/types.ts:425-429`

**Issue:** `accuracy.py` writes `save_predictor_enabled` into both the top-level `summary` block (`accuracy_backtest.json`) and into every `VersionRecord.gate_flags` object. Neither the `AccuracySummary` interface nor the `VersionGateFlags` interface declares this field. Any TypeScript code that reads `summary.save_predictor_enabled` (e.g. a UI gate indicator that a future phase might add, or any code that spreads/copies these objects) will silently receive `undefined` rather than the actual boolean. More immediately, strict Zod validation or typed spread/assignment would fail.

The pipeline already emits the field; the contract definition is just missing.

**Fix:**
```typescript
// AccuracySummary (line ~342 in types.ts) — add after bonus_predictor_enabled:
bonus_predictor_enabled?: boolean  // Phase 53 BPS-01 gate (preserved across runs)
save_predictor_enabled?: boolean   // Phase 83 GK-03 gate (preserved across runs)

// VersionGateFlags (line ~425 in types.ts) — add field:
export interface VersionGateFlags {
  xmins_v2_enabled: boolean
  bonus_predictor_enabled: boolean
  form_signal_enabled: boolean
  save_predictor_enabled: boolean   // Phase 83 GK-03
}
```

---

### CR-02: Legacy component-sum tests silently omit `save_pts`, breaking the XPT-02 invariant for GK players with the gate on

**File:** `pipeline/tests/test_merge_xpts_components.py:42-49`, `97-106`, `120-126`

**Issue:** Three tests (`test_xpts_components_sum_to_total_single_fixture`, `test_xpts_components_sum_integrity_with_bonus_flag`, `test_xpts_components_sum_integrity_both_gates_on`) compute `component_sum` as:
```python
result['goal_pts'] + result['assist_pts'] + result['cs_pts'] + result['bonus_pts'] + result['appearance_pts']
```
They do **not** include `result['save_pts']`. Since these tests only exercise `element_type=3` (MID) where `save_pts` is always `0.0`, they pass today. But the invariant they claim to test is `component_sum == result['total']`. If a future test or maintenance engineer adds a GK case (element_type=1) with `save_predictor_enabled=True` to these parametrized tests, the assertion will silently accept a wrong sum.

More critically, `test_xpts_components_sum_integrity_both_gates_on` explicitly tests the scenario where two gates are simultaneously on but does not include `save_predictor_enabled=True` as a third gate. As soon as all three gates are active together, this "both gates" test provides no coverage of the true both-plus-save scenario.

**Fix:** Add `save_pts` to all component sum computations in this file:
```python
component_sum = (
    result['goal_pts']
    + result['assist_pts']
    + result['cs_pts']
    + result['bonus_pts']
    + result['appearance_pts']
    + result['save_pts']   # always 0.0 for non-GK; must be included for invariant completeness
)
```
And add a three-gate test:
```python
def test_xpts_components_sum_integrity_all_gates_on():
    result = _compute_xpts_fixture(
        xg_per90=0.0, xa_per90=0.0, start_prob=1.0, xmins=90.0,
        element_type=1, defensive_difficulty=0.5,
        xmins_v2_enabled=True, mins_60_prob=0.85,
        bonus_predictor_enabled=True, bonus_ev=0.35,
        save_predictor_enabled=True, opponent_xg_per_game=1.2,
    )
    component_sum = sum(result[k] for k in ['goal_pts','assist_pts','cs_pts','bonus_pts','appearance_pts','save_pts'])
    assert abs(component_sum - result['total']) < 0.02
```

---

## Warnings

### WR-01: `poisson_floor_save_pts` has no upper bound on iterations — potential infinite loop for pathological lambda

**File:** `pipeline/saves.py:68-73`

**Issue:** The `while True` loop breaks when `term < THRESHOLD (1e-9)`. For a well-behaved Poisson distribution the docstring says this converges "within k <= 6 iterations" for lambda <= ~5. However there is no hard cap on `k`. If `lambda_opp` were somehow set to a very large value (e.g. a bug upstream passes `opponent_xg_per_game` as a scaled or unnormalised value) the loop may run for hundreds of iterations before converging. Worse, for extremely large lambda the `math.factorial(k)` inside `_poisson_pmf` will raise `OverflowError` at `k >= 21` (Python `math.factorial` returns an int of arbitrary precision, but `math.exp(-lam) * (lam**k)` will produce 0 or inf before that). The `_poisson_cdf` call sums `k+1` PMF terms, so `k=20` in the outer loop means `_poisson_cdf(59, large_lam)` calls `_poisson_pmf(i, lam)` for i=0..59, where `lam**59 / factorial(59)` can produce `inf` for large lambda.

This is not purely theoretical: if a programming error elsewhere makes `team_xgs` report goals rather than per-game averages (e.g. accumulating over a season), lambda could reach 50+ and cause an overflow in a production pipeline run.

**Fix:** Add a hard iteration cap and a lambda sanity clamp:
```python
MAX_LAMBDA = 20.0          # xG above this is nonsensical for a single match
MAX_ITERATIONS = 50        # hard cap (converges in < 10 for realistic lambda)

def poisson_floor_save_pts(lambda_opp: float) -> float:
    if lambda_opp <= 0:
        return 0.0
    lambda_opp = min(lambda_opp, MAX_LAMBDA)  # clamp unrealistic values
    total = 0.0
    k = 1
    while k <= MAX_ITERATIONS:
        term = 1.0 - _poisson_cdf(3 * k - 1, lambda_opp)
        if term < 1e-9:
            break
        total += term
        k += 1
    return total
```

---

### WR-02: `run.py` reads the prior `accuracy_backtest.json` for gate flags before computing a new backtest, creating a one-run lag for `save_predictor_enabled`

**File:** `pipeline/run.py:194-203`

**Issue:** `run.py` reads `accuracy_backtest.json` to populate `save_predictor_enabled` (and other gates) before calling `merge_players`. Then `compute_accuracy_backtest` is called later and writes a new `accuracy_backtest.json`. This is an intentional design (the gate is "preserved across runs"), but the implementation has a subtle consistency gap: `run.py` opens and parses the file at line 195-203, and `compute_accuracy_backtest` (called at line 302) also opens and parses the same file via `_read_existing_cache`. This means the same file is opened twice in the same pipeline run.

If an external process writes a new `accuracy_backtest.json` between those two reads (unlikely in single-run pipelines, but possible in concurrent deployments), `merge_players` and `accuracy.py` will use inconsistent gate values. The `_read_existing_cache` docstring ("WR-02: read and parse accuracy_backtest.json exactly once") explicitly acknowledges this concern but the fix was only applied inside `accuracy.py`, not to the `run.py` read path.

**Fix:** Pass the already-loaded gate flags into `compute_accuracy_backtest` rather than having it re-read the file. Alternatively, document the dual-read as an accepted risk. At minimum, a comment noting the intentional two-read pattern at line 302 would prevent future "fix" attempts that accidentally break gate persistence.

---

### WR-03: `saves.py` docstring conflates "goals" with "saves" — `lambda_opp` is opponent xG, not expected saves

**File:** `pipeline/saves.py:53-57`

**Issue:** The `Args` section states:
> `lambda_opp`: adjusted opponent xG per game ... Represents expected saves for the GK in this fixture (saves ~~ shots-on-target-against ~~ lambda with the standard saves-to-goals ratio absorbed).

This is self-contradictory and misleading. The function receives `opponent_xg_per_game` (adjusted for home/away factor), which is an xG value, not a saves count. The comment tries to bridge this by saying "saves-to-goals ratio absorbed" but FPL saves ≠ goals; a save requires a shot on target, not a goal. The implicit assumption is that xG ≈ shots on target ≈ saves (i.e. every shot is saved), which is a known rough proxy but is not stated explicitly.

This misleads anyone maintaining the saves model who might reason: "opponent scores 1.2 expected goals, therefore 1.2 expected saves" — a significant overestimate. The ratio of saves to goals in the Premier League is approximately 3:1 to 5:1 (i.e. 3-5 saves per goal conceded), so the model as written substantially underestimates save frequency, which in turn underestimates save_pts. This may be an intentional choice (conservative estimate) but it is not documented.

**Fix:** Clarify in the docstring that `lambda_opp` is a proxy (goals-scored xG, not saves) and that the saves-per-goal ratio is not modelled. Add a TODO for a future phase to calibrate against real saves data.

---

## Info

### IN-01: `FixtureEntry` TypeScript type does not include `opponent_xg_per_game`

**File:** `src/lib/types.ts:78-86`

**Issue:** `merge.py` now writes `opponent_xg_per_game` into every fixture entry dict for both home and away perspectives (lines 876, 890). The `FixtureEntry` TypeScript interface does not declare this field. Any TypeScript code that reads `FixtureEntry` objects (e.g. a future component that wants to surface opponent xG for FDR displays) will not see the field in the type. It is silently available at runtime (the JSON is there) but invisible to the type system.

**Fix:**
```typescript
export interface FixtureEntry {
  // ... existing fields ...
  opponent_xg_per_game?: number  // Phase 83 GK-01 / D-02 — adjusted opp xG (home/away factor applied)
}
```

---

### IN-02: `_read_existing_save_predictor_flag` function is now dead code in `accuracy.py`

**File:** `pipeline/accuracy.py:73-88`

**Issue:** The function `_read_existing_save_predictor_flag` was added in this phase (lines 73-88) but is never called. The actual gate-reading is done via `_read_existing_cache` at line 370, with the value extracted inline at line 373:
```python
save_predictor_enabled = bool(prior_cache.get('summary', {}).get('save_predictor_enabled', False))
```
The standalone function exists only as a target for the test `test_saves.py:test_gate_cold_start` etc. (imported at `test_saves.py:14`). It is only kept alive by the test import, not by any production code path. The same pattern existed for `_read_existing_bonus_predictor_flag` (lines 56-70) and `_read_existing_xmins_v2_flag` (lines 40-53), which are equally unused by the production path.

This is not a bug but it is a quality concern: the production code reads flags via `_read_existing_cache` (correctly, per the WR-02 consolidated read), while the per-flag helper functions exist only for test convenience. If someone removes the tests or refactors the test import, the helpers become truly dead. Consider whether the tests should call `_read_existing_cache` directly and extract the key themselves, or document that the helpers are test-only shims.

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
