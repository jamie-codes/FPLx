---
phase: 94-rejection-explainer-enhancements
plan: "03"
subsystem: ui
tags: [react, tailwind, explain, computeHeadToHead, GemTable, PlayerSearchInput]

# Dependency graph
requires:
  - phase: 94-rejection-explainer-enhancements/94-01
    provides: computeHeadToHead(x, y, allPlayers) composition helper (SC-4); 8-predicate computeRejection
  - phase: 94-rejection-explainer-enhancements/94-02
    provides: PlayerSearchInput shared autocomplete component

provides:
  - GemTable WHY-01-B: ComparisonSearch row-scoped component mounted in both mobile and desktop expand-row surfaces
  - Head-to-head rejection-reason-diff output framed as "X beats Y because Y was penalised for: <ul>"
  - Zero-predicate fallback copy for identical rejection-reason sets
  - Row-collapse state reset (no external state lifting)

affects: [phase-95, any phase touching GemTable expand-row layout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IIFE-scoped component state reset: ComparisonSearch rendered inside row.getIsExpanded() IIFE — state resets naturally on collapse without lifting"
    - "SC-4 composition output: computeHeadToHead(x, y, allPlayers) composes two computeRejection calls; GemTable never runs parallel predicate logic"
    - "lifecycleLabels intentionally omitted in GemTable context (D-05 / Open Q2): both x and y have empty Map, so lifecycle reasons cannot appear in the diff"

key-files:
  created:
    - src/components/gem-table/ComparisonSearch.tsx
  modified:
    - src/components/gem-table/GemTable.tsx

key-decisions:
  - "Used <ul> list rendering for rejection reasons rather than prose/comma-joined sentence — rejection reason strings are full phrases (often containing commas/parens) that benefit from list formatting"
  - "lifecycleLabels intentionally not passed to computeHeadToHead — GemTable has no squad context (D-05 / RESEARCH Open Q2); lifecycle reasons silent for both x and y so cannot appear in diff"
  - "Row-level state encapsulation via IIFE placement: ComparisonSearch inside row.getIsExpanded() IIFE means compPlayer resets on collapse with no external state lifting required"

patterns-established:
  - "WHY-01-B pattern: row-scoped comparison search using PlayerSearchInput + computeHeadToHead composition for rejection-reason-diff output"

requirements-completed: [WHY-01]

# Metrics
duration: ~45min (Tasks 1-2 automated; Task 3 manual UAT)
completed: 2026-05-11
---

# Phase 94 Plan 03: ComparisonSearch (GemTable WHY-01-B) Summary

**ComparisonSearch row-scoped component mounting computeHeadToHead composition output inside GemTable desktop and mobile expand rows, delivering rejection-reason-diff head-to-head narrative (SC-4)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-11
- **Completed:** 2026-05-11
- **Tasks:** 3 (2 automated + 1 manual UAT checkpoint)
- **Files modified:** 2

## Accomplishments

- Created `src/components/gem-table/ComparisonSearch.tsx` (88 lines) — row-scoped component using `useState`/`useMemo`, excludes self from autocomplete candidates, calls `computeHeadToHead(rowPlayer, compPlayer, allPlayers)` with the revised 3-arg SC-4 signature, renders Y's rejection reasons X does not share as a `<ul>` with "X beats Y because Y was penalised for:" framing, zero-predicate fallback when diff is empty, and a `× clear` button
- Mounted `<ComparisonSearch rowPlayer={row.original} allPlayers={scoredPlayers} />` in both expand-row surfaces of GemTable.tsx — mobile expand row (line 368, after FragilityBadge IIFE at lines 361-364) and desktop expand row (line 393, after FragilityBadge IIFE at lines 386-389)
- Manual UAT approved — all 10 verification steps passed including self-exclusion, rejection-reason-diff narrative, zero-predicate fallback, × clear behavior, row-collapse state reset, mobile layout, and confirmation that no `Lifecycle:` reason appears in GemTable h2h output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ComparisonSearch component (WHY-01-B row-scoped h2h)** - `7e2176d` (feat)
2. **Task 2: Mount ComparisonSearch in both GemTable expand rows** - `1201746` (feat)
3. **Task 3: Manual UAT** - UAT approved by user; no code commit (checkpoint task)

**Merge commit:** `5b46772` (chore: merge executor worktree worktree-agent-ab27ce8c4e0ec5963)

## Files Created/Modified

- `src/components/gem-table/ComparisonSearch.tsx` (created, 88 lines) — Row-scoped head-to-head comparison search; `'use client'`; imports `computeHeadToHead` from `@/lib/explain` and `PlayerSearchInput` from `@/components/shared/PlayerSearchInput`; calls `computeHeadToHead(rowPlayer, compPlayer, allPlayers)` (3-arg SC-4 signature); renders rejection-reason-diff as `<ul>`; zero-predicate fallback; × clear button
- `src/components/gem-table/GemTable.tsx` (modified, +7 lines) — Added import line 30; `<ComparisonSearch>` at line 368 (mobile expand row, after FragilityBadge) and line 393 (desktop expand row, after FragilityBadge)

## Decisions Made

- **`<ul>` over prose for rejection reasons** — rejection reason strings from `computeRejection` are full phrases (often containing commas/parens, e.g. "Difficult fixture (FDR hard)"). List rendering is more readable than comma-joining. UI-SPEC's narrative-prose preference assumed short delta tokens (e.g. "+1.2 xPts") — the SC-4 revision changed output semantics.
- **lifecycleLabels intentionally omitted** — GemTable has no `clubFormMap`/`squadData` (D-05). The `lifecycleLabels` parameter is `undefined` for both x and y inner `computeRejection` calls, so neither player can accumulate a `Lifecycle:` reason, so it cannot appear in the diff (RESEARCH §Open Q2 acceptance).
- **No external state lifting** — `ComparisonSearch` is rendered inside the `row.getIsExpanded() && (() => { ... })()` IIFE. When the row collapses, the IIFE returns falsy and the component unmounts, naturally resetting `compPlayer` state. Re-expanding starts fresh.

## Deviations from Plan

None — plan executed exactly as written.

## WHY-01 Traceability

All three plans together close **WHY-01** (rejection explainer with head-to-head comparison) + **SC-4** (composition mandate — no parallel predicate logic):

| Plan | Deliverable | SC-4 role |
|------|-------------|-----------|
| 94-01 | Extended `computeRejection` to 8 predicates; added composition-based `computeHeadToHead(x, y, allPlayers)` returning Y's rejection reasons X does not share | Defines SC-4 composition engine |
| 94-02 | `PlayerSearchInput` shared autocomplete + `RejectionSearchCallout` in TransferPanel (WHY-01-A entry point) | First UI entry point using engine |
| 94-03 | `ComparisonSearch` in GemTable expand rows — both mobile and desktop (WHY-01-B entry point) | Second UI entry point; closes WHY-01 |

**Output semantics confirmed:** `computeHeadToHead` returns `string[]` — Y's rejection reason labels (from `computeRejection`) that X does not share. GemTable renders these as a `<ul>` under "X beats Y because Y was penalised for:". No parallel predicate logic anywhere in the UI (SC-4 satisfied).

## Manual UAT Outcome

**Approved** — all 10 verification steps passed:
1. Dev server ran; Players tab accessible
2. Row expand shows "Compare with…" label and search input below FragilityBadge
3. Autocomplete fires on ≥2 chars, shows up to 6 suggestions
4. Self-exclusion confirmed — row's own player absent from dropdown
5. Comparison selected → "X beats Y because Y was penalised for:" header + `<ul>` of reasons
6. Zero-predicate fallback confirmed — "No predicates where X ranks above Y."
7. × clear button clears comparison output
8. Row collapse + re-expand resets comparison state
9. Mobile layout: Compare with… search visible, dropdown not clipped, output renders
10. No `Lifecycle:` reason appeared in any GemTable h2h output

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- WHY-01 fully closed: both GemTable (WHY-01-B) and TransferPanel (WHY-01-A) entry points operational with SC-4-compliant composition output
- Phase 94 ready for `/gsd-verify-work`
- Future phases touching GemTable expand-row layout should account for ComparisonSearch at lines 368 and 393

---
*Phase: 94-rejection-explainer-enhancements*
*Completed: 2026-05-11*
