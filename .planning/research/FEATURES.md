# Feature Landscape: FPLx v1.6 Squad Optimiser

**Domain:** FPL squad optimisation — lineup selection, captain/VC, transfers, chip modes
**Researched:** 2026-04-30
**Downstream consumer:** Roadmap / requirements author (REQ-IDs, user-facing behaviour, complexity, dependencies)
**Replaces:** v1.4 FEATURES.md (different milestone scope)

---

## FPL Rules Reference (Authoritative Constraints)

These are the hard rules every optimiser must respect. Source: official FPL help/rules page (2025/26 season).

| Constraint | Value |
|------------|-------|
| Squad size | 15 players |
| Squad composition | 2 GK, 5 DEF, 5 MID, 3 FWD |
| Starting XI size | 11 players |
| Starting XI minimum | 1 GK, ≥3 DEF, ≥2 MID, ≥1 FWD |
| Max players per club | 3 |
| Budget (squad builder) | £100.0m |
| Transfer cost (beyond free) | −4 pts per additional transfer |
| Free transfers | 1 per GW, accumulates to max 2 |
| Bench GK slot | Position 0 (separate from 3 outfield bench slots) |
| Auto-sub trigger | Starting player plays 0 minutes |
| Auto-sub order | Bench positions 1→2→3 (left to right, formation-valid only) |
| Bench Boost 2025/26 | Two sets of chips (one per half-season): WC, FH, TC, BB × 2 |

**Formation universe (valid starting XI splits):**

| Formation | DEF | MID | FWD |
|-----------|-----|-----|-----|
| 5-4-1 | 5 | 4 | 1 |
| 5-3-2 | 5 | 3 | 2 |
| 5-2-3 | 5 | 2 | 3 |
| 4-5-1 | 4 | 5 | 1 |
| 4-4-2 | 4 | 4 | 2 |
| 4-3-3 | 4 | 3 | 3 |
| 3-5-2 | 3 | 5 | 2 |
| 3-4-3 | 3 | 4 | 3 |

A squad of 2 GK + 5 DEF + 5 MID + 3 FWD can validly produce all eight formations above. The optimiser must enumerate all valid starting XI combinations and pick the one that maximises xPts sum.

---

## Table Stakes

Features users expect. Missing or wrong = product feels broken or untrustworthy.

### TS-01: Correct constraint enforcement

Every output must satisfy all FPL rules above without exception. The 3-per-club cap, formation validity, and budget constraints must all hold. Violations destroy trust immediately.

**Complexity:** Low (pure logic, well-defined). Must be tested with property-based or exhaustive unit tests.
**Dependency:** All other features depend on this being correct first.

### TS-02: Formation auto-selection (enumerate all valid formations, pick highest xPts)

Given a 15-player squad, the optimiser must try all valid formation combinations and return the one that maximises total xPts for the 1 GW (or N GW) horizon in use. The user should see the formation label (e.g., "4-3-3") and know it was chosen by the data, not arbitrarily.

**How it works:** Binary selection problem — for each player, a binary variable `starter[i] ∈ {0,1}`. Constraints enforce position counts and exactly-11 starters. Formation is derived from the solved `starter` vector, not pre-specified. A greedy enumeration over the 8 valid formations (enumerate all, score each, return max) is acceptable given only 15 players. A proper MILP is also correct but overkill for this squad size.

**Complexity:** Medium. Core algorithm is straightforward; the correctness constraints (auto-sub formation validity during scoring) add nuance.
**Dependency:** Requires xPts per player (already in `merged_players.json` as `xPts_1gw`, `xPts_3gw`, `xPts_5gw`).

### TS-03: Captain and Vice-Captain selection

The captain must be a starter. Captain receives double points. VC receives double points only if captain plays 0 minutes (insurance). Both must be co-determined with the lineup, not post-hoc.

