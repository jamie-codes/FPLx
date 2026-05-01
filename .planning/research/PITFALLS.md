# Domain Pitfalls: Decision Assistant (v1.7)

**Domain:** Adding decision-assistant features to an existing FPL analytics system
**Researched:** 2026-05-01
**Project context:** Next.js 16 + React 19 + TypeScript + Python pipeline, existing xPts engine (Poisson/Bernoulli), `suggestTransfers()`, `optimiseLineup()`, `computeClubForm()`, `computeVerdicts()`, `computeExplanations()`, Vercel Blob storage

---

## Section 1 — Transfer Opportunity Cost Simulator

### Pitfall 1: Not anchoring to actual FT state at decision time

**What goes wrong:** The simulator asks the user "how many FTs do you have?" but does not cross-reference the FPL API's actual `entry-history` or `my-team` data. If the user forgets they rolled a transfer last week, the simulator will show "Roll saves a FT" on a squad already at the 2-FT cap — which is impossible. Worse, when auth is absent, the system silently uses `ftCount=1` as the default, making "Roll" always look attractive.

**Why it happens:** `suggestTransfers()` already takes `ftCount: 1 | 2` as a parameter. The UI is responsible for providing the correct value. It is tempting to default to 1 rather than fetch from `my-team`.

**Consequences:** The "Roll" column shows a phantom benefit. The manager takes no action believing they will gain a free transfer they already have.

**Prevention:**
- When the user is authenticated (`useMyTeam` enabled), derive `ftCount` from the FPL `my-team` API field `free_transfers` (already available on the `MyTeamPick` response in `squad-adapter.ts`). Do not let the UI override it.
- When unauthenticated, show a FT selector (1 or 2) that is visually prominent and clearly labelled "Set your free transfers."
- Add a note: "FPL caps banked transfers at 2. Rolling when you already have 2 FTs gains nothing."

**Detection:** Integration test: authenticated squad with 2 FTs — assert "Roll" column shows `+0 FTs` or is suppressed entirely.

---

### Pitfall 2: Free transfer banking produces infinite deferral loop

**What goes wrong:** The simulator compares Roll / 1-FT / 2-FT / Hit on a 1/3/5 GW horizon. On a 1 GW horizon, rolling always appears attractive when xPtsGain is below threshold — the next GW's numbers are not shown. The manager perpetually rolls, never transfers, and the simulator never surfaces the compounding opportunity cost of inaction.

**Why it happens:** The opportunity cost of banking is not modelled as a future expected loss. The simulator shows "gain from rolling = +1 FT in bank" but does not show "expected points loss from deferring the best available transfer for N GWs."

**Consequences:** The simulation systematically favours deferral, under-indexing on immediate upgrades that would pay off within the scoring horizon.

**Prevention:**
- On the 1 GW horizon view, show the top-1 transfer suggestion's `xPtsGain` explicitly as the "cost of rolling." The UI framing should be: "Rolling costs you ~X xPts if this transfer is available next week."
- Extend the 3 GW and 5 GW horizon calculations to include the projected gain from making the transfer now vs deferring. Use the existing `suggestTransfers()` output: `xPtsGain` on the 3/5 GW field is already the forward-looking gain.
- Never show "Roll" as the dominant recommendation without quantifying the deferral cost.

**Detection:** Scenario test: squad with one clear upgrade (xPtsGain > 4 over 3 GW) — assert the simulator flags rolling as a net-negative on the 3 GW view.

---

### Pitfall 3: Hit break-even inconsistency across horizons

**What goes wrong:** The simulator displays `breakEvenGws` using the formula `ceil(4 / xPtsGainPerGw)`. But `xPtsGainPerGw = xPtsGain / horizon`. When the user toggles from 1 GW to 3 GW horizon, `breakEvenGws` changes — not because the player's underlying quality changed, but because the denominator changed. This confuses users and gives the impression the hit becomes "more worthwhile" on a longer horizon, even if the player's per-GW rate is identical.

**Why it happens:** The existing `suggestTransfers()` engine correctly implements this formula per `45-UI-SPEC.md §9`. The pitfall is in how the Opportunity Cost Simulator presents three separate outputs (1/3/5 GW) without explaining that break-even figures are horizon-relative.

