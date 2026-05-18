# Pitfalls Research — v1.24 End of Season & Off-Season Intelligence

**Domain:** Adding end-of-season review, off-season planning tools, multi-source news scraping (SCRAPER-02), and full-pool squad builder to an existing FPL personal web app.
**Researched:** 2026-05-18
**Confidence:** HIGH for pipeline patterns and FPL API behavior (grounded in codebase + FPL API community docs); MEDIUM for Twitter/X current state (volatile, multiple community sources agree); HIGH for optimizer algorithm performance (grounded in existing codebase analysis + ILP ecosystem); MEDIUM for season review data gaps (FPL API community knowledge, partially inferred from element-summary API structure).

---

## Critical Pitfalls

### Pitfall C-01: Full-Pool Greedy Optimizer Produces Suboptimal Squads Near Budget Ceiling

**What goes wrong:**
`buildOptimalSquad()` uses a greedy sort-by-xPts-then-take approach across 700+ players. When budget is exactly £100m (the intended use case for Next Season Planner), the greedy algorithm often gets "stuck" in the last 2-3 picks: it has overspent on high-xPts premium players and the budget remainder cannot fill remaining position slots with any eligible player. The function returns `null` (D-06 guard) even though a valid £100m squad exists, because the greedy path ran out of budget before satisfying `MIN_SLOTS`.

This is a known limitation of the existing `buildOptimalSquad()` which was designed for in-season WC/FH where the constraint space is somewhat forgiving (the current squad provides a sensible starting point). For a cold-start full-pool builder with exactly 100m budget and 700+ players at varied prices, greedy frequently fails to find a valid squad even when many valid squads exist.

**Why it happens:**
Greedy sort-by-score does not backtrack. If it picks 3 expensive midfielders (e.g., £14m, £13.5m, £13m) and then cannot complete the squad within budget, it returns null rather than trying a cheaper midfielder. The existing code at `chip-modes.ts:46–54` has no lookahead or fallback.

**Consequences:**
Next Season Planner returns null / empty state for common budget scenarios, appearing broken to the user. The issue is masked in-season because FH/WC mode starts from a partially-filled squad with a known sellable value.

**Prevention:**
For the Next Season Planner's full-pool builder, switch from greedy to a Python-side MILP (Mixed Integer Linear Programming) solve using `scipy.optimize.milp`. The HiGHS solver wrapped by `scipy.optimize.milp` solves the FPL 15-player squad selection problem (700 binary variables, ~30 constraints) in under 100ms. Run the solve in the pipeline (not the browser), write the optimal squad to Vercel Blob as `optimal_squad_next_season.json`, and serve it as a static API endpoint.

If a browser-side solve is required, `scipy.optimize.milp`-style greedy with relaxed budget tolerance (allow up to 1m overspend and post-solve trim) is acceptable as a fallback, but the optimal result must come from server-side MILP.

**Warning signs:**
- `buildOptimalSquad()` returns `null` more than 20% of the time in local test runs with 700-player datasets.
- Optimal squad value is significantly below £100m (unused budget = greedy got stuck and accepted a suboptimal fill).

**Phase to address:** Next Season Planner — squad builder implementation phase (before writing the UI).

---

### Pitfall C-02: FPL API Is Empty or Structurally Different During Off-Season

**What goes wrong:**
The FPL `bootstrap-static` API is available year-round but its content changes significantly between seasons. During the off-season (typically May–July):

1. `events[]` contains gameweeks from the completed season, all `finished: true`, with no upcoming GWs.
2. `fixtures` endpoint returns no upcoming fixtures — the `fixture-heat-map` and FDR pipeline logic that relies on `team_h_difficulty`, `team_a_difficulty`, and `kickoff_time` fields receives an empty array.
3. New player IDs for summer signings are not assigned until FPL officially launches the new season's game (typically late July/early August). A player who moves clubs in June does not appear in the bootstrap until FPL registers them.
4. The `history` section of `element-summary/{id}/` for completed-season data transitions from "current season" to "history_past" summary format at season rollover — losing the gameweek-by-gameweek breakdown in the API.
5. The existing pipeline relies on `events[?].is_current` to determine the current GW. During off-season, `is_current` is `false` for all events, causing `current_gw` detection to return `None`, which crashes any pipeline code that assumes a current GW always exists.

