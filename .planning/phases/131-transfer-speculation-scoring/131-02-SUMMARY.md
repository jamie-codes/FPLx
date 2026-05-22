---
phase: 131-transfer-speculation-scoring
plan: "02"
subsystem: frontend
tags:
  - summer-window
  - tier-badge
  - filter-pills
  - confidence-decay
  - typescript
dependency_graph:
  requires:
    - 131-01 (pipeline source_tier field)
  provides:
    - SourceTier type alias
    - source_tier? field on TransferNewsArticle
    - TIER_LABEL / TIER_CLS dicts
    - TIER_PILLS array
    - activeTierFilter state + AND-logic filter chain
    - tier badge render in article cards
    - opacity-40 stale decay render
    - divider span between pill groups
  affects:
    - src/components/news/SummerWindowTab.tsx
    - src/lib/types.ts
    - src/components/news/SummerWindowTab.test.tsx
tech_stack:
  added: []
  patterns:
    - Parallel TIER_LABEL/TIER_CLS dicts mirroring SOURCE_LABEL/SOURCE_CLS
    - Module-level isArticleStale helper mirroring isFeedStale
    - Two-stage afterClassification -> filtered chain (AND logic)
    - TIER_PILLS satisfies ReadonlyArray<...> pattern mirroring PILLS
    - Per-article article.source_tier && (...) conditional badge render
key_files:
  created: []
  modified:
    - src/lib/types.ts
    - src/components/news/SummerWindowTab.tsx
    - src/components/news/SummerWindowTab.test.tsx
decisions:
  - "SourceTier type placed immediately above TransferClass in the Phase 123 section to keep transfer news types grouped"
  - "isArticleStale uses Date.now() - new Date(published ?? scrapedAt).getTime() > STALE_ARTICLE_THRESHOLD_MS (D-07: mirrors sort fallback)"
  - "Tests 11 and 12 adjusted to query within article card span elements rather than using getByText/queryByText — necessary because the tier pill buttons also render 'Reliable', 'Official', 'Speculative' labels (Rule 1: bug in pattern-provided test bodies)"
  - "STALE_ARTICLE_THRESHOLD_DAYS = 21 named to distinguish from existing STALE_THRESHOLD_MS (feed staleness 24h)"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-22"
  tasks_completed: 3
  files_changed: 3
---

# Phase 131 Plan 02: Frontend Tier Badge, Decay, and Filter Summary

Wired the Summer Window tab frontend to honour SPEC-01 (tier badge), SPEC-02 (21-day confidence decay), and SPEC-03 (tier filter pill row extension) — all three features additive and backward-compatible with pre-Phase-131 cached blobs.

## What Was Built

### New TypeScript exports (`src/lib/types.ts`)

- `SourceTier = 'Official' | 'Reliable' | 'Speculative'` — type alias inserted above `TransferClass` in the Phase 123 section
- `source_tier?: SourceTier` — optional field on `TransferNewsArticle` between `element_id` and `scraped_at`; absent on pre-Phase-131 cached blobs (D-03 / SC-4)

### New frontend constants and helpers (`src/components/news/SummerWindowTab.tsx`)

| Symbol | Type | Purpose |
|--------|------|---------|
| `STALE_ARTICLE_THRESHOLD_DAYS` | `const = 21` | Named threshold to distinguish from `STALE_THRESHOLD_MS` (feed staleness) |
| `STALE_ARTICLE_THRESHOLD_MS` | `const` | Millisecond equivalent for date math |
| `isArticleStale(published, scrapedAt)` | module-level helper | Returns true when article age >= 21 days; mirrors `isFeedStale` pattern |
| `TIER_LABEL` | `Record<SourceTier, string>` | Full-word badge labels: Official, Reliable, Speculative (D-10) |
| `TIER_CLS` | `Record<SourceTier, string>` | Tailwind badge classes: teal/blue/zinc (D-09) |
| `SourceTierFilter` | local type | `SourceTier \| 'all'` — mirrors existing `TransferClass \| 'all'` pattern |
| `TIER_PILLS` | `satisfies ReadonlyArray<...>` | 4-pill array All/Official/Reliable/Speculative (D-13, trust hierarchy order) |
| `activeTierFilter` | `useState<SourceTierFilter>('all')` | Second filter dimension; default 'all' shows all articles (D-13) |

### Where render changes landed (`SummerWindowTab.tsx`)

1. **Tier badge** (SPEC-01): Inside `sortedArticles.map()`, after the existing `[SKY]/[BBC]` source badge span, a second `<span>` renders `TIER_LABEL[article.source_tier]` with `TIER_CLS[article.source_tier]` classes — guarded by `article.source_tier && (...)` so old blobs silently skip rendering (D-03)

