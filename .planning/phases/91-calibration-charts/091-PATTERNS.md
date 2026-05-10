# Phase 91: Calibration Charts - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 5 (3 modified, 2 modified-tests; 0 created)
**Analogs found:** 5 / 5 (exact match for all — every change is a literal extension of a Phase 63 pattern in the same file)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `pipeline/accuracy.py` (`_compute_calibration_data`) | service / aggregator | batch transform | self — Phase 63 implementation lines 496–547 | exact (extend in place, same fn) |
| `pipeline/tests/test_accuracy.py` (calibration block) | test (pytest unit) | request-response | self — Phase 63 tests lines 452–552 | exact (extend test block) |
| `src/lib/types.ts` (`CalibrationBucket`) | model / type contract | n/a (static type) | self — Phase 63 interface lines 454–459 | exact (add optional fields) |
| `src/components/accuracy/AccuracyTab.tsx` (`CalibrationSection`) | component (client React) | request-response (read-only render) | self — Phase 63 chart block lines 272–358 | exact (clone block + new tooltip) |
| `src/components/accuracy/AccuracyTab.test.tsx` (CAL-01 block) | test (vitest + RTL) | request-response | self — Phase 63 tests lines 257–340 | exact (extend with xPts fixture + cases) |

**Match quality note:** Phase 91 is a *literal extension* phase — every file already contains the exact pattern that the new code must mirror. No external analogs needed; the file's own Phase 63 implementation is the analog.

---

## Pattern Assignments

### 1. `pipeline/accuracy.py` — extend `_compute_calibration_data`

**Analog:** `pipeline/accuracy.py` lines 496–547 (the function being extended)

**Imports pattern (no change):** `defaultdict` is already imported and used. No new Python imports needed.

**Existing accumulator pattern to mirror** (lines 510–526):
```python
# bucket_haul[pos_key][decile_idx] = haul count; bucket_total[pos_key][decile_idx] = total count
bucket_haul: dict = defaultdict(lambda: defaultdict(int))
bucket_total: dict = defaultdict(lambda: defaultdict(int))

for gw, rows in per_gw_rows.items():
    if not rows:
        continue
    n = len(rows)
    # Rank by xpts_predicted descending; rank_idx 0 = top
    ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
    for rank_idx, row in enumerate(ranked):
        decile = min(int(rank_idx * 10 / n), 9)
        is_haul = 1 if row['actual_pts'] >= HAULTER_THRESHOLD else 0
        pos_key = str(row['element_type'])  # Pitfall 3: element_type is int 1-4
        for pk in ('all', pos_key):
            bucket_haul[pk][decile] += is_haul
            bucket_total[pk][decile] += 1
```

**Extension — add two parallel `float` accumulators** (RESEARCH.md Pattern 1; D-07):
```python
# NEW (Phase 91 CAL-01): xPts-mean accumulators (mirror bucket_haul/bucket_total shape, but float)
bucket_sum_predicted: dict = defaultdict(lambda: defaultdict(float))
bucket_sum_actual: dict = defaultdict(lambda: defaultdict(float))

# In the existing inner loop, alongside `bucket_haul[pk][decile] += is_haul`:
bucket_sum_predicted[pk][decile] += row['xpts_predicted']
bucket_sum_actual[pk][decile]    += row['actual_pts']
```

**Existing emit pattern to mirror** (lines 531–545):
```python
by_position: dict = {}
for pos_key in ('all', '1', '2', '3', '4'):
    buckets: list = []
    for d in range(10):
        total = bucket_total[pos_key][d]
        if total < 5:  # D-07: sparse-bucket filter (Pitfall 5: omit, do not zero)
            continue
        haul = bucket_haul[pos_key][d]
        buckets.append({
            'bucket_mid': bucket_mids[d],
            'predicted_rate': bucket_mids[d],
            'actual_rate': round(haul / total, 4),
            'sample_n': total,
        })
    by_position[pos_key] = buckets
```

