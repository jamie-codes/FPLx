---
phase: 131-transfer-speculation-scoring
plan: 01
subsystem: pipeline
tags:
  - pipeline
  - transfer-news
  - speculation-scoring
  - tdd
dependency_graph:
  requires:
    - pipeline/transfer_news.py (Phase 123 — base scraper)
  provides:
    - pipeline/transfer_news.py:SOURCE_TIER (constant dict)
    - pipeline/transfer_news.py:_get_source_tier (pure helper)
    - source_tier field in every article dict written by scrape()
  affects:
    - transfer_news.json artifact (new source_tier key per article)
    - Plan 02 frontend — reads source_tier from article dict directly
tech_stack:
  added:
    - from typing import Literal (Python stdlib — no new pip dependency)
  patterns:
    - TDD RED/GREEN cycle (Wave 0 failing tests, Wave 1 implementation)
    - MODULE-LEVEL DICT + PURE HELPER pattern (mirrors classify_article / CLASSIFICATION_KEYWORDS)
    - dict.get(source, fallback) for safe default tier assignment
key_files:
  modified:
    - pipeline/transfer_news.py
    - pipeline/tests/test_transfer_news.py
decisions:
  - "SOURCE_TIER dict placed after CLASSIFICATION_KEYWORDS — mirrors the existing constant-then-helper layout"
  - "_get_source_tier placed in Private helpers section — pure function, not public API (mirrors classify_article position)"
  - "source_tier key inserted between element_id and scraped_at — matches the locked article dict shape from CONTEXT.md"
metrics:
  duration_minutes: 12
  completed_date: "2026-05-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  tests_added: 4
  tests_green: 17
---

# Phase 131 Plan 01: Source Tier Pipeline Field Summary

**One-liner:** Added `SOURCE_TIER` constant dict and `_get_source_tier()` pure helper to `pipeline/transfer_news.py`; both RSS scrape helpers now inject `source_tier: 'Reliable'` into every article dict before `articles.append()`.

## What Was Built

### New Constants and Functions

**`SOURCE_TIER` (module-level constant, `pipeline/transfer_news.py`)**
```python
SOURCE_TIER: dict[str, Literal['Official', 'Reliable', 'Speculative']] = {
    'skysports': 'Reliable',
    'bbc':       'Reliable',
}
```
Placed after `CLASSIFICATION_KEYWORDS`, before `_now_iso()`. Cites D-02. `'Official'` and `'Speculative'` are reserved for future sources not yet scraped.

**`_get_source_tier(source: str)` (private helper, `pipeline/transfer_news.py`)**
```python
def _get_source_tier(source: str) -> Literal['Official', 'Reliable', 'Speculative']:
    """Return reliability tier for a given source identifier. Falls back to 'Speculative'."""
    return SOURCE_TIER.get(source, 'Speculative')
```
Mirrors the shape of `classify_article()` (dict + pure helper pattern). Falls back to `'Speculative'` via `dict.get` default (D-02).

### Where `source_tier` Is Injected

Both scrape helpers received the new field between `element_id` and `scraped_at`:

- `_scrape_rss_sky`: `'source_tier': _get_source_tier('skysports')` — always resolves to `'Reliable'`
- `_scrape_rss_bbc`: `'source_tier': _get_source_tier('bbc')` — always resolves to `'Reliable'`

### Import Added

`from typing import Literal` added to the imports block (Pitfall 5 averted — `Literal` was not previously imported).

## Test Delta

| State | Tests | Result |
|-------|-------|--------|
| Wave 0 (RED) | 4 new Phase 131 tests added | All 4 FAIL as expected |
| Wave 1 (GREEN) | Same 4 tests + 13 pre-existing | All 17 PASS |
| Full pipeline suite | 307 tests | All PASS |

**New tests (all in `pipeline/tests/test_transfer_news.py`):**
1. `test_article_dict_contains_source_tier_field` — every article dict has `source_tier` in `('Official', 'Reliable', 'Speculative')`
2. `test_skysports_source_tier_is_reliable` — `_get_source_tier('skysports') == 'Reliable'`
3. `test_bbc_source_tier_is_reliable` — `_get_source_tier('bbc') == 'Reliable'`
4. `test_unknown_source_falls_back_to_speculative` — `_get_source_tier('unknown_tabloid') == 'Speculative'`

## Decisions Honoured

| Decision | Status |
|----------|--------|
| D-01: `source_tier` computed in pipeline, written before `save()` | Satisfied |
| D-02: `'skysports'` and `'bbc'` both map to `'Reliable'`; fallback is `'Speculative'` | Satisfied |
| D-03: `source_tier` always written (never omitted) | Satisfied |
| D-04: Tier vocabulary `'Official' / 'Reliable' / 'Speculative'` (not 'Tabloid') | Satisfied |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `source_tier` is always written with a real value from `SOURCE_TIER`. No hardcoded empty values or placeholders.

## Threat Flags

None. `source_tier` originates from a hardcoded `SOURCE_TIER` dict — no user input involved. No new network endpoints, auth paths, or trust boundary changes.

## Self-Check

### Files Exist
- `pipeline/transfer_news.py` — FOUND (modified in place)
- `pipeline/tests/test_transfer_news.py` — FOUND (modified in place)

### Commits Exist
- `44aff63` — `test(131-01): add failing tests for source_tier field and tier mapping (RED)` — FOUND
- `24f694e` — `feat(131-01): implement SOURCE_TIER dict, _get_source_tier helper, source_tier injection (GREEN)` — FOUND

### Acceptance Criteria
- `pipeline/transfer_news.py` contains `from typing import Literal` — PASS
- `pipeline/transfer_news.py` contains `SOURCE_TIER` dict with `'skysports': 'Reliable'` and `'bbc': 'Reliable'` — PASS
- `pipeline/transfer_news.py` contains `def _get_source_tier(source: str) -> Literal['Official', 'Reliable', 'Speculative']:` — PASS
- `pipeline/transfer_news.py` contains `SOURCE_TIER.get(source, 'Speculative')` — PASS
- `pipeline/transfer_news.py` contains `'source_tier': _get_source_tier('skysports')` — PASS
- `pipeline/transfer_news.py` contains `'source_tier': _get_source_tier('bbc')` — PASS
- All 17 `test_transfer_news.py` tests pass — PASS (307 total pipeline tests GREEN)

## Self-Check: PASSED
