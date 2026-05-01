---
phase: 47-fixture-swing-cs-prob
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - pipeline/merge.py
  - pipeline/tests/test_merge_cs_prob.py
  - src/app/page.test.tsx
  - src/app/page.tsx
  - src/components/club-form/FixtureSwingDetector.tsx
  - src/components/gem-table/GwToggle.tsx
  - src/components/gem-table/columns.tsx
  - src/lib/__tests__/club-form-swing.test.ts
  - src/lib/club-form.ts
  - src/lib/types.ts
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-05-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase delivers two features: (1) a Fixture Swing Detector UI component and accompanying `computeClubForm` extension that computes `swing_1gw/3gw/5gw` deltas; and (2) a `cs_prob_1gw` field in the pipeline that exposes clean-sheet probability per player for the next GW. The logic in both areas is generally sound. One critical bug exists: the `tier()` function in `club-form.ts` inverts the polarity of its argument when called from the fixture-building loop, causing incorrect `difficulty_tier` labels on every upcoming fixture row. Five warnings cover a guard inconsistency in `merge.py`, a tooltip string that always shows the absolute magnitude regardless of direction, a `meanEase` call that can return `null` despite the upstream guard asserting otherwise, a missing negative-xmins test, and a stale comment in the test file. Two info-level items cover a redundant import pattern and a magic number.

---

## Critical Issues

### CR-01: `tier()` called with inverted argument in `club-form.ts` — wrong `difficulty_tier` on every fixture row

**File:** `src/lib/club-form.ts:132` and `src/lib/club-form.ts:146`

**Issue:** The `tier()` closure expects a **difficulty score** (0 = easiest, 1 = hardest) computed by `diffScore()`, which is defined as `1 - normalised_xGA`. Inside the upcoming-fixture loop, however, it is called with `1 - attDiff` — the **ease** value — not the difficulty score.

```ts
// club-form.ts line 132 (home team):
difficulty_tier: tier(1 - attDiff),   // WRONG: passes ease, not difficulty score

// club-form.ts line 146 (away team):
difficulty_tier: tier(1 - attDiff),   // WRONG: same mistake
```

The `tier()` function's thresholds were calibrated against difficulty scores (`hardThreshScore` is high for hard fixtures, `easyThreshScore` is low for easy fixtures). When it receives `1 - attDiff` (ease), the comparison polarity is reversed: a genuinely easy fixture (attDiff ≈ 0, ease ≈ 1.0) is passed as a high score to `tier()`, which maps high scores to `'hard'`, and vice-versa. Every upcoming fixture row consequently gets the opposite tier from what it should.

**Fix:**
```ts
// Pass attDiff directly — it is already in the [0, 1] difficulty-score space:
difficulty_tier: tier(attDiff),
```

This aligns with how the `merge.py` pipeline computes tiers: `_difficulty_tier(score, ...)` receives the un-inverted normalised difficulty score (line 711–718 of `merge.py`).

---

## Warnings

### WR-01: Guard inconsistency in `_xpts_ngw` / `_compute_xpts_sigma` vs `_cs_prob_1gw_for_fixtures` — negative xmins accepted in two of three sibling functions

**File:** `pipeline/merge.py:259` and `pipeline/merge.py:313`

**Issue:** `_cs_prob_1gw_for_fixtures` correctly guards with `xmins <= 0` (line 155), treating any non-positive value as zero minutes. The two sibling functions `_xpts_ngw` and `_compute_xpts_sigma` guard with `xmins == 0` (exact equality). A negative `xmins` (which can occur if upstream `xmins_stats` data is corrupt) would bypass the guard in `_xpts_ngw` and `_compute_xpts_sigma`, producing negative expected-points and negative sigma values that corrupt the ceiling classification and captain-pick ranking.

```python
# _xpts_ngw (line 259) — misses negative xmins:
if not fixtures or start_prob == 0 or xmins == 0:

# _compute_xpts_sigma (line 313) — same issue:
if not fixtures or start_prob == 0 or xmins == 0:

# _cs_prob_1gw_for_fixtures (line 155) — correct:
if not fixtures or xmins <= 0:
```

