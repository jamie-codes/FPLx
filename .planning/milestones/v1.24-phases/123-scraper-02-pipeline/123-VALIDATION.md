---
phase: 123
slug: scraper-02-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 123 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (pipeline Python) + vitest (TypeScript) |
| **Config file** | `pipeline/pytest.ini` or `pytest.cfg` / `vitest.config.ts` |
| **Quick run command** | `cd pipeline && python -m pytest tests/test_transfer_news.py tests/test_player_matching.py -x -q` |
| **Full suite command** | `cd pipeline && python -m pytest tests/ -q && cd .. && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pipeline && python -m pytest tests/test_transfer_news.py tests/test_player_matching.py -x -q`
- **After every plan wave:** Run `cd pipeline && python -m pytest tests/ -q && cd .. && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 123-01-01 | 01 | 1 | SCR-01/02/05 | — | N/A | unit | `cd pipeline && python -m pytest tests/test_player_matching.py tests/test_transfer_news.py --collect-only -q` | ❌ W0 | ⬜ pending |
| 123-01-02 | 01 | 1 | SCR-02 | — | N/A | unit | `cd pipeline && python -m pytest tests/test_player_matching.py -x -q` | ❌ W0 | ⬜ pending |
| 123-01-03 | 01 | 1 | SCR-01/03/05 | T-123-01/02 | Truncate title≤280, summary≤500; skip empty artifact save | unit | `cd pipeline && python -m pytest tests/test_transfer_news.py -x -q` | ❌ W0 | ⬜ pending |
| 123-01-04 | 01 | 1 | SCR-02 | — | N/A | unit | `cd pipeline && python -m pytest tests/test_lineup_news.py -x -q` | ✅ exists | ⬜ pending |
| 123-02-01 | 02 | 2 | SCR-04 | — | N/A | type | `npx tsc --noEmit` | ✅ exists | ⬜ pending |
| 123-02-02 | 02 | 2 | SCR-04 | T-123-06/07/08 | Fixed error strings; Cache-Control header | type+lint | `npx tsc --noEmit && npx eslint src/app/api/transfer-news/route.ts` | ❌ W0 | ⬜ pending |
| 123-02-03 | 02 | 2 | SCR-04 | — | N/A | unit | `npx vitest run src/lib/hooks/useTransferNews.test.ts` | ❌ W0 | ⬜ pending |
| 123-03-01 | 03 | 2 | WIN-03 | T-123-09/11 | Detection expression locked; skip-log format locked | unit | `cd pipeline && python -m pytest tests/test_run_offseason.py -x -q` | ❌ W0 | ⬜ pending |
| 123-03-02 | 03 | 2 | WIN-03/SCR-01/05 | T-123-09/10 | IS_OFF_SEASON gate wraps GW steps; transfer_news outside gate | unit+syntax | `cd pipeline && python -m pytest tests/test_run_offseason.py tests/test_run.py -x -q && python -c "import ast; ast.parse(open('pipeline/run.py').read())"` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pipeline/tests/test_player_matching.py` — stubs for player_matching.py (SCR-02); created by Plan 01 Task 01
- [ ] `pipeline/tests/test_transfer_news.py` — stubs for transfer_news.py (SCR-01/03/05); created by Plan 01 Task 01
- [ ] `pipeline/tests/test_run_offseason.py` — IS_OFF_SEASON gate stubs (WIN-03); created by Plan 03 Task 01
- [ ] `rapidfuzz>=3.0.0` added to `pipeline/requirements.txt`; `src/lib/hooks/useTransferNews.test.ts` created by Plan 02 Task 03

*Plan 01 Task 01 and Plan 03 Task 01 are the Wave 0 setup tasks. Implementation (Tasks 02, 03, 04 in Plan 01; Tasks 02 in Plans 02/03) runs after Wave 0 is complete.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel Blob write in staging | SCR-03 | Requires live Vercel env + BLOB_READ_WRITE_TOKEN | Run `python pipeline/run.py` in staging; verify Blob key `transfer_news.json` is updated |
| RSS feed live article classification | SCR-01 | Requires live network access to Sky/BBC feeds | Run `python -c "from transfer_news import scrape; import json; print(json.dumps(scrape()[:3], indent=2))"` and verify classification fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
