# Phase 109: MC-Enabled Calibration — Research

**Researched:** 2026-05-14
**Domain:** Python pipeline calibration + React/TypeScript component badge
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**haul_prob Data Flow**
- D-01: `compute_accuracy_backtest` gains `merged_haul_lookup: dict[int, float]` (player_id → haul_prob). `run.py` builds it from the current merged list: `{p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}` and passes it alongside existing parameters.
- D-02: Per-player fallback for missing `haul_prob`: `effective_haul_prob = 0.0`, placing them at the bottom of the sort. Their bucket contribution is absorbed as 0.0 in the mean.
- D-03: 80% threshold computed in `compute_accuracy_backtest`: `coverage_pct = sum(1 for p in merged if p.get('haul_prob') is not None) / len(merged)`. If `mc_enabled AND coverage_pct >= 0.80` → `use_mc = True`, write `calibration_mode = 'mc'`; else `use_mc = False`, write `calibration_mode = 'analytical'`. The `use_mc` bool is passed to `_compute_calibration_data`.
- D-04: `calibration_mode: 'mc' | 'analytical'` written to `accuracy_backtest.json.summary`. `CalibrationHealthIndicator` reads it from `data.summary.calibration_mode`. `AccuracySummary` gains `calibration_mode?: 'mc' | 'analytical'`.

**Bucketing Approach (MC Path)**
- D-05: When `use_mc=True`, `_compute_calibration_data` sorts players by `effective_haul_prob` descending, divides into 10 equal-population deciles, `predicted_rate = mean(effective_haul_prob)` per bucket.
- D-06: Missing-lookup players get `effective_haul_prob = 0.0`, absorbed into the bottom decile.
- D-07: Signature: `_compute_calibration_data(per_gw_rows, use_mc=False, merged_haul_lookup=None)`. `bucket_mid` retained for backward compat; `predicted_rate` changes value only in MC mode.

**CalibrationHealthIndicator Label**
- D-08: Second badge immediately after tier badge: `[good] [MC]  Calibration: good — ...`
- D-09: Badge text: `"MC"` or `"Analytical"`. Null-render when `calibration_mode` is undefined (legacy cache).
- D-10: Badge colours: MC → teal (`text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900`); Analytical → zinc (`text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800`).
- D-11: Bug fix — `maxDeviation` switches from `b.bucket_mid` to `b.predicted_rate` in `computeTier`.

### Claude's Discretion

- Whether to rename `merged_haul_lookup` parameter to `haul_prob_lookup` for brevity.
- Whether `_compute_calibration_data` preserves `bucket_sum_predicted`/`bucket_sum_actual` accumulators in MC mode (they still reflect `xpts_predicted`). Planner decides whether to zero these out or keep in MC mode.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MC-CAL-01 | Calibration pipeline uses MC `haul_prob` as `predicted_rate`, replacing analytical xPts decile-rank proxy — gated by `mc_enabled` | D-03/D-05 specify exactly how to derive `use_mc`, build the haul lookup, and compute per-bucket `predicted_rate = mean(haul_prob)` |
| MC-CAL-02 | `CalibrationHealthIndicator` surfaces MC vs analytical mode via a distinguishing badge label | D-08 through D-11 specify badge text, colours, positioning, and the `calibration_mode` field on `AccuracySummary` |
</phase_requirements>

---

## Summary

Phase 109 is a focused two-file Python change plus a TypeScript component enhancement. The core Python change modifies `_compute_calibration_data` in `pipeline/accuracy.py` to accept an MC path: when `use_mc=True`, players are sorted by `effective_haul_prob` (from a per-player lookup built in `run.py`) rather than `xpts_predicted`, and `predicted_rate` per bucket becomes the mean `haul_prob` within that decile instead of the analytical `bucket_mid` proxy. The TypeScript change adds a teal/zinc mode badge to `CalibrationHealthIndicator.tsx` and fixes the one-line `maxDeviation` bug that uses `b.bucket_mid` instead of `b.predicted_rate`.

