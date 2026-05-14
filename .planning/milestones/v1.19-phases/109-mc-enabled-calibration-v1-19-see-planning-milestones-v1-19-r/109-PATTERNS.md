# Phase 109: MC-Enabled Calibration - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 5 (3 modified, 2 test files)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/accuracy.py` | service | transform | `pipeline/accuracy.py` itself (internal extension) | exact — self-modification |
| `pipeline/run.py` | pipeline entry | batch | `pipeline/run.py` itself (call-site change) | exact — self-modification |
| `src/lib/types.ts` | type/model | — | `src/lib/types.ts` itself (`AccuracySummary` extension) | exact — self-modification |
| `src/components/squad/CalibrationHealthIndicator.tsx` | component | request-response | `src/components/squad/CalibrationHealthIndicator.tsx` itself (badge addition + bug fix) | exact — self-modification |
| `pipeline/tests/test_accuracy.py` | test | — | `pipeline/tests/test_accuracy.py` (existing test file) | exact — additive tests |
| `src/components/squad/CalibrationHealthIndicator.test.tsx` | test | — | `src/components/squad/CalibrationHealthIndicator.test.tsx` (existing test file) | exact — additive tests |

---

## Pattern Assignments

### `pipeline/accuracy.py` — `_compute_calibration_data` extension

**Analog:** `pipeline/accuracy.py` lines 496–571 (the function being extended)

**Current signature** (line 496):
```python
def _compute_calibration_data(per_gw_rows: dict) -> dict:
```

**New signature** (D-07):
```python
def _compute_calibration_data(
    per_gw_rows: dict,
    use_mc: bool = False,
    merged_haul_lookup: dict = None,
) -> dict:
```

**Existing accumulator pattern** (lines 511–533) — copy this structure and add the MC parallel accumulator:
```python
# Existing accumulators to keep:
bucket_haul: dict = defaultdict(lambda: defaultdict(int))
bucket_total: dict = defaultdict(lambda: defaultdict(int))
bucket_sum_predicted: dict = defaultdict(lambda: defaultdict(float))
bucket_sum_actual: dict = defaultdict(lambda: defaultdict(float))

# NEW MC accumulator to add (parallel pattern):
bucket_haul_prob: dict = defaultdict(lambda: defaultdict(float))

for gw, rows in per_gw_rows.items():
    if not rows:
        continue
    n = len(rows)
    # EXISTING analytical sort path (keep as else branch):
    ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
    for rank_idx, row in enumerate(ranked):
        decile = min(int(rank_idx * 10 / n), 9)
        is_haul = 1 if row['actual_pts'] >= HAULTER_THRESHOLD else 0
        pos_key = str(row['element_type'])
        for pk in ('all', pos_key):
            bucket_haul[pk][decile] += is_haul
            bucket_total[pk][decile] += 1
            bucket_sum_predicted[pk][decile] += row['xpts_predicted']
            bucket_sum_actual[pk][decile]    += row['actual_pts']
```

**MC sort branch** (D-05, D-06) — insert BEFORE the existing `ranked = sorted(...)` line:
```python
if use_mc and merged_haul_lookup:
    # D-05: sort by effective_haul_prob descending; D-06: missing → 0.0
    for row in rows:
        row['_eff_hp'] = merged_haul_lookup.get(row['player_id'], 0.0)
    ranked = sorted(rows, key=lambda r: r['_eff_hp'], reverse=True)
else:
    ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)

for rank_idx, row in enumerate(ranked):
    decile = min(int(rank_idx * 10 / n), 9)
    is_haul = 1 if row['actual_pts'] >= HAULTER_THRESHOLD else 0
    pos_key = str(row['element_type'])
    for pk in ('all', pos_key):
        bucket_haul[pk][decile] += is_haul
        bucket_total[pk][decile] += 1
        bucket_sum_predicted[pk][decile] += row['xpts_predicted']
        bucket_sum_actual[pk][decile]    += row['actual_pts']
        if use_mc and merged_haul_lookup:
            bucket_haul_prob[pk][decile] += row['_eff_hp']
```

