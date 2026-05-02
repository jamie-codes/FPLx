---
phase: 053-bonus-point-predictor
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - pipeline/bonus.py
  - pipeline/accuracy.py
  - pipeline/merge.py
  - pipeline/run.py
  - pipeline/tests/test_bonus.py
  - pipeline/tests/test_accuracy.py
  - pipeline/tests/test_merge_bonus.py
  - pipeline/tests/test_merge_xpts_components.py
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 053: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Eight files reviewed covering the bonus point predictor implementation (BPS-01): the new `bonus.py` module, flag-threading changes to `merge.py`, `run.py`, and `accuracy.py`, plus four test files. The shrinkage estimator formula and BPS-CS residualisation logic are both correct. All six `_compute_xpts_fixture` / `_xpts_ngw` / `_compute_xpts_sigma` call sites in `merge.py` receive the new kwargs. `run.py` import and kwarg threading are correct.

One blocker was found: the `_empty_backtest()` early-return path hardcodes both `xmins_v2_enabled: False` and `bonus_predictor_enabled: False`, bypassing the flag persistence helpers. A manually-flipped flag is silently reset to False whenever `compute_accuracy_backtest` is called with `finished_gws < 1`. Three warnings cover: a misleading test docstring that inverts the actual formula it is testing; duplicate file I/O in the two flag persistence helpers; and a missing test asserting that flag persistence is correctly destroyed by the `_empty_backtest` path (the gap would allow the bug above to go undetected in CI). Two info items cover dead kwargs in `_compute_xpts_sigma` and a minor naming issue.

---

## Critical Issues

### CR-01: `_empty_backtest()` Hardcodes Flags to False, Bypassing Persistence Helpers

**File:** `pipeline/accuracy.py:96-97, 355-373`

**Issue:** `compute_accuracy_backtest` returns `_empty_backtest()` immediately when `finished_gws < 1`, before the calls to `_read_existing_xmins_v2_flag` and `_read_existing_bonus_predictor_flag` at lines 306-307. `_empty_backtest()` hardcodes both `xmins_v2_enabled: False` and `bonus_predictor_enabled: False`. If a pipeline run occurs with `finished_gws=0` (pre-season reset, data corruption, or an early-season run before GW1 is marked finished), any previously manually-flipped True values in the persisted `accuracy_backtest.json` are silently overwritten with False. On the next run with real data, `run.py` will read the just-written False values and pass `bonus_predictor_enabled=False` to `merge_players`, disabling the bonus model without operator notice.

This affects both the Phase 52 (`xmins_v2_enabled`) and Phase 53 (`bonus_predictor_enabled`) gates identically. Phase 53 introduced the second flag and the pattern, but did not fix the pre-existing gap in the early-return path.

**Fix:**
```python
def _empty_backtest(cache_dir: str = '') -> dict:
    """Return an empty but well-shaped backtest (used when no GWs are finished)."""
    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'gws_covered': [],
        'summary': {
            'xpts_hit_rate': 0.0,
            'xpts_blended_hit_rate': 0.0,
            'form_signal_enabled': False,
            'xmins_v2_enabled': _read_existing_xmins_v2_flag(cache_dir),          # preserved
            'bonus_predictor_enabled': _read_existing_bonus_predictor_flag(cache_dir),  # preserved
            'blend_alpha_used': BLEND_ALPHA,
            'mid_tier_hit_rate': 0.0,
            'mid_tier_blended_hit_rate': 0.0,
            'gws': [],
        },
        'haulters': [],
        'players': [],
    }
```

And update the call site at line 97:
```python
if finished_gws < 1:
    return _empty_backtest(cache_dir)
```

---

## Warnings

### WR-01: Test Docstring Inverts the Formula It Is Testing

**File:** `pipeline/tests/test_bonus.py:84-93`

**Issue:** `test_shrinkage_full_weight_at_n12` has the docstring "n_starts=12 -> w=1.0 -> bonus_ev equals empirical mean", implying the test verifies the full-weight (w=1.0) boundary. The test body immediately contradicts this: "Only recent[-10:] count -> 10 starts, w = min(1, 10/12) = 0.833". The test actually exercises w=0.833 — NOT w=1.0.

This matters because there is NO test in the suite for the true w=1.0 boundary (n_starts >= 12 within a 10-entry window would require `SHRINKAGE_K <= 10`). A developer reading the docstring would believe the full-weight case is covered; it is not. The assertion in the body is internally correct but the mislabelled docstring creates a coverage blindspot.

**Fix:** Either correct the docstring to describe what is actually tested, or add a separate test for the true w=1.0 boundary (e.g., set `SHRINKAGE_K=10` temporarily, or build a 10-entry history where n_starts=10 and verify w=1.0):

```python
def test_shrinkage_partial_weight_at_n10_window():
    """recent[-10:] window with 10 starts, SHRINKAGE_K=12 -> w=10/12 (partial weight)."""
    bonuses = [2] * 12
    history = [_hist(b) for b in bonuses]
    # Only recent[-10:] count -> 10 starts, w = min(1, 10/12) ≈ 0.833
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    w = 10 / 12.0
    expected = w * 2.0 + (1.0 - w) * 0.60
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
```

### WR-02: Flag Persistence Helpers Open the Same File Twice (Non-Atomic Double Read)

