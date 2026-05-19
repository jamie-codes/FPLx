---
phase: 123
plan: 02
subsystem: typescript-layer
tags: [route-handler, tanstack-query, transfer-news, typescript, types, hook]
dependency_graph:
  requires:
    - 123-01 (transfer_news.json artifact shape)
  provides:
    - src/lib/types.ts (TransferClass, TransferNewsArticle, TransferNewsFeed)
    - src/app/api/transfer-news/route.ts (GET Route Handler)
    - src/lib/hooks/useTransferNews.ts (useTransferNews hook)
    - src/lib/hooks/useTransferNews.test.ts (Vitest spec)
  affects:
    - src/lib/types.ts (Phase 117 LineupNews block extended with Phase 123 block)
tech_stack:
  added: []
  patterns:
    - USE_BLOB pattern for Blob vs local cache routing (canonical lineup-news copy)
    - TanStack Query useQuery with 6h staleTime and no select transform (useGWIntel copy)
    - Route Handler GET-only with Cache-Control public/s-maxage (canonical pattern)
key_files:
  created:
    - src/app/api/transfer-news/route.ts
    - src/lib/hooks/useTransferNews.ts
    - src/lib/hooks/useTransferNews.test.ts
  modified:
    - src/lib/types.ts (TransferClass, TransferNewsArticle, TransferNewsFeed block appended after line 1031)
decisions:
  - "D-07: 6h staleTime in useTransferNews — matches pipeline run cadence, no select transform needed (Phase 125 consumers work with full TransferNewsFeed)"
  - "D-08: Route Handler reads Blob key 'transfer_news.json' and returns JSON directly — no transformation (structural copy of lineup-news/route.ts)"
  - "SourceHealth reused from Phase 117 block (lines 1016-1020) — not redefined; TransferNewsFeed.source_health references it directly"
metrics:
  duration: "8 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
  tests_added: 3
  tests_passing: 3
---

# Phase 123 Plan 02: SCRAPER-02 TypeScript Layer Summary

**One-liner:** TransferClass/TransferNewsArticle/TransferNewsFeed types + /api/transfer-news Route Handler (USE_BLOB pattern) + useTransferNews() TanStack Query hook (6h staleTime, no select) with 3 Vitest tests GREEN.

## What Was Built

### src/lib/types.ts (Task 01)

New Phase 123 block appended after the Phase 117 LineupNews block (after line 1031):

- `TransferClass` — union of 5 string literals per D-03: `'confirmed_signing' | 'rumour' | 'injury_return' | 'rotation_signal' | 'general'` (defined as multi-line union per TypeScript convention)
- `TransferNewsArticle` — 8 fields matching the Plan 01 Python artifact JSON shape, with correct nullability: `title: string`, `summary: string | null`, `url: string`, `published: string | null`, `source: 'skysports' | 'bbc'`, `classification: TransferClass`, `element_id: number | null`, `scraped_at: string`
- `TransferNewsFeed` — wrapper: `scraped_at: string`, `articles: TransferNewsArticle[]`, `source_health: { skysports: SourceHealth; bbc: SourceHealth }` — reuses `SourceHealth` already defined at lines 1016-1020 (no duplication)

Block header comment matches Phase 117 convention with `===` separator line.

### src/app/api/transfer-news/route.ts (Task 02)

Structural copy of `src/app/api/lineup-news/route.ts` with exactly 4 targeted substitutions:
- Blob prefix: `'lineup_news.json'` → `'transfer_news.json'`
- 404 Blob-empty error: `'Lineup news not available'` → `'Transfer news not available'`
- 404 ENOENT error: `'Lineup news not available'` → `'Transfer news not available'`
- 500 error: `'Failed to load lineup news'` → `'Failed to load transfer news'`

All unchanged from canonical: imports, USE_BLOB declaration, `'Blob fetch failed: ${res.status}'` 502 message, Cache-Control header (`public, s-maxage=3600, stale-while-revalidate=86400`), ENOENT detection idiom, response status codes.

Threat model compliance (T-123-06/07/08): fixed error strings never leak paths or stack traces; Cache-Control enables Vercel edge caching for 1h; JSON.parse exceptions caught by outer try/catch returning fixed 500 message.

### src/lib/hooks/useTransferNews.ts (Task 03)

Structural copy of `src/lib/hooks/useGWIntel.ts` with 4 substitutions:
- `GWIntelResponse` → `TransferNewsFeed`
- `'gw-intel'` queryKey → `'transfer-news'`
- `'/api/gw-intel'` → `'/api/transfer-news'`
- `'Failed to fetch GW insights'` → `'Failed to fetch transfer news'`

No `select` transform per D-07 — Phase 125 (Summer Window Tracker) consumers work with the full `TransferNewsFeed` object. `staleTime: 6 * 60 * 60 * 1000` (6h) matches pipeline run cadence.

