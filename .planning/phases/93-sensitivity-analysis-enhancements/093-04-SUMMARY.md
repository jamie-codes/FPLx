---
phase: 93
plan: "04"
subsystem: sensitivity-ui-wireup
tags: [sensitivity, fragility, ui, wireup, captaincy, gem-table, transfers]
one_liner: "Wire FragilityBadge tristate component into CaptainPicksPanel, GemTable, and OpportunityCostTable; retire legacy FragilityNote callsite; tsc + tests green"

dependency_graph:
  requires: [093-02, 093-03]
  provides: [fragility-badge-all-surfaces]
  affects:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/transfers/OpportunityCostTable.tsx

tech_stack:
  added: []
  patterns:
    - IIFE pattern for inline conditional rendering of FragilityBadge
    - Block-body map callback to hoist per-leg computeFragility call (OCS)
    - Tristate render gate: tier !== 'robust' replaces binary fragile boolean

key_files:
  created: []
  modified:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/lib/__tests__/sensitivity.test.ts

decisions:
  - "D-10: GemTable badge placed after RowExpandNewsSection in both sm:hidden and hidden sm:table-row expand rows; isTransfer=false (viewing surface)"
  - "D-11: OpportunityCostTable badge placed on own line below flex row per transfer leg; isTransfer=true with xPtsGainNet passed"
  - "D-12: CaptainPicksPanel captain path uses isTransfer=false, no cost perturbation"
  - "Pre-existing test failures (captain-picks.test.ts, club-form.test.ts, MobileNav.test.tsx) confirmed as pre-existing on main — not caused by Phase 93 changes"
  - "Stale @ts-expect-error in sensitivity.test.ts removed as Rule 1 auto-fix — 093-02 shipped the missing exports"

metrics:
  duration_minutes: 25
  completed_date: "2026-05-10"
  tasks_completed: 4
  tasks_total: 5
  files_modified: 4
---

# Phase 93 Plan 04: FragilityBadge Wire-Up Summary

Wire the `FragilityBadge` tristate component (from 093-03) into all three host surfaces and retire the legacy `FragilityNote` callsite in `CaptainPicksPanel`. Repo-wide `tsc --noEmit` passes clean; `npm test --run` Phase 93 suites all green (36/36).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate CaptainPicksPanel FragilityNote → FragilityBadge | 7a7d2ae | CaptainPicksPanel.tsx |
| 2 | Inject FragilityBadge into GemTable row-expand (mobile + desktop) | e66039d | GemTable.tsx |
| 3 | Inject FragilityBadge into OpportunityCostTable PlayerMoveCell | 8f2e139 | OpportunityCostTable.tsx |
| 4 | Repo-wide GREEN gate — typecheck + full test suite | 538301f | sensitivity.test.ts |

## Callsite Inventory

- **CaptainPicksPanel** (1 callsite): IIFE with `computeFragility(candidate, false)` — captain path, no cost perturbation
- **GemTable** (2 callsites): IIFE with `computeFragility(row.original, false)` — viewing surface, one per expand-row layout (mobile + desktop)
- **OpportunityCostTable** (1 callsite): block-body map callback, `computeFragility(t.buy, true, row.xPtsGainNet)` — transfer surface, per leg

Total callsites: 4

## Gate Results

- `tsc --noEmit`: exit 0, zero errors
- `npm test --run` Phase 93 suites: 36/36 passing
  - sensitivity.test.ts: 24 passing
  - FragilityBadge.test.tsx: 8 passing
  - FragilityNote.test.tsx: 4 passing (no regression)
- Pre-existing test failures (3 files, 16 tests) confirmed as pre-existing on main; out of scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed stale @ts-expect-error in sensitivity.test.ts**
- **Found during:** Task 4 (tsc --noEmit run)
- **Issue:** `@ts-expect-error` directive added in 093-01 RED phase anticipating missing exports; 093-02 shipped those exports, making the directive unused — tsc flagged it as `TS2578: Unused '@ts-expect-error' directive`
- **Fix:** Removed the 4-line comment block + directive; replaced with a one-line note
- **Files modified:** src/lib/__tests__/sensitivity.test.ts
- **Commit:** 538301f

**2. [Rule 3 - Blocker] Merged main into worktree before execution**
- **Found during:** Setup — worktree was based on phase 91 completion (commit 3cde42a) missing all phase 92-93 work
- **Fix:** `git merge main --no-edit` fast-forward to b5fae5a; all phase 93 source files (FragilityBadge.tsx, sensitivity.ts rewrites, planning files) became available
- **Impact:** No code changes; worktree state corrected

### FragilityNote Status

`src/components/shared/FragilityNote.tsx` left in place per PATTERNS.md. `grep -rln "FragilityNote" src/ | wc -l` returns 3 (source + test + comment-only reference in NewsBanner.tsx). No actual importers beyond the source file itself.

## Known Stubs

None — all three callsites compute from real `MergedPlayer` data.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. All badge rendering is pure React text with no `dangerouslySetInnerHTML`.

## Phase 93 SC Checklist (Tasks 1-4)

- [x] SC-1: 5 perturbations evaluated independently (sensitivity.ts engine — 093-02)
- [x] SC-2: tristate replaces binary fragility in all wired surfaces
- [x] SC-3: GemTable + OpportunityCostTable render the badge with reason list
- [x] SC-4: news-doubt perturbation reuses Phase 88 taxonomy semantics
- [x] SC-5: pure TypeScript engine, node-callable Vitest case present
- [ ] SC-Manual: Manual UAT — Task 5 (checkpoint pending)

## Self-Check: PASSED

- Commits verified: 7a7d2ae, e66039d, 8f2e139, 538301f all present in git log
- Modified files all exist and contain expected patterns
- tsc --noEmit: clean
- Phase 93 test suites: 36/36 passing
