# Pitfalls Research

**Domain:** FPL analytics web app (personal tool, FPL API + Understat xG/xA, transfer suggestions)
**Researched:** 2026-03-25
**Confidence:** HIGH (most pitfalls verified via official FPL docs, community sources, and live API inspection)

---

## Critical Pitfalls

### Pitfall 1: CORS Blocks All Direct Browser-to-FPL-API Calls

**What goes wrong:**
Any attempt to call `https://fantasy.premierleague.com/api/*` directly from a browser (including a React/Next.js frontend) is blocked by CORS policy. The FPL API does not allow cross-origin requests from browser clients. This will silently fail or throw a network error in the browser devtools with no CORS headers on the response.

**Why it happens:**
Developers assume "it's a public API, I'll just fetch it client-side." The FPL API is public in the sense that some endpoints need no auth, but it was never designed as a third-party API — it's a first-party API for the FPL website itself.

**How to avoid:**
All FPL API calls must go through a server-side proxy (e.g. a Next.js API route or a backend service). The frontend calls your own server, which calls FPL, and returns the data. Never call FPL API endpoints from the browser directly. Build this assumption in from day one — do not prototype with browser-side fetches.

**Warning signs:**
- `CORS error` or `Access-Control-Allow-Origin` missing in browser console
- Works in Postman but fails in the browser

**Phase to address:**
Phase 1 (data layer foundation) — bake in server-side proxy pattern before any other work.

---

### Pitfall 2: FPL Auth Uses Session Cookies, Not OAuth — and Has No Official Docs

**What goes wrong:**
The FPL login flow requires a POST to `https://users.premierleague.com/accounts/login/` with `login`, `password`, `redirect_uri`, and `app: plfpl-web`. On success, three session cookies are returned: `pl_profile` (`.premierleague.com`), `sessionid` (`fantasy.premierleague.com`), and `sessionid` (`users.premierleague.com`). These cookies must then be forwarded on every subsequent request to authenticated endpoints (`my-team/{id}/`, `me/`, `transfers-latest/`).

If you do not carry the session cookies properly (e.g. you parse the cookies manually rather than using a cookie-aware HTTP session), authenticated endpoints return 401 or an empty response with no helpful error message.

**Why it happens:**
No official documentation. Developers reverse-engineer the flow from community articles, miss the dual-domain `sessionid` requirement, or use a plain `fetch` call without a session-cookie-aware client.

**How to avoid:**
Use a cookie-jar-aware HTTP client (e.g. `axios` with a `CookieJar`, or `node-fetch` with `fetch-cookie`). Make a single login call, persist the cookie jar for the duration of the session, and forward all cookies on authenticated requests. Do not store credentials or session cookies in the database — this is a personal tool and the session should be ephemeral (in-memory for the duration of a server request).

**Warning signs:**
- `my-team/{id}/` returns `{"detail":"Authentication credentials were not provided."}` or a redirect to the login page
- Auth works for a while then silently stops — session cookie has expired

**Phase to address:**
Phase 1 (data layer) — implement auth as part of the initial data-fetching service.

---

### Pitfall 3: The Sell Price Is NOT the Current Buy Price (50% Profit Tax, Rounded Down)

**What goes wrong:**
Transfer suggestion logic that computes a player's "value" for squad budget purposes uses the player's current market price (`now_cost` in the FPL API). But when the user wants to sell a player they own, the actual sell price is different:

- If price has risen since purchase: sell price = purchase price + floor((rise / 2))
- If price has fallen since purchase: sell price = current price (full loss)
- Profit is always rounded down to the nearest £0.1m

Example: Bought at £5.0m, now £5.3m — sell price is £5.1m, NOT £5.3m. The "bank" after selling is £0.3m less than assumed.

**Why it happens:**
`now_cost` (available from `bootstrap-static`) reflects the current market price for buying, not the sell price for a specific manager's player. The sell price is manager-specific and only returned by the authenticated `my-team/{id}/` endpoint. Developers building transfer logic often only call public endpoints and use `now_cost` for both sides of the equation.

