# Phase 103: Calibration Sparse-Bucket Fix & Health Indicator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 103-calibration-sparse-bucket-fix-health-indicator
**Areas discussed:** Sparse filter layer, Pool-total detection, Health indicator design

---

## Sparse Filter Layer

**Q1: Where should the position-specific sparse-bucket threshold be enforced?**

| Option | Description | Selected |
|--------|-------------|----------|
| Python only | Edit pipeline/accuracy.py line 542 to use position-specific thresholds; remove TS filter | ✓ |
| TypeScript only | Keep Python at < 5; apply position-specific filtering at CalibrationSection component edge | |
| Both layers | Python raises threshold + TypeScript also filters defensively | |

**User's choice:** Python only

---

**Q2: What happens to the existing TypeScript sample_n >= 5 filter?**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | Delete .filter(b => b.sample_n >= 5) from both useMemo callbacks | ✓ |
| Change it to match | Update TypeScript to use position-specific thresholds as defensive guard for legacy caches | |

**User's choice:** Remove it

---

**Q3: Confirm 'all' position keeps < 5 threshold?**

| Option | Description | Selected |
|--------|-------------|----------|
| Correct — keep 'all' at < 5 | Aggregate has ~200 obs/decile; existing threshold is fine | ✓ |
| Raise 'all' too | Apply new threshold to aggregate as well | |

**User's choice:** Confirmed — 'all' stays at < 5

---

## Pool-Total Detection

**Q1: Where should the position-pool < 50 guard run?**

| Option | Description | Selected |
|--------|-------------|----------|
| Python pipeline | Check sum(bucket_total[pos_key].values()) < 50 before writing; write empty array if so | ✓ |
| TypeScript component edge | Sum sample_n from returned buckets; approximate but no new fields | |

**User's choice:** Python pipeline

---

**Q2: Differentiate "pool < 50" vs "all buckets too sparse" banner?**

| Option | Description | Selected |
|--------|-------------|----------|
| Single banner is fine | Both cases show same "Insufficient data" message | ✓ |
| Differentiate them | Add pool_total field to JSON; show different messages per case | |

**User's choice:** Single banner — both cases mean "come back when there's more data"

---

**Q3: Cold-start detection location?**

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript from gws_covered.length | Read data.gws_covered.length < 3 in TS; no pipeline changes | ✓ |
| Python: write empty arrays when finished_gws < 3 | Pipeline emits empty for all positions; loses distinct cold-start message | |

**User's choice:** TypeScript from gws_covered.length

---

## Health Indicator Design

**Q1: Status tier structure?**

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tiers: good / fair / poor | good < 5pp, fair 5–10pp, poor > 10pp; from 'all' position haul-rate deviation | ✓ |
| 2 tiers: calibrated / uncalibrated | Simpler binary | |
| You decide the thresholds | Just confirm 3 tiers is the right shape | |

**User's choice:** 3 tiers: good / fair / poor

---

**Q2: Deviation metric?**

| Option | Description | Selected |
|--------|-------------|----------|
| Haul-rate deviation | max(|actual_rate - predicted_rate|) across 'all' deciles; pp units | ✓ |
| xPts-mean deviation | max(|actual_mean - predicted_mean|) in xPts points; Phase 91 CAL-01 fields | |

**User's choice:** Haul-rate deviation

---

**Q3: Placement on DecisionSummaryTab?**

| Option | Description | Selected |
|--------|-------------|----------|
| Below 4-card grid, above ProseSummaryBlock | Slim full-width row with "Model health" label + one-sentence status | ✓ |
| Inside a card as a row | Add to one of the existing 4 cards | |
| As a small footer footnote | Below ProseSummaryBlock; least prominent | |

**User's choice:** Below 4-card grid, above ProseSummaryBlock

---

**Q4: Absent calibration data behaviour?**

| Option | Description | Selected |
|--------|-------------|----------|
| Render nothing | Only render when calibration?.by_position?.all has >= 1 bucket | ✓ |
| Show 'unavailable' message | Render dim "Calibration: unavailable" text | |

**User's choice:** Render nothing — follows same pattern as AccuracyTab optional calibration block

---

## Claude's Discretion

- Exact Tailwind styling for the health indicator row (colour of status tier label, font size, border treatment)
- Whether health indicator is a bordered card or an inline text row

## Deferred Ideas

None — discussion stayed within phase scope.