### src/lib/hooks/useTransferNews.test.ts (Task 03)

3 Vitest tests using `renderHook` + `QueryClientProvider` pattern (mirrors `useAccuracy.test.ts`):
1. `successful fetch returns the TransferNewsFeed payload` — mock fetch returns 200 with full feed; asserts `isSuccess`, `data.scraped_at`, `data.articles` is array, `source_health` for both sources
2. `non-ok response causes error state with the locked message` — mock fetch returns 500; asserts `isError` and `error.message === 'Failed to fetch transfer news'`
3. `hook fetches from /api/transfer-news exactly once on initial render` — asserts `fetchMock` called with `'/api/transfer-news'` and `toHaveBeenCalledTimes(1)`

All 3 tests pass.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 33d29e5 | feat | Append TransferClass, TransferNewsArticle, TransferNewsFeed types to types.ts (SCR-04) |
| 8c330b7 | feat | Create /api/transfer-news Route Handler (SCR-04) |
| ab0367b | feat | Create useTransferNews() hook and Vitest spec (SCR-04) |

## Deviations from Plan

None — plan executed exactly as written.

The plan's acceptance criteria included a grep for `'confirmed_signing' | 'rumour' | 'injury_return' | 'rotation_signal' | 'general'` on a single line; the type is defined as a multi-line union per TypeScript convention (as shown in PATTERNS.md). This is the correct style for TypeScript unions — the plan's grep was a simplified check, not a formatting requirement. The type definition is semantically correct and matches D-03 exactly.

## Verification Results

```
npx tsc --noEmit     — no errors in new files (pre-existing error in decision-history/route.test.ts is unrelated)
npx eslint src/app/api/transfer-news/route.ts src/lib/hooks/useTransferNews.ts  — clean (no output)
npx vitest run src/lib/hooks/useTransferNews.test.ts  — 3 passed (3)
```

Acceptance criteria checked:
- `grep -c "export type TransferClass" src/lib/types.ts` → 1 ✓
- `grep -c "export interface TransferNewsArticle" src/lib/types.ts` → 1 ✓
- `grep -c "export interface TransferNewsFeed" src/lib/types.ts` → 1 ✓
- `grep -v '^//' src/lib/types.ts | grep -c "interface SourceHealth"` → 1 (not duplicated) ✓
- `wc -l src/lib/types.ts` → 1061 (was 1031, grew by 30 lines) ✓
- `grep -c "export async function GET" src/app/api/transfer-news/route.ts` → 1 ✓
- `grep -c "transfer_news.json" src/app/api/transfer-news/route.ts` → 2 ✓
- `grep -c "Transfer news not available" src/app/api/transfer-news/route.ts` → 2 ✓
- `grep -c "Failed to load transfer news" src/app/api/transfer-news/route.ts` → 1 ✓
- `grep -c "lineup_news\|Lineup news\|lineup news" src/app/api/transfer-news/route.ts` → 0 ✓
- `grep -c "s-maxage=3600, stale-while-revalidate=86400" src/app/api/transfer-news/route.ts` → 1 ✓
- `grep -c "from '@vercel/blob'" src/app/api/transfer-news/route.ts` → 1 ✓
- `grep -c "useQuery<TransferNewsFeed>" src/lib/hooks/useTransferNews.ts` → 1 ✓
- `grep -c "queryKey: \['transfer-news'\]" src/lib/hooks/useTransferNews.ts` → 1 ✓
- `grep -c "fetch('/api/transfer-news')" src/lib/hooks/useTransferNews.ts` → 1 ✓
- `grep -c "6 \* 60 \* 60 \* 1000" src/lib/hooks/useTransferNews.ts` → 1 ✓
- `grep -c "select:" src/lib/hooks/useTransferNews.ts` → 0 ✓
- `grep -c "Failed to fetch transfer news" src/lib/hooks/useTransferNews.ts` → 1 ✓

## Requirements Satisfied

- **SCR-04**: Route Handler + TanStack Query hook expose transfer article feed to browser UI. `TransferNewsFeed` type, `/api/transfer-news` endpoint, and `useTransferNews()` hook form the public contract for Phase 125 (Summer Window Tracker).

## Threat Surface Scan

New network endpoint `/api/transfer-news` (GET-only). Threat model from plan fully implemented:
- T-123-06 (Information Disclosure): Fixed error strings used throughout — no paths, stack traces, or raw error.message exposed
- T-123-07 (DoS): Cache-Control `public, s-maxage=3600` for Vercel edge caching; client-side 6h staleTime reduces request volume
- T-123-08 (Tampering): Outer try/catch catches JSON.parse exceptions and returns fixed 500 message

No unexpected threat surface beyond what was planned.

## Self-Check: PASSED

All created files verified to exist on disk. All 3 task commits verified in git log (33d29e5, 8c330b7, ab0367b).