**Consequences:** The manager makes a hit based on "break-even in 2 GWs" shown on the 3 GW view, not realising the 1 GW view would have shown "break-even in 4 GWs" for the exact same transfer pair.

**Prevention:**
- Add a single shared `breakEvenGws` displayed prominently, computed from the 1 GW `xPtsGainPerGw` only. Label it: "Break-even using 1 GW gain rate."
- The horizon toggle on the simulator controls which population of players is shown (broader 5 GW fixture view = different ranking), not the break-even arithmetic.
- Write a unit test asserting that changing `horizon` alone does not change the displayed break-even for the same (sell, buy) pair where the player's 1 GW xPts are held constant.

---

### Pitfall 4: Additive 2-transfer approximation inflates combo gains

**What goes wrong:** `suggestTransfers()` uses an additive approximation for 2-FT combos: `xPtsGain = gain1 + gain2`. This is documented in `45-RESEARCH.md §Risk 7` as intentional. However, the Opportunity Cost Simulator presents the combo gain as if it were independently verified. When the two transfers interact (e.g., both bring in a player from the same team, reducing squad flexibility), the additive gain is optimistic.

**Why it happens:** Full re-running of `optimiseLineup()` per combo is the accurate approach but was ruled out for performance (per `CLAUDE.md` Key Decisions). The approximation is fine for the existing Transfer Suggestions UI, but the Opportunity Cost Simulator frames the output as a precise decision tool.

**Consequences:** The simulator recommends a 2-FT hit that appears to gain 4.2 xPts, but the actual gain post-bench-order-update is 3.4 xPts — insufficient to cover the -4pt hit cost.

**Prevention:**
- In the Opportunity Cost Simulator UI, label 2-FT combo gains with a caveat: "Estimated — individual gains summed."
- When the combo gain is within 1.0 xPts of the hit cost break-even (i.e., breakEvenGws = 1), suppress the suggestion or flag it as "marginal — verify."
- Do not promise precision that the approximation cannot deliver.

---

## Section 2 — Weekly Decision Summary

### Pitfall 5: Conflicting recommendations from different engines

**What goes wrong:** The Decision Summary aggregates outputs from four existing engines: `computeVerdicts()` (BUY/HOLD/SELL from gem_score), `suggestTransfers()` (specific sell+buy pair), `CaptainPicksPanel` (ceiling + EO-adjusted captain), and `chip-strategy-engine.ts` (BB/TC/FH timing). These engines are not coordinated. It is entirely possible for the Decision Summary to show:

- Verdict: HOLD for Player X
- Transfer suggestion: SELL Player X
- Captain suggestion: Captain Player X

**Why it happens:** Each engine uses a different signal source and threshold. `computeVerdicts()` uses `gem_score` (composite). `suggestTransfers()` uses `xPts_NgW` delta. `CaptainPicksPanel` uses `xPts_90th_1gw`. They are genuinely optimising different things — this is by design in the existing tab-by-tab architecture.

**Consequences:** The Decision Summary surface presents three contradictory signals about the same player. The user loses trust in the system's authority.

**Prevention:**
- Establish a strict priority hierarchy for the Decision Summary: Transfer engine overrides Verdict engine when they conflict on the same player. Captain engine is an independent signal (not a conflict).
- If `suggestTransfers()` says SELL Player X and `computeVerdicts()` says HOLD, the Decision Summary should say "Transfer out recommended" and suppress the HOLD verdict for that player in this view.
- Do not surface all four engine outputs simultaneously on the same player without reconciliation. Use the summary to pick one authoritative recommendation per dimension (captain, transfer, chip, bench).
- Add a reconciliation layer: `resolveDecisionSummary(captainPicks, transferSuggestions, verdicts, chipScores) → DecisionSummary` that implements the priority hierarchy.

**Phase to address:** Decision Summary phase, from the initial spec. This is the highest-risk pitfall for user trust in this milestone.

---

### Pitfall 6: Information overload on a single screen

**What goes wrong:** The Decision Summary tries to show everything at once: captain recommendation, bench order, 2 transfer suggestions, chip timing, risks, and opportunities. The FPL deadline is Friday 11:30am. The user has 3 minutes. They cannot process 8 panels.

**Why it happens:** The design impulse is to surface all available intelligence. The app already has 12+ tabs of analysis. Assembling them on one screen creates a decision dashboard that demands more attention than the deadline allows.

