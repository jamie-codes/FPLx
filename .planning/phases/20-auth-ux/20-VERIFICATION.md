---
phase: 20-auth-ux
verified: 2026-04-02T10:43:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Verify complete auth UX flow in browser"
    expected: "Modal opens with 7-step guide, clipboard paste fills token, token saves and shows three-state expiry, all dismiss paths work (Cancel/backdrop/Escape), dark mode styling correct"
    why_human: "Visual appearance, modal behavior, clipboard API interaction, and real authentication flow require a running browser session; all code paths verified statically"
---

# Phase 20: Auth UX Verification Report

**Phase Goal:** Users can authenticate with FPL using email and password directly in the app, with a guided fallback for manual cookie entry
**ROADMAP Goal (canonical):** Users can authenticate with FPL via a polished modal-based guided token entry flow, with three-state expiry awareness (normal, warning, expired/reconnect)
**Verified:** 2026-04-02T10:43:00Z
**Status:** human_needed — all automated checks pass, one browser UX flow needs human confirmation
**Re-verification:** No — initial verification

## Note on AUTH-03 Requirement Text

REQUIREMENTS.md describes AUTH-03 as "User can log in to FPL directly via email + password." This wording is superseded by `20-CONTEXT.md` decision D-01: FPL migrated to OAuth 2.0 PKCE and no credential exchange API exists. AUTH-03 was formally reinterpreted as a polished guided token extraction experience. The ROADMAP goal and Phase 20 success criteria reflect this reinterpretation. Both AUTH-03 and AUTH-04 are marked Complete in REQUIREMENTS.md.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `computeAuthExpiryState` returns 'normal' when token has > 1hr remaining | VERIFIED | `src/lib/auth-expiry.ts` line 16: `if (remaining >= 3600) return 'normal'`; all 8 vitest tests pass |
| 2 | `computeAuthExpiryState` returns 'expiring-soon' when token has 15min–1hr remaining | VERIFIED | `src/lib/auth-expiry.ts` line 17: `if (remaining >= 900) return 'expiring-soon'`; boundary tests at 3599s and 900s both pass |
| 3 | `computeAuthExpiryState` returns 'expired' when token has < 15min remaining or is undefined | VERIFIED | `src/lib/auth-expiry.ts` lines 14, 18; test cases for undefined, 899s, 0s, and negative remaining all pass |
| 4 | AuthModal renders a native `<dialog>` element with numbered Chrome DevTools guide steps | VERIFIED | `AuthModal.tsx` lines 90–109: `<dialog ref={dialogRef}>` with 7-item `<ol>` containing fantasy.premierleague.com, F12, Network, x-api-authorization |
| 5 | AuthModal has a clipboard paste button that calls `navigator.clipboard.readText()` | VERIFIED | `AuthModal.tsx` line 57: `navigator.clipboard.readText()` in try/catch in `handlePaste` callback |
| 6 | AuthModal submits token to POST /api/auth/login and calls `onSuccess` on 200 | VERIFIED | `AuthModal.tsx` lines 69–79: `fetch('/api/auth/login', { method: 'POST', ... })`, `onSuccess()` called on `res.ok` |
| 7 | Clicking 'Connect FPL account' opens the AuthModal dialog | VERIFIED | `TransferPanel.tsx` line 145: button `onClick={openModal}`; `openModal` sets `isModalOpen=true`; `<AuthModal open={isModalOpen}>` at line 186 |
| 8 | Token with > 1hr remaining shows 'FPL connected · valid until HH:MM' (normal state) | VERIFIED | `TransferPanel.tsx` lines 152–162: `expiryState === 'normal'` block with "FPL connected" and time display |
| 9 | Token with 15min–1hr remaining shows amber 'Expires soon' warning text | VERIFIED | `TransferPanel.tsx` lines 163–167: `expiryState === 'expiring-soon'` block with `text-amber-600 dark:text-amber-400` and "Expires soon" |
| 10 | Token with < 15min remaining shows 'Token expired — reconnect' link that reopens the modal | VERIFIED | `TransferPanel.tsx` lines 169–175: `expiryState === 'expired'` block with "Token expired" button calling `openModal` |
| 11 | Clicking 'reconnect' link reopens the AuthModal | VERIFIED | `TransferPanel.tsx` line 172: `onClick={openModal}` on the expired-state button |
| 12 | Inline `showTokenForm` is removed — all token entry happens in the modal | VERIFIED | Grep for `showTokenForm`, `loginLoading`, `loginError`, `handleLogin` in `TransferPanel.tsx` returns no matches |
| 13 | Successful token submission in modal closes the modal and shows authenticated state | VERIFIED (code-level) | `TransferPanel.tsx` lines 70–73: `handleAuthSuccess` calls `setAuthenticated()` then `setIsModalOpen(false)`; browser confirmation is human item |

