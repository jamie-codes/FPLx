---
phase: 108-batch-ai-insight-pre-generation-v1-19-see-planning-milestone
reviewed: 2026-05-14T12:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pipeline/batch_insights.py
  - pipeline/run.py
  - pipeline/tests/test_batch_insights.py
  - pipeline/tests/test_run.py
  - src/app/api/player-insight/route.ts
  - src/app/api/player-insight/route.test.ts
findings:
  critical: 5
  warning: 5
  info: 3
  total: 13
status: issues_found
---

# Phase 108: Code Review Report

**Reviewed:** 2026-05-14T12:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 108 adds batch AI insight pre-generation (`batch_insights.py`), wires it into the pipeline via an env-var gate in `run.py`, and adds a Blob read-before-generate cache path to the existing on-demand route (`route.ts`). The structural design is consistent with established pipeline conventions. Five blocking defects were found: the `save()` call in `batch_insights.py` is outside any try/except, so a single Blob write failure aborts all remaining players; bare dict key access on `player['web_name']` before the try block propagates a `KeyError` up to abort the entire batch run; `save_local()` in `upload.py` does not create nested subdirectories, causing every local-mode batch write to fail with `FileNotFoundError`; the Vercel Blob `list()` prefix search for the cache-hit path in `route.ts` can match adjacent player IDs (e.g., `element_1.json` matches `element_10.json`, `element_100.json`) and return the wrong player's insight; and the model ID constant uses an undocumented date suffix that is likely invalid. Five warnings and three info items covering logging correctness, silent divergence risk in a duplicated guardrail, test fragility with the real SDK, and dead flag variables are also documented.

## Critical Issues

### CR-01: `save()` outside try/except aborts entire batch on any Blob write failure

**File:** `pipeline/batch_insights.py:193`
**Issue:** The `save(blob_key, result)` call is not wrapped in a try/except. In production (Blob mode), `save()` calls `vercel_blob.put()`, which raises on network errors, authentication failures, or quota limits. A single write failure propagates out of the `for player in players` loop (no handler there) and out of `generate_batch_insights`, to be caught by `run.py`'s outer `except Exception` at line 414. All remaining players receive neither `written` nor `skipped` increments and are silently abandoned. The docstring's invariant `written + skipped == len(players)` is broken on any Blob write error.

**Fix:**
```python
for player in players:
    result = _generate_one(client, player, corpus, int(gameweek))
    if result is None:
        skipped += 1
        continue
    blob_key = f'player_insights/gw{int(gameweek)}/element_{int(player["id"])}.json'
    try:
        save(blob_key, result)
        written += 1
    except Exception as e:
        print(f'[batch_insights] blob write failed player_id={player["id"]}: {e}')
        skipped += 1
```

### CR-02: `player['web_name']` bare access before try block propagates KeyError, aborting entire batch

**File:** `pipeline/batch_insights.py:117-118`
**Issue:** `_generate_one` accesses `player['web_name']` at line 117 and `_build_xml_context(player)` at line 118 (which also accesses `player["web_name"]` at line 84) — both before the `try` block at line 124. A `KeyError` here is not caught by any of the three `except` clauses inside `_generate_one`. It propagates to `generate_batch_insights`'s `for` loop (no handler), then to `run.py`'s outer `except Exception` (line 414), aborting all remaining batch processing. The eligibility filter in `run.py` (line 405) does not filter on `web_name`, so a player with `status='a'` and valid `xPts_1gw` but missing `web_name` — which is possible in malformed FPL API responses — can reach this code path.

**Fix (Option A — guard in `_generate_one`):**
```python
def _generate_one(client, player: dict, corpus: list, gameweek: int) -> Optional[dict]:
    web_name = player.get('web_name')
    if not web_name:
        print(f'[batch_insights] missing web_name player_id={player.get("id")} - skipping')
        return None
    allowed = {_normalize(web_name)}
    xml_context = _build_xml_context(player)
    ...
```

**Fix (Option B — add `web_name` check to eligibility filter in `run.py:405`):**
```python
eligible = [
    p for p in merged
    if p.get('status') == 'a'
    and p.get('xPts_1gw') is not None
    and p.get('web_name')
]
```

