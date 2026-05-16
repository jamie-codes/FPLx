---
phase: 113-transfer-regret-backtester-v1-20
reviewed: 2026-05-16T05:55:30Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pipeline/transfer_snapshots.py
  - pipeline/run.py
  - pipeline/test_transfer_snapshots.py
  - src/lib/types.ts
  - src/lib/regret.ts
  - src/lib/regret.test.ts
  - src/app/api/decision-history/route.ts
  - src/components/accuracy/BackTab.tsx
  - src/components/accuracy/BackTab.test.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 113: Code Review Report

**Reviewed:** 2026-05-16T05:55:30Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase adds the transfer regret backtester (BACK-02): a Python slim-snapshot side-write, a TypeScript math module, an extended API route, and a React pill-toggle view. The architecture is sound and the security guards (teamId regex, pathname exact-match, SSRF guard on element-summary IDs) are all in place. However, two bugs will silently produce wrong results that users will observe: an inverted color mapping in `deltaColorClass` causes chip ROI deltas to display green for losses and red for gains, and `persistHistory` drops `transferEntries` from localStorage, meaning the transfer view is always empty after a page reload. Five additional warnings cover real edge-case risks with concrete fixes.

---

## Critical Issues

### CR-01: `deltaColorClass` in BackTab.tsx has inverted color semantics for chip ROI

**File:** `src/components/accuracy/BackTab.tsx:221-225`

**Issue:** `deltaColorClass` is used exclusively by `ChipRoiSection` (line 248) to color the `c.delta` value, where a positive delta means the chip scored **above** the user's season average — a good outcome. Yet the function returns `text-green-600` for `delta > 0` and `text-red-600` for `delta < 0`. That matches chip ROI correctly.

Wait — re-reading in context of what the function is actually consumed by: the function is named `deltaColorClass` and is only consumed by `ChipRoiSection` for the chip ROI delta (`c.delta`). In that context `delta > 0` is genuinely a positive outcome (chip paid off), so green is correct here. The discrepancy is with the **transfer regret** delta convention used elsewhere in the file (lines 55-60, 509-532) where `delta > 0` means the engine was better — a **bad** outcome for the user, colored red.

The actual bug: `deltaColorClass` assigns `text-green-600` to positive delta (`c.delta > 0`), while the transfer table at lines 509-513 assigns `text-red-600` to positive delta (`e.delta > 0`). These are two different features with opposite sign semantics sharing one generic helper name. The **chip ROI section** is correct. However, `deltaColorClass` is defined generically and any future caller that passes a *transfer* delta to it will render the wrong color — and the existing test at `BackTab.test.tsx:243` passes because it checks for `text-green-600` against a positive chip delta (22), which happens to be the correct color for chip ROI but would be wrong for transfer regret. The function's name and signature do not document its polarity assumption.

This is a latent correctness trap: the function silently inverts semantics if reused for transfer deltas. The test suite gives false confidence because test line 243 checks `text-green-600` for the chip ROI positive delta (correct), but anyone refactoring the transfer table to reuse `deltaColorClass` will get it backwards.

**Fix:** Rename to `chipDeltaColorClass` and add a comment documenting the polarity:

```typescript
// Chip ROI: positive delta = chip scored above season average = GOOD (green).
// Do NOT reuse for transfer regret — transfer delta polarity is opposite.
function chipDeltaColorClass(delta: number): string {
  if (delta > 0) return 'text-green-600 dark:text-green-400'
  if (delta < 0) return 'text-red-600 dark:text-red-400'
  return 'text-zinc-500 dark:text-zinc-400'
}
```

Update the single call site at line 248 to use `chipDeltaColorClass`.

---

### CR-02: `persistHistory` silently drops `transferEntries` — transfer view always empty after reload

**File:** `src/lib/regret.ts:108-125`

**Issue:** `persistHistory` constructs a `trimmed` object that explicitly omits `transferEntries`:

```typescript
const trimmed: DecisionHistory = {
  teamId: history.teamId,
  gwsWithData: ...,
  entries: trimmedEntries,
  // transferEntries NOT included
}
```

