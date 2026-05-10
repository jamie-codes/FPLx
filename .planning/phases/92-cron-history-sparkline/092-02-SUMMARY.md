---
phase: 92
plan: "02"
subsystem: pipeline+frontend
tags:
  - pipeline
  - data-health
  - recharts
  - sparkline
  - tdd-green
dependency_graph:
  requires:
    - "092-01 RED gate tests (pipeline/tests/test_data_health_history.py, AccuracyTab.test.tsx Phase 92 describe block)"
  provides:
    - "_append_history + _compute_overall_status in pipeline/data_health.py"
    - "HistoryEntry interface + DataHealth.history field in src/lib/types.ts"
    - "DataHealthSparkline + SparklineDot + SparklineTooltip in src/components/accuracy/AccuracyTab.tsx"
  affects:
    - pipeline/data_health.py
    - src/lib/types.ts
    - src/components/accuracy/AccuracyTab.tsx
tech_stack:
  added: []
  patterns:
    - "recharts ResponsiveContainer initialDimension prop for jsdom test compat (ResizeObserver inactive in jsdom)"
    - "FIFO cap-7 list append via Python slice (prior_history + [entry])[-7:]"
    - "warn->warning normalisation in _compute_overall_status as single point of truth"
    - "CSS custom property colour tokens (--color-positive, --color-warning, --color-negative, --muted) for dot fill"
key_files:
  created: []
  modified:
    - pipeline/data_health.py
    - src/lib/types.ts
    - src/components/accuracy/AccuracyTab.tsx
decisions:
  - "Used recharts ResponsiveContainer initialDimension={width:400, height:40} so that jsdom renders SVG circles during test (ResizeObserver never fires in jsdom, leaving the container at -1x-1 and skipping all SVG render). In browsers, ResizeObserver fires and overrides the initial dimension normally."
  - "Omitted Dot import from recharts (unused-import lint rule); SparklineDot returns a raw <circle> JSX element — no recharts Dot wrapper needed"
  - "y: 2 as 0|1|2 cast in cold-start chartData entry to satisfy recharts ChartData generic constraint that infers the union type from the mapped array"
metrics:
  duration: "~20 min"
  completed: "2026-05-10"
  tasks_completed: 3
  files_modified: 3
---

# Phase 92 Plan 02: DH-04 GREEN Implementation Summary

Wave 1 GREEN: added rolling 7-entry history field to data_health.json (Python) and rendered it as a recharts LineChart sparkline inside DataHealthPanel (TypeScript/React). All Wave 0 RED tests now pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add _append_history + _compute_overall_status to data_health.py | 58409f3 | pipeline/data_health.py |
| 2 | Add HistoryEntry interface and DataHealth.history to types.ts | f327281 | src/lib/types.ts |
| 3 | Add DataHealthSparkline components and mount in DataHealthPanel | b9b24bd | src/components/accuracy/AccuracyTab.tsx |

## Source Files Modified

### pipeline/data_health.py

**Changes (lines 89-120, 155-168):**

1. Two new private helpers inserted after `_check_sp_unmatched` (line 88):
   - `_append_history(prior_history, overall_status, generated_at) -> list` — pure FIFO append with `[-7:]` cap
   - `_compute_overall_status(sanity_checks) -> str` — precedence `error > warn > ok`, normalises `'warn' -> 'warning'`

2. Prior-file read block extended (lines 113-121) to extract `prior_history`:
   ```python
   prior_history: list = []  # Phase 92 DH-04
   # in try block:
   prior_history = prev.get('history', [])
   # in except branch:
   prior_history = []
   ```

3. Result dict assembly extended:
   ```python
   result['history'] = _append_history(
       prior_history,
       _compute_overall_status(sanity_checks),
       result['generated_at'],
   )
   ```
   Inserted between the dict literal closing brace and the `from upload import save` line.

### src/lib/types.ts

**Changes (lines 433-440):**

Added `history?: HistoryEntry[]` as last field on `DataHealth`, and added new `HistoryEntry` interface immediately after `DataHealth`, before the Phase 63 section divider:

```typescript
export interface DataHealth {
  // ... existing 9 fields unchanged ...
  history?: HistoryEntry[]  // Phase 92 DH-04 — optional; absent on legacy cache (pre-Phase-92)
}

export interface HistoryEntry {
  timestamp: string                         // ISO-8601 UTC
  overall_status: 'ok' | 'warning' | 'error'
}
```

### src/components/accuracy/AccuracyTab.tsx

**Changes (lines 6-26 imports, lines 832-912 new functions, line 967 mount):**

1. Type imports: added `HistoryEntry, // Phase 92 DH-04` to the named import from `@/lib/types`
2. Recharts imports: added `LineChart, // Phase 92 DH-04` to the named import from `recharts`
3. New Phase 92 section (above `function DataHealthPanel()`):
   - `SPARKLINE_STATUS_COLOR` — maps `ok/warning/error` to `var(--color-positive/warning/negative)`
   - `SPARKLINE_STATUS_Y` — maps statuses to y-values `2/1/0` for chart positioning
   - `SPARKLINE_STATUS_LABEL` — maps statuses to display labels `OK/Warning/Error`
   - `function SparklineDot(props: any)` — renders `<circle>` with status-based fill
   - `function SparklineTooltip({ active, payload }: any)` — renders timestamp + label tooltip
   - `function DataHealthSparkline({ history }: { history: HistoryEntry[] })` — `ResponsiveContainer` + `LineChart` with `initialDimension`
