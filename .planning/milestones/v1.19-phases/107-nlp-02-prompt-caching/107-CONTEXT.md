# Phase 107: NLP-02 Prompt Caching - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure server-side change to `/api/player-insight/route.ts`. Add `cache_control: { type: 'ephemeral' }` to the system prompt block in the Anthropic API call, and log `cache_creation_input_tokens` / `cache_read_input_tokens` from `response.usage` after every Claude call. No UI changes, no new routes, no user-visible behaviour change.

</domain>

<decisions>
## Implementation Decisions

### Prompt Padding
- **D-01:** Wire `cache_control: ephemeral` now without padding the system prompt. The prompt is ~80 tokens — below Anthropic's 1024-token minimum — so caching is a structural no-op at Phase 107 deploy time. This is intentional. Phase 108 (batch generation) will grow the prompt or the threshold will be crossed organically. Phase 107 lays the plumbing only.
- **D-02:** No stable FPL context padding to be added in this phase. Keep system prompt content exactly as Phase 105 left it.

### SDK API Shape
- **D-03:** Change `system` parameter from `string` to `TextBlockParam[]` with a single block: `[{ type: 'text', text: systemPromptText, cache_control: { type: 'ephemeral' } }]`. SDK 0.93.0 supports `system: string | Array<TextBlockParam>` natively — no `betas` header required.
- **D-04:** Apply `cache_control` to BOTH attempt-0 (non-strict) and attempt-1 (strict) system prompts. Each produces its own cache entry. No splitting of base/strict into separate blocks — keep the existing `buildSystemPrompt()` signature and just wrap its output in a `TextBlockParam` with `cache_control`.

### Cache Metric Logging
- **D-05:** Log cache metrics after EVERY successful Claude call — both attempt 0 and attempt 1 — regardless of whether the response passes the guardrail. Attempt-1 calls are rare (guardrail-failure recovery) but their cache behaviour is still useful to observe.
- **D-06:** Log format: structured object via `console.log`:
  ```ts
  console.log('[player-insight] cache', { attempt, cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0, cache_read_input_tokens: usage.cache_read_input_tokens ?? 0 })
  ```
  The `?? 0` fallback handles the field being `undefined` (API omits it when zero). Filterable in Vercel logs by grepping `[player-insight] cache`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Target Call Site
- `src/app/api/player-insight/route.ts` — the only file modified; system prompt build + Anthropic API call at lines 119–133 and 177–188; two-attempt guardrail loop at lines 173–219

### Requirements
- `.planning/REQUIREMENTS.md` §CACHE-01, CACHE-02 — the two requirements this phase closes

### Phase 105 Implementation (dependency)
- `.planning/phases/105-nlp-02-per-player-llm-insight-route-hook-ui/` — the phase that built `/api/player-insight`; PLAN.md and SUMMARY.md document the guardrail contract that must remain intact

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildSystemPrompt(strict: boolean, playerWebName: string): string` (route.ts:119) — returns a plain string today; Phase 107 wraps its return value in a `TextBlockParam` at the call site rather than changing the function signature
- `client.messages.create(...)` call at route.ts:177 — the sole modification point; change `system: systemString` to `system: [{ type: 'text', text: systemString, cache_control: { type: 'ephemeral' } }]`
- `msg.usage` on the response object — already typed by SDK; `cache_creation_input_tokens` and `cache_read_input_tokens` are available as optional number fields

### Established Patterns
- Two-attempt loop (lines 173–219): attempt=0 non-strict, attempt=1 strict — both calls become `system: TextBlockParam[]` after this change; `buildSystemPrompt()` itself unchanged
- `console.log` already used in route for error paths; cache log follows same convention
- `response.usage` fields are optional (`undefined` when 0) — use `?? 0` fallback when logging

### Integration Points
- No hooks, no UI, no pipeline changes — single-file edit to `route.ts`
- Tests at `src/app/api/player-insight/route.test.ts` will need updating to assert `system` is passed as `TextBlockParam[]` (or mock adjusted to accept array)

</code_context>

<specifics>
## Specific Ideas

- The `?? 0` fallback on `cache_creation_input_tokens` and `cache_read_input_tokens` is deliberate: the Anthropic API omits these fields entirely when the count is zero rather than returning `0`, so null-coalescing prevents `undefined` appearing in logs.
- Log line prefix `[player-insight] cache` is chosen to be grep-able in Vercel log viewer without ambiguity.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Prompt padding to cross 1024 tokens is deferred to Phase 108 or organic prompt growth.

</deferred>

---

*Phase: 107-NLP-02 Prompt Caching*
*Context gathered: 2026-05-14*