**Extension — add two new keys to bucket dict, AFTER the `if total < 5: continue` guard** (Pitfall 6 — never divide before the guard):
```python
buckets.append({
    'bucket_mid': bucket_mids[d],
    'predicted_rate': bucket_mids[d],
    'actual_rate': round(haul / total, 4),
    'sample_n': total,
    # NEW: round to 2dp matches UI toFixed(2) and avoids IEEE-754 drift in fixtures (Pitfall 7)
    'predicted_mean': round(bucket_sum_predicted[pos_key][d] / total, 2),
    'actual_mean':    round(bucket_sum_actual[pos_key][d]    / total, 2),
})
```

**`_empty_backtest` pattern (no change required):** lines 472–493 already emit `'calibration': {'by_position': {'all': [], '1': [], '2': [], '3': [], '4': []}}` — empty arrays satisfy D-06 (the new fields are optional; an empty array has no buckets, hence no field-level decision). RESEARCH.md Open Question 1 confirms.

**Error handling:** None added — Pitfall 6 is mitigated by keeping the `if total < 5: continue` line *before* any division. No try/except, no new exceptions; mirrors the parent function's error-free pattern.

---

### 2. `pipeline/tests/test_accuracy.py` — extend calibration tests

**Analog:** `pipeline/tests/test_accuracy.py` lines 452–552 (the existing CAL-01/CAL-02 test block)

**Imports pattern (no change):** `pytest` already imported (line 17); `_hist`, `_build_minimal_inputs` helpers already defined (lines 26–76). No new imports.

**Existing structure-test pattern to mirror** (lines 456–488):
```python
def test_calibration_structure():
    """Phase 63 CAL-01 / D-06: result includes top-level 'calibration' key with shape
    { by_position: { all, '1', '2', '3', '4' } }; each bucket contains bucket_mid,
    predicted_rate, actual_rate, sample_n."""
    # 50 players × 5 GWs = 250 observations -> 25 per decile in 'all'.
    player_histories = {}
    for pid in range(1, 51):
        player_histories[pid] = [_hist(gw, 90, (pid % 12) + 1, xg=0.3, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    all_buckets = result['calibration']['by_position']['all']
    assert len(all_buckets) == 10
    for b in all_buckets:
        for key in ('bucket_mid', 'predicted_rate', 'actual_rate', 'sample_n'):
            assert key in b, f"bucket missing required key {key}"
        assert isinstance(b['bucket_mid'], float)
```

**Extension — clone fixture, add new key+type assertions and a value assertion using `pytest.approx` (Pitfall 7):**
```python
def test_calibration_includes_xpts_means():
    """Phase 91 CAL-01: each bucket includes predicted_mean and actual_mean (floats, 2dp).
    With 50 players × 5 GWs all scoring 6 pts, every decile mean ≈ 6.0."""
    player_histories = {pid: [_hist(gw, 90, 6, xg=0.3, xa=0.2) for gw in range(1, 33)]
                         for pid in range(1, 51)}
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']

    for b in all_buckets:
        assert 'predicted_mean' in b, "Phase 91 CAL-01: bucket must include predicted_mean"
        assert 'actual_mean' in b,    "Phase 91 CAL-01: bucket must include actual_mean"
        assert isinstance(b['predicted_mean'], float)
        assert isinstance(b['actual_mean'], float)
        # All players score 6 -> every bucket's actual_mean ≈ 6.0 (Pitfall 7: use approx, not ==)
        assert b['actual_mean'] == pytest.approx(6.0, abs=0.01)
```

**Sparse-filter test extension** — augment existing `test_calibration_sparse_filter` (line 491) to additionally assert that returned buckets include the new keys (RESEARCH.md §Wave 0 Gaps).

**Test naming convention (locked):** `test_calibration_*` — matches existing CAL-01/CAL-02 prefix and `pytest -k calibration` quick-run.

---

### 3. `src/lib/types.ts` — extend `CalibrationBucket`

**Analog:** `src/lib/types.ts` lines 454–459 (the interface being extended)

**Existing pattern** (lines 454–459):
```typescript
export interface CalibrationBucket {
  bucket_mid: number       // 0.05..0.95 (decile midpoint)
  predicted_rate: number   // equals bucket_mid (decile midpoint as fraction)
  actual_rate: number      // observed haul rate (actual_pts >= 10) for this bucket
  sample_n: number         // observation count; only buckets with n >= 5 are included
}
```

