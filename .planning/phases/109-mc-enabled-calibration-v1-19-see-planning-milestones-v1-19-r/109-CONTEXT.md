# Phase 109: MC-Enabled Calibration - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the analytical xPts decile-rank proxy (`predicted_rate = bucket_mid`) in `pipeline/accuracy.py` with actual MC `haul_prob` (P(pts ≥ 10) from 10k sims) as the `predicted_rate` in the calibration reliability diagram. Add a `calibration_mode: 'mc' | 'analytical'` field to `accuracy_backtest.json.summary`. Surface which mode is active in `CalibrationHealthIndicator` on the Decision Summary tab via a second mode badge alongside the existing tier badge.

Deliverables:
1. **`pipeline/accuracy.py`** — `_compute_calibration_data()` gains `use_mc: bool` and `merged_haul_lookup: dict[int, float]` parameters; MC path re-sorts players by `haul_prob` descending, computes `predicted_rate = mean(haul_prob per bucket)` per decile; `compute_accuracy_backtest` gains `merged_haul_lookup` parameter and writes `calibration_mode` to summary.
2. **`pipeline/run.py`** — builds `merged_haul_lookup` from current merged list, passes it to `compute_accuracy_backtest`.
3. **`src/components/squad/CalibrationHealthIndicator.tsx`** — second mode badge `[MC]` or `[Analytical]`; bug-fix: `maxDeviation` switches from `b.bucket_mid` to `b.predicted_rate`.
4. **`src/lib/types.ts`** — `AccuracySummary` gains `calibration_mode?: 'mc' | 'analytical'`.
5. **Tests** — Python tests for MC calibration path; component tests for MC/Analytical badge rendering.

**Out of scope:** New API routes, UI chart changes, changes to the AccuracyTab chart rendering, extending `predictions_snapshot.json` with historical haul_prob.

</domain>

<decisions>
## Implementation Decisions

### haul_prob Data Flow

- **D-01:** `compute_accuracy_backtest` gains a new parameter `merged_haul_lookup: dict[int, float]` (player_id → haul_prob). `run.py` builds this dict from the current merged list immediately after the merge step — `{p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}` — and passes it in alongside the existing parameters. No extension of `predictions_snapshot.json`.
- **D-02:** Per-player fallback for players with no `haul_prob` in the lookup (departed players, pipeline gaps): assign `effective_haul_prob = 0.0`, placing them at the bottom of the haul_prob sort order. Their contribution to the bucket mean is 0.0. The "analytical proxy per-player" rule from STATE.md applies at the bucket level — the bucket's `predicted_rate = mean(haul_prob)` absorbs the 0.0 values naturally.
- **D-03:** The 80% threshold is computed in `compute_accuracy_backtest`: `coverage_pct = sum(1 for p in merged if p.get('haul_prob') is not None) / len(merged)`. If `mc_enabled AND coverage_pct >= 0.80`, set `use_mc = True` and write `calibration_mode = 'mc'` to summary; else `use_mc = False` and write `calibration_mode = 'analytical'`. The `use_mc` bool (not raw `mc_enabled`) is passed to `_compute_calibration_data`.
- **D-04:** `calibration_mode: 'mc' | 'analytical'` is written to `accuracy_backtest.json.summary` alongside `mc_enabled`. `CalibrationHealthIndicator` reads it from `data.summary.calibration_mode`. `AccuracySummary` TypeScript type gains `calibration_mode?: 'mc' | 'analytical'`.

### Bucketing Approach (MC Path)

- **D-05:** When `use_mc=True`, `_compute_calibration_data` sorts players by `effective_haul_prob` descending (not by `xpts_predicted`), then divides into 10 equal-population deciles. `predicted_rate = mean(effective_haul_prob)` per bucket replaces `bucket_mid`. Proper reliability diagram — X-axis reflects actual probability clusters, not evenly-spaced rank proxies. Analytical path unchanged: sort by `xpts_predicted`, `predicted_rate = bucket_mid`.
- **D-06:** Players missing from `merged_haul_lookup` get `effective_haul_prob = 0.0`, sorting them into the bottom decile. No special-casing — they are absorbed into whichever bucket their rank places them in.
- **D-07:** `_compute_calibration_data` signature: `(per_gw_rows: dict, use_mc: bool = False, merged_haul_lookup: dict = None)`. When `use_mc=False` or `merged_haul_lookup` is None/empty, the function runs the existing code path without modification. `bucket_mid` is still computed for the `bucket_mid` field in the output (backward compat), but `predicted_rate` is now `mean(haul_prob)` in MC mode.

### CalibrationHealthIndicator Label

- **D-08:** Add a second small badge immediately after the tier badge. Layout: `[good] [MC]  Calibration: good — predicted vs actual within Npp across M deciles`. The existing sentence text is unchanged — only the mode badge is added.
- **D-09:** Badge text: `"MC"` when `calibration_mode === 'mc'`; `"Analytical"` when `calibration_mode === 'analytical'`. Absent (null-render) when `data.summary.calibration_mode` is undefined (legacy cache backward compat).
- **D-10:** Badge colours: MC → teal (`text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900`) consistent with existing MC visual language (`MCDistributionBar` teal fills). Analytical → zinc (`text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800`).
- **D-11:** Bug fix — `maxDeviation` computation switches from `b.bucket_mid` to `b.predicted_rate` so the tier calculation is correct in MC mode where `predicted_rate ≠ bucket_mid`. `CalibrationBucket.predicted_rate` is already in the type; this is a one-line fix in `computeTier`.

