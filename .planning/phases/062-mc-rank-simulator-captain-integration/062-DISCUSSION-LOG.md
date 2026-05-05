# Phase 62: MC Rank Simulator & Captain Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 62-MC Rank Simulator & Captain Integration
**Areas discussed:** Rank model, 5-GW trajectory method, Alternative XI UX, Placement & captain labels

---

## Rank Model

| Option | Description | Selected |
|--------|-------------|----------|
| Gaussian vs FPL average | Use FPL event average + assumed ~15 pt std dev. P(rank gain) = P(score > avg), P(top-10k) = P(score > avg + 1.5σ). No new API routes. | |
| Reframe as score percentile | Drop rank framing entirely — show projected score range (p10–p90) and P(beat FPL average). | |
| Fetch user's live rank | New hook hitting /api/fpl/entry/{teamId}/ for summary_overall_rank. Public data, no auth. | ✓ |

**User's choice:** Fetch user's live rank

---

| Option | Description | Selected |
|--------|-------------|----------|
| Beat-the-average heuristic | P(rank gain) = P(score > FPL GW average), P(rank drop) = P(score < FPL GW average). | ✓ |
| Gaussian with assumed σ=15 | P(top-10k) = P(score > mean + 1.5σ). Requires hardcoding σ=15. | |
| Show rank context only, no P(top-10k) | Display current rank as context, only show P(beat FPL average). Drop P(top-10k). | |

**User's choice:** Beat-the-average heuristic (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rank + P(rank gain) + P(rank drop) | Current rank as context, P(gain) and P(drop) as two main stats. | ✓ |
| Rank + P(gain) + P(drop) + projected score range | All above plus simulated GW score range (p10–p90). | |
| Only projected score range | Skip rank, just show simulated score distribution. | |

**User's choice:** Rank + P(rank gain) + P(rank drop) (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| usePlayers data | Check if GW average is in existing players data path; add as pipeline metadata if not. | ✓ |
| New useBootstrap hook | Dedicated hook fetching /api/fpl/bootstrap-static for events[] average scores. | |
| Hardcode fallback | Use POPULATION_MEAN_PTS = 55 constant. Inaccurate, fallback only. | |

**User's choice:** usePlayers data (Recommended)

---

## 5-GW Trajectory Method

| Option | Description | Selected |
|--------|-------------|----------|
| Fan chart / bar chart over 5 GWs | One data point per GW (GW+1 to GW+5), cumulative score range with mean ± confidence band. | ✓ |
| Single 5-GW aggregate view | One aggregate summary: expected total, floor, ceiling, P(beat 5×avg). | |
| GW-by-GW table (not chart) | Table with 5 rows, each showing xPts estimate, p10, p90, P(rank gain). | |

**User's choice:** Fan chart / bar chart over 5 GWs (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts (new dependency) | AreaChart with upper/lower confidence band. Standard React chart library. ~150KB bundle addition. | ✓ |
| CSS stacked bars (no library) | Inline-style bars following price-change panel pattern. | |
| SVG bars (no library) | Hand-drawn SVG rect elements. More control, no dependency. | |

**User's choice:** Recharts (new dependency)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Repeat xPts_1gw per GW | Each player's xPts_1gw used for all 5 GWs. Mean = N × XI_total. Band widens as √N × σ_1gw. | ✓ |
| Use xPts_5gw/5 per GW | 5-GW projected total ÷ 5 as average per-GW. Accounts for fixture variation. | |

**User's choice:** Repeat xPts_1gw per GW (Recommended)

---

## Alternative XI UX

| Option | Description | Selected |
|--------|-------------|----------|
| Transfer scenario — buy player not in squad | Replace one owned player with non-squad player. Compares current XI vs XI after transfer. | ✓ |
| Within-squad swap only | Reuse LineupTab's isLegalSwap/applySwap — swap bench ↔ starter only. | |
| Both interaction types | Tab/toggle between lineup swap and transfer comparison. | |

**User's choice:** Transfer scenario — buy a player not in your squad (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Two dropdowns: sell from squad, buy from all players | Dropdown 1: squad players; Dropdown 2: full player pool filtered by position + affordability. | ✓ |
| Searchable input for buy player | Dropdown for sell, text search input for buy. | |
| Reuse PlayerPickerModal | Trigger existing PlayerPickerModal for buy selection. | |

**User's choice:** Two dropdowns: sell from squad, buy from all players (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| One transfer at a time | One sell/buy pair. Compare current XI vs 1-transfer XI. | ✓ |
| Up to two transfers | Two sell/buy pairs. More complete but doubles UI complexity. | |

**User's choice:** One transfer at a time (Recommended)

---

## Placement & Captain Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Plan sub-tab (4th) | Alongside Planner / Manual Plan / Route Tree. Fits thematically as a "what-if planning" tool. | ✓ |
| Squad sub-tab (6th) | After Decision / Transfers / Optimiser / Lineup / Review. Squad already has 5 tabs. | |
| Analyse sub-tab | Treats it as read-only analytics. Odd fit given the interactive alternative XI picker. | |

**User's choice:** Plan sub-tab (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Highest p10_pts — safest/most reliable | "Lowest floor" = player least likely to blank; best worst-case outcome. Sort by p10_pts descending. | ✓ |
| Lowest p10_pts — most volatile | "Lowest floor" = riskiest pick. Warning label rather than recommendation. | |

**User's choice:** Highest p10_pts — safest/most reliable (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Priority cascade, one label per winner | Priority: Best P(haul) > Highest ceiling > Lowest floor. Greedy assignment. Players who win no dimension show no label. | ✓ |
| Each candidate gets their best dimension | Every candidate gets their strongest MC label (non-unique). | |
| Only label top 3 candidates | Top 3 get one label each, candidates 4–5 get none. | |

**User's choice:** Priority cascade, one label per winner (Recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inside CaptainPicksPanel below EO mode toggle | Small callout: "TC: Salah — 41% P(haul)". Same component, no new panel. | ✓ |
| ChipStrategyPanel (existing TC section) | Add to existing TC row in ChipStrategyPanel. | |
| Both locations | CaptainPicksPanel + ChipStrategyPanel, redundant. | |

**User's choice:** Inside CaptainPicksPanel, below the existing mode toggle (Recommended)

---

## Claude's Discretion

- Whether to show an "estimate" or "~" disclaimer on the fan chart P(rank gain/drop) stats
- Chart axis labels and GW number formatting (absolute GW numbers vs "GW+N" offset labels)
- Whether to render the confidence band for the alternative XI trajectory or only the mean line
- Exact badge styling for MC labels in CandidateRow (follow "Dangerous to fade" badge pattern)

## Deferred Ideas

- P(top-10k) dropped — requires modelling FPL score distribution tails; too imprecise without real data
- Two-transfer alternative XI — Route Tree already covers multi-transfer; avoided overlap
- 3GW/5GW MC windows — full multi-GW simulation is a future pipeline enhancement
- Within-squad lineup swap in rank simulator — LineupTab (Phase 72) already covers this
- haul_prob replacing sigma-tercile ceiling badge — deferred from Phase 61