**Consequences:** The manager reads the first panel, ignores the rest, and the Decision Summary delivers no value beyond the existing individual tabs.

**Prevention:**
- Limit the Decision Summary to exactly 4 outputs: (1) Captain rec, (2) Transfer rec, (3) Bench order, (4) Chip rec (if applicable) or a "No chip" confirmation.
- Every recommendation should have a single-sentence rationale and a confidence indicator. No tables, no breakdowns.
- Deep-dive links ("See full transfer analysis →") should open the relevant existing tab, not expand inline.
- Apply a "newspaper front page" mental model: one headline per dimension, nothing below the fold on first render.

---

### Pitfall 7: Stale data across aggregated sources in the Decision Summary

**What goes wrong:** The Decision Summary pulls from multiple queries: `usePlayers()` (6h stale), `useCaptainPicks()` (6h stale), `useClubForm()` (6h stale), `useInsights()` (6h stale), `useSquad()` (5 min stale). These queries can have different cache ages. If `usePlayers` was last fetched 5h ago and `useSquad` was fetched 30s ago, the Decision Summary is simultaneously showing a squad from one moment and player data from another.

**Why it happens:** TanStack Query caches each key independently. The existing app shows freshness at the tab level, not the summary level. When aggregating, freshness is the minimum of all contributing queries.

**Consequences:** A transfer suggestion derived from 5h-old player xPts against a squad fetched 30s ago is technically a cross-time-point comparison. If a player's `status` changed between the two fetches, the recommendation is invalid.

**Prevention:**
- Track the `last_updated` timestamp from each data source. The Decision Summary should display: "Decision based on data from [oldest timestamp]."
- Flag the entire summary as stale if any contributing source is more than 8h old (the pipeline runs daily — 8h is a reasonable staleness cutoff post-pipeline).
- Add an explicit "Refresh all data" button that invalidates all TanStack Query cache keys simultaneously before the user acts on the summary.

---

## Section 3 — Fixture Swing Detector

### Pitfall 8: Defining "swing" too loosely — noise vs signal

**What goes wrong:** A "fixture swing" is defined as a team whose next-N-GW difficulty changes materially. But `attacking_difficulty` from `club-form.ts` is derived from FPL's official integer ratings (1-5), normalised to 0-1. An integer-rating change of 1 step (e.g., from 3→2 out of 5, i.e., 0.5→0.25 normalised) triggers a "swing" alert for every team every gameweek as fixtures rotate — producing alert fatigue.

**Why it happens:** The `attacking_ease` aggregates in `ClubForm` summarise across 1/3/5 GW windows. Any team gaining or losing a relatively easy game will show a changed aggregate. Without a meaningful delta threshold, every fixture change is a "swing."

**Consequences:** The Fixture Swing Detector fires on 12 of 20 teams every week. The user learns to ignore it.

**Prevention:**
- Define "swing" as a change in the GW-window aggregate ease score exceeding a minimum threshold. Based on the normalisation formula (FPL 1-5 ratings → 0-1 scale), a meaningful swing is a delta of ≥ 0.20 in the 3 GW window mean ease score.
- Only compare week-on-week deltas: `ease_3gw(this_pipeline_run) - ease_3gw(last_pipeline_run)`. This requires storing the previous pipeline run's club form data.
- As an alternative for the first implementation (without historical pipeline state): compare each team's next-3-GW ease against their season average ease. Only teams more than 1 standard deviation above or below their season average qualify as swings.
- Set a hard cap: surface at most 4 improving teams and 4 worsening teams per GW.

**Detection:** Backtested scenario: GW with no material schedule changes — detector must fire on zero teams (not 5 due to noise threshold).

---

### Pitfall 9: BGW and DGW distort fixture swing scores

**What goes wrong:** A team with a BGW has `attacking_ease_3gw = null` in the current `ClubForm` type. A team with a DGW has a 3 GW window that contains two fixtures from one gameweek. The ease aggregate treats both fixtures as separate GWs — meaning a DGW team may appear to have "two easy weeks in a row" when in reality it is one gameweek counted twice.

**Why it happens:** `meanEase()` in `club-form.ts` slices `upcoming_fixtures` by count (not by `event_id`). If a team has a DGW with 2 fixtures, they appear at `slice(0, 3)` as GW_n, GW_n, GW_n+1 — three entries covering two gameweeks. The 3 GW ease score is then biased by the DGW doubling.

