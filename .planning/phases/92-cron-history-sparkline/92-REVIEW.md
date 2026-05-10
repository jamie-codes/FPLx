---
phase: 92-cron-history-sparkline
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/data_health.py
  - src/lib/types.ts
  - src/components/accuracy/AccuracyTab.tsx
  - pipeline/tests/test_data_health_history.py
  - src/components/accuracy/AccuracyTab.test.tsx
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 92: Code Review Report

**Reviewed:** 2026-05-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase adds a rolling 7-entry pipeline status history (DH-04) to `data_health.json`, the `DataHealthSparkline` UI component, and supporting tests. The pipeline logic (`_append_history`, `_compute_overall_status`) is sound for the happy path. Two blockers were found: the `SanityCheckId` union type in `src/lib/types.ts` does not include `'sp_unmatched_ids'`, causing a runtime key-lookup gap for a check the pipeline actively emits, and the `prior_history` read path in `compute_data_health` is not validated as a list — a corrupted or malformed `history` field in a prior file raises an unhandled `TypeError` that bypasses the `except` guard. Three warnings cover a `SparklineDot` typed `any`, a test that does not exercise the real write path, and a TypeScript type narrowing gap in `formatSanityValue`.

---

## Critical Issues

### CR-01: `SanityCheckId` missing `'sp_unmatched_ids'` — pipeline emits unknown id

**File:** `src/lib/types.ts:408-412`

**Issue:** `SanityCheckId` is a closed union of four string literals. Phase 84 added `_check_sp_unmatched()` to `pipeline/data_health.py` which writes `{ id: 'sp_unmatched_ids', ... }` into `sanity_checks` when `sp_unmatched_count` is an int. `SanityCheck.id` is typed as `SanityCheckId`, so the emitted entry fails Zod validation (or is cast to `unknown` depending on how `/api/data-health` parses the response). More concretely, `SANITY_CHECK_LABELS` in `AccuracyTab.tsx` is typed as `Record<SanityCheck['id'], string>` — it has no `'sp_unmatched_ids'` key, so `SANITY_CHECK_LABELS[check.id]` evaluates to `undefined` and the table cell renders blank (or crashes if strict null checks reach the DOM).

**Fix:**
```typescript
// src/lib/types.ts
export type SanityCheckId =
  | 'player_count'
  | 'missing_player_delta'
  | 'understat_null_pct'
  | 'pipeline_stale'
  | 'sp_unmatched_ids'   // Phase 84 D-04

// src/components/accuracy/AccuracyTab.tsx
const SANITY_CHECK_LABELS: Record<SanityCheck['id'], string> = {
  player_count:         'Player count',
  missing_player_delta: 'Missing player delta',
  understat_null_pct:   'Understat null %',
  pipeline_stale:       'Pipeline stale',
  sp_unmatched_ids:     'SP unmatched IDs',   // add this entry
}
```

---

### CR-02: Unguarded `TypeError` when `prior_history` is non-list in corrupted JSON

**File:** `pipeline/data_health.py:153`

**Issue:** `prior_history = prev.get('history', [])` does not validate that the returned value is actually a list. If a prior `data_health.json` was written with `history` as a non-list (e.g. `null`, a string, or a dict — caused by a partial write, a blob-storage glitch, or a schema migration), then `_append_history` at line 104 executes `prior_history + [entry]`, which raises `TypeError: can only concatenate <type> to list`. This exception is not caught by the `except (FileNotFoundError, json.JSONDecodeError, OSError)` block at line 154, so it propagates and kills the pipeline run.

```python
# pipeline/data_health.py — current (line 153)
prior_history = prev.get('history', [])

# After fix:
raw_history = prev.get('history', [])
prior_history = raw_history if isinstance(raw_history, list) else []
```

---

## Warnings

### WR-01: `compute_data_health` reads from `cache_dir` but `save()` ignores it — test conceals the divergence

**File:** `pipeline/data_health.py:212` / `pipeline/tests/test_data_health_history.py:91`

**Issue:** `compute_data_health` receives `cache_dir` and uses it only for reading the prior file (`os.path.join(cache_dir, 'data_health.json')`, line 146). The `save('data_health.json', result)` call on line 212 routes to `upload.save()`, which in the non-blob path writes to the hard-coded `pipeline/cache/` default — not to `cache_dir`. In production this is accidentally correct (callers always pass `pipeline/cache`), but the API contract advertised by the parameter is violated: callers who pass a custom `cache_dir` (e.g. a temp dir in tests) will see reads from that dir and writes to `pipeline/cache/`. `test_atomic_write_order` papers over this by manually writing back to `tmp_path` after each call, so the test never verifies the real round-trip and would pass even if the write went to a completely wrong location.

