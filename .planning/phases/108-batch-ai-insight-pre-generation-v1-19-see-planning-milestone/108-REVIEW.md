---
phase: 108-batch-ai-insight-pre-generation-v1-19-see-planning-milestone
reviewed: 2026-05-14T10:59:59Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - pipeline/batch_insights.py
  - pipeline/tests/test_batch_insights.py
  - pipeline/run.py
  - pipeline/tests/test_run.py
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 108: Code Review Report

**Reviewed:** 2026-05-14T10:59:59Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The Phase 108 implementation adds a batch AI insight pre-generation module (`batch_insights.py`) and wires it into the pipeline via an env-var gate in `run.py`. The structural design is sound — the guard pattern, non-fatal exception handling, and the guardrail/retry logic all follow established pipeline conventions. However, three blocking defects were found: a `save()` failure inside the per-player loop aborts all remaining players with no per-player isolation; bare dict access on `player['web_name']` outside any try/except context will abort the entire batch run (not just the affected player) if a malformed player dict reaches the loop; and the model ID `claude-haiku-4-5-20251001` uses a non-standard date suffix not matching any documented Anthropic model identifier, which will produce silent 100% failure on every production run. Four warnings covering logging correctness, DRY violation, test reliability with real SDK, and a dead `mc_enabled` cold-start path in `run.py` are also documented.

## Critical Issues

### CR-01: `save()` failure aborts entire batch run — no per-player isolation

**File:** `pipeline/batch_insights.py:187-194`
**Issue:** The `save(blob_key, result)` call at line 193 is not wrapped in a try/except. In Blob mode, `save()` delegates to `vercel_blob.put()`, which can raise on network errors, authentication failures, or quota limits. A single Blob write failure raises an exception that propagates out of the `for player in players` loop (no handler there) and then out of `generate_batch_insights` entirely. The caller in `run.py` catches it with the outer `except Exception`, logs it as `[batch_insights] non-fatal error`, and aborts the batch. All remaining players are skipped with no `skipped` count incremented and no partial results returned. The docstring promises `written + skipped == len(players)` — this invariant is broken when `save()` raises.

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

### CR-02: Bare `player['web_name']` access outside try/except aborts entire batch on malformed player

**File:** `pipeline/batch_insights.py:117-118`
**Issue:** `_generate_one` accesses `player['web_name']` at line 117 and calls `_build_xml_context(player)` at line 118 (which also accesses `player["web_name"]` at line 84) — both BEFORE the `try` block that starts at line 124. A `KeyError` raised here is not caught by any of the `except` clauses inside `_generate_one`. It propagates to the `for player in players` loop in `generate_batch_insights` (line 187), which has no handler either. The exception then reaches `run.py`'s outer batch `except Exception` (line 414), which aborts all remaining batch processing for that pipeline run. The eligibility filter in `run.py` (`p.get('status') == 'a' and p.get('xPts_1gw') is not None`) does not filter on `web_name`, so a player with `status='a'`, valid `xPts_1gw`, but missing `web_name` can reach this code path.

**Fix:** Wrap both calls in a try/except inside `_generate_one`, or add `web_name` to the eligibility filter in `run.py`:

Option A — guard in `_generate_one`:
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

Option B — add `web_name` to eligibility filter in `run.py` (line 405):
```python
eligible = [
    p for p in merged
    if p.get('status') == 'a'
    and p.get('xPts_1gw') is not None
    and p.get('web_name')
]
```

### CR-03: Model ID `claude-haiku-4-5-20251001` is non-standard and likely invalid

**File:** `pipeline/batch_insights.py:35`
**Issue:** The `MODEL` constant is set to `'claude-haiku-4-5-20251001'`. The sibling module `prose_summary.py` uses `'claude-haiku-4-5'` (without a date suffix). The date suffix format `YYYYMMDD` is used in Anthropic's API for specific versioned model aliases (e.g., `claude-3-5-haiku-20241022`), but `claude-haiku-4-5-20251001` does not match any known model ID — Claude Haiku 4.5's documented snapshot ID does not use this suffix format. If this model ID is rejected by the API, every `client.messages.create()` call raises an `APIError`, every player is skipped via the `return None` path, and `generate_batch_insights` returns `{'written': 0, 'skipped': 20}` with no error surfaced beyond per-player log lines. The pipeline continues without complaint and Blob is never written. This would be invisible in production logs unless someone specifically checks the skip count.

**Fix:** Align with `prose_summary.py`:
```python
MODEL = 'claude-haiku-4-5'  # match prose_summary.py; add snapshot suffix only when Anthropic documents one
```

## Warnings

### WR-01: Empty-prose log message prints `attempt + 1` instead of `attempt`

**File:** `pipeline/batch_insights.py:149`
**Issue:** The empty-prose log at line 149 prints `attempt={attempt + 1}`. The loop variable `attempt` is 0-indexed (values 0 and 1 for `ALLOWED_RETRIES=1`). Printing `attempt + 1` means the log reports "attempt=1" for the first attempt and "attempt=2" for the second — the latter implying a third attempt that never happens. Every other log line in `_generate_one` (lines 134, 139, 142, 145, 159) correctly uses `attempt` without the `+ 1` offset, making this inconsistency confusing for debugging.

