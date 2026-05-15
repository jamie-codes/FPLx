---
phase: 113-transfer-regret-backtester-v1-20
plan: 01
subsystem: pipeline
tags: [fpl, pipeline, snapshot, transfer-regret, types, vercel-blob, pytest, tdd]

# Dependency graph
requires:
  - phase: 96-captain-decision-backtester
    provides: captain_snapshots.py pattern — exact analog for transfer_snapshots.py structure
  - phase: 113-transfer-regret-backtester-v1-20 (context)
    provides: BACK-02 requirements, SLIM_FIELDS spec, nullability rules for TransferRegretEntry

provides:
  - pipeline/transfer_snapshots.py — write_transfer_slim_snapshot(merged, current_gw) + SLIM_FIELDS tuple
  - pipeline/run.py edit — slim snapshot side-write wired after captain snapshot (line 353-356)
  - src/lib/types.ts — SlimPlayer, TransferRegretEntry, DecisionHistory.transferEntries? exported types
  - 5 pytest tests covering all snapshot write behaviours (no-op, upload call, projection, missing fields)

affects:
  - 113-02 (regret.ts utilities — imports TransferRegretEntry from types.ts)
  - 113-03 (API route — imports SlimPlayer, TransferRegretEntry; reads merged_players_slim_gw{N}.json)
  - 113-04 (BackTab UI — reads transferEntries from DecisionHistory hook)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "slim-snapshot side-write: USE_BLOB guard → lazy import upload_json → dict comprehension 'if k in p' projection → upload_json(f'merged_players_slim_gw{N}.json', slim)"
    - "SLIM_FIELDS tuple: canonical 9-field subset of merged_players used by suggestTransfers post-hoc"
    - "TDD RED→GREEN: failing test file committed before implementation, GREEN confirmed before task commit"

key-files:
  created:
    - pipeline/transfer_snapshots.py
    - pipeline/test_transfer_snapshots.py
  modified:
    - pipeline/run.py
    - src/lib/types.ts

key-decisions:
  - "SLIM_FIELDS = ('id', 'element_type', 'web_name', 'team', 'now_cost', 'selected_by_percent', 'xPts_1gw', 'xPts_3gw', 'xPts_5gw') — exactly 9 fields covering all suggestTransfers requirements"
  - "write_transfer_slim_snapshot placed after write_captain_snapshot in run.py (lines 353-356), not inside the if USE_BLOB block — mirrors captain_snapshots.py which also has its own internal USE_BLOB guard"
  - "TransferRegretEntry nullability: hasSnapshot boolean (no null), isHold boolean (no null), all other arrays nullable to support no-snapshot GWs and holds"
  - "Pre-existing tsc error in route.test.ts (Buffer<ArrayBufferLike> type) is out-of-scope — confirmed pre-existed before changes"

patterns-established:
  - "Pattern: transfer slim snapshot mirrors captain snapshot pattern exactly — same module structure, internal USE_BLOB guard, lazy upload import, dict-comprehension projection"
  - "Pattern: if k in p guard in projection silently handles missing fields (no KeyError, no None placeholders)"

requirements-completed: [BACK-02]

# Metrics
duration: 20min
completed: 2026-05-15
---

# Phase 113 Plan 01: Transfer Regret Backtester — Data Layer Foundation Summary

**Pipeline slim-snapshot module (write_transfer_slim_snapshot) side-writes merged_players_slim_gw{N}.json to Vercel Blob each run, wired into run.py after captain snapshot; SlimPlayer + TransferRegretEntry TypeScript types exported from types.ts ready for Plans 02-04**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-15T19:30:00Z
- **Completed:** 2026-05-15T19:54:10Z
- **Tasks:** 3 (TDD RED + GREEN + Types)
- **Files modified:** 4

## Accomplishments
- Created `pipeline/transfer_snapshots.py` with `SLIM_FIELDS` tuple and `write_transfer_slim_snapshot()` function — exact analog of Phase 96 `captain_snapshots.py`
- Wired slim snapshot side-write into `pipeline/run.py` after the captain snapshot call (lines 353-356) — only additions, no deletions
- Added `SlimPlayer`, `TransferRegretEntry` types and optional `transferEntries?` field on `DecisionHistory` in `src/lib/types.ts`
- All 5 pytest tests GREEN (TDD RED→GREEN cycle complete)

