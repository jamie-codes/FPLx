---
phase: 123-scraper-02-pipeline
verified: 2026-05-18T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 123: SCRAPER-02 Pipeline Verification Report

**Phase Goal:** The pipeline ingests summer transfer news from Sky Sports and BBC Sport RSS feeds, matches articles to FPL player IDs, and exposes the feed to the UI via a Route Handler and TanStack hook; the IS_OFF_SEASON gate prevents null-crashes when no current GW exists
**Verified:** 2026-05-18
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | transfer_news.json is written containing articles from Sky Sports and BBC Sport RSS, each with a classification field and matched FPL element_id | VERIFIED | `pipeline/transfer_news.py` scrapes both feeds with isolated try/except; `classify_article()` returns one of 5 classes stored in each article dict; `match_player()` resolves element_id; `save('transfer_news.json', payload)` writes the artifact |
| 2 | TRANSFER_NEWS_ENABLED env var gates the scraper; scraper failure logs and continues without writing empty/corrupt artifact | VERIFIED | Line 183 of transfer_news.py: `if os.getenv('TRANSFER_NEWS_ENABLED', '').lower() != 'true': print('[transfer_news] TRANSFER_NEWS_ENABLED not set — skipping'); return`. Empty-guard at line 220 prevents save on empty articles. Outer try/except in run.py line 163-168 catches any scrape() failure and logs to stderr. |
| 3 | /api/transfer-news Route Handler serves transfer_news.json; useTransferNews() TanStack Query hook fetches from it | VERIFIED | `src/app/api/transfer-news/route.ts` exports GET function using canonical USE_BLOB pattern (verified identical structure to lineup-news handler). `src/lib/hooks/useTransferNews.ts` calls `fetch('/api/transfer-news')` with `staleTime: 6 * 60 * 60 * 1000`. |
| 4 | pipeline/run.py detects IS_OFF_SEASON (no event with is_current=True) and all GW-dependent steps skip gracefully | VERIFIED | Line 148 of run.py: `IS_OFF_SEASON = not any(e.get('is_current') for e in events)`. Lines 471-482: 12 skip-log lines in verbatim D-06 format. Single `if not IS_OFF_SEASON:` block at line 202 wraps all GW-dependent steps. |
| 5 | player_matching.py shared utility used by both transfer_news.py and lineup_news.py (no duplication) | VERIFIED | lineup_news.py line 27: `from player_matching import build_name_lookup, match_player`. transfer_news.py line 39: `from player_matching import build_name_lookup, match_player`. Both internal `_build_name_lookup` and `_match_player` definitions confirmed absent from lineup_news.py. `import difflib` confirmed absent from lineup_news.py. |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/requirements.txt` | rapidfuzz>=3.0.0 declared | VERIFIED | `rapidfuzz>=3.0.0` present as final line |
| `pipeline/player_matching.py` | Exports build_name_lookup, match_player, FUZZY_CUTOFF | VERIFIED | All three exported; FUZZY_CUTOFF = 85 (int, 0-100 scale); `from rapidfuzz import fuzz` present; no difflib |
| `pipeline/transfer_news.py` | Exports scrape, classify_article, CLASSIFICATION_KEYWORDS | VERIFIED | All three present; imports `from upload import save` exclusively (no vercel_blob direct import); feed.bozo check absent from production code (appears only in docstrings) |
| `pipeline/run.py` | IS_OFF_SEASON gate + transfer_news wiring | VERIFIED | Detection expression verbatim on line 148; transfer_news call lines 163-168 outside IS_OFF_SEASON block; 12 skip-log lines on lines 471-482 |
| `pipeline/tests/test_player_matching.py` | Unit tests for player_matching | VERIFIED | 12 tests covering FUZZY_CUTOFF scale guard, build_name_lookup, match_player (exact, fuzzy, short-word skip, None/empty input) |
| `pipeline/tests/test_transfer_news.py` | Unit tests for transfer_news | VERIFIED | 13 tests covering env gate, 5 classifier cases, case-insensitive, summary text, isolation, empty guard, artifact shape |
| `pipeline/tests/test_run_offseason.py` | Contract tests for IS_OFF_SEASON detection | VERIFIED | 8 tests; replica function uses exact D-06 detection expression; skip-log format locked for all 12 GW-dependent steps |
| `pipeline/tests/test_lineup_news.py` | Regression tests for refactored lineup_news | VERIFIED | Created as part of SCR-02 refactor; 6 tests confirm lineup_news has no _build_name_lookup/_match_player, no difflib import, and compute_lineup_news still works correctly |
| `src/lib/types.ts` | TransferClass, TransferNewsArticle, TransferNewsFeed appended | VERIFIED | New Phase 123 block at lines 1033-1062; TransferClass is 5-literal union; TransferNewsArticle has all 8 fields with correct nullability; TransferNewsFeed reuses SourceHealth without duplication |
| `src/app/api/transfer-news/route.ts` | GET Route Handler (canonical lineup-news copy) | VERIFIED | Exact structural copy with 4 targeted substitutions; 'transfer_news.json' prefix used in both blob list and cachePath; 2x 'Transfer news not available' (404 paths); 1x 'Failed to load transfer news' (500 path); Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400 |
| `src/lib/hooks/useTransferNews.ts` | useTransferNews() hook, 6h staleTime, no select | VERIFIED | useQuery<TransferNewsFeed>; queryKey: ['transfer-news']; fetch('/api/transfer-news'); staleTime: 6 * 60 * 60 * 1000; no select transform |
| `src/lib/hooks/useTransferNews.test.ts` | Vitest spec (3 tests) | VERIFIED | 3 tests: success path, error state with locked message, URL call assertion; uses renderHook + QueryClientProvider pattern |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| pipeline/transfer_news.py | pipeline/player_matching.py | from player_matching import build_name_lookup, match_player | WIRED | Line 39 of transfer_news.py — both functions called in scrape() and _scrape_rss_sky/_scrape_rss_bbc |
| pipeline/lineup_news.py | pipeline/player_matching.py | from player_matching import build_name_lookup, match_player | WIRED | Line 27 of lineup_news.py; internal _build_name_lookup/_match_player confirmed removed |
| pipeline/transfer_news.py | pipeline/upload.py | from upload import save | WIRED | Line 40 of transfer_news.py; save('transfer_news.json', payload) at line 229 |
| pipeline/player_matching.py | rapidfuzz | from rapidfuzz import fuzz | WIRED | Line 28 of player_matching.py; fuzz.token_sort_ratio called in match_player() |
| pipeline/run.py | pipeline/transfer_news.py | from transfer_news import scrape as scrape_transfer_news | WIRED | Lines 164-168; placed before first `if not IS_OFF_SEASON:` at line 202 (year-round per D-05) |
| pipeline/run.py | bootstrap.events[] | IS_OFF_SEASON = not any(e.get('is_current') for e in events) | WIRED | Line 148; exact D-06 detection expression; contract-tested in test_run_offseason.py |
| src/lib/hooks/useTransferNews.ts | /api/transfer-news | fetch in queryFn | WIRED | Line 8 of hook: `fetch('/api/transfer-news')` |
| src/lib/hooks/useTransferNews.ts | src/lib/types.ts | import type { TransferNewsFeed } from '../types' | WIRED | Line 2 of hook; type applied as useQuery<TransferNewsFeed> generic |
| src/app/api/transfer-news/route.ts | transfer_news.json (Blob or local cache) | list({ prefix: 'transfer_news.json', limit: 1 }) + readFile | WIRED | Lines 12 and 25 of route.ts; identical dual-path pattern to lineup-news |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| pipeline/transfer_news.py | articles list | feedparser.parse(SKY_RSS_URL) and feedparser.parse(BBC_RSS_URL) | Yes — real RSS feed entries populated via _scrape_rss_sky/_scrape_rss_bbc | FLOWING |
| src/lib/hooks/useTransferNews.ts | TransferNewsFeed | GET /api/transfer-news → readFile(pipeline/cache/transfer_news.json) or Blob | Yes — route.ts reads from Blob or cache file produced by pipeline | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: Spot checks are limited to static code analysis because running the RSS scraper requires live network calls and the pipeline requires a full environment setup. All checkable behaviors were verified via code reading.

| Behavior | Evidence | Status |
|----------|----------|--------|
| TRANSFER_NEWS_ENABLED gate returns early when unset | `os.getenv('TRANSFER_NEWS_ENABLED', '').lower() != 'true'` → early return with log | PASS |
| Empty-guard never calls save() on empty articles | `if not articles: print('...'); return` before `save(...)` | PASS |
| IS_OFF_SEASON detection expression is verbatim D-06 | `not any(e.get('is_current') for e in events)` at run.py line 148 | PASS |
| transfer_news call precedes first IS_OFF_SEASON block in source order | transfer_news import/call at line 164, first `if not IS_OFF_SEASON:` at line 202 | PASS |
| 12 skip-log lines use verbatim D-06 format | Lines 471-482 of run.py, all using `[pipeline] IS_OFF_SEASON: skipping {step}` | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCR-01 | 123-01, 123-03 | Sky Sports + BBC Sport RSS scrape writing transfer_news.json (Transfermarkt omitted per CF-01 — no official feed; ROADMAP SC only references Sky+BBC) | SATISFIED | transfer_news.py scrapes both feeds; run.py wires call; artifact written via upload.save |
| SCR-02 | 123-01 | player_matching.py shared utility for name→element_id resolution | SATISFIED | player_matching.py exists with build_name_lookup/match_player; used by both transfer_news.py and lineup_news.py |
| SCR-03 | 123-01 | 5-class article classification stored in artifact | SATISFIED | classify_article() returns confirmed_signing/rumour/injury_return/rotation_signal/general; classification field in every article dict |
| SCR-04 | 123-02 | Route Handler + TanStack hook expose feed to UI | SATISFIED | /api/transfer-news GET route exists; useTransferNews() hook exists with correct types |
| SCR-05 | 123-01, 123-03 | TRANSFER_NEWS_ENABLED gate; non-fatal pipeline continuation | SATISFIED | Env gate in transfer_news.py; per-source try/except isolation; outer try/except in run.py |
| WIN-03 | 123-03 | IS_OFF_SEASON gate prevents null-crash when no current GW | SATISFIED | IS_OFF_SEASON detection + if not IS_OFF_SEASON block + 12 skip-logs; contract-tested in test_run_offseason.py |

**Note on SCR-01 and Transfermarkt:** REQUIREMENTS.md SCR-01 text mentions "Transfermarkt RSS" but the ROADMAP Phase 123 Success Criteria (the binding phase contract) explicitly scopes to "Sky Sports and BBC Sport RSS feeds" only. Transfermarkt omission is documented in transfer_news.py module docstring as CF-01 (no official RSS feed). This is a requirements text inconsistency, not an implementation gap — the ROADMAP SC is the correct scope for this phase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| pipeline/transfer_news.py | 27-28 (docstring) | `feed.bozo` references in docstring only | Info | Docstring correctly documents the anti-pattern to avoid; no production code checks feed.bozo |

No blockers or warnings found. All TODO/FIXME/placeholder searches returned only documentation comments, not code stubs.

---

### Key Decisions Locked and Verified

| Decision | Contract | Evidence |
|----------|----------|----------|
| D-01: rapidfuzz 0-100 scale, FUZZY_CUTOFF = 85 (int) | FUZZY_CUTOFF = 85 in player_matching.py with comment | Line 36; test_fuzzy_cutoff_is_85_not_point_85 asserts isinstance(int) |
| D-03: 5-class classifier keyword sets | CLASSIFICATION_KEYWORDS dict in transfer_news.py | Lines 55-60; confirmed_signing/rumour/injury_return/rotation_signal; general is catch-all |
| D-05: transfer_news runs year-round outside IS_OFF_SEASON | Placement in run.py before gate block | Lines 163-168 (transfer_news) before line 202 (IS_OFF_SEASON gate) |
| D-06: Detection expression and skip-log format locked | Grep assertions and contract tests | Exact expression at run.py line 148; 12 verbatim skip-log lines; test_run_offseason.py tests all 12 steps |
| D-07: 6h staleTime, no select transform | useTransferNews.ts | `staleTime: 6 * 60 * 60 * 1000`; no `select:` key present |
| D-08: Route Handler reads Blob, returns JSON directly (no transform) | route.ts structural copy | Identical to lineup-news handler with 4 targeted substitutions; no transform added |

---

## Human Verification Required

None — all must-haves are verified programmatically from source code. The phase produces no UI (per the phase plan: "Zero UI in this phase"). The TanStack hook and Route Handler are consumed by Phase 125 (Summer Window Tracker), which will require human UAT.

---

## Gaps Summary

No gaps. All 5 roadmap success criteria are verified in the codebase. All 6 requirement IDs (SCR-01 through SCR-05, WIN-03) are satisfied by artifacts that exist, are substantive, and are correctly wired together.

---

_Verified: 2026-05-18_
_Verifier: Claude (gsd-verifier)_
