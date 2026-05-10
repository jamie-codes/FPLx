# Phase 91: Calibration Charts - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

AccuracyTab gains a second calibration chart showing **predicted xPts mean vs actual points mean per decile**, by position — stacked below the existing Phase 63 haul-rate calibration chart. Both charts share the same `CalibrationSection` and `PositionTabSelector`.

**What ships:**
- `pipeline/accuracy.py`: extend `_compute_calibration_data` to also compute `predicted_mean` and `actual_mean` per decile (alongside existing `predicted_rate`/`actual_rate`); extend `CalibrationBucket` output dict with two new fields
- `src/lib/types.ts`: extend `CalibrationBucket` with `predicted_mean?: number` and `actual_mean?: number` (optional for backward compat with Phase 63 caches)
- `AccuracyTab.tsx`: add second chart (`XptsMeanChart` or inline) below the existing haul-rate chart within `CalibrationSection`; x-axis = `predicted_mean` (absolute xPts), y-axis = `actual_mean` (pts), y=x reference diagonal
- `pipeline/tests/test_accuracy.py`: extend calibration tests to cover the two new fields
- `AccuracyTab.test.tsx`: extend existing Phase 63 calibration tests with xPts-mean fixture coverage

**Out of scope:** Replacing the existing haul-rate chart; new pipeline scraping; new API routes; changes to recharts version; new hooks

</domain>

<decisions>
## Implementation Decisions

### Chart Coexistence
- **D-01:** Both charts coexist stacked in `CalibrationSection`. The existing haul-rate chart (Phase 63) stays — it answers "does the model rank haulers at the top?" The new xPts-mean chart is added below — it answers "does predicted xPts match actual points?" They are complementary, not alternatives.
- **D-02:** `PositionTabSelector` (GK / DEF / MID / FWD / All) is shared — one selector controls both charts simultaneously. Do not duplicate the selector.

