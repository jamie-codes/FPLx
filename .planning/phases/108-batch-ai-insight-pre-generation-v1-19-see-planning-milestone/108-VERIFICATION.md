---
phase: 108-batch-ai-insight-pre-generation
verified: 2026-05-14T12:39:00Z
status: passed
score: 3/3 success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/3
  gaps_closed:
    - "User can click 'Get AI insight' on a top-20 player after a successful batch run and see the insight render within 200ms with zero new Claude spend — usePlayerInsight hits the Blob via the existing read path with no UI change required (ROADMAP SC3 / NLP-BATCH-03)"
  gaps_remaining: []
  regressions: []
---

# Phase 108: Batch AI Insight Pre-Generation — Verification Report

**Phase Goal:** Pre-generate AI insights for the top-20 players via a daily pipeline batch step so that the existing two-tier cache finds a Blob hit on first interaction, reducing perceived latency from ~2–6s to ~50–150ms.
**Verified:** 2026-05-14T12:39:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 03 closed the NLP-BATCH-03 blocker)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | After a daily pipeline run with `INSIGHT_BATCH_ENABLED=true`, Vercel Blob contains insight files at `player_insights/gw{N}/element_{id}.json` for each of the top 20 players by `xPts_1gw`, written with `addRandomSuffix: false` and `allowOverwrite: true` | ✓ VERIFIED | `pipeline/batch_insights.py` line 192: `blob_key = f'player_insights/gw{int(gameweek)}/element_{int(player["id"])}.json'`; calls `save(blob_key, result)`. `pipeline/run.py` lines 401–416 gate the top-20 selection behind `INSIGHT_BATCH_ENABLED='true'`. All 10 unit tests pass (pytest 10/10). Confirmed unchanged from prior verification. |
| 2 | With `INSIGHT_BATCH_ENABLED=false` (or unset), the daily pipeline runs to completion without any Anthropic API calls — the batch step is isolated in a try/except block so a batch failure cannot break the rest of the pipeline | ✓ VERIFIED | `run.py` line 401: `os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'` — strict equality guard. Import inside guard. `except Exception` swallows all errors; `last_updated.json` write at line 435 is outside the batch block. 6 batch_block tests pass (pytest 6/6). Confirmed unchanged from prior verification. |
| 3 | User can click "Get AI insight" on a top-20 player and see the insight render within 200ms with zero new Claude spend — `usePlayerInsight` hits the Blob via the existing read path with no UI change required | ✓ VERIFIED | **NEW in Plan 03:** `src/app/api/player-insight/route.ts` lines 167–188 contain a Blob read-before-generate block. On cache hit: `list({ prefix: cacheKey, limit: 1 })` then `fetch(blobs[0].url)` returns cached JSON with zero Anthropic constructor calls. On miss/error: falls through to Anthropic generation unchanged. gated by `isUseBlob()`. All 16 vitest tests pass (including 4 new: cache-hit, cache-miss, USE_BLOB=false, fetch-error-fallthrough). Cache-hit test asserts `expect(Anthropic).toHaveBeenCalledTimes(0)`. `usePlayerInsight.ts` is unchanged (git diff empty). Byte-equivalent key template confirmed: `grep -c "player_insights/gw${body.gw}/element_${body.player.id}.json" route.ts` = 2 (read + write). |

