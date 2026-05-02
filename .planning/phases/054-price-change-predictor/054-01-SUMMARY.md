---
phase: 054-price-change-predictor
plan: 01
subsystem: pipeline
tags: [python, pipeline, price-changes, pytest, tdd]
dependency_graph:
  requires:
    - pipeline/run.py (existing set-piece block — insertion point)
    - pipeline/bonus.py (structural analog)
    - pipeline/tests/conftest.py (sys.path injection)
  provides:
    - compute_price_change_predictions() public function
    - pipeline/cache/price_changes.json (cold-start seed)
    - pipeline/cache/price_changes_snapshot.json (empty snapshot seed)
  affects:
    - pipeline/run.py (imports + PRC-01 block inserted)
tech_stack:
  added: []
  patterns:
    - cumulative net-transfer accumulator persisted across runs via snapshot JSON
    - GW-reset boundary via cost_change_event and last_now_cost comparison
    - snapshot_days from union of distinct ISO dates across all per-player date lists
key_files:
  created:
    - pipeline/price_changes.py (172 lines)
    - pipeline/tests/test_price_changes.py (129 lines)
    - pipeline/cache/price_changes.json (seed: {"predictions": []})
    - pipeline/cache/price_changes_snapshot.json (seed: {})
  modified:
    - pipeline/run.py (337 lines; +1 import, +14 line PRC-01 block inserted)
decisions:
  - "[054-01] Minimal stub price_changes.py (NotImplementedError) created alongside test file to satisfy pytest --collect-only before Task 2 implementation landed"
  - "[054-01] STABLE_NET_FLOOR_RATIO = 0.05 constant used instead of STABLE_NET_FLOOR = 1000 per plan interfaces — ratio-based approach is consistent with the direction rule formula (threshold * 0.05)"
metrics:
  duration: 15 min
  completed: 2026-05-02
  tasks_completed: 3
  files_changed: 5
---

# Phase 54 Plan 01: Price Change Predictor Pipeline Module Summary

**One-liner:** Cumulative net-transfer accumulator with D-03 threshold formula producing rise/fall/stable predictions in `pipeline/price_changes.py`, all 7 Wave 0 pytest cases green, cold-start seeds force-tracked, and PRC-01 block wired into run.py between the set-piece and DefCon blocks.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 — pytest stubs (7 cases) + RED stub | 773be63 | pipeline/tests/test_price_changes.py, pipeline/price_changes.py (stub) |
| 2 | Implement compute_price_change_predictions | 57d1f6b | pipeline/price_changes.py |
| 3 | Cold-start seeds + run.py integration block | 9b8e9db | pipeline/cache/price_changes.json, pipeline/cache/price_changes_snapshot.json, pipeline/run.py |

---

## Pytest Output Summary

```
89 passed in 0.17s
```

All 7 Wave 0 test cases green:
- test_rise_prediction: PASSED
- test_fall_prediction: PASSED
- test_empty_bootstrap: PASSED
- test_confidence_clamp: PASSED
- test_zero_ownership_guard: PASSED
- test_eta_days_zero: PASSED
- test_snapshot_days_count: PASSED

Full pipeline suite: 89/89 tests passing (no regressions in accuracy, bonus, merge, xmins suites).

---

## Git Status: Seed Files Force-Tracked

```
pipeline/cache/price_changes.json        (tracked via git add -f)
pipeline/cache/price_changes_snapshot.json  (tracked via git add -f)
```

Both files confirmed tracked by `git ls-files` despite `pipeline/cache/` being gitignored at `.gitignore` lines 43-44. Follows the established pattern from `set_pieces_snapshot.json`.

---

## run.py Integration Verification

PRC-01 block ordering confirmed correct:
- sp= 232 (set-piece print line)
- prc= 234 (PRC-01 comment line)
- dc= 249 (DefCon stats comment line)

`sp < prc < dc` — insertion is in the correct sequence.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created minimal stub to allow pytest collection**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria for Task 1 required `pytest --collect-only` to exit 0, but pytest cannot collect a test file that imports a non-existent module. This blocked the RED commit.
- **Fix:** Created `pipeline/price_changes.py` with a single `NotImplementedError` stub alongside the test file. This stub was then replaced with the full implementation in Task 2.
- **Files modified:** pipeline/price_changes.py
- **Commit:** 773be63 (stub), 57d1f6b (implementation)

### Plan Deviations (No Impact)

**1. STABLE_NET_FLOOR_RATIO = 0.05 (not STABLE_NET_FLOOR = 1000)**
- The plan frontmatter listed `STABLE_NET_FLOOR = 1000` as a constant but the plan interfaces section specified the direction rule as `abs(cumulative_net) < threshold * 0.05`. The `interfaces` block is the authoritative contract; the ratio-based approach was used. All 7 tests pass confirming correctness.

---

## Known Stubs

None. All output fields are wired to real computation.

---

## Threat Surface Scan

No new threat surface introduced beyond what is documented in the plan's threat model:
- T-054-02 (divide-by-zero on selected_by_percent='0.0') is mitigated: `threshold = max(1.0, ownership * 10)` implemented in `_compute_player_prediction`.
- No new network endpoints, auth paths, file access patterns, or schema changes beyond the documented `pipeline/cache/price_changes*.json` files.

---

## Self-Check: PASSED

All created files exist on disk. All task commits confirmed in git log.

| Check | Result |
|-------|--------|
| pipeline/price_changes.py | FOUND |
| pipeline/tests/test_price_changes.py | FOUND |
| pipeline/cache/price_changes.json | FOUND |
| pipeline/cache/price_changes_snapshot.json | FOUND |
| commit 773be63 (test stubs) | FOUND |
| commit 57d1f6b (implementation) | FOUND |
| commit 9b8e9db (seeds + run.py) | FOUND |