**How to avoid:**
When the user provides FPL login, use `my-team/{id}/` to get `selling_price` per player (this is the actual sell price for that manager). When no login is provided, clearly label the budget estimate as approximate and document that actual sell prices may be lower. Do not compute `selling_price` yourself — always use the value from the API when authenticated, since it accounts for price change history the app does not have access to without purchase history.

**Warning signs:**
- Transfer suggestions show players as "affordable" but FPL rejects them as over budget
- Budget remaining after sell appears higher than FPL's own interface shows

**Phase to address:**
Phase 2 or 3 (transfer suggestion feature) — this is a v1 requirement, not deferred.

---

### Pitfall 4: Double Gameweeks Inflate Form Metrics — Blank Gameweeks Deflate Them

**What goes wrong:**
Form calculations (e.g. "points over last 3 gameweeks", "goals over last 5 games") that operate on gameweek-level data treat all gameweeks as equivalent. A player with a Double Gameweek (DGW) will have had two matches in one "gameweek" slot, accumulating ~2x the stats. A player with a Blank Gameweek (BGW) has zero for that gameweek despite being available.

This corrupts "form" scores and "Upcoming Gem" ratings — DGW players look like they're on fire when they're actually just playing twice, and BGW players look like they've gone cold.

**Why it happens:**
The `history` array in `element-summary/{id}/` returns one entry per gameweek, not per fixture. When a player plays twice in a DGW, their stats may be aggregated into one entry (or split into two, depending on the API response structure for that gameweek). Developers count array entries rather than normalising by fixtures played.

**How to avoid:**
- Always normalise stats per 90 minutes, not per gameweek
- Use `minutes` in each history entry to normalise: `stat_per_90 = stat / (minutes / 90)`
- When computing form windows, count fixtures (matches played) not gameweeks
- For upcoming fixture difficulty: count fixtures not gameweek slots — a DGW player has two FDR values, not one
- Check the `fixtures` endpoint with `?event=X` to get fixture count per team per gameweek before computing DGW/BGW status

**Warning signs:**
- A player appears in the top 5 form table immediately after a DGW — cross-check if they played twice
- A reliable regular starter appears to have "0 points" in a gameweek — may be BGW not poor form

**Phase to address:**
Phase 2 (form and fixture analysis) — normalisation logic must be built in from the start of that phase.

---

### Pitfall 5: DefCon Data Is Available in the FPL API But Has Nuances

**What goes wrong:**
Two new fields were added to the FPL API for 2025/26: `defensive_contributions` and `clearances_blocks_interceptions`. The `defensive_contributions` field covers CBIT for defenders and CBIRT (adding ball recoveries) for midfielders and forwards. The `clearances_blocks_interceptions` field is the defender-relevant subset.

The potential pitfall is: (a) assuming this data is NOT in the API (it is), (b) confusing which field applies to which position, or (c) implementing DefCon logic that uses `clearances_blocks_interceptions` for midfielders/forwards (wrong — they need `defensive_contributions` which includes ball recoveries).

Additionally, DefCon points are capped at 2 per match regardless of how high the raw count goes. The API's cumulative season totals won't tell you whether +2 was earned per match — you need per-match data from `element-summary/{id}/history` to calculate hit rate and "distance to threshold this season".

**Why it happens:**
The rule is new (2025/26 only). Developers working from older API documentation or FPL API wrapper libraries won't see these fields. The distinction between the two new fields for different positions is subtle and underdocumented.

**How to avoid:**
- Confirm field presence by hitting `bootstrap-static/` and inspecting a known defender and midfielder to verify both fields are present with sensible values
- Use `defensive_contributions` as the primary field for all positions; use `clearances_blocks_interceptions` only as a supplementary breakdown for defenders
- To compute per-game hit rate, iterate `element-summary/{id}/history` and check if the per-gameweek `defensive_contributions` value meets the position threshold (10 for DEF, 12 for MID/FWD)
- Do not use season-aggregate totals divided by matches — the threshold is per-match, not cumulative