**Existing bucket assembly pattern** (lines 558–568) — modify `predicted_rate` line only:
```python
# CURRENT (line 561):
'predicted_rate': bucket_mids[d],

# NEW (MC mode uses mean haul_prob; analytical keeps bucket_mid):
'predicted_rate': (
    round(bucket_haul_prob[pos_key][d] / total, 4)
    if (use_mc and merged_haul_lookup and total > 0)
    else bucket_mids[d]
),
# bucket_mid is retained for backward compat (line 560 unchanged):
'bucket_mid': bucket_mids[d],
```

**Call site change** (line 349 of accuracy.py):
```python
# CURRENT:
calibration = _compute_calibration_data(per_gw_rows)

# NEW:
calibration = _compute_calibration_data(per_gw_rows, use_mc=use_mc, merged_haul_lookup=merged_haul_lookup)
```

---

### `pipeline/accuracy.py` — `compute_accuracy_backtest` extension

**Analog:** `pipeline/accuracy.py` lines 121–411 (the function being extended)

**Current signature** (lines 121–127):
```python
def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
    cache_dir: str = '',
) -> dict:
```

**New signature** (D-01, D-03 — add two parameters):
```python
def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
    cache_dir: str = '',
    merged_haul_lookup: dict = None,
    total_merged_count: int = 0,
) -> dict:
```

**Gate flag read pattern** to follow (lines 73–82 — `_read_existing_mc_enabled_flag`):
```python
# This pattern is the model for how gate flags are preserved.
# calibration_mode does NOT use this pattern — it is recomputed each run.
def _read_existing_mc_enabled_flag(cache_dir: str) -> bool:
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('mc_enabled', False))
```

**Coverage + use_mc derivation** (D-03) — insert after reading `mc_enabled` (around line 142):
```python
# D-03: derive use_mc from coverage; calibration_mode recomputed each run (not preserved)
coverage_pct = (
    len(merged_haul_lookup) / total_merged_count
    if (merged_haul_lookup and total_merged_count > 0)
    else 0.0
)
use_mc = bool(mc_enabled and coverage_pct >= 0.80)
calibration_mode = 'mc' if use_mc else 'analytical'
```

**Summary dict write pattern** (lines 390–411) — add `calibration_mode` alongside `mc_enabled`:
```python
# Existing mc_enabled line (line 400):
'mc_enabled': mc_enabled,   # Phase 90 MC-01

# New line immediately after (D-04):
'calibration_mode': calibration_mode,   # Phase 109 MC-CAL-01
```

**`_empty_backtest` summary** (lines 472–493) — add `calibration_mode` defaulting to `'analytical'` (Pitfall 2):
```python
# In _empty_backtest summary dict, after 'mc_enabled':
'mc_enabled': mc_enabled,           # Phase 90 MC-01
'calibration_mode': 'analytical',   # Phase 109 MC-CAL-01: no merged data in empty path
```

---

### `pipeline/run.py` — haul lookup build + parameter pass

**Analog:** `pipeline/run.py` lines 224–226 (compute_simulations call pattern) and lines 323–327 (compute_accuracy_backtest call site)

**Lookup build pattern** (D-01) — insert immediately before the `compute_accuracy_backtest` call (line ~324):
```python
# Build haul_prob lookup for MC calibration (Phase 109 D-01)
haul_lookup = {p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}
total_merged_count = len(merged)
```

**Call site change** (line 325):
```python
# CURRENT (line 325):
backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir)

# NEW:
backtest_data = compute_accuracy_backtest(
    summaries, finished_gws, bootstrap, fixtures,
    cache_dir=cache_dir,
    merged_haul_lookup=haul_lookup,
    total_merged_count=total_merged_count,
)
```

**Print pattern** (lines 208–212) — add a calibration mode print after the existing MC print:
```python
# Existing (line 212):
print(f"MC simulation (5-GW uncertainty bands): {'ENABLED' if mc_enabled else 'DISABLED'}")

# New — mirrors the existing print style:
print(f"Haul lookup coverage: {len(haul_lookup)}/{total_merged_count} players have haul_prob")
```

---

### `src/lib/types.ts` — `AccuracySummary` extension

**Analog:** `src/lib/types.ts` lines 343–358 (the `AccuracySummary` interface)

