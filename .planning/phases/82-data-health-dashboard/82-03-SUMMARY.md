---
phase: 82
plan: 03
subsystem: ui
tags: [react, ui, accuracy-tab, accessibility, tanstack-query, tdd]
dependency_graph:
  requires: [82-02]
  provides: [src/components/accuracy/AccuracyTab.tsx DataHealthPanel]
  affects: [src/components/accuracy/AccuracyTab.test.tsx]
tech_stack:
  added: []
  patterns: [collapsible panel with useState, const panel hoist pattern, TIER_CLASSES reuse, rollUpStatus roll-up helper]
key_files:
  created: []
  modified:
    - src/components/accuracy/AccuracyTab.tsx
    - src/components/accuracy/AccuracyTab.test.tsx
decisions:
  - "[D-10/D-11] const panel = <DataHealthPanel /> declared before all early returns so it renders in every AccuracyTab branch (loading/error/no-data/success)"
  - "[Pitfall 6] No useEffect depending on data to reset isExpanded — state survives 60s refetches as confirmed by Network tab observation"
  - "[Rule 2 - Missing mock] useDataHealth mock added to AccuracyTab.test.tsx to preserve 6→5 baseline failure count"
metrics:
  duration: ~15 minutes
  completed: "2026-05-08T19:00:00Z"
  tasks: 2
  files: 2
---

# Phase 82 Plan 03: DataHealthPanel UI Component Summary

**One-liner:** Collapsible DataHealthPanel sub-component added to AccuracyTab, hoisted above all early returns via `const panel`, with rollUpStatus roll-up, pill text/colour matching 82-UI-SPEC exactly, and isExpanded preserved across 60s refetches.

## What Was Built

### `src/components/accuracy/AccuracyTab.tsx` (modified)

**New import:**
```typescript
import { useDataHealth } from '@/lib/hooks/useDataHealth'
```
Type-import block extended with `DataHealth` and `SanityCheck` from `@/lib/types`.

**New module-scoped helpers (after `getHitRateTier`, before `HitRateBadge`):**

- `SANITY_CHECK_LABELS` — id-to-display-label map for the 4 sanity checks
- `RED_PILL_CLS` — shared red pill Tailwind class string (`bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`)
- `rollUpStatus(checks)` — error > warn > ok precedence (D-07)
- `formatSanityValue(check)` — boolean as 'true'/'false', understat_null_pct with 2dp + '%', integers as-is
- `SanityIcon({ status })` — inline span with aria-label; green ✓ / amber ⚠ / red ✗

**New `DataHealthPanel` component (before `export function AccuracyTab`):**

- Calls `useDataHealth()` directly — independent of `useAccuracy` (D-10/D-11)
- `useState<boolean>(false)` — collapsed by default; NO useEffect on `data` (Pitfall 6)
- Three loading states drive pill text and class:
  - `isLoading && !data` → 'Loading…' / TIER_CLASSES.LOW (zinc), button disabled
  - `error || !data` (settled, no data) → 'Unavailable' / RED_PILL_CLS, button disabled
  - Data present → roll-up: 'All OK' / TIER_CLASSES.HIGH, 'Warnings' / TIER_CLASSES.MEDIUM, 'Errors' / RED_PILL_CLS
- Header: `<button type="button" aria-expanded={canExpand ? isExpanded : false} disabled={!canExpand}>`
  with `<h2>`, status pill, and conditional chevron ▾/▴ (hidden when disabled)
- Expanded body: `<table>` reusing `TABLE_CLS` / `TH_CLS` / `TR_CLS` / `TD_CLS` — 4 columns (Check / Status / Value / Threshold)

**`AccuracyTab` hoist pattern:**
```typescript
const panel = <DataHealthPanel />
```
Declared once after `useAccuracy()`, then `{panel}` appears as first child in all 4 render branches (loading / error / no-data / success). Existing section `className` and `aria-label` preserved on all branches.

### `src/components/accuracy/AccuracyTab.test.tsx` (modified)

`useDataHealth` mock added (returns `{ data: undefined, isLoading: false, error: null }`) to prevent the new import from breaking the existing test suite. This preserved the pre-existing 5-failure TEST-57 baseline — no new regressions introduced.

