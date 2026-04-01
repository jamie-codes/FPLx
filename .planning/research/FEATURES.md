# Feature Research

**Domain:** Multi-GW transfer sequence planner for an FPL analytics web app
**Researched:** 2026-04-01
**Confidence:** HIGH for table stakes (established FPL planner patterns + first-principles reasoning about FPL rules); MEDIUM for differentiators (community research + product analysis); LOW where marked

---

## Context: What Is Already Built (v1.2)

This is a new feature surface added to an existing app. The planner does NOT replace existing tabs — it is a new "Planner" tab alongside Gems, DefCon, Squad, Club Form, and Values.

Existing infrastructure the planner can and should build on:

| Existing Asset | How Planner Uses It |
|---------------|---------------------|
| `computeTransferSuggestions()` in `transfer-engine.ts` | Single-GW logic to adapt into multi-GW sequence scoring |
| `ScoredPlayer` type (gem_score, proj_pts_Xgw, fixtures, mins_risk) | Core data per player — already includes projected points and fixture difficulty |
| `SquadPick` / `MyTeamPick` (selling_price, position, multiplier) | Squad state at GW0; exact sell prices require auth |
| `EntryHistory` (bank, event_transfers, event_transfers_cost) | Bank balance and free transfer count at GW0 |
| `FixtureEntry` (event_id, difficulty_score, difficulty_tier, is_home) | Per-GW fixture data for scoring |
| `MergedPlayer.proj_pts_Xgw` (1/3/5 GW projected points) | Already DGW-aware; planner can read these directly |
| FPL auth session cookie (optional login) | Exact sell prices and bank balance when authenticated |
| DGW-aware transfer engine tier from v1.2 | Logic for flagging DGW/BGW already exists |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume a multi-GW planner has. Missing any of these makes the planner feel incomplete or unusable for its core purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Horizon selector (1–5 GW) | The whole premise of a multi-GW planner is user-controlled lookahead. Without it there is no multi-GW concept. | LOW | Numeric input or segmented button: 1 / 2 / 3 / 4 / 5. Stored in local state. Drives how many GW columns appear in the output table. |
| Transfer-by-transfer output table | Users need to see the *sequence* — GW number, who goes out, who comes in, the cost (free vs -4), and the projected gain. This is the core deliverable of the planner. | MEDIUM | Columns: GW \| Out \| In \| Cost (-4 or Free) \| Cumulative projected gain. Rows are individual transfers, not gameweeks. Sorting by GW naturally groups them. |
| Budget tracking per GW | FPL is a budget-constrained game. Any suggested transfer must account for bank balance at each stage, not just at GW0. Each transfer changes the available budget for subsequent transfers. | HIGH | Bank balance at GWN = bank at GW0 + (sum of sell prices to GWN) - (sum of buy prices to GWN). Sell prices should use `selling_price` if authenticated, else `now_cost`. Must carry forward across GW steps. |
| Hit cost factored into scoring | A -4pt hit is real and changes whether a transfer is worthwhile. A transfer with proj gain of +3.5 pts is net negative if it costs a hit. The planner must show the net score (projected gain minus hit cost). | MEDIUM | Net score = projected_pts_delta - (hit_transfers * 4). Display both gross gain and net gain. Flag transfers that are net-negative after hit cost. |
| Free transfer accumulation across GWs | FPL allows banking up to 2 free transfers. A plan that skips GW1 (banking) to use 2 free transfers in GW2 is a common strategy. The planner must model this correctly. | MEDIUM | Free transfers at GWN = min(2, free_at_GW(N-1) + 1) - transfers_used_at_GW(N-1). This is a stateful chain — each GW depends on the previous GW's transfer count. |
| DGW/BGW awareness | Double Gameweeks inflate projected points for affected players; Blank Gameweeks deflate them. A planner that treats all GWs equally will systematically mis-score transfers. The existing codebase already handles this in `proj_pts_Xgw` and `FixtureBadges`. | MEDIUM | Flag DGW/BGW weeks visually in the output table header. Use `fixtures[].event_id` counts to detect DGW (count > 1) and BGW (count = 0) for each GW in the horizon. The existing DGW tier logic in transfer-engine.ts can be reused. |
| Chip visibility in the plan | Chips (Wildcard, Free Hit, Triple Captain, Bench Boost) change the rules of a given GW. Wildcard = unlimited free transfers; Free Hit = temporary squad; TC = captain triples; BB = bench scores. A plan that doesn't show chip context is incomplete. | LOW | Show chip slots in the output table — one row per GW for the chip state. Chips are informational in v1.3 (user declares which GW they intend to use a chip; planner adjusts hit cost calculation if Wildcard is declared). |
| Squad snapshot per GW | The user needs to see what their squad looks like *after* each set of transfers in the plan — not just a list of swaps. Without this, verifying the plan is sound (no duplicate positions, budget not exceeded, starting XI valid) is impossible. | HIGH | Show the 15-player squad (starting XI + bench) after each GW's transfers are applied. Highlight changed players. Use position grouping (GK / DEF / MID / FWD). |
| Planner tab in navigation | The planner needs to be accessible from the main nav. It's a new top-level destination, not a panel inside an existing tab. | LOW | Add "Planner" as a 6th tab to the bottom tab bar (mobile) and top tab strip (desktop). Icon: calendar or route icon. |