**Current interface** (lines 343–358):
```typescript
export interface AccuracySummary {
  xpts_hit_rate: number
  // ... existing fields ...
  mc_enabled?: boolean               // Phase 90 MC-01
}
```

**Addition** (D-04) — one line added after `mc_enabled`:
```typescript
mc_enabled?: boolean               // Phase 90 MC-01
calibration_mode?: 'mc' | 'analytical'  // Phase 109 MC-CAL-01
```

**CalibrationBucket comment update** (line 463) — update the `predicted_rate` comment:
```typescript
// CURRENT (line 463):
predicted_rate: number   // equals bucket_mid (decile midpoint as fraction)

// NEW:
predicted_rate: number   // analytical: equals bucket_mid; MC mode: mean(haul_prob) per bucket
```

---

### `src/components/squad/CalibrationHealthIndicator.tsx` — mode badge + bug fix

**Analog:** The existing `TIER_BADGE_CLASSES` pattern (lines 11–15) is the direct template for `MODE_BADGE_CLASSES`.

**Existing TIER_BADGE_CLASSES pattern** (lines 11–15) — copy this structure exactly for MODE_BADGE_CLASSES:
```typescript
const TIER_BADGE_CLASSES: Record<Tier, string> = {
  good: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900',
  fair: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900',
  poor: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900',
}
```

**New MODE_BADGE_CLASSES** (D-09, D-10) — add immediately after `TIER_BADGE_CLASSES`:
```typescript
type CalibrationMode = 'mc' | 'analytical'

const MODE_BADGE_CLASSES: Record<CalibrationMode, string> = {
  mc: 'text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900',
  analytical: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800',
}

const MODE_BADGE_LABEL: Record<CalibrationMode, string> = {
  mc: 'MC',
  analytical: 'Analytical',
}
```

**Bug fix** (D-11) — line 56 is the single change target:
```typescript
// CURRENT (line 56):
const maxDeviation = Math.max(...buckets.map((b) => Math.abs(b.actual_rate - b.bucket_mid)))

// NEW:
const maxDeviation = Math.max(...buckets.map((b) => Math.abs(b.actual_rate - b.predicted_rate)))
```

**Mode read** — add after the `maxDeviation` line, before `const tier`:
```typescript
const calibrationMode = data.summary?.calibration_mode as CalibrationMode | undefined
```

**Mode badge render** (D-08, D-09) — insert after the tier badge `<span>` (line 70–73), before the sentence `<span>`:
```typescript
{/* Existing tier badge: */}
<span
  aria-label={`Calibration health: ${tier}`}
  className={`text-xs font-semibold rounded px-2 py-0.5 ${TIER_BADGE_CLASSES[tier]}`}
>
  {tier}
</span>

{/* NEW mode badge (D-08/D-09): null-renders when calibration_mode is undefined */}
{calibrationMode && (
  <span
    aria-label={`Calibration mode: ${MODE_BADGE_LABEL[calibrationMode]}`}
    className={`text-xs font-semibold rounded px-2 py-0.5 ${MODE_BADGE_CLASSES[calibrationMode]}`}
  >
    {MODE_BADGE_LABEL[calibrationMode]}
  </span>
)}

{/* Existing sentence span unchanged: */}
<span className="text-sm text-zinc-700 dark:text-zinc-300">{sentence}</span>
```

---

### `pipeline/tests/test_accuracy.py` — new MC calibration tests

**Analog:** `pipeline/tests/test_accuracy.py` — existing `_build_minimal_inputs` helper and test structure

**Existing helper pattern** (lines 26–76) — copy `_build_minimal_inputs` and `_hist` as the base for new tests:
```python
def _hist(round_, minutes, total_points, xg=0.0, xa=0.0, opponent_team=1):
    return {
        'round': round_,
        'minutes': minutes,
        'total_points': total_points,
        'expected_goals': xg,
        'expected_assists': xa,
        'opponent_team': opponent_team,
        'starts': 1 if minutes >= 45 else 0,
    }

def _build_minimal_inputs(player_history_by_id, finished_gws=32):
    # ... builds (summaries, finished_gws, bootstrap, fixtures) ...
    # See existing file lines 38–76 for full implementation
```

