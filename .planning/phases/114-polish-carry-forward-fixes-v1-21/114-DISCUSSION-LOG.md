# Phase 114: Polish & Carry-Forward Fixes (v1.21) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 114-polish-carry-forward-fixes-v1-21
**Areas discussed:** Sparkline design, ChipToggle stub, UAT-01 scope

---

## Sparkline Design (SPARK-01)

### Q1: Rendering approach

| Option | Description | Selected |
|--------|-------------|----------|
| Inline SVG path | Draw a tiny polyline directly — no extra imports, ~10 lines | ✓ |
| Recharts LineChart | Uses existing Recharts dep but awkward in a 40px TanStack cell | |

**User's choice:** Inline SVG path
**Notes:** Recharts is already present but unsuitable for a micro-chart cell.

### Q2: Colour encoding

| Option | Description | Selected |
|--------|-------------|----------|
| Trend-coloured | Green if improving, red if falling, zinc if flat/null | ✓ |
| Always zinc | Neutral, no colour coding | |

**User's choice:** Trend-coloured

### Q3: Mobile visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile-hidden | Add to MOBILE_HIDDEN_COLUMNS — follows Signal/Diff/CS% pattern | ✓ |
| Visible on mobile | Show on all screen sizes | |

**User's choice:** Mobile-hidden

### Q4: Column placement

| Option | Description | Selected |
|--------|-------------|----------|
| After xPts_5gw | Immediately contextualises the horizon xPts columns | ✓ |
| After Signal column | Groups with indicator columns | |
| You decide | Claude's discretion | |

**User's choice:** After xPts_5gw

---

## ChipToggle Stub (TRT-02)

### Q1: Implementation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ChipToggle with disabled prop | Add disabled?: boolean to ChipToggle.tsx; opacity-50 + pointer-events-none | ✓ |
| Inline stub in RouteTreeTab only | Duplicate visual pattern without touching ChipToggle.tsx | |

**User's choice:** Extend ChipToggle with disabled prop
**Notes:** Single source of truth preferred over visual duplication.

### Q2: Coming-soon label

| Option | Description | Selected |
|--------|-------------|----------|
| No label — opacity alone is enough | Dim visual is sufficient for a personal tool | ✓ |
| Add a brief note | Render zinc-400 "Chip support coming soon" nearby | |

**User's choice:** No label

---

## UAT-01 Scope

### Q1: Colour polarity — bug or intentional?

| Option | Description | Selected |
|--------|-------------|----------|
| Code is correct — ROADMAP is misleading | delta > 0 = red (engine better) is correct regret semantics; ROADMAP phrasing was ambiguous | ✓ |
| It IS a bug — flip the colour logic | Positive delta should be green | |

**User's choice:** Code is correct — ROADMAP is misleading
**Notes:** BackTab comments explicitly document delta > 0 = engine better = red. The success criterion in ROADMAP.md used "positive delta = green" to mean "user won = green" but that corresponds to delta < 0 in the actual data schema.

### Q2: Code task or verification only?

| Option | Description | Selected |
|--------|-------------|----------|
| Verification task only | Human checkpoint — no code unless regressions found | ✓ |
| Add test coverage too | Add Vitest tests for transfer regret colour logic | |

**User's choice:** Verification task only

---

## Claude's Discretion

- Specific sparkline threshold for "flat": ±0.05 on trend delta (chosen to avoid false colour on minor noise)
- Sparkline SVG dimensions: 40×20px viewBox
- ChipToggle placement in RouteTreeTab: above the route list, mirroring PlannerTab position

## Deferred Ideas

None — discussion stayed within phase scope.
