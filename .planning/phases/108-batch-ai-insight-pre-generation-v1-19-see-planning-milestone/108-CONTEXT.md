# Phase 108: Batch AI Insight Pre-Generation - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Python pipeline pre-generates Claude insights for the 20 highest-`xPts_1gw` players after each daily run, writing each to Vercel Blob at `player_insights/gw{N}/element_{id}.json` (with `allowOverwrite: True`) — the same key namespace the on-demand `/api/player-insight` route already writes. The existing two-tier cache (localStorage → Blob → live API) in `usePlayerInsight` finds a Blob hit on first interaction for the most-viewed candidates, reducing response time from ~2–6 s to ~50–150 ms with zero new Claude spend.

Deliverables:
1. **`pipeline/batch_insights.py`** — new module; generates insights for a list of players, returns count of successes/failures; called from `run.py` after `accuracy_backtest.json` is written.
2. **`run.py` integration** — batch step wrapped in `try/except` (non-fatal); guarded by `INSIGHT_BATCH_ENABLED` env var; runs after all critical artifacts (`merged_players.json`, `captain_picks.json`, `accuracy_backtest.json`) are safely written.
3. **No UI changes** — `usePlayerInsight` reads Blob transparently via the existing two-tier cache; NLP-BATCH-03 is met without touching any frontend code.

**Out of scope:** Prompting the user with rejection/fragility/lifecycle context (those are frontend-computed); UI changes; new API routes; changes to the on-demand `/api/player-insight` route.

</domain>

<decisions>
## Implementation Decisions

### Player Data Shape
- **D-01:** Batch sends simplified XML context per player — `web_name`, `element_type`, `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts` from `merged_players.json`. No `rejection_reasons`, `fragility`, or `lifecycle_label` (those are computed client-side in TypeScript and are not available in the pipeline).
- **D-02:** Use the same system prompt as the on-demand route (`buildSystemPrompt` equivalent in Python). Claude will naturally focus on haul/blank outlook since that's all the XML context provides. Keeps batch and on-demand prompts aligned — no batch-specific prompt text.

### Batch Module Structure
- **D-03:** New `pipeline/batch_insights.py` module, following the `prose_summary.py` pattern — self-contained, testable, called from `run.py` in a `try/except` block. Main export: `generate_batch_insights(players: list, corpus: list, gameweek: int) -> dict` returning `{'written': int, 'skipped': int}`.
- **D-04:** Batch step placement in `run.py`: after `accuracy_backtest.json` is written (last critical artifact), alongside `prose_summary` (both are non-fatal try/except blocks). A batch failure must never prevent `merged_players.json`, `captain_picks.json`, or `accuracy_backtest.json` from writing.

