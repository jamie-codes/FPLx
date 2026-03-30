# Phase 12: FPL Auth + Exact Selling Price — Research

**Researched:** 2026-03-30
**Domain:** Next.js 16 Route Handler auth + HttpOnly cookie session + FPL API login flow
**Confidence:** HIGH

## Summary

Phase 12 delivers optional FPL credential login that enriches SquadView with exact sell prices and bank balance, without gating any feature. The implementation is a thin session-cookie layer: a POST Route Handler POSTs credentials to FPL's login endpoint server-side, extracts the `pl_profile` session cookie, and mirrors it as an HttpOnly `fpl_session` cookie on our domain. A new `/api/fpl/my-team` Route Handler reads that cookie server-side and returns exact sell prices and bank. The client never touches FPL cookies directly.

The codebase already has all the patterns needed: the `[...proxy]` Route Handler shows how to forward FPL requests with correct headers, `squad-adapter.ts` already validates and types the picks/entry_history shapes, and `TransferPanel.tsx` is the right mounting point for the login nudge and auth state. The change is additive — no existing code paths are broken, unauthenticated flow continues unchanged.

Credentials are strictly request-scoped: they arrive in the POST body of `/api/auth/login`, are used once to call FPL's login endpoint, and are never stored anywhere. The `fpl_session` cookie stores the FPL `pl_profile` session value (not the raw credentials). This satisfies the security requirement that credentials never persist beyond a single request lifecycle.

**Primary recommendation:** Three Route Handlers (`/api/auth/login`, `/api/auth/logout`, `/api/fpl/my-team`) + a `useAuthStatus` hook + tilde-prefix and exact-price rendering in `SquadView`. No auth library needed — this is a straightforward cookie proxy pattern.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Login placement — inline nudge near bank balance**
The affordance lives next to the bank balance display in the Squad tab — a small "Log in for exact prices →" link/button. When authenticated, it becomes "Logged in • [Log out]". Minimal disruption to the unauthenticated flow; surfaces at the exact point of imprecision.

**D-02: Auth flow — HttpOnly cookie on our domain**
Credentials flow: client POSTs to our `/api/auth/login` → route calls FPL's login endpoint server-side → stores the FPL session as an HttpOnly cookie (`fpl_session`) on our domain → all subsequent `/api/fpl/my-team` calls read it server-side. Cookie is inaccessible to JS (XSS-safe).

**D-03: Logout endpoint — yes, expose `/api/auth/logout`**
When authenticated, the nudge becomes a "Logged in • [Log out]" indicator. A DELETE (or POST) to `/api/auth/logout` clears the HttpOnly cookie. Clean session lifecycle.

**D-04: Session lifetime — mirror FPL's own cookie TTL**
Read the `Max-Age`/`Expires` from FPL's `pl_profile` cookie and mirror it on our `fpl_session` cookie. No hardcoded cutoff — session lasts as long as FPL's own session does.

**D-05: Unauthenticated sell price display — tilde prefix + tooltip**
When not logged in, `now_cost` values in SquadView are displayed as `~£X.Xm` (tilde prefix). Hovering shows a tooltip: "Approximate sell price — log in for exact value". Honest about imprecision without noisy labels everywhere.

**D-06: Authenticated state — replace in-place**
When authenticated, bank balance upgrades from `~£1.5m` to `£1.5m` in the same display location. Sell prices in player rows drop the tilde and show the exact value from `my-team`. Same component, different data source.

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with FPL credentials to unlock exact bank balance and sell prices | D-01/D-02/D-03 map to login form + Route Handlers + auth-state hook; FPL login endpoint verified |
| AUTH-02 | User can see exact selling price from my-team endpoint when authenticated | `/api/fpl/my-team` Route Handler + `MyTeamPickSchema` with `selling_price` field + SquadView prop threading |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md defers entirely to AGENTS.md:

- **This is not the standard Next.js from training data** — APIs, conventions, and file structure may differ. Confirmed: project uses Next.js 16.2.1 with React 19. The `cookies()` API is now **async** (must `await cookies()`). `params` in Route Handlers is now a **Promise** and must be awaited. Both patterns are already used correctly in existing Route Handlers in the codebase.
- **Read the relevant guide in `node_modules/next/dist/docs/`** — done; key findings documented below.
- **Heed deprecation notices** — `cookies` synchronous access is deprecated since v15; always use `await cookies()`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/headers `cookies` | 16.2.1 (async) | Set/read/delete HttpOnly cookies in Route Handlers | The only supported way to mutate cookies in Next.js App Router; HttpOnly flag prevents JS access |
| zod | ^4.3.6 | Schema validation for `my-team` API response | Already used everywhere in the codebase; unknown fields stripped by default |
| @tanstack/react-query | ^5.95.2 | `useAuthStatus` hook to check session state from client | Already used for all data fetching; consistent pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `useState` + `useCallback` | 19.2.4 | Login form local state (email, password, loading, error) | Already pattern in TransferPanel; lightweight, no context needed |

### No New Dependencies Required
All patterns are satisfied by the existing stack. No additional packages needed.

---

## Architecture Patterns

### New Files Required
```
src/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── login/
│       │   │   └── route.ts        # POST: FPL login → set fpl_session cookie
│       │   └── logout/
│       │       └── route.ts        # POST/DELETE: clear fpl_session cookie
│       └── fpl/
│           └── my-team/
│               └── route.ts        # GET: proxy /api/my-team/ using fpl_session cookie
└── lib/
    └── hooks/
        └── useAuthStatus.ts        # GET /api/auth/status → { isAuthenticated: boolean }
```

Plus modifications to:
- `src/lib/squad-adapter.ts` — add `MyTeamPickSchema` and `MyTeamResponseSchema`
- `src/components/transfers/TransferPanel.tsx` — add login nudge + auth state wiring
- `src/components/squad/SquadView.tsx` — tilde prefix for unauthenticated, exact price when authenticated

### Pattern 1: Login Route Handler

**What:** POST handler that forwards credentials to FPL, extracts session cookie, sets HttpOnly cookie on our domain.
**When to use:** Single entry point for FPL credential submission.

```typescript
// src/app/api/auth/login/route.ts
// Source: next/headers cookies API (verified from node_modules/next/dist/docs/)
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  // Forward to FPL login endpoint as form-encoded (per FPL API convention)
  const body = new URLSearchParams({
    login: email,
    password,
    app: 'plfpl-web',
    redirect_uri: 'https://fantasy.premierleague.com/a/login',
  })

  const fplRes = await fetch('https://users.premierleague.com/accounts/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'fplx/1.0',
    },
    body: body.toString(),
    redirect: 'manual',  // Don't follow redirects — the cookie is in the 302 response
  })

  // Extract pl_profile cookie from FPL response Set-Cookie headers
  const setCookieHeader = fplRes.headers.get('set-cookie') ?? ''
  const plProfile = extractPlProfile(setCookieHeader)

  if (!plProfile) {
    return Response.json({ error: 'Invalid FPL credentials' }, { status: 401 })
  }

  // Mirror pl_profile as HttpOnly fpl_session on our domain
  const cookieStore = await cookies()
  cookieStore.set('fpl_session', plProfile.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: plProfile.maxAge,  // Mirror FPL's own TTL (D-04)
  })

  return Response.json({ ok: true })
}
```

### Pattern 2: My-Team Route Handler

**What:** GET handler that reads `fpl_session` cookie and proxies to FPL's `/api/my-team/`.
**When to use:** Called when squad is loaded and user is authenticated.

