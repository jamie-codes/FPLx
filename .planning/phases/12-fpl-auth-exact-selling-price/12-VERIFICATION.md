---
phase: 12-fpl-auth-exact-selling-price
verified: 2026-03-30T22:21:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 12: FPL Auth + Exact Selling Price — Verification Report

**Phase Goal:** Managers who choose to log in with their FPL credentials see exact sell prices and true bank balance, enriching the recommendation engine without gating any feature for unauthenticated users.
**Verified:** 2026-03-30T22:21:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | User can log in with FPL email/password via a login form in the app and see exact selling prices replace approximate `now_cost` values in SquadView | VERIFIED | Login form with email/password in TransferPanel (lines 193-227); `exactSellPrices` map passed to SquadView; SquadView renders `£${pM}m` (no tilde) when `isAuthenticated && exactPrice !== undefined` |
| SC-2 | User can see exact bank balance (from `entry_history.bank`) when authenticated | VERIFIED | `effectiveEntryHistory` in TransferPanel switches to `myTeamData.entry_history` when authenticated; SquadView renders `£${bankM}m` (no tilde/approx) when `isAuthenticated` |
| SC-3 | All features work correctly for unauthenticated users — FPL login enriches but never gates | VERIFIED | `exactSellPrices` and `isAuthenticated` are optional props with safe defaults; unauthenticated path unchanged; tilde prices shown as fallback |
| SC-4 | FPL credentials never persisted beyond a single request lifecycle, never stored in pipeline | VERIFIED | No `console.log`, `fs.*`, `prisma.*`, or any write call in login route; no `email`/`password`/`pl_profile` references in `pipeline/` directory |

**Score:** 4/4 success criteria verified

---

### Plan 01 Must-Have Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P01-1 | POST /api/auth/login with valid FPL credentials sets an HttpOnly fpl_session cookie | VERIFIED | Route sets `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'` via `await cookies()` |
| P01-2 | POST /api/auth/login with invalid credentials returns 401 and no cookie | VERIFIED | `if (!plProfile)` returns `Response.json({ error: 'Invalid FPL credentials' }, { status: 401 })` — no `cookieStore.set` called on that path |
| P01-3 | POST /api/auth/logout clears the fpl_session cookie | VERIFIED | Sets `fpl_session` to `''` with `maxAge: 0` |
| P01-4 | GET /api/auth/status returns `{ isAuthenticated: true }` when cookie present, false otherwise | VERIFIED | Checks `session?.value` (not just `session`) — handles empty-value edge case |
| P01-5 | GET /api/fpl/my-team returns picks with selling_price and entry_history.bank when authenticated | VERIFIED | Fetches `https://fantasy.premierleague.com/api/my-team/`, validates with `parseMyTeamResponse`, returns `parsed.data` |
| P01-6 | GET /api/fpl/my-team returns 401 when not authenticated | VERIFIED | `if (!session?.value)` returns `Response.json({ error: 'Not authenticated' }, { status: 401 })` |

### Plan 02 Must-Have Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P02-1 | User sees a 'Log in for exact prices' nudge next to the bank balance display (D-01) | VERIFIED | TransferPanel line 190: `Log in for exact prices →`; positioned inside squad display section above SquadView |
| P02-2 | User can enter FPL email/password in an inline login form and submit to /api/auth/login | VERIFIED | Form with `type="email"` and `type="password"` inputs; `handleLogin` POSTs to `/api/auth/login` with JSON body |
| P02-3 | After successful login, nudge changes to 'Logged in [Log out]' indicator (D-01/D-03) | VERIFIED | `{isAuthenticated && <div>Logged in • <button onClick={handleLogout}>Log out</button></div>}` |
| P02-4 | Unauthenticated users see tilde prefix on sell prices: ~£X.Xm with tooltip (D-05) | VERIFIED | SquadView line 174: `<span title="Approximate sell price — log in for exact value">~£{pM}m <span>(approx)</span></span>` |
| P02-5 | Authenticated users see exact sell prices: £X.Xm without tilde (D-06) | VERIFIED | SquadView line 170-171: `if (isAuthenticated && exactPrice !== undefined) { return '£${pM}m' }` |
| P02-6 | Authenticated bank balance shows exact value without (approx) label (D-06) | VERIFIED | SquadView line 100: `{isAuthenticated ? '£${bankM}m' : <span title="Approximate...">~£{bankM}m</span>}` |
| P02-7 | All features work correctly without logging in — auth enriches, never gates | VERIFIED | New props are optional; unauthenticated default renders tilde prices; `useMyTeam` disabled when not authenticated |

**Combined score:** 11/11 plan must-have truths verified

---

## Required Artifacts

