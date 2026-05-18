---
phase: 123
plan: 01
subsystem: pipeline
tags: [scraper, rss, rapidfuzz, transfer-news, python-pipeline, player-matching, tdd]
dependency_graph:
  requires: []
  provides:
    - pipeline/player_matching.py (build_name_lookup, match_player, FUZZY_CUTOFF)
    - pipeline/transfer_news.py (scrape, classify_article, CLASSIFICATION_KEYWORDS)
    - pipeline/tests/test_player_matching.py
    - pipeline/tests/test_transfer_news.py
    - pipeline/tests/test_lineup_news.py
  affects:
    - pipeline/lineup_news.py (refactored to use player_matching)
    - pipeline/requirements.txt (rapidfuzz added)
tech_stack:
  added:
    - rapidfuzz>=3.0.0 (3.14.5 installed)
  patterns:
    - rapidfuzz fuzz.token_sort_ratio for player name matching (0-100 scale, cutoff=85)
    - RSS scraping via feedparser with per-source try/except isolation
    - TRANSFER_NEWS_ENABLED env var gate (early-return pattern)
    - URL-based deduplication across RSS feeds
    - SCRP-05 empty-artifact guard (no save() when articles list empty)
key_files:
  created:
    - pipeline/player_matching.py
    - pipeline/transfer_news.py
    - pipeline/tests/test_player_matching.py
    - pipeline/tests/test_transfer_news.py
    - pipeline/tests/test_lineup_news.py
  modified:
    - pipeline/requirements.txt (rapidfuzz>=3.0.0 appended)
    - pipeline/lineup_news.py (difflib removed; import from player_matching)
decisions:
  - "D-01: rapidfuzz token_sort_ratio >= 85 (0-100 scale, not 0.85) — documented in FUZZY_CUTOFF constant comment"
  - "D-02: Name normalization via build_name_lookup(elements) shared between transfer_news and lineup_news"
  - "D-03: Keyword sets use stem-like substrings (sign not signs) to catch article tense variations"
  - "Transfermarkt omitted per CF-01 (no official RSS feed) and CONTEXT.md lock (Sky+BBC only)"
  - "URL-based deduplication across both feeds (Claude's Discretion) — simplest correct approach"
  - "No age cutoff in v1 — RSS feeds naturally return recent items only"
metrics:
  duration: "11 minutes"
  completed: "2026-05-18"
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 2
  tests_added: 31
  tests_passing: 31
---

# Phase 123 Plan 01: SCRAPER-02 Pipeline Foundation Summary

**One-liner:** rapidfuzz player-matching shared utility + Sky/BBC RSS transfer news scraper with env gate, classifier, and lineup_news.py refactored to eliminate difflib duplication.

## What Was Built

### pipeline/player_matching.py (SCR-02)

New shared utility providing `build_name_lookup(elements)` and `match_player(text, lookup)` using `rapidfuzz.fuzz.token_sort_ratio` with `FUZZY_CUTOFF = 85` (integer, 0-100 scale). Used by both `transfer_news.py` and the refactored `lineup_news.py`. Short-word skip (len < 4) guards against false positives on tokens like "Son" (Pitfall 8). Full-string fallback pass catches multi-token names.

### pipeline/transfer_news.py (SCR-01, SCR-03, SCR-05)

New RSS scraper module with:
- `TRANSFER_NEWS_ENABLED` env gate: returns early with log when unset or not 'true'
- Separate try/except isolation for Sky Sports and BBC Sport feeds
- `classify_article()` keyword classifier: 5 classes in priority order (D-03 keyword sets)
- URL-based deduplication across both feeds
- SCRP-05 empty-guard: never calls `upload.save()` when articles list is empty
- Writes `transfer_news.json` artifact via `upload.save()` only (never calls vercel_blob directly)
- Artifact shape matches the `TransferNewsArticle`/`TransferNewsFeed` TypeScript interfaces planned for Plan 02

### lineup_news.py refactored (SCR-02)

Removed `import difflib`, `_build_name_lookup`, and `_match_player` internal implementations. Added `from player_matching import build_name_lookup, match_player`. Updated 3 call sites (premierleague, sky, bbc scrapers) to use the shared functions. The key semantic change: old `_match_player` returned a full element dict (caller did `matched.get('id')`); new `match_player` returns `element_id` (int) directly.

### Test Files

