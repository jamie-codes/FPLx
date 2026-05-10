---
phase: 90-monte-carlo-simulation-pipeline
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/simulate.py
  - pipeline/run.py
  - pipeline/accuracy.py
  - pipeline/tests/test_simulate.py
  - src/lib/types.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 90: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The five files implement the 5-GW cumulative Monte Carlo pipeline extension (MC-01). The core simulation math, DGW handling, BGW guard, and env-var gating are structurally correct. No security vulnerabilities or data-loss bugs were found.

Four warnings and three info items are raised:

- The four dead helper functions in accuracy.py that open the same file independently instead of delegating to `_read_existing_cache` (WR-01–WR-04) — they do not cause a runtime error today but create a maintenance trap if the file-format or path ever changes.
- `VersionGateFlags` in types.ts is missing `mc_enabled`, creating a type-level lie that will bite any TypeScript consumer that uses the interface to inspect version-record gate flags (WR-02).
- A subtle rank-trajectory bug for BGW players: they skip the `rank_trajectory` initialisation because their `_p50_by_horizon` is all zeros and they are sorted to rank 0 — they do get a trajectory, but only because `'rank_trajectory' not in p` is lazily initialised inside the ranking loop. If a position pool contains only BGW players the trajectory will have all zeros which is correct, but any player whose `element_type` is absent gets silently classified as MID rather than being excluded from ranking (WR-03).
- The `_read_existing_mc_enabled_flag` helper (accuracy.py:91) is defined but never called from production code — only from the test suite — making it dead production code (IN-01).

---

## Warnings

### WR-01: Four `_read_existing_*_flag` helpers open the cache file independently, bypassing `_read_existing_cache`

**File:** `pipeline/accuracy.py:40-106`

**Issue:** `_read_existing_xmins_v2_flag`, `_read_existing_bonus_predictor_flag`, `_read_existing_save_predictor_flag`, and the new `_read_existing_mc_enabled_flag` each open and parse `accuracy_backtest.json` independently. `_read_existing_cache` was added (comment says "WR-02") specifically to avoid this, and `compute_accuracy_backtest` correctly uses it at line 388. However, the four old helpers were never updated to delegate to `_read_existing_cache`. This means:

1. Any future path change or schema change must be updated in five places.
2. The helpers read the **pre-write** file (stale from the previous pipeline run), which is intentional for gate preservation — but the inconsistency is not documented on the helpers themselves, creating a future maintenance trap.
3. `_read_existing_mc_enabled_flag` opens the file a sixth time (or would, if called from production code).

**Fix:** Either delete the four helpers entirely (their only callers are tests and they duplicate `_read_existing_cache` logic), or have each delegate to `_read_existing_cache`:

```python
def _read_existing_mc_enabled_flag(cache_dir: str) -> bool:
    """Phase 90 MC-01 / D-01: preserve mc_enabled across backtest runs."""
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('mc_enabled', False))
```

---

### WR-02: `VersionGateFlags` TypeScript interface is missing `mc_enabled`

**File:** `src/lib/types.ts:438-443`

**Issue:** The `VersionGateFlags` interface only declares four fields:

```typescript
export interface VersionGateFlags {
  xmins_v2_enabled: boolean
  bonus_predictor_enabled: boolean
  form_signal_enabled: boolean
  save_predictor_enabled: boolean
}
```

`accuracy.py` writes `mc_enabled` into every version-record's `gate_flags` dict (lines 406 and 492). TypeScript consumers that read `VersionRecord.gate_flags.mc_enabled` will get `undefined` at runtime (no type error because the field is absent from the interface, not typed as `never`). Any future feature toggle UI that renders version-record gate flags will silently suppress the MC gate status.

**Fix:**

```typescript
export interface VersionGateFlags {
  xmins_v2_enabled: boolean
  bonus_predictor_enabled: boolean
  form_signal_enabled: boolean
  save_predictor_enabled: boolean
  mc_enabled: boolean          // Phase 90 MC-01: 5-GW MC simulation gate
}
```

---

### WR-03: Players with absent or invalid `element_type` are silently ranked as MID rather than excluded from `rank_trajectory`

**File:** `pipeline/simulate.py:218-220`

**Issue:** In the `rank_trajectory` computation, players with `element_type` missing or outside `{1, 2, 3, 4}` are silently coerced to position `3` (MID):

```python
pos = p.get('element_type', 3) or 3
if pos not in (1, 2, 3, 4):
    pos = 3
```

This contaminates the MID ranking pool with players who are not midfielders. The design decision (D-03) states rank_trajectory should be "within the same-position pool"; silently promoting broken players into the MID pool violates that invariant and inflates the MID pool size, shifting percentile ranks for all genuine MID players. The same coercion exists in `_simulate_player` (line 102) for the scoring constants lookup — that fallback is correct because GOAL_PTS/CS_PTS must resolve — but it is wrong in the cross-player ranking context.