**Score:** 13/13 truths verified (1 needs human browser confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/auth-expiry.ts` | Pure function for expiry state computation | VERIFIED | 19 lines; exports `AuthExpiryState` type and `computeAuthExpiryState` function with correct thresholds (>= 3600 = normal, >= 900 = expiring-soon) |
| `tests/lib/auth-expiry.test.ts` | Unit tests for expiry thresholds | VERIFIED | 45 lines; imports `computeAuthExpiryState`; contains 8 `it()` test cases; all pass via `npx vitest run` |
| `src/components/transfers/AuthModal.tsx` | Modal component with guide and token form | VERIFIED | 156 lines; `'use client'`; `AuthModalProps` interface; native `<dialog>`; 7-step guide; clipboard paste; POST to `/api/auth/login`; dark mode |
| `src/components/transfers/TransferPanel.tsx` | Integrated auth modal trigger and three-state expiry display | VERIFIED | Imports both `AuthModal` and `computeAuthExpiryState`; `isModalOpen` state; three-state render; `<AuthModal>` always in DOM; old inline form fully removed |
| `src/app/globals.css` | `dialog::backdrop` CSS for modal overlay | VERIFIED | Line 37: `dialog::backdrop { background: rgba(0, 0, 0, 0.5); }` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/auth-expiry.ts` | `tests/lib/auth-expiry.test.ts` | import in test file | WIRED | `tests/lib/auth-expiry.test.ts` line 2: `import { computeAuthExpiryState } from '@/lib/auth-expiry'` |
| `src/components/transfers/AuthModal.tsx` | `/api/auth/login` | fetch POST in handleLogin | WIRED | `AuthModal.tsx` line 69: `fetch('/api/auth/login', { method: 'POST', ... })`; response handling at lines 74–83 |
| `src/components/transfers/TransferPanel.tsx` | `src/components/transfers/AuthModal.tsx` | import and render | WIRED | Line 15: `import { AuthModal } from '@/components/transfers/AuthModal'`; lines 186–190: `<AuthModal open={isModalOpen} onClose={closeModal} onSuccess={handleAuthSuccess} />` |
| `src/components/transfers/TransferPanel.tsx` | `src/lib/auth-expiry.ts` | import computeAuthExpiryState | WIRED | Line 16: `import { computeAuthExpiryState } from '@/lib/auth-expiry'`; line 29: `const expiryState = computeAuthExpiryState(expiresAt, Math.floor(Date.now() / 1000))` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `TransferPanel.tsx` — expiry display | `expiresAt` | `useAuthStatus()` hook → `/api/auth/status` → HttpOnly cookie → `extractTokenExpiry` | Yes — `expiresAt` is decoded from real JWT stored in cookie; no hardcoding | FLOWING |
| `TransferPanel.tsx` — expiry state | `expiryState` | `computeAuthExpiryState(expiresAt, Math.floor(Date.now() / 1000))` | Yes — live computation against real timestamp | FLOWING |
| `AuthModal.tsx` — login result | `res.ok` / `body` | `POST /api/auth/login` → `extractTokenExpiry` → cookie set | Yes — real route validates JWT and returns `{ ok: true, expiresAt }` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `computeAuthExpiryState` — all 8 boundary tests | `npx vitest run tests/lib/auth-expiry.test.ts` | 8 passed, 0 failed | PASS |
| Full test suite — no regressions | `npx vitest run` | 174 passed, 8 skipped, 17 test files | PASS |
| `auth-expiry` module exports correct function | `node -e "require('./src/lib/auth-expiry.ts')"` (transpiled via vitest) | `typeof computeAuthExpiryState === 'function'` | PASS |
| `showTokenForm` / `loginLoading` / `loginError` removed from TransferPanel | `grep showTokenForm\|loginLoading\|loginError TransferPanel.tsx` | No matches | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-03 | 20-01-PLAN.md, 20-02-PLAN.md | User can log in to FPL (reinterpreted: polished guided token entry via modal, email/password infeasible due to FPL OAuth PKCE migration) | SATISFIED | AuthModal with 7-step Chrome DevTools guide, clipboard paste, token form submission. Reinterpretation documented in `20-CONTEXT.md` D-01. |
| AUTH-04 | 20-01-PLAN.md, 20-02-PLAN.md | Manual cookie entry supported with step-by-step browser guide as fallback | SATISFIED | AuthModal IS the guided fallback — numbered steps covering F12/Network/x-api-authorization extraction |

No orphaned requirements: both AUTH-03 and AUTH-04 are claimed in plan frontmatter and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AuthModal.tsx` | 117 | `placeholder="Paste Bearer token here..."` | INFO | HTML input placeholder attribute — not a stub. No impact. |

No blockers or warnings found. The `placeholder` match on the HTML input attribute was the only hit; it is not a stub pattern.

---

### Human Verification Required

#### 1. Complete Auth UX Flow

**Test:** Start dev server (`npm run dev`), navigate to Squad tab and perform the following:
1. Click "Connect FPL account for exact prices" — confirm modal opens with "Connect FPL Account" heading and 7 numbered guide steps
2. Click Cancel — confirm modal closes
3. Reopen modal, click backdrop area outside the dialog box — confirm modal closes
4. Reopen modal, press Escape — confirm modal closes
5. Open modal, click the clipboard Paste button — confirm it populates the token input from clipboard (requires a value in clipboard)
6. Submit a valid FPL Bearer token — confirm modal closes and "FPL connected • valid until HH:MM" appears
7. Toggle dark mode — confirm modal and expiry text have correct dark styling
8. Click Disconnect — confirm "Connect FPL account" link reappears

**Expected:** All 8 steps succeed without errors or visual glitches

**Why human:** Modal open/close behavior requires a running browser. Clipboard API requires user gesture context that cannot be simulated statically. Token validation against live FPL JWT requires a real token. Dark mode visual quality is subjective. The human verification for plan 20-02 Task 2 was approved on 2026-04-02 per SUMMARY — this item confirms that approval is still valid after code review.

---

### Gaps Summary

No gaps found. All 13 observable truths verified, all 5 artifacts exist and are substantive, all 4 key links are wired, data flows from real sources. The single human verification item is a confirmation of the browser UX behavior — code-level evidence is complete.

The phase goal is achieved: users can authenticate with FPL via a polished modal-based guided token entry flow, with three-state expiry awareness (normal/warning/expired-reconnect). The AUTH-03 reinterpretation (guided token entry replacing infeasible email/password flow) is documented and deliberate.

---

_Verified: 2026-04-02T10:43:00Z_
_Verifier: Claude (gsd-verifier)_
