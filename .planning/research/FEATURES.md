# Feature Landscape: FPLx v1.7 Decision Assistant

**Domain:** FPL decision assistance — transfers, captaincy, chips, bench, timing advice
**Researched:** 2026-05-01
**Downstream consumer:** Roadmap / requirements author (REQ-IDs, user-facing behaviour, complexity, dependencies)
**Replaces:** v1.6 FEATURES.md (different milestone scope)

---

## Scope Boundary

v1.7 adds six features on top of the completed v1.6 Squad Optimiser. The optimiser
itself (`optimiseLineup`, `suggestTransfers`, `buildOptimalSquad`), xPts pipeline, and
all existing UI are assumed shipped. This document covers only the new features.

---

## FPL Tool Ecosystem Reference

Research surveyed: FPLReview, FPL Copilot, FPL.team, Fantasy Football Fix, FPL Form,
FPL Stats Lab, Fantasy Football Scout, Fantasy Football Hub, AllAboutFPL, fplstrat.app,
FPLRotationPlanner.

Key finding: **no single free tool aggregates all six features on one screen for a
user's actual squad.** Most provide component tools (a fixture ticker here, a transfer
planner there). That gap is the core differentiating opportunity for v1.7.

---

## Feature 1: Transfer Opportunity Cost Simulator

### What the ecosystem does

Every serious FPL tool (FPLReview, FPL Copilot, FPL.team Planner) computes cumulative
xPts across a multi-GW horizon to answer "is this transfer worth making?" The standard
framework is:

- Roll = bank the FT; squad unchanged; net gain = 0 vs baseline
- 1-FT = best single swap; net xPts gain over horizon; no hit cost
- 2-FT = two position-matched swaps; hit cost subtracted if only 1 FT available
- Hit (-4pts) = additional transfers beyond free count; break-even analysis

The canonical formula is: `net_gain = xPts_gain_across_horizon - (hit_count * 4)`.
Break-even is `ceil(4 / xPts_gain_per_gw)` gameweeks.

FPLReview uses a "Free Transfer Value" parameter (default: 2 pts) — a saved FT is
worth ~2 pts of flexibility. This quantifies Roll vs Act.

Community consensus from Fantasy Football Scout elite manager interviews: rolling is
undervalued by most managers; a saved FT enabling two swaps next week is commonly
worth more than a marginal single swap now.

### Table stakes

| Behaviour | Why Expected |
|-----------|--------------|
| Compare Roll / 1-FT / 2-FT / Hit on the same screen | Every planner tool does this; missing = incomplete |
| Show xPts gain net of hit cost per option | Raw gain without hit cost is misleading |
| Show per-GW break-even for any hit | Community standard ("take the hit if you break even in X GWs") |
| Operate on user's actual squad (not generic) | Generic advice is table stakes for blog posts; squad-specific is product value |
| Respect current FT count (1 or 2) | Different FT counts change which options incur hits |
| Budget-feasibility check | Any option that requires more than available funds must be excluded |

### Differentiators (not expected, but valued)

| Behaviour | Value | Complexity |
|-----------|-------|------------|
| 1 / 3 / 5 GW horizon toggle (not just 1 GW) | Shows whether to act now vs wait; long-horizon Roll often wins | Low — xPts_Ngw already exists |
| Show "Roll" as an explicit row with 0 gain | Makes the opportunity cost of inaction visible | Low — UI only |
| Flag when 2-FT hit EV is negative | Prevents managers from rationalising bad hits | Low — arithmetic |
| Show specific player-pair for best 1-FT and 2-FT | Grounds the abstract comparison in real names | Medium — calls existing suggestTransfers() |
| Confidence band: "2-FT gain assumes no injuries" | Honest about approximation (additive not re-solved) | Low — copy only |

### Anti-features

| Anti-Feature | Why Not |
|--------------|---------|
| Simulate all possible n-hit combos (3, 4 transfers) | Exponential search space; personal tool, not a season-long solver |
| Probability-weighted break-even with injury risk | Requires injury probability model not in scope |
| Transfer sequence planning (multi-week sequences) | Already covered by existing GW Planner (v1.3) |

### Complexity: Medium

