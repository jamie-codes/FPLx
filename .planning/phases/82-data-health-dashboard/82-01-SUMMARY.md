---
phase: 82
plan: 01
subsystem: pipeline
tags: [pipeline, observability, python, pytest, tdd]
dependency_graph:
  requires: []
  provides: [pipeline/data_health.py, pipeline/cache/data_health.json]
  affects: [pipeline/run.py]
tech_stack:
  added: []
  patterns: [pytest TDD RED/GREEN, nested try/except non-fatal guard, timestamps accumulator]
key_files:
  created:
    - pipeline/data_health.py
    - pipeline/tests/test_data_health.py
  modified:
    - pipeline/run.py
decisions:
  - "[D-19 T-82-01] Path stripping runs before env-var token stripping to prevent token pattern re-matching path components"
  - "[D-16] First-run missing_player_delta=0 uses None sentinel for prev_player_count (not 0) to distinguish no-prior-data from zero-delta"
  - "[D-12] Used aliased imports _dt_dh/_tz_dh to avoid shadowing the existing 'from datetime import datetime, timezone' at line 356 of run.py"
metrics:
  duration: ~3 minutes
  completed: "2026-05-08T18:24:41Z"
  tasks: 3
  files: 3
---

# Phase 82 Plan 01: Pipeline Data Health Artifact Summary

**One-liner:** Python pipeline observability artifact `data_health.json` with four sanity checks, per-artifact write timestamps, error sanitization, and 11 pytest cases (TDD RED/GREEN).

## What Was Built

### `pipeline/data_health.py` (new)

Public `compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False) -> dict`:
- Reads prior `data_health.json` before overwriting to get `prev_player_count` (D-15)
- First-run guard: `prev_player_count = None`, `missing_player_delta = 0`, status = `ok` (D-16)
- Four sanity checks per CONTEXT.md D-02..D-05:
  - `player_count`: ok >= 700, warn >= 550, error < 550
  - `missing_player_delta`: absolute delta; ok <= 5, warn <= 20, error > 20
  - `understat_null_pct`: `len(merged)` denominator (Pitfall 5); ok < 15%, warn < 30%, error >= 30%
  - `pipeline_stale`: binary; error if True, ok if False
- Three raw null-xG counts (stored, not sanity checks): `understat_id_null_count`, `fpl_proxy_fallback_count`, `xg_per90_null_count`
- Writes result via `save('data_health.json', result)` (local import to keep module testable without USE_BLOB)

Private `_sanitize_error(exc) -> str`:
- Strips absolute paths first (POSIX `/home/...` and Windows `C:\...`) via `_PATH_PATTERN`
- Then strips env-var-shaped tokens (`\b[A-Z][A-Z0-9_]{3,}\b`) via `_ENV_VAR_PATTERN`
- Truncates to 200 chars (T-82-01 mitigated)
- Order: path before env-var prevents token pattern from re-matching stripped path fragments

### `pipeline/tests/test_data_health.py` (new)

11 pytest unit tests per VALIDATION.md task map 82-01-01..82-01-11:
- Shape and key completeness (82-01-01)
- `player_count` thresholds: ok (800), warn (600), error (500) (82-01-02..04)
- First-run delta logic: prev_player_count=None, delta=0, status=ok (82-01-05)
- Prior-JSON delta read: 832→820 = delta=12, status=warn (82-01-06)
- Sanitize: token stripping, path stripping, truncation (82-01-07..09)
- `understat_null_pct` thresholds: 20%=warn, 35%=error (82-01-10)
- `pipeline_stale` binary check (82-01-11)

### `pipeline/run.py` (modified)

Three localised edits inside the main `try` block:

1. **Timestamps accumulator** initialised at top of try block using aliased `_dt_dh`/`_tz_dh` imports to avoid UnboundLocalError before the existing `from datetime import datetime, timezone` at line 356.

2. **Five timestamp recordings** after tracked `save()` calls:
   - After first `save('merged_players.json', ...)` (post-simulations)
   - After second `save('merged_players.json', ...)` (post-rotation_risk re-save) — overwrites with more recent time
   - After `save('insights.json', ...)`
   - After `save('gw_intel.json', ...)`
   - After `save('accuracy_backtest.json', ...)`
   - After `save('last_updated.json', ...)`

3. **Final compute step** — nested try/except mirrors prose_summary pattern (Pitfall 1 / T-82-02):
   ```python
   try:
       from data_health import compute_data_health
       compute_data_health(merged, timestamps, cache_dir, pipeline_stale=False)
       print("Data health written.")
   except Exception as dh_exc:
       print(f"[data_health] non-fatal error: {dh_exc}", file=sys.stderr)
   ```

## Test Evidence

```
python3 -m pytest pipeline/tests/test_data_health.py -x -q
11 passed in 0.04s

python3 -m pytest pipeline/tests/ -q
142 passed in 0.25s   (131 existing + 11 new; no regressions)

python3 pipeline/run.py --dry-run
Dry run complete — USE_BLOB=false, source=local
```

## TDD Gate Compliance

- RED gate: `test(82-01): add Wave 0 RED tests for data_health.py contract` (commit c4b4813) — collection failed with `ModuleNotFoundError: No module named 'data_health'`
- GREEN gate: `feat(82-01): implement compute_data_health and _sanitize_error` (commit 30034f7) — 11/11 passed

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor implementation choice:

**Decision: aliased datetime imports** — Task 3 specifies adding `from datetime import datetime, timezone` at the top of the try block. The existing `from datetime import datetime, timezone` at line 356 is a local import inside a comment block. To avoid `UnboundLocalError` in the earlier try-block lines (212, 217, 221, etc.) while also not shadowing or duplicating the late import, the accumulator import uses `_dt_dh`/`_tz_dh` aliases. The original late import at line 356 remains harmless. This matches the plan's "your choice; either is fine" note.

## Known Stubs

None — this plan writes a complete artifact; no UI stubs or placeholder values.

## Threat Flags

All threats from `<threat_model>` have been mitigated:
- T-82-01: `_sanitize_error` strips env-var tokens + absolute paths; pytest evidence in 82-01-07, 82-01-08, 82-01-09
- T-82-02: `compute_data_health` step wrapped in nested try/except (mirrors prose_summary pattern)
- T-82-03: JSON read bounded (few KB); JSONDecodeError caught; accepted per plan

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

All files exist:
- FOUND: pipeline/data_health.py
- FOUND: pipeline/tests/test_data_health.py
- FOUND: pipeline/run.py
- FOUND: .planning/phases/82-data-health-dashboard/82-01-SUMMARY.md

All commits exist:
- FOUND: c4b4813 (Task 1 RED tests)
- FOUND: 30034f7 (Task 2 data_health.py)
- FOUND: 842a2d2 (Task 3 run.py)
