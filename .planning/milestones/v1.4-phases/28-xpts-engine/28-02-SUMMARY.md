---
phase: 28-xpts-engine
plan: 02
subsystem: ui
tags: [ui, gem-table, tanstack-react-table, tailwind, badge, xpts, variance]

# Dependency graph
requires:
  - phase: 28-01
    provides: "xPts_1gw/3gw/5gw, xPts_ceiling_*gw, xPts_components_1gw on MergedPlayer (pipeline output)"

provides:
  - "VarianceBadge component (src/components/gem-table/VarianceBadge.tsx)"
  - "XPtsCell exported renderer (src/components/gem-table/columns.tsx)"
  - "GemTable Gems tab columns: xPts / xPts (3) / xPts (5) replacing Proj Pts"
  - "GwToggle key map updated to xPts_*gw keys"
  - "XPtsCell.test.tsx: 9 Vitest+RTL tests covering VarianceBadge and XPtsCell"

affects:
  - "GemTable Gems tab — visual change for users (xPts instead of Proj Pts)"
  - "Phase 30 (differential tracker) — no direct dependency on UI"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "XPtsCell exported from columns.tsx for testability — co-located with column definitions"
    - "Zero-value short-circuit in cell renderer: (!value || value === 0) returns bare span, no badge/tooltip"
    - "1GW-only breakdown tooltip rule: showBreakdown = window === 1 && components !== undefined"
    - "VarianceBadge mirrors MinsRiskBadge envelope exactly: ml-1 inline-block text-xs font-normal rounded px-2 py-1"

key-files:
  created:
    - src/components/gem-table/VarianceBadge.tsx
    - tests/components/gem-table/XPtsCell.test.tsx
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GwToggle.tsx
    - src/components/gem-table/GwToggle.test.ts

key-decisions:
  - "XPtsCell co-located in columns.tsx (not a separate file) and exported for test import — keeps column definitions together"
  - "GwToggle.test.ts updated from proj_pts_* to xPts_* keys (Deviation Rule 1 — tests matched old keys and would have failed)"
  - "VarianceBadge renders null for ceiling=undefined (not false) — graceful degrade for partial pipeline output"
  - "Breakdown tooltip suppressed on 3GW/5GW even if components passed — enforces CONTEXT.md xPts_components_1gw-only spec"

# Metrics
duration: ~3min
completed: 2026-04-28
---

# Phase 28 Plan 02: xPts Engine UI — GemTable Column Replacement Summary

**VarianceBadge (⬆/= inline badge) + XPtsCell (breakdown tooltip) replacing three Proj Pts columns with xPts columns in GemTable; GwToggle key map updated atomically**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-28T09:07:49Z
- **Completed:** 2026-04-28T09:10:20Z
- **Tasks:** 2 of 3 complete (Task 3 is checkpoint:human-verify — awaiting)
- **Files modified:** 5 (VarianceBadge.tsx created, columns.tsx modified, GwToggle.tsx modified, GwToggle.test.ts updated, XPtsCell.test.tsx created)

## Accomplishments

- `src/components/gem-table/VarianceBadge.tsx` created: 25-line component mirroring `MinsRiskBadge` envelope exactly; violet bg for `ceiling=true` (⬆), zinc bg for `ceiling=false` (=), `null` for `ceiling=undefined`; native `title` tooltip with FPL-framed copywriting per UI-SPEC Copywriting Contract
- `XPtsCell` component added to `columns.tsx` and exported: zero-value short-circuit (`!value || value === 0` → bare span, no badge/tooltip); 1GW-only breakdown tooltip rule (`showBreakdown = window === 1 && components !== undefined`); VarianceBadge inline after number
- Three `proj_pts_*` column definitions replaced in-place with `xPts_1gw`, `xPts_3gw`, `xPts_5gw` accessors using new XPtsCell renderer; header tooltips updated per Copywriting Contract ("Poisson goals/assists, Bernoulli CS/minutes; FDR++ adjusted")
- `GwToggle.tsx` `getColumnVisibility()` key map updated atomically: `proj_pts_*gw` → `xPts_*gw`; toggle pill UI, aria-label, and colours unchanged (D-05)
- D-03 preserved: `proj_pts_*` still consumed unchanged by TransferPanel, PlannerTab, planning-engine, captaincy-engine, replacement-shortlist — verified by grep (24 references in `src/lib/`)
- 9 new RTL/jsdom tests in `tests/components/gem-table/XPtsCell.test.tsx`: VarianceBadge (3 tests), XPtsCell (6 tests including sentence-case "Clean sheet" assertion)
- Full suite: 264 passed, 15 skipped, 0 failed; TypeScript exits clean

