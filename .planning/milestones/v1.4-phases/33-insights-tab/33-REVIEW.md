---
phase: 33-insights-tab
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pipeline/insights.py
  - pipeline/run.py
  - src/lib/types.ts
  - src/app/api/insights/route.ts
  - src/lib/hooks/useInsights.ts
  - src/components/insights/InsightsTab.tsx
  - src/components/insights/InsightsTab.test.tsx
  - src/app/page.tsx
  - src/components/nav/MobileNav.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 33 adds a flat `insights.json` pipeline step, a `/api/insights` route, a `useInsights` hook, and an `InsightsTab` component. The tab wiring across `page.tsx` and `MobileNav.tsx` is type-safe and consistent. The React component handles all UI states correctly. The main issues are: a silent swallowing of a non-OK Blob CDN response in the route handler (corrupt data delivered as 200), a double-count logic error in the top-6 clean-sheet calculation that inflates confidence values, and an incorrect `sample_total` semantic in the captaincy xPts insight (float rounded to int then compared against a fixture-count gate). Three warnings concern an unvalidated Blob fetch response type, a tooltip precision inconsistency the test masks, and a dead parameter in `run.py`. Two info items cover the tooltip copy wording and a leftover stub describe-block in the test file.

---

## Critical Issues

### CR-01: Blob fetch response not checked — corrupt data silently forwarded as 200

**File:** `src/app/api/insights/route.ts:16-17`
**Issue:** After fetching the Blob CDN URL the code calls `res.text()` without checking `res.ok`. If the CDN returns a 403, 500, or rate-limit HTML page, `data` will contain that error body. The outer `try/catch` will not fire because no exception is thrown, so the handler returns a `200 application/json` response whose body is not valid JSON. The client will receive a parse error or garbage data with no useful status code.
**Fix:**
```typescript
const res = await fetch(blobs[0].url)
if (!res.ok) {
  return Response.json(
    { error: `Blob fetch failed: ${res.status}` },
    { status: 502 }
  )
}
data = await res.text()
```

---

### CR-02: Top-6 clean-sheet count double-counts when both teams are top-6 (logic error)

**File:** `pipeline/insights.py:129-156`
**Issue:** `top6_fixtures` includes any fixture where *either* team is in `top6_ids` (line 131). The counting loop uses `if … elif` (lines 142-145), so in a top-6 vs top-6 fixture where the score is 0-0 (both teams kept a clean sheet), only the *home* team's CS is counted — the away team's CS is silently discarded by the `elif`. Meanwhile the fixture still contributes a single entry to `top6_total`. This means: if there are N top-6 vs top-6 goalless draws, the numerator is under-counted by N while the denominator is correct, deflating the confidence percentage. Separately, a top-6 vs top-6 fixture where, say, the score is 2-0 (away top-6 team conceded, home top-6 team kept a CS) correctly adds 1 — but when both teams concede in a top-6 vs top-6 fixture, 0 is added for the correct result. The `elif` is the core bug; both branches need to be evaluated independently for top-6 vs top-6 games.
**Fix:**
```python
if h in top6_ids and a_score == 0:
    top6_cs += 1
if a in top6_ids and h_score == 0:   # independent — not elif
    top6_cs += 1
# sample_total must also account for the extra "slot"
# when both teams are top-6 — or alternatively count
# team-appearances rather than fixture-appearances:
top6_appearances = sum(
    (1 if h in top6_ids else 0) + (1 if a in top6_ids else 0)
    for f in top6_fixtures
    for h, a in [(f.get('team_h'), f.get('team_a'))]
)
# use top6_appearances as sample_total and confidence denominator
```

---

### CR-03: `cap_top3_xpts_share` — sample gate uses rounded xPts sum, not a count; gate can pass with fewer than 10 available players

**File:** `pipeline/insights.py:386-388`
**Issue:** `sample_total = round(sum_all_xpts)` converts the *sum of floating-point expected points* into an integer and then tests `if sample_total >= MIN_SAMPLE_TOTAL` (line 388). This is semantically wrong: the MIN_SAMPLE_TOTAL gate (10) is described everywhere as "minimum data points / observations" (D-03). If each of the 8 available players has xPts_1gw = 1.5, `sum_all_xpts = 12.0`, `sample_total = 12`, the gate passes and an insight is emitted for only 8 players. Conversely if players have very low xPts (e.g., 0.5 each), the gate may wrongly reject even 20 valid players. The statement text `({sample_n}/{sample_total})` then displays nonsensical numbers like `"5/38"` that a user reads as "5 out of 38 fixtures", which is false.
**Fix:** Use player counts for the gate and `sample_total`, not the xPts sums:
```python
sample_total = len(available)       # number of available players
sample_n = len(top3)                # always 3 when len(available) >= 3
if sample_total >= MIN_SAMPLE_TOTAL:
    confidence_pct = round(sum_top3_xpts / sum_all_xpts * 100, 1)
    out.append({
        ...
        'statement': (
            f'The top 3 captaincy options account for {confidence_pct}% of '
            f'available xPts this GW (from {sample_total} eligible players).'
        ),
        'sample_n': 3,
        'sample_total': int(sample_total),
    })
```

---

## Warnings

### WR-01: Blob response content-type not validated — JSON parse failure not caught at route boundary

