---
phase: 100
plan: "04"
subsystem: accuracy/back-tab
tags: [ui, backtab, accuracy-tab, hist-01, hist-02, hist-03, vitest, tdd, react]
dependency_graph:
  requires:
    - 100-01  # SeasonSummary.captainHitRate + captainHits in regret.ts
    - 100-02  # /api/season-analytics route
    - 100-03  # useSeasonAnalytics hook
  provides:
    - BackTab extended with HIST-01 captain hit rate + HIST-02 Chip ROI + HIST-03 Hit Tracking
  affects:
    - src/components/accuracy/BackTab.tsx
    - src/components/accuracy/BackTab.test.tsx
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN (9 new test cases)
    - Three-guard auth/loading/error pattern for useSeasonAnalytics
    - CHIP_DISPLAY_NAME Record constant for chip-name mapping
    - Helper sub-components ChipRoiSection / HitTrackingSection for section isolation
key_files:
  created: []
  modified:
    - src/components/accuracy/BackTab.tsx
    - src/components/accuracy/BackTab.test.tsx
decisions:
  - "HIST-01 captain hit rate inserted directly into SeasonSummaryHeader (after model/you/tied line) gated on captainHitRate !== null"
  - "seasonSections variable typed as React.ReactNode to avoid JSX namespace issue; imported via `import type * as React from 'react'`"
  - "Auth-guard rendered inline (not early-return) so HIST-01 still shows when teamId is null but decision-history data exists"
  - "Wildcard excluded from CHIP_DISPLAY_NAME per D-04 (comment explains exclusion)"
metrics:
  duration: ~5 min
  completed: "2026-05-12"
  tasks: 2
  files: 2
---

# Phase 100 Plan 04: BackTab HIST-01/02/03 Wire-Up Summary

Extended `BackTab.tsx` with the three HIST analytics features (captain hit rate, chip ROI, hit break-even tracking) using TDD RED→GREEN, turning 9 failing tests GREEN while keeping the 6 Phase 96 tests intact.

## What Was Built

### HIST-01: Captain Hit Rate (SeasonSummaryHeader extension)
Insertion point: inside `SeasonSummaryHeader`, after the "Model better | You won | Tied" `<p>`. A new `<p>` renders `Captain hit rate: {captainHits}/{gwsWithData} GWs ({pct}%)` only when `summary.captainHitRate !== null`. The count fragment uses `font-semibold text-zinc-900 dark:text-zinc-100` per UI-SPEC.

### HIST-02 + HIST-03: Shared Auth/Loading/Error Flow
`useSeasonAnalytics(teamId)` is called alongside `useDecisionHistory(teamId)` in `BackTab`. A single `seasonSections` variable (typed `React.ReactNode`) is assigned one of five branches before the return:

1. `teamId === null` → auth-guard prompt: "Load your squad to see chip ROI and hit tracking."
2. `seasonLoading` → loading: "Loading season analytics…"
3. `seasonError` → error: "Failed to load season analytics. Check your connection and refresh."
4. `seasonData` → both HIST-02 and HIST-03 sections rendered
5. `null` → nothing (idle/disabled state when teamId is valid but query hasn't run)

`{seasonSections}` is rendered after the per-GW table block inside the main return.

### Helper Sub-Components

**`ChipRoiSection({ entries: ChipRoiEntry[] })`** — located above `BackTab`:
- Empty state: "No chips played yet this season."
- Happy path: `<ul>` of chip rows with `CHIP_DISPLAY_NAME` mapping (bboost→Bench Boost, 3xc→Triple Captain, freehit→Free Hit), `formatSignedPts()` delta with `deltaColorClass()` (green/red/zinc)

**`HitTrackingSection({ entries: HitTrackingEntry[] })`** — located above `BackTab`:
- Empty state: "No transfer hits taken this season."
- Happy path: `<table>` reusing TH_CLS/TR_CLS/TD_CLS/TABLE_CLS constants; columns: GW / `{elementInName} ← {elementOutName}` / net pts (signed, colour-coded) / result ✓/✗/— with `aria-label` accessibility on the result cell

### Chip-Name Mapping Constant
```typescript
const CHIP_DISPLAY_NAME: Record<'bboost' | '3xc' | 'freehit', string> = {
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
  freehit: 'Free Hit',
}
```
Wildcard intentionally excluded per D-04.

### Accessibility (T-100-15)
Result cell in HIST-03 table has `aria-label={resultLabel}` where resultLabel is one of:
- `'broke even'` (✓)
- `'did not break even'` (✗)
- `'broke-even data unavailable'` (—)

## Test Results

```
BackTab.test.tsx — 15 tests passing (6 Phase 96 + 9 Phase 100)
```

TDD gate compliance:
- RED commit: `test(100-04): RED — extend BackTab tests for HIST-01 / HIST-02 / HIST-03 (9 cases)` (601d37c)
- GREEN commit: `feat(100-04): GREEN — wire HIST-01 + HIST-02 Chip ROI + HIST-03 Hit Tracking into BackTab` (3991ecf)

TypeScript: `npx tsc --noEmit` exits 0.

Full suite: 4 pre-existing failing test files (captain-picks.test.ts, MobileNav.test.tsx, useRivals.test.ts, club-form.test.ts) — all tracked in STATE.md deferred items. No new failures introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX.Element not resolvable — switched to React.ReactNode**
- **Found during:** Task 2 tsc check
- **Issue:** `let seasonSections: JSX.Element | null` failed with TS2503 "Cannot find namespace 'JSX'"
- **Fix:** Added `import type * as React from 'react'` and typed as `React.ReactNode`
- **Files modified:** `src/components/accuracy/BackTab.tsx`
- **Commit:** 3991ecf (included in GREEN commit)

## TDD Gate Compliance

RED gate: `test(100-04): RED — extend BackTab tests for HIST-01 / HIST-02 / HIST-03 (9 cases)` — 601d37c
GREEN gate: `feat(100-04): GREEN — wire HIST-01 + HIST-02 Chip ROI + HIST-03 Hit Tracking into BackTab` — 3991ecf
REFACTOR: Not needed — code is clean as-is.

## Self-Check: PASSED
