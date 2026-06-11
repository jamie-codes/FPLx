# EO-01: Ownership-Aware Gem Validation

**Feature ID:** EO-01
**Date:** 2026-06-11
**Status:** Approved (objective: template-beating; approach A: validate then recalibrate)

---

## Goal

Measure, against the archived 2025/26 season, whether the app's gem/differential logic actually identifies players who beat the template — then recalibrate the thresholds the data supports and unify the four inconsistent ownership cut-offs currently in production (5% DIFF flag, 10% value-gems, 15% gw-intel/run.py payloads, 25/35% captain EO ladder).

## Success definition (user-chosen)

A flagged gem at GW `g` **succeeds** if his total actual points over GWs `g..g+2` exceed the same-window total of his **template counterpart**: the most-owned player (per-GW `selected`) in the same position (`element_type`) within ±£0.5m of his price at the time (per-GW `value` from element-summary history). A player may not be his own counterpart; if the band is empty besides himself, widen to ±£1.0m, then skip the observation if still empty.

**Lift** = flagged-set success rate minus the base rate (success rate of ALL eligible non-flagged players in the same position/price bands, measured identically). A useful flag needs precision meaningfully above base rate, not just above 50%.

## Phase 1 — validation experiments (`pipeline/experiments/exp06_gem_validation.py`)

**Data construction:**
- Archive via `load_season_archive()`; evaluation GWs **7–36** (3-GW outcome window must fit inside 38; ownership approximation weakest before GW7)
- Per-GW ownership %: `selected(g) / bootstrap.total_players` (final total — documented limitation: underestimates early-season %, small after GW7)
- Honest as-of-GW xPts per (player, gw): `backtest.run_backtest(mode='deploy')` rows with the promoted live params (`blend_alpha 0.2, form_window 4, min_prior_minutes 180, fixture_attack_slope 0.4`)
- Status at time is not archived → the DIFF flag's `status == 'a'` condition is dropped in reconstruction (documented; effect: slightly pessimistic precision since some flagged players were actually unavailable)

**Experiments:**

| # | Question | Method |
|---|---|---|
| E1 | Current DIFF flag precision + lift | Reconstruct `xpts_pred > position median (that GW) AND own% < 5`; measure success rate, n, lift |
| E2 | TRAP inverse validation | `xpts_pred < position median AND own% > 15`: do trapped players UNDERperform their counterpart? (success rate should sit clearly below base) |
| E3 | Threshold sweep | ownership ∈ {3, 5, 8, 10, 15} × xPts gate ∈ {position median, position 75th percentile} → precision/lift/n grid; identify the best precision-with-volume cell (require n ≥ 50 flags/season for promotion) |
| E4 | Gem-score decile curve | Reconstruct gem_score point-in-time where possible: fdr (FPL pre-published difficulty), form (prior-window pts/90 from history), xg/xa per-90 (as-of cumulative), ownership (per-GW), minutes (as-of), set-piece rank (final-season — documented limitation). Mean next-3GW points per score decile: is the curve monotonic? |
| E5 | Ownership-dimension ablation | Same decile curve for gem_score WITHOUT the ownership dimension. If the no-ownership score predicts points better (steeper/cleaner curve), ownership belongs in FILTERS (leverage), not the quality score |

Outputs: printed tables + `experiments/exp06_gem_validation.json`, committed.

## Phase 2 — promotion (decision rules, applied only where data is clear)

| Finding | Action |
|---|---|
| E3 identifies a threshold cell with lift ≥ +10pp over base AND n ≥ 50 | Update `merge.py::_compute_differential_flag` DIFF constants to it (with `# EO-01 validated 2026-06` comment); align `value-gems.ts::isLowOwned` to the same ownership cut-off |
| E3 shows current 5% is already best (or nothing clears the bar) | Constants stay; record in roadmap rejected/inconclusive table |
| E2 validates TRAP (≥10pp below base) | Keep TRAP; tune its threshold only if a swept value is clearly better (same bar) |
| E2 fails to validate TRAP | Flag to user before removing anything (UI surface implications) |
| E5 decisive (no-ownership curve clearly better) | **Return to user before changing gem-score composition** (UI-wide impact) — present the evidence and a proposal |
| E5 inconclusive | gem_score unchanged; record finding |

The 15% (gw_intel/run.py) and 25/35% (captain EO) constants are **out of scope** for changes this round — different semantics (verdict labels, captaincy risk appetite); EO-01 records what the data says about them in the findings doc but does not touch them.

All Phase 2 code changes carry tests (pipeline: pytest on the new constants' behaviour; UI: the existing value-gems tests updated if its constant changes).

## Out of scope

- Captain EO ladder and gw_intel verdict thresholds (recorded, not changed)
- Gem-score recomposition without a fresh user decision (per decision rule)
- New UI surfaces (PICK-01's Under-the-Radar row already consumes ownership; it inherits any validated threshold via its own constant — align it in Phase 2 if E3 promotes a value ≠ 10%)
- Multi-season validation (one season archived)

## Risks / honesty notes

- Single season, ~32 evaluation GWs: threshold sweeps can overfit. Mitigation: require volume (n ≥ 50), prefer round thresholds, report a GW7–21 vs GW22–36 split consistency check for the promoted cell.
- Set-piece order in E4 is final-season (leaks mid-season changes) — affects only the gem-score curve shape, documented.