**File:** `pipeline/accuracy.py:39-69, 306-307`

**Issue:** `_read_existing_xmins_v2_flag` and `_read_existing_bonus_predictor_flag` are separate functions that each open, parse, and close `accuracy_backtest.json` independently. They are called back-to-back at lines 306-307. Two separate file reads means:
1. If the file is modified between the two reads (unlikely but not impossible in CI environments with concurrent processes), the two flags could reflect different on-disk states.
2. Double JSON parse overhead on every pipeline run.

A single helper that returns both flags in one read would be both safer and more efficient.

**Fix:**
```python
def _read_existing_flags(cache_dir: str) -> dict:
    """Read all persisted gate flags from prior accuracy_backtest.json in one pass."""
    defaults = {'xmins_v2_enabled': False, 'bonus_predictor_enabled': False}
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        summary = prev.get('summary', {})
        return {
            'xmins_v2_enabled': bool(summary.get('xmins_v2_enabled', False)),
            'bonus_predictor_enabled': bool(summary.get('bonus_predictor_enabled', False)),
        }
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return defaults
```

Then call once: `flags = _read_existing_flags(cache_dir)`.

### WR-03: No Test for Flag-Reset Bug in `_empty_backtest` Path

**File:** `pipeline/tests/test_accuracy.py:178-185`

**Issue:** `test_empty_backtest_when_no_finished_gws` calls `compute_accuracy_backtest` with `finished_gws=0` but does not provide a `cache_dir` with a seeded prior file, and does not assert anything about `bonus_predictor_enabled` or `xmins_v2_enabled`. This means CR-01 (flag reset in the empty-backtest path) is completely invisible to CI. A test that seeds a prior `accuracy_backtest.json` with flags True and then calls with `finished_gws=0` would expose CR-01 as a test failure.

**Fix:** Add a test to `test_accuracy.py`:
```python
def test_empty_backtest_preserves_flags_on_zero_gws(tmp_path):
    """Flags must survive compute_accuracy_backtest even when finished_gws=0."""
    import json as _json
    prior_path = tmp_path / 'accuracy_backtest.json'
    prior_path.write_text(_json.dumps({
        'summary': {
            'bonus_predictor_enabled': True,
            'xmins_v2_enabled': True,
        },
    }))
    summaries, _, bootstrap, fixtures = _build_minimal_inputs({}, finished_gws=0)
    result = compute_accuracy_backtest(summaries, 0, bootstrap, fixtures,
                                       cache_dir=str(tmp_path))
    assert result['summary']['bonus_predictor_enabled'] is True, \
        "bonus_predictor_enabled must be preserved in empty backtest"
    assert result['summary']['xmins_v2_enabled'] is True, \
        "xmins_v2_enabled must be preserved in empty backtest"
```

This test currently FAILS (confirming CR-01) and will pass once the fix in CR-01 is applied.

---

## Info

### IN-01: `_compute_xpts_sigma` Accepts Bonus Kwargs But Ignores Them — No Signal to Caller

**File:** `pipeline/merge.py:325-376`

**Issue:** `_compute_xpts_sigma` accepts `bonus_predictor_enabled: bool = False` and `bonus_ev: float | None = None` for signature parity, but neither parameter is used in the function body (bonus variance is intentionally omitted per the docstring). A caller passing `bonus_predictor_enabled=True` gets no indication that the per-player bonus EV has no effect on the sigma. The test `test_compute_xpts_sigma_accepts_bonus_kwargs` only verifies the function does not raise — it cannot verify that the kwargs are correctly processed because they are intentionally discarded.

No behaviour change is needed, but the docstring should note explicitly that `bonus_predictor_enabled` and `bonus_ev` are accepted for API parity only and have no effect on the returned sigma:

```python
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
) -> float:
    """Analytical sigma for xPts across an N-GW window (Phase 28 XPTS-02 D-09).
    ...
    Note: bonus_predictor_enabled and bonus_ev are accepted for API parity with
    _xpts_ngw and _compute_xpts_fixture but are not used — bonus variance is omitted
    as it is small relative to goal/CS variance for most players.
    """
```

### IN-02: `cache_dir=''` Default Resolves to CWD, Not Pipeline Cache — Silent Path Mismatch

**File:** `pipeline/accuracy.py:81`

**Issue:** `compute_accuracy_backtest` has `cache_dir: str = ''` as its default. When called without a `cache_dir` argument (e.g., in tests that omit it), `os.path.join('', 'accuracy_backtest.json')` resolves to `'accuracy_backtest.json'` in the current working directory at runtime. In production, `run.py` always supplies the explicit path (`cache_dir=cache_dir`), so the default is never used in production. However, in tests (e.g., `test_backtest_writes_bonus_predictor_flag` at line 332), the default `''` is used. If a developer accidentally runs tests from the `pipeline/cache/` directory, or if a stale `accuracy_backtest.json` exists in CWD, the flag-persistence behaviour could be influenced by an unexpected file.

A safer default would be an explicit sentinel (e.g., `cache_dir: str | None = None`) with an explicit guard:

```python
def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
    cache_dir: str | None = None,
) -> dict:
    if cache_dir is None:
        cache_dir = ''  # disables persistence; flag helpers return False immediately
```

This would not change production behaviour (run.py passes an explicit path) but makes the intent explicit and prevents accidental CWD reads in tests.

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