**Fix:** Change both guards to use `<= 0`:
```python
if not fixtures or start_prob <= 0 or xmins <= 0:
```

Apply to both `_xpts_ngw` (line 259) and `_compute_xpts_sigma` (line 313). Also changes `start_prob == 0` to `start_prob <= 0` for the same reason.

---

### WR-02: Tooltip always shows absolute magnitude of swing for "worsening" direction — misleading sign

**File:** `src/components/club-form/FixtureSwingDetector.tsx:160`

**Issue:** For worsening rows, `row.swing` is negative (e.g. `-0.40`). The tooltip text reads:

```
`Fixture run worsening: upcoming ${win}GW ease ${(row.swing * 100).toFixed(0)}% below past 3GW average.`
```

`(row.swing * 100).toFixed(0)` for a swing of `-0.40` produces the string `"-40"`. The tooltip therefore reads _"ease -40% below past 3GW average"_ — a double-negative that is confusing to users. The tooltip for the improving case correctly shows `"+40"` because the swing is positive and a `+` sign is prepended in the badge label (line 149), but there is no `+` prepended in the tooltip string, and for worsening the sign already encodes direction yet the word "below" re-states it.

**Fix:** Use `Math.abs()` in the tooltip for the worsening branch, and symmetrically for improving:
```tsx
title={
  direction === 'IMPROVING'
    ? `Fixture run improving: upcoming ${win}GW ease ${Math.abs(row.swing * 100).toFixed(0)}% above past 3GW average. Potential buy signal for ${row.team.team_short_name} defenders.`
    : `Fixture run worsening: upcoming ${win}GW ease ${Math.abs(row.swing * 100).toFixed(0)}% below past 3GW average. Consider selling ${row.team.team_short_name} defenders.`
}
```

---

### WR-03: `meanEase(finishedFx, 3, 'attacking_difficulty')` can still return `null` after the `>= 3` guard, breaking the `past_ease_3gw` null contract

**File:** `src/lib/club-form.ts:184–186`

**Issue:** The guard at line 184 ensures `finishedFx.length >= 3`. However, `meanEase()` filters by `typeof f[key] === 'number'` (line 9). If any of the three fixtures has `attacking_difficulty` that is not a number (e.g. `undefined` or `NaN`) after the `fplToAttDiff()` mapping, `present.length` could be less than 3 and `meanEase` could return `null`. The type system accepts this because `meanEase` returns `number | null`. The downstream swing computation assumes `past_ease_3gw` is `number` when `finishedFx.length >= 3`, because the ternary at line 184 only checks list length, not data validity.

In practice this cannot happen today because `fplToAttDiff` always returns a number, but the guard is logically insufficient and fragile: future callers that construct the `finishedFx` shape from a different source could silently produce a `null` `past_ease_3gw` despite having 3 fixtures, and the swing fields would silently be `null` with no error surfaced.

**Fix:** Assert the result is non-null after the guard:
```ts
const past_ease_3gw: number | null = finishedFx.length >= 3
  ? (meanEase(finishedFx, 3, 'attacking_difficulty') ?? null)
  : null
```
This is already what happens; the real fix is to either validate `attacking_difficulty` values before building `finishedFx`, or document that `past_ease_3gw` can be `null` even when `finishedFx.length >= 3`, so callers are not surprised. The swing calculation already null-guards, so functional impact is limited to silent null propagation.

---

### WR-04: `_cs_prob_1gw_for_fixtures` uses a fragile fallback for `defensive_difficulty` that silently inverts the field

**File:** `pipeline/merge.py:170`

**Issue:** Inside `_cs_prob_1gw_for_fixtures`, when a fixture dict lacks `defensive_difficulty`, the code falls back to `1.0 - fix.get('attacking_difficulty', 0.5)`:

```python
dd = fix.get('defensive_difficulty', 1.0 - fix.get('attacking_difficulty', 0.5))
```