## Task Commits

1. **Task 1: Create VarianceBadge + XPtsCell tests (RED)** - `cb9f0c1` (test)
2. **Task 2: Implement VarianceBadge + XPtsCell + swap proj_pts→xPts (GREEN)** - `6f26386` (feat)

## Files Created/Modified

- `src/components/gem-table/VarianceBadge.tsx` — New component: `export function VarianceBadge({ ceiling })`, violet/zinc badge envelope, `ml-1 inline-block text-xs font-normal rounded px-2 py-1`, native `title` tooltip
- `src/components/gem-table/columns.tsx` — Added `import { VarianceBadge }`, added `export function XPtsCell`, replaced 3 proj_pts column definitions with xPts equivalents
- `src/components/gem-table/GwToggle.tsx` — Updated `gwVisibility` object keys from `proj_pts_*gw` to `xPts_*gw`
- `src/components/gem-table/GwToggle.test.ts` — Updated 6 key assertions to use `xPts_*` keys (matched old implementation)
- `tests/components/gem-table/XPtsCell.test.tsx` — New 9-test RTL suite for VarianceBadge + XPtsCell

## Decisions Made

- **XPtsCell co-located in columns.tsx**: Keeps column definitions + renderer in one file, same as existing inline components (e.g., trend renderer). Exported for test file import via named export.
- **GwToggle.test.ts updated atomically with GwToggle.tsx**: The existing GwToggle tests verified the old `proj_pts_*` keys — they would have broken if not updated. This is a direct consequence of the key map swap (Deviation Rule 1 — auto-fix bug in tests caused by the implementation change).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated GwToggle.test.ts to match renamed accessor keys**
- **Found during:** Task 2 (post-implementation grep check)
- **Issue:** `src/components/gem-table/GwToggle.test.ts` contained 6 assertions on `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` keys. After swapping the keys in `GwToggle.tsx`, these tests would fail with key-not-found errors.
- **Fix:** Updated all 6 assertions in `GwToggle.test.ts` to use `xPts_1gw`, `xPts_3gw`, `xPts_5gw`. Renamed the `it(...)` description strings to match.
- **Files modified:** `src/components/gem-table/GwToggle.test.ts`
- **Commit:** `6f26386` (included in Task 2 commit)

## Pending: Human Verification (Task 3)

Task 3 is a `checkpoint:human-verify`. The implementation is complete; visual/interaction verification of the Gems tab is required before Task 3 can be marked done. See checkpoint details below.

## Known Stubs

None — the column definitions read live pipeline data from `usePlayers()`. The `xPts_*` fields are optional (`?: number`) so cells fall back to `0.0` when the pipeline hasn't yet been run locally (standard rollout pattern).

## Threat Flags

None — this plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The `title` tooltip strings are assembled from `.toFixed(2)` formatted numbers (T-28-02-02 mitigation: no raw user input).

## Self-Check: PASSED

- FOUND: `src/components/gem-table/VarianceBadge.tsx`
- FOUND: `src/components/gem-table/columns.tsx` (modified)
- FOUND: `src/components/gem-table/GwToggle.tsx` (modified)
- FOUND: `tests/components/gem-table/XPtsCell.test.tsx`
- Commit `cb9f0c1` exists (Task 1 RED)
- Commit `6f26386` exists (Task 2 GREEN)
- Vitest: 264 passed, 15 skipped, 0 failed
- TypeScript: exit 0
