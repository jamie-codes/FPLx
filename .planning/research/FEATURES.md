# Feature Landscape — v1.9 Competitive Intelligence

**Domain:** FPL Analytics (post-v1.8, competitive strategy layer)
**Researched:** 2026-05-03
**Scope:** Four target features — MTP-01 (Manual Transfer Planner), ML-01 (Mini-League Rival Tracker), EO-01 (Effective Ownership & Rank Protection), TREE-01 (Transfer Route Tree)
**Replaces:** v1.8 FEATURES.md (different milestone scope)

This file is intentionally feature-shaped. Each feature gets: domain definition, FPL-specific rules, table-stakes vs differentiator vs anti-feature breakdown, complexity, and "what good looks like." Downstream: REQUIREMENTS.md writer.

---

## Feature 1 — MTP-01: Manual Transfer Planner

### What it is

A separate Planner sub-tab where the user manually designs a GW-by-GW transfer sequence. Unlike the existing AI GW Planner (`generatePlan()` which auto-suggests), MTP-01 is fully user-driven: they pick who goes in and out each gameweek and the system tracks all financial consequences and FT state across the sequence.

Core outputs per GW step:
- **Sell price** for each outgoing player (asymmetric profit rule: floor((cost - purchase_price) / 2))
- **Bank balance** after each transaction
- **Squad value** = sum of sell prices of all 15 players
- **FT bank** = remaining free transfers at that GW (accumulates to max 5 per FPL rules)
- **Hit count** = total deducted transfer penalty across the sequence
- **Break-even weeks per hit** = (4 pts cost) ÷ (projected xPts gain from the transfer)

### How FPL financial simulation actually works

| Rule | Detail |
|------|--------|
| **Sell price = asymmetric profit** | If a player's price rose since purchase: sell price = purchase_price + floor((current_price - purchase_price) / 2). If price fell: sell price = current_price. The "bank" takes half of any price rise profit. |
| **FT accumulation** | Each GW gives 1 FT. If unused, it rolls over up to a maximum of 5. Wildcard clears the FT bank to 1 the following GW. |
| **Hit cost** | Each transfer beyond the available FT bank costs −4 pts. These are deducted from the GW score where the hit is taken, not amortised. |
| **Squad value floor** | Budget = bank + sum of sell prices. Cannot spend more than this on incoming players. Position lock (GK/DEF/MID/FWD constraints) must be maintained at every GW step. |
| **Wildcard interaction** | Wildcard allows unlimited transfers in one GW at no hit cost. After wildcard, FT bank resets to 1 and all sell prices are locked in at the wildcard activation point. |
| **Free Hit interaction** | Free Hit allows temporary unlimited transfers for a single GW — squad reverts to pre-FH state afterwards. Bank and FT are unchanged. FH does NOT affect squad value. |

### FPL-specific edge cases

| Edge case | Handling |
|-----------|----------|
| **Sell price vs current price** | The app already has sell prices from v1.1 AUTH-01 (session-cookie auth with exact sell prices). Without auth, sell price approximation must use purchase_price from user input or FPL API field `purchase_price` in `picks` endpoint. |
| **Price changes during sequence** | The planner is a forward-looking simulation. Prices during the sequence are assumed static unless the user manually overrides. Do NOT auto-update prices mid-sequence — creates confusing state. |
| **Same-GW price rise** | If a player's price rises after the user's transfer-in was locked, the new sell price should update. In practice, the simulator can't know future prices — state this explicitly. |
| **Player unavailability** | If a player in the plan becomes injured or sold, the plan step shows a flag but does not auto-correct the sequence. |
| **DGW / BGW GWs** | Break-even weeks per hit should be computed on the GW-specific projected xPts (not flat average), so a DGW target clears the bar faster. |
| **Max 3 players per club** | Club cap violation must be flagged if the user builds a sequence that breaches the 3-from-1-club rule at any step. |

### Categorisation

