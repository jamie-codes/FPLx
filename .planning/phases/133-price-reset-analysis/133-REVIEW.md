---
phase: 133-price-reset-analysis
reviewed: 2026-05-22T10:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - pipeline/price_baseline.py
  - pipeline/tests/test_price_baseline.py
  - pipeline/run.py
  - src/lib/types.ts
  - src/app/api/price-reset/route.ts
  - src/app/api/price-reset/route.test.ts
  - src/lib/hooks/usePriceReset.ts
  - src/components/price-reset/PriceResetTab.tsx
  - src/components/price-reset/PriceResetTab.test.tsx
  - src/app/page.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 133: Code Review Report

**Reviewed:** 2026-05-22T10:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 133 delivers the price reset analysis feature: a Python pipeline step (`price_baseline.py`) that captures the season-start price snapshot once, a Next.js API route (`/api/price-reset`) that diffs the baseline against live bootstrap data, a React hook, and a display component. The overall architecture is sound and follows established project patterns (idempotent write-once, graceful degradation, Promise.all concurrency). However, two correctness bugs were found in the API route — one silently swallows non-ENOENT I/O errors from Vercel Blob and can expose network errors to the outer catch (returning HTTP 500 instead of graceful published:false), and one produces a wrong position_rank of 0 instead of never including the unranked player. Three additional warnings cover a safety gap in the idempotency guard, a missing type guard in the pipeline, and a test fixture asymmetry that could mask future regressions.

---

## Critical Issues

### CR-01: `readBlobOrLocal` swallows ENOENT but re-throws all other errors — Blob path has no ENOENT analog, breaking graceful degradation

**File:** `src/app/api/price-reset/route.ts:29-34`

**Issue:** The `catch` block in `readBlobOrLocal` only suppresses errors where `err.code === 'ENOENT'` — the filesystem signal for "file not found". In the Blob path, `@vercel/blob`'s `list()` never throws `ENOENT`; a missing blob returns an empty `blobs` array (already handled at line 21-22). However, if `fetch(blobs[0].url)` fails for a transient network reason, the `throw new Error(...)` at line 23 has no `code` property, so `isNotFound` is `false` and the error is re-thrown. The outer `Promise.all` at line 54 then propagates it past the per-file `.catch(() => null)` guard (which only applies to `mergedPlayersText`), causing the outermost `catch` at line 214 to return HTTP 500 instead of `published: false`.

The same path applies locally: any `readFile` error that is not ENOENT (e.g. permission denied, corrupted file) is re-thrown to the outer handler and surfaces as a 500, contrary to the stated design goal of "errors are swallowed to allow graceful degradation" (line 53 comment).

**Fix:**
```typescript
async function readBlobOrLocal(filename: string): Promise<string | null> {
  const useBlob = process.env.USE_BLOB?.toLowerCase() === 'true'
  try {
    if (useBlob) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) return null   // treat any non-2xx as "not available"
      return await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      return await readFile(cachePath, 'utf-8')
    }
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) return null
    // For Blob path: list() or fetch() threw unexpectedly — treat as absent
    // rather than propagating to 500. Baseline/bootstrap absence = published:false.
    return null
  }
}
```

Alternatively, limit the re-throw to only the `mergedPlayersText` call site (which already uses `.catch(() => null)`), and return `null` from `readBlobOrLocal` in all other error cases.

---

### CR-02: `position_rank` defaults to `0` when player is in `players` but absent from `positionRanks` — emits structurally invalid `ValueTargetRow`

**File:** `src/app/api/price-reset/route.ts:185`

