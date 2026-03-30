---
phase: 12-fpl-auth-exact-selling-price
plan: "01"
subsystem: auth
tags: [auth, session-cookie, zod, route-handlers, fpl-api]
dependency_graph:
  requires: []
  provides: [fpl-session-auth, my-team-proxy, squad-adapter-my-team-schemas]
  affects: [squad-adapter.ts, fpl-auth.ts, api-auth-login, api-auth-logout, api-auth-status, api-fpl-my-team]
tech_stack:
  added: []
  patterns: [HttpOnly-cookie, redirect-manual-fetch, await-cookies-async, TDD-red-green]
key_files:
  created:
    - src/lib/squad-adapter.test.ts
    - src/lib/fpl-auth.ts
    - src/app/api/auth/login/route.ts
    - src/app/api/auth/logout/route.ts
    - src/app/api/auth/status/route.ts
    - src/app/api/fpl/my-team/route.ts
  modified:
    - src/lib/squad-adapter.ts
decisions:
  - "extractPlProfile takes string[] (not string) — getAll() fallback pattern handles multi-header FPL Set-Cookie responses"
  - "redirect: 'manual' on FPL login fetch — FPL returns 302 on success; without this the Set-Cookie headers are lost"
  - "session?.value check (not just session) in status/my-team — prevents stale cookie with empty value appearing authenticated"
metrics:
  duration_seconds: 141
  completed_date: "2026-03-30"
  tasks_completed: 3
  files_changed: 7
---

# Phase 12 Plan 01: FPL Auth Server Layer Summary

**One-liner:** HttpOnly session-cookie auth layer with FPL login/logout/status Route Handlers and authenticated my-team proxy using Zod-validated MyTeamPickSchema with selling_price.

## What Was Built

Four Next.js Route Handlers and two supporting library files implementing server-side FPL session-cookie authentication:

- `src/lib/fpl-auth.ts` — `extractPlProfile(string[]): { value, maxAge } | null` helper that parses the `pl_profile` Set-Cookie header from FPL's multi-header login response
- `src/lib/squad-adapter.ts` (extended) — `MyTeamPickSchema`, `MyTeamResponseSchema`, `MyTeamPick`, `MyTeamResponse` types, and `parseMyTeamResponse` function
- `src/lib/squad-adapter.test.ts` — 6 unit tests covering schema validation and parse function (TDD RED then GREEN)
- `src/app/api/auth/login/route.ts` — POST handler: forwards credentials to FPL, sets HttpOnly `fpl_session` cookie mirroring FPL's `pl_profile` TTL
- `src/app/api/auth/logout/route.ts` — POST handler: clears `fpl_session` with `maxAge: 0`
- `src/app/api/auth/status/route.ts` — GET handler: returns `{ isAuthenticated: boolean }` server-side (HttpOnly cookie invisible to JS)
- `src/app/api/fpl/my-team/route.ts` — GET handler: proxies FPL `/api/my-team/` with `pl_profile` session cookie, validates response with Zod

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 0 | Create squad-adapter unit tests (RED) | b9b47c3 | src/lib/squad-adapter.test.ts |
| 1 | Schemas and extractPlProfile helper (GREEN) | 4aab812 | src/lib/squad-adapter.ts, src/lib/fpl-auth.ts |
| 2 | Four auth Route Handlers | 952a575 | src/app/api/auth/login/route.ts, logout/route.ts, status/route.ts, src/app/api/fpl/my-team/route.ts |

## Verification Results

- All 6 new unit tests pass (MyTeamPickSchema, MyTeamResponseSchema, parseMyTeamResponse)
- Full suite: 163 tests passed, 8 skipped, 0 failed
- All four Route Handlers verified: consistent `fpl_session` cookie name, `await cookies()` pattern used throughout
- `redirect: 'manual'` present in login handler (Pitfall 1 guard)
- `pl_profile=` forwarded correctly in my-team fetch (Pitfall 4 guard)
- `revalidate: 0` on my-team fetch (no caching)
- No credential storage in any file beyond request scope

## Decisions Made

1. `extractPlProfile` accepts `string[]` (array) rather than the single string shown in research code examples. The plan's action section specified `string[]` to handle FPL's multiple Set-Cookie headers via `headers.getAll()`, which is the correct approach per Research Pitfall 2. The research Code Examples section showed a comma-split approach for a single string — the array approach is cleaner and more robust.

2. `redirect: 'manual'` on the FPL login fetch is critical. FPL returns HTTP 302 on successful login, not 200. Without `redirect: 'manual'`, Node's fetch follows the redirect and the `Set-Cookie` headers containing `pl_profile` are never accessible.

3. Status route checks `session?.value` (not just `session`) — handles edge case where cookie exists with empty value after partial clear, preventing false positive auth state.

## Deviations from Plan

None — plan executed exactly as written. The `extractPlProfile` function signature uses `string[]` as specified in Task 1 action (not the single-string variant from research Code Examples, which was a simplified illustration). All acceptance criteria met.

## Known Stubs

None. All Route Handlers are production-ready implementations; no hardcoded placeholders or mock data.

## Self-Check: PASSED

Files created:
- src/lib/squad-adapter.test.ts: FOUND
- src/lib/fpl-auth.ts: FOUND
- src/app/api/auth/login/route.ts: FOUND
- src/app/api/auth/logout/route.ts: FOUND
- src/app/api/auth/status/route.ts: FOUND
- src/app/api/fpl/my-team/route.ts: FOUND

Commits verified:
- b9b47c3: FOUND (test: RED phase)
- 4aab812: FOUND (feat: schemas and helper)
- 952a575: FOUND (feat: four Route Handlers)