```typescript
// src/app/api/fpl/my-team/route.ts
// Source: existing proxy pattern in src/app/api/fpl/[...proxy]/route.ts
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('fpl_session')

  if (!session) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const res = await fetch('https://fantasy.premierleague.com/api/my-team/', {
    headers: {
      'User-Agent': 'fplx/1.0',
      'Cookie': `pl_profile=${session.value}`,
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    return Response.json({ error: 'FPL my-team fetch failed', status: res.status }, { status: res.status })
  }

  const data = await res.json()
  const parsed = parseMyTeamResponse(data)
  if (!parsed.success) {
    return Response.json({ error: 'Unexpected my-team response shape' }, { status: 502 })
  }

  return Response.json(parsed.data)
}
```

### Pattern 3: Auth Status Check (for client-side session detection)

**What:** Lightweight GET endpoint that checks cookie presence server-side, returns `{ isAuthenticated: boolean }`.
**When to use:** Called on mount by `useAuthStatus` hook to determine initial auth state.

Since `fpl_session` is HttpOnly (not readable by JS), the client must ask the server whether a session exists. A `/api/auth/status` Route Handler reads the cookie server-side and returns a boolean. This avoids any client-side cookie inspection.

```typescript
// src/app/api/auth/status/route.ts
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('fpl_session')
  return Response.json({ isAuthenticated: !!session })
}
```

### Pattern 4: Zod schema for my-team response

**What:** Add a separate `MyTeamPickSchema` that extends `SquadPickSchema` with `selling_price`.
**Why separate:** The public picks endpoint does not include `selling_price`. Two schemas prevents contaminating the existing unauthenticated path.

```typescript
// Addition to src/lib/squad-adapter.ts
export const MyTeamPickSchema = SquadPickSchema.extend({
  selling_price: z.number().int(),  // exact sell price in tenths of £1m
})

export const MyTeamResponseSchema = z.object({
  picks: z.array(MyTeamPickSchema),
  // entry_history from my-team has same shape as picks endpoint
  entry_history: EntryHistorySchema,
})

export type MyTeamPick = z.infer<typeof MyTeamPickSchema>
export type MyTeamResponse = z.infer<typeof MyTeamResponseSchema>
```

### Pattern 5: Auth state threading into SquadView

**What:** `TransferPanel` manages auth state and passes `exactSellPrices` map + `isAuthenticated` down to `SquadView`.
**Data shape:** `exactSellPrices: Map<number, number>` (element id → selling_price in tenths).

```typescript
// TransferPanel.tsx additions (pseudocode)
const { isAuthenticated } = useAuthStatus()
const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

const exactSellPrices = useMemo(() => {
  if (!myTeamData) return new Map<number, number>()
  return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
}, [myTeamData])

// Pass down to SquadView:
<SquadView
  picks={squadData.picks}
  allPlayers={scoredPlayers}
  entryHistory={isAuthenticated && myTeamData ? myTeamData.entry_history : squadData.entry_history}
  verdicts={verdicts}
  exactSellPrices={exactSellPrices}
  isAuthenticated={isAuthenticated}
/>
```

### Pattern 6: Tilde prefix in SquadView

**What:** When `isAuthenticated` is false, price column shows `~£X.Xm` with tooltip. When true, shows exact `£X.Xm` from `exactSellPrices` map (fallback to `now_cost` if not in map).

```typescript
// SquadView.tsx — price cell (pseudocode)
const priceRaw = exactSellPrices?.get(pick.element) ?? player.now_cost
const priceM = (priceRaw / 10).toFixed(1)
const isApprox = !isAuthenticated

// Render:
<td>
  {isApprox ? (
    <span title="Approximate sell price — log in for exact value">
      ~£{priceM}m
    </span>
  ) : (
    `£${priceM}m`
  )}
</td>
```

### Anti-Patterns to Avoid