Core logic reuses `suggestTransfers()` (already built). New work: a comparison UI
layer that places Roll / 1-FT / 2-FT / Hit in a single structured view. Pipeline
changes: none.

### Dependencies on existing system

| Dependency | Status |
|------------|--------|
| `suggestTransfers(currentPicks, players, horizon, ftCount, bank)` | Built (v1.6) |
| xPts_1gw / xPts_3gw / xPts_5gw per player | Built (v1.4) |
| FT count input (1 or 2) | Built in TransferPanel |
| Bank balance from useMyTeam / useSquad | Built (v1.1 auth layer) |
| Sell prices from useMyTeam | Built (v1.1 auth layer) |

---

## Feature 2: Weekly Decision Summary

### What the ecosystem does

No major free tool offers a true one-screen weekly summary for a user's squad. The
closest: FPL.team's AI chat ("ask your team anything"), Fantasy Football Fix's "best
transfer" recommendation, FPL Copilot's solver output. All of these either require
interaction (chat), are single-topic (transfers only), or are paid.

The gap: a structured, data-driven, scan-in-10-seconds summary aggregating captain,
transfers, bench, chip timing, and risk flags on a single screen — personalised to the
manager's actual squad.

Expert FPL community pattern (Fantasy Football Scout, Fantasy Football Hub GW articles):
managers want to answer five questions before each deadline:
1. Who do I captain?
2. Do I make a transfer or roll?
3. How do I order my bench?
4. Should I play a chip?
5. What risks am I taking this week?

### Table stakes

| Behaviour | Why Expected |
|-----------|--------------|
| Captain recommendation with xPts and confidence | Every FPL tool surfaces a top captain pick |
| Transfer recommendation (make / roll / hit) | The primary weekly decision; every tool covers it |
| Bench order recommendation | Basic squad management; missing = incomplete product |
| Chip timing flag (if a chip is relevant) | Not every GW, but must surface when applicable |
| Injury / availability risk flags for starters | Essential for deadline decisions |

### Differentiators

| Behaviour | Value | Complexity |
|-----------|-------|------------|
| All five answers on one screen (no tab-hopping) | No competitor does this for a specific squad | Medium — new aggregator component |
| Priority ordering of recommendations | "Do captain first, then transfer" guidance reduces cognitive load | Low — ordering logic |
| Risk severity signal (High / Medium / Low) per item | Managers want to know what to worry about | Low — derive from existing signals |
| DGW / BGW callout when applicable | Context-sensitive flag; critical for chip decisions | Low — fixture data already present |
| "Autopilot" path: accept all recommendations | Shows manager what happens if they accept all | Low — UI affordance |

### Anti-features

| Anti-Feature | Why Not |
|--------------|---------|
| Natural-language prose generation (AI/LLM) | Adds dependency; brittle; hallucination risk; not in scope |
| Mini-league rank projection | Explicitly out of scope (PROJECT.md constraint) |
| Push notifications / reminders | Web-only personal tool; no notification infrastructure |

### Complexity: Medium

This is primarily a new composition component (DecisionSummaryPanel or similar) that
reads from existing hooks (useCaptainPicks, useSuggestTransfers, useOptimiseLineup,
useChipStrategy) and presents the outputs in a structured, prioritised format. The
data already exists; the challenge is aggregation logic (what to surface, in what
order, with what severity).

### Dependencies on existing system

| Dependency | Status |
|------------|--------|
| `useCaptainPicks` hook + CaptainPicksPanel logic | Built (v1.4) |
| `suggestTransfers()` + TransferPanel | Built (v1.6) |
| `optimiseLineup()` bench order output | Built (v1.6) |
| Chip strategy engine (`computeBBScore`, etc.) | Built (v1.4) |
| Player injury status / news field | Built (MergedPlayer.news, MergedPlayer.status) |
| Fixture data per player | Built (FixtureEntry[]) |

---

## Feature 3: Fixture Swing Detector

### What the ecosystem does

Fixture swing analysis is one of the most-discussed FPL strategy concepts. It is done
manually by virtually every FPL blogger (AllAboutFPL, Fantasy Football Hub, Fantasy
Football Fix) but is almost never algorithmic in free tools. The FPLRotationPlanner
claims a "Fixture Swing Tool" but it 403s on fetch. Fantasy Football Hub's fixture
ticker is the closest: a colour-coded grid where managers visually scan for green runs.