| Artifact | Provided | Status | Details |
|----------|----------|--------|---------|
| `src/lib/fpl-auth.ts` | `extractPlProfile` helper | VERIFIED | 49 lines; full implementation parsing `pl_profile=` from Set-Cookie array, Max-Age extraction, 7-day default |
| `src/lib/squad-adapter.ts` | `MyTeamPickSchema`, `MyTeamResponseSchema`, `parseMyTeamResponse` | VERIFIED | All 3 exports present; `MyTeamPickSchema` extends `SquadPickSchema` with `selling_price: z.number().int()` |
| `src/lib/squad-adapter.test.ts` | 6 unit tests | VERIFIED | All 6 pass: MyTeamPickSchema (2), MyTeamResponseSchema (2), parseMyTeamResponse (2) |
| `src/app/api/auth/login/route.ts` | POST handler | VERIFIED | `export async function POST`; `redirect: 'manual'`; `extractPlProfile`; `httpOnly: true`; `fpl_session`; FPL URL |
| `src/app/api/auth/logout/route.ts` | POST handler | VERIFIED | `export async function POST`; `maxAge: 0`; `await cookies()` |
| `src/app/api/auth/status/route.ts` | GET handler | VERIFIED | `export async function GET`; `isAuthenticated`; `session?.value` check |
| `src/app/api/fpl/my-team/route.ts` | GET handler | VERIFIED | `export async function GET`; `pl_profile=` forwarded; `parseMyTeamResponse`; `revalidate: 0` |
| `src/lib/hooks/useAuthStatus.ts` | TanStack Query hook | VERIFIED | `export function useAuthStatus`; `queryKey: ['auth-status']`; `staleTime: 1000 * 60 * 5`; `setAuthenticated`; `clearAuthenticated` |
| `src/lib/hooks/useMyTeam.ts` | TanStack Query hook | VERIFIED | `export function useMyTeam`; `queryKey: ['my-team']`; `AUTH_EXPIRED`; invalidates `auth-status` on 401 |
| `src/components/transfers/TransferPanel.tsx` | Login nudge + auth wiring | VERIFIED | `useAuthStatus` imported and called; `useMyTeam` gated on `isAuthenticated && !!submittedId`; `exactSellPrices` computed from `myTeamData`; login form JSX; logout handler |
| `src/components/squad/SquadView.tsx` | Tilde/exact price display | VERIFIED | `exactSellPrices?: Map<number, number>` and `isAuthenticated?: boolean` in interface; conditional rendering at price cell and bank balance |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/app/api/auth/login/route.ts` | `src/lib/fpl-auth.ts` | `import extractPlProfile` | WIRED | `import { extractPlProfile } from '@/lib/fpl-auth'`; called at line 51 |
| `src/app/api/fpl/my-team/route.ts` | `src/lib/squad-adapter.ts` | `import parseMyTeamResponse` | WIRED | `import { parseMyTeamResponse } from '@/lib/squad-adapter'`; called at line 41 |
| `src/lib/hooks/useAuthStatus.ts` | `/api/auth/status` | fetch in queryFn | WIRED | `fetch('/api/auth/status')` in `fetchAuthStatus()` |
| `src/lib/hooks/useMyTeam.ts` | `/api/fpl/my-team` | fetch in queryFn | WIRED | `fetch('/api/fpl/my-team')` in `fetchMyTeam()` |
| `src/components/transfers/TransferPanel.tsx` | `src/lib/hooks/useAuthStatus.ts` | `useAuthStatus` hook | WIRED | Import at line 6; destructured at line 28 |
| `src/components/transfers/TransferPanel.tsx` | `src/components/squad/SquadView.tsx` | `exactSellPrices` + `isAuthenticated` props | WIRED | Both props passed at lines 248-249; `exactSellPrices.*isAuthenticated` pattern confirmed |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SquadView.tsx` — price cell | `exactPrice` via `exactSellPrices?.get(pick.element)` | `useMyTeam` → `/api/fpl/my-team` → FPL API → Zod-validated `parsed.data.picks` | Yes — real FPL API fetch, Zod-parsed, mapped in `useMemo` | FLOWING |
| `SquadView.tsx` — bank balance | `bankM` from `entryHistory.bank` | When authenticated: `effectiveEntryHistory = myTeamData.entry_history` sourced from `/api/fpl/my-team` | Yes — real FPL authenticated response | FLOWING |
| `SquadView.tsx` — auth gating | `isAuthenticated` | `useAuthStatus` → `/api/auth/status` → server-side `cookies().get('fpl_session')` | Yes — server-side HttpOnly cookie check | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — auth flow requires an active FPL session (external service). The login route POSTs to `https://users.premierleague.com/accounts/login/` which cannot be hit without real FPL credentials and network access. Route handler correctness verified via code inspection; end-to-end flow reported as human-verified (Plan 02 Task 3, all 13 steps passed).

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| AUTH-01 | 12-01, 12-02 | User can log in with FPL credentials to unlock exact bank balance and sell prices | SATISFIED | Login route handler + useAuthStatus hook + TransferPanel login form; exact bank via `effectiveEntryHistory` |
| AUTH-02 | 12-01, 12-02 | User can see exact selling price from my-team endpoint when authenticated | SATISFIED | `/api/fpl/my-team` proxies FPL with `pl_profile` cookie; `MyTeamPickSchema.selling_price` validated; `exactSellPrices` map rendered in SquadView |

No orphaned requirements found — both AUTH-01 and AUTH-02 are claimed in plan frontmatter and traceable to implementation.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/fpl-auth.ts` | 48 | `return null` | Info | Valid sentinel: signals no `pl_profile` cookie found; login route correctly handles this as 401 — not a stub |

No blockers or warnings found.

---

## Human Verification Required

### 1. End-to-End Auth Flow (Already completed by Plan 02 Task 3)

**Test:** Run `npm run dev`, load squad, verify unauthenticated tilde prices, log in with FPL credentials, verify exact prices appear, log out, verify revert to approximate.
**Expected:** All 13 steps in Plan 02 Task 3 verification checklist pass.
**Why human:** Requires real FPL credentials and live FPL API response; cannot verify programmatically.
**Note:** Plan 02 SUMMARY records human verification passed across all 13 steps on 2026-03-30.

---

## Test Suite Results

- Squad adapter unit tests: 6/6 passed
- Full test suite: 163 passed, 8 skipped, 0 failed
- No regressions introduced

---

## Gaps Summary

None. All 11 plan must-have truths verified, all 4 roadmap success criteria satisfied, all 10 required artifacts substantive and wired, all 6 key links confirmed, both AUTH-01 and AUTH-02 requirements satisfied. Credentials are provably request-scoped only. Phase goal is achieved.

---

_Verified: 2026-03-30T22:21:00Z_
_Verifier: Claude (gsd-verifier)_
