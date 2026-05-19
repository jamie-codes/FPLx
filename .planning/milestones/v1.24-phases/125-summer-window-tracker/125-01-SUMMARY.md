---
phase: 125
plan: "01"
subsystem: frontend
tags: [summer-window, transfer-news, badge, subtab, analyse]
dependency_graph:
  requires:
    - Phase 123 useTransferNews hook (src/lib/hooks/useTransferNews.ts)
    - Phase 123 TransferNewsArticle/TransferNewsFeed types (src/lib/types.ts)
  provides:
    - SummerWindowTab component (summer window feed sub-tab)
    - ConfirmedSigningBadge shared component
    - 'window' SubTab in Analyse section
    - confirmedSigningMap prop on OpportunityCostTable
  affects:
    - src/app/page.tsx (SubTab union, SECTIONS, render block)
    - src/components/gem-table/GemTable.tsx (confirmed signing badge in expanded rows)
    - src/components/transfers/OpportunityCostTable.tsx (optional confirmedSigningMap prop)
    - src/components/transfers/TransferPanel.tsx (useTransferNews hook, confirmedSigningMap memo)
tech_stack:
  added: []
  patterns:
    - Filter pill radio-style state with useState<FilterPill>
    - confirmedSigningMap: Map<number, string> keyed by element_id for badge lookup
    - Optional prop pattern on OpportunityCostTable to preserve pure-presentation contract
key_files:
  created:
    - src/components/summer-window/SummerWindowTab.tsx
    - src/components/summer-window/SummerWindowTab.test.tsx
    - src/components/shared/ConfirmedSigningBadge.tsx
    - src/components/shared/ConfirmedSigningBadge.test.tsx
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx
    - src/components/gem-table/GemTable.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
decisions:
  - confirmedSigningMap as optional prop on OpportunityCostTable (not hook inside) — preserves pure-presentation contract; hook called in TransferPanel parent instead
  - confirmedSigningMap built in GemTable directly via useTransferNews — GemTable already calls multiple hooks; consistent pattern
  - vi.useFakeTimers() + vi.setSystemTime() in SummerWindowTab tests — stale threshold of 24h requires deterministic Date.now()
metrics:
  duration_minutes: 68
  completed_date: "2026-05-19"
  tasks_completed: 1
  files_changed: 9
  tests_added: 22
  tests_total: 1463
---

# Phase 125 Plan 01: Summer Window Tracker Summary

Summer Window Tracker shipped: `SummerWindowTab` with 5-pill filter (All/Confirmed/Rumour/Injury/Rotation), stale banner, article cards with external links, `ConfirmedSigningBadge` wired into GemTable expanded rows and OpportunityCostTable buy cluster.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | ConfirmedSigningBadge + SummerWindowTab + page.tsx wiring + GemTable + OCS + TransferPanel | c1c08b9 |

## What Was Built

### WIN-01 — Summer Window Feed Sub-Tab

`SummerWindowTab` (`src/components/summer-window/SummerWindowTab.tsx`):
- Filter pills: All | Confirmed | Rumour | Injury | Rotation — single-select radio style, default "All"
- `general` classification articles visible under "All" only (no dedicated pill)
- Stale feed banner (yellow) when `feed.scraped_at` is older than 24 hours
- Article cards: title as external link (`target="_blank"`), source badge `[SKY]`/`[BBC]`, relative date
- Empty state when no articles match the active filter
- Loading skeleton, error state

Sub-tab registered in `page.tsx`:
- `'window'` added to `SubTab` union type
- Entry `{ id: 'window', label: 'Summer Window', mobileLabel: 'Window' }` inserted after `'season'` in Analyse section
- Render block: `{activeSection !== 'squad' && activeSubTab === 'window' && <SummerWindowTab />}`

### WIN-02 — Confirmed Signing Badge

`ConfirmedSigningBadge` (`src/components/shared/ConfirmedSigningBadge.tsx`):
- Green pill: `bg-green-100 dark:bg-green-900`, label "Confirmed Signing"
- `title` prop for native tooltip (format: `"<headline> · <source>"`)

**GemTable integration:** `useTransferNews()` called unconditionally; `confirmedSigningMap` memo (Map<number, string>) built from `confirmed_signing` articles sorted by recency. Badge renders after `PlayerInsightSection` in both mobile and desktop expanded rows.

**OpportunityCostTable integration:** Optional `confirmedSigningMap?: Map<number, string>` prop added. Badge renders in `PlayerMoveCell` buy cluster after `MinsRiskBadge`. `TransferPanel` builds and passes the map (via its own `useTransferNews()` hook call).

## Deviations from Plan

None — plan executed exactly as written in CONTEXT.md decisions.

## Auto-fixes Applied

**[Rule 1 - Bug] Optional chaining for confirmedSigningMap in PlayerMoveCell**
- **Found during:** test run
- **Issue:** `confirmedSigningMap.has()` threw `Cannot read properties of undefined` when prop was absent — existing `OpportunityCostTable` tests don't pass the prop
- **Fix:** Changed `confirmedSigningMap.has(t.buy.id)` to `confirmedSigningMap?.has(t.buy.id)`
- **Files modified:** `src/components/transfers/OpportunityCostTable.tsx`
- **Commit:** c1c08b9 (inline with main task commit)

**[Rule 2 - Design] Moved useTransferNews out of OpportunityCostTable**
- **Found during:** test run — `No QueryClient set` error in existing tests
- **Issue:** Adding a TanStack Query hook inside a "pure presentation" component breaks all existing tests that render it without a QueryClientProvider
- **Fix:** Added optional `confirmedSigningMap` prop to OpportunityCostTable; hook called in `TransferPanel` parent instead; kept pure-presentation contract intact
- **Files modified:** `src/components/transfers/OpportunityCostTable.tsx`, `src/components/transfers/TransferPanel.tsx`
- **Commit:** c1c08b9 (inline with main task commit)

**[Rule 2 - Test update] Updated page.test.tsx Analyse sub-tab order assertion**
- **Found during:** test run
- **Issue:** Existing test asserted exact Analyse sub-tab list; 'Summer Window' insertion broke it
- **Fix:** Added `'Summer Window'` to the expected array after `'Season'`
- **Files modified:** `src/app/page.test.tsx`
- **Commit:** c1c08b9 (inline with main task commit)

## Known Stubs

None. All feed data is wired from `useTransferNews()` which reads live pipeline output.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. `SummerWindowTab` consumes the existing `/api/transfer-news` endpoint (Phase 123) read-only.

## Self-Check: PASSED

- [x] `src/components/summer-window/SummerWindowTab.tsx` — FOUND
- [x] `src/components/summer-window/SummerWindowTab.test.tsx` — FOUND
- [x] `src/components/shared/ConfirmedSigningBadge.tsx` — FOUND
- [x] `src/components/shared/ConfirmedSigningBadge.test.tsx` — FOUND
- [x] Commit c1c08b9 — FOUND
- [x] 1463/1463 tests GREEN
