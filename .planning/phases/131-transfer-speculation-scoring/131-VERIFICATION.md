---
phase: 131-transfer-speculation-scoring
verified: 2026-05-22T07:50:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 131: Transfer Speculation Scoring — Verification Report

**Phase Goal:** Summer Window articles carry a visible source reliability tier so users can instantly judge how much weight to give each transfer rumour, and stale articles visually signal their age via confidence decay
**Verified:** 2026-05-22T07:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every article card in the Summer Window tab displays a tier badge (Official / Reliable / Speculative) sourced from `article.source_tier` | VERIFIED | `article.source_tier && (<span ... {TIER_LABEL[article.source_tier]}>)` at SummerWindowTab.tsx:227-230; Test 11 passes |
| 2 | Articles older than 21 days show reduced opacity so users can distinguish fresh rumours from stale ones | VERIFIED | `isArticleStale` helper at SummerWindowTab.tsx:25-28; `opacity-40` applied conditionally at line 213; Tests 13 and 14 pass |
| 3 | The 5-pill classification filter row gains a tier pill filter (Official / Reliable / Speculative) and filtering by tier shows only matching articles | VERIFIED | `TIER_PILLS` array at SummerWindowTab.tsx:41-46; `activeTierFilter` state at line 85; tier pill `.map()` at lines 181-198; Tests 15-17 pass |
| 4 | Existing Summer Window article consumers (ConfirmedSigningBadge, GemTable) are unaffected — `source_tier` is an optional additive field | VERIFIED | `source_tier?: SourceTier` optional field on `TransferNewsArticle` in types.ts:1083; ConfirmedSigningBadge 7/7 tests pass; GemTable/TransferPanel 6/6 tests pass; tsc clean on Phase 131 files |
| 5 | Every article dict written by `pipeline/transfer_news.scrape()` contains a `source_tier` key with value `'Official' \| 'Reliable' \| 'Speculative'` | VERIFIED | `'source_tier': _get_source_tier('skysports')` at transfer_news.py:117; `'source_tier': _get_source_tier('bbc')` at line 152; Test `test_article_dict_contains_source_tier_field` passes |
| 6 | `_get_source_tier('skysports')` returns `'Reliable'`; `_get_source_tier('bbc')` returns `'Reliable'`; `_get_source_tier('unknown_tabloid')` returns `'Speculative'` | VERIFIED | `SOURCE_TIER.get(source, 'Speculative')` at transfer_news.py:80; Tests B/C/D pass |
| 7 | AND-logic filter: classification filter AND tier filter both apply simultaneously | VERIFIED | Two-stage chain at SummerWindowTab.tsx:125-134 (`afterClassification` then `filtered`); Test 18 passes |
| 8 | No tier badge renders when `source_tier` is absent (graceful degradation for old cached blobs) | VERIFIED | `article.source_tier && (...)` guard at SummerWindowTab.tsx:227; Test 12 passes |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/transfer_news.py` | `SOURCE_TIER` constant dict + `_get_source_tier()` helper + `source_tier` injection in both scrape helpers | VERIFIED | All three present at lines 64-67 (SOURCE_TIER), 74-80 (_get_source_tier), 117 (sky injection), 152 (bbc injection) |
| `pipeline/tests/test_transfer_news.py` | Four new pytest tests covering tier field presence and source-to-tier mapping | VERIFIED | Tests at lines 262-292 under `# Phase 131: source_tier field tests` banner; all 4 pass |
| `src/lib/types.ts` | `SourceTier` type alias + optional `source_tier?` field on `TransferNewsArticle` | VERIFIED | `SourceTier` exported at line 1066; `source_tier?: SourceTier` at line 1083 |
| `src/components/news/SummerWindowTab.tsx` | `TIER_PILLS`, `activeTierFilter`, `isArticleStale`, badge render, `opacity-40`, AND-logic filter chain, divider span | VERIFIED | All present: TIER_PILLS (41-46), activeTierFilter (85), isArticleStale (25-28), badge (227-230), opacity-40 (213), two-stage filter (125-134), divider (178) |
| `src/components/news/SummerWindowTab.test.tsx` | Tests 11-18 in new Phase 131 describe block; Test 1 updated to 9 pills | VERIFIED | `describe('SummerWindowTab — Phase 131 SPEC-01/02/03')` at line 234; Tests 11-18 at lines 238-338; Test 1 asserts `toHaveLength(9)` at line 87 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/transfer_news.py:_scrape_rss_sky` | `_get_source_tier` | `source_tier: _get_source_tier('skysports')` before `articles.append(article)` | WIRED | Confirmed at line 117; test passes |
| `pipeline/transfer_news.py:_scrape_rss_bbc` | `_get_source_tier` | `source_tier: _get_source_tier('bbc')` before `articles.append(article)` | WIRED | Confirmed at line 152; test passes |
| `SummerWindowTab.tsx` | `src/lib/types.ts:SourceTier` | `import type { TransferClass, SourceTier } from '@/lib/types'` | WIRED | Confirmed at line 10; tsc clean |
| `SummerWindowTab.tsx` | `article.source_tier` | `TIER_CLS[article.source_tier]` and `TIER_LABEL[article.source_tier]` in badge span | WIRED | Confirmed at lines 228-229; Test 11 passes |
| `SummerWindowTab.tsx` | `activeTierFilter` state | `useState<SourceTierFilter>('all')` + `afterClassification.filter(a => a.source_tier === activeTierFilter)` | WIRED | Confirmed at lines 85 and 134; Tests 17 and 18 pass |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SummerWindowTab.tsx` badge span | `article.source_tier` | `pipeline/transfer_news.py` — `_get_source_tier()` call writes field into article dict before `save()` | Yes — computed from `SOURCE_TIER` dict; pipeline is authoritative source | FLOWING |
| `SummerWindowTab.tsx` opacity class | `isArticleStale(article.published, article.scraped_at)` | `published` and `scraped_at` from article dict written by pipeline | Yes — uses real timestamps from RSS entries | FLOWING |
| `SummerWindowTab.tsx` tier filter | `activeTierFilter` state | User interaction via `setActiveTierFilter(pill.value)` | Yes — user-driven filter applied against `article.source_tier` field | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 4 new pytest tests pass | `python -m pytest tests/test_transfer_news.py::test_article_dict_contains_source_tier_field tests/...` | `4 passed in 0.07s` | PASS |
| All 18 SummerWindowTab tests pass (Tests 1, 11-18 new/updated) | `npx vitest run src/components/news/SummerWindowTab.test.tsx --reporter=verbose` | `18 passed` | PASS |
| ConfirmedSigningBadge not regressed | `npx vitest run src/components/shared/ConfirmedSigningBadge.test.tsx` | `7 passed` | PASS |
| GemTable/TransferPanel not regressed | `npx vitest run src/components/gem-table/GemTable.test.tsx src/components/transfers/TransferPanel.test.tsx` | `6 passed` | PASS |
| tsc clean on Phase 131 files | `npx tsc --noEmit 2>&1 \| grep -E "SummerWindowTab\|types\.ts\|transfer_news"` | No output — zero errors in Phase 131 files | PASS |

