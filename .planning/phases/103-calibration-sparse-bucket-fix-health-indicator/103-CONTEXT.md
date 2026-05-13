# Phase 103: Calibration Sparse-Bucket Fix & Health Indicator - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Two surgical fixes to the existing calibration feature:

1. **Sparse-bucket threshold lift** — Raise the per-position filter threshold in `pipeline/accuracy.py` so GK/DEF position tabs no longer show misleading charts at small sample sizes. Also add a position-pool total guard (< 50 observations) that hides the entire chart with an "Insufficient data" banner rather than rendering a near-empty chart.

2. **Calibration health indicator** — Add a one-sentence calibration health summary to the Decision Summary tab, derived from existing `useAccuracy` data (no new fetch, no pipeline extension). Shows at a glance whether today's recommendations are well-calibrated.

No new charting library. No new API routes. No pipeline data model changes (no new fields added). Purely additive React (~30 LOC health indicator) + a 1-line Python threshold change + a 1-line Python pool guard.

</domain>

<decisions>
## Implementation Decisions

### Sparse-Bucket Threshold (Python-only)

- **D-01:** Position-specific thresholds are enforced **in Python only** — in `pipeline/accuracy.py` `_compute_calibration_data` (line 542). The single `if total < 5:` becomes a position-aware check: `< 15` for GK (`'1'`) and DEF (`'2'`), `< 8` for MID (`'3'`) and FWD (`'4'`), unchanged `< 5` for `'all'` (aggregate is ~200 obs/decile and doesn't need raising). Python is the single gate.

- **D-02:** The TypeScript `sample_n >= 5` filters in `CalibrationSection` are **removed entirely** — both the `.filter((b) => b.sample_n >= 5)` on line 349 and the compound predicate on lines 356–358 (`b.sample_n >= 5 && ...`). Whatever Python writes is what the chart renders. No double-filtering.

### Position-Pool Total Guard (Python)

- **D-03:** Before writing per-decile buckets for a position key, Python checks `sum(bucket_total[pos_key].values()) < 50`. If true: `by_position[pos_key] = []; continue` — write an empty array and skip bucket computation. This is the "1-line conditional" described in the ROADMAP.

- **D-04:** Both "pool < 50" and "all decile buckets below position-specific threshold" produce `chartData.length === 0` in TypeScript. Both cases use the **same banner message** — no differentiation needed. The existing "Insufficient sample (n<5)" text is updated to something generic: "Insufficient data for [position] at this sample size." This is consistent with the user's mental model ("come back when there's more data").

### Cold-Start Guard (TypeScript)

- **D-05:** Cold-start detection lives in **TypeScript only**, reading `data.gws_covered.length < 3` from the `AccuracyBacktest` already returned by `useAccuracy()`. No pipeline changes.

- **D-06:** When `gws_covered.length < 3`: both `CalibrationSection` (chart area) and the health indicator show the static prompt "Calibration evidence will appear after 3+ completed GWs." This overrides the pool/sparse banner in CalibrationSection (checked first, before `chartData.length === 0`).

### Calibration Health Indicator

- **D-07:** Component placement: **below the 4-card grid, above `<ProseSummaryBlock>`** in `DecisionSummaryTab.tsx`. A slim full-width row with a small "Model health" label + the one-sentence status text.

- **D-08:** Data source: `calibration?.by_position?.all` from `useAccuracy()` (the aggregate position, ~200 obs/decile, most stable signal). No new hook, no new fetch.

- **D-09:** Deviation metric: **haul-rate deviation** — `max(|actual_rate - predicted_rate|)` across all 'all' position deciles. Displayed as percentage points (pp). Matches the primary calibration reliability diagram.

- **D-10:** 3 tiers based on max deviation:
  - **good**: max deviation < 5pp
  - **fair**: 5–10pp
  - **poor**: > 10pp

- **D-11:** Output format: `"Calibration: [status] — predicted vs actual within [N]pp across [M] deciles"` where N = `Math.round(maxDeviation * 100)`, M = count of buckets in `calibration.by_position.all`.

- **D-12:** If `calibration?.by_position?.all` is empty or absent (legacy pre-Phase 63 cache): component **renders nothing**. Same optional-field pattern as `AccuracyTab`'s `{data.calibration && <CalibrationSection ...>}` guard (line 1097).

- **D-13:** Cold-start case in health indicator: when `gws_covered.length < 3`, render the prompt "Calibration evidence will appear after 3+ completed GWs" instead of the status sentence.

### Claude's Discretion

- Exact Tailwind styling for the health indicator row (colour of "good"/"fair"/"poor" label, font size, border treatment) — use existing patterns from the 4-card grid (zinc border, `bg-white dark:bg-zinc-900` card, small muted text).
- Whether the health indicator row is a card (bordered) or just an inline text row — decide based on what looks proportionate next to the 4-card grid.
- Test strategy: Python tests cover the new threshold logic and pool-total guard; React tests cover health indicator render paths (good/fair/poor, cold-start, absent calibration, empty array).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 103 — Full goal, requirements (R-01/R-02/R-03), phase notes, pitfalls (especially: PMC 7923594 small-bin instability, single-haulting GK shifting actual_rate by 12pp at sample_n≈8)
- `.planning/REQUIREMENTS.md` — Check for any CAL- requirement entries

### Existing calibration pipeline
- `pipeline/accuracy.py` lines 496–557 — `_compute_calibration_data` function. Line 542 is the sparse-bucket filter being changed (D-01). Lines 537–554 are the pos_key loop where the pool guard is added (D-03).

### Existing calibration UI
- `src/components/accuracy/AccuracyTab.tsx` lines 344–443 — `CalibrationSection` component. Lines 347–359 are the two `useMemo` filters being removed (D-02). Lines 436–442 are the existing empty-chart banner being updated (D-04). Line 1097 is the optional-field guard pattern to follow for health indicator (D-12).
- `src/components/accuracy/AccuracyTab.tsx` lines 261–278 — `PositionTabSelector` component (reused, no changes needed)

### Decision Summary tab
- `src/components/squad/DecisionSummaryTab.tsx` lines 674–678 — insertion point for health indicator row (between the 4-card grid close and `<ProseSummaryBlock>`)

### Types
- `src/lib/types.ts` lines 394–403 — `AccuracyBacktest` interface (`gws_covered`, optional `calibration` field)
- `src/lib/types.ts` lines 461–478 — `CalibrationBucket`, `CalibrationData` interfaces (no changes; reading these fields in health indicator)

### Hook
- `src/lib/hooks/useAccuracy.ts` — `useAccuracy()` hook already imported in `GemTable.tsx` and `AccuracyTab.tsx`; add import to `DecisionSummaryTab.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAccuracy()` (`src/lib/hooks/useAccuracy.ts`) — already in query cache; `DecisionSummaryTab` imports it with zero additional fetch. Follow the `data?.calibration?.by_position?.all` optional-chaining pattern.
- `CalibrationSection` (`src/components/accuracy/AccuracyTab.tsx:344`) — receives `data: AccuracyBacktest`; `gws_covered` is on `data` directly, so the cold-start check is `data.gws_covered.length < 3`.
- `ProseSummaryBlock` (`src/components/squad/DecisionSummaryTab.tsx:677`) — the health indicator row slots in immediately before this component.

### Established Patterns
- Optional calibration guard: `{data.calibration && <CalibrationSection data={data} />}` (AccuracyTab line 1097) — health indicator follows the same conditional render.
- Empty-chart overlay: existing `chartData.length === 0` absolute-positioned banner in `CalibrationSection` — update the text, preserve the structure.
- Gate-off silent omission: `undefined` check pattern used throughout (MC fields, gate flags). Health indicator renders nothing when absent — no "unavailable" fallback.
- `BACKTEST_GWS = 5` constant in pipeline — `gws_covered` will have at most 5 entries; `< 3` cold-start guard is safely bounded.

### Integration Points
- Python `_compute_calibration_data`: 1-line threshold change (D-01) + 2-line pool guard added before the per-decile loop writes to `by_position` (D-03). No changes to the function signature or return schema.
- TypeScript `CalibrationSection`: remove two `.filter()` calls (D-02), add cold-start guard before the chart render (D-06), update banner text (D-04).
- TypeScript `DecisionSummaryTab`: add `useAccuracy()` import, slot in new `CalibrationHealthIndicator` component (or inline ~30 LOC) between line 674 and `<ProseSummaryBlock>`.

</code_context>

<specifics>
## Specific Ideas

- Health indicator text example (from ROADMAP): `"Calibration: good — predicted vs actual within 3pp across 4 deciles"` — the format is locked; N and M are dynamic.
- Tier thresholds: good < 5pp, fair 5–10pp, poor > 10pp — derived from the ROADMAP's 3pp "good" example implying sub-5pp is comfortably good.
- Pool-total guard threshold: 50 total observations — locked by ROADMAP requirement R-01.
- Sparse-bucket thresholds: 15 for GK/DEF, 8 for MID/FWD — locked by ROADMAP requirement R-01.
- Cold-start threshold: 3+ completed GWs — locked by ROADMAP requirement R-03.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 103-calibration-sparse-bucket-fix-health-indicator*
*Context gathered: 2026-05-13*
