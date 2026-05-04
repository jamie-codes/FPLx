---
phase: 066-fixture-heat-map
plan: "01"
subsystem: pipeline-data
tags: [pipeline, types, fixture-data, heat-map]
dependency_graph:
  requires: []
  provides: [HEAT-01-data-foundation, upcoming_fixtures_16_window]
  affects: [pipeline/merge.py, src/lib/types.ts]
tech_stack:
  added: []
  patterns: [pipeline-constant-change, type-comment-update]
key_files:
  created: []
  modified:
    - pipeline/merge.py
    - src/lib/types.ts
decisions:
  - "[066-01] FIXTURE_LOOKAHEAD bumped from 5 to 16 — covers 8 GWs even for DGW teams (8 × 2 = 16 max)"
  - "[066-01] Type comment update is documentation-only; no downstream TS consumer relies on the exact array length being 5"
metrics:
  duration: "~1 min"
  completed: "2026-05-04"
  tasks_completed: 2
  files_modified: 2
---

# Phase 066 Plan 01: Fixture Lookahead Extension Summary

**One-liner:** Extend pipeline `FIXTURE_LOOKAHEAD` from 5 to 16 in `merge.py` and update matching `types.ts` comment to lay the data foundation for the 8-GW Fixture Heat Map.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Bump FIXTURE_LOOKAHEAD to 16 | ca6d111 | pipeline/merge.py |
| 2 | Update upcoming_fixtures comment to 'next 16' | cd113f1 | src/lib/types.ts |

## What Was Done

### Task 1 — pipeline/merge.py (commit ca6d111)

Two single-line edits at lines 775 and 782:

- `FIXTURE_LOOKAHEAD = 5` → `FIXTURE_LOOKAHEAD = 16`
- Python comment: `# Per team: next 5 upcoming fixture dicts` → `# Per team: next 16 upcoming fixture dicts`

The two loop guards at lines 791 and 807 (`len(team_fixtures[h_id]) < FIXTURE_LOOKAHEAD` and `len(team_fixtures[a_id]) < FIXTURE_LOOKAHEAD`) were intentionally left unchanged — they reference the constant and pick up the new value automatically.

No field-shape changes to the appended fixture dicts. No logic changes to the `upcoming = sorted(...)` filter.

### Task 2 — src/lib/types.ts (commit cd113f1)

One-character comment update on line 383:

- `upcoming_fixtures: ClubFormFixture[]   // next 5` → `upcoming_fixtures: ClubFormFixture[]   // next 16`

The `ClubFormFixture` interface (line 363) is unchanged. The field name and type are unchanged. Only the inline documentation comment was updated.

## Verification Results

| Check | Result |
|-------|--------|
| `FIXTURE_LOOKAHEAD = 16` count in merge.py | 1 (correct) |
| `FIXTURE_LOOKAHEAD = 5` count in merge.py | 0 (removed) |
| `next 16 upcoming fixture dicts` Python comment | 1 (present) |
| `next 5 upcoming fixture dicts` count | 0 (removed) |
| h_id loop guard intact | 1 |
| a_id loop guard intact | 1 |
| Python `ast.parse()` | VALID |
| `// next 16` in types.ts | 1 (present) |
| `upcoming_fixtures: ClubFormFixture[]` field intact | 1 |
| `interface ClubFormFixture` unchanged | present at line 363 |
| `npx tsc --noEmit` | 0 errors |

## Vitest Suite

The Vitest suite has 6 pre-existing failures in `tests/lib/club-form.test.ts` and related files (verified by checking parent commit `7f4098f` — same failures existed before this plan). These are out-of-scope and not introduced by this plan's changes. 727 tests pass.

Pre-existing failures are logged to deferred-items for the relevant phase owner.

## Deviations from Plan

None — plan executed exactly as written.

## Note for Plan 02

The `FixtureHeatMap` component (Plan 02) groups `upcoming_fixtures` by `event_id` client-side and takes the first 8 event groups as columns. With `FIXTURE_LOOKAHEAD = 16` in the pipeline, production data will expose up to 16 fixture entries per team. The component's `groupby` logic handles both 5-entry and 16-entry inputs identically — no blocking dependency on a fresh pipeline run before Plan 02 can be built and tested.

`FixtureEaseRankingPanel.tsx` line 83 uses `.slice(0, 5)` explicitly for its own TARGET-evaluation logic — this is unaffected by the lookahead change (verified in RESEARCH.md Pitfall 4).

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Pure pipeline constant change consuming existing public FPL fixture data (same classification as Phase 27 fixture data changes).

## Self-Check: PASSED

- `ca6d111` present: `git log --oneline | grep ca6d111` — confirmed
- `cd113f1` present: `git log --oneline | grep cd113f1` — confirmed
- `pipeline/merge.py` contains `FIXTURE_LOOKAHEAD = 16` — confirmed
- `src/lib/types.ts` contains `// next 16` — confirmed
- TypeScript clean (`npx tsc --noEmit` exit 0) — confirmed
