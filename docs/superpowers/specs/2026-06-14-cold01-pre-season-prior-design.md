# COLD-01: Cold-Start Pre-Season Prior Model

**Feature ID:** COLD-01 (season-launch readiness §2 — the headline build)
**Date:** 2026-06-14
**Status:** Approved (validation-limited — see Validation; user accepted the caveat)

---

## Problem

At GW1 (and thinly through ~GW6) the model has **zero current-season data**: Understat season xG empty, FPL per-90 fields season-to-date = 0, xMins has no current-season starts. So `xg_per90`/`xa_per90` collapse to the goals-proxy of a tiny/empty sample and `xmins` to a flat position prior — the model is weakest exactly when the table is set and rank is cheapest to gain. Fix: seed from the **prior season** (the committed 2025/26 archive), blending prior→current as current minutes accrue.

## Design

### New module `pipeline/season_prior.py`

- `build_prior_lookup(archive: dict) -> dict[int, dict]` — keyed by **player `code`** (persistent across seasons; FPL `id` reshuffles). For each archived player, sum `expected_goals`/`expected_assists`/`minutes`/`starts` over `archive['summaries'][pid]['history']`:
  `{code: {xg_per90, xa_per90, total_minutes, start_rate, mins_per_start}}`. Only players with `total_minutes >= 500` (reuse `suggest_squad`'s eligibility floor) to avoid cameo noise. (Understat 2025/26 archive is empty → FPL summed history is the honest, complete source; matches `build_asof_signals`' own derivation.)
- `build_bucket_priors(archive) -> dict[(et, band), {xg_per90, xa_per90}]` — mean per-90 by `(element_type, price_band)` for new entrants with no `code` match. Coarse bands (budget/mid/premium by `now_cost`) for robustness to cross-season price drift. ≥500-min filter.
- `SEED_MINUTES = 270` constant (≈3 full matches; the one knob, **fit in the lab via exp08 — 270 beat 540/180/0 on the held-out early window**; see Validation).
- `prior_for(code, element_type, now_cost, lookup, buckets) -> {xg_per90, xa_per90, start_rate, mins_per_start} | None` — code match first, then bucket, then None.

### merge.py — Layer-3 prior blend (after the USR-01 fallback, ~line 1269)

Applied to the FINAL `xg_per90`/`xa_per90` (after Understat→FPL→proxy resolve), weighted by accrued current minutes (`minutes = element['minutes']`, merge.py:1286):

```
w = max(0.0, min(1.0, cur_minutes / SEED_MINUTES))   # GW1: w=0 (pure prior); ~GW3-4: w=1 (pure current)
if prior present and w < 1.0:
    cur_total = xg_per90 + xa_per90
    prior_total = prior_xg90 + prior_xa90
    blended_total = (1 - w) * prior_total + w * cur_total
    # re-split by PRIOR xG/xA share when current sample thin (mirror merge.py:1461-1463 form-blend split)
    share = prior_xg90 / prior_total if prior_total > 0 else 0.5
    xg_per90 = blended_total * share
    xa_per90 = blended_total * (1 - share)
```

Self-deactivating: as `cur_minutes → SEED_MINUTES` (≈3 matches), `w → 1` and the prior vanishes — no off-season gate needed. Gated by `prior present` so it's a pure no-op when no prior lookup is passed (backward-compatible default). Mirrors the existing form-blend's split-by-share convention.

### xmins.py — prior start seed

Thread a `code`-keyed `{start_rate, mins_per_start}` map through `compute_xmins_stats` → `_compute_player_xmins`. When `starts < 3` (cold) AND a prior exists: use `prior_start_rate` instead of the flat `POSITION_PRIOR[et]` (xmins.py:181/198) and seed `avg_mins_started` from `prior_mins_per_start` (so `xmins` isn't 0 at GW1, line 204). Falls back to `POSITION_PRIOR` when no prior. Same self-deactivation as current starts accrue (the existing `starts >= 3` path takes over).

### run.py wiring

Build the prior **once** at pipeline start (load the latest completed-season archive via `capture_season.load_season_archive()`; default `season_2025_26`, non-fatal if absent → empty lookups → no-op), then pass `prior_lookup`/`bucket_priors` to `merge_players` and the start-seed map to `compute_xmins_stats`. New optional params default to `{}`/`None` so every existing test and call site is unaffected.

## Validation — honest scope

- **The blend formula + `SEED_MINUTES` decay ARE lab-validated** via a BT-02 **H1→H2 split** (new `exp08_coldstart.py`): treat GW20 as "GW1 of a mini-season", GW1-19 aggregates as the prior. Add a `coldstart_seed_minutes` param to `DEFAULT_PARAMS` + a blend in `build_asof_signals` (toward an injected per-player prior). Three-way compare over GW20-26: **prior-blend vs current-to-date-only (seed=0) vs position-average prior**. Fit `SEED_MINUTES` to the value that maximises deploy-mode `top10_mean_pts`/`haul`/`captain` on the held-out window; require prior-blend ≥ current-only ≥ position-average (sanity).
- **NOT lab-validatable with one archived season:** the true cross-season `code`-join (2024/25→2025/26 GW1) and the new-entrant bucket proxy — only 2025/26 is archived. These ship as **reasoned live-path changes**: for returning players, last-season per-90 is self-evidently more informative than a near-empty current sample, and the blend self-deactivates by ~GW7, so downside is bounded to the early window where the alternative is worse. **Re-validate fully once 2026/27 + 2025/26 give a real two-season cross test.**
- This is honestly framed: a principled, bounded fallback for a known data-void, with its one tunable (decay) lab-fit. Not presented as a measured cross-season edge.

## Testing

- `season_prior.py`: `build_prior_lookup` sums history correctly + ≥500-min filter; bucket means by (et, band); `prior_for` code→bucket→None precedence.
- merge.py: prior used at `cur_minutes=0` (w=0, pure prior, re-split by prior share); vanishes at `cur_minutes>=SEED_MINUTES` (w=1, current unchanged); no-op when no prior passed (existing tests stay green); new-entrant bucket path.
- xmins.py: prior start_rate seeds start_prob when starts<3 + prior present; flat POSITION_PRIOR when no prior; existing behaviour unchanged when starts>=3.
- run.py: prior built + threaded; non-fatal when archive absent.
- `exp08_coldstart.py`: runs, produces the three-way table, picks SEED_MINUTES; commit the json.
- Full pipeline suite green; the new params are backward-compatible no-ops by default.

## Out of scope

- `suggest_squad.py` / NextSeasonPlannerTab — separate `ppm` path, does NOT consume `xg_per90`. Feeding the prior there is a deliberate later enhancement, not automatic. (Recorded for a follow-up.)
- Previous-league Understat for foreign signings (the bucket proxy covers new entrants; per-player foreign-league xG is a future refinement).
- Any UI change — the prior flows through `xg_per90`/`xmins` into the whole app automatically (Weekly Picks, captaincy, differentials, Home).
