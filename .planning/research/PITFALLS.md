# Domain Pitfalls — v1.9 Competitive Intelligence

**Domain:** FPL Analyst — adding MTP-01 (Manual Transfer Planner), ML-01 (Mini-League Rival Tracker), EO-01 (Effective Ownership), and TREE-01 (Transfer Route Tree) to an existing FPL analytics app.
**Researched:** 2026-05-03
**Source confidence:** HIGH on FPL sell price rules (premierleague.com official + community sources agree); HIGH on FT banking rule changes (official PL announcement for 2024/25); HIGH on integration pitfalls (verified against `src/lib/free-transfer-engine.ts`, `src/lib/planning-engine.ts`, `src/lib/types.ts`); MEDIUM on FPL API undocumented behaviours (community research, unconfirmed by official docs); MEDIUM on EO approximation limits (community reverse-engineering).

This document catalogues mistakes that will cause v1.9 features to ship broken or to silently corrupt downstream consumers. Pitfalls are scoped to features being **added to this existing system** — generic software engineering advice is not the focus.

---

## Critical Pitfalls

These cause silent financial simulation errors, misleading UI, or broken integration with existing engines. Address in the corresponding phase or they will leak into shipped code.

### Pitfall C1: free-transfer-engine.ts implements the pre-2024/25 FT banking rules

**Phase:** MTP-01, TREE-01

