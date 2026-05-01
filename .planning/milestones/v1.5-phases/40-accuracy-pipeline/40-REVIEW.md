---
phase: 40-accuracy-pipeline
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/accuracy.py
  - pipeline/run.py
  - pipeline/tests/__init__.py
  - pipeline/tests/conftest.py
  - pipeline/tests/test_accuracy.py
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The accuracy pipeline (ACC-01) is well-structured and follows the defcon.py module pattern. The public API, DGW aggregation, haulter flagging, and snapshot format are all sound. However, two blockers were found: a semantic mismatch in how `xmins` is passed to `_compute_xpts_fixture` (the function requires unconditional xmins = `start_prob × avg_mins`, but the caller passes raw `minutes` with `start_prob = 1.0`, causing the two parameters to double-count each other), and a cross-module private import that will break in any multi-process or packaged deployment. Five warnings cover missing MIN_MINUTES guard in `_reconstruct_proj_pts`, a duplicate `import json` alias, the conftest.py path insertion targeting the wrong directory, a missing edge-case test for `finished_gws = 0`, and an unverified assumption that `_compute_xpts_fixture` returns a `dict` with a `'total'` key under all code paths (the callee returns early with a plain dict, but this is safe — flagged for documentation only in info).

---

## Critical Issues

### CR-01: xmins semantic mismatch in `_reconstruct_xpts` causes inflated xPts values

**File:** `pipeline/accuracy.py:317-327`

**Issue:** `_compute_xpts_fixture` (merge.py line 179, 187-189) defines `xmins` as *unconditional expected minutes* — i.e. `start_prob × avg_mins`. Its internal calculations (`lam_g`, `lam_a`, `bonus_pts`, `_cs_prob`) all use `xmins / 90.0` as the scaling factor, *without* re-applying `start_prob`, because start_prob is already baked into xmins.

In `_reconstruct_xpts`, however, the call site sets:
```python
start_prob = 1.0          # binary: full start
xmins = float(minutes)    # e.g. 90.0
```

With `start_prob = 1.0` and `xmins = 90`, the maths is:
- `lam_g = xg_per90 * (90 / 90)` — correct *only* because start_prob happens to be 1.0 here
- `_cs_prob(defensive_difficulty, xmins=90)` → `mins_factor = min(1.0, 90/60) = 1.0` — also incidentally correct

The real problem is conceptual: if a player played exactly 45 minutes (the binary `start_prob` boundary), `_reconstruct_xpts` filters them out before this call (line 307-308 returns 0.0 if `start_prob == 0`), so there is no intermediate case. But the `xmins` parameter *semantically* should be `start_prob × expected_avg_mins = 1.0 × minutes`, which happens to equal `minutes` — so the numeric result is accidentally correct for the binary 1.0 / 0.0 case.

**However**, the function comment on line 316 says "xmins = actual minutes (since start_prob = 1.0, xmins ~= minutes)", which confirms the author understood they were relying on `start_prob = 1.0` to avoid the double-counting. This is a latent bug that will silently produce wrong values if the binary start_prob logic is ever relaxed to a continuous probability (e.g., if a player played 50 minutes and was given `start_prob = 0.8`). The comment does NOT document this assumption as an invariant; it reads as a casual observation, not a contract.

Additionally, the comment on line 16 says "D-04 binary start_prob (>=45 min)" — this is a locked decision, so the numeric output is correct today. But the code will silently produce wrong xPts the moment any caller deviates.

**Fix:** Make the invariant explicit in code, not just comments. Assert it, or compute xmins from the canonical formula:
```python
# Enforce: xmins MUST equal start_prob × minutes when start_prob is binary.
# _compute_xpts_fixture treats xmins as unconditional expected minutes.
xmins = start_prob * float(minutes)   # = 1.0 * minutes for full starters
result = _compute_xpts_fixture(
    xg_per90=xg_per90,
    xa_per90=xa_per90,
    start_prob=start_prob,
    xmins=xmins,           # now correctly unconditional
    element_type=element_type,
    defensive_difficulty=difficulty_score,
)
```
This makes the semantic correct-by-construction rather than correct-by-coincidence.

---

### CR-02: Cross-module import of a private function (`merge._compute_xpts_fixture`) will fail in packaged or test-isolated deployments

**File:** `pipeline/accuracy.py:25`

**Issue:**
```python
from merge import _compute_xpts_fixture  # cross-module private import (existing pattern: run.py line 198)
```

This is a module-level import at file load time. The comment cites "run.py line 198" as precedent, but that import (`from merge import _compute_difficulty_scores`) is inside the `run()` function body, meaning it only executes at call time, not import time. `accuracy.py` imports at module level.