Note: `npx tsc --noEmit` reports 5 pre-existing errors in `fpl-login/route.test.ts` (Phase 130, commit `865882b`) and `decision-history/route.test.ts`. These are not introduced by Phase 131 and do not block this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SPEC-01 | 131-01, 131-02 | User can see a source reliability tier badge (Official / Reliable / Speculative) on each Summer Window article card | SATISFIED | Pipeline writes `source_tier` field; frontend renders conditional tier badge span with `TIER_LABEL` and `TIER_CLS`; Tests 11 and 12 verify presence/absence |
| SPEC-02 | 131-02 | Article confidence decays over time using a 21-day off-season half-life so stale rumours surface their age visually | SATISFIED | `STALE_ARTICLE_THRESHOLD_DAYS = 21`; `isArticleStale()` helper; `opacity-40` applied to stale `<article>` element; Tests 13 and 14 verify both sides of threshold |
| SPEC-03 | 131-02 | User can filter Summer Window articles by source tier (tier pill added to existing 5-pill classification filter row) | SATISFIED | `TIER_PILLS` array adds 4 pills (All/Official/Reliable/Speculative); `activeTierFilter` state + AND-logic filter chain; divider span between pill groups; Tests 15-18 verify pill count, filter behaviour, and AND logic |

---

### Anti-Patterns Found

None detected.

- No `TODO`, `FIXME`, `PLACEHOLDER` comments in Phase 131 files
- No stub implementations (`return null`, `return {}`, `return []`, empty handlers)
- `article.source_tier && (...)` guard correctly averts rendering when field absent — not a stub, it is intentional graceful degradation (D-03)
- `Date.now()` is called only inside `isArticleStale()` helper, not inline in JSX (react-hooks/purity respected)
- Existing `feed.articles` is never mutated — spread `[...feed.articles]` pattern preserved

---

### Human Verification Required

None. All observable truths are verifiable programmatically. Visual appearance of tier badges (teal/blue/zinc colour scheme) and the divider separator between pill groups can be confirmed from the Tailwind class strings in the source; functional correctness is covered by the Vitest suite.

---

## Gaps Summary

No gaps. All 8 must-have truths verified, all 5 required artifacts confirmed substantive and wired, all 3 key links confirmed wired, all 3 requirements satisfied.

---

_Verified: 2026-05-22T07:50:00Z_
_Verifier: Claude (gsd-verifier)_
