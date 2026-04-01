# Pitfalls Research

**Domain:** Multi-GW Gameweek Planner — adding multi-step transfer sequencing, chip timing, budget tracking, and squad state simulation to an existing single-GW FPL Analyst app (v1.3 milestone)
**Researched:** 2026-04-01
**Confidence:** HIGH (chip rules verified against official PL docs; transfer mechanics verified against fplreview docs and community sources; state mutation pitfalls derived from codebase inspection and first-principles analysis of existing `transfer-engine.ts` and `squad-adapter.ts`)

---

## Scope Note

This file supersedes the v1.1 PITFALLS.md (previous version at this path). It retains all prior pitfalls in condensed form in the appendix (pitfalls 14–27), and adds v1.3-specific pitfalls numbered 28 onwards. Pitfalls 14–27 remain valid and must not be regressed during v1.3 development.

---

## Critical Pitfalls

### Pitfall 28: Free Hit Squad Reversion Is a Separate State Branch — Not a Transfer in the Plan Sequence

**What goes wrong:**
The Free Hit chip causes FPL to revert your squad to its pre-Free-Hit state at the next deadline. A planner that models each GW as a sequential squad state mutation will treat a Free Hit GW as a normal transfer step: "GW N squad → make transfers → GW N+1 squad." This is wrong. After a Free Hit GW, the squad reverts to the exact squad that existed _before_ the Free Hit was played — not the Free Hit squad. If the planner does not branch state at the Free Hit activation point and restore the branched state at GW N+1, every subsequent GW in the plan will have the wrong squad, budget, and sell prices.

**Why it happens:**
The single-GW transfer engine in `transfer-engine.ts` represents transfers as squad mutations. The multi-GW extension follows the same pattern across all GWs. The Free Hit exception — "this GW's transfers are temporary" — requires a fundamentally different state model (snapshot + restore) rather than a mutation chain.

**How to avoid:**
- The planner's state model must distinguish between two transfer modes per GW:
  - **Permanent transfers:** squad after transfers becomes the base for the next GW (normal transfers, Wildcard)
  - **Temporary transfers (Free Hit):** a snapshot of the current squad is saved before planning the Free Hit GW; the snapshot is restored as the base for GW N+1, regardless of what was played in the Free Hit GW
- Represent this as: `PlanStep.chipMode = 'freehit' | 'wildcard' | 'normal'`; when `chipMode === 'freehit'`, the step's output squad is discarded — GW N+1 starts from `PlanStep[N-1].outputSquad`
- The squad snapshot must include both player IDs and sell prices, since sell prices would have changed during the Free Hit GW if any of those players rose in value while temporarily out of your squad
- Test: build a 3-GW plan with a Free Hit in GW 2 and verify that GW 3's squad equals GW 1's squad, not GW 2's

**Warning signs:**
- After a Free Hit in the plan, subsequent GW projections show players the manager does not actually own
- Budget calculations diverge from reality after any Free Hit GW
- The planner allows "planning" transfers of Free Hit players as if they are permanent squad members

**Phase to address:**
The core planner state engine phase (PLAN-01/02) — the state model must be correct before any scoring or UI is built on top of it.

---

### Pitfall 29: Wildcard Resets Transfer History But Banked Transfers Are Preserved — Not Zeroed

**What goes wrong:**
Pre-2024/25 FPL rules reset banked free transfers to 1 after playing a Wildcard. Many developers (and community resources) document this old behaviour. In 2025/26, the rule changed: when playing a Wildcard or Free Hit chip, the manager keeps all banked transfers. A planner that resets `freeTransfers = 1` after a Wildcard gameweek will undercount available transfers in subsequent GWs, causing the plan to score hit costs for transfers that should be free.

**Why it happens:**
The old rule is well-documented online and persists in older tutorials, Stack Overflow answers, and community spreadsheets. The change was introduced in 2024/25 and carries into 2025/26 but has not propagated to all documentation.

**How to avoid:**
- After a Wildcard GW in the plan: `freeTransfers` for the following GW = current banked transfers (carry forward unchanged) + 1 standard weekly accumulation, up to the 5-transfer cap
- After a Free Hit GW: same rule — banked transfers are preserved
- The Wildcard itself does not consume a free transfer slot; it replaces any hits that were taken in that GW with zero cost
- Document this rule in the planner state model with an explicit source reference
- Verify against the official FPL rules page before each new season starts — this rule changed once and could change again

**Warning signs:**
- After a Wildcard in GW N, the plan shows only 1 free transfer in GW N+1 even when the manager had 3 banked going into the Wildcard GW
- Free transfer counter in the plan UI does not match the manager's actual FPL account after a chip is played

**Phase to address:**
Transfer state accumulation logic — first phase that models multi-GW free transfer rolling (PLAN-01). Encode the correct rule from the start; do not copy the old "reset to 1" behaviour from community code.

---

### Pitfall 30: Budget Across GWs Uses `now_cost` as Sell Price — Missing Sell Price Decay