| Category | Item |
|----------|------|
| **Table stakes** | Per-GW transfer row: player out, player in, cost (free / −4 hit). |
| **Table stakes** | Running bank balance shown at each GW step — not just the end state. |
| **Table stakes** | FT bank tracker: how many free transfers available entering each GW, how many are used, how many roll over. |
| **Table stakes** | Running hit total across the sequence (e.g., "3 hits = −12 pts so far"). |
| **Table stakes** | Break-even weeks per hit displayed per hit-transfer (not just a footer total). |
| **Table stakes** | Squad value displayed at each GW checkpoint (sell prices sum). |
| **Table stakes** | Save / load the plan session-locally — users spend time building multi-GW sequences and need persistence across page refreshes. |
| **Table stakes** | Chip designation per GW: user can mark "Wildcard GW X", "Free Hit GW Y" and the planner adjusts hit costs and FT reset accordingly. |
| **Differentiator** | Sell price vs current price vs purchase price columns — shows exactly how much value the user realises vs what the player is worth on the market. |
| **Differentiator** | Total team value trajectory chart (sparkline or simple number) showing whether the sequence builds or erodes squad value. |
| **Differentiator** | "Hit is worth it" signal: auto-calculate whether the projected xPts gain of each hit transfer exceeds 4pts in the planned horizon. Green = justified, amber = marginal, red = not worth it. |
| **Differentiator** | Comparison to the AI-generated plan from `generatePlan()` — "Your plan: +14.2 xPts vs AI plan: +18.3 xPts." Motivates users to iterate. |
| **Anti-feature** | Automatically applying price change predictions to future sell prices — this creates speculative simulation users treat as fact. Show static prices with an optional override. |
| **Anti-feature** | Per-player xPts recalculation as the user edits each GW step — this makes plan editing feel laggy and complex. Pre-compute xPts at session load and treat it as fixed during manual editing. |
| **Anti-feature** | Animated pitch view showing squad per GW — this is a v1.3 GW Planner pattern that already exists; do not duplicate it in MTP. The MTP differentiator is the financial simulation, not the visual pitch. |
| **Anti-feature** | Suggesting which player to buy — MTP is the "manual" planner. Suggestions come from the existing AI planner or from the user's own research. MTP's job is to simulate and track, not suggest. |

### Complexity

**Medium.** Pure TypeScript state machine over the existing `PlanStep` shape from `planning-engine.ts`. The core is:

1. **Immutable per-GW state** — each step is `{gw, transfersIn[], transfersOut[], ftBank, bankBalance, squadValue, hitCount}`. Immer is already used in `PlannerTab` for state mutation — reuse the pattern.
2. **Sell price computation** — already partially in place for AUTH-01/02 authenticated sessions; needs to generalise to unauthenticated flow using FPL `picks` endpoint `purchase_price` field.
3. **FT bank simulation** — simple counter with Wildcard reset and 5-cap.
4. **Break-even** — existing `suggestTransfers()` already computes hit break-even; reuse `breakEvenWeeks` from OCS-01.
5. **Persistence** — `localStorage` serialisation of the plan steps array.

Hard part: maintaining correct sell prices across a sequence when the user reorders steps (changing step 2 should recompute all downstream bank balances). Requires a pure recomputation function over the step array, not mutable references.

### What good looks like

- User adds "Sell Saka (£8.6m, bought at £8.2m, sell price £8.4m), Buy Mbeumo (£8.1m)" in GW36 and the bank updates immediately: +£0.3m (£8.4m sell minus £8.1m buy).
- FT bank shows: "GW35: 2 FT → GW36: used 1 FT, bank = 1 FT → GW37: bank = 2 FT."
- A hit in GW37 shows break-even badge: "Break even in 1 GW" (green) if xPts gain > 4, "Break even in 3 GW" (amber) if gain is 1.5–4, red otherwise.
- Exiting the page and returning restores the full sequence from localStorage.
- Chip designation "WC on GW36" removes hit costs for that GW and resets FT bank to 1 for GW37.

---

## Feature 2 — ML-01: Mini-League Rival Tracker

### What it is

A panel (new sub-tab within Plan or Squad section) that fetches all rival team squads in a user's mini-league via the FPL API, then surfaces:

- Per-rival: squad composition, captain pick, chip status, rank gap to user, shared players vs differentials
- Cross-league: which players the user should acquire to block/attack rivals
- Rank projection: how the gap changes based on template captain and fixture outcomes

### FPL API data available

| Endpoint | Data |
|----------|------|
| `leagues-classic/{id}/standings/` | All team entries in the league, with `entry` IDs, manager names, total points, current GW rank, overall rank |
| `entry/{id}/` | Team name, manager, overall rank, chips used (wildcard1/2, free_hit, bench_boost, triple_captain), bank, team_value |
| `entry/{id}/event/{gw}/picks/` | Full 15-player squad for that GW, with `is_captain`, `is_vice_captain`, `multiplier` (1/2/3 for TC), `element` (player ID) |
| `entry/{id}/transfers/` | All transfers ever made — can infer chip usage timing and current squad without paying for GW `picks` call |

All endpoints are already proxied via the app's `/api/fpl/[...proxy]` pattern (v1.0). No new infrastructure required.

### FPL-specific rules / nuances

