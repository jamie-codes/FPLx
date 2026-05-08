---
phase: 080-gw-specific-intelligence
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - pipeline/european_cup_dates.py
  - pipeline/gw_intel.py
  - pipeline/merge.py
  - pipeline/run.py
  - pipeline/tests/test_gw_intel.py
  - src/app/api/gw-intel/route.ts
  - src/lib/hooks/useGWIntel.ts
  - src/lib/types.ts
  - src/components/shared/RotationRiskBadge.tsx
  - src/components/shared/RotationRiskBadge.test.tsx
  - src/components/insights/InsightsTab.tsx
  - src/components/insights/InsightsTab.test.tsx
  - src/components/set-pieces/SetPieceTakerPanel.tsx
  - src/components/transfers/OpportunityCostTable.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: fixed
---

# Phase 080: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** fixed

## Summary

Phase 80 introduces GW-specific intelligence cards (rotation risk, DGW/BGW detection, fixture run cards, table stakes) surfaced via a new `compute_gw_intel` pipeline function and a `GWIntelSection` in `InsightsTab`. The core data model, type definitions, and component structure are sound. One critical bug was found: the `DecisionSummary` fallback condition is inverted, causing it to silently show fewer than 3 items when only 1–2 insights have entity lists, and its own test asserts a state that the current code cannot produce. Additionally, the API route returns 500 (not 404) for a missing local cache file, there is an unused import in `gw_intel.py`, and `datetime.utcnow()` is deprecated in Python 3.12+.

## Critical Issues

### CR-01: DecisionSummary fallback condition is wrong — test expects 3 items but code returns 2

**File:** `src/components/insights/InsightsTab.tsx:157-160`

**Issue:** The fallback guard reads `withEntities.length > 0` — meaning the fallback to "top-3 by confidence overall" is only triggered when **zero** insights have entity lists. If 1 or 2 insights have entities, the component silently shows only those 1–2 items, never filling the summary to 3. The spec comment immediately above says "if fewer than 3 have entity lists, fall back to top-3 by confidence overall", which means the condition should be `< DECISION_TOP_N`, not `=== 0`.

The companion test (`renders top 3 insights by confidence_pct with action_hint and chips`) relies on all 3 action hints being rendered. With FIXTURE, `withEntities` contains FIXTURE[5] (confidence 72, has player_ids) and FIXTURE[1] (confidence 58, has team_ids) — 2 items, both > 0, so the fallback never fires. FIXTURE[0] (confidence 75, no entities) is excluded. The test assertion `expect(text).toContain('Target home defenders in good runs')` will fail because that action hint only appears if the fallback runs. The test is asserting a behavior the code cannot deliver.

**Fix:**
```typescript
const top3 =
  withEntities.length >= DECISION_TOP_N
    ? withEntities
    : [...insights].sort((a, b) => b.confidence_pct - a.confidence_pct).slice(0, DECISION_TOP_N)
```

## Warnings

### WR-01: API route returns 500 instead of 404 when local cache file is absent

**File:** `src/app/api/gw-intel/route.ts:34-36`

**Issue:** When running in local mode and `pipeline/cache/gw_intel.json` does not exist (e.g., first pipeline run has not completed), `readFile` throws `ENOENT`. The catch block swallows all errors and returns `{ error: 'Failed to load GW insights', status: 500 }`. For the Blob path, the code correctly returns 404 when no blob is found (`!blobs.length`). The inconsistency means local-mode callers get a 500 where 404 is semantically more accurate (resource not yet created, not a server fault). This also impedes `useGWIntel` from distinguishing "not yet available" from a genuine pipeline crash.

**Fix:**
```typescript
} catch (err) {
  const isNotFound =
    err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
  if (isNotFound) {
    return Response.json({ error: 'GW intel not available' }, { status: 404 })
  }
  return Response.json({ error: 'Failed to load GW insights' }, { status: 500 })
}
```

### WR-02: Unused import `_compute_xpts_fixture` in gw_intel.py

**File:** `pipeline/gw_intel.py:12`

**Issue:** `from merge import _xpts_per_gw, _compute_xpts_fixture` imports `_compute_xpts_fixture` but it is never called anywhere in `gw_intel.py`. Only `_xpts_per_gw` is used (in `_build_fixture_run_card` at line 167). The unused import adds cognitive overhead and risks confusion about whether `gw_intel.py` is intended to call the lower-level fixture function directly.

**Fix:**
```python
from merge import _xpts_per_gw
```

