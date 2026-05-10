# Phase 91: Calibration Charts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 91-calibration-charts
**Areas discussed:** Chart coexistence, X-axis semantics

---

## Chart Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Both charts, stacked | Keep haul-rate chart; add xPts-mean chart below it in CalibrationSection | ✓ |
| Replace haul-rate with xPts | Remove haul-rate chart, ship only xPts chart | |
| Tabs — one chart, two modes | Toggle 'Haul Rate' / 'xPts Mean' in a single chart container | |

**User's choice:** Both charts stacked
**Notes:** The two charts answer different questions and are complementary. Phase 63's haul-rate chart stays unchanged.

---

## X-axis Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| x = predicted_mean pts | X = mean predicted xPts (absolute), Y = actual_mean pts; y=x diagonal valid | ✓ |
| x = bucket_mid (0–1), two lines | X = decile rank, two lines (predicted/actual); no y=x diagonal | |

**User's choice:** x = predicted_mean pts (selected the ASCII mockup showing over/under-prediction vs y=x)
**Notes:** Both axes in points → y=x diagonal is geometrically valid. Points above diagonal = over-prediction, below = under-prediction.

---

## Claude's Discretion

- Section heading for xPts chart
- Tooltip content format (fields and decimal places)
- Whether to split into sub-components or keep in CalibrationSection inline

## Deferred Ideas

- **GW-targeted transfer recommendations**: User wants to enter a future GW (e.g. GW36) and get player buy recommendations with single-GW vs 3–5 GW context, enabling ahead-of-time transfer planning and saving free transfers. Feature idea raised mid-discussion — belongs in a new roadmap phase, not Phase 91 calibration work.