**Extension — add two OPTIONAL fields (D-06)** (mark with `?:`, document as "Phase 91 CAL-01"):
```typescript
export interface CalibrationBucket {
  bucket_mid: number
  predicted_rate: number
  actual_rate: number
  sample_n: number
  // Phase 91 CAL-01 (D-06): optional for legacy-cache compat — Phase 63 caches lack these.
  predicted_mean?: number  // mean xpts_predicted within decile (rounded 2dp by pipeline)
  actual_mean?: number     // mean actual_pts within decile (rounded 2dp by pipeline)
}
```

**Why optional, not required:** D-06 + Pitfall 3 — legacy `accuracy_backtest.json` caches written before Phase 91 lack these fields. Marking them optional means TS compiles cleanly against both old and new caches; the component-edge filter in step 4 narrows them to non-null.

**`CalibrationData` (lines 461–469):** No change. The wrapper interface is shape-stable.

---

### 4. `src/components/accuracy/AccuracyTab.tsx` — extend `CalibrationSection`

**Analog:** `src/components/accuracy/AccuracyTab.tsx` lines 272–358 (the function being extended)

**Imports pattern (no change required)** (lines 1–26):
```typescript
'use client'
import { Fragment, useMemo, useState } from 'react'
import type { CalibrationBucket, CalibrationData /* ... */ } from '@/lib/types'
import {
  ComposedChart, Line, ReferenceLine, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
```
All needed recharts symbols already imported. **Do NOT install `@types/recharts`** (Pitfall 2). `useMemo` already imported (used twice in this section).

**Existing `CalibrationTooltip` pattern to mirror** (lines 251–270):
```tsx
function CalibrationTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as CalibrationBucket
  const bucketLow = Math.round((p.bucket_mid - 0.05) * 100)
  const bucketHigh = Math.round((p.bucket_mid + 0.05) * 100)
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Decile {bucketLow}%–{bucketHigh}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Predicted: {(p.predicted_rate * 100).toFixed(1)}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Actual: {(p.actual_rate * 100).toFixed(1)}%
      </p>
      <p className="text-zinc-500 dark:text-zinc-400 mt-1">n = {p.sample_n}</p>
    </div>
  )
}
```

**New `XptsTooltip` — clone shape; swap fields; add deviation row + null-guard (Pitfall 3)** (UI-SPEC §Copywriting Contract):
```tsx
function XptsTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as CalibrationBucket
  if (p.predicted_mean == null || p.actual_mean == null) return null  // Pitfall 3
  const bucketLow = Math.round((p.bucket_mid - 0.05) * 100)
  const bucketHigh = Math.round((p.bucket_mid + 0.05) * 100)
  const deviation = p.actual_mean - p.predicted_mean
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Decile {bucketLow}%–{bucketHigh}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">Predicted: {p.predicted_mean.toFixed(2)} pts</p>
      <p className="text-zinc-700 dark:text-zinc-300">Actual: {p.actual_mean.toFixed(2)} pts</p>
      <p className="text-zinc-700 dark:text-zinc-300">Deviation: {deviation.toFixed(2)} pts</p>
      <p className="text-zinc-500 dark:text-zinc-400 mt-1">n = {p.sample_n}</p>
    </div>
  )
}
```

**Existing data-shaping pattern to mirror** (lines 273–278):
```tsx
const [position, setPosition] = useState<CalibrationPosition>('all')   // SHARED — D-02

const chartData = useMemo<CalibrationBucket[]>(() => {
  const all = data.calibration?.by_position?.[position] ?? []           // Pitfall 6
  return all.filter((b) => b.sample_n >= 5)                             // Pitfall 5: omit, do NOT zero
}, [data.calibration, position])
```

**Extension — TWO new `useMemo`s alongside `chartData` (do NOT modify `chartData` filter)** (Pitfall 5; UI-SPEC §Sparse-bucket Filter):
```tsx
const xptsData = useMemo<CalibrationBucket[]>(() => {
  const all = data.calibration?.by_position?.[position] ?? []
  return all.filter(
    (b) => b.sample_n >= 5 && b.predicted_mean != null && b.actual_mean != null,
  )
}, [data.calibration, position])

const maxPredictedMean = useMemo(() => {
  if (xptsData.length === 0) return 1                                    // Pitfall 4: empty -> default 1
  return Math.max(...xptsData.map((b) => b.predicted_mean ?? 0))
}, [xptsData])
```