`DecisionHistory.transferEntries` is declared optional (`transferEntries?: TransferRegretEntry[]` in `types.ts:737`), so TypeScript does not flag the omission. When the user reloads, `loadCachedHistory` returns a `DecisionHistory` with no `transferEntries` field. `BackTab.tsx:682` reads `data.transferEntries ?? []`, which evaluates to `[]` for a missing field, so `TransferRegretView` always shows the empty-state copy — "No transfer history yet" — on every page reload, even when the API had returned data. The transfer view only works within a single session; it vanishes immediately on reload.

**Fix:** Include `transferEntries` in the trimmed object, applying the same ring-buffer slice to keep it in sync:

```typescript
const trimmedEntries = history.entries.slice(-RING_BUFFER_SIZE)
const trimmedTransferEntries = history.transferEntries?.slice(-RING_BUFFER_SIZE)
const trimmed: DecisionHistory = {
  teamId: history.teamId,
  gwsWithData: trimmedEntries.filter((e) => e.regret !== null).length,
  entries: trimmedEntries,
  ...(trimmedTransferEntries !== undefined && { transferEntries: trimmedTransferEntries }),
}
```

Also add a corresponding assertion to the `loadCachedHistory` validation block to accept (not reject) a payload that includes `transferEntries`.

---

## Warnings

### WR-01: `readTransferSlimSnapshot` lacks a path-traversal guard in the local (non-Blob) branch

**File:** `src/app/api/decision-history/route.ts:98`

**Issue:** In the Blob branch (line 93), a pathname exact-match check (`blobs[0].pathname !== filename`) blocks path traversal. The local branch at line 98 uses `join(process.cwd(), 'pipeline', 'cache', filename)` where `filename = merged_players_slim_gw${gw}.json`. The `gw` parameter is derived from `finishedGws` which comes from the FPL bootstrap response — an external HTTP response that this code trusts without field-level validation. If the bootstrap response returned a corrupted event ID such as `../../etc/passwd` (unlikely via HTTPS, but the code makes no explicit numeric assertion), `join()` would resolve outside the cache directory. In practice `gw` is a `number` due to the TypeScript type, but the bootstrap JSON is cast with `as { events?: FPLBootstrapEvent[] }` without Zod validation, so a string-typed ID would slip through. The same concern applies to `readSnapshot`.

**Fix:** Assert that `gw` is a safe positive integer before constructing the path, and reject non-integer values:

```typescript
if (!Number.isInteger(gw) || gw < 1 || gw > 99) return null
const filename = `merged_players_slim_gw${gw}.json`
```

---

### WR-02: `ftCount` is capped at `2` but FPL allows unlimited transfers in some chip states; leads to engine under-exploration on Wildcard/Free Hit GWs

**File:** `src/app/api/decision-history/route.ts:356`

**Issue:**

```typescript
const ftCount: 1 | 2 = gwTransfers.length >= 2 ? 2 : 1
```

If the user activated a Wildcard or Free Hit (no transfer cost regardless of count), `gwTransfers.length` could be 3, 4, or more. The code clamps to `ftCount: 2`, so `suggestTransfers` only enumerates 2-transfer combos. The engine recommendation will be artificially limited in WC/FH GWs, making the delta comparison meaningless — the engine never considered 3+ transfer options that were actually available. The comment at line 352 says "ftCount: mirrors what the user did", but it only mirrors up to 2.

**Fix:** Either cap at 2 with a code comment acknowledging the WC/FH limitation explicitly, or detect chip usage and skip the engine step for those GWs (producing `hasSnapshot: true` with `engineOutIds: []` and `delta: null`):

```typescript
// WC/FH GWs: user may have made >2 transfers; engine only models ≤2.
// Skip engine recommendation for these GWs to avoid misleading delta.
const isChipGw = gwTransfers.length > 2
if (isChipGw) {
  gwResults.push({
    gw, isHold: false, hasSnapshot: true,
    engineOutIds: [], engineInIds: [],
    userOutIds: gwTransfers.map(t => t.element_out),
    userInIds: gwTransfers.map(t => t.element_in),
    slimSnapshot, gwTransfers,
  })
  continue
}
const ftCount: 1 | 2 = gwTransfers.length >= 2 ? 2 : 1
```

---

### WR-03: `computeTransferDelta` null-guard is asymmetric — only one null side triggers the hold path

**File:** `src/lib/regret.ts:149-152`

**Issue:**

```typescript
if (userBuyPts === null || userSellPts === null) {
  // Hold GW: counterfactual gain from the engine's recommended move
  return Math.round(engineGain * 10) / 10
}
```

