---
phase: 117
plan: 01
subsystem: pipeline
tags:
  - python
  - pipeline
  - scraper
  - feedparser
  - beautifulsoup
  - fpl
  - tdd
dependency_graph:
  requires:
    - pipeline/upload.py (save function)
    - pipeline/run.py (insertion point after fpl_bootstrap.json)
  provides:
    - pipeline/lineup_news.py (compute_lineup_news public API)
    - pipeline/cache/lineup_news.json (artifact)
  affects:
    - pipeline/run.py (non-fatal block added)
tech_stack:
  added:
    - feedparser>=6.0.12 (RSS parsing for Sky Sports, BBC Sport)
    - beautifulsoup4>=4.14.3 (HTML scraping for premierleague.com)
    - lxml>=6.1.0 (BS4 parser backend)
  patterns:
    - TDD RED/GREEN cycle (7 tests written before implementation)
    - Per-source isolation (separate try/except per web source)
    - Non-fatal pipeline block (set_piece_quality pattern from run.py ~line 241)
    - SCRP-05 empty guard (if not players: return before save())
key_files:
  created:
    - pipeline/lineup_news.py
    - pipeline/test_lineup_news.py
  modified:
    - pipeline/requirements.txt (3 new dependency pins)
    - pipeline/run.py (7-line non-fatal block after line 142)
decisions:
  - "D-08/D-09: chance_of_playing_next_round wins over status='a' — implemented via chance-first check before status fallback"
  - "D-10: unrecognised status codes return (None, 'unknown') — forward-compatible defensive handling"
  - "Pitfall 4 (RESEARCH.md): chance==100 handled explicitly as (1.0, confirmed_start)"
  - "Pitfall 2 (RESEARCH.md): no blanket try/except in compute_lineup_news — outer wrapper is run.py only"
  - "SCRP-05 guard: if not players: return placed before save() call — also protects local cache"
metrics:
  duration: ~4 minutes
  completed: 2026-05-17
  tasks_completed: 3
  files_changed: 4
---

# Phase 117 Plan 01: Python Pipeline — lineup_news.py module + run.py integration + tests Summary

**One-liner:** Python pipeline module deriving per-player FPL availability + optional RSS/HTML news enrichment, written to lineup_news.json via the established set_piece_quality non-fatal isolation pattern.

## What Was Built

Three tasks delivered the Python pipeline half of Phase 117:

**Task 0 (RED gate):** `pipeline/test_lineup_news.py` with 7 pytest functions covering all D-08 mapping rows, D-09 chance precedence, D-10 unknown status, Pitfall 4 (chance==100), SCRP-05 empty guard, SCRP-06 source_health structure, and RSS failure isolation. All 7 failed with `ModuleNotFoundError` before implementation. `pipeline/requirements.txt` extended with `feedparser>=6.0.12`, `beautifulsoup4>=4.14.3`, `lxml>=6.1.0`.

**Task 1 (GREEN gate):** `pipeline/lineup_news.py` with one public function (`compute_lineup_news`) and 8 private helpers (`_now_iso`, `_compute_availability`, `_scrape_fpl`, `_build_name_lookup`, `_match_player`, `_scrape_premierleague`, `_scrape_rss_sky`, `_scrape_rss_bbc`). All 7 tests pass. Key invariants: FPL bootstrap is authoritative for availability_factor (D-03); web scrapers set news_headline/news_source only; `if not players: return` guard (SCRP-05); per-source try/except with no top-level blanket catch (Pitfall 2); source_health tracks ok/last_success/last_error for all 4 sources (SCRP-06).

**Task 2:** `pipeline/run.py` — 7-line non-fatal block inserted immediately after `save('fpl_bootstrap.json', bootstrap)` at line 142, matching the set_piece_quality isolation pattern. Lazy import (`from lineup_news import compute_lineup_news`) inside try/except, exception logged to stderr as `[lineup_news] non-fatal error`.

**Smoke test result:** 832 players written to `pipeline/cache/lineup_news.json`, all 4 sources reporting `ok=True` (fpl, premierleague, skysports, bbc).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Write failing tests (RED gate) | 213a96f | pipeline/test_lineup_news.py, pipeline/requirements.txt |
| 1 | Implement lineup_news.py (GREEN gate) | a4d5c09 | pipeline/lineup_news.py |
| 2 | Integrate into run.py | 8d1af21 | pipeline/run.py |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] feedparser not installed in test environment**
- **Found during:** Task 1 (first GREEN gate attempt)
- **Issue:** `ModuleNotFoundError: No module named 'feedparser'` — feedparser was in requirements.txt but not installed in local venv
- **Fix:** `pip install feedparser beautifulsoup4>=4.14.3 lxml>=6.1.0` — all three now installed; stray `=4.14.3` `=6.0.12` `=6.1.0` files created by pip syntax confusion removed from repo root
- **Files modified:** None (runtime install, no code change)

## Known Stubs

None — all fields are wired. `news_headline` and `news_source` are legitimately `null` for players with no scraped match (by design, not a stub).

## Threat Flags

No new threat surface beyond what the threat model in the plan already documented. The ASVS L1 controls are implemented:
- V5: BS4 `get_text(strip=True)` extracts text only; headlines truncated to 280 chars; errors truncated to 200 chars
- DoS: `REQUEST_TIMEOUT=10` on all `requests.get()` calls
- SCRP-05: empty guard prevents overwriting Blob with empty data

## Self-Check: PASSED

| Item | Status |
|------|--------|
| pipeline/lineup_news.py | FOUND |
| pipeline/test_lineup_news.py | FOUND |
| pipeline/requirements.txt (3 new lines) | FOUND |
| .planning/phases/117-.../117-01-SUMMARY.md | FOUND |
| commit 213a96f (RED gate) | FOUND |
| commit a4d5c09 (GREEN gate) | FOUND |
| commit 8d1af21 (run.py integration) | FOUND |
| All 7 pytest tests passing | VERIFIED |