## Task Commits

Each task was committed atomically:

1. **Task 1: pytest scaffold (TDD RED)** - `c17e8a8` (test)
2. **Task 2: Implement transfer_snapshots.py + wire run.py (TDD GREEN)** - `4afd2f9` (feat)
3. **Task 3: Add SlimPlayer + TransferRegretEntry types** - `c81ba1c` (feat)

## Files Created/Modified
- `pipeline/transfer_snapshots.py` — New module: SLIM_FIELDS tuple + write_transfer_slim_snapshot() function; mirrors captain_snapshots.py exactly with slim-projection insert
- `pipeline/test_transfer_snapshots.py` — 5 pytest tests: USE_BLOB unset no-op, USE_BLOB=false no-op, USE_BLOB=true upload call, SLIM_FIELDS-only projection, missing-field omission
- `pipeline/run.py` — Phase 113 BACK-02 side-write call added at lines 353-356 (after captain snapshot call; zero deletions)
- `src/lib/types.ts` — SlimPlayer (9 fields), TransferRegretEntry (12 fields with correct nullability), DecisionHistory.transferEntries? extension

## run.py Insertion (for Plan 03 reference)

Lines added at run.py:353-356 (after captain snapshot, inside same context block):
```python
        # Phase 113 BACK-02: per-GW slim player snapshot side-write.
        # merged is in scope from merge_players() above. current_gw is set at pipeline start.
        from transfer_snapshots import write_transfer_slim_snapshot
        write_transfer_slim_snapshot(merged, current_gw)
```

## SLIM_FIELDS Tuple (for Plan 03 API reference)

```python
SLIM_FIELDS = (
    'id', 'element_type', 'web_name', 'team', 'now_cost',
    'selected_by_percent', 'xPts_1gw', 'xPts_3gw', 'xPts_5gw',
)
```

Blob pathname: `merged_players_slim_gw{current_gw}.json` (e.g., `merged_players_slim_gw30.json`)

## Decisions Made
- SLIM_FIELDS contains exactly 9 fields — all required by suggestTransfers() post-hoc; no PII, all already public via /api/players
- write_transfer_slim_snapshot placed after (not inside) the `if USE_BLOB` block at line 343 — mirrors captain_snapshots.py which has its own internal guard (double-guarding is safe per PATTERNS.md)
- TransferRegretEntry has two `boolean` non-null fields (hasSnapshot, isHold) and nullable arrays for all player name/pts fields — correct nullability per RESEARCH.md Pattern 5

## Deviations from Plan

None — plan executed exactly as written. Pre-existing tsc error in `route.test.ts` (Buffer type mismatch) is out-of-scope and pre-existed before any changes in this plan.

## Issues Encountered
- Pre-existing TypeScript error in `src/app/api/decision-history/route.test.ts` line 218 (`Buffer<ArrayBufferLike>` type incompatibility). Confirmed pre-existed before plan via `git stash` test. Out-of-scope per deviation rules — not caused by this plan's changes.

## Next Phase Readiness
- Plans 02-04 can begin: `depends_on: [113-01]` satisfied
- Plan 02 (regret.ts utilities) can import `TransferRegretEntry` from `@/lib/types`
- Plan 03 (API route) can read `merged_players_slim_gw{N}.json` from Vercel Blob and cast to `SlimPlayer[]`
- Plan 04 (BackTab UI) can access `data.transferEntries` from `useDecisionHistory` hook
- No blockers. The slim snapshot will begin populating from the next pipeline run with `USE_BLOB=true`.

## Self-Check: PASSED

- FOUND: pipeline/transfer_snapshots.py
- FOUND: pipeline/test_transfer_snapshots.py
- FOUND: pipeline/run.py (modified)
- FOUND: src/lib/types.ts (modified)
- FOUND: .planning/phases/113-transfer-regret-backtester-v1-20/113-01-SUMMARY.md
- FOUND commit: c17e8a8 (test — TDD RED)
- FOUND commit: 4afd2f9 (feat — TDD GREEN + run.py wire)
- FOUND commit: c81ba1c (feat — TypeScript types)

---
*Phase: 113-transfer-regret-backtester-v1-20*
*Completed: 2026-05-15*