**Existing chart-block pattern to mirror** (lines 301–354):
```tsx
<div
  data-testid="calibration-chart"
  className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-3 relative"
>
  <ResponsiveContainer width="100%" height={288}>
    <ComposedChart data={chartData}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
      <XAxis type="number" dataKey="bucket_mid" domain={[0, 1]} ticks={[0,0.2,0.4,0.6,0.8,1.0]}
             tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
             tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} />
      <YAxis type="number" domain={[0, 1]} ticks={[0,0.2,0.4,0.6,0.8,1.0]}
             tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
             tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} width={40} />
      <Tooltip content={CalibrationTooltip} />
      <ReferenceLine
        segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        stroke="rgba(161,161,170,0.5)" strokeDasharray="4 4" strokeWidth={1}
        ifOverflow="extendDomain"
      />
      <Line type="monotone" dataKey="actual_rate" stroke="currentColor" strokeWidth={2}
            dot={{ r: 3, fill: 'currentColor' }} activeDot={{ r: 5 }}
            connectNulls={false} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>
  {chartData.length === 0 && (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Insufficient sample (n&lt;5) for {positionLabel(position)} this window.
      </p>
    </div>
  )}
</div>
```

**Extension — clone the block below the existing one with these swaps (UI-SPEC §Chart Specification + RESEARCH.md Pattern 2):**

