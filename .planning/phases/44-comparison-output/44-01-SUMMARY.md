---
phase: 44
plan: 01
subsystem: optimiser-ui
tags: [react, tailwind, fpl, optimiser, ui, comparison-table, tdd]
depends_on:
  requires: [43-03]
  provides: [comparison-table-ui]
  affects: [OptimiserPanel.tsx, OptimiserPanel.test.tsx]
tech_stack:
  added: []
  patterns: [html-table-desktop-mobile-toggle, pairSection-xPts-sort, set-difference-changeCount]
key_files:
  created: []
  modified:
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx
decisions:
  - "pairSection uses xPts-desc sort for XI rows, position-asc for bench — per 44-RESEARCH.md Pitfall 1"
  - "changeCount computed via set-difference (optimised starters not in current XI), not pairSection row count — avoids overcounting when sort reshuffles pairs within same position group"
  - "isPromoted uses currentId (the player who was on bench and is now in optimised starters) rather than optimisedId (which is the demoted player) — plan spec had inversion error"
  - "Test fixtures redesigned to use valid single-GK formations (4-3-3, 5-3-2) for deterministic engine output — makeValidSquad 2-GK-in-XI fixture not usable for no-change/single-change assertions"
metrics:
  duration_seconds: 734
  completed_at: "2026-04-30T18:58:17Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 44 Plan 01: Comparison Table (HeadlineRow + ComparisonTable) Summary

**One-liner:** Replaced Phase 43 green pitch + player circles with a position-grouped comparison table showing current vs optimised lineup with xPts delta pills, a single-line Formation/Changes/xPts gain headline, and a Tailwind-toggled mobile card stack.

---

## What Was Replaced

The Phase 43 pitch rendering block in `OptimiserPanel.tsx` was surgically removed:

- `PlayerCircle` sub-component (34 lines) — deleted entirely
- Green pitch div (`bg-green-950 p-4 min-h-[480px]`, `data-testid="pitch"`)
- FWD / MID / DEF / GK row divs inside pitch
- Bench row within pitch (`data-testid="bench-row"`, `bench-gk-slot`, `bench-divider`, `bench-outfield-*`)
- Formation-in-flex-row (`data-testid="formation-label"` alongside `GwToggle`) — replaced by right-aligned GwToggle-only row

---

## What Was Added

Four new sub-components and helpers local to `OptimiserPanel.tsx`:

| Component/Helper | Purpose |
|---|---|
| `pairSection(currentIds, optimisedIds, ...)` | Pairs current and optimised player slots per position section (xPts-desc sort for XI; position-asc for bench) |
| `HeadlineRow` | Single-line headline: `Formation: X-X-X │ Changes: N player(s) │ +X.X xPts gain` |
| `ComparisonTable` | Desktop `<table>` (wrapped in `hidden sm:block`) with `data-testid="comparison-table"` and 5 position sections |
| `MobileComparisonCards` | Mobile card stack (wrapped in `sm:hidden`) with same green border highlight on changed rows |

Changed starter rows: `border-l-2 border-l-green-500` + `data-testid="comparison-row-changed"` + `data-testid="delta-pill"`.
Changed bench rows: `data-testid="badge-promoted"` (green) or `data-testid="badge-dropped"` (zinc).

---

## What Was Preserved

All non-pitch elements from Phase 43 carried forward unchanged:

- `optimiseLineup()` call and `playerMap` useMemo
- `useSquad(submittedId)` and `usePlayers()` hooks
- Horizon state and `GwToggle` component
- Empty state (no team ID)
- Loading state
- Error state (squad fetch failed)
- No-squad-data state
- BGW critical banner (`data-testid="bgw-banner-critical"`)
- BGW soft banner (`data-testid="bgw-banner-soft"`)
- All data-testids, copy strings, and Tailwind classes on preserved branches

---

## Test Rewrite (TDD RED → GREEN)

**Task 1 (RED):** Rewrote `OptimiserPanel.test.tsx` with 15 total tests. Removed 3 pitch-specific describe blocks (OPT-01, OPT-03, OPT-04). Added 3 new CMP describe blocks. Rewrote OPT-02 to assert comparison-table content. Updated OPT-05 testid from `pitch` to `comparison-table`. All 4 empty/loading/error state tests preserved verbatim.