**Warning signs:**
- Mid/FWD DefCon hit rates are near zero — likely using the wrong (CBIT-only) field
- Defenders showing 0 defensive contributions — field may not be populated for GKs (check position filter)

**Phase to address:**
Phase 3 (DefCon analysis feature) — but validate field presence in Phase 1 data layer.

---

### Pitfall 6: Understat Player Names Do Not Match FPL Player Names

**What goes wrong:**
Understat uses its own player name format (typically full international names, sometimes with diacritics). FPL uses a different format (often anglicised, sometimes abbreviated). A naive name-match join between the two data sources will fail silently — players go unmatched and simply have no xG/xA data, which may not throw an error but corrupts gem ratings that depend on xG/xA.

Examples of common mismatches:
- Accents and diacritics: `Rúben Dias` vs `Ruben Dias`
- Different transliterations of Cyrillic/Arabic names
- Players known by different names in different countries

**Why it happens:**
Understat and FPL are independent data sources with no shared player ID. Community solutions exist (pre-built mapping CSVs keyed by FPL player ID and Understat player ID) but they need to be maintained when new players join the league, or when players change clubs and their names are re-rendered.

**How to avoid:**
- Use a community-maintained player ID mapping (e.g. the `id_dict.csv` commonly referenced in FPL analytics projects) as the primary join key rather than name-string matching
- As a fallback for unmatched players: implement fuzzy name matching with Unicode normalisation (`str.normalize('NFD')` to strip diacritics) plus Levenshtein distance, and log any match with confidence below a threshold for manual review
- On each daily data refresh, check for newly unmatched players and alert (or log) rather than silently dropping them
- Never use raw string equality for cross-source player matching

**Warning signs:**
- xG/xA columns are null for a large percentage of players after joining
- High-profile players (known signings) show no Understat data
- xG/xA is populated for some players in a team but not others

**Phase to address:**
Phase 1 (data layer) — the join logic must be solved before any feature that depends on xG/xA can be built.

---

### Pitfall 7: FPL API Is Undocumented and Can Change Without Notice

**What goes wrong:**
The FPL API at `https://fantasy.premierleague.com/api/` has no official documentation, no versioning, no changelog, and no deprecation policy. Fields have been renamed, added, and removed between seasons. The `defensive_contributions` and `clearances_blocks_interceptions` fields are themselves an example of new fields added at the start of 2025/26 — but the same mechanism can remove or rename fields.

If the application hardcodes field names in its data-parsing logic (e.g. `player.goals_scored`), any renaming breaks silently — the field returns `undefined` instead of raising an error, leading to NaN calculations propagating through the scoring system.

**Why it happens:**
The informal "documentation" is community-maintained reverse-engineering. Community docs lag behind actual API changes by days or weeks at the start of each season.

**How to avoid:**
- Build an adapter/schema layer that maps raw API field names to internal domain names: `raw.goals_scored → player.goalsScored`. All downstream code uses the internal name.
- Add schema validation (e.g. Zod in TypeScript) at the API boundary — if expected fields are missing, fail loudly at ingestion time rather than propagating nulls
- Log the full raw API response for the first fetch of each day so field changes can be detected by diffing responses
- At the start of each new FPL season, manually verify all field names against a live API call before deployment

**Warning signs:**
- Gem scores are all zero or NaN after a season changeover
- No error logged but key metrics appear blank in UI
- A field that should always be present is consistently `undefined`

**Phase to address:**
Phase 1 (data layer foundation) — the adapter pattern must be established before any feature work.

---

### Pitfall 8: FPL FDR (Official Fixture Difficulty Rating) Is Unreliable