The codebase is well-prepared. `haul_prob` is present on all 832 active players (100% coverage in production `merged_players.json` — confirmed from cache). The existing `CalibrationBucket.predicted_rate` field in both Python output and TypeScript types means no structural JSON shape change is needed: Phase 109 only changes the value of `predicted_rate` in MC mode. The `TIER_BADGE_CLASSES` pattern in the component directly parallels the `MODE_BADGE_CLASSES` pattern to be added. Both test suites are currently green (34 Python, 9 TS component).

**Primary recommendation:** Implement as a two-wave plan — Wave 1: Python pipeline changes + types (accuracy.py + types.ts + run.py), Wave 2: component changes (CalibrationHealthIndicator.tsx + tests). Tests must be RED before implementation in each wave per the nyquist_validation workflow.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MC haul_prob lookup construction | Pipeline (Python) | — | `run.py` already owns the merged list; lookup is built from `merged` immediately before `compute_accuracy_backtest` call |
| `calibration_mode` derivation (80% coverage gate) | Pipeline (Python) | — | Computed from actual player data; output written to `accuracy_backtest.json.summary` |
| `predicted_rate = mean(haul_prob)` per decile | Pipeline (Python) | — | Lives inside `_compute_calibration_data`; pure transform on per_gw_rows + haul lookup |
| `calibration_mode` field on API payload | Pipeline (Python) → API (Next.js route) | — | Written by pipeline, surfaced via existing `/api/accuracy` route that serves `accuracy_backtest.json`; no route change needed |
| Mode badge render | Frontend (React component) | — | `CalibrationHealthIndicator.tsx` reads `data.summary.calibration_mode` from existing `useAccuracy` payload |
| `AccuracySummary` type update | Frontend (TypeScript types) | — | `src/lib/types.ts` — type-only addition, no runtime effect |

---

## Standard Stack

### Core (no new dependencies)

This phase introduces zero new npm or Python packages. All modifications are to existing files using existing language features and project patterns.

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Python 3.11 | 3.11.x | Pipeline logic | Already installed [VERIFIED: pipeline/conftest.py, python3 --version] |
| pytest 8.3.5 | 8.3.5 | Python test runner | Already installed [VERIFIED: pytest cache bytecode filename pattern] |
| React 18 / Next.js 16 | existing | Component host | Already in project |
| Vitest 4.1.2 | 4.1.2 | TypeScript test runner | Already installed [VERIFIED: vitest run output] |
| Tailwind CSS v4 | v4 | Badge styling | Already in project [VERIFIED: 109-UI-SPEC.md] |

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
run.py (daily pipeline)
    │
    ├── merge_players() → merged list (haul_prob on all 832 players)
    │       └── MC_ENABLED = True (Phase 102) ensures haul_prob is always populated
    │
    ├── haul_lookup = {p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}
    │       └── coverage_pct = len(haul_lookup) / len(merged)
    │
    └── compute_accuracy_backtest(..., merged_haul_lookup=haul_lookup)
            │
            ├── mc_enabled (from prior cache, set to MC_ENABLED=True by run.py line 204)
            ├── coverage_pct >= 0.80? → use_mc = True → calibration_mode = 'mc'
            │                         → use_mc = False → calibration_mode = 'analytical'
            │
            ├── _compute_calibration_data(per_gw_rows, use_mc, merged_haul_lookup)
            │       ├── MC path: sort by effective_haul_prob desc, predicted_rate = mean(haul_prob)/bucket
            │       └── Analytical path: sort by xpts_predicted desc, predicted_rate = bucket_mid (unchanged)
            │
            └── accuracy_backtest.json
                    └── summary.calibration_mode: 'mc' | 'analytical'
                    └── calibration.by_position.all[*].predicted_rate  ← changed in MC mode

/api/accuracy (Next.js route — unchanged)
    └── serves accuracy_backtest.json as-is

