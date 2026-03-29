# Pitfalls Research

**Domain:** FPL decision engine — projected points, xMins, buy/hold/sell, captaincy, explainability, session-cookie auth added to existing FPL Analyst app (v1.1 milestone)
**Researched:** 2026-03-29
**Confidence:** HIGH (v1.0 pitfalls verified; v1.1 pitfalls derived from community post-mortems, FPL Review docs, codebase inspection, and first-principles analysis of the existing code)

---

## Scope Note

This file extends the v1.0 PITFALLS.md (also at this path). It supersedes the previous version and contains all prior pitfalls plus new v1.1-specific pitfalls. Previous pitfalls 1–13 are retained in condensed form in the appendix; the new pitfalls below are numbered 14 onwards.

---

## Critical Pitfalls

### Pitfall 14: Projected Points Uses Minutes as a Multiplier — But xMins Is Not Linearly Proportional to Expected Value

**What goes wrong:**
The naive projected-points formula is: `xPts = base_event_rate × xMins`. This assumes expected points scale linearly with minutes. They do not. The FPL scoring system is non-linear: a player with 90 xMins does not score 3× the points of a player with 30 xMins. Appearance points (1 pt for <60 min, 2 pts for ≥60 min) create a cliff, clean-sheet points apply only with >59 minutes, and bonus points are match-level not minute-proportional. A player projected at 51 xMins (blending a 60% chance of starting and 40% chance of being a sub) is NOT expected to score 51/90 of a full starter's projected points.

**Why it happens:**
Developers see the formula `xPts = rate × minutes` used in analytics and apply it directly. The non-linearity of FPL's scoring bins is easy to overlook when the formula "approximately works" for starters.

**How to avoid:**
- Model projected points as expected value over a probability distribution of playing-time scenarios, not as a continuous linear scale:
  - Scenario A: Starts and plays 60+ mins (probability p1) → full clean sheet / appearance points eligible
  - Scenario B: Starts but subbed before 60 mins (probability p2) → 1-pt appearance, no clean sheet
  - Scenario C: Comes off bench (probability p3) → 1-pt appearance, minute-weighted goal/assist probability
  - Scenario D: Does not play (probability p4) → 0 pts
- Weight each scenario by its probability and sum: `xPts = p1*xPts_full + p2*xPts_sub60 + p3*xPts_bench + p4*0`
- For v1.1 keep it tractable: use `start_probability` (from recent starts/appearances ratio) as the weight on "full" vs "partial" scenarios rather than a full simulation

**Warning signs:**
- A rotation-risk player (40% start prob) shows projected points only slightly below a nailed starter — the minutes multiplier is masking the non-linearity
- A player with 55 expected minutes always projects equal clean sheet probability to one with 90 — the 60-minute threshold is being ignored

**Phase to address:**
Projected Points phase (PROJ-01/02/03) — build the model correctly from the start; do not prototype with linear xMins multiplication and plan to fix it later.

---

### Pitfall 15: Rotation Risk Badges Based on Recent Minutes Conflate Injury Recovery with Actual Rotation

**What goes wrong:**
The most common xMins pitfall: using raw historical minutes to classify rotation risk. A player returning from a 6-week injury will have genuine zeroes and low-minute appearances in their history that look identical to a squad rotation pattern. The minutes distribution `[0, 0, 0, 25, 45, 55, 80, 87, 90]` — injury recovery — produces the same "rotation risk" badge as a genuine squad player. After full recovery, the model dramatically underestimates start probability.

**Why it happens:**
Historical minutes are easy to retrieve from `element-summary/{id}/history`. The underlying cause (injury vs rotation) is not encoded in the FPL API data — it requires reading `news` and `status` fields alongside the history.

**How to avoid:**
- Always read `status` and `news` alongside minutes history: `status == 'a'` with blank `news` indicates fully available
- Exclude minutes from gameweeks where `status` was not `'a'` when computing rotation statistics — or at minimum, weight recent fully-fit matches higher than injury-period matches
- Add a "recovering" flag: if the last N weeks include a transition from non-available status to available with rising minutes, suppress the rotation risk badge and show a "returning from injury" indicator instead
- Use `starts` and `minutes` from `bootstrap-static` (season aggregates) alongside the per-match history — a high `starts / games_played` ratio with recent zeroes is the rotation signal; a low ratio that recently recovered is the injury signal

**Warning signs:**
- A well-known first-choice starter just back from injury gets a "Rotation risk" badge despite being nailed pre-injury
- Players whose `news` field is empty (fully fit) are still showing "Cameo risk" based on old injury minutes

**Phase to address:**
xMins / Minutes Risk phase (MINS-01/02) — design the classification logic from the start with injury-awareness; do not compute rotation risk from raw minutes alone.

---