**Why it happens:**
The pipeline was built assuming an active PL season. Off-season behavior is undocumented by FPL and only understood through community-maintained API guides and direct observation.

**Consequences:**
- Daily pipeline runs crash or produce empty/stale data throughout the off-season.
- FDR heatmap, fixture difficulty, xPts projections, and captain picks all fail silently (no fixtures to score against).
- The UI shows every player at xPts = 0 (no upcoming fixtures) — transfer suggestions, optimizer, and captain panel all degrade to useless.

**Prevention:**
1. Add an `is_off_season` detection gate in `pipeline/run.py`: if `len([e for e in events if not e['finished']]) == 0`, set `IS_OFF_SEASON = True` and skip all fixture-dependent pipeline steps (xPts, FDR, captain picks, xMins) — writing only player price/availability/history data.
2. The Next Season Planner should serve pre-computed data (from the last-run pipeline before season end) and not depend on live fixture data.
3. Archive the full `element-summary` per-GW histories before the season ends: add a `pipeline/archive_season.py` step that runs in GW38, iterating all player IDs and writing `season_history_YYYY.json` to Blob. This is the only window to capture gameweek-level data before it collapses into season-summary format.
4. Gate all FDR-dependent components (GW1-8 heatmap, xPts projections) with a "New season data not yet available" placeholder when `IS_OFF_SEASON = True`.

**Warning signs:**
- Pipeline log shows `[run.py] current_gw = None` — off-season entry point.
- `merged_players.json` shows all players with `xPts_1gw = 0`.
- Blob contains no upcoming fixtures in `fpl_bootstrap.json`.

**Phase to address:** Season Review (data archiving before GW38 deadline), Next Season Planner (off-season API gating), and any pipeline phase that touches the GW detection logic.

---

### Pitfall C-03: Season Review Is Missing Early-Season GW Data (Before App Was Running)

**What goes wrong:**
The Season Review feature depends on per-GW decision snapshots: `captain_picks_gw{N}.json` and `transfer_snapshots_gw{N}.json` written to Vercel Blob by the pipeline. These Blob artifacts only exist from the GW when the pipeline was first deployed. If the app was first run in GW8, GWs 1-7 have no Blob snapshots. The season review will show an incomplete record — captain hit rate for 30 GWs rather than 38, with no indication of why early GWs are missing.

Additionally, the localStorage ring buffer (`useDecisionHistory` stores 38 entries) only holds data from when the user first loaded the app. Early-season GWs before app use are absent from localStorage too. The manager's FPL `entry/{id}/history/` endpoint provides total points and rank per GW, but does not include the captain pick or which players were benched — the data needed for captain regret and bench points calculation.

**Why it happens:**
The app writes Blob snapshots on pipeline run, not retroactively. FPL's `entry/{id}/event/{gw}/picks/` endpoint provides historical picks (including captain designation and bench order) for any completed GW — but this is only accessible when the user is authenticated (team ID alone is not sufficient for all fields, depending on FPL privacy settings).

**Consequences:**
- Season review shows partial data without clear explanation.
- Captain hit rate metric is miscounted (denominator should be 38, not 30).
- User sees a misleading "skill score" based on 30/38 GWs.

**Prevention:**
1. For GWs with no Blob snapshot, attempt to backfill from `entry/{id}/event/{gw}/picks/` API on first Season Review load. Cache the backfilled data to Blob (`captain_picks_gw{N}_backfill.json`).
2. Display a "Data available from GW{X}" notice on the Season Review header so the user understands coverage.
3. Clearly mark metrics as "GW{X}-GW38" not "Full Season" when backfill is incomplete.
4. Run the GW38 archive step before the season ends to ensure the final GW snapshot is captured.

**Warning signs:**
- `captain_picks_gw1.json` does not exist in Blob.
- Season review denominator is less than 38.

**Phase to address:** Season Review — data collection and display logic.

---

### Pitfall C-04: Twitter/X Has No Viable Path From GitHub Actions

**What goes wrong:**
SCRAPER-02 lists Twitter/X as a scraping target. As of 2026, all unofficial Twitter/X scraping from datacenter IPs (which GitHub Actions uses, as Azure IPs) is blocked at the network level. X permanently banned datacenter IP ranges in January 2025. Even with valid session cookies or twscrape's account-auth approach, the first request from a GitHub Actions runner is rejected with HTTP 403 before any rate limit is encountered.