**Consequences:** A team with a DGW in GW+1 followed by one medium game in GW+2 will appear as "strong fixture run" on the 3 GW view when the reality is one favorable double gameweek and then medium.

**Prevention:**
- Aggregate `ease` per `event_id`, not per fixture entry. Mean ease for GW+1 with two fixtures should average the two fixture difficulties, not count them twice.
- For BGW (`ease = null`): exclude blank gameweeks from the swing denominator. A team's fixture run should be assessed on their non-blank gameweeks.
- Add a `hasDGW: boolean` and `hasBGW: boolean` flag to the swing output so the UI can annotate: "Improving run includes a Double GW" or "Worsening run — team has a Blank GW."

**Detection:** Unit test with a team having a DGW fixture list — assert the 3 GW ease is averaged per event_id, not per fixture entry.

---

## Section 4 — Player Lifecycle Labels

### Pitfall 10: Label instability — flipping every GW

**What goes wrong:** Player lifecycle labels (e.g., "Buy next week", "Hold one more", "Sell soon", "Minutes trap", "Fixture trap") are computed from continuous signals: `gem_score`, `xPts_1gw`, fixture difficulty, `mins_risk`, `regression_signal`. These signals all change weekly as new FPL data arrives. A player may be labelled "Buy next week" after GW30, then "Hold one more" after GW31, then "Buy next week" again after GW32 — with no real change in their underlying situation.

**Why it happens:** Threshold-based classification on continuous signals is inherently brittle near boundaries. `computeVerdicts()` already has this problem with BUY/SELL/HOLD — players near the `positionAvg` boundary flip weekly. Lifecycle labels are a strictly harder problem because they involve more signals and more categories.

**Consequences:** The manager receives contradictory advice from week to week. They lose confidence in the labels and stop reading them.

**Prevention:**
- Implement hysteresis: once a label is assigned, require the signal to cross a wider band before a different label is applied. Example: to move from "Hold" to "Sell soon", require gem_score to fall below 85% of position average (not just 90%).
- Define label persistence rules: a label can only change if: (a) the underlying signal has changed by more than X% or (b) a different categorical signal (e.g., `mins_risk`) has changed.
- Log the primary reason for each label as a structured field. The UI shows the reason alongside the label, so the manager can evaluate whether the label change is meaningful.
- Accept that lifecycle labels are inherently less stable than point-in-time analytics. Surface them as "context" rather than "commands." Framing matters: "Fixture trap concern" vs "SELL."

**Phase to address:** Player Lifecycle Labels phase — define the hysteresis thresholds in the spec, not during implementation.

---

### Pitfall 11: Overlapping with existing BUY/SELL/DIFF/TRAP signals

**What goes wrong:** The app already has four signals per player: `regression_signal` (buy/sell from xG delta), `differential_flag` (diff/trap from ownership + xPts), `computeVerdicts()` (BUY/HOLD/SELL from gem_score), and `recommend.ts` buy/hold/sell for squad players. Lifecycle labels are a fifth signal. The UI ends up showing five different indicators on the same player row, some of which may conflict.

**Why it happens:** Each signal was added independently to address a different research question (regression: over/underperformance; differential: ownership-relative value; verdict: squad management). Lifecycle labels are meant to synthesise these into a single forward-looking label. But if the synthesis is not explicit, they become additive noise.

**Consequences:** The GemTable row for a player shows: BUY (verdict), SELL (regression), DIFF (differential), "Sell soon" (lifecycle), "Fixture trap" (lifecycle). Five contradictory or overlapping badges. The user gives up.

**Prevention:**
- Position lifecycle labels as a replacement for (not addition to) the existing individual signals in the Decision Summary view. In the GemTable, keep only the existing signals. The lifecycle label appears only in the Decision Summary and the squad transfer context.
- Define lifecycle labels as a synthesis function: `computeLifecycleLabel(verdicts, regressionSignal, differentialFlag, minsRisk, fixtures) → LifecycleLabel`. The function must be deterministic and replace, not supplement, the individual inputs in the output.
- Document which existing signal wins when signals conflict (e.g., `regression_signal = 'sell'` overrides `differential_flag = 'diff'`).

**Phase to address:** Player Lifecycle Labels phase — explicitly map from existing signals to the new label taxonomy before any code is written.