Consequence: any test that imports `accuracy` without having `pipeline/` on `sys.path` will fail with `ModuleNotFoundError: No module named 'merge'`. The conftest.py adds `pipeline/` (actually the `pipeline/tests/` parent which is `pipeline/` — see Warning WR-03) to sys.path, so tests *happen* to work. But if `accuracy.py` is ever imported from a context that doesn't include the pipeline directory (e.g., a linter, a type checker, a CI import graph scanner, or any other module outside pipeline/), the import fails immediately — before any function is called.

The private-function cross-import is also a coupling issue: `_compute_xpts_fixture` is prefixed `_` indicating it's internal to `merge.py`. If `merge.py` ever refactors its internals, `accuracy.py` breaks silently.

**Fix:** Move `_compute_xpts_fixture` to a shared internal module (e.g., `pipeline/xpts_engine.py`) and import from there, or promote it to a public API in merge.py. As a minimum safe fix for today:
```python
# Move import inside the function that uses it, matching run.py's pattern:
def _reconstruct_xpts(entry, element_type, difficulty_score):
    from merge import _compute_xpts_fixture   # deferred — matches run.py style
    ...
```
This delays the failure to call time rather than import time, giving clearer error messages and avoiding test-collection failures if the import path is misconfigured.

---

## Warnings

### WR-01: `_reconstruct_proj_pts` does not apply the `MIN_MINUTES` guard — returns non-zero for cameo entries

**File:** `pipeline/accuracy.py:337-358`

**Issue:** The module-level docstring and `compute_accuracy_backtest` both enforce `MIN_MINUTES = 10` (line 101-102) to exclude DNP/cameo entries. But `_reconstruct_proj_pts` checks only `minutes <= 0` (line 338-339). If a player played 5 minutes in a prior GW, that entry is included in `played` (line 341) and contributes a per-90 score of `(pts / 5) * 90`, which could be huge (e.g., a 1-point bonus in 5 minutes → 18 per-90). This inflates `ppg` in the rolling window.