### Pitfall 16: The Existing `form_pts_per90` Field in `merged_players.json` Is FPL's Rolling Average, Not a Pipeline-Computed Field — Projected Points Must Not Double-Count It

**What goes wrong:**
In `merge.py`, `form_pts_per90` is set to `_safe_float(element.get('form', '0'), 0.0)` — this is the FPL API's own `form` field, which is a rolling 30-day average of points per game. If the projected points engine is then built on top of `form_pts_per90` as an input feature, it is building on FPL's black-box rolling average. This creates two problems:
1. It double-counts form — if fixture difficulty and xG/xA are also inputs, those correlate with form; the composite overfits recent noise
2. The `form` field is not per-90; despite being named `form_pts_per90`, it is FPL's `form` divided by 1 (not normalised by minutes), making the name misleading for projected-points calculations

**Why it happens:**
`form_pts_per90` is already in `MergedPlayer`. The projected points engine author naturally reaches for it as an input. The misleading name (`per90`) suggests it is already minute-normalised.

**How to avoid:**
- Audit what `form_pts_per90` actually contains before using it in projected-points logic: it is `element['form']` from FPL — a 30-day rolling points-per-match average, not a per-90 normalised value
- For projected points, compute the underlying rates separately: goals per 90 (from Understat xG), assists per 90 (from Understat xA), clean sheet probability (from fixture difficulty + team defensive metrics), appearance points probability (from xMins model)
- Do not feed `form_pts_per90` directly into a projected-points formula as if it represents something independent of FPL's own estimate — it partially already is a points projection

**Warning signs:**
- Projected points values track very closely with `form_pts_per90` for all players — the model is essentially just re-scaling FPL's own form field
- Projected points for a player with a big upcoming fixture swing look almost identical to their recent form — fixture impact is not being captured

**Phase to address:**
Projected Points phase (PROJ-01) — before writing the projection formula, audit what each `MergedPlayer` field actually contains.

---

### Pitfall 17: `MergedPlayer` Schema Must Be Extended for v1.1 Fields — Not Patched at the UI Layer

**What goes wrong:**
v1.1 adds new per-player fields: `xMins`, `start_probability`, `rotation_badge`, `projected_pts_1gw`, `projected_pts_3gw`, `projected_pts_5gw`, `recommendation`, `captain_score`. The path of least resistance is to compute these in TypeScript at the UI layer (in a React component or a hook), passing them alongside a `MergedPlayer`. This bypasses the single source of truth established in v1.0 (`merged_players.json` → `MergedPlayer` type) and creates two data layers that can desynchronise.

**Why it happens:**
The pipeline is Python and runs daily; adding a field to it means editing `merge.py`, `run.py`, and the Python schema. The TypeScript layer is more familiar and faster to iterate. Developers add a quick computed field to a hook or component.

**How to avoid:**
- All new per-player fields that are derived from pipeline data (projected points, xMins, rotation badge) must be computed in Python and added to `merged_players.json` and the `MergedPlayer` TypeScript type simultaneously
- TypeScript-only computations are acceptable only for pure presentation transforms (formatting a number for display) — never for analytics logic
- When adding to `MergedPlayer`, follow the existing pattern: update `pipeline/merge.py` first, run the pipeline, verify the new field appears in `pipeline/cache/merged_players.json`, then update `src/lib/types.ts`

**Warning signs:**
- A new computed field exists in a React hook or component but is not in `MergedPlayer`
- Two different components compute the "same" value with subtly different logic (e.g. projected points computed in both the panel and the captaincy table)
- `merged_players.json` and `MergedPlayer` type have diverged — fields exist in one but not the other

**Phase to address:**
First phase of v1.1 (projected points pipeline) — establish the schema extension pattern before building any UI layer for new fields.

---

### Pitfall 18: Buy/Hold/Sell Recommendation Conflicts with Existing Transfer Engine Rankings — No Tie-Breaking Strategy

**What goes wrong:**
The existing `computeTransferSuggestions()` in `transfer-engine.ts` ranks sell candidates by `gem_score` ascending (lowest gem score = sell first). The v1.1 Buy/Hold/Sell recommendation (REC-01) is a separate classification that will also produce a "Sell" verdict for some players. If these two signals conflict — the transfer engine recommends selling Player X, but the recommendation engine says "Hold" — the user sees contradictory advice with no explanation. This is a trust-destroying experience.

**Why it happens:**
The two features are built independently, often in separate phases. The conflict is not discovered until both are rendered side-by-side.