**Fix:** Skip players with invalid/absent element_type when building the ranking pool, rather than coercing them to MID:

```python
pos = p.get('element_type')
if pos not in (1, 2, 3, 4):
    continue   # skip invalid — do not contaminate any position pool
pools[pos].append((val, p))
```

Players skipped here would receive no `rank_trajectory` entry; callers already treat the field as optional (types.ts line 197: `rank_trajectory?: number[]`).

---

### WR-04: `AccuracySummary` TypeScript interface is missing `mc_enabled`

**File:** `src/lib/types.ts:342-356`

**Issue:** `AccuracySummary` lists the gate flags added by Phases 52, 53, 63, and 88, but `mc_enabled` (Phase 90) is absent:

```typescript
export interface AccuracySummary {
  xpts_hit_rate: number
  gws: AccuracyGwSummary[]
  xpts_blended_hit_rate?: boolean
  form_signal_enabled?: boolean
  blend_alpha_used?: number
  mid_tier_hit_rate?: number
  mid_tier_blended_hit_rate?: number
  xmins_v2_enabled?: boolean
  bonus_predictor_enabled?: boolean
  save_predictor_enabled?: boolean
  news_flag_enabled?: boolean
  // mc_enabled is absent
}
```

`accuracy.py` unconditionally writes `mc_enabled` into the summary dict (line 424). Any TypeScript code that reads `summary.mc_enabled` to decide whether to render MC fields will receive `undefined` rather than `false`, which is falsy and will not crash, but it creates an inconsistent type contract. As more UI features consume this flag the missing type will become a bug magnet.

**Fix:**

```typescript
mc_enabled?: boolean   // Phase 90 MC-01: 5-GW MC simulation gate (default false)
```

Add this field to `AccuracySummary` alongside the other `*_enabled` flags.

---

## Info

### IN-01: `_read_existing_mc_enabled_flag` is dead production code — only called from tests

**File:** `pipeline/accuracy.py:91-106`

**Issue:** `_read_existing_mc_enabled_flag` is never called from `compute_accuracy_backtest` or `_empty_backtest`; those functions derive `mc_enabled` directly from `prior_cache` (the result of `_read_existing_cache`). The only call site is `test_simulate.py:268`. The same is true of `_read_existing_xmins_v2_flag`, `_read_existing_bonus_predictor_flag`, and `_read_existing_save_predictor_flag` — all four helpers are dead in production. Leaving dead public-ish helpers in a module encourages future callers to use the redundant path instead of the unified `_read_existing_cache` path.

**Fix:** Either delete the four helpers (the test should call `_read_existing_cache` directly), or document them explicitly as "test-only helpers" with a leading `_test_` name or inline comment.

---

### IN-02: `N_SIMS` and `MC_SEED` are evaluated at module import time, not inside `compute_simulations`

**File:** `pipeline/simulate.py:46-48`

**Issue:** Both constants are computed once when the module is imported:

```python
N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))
MC_SEED = int(os.environ.get('MC_SEED', 42))
```

`test_seed_determinism` and `test_iteration_count_gate` both use `importlib.reload(simulate)` to work around this. In a long-running process (e.g. a future WSGI/ASGI app or Celery worker) that changes the env vars after the module is first imported, the reload trick would not be available. The module-level evaluation is a known Python pattern for CLIs; documenting this constraint explicitly would prevent a future caller from being surprised.

This is not a bug in the current pipeline (run.py executes as a script), but it is a latent footgun.

**Fix:** Add a comment to both constants:

```python
# NOTE: evaluated at import time. Use importlib.reload(simulate) in tests if overriding.
N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))
MC_SEED = int(os.environ.get('MC_SEED', 42))
```

---

### IN-03: `test_mc_enabled_off_skip` validates source text rather than behaviour

**File:** `pipeline/tests/test_simulate.py:222-262`

**Issue:** The test asserts correctness by string-searching `run.py`'s source code for specific literal snippets:

```python
assert "mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)" in run_source
assert 'if mc_enabled:' in run_source
```

This is a structural/lexical assertion, not a behavioural one. It will pass even if the actual execution path is broken (e.g. the `if mc_enabled:` guard exists but `compute_simulations` is called unconditionally before it). It will also break trivially if the source is reformatted. The test comment acknowledges this ("the actual run.py modification is verified in plan 02") but the test still ships as is.

**Fix:** Replace the source-text assertions with a behavioural mock:

```python
with patch('simulate.compute_simulations') as mock_sim:
    # arrange: mc_enabled=False in the backtest file
    # act: call run.run() with mocked I/O
    # assert: mock_sim was never called
    mock_sim.assert_not_called()
```

If a full `run.run()` integration test is impractical, at minimum remove the string-search assertions and replace them with a comment explaining they are deferred to plan 02, so the test does not give false confidence.

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
