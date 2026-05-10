---
phase: 92
plan: "01"
subsystem: tests
tags:
  - pipeline
  - data-health
  - recharts
  - sparkline
  - tdd-red
dependency_graph:
  requires: []
  provides:
    - "RED gate contract for _append_history + _compute_overall_status (pipeline/data_health.py)"
    - "RED gate contract for DataHealthSparkline + HistoryEntry (src/components/accuracy/AccuracyTab.tsx + src/lib/types.ts)"
  affects:
    - pipeline/data_health.py
    - src/lib/types.ts
    - src/components/accuracy/AccuracyTab.tsx
tech_stack:
  added: []
  patterns:
    - "pytest tmp_path fixture with JSON round-trip (3-run atomic write simulation)"
    - "Vitest describe-append pattern for TDD RED gate"
key_files:
  created:
    - pipeline/tests/test_data_health_history.py
  modified:
    - src/components/accuracy/AccuracyTab.test.tsx
decisions:
  - "RED test for 'renders nothing' passes because data-health-panel testid already exists; this is acceptable — 4/5 new tests fail confirming RED state"
  - "HistoryEntry type resolves as any in esbuild transpilation; runtime assertion failures on missing sparkline data-testid confirm RED without TS compile errors in Vitest"
metrics:
  duration: "~8 min"
  completed: "2026-05-10"
  tasks_completed: 2
  files_modified: 2
---

# Phase 92 Plan 01: DH-04 RED Gate Tests Summary

Wave 0 RED gate for Phase 92 DH-04 (Cron History Sparkline): 4 pytest cases for pipeline helpers and 5 Vitest cases for the DataHealthSparkline component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create pipeline/tests/test_data_health_history.py with 4 RED pytest cases | c2fcca1 | pipeline/tests/test_data_health_history.py (NEW) |
| 2 | Append 5 RED Vitest cases to AccuracyTab.test.tsx | 935f342 | src/components/accuracy/AccuracyTab.test.tsx |

## Pytest Cases Added (pipeline/tests/test_data_health_history.py)

**File:** `pipeline/tests/test_data_health_history.py` (NEW — 115 lines)

| Test | ID | Description | RED failure mode |
|------|----|-------------|-----------------|
| `test_append_and_fifo_cap` | 92-01-01 | `_append_history(seven_entries, 'warning', ts)` caps at 7 FIFO, oldest dropped | `ImportError: cannot import name '_append_history'` |
| `test_cold_start_empty_history` | 92-01-02 | `_append_history([], 'ok', ts)` returns 1-entry list | `ImportError: cannot import name '_append_history'` |
| `test_status_enum_normalisation` | 92-01-03 | `_compute_overall_status(['warn', 'ok'])` returns `'warning'` (not `'warn'`) | `ImportError: cannot import name '_append_history'` |
| `test_atomic_write_order` | 92-01-04 | 3 sequential `compute_data_health` calls grow history 1→2→3, chronological | `ImportError: cannot import name '_append_history'` |

**RED state confirmed by:**
```
ERROR collecting tests/test_data_health_history.py
ImportError: cannot import name '_append_history' from 'data_health' (pipeline/data_health.py)
exit code: 4
```

## Vitest Cases Added (src/components/accuracy/AccuracyTab.test.tsx)

**Describe block:** `describe('Phase 92 DH-04: DataHealthSparkline')` (appended after line 449)

| Test | Description | RED failure mode |
|------|-------------|-----------------|
| `renders 7 dots for a 7-entry history` | `[data-testid="data-health-sparkline"]` truthy + 7 `circle` elements | `expected null to be truthy` (sparkline absent) |
| `dot colour maps ok->green, warning->amber, error->red via CSS vars` | circle fills contain CSS vars for each status | `TypeError: Cannot read properties of null (reading 'querySelectorAll')` |
| `tooltip shows timestamp + status label on hover` | mouseOver circle; either status label text OR tooltip wrapper class | `TypeError: Cannot read properties of null (reading 'querySelectorAll')` |
| `cold-start placeholder renders when history is empty array` | sparkline present + 1 circle with `fill="var(--muted)"` | `expected null to be truthy` (sparkline absent) |
| `renders nothing when history field is absent from data` | sparkline is null; data-health-panel is present | **PASSES** (see Decisions) |

**RED state confirmed by:**
```
Tests  4 failed | 23 passed (27)
exit code: 1
```

The 4 failures all reference `[data-testid="data-health-sparkline"]` not existing in the rendered AccuracyTab. The "renders nothing" test passes because `querySelector` correctly returns null for the absent sparkline, and the `data-health-panel` testid already exists in AccuracyTab.tsx from Phase 82 DH-02.

## Pre-existing Tests: No Regression

```
cd pipeline && python -m pytest tests/test_data_health.py
16 passed in 0.09s   ✓
```

The original Phase 41/63/91 AccuracyTab describe blocks (22 tests) continue passing.

## Import Extension

`AccuracyTab.test.tsx` line 20 was extended:
- Before: `import type { AccuracyBacktest } from '@/lib/types'`
- After: `import type { AccuracyBacktest, DataHealth, HistoryEntry } from '@/lib/types'`

`HistoryEntry` does not yet exist in `src/lib/types.ts` — this is part of the RED contract. Vitest's esbuild transpiler treats unknown types as `any` at runtime, so tests execute and fail on DOM assertions rather than type-check errors.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates only test files. No production stubs introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test-only changes — no threat surface delta.

## Self-Check: PASSED

- `pipeline/tests/test_data_health_history.py` exists: FOUND
- `src/components/accuracy/AccuracyTab.test.tsx` contains `describe('Phase 92 DH-04: DataHealthSparkline'`: FOUND
- Commit c2fcca1 exists: FOUND
- Commit 935f342 exists: FOUND
- Pytest exits non-zero (RED): CONFIRMED (exit 4, ImportError)
- Vitest exits non-zero (RED): CONFIRMED (4 failed, exit 1)
- Pre-existing tests green: CONFIRMED (16 pytest + 22 vitest pass)
