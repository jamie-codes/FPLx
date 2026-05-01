---
phase: 40-accuracy-pipeline
fixed_at: 2026-04-29T00:00:00Z
review_path: .planning/phases/40-accuracy-pipeline/40-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 40: Code Review Fix Report

**Fixed at:** 2026-04-29T00:00:00Z
**Source review:** .planning/phases/40-accuracy-pipeline/40-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 5
- Skipped: 2

## Fixed Issues

### CR-01: xmins semantic mismatch in `_reconstruct_xpts`

**Files modified:** `pipeline/accuracy.py`
**Commit:** 8638030
**Applied fix:** Changed `xmins = float(minutes)` to `xmins = start_prob * float(minutes)` on line 317 of `_reconstruct_xpts`. Updated the preceding comment to explain that `_compute_xpts_fixture` treats xmins as unconditional expected minutes (start_prob already baked in), so the product form is semantically correct-by-construction.

---

### CR-02: Module-level import of private cross-module function

**Files modified:** `pipeline/accuracy.py`
**Commit:** 7dfc32e
**Applied fix:** Removed `from merge import _compute_xpts_fixture` from module top-level (line 25). Added the same import as a deferred statement at the top of `_reconstruct_xpts`, matching the run.py pattern for cross-module private imports. Prevents ModuleNotFoundError at collection time in contexts where `pipeline/` is not on sys.path.

---

### WR-01: `_reconstruct_proj_pts` excludes the `MIN_MINUTES` guard for prior-window entries

**Files modified:** `pipeline/accuracy.py`
**Commit:** e75756e
**Applied fix:** Changed `played = [h for h in prior_entries if (h.get('minutes', 0) or 0) > 0]` to `>= MIN_MINUTES` so cameo prior-window entries (fewer than 10 minutes) are excluded from the rolling PPG calculation, consistent with the main backtest loop's guard.

---

### WR-02: Duplicate `json` import alias in `run.py`

**Files modified:** `pipeline/run.py`
**Commit:** 8d87519
**Applied fix:** Removed `import json as _json` from inside the `run()` function body and changed `_json.load(f)` to `json.load(f)`, using the top-level `import json` already present at line 5.

---

### WR-04: No test for `finished_gws = 0` edge case

**Files modified:** `pipeline/tests/test_accuracy.py`
**Commit:** 7c6191d
**Applied fix:** Added `test_empty_backtest_when_no_finished_gws` test that calls `compute_accuracy_backtest` with `finished_gws=0` and asserts the D-08 shape with empty lists for `gws_covered`, `haulters`, and `players`. Used `_build_minimal_inputs({}, finished_gws=0)` to correctly build minimal inputs. All 8 tests pass after this addition.

---

### WR-05: `total_points` summed without explicit int cast

**Files modified:** `pipeline/accuracy.py`
**Commit:** 52d30dd
**Applied fix:** Changed `agg['total_points'] += entry.get('total_points', 0) or 0` to `agg['total_points'] += int(entry.get('total_points', 0) or 0)` in `_group_history_by_gw`. Prevents string concatenation if the FPL API returns `total_points` as a string, consistent with the existing `float()` casts for `expected_goals` and `expected_assists`.

---

## Skipped Issues

### WR-03: `conftest.py` sys.path insertion targets the project root, not `pipeline/`

**File:** `pipeline/tests/conftest.py:13`
**Reason:** false positive — code is correct as written
**Original issue:** Reviewer claimed `os.path.dirname(os.path.dirname(os.path.abspath(__file__)))` from `pipeline/tests/conftest.py` resolves to the project root rather than `pipeline/`.

Verification: `__file__` resolves to `.../pipeline/tests/conftest.py`. Single `dirname` gives `.../pipeline/tests`. Double `dirname` gives `.../pipeline`. This was confirmed with Python:
```
>>> dirname(dirname(abspath('pipeline/tests/conftest.py'))) == 'pipeline/'  # True
```
The double-dirname correctly resolves to `pipeline/`, which is exactly what is needed for bare imports like `from accuracy import ...` to work. No fix required.

---

_Fixed: 2026-04-29T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
