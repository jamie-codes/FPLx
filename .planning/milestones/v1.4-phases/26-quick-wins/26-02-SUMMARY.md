---
phase: 26-quick-wins
plan: "02"
subsystem: ui
tags: [react, tailwind, set-pieces, mobile, orientation, tabs, typescript]

dependency_graph:
  requires:
    - phase: 26-01
      provides: [useSetPieces hook, SetPieceChanges types, /api/set-pieces route]
  provides:
    - SetPieceTakerPanel component (SP-01 grid of 20 team cards)
    - SetPieceChangeAlert component (SP-02 amber banner)
    - LandscapeTip component (MOB-LS-01 portrait-mode tip)
    - Set Pieces tab in desktop tab bar and mobile nav
    - LandscapeTip integrated into GemTable and DefConTables
  affects: [src/app/page.tsx, src/components/nav/MobileNav.tsx]

tech-stack:
  added: []
  patterns:
    - isPortrait state via window.innerHeight > window.innerWidth with orientationchange listener
    - sm:hidden CSS guard alongside JS isMobile/isPortrait check (defence-in-depth)
    - Amber alert banner pattern (matches TransferPanel chip-warning amber)
    - Team card grid with 1/2/3 column responsive layout

key-files:
  created:
    - src/components/set-pieces/SetPieceTakerPanel.tsx
    - src/components/set-pieces/SetPieceChangeAlert.tsx
    - src/components/set-pieces/LandscapeTip.tsx
  modified:
    - src/app/page.tsx
    - src/components/nav/MobileNav.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/defcon/DefConTables.tsx

key-decisions:
  - "SetPieceTakerPanel uses useSetPieces hook data not direct API fetch — consistent with other hook consumers"
  - "LandscapeTip placed after filter toolbar in GemTable (below sticky bar) so it scrolls with content on mobile"
  - "DefConTables LandscapeTip placed at top of space-y-8 div, above both table sections — single tip for both tables"
  - "isPortrait uses window.innerHeight > window.innerWidth (not screen.orientation.type) for iOS Safari compatibility"

patterns-established:
  - "Pattern: isPortrait state — always pair with isMobile check; use orientationchange + resize listeners"
  - "Pattern: LandscapeTip insertion — after sticky toolbar, before table content"

requirements-completed: [SP-01, SP-02, MOB-LS-01]

duration: ~15min
completed: "2026-04-27"
---

# Phase 26 Plan 02: Set-piece UI Components + Tab Wiring Summary

**Set Pieces tab delivered with 20-team taker grid (SP-01), amber change alert (SP-02), and portrait landscape tip on Gems/DefCon (MOB-LS-01) — three new components wired into tab navigation and two existing tables**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-27T23:00:00Z
- **Completed:** 2026-04-27T23:10:00Z
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint, pending)
- **Files modified:** 7

## Accomplishments

- Three new components created under `src/components/set-pieces/`: SetPieceTakerPanel, SetPieceChangeAlert, LandscapeTip
- Set Pieces tab added to desktop tab bar ("Set Pieces") and mobile nav ("SP") — positioned after Club Form / Form
- LandscapeTip integrated into GemTable and DefConTables with isPortrait detection via orientationchange listener
- All 21 existing test files pass (240 tests, 8 skipped) — no regressions

## Task Commits

1. **Task 1: Create set-piece components + LandscapeTip** - `4d1e585` (feat)
2. **Task 2: Wire tab navigation + LandscapeTip into Gems/DefCon** - `0860d44` (feat)
3. **Task 3: Visual verification** - pending checkpoint (human-verify)

## Files Created/Modified

- `src/components/set-pieces/SetPieceTakerPanel.tsx` - SP-01 panel: useSetPieces hook, 20-team card grid, loading/error/empty states, TakerRow helper with Changed badge
- `src/components/set-pieces/SetPieceChangeAlert.tsx` - SP-02 amber alert banner, renders only when change_count > 0
- `src/components/set-pieces/LandscapeTip.tsx` - MOB-LS-01 portrait-mode tip, sm:hidden + isMobile/isPortrait guard
- `src/app/page.tsx` - Tab type extended, Set Pieces desktop button, SetPieceTakerPanel content render, SetPieceTakerPanel import
- `src/components/nav/MobileNav.tsx` - Tab type extended, 'SP' entry added to TABS array
- `src/components/gem-table/GemTable.tsx` - isPortrait state, orientationchange listener, LandscapeTip render
- `src/components/defcon/DefConTables.tsx` - isPortrait state, orientationchange listener, LandscapeTip render

## Decisions Made

- LandscapeTip in GemTable placed after the sticky toolbar div but before the player count paragraph — visible when scrolled to top on mobile portrait
- DefConTables LandscapeTip placed as first child of the `space-y-8` container, providing a single tip above both DefCon tables
- `isPortrait` implemented via `window.innerHeight > window.innerWidth` (not `screen.orientation.type`) for iOS Safari reliability — matches the research recommendation
- No new npm dependencies introduced — all components use existing Tailwind v4 utility classes and the useSetPieces hook from Plan 01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Task 3 (human-verify checkpoint) is pending — orchestrator will present to user for visual confirmation
- Once verified: SP-01, SP-02, and MOB-LS-01 are fully shipped
- GemTable and DefConTables now have the LandscapeTip infrastructure; future phases can reuse the isPortrait pattern for other mobile-specific UI

## Known Stubs

None. SetPieceTakerPanel renders real data from the useSetPieces hook which fetches /api/set-pieces (set_piece_changes.json from the pipeline). The teams array may be empty on first run before the pipeline has executed — the empty state is properly handled with copy "Set-piece taker data is not yet available. Run the pipeline to populate this panel."

---
*Phase: 26-quick-wins*
*Completed: 2026-04-27 (Tasks 1-2; Task 3 pending human verify)*
