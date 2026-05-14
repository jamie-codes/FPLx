# Phase 107: NLP-02 Prompt Caching - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 2 (1 modified source + 1 modified test)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/player-insight/route.ts` | route/controller | request-response | `src/app/api/prose-summary/route.ts` | exact |
| `src/app/api/player-insight/route.test.ts` | test | request-response | `src/app/api/prose-summary/route.test.ts` | exact |

---

## Pattern Assignments

### `src/app/api/player-insight/route.ts` (route, request-response)

**Analog:** `src/app/api/prose-summary/route.ts`

This is a surgical edit to one function — the two-attempt guardrail loop. Only lines 173–219
of the existing file need to change. The prose-summary route is the direct structural twin
(same guard loop, same SDK call shape, same `system: string` today).

---

#### Imports pattern — no new imports required

The existing import block (route.ts lines 1–6) is unchanged. `TextBlockParam` and
`CacheControlEphemeral` come from the same `@anthropic-ai/sdk` package already imported and
do not need a named import — the object literal `{ type: 'text', text: ..., cache_control: { type: 'ephemeral' } }`
satisfies the type structurally without an explicit import of `TextBlockParam`.

If an explicit type import is desired for documentation purposes:

```typescript
import Anthropic, { type TextBlockParam } from '@anthropic-ai/sdk'
```

SDK type source: `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` lines 887–894
```typescript
export interface TextBlockParam {
    text: string;
    type: 'text';
    cache_control?: CacheControlEphemeral | null;
    citations?: Array<TextCitationParam> | null;
}
```

SDK type source: `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` lines 150–153
```typescript
export interface CacheControlEphemeral {
    type: 'ephemeral';
    // ttl field is optional and not needed for Phase 107
}
```

SDK parameter signature (line 1946):
```typescript
system?: string | Array<TextBlockParam>;
```

No `betas` header is required — `cache_control` on `TextBlockParam` is part of the stable SDK.

---

#### Core pattern — the `client.messages.create` call site

**Current code** (`src/app/api/player-insight/route.ts` lines 173–191):

```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  const system = buildSystemPrompt(attempt === 1, body.player.web_name)
  let prose = ''
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const block = msg.content[0]
    prose = block && block.type === 'text' ? block.text : ''
  } catch (err) {
    if (attempt === 1) {
      return Response.json({ error: 'LLM error', detail: 'upstream call failed' }, { status: 502 })
    }
    continue
  }
```

**Modified pattern — wrap `system` in `TextBlockParam[]` and log cache metrics:**

```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  const systemText = buildSystemPrompt(attempt === 1, body.player.web_name)
  const system = [{ type: 'text' as const, text: systemText, cache_control: { type: 'ephemeral' as const } }]
  let prose = ''
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    console.log('[player-insight] cache', {
      attempt,
      cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
    })
    const block = msg.content[0]
    prose = block && block.type === 'text' ? block.text : ''
  } catch (err) {
    if (attempt === 1) {
      return Response.json({ error: 'LLM error', detail: 'upstream call failed' }, { status: 502 })
    }
    continue
  }
```

Key points:
- `buildSystemPrompt()` signature is unchanged — it still returns `string`
- The local variable rename from `system` (string) to `systemText` then wrapping avoids a type collision
- `as const` on both `type` literals satisfies the discriminated union
- Log line placed immediately after `client.messages.create` resolves, before content extraction — applies to BOTH attempt 0 and attempt 1 (D-05)
- `?? 0` on both cache fields: SDK types them as `number | null` (not `number | undefined`), so null-coalescing handles the absent-when-zero case (D-06)
- The rest of the loop body (guardrail check, blob write, response) is unchanged

---

#### SDK `Usage` type confirmation

`node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` lines 1395–1408:
```typescript
export interface Usage {
    cache_creation: CacheCreation | null;
    cache_creation_input_tokens: number | null;
    cache_read_input_tokens: number | null;
    inference_geo: string | null;
    input_tokens: number;
    output_tokens: number;
}
```

`msg.usage` is available directly on the `Message` return value — no beta path needed.

---

#### Error handling pattern — unchanged

Existing pattern (`src/app/api/player-insight/route.ts` lines 185–191):
```typescript
  } catch (err) {
    // On last attempt, give up and surface 502; otherwise retry
    if (attempt === 1) {
      return Response.json({ error: 'LLM error', detail: 'upstream call failed' }, { status: 502 })
    }
    continue
  }
```

