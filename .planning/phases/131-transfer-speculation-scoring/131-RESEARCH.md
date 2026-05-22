# Phase 131: Transfer Speculation Scoring - Research

**Researched:** 2026-05-21
**Domain:** React/TypeScript frontend extension + Python pipeline field addition
**Confidence:** HIGH

## Summary

Phase 131 is a well-bounded additive feature: a new `source_tier` field flows from pipeline → JSON artifact → TypeScript type → UI. The context document has already resolved every significant design decision, so research focus is on verifying patterns, flagging edge cases in the test extension, and producing a precise field-by-field implementation guide.

The pipeline change is minimal: add a `SOURCE_TIER` dict and a `_get_source_tier()` helper to `transfer_news.py`, then inject `source_tier` into each article dict before `articles.append()`. No change to `save()`, the payload wrapper, or the env-gate logic.

The frontend change is self-contained within `SummerWindowTab.tsx` and `src/lib/types.ts`. Three features ship together: a tier badge alongside the existing source badge, a stale opacity class applied to old articles, and an extended pill filter row with AND logic. Existing consumers (`ConfirmedSigningBadge`, `GemTable`, `TransferPanel`) are unaffected because `source_tier` is optional on `TransferNewsArticle`.

**Primary recommendation:** Implement in three sequential tasks — (1) pipeline field, (2) TypeScript type + frontend rendering (badge + decay), (3) tier filter pill — with tests written before each implementation step (Nyquist wave pattern).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Source Tier Assignment (pipeline)**
- D-01: `source_tier` computed in `pipeline/transfer_news.py`, written into every article dict before `save()`. Frontend reads directly from article — no client-side derivation.
- D-02: Source → tier mapping: `'skysports'` → `'Reliable'`, `'bbc'` → `'Reliable'`. `'Official'` reserved for future direct club sources. `'Speculative'` reserved for future tabloid sources. All current articles will have `source_tier: 'Reliable'`.
- D-03: `source_tier` always written (never omitted). Old blobs without the field handled gracefully via optional TypeScript type.
- D-04: Tier values exactly: `'Official'` | `'Reliable'` | `'Speculative'` (REQUIREMENTS.md wins over ROADMAP).

**Confidence Decay (frontend)**
- D-05: Binary threshold: full opacity < 21 days; `opacity-40` >= 21 days. No gradual decay.
- D-06: `opacity-40` applied to the entire article card element.
- D-07: Age computed from `published ?? scraped_at` — mirrors existing sort fallback at line 96.

**Tier Badge (frontend)**
- D-08: Tier badge sits alongside existing `[SKY]`/`[BBC]` source badge in top-right flex cluster. Both badges visible simultaneously.
- D-09: Color scheme: Official = teal, Reliable = blue, Speculative = zinc/gray. CSS pattern: `bg-X-100 text-X-800 dark:bg-X-900 dark:text-X-200`.
- D-10: Badge label is full tier word: `'Official'`, `'Reliable'`, `'Speculative'` — no abbreviation.

**Tier Filter (frontend)**
- D-11: Classification filter AND tier filter apply simultaneously (AND logic).
- D-12: Tier pills appended AFTER the 5 classification pills in the same `flex-wrap` container, separated by a visual divider. Row layout: `All | Confirmed | Rumour | Injury | Rotation ‖ All | Official | Reliable | Speculative`.
- D-13: `'All'` tier pill (default) resets to all tiers shown. Selecting a tier filters by that tier; clicking `'All'` resets. Mirrors existing classification `'All'` pill behavior.