This is not a rate limit problem — it is an IP-class block. No amount of session rotation, rate limiting, or header mimicry resolves it without residential proxies (which cost money) or the official API (which costs $100/month minimum).

**Why it happens:**
X's product strategy since 2023 has been to monetize data access. The unofficial scraping surface that existed via guest tokens and public API v1.1 has been progressively closed. The January 2025 datacenter IP ban was the final closure of the last viable unofficial path from automated CI runners.

**Consequences:**
Any X scraping implementation in `pipeline/lineup_news.py` will fail silently within hours of first deploy. The non-fatal wrapper catches the exception; the pipeline continues without Twitter data. No benefit is delivered; maintenance burden is created for a permanently-broken integration.

**Prevention:**
Exclude Twitter/X from SCRAPER-02 scope entirely. The existing SCRAPER-01 implementation already uses FPL bootstrap (authoritative) + Sky Sports RSS + BBC Sport RSS, which covers the same signal with higher reliability. For transfer news (the primary Twitter/X use case in FPL), the signal arrives in FPL bootstrap's `news` field within hours of official confirmation anyway — Twitter/X rarely provides actionable advance notice beyond what the pipeline already captures.

If Twitter/X signal is specifically desired for pre-season fitness rumors and summer transfer speculation: note that the FPL bootstrap is inactive during the off-season (no `news` updates until the new season launches). In that case, the correct approach is a manual curation step (an `overrides.json` file the user can edit) rather than automated scraping.

**Warning signs:**
- Any implementation that calls `requests.get('https://twitter.com/...')` or `requests.get('https://x.com/...')` from the pipeline.
- Any `import twscrape` or `import snscrape` in the pipeline.

**Phase to address:** SCRAPER-02 design phase — define scope to exclude X and document the rationale.

---

### Pitfall C-05: Price Speculation Based on Raw Transfer Count Rather Than Ownership-Adjusted Velocity

**What goes wrong:**
The existing `pipeline/price_changes.py` uses cumulative net transfers to predict price rises. The existing implementation is correct for its in-season use case. However, for the Summer Window Tracker (which surfaces "price speculation integration"), there is a temptation to extend the predictor with summer transfer speculation — applying the same in-season model to pre-season ownership data.

The FPL price algorithm does not use raw transfer count — it uses a threshold based on a percentage of the player's existing ownership. A player owned by 5% of managers needs far fewer net buys to trigger a rise than a player owned by 45%. Applying a flat transfer velocity threshold (e.g., "+50k net transfers = likely rise") will over-predict rises for low-ownership players and under-predict for high-ownership premium players.

Additionally, the "sell-on tax" (you keep only 50% of the profit, rounded down to £0.1m) means price speculation for squad-planning purposes is almost always dominated by actual xPts value. Buying a player for a predicted £0.1m rise yields at best £0.05m profit after tax — rarely worth the squad slot over a better player.

**Why it happens:**
Developers extend existing price prediction code to pre-season without re-examining the algorithm's ownership-adjusted threshold logic. The FPL price algorithm is not public; community reverse-engineering (FPL Core blog, 7-part series) confirms it uses unique manager counts as a fraction of ownership base, not raw numbers.

**Consequences:**
Summer Window Tracker surfaces "HIGH confidence price rise" for Haaland (high ownership, would need millions of buys to move) and misses a newly-signed £5m player who rises on 30k buys from a 2% ownership base. User makes transfer decisions on unreliable predictions.

**Prevention:**
1. Frame the Summer Window Tracker as a "new signings feed and FDR preview" rather than a price prediction engine. Price prediction in the off-season is inherently unreliable because (a) player ownership data is not available until the new season launches, and (b) the FPL algorithm resets between seasons.
2. If price speculation is shown, label it explicitly as "speculative — based on expected popularity, not current ownership data" with a LOW confidence tier.
3. Do not extend the in-season `price_changes.py` model to the off-season without adding ownership-denominator correction.

**Warning signs:**
- Price prediction for off-season players shows HIGH confidence tiers.
- No ownership denominator in the prediction formula.

**Phase to address:** Summer Window Tracker design — scope and confidence tiers.

---

### Pitfall C-06: Decision Quality "Luck vs Skill" Score Is Gameable and Misleading Without Explicit Methodology