**What goes wrong:**
The FPL API returns `team_h_difficulty` and `team_a_difficulty` in the fixtures endpoint — integer values from 1-5 representing FPL's official Fixture Difficulty Rating. The FDR is widely regarded as inaccurate for several reasons:
- It does not differentiate attacking difficulty vs defensive difficulty (a team that scores lots AND concedes lots gets a single rating)
- It uses a generic, imprecise colour-band system rather than continuous probability
- It does not update dynamically as team form changes during the season

An analytics app that uses raw FDR values to compute "upcoming gem" ratings will produce misleading recommendations.

**Why it happens:**
FDR is the most accessible fixture difficulty signal in the API. Developers use it because it's there and it's a number. The inaccuracy is well-known in the FPL community but not obvious to new developers.

**How to avoid:**
- Do not use raw FDR as the primary fixture difficulty signal
- Compute a custom FDR from recent team xG and xGA over a rolling N-game window (both available from FPL API stats and/or Understat)
- Separate attacking fixture difficulty (how hard is it to score against this team?) from defensive fixture difficulty (how likely is this team to concede and allow clean sheet points?)
- Fall back to official FDR only if custom calculation cannot be made (insufficient data early in season)
- Clearly label any metric that uses official FDR as approximate

**Warning signs:**
- Gem rankings recommend players with "easy" fixtures that experienced FPL managers would rate as hard
- All five teams have the same "difficulty" colour for an obvious mismatch (e.g. top-6 away vs bottom-3 home)

**Phase to address:**
Phase 2 (form and fixture analysis) — build custom FDR from the start; do not prototype with official FDR and plan to replace it later.

---

## Moderate Pitfalls

### Pitfall 9: Free Hit Chip Resets Squad After Gameweek — Transfer Logic Must Account for This

**What goes wrong:**
The Free Hit chip allows unlimited transfers for one gameweek. After the gameweek ends, the squad reverts to what it was before the chip was played. Transfer suggestions that do not detect the Free Hit chip being active will show the chip squad as the user's real squad and compute wrong sell values / wrong bank balance.

In 2025/26, the Free Hit chip is available twice (refreshes after GW19). Additionally, if the user transfers a player in before playing Free Hit, that transfer is lost when the chip is played.

**How to avoid:**
- Read `active_chip` from `my-team/{id}/` — if it's `"freehit"`, display a warning that the current squad is temporary and skip normal transfer suggestions
- Read `chips` from the manager's history to detect which chips have been used and which remain
- For v1 (chips out of scope), surface a clear warning when Free Hit is detected rather than trying to compute suggestions

**Phase to address:**
Transfer suggestion phase — handle as an edge case with a graceful warning, not complex logic.

---

### Pitfall 10: Wildcard Chip Makes "Remaining Transfers" Meaningless

**What goes wrong:**
When a Wildcard is active, the user has unlimited free transfers. The `my-team/{id}/` endpoint returns `transfers.limit` which will be null or a high number when Wildcard is active. Transfer suggestion logic that checks `transfers.limit` to constrain suggestions to 1 or 2 transfers will break — it may show no suggestions ("save your transfer") or crash on null.

**How to avoid:**
- Check `active_chip` before reading `transfers.limit`
- If `active_chip == "wildcard"`, treat available transfers as unlimited
- Surface a UI message: "Wildcard active — showing full squad optimisation suggestions"
- For v1 (chips out of scope per PROJECT.md), still handle gracefully: detect wildcard and show a notice rather than broken transfer counts

**Phase to address:**
Transfer suggestion phase — guard clause at top of suggestion logic.

---

### Pitfall 11: Player Positions Are Integer Codes, Not Strings — and Dual-Position Players May Exist

**What goes wrong:**
The FPL API uses `element_type` as an integer: `1 = GK, 2 = DEF, 3 = MID, 4 = FWD`. Transfer suggestion logic that compares position strings ("MID") instead of these codes will fail. More critically, FPL does not support dual-position players (a player registered as a MID cannot be transferred in for a FWD slot) — but historically some players have changed position mid-season by FPL re-registering them.