useAccuracy hook (unchanged)
    └── data.summary.calibration_mode → CalibrationHealthIndicator

CalibrationHealthIndicator.tsx
    ├── Bug fix: maxDeviation uses b.predicted_rate (not b.bucket_mid)
    ├── Reads calibration_mode from data.summary.calibration_mode
    └── Renders [tier-badge] [mode-badge?] sentence
```

### Recommended Project Structure

No new files or folders. Modifications are confined to:
```
pipeline/
├── accuracy.py          # _compute_calibration_data + compute_accuracy_backtest
├── run.py               # haul_lookup build + parameter pass
└── tests/
    └── test_accuracy.py # new MC-path calibration tests

src/
├── lib/
│   └── types.ts         # AccuracySummary gains calibration_mode?
└── components/squad/
    ├── CalibrationHealthIndicator.tsx    # mode badge + bug fix
    └── CalibrationHealthIndicator.test.tsx  # new mode badge tests
```

### Pattern 1: MC Path in `_compute_calibration_data`

**What:** Extend the existing `bucket_haul` / `bucket_total` accumulator loop with a parallel MC path that uses `effective_haul_prob` for sorting and a `bucket_haul_prob` accumulator for the `predicted_rate` mean.

**When to use:** When `use_mc=True` and `merged_haul_lookup` is non-empty.

**Example (synthesised from CONTEXT.md D-05, D-06, D-07):**
```python
# Source: CONTEXT.md D-07 — signature
def _compute_calibration_data(
    per_gw_rows: dict,
    use_mc: bool = False,
    merged_haul_lookup: dict = None,
) -> dict:
    # NEW: parallel accumulator for haul_prob sums
    bucket_haul_prob: dict = defaultdict(lambda: defaultdict(float))
    bucket_haul_count: dict = defaultdict(lambda: defaultdict(int))

    for gw, rows in per_gw_rows.items():
        if not rows:
            continue
        n = len(rows)

        if use_mc and merged_haul_lookup:
            # D-05: assign effective_haul_prob; D-06: missing players → 0.0
            for row in rows:
                row['_eff_hp'] = merged_haul_lookup.get(row['player_id'], 0.0)
            ranked = sorted(rows, key=lambda r: r['_eff_hp'], reverse=True)
        else:
            # Analytical path: unchanged
            ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)

        for rank_idx, row in enumerate(ranked):
            decile = min(int(rank_idx * 10 / n), 9)
            is_haul = 1 if row['actual_pts'] >= HAULTER_THRESHOLD else 0
            pos_key = str(row['element_type'])
            for pk in ('all', pos_key):
                bucket_haul[pk][decile] += is_haul
                bucket_total[pk][decile] += 1
                if use_mc and merged_haul_lookup:
                    bucket_haul_prob[pk][decile] += row['_eff_hp']
                    bucket_haul_count[pk][decile] += 1
                # existing xPts accumulators unchanged
                bucket_sum_predicted[pk][decile] += row['xpts_predicted']
                bucket_sum_actual[pk][decile] += row['actual_pts']

    # In bucket assembly:
    # predicted_rate = (bucket_haul_prob[pk][d] / bucket_haul_count[pk][d])
    #                  if (use_mc and bucket_haul_count[pk][d] > 0)
    #                  else bucket_mids[d]
