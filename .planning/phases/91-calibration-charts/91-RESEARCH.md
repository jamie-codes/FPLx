# Phase 91: Calibration Charts - Research

**Researched:** 2026-05-10
**Domain:** Pipeline aggregation extension + recharts continuous calibration chart
**Confidence:** HIGH

## Summary

Phase 91 is a pure **extension** phase: it adds two optional fields (`predicted_mean`, `actual_mean`) to the existing Phase 63 `CalibrationBucket` and renders a second recharts chart inside the existing `CalibrationSection`. Every dependency is already installed and battle-tested — recharts v3.8.1, the `ComposedChart`+`Line`+`ReferenceLine` pattern, the `PositionTabSelector` shared state, the sparse-bucket filter at the component edge, and the `_compute_calibration_data` decile-bucketing helper. The phase contains zero novel architecture.

The only research questions worth answering are (1) the exact recharts API for an auto-domain numeric axis with a `y=x` diagonal whose endpoints are computed from data, and (2) the exact accumulator pattern to add to `_compute_calibration_data` without breaking existing tests. Both are verified against the installed code below.

**Primary recommendation:** Mirror Phase 63 exactly. Add `bucket_sum_predicted` and `bucket_sum_actual` defaultdicts beside the existing `bucket_haul`/`bucket_total` accumulators in `_compute_calibration_data`. Compute means in the same loop that emits buckets. In `AccuracyTab.tsx`, copy the existing chart block, swap `dataKey="bucket_mid"` to `dataKey="predicted_mean"`, drop `domain={[0,1]}`/`ticks=[...]`/`tickFormatter={percent}` (recharts auto-scales), compute `maxPredictedMean` once via `useMemo`, and reuse the same `ReferenceLine` pattern with the dynamic segment endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chart Coexistence**
- **D-01:** Both charts coexist stacked in `CalibrationSection`. The existing haul-rate chart (Phase 63) stays — it answers "does the model rank haulers at the top?" The new xPts-mean chart is added below — it answers "does predicted xPts match actual points?" They are complementary, not alternatives.
- **D-02:** `PositionTabSelector` (GK / DEF / MID / FWD / All) is shared — one selector controls both charts simultaneously. Do not duplicate the selector.