### Claude's Discretion

- Whether to rename `merged_haul_lookup` parameter to `haul_prob_lookup` for brevity — both are clear; choose whichever reads better in context.
- Whether `_compute_calibration_data` preserves `bucket_sum_predicted`/`bucket_sum_actual` accumulators in MC mode (these power `predicted_mean`/`actual_mean` per Phase 91 CAL-01). In MC mode these accumulators still reflect `xpts_predicted` — which is fine for `actual_mean` but `predicted_mean` now has different semantics. Planner decides whether to zero these out or keep them in MC mode.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Calibration Surface (primary modification targets)
- `pipeline/accuracy.py` — `_compute_calibration_data()` (lines ~496–580) and `compute_accuracy_backtest()` (lines ~162–410); read both before modifying. The existing sparse-bucket thresholds (GK/DEF ≥15, MID/FWD ≥8, pool guard <50) from Phase 103 D-01/D-03 still apply in the MC path.
- `src/components/squad/CalibrationHealthIndicator.tsx` — current component; the `b.bucket_mid` reference on line 56 is the bug-fix target; `data.summary.calibration_mode` is the new read path.
- `src/lib/types.ts` lines 343–358 (`AccuracySummary`) and lines 461–476 (`CalibrationBucket`) — types that need updating.

### Pipeline Entry Point
- `pipeline/run.py` lines ~325–326 — `compute_accuracy_backtest` call site; `merged` list is already in scope here (built earlier); add lookup build immediately before call.

### MC Field Availability
- `pipeline/run.py` line 194 — `MC_ENABLED = True` constant; confirms `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts` are present in `merged_players.json` for every active player in production.

### Established Gate Pattern
- `pipeline/accuracy.py` `_read_existing_mc_enabled_flag()` (lines ~73–82) — pattern for reading and preserving gate flags across backtest runs; `calibration_mode` does NOT use this pattern (it's derived each run from coverage, not preserved from cache).

### Requirements
- `.planning/REQUIREMENTS.md` §MC-CAL-01, MC-CAL-02 — the 2 requirements this phase closes.

### Phase 103 Calibration Phase (original implementation)
- `.planning/phases/103-calibration-sparse-bucket-fix-health-indicator/` — defines the `CalibrationHealthIndicator` component contract, position-aware thresholds (D-01, D-03), and pool guard logic that Phase 109 must respect.

### Phase 102 MC Gate Activation
- `.planning/phases/102-mc-fields-distribution-bar/` — made `MC_ENABLED = True` permanent; confirms `haul_prob` is always populated for active players in production runs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/accuracy.py:_read_existing_mc_enabled_flag()` — pattern to follow for reading `mc_enabled` from prior cache; `compute_accuracy_backtest` already reads this; the Phase 109 `use_mc` derivation builds on it.
- `CalibrationBucket.predicted_rate` — field already exists in both Python output and TypeScript type; Phase 109 just changes its value from `bucket_mid` to `mean(haul_prob)` in MC mode. No structural JSON change.
- `TIER_BADGE_CLASSES` in `CalibrationHealthIndicator.tsx` — existing Record<Tier, string> pattern; add a parallel `MODE_BADGE_CLASSES` dict for MC/Analytical badge colours.

### Established Patterns
- Gate flags use `_read_existing_*_flag(cache_dir)` to preserve across runs. `calibration_mode` is NOT preserved — it is recomputed each run from current coverage. This is intentional: if MC fields become available (or go missing), the mode updates automatically.
- `defaultdict(lambda: defaultdict(int))` accumulators in `_compute_calibration_data` — MC path adds a parallel `bucket_haul_prob` accumulator (`dict[str, dict[int, float]]`) for summing haul_prob values per bucket.
- `try/except` isolation in run.py — accuracy step is currently unwrapped (not try/except); passing a new parameter doesn't change this.

### Integration Points
- `run.py` line ~325: `backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir)` → becomes `compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures, cache_dir=cache_dir, merged_haul_lookup=haul_lookup)` where `haul_lookup` is built just above.
- `merged` list at run.py line ~216+ — already contains `haul_prob` per player (MC_ENABLED=True); `haul_lookup = {p['id']: p['haul_prob'] for p in merged if p.get('haul_prob') is not None}` is the exact build expression.
- `CalibrationHealthIndicator` in `DecisionSummaryTab.tsx` line 690 — receives `accuracyData`; no prop changes needed; component reads `data.summary.calibration_mode` directly from existing `useAccuracy` hook payload.

</code_context>

<specifics>
## Specific Ideas

- The second mode badge `[MC]` / `[Analytical]` appears AFTER the tier badge, BEFORE the sentence: `[good] [MC] Calibration: good — predicted vs actual within 6pp across 8 deciles`. This matches the existing layout where the tier badge is the first visual element.
- `bucket_mid` field is retained in the MC output for backward compat (charts or future use). Only `predicted_rate` changes value.
- Phase 109 verification (from STATE.md): after first daily pipeline run with Phase 109 merged, confirm `calibration_mode` field appears in `accuracy_backtest.json.summary` and `CalibrationHealthIndicator` renders the MC badge distinctly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 109-MC-Enabled Calibration*
*Context gathered: 2026-05-14*
