# ODDS-01: Bookmaker-Odds Clean-Sheet / Goal-Expectation Signal

**Feature ID:** ODDS-01 (season-launch readiness §3 — biggest potential *model* upside; the one external data source with a real thesis)
**Date:** 2026-06-14
**Status:** Approved — **validation experiment build** (verdict-first; live promotion deferred to a gated follow-up)

---

## Problem

The model's fixture-difficulty and clean-sheet signals are crude proxies:

- **CS-prob** (`merge.py:_cs_prob`, lines 210-245) is driven by `defensive_difficulty` — the opponent's **rolling 3-game goals-scored average**, min-max normalised across the 20 teams. Not even true xG; a small, noisy, backward-looking sample.
- **Fixture difficulty** for attack-scaling (FAS-01) uses a **rolling 6-game goals-conceded average** (`merge.py:1030-1057`); the BT-02 backtest harness substitutes FPL's own 1–5 FDR integer.

Bookmaker closing odds are the sharpest publicly available forward estimate of match outcomes — they price in lineups, injuries, form, and venue, and are efficient by construction. The thesis: **market-implied CS-prob and goal-expectation beat our rolling-goals proxies.** This is testable against the archive *now*, so we test before we trust.

**Honest framing:** this is the only new external data source with a real, evidence-backed thesis (per the 2026-06-14 data-sufficiency review). It must clear the leakage-free backtest like FAS-01/DC-01 did; if it doesn't beat the proxy, it lands in the rejected-ideas table and nothing changes live.

## Scope — verdict-first

This build delivers **the historical-odds ingest + conversion + the exp09 validation experiment** that decides whether odds win. It does **not** wire live odds into the pipeline or change any default. The ingest/conversion modules are written to be reused by a later live-wiring follow-up, so nothing is wasted. The deliverable is a measured verdict (exp09_odds.json + written VERDICT), exactly like COLD-01's exp08 gate.

## Data source (verified 2026-06-14)

football-data.co.uk EPL CSV: `https://www.football-data.co.uk/mmz4281/2526/E0.csv` — verified live (HTTP 200, 380 fixtures, 20 teams, closing-odds columns populated). Free for non-commercial use, freely redistributable.

Columns used (closing = sharpest, average-across-books = robust):
- Identity: `Date` (DD/MM/YYYY), `HomeTeam`, `AwayTeam`, `FTHG`, `FTAG`.
- 1X2 closing: `AvgCH`, `AvgCD`, `AvgCA` (fallback `B365H/D/A` if a closing cell is blank).
- Over/Under 2.5 closing: `AvgC>2.5`, `AvgC<2.5` (fallback `B365>2.5`/`B365<2.5`).

A snapshot is committed to `pipeline/data/odds/E0_2025_26.csv` so exp09 is reproducible offline and in CI with no network call (mirrors the season-archive discipline).

## Conversion — Approach A (de-vig + independent-Poisson supremacy/total)

Pure math, no fitted parameters. Per fixture:

1. **De-vig 1X2:** `p_h, p_d, p_a = (1/AvgCH, 1/AvgCD, 1/AvgCA)` normalised to sum to 1 (removes the overround).
2. **De-vig O/U 2.5:** `p_over, p_under = (1/AvgC>2.5, 1/AvgC<2.5)` normalised to sum to 1.
3. **Total goals λ_total:** numerically invert `P(total > 2.5) = 1 − Σ_{k=0..2} Poisson(k; λ_total)` for `λ_total` (monotonic in λ_total → bisection on a bounded range, e.g. [0.2, 8.0]).
4. **Supremacy s = λ_home − λ_away:** solve from the de-vigged 1X2 split. Under independent Poisson with `λ_home = (λ_total + s)/2`, `λ_away = (λ_total − s)/2`, find `s` such that the model's `P(home win)` matches the de-vigged `p_h` (monotonic in s → bisection on `s ∈ [−λ_total, +λ_total]`). `P(home win) = Σ_{i>j} Poisson(i;λ_h)·Poisson(j;λ_a)` over a truncated grid (goals 0..10).
5. **Outputs:** `λ_home, λ_away`; `cs_prob(team) = exp(−λ_opponent)` (P(opponent scores 0) under Poisson); `goal_exp(team) = λ_team`.