```

**Key insight:** `bucket_haul_count` is needed as the divisor because `bucket_total` counts cross-GW observations whereas `effective_haul_prob` is a per-player property — only counted once per decile assignment per GW. In this implementation both counts are equal per GW, so `bucket_haul_count == bucket_total` per GW-iteration. The planner should confirm whether to use `bucket_total` as the divisor directly (it is equivalent) or introduce a separate accumulator for clarity. [ASSUMED]

### Pattern 2: `calibration_mode` derivation in `compute_accuracy_backtest`

**What:** After reading `mc_enabled` from the prior cache, compute `coverage_pct` and derive `use_mc`.

**Example (from CONTEXT.md D-03):**
```python
# Source: CONTEXT.md D-03
coverage_pct = (
    sum(1 for p in merged_haul_lookup.values() if p is not None) / len(merged)
    if merged_haul_lookup and len(merged) > 0 else 0.0
)
# Note: merged_haul_lookup only contains players with haul_prob != None (built with
# the filter in run.py), so len(merged_haul_lookup) / len(merged) is the correct ratio.
# The compute_accuracy_backtest function receives merged_haul_lookup, not merged directly.
# The coverage_pct computation uses len(merged_haul_lookup) / total_player_count.
# total_player_count is NOT directly available in compute_accuracy_backtest — it must
# be passed separately or inferred. See Open Questions #1.
use_mc = mc_enabled and (coverage_pct >= 0.80)
calibration_mode = 'mc' if use_mc else 'analytical'
```

### Pattern 3: MODE_BADGE_CLASSES in CalibrationHealthIndicator

**What:** Parallel to `TIER_BADGE_CLASSES`. Null-renders when `calibration_mode` is undefined (legacy cache).

**Example (from 109-UI-SPEC.md, verified against CONTEXT.md D-09/D-10):**
```typescript
// Source: 109-UI-SPEC.md §Component Specification
type CalibrationMode = 'mc' | 'analytical'

const MODE_BADGE_CLASSES: Record<CalibrationMode, string> = {
  mc: 'text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900',
  analytical: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800',
}

const MODE_BADGE_LABEL: Record<CalibrationMode, string> = {
  mc: 'MC',
  analytical: 'Analytical',
}

// Read path:
const calibrationMode = data.summary?.calibration_mode as CalibrationMode | undefined

// Bug fix (D-11):
const maxDeviation = Math.max(...buckets.map((b) => Math.abs(b.actual_rate - b.predicted_rate)))

