# Off-Season Projection Mode — Design

**Date:** 2026-07-29
**Status:** Approved (design), pending implementation plan
**Scope:** Production-wired feature (the roadmap "cold-start prior is the build-now item").

## Problem

Our xPts engine does not produce projections during the FPL pre-/off-season window,
so all pre-season squad/captain guidance falls back to a hand-rolled heuristic
(last-season ppg + FPL `ep_next` + FDR) instead of our model.

Two layered causes, both verified in code:

1. **Off-season gate.** `run.py:272` sets
   `IS_OFF_SEASON = not any(e.get('is_current') for e in events)` (Phase 123 WIN-03).
   When true it skips `merge` and every projection step. Running the pipeline now
   prints `[pipeline] IS_OFF_SEASON: skipping merge` → `0 merged`. The API stays
   off-season until GW1 goes `is_current` (~21 Aug 2026 deadline).

2. **Cold-start path misfires pre-season.** `season_prior.py` (COLD-01) exists and
   `merge_players()` accepts `prior_lookup`/`bucket_priors`, but forcing merge to run
   pre-season produced inverted output: established players with real priors
   (Haaland, Saka, B.Fernandes) projected **0.0 xPts_5gw**, while <500-min cameo
   players (Chiesa, George, Marc Guiu) inflated to 30–40 pts.

### Root cause

- **Per-90 blend (`merge.py:1297-1316`).** The cold-start blend weight is
  `w = min(1, cur_minutes / SEED_MINUTES)` where `cur_minutes = element['minutes']`.
  Pre-season that field still holds *last* season's totals (Haaland `minutes=2953`),
  so `w = min(1, 2953/270) = 1.0`, which **disables the blend for everyone who
  played last season**. It was built for *early-in-season* (minutes climbing from 0),
  not *true pre-season*. Cameo players (<500 min, not in `prior_lookup`) then use a
  raw small-sample per-90 with no shrinkage → inflation.
- **xMins (`xmins.py`).** With `finished_gws=0` and no summaries, the in-season
  evidence path collapses established players' expected minutes → 0 xPts.

## Goal / Definition of Done

A production off-season projection mode: under `IS_OFF_SEASON` the pipeline runs
`merge` in a cold-start mode that produces sane pre-season xPts, wired into `run.py`,
covered by tests, and passing a face-validity gate. Permanent and reusable every
pre-season.

## Approach (chosen)

**Off-season mode threaded through the existing engine** (rejected alternatives: a
separate `offseason_project.py` module — duplicates scoring logic and drifts; a
state-aware blend with no explicit mode — one path juggling three states is subtle
and risks in-season behaviour).

A single boolean `off_season` (default `False` = total no-op) added to
`merge_players` and `compute_xmins_stats`. `run.py` sets it `True` under
`IS_OFF_SEASON`. The entire downstream scoring engine (CS blend, DefCon, CSF-01,
FDR/fixtures, xPts_1/3/5gw) is reused unchanged.

## Design

### 1. Off-season mode contract

When `off_season=True`:
- **Per-90 inputs come purely from the COLD-01 prior.** The cold-start blend weight
  is forced to `w = 0` regardless of `element['minutes']`, so `element`'s
  `minutes`/`xg_per90`/`form` are ignored.
- **Expected minutes come from the COLD-01 start-rate prior**, not the in-season
  evidence path.

Rationale: pre-season every "current-season" bootstrap field is untrustworthy —
last-season residual (state A) or zeroed (state B). The archive-derived prior is the
only valid signal.

### 2. Two pre-season sub-states, one code path

- **State A (now, late July):** bootstrap carries last season's totals
  (`minutes=2953`).
- **State B (post-reset, ~just before GW1):** bootstrap fields zeroed.

Because off-season mode ignores those fields and reads the prior, both states produce
identical, correct behaviour. No branching on sub-state.

### 3. Players with vs without a prior

- **Has a code prior** (≥500 min last season, `MIN_ELIGIBLE_MINUTES`): use their
  archive xG/xA-per-90 directly — stable enough at that floor.
- **No code prior** (new signings, promoted clubs, <500 min): fall to the existing
  `(element_type, price_band)` bucket average — a modest, neutral prior. This is what
  fixes cameo inflation (Chiesa/Guiu get the position-average, not a raw small-sample
  per-90).
- Foreign-league xG import is **out of scope** (no data). New arrivals get the
  price-band bucket as a neutral prior.

### 4. xMins off-season behaviour

`compute_xmins_stats(off_season=True)` derives expected minutes from `start_seed`
(`start_rate × mins_per_start`) instead of the `finished_gws=0` path that collapses
established players to zero. Players without a prior get a price-band default start
probability (premiums nailed, budget = fodder).

### 5. run.py wiring

Under `IS_OFF_SEASON` (and `OFFSEASON_PROJECTION_ENABLED`, default on), call xMins +
merge in off-season mode and write `merged_players.json` / `captain_picks.json` as
normal. Genuinely GW-dependent steps (MC sims, insights, gw_intel, dgw) stay skipped —
they need a live gameweek. If the season archive is missing, fall back to today's
skip-merge behaviour with a clear log — never worse than now.

### 6. Data flow (off-season)

COLD-01 priors (from committed archive) → `compute_xmins_stats(off_season=True)` seeds
expected minutes from the start-rate prior → `merge_players(off_season=True, w=0,
prior_lookup, bucket_priors)` computes per-90 from pure prior → existing xPts engine
(CS blend, DefCon, CSF-01, FDR) → `xPts_1/3/5gw` → `merged_players.json` → app + squad
ILP.

### 7. Error handling

- Archive absent → priors empty → fall back to skip-merge (current behaviour) with a
  clear log; no worse than today.
- Existing non-fatal wrappers preserved.

## Validation (face-validity + cross-checks)

Chosen because only the 2025/26 archive is committed — a true cross-season holdout
would need a 2024/25 archive we don't hold.

- **No-op regression guard:** flag off ⇒ output identical to current in-season
  behaviour.
- **Unit:** off-season established player gets sane non-zero xPts; low-min player does
  not inflate; xMins seeds from the start-rate prior.
- **Face-validity gate:** top-20 by `xPts_5gw` contains known elites and zero
  sub-500-min cameos; positive rank-correlation of our xPts vs FPL `ep_next` and vs
  last-season points; per-position xPts distributions in sane bounds (no defender
  above the top forwards).

## Files touched

- `merge.py` — add `off_season: bool = False`; force `w=0` in the cold-start block.
- `xmins.py` — add `off_season: bool = False`; seed expected minutes from the
  start-rate prior; price-band default for no-prior players.
- `run.py` — off-season branch: run xMins + merge in off-season mode instead of
  skipping; `OFFSEASON_PROJECTION_ENABLED` kill switch; archive-missing fallback.
- `tests/test_offseason_projection.py` — new: no-op guard, unit checks, face-validity
  gate.

## Out of scope

- Foreign-league / non-FPL xG import for new arrivals.
- Cross-season holdout backtest (no 2024/25 archive).
- Re-enabling MC sims / insights / gw_intel during off-season.