## UI-SPEC Conformance

Pill copy / colour / icon mapping verified against `.planning/phases/82-data-health-dashboard/82-UI-SPEC.md`:

| State | Pill text | Tailwind class | Chevron |
|-------|-----------|----------------|---------|
| Loading | 'Loading…' | TIER_CLASSES.LOW (zinc) | hidden |
| Unavailable | 'Unavailable' | RED_PILL_CLS (red) | hidden |
| All checks ok | 'All OK' | TIER_CLASSES.HIGH (green) | ▾/▴ |
| Any warn | 'Warnings' | TIER_CLASSES.MEDIUM (amber) | ▾/▴ |
| Any error | 'Errors' | RED_PILL_CLS (red) | ▾/▴ |

Status icon aria-labels: `aria-label="ok"` / `aria-label="warning"` / `aria-label="error"` — matches UI-SPEC §Accessibility Contract exactly.

## Visual Checkpoint

**Task 2 outcome: Approved by user — all 8 sub-checks passed.**

Sub-checks verified:
- a. "Data Health" heading renders as first element under Accuracy tab
- b. Status pill shows "All OK" in green (TIER_CLASSES.HIGH)
- c. Chevron ▾ visible in collapsed state
- d. Click toggles aria-expanded, chevron flips to ▴, 4-row table appears with correct labels/icons/values/thresholds
- e. 60s Network tab: `/api/data-health` refetch fired; panel did NOT collapse — isExpanded preserved (Pitfall 6 confirmed)
- f. Deleted `data_health.json`: pill shows "Unavailable" in red, chevron hidden, button disabled
- g. Stub JSON with warn/error sanity_checks: pill turned amber ("Warnings") and red ("Errors") correctly
- h. Keyboard focus ring visible; Enter/Space toggles expansion (standard button behaviour)

## Pitfall 6 Confirmation

`isExpanded` state is managed by `useState<boolean>(false)` inside `DataHealthPanel`. There is no `useEffect` that depends on `data`, `isLoading`, or any query state. The TanStack Query 60s `refetchInterval` triggers a re-render but does not unmount `DataHealthPanel` — React preserves component state across re-renders caused by parent data changes. Network tab observation during Task 2 sub-check (e) confirmed the panel remained expanded after the first automatic refetch at the 60-second mark.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing mock] useDataHealth mock added to AccuracyTab.test.tsx**
- **Found during:** Task 1 — running `npm run test` after implementation
- **Issue:** The new `import { useDataHealth }` in AccuracyTab.tsx caused the existing test suite to throw an unresolved-import error, which would have introduced a 6th test failure on top of the TEST-57 baseline
- **Fix:** Added `vi.mock('@/lib/hooks/useDataHealth', ...)` returning `{ data: undefined, isLoading: false, error: null }` — enough for tests to mount AccuracyTab without attempting a real fetch
- **Files modified:** `src/components/accuracy/AccuracyTab.test.tsx`
- **Commit:** 928889f (included in the single task commit)

## Known Stubs

None — all sanity check data flows from the real `/api/data-health` endpoint backed by `pipeline/cache/data_health.json`. No hardcoded values or placeholder text rendered to the UI.

## Threat Flags

No new threat surface beyond what was planned.

All threats from `<threat_model>` mitigated:
- T-82-06: Only `threshold`/`value`/`status` fields rendered as text; no `dangerouslySetInnerHTML`
- T-82-07: `grep -c "setIsExpanded(false)" AccuracyTab.tsx` returns 0 — confirmed no state reset on refetch
- T-82-08: `refetchIntervalInBackground` defaults to false in TanStack v5; accepted

## Self-Check: PASSED

Files exist:
- FOUND: src/components/accuracy/AccuracyTab.tsx
- FOUND: src/components/accuracy/AccuracyTab.test.tsx
- FOUND: .planning/phases/82-data-health-dashboard/82-03-SUMMARY.md

Commit exists:
- FOUND: 928889f (feat(82-03): add DataHealthPanel to AccuracyTab with 60s refetch)