### CR-03: `save_local()` does not create subdirectories, causing FileNotFoundError on every local batch run

**File:** `pipeline/batch_insights.py:192-193` (triggered in `pipeline/upload.py:17-21`)
**Issue:** `batch_insights.py` is the only module in the pipeline that calls `save()` with a nested key containing path separators: `player_insights/gw{N}/element_{id}.json`. In `save_local()` (`upload.py:17-21`), the code runs `os.makedirs(cache_dir, exist_ok=True)` — which creates only `pipeline/cache` — then opens `pipeline/cache/player_insights/gw35/element_1.json` for writing. The intermediate subdirectories `pipeline/cache/player_insights/gw35/` are never created. The `open()` call raises `FileNotFoundError`. This affects every developer running the pipeline locally with `USE_BLOB=false` (the default) and `INSIGHT_BATCH_ENABLED=true`. All other `save()` callers in the codebase use flat filenames with no `/`, so this bug is latent in `upload.py` but newly exposed by this phase.

**Fix (in `pipeline/upload.py:17`):**
```python
def save_local(pathname: str, data, cache_dir: str = 'pipeline/cache'):
    """Save data as JSON to the local cache directory."""
    dest = os.path.join(cache_dir, pathname)
    os.makedirs(os.path.dirname(dest), exist_ok=True)  # create subdirs for nested paths
    content = json.dumps(data, indent=2, ensure_ascii=False)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Saved {len(content.encode('utf-8'))} bytes to: {dest}")
```

### CR-04: Vercel Blob prefix search in cache-hit path can match adjacent player IDs, returning wrong player's insight

**File:** `src/app/api/player-insight/route.ts:173-179`
**Issue:** The Blob cache read uses `list({ prefix: cacheKey, limit: 1 })` where `cacheKey` is e.g. `player_insights/gw35/element_1.json`. The Vercel Blob `list` API performs a string prefix match on pathnames. `element_1.json` is a prefix of `element_10.json`, `element_100.json`, `element_1000.json`, etc. If those blobs exist in Blob storage and sort before `element_1.json` alphabetically, `blobs[0]` will be a different player's pre-generated insight. The code then fetches `blobs[0].url` without verifying that `blobs[0].pathname === cacheKey`, and returns the wrong player's prose directly as a 200 response. Player IDs in the FPL data range from single digits into the hundreds, making ID prefix collisions very common in practice.

**Fix:** Verify the pathname matches the exact key before treating it as a cache hit:
```typescript
const { blobs } = await list({ prefix: cacheKey, limit: 1 })
if (blobs.length > 0 && blobs[0].pathname === cacheKey) {
  const cachedRes = await fetch(blobs[0].url)
  if (cachedRes.ok) {
    const cached = await cachedRes.json()
    console.log('[player-insight] blob-cache hit', { player_id: body.player.id, gw: body.gw })
    return Response.json(cached, { status: 200 })
  }
}
```

### CR-05: Model ID `claude-haiku-4-5-20251001` is non-standard and likely invalid — causes silent 100% batch failure

**File:** `pipeline/batch_insights.py:35`
**Issue:** `MODEL = 'claude-haiku-4-5-20251001'` uses a date suffix `20251001` that does not match any documented Anthropic model alias. The sibling module `prose_summary.py` uses `'claude-haiku-4-5'` (no date suffix). Anthropic's versioned snapshot IDs use a different naming convention (e.g., `claude-3-5-haiku-20241022`). If the API rejects this model ID, every `client.messages.create()` call raises `APIError`, every player is skipped via `return None`, and `generate_batch_insights` returns `{'written': 0, 'skipped': 20}`. The pipeline prints one summary line and continues — the failure produces no raised exception and no stderr output visible above the regular pipeline log noise. This failure mode is invisible unless the operator specifically monitors batch skip counts.

**Fix:** Use the same model ID as `prose_summary.py`:
```python
MODEL = 'claude-haiku-4-5'  # matches prose_summary.py
```

## Warnings

### WR-01: Empty-prose log message incorrectly prints `attempt + 1` instead of `attempt`

