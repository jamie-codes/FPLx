---
phase: 130-auth-fix
plan: 01
subsystem: auth
tags: [nextjs, api-route, stub, tdd]

requires: []
provides:
  - POST /api/auth/fpl-login returns { ok: false, code: "ENDPOINT_GONE" } on HTTP 200 unconditionally
  - Contract test locking AUTH-05 response shape (5 tests)
  - Credential forwarding attack surface eliminated
affects:
  - 130-02 (AuthModal cleanup — backend stub is now stable)

tech-stack:
  added: []
  patterns:
    - "Soft-failure response shape: Response.json({ ok: false, code: '...' }, { status: 200 }) — same idiom as NO_TOKEN responses"
    - "TDD RED/GREEN cycle: test file committed before implementation file"

key-files:
  created:
    - src/app/api/auth/fpl-login/route.test.ts
  modified:
    - src/app/api/auth/fpl-login/route.ts

key-decisions:
  - "Parameter omitted entirely from POST(): no unused _request parameter avoids lint warning; Next.js route handlers do not require the request parameter when it is not used"
  - "Comment omits ENDPOINT_GONE string to satisfy grep-c=1 acceptance criterion (single response site)"

patterns-established:
  - "Stub route pattern: export async function POST(): Promise<Response> { return Response.json({ ok: false, code: 'X' }, { status: 200 }) }"

requirements-completed:
  - AUTH-05

duration: 2min
completed: 2026-05-21
---

# Phase 130 Plan 01: Auth Fix (Backend Stub) Summary

**13-line ENDPOINT_GONE stub replaces 120-line dead credential proxy in fpl-login/route.ts, eliminating 502 errors and credential forwarding attack surface**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-21T13:58:31Z
- **Completed:** 2026-05-21T14:01:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced 120-line dead credential proxy with a 13-line ENDPOINT_GONE stub (AUTH-05)
- Eliminated outbound fetch to users.premierleague.com (T-130-01 mitigated)
- Removed all credential/session machinery: fetch, cookies helper, extractTokenExpiry, try/catch
- Contract test (5 tests) locks the response shape so any future regression surfaces immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing contract test for ENDPOINT_GONE stub (RED)** - `865882b` (test)
2. **Task 2: Replace fpl-login route body with ENDPOINT_GONE stub (GREEN)** - `a6ffec5` (feat)

**Plan metadata:** committed below (docs)

## Files Created/Modified

- `src/app/api/auth/fpl-login/route.test.ts` — 5-test contract suite: status 200, body shape, empty/malformed input, no-fetch assertion
- `src/app/api/auth/fpl-login/route.ts` — Replaced with 13-line stub; imports, body parsing, outbound fetch, cookies, try/catch all removed

## Decisions Made

- Omitted `_request` parameter from `POST()` signature entirely (not needed by stub) — avoids lint warning without suppression comment
- Removed "ENDPOINT_GONE" from comment text to satisfy `grep -c "ENDPOINT_GONE" route.ts = 1` acceptance criterion

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- AUTH-05 complete: backend stub returns stable `{ ok: false, code: "ENDPOINT_GONE" }` on HTTP 200 for all inputs
- Plan 02 (AuthModal cleanup) can proceed: credentials form removal is now safe — backend stub is stable
- `src/app/api/auth/login/route.ts` (token-paste endpoint) was not touched — verified via git log

---

## Self-Check

### Files created/modified
- `src/app/api/auth/fpl-login/route.ts` — FOUND
- `src/app/api/auth/fpl-login/route.test.ts` — FOUND

### Commits
- `865882b` (test RED) — FOUND
- `a6ffec5` (feat GREEN) — FOUND

## Self-Check: PASSED

---
*Phase: 130-auth-fix*
*Completed: 2026-05-21*
