---
phase: 061-mc-simulation-core
plan: 02
subsystem: pipeline/simulation
tags: [monte-carlo, pipeline, numpy, python, simulation, tdd-green]
dependency_graph:
  requires: [061-01]
  provides: [MC-01, pipeline/simulate.py, compute_simulations]
  affects: [pipeline/simulate.py, pipeline/run.py, pipeline/requirements.txt]
tech_stack:
  added: [numpy>=1.26.0 (direct dependency declaration — already transitive via pandas)]
  patterns: [post-merge-module-shape, vectorized-numpy-sampling, bgw-short-circuit, dgw-per-iteration-sum]
key_files:
  created:
    - pipeline/simulate.py
  modified:
    - pipeline/run.py
    - pipeline/requirements.txt
decisions:
  - "CS_PTS constants {1:6,2:6,3:1,4:0} verified against merge.py lines 16-18 — identical; no deviation needed"
  - "bonus_det and appear_det treated as deterministic per iteration (matches merge.py _compute_xpts_fixture and avoids Pitfall 1 double-counting)"
  - "simulate.py import inserted after bonus import, before price_changes — matches plan D-01 intent"
  - "numpy>=1.26.0 appended to requirements.txt as line 7 (D-15 direct dependency declaration)"
metrics:
  duration: "18 minutes"
  completed: "2026-05-05T22:00:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 61 Plan 02: MC Simulation Core Implementation Summary

Vectorized NumPy Monte Carlo engine (`pipeline/simulate.py`) wired into `pipeline/run.py`, turning all 5 RED tests from plan 061-01 GREEN and satisfying MC-01 at the pipeline data layer.

## What Was Built

### Task 1: pipeline/simulate.py (144 lines)

Created `pipeline/simulate.py` with the canonical post-merge module shape (analog of `bonus.py`):

**Module-level constants** (mirror merge.py verbatim):
```python
N_SIMS = 10_000
GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
CS_PTS = {1: 6, 2: 6, 3: 1, 4: 0}
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}
```

**`_cs_prob_sim(dd, xmins, mins_60_prob)`** — inline re-implementation of merge.py `_cs_prob` (D-02). Uses `mins_60_prob` when provided (xmins_v2_enabled path) or falls back to `min(1.0, xmins/60.0)`.

**`_simulate_player(p, xmins_v2_enabled, rng)`** — per-player simulation:
- BGW short-circuit (D-08): `xmins <= 0 or start_prob <= 0` → `{blank_prob:1.0, haul_prob:0.0, p10_pts:0.0, p90_pts:0.0}`
- DGW handling (D-09): `itertools.groupby` takes first event_id group; loop accumulates `total_pts` over each fixture
- Vectorized: `rng.poisson(lam_g, size=N_SIMS)`, `rng.binomial(1, cs_prob, size=N_SIMS)` — single call per distribution
- `bonus_det` and `appear_det` are deterministic constants per iteration (Pitfall 1 avoided)

**`compute_simulations(merged, xmins_v2_enabled)`** — public entry point:
- Creates one `rng = np.random.default_rng()` for the full run (no per-player re-seeding)
- Calls `_simulate_player` per player, applies `p.update(sim)`, overwrites `xPts_90th_1gw` with `p90_pts` (D-05)
- Prints active player count to stdout (matches existing pipeline print convention)

### Task 2: pipeline/run.py + pipeline/requirements.txt

**run.py** — 2 line additions:
1. Import at line 20: `from simulate import compute_simulations` (after bonus import, before price_changes)
2. Invocation at line 209: `merged = compute_simulations(merged, xmins_v2_enabled)` — inserted between `merge_players()` closing paren and `save('merged_players.json', merged)`. `xmins_v2_enabled` already in scope at line 190.

**requirements.txt** — 1 line addition (line 7): `numpy>=1.26.0` — makes the direct dependency explicit per D-15. numpy 2.2.3 was already installed transitively via pandas.

## Test Results

All 5 RED tests from plan 061-01 now GREEN:
- `test_bgw_shortcircuit` — PASSED
- `test_mc_mean_matches_analytical` — PASSED
- `test_dgw_sums_fixtures` — PASSED
- `test_p90_overwrites_ceiling` — PASSED
- `test_output_value_ranges` — PASSED

Full pipeline test suite: **99 passed** (no regressions).

## Commits

| Task | Hash | Type | Files |
|------|------|------|-------|
| Task 1: pipeline/simulate.py | 3b04f77 | feat | pipeline/simulate.py (+144 lines) |
| Task 2: run.py + requirements.txt | 9c51679 | feat | pipeline/run.py (+2 lines), pipeline/requirements.txt (+1 line) |

## Deviations from Plan

None — plan executed exactly as written.

- CS_PTS constants were verified against merge.py (as the plan required) and confirmed to match `{1:6, 2:6, 3:1, 4:0}` exactly. No adjustment needed.
- The comment in the plan's code block noting "NB: real FPL rules give GK/DEF 4pts..." was a reminder to verify, not an indication of a discrepancy. merge.py uses `{1:6, 2:6, 3:1, 4:0}` which is the correct FPL 2025/26 scoring.

## Known Stubs

None. `pipeline/simulate.py` is fully wired: reads merged player dicts, runs vectorized NumPy simulation, writes 4 real computed fields per player, and overwrites `xPts_90th_1gw` with the MC-derived p90. No hardcoded placeholders or TODO items.

## Threat Flags

None. `pipeline/simulate.py` is pure computation over existing in-memory data:
- No new HTTP calls
- No file reads (`open()` or `json.load()`)
- No user input
- No new network endpoints
- All field access via `.get()` with safe defaults (T-061-02-01 mitigation from threat model)

## Self-Check

- [x] `pipeline/simulate.py` exists at `.../pipeline/simulate.py` (144 lines)
- [x] `pipeline/run.py` contains `from simulate import compute_simulations` (line 20)
- [x] `pipeline/run.py` contains `merged = compute_simulations(merged, xmins_v2_enabled)` (line 209, between merge_players and save)
- [x] `pipeline/requirements.txt` contains `numpy>=1.26.0` as line 7 (7 lines total)
- [x] Commits 3b04f77 and 9c51679 exist in git log
- [x] `python3 -m pytest pipeline/tests/test_simulate.py -x -q` exits 0 (5 passed)
- [x] `python3 -m pytest pipeline/tests/ -x -q` exits 0 (99 passed)

## Self-Check: PASSED