**Issue:** At line 185, `positionRanks.get(player.player_id) ?? 0` returns `0` when the player ID is not in the rank lookup. The `positionRanks` map is built only from `mergedPlayers` entries that have a valid `xPts_1gw` (lines 161-171). A player who appears in `players` (delta != 0 in bootstrap) but has `xPts_1gw` absent or non-finite in `mergedPlayers` will pass the `mp` lookup at line 179 (they exist in `mergedById`), then be rejected at line 182 (`xPts` undefined/null/non-finite → `continue`). So the `?? 0` fallback is only reached for a player that _does_ have valid `xPts` in `mergedById` but somehow wasn't ranked — which shouldn't happen in practice, but if it did the resulting `position_rank: 0` violates the `ValueTargetRow` contract which describes it as "1-indexed rank". A rank of 0 would render as `#0 MID` in the UI, which is confusing and wrong.

The fix is to skip rather than emit a zero-ranked row:

**Fix:**
```typescript
const rank = positionRanks.get(player.player_id)
if (!rank) continue   // player not ranked — skip rather than emit position_rank: 0
valueTargets.push({
  ...player,
  xPts_1gw: xPts,
  position_median_xPts: positionMedian,
  position_rank: rank,
  position_label: ELEMENT_TYPE_LABEL[player.element_type],
})
```

---

## Warnings

### WR-01: `_blob_exists` false-on-exception breaks idempotency when Blob is misconfigured

**File:** `pipeline/price_baseline.py:32-41`

**Issue:** `_blob_exists` returns `False` on any exception (line 37: `return False`). The docstring justifies this as "proceed to write; the idempotency check is the guard." But if the Vercel Blob token is misconfigured or `vercel_blob.list()` throws an auth error on every call, `_blob_exists` returns `False` on every pipeline run, causing `capture_price_baseline` to attempt `save()` on every run. `save()` calls `upload_json()` which calls `vercel_blob.put(..., {'allowOverwrite': True, ...})` — meaning the baseline will be overwritten on every run whenever the list check fails but the put succeeds. This is the exact scenario the idempotency guard is designed to prevent (season-start price drift).

The issue is that different Blob operations may have different failure modes (list fails but put succeeds if the error is path/prefix-related). The comment "the idempotency check is the guard" is only true when `_blob_exists` is reliable.

**Fix:** Log the exception at a higher severity (e.g. `WARNING` or even `ERROR`), and consider returning `True` (pessimistic: assume exists, skip write) rather than `False` when the list call fails in production (USE_BLOB=true). This ensures a failing check never silently overwrites the baseline:
```python
if os.getenv('USE_BLOB', '').lower() == 'true':
    print(
        f"[price_baseline] _blob_exists check failed ({exc}); assuming EXISTS to protect baseline.",
        file=sys.stderr,
    )
    return True  # safe default: skip write if we can't confirm absence
print(
    f"[price_baseline] _blob_exists check failed ({exc}); assuming not present (local dev).",
    file=sys.stderr,
)
return False
```

---

### WR-02: `capture_price_baseline` does not guard against missing `'id'` key — will `KeyError` on malformed bootstrap element

**File:** `pipeline/price_baseline.py:65-69`

**Issue:** The dict comprehension at lines 65-68 uses `el['id']` without a guard. The `'now_cost' in el` filter (line 68) only protects against missing `now_cost`; if any element in `bootstrap['elements']` is missing the `'id'` key (e.g. a partially-constructed element from a malformed API response), the comprehension raises `KeyError` and the exception propagates to the caller in `run.py`, which catches it and prints a non-fatal error. This is acceptable behaviour but leaves no record of which element was malformed. More importantly, the `if 'now_cost' in el` guard and the missing `if 'id' in el` guard are asymmetric — one is guarded, one is not.

**Fix:**
```python
baseline = {
    str(el['id']): el['now_cost']
    for el in elements
    if 'id' in el and 'now_cost' in el
}
```

---

### WR-03: Route test `setupMocks` treats `mergedPlayers === undefined` and `mergedPlayers === null` identically, but the route distinguishes the two — test gap

**File:** `src/app/api/price-reset/route.test.ts:63-69`

