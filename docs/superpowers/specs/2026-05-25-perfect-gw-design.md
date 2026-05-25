# PERFECT-01: Perfect GW Team — Design Spec

**Date:** 2026-05-25  
**Feature ID:** PERFECT-01  
**Phase:** A (Now → end June)  
**Status:** Approved — ready for implementation planning

---

## Overview

After each gameweek closes, show the best possible team that could have been fielded that week — the highest-scoring valid XI subject only to the 3-per-club cap and a legal FPL formation. Display it on a pitch graphic with per-player points, squad cost, and optimal captain. A second tab shows the top scorers per position with no constraints.

This is a standalone retrospective feature with no comparison to the user's actual squad.

---

## Navigation

Accessible via the **Analysis/Stats** section of the app. New entry in the Analysis nav: "Perfect GW".

**Route:** `src/app/analysis/perfect-gw/page.tsx`

---

## Page Layout

**Tabbed layout** with two tabs:

1. **⚽ Perfect XI** — pitch graphic with the optimal 11-player team
2. **📊 Top Scorers** — top performers per position, unconstrained

**GW Selector** at the top of the page:
- `◀ GW 37` | `GW 38 — Perfect XI` | `GW 39 ▶`
- Defaults to the latest completed GW on page load
- Navigation constrained to GW 1 → latest finished GW (no future or in-progress GWs)

---

## Tab 1: Perfect XI Pitch

### What it shows
- 11 player cards arranged on a pitch in the optimal formation
- Captain highlighted with a gold border and "CAPT" badge
- Total XI points (bottom right of pitch)
- Formation label and squad cost (bottom left, e.g. "3-4-3 · £98.4m")
- Budget banner if squad cost exceeds £100m (see Budget Flag section)

### Formation algorithm
1. Load all player GW points from `event/{gw}/live/`
2. Try all 9 valid FPL formations: `2-5-3, 3-5-2, 3-4-3, 4-5-1, 4-4-2, 4-3-3, 5-4-1, 5-3-2, 5-2-3`
3. For each formation: greedily select the highest-scoring available players per position slot, enforcing the **3-per-club cap** across the full XI
4. Calculate total XI points for each formation
5. Select the formation with the highest total points
6. **Captain** = highest-scoring player in the winning XI

### Squad rules enforced
- ✅ 3-per-club cap across the full XI
- ✅ Valid FPL formation (minimum 1 GK, 3 DEF, 2 MID, 1 FWD)
- ❌ No budget constraint (£100m limit not enforced — flagged separately)
- ❌ No comparison to user's actual squad

### Player card design
Each player on the pitch is rendered as a card showing:
- **Club pill** (coloured team abbreviation badge, top-left of card)
- **Price** (top-right, e.g. £13.2m)
- **Player name** (centre, bold)
- **GW points** (large, centre-bottom)

Captain card additionally shows:
- Gold border (2px)
- "CAPT" badge above the card

### Budget flag
- Compute total price of the 11 selected players
- If total > **£100m**: amber warning banner — *"Perfect XI costs £107.4m (£7.4m over standard budget)"*
- If total ≤ £100m: subtle green indicator — *"£98.4m — within budget"*

---

## Tab 2: Top Scorers

**4-column layout** (GK | DEF | MID | FWD), **top 5 players per position**, sorted descending by GW points.

No squad rules apply here — this is a pure points leaderboard per position.

### Each row shows
- Player name (bold for #1 in column)
- Club abbreviation + price (subtitle)
- GW points (right-aligned, green for top scorer in column)

### Row count
- GK: top 5
- DEF: top 5
- MID: top 5
- FWD: top 5

Top scorer in each column has a distinct highlighted background row.

---

## Data Sources

All data is fetched client-side. No new pipeline or backend work required.

| Endpoint | Used for | Caching |
|----------|----------|---------|
| `bootstrap-static/` | Player metadata, prices, positions, team IDs, GW status | SWR shared cache (already in use across app) |
| `event/{gw}/live/` | GW points per player | SWR, keyed by GW number — historical GWs cached permanently |

Both endpoints are already proxied at `/api/fpl/[...proxy]`.

---

## Components

```
src/app/analysis/perfect-gw/
├── page.tsx                   — page shell, GW selector state, data fetching, tab switching
├── PerfectGWPitch.tsx         — pitch graphic, player card layout, formation rendering
├── PlayerCard.tsx             — individual card: name, club pill, points, price, captain variant
├── TopScorersTable.tsx        — 4-column table, top 5 per position
└── BudgetBanner.tsx           — amber/green budget indicator banner

src/lib/perfect-gw/
└── computePerfectXI.ts        — pure optimisation function (no React dependency)
```

### `computePerfectXI` signature

```ts
interface PerfectXIResult {
  xi: FPLPlayer[];           // 11 players in formation order (GK, DEFs, MIDs, FWDs)
  captain: FPLPlayer;
  formation: string;         // e.g. "3-4-3"
  totalPts: number;
  squadCost: number;         // sum of xi player prices in FPL units (tenths of £m, e.g. 984 = £98.4m)
  overBudget: boolean;       // squadCost > 1000 (= £100m in FPL units)
  overBudgetBy: number;      // squadCost - 1000 in FPL units (0 if not over); display as £Xm
}

function computePerfectXI(
  players: FPLPlayer[],
  livePoints: Record<number, number>,  // playerId → GW points
): PerfectXIResult
```

> **FPL price units:** The FPL API stores `now_cost` as an integer in tenths of millions. `132` = £13.2m. The budget threshold is `1000` FPL units (= £100m). Divide by 10 for display.

The function is a pure function with no side effects, making it straightforward to unit test.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| GW not yet finished (`finished: false` in bootstrap) | Show "GW in progress — results available after all matches complete" — no pitch rendered |
| Player missing from live endpoint | Treat as 0 pts — no crash |
| Fetch failure | SWR error state with retry button (standard app pattern) |
| No valid XI computable | Fallback message — should not occur with real FPL data |

---

## Testing

**Unit tests for `computePerfectXI`:**
- Correct formation selection (picks formation with highest total)
- 3-per-club cap enforced (club with 4+ top scorers is capped at 3)
- Captain is highest scorer in XI
- Budget flag triggers correctly at >£100m
- Edge case: defender outscores all forwards (should still appear in XI via formation selection)
- Edge case: all top N scorers from one club (forces cap fallback to next best)

**Component tests:**
- `PlayerCard` renders captain variant correctly (gold border, CAPT badge)
- `BudgetBanner` shows amber for over-budget, green for within
- `TopScorersTable` highlights top scorer row per column
- `PerfectGWPitch` renders all 11 players in correct positional rows

**No E2E tests required** — pure client-side computation from well-defined API shapes.

---

## Out of Scope

- Comparison to user's actual squad (standalone only)
- Bench (4 substitute players) — XI only
- Budget constraint enforcement in the optimiser (flagged but not enforced)
- Bench Boost variant (all 15 players) — possible future extension
- Season-level "Perfect Season" aggregation — possible future extension

---

## Future Extensions (not in this phase)

- **Perfect Season view** — sum perfect GW scores across all GWs to show the theoretical season maximum
- **Bench Boost variant** — show perfect 15-player squad for BB-active GWs
- **"You missed" highlight** — players in the Perfect XI that were available at a low price
