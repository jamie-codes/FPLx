---
phase: 65
plan: 04
subsystem: components
tags: [rejection-explainer, gem-table, expand-row, why-01, manual-uat]
dependency_graph:
  requires:
    - 065-02 (computeRejection + RejectionResult from explain.ts)
  provides:
    - src/components/gem-table/GemTable.tsx (WHY-01 row-expand with rejection panel on desktop and mobile)
  affects:
    - All GemTable rows are now expandable on desktop and mobile (was mobile-only)
tech_stack:
  added: []
  patterns:
    - IIFE pattern for computing rejection once and rendering two sibling <tr> elements
    - Adaptive framing RejectionPanelInline component (positive vs reasons-list)
    - hidden sm:table-row for desktop expand row (Pitfall 5 from RESEARCH.md)
key_files:
  created: []
  modified:
    - src/components/gem-table/GemTable.tsx
decisions:
  - "IIFE pattern used to compute computeRejection() once and share result across both mobile and desktop expand rows — avoids calling the function twice per expanded row"
  - "RejectionPanelInline declared as a module-level function above GemTable — keeps the row map JSX readable without extracting to a separate file"
  - "dark:text-green-400 used in positive framing (UI-SPEC specifies green-700 dark:green-400 for this surface)"
metrics:
  duration: 15m
  completed: 2026-05-06
---

# Phase 65 Plan 04: GemTable WHY-01 Row Expand Integration Summary

**One-liner:** GemTable wired with computeRejection via IIFE expand-row pattern — all rows expandable on desktop and mobile, desktop shows rejection panel only, mobile preserves action-sheet + hidden columns and appends rejection panel below.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Modify GemTable expand machinery + render rejection panel | f8c4d43 | src/components/gem-table/GemTable.tsx |
| 2 | Manual UAT — WHY-01 GemTable rejection panel | (checkpoint — awaiting human) | — |

## GemTable.tsx Diff Summary

Five edits applied (all in `src/components/gem-table/GemTable.tsx`):

**Edit A — Import (line 25):**
```typescript
import { computeRejection } from '@/lib/explain'
```

**Edit B — POSITION_CODES_LABEL const (lines 27-33):**
```typescript
const POSITION_CODES_LABEL: Record<number, string> = {
  1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD',
}
```

**Edit C — getRowCanExpand (line 159):**
```typescript
// BEFORE: getRowCanExpand: () => isMobile,
getRowCanExpand: () => true,
```

**Edit D — tr className + onClick (lines 238-244):**
```typescript
className={`even:bg-gray-50 dark:even:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700 cursor-pointer active:bg-blue-100`}
onClick={() => {
  row.toggleExpanded()
  if (isMobile) {
    setActionSheetPlayer(row.original)
  }
}}
```

**Edit E — Fragment expand row structure (lines 259-330):**
- Replaced single `{row.getIsExpanded() && (<tr className="sm:hidden">...)}` with IIFE pattern
- IIFE computes `computeRejection(row.original, scoredPlayers)` once
- Returns React fragment with two sibling `<tr>` elements:
  - Mobile: `className="bg-blue-50 dark:bg-blue-950 sm:hidden"` — preserves action-sheet + dl + appends `<RejectionPanelInline>` below
  - Desktop: `className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row"` — rejection panel only (D-02)

**RejectionPanelInline component (lines 55-89):**
- Declared above GemTable function
- Adaptive framing: `reasons.length === 0` → green positive line; non-empty → "Why not recommended:" header + `<ul>`
- Positive copy: `"No rejection signals — ranked #X at POS by xPts (Y.Y pts projected)"` (em-dash U+2014)
- Reasons list: `text-xs text-zinc-600 dark:text-zinc-400` per UI-SPEC

## Automated Verification

### Rejection unit tests (Plan 02 contract — regression check):
```
Test Files  1 passed (1)
     Tests  14 passed (14)
  Duration  169ms
```

### TypeScript type check:
```
npx tsc --noEmit → 0 errors (clean)
```

### GemTable component tests (adjacent regression scan):
```
Test Files  4 passed (4)
     Tests  39 passed (39)
  Duration  901ms
```

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| Import computeRejection added | PASS — 1 line |
| getRowCanExpand: () => true | PASS — 1 line |
| getRowCanExpand isMobile removed | PASS — 0 lines |
| Desktop expand row `hidden sm:table-row` | PASS — 1 line |
| Mobile expand row `sm:hidden` preserved | PASS — 1 line |
| cursor-pointer unconditional | PASS — 1 line, no isMobile ternary |
| onClick: toggleExpanded unconditional, action-sheet mobile-only | PASS |
| RejectionPanelInline declared | PASS — 1 line |
| POSITION_CODES_LABEL const | PASS — 1 line |
| Positive framing em-dash U+2014 | PASS — "No rejection signals — ranked #" |
| "Why not recommended:" header | PASS — 1 line |
| HIDDEN_COLUMN_LABELS unchanged | PASS — team_short_name: 'Team' count = 1 |
| Mobile dl preserved | PASS — grid grid-cols-2 gap-x-4 gap-y-1 text-sm |
| Rejection unit tests green | PASS — 14/14 |
| Type check clean | PASS — 0 errors |

## Manual UAT (Task 2)

**Status: Awaiting human verification**

The following UAT steps need to be performed by the user:
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000` at desktop width (≥ 640px)
3. Navigate to Analyse → Gem Ratings tab
4. Confirm table renders with GW1/3/5 toggle and preset toggle
5. Click any row — expected: blue-tinted expand row below with rejection panel (positive green line OR "Why not recommended:" + reasons list)
6. Click same row again — confirm collapse
7. Click multiple rows in succession — each toggles independently
8. Resize narrow (< 640px) / mobile — clicking still expands; panel shows action-sheet first, then dl, then rejection panel
9. On mobile, tap "Compare" — PlayerComparisonModal opens (no regression)
10. On mobile, tap ✕ — action-sheet dismisses (no regression)
11. Filter by position (e.g. MID), expand low-ranked MID — rank label says "Ranked #N at MID by xPts" with plausible large N
12. Sort by xPts — rank labels still reflect xPts-within-position rank
13. Confirm em-dashes render correctly (not `--` or `&mdash;`)
14. Toggle dark mode — panel renders correctly in dark mode

## Deviations from Plan

None — plan executed exactly as written. All five edits (A through E) applied as specified.

## Known Stubs

None — RejectionPanelInline is fully implemented. computeRejection is fully implemented (Plan 02). All signals are wired. UAT in Task 2 verifies the DOM state machine.

## Threat Flags

None — pure UI extension over trusted in-memory data. T-65-05 (player names interpolated through RejectionPanelInline JSX) is satisfied by React's automatic JSX text-node escaping. No `dangerouslySetInnerHTML` used.

## Self-Check: PASSED

Files exist:
- src/components/gem-table/GemTable.tsx: FOUND (modified — 348 lines)

Commits exist:
- f8c4d43: FOUND (feat(065-04): wire WHY-01 rejection panel into GemTable expand rows)
