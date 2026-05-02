---
phase: 054-price-change-predictor
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pipeline/price_changes.py
  - pipeline/tests/test_price_changes.py
  - pipeline/run.py
  - src/app/api/price-changes/route.ts
  - src/lib/hooks/usePriceChanges.ts
  - src/lib/types.ts
  - src/components/price-changes/PriceChangePanel.tsx
  - src/components/price-changes/PriceChangePanel.test.tsx
  - src/app/page.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase ships the price change predictor end-to-end: Python pipeline module (`price_changes.py`), API route, React hook, and UI panel. The architecture is clean and consistent with prior phases (bonus.py shape). One blocker exists: the module assumes `bootstrap['events']` is a dict with a `'current'` key, but the real FPL bootstrap returns `events` as a list — this raises `AttributeError` on every production pipeline run and silently falls back to a stale cache. The test suite uses a synthetic dict-shaped bootstrap that masks this entirely. Four warnings cover a non-OK blob response not being checked, indistinguishable bar colours in the UI, a missing GW-reset test, and a missing non-OK response guard in the hook. Three info items cover test coverage gaps.

## Critical Issues

### CR-01: `bootstrap['events']` is a list in production; code treats it as a dict — raises `AttributeError` every pipeline run

**File:** `pipeline/price_changes.py:64-65`

**Issue:** The real FPL bootstrap-static API returns `events` as a **list** of event objects (confirmed by `pipeline/merge.py:656-664` and all test fixtures in `test_merge.py`). `price_changes.py` calls `events.get('current', {})` on line 65, which fails with `AttributeError: 'list' object has no attribute 'get'` whenever `bootstrap['events']` is a non-empty list (truthy, so the `or {}` guard on line 64 does not replace it with a dict).

The `or {}` guard on line 64 only fires when `bootstrap.get('events', {})` returns a falsy value (empty list `[]`, `None`, or absent). A non-empty list is truthy and passes through unchanged, then crashes on `.get()`.

Consequence: `compute_price_change_predictions` raises before writing any predictions. `run.py`'s outer `except Exception` block (line 299) catches this, writes a stale `last_updated.json`, and exits with code 1. `price_changes.json` is never written or updated.

The unit tests pass because `_bootstrap()` in `test_price_changes.py` constructs `{'events': {'current': {'id': ...}}}` — a dict shape — which does not match the real API.

**Fix:** Replace the dict-access pattern with the list-iteration pattern used by `merge.py`:

```python
# Replace lines 63-69 in price_changes.py:

# current_gw: iterate the events list to find the current event (matches real API shape)
events = bootstrap.get('events', []) or []
current_gw = 0
for event in events:
    if event.get('is_current'):
        current_gw = event.get('id', 0) or 0
        break
if current_gw == 0:
    # Fallback: last finished event
    finished = [e for e in events if e.get('finished')]
    if finished:
        current_gw = finished[-1].get('id', 0) or 0
```

Also update `test_price_changes.py`'s `_bootstrap()` helper to use the real list shape:

```python
def _bootstrap(elements=None, current_gw_id=1, teams=None):
    events = [
        {'id': current_gw_id, 'is_current': True, 'finished': False}
    ] if current_gw_id else []
    return {
        'elements': elements or [],
        'events': events,
        'teams': teams or [{'id': 1, 'short_name': 'ARS'}],
    }
```

## Warnings

### WR-01: Blob URL fetch response not checked for non-OK status before consuming body

**File:** `src/app/api/price-changes/route.ts:16-17`

**Issue:** When running in blob mode, the code fetches the blob download URL with `fetch(blobs[0].url)` but never checks `res.ok` before calling `res.text()`. If the Vercel Blob CDN returns a 403, 404, or 5xx for the download URL, `res.text()` returns an HTML error page. That error HTML is then returned to the client with `Content-Type: application/json` and status 200, silently breaking any consumer that tries to parse it as JSON.

```typescript
// Current (lines 16-17):
const res = await fetch(blobs[0].url)
data = await res.text()

// Fix:
const res = await fetch(blobs[0].url)
if (!res.ok) {
  return Response.json(
    { error: `Blob fetch failed: ${res.status} ${res.statusText}` },
    { status: 502 }
  )
}
data = await res.text()
```

### WR-02: Progress bar colours are indistinguishable between rise and fall predictions

**File:** `src/components/price-changes/PriceChangePanel.tsx:103`

**Issue:** `barColor` is `'bg-rose-500'` for rises and `'bg-red-500'` for falls. Both are red-family colours that are visually nearly identical. A user cannot tell at a glance whether the bar represents a rise or fall based on colour alone — the label is the only distinguishing factor. The colour choice is also counter-intuitive (green = price going up is conventional in financial contexts).