### Guardrail & Retry
- **D-05:** Same 2-attempt/strict-mode retry pattern as the on-demand route and `prose_summary.py`. Attempt 0 = normal prompt, attempt 1 = strict mode (only mention the specific player's exact name). If both attempts fail the guardrail or raise an API error, skip that player (no Blob write), log a warning, and continue to the next player. Partial success is acceptable — on-demand generation handles any missed players.
- **D-06:** Guardrail implementation: replicate `_passes_guardrail` from `prose_summary.py` — exact-match check of corpus names against the prose, excluding the allowed name (the single player). `allowed = {player['web_name']}`.

### Prompt Caching
- **D-07:** Apply `cache_control: {"type": "ephemeral"}` to the system prompt in Python batch calls — same approach as Phase 107 in the TS route. The system prompt is currently ~80 tokens (below Anthropic's 1024-token threshold), so caching is a structural no-op at Phase 108 deploy time. Wire it now so caching activates automatically when the prompt grows or the threshold changes, consistent with the TS route.
- **D-08:** Python SDK syntax: pass `system=[{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}]` to `client.messages.create()`. Matches the `TextBlockParam[]` shape used in the TS route.

### Blob Write
- **D-09:** Use `vercel_blob.put(pathname, payload, {'allowOverwrite': True, 'contentType': 'application/json'})` via the existing `upload_json()` in `upload.py` — OR call `vercel_blob.put()` directly if the path-level control is needed. Key must be `player_insights/gw{N}/element_{id}.json` to match the namespace the TS route reads from. Only writes to Blob when `USE_BLOB=true` (same gate as all other pipeline Blob writes); local dev skips Blob writes.
- **D-10:** Blob write JSON format: `{"prose": str, "player_id": int, "gw": int, "generated_at": ISO str}` — identical to the on-demand route response body. `usePlayerInsight` parses this shape.

### Claude's Discretion
- Model to use: `claude-haiku-4-5-20251001` (same as on-demand route) — cost-efficient, sufficient for 2–3 sentence qualitative insight.
- `max_tokens`: 300 (same as on-demand route).
- Whether to log a `[batch_insights] cache` line per player analogous to the `[player-insight] cache` log in the TS route — recommended for observability parity.
- Sequential vs concurrent API calls: sequential is safer (rate limit avoidance) and fine given the pipeline runs nightly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### On-Demand Route (primary reference for format + prompt parity)
- `src/app/api/player-insight/route.ts` — on-demand route; defines `buildXmlContext()`, `buildSystemPrompt()`, Blob write format, guardrail call, two-attempt retry loop, and response JSON shape that batch must match
- `src/app/api/player-insight/route.test.ts` — existing tests; batch_insights.py tests must mirror the player-level skip-on-failure contract

### Pipeline Batch Pattern Reference
- `pipeline/prose_summary.py` — the canonical template for pipeline Python modules that call the Anthropic SDK; follow its structure for `batch_insights.py` (API key guard, SDK import guard, guardrail function, 2-attempt retry, return None/skip on failure)
- `pipeline/upload.py` — `upload_json(pathname, data)` for Blob writes; `save_local()` for local dev writes; both used in the batch

### Pipeline Entry Point
- `pipeline/run.py` lines 351–395 — `prose_summary` try/except block; batch step follows the same pattern immediately after or alongside it

### Requirements
- `.planning/REQUIREMENTS.md` §NLP-BATCH-01, NLP-BATCH-02, NLP-BATCH-03 — the 3 requirements this phase closes

### Phase 107 Caching Decision
- `.planning/phases/107-nlp-02-prompt-caching/107-CONTEXT.md` §D-03, D-04, D-07 — documents the `cache_control: ephemeral` wiring decision and the `TextBlockParam[]` shape to replicate in Python

### Phase 105 Blob Namespace (original definition)
- `.planning/phases/105-nlp-02-per-player-llm-insight-route-hook-ui/` — phase that defined `player_insights/gw{N}/element_{id}.json` key pattern and the two-tier cache (localStorage → Blob → live API)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/prose_summary.py` — full template to copy: API key guard, SDK import try/except, `_passes_guardrail()`, 2-attempt loop, `RateLimitError` / `APIError` catches, return None on failure
- `pipeline/upload.py:upload_json()` — handles Blob write with `allowOverwrite: True`; call as `upload_json(f'player_insights/gw{gw}/element_{player_id}.json', insight_dict)` — but only when `USE_BLOB=true`
- `src/app/api/player-insight/route.ts:buildSystemPrompt()` — system prompt text to replicate in Python (no strict difference in structure)
- `src/app/api/player-insight/route.ts:buildXmlContext()` — XML shape to replicate for simplified fields; omit `<fragility>`, `<reasons>` blocks since those have no data source in Python

### Established Patterns
- `try/except` isolation in `run.py` — every non-critical pipeline step (prose_summary, set_piece_quality, data_health) is wrapped; batch follows the same pattern so a batch failure cannot propagate to `sys.exit(1)`
- `INSIGHT_BATCH_ENABLED` env var gate — check `os.getenv('INSIGHT_BATCH_ENABLED', '').lower() == 'true'` at the top of the batch step in `run.py`; `batch_insights.py` itself does not read the env var (caller's responsibility)
- `MC_ENABLED = True` permanent flag at `run.py:194` — confirms `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts` are always present in `merged_players.json` when the pipeline runs in production

### Integration Points
- `run.py` line ~395 (after `prose_summary` try/except) — insert batch step: check `INSIGHT_BATCH_ENABLED`, compute `current_gw = finished_gws + 1`, sort `merged` by `xPts_1gw` descending and slice `[:20]`, call `generate_batch_insights(top20, corpus, current_gw)`, log result
- `merged_players.json` fields used by batch: `id`, `web_name`, `element_type`, `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts`, `xPts_1gw`

</code_context>

<specifics>
## Specific Ideas

- The batch module returns a `{'written': int, 'skipped': int}` summary dict so `run.py` can print a one-line result analogous to `"Weekly summary written: GW {N}"`.
- `haul_prob`, `blank_prob`, `p10_pts`, `p90_pts` may be `None` for some players if MC simulations didn't run — build XML attributes only when the field is not None (mirrors the `mcAttr` logic in `buildXmlContext()`).
- The `current_gw` variable is already computed in `run.py` at line 334 — reuse it for the batch step rather than recomputing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 108-Batch AI Insight Pre-Generation*
*Context gathered: 2026-05-14*
