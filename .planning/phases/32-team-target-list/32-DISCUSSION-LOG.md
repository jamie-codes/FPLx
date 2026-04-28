# Phase 32: Team Target List - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 32-team-target-list
**Areas discussed:** Green fixture definition, Player list structure, xGI involvement %

---

## Green Fixture Definition

### Q1: What counts as "favourable"?

| Option | Description | Selected |
|--------|-------------|----------|
| > 0.5 ease | Midpoint of the 0-1 normalised scale. Easy = above average. Consistent with EaseBar. | ✓ |
| Top-half ranking | Teams ranked 1-10 out of 20. Relative, always 10 qualifiers. | |
| You decide | Leave threshold to planner/researcher. | |

**User's choice:** > 0.5 ease

---

### Q2: Which window drives the 4+ count?

| Option | Description | Selected |
|--------|-------------|----------|
| Always 5GW | 4+ favourable out of next 5 GWs. Independent of ATT/DEF/GW toggle. | ✓ |
| Tied to the GW toggle | Threshold shifts with user's selected window (3+ out of 3 in 3GW mode etc). | |

**User's choice:** Always 5GW

---

### Q3: Where does the green-run check live?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side using ClubForm data | Zero pipeline changes. computeClubForm() already produces per-fixture ease. | ✓ |
| Pipeline-computed field | New boolean field in merged_players.json. More portable but adds complexity. | |

**User's choice:** Client-side using ClubForm data

---

### Q4: How should the green-run highlight appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Green TARGET badge on row | Small green pill appended to qualifying team rows in FixtureEaseRankingPanel. Minimal change, consistent with badge patterns. | ✓ |
| Coloured row background | Green-tinted row. More prominent but deviates from existing table convention. | |
| Separate grouped section at top | Target teams pulled above the ranked list. Breaks ease-ranking sort order. | |

**User's choice:** Green TARGET badge on row

---

## Player List Structure

### Q5: Where does the player list live?

| Option | Description | Selected |
|--------|-------------|----------|
| Expand-on-click inside FixtureEaseRankingPanel | Click a TARGET-badged team row to expand inline player list. Compact, on-demand. | ✓ |
| Standalone panel below FixtureEaseRankingPanel | Always-visible panel for all target teams. More data at once, longer tab. | |
| New tab altogether | Dedicated "Targets" tab. Highest prominence, adds to already-full nav bar. | |

**User's choice:** Expand-on-click inside FixtureEaseRankingPanel

---

### Q6: How many players per expanded team?

| Option | Description | Selected |
|--------|-------------|----------|
| Top 3 by xGI involvement % | Focused and actionable — enough for a transfer decision. | ✓ |
| Top 5 by xGI involvement % | More coverage for teams with multiple transfer targets. Taller expansion. | |
| All eligible players | Complete but potentially 10+ rows — too long for inline. | |

**User's choice:** Top 3

---

### Q7: What columns appear in the player list?

| Option | Description | Selected |
|--------|-------------|----------|
| Name, Position, xGI%, xPts_1gw, Signal, Diff | Six most actionable columns. Signal and Diff already pre-computed. Satisfies TGT-02 + TGT-03. | ✓ |
| Name, Position, xGI%, xPts_1gw only | Simpler but defers TGT-03 signals — not recommended. | |
| Name, Position, xGI%, xPts_1gw, Price, Ownership, Signal, Diff | Adds price/ownership. Wider table may need horizontal scroll on mobile. | |

**User's choice:** Name, Position, xGI%, xPts_1gw, Signal, Diff

---

## xGI Involvement %

### Q8: Where is xGI% computed?

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side from merged_players.json | Group players by team, sum xG+xA, divide per player. Zero pipeline changes. | ✓ |
| Pipeline-computed field | xgi_involvement_pct added to merge.py. Consistent with other flags but derivable client-side. | |

**User's choice:** Client-side

---

### Q9: Which xG+xA source fields?

| Option | Description | Selected |
|--------|-------------|----------|
| FPL expected_goals + expected_assists | Season-to-date FPL StatsBomb xG/xA. Present on every player, no nulls. Consistent with regression_signal (Phase 29 D-01). | ✓ |
| Understat xG + xA | More established analytically but ~43 players have null Understat data — team totals understated. | |

**User's choice:** FPL expected_goals + expected_assists

---

## Claude's Discretion

- Exact label wording for the TARGET badge ("TARGET" vs icon/dot)
- Chevron icon vs full-row click for expand toggle
- Mobile layout of the expanded player table (recommend horizontal scroll)
- Whether `xgi_involvement_pct` is a utility-derived field on `MergedPlayer` or kept local to the component

## Deferred Ideas

None — discussion stayed within phase scope.