- `test_player_matching.py`: 12 tests — build_name_lookup (lowercasing, dedup, int values, empty), match_player (exact, case-insensitive, fuzzy, below-cutoff, None/empty input, short-word skip), FUZZY_CUTOFF scale guard
- `test_transfer_news.py`: 13 tests — env gate (unset/false), classifier (5 classes, case-insensitive, summary text, keyword dict), non-fatal isolation, empty-guard, artifact shape
- `test_lineup_news.py`: 6 regression tests — module importable, compute_lineup_news present, no internal _build/_match definitions, no difflib import, empty-bootstrap guard, single-element smoke test

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a625de6 | test | Add rapidfuzz dependency and RED-stage test stubs for player_matching and transfer_news |
| ef080bb | feat | Implement player_matching.py with rapidfuzz token_sort_ratio (SCR-02) |
| 35757ec | feat | Implement transfer_news.py scraper, classifier, env gate, and isolation (SCR-01, SCR-03, SCR-05) |
| 4a3c5f3 | refactor | lineup_news.py delegates player-name matching to player_matching.py (SCR-02) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Keyword stem mismatch in confirm_signing classifier**
- **Found during:** Task 03 — test_classify_confirmed_signing failed
- **Issue:** CONTEXT.md D-03 lists "signs" as the confirmed_signing keyword; test fixture uses "Arsenal sign striker" (bare infinitive "sign" not third-person "signs")
- **Fix:** Changed keyword to "sign" (substring match catches "signs", "signing", "signed" as well). Applied same stem logic to "joins" → "join" and "completes" → "complet" for consistency
- **Files modified:** pipeline/transfer_news.py (CLASSIFICATION_KEYWORDS confirmed_signing values)
- **Commit:** 35757ec
- **Impact:** Broader matching — catches more article tense variations. Still passes all 13 transfer_news tests.

**2. [Rule 2 - Missing test coverage] lineup_news.py had no test file**
- **Found during:** Task 04 acceptance criteria required test_lineup_news.py to pass
- **Issue:** No pre-existing test_lineup_news.py existed in the codebase; acceptance criteria and verify step require it
- **Fix:** Created pipeline/tests/test_lineup_news.py with 6 regression/smoke tests
- **Files created:** pipeline/tests/test_lineup_news.py
- **Commit:** 4a3c5f3

**3. [Rule 2 - Missing critical guard] feed.bozo references in docstrings hit grep check**
- **Found during:** Task 03 acceptance criteria check `grep -v '^#' pipeline/transfer_news.py | grep -c "feed.bozo"` returns 0
- **Status:** Grep check returns 2 (lines are inside docstrings, not code lines). The actual implementation correctly never checks `if feed.bozo:`. Grep `'^#'` only strips lines starting with `#`, not inline comments or docstring lines. This is documentation-only — no code bailout on bozo.
- **Assessment:** Not a code bug; grep check false positive due to docstring documentation of the pitfall.

### test stub approach for RED stage

The plan specified tests must be "collectible" but fail at RED stage with ModuleNotFoundError. Top-level `from player_matching import ...` causes collection failure, not just test failure. Solution: deferred import via `_import_pm()` fixture using try/except that calls `pytest.fail()` when module is missing. This makes tests collectible (25 tests listed in --collect-only) while still failing until the implementation modules exist.

## Verification Results

```
cd pipeline && python -m pytest tests/test_player_matching.py tests/test_transfer_news.py tests/test_lineup_news.py -x -q
31 passed in 1.05s

cd pipeline && python -m pytest tests/ -x -q --ignore=tests/test_transfer_news.py --ignore=tests/test_player_matching.py
247 passed in 3.73s  (no regressions)
```

## Requirements Satisfied

- **SCR-01**: Sky Sports + BBC Sport RSS scraped via `transfer_news.scrape()` with per-source isolation and `upload.save()` write. Transfermarkt omitted per CF-01 (no official RSS) and CONTEXT.md lock.
- **SCR-02**: `player_matching.py` shared utility used by both `transfer_news.py` and refactored `lineup_news.py`. Single authority for fuzzy name matching.
- **SCR-03**: `classify_article()` returns one of 5 classes per article (confirmed_signing/rumour/injury_return/rotation_signal/general); stored in artifact.
- **SCR-05**: `TRANSFER_NEWS_ENABLED` env gate; non-fatal per-source RSS isolation.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The `pipeline/transfer_news.py` module writes to Vercel Blob via `upload.save()` (existing abstraction). Input validation is in place:
- Title truncated to `HEADLINE_MAX_LEN = 280` chars
- Summary truncated to `SUMMARY_MAX_LEN = 500` chars
- Error strings truncated to `ERROR_MAX_LEN = 200` chars

All mitigations in the plan's `<threat_model>` (T-123-01 through T-123-04) are implemented:
- T-123-01: Title/summary truncation applied before appending to articles list
- T-123-02: feedparser sanitizes; never bail on bozo; upload.save uses json.dumps
- T-123-03: Per-source try/except isolation
- T-123-04: Empty-guard prevents wipe of previous valid Blob artifact

## Self-Check: PASSED

All created files exist on disk. All 4 task commits are verified in git history. 31 new tests pass. 247 pre-existing pipeline tests pass (no regressions).