**How to avoid:**
- Map `element_type` to position labels at the data layer boundary — never pass raw integers to feature logic
- At the start of each daily data refresh, log any players whose `element_type` has changed from the previous day's data (this catches mid-season position changes)
- Transfer suggestion enforcement: always compare `element_type` integers, not display labels, to ensure position-lock compliance

**Phase to address:**
Phase 1 (data layer) and transfer suggestion phase.

---

### Pitfall 12: Understat Only Covers Premier League — No Data for Promoted Teams in Their First Season

**What goes wrong:**
Understat covers the Premier League for seasons since 2014/15. However, for teams promoted to the Premier League for the first time (or for the first time in many years), Understat will have no prior EPL-season data and may have incomplete or missing data for their players early in the current season.

Transfer suggestion logic or gem ratings that require Understat xG/xA will produce nulls for players from newly-promoted clubs, which can cause those players to appear worse than they are (null xG treated as zero xG).

**How to avoid:**
- Treat missing Understat xG/xA as genuinely missing data, not zero — display a null/dash rather than a zero
- Do not penalise players for missing xG/xA in composite gem scores — weight xG/xA only when data is available; compute a separate score for players with and without Understat data
- Log which players have no Understat data on each refresh

**Phase to address:**
Phase 1 (data layer) and any phase that computes composite gem scores.

---

### Pitfall 13: Price Change Timing and API Staleness

**What goes wrong:**
FPL prices change overnight (UK time). The `now_cost` field in `bootstrap-static` reflects the price at the time of the last fetch. If the app caches `bootstrap-static` for 24 hours and a price change happens during the day, the cached price may be stale. This particularly matters for transfer budget calculations — a player who rose £0.1m overnight appears cheaper than they really are.

Additionally, the `selling_price` in `my-team/{id}/` reflects the selling price at the time of the fetch — not the price at the time the user makes a decision if they revisit the app later that day.

**How to avoid:**
- Display a "Last updated" timestamp on all price-sensitive views
- Consider refreshing `bootstrap-static` at a fixed time each day that is after the FPL nightly price update (FPL price changes typically finalise by ~8am UK time)
- Add a "Refresh now" button for the user to force a fresh fetch when making transfer decisions
- Clearly label all prices as of the last refresh date

