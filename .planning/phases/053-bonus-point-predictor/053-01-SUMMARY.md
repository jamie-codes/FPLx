---
phase: 053-bonus-point-predictor
plan: "01"
subsystem: pipeline
tags: [pipeline, python, tdd, bonus, bps]
requirements: [BPS-01]

dependency_graph:
  requires: []
  provides:
    - pipeline/bonus.py::compute_bonus_predictions
    - pipeline/bonus.py::_compute_player_bonus_ev
    - pipeline/bonus.py::POSITION_PRIOR
  affects:
    - pipeline/merge.py (Plan 02 wires output here)
    - pipeline/accuracy.py (Plan 03 adds bonus_ev to accuracy components)

tech_stack:
  added: []
  patterns:
    - Shrinkage estimator with position-prior Bayesian blend (n_starts/12 weight)
    - BPS-CS double-counting residualisation for GK/DEF (Pitfall M3)
    - Pre-merge module pattern mirroring xmins.py (same public API shape)

key_files:
  created:
    - pipeline/bonus.py
    - pipeline/tests/test_bonus.py
  modified: []

decisions:
  - Used statistics.mean() at module level to avoid per-player loop imports (Pitfall 6 compliance)
  - POSITION_PRIOR values set to match merge.BONUS_RATE exactly for downstream value parity
  - cs_rate computed from starts_in_recent (not full history) to keep residualisation consistent with the shrinkage window

metrics:
  duration: "2 min"
  completed_date: "2026-05-02"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 53 Plan 01: Bonus Point Predictor — Core Module Summary

**One-liner:** Per-player bonus EV via shrinkage estimator (empirical mean blended with position prior over recent-10 window, gated at n_starts>=4) with BPS-CS double-counting residualisation for GK/DEF.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create RED test file pipeline/tests/test_bonus.py | dc963a0 | pipeline/tests/test_bonus.py |
| 2 | Implement pipeline/bonus.py (GREEN) | ea48906 | pipeline/bonus.py |

## What Was Built

### pipeline/bonus.py

New pre-merge pipeline module exporting:

- `compute_bonus_predictions(bootstrap, summaries, finished_gws) -> dict[int, dict]` — top-level function iterating all bootstrap elements, returning per-player bonus EV dicts keyed by player_id
- `_compute_player_bonus_ev(element, summary) -> dict` — single-player shrinkage computation
- Module-level constants: `POSITION_PRIOR`, `RECENT_WINDOW`, `MIN_STARTS_GATE`, `SHRINKAGE_K`, `BONUS_CS_RESIDUAL_FACTOR`

**Algorithm:**
1. Take `history[-10:]` (RECENT_WINDOW) from element-summary
2. Filter to entries where `starts == 1` → `starts_in_recent`
3. If `n_starts < 4` (MIN_STARTS_GATE) or `summary is None` → return flat `POSITION_PRIOR[element_type]`, `source='flat_default'`
4. Compute `empirical_mean = mean(m['bonus'] for m in starts_in_recent)`
5. Shrinkage weight `w = min(1.0, n_starts / 12)`
6. `bonus_ev_raw = w * empirical_mean + (1-w) * prior`
7. For GK (1) and DEF (2): `cs_rate = cs_count / n_starts`; `bonus_ev = max(0.0, bonus_ev_raw - 0.5 * cs_rate)`
8. For MID (3) and FWD (4): `bonus_ev = bonus_ev_raw` (no residualisation)
9. Return `{'bonus_ev': round(bonus_ev, 4), 'n_starts': n_starts, 'source': 'learned'}`

### pipeline/tests/test_bonus.py

10 unit tests created RED-first, then GREEN:

- `test_returns_per_player_dict` — return shape contract
- `test_missing_summary_falls_back` — None summary → flat prior, all 4 positions
- `test_low_sample_falls_back` — n_starts=3 → flat prior, all 4 positions
- `test_sufficient_sample_blends` — n_starts=10, MID, bonuses=[3,3,2,3,1,2,3,3,2,3] → blended EV
- `test_shrinkage_formula` — n_starts=4 gate boundary, MID, mean=1.0 → w=4/12 blend
- `test_shrinkage_full_weight_at_n12` — 12 entries in history; window clips to 10; w=10/12
- `test_window_uses_recent_10_only` — 15 entries; first 5 (bonus=3) excluded; last 10 (bonus=0) used
- `test_defender_bonus_residualised_against_cs` — GK, 8/10 CS → cs_rate=0.8 → residualised
- `test_attacker_bonus_not_residualised` — MID, CS=1 all entries → no residualisation applied
- `test_top_level_returns_dict_keyed_by_player_id` — top-level function, player 200 absent from summaries falls back to FWD prior

## TDD Gate Compliance

- RED gate: `test(053-01)` commit `dc963a0` — 10 tests, all failing with `ModuleNotFoundError: No module named 'bonus'`
- GREEN gate: `feat(053-01)` commit `ea48906` — 10 tests pass, 70 total pipeline tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `bonus.py` computes real values from element-summary history. Plan 02 will wire the output into `merge.py`; this plan correctly has no consumers yet.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. The module reads from the shared in-memory `summaries` dict passed by `run.py` — same pattern as `xmins.py`.

## Self-Check: PASSED

- `pipeline/bonus.py` exists: FOUND
- `pipeline/tests/test_bonus.py` exists: FOUND
- Commit `dc963a0` (RED): FOUND in git log
- Commit `ea48906` (GREEN): FOUND in git log
- 70 pipeline tests pass: CONFIRMED
