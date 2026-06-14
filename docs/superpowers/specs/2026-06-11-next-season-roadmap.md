# 2026/27 Next-Season Roadmap

**Date:** 2026-06-11 (overnight session)
**Basis:** Honest full-season backtesting (BT-02 lab, exp01–exp06) over the archived 2025/26 season.

Every item below is grounded in measured evidence, not speculation. Backlog status: ALL pre-existing backlog features are shipped (ALERT-01 completed 2026-06-11).

---

## Shipped tonight (already in main)

| ID | What | Evidence |
|---|---|---|
| SA-01 | 2025/26 season archive captured to git (841 players × 38 GWs × 41 fields) — fetched hours before the FPL API reset window | irreplaceable; manifest 100% success |
| BT-02 | Leakage-free backtest lab (`pipeline/backtest.py`) — 32-GW honest evaluation, two modes, CLI | runs full season in <1s |
| FAS-01 | Fixture attack scaling (opponent difficulty now scales xG/xA), default slope 0.4, TUNE-01 param 12 | val top10_mean +0.21 pts/GW; RMSE better on both splits |
| DC-01 | DefCon expected points (2-pt threshold rule), tunable scale, TUNE-01 param 13 | EV calibrated to 3 decimal places (0.540 vs 0.541) |
| — | Honest-tuned defaults: BLEND_ALPHA 0.4→0.2, FORM_WINDOW_GWS 5→4 | val top10_mean +0.27, captain return 50%→60% |
| — | DGW-02 follow-up validation: double-fixture predictions ratio 2.03–2.12 across GW26/33/36 | DGW logic confirmed with real data |
| BT-03 | Honest tuner — TUNE-01 now evaluates all candidates on the leakage-free harness (10 swept honestly, 3 frozen at priors) | full honest tuner run: 27s, sane promotions; promotion path test-covered |
| SA-02 | In-season archive accumulation — pipeline snapshots the full season to `pipeline/data/season_<label>/` on each newly finished GW; CI commits it (contents: write + bot commit step). Same-GW partial snapshots self-heal when a later run fetches more players. | 7 tests; gate logic verified against real archive (write→idempotent) |
| PICK-01 | Weekly Picks tab (Analyse) — confidence strip (live honest metrics after GW8, else 2025/26 validation), side-by-side 1GW/3GW top-10 tables with expandable component breakdowns, under-the-radar gems row | 19 UI tests + 2 pipeline tests; both suites green |
| DC-02 | DefCon xPts component surfaced in the UI (expandable picks rows) — delivered inside PICK-01 | — |
| ALERT-01 | Alert system completed (push-only): web-push install unblocked, PUSH-06 set-piece-change + PUSH-07 lineup-doubt collectors added to the existing 4 (price/injury/deadline/captain). Backlog is now 100% shipped. | 11 new tests; 581 pipeline tests green |
| UIX-01 | UI overhaul phase 1/5: Slate Pro token system (3-tier, AA-enforced by scripts/contrast-check.mjs), Inter + 1.2 type ramp, 11 primitives, 6-group shell (sidebar/bottom-bar/MoreSheet), ?t= deep links, lucide icons, official CDN assets with fallbacks. All 27 tools re-homed unchanged (inventory-verified). UIX-02 Home command centre SHIPPED 2026-06-12 (deadline header, squad verdict strip, captain/transfer/lineup action cards; pure engine composition; 31 tests). UIX-03 SHIPPED (5 table surfaces on PlayerCell/TableShell/Chip; violet token; SegmentedToggle; sticky-column contract; flagship gem table migrated with all 5 hazards verified). UIX-04 SHIPPED (all 20 remaining tools token-pure in 4 batches + gap fix; FixtureHeatMap semantic tiers, recharts tokenized, shared badges retokenized; tsc pre-existing errors down to 2 files). UIX-05 SHIPPED 2026-06-13 — overhaul COMPLETE (5/5). Model tabs + all chrome migrated, legacy CSS alias layer deleted, tsc=0 (first clean tsc in project), closing audit passed (a11y/responsive/motion). Repo raw-palette = only the sanctioned perfect-gw pitch. | 1926 vitest + 63 e2e + 583 pipeline green; design audit approved after fixes |
| ACC-06 | Honest xPts calibration (predicted-bucket → mean-actual) in the Forward Skill panel, from the leakage-free harness rows — answers "over/under-confident at N xPts?" | additive; ≥8GW-gated; tests green |
| PICK-02 | Deterministic why/risk explanations on Weekly Picks expand rows (annotation only, no ranking change) — reasons (xG/minutes/fixtures/set-pieces/bonus/DefCon/differential/ceiling) + risks (rotation/availability/tough-fixture/low-floor/blank/trap/thin-sample) | 41 tests; pure lib |
| COLD-01 | Cold-start pre-season prior model — `pipeline/season_prior.py` seeds GW1 xg/xa per-90 + start-rate from the 2025/26 archive (joined on persistent player `code`), blended prior→current as minutes accrue and self-deactivating at SEED_MINUTES=270 (≈3 matches); new entrants proxied by (element_type, price_band) bucket means. Layer-3 blend in merge.py, prior start-seed in xmins.py, built-once + threaded in run.py — all new params backward-compatible no-ops. | exp08_coldstart VALIDATE (SEED=270 beat 540/180/0 on held-out early window; Arm B prior-blend functional at cold-start where current-only had 0 rows). Cross-season code-join + bucket proxy ship as reasoned changes (re-validate fully on 2 seasons). 674 pipeline tests green. |
| EO-01 | Gem validation: DIFF flag recalibrated to p75 xPts gate + <10% ownership (was median + <5%) — exp06: precision 0.482 vs base 0.370, lift +11.2pp, n=1829, season-half consistent. Ownership shown to buy leverage not accuracy. value-gems/PICK-01 already aligned at 10%. | exp06_gem_validation.json; 6 tests |