**What goes wrong:**
The existing `transfer-engine.ts` uses `bankBalance + sellPlayer.now_cost` to calculate available budget for a transfer. This is an approximation: the actual sell price is `selling_price` from the `my-team` endpoint, which can be less than `now_cost` if the player has risen in price since purchase (FPL's profit-split rule: only £0.1m profit per £0.2m price rise). In a multi-GW planner, every simulated transfer compounds this error: if GW 2 plans to sell a player bought in GW 1, the sell price calculation for that GW 2 transfer is unknowable because future price changes are not predictable. Using `now_cost` as sell price for future GWs is an approximation that the planner must acknowledge and communicate — not silently treat as accurate.

**Why it happens:**
The single-GW transfer engine already makes this approximation (intentionally, as the `my-team` auth may not be active). The multi-GW planner inherits the approximation without realising it accumulates across every step: a 5-GW plan with 4 transfer steps each over-estimates sell prices by up to £0.1m per step, potentially misrepresenting a plan as affordable when it requires £0.5m more than available.

**How to avoid:**
- For the current GW (GW N): use exact `selling_price` from `my-team` auth when available; fall back to `now_cost` with a warning when not authenticated
- For future GWs (GW N+1 and beyond): use `now_cost` as the sell price for any player currently in squad; treat players bought in a prior plan step at their `now_cost` at time of "purchase" (since the planner cannot predict price changes)
- Display budget estimates for future GWs as approximate: "~£X.Xm available (estimate — future sell prices may vary)"
- Do not block a plan from displaying because exact sell prices are unavailable; show the approximation with a clear label
- Avoid cumulative sell-price inflation: a player should never be valued above `now_cost` as a sell candidate in future GWs within the plan

**Warning signs:**
- A 4-GW plan shows a GW 4 transfer as affordable when the manager's actual budget in GW 4 would be insufficient
- Budget available at GW 3 is substantially higher than what the manager actually has after executing GWs 1 and 2
- No visual indicator distinguishing "exact budget" (GW 1, authenticated) from "estimated budget" (GW 2+)

**Phase to address:**
Budget tracking phase (PLAN-07) — the budget model must distinguish current-GW exact values from forward-GW estimates from the start.

---

### Pitfall 31: Squad Snapshot Mutation — Shared Object References Corrupt State Across Plan Steps

**What goes wrong:**
The multi-GW planner simulates squad state across N gameweeks by applying transfers to a squad object at each step. If the squad representation at each step is a reference to the same array/object rather than a deep copy, mutations at step N will corrupt the squad at step N-1. This manifests as the planner appearing to work on the first run but returning wrong squad states when the user edits step 2 of an existing plan: the edit mutates the shared reference, corrupting all downstream steps simultaneously.

**Why it happens:**
JavaScript's reference semantics mean that `const nextSquad = currentSquad` shares the same array. The single-GW engine does not have this problem because it does not need to preserve historical state. The multi-GW engine holds state for N steps simultaneously, making reference bugs immediately destructive.

**How to avoid:**
- Every plan step that produces an "output squad" must produce a structurally independent copy: `[...squad]` for arrays of primitives, or `squad.map(p => ({ ...p }))` for arrays of objects
- Use immutable update patterns (spread operators, `structuredClone`) consistently throughout the planner state model
- Represent plan state as a list of immutable snapshots: `PlanState = PlanStep[]` where each `PlanStep.squadAfter` is a frozen or deeply cloned array
- Write unit tests that verify: editing step 2 of a 5-step plan does not change the `squadAfter` of step 1

**Warning signs:**
- Changing the "in" player for GW 3 transfer in the UI also changes the displayed squad in GW 2 "after transfer" view
- Re-running the auto-suggest after a manual edit produces different results for earlier GWs
- The squad snapshot shows the same player twice after an edit — shared reference being mutated in two places

**Phase to address:**
Planner state model (PLAN-01/02) — immutable squad snapshots must be designed in from the start, not added as a fix after mutation bugs appear in testing.

---

### Pitfall 32: DGW/BGW Detection Is Not Guaranteed in Advance — The Planner Must Degrade Gracefully

**What goes wrong:**
The FPL API fixtures endpoint (`/api/fixtures/?event=N`) only populates future fixtures once the Premier League has officially scheduled them. Blank and Double Gameweeks are typically confirmed only 3–7 days before their deadline, often after FA Cup ties are resolved. A 5-GW planner running on a Wednesday before a weekend deadline will have confirmed fixtures for GW N and GW N+1 but potentially no fixtures at all for GW N+3 and GW N+4. A planner that uses fixture data to score transfers will silently score GW N+3 as if it is a BGW (zero fixtures) for all teams — dramatically underweighting the entire forward horizon.

**Why it happens:**
The existing `MergedPlayer.fixtures` array already contains per-player fixture data from the pipeline. The planner naturally uses this data without checking whether it is complete. When fixtures are unconfirmed, the array for a future GW has fewer entries than expected, and the engine treats absent fixtures as BGW zeroes.

**How to avoid:**
- Before scoring any GW in a multi-GW plan, check the fixture count for that GW: how many clubs have at least one confirmed fixture? If fewer than 18 teams have fixtures, treat that GW's fixture data as incomplete
- When fixture data is incomplete for a GW in the plan horizon: score that GW using an average fixture difficulty (0.5) and flag it in the UI as "Fixture data not yet confirmed — scoring is estimated"
- Never display DGW/BGW labels for future GWs unless the fixture count confirms them: 20 clubs with 2 fixtures each = DGW confirmed; 18 clubs with 1 fixture = normal; fewer = incomplete
- The Python pipeline already computes per-player `fixtures` — extend it to also emit a per-GW fixture completeness flag: `{ event_id: 33, confirmed: false, team_count: 12 }`

**Warning signs:**
- A 5-GW plan scores GW N+4 players as if they have zero fixtures (BGW) when in reality fixtures for that GW simply have not been announced yet
- DGW/BGW labels appear on GWs beyond GW N+2 even before the Premier League has announced them
- Transfer suggestions for GW N+3 deprioritise all players despite no confirmed BGW announcement

**Phase to address:**
Fixture data layer and scoring phase (PLAN-05/06) — fixture completeness checking must be built before any DGW/BGW scoring logic is added.

---

### Pitfall 33: Hit Cost Scoring Uses Wrong Baseline — `freeTransfers` Must Decrease Before Scoring Subsequent Steps

**What goes wrong:**
The multi-GW planner scores each step's hit cost as: `hits = max(0, transfersInThisGW - freeTransfers)` and applies -4 pts per hit. But after a GW with transfers, the free transfer count for the next GW must be computed correctly. The 2025/26 rules are: start with 1 free transfer per GW; each unused free transfer rolls to the next GW up to a maximum of 5; using more than your free transfers costs 4 pts per extra. If the planner does not correctly update `freeTransfers` after each plan step, hit cost scoring for GW N+2 will be wrong, making some plans appear cheaper than they are.

**The accumulation rule (verified for 2025/26):**
- After a GW where you used K transfers and had F free transfers:
  - If K <= F: `nextFreeTransfers = min(5, F - K + 1)` (1 free per week, carry over unused)
  - If K > F: `nextFreeTransfers = 1` (hit taken, back to normal)
- Wildcard/Free Hit GWs: banked transfers are preserved (not reset to 1) — see Pitfall 29

**Why it happens:**
Single-GW transfer engine does not need to track accumulated free transfers — it receives `freeTransfers` as a parameter. The multi-GW extension adds a loop across GWs but forgets to thread the free transfer count as a stateful input-output across steps.

**How to avoid:**
- Model free transfer state explicitly as a plan-level variable that flows through each step:
  ```
  for each planStep in [gw1, gw2, ..., gwN]:
    hits = max(0, planStep.transferCount - currentFreeTransfers)
    planStep.hitCost = hits * 4
    currentFreeTransfers = computeNextFreeTransfers(currentFreeTransfers, planStep.transferCount, planStep.chip)
  ```
- Write a pure function `computeNextFreeTransfers(current, used, chip)` and unit-test it against all edge cases: 0 used, 1 used, 2 used, Wildcard, Free Hit, cap at 5
- Display the free transfer count at the start of each GW in the plan output so the user can verify it matches their actual FPL account

**Warning signs:**
- A plan that uses 2 transfers in GW N (1 free, 1 hit) shows 2 free transfers in GW N+1 instead of 1
- A plan that rolls a transfer for 4 consecutive GWs shows 5 free transfers in GW N+4 but allows more than 5 free in GW N+5
- Hit cost is zero for all GWs even when the plan has 3 transfers in a GW where only 1 is free

**Phase to address:**
Hit cost scoring (PLAN-07) — the free transfer state model must be correct before scoring any multi-step plan.

---

### Pitfall 34: Auto-Suggest Greedy Optimisation per GW Produces Locally Optimal but Globally Suboptimal Plans

**What goes wrong:**
The simplest auto-suggest implementation picks the best transfer for GW N (highest gem delta, within budget, DGW-aware), then picks the best transfer for GW N+1 given the resulting squad, and so on. This greedy approach produces a locally optimal plan at each step but consistently misses globally superior plans that require a "worse" transfer in GW N to unlock a much better position in GW N+2. A concrete example: transferring out a mediocre midfielder in GW N costs a -4pt hit but brings in a midfielder who doubles in GW N+1 and GW N+2 — the greedy planner will avoid the hit in GW N, never making the sequence that yields +12 pts over 3 GWs.

**Why it happens:**
The existing `computeTransferSuggestions` function is a greedy ranker — it finds the single best transfer right now. Extending it naively to N GWs by calling it N times in sequence inherits the greedy failure mode.

**How to avoid:**
- For a personal tool (single user, no server load concern), a depth-2 or depth-3 look-ahead is achievable: evaluate all single-transfer options for GW N, for each option evaluate the best transfer for GW N+1, pick the (GW N, GW N+1) pair that maximises combined projected delta minus hit costs
- The horizon beyond 2–3 GWs becomes speculative due to fixture uncertainty (see Pitfall 32) — do not optimise beyond 3 GWs even if the user selects a 5-GW horizon; GWs 4–5 can use greedy fallback
- Limit the search space: for each GW, evaluate only the top 10 sell candidates × top 5 buy candidates per position = at most 50 evaluations per GW; a 3-GW look-ahead is 50^3 = 125,000 combinations — tractable in TypeScript without a solver
- Document the limitation: "Plan is optimised for the first 3 GWs; remaining GWs use best single-GW suggestion. For fully optimal multi-week plans, an integer programming solver (fplreview-style) would be required."

**Warning signs:**
- The planner always recommends 0 hits (never suggests a hit is worthwhile) even for DGW targets
- A manual edit (user takes a hit to bring in a DGW player) produces a dramatically higher plan score than the auto-suggest — the auto-suggest is too conservative
- Auto-suggest for a 3-GW plan is identical to three consecutive single-GW suggestions

**Phase to address:**
Auto-suggest engine (PLAN-02) — design the look-ahead depth before implementation; do not build greedy single-GW and attempt to retrofit look-ahead later.

---

### Pitfall 35: Chip Constraint — Only One Chip Per GW Is Enforceable, and Certain Chips Have Consecutive-GW Restrictions

**What goes wrong:**
The 2025/26 chip rules include: (a) only one chip can be active in a GW — you cannot use Bench Boost and Triple Captain in the same GW; (b) the Free Hit chip cannot be played in consecutive GWs (if played in GW 19, the second Free Hit cannot be activated until GW 21). A planner that treats chips as independent flags per GW without enforcing these mutual exclusions will allow illegal plan configurations that cannot be executed in FPL.

**Additional chip constraint (2025/26 specific):**
- There are two sets of chips: first half (must be used before GW 19 deadline) and second half (available from GW 20)
- Chips from the first half cannot be carried into the second half — they expire at GW 19
- The system must know which chips the manager has already played to prevent replanning with used chips

**Why it happens:**
The existing `ChipState` type in `transfer-engine.ts` is a single value for the current GW. A multi-GW planner allows chip assignment per step independently, and validation across steps (no two consecutive Free Hits, no two chips in same GW) must be explicitly enforced — it does not follow from the existing data model.

**How to avoid:**
- The planner must validate chip assignments on every plan mutation:
  1. At most one chip active per GW (Wildcard OR Free Hit OR Bench Boost OR Triple Captain — not OR OR)
  2. Free Hit cannot appear in consecutive GWs in the plan
  3. Each chip can only be used once per half-season — if the manager has already used their first-half Wildcard, a Wildcard cannot appear in a plan for GWs 1–19
- Read the manager's chip usage history from the FPL API before building a plan: `entry/{id}/history/` returns `chips` with `name` and `event` per chip played
- Surface available chips in the plan UI: "You have: 1× Wildcard (H2), 1× Free Hit (H2), 1× Bench Boost (H2), 1× Triple Captain (H2)"
- Disable already-played chips in the chip selector

**Warning signs:**
- The UI allows assigning both Bench Boost and Triple Captain to the same GW
- A Free Hit is shown as available for GW 25 when the user already played their second-half Free Hit in GW 22
- The plan assigns a first-half Wildcard to a GW 25 slot

**Phase to address:**
Chip timing layer (PLAN-08) — chip validation must be enforced before the chip UI is built, not as a post-release bugfix.

---

### Pitfall 36: Bench Boost and Triple Captain Scoring Requires Squad Formation Awareness

**What goes wrong:**
Bench Boost adds all 4 bench players' points to the GW total. Triple Captain triples the captain's points. Both chips interact with the squad in ways the base transfer planner does not model:

- **Bench Boost:** The bench players in the snapshot for that GW must be identified. The planner currently considers only the starting XI for gem delta scoring. A Bench Boost GW should optimise for all 15 players, not just 11. A plan that suggests a Bench Boost in a GW where the bench contains a £4.0m goalkeeper and three rotation risks will produce a much lower actual score boost than projected.
- **Triple Captain:** The captain in the snapshot for that GW must be specified in the plan output. If the planner does not track captain designation per GW, the Triple Captain chip has no target to apply to.

**Why it happens:**
The transfer engine models squad as position-locked 15 players but does not track formation (who is in the XI vs bench) or captain designation. The multi-GW planner inherits this limitation.

**How to avoid:**
- For Bench Boost GWs: display all 15 players' projected points in the squad snapshot, not just the XI
- The plan's score for a Bench Boost GW = sum of all 15 players' projected points (not just XI); flag if bench projected points are low
- For Triple Captain GWs: allow the user to specify the captain in the plan UI; default the captain suggestion to the top captaincy candidate (from `captaincy-engine.ts`) for that GW's squad snapshot
- Do not auto-optimise the entire 15-player squad for Bench Boost — the v1.3 scope is transfer sequencing; Bench Boost suggestion can be flagged as "recommended for GW X given your projected bench strength" without full optimisation

**Warning signs:**
- Bench Boost chip is flagged as "recommended" based only on the XI's projected points — bench strength is not checked
- No captain designation shown in the plan output for any GW, making Triple Captain scheduling meaningless
- Bench players' projected points are all zero or null in the plan snapshot

**Phase to address:**
Squad snapshot output (PLAN-10) — squad snapshots must include bench players and captain marker from the first implementation.

---

## Moderate Pitfalls

### Pitfall 37: Transfer Sequence Includes Ineligible Players — Position Lock and Squad Composition Rules Must Be Re-Enforced Per Step

**What goes wrong:**
FPL squad rules: maximum 3 players from the same Premier League team; exactly 2 GK, 5 DEF, 5 MID, 3 FWD in the 15-man squad. After applying simulated transfers at each plan step, the planner must verify the resulting squad still satisfies all composition rules. The existing `computeTransferSuggestions` enforces position lock (same position for sell/buy) but does not check the 3-per-club rule. A plan that buys two premium players from the same club in consecutive steps could produce an illegal 4-player club concentration.

**How to avoid:**
- After each plan step's simulated squad mutation, validate: (a) position type counts still satisfy 2-5-5-3; (b) no club has more than 3 players; (c) total squad count is exactly 15
- The position-lock per individual transfer already prevents the 2-5-5-3 rule from being violated if only one transfer is made per step. The 3-per-club rule requires a separate check
- Display the club count in the plan output: "Man City: 3" should be highlighted if a plan step would create a 4th Man City player

**Phase to address:**
Planner state validation (PLAN-02) — squad composition validation as part of the plan step mutation function, not in the UI layer.

---

### Pitfall 38: Projected Points for Horizon Scoring Are Static — But the Plan Spans Multiple Future GWs Where Form and Injuries Change

**What goes wrong:**
The planner scores transfer sequences using the same `proj_pts_Ngw` values for every GW in the horizon. These projections are computed at pipeline run time (once daily) and reflect the current moment. For GW N+3, a player's projected points include estimated form, fitness, and fixture difficulty — all of which will have changed by the time that GW is actually played. The planner will present its GW N+3 scoring as if it is equally reliable as GW N+1 scoring, when it is far more speculative.

**How to avoid:**
- Apply a time-decay factor to projected points for GWs further in the horizon: `scoredPts(gw) = projPts * decay^(gw - currentGW)` where `decay` is a value like 0.85–0.92
- This matches the approach used by fplreview solvers (time decay is a documented setting there)
- Display projected plan value as a range for each GW: "GW N+1: 6.2 pts (high confidence), GW N+3: 5.1 pts (estimated, low confidence)"
- Do not present the total 5-GW plan score as a precise number — show it as an estimate with a confidence caveat

**Phase to address:**
Plan scoring (PLAN-04) — time decay factor must be part of the initial scoring formula, not a post-launch addition.

---

### Pitfall 39: The "Save Transfer" Option Disappears in a Multi-GW Plan

**What goes wrong:**
The existing transfer engine has a `SAVE` result type: "No transfer improves your squad; save the free transfer." In a multi-GW plan, "save" is a valid and often optimal strategy for a given GW — rolling a free transfer to enable a 2-for-1 in the next GW. The multi-GW planner may not surface this as an explicit plan option, forcing the user to either make a transfer they do not want or leave the GW with no suggestion. The auto-suggest may also fail to include "roll transfer" as a candidate when scoring plan sequences.

**How to avoid:**
- Represent "roll transfer" as a first-class plan step option alongside "make 1 transfer" and "make 2 transfers"
- Auto-suggest must evaluate the "roll transfer" option at each GW as a candidate: what is the total plan score if GW N has 0 transfers and GW N+1 has 2 free transfers?
- Display "Roll transfer (bank for next GW)" explicitly in the plan output when the auto-suggest recommends no transfer for a GW
- Show the projected free transfer count at the start of each GW so the user understands what rolling accomplishes

**Phase to address:**
Auto-suggest engine (PLAN-02) and plan output table (PLAN-09) — the "roll" option must be a first-class concept in both.

---

### Pitfall 40: Sell Prices in Multi-GW Plans Ignore FPL's Profit-Split Rule for Players Bought Within the Plan

**What goes wrong:**
When the plan simulates buying a player in GW N and selling them in GW N+2, the sell price for that simulated resale should use FPL's profit-split rule: for every £0.2m price rise, the manager only gets £0.1m profit. If the planner assumes full sell price = buy price (or worse, uses the current `now_cost` for a player not yet owned), budget calculations for the resale GW will be wrong. This is particularly relevant for short-horizon price-rise chasing strategies.

**Why it happens:**
The `selling_price` field only exists for currently-owned players (from `my-team`). For hypothetical players bought within a plan, the sell price is unknowable. The temptation is to use `now_cost` — but this assumes zero profit, which will underestimate budget if the player rises in price (conservative) or use inflated buy prices for resales within the plan (not applicable here since the player is bought at `now_cost` at plan time).

**How to avoid:**
- For players bought within a plan step and then sold in a subsequent plan step: assume sell price = buy price (conservative and correct for the no-price-change case)
- Do not attempt to predict future price changes for budget calculations
- Flag any plan that involves buying and then selling the same player within the plan horizon as potentially inaccurate: "Budget at GW N+2 assumes no price change for [player] between GW N and GW N+2"

**Phase to address:**
Budget tracking across plan steps (PLAN-07) — the sell price model for intra-plan transfers must be defined before budget calculation is implemented.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `computeTransferSuggestions` as-is for each plan step | Minimal new code | Greedy per-GW optimisation; no look-ahead; misses hit-worthwhile sequences | Only for MVP proof of concept — never for final scoring |
| Use `now_cost` as sell price for all plan steps | Avoids auth dependency | Budget estimates diverge from reality for long-horizon plans; user takes hit expecting affordability | Acceptable with clear "estimated" UI label |
| Model Free Hit as a normal transfer sequence step | Avoids state branching | Free Hit squad reversion corrupts all subsequent GW state — silent and catastrophic | Never |
| Reset banked free transfers to 1 after Wildcard/Free Hit | Implements old FPL rule | Wrong in 2025/26 — underestimates free transfers in subsequent GWs; user sees phantom hits | Never — verify current rules before coding |
| Greedy single-GW suggestion per plan horizon step | Quick to build | Globally suboptimal plans; never suggests a justified hit; user manual-edits all good plans | Acceptable for MVP if documented; replace with look-ahead before final release |
| Share squad array reference across plan steps | Simpler state model | Reference mutation corrupts earlier GW snapshots on any plan edit | Never — always deep-copy squad snapshots |
| Compute bench boost score from XI projected pts only | Less code | Bench Boost scoring wildly inaccurate; chip recommendation is misleading | Never if chip recommendations are shown |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `computeTransferSuggestions` → multi-GW planner | Calling it N times in a loop with the output squad of each step as input | Wrap in a new `computeMultiGWPlan` function that threads free-transfer state, chip state, and budget state across steps |
| `my-team` auth → planner budget | Using `now_cost` for sell prices when auth is available | When auth is active, use `selling_price` for current-GW budget; use `now_cost` approximation only for future GW budget estimates |
| `captaincy-engine.ts` → plan chip suggestions | Captaincy engine runs on current squad only | For Triple Captain GW in a plan, run captaincy engine on the plan's simulated squad snapshot for that GW |
| `MergedPlayer.fixtures` → DGW/BGW detection in plan | Treating empty `fixtures` array as BGW for future GWs | Check fixture count completeness per GW before labelling as BGW; empty = unconfirmed, not blank |
| Free Hit squad reversion → plan step N+1 | Using Free Hit step's output squad as GW N+1 base | Save pre-Free-Hit squad snapshot; restore it as the base for GW N+1 |
| Free transfer accumulation across plan steps | Not threading `freeTransfers` state across steps | Implement `computeNextFreeTransfers(current, used, chip)` as a pure function and test it |
| Chip availability state → plan UI | Not reading manager's chip usage history before plan | Fetch chip history from `entry/{id}/history/chips` before rendering plan chip selector |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Exhaustive look-ahead across all 700+ players for all N GWs | Plan generation takes 30+ seconds | Pre-filter buy candidates to top 10 per position per GW before look-ahead; do not evaluate the entire player pool at each step | With 700 players × 4 positions × 3 GW look-ahead immediately |
| Re-running plan auto-suggest on every user keystroke in manual edit mode | UI freezes when user edits transfer in plan table | Debounce plan recalculation; only recalculate affected GW steps and downstream steps when a single step is edited | With 5-GW plan and 700-player pool on first try |
| Fetching fixture data per GW per player from FPL API in the planner | Multiple API calls per plan render | All fixture data already in `MergedPlayer.fixtures` from pipeline; use that, do not make fresh API calls during planning |  Immediately — API rate limits apply |
| Deep cloning entire 700-player `ScoredPlayer[]` array for each plan step | Memory pressure, slow plan generation | Plan steps only need the 15-player squad snapshot, not a full player pool copy per step | With 5-GW plan × 700 players per step |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Displaying plan total score as a precise number (e.g. "Plan value: +18.4 pts") | User treats the projection as a guarantee; disappointed when actual return differs | Show as range with confidence indicator: "+14–22 pts estimated over 5 GWs" |
| No visual separation between current GW (exact data) and future GWs (estimated) | User cannot tell which parts of the plan are reliable | GW N: exact buy/sell prices, bank balance; GW N+1+: "estimated" badge on all budget figures |
| Plan resets entirely when user makes one manual edit | User afraid to experiment with the plan | Editing one step recalculates only that step and downstream steps; earlier steps are preserved |
| Chip selector shows all chips including already-played ones | User tries to use an expired chip; plan is unexecutable | Grey out and label already-used chips: "Wildcard (H1) — already used GW 14" |
| Free transfer count at start of each plan GW is hidden | User cannot verify plan against their actual FPL account | Show "X free transfers" at the top of each GW column in the plan table |
| Plan table is too wide to read on mobile (GW columns × player rows) | User cannot use the planner on mobile | Collapsible GW columns; default to showing only next 2 GWs on mobile with expand option |

---

## "Looks Done But Isn't" Checklist

- [ ] **Free Hit reversion:** Build a 3-GW plan with a Free Hit in GW 2 — verify the GW 3 squad equals the GW 1 squad, not the GW 2 squad
- [ ] **Wildcard banked transfer preservation:** Play a Wildcard in a plan where manager had 3 banked transfers — verify GW N+1 shows 3 (not 1) free transfers
- [ ] **Hit cost accuracy:** A plan with 1 free transfer making 2 transfers in GW N shows -4 pts cost; making 3 shows -8 pts
- [ ] **Budget at GW N+1:** After a simulated transfer (sell + buy) in GW N, the budget at GW N+1 equals `bank + sell_proceeds - buy_cost` — not the original bank
- [ ] **DGW scoring:** A player with 2 confirmed fixtures in a GW shows approximately 2× projected points for that GW compared to a single-fixture GW projection
- [ ] **BGW graceful degradation:** When fixture data is unavailable for GW N+3 (not yet announced), the plan labels it "fixtures unconfirmed" rather than scoring it as a BGW
- [ ] **Chip mutual exclusion:** The UI prevents assigning Bench Boost AND Triple Captain to the same GW
- [ ] **Squad mutation isolation:** Editing the GW 3 transfer in a 5-GW plan does not change the displayed squad for GW 2
- [ ] **Squad composition validation:** After each simulated transfer step, no club has 4+ players and the 2-5-5-3 formation rule is maintained
- [ ] **Free transfer threading:** A 5-GW plan that rolls in GW N and GW N+1 shows 3 free transfers at GW N+2 (not 1)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Free Hit reversion not implemented — users ran plans with corrupted post-FH state | HIGH | Redesign plan step state model with snapshot/restore; all plans built with the buggy version must be discarded as their GW N+1+ state was wrong |
| Wildcard resets banked transfers to 1 (old rule applied) | LOW | Fix `computeNextFreeTransfers`; no state migration needed (plan state is ephemeral, not persisted) |
| Budget over-estimated across plan (now_cost instead of selling_price) | LOW | Add "estimated" label to future GW budget figures; fix current-GW budget when auth is active; no rewrite needed |
| Squad reference mutation corrupting plan state on edit | MEDIUM | Audit all squad state assignments for reference sharing; add deep-copy wrapper; write tests verifying step isolation; no data migration (plan state is ephemeral) |
| Greedy optimiser never recommends justified hits | LOW | Add look-ahead depth-2 or depth-3 evaluation; the greedy result is a subset of the look-ahead result so no breaking change |
| Chip constraint violations in generated plans | LOW | Add chip validation on plan mutation; existing plans with violations should be flagged and the user prompted to fix them |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Free Hit squad reversion (28) | Planner state engine (PLAN-01/02) | 3-GW plan with FH in GW 2: GW 3 squad = GW 1 squad |
| Wildcard banked transfer preservation (29) | Free transfer state model (PLAN-01) | Wildcard with 3 banked: next GW shows 3 free transfers |
| Budget approximation across GWs (30) | Budget tracking (PLAN-07) | Future GW budget figures show "estimated" label; current GW uses exact sell price when auth active |
| Squad snapshot mutation (31) | Planner state model (PLAN-01/02) | Edit GW 3 transfer: GW 2 squad snapshot unchanged |
| DGW/BGW detection in advance (32) | Fixture data layer (PLAN-05/06) | GW with unannounced fixtures shows "unconfirmed" label, not BGW scoring |
| Hit cost free transfer threading (33) | Hit cost scoring (PLAN-07) | 5-step plan with rolled transfers: free transfer count correct at each step |
| Greedy optimisation suboptimality (34) | Auto-suggest engine (PLAN-02) | A hit to bring in a DGW target appears in auto-suggest when net gain > 8 pts |
| Chip constraint enforcement (35) | Chip timing layer (PLAN-08) | Two chips cannot be assigned to same GW; consecutive Free Hits blocked |
| Bench Boost / Triple Captain scoring (36) | Squad snapshot output (PLAN-10) | Bench Boost GW: score = all 15 players' pts; Triple Captain GW: captain shown in plan table |
| Position lock and club concentration (37) | Plan step validation (PLAN-02) | No simulated squad has 4+ players from same club or violates 2-5-5-3 |
| Time-decayed horizon scoring (38) | Plan scoring (PLAN-04) | GW N+4 projected score is visually less confident than GW N+1 projected score |
| Roll-transfer as first-class option (39) | Auto-suggest and plan output (PLAN-02/09) | "Roll transfer" appears as an explicit GW option in plan table |
| Intra-plan sell price assumption (40) | Budget tracking (PLAN-07) | Sell price for player bought in plan step uses buy price, not inflated future now_cost |

---

## Appendix: v1.1 Pitfalls (condensed)

All prior pitfalls remain valid. Must not be regressed during v1.3 development.

| # | Pitfall | Status | v1.3 Regression Risk |
|---|---------|--------|----------------------|
| 14 | Linear xMins multiplication in projected points | Resolved in v1.1 pipeline | Low — do not reintroduce in planner projected pts calculations |
| 15 | Injury/rotation conflation in minutes risk | Resolved in v1.1 pipeline | Low — planner uses existing `mins_risk` field |
| 16 | `form_pts_per90` double-counted in projections | Resolved in v1.1 pipeline | Low — planner consumes `proj_pts_Ngw`, not raw form |
| 17 | Analytics in TypeScript rather than Python pipeline | Resolved in v1.1 | Active — planner scoring logic must stay in TypeScript engine, not hooks |
| 18 | Recommendation and transfer engine conflicts | Resolved in v1.1 | Low for planner (separate UI tab) |
| 19 | Session expiry silent failure | Resolved in v1.1 auth | Active — planner budget accuracy depends on auth; expired session must surface |
| 20 | Auth in pipeline | Resolved (pipeline has no auth) | Low |
| 21 | Captaincy safe vs upside not separated | Resolved in v1.1 | Active — planner needs captaincy engine for Triple Captain chip suggestion |
| 22 | Explainability shows scores not reasons | Resolved in v1.1 | Low for planner (separate feature) |
| 23 | Projected points normalised to 0–1 | Resolved in v1.1 | Active — planner scoring uses absolute proj_pts values; do not re-normalise |
| 24 | `selling_price` without `bank` from my-team | Resolved in v1.1 auth | Active — planner budget for current GW must use selling_price + bank from my-team |
| 25 | DGW double fixture projection | Resolved in v1.1 pipeline | Active — planner must preserve DGW fixture counting when building plan step scores |
| 26 | Arbitrary Buy/Hold/Sell thresholds | Resolved in v1.1 | Low for planner |
| 27 | Ownership as "safe" captain proxy | Resolved in v1.1 | Low for planner |

### v1.0 Pitfalls

| Pitfall | v1.3 Regression Risk |
|---------|----------------------|
| CORS — all FPL calls via server proxy | Low — proxy exists; planner fetches via same proxy |
| Sell price ≠ buy price | Active — planner budget must use selling_price, not now_cost, for current GW |
| DGW/BGW form inflation | Active — planner DGW scoring must not double-count form |
| FPL API field changes (Zod adapter) | Low — adapter exists |
| Free Hit / Wildcard chip detection | Active — planner has more complex chip logic than single-GW guard |
| Position codes — integer not string | Low |

---

## Sources

- [FPL Official: How and when to use your chips 2025/26](https://www.premierleague.com/en/news/4362085/how-and-when-to-use-your-chips-in-202526-fantasy) — chip rules verified: 2 sets per season, banked transfers preserved after WC/FH, Free Hit squad reversion (HIGH confidence — official PL source)
- [FPL Official: What's new in 2025/26 — Two sets of chips](https://www.premierleague.com/en/news/4362027/whats-new-in-202526-fantasy-two-sets-of-chips) — two full chip sets per season, first half expires at GW 19 (HIGH confidence — official)
- [FPL Official: FPL managers now have FIVE free transfers](https://www.premierleague.com/en/news/4461660/fpl-managers-to-have-five-free-transfers-on-saturday-all-you-need-to-know) — max 5 free transfer banking (HIGH confidence — official)
- [Fantasy Football Scout: Do I keep my free transfers when I use an FPL Wildcard?](https://www.fantasyfootballscout.co.uk/2024/10/03/do-i-keep-my-free-transfers-when-i-use-an-fpl-wildcard) — banked transfers preserved after WC confirmed (HIGH confidence — specialist press, verified against official)
- [Fantasy Football Scout: Do I keep my saved transfers when using the Free Hit chip?](https://www.fantasyfootballscout.co.uk/2025/03/13/do-i-keep-my-saved-transfers-when-using-the-free-hit-chip) — banked transfers preserved after FH confirmed (HIGH confidence — specialist press)
- [fplreview Solver Settings](https://docs.fplreview.com/the-model/solvers/settings/) — time decay, FT value, transfer depth, solver pitfalls (MEDIUM confidence — third-party authoritative tool documentation)
- [FPL Blank and Double Gameweeks 2025/26](https://www.fantasyfootballhub.co.uk/fpl-blank-double-gameweek-guide) — BGW/DGW fixture confirmation timing, squad planning implications (MEDIUM confidence — specialist press)
- [FPL API Endpoints Guide — Frenzel Timothy, Medium](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — fixtures?event=N endpoint structure, future fixture availability (MEDIUM confidence — community documentation)
- [Codebase inspection: `src/lib/transfer-engine.ts`] — existing `ChipState`, `SingleTransfer`, `computeTransferSuggestions` — confirms single-GW greedy model, bankBalance + now_cost approximation (HIGH confidence — source code)
- [Codebase inspection: `src/lib/squad-adapter.ts`] — `MyTeamPickSchema` with `selling_price`, `EntryHistorySchema` with `bank` — confirms auth data sources (HIGH confidence — source code)
- [Codebase inspection: `src/lib/types.ts`] — `MergedPlayer.fixtures: FixtureEntry[]`, `proj_pts_1gw/3gw/5gw` — confirms pipeline data available for planner (HIGH confidence — source code)
- [FPL free hit chip mechanics — BetterFPL](https://www.betterfpl.com/guides/what-is-free-hit-in-fantasy-premier-league) — squad reversion detail including sell price behaviour during FH week (MEDIUM confidence — community guide, consistent with official rules)

---

*Pitfalls research for: FPL Analyst v1.3 Gameweek Planner — multi-GW transfer sequencing*
*Researched: 2026-04-01*
