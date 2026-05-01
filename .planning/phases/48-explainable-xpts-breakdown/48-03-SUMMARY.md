---
phase: 48-explainable-xpts-breakdown
plan: "03"
subsystem: ui
tags: [xpts, hover-card, tailwind, use-client, tdd, css-group-hover, react]
dependency_graph:
  requires:
    - phase: 48-explainable-xpts-breakdown-plan-01
      provides: appearance_pts pipeline field
    - phase: 48-explainable-xpts-breakdown-plan-02
      provides: xPts_components_1gw TypeScript type with appearance_pts
  provides:
    - XPtsCell hover card (XPT-01 visual breakdown)
    - minsRisk prop wired in XPtsCell (D-02 minutes risk signal)
    - use client boundary on columns.tsx
  affects:
    - GemTable xPts_1gw column (all players)
    - existing XPtsCell tests (XPtsCell.test.tsx migrated from title tooltip to hover card)
tech_stack:
  added: []
  patterns:
    - "CSS-only named group-hover (group/xpts) for hover card visibility — no Floating UI/Radix"
    - "useState mobile touch toggle layered on top of CSS group-hover"
    - "use client directive at line 1 of columns.tsx for useState boundary"
    - "sum(components) in render for Total row — not headline xPts_1gw prop (XPT-02 invariant)"
key_files:
  created: []
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/columns.test.tsx
    - tests/components/gem-table/XPtsCell.test.tsx
decisions:
  - "'use client' added to columns.tsx line 1 — entire module is client boundary; createColumns is already used in client components so no server rendering impact"
  - "XPtsCell.test.tsx tests migrated from native title tooltip assertions to hover card DOM assertions — title tooltip removed, tests must reflect new implementation"
  - "appearance_pts added to all components fixtures in XPtsCell.test.tsx to satisfy new required field in type"
metrics:
  duration: "8 minutes"
  completed: "2026-05-01"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 48 Plan 03: XPtsCell Hover Card Summary

**One-liner:** Replaced native title tooltip in XPtsCell with CSS-only Tailwind group/xpts hover card showing 5 labeled component rows (Appearance, Goals, Assists, Clean sheet, Bonus, Total), plus useState mobile touch toggle and MinsRiskBadge inside the card.

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Write 4 RED tests for XPtsCell hover card | TDD RED | 2795aed | src/components/gem-table/columns.test.tsx |
| 2 | Refactor XPtsCell — add hover card, useState, minsRisk prop | TDD GREEN | af35f7f | src/components/gem-table/columns.tsx, tests/components/gem-table/XPtsCell.test.tsx |

## What Was Built

Refactored `XPtsCell` in `src/components/gem-table/columns.tsx`:

- `'use client'` added as line 1 (required for useState)
- `import { useState } from 'react'` and `import type { MinsRisk } from '@/lib/types'` added
- XPtsCell `components` prop type extended with `appearance_pts: number` field
- `minsRisk?: MinsRisk` prop added to XPtsCell and wired at the xPts_1gw call site (`minsRisk={info.row.original.mins_risk}`)
- Native `title` tooltip removed from XPtsCell return
- Wrapper div: `className="relative group/xpts inline-block cursor-help"` with `onClick` mobile toggle
- Hover card div: `absolute bottom-full left-0 mb-1 w-44 z-50` (floats above sticky z-10 web_name column)
- 5 labeled rows: Appearance, Goals, Assists, Clean sheet, Bonus, then `<hr>` divider, then Total
- Total row value: `(appearance_pts + goal_pts + assist_pts + cs_pts + bonus_pts).toFixed(2)` — computed in render, NOT from xPts_1gw prop (satisfies XPT-02 sum invariant)
- MinsRiskBadge rendered as `<div className="mt-1">` below Total row (self-suppresses for null/injured)
- Hover card visibility: `invisible opacity-0 group-hover/xpts:visible group-hover/xpts:opacity-100 transition-opacity` + `open ? 'visible opacity-100' : ''`

