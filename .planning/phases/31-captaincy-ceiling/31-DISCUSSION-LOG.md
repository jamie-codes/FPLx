# Phase 31: Captaincy Ceiling — Discussion Log

**Date:** 2026-04-28
**Participants:** Jamie + Claude

## Areas Discussed

All 4 gray areas selected by user.

---

### 1. UI Location

**Question:** Where should captaincy recommendations live?
**Options presented:** Dedicated captain panel (Gems tab) / GemTable column annotation / Planner tab section
**Decision:** Dedicated captain panel on the Gems tab — card showing two named picks (ceiling + EO).
**Rationale:** Captaincy is a player-selection decision; Gems tab is the right home. Clean, scannable, doesn't clutter the table.

---

### 2. EO-Adjusted Pick Formula

**Question:** What's the rule for the EO pick?
**Options presented:** Avoid template captains (ownership threshold) / Rank variance minimiser formula / You decide
**Decision:** Avoid template captains — EO pick = highest xPts_90th player with ownership < 25%.
**Rationale:** Simple, predictable, aligns with FPL community understanding of "differentiating" a captain pick.

---

### 3. Squad-Aware vs Global

**Question:** Picks from user's squad only, or all players globally?
**Options presented:** Global — all players / Squad-aware — user's 15 players
**Decision:** Global — all players.
**Rationale:** No squad state needed; pure pipeline output. Same approach as Signal/Diff. Always useful regardless of team ID.

---

### 4. Candidates Count

**Question:** How many candidates per pick type?
**Options presented:** Top 1 per type (two picks total) / Top 3 per type (shortlists)
**Decision:** Top 1 per type — two picks total.
**Rationale:** Actionable and decisive. App's tone is clear recommendations, not ranked lists to browse.

## Deferred Ideas

None.

## Claude's Discretion Items

- Exact visual design of pick cards (icons, color treatment, label wording)
- Whether `xPts_90th_1gw` becomes a GemTable column (likely Phase 32+)
- Panel placement relative to GemTable on Gems tab
- Tooltip explanation of "ceiling" vs "EO-adjusted" terms
- Edge case: ceiling pick == EO pick (both cards show same player)