**How to avoid:**
- Design the Buy/Hold/Sell signal as a direct extension of the existing `gem_score` logic, not a separate pipeline: `Sell` = gem_score in bottom quartile of squad AND a better-value replacement exists within budget; `Hold` = gem_score is mid-squad AND no materially better replacement is affordable; `Buy` = not in squad, top-5 gem_delta candidates
- Feed the same `gem_score` used by `computeTransferSuggestions` into the recommendation classifier — they must derive from the same source of truth
- When displaying the recommendation panel, show the `gem_delta` rationale inline: "Sell — your gem score is 0.31, best available same-position replacement scores 0.67 (+£0.3m)"
- Add a reconciliation check: if a player has `recommendation == 'Sell'` but does not appear in `computeTransferSuggestions().suggestions`, log a warning — it indicates the two systems have diverged

**Warning signs:**
- A player shows "Hold" in the recommendation panel but appears as the top sell candidate in the Transfer Panel
- The "why this recommendation" reason references a different metric than the Transfer Panel uses
- After a pipeline refresh, recommendations and transfer suggestions flip for the same player due to slightly different normalisation

**Phase to address:**
Recommendation phase (REC-01) — resolve the architecture of how recommendations relate to the existing transfer engine before writing any code.

---

### Pitfall 19: Session-Cookie Auth Expiry Is Silent and Mid-Session — Not Just on Login

**What goes wrong:**
FPL session cookies (`sessionid` at `fantasy.premierleague.com`) expire independently of when they were obtained. A user logs in, the app fetches `my-team/{id}/` successfully, and then 15–30 minutes later (or at the next daily pipeline run) the same cookie returns a 401 or redirect-to-login response with no explanatory message. The app has no mechanism to distinguish "cookie expired" from "bad data" from "FPL API down".

**Why it happens:**
Session expiry is a runtime concern, not a setup concern. It is not exercised during development (where tests run immediately after obtaining a cookie). Production use involves longer gaps between login and data fetch.

**How to avoid:**
- Never pass session cookies through to the Python pipeline — the pipeline runs on a cron schedule and cannot re-authenticate
- Auth should be on-demand: user clicks "Connect FPL Account" → Next.js Route Handler fetches `my-team` immediately → stores `selling_price` per player in server-side memory for the duration of the request → discards cookie
- Treat every `my-team` response as potentially stale: always check HTTP status before parsing; on 401/403, surface a "Session expired — please log in again" message, not a generic error
- Do not store the session cookie in the browser (`localStorage`, `sessionStorage`, or a cookie relay to the frontend) — re-prompt for credentials instead
- Test specifically: obtain cookie, wait 20+ minutes doing nothing, then attempt a `my-team` fetch — verify the expired-cookie path shows the correct UI message

**Warning signs:**
- `my-team` endpoint works once at app load but silently returns empty data or old data 30 minutes later
- Auth flow works in Vitest mocks (synchronous) but fails in real use (async with time gap)
- The app shows a player's sell price from a previous session after the user has logged out

**Phase to address:**
Auth phase (AUTH-01/02) — design the session lifecycle explicitly, not as an afterthought.

---

### Pitfall 20: FPL Login Can Trigger Account Flags — Especially Automated or Repeated Calls

**What goes wrong:**
The FPL API terms of service prohibit automated logins and scripted squad management. While the FPL community widely uses session-cookie auth for personal tools, repeated automated logins (e.g. re-authenticating on every pipeline cron run) are known to trigger account warnings or temporary bans. A leading FPL player had their account banned specifically because of automated API usage.

**Why it happens:**
Developers build auth into the pipeline's scheduled cron job for convenience. The pipeline runs daily; if it re-logs in each time, that is 365 automated logins per year.

**How to avoid:**
- Never put FPL login in the automated pipeline (`run.py`) — the pipeline uses only public API endpoints that need no auth
- Auth is UI-initiated only: user explicitly clicks a login button; the app makes a single `my-team` fetch; the cookie is used once and discarded
- Never cache or replay session cookies across sessions or pipeline runs
- Display a clear disclaimer in the UI: "FPL login is optional and used only to retrieve exact sell prices. Your credentials are never stored."

**Warning signs:**
- A `requests.Session()` with FPL credentials appears anywhere in `pipeline/run.py`, `pipeline/fpl_client.py`, or a cron job
- The app re-fetches `my-team` on every page load rather than only on explicit user action

**Phase to address:**
Auth phase (AUTH-01) — establish what auth is explicitly NOT used for before writing any auth code.

---

### Pitfall 21: Captaincy Ranking Conflates Expected Points with Captaincy Value — The 2× Multiplier Changes the Optimal Choice

**What goes wrong:**
The optimal captain choice is the player who maximises the expected value of `2 × projected_points`, not the player with the highest raw projected points. These diverge when considering variance: a player with 12 projected points and high variance (e.g. a penalty taker who might score a hat-trick or blank completely) has higher captaincy value than a player with 14 projected points and low variance (e.g. a reliable midfielder who scores 2 assists most weeks). The 2× multiplier makes variance valuable for captaincy in a way it is not for regular selection.

