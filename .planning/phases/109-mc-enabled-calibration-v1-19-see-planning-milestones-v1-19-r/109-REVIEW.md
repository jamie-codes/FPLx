---
phase: 109-mc-enabled-calibration
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pipeline/accuracy.py
  - pipeline/run.py
  - pipeline/tests/test_accuracy.py
  - src/lib/types.ts
  - src/components/squad/CalibrationHealthIndicator.tsx
  - src/components/squad/CalibrationHealthIndicator.test.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 109: Code Review Report

**Reviewed:** 2026-05-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 109 adds MC `haul_prob`-based calibration to the pipeline accuracy module and a mode badge to the `CalibrationHealthIndicator` React component. The core logic of `_compute_calibration_data` (MC sorting, `predicted_rate = mean(haul_prob)`, bucket_mid preservation) is correctly implemented and well-tested. The TypeScript type extension and React badge rendering are structurally sound.

Two blockers were found: the cold-start `_empty_backtest()` path omits `calibration_mode` from its summary dict (field introduced in this phase but not backfilled to the cold-start code path), and the MC-path `mc_enabled` flag assignment in `run.py` is only reachable when the prior `accuracy_backtest.json` reads successfully — a corrupt-cache run silently disables MC simulation even though `MC_ENABLED = True` is the permanent setting since Phase 102.

---

## Critical Issues

### CR-01: `_empty_backtest()` omits `calibration_mode` from summary

**File:** `pipeline/accuracy.py:495-516`

**Issue:** `_empty_backtest()` is the code path executed when `finished_gws < 1`. The function populates `summary` with all existing gate flags but does not include `calibration_mode`, which is a new field introduced in this phase. Any downstream consumer (UI, tests, next pipeline run) reading a cache file produced by the cold-start path will receive `undefined` for `calibration_mode` rather than `'analytical'`. The `AccuracySummary` TypeScript type marks it optional, so the UI will silently suppress the mode badge — but the contract implied by the phase spec (always written) is violated.

No existing test asserts `calibration_mode` is present in the `_empty_backtest` output; `test_empty_backtest_when_no_finished_gws` only checks the five top-level shape keys.

**Fix:**
```python
# pipeline/accuracy.py — inside _empty_backtest(), add to the summary dict:
'summary': {
    'xpts_hit_rate': 0.0,
    'xpts_blended_hit_rate': 0.0,
    'form_signal_enabled': False,
    'xmins_v2_enabled': xmins_v2_enabled,
    'bonus_predictor_enabled': bonus_predictor_enabled,
    'save_predictor_enabled': save_predictor_enabled,
    'mc_enabled': mc_enabled,
    'calibration_mode': 'analytical',   # <-- add this line
    'news_flag_enabled': True,
    'blend_alpha_used': BLEND_ALPHA,
    'mid_tier_hit_rate': 0.0,
    'mid_tier_blended_hit_rate': 0.0,
    'gws': [],
},
```

Also add a test assertion in `test_empty_backtest_when_no_finished_gws`:
```python
assert result['summary']['calibration_mode'] == 'analytical'
```

---

### CR-02: `mc_enabled` stays `False` on corrupt-cache run, silently disabling MC simulation

**File:** `pipeline/run.py:193-206`

**Issue:** `MC_ENABLED = True` is the permanent Phase-102 constant, but the assignment `mc_enabled = MC_ENABLED` (line 204) is **inside the `try` block**, only reached when `accuracy_backtest.json` opens and parses successfully. When the file is absent, `mc_enabled` correctly starts `False` and the `pass` in the `except` branch leaves it `False` (acceptable — cold start). However, when the file **exists but is corrupt** (`json.JSONDecodeError`), the `except` catches it, runs `pass`, and `mc_enabled` remains `False` — so MC simulation (line 224: `if mc_enabled:`) is silently skipped for the entire run. The permanent `MC_ENABLED` constant is bypassed by a transient I/O failure, and no warning is printed to signal that MC was unexpectedly disabled.

In production this results in `merged_players.json` being written **without** MC fields (`haul_prob`, `blank_prob`, etc.) and `haul_lookup` being empty when passed to `compute_accuracy_backtest`, causing calibration to degrade to `'analytical'` silently.

**Fix:**
```python
# pipeline/run.py — restructure the mc_enabled assignment so it is
# unconditional (reflecting Phase-102 permanent-ON decision), while still
# reading the other flags from the prior cache only when it is readable:

MC_ENABLED = True  # Phase 102 MC-01 — permanent ON
mc_enabled = MC_ENABLED  # always assign regardless of cache state

backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
    blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
    xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
    bonus_predictor_enabled = prev_backtest.get('summary', {}).get('bonus_predictor_enabled', False)
    save_predictor_enabled = prev_backtest.get('summary', {}).get('save_predictor_enabled', False)
    # mc_enabled: NOT read from cache — permanently True since Phase 102 (MC_ENABLED above)
except (FileNotFoundError, json.JSONDecodeError):
    pass
```

---

## Warnings

### WR-01: `CalibrationHealthIndicator` unsafe index into `MODE_BADGE_CLASSES` with unchecked cast

**File:** `src/components/squad/CalibrationHealthIndicator.tsx:72,92`

**Issue:** Line 72 casts `data.summary?.calibration_mode` to `CalibrationMode | undefined` with `as`. This suppresses TypeScript's type narrowing — if the runtime value is anything other than `'mc'` or `'analytical'` (e.g., a future pipeline value, a typo in a cached file, or an empty string), `MODE_BADGE_CLASSES[calibrationMode]` at line 92 evaluates to `undefined`. The template literal then renders `className="... undefined"`, injecting the string `"undefined"` into the DOM class list. The guard `{calibrationMode && (...)}` only protects against falsy values; a truthy unexpected string bypasses it.