Independent Poisson slightly under-weights low scores; acceptable for a relative-improvement test, and the blend weight absorbs residual miscalibration. **Dixon-Coles low-score correction is the explicit follow-up refinement if Approach A validates** — not built now (YAGNI; don't add a fitted ρ before we know odds beat the proxy at all).

## Modules

### `pipeline/odds_client.py` — fetch + parse (I/O)
- `fetch_season_csv(season_code='2526') -> str` — GET the CSV with a browser UA; raises on non-200. (Used once to create the committed snapshot; exp09 reads the snapshot.)
- `parse_odds_csv(text) -> list[dict]` — `csv.DictReader` over the header; each row → `{date, home, away, fthg, ftag, odds_1x2: (H,D,A), odds_ou25: (over, under)}` using `AvgC*` with `B365*` fallback per cell. Rows with missing both closing and B365 for a market are skipped (logged count). `utf-8-sig` to strip BOM.

### `pipeline/odds_model.py` — conversion (pure)
- `devig(implied: list[float]) -> list[float]` — normalise reciprocals to sum to 1.
- `poisson_pmf(k, lam)`, `_p_over_25(lam_total)`, `_p_home_win(lam_h, lam_a)` — internal helpers.
- `lambdas_from_odds(odds_1x2, odds_ou25) -> tuple[float, float]` — the Approach-A solve, returns `(λ_home, λ_away)`.
- `cs_prob(lam_opp) -> float` — `exp(−lam_opp)`.
- No I/O, deps limited to `math`.

### `pipeline/odds_join.py` — alias + keying (join)
- `FOOTBALL_DATA_TO_FPL: dict[str, str]` — football-data names → FPL team `name`/`short_name` (e.g. `Man United→Man Utd`, `Tottenham→Spurs`, `Nott'm Forest→Nott'm Forest`, `Newcastle→Newcastle`, `Wolves→Wolves`). Resolved against `archive['bootstrap']['teams']` to get team ids.
- `build_odds_lookups(odds_rows, archive) -> tuple[dict, dict]` — returns `(cs_lookup, goalexp_lookup)`, each keyed `(gw, team_id)`. Joins each odds row to its archived fixture by `(date, home_id, away_id)`; reads the fixture's `event` (GW). For each side, stores `cs_prob(λ_opp)` and `goal_exp = λ_side`. **Asserts every odds row matched a fixture and every team resolved — raises on any gap (no silent truncation).**

### `pipeline/backtest.py` — integration (the `(gw, team_id)` seam)
- `DEFAULT_PARAMS` gains `odds_cs_weight: 0.0`, `odds_goalexp_weight: 0.0` (no-op at default — existing backtest results unchanged).
- `run_backtest(...)` gains optional `odds_cs_lookup=None`, `odds_goalexp_lookup=None`.
- In the per-fixture xPts path:
  - **CS blend (at the raw-prob stage):** when `odds_cs_weight > 0` and `(gw, team_id)` is in `odds_cs_lookup`, `cs_prob_raw = (1 − w)·proxy_raw + w·market_cs_prob`, then × the existing minutes factor. Market CS-prob is already a calibrated probability, so it blends with `cs_prob_raw` (post-`cs_prob_base/slope`), not with `defensive_difficulty`.
  - **Goal-exp blend (on the difficulty scale):** when `odds_goalexp_weight > 0`, normalise each GW's market λ across the 20 teams to 0–1 (min-max, same transform the proxy uses) and blend into `attacking_difficulty`/`defensive_difficulty` by `odds_goalexp_weight`, preserving the existing FAS-01 scale.
- Leakage: closing odds are pre-kickoff; lookup consumed only for its own GW (identical contract to `def_form`).

### `pipeline/experiments/exp09_odds.py` (+ `.json`) — orchestration
- Loads the committed `E0_2025_26.csv` snapshot + the season archive; builds the lookups; runs deploy-mode backtests over a coordinate sweep: `odds_cs_weight ∈ [0, 0.25, 0.5, 0.75, 1.0]`, then `odds_goalexp_weight ∈ [0, 0.25, 0.5, 0.75, 1.0]` at the best CS weight.
- Computes per-arm: `top10_mean_pts` (deploy), CS **Brier + log-loss** vs actual clean sheets (binary, all team-GWs), goal-exp **RMSE + correlation** vs actual goals.
- Writes `exp09_odds.json` (full table) and prints a **VERDICT**: SHIP (and which weights) only if odds blend is **≥ proxy on top10_mean_pts AND better CS Brier** (goal-exp judged independently on its RMSE + top10). Otherwise: do-not-ship, record a rejected-ideas row.

## Validation — honest scope

- **Fully lab-validatable now** (unlike COLD-01): historical closing odds join cleanly to the archive's 380 fixtures by date + teams; clean sheets and goals are known. The leakage-free comparison is exact.
- **Promotion gate:** odds promoted live **only on a measured win** (top10_mean_pts ≥ proxy AND CS Brier better). Mirrors FAS-01/DC-01.
- **Limit:** one season of odds. A win on 2025/26 is suggestive, not multi-season-proven; re-validate when 2026/27 odds accrue. Recorded in the verdict either way.

## Testing

- `odds_model.py`: `devig` output sums to 1; `lambdas_from_odds` recovers known λ from synthetic odds generated by the forward Poisson (round-trip); `cs_prob` monotonically decreasing in λ; symmetric odds (H==A, balanced O/U) → λ_home ≈ λ_away; heavy favourite (low AvgCH, high over) → high λ_home / low λ_away; bisection converges within tolerance on edge inputs.
- `odds_client.py`: parses the committed CSV header; per-cell B365 fallback when a closing cell is blank; BOM stripped; malformed/short rows skipped with a logged count.
- `odds_join.py`: all 20 football-data names resolve to archive team ids; `(date, home_id, away_id)` join is unique across 380 rows; the 380/380-matched + all-teams-resolved assertions fire on a deliberately broken alias map.
- `backtest.py`: `odds_cs_weight=0`/`odds_goalexp_weight=0` is a pure no-op (existing backtest tests stay green); `w=1` CS path uses pure market CS-prob; goal-exp blend stays on the 0–1 scale.
- `exp09_odds.py`: runs end-to-end on the committed snapshot, produces the metrics table + a deterministic verdict string.

## Out of scope (deferred — gated on the verdict)

- Live in-pipeline odds fetch for 2026/27 (current-fixtures CSV source + cadence) and `run.py` wiring. Spec'd as a follow-up only if exp09 ships.
- Promoting any live default / param value.
- Dixon-Coles correction (Approach B refinement).
- Any UI surface — if promoted later, the signal flows through `cs_prob`/difficulty into the whole app automatically.
