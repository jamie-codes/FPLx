# Phase 54: Price Change Predictor — Discussion Log

**Date:** 2026-05-02
**Areas discussed:** 4 (Decision tab 5th card, Progress indicator, Prediction algorithm, Panel layout)

---

## Area 1: Decision Tab 5th Card

**Question:** Should Phase 54 include the optional 5th card in DecisionSummaryTab filtered to squad-owned players?

| Option | Description |
|--------|-------------|
| Analyse-only ✓ | PriceChangePanel ships under Analyse as a standalone sub-tab. No change to DecisionSummaryTab. |
| Both — Analyse + 5th card | Also add a compact card to DecisionSummaryTab, filtered to owned players. |
| 5th card only | Skip standalone panel, surface only within Decision Summary. |

**Selected:** Analyse-only

**Notes:** ROADMAP SC-3 already scopes to the Analyse section. The optional 5th card (ARCHITECTURE.md's "highest-value integration point") is deferred to v1.8.1 — standalone panel ships first to validate the data model.

---

## Area 2: Progress Indicator

**Question:** What does the 'progress indicator' in the ROADMAP goal actually mean in the UI?

| Option | Description |
|--------|-------------|
| Mini progress bar per player ✓ | Small bar filling left-to-right as net transfers accumulate toward threshold. |
| eta_days text only | Just show '~1 day' / '~2 days' as a text badge. |
| Progress bar + eta_days badge | Both the bar and a day count label. |

**Selected:** Mini progress bar per player

**Notes:** Bar fills proportionally to `confidence_pct` (0–100%). Most visually communicates "how close" without requiring number parsing. `eta_days` shown as supplementary text ("Tonight" when ≤0).

---

## Area 3: Prediction Algorithm

**Question:** How should confidence_pct and eta_days be derived?

| Option | Description |
|--------|-------------|
| Threshold-based (FPL rule) ✓ | `confidence_pct = clamp(cumulative_net / threshold, 0, 1) × 100`. Threshold ≈ `selected_by_percent × 10`. eta_days from daily velocity. |
| Velocity heuristic | Rank players by 7-day net transfer velocity. Top 20% = HIGH, next 30% = MEDIUM. |
| Hybrid | Threshold progress for confidence_pct + velocity for eta_days. |

**Selected:** Threshold-based (FPL rule)

**Notes:** Deterministic and auditable. Models FPL's actual midnight price-change mechanism. Approximation `selected_by_percent × 10` is calibratable after shadow run. No ML model needed.

---

## Area 4: Panel Layout

**Question:** What's the primary grouping in PriceChangePanel?

| Option | Description |
|--------|-------------|
| Direction-first ✓ | Two sections: rise / fall. Within each, sorted by confidence_pct descending. |
| Confidence-first | Three sections: HIGH / MEDIUM / LOW. Rise and fall rows mixed within each tier. |

**Selected:** Direction-first

**Notes:** Manager intent is always "which risers/fallers should I act on?" — direction is the actionable signal. Confidence is a sort key within each direction. Stable players omitted from view. This differs from SC-3's literal wording ("grouped by HIGH/MEDIUM/LOW confidence") but is more usable — CONTEXT.md takes precedence.

---

## Claude's Discretion Items

- Exact threshold formula until calibration data available
- Whether stable players get a collapsed section vs. full omission
- Mobile layout: stacked rows per InsightsTab pattern
- Internal naming of snapshot helper functions in `price_changes.py`

---

## Deferred Ideas Captured

1. **DecisionSummaryTab 5th card** — highest-value integration but deferred to v1.8.1 (standalone panel validates model first)
2. **MergedPlayer predicted_rise/fall fields** — no schema bloat until v1.8.1
3. **Precision tracking mechanism** (how 70% precision threshold from SC-4 is measured) — deferred to calibration phase