### Claude's Discretion
- Exact Tailwind class for the divider between classification and tier pill groups (border-l, gap, or a span with right border)
- Whether to extract the 21-day stale check into a module-level helper (like `isFeedStale`) or inline it in the article map
- `SourceTier` TypeScript type alias: can be a local type or added to `src/lib/types.ts` alongside `TransferClass`
- Whether `activeTierFilter` state is typed as `'all' | SourceTier` (mirrors existing `activeFilter: TransferClass | 'all'` pattern)
- Whether to add a `confidence_score` numeric field (SPEC-02 references it; if not needed for binary decay approach, omit it)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-01 | User can see a source reliability tier badge (Official / Reliable / Speculative) on each Summer Window article card | `TIER_CLS`/`TIER_LABEL` dicts + badge span — mirrors existing `SOURCE_CLS`/`SOURCE_LABEL` pattern in `SummerWindowTab.tsx` lines 37-45 |
| SPEC-02 | Article confidence decays over time using a 21-day off-season half-life so stale rumours surface their age visually | Binary `opacity-40` on article card element when `Date.now() - articleDate > 21 * 24 * 60 * 60 * 1000`; helper modelled on `isFeedStale()` |
| SPEC-03 | User can filter Summer Window articles by source tier (tier pill added to existing 5-pill classification filter row) | `TIER_PILLS` array + `activeTierFilter` state + chained filter after existing classification filter |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source tier assignment | Pipeline (Python) | — | Tier is a property of the scraping source, not derivable client-side; computed once at scrape time and stored in JSON artifact |
| Tier badge rendering | Frontend (Client Component) | — | Pure display transformation of existing article data; no server round-trip needed |
| Confidence decay display | Frontend (Client Component) | — | Age comparison against `Date.now()` is pure client-side; no server state involved |
| Tier filter state | Frontend (Client Component) | — | Extends existing `useState` filter pattern; article list is already fetched client-side |
| Article type definition | Shared (`src/lib/types.ts`) | — | `TransferNewsArticle` is consumed by multiple components; type must be shared |

## Standard Stack

### Core (verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering | Existing app framework [VERIFIED: package.json] |
| TypeScript | ^5 | Type safety | Project uses strict TypeScript throughout [VERIFIED: package.json] |
| Tailwind CSS | 4.2.2 | Utility styling | Used for all badge/pill classes in the codebase [VERIFIED: node_modules] |
| Vitest | 4.1.2 | Unit test runner | Existing test framework for all frontend tests [VERIFIED: node_modules] |
| @testing-library/react | ^16.3.2 | Component test rendering | Existing pattern in SummerWindowTab.test.tsx [VERIFIED: package.json] |
| pytest | (pipeline) | Python unit tests | Existing pattern in pipeline/tests/ [VERIFIED: pipeline/tests/conftest.py] |

### No New Dependencies Required

All capabilities in Phase 131 use existing libraries. No `npm install` or `pip install` step needed.

**Installation:** None required.

## Architecture Patterns

### System Architecture Diagram

```
Pipeline run (transfer_news.py)
  └── _scrape_rss_sky() / _scrape_rss_bbc()
        ├── classify_article() [existing]
        └── _get_source_tier(source) [NEW]  ──→  article dict { source_tier: 'Reliable' }
                                                           │
                                              save('transfer_news.json', payload)
                                                           │
                                              Vercel Blob (transfer_news.json)
                                                           │
                                         GET /api/transfer-news
                                                           │
                                         useTransferNews() hook
                                                           │
                                    SummerWindowTab (React client component)
                                      ├── Filter: classification AND tier (AND logic)
                                      ├── Article card
                                      │     ├── opacity-40 if article >= 21 days old [SPEC-02]
                                      │     ├── [SKY]/[BBC] source badge [existing]
                                      │     └── Reliable/Official/Speculative tier badge [SPEC-01]
                                      └── Pill row: [5 classification pills] | [4 tier pills] [SPEC-03]
```

### Recommended Project Structure

No new files required. Changes are confined to:

```
pipeline/
├── transfer_news.py          # Add SOURCE_TIER dict + _get_source_tier() + field injection
└── tests/
    └── test_transfer_news.py # Extend with source_tier field tests

src/lib/
└── types.ts                  # Add SourceTier type alias + optional source_tier? field on TransferNewsArticle

src/components/news/
├── SummerWindowTab.tsx       # All frontend changes (badge, decay, filter)
└── SummerWindowTab.test.tsx  # Extend with 5+ new tests
```