The community definition of a fixture swing: a team whose upcoming N-GW difficulty
changes materially versus their previous N-GW difficulty. "3+ green fixtures in a row"
is the informal buy signal; "4+ red fixtures" is the sell signal.

Current state in this app: `attacking_difficulty` and `defensive_difficulty` per
fixture are already computed (pipeline/merge.py, Phase 27). Club form ease aggregates
(attacking_ease_1gw, attacking_ease_3gw, attacking_ease_5gw) are also present.

What does NOT exist: a delta computation comparing upcoming ease vs past ease for each
team, and a UI that surfaces teams with the largest positive / negative swing.

### Table stakes

| Behaviour | Why Expected |
|-----------|--------------|
| Surface teams with best upcoming fixture runs | Most fixture tools do this |
| Surface teams with worst upcoming runs (sell signals) | Buy-side only is one-dimensional |
| Some notion of "swing" not just current difficulty | Static rankings exist everywhere; delta is the differentiator |

### Differentiators

| Behaviour | Value | Complexity |
|-----------|-------|------------|
| Quantified swing: upcoming_ease - past_ease (e.g., next 3GW vs prev 3GW) | Most tools show absolute difficulty, not change; delta = actionable timing signal | Low-Medium — arithmetic on existing data |
| Translated to player names from user's squad | Connecting fixture swing to "you own X from this team" is high-value personalisation | Medium — join squad players to swing teams |
| Buy/sell signal classification with threshold | "material swing" defined as delta > 0.2 on 0-1 scale (or similar) | Low — threshold logic |
| 1 / 3 / 5 GW window toggle | Matches existing horizon preference | Low |
| "Buy window" and "Sell window" framing | Buy signal = team's upcoming ease > past ease by threshold; Sell = inverse | Low |

### Anti-features

| Anti-Feature | Why Not |
|--------------|---------|
| European fixture congestion modelling | Rotation prediction requires separate data source; adds scope |
| Price rise / price fall prediction based on fixture swings | Price changes are driven by transfers, not just fixtures; out of scope |
| Fixture swing alerts / notifications | No notification infrastructure |

### Complexity: Low-Medium

Pipeline: add a `fixture_swing` metric per team in `pipeline/merge.py` or a new
`pipeline/fixture_swing.py`. Formula: `upcoming_N_ease - past_N_ease` where ease
is the mean of `1 - attacking_difficulty` over the window. Write to a new
`fixture_swings.json` cache file or embed in `merged_players.json` team-level data.

UI: a new panel (FixtureSwingPanel or extension of FixtureEaseRankingPanel) showing
top N improving and top N worsening teams, with their key players highlighted.

### Dependencies on existing system

| Dependency | Status |
|------------|--------|
| `attacking_difficulty` per fixture per player | Built (Phase 27) |
| `computeClubForm()` with ease aggregates | Built (Phase 27) |
| FixtureEaseRankingPanel (can extend or parallel) | Built (Phase 27) |
| xGI% and top-player table per team (TargetListPanel) | Built (Phase 32) |
| Squad player list for personalisation | Built (useSquad) |

---

## Feature 4: Player Lifecycle Labels

### What the ecosystem does

The FPL community uses "Buy / Hold / Sell" universally. This app already has that
(`recommend.ts`, `Verdict` type). The v1.7 extension is granular timing advice within
each category — the difference between "Hold because data supports holding" and "Hold
one more week then reassess because fixture run worsens from GW36."

Community usage confirms the following timing label concepts are well-understood:
- "Buy next week" (fixture currently hard, upcoming run improves)
- "Hold one more" (owns fixtures going soft next 1-2 GWs; sell window is GW+2)
- "Sell soon" (form declining, fixtures turning hard, but price still defensible)
- "Minutes trap" (solid stats but rotation risk means expected minutes are low)
- "Fixture trap" (popular player, high ownership, but facing hard fixtures)

These concepts are discussed weekly in expert analysis but are not implemented as
algorithmic labels by any tool found in research. They represent genuine product
differentiation.

### Table stakes

