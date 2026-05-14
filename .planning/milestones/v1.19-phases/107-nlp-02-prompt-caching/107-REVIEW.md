---
phase: 107-nlp-02-prompt-caching
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/app/api/player-insight/route.ts
  - src/app/api/player-insight/route.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 107: Code Review Report

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the per-player LLM insight route and its test suite. The route is generally well-structured — Zod validation, XML escaping, fire-and-forget cache writes, and the corpus-emptiness guard are all sound. One critical bug exists: string elements inside `rejection_reasons` and `fragility.reasons` arrays have no length cap, allowing arbitrarily large payloads to reach the LLM and bypass the `max_tokens` cost guard at the prompt level. Four warnings cover a logic dead-branch in XML building, a missing runtime declaration, a test that silently bypasses the guardrail under `USE_BLOB=false`, and a missing status assertion in the retry test. Two info items cover an unconditional `console.log` in production and a missing `export const runtime`.

---

## Critical Issues

### CR-01: No maximum length on `rejection_reasons` and `fragility.reasons` string elements

**File:** `src/app/api/player-insight/route.ts:34,37`

**Issue:** The Zod schema caps the *count* of array elements at 10 but places no length limit on each individual string:

```typescript
rejection_reasons: z.array(z.string()).max(10),   // strings unbounded
fragility: z.object({
  reasons: z.array(z.string()).max(10),            // strings unbounded
```

Every element is embedded verbatim into the XML context that is sent as the LLM user message. A caller can supply 10 strings each containing megabytes of text. This circumvents the `max_tokens: 300` output guard (which caps *output*, not input), inflates cost unpredictably, and could push the prompt past the model's context window and cause a 500-class upstream error. Because the route is a server-side API with an Anthropic API key, any user who can POST to it can force unbounded spend.

**Fix:**
```typescript
rejection_reasons: z.array(z.string().max(200)).max(10),
fragility: z.object({
  tier: z.enum(['robust', 'fragile', 'knife_edge']),
  reasons: z.array(z.string().max(200)).max(10),
}),
```
200 characters is generous for a human-readable reason string and still far below any token concern.

---

## Warnings

### WR-01: `mcAttr` empty-string check is always false when all optional fields are absent — `<mc/>` element is silently dropped

**File:** `src/app/api/player-insight/route.ts:88-108`

**Issue:** `mcAttr` is built by joining an array of empty strings:

```typescript
const mcAttr = [
  player.haul_prob !== undefined ? ` haul_prob="..."` : '',
  player.blank_prob !== undefined ? ` blank_prob="..."` : '',
  player.p10_pts !== undefined   ? ` p10_pts="..."`   : '',
  player.p90_pts !== undefined   ? ` p90_pts="..."`   : '',
].join('')
```

When all four optional fields are absent, `mcAttr` is `''` (empty string). The conditional on line 108 is:

```typescript
mcAttr ? `\n  <mc${mcAttr}/>` : '',
```

An empty string is falsy in JavaScript, so the `<mc/>` element is silently omitted when *all* optional fields are absent. This is the intended behaviour in that degenerate case, but it is a logic branch that produces no XML element at all — not even `<mc/>` with no attributes — which could confuse the LLM or differ from what the schema implies. If a self-closing `<mc/>` with no attributes is a valid sentinel, it should always be emitted; if it is meaningless without attributes, the logic is correct but deserves a comment. As written it is an invisible silent drop with no test coverage for this path.

**Fix (option A — always emit `<mc/>`)**:
```typescript
`\n  <mc${mcAttr}/>`
```

**Fix (option B — document the intent)**:
```typescript
// <mc/> is omitted when no optional MC fields are provided (valid: LLM ignores absent element)
mcAttr ? `\n  <mc${mcAttr}/>` : '',
```

### WR-02: Missing `export const runtime = 'nodejs'` declaration

**File:** `src/app/api/player-insight/route.ts:1-15`

