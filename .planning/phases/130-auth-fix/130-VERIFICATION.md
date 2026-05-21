---
phase: 130-auth-fix
verified: 2026-05-21T15:30:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open AuthModal in browser and confirm token-paste-only UI"
    expected: "Modal shows 'Connect FPL Account' heading, 5-step numbered instructions, token input with Paste button, Save token and Cancel buttons. No email/password fields. No mode tabs."
    why_human: "React component rendering cannot be verified programmatically without a running dev server"
  - test: "Close and reopen AuthModal"
    expected: "Reopens to the same token-paste view with no prior state; no console errors"
    why_human: "Stateful UI lifecycle requires browser interaction"
  - test: "Submit an invalid token via the modal"
    expected: "Error message appears under the input proving /api/auth/login is still wired and responding"
    why_human: "Network request behaviour requires a running server"
  - test: "Check Network tab while modal is open"
    expected: "No fetch to /api/auth/fpl-login at any point during normal modal use"
    why_human: "Runtime network monitoring requires DevTools"
---

# Phase 130: Auth Fix Verification Report

**Phase Goal:** The FPL login route handler returns a clean ENDPOINT_GONE error immediately rather than proxying a dead credential endpoint, so users always reach the working token-paste flow without 502 errors
**Verified:** 2026-05-21T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/auth/fpl-login responds with HTTP 200 (never 502, never 5xx) | VERIFIED | `route.ts` line 12: `Response.json({ ok: false, code: 'ENDPOINT_GONE' }, { status: 200 })` — unconditional single return path |
| 2 | Response body is exactly `{ ok: false, code: "ENDPOINT_GONE" }` regardless of input | VERIFIED | Route has no body parsing, no branching — single return site. Test 2 and Test 3 assert `toEqual({ ok: false, code: 'ENDPOINT_GONE' })` for credential body and empty body respectively |
| 3 | Route handler performs no outbound fetch to users.premierleague.com | VERIFIED | Grep for `fetch` in `route.ts` returns only a comment (line 9). No `fetch(` call site exists. Test 5 spies on `globalThis.fetch` and asserts `not.toHaveBeenCalled()` |
| 4 | Route handler imports no auth utilities (no extractTokenExpiry, no cookies) | VERIFIED | `route.ts` is 13 lines with zero import statements — the only export is the POST function |
| 5 | Opening AuthModal displays the token-paste form immediately with no mode tabs | VERIFIED (code) / HUMAN NEEDED (visual) | `AuthModal.tsx` contains no `mode` state, no tab JSX, no conditional wrapping the manual form. Form renders unconditionally at line 97. Visual confirmation required. |
| 6 | Users cannot enter an FPL email/password anywhere in AuthModal | VERIFIED | Grep for `setEmail`, `setPassword`, `credLoading`, `credError`, `handleCredentialsLogin`, `fpl-login`, `type Mode` all return 0 matches in `AuthModal.tsx` |
| 7 | TransferPanel.tsx consumes AuthModal via its existing open/onClose/onSuccess props without modification | VERIFIED | `TransferPanel.tsx` lines 356-359: `<AuthModal open={isModalOpen} onClose={closeModal} onSuccess={handleAuthSuccess} />` — unchanged consumer |

