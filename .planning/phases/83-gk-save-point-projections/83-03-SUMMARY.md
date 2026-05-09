---
phase: 83-gk-save-point-projections
plan: "03"
subsystem: pipeline
tags: [python, pytest, gk, gate, accuracy, run, save-predictor]

requires:
  - phase: 83-02
    provides: pipeline/merge.py with save_predictor_enabled kwarg on merge_players() signature

provides:
  - pipeline/accuracy.py _read_existing_save_predictor_flag helper + derive calls in compute_accuracy_backtest and _empty_backtest + summary writes in both paths + gate_flags entries in version records
  - pipeline/run.py declaration default, prev_backtest read, status print, merge_players kwarg
  - pipeline/tests/test_saves.py 3 new gate-cold-start / preserved / missing-key pytest cases

affects:
  - 83-04 (columns.tsx XPtsCell save_pts component row — TypeScript type and Vitest invariant test)
  - future pipeline runs (save_predictor_enabled now threaded end-to-end; manually flip summary.save_predictor_enabled=true in accuracy_backtest.json after >=5-GW non-regression shadow run to activate)

tech-stack:
  added: []
  patterns:
    - "Gate flag read/preserve/write via _read_existing_cache (WR-02 pattern) — derive from prior_cache.get('summary', {}).get(key, False), write back to summary in BOTH compute_accuracy_backtest and _empty_backtest (Pitfall 7)"
    - "Cold-start False default — no accuracy_backtest.json means gate stays OFF; no pipeline crash"
    - "Manual flip persistence — once accuracy_backtest.json summary.save_predictor_enabled=true, subsequent runs preserve it without recomputing"

key-files:
  created: []
  modified:
    - pipeline/accuracy.py
    - pipeline/run.py
    - pipeline/tests/test_saves.py

key-decisions:
  - "save_predictor_enabled derived from prior_cache (WR-02 single-read pattern), NOT via the new _read_existing_save_predictor_flag helper — the helper exists for external callers; internal derivation uses _read_existing_cache for consistency with xmins_v2_enabled and bonus_predictor_enabled"
  - "Gate ships permanently OFF for v1.14 — no flip operation in this phase; requires >=5-GW shadow run non-regression evidence per RESEARCH.md before activation"
  - "Pitfall 7 (_empty_backtest dual-write) — both compute_accuracy_backtest and _empty_backtest must write save_predictor_enabled so a cold-start season-opening run does not silently reset a manually-flipped True"

patterns-established:
  - "Pattern: gate_flags dict in version records now tracks 4 gates (form_signal_enabled, xmins_v2_enabled, bonus_predictor_enabled, save_predictor_enabled) — future gates follow the same extend-all-three-sites sequence"
  - "Pattern: test_gate_cold_start / test_gate_preserved_when_cache_has_true / test_gate_default_when_cache_missing_key — standard 3-case gate test battery for new accuracy.py flag helpers"

requirements-completed: [GK-03]

duration: ~2min
completed: 2026-05-09
---

# Phase 83 Plan 03: GK Save-Point Projections — Gate Plumbing Summary

**`save_predictor_enabled` gate wired end-to-end: new `_read_existing_save_predictor_flag` helper in accuracy.py, flag derived and written at 7 sites across `compute_accuracy_backtest` and `_empty_backtest`, and threaded through run.py (declare / read / print / kwarg) to merge_players; 3 cold-start/preserved/missing-key pytest cases confirm flag durability**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-09T08:51:20Z
- **Completed:** 2026-05-09T08:53:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

### Task 1 — accuracy.py Gate Plumbing (commit `b4416d8`)

7 additive changes applied to `pipeline/accuracy.py`:

1. **New helper** `_read_existing_save_predictor_flag(cache_dir: str) -> bool` at line 73 — mirrors `_read_existing_bonus_predictor_flag` exactly; `try/except (FileNotFoundError, json.JSONDecodeError, OSError)` returns `False` on cold start or malformed cache (T-83-03-02 mitigated)
2. **Derive call in `compute_accuracy_backtest`** at line 373 — `save_predictor_enabled = bool(prior_cache.get('summary', {}).get('save_predictor_enabled', False))` (WR-02 single-read pattern)
3. **gate_flags entry in `compute_accuracy_backtest` version record** at line 386 — audit trail for Phase 63 VER-01 dedup-append (T-83-03-04 mitigated)
4. **summary write in `compute_accuracy_backtest` return** at line 403 — `'save_predictor_enabled': save_predictor_enabled` with Phase 83 GK-03 comment
5. **Derive call in `_empty_backtest`** at line 454 — Pitfall 7: cold-start path must also read prior cache or manual True flip is silently lost (T-83-03-01 mitigated)
6. **gate_flags entry in `_empty_backtest` version record** at line 468 — same as change 3
7. **summary write in `_empty_backtest` return** at line 481 — same as change 4

