# Phase 131: Transfer Speculation Scoring - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 131 adds source reliability signals to the Summer Window tab:
1. **Tier badge** on every article card — `Official` / `Reliable` / `Speculative` pill derived from the article's `source_tier` field
2. **Confidence decay** — articles older than 21 days render at reduced opacity so stale rumours are visually distinct from fresh ones
3. **Tier filter pill** — extends the existing 5-pill classification row with tier filter pills (AND logic with classification filter)

`source_tier` is computed in the Python pipeline and stored in `transfer_news.json`. TypeScript type and frontend rendering consume it as an optional additive field — existing consumers (`ConfirmedSigningBadge`, GemTable injections) are unaffected (SPEC SC-4).

</domain>

<decisions>
## Implementation Decisions

### Source Tier Assignment (pipeline)
- **D-01:** `source_tier` is computed in `pipeline/transfer_news.py` and written into every article dict before `save('transfer_news.json', payload)` is called. Frontend reads it directly from the article — no client-side derivation logic.
- **D-02:** Source → tier mapping: `'skysports'` and `'bbc'` both map to `'Reliable'`. `'Official'` tier is reserved for future direct club/FPL announcement sources (none currently scraped). `'Speculative'` is reserved for future tabloid/low-confidence sources (none currently scraped). All articles in the current pipeline will have `source_tier: 'Reliable'`.
- **D-03:** `source_tier` is always written (never omitted from the dict). Old blobs without the field are handled gracefully by the TypeScript type being optional.
- **D-04:** Tier values exactly match REQUIREMENTS.md terminology: `'Official'` | `'Reliable'` | `'Speculative'` (not 'Tabloid' from ROADMAP — REQUIREMENTS wins).

### Confidence Decay (frontend)
- **D-05:** Binary threshold: full opacity for articles < 21 days old; `opacity-40` for articles ≥ 21 days old. No gradual decay.
- **D-06:** Stale cards apply Tailwind `opacity-40` to the entire article card element.
- **D-07:** Age is computed from `published ?? scraped_at` — mirrors the existing sort fallback in `SummerWindowTab` (line 96: `new Date(a.published ?? a.scraped_at).getTime()`).

### Tier Badge (frontend)
- **D-08:** Tier badge sits alongside the existing `[SKY]`/`[BBC]` source badge in the top-right flex cluster of each article card. Both badges are visible simultaneously — source tells *who*, tier tells *how reliable*.
- **D-09:** Color scheme using the existing badge CSS pattern (`bg-X-100 text-X-800 dark:bg-X-900 dark:text-X-200`):
  - Official = teal
  - Reliable = blue
  - Speculative = zinc/gray
- **D-10:** Badge label text is the full tier word: `'Official'`, `'Reliable'`, `'Speculative'` — no abbreviation.

### Tier Filter (frontend)
- **D-11:** Classification filter AND tier filter both apply simultaneously (AND logic). An article must match both the selected classification pill and the selected tier pill to appear.
- **D-12:** Tier pills are appended AFTER the existing 5 classification pills in the same `flex-wrap` container, separated by a visual divider (e.g. a `border-l` spacer element). Pill row layout: `All | Confirmed | Rumour | Injury | Rotation ‖ All | Official | Reliable | Speculative`.
- **D-13:** An `'All'` tier pill (default) is added at the start of the tier group. Default state is all tiers shown. Selecting `Official`/`Reliable`/`Speculative` filters by that tier; clicking `'All'` resets. Mirrors the existing classification `'All'` pill behavior.

### Claude's Discretion
- Exact Tailwind class for the divider between classification and tier pill groups (border-l, gap, or a span with right border)
- Whether to extract the 21-day stale check into a module-level helper (like the existing `isFeedStale`) or inline it in the article map
- `SourceTier` TypeScript type alias: can be a local type or added to `src/lib/types.ts` alongside `TransferClass`
- Whether `activeTierFilter` state in `SummerWindowTab` is typed as `'all' | SourceTier` (mirrors existing `activeFilter: TransferClass | 'all'` pattern)
- Whether to add a `confidence_score` numeric field to the pipeline output (SPEC-02 references it; if not needed for the binary decay approach, omit it)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SPEC-01 (tier badge), SPEC-02 (confidence decay), SPEC-03 (tier filter pill), SC-4 (optional additive fields constraint)

