---
phase: 053-bonus-point-predictor
verified: 2026-05-02T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 53: Bonus Point Predictor Verification Report

**Phase Goal:** Replace the flat per-position bonus rate constant with a per-player learned bonus EV derived from BPS history, so xPts captures individual bonus-scoring tendencies (top-3 BPS frequency) instead of a position average.
**Verified:** 2026-05-02
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `pipeline/bonus.py` exports `compute_bonus_predictions()` returning per-player `bonus_ev` using shrinkage estimator (n_starts >= 4 gate, w = min(1, n/12) blend with position prior) | VERIFIED | File exists; constants RECENT_WINDOW=10, MIN_STARTS_GATE=4, SHRINKAGE_K=12 confirmed at module level; 10 unit tests pass covering gate, blend formula, and window windowing |
| 2 | `merge.py` replaces `BONUS_RATE[element_type]` with per-player EV when `bonus_predictor_enabled=True`; flat rate preserved as fallback | VERIFIED | Lines 243-247: conditional `if bonus_predictor_enabled and bonus_ev is not None: rate = bonus_ev else: rate = BONUS_RATE[element_type]`; BONUS_RATE constant at line 22 unchanged; 5 tests in test_merge_bonus.py pass |
| 3 | Sum integrity: appearance + goal + assist + cs + bonus == total within ±0.01 (or ±0.02 both gates ON) | VERIFIED | test_xpts_components_sum_integrity_with_bonus_flag[False-None, True-1.2, True-None] all PASS with ±0.01; test_xpts_components_sum_integrity_both_gates_on PASSES with ±0.02 |
| 4 | BPS-CS double-counting mitigated for GK/DEF via residualisation `max(0, raw - 0.5 * cs_rate)`; MID/FWD bypass | VERIFIED | bonus.py lines 84-89: `if element_type in (1, 2):` branch applies residualisation; else branch uses `bonus_ev = bonus_ev_raw`; test_defender_bonus_residualised_against_cs and test_attacker_bonus_not_residualised both PASS |
| 5 | Gate defaults OFF (`bonus_predictor_enabled=False`); `accuracy.py` preserves flag across runs | VERIFIED | run.py line 182 `bonus_predictor_enabled = False`; accuracy.py `_read_existing_bonus_predictor_flag` helper mirrors xmins_v2 pattern; 3 accuracy tests (presence, cold-start default, persistence) all PASS |
| 6 | 82 pipeline tests pass | VERIFIED | `python -m pytest pipeline/tests/ -q` → 82 passed |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/bonus.py` | compute_bonus_predictions, _compute_player_bonus_ev, POSITION_PRIOR, RECENT_WINDOW, MIN_STARTS_GATE, SHRINKAGE_K, BONUS_CS_RESIDUAL_FACTOR | VERIFIED | All constants and functions present; module-level `import statistics` only (no function-scope imports) |
| `pipeline/tests/test_bonus.py` | 10 unit tests for shrinkage, fallback, residualisation, return-shape | VERIFIED | 10 test functions present, all pass |
| `pipeline/merge.py` | _compute_xpts_fixture, _xpts_ngw, _compute_xpts_sigma, merge_players extended with bonus kwargs | VERIFIED | 4 functions have `bonus_predictor_enabled: bool = False`; 3 have `bonus_ev: float | None = None`; 1 has `bonus_stats: dict | None = None`; 6 engine call sites thread `bonus_ev=player_bonus_ev` |
| `pipeline/run.py` | compute_bonus_predictions wire-in, flag read, status print, merge_players kwargs | VERIFIED | All 5 edits confirmed present |
| `pipeline/tests/test_merge_bonus.py` | 5 flag-gating tests | VERIFIED | 5 tests pass |
| `pipeline/tests/test_merge_xpts_components.py` | Parametrised sum-integrity tests + both-gates-ON | VERIFIED | 4 new test cases (3 parametrised + 1 both-gates-ON) all pass |
| `pipeline/accuracy.py` | _read_existing_bonus_predictor_flag helper, flag in summary and _empty_backtest | VERIFIED | Helper defined at line 55; call site at line 307; summary key at line 317; _empty_backtest at line 369 |
| `pipeline/tests/test_accuracy.py` | 3 tests for flag presence, cold-start default, persistence | VERIFIED | All 3 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/tests/test_bonus.py` | `pipeline/bonus.py` | `from bonus import _compute_player_bonus_ev, compute_bonus_predictions` | WIRED | Import confirmed; all 10 tests exercise both functions |
| `pipeline/bonus.py:POSITION_PRIOR` | `pipeline/merge.py:BONUS_RATE` | Value parity `{1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}` | WIRED | Both confirmed identical |
| `pipeline/run.py:compute_bonus_predictions call` | `pipeline/merge.py:merge_players(bonus_stats=...)` | kwarg threading | WIRED | `bonus_stats=bonus_stats` and `bonus_predictor_enabled=bonus_predictor_enabled` both present at merge_players call site |
| `pipeline/merge.py:merge_players per-player loop` | `pipeline/merge.py:_xpts_ngw / _compute_xpts_sigma` | bonus_predictor_enabled + per-player bonus_ev kwargs | WIRED | 6 call sites confirmed with `bonus_predictor_enabled=bonus_predictor_enabled, bonus_ev=player_bonus_ev` |
| `pipeline/accuracy.py:_read_existing_bonus_predictor_flag` | `accuracy_backtest.json:summary.bonus_predictor_enabled` | JSON read, default False on exceptions | WIRED | Helper reads key `bonus_predictor_enabled` with `get('summary', {}).get('bonus_predictor_enabled', False)`; persistence test confirms round-trip |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `bonus.py:_compute_player_bonus_ev` | `starts_in_recent` | `summary['history'][-10:]` filtered by `starts == 1` | Yes — reads real element-summary history | FLOWING |
| `merge.py:_compute_xpts_fixture` | `bonus_pts` | `rate * (xmins / 90.0)` where `rate = bonus_ev` from bonus_stats | Yes — per-player EV from BPS history when gate ON; BONUS_RATE fallback when OFF | FLOWING |
| `run.py` | `bonus_stats` | `compute_bonus_predictions(bootstrap, summaries, finished_gws)` | Yes — same summaries cache used by xmins, no extra HTTP calls | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 82 pipeline tests pass | `python -m pytest pipeline/tests/ -q` | 82 passed in 0.12s | PASS |
| bonus.py module-level imports only | `grep -c "import statistics" pipeline/bonus.py` | 1 (module-level only) | PASS |
| BONUS_RATE constant preserved | `grep -c "^BONUS_RATE = " pipeline/merge.py` | 1 | PASS |
| 6 engine call sites thread bonus_ev | `grep -c "bonus_ev=player_bonus_ev" pipeline/merge.py` | 6 | PASS |
| 4 functions accept bonus_predictor_enabled | `grep -c "bonus_predictor_enabled: bool = False" pipeline/merge.py` | 4 | PASS |
| run.py import smoke | `from bonus import compute_bonus_predictions` present at module level | confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BPS-01 | 053-01, 053-02, 053-03 | Per-player bonus EV from BPS data; replaces flat BONUS_RATE; adds bonus_pts to xPts_components_1gw | SATISFIED | All three plans delivered: bonus.py module, merge.py gate wiring, accuracy.py flag persistence |

### Anti-Patterns Found

None identified. Specific checks:
- No TODO/FIXME/placeholder comments in the 5 new/modified files
- No empty implementations (`return null`, `return {}`, `return []`) in the bonus EV path
- `import statistics` is module-level only in bonus.py (Pitfall 6 compliance confirmed)
- BONUS_RATE constant preserved at merge.py line 22 (Pitfall C1 compliance confirmed)
- Gate defaults OFF in both run.py and accuracy.py cold-start path

### Minor Deviation (Non-Blocking)

The plan for `_empty_backtest` specified `'bonus_predictor_enabled': False` (hardcoded). The implementation writes `'bonus_predictor_enabled': _read_existing_bonus_predictor_flag(cache_dir)`, which is an enhancement: it preserves a manually-flipped `True` value even on cold-start paths (matching the CR-01 fix applied to xmins_v2). The cold-start test confirms this still returns `False` when no prior file exists. This is strictly more correct than the plan and all 3 persistence tests pass.

### Human Verification Required

None. All success criteria are verifiable programmatically and confirmed.

### Gaps Summary

No gaps. All 6 success criteria verified against the codebase with full evidence.

---

_Verified: 2026-05-02_
_Verifier: Claude (gsd-verifier)_