### Differentiators (Competitive Advantage)

Features that go beyond showing a static plan to actively helping the user find a better plan than they'd find manually.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-suggest optimal sequence | The user's core question is "what should I do?" not "let me manually enumerate options." Auto-suggest answers that question. The existing `computeTransferSuggestions()` provides GW0 single-transfer intelligence; the planner extends this across N GWs. | HIGH | Greedy approach: at each GW, pick the best 1 or 2 transfers (same logic as existing engine) using the projected pts score for that GW's remaining horizon. This is O(n) and fast enough for client-side execution. Full lookahead (knapsack / LP) is more optimal but slower and harder to explain. Greedy with good scoring is the right call for a personal tool. |
| Manual edit mode on top of auto-suggest | The user knows things the algorithm doesn't: upcoming news, their risk tolerance, specific targets they want. Auto-suggest is a starting point; manual edit is the actual decision. The user should be able to drag-replace any suggested player with their own choice. | HIGH | Two modes: "Suggested" (read-only, from auto-suggest) and "Manual" (user can click Out/In cells and pick from a player selector). State: `PlannerMode = 'suggested' \| 'manual'`. Manual edits immediately re-score the plan. |
| Net projected gain as the single headline number | The plan is either worth doing or not. The headline number is the cumulative net projected points gain across the horizon (after hit costs). This is the number the user cares about — "is this plan worth +8 pts?" | LOW | Prominently display: "Plan value: +8.2 pts net" at the top of the output. Decompose into: "+12.1 pts gross gain, -4 pts hit cost = +8.1 pts net." |
| Per-transfer gain breakdown | Users want to know which transfer in the sequence is doing the most work and which might be skippable. If transfer 3 adds only +0.3 pts net, the user might prefer to bank that transfer. | LOW | In the output table, show each transfer's individual projected gain, not just cumulative. Flag any transfer where net gain < 0 (net-negative after hit cost). |
| Fixture difficulty column in transfer table | Knowing that a buy target has easy fixtures for the plan GWs (vs hard fixtures) is key context for transfer timing. The existing `FixtureBadges` component already renders this. | LOW | Reuse `FixtureBadges` for the buy candidate in each row of the transfer table. Render next N fixtures where N = remaining GWs in horizon. |
| Chip timing recommendation | "When should I use my Wildcard?" is one of the most common FPL strategy questions. The planner can make a simple recommendation: if no plan within the horizon achieves net positive gain without a chip, suggest Wildcard timing. | MEDIUM | Chip recommendation logic: if the best 1-horizon plan is net negative and the user has a Wildcard available, display "Consider Wildcard in GW X for maximum squad overhaul." This is advisory, not imperative. |
| Save/compare plan drafts | Users often want to compare two plans before committing. "Plan A: move Salah for Saka in GW1" vs "Plan B: hold and Wildcard in GW2". | MEDIUM | Persist plans to `localStorage` keyed by `planId`. Two plan slots (Plan A / Plan B). Simple compare view showing the headline net gain for each. Defer to v1.3.x if time-constrained. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full-season (GW38) planner | Some tools plan all 38 GWs. Feels like "complete control." | FPL is too noisy beyond 5 GWs: injuries, form, price changes, DGW announcements make GW10+ projections unreliable. A 38-GW plan will be wrong by GW5 and create false confidence. The data (proj_pts_Xgw only goes to 5 GW) doesn't support it. | Cap horizon at 5 GWs with a clear explanation: "Beyond 5 GWs, projections are noise." |
| Optimal/LP solver instead of greedy | Mathematically optimal transfer sequences via linear programming. Used by FPL Review / fplreview.com. | For a personal tool with a single user, the difference between greedy and LP in outcome is small (typically < 1 pt). LP is: slower on client, harder to explain to the user, and creates an "oracle" effect where the user stops understanding why the plan is what it is. | Greedy algorithm with clear scoring logic. Users understand "took the best available player at each step." |
| Price change prediction | Price rises/falls are popular to track — "buy before he rises." | Price change prediction is speculative (depends on transfer patterns of millions of users). Including it in plan scoring would make the score unreliable and hard to explain. | Surface price trend data (already in `cost_change_event`) as a separate column in the transfer table, as informational context, not a scoring input. |
| Real-time squad sync / live updates during matches | Users want live data. | Data refreshes daily by design (PROJECT.md). Adding live sync requires WebSocket or polling infrastructure not present in the stack, contradicts the "once-daily sufficient" constraint, and is out of scope per PROJECT.md. | Surface the `LastUpdated` timestamp prominently in the Planner tab header so the user knows data freshness. |
| Opponent comparison (mini-league context) | "What is my rival doing?" | This is explicitly out of scope per PROJECT.md ("Mini-league or head-to-head analysis — squad optimisation focus only"). Adding it pollutes the single-purpose focus of the tool. | Keep planner focused on own-squad optimisation. |
| Automated transfer execution via FPL API | Some tools claim to auto-execute transfers. | The FPL API does not officially support write operations via the session cookie mechanism used for auth. Any such implementation would be reverse-engineering undocumented write endpoints with high risk of account ban. Catastrophically bad if wrong transfer executes. | Display-only planner. User executes transfers manually in the official FPL app after reviewing the plan. Prominently note this in the UI. |
| Position formation editor | Some planners let users experiment with formation (4-4-2 vs 4-5-1). | FPL formation is implicit — it's just the starting XI order within position constraints. Changing formation requires picking different players (e.g., fewer MIDs, more FWDs), which is already handled by the transfer sequence. A dedicated formation editor adds UI complexity with no data benefit given existing squad type constraints. | The squad snapshot per GW implicitly shows formation by grouping by position. |

