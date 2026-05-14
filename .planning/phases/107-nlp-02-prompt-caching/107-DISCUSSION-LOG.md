# Phase 107: NLP-02 Prompt Caching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 107-NLP-02 Prompt Caching
**Areas discussed:** Prompt padding strategy, Logging granularity

---

## Prompt Padding Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Wire only, no padding | Add cache_control: ephemeral, accept it's a no-op below 1024 tokens. Phase 108 or future prompt expansion crosses the threshold. | ✓ |
| Pad now with FPL context | Expand system prompt with FPL scoring rules, position definitions, analysis guidance to cross 1024 tokens immediately. | |
| Pad now, minimally | Add just enough stable boilerplate (FPL scoring table + position labels) to hit 1024 tokens. | |

**User's choice:** Wire only, no padding
**Notes:** Keep Phase 107 minimal — pure plumbing. Caching activates organically when the prompt grows.

---

## Logging Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Every attempt | Log cache metrics after each successful Claude call regardless of guardrail outcome. Full visibility into attempt-0 and attempt-1 separately. | ✓ |
| Final outcome only | Log once per request after the accepted response. Simpler volume, but attempt-1 stats invisible. | |

**User's choice:** Every attempt

---

| Option | Description | Selected |
|--------|-------------|----------|
| Structured object | `console.log('[player-insight] cache', { attempt, cache_creation_input_tokens, cache_read_input_tokens })` — grep-friendly | ✓ |
| JSON string | `console.log(JSON.stringify({ event: 'cache_usage', ... }))` — machine-parseable | |

**User's choice:** Structured object

---

## Claude's Discretion

- SDK API shape: `system: TextBlockParam[]` without betas header (confirmed in SDK 0.93.0 type defs)
- Apply `cache_control` to both attempt-0 and attempt-1 (no split base/strict blocks)
- `?? 0` fallback on usage fields (API omits fields when count is zero)

## Deferred Ideas

- Prompt padding to cross 1024-token threshold — deferred to Phase 108 or organic growth