**Why it happens:**
"Highest projected points = best captain" is the intuitive but incorrect shortcut. Variance analysis requires a more complex model.

**How to avoid:**
- For the v1.1 "safe vs upside" split (CAP-02), make the distinction explicit:
  - "Safe" captain: highest projected points, low variance (e.g. high minutes, home fixture, good form — reliable 6–9 pts expected)
  - "Upside" captain: slightly lower projected points but high ceiling (penalty taker, DGW player, facing a team with high xGA — could blank or haul)
- Use fixture count (DGW = 2 fixtures = double captaincy value), penalty order, and home/away as the primary upside signals
- Do not attempt to model statistical variance without historical match-level data — it is out of scope for v1.1; instead use DGW status and set-piece role as upside proxies

**Warning signs:**
- The top captaincy recommendation is always identical to the top gem score — no fixture/DGW/set-piece adjustment is happening
- A player in a DGW does not appear higher on the captaincy list than equivalent single-GW players

**Phase to address:**
Captaincy phase (CAP-01/02) — design the safe/upside split from the start rather than adding it as a feature after a single-score captain ranking is built.

---

### Pitfall 22: Explainability Panel Shows Scores, Not Reasons — The User Cannot Act On a Number

**What goes wrong:**
The most common explainability anti-pattern: showing component scores (e.g. "Form: 0.72, FDR: 0.85, xG: 0.61") rather than natural-language reasons ("Strong form (avg 7.2 pts/game), easy next 3 fixtures (Southampton H, Brentford H, Wolves A), consistent starter (started 8 of last 9)"). A score dashboard tells the user nothing they could act on or verify. They cannot determine whether the recommendation is correct without independently understanding what the scores mean.

**Why it happens:**
Component scores are what the engine already computes — exposing them is the shortest path to showing "explainability". Translating scores into reasons requires a separate text-generation layer.

**How to avoid:**
- Define a set of reason templates for each positive and negative signal. For each dimension that contributes to a recommendation, generate a plain-text reason from the raw values:
  - `fdr_score > 0.75` → "Easy run of fixtures (next 3: {opponent list})"
  - `form_pts_per90 > threshold` → "In-form: averaging {N} pts per game"
  - `xg_per90 > threshold` → "High shot volume ({xg_per90} xG/90)"
  - `rotation_badge == 'Nailed'` → "Nailed starter ({start_pct}% start rate)"
  - `penalties_order == 1` → "Primary penalty taker"
- For risk flags (EXP-02): use the same pattern — "Rotation concern (started only 4 of last 8)", "Fixture swing (faces Arsenal A, Man City A in next 3)"
- Never display a component score without its label and the raw value it was derived from

**Warning signs:**
- The explainability panel shows a radar chart or bar chart of normalised scores — the user sees numbers between 0 and 1 with no reference
- A recommendation says "Sell" but the reason panel shows "Gem Score: 0.31" without explaining what that means in plain terms
- Two different players have near-identical component scores but receive different recommendations — and the UI cannot explain why

**Phase to address:**
Explainability phase (EXP-01/02) — design the reason-generation layer in parallel with the recommendation classifier, not as a post-hoc addition.

---

### Pitfall 23: Min-Max Normalisation in `computeAllGemScores` Is Squad-Context-Dependent — Projected Points Must Not Reuse the Same Normalisation

**What goes wrong:**
`computeAllGemScores` in `gem-score.ts` uses min-max normalisation across all ~700 players. The result is that `gem_score` is a relative score — it measures how a player compares to the entire player pool at that moment. This is correct for "who is the best value in the market". But projected points (PROJ-01) should be absolute, not normalised: "this player is projected to score 8.3 points in the next GW" regardless of what other players are doing. If projected points are also min-max normalised (easy to do when extending the pipeline), they become useless for captaincy comparison and for communicating "how confident are we in this projection".

**Why it happens:**
The existing normalisation pattern in `computeAllGemScores` is the established approach in the codebase. New developers extending the pipeline follow the pattern for projected points, producing a normalised 0–1 score instead of actual expected points.

**How to avoid:**
- Projected points fields (`projected_pts_1gw`, `projected_pts_3gw`, `projected_pts_5gw`) must be expressed in FPL points (e.g. 7.4 projected pts), not in a 0–1 normalised score
- Do not pass projected points through the `normalise()` function in `gem-score.ts`
- The captaincy ranking score (for ordering the top-5 candidates) may be normalised within the top-N candidates for display purposes, but the raw projected points value must also be surfaced
- Add explicit type comments on any new fields: `projected_pts_1gw: number  // absolute FPL points, not normalised`

**Warning signs:**
- `projected_pts_1gw` values are all between 0.0 and 1.0 rather than in the range of typical FPL scores (2–15 points)
- A captain candidate with 10 projected points and a candidate with 5 projected points show similar "captain scores" after normalisation