| Rule | Detail |
|------|--------|
| **Chip status derivation** | Chips used are in `entry/{id}/chips` array (name, time, event). Compute chips *remaining* by differencing from the allowed set: {wildcard (×2 — one each half), free_hit, bench_boost, triple_captain}. |
| **Captain pick timing** | GW picks (captaincy) are only available post-deadline from `entry/{id}/event/{gw}/picks/`. Pre-deadline: captain pick is not public — do not attempt to infer it from transfer news. |
| **Shared vs differential player** | A player the user owns that rivals don't = **upside differential** (user profits if they score). A player rivals own that the user doesn't = **threat differential** (rivals profit if they score). |
| **Blocking move** | A transfer that acquires a player many rivals are targeting — reduces differential upside for those rivals. Meaningful only if there's signal (via price change data or community board) that rivals are chasing the same player. |
| **Rank gap vs points gap** | The `standings` endpoint exposes total points, not GW-specific rank gaps. GW rank gap = "how far ahead/behind will the user be after this GW if both pick the same captain?" Requires simulating both squads against a fixture. |
| **League size limits** | FPL classic leagues can have hundreds of members. The tracker should be usable with up to 20–30 rivals maximum (the relevant competitive set). For large leagues, surface only the top N rivals by closeness to user's rank. |
| **Privacy** | All data is public within the league (same scope as FPL's own league table). No auth beyond the FPL public API is needed for public leagues; private leagues need the user's `_ga_*` session cookie (already handled by AUTH-01/02). |

### Categorisation

| Category | Item |
|----------|------|
| **Table stakes** | League ID input → fetch all rival entries and display a table: Rival name | Total Pts | GW Pts | Overall Rank | Gap to User. |
| **Table stakes** | Per-rival chip status: which chips remain (WC, FH, BB, TC shown as pill per chip: green=available, grey=used). |
| **Table stakes** | Per-rival captain pick for the last completed GW (not pre-deadline — post-deadline public data only). |
| **Table stakes** | Shared players list: players both the user and a specific rival own (click to expand rival squad or view overlap). |
| **Table stakes** | Differential list: players the user owns that the rival doesn't (upside differentials) and vice versa (threat differentials). |
| **Table stakes** | Rank gap displayed as both points difference and overall rank difference. |
| **Differentiator** | Captain differential signal: if the user's captain pick has low EO among rivals (they are not captaining it), surface "Captain upside vs rivals" badge. |
| **Differentiator** | Chip threat signal: if a rival has a BB or TC unused and good DGW fixtures, flag "Rival may play BB this GW — beware". |
| **Differentiator** | Blocking move flag: if a player is owned by 0 of N rivals and the user is planning to bring them in, label it "Blocking move" (no rival benefits). |
| **Differentiator** | Attacking move flag: if a player is owned by many rivals but the user doesn't own them, label the potential transfer "Attacking move" (capturing shared upside). |
| **Differentiator** | Rank protection filter: surface which players the user must captain to not lose rank vs the modal rival captain pick. |
| **Anti-feature** | Pre-deadline captain prediction based on transfer news. Post-deadline public picks only — pre-deadline captain inference is speculation. |
| **Anti-feature** | Automated rival transfer scraping (monitoring changes in picks mid-GW). The pipeline is daily; live rival tracking requires polling infrastructure that isn't in scope. |
| **Anti-feature** | Head-to-head win probability modelling across a season. This is sophisticated enough to be a separate feature (v1.10+). The tracker surfaces context, not predictions. |
| **Anti-feature** | Sorting/ranking rival squads by their projected GW points against the user's projected GW points. EO-01 already handles the rank-impact angle; ML-01 is the data surface, not the rank simulator. |
| **Anti-feature** | Fetching all 100+ members of a large league by default. This triggers many sequential FPL API calls — rate-limit by fetching only the top 20 rivals by rank proximity to the user. |

### Complexity

**High.** Not algorithmically complex but operationally expensive:

1. **Fan-out API calls** — fetching picks for N rivals across a GW requires N sequential calls to `entry/{id}/event/{gw}/picks/`. TanStack Query with individual query keys per rival entry and parallel fetching with rate-limit delay (~200ms between calls) is the right pattern.
2. **State management** — rival data is per-league, per-GW, and relatively large. A dedicated `useRivals(leagueId, gw)` hook with 6h stale time mirrors the existing data layer pattern.
3. **Player ID resolution** — rival picks return `element` IDs; player names come from the existing `usePlayers()` data. Join on `element` = player.id.
4. **New UI surface** — the rival tracker needs a dedicated sub-panel with its own navigation state. Likely a new sub-tab under Plan section ("Rivals" alongside existing planner content).

The chip-availability derivation is non-trivial: must correctly handle that each manager gets Wildcard twice (once before and once after GW20) — need to check event number of each used Wildcard to determine if the second is still available.

### What good looks like

- User enters league ID "12345", sees a table of 8 rivals with their rank, gap, and chip status instantly.
- Clicking a rival row expands to show their squad, captain, and a diff panel: "Shared: Salah, Haaland, Saka | You have: Mbeumo (they don't) | They have: Palmer (you don't)."
- Mbeumo (owned by user, 0 rivals) is labelled "Captain upside differential."
- Palmer (owned by 6/8 rivals, not owned by user) shows "High rival threat — consider blocking move."
- Rival with BB still available and a DGW in 2 weeks shows "BB threat: GW36 DGW."

---

## Feature 3 — EO-01: Effective Ownership & Rank Protection Mode

### What it is

Two linked capabilities:

1. **EO% surface** — display estimated Effective Ownership percentage per player, specifically approximating the **top-10k EO** (the relevant competitive benchmark) rather than raw `selected_by_percent`.
2. **Mode toggle** — adjust all captain and transfer recommendations based on which strategic posture the user is in: Max xPts / Protect Rank / Chase Rank / Differential Aggressive.

### EO formula and mechanics

**Official formula (confirmed, HIGH confidence):**

```
EO = (% who started the player) + (% who captained them) + (% who triple-captained them)
```

This is why EO can exceed 100%: if 80% own a player and 50% of all managers captain them, EO = 80 + 50 = 130%.

Practical interpretation: a player with 130% EO means 1.30 pts is added to the average score for every point they score. If you don't own and captain them, you lose 1.30 pts of rank ground per point they score.

**Top-10k EO vs overall EO:**

Top-10k managers concentrate ownership and captaincy much more tightly around a smaller set of players. The standard FPL `selected_by_percent` is overall ownership. Top-10k EO is not available directly from the FPL API — it must be approximated or sourced from the community (LiveFPL provides it post-deadline).

**Data source for this app:** The FPL bootstrap provides `selected_by_percent` (overall ownership) and `transfers_in_event` / `transfers_out_event` per player. Neither is top-10k EO. The most accurate approximation available without external scraping is:

- Use `selected_by_percent` as the ownership component
- Weight by a heuristic for "captain probability among owners" — high-xPts players attract disproportionate captaincy from top managers
- Apply a scaling factor: top-10k ownership for template players is empirically ~1.4–1.8× overall ownership; for differentials it's ~0.5× (elite managers under-own popular low-ceiling picks, over-own differentials)

This is acknowledged as an approximation. Surface confidence band accordingly.

### Strategic modes

| Mode | Behaviour |
|------|-----------|
| **Max xPts** (default) | Existing captain ranking by raw xPts. No EO adjustment. |
| **Protect Rank** | Penalise low-EO captain picks (differential picks are risky when guarding a lead). EO-adjusted captain EV = `(player xPts × 2) − (EO × rank_risk_multiplier)`. Surface "dangerous to fade" label on high-EO players the user doesn't own/captain. |
| **Chase Rank** | Reward low-EO captain picks. EO-adjusted captain EV = `(player xPts × 2) + (1 − EO/100) × differential_bonus`. Differential player badge becomes more prominent. |
| **Differential Aggressive** | Maximise differential upside: only surface captain candidates with EO < 20%, ignoring EV floor. Explicitly high-risk mode with visible disclaimer. |

### FPL-specific rules / edge cases

| Rule | Detail |
|------|--------|
| **EO post-deadline only** | Top-10k EO data from LiveFPL/FotPrem is only available post-deadline (squads locked). Pre-deadline, EO is the previous GW's figure — useful as a prior but not real-time. Flag this clearly in the UI. |
| **EO and vice-captain** | VC contributes a fractional EO (if captain blanks and VC scores, the VC's 2× applies). Strictly: EO_vc = (% vice-captaining × 2) × P(captain blank). For simplicity, model VC separately as a lower-weight signal. |
| **Fading a dangerous player** | If a player has EO > 80% (even unowned by the user), the user is "fading" them and will lose rank whenever they score. Surface a "You're fading X (EO 92%)" warning in the captain panel. |
| **EO normalisation** | EO across all players in a GW does not sum to a fixed value. Total EO can well exceed N players × 100% because captaincy concentrations compound. No normalisation is needed — show raw EO% per player. |
| **Captain EV rank impact formula** | Rank impact = `(player_pts_this_gw − template_captain_pts) × (1 − EO/100)`. Positive = rank gain vs the crowd. |

### Categorisation

| Category | Item |
|----------|------|
| **Table stakes** | EO% column added to the captain panel (existing `CaptainPicksPanel`). Show EO alongside xPts for each candidate. |
| **Table stakes** | "Dangerous to fade" label on high-EO players not currently owned/captained by the user (EO > 80% threshold). |
| **Table stakes** | Mode toggle with 4 options: Max xPts / Protect Rank / Chase Rank / Differential Aggressive. Toggle stored in local state (not persisted — users switch modes frequently). |
| **Table stakes** | Captain ranking reorders when mode changes — the visible rank order shifts without page reload. |
| **Table stakes** | EO source label: "EO approximated from overall ownership — top-10k EO available post-deadline only." Honesty is required here. |
| **Differentiator** | Per-mode rank impact estimate: "Captaining X in Protect Rank mode: expected rank change ±N places." Rough estimate based on EO and opponent count. |
| **Differentiator** | "Ownership impact" label per player: Dangerous to fade / High upside differential / Moderate shield / Template pick — based on EO bands with context-aware thresholds. |
| **Differentiator** | Mini-league integration (ML-01): when ML-01 data is loaded, the EO calculation can be scoped to the user's mini-league rivals rather than the full player pool. "Local EO" = % of your mini-league who own/captain this player. |
| **Differentiator** | Rank simulation sketch: "If template captain scores 12 and you captain X instead who scores 8, you drop approximately 3 places in a 1000-person league." Rough calculation — show confidence band. |
| **Anti-feature** | Attempting to scrape real-time top-10k EO from LiveFPL or FotPrem (third-party scraping). These sites do not offer APIs; scraping their pages violates their terms of service and is brittle. Approximate from FPL bootstrap data only. |
| **Anti-feature** | EO-adjusted xPts becoming the *default* captain metric. EO is contextual — Max xPts should remain the default with EO as an opt-in lens. Users who just want best xPts shouldn't see EO noise. |
| **Anti-feature** | A fifth "Auto" mode that tries to guess the user's context (rank, GW in season, etc.) and auto-selects the right mode. This is paternalistic and often wrong. Let the user choose. |
| **Anti-feature** | VC EO modelling in full detail. VC EO is a second-order effect (P(captain blank) × VC scoring × EO of VC) — too noisy to surface reliably. Flag VC only as "also widely captained" if its EO exceeds 60%. |

### Complexity

**Medium.** Most of the complexity is in the data approximation and the mode-switching behaviour, not the algorithm:

1. **EO approximation** — `selected_by_percent` from the bootstrap is already in the pipeline. Augment with a captaincy weight: players who are top-5 in captain panel ranking get `captaincy_pct ≈ selected_by_percent × captain_concentration_factor` (0.4–0.7 depending on xPts lead). This is a heuristic, not a precise model — document accordingly.
2. **Mode toggle state** — React state; four modes; four different sort/display functions over the same captain data. Clean separation.
3. **Captain panel extension** — `CaptainPicksPanel` already has a two-card layout (v1.6 CAP-03/04). Adding EO column and mode toggle is a layout extension, not a rewrite.
4. **ML-01 integration** — if the user has loaded rival data, expose a local-EO mode as a fifth option. This is additive, not blocking.

### What good looks like

- Captain panel shows: Haaland | xPts 9.2 | EO 184% | Mode: Protect Rank → rank #1 in panel. Differential Aggressive mode → Haaland drops to bottom, a 5% EO player with xPts 6.1 rises to top.
- "Dangerous to fade: Salah (EO 127%) — you don't captain him. Expected rank loss: −0.8 pts per point he scores." surfaced as an amber warning card.
- User toggles to Chase Rank → captain panel reorders, differential badge appears on low-EO high-upside candidates.
- Mode toggle persists within the session but resets on next visit (user's strategic context changes weekly).

---

## Feature 4 — TREE-01: Transfer Route Tree

### What it is

An AI-generated comparison of 2–3 distinct multi-week transfer sequences, shown side-by-side or in a tabular comparison. Each "path" is a coherent multi-GW plan with its own:

- Player-level transfer steps per GW
- FT bank state per GW
- Hit costs per GW
- Projected xPts per GW and cumulative
- Chip interaction notes (which chips are preserved, consumed, or optimal for that path)

The key differentiator vs the existing GW Planner (`generatePlan()`): the Planner returns one best path. TREE-01 returns **N alternative paths** with explicit tradeoffs, letting the user compare and choose.

### How existing tools implement this

FPL Review's Transfer Solver is the closest reference: it uses a chess-engine-style heuristic search ("beams") and surfaces multiple "root moves" — the top-N first transfers, each of which spawns a separate continuation plan. Users pick their preferred root move and the solver continues from that path. This is effectively what TREE-01 wants to implement at a simpler scale.

The branching model for TREE-01:

```
Current squad
   ├── Path A: Transfer X→Y in GW36, Z→W in GW37 (no hit)
   │           Projected: +18.4 xPts over 3 GWs, WC preserved
   │
   ├── Path B: Transfer X→Y in GW36 + Z→W in GW36 (1 hit)
   │           Projected: +21.2 xPts over 3 GWs, 1 hit cost = −4
   │           Net: +17.2 xPts, WC preserved
   │
   └── Path C: Wildcard GW36 (reset squad)
               Projected: +24.8 xPts, WC consumed
```

Each path is scored: `path_score = cumulative_xPts − (hits × 4)`.

### How branching works in practice

The existing `generatePlan()` is a greedy + 1-level look-ahead engine. TREE-01 extends this by:

1. Generating `N` distinct top-level transfer choices (different player-in/player-out combos for GW0 of the sequence)
2. For each top-level choice, running `generatePlan()` to compute the continuation
3. Returning the top 3 paths ranked by net score

This is NOT a full beam search across the exponential space — it's "top-3 root moves, each with their greedy continuation." That's sufficient for a personal-use tool and avoids compute overload.

### FPL-specific rules / edge cases

| Rule | Detail |
|------|--------|
| **FT bank branching** | Paths that roll FT in GW0 have 2 FT in GW1; paths that spend FT in GW0 have 1 FT in GW1. These diverge significantly over 5 GWs — the FT bank difference is itself a meaningful path differentiator. |
| **Hit path vs roll path** | A −4 hit path is only better if cumulative xPts gain exceeds 4 within the horizon. Many users systematically underestimate hit break-even — the tree makes this explicit by showing both paths. |
| **Chip path: Wildcard** | One path can designate a Wildcard in GW0 (or any step). When WC is active: unlimited transfers, no hits, FT resets to 1 afterwards. `buildOptimalSquad()` (WC mode, already in v1.6) generates the WC path's player set. |
| **Chip path: Free Hit** | FH is a single-GW temporary squad. Show as a path option when FH is available; squad reverts after. FH path score = current_gw_xPts_with_optimal_FH_squad. |
| **Chip path: Bench Boost** | BB is a chip applied on top of existing squad. It's not a transfer path — more of a "when to play BB" decision. Surface BB as a note on the path that happens to have best bench xPts, not as a branching dimension. |
| **Path ordering** | Default sort: net xPts (cumulative xPts minus hit costs). User can also sort by: minimum hits, maximum ceiling, chip preservation. |
| **Horizon mismatch** | Paths must be compared over the same GW horizon. If Path A has a hit in GW1 and Path B doesn't, compare both over a 3-GW horizon minimum to allow the hit to break even. |

### Categorisation

| Category | Item |
|----------|------|
| **Table stakes** | Exactly 2–3 distinct paths shown (not 1, not 10). Cognitive load above 3 paths is too high for a weekly decision. |
| **Table stakes** | Per-path summary row: path label, transfers in GW0, total hits across horizon, net xPts (after hit deduction), chip used (if any). |
| **Table stakes** | Per-path GW-by-GW breakdown: which transfer(s) made each GW, FT bank, hit cost, projected xPts. |
| **Table stakes** | Net score formula visible: "Cumulative xPts − (hits × 4) = net score." Users must be able to audit the ranking. |
| **Table stakes** | Chip interaction per path: "Path A: WC available", "Path B: WC consumed GW36", "Path C: no chip interaction." |
| **Differentiator** | FT bank difference highlighted explicitly: "Path A rolls FT → 2 FT in GW37. Path B spends FT → 1 FT in GW37." Helps users value flexibility. |
| **Differentiator** | Confidence band on net xPts: show variance band (e.g., ±3.2 xPts) based on fixture uncertainty, so the user sees whether Path A's lead is robust or fragile. |
| **Differentiator** | Path naming: auto-label paths as "No hit (conservative)", "1-hit (moderate)", "2-hit (aggressive)" or "Wildcard reset" based on characteristics. Human-readable labels > algorithmic IDs. |
| **Differentiator** | Comparison to MTP-01 user-defined plan: if the user has a manual plan saved, add it as a 4th "Your plan" path for direct comparison. |
| **Anti-feature** | Exhaustive path enumeration (all possible N-GW transfer combinations). The search space is enormous (700 × 700 × N GWs). Top-3-root-moves with greedy continuation is the appropriate scope. |
| **Anti-feature** | Interactive branching tree visualisation (collapsible tree diagram). This is a complex D3/Recharts component that adds build time without adding decision value. A compact table comparison is sufficient. |
| **Anti-feature** | Paths that differ only by player ordering (same players, different GW of transfer). The user cannot distinguish these cognitively — deduplicate paths by the set of player changes, not the order. |
| **Anti-feature** | Running the solver on every xPts update. The tree is generated on-demand (button press), not auto-refreshed. Tree generation should be a deliberate action, not a live-recomputing background process. |
| **Anti-feature** | Showing more than 3 paths by default. 3 is the cognitive maximum for side-by-side comparison in a weekly decision. A "show more" option for power users is acceptable but should not be default. |

### Complexity

**High.** The algorithmic work is manageable but the integration complexity is significant:

1. **Branching logic** — extending `generatePlan()` to produce multiple root moves (not just the top-1 greedy choice). This requires refactoring the planner to return `PlanResult[]` not `PlanResult`. The greedy continuation from each root move can reuse `generatePlanFrom()` (already in v1.3 for manual edit mode).
2. **Wildcard path** — calling `buildOptimalSquad(chipMode='wildcard')` (already in v1.6) to generate the WC branch is available; the integration is wiring the result into `PlanResult` format.
3. **Free Hit path** — requires computing a temporary optimal squad for the FH GW only. `buildOptimalSquad(chipMode='freehit')` exists (v1.6) — same wiring job.
4. **Comparison table UI** — a side-by-side or stacked table of 2–3 paths is a new component. Design challenge: paths have variable length (different hit counts lead to different GW counts in the breakdown). Needs a unified grid layout.
5. **Dependency on planning engine state** — TREE-01 reads from the same squad + FT state as the existing planner. No new data dependencies, but must not mutate the existing plan state.

### What good looks like

- User clicks "Generate Transfer Tree" and sees three paths in <2 seconds.
- Path A: "No hit — Roll FT" | GW36: sell Rashford, buy Mbeumo (free) | Net: +16.2 xPts | WC available.
- Path B: "1 hit — Early move" | GW36: sell Rashford, buy Mbeumo + sell Jones, buy Saliba (1 hit −4) | Net: +18.8 xPts | WC available.
- Path C: "Wildcard — Full reset" | GW36: WC squad | Net: +24.1 xPts | WC consumed.
- Each path shows a compact GW-by-GW table with xPts, hit cost, FT bank.
- Best path highlighted with a green "Recommended" badge (highest net xPts).
- User can click "Use this plan" on any path to load it into the MTP-01 manual planner for further editing.

---

## Cross-feature dependency map

```
Existing v1.8 engines (start_prob, xPts pipeline, benchOrder)
   └── All four v1.9 features consume xPts projections (no new pipeline dep)

MTP-01 (Manual Transfer Planner)
   ├── Consumes: existing PlanStep/generatePlanFrom() shape from v1.3
   ├── Consumes: sell price data from AUTH-01/02 (v1.1) or FPL picks endpoint
   └── Produces: saved plan state consumed by TREE-01 path comparison

ML-01 (Mini-League Rival Tracker)
   ├── Consumes: FPL /api/fpl/[...proxy] for league + entry APIs (v1.0)
   ├── Consumes: usePlayers() for player ID→name resolution (v1.0)
   └── Produces: local EO data optionally consumed by EO-01 (mini-league scoping)

EO-01 (Effective Ownership)
   ├── Consumes: selected_by_percent from bootstrap (v1.0)
   ├── Consumes: CaptainPicksPanel (v1.6 CAP-03/04) — extends existing component
   └── Optionally consumes: ML-01 rival squad data for local-EO mode

TREE-01 (Transfer Route Tree)
   ├── Consumes: generatePlan() / generatePlanFrom() from v1.3 planning engine
   ├── Consumes: buildOptimalSquad() WC/FH modes from v1.6
   └── Produces: paths loadable into MTP-01 (link between features)
```

**Implied phase ordering:**
- MTP-01 first — foundational financial simulation needed before route tree can reference manual plans
- EO-01 second — independent of MTP/TREE; extends the captain panel which is already stable
- ML-01 third — high fan-out API calls, needs careful async handling; doesn't block EO or MTP
- TREE-01 last — depends on MTP-01 for the "load into manual planner" integration; depends on v1.6 chip engines for WC/FH paths

EO-01 and ML-01 can be parallelised. TREE-01 should follow MTP-01.

---

## Table Stakes summary

| Feature | Table Stakes (minimum viable) |
|---------|-------------------------------|
| MTP-01 | GW-by-GW transfer row, bank balance per step, FT bank tracker, hit counter, break-even per hit, chip designation |
| ML-01 | Rival table (rank/gap/chips), captain per rival (post-deadline), shared vs differential player list |
| EO-01 | EO% column in captain panel, mode toggle (4 modes), "dangerous to fade" warning |
| TREE-01 | 2–3 paths with per-path summary (hits, net xPts, chip status), GW-by-GW breakdown per path |

---

## Differentiators summary

| Feature | Key Differentiator |
|---------|--------------------|
| MTP-01 | Hit-justified signal (green/amber/red), MTP vs AI-plan comparison, squad value trajectory |
| ML-01 | Blocking/attacking move flags, chip threat alert, captain differential badge |
| EO-01 | Mode-adjusted captain ranking, local-EO from ML-01 data, rank simulation sketch |
| TREE-01 | FT bank comparison per path, confidence band on net xPts, "load into MTP" bridge |

---

## Anti-features summary

| Feature | Key Anti-Features |
|---------|-------------------|
| MTP-01 | Auto-applying price change predictions to future sells; animated pitch view duplication; suggesting players (AI planner does this) |
| ML-01 | Pre-deadline captain inference; live rival transfer polling; fetching all 100+ members by default |
| EO-01 | Scraping third-party top-10k EO; EO as default captain metric; auto-mode guessing user's strategic context |
| TREE-01 | Exhaustive path enumeration; D3 tree visualisation; auto-refresh on xPts update; >3 paths by default |

---

## Prioritisation matrix

| Feature | Strategic Value | User Demand | Build Complexity | Phase Priority |
|---------|----------------|-------------|------------------|----------------|
| MTP-01 | HIGH — fills the manual planning gap; AI planner already exists | HIGH — asked for in backlog | Medium | 1st |
| EO-01 | HIGH — fundamental to top-manager decision-making | HIGH — core competitive concept | Medium | 2nd (parallel with ML-01) |
| ML-01 | HIGH — transforms the app from solo to competitive | HIGH — top-3 backlog item | High | 2nd (parallel with EO-01) |
| TREE-01 | MEDIUM-HIGH — powerful but most complex build | MEDIUM — power user feature | High | Last |

If only two features ship: **MTP-01 + EO-01.** These are independent and highest decision-value per build-week. ML-01 and TREE-01 need more infrastructure and async API work.

If only three ship: add **ML-01** — it provides the context that makes EO-01's local-EO mode significantly more useful, and the rival data surface is uniquely unavailable elsewhere in the app.

---

## Sources

- [FPL Transfer Rules (Premier League official)](https://www.premierleague.com/en/news/2174907) — HIGH confidence
- [What is Effective Ownership in FPL (FF Scout, 2021)](https://www.fantasyfootballscout.co.uk/2021/03/24/what-is-effective-ownership-and-why-is-it-so-widely-talked-about-in-fpl/) — HIGH confidence
- [How to use EO for differential decisions (FF Scout)](https://www.fantasyfootballscout.co.uk/2021/03/07/how-to-use-effective-ownership-to-make-differential-fpl-decisions) — HIGH confidence
- [FPL Effective Ownership formula (AllAboutFPL)](https://allaboutfpl.com/2021/07/what-is-effective-ownership-in-fpl-fpl-guide/) — HIGH confidence
- [FotPrem Top-10k EO table](https://fotprem.com/fpl-effective-ownership) — MEDIUM confidence (live data tool, methodology inferred)
- [FPL Gameweek EO explained](https://www.fplgameweek.com/articles/fpl-effective-ownership/) — MEDIUM confidence
- [FPL Transfer Planner UX (FPL.team)](https://fpl.team/plan/) — MEDIUM confidence (UI inspection)
- [FPL Mini-League features (LiveFPL)](https://plan.livefpl.net/leagues/113224) — MEDIUM confidence (UI inspection)
- [FPL Copilot mini-league tracker](https://fplcopilot.com/minileagues) — MEDIUM confidence
- [FPL Review solver comparison (Transfer Solver vs Linear Optimiser)](https://docs.fplreview.com/the-model/solvers/solver-comparison/) — HIGH confidence (official docs)
- [FPL Copilot transfer planning guide](https://fplcopilot.com/blog/transfer-planning-guide) — MEDIUM confidence
- [FPL sell price mechanics (Premier League official)](https://www.premierleague.com/en/news/2174907) — HIGH confidence