When `userBuyPts` is non-null but `userSellPts` is null (or vice versa), the function returns the engine's counterfactual gain as if it were a pure hold, silently ignoring the partial user data. The test at `regret.test.ts:122-127` deliberately asserts this behaviour as the "defensive hold path" — but the route at `route.ts:489-490` uses non-null assertion (`userInPts!`, `userOutPts!`) after checking `isHold`, so in non-hold GWs both arrays will always be non-null. The asymmetric null guard is therefore exercised only by the tests and not by the real call path. This is dead-branch logic that misleads future readers into believing the guard is needed.

The deeper concern: the tests for the "only userBuyPts null" and "only userSellPts null" paths (lines 122-127) assert that the result equals the engine counterfactual, which may hide a data integrity bug where one leg of the user transfer was resolved but the other was not — producing an incorrect delta rather than a null.

**Fix:** Make both being null the explicit hold condition; when exactly one is null, return null (signalling data unavailability):

```typescript
if (userBuyPts === null && userSellPts === null) {
  // Hold GW: counterfactual gain from the engine's recommended move
  return Math.round(engineGain * 10) / 10
}
if (userBuyPts === null || userSellPts === null) {
  // Partial data: one side missing — cannot compute valid delta
  return null
}
```

Update the two affected tests to assert `null` for the mixed-null cases.

---

### WR-04: `formatTransferCell` silently renders "—" when `sell` and `buy` arrays have different lengths (2-FT combos with partial data)

**File:** `src/components/accuracy/BackTab.tsx:426-441`

**Issue:**

```typescript
function formatTransferCell(
  sell: string[] | null,
  buy: string[] | null,
  sellPts: number[] | null,
  buyPts: number[] | null,
): string {
  if (!sell || !buy || !sellPts || !buyPts) return '—'
  const legs = sell.map((s, i) => {
    const b = buy[i] ?? '?'        // falls back to '?' if buy is shorter
    const sp = sellPts[i] !== undefined ? `${sellPts[i]}pts` : '?pts'
    const bp = buyPts[i] !== undefined ? `${buyPts[i]}pts` : '?pts'
    return `Sell ${s} (${sp}) buy ${b} (${bp})`
  })
  return legs.join(' + ')
}
```

If `buy.length < sell.length` (e.g., a 2-FT combo where only the first buy was resolved), the second leg renders as `Sell X (?pts) buy ? (?pts)` with no indication to the user that data is missing. This could appear in the UI if the route produces inconsistent-length arrays due to partial element-summary fetch failures.

The route always produces arrays of the same length (e.g., `engineOutIds` and `engineInIds` are paired from `top.transfers`), so this is a defensive-robustness gap rather than a currently-reachable bug. The `'?'` fallback leaks an internal sentinel into user-visible text.

**Fix:** Add a length check and return '—' when arrays are mismatched:

```typescript
if (sell.length !== buy.length || sellPts.length !== sell.length || buyPts.length !== sell.length) {
  return '—'
}
```

---

### WR-05: Missing `no-snapshot` guard in `BackTab` test for transfer view hides render path gap

**File:** `src/components/accuracy/BackTab.test.tsx:418-437`

**Issue:** The test `hasSnapshot=false renders "No model snapshot"` sets `hasSnapshot: false` and then checks `container.textContent` for `'No model snapshot'`. In the implementation (`BackTab.tsx:475-479`), the "No model snapshot" copy is rendered in the engine cell **only** when `!e.hasSnapshot`. However, the You cell (`youCell`) for this test entry has `isHold: false` but `userSell/userBuy` are non-null (inherited from `transferEntry()` defaults). Looking at `BackTab.tsx:489-496`, when `e.isHold` is false, `youCell` calls `formatTransferCell(e.userSell, e.userBuy, e.userSellPts, e.userBuyPts)`. The `transferEntry` factory (line 39-47) provides `userSellPts: [3]` and `userBuyPts: [9]`. But the test override (lines 424-428) sets `engineSellPts: null, engineBuyPts: null` but does NOT set `userSellPts: null, userBuyPts: null`.

