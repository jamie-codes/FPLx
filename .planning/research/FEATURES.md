# Feature Research

**Domain:** FPL analytics web app (personal squad management tool)
**Researched:** 2026-03-26
**Confidence:** HIGH — based on FPL API verification (PITFALLS.md), confirmed field availability, and PROJECT.md requirements

---

## FPL API Data Availability Reference

All features below depend on confirmed API data. Key fields verified:

| Data | Source | Endpoint / Field | Confirmed |
|------|--------|------------------|-----------|
| Player list, prices, ownership | FPL | `bootstrap-static/` → `elements[]` | YES |
| Form, points history | FPL | `bootstrap-static/` → `elements[].form` | YES |
| Injury/availability flags | FPL | `bootstrap-static/` → `elements[].status` (a/d/i/s/u/n) | YES |
| Set piece / penalty notes | FPL | `bootstrap-static/` → `elements[].news` (text field) | YES (text, not structured) |
| Fixture list + difficulty | FPL | `fixtures/` → `team_h_difficulty`, `team_a_difficulty` | YES (official FDR unreliable — use custom) |
| Per-player match history | FPL | `element-summary/{id}/history[]` | YES |
| Defensive contributions | FPL | `elements[].defensive_contributions` (2025/26 new field) | YES — all positions |
| Clearances/blocks/interceptions | FPL | `elements[].clearances_blocks_interceptions` (DEF subset) | YES |
| Squad picks (public) | FPL | `entry/{team_id}/event/{gw}/picks/` | YES |
| Bank balance, transfer count | FPL auth | `my-team/{team_id}/` | YES (requires login) |
| Selling price per player | FPL auth | `my-team/{team_id}/` → `picks[].selling_price` | YES (requires login) |
| xG, xA per player | Understat | soccerdata `read_player_season_stats()` | YES — EPL only |
| Per-match xG | Understat | soccerdata `read_player_match_stats()` | YES |

**Notable gap:** Set piece taker / penalty taker is only in the text `news` field — no structured boolean flag. Parsing this field requires text matching and is unreliable. Will need periodic manual updates or community data source (e.g. Fantasy Football Scout set piece notes).

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Player list with price, ownership, form | Every FPL tool shows this | LOW | From `bootstrap-static` |
| Injury/availability status display | Players making decisions need this | LOW | `status` field: a=available, d=doubtful, i=injured, s=suspended |
| Fixture difficulty display | Core to FPL decision-making | MEDIUM | Custom FDR from xG/xGA; official FDR as fallback only |
| Sort/filter by position | GK/DEF/MID/FWD distinctions are fundamental | LOW | TanStack Table client-side sort/filter |
| "Last updated" timestamp | Users need to know data freshness | LOW | `last_updated.json` from pipeline |
| Squad view with your players | Personal tool — your squad is the anchor | MEDIUM | Requires Team ID input; calls `entry/{id}/event/{gw}/picks/` |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Upcoming Gem composite rating | Single number that blends 7 dimensions — FPL tools rarely combine all dimensions in one score | HIGH | Scoring: fixture difficulty (custom FDR) + form (per-90 normalised) + xG/xA + ownership% + minutes reliability + set piece role + DefCon likelihood |
| DefCon hit rate & distance-to-threshold | New 2025/26 rule; no major tool has dedicated DefCon analysis yet | MEDIUM | Per-match threshold check from `element-summary` history; separate DEF (10) vs MID/FWD (12) tables |
| Transfer suggestions with budget enforcement | Most tools show who's good; few show who's actually affordable for *your* squad | HIGH | Uses `selling_price` from auth + bank balance; enforces position lock; ranks by Gem score improvement |
| DefCon hypothesis: tough vs easy fixtures | Tests whether defenders genuinely earn more DefCon vs weak attacks | MEDIUM | Correlate per-match DefCon data with opponent strength |
| xG/xA from Understat (not FPL built-in) | Understat xG is shot-level and more granular than FPL's own expected stats | MEDIUM | Requires Python pipeline + player ID mapping |
| Multi-transfer combinations | Shows 2-transfer combos ranked by total improvement, not just single swaps | HIGH | Combinatorial — limit to manageable search space |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time match data | "I want to see who's scoring live" | FPL data updates post-match, not live; real-time adds streaming infrastructure for negligible benefit over daily refresh | Show last-updated prominently; add manual refresh trigger |
| Live price change predictions | "Tell me who's about to rise" | Price prediction requires modelling transfer patterns; community tools (e.g. FPL Changes) do this better with dedicated data | Link out to FPL Changes; show current price and recent trend only |
| Chip strategy recommendations | "Tell me when to use Wildcard/Free Hit" | Requires opponent modelling, season-long projections — out of scope and gets stale fast | Detect chip state and surface it; don't recommend chip timing |
| Historical season comparison | "How does this player compare to last season?" | Understat historical data available but adds pipeline complexity; FPL team changes between seasons make it hard to interpret | Focus on current-season form windows; add historical as v2 |
| Mini-league analysis | "Show me how to beat my rivals" | Requires fetching each rival's squad — N×1 API calls; data mostly uninteresting | Out of scope v1; personal squad optimisation only |