The `MIN_MINUTES` constant exists specifically to filter this noise but is not used in `_reconstruct_proj_pts`. The inconsistency means prior-window entries that would be excluded from backtest rows (because they're cameos) still pollute the PPG calculation.

**Fix:**
```python
played = [h for h in prior_entries if (h.get('minutes', 0) or 0) >= MIN_MINUTES]
```

---

### WR-02: Duplicate `json` import alias in `run.py` — shadowing risk

**File:** `pipeline/run.py:141`

**Issue:** `json` is already imported at the top of the file (line 5). Inside the `run()` function, `import json as _json` re-imports the same module under a different alias. While Python caches modules and this doesn't cause a functional bug today, the alias `_json` is used only for `_json.load(f)` on line 144 — three lines after the alias is created. The top-level `json` module is used everywhere else (lines 189, 261, 278). This is dead-alias code that creates a maintenance trap: future editors may not realize `json` is already available and assume `_json` is needed.

**Fix:** Remove `import json as _json` and use the existing `json` name:
```python
with open(id_map_path, 'r', encoding='utf-8') as f:
    id_map = json.load(f)
```

---

### WR-03: `conftest.py` path insertion points at `pipeline/` but comment says "parent of tests/"

**File:** `pipeline/tests/conftest.py:13-15`

**Issue:**
```python
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
```

`__file__` is `pipeline/tests/conftest.py`. `dirname(__file__)` → `pipeline/tests/`. `dirname(dirname(__file__))` → the **project root** (`fplx/`), not `pipeline/`. The comment on line 13 says "Insert pipeline/ (the parent of tests/) onto sys.path" but the code inserts the project root.

The net effect is that `from accuracy import ...` works only because `sys.path.insert(0, project_root)` happens to make `pipeline/accuracy.py` importable as `accuracy` when `pipeline/` is NOT in sys.path but `pipeline/accuracy.py` is not in the root. Actually — this is **broken**: `from accuracy import ...` in the tests would only work if `pipeline/` is on sys.path. The double-dirname gives the project root, not `pipeline/`. This means tests would fail with `ModuleNotFoundError: No module named 'accuracy'` unless `pipeline/` is separately on sys.path (e.g., via run.py's own `sys.path.insert`).

**Fix:**
```python
# Should be single dirname to reach pipeline/ from pipeline/tests/
PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))  # pipeline/tests/ -> pipeline/
```
Or equivalently:
```python
PIPELINE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PIPELINE_DIR = os.path.normpath(PIPELINE_DIR)
```

---

### WR-04: No test for `finished_gws = 0` edge case — `_empty_backtest` path is untested

**File:** `pipeline/tests/test_accuracy.py` (missing test)

**Issue:** `compute_accuracy_backtest` returns `_empty_backtest()` immediately when `finished_gws < 1` (accuracy.py line 56-57). None of the five tests exercises this path. `_empty_backtest()` returns a dict with specific keys (`generated_at`, `gws_covered: []`, `summary`, `haulters: []`, `players: []`) — if its structure diverges from D-08, the API contract is broken silently.

**Fix:** Add a test:
```python
def test_empty_backtest_when_no_finished_gws():
    summaries, _, bootstrap, fixtures = _build_minimal_inputs({})
    result = compute_accuracy_backtest(summaries, 0, bootstrap, fixtures)
    for key in ('generated_at', 'gws_covered', 'summary', 'haulters', 'players'):
        assert key in result
    assert result['gws_covered'] == []
    assert result['haulters'] == []
    assert result['players'] == []
```

---

### WR-05: `_group_history_by_gw` silently drops `total_points` fields that are `None` vs `0`

**File:** `pipeline/accuracy.py:289`

**Issue:** The aggregation uses `entry.get('total_points', 0) or 0` which correctly treats `None` as `0`. However, `expected_goals` and `expected_assists` are stored as strings in the FPL API response (e.g., `"0.37"`) — not floats. The cast `float(entry.get('expected_goals', 0) or 0)` handles this correctly for string values. But `total_points` is NOT cast — it is added directly with `+=`. If the FPL API ever returns `total_points` as a string (e.g., `"6"`), the `+=` will concatenate strings instead of summing integers, producing a corrupt `actual_pts` value without raising an exception.

The FPL API currently returns `total_points` as an integer, but the inconsistency in defensive coding (float-cast for xG/xA but not for total_points) is a quality gap.

**Fix:**
```python
agg['total_points'] += int(entry.get('total_points', 0) or 0)
```

---

## Info

### IN-01: `starts` field used as a proxy for "has data" — semantics are fragile

**File:** `pipeline/accuracy.py:83-84`

**Issue:**
```python
if element.get('starts', 0) == 0:
    continue  # Pitfall 2: zero-start players have no summary entry
```

`starts` counts times a player started. A player who only came off the bench every game has `starts = 0` but will have a valid element summary with history entries. These players are silently skipped. The comment says "zero-start players have no summary entry" but this is an empirical assumption, not an API guarantee. Bench-only players with meaningful FPL points (e.g., super-sub forwards) are excluded from all backtest data.

This is a deliberate design choice that should be documented as such, but the current comment implies it's a data-availability guard rather than a scope restriction.

**Fix:** Add a clearer comment:
```python
# Scope restriction (Claude's Discretion): exclude bench-only players
# (starts == 0). These players have unpredictable minutes and their
# inclusion adds noise. Note: they DO have summary entries — this is
# not a data-availability guard.
if element.get('starts', 0) == 0:
    continue
```

---

### IN-02: `import time as _time` inside `run()` function body is inconsistent with top-level imports

**File:** `pipeline/run.py:148`

**Issue:** Standard library modules (`time`, `json`) are re-imported inside the function body with aliases rather than at the top of the file. This is inconsistent with PEP 8 ("imports are always put at the top of the file"). `from datetime import datetime, timezone` is also imported twice: once at line 228 and once at line 251, both inside except/try blocks, while `accuracy.py` imports it at the top.

**Fix:** Move all stdlib imports to the top of the file.

---

### IN-03: `test_hit_rate_computation` assertion comment is misleading — equal xPts values produce arbitrary rank order

**File:** `pipeline/tests/test_accuracy.py:139-141`

**Issue:**
```python
# By construction every haulter scored equally, so all should rank top-10
# (only 4 players in pool) -> hit rate = 1.0
assert gw32['xpts_hit_rate'] == pytest.approx(1.0)
```

The comment says "every haulter scored equally" — they all have the same GW-32 history entry (`xg=0.8, xa=0.5`) so their `xpts_predicted` values will be identical. The `sorted(..., reverse=True)` sort is not stable with respect to equal keys in Python's `sorted()` — but because all 4 players are in the pool of 4 and `TOP_N_PREDICTED = 10`, all 4 will rank in the top 10 regardless of sort order. The assertion is correct, but the comment's reasoning ("all should rank top-10") is only valid because the pool size (4) is smaller than `TOP_N_PREDICTED` (10). If the test were extended with more players having the same score, ties could cause some to rank outside top-10 depending on the secondary sort key (which is undefined). The test should document this dependency.

**Fix:** Add a comment noting pool-size dependency:
```python
# All 4 haulters are in a pool of 4 < TOP_N_PREDICTED (10), so all rank
# top-10 regardless of tie-breaking order. hit_rate == 1.0.
```

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