---

## Feature Dependencies

```
[Planner tab in navigation]
    └──required by──> [All planner features — navigation is the entry point]
    └──requires──> [Bottom tab bar extended from 5 to 6 tabs (MOB-NAV-01 from v1.2)]

[Horizon selector]
    └──required by──> [Auto-suggest optimal sequence]
    └──required by──> [Transfer-by-transfer output table — N rows depends on horizon]
    └──required by──> [Squad snapshot per GW — N snapshots depends on horizon]

[Budget tracking per GW]
    └──required by──> [Auto-suggest optimal sequence — must know budget at each GW step]
    └──required by──> [Manual edit mode — must re-validate budget on each user change]
    └──requires──> [Sell prices: MyTeamPick.selling_price (auth) or now_cost (public)]
    └──requires──> [EntryHistory.bank from FPL API]

[Free transfer accumulation]
    └──required by──> [Hit cost calculation — must know FT count to determine hit]
    └──required by──> [Auto-suggest — greedy scoring depends on FT count per GW]
    └──requires──> [EntryHistory.event_transfers from FPL API]

[Hit cost factored into scoring]
    └──requires──> [Free transfer accumulation — FT count determines hit count]
    └──enhances──> [Net projected gain headline number]

[Transfer-by-transfer output table]
    └──requires──> [Budget tracking per GW — affordability must be validated]
    └──requires──> [Hit cost calculation — cost column depends on FT state]
    └──requires──> [DGW/BGW awareness — flag rows where DGW/BGW affects scoring]
    └──enhances──> [FixtureBadges reuse — existing component renders difficulty per player]

[Squad snapshot per GW]
    └──requires──> [Transfer-by-transfer output table — squad state derived from applied transfers]
    └──requires──> [Budget tracking per GW — snapshot must show post-transfer bank]
    └──independent of──> [Auto-suggest — snapshots work equally for manual or suggested plans]

[Auto-suggest optimal sequence]
    └──requires──> [Horizon selector]
    └──requires──> [Budget tracking per GW]
    └──requires──> [Free transfer accumulation]
    └──reuses──> [computeTransferSuggestions() scoring logic from transfer-engine.ts]
    └──reads──> [ScoredPlayer.proj_pts_Xgw — already DGW-aware from pipeline]

[Manual edit mode]
    └──requires──> [Auto-suggest optimal sequence — manual edits start from auto-suggest output]
    └──requires──> [Budget tracking per GW — validate each manual change]
    └──conflicts with──> [Read-only "Suggested" view — toggle between modes]

[Chip timing visibility]
    └──independent of──> [Auto-suggest — chips are declared by user, not algo-chosen]
    └──enhances──> [Hit cost calculation — Wildcard declared = 0 hit cost for that GW]
    └──requires──> [Horizon selector — chip slot per GW in the horizon]

[DGW/BGW awareness]
    └──reuses──> [FixtureEntry.event_id count logic from v1.2 DGW-01]
    └──enhances──> [Transfer-by-transfer output table — visual flag per GW row]
    └──enhances──> [Auto-suggest — DGW GW should weight proj pts higher in scoring]
```