### xPts-Mean Chart Axes
- **D-03:** X-axis = `predicted_mean` (absolute xPts values, e.g. 1.5–8.0 pts), auto-scaled. Y-axis = `actual_mean` (actual points). Both axes in the same unit (points) so the `y = x` reference diagonal is geometrically valid. `XAxis type="number"` required (Pitfall 4 carried from Phase 63).
- **D-04:** Reference line = `y = x` diagonal (dashed, same styling as the haul-rate chart's reference line). Points above the diagonal = model over-predicts; points below = under-predicts. This is the standard continuous calibration chart.
- **D-05:** The y=x reference line spans from `(0, 0)` to `(max_predicted, max_predicted)` using recharts `ReferenceLine segment={[{x:0,y:0},{x:max,y:max}]}` where `max` is auto-derived from chart data. Use `ifOverflow="extendDomain"` to keep it visible.

### Type Extension
- **D-06:** Extend the existing `CalibrationBucket` interface in `src/lib/types.ts` with two new **optional** fields: `predicted_mean?: number` and `actual_mean?: number`. The existing `predicted_rate` and `actual_rate` fields are preserved unchanged. Legacy caches (Phase 63 output without new fields) remain valid — components guard with `?? []` or `b.predicted_mean != null`.
- **D-07:** `_compute_calibration_data` in `pipeline/accuracy.py` already computes per-decile aggregates — extend it to also accumulate `sum_predicted` and `sum_actual` per bucket, then compute `predicted_mean = sum_predicted / sample_n` and `actual_mean = sum_actual / sample_n`. No new helper function needed.

### Claude's Discretion
- Section heading for the new chart: something like "xPts Accuracy (Mean)" or "Predicted vs Actual xPts" — builder chooses what's clearest
- Tooltip format for the new chart: show `predicted_mean` (2 dp), `actual_mean` (2 dp), `sample_n`, deviation `actual - predicted`
- Dot rendering: same style as haul-rate chart (`r=3`, `activeDot r=5`)
- Whether to render both charts in a single `CalibrationSection` function or split into named sub-components — builder's call

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 91 — full success criteria (SC-1 through SC-5), plan breakdown (091-01 through 091-04), cross-cutting constraints, phase notes
- `.planning/REQUIREMENTS.md` — CAL-01 requirement definition

### Existing Pipeline Code
- `pipeline/accuracy.py` — `_compute_calibration_data` (line 496): the function to extend with `predicted_mean`/`actual_mean` accumulation; existing `bucket_haul`/`bucket_total` pattern shows how to add `bucket_sum_predicted`/`bucket_sum_actual` accumulators
- `pipeline/accuracy.py` lines 348–349: calibration call site in `compute_accuracy_backtest`
- `pipeline/accuracy.py` line 492: `_empty_backtest` cold-start fallback — must include `predicted_mean`/`actual_mean` empty lists (or omit them; both are optional)
- `pipeline/tests/test_accuracy.py` lines 453–534: existing Phase 63 calibration tests — extend these for new fields

### Existing UI Code
- `src/components/accuracy/AccuracyTab.tsx` lines 216–356: existing `PositionTabSelector`, `CalibrationTooltip`, and `CalibrationSection` — the new xPts chart is a second section within the same `CalibrationSection` function
- `src/components/accuracy/AccuracyTab.tsx` line 825: `{data.calibration && <CalibrationSection data={data} />}` render site — no change needed here
- `src/lib/types.ts` lines 454–470: existing `CalibrationBucket` and `CalibrationData` interfaces — extend `CalibrationBucket` with two optional fields

### Prior Phase Context
- `.planning/phases/90-monte-carlo-simulation-pipeline/90-CONTEXT.md` — most recent context; recharts Pitfall 4 (`XAxis type="number"`) and Pitfall 6 (optional calibration field) noted
- `.planning/phases/88-fpl-news-flags-ui/88-CONTEXT.md` — gate pattern reference (canonical gate = read from `accuracy_backtest.json`)

### Cross-Cutting Constraints (from ROADMAP §Phase 91)
- `XAxis` MUST have `type="number"` for 0-to-max numeric domain — Pitfall 4 from Phase 63
- `@types/recharts` MUST NOT be installed — v1 incompatibility per Phase 62/63
- `calibration` field stays OPTIONAL on `AccuracyBacktest` — legacy cache compatibility (Pitfall 6 from Phase 63)
- Sparse-bucket filter (`b.sample_n >= 5`) lives at the component edge, not pipeline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PositionTabSelector` (`AccuracyTab.tsx:216`): already accepts `value`/`onChange` props; shared between both charts; no changes needed
- `CalibrationTooltip` (`AccuracyTab.tsx:252`): renders `predicted_rate`/`actual_rate` — a second tooltip component for the xPts chart is needed (reads `predicted_mean`/`actual_mean`)
- `CalibrationSection` (`AccuracyTab.tsx:272`): extend this function to render the second chart below the existing one
- `recharts` imports already in `AccuracyTab.tsx`: `ComposedChart`, `Line`, `ReferenceLine`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` — no new imports needed
- `_compute_calibration_data` (`pipeline/accuracy.py:496`): already iterates per-decile per-GW with `bucket_haul`/`bucket_total` dictionaries — add parallel `bucket_sum_predicted` and `bucket_sum_actual` dictionaries for xPts accumulation

### Established Patterns
- **Sparse filter at component edge**: `all.filter(b => b.sample_n >= 5)` already in `CalibrationSection:275` — apply same filter to xPts chart data
- **Optional calibration field**: `data.calibration?.by_position?.[position] ?? []` guard already in place
- **`XAxis type="number"` with auto domain**: existing haul-rate chart uses fixed `[0,1]`; xPts chart needs auto-scaled domain from `predicted_mean` values — use recharts default auto domain, not hardcoded
- **`ReferenceLine segment`**: existing chart uses `segment={[{x:0,y:0},{x:1,y:1}]}` for the haul-rate diagonal; xPts chart needs dynamic max value

### Integration Points
- `CalibrationSection` renders in `AccuracyTab` at line 825 — no change to render site
- `CalibrationBucket` in `src/lib/types.ts:454` — add optional fields there only
- `_compute_calibration_data` output dict in `pipeline/accuracy.py:540` — add `predicted_mean` and `actual_mean` keys to each bucket dict

</code_context>

<specifics>
## Specific Ideas

- User confirmed the chart design: scatter/line plot with x=predicted_mean, y=actual_mean, dashed y=x diagonal. Points above diagonal = over-prediction, points below = under-prediction. (Selected the ASCII mockup showing this layout.)
- Both existing haul-rate chart and new xPts chart remain — the xPts chart is additive, not a replacement.
- The `PositionTabSelector` controls both charts at once — single selector for both.

</specifics>

<deferred>
## Deferred Ideas

- **GW-targeted transfer recommendations**: User wants to enter a future gameweek (e.g. GW36) and get player buy recommendations with single-GW vs multi-GW (3–5 GW) context, to plan transfers ahead and save free transfers. This is a planning horizon feature, not a calibration feature — belongs in a future phase (likely a new phase in the roadmap). Note for backlog.

</deferred>

---

*Phase: 91-calibration-charts*
*Context gathered: 2026-05-10*