- **Reading cookies in 'use client' components:** HttpOnly cookies are invisible to JS by design. Always read via `/api/auth/status` server route.
- **Synchronous `cookies()` call:** Deprecated since Next.js 15. Always `await cookies()` — the existing codebase uses this correctly.
- **Passing credentials to pipeline/run.py or any cron code:** Hard requirement. Auth must be UI-initiated only, per locked roadmap decision.
- **Storing raw FPL password in any cookie or state:** Only the FPL `pl_profile` session value goes in the cookie. Credentials are consumed once in the POST handler.
- **Caching the `/api/fpl/my-team` response:** `next: { revalidate: 0 }` — squad data changes and must always be fresh.
- **Using two parallel data-fetch paths for authenticated/unauthenticated:** When authenticated, `my-team` entry_history replaces the public picks entry_history entirely. No side-by-side fetching.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HttpOnly cookie set/delete | Custom `Set-Cookie` header string | `next/headers cookies` API | `cookies().set()` with `httpOnly: true` handles all edge cases; `Set-Cookie` string building is error-prone |
| Cookie TTL mirroring | Date math to parse `Expires=` | Parse `Max-Age` first, fall back to `Expires` | `Max-Age` is in seconds (easy `parseInt`); `Expires` requires Date parsing; prefer `Max-Age` |
| FPL login form submission | URLSearchParams manual encoding | `new URLSearchParams({...}).toString()` | Correct `application/x-www-form-urlencoded` encoding with no custom work |
| Auth state check | Decoding cookies in client JS | GET `/api/auth/status` → boolean | HttpOnly cookies cannot be read in JS at all — server-side check is the only option |

**Key insight:** The HttpOnly constraint is a feature, not a limitation. It means all auth state checks go through the server, which is where they belong for a security-sensitive flow.

---

## Common Pitfalls

### Pitfall 1: FPL Login Returns 302, Not 200

**What goes wrong:** Fetching FPL's login endpoint with `fetch()` and checking `res.ok` — the login endpoint returns a `302 Found` redirect on success, not `200`. Default `fetch()` follows redirects and you never see the `Set-Cookie` header.
**Why it happens:** FPL's login flow is designed for browser redirect, not SPA API calls.
**How to avoid:** Pass `redirect: 'manual'` to `fetch()`. On success you get a `302` with `Set-Cookie: pl_profile=...` in the response headers. On failure (bad credentials) you get a redirect to an error page — check that `pl_profile` is actually present in the `Set-Cookie` header.
**Warning signs:** `res.ok` is false even with correct credentials; `set-cookie` header is absent.

### Pitfall 2: Multiple Set-Cookie Headers Not Accessible via `headers.get()`

**What goes wrong:** FPL returns multiple `Set-Cookie` response headers. `response.headers.get('set-cookie')` returns only the first or a comma-joined string depending on the platform.
**Why it happens:** The Fetch API's `Headers` object joins multiple values with `, ` for `get()`. `pl_profile` is typically one of several cookies FPL sets (others: `csrftoken`, `sessionid`, etc.).
**How to avoid:** Use `response.headers.getAll('set-cookie')` (Node.js 18+ undici-based fetch) or iterate `response.headers.entries()` filtering for `set-cookie`. Parse the `pl_profile=` value specifically. Alternatively use the `set-cookie-parser` npm package — but hand-parsing is fine given the simple requirement.
**Warning signs:** `fpl_session` cookie is set but `/api/fpl/my-team` returns 401 from FPL.

### Pitfall 3: `cookies()` Must Be Awaited

**What goes wrong:** Calling `cookies()` without `await` (the Next.js 14 synchronous pattern) — works in Next.js 15 via backwards-compat shim but is deprecated and may break.
**Why it happens:** APIs changed in Next.js 15+; this project is on 16.2.1.
**How to avoid:** Always `const cookieStore = await cookies()`. The existing proxy route already does this correctly.
**Warning signs:** TypeScript type errors; ESLint warnings about unresolved promises.

### Pitfall 4: my-team endpoint requires pl_profile, not a Bearer token

**What goes wrong:** Attempting to authenticate with a Bearer token or Authorization header to FPL's my-team endpoint.
**Why it happens:** FPL uses cookie-based sessions for authenticated endpoints, not OAuth/JWT.
**How to avoid:** Send `Cookie: pl_profile=<session_value>` header in the server-side fetch. The cookie name is `pl_profile` — not `fpl_session` (which is our internal proxy cookie name).
**Warning signs:** 401 from FPL my-team endpoint.

