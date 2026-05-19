---
phase: 125-summer-window-tracker
reviewed: 2026-05-19T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/page.tsx
  - src/app/page.test.tsx
  - src/components/gem-table/GemTable.tsx
  - src/components/news/SummerWindowTab.tsx
  - src/components/news/SummerWindowTab.test.tsx
  - src/components/shared/ConfirmedSigningBadge.tsx
  - src/components/shared/ConfirmedSigningBadge.test.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/TransferPanel.tsx
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 125: Code Review Report

**Reviewed:** 2026-05-19T12:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 125 adds a Summer Window tab (transfer news feed with filter pills), a `ConfirmedSigningBadge` component surfaced in expanded GemTable rows and the OpportunityCostTable buy-cell cluster, and wires `useTransferNews` into both `GemTable` and `TransferPanel`.

The core tab logic, article sorting, stale-banner, and badge rendering are sound. Three issues require attention before shipping: one ARIA spec violation that produces an inaccessible filter widget, one missing mock that leaves `page.test.tsx` fragile when any future test navigates to the Summer Window sub-tab, and one `ConfirmedSigningBadge` test assertion that will fail in jsdom as written. A duplicated `confirmedSigningMap` computation block is flagged as a warning for maintainability.

---

## Critical Issues

### CR-01: `role="tab"` without a `role="tablist"` owner — ARIA spec violation

**File:** `src/components/news/SummerWindowTab.tsx:112-135`

**Issue:** The filter pill buttons carry `role="tab"` and `aria-selected`, but their container is `role="group"`. The ARIA specification requires every `tab` element to be owned by a `tablist` element. Screen readers that enforce the owned-by relationship (NVDA + Firefox, VoiceOver + Safari) will either ignore the `tab` role entirely or report an ownership error, making the filter pills invisible to assistive technology. The correct container role for a strip of `tab`-role buttons is `role="tablist"`.

**Fix:**
```tsx
// Change role="group" → role="tablist" on the filter pill container
<div
  role="tablist"
  aria-label="Filter transfer news by type"
  className="flex flex-wrap gap-2"
>
```

---

## Warnings

### WR-01: `page.test.tsx` missing mock for `SummerWindowTab` — latent test-isolation failure

**File:** `src/app/page.test.tsx:6-68`

**Issue:** Every other tab component imported by `page.tsx` is mocked in `page.test.tsx`, but `SummerWindowTab` (introduced in this phase) has no mock entry. The component calls `useTransferNews`, which calls `fetch('/api/transfer-news')` — a real network call. Any future test that navigates to `activeSubTab === 'window'` will mount the real component, hit an unhandled `fetch` in jsdom, and either error or produce misleading assertions. The omission also breaks the established pattern of the test file.

**Fix:** Add a mock alongside the other tab mocks:
```ts
vi.mock('@/components/news/SummerWindowTab', () => ({
  SummerWindowTab: () => <div data-testid="summer-window-tab" />,
}))
```

### WR-02: `ConfirmedSigningBadge` test — `title` absent assertion will fail in jsdom

**File:** `src/components/shared/ConfirmedSigningBadge.test.tsx:51`

**Issue:** The test asserts `span?.getAttribute('title')` is `null` when `tooltipText` is not provided. React sets `title={undefined}` on the underlying DOM element. In jsdom (React 18 + jsdom 20+), `title={undefined}` results in the attribute being **present as an empty string** (`""`) rather than absent, because the HTML `title` attribute has a default empty-string reflection. `getAttribute('title')` therefore returns `""` not `null`, causing the assertion to fail.

**Fix:** Adjust the assertion to match what jsdom actually produces, or use `toBeNull` only after confirming the attribute is fully absent:
```ts
// Option A — assert empty string (matches jsdom behaviour with title={undefined})
expect(span?.getAttribute('title')).toBeFalsy()

// Option B — assert attribute is not set to a non-empty visible value
const title = span?.getAttribute('title')
expect(title === null || title === '').toBe(true)
```

### WR-03: Duplicated `confirmedSigningMap` computation in `GemTable` and `TransferPanel`

**File:** `src/components/gem-table/GemTable.tsx:157-175` and `src/components/transfers/TransferPanel.tsx:60-77`

**Issue:** The identical 15-line `useMemo` block that filters `confirmed_signing` articles, sorts them descending by date, and builds the `element_id → tooltip-text` map appears verbatim in both components. Any future change to the source-label format (e.g. adding a third source, changing `'BBC'` capitalisation) must be applied in both places; missing one produces silent divergence between the GemTable badge and the TransferPanel badge.

**Fix:** Extract to a shared utility, e.g. `src/lib/buildConfirmedSigningMap.ts`:
```ts
import type { TransferNewsArticle } from './types'

export function buildConfirmedSigningMap(
  articles: TransferNewsArticle[]
): Map<number, string> {
  const map = new Map<number, string>()
  const sorted = [...articles]
    .filter(a => a.classification === 'confirmed_signing' && a.element_id !== null)
    .sort((a, b) =>
      new Date(b.published ?? b.scraped_at).getTime() -
      new Date(a.published ?? a.scraped_at).getTime()
    )
  for (const article of sorted) {
    if (article.element_id !== null && !map.has(article.element_id)) {
      const sourceLabel = article.source === 'skysports' ? 'Sky Sports' : 'BBC'
      map.set(article.element_id, `${article.title} · ${sourceLabel}`)
    }
  }
  return map
}
```
Then in each component:
```ts
const confirmedSigningMap = useMemo(
  () => buildConfirmedSigningMap(transferNewsFeed?.articles ?? []),
  [transferNewsFeed]
)
```

---

## Info

### IN-01: Article `key` uses `url + index` — index defeats reconciliation benefit

**File:** `src/components/news/SummerWindowTab.tsx:144`

**Issue:** The article list key is `${article.url}-${idx}`. If two articles share the same URL (possible when a scraper ingests duplicate entries before deduplication), the URL component is not unique and the index becomes the real differentiator — equivalent to keying by index alone. React will still render correctly, but reconciliation will be suboptimal and a console key-collision warning may appear for duplicates.

**Fix:** Use a more stable composite key:
```tsx
key={`${article.source}-${article.url}-${article.scraped_at}`}
```

---

_Reviewed: 2026-05-19T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