**Promoted model vs old (validation GW29–38):** top10_mean 5.18→5.66 pts, captain return 0.50→0.60, RMSE 2.955→2.932, Spearman 0.351→0.359.

## Priority 2 — measured gaps worth closing

### XM-01: Minutes model v3
35 hauls/season are pure minutes-model failures (player ranked when actual minutes known, missed when predicted). Current xmins proxy = trailing 5-game mean. Candidates: exponential decay, explicit return-from-injury handling via lineup_news, starts-streak weighting. Validate in the lab (deploy vs conditional gap is the target metric).

### EUR-01: European-rotation xmins signal (DEFERRED to 2026/27 season setup)
Validatable in BT-02 (NOT data-blocked — archive fixtures carry kickoff dates, so a (team,gw)→euro-clash lookup is reconstructable; a euro_rotation_factor slots into the multiplicative xmins_adjusted chain + a BT-02 sweep, FAS/DC-style). Prerequisite: populate EUROPEAN_CUP_DATES (currently empty) with the season European calendar for the ~6-7 PL clubs. DEFERRED 2026-06-14 (user): the live feature needs that UEFA calendar hand-entered each season anyway, so do the backtest data-entry + exp07 sweep alongside the July 2026/27 calendar setup. Honest prior is LOW (FDR-rotation + availability already partly capture this; xmins-decay & GK-saves both validated negative) — may land in the rejected table. Live wiring partly exists: gw_intel._apply_rotation_risk already detects euro clashes as a display boolean; promotion would convert it to an xmins multiplier + tune.py param.

### ODDS-01: Bookmaker-odds clean-sheet / fixture-difficulty signal (future experiment)
The one external data source with a real thesis we DON'T ingest. Market-implied CS / team-goal probabilities likely beat our rolling-xG difficulty proxy (currently feeds the CS model + FDR). Free tiers exist (the-odds-api ~500 req/mo; or odds-portal scrape). MUST lab-validate FAS/DC-style: does odds-derived CS-prob/difficulty beat the current proxy on the leakage-free backtest? Promote only on a win. Secondary providers that merely UNBLOCK deferred items: fbref shot-level (historical npxG → unblocks the #3 npxG split), a fixtures API (auto European calendar → unblocks EUR-01). Avoid paid Opta/StatsBomb (overkill) + more news feeds (diminishing). Verdict from the 2026-06-14 data-sufficiency review: current FPL+Understat stack is sufficient for today's model; odds is the only compelling addition, and the bigger levers remain multi-season data (SA-02 accruing) + the ML shadow model.

### GK-02: Goalkeeper modelling
GKP haul capture is 11% (worst position). Save points are entirely unmodelled in the backtest path and gated off in live. Element-summary has per-GW `saves`; opponent xG proxy exists. Build save-points EV from prior save rates × opponent attack, validate in lab.

## Priority 3 — polish / infra

- **TFR-01** ✅ SHIPPED 2026-06-13: Confirmed Transfers Ledger — Wikipedia scrape → PL filter → Planning-group tab (by-club + chronological, Rumours→Summer Window). Live-DOM-hardened; 594 tests green.

- **VAR-01** ✅ SHIPPED 2026-06-14: distribution-aware captaincy — exp07 validated analytical ceiling (xPts_90th) beats mean-xPts for captaincy on all 3 splits (val 6.90→7.30 mean-captain-pts, equal/higher haul rate). computeCaptaincyCandidates now ranks by ceiling; resolves the inconsistency with the pipeline ceiling pick + eo-candidates chase_rank. (MC haul_prob not lab-reachable — used the analytical ceiling, which the MC p90 overwrites live anyway.)
- **Lab hygiene**: BT-02's `DEFAULT_PARAMS` intentionally lags live defaults (it's the experimental control); document per-experiment which param set is "current live"

## Explicitly rejected (don't re-litigate without new evidence)

| Idea | Evidence against |
|---|---|
| Team defensive form scaling CS (CSF-01 slopes > 0, either goals- or xGC-based) | improves RMSE, hurts picks on both splits |
| Team attack form scaling (ATF-01 slope > 0) | tunes to 0.0 honestly |
| Ceiling-weighted ranking (mean + 1.28σ) | −0.7 top10 pts vs mean |
| Attacking-only ranking | −1.1 top10 pts vs mean |
| Penalty-taker xG uplift | takers already caught at 53% vs 15% baseline — their xG already carries it |
| blend_alpha 0.1 / window 6 (joint re-tune drift) | wins train, loses validation — overfit |
| Exponentially weighted xmins (halflife 1.5-5) | marginal train gain, val top10 drops 5.66->5.52 |
| GK save-points EV (saves_per90/3 x opp attack) | worsens GKP RMSE 2.71->3.01; CS+appearance already over-cover GKs |
| TRAP flag removal | exp06: trap success 0.340 vs base 0.370 on n=53 — underpowered, inconclusive; kept pending 2026/27 data |
| Removing ownership from gem-score (E5 ablation) | directionally supportive (top decile 10.41 vs 10.00, more monotonic) but not decisive — recorded, not acted on |
| npxG / penalty-xG split (Improvement #3) | DEFERRED 2026-06-13: no historical per-GW npxG anywhere (FPL never exposed it; archive npxG all-zero) so it cannot be honestly backtested; prior evidence already shows pen-taker xG works. Revisit once SA-02 accrues per-GW Understat npxG via the USR-01 endpoint. |