This is not modified. The cache log must be inside the `try` block (after `await client.messages.create`) so it never executes on a thrown error.

---

### `src/app/api/player-insight/route.test.ts` (test, request-response)

**Analog:** `src/app/api/prose-summary/route.test.ts`

The existing test file mocks the Anthropic SDK with a plain `{ content: [...] }` response object
that does not include `usage`. After the route change, `msg.usage.cache_creation_input_tokens`
will be accessed — without `usage` on the mock response this will throw a TypeError and all
non-error-path tests will fail.

---

#### Mock response shape — current vs required

**Current mock shape** (used in every success-path test, e.g. `route.test.ts` lines 120–127):
```typescript
create: vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Salah looks strong this week.' }],
})
```

**Required mock shape** — add `usage` field:
```typescript
create: vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Salah looks strong this week.' }],
  usage: {
    input_tokens: 50,
    output_tokens: 80,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
})
```

This change must be applied to every `mockResolvedValue` in the test file that returns a
success response (lines 88, 101–104, 121–124, 142–145, 163–166, 180–183, 196–200).
The error-path mock (line 72 — `mockRejectedValue`) is unaffected.

---

#### System prompt assertion — must accept array shape

The existing test `'retries with strict prompt after first guardrail fail'`
(route.test.ts lines 99–117) asserts that the two `system` values differ:
```typescript
const firstSystemPrompt = create.mock.calls[0][0].system
const secondSystemPrompt = create.mock.calls[1][0].system
expect(firstSystemPrompt).not.toEqual(secondSystemPrompt)
```

After the change, `system` is a `TextBlockParam[]`. The assertion `not.toEqual` still holds
because the `text` field differs between attempt 0 and attempt 1 (strict mode appends the
`STRICT MODE:` clause). No change needed to the assertion itself — it will continue to pass
because two arrays with different `text` values are not deeply equal.

However, if an explicit shape assertion is desired as new coverage:
```typescript
// Assert system is now an array with cache_control
const systemParam = create.mock.calls[0][0].system
expect(Array.isArray(systemParam)).toBe(true)
expect(systemParam[0]).toMatchObject({
  type: 'text',
  cache_control: { type: 'ephemeral' },
})
```

---

#### Mock structure pattern — from `prose-summary/route.test.ts`

The Anthropic constructor mock pattern used in both test files
(`src/app/api/prose-summary/route.test.ts` lines 7–13):
```typescript
vi.mock('@anthropic-ai/sdk', () => ({
  // Rule 1 fix: use regular function (not arrow) so vi.fn() can proxy as a constructor
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: vi.fn() } }
  }),
}))
```

Per-test override pattern (prose-summary lines 80–87):
```typescript
;(Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '...' }],
        usage: { input_tokens: 50, output_tokens: 80,
                  cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
    },
  }
})
```

Use `vi.clearAllMocks()` in `beforeEach` (already present at route.test.ts line 46) to reset
between tests — pattern already established.

---

## Shared Patterns

### Anthropic SDK `system` as `TextBlockParam[]`
**Source:** `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` line 1946
**Apply to:** The two `client.messages.create` calls inside the attempt loop (attempt 0 and attempt 1)

Both calls share the same wrapping pattern — `buildSystemPrompt()` returns a string, then
the caller wraps it:
```typescript
const system = [{ type: 'text' as const, text: systemText, cache_control: { type: 'ephemeral' as const } }]
```

### Cache metric logging
**Source:** D-05 and D-06 from CONTEXT.md
**Apply to:** Both SDK calls in the loop

```typescript
console.log('[player-insight] cache', {
  attempt,
  cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? 0,
  cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? 0,
})
```

Grep anchor in Vercel logs: `[player-insight] cache`

### `console.log` convention
**Source:** `src/app/api/player-insight/route.ts` (existing error log at line 188 is implicit via the error return; other routes use same style)
**Pattern:** Structured object second argument, bracketed prefix string first argument

---

## No Analog Found

None. Both modified files have exact analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/app/api/`
**Files scanned:** `route.ts`, `route.test.ts` for player-insight and prose-summary; SDK declaration file `messages.d.ts`
**Pattern extraction date:** 2026-05-14
