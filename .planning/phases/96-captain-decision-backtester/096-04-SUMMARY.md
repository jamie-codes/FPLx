---
phase: 96-captain-decision-backtester
plan: "04"
subsystem: ui
tags: [typescript, react, recharts, accuracy-tab, back-tab, sub-tab-nav, tdd, green]

# Dependency graph
requires:
  - phase: 96-captain-decision-backtester
    plan: "02"
    provides: "pipeline/captain_snapshots.py — per-GW Blob snapshot write"
  - phase: 96-captain-decision-backtester
    plan: "03"
    provides: "src/lib/regret.ts, src/lib/hooks/useDecisionHistory.ts, /api/decision-history route"

provides:
  - src/components/accuracy/BackTab.tsx — season summary header + recharts BarChart + per-GW detail table
  - AccuracyTab restructured with Summary | Calibration | Back sub-tab nav
  - teamId pass-through wired from page.tsx → AccuracyTab → BackTab

affects:
  - UI: AccuracyTab default landing unchanged (Summary tab still shows GwSummaryTable + HaulterList + PlayerDeltaTable)
  - UI: Calibration tab content (VersionHistoryTable + CalibrationSection) moved behind Calibration pill
  - UI: New "Back" pill adds captain decision backtester tab to Accuracy section

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-guard render (isLoading/error/empty) before happy path — mirrors AccuracyTab pattern
    - recharts BarChart with per-Cell conditional fill (red/green/grey by regret sign)
    - Local table constants (TH_CLS etc) instead of re-exports from AccuracyTab (PATTERNS.md §BackTab.tsx)
    - Optional prop with null default (teamId?: string | null) for backward compat with pre-existing tests

key-files:
  created:
    - src/components/accuracy/BackTab.tsx
  modified:
    - src/components/accuracy/AccuracyTab.tsx
    - src/components/accuracy/AccuracyTab.test.tsx
    - src/app/page.tsx

key-decisions:
  - "teamId prop on AccuracyTab declared optional (default null) — preserves backward compat with 27 existing AccuracyTab tests that call render(<AccuracyTab />) without props; page.tsx still passes submittedId explicitly"
  - "Calibration sub-tab: VersionHistoryTable + CalibrationSection moved from default flat layout; Summary sub-tab retains GwSummaryTable + HaulterList + PlayerDeltaTable as before"
  - "DataHealthPanel renders in ALL branches (loading, error, !data, happy path) per DH-02 D-10/D-11 convention — sub-tab nav added beside it in all branches"
  - "AccuracyTab.test.tsx Calibration tests updated with fireEvent.click on Calibration button before assertions — required by restructure but not a breaking change, still tests the same logic"

# Metrics
duration: ~8min
completed: "2026-05-11"
---

# Phase 96 Plan 04: Wave 3 GREEN — BackTab UI + AccuracyTab Restructure Summary

**AccuracyTab restructured to Summary | Calibration | Back pill nav; BackTab component created with recharts regret bar chart, season summary header, and per-GW detail table — all 5 BackTab RED tests GREEN, all 32 accuracy tests green, tsc clean**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-11
- **Tasks:** 3 auto (Task 4 is human-verify checkpoint)
- **Files created:** 1 (BackTab.tsx)
- **Files modified:** 3 (AccuracyTab.tsx, AccuracyTab.test.tsx, page.tsx)

## Accomplishments

- Created `src/components/accuracy/BackTab.tsx` (253 lines): exports `BackTab({ teamId })` with three-guard loading/error/empty path, `SeasonSummaryHeader` (computeSeasonSummary aggregates, red/green/zinc coloured by net regret), `RegretChart` (recharts BarChart with Cell per entry using red/green/grey fill, ReferenceLine y=0, custom RegretTooltip), per-GW detail table (GW / Your captain / Model pick / Regret columns, "No model snapshot" italic placeholder, "Log in to see" italic SC-5 placeholder)
- Restructured `src/components/accuracy/AccuracyTab.tsx`: added `AccuracySubTabNav` inline component (3-pill: Summary | Calibration | Back), moved VersionHistoryTable+CalibrationSection to Calibration sub-tab, added BackTab under Back sub-tab, panel+nav always visible in all render branches
- Updated `src/components/accuracy/AccuracyTab.test.tsx`: added `fireEvent.click` to 10 Calibration-section tests so they activate the Calibration sub-tab before asserting content
- One-line edit to `src/app/page.tsx`: `<AccuracyTab teamId={submittedId} />` — wires submittedId (string | null from localStorage) down to BackTab

## Task Commits