| Behaviour | Why Expected |
|-----------|--------------|
| Existing Buy / Hold / Sell verdict retained | Already built; regression = breaking change |
| Label applies to squad players | Context of "my squad" makes labels actionable |
| Label updates as data changes (pipeline-driven) | Static labels from training data are useless |

### Differentiators (the new labels)

| Label | Definition | Signals Used | Complexity |
|-------|-----------|--------------|------------|
| Buy Next Week | BUY verdict but current GW fixture is hard (≥0.7 difficulty); upcoming 1 GW improves materially | regression_signal='buy' + current fixture hard + next fixture easy | Low — combine existing fields |
| Hold One More | HOLD verdict; upcoming 1 GW easy but GW+2 onward hard; sell window is next week | xPts_1gw high, xPts_3gw low relative to xPts_1gw | Low — xPts field comparison |
| Sell Soon | SELL verdict but price still defensible (not yet falling); grace period before forced sell | regression_signal='sell' + cost_change_event = 0 (no fall yet) | Low |
| Minutes Trap | HOLD or BUY by gem score / xPts, but mins_risk is rotation_risk or cameo | mins_risk in ['rotation_risk', 'cameo'] + good xPts (per 90, not absolute) | Low — existing MinsRisk field |
| Fixture Trap | High ownership (>15%) + worsening fixtures (attacking difficulty > 0.6 next 3GW) + HOLD/BUY verdict | selected_by_percent > 15 + attacking_ease_3gw < 0.4 + verdict not SELL | Low — existing fields |

### Anti-features

| Anti-Feature | Why Not |
|--------------|---------|
| Price prediction label ("price rise incoming") | Requires transfer volume prediction; out of scope |
| Captaincy timing label ("Captain this week") | Captaincy is already covered by CaptainPicksPanel |
| Labels for all 600+ players (not just squad) | Useful in GemTable context but increases scope significantly; consider deferred |

### Complexity: Low

Labels are deterministic functions of existing MergedPlayer fields. No new pipeline
data required. New logic: a `computeLifecycleLabel()` pure function in
`src/lib/recommend.ts` (or a new `src/lib/lifecycle.ts`) that returns a structured
label alongside the existing `Verdict`.

Most complex part: defining and testing the fixture swing component of "Buy Next Week"
and "Hold One More," which requires comparing current-GW fixture difficulty vs next
1-2 GW fixture difficulty from the `fixtures[]` array already on MergedPlayer.

### Dependencies on existing system

| Dependency | Status |
|------------|--------|
| `Verdict` from `recommend.ts` (Buy/Hold/Sell) | Built (v1.1) |
| `regression_signal` ('buy'/'sell') | Built (v1.4) |
| `mins_risk` (MinsRisk enum) | Built (v1.1) |
| `fixtures[]` with `attacking_difficulty` per fixture | Built (Phase 27) |
| `selected_by_percent` | Built (v1.0) |
| `cost_change_event` | Built (v1.0) |
| `differential_flag` ('diff'/'trap') | Built (v1.4) |

---

## Feature 5: Explainable xPts Breakdown

### What the ecosystem does

FPL Copilot's xPts model description ("50+ data points, including xG, xA, CS
probability, projected minutes, bonus patterns, fixture adjustment") is the most
detailed public description found. The actual per-component breakdown is typically
behind a paid tier or not exposed.

Standard community expectation: managers want to see why a player is projected at
5.2 xPts, not just the number. The components are:
1. Appearance / minutes probability (playing time expected)
2. Goal contribution (xG-derived, position-adjusted)
3. Assist contribution (xA-derived)
4. Clean sheet probability (per-fixture, position-scaled: GK/DEF=4pts, MID=1pt, FWD=0pt)
5. Bonus points (historical bonus rate as flat adder)
6. DefCon contribution (2025/26 specific; DEF/GK defensive contribution threshold)
7. Minutes risk modifier (discount when start_prob < 0.65)

This app's pipeline already computes Poisson goal xPts, Bernoulli CS xPts, and
flat bonus — and stores them in `xPts_components_1gw` on MergedPlayer. The existing
`XPtsCell` tooltip already shows these components for 1GW. What's missing:
- Appearance points component (2 pts for 60+ min, 1 pt for 1-59 min — expected value)
- Minutes risk component (the probability-weighted discount)
- A dedicated UI surface (not just a hover tooltip)

