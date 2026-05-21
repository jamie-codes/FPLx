---
phase: 130-auth-fix
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/app/api/auth/fpl-login/route.ts
  - src/app/api/auth/fpl-login/route.test.ts
  - src/components/transfers/AuthModal.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 130: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 130 replaces the broken FPL credential-proxy endpoint with a deliberate stub that immediately returns `ENDPOINT_GONE`, and strips the credentials UI from `AuthModal` down to the token-paste flow only. The stub itself is correct and minimal. However, there are concrete bugs across the test file and the modal component: the test file passes a `NextRequest` argument to a function whose signature accepts no arguments (a TypeScript type error that may also surface at runtime depending on strict mode), the `/api/auth/login` error handler leaks internal error detail to the client, and the modal's token input field is typed as `text` rather than `password`-equivalent, exposing the Bearer token in plaintext in autocomplete history and browser password managers.

---

## Critical Issues

### CR-01: `detail: String(err)` leaks internal error stack/message to the client in `/api/auth/login`

**File:** `src/app/api/auth/login/route.ts:55`
**Issue:** The catch block in the token-paste handler serialises the raw caught value and sends it as `detail` in the 500 response body. The `AuthModal` then surfaces `body.detail` directly as a user-facing error string (line 74 of `AuthModal.tsx`). A programming error, unexpected network condition, or malformed cookie store exception will expose internal implementation details, file paths, or stack frames to the browser. This is the definition of an information-disclosure vulnerability.

**Fix:**
```typescript
// src/app/api/auth/login/route.ts — catch block
} catch (err) {
  console.error('[auth/login] caught error:', err)
  return Response.json(
    { error: 'Login failed' },   // remove 'detail' field entirely
    { status: 500 }
  )
}
```

And update `AuthModal.tsx` line 74 to stop reading `body.detail`:
```typescript
setManualError(body.error ?? 'Invalid token')
```

---

## Warnings

### WR-01: Test file calls `POST(req)` but the route exports `POST()` with no parameters — type mismatch

**File:** `src/app/api/auth/fpl-login/route.test.ts:17,27,38,50,62`
**Issue:** Every test invocation passes a `NextRequest` argument to `POST`. The stub's declared signature is `export async function POST(): Promise<Response>` — it accepts zero arguments. TypeScript in strict mode will flag every call site as a type error (`Expected 0 arguments, but got 1`). While JavaScript silently ignores extra arguments at runtime and the tests will currently pass, this creates a false contract: the tests appear to be exercising the handler with different request shapes when the handler ignores all of them. If the stub is ever amended to read the request (e.g. for logging), the zero-parameter signature must also be updated — and the divergence between signature and test invocation is a maintenance trap.

**Fix:** Align the route signature with the test invocations (and with Next.js Route Handler convention, which passes the request object):
```typescript
// route.ts
export async function POST(_request: Request): Promise<Response> {
  return Response.json({ ok: false, code: 'ENDPOINT_GONE' }, { status: 200 })
}
```

### WR-02: Bearer token displayed in a plain `type="text"` input — exposed to autocomplete and browser history

**File:** `src/components/transfers/AuthModal.tsx:108`
**Issue:** The token input is `type="text"`. Bearer tokens are long-lived secrets (8-hour JWTs). A `text` input is eligible for browser autocomplete, form-fill, and is saved in browser form-fill history. On shared machines or if a browser extension reads autocomplete data, the token can leak. Additionally the clipboard paste button copies the full token into the field in plain view on screen.

**Fix:** Use `type="password"` to suppress autocomplete storage and prevent shoulder-surfing, while still allowing the Paste button to fill the value programmatically:
```tsx
<input
  type="password"
  autoComplete="off"
  placeholder="Paste Bearer token here…"
  value={tokenInput}
  onChange={e => setTokenInput(e.target.value)}
  required
  className="..."
/>
```

Note: `type="password"` does not prevent `navigator.clipboard.readText()` from filling the field via the Paste button — that path is unaffected.

### WR-03: Silent swallow of clipboard permission error gives no feedback to the user

**File:** `src/components/transfers/AuthModal.tsx:57-59`
**Issue:** The catch block in `handlePaste` discards the `NotAllowedError` exception with only a comment. When clipboard access is denied (common in Firefox and in HTTP contexts), the Paste button appears to do nothing with no indication to the user. The comment says "user can still paste manually" — but there is no hint rendered to guide them to do that.

**Fix:** Set `manualError` (or a dedicated clipboard-specific message) so the user understands why the button did nothing:
```typescript
const handlePaste = useCallback(async () => {
  try {
    const text = await navigator.clipboard.readText()
    setTokenInput(text.trim())
  } catch {
    setManualError('Clipboard access denied — paste the token manually using Ctrl+V / Cmd+V')
  }
}, [])
```

---

## Info

### IN-01: `vi.spyOn(globalThis, 'fetch')` mock in `beforeEach` is never reset

**File:** `src/app/api/auth/fpl-login/route.test.ts:7-9`
**Issue:** The test suite mocks `globalThis.fetch` using `vi.spyOn` but never calls `vi.restoreAllMocks()` in an `afterEach`. For this specific stub the mock is irrelevant (the handler never calls `fetch`), but the spy leaks into any tests that run after this suite in the same worker process. The test for no-fetch invocation (Test 5) also relies on the spy being in place, but since `spyOn` is called in `beforeEach` and never cleared, all five tests share the same accumulating call count, which could produce a false negative for Test 5 if test execution order ever changes.

**Fix:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})
```

### IN-02: `console.error` in `/api/auth/login` is a debug artifact from the old credential-proxy implementation

**File:** `src/app/api/auth/login/route.ts:53`
**Issue:** `console.error('[auth/login] caught error:', err)` logs the full error object to the server console. This is a remnant of the credential-proxy debugging. In production this will write error details (potentially including token fragments if they appear in stack traces) to server logs. Server-side error logging is not inherently wrong, but the log prefix and detail level should be intentional — at minimum the full `err` object should not be logged if the `detail` field exposure is fixed per CR-01.

**Fix:** Log a sanitised message rather than the raw error object:
```typescript
console.error('[auth/login] unexpected error storing token')
```

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