1. **Task 1: BackTab.tsx** — `aa0be2d` (feat)
2. **Task 2: AccuracyTab restructure** — `0a0dd97` (feat)
3. **Task 3: page.tsx teamId wire** — `2f2bd1e` (feat)

## Test Results

| File | Tests | Status |
|------|-------|--------|
| src/components/accuracy/BackTab.test.tsx | 5 | GREEN |
| src/components/accuracy/AccuracyTab.test.tsx | 27 | GREEN |
| src/lib/regret.test.ts | 8 | GREEN |
| **Total (Plan 04 scope)** | **40** | **GREEN** |

Note: 16 pre-existing test failures (captain-picks.test.ts × 5, club-form.test.ts × 1, MobileNav.test.tsx × 10) remain unchanged — all documented in STATE.md deferred items.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TooltipContentProps generic type caused tsc error**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** `TooltipContentProps<number, string>` is not compatible with recharts Tooltip `content` prop type — generic union mismatch in recharts type definitions
- **Fix:** Changed to `TooltipContentProps` (no generics) — matches existing CalibrationTooltip + XptsTooltip pattern in AccuracyTab.tsx lines 253 and 274
- **Files modified:** `src/components/accuracy/BackTab.tsx`
- **Committed in:** `aa0be2d`

**2. [Rule 1 - Bug] AccuracyTab.test.tsx Calibration tests broke when content moved to sub-tab**
- **Found during:** Task 2 verification (vitest run src/components/accuracy/)
- **Issue:** 10 tests in the Phase 63 (VersionHistoryTable/CalibrationSection) and Phase 91 (xPts chart) test groups asserted Calibration-section content immediately after render — but content is now only visible after clicking the "Calibration" button
- **Fix:** Added `fireEvent.click(container.querySelector('[aria-label="Accuracy section"] button:nth-child(2)'))` before each affected assertion
- **Files modified:** `src/components/accuracy/AccuracyTab.test.tsx`
- **Committed in:** `0a0dd97`

**3. [Rule 2 - Missing critical] AccuracyTab teamId prop must be optional for backward compat**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** The plan specified `AccuracyTab({ teamId }: { teamId: string | null })` as a required prop, but 27 existing AccuracyTab tests call `render(<AccuracyTab />)` without passing teamId — 28 tsc errors
- **Fix:** Changed signature to `({ teamId = null }: { teamId?: string | null })` — optional with null default. page.tsx still passes `teamId={submittedId}` explicitly. BackTab receives `null` when teamId not supplied (query is disabled; BackTab shows empty state)
- **Files modified:** `src/components/accuracy/AccuracyTab.tsx`
- **Committed in:** `0a0dd97`

## Pending UAT (Task 4)

Task 4 is a `checkpoint:human-verify` gate. The automated side (Tasks 1-3) is complete. Human UAT must verify 9 steps:

1. Tab nav renders (Summary | Calibration | Back pills below DataHealthPanel)
2. Switching tabs is instant and reversible
3. BackTab happy path (season summary header, chart bars red/green, tooltip, per-GW table)
4. Pre-deployment GW handling (grey bars, "No model snapshot" italic)
5. Unauthenticated degradation ("Log in to see" for user picks; chart still renders)
6. Cache-first revisit (chart renders instantly from localStorage on second visit)
7. Dark mode (pill nav inverted, chart bg zinc-800, tooltip bg zinc-900)
8. Mobile viewport (44px touch targets, table scrolls horizontally)
9. Sub-tab default reset on remount (returns to Summary when AccuracyTab unmounts/remounts)

**UAT result:** Pending — awaiting human verification.

## Known Stubs

None — BackTab is fully wired to `useDecisionHistory` → `/api/decision-history` → Blob + FPL API. All fields render from real data. Pre-deployment GW rows and unauthenticated rows show placeholder text as intended (not stubs — these are spec-driven empty states).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. BackTab renders strings through React text children only (no `dangerouslySetInnerHTML`). All threat mitigations from the plan's threat model (T-96-17 through T-96-21) are implemented.

## Self-Check: PASSED

All files exist and all task commits are confirmed:
- FOUND: src/components/accuracy/BackTab.tsx
- FOUND: src/components/accuracy/AccuracyTab.tsx (modified)
- FOUND: src/app/page.tsx (modified)
- FOUND: .planning/phases/96-captain-decision-backtester/096-04-SUMMARY.md
- FOUND: commit aa0be2d (Task 1 — BackTab.tsx)
- FOUND: commit 0a0dd97 (Task 2 — AccuracyTab restructure)
- FOUND: commit 2f2bd1e (Task 3 — page.tsx wire)