### Pattern 1: Pipeline Tier Helper (mirrors classify_article)

**What:** A module-level dict + pure helper function that maps source identifier to tier string.
**When to use:** Called in `_scrape_rss_sky` and `_scrape_rss_bbc` before `articles.append()`.

```python
# Source: pipeline/transfer_news.py (existing pattern — see classify_article)
from typing import Literal

# D-02: Only skysports and bbc currently scraped; both map to Reliable.
# Official and Speculative reserved for future sources.
SOURCE_TIER: dict[str, Literal['Official', 'Reliable', 'Speculative']] = {
    'skysports': 'Reliable',
    'bbc':       'Reliable',
}

def _get_source_tier(source: str) -> Literal['Official', 'Reliable', 'Speculative']:
    """Return tier for a given source identifier. Falls back to 'Speculative'."""
    return SOURCE_TIER.get(source, 'Speculative')
```

Injection site in `_scrape_rss_sky` (identical for `_scrape_rss_bbc`):

```python
article = {
    'title': title[:HEADLINE_MAX_LEN],
    'summary': summary[:SUMMARY_MAX_LEN] if summary else None,
    'url': url,
    'published': published,
    'source': 'skysports',
    'classification': classification,
    'element_id': element_id,
    'source_tier': _get_source_tier('skysports'),   # NEW — D-01/D-03
    'scraped_at': scraped_at,
}
```

### Pattern 2: TypeScript Type Extension (additive optional field)

**What:** Extend `TransferNewsArticle` with optional `source_tier` field; add `SourceTier` type alias.
**When to use:** Optional field ensures old cached blobs (pre-Phase 131) still deserialise without error.

```typescript
// Source: src/lib/types.ts (existing TransferNewsArticle at line 1073)
export type SourceTier = 'Official' | 'Reliable' | 'Speculative'

export interface TransferNewsArticle {
  // ...existing fields unchanged...
  source_tier?: SourceTier   // optional — absent on pre-Phase-131 cached blobs (D-03)
}
```

### Pattern 3: Frontend Badge Dicts (mirrors SOURCE_CLS / SOURCE_LABEL)

**What:** Parallel `TIER_CLS` and `TIER_LABEL` dicts following the exact same shape as existing source badge dicts.
**When to use:** Applied per-article in the render loop.

```typescript
// Source: SummerWindowTab.tsx (mirrors SOURCE_CLS/SOURCE_LABEL at lines 37-44)
import type { SourceTier } from '@/lib/types'

const TIER_LABEL: Record<SourceTier, string> = {
  Official:    'Official',
  Reliable:    'Reliable',
  Speculative: 'Speculative',
}

const TIER_CLS: Record<SourceTier, string> = {
  Official:    'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  Reliable:    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Speculative: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}
```

### Pattern 4: Stale Article Helper (mirrors isFeedStale)

**What:** Module-level pure function for 21-day threshold check.
**When to use:** Evaluated per article in the render map; must not call `Date.now()` inline (React hooks purity).

```typescript
// Source: SummerWindowTab.tsx (mirrors isFeedStale at line 18)
const STALE_ARTICLE_THRESHOLD_DAYS = 21
const STALE_ARTICLE_THRESHOLD_MS = STALE_ARTICLE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000

const isArticleStale = (published: string | null, scrapedAt: string): boolean => {
  const ts = new Date(published ?? scrapedAt).getTime()
  return Date.now() - ts > STALE_ARTICLE_THRESHOLD_MS
}
```

### Pattern 5: Tier Filter Pills (mirrors PILLS array)

**What:** `TIER_PILLS` parallel to `PILLS`; `activeTierFilter` state mirrors `activeFilter`.
**When to use:** Second filter dimension, applied after classification filter (AND logic, D-11).

