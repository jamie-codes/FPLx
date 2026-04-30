# Domain Pitfalls: Squad Optimiser (v1.6)

**Domain:** Adding squad optimisation to an existing FPL personal analyst tool
**Researched:** 2026-04-30
**Project context:** Next.js 16 + React 19 + TypeScript, existing xPts engine (Poisson/Bernoulli), greedy + look-ahead transfer planner, FPL squad fetching via Team ID

---

## Section 1 — FPL Rule Edge Cases

### Pitfall 1: Formation constraints are six rules, not one

**What goes wrong:** Treating "formation" as a single selector (4-3-3, 3-5-2, etc.) and storing it as a string. The optimiser then picks the best 11 from a flat list, ignoring the combinatorial constraint that valid FPL lineups must simultaneously satisfy six hard bounds.

**The actual rules (HIGH confidence — official FPL):**
- Exactly 1 GK in the starting 11
- At least 3 DEF starters (max 5)
- At least 2 MID starters (max 5)
- At least 1 FWD starter (max 3)
- Exactly 10 outfield starters (11 total minus GK)
- The resulting formation must be consistent (3+5+2=10, 3+4+3=10, etc.)

**Why it happens:** "Best 11 by xPts" without constraints regularly produces outputs like 1 GK + 5 DEF + 5 MID + 0 FWD — mathematically optimal given a squad weighted to defenders, but invalid in FPL.

**Consequences:** Every recommended lineup is wrong for a midfielder-heavy or forward-light squad. The user immediately distrusts the tool.

**Prevention:** Model formation as six integer inequality constraints on position counts. Sort players by xPts within each position, then solve as a constrained selection (greedy or MILP). The lineup optimiser phase must encode all six constraints before any xPts ranking.

**Detection:** Unit test: pass a squad with 5 defenders and 3 forwards, assert the output never contains 0 forwards.

---

### Pitfall 2: Three-player-per-club cap applies to the full 15, not just the XI

**What goes wrong:** Enforcing the club constraint only on the starting 11. A standalone squad builder that allows a bench of 4 Chelsea players alongside 2 starters passes lineup-level validation but is illegal at squad level.

**The actual rule:** No more than 3 players from the same Premier League club in the 15-player squad (squad level, not starting XI level).

**Why it happens:** The lineup optimiser and the squad builder are often written as separate modules. The squad builder forgets that the constraint is on the full 15.

**Consequences:** The standalone squad builder produces squads that the FPL game itself would reject. The wildcard/free-hit mode may suggest transfers that violate this cap.

**Prevention:**
- Always apply the club count constraint at squad level (all 15 players) in both the lineup optimiser and the squad builder.
- In transfer-aware mode: when simulating a transfer in, check that the target player's club count in the post-transfer squad would not exceed 3.
- Add an assertion: `assert max(club_counts.values()) <= 3` before emitting any recommendation.

**Detection:** Unit test: squad with 3 Arsenal players — optimiser must not suggest bringing in a 4th Arsenal player regardless of their xPts.

---

### Pitfall 3: Bench order and the goalkeeper-only sub rule

**What goes wrong:** Treating the bench as an ordered list [GK_sub, outfield_1, outfield_2, outfield_3] and assuming autosubs work like a priority queue — first unavailable starter replaced by first eligible bench player.

**The actual autosub rules (HIGH confidence):**
- The bench GK (slot 0) can only replace the starting GK, and only if the starting GK plays 0 minutes.
- The bench GK never replaces outfield starters, regardless of position or bench priority.
- Outfield subs (bench slots 1-3) replace outfield starters only, in bench order (slot 1 first), subject to the valid formation constraint — the sub must not produce an illegal formation.
- If no bench player can enter without making the formation invalid, the substitution is skipped.

**Why it happens:** Optimisers often treat bench weight as a flat scalar (e.g., GK_sub x 0.1, sub1 x 0.2, sub2 x 0.1, sub3 x 0.05). This is reasonable as an approximation, but gets the GK-sub semantics wrong: a high-xPts outfield player ranked first on the bench cannot sub for a non-playing GK.