**Captain selection logic (standard):** Player with highest xPts among starters. For VC: second-highest xPts among starters. This is what every FPL tool does at minimum (FPLReview, FPL Copilot, FPL Form).

**VC as insurance:** The VC is most valuable when the captain has fixture risk. Surface the captain's fixture (opponent, H/A, difficulty) so the user can judge. If the captain has a DGW, VC should ideally not be from the same match so that one of them is guaranteed to captain in case of a single no-show.

**Complexity:** Low once starters are determined. Add xPts ceiling (90th percentile, already in pipeline as `xPts_90th_1gw`) to provide "safe vs ceiling" classification already done by CaptainPicksPanel.
**Dependency:** Existing `CaptainPicksPanel` and `xPts_90th_1gw` data already built (Phase 31).

### TS-04: Bench ordering

Bench order must be set so auto-subs are formation-valid and maximise expected cover. Standard rule: bench position 1 should be the highest-xPts outfield player (most likely to add points if called on), bench position 2 next, bench position 3 last. The bench GK (position 0) is fixed separately; GK auto-sub only covers the starting GK.

**Complexity:** Low. Sort the 4 bench players by xPts descending, put GK at position 0, others at 1-2-3. Edge case: if bench position 1 is a DEF and no starters are DEF-deficient, that sub is formation-safe. In practice the ordering heuristic is sufficient without full auto-sub simulation.

**Dependency:** xPts per bench player. Note: bench player xPts should be discounted relative to starters (they only score if an auto-sub triggers). FPLReview uses sub weights of S1=0.30, S2=0.10, S3=0.03, SGK=0.03. This means a bench player's effective contribution to squad xPts is xPts × sub-weight. Use a configurable bench weight (default 0.25 for position 1, 0.10 for position 2, 0.05 for position 3) rather than full-probability simulation.

### TS-05: Configurable GW horizon (1 / 3 / 5 GW)

xPts is already computed over 1, 3, and 5 GW horizons. The optimiser should respect the user's selected horizon. The existing horizon toggle from the GW Planner can drive this.

**Complexity:** Low. The three xPts fields already exist. The optimiser uses the active horizon's xPts column.
**Dependency:** Existing `xPts_1gw`, `xPts_3gw`, `xPts_5gw` on `MergedPlayer`.

### TS-06: DGW and BGW handling

- **DGW:** A player with two fixtures this GW has approximately double the xPts of a single-fixture GW. The pipeline must expose fixture count per player per GW. If `xPts_1gw` already aggregates over all fixtures in the GW (it should), then no special treatment is needed — the value is naturally higher. Verify this assumption against the existing pipeline.
- **BGW:** A player with no fixture this GW has `xPts_1gw = 0`. The optimiser will naturally bench/exclude such players if better alternatives exist among starters. The critical risk: if the manager's starting 11 has too many blankers, the optimised lineup may still have them starting (no alternatives in the 15-player squad). Surface a warning: "N starters have no fixture this GW" so the manager knows to consider a Free Hit.

**Complexity:** Low (DGW is automatic if xPts aggregates correctly; BGW warning is a UI flag check).
**Dependency:** Existing `xPts_1gw` data; fixture metadata from `merged_players.json` to detect BGW (zero fixtures).

### TS-07: Transfer-aware mode with free transfer count input

For the "transfer-aware" sub-mode (1–2 free transfers), the user must be able to specify how many FTs they have. The optimiser then considers swapping 1 or 2 players from the current squad with players not in the squad to improve xPts, netting against the −4pt hit cost for each transfer beyond the FT count.

**Net gain formula:** `xPts_gain - (max(0, transfers_made - free_transfers) * 4)` must be positive for a transfer to be recommended.

**Complexity:** Medium. Requires iterating over candidate replacements from the full player dataset. Position-locked (can only swap like-for-like positions). Budget constraint applies (sell price + bank balance ≥ buy price). Most expensive part computationally: O(squad_size × candidate_pool) comparisons. For a 15-player squad and ~600 candidates, this is ~9,000 comparisons per transfer slot — fast in JS/TS.