```typescript
// Current (line 103):
const barColor = prediction.direction === 'rise' ? 'bg-rose-500' : 'bg-red-500'

// Fix — use green for rises, red for falls:
const barColor = prediction.direction === 'rise' ? 'bg-emerald-500' : 'bg-red-500'
```

### WR-03: No test covers the GW-reset boundary (cost_change_event != 0 resets cumulative_net)

**File:** `pipeline/tests/test_price_changes.py`

**Issue:** The GW-reset boundary at `price_changes.py:116` — where `cumulative_net` is wiped and restarted when `cost_change_event != 0` — is the most important correctness invariant in the module: it prevents carry-over from before a price change from inflating or inverting the next prediction cycle. No test exercises this path. A regression here would produce wrong direction signals silently.

**Fix:** Add a test:

```python
def test_gw_reset_on_cost_change_event():
    """When cost_change_event != 0, cumulative_net must reset to daily_delta only."""
    elem = _element(
        player_id=1,
        transfers_in=500,
        transfers_out=0,
        ownership='10.0',
        now_cost=81,   # price has risen
        cost_change_event=1,  # event-level change != 0
    )
    prev_snapshot = {
        '1': _snapshot_entry(cumulative_net=900, last_now_cost=80)
    }
    bs = _bootstrap(elements=[elem])
    payload, current_snapshot = compute_price_change_predictions(bs, prev_snapshot)
    # cumulative_net must be 500 (daily_delta only), not 900 + 500 = 1400
    assert current_snapshot['1']['cumulative_net'] == 500
    assert current_snapshot['1']['velocity_history'] == [500]
```

### WR-04: `usePriceChanges` hook does not validate the response shape before returning it

**File:** `src/lib/hooks/usePriceChanges.ts:8-11`

**Issue:** `res.json()` is returned directly and typed as `PriceChanges`. If the API returns a well-formed JSON error body (`{ "error": "..." }`) with status 200 (which cannot happen with the current route.ts, but could after a pipeline write of partial data), or if `predictions` is missing or null, `PriceChangePanel` will crash at `data.predictions.length === 0` with an uncaught runtime error. The hook only checks `res.ok` before throwing.

This is consistent with patterns across the codebase (other hooks do not validate), so this is a WARNING rather than a BLOCKER, but the `data.predictions` access in `PriceChangePanel:49` has no null guard.

**Fix:** Add a null-safety guard in the panel, or validate in the hook:

```typescript
// In PriceChangePanel.tsx, line 49 — guard predictions:
if (!data || !data.predictions || data.predictions.length === 0) {
```

## Info

### IN-01: `test_empty_bootstrap` uses a dict-shaped events value inconsistently

**File:** `pipeline/tests/test_price_changes.py:63`

**Issue:** `test_empty_bootstrap` constructs `{'events': {'current': None}, ...}` directly (not via the `_bootstrap()` helper), which also uses the non-real dict shape. Once CR-01 is fixed with a list-shaped events, this inline dict will also break the test (or hide that the fix was applied correctly if the test is not updated).

**Fix:** Update to use the fixed helper or an empty list: `'events': []`.

### IN-02: No test covers the `stable` prediction emitted for a returning player with zero net

**File:** `pipeline/tests/test_price_changes.py`

**Issue:** The omit-on-cold-start guard at `price_changes.py:157` reads `if direction == 'stable' and cumulative_net == 0 and not prev_player`. A player with `prev_player` truthy but `cumulative_net=0` (e.g., equal in/out transfers) will be emitted as a `stable` prediction. This path is untested; an off-by-one in the guard condition would cause either spurious stable rows or missing rows.

**Fix:** Add a test asserting that a player with a prior snapshot entry and `cumulative_net=0` appears in `predictions` with `direction='stable'`.

### IN-03: `formatEta` rounds non-integer ETA with `Math.round` which can display "0 days" instead of "Tonight" for very small positive values below 0.5

**File:** `src/components/price-changes/PriceChangePanel.tsx:24-28`

**Issue:** `formatEta` only returns `'Tonight'` for `eta <= 0`. For `eta = 0.4`, it returns `"0 days"` (since `Math.round(0.4) === 0`). The string "0 days" is grammatically awkward and semantically indistinguishable from "Tonight" to the user.

**Fix:**

```typescript
function formatEta(eta: number): string {
  if (eta <= 0) return 'Tonight'
  const days = Math.round(eta)
  if (days === 0) return 'Tonight'  // < 0.5 days rounds to 0
  return `${days} day${days === 1 ? '' : 's'}`
}
```

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