**Score:** 3/3 success criteria verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| NLP-BATCH-01 | 108-01-PLAN.md | Pipeline pre-generates insights for top 20 players and writes to Vercel Blob | ✓ SATISFIED | `generate_batch_insights(players, corpus, gameweek) -> dict` exports correct signature (line 164); writes `player_insights/gw{N}/element_{id}.json` via `save()`; all 10 unit tests pass; commit ff52edb (RED) + 58204a4 (GREEN) verified in git log |
| NLP-BATCH-02 | 108-02-PLAN.md | Batch generation gated by `INSIGHT_BATCH_ENABLED` env var | ✓ SATISFIED | Single `INSIGHT_BATCH_ENABLED` guard at run.py line 401; strict `.lower() == 'true'`; batch fully skipped when unset/false; `BATCH_TOP_N = 20` greppable constant; 6 integration tests pass; commits 3a7ebae (RED) + b0eb58d (GREEN) verified |
| NLP-BATCH-03 | 108-02-PLAN.md + 108-03-PLAN.md | UI reads Blob-cached insights transparently — on-demand generation fires only on cache miss | ✓ SATISFIED | **Closed by Plan 03.** Blob read-before-generate block at route.ts lines 167–188 reads from the identical namespace (`player_insights/gw${body.gw}/element_${body.player.id}.json`) written by the batch. Cache hit returns pre-generated JSON with zero Anthropic calls. Cache miss / USE_BLOB=false / fetch-error all fall through to generation unchanged. `usePlayerInsight.ts` unchanged. 16/16 vitest tests pass. Commits 2b984fa (RED) + 50e1773 (GREEN) verified. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `pipeline/batch_insights.py` | Batch insight generation module | ✓ VERIFIED | 201 LOC; exports `generate_batch_insights(players, corpus, gameweek) -> dict`; all required functions present (`_normalize`, `_passes_guardrail`, `_xml_escape`, `_build_xml_context`, `_build_system_prompt`, `_generate_one`); `from upload import save` at line 33 |
| `pipeline/tests/test_batch_insights.py` | 10 unit tests with mocked SDK | ✓ VERIFIED | 10 tests, all passing; covers API key missing, SDK missing, successful writes, guardrail failure, retry-then-pass, RateLimitError skip, APIError skip, cache_control ephemeral, None-field omission, save() abstraction |
| `pipeline/run.py` | Pipeline orchestration with INSIGHT_BATCH_ENABLED gate | ✓ VERIFIED | Batch block at lines 397–416 (21 lines); `BATCH_TOP_N = 20`; tuple sort key `(xPts_1gw, selected_by_percent)` descending; non-fatal `try/except Exception` |
| `pipeline/tests/test_run.py` | 6 new batch_block integration tests | ✓ VERIFIED | 6 tests appended; source-code contract style; all passing |
| `src/app/api/player-insight/route.ts` | POST handler with Blob read-before-generate cache path | ✓ VERIFIED | Cache block at lines 167–188; `isUseBlob()` guard; `list({ prefix: cacheKey, limit: 1 })`; hit/miss/error log branches present; try/catch wraps entire read; falls through to Anthropic on miss/error |
| `src/app/api/player-insight/route.test.ts` | 4 new vitest tests covering cache code paths | ✓ VERIFIED | Tests A–D appended (cache hit, cache miss, USE_BLOB=false skip, fetch-error fallthrough); all 4 pass; all 12 pre-existing tests still pass; total 16/16 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/batch_insights.py` | `pipeline/upload.py:save` | `from upload import save` | ✓ WIRED | Line 33; `save(blob_key, result)` at line 193; USE_BLOB gate intact |
| `pipeline/batch_insights.py` | Anthropic SDK | SDK import guard | ✓ WIRED | `try: from anthropic import Anthropic, APIError, RateLimitError` with None sentinels (lines 26–31) |
| `pipeline/batch_insights.py` | `cache_control: ephemeral` | `system = [{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}]` | ✓ WIRED | Line 123; list-of-blocks pattern per D-07/D-08 |
| `pipeline/run.py` | `generate_batch_insights` | `from batch_insights import generate_batch_insights` inside guard | ✓ WIRED | Line 403; after prose_summary block; before last_updated write |
| `pipeline/run.py` | `INSIGHT_BATCH_ENABLED` env var | `os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'` | ✓ WIRED | Line 401; strict equality; single reference (count == 1) |
| `pipeline/batch_insights.py` (Blob write) | `src/app/api/player-insight/route.ts` (Blob read) | Identical key namespace `player_insights/gw{N}/element_{id}.json` | ✓ WIRED | **CLOSED BY PLAN 03.** Route line 171 reads `player_insights/gw${body.gw}/element_${body.player.id}.json`; batch writes `f'player_insights/gw{int(gameweek)}/element_{int(player["id"])}.json'`. Byte-equivalent templates. `grep -c` returns 2 for the key template in route.ts (read + write). |
| `src/app/api/player-insight/route.ts` (Blob read) | `isUseBlob()` guard | Cache read only attempted when `isUseBlob()` returns true | ✓ WIRED | Line 170: `if (isUseBlob()) {` — reuses existing helper; local dev path unchanged when USE_BLOB=false |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/app/api/player-insight/route.ts` | `cached` (cache hit path) | `list({ prefix: cacheKey, limit: 1 })` → `fetch(blobs[0].url)` → `cachedRes.json()` | Blob written by `generate_batch_insights` contains `{prose, player_id, gw, generated_at}` from Anthropic generation | ✓ FLOWING — real data path from Blob to response; test asserts returned body equals batch-written JSON exactly |
| `pipeline/batch_insights.py` | `result` per player | `client.messages.create(...)` → `msg.content[0].text` → guardrail → `save()` | Real Anthropic API call (mocked in tests); writes to Blob via `save()` | ✓ FLOWING — 10 unit tests validate the full data path with mocked SDK |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 10 unit tests for batch_insights.py pass | `python -m pytest pipeline/tests/test_batch_insights.py -v` | 10 passed in 0.04s | ✓ PASS |
| 6 batch_block integration tests pass | `python -m pytest pipeline/tests/test_run.py -k "batch_block" -v` | 6 passed in 0.03s | ✓ PASS |
| Full pipeline test suite (224 tests) | `python -m pytest pipeline/tests/ -x -q` | 224 passed in 0.41s | ✓ PASS |
| 16 vitest tests for route.test.ts pass (10 pre-existing + 4 new) | `npx vitest run src/app/api/player-insight/route.test.ts` | 16 passed in 247ms | ✓ PASS |
| Cache-hit test asserts zero Anthropic constructor calls | vitest cache-hit test assertion | `expect(Anthropic).toHaveBeenCalledTimes(0)` passes | ✓ PASS |
| TypeScript compiles cleanly for route.ts | `npx tsc --noEmit -p tsconfig.json 2>&1 grep route.ts` | No error lines | ✓ PASS |
| Blob read key template appears twice in route.ts | `grep -c 'player_insights/gw${body.gw}/element_${body.player.id}.json' route.ts` | 2 (read line 171 + write line 234) | ✓ PASS |
| All 6 committed SHAs exist in git log | `git log --oneline ff52edb 58204a4 3a7ebae b0eb58d 2b984fa 50e1773` | All 6 present | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/batch_insights.py` | — | `vercel_blob` never called directly | ℹ Info | Correct — `save()` abstraction used per D-09 |
| `pipeline/batch_insights.py` | — | `INSIGHT_BATCH_ENABLED` absent (count == 0) | ℹ Info | Correct — caller's gate, not module's |
| `pipeline/run.py` | — | `ANTHROPIC_API_KEY` never printed | ℹ Info | Security criterion met |
| `src/app/api/player-insight/route.ts` | — | No `process.env` or `apiKey` in any log statement | ℹ Info | Security invariant T-108-09 met |