4. Mount in `DataHealthPanel`: `{data?.history && <DataHealthSparkline history={data.history} />}` between `</button>` and `{isExpanded && data && ...}`

## Verification Commands and Outputs

### Python: Phase 92 tests GREEN

```
cd pipeline && python -m pytest tests/test_data_health_history.py -x
============================= test session starts =============================
collected 4 items
tests\test_data_health_history.py ....  [100%]
4 passed in 0.07s
```

### Python: Phase 82 regression tests GREEN

```
cd pipeline && python -m pytest tests/test_data_health.py -x
============================= test session starts =============================
collected 16 items
tests\test_data_health.py ................  [100%]
16 passed in 0.07s
```

### TypeScript: Vitest AccuracyTab GREEN (27 tests)

```
npm run test -- AccuracyTab
Tests  27 passed (27)
```

Includes:
- 5 new Phase 92 tests in `describe('Phase 92 DH-04: DataHealthSparkline')`:
  - renders 7 dots for a 7-entry history
  - dot colour maps ok->green, warning->amber, error->red via CSS vars
  - tooltip shows timestamp + status label on hover
  - cold-start placeholder renders when history is empty array
  - renders nothing when history field is absent from data
- 22 pre-existing Phase 41/63/91 tests: all still passing

### TypeScript: tsc --noEmit clean

```
npx tsc --noEmit
(no output — exit 0)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added initialDimension to ResponsiveContainer for jsdom SVG rendering**
- **Found during:** Task 3 verification
- **Issue:** recharts `ResponsiveContainer` uses `ResizeObserver` to measure its DOM container. In jsdom (Vitest's test environment), `ResizeObserver` never fires, so the component stays at its `initialDimension` default of `{width: -1, height: -1}`. With -1 dimensions, recharts skips rendering the SVG content, meaning `SparklineDot` components never render the `<circle>` elements the Wave 0 RED tests query with `querySelectorAll('circle')`.
- **Fix:** Pass `initialDimension={{ width: 400, height: 40 }}` to `ResponsiveContainer`. This is a documented prop (`defaultResponsiveContainerProps.initialDimension` in recharts source). In real browsers, `ResizeObserver` fires immediately and overrides this value with the actual container width. In jsdom, the initial dimension persists and recharts renders at 400×40.
- **Files modified:** `src/components/accuracy/AccuracyTab.tsx`
- **Commit:** b9b24bd

**2. [Rule 1 - Bug] Type cast for cold-start y value**
- **Found during:** TypeScript check after Task 3
- **Issue:** The cold-start chartData entry `{ y: 2, ... }` had `y` inferred as `number` by TypeScript, but the recharts `ChartData` generic constraint inferred from the mapped array produces `y: 0 | 1 | 2`. TypeScript rejected the union type mismatch.
- **Fix:** Added `y: 2 as 0 | 1 | 2` cast in the cold-start object literal.
- **Files modified:** `src/components/accuracy/AccuracyTab.tsx`
- **Commit:** b9b24bd (same commit, fixed before committing)

## Manual Verification Steps

Not performed (plan states manual verification is optional). The automated test suite provides complete coverage for all DH-04 behaviors.

## Confirmations

- **No new API route added:** Confirmed. `DataHealthSparkline` consumes data via the existing `useDataHealth()` hook, no new route.
- **No new hook added:** Confirmed. The sparkline reads `data.history` from the existing `useDataHealth()` hook result.
- **No new npm package added:** Confirmed. `recharts` was already installed (Phase 63); `LineChart` is an existing export. `@types/recharts` is NOT installed (`grep '"@types/recharts"' package.json` returns no match).
- **`'warn' -> 'warning'` normalisation:** The single point of normalisation is `_compute_overall_status()` in `pipeline/data_health.py`. The literal string `'warn'` never appears in any history entry — `overall_status` values are always `'ok'`, `'warning'`, or `'error'`.

## Known Stubs

None. All functionality is fully wired:
- `_append_history` is called in `compute_data_health` and writes to the JSON result
- `DataHealthSparkline` reads from real `data.history` (not mock data)
- Dot colours use real CSS custom properties matching the project's design token system

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced beyond what was documented in the plan's `<threat_model>`. The `history` field flows through the existing `data_health.json` → `useDataHealth()` → `DataHealthSparkline` path. T-92-04 through T-92-08 threats accepted/mitigated as per plan.

## Self-Check: PASSED

- `pipeline/data_health.py` contains `def _append_history`: FOUND
- `pipeline/data_health.py` contains `def _compute_overall_status`: FOUND
- `src/lib/types.ts` contains `export interface HistoryEntry {`: FOUND
- `src/components/accuracy/AccuracyTab.tsx` contains `function DataHealthSparkline`: FOUND
- Commit 58409f3 exists: FOUND
- Commit f327281 exists: FOUND
- Commit b9b24bd exists: FOUND
- pytest test_data_health_history.py: 4 passed
- pytest test_data_health.py: 16 passed
- Vitest AccuracyTab: 27 passed
- npx tsc --noEmit: exit 0