```typescript
// Source: SummerWindowTab.tsx (mirrors PILLS at lines 20-27)
type SourceTierFilter = SourceTier | 'all'

const TIER_PILLS = [
  { value: 'all' as const,           label: 'All'         },
  { value: 'Official' as const,      label: 'Official'    },
  { value: 'Reliable' as const,      label: 'Reliable'    },
  { value: 'Speculative' as const,   label: 'Speculative' },
] satisfies ReadonlyArray<{ value: SourceTierFilter; label: string }>
```

Filter chain (D-11 AND logic):

```typescript
// Classification filter (existing, line 91-93)
const afterClassification =
  activeFilter === 'all'
    ? [...feed.articles]
    : feed.articles.filter(a => a.classification === activeFilter)

// Tier filter (new — chain after classification)
const filtered =
  activeTierFilter === 'all'
    ? afterClassification
    : afterClassification.filter(a => a.source_tier === activeTierFilter)
```

### Pattern 6: Article Card Opacity + Badge Rendering

```typescript
// Inside sortedArticles.map() — applied to the article element
const stale = isArticleStale(article.published, article.scraped_at)

<article
  key={`${article.url}-${idx}`}
  className={`rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3${stale ? ' opacity-40' : ''}`}
>
  <div className="flex items-start gap-2">
    <a ...>{article.title}</a>
    {/* Existing source badge */}
    <span className={`shrink-0 inline-block text-xs font-semibold rounded px-2 py-0.5 ${SOURCE_CLS[article.source]}`}>
      {SOURCE_LABEL[article.source]}
    </span>
    {/* New tier badge (D-08) — only rendered when source_tier is present */}
    {article.source_tier && (
      <span className={`shrink-0 inline-block text-xs font-semibold rounded px-2 py-0.5 ${TIER_CLS[article.source_tier]}`}>
        {TIER_LABEL[article.source_tier]}
      </span>
    )}
  </div>
  ...
</article>
```

### Pattern 7: Pill Row Divider (Claude's Discretion)

**Recommendation:** Use a thin `<span>` element with `border-l border-zinc-300 dark:border-zinc-600 self-stretch` as the divider between classification and tier pill groups. This is consistent with the existing `flex-wrap gap-2` container — no layout change needed, just an additional element between the two pill groups. Alternatives: a `ml-2 mr-2` gap with no visible border (too subtle) or a `|` text character (fragile font-dependent width).

```tsx
{/* Divider between classification and tier pill groups */}
<span
  aria-hidden="true"
  className="self-stretch border-l border-zinc-300 dark:border-zinc-600 mx-1"
/>
```

### Anti-Patterns to Avoid