// Render (after tier badge, before sentence):
{calibrationMode && (
  <span
    aria-label={`Calibration mode: ${MODE_BADGE_LABEL[calibrationMode]}`}
    className={`text-xs font-semibold rounded px-2 py-0.5 ${MODE_BADGE_CLASSES[calibrationMode]}`}
  >
    {MODE_BADGE_LABEL[calibrationMode]}
  </span>
)}
```

### Anti-Patterns to Avoid

- **Computing coverage_pct from merged_haul_lookup alone without knowing total player count:** The lookup only contains players with `haul_prob != None`. The 80% threshold requires `len(haul_lookup) / total_merged_count`. `total_merged_count` must be passed to `compute_accuracy_backtest` or computed from the lookup's construction context. See Open Questions #1.
- **Modifying `predicted_mean` / `actual_mean` in MC mode:** The `bucket_sum_predicted` and `bucket_sum_actual` accumulators remain `xpts_predicted` / `actual_pts` regardless of MC mode. Only `predicted_rate` changes. Claude's Discretion allows zeroing them in MC mode but the default is to keep them.
- **Using raw `haul_prob` count across the population instead of per-player `haul_prob` averaged within each decile:** The CONTEXT.md phase notes call this out explicitly as the central pitfall. `predicted_rate = mean(haul_prob per bucket)`, not `count(actual >= 10) / total`.
- **Preserving `calibration_mode` across runs like other gate flags:** Unlike `mc_enabled`, `bonus_predictor_enabled`, etc., `calibration_mode` is recomputed each run from current coverage. Do NOT use `_read_existing_*_flag` pattern for this field.
- **Rendering mode badge in cold-start branch:** Mode badge only renders in the non-cold-start populated branch (lines 62–76 of the component). Cold-start path is unchanged from Phase 103.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decile bucket assignment | Custom percentile logic | `min(int(rank_idx * 10 / n), 9)` — already in `_compute_calibration_data` | This exact expression handles edge cases (last element always decile 9) |
| Badge colour lookup | Inline ternary | `MODE_BADGE_CLASSES` Record + `TIER_BADGE_CLASSES` existing pattern | Pattern already established in the component — maintain consistency |
| 80% coverage threshold | Separate configuration | Inline constant consistent with Phase 103 position-pool guard (50-obs threshold) | Keep thresholds co-located with logic |

---

## Common Pitfalls

### Pitfall 1: coverage_pct denominator is `len(merged)`, not `len(merged_haul_lookup)`
**What goes wrong:** `compute_accuracy_backtest` receives `merged_haul_lookup` (pre-filtered, only players with `haul_prob != None`) but does NOT receive `merged` directly. To compute `coverage_pct = len(haul_lookup) / total`, the function needs total player count.
**Why it happens:** The existing function signature takes `summaries`, `finished_gws`, `bootstrap`, `fixtures` — none of these directly gives the merged player count. `merged_haul_lookup` only contains the haul-prob-present players.
**How to avoid:** Either (a) pass a `total_merged_count: int` parameter alongside `merged_haul_lookup`, or (b) compute coverage in `run.py` before calling `compute_accuracy_backtest` and pass a `coverage_pct: float` parameter instead. Option (b) is simpler and avoids adding another parameter. [ASSUMED — planner must pick approach]
**Warning signs:** `coverage_pct` consistently equals 1.0 even when some players should be missing (because `len(haul_lookup) / len(haul_lookup) == 1.0`).

### Pitfall 2: `_empty_backtest` also needs `calibration_mode`
**What goes wrong:** `_empty_backtest` (called when `finished_gws < 1`) builds a summary dict and must also include `calibration_mode` to avoid undefined errors on the UI side.
**Why it happens:** Every gate flag added to `compute_accuracy_backtest.summary` must be mirrored in `_empty_backtest.summary`.
**How to avoid:** Add `calibration_mode: 'analytical'` (or `'mc'` if `mc_enabled` and coverage ≥ 80%) to the `_empty_backtest` summary dict. Since `_empty_backtest` has no `merged_haul_lookup` available, default to `'analytical'`.
**Warning signs:** UI silently omits mode badge on first pipeline run with no finished GWs.

### Pitfall 3: `b.bucket_mid` vs `b.predicted_rate` in existing tests
**What goes wrong:** The existing `CalibrationHealthIndicator.test.tsx` uses `makeBucket` helper which sets `predicted_rate: bucket_mid`. After the bug fix (D-11), the component uses `b.predicted_rate`. The tests will still pass since `predicted_rate == bucket_mid` in the helper — but NEW tests for MC mode must use `predicted_rate != bucket_mid` fixtures to actually exercise the fix.
**Why it happens:** Analytical backward compat means `predicted_rate === bucket_mid` always in existing tests.
**How to avoid:** New MC-path component tests should construct buckets with `predicted_rate` set to a haul_prob mean value (e.g., `0.08`) distinct from `bucket_mid` (e.g., `0.05`) so `maxDeviation` computation diverges between the two fields.

### Pitfall 4: `mc_enabled` is `None` in current production cache
**What goes wrong:** The current `accuracy_backtest.json.summary` has `mc_enabled: null` (None in Python) because the file predates the Phase 90 `mc_enabled` field. On the first run after Phase 109 ships, `run.py` line 204 (`mc_enabled = MC_ENABLED`) sets `mc_enabled = True`. The `_read_existing_mc_enabled_flag` helper would return `False` from the stale cache. But `run.py` overrides this with `MC_ENABLED = True` anyway, so this is not a bug — the first run after Phase 109 will correctly set `use_mc = True`.
**Why it happens:** Gate flag evolution — `mc_enabled` wasn't written to summary until Phase 90, and the cache hasn't been refreshed by a run with Phase 90 code since the flag is read and written on each run.
**How to avoid:** No special handling needed. The `run.py` line 204 override (`mc_enabled = MC_ENABLED`) ensures the flag is always True in production.

### Pitfall 5: `bucket_haul_prob` denominator must use per-GW observation count
**What goes wrong:** If `bucket_haul_prob[pk][d]` sums `effective_haul_prob` across multiple GWs, the mean must be divided by the count of observations in that bucket across all GWs (i.e., `bucket_total[pk][d]`), not just the count from a single GW.
**Why it happens:** Per-GW iteration accumulates haul_prob values from each GW a player appears. The divisor is the total number of observations in that bucket, which is `bucket_total[pk][d]`.
**How to avoid:** Use `bucket_total[pk][d]` as the divisor: `predicted_rate = bucket_haul_prob[pk][d] / bucket_total[pk][d]`. No separate counter needed.

---

## Code Examples

### Current `_compute_calibration_data` signature and call site

```python
# Source: pipeline/accuracy.py line 496
def _compute_calibration_data(per_gw_rows: dict) -> dict:

# Call site (accuracy.py line 349):
calibration = _compute_calibration_data(per_gw_rows)
```

After Phase 109:
```python
# New signature (CONTEXT.md D-07):
def _compute_calibration_data(
    per_gw_rows: dict,
    use_mc: bool = False,
    merged_haul_lookup: dict = None,
) -> dict:

# New call site:
calibration = _compute_calibration_data(per_gw_rows, use_mc=use_mc, merged_haul_lookup=merged_haul_lookup)
```

### run.py integration point

```python
# Source: pipeline/run.py line ~325 — current call
backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir)

# After Phase 109 (CONTEXT.md D-01):
haul_lookup = {p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}
backtest_data = compute_accuracy_backtest(
    summaries, finished_gws, bootstrap, fixtures,
    cache_dir=cache_dir,
    merged_haul_lookup=haul_lookup,
)
```

### `AccuracySummary` type addition

```typescript
// Source: src/lib/types.ts lines 343–358
export interface AccuracySummary {
  // ... existing fields ...
  mc_enabled?: boolean               // Phase 90 MC-01
  calibration_mode?: 'mc' | 'analytical'  // Phase 109 MC-CAL-01
}
```

### Existing bucket assembly in `_compute_calibration_data` (lines 558–568 of accuracy.py)

```python
# Current (to be extended):
buckets.append({
    'bucket_mid': bucket_mids[d],
    'predicted_rate': bucket_mids[d],  # Phase 109: becomes mean(haul_prob) in MC mode
    'actual_rate': round(haul / total, 4),
    'sample_n': total,
    'predicted_mean': round(bucket_sum_predicted[pos_key][d] / total, 2),
    'actual_mean':    round(bucket_sum_actual[pos_key][d]    / total, 2),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `predicted_rate = bucket_mid` (analytical decile rank proxy) | `predicted_rate = mean(haul_prob)` in MC mode | Phase 109 | Reliability diagram X-axis now reflects actual probability clusters from 10k sims |
| No mode indicator on CalibrationHealthIndicator | Teal `MC` / Zinc `Analytical` badge | Phase 109 | Manager can verify which calibration evidence they are reading |
| `maxDeviation = max(abs(actual_rate - bucket_mid))` | `maxDeviation = max(abs(actual_rate - predicted_rate))` | Phase 109 bug fix | Tier calculation (`good`/`fair`/`poor`) is correct in MC mode |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bucket_total[pk][d]` is the correct divisor for `mean(haul_prob)` per bucket (equivalent to a separate `bucket_haul_count` accumulator since both increment by 1 per observation) | Common Pitfalls / Pitfall 5 | Wrong mean if a separate accumulator is needed — but logically they are identical |
| A2 | Option (b) for coverage_pct — compute in `run.py` and pass as a parameter, OR pass `total_merged_count` — planner must choose | Common Pitfalls / Pitfall 1 | If not resolved at planning time, `compute_accuracy_backtest` will compute incorrect coverage_pct |
| A3 | `_empty_backtest` should default `calibration_mode` to `'analytical'` (no merged data available in that path) | Common Pitfalls / Pitfall 2 | If omitted entirely, legacy cache may cause UI issues on first no-GW run post-Phase-109 |

---

## Open Questions

1. **coverage_pct denominator in `compute_accuracy_backtest`**
   - What we know: `merged_haul_lookup` is pre-filtered (only players with `haul_prob != None`). The function doesn't receive `merged` directly.
   - What's unclear: Should `compute_accuracy_backtest` gain a `total_merged_count: int = 0` parameter, or should `run.py` compute `coverage_pct` and pass it directly? Both work.
   - Recommendation: Pass `total_merged_count` alongside `merged_haul_lookup` for transparency. Or compute coverage in run.py and pass the already-computed bool `mc_use_enabled: bool` as a simpler option. CONTEXT.md D-03 says the computation happens in `compute_accuracy_backtest` — so `total_merged_count` is the cleaner approach.

2. **`bucket_sum_predicted` / `bucket_sum_actual` in MC mode**
   - What we know: Claude's Discretion allows planner to zero these out or preserve them in MC mode.
   - What's unclear: In MC mode, `predicted_mean` (from `xpts_predicted` accumulator) has different semantics from `predicted_rate` (from `haul_prob` mean). This could confuse downstream chart consumers.
   - Recommendation: Preserve the existing behaviour (keep `xpts_predicted` accumulators in MC mode). The `predicted_mean` field documents "average xPts in this decile bucket" which is still valid information regardless of which sort path was used.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | pipeline/accuracy.py | ✓ | 3.11.x | — |
| pytest | pipeline test suite | ✓ | 8.3.5 | — |
| vitest | TS component tests | ✓ | 4.1.2 | — |
| `haul_prob` field in merged_players.json | MC calibration path | ✓ | 100% coverage (832/832 players) | Falls back to analytical mode (coverage < 80%) |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Python framework | pytest 8.3.5 |
| Python config | `pipeline/tests/conftest.py` (sys.path injection) |
| Python quick run | `python3 -m pytest pipeline/tests/test_accuracy.py -q` |
| Python full suite | `python3 -m pytest pipeline/tests/ -q` |
| TS framework | Vitest 4.1.2 |
| TS config | `vitest.config.ts` (jsdom, `@` alias) |
| TS quick run | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` |
| TS full suite | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-CAL-01 | `calibration_mode: 'mc'` written to summary when `mc_enabled AND coverage >= 80%` | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -k "calibration_mode" -x` | ❌ Wave 0 |
| MC-CAL-01 | `predicted_rate = mean(haul_prob)` per bucket in MC path | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -k "mc_path" -x` | ❌ Wave 0 |
| MC-CAL-01 | Analytical fallback when `mc_enabled=False` or coverage < 80% | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -k "analytical_fallback" -x` | ❌ Wave 0 |
| MC-CAL-01 | Missing-player `effective_haul_prob = 0.0` absorbed without NaN | unit | `python3 -m pytest pipeline/tests/test_accuracy.py -k "missing_haul_prob" -x` | ❌ Wave 0 |
| MC-CAL-02 | Mode badge renders teal `MC` when `calibration_mode === 'mc'` | unit | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | ❌ Wave 0 |
| MC-CAL-02 | Mode badge renders zinc `Analytical` when `calibration_mode === 'analytical'` | unit | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | ❌ Wave 0 |
| MC-CAL-02 | Mode badge absent when `calibration_mode` is undefined (legacy cache) | unit | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | ❌ Wave 0 |
| MC-CAL-02 | Bug fix: `maxDeviation` uses `predicted_rate` (diverges from `bucket_mid` in MC) | unit | `npx vitest run src/components/squad/CalibrationHealthIndicator.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run for the affected file (Python or TS as appropriate)
- **Per wave merge:** Full Python suite + full Vitest suite
- **Phase gate:** Both full suites green before `/gsd-verify-work`

### Wave 0 Gaps

**Python (pipeline/tests/test_accuracy.py):**
- [ ] `test_calibration_mode_mc_written_to_summary` — covers MC-CAL-01 (mode field in summary)
- [ ] `test_calibration_mc_path_predicted_rate` — covers MC-CAL-01 (predicted_rate = mean haul_prob)
- [ ] `test_calibration_mc_path_sort_order` — covers MC-CAL-01 (sort by haul_prob not xpts)
- [ ] `test_calibration_analytical_fallback_when_mc_disabled` — covers MC-CAL-01 (fallback path)
- [ ] `test_calibration_mc_coverage_threshold` — covers MC-CAL-01 (80% gate)
- [ ] `test_calibration_missing_haul_prob_defaults_zero` — covers MC-CAL-01 (graceful degradation D-06)
- [ ] `test_calibration_mode_analytical_when_coverage_below_threshold` — covers MC-CAL-01

**TypeScript (src/components/squad/CalibrationHealthIndicator.test.tsx):**
- [ ] `renders MC badge in teal when calibration_mode is mc` — covers MC-CAL-02
- [ ] `renders Analytical badge in zinc when calibration_mode is analytical` — covers MC-CAL-02
- [ ] `mode badge absent when calibration_mode is undefined` — covers MC-CAL-02 (legacy cache compat)
- [ ] `mode badge not rendered in cold-start branch` — covers MC-CAL-02
- [ ] `maxDeviation uses predicted_rate not bucket_mid` — covers D-11 bug fix

*(Existing 34 Python + 9 TS tests remain green — no regressions expected from the additive changes)*

---

## Security Domain

This phase makes no network calls, introduces no new endpoints, handles no user input, and adds no authentication surface. No ASVS categories apply. `security_enforcement` is not explicitly set in config — but this phase is a pure pipeline transform + UI label addition with no security-relevant surfaces.

---

## Sources

### Primary (HIGH confidence)
- `pipeline/accuracy.py` (lines 496–571) — `_compute_calibration_data` implementation verified by direct read
- `pipeline/accuracy.py` (lines 121–411) — `compute_accuracy_backtest` implementation verified by direct read
- `pipeline/run.py` (lines 190–327) — `MC_ENABLED = True`, `compute_accuracy_backtest` call site, `merged` list scope — verified by direct read
- `src/components/squad/CalibrationHealthIndicator.tsx` — current component (line 56 `b.bucket_mid` bug) — verified by direct read
- `src/lib/types.ts` (lines 343–479) — `AccuracySummary`, `CalibrationBucket`, `CalibrationData` types — verified by direct read
- `.planning/phases/109-mc-enabled-calibration-v1-19-see-planning-milestones-v1-19-r/109-CONTEXT.md` — all locked decisions D-01 through D-11
- `.planning/phases/109-mc-enabled-calibration-v1-19-see-planning-milestones-v1-19-r/109-UI-SPEC.md` — mode badge Tailwind classes, copy contract, accessibility

### Secondary (MEDIUM confidence)
- `pipeline/cache/merged_players.json` — confirmed `haul_prob` present on all 832 players (100% coverage) via Python inspection
- `pipeline/cache/accuracy_backtest.json` — confirmed `mc_enabled: null` in current cache (stale, pre-Phase-90 write), `calibration_mode: null` (not yet written)
- `pipeline/tests/test_accuracy.py` — 34 existing tests all passing, test structure/helpers understood
- `src/components/squad/CalibrationHealthIndicator.test.tsx` — 9 existing tests all passing

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing versions confirmed
- Architecture: HIGH — all modification surfaces read directly from codebase
- Pitfalls: HIGH (P1–P3 from direct code analysis) / MEDIUM (P4–P5 inferred from patterns)
- Test gaps: HIGH — Wave 0 gaps are exhaustive and derived from requirements

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable codebase, no fast-moving external dependencies)