### Existing implementation to extend
- `src/components/news/SummerWindowTab.tsx` — file to modify; contains the 5-pill filter row, article card layout, `[SKY]/[BBC]` source badge, `formatRelativeTime` usage, and existing `published ?? scraped_at` sort fallback
- `src/lib/types.ts` — `TransferNewsArticle` interface (add optional `source_tier` field) and `TransferClass` type (reference pattern for new `SourceTier` type)
- `pipeline/transfer_news.py` — file to modify; add `SOURCE_TIER` dict and write `source_tier` into article dicts in `_scrape_rss_sky` and `_scrape_rss_bbc`

### Existing consumers (must NOT be broken)
- `src/components/shared/ConfirmedSigningBadge.tsx` — consumes `TransferNewsArticle`; `source_tier` is additive, no changes needed
- `src/components/gem-table/GemTable.tsx` — consumes transfer news via `confirmedSigningMap`; unaffected
- `src/components/transfers/TransferPanel.tsx` — uses `buildConfirmedSigningMap`; unaffected

### Test file to extend
- `src/components/news/SummerWindowTab.test.tsx` — add tests for tier badge rendering, decay opacity, and tier filter behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SOURCE_CLS` / `SOURCE_LABEL` dicts in `SummerWindowTab.tsx` — existing badge pattern; add a parallel `TIER_CLS` / `TIER_LABEL` dict for the three tier values
- `isFeedStale()` module-level helper — model for a new `isArticleStale(published: string | null, scrapedAt: string): boolean` helper using the same `Date.now() - ts > threshold` pattern
- `PILLS` array (lines 21–27) — satisfies-typed `ReadonlyArray`; extend with a parallel `TIER_PILLS` array using the same shape
- `PILL_LABEL` record — add a `TIER_LABEL` equivalent

### Established Patterns
- Badge CSS: `bg-X-100 text-X-800 dark:bg-X-900 dark:text-X-200 text-xs font-semibold rounded px-2 py-0.5` — use same classes for tier badge
- Filter state: `activeFilter: TransferClass | 'all'` with `useState` — replicate as `activeTierFilter: SourceTier | 'all'`
- Filter logic (lines 91–93): `activeFilter === 'all' ? [...feed.articles] : feed.articles.filter(a => a.classification === activeFilter)` — chain a second tier filter after classification filter
- Pipeline classification: `classify_article()` in `transfer_news.py` — model for a new `_get_source_tier(source: str) -> Literal['Official', 'Reliable', 'Speculative']` helper

### Integration Points
- `transfer_news.py` `scrape()`: `source_tier` added to article dict in `_scrape_rss_sky` / `_scrape_rss_bbc` helpers before `articles.append(article)` — no change to the `save()` call or `payload` structure
- `TransferNewsArticle` in `src/lib/types.ts`: add `source_tier?: 'Official' | 'Reliable' | 'Speculative'` — optional so existing cached blobs without the field still deserialise correctly

</code_context>

<specifics>
## Specific Ideas

- The tier filter pill group uses `'All'` as the reset pill label (matching the classification group), not `'All Tiers'` — keeps pill labels short and consistent
- Tier pill order within the tier group: `All | Official | Reliable | Speculative` (trust hierarchy: highest first)
- The 21-day stale threshold constant should be named `STALE_ARTICLE_THRESHOLD_DAYS = 21` in the component to distinguish it from the existing `STALE_THRESHOLD_MS` (feed staleness)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 131-Transfer Speculation Scoring*
*Context gathered: 2026-05-21*