---

### Pitfall 12: "Minutes trap" label misfires on rotation-risk players who start regularly

**What goes wrong:** `mins_risk = 'rotation_risk'` is assigned when `start_prob < 0.65`. But a player with `start_prob = 0.60` may start 3 out of 5 GWs — perfectly acceptable for a budget player. The "Minutes trap" lifecycle label fires on any `rotation_risk` player, even those who are solid value at their price point.

**Why it happens:** `mins_risk` was calibrated for the Transfer Suggestions engine, which de-prioritises rotation-risk buy candidates. It is a population-relative signal, not an absolute one. Applied to a lifecycle label, it implies the player is a liability even when they are a good budget option.

**Prevention:**
- Add a price-adjusted filter: "Minutes trap" should fire only when `start_prob < 0.65 AND now_cost > 70` (tenths, i.e., £7.0m+). Budget rotation-risk players (e.g., £4.5m) are expected to rotate — this is priced in.
- Cross-reference with `xPts_1gw / now_cost` ratio: if xPts per £m is above position average despite rotation risk, the player is still value — suppress "Minutes trap."
- Consider renaming to "Rotation concern" for players above £7.0m, where the premium price implies reliable minutes.

---

## Section 5 — Explainable xPts Breakdown

### Pitfall 13: Components do not sum to the displayed total

**What goes wrong:** `xPts_components_1gw` stores `{goal_pts, assist_pts, cs_pts, bonus_pts}` rounded to 3 decimal places. `xPts_1gw` is the `round(total, 2)` of the same computation. With rounding at different steps, `goal_pts + assist_pts + cs_pts + bonus_pts` (each rounded to 3dp) may not equal `xPts_1gw` (rounded to 2dp) when displayed.

**Why it happens:** `_compute_xpts_fixture()` in `merge.py` returns each component rounded to `round(v, 3)`. The total is rounded to `round(total, 3)`, then `_xpts_ngw()` rounds the accumulated total to `round(total, 2)`. Multi-fixture aggregation (DGW) sums component-level 3dp values and can accumulate small floating-point error.

**Concrete example:** `goal_pts=1.111 + assist_pts=0.333 + cs_pts=0.612 + bonus_pts=0.267 = 2.323` but `xPts_1gw = 2.32`. The displayed breakdown shows 2.323 summing to 2.32 — a 0.003 discrepancy visible in the UI.

**Consequences:** The user sees the breakdown components sum to a number different from the headline. They lose trust in the model's arithmetic.

**Prevention:**
- In the UI breakdown display, derive the sum from the stored components (not from `xPts_1gw`) and display that sum as the total. Never display both `sum(components)` and `xPts_1gw` simultaneously — pick one as the canonical value.
- If the deviation between `sum(components)` and `xPts_1gw` exceeds 0.05 for any player, log it as a pipeline quality warning.
- For DGW players with `xPts_components_1gw = null` (multi-GW components are not stored per `types.ts`), show "Detailed breakdown unavailable for DGW" rather than a partial breakdown.

**Detection:** Unit test: for every player in a mock pipeline run, assert `abs(sum(components.values()) - xPts_1gw) < 0.05`.

---

### Pitfall 14: Appearance points are not included in the breakdown

**What goes wrong:** The existing `xPts_components_1gw` breaks down `goal_pts`, `assist_pts`, `cs_pts`, `bonus_pts`. The FPL scoring system also awards 2 pts for playing 1-60 minutes and 3 pts for playing 60+ minutes. These appearance points are not modelled in `_compute_xpts_fixture()` — the engine relies on `xmins` scaling all components, but does not add the explicit appearance point contribution.

**Why it happens:** The original xPts engine design (Phase 28 `28-RESEARCH.md`) treated appearance points as implicit in the `xmins` scaling of all other components. This is a reasonable modelling simplification. But the breakdown UI claims to show "all the components of a player's xPts" — which it does not.

**Consequences:** The Explainable xPts Breakdown shows a player with `goal_pts=0, assist_pts=0, cs_pts=0, bonus_pts=0.3` implying their expected score is 0.3 pts. The user knows they will get at least 2 pts for playing. The model appears badly wrong.