**What goes wrong:** The 2024/25 FPL season introduced two breaking rule changes ([official PL announcement](https://www.premierleague.com/en/news/4058895)):

1. **FT bank cap raised from 1 to 4** — managers can now accumulate up to 5 free transfers (1 weekly + 4 banked), not the old cap of 2. Yet `computeNextFTState` in `src/lib/free-transfer-engine.ts` has `Math.min(1, unused)` on line 20 (normal GW path) and `Math.min(1, currentAvailable - 1)` on line 14 (Free Hit path), both capping bank at 1. Any MTP-01 simulation starting from a state where the user has 3+ FTs will immediately be wrong.

2. **Wildcard and Free Hit no longer reset banked transfers** — under the old rule, using WC/FH forfeited all banked FTs. Since 2024/25, banked FTs are preserved through chip plays. Yet the wildcard path in `computeNextFTState` (line 10) unconditionally returns `{ available: 1, banked: 0 }`, discarding all banked transfers. A TREE-01 path that includes a wildcard step will silently undercount FTs for every subsequent step.

**Why it happens:** The FT engine was written during v1.3 (2026-04-29), before the 2024/25 rule change was identified as a gap. The v1.7/v1.8 work reused this engine without re-auditing the rules.

**Consequences:**
- MTP-01 financial simulation shows fewer FTs than the user actually has — suggests unnecessary hits.
- TREE-01 paths through wildcard nodes underestimate FTs in all downstream steps, making hit-heavy paths look worse than they are.
- PlannerTab (v1.3) has the same bug but it only affects users with >1 banked FT; it was never caught because the UI defaults `initialFTState = { available: 1, banked: 0 }` (line 55 of PlannerTab.tsx), masking the engine bug with a conservative input.

**Prevention:**
- Fix `computeNextFTState` before writing any MTP-01 code:
  - Normal GW: `const banked = Math.min(4, unused)` (cap at 4 banked, max 5 available)
  - Wildcard: preserve banked transfers — `return { available: 1 + Math.min(4, currentAvailable - 1), banked: Math.min(4, currentAvailable - 1) }`
  - Free Hit: same as wildcard (banked transfers preserved through chip play)
- Update `FTState.banked` JSDoc in `types.ts` to state the range is now 0–4.
- Write regression tests: start with 4 banked, use wildcard, assert 5 available next GW.
- Fix the PlannerTab `initialFTState` default — it should read from `entry_history.event_transfers` and `entry_history.bank` to derive actual FT state, not assume 1.

**Detection:** Unit test `computeNextFTState({ available: 5, banked: 4 }, 0, null)` — should return `{ available: 5, banked: 4 }`. Currently returns `{ available: 2, banked: 1 }`.

---

### Pitfall C2: Sell price ≠ buy price — asymmetric profit formula

**Phase:** MTP-01

**What goes wrong:** FPL sell price is calculated as:

```
sell_price = buy_price + floor((current_price - buy_price) / 2 × 10) / 10
```

Key consequences:
- A player bought at £6.0m now worth £6.3m sells for **£6.1m** (not £6.3m — you only get half the rise, rounded down).
- A player bought at £6.0m now worth £5.9m sells for **£5.9m** (full loss — falls are not halved).
- A player bought at £6.0m still worth £6.0m sells for **£6.0m** (no change — correct).
- A player bought at £6.0m now worth £6.1m sells for **£6.0m** (£0.1m rise gives zero profit — the halving rounds down to zero).

The existing `generatePlan()` and `generateChipStep()` already have a `sellPrices` parameter and use `MyTeamPick.selling_price` from the authenticated endpoint — this is correct. **The trap is in MTP-01's manual entry mode**, where the user inputs players without auth. If MTP-01 defaults to `now_cost` as the sell price (like the unauthenticated path in `planning-engine.ts` line 105), the budget simulation will overestimate sell proceeds for players who rose and underestimate for players who fell.

**Why it happens:** `selling_price` is only available from `/api/my-team/` (requires auth cookie). The unauthenticated public endpoint (`entry/{id}/event/{gw}/picks/`) does not include sell prices — the Zod schema (`SquadPicksResponseSchema` vs `MyTeamResponseSchema`) explicitly separates these two shapes. MTP-01's manual mode has no authenticated source to pull from.

**Consequences:** User inputs a manual plan, sees a budget of £2.5m, believes they can afford a player at £8.2m, but actual sell proceeds are £8.0m (the player rose) and they'd actually be £0.2m short. The MTP-01 UI would not flag this.

**Prevention:**
- In MTP-01 manual mode, show a sell price input field per player (pre-populated from `selling_price` if auth available, otherwise defaulting to `now_cost` with a visible warning: "Using current price as sell price — log in for exact sell prices").
- Use a helper function `computeSellPrice(buyPrice, currentPrice): number` that implements the floor formula — do not inline this arithmetic.
- Display sell price vs buy price as distinct columns in MTP-01's player table. The difference is the "locked profit/loss" that affects budget.
- Never use `now_cost` silently as sell price in a budget simulation. Either use authenticated `selling_price` or show the caveat prominently.

**Detection:** Test `computeSellPrice(60, 63) === 61` (not 63). Test `computeSellPrice(60, 59) === 59` (full loss). Test `computeSellPrice(60, 61) === 60` (zero gain despite £0.1m rise).

---

### Pitfall C3: FPL `entry/{id}/event/{gw}/picks/` returns the previous GW's squad before a manager confirms this week's picks

**Phase:** ML-01

**What goes wrong:** The FPL picks endpoint is keyed by `event_id` (gameweek number). For a rival who has **not yet confirmed their squad** for the current GW (i.e. before the deadline), querying `entry/{id}/event/{current_gw}/picks/` will return a 404 or the last confirmed squad (the previous GW). The API has no field that tells you whether the picks you received are from this GW or the previous one.

This is distinct from the "stale rival squad" issue — it's a structural limitation: the API only surfaces confirmed squads. A rival's pre-deadline pending transfers are invisible.

**Consequences:**
- ML-01 shows a rival as owning players they've already transferred out.
- Differential intelligence (players the user owns that rivals don't) is wrong.
- "Blocking vs attacking move" flags are wrong — you think a rival owns your target when they've already sold them.

**Prevention:**
- Always query picks for `current_gw - 1` (the last **finished** GW) rather than the current live GW — this is deterministic and confirmed.
- If you want this-GW data, display a banner: "Rival squads as of GW{n} deadline — picks made after that deadline are not visible."
- Cross-reference the `entry_history.event` field in the response to detect if the returned data is from the expected GW. If `response.entry_history.event !== target_gw`, show a "squad not yet confirmed" indicator for that rival.
- Use the `is_current` and `finished` flags from the bootstrap `events` array to determine the last confirmed GW correctly.

**Detection:** Integration test with a known team ID: query picks for an upcoming GW before the deadline and verify the `entry_history.event` field in the response matches the target GW.

---

### Pitfall C4: Parallel fetching of N rival picks triggers rate-limiting on the FPL API

**Phase:** ML-01

**What goes wrong:** ML-01 needs to fetch:
1. `leagues-classic/{league_id}/standings/` — paginated, 50 results per page, multiple pages for 100+ rival leagues.
2. `entry/{id}/event/{gw}/picks/` — one request per rival.

A league with 20 rivals requires 20 parallel picks requests. A league with 100 requires 100. The FPL API has no documented rate limit, but community experience is that firing 20+ parallel requests from a single IP causes transient 429s or connection resets — especially from a Vercel serverless function where the outbound IP may be shared across deployments.

The current proxy `[...proxy]/route.ts` fires single requests (`next: { revalidate: 0 }`) with no concurrency throttle. Routing 50 picks requests through it simultaneously will likely result in some returning 502 errors (the proxy already catches these — line 36).

**Consequences:** ML-01 shows an incomplete rival list. Some rivals have squads, others show "squad unavailable" errors. The errors are non-deterministic (varies by load), making the feature feel unreliable rather than surfacing a clear message.

**Prevention:**
- **Client-side sequential or batched fetching:** use a `pLimit(3)` or similar concurrency limiter (available via `p-limit` — already may be in the dependency tree) to fetch rival picks in batches of 3 at a time.
- **Cap total rivals at 20:** for a personal tool, cap ML-01 to the top 20 rivals by league position. This keeps total requests to 20 and eliminates the scaling problem.
- **Server-side aggregation route:** create a single `/api/rival-squads?league={id}&gw={n}` route that fetches all picks server-side, handles retries internally, and returns a single JSON payload. The UI makes one request. The route uses sequential fetches with a 100ms delay between requests to avoid burst.
- **Exponential backoff on 429:** the proxy route should detect 429 responses and include a `Retry-After` header passthrough rather than immediately returning 502.
- **Cache the league standings for the session:** once fetched, standings don't change mid-session. Use TanStack Query with a 30-minute `staleTime` for standings data to avoid refetching on every tab switch.

**Detection:** Test with a 50-member league. Measure how many requests succeed vs fail. Assert >95% success rate with concurrency limited to 3.

---

### Pitfall C5: `selected_by_percent` is overall ownership, not top-10k ownership — EO% will be systematically wrong for any differential player

**Phase:** EO-01

**What goes wrong:** `selected_by_percent` on the FPL bootstrap element is the ownership percentage across **all 10+ million FPL managers**. Top-10k ownership is consistently different:
- High-ownership template players (Salah, Haaland) have similar ownership at all levels.
- Differentials owned by 3% overall may be owned by 8–12% in the top 10k (smart money moves earlier).
- Popular cheap enablers may be at 40% overall but only 15% top-10k (mass market picks avoided by serious managers).

EO-01's spec says "EO% per player (estimated ownership among top 10k, not overall ownership)" but the only available data field is `selected_by_percent`. The approximation is non-trivial and skewed in the direction that matters most — differential players are the ones where EO matters for rank protection, and they're exactly the ones where the approximation is worst.

**Why it happens:** Top-10k ownership data requires either scraping the top-10k league standings (ML-01 infrastructure), or using community tools (LiveFPL, FPLAnalytics) that aggregate this. The FPL API has no first-class endpoint for it.

**Consequences:**
- EO-adjusted captain recommendations show the wrong captain as "rank protecting."
- "Dangerous to fade" labels fire on players who 3% own but top-10k barely own — giving false urgency.
- A player labelled "high upside differential" may actually be widely held by top-10k managers, making it a rank-neutral pick rather than rank-chasing.

**Prevention:**
- Be explicit about what EO-01 is computing: label the field `overall_ownership_pct` in the data, not `eo_pct`. The UI can display "~EO (approx.)" with a tooltip explaining the approximation.
- If ML-01 is built in the same milestone, use it: compute **actual top-N rival ownership** from the fetched rival squads. This is true EO for the user's mini-league context, which is actually more useful than population-level EO. Label it "Your league EO%."
- If using `selected_by_percent` as a proxy, apply a documented skew correction: high-ownership players (>20%) are close to accurate; mid-ownership (5–20%) skew toward being higher in top-10k; low-ownership (<5%) are often 2× higher in top-10k. Frame this as an approximation with uncertainty, not a precise figure.
- Never present overall ownership as "top-10k EO" without a caveat. This would be actively misleading for the differential player decisions where EO matters most.

**Detection:** Compare `selected_by_percent` against the LiveFPL top-10k ownership table for 5 test players. Document the mean absolute error for the approximation.

---

### Pitfall C6: TREE-01 combinatorial explosion with FT bank accumulation creates exponential path counts

**Phase:** TREE-01

**What goes wrong:** TREE-01 generates branching multi-week transfer paths. The naive branching factor is:
- GW1: transfer (0, 1, 2 transfers, or chip) × top-N candidates = many paths.
- GW2: for each GW1 outcome, repeat.
- GW3: for each GW2 outcome, repeat.

With the fixed-2-FT old rule, the branching was bounded: max 2 transfers per GW from a small pool. With the corrected 5-FT bank rule (Pitfall C1 fix), a manager with 5 banked FTs in GW1 could make 5 transfers — from 15 sell candidates × top-20 buys per position = hundreds of combinations **per transfer**, with 5 transfers that's intractable.

Even without the 5-FT edge case: if TREE-01 considers {0, 1, 2} transfers each GW with the top-5 candidates for each transfer count, that's roughly 11 paths per GW × 11 × 11 = 1,331 leaf nodes for a 3-GW tree. The existing `generatePlan` already does greedy selection (max 1 transfer per step), not a full tree search.

**Consequences:** TREE-01 either:
- (a) Tries to enumerate all paths → freezes the browser tab on any realistic input.
- (b) Uses the same greedy algorithm as `generatePlan` → only generates 1 path, not a branching tree, making TREE-01 misleading in name.

**Prevention:**
- Define TREE-01's scope explicitly: "show the top 3–5 distinct paths" not "show all paths." Use a beam search: at each GW step, keep only the top K paths by cumulative xPts, prune the rest.
- Bound the branching factor: for each path-step, consider at most `{roll, 1-FT best, 2-FT best, chip}` — that's 4 branches per step, not N×M combinations. The "best 1-FT" is already computed by `generatePlan`. TREE-01 adds the branching **between these top-level choices**, not within them.
- Hard cap on chip branching: if a wildcard is played in step 1, the squad is restructured — TREE-01 should show this as a distinct sub-tree with a "WC applied" badge and re-run `generateChipStep` to populate it, not branch further within the WC sub-tree.
- Compute paths lazily: only generate GW2 branches for the top-3 GW1 paths, only generate GW3 branches for the top-3 GW2 paths per GW1 parent.

**Detection:** Time the tree generation on a real squad with `console.time`. Assert it completes in <500ms. If it takes >2s, the branching factor is too high.

---

## Moderate Pitfalls

### Pitfall M1: xPts projection accuracy degrades rapidly beyond 2 GWs — TREE-01 paths scored at 3-GW horizon will rank incorrectly

**Phase:** TREE-01

**What goes wrong:** The existing `xPts_1gw` values are computed from fixture difficulty × goal/assist/CS Poisson models. These already have noise: the Phase 40/41 accuracy pipeline shows 16.7% hit rate for haulters (5-GW backtest). Over 3 GWs, errors compound and fixture schedules have higher uncertainty (player injuries, rotation changes, team form shifts). A path that looks £4 better over 3 GWs than an alternative may actually be within the noise band of the model.

**Consequences:** TREE-01 presents a false precision: "Path A scores 42.3 xPts, Path B scores 41.1 xPts — choose Path A." The 1.2 xPts difference at 3 GWs is well within model error. The user may make suboptimal decisions based on spurious precision.

**Prevention:**
- Display xPts per path as ranges, not point estimates. Use existing `xPts_90th_1gw` per player to compute a path ceiling alongside the path mean.
- Add a caveat label: "GW3 projections have high uncertainty — consider the 1-GW view for near-term decisions."
- Weight the path score with a discount factor for future GWs (matching the existing `LOOK_AHEAD_DISCOUNT = 0.8` in `planning-engine.ts`).
- Do not rank paths where the delta is less than 2 xPts over the 3-GW horizon — call them "roughly equivalent."

**Detection:** Compare two paths that both keep the same squad for GW1 but differ in GW3. If TREE-01 ranks one above the other solely on GW3 xPts, the discount factor is too low.

---

### Pitfall M2: Mode toggle state for EO-01 leaking across sections

**Phase:** EO-01

**What goes wrong:** EO-01 introduces a strategy mode toggle (Max xPts / Protect Rank / Chase Rank / Differential Aggressive). This toggle needs to affect captain recommendations, transfer suggestions, and potentially the bench order. If this state is lifted to the wrong level (too high = global, too low = component-local), it either:
- (a) Resets whenever the user navigates away (if stored in a tab-local component state).
- (b) Unexpectedly changes behaviour in unrelated sections (if stored at page level without clear ownership).

The existing `gemPreset` state in `page.tsx` (the view preset for GemTable) is a prior example of state that needed lifting — it was originally component-local and had to be moved to persist across sub-tab navigation (v1.5 GEM-04).

**Consequences:** User sets "Protect Rank" mode, navigates to Club Form tab, returns to Squad tab — mode is reset to default. Or worse, the mode state persists in a way that silently changes the captain recommendation card in the Decision Summary section.

**Prevention:**
- Use localStorage persistence for the EO mode toggle (same pattern as `gemPreset` and `fpl_team_id`).
- Scope the mode effect explicitly: document which UI surfaces respond to the mode toggle and which do not. The EO mode should affect: captain EV display, transfer suggestion framing, ownership impact labels. It should **not** affect: xPts values (these are mode-independent), GemTable sorting, historical data displays.
- Give the mode a clear default ("Max xPts") that matches current pre-EO-01 behaviour — so the feature adds on top without changing the default experience.
- If the mode affects the Decision Summary, add a visible badge to the Decision Summary header: "Mode: Protect Rank" — so the user always knows what mode is active.

**Detection:** Navigate away and back. Assert mode persists. Assert that xPts column values do not change between modes (mode affects display framing, not model outputs).

---

### Pitfall M3: Captain EV adjustment for EO-01 creating confusing signal when combined with existing xPts display

**Phase:** EO-01

**What goes wrong:** The existing `CaptainPicksPanel` (Phase 31) shows `xPts_1gw` and `xPts_90th_1gw` per captain candidate, sorted by raw expected points. EO-01 wants to add an "EO-adjusted captain EV" — which is not a different xPts value but a **rank movement expectation** (e.g., "captaining player X when 55% of managers captain him gives you +0 expected rank movement; captaining Y at 3% EO gives you +12k expected rank positions if he hauls").

These are fundamentally different numbers: one is expected fantasy points, the other is expected rank movement. Displaying them in the same component or the same column risks the user confusing "EO-adjusted xPts" (which doesn't exist) with rank-movement score.

**Consequences:** User believes the EO-adjusted number is a modified xPts value and uses it to evaluate the player's raw scoring potential. Or user ignores it because they don't understand what the column represents. Either outcome dilutes the feature value.

**Prevention:**
- Use distinct labels and units: "xPts" for expected points, "Rank EV" or "Rank delta" for EO-adjusted captain score. Never put both in a column called "xPts (EO-adjusted)."
- The EO-adjusted captain card should be a separate section from the existing CaptainPicksPanel, not an extension of it. Model it after the existing 2-card layout (ceiling / EO-adjusted) — but make the EO card clearly labelled "Rank protection" or "Differential pick."
- Add a tooltip on the EO-adjusted captain score explaining the calculation: "Expected rank movement vs field based on ownership% and captain xPts."

**Detection:** User test (informal): can you explain what the number means? If not, the label is wrong.

---

### Pitfall M4: MTP-01 hit cost display getting out of sync with FT bank state during multi-step simulation

**Phase:** MTP-01

**What goes wrong:** In MTP-01, the user manually sequences GW-by-GW transfers. The hit cost display for each GW step depends on the FT state at that step, which is the cumulative result of all prior steps. If the user edits an earlier step (e.g., adds a transfer to GW1), all subsequent hit costs must recompute. This is the same problem `ftStateAfterStepIndex()` solves in `planning-engine.ts` for the automated planner.

If MTP-01 implements hit cost display without replaying the full FT state from step 0 on every edit, it will show stale hit costs. A user who rolls GW1, rolls GW2, then makes 3 transfers in GW3 would see GW3 cost as "one hit (-4 pts)" but actually have 3 banked FTs and pay 0 pts.

**Consequences:** User plans a sequence that shows 3 hits at -12pts, but the actual hit count is 0. Or vice versa. The financial simulation is the core value of MTP-01 — if it's wrong, the feature is actively harmful.

**Prevention:**
- Reuse `ftStateAfterStepIndex()` directly from `planning-engine.ts` — do not reimplement FT state replay in MTP-01.
- The MTP-01 state model should be: `{ steps: ManualStep[] }` where each step is rendered by replaying the full FT chain from `initialFTState`, not by storing a per-step FT snapshot that can drift.
- Use Immer for the steps array (same `useImmer` pattern as PlannerTab) — mutations are safe, but always recompute derived values (hit cost, bank balance) from the full chain on any edit.
- Derive bank balance after each step as `bankBalance - sum(buyCosts) + sum(sellPrices)` replayed from step 0, not as an incrementally updated value that can accumulate drift.

**Detection:** Test: set up a 3-GW sequence where GW1 and GW2 roll (0 transfers), and GW3 uses 3 transfers. Verify FT bank at GW3 is 5 available (1 weekly + 2 banked from GW1 + 2 banked from GW2, capped at 5), hit cost is 0, not -8 pts.

---

### Pitfall M5: Wildcard chip in TREE-01 making branching meaningless for that sub-tree

**Phase:** TREE-01

**What goes wrong:** When a wildcard is included in a TREE-01 path, the "squad after wildcard" is a near-optimal restructure of 15 players. This means:
- The post-WC squad has no meaningful relationship to the pre-WC squad.
- The "transfer savings" framing ("you'll need fewer hits in GW3 if you WC now") is replaced by a completely different squad structure.
- GW2 and GW3 branches off a WC step in GW1 are based on a different starting squad than all non-WC paths — they cannot be compared on a xPts-delta basis.

Additionally, if TREE-01 generates WC sub-paths by branching further (considering 15 possible transfer combinations from the new WC squad), it creates a combinatorial explosion (Pitfall C6 interaction).

**Consequences:** TREE-01's comparison table shows paths that are incommensurable: one is "roll, roll, hit" from current squad, another is "WC now, roll, roll" from a completely different squad. The user sees different xPts totals but doesn't understand they're looking at entirely different future squads. Decision quality suffers.

**Prevention:**
- Treat WC (and FH) as a **separate top-level path**, not as a branch within the main tree. Present it as: "Option A: Normal transfer path (no chip)" and "Option B: Wildcard now." These are displayed side-by-side, not as branches of a shared tree.
- For the WC option, show the projected new squad (from `generateChipStep`) and its xPts, but clearly label it "Squad after WC" and do not branch further.
- FH is a one-GW special case — show projected FH xPts for GW1 only, then the reverted squad for GW2+.
- BB and TC do not change the squad, so they fit naturally into branch paths and don't need special handling.

**Detection:** Verify that a TREE-01 result containing a WC path shows the post-WC squad explicitly and does not have sub-branches from the WC node.

---

### Pitfall M6: ML-01 rival squad data not respecting GW boundary — fetching picks for a live GW during live scoring

**Phase:** ML-01

**What goes wrong:** During a live GW (after the deadline but before all matches complete), the `entry/{id}/event/{gw}/picks/` endpoint returns the confirmed squad but `active_chip` may change (chip played post-deadline is visible in the live scoring API), and `entry_history` values (event_total, points, rank) are provisional. More critically, the live-points endpoint (`event/{gw}/live/`) data drives actual scoring, but the picks endpoint only shows the static squad — autosubs applied during the GW are only visible in a different endpoint.

ML-01 shows rival captain and chip status. If queried mid-GW: the captain is the pre-deadline captain, not the effective captain after autosubs.

**Consequences:** "Rival captain is Player X" is wrong if Player X got injured in the first match and the autosub VC is now the effective captain. This makes differential analysis ("I'm differentiating against rivals by captaining Y") incorrect mid-GW.

**Prevention:**
- ML-01 is framed as a **pre-deadline planning tool** — it should only be used before the GW deadline, not mid-GW.
- Add a UI guard: if `events.find(e => e.is_current && !e.finished)` is true (live GW in progress), show a banner: "Live GW in progress — rival data reflects pre-deadline picks and may not account for autosubs."
- Use the last **finished** GW for rival squad analysis as the reliable data source for squad structure, captain history, and chip usage.

**Detection:** Mock the bootstrap event object with `is_current: true, finished: false`. Assert the live-GW warning banner renders.

---

## Minor Pitfalls

### Pitfall m1: MTP-01 break-even week calculation needs to account for FT bank value

**Phase:** MTP-01

**What goes wrong:** The existing `TransferSuggestion` type and `suggestTransfers()` compute `breakEvenGws = ceil(4 / xPtsGainPerGw)` for hit transfers. MTP-01 should also display break-even for hits, but the calculation ignores the opportunity cost of spending a banked FT. A hit taken when you have 2 FTs available is different from a hit taken when you have 1 FT — the banked FT has option value (you could have rolled it to give yourself 2 FTs next GW instead).

**Prevention:** For now, keep the same `ceil(hitCost / xPtsGainPerGw)` formula. Add a note to MTP-01 plan: break-even ignores FT option value. Revisit in SENS-01 (sensitivity analysis feature from backlog).

---

### Pitfall m2: React state mutation when editing MTP-01 steps out-of-order (non-sequential edits)

**Phase:** MTP-01

**What goes wrong:** If the user edits GW3 before GW2, the financial state at GW3 depends on GW2 which hasn't been set yet. If the state management naively applies edits in isolation without a full re-derive, GW3 sees a stale bank balance.

**Prevention:** Use the same replay pattern from `ftStateAfterStepIndex()` — always derive all step states from scratch from `initialFTState` and `initialBank`. Never store derived financial state; only store user intent (which transfers to make each GW).

---

### Pitfall m3: EO-01 mode toggle not being visible enough — user unaware their view is filtered

**Phase:** EO-01

**What goes wrong:** If the EO mode is set to "Protect Rank" and the user returns to the squad view days later, the captain recommendation will show a different player than expected. They won't remember they set the mode and will be confused why the recommendation changed.

**Prevention:** Persistent mode state (localStorage) must come with persistent mode **display**. Show the active mode in the section header at all times (not just in the toggle controls). Use a coloured badge: blue="Max xPts" (default), green="Protect Rank", amber="Chase Rank", red="Differential Aggressive."

---

### Pitfall m4: TREE-01 using `xPts_1gw` (single GW) as the scoring signal for all GW steps

**Phase:** TREE-01

**What goes wrong:** `planning-engine.ts` already uses `xPts_1gw` for all steps, even in a 5-GW horizon. This means the plan doesn't adapt to known fixture changes beyond GW1 — a player with a difficult fixture in GW1 but an easy GW2 double is always scored by their GW1 xPts. `xPts_3gw` and `xPts_5gw` aggregate over the horizon but can't be used per-step without prorating (which the current engine doesn't do).

TREE-01 may want to use per-GW xPts (i.e., `xPts_1gw * fixtureCountForGw(player, targetGw)`) which the existing `fixtureCountForGw()` already enables. This is what `planning-engine.ts` does on line 116. This is correct for known upcoming fixtures. The problem is that `xPts_1gw` is calibrated to a "typical" fixture — the fixture difficulty is already baked in via the pipeline. Using `xPts_1gw * fixtureCount` double-counts fixture difficulty.

**Prevention:** Review the pipeline to confirm whether `xPts_1gw` already reflects the specific upcoming fixture difficulty or whether it's a per-90 baseline. If it's fixture-adjusted, the `* fixtureCountForGw()` multiplication is correct for DGW only. Document this clearly in TREE-01 plan before writing code.

---

### Pitfall m5: ML-01 league standings pagination not handled — only first 50 rivals shown

**Phase:** ML-01

**What goes wrong:** The `leagues-classic/{id}/standings/` endpoint returns a paginated response with a `has_next` boolean and `results` array per page (approximately 50 results per page). If ML-01 only fetches page 1, leagues with 51+ members silently truncate at 50. For a personal tool capped at top-20 rivals, this is fine — but the implementation must explicitly select the page containing the user's own position and nearby rivals, not blindly take page 1.

**Prevention:**
- Fetch only enough pages to get the user's position ± the desired rival count (e.g. 10 above and 10 below).
- Use the `entry` field in standings to find the user's own position (compare to team ID from localStorage).
- Hard cap at 20 rivals regardless of league size — this is a personal planning tool, not a full league dashboard.

---

## Phase-Specific Warning Matrix

| Phase | Feature | Likely Pitfall(s) | Mitigation | Surface in Plan |
|-------|---------|-------------------|------------|-----------------|
| MTP-01 | Manual Transfer Planner | C1 (FT engine wrong), C2 (sell price formula), M4 (hit cost drift), m1 (break-even) | Fix free-transfer-engine.ts first; use `computeSellPrice()` helper; replay FT state from step 0 | "Fix FT engine before writing any MTP-01 code" in plan |
| ML-01 | Mini-League Tracker | C3 (stale picks), C4 (rate limits), M6 (live GW boundary), m5 (pagination) | Use last finished GW; batch requests to 3 concurrent; cap at 20 rivals | "Rate limit strategy required" section in plan |
| EO-01 | Effective Ownership | C5 (selected_by_percent wrong proxy), M2 (mode state leak), M3 (EV confusion), m3 (invisible mode) | Label as approximation; use ML-01 rival data for mini-league EO; scope mode effects explicitly | "EO approximation caveats" + "Mode persistence" sections in plan |
| TREE-01 | Transfer Route Tree | C6 (combinatorial explosion), C1 (FT engine), M1 (xPts degradation), M5 (WC meaningless branching), m4 (xPts fixture double-count) | Beam search with K=4 branches; treat WC as separate option; discount future GW scores | "Branching factor bound" + "WC as separate path" in plan |
| All | — | C1 (FT engine bug affects all financial simulation) | Fix `computeNextFTState` in a standalone phase or as the first task in MTP-01 | Pre-condition in every v1.9 plan |

---

## Technical Debt Integration Patterns

### FT engine fix is a pre-condition, not a feature task

The `computeNextFTState` bug (Pitfall C1) affects MTP-01, TREE-01, and the existing PlannerTab. It should be fixed in a dedicated pre-work commit before any v1.9 feature code is written. Tests for the corrected behaviour should be added to `src/lib/free-transfer-engine.test.ts` (create if it doesn't exist).

The fix requires updating `FTState.banked` semantics throughout: the type allows any `number` but existing code assumes `banked` is 0 or 1. After the fix, `banked` can be 0–4. Audit for any code that uses `banked` directly as a boolean.

### sell price in existing planning engine

`generatePlan()` and `generateChipStep()` already handle `sellPrices` correctly — they use `selling_price` from auth if available, otherwise fall back to `now_cost`. MTP-01 must follow the same pattern and must not introduce a separate sell price calculation path.

### MTP-01 state model must be derived, not stored

The existing `PlannerTab` uses `useImmer` to store `PlanResult` as a mutable tree. MTP-01 should use the same pattern but with a derived-state discipline: the per-step FT state and bank balance are always computed from first principles (replay from `initialFTState`), never stored as independent state.

### ML-01 TanStack Query staleTime

The existing proxy at `[...proxy]/route.ts` has `next: { revalidate: 0 }` (no server-side cache). TanStack Query hooks use 6h staleTime for player data. For ML-01 rival data, use 30min staleTime — frequent enough to catch late pre-deadline changes, infrequent enough to avoid hammering the FPL API on every tab switch.

### EO-01 mode toggle: localStorage key must be namespaced

The app already uses `fpl_team_id` as a localStorage key. EO-01 must use a namespaced key like `fpl_eo_mode` to avoid collision. Document all localStorage keys in a constants file.

---

## Integration-Specific Failure Modes

### Financial simulation correctness chain

MTP-01's core value is: "if I make these transfers in these GWs, what will my bank and FT state be?" The correctness of this depends on three inputs all being correct simultaneously:
1. `selling_price` values (Pitfall C2) — wrong if not authenticated.
2. `computeNextFTState` (Pitfall C1) — wrong with old engine.
3. Hit cost replay from step 0 (Pitfall M4) — wrong if derived incrementally.

All three must be fixed before MTP-01 ships. Any one failing silently means the feature gives wrong financial advice.

### TREE-01 depends on a correct FT engine

TREE-01's path scoring includes projected hit costs over multiple GWs. These are only correct if the FT engine correctly models the new 5-FT bank and chip-preserving rules (Pitfall C1). TREE-01 cannot be accurately tested until the FT engine is fixed.

### EO-01 + ML-01 synergy

If ML-01 ships before EO-01, EO-01 can use the fetched rival squads to compute accurate mini-league EO% rather than relying on the `selected_by_percent` approximation (Pitfall C5). Recommend shipping ML-01 first, then EO-01 consumes ML-01 data.

---

## Sources

- [Premier League — FPL Big Changes Announced 2024/25](https://www.premierleague.com/en/news/4058895) — official rule change: 5-FT bank, chips preserve bank (HIGH confidence)
- [Fantasy Football Scout — Do I keep my free transfers when I use an FPL Wildcard?](https://www.fantasyfootballscout.co.uk/2024/10/03/do-i-keep-my-free-transfers-when-i-use-an-fpl-wildcard) — corroborates wildcard preserves banked FTs (HIGH)
- [Fantasy Football Scout — Do I keep my saved transfers when using the Free Hit chip?](https://www.fantasyfootballscout.co.uk/2025/03/13/do-i-keep-my-saved-transfers-when-using-the-free-hit-chip) — Free Hit also preserves banked FTs (HIGH)
- [Premier League — How price changes work](https://www.premierleague.com/en/news/2858775) — official sell price formula (HIGH)
- [FPL Focus — How FPL Price Changes Work](https://fpl.page/article/how-fpl-price-changes-work-tool-predictor) — sell price = buy + floor(rise/2), full fall on drops (HIGH — matches official)
- [Fantasy Football Hub — FPL Price Changes](https://www.fantasyfootballhub.co.uk/fpl-price-changes) — price change mechanics (MEDIUM)
- [Fantasy Football Pundit — FPL Effective Ownership](https://www.fantasyfootballpundit.com/fpl-effective-ownership/) — EO definition and top-10k vs overall divergence (MEDIUM)
- [LiveFPL — Top 10k Ownership](https://plan.livefpl.net/top10k) — live top-10k ownership data; demonstrates divergence from overall selected_by_percent (MEDIUM)
- [Premier League — FPL API entry picks endpoint](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — endpoint structure; stale picks behaviour inferred from "picks keyed by event_id" + community behaviour reports (MEDIUM — undocumented FPL API edge cases)
- [FPL API Cheatsheet — Cheatography](https://cheatography.com/sertalpbilal/cheat-sheets/fpl-api-endpoints/history/279325) — endpoint inventory including leagues-classic pagination (MEDIUM)
- Local code verified: `src/lib/free-transfer-engine.ts`, `src/lib/planning-engine.ts`, `src/lib/types.ts`, `src/lib/squad-adapter.ts`, `src/components/planner/PlannerTab.tsx` (HIGH — read directly)
