---
phase: 107
plan: 01
subsystem: api/player-insight
tags:
  - anthropic-sdk
  - prompt-caching
  - api-route
  - vitest
  - tdd
dependency_graph:
  requires:
    - Phase 105 NLP-02 player-insight route (system prompt string, two-attempt guardrail)
  provides:
    - cache_control ephemeral on system block for both attempt-0 and attempt-1 Claude calls
    - structured cache metric log line per successful Claude call
  affects:
    - src/app/api/player-insight/route.ts
    - src/app/api/player-insight/route.test.ts
tech_stack:
  added: []
  patterns:
    - TextBlockParam[] with cache_control ephemeral on system parameter
    - console.log structured cache metric with attempt + token counts
key_files:
  modified:
    - src/app/api/player-insight/route.ts
    - src/app/api/player-insight/route.test.ts
decisions:
  - "Rename 'system' (string) to 'systemText' then wrap in TextBlockParam[] at call site — keeps buildSystemPrompt() signature unchanged (D-03)"
  - "Cache metrics logged inside try block so they only fire on successful resolution, not on SDK throws (D-05)"
  - "?? 0 null-coalescing on cache token fields — SDK types them number | null, not number | undefined (D-06)"
  - "No new named imports — object literal satisfies TextBlockParam structurally (D-PATTERN)"
  - "Runtime cache activation is a structural no-op until prompt crosses 1024-token Anthropic minimum (D-01)"
metrics:
  duration: ~8 minutes
  completed: "2026-05-14"
  tasks: 2
  files: 2
requirements:
  - CACHE-01
  - CACHE-02
---

# Phase 107 Plan 01: NLP-02 Prompt Caching — SUMMARY

**One-liner:** Anthropic prompt caching plumbing wired into `/api/player-insight` — `system` wrapped as `TextBlockParam[]` with `cache_control: ephemeral` on both attempts, cache token counts logged after every successful Claude call.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update route.test.ts success-path mocks to include usage field (RED) | 1f0837a | src/app/api/player-insight/route.test.ts |
| 2 | Wrap system as TextBlockParam[] with cache_control and log usage metrics (GREEN) | d834355 | src/app/api/player-insight/route.ts |

## TDD Gate Compliance

- RED gate: `test(107-01)` commit `1f0837a` — new cache_control-shape assertion failing, all 11 existing tests passing
- GREEN gate: `feat(107-01)` commit `d834355` — all 12 tests passing

## Changes Made

### `src/app/api/player-insight/route.ts`

Changed the two-attempt loop body (lines 173–191) to:

1. Rename `const system = buildSystemPrompt(...)` → `const systemText = buildSystemPrompt(...)` to avoid type collision
2. Wrap in `TextBlockParam[]`: `const system = [{ type: 'text' as const, text: systemText, cache_control: { type: 'ephemeral' as const } }]`
3. Add `console.log('[player-insight] cache', { attempt, cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0, cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0 })` immediately after `client.messages.create` resolves

`buildSystemPrompt()` signature unchanged. Guardrail logic unchanged. `maxDuration = 30` preserved.

### `src/app/api/player-insight/route.test.ts`

1. Added `usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }` to all 8 success-path `mockResolvedValue` calls
2. Added new test: `'passes system as TextBlockParam[] with cache_control ephemeral on attempt 0'` — asserts `system` is an array of length 1 with `{ type: 'text', cache_control: { type: 'ephemeral' } }` and `text` containing `'FPL analyst'`

## Test Results

```
Tests  12 passed (12)  — 10 existing + 1 new cache-shape assertion + 1 runtime/maxDuration
```

## Verification

- `npx vitest run src/app/api/player-insight/route.test.ts` — exit 0, 12/12 pass
- `npx tsc --noEmit` — exit 0, no new errors
- `npx eslint src/app/api/player-insight/route.ts src/app/api/player-insight/route.test.ts` — exit 0 (1 pre-existing warning on `err` catch variable, not new)

### Source grep verification

| Assertion | Count | Expected |
|-----------|-------|----------|
| `cache_control: { type: 'ephemeral' as const }` in route.ts | 1 | ≥1 |
| `[player-insight] cache` in route.ts | 1 | ≥1 |
| `cache_creation_input_tokens ?? 0` in route.ts | 1 | ≥1 |
| `cache_read_input_tokens ?? 0` in route.ts | 1 | ≥1 |
| `function buildSystemPrompt(strict: boolean, playerWebName: string): string` | 1 | 1 |
| `export const maxDuration = 30` | 1 | 1 |
| `cache_creation_input_tokens` in route.test.ts | 9 | ≥8 |
| `passes system as TextBlockParam` in route.test.ts | 1 | 1 |

## Diff Stats

- `route.ts`: +8 lines / −1 line (7 net additions in loop body)
- `route.test.ts`: +37 lines / −8 lines (29 net additions across usage fields + new test)

## Deferred Runtime Smoke Check

After deploy, grep Vercel logs for `[player-insight] cache` and confirm:
- `cache_creation_input_tokens=0` / `cache_read_input_tokens=0` on the first call (prompt below 1024-token threshold per D-01)
- On the second call within 5 minutes with the identical prompt, `cache_read_input_tokens` > 0 indicates the cache is being hit

Phase 107 ships the plumbing only. Phase 108 (batch insight pre-generation) or organic prompt growth will push the system prompt above Anthropic's 1024-token cache minimum, at which point the cost reduction activates without further code change.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all threat-model surface from the plan's STRIDE register is accounted for. The cache log line contains only `attempt` (0 or 1) and two integer token counts — no PII, no player identifiers (T-107-01 mitigated as designed).

## Self-Check: PASSED

- [x] `src/app/api/player-insight/route.ts` modified and committed at d834355
- [x] `src/app/api/player-insight/route.test.ts` modified and committed at 1f0837a
- [x] Commits d834355 and 1f0837a exist in git log
- [x] 12/12 tests passing
- [x] tsc clean
- [x] eslint clean
- [x] CACHE-01 and CACHE-02 closed