---

## Feature Dependencies

```
Data pipeline (FPL + Understat fetch + merge)
    └──required by──> ALL features below

FPL proxy (server-side Route Handlers)
    └──required by──> Squad view, Transfer suggestions, Bank balance

Player ID mapping (FPL ↔ Understat)
    └──required by──> xG/xA display, Gem composite score

Squad view (Team ID input)
    └──required by──> Transfer suggestions, Sell price accuracy
    └──enhanced by──> FPL login (unlocks bank balance + selling_price)

Gem composite score
    └──required by──> Transfer suggestions (ranks replacements by Gem delta)
    └──requires──> xG/xA (from Understat), custom FDR, per-90 form

Custom FDR (xG/xGA-based)
    └──required by──> Gem composite score, Fixture display
    └──requires──> Understat team-level xGA data OR FPL goals conceded history

DefCon hit rate
    └──requires──> Per-match element-summary history (not bootstrap-static season totals)
    └──independent of──> Understat (DefCon data is FPL-native)

Transfer suggestions
    └──requires──> Squad view + Gem scores + budget (selling_price or estimated)
    └──enhanced by──> FPL login (exact selling prices vs estimated)
```

### Dependency Notes

- **All features require pipeline**: No feature can be built without the Python pipeline writing to Blob first.
- **Transfer suggestions require Gem scores**: Suggestions rank replacements by Gem improvement — Gem scoring must be complete first.
- **xG/xA requires player ID mapping**: Building the mapping file (`player_id_map.json`) is a one-time manual task that gates all Understat-dependent features.
- **DefCon hit rate is FPL-only**: It does NOT require Understat. It can be built independently in parallel with xG/xA work.
- **Squad view enhances but doesn't block**: Gem table, DefCon table, and club form work without the user providing a Team ID.

---

## MVP Definition

### Launch With (v1) — What's in PROJECT.md

- [x] **Data pipeline** — FPL + Understat fetch, merge, upload to Blob daily. Gate for everything.
- [x] **Player API** — `/api/players` serving merged + scored player data.
- [x] **Gem rating table** — sortable/filterable table with composite score per player. Core value.
- [x] **DefCon analysis** — separate DEF / MID+FWD tables; hit rate, avg contributions, distance-to-threshold.
- [x] **Squad view** — enter Team ID, see your squad with prices, flags, and Gem scores.
- [x] **Transfer suggestions** — ranked by Gem delta, budget-enforced, position-locked.
- [x] **Club form table** — wins/goals/conceded over last N games.
- [x] **Value/cheap gems** — low-owned high-scorers; price trend.
- [x] **Player signals** — xG/xA per 90, minutes reliability, injury flag, set piece notes (text).

### Add After Validation (v1.x)