2. **Stale opacity** (SPEC-02): `const stale = isArticleStale(article.published, article.scraped_at)` computed per card; appended to `<article>` className as `${stale ? ' opacity-40' : ''}` — applied to the entire card element, not children (D-06)

3. **Divider** (D-12): `<span aria-hidden="true" className="self-stretch border-l border-zinc-300 dark:border-zinc-600 mx-1" />` inserted between the 5 classification pills and 4 tier pills; no `role` attribute so `getAllByRole('tab')` ignores it

4. **Tier pill row** (SPEC-03): `TIER_PILLS.map()` renders 4 buttons with `role="tab"`, `aria-selected`, `key="tier-{value}"`, and `onClick={() => setActiveTierFilter(pill.value)}` — same Tailwind shape as classification pills

5. **AND-logic filter chain** (D-11): Replaced single `filtered` derivation with two-stage chain:
   - `afterClassification`: classification filter (unchanged logic)
   - `filtered`: tier filter applied to `afterClassification` (when `activeTierFilter !== 'all'`)

### Test count delta

| Change | Count |
|--------|-------|
| Test 1 updated (5 pills → 9 pills + full label array) | 1 |
| Tests 11-18 added in new `describe('SummerWindowTab — Phase 131 SPEC-01/02/03')` block | 8 |
| **Total new/updated tests** | **9** |
| All tests GREEN | 18/18 in file, 1547/1547 full suite |

## Decisions Honoured

| Decision | Status |
|----------|--------|
| D-05: Binary opacity-40 at 21 days | Implemented via `isArticleStale` |
| D-06: opacity-40 on entire `<article>` element | `className` template string on `<article>` |
| D-07: Age from `published ?? scraped_at` | `new Date(published ?? scrapedAt).getTime()` |
| D-08: Tier badge adjacent to source badge in top-right flex cluster | Second `<span>` after source badge |
| D-09: Teal/blue/zinc badge colors | `TIER_CLS` dict |
| D-10: Full-word badge label text | `TIER_LABEL` dict |
| D-11: AND logic classification + tier filter | Two-stage filter chain |
| D-12: Divider between pill groups, same tablist | `aria-hidden` `<span>` between `.map()` calls |
| D-13: 'All' tier pill default resets tier filter | `useState<SourceTierFilter>('all')` |
| SC-4: Existing consumers unaffected | `source_tier?` optional field; tsc clean |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test bodies from PATTERNS.md incompatible with tier pill labels in DOM**

- **Found during:** Task 131-02-03 (GREEN phase)
- **Issue:** The PATTERNS.md Test 11 used `getByText('Reliable')` and Test 12 used `queryByText('Reliable') === null`. Once the TIER_PILLS render buttons labelled "Reliable", "Official", "Speculative", `getByText('Reliable')` throws "multiple elements found" and `queryByText('Reliable')` never returns null
- **Fix:** Rewrote Tests 11 and 12 to query within `article` card elements: Test 11 queries `article .flex.items-start.gap-2 > span` and expects 2 spans (source badge + tier badge); Test 12 expects only 1 span (source badge only)
- **Files modified:** `src/components/news/SummerWindowTab.test.tsx`
- **Commit:** 40eb2e6

## Commits

| Hash | Task | Description |
|------|------|-------------|
| c427129 | 131-02-01 (RED) | Add failing tests: SourceTier type + Tests 11-18 + Test 1 updated to 9 pills |
| 799da4f | 131-02-02 (GREEN) | Implement tier badge (SPEC-01) and 21-day confidence decay (SPEC-02) |
| 40eb2e6 | 131-02-03 (GREEN) | Implement tier filter pill row + AND-logic filter chain (SPEC-03) |

## Self-Check

**Files exist:**
- `src/lib/types.ts` — contains `SourceTier` and `source_tier?` field
- `src/components/news/SummerWindowTab.tsx` — contains `TIER_PILLS`, `isArticleStale`, `activeTierFilter`, badge render, opacity render, divider
- `src/components/news/SummerWindowTab.test.tsx` — contains `describe('SummerWindowTab — Phase 131 SPEC-01/02/03'` with 8 tests

**Commits exist:** c427129, 799da4f, 40eb2e6

**Test results:** 18/18 in file; 1547/1547 full suite; tsc clean on modified files

**Known Stubs:** None. All tier badge, opacity, and filter logic is fully wired with live data from `article.source_tier` field.

**Threat Flags:** None. Phase 131 adds read-only display transformations of existing pipeline data. No new API endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

All three files verified present with correct content. All three commits confirmed in git log. Full test suite green.
