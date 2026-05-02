---
phase: 053-bonus-point-predictor
plan: "02"
subsystem: pipeline
tags: [pipeline, python, tdd, bonus, merge, gate, bps]
requirements: [BPS-01]

dependency_graph:
  requires:
    - pipeline/bonus.py::compute_bonus_predictions (Plan 01)
  provides:
    - pipeline/merge.py::_compute_xpts_fixture with bonus_predictor_enabled + bonus_ev kwargs
    - pipeline/merge.py::_xpts_ngw with bonus_predictor_enabled + bonus_ev kwargs (propagated to fixture call)
    - pipeline/merge.py::_compute_xpts_sigma with bonus_predictor_enabled + bonus_ev kwargs (signature parity)
    - pipeline/merge.py::merge_players with bonus_stats + bonus_predictor_enabled kwargs
    - pipeline/run.py::compute_bonus_predictions wire-in + bonus_predictor_enabled flag read
  affects:
    - pipeline/merge.py (modified — per-player bonus EV replaces flat BONUS_RATE when gate ON)
    - pipeline/run.py (modified — new import, compute call, flag read, merge_players kwargs)
    - pipeline/accuracy.py (Plan 03 adds bonus_ev to accuracy components)

tech_stack:
  added: []
  patterns:
    - Flag-gated kwarg threading (xmins_v2_enabled / mins_60_prob analog pattern)
    - Per-player EV unpacking at merge loop with None fallback to flat rate (Pitfall C1)
    - Manual-flip gate discipline (default OFF, flip after non-regression shadow run)
    - TDD RED → GREEN with parametrised sum-integrity tests

key_files:
  created:
    - pipeline/tests/test_merge_bonus.py
  modified:
    - pipeline/merge.py
    - pipeline/run.py
    - pipeline/tests/test_merge_xpts_components.py

decisions:
  - "[053-02] BONUS_RATE constant at merge.py line 22 preserved unchanged — serves as documented Pitfall C1 fallback when bonus_predictor_enabled is OFF or bonus_ev is None"
  - "[053-02] _compute_xpts_sigma accepts bonus_predictor_enabled + bonus_ev for signature parity with _xpts_ngw and _compute_xpts_fixture; function body does not use bonus (variance is goal/CS only — bonus variance omitted per docstring)"
  - "[053-02] gate defaults OFF in run.py (bonus_predictor_enabled = False); manually flipped to ON after 5-GW shadow run shows non-regression on xpts_hit_rate (mirrors Phase 52 D-02 discipline)"
  - "[053-02] player_bonus_ev set to None for players absent from bonus_stats or bonus.py source='flat_default' entries — downstream gate falls back to BONUS_RATE[element_type] (Pitfall C1 path)"

metrics:
  duration: "8 min"
  completed_date: "2026-05-02"
  tasks_completed: 3
  files_created: 1
  files_modified: 3
---

# Phase 53 Plan 02: Bonus Predictor — merge.py + run.py Wire-In Summary

**One-liner:** Per-player bonus EV gated behind `bonus_predictor_enabled` flag, threaded from `bonus.py` through all six engine call sites in `merge_players` via `bonus_stats` dict unpacking, with `BONUS_RATE` flat-rate fallback preserved as Pitfall C1.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create RED test file test_merge_bonus.py + parametrise sum-integrity tests | 80e7724 | pipeline/tests/test_merge_bonus.py, pipeline/tests/test_merge_xpts_components.py |
| 2 | Extend pipeline/merge.py with bonus_predictor_enabled / bonus_ev kwargs (GREEN) | fe7a148 | pipeline/merge.py |
| 3 | Wire bonus predictor through pipeline/run.py | fc9f4d0 | pipeline/run.py |

## What Was Built

### pipeline/tests/test_merge_bonus.py (NEW)

5 unit tests created RED-first:

- `test_flat_rate_used_when_flag_off` — flag OFF + bonus_ev=2.0 → BONUS_RATE[3] used (bonus_ev ignored)
- `test_per_player_rate_used_when_flag_on` — flag ON + bonus_ev=1.5 → 1.5 used as per-90 bonus rate
- `test_low_sample_uses_flat_rate` — flag ON + bonus_ev=None → BONUS_RATE[2] fallback (Pitfall C1)
- `test_xpts_ngw_threads_bonus_kwargs` — DGW: flag ON propagates bonus_ev through _xpts_ngw to nested _compute_xpts_fixture; two fixtures × bonus_ev=1.0 = 2.0 total bonus_pts
- `test_compute_xpts_sigma_accepts_bonus_kwargs` — signature parity smoke test; sigma >= 0.0 and no TypeError

### pipeline/tests/test_merge_xpts_components.py (MODIFIED)

2 new test functions added after existing `test_appearance_pts_formula`:

- `test_xpts_components_sum_integrity_with_bonus_flag` — parametrised over (False, None), (True, 1.2), (True, None); sum invariant ±0.01 holds for all three cases
- `test_xpts_components_sum_integrity_both_gates_on` — xmins_v2_enabled=True AND bonus_predictor_enabled=True simultaneously; sum invariant ±0.02 (relaxed per Pitfall 3)

### pipeline/merge.py (MODIFIED)

9 in-place edits:

1. `_compute_xpts_fixture` signature extended: `bonus_predictor_enabled: bool = False, bonus_ev: float | None = None` appended after `mins_60_prob`
2. Line 239 `bonus_pts = BONUS_RATE[element_type] * (xmins / 90.0)` replaced with conditional rate selector: `rate = bonus_ev if (bonus_predictor_enabled and bonus_ev is not None) else BONUS_RATE[element_type]`; BONUS_RATE constant on line 22 preserved unchanged
3. `_xpts_ngw` signature extended: same two kwargs appended
4. Inner `_compute_xpts_fixture` call inside `_xpts_ngw` propagates both kwargs
5. `_compute_xpts_sigma` signature extended: same two kwargs appended (body unchanged — bonus variance omitted by design)
6. `merge_players` signature extended: `bonus_stats: dict | None = None, bonus_predictor_enabled: bool = False` appended
7. `merge_players` docstring updated with descriptions of both new kwargs
8. Per-player `player_bonus_ev` unpacking added after `player_mins_60_prob` block: `bonus_stats[fpl_id].get('bonus_ev')` with None fallback for missing players
9. All 6 engine call sites in `merge_players` per-player loop extended: 3× `_xpts_ngw` + 3× `_compute_xpts_sigma` each receive `bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev`

### pipeline/run.py (MODIFIED)

5 in-place edits:

1. `from bonus import compute_bonus_predictions` added after `from xmins import compute_xmins_stats`
2. Bonus compute block added after xmins: `bonus_stats = compute_bonus_predictions(bootstrap, summaries, finished_gws)`
3. `bonus_predictor_enabled = False` default declared in flag block (before try:)
4. `bonus_predictor_enabled = prev_backtest.get('summary', {}).get('bonus_predictor_enabled', False)` added inside try block
5. Status print `Bonus predictor (per-player EV): ENABLED|DISABLED` added after xMins v2 print
6. `merge_players(...)` call extended with `bonus_stats=bonus_stats, bonus_predictor_enabled=bonus_predictor_enabled`

## TDD Gate Compliance

- RED gate: `test(053-02)` commit `80e7724` — 9 new tests (5 test_merge_bonus.py + 4 parametrised/both-gates in test_merge_xpts_components.py), all failing with TypeError on unknown kwargs
- GREEN gate: `feat(053-02)` commit `fe7a148` — all 79 pipeline tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All 6 engine call sites in the merge loop thread the kwargs; per-player `player_bonus_ev` is wired from `bonus_stats`. The gate defaults OFF (`bonus_predictor_enabled=False`) — this is intentional per the deferred manual-flip pattern (Phase 52 D-02 mirror), not a stub.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns beyond what the threat model covers:

- T-053-07 (bonus_stats KeyError) mitigated: `bonus_stats[fpl_id].get('bonus_ev')` with None fallback at merge loop
- T-053-09 (malformed accuracy_backtest.json) mitigated: `prev_backtest.get('summary', {}).get('bonus_predictor_enabled', False)` chain; `(FileNotFoundError, json.JSONDecodeError)` caught at outer try
- T-053-10 (sum-integrity drift both gates ON) mitigated: `test_xpts_components_sum_integrity_both_gates_on` enforces ±0.02
- T-053-11 (kwarg threading at 6 call sites) mitigated: `grep -c "bonus_ev=player_bonus_ev"` returns 6; sum-integrity tests catch silent drops

## Self-Check: PASSED

- `pipeline/tests/test_merge_bonus.py` exists: FOUND
- `pipeline/merge.py` modified: FOUND (44 insertions)
- `pipeline/run.py` modified: FOUND (11 insertions)
- `pipeline/tests/test_merge_xpts_components.py` modified: FOUND (49 insertions)
- Commit `80e7724` (RED): FOUND in git log
- Commit `fe7a148` (GREEN merge.py): FOUND in git log
- Commit `fc9f4d0` (run.py): FOUND in git log
- 79 pipeline tests pass: CONFIRMED
- `BONUS_RATE` constant unchanged: CONFIRMED (`grep -c "^BONUS_RATE = " pipeline/merge.py` returns 1)
- All 6 engine call sites thread bonus_ev=player_bonus_ev: CONFIRMED (`grep -c` returns 6)
- run.py import smoke check: CONFIRMED (`import run` exits 0)