### WR-03: `datetime.utcnow()` is deprecated in Python 3.12+

**File:** `pipeline/gw_intel.py:312`

**Issue:** `datetime.utcnow()` was deprecated in Python 3.12 (PEP 615) and emits a `DeprecationWarning` in Python 3.12+. The rest of the pipeline (`run.py:357`, `merge.py:_compute_captain_picks`) uses `datetime.now(timezone.utc)` which is the correct, timezone-aware replacement. `gw_intel.py` is inconsistent and will produce a warning in modern Python environments.

**Fix:**
```python
from datetime import datetime, timezone
# ...
'generated_at': datetime.now(timezone.utc).isoformat() + 'Z',
```

Note: the `isoformat()` on a timezone-aware datetime already includes `+00:00`, so the appended `'Z'` produces an invalid suffix like `2026-05-08T12:00:00+00:00Z`. Use `datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')` or strip the offset before appending, mirroring how the pipeline writes it in other places.

### WR-04: `_detect_dgw_bgw` uses `defaultdict(int)` but never increments — silent correctness fragility

**File:** `pipeline/gw_intel.py:114,122`

**Issue:** `team_counts` is declared as `defaultdict(int)` (implying accumulation via `+=`) but at line 122 it is assigned directly: `team_counts[tid] = count`. The `defaultdict` behavior (auto-initializing missing keys to 0) is never triggered because the first access is an assignment, not a read. One future developer could add `team_counts[tid] += count` believing the defaultdict accumulates, leading to multi-player-per-team overcounting. The type should be `dict[int, int]` to match actual usage.

**Fix:**
```python
team_counts: dict[int, int] = {}
```

## Info

### IN-01: `gw_label` ternary logic in `_build_fixture_run_card` is unnecessarily opaque

**File:** `pipeline/gw_intel.py:200-202`

**Issue:** The expression `f"GW{gw_numbers[0]}" if len(gw_numbers) == 1 else (f"GW{gw_numbers[0]}–{gw_numbers[-1]}" if gw_numbers else '')` nests two ternaries. The inner `if gw_numbers` guard is dead code when reached via the `else` branch (at that point `len >= 2`, so `gw_numbers` is always truthy). The empty-string fallback for `gw_numbers == []` is handled by the outer condition never evaluating the inner ternary at all when `len == 1`, but zero-length reaches the `else` branch, where the inner guard fires. The logic is correct but confusing to read and maintain.

**Fix (clarity, same behaviour):**
```python
if not gw_numbers:
    gw_label = ''
elif len(gw_numbers) == 1:
    gw_label = f"GW{gw_numbers[0]}"
else:
    gw_label = f"GW{gw_numbers[0]}–{gw_numbers[-1]}"
```

### IN-02: `XptsTrajectoryBar` accesses `is_dgw[i]` without a bounds guard

**File:** `src/components/insights/InsightsTab.tsx:256`

**Issue:** `is_dgw[i]` is accessed inside a `.map()` over `gw_xpts`. If `is_dgw` and `gw_xpts` are different lengths (possible if the pipeline emits a malformed card), `is_dgw[i]` evaluates to `undefined`. JavaScript treats `undefined` as falsy so `dgwSuffix` becomes `''` — no crash, but the DGW marker would be silently suppressed. By contrast, `gw_numbers[i] ?? '?'` on line 262 has an explicit fallback. The inconsistency is a maintenance gap.

**Fix:**
```typescript
const dgwSuffix = is_dgw[i] ? '†' : ''
// becomes:
const dgwSuffix = (is_dgw[i] ?? false) ? '†' : ''
```

### IN-03: `european_cup_dates.py` is an empty dict with no runtime validation or expiry signal

**File:** `pipeline/european_cup_dates.py:14`

**Issue:** `EUROPEAN_CUP_DATES: dict[int, list[str]] = {}` ships as an empty dict. The module comment says "Update each season" but there is no assertion, logging, or runtime warning that informs operators the dict is empty when `compute_gw_intel` is called. All players will have `rotation_risk = False` silently. Any rotation-risk cards will never be emitted. A debug-level log at startup or inside `_apply_rotation_risk` when `european_cup_dates` is empty would prevent silent misconfiguration.

**Fix:** Add a warning log in `run.py` or `_apply_rotation_risk`:
```python
if not european_cup_dates:
    print("[gw_intel] WARNING: EUROPEAN_CUP_DATES is empty — rotation_risk will be False for all teams.")
```

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