### Table stakes

| Behaviour | Why Expected |
|-----------|--------------|
| Show the xPts number with a breakdown path | Once xPts is central to the app, "why?" is the obvious next question |
| Components must sum to the displayed total (±rounding) | Inconsistency destroys trust |
| Show for both 1GW and multi-GW horizons | Managers check both |
| Position-appropriate components | GK/DEF show CS; FWD shows goal pts prominently |

### Differentiators

| Behaviour | Value | Complexity |
|-----------|-------|------------|
| Dedicated expandable breakdown row or panel | Tooltip-only is dismissable; persistent view enables comparison | Low-Medium — new display component |
| Visual proportion bars (not just numbers) | Scan-able format; shows which component dominates | Low — CSS width from proportion |
| Minutes risk as explicit multiplier ("30% chance of starting = x0.30 discount") | Honest model transparency | Low — start_prob already exists |
| Fixture-adjusted CS% shown explicitly | Managers should see the team-vs-opponent clean sheet probability | Medium — requires per-fixture CS% (Feature 6 dependency) |
| Comparison: "This GW vs average" | Shows whether this week is a particularly good or bad projection | Low — compare xPts_1gw to xPts_3gw/3 |

### Anti-features

| Anti-Feature | Why Not |
|--------------|---------|
| Monte Carlo simulation breakdown | Analytical model is sufficient; simulation adds latency, not meaningful accuracy |
| Per-match-event probability trees | Overcomplicates; not actionable |
| Historical accuracy shown per component | Interesting but adds scope; not actionable for this-week decisions |

### Complexity: Low-Medium

Pipeline: the core components (goal_pts, assist_pts, cs_pts, bonus_pts) are already
computed and stored in `xPts_components_1gw`. Two additions needed:
1. `appearance_pts` component: `E[appearance] = start_prob * 2 + (1 - start_prob) * 0.5` (simplified)
2. `minutes_discount`: already implicit in the xPts calculation via `xmins`; make it explicit

UI: existing `XPtsCell` tooltip can be extended, or a new `XPtsBreakdownPanel`
component created for use in the Decision Summary and player detail views.

### Dependencies on existing system

| Dependency | Status |
|------------|--------|
| `xPts_components_1gw` (goal_pts, assist_pts, cs_pts, bonus_pts) | Built (Phase 28) |
| `xPts_1gw / xPts_3gw / xPts_5gw` | Built (Phase 28) |
| `start_prob`, `xmins`, `mins_risk` | Built (Phase 7) |
| `XPtsCell` component with existing tooltip | Built (Phase 28) |
| Per-fixture CS% | NOT built — dependency on Feature 6 |

---

## Feature 6: Clean Sheet Probability

### What the ecosystem does

This is a well-established analytical primitive in FPL tools. Multiple tools provide
CS% per team per fixture:

- AllFantasyTips: "CS odds shown as a decimal (e.g., 0.35 = 35% probability)"
- Fantasy Football Pundit: CS odds updated every GW for all teams
- Never Manage Alone: per-GW CS odds table

The standard methodology (MEDIUM-HIGH confidence from multiple sources):
- Model expected goals against (xGA) for the fixture
- Apply Poisson distribution: `P(goals = 0) = e^(-lambda)` where lambda = opponent xGA
- Adjust for home/away (home teams concede ~15% fewer goals on average)
- Scale by recent form (rolling window xGA, not season total)

This app already uses Poisson distribution for goal scoring xPts (Phase 28 pipeline).
The CS probability computation is an extension of the same model:
- `lambda_concede = opponent_attacking_difficulty * position_scale_factor`
  (where `attacking_difficulty` already encodes the rolling xGA of the attacking team)
- `cs_prob = exp(-lambda_concede)`
- `cs_pts = cs_prob * position_cs_points` (GK/DEF: 4, MID: 1, FWD: 0)

This cs_pts component is already embedded in `xPts_components_1gw.cs_pts`. What
does NOT exist: the raw `cs_prob` as a displayed percentage, per team per fixture,
accessible for the defensive picks view.

### Table stakes