**Dependency:** Player sell prices (exact if authenticated, approximate otherwise — already handled by existing auth layer). Bank balance. Current squad composition. Full `players` dataset from API.

### TS-08: Side-by-side current vs optimised comparison

When a transfer is suggested, display both the current lineup and the optimised lineup so the user can see exactly what changes. At minimum: a two-column list (Current | Optimised) showing starter/bench assignments per player, with changed players highlighted.

**What tools typically show:** Most FPL tools (FPL Review, FPL Form) show the optimised squad and separately note transfers. A side-by-side diff is less common but is the clearest UX for this app's use case given the existing Squad tab.

**Complexity:** Low-Medium. Primarily a display component. The diff calculation is straightforward (set difference between current starters and optimised starters).

### TS-09: xPts total display for current vs optimised

Show the projected xPts total for both the current lineup and the optimised lineup. The delta ("Optimised gains +X.X xPts") is the primary user-facing metric that justifies any recommended change.

**Complexity:** Low. Arithmetic on the existing xPts fields.

---

## Differentiators

Features that set the product apart — not expected by default, but valued by engaged managers.

### D-01: Wildcard / Free Hit mode (chip toggle removes transfer constraints)

In Wildcard or Free Hit mode, the optimiser builds the best possible 15-player squad from all available players within the £100m budget, ignoring the current squad. This answers "what would I field if I wildcarded today?" — and is already scoped for v1.6.

**FH vs WC distinction:**
- **Free Hit:** Temporary for one GW. Changes revert after the GW. The optimiser output is "use for this GW only."
- **Wildcard:** Permanent squad rebuild. The output becomes the new squad.

The UI should make this distinction explicit. Both use the same optimisation algorithm (best-15 from all players), but the framing and action button differ.

**Complexity:** Medium-High. Requires running the MILP or greedy solver over the full ~600-player pool (vs 15 players in lineup mode). The 3-per-club cap becomes binding and requires explicit enforcement. Budget is a hard constraint. Bench composition (2 GK + formation-valid outfield bench) must be valid.

**Dependency:** Full `players` dataset with xPts and prices. Budget constraint. Club cap. FPLReview's linear optimiser (MILP with HiGHS) is the reference implementation; for this personal-use tool a greedy approach with club-cap enforcement is sufficient for an initial version.

### D-02: xPts ceiling shown for captain/VC (safe vs upside framing)

Already built in Phase 31 (`xPts_90th_1gw`). Surface this in the optimiser output: the captain card should show expected xPts and ceiling xPts, with a "Safe" or "Differential" label. This is a strong differentiator vs most free tools that only show expected value.

**Complexity:** Negligible (already in pipeline and CaptainPicksPanel). Integration cost only.

### D-03: Horizon-weighted optimisation with time decay