Extended `src/components/gem-table/columns.test.tsx` (Task 1 RED tests — 4 new):
- "renders hover card panel with all 5 component row labels when components provided"
- "hover card shows correct numeric values — Total is computed sum of components"
- "renders no hover card when components is undefined (BGW null guard — D-06)"
- "renders MinsRiskBadge inside card when minsRisk is rotation_risk (D-02)"

Updated `tests/components/gem-table/XPtsCell.test.tsx`:
- Added `appearance_pts` to all `components` fixtures to satisfy new required type field
- Migrated 2 tests from native title tooltip assertions to hover card DOM assertions

## Verification

- `npx vitest run src/components/gem-table/columns.test.tsx`: **8 passed** (4 existing + 4 new XPT-01 tests)
- `npx vitest run`: **521 passed**, 1 pre-existing failure (club-form.test.ts — unrelated to Phase 48), 34 skipped
- `grep -n "'use client'" columns.tsx`: line 1
- `grep -n "group/xpts\|group-hover/xpts" columns.tsx`: 2 lines (wrapper div + hover card div)
- `grep -c "z-50" columns.tsx`: 1
- `grep -c "appearance_pts" columns.tsx`: 3 (prop type, `c.appearance_pts.toFixed(2)` in rows array, cardTotal computation)
- No native `title=` in XPtsCell function body

## TDD Gate Compliance

- RED gate: `test(48-03)` commit `2795aed` — 3 tests failing (hover card labels/values not yet rendered; BGW guard passed on existing short-circuit)
- GREEN gate: `feat(48-03)` commit `af35f7f` — all 8 tests passing
- REFACTOR gate: no cleanup needed; implementation is clean as written

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing XPtsCell.test.tsx to match new hover card implementation**
- **Found during:** Task 2 (full vitest suite run)
- **Issue:** `tests/components/gem-table/XPtsCell.test.tsx` had 2 tests asserting native `title=` tooltip behavior (`span[title*="xPts breakdown"]`), and 4 tests passing `components` without the now-required `appearance_pts` field (causing `TypeError: Cannot read properties of undefined (reading 'toFixed')`)
- **Fix:** Updated test file — added `appearance_pts` to all fixtures; migrated title tooltip tests to verify hover card DOM structure (textContent contains labels); test semantics preserved
- **Files modified:** `tests/components/gem-table/XPtsCell.test.tsx`
- **Commit:** af35f7f

**2. [Rule 1 - Bug] Used correct MinsRisk type value in RED tests**
- **Found during:** Task 1 (reading MinsRiskBadge.tsx)
- **Issue:** Plan spec stated `minsRisk="rotation"` and check for "Rotation" — but actual MinsRisk type is `'rotation_risk'` and badge renders "Rotation risk"
- **Fix:** Test uses `minsRisk="rotation_risk"` and `container.textContent.toContain('Rotation risk')`
- **Files modified:** `src/components/gem-table/columns.test.tsx`
- **Commit:** 2795aed

## Known Stubs

None — XPtsCell hover card is fully wired: pipeline provides `appearance_pts`, type is declared, component renders all 5 rows, MinsRiskBadge is rendered inside the card.

## Threat Flags

No new threat surface introduced. The hover card renders already-public `/api/players` data client-side — T-48-05, T-48-06, T-48-07 all accepted per plan threat model.

## Self-Check: PASSED

- [x] `src/components/gem-table/columns.tsx` — modified, `'use client'` on line 1
- [x] `src/components/gem-table/columns.test.tsx` — 4 new Phase 48 tests added
- [x] `tests/components/gem-table/XPtsCell.test.tsx` — migrated from title tooltip to hover card assertions
- [x] All 8 tests in columns.test.tsx pass
- [x] Full vitest suite: 521 passing, 1 pre-existing failure (unrelated)
- [x] Commits 2795aed (RED) and af35f7f (GREEN) exist in git log