**Fix:**
```tsx
// Replace the `as` cast with explicit narrowing:
const rawMode = data.summary?.calibration_mode
const calibrationMode: CalibrationMode | undefined =
  rawMode === 'mc' || rawMode === 'analytical' ? rawMode : undefined
```
This eliminates the runtime `undefined` class injection without changing any observed behaviour for valid values.

---

### WR-02: Coverage denominator mismatch between `run.py` print and `accuracy.py` gate

**File:** `pipeline/run.py:328` and `pipeline/accuracy.py:379-380`

**Issue:** `run.py` line 328 prints coverage as `len(haul_lookup) // max(len(merged), 1)`, comparing against the total **merged** list length. But `accuracy.py` line 379-380 computes the gate as:

```python
total_elements = len([e for e in bootstrap.get('elements', []) if e.get('starts', 0) > 0])
coverage_pct = len(merged_haul_lookup) / total_elements
```

The denominator in `accuracy.py` is the count of bootstrap elements with `starts > 0`, which can differ from `len(merged)` (e.g., if merge excludes some players, or if bootstrap has zero-start players that contribute to `starts > 0` via the bootstrap field vs the FPL reality). If `len(bootstrap_starts_players) > len(merged)`, then `coverage_pct` in the accuracy module will be **lower** than what the print statement reports, meaning the gate may flip to analytical even when the printed "80%+" suggests it should be MC. The log line will show a passing coverage but the gate logic will silently use a lower figure.

**Fix:** Align the denominator. Either pass `total_elements` from `run.py` into `compute_accuracy_backtest` as the agreed denominator, or document clearly that the two figures measure different populations. The simplest fix is to match the print to the actual gate calculation:

```python
# pipeline/run.py line 328 — use bootstrap elements count to match accuracy.py gate:
total_elements_with_starts = len([e for e in bootstrap.get('elements', []) if e.get('starts', 0) > 0])
print(f"MC haul_prob coverage: {len(haul_lookup)}/{total_elements_with_starts} "
      f"({100 * len(haul_lookup) // max(total_elements_with_starts, 1)}%)")
```

---

### WR-03: `_compute_calibration_data` MC-path conditional is asymmetric

**File:** `pipeline/accuracy.py:561,611`

**Issue:** Two separate checks gate the MC path:
- Line 561: `if use_mc and merged_haul_lookup:` (sort step)
- Line 611: `if use_mc and merged_haul_lookup:` (predicted_rate computation)

`merged_haul_lookup` is always a `dict` after line 545's null guard. Its truthiness (`bool({})`) is `False` for an empty dict. However, `use_mc=True` requires `coverage_pct >= 0.80`, which requires `len(merged_haul_lookup) >= 0.80 * total_elements > 0`. Therefore `use_mc=True` implies a non-empty lookup. The condition `and merged_haul_lookup` is redundant — but the asymmetry creates a latent inconsistency: if this function were called directly with `use_mc=True` and an empty dict (e.g. in a future unit test or refactor), the sort step falls through to analytical while the `predicted_rate` path also takes analytical — the two branches agree in that degenerate case, but only by coincidence of the condition order. The redundant `and merged_haul_lookup` guard should be removed on both lines and the invariant should be documented, or the function should raise a `ValueError` when `use_mc=True` and `merged_haul_lookup` is empty.

**Fix:**
```python
# pipeline/accuracy.py — replace the redundant guard in both places:
if use_mc:
    ranked = sorted(rows, key=lambda r: merged_haul_lookup.get(r['player_id'], 0.0), reverse=True)
else:
    ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)

# ...and:
if use_mc:
    predicted_rate = round(bucket_sum_haul_prob[pos_key][d] / total, 4)
else:
    predicted_rate = bucket_mids[d]
```

---

## Info

### IN-01: Four single-flag reader functions are dead code after WR-02 refactor

**File:** `pipeline/accuracy.py:40-82`

**Issue:** `_read_existing_xmins_v2_flag`, `_read_existing_bonus_predictor_flag`, `_read_existing_save_predictor_flag`, and `_read_existing_mc_enabled_flag` were superseded by the WR-02 pattern (`_read_existing_cache()` called once with all flags derived inline). None of these four functions is called anywhere in the codebase. They are dead code and create a maintenance hazard — a future developer might call one and believe it is the canonical flag-reading path, bypassing the single-read optimisation.

**Fix:** Remove all four functions. The `_read_existing_cache` function is the documented single-read canonical pattern per the WR-02 comment.

---

### IN-02: `N = Math.round(maxDeviation * 100)` produces "within 0pp" sentence for sub-0.5pp deviations

**File:** `src/components/squad/CalibrationHealthIndicator.tsx:73,75`

**Issue:** If `maxDeviation` is less than `0.005` (i.e., less than 0.5 percentage points), `Math.round(maxDeviation * 100)` evaluates to `0`, and the sentence reads "predicted vs actual within 0pp across N deciles". This implies perfect calibration — which is technically accurate but is grammatically confusing ("within 0pp" reads as zero tolerance). This is unlikely in practice but could occur with highly uniform MC inputs in testing.

**Fix:** Consider using `Math.max(1, Math.round(maxDeviation * 100))` to floor at 1pp in the display, or using `<1pp` as a special case label. No change to tier logic needed.

---

_Reviewed: 2026-05-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
