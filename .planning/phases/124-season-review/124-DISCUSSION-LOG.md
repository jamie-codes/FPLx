# Phase 124: Season Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 124-season-review
**Areas discussed:** xPts overlay on rank chart, API route architecture, Grade thresholds (A–D), Sub-tab placement & scope

---

## xPts Overlay on Rank Chart

| Option | Description | Selected |
|--------|-------------|----------|
| Average manager score | Each GW's average_entry_score from bootstrap events[]. Existing data, one call. | ✓ |
| Rolling own average | User's personal rolling average up to each GW. Pure client-side. | |
| Drop the overlay | Just rank trajectory + chip markers. No overlay. | |

**User's choice:** Average manager score

---

### Chart primary axis

| Option | Description | Selected |
|--------|-------------|----------|
| Points (Recommended) | GW score as main line, average score as overlay, rank in tooltip | ✓ |
| Overall rank | Rank trajectory as main line (inverted y-axis) | |

**User's choice:** Points

---

### Average score data source

| Option | Description | Selected |
|--------|-------------|----------|
| FPL bootstrap events[] | Single call, average_entry_score per event. All 38 GWs. | ✓ |
| Blob gw_review_gw{N}.json reads | Up to 38 reads per load. | |

**User's choice:** FPL bootstrap events[]

---

### Rank display

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip only | Hover shows GW, your score, avg, rank. No second axis. | ✓ |
| Second y-axis (right) | Rank as dashed line on secondary axis (inverted). | |

**User's choice:** Tooltip only

---

## API Route Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| New /api/season-review route | Single endpoint, history + bootstrap, returns SeasonReview type. | ✓ |
| Client-side composition | useDecisionHistory + useSeasonAnalytics + new small hook. 3 parallel fetches. | |
| Extend /api/season-analytics | Add history/rank to existing route. Type grows beyond original scope. | |

**User's choice:** New /api/season-review route

---

### Captain hit rate sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| Shared lib function | Extract captain EV rate logic from decision-history route into shared lib. | ✓ |
| Client-side grade only | Season-review route skips captain data; grade computed client-side after both hooks load. | |

**User's choice:** Shared lib function

---

## Grade Thresholds (A–D)

| Option | Description | Selected |
|--------|-------------|----------|
| Quartile-like: A≥75%, B≥50%, C≥25%, D<25% | Simple, defensible. Easy to recalibrate. | ✓ |
| Strict: A≥80%, B≥65%, C≥50%, D<50% | Higher bar; most managers land C or D. | |
| Skip letter grade | Show raw weighted score + 3 component bars instead. | |

**User's choice:** Quartile-like thresholds

---

### No-chip edge case

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded from weighting | Chip ROI drops out; remaining two components renormalized to 100%. | ✓ |
| Score as 0% | Penalizes chip-saving. | |
| Score as 100% | Rewards chip-saving too generously. | |

**User's choice:** Excluded from weighting

---

## Sub-tab Placement & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| After Accuracy | Gems, Insights, DefCon, SP, Form, Accuracy, **Season**, Prices. Decision-quality neighbours. | ✓ |
| Last (after Price Changes) | End of list. | |
| First (before Gems) | Prominent but unusual placement for end-of-season tool. | |

**User's choice:** After Accuracy

---

### Unauthenticated state

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state card | "Enter your FPL Team ID to see your Season Review". Consistent with AccuracyTab. | ✓ |
| Hide the sub-tab | Don't show 'Season' until teamId available. Dynamic count. | |

**User's choice:** Empty state card (tab always visible)

---

## Claude's Discretion

- Exact layout and visual hierarchy within the summary card (stat ordering, responsive grid vs. flex)
- Tooltip content formatting on the chart
- Loading/skeleton state design for useSeasonReview

## Deferred Ideas

None — discussion stayed within phase scope.

## Side Fix (discovered during session)

Pipeline failure fixed mid-discussion (not part of Phase 124 scope):
- `pipeline/run.py`: removed `import sys` on lines 444 and 465 (inside `run()` function body) — these shadowed the module-level import and caused `UnboundLocalError` in all `sys.stderr` error handlers
- `.github/workflows/pipeline.yml`: added `feedparser==6.0.12` and `rapidfuzz==3.14.5` to CI pip install (missing since Phase 117/123)
- Committed: `fix(pipeline): remove shadowed sys imports in run.py; add feedparser+rapidfuzz to CI`
