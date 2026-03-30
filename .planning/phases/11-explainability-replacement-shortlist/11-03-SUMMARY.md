---
phase: 11-explainability-replacement-shortlist
plan: "03"
subsystem: ui
tags: [react, tailwind, zinc, expand-panel, squad-view, explainability]

# Dependency graph
requires:
  - phase: 11-01
    provides: computeExplanations pure function returning natural-language reason strings
  - phase: 11-02
    provides: computeReplacementShortlist pure function returning ranked ShortlistEntry[]

provides:
  - ExplainPanel component rendering reasons list and optional replacement shortlist
  - SquadView row-expand toggle (chevron) on all starting-XI players
  - Inline expand panel with natural-language reasons for every starting player
  - Replacement shortlist section (rank, name, team, pts delta, affordability) for Sell-verdicted players only
  - Bench players excluded from expand

affects:
  - Any future plan modifying SquadView table structure or column count

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline expand row pattern in table: conditional <tr colSpan={9}> after player row, renders ExplainPanel
    - useState<Set<number>> for multi-row independent expand/collapse
    - IIFE pattern inside JSX for conditional row rendering with local variables
    - Chevron toggle button isolated in first <td> — not full-row click (per Research Pitfall 6)

key-files:
  created:
    - src/components/squad/ExplainPanel.tsx
  modified:
    - src/components/squad/SquadView.tsx

key-decisions:
  - "ExplainPanel colSpan=9 hard-coded to match SquadView's 9 column headers (Player, Team, Price, Own%, Mins, Gem, Status, Risk, Rec)"
  - "Shortlist only rendered for verdict === 'sell' — Buy/Hold players show reasons only per D-02"
  - "entryHistory.bank passed directly to computeReplacementShortlist — budget arithmetic mirrors transfer-engine.ts"

patterns-established:
  - "Expand state pattern: useState<Set<number>> with toggleExpand(id) function, immutable Set updates"
  - "ExplainPanel: zinc-50 background, reasons as text-xs zinc-600 list, shortlist as flex rows with green pts delta and affordability pill"

requirements-completed:
  - EXP-01
  - EXP-02
  - REC-02

# Metrics
duration: ~15min (continuation agent)
completed: 2026-03-30
---

# Phase 11 Plan 03: ExplainPanel UI Summary

**Expandable player rows in SquadView showing natural-language reasons and replacement shortlist for Sell players, with per-player chevron toggle and bench exclusion**

## Performance

- **Duration:** ~15 min (continuation after human checkpoint)
- **Started:** 2026-03-30
- **Completed:** 2026-03-30
- **Tasks:** 3 (including human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Created ExplainPanel component with zinc-palette styling matching CaptaincyPanel conventions — shows reasons list and optional ranked shortlist
- Wired ExplainPanel into SquadView with independent per-player expand/collapse using `useState<Set<number>>`
- Chevron toggle on starting-XI rows only; bench players excluded from expand
- Sell-verdicted players show "Replacement options" section with rank, name, team, pts delta (+X.X pts in green), and Affordable/Over budget pill
- Buy/Hold players show reasons only (no shortlist section)
- Human verified in browser: expand/collapse works, reasons appear, shortlist ranks render correctly, bench has no chevron

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ExplainPanel component** - `7a8aa25` (feat)
2. **Task 2: Wire ExplainPanel into SquadView with expand state** - `ff38eab` (feat)
3. **Task 3: Verify expand panel and shortlist in browser** - human-approved checkpoint (no code changes)

## Files Created/Modified

- `src/components/squad/ExplainPanel.tsx` - Inline expand panel: reasons list + conditional replacement shortlist with affordability indicators
- `src/components/squad/SquadView.tsx` - Added expand state, chevron toggle button, conditional expand row per starting player

## Decisions Made

- colSpan={9} hard-coded to match current SquadView column count — fragile if columns change, documented as known coupling
- Shortlist only for `verdict === 'sell'` per D-02 — Buy/Hold show reasons only
- Budget arithmetic uses `entryHistory.bank` directly (tenths of millions), mirroring transfer-engine.ts convention

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria met, vitest suite green, human verification approved.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - ExplainPanel receives live data from computeExplanations and computeReplacementShortlist; no hardcoded placeholders.

## Next Phase Readiness

- Phase 11 complete — all three plans (01, 02, 03) delivered EXP-01, EXP-02, REC-02 end-to-end
- SquadView now provides full explainability: every starting player has expand access to reasons, Sell players have ranked replacement alternatives
- No blockers for subsequent phases

---
*Phase: 11-explainability-replacement-shortlist*
*Completed: 2026-03-30*