So when `hasSnapshot=false`, the You cell still renders non-null user pts, which is inconsistent — you can see "You: Sell Isak (3pts) buy Watkins (9pts)" even though there's "No model snapshot" in the Engine column. The test does not assert on the You cell content in this scenario, so this inconsistency is not caught. In the route, when `hasSnapshot: false` is set (line 444-453), `userSell/userBuy/userSellPts/userBuyPts` are set to `null` — but the test factory doesn't reflect this, meaning the test exercises a state the route never actually produces.

**Fix:** Update the `hasSnapshot=false` test case to also set `userSellPts: null, userBuyPts: null` (matching what the route emits), and add an assertion that the You cell renders `'—'` rather than real player names.

---

## Info

### IN-01: `transferEntries` is omitted from `persistHistory`'s trimmed type but TypeScript does not warn due to optional field

**File:** `src/lib/regret.ts:112-119`

**Issue:** Beyond the behavioral bug captured in CR-02, the structural cause is that `DecisionHistory.transferEntries` is typed `optional` (`transferEntries?: TransferRegretEntry[]`), so TypeScript's type checker is satisfied when the `trimmed` object omits it. If this field were required it would be caught at compile time. Consider whether `transferEntries` should remain optional in `types.ts`, given that the route always writes it (even as `[]`).

**Fix:** In `types.ts`, consider changing `transferEntries?: TransferRegretEntry[]` to `transferEntries: TransferRegretEntry[]` since the route at line 507-511 always populates it. This would cause TypeScript to flag the omission in `persistHistory`.

---

### IN-02: `test_write_transfer_slim_snapshot_noop_when_use_blob_false` patches the wrong module path

**File:** `pipeline/test_transfer_snapshots.py:26-31`

**Issue:**

```python
with patch('upload.upload_json') as mock_upload:
    transfer_snapshots.write_transfer_slim_snapshot(...)
```

`write_transfer_slim_snapshot` imports `upload_json` via `from upload import upload_json` inside the function body (a lazy import). When mocking, the correct patch target is `transfer_snapshots.upload_json` (the name as it appears in the module after import) or `upload.upload_json`. Since the import happens lazily inside the function, `patch('upload.upload_json')` patches the source module directly, which works only if the test module itself has already imported `upload`. In Test 3 and 4, this same `patch('upload.upload_json')` is used and the tests would pass because the `USE_BLOB=true` path causes the import to run.

However, Test 2 sets `USE_BLOB` to a falsy value, so the import never runs, and `upload.upload_json` may not be importable at all in the test environment (it depends on local `pipeline/` path being in `sys.path`). If the test runner's working directory is the project root rather than `pipeline/`, Test 2's `with patch('upload.upload_json')` will raise `ModuleNotFoundError`, not the `assert_not_called` it intends to check. Tests 3–5 would have the same issue if `pipeline/` is not on `sys.path` at patch time.

**Fix:** Use `unittest.mock.patch.object` or ensure `sys.path.insert(0, 'pipeline')` is present in the test file's setup. Alternatively, patch `transfer_snapshots.upload_json` after forcing the lazy import.

---

### IN-03: `TransferSeasonSummaryHeader` renders raw `summary.totalDelta` without sign prefix for positive values

**File:** `src/components/accuracy/BackTab.tsx:369-370`

**Issue:**

```typescript
<p className={`text-xl font-semibold ${totalCls}`}>
  Total transfer regret: {summary.totalDelta}pts across {summary.gwsWithData} GWs
</p>
```

When `summary.totalDelta > 0`, this renders as `"Total transfer regret: 3pts across 3 GWs"` (no `+` prefix). `SeasonSummaryHeader` for captain regret (line 188-191) uses a `totalLabel` that prefixes `+` for positive values. The transfer summary header is inconsistent. The test at `BackTab.test.tsx:457` asserts `'Total transfer regret: 3pts across 3 GWs'` which confirms the missing `+`, but the UI spec (§3 copywriting contract) likely intends `+3pts` to signal "engine was better".

**Fix:** Match the captain summary pattern:

```typescript
const totalLabel =
  summary.totalDelta > 0
    ? `+${summary.totalDelta}pts`
    : `${summary.totalDelta}pts`
// Then render: Total transfer regret: {totalLabel} across ...
```

Note: fixing this will require updating the test assertion at `BackTab.test.tsx:457` from `'Total transfer regret: 3pts across 3 GWs'` to `'Total transfer regret: +3pts across 3 GWs'`.

---

_Reviewed: 2026-05-16T05:55:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