**Fix:** Either pass `cache_dir` through to `save_local` (requires plumbing through `upload.save`), or document the contract clearly and assert in tests that the written file ends up in the right place:
```python
# Option A: plumb cache_dir to save
from upload import save_local, upload_json
if os.getenv('USE_BLOB', '').lower() == 'true':
    upload_json('data_health.json', result)
else:
    save_local('data_health.json', result, cache_dir=cache_dir)
```

---

### WR-02: `SparklineDot` typed `any` bypasses compile-time safety

**File:** `src/components/accuracy/AccuracyTab.tsx:853-858`

**Issue:** `SparklineDot` is typed as `(props: any)` with an `eslint-disable` comment. The function accesses `props.cx`, `props.cy`, and `props.payload` — all Recharts-injected dot props. The `any` type means TypeScript cannot catch if Recharts changes the prop shape. The `payload?.timestamp === null` check is also subtly brittle: `timestamp` is `string | null` in `chartData`, so `=== null` is the correct guard for the cold-start placeholder, but this is invisible to TypeScript with `any`.

**Fix:** Define a minimal interface for the dot props:
```typescript
interface SparklineDotProps {
  cx?: number
  cy?: number
  payload?: { timestamp: string | null; overall_status: HistoryEntry['overall_status'] }
}

function SparklineDot({ cx, cy, payload }: SparklineDotProps) {
  const fill = payload?.timestamp == null
    ? 'var(--muted)'
    : SPARKLINE_STATUS_COLOR[payload.overall_status] ?? 'var(--muted)'
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="none" />
}
```
The same applies to `SparklineTooltip` at line 862 which is also typed `any`.

---

### WR-03: `formatSanityValue` calls `.toFixed()` on `check.value` typed as `number | boolean`

**File:** `src/components/accuracy/AccuracyTab.tsx:65`

**Issue:** At line 64 the function first checks `typeof check.value === 'boolean'` and returns early. Line 65 then calls `check.value.toFixed(2)` — at this point TypeScript has narrowed `check.value` to `number`, but the narrowing depends on the boolean branch at line 64 covering all boolean cases. If a future check is added where `check.id === 'understat_null_pct'` is true but `check.value` is a boolean (e.g. a pipeline schema change or a future check that reuses the same ID — unlikely but structurally possible), the call will throw at runtime. TypeScript does not flag this because `number` has `.toFixed()`. A defensive cast would make intent explicit.

**Fix:**
```typescript
function formatSanityValue(check: SanityCheck): string {
  if (typeof check.value === 'boolean') return check.value ? 'true' : 'false'
  if (check.id === 'understat_null_pct') return `${(check.value as number).toFixed(2)}%`
  return String(check.value)
}
```
Additionally, `SANITY_CHECK_LABELS[check.id]` at line 982 will return `undefined` for any `check.id` not in the map (e.g. the `sp_unmatched_ids` case from CR-01). The lookup result is used directly in JSX without a null guard; a fallback is required:
```tsx
<td className={TD_CLS}>{SANITY_CHECK_LABELS[check.id] ?? check.id}</td>
```

---

## Info

### IN-01: `test_atomic_write_order` does not assert `history` entry shape on intermediate results

**File:** `pipeline/tests/test_data_health_history.py:88-101`

**Issue:** After Run 1, the test asserts `'history' in r1` and `len(r1['history']) == 1`, but does not assert the entry shape (`{'timestamp', 'overall_status'}`). The entry shape assertion only appears on `r3['history']` at lines 108-115. If `_append_history` produced entries with extra or missing keys in early runs that were coincidentally serialised correctly when written back, the intermediate assert would miss it. This is low-impact given the shape is simple, but inconsistent coverage.

**Fix:** Hoist the entry shape assertion into a helper and call it after each run:
```python
def _assert_entry_shape(entry):
    assert set(entry.keys()) == {'timestamp', 'overall_status'}
    assert entry['overall_status'] in ('ok', 'warning', 'error')

# then after r1, r2, r3:
for entry in r1['history']:
    _assert_entry_shape(entry)
```

---

_Reviewed: 2026-05-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
