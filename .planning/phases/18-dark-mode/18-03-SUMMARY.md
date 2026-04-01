---
phase: 18-dark-mode
plan: "03"
subsystem: ui-components
tags: [dark-mode, tailwind, badges, tables, captaincy, fixtures]
dependency_graph:
  requires: ["18-01"]
  provides: ["DARK-03"]
  affects: ["MinsRiskBadge", "VerdictBadge", "FixtureBadges", "CaptaincyPanel", "DefConTables", "ClubFormTable", "ValueGemsTable", "ExplainPanel"]
tech_stack:
  added: []
  patterns: ["dark: Tailwind variants", "inverted dark badge palette (dark bg + light text)", "dark thead bg-zinc-900", "dark alternating rows even:bg-zinc-800"]
key_files:
  created: []
  modified:
    - src/components/shared/MinsRiskBadge.tsx
    - src/components/shared/VerdictBadge.tsx
    - src/components/fixtures/FixtureBadges.tsx
    - src/components/captaincy/CaptaincyPanel.tsx
    - src/components/defcon/DefConTables.tsx
    - src/components/club-form/ClubFormTable.tsx
    - src/components/value-gems/ValueGemsTable.tsx
    - src/components/squad/ExplainPanel.tsx
    - tests/lib/mins-risk-badge.test.ts
decisions:
  - "Badge dark palette: inverted scheme (dark bg + light text) — dark:bg-*-900 + dark:text-*-200 for all status badge types"
  - "ValueGemsTable active filter pill: fully inverted in dark (dark:bg-white dark:text-zinc-900) for clear selection contrast"
  - "Green/red semantic colours on ExplainPanel shortlist budget spans: bg-green-950/bg-red-950 for dark mode depth"
metrics:
  duration_mins: 10
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 9
---

# Phase 18 Plan 03: Dark Mode — Remaining Component Coverage Summary

Dark mode Tailwind variants added to all 9 remaining component files: badge components (MinsRiskBadge, VerdictBadge), fixture/captaincy panels (FixtureBadges, CaptaincyPanel), table components (DefConTables, ClubFormTable, ValueGemsTable), and ExplainPanel — completing DARK-03 coverage so every tab is fully dark-mode ready.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Dark variants on badge components and FixtureBadges/CaptaincyPanel | 73f9374 | MinsRiskBadge.tsx, VerdictBadge.tsx, FixtureBadges.tsx, CaptaincyPanel.tsx, tests/lib/mins-risk-badge.test.ts |
| 2 | Dark variants on remaining table components and ExplainPanel | 2102cbe | DefConTables.tsx, ClubFormTable.tsx, ValueGemsTable.tsx, ExplainPanel.tsx |

## What Was Built

### Badge Components

**MinsRiskBadge.tsx** — BADGE_MAP updated with inverted dark palette:
- `nailed`: `dark:bg-green-900 dark:text-green-200`
- `likely_start`: `dark:bg-blue-900 dark:text-blue-200`
- `rotation_risk`: `dark:bg-amber-900 dark:text-amber-200`
- `cameo`: `dark:bg-zinc-700 dark:text-zinc-300`

**VerdictBadge.tsx** — VERDICT_MAP updated:
- `buy`: `dark:bg-green-900 dark:text-green-200`
- `hold`: `dark:bg-zinc-700 dark:text-zinc-300`
- `sell`: `dark:bg-red-900 dark:text-red-300`

### Fixture and Captaincy

**FixtureBadges.tsx** — TIER_COLOURS: full bg/text/border dark variants per tier; DGW label `dark:text-violet-400`.

**CaptaincyPanel.tsx** — TYPE_MAP badges (safe/upside) darkened; card backgrounds `dark:bg-zinc-800`; borders, text, DGW label all dark-aware.

### Table Components

**DefConTables.tsx** — thead `dark:bg-zinc-900`, rows `dark:even:bg-zinc-800`, hover `dark:hover:bg-zinc-700`, border/text variants.

**ClubFormTable.tsx** — same pattern as DefConTables.

**ValueGemsTable.tsx** — active filter pill inverted (`dark:bg-white dark:text-zinc-900`); inactive pill `dark:bg-zinc-800`; thead and rows match table pattern.

### ExplainPanel.tsx

Panel `dark:bg-zinc-800`, text zinc variants (600→400, 500→400, 700→300), budget affordability spans `dark:bg-green-950`/`dark:bg-red-950`.

## Decisions Made

- **Inverted badge palette**: Using `dark:bg-*-900 + dark:text-*-200` across all badge types for consistency — deep coloured bg with light text in dark mode, matching Phase 18-01 research guidance.
- **Active filter pill inversion**: ValueGemsTable active pill goes `dark:bg-white dark:text-zinc-900` — fully inverted to maintain clear selection contrast on a dark background.
- **Semantic colours preserved**: `text-green-600`/`text-red-600` distance-to-threshold values in DefCon, `text-amber-600` in LastUpdated — left as-is per research (readable in both modes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated mins-risk-badge tests to match new dark class strings**
- **Found during:** Task 1 — npm test after editing MinsRiskBadge.tsx
- **Issue:** `tests/lib/mins-risk-badge.test.ts` asserted exact bg/text values (`'bg-green-100'`, etc.) which no longer matched after dark: classes were appended
- **Fix:** Updated 4 test assertions to assert the full dark-aware class strings (`'bg-green-100 dark:bg-green-900'`, etc.)
- **Files modified:** `tests/lib/mins-risk-badge.test.ts`
- **Commit:** 73f9374

## Known Stubs

None — all components are wired to real data sources; no placeholder content introduced.

## Self-Check: PASSED

All 8 modified source files exist on disk. Both task commits (73f9374, 2102cbe) confirmed in git log.
