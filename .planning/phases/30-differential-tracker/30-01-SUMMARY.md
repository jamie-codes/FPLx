---
phase: 30-differential-tracker
plan: "01"
subsystem: pipeline + types + tests
tags:
  - pipeline
  - python
  - types
  - differential
  - tdd
dependency_graph:
  requires:
    - "28-01: xPts engine (provides xPts_1gw per player, element_type)"
    - "29-01: regression signal pattern (placement analog for helper + post-loop block)"
  provides:
    - "differential_flag: 'diff' | 'trap' absent per player in merged_players.json"
    - "MergedPlayer.differential_flag?: 'diff' | 'trap' | null TypeScript type"
    - "Wave 0 Vitest stubs (5 it.skip + 6 it.todo + 1 placeholder) for 30-02 Wave 2"
  affects:
    - "30-02: DifferentialBadge.tsx + GemTable Diff column (Wave 2 consumer)"
tech_stack:
  added:
    - "statistics.median (Python stdlib, function-local import in merge_players())"
  patterns:
    - "Helper-before-consumer placement: _compute_differential_flag() before merge_players()"
    - "Post-loop cross-player computation: position-median block after result.append(player)"
    - "D-05 conditional write: differential_flag omitted when None (matches regression_signal)"
    - "T-30-01 mitigation: _safe_float() cast for selected_by_percent"
    - "T-30-02 mitigation: empty-bucket guard (median(vals) if vals else 0.0)"
key_files:
  created:
    - "tests/lib/differential-flag.test.ts — Wave 0 stubs (5 skip + 6 todo + 1 placeholder)"
  modified:
    - "pipeline/merge.py — _compute_differential_flag() helper (lines 386-414) + position-median block (lines 802-823)"
    - "src/lib/types.ts — differential_flag?: 'diff' | 'trap' | null appended to MergedPlayer (line 165)"
decisions:
  - "Function-local `from statistics import median` import (minimises diff churn; stdlib has no failure mode)"
  - "Position medians not persisted to merged_players.json — flag is the only output the UI needs (D-05)"
  - "Strict inequality for median comparison: xPts == position_median returns None for both gates"
metrics:
  duration: "2 minutes"
  completed: "2026-04-28T11:51:30Z"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
---

# Phase 30 Plan 01: Differential Flag Pipeline + Types Summary

**One-liner:** Position-relative median differential flag pipeline computation (`_compute_differential_flag()`) with `_safe_float` T-30-01 mitigation, D-03/D-04/D-12 gate logic, and `MergedPlayer.differential_flag` TypeScript type contract.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 — Create differential-flag.test.ts stubs (RED) | d33ee43 | tests/lib/differential-flag.test.ts |
| 2 | Pipeline — _compute_differential_flag() + position-median pass | b870e88 | pipeline/merge.py |
| 3 | Types — append differential_flag to MergedPlayer | 8cbe4f7 | src/lib/types.ts |

## Implementation Details

### pipeline/merge.py

`_compute_differential_flag()` helper (lines 386–414) placed immediately before `merge_players()`, following the `_compute_regression_signal()` placement convention:

- **D-03 DIFF gate:** `xpts_1gw > position_median AND ownership < 5.0 AND status == 'a'` — all three required
- **D-04 TRAP gate:** `xpts_1gw < position_median AND ownership > 15.0` — status NOT checked (D-12 asymmetry)
- **T-30-01:** `_safe_float(selected_by_percent, 0.0)` used for ownership cast (handles missing/malformed API values)
- **Strict inequality** on median comparison — exact equality returns None for both gates

Post-loop position-median block (lines 802–823) sits between `result.append(player)` (line 800) and `# ---- xPts ceiling classification` (line 824):

- Groups `xPts_1gw` by `element_type` (1=GK, 2=DEF, 3=MID, 4=FWD)
- **T-30-02:** Empty bucket guard — `median(vals) if vals else 0.0`
- **D-05 conditional write:** `p['differential_flag'] = flag` only when flag is not None
- Function-local `from statistics import median` import (stdlib, no requirements.txt change)

### src/lib/types.ts

`differential_flag?: 'diff' | 'trap' | null` declared at line 165 immediately after `actual_vs_xg_delta` (line 160), before MergedPlayer closing brace. D-03/D-04/D-05/D-12 documented in comment block.

### tests/lib/differential-flag.test.ts

Wave 0 stub file with:
- 5 `it.skip` integration tests reading `pipeline/cache/merged_players.json` (require pipeline run)
- 6 `it.todo` component stubs for DifferentialBadge.tsx (filled in by 30-02 Wave 2 Task 1)
- 1 placeholder `it()` ensuring suite exits 0 before implementation

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "def _compute_differential_flag("` pipeline/merge.py | 1 |
| `grep -c "differential_flag"` pipeline/merge.py | 4 |
| `grep -c "from statistics import median"` pipeline/merge.py | 1 |
| `grep -c "differential_flag"` src/lib/types.ts | 1 |
| `grep -c "differential_flag?: 'diff' \| 'trap' \| null"` | 1 |
| Python AST parse | PASSED |
| `npx tsc --noEmit` | PASSED (0 errors) |
| `npx vitest run tests/lib/differential-flag.test.ts` | PASSED (1 pass, 5 skip, 6 todo) |
| Full vitest suite | PASSED (272 passed, 26 skipped, 6 todo — no regression) |
| Block ordering (append < diff-flag < ceiling) | PASSED (800 < 802 < 824) |

## Deviations from Plan

None — plan executed exactly as written.

The `grep -c "it.todo("` returns 7 (not 6 as specified in acceptance criteria) because the header comment line `// Component tests are it.todo()` also matches the pattern. The actual functional `it.todo(` test calls are exactly 6 as required. This is not a behavioral deviation.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced beyond what the plan's threat model covers (T-30-01 through T-30-05 — all mitigated or accepted).

## Self-Check: PASSED

All created files confirmed on disk. All task commits confirmed in git log.