| Behaviour | Why Expected |
|-----------|--------------|
| CS% per team per upcoming fixture | AllFantasyTips, Fantasy Football Pundit, Never Manage Alone all provide this |
| CS% consistent with xPts model (same inputs) | Inconsistency between CS% display and xPts model destroys credibility |
| GK and DEF picks ordered by CS% contribution | The primary use case for CS% data |

### Differentiators

| Behaviour | Value | Complexity |
|-----------|-------|------------|
| CS% derived from the same xGA rolling window already in the pipeline | Model consistency (not bolted-on external data) | Low — reuse attacking_difficulty |
| CS% displayed per fixture (not just per team season average) | Fixture-specific is more actionable | Low — per fixture data exists |
| Combined CS% for DGW (probability of at least one CS across two fixtures) | DGW doubles opportunity; combined CS% = 1 - (1-p1)*(1-p2) | Low — arithmetic |
| CS% surfaced in GK/DEF player card | Reduces need to cross-reference the Club Form tab | Medium — new display location |
| CS% fed into Feature 5 (xPts breakdown) | Powers the "fixture-adjusted CS%" display in explainability | Low — dependency resolved |

### Anti-features

| Anti-Feature | Why Not |
|--------------|---------|
| Betting odds integration (bookmaker CS prices) | Data sourcing dependency; not authoritative within the xPts model |
| Live CS% updates during match | Daily refresh is sufficient; in-match is out of scope |
| Season-long CS% prediction model | Adds ML scope; weekly fixture-level CS% is sufficient |

### Complexity: Low-Medium

Pipeline: `cs_prob` per fixture can be derived from `attacking_difficulty` directly.
Formula: `cs_prob = exp(-attacking_difficulty * GOAL_RATE_SCALAR)` where
`GOAL_RATE_SCALAR` is a tuning constant (approx. 1.2-1.5 based on Premier League avg
goals per game of ~2.7). This requires a calibration step: verify that the implied
mean CS rate (~30%) matches observed PL data.

Alternatively, the existing `cs_pts` component in `xPts_components_1gw` can be
reverse-engineered: `cs_prob = cs_pts / position_cs_point_value` (e.g., DEF: cs_pts/4).

Write `cs_prob` per fixture to `merged_players.json`. No new pipeline dependency.

UI: a new `CleanSheetOddsPanel` (or extension of `FixtureEaseRankingPanel`) showing
CS% per team per next 3-5 fixtures, sortable by GK/DEF value.

### Dependencies on existing system

| Dependency | Status |
|------------|--------|
| `attacking_difficulty` per fixture (rolling xGA, normalised) | Built (Phase 27) |
| `xPts_components_1gw.cs_pts` (already computed) | Built (Phase 28) |
| `start_prob`, `element_type` for per-position CS points | Built (v1.1, v1.0) |
| Pipeline/merge.py for adding cs_prob field | Existing file; extend |

---

## Feature Dependencies (v1.7)

```
existing: attacking_difficulty, xPts_components_1gw, start_prob, regression_signal,
          mins_risk, fixtures[], Verdict, suggestTransfers(), optimiseLineup()
          |
          ├──> Feature 6: Clean Sheet Probability
          │       cs_prob per fixture, cs_prob per team view
          │       |
          │       └──> Feature 5: Explainable xPts Breakdown (consumes cs_prob)
          │
          ├──> Feature 3: Fixture Swing Detector
          │       fixture_swing delta per team
          │       |
          │       └──> Feature 4: Lifecycle Labels (consumes fixture swing)
          │
          ├──> Feature 1: Transfer Opportunity Cost Simulator
          │       (wraps suggestTransfers(), adds Roll row, horizon comparison)
          │
          └──> Feature 2: Weekly Decision Summary
                  (aggregates Features 1, 3, 4, 5; captain from existing panel;
                   chip timing from existing chip-strategy-engine)
```

**Build order implication:** Feature 6 before Feature 5; Feature 3 before Feature 4;
Features 1 and 6 can be built in parallel. Feature 2 (Decision Summary) should be
last — it composes the others.

---

## Complexity Summary