**Consequences:**
- The bench ordering optimiser places a high-scoring outfield player in the GK slot, expecting autosub value that can never materialise.
- Bench boost mode calculates expected bench points incorrectly if it conflates GK-sub with outfield-sub roles.

**Prevention:**
- Keep the GK sub as an isolated slot. Never rank it against outfield bench players.
- For bench order optimisation: score the three outfield bench slots by `xPts x start_prob x formation_sub_probability`. Do not include the GK sub in this ranking.
- For bench boost: `bench_pts = GK_sub_xPts x (1 - starter_GK_start_prob) + sum(outfield_bench_xPts x autosub_prob_i)`.

**Detection:** Unit test: starting GK plays 0 minutes — assert only GK sub enters, not the outfield bench leader even if bench leader has higher xPts.

---

### Pitfall 4: Captain/VC autosub rules are not modelled

**What goes wrong:** The optimiser recommends a captain, scores the lineup as captain_xPts x 2, and ships it. It does not account for the FPL rule that if the captain plays 0 minutes, the captaincy transfers to the VC.

**Why it matters:** For a horizon-based optimiser, failing to account for the VC multiplier means:
- A risky captain pick (75% start probability) is over-valued relative to a safe one (95%)
- Wildcard/free-hit mode optimising for bench boost may fail to notice that captain + VC both being rotation-risk players is worse than one safe captain

**Prevention:**
- Model expected captain contribution as `captain_xPts x 2 x start_prob + vc_xPts x 2 x (1 - start_prob) x vc_start_prob`.
- Surface the VC alongside the captain recommendation in the UI.
- For triple captain chip: same model, factor x 3 not x 2.

**Detection:** Snapshot test: captain at 50% start_prob, VC at 90% start_prob — assert VC expected contribution factor is surfaced and non-trivial.

---

### Pitfall 5: Price arithmetic must stay in integer tenths throughout