### Task 2 — run.py Threading + 3 Pytest Cases (commit `63a1a0a`)

4 changes to `pipeline/run.py`:

- **Line 192** — `save_predictor_enabled = False` default declaration (before try block)
- **Line 201** — `save_predictor_enabled = prev_backtest.get('summary', {}).get('save_predictor_enabled', False)` inside try block (immediately after bonus_predictor_enabled read)
- **Line 208** — `print(f"Save predictor (GK Poisson-floor): {'ENABLED' if save_predictor_enabled else 'DISABLED'}")` (T-83-03-03 accepted: non-sensitive operational metadata)
- **Line 218** — `save_predictor_enabled=save_predictor_enabled` as last kwarg to `merge_players()`

3 new pytest cases added to `pipeline/tests/test_saves.py`:

- `test_gate_cold_start` — empty tmp_path, asserts `_read_existing_save_predictor_flag` returns `False`
- `test_gate_preserved_when_cache_has_true` — cache with `summary.save_predictor_enabled=True`, asserts result is `True` (T-83-03-01 test companion)
- `test_gate_default_when_cache_missing_key` — cache with `bonus_predictor_enabled=True` but no save flag, asserts `False`

## pytest Count Delta

| File | Before | After | Delta |
|------|--------|-------|-------|
| `test_saves.py` | 11 | 14 | +3 |
| Full pipeline suite | 153 | 156 | +3 |

## Task Commits

Each task was committed atomically:

1. **Task 1: accuracy.py gate plumbing** — `b4416d8` (feat)
2. **Task 2: run.py threading + gate pytest cases** — `63a1a0a` (feat)

## Files Created/Modified

- `pipeline/accuracy.py` — 7 additive changes: new `_read_existing_save_predictor_flag` helper + 2 derive calls + 2 summary writes + 2 gate_flags entries in version records
- `pipeline/run.py` — 4 changes: declaration, read from prev_backtest, print, kwarg to merge_players
- `pipeline/tests/test_saves.py` — 3 new gate tests (added import of `_read_existing_save_predictor_flag` from accuracy)

## Decisions Made

- `save_predictor_enabled` derived from `prior_cache` (WR-02 single-read) rather than calling `_read_existing_save_predictor_flag` internally — the helper exists for external/test callers; internal derivation reuses the already-loaded cache dict for consistency with `xmins_v2_enabled` and `bonus_predictor_enabled`
- Gate ships permanently OFF in v1.14 — no flip operation is part of this phase; requires >=5-GW shadow-run non-regression evidence per RESEARCH.md (D-09) before activation

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stubs in this plan. All gate plumbing is fully wired. The gate itself is OFF by default (intentional — requires shadow-run evidence before activation).

## Threat Flags

None — no new network endpoints, auth paths, or file access surfaces introduced. T-83-03-01 through T-83-03-04 all mitigated per plan threat model.

## Gate Ships OFF Note

The `save_predictor_enabled` gate is `False` everywhere at pipeline startup. To activate after >=5-GW non-regression evidence:
1. Edit `pipeline/cache/accuracy_backtest.json` → set `summary.save_predictor_enabled = true`
2. The next pipeline run will read and preserve `true` through both `compute_accuracy_backtest` and `_empty_backtest` paths
3. `merge_players` will receive `save_predictor_enabled=True` and GKs will receive `save_pts > 0` in their `xPts_components_1gw`

## Next Phase Readiness

**Plan 04** (columns.tsx XPtsCell save_pts row, TypeScript type extension, Vitest invariant test) can now:
- Extend `xPts_components_1gw` type in `src/lib/types.ts` to add `save_pts?: number`
- Add `save_pts ?? 0` to `cardTotal` in `XPtsCell`
- Conditionally render `['Saves', c.save_pts.toFixed(2)]` row when `c.save_pts > 0 && elementType === 1`
- Write `XPtsCell-saves.test.tsx` with Phase 83 GK-02 invariant (`|cardTotal - xPts_1gw| <= 0.015`)

No blockers. Plans 03 and 04 are fully independent (disjoint files, parallel Wave 3 execution confirmed).

---
*Phase: 83-gk-save-point-projections*
*Completed: 2026-05-09*