No blockers from anti-pattern scan.

### Human Verification Required

None required for automated correctness verification. The following item is noted for optional production smoke-test validation but does NOT block the verification status:

**Optional (not blocking):** Manual cache-hit latency measurement in production — confirm pre-generated insight serves in ~50–150ms vs ~2–6s. This cannot be verified programmatically without a running server and a populated Blob. All code-level evidence (tests, implementation, data-flow) confirms the path exists and functions correctly.

---

## Re-verification Summary

**Gap from previous run:** `route.ts` had no Blob read path; batch-written Blobs were never served to users.

**Resolution by Plan 03:** Inserted a 22-line Blob read-before-generate block (lines 167–188) between the corpus guard and Anthropic client construction. The block:
1. Checks `isUseBlob()` — skips in local dev (USE_BLOB=false)
2. Calls `list({ prefix: cacheKey, limit: 1 })` on the exact batch-written key namespace
3. On hit: fetches the cached JSON and returns `Response.json(cached, { status: 200 })` — zero Anthropic calls
4. On miss (empty blobs[]): falls through to Anthropic generation unchanged
5. On any error (network/fetch rejection): catches, logs `[player-insight] blob-cache error`, falls through — never fails the user request

All 3 must-have truths now verified. All 3 requirements (NLP-BATCH-01, NLP-BATCH-02, NLP-BATCH-03) satisfied. No regressions introduced (224 pipeline tests, 16 vitest tests all pass).

---

_Verified: 2026-05-14T12:39:00Z_
_Verifier: Claude (gsd-verifier)_