**Phase to address:**
Projected Points phase (PROJ-01) — document the distinction between normalised gem dimensions and absolute projected points before writing the computation.

---

### Pitfall 24: The `selling_price` from `my-team` Is Per-Player, Not the Budget — Budget Calculation Requires Both Fields Together

**What goes wrong:**
`my-team/{id}/` returns both `picks[].selling_price` (per player) and `entry_history.bank` (squad bank balance). The transfer budget available for a specific transfer is `entry_history.bank + selling_price_of_player_being_sold`. If only `selling_price` is fetched without `entry_history.bank`, or if `bank` is taken from a different source (e.g. the public `entry/{id}/history/` endpoint which may lag), budget calculations will be wrong. The existing `computeTransferSuggestions` in `transfer-engine.ts` already uses `bankBalance` as a parameter — AUTH-02 must populate that parameter from `my-team`, not from a separate endpoint.

**Why it happens:**
Developers fetch `my-team` for `selling_price` and separately call `entry/{id}/` for the bank balance, not realising that `my-team` already contains the authoritative bank figure in `entry_history.bank`.

**How to avoid:**
- When AUTH-01 is implemented, extract both `picks[].selling_price` and `entry_history.bank` from the single `my-team/{id}/` response
- Pass `entry_history.bank` as the `bankBalance` argument to `computeTransferSuggestions`, replacing the approximate value currently derived from the squad view
- Never call a separate endpoint for bank balance when `my-team` data is available — it creates a race condition if the user has just made a transfer

**Warning signs:**
- Bank balance after auth looks correct but transfer suggestions still show some transfers as unaffordable when they should be affordable — likely using `now_cost` as sell price instead of `selling_price`
- `bankBalance` in `computeTransferSuggestions` is being passed as a hardcoded approximate rather than the `my-team` value

**Phase to address:**
Auth phase (AUTH-01/02) — the `my-team` response structure must be fully understood before building the auth flow.

---

## Moderate Pitfalls

### Pitfall 25: Projected Points for DGW Players Must Account for Two Fixtures, Not One

**What goes wrong:**
A player in a Double Gameweek has two fixtures in one FPL gameweek. A naively computed single-fixture projection (e.g. `xPts = f(xMins, fixture_difficulty, form)`) will underestimate DGW players by approximately 2×. The DGW player appears lower on the projected points ranking than they should, and the captain recommendation is wrong.

**How to avoid:**
- Before computing projected points, check fixture count per team per gameweek using the `fixtures` array already in `MergedPlayer` — count fixtures with the same `event_id`
- For DGW players: `projected_pts = sum(xPts_per_fixture for each fixture in that gameweek)`
- A DGW xMins projection is also approximately 2× a single GW — a player who would start both DGW matches has ~180 xMins not 90

**Phase to address:**
Projected Points phase (PROJ-01/02/03) — DGW handling must be built in from the start, not retrofitted.

---

### Pitfall 26: Buy/Hold/Sell Classification Threshold Is Arbitrary Without Calibration

**What goes wrong:**
The Buy/Hold/Sell classifier needs thresholds: "what gem_score delta makes a player a 'Sell' vs 'Hold'?" Without calibration against real FPL outcomes, arbitrary thresholds (e.g. `gem_delta > 0.1 = Buy`) will produce too many Buys, making the recommendation feel like noise rather than signal.

**How to avoid:**
- Use percentile-based thresholds within the squad rather than absolute values: `Sell` = bottom quartile of squad gem scores where a better affordable replacement exists; `Hold` = second quartile; `Hold` = top half with no better affordable replacement; `Buy` = top-5 gem_delta candidates not in squad
- The key threshold is: does a better replacement exist within budget? This is already computed in `computeTransferSuggestions`. Reuse it.
- Surface confidence: "Strong Sell (gem delta: +0.38)" vs "Marginal Sell (gem delta: +0.08)"

**Phase to address:**
Recommendation phase (REC-01) — define thresholds based on the actual squad distribution, not upfront.

---

### Pitfall 27: Captaincy Safety Label Can Be Gamed by Ownership — High-Ownership ≠ Safe Captain

**What goes wrong:**
Using `selected_by_percent` as a proxy for "safe" captain (because high ownership means the community agrees) conflates popular consensus with statistical safety. A highly-owned player can still be a rotation risk, face a tough fixture, or be returning from injury. The captain recommendation that says "Haaland is safe (55% owned)" communicates nothing about his actual ceiling or floor for the upcoming gameweek.

**How to avoid:**
- "Safe" should mean: high start probability + at least average fixture + in form — not high ownership
- Ownership is relevant for a different signal: differential captaincy risk (if a high-ownership player blanks, you lose rank vs the average manager — relevant for rank-maintenance strategies, out of scope for v1.1)

