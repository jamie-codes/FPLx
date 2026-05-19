---
phase: 125-summer-window-tracker
verified: 2026-05-19T12:30:00Z
status: human_needed
score: 2/2
overrides_applied: 0
human_verification:
  - test: "Navigate to the app, click the Analyse tab, then click the Summer Window sub-tab"
    expected: "Feed renders with articles sorted newest-first, five filter pills (All/Confirmed/Rumour/Injury/Rotation) visible; clicking each pill filters the list; empty state card appears when no articles match; stale banner appears if feed is older than 24h"
    why_human: "End-to-end rendering of the live feed and pill interactivity requires a running browser session"
  - test: "Expand a GemTable row for a player who has a matched confirmed_signing article; then expand a row for an unmatched player"
    expected: "Matched player shows green 'Confirmed Signing' pill at the bottom of the expanded row with native tooltip; unmatched player shows no badge"
    why_human: "Requires a live confirmed_signing article matched to a real player element_id in the current feed"
  - test: "Open the Transfers tab, find an OpportunityCostTable row whose buy candidate has a confirmed_signing article match"
    expected: "Green 'Confirmed Signing' badge appears in the buy cluster between MinsRiskBadge and NewsBanner; sell-side row shows no badge"
    why_human: "Requires a live confirmed_signing article matched to a buy candidate element_id"
---

# Phase 125: Summer Window Tracker — Verification Report

**Phase Goal:** Summer Window Tracker — Transfer news feed with filter pills and confirmed-signing badges on relevant player rows
**Verified:** 2026-05-19T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Summer Window tab in the Analyse section shows articles sorted by date with filter pills for confirmed/rumour/injury/rotation and an empty state when no articles match | VERIFIED | `SummerWindowTab` in `src/components/news/SummerWindowTab.tsx` implements all five pills (All/Confirmed/Rumour/Injury/Rotation), descending date sort with `published ?? scraped_at` fallback, and empty-state card. Wired into page.tsx at `activeSubTab === 'window'` with import from `@/components/news/SummerWindowTab`. 10 contract tests exercise all filter and sort behaviours. |
| 2 | A confirmed signing badge appears on the relevant player row in GemTable and TransferPanel when a confirmed_signing article is matched to that player's FPL element ID; absent for unmatched players | VERIFIED | `ConfirmedSigningBadge` in `src/components/shared/ConfirmedSigningBadge.tsx`. GemTable calls `useTransferNews()` unconditionally at component top, builds `confirmedSigningMap` (Map<number,string>) via `useMemo`, renders badge in BOTH mobile and desktop expanded rows behind `confirmedSigningMap.has(row.original.id)` guard. TransferPanel passes `confirmedSigningMap` prop to `OpportunityCostTable`, which guards with `confirmedSigningMap?.has(t.buy.id)`. Badge is absent when map has no entry for the player id. |