**Phase to address:**
Data refresh phase — establish refresh timing and display of staleness from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use raw FPL FDR integers for fixture difficulty | Saves one feature's complexity | Misleading gem ratings, user complaints | Never — implement custom FDR from phase 2 |
| String-match player names across FPL and Understat | Avoids ID mapping maintenance | Silent data loss, broken gem ratings for many players | Never — use ID mapping from day one |
| Call FPL API directly from frontend | Faster prototyping | Breaks immediately in browser due to CORS | Never — build server proxy from phase 1 |
| Treat `now_cost` as sell price | Simpler budget logic | Overestimates user's available budget | Acceptable only if clearly labelled as approximate and no auth login |
| Hardcode FPL API field names throughout app | Faster initial development | Season changeover breaks entire app silently | Never — use adapter/schema layer |
| Use gameweek count instead of minutes for form windows | Simpler calculation | DGW/BGW distorts all form metrics | Never — normalise per 90 from the start |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FPL API | Calling from browser frontend | All calls via server-side proxy (Next.js API routes) |
| FPL Auth | Using fetch without cookie-jar | Use `axios`+`tough-cookie` or equivalent to maintain session |
| FPL `my-team` | Using `now_cost` for sell price | Use `selling_price` field from authenticated `my-team` response |
| FPL fixtures | Not checking fixture count per gameweek | Fetch `fixtures?event=X` to detect DGW/BGW per team per gameweek |
| Understat | String name matching across sources | Use community ID mapping file; fuzzy-match only as fallback |
| Understat | Scraping without delay | Add per-request delay (500ms minimum) and cache aggressively |
| DefCon | Using `clearances_blocks_interceptions` for all positions | Use `defensive_contributions` for MID/FWD; CBIT for DEF supplementary only |
| DefCon | Using season aggregates for hit rate | Use per-match `element-summary` history to count threshold-crossing events |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching `element-summary` for all ~700 players on every request | Page load takes 30-60 seconds | Cache element-summary responses for 24 hours; batch fetch on background refresh | Immediately even for a single user |
| No caching of `bootstrap-static` | Every page hit re-fetches the 2MB bootstrap payload | Cache with 24-hour TTL, refresh on schedule | At first real use |
| Understat fetch without caching | Rate limited or blocked after first few requests | Cache all Understat data with 24-hour TTL | After 10-20 requests |
| Per-player Understat fetches (serial) | Data ingestion takes minutes | Batch or parallel fetch with rate limiting | If looping 500+ players |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging FPL login credentials to server logs | Credential exposure in log files | Never log `login` or `password` fields; scrub from error traces |
| Persisting FPL session cookies to disk/database | Cookie theft gives account access | Keep session cookies in-memory only; discard after server request completes |
| Echoing raw FPL API errors to browser | API structure leakage | Normalise error responses; never proxy raw errors |
| Storing email/password in browser localStorage | Client-side credential exposure | Never store credentials; always re-prompt for login per session |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing gem scores without explaining inputs | User distrusts scores, can't validate | Show the component scores (form, xG, FDR, ownership) alongside composite score |
| Transfer suggestion says "no transfers recommended" during Wildcard | User confused — they expect suggestions | Detect chip state and show Wildcard-optimised suggestions or a clear explanation |
| Showing a player's `now_cost` as their sell value | User plans transfer, finds they're over budget in FPL | Always show buy price and estimated sell price separately |
| Not flagging when Understat data is unavailable for a player | User sees 0 xG and thinks player has no shots | Display null/dash, not zero, for missing data |
| Displaying raw FPL FDR colours directly | User assumes app uses better data than FPL | Compute custom FDR and label it clearly; hide or label official FDR if shown |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sell price logic:** Transfer budget calculation uses `selling_price` from `my-team` (not `now_cost`) — verify with a player who has risen in price
- [ ] **DGW normalisation:** Form metrics show per-90 stats, not raw gameweek totals — check a known DGW player's form window
- [ ] **DefCon hit rate:** Hit rate calculated from per-match `element-summary` history, not season aggregate divided by games — verify threshold logic per position
- [ ] **Understat join:** All starting-XI players from top-6 clubs have non-null xG/xA — zero null values for established players is the passing criterion
- [ ] **CORS proxy:** FPL API calls work from the deployed URL, not just localhost — test on actual deployment
- [ ] **Auth session:** `my-team` endpoint works after 30-minute idle — verify session cookie is not expiring between fetch calls
- [ ] **Free Hit detection:** When `active_chip == "freehit"`, transfer suggestions show an appropriate warning rather than suggestions based on the temporary squad
- [ ] **Position enforcement:** Transfer suggestions never recommend a MID as a replacement for a DEF — run a full squad scan to verify
- [ ] **Blank gameweek display:** A player on BGW shows a dash or fixture count of 0, not a "0 points scored" display that looks like poor form

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CORS discovered late | MEDIUM | Extract all data-fetching into server-side routes; 1-2 days refactoring |
| Wrong sell price in production | LOW | Fix `selling_price` field reference; no data migration needed |
| DGW inflating form — discovered in production | MEDIUM | Recalculate form with per-90 normalisation; update all cached scores |
| Understat name matching silently dropping players | HIGH | Build ID mapping, re-import data, audit which players were affected |
| FPL API field renamed at season start | MEDIUM | Update adapter/schema layer field mappings; if using Zod, get loud errors immediately |
| DefCon wrong field (CBIT vs CBIRT) | LOW | Change field reference in DefCon calculation; re-run hit rate calculation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CORS (Pitfall 1) | Phase 1: Data layer | No browser console CORS errors on any page |
| FPL auth cookie handling (Pitfall 2) | Phase 1: Data layer | `my-team` endpoint returns data after 30-min idle |
| Sell price vs buy price (Pitfall 3) | Transfer suggestion phase | Budget shown matches FPL official interface within £0.1m |
| DGW/BGW form inflation (Pitfall 4) | Phase 2: Form/fixture analysis | DGW player form score is normalised; not 2x a single-game player |
| DefCon field and per-match logic (Pitfall 5) | Phase 3: DefCon analysis + Phase 1 data layer | Hit rates are non-zero for known high-contribution defenders |
| Understat player name mismatch (Pitfall 6) | Phase 1: Data layer | 0 unmatched players for top-6 first-choice XI |
| FPL API field schema breakage (Pitfall 7) | Phase 1: Data layer | Zod schema validation throws on missing fields |
| Bad FDR data (Pitfall 8) | Phase 2: Fixture analysis | Custom FDR used; official FDR not the primary signal |
| Free Hit chip state (Pitfall 9) | Transfer suggestion phase | Free Hit warning shown when chip is active |
| Wildcard chip state (Pitfall 10) | Transfer suggestion phase | Wildcard detected; unlimited transfer mode or warning shown |
| Position code handling (Pitfall 11) | Phase 1: Data layer | No cross-position transfer suggestions in test scenarios |
| Missing Understat data (Pitfall 12) | Phase 1: Data layer | Promoted-team players show null xG, not 0 |
| Price staleness (Pitfall 13) | Data refresh infrastructure | "Last updated" timestamp visible on all price views |

