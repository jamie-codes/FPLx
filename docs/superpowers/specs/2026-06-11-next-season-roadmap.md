# 2026/27 Next-Season Roadmap

**Date:** 2026-06-11 (overnight session)
**Basis:** Honest full-season backtesting (BT-02 lab, exp01–exp06) over the archived 2025/26 season.

Every item below is grounded in measured evidence, not speculation. Backlog status: all pre-existing backlog features are shipped except ALERT-01.

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

**Promoted model vs old (validation GW29–38):** top10_mean 5.18→5.66 pts, captain return 0.50→0.60, RMSE 2.955→2.932, Spearman 0.351→0.359.

## Priority 1 — biggest expected edge for 2026/27

### BT-03: Honest tuner (point TUNE-01 at the BT-02 harness)
The live tuner still optimises the leaky backtest in accuracy.py (each GW's "prediction" sees that GW's own xG and minutes). Every in-season parameter promotion is therefore optimising the wrong objective. The live run already fetches full element summaries — BT-02's signal construction can run in-pipeline. Replace `_sweep_param`'s metric source with honest as-of-GW reconstruction. **This compounds: every future tuning decision gets better.**

### SA-02: In-season archive accumulation
Persist the fetched summaries + bootstrap snapshot on every pipeline run during 2026/27 (cheap — data already in memory at run time). Unlocks: per-GW ownership history (element-summary `selected`), price trajectories, growing multi-season training data, and an honest early-season tuner (2025/26 archive as prior + current season as it accrues).

### PICK-01: Weekly Picks page (the user-facing deliverable)
Productise the retro picks table: ranked top-10 for 1GW and 3GW horizons, each with haul probability (existing MC sim), differential flag (low ownership), and the model's *measured* backtest hit-rate displayed as confidence ("this list catches ~20% of hauls, top-10 averages ~5.7 pts/GW"). Rank by mean xPts — exp04 proved nothing beats it.

## Priority 2 — measured gaps worth closing

### XM-01: Minutes model v3
35 hauls/season are pure minutes-model failures (player ranked when actual minutes known, missed when predicted). Current xmins proxy = trailing 5-game mean. Candidates: exponential decay, explicit return-from-injury handling via lineup_news, starts-streak weighting. Validate in the lab (deploy vs conditional gap is the target metric).

### GK-02: Goalkeeper modelling
GKP haul capture is 11% (worst position). Save points are entirely unmodelled in the backtest path and gated off in live. Element-summary has per-GW `saves`; opponent xG proxy exists. Build save-points EV from prior save rates × opponent attack, validate in lab.

### EO-01: Ownership-aware gem validation
The gem/differential logic in the web app has never been backtested. With SA-02's per-GW `selected` data (and the archive's GW31+ snapshot), validate: do low-ownership model-top-30 picks actually outperform template picks on points-per-pick? Then tune the differential thresholds empirically.

## Priority 3 — polish / infra

- **DC-02**: surface the new `defcon` xPts component in the gem-table hover (data already flows; UI ignores it today)
- **ALERT-01**: the one unshipped backlog item (push/email infra)
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