**What goes wrong:**
The Season Review includes a "decision quality grading (luck vs skill)" feature. The obvious implementation is `actual_pts / xPts_pts = luck_ratio` or `actual_captain_pts - expected_captain_pts = luck_delta`. These metrics are:

1. **Gameable**: A user who systematically picks the highest-xPts player as captain every week scores 0 captain luck delta by construction. But if that player gets injured GW1 and scores 2, they appear "unlucky" — but the decision was correct (highest xPts pick). The metric punishes correct-process decisions with bad outcomes.

2. **Misleading for partial seasons**: If early GWs are missing (C-03), the luck/skill decomposition uses only GWs with data. One unlucky GW (triple captain on a 2-point haul) can dominate the metric even if the rest of the season was well-managed.

3. **Circular with xPts model accuracy**: The xPts model on this app is calibrated to the current squad's 30-GW accuracy backtest. If the xPts model systematically underrates set-piece takers or overrates high-EO players (which the existing calibration suggests is possible), "luck" and "skill" as measured against xPts will absorb the model's errors.

4. **Captain weight**: A single triple-captain GW (×3 multiplier) can swing the entire season's luck score by 20+ points. A player who was "correct" to triple captain a £9m midfielder (say, based on a home fixture against the weakest team) but the player scored 2 will appear to have been extremely lucky-bad. The skill of the chip timing is lost in the noise.

**Why it happens:**
Luck/skill decomposition in fantasy sports is genuinely hard. FPL Copilot's approach (replay season with xPts, compare ranks across 6,500-manager sample) is methodologically sound but requires a sample of manager data this app doesn't have. Single-manager luck assessment inherently conflates model error with outcome variance.

**Consequences:**
User receives a misleading "skill score" that either flatters or punishes them based on one or two high-variance GWs rather than reflecting consistent decision quality.

**Prevention:**
1. Frame the "process score" as a **process checklist** rather than a numerical luck/skill decomposition: "Did you pick the highest-xPts captain 30/38 GWs?", "Did your transfers net positive expected value?", "Did you take unnecessary hits?" These are assessable from the Blob snapshots without requiring a statistical luck model.
2. If a numerical score is shown, display it as "season variance" (how much actual pts differed from xPts-predicted pts), not as a "luck score" — and note the model calibration caveat.
3. Cap the displayed captain luck metric to exclude TC/BB chip GWs from the "standard decision" score (analyze chip GWs separately).
4. Show GW-level detail alongside the season total so the user can see which specific GWs drove variance.

**Warning signs:**
- Luck/skill score based on a single number (actual_pts / xPts_pts).
- No methodology explanation visible to the user.
- Chip GWs not separated from normal GWs in the luck calculation.

