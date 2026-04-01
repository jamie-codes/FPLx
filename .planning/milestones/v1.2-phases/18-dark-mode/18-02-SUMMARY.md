---
phase: 18-dark-mode
plan: "02"
subsystem: ui-theming
tags: [dark-mode, tailwind, accessibility, components]
dependency_graph:
  requires: [18-01]
  provides: [DARK-03-partial]
  affects: [GemTable, TransferPanel, SquadView, MobileNav, page.tsx]
tech_stack:
  added: []
  patterns: [dark: Tailwind variants, systematic colour audit]
key_files:
  created: []
  modified:
    - src/components/gem-table/GemTable.tsx
    - src/components/gem-table/PositionFilter.tsx
    - src/components/gem-table/GwToggle.tsx
    - src/components/transfers/TransferPanel.tsx
    - src/components/squad/SquadView.tsx
    - src/components/nav/MobileNav.tsx
    - src/app/page.tsx
decisions:
  - "dark:even:bg-zinc-800 on GemTable rows preserves row separation in dark mode"
  - "GwToggle active state inverted (dark:bg-white dark:text-zinc-900) for dark mode contrast"
  - "TransferPanel inputs get dark:bg-zinc-800 + dark:border-zinc-600 (Pitfall 5 prevention)"
  - "SquadView sticky columns: dark:bg-zinc-900 applied to both thead and tbody sticky cells"
metrics:
  duration_seconds: 347
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_modified: 7
requirements:
  - DARK-03
---

# Phase 18 Plan 02: Dark Mode High-Complexity Components Summary

**One-liner:** Systematic dark: Tailwind variants on 7 high-density components — no white sticky/fixed bars, badge-readable dark palette, visible input borders.

## What Was Built

Added `dark:` Tailwind class variants to all 7 high-complexity component files identified in the colour audit. These are the components with sticky/fixed elements, dense badge usage, and form inputs that would be most visually broken in dark mode.

### GemTable.tsx, PositionFilter.tsx, GwToggle.tsx (Task 1)

**GemTable critical sticky elements (Pitfall 1):**
- Filter bar div (sticky z-40): `bg-white dark:bg-zinc-900`, `border-gray-100 dark:border-zinc-800`
- Table thead (sticky): `bg-white dark:bg-zinc-900`, `border-gray-200 dark:border-zinc-700`
- Player name column header (sticky left-0 z-30): `bg-white dark:bg-zinc-900`
- Player name column cells (sticky left-0 z-10): `bg-white dark:bg-zinc-900`

**GemTable row colours (Pitfalls 3 and 4):**
- Alternating rows: `even:bg-gray-50 dark:even:bg-zinc-800`
- Hover: `hover:bg-blue-50 dark:hover:bg-zinc-700`
- Expanded row: `bg-blue-50 dark:bg-blue-950`

**GemTable other:**
- Back-to-top button: `bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900` (inverted)
- Text colours: gray-500/gray-700 headers updated to dark:zinc-400/dark:zinc-300

**PositionFilter:** `bg-blue-600 dark:bg-blue-500` active, `bg-gray-100 dark:bg-zinc-700` inactive, `dark:hover:bg-zinc-600`

**GwToggle:** `bg-zinc-900 dark:bg-white text-white dark:text-zinc-900` active (inverted), `bg-white dark:bg-zinc-800` inactive, `border-zinc-300 dark:border-zinc-600`

### TransferPanel.tsx (Task 2)

Most colour-dense component — 50 dark: instances added:
- Panel border: `dark:border-zinc-700`
- Form inputs: `dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100` (Pitfall 5)
- Load Squad button: `dark:bg-zinc-100 dark:text-zinc-900` (inverted)
- Save token button: `dark:bg-blue-500`
- Chip warning (amber): `dark:bg-amber-950 dark:text-amber-200`
- Chip warning (blue/wildcard): `dark:bg-blue-950 dark:text-blue-200`
- Save recommendation: `dark:bg-green-950 dark:text-green-200`
- Error state: `dark:bg-red-950 dark:text-red-300`
- Transfer cards: `dark:bg-zinc-800 dark:border-zinc-700`
- Budget badges: `dark:bg-green-900 dark:text-green-200` / `dark:bg-red-900 dark:text-red-300`

### SquadView.tsx (Task 2)

- Budget summary card: `dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400`
- Table headers: `dark:text-zinc-400`
- Sticky Player column thead (z-30): `dark:bg-zinc-900`
- Sticky Player column tbody (z-10): `dark:bg-zinc-900 dark:text-zinc-100`
- Row borders: `dark:border-zinc-800`
- Row hover: `dark:hover:bg-zinc-700`
- All other text cells: `dark:text-zinc-400`
- Captain/VC badges: `dark:text-amber-400` / `dark:text-zinc-400`

### MobileNav.tsx (Task 2)

- Fixed nav bar: `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700`
- Active tab text: `dark:text-zinc-100`
- Inactive tab text: `dark:text-zinc-500`

### page.tsx tab strip (Task 2)

- Tab strip border: `dark:border-zinc-700`
- Active tab: `dark:border-white dark:text-white`
- Inactive tab: `dark:text-zinc-400 dark:hover:text-zinc-200`

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: GemTable, PositionFilter, GwToggle | c5fb673 | 3 files |
| Task 2: TransferPanel, SquadView, MobileNav, page.tsx | 83eee79 | 4 files |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all dark variants are fully wired to production class strings.

## Self-Check: PASSED

- All 7 files modified and committed
- GemTable.tsx: 11 dark: instances (plan required >= 10) ✓
- TransferPanel.tsx: 50 dark: instances (plan required >= 15) ✓
- MobileNav.tsx: bg-white has dark:bg-zinc-900 on same line ✓
- page.tsx: dark:border-zinc-700 on tab strip ✓
- page.tsx: dark:text-white on active tab ✓
- npm test: 16 passed, 0 failed ✓