For the 3 or 5 GW horizon, apply a time-decay discount to future gameweeks (e.g., 0.85 per GW, matching FPLReview's default). This prevents over-weighting distant fixtures and matches standard optimiser behaviour for multi-GW planning. Expose the decay factor as a configurable input (advanced users tune this).

**Complexity:** Low. Multiply `xPts_Ngw` by the appropriate decay-weighted sum. Or use pre-computed weighted totals from the pipeline.

### D-04: Locking specific players (keep X regardless)

Allow the user to "lock" a player — force them into the starting 11 regardless of the optimiser's recommendation. This respects the manager's knowledge of injury news, captaincy intent, or sentimental preferences that aren't in the data.

**Complexity:** Low. Add a lock constraint to the selection algorithm: `starter[player_id] = 1` forced. Standard feature in FPLReview solver settings ("must include" list).

### D-05: "What if" captain swap

Given the optimised lineup, allow the user to quickly re-run with a different captain (e.g., swap captain to 2nd or 3rd pick) and see the xPts impact. This supports managers who want to explore captaincy differentials.

**Complexity:** Low. Re-score the lineup with a different captain assignment — no re-solve needed.

### D-06: Flagging BGW starters with warning

If the optimised starting XI contains players with no fixture (xPts_1gw = 0), surface a prominent warning: "3 starters have no GW fixture — consider Free Hit." This bridges the gap between the lineup optimiser and the chip strategy analysis already built in Phase 34.

**Complexity:** Low. Check-and-display only.

### D-07: Transfer hit calculator

Show the break-even analysis for taking a points hit: "You need +X xPts to justify this −4pt hit." If the net gain from a 2nd transfer is +3 xPts, the hit costs more than the gain — surface this clearly.

**Complexity:** Low. Arithmetic displayed alongside each transfer recommendation.

---

## Anti-Features

Features to explicitly not build in v1.6.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full MILP solver (PuLP / HiGHS in browser) | Massive dependency overhead for a 15-player lineup problem; overkill — the solution space is tiny (15 choose 11 = 1365 combinations) | Enumerate all valid formations and score each; greedy for the squad-builder case |
| Monte Carlo simulation for lineup xPts | 1000 simulations per player per GW is unnecessary for a list of 15 known players; adds latency with no meaningful accuracy gain | Use the existing analytical xPts + variance already computed by the pipeline |
| Live auto-refresh during GW (in-match) | Tool refreshes daily; in-match state is out of scope (existing constraint) | Pre-deadline optimisation is sufficient; document clearly |
| Per-player ownership / mini-league EO in optimiser | Mini-league analysis explicitly out of scope; scraping 10k entries to get EO is fragile | Use existing `selected_by_percent` as captain-pick context; no mini-league features |
| Automated chip activation | Chips are irreversible in-season actions. Auto-applying is dangerous. | Show recommendation with explicit "I want to activate this chip" confirmation step; never auto-apply |
| Formation preference picker ("I always play 4-3-3") | Formation should be data-driven; user preference overrides produce suboptimal outputs; adds UI complexity | Let the optimiser pick formation; expose the recommended formation clearly so user can accept or override via player-locking |
| Historical optimiser ("what was the best lineup last GW?") | Interesting but not actionable for upcoming decisions; significant added scope | Out of scope for v1.6; include in backtest pipeline work if desired |
| Comparing against overall FPL averages / rank projection | Adds scope creep; ranking engine is its own significant feature | Focus on "is my lineup good?" not "how does this compare to 10m managers?" |
| Budget display in pence (exact sell prices) | Sell prices only available when authenticated; approximate sell price is sufficient for optimisation | Use `now_cost` from bootstrap as sell price approximation when unauthenticated (consistent with existing behaviour) |

---

## Feature Dependencies on Existing System

All v1.6 features are downstream consumers of existing infrastructure. No pipeline changes required for the core lineup optimiser.

| v1.6 Feature | Existing Dependency | Status |
|--------------|---------------------|--------|
| Formation auto-selection | `xPts_1gw`, `xPts_3gw`, `xPts_5gw` per player | Built (Phase 28) |
| Captain / VC | `xPts_90th_1gw`, `CaptainPicksPanel` | Built (Phase 31) |
| Bench ordering | `xPts_1gw` per bench player | Built (Phase 28) |
| DGW/BGW detection | Fixture count per player per GW (verify pipeline) | Partially built — DGW badges in planner (Phase 22); xPts aggregation needs verification |
| Transfer-aware mode | Sell prices, bank balance, transfer budget | Built — auth layer, Squad View (v1.1) |
| Side-by-side comparison | Current squad from `/api/players` + team ID | Built — Squad tab |
| Wildcard / Free Hit squad builder | Full player dataset with prices and xPts | Built — `/api/players` endpoint |
| Chip mode framing | Chip strategy analysis (Phase 34) | Built — `ChipStrategyPanel` |
| Horizon toggle | 1/3/5 GW xPts columns | Built (Phase 28) |
| xPts ceiling for captain | `xPts_90th_1gw` field | Built (Phase 31) |

**Pipeline verification needed:** Confirm that `xPts_1gw` already aggregates over all fixtures in a GW (so DGW players naturally score higher). If it only uses the first fixture, the DGW handling is broken at source.

---

## Feature Dependency Graph (v1.6)

```
xPts_1gw / xPts_3gw / xPts_5gw (existing)
  │
  ├──> TS-02: Formation auto-selection
  │       │
  │       ├──> TS-03: Captain / VC selection
  │       ├──> TS-04: Bench ordering
  │       └──> TS-09: xPts total display
  │
  ├──> TS-06: DGW / BGW handling
  │       └──> D-06: BGW starter warning
  │
  ├──> TS-07: Transfer-aware mode
  │       ├──> TS-08: Side-by-side comparison
  │       └──> D-07: Hit calculator
  │
  └──> D-01: Wildcard / FH squad builder

TS-01 (constraint enforcement) underpins everything above.
```

## Recommended Build Order

| Order | Feature | Rationale |
|-------|---------|-----------|
| 1 | TS-01 + TS-02 | Constraint enforcement and formation selection are the core; everything else depends on a correct selection algorithm |
| 2 | TS-03 + TS-04 | Captain/VC and bench order complete the "optimise current 15" feature — shippable as a standalone phase |
| 3 | TS-05 + TS-06 | Horizon toggle and DGW/BGW handling are low-cost additions that complete the single-GW optimiser |
| 4 | TS-08 + TS-09 | Side-by-side comparison and xPts delta display make the output actionable |
| 5 | TS-07 + D-07 | Transfer-aware mode adds the 1–2 FT consideration on top of the solved lineup |
| 6 | D-01 | Wildcard / FH mode reuses the solver over the full player pool — natural extension of TS-07 |
| 7 | D-02 + D-04 + D-06 | Captain ceiling framing, player locking, and BGW warning are low-cost polish on top of the working optimiser |

---

## Sources

- [FPL Official Rules 2025/26](https://fantasy.premierleague.com/help/rules)
- [FPL 2025/26 Rule Changes](https://www.premierleague.com/en/news/4373187/whats-new-for-202526-changes-in-fantasy-premier-league)
- [FPLReview Solver Settings](https://docs.fplreview.com/the-model/solvers/settings/)
- [FPLReview Transfer Solver vs Linear Optimiser](https://docs.fplreview.com/the-model/solvers/solver-comparison/)
- [arXiv: A data-driven framework for team selection in FPL (2025)](https://arxiv.org/abs/2505.02170)
- [Joseph O'Connor — Linearly Optimising FPL Teams (Medium)](https://medium.com/@joseph.m.oconnor.88/linearly-optimising-fantasy-premier-league-teams-3b76e9694877)
- [FPL Toolbox — Bench Ordering Guide](https://fpltoolbox.com/blog/getting-the-most-out-of-auto-subs-how-to-sort-your-fpl-bench-like-a-pro/)
- [Fantasy Football Scout — Bench Order Guide](https://www.fantasyfootballscout.co.uk/bench-order-guide)
- [LiveFPL — FPL Auto-Subs Explained](https://www.livefpl.com/blog/fpl-auto-subs)
- [FPL Copilot — DGW and BGW Guide](https://fplcopilot.com/blog/dgw-chip-guide)
- [FanYield — BGW/DGW Strategy Guide](https://fanyield.io/en/support/fantasy-picks/double-game-weeks)
- [GitHub — ChrisMusson/FPL_Optimiser](https://github.com/ChrisMusson/FPL_Optimiser)
- [GitHub — sertalpbilal/FPL-Optimization-Tools](https://github.com/sertalpbilal/FPL-Optimization-Tools)