### Dependency Notes

- **Budget tracking is load-bearing**: Every other feature (auto-suggest, manual edit, squad snapshot) depends on correct budget propagation across GWs. This must be solved first and tested with exact sell prices vs approximate sell prices.
- **Auto-suggest uses existing engine**: `computeTransferSuggestions()` already does greedy best-transfer selection. The multi-GW version loops it N times, updating a virtual squad state after each step. Not a full rewrite — an extension.
- **Chip declaration affects hit cost only**: In v1.3, chip timing is informational (user declares intent, planner adjusts hit cost for Wildcard only). Full chip optimisation (what TC multiplier does to projected captain points) is deferred complexity.
- **Squad snapshot is the most expensive component**: Rendering 15-player squad grids for up to 5 GWs is a meaningful DOM footprint on mobile. Consider accordion (expand per GW) rather than all-expanded by default.
- **Manual edit mode requires a player picker**: A searchable player picker (position-filtered, sorted by gem score) is needed for manual edits. This is new UI surface not present in v1.2.

---

## MVP Definition

The planner's MVP is the minimum that answers: "What transfers should I make over the next N gameweeks?"

### Launch With (v1.3 — planner usable)

- [ ] **Planner tab** — accessible from nav, 6th tab (PLAN-11)
- [ ] **Horizon selector** — 1–5 GW segmented control (PLAN-01)
- [ ] **Auto-suggest optimal sequence** — greedy best-transfer at each GW step (PLAN-02)
- [ ] **Transfer-by-transfer output table** — GW / Out / In / Cost / Projected gain (PLAN-09)
- [ ] **Hit cost factored into scoring** — net gain = gross gain - (hits * 4) (PLAN-07)
- [ ] **Free transfer accumulation** — FT count modelled correctly across GW steps
- [ ] **Budget tracking per GW** — affordability validated at each step
- [ ] **DGW/BGW flags** — visual indicator in output table header (PLAN-06)
- [ ] **Chip slots in output** — show Wildcard / Free Hit / TC / BB per GW row (PLAN-08)
- [ ] **Fixture difficulty column** — reuse FixtureBadges for buy candidate (PLAN-05)

### Add After Core (v1.3.x — if MVP proves useful)

- [ ] **Squad snapshot per GW** — 15-player squad after each GW's transfers (PLAN-10) — high implementation cost; accordion UI needed for mobile; defer if time-constrained but include if possible
- [ ] **Manual edit mode** — user overrides auto-suggested transfers (PLAN-03) — requires player picker UI; high value but high cost
- [ ] **Plan scoring by projected points delta** — headline "Plan value: +N pts net" number (PLAN-04) — depends on transfer table being complete

### Future Consideration (v1.4+)

- [ ] **Save / compare plan drafts** — persist 2 plans to localStorage, compare headline numbers — useful for "Plan A vs Plan B" but not needed to answer the core question
- [ ] **Chip timing recommendation** — "Consider Wildcard in GW X" advisory — needs confidence data that isn't in v1.3 scoring
- [ ] **Price trend as informational column** — surface `cost_change_event` in transfer table alongside gain — low complexity add-on after core is stable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Planner tab in navigation | HIGH | LOW | P1 |
| Horizon selector (1–5 GW) | HIGH | LOW | P1 |
| Free transfer accumulation logic | HIGH | MEDIUM | P1 |
| Budget tracking per GW | HIGH | MEDIUM | P1 |
| Hit cost factored into scoring | HIGH | MEDIUM | P1 |
| Transfer-by-transfer output table | HIGH | MEDIUM | P1 |
| Auto-suggest optimal sequence (greedy) | HIGH | HIGH | P1 |
| DGW/BGW flags in output table | MEDIUM | LOW | P1 |
| Chip slots in output (declarative) | MEDIUM | LOW | P1 |
| Fixture difficulty column (FixtureBadges reuse) | MEDIUM | LOW | P1 |
| Net gain headline number | HIGH | LOW | P2 |
| Squad snapshot per GW | HIGH | HIGH | P2 |
| Manual edit mode + player picker | HIGH | HIGH | P2 |
| Plan scoring visible per transfer row | MEDIUM | LOW | P2 |
| Save / compare plan drafts | MEDIUM | MEDIUM | P3 |
| Chip timing recommendation | LOW | MEDIUM | P3 |
| Price trend column in transfer table | LOW | LOW | P3 |

