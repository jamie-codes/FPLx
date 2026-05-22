---
phase: 131-transfer-speculation-scoring
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - pipeline/transfer_news.py
  - pipeline/tests/test_transfer_news.py
  - src/lib/types.ts
  - src/components/news/SummerWindowTab.tsx
  - src/components/news/SummerWindowTab.test.tsx
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 131: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Phase 131 transfer speculation scoring implementation: the Python RSS scraper (`transfer_news.py`), its unit tests, the TypeScript type additions, and the `SummerWindowTab` frontend component with its test suite.

The overall structure is sound. The env gate, source isolation, empty-guard, deduplication, and `source_tier` field wiring all look correct. The React component correctly implements AND-logic for the two filter dimensions, the 21-day opacity decay, and the tier badge rendering.

Four warnings were identified. The most impactful is a systematic classification bug: pure substring keyword matching causes false positives that cross class boundaries in ways that directly degrade the feature's value. A weaker but notable test gap means one non-fatal isolation test can pass even if the non-failing source never writes its articles.

---

## Warnings

### WR-01: Substring keyword matching causes cross-class false positives

**File:** `pipeline/transfer_news.py:56-61`

**Issue:** `classify_article` uses plain `in` substring matching (e.g. `kw in text`). Two keywords produce systematic false classifications:

1. **`'sign'`** (under `confirmed_signing`) matches the substring inside `'signing'`, `'designer'`, `'redesign'`, etc. Because `confirmed_signing` is the first dict entry, any rumour headline that contains the word "signing" (e.g. "Arsenal interested in signing midfielder") is classified as `confirmed_signing` instead of `rumour`. The `'interest'` keyword in the `rumour` class is never reached.

2. **`'fit'`** (under `injury_return`) matches as a substring of `'profit'`, `'outfit'`, `'benefit'`, `'fitness'`. A headline like "Transfer profit secured for Arsenal" matches `injury_return` before the loop reaches the `general` fallback.

   Verified with the actual keyword dict:
   ```python
   text = 'Arsenal interested in signing midfielder'
   # First match: confirmed_signing (via 'sign' inside 'signing')
   # Expected:    rumour (via 'interest')
   ```

**Fix:** Use word-boundary matching via `re` so that `'sign'` only matches the standalone word, not substrings:

```python
import re

def _keyword_in_text(keyword: str, text: str) -> bool:
    """Match keyword as a whole word (or phrase) in lowercased text."""
    pattern = r'\b' + re.escape(keyword) + r'\b'
    return bool(re.search(pattern, text))

# In classify_article:
for cls, keywords in CLASSIFICATION_KEYWORDS.items():
    if any(_keyword_in_text(kw, text) for kw in keywords):
        return cls
```

Multi-word keywords like `'back in training'` and `'done deal'` and `'squad player'` already contain spaces and will not be affected by word-boundary anchoring.

---

### WR-02: `test_non_fatal_isolation_sky_failure` does not unconditionally assert `save()` was called

**File:** `pipeline/tests/test_transfer_news.py:170`

**Issue:** The test verifies that when Sky Sports raises, the BBC source still succeeds and produces articles. However the assertion block is guarded by `if mock_save.called:` — a conditional check, not an `assert`. If `save()` were silently not called (e.g. due to a regression in the BBC scraper path returning zero entries), the test would still pass because the `if` branch is simply skipped.

```python
# current — passes even if save() was never called:
if mock_save.called:
    call_args = mock_save.call_args
    payload = call_args[0][1]
    assert payload['source_health']['skysports']['ok'] is False
    assert payload['source_health']['bbc']['ok'] is True
```

**Fix:** Use `assert_called_once()` unconditionally, then inspect the payload:

```python
mock_save.assert_called_once()
call_args = mock_save.call_args
payload = call_args[0][1]
assert payload['source_health']['skysports']['ok'] is False
assert payload['source_health']['bbc']['ok'] is True
assert len(payload['articles']) >= 1, "BBC articles should be present"
```

---

### WR-03: `test_classification_keywords_has_all_five_classes` name misleads — only asserts four classes

**File:** `pipeline/tests/test_transfer_news.py:137-139`

