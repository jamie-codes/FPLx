# EUR-01: Midweek-Congestion Rotation xmins Signal

**Feature ID:** EUR-01 (roadmap "European-rotation xmins signal", scope broadened to midweek congestion)
**Date:** 2026-06-15
**Status:** Approved — **validation experiment build** (validate-first; live wiring gated on the 2026/27 calendar and the verdict)

---

## Problem

When a Premier League club plays a midweek fixture (European UCL/UEL/UECL or a domestic cup — Carabao/FA Cup) 1–4 days before its PL gameweek, its players face elevated rotation/rest risk, so their expected minutes may be overstated by the current xmins model. The model's `xmins_adjusted` chain (`xmins.py:286`) applies an FDR-bucketed `rotation_factor` and an `availability_factor`, but **nothing for fixture congestion**. EUR-01 tests whether a congestion-driven xmins penalty improves predictions.

**Honest prior is LOW.** The roadmap notes FDR-rotation + availability already partly capture this, and adjacent ideas (xmins exponential decay, GK save-points) both validated *negative*. This is a cheap, principled test that **may land in the rejected-ideas table** — an acceptable, honest outcome. Promote only on a measured win.

## Scope decisions (from brainstorming)

- **Validate-first.** This build delivers the congestion calendar + join + the exp10 backtest sweep that decides the verdict. It changes NO live behaviour. Live wiring is a gated follow-up.
- **Scope = midweek congestion, not just European.** UCL/UEL/UECL **plus** Carabao Cup + FA Cup. Broader data entry (domestic cups involve all 20 clubs until knocked out) but more statistical power for a low-prior signal. Tradeoff accepted: a validating signal can't cleanly attribute Europe vs cups — decomposition is a follow-up.
- **Calendar sourced by the build, review-gated.** The implementer researches the 2025/26 calendar from Wikipedia, commits a human-readable data file with per-club source citations, and the spec + quality reviews verify it against the sources; the user spot-checks before the verdict is trusted. A wrong calendar invalidates the experiment.

## Congestion calendar — data module

- **New `pipeline/congestion_dates.py`:** `MIDWEEK_FIXTURE_DATES: dict[int, list[str]]` — FPL `team_id` (int, 1–20) → list of ISO `"YYYY-MM-DD"` dates of that club's 2025/26 UCL/UEL/UECL + Carabao Cup + FA Cup matches. One block per club, each with a **source comment** (the Wikipedia page used) and the date count. Only clubs with midweek cup/European fixtures need entries; clubs eliminated early have short lists.
- **`european_cup_dates.py` / `EUROPEAN_CUP_DATES` left untouched** (currently empty; only drives a `gw_intel` display flag). The new module is isolated to the EUR-01 signal — no change to existing display behaviour. Unifying display + signal is a post-validation follow-up.

## Backtest integration & validation

### `pipeline/congestion_join.py`
- `build_congestion_lookup(calendar: dict[int, list[str]], fixtures: list) -> set[tuple[int, int]]` — for each archived fixture, for each of its two teams, if the team has a congestion date `d` with `1 <= (pl_kickoff_date - d).days <= 4`, add `(team_id, fixture['event'])` to the returned set. `pl_kickoff_date` from `fixture['kickoff_time'][:10]`. The window is fixed (covers Thu→Sun=3, Wed→Sat=3 / Wed→Sun=4, Tue→Sat=4 — the standard UEFA/cup midweek-to-weekend patterns); only the penalty magnitude is swept.

### `pipeline/backtest.py`
- Add `'congestion_penalty': 0.0` to `DEFAULT_PARAMS` (no-op default — existing backtest results unchanged).
- `run_backtest(...)` gains optional `congestion_clashes: set | None = None`.
- In the per-fixture **deploy** path (where `xm = sig['xmins']`), when `congestion_clashes` is provided and `(team_id, gw) in congestion_clashes`: `xm = sig['xmins'] * (1.0 - p['congestion_penalty'])`. (`team_id`/`gw` are already in scope in the loop.) Pure no-op at penalty 0.0.

### `pipeline/experiments/exp10_congestion.py` (+ `.json`)
- Loads the archive + committed calendar; builds the clash set; **logs the clash count** ("N (team,gw) clashes detected") as a data-sanity check.
- Sweeps `congestion_penalty ∈ [0.0, 0.05, 0.10, 0.15, 0.20, 0.25]` in deploy mode over the archive window.
- Metrics per arm:
  - **`top10_mean_pts`** (deploy) — the headline promotion metric.
  - **Clash-subset RMSE** — **points RMSE** (predicted xPts vs actual points) computed over **clash-player rows only** (the small fraction of rows where the signal applies), so a real effect isn't washed out by the non-clash majority. Report mean predicted-minutes delta on the subset too (diagnostic), but the gate uses points RMSE. Compare penalty>0 vs penalty=0 on this subset.
- Emits a deterministic **VERDICT** string: SHIP (and which penalty) only if a positive penalty **beats 0.0 on deploy `top10_mean_pts` AND improves clash-subset RMSE**; else NO_SHIP. Writes `exp10_congestion.json`.

## Verdict & live wiring (gated)

- **Promotion gate:** SHIP only if a positive penalty beats 0.0 on deploy `top10_mean_pts` AND lowers clash-subset points RMSE. If it fails (the likely outcome given the LOW prior), record a rejected-ideas-table row in the roadmap and ship nothing live.
- **Live wiring — NOT built now, specced as a follow-up only if exp10 wins:** add a `congestion_factor` (third multiplier) to `xmins.py:286` `xmins_adjusted = xmins × rotation_factor × availability_factor × congestion_factor`, threaded via `compute_xmins_stats` (new `congestion_map: dict[team_id, float]` param) and `_compute_player_xmins` (`congestion_factor: float = 1.0`), with a `congestion_penalty` TUNE-01 param (`accuracy.py` constant + `tune.py` candidate grid + `_SWEEP_ORDER_NAMES`). Requires the 2026/27 calendar hand-entered at launch.

## Testing

- `congestion_dates.py`: structural — every key ∈ 1..20, every value a valid ISO date; a committed total-count assertion catches accidental truncation.
- `congestion_join.build_congestion_lookup`: euro/cup date 3 days before a PL fixture → clash present; 6 days before → absent; same-day or after → absent; both home and away teams checked; multiple dates per team handled.
- `backtest.py`: `congestion_penalty=0.0` is a pure no-op (existing tests green); a clash row at penalty>0 reduces that player's `xm` by the factor; non-clash rows unaffected; `congestion_clashes=None` is a no-op.
- `exp10_congestion.py`: runs end-to-end on the committed calendar + archive, prints the sweep table + clash count + a deterministic verdict string.
- Full pipeline suite green; new params backward-compatible no-ops by default.

## Out of scope

- Live wiring / `xmins.py` / `accuracy.py` / `tune.py` changes (gated follow-up if validated).
- The 2026/27 calendar (entered at launch).
- Decomposing European vs domestic-cup effects; competition-graded or rest-day-graded penalties (flat one-knob test first).
- Touching `european_cup_dates.py` / the `gw_intel` display flag.
- Any UI change.
