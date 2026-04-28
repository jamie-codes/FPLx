---
phase: 31-captaincy-ceiling
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - tests/lib/captain-picks.test.ts
  - pipeline/merge.py
  - pipeline/run.py
  - src/app/api/captain-picks/route.ts
  - src/lib/hooks/useCaptainPicks.ts
  - src/components/captaincy/CaptainPicksPanel.tsx
  - src/lib/types.ts
  - src/app/page.tsx
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 31 ships the captaincy ceiling feature: a pipeline computation (`_compute_captain_picks` in `merge.py`), a new API route (`/api/captain-picks`), a React hook (`useCaptainPicks`), and a UI component (`CaptainPicksPanel`). The pipeline logic is largely sound. Two blockers were found: a prop-signature mismatch between the component and its tests (causing TypeScript errors and potentially broken tests), and a missing HTTP-status guard on the Blob CDN fetch in the route handler that will silently serve error bodies as valid JSON to clients. Three warnings cover an overly long client-side cache lifetime, a `starts == 0` filter that drops sub-only players from the summary pipeline, and a dead parameter in a nested function. Three info items flag dead code, a test-quality gap, and a minor naming inconsistency.

---

## Critical Issues

### CR-01: `CaptainPicksPanel` accepts no props but tests call it with `{}`

**File:** `src/components/captaincy/CaptainPicksPanel.tsx:51`, `tests/lib/captain-picks.test.ts:158`

**Issue:** The component is declared as `export function CaptainPicksPanel()` — a zero-parameter function. The test file calls it as `render(CaptainPicksPanel({}))`, passing an empty object as the first argument. TypeScript strict mode will reject this as a type error (`Expected 0 arguments, but got 1`). Beyond the type error, calling a hook-bearing React component as a plain function (`Component({})` instead of `<Component />`) bypasses React's reconciler and can break hook semantics across React versions. The tests may silently pass in the current environment yet break on a framework or tooling upgrade.

**Fix:**

In the component, declare an explicit (but empty) props interface so TypeScript accepts the call site:
```tsx
// CaptainPicksPanel.tsx
export function CaptainPicksPanel(_props: Record<string, never> = {}) {
```
Or add an explicit empty props type:
```tsx
export function CaptainPicksPanel({}: { [k: string]: never } = {}) {
```

In the tests, use JSX instead of a direct function call to stay within React's reconciler:
```tsx
// captain-picks.test.ts
const { container } = render(<CaptainPicksPanel />)
```
This requires adding `@vitest-environment jsdom` to honour the environment directive already declared at the top of the file, and ensuring the test file extension is `.tsx` (or the JSX transform is enabled for `.ts`). All five `render(CaptainPicksPanel({}))` call sites on lines 158, 175, 189, 199, 211 need updating.

---

### CR-02: Blob CDN fetch result not checked for HTTP errors in `route.ts`

**File:** `src/app/api/captain-picks/route.ts:15-17`

**Issue:** When `USE_BLOB` is true, the route fetches the blob URL and reads the body regardless of the HTTP response status:
```ts
const res = await fetch(blobs[0].url)
data = await res.text()
```
If the Blob CDN returns a `403 Forbidden`, `503 Service Unavailable`, or any other error, `res.text()` will return the error body (HTML or JSON error payload). This string then gets returned as a `200 application/json` response. The client calls `res.json()` in `useCaptainPicks`, which will either fail to parse (throwing an unhandled promise rejection in the hook) or parse a malformed object that silently produces `undefined` data — neither failure mode is surfaced as an error to the user.

**Fix:**
```ts
if (USE_BLOB) {
  const { blobs } = await list({ prefix: 'captain_picks.json', limit: 1 })
  if (!blobs.length) {
    return Response.json({ error: 'Captain picks not available' }, { status: 404 })
  }
  const res = await fetch(blobs[0].url)
  if (!res.ok) {
    return Response.json(
      { error: `Blob fetch failed: ${res.status}` },
      { status: 502 }
    )
  }
  data = await res.text()
}
```

---

## Warnings

### WR-01: Client-side `staleTime` (6 h) greatly exceeds server `Cache-Control` (1 h)

**File:** `src/lib/hooks/useCaptainPicks.ts:12`, `src/app/api/captain-picks/route.ts:27`

**Issue:** The API route sets `Cache-Control: public, s-maxage=3600` (1-hour server cache). The hook sets `staleTime: 6 * 60 * 60 * 1000` (6 hours). Once the hook has fetched data, it will not re-fetch for six hours even if the server has refreshed the cache. A user who loaded the page right after a stale pipeline response would be stuck with that stale response for up to six additional hours with no way to recover short of a hard reload. The two values should be aligned.

**Fix:** Match `staleTime` to the server cache lifetime (or slightly below it):
```ts
staleTime: 60 * 60 * 1000, // 1 hour — matches s-maxage=3600
```

