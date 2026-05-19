---
phase: 125
plan: "02"
subsystem: news-feed-ui
tags:
  - news
  - transfer-feed
  - filter-pills
  - win-01
dependency_graph:
  requires:
    - src/lib/hooks/useTransferNews.ts
    - src/lib/formatRelativeTime.ts
    - src/lib/types.ts (TransferClass, TransferNewsArticle, TransferNewsFeed)
  provides:
    - SummerWindowTab component (WIN-01 feed tab)
  affects: []
tech_stack:
  added: []
  patterns:
    - Module-level helper for Date.now() to satisfy react-hooks/purity lint rule
    - satisfies ReadonlyArray<...> for typed PILLS constant
    - UseQueryResult cast via as unknown as for vi.mock type compatibility
key_files:
  created:
    - src/components/news/SummerWindowTab.tsx
    - src/components/news/SummerWindowTab.test.tsx
  modified: []
decisions:
  - Date.now() extracted to module-level isFeedStale() helper — mirrors NewsBanner.tsx pattern; satisfies react-hooks/purity lint rule while keeping tests deterministic via vi.useFakeTimers()
  - React import kept for React.JSX.Element return type — avoids JSX namespace error in strict TS config
  - Test mock return uses as unknown as UseQueryResult<TransferNewsFeed> — simplest cast pattern for partial mock objects
metrics:
  duration: "~20 minutes"
  completed: "2026-05-19"
  tasks: 2
  files: 2
---

# Phase 125 Plan 02: SummerWindowTab Component Summary

SummerWindowTab client component with 5-pill classification filter, article cards with safe external links, stale-feed banner (24h threshold), loading skeleton, and error state — consuming useTransferNews() hook, 10 contract tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SummerWindowTab component | 5603b8d | src/components/news/SummerWindowTab.tsx |
| 2 | Contract tests + lint fix | 6c3610f | src/components/news/SummerWindowTab.test.tsx, SummerWindowTab.tsx (lint fix) |

## Component Public API

```ts
export function SummerWindowTab(): React.JSX.Element
// No props. Calls useTransferNews() unconditionally at top.
// Internal state: useState<TransferClass | 'all'>('all') for activeFilter.
```

## Filter and Sort Logic

- 5 pills: All / Confirmed (`confirmed_signing`) / Rumour (`rumour`) / Injury (`injury_return`) / Rotation (`rotation_signal`)
- Default active pill: `'all'` (D-07)
- `general` classification articles appear under All only — no dedicated pill (D-05)
- Sort: `[...feed.articles].sort(...)` descending by `published ?? scraped_at` — spread before sort guards TanStack Query cache integrity (Pitfall 4)

## Stale Banner

- Threshold: `24 * 60 * 60 * 1000` ms (`STALE_THRESHOLD_MS`)
- Check: module-level `isFeedStale(scrapedAt: string): boolean` — extracts `Date.now()` to satisfy `react-hooks/purity` lint rule
- When stale: amber banner with em-dash copy: `Feed last updated {formatRelativeTime(feed.scraped_at)} — may not reflect latest news.`
- Articles still render below banner

## Note for Plan 03

Plan 03 imports `SummerWindowTab` directly into `page.tsx` with no behavior wrapping. The component is fully self-contained — it calls `useTransferNews()` internally and manages its own filter state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] Extracted Date.now() to module-level helper**
- **Found during:** Task 2 lint check
- **Issue:** ESLint `react-hooks/purity` rule flagged `Date.now()` called directly in the component render body as an impure function call
- **Fix:** Extracted to `const isFeedStale = (scrapedAt: string): boolean => Date.now() - new Date(scrapedAt).getTime() > STALE_THRESHOLD_MS` at module level — identical pattern used in `NewsBanner.tsx`
- **Files modified:** src/components/news/SummerWindowTab.tsx
- **Commit:** 6c3610f

**2. [Rule 1 - Test] Fixed test pill label assertion (CSS uppercase vs textContent)**
- **Found during:** First test run
- **Issue:** Test expected `['ALL', 'CONFIRMED', ...]` (CSS-uppercased) but `textContent` returns the raw text `['All', 'Confirmed', ...]`; CSS `text-transform: uppercase` doesn't affect DOM textContent
- **Fix:** Changed test assertion to expect the actual React-rendered text
- **Files modified:** src/components/news/SummerWindowTab.test.tsx
- **Commit:** 6c3610f

## Known Stubs

None — component is fully wired to `useTransferNews()` hook; no hardcoded data or placeholder values.

## Threat Flags

None — all threats from plan's threat register (`T-125-01`, `T-125-02`) are mitigated:
- T-125-01: Every `<a>` has `target="_blank"` and `rel="noopener noreferrer"` (verified by Test 10 and acceptance criteria grep)
- T-125-02: No `dangerouslySetInnerHTML` anywhere; React auto-escapes all string interpolation

## Self-Check: PASSED

- [x] `src/components/news/SummerWindowTab.tsx` exists
- [x] `src/components/news/SummerWindowTab.test.tsx` exists
- [x] Commit 5603b8d exists (Task 1)
- [x] Commit 6c3610f exists (Task 2)
- [x] 10 tests pass, 0 failing
- [x] TypeScript clean (no errors on SummerWindowTab files)
- [x] Lint clean on both files
