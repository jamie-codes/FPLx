---
phase: 108-batch-ai-insight-pre-generation
verified: 2026-05-14T11:04:32Z
status: gaps_found
score: 2/3 success criteria verified
overrides_applied: 0
gaps:
  - truth: "User can click 'Get AI insight' on a top-20 player after a successful batch run and see the insight render within 200ms with zero new Claude spend — usePlayerInsight hits the Blob via the existing read path with no UI change required (ROADMAP SC3 / NLP-BATCH-03 literal wording)"
    status: failed
    reason: "The on-demand route (/api/player-insight/route.ts) has NO Blob read path. It always generates live via Anthropic, then writes to Blob (fire-and-forget). The batch pre-populates Blob at player_insights/gw{N}/element_{id}.json, but nothing in the UI or API ever reads from that namespace. usePlayerInsight calls /api/player-insight; the route does not check Blob before generating. The pre-generated Blob values are never served to users — they simply sit in Blob and get overwritten by the next on-demand generation. The ~50–150ms latency goal cannot be achieved without a Blob read-before-generate code path in route.ts."
    artifacts:
      - path: "src/app/api/player-insight/route.ts"
        issue: "Route imports `list` and `put` from @vercel/blob but uses `list` only to read merged_players.json (corpus). There is no `list` or `fetch` call on the `player_insights/gw*` namespace — the route always calls Anthropic and writes to Blob, never reads from Blob first."
      - path: "src/lib/hooks/usePlayerInsight.ts"
        issue: "Hook calls /api/player-insight (live generation). readCachedInsight reads localStorage only. No Blob read path exists in the hook or the route it calls."
    missing:
      - "A Blob read-before-generate step in /api/player-insight/route.ts: check `player_insights/gw{body.gw}/element_{body.player.id}.json` exists in Blob; if found, return the cached JSON body directly (the fast path the phase goal depends on). Only fall through to Anthropic generation on cache miss."
      - "Alternatively, a new API endpoint or middleware layer that serves pre-generated insights from Blob, bypassing the Anthropic call path entirely."
---

# Phase 108: Batch AI Insight Pre-Generation — Verification Report

**Phase Goal:** Pre-generate AI insights for the top-20 players via a daily pipeline batch step so that the existing two-tier cache finds a Blob hit on first interaction, reducing perceived latency from ~2–6s to ~50–150ms.
**Verified:** 2026-05-14T11:04:32Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | After a daily pipeline run with `INSIGHT_BATCH_ENABLED=true`, Vercel Blob contains insight files at `player_insights/gw{N}/element_{id}.json` for each of the top 20 players by `xPts_1gw`, written with `addRandomSuffix: false` and `allowOverwrite: true` | ✓ VERIFIED | `pipeline/batch_insights.py` line 192: `blob_key = f'player_insights/gw{int(gameweek)}/element_{int(player["id"])}.json'`; calls `save(blob_key, result)` → `upload_json` → `vercel_blob.put` with `allowOverwrite: True`. `pipeline/run.py` lines 401–416 gate the top-20 selection behind `INSIGHT_BATCH_ENABLED='true'`. All 10 unit tests pass, 6 run.py integration tests pass, 224 total pipeline tests pass. |
| 2 | With `INSIGHT_BATCH_ENABLED=false` (or unset), the daily pipeline runs to completion without any Anthropic API calls — the batch step is isolated in a try/except block so a batch failure cannot break the rest of the pipeline | ✓ VERIFIED | `run.py` line 401: `if os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true':` — strict equality, only exact 'true' activates. Import is inside the guard. `except Exception` swallows all errors; `last_updated.json` write at line 435 is outside and after the batch block. Tests `test_batch_block_skipped_when_env_unset`, `test_batch_block_skipped_when_env_false`, and `test_batch_block_swallows_exception` all pass. |
| 3 | User can click "Get AI insight" on a top-20 player and see the insight render within 200ms with zero new Claude spend — `usePlayerInsight` hits the Blob via the existing read path with no UI change required | ✗ FAILED | `src/app/api/player-insight/route.ts` has NO Blob read path. It imports `list` and `put` from `@vercel/blob` but uses `list` only to read `merged_players.json`. The route always calls Anthropic and writes to Blob after success — it never reads from the `player_insights/gw*` namespace. `usePlayerInsight` hook calls `/api/player-insight`, which triggers a live Anthropic call every time (even if Blob contains a pre-generated insight). The ~50–150ms latency goal is not achievable with the current code. |

