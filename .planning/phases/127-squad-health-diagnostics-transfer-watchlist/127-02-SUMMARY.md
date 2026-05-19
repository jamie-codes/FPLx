---
phase: 127
plan: 02
subsystem: hooks + gem-table
tags:
  - hooks
  - localstorage
  - gem-table
  - watchlist
dependency_graph:
  requires:
    - "127-01: PreSeasonSquadResponse types + envelope API"
  provides:
    - "src/lib/hooks/useWatchlist.ts: localStorage-backed watchlist hook"
    - "src/components/gem-table/GemTable.tsx: star button action row in both expand rows"
  affects:
    - "Plan 04 (wires useWatchlist into page.tsx, passes props to GemTable)"
tech_stack:
  added: []
  patterns:
    - "useState lazy initialiser for localStorage reads"
    - "useCallback functional setter form for localStorage writes"
    - "Optional prop pattern for backward-compatible GemTable extension"
key_files:
  created:
    - src/lib/hooks/useWatchlist.ts
    - src/lib/hooks/useWatchlist.test.ts
  modified:
    - src/components/gem-table/GemTable.tsx
    - src/components/gem-table/GemTable.test.tsx
decisions:
  - "Storage shape strictly number[] per D-09 — no timestamps, no metadata wrapper"
  - "toggleWatchlist uses functional setState to avoid stale closure on persist"
  - "Star button optional-chaining (toggleWatchlist?.) allows GemTable to ship before page.tsx wiring"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 127 Plan 02: useWatchlist Hook + GemTable Star Button Summary

Plan 02 delivers the two Wave 2 watchlist primitives: the `useWatchlist` hook backed by localStorage and the star-button action row inserted into both GemTable expand rows. Both are pure data/UI primitives consumed via props from page.tsx (Plan 04).

## What Was Built

**Task 1 — useWatchlist hook**

Created `src/lib/hooks/useWatchlist.ts`:
- `STORAGE_KEY = 'fplx_watchlist'` constant
- `loadWatchlist()` private helper: try/catch around localStorage.getItem, JSON.parse, Array.isArray + typeof number filter — returns [] on any failure
- `useWatchlist()` exported function using `useState<number[]>(() => loadWatchlist())` lazy initialiser
- `toggleWatchlist(id)` wrapped in `useCallback` with functional setter — includes/excludes id, then writes JSON.stringify(next) to localStorage inside try/catch
- Returns `{ watchlistIds, toggleWatchlist }`

All 8 contract tests pass (init empty, init from storage, malformed JSON, non-array JSON, filter non-numbers, toggle add, toggle remove, persist).

**Task 2 — GemTable star button**

Extended `GemTableProps` with `watchlistIds?: number[]` and `toggleWatchlist?: (id: number) => void`. Destructure defaults `watchlistIds = []`.

Inserted identical `<div className="flex items-center gap-2 mb-2">` action row as the FIRST child of both:
- Mobile expand row (`bg-blue-50 dark:bg-blue-950 sm:hidden`)
- Desktop expand row (`bg-blue-50 dark:bg-blue-950 hidden sm:table-row`)

Button text: `⭐ Pin to watchlist` (unpinned, zinc class) / `⭐ Pinned` (pinned, `text-amber-500`). Click calls `toggleWatchlist?.(row.original.id)` with optional chaining.

3 new star button tests added to GemTable.test.tsx — all pass alongside the 3 pre-existing PlayerInsightSection tests (6/6 total).

## Verification

- `npx vitest run src/lib/hooks/useWatchlist.test.ts` — 8/8 pass
- `npx vitest run src/components/gem-table/GemTable.test.tsx` — 6/6 pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Star button renders correctly; clicks are no-ops until Plan 04 passes the props from page.tsx.

## Threat Flags

None. All T-127-06 through T-127-09 mitigations are per plan (localStorage filter in loadWatchlist, optional-chaining no-ops on undefined toggleWatchlist).

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/hooks/useWatchlist.ts
- FOUND: src/lib/hooks/useWatchlist.test.ts
- FOUND: src/components/gem-table/GemTable.tsx (modified)
- FOUND: src/components/gem-table/GemTable.test.tsx (modified)

Commit exists: af213c8
