# BT-02 Lab Experiments

Offline experiments over the archived 2025/26 season (`pipeline/data/season_2025_26/`,
loader `capture_season.load_season_archive()`), evaluated with the leakage-free
harness `pipeline/backtest.py` (`python backtest.py --help`).

**Protocol:** train GW7–28, validate GW29–38. Select on train, judge on validation.
Never quote the old accuracy.py backtest numbers as forward skill — that path feeds
each GW's own xG/minutes into its "prediction" (leaky); the honest baseline is
~10% haul@10, not 19%.

| Script | Question | Verdict |
|---|---|---|
| `exp01_baseline.py` (json only) | honest full-season baseline, deploy vs conditional | deploy haul@10 9.6%, top10 4.75; rate model (not minutes) is the bottleneck |
| `exp02_tune.py` | honest coordinate descent over 10 params | blend_alpha 0.2 + form_window 4 + min_prior 180 win validation; CSF/ATF slopes → 0 |
| `exp03_missed_hauls.py` | why are hauls missed? | 31% of hauls include DefCon pts (88% missed); pen takers already caught (53%); 336/371 misses are rate-model |
| `exp04_ranking_functions.py` | beat mean-xPts ranking? | NO — ceiling (−0.7) and attacking-only (−1.1 top10 pts) both lose |
| `exp05_final_validation.py` | promoted vs old model + DGW check + retro picks | promoted wins all val metrics; DGW ratio 2.03–2.12 ✓; weekly top-5 averages 5.16 pts/pick |
| (inline, session log) | DefCon EV calibration | predicted 0.540 vs realized 0.541 (DEF) — promoted as DC-01 |
| (inline) | fixture_attack_slope sweep | RMSE better on BOTH splits, val top10 +0.21 at 0.4 — promoted as FAS-01 |
| (inline) | xGC-based defence form | better than goals-based at equal slope, still loses to slope 0 for picks |
| (inline) | xmins_halflife, gk_saves_scale | both honest negatives — params exist in the lab, default off |
| (inline) | joint re-tune incl. FAS/DC | drifts to blend 0.1/window 6 on train, LOSES validation — promoted set stands |

Full conclusions + rejected-ideas table: `docs/superpowers/specs/2026-06-11-next-season-roadmap.md`.