| Element | Existing (haul-rate) | New (xPts-mean) |
|---------|---------------------|-----------------|
| Container `data-testid` | `calibration-chart` | `calibration-xpts-chart` |
| Vertical gap | (none — first chart) | `mt-12` (48px / 2xl token) |
| Section heading | `Calibration Reliability` | `Predicted vs Actual xPts` |
| Description | "decile vs actual haul rate ... above = under-confidence" | "decile mean vs actual points mean ... above = over-prediction, below = under-prediction" (UI-SPEC) |
| Legend swatch label 1 | `Actual haul rate` | `Actual mean pts` |
| `XAxis dataKey` | `bucket_mid` | `predicted_mean` |
| `XAxis domain` | `[0, 1]` (hardcoded) | **omit** (auto-domain — Pitfall 1 + Don't Hand-Roll) |
| `XAxis ticks` | `[0,0.2,...,1.0]` (hardcoded) | **omit** |
| `XAxis tickFormatter` | `${Math.round(v*100)}%` | `v.toFixed(1)` |
| `YAxis domain/ticks` | `[0,1]` + hardcoded ticks | **omit** (auto-domain) |
| `YAxis tickFormatter` | `${Math.round(v*100)}%` | `v.toFixed(1)` |
| `Tooltip content` | `CalibrationTooltip` | `XptsTooltip` |
| `ReferenceLine segment` | `[{x:0,y:0},{x:1,y:1}]` | `[{x:0,y:0},{x:maxPredictedMean,y:maxPredictedMean}]` |
| `Line dataKey` | `actual_rate` | `actual_mean` |
| Empty-state condition | `chartData.length === 0` | `xptsData.length === 0` |

All other props (`type="number"`, `axisLine={false}`, `width={40}`, dot/activeDot styling, `strokeDasharray`, `ifOverflow="extendDomain"`, `isAnimationActive={false}`) are **identical** — copy verbatim.

**Render-site (line 825):** No change. Existing guard `{data.calibration && <CalibrationSection data={data} />}` already gates the whole section.

**`PositionTabSelector`:** No duplication. Single shared `position` state in `CalibrationSection` drives both `chartData` and `xptsData` `useMemo` deps (D-02).

---

### 5. `src/components/accuracy/AccuracyTab.test.tsx` — extend calibration tests

**Analog:** `src/components/accuracy/AccuracyTab.test.tsx` lines 73–110 (fixture) + lines 257–340 (test block)

**Imports + mocking (no change):** vitest, RTL, `useAccuracy` mock, `useDataHealth` mock, `AccuracyBacktest` import — all present.

**Existing fixture pattern to extend** (lines 73–110):
```tsx
const fixtureWithVersionsAndCalibration: AccuracyBacktest = {
  ...fixtureBacktest,
  versions: [/* ... */],
  calibration: {
    by_position: {
      all: [
        { bucket_mid: 0.05, predicted_rate: 0.05, actual_rate: 0.04, sample_n: 25 },
        { bucket_mid: 0.15, predicted_rate: 0.15, actual_rate: 0.12, sample_n: 25 },
        { bucket_mid: 0.25, predicted_rate: 0.25, actual_rate: 0.22, sample_n: 25 },
        { bucket_mid: 0.95, predicted_rate: 0.95, actual_rate: 0.88, sample_n: 25 },
      ],
      '1': [],
      '2': [/* ... */], '3': [/* ... */], '4': [/* ... */],
    },
  },
}
```

**Extension — add a NEW fixture `fixtureWithXptsMeans` that mixes new-shape + legacy buckets** (RESEARCH.md §Code Examples; Pitfall 5 test coverage):
```tsx
const fixtureWithXptsMeans: AccuracyBacktest = {
  ...fixtureBacktest,
  versions: fixtureWithVersionsAndCalibration.versions,
  calibration: {
    by_position: {
      all: [
        { bucket_mid: 0.05, predicted_rate: 0.05, actual_rate: 0.04, sample_n: 25,
          predicted_mean: 7.20, actual_mean: 6.50 },
        { bucket_mid: 0.15, predicted_rate: 0.15, actual_rate: 0.12, sample_n: 25,
          predicted_mean: 5.80, actual_mean: 5.10 },
        { bucket_mid: 0.95, predicted_rate: 0.95, actual_rate: 0.88, sample_n: 25,
          predicted_mean: 1.50, actual_mean: 1.80 },
        // Legacy bucket — sample_n>=5 but new fields missing. Filter MUST drop from xPts chart, KEEP in haul-rate chart.
        { bucket_mid: 0.55, predicted_rate: 0.55, actual_rate: 0.40, sample_n: 25 },
      ],
      '1': [], '2': [], '3': [], '4': [],
    },
  },
}
```

**Existing render-test pattern to mirror** (lines 292–301):
```tsx
it('CAL-01: CalibrationSection renders heading, X-axis label, and chart container when data.calibration present', () => {
  mockedUseAccuracy.mockReturnValue({ data: fixtureWithVersionsAndCalibration, isLoading: false, error: null } as never)
  const { getByText, container } = render(<AccuracyTab />)
  expect(getByText('Calibration Reliability')).toBeTruthy()
  expect(getByText(/Actual haul rate/)).toBeTruthy()
  expect(getByText(/Perfect calibration/)).toBeTruthy()
  expect(container.querySelector('[data-testid="calibration-chart"], .recharts-responsive-container')).toBeTruthy()
})
```

**Extensions — add ≥4 new test cases mirroring this shape** (RESEARCH.md §Wave 0 Gaps; UI-SPEC §Copywriting Contract):
1. **Container test:** `container.querySelector('[data-testid="calibration-xpts-chart"]')` is truthy
2. **Legacy filter test:** count `.recharts-line-dot` inside `[data-testid="calibration-xpts-chart"]` — must be 3, not 4 (legacy bucket without `predicted_mean` is filtered)
3. **Heading copy test:** `getByText('Predicted vs Actual xPts')` truthy
4. **Single-selector test:** click GK pill, assert both `[data-testid="calibration-chart"]` and `[data-testid="calibration-xpts-chart"]` re-render with `position='1'` data
5. **Empty-state test:** in GK position with empty array, assert `Insufficient sample` overlay appears in xPts chart

**Existing empty-state pattern to mirror** (lines 322–331):
```tsx
const tablist = container.querySelector('[role="tablist"][aria-label="Calibration position filter"]')
const gkTab = tablist!.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement
fireEvent.click(gkTab)
expect(getByText(/Insufficient sample \(n<5\) for GK this window\./)).toBeTruthy()
```

---

## Shared Patterns

### Sparse-bucket filter (component-edge, NOT pipeline)
**Source:** `src/components/accuracy/AccuracyTab.tsx:275–278` (existing `chartData` `useMemo`)
**Apply to:** Both `chartData` (existing) and `xptsData` (new) — TWO separate `useMemo`s, do NOT mutate the existing one (Pitfall 5).
**Rule:** Pipeline writes everything; UI decides what to render. Do not push the filter into Python.

### Optional-field guard (legacy-cache compat)
**Source:** D-06 / Pitfall 3
**Apply to:** Every UI access of `predicted_mean` / `actual_mean`.
**Rule:**
- TS interface: optional (`?:`)
- `useMemo` filter: `b.predicted_mean != null && b.actual_mean != null`
- Tooltip render: early return on null
- Test fixture: include at least one legacy-shape bucket to prove the filter

### Recharts auto-domain pattern
**Source:** RESEARCH.md Pattern 2; UI-SPEC §Axes
**Apply to:** xPts chart only (haul-rate chart keeps its hardcoded `[0,1]`).
**Rule:** Omit `domain` and `ticks` props — recharts auto-derives from `dataKey` values when `type="number"` is set. Pitfall 1: `type="number"` is REQUIRED on both axes.

### `ReferenceLine segment` with dynamic endpoint
**Source:** `AccuracyTab.tsx:329–335` (existing) + `node_modules/recharts/types/cartesian/ReferenceLine.d.ts` (verified API)
**Apply to:** xPts chart's y=x diagonal.
**Rule:**
- Endpoint via `useMemo`: `Math.max(...xptsData.map(b => b.predicted_mean ?? 0))`
- Empty-array default: `1` (Pitfall 4 — `Math.max(...[])` returns `-Infinity`)
- Always set `ifOverflow="extendDomain"` (already used by haul-rate chart)

### Floating-point fixture stability
**Source:** RESEARCH.md Pitfall 7
**Apply to:** All pipeline calibration arithmetic AND tests.
**Rule:**
- Pipeline: `round(sum / total, 2)` — matches UI `toFixed(2)` display
- Tests: `pytest.approx(value, abs=0.01)` — never bare `==` on floats

### No new dependencies
**Source:** RESEARCH.md §Standard Stack; UI-SPEC §Registry Safety
**Apply to:** All plans.
**Rule:**
- Do NOT install `@types/recharts` (Pitfall 2 — v1 incompatible with recharts v3)
- No new npm packages, no new Python packages
- No new recharts imports (`ComposedChart`, `Line`, `ReferenceLine`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `TooltipContentProps` already imported)

### Commit hygiene (project-level)
**Source:** `CLAUDE.md`
**Apply to:** Every commit Wave 0 / Wave 1 / Wave 2.
**Rule:** Do NOT add `Co-Authored-By` trailer.

### Next.js surface untouched
**Source:** `AGENTS.md`
**Apply to:** All UI work.
**Rule:** Phase 91 edits one client component (`'use client'` already at `AccuracyTab.tsx:1`) and no Next.js routing/middleware/server-component surface. The directive is satisfied by not touching Next.js APIs.

---

## No Analog Found

| File | Reason |
|------|--------|
| (none) | Every Phase 91 file change has an exact existing analog in the same file. The phase is a literal extension of Phase 63. |

---

## Metadata

**Analog search scope:**
- `pipeline/accuracy.py` (lines 440–547)
- `pipeline/tests/test_accuracy.py` (lines 1–80, 440–552)
- `src/lib/types.ts` (lines 440–470)
- `src/components/accuracy/AccuracyTab.tsx` (lines 1–60, 200–360, 820–832)
- `src/components/accuracy/AccuracyTab.test.tsx` (lines 1–120, 240–340)

**Files scanned:** 5 (all already known from CONTEXT.md; no Glob/Grep needed — every analog is the file's own prior implementation)

**Pattern extraction date:** 2026-05-10

**Confidence:** HIGH — every code excerpt is a direct copy from a verified file location. The phase introduces zero novel mechanisms; the pattern map is "copy from line N, swap these dataKeys".