**New test import** — `_compute_calibration_data` is private; tests should call `compute_accuracy_backtest` and inspect `result['calibration']`, OR the test may import `_compute_calibration_data` directly for unit isolation. Follow existing import pattern (line 21):
```python
from accuracy import compute_accuracy_backtest, _compute_calibration_data, FORMULA_VERSION
```

**Test structure pattern** — follow existing `describe`-less flat function style:
```python
def test_calibration_mode_mc_written_to_summary():
    # Build inputs, call compute_accuracy_backtest with merged_haul_lookup + total_merged_count
    # Assert result['summary']['calibration_mode'] == 'mc'
    ...

def test_calibration_mc_path_predicted_rate():
    # Build per_gw_rows with known players, call _compute_calibration_data(use_mc=True, ...)
    # Assert buckets[*]['predicted_rate'] == mean(haul_prob) not bucket_mid
    ...
```

---

### `src/components/squad/CalibrationHealthIndicator.test.tsx` — new mode badge tests

**Analog:** `src/components/squad/CalibrationHealthIndicator.test.tsx` — existing `makeBucket` and `makeData` helpers + `describe` block

**Existing helper pattern** (lines 8–30) — extend `makeData` with `summary.calibration_mode` override:
```typescript
function makeBucket(bucket_mid: number, actual_rate: number, sample_n = 25): CalibrationBucket {
  return { bucket_mid, predicted_rate: bucket_mid, actual_rate, sample_n }
}

// For MC-mode tests, use distinct predicted_rate (not equal to bucket_mid):
function makeMcBucket(predicted_rate: number, actual_rate: number, sample_n = 25): CalibrationBucket {
  return { bucket_mid: predicted_rate - 0.02, predicted_rate, actual_rate, sample_n }
}

// makeData already accepts Partial<AccuracyBacktest>; pass summary override:
const data = makeData({ summary: { calibration_mode: 'mc' } as never })
```

**Existing test structure** (lines 32–131) — add new tests inside the same `describe('CalibrationHealthIndicator', ...)` block:
```typescript
it('renders MC badge in teal when calibration_mode is mc', () => {
  const data = makeData({ summary: { calibration_mode: 'mc' } as never })
  const { getByLabelText } = render(<CalibrationHealthIndicator data={data} />)
  expect(getByLabelText('Calibration mode: MC')).toBeTruthy()
})

it('renders Analytical badge in zinc when calibration_mode is analytical', () => {
  const data = makeData({ summary: { calibration_mode: 'analytical' } as never })
  const { getByLabelText } = render(<CalibrationHealthIndicator data={data} />)
  expect(getByLabelText('Calibration mode: Analytical')).toBeTruthy()
})

it('mode badge absent when calibration_mode is undefined (legacy cache)', () => {
  const data = makeData({ summary: {} as never })
  const { queryByLabelText } = render(<CalibrationHealthIndicator data={data} />)
  expect(queryByLabelText(/Calibration mode:/)).toBeNull()
})

it('maxDeviation uses predicted_rate not bucket_mid (D-11 bug fix)', () => {
  // bucket_mid=0.03, predicted_rate=0.08, actual_rate=0.20 → deviation off predicted_rate = 0.12 → poor
  const bucket = { bucket_mid: 0.03, predicted_rate: 0.08, actual_rate: 0.20, sample_n: 25 }
  const data = makeData({ calibration: { by_position: { all: [bucket], '1': [], '2': [], '3': [], '4': [] } } })
  const { getByText } = render(<CalibrationHealthIndicator data={data} />)
  expect(getByText('poor')).toBeTruthy()  // would be 'fair' if using bucket_mid (0.17 deviation)
})
```

---

## Shared Patterns

### Gate Flag Pattern (`_read_existing_*_flag`)
**Source:** `pipeline/accuracy.py` lines 40–82
**Apply to:** `_empty_backtest` in `pipeline/accuracy.py`
**Note:** `calibration_mode` does NOT use this preservation pattern. It is recomputed each run from current coverage. Only `mc_enabled` (already present) is preserved.