- [ ] **FPL login** — unlocks exact selling prices and transfer count. High value but more complexity (cookie-jar auth).
- [ ] **Multi-transfer combos** — "who are the best 2 transfers" combinatorial suggestions. Requires Gem scores to exist first.
- [ ] **DefCon hypothesis** — tough vs easy fixture DefCon correlation. Needs at least a full season of per-match data.
- [ ] **Custom FDR visualisation** — show the custom FDR vs official FDR side-by-side for transparency.

### Future Consideration (v2+)

- [ ] **Historical season comparison** — cross-season xG/xA trends. Adds pipeline complexity.
- [ ] **Price prediction** — community-quality prediction needs transfer modelling beyond scope here.
- [ ] **Mobile-optimised layout** — web-first for v1; responsive polish post-launch.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Data pipeline (FPL + Understat) | HIGH | HIGH | P1 — gates everything |
| Gem rating table | HIGH | MEDIUM | P1 — core value |
| Squad view (Team ID) | HIGH | LOW | P1 — personalisation anchor |
| DefCon analysis tables | HIGH | MEDIUM | P1 — differentiator (new rule) |
| Transfer suggestions | HIGH | HIGH | P1 — core value |
| Player xG/xA display | MEDIUM | MEDIUM | P1 — differentiator |
| Club form table | MEDIUM | LOW | P1 — table stakes |
| Injury/flag display | HIGH | LOW | P1 — table stakes |
| Cheap gems / low-owned | MEDIUM | LOW | P1 — table stakes |
| Minutes reliability | MEDIUM | LOW | P1 — input to Gem score |
| Custom FDR | MEDIUM | MEDIUM | P1 — required for accurate Gem |
| FPL login (selling prices) | HIGH | HIGH | P2 — enhances transfers |
| Multi-transfer combos | MEDIUM | HIGH | P2 — after core transfers work |
| DefCon hypothesis analysis | LOW | MEDIUM | P2 — research feature |
| Set piece flag (structured) | LOW | HIGH | P3 — text field only; unreliable |
| Historical comparison | LOW | HIGH | P3 — complex; defer |

---

## Competitor Feature Analysis

| Feature | FPL Core (fplcore.com) | Fantasy Football Scout | Our Approach |
|---------|----------------------|----------------------|--------------|
| Player comparison | Side-by-side stats UI | Detailed stats tables | Gem composite score collapses comparison to one actionable number |
| Fixture difficulty | Official FDR colours | Custom FDR with analyst notes | Computed custom FDR from xG/xGA; no manual editorial layer needed |
| Transfer suggestions | Manual comparison | Scout picks (editorial) | Algorithmic: ranked by Gem delta + budget enforcement |
| DefCon analysis | Not available | Basic defensive stats | Full DefCon hit rate, threshold distance, position-split tables |
| xG/xA | FPL built-in only | Opta stats (paid) | Understat (free, shot-level) via soccerdata |
| Squad-aware transfers | No | No | Yes — uses your selling prices, your bank balance |

---

## Sources

- FPL API bootstrap-static field list: confirmed via PITFALLS.md + [FPL API Guide — UK Retro Gaming](https://ukretrogaming.co.uk/blogs/blog/a-complete-guide-to-the-fantasy-premier-league-fpl-api)
- DefCon fields (`defensive_contributions`, `clearances_blocks_interceptions`): [What's new in 2025/26 Fantasy — Premier League official](https://www.premierleague.com/en/news/4361991/whats-new-in-202526-fantasy-defensive-contributions)
- Understat coverage (EPL from 2014/15): [soccerdata Understat docs — DeepWiki](https://deepwiki.com/probberechts/soccerdata/3.5-understat-and-sofascore-scrapers)
- Set piece flag limitation: confirmed from `bootstrap-static` field inspection — no boolean flag exists, only `news` text
- Selling price formula and `my-team` endpoint: PITFALLS.md Pitfall 3
- Custom FDR rationale: PITFALLS.md Pitfall 8
- Transfer position rules: PROJECT.md context section

---

*Feature research for: FPL analytics web app*
*Researched: 2026-03-26*