**What goes wrong:** Converting player prices from tenths of GBP 1m (FPL's internal format) to floats for budget arithmetic. `now_cost = 65` becomes `6.5` and then `6.5 + 7.4 = 13.899999...` creates phantom budget due to floating-point rounding.

**This project's existing pattern:** `planning-engine.ts` and `free-transfer-engine.ts` already use tenths throughout — `if (buyCandidate.now_cost > simulatedBank + sellPrice)` compares integers. The standalone squad builder must follow this same pattern.

**The standalone squad builder constraint:**
- Budget: 1000 tenths (GBP 100.0m)
- All comparisons must be integer tenths; render as `(cost / 10).toFixed(1)` only at display time

**Prevention:**
- Enforce a type alias or branded type `Tenths = number` to make the unit explicit in function signatures.
- Never divide by 10 inside budget calculation loops; only divide at render.
- Add a validation assertion: `Number.isInteger(budget)` in squad builder entry points.

**The sell-price haircut:** FPL takes 50% of price rises. Transfer-aware mode must use `selling_price` (from authenticated `my-team` endpoint, already in `MyTeamPickSchema`) not `now_cost` as the sell value. Without auth, fall back to `now_cost` but warn the user the budget may be slightly off.

**Detection:** Unit test: player bought at 65, now_cost 67 — sell proceeds must be 66 (not 67).

---

### Pitfall 6: Chip interactions change the constraint landscape

**What goes wrong:** Wildcard and Free Hit are treated as "unlimited transfers this GW" but the optimiser does not update the constraint set accordingly.

**Wildcard differences:**
- No transfer limit, no hit cost for this GW
- Player sells still apply the haircut (selling_price, not now_cost)
- After the wildcard GW, free transfers reset to 1 (not 2)

**Free Hit differences:**
- Squad reverts to pre-Free-Hit state the following GW — the optimiser must NOT carry forward the Free Hit squad as the next GW's starting squad
- Free Hit does not reset the free transfer bank; the transfer bank passes through as if this GW was skipped
- Existing `computeNextFTState()` in `free-transfer-engine.ts` already handles the Free Hit bank-passthrough correctly — squad reversion is the new risk

**Bench Boost:**
- Changes scoring: all 15 players score (bench contributes fully)
- Does NOT change selection rules or formation constraints
- Optimiser should identify the best GW to play BB by finding the GW where `sum(all 15 xPts)` is highest, weighted by fixture count (DGW is the prime candidate)

**Triple Captain:**
- Captain factor becomes x 3, not x 2
- Does NOT change any selection constraint

**Prevention:**
- Model chip as a mode enum (`'normal' | 'wildcard' | 'freehit' | 'bboost' | 'triple_captain'`) that gates constraint application.
- Free Hit mode: display a warning that the built squad is temporary and will not persist to the next GW.
- Wildcard mode: carry forward the post-wildcard squad correctly — it becomes the new base squad.

---

## Section 2 — Performance Pitfalls

### Pitfall 7: Standalone squad builder has combinatorial explosion if done naively

**What goes wrong:** Brute-forcing the optimal 15-player squad from approximately 650 players. Without constraints, C(650,15) is approximately 10^29 combinations. Even with position constraints, the naive enumeration is intractable in-browser.

**Practical scale (MEDIUM confidence):**
- Adding position constraints (2 GK, 5 DEF, 5 MID, 3 FWD) plus the 3-per-club constraint creates a 26-dimensional knapsack. Pure dynamic programming is impractical at this scale.
- MILP (Mixed Integer Linear Programming) is the correct approach for full optimality at 650 players.

**Prevention for this project:** Three approaches work at different scopes:
1. **Greedy with position passes:** Fill each position greedily by xPts within budget. O(n log n) per position, fast in-browser, good enough for the 15-player lineup optimiser and transfer-aware mode.
2. **MILP via Python backend:** Add a `/api/optimise-squad` route that calls the existing Python pipeline (PuLP or scipy with HiGHS). Adds 1-3s latency but gives optimal results. Required for the standalone squad builder.
3. **Beam search:** Keep top-K partial squads at each step. K=100 gives near-optimal in milliseconds. A reasonable middle ground.

**Recommendation:** Use greedy for the lineup optimiser and transfer-aware mode (bounded to 15 existing players). Use MILP Python backend for the standalone squad builder only — it has the full 650-player search space.

**Detection:** Benchmark greedy approach: time the standalone builder against 650 mock players — must complete in under 500ms in-browser.

---

### Pitfall 8: Lineup optimiser must not re-run on every render

**What goes wrong:** The lineup optimiser is triggered by a React state change (horizon toggle, tab switch), runs synchronously on the render thread, and freezes the UI.

**Why it happens:** Even a greedy lineup optimiser over 15 players with formation checking requires iterating valid position combinations — this can take 50-200ms if done naively.

**Prevention:**
- Run the optimiser inside a `useMemo` keyed only on `[picks, allPlayers, horizon, chip]` — not on transient UI state.
- For the standalone squad builder (650 players), post to the Python `/api/optimise-squad` route, not in-browser.
- Wrap in React 19's `startTransition` if using concurrent mode — marks the update as non-urgent so the UI stays responsive.

**Detection:** Verify via React DevTools profiler that the optimiser computation only fires when inputs change, not on every tab switch.

---

## Section 3 — UX and Trust Pitfalls

### Pitfall 9: Optimal lineup contradicts user intuition with no explanation

**What goes wrong:** The optimiser recommends benching a player the user always starts (e.g., a 12%-owned premium midfielder with great form). The user sees the result, distrusts the tool, and stops using the optimiser.

**Root cause:** The user cannot see why the optimiser made the choice. Did the player have a hard fixture? Low xPts? Formation constraint forced the decision?

**Prevention:**
- For every bench/start decision, show the primary reason: xPts score, fixture difficulty, formation constraint, club cap, or minutes risk. A single reason string per player is sufficient.
- Show the xPts score for each player alongside their lineup position — the user can directly see the numeric trade-off.
- Never silently constrain without telling the user. If a player is benched due to the 3-club cap, say so.
- This project already has `xPts_components_1gw` breakdown (goal_pts, assist_pts, cs_pts, bonus_pts) — surface this as a tooltip on the optimised lineup card, reusing the existing `XPtsCell` pattern.

**Phase to address:** Lineup Optimiser phase, from day one. Trust is lost immediately if the first run produces unexplained counterintuitive results.

---

### Pitfall 10: The optimiser always suggests a change even when the current lineup is near-optimal

**What goes wrong:** The transfer-aware optimiser always suggests a change, even when the current lineup is near-optimal. The user interprets this as the tool being aggressive or unreliable.

**Why it happens:** The scoring model always finds some delta between current and optimal. The threshold for "good enough" is not modelled.

**Prevention:**
- Implement a minimum-gain threshold: only suggest a transfer if the expected net gain exceeds the hit cost plus a meaningful buffer (e.g., > 1.0 xPts net gain, not just > 0).
- Show the delta explicitly: "Keeping your current lineup. Best possible gain from a transfer is 0.3 xPts — below the 1.0 xPts threshold."
- This project's existing `planning-engine.ts` already uses `netGain > 0` as the gate — consider raising this threshold or making it configurable.

**Phase to address:** Transfer-aware optimiser phase.

---

### Pitfall 11: Side-by-side current vs optimised is unreadable on mobile

**What goes wrong:** The "current lineup vs optimised" comparison shows two 11-player lists side by side. On mobile (375px), this is unreadable.

**Why it matters:** This project has extensive mobile-responsive infrastructure. A side-by-side layout for two squad views requires a different mobile pattern.

**Prevention:**
- On mobile: stack current above optimised with a divider and a "Changes: X players" summary badge.
- Highlight only the diff (players who changed position: bench to start or start to bench) using a colour-coded indicator, not a full re-render of both squads.
- Reuse the `SquadSnapshotRow` accordion pattern from the existing Planner tab — it already handles per-GW squad display in a mobile-friendly way.

**Phase to address:** Transfer-aware optimiser phase (same phase as the comparison UI).

---

## Section 4 — Integration Pitfalls

### Pitfall 12: Sharing squad state between the existing Planner and the new Optimiser

**What goes wrong:** The Planner tab holds its own squad simulation state (from `generatePlan()`). The Optimiser tab needs the current squad from `useSquad()` / `useMyTeam()`. When both tabs are mounted and the user has edited the planner manually, the two sources of truth diverge.

**The existing pattern in this codebase:**
- `useSquad(teamId)` — TanStack Query, 5 min staleTime — the canonical current squad
- `useMyTeam(enabled)` — TanStack Query, authenticated sell prices
- The Planner holds `planResult` in component state (Immer), a derived simulation from the canonical squad

**Risk:** If the Optimiser reads from `planResult.steps[0].squadAfter` instead of `useSquad`, it will optimise a projected future squad, not the user's actual current squad. This produces confusing results ("the optimiser recommends a player I already have").

**Prevention:**
- The Optimiser must always read from `useSquad` / `useMyTeam` as its source of truth, never from the Planner's simulated state.
- Clearly label: "Optimising your current squad as of [last_updated timestamp]."
- If the user wants to optimise a post-wildcard squad, that is a separate Wildcard mode entry point with its own state — not a flag on the existing Optimiser.

**Phase to address:** Every optimiser phase that fetches squad data.

---

### Pitfall 13: xPts data stale between pipeline run and optimiser display

**What goes wrong:** The daily pipeline runs at midnight. By 11pm the next day, xPts is nearly 24 hours old. If team news drops between pipeline runs (injury, rotation rest), the optimiser may recommend a player who is now doubtful.

**The existing freshness system:** This project already has the `LastUpdated` component with amber stale colour, but it is display-only. The optimiser needs to act on staleness.

**Risk areas:**
- `status` field: player becomes `'d'` (doubtful) or `'i'` (injured) between pipeline runs. The optimiser picks them for the starting 11 without flagging the risk.
- `start_prob` and `xmins` are pipeline-computed. Post-pipeline team news is not reflected.
- BGW players in the 15 who have no fixture in the target GW score 0 — the optimiser must use `fixtureCountForGw() === 0` to exclude them from the starting 11.

**Prevention:**
- Before running the optimiser, filter out players with `status === 'i'` or `status === 's'` (suspended) from the starting 11 candidates. Bench-position candidates should be flagged but not hard-excluded.
- Players with `fixtureCountForGw(player, targetGw) === 0` (BGW) must be benched — they contribute 0 xPts in that GW regardless.
- Show a "Data as of [timestamp], check team news before deadline" warning at the top of every optimiser output.
- Add the existing `news` field (injury news text from `MergedPlayer`) as a warning badge on any player not status `'a'`.

**Detection:** Unit test: squad contains a player with `status: 'i'` — assert they are never placed in starting 11.

---

### Pitfall 14: The standalone squad builder competes visually with Transfer Suggestions

**What goes wrong:** The standalone builder recommends a squad that conflicts with what the Transfer Suggestions tab shows. Both features showing different "best players" creates confusion about which signal to follow.

**Prevention:**
- Position the standalone builder clearly as a "fresh start" tool — "Build your ideal squad from scratch (ignores your current team)". Label it with an explicit caveat.
- Do not surface Transfer Suggestions-style BUY/SELL verdict badges inside the standalone builder — those assume the user has an existing squad.
- The Wildcard mode sits between the two: "Optimise within your current budget, starting fresh but costing transfers." Make the Wildcard entry point explicit.

**Phase to address:** Standalone squad builder phase.

---

### Pitfall 15: Budget computation differs across the three optimiser modes

**What goes wrong:** The lineup optimiser (picking best 11 from an existing 15) has no budget constraint. The transfer-aware optimiser has a budget: ITB + sell proceeds. The standalone builder has the full GBP 100m. Conflating these three modes in a single budget variable causes wrong results.

**Prevention:**
- Three clearly separated budget contexts in the type system:
  - `LineupMode`: no budget; constraints are formation + club cap only
  - `TransferMode`: budget = `bank_balance + sum(selling_prices_of_players_out)` per transfer step
  - `StandaloneMode`: budget = 1000 tenths (GBP 100.0m)
- Each mode should have its own function signature with `budget?: Tenths` typed accordingly.
- `TransferMode` with 2 transfers: apply each transfer's budget update sequentially — the second transfer uses the post-first-transfer bank balance.

---

### Pitfall 16: Free Hit squad reversion is not persisted in the Planner

**What goes wrong:** The Planner correctly models Free Hit as "unlimited transfers this GW" via `computeNextFTState('freehit', ...)`. But the Optimiser must also track that the squad reverts next GW. If both independently model the post-Free-Hit state, they may show different squad projections for the following GW.

**Prevention:**
- The Optimiser's Free Hit mode should be explicitly scoped to "this GW only" — show the temporary squad and mark each player in it with "Free Hit only".
- Do not carry the Free Hit squad forward as the persistent squad state in either the Optimiser or the Planner.
- If the user has the Planner open with a Free Hit chip toggled, read the post-Free-Hit squad reversion from the Planner's `originalSteps[0].squadAfter` (which represents the pre-chip squad) — not the chip-mode squad.

---

## Section 5 — Data Pitfalls

### Pitfall 17: BGW players must be hard-excluded from the starting 11, not just penalised

**What goes wrong:** The optimiser scores BGW players with 0 xPts for the blank GW and ranks them last in formation selection. But a greedy algorithm may still place them in the starting 11 if all players in a position happen to have low xPts (e.g., a GK-heavy squad in a blank).

**The correct approach:** BGW players must be hard-excluded from the starting 11 for the blank GW. They score exactly 0 points in FPL — not "probably 0", guaranteed 0.

**Prevention:**
- Pre-filter: `const starters = squad.filter(p => fixtureCountForGw(p, targetGw) > 0)`.
- If this leaves fewer than 11 eligible players (heavy BGW), the optimiser must place all BGW players on the bench and pick the best valid formation from whoever has a fixture — even if the formation is weak.
- Show a warning: "Your squad has only [N] players with a fixture in GW[X]. Bench selections are limited."

**Detection:** Unit test: squad with 8 players blanking — assert starting 11 contains only the 7 non-blankers and formation constraint is still valid.

---

### Pitfall 18: Doubtful players should reduce expected value, not be hard-excluded

**What goes wrong:** Treating `status === 'd'` (doubtful) the same as `status === 'i'` (injured) — hard-excluding doubtful players from the starting 11. A 75% chance of playing doubtful player is still better than a 90%-start-probability mediocre replacement.

**The correct model:** Expected contribution = `xPts x start_prob`. The `start_prob` field already exists in `MergedPlayer` — use it as the multiplier.

**But:** `start_prob` in the pipeline is computed from historical minutes patterns, not from current injury news. For a player freshly flagged as `'d'`, the pipeline's `start_prob` may be stale.

**Prevention:**
- For players with `status === 'd'`, cap `start_prob` at the FPL-reported `chance_of_playing_next_round` if that field is available in the bootstrap. If not, use a conservative cap (e.g., 0.5 for doubtful, 0.25 for major doubt).
- Expose the effective xPts (after start_prob adjustment) in the optimiser output so the user can see the discounting.

**Note on this codebase:** `FPLElement` does not currently parse `chance_of_playing_next_round` from the FPL bootstrap. Adding this field to the Zod schema and `MergedPlayer` is a prerequisite for proper doubtful-player handling in the optimiser.

---

### Pitfall 19: Multi-GW horizon xPts degrades but the optimiser treats all GWs equally

**What goes wrong:** A 5-GW optimiser scores each gameweek equally. In reality, GW+4 predictions are substantially less reliable than GW+1 predictions — injury rates are higher, form can change, rotation risk accumulates.

**The existing planner already discounts:** `LOOK_AHEAD_DISCOUNT = 0.8` in `planning-engine.ts`. The optimiser must apply the same principle.

**Prevention:**
- Apply a per-GW discount factor: `xPts_gw_n = xPts_1gw x discount^(n-1)` where `discount = LOOK_AHEAD_DISCOUNT`.
- For BGW-aware scoring: the existing `fixtureCountForGw()` already handles DGW (returns 2) and BGW (returns 0). Use it as the multiplier at each GW step.
- Match the discount constant to `LOOK_AHEAD_DISCOUNT` from `planning-engine.ts` — do not invent a new constant.

---

## Section 6 — Testing Pitfalls

### Pitfall 20: Engine correctness testing is skipped in favour of visual testing

**What goes wrong:** The optimiser is tested end-to-end by looking at the UI ("it shows 11 players, looks right"). The underlying combinatorial logic is never unit-tested, so edge cases are silently wrong.

**Prevention — required test cases for the lineup optimiser:**

| Test case | Assertion |
|-----------|-----------|
| All-MID squad (no FWDs) | Output has at least 1 FWD; constraint enforced or error thrown |
| 3-club-cap squad | Optimiser does not recommend a 4th player from any club |
| Full BGW squad | All 11 starters have a fixture; warning shown |
| 8 of 15 players blanking | Starts only the 7 non-blankers; valid formation still asserted |
| Injured GK | Bench GK starts; formation still valid |
| Suspended starter | Suspended player is not placed in starting 11 |
| Doubtful player | xPts discounted by start_prob, not hard-excluded |
| Wildcard mode | No transfer limit; club cap still enforced; FT bank reset to 1 next GW |
| Free Hit | Post-FH squad is not carried forward to next GW calculation |
| Captain plays 0 mins | VC takes captain multiplier in expected score calculation |
| Bench order | GK sub never ranked with outfield bench for autosub probability |
| Budget arithmetic (lineup) | No budget constraint applied; formation-only |
| Budget arithmetic (transfers) | All cost comparisons in integer tenths; no float rounding |
| Transfer with sell-price haircut | Proceeds = selling_price (not now_cost) when player price rose |

**Prevention — required test cases for the standalone squad builder:**

| Test case | Assertion |
|-----------|-----------|
| Valid 15-player squad composition | Exactly 2 GK, 5 DEF, 5 MID, 3 FWD |
| Under budget | Total cost <= 1000 tenths |
| Club cap at squad level | No club has more than 3 players across all 15 |
| No injured/suspended picks | No `status === 'i'` or `status === 's'` players in recommended squad |
| Performance | Completes in under 500ms for 650 mock players (greedy) |

**Phase to address:** Every optimiser phase should have unit tests passing before any UI work. Engine test suite must be green before the UX is wired up.

---

### Pitfall 21: New optimiser inadvertently breaks existing planner engine

**What goes wrong:** The lineup optimiser reuses or wraps `planning-engine.ts`, inadvertently changing shared utility functions (`fixtureCountForGw`, `computeHitCost`, `snapshotSquad`). Existing planner tests pass but the planner behaviour changes subtly.

**Prevention:**
- Keep the new optimiser engine in a separate file (`src/lib/lineup-engine.ts`, `src/lib/squad-builder-engine.ts`).
- Import shared utilities from `planning-engine.ts` and `free-transfer-engine.ts` — do not fork or copy them.
- Run the existing planning-engine test suite (`src/lib/__tests__/planning-engine-rescore.test.ts`) as part of every optimiser phase's verification gate.

---

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Mitigation |
|-------------|----------------|------------|
| Lineup optimiser (best 11 from 15) | Formation constraint silently violated | Encode all 6 constraints before xPts ranking; unit test with degenerate squads |
| Lineup optimiser (captain) | VC autosub not modelled | Add start_prob-weighted captain model from day one |
| Transfer-aware optimiser | Budget uses now_cost not selling_price | Always read from `MyTeamPickSchema.selling_price` when authenticated |
| Transfer-aware optimiser | 2-transfer sequencing violates club cap | Check club cap after each simulated transfer, not just at the end |
| Wildcard / Free Hit mode | Free Hit squad leaks into next-GW state | Scope Free Hit output as "this GW only"; never carry forward |
| Standalone squad builder | Combinatorial explosion in-browser | Use Python MILP backend for full 650-player search; greedy only for 15-player lineup |
| Standalone squad builder | Club cap at squad level missed | Apply club cap to all 15, not just starting 11 |
| All optimiser outputs | No explanation for counterintuitive picks | Show xPts + reason string for every bench/start decision |
| All optimiser outputs | Stale xPts after injury news | Show data timestamp; flag doubtful players; surface `news` field |
| BGW weeks | BGW players in starting 11 | Hard-filter `fixtureCountForGw === 0` before formation selection |
| Mobile UI | Side-by-side current vs optimised unusable | Stack vertically on mobile; show diff badge only |
| Integration | Optimiser reads from Planner simulated state | Always source from `useSquad` / `useMyTeam`, never from `planResult` |
| Multi-GW scoring | All GWs weighted equally | Apply `LOOK_AHEAD_DISCOUNT` per GW step, matching existing planner constant |

---

## Sources

- [FPL Official Help — Rules](https://fantasy.premierleague.com/help/rules)
- [FPL Review Transfer Solver vs Linear Optimiser](https://docs.fplreview.com/the-model/solvers/solver-comparison/)
- [Linearly Optimising FPL Teams — Joseph O'Connor](https://medium.com/@joseph.m.oconnor.88/linearly-optimising-fantasy-premier-league-teams-3b76e9694877)
- [FPL Optimisation with Julia and JuMP — Ruban](https://www.skruban.com/essays/fpl-optimisation/)
- [Hindsight Optimization for FPL — AlpsCode](https://alpscode.com/blog/hindsight-optimization/)
- [FPL Auto Subs: How Automatic Substitutions Work — LiveFPL](https://www.livefpl.com/blog/fpl-auto-subs)
- [Fantasy Football as a Data Scientist Part 2: Knapsack Problem](https://medium.com/@kangeugine/fantasy-football-as-a-data-scientist-part-2-knapsack-problem-6b7083955e93)
- [FPL Basics: How to Make Transfers](https://www.premierleague.com/en/news/2174907)
- Codebase inspection: `src/lib/planning-engine.ts`, `src/lib/free-transfer-engine.ts`, `src/lib/squad-adapter.ts`, `src/lib/types.ts`