**Issue:** In `setupMocks`, the mock for `merged_players.json` throws `ENOENT` when `opts.mergedPlayers === undefined || opts.mergedPlayers === null`. This means a test that passes `mergedPlayers: null` explicitly (absent file scenario) gets the same behavior as a test that passes `mergedPlayers: undefined` (unspecified). The route itself does not use `readFile` for this; the mock is coupled to the local-mode path. More critically, the mock throws `ENOENT` for absent merged_players, which in `readBlobOrLocal` returns `null` via the ENOENT check (correct). However, the `malformed_merged_players_does_not_break_route` test at line 224 overrides the mock manually to throw a generic `Error` (not ENOENT) for `merged_players.json`. That generic error is _re-thrown_ (because `isNotFound` is false — same as CR-01), yet the test expects `published: true` and `value_targets: []`. 

This means the test is currently _passing only because the outer try/catch at route.ts:214 catches the re-thrown error and returns 500_ — except the test asserts `res.status === 200`. If this test is actually green, it means either: (a) the `merged_players.json` read happens inside the inner try/catch at line 129 (it does — `readBlobOrLocal('merged_players.json').catch(() => null)` at line 57 swallows the error before it reaches the outer handler), or (b) there is a subtle interaction. On inspection: line 57 applies `.catch(() => null)` inline in `Promise.all`, so the generic `Error` _is_ swallowed to `null` — meaning `mergedPlayersText` becomes `null`, and the inner try/catch at line 130 short-circuits. So the test is correct for the wrong reason: it tests the `.catch(() => null)` path, not "malformed JSON," and the test description is misleading. A real malformed JSON string (e.g. `"not-json"`) would exercise a different code path (JSON.parse failure caught by inner try/catch at line 197). No test covers that path.

**Fix:** Add a test case for malformed JSON in merged_players:
```typescript
it('malformed_merged_players_json_does_not_break_route', async () => {
  ;(readFile as ...).mockImplementation(async (path: string) => {
    if (path.includes('price_baseline.json')) return JSON.stringify(baseline)
    if (path.includes('fpl_bootstrap.json')) return JSON.stringify(bootstrap)
    if (path.includes('merged_players.json')) return 'not-valid-json{'
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  })
  const { GET } = await import('./route')
  const res = await GET()
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.published).toBe(true)
  expect(body.value_targets).toEqual([])
})
```

---

## Info

### IN-01: `ValueTargetRowView` pill CSS applies `DELTA_PILL_RISE` when `delta_cost > 0` — structural dead code in the component

**File:** `src/components/price-reset/PriceResetTab.tsx:50`

**Issue:** `ValueTargetRow` is documented in `types.ts` (line 1177) as "delta_cost is guaranteed < 0 in this collection." The component `ValueTargetRowView` nonetheless applies the `DELTA_PILL_RISE` (green) class when `row.delta_cost > 0`. This branch can never be reached for well-formed data — the API route filters `if (player.delta_cost >= 0) continue` at line 178. The condition is dead code and could confuse future maintainers into thinking rises can appear here.

**Fix:** Replace with an unconditional `DELTA_PILL_FALL` since the type contract guarantees it, or add a comment:
```tsx
<span
  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${DELTA_PILL_FALL}`}
>
  {formatDeltaPounds(row.delta_cost)}
</span>
```

---

### IN-02: `console.error` left in production `DecisionErrorBoundary` in `page.tsx`

**File:** `src/app/page.tsx:48`

**Issue:** `componentDidCatch` calls `console.error('[DecisionSummaryTab crash]', error, info)`. This pre-dates Phase 133 but is in the reviewed file. `console.error` in production leaks stack traces to browser devtools and may trigger some monitoring tools' noise thresholds. This is not introduced by Phase 133 but is present in the file.

**Fix:** Either remove the `console.error` or gate it on `process.env.NODE_ENV !== 'production'`. If crash telemetry is desired, route it through a proper error reporting service.

---

_Reviewed: 2026-05-22T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