| Feature | Pipeline Work | UI Work | Total Complexity |
|---------|---------------|---------|-----------------|
| 1. Transfer Opportunity Cost Simulator | None (reuses suggestTransfers) | Medium — new comparison view | Medium |
| 2. Weekly Decision Summary | None (aggregates existing) | Medium — new aggregator panel | Medium |
| 3. Fixture Swing Detector | Low — delta computation in merge.py or new file | Low — extend FixtureEaseRankingPanel | Low-Medium |
| 4. Player Lifecycle Labels | None — pure TS function over existing fields | Low — new badge variants | Low |
| 5. Explainable xPts Breakdown | Low — add appearance_pts component | Low-Medium — new breakdown display | Low-Medium |
| 6. Clean Sheet Probability | Low — add cs_prob field per fixture | Low-Medium — new CS% panel | Low-Medium |

---

## Table Stakes vs Differentiators Summary

### True Table Stakes (missing = product feels broken)

- Transfer comparison shows Roll / 1-FT / 2-FT options (Feature 1)
- Captain and transfer rec on the same screen as user's squad (Feature 2)
- Any fixture difficulty display for defensive/GK picks (Feature 6, basic)
- Buy/Hold/Sell at minimum for squad players (existing, retained)

### Differentiators (valued but not universally expected in free tools)

- 1/3/5 GW horizon on the transfer comparison (Feature 1)
- Quantified fixture swing delta (not just absolute difficulty) (Feature 3)
- Granular timing labels beyond Buy/Hold/Sell (Feature 4) — **no competitor does this algorithmically**
- Per-component xPts breakdown with visual proportion (Feature 5)
- CS% from the same xGA model as xPts (consistency differentiator) (Feature 6)
- All five weekly decisions on one screen personalised to actual squad (Feature 2) — **no free tool does this**

### Anti-Features (explicitly exclude from v1.7)

| Anti-Feature | Reason |
|--------------|--------|
| AI / LLM-generated prose summaries | Adds external dependency, hallucination risk, not in scope |
| Multi-week transfer sequence optimiser | Already exists in GW Planner (v1.3); don't duplicate |
| Automated chip activation | Dangerous irreversible action; recommendation only |
| Mini-league / head-to-head analysis | Out of scope per PROJECT.md |
| In-match live CS% updates | Daily refresh sufficient; in-match is out of scope |
| Injury probability model | Data not available; out of scope |
| Betting odds data feeds | External data source dependency; model inconsistency risk |
| Price rise prediction labels | Requires transfer volume modelling; out of scope |

---

## Sources

- [FPLReview Solver Settings](https://docs.fplreview.com/the-model/solvers/settings/) — transfer horizon framework, FT value parameter
- [FPL Copilot — Transfer Planning Guide](https://fplcopilot.com/blog/transfer-planning-guide) — Roll vs 1-FT vs hit framework, 5-GW horizon
- [FPL Copilot — xPts Explained](https://fplcopilot.com/blog/expected-points-explained) — xPts component breakdown reference
- [Fantasy Football Scout — When to Take Hits (elite manager interviews)](https://www.fantasyfootballscout.co.uk/2021/08/06/when-to-take-hits-and-the-importance-of-rolling-transfers-in-fpl/) — Roll value, hit economics
- [AllAboutFPL — Fixture Swing Analysis](https://allaboutfpl.com/2025/09/fpl-fixture-swing-analysis-best-fixture-runs-to-target/) — swing analysis methodology
- [Fantasy Football Fix — Fixture Swings & Wildcard Strategy](https://www.fantasyfootballfix.com/blog-index/fpl-fixture-swings-wildcard-strategy/) — buy/sell signal framing from swings
- [AllFantasyTips — Clean Sheet Odds](https://allfantasytips.com/premier-league-clean-sheet-odds/) — CS% as decimal, community expectation
- [Fantasy Football Pundit — CS Odds](https://www.fantasyfootballpundit.com/premier-league-clean-sheet-odds/) — CS% updated every GW standard
- [Marcus Leadboot — Modelling xPts in FPL (Medium)](https://medium.com/@marcusleadboot/modelling-xpts-in-fpl-gameweek-1-01fd2179eac6) — component model reference
- [Fantasy Football Hub — Buy Hold Sell GW35](https://www.fantasyfootballhub.co.uk/buy-hold-sell-fpl-blank-gameweek-35) — community timing label vocabulary
- [FPL Rotation Planner](https://www.fplrotationplanner.com/) — fixture swing tool claim (403 on fetch; feature list only)