`defensive_difficulty` and `attacking_difficulty` measure **different axes**:
- `attacking_difficulty` = difficulty for the player's **team** to attack (opponent defends well).
- `defensive_difficulty` = how often the **opponent** scores (threat to the player's CS).

Inverting `attacking_difficulty` does not produce a valid proxy for `defensive_difficulty`. An opponent who is hard to score against (high `attacking_difficulty` → 1.0) is inverted to `0.0` `defensive_difficulty`, implying the opponent never scores — the exact opposite of what the formula in `_cs_prob` needs. This fallback is also present in `_xpts_ngw` (line 277) and `_compute_xpts_sigma` (line 326) with the same incorrect inversion.

In practice all fixture dicts written by `merge_players` always include `defensive_difficulty`, so this path is only exercised when `_cs_prob_1gw_for_fixtures` is called from a test or external caller that does not set the field. The test fixture helper (`test_merge_cs_prob.py:34`) correctly provides `defensive_difficulty` directly, so tests do not catch the broken fallback. The same bad default is present in the other two functions.

**Fix:** Replace the inverted fallback with a neutral default (`0.5`) that signals "unknown difficulty" rather than producing a logically incorrect value derived from the wrong axis:
```python
dd = fix.get('defensive_difficulty', 0.5)
```
Apply the same change in `_xpts_ngw` (line 277) and `_compute_xpts_sigma` (line 326).

---

### WR-05: Test file contains stale comment claiming the function does not yet exist ("RED phase")

**File:** `pipeline/tests/test_merge_cs_prob.py:11`

**Issue:** The module docstring says:

```
RED phase: these tests fail until Task 2 adds _cs_prob_1gw_for_fixtures to merge.py.
```

The function was added in Task 2 and is present in `merge.py`. The stale RED-phase comment misrepresents the state of the code to any future reader and will cause confusion when diagnosing test failures — a reader may incorrectly attribute a real regression to "the function not being implemented yet." The same stale claim appears in the `test_symbol_exists` assertion message (line 30).

**Fix:** Update the module docstring and assertion message to reflect the GREEN state:
```python
"""Pytest unit tests for _cs_prob_1gw_for_fixtures (Phase 47 CS-01, CS-02).
...
"""
# and
assert _cs_prob_1gw_for_fixtures is not None, (
    "_cs_prob_1gw_for_fixtures not found in merge.py"
)
```

---

## Info

### IN-01: Test imports `_cs_prob_1gw_for_fixtures` via `getattr` / `__import__` rather than a direct import

**File:** `pipeline/tests/test_merge_cs_prob.py:20–24`

**Issue:** The function is imported via a dynamic `getattr(__import__(...), ...)` idiom, which was designed to allow the test file to be collected without an `ImportError` during the RED phase. Now that the function exists, this roundabout import obscures the dependency, suppresses IDE analysis, and makes it harder to see what is under test.

**Fix:** Replace with a direct import:
```python
from merge import _cs_prob, _cs_prob_1gw_for_fixtures
```

---

### IN-02: Magic number `0.20` (`SWING_THRESHOLD`) is defined in `FixtureSwingDetector.tsx` but the same threshold semantics appear undocumented in `club-form-swing.test.ts`

**File:** `src/components/club-form/FixtureSwingDetector.tsx:21` / `src/lib/__tests__/club-form-swing.test.ts:91`

**Issue:** The threshold `0.20` is defined as a named constant `SWING_THRESHOLD` in `FixtureSwingDetector.tsx` (line 21) with a comment, but the test file at line 91 asserts `swing_1gw > 0.2` and at line 132 asserts `swing_1gw <= -0.2` with bare literals. If the constant is ever changed, the tests would not automatically update to reflect the new threshold, and tests would silently test a different value than the UI uses.

**Fix:** Export `SWING_THRESHOLD` from a shared location (or from `FixtureSwingDetector.tsx`/`club-form.ts`) and import it in the test to keep the value co-located. Alternatively, document explicitly in the test that `0.2` mirrors `SWING_THRESHOLD`.

---

_Reviewed: 2026-05-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
