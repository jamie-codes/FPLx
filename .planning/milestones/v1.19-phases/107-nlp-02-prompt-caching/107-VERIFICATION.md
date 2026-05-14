---
phase: 107-nlp-02-prompt-caching
verified: 2026-05-14T11:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification:
  - test: "Runtime cache activation smoke check"
    expected: "After deploy, grep Vercel logs for '[player-insight] cache' and confirm cache_creation_input_tokens=0 / cache_read_input_tokens=0 on first call (prompt below 1024-token threshold). On second call with identical prompt within 5 minutes, cache_read_input_tokens > 0."
    why_human: "Requires live deployment to Vercel and real Anthropic API traffic — cannot be verified programmatically in the codebase."
---

# Phase 107: NLP-02 Prompt Caching Verification Report

**Phase Goal:** Wire Anthropic prompt caching plumbing into /api/player-insight — close CACHE-01 (system block wrapped as TextBlockParam[] with cache_control: ephemeral) and CACHE-02 (structured cache metric log per successful Claude call).
**Verified:** 2026-05-14T11:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Both client.messages.create calls (attempt 0 and attempt 1) pass system as TextBlockParam[] with cache_control: { type: 'ephemeral' } | VERIFIED | route.ts line 175: `const system = [{ type: 'text' as const, text: systemText, cache_control: { type: 'ephemeral' as const } }]` constructed inside the for-loop body (lines 173–197), so both iterations use the array. system shorthand passed at line 181. |
| 2 | After every successful Claude call (both attempts), a structured log line '[player-insight] cache' is emitted recording attempt, cache_creation_input_tokens, cache_read_input_tokens | VERIFIED | route.ts lines 184–188: `console.log('[player-insight] cache', { attempt, cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0, cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0 })` placed inside the try block after `client.messages.create` resolves, before the catch — fires on success only, for every loop iteration. |
| 3 | The two-attempt name-whitelist guardrail behaviour from Phase 105 is unchanged — 200 on pass, 422 on double-fail, 502 on SDK error, 503 on missing API key, 400 on bad body | VERIFIED | route.ts guardrail logic (lines 199–224) is untouched. All 5 error-path behaviors confirmed by passing test suite: 12/12 tests pass including the 400, 503, 502, 422, and 200 paths. |
| 4 | Existing test suite at route.test.ts continues to pass; success-path mocks include msg.usage with all four token fields | VERIFIED | All 8 success-path mockResolvedValue calls now include `usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }`. Test run exits 0, 12/12 pass. grep count of `cache_creation_input_tokens` in route.test.ts: 9 (exceeds minimum of 8). |
| 5 | buildSystemPrompt(strict, playerWebName) signature and return-type (string) are unchanged | VERIFIED | route.ts line 119: `function buildSystemPrompt(strict: boolean, playerWebName: string): string` — exact signature preserved. The string return is consumed as `systemText` (line 174) and then wrapped at the call site, not inside the builder. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/player-insight/route.ts` | system prompt wrapped in TextBlockParam[] with cache_control + console.log cache metric line | VERIFIED | Line 175: TextBlockParam[] with cache_control ephemeral. Lines 184–188: console.log with exact required keys. |
| `src/app/api/player-insight/route.ts` | `[player-insight] cache` log line present | VERIFIED | Line 184: `console.log('[player-insight] cache', {` |
| `src/app/api/player-insight/route.test.ts` | success-path mocks return usage field with cache_creation_input_tokens | VERIFIED | All 8 success-path mockResolvedValue sites include the usage object. Count: 9 occurrences of `cache_creation_input_tokens` in test file. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| route.ts | @anthropic-ai/sdk client.messages.create system parameter | TextBlockParam[] literal with cache_control: { type: 'ephemeral' as const } | WIRED | Line 175 constructs the array; line 181 passes it via shorthand `system,` inside `client.messages.create({...})`. Pattern `system:\s*\[` matches at the create call site. |
| route.ts | Vercel server logs | console.log('[player-insight] cache', { attempt, cache_creation_input_tokens, cache_read_input_tokens }) | WIRED | Lines 184–188. Log is inside try block after msg resolves, before catch. Fires on every successful Claude call across both loop iterations. |
| route.test.ts | Anthropic SDK mock response | mockResolvedValue with usage field on every success-path mock | WIRED | All 8 identified success-path mockResolvedValue sites include `usage: { input_tokens: 50, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| route.ts console.log | msg.usage.cache_creation_input_tokens, msg.usage.cache_read_input_tokens | Anthropic SDK response (msg.usage) | Yes — live Anthropic API response fields; ?? 0 handles null case per SDK type (number \| null) | FLOWING |

Note: Cache log is a side-effect (server log), not a UI rendering path. Data-flow trace confirms the log fires with real SDK response data on every successful call, not a static or hardcoded value.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 12 tests pass (10 existing + 1 new cache-shape + 1 maxDuration) | `npx vitest run src/app/api/player-insight/route.test.ts` | 12 passed (12) — exit 0 | PASS |
| TypeScript type-checks clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| cache_control ephemeral appears in route.ts | `grep -c "cache_control: { type: 'ephemeral' as const }" route.ts` | 1 | PASS |
| [player-insight] cache log line appears in route.ts | `grep -c "\[player-insight\] cache" route.ts` | 1 | PASS |
| cache_creation_input_tokens in test file | `grep -c "cache_creation_input_tokens" route.test.ts` | 9 (≥8 required) | PASS |
| new cache-shape test present | `grep -c "passes system as TextBlockParam" route.test.ts` | 1 | PASS |
| buildSystemPrompt signature unchanged | `grep -c "function buildSystemPrompt(strict: boolean, playerWebName: string): string" route.ts` | 1 | PASS |
| maxDuration preserved | `grep -c "export const maxDuration = 30" route.ts` | 1 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CACHE-01 | 107-01-PLAN.md | `/api/player-insight` adds `cache_control: {"type": "ephemeral"}` to the system prompt message block in the Anthropic API call | SATISFIED | route.ts line 175: `cache_control: { type: 'ephemeral' as const }` inside the TextBlockParam[] assigned to `system`, passed to both client.messages.create calls via the loop body. |
| CACHE-02 | 107-01-PLAN.md | API response `usage.cache_creation_input_tokens` and `cache_read_input_tokens` are logged server-side so cache hit rate is observable in Vercel logs | SATISFIED | route.ts lines 184–188: console.log emits both token counts from msg.usage with ?? 0 null-coalescing on every successful Claude call. |

No orphaned requirements — REQUIREMENTS.md maps only CACHE-01 and CACHE-02 to Phase 107, both accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No TODOs, FIXMEs, placeholder comments, empty return values, hardcoded empty arrays, or stub indicators found in either modified file. The two `as const` annotations are required TypeScript narrowing, not stubs.

### Human Verification Required

#### 1. Runtime Cache Activation Smoke Check

**Test:** Deploy to Vercel, make two POST requests to `/api/player-insight` with identical bodies within 5 minutes. After each request, grep Vercel logs for `[player-insight] cache`.
**Expected:** First call: `cache_creation_input_tokens=0, cache_read_input_tokens=0` (prompt is ~80 tokens, below Anthropic's 1024-token cache minimum — D-01). Once the prompt grows past 1024 tokens (Phase 108 or organic growth): second call with identical prompt shows `cache_read_input_tokens > 0`.
**Why human:** Requires live deployment and real Anthropic API traffic. Cannot be verified programmatically in the codebase. The plumbing is confirmed correct; only the runtime activation of the cache at Anthropic's infrastructure level requires a deploy + traffic test.

### Gaps Summary

No gaps. All five must-have truths are verified with direct codebase evidence. Both requirements (CACHE-01, CACHE-02) are satisfied. All 12 tests pass. TypeScript is clean. The sole human verification item (runtime smoke check) is a deferred operational check explicitly noted in the phase plan as out of scope for autonomous verification — it does not block the phase goal.

---

_Verified: 2026-05-14T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
