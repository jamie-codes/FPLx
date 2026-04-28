---
phase: 34-chip-strategy
plan: 02
subsystem: planner-ui
tags: [fpl, chip-strategy, planner-tab, tailwind-v4, accessibility, component]

requires:
  - phase: 34-chip-strategy
    plan: 01
    provides: computeBBScore, computeTCScore, computeFHResult, buildClubFormMap, GWEaseScore, FHResult, FHSquadPlayer, useChipHistory

provides:
  - ChipStrategyPanel component with panel shell + BB/TC rows + FH expand-on-click row
  - 9 passing component tests covering all states and interactions
  - PlannerTab modified: ChipStrategyPanel mounted as first child, useClubForm added

affects: [PlannerTab, Planner tab UI, CHIP-01, CHIP-02, CHIP-03]

tech-stack:
  added: []
  patterns:
    - "always-expanded analytics panel: no accordion, 3 chip rows always visible (D-10)"
    - "single expand-on-click row: FH row with binary fhExpanded state, role=button, aria-expanded"
    - "engine-as-prop: PlannerTab owns all hooks, passes data shapes down to ChipStrategyPanel"
    - "forceMuted ease bar: used chip rows render all cells zinc, no intensity or ring"
    - "T-34-01 belt-and-braces: /^\\d+$/.test(teamId) guard applied at ChipStrategyPanel prop boundary"

key-files:
  created:
    - src/components/planner/ChipStrategyPanel.tsx
    - src/components/planner/ChipStrategyPanel.test.tsx (replaced Wave 0 stub)
  modified:
    - src/components/planner/PlannerTab.tsx

key-decisions:
  - "Engine-as-prop: PlannerTab owns useClubForm and all data hooks; ChipStrategyPanel receives pre-fetched data shapes as props (sole hook inside panel is useChipHistory)"
  - "FHChipRow: used and unused render paths split into explicit branches rather than conditional attributes to avoid role/tabIndex on used rows"
  - "Space preventDefault only (not Enter) per plan spec; Enter fires natively without preventDefault to allow potential form propagation"

requirements-completed:
  - CHIP-01
  - CHIP-02
  - CHIP-03

duration: ~10min
completed: 2026-04-28T21:37:00Z
---

# Phase 34 Plan 02: ChipStrategyPanel Component Summary

**ChipStrategyPanel with locked Tailwind classes and copy; 9 tests green; PlannerTab mounts panel as first child with 7 forwarded props**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-28T21:23:37Z
- **Completed:** 2026-04-28T21:37:00Z
- **Tasks executed:** 3 (Tasks 1-3 automated; Task 4 pending human verification)
- **Files modified:** 3

## Accomplishments

- `ChipStrategyPanel.tsx` (302 lines): panel shell + 3 chip rows (BB non-interactive, TC non-interactive, FH expand-on-click) + FHSquadTable. All Tailwind classes and copy strings match 34-UI-SPEC.md byte-for-byte.
- Loading / error / no-team-id states render correctly with locked copy strings.
- FH row: click + Enter/Space keyboard toggle, `aria-expanded` attribute, Space `preventDefault`, `▾`/`▴` chevron.
- Used chips: `opacity-40`, `aria-disabled="true"`, "Used GW{N}" label, all ease cells muted zinc.
- `ChipStrategyPanel.test.tsx`: 9 passing tests (replaced Wave 0 it.todo stubs); covers all 3 requirements (CHIP-01/02/03).
- `PlannerTab.tsx`: ChipStrategyPanel mounted as first child of `<div className="space-y-6">` with all 7 props; `useClubForm()` added; all existing handlers and TransferPlanTable rendering preserved byte-identical.
- Full vitest suite: 348 passed | 34 skipped (31 test files total) — no regressions.

## Task Commits

1. **Task 1: ChipStrategyPanel component** - `a7258e5` (feat)
2. **Task 2: Full component tests** - `760f711` (test)
3. **Task 3: Mount ChipStrategyPanel in PlannerTab** - `a1b9f8b` (feat)
4. **Task 4: Human verification** — PENDING (checkpoint:human-verify)

## Files Created/Modified

- `src/components/planner/ChipStrategyPanel.tsx` — 302 lines; panel shell + ease bar + FH expand; all locked UI-SPEC classes
- `src/components/planner/ChipStrategyPanel.test.tsx` — 182 lines; 9 tests replacing Wave 0 stub
- `src/components/planner/PlannerTab.tsx` — +12 lines; ChipStrategyPanel mount + useClubForm

## Decisions Made

- **Engine-as-prop pattern:** PlannerTab owns all data hooks (usePlayers, useSquad, useMyTeam, useClubForm). ChipStrategyPanel receives pre-computed data shapes as props; its sole hook is useChipHistory. This keeps the panel pure — testable without mocking 4+ hooks.
- **FHChipRow used/unused branching:** The used and unused render paths for the FH row are explicit `if (isUsed) return <li>...` branches rather than conditional attribute spreading. This avoids accidentally attaching `role="button"` or `tabIndex` to a used FH row.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. ChipStrategyPanel is a read-only rendering component consuming existing data shapes. T-34-01 mitigated: `/^\d+$/.test(teamId)` guard applied at both useChipHistory.enabled (Plan 01) and ChipStrategyPanel prop boundary (this plan).

## Known Stubs

None — all three chip rows wire to real engine functions (computeBBScore, computeTCScore, computeFHResult). All data flows through real hooks; no placeholder data.

## Human Verification Pending (Task 4)

Task 4 is a `checkpoint:human-verify` gate. The following 14 checks must be performed in a browser before the phase is complete:

1. Dev server starts: `npm run dev`
2. Open http://localhost:3000 and navigate to the **Planner** tab (FPL Team ID set via localStorage)
3. Panel sits ABOVE "Planning Horizon" heading and "Generate Plan" button; card has thin border, white/zinc-900 background, p-4 padding
4. Heading: `Chip Strategy` (large semibold); subheading: `Best upcoming gameweek to play each remaining chip.`
5. Three chip rows in order: Bench Boost, Triple Captain, Free Hit — each with pill, "Best: GW{N}" label, 5-cell ease bar
6. Best-GW cell has green ring (`ring-2 ring-offset-1`); cells follow green/amber/red scale
7. FH row reads `Best: GW{N} — click for squad` with `▾` chevron; click expands inline table with Player/Pos/xPts/Ease GW{N}/£ columns and up to 15 rows; chevron flips to `▴`; click again to collapse
8. Keyboard: Tab to FH row; Enter expands; Space toggles and page does NOT scroll
9. Used chips (if applicable): row at ~40% opacity, "Used GW{N}" label, all ease cells flat zinc, no ring
10. No team ID: clear localStorage and refresh — only the locked message appears
11. Loading/error states: disable network to force chip history error; confirm red error copy
12. No regression: Generate Plan button works; TransferPlanTable still renders below panel
13. Accessibility: `aria-label="Chip Strategy"` on section, `aria-expanded` on FH row, `role="img"` on ease bars
14. Console: no React warnings, no hydration errors

**Resume signal:** Type "approved" if all 14 checks pass; describe any deviation otherwise.

## Self-Check: PASSED

All 3 files exist and all 3 task commits verified in git log.
