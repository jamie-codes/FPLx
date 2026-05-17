---
phase: 117
slug: scraper-pipeline-lineup-news-artifact
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 117 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing) |
| **Config file** | none — Wave 0 creates `pipeline/test_lineup_news.py` |
| **Quick run command** | `python -m pytest pipeline/test_lineup_news.py -x` |
| **Full suite command** | `python -m pytest pipeline/ -x` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest pipeline/test_lineup_news.py -x`
- **After every plan wave:** Run `python -m pytest pipeline/ -x`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 117-01-01 | 01 | 1 | SCRP-01 | — | availability_factor derived correctly from FPL bootstrap | unit | `python -m pytest pipeline/test_lineup_news.py::test_fpl_mapping -x` | ❌ W0 | ⬜ pending |
| 117-01-02 | 01 | 1 | SCRP-01 | — | status_label correct for all D-08 mapping cases | unit | `python -m pytest pipeline/test_lineup_news.py::test_status_label_mapping -x` | ❌ W0 | ⬜ pending |
| 117-01-03 | 01 | 1 | SCRP-05 | — | empty players[] guard prevents Blob write | unit (mock save) | `python -m pytest pipeline/test_lineup_news.py::test_empty_guard -x` | ❌ W0 | ⬜ pending |
| 117-01-04 | 01 | 1 | SCRP-06 | — | source_health tracks ok/last_success/last_error per source | unit | `python -m pytest pipeline/test_lineup_news.py::test_source_health -x` | ❌ W0 | ⬜ pending |
| 117-02-01 | 02 | 1 | SCRP-02 | T: malformed HTML response injection | BS4 get_text extracts text only, no HTML stored | unit | `python -m pytest pipeline/test_lineup_news.py -x -k premierleague` | ❌ W0 | ⬜ pending |
| 117-02-02 | 02 | 1 | SCRP-03 | T: malformed RSS content injected into headlines | feedparser sanitises entry.title; raw string stored only | unit | `python -m pytest pipeline/test_lineup_news.py -x -k skysports` | ❌ W0 | ⬜ pending |
| 117-02-03 | 02 | 1 | SCRP-04 | T: malformed RSS content | feedparser sanitises entry.title | unit | `python -m pytest pipeline/test_lineup_news.py -x -k bbc` | ❌ W0 | ⬜ pending |
| 117-02-04 | 02 | 2 | INFRA-01 | — | GET /api/lineup-news returns 200 with valid JSON | smoke | `curl -s http://localhost:3000/api/lineup-news \| python -m json.tool` | ❌ W0 | ⬜ pending |
| 117-02-05 | 02 | 2 | INFRA-02 | — | scraped_at field present in artifact | unit | Check JSON key in test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/test_lineup_news.py` — stubs for SCRP-01 (fpl_mapping, status_label_mapping), SCRP-05 (empty_guard), SCRP-06 (source_health), scraper isolation tests (premierleague, skysports, bbc)
- [ ] Mock bootstrap fixture with known status/chance_of_playing combinations covering all D-08 rows
- [ ] feedparser, beautifulsoup4, lxml — confirm in `pipeline/requirements.txt` before test run

*No existing test infrastructure for lineup_news.py — must create.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| premierleague.com source_health.ok = False in deployed pipeline | SCRP-02 | JS-rendered page, cannot automate live scrape in CI | After deployment, inspect lineup_news.json Blob artifact: `source_health.premierleague.ok` should be `false` and `last_error` should be non-null |
| Blob artifact preserves previous valid data when pipeline fails | SCRP-05 | Requires actual Blob state with prior data | Manually verify that running with USE_BLOB=1 and forced scraper failure does not overwrite a valid prior lineup_news.json |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