- **Calling `Date.now()` inline in JSX:** Breaks React hooks purity rule; use a module-level helper (as with `isFeedStale`).
- **Filtering mutates `feed.articles`:** Never mutate the source array (Pitfall 4 from Phase 123). Always spread: `[...feed.articles]`.
- **Using `confidence_score` numeric field:** D-05 uses binary threshold; `confidence_score` adds complexity without benefit for the current binary decay approach. Omit it (Claude's Discretion resolved: omit).
- **Hardcoding tier in frontend:** D-01 requires tier to come from the article's `source_tier` field, not be derived client-side from `article.source`.
- **Applying opacity to the anchor tag only:** D-06 requires `opacity-40` on the entire article card element, not individual children.
- **Forgetting `satisfies` on TIER_PILLS:** The existing `PILLS` array uses `satisfies ReadonlyArray<...>` for type safety — apply the same pattern to `TIER_PILLS`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS opacity transition | Custom JS fade logic | Tailwind `opacity-40` class | Binary threshold; CSS class toggle is sufficient and already used in this codebase for `ChipStrategyPanel` and `WatchlistPlayerCard` |
| Source tier derivation | Client-side `if source === 'skysports'` | Pipeline-written `source_tier` field | D-01 locked; pipeline owns tier, not frontend |
| Date math | Custom date library | `new Date().getTime()` subtraction | Pattern already established by `isFeedStale` and sort fallback |

**Key insight:** Every new pattern in Phase 131 mirrors an existing pattern in `SummerWindowTab.tsx` or nearby components. No new abstractions are needed.

## Common Pitfalls

### Pitfall 1: Test count mismatch after pill row extends to 9 pills
**What goes wrong:** `Test 1` in `SummerWindowTab.test.tsx` asserts `toHaveLength(5)` on `getAllByRole('tab')`. After adding 4 tier pills, this assertion fails.
**Why it happens:** The test was written when there were exactly 5 pills. The pill count is now 9 (5 classification + 1 divider has no role + 4 tier).
**How to avoid:** Update `Test 1` to `toHaveLength(9)` and verify the label order. The divider `<span>` is not a `role="tab"` element, so it won't be selected.
**Warning signs:** Test 1 fails immediately after adding `TIER_PILLS` to the render.

### Pitfall 2: aria-selected state out of sync for two independent pill groups
**What goes wrong:** A single `activeFilter` test checking `pills[0].getAttribute('aria-selected')` may now be checking the wrong pill if the tier pills are also `role="tab"` and the test index is off.
**Why it happens:** `getAllByRole('tab')` returns all 9 tabs in DOM order. Indices 0-4 are classification; indices 5-8 are tier.
**How to avoid:** In test assertions, query pills by label text (`getByRole('tab', { name: 'All' })`) or by explicit index (document clearly in tests which index maps to which pill).
**Warning signs:** `aria-selected` assertion passes on wrong pill.

### Pitfall 3: Tier filter shows no articles when tier pill selected but articles lack source_tier
**What goes wrong:** If a cached `transfer_news.json` blob was written before this phase (no `source_tier` field), filtering by `'Reliable'` returns zero articles because `article.source_tier === 'Reliable'` is `undefined === 'Reliable'` = false.
**Why it happens:** `source_tier` is optional on `TransferNewsArticle` — old blobs don't have it.
**How to avoid:** This is acceptable for old cached data (D-03 accepts this gracefully). The tier `'All'` pill will always show all articles regardless. Document in tests: filter tests should use articles with explicit `source_tier` set.
**Warning signs:** Tier filter returns empty when data is definitely present — check if the test articles have `source_tier` in `makeArticle()`.

### Pitfall 4: 21-day threshold fires in tests using real time
**What goes wrong:** Tests that render articles with `published: '2026-05-19T10:00:00Z'` unexpectedly show `opacity-40` because `Date.now()` in the helper is not mocked.
**Why it happens:** `isArticleStale` calls `Date.now()` at module level (or in render). If `vi.useFakeTimers()` is not set before render, the real clock is used.
**How to avoid:** All new tests must be wrapped in `beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(...) })` matching the existing test pattern (lines 72-80 in `SummerWindowTab.test.tsx`). Set system time close to the published date for non-stale articles, or 22+ days ahead for stale articles.
**Warning signs:** Opacity test passes when it should fail, or vice versa.

### Pitfall 5: Python Literal import path for older Python versions
**What goes wrong:** `from typing import Literal` is only available in Python 3.8+. The pipeline's `transfer_news.py` already uses `str | None` union syntax (Python 3.10+) so this is safe, but the import must be added if not already present.
**Why it happens:** `Literal` is not imported in the current `transfer_news.py`.
**How to avoid:** Add `from typing import Literal` at the top of the file alongside existing imports. Verify `python --version` if uncertain.
**Warning signs:** `NameError: name 'Literal' is not defined` at pipeline import time.

## Code Examples

### Test extensions for pipeline (pytest pattern)

```python
# Source: pipeline/tests/test_transfer_news.py — extend existing artifact shape test

def test_article_dict_contains_source_tier_field(tn):
    """Every article dict must contain a source_tier key (D-03)."""
    sky_entry = _make_entry('Arsenal sign striker', url='https://www.skysports.com/1')
    bbc_entry = _make_entry('Chelsea linked with midfielder', url='https://www.bbc.co.uk/2')

    def mock_parse(url):
        if 'skysports' in url:
            return _make_feed([sky_entry])
        return _make_feed([bbc_entry])

    with patch('transfer_news.feedparser.parse', side_effect=mock_parse):
        with patch('transfer_news.save') as mock_save:
            tn.scrape({'elements': []})
            payload = mock_save.call_args[0][1]

    for article in payload['articles']:
        assert 'source_tier' in article
        assert article['source_tier'] in ('Official', 'Reliable', 'Speculative')

def test_skysports_source_tier_is_reliable(tn):
    assert tn._get_source_tier('skysports') == 'Reliable'

def test_bbc_source_tier_is_reliable(tn):
    assert tn._get_source_tier('bbc') == 'Reliable'

def test_unknown_source_falls_back_to_speculative(tn):
    assert tn._get_source_tier('unknown_tabloid') == 'Speculative'
```

### Test extensions for frontend (Vitest pattern)

```typescript
// Source: src/components/news/SummerWindowTab.test.tsx — new describe block

describe('SummerWindowTab — Phase 131 SPEC-01/02/03', () => {
  it('Test 11 — tier badge renders with tier label when source_tier present', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Sky Article', source: 'skysports', source_tier: 'Reliable' }])
    )
    const { getByText } = render(<SummerWindowTab />)
    expect(getByText('Reliable')).toBeTruthy()
  })

  it('Test 12 — no tier badge rendered when source_tier absent (old blob)', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Old Article', source: 'skysports' }])
    )
    const { queryByText } = render(<SummerWindowTab />)
    expect(queryByText('Reliable')).toBeNull()
    expect(queryByText('Official')).toBeNull()
    expect(queryByText('Speculative')).toBeNull()
  })

  it('Test 13 — article >= 21 days old gets opacity-40 class', () => {
    // System time is 2026-05-19T12:00:00Z (set in beforeEach)
    // 22 days before = 2026-04-27
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Stale Article', published: '2026-04-27T10:00:00Z' }])
    )
    const { container } = render(<SummerWindowTab />)
    const article = container.querySelector('article')
    expect(article?.className).toContain('opacity-40')
  })

  it('Test 14 — article < 21 days old does not get opacity-40 class', () => {
    // 1 day ago = fresh
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([{ title: 'Fresh Article', published: '2026-05-18T10:00:00Z' }])
    )
    const { container } = render(<SummerWindowTab />)
    const article = container.querySelector('article')
    expect(article?.className).not.toContain('opacity-40')
  })

  it('Test 15 — 9 pills total (5 classification + 4 tier) in default render', () => {
    vi.mocked(useTransferNews).mockReturnValue(mockFeed([]))
    const { getAllByRole } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    expect(pills).toHaveLength(9)
  })

  it('Test 16 — tier filter All shows all articles regardless of source_tier', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Reliable Article', source_tier: 'Reliable' },
        { title: 'Official Article', source_tier: 'Official' },
        { title: 'No Tier Article' },
      ])
    )
    const { getByText } = render(<SummerWindowTab />)
    expect(getByText('Reliable Article')).toBeTruthy()
    expect(getByText('Official Article')).toBeTruthy()
    expect(getByText('No Tier Article')).toBeTruthy()
  })

  it('Test 17 — clicking Reliable tier pill filters to Reliable articles only', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Reliable Article', source_tier: 'Reliable' },
        { title: 'Official Article', source_tier: 'Official' },
      ])
    )
    const { getAllByRole, getByText, queryByText } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    fireEvent.click(pills[6]) // index 6 = Reliable tier pill (5 classification + All + Reliable)
    expect(getByText('Reliable Article')).toBeTruthy()
    expect(queryByText('Official Article')).toBeNull()
  })

  it('Test 18 — classification AND tier filter both apply (AND logic)', () => {
    vi.mocked(useTransferNews).mockReturnValue(
      mockFeed([
        { title: 'Reliable Rumour', classification: 'rumour', source_tier: 'Reliable' },
        { title: 'Official Rumour', classification: 'rumour', source_tier: 'Official' },
        { title: 'Reliable Confirmed', classification: 'confirmed_signing', source_tier: 'Reliable' },
      ])
    )
    const { getAllByRole, getByText, queryByText } = render(<SummerWindowTab />)
    const pills = getAllByRole('tab')
    fireEvent.click(pills[2]) // Rumour classification pill
    fireEvent.click(pills[6]) // Reliable tier pill
    expect(getByText('Reliable Rumour')).toBeTruthy()
    expect(queryByText('Official Rumour')).toBeNull()
    expect(queryByText('Reliable Confirmed')).toBeNull()
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All articles same opacity | Binary stale decay via `opacity-40` | Phase 131 | Articles >= 21 days old visually recede |
| No tier signal on article cards | Tier badge alongside source badge | Phase 131 | Users can immediately assess reliability |
| Single-dimension filter (classification) | Two-dimensional filter (classification AND tier) | Phase 131 | More precise filtering without removing existing filter behaviour |

**Not deprecated in this phase:** Existing `SOURCE_CLS`, `SOURCE_LABEL`, `PILLS`, `activeFilter` state — all remain unchanged.

## Assumptions Log

> All claims in this research are verified or cited from direct codebase inspection. No assumed claims.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims were verified against codebase files read in this session.**

## Open Questions

1. **`confidence_score` numeric field (SPEC-02 mentions it)**
   - What we know: SPEC-02 references "confidence decay"; D-05 resolves this as binary `opacity-40` at 21 days.
   - What's unclear: Whether a future phase needs a numeric `confidence_score` in the JSON for progressive decay.
   - Recommendation: Do NOT add `confidence_score` in Phase 131. The binary approach satisfies SPEC-02. If needed later, it's an additive optional field — same pattern as `source_tier?`.

2. **Test 1 update: pill count assertion**
   - What we know: `SummerWindowTab.test.tsx` Test 1 asserts `toHaveLength(5)` on `getAllByRole('tab')`.
   - What's unclear: Whether the divider `<span>` between pill groups will accidentally pick up a tab role.
   - Recommendation: Ensure the divider element has no `role` attribute (it's `aria-hidden="true"` with no role). Update Test 1 to `toHaveLength(9)`.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — changes are confined to existing codebase files: one Python module, two TypeScript files, two test files. No new tools, services, databases, or package installations required.)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Frontend framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Frontend config file | `vitest.config.ts` (project root) |
| Frontend quick run | `npx vitest run src/components/news/SummerWindowTab.test.tsx` |
| Frontend full suite | `npm test` |
| Pipeline framework | pytest (project-standard; see `pipeline/tests/conftest.py`) |
| Pipeline config file | none (conftest.py handles sys.path) |
| Pipeline quick run | `cd pipeline && python -m pytest tests/test_transfer_news.py -x` |
| Pipeline full suite | `cd pipeline && python -m pytest tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPEC-01 | Tier badge renders with correct label | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Extend — Test 11, 12 |
| SPEC-01 | Tier badge absent when source_tier absent | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Extend — Test 12 |
| SPEC-02 | Article >= 21 days gets opacity-40 | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Extend — Test 13 |
| SPEC-02 | Article < 21 days has no opacity-40 | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Extend — Test 14 |
| SPEC-03 | 9 pills total after tier row added | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Update Test 1 + Extend Test 15 |
| SPEC-03 | Tier filter shows only matching articles | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Extend — Test 17 |
| SPEC-03 | Classification AND tier filter (AND logic) | unit | `npx vitest run src/components/news/SummerWindowTab.test.tsx` | Extend — Test 18 |
| SPEC-01 | Pipeline writes source_tier in every article | unit | `cd pipeline && python -m pytest tests/test_transfer_news.py -x` | Extend existing test file |
| SPEC-01 | skysports → Reliable mapping correct | unit | `cd pipeline && python -m pytest tests/test_transfer_news.py -x` | Extend |
| SC-4 | Existing consumers unaffected (source_tier optional) | type-check | `npx tsc --noEmit` | Enforced by optional field on TransferNewsArticle |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/news/SummerWindowTab.test.tsx && cd pipeline && python -m pytest tests/test_transfer_news.py -x`
- **Per wave merge:** `npm test && cd pipeline && python -m pytest tests/ -x`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `makeArticle()` in `SummerWindowTab.test.tsx` does not include `source_tier` field — needs extending to `Partial<TransferNewsArticle>` with `source_tier?: SourceTier` so test helpers can set it
- [ ] Test 1 (pill count `toHaveLength(5)`) must be updated to `toHaveLength(9)` before implementation or it will fail immediately

*(All other test infrastructure exists. No framework install needed.)*

## Security Domain

Phase 131 adds read-only display fields to an existing JSON artifact. No authentication, session management, access control, cryptography, or new API endpoints are introduced. The `source_tier` field is computed server-side (pipeline) from a static dict — no user input is involved.

ASVS categories applicable: V5 Input Validation — the `source_tier` field originates from a hardcoded `SOURCE_TIER` dict in the pipeline, not from user or external input, so no validation beyond the dict lookup is required.

## Sources

### Primary (HIGH confidence)
- `src/components/news/SummerWindowTab.tsx` — read directly; all patterns verified (VERIFIED: codebase)
- `src/lib/types.ts` — read directly; `TransferNewsArticle` and `TransferClass` patterns verified (VERIFIED: codebase)
- `pipeline/transfer_news.py` — read directly; injection pattern and `classify_article` model verified (VERIFIED: codebase)
- `src/components/news/SummerWindowTab.test.tsx` — read directly; test structure, `makeArticle` helper, mock patterns verified (VERIFIED: codebase)
- `pipeline/tests/test_transfer_news.py` — read directly; pytest patterns, monkeypatch, mock_save fixtures verified (VERIFIED: codebase)
- `vitest.config.ts` — read directly; jsdom, setupFiles, exclude patterns verified (VERIFIED: codebase)
- `package.json` — read directly; library versions verified (VERIFIED: codebase)
- node_modules — Next.js 16.2.1, Tailwind 4.2.2, Vitest 4.1.2 verified (VERIFIED: node_modules)
- `.planning/phases/131-transfer-speculation-scoring/131-CONTEXT.md` — read directly; all decisions D-01 through D-13 (VERIFIED: codebase)

### Secondary (MEDIUM confidence)
- Tailwind `opacity-40` usage — verified in `ChipStrategyPanel.tsx` and `WatchlistPlayerCard.tsx` (VERIFIED: grep across src/)
- Teal badge pattern — verified in `CalibrationHealthIndicator.tsx` (VERIFIED: grep across src/)
- Badge CSS pattern `bg-X-100 text-X-800 dark:bg-X-900 dark:text-X-200` — verified across 10+ components (VERIFIED: grep across src/)

## Metadata

**Confidence breakdown:**
- Pipeline implementation: HIGH — pattern mirrors `classify_article`; code is direct and unambiguous
- Frontend badge rendering: HIGH — mirrors `SOURCE_CLS`/`SOURCE_LABEL` pattern exactly
- Frontend filter extension: HIGH — mirrors `activeFilter`/`PILLS` pattern exactly
- Stale decay helper: HIGH — mirrors `isFeedStale` pattern exactly
- Test strategy: HIGH — existing test file structure clear; extension points identified
- Divider implementation (Claude's Discretion): MEDIUM — `self-stretch border-l` pattern is common but not verified with an existing example in this codebase

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable tech stack, 30 days)
