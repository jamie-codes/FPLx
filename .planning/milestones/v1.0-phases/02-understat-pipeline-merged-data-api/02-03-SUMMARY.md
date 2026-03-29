---
phase: 02-understat-pipeline-merged-data-api
plan: "03"
subsystem: frontend
tags: [tanstack-query, react, hooks, providers, client-state]
dependency_graph:
  requires: [src/lib/types.ts, /api/players]
  provides: [src/lib/hooks/usePlayers.ts, src/app/providers.tsx]
  affects: [src/app/layout.tsx]
tech_stack:
  added: ["@tanstack/react-query@5.95.2"]
  patterns: [QueryClientProvider singleton via useState, staleTime 6h, gcTime 12h]
key_files:
  created:
    - src/lib/hooks/usePlayers.ts
    - src/app/providers.tsx
  modified:
    - src/app/layout.tsx
    - package.json
    - package-lock.json
decisions:
  - "D-09: usePlayers uses queryKey ['players'] and staleTime 6h — single cache key for all consumers"
  - "QueryClient created inside useState so each session gets a fresh instance (SSR-safe pattern)"
  - "gcTime set to 12h so cached player data survives tab refocus within a session"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-28"
  tasks_completed: 1
  files_changed: 5
---

# Phase 2 Plan 03: usePlayers Hook and QueryClientProvider Summary

TanStack Query v5 hook `usePlayers()` fetching `/api/players` with `queryKey: ['players']` and `staleTime: 6h` per D-09, plus `QueryClientProvider` wired into the Next.js 16 root layout.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create usePlayers hook and QueryClientProvider | 97bfa62 | src/lib/hooks/usePlayers.ts, src/app/providers.tsx, src/app/layout.tsx, package.json |

## What Was Built

### src/lib/hooks/usePlayers.ts

`usePlayers()` hook using TanStack Query v5 `useQuery`:
- `queryKey: ['players']` — shared cache key for all downstream consumers
- `queryFn: fetchPlayers` — async fetch from `/api/players`, throws on non-OK response
- `staleTime: 1000 * 60 * 60 * 6` — 6 hours per D-09
- Returns `useQuery<MergedPlayer[]>` fully typed result

### src/app/providers.tsx

Client component (`'use client'`) that:
- Creates `QueryClient` inside `useState` initialiser (SSR-safe, avoids shared state across requests)
- Default `staleTime: 6h` and `gcTime: 12h` for all queries
- Wraps children in `QueryClientProvider`

### src/app/layout.tsx (updated)

Root layout updated to import and apply `Providers` wrapper around body children. All existing fonts, CSS imports, and class names preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @tanstack/react-query not installed**
- **Found during:** Task 1 setup
- **Issue:** `package.json` had no TanStack Query dependency — build would have failed with import errors
- **Fix:** Ran `npm install @tanstack/react-query` which installed v5.95.2
- **Files modified:** package.json, package-lock.json
- **Commit:** 97bfa62 (included in task commit)

## Known Stubs

None — all wiring is complete. `usePlayers()` will return data once `/api/players` is called at runtime. The hook is fully implemented; downstream UI phases (3–6) can consume it immediately.

## Self-Check: PASSED

All files exist on disk and task commit confirmed in git history:
- src/lib/hooks/usePlayers.ts — FOUND
- src/app/providers.tsx — FOUND
- src/app/layout.tsx — FOUND (modified)
- Commit 97bfa62 — FOUND