### Pitfall 5: Auth State Out of Sync After Cookie Expiry

**What goes wrong:** `useAuthStatus` returns `isAuthenticated: true` (cached by TanStack Query), but the actual FPL session has expired, causing `/api/fpl/my-team` to return 401.
**Why it happens:** Query cache holds the status response longer than the session lives.
**How to avoid:** On 401 from `/api/fpl/my-team`, invalidate the `['auth-status']` query key. Keep `useAuthStatus` staleTime short (e.g., 5 minutes) or use `staleTime: 0`. Graceful fallback to unauthenticated display (tilde prefix returns).
**Warning signs:** User sees exact prices, then page breaks on data load.

### Pitfall 6: selling_price Unit — tenths of £1m (same as now_cost)

**What goes wrong:** Displaying `selling_price` directly without dividing by 10 — showing `£55m` instead of `£5.5m`.
**Why it happens:** FPL encodes all prices as integers in tenths of £1m (consistent with `now_cost`, `bank`, `value`).
**How to avoid:** Apply the same `/ 10` conversion as existing `now_cost` formatting. The `EntryHistorySchema` comment in `squad-adapter.ts` already documents this: `// tenths of £1m (e.g. 15 = £1.5m)`.

---

## Code Examples

### Parsing pl_profile from Set-Cookie headers

```typescript
// Source: FPL API behaviour (community-verified convention)
function extractPlProfile(setCookieRaw: string): { value: string; maxAge: number } | null {
  // Set-Cookie may be comma-joined; split carefully
  const parts = setCookieRaw.split(/,(?=[^;]+=[^;]+)/)
  for (const part of parts) {
    const [nameVal, ...directives] = part.split(';').map(s => s.trim())
    if (nameVal.startsWith('pl_profile=')) {
      const value = nameVal.slice('pl_profile='.length)
      const maxAgePart = directives.find(d => d.toLowerCase().startsWith('max-age='))
      const maxAge = maxAgePart ? parseInt(maxAgePart.split('=')[1], 10) : 60 * 60 * 24 * 7
      return { value, maxAge }
    }
  }
  return null
}
```

### Setting the HttpOnly cookie in a Route Handler

```typescript
// Source: next/headers cookies API — verified from node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
import { cookies } from 'next/headers'

const cookieStore = await cookies()
cookieStore.set('fpl_session', plProfile.value, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: plProfile.maxAge,
})
```

### Deleting the cookie on logout

```typescript
// Source: cookies.md — .set with maxAge: 0 is the recommended expiry pattern
const cookieStore = await cookies()
cookieStore.set('fpl_session', '', { maxAge: 0, path: '/' })
```

### useAuthStatus hook pattern

```typescript
// Follows same pattern as useSquad / usePlayers in src/lib/hooks/
import { useQuery } from '@tanstack/react-query'

export function useAuthStatus() {
  return useQuery<{ isAuthenticated: boolean }>({
    queryKey: ['auth-status'],
    queryFn: async () => {
      const res = await fetch('/api/auth/status')
      return res.json()
    },
    staleTime: 1000 * 60 * 5,  // 5 minutes
    retry: 0,
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cookies()` synchronous | `await cookies()` async | Next.js 15 | Must use async in all Route Handlers and Server Components |
| `params` direct access | `params` is a Promise, must await | Next.js 15 | Already handled correctly in existing route handlers |

**Deprecated/outdated:**
- Synchronous `cookies()`: Works via shim in Next.js 15-16 but deprecated; do not use.

---

## Open Questions

