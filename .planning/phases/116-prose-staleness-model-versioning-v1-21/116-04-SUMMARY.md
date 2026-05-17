---
phase: 116-prose-staleness-model-versioning-v1-21
plan: 04
subsystem: ui
tags: [ui, accuracy, versions, cold-start, react, typescript, testing]

# Dependency graph
requires:
  - phase: 116-03
    provides: VersionRecord.sample_gws?: number schema (VER-01)
provides:
  - AccuracyTab 4th Versions pill routes VersionHistoryTable out of Calibration tab
  - VersionHistoryTable shows Sample GWs column with cold-start amber labels for sample_gws < 3
  - 8 new VER-02 regression tests covering pill rendering, tab routing, cold-start, normal, legacy, empty-state
affects:
  - AccuracyTab nav order: Summary | Calibration | Back | Versions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cold-start conditional render: (v.sample_gws ?? 0) < 3 predicate with amber span fallback"
    - "Sub-tab routing: subTab === 'versions' conditional block pattern (mirrors existing summary/calibration/back blocks)"
    - "TDD-style: existing tests updated to reflect routing change (button:nth-child(2) → button:nth-child(4)) for VER-02 tests"

key-files:
  created: []
  modified:
    - src/components/accuracy/AccuracyTab.tsx
    - src/components/accuracy/AccuracyTab.test.tsx

key-decisions:
  - "Versions pill placed 4th (last) per UI-SPEC nav order: Summary | Calibration | Back | Versions"
  - "VersionHistoryTable removed entirely from calibration block; CalibrationSection is now the sole child"
  - "Cold-start predicate (v.sample_gws ?? 0) < 3 mirrors the D-15 spec; covers absent/0/1/2"
  - "Sample GWs cell renders plain integer v.sample_gws (not ?? 0 fallback) for warm entries — falsy 0 is already caught by the cold-start branch"
  - "Two existing Phase 63 VER-02 tests updated: click Versions tab (button:nth-child(4)) instead of Calibration (button:nth-child(2)) — routing change is by design"

patterns-established:
  - "Phase 116 cold-start amber: text-amber-600 dark:text-amber-400 text-xs span inside TD_CLS td"
  - "Phase 116 versions render block: after subTab === 'back' block, before closing </section>"

requirements-completed:
  - VER-02

# Metrics
duration: 15min
completed: 2026-05-17
---

# Phase 116 Plan 04: Versions Sub-Tab + Sample GWs Cold-Start Render Summary

**4-pill AccuracyTab nav (Summary | Calibration | Back | Versions) with VersionHistoryTable relocated to Versions tab, Sample GWs column, and amber cold-start labels for sample_gws < 3**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-17T13:00:00Z
- **Completed:** 2026-05-17T13:16:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `AccuracySubTab` union extended to `'summary' | 'calibration' | 'back' | 'versions'` (Site 1)
- `ACCURACY_SUB_TABS` array gains 4th entry `{ value: 'versions', label: 'Versions' }` (Site 1)
- `VersionHistoryTable` `<thead>` gains `Sample GWs` column after `Active Gates` (Site 2)
- Hit Rate cell: `(v.sample_gws ?? 0) < 3` → amber `cold start` span instead of `HitRateBadge` (Site 3)
- Sample GWs cell: `(v.sample_gws ?? 0) < 3` → amber `< 3 GWs` span; otherwise plain integer (Site 3)
- `VersionHistoryTable` removed from `{subTab === 'calibration'}` block; CalibrationSection is now its sole child (Site 4)
- New `{subTab === 'versions'}` render block with `VersionHistoryTable` or `No version history yet.` fallback (Site 4)
- 8 new VER-02 tests: Versions pill, Sample GWs column header, Calibration tab has no table, cold-start at 0, cold-start at 2 (boundary), normal at 5, legacy (absent field), empty-state
- All 35 tests pass (27 pre-existing + 8 new)

## Task Commits

1. **Task 1: AccuracyTab.tsx 4-site modification** - `3e7112e` (feat)
2. **Task 2: AccuracyTab.test.tsx VER-02 coverage** - `5a2874c` (feat)

## Files Created/Modified

- `src/components/accuracy/AccuracyTab.tsx` — Four change sites: sub-tab union + array, VersionHistoryTable `<th>` + `<td>` columns, render block routing
- `src/components/accuracy/AccuracyTab.test.tsx` — 8 new VER-02 it() blocks; 2 existing Phase 63 VER-02 tests updated from button:nth-child(2) to button:nth-child(4)

## Decisions Made

- Versions pill is placed 4th (last) per UI-SPEC nav order: Summary | Calibration | Back | Versions
- VersionHistoryTable removed entirely from calibration block — CalibrationSection now renders alone there
- `(v.sample_gws ?? 0) < 3` covers absent/0/1/2 as D-15 specifies; threshold 3 is exclusive
- Sample GWs cell for warm entries renders `v.sample_gws` directly (not `v.sample_gws ?? 0`) because the falsy-0 case is already caught by the cold-start branch above
- Two pre-existing Phase 63 VER-02 tests adjusted to click button:nth-child(4) (Versions) instead of button:nth-child(2) (Calibration) — this is a Rule 1 auto-fix (broken test routing due to intentional component change)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Phase 63 VER-02 test routing**
- **Found during:** Task 1 verification
- **Issue:** Two existing Phase 63 VER-02 tests (`VER-02: VersionHistoryTable renders heading...` and `VER-02: first version row delta is em-dash...`) were clicking `button:nth-child(2)` (Calibration) to find `VersionHistoryTable`. After Site 4 removed it from the calibration block, both tests failed.
- **Fix:** Updated both tests to click `button:nth-child(4)` (Versions) with updated comment `Phase 116: content moved to Versions sub-tab (4th pill) — click it first.`
- **Files modified:** `src/components/accuracy/AccuracyTab.test.tsx` (lines 297, 313)
- **Commit:** Included in Task 1 commit `3e7112e`

## Issues Encountered

- Pre-existing TypeScript error in `src/app/api/decision-history/route.test.ts` (Buffer type mismatch) — same pre-existing issue documented in Plan 03 SUMMARY, not introduced by this plan's changes. Out of scope.
- Pre-existing ESLint warnings in `AccuracyTab.tsx` (`VersionRecord`, `CalibrationData`, `DataHealth` unused type imports) — these pre-date Phase 116; out of scope.

## Known Stubs

None — all new render paths are fully wired. The cold-start predicate, Sample GWs cell, and Versions routing are all live.

## Threat Flags

No new security-relevant surface introduced. The Versions tab is pure UI routing with no new API calls, no auth boundary, and no PII rendered. All threat mitigations from the plan's `<threat_model>` are satisfied:
- T-116-04-01: `(v.sample_gws ?? 0) < 3` treats absent/undefined as cold-start
- T-116-04-03: Version-record fields rendered as JSX text children (React default escaping)

---
*Phase: 116-prose-staleness-model-versioning-v1-21*
*Completed: 2026-05-17*