**Prevention:**
- Add `appearance_pts: number` to `xPts_components_1gw`. Compute it as `2 * start_prob * xmins/90 + 1 * start_prob * (1 - xmins/60)` (approximate — 3pts for 60+ min, 2pts for 1-60 min, probability-weighted).
- Alternatively, acknowledge in the UI that "Appearance points are included in the per-minute scaling of all components and are not separately shown." Either approach is acceptable; silence is not.

**Phase to address:** Explainable xPts Breakdown phase — resolve the missing appearance component in the spec before the UI design is finalised.

---

### Pitfall 15: Overwhelming detail in the breakdown UI

**What goes wrong:** The breakdown shows 4-5 numeric components per player. For a GK (likely to have `goal_pts=0, assist_pts=0, cs_pts=3.2, bonus_pts=0.3`), the detail is useful. For a MID/FWD, the useful components are goal and assist, while cs_pts is near-zero noise. Showing all 4 components for every player in a dense table creates cognitive load without proportional value.

**Prevention:**
- For GK/DEF: emphasise `cs_pts` and `bonus_pts`. Suppress `goal_pts` and `assist_pts` if both are < 0.10.
- For MID/FWD: emphasise `goal_pts` and `assist_pts`. Suppress `cs_pts` if it is < 0.10.
- Use a visual bar (proportional to component magnitude) rather than raw numbers. The bar communicates relative composition immediately; the number is a hover tooltip.
- This reuses the `XPtsCell` tooltip pattern already in the codebase — extend it rather than creating a new component.

---

## Section 6 — Clean Sheet Probability

### Pitfall 16: Conflating team-level CS% with individual player CS probability

**What goes wrong:** The pipeline computes `_cs_prob(defensive_difficulty, xmins)` at the player level, but the underlying model is effectively a team-level CS probability modified by xmins. A GK and a DEF on the same team with identical `xmins` receive identical `cs_prob`. This is correct mathematically, but the displayed "Clean Sheet Probability" will show the same value for all players on a team — which makes it appear like a team stat, not a player stat.

**Why it happens:** CS in FPL is awarded per team result. CS probability fundamentally is a team-level event. The player-level adjustment is only `xmins` (did they play the full game?). The existing `_cs_prob()` formula correctly models this.

**Consequences:** The CS Probability feature appears to add no per-player intelligence. The GK at 30% CS probability and the first-choice CB at 30% CS probability are identical, even though the CB may be more likely to play the full 90.

**Prevention:**
- Present CS probability as a team-level stat, grouped by team, with per-player modification for `start_prob` and `xmins`.
- The displayed figure for a player should be: `cs_prob_team * (xmins / 90)` — explicitly showing the minute-scaling adjustment.
- Add a footnote: "CS probability is team-level. Individual probability adjusts for expected minutes played."
- Do not imply that a GK and a CB on the same team have different inherent CS probabilities — they do not in this model.

---

### Pitfall 17: Small sample size in the defensive_difficulty rolling average

**What goes wrong:** `_compute_offensive_difficulty_score()` in `merge.py` uses a 3-game rolling window for goals-scored. At the start of the season (GW1-GW3), this window contains 1-3 data points. A team that conceded a fluke 4-0 in their first game has a `defensive_difficulty = 1.0` (hardest) and every DEF/GK on that team receives a near-zero `cs_pts` for the next 3 GWs. By GW4, the anomaly is diluted.

**Why it happens:** A 3-game window is a deliberate design choice for responsiveness (see `merge.py` comment: "Phase 27 DATA-01 D-02"). Responsiveness trades off against stability.

**Consequences:** Early-season CS probability figures are unreliable. A player newly flagged as "great CS prospect" may have a `defensive_difficulty` biased by one anomalous result.

**Prevention:**
- Add a `sample_size: number` field to the CS probability output when surfaced in the UI. For teams with fewer than 5 games played, show a warning: "Limited data — CS probability estimate may be unreliable."
- Consider extending the rolling window to 5 for CS probability specifically (separate from the existing 3-game `defensive_difficulty` used in xPts). This gives more stable CS% for the dedicated CS feature without disrupting the xPts calibration.
- At season start (GW1-GW5), fall back to the FPL official defensive difficulty rating as a prior for the rolling window initialisation.

---

### Pitfall 18: BGW distortion of CS probability display

**What goes wrong:** A team with a BGW has no fixture in the target GW. Their `cs_prob` for that GW is effectively 0 (no game = no CS). But the CS Probability panel may display their season-average or rolling CS% without flagging the blank. The manager reads "40% CS chance" and starts their GK without checking the fixture list.