**Score:** 2/3 success criteria verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| NLP-BATCH-01 | 108-01-PLAN.md | Pipeline pre-generates insights for top 20 players and writes to Vercel Blob | ✓ SATISFIED | `generate_batch_insights()` exists, exports correct signature, writes to correct Blob namespace, all 10 unit tests pass |
| NLP-BATCH-02 | 108-02-PLAN.md | Batch generation gated by `INSIGHT_BATCH_ENABLED` env var | ✓ SATISFIED | Single `INSIGHT_BATCH_ENABLED` guard in `run.py`; strict `.lower() == 'true'` check; batch fully skipped when unset/false |
| NLP-BATCH-03 | 108-02-PLAN.md | UI reads Blob-cached insights transparently | ✗ BLOCKED | Namespace alignment exists (batch writes same key the route writes) but there is no Blob READ path. The route always generates live. The "transparent read" described in the requirement does not exist in code. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `pipeline/batch_insights.py` | Batch insight generation module | ✓ VERIFIED | 200 LOC; exports `generate_batch_insights(players, corpus, gameweek) -> dict`; all required functions present |
| `pipeline/tests/test_batch_insights.py` | 10 unit tests with mocked SDK | ✓ VERIFIED | 10 tests, all passing; covers API key missing, SDK missing, successful writes, guardrail failure, retry, RateLimitError, APIError, cache_control ephemeral, None-field omission, save() abstraction |
| `pipeline/run.py` | Pipeline orchestration with INSIGHT_BATCH_ENABLED gate | ✓ VERIFIED | Batch block at lines 397–416; BATCH_TOP_N=20; tuple sort key; non-fatal try/except |
| `pipeline/tests/test_run.py` | 6 new batch_block integration tests | ✓ VERIFIED | 6 tests appended; source-code contract style; all passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/batch_insights.py` | `pipeline/upload.py:save` | `from upload import save` | ✓ WIRED | Line 33; `save(blob_key, result)` at line 193; USE_BLOB gate intact |
| `pipeline/batch_insights.py` | Anthropic SDK | SDK import guard | ✓ WIRED | `try: from anthropic import Anthropic, APIError, RateLimitError` with None sentinels |
| `pipeline/batch_insights.py` | `cache_control: ephemeral` | `system = [{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}]` | ✓ WIRED | Line 123; matches D-07/D-08 pattern from Phase 107 |
| `pipeline/run.py` | `generate_batch_insights` | `from batch_insights import generate_batch_insights` inside guard | ✓ WIRED | Line 403; after prose_summary block (line 354); before last_updated write (line 435) |
| `pipeline/run.py` | `INSIGHT_BATCH_ENABLED` env var | `os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'` | ✓ WIRED | Line 401; strict equality; single reference (count == 1 confirmed) |
| `pipeline/batch_insights.py` (Blob write) | `src/app/api/player-insight/route.ts` (Blob read) | Identical key namespace `player_insights/gw{N}/element_{id}.json` | ✗ NOT_WIRED | Namespace byte-equivalence confirmed. However the route.ts has NO read-from-Blob path — it only writes. Pre-generated Blob values are never served. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `usePlayerInsight.ts` | insight state | `/api/player-insight` POST → Anthropic | Always generates live; Blob pre-populated by batch is never read | ✗ HOLLOW — batch writes Blob but no read path exists in the serving layer |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 10 unit tests for batch_insights.py pass | `python -m pytest pipeline/tests/test_batch_insights.py -v` | 10 passed in 0.04s | ✓ PASS |
| 6 batch_block integration tests pass | `python -m pytest pipeline/tests/test_run.py -k "batch_block" -v` | 6 passed in 0.03s | ✓ PASS |
| Full pipeline test suite (224 tests) | `python -m pytest pipeline/tests/ -x -q` | 224 passed in 0.42s | ✓ PASS |
| AST syntax check: batch_insights.py | `python -c "import ast; ast.parse(open('pipeline/batch_insights.py').read())"` | parsed ok | ✓ PASS |
| AST syntax check: run.py | `python -c "import ast; ast.parse(open('pipeline/run.py').read())"` | parsed ok | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline/batch_insights.py` | — | `vercel_blob` never called directly | ℹ Info | Correct — `save()` abstraction used per D-09 |
| `pipeline/batch_insights.py` | — | `INSIGHT_BATCH_ENABLED` absent (count == 0) | ℹ Info | Correct — caller's gate, not module's |
| `pipeline/run.py` | — | `ANTHROPIC_API_KEY` never printed | ℹ Info | Security criterion met; `grep -E "print.*api_key"` returns no matches |

No blockers from anti-pattern scan.

### Human Verification Required

None required — the gap is definitively observable in code without human testing.

---

## Gaps Summary

**1 BLOCKER: Blob read path missing in /api/player-insight**

The phase goal's core latency promise — "reducing perceived latency from ~2–6s to ~50–150ms" — depends on the API route returning pre-generated insights from Blob instead of calling Anthropic. This read path does not exist.

**What was built:** The pipeline correctly batch-generates insights and writes them to `player_insights/gw{N}/element_{id}.json` in Vercel Blob. The `INSIGHT_BATCH_ENABLED` gate, top-20 selection, non-fatal isolation, and all 224 tests are correct.

**What is missing:** A read-before-generate path in `src/app/api/player-insight/route.ts`. Without it:
- The user clicks "Get AI insight" and `/api/player-insight` is called
- The route always calls Anthropic (2–6s)
- After generation, it writes to Blob (same key the batch already wrote)
- The batch-pre-generated Blob value is never returned to the user

**Root cause:** The ROADMAP SC3 states "usePlayerInsight hits the Blob via the existing read path" — but this read path was never implemented in Phase 105 (the phase that created the namespace). The CONTEXT document incorrectly described the existing cache as "localStorage → Blob → live API" when the actual implementation is "localStorage → live API (writes to Blob)".

**Fix required:** Add a Blob read check at the start of the `/api/player-insight` POST handler. After validation and before the Anthropic call:
```typescript
if (isUseBlob()) {
  const blobKey = `player_insights/gw${body.gw}/element_${body.player.id}.json`
  // list() or head() to check existence, then fetch URL if found
  // Return cached body directly — zero Claude spend, ~50–150ms
}
```
This is a UI/route change (~10 lines) that would fully satisfy SC3 and NLP-BATCH-03.

**This looks intentional.** To accept this deviation (if the latency goal is being deferred to a follow-on phase), add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "User can click Get AI insight on a top-20 player after a successful batch run and see the insight render within 200ms with zero new Claude spend"
    reason: "Blob READ path will be added to route.ts in a follow-on phase; Phase 108 delivers only the write side. The latency goal is deferred but the infrastructure (Blob namespace, batch generation, gate) is complete."
    accepted_by: "your-username"
    accepted_at: "2026-05-14T11:04:32Z"
```

---

_Verified: 2026-05-14T11:04:32Z_
_Verifier: Claude (gsd-verifier)_