**Phase to address:** Season Review — decision quality grading implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse in-season `buildOptimalSquad()` greedy for Next Season Planner | No new algorithm needed | Returns null for many valid £100m squads; user sees broken UI | Never for cold-start full-pool build |
| Extend in-season `price_changes.py` to off-season | Reuse existing pipeline | Predictions are systematically wrong (no ownership denominator) | Never without ownership correction |
| Skip GW archive step at season end | Less pipeline complexity | Early-season GWs permanently missing from Season Review | Never — archive is a one-time step with no ongoing cost |
| Use `current_gw` from pipeline without off-season guard | Works during season | Pipeline crashes off-season when `is_current` is false for all events | Never without null guard |
| Single-number luck score (actual/xPts) | Simple to compute | Gameable and misleading; erodes user trust | Only as a secondary metric with explicit caveats |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| FPL bootstrap off-season | Assuming `events` always has a current GW | Check `len([e for e in events if not e['finished']]) > 0` before any fixture-dependent logic |
| FPL element-summary at season end | Relying on API for per-GW history next season | Archive `element-summary` per-player before GW38 deadline; data collapses to season-summary after rollover |
| FPL entry picks backfill | Assuming picks are always available without auth | `entry/{id}/event/{gw}/picks/` is public for any team ID; captain and bench data is available unauthenticated |
| Understat off-season | Expecting current-season xG data to exist | Understat updates only after PL matches; off-season queries return empty or last-season data |
| Twitter/X from GitHub Actions | Any unofficial scraping approach | Do not implement — Azure datacenter IPs are permanently blocked by X |
| Sky Sports/BBC RSS off-season | Expecting team news in summer | RSS feeds go quiet May-July; "no news" is a valid empty result, not a scraper failure |
| New signings in FPL bootstrap | Expecting transferred players to appear immediately | New signings only appear in `bootstrap-static` once FPL registers them (typically late July/early August) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| C(700, 15) enumeration for full-pool optimizer | Never completes — combinatorial explosion (~8.5×10^30 subsets) | Use MILP (`scipy.optimize.milp`) — HiGHS solves in <100ms | Immediately for any brute-force approach |
| Loading 700+ players into browser state for squad builder | 4-8MB JSON in memory, slow initial render | Pre-compute optimal squad server-side; serve result only (not full player list) | At 700+ players if full MergedPlayer objects are loaded |
| Per-player `element-summary` API calls for season archive | 700 API calls × 1-2s each = 12-23 minutes | Batch with rate limiting and `asyncio` + `aiohttp`; cache to Blob | Always — FPL server will 429 if called serially |
| `player_id_map.json` becoming stale for summer signings | New players have no Understat ID; xG fields are null | Add explicit "new signing" detection: players with `now_cost > 0` but no `player_id_map` entry get explicit `null` xG with `is_new_signing: true` flag | First pipeline run of new season |
| Season Review loading all 38 GW snapshots in one request | Slow initial load (38 × snapshot sizes) | Lazy-load GW detail on expand; show season summary from pre-aggregated data | With large transfer_snapshots files |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Writing Twitter/X credentials to GitHub Actions secrets | Account termination and credential exposure | Do not implement X scraping; no credentials needed |
| Storing `entry/{id}/event/{gw}/picks/` backfill data containing full squad details | Low risk (personal app), but picks data is technically public | Data is already public via FPL API; single-user app has no privacy concern |
| Passing FPL session cookie to client-side code for Season Review auth | Cookie could be logged or leaked | Keep FPL auth server-side only; the backfill fetch should occur in a Next.js API route, not in the browser |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Season Review showing partial data (only GW8-38) with no explanation | User thinks the app is broken; "why is my hit rate 22/30?" | "Tracking data available from GW{X}" notice; show coverage range in all metrics |
| Next Season Planner using in-season FDR (2025/26 fixture data) for GW1-8 2026/27 | GW1-8 heatmap shows wrong teams/fixtures | Gate GW1-8 FDR heatmap on new-season fixture availability; show "Fixtures not yet announced" placeholder |
| Luck score showing negative number with no context | "My luck score is -47" is meaningless | Label as "pts above/below xPts expectation"; show what a typical season looks like (-20 to +20 is normal variance) |
| Summer Window Tracker showing "HIGH confidence" price rises for pre-season | Pre-season prices don't change; the mechanism doesn't activate until GW1 | Label all summer price speculation as "speculative" or "expected at launch" with no confidence tier higher than MEDIUM |
| Full-pool squad builder returning null silently | User sees empty optimizer panel with no explanation | Show "No valid squad found within £100m budget — try adjusting position or club constraints" with actionable suggestion |

---

## "Looks Done But Isn't" Checklist