**File:** `pipeline/batch_insights.py:149`
**Issue:** The empty-prose log prints `attempt={attempt + 1}`. The `attempt` variable is 0-indexed (0 for first attempt, 1 for second). Printing `attempt + 1` reports "attempt=1" for the first and "attempt=2" for the second — the latter implying a non-existent third attempt. Every other log line in `_generate_one` (lines 134, 139, 142, 145, 159) uses `attempt` directly. This inconsistency makes log-based debugging of empty-prose failures misleading.

**Fix:**
```python
print(f'[batch_insights] empty prose player_id={player["id"]} attempt={attempt}')
```

### WR-02: `_passes_guardrail` is a verbatim copy of `prose_summary.py` — silent divergence risk

**File:** `pipeline/batch_insights.py:45-57`
**Issue:** The docstring at line 48 labels this a "verbatim copy" of `prose_summary.py::_passes_guardrail`. Any future rule change to the guardrail must be applied to both files manually. There is no enforcement mechanism. The guardrail is correctness-critical: it prevents hallucinated player names from being persisted to Blob and served to users. A stale copy would silently allow guardrail-violating prose to bypass the check in one code path while being caught in another.

**Fix:** Extract to a shared module `pipeline/guardrail.py` and import from both `batch_insights.py` and `prose_summary.py`:
```python
# pipeline/guardrail.py
def normalize(s: str) -> str:
    return ' '.join(s.lower().split())

def passes_guardrail(prose: str, allowed: set, corpus: list) -> bool:
    text = normalize(prose)
    for name in corpus:
        n = normalize(name)
        if not n:
            continue
        if n in text and n not in allowed:
            return False
    return True
```

### WR-03: Tests construct `RateLimitError`/`APIError` with positional string args — fail with real SDK installed

**File:** `pipeline/tests/test_batch_insights.py:156, 176`
**Issue:** `test_skips_player_on_rate_limit` and `test_skips_player_on_api_error` construct `bi.RateLimitError('rate limit')` and `bi.APIError('api error')`. When the SDK is absent, the module-level fallback assigns `RateLimitError = Exception` and `APIError = Exception`, so `Exception('rate limit')` works. When the real `anthropic` SDK IS installed (production CI or any environment with it), `APIError` and `RateLimitError` are concrete SDK classes whose `__init__` requires structured arguments (HTTP status, response object, etc.) — not a plain string. The tests will raise `TypeError` at instantiation, causing both tests to error rather than pass in the exact environment where they need to work.

**Fix:** Use `MagicMock(side_effect=Exception('rate limit'))` or subclass `Exception` directly rather than constructing real SDK error instances:
```python
client.messages.create.side_effect = [
    Exception('simulated rate limit'),  # triggers 'except Exception' — acceptable since
    _stub_message('Haaland is the captain pick this week.'),  # all three handlers return None
]
```
Or mock the exception classes themselves: `with patch('batch_insights.RateLimitError', Exception):`.

### WR-04: Cache hit in `route.ts` returns unvalidated cached JSON payload directly to the client

**File:** `src/app/api/player-insight/route.ts:177-179`
**Issue:** On a Blob cache hit, the route does `const cached = await cachedRes.json()` and immediately returns `Response.json(cached, { status: 200 })` without any schema validation. The cached payload was written either by `batch_insights.py` (Python pipeline) or by a previous on-demand response. The payload shape `{prose, player_id, gw, generated_at}` is assumed correct but not enforced. A corrupted or manually overwritten Blob entry could return arbitrary JSON (e.g., an error response accidentally written to the same key, or a blob from a different GW/player due to CR-04). There is no runtime guarantee the returned payload matches the documented response shape.

**Fix:** Validate the cached payload before returning it. A lightweight check is sufficient:
```typescript
const cached = await cachedRes.json()
if (
  typeof cached === 'object' && cached !== null &&
  typeof cached.prose === 'string' && cached.prose.trim() &&
  typeof cached.player_id === 'number' &&
  typeof cached.gw === 'number'
) {
  console.log('[player-insight] blob-cache hit', { player_id: body.player.id, gw: body.gw })
  return Response.json(cached, { status: 200 })
}
// Fall through to generation if shape is invalid
```