**File:** `src/app/api/insights/route.ts:16-29`
**Issue:** Even after adding the `res.ok` check (CR-01), the code passes `data` (a raw string) directly into the `Response` body without attempting to validate it as JSON. A partial/truncated write to Blob storage would cause `res.json()` in the hook to throw an unhandled rejection that surfaces to the user as the generic "Failed to load insights" error — acceptable — but the route returns `200` with invalid JSON rather than `500`. The `Content-Type: application/json` header makes this worse since it asserts validity.
**Fix:** Parse and re-serialize inside the route so an invalid payload is caught and mapped to a 500:
```typescript
const parsed = JSON.parse(data)  // throws SyntaxError on bad JSON
return Response.json(parsed, {
  status: 200,
  headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
})
```
The `catch {}` block at line 30 already handles the thrown `SyntaxError`.

---

### WR-02: Tooltip precision inconsistency — `confidence_pct` rendered without decimal when it is a whole number

**File:** `src/components/insights/InsightsTab.tsx:32`
**Issue:** The tooltip template is:
```
`True in ${insight.confidence_pct}% of fixtures — …`
```
JavaScript template literals stringify `75.0` as `"75"`, not `"75.0"`. The pipeline rounds to 1 d.p. (e.g., `75.0`, `32.5`). For whole-number percentages this drops the decimal, producing `"True in 75% …"`. The test at `InsightsTab.test.tsx:138` expects exactly `'True in 75% of fixtures — 100/308 matches'` and passes only because `75.0` in the JS fixture is also serialised as `"75"`. This means the test does not catch cases where the pipeline emits `75.0` as a JSON number and the UI renders it as `"75"` vs. `"75.0"` — the rendered output is not controlled. Not a crash, but the precision contract (1 d.p. everywhere) is silently broken for whole numbers, making the UI inconsistent.
**Fix:** Use `toFixed(1)` to enforce 1 d.p. display consistently:
```typescript
const tooltip = `True in ${insight.confidence_pct.toFixed(1)}% of fixtures — ${insight.sample_n}/${insight.sample_total} matches`
```
Update the test expectation to `'True in 75.0% of fixtures — 100/308 matches'`.

---

### WR-03: `_taker_entry` accepts unused `role_key` parameter

**File:** `pipeline/run.py:65`
**Issue:** The inner function `_taker_entry(role_key, curr_id, prev_id)` accepts `role_key` as its first argument but never uses it. All three call sites pass string literals `'penalty'`, `'fk'`, `'corner'` (lines 80-82) which are silently discarded. The parameter misleads readers into thinking role-specific logic exists inside the function. This is a code quality defect and will trigger linter warnings (unused parameter).
**Fix:** Remove the dead parameter:
```python
def _taker_entry(curr_id, prev_id):
    ...

'penalty_taker': _taker_entry(curr_roles.get('penalty'), prev_roles.get('penalty')),
'fk_taker':      _taker_entry(curr_roles.get('fk'),      prev_roles.get('fk')),
'corner_taker':  _taker_entry(curr_roles.get('corner'),  prev_roles.get('corner')),
```

---

### WR-04: `InsightsTab` section element lacks `aria-labelledby` — screen-reader landmark is not labelled

**File:** `src/components/insights/InsightsTab.tsx:90`
**Issue:** The outer `<section>` on line 90 has no `aria-label` or `aria-labelledby` attribute. ARIA landmark rules require sections (which are exposed as `region` landmarks) to have an accessible name. Each category also renders an `<h2>` but the outer section is not associated with any heading. Screen readers will announce an unnamed region, and navigation by landmark will not work correctly. The empty state at line 67 has the same problem.
**Fix:** Add `aria-labelledby` pointing to the first visible heading, or add an `aria-label` when the section has a fixed purpose:
```tsx
<section className="mt-6 space-y-6" aria-label="Season pattern insights">
```
For the empty-state section, add `aria-label="Insights not available"` or associate it with the rendered `<h2>`.

---

## Info

### IN-01: Test file retains Wave 0 stub describe-block

**File:** `src/components/insights/InsightsTab.test.tsx:204-208`
**Issue:** The file has a second `describe` block at lines 204-208 ("Wave 0 stub") with a single vacuous `expect(true).toBe(true)` test. The plan comments at the top of the file say "Wave 0 stub — replace with real tests after implementation". The real tests were implemented in Wave 2, but the stub block was never removed. It adds noise to the test report and counts as a passing test with zero signal.
**Fix:** Delete lines 204-208 entirely.

---

### IN-02: `_get_cache_dir()` in `run.py` returns a relative path

**File:** `pipeline/run.py:22-24`
**Issue:** `_get_cache_dir()` returns the string `'pipeline/cache'` (relative). This is used to construct `sp_snapshot_path` and `last_updated_path`. The function is only called from `run()`, which is only invoked from `__main__` (or tests that call `run()`). If the working directory is not the project root the paths silently resolve to wrong locations. The pattern is inconsistent with the `id_map_path` construction at line 120 which uses `os.path.abspath(__file__)`. Not a crash risk in normal CI/CD operation, but fragile.
**Fix:** Use an absolute path derived from `__file__`:
```python
def _get_cache_dir() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
