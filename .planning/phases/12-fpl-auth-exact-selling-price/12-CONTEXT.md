# Phase 12: FPL Auth + Exact Selling Price — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver optional FPL session-cookie login so authenticated users see exact sell prices (from `/api/my-team`) and exact bank balance (`entry_history.bank`). All features remain fully functional for unauthenticated users — auth enriches, never gates.

</domain>

<decisions>
## Implementation Decisions

### D-01: Login placement — inline nudge near bank balance

The affordance lives next to the bank balance display in the Squad tab — a small "Log in for exact prices →" link/button. When authenticated, it becomes "Logged in • [Log out]". Minimal disruption to the unauthenticated flow; surfaces at the exact point of imprecision.

**Not chosen:** Dedicated section above Team ID input (always takes space), integrated with Team ID flow (contextual but more complex state).

### D-02: Auth flow — HttpOnly cookie on our domain

Credentials flow: client POSTs to our `/api/auth/login` → route calls FPL's login endpoint server-side → stores the FPL session as an HttpOnly cookie (`fpl_session`) on our domain → all subsequent `/api/fpl/my-team` calls read it server-side. Cookie is inaccessible to JS (XSS-safe).

**Not chosen:** In-memory React state (lost on page refresh, requires re-login every session).

### D-03: Logout endpoint — yes, expose `/api/auth/logout`

When authenticated, the nudge becomes a "Logged in • [Log out]" indicator. A DELETE (or POST) to `/api/auth/logout` clears the HttpOnly cookie. Clean session lifecycle.

### D-04: Session lifetime — mirror FPL's own cookie TTL

Read the `Max-Age`/`Expires` from FPL's `pl_profile` cookie and mirror it on our `fpl_session` cookie. No hardcoded cutoff — session lasts as long as FPL's own session does.

### D-05: Unauthenticated sell price display — tilde prefix + tooltip

When not logged in, `now_cost` values in SquadView are displayed as `~£X.Xm` (tilde prefix). Hovering shows a tooltip: "Approximate sell price — log in for exact value". Honest about imprecision without noisy labels everywhere.

**Not chosen:** No label change (less transparent about approximation).

### D-06: Authenticated state — replace in-place

When authenticated, bank balance upgrades from `~£1.5m` to `£1.5m` in the same display location. Sell prices in player rows drop the tilde and show the exact value from `my-team`. Same component, different data source.

**Not chosen:** Show both approximate and exact side-by-side (useful once, noise on every visit).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02 acceptance criteria
- `.planning/ROADMAP.md` — Phase 12 success criteria and depends-on chain

### Existing code — auth-adjacent
- `src/app/api/fpl/[...proxy]/route.ts` — server-side FPL proxy pattern to follow for `/api/auth/login`
- `src/app/api/squad/[teamId]/route.ts` — squad fetching pattern; `/api/my-team/` call will follow the same shape
- `src/lib/squad-adapter.ts` — `SquadPickSchema`, `EntryHistorySchema` — will need `selling_price` field added
- `src/components/transfers/TransferPanel.tsx` — owns the Squad tab state machine; login nudge and authenticated state plumbed here
- `src/components/squad/SquadView.tsx` — player rows where tilde prefix and exact sell price appear

### FPL API surface (for researcher to verify)
- FPL login endpoint: `https://users.premierleague.com/accounts/login/` (POST, form-encoded `login`, `password`, `app`, `redirect_uri`)
- Authenticated my-team endpoint: `https://fantasy.premierleague.com/api/my-team/` (GET, requires `pl_profile` session cookie)
- `my-team` response shape: `picks[].selling_price` (exact sell, tenths of £1m), `entry_history.bank` (exact bank, tenths of £1m)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/fpl/[...proxy]/route.ts` — established pattern for server-side FPL proxying; `/api/auth/login` and `/api/fpl/my-team` Route Handlers should follow the same structure
- `EntryHistorySchema` in `squad-adapter.ts` — already has `bank` field; authenticated path upgrades the source, not the schema
- `SquadView` already receives `entryHistory` and `verdicts` props — adding `isAuthenticated` and `exactSellPrices` follows the same prop-passing pattern

### Established Patterns
- All FPL API calls go through server-side Route Handlers (no client-side FPL calls) — auth must follow this
- Zod validation on all API responses — `my-team` response will need a schema in `squad-adapter.ts`
- `'use client'` components receive data via props or TanStack Query hooks — auth state likely needs a small hook or context

### Integration Points
- `TransferPanel.tsx` is the top-level Squad tab component — login state and authenticated data flow from here down to `SquadView`
- `SquadPickSchema` needs `selling_price: z.number()` added for the `my-team` picks (public picks don't include it — separate schema or union needed)
- Bank balance display is currently in `TransferPanel` — the nudge and "Logged in" indicator slot in next to it

</code_context>

<specifics>
## Specific Ideas

- Tilde (`~`) prefix for approximate values is a standard FPL convention familiar to managers
- The authenticated path replaces the public squad route with the `my-team` endpoint — no need for two parallel fetch paths

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-fpl-auth-exact-selling-price*
*Context gathered: 2026-03-30*