**Fix:**
```python
print(f'[batch_insights] empty prose player_id={player["id"]} attempt={attempt}')
```

### WR-02: `save()` call failure breaks `written + skipped == len(players)` invariant (companion to CR-01)

**File:** `pipeline/batch_insights.py:196`
**Issue:** The docstring on `generate_batch_insights` states "written + skipped == len(players)". This invariant is correct only when `_generate_one` is the sole failure mode (returns None). If `save()` raises (see CR-01), the function exits via exception with neither `written` nor `skipped` incremented for the failed player. The returned dict (if any) would have `written + skipped < len(players)`. The print in `run.py` at line 413 blindly reports `result['written']` and `result['skipped']` as authoritative — callers should be aware this is not always accurate. Fixing CR-01 resolves this warning as well.

### WR-03: `_passes_guardrail` is a verbatim copy of `prose_summary.py` — silent divergence risk

**File:** `pipeline/batch_insights.py:45-57`
**Issue:** The docstring at line 48 explicitly labels this as a "verbatim copy" of `prose_summary.py::_passes_guardrail`. Duplicated logic means any future guardrail rule change must be applied to both files. There is no mechanism to enforce this — a change to one file silently leaves the other stale. The guardrail is a correctness-critical check (prevents hallucinated player names from being persisted to Blob).

**Fix:** Extract into a shared module (e.g., `pipeline/guardrail.py`) and import from both `batch_insights.py` and `prose_summary.py`:
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

### WR-04: Tests for `RateLimitError`/`APIError` constructor use positional string args that fail when real SDK is installed

**File:** `pipeline/tests/test_batch_insights.py:156, 176`
**Issue:** Tests `test_skips_player_on_rate_limit` and `test_skips_player_on_api_error` instantiate `bi.RateLimitError('rate limit')` and `bi.APIError('api error')` respectively as side effects. When the Anthropic SDK is not installed (current dev environment), the module-level fallback sets `RateLimitError = Exception` and `APIError = Exception`, so `Exception('rate limit')` constructs fine. However, when the real `anthropic` SDK IS installed (production CI or any environment with the SDK), `APIError` and `RateLimitError` require structured arguments matching the SDK's internal constructor (they are not simple `Exception` subclasses that accept a plain string). The tests will raise `TypeError` at instantiation time, causing both tests to error rather than pass. Since the batch module is specifically designed to be used WITH the real SDK, tests for SDK error handling should be robust when the SDK is present.

**Fix:** Construct errors defensively using a helper that respects the actual constructor signature:
```python
def _make_api_error():
    """Construct an APIError-compatible exception regardless of SDK presence."""
    try:
        from anthropic import APIStatusError
        # APIStatusError is the concrete raiseable base; requires response mock
        return Exception('api error (sdk not available for proper construction)')
    except ImportError:
        pass
    import batch_insights as bi
    return bi.APIError('api error')
```

Or more practically, patch the exception classes directly in tests rather than raising real instances, or use `MagicMock(side_effect=Exception('rate limit'))` since both handlers return `None` regardless.

## Info

### IN-01: `mc_enabled` defaults to `False` on cold start despite `MC_ENABLED = True` being "permanent ON"

**File:** `pipeline/run.py:193-204`
**Issue:** `mc_enabled` is initialised `False` at line 193, then set to `MC_ENABLED` (which is `True`) only inside the `try` block at line 204 — i.e., only when `accuracy_backtest.json` exists and is valid JSON. On a first-ever pipeline run (no backtest file yet), the `except (FileNotFoundError, json.JSONDecodeError): pass` branch leaves `mc_enabled = False`. MC simulations will not run on cold start despite the comment "permanent ON". This is a pre-existing issue not introduced by Phase 108 but is in the reviewed file scope.

**Fix:** Initialise `mc_enabled` to `MC_ENABLED` directly (since it no longer reads from the backtest file):
```python
mc_enabled = True  # Phase 102 MC-01 — permanent ON
# Remove mc_enabled = MC_ENABLED from inside the try block
```

### IN-02: Dead variable `mc_enabled` read from backtest never reflects actual backtest data

**File:** `pipeline/run.py:193-204`
**Issue:** `mc_enabled` is always assigned `MC_ENABLED` (a hardcoded `True`) inside the try block — it never reads from `prev_backtest`. The variable exists to support a feature-flag pattern, but since `MC_ENABLED = True` is a constant, the "gate" is unconditional. The parallel assignment at line 193 (`mc_enabled = False`) followed by overwrite at line 204 (`mc_enabled = MC_ENABLED`) is misleading dead code. A reader scanning for feature flags would expect `mc_enabled` to be data-driven like `form_signal_enabled`, but it is not.

**Fix:** Remove the `mc_enabled`/`MC_ENABLED` variable pair and replace all references with a literal `True`, or add a comment making the permanent-on nature explicit at the single assignment site.

---

_Reviewed: 2026-05-14T10:59:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