**Phase to address:**
Captaincy phase (CAP-02) — define "safe" explicitly in terms of the player's own profile, not the crowd's opinion.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Compute projected points as `form_pts_per90 × xMins` | Fast to build | Double-counts FPL's own estimate; misses DGW, clean sheet cliffs | Never — build component model from start |
| Classify rotation risk from raw historical minutes only | Simple, data is already in pipeline | Injury recovery misclassified as rotation risk; nailed starters flagged | Never — always combine with `status` and `news` |
| Derive Buy/Hold/Sell in TypeScript, not Python pipeline | No pipeline change required | Schema drift; recommendations inconsistent with gem_score | Never — all analytics in pipeline |
| Store FPL session cookie in `localStorage` for convenience | Persistent auth across sessions | Cookie theft via XSS gives FPL account access | Never — ephemeral server-side only |
| Hardcode safe/upside captaincy threshold as a fixed number | Simple to ship | Stale in weeks 5–15 when form distributions shift | Acceptable if documented and revisited each milestone |
| Show component score numbers instead of reasons in explainability panel | No text generation required | User cannot validate or act on the recommendation | Acceptable only in dev/debug mode — never for production UI |
| Use official FPL `ep_next` / `ep_this` fields for projected points | Zero pipeline work | FPL's own projection is a black box; cannot explain it; inaccurate for set-piece/DGW situations | Acceptable as a fallback or sanity-check comparison, never as the primary signal |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `computeAllGemScores` → projected points | Passing projected points through the same `normalise()` function | Projected points are absolute (FPL points); do not normalise to 0–1 |
| `computeTransferSuggestions` → recommendation engine | Building buy/hold/sell separately, creating conflicting signals | Derive recommendations directly from the same `gem_score` and `gem_delta` values |
| `my-team` auth → transfer engine | Fetching `selling_price` without also capturing `entry_history.bank` | Extract both from one `my-team` call; pass `bank` as `bankBalance` to `computeTransferSuggestions` |
| `MergedPlayer` schema → v1.1 fields | Adding projected points / xMins in a TypeScript hook rather than in `merged_players.json` | Pipeline first, then type; never analytics in the UI layer |
| `minutes_per90` in `MergedPlayer` | Using it as if it is minutes-per-90-minutes normalised (it is actually `minutes / starts`) | For xMins, compute `total_minutes / total_appearances` to get average minutes per match, or use `starts` and `minutes` separately |
| FPL login → pipeline | Adding auth to `pipeline/run.py` or `pipeline/fpl_client.py` | Auth is UI-initiated only; pipeline never logs in |
| Session cookie → multiple requests | Re-using a cookie obtained at UI login time for later pipeline calls | One login → one `my-team` fetch → discard. Never share or replay cookies. |
| Captaincy ranking → gem_score | Ranking captaincy by `gem_score` alone | Apply DGW multiplier, fixture count, and set-piece order on top of gem_score |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Computing projected points in the Next.js route handler on each request | API route is slow on each page load | All projections pre-computed in Python pipeline and stored in `merged_players.json` | Immediately — pipeline exists precisely to avoid this |
| Fetching `element-summary/{id}/history` per player for xMins | Data ingestion takes 10+ minutes | Cache element-summary for 24h; fetch only changed players on incremental refresh | At first pipeline run with ~700 players |
| Re-authenticating with FPL login on every page load | FPL may flag repeated logins; session is slow | Auth on explicit user action only; cache `selling_price` in React Query for the session duration | After a few hundred rapid logins |
| Rendering an explainability panel with per-player reason strings computed in JavaScript | UI jank on player table scroll | Pre-render reason strings in Python pipeline alongside projected points | At ~700 player table with 5 reason strings each |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing FPL credentials in `.env` and committing to git | Credential exposure in version history | Never log or persist FPL email/password; prompt at runtime in UI only |
| Returning raw `my-team` response to the browser | `selling_price`, squad structure, and transfer history exposed in browser network tab | Extract only the fields needed (`selling_price` per player, `bank`); return a minimal payload |
| Logging session cookies in Next.js request logs | Cookie usable to access the FPL account | Explicitly scrub any cookie header from server logs |
| Passing session cookie from browser → Next.js API → Python pipeline | Cookie lifetime extended; more exposure surface | Session cookie never leaves the Next.js Route Handler; pipeline has no auth |
| Trusting user-supplied Team ID without validation | No auth risk (Team ID is public), but malformed IDs could cause unhandled errors in pipeline | Validate Team ID as a positive integer in the Route Handler before passing to FPL API |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing projected points without confidence interval or caveats | User treats 7.4 projected pts as a guarantee and is surprised by a blank | Add "±" range or a "confidence" qualifier: "7.4 pts (moderate confidence — rotation risk)" |
| Recommendation says "Sell Saka" based on a fixture swing | User correctly ignores it; trust in all recommendations drops | Apply a minimum gem_score floor: never recommend selling players above a quality threshold |
| Captain recommendation list shows 5 players with similar scores | User cannot distinguish; ignores all 5 | Force ranking with clear tier labels: "1st choice", "2nd choice"; do not show near-ties without explanation |
| Explainability panel opens on hover and closes before readable | User cannot absorb the reason | Use click-to-open or persistent panel; hover tooltip only for very short reasons |
| "Rotation risk" badge on a player the user knows is nailed | User distrusts the badge system entirely | Show the evidence: "3 of last 8 appearances were subs or DNPs" — user can judge |
| Buy/Hold/Sell recommendation for a player who is injured | User confused — why is an injured player a "Hold"? | Filter recommendations: injured/unavailable players should show a status badge, not a trade recommendation |