**Issue:** The route comment on line 9 states "Runtime: Node.js ONLY — never Edge", and the test on line 239 verifies the *absence* of `runtime = 'edge'`. But no affirmative `export const runtime = 'nodejs'` declaration is present. In Next.js App Router, the default runtime depends on project-level configuration (`next.config`). If the project-level default is ever changed to Edge (or a future Next.js version changes the default), this route will silently break because `@anthropic-ai/sdk` SSE parsing fails on Edge and `fs/promises`/`path` are not available there. The test only checks the negative — it does not assert that `runtime = 'nodejs'` is present.

**Fix:**
```typescript
// Add after maxDuration export:
export const runtime = 'nodejs'
```
The test should also be updated to assert `src.toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/)`.

### WR-03: `USE_BLOB=false` test silently bypasses the guardrail — false 200 success

**File:** `src/app/api/player-insight/route.test.ts:203-219`

**Issue:** When `USE_BLOB=false`, `readPlayerCorpus` falls through to the `readFile` path. The `readFile` mock (`vi.fn()`) has no configured return value, so `await readFile(...)` resolves to `undefined`. `JSON.parse(undefined)` throws a `SyntaxError`, the `catch` block returns `[]`, and `corpus` is an empty array. `passesGuardrail(prose, allowed, [])` then calls `findHallucinatedNames` with an empty `candidatePlayerNames` array, iterating over nothing and always returning `[]` — the guardrail is vacuously satisfied for any prose.

The test asserts `res.status === 200` and `put` not called, which both pass — but for the wrong reason. If someone later fixes the corpus path to actually reject bad prose, this test will still pass even if the guardrail is broken in the `USE_BLOB=false` path.

**Fix:** Mock `readFile` to return a valid corpus in this test, same as the production Blob path:

```typescript
it('does NOT call put when USE_BLOB=false', async () => {
  process.env.USE_BLOB = 'false'
  const { readFile } = await import('fs/promises')
  ;(readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
    JSON.stringify([{ web_name: 'Salah' }, { web_name: 'Haaland' }])
  )
  // ... rest of test
})
```

### WR-04: Retry test does not assert the response status code

**File:** `src/app/api/player-insight/route.test.ts:100-120`

**Issue:** The test `'retries with strict prompt after first guardrail fail'` calls `await POST(makeReq(validBody))` but never inspects the returned `Response`. It only checks that `create` was called twice and that the system prompts differ. The test therefore cannot detect a regression where the second attempt succeeds (guardrail passes) but the route nevertheless returns a non-200 status.

**Fix:**
```typescript
const res = await POST(makeReq(validBody))
expect(res.status).toBe(200)
expect(create).toHaveBeenCalledTimes(2)
// ...
```

---

## Info

### IN-01: Unconditional `console.log` in production request path

**File:** `src/app/api/player-insight/route.ts:184-188`

**Issue:** A `console.log` is emitted on every successful LLM call in production. While the logged data is not sensitive (token counts), this adds noise to Vercel function logs and will incur cost if log ingestion is metered. In a server-side route intended for production use, structured logging or a guarded debug flag is preferable.

**Fix:** Gate behind an env flag or remove entirely:
```typescript
if (process.env.DEBUG_CACHE_TOKENS === 'true') {
  console.log('[player-insight] cache', { ... })
}
```

### IN-02: `prose-guardrail` is not mocked in the test suite — real implementation runs on all guardrail-dependent tests

**File:** `src/app/api/player-insight/route.test.ts:7-13`

**Issue:** Three mocks are declared (`fs/promises`, `@vercel/blob`, `@anthropic-ai/sdk`), but `@/lib/prose-guardrail` is not mocked. All guardrail behaviour in the tests (422 on hallucination, 200 on pass) depends on the real `passesGuardrail` implementation and the real corpus content injected via the `fetch` mock. This is fine as integration coverage, but it means a bug in `prose-guardrail` will manifest as failures in these route tests with no clear attribution. It also means the 422 test is testing the guardrail's correctness, not just the route's response behaviour.

This is a test design observation, not a correctness bug. If intent is to unit-test the route in isolation, mock the guardrail. If intent is integration coverage, add a comment making this explicit.

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
