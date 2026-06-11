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
| EO-01 | Gem validation: DIFF flag recalibrated to p75 xPts gate + <10% ownership (was median + <5%) — exp06: precision 0.482 vs base 0.370, lift +11.2pp, n=1829, season-half consistent. Ownership shown to buy leverage not accuracy. value-gems/PICK-01 already aligned at 10%. | exp06_gem_validation.json; 6 tests |

**Promoted model vs old (validation GW29–38):** top10_mean 5.18→5.66 pts, captain return 0.50→0.60, RMSE 2.955→2.932, Spearman 0.351→0.359.

## Priority 2 — measured gaps worth closing

### XM-01: Minutes model v3
35 hauls/season are pure minutes-model failures (player ranked when actual minutes known, missed when predicted). Current xmins proxy = trailing 5-game mean. Candidates: exponential decay, explicit return-from-injury handling via lineup_news, starts-streak weighting. Validate in the lab (deploy vs conditional gap is the target metric).

### GK-02: Goalkeeper modelling
GKP haul capture is 11% (worst position). Save points are entirely unmodelled in the backtest path and gated off in live. Element-summary has per-GW `saves`; opponent xG proxy exists. Build save-points EV from prior save rates × opponent attack, validate in lab.

## Priority 3 — polish / infra

- **VAR-01**: distribution-aware captaincy — keep mean ranking for picks; for captaincy specifically, test P(haul) from the MC sim against archived DGWs
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
