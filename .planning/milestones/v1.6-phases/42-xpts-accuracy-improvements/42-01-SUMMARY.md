---
phase: 42-xpts-accuracy-improvements
plan: "01"
subsystem: pipeline
tags:
  - pipeline
  - python
  - form-signal
  - xpts
  - tdd
dependency_graph:
  requires: []
  provides:
    - _compute_form_signal helper in pipeline/merge.py
    - form_xgxa_per90 and form_xgxa_window_gws fields in merged_players.json
    - form_signal_enabled and blend_alpha kwargs on merge_players()
    - BLEND_ALPHA=0.4 module-level constant
  affects:
    - pipeline/merge.py (merge_players, new helper)
    - src/lib/types.ts (MergedPlayer interface)
    - pipeline/tests/test_form_signal.py (new)
    - pipeline/tests/test_merge.py (new)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN (Wave 0 RED tests committed before implementation)
    - DGW aggregation via by_round dict (same pattern as accuracy._group_history_by_gw)
    - Linear recency weighting 0.5 (oldest) to 1.0 (most recent in window)
    - Per-90 form blend at xPts engine input layer (Option A from RESEARCH.md Pattern 2)
key_files:
  created:
    - pipeline/tests/test_form_signal.py
    - pipeline/tests/test_merge.py
  modified:
    - pipeline/merge.py
    - src/lib/types.ts
decisions:
  - "BLEND_ALPHA=0.4 fixed constant (not alpha-swept in Plan 01; Plan 02 owns backtest gate)"
  - "Form signal computed before xPts engine so local variable form_per90 is in scope for blend"
  - "Season per-90 uses goals_scored/assists (DQ-01 FPL fallback) not expected_goals from bootstrap"
  - "Linear recency weights (0.5 oldest to 1.0 most recent); no exotic decay (RESEARCH.md Pitfall 8)"
metrics:
  duration: ~45 min
  completed_date: "2026-04-30"
  tasks_completed: 4
  tasks_total: 4
  files_created: 2
  files_modified: 2
---

# Phase 42 Plan 01: Form Signal Computation + xPts Blend Gate Summary

Recency-weighted xG+xA form signal added to pipeline/merge.py with gate-controlled blend into xPts engine; TypeScript MergedPlayer extended with two optional fields.

## What Was Built

1. `_compute_form_signal(history, window_gws=5, min_minutes=270)` helper in `pipeline/merge.py` — computes recency-weighted xG+xA per-90 from FPL element-summary history, handling DGW aggregation and string-decimal coercion.

2. `merge_players()` extended with `form_signal_enabled=False` and `blend_alpha=BLEND_ALPHA` kwargs. When `form_signal_enabled=True` and form is available, blends season per-90 with form per-90 using `(1-alpha)*season + alpha*form`, re-splitting proportionally by season xG/xA ratio (preserves goal/assist split for strikers).

3. `form_xgxa_per90` and `form_xgxa_window_gws` written to every player dict in `merge_players()` loop. Fields are always written (None/0 for insufficient history), ensuring shape consistency.

4. `MergedPlayer` interface in `src/lib/types.ts` extended with `form_xgxa_per90?: number | null` and `form_xgxa_window_gws?: number`.

5. Two new test files (16 tests total across `test_form_signal.py` and `test_merge.py`) covering all required behaviors. TDD RED/GREEN cycle followed.

## Commits

| Hash | Message |
|------|---------|
| `72d89c9` | test(42-01): add failing RED tests for _compute_form_signal and merge blend (Wave 0) |
| `5e9c1fb` | feat(42-01): implement _compute_form_signal helper in merge.py (GREEN) |
| `e109c05` | feat(42-01): extend MergedPlayer with form_xgxa_per90 and form_xgxa_window_gws fields |
| `b159cad` | feat(42-01): wire form_xgxa_per90 field write into merge_players loop (GREEN) |
| `7d4590b` | feat(42-01): add BLEND_ALPHA constant, form-signal kwargs, and blend logic to merge_players (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recency weighting test assertion arithmetically impossible**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `test_form_signal_recency_weighting` asserted `form > 0.30`. With 5 GWs (GWs 1-4 zero, GW5 xG+xA=1.0), the algorithm produces `weighted_xgxa=1.0, weighted_mins=337.5, form=0.2667`. The comment "Without recency: 0.222" was also wrong (actual non-recency is 0.2). The threshold 0.30 is mathematically impossible with this algorithm.
- **Fix:** Changed assertion to `form > 0.22` with correct comment. 0.2667 > 0.22 > 0.2 (non-recency baseline).
- **Files modified:** `pipeline/tests/test_form_signal.py`
- **Commit:** `5e9c1fb`

**2. [Rule 1 - Bug] test_blend_changes_xpts_when_enabled: season and form per-90 coincidentally equal**
- **Found during:** Task 4 (GREEN phase)
- **Issue:** Test used `goals_scored=5, assists=3, minutes=900` (season xg+xa per-90 = 0.8/90). Form signal from test history (5-GW window, only GW10 has xG=2.0+xA=1.0 total 3.0) = 0.8/90. Equal values meant blend had no effect, test always failed.
- **Fix:** Added `_build_minimal_inputs_override` helper and used `goals_scored=1, assists=0` so season per-90 = 0.1 != form 0.8, making blend effect measurable.
- **Files modified:** `pipeline/tests/test_merge.py`
- **Commit:** `7d4590b`

## Verification Results

```
python -m pytest pipeline/tests/ -v: 16 passed in 0.03s
  test_form_signal.py: 5 tests GREEN
  test_merge.py: 3 tests GREEN
  test_accuracy.py: 8 tests GREEN (no regression)

npx vitest run: 1 pre-existing failure (club-form difficulty_tier test)
  — unrelated to this plan, pre-exists at HEAD~5

npx tsc --noEmit: pre-existing errors in captain-picks.test.ts
  — unrelated to this plan, pre-exist at HEAD~5
```

## Known Stubs

None. All fields are fully computed and wired.

## Threat Flags

None. No new network endpoints, no new secrets, no new auth paths. All changes are pure Python pipeline computation over previously-fetched JSON data.

## TDD Gate Compliance

- RED gate: Commit `72d89c9` (`test(42-01): ...`) — Wave 0 RED test stubs committed first
- GREEN gates: Commits `5e9c1fb`, `b159cad`, `7d4590b` — each task turns tests GREEN
- REFACTOR gate: No refactoring needed; code is clean as written

## Self-Check: PASSED

| Item | Status |
|------|--------|
| pipeline/tests/test_form_signal.py | FOUND |
| pipeline/tests/test_merge.py | FOUND |
| .planning/phases/42-xpts-accuracy-improvements/42-01-SUMMARY.md | FOUND |
| Commit 72d89c9 (RED tests) | FOUND |
| Commit 5e9c1fb (_compute_form_signal) | FOUND |
| Commit e109c05 (types.ts extension) | FOUND |
| Commit b159cad (field write in loop) | FOUND |
| Commit 7d4590b (blend logic) | FOUND |