**Priority key:**
- P1: Must ship — planner is incomplete without these
- P2: Should ship — adds significant value; high value-to-cost ratio
- P3: Nice to have — polish or advanced features; defer freely

---

## User Flow: Expected Mental Model

The expected user flow maps to how FPL managers actually think about transfers:

```
1. User opens Planner tab
2. User sees their current squad (pulled from existing Squad View / my-team data)
3. User sets horizon: "I want to plan 3 gameweeks ahead"
4. User clicks "Generate Plan"
5. Planner shows:
   - Transfer table: 3 rows (one per planned GW), showing suggested Out/In/Cost/Gain
   - DGW/BGW flags on relevant GW rows
   - Chips row: blank unless user activates a chip for a GW
   - Net headline: "Plan value: +6.4 pts net"
6. User can optionally expand squad snapshot for any GW to see full squad state
7. User optionally switches to "Manual" mode and overrides a suggested transfer
8. User reads the plan and executes manually in the official FPL app
```

This flow is distinct from the existing Transfer Panel (which suggests a single next transfer). The Planner answers the question "what is my strategy for the next N weeks?" not "what do I do this week?"

---

## Competitor Feature Analysis

| Feature | FPL Review (fplreview.com) | Premier Fantasy Tools | FPLWatch | Our Approach |
|---------|---------------------------|----------------------|----------|--------------|
| Algorithm | Linear programming (optimal) | Manual drag-and-drop | Not specified | Greedy (fast, explainable, sufficient for personal use) |
| Horizon | Unlimited (all 38 GWs) | All 38 GWs | Multi-GW (unspecified) | 1–5 GWs (matches data reliability window) |
| Projected points source | Own projection model | Own model | Not specified | Existing `proj_pts_Xgw` from pipeline (already DGW-aware) |
| Chip handling | Explicit per-GW chip selection | Manual chip assignment | Not specified | Declarative chip slots (user declares intent; Wildcard adjusts hit cost) |
| Squad snapshot | Yes (full squad per GW) | Yes (full team view) | Not specified | Per-GW accordion (mobile-optimised) |
| Manual edit | Yes | Yes (primary mode) | Not specified | Overlay on auto-suggest output |
| Auth required | Optional (Team ID) | Optional (Team ID) | Yes (Team ID) | Optional (exact sell prices require auth; approx budget works without) |
| Mobile | Partial | Yes | Not specified | Full mobile support (inherits v1.2 mobile foundation) |

---

## Sources

- [FPLWatch Transfer Planner](https://fplwatch.com/planner) — Multi-GW planner with budget tracking and fixture analysis; Team ID required for full access (MEDIUM confidence — landing page only, full UI requires auth)
- [Premier Fantasy Tools FPL Planner](https://www.premierfantasytools.com/fpl-planner-intro/) — Full 38-GW planning with chip slots, captain picks, squad snapshots (MEDIUM confidence — marketing page, feature list verified)
- [FPLStrat App](https://fplstrat.app/) — xG-based FDR (similar to our custom FDR), mobile-first positioning, multi-GW fixture analysis (MEDIUM confidence — landing page)
- [FPL Core Transfer Planner](https://www.fplcore.com/transfer-planner) — Budget tracking, fixture analysis, hit calculation (MEDIUM confidence — landing page only)
- [Fantasy Football Fix Future Planner](https://www.fantasyfootballfix.com/planner/) — Established planner, GW notes for DGW/chips/captains (MEDIUM confidence — known tool)
- [Efficient Algorithms for Optimising Fantasy Football — dtravers.com](https://www.dtravers.com/research%20&%20projects/Maths%20Project.pdf) — Academic analysis: greedy vs lookahead for FPL optimisation; greedy's short-sightedness documented (HIGH confidence — academic paper)
- [Ben Crellin's FPL Transfer Planning — Fantasy Football Hub](https://www.fantasyfootballhub.co.uk/ben-crellins-fpl-transfer-planning-sheet) — Community planning spreadsheet; common FPL planning patterns (MEDIUM confidence — community resource)
- First-principles reasoning from FPL ruleset: free transfer accumulation (max 2), -4pt hit, position constraints, chip rules — HIGH confidence (official FPL rules are well-established and embedded in existing codebase)

---

*Feature research for: FPL Analyst v1.3 Gameweek Planner*
*Researched: 2026-04-01*
