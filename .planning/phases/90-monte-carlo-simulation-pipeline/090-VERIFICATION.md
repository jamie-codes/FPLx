---
phase: 90-monte-carlo-simulation-pipeline
verified: 2026-05-10T13:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 90: Monte Carlo Simulation Pipeline — Verification Report

**Phase Goal:** Pipeline produces per-player 5-GW xPts uncertainty bands (p10/p50/p90) and a rank trajectory under uncertainty — written into merged_players.json so every downstream consumer can read distributional data without any new HTTP round-trip
**Verified:** 2026-05-10T13:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | simulate.py runs ≥1000 MC iterations per player over 5 GWs; writes xPts_5gw_p10/p50/p90 and rank_trajectory per player | ✓ VERIFIED | `N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))` at line 46; _simulate_player returns all 4 fields; compute_simulations builds rank_trajectory cross-player; 12 passing tests including test_5gw_percentile_invariants |
| 2 | mc_enabled gate in accuracy_backtest.json (default OFF) — when OFF, simulate.py skipped entirely; fields absent (not zero-filled) | ✓ VERIFIED | run.py line 223: `if mc_enabled:` guards `merged = compute_simulations(...)`; gate initialized False at line 193; read from backtest JSON at line 203; test_mc_enabled_off_skip passes (greps run.py source for both strings) |
| 3 | BGW contributes zero per iteration; DGW runs two fixtures combined; both covered by pytest cases | ✓ VERIFIED | BGW pad: `while len(total_pts_by_gw) < 5: total_pts_by_gw.append(np.zeros(N_SIMS))` at simulate.py line 153; DGW: groupby sums across fixtures sharing same event_id; test_5gw_bgw_zero_fill and test_5gw_dgw_combine both pass |
| 4 | Iteration count ≥1000 with MC_ITERATIONS env var; MC_SEED determinism; pytest cases cover both | ✓ VERIFIED | simulate.py line 46-48: env-var form with 1000 floor; seeded RNG at compute_simulations line 200; test_iteration_count_gate and test_seed_determinism pass |
| 5 | simulate.py MUST NOT import from merge.py (D-04 isolation) | ✓ VERIFIED | grep of actual import statements returns 0 matches; the 3 grep hits are all docstring text ("no import from merge.py") — not import statements |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/simulate.py` | 5-GW cumulative MC; MC_ITERATIONS/MC_SEED env vars; D-04 isolation | ✓ VERIFIED | 238 lines; N_SIMS env-var form; MC_SEED; _simulate_player returns 8 fields; compute_simulations builds rank_trajectory and strips _p50_by_horizon scratch; no merge.py import |
| `pipeline/run.py` | mc_enabled gate read + conditional compute_simulations call | ✓ VERIFIED | `mc_enabled = False` initializer (line 193); try-block read (line 203); print statement (line 211); `if mc_enabled:` guard (line 223); `merged = compute_simulations(...)` indented under guard (line 224) |
| `pipeline/accuracy.py` | _read_existing_mc_enabled_flag helper; mc_enabled in summary + version gate_flags + cold-start | ✓ VERIFIED | Helper at line 91; mc_enabled in compute_accuracy_backtest summary (line 424) and gate_flags (line 406); cold-start _empty_backtest summary (line 506) and gate_flags (line 492); read at lines 392 and 477 |
| `pipeline/tests/test_simulate.py` | 12 test functions (5 Phase 61 + 6 Phase 90 + 1 cold-start) | ✓ VERIFIED | 12 tests collected; all 12 pass in 0.12s |
| `src/lib/types.ts` | 4 new optional MC fields on MergedPlayer after p90_pts | ✓ VERIFIED | Lines 194-197: xPts_5gw_p10?/xPts_5gw_p50?/xPts_5gw_p90?/rank_trajectory? all present with ?: syntax after p90_pts (line 190); Phase 90 MC-01 comment block at line 191 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| run.py mc_enabled gate | simulate.py compute_simulations | `if mc_enabled: merged = compute_simulations(merged, xmins_v2_enabled)` | ✓ WIRED | Lines 223-224 confirmed; guard is unconditional parent of call |
| simulate.py _simulate_player | rank_trajectory cross-player block | `_p50_by_horizon` scratch field written + consumed + stripped | ✓ WIRED | _p50_by_horizon written in return dict (line 172-174); consumed in rank_trajectory loop (line 221); stripped with p.pop() at line 234 |
| simulate.py module constants | os.environ MC_ITERATIONS / MC_SEED | `max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))` | ✓ WIRED | Lines 46-48 confirmed |
| accuracy.py _read_existing_mc_enabled_flag | accuracy_backtest.json summary.mc_enabled | JSON key read with FileNotFoundError/JSONDecodeError/OSError fallback | ✓ WIRED | Lines 91-105 confirmed; try/except tuple matches Phase 83 pattern |
| accuracy.py _empty_backtest cold-start | summary.mc_enabled preservation | `_read_existing_cache(cache_dir)` → `bool(.get('summary', {}).get('mc_enabled', False))` | ✓ WIRED | Line 477; test_accuracy_mc_enabled_cold_start verifies both cold (False) and warm (True preserved) paths |
| MergedPlayer.xPts_5gw_p50 type | simulate.py output dict | JSON serialization of merged_players.json | ✓ WIRED | Type declared optional ?: matching simulate.py return dict key; downstream consumers check presence per D-05 |

### Data-Flow Trace (Level 4)

Phase 90 does not add UI components — the data flow endpoint is `merged_players.json` written by the pipeline, not a rendered component. The data-flow trace applies at the pipeline level:

| Stage | Data Variable | Source | Produces Real Data | Status |
|-------|--------------|--------|--------------------|--------|
| simulate.py | xPts_5gw_p50 | Poisson RNG over player fixtures | Yes — np.percentile of cumulative MC iterations | ✓ FLOWING |
| simulate.py | rank_trajectory | _p50_by_horizon cross-player sort | Yes — derived from live simulation results | ✓ FLOWING |
| run.py | merged_players.json | compute_simulations return | Yes — guarded by if mc_enabled; absent when OFF | ✓ FLOWING |
| accuracy.py | accuracy_backtest.json summary.mc_enabled | _read_existing_cache prior cache | Yes — preserved flag or False cold-start | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 12 tests pass (all Phase 61 + Phase 90) | `python -m pytest pipeline/tests/test_simulate.py -v --tb=no -q` | 12 passed in 0.12s | ✓ PASS |
| D-04: no actual merge import in simulate.py | grep pattern on actual import lines | 0 import matches (3 hits are docstring text only) | ✓ PASS |
| mc_enabled guard present in run.py | grep `if mc_enabled:` | Line 223 confirmed | ✓ PASS |
| All 4 TS fields present as optional | grep on src/lib/types.ts | Lines 194-197 confirmed with ?: syntax | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MC-01 | 090-01, 090-02, 090-03 | Per-player MC simulation over 5 GWs — ≥1000 iterations, xPts_5gw_p10/p50/p90 and rank_trajectory written to merged_players.json; gated by mc_enabled | ✓ SATISFIED | All 5 ROADMAP success criteria verified; 12 tests pass; all artifacts substantive and wired |

### Anti-Patterns Found

None. Scan of simulate.py, run.py, accuracy.py, test_simulate.py, and types.ts found no TODO/FIXME/placeholder comments, no empty implementations, no hardcoded empty returns in Phase 90 code paths, no stub handlers.

### Human Verification Required

None. All phase deliverables are backend pipeline (Python) and TypeScript type declarations — fully verifiable programmatically. Frontend consumption of xPts_5gw_p10/p50/p90 and rank_trajectory fields is explicitly deferred to downstream phases per CONTEXT.md.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria for Phase 90 / MC-01 are satisfied by substantive, wired, data-flowing implementations confirmed in the actual codebase files.

---

_Verified: 2026-05-10T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