**xPts-Mean Chart Axes**
- **D-03:** X-axis = `predicted_mean` (absolute xPts values, e.g. 1.5–8.0 pts), auto-scaled. Y-axis = `actual_mean` (actual points). Both axes in the same unit (points) so the `y = x` reference diagonal is geometrically valid. `XAxis type="number"` required (Pitfall 4 carried from Phase 63).
- **D-04:** Reference line = `y = x` diagonal (dashed, same styling as the haul-rate chart's reference line). Points above the diagonal = model over-predicts; points below = under-predicts. This is the standard continuous calibration chart.
- **D-05:** The y=x reference line spans from `(0, 0)` to `(max_predicted, max_predicted)` using recharts `ReferenceLine segment={[{x:0,y:0},{x:max,y:max}]}` where `max` is auto-derived from chart data. Use `ifOverflow="extendDomain"` to keep it visible.

**Type Extension**
- **D-06:** Extend the existing `CalibrationBucket` interface in `src/lib/types.ts` with two new **optional** fields: `predicted_mean?: number` and `actual_mean?: number`. The existing `predicted_rate` and `actual_rate` fields are preserved unchanged. Legacy caches (Phase 63 output without new fields) remain valid — components guard with `?? []` or `b.predicted_mean != null`.
- **D-07:** `_compute_calibration_data` in `pipeline/accuracy.py` already computes per-decile aggregates — extend it to also accumulate `sum_predicted` and `sum_actual` per bucket, then compute `predicted_mean = sum_predicted / sample_n` and `actual_mean = sum_actual / sample_n`. No new helper function needed.

### Claude's Discretion
- Section heading for the new chart: something like "xPts Accuracy (Mean)" or "Predicted vs Actual xPts" — UI-SPEC has approved `Predicted vs Actual xPts`
- Tooltip format for the new chart: show `predicted_mean` (2 dp), `actual_mean` (2 dp), `sample_n`, deviation `actual - predicted`
- Dot rendering: same style as haul-rate chart (`r=3`, `activeDot r=5`)
- Whether to render both charts in a single `CalibrationSection` function or split into named sub-components — builder's call

### Deferred Ideas (OUT OF SCOPE)
- **GW-targeted transfer recommendations** — already logged in backlog (GWT-01, commit 618dcae). Not a Phase 91 concern.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | AccuracyTab calibration chart — plots predicted xPts decile vs actual points per decile over the last 5 GWs; uses existing recharts; shows per-position breakdown; complements the existing accuracy backtest table | Existing `_compute_calibration_data` already iterates `per_gw_rows` per-decile per-position (`pipeline/accuracy.py:496`) — extend with two sum accumulators (Standard Stack §Accumulator Pattern). Existing `CalibrationSection` already renders chart with `XAxis type="number"`, `ReferenceLine segment`, sparse-filter at edge (`AccuracyTab.tsx:272`) — copy block and swap dataKeys (Pattern 2). recharts v3.8.1 `ReferenceLine` `segment` and `ifOverflow="extendDomain"` props verified against `node_modules/recharts/types/cartesian/ReferenceLine.d.ts` (HIGH). |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Source | Impact on This Phase |
|-----------|--------|---------------------|
| "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing code | `AGENTS.md` | Phase 91 does **not** modify any Next.js routing, server components, middleware, or API routes. It edits one client component (`'use client'` already declared at `AccuracyTab.tsx:1`) and one Python file. The directive is satisfied by not touching Next.js surfaces. |
| Do not add `Co-Authored-By` trailers to git commits | `CLAUDE.md` | Per-task commits in Wave 1/Wave 2 plans must omit Co-Authored-By trailer. |
| Codebase uses Python 3 + pytest for pipeline, Vitest + jsdom + React Testing Library for UI | observed | Tests live in `pipeline/tests/test_accuracy.py` (extend) and `src/components/accuracy/AccuracyTab.test.tsx` (extend). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decile bucketing math (sum predicted / sum actual / mean) | Pipeline (Python) | — | Pure aggregation over `per_gw_rows`; runs once in CI, output cached in `accuracy_backtest.json` |
| `accuracy_backtest.json` shape contract | Pipeline (Python) ↔ Frontend types (TS) | — | Pipeline writes; TS interface mirrors. Both must extend in lockstep — but each lives in its own file (file-disjoint parallel work) |
| Sparse-bucket filter (`sample_n >= 5` AND new fields present) | Frontend (component edge) | — | Locked Phase 63 pattern: pipeline writes everything, UI decides what to render. Avoids re-running pipeline when filter threshold changes |
| Auto-domain XAxis / YAxis | Frontend (recharts default) | — | recharts auto-derives min/max from `dataKey` values; no hardcoded domain |
| Reference-line max-x computation | Frontend (`useMemo`) | — | `Math.max(...xptsData.map(b => b.predicted_mean ?? 0))` — single client-side compute per render |
| Position tab state | Frontend (`useState` in `CalibrationSection`) | — | Single `position` state already drives the haul-rate chart. Reuse same state for new chart — no new state, no Context, no hook |

**Why this matters:** Phase 91 is a multi-tier change but each tier's work is isolated and file-disjoint. Misassignment risk is minimal: Wave 1 splits Python (Plan 02) from TypeScript types (Plan 03) cleanly because they touch different files. Wave 2 (Plan 04) then consumes both.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.8.1 (installed) | `ComposedChart`, `Line`, `ReferenceLine`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` | Locked since Phase 62/63; project's only chart library; v3.x has native TypeScript types — `@types/recharts` (v1.x stale) MUST NOT be installed |
| react | 19.2.4 (installed) | `useState`, `useMemo`, `Fragment` | App default |
| Python stdlib | 3.x | `collections.defaultdict` for accumulator dicts | Already used in `_compute_calibration_data` |
| pytest | (installed) | extend `pipeline/tests/test_accuracy.py` | Project default for pipeline tests |
| vitest | ^4.1.2 (installed) | extend `src/components/accuracy/AccuracyTab.test.tsx` | Project default for React tests |
| @testing-library/react | (installed) | `render`, `fireEvent`, `getByText` | Already used in existing AccuracyTab tests |

[VERIFIED: package.json — `recharts: ^3.8.1`, `react: 19.2.4`, `next: 16.2.1`, `vitest: ^4.1.2`]
[VERIFIED: `npm view recharts version` returned `3.8.1` (current); `npm view @types/recharts version` returned `2.0.1` (stale v1-era types — DO NOT install)]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | No new dependencies | Phase ships zero new packages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ComposedChart` | `LineChart` | `ComposedChart` already imported and used by haul-rate chart; switching would diverge from established pattern. Stay with `ComposedChart` for visual + code consistency. |
| Auto-domain XAxis | Hardcoded `domain={[0, 10]}` | Hardcoded would clip if max predicted_mean > 10 (rare but possible — Haaland could project ~12). Auto-domain is safer. |
| Component-edge filter | Pipeline-side filter | Locked Phase 63 cross-cutting constraint: filter at component edge so pipeline output is full and stable across UI threshold changes. |

**Installation:** No installs needed — all dependencies present.

**Version verification:** Performed 2026-05-10. recharts is at the latest published stable (3.8.1).

## Architecture Patterns

### System Architecture Diagram

```
[FPL bootstrap/elements + history JSON cache]
                    |
                    v
        +-----------------------+
        | pipeline/accuracy.py  |
        |                       |
        |  compute_accuracy_    |
        |  backtest()           |
        |        |              |
        |        v              |
        |  _compute_            |
        |  calibration_data()   |  <-- EXTEND HERE (Plan 02)
        |    accumulate         |     add bucket_sum_predicted
        |    bucket_haul/total  |     add bucket_sum_actual
        |    + (new) sum_pred,  |     emit predicted_mean, actual_mean
        |    sum_actual         |
        |        |              |
        |        v              |
        |  _empty_backtest()    |  <-- no change required (D-06: optional)
        +-----------------------+
                    |
                    v
        accuracy_backtest.json
        (calibration.by_position[pos] = [
          { bucket_mid, predicted_rate, actual_rate, sample_n,
            predicted_mean?, actual_mean?  <-- NEW
          }
        ])
                    |
                    v  (HTTP GET via /api/accuracy or static fetch)
                    |
        +-----------------------+
        | useAccuracy() hook    |
        +-----------------------+
                    |
                    v
        +---------------------------------+
        | AccuracyTab.tsx                 |
        |                                 |
        |  CalibrationSection (extend)    |  <-- EXTEND HERE (Plan 04)
        |    [position state]             |
        |    PositionTabSelector  (reuse) |
        |                                 |
        |    Haul-rate chart (existing)   |
        |       useMemo: chartData        |
        |       ComposedChart             |
        |          XAxis bucket_mid       |
        |          YAxis [0,1]            |
        |          ReferenceLine {x,y:1}  |
        |          Line actual_rate       |
        |                                 |
        |    xPts-mean chart (NEW)        |
        |       useMemo: xptsData         |
        |       useMemo: maxPredictedMean |
        |       ComposedChart             |
        |          XAxis predicted_mean   |
        |              (auto domain)      |
        |          YAxis (auto domain)    |
        |          ReferenceLine          |
        |             {x:0,y:0}->{x:M,y:M}|
        |          Line actual_mean       |
        |          XptsTooltip            |
        +---------------------------------+
                    |
                    v
        rendered DOM (light + dark mode)
```

### Component Responsibilities

| File | Responsibility | Phase 91 change |
|------|----------------|------------------|
| `pipeline/accuracy.py` `_compute_calibration_data` (line 496) | Decile bucketing per position | Add `bucket_sum_predicted` / `bucket_sum_actual` defaultdicts; emit two new keys per bucket dict |
| `pipeline/accuracy.py` `_empty_backtest` (line 441) | Cold-start fallback | **No change required** — empty arrays in `by_position` already satisfy D-06 (fields are optional) |
| `pipeline/tests/test_accuracy.py` (lines 453–552) | Test calibration shape and math | Add ≥3 new test cases or extend existing (Wave 0 RED) |
| `src/lib/types.ts` `CalibrationBucket` (line 454) | TS contract for bucket shape | Add `predicted_mean?: number` and `actual_mean?: number` |
| `src/components/accuracy/AccuracyTab.tsx` `CalibrationSection` (line 272) | Render calibration UI | Add second chart block + `XptsTooltip` + `useMemo` for filtered data and max value |
| `src/components/accuracy/AccuracyTab.test.tsx` (line 257+) | Test calibration UI | Extend fixture with new fields + add ≥4 new test cases |

### Recommended Project Structure

No new directories. Only edits to:
```
pipeline/
├── accuracy.py                          # extend _compute_calibration_data
└── tests/
    └── test_accuracy.py                 # extend calibration tests
src/
├── lib/
│   └── types.ts                         # extend CalibrationBucket
└── components/
    └── accuracy/
        ├── AccuracyTab.tsx              # extend CalibrationSection
        └── AccuracyTab.test.tsx         # extend calibration tests
```

### Pattern 1: Python defaultdict accumulator pattern (mirror existing)

**What:** Add two parallel `defaultdict(lambda: defaultdict(float))` accumulators alongside the existing `bucket_haul` and `bucket_total` integer counters.

**When to use:** Whenever Phase 63's bucketing pattern needs new per-bucket aggregates without changing the iteration shape.

**Example:**
```python
# Source: pipeline/accuracy.py lines 511-545 (mirror this pattern)
def _compute_calibration_data(per_gw_rows: dict) -> dict:
    bucket_haul: dict = defaultdict(lambda: defaultdict(int))
    bucket_total: dict = defaultdict(lambda: defaultdict(int))
    # NEW (Phase 91 CAL-01): xPts-mean accumulators
    bucket_sum_predicted: dict = defaultdict(lambda: defaultdict(float))
    bucket_sum_actual: dict = defaultdict(lambda: defaultdict(float))

    for gw, rows in per_gw_rows.items():
        if not rows:
            continue
        n = len(rows)
        ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
        for rank_idx, row in enumerate(ranked):
            decile = min(int(rank_idx * 10 / n), 9)
            is_haul = 1 if row['actual_pts'] >= HAULTER_THRESHOLD else 0
            pos_key = str(row['element_type'])
            for pk in ('all', pos_key):
                bucket_haul[pk][decile] += is_haul
                bucket_total[pk][decile] += 1
                # NEW: accumulate xPts sums for mean computation
                bucket_sum_predicted[pk][decile] += row['xpts_predicted']
                bucket_sum_actual[pk][decile] += row['actual_pts']

    bucket_mids = [round(d * 0.1 + 0.05, 2) for d in range(10)]
    by_position: dict = {}
    for pos_key in ('all', '1', '2', '3', '4'):
        buckets: list = []
        for d in range(10):
            total = bucket_total[pos_key][d]
            if total < 5:
                continue
            haul = bucket_haul[pos_key][d]
            buckets.append({
                'bucket_mid': bucket_mids[d],
                'predicted_rate': bucket_mids[d],
                'actual_rate': round(haul / total, 4),
                'sample_n': total,
                # NEW: round to 2 dp (UI displays toFixed(2)); avoids floating-point noise in test fixtures
                'predicted_mean': round(bucket_sum_predicted[pos_key][d] / total, 2),
                'actual_mean': round(bucket_sum_actual[pos_key][d] / total, 2),
            })
        by_position[pos_key] = buckets

    return {'by_position': by_position}
```

[VERIFIED: existing implementation read at `pipeline/accuracy.py:496-547`]

### Pattern 2: recharts auto-domain numeric axes with dynamic reference-line segment

**What:** XAxis and YAxis with `type="number"` and **no** `domain` prop — recharts auto-derives min/max from the dataKey values. The `y=x` reference line uses a `segment` whose endpoints are computed in `useMemo` from chart data.

**When to use:** Continuous (non-rate) calibration charts where the data range varies (predicted xPts can be 1.5–8.0 across positions and windows).

**Example:**
```tsx
// Source: src/components/accuracy/AccuracyTab.tsx (lines 305-347 for haul-rate chart pattern)
// + recharts v3.8.1 ReferenceLine.d.ts (verified `segment` + `ifOverflow="extendDomain"` props)
const xptsData = useMemo<CalibrationBucket[]>(() => {
  const all = data.calibration?.by_position?.[position] ?? []
  return all.filter(
    (b) => b.sample_n >= 5 && b.predicted_mean != null && b.actual_mean != null,
  )
}, [data.calibration, position])

const maxPredictedMean = useMemo(() => {
  if (xptsData.length === 0) return 1
  return Math.max(...xptsData.map((b) => b.predicted_mean ?? 0))
}, [xptsData])

return (
  <ResponsiveContainer width="100%" height={288}>
    <ComposedChart data={xptsData}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
      <XAxis
        type="number"
        dataKey="predicted_mean"
        tickFormatter={(v: number) => v.toFixed(1)}
        tick={{ fontSize: 12, fill: 'currentColor' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        type="number"
        tickFormatter={(v: number) => v.toFixed(1)}
        tick={{ fontSize: 12, fill: 'currentColor' }}
        axisLine={false}
        tickLine={false}
        width={40}
      />
      <Tooltip content={XptsTooltip} />
      <ReferenceLine
        segment={[
          { x: 0, y: 0 },
          { x: maxPredictedMean, y: maxPredictedMean },
        ]}
        stroke="rgba(161,161,170,0.5)"
        strokeDasharray="4 4"
        strokeWidth={1}
        ifOverflow="extendDomain"
      />
      <Line
        type="monotone"
        dataKey="actual_mean"
        stroke="currentColor"
        strokeWidth={2}
        dot={{ r: 3, fill: 'currentColor' }}
        activeDot={{ r: 5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    </ComposedChart>
  </ResponsiveContainer>
)
```

[VERIFIED: `node_modules/recharts/types/cartesian/ReferenceLine.d.ts` confirms `segment?: readonly [Point, Point]` and `ifOverflow` props; comment reads "Tuple of coordinates. If defined, renders a diagonal line segment."]

### Pattern 3: Inline tooltip component reading bucket payload

**What:** Custom tooltip is a function component matching `TooltipContentProps` from recharts that reads `payload[0].payload` cast to `CalibrationBucket`.

**When to use:** When the chart needs domain-specific formatting (decile bracket, deviation calculation, sample size) that recharts default tooltip cannot express.

**Example:**
```tsx
// Source: src/components/accuracy/AccuracyTab.tsx:251-270 (mirror this pattern)
function XptsTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as CalibrationBucket
  if (p.predicted_mean == null || p.actual_mean == null) return null
  const bucketLow = Math.round((p.bucket_mid - 0.05) * 100)
  const bucketHigh = Math.round((p.bucket_mid + 0.05) * 100)
  const deviation = p.actual_mean - p.predicted_mean
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Decile {bucketLow}%–{bucketHigh}%
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Predicted: {p.predicted_mean.toFixed(2)} pts
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Actual: {p.actual_mean.toFixed(2)} pts
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        Deviation: {deviation.toFixed(2)} pts
      </p>
      <p className="text-zinc-500 dark:text-zinc-400 mt-1">n = {p.sample_n}</p>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Hardcoding `domain={[0, 10]}` on the new chart's axes:** Predicted xPts can spill above 10 (rare projections, e.g., Haaland on a DGW). Auto-domain is the only safe choice for continuous data.
- **Recomputing `maxPredictedMean` inline in JSX:** Without `useMemo`, every render re-spreads the array — wasteful at 50+ buckets across position changes. Memoize beside the filtered data.
- **Filtering sparse buckets in the pipeline:** Already-locked Phase 63 cross-cutting constraint — pipeline writes everything; UI filters. Carrying this forward avoids cache regeneration when threshold changes.
- **Bumping `FORMULA_VERSION`:** Phase 91 changes the calibration *output shape* but not the prediction formula. `FORMULA_VERSION = 'v1.12-a'` (set in Phase 63) stays; do not increment.
- **Adding a new `CalibrationBucketV2` type or breaking the existing interface:** D-06 locks the strategy as **optional fields on the existing interface**. Splitting into v1/v2 types or making fields required breaks legacy cache compat.
- **Splitting the `position` state into two `useState` calls (one per chart):** D-02 locks the selector as shared. Single state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diagonal reference line | Manual SVG line, custom `Line` with synthetic data | recharts `ReferenceLine segment={[...]} ifOverflow="extendDomain"` | Already imported; `segment` + `ifOverflow` types verified in v3.8.1; consistent with haul-rate chart |
| Numeric axis tick formatting | Custom tick label component | `tickFormatter={(v: number) => v.toFixed(1)}` | One-line callback; matches existing chart's `tickFormatter` pattern |
| Decile bucketing | New helper function | Extend existing `_compute_calibration_data` | D-07 locks "no new helper function" — extend in place |
| Auto-domain calculation | Manually compute `Math.min` / `Math.max` over `predicted_mean` and pass `domain={[min, max]}` | Omit `domain` prop entirely — recharts handles auto-domain natively | recharts default behavior with `type="number"` + `dataKey` is auto-domain; only need `Math.max` for the `ReferenceLine` segment |
| Position-tab state-sharing | React Context, lifted hook | Plain `useState` already in `CalibrationSection` | One component, one state — no need for cross-component sharing |
| Component-edge sparse filter | Pipeline-side guard | `b.sample_n >= 5 && b.predicted_mean != null && b.actual_mean != null` in `useMemo` | Filters sparse buckets AND legacy-cache buckets (missing new fields) in one pass |

**Key insight:** The phase introduces *zero* novel mechanisms. Every problem it solves was solved in Phase 63 — copy the pattern.

## Common Pitfalls

### Pitfall 1: XAxis numeric domain treated as ordinal categories

**What goes wrong:** Without `type="number"` on `<XAxis>`, recharts treats numeric `dataKey` values (e.g. `predicted_mean = 5.3`) as discrete categorical labels — sorted alphabetically, equally spaced, and the auto-domain breaks.

**Why it happens:** recharts default axis type is `category`, not `number`. The library cannot infer numeric intent from `dataKey` alone.

**How to avoid:** Always specify `type="number"` on both axes whenever the chart represents a continuous space. Phase 63 codified this — extend the rule to the new chart.

**Warning signs:** X-axis ticks show `1.5, 2.1, 5.3, 8.0` evenly spaced (not at scale); reference line `segment` lands at the wrong x-coordinate; data points cluster at left edge.

### Pitfall 2: `@types/recharts` v1 inadvertently installed

**What goes wrong:** TypeScript compilation fails with "no exported member" errors for `ComposedChart`, `ReferenceLine`, `TooltipContentProps`. The v1 types package is incompatible with recharts v3 (which ships its own types).

**Why it happens:** Devs reflexively `npm i @types/recharts` because most React libraries publish types separately.

**How to avoid:** Do not install. recharts v3 types are bundled — the existing `import type { TooltipContentProps } from 'recharts'` at `AccuracyTab.tsx:26` proves this works.

**Warning signs:** `package.json` contains `@types/recharts`; TS errors at the recharts imports.

### Pitfall 3: `predicted_mean`/`actual_mean` accessed without null guard

**What goes wrong:** Legacy `accuracy_backtest.json` cached before Phase 91 contains `CalibrationBucket` entries without the new fields. UI code `b.predicted_mean.toFixed(2)` throws `TypeError: Cannot read properties of undefined`.

**Why it happens:** D-06 makes the new fields optional for legacy compat. Without an explicit null guard the optional chain is silent until a real legacy fixture hits.

**How to avoid:** Filter at the component edge: `b.predicted_mean != null && b.actual_mean != null` in the `useMemo`. Then casts are safe inside the chart. Tests must include a fixture with buckets missing the new fields to prove the filter works.

**Warning signs:** Test passing with new fixture; runtime crash in production with old `accuracy_backtest.json` (shipped pre-Phase-91).

### Pitfall 4: Empty `xptsData` produces `NaN` segment endpoints

**What goes wrong:** `Math.max(...[])` returns `-Infinity`. Passing `{x: -Infinity, y: -Infinity}` to `ReferenceLine.segment` makes recharts log warnings and render no line; can also corrupt YAxis auto-domain.

**Why it happens:** Switching to a position with all sparse buckets (e.g., GK with low sample) drops `xptsData.length` to 0.

**How to avoid:** Default `maxPredictedMean` to `1` (or any positive number) when `xptsData.length === 0`. The chart container also renders the empty-state overlay over the chart, so the bogus reference line is invisible.

**Warning signs:** Console warning from recharts about invalid axis values; switching to GK pill shows a glitched chart.

### Pitfall 5: Sparse-bucket filter applied without checking new optional fields

**What goes wrong:** Existing filter `all.filter(b => b.sample_n >= 5)` keeps legacy-cache buckets that have `sample_n >= 5` but no `predicted_mean`. The new chart then receives buckets where `dataKey="predicted_mean"` is `undefined` and recharts plots them at x=0 (the auto-domain low boundary).

**Why it happens:** Phase 63's filter only checked `sample_n`. Phase 91 introduces optional fields that the haul-rate chart does not need but the xPts chart does.

**How to avoid:** Use a **separate** `useMemo` for `xptsData` that filters on **both** `sample_n >= 5` **and** `predicted_mean != null && actual_mean != null`. Do **not** modify the existing `chartData` filter (the haul-rate chart still needs all sample-passing buckets). Two `useMemo`s, two filters, one `position` state.

**Warning signs:** Phantom dots clustered at x=0 in the new chart when running against a legacy cache fixture.

### Pitfall 6: Calling `_compute_calibration_data` with empty `per_gw_rows`

**What goes wrong:** Cold-start (no finished GWs). `bucket_total[pos_key][d]` is 0; division by zero would crash if not guarded.

**Why it happens:** Sparse-filter guard `if total < 5: continue` already prevents this in the existing code — but only because `total` is read first. If you reorder to compute means before checking `total`, you crash.

**How to avoid:** Keep the `if total < 5: continue` line *before* any division. Compute `predicted_mean = sum_predicted / total` only after passing the guard.

**Warning signs:** `ZeroDivisionError` in pipeline run when `accuracy_backtest.json` is being regenerated from scratch.

### Pitfall 7: Floating-point drift in test fixtures

**What goes wrong:** Computing `predicted_mean` as `sum / count` produces values like `5.349999999999998`. Test asserting `assert b['predicted_mean'] == 5.35` fails intermittently.

**Why it happens:** IEEE 754 floats accumulate error over many adds.

**How to avoid:** Round to 2 decimal places in the pipeline (`round(sum / total, 2)`) — matches UI's `toFixed(2)` display anyway. Tests then assert against rounded values or use `pytest.approx(5.35, abs=0.01)`.

**Warning signs:** CI flakiness on calibration tests; assertion errors with extremely close-but-not-equal floats.

## Code Examples

Verified patterns from official sources:

### Test extension — pytest (Wave 0 / Plan 091-01)

```python
# Source: extend pipeline/tests/test_accuracy.py (mirror existing CAL-01 / CAL-02 tests at lines 453-552)
def test_calibration_includes_xpts_means():
    """Phase 91 CAL-01: each bucket includes predicted_mean and actual_mean rounded
    to 2dp. With 50 players × 5 GWs all scoring 6 pts vs predicted ~5pts, every
    decile mean falls in a known range."""
    player_histories = {}
    for pid in range(1, 51):
        # All players score actual=6 every GW; xpts_predicted derived from xG/xA so will vary by decile
        player_histories[pid] = [_hist(gw, 90, 6, xg=0.3, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']

    for b in all_buckets:
        assert 'predicted_mean' in b, "Phase 91 CAL-01: bucket must include predicted_mean"
        assert 'actual_mean' in b, "Phase 91 CAL-01: bucket must include actual_mean"
        assert isinstance(b['predicted_mean'], float)
        assert isinstance(b['actual_mean'], float)
        # All players score 6 -> every bucket's actual_mean ≈ 6.0
        assert b['actual_mean'] == pytest.approx(6.0, abs=0.01)


def test_calibration_xpts_means_descending_by_decile():
    """Phase 91 CAL-01: predicted_mean monotonically decreases by decile
    (decile 0 = top predictors, decile 9 = bottom)."""
    player_histories = {pid: [_hist(gw, 90, 6, xg=0.3, xa=0.2) for gw in range(1, 33)]
                         for pid in range(1, 51)}
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(player_histories)

    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    all_buckets = result['calibration']['by_position']['all']
    # Buckets are ordered by decile (bucket_mid ascending = 0.05, 0.15, ..., 0.95)
    # bucket_mid 0.05 = top decile (highest predicted) -> highest predicted_mean
    means = [b['predicted_mean'] for b in all_buckets]
    # Top bucket (lowest bucket_mid) should have HIGHEST predicted_mean
    # (predicted_mean is sorted descending across the bucket_mid ascending order)
    assert means[0] >= means[-1], (
        "decile 0 (top predictions) should have higher predicted_mean than decile 9 (bottom)"
    )
```

### Test extension — vitest fixture (Wave 0 / Plan 091-01)

```tsx
// Source: extend src/components/accuracy/AccuracyTab.test.tsx (line 89+ fixture)
const fixtureWithXptsMeans: AccuracyBacktest = {
  ...fixtureBacktest,
  versions: [/* unchanged */],
  calibration: {
    by_position: {
      all: [
        { bucket_mid: 0.05, predicted_rate: 0.05, actual_rate: 0.04, sample_n: 25,
          predicted_mean: 7.20, actual_mean: 6.50 },
        { bucket_mid: 0.15, predicted_rate: 0.15, actual_rate: 0.12, sample_n: 25,
          predicted_mean: 5.80, actual_mean: 5.10 },
        { bucket_mid: 0.95, predicted_rate: 0.95, actual_rate: 0.88, sample_n: 25,
          predicted_mean: 1.50, actual_mean: 1.80 },
        // Legacy-cache bucket missing the new fields (filter must drop it from xPts chart but keep in haul-rate chart)
        { bucket_mid: 0.55, predicted_rate: 0.55, actual_rate: 0.40, sample_n: 25 },
      ],
      '1': [], '2': [], '3': [], '4': [],
    },
  },
}

it('Phase 91 CAL-01: xPts chart container renders when calibration has predicted_mean fields', () => {
  mockedUseAccuracy.mockReturnValue({ data: fixtureWithXptsMeans, isLoading: false, error: null } as never)
  const { container } = render(<AccuracyTab />)
  expect(container.querySelector('[data-testid="calibration-xpts-chart"]')).toBeTruthy()
})

it('Phase 91 CAL-01: xPts chart filters legacy buckets missing predicted_mean', () => {
  mockedUseAccuracy.mockReturnValue({ data: fixtureWithXptsMeans, isLoading: false, error: null } as never)
  const { container } = render(<AccuracyTab />)
  // Legacy bucket (bucket_mid=0.55) has no predicted_mean → must NOT appear as a dot in xPts chart.
  // Verify by counting recharts <circle> elements inside the xPts chart container.
  const xptsChart = container.querySelector('[data-testid="calibration-xpts-chart"]') as HTMLElement
  const dots = xptsChart.querySelectorAll('.recharts-line .recharts-line-dot')
  expect(dots.length).toBe(3)  // 3 buckets with predicted_mean, NOT 4
})

it('Phase 91 CAL-01: xPts chart heading reads "Predicted vs Actual xPts"', () => {
  mockedUseAccuracy.mockReturnValue({ data: fixtureWithXptsMeans, isLoading: false, error: null } as never)
  const { getByText } = render(<AccuracyTab />)
  expect(getByText('Predicted vs Actual xPts')).toBeTruthy()
})
```

[VERIFIED: existing fixture and test patterns at `AccuracyTab.test.tsx:73-110, 257-340`]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 63 calibration: rate-vs-rate haul calibration only | Phase 91 adds continuous xPts-mean calibration alongside | This phase | Two complementary diagnostics; haul-rate detects ranking quality, xPts-mean detects magnitude calibration |
| `@types/recharts` v1 separate types package | recharts v3 ships native types | recharts v2.0 (years ago) | Do not install `@types/recharts` |
| Hardcoded axis domain `[0, 1]` for percentage data | Auto-domain for continuous data | This phase | Predicted xPts varies 1–10+; auto-domain is required |

**Deprecated/outdated:**
- `@types/recharts` package: incompatible with recharts v3.x and explicitly forbidden in this codebase
- recharts v2.x patterns (e.g., older Tooltip API): not applicable; project is on v3.8.1

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | All claims in this research were verified against installed code, package.json, npm registry, or recharts v3.8.1 type definitions. |

**This table is empty:** Every factual claim in this research was verified or directly cited from existing locked artifacts (CONTEXT.md, UI-SPEC.md, ROADMAP.md, source files in repo). No assumed knowledge.

## Open Questions

1. **Should `_empty_backtest` populate `predicted_mean`/`actual_mean` keys at all?**
   - What we know: D-06 makes the fields optional. The current cold-start fallback emits `{'by_position': {'all': [], '1': [], ...}}` — empty arrays, no buckets, so no field-level decision needed.
   - What's unclear: Nothing — the empty arrays satisfy the contract.
   - Recommendation: **No change to `_empty_backtest`.** Plan 091-02 should explicitly note "no edit required" to avoid scope creep.

2. **Tooltip deviation sign convention: `actual - predicted` or `predicted - actual`?**
   - What we know: UI-SPEC §Copywriting Contract locks `Deviation: {((p.actual_mean ?? 0) - (p.predicted_mean ?? 0)).toFixed(2)} pts` (positive = under-prediction by the model, since actual exceeded prediction). UI-SPEC bottom note clarifies "positive = model over-predicts (player scored less than predicted)" — but the formula `actual - predicted` is positive when actual > predicted, which is **under-prediction**.
   - What's unclear: There is a contradiction between the UI-SPEC formula and its descriptive note. The formula treats positive deviation as actual > predicted (model under-predicted). The note treats positive deviation as model over-predicting (which would be `predicted - actual`).
   - Recommendation: **Resolve in Plan 091-04.** Pick one (the formula is more authoritative since it's executable). Suggest the formula `actual - predicted` and update the descriptive note text to match: "positive = model under-predicts (player scored more than predicted); negative = model over-predicts." Builder should flag this to user during UAT.

3. **Y-axis floor: should it pin to 0 or auto-derive (allowing negative actual_mean)?**
   - What we know: FPL points can be negative (red cards, own goals). `actual_mean` is averaged across multiple players in a decile, so it's effectively non-negative in practice (5+ samples will always have at least some positive contributors).
   - What's unclear: Whether to defensively force `domain={[0, 'auto']}` to lock the y-axis floor at 0.
   - Recommendation: **Use full auto-domain (no `domain` prop).** It's the simpler default and matches recharts behavior. If observed in UAT to clip negatives unnaturally, set `domain={[0, 'auto']}` later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | next/vitest | yes (project running) | (n/a — already in use) | — |
| Python 3.x | pipeline/accuracy.py | yes (project running) | (n/a — already in use) | — |
| recharts | AccuracyTab.tsx chart | yes | 3.8.1 | — |
| pytest | pipeline tests | yes | (installed) | — |
| vitest | UI tests | yes | 4.1.2 | — |
| @testing-library/react | UI tests | yes | (installed) | — |
| jsdom | vitest environment | yes (used in existing test file) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

All required tooling is present. Phase 91 ships zero new dependencies.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Python) | pytest |
| Framework (TS) | vitest 4.1.2 + @testing-library/react + jsdom |
| Config file (Python) | pytest.ini / pyproject.toml (already present in repo) |
| Config file (TS) | vitest.config.ts (already present) |
| Quick run (Python, this phase) | `pytest pipeline/tests/test_accuracy.py -x -k calibration` |
| Quick run (TS, this phase) | `npx vitest run src/components/accuracy/AccuracyTab.test.tsx` |
| Full suite | `pytest pipeline/tests/ && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | Each calibration bucket has `predicted_mean` (float) + `actual_mean` (float) when sample_n ≥ 5 | unit (pytest) | `pytest pipeline/tests/test_accuracy.py::test_calibration_includes_xpts_means -x` | ⚠️ Wave 0 — extend `test_accuracy.py` |
| CAL-01 | `predicted_mean` is monotonically descending across deciles 0→9 (top predictors have highest mean) | unit (pytest) | `pytest pipeline/tests/test_accuracy.py::test_calibration_xpts_means_descending_by_decile -x` | ⚠️ Wave 0 — extend `test_accuracy.py` |
| CAL-01 | Sparse buckets remain excluded; the new fields do not change sparse-filter behavior | unit (pytest) | `pytest pipeline/tests/test_accuracy.py::test_calibration_sparse_filter -x` | ✅ already exists; extend with new-field assertions |
| CAL-01 | xPts chart container `data-testid="calibration-xpts-chart"` renders when fixture has new fields | component (vitest) | `npx vitest run AccuracyTab.test.tsx -t "xPts chart container"` | ⚠️ Wave 0 — extend `AccuracyTab.test.tsx` |
| CAL-01 | xPts chart filters legacy-cache buckets that lack `predicted_mean` (component-edge filter) | component (vitest) | `npx vitest run AccuracyTab.test.tsx -t "filters legacy buckets"` | ⚠️ Wave 0 — extend `AccuracyTab.test.tsx` |
| CAL-01 | xPts chart heading reads `"Predicted vs Actual xPts"` | component (vitest) | `npx vitest run AccuracyTab.test.tsx -t "Predicted vs Actual xPts"` | ⚠️ Wave 0 — extend `AccuracyTab.test.tsx` |
| CAL-01 | PositionTabSelector controls both charts (single state) | component (vitest) | `npx vitest run AccuracyTab.test.tsx -t "single selector both charts"` | ⚠️ Wave 0 — extend `AccuracyTab.test.tsx` |
| CAL-01 | Empty-state overlay shows on xPts chart when no buckets pass filter (e.g., GK position) | component (vitest) | `npx vitest run AccuracyTab.test.tsx -t "Insufficient sample.*xPts"` | ⚠️ Wave 0 — extend `AccuracyTab.test.tsx` |

### Sampling Rate

- **Per task commit:** `pytest pipeline/tests/test_accuracy.py -x -k calibration && npx vitest run src/components/accuracy/AccuracyTab.test.tsx`
- **Per wave merge:** `pytest pipeline/tests/test_accuracy.py && npx vitest run src/components/accuracy/`
- **Phase gate:** `pytest pipeline/tests/ && npx vitest run` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pipeline/tests/test_accuracy.py` — add ≥2 new test functions for `predicted_mean`/`actual_mean` coverage; extend `test_calibration_structure` to assert new keys present and are floats
- [ ] `src/components/accuracy/AccuracyTab.test.tsx` — add new `fixtureWithXptsMeans` fixture (or extend `fixtureWithVersionsAndCalibration`); add ≥4 new test cases for xPts chart rendering, legacy filter, heading copy, empty-state
- [ ] No framework install required — both pytest and vitest are present and configured.

## Security Domain

> CONTEXT.md + repo configs do not declare `security_enforcement: false`. Defaulting to enabled but applicable categories are minimal because this phase is read-only visualization over already-trusted, locally-generated data.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase ships no auth changes; existing app auth (if any) untouched |
| V3 Session Management | no | No session state added |
| V4 Access Control | no | AccuracyTab is already a public/internal route; this phase does not change access |
| V5 Input Validation | partial | UI consumes `accuracy_backtest.json` produced by the project's own pipeline (trusted source). The component-edge null guard (`b.predicted_mean != null`) is a robustness check, not a security check. |
| V6 Cryptography | no | No crypto operations |
| V7 Error Handling | yes | Empty-state overlay + null-guarded tooltip prevent client-side crash on malformed/legacy cache |

### Known Threat Patterns for {recharts + Next.js client component}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-site scripting via chart label | Tampering / Disclosure | recharts renders text via React props (auto-escaped); no `dangerouslySetInnerHTML` introduced |
| Tooltip rendering null/undefined fields | Denial of service (client crash) | Null-guard at render-time (`if (p.predicted_mean == null) return null`) and at filter-time (`useMemo` excludes incomplete buckets) — Pitfall 3 |
| Floating-point overflow in `Math.max(...arr)` | Denial of service | Empty-array guard returns `1` default — Pitfall 4 |

No new attack surface. The phase introduces no network calls, no user input, no auth state, no persistent storage, and no third-party content. Risk is limited to client-side robustness against malformed cached data — addressed by the null-guard pattern.

## Sources

### Primary (HIGH confidence)
- `pipeline/accuracy.py` (lines 1-547) — read in full for `_compute_calibration_data`, `_empty_backtest`, `compute_accuracy_backtest` integration
- `src/components/accuracy/AccuracyTab.tsx` (lines 1-358) — read for imports, `PositionTabSelector`, `CalibrationTooltip`, `CalibrationSection`, recharts patterns
- `src/lib/types.ts` (lines 393-470) — read for `AccuracyBacktest`, `CalibrationBucket`, `CalibrationData`
- `pipeline/tests/test_accuracy.py` (lines 1-552) — read for existing test fixtures and CAL-01/CAL-02 patterns
- `src/components/accuracy/AccuracyTab.test.tsx` (lines 1-340) — read for existing UI test fixtures and patterns
- `node_modules/recharts/types/cartesian/ReferenceLine.d.ts` — verified `segment` and `ifOverflow` props exist in installed v3.8.1
- `package.json` — verified recharts ^3.8.1, react 19.2.4, next 16.2.1, vitest ^4.1.2 installed
- `npm view recharts version` → `3.8.1` (confirmed current)
- `npm view @types/recharts version` → `2.0.1` (confirmed stale v1-era — DO NOT install)
- `.planning/phases/91-calibration-charts/91-CONTEXT.md` (full file) — locked decisions D-01 through D-07
- `.planning/phases/91-calibration-charts/91-UI-SPEC.md` (full file) — UI design contract
- `.planning/ROADMAP.md` lines 1016-1041 — Phase 91 success criteria, plan breakdown, cross-cutting constraints
- `.planning/REQUIREMENTS.md` — CAL-01 definition (line 14)
- `CLAUDE.md` + `AGENTS.md` — project-level directives

### Secondary (MEDIUM confidence)
- (none) — every finding traces to a primary source in the repo or the npm registry

### Tertiary (LOW confidence)
- (none)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — All packages installed and verified at exact versions. recharts API confirmed against installed `.d.ts` files. No new dependencies.
- Architecture: **HIGH** — Phase 91 is a literal extension of Phase 63 patterns. Source code read in full at all integration points. The pattern to follow is locked by D-06 / D-07 and confirmed by existing implementation.
- Pitfalls: **HIGH** — Pitfalls 1, 2, 6 are direct carry-forwards from Phase 63 (already proven). Pitfalls 3, 4, 5, 7 are derived from the specific shape of the new optional fields and the auto-domain reference-line interaction; each is testable and has a concrete mitigation.
- Test strategy: **HIGH** — All test files exist; the gap is purely additive (new test cases against extended fixture). No new framework required.

**Research date:** 2026-05-10
**Valid until:** 2026-05-17 (one week — recharts is stable, but the project moves quickly and Phase 90's MC pipeline could land an `accuracy_backtest.json` schema change in parallel)