**Score:** 2/2 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/shared/ConfirmedSigningBadge.tsx` | Green pill component exporting `ConfirmedSigningBadge` | VERIFIED | Exports named function; className contains `inline-block text-xs font-normal text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900 rounded px-2 py-1`; renders "Confirmed Signing" text; routes `tooltipText` to `title` attribute |
| `src/components/shared/ConfirmedSigningBadge.test.tsx` | Vitest contract tests | VERIFIED | 7 `it()` blocks covering label, classes, data-testid, title passthrough, optional title, single span. Note: plan called for 6 tests; 7 were delivered. |
| `src/components/news/SummerWindowTab.tsx` | Feed tab with filter pills, stale banner, article cards | VERIFIED | `'use client'` directive; `useTransferNews()` called unconditionally; five pills via PILLS constant; STALE_THRESHOLD_MS; isFeedStale helper; source badges [SKY]/[BBC]; `target="_blank" rel="noopener noreferrer"` on every link; no `dangerouslySetInnerHTML` |
| `src/components/news/SummerWindowTab.test.tsx` | 10 Vitest contract tests | VERIFIED | Tests 1–10 as specified; uses `vi.useFakeTimers()` + `vi.setSystemTime`; mocks `useTransferNews`; does NOT mock `formatRelativeTime` |
| `src/app/page.tsx` | SubTab union + SECTIONS entry + import + render condition | VERIFIED | SubTab union contains `'window'`; SECTIONS entry `{ id: 'window', label: 'Summer Window', mobileLabel: 'Window' }` positioned after `'season'` and before `'price-changes'`; import from `@/components/news/SummerWindowTab`; render condition `{activeSection !== 'squad' && activeSubTab === 'window' && <SummerWindowTab />}` |
| `src/components/gem-table/GemTable.tsx` | ConfirmedSigningBadge injected in both expanded rows | VERIFIED | Imports `ConfirmedSigningBadge` and `useTransferNews`; single unconditional `useTransferNews()` call; `confirmedSigningMap` built via `useMemo`; badge with `tooltipText` prop present in both mobile (line ~412) and desktop (line ~447) expanded rows |
| `src/components/transfers/OpportunityCostTable.tsx` | ConfirmedSigningBadge in PlayerMoveCell buy cluster | VERIFIED | Imports `ConfirmedSigningBadge`; receives `confirmedSigningMap?: Map<number,string>` prop; badge guarded by `confirmedSigningMap?.has(t.buy.id)` — buy-side only; no `t.sell.id` match |
| `src/components/transfers/TransferPanel.tsx` | Builds and passes confirmedSigningMap to OpportunityCostTable | VERIFIED | Calls `useTransferNews()`, builds `confirmedSigningMap` via `useMemo`, passes as prop to `OpportunityCostTable` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/page.tsx` | `src/components/news/SummerWindowTab.tsx` | import + render condition for `activeSubTab === 'window'` | WIRED | Import at line 28; render at line 287 |
| `src/components/gem-table/GemTable.tsx` | `src/lib/hooks/useTransferNews.ts` | unconditional hook call at component top | WIRED | Line 155: `const { data: transferNewsFeed } = useTransferNews()` |
| `src/components/gem-table/GemTable.tsx` | `src/components/shared/ConfirmedSigningBadge.tsx` | import + conditional render in both expanded rows | WIRED | Import at line 32; JSX at lines 412 and 447 |
| `src/components/transfers/TransferPanel.tsx` | `src/lib/hooks/useTransferNews.ts` | hook call + confirmedSigningMap memo | WIRED | Line 59: `const { data: transferNewsFeed } = useTransferNews()` |
| `src/components/transfers/OpportunityCostTable.tsx` | `src/components/shared/ConfirmedSigningBadge.tsx` | import + conditional render in PlayerMoveCell buy cluster | WIRED | Import at line 19; JSX at line 154 |
| `src/components/news/SummerWindowTab.tsx` | `src/lib/hooks/useTransferNews.ts` | unconditional hook call at top | WIRED | Line 50: `const { data, isLoading, isError } = useTransferNews()` |
| `src/components/news/SummerWindowTab.tsx` | `src/lib/formatRelativeTime.ts` | import + call for date display and stale banner | WIRED | Import at line 9; called at lines 107 and 163 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SummerWindowTab.tsx` | `data` (TransferNewsFeed) | `useTransferNews()` TanStack Query hook → `/api/transfer-news` (Phase 123) | Yes — hook fetches from API route backed by Vercel Blob pipeline output | FLOWING |
| `GemTable.tsx` `confirmedSigningMap` | `transferNewsFeed?.articles` filtered to `confirmed_signing` | `useTransferNews()` same hook | Yes — same TanStack cache; optional-chained so undefined feed degrades to empty map | FLOWING |
| `OpportunityCostTable.tsx` badge | `confirmedSigningMap?.get(t.buy.id)` | prop passed from `TransferPanel.tsx` which calls `useTransferNews()` | Yes — TransferPanel builds map identically to GemTable pattern | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for browser-side UI components — no runnable entry points testable without a live server and real feed data.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WIN-01 | 125-02, 125-03 | Summer Window feed displays transfer_news.json articles sorted by date, filterable by classification | SATISFIED | SummerWindowTab implements all filter/sort/empty-state behaviours; registered as 'window' sub-tab in Analyse section |
| WIN-02 | 125-01, 125-03 | Confirmed signing badge on relevant player rows in GemTable and TransferPanel when confirmed_signing article matched to element ID | SATISFIED | ConfirmedSigningBadge wired into GemTable both expanded rows and OpportunityCostTable buy cluster via TransferPanel prop |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `ConfirmedSigningBadge.tsx` | `tooltipText?: string` — prop is optional; Plan 01 spec required it to be required (`tooltipText: string`). When badge is rendered without a tooltip, `title` is `undefined` (attribute absent), which is acceptable at call sites since both GemTable and OCS gate the render on the map entry existing. | Info | No functional impact — callers only render badge when map entry exists, guaranteeing a tooltip string is present at call sites. |
| `GemTable.tsx` | Badge placed AFTER `PlayerInsightSection` (last in expanded row), not after `FragilityBadge` and before `ComparisonSearch` as Plan 03 specified. | Warning | Visual placement differs from plan spec. Badge renders at end of expanded section rather than between FragilityBadge and ComparisonSearch. Functionally present but positionally non-compliant with D-10 spec wording "after the FragilityBadge and before the ComparisonSearch". |
| `GemTable.tsx`, `TransferPanel.tsx` | Inline `article.source === 'skysports' ? 'Sky Sports' : 'BBC'` — uses `'BBC'` not `'BBC Sport'`. Plan 03 required `SOURCE_NAME = { skysports: 'Sky Sports', bbc: 'BBC Sport' }`. No named `SOURCE_NAME` constant. | Warning | Tooltip text for BBC articles reads `"<title> · BBC"` instead of `"<title> · BBC Sport"`. The ROADMAP SC does not specify the exact source name format, so this does not block the roadmap contract. |

---

## Human Verification Required

### 1. Summer Window Feed Rendering

**Test:** Navigate to the app, click the Analyse tab, then click the Summer Window sub-tab.
**Expected:** Articles render sorted newest-first; five filter pills visible; clicking each pill filters correctly; empty state card appears for filters with no matches; stale banner (amber, with em-dash copy) appears when feed is older than 24h.
**Why human:** End-to-end rendering of the live `/api/transfer-news` feed and pill interaction requires a running browser session with real feed data.

### 2. GemTable Confirmed Signing Badge

**Test:** Expand a GemTable row for a player whose element_id matches a confirmed_signing article in the current feed. Also expand a row for a player with no match.
**Expected:** Matched player's expanded row shows a green "Confirmed Signing" pill (in BOTH mobile and desktop views) with native tooltip `"<headline> · <source>"`. Unmatched player row shows no badge.
**Why human:** Requires a live confirmed_signing article matched to a real FPL element_id; cannot be verified without real pipeline feed data.

### 3. OpportunityCostTable Buy-Cluster Badge

**Test:** Open the Transfers tab, find an OpportunityCostTable row where the buy candidate has a confirmed_signing article match. Also check a sell-side player with a match.
**Expected:** Green badge appears in the buy cluster between MinsRiskBadge and NewsBanner for the matched buy candidate. Sell-side row shows no badge regardless of any match.
**Why human:** Requires a live confirmed_signing article matched to a buy candidate element_id in the current feed.

---

## Gaps Summary

No automated gaps — both ROADMAP success criteria are verified. Two warnings are noted:

1. **GemTable badge placement** — Badge renders at the end of the expanded row (after PlayerInsightSection) rather than after FragilityBadge and before ComparisonSearch as Plan 03 specified. This is a visual placement deviation from the plan spec but does not violate either ROADMAP success criterion (both only require badge presence on the relevant row).

2. **Tooltip source name: `'BBC'` vs `'BBC Sport'`** — Both GemTable and TransferPanel use `'BBC'` in the tooltip format string rather than `'BBC Sport'`. This is a minor copy deviation from the Plan 03 spec. The ROADMAP does not specify the exact source name string, so this does not block the roadmap contract.

These warnings are noted for the developer's awareness but are not blockers.

---

_Verified: 2026-05-19T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
