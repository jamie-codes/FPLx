---
phase: 04-defcon-analysis
plan: "03"
subsystem: defcon-ui
tags: [api-route, tanstack-query, tanstack-table, tab-navigation, ui]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [defcon-ui, defcon-api, defcon-hook]
  affects: [page.tsx, defcon-tables]
tech_stack:
  added: []
  patterns:
    - TanStack Table (two independent useReactTable instances with separate SortingState)
    - TanStack Query (useDefCon hook mirroring usePlayers)
    - Next.js Route Handler for local cache file serving
    - Client component tab navigation via useState
key_files:
  created:
    - src/app/api/defcon/route.ts
    - src/lib/hooks/useDefCon.ts
    - src/components/defcon/columns.ts
    - src/components/defcon/DefConTables.tsx
  modified:
    - src/app/page.tsx
key_decisions:
  - "page.tsx converted to 'use client' for tab state (server component wrapper added no SSR benefit since GemTable and DefConTables are both client components)"
  - "Two independent SortingState instances (defSorting/midFwdSorting) — never shared — so DEF and MID/FWD tables sort independently per UIX-02"
  - "DefCon API route is local-only (no USE_BLOB switch) — defcon_stats.json is always pipeline/cache/, not Blob, since it is Python-generated"
metrics:
  duration_mins: ~60
  tasks_completed: 3
  files_created: 4
  files_modified: 1
  completed_date: "2026-03-28"
requirements_satisfied: [DEF-04, UIX-01, UIX-02]
---

# Phase 4 Plan 3: DefCon API, Hook, Tables UI, and Tab Navigation Summary

**One-liner:** /api/defcon route + useDefCon hook + dual-table DefConTables component (DEF threshold=10, MID/FWD threshold=12) with independent sort state and tab navigation in page.tsx.

## What Was Built

### Task 1: API route + data hook + column definitions (commit: 8e27b25)

- `src/app/api/defcon/route.ts` — GET handler reads `pipeline/cache/defcon_stats.json` and returns raw JSON with `Cache-Control: public, s-maxage=3600` header. Returns 404 JSON error if file not found.
- `src/lib/hooks/useDefCon.ts` — TanStack Query hook with `queryKey: ['defcon']` and `staleTime: 6h`. Mirrors usePlayers pattern exactly.
- `src/components/defcon/columns.ts` — `createColumnHelper<DefConPlayer>()` column definitions: player name, team, hit rate (formatted %), hits/games, avg DC/90, distance to threshold (green/red text), easy vs hard fixture correlation.

### Task 2: DefConTables component and page.tsx tab navigation (commit: 063dba1)

- `src/components/defcon/DefConTables.tsx` — `'use client'` component calling `useDefCon()`, splitting via `splitByPosition()`, creating two independent `useReactTable` instances with separate `defSorting`/`midFwdSorting` state. Loading and error states handled. Section headers show threshold values (10 and 12) and player counts.
- `src/app/page.tsx` — Converted from server to client component. Tab navigation (`'gems' | 'defcon'`) with styled active/inactive tab buttons. Conditionally renders `<GemTable />` or `<DefConTables />`.

### Task 3: Visual verification (human-approved)

Human approved the visual output. Both tables render separately, sorting works independently per table, hit rates display as percentages, tab navigation functions correctly between Gem Ratings and DefCon Analysis.

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Verification

- [x] /api/defcon route serves defcon_stats.json with correct headers
- [x] useDefCon hook provides typed DefConPlayer[] with 6h stale time
- [x] Two separate TanStack Table instances with independent sort state per DEF-04
- [x] Each row shows hit rate %, avg DC/90, distance, and fixture correlation per DEF-02
- [x] Tab navigation lets user switch between Gem Ratings and DefCon per UIX-01
- [x] All columns are sortable per UIX-02
- [x] Human approved visual output

## Known Stubs

None — data is fully wired from pipeline/cache/defcon_stats.json through /api/defcon to the UI.

## Self-Check: PASSED

All files verified present (columns file is `columns.tsx` not `columns.ts` — both are equivalent, TSX extension used because cell renderers use JSX). Both task commits confirmed in git log.

| Item | Status |
|------|--------|
| src/app/api/defcon/route.ts | FOUND |
| src/lib/hooks/useDefCon.ts | FOUND |
| src/components/defcon/columns.tsx | FOUND (tsx extension) |
| src/components/defcon/DefConTables.tsx | FOUND |
| src/app/page.tsx | FOUND |
| commit 8e27b25 | FOUND |
| commit 063dba1 | FOUND |