**Issue:** The test is named "all_five_classes" but the `required` set only contains four entries — `general` is omitted. While `general` is a fallback return value rather than a `CLASSIFICATION_KEYWORDS` entry (so it can't be checked via `CLASSIFICATION_KEYWORDS.keys()`), the misleading name obscures intent and could mask a future regression where `general` is incorrectly added to the dict (which would break the fallback).

```python
# current:
required = {'confirmed_signing', 'rumour', 'injury_return', 'rotation_signal'}
assert required.issubset(set(tn.CLASSIFICATION_KEYWORDS.keys()))
# 'general' is not tested at all
```

**Fix:** Either rename the test to `test_classification_keywords_has_four_keyword_classes` to match what it actually checks, and add a separate assertion that `'general'` is NOT a keyword class (ensuring the fallback is preserved):

```python
def test_classification_keywords_has_four_keyword_classes(tn):
    required = {'confirmed_signing', 'rumour', 'injury_return', 'rotation_signal'}
    assert required.issubset(set(tn.CLASSIFICATION_KEYWORDS.keys()))
    # 'general' must NOT be in CLASSIFICATION_KEYWORDS — it is the fallback return, not a keyword class
    assert 'general' not in tn.CLASSIFICATION_KEYWORDS
```

---

### WR-04: `_scrape_rss_sky` and `_scrape_rss_bbc` are near-identical (copy-paste duplication)

**File:** `pipeline/transfer_news.py:88-157`

**Issue:** The two private scraper functions are identical in structure, differing only in the feed URL and the hardcoded source string (`'skysports'` / `'bbc'`). When a bug is fixed in one (e.g. the title truncation logic or deduplication guard), the fix must be manually applied to the other. This has already drifted in comments (the BBC function omits the Pitfall 3 note that appears in the Sky function).

**Fix:** Extract a shared helper and call it twice:

```python
def _scrape_rss(
    url: str, source: str, articles: list, name_lookup: dict,
    seen_urls: set, scraped_at: str
) -> None:
    feed = feedparser.parse(url)
    for entry in feed.entries:
        title = entry.get('title', '')
        if not title:
            continue
        entry_url = entry.get('link', '')
        if entry_url and entry_url in seen_urls:
            continue
        summary = entry.get('summary', None)
        published = entry.get('published', None)
        classification = classify_article(title, summary)
        match_text = title + ' ' + (summary or '')
        element_id = match_player(match_text, name_lookup)
        article = {
            'title': title[:HEADLINE_MAX_LEN],
            'summary': summary[:SUMMARY_MAX_LEN] if summary else None,
            'url': entry_url,
            'published': published,
            'source': source,
            'classification': classification,
            'element_id': element_id,
            'source_tier': _get_source_tier(source),
            'scraped_at': scraped_at,
        }
        articles.append(article)
        if entry_url:
            seen_urls.add(entry_url)
```

---

## Info

### IN-01: Empty-state message renders "No All articles found." when `activeFilter='all'`

**File:** `src/components/news/SummerWindowTab.tsx:204`

**Issue:** The empty-state message is `No {PILL_LABEL[activeFilter]} articles found.` `PILL_LABEL['all']` is `'All'`, producing the grammatically awkward string "No All articles found." This occurs whenever both filters are active and the combined result is empty — a plausible scenario when the tier filter is set to `Official` (no Official sources are currently configured).

**Fix:**

```tsx
<p className="text-sm text-zinc-500 dark:text-zinc-400">
  {activeFilter === 'all'
    ? 'No articles found.'
    : `No ${PILL_LABEL[activeFilter]} articles found.`}
</p>
```

---

### IN-02: Empty-state message does not reflect active tier filter, potentially confusing users

**File:** `src/components/news/SummerWindowTab.tsx:202-205`

**Issue:** When a user selects `Rumour` classification and `Official` tier, the empty state reads "No Rumour articles found." — but rumour articles may well exist; they are hidden by the tier filter. The user has no indication that the tier filter is narrowing the results. This is particularly acute because `source_tier` is optional on old cached blobs, meaning any non-`all` tier selection will silently hide all pre-Phase-131 articles.

**Fix:** Include tier context in the empty state when `activeTierFilter !== 'all'`:

```tsx
<p className="text-sm text-zinc-500 dark:text-zinc-400">
  {`No ${activeFilter === 'all' ? '' : PILL_LABEL[activeFilter] + ' '}articles found${
    activeTierFilter !== 'all' ? ` from ${activeTierFilter} sources` : ''
  }.`}
</p>
```

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
