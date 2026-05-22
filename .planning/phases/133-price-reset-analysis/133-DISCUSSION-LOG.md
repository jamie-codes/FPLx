# Phase 133: Price Reset Analysis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 133-price-reset-analysis
**Areas discussed:** Baseline capture trigger, xPts source for Value Targets, Published state detection, Tab placement

---

## Baseline Capture Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Every run, guarded by idempotency | Runs unconditionally on every pipeline run. The _blob_exists check means it only writes once — same pattern as archive_season.py but without any GW gate. Simplest, no timing dependency. | ✓ |
| GW38 gate only | Mirrors archive_season.py: only runs when CURRENT_GW == 38. Guarantees it captures end-of-season prices, but requires the pipeline to run during GW38 window. | |
| Pre-season active gate | Runs when the pre_season_active.json signal is absent — i.e. before next-season bootstrap is detected. Captures the baseline just-in-time before FPL flips to new prices. | |

**User's choice:** Every run, guarded by idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| now_cost only | Minimal — just the price field from bootstrap elements. Keeps price_baseline.json small (~30KB for 700+ players) and the diff logic simple. | ✓ |
| now_cost + element_type + web_name | Richer baseline: includes position type and name so the API route doesn't need to cross-reference bootstrap to render the table. | |
| Full element snapshot | Captures all bootstrap element fields. Future-proof but heavy (~2MB) and the idempotency write is more expensive. | |

**User's choice:** now_cost only

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, non-fatal — wrap in try/except | Matches archive_season.py and squad_health.py patterns. A blob write failure at pipeline time shouldn't break the rest of the pipeline run. | ✓ |
| Fatal — raise on failure | Treats the baseline as a hard prerequisite. Riskier: a transient blob error would block the whole pipeline. | |

**User's choice:** Non-fatal, wrap in try/except

---

## xPts Source for Value Targets

| Option | Description | Selected |
|--------|-------------|----------|
| merged_players.json xPts sim | Uses last season's Monte Carlo xPts from merged_players.json. Stale for new season but reflects real measured performance — better than bootstrap estimates for identifying proven quality. | ✓ |
| season_archive_gw38.json total_points | Uses the season archive from Phase 126 — actual season total points per player. Concrete performance data, but is raw points not xPts. | |
| Bootstrap ep_next | Uses FPL's own ep_next (expected points for the next GW). Live but very short-horizon and unreliable in off-season. | |

**User's choice:** merged_players.json xPts sim

| Option | Description | Selected |
|--------|-------------|----------|
| Median xPts of all players in same element_type | Standard median across all 700+ players per position type (GK/DEF/MID/FWD). Simple, consistent, no filtering. | ✓ |
| Median of top-50% ownership within position | Filters to frequently-owned players before taking median. Produces a higher bar — only genuinely above-average picks surface. | |
| You decide | Leave the median strategy to the planner. | |

**User's choice:** Median xPts of all players in same element_type

| Option | Description | Selected |
|--------|-------------|----------|
| Name, price drop pill, xPts rank | Matches PRST-03 exactly: price drop pill (-X.Xm) and xPts rank within position. Minimal, scannable. | ✓ |
| Name, old price, new price, drop pill, xPts value | Shows raw xPts number alongside the rank, giving more context but more columns. | |
| Name, drop pill, xPts rank, and ownership % | Adds ownership context so you can spot hidden gems (low ownership + high xPts + price drop). | |

**User's choice:** Name, price drop pill, xPts rank

---

## Published State Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Diff-based: any now_cost delta = published | API computes the diff. If at least one player's current bootstrap now_cost != baseline, the response includes populated deltas and published: true. Zero deltas → published: false → empty state. No extra artifact needed. | ✓ |
| Explicit flag in a new artifact | A separate price_reset_published.json flag written by the pipeline when it detects next-season bootstrap. More explicit but adds another pipeline step and blob artifact. | |
| pre_season_active.json signal | Reuse the existing pre_season_active.json detection in run.py — if it exists, prices are published. Avoids a new artifact but couples price reset state to the pre-season squad logic. | |

**User's choice:** Diff-based: any now_cost delta = published

| Option | Description | Selected |
|--------|-------------|----------|
| API returns 404 / null — frontend shows loading/empty state | Route returns a structured empty response. Frontend handles it gracefully the same as the pre-publication empty state. | |
| API falls back to current bootstrap as the baseline | No blob = use current bootstrap now_cost as both baseline and current. All deltas are zero → looks like pre-publication. Seamless but masks the missing baseline. | ✓ |

**User's choice:** API falls back to current bootstrap as the baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Static message with estimated date | "FPL typically publishes new prices in mid-to-late July" — matches PRST-04 exactly. No countdown, no dynamic data needed. | ✓ |
| Message + last-updated timestamp of baseline | Shows when the baseline was captured ("Baseline captured: 18 May 2026") so the user knows the pipeline ran. Slightly more informative. | |
| Message + link to current Price Changes tab | Redirects attention to the in-season price-changes tab while waiting. Cross-tab navigation. | |

**User's choice:** Static message with estimated date

---

## Tab Placement

| Option | Description | Selected |
|--------|-------------|----------|
| After price-changes (end of list) | Both are price-themed. Sequence becomes: … season → window → price-changes → price-reset. Logical grouping at the end. | |
| After window (before price-changes) | Groups the two off-season tabs together: … season → window → price-reset → price-changes. Summer Window + Price Reset are both off-season views. | ✓ |
| You decide | Minor detail — leave placement to the planner. | |

**User's choice:** After window (before price-changes) — off-season grouping

| Option | Description | Selected |
|--------|-------------|----------|
| 'Price Reset' / mobile 'Resets' | Direct, matches the phase name. Sub-tab pattern: label + mobileLabel (see price-changes uses 'Prices'). | ✓ |
| 'Season Prices' | Slightly more descriptive of the season-over-season comparison angle. | |
| You decide | Leave label to the planner. | |

**User's choice:** 'Price Reset' / mobile 'Resets'

---

## Claude's Discretion

- API route path: `/api/price-reset/route.ts`
- Blob key: `'price_baseline.json'`
- Delta pill colours: green for rise, red for fall
- Main table sort order
- xPts rank display format (e.g. "#3 MID" vs "3rd (MID)")

## Deferred Ideas

None — discussion stayed within phase scope.