### WR-05: `buildSystemPrompt` strict-mode player name quoting diverges between TypeScript and Python

**File:** `pipeline/batch_insights.py:105` vs `src/app/api/player-insight/route.ts:128`
**Issue:** In `route.ts`, strict-mode uses `JSON.stringify(playerWebName)` which correctly quotes and escapes special characters (backslashes, embedded quotes) in the player name. In `batch_insights.py`, strict-mode uses the f-string `f'"{player_web_name}"'` — raw double-quote insertion with no escaping. If a player's `web_name` contains a double-quote (unusual but possible with special characters in FPL data), the Python prompt produces malformed output. Since both routes are described as ports of the same logic, they should produce identical system prompts.

**Fix:**
```python
# In _build_system_prompt, replace:
+ f'\n\nSTRICT MODE: You may mention ONLY this exact player name: "{player_web_name}". '
# With:
import json as _json
+ f'\n\nSTRICT MODE: You may mention ONLY this exact player name: {_json.dumps(player_web_name)}. '
```

## Info

### IN-01: `mc_enabled` defaults to `False` on cold start despite `MC_ENABLED = True` being "permanent ON"

**File:** `pipeline/run.py:193-204`
**Issue:** `mc_enabled` is initialised `False` at line 193, then unconditionally set to `MC_ENABLED` (`True`) at line 204 — but only when the `try` block succeeds (i.e., when `accuracy_backtest.json` exists and parses). On a first-ever pipeline run (no backtest file), the `except (FileNotFoundError, json.JSONDecodeError): pass` branch leaves `mc_enabled = False`. MC simulations will not run on cold start, despite the comment saying "permanent ON". This is a pre-existing issue in the reviewed file scope.

**Fix:** Move `mc_enabled = True` outside and before the `try` block, or initialise it directly as `True`:
```python
mc_enabled = True  # Phase 102 MC-01 — permanent ON regardless of backtest state
```

### IN-02: Dead flag pattern — `mc_enabled` never reads from backtest data

**File:** `pipeline/run.py:193-204`
**Issue:** Unlike `form_signal_enabled`, `blend_alpha_used`, `xmins_v2_enabled`, and `bonus_predictor_enabled` — which are all read from `prev_backtest.get('summary', ...)` — `mc_enabled` is always assigned `MC_ENABLED` (a hardcoded constant `True`). The `try/except` read pattern is present but `mc_enabled` doesn't actually read from the backtest. The `mc_enabled = False` initialisation at line 193 followed by `mc_enabled = MC_ENABLED` at line 204 is dead pattern: the initial `False` is immediately overwritten. A future developer reading this code may incorrectly believe MC can be disabled via the backtest file.

**Fix:** Remove `MC_ENABLED` and `mc_enabled` and replace with a direct `True` constant, or add a comment explaining why this flag is unconditional.

### IN-03: `test_batch_block_skipped_when_env_false` asserts exactly one `INSIGHT_BATCH_ENABLED` occurrence — will false-fail if a comment or log line is added

**File:** `pipeline/tests/test_run.py:262-265`
**Issue:** The test asserts `src.count("INSIGHT_BATCH_ENABLED") == 1`. This is an overly tight structural contract. Adding a log line like `print(f"Batch enabled: {os.getenv('INSIGHT_BATCH_ENABLED')}")` or a comment referencing the env var would fail this test. Source-level count assertions are brittle. The intent (the env var guard is not duplicated) would be better served by asserting on the guard's position relative to the batch import, not on the raw occurrence count.

**Fix:** Replace the count assertion with a position-based check:
```python
# Assert the guard appears before the generate_batch_insights call
guard_idx = src.find("os.getenv('INSIGHT_BATCH_ENABLED'")
call_idx = src.find("generate_batch_insights(")
assert guard_idx != -1 and call_idx != -1 and guard_idx < call_idx, \
    "INSIGHT_BATCH_ENABLED guard must precede generate_batch_insights call"
```

---

_Reviewed: 2026-05-14T12:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