**Why it happens:** The `xPts_components_1gw` is `null` for BGW players (per the existing BGW exclusion in `optimiseLineup()`), but a standalone CS Probability panel may compute independently from the `defensive_difficulty` rolling average without BGW awareness.

**Prevention:**
- Before computing or displaying any CS probability for a player, check `fixtures.filter(f => f.event_id === targetGw).length > 0`. If zero, display `—` (no fixture) rather than a percentage.
- Add a BGW badge to any team/player in the CS panel who has no fixture in the target GW.
- The CS panel must read from the same `fixtures` array used by the xPts engine — do not compute CS% from rolling averages alone.

---

### Pitfall 19: CS probability contradicting the existing `cs_pts` in xPts breakdown

**What goes wrong:** The Explainable xPts Breakdown shows `cs_pts = 1.8` for a DEF (30% team CS × 6 pts). The dedicated Clean Sheet Probability panel for the same player shows "30% CS chance." These numbers are mathematically consistent but the user sees "1.8 pts" and "30%" and is unsure if they are measuring the same thing.

**Why it happens:** The user's mental model of CS probability is "will they keep a clean sheet?" (yes/no percentage). The xPts `cs_pts` component is "expected points from CS" (probability × FPL points). They are the same model rendered in different units.

**Prevention:**
- In both the xPts breakdown and the CS probability panel, show the intermediate computation: "30% CS chance → 1.8 expected pts (6pts × 30%)." Make the formula explicit.
- Use consistent terminology: "CS probability" always means the percentage; "CS contribution" always means the expected points. Never use the same label for both.

---

## Section 7 — Integration Pitfalls (Cross-Feature)

### Pitfall 20: Decision Summary horizon mismatch with Squad Optimiser horizon

**What goes wrong:** The Squad Optimiser (v1.6) has a configurable 1/3/5 GW horizon for `optimiseLineup()`. The Decision Summary uses a fixed horizon to produce its captain, transfer, and bench recommendations. If the Decision Summary defaults to 1 GW but the user has the Optimiser set to 5 GW, the two panels recommend different players for the same positions.

**Prevention:**
- Lift the active horizon into shared state (e.g., via a context provider or a URL query param) so that all decision features use the same horizon simultaneously.
- Alternatively, make the Decision Summary horizon-independent by showing the recommendation for the 1 GW horizon only (next-GW decisions) and labelling it explicitly. The user adjusts the Optimiser horizon separately for multi-GW planning.

---

### Pitfall 21: Player Lifecycle Labels redundant with existing Planner output

**What goes wrong:** The Gameweek Planner (v1.3) already produces a 1-5 GW transfer sequence with BUY/SELL recommendations per GW. Lifecycle labels like "Buy next week" or "Sell soon" duplicate the Planner's output for the common case (1-2 GW horizon). The user sees the same recommendation in two places, expressed differently.

**Prevention:**
- Scope lifecycle labels to players outside the Planner's active transfer window — they are best used for players the Planner is not already recommending. If the Planner has "Sell [Player X] in GW+1", the lifecycle label for Player X should say "Sell soon" but link to the Planner output rather than presenting an independent recommendation.
- Do not build lifecycle labels as a standalone engine if the Planner already covers the same ground. Instead, derive the label from `planResult.steps` when a plan is active: the Planner's output is more sophisticated (multi-step, FT-aware) than a lifecycle heuristic.

---

### Pitfall 22: Pipeline output schema changes breaking downstream Decision features

**What goes wrong:** Each v1.7 feature requires new fields in `merged_players.json` or new JSON outputs from the pipeline. The existing `MergedPlayer` TypeScript interface in `types.ts` already has 40+ fields. Adding CS probability, lifecycle label inputs, and fixture swing data as new fields — without a versioning strategy — risks breaking the Zod schema validation in `fpl-adapter.ts` and causing stale-cache fallback on first pipeline run.

**Why it happens:** This project's pattern (from Key Decisions in `PROJECT.md`) is to add optional fields (`?:`) to `MergedPlayer` during pipeline rollout. This is the correct pattern. The risk is forgetting the optional guard or the Zod schema update.