---

## Sources

- [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — CORS policy, authenticated endpoints
- [Fantasy Premier League API Authentication Guide — Bram Vanherle, Medium](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) — cookie auth flow
- [Fantasy Premier League API Endpoints: A Detailed Guide — Frenzel Timothy, Medium](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — endpoint reference
- [What's new in 2025/26 Fantasy: Defensive contributions — Premier League official](https://www.premierleague.com/en/news/4361991/whats-new-in-202526-fantasy-defensive-contributions) — DefCon rule, per-position thresholds, point cap
- [FPL 2025/26: The New Defensive Contributions Rule Explained — Gethyn Ellis](https://www.gethynellis.com/2025/09/fpl-2025-26-the-new-defensive-contributions-rule-explained.html) — API field names
- [How FPL Price changes work — FPL Dashboard](https://fpl.page/article/how-fpl-price-changes-work-tool-predictor) — sell price formula
- [FPL player price changes: how, why and when — Premier League official](https://www.premierleague.com/en/news/2858775) — price change timing
- [When are the FPL Blank and Double Gameweeks in 2025/26 — Fantasy Football Scout](https://www.fantasyfootballscout.co.uk/2026/03/19/when-are-the-fpl-blank-and-double-gameweeks-in-2025-26) — DGW/BGW schedule
- [FPL Fixture Difficulty 2025/26 — All Fantasy Tips](https://allfantasytips.com/fpl-fixture-difficulty/) — FDR inaccuracy
- [FPL FDR — Premier Fantasy Tools](https://www.premierfantasytools.com/fpl-fixture-difficulty/) — community FDR alternative rationale
- [Getting data from FPL and Understat — Stateastic](https://stateastic.home.blog/2022/08/02/getting-data-from-fpl-and-understat-to-do-analysis/) — player name / ID matching approach
- [understatAPI — PyPI](https://pypi.org/project/understatapi/) — Understat scraping library
- [Free Hit vs Wildcard: What is the Difference — Ingenuity Fantasy Football](https://ingenuityfantasy.com/fantasy-fundamentals/free-hit-vs-wildcard-what-is-the-difference/) — chip mechanics
- [How and when to use your chips in 2025/26 Fantasy — Premier League official](https://www.premierleague.com/en/news/4362085/how-and-when-to-use-your-chips-in-202526-fantasy) — chip rules including Free Hit refresh after GW19

---

*Pitfalls research for: FPL analytics web app*
*Researched: 2026-03-25*
