---
phase: 26-quick-wins
plan: "01"
subsystem: pipeline-and-api
tags: [data-pipeline, set-pieces, api-route, react-query, typescript]
dependency_graph:
  requires: []
  provides: [set_piece_changes.json, /api/set-pieces, useSetPieces hook, SetPieceChanges types]
  affects: [pipeline/run.py, pipeline/merge.py, src/lib/types.ts]
tech_stack:
  added: []
  patterns: [Blob/local API route pattern, React Query useQuery hook, Python snapshot diff]
key_files:
  created:
    - src/app/api/set-pieces/route.ts
    - src/lib/hooks/useSetPieces.ts
  modified:
    - pipeline/merge.py
    - pipeline/run.py
    - src/lib/types.ts
    - tests/lib/captaincy-engine.test.ts
    - tests/lib/explain.test.ts
    - tests/lib/gem-score.test.ts
    - tests/lib/planning-engine.test.ts
    - tests/lib/recommend.test.ts
    - tests/lib/replacement-shortlist.test.ts
    - tests/lib/transfer-engine.test.ts
    - src/lib/__tests__/planning-engine-rescore.test.ts
decisions:
  - "API route uses catch-all error handler (no console.error) matching plan spec — defcon route logs error but plan spec omits it for set-pieces"
  - "Test mock objects updated in all affected files to satisfy MergedPlayer type contract after adding _text fields"
metrics:
  duration: ~10 min
  completed: "2026-04-27"
  tasks: 2
  files_changed: 13
requirements: [DATA-04, SP-02]
---

# Phase 26 Plan 01: Set-piece Pipeline + API Data Layer Summary

Set-piece order text fields extracted into merged_players.json (DATA-04), snapshot diff logic added to pipeline producing set_piece_changes.json per run (SP-02), served via /api/set-pieces route, consumed via typed useSetPieces React Query hook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pipeline — DATA-04 text fields + SP-02 snapshot diff | dddbc6e | pipeline/merge.py, pipeline/run.py |
| 2 | Types + API route + useSetPieces hook | 27d9422 | src/lib/types.ts, src/app/api/set-pieces/route.ts, src/lib/hooks/useSetPieces.ts + 8 test files |

## What Was Built

**DATA-04 — merge.py:** Three new string fields extracted per player from the FPL bootstrap-static element:
- `penalties_text` — textual description of penalty taking role
- `direct_freekicks_text` — textual description of FK taking role
- `corners_and_indirect_freekicks_text` — textual description of corner/indirect FK role

Currently empty strings in the 2025/26 season but extracted for DATA-04 compliance. Inserted after the `_order` sibling fields.

**SP-02 pipeline side — run.py:** Two module-level functions added:
- `_extract_sp_snapshot(merged)` — scans merged player list, returns dict of `{team_id: {penalty, fk, corner}}` primary taker IDs (i.e. where `_order == 1`)
- `_diff_sp_snapshots(prev, curr, bootstrap)` — diffs two snapshots, produces `SetPieceChanges`-shaped dict with `has_changes`, `change_count`, and `teams` array

Inserted into `run()` after `save('merged_players.json', merged)`:
1. Extract current snapshot
2. Read previous snapshot from local cache (gracefully handles FileNotFoundError on first run)
3. Compute diff
4. Save `set_piece_changes.json` (the change result)
5. Save `set_pieces_snapshot.json` (current state, for next run's comparison)

**TypeScript types — types.ts:** 
- `MergedPlayer` interface extended with `penalties_text: string`, `direct_freekicks_text: string`, `corners_and_indirect_freekicks_text: string`
- New interfaces exported: `SetPieceTaker`, `SetPieceTeam`, `SetPieceChanges`

**API route — src/app/api/set-pieces/route.ts:** Standard Blob/local pattern (copied from defcon/route.ts). Serves `set_piece_changes.json` at `/api/set-pieces` with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

**React Query hook — src/lib/hooks/useSetPieces.ts:** `useSetPieces()` hook with query key `['set-pieces']`, fetches from `/api/set-pieces`, typed as `SetPieceChanges`, 6h staleTime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock objects missing _text fields after MergedPlayer type extension**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Adding three new required `string` fields to `MergedPlayer` caused TS2739/TS2322 errors in 8 test files whose mock objects lacked the new fields
- **Fix:** Added `penalties_text: ''`, `direct_freekicks_text: ''`, `corners_and_indirect_freekicks_text: ''` to base mock objects in all affected test files
- **Files modified:** tests/lib/captaincy-engine.test.ts, explain.test.ts, gem-score.test.ts, planning-engine.test.ts, recommend.test.ts, replacement-shortlist.test.ts, transfer-engine.test.ts, src/lib/__tests__/planning-engine-rescore.test.ts
- **Commit:** 27d9422

## Known Stubs

None. The pipeline functions are complete. Set_piece_changes.json will show `change_count: 0` and empty `changed: false` entries on first run (no previous snapshot), which is correct and expected behaviour per the plan.

The `_text` fields will be empty strings (`""`) until FPL populates them in the bootstrap-static API response — this is not a stub, it's the current FPL data state.

## Verification Results

- `python -c "from pipeline.run import _extract_sp_snapshot, _diff_sp_snapshots"` — exits 0
- `test -f src/app/api/set-pieces/route.ts` — exists
- `test -f src/lib/hooks/useSetPieces.ts` — exists
- `npx vitest run` — 21 test files passed, 240 tests passed, 8 skipped

## Self-Check: PASSED

- pipeline/merge.py: contains `penalties_text` — FOUND
- pipeline/run.py: contains `_extract_sp_snapshot` — FOUND
- pipeline/run.py: contains `_diff_sp_snapshots` — FOUND
- pipeline/run.py: contains `save('set_piece_changes.json'` — FOUND
- src/app/api/set-pieces/route.ts — FOUND
- src/lib/hooks/useSetPieces.ts — FOUND
- src/lib/types.ts: contains `SetPieceChanges` — FOUND
- Commits dddbc6e and 27d9422 — PRESENT in git log