---

## "Looks Done But Isn't" Checklist

- [ ] **Projected points DGW handling:** A player in a DGW shows ~2× the projected points of equivalent single-GW player — verify with a known DGW week
- [ ] **xMins injury-awareness:** A player who was injured last month but is now fully fit (`status == 'a'`, blank `news`) does NOT show "Rotation risk" badge — verify with a known returning player
- [ ] **Normalisation boundary:** `projected_pts_1gw` values are in FPL points range (3–15 for starters, 0–3 for bench) — not in 0–1 normalised range
- [ ] **Auth budget accuracy:** After logging in, the available budget shown for a transfer matches what FPL's own interface shows — verify with a player who has risen in price (sell price should be less than buy price)
- [ ] **Sell price integration:** `computeTransferSuggestions` `bankBalance` parameter is sourced from `entry_history.bank` (from `my-team`) when auth is active — not from a separate API call or estimate
- [ ] **Recommendation-transfer coherence:** Every player marked "Sell" appears in `computeTransferSuggestions().suggestions` — if not, both systems must be reconciled
- [ ] **Session expiry path:** After 30 minutes idle, the app shows "Session expired — please log in again" rather than a generic error or stale sell prices
- [ ] **Explainability reasons:** The explainability panel shows natural-language reasons ("Easy fixtures", "Consistent starter") not just component score numbers — verify on three different player types
- [ ] **Captaincy DGW boost:** A DGW player with moderate per-GW projection appears in the top 3 captaincy candidates — verify in a DGW week
- [ ] **form_pts_per90 audit:** Confirm `form_pts_per90` in `merged_players.json` equals the raw FPL `form` field (not a per-90 normalised value) — and that projected points engine does NOT treat it as a per-90 rate

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Linear xMins projection discovered in production | MEDIUM | Rebuild projection model with scenario-based approach; re-run pipeline; projected points in `merged_players.json` will update on next run |
| Injury history conflated with rotation — wrong badges | LOW | Add `status`-filtered lookback window in `defcon.py`/merge logic; re-run pipeline; badges update immediately |
| Schema drift (new fields computed in TypeScript not Python) | HIGH | Audit all analytics in hooks/components; migrate to pipeline; update `MergedPlayer` type; UI refactor |
| Session cookie stored in `localStorage` discovered in production | LOW but urgent | Remove `localStorage` call; force re-login (no session migration possible); cookie was never auth-safe in localStorage |
| Buy/Hold/Sell conflicts with Transfer Panel | MEDIUM | Decide canonical data source (gem_score wins); rewrite recommendation classifier to derive from gem_score; test both panels with same player set |
| Projected points not normalised — showing 0–1 instead of FPL pts | LOW | Fix normalisation step in pipeline; `merged_players.json` updates on next run; no UI refactor needed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Linear xMins multiplication (14) | Projected Points (PROJ-01) | Rotation-risk player's xPts is not 60% of a nailed starter's xPts unless minutes model supports that |
| Injury/rotation conflation (15) | xMins phase (MINS-01/02) | Returning-from-injury player with blank `news` shows "Nailed" or "Likely start", not "Rotation risk" |
| `form_pts_per90` double-counting (16) | Projected Points (PROJ-01) | Projected pts correlates with xG/fixture difficulty, not just with FPL `form` field |
| Schema drift — new fields in TypeScript (17) | First v1.1 phase, any | No analytics computed in hooks or components; `merged_players.json` contains all projected fields |
| Recommendation-transfer conflict (18) | Recommendation phase (REC-01) | Every "Sell" recommendation appears in transfer suggestions; no contradictory signals |
| Session expiry silent failure (19) | Auth phase (AUTH-01) | 30-minute idle → explicit "session expired" message, not broken state |
| Auth in pipeline / repeated logins (20) | Auth phase (AUTH-01) | `pipeline/run.py` contains zero authentication code; login is UI-initiated only |
| Captaincy variance — safe vs upside (21) | Captaincy phase (CAP-01/02) | DGW player appears in top captaincy candidates; safe/upside are separate labelled lists |
| Scores not reasons in explainability (22) | Explainability phase (EXP-01/02) | Every recommendation shows at least 2 natural-language reasons, not just component scores |
| Projected points normalised to 0–1 (23) | Projected Points (PROJ-01) | `projected_pts_1gw` range is 0–20 FPL pts, not 0–1 |
| `selling_price` without `bank` (24) | Auth phase (AUTH-02) | Budget after login matches FPL interface to within £0.1m |
| DGW double fixture projection (25) | Projected Points (PROJ-01/02) | DGW player projects ~2× a similar single-GW player |
| Arbitrary Buy/Hold/Sell thresholds (26) | Recommendation phase (REC-01) | "Sell" count per typical squad is 1–3, not 8–11; thresholds are squad-relative |
| Ownership as "safe" captain proxy (27) | Captaincy phase (CAP-02) | "Safe" label correlates with start probability and form, not ownership percentage |

