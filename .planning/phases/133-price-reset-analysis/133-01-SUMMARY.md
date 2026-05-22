---
phase: 133
plan: 01
subsystem: pipeline
tags: [pipeline, python, blob, prst-01, tdd]
dependency_graph:
  requires: [pipeline/upload.py, pipeline/archive_season.py]
  provides: [pipeline/price_baseline.py, price_baseline.json (Blob artifact)]
  affects: [pipeline/run.py]
tech_stack:
  added: []
  patterns: [blob-idempotent-write-once, non-fatal-try-except-in-run.py]
key_files:
  created:
    - pipeline/price_baseline.py
    - pipeline/tests/test_price_baseline.py
  modified:
    - pipeline/run.py
decisions:
  - "D-01: No GW38 or IS_OFF_SEASON gate — capture_price_baseline runs every pipeline run, guarded by _blob_exists"
  - "D-02: now_cost only per player; string keys for JSON roundtrip safety ({ str(id): now_cost })"
  - "D-03: non-fatal try/except in run.py, stderr log on error, mirrors lineup_news pattern"
metrics:
  duration: 8m
  completed: "2026-05-22"
  tasks_completed: 2
  files_changed: 3
---

# Phase 133 Plan 01: Price Baseline Capture Summary

## One-liner

Idempotent `price_baseline.py` write-once step capturing `{ str(id): now_cost }` for all bootstrap elements to Vercel Blob key `price_baseline.json`, wired as unconditional non-fatal call in `run.py`.

## What Was Built

### New Module: pipeline/price_baseline.py

**Constant:**
- `BASELINE_KEY = 'price_baseline.json'`

**Functions:**
- `_blob_exists(pathname: str) -> bool` — lazy-imports `vercel_blob`, calls `vercel_blob.list({'prefix': pathname, 'limit': 1})`, returns `len(blobs) > 0`. Returns `False` on any exception (logs to stderr). Defined at module scope so unit tests can `patch('price_baseline._blob_exists', ...)`.
- `capture_price_baseline(bootstrap: dict) -> None` — execution order: (1) idempotency check via `_blob_exists(BASELINE_KEY)` — returns early if blob present; (2) extract `elements`, skip with stderr warning if empty; (3) build `{ str(el['id']): el['now_cost'] for el in elements if 'now_cost' in el }`; (4) call `save(BASELINE_KEY, baseline)`.

### run.py Integration

**Import site:** Lazy import inside try block (line 147): `from price_baseline import capture_price_baseline`

**Call site (lines 144-151):**
```python
# Phase 133 PRST-01: price baseline capture — write-once idempotent (D-01).
# No GW gate, no IS_OFF_SEASON gate — runs every pipeline run, guarded by _blob_exists.
try:
    from price_baseline import capture_price_baseline
    capture_price_baseline(bootstrap)
    print("Price baseline step complete.")
except Exception as pb_exc:
    print(f"[price_baseline] non-fatal error: {pb_exc}", file=sys.stderr)
```

**Position:** AFTER `save('fpl_bootstrap.json', bootstrap)` (line 142) and BEFORE `events = bootstrap.get('events', [])` (line 156 after insertion). Confirmed NOT inside any `if IS_GW38:` or `if IS_OFF_SEASON:` block.

### Tests: pipeline/tests/test_price_baseline.py

4 tests, all PASS:
1. `test_idempotency_skips_when_baseline_exists` — `_blob_exists` mocked True; asserts `save` not called, `_blob_exists` called once.
2. `test_writes_baseline_when_absent` — `_blob_exists` mocked False; asserts `save` called once with `('price_baseline.json', {'1': 50, '2': 55, '3': 60})`.
3. `test_skips_when_elements_empty` — `_blob_exists` False, empty elements; asserts `save` not called, stderr contains `no elements`.
4. `test_only_now_cost_captured` — bootstrap entry with extra fields; asserts saved value is `int`, not nested dict.

## TDD Gate Compliance

- RED commit `e095fe8`: `test(133-01)` — 4 tests failing with `ModuleNotFoundError`
- GREEN commit `71e193c`: `feat(133-01)` — all 4 tests pass

## D-01 Confirmation: No IS_GW38 / IS_OFF_SEASON Gates Applied

The `capture_price_baseline(bootstrap)` call at run.py line 148 executes unconditionally on every pipeline run. `IS_GW38` detection begins at line 212 and `IS_OFF_SEASON` block at line 260 — both are well after the price baseline step. This satisfies the PRST-01 requirement that the baseline is captured ASAP after season turnover regardless of GW state.

## Verification Results

- `pipeline/tests/test_price_baseline.py`: 4/4 PASS
- `pipeline/run.py --dry-run`: exits 0, no price_baseline errors
- Full pipeline suite: 311/311 tests pass (no regressions)

## Deviations from Plan

None — plan executed exactly as written. Module structure, test shape, and run.py integration site all match the plan specification.

## Known Stubs

None — `price_baseline.py` is a complete, functional write-once pipeline step with no placeholder logic.

## Threat Flags

None — `price_baseline.py` writes only to Vercel Blob (same trust boundary as all other pipeline artifacts). No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

Files exist:
- `pipeline/price_baseline.py` ✓
- `pipeline/tests/test_price_baseline.py` ✓
- `pipeline/run.py` (modified) ✓

Commits exist:
- `e095fe8` (test RED) ✓
- `71e193c` (feat GREEN) ✓
