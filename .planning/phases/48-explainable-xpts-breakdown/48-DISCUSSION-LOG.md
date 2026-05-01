# Phase 48: Explainable xPts Breakdown — Discussion Log

**Date:** 2026-05-01
**Phase:** 48 — Explainable xPts Breakdown
**Areas discussed:** 4 (Appearance & minutes, Interaction design, DGW breakdown, Placement)

---

## Area 1: Appearance & Minutes Components

### Q1: Should appearance_pts be added as an explicit pipeline component?
**Options presented:**
- Add appearance_pts (= start_prob × 2) as an explicit component — sum invariant satisfied
- Document its absence with a footnote — simpler but breaks XPT-01 and XPT-02

**Selected:** Add appearance_pts (Recommended)

**Notes:** Current pipeline returns {total, goal_pts, assist_pts, cs_pts, bonus_pts}. Adding appearance_pts makes components literally sum to xPts_1gw, satisfying XPT-02's ±0.01 tolerance requirement cleanly.

---

### Q2: How should minutes_risk modifier be shown?
**Options presented:**
- Label only — show existing MinsRiskBadge adjacent to hover card (no additive pts row)
- Show xmins value as an informational row in the breakdown

**Selected:** Label only — show MinsRiskBadge (Recommended)

**Notes:** xmins is a multiplier embedded in all component calculations (not separable as an additive term). Adding it as a pts component would break the sum invariant. MinsRiskBadge already exists and satisfies XPT-01's "minutes risk modifier" intent.

---

## Area 2: Interaction Design

### Q3: Which interaction pattern for the breakdown?
**Options presented:**
- Styled hover card / popover (CSS-only Tailwind group-hover)
- Keep native title tooltip (extend existing title string)
- Click-to-expand inline row (table row mutation)

**Selected:** Styled hover card / popover (Recommended)

**Notes:** Native title tooltip has no mobile support and plain text only. Click-to-expand requires table row mutation. Styled hover card is the right balance — richer UI without a new dependency.

---

### Q4: CSS-only group-hover vs Floating UI / Radix?
**Options presented:**
- CSS-only Tailwind group-hover (no new dependency, follows existing codebase pattern)
- Floating UI / Radix Popover (handles viewport clipping + accessibility)

**Selected:** CSS-only group-hover (Recommended)

**Notes:** The existing compare button in XPtsCell already uses the group-hover/name pattern. Reusing it keeps the implementation consistent. No new dependency added.

---

## Area 3: DGW Player Breakdown

### Q5: Show summed DGW breakdown or "breakdown unavailable"?
**Options presented:**
- Show summed breakdown (sum components across both fixtures in pipeline)
- Show "breakdown unavailable" (null state, ROADMAP-anticipated fallback)

**Selected:** Show summed breakdown (Recommended)

**Notes:** ROADMAP anticipated the "unavailable" fallback but user preferred the honest summed approach. Pipeline already computes first_gw_components — extending to sum all DGW fixtures is straightforward. Sum invariant remains intact.

---

### Q6: BGW player hover card behaviour?
**Options presented:**
- No hover card shown (existing null/zero short-circuit handles it)
- Show "No fixture this gameweek" card

**Selected:** No hover card shown (Recommended)

**Notes:** Consistent with existing XPtsCell null/zero guard (value ≤ 0 → no badge, no tooltip). BGW players show "0.0" with no interactive element.

---

## Area 4: Breakdown Placement

### Q7: GemTable only or also PlayerComparisonModal?
**Options presented:**
- GemTable only (scope to XPtsCell in xPts_1gw column)
- GemTable + PlayerComparisonModal

**Selected:** GemTable only (Recommended)

**Notes:** XPT-01 "any player" is satisfied by GemTable (shows all 600+ players). PlayerComparisonModal deferred as a future extension once the hover card component is stable.

---

## Claude Discretion Items (no user input needed)

- CS component source (XPT-03): architecturally satisfied by Phase 47 — `_cs_prob_1gw_for_fixtures()` already produces fixture-adjusted values that flow into `cs_pts`. No explicit decision needed.
- BGW cs_prob_1gw = 0: Phase 47 decision (D-10 from 47-CONTEXT.md) — bgw players have cs_prob_1gw = 0, so cs_pts = 0. Consistent.
- `title` attribute removal: once styled hover card is live, the native `title` prop on XPtsCell should be removed entirely to avoid duplicate tooltips.

---

## Deferred Ideas

- Breakdown in PlayerComparisonModal — out of scope for Phase 48; future phase
- xPts breakdown for 3GW and 5GW horizons — already deferred in REQUIREMENTS.md §Future Requirements