**Score:** 7/7 truths verified (4 require human visual/runtime confirmation per items above)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/auth/fpl-login/route.ts` | Immediate ENDPOINT_GONE stub, max 40 lines | VERIFIED | 13 lines. Exports single `POST(): Promise<Response>`. Returns `{ ok: false, code: 'ENDPOINT_GONE' }` status 200 unconditionally. Zero imports. |
| `src/app/api/auth/fpl-login/route.test.ts` | Vitest contract test, 5 tests, contains ENDPOINT_GONE | VERIFIED | 65 lines. First line `// @vitest-environment node`. 5 `it()` blocks in one describe. All 5 call `POST(req)` and assert on the stub shape or no-fetch behaviour. |
| `src/components/transfers/AuthModal.tsx` | Token-paste-only modal, contains `tokenInput` | VERIFIED | 144 lines (reduced from 263). Contains `tokenInput` (state decl + input binding). No credential state, no mode state. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/components/transfers/AuthModal.tsx` | `/api/auth/login` | `fetch POST` in `handleManualLogin` | WIRED | `AuthModal.tsx` line 67: `fetch('/api/auth/login', { method: 'POST', ... })` |
| `src/components/transfers/TransferPanel.tsx` | `src/components/transfers/AuthModal.tsx` | `import` + `open/onClose/onSuccess` props | WIRED | Import at line 21, usage at line 356 with all three props |
| `src/app/api/auth/fpl-login/route.ts` | (no upstream) | Unconditional stub | VERIFIED | No outbound fetch. Plan 01 key_link noted this consumer was removed in Plan 02 — confirmed: `fpl-login` does not appear in `AuthModal.tsx` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `route.ts` | Static constant | None (stub) | N/A — intentional dead stub | VERIFIED — stub by design, no data source needed |
| `AuthModal.tsx` | `tokenInput` | User input (`onChange`) | Yes — flows to POST body for `/api/auth/login` | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running dev server — routed to human verification above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-05 | 130-01-PLAN.md | FPL login route handler returns ENDPOINT_GONE immediately, no 502 | SATISFIED | `route.ts` returns `{ ok: false, code: 'ENDPOINT_GONE' }` HTTP 200 unconditionally; 5-test suite locks the shape |
| AUTH-06 | 130-02-PLAN.md | User always sees token-paste flow without credential endpoint blocking them | SATISFIED (code) | `AuthModal.tsx` renders token-paste form unconditionally; no credential path exists; working `/api/auth/login` endpoint still wired. Visual confirmation in human check. |

Both AUTH-05 and AUTH-06 are assigned to Phase 130 in `REQUIREMENTS.md` traceability table. Both are claimed by a plan. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `route.ts` | 9 | Comment contains word "fetch" | Info | False positive — the comment describes what the route does NOT do. No code fetch call exists. |

No blockers. No stubs. No TODO/FIXME/placeholder text. No hardcoded empty data flowing to render.

### Human Verification Required

#### 1. Token-paste-only modal renders correctly

**Test:** Start dev server (`npm run dev`), navigate to Transfers, trigger the auth modal.
**Expected:** Modal heading "Connect FPL Account", 5-step numbered instructions, token input + Paste button, Save token + Cancel buttons. No email/password fields. No "Email & password" / "Manual token" mode tabs.
**Why human:** React component rendering requires a browser; cannot verify JSX output programmatically.

#### 2. Modal state resets cleanly

**Test:** Open AuthModal, Cancel, reopen. Then Escape, reopen.
**Expected:** Reopens to same token-paste view each time with empty input and no error. No console errors.
**Why human:** Stateful UI lifecycle (useEffect reset, native dialog close event) requires browser interaction.

#### 3. Working endpoint still wired

**Test:** Paste a deliberately invalid token (e.g. "not-a-jwt") and click Save token.
**Expected:** Error message appears under the input from `/api/auth/login` — proves the working endpoint responds.
**Why human:** Network request and server response require a running Next.js server.

#### 4. Dead endpoint not called by modal

**Test:** Open DevTools Network tab. Open and interact with AuthModal.
**Expected:** No fetch to `/api/auth/fpl-login` at any point.
**Why human:** Runtime network monitoring requires DevTools; the code grep confirms no call site, but runtime confirmation closes the loop.

### Gaps Summary

No gaps. All 7 must-have truths are verified at the code level. Both requirement IDs (AUTH-05, AUTH-06) are satisfied by their respective plans. The 4 human verification items are runtime/visual confirmations of truths already verified in the codebase — they do not represent missing implementation.

---

_Verified: 2026-05-21T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