```python
# Pattern: read from prior cache, default False on cold start
def _read_existing_mc_enabled_flag(cache_dir: str) -> bool:
    return bool(_read_existing_cache(cache_dir).get('summary', {}).get('mc_enabled', False))
```

### Summary Dict Extension Pattern
**Source:** `pipeline/accuracy.py` lines 390–411 and 472–493
**Apply to:** Both `compute_accuracy_backtest` return dict and `_empty_backtest` return dict — both must be updated in sync.

```python
# Every new summary field appears in BOTH locations — this is the established contract.
# compute_accuracy_backtest summary (line ~400): 'mc_enabled': mc_enabled,
# _empty_backtest summary (line ~482):           'mc_enabled': mc_enabled,
```

### Badge Colour Record Pattern
**Source:** `src/components/squad/CalibrationHealthIndicator.tsx` lines 11–15
**Apply to:** `MODE_BADGE_CLASSES` — exact same `Record<T, string>` structure with Tailwind dark-mode pair.

```typescript
const TIER_BADGE_CLASSES: Record<Tier, string> = {
  good: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900',
  ...
}
// MODE_BADGE_CLASSES follows this pattern exactly.
```

### Defaultdict Accumulator Pattern
**Source:** `pipeline/accuracy.py` lines 511–516
**Apply to:** `bucket_haul_prob` accumulator in `_compute_calibration_data` MC path — use `defaultdict(lambda: defaultdict(float))` matching the existing `bucket_sum_predicted` pattern.

```python
bucket_sum_predicted: dict = defaultdict(lambda: defaultdict(float))
# bucket_haul_prob follows identical declaration:
bucket_haul_prob: dict = defaultdict(lambda: defaultdict(float))
```

### Divisor: Use `bucket_total[pos_key][d]` for MC mean
**Source:** `pipeline/accuracy.py` line 566 — `bucket_sum_predicted[pos_key][d] / total` where `total = bucket_total[pos_key][d]`
**Apply to:** `predicted_rate` in MC mode — use `bucket_haul_prob[pos_key][d] / total` with the same `total` variable already in scope at the bucket assembly loop. No separate counter needed (Pitfall 5 resolution).

---

## No Analog Found

All modified files have exact self-analogs — they are extensions of existing implementations. No file in this phase is genuinely new with no prior pattern.

---

## Critical Pitfalls for Planner

These were identified in RESEARCH.md and are load-bearing for correct implementation:

1. **coverage_pct denominator** — `merged_haul_lookup` is pre-filtered (only players with `haul_prob != None`). Use `len(merged_haul_lookup) / total_merged_count` where `total_merged_count` is passed separately from `run.py`. Never use `len(haul_lookup) / len(haul_lookup)` (always 1.0). Recommended: pass `total_merged_count: int = 0` alongside `merged_haul_lookup`.

2. **`_empty_backtest` parity** — `calibration_mode` must appear in `_empty_backtest` summary dict. Default: `'analytical'` (no merged data available in that path). Omitting it causes UI silent-null on pre-season runs.

3. **MC test fixture must have `predicted_rate != bucket_mid`** — new D-11 bug-fix tests must use `makeMcBucket` where `predicted_rate` is distinct from `bucket_mid` so the test actually exercises the fix. Existing tests use `predicted_rate: bucket_mid` — they still pass but do not cover the bug fix.

4. **Mode badge renders only in the populated branch** — `calibrationMode` read and badge render must be inside the non-cold-start, non-null branch only (lines 55–76 of the component). Cold-start path (lines 41–53) is unchanged.

5. **`bucket_total[pos_key][d]` is the correct MC divisor** — do not introduce a separate `bucket_haul_count` accumulator; `bucket_total` already counts observations per-GW identically.

---

## Metadata

**Analog search scope:** `pipeline/accuracy.py`, `pipeline/run.py`, `pipeline/tests/test_accuracy.py`, `src/components/squad/CalibrationHealthIndicator.tsx`, `src/components/squad/CalibrationHealthIndicator.test.tsx`, `src/lib/types.ts`
**Files scanned:** 6 primary files read directly
**Pattern extraction date:** 2026-05-14