---

### WR-02: Players with `starts == 0` skipped from element-summary fetch, losing substitutes' historical points

**File:** `pipeline/run.py:128-129`

**Issue:** The summary-fetch loop skips every player whose `starts == 0`:
```python
if element.get('starts', 0) == 0:
    continue
```
This affects squad players who only came on as substitutes (starts=0, minutes>0). For those players `summaries[fpl_id]` is absent, so `pts_last3gw`, `pts_last5gw`, and the regression signal are all zeroed/omitted. A player with 90 min across three substitute appearances but 0 starts will show 0 historical points. This is particularly impactful for high-value bench options and form players who are being rotated into the squad as subs. It also means they are never evaluated for the regression signal, silently degrading recommendation quality.

**Fix:** Remove the starts-based skip or change the filter to exclude players with zero minutes (who genuinely have no history worth fetching):
```python
for element in bootstrap['elements']:
    if element.get('minutes', 0) == 0:
        continue  # truly no data — saves an API call
```

---

### WR-03: Dead `role_key` parameter in `_taker_entry` nested function

**File:** `pipeline/run.py:64-73`

**Issue:** The nested function `_taker_entry(role_key, curr_id, prev_id)` accepts `role_key` as its first parameter but never uses it in the function body. Every call site passes a string literal (`'penalty'`, `'fk'`, `'corner'`) that is silently ignored. This is dead code that confuses readers into thinking the role key influences behaviour.

**Fix:** Remove the parameter from the signature and all call sites:
```python
def _taker_entry(curr_id, prev_id):
    nonlocal changes_count
    changed = curr_id != prev_id and not (curr_id is None and prev_id is None)
    ...

'penalty_taker': _taker_entry(curr_roles.get('penalty'), prev_roles.get('penalty')),
'fk_taker':      _taker_entry(curr_roles.get('fk'),      prev_roles.get('fk')),
'corner_taker':  _taker_entry(curr_roles.get('corner'),  prev_roles.get('corner')),
```

---

## Info

### IN-01: TOOLTIP copy hard-codes `< 25% ownership` but EO threshold can fall back to 35%

**File:** `src/components/captaincy/CaptainPicksPanel.tsx:8`

**Issue:** The tooltip string is:
```
'Highest 90th-percentile xPts among players with under 25% ownership.'
```
When the EO pick uses the 35% fallback threshold (`eo_threshold_used === 35.0` on the pick), the tooltip is factually incorrect. Users would see a pick with 30% ownership accompanied by a tooltip claiming the criterion is < 25%.

**Fix:** Make the tooltip dynamic, or broaden the copy to acknowledge the fallback:
```tsx
const eoThreshold = data?.eo_adjusted?.eo_threshold_used ?? 25
const eoTooltip = `Highest 90th-percentile xPts among players with under ${eoThreshold}% ownership. Reduces rank variance vs the template.`
```
Or use static copy that covers both cases: `'under ~25–35% ownership'`.

---

### IN-02: Wave 0 stub test is never removed

**File:** `tests/lib/captain-picks.test.ts:219-221`

**Issue:** The stub assertion `it('Wave 0 stub file created — replace with real tests after implementation', ...)` remains at the bottom of the test file after the Wave 2 component tests were filled in. It is dead test infrastructure and adds noise to the test report.

**Fix:** Delete lines 219-221:
```ts
it('Wave 0 stub file created — replace with real tests after implementation', () => {
  expect(true).toBe(true)
})
```

---

### IN-03: Integration-test sigma spot-check only verifies sign, not formula correctness

**File:** `tests/lib/captain-picks.test.ts:68-77`

**Issue:** The skipped test `'xPts_90th_1gw == round(xPts_1gw + 1.28 * sigma_1gw, 3)'` (CAP-03 D-05) recovers sigma as `(xPts_90th_1gw - xPts_1gw) / 1.28` and only checks `>= 0`. It does not verify that the formula `round(xPts_1gw + 1.28 * sigma, 3)` actually matches `xPts_90th_1gw` to 3 decimal places. The test name implies a formula verification but the assertion cannot detect if the pipeline used a wrong multiplier (e.g. 1.64 instead of 1.28) or omitted the rounding.

**Fix:** Replace the weak assertion with a round-trip check:
```ts
const recoveredSigma = (picks.ceiling.xPts_90th_1gw - picks.ceiling.xPts_1gw) / 1.28
expect(recoveredSigma).toBeGreaterThanOrEqual(0)
// Also verify the formula round-trip to 3dp
const recomputed = Math.round((picks.ceiling.xPts_1gw + 1.28 * recoveredSigma) * 1000) / 1000
expect(recomputed).toBeCloseTo(picks.ceiling.xPts_90th_1gw, 3)
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
