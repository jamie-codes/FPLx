# Phase 34: Chip Strategy — Discussion Log

**Date:** 2026-04-28
**Phase:** 34 — Chip Strategy
**Status:** Context captured

---

## Areas Discussed

All four gray areas selected by user.

---

### Area 1: Multi-GW Scoring Method

**Question 1:** How should we score each upcoming GW to find the chip's optimal week?
- Options: Fixture-ease heuristic / Per-GW xPts pipeline expansion / Reuse xPts_1gw as proxy
- **Selected:** Fixture-ease heuristic (no pipeline change)

**Question 2:** For Bench Boost, which players count as 'bench' for the fixture-ease score?
- Options: User's live bench via useSquad / Generic top-4 bench proxy
- **Selected:** User's live bench via useSquad (positions 12–15)

**Question 3:** How many upcoming GWs should the chip scorer look ahead?
- Options: Next 5 GWs / Next 3 GWs / Remaining season
- **Selected:** Next 5 GWs

**Question 4:** Where does the per-fixture attacking_difficulty data come from?
- Options: ClubForm hook / New pipeline field per player
- **Selected:** ClubForm hook (useClubForm) — no new pipeline fields

---

### Area 2: UI Placement

**Question 1:** Where should the Chip Strategy analysis live?
- Options: New 'Chips' tab in main nav / Panel within Planner tab / Panel on Gems tab
- **Selected:** Panel within Planner tab (above TransferPlanTable)

**Question 2:** What should the Chip Strategy panel show for each chip?
- Options: GW recommendation + ease score bar / GW recommendation only / GW ranking table
- **Selected:** GW recommendation + ease score bar (5-cell bar across upcoming GWs)

**Question 3:** Should the panel be collapsed by default or always expanded?
- Options: Always expanded / Collapsed by default
- **Selected:** Always expanded

---

### Area 3: Free Hit Scope

**Question 1:** What does the Free Hit recommendation show?
- Options: GW + greedy squad suggestion / GW recommendation only / GW + top team targets
- **Selected:** GW + greedy squad suggestion (full 15-player pick)

**Question 2:** How should the Free Hit squad suggestion be optimised?
- Options: Greedy xPts maximisation / LP solver / You decide
- **Selected:** Greedy xPts maximisation (reuse planning engine's existing logic)

**Question 3:** How is the Free Hit squad suggestion displayed?
- Options: Expandable player list within chip panel / Modal / Separate section below panel
- **Selected:** Expandable player list within chip panel (Phase 32 Team Target expand pattern)

---

### Area 4: Chip Eligibility

**Question 1:** Should the panel detect which chips the user has already played?
- Options: Show all 3 chips always / Detect via FPL history API
- **Selected:** Detect via FPL history API (/api/fpl/entry/{id}/history/)

**Question 2:** What happens to a chip that's already been played?
- Options: Hidden from the panel / Greyed out with 'Used' label / You decide
- **Selected:** Greyed out with "Used GW{N}" label (remains visible, not hidden)

---

## Claude's Discretion Items

- Ease bar visual implementation (CSS width-proportion vs fixed 5-cell grid)
- Tailwind tokens for ease bar (recommend green-intensity scale)
- Whether chip rows show the top candidate's name alongside GW recommendation
- Formation validation logic for FH greedy squad

## Deferred Ideas

None.
