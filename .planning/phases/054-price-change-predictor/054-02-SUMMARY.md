---
phase: 054-price-change-predictor
plan: 02
subsystem: data-layer
tags: [typescript, nextjs, tanstack-query, types, api-route, hook]
dependency_graph:
  requires:
    - pipeline/cache/price_changes.json (Plan 01 cold-start seed)
    - src/app/api/set-pieces/route.ts (clone template for route)
    - src/lib/hooks/useSetPieces.ts (clone template for hook)
  provides:
    - PriceDirection union type
    - PriceChangePrediction interface
    - PriceChanges interface
    - GET /api/price-changes route handler
    - usePriceChanges() TanStack Query hook
  affects:
    - src/lib/types.ts (3 new exports)
    - Plan 03 UI consumer (binds to usePriceChanges().data, .isLoading, .error)
tech_stack:
  added: []
  patterns:
    - Direct clone of set-pieces route/hook with documented substitutions
    - USE_BLOB env toggle for local filesystem vs Vercel Blob routing
    - TanStack Query useQuery with typed generic and 30-min staleTime
key_files:
  created:
    - src/app/api/price-changes/route.ts (33 lines)
    - src/lib/hooks/usePriceChanges.ts (14 lines)
  modified:
    - src/lib/types.ts (543 lines; +22 lines: PriceDirection, PriceChangePrediction, PriceChanges)
decisions:
  - "[054-02] Pre-existing TS errors in tests/lib/captain-picks.test.ts (5 errors) are out of scope — confirmed identical on main branch HEAD, not introduced by this plan"
metrics:
  duration: 10 min
  completed: 2026-05-02
  tasks_completed: 3
  files_changed: 3
---

# Phase 54 Plan 02: Data Layer (Types, Route, Hook) Summary

**One-liner:** TypeScript types matching the pipeline JSON shape, a Next.js GET route handler with 30-min CDN cache and USE_BLOB toggle, and a TanStack Query hook with 30-min staleTime — direct clones of the set-pieces analog with four documented substitutions each.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend types.ts with PriceDirection / PriceChangePrediction / PriceChanges | 6388b89 | src/lib/types.ts |
| 2 | Create /api/price-changes Next.js Route Handler | 1e60087 | src/app/api/price-changes/route.ts |
| 3 | Create usePriceChanges TanStack Query hook | 66bab80 | src/lib/hooks/usePriceChanges.ts |

---

## TypeScript Type-Check Output

Running `npx tsc --noEmit` on the worktree produces the same 5 pre-existing errors in `tests/lib/captain-picks.test.ts` (confirmed identical on main branch HEAD). No new errors introduced by this plan. All three new files compile cleanly.

---

## Substitutions Applied

### Route (src/app/api/price-changes/route.ts) — 5 substitutions vs set-pieces template

| # | Template (set-pieces) | This plan (price-changes) |
|---|----------------------|---------------------------|
| 1 | prefix: 'set_piece_changes.json' | prefix: 'price_changes.json' |
| 2 | 'Set-piece data not available' | 'Price change data not available' |
| 3 | join(..., 'set_piece_changes.json') | join(..., 'price_changes.json') |
| 4 | s-maxage=3600 (1 hour) | s-maxage=1800 (30 minutes per D-03) |
| 5 | 'Failed to load set-piece data' | 'Failed to load price change data' |

### Hook (src/lib/hooks/usePriceChanges.ts) — 7 substitutions vs useSetPieces template

| # | Template (useSetPieces) | This plan (usePriceChanges) |
|---|------------------------|------------------------------|
| 1 | import type { SetPieceChanges } | import type { PriceChanges } |
| 2 | export function useSetPieces() | export function usePriceChanges() |
| 3 | useQuery<SetPieceChanges> | useQuery<PriceChanges> |
| 4 | queryKey: ['set-pieces'] | queryKey: ['price-changes'] |
| 5 | fetch('/api/set-pieces') | fetch('/api/price-changes') |
| 6 | 'Failed to fetch set-piece data' | 'Failed to fetch price change data' |
| 7 | 6 * 60 * 60 * 1000 (6 hours) | 30 * 60 * 1000 (30 minutes per D-03) |

---

## Verification

All acceptance criteria verified:

- `grep -c '^export type PriceDirection'` → 1
- `grep -c '^export interface PriceChangePrediction'` → 1
- `grep -c '^export interface PriceChanges'` → 1
- Ordering: sp(485) < prc(506) < cp(513) — PASSED
- `grep -c 's-maxage=1800'` → 1 (not 0)
- `grep -c 's-maxage=3600'` → 0 (template value replaced)
- `grep -c "prefix: 'price_changes.json'"` → 1
- `grep -c "'price_changes.json'"` → 2 (blob prefix + local path)
- `grep -c "set_piece_changes\|set-pieces"` → 0 in both new files
- `grep -c '^export function usePriceChanges'` → 1
- `grep -c "queryKey: \['price-changes'\]"` → 1
- `grep -c "'use client'"` → 0 in hook file

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. The route and hook wire directly to real pipeline output. The cold-start empty predictions array (`{ "predictions": [] }`) is by design per D-05, documented in Plan 01.

---

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's threat model:
- T-054-05 through T-054-10 all documented and accepted/mitigated in the plan.
- No new network endpoints beyond the explicitly-planned GET /api/price-changes.
- No auth paths, PII exposure, or schema changes at trust boundaries introduced.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/types.ts (PriceDirection, PriceChangePrediction, PriceChanges) | FOUND |
| src/app/api/price-changes/route.ts | FOUND |
| src/lib/hooks/usePriceChanges.ts | FOUND |
| commit 6388b89 (types) | FOUND |
| commit 1e60087 (route) | FOUND |
| commit 66bab80 (hook) | FOUND |