**Task 2 (GREEN):** Implemented OptimiserPanel.tsx. All 15 tests pass.

**Test coverage added:**
- CMP-01a: comparison-table + all 5 section headers render
- CMP-01b: changed starter rows have `border-l-2 border-l-green-500` and `delta-pill`
- CMP-01c: unchanged rows have no green border and no delta-pill
- CMP-01d: bench changed rows show `badge-promoted` or `badge-dropped`
- CMP-02a: headline-row has Formation/Changes/xPts gain copy
- CMP-02b: bench-only swaps excluded from Changes count (D-07)
- CMP-02c: singular "1 player" when exactly 1 XI swap
- CMP-03a: both `hidden sm:block` desktop and `sm:hidden` mobile wrappers in DOM

---

## Files Modified

| File | Lines Added | Lines Removed | Net |
|---|---|---|---|
| `src/components/optimiser/OptimiserPanel.tsx` | ~290 | ~190 | +100 |
| `src/components/optimiser/OptimiserPanel.test.tsx` | ~290 | ~145 | +145 |

**Total commits:** 2 (RED + GREEN)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `isPromoted` logic inversion in pairSection**
- **Found during:** Task 2 — bench badge test (CMP-01d) failing with 0 Promoted badges
- **Issue:** Plan spec said `isPromoted = optimisedStarterIds.has(optimisedId)`, but `optimisedId` is the new bench occupant (demoted XI player), which can never be in `optimisedStarterIds`. Correct: `isPromoted = optimisedStarterIds.has(currentId)` (the current bench player who gets promoted into the optimised XI).
- **Fix:** Changed `optimisedStarterIds.has(optimisedId)` → `optimisedStarterIds.has(currentId)` in `pairSection`
- **Files modified:** `src/components/optimiser/OptimiserPanel.tsx`

**2. [Rule 1 - Bug] Fixed `changeCount` overcounting due to pairSection sort-cascade**
- **Found during:** Task 2 — CMP-02c "singular player" test showing "Changes: 3 players" for a 1-player swap
- **Issue:** When 1 XI player is swapped, pairSection sorts both sides by xPts desc independently. The new high-xPts player at top of optimised list pairs with the current player at top of current list (even if they're different players). This cascades — all 3 MID rows show as "changed" even though only 1 actual swap occurred.
- **Fix:** Computed `changeCount` using set-difference: `lineup.starters.filter(id => !currentXISet.has(id)).length`. Similarly `xPtsGain` computes actual added xPts minus removed xPts (net real gain). This is semantically correct per D-07.
- **Files modified:** `src/components/optimiser/OptimiserPanel.tsx`

**3. [Rule 1 - Bug] Test fixtures redesigned for deterministic engine output**
- **Found during:** Task 2 — "unchanged rows" and "singular player" tests producing unexpected changes
- **Issue:** `makeValidSquad()` generates a squad with 2 GKs in XI positions (positions 1-2) and 0 FWDs in XI. The engine always changes this lineup (removes 1 GK, adds 1 FWD from bench). Tests relying on "no change" behaviour were broken by design.
- **Fix:** Replaced three test fixtures with explicit elementTypes arrays that produce valid single-GK formations (4-3-3 or 5-3-2) where positions 1-11 match what the engine would pick given equal xPts.
- **Files modified:** `src/components/optimiser/OptimiserPanel.test.tsx`

---

## Known Stubs

None — all data is wired from `useSquad` + `usePlayers` hooks (same as Phase 43). No placeholder text or hardcoded empty values introduced.

---

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Component is a pure UI replacement with no new data flows. See threat_model in 44-01-PLAN.md — all threats accepted (T-44-01 through T-44-06).

---

## Self-Check

Files exist:
- `src/components/optimiser/OptimiserPanel.tsx` — FOUND
- `src/components/optimiser/OptimiserPanel.test.tsx` — FOUND
- `.planning/phases/44-comparison-output/44-01-SUMMARY.md` — FOUND (this file)

Commits exist:
- `168ad21` (test RED) — FOUND
- `d8afd70` (feat GREEN) — FOUND

## Self-Check: PASSED