- [ ] **Season Review:** Verify GW coverage notice appears when early GWs are missing — verify `captain_picks_gw1.json` absence is detected and shown.
- [ ] **Season Review:** Verify chip GWs (TC, BB) are separated from normal captain decisions in luck/skill score.
- [ ] **Next Season Planner:** Verify the squad builder returns a valid squad (not null) on the full 700-player pool at £100m budget.
- [ ] **Next Season Planner:** Verify the GW1-8 FDR heatmap shows "not yet available" placeholder during off-season.
- [ ] **Summer Window Tracker:** Verify new signing feed handles the period before FPL registers the player (player in news but not in bootstrap yet).
- [ ] **SCRAPER-02:** Verify no Twitter/X scraping code exists in `pipeline/` directory.
- [ ] **Off-season pipeline:** Verify `run.py` does not crash when `is_current` is false for all events (i.e., `current_gw = None` is handled).
- [ ] **Season archive:** Verify `pipeline/archive_season.py` (or equivalent) is wired into the GW38 pipeline run with a conditional trigger.
- [ ] **Polish carry-forwards (TRT-06, TRT-02, MinsRiskBadge):** Verify these do not depend on FPL fixtures data — they are UI-only changes and should not regress in off-season.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Full-pool greedy optimizer returns null | MEDIUM | Switch to MILP pipeline step; add `optimal_squad_next_season.json` Blob artifact |
| Season archive not run before season end | HIGH | Per-GW history becomes unavailable; fall back to `entry/{id}/event/{gw}/picks/` backfill for captain/bench data; xG history lost permanently |
| Off-season pipeline crash (no current GW) | LOW | Add `IS_OFF_SEASON` gate; pipeline recovers on next run |
| Twitter/X scraper silently failing | LOW | Already handled by non-fatal wrapper; just remove the dead code |
| Price prediction misleading in off-season | LOW | Add LOW confidence tier to all off-season predictions; label as speculative |
| Luck/skill score misleading | LOW | Relabel as "season variance"; add methodology note; no rewrite needed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Full-pool greedy optimizer failure (C-01) | Next Season Planner — squad builder phase | `buildOptimalSquad()` returns non-null for 700-player test dataset at £100m |
| FPL API off-season empty/different (C-02) | Season Review archive phase; Next Season Planner gating | Pipeline does not crash when `is_current` is false for all events |
| Season review early-GW data gaps (C-03) | Season Review — data collection | `captain_picks_gw1..gw7.json` absence handled; backfill attempted; coverage notice shown |
| Twitter/X scraping impossible (C-04) | SCRAPER-02 design | No Twitter/X scraping code in pipeline |
| Price speculation ownership-blind (C-05) | Summer Window Tracker design | All off-season price signals capped at MEDIUM confidence; ownership caveat shown |
| Luck/skill score misleading (C-06) | Season Review — decision quality grading | Chip GWs separated; methodology note visible; variance framing used |
| C(700,15) combinatorial explosion | Next Season Planner — algorithm selection | Optimizer returns result in <500ms for 700-player dataset |
| Season archive window missed | GW38 pipeline run | `season_history_YYYY.json` exists in Blob after final GW |
| New season player IDs absent | Summer Window Tracker / Next Season Planner | New signings without bootstrap entries shown as "Not yet registered in FPL" |
| `current_gw = None` pipeline crash | SCRAPER-02 + Season Review pipeline | Pipeline completes without error during off-season test with empty-events bootstrap |

---

## Sources

- Direct codebase audit: `pipeline/chip-modes.ts` (`buildOptimalSquad()` greedy implementation, lines 37-80)
- Direct codebase audit: `pipeline/optimise-lineup.ts` (C(15,11) enumeration approach — valid for 15-player squads, not applicable to 700-player selection problem)
- Direct codebase audit: `pipeline/lineup_news.py` — existing SCRAPER-01 implementation confirming Twitter/X was already excluded, non-fatal wrapper pattern
- FPL API community documentation: Oliver Looney, `oliverlooney.com/blogs/FPL-APIs-Explained` — off-season API changes, element-summary structure
- FPL API community guide: GameChange, `game-change.co.uk/2023/02/10/a-complete-guide-to-the-fantasy-premier-league-fpl-api/` — entry history, picks endpoint, season history behavior
- FPL Core Blog (7-part series): `fplcore.com/blog/the-rabbit-hole-cracking-the-fpl-price-algorithm-part-1-of-7` — price algorithm uses unique manager fraction of ownership base, not raw transfer count; Haaland/Thiago examples
- FPL Copilot luck/skill methodology: `fplcopilot.com/blog/fpl-luck-vs-skill` — xPts replay approach, limitations (model error ≠ luck, single-GW captain swing dominance, sample bias)
- X/Twitter scraping ecosystem (2026): Scrapfly blog `scrapfly.io/blog/posts/how-to-scrape-twitter` — Azure datacenter IP permanent ban; twscrape GitHub — residential proxy requirement
- LiveFPL price change documentation: `livefpl.com/blog/fpl-price-changes` — ownership threshold, sell-on tax math
- SciPy docs: `scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html` — HiGHS MILP solver, integrality constraints, <100ms solve time for moderately-sized problems
- FPL API element-summary community note: "save current season's gameweek histories before season end — data becomes unavailable next year through the API in detailed form" (multiple community sources)
- Previous v1.22 PITFALLS.md: scraper isolation patterns, RSS-first strategy, Twitter/X options table — all remain valid for SCRAPER-02

---

*Pitfalls research for: FPL Analyst v1.24 — End of Season & Off-Season Intelligence*
*Researched: 2026-05-18*