---

## Appendix: v1.0 Pitfalls (condensed)

The following pitfalls from the v1.0 research remain valid. They are resolved in the existing codebase but must not be regressed during v1.1 development.

| Pitfall | Status | v1.1 Regression Risk |
|---------|--------|----------------------|
| CORS — all FPL calls via server proxy | Resolved (proxy at `/api/fpl/[...proxy]`) | Low — proxy exists; do not add direct browser fetches for auth endpoints |
| Session-cookie auth — cookie-jar-aware client | Partially resolved (AUTH-01 not yet built) | Active — v1.1 must implement correctly |
| Sell price ≠ buy price | Resolved (approximate; exact requires AUTH-02) | Active — AUTH-02 must use `selling_price`, not `now_cost` |
| DGW/BGW form inflation | Resolved (`form_pts_per90` uses FPL rolling average) | Active — projected points must not reintroduce gameweek-count normalisation |
| DefCon field confusion (`defensive_contributions` vs CBIT) | Resolved | Low — DefCon phase complete |
| Understat name mismatch | Resolved (`player_id_map.json`) | Low — map maintained |
| FPL API field changes | Mitigated (Zod adapter) | Low — adapter exists |
| Raw FDR unreliable | Resolved (custom rolling xGA FDR) | Low — FDR model in pipeline |
| Free Hit / Wildcard chip detection | Resolved (chip guard in transfer engine) | Low — chip guard already in `computeTransferSuggestions` |
| Position codes — integer not string | Resolved (type system) | Low |
| Missing Understat for promoted teams | Resolved (null not zero) | Low |
| Price change staleness | Mitigated (LastUpdated component) | Low |

---

## Sources

- [xMins (Expected Minutes) — FPL Review Documentation](https://docs.fplreview.com/the-model/projections/xmins/) — non-linear EV, scenario modelling
- [Modelling xPts in FPL — Marcus Leadboot, Medium](https://medium.com/@marcusleadboot/modelling-xpts-in-fpl-gameweek-1-01fd2179eac6) — injury vs rotation conflation, clean sheet modelling challenges
- [Fantasy Premier League API Authentication Guide — Bram Vanherle, Medium](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) — session cookie auth flow, required cookies
- [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — CORS, authenticated endpoints, `my-team` fields
- [Enhancing Fantasy Premier League with Explainable AI — Uppsala University](https://uu.diva-portal.org/smash/get/diva2:1972615/FULLTEXT02.pdf) — explainability importance for user trust, natural language vs score display
- [AIrsenal — Alan Turing Institute GitHub](https://github.com/alan-turing-institute/AIrsenal) — component-based projected points approach (team model + player model)
- [FPL Expected Points Calculator — Daniel Mehta GitHub](https://github.com/daniel-mehta/FPL-Expected-Points) — xPts formula approaches comparison
- [Codebase inspection: `pipeline/merge.py`] — `form_pts_per90` = raw FPL `form` field (not per-90 normalised)
- [Codebase inspection: `src/lib/transfer-engine.ts`] — `bankBalance` parameter, `gem_score` sort logic
- [Codebase inspection: `src/lib/gem-score.ts`] — min-max normalisation pattern
- [Codebase inspection: `src/lib/types.ts`] — `MergedPlayer` schema, `minutes_per90 = minutes / starts`
- [FPL Review on X — xMins model update](https://x.com/fplreview/status/1189252407806627841) — previous "past minutes" model replaced with hierarchical model; pure historical minutes insufficient

---

*Pitfalls research for: FPL decision engine (v1.1) — projected points, xMins, captaincy, recommendations, explainability, session-cookie auth*
*Researched: 2026-03-29*