1. **Does FPL's login endpoint always return `pl_profile` in `Set-Cookie`?**
   - What we know: Community documentation consistently shows `pl_profile` as the session cookie used by `my-team`. The CONTEXT.md canonical refs confirm this.
   - What's unclear: Whether FPL ever returns a `sessionid`-based auth instead — not seen in any reference.
   - Recommendation: Treat absence of `pl_profile` after login as failure (return 401 to client). No fallback needed — if it's absent, credentials are wrong.

2. **`getAll('set-cookie')` availability in Next.js 16 / Node.js fetch**
   - What we know: Node.js 18+ uses undici as the fetch implementation, which does support `headers.getAll()` for `set-cookie`. Project targets Node 20+.
   - What's unclear: Whether the Next.js fetch wrapper preserves `getAll()`.
   - Recommendation: Use `response.headers.getAll?.('set-cookie') ?? [response.headers.get('set-cookie') ?? '']` with a safe fallback.

3. **Does `/api/my-team/` need the team ID in the URL or is it inferred from the session?**
   - What we know: CONTEXT.md states `https://fantasy.premierleague.com/api/my-team/` with the `pl_profile` cookie — no team ID in the URL.
   - Recommendation: No team ID needed in the my-team request. The FPL session identifies the manager. The Route Handler does not need a dynamic segment.

---

## Environment Availability

Step 2.6: SKIPPED — phase is code/config only. No external tools, CLIs, or services beyond FPL's public API (already used in existing proxy).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login form submits credentials, sets auth state | manual-only | — | — |
| AUTH-01 | Logout clears auth state and cookie | manual-only | — | — |
| AUTH-01 | Unauthenticated flow unchanged (tilde prices shown) | unit | `npx vitest run src/lib/squad-adapter.test.ts` | ❌ Wave 0 |
| AUTH-02 | `MyTeamResponseSchema` parses `selling_price` correctly | unit | `npx vitest run src/lib/squad-adapter.test.ts` | ❌ Wave 0 |
| AUTH-02 | Price display: tilde when unauthenticated, exact when authenticated | unit | `npx vitest run src/lib/squad-adapter.test.ts` | ❌ Wave 0 |

**Manual-only justification for AUTH-01 login/logout:** Route Handlers that make external HTTP calls to FPL's login endpoint cannot be integration-tested without a live FPL account credential. These are smoke-tested manually. The pure-function and schema aspects are unit-testable.

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/squad-adapter.test.ts` — Zod schema tests for `MyTeamPickSchema` and `MyTeamResponseSchema`; unauthenticated price display helper tests (REQ AUTH-01, AUTH-02)

*(No existing test file for squad-adapter — new file needed)*

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — async `cookies()` API, `set()` options, `delete()` patterns
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler cookie example, POST handler, `redirect: 'manual'` fetch usage
- `src/app/api/fpl/[...proxy]/route.ts` — established proxy pattern for FPL requests (User-Agent, error handling)
- `src/lib/squad-adapter.ts` — existing Zod schema patterns (`SquadPickSchema`, `EntryHistorySchema`)
- `src/components/transfers/TransferPanel.tsx` — integration point for login nudge and auth state
- `src/components/squad/SquadView.tsx` — price rendering location for tilde prefix

### Secondary (MEDIUM confidence)
- `12-CONTEXT.md` canonical refs — FPL login endpoint URL, `my-team` response shape, `selling_price` field existence
- FPL community documentation (widely corroborated): `pl_profile` cookie name, `my-team` endpoint authentication mechanism

### Tertiary (LOW confidence)
- `getAll('set-cookie')` undici behaviour in Next.js 16 fetch wrapper — needs live verification during Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, APIs verified from local docs
- Architecture patterns: HIGH — follows established proxy and hook patterns in the codebase exactly
- FPL API surface: MEDIUM — canonical refs in CONTEXT.md corroborated by community docs; exact response headers need live verification
- Pitfalls: HIGH — `redirect: 'manual'` and `pl_profile` cookie extraction are well-known FPL integration patterns; async cookies confirmed from local Next.js docs

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable APIs, FPL API surface unlikely to change mid-season)