**Prevention:**
- All new fields added to `merged_players.json` must be declared as optional (`?`) in both the `MergedPlayer` TypeScript interface and the Zod schema simultaneously.
- New JSON outputs (e.g., `fixture_swings.json`, `lifecycle_labels.json`) must have a seeded empty version committed to `pipeline/cache/` before the pipeline writes to it. This prevents 500 errors on the first pipeline run (per the pattern established in Phase 33 for `insights.json`).
- After each pipeline change, verify: `cat pipeline/cache/[new-file].json | python -m json.tool` produces valid JSON (empty `{}` or `[]`, not absent).

---

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Mitigation |
|-------------|----------------|------------|
| Transfer Opportunity Cost Simulator | FT count sourced from UI default instead of `my-team` | Read `ftCount` from authenticated `my-team` API; UI selector only for unauthenticated state |
| Transfer Opportunity Cost Simulator | Rolling shows as universally beneficial | Show deferral cost explicitly: "Rolling costs ~X xPts if this transfer is still available next week" |
| Transfer Opportunity Cost Simulator | Break-even inconsistent across horizon toggle | Compute `breakEvenGws` from 1 GW rate only; label horizon-relative caveat |
| Transfer Opportunity Cost Simulator | 2-FT additive combo over-promise | Flag combo gains within 1.0 xPts of hit break-even as "marginal — verify" |
| Weekly Decision Summary | Engine conflicts (SELL vs HOLD for same player) | Implement priority hierarchy: Transfer engine overrides Verdict engine for the same player in the summary |
| Weekly Decision Summary | Information overload | Hard limit: 4 outputs (captain, transfer, bench, chip). No inline expansion. |
| Weekly Decision Summary | Cross-query staleness | Track oldest source timestamp; "Refresh all" button invalidates all query caches |
| Fixture Swing Detector | Alert fires on 12+ teams from noise | Delta threshold ≥ 0.20 on 3 GW ease; max 4 improving + 4 worsening surfaces |
| Fixture Swing Detector | DGW double-counting in ease aggregate | Group fixtures by `event_id`; average per GW, not per fixture entry |
| Player Lifecycle Labels | Weekly label instability / flipping | Hysteresis bands; require signal to cross wider threshold before label changes |
| Player Lifecycle Labels | Overlap with existing 4 signal systems | Labels replace (not add to) existing signals in Decision Summary; synthesis function with explicit priority map |
| Player Lifecycle Labels | "Minutes trap" misfires on cheap rotators | Price-gate: fire only above £7.0m; cross-reference xPts-per-£m ratio |
| Explainable xPts Breakdown | Components don't sum to displayed total | Display sum-of-components as the total; never show both sum(components) and xPts_1gw simultaneously |
| Explainable xPts Breakdown | Appearance points missing from breakdown | Add `appearance_pts` component or document its absence explicitly in the UI |
| Explainable xPts Breakdown | DGW players show null components | "Detailed breakdown unavailable for DGW" — do not show partial breakdown |
| Clean Sheet Probability | Team-level stat appears per-player | Group by team; individual modification for xmins; add explicit formula annotation |
| Clean Sheet Probability | Early-season small sample bias | Show `sample_size` warning for teams with < 5 games; consider 5-game window for CS vs 3-game for xPts |
| Clean Sheet Probability | BGW team shown with non-zero CS% | Check `fixtures.filter(f => f.event_id === targetGw).length > 0` before displaying any CS% |
| All pipeline changes | New fields break Zod schema | All new fields optional in both TS interface and Zod schema; seed empty cache files before pipeline runs |
| Decision Summary + Optimiser | Horizon mismatch between panels | Lift active horizon to shared state; or pin Decision Summary to 1 GW with explicit labelling |

---

## Sources

- Codebase inspection: `src/lib/suggest-transfers.ts`, `src/lib/optimise-lineup.ts`, `src/lib/recommend.ts`, `src/lib/explain.ts`, `src/lib/chip-strategy-engine.ts`, `src/lib/club-form.ts`, `src/lib/free-transfer-engine.ts`, `src/lib/types.ts`, `pipeline/merge.py`
- Project context: `.planning/PROJECT.md` — existing engine invariants and Key Decisions table
- Prior art pitfall: v1.6 PITFALLS.md pitfalls on BGW exclusion, sell-price haircut, stale xPts, FT bank modelling — all integration risks that carry forward to v1.7 decision features
