# Phase 20: Auth UX — Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve FPL authentication UX so that:
1. Users can connect their FPL account without DevTools knowledge (best-in-class guided flow)
2. The authenticated state clearly shows connection health and warns before expiry

AUTH-03 is reinterpreted: FPL migrated to OAuth 2.0 PKCE — no email/password API exists. Both AUTH-03 and AUTH-04 converge into one deliverable: a polished modal-based guided onboarding experience with browser-specific steps and expiry awareness.

The token-paste mechanism itself (Phase 12) stays unchanged — this phase improves the UX wrapper around it.

</domain>

<decisions>
## Implementation Decisions

### D-01: AUTH-03 reinterpretation — guided flow replaces email/password

AUTH-03 "email + password login" is infeasible because FPL uses OAuth 2.0 PKCE with no credential exchange API. Reinterpreted as: make the DevTools token extraction so smooth that non-technical users can follow it. Both AUTH-03 and AUTH-04 are satisfied by the same polished guided experience.

**Not chosen:** OAuth redirect flow (FPL hasn't published a redirect URI whitelist — too fragile), or dropping AUTH-03 entirely.

### D-02: Guide format — plain numbered steps, Chrome-focused

The step-by-step instructions use a plain numbered list. No browser-specific tabs — Chrome DevTools steps are assumed (most common). Clear, concise, minimal markup.

**Not chosen:** Tabbed by browser (extra complexity), browser callouts inline (harder to scan).

### D-03: Guide placement — modal/dialog

Clicking "Connect FPL account →" opens a modal. The modal contains:
- The step-by-step numbered guide
- The token input field with paste-from-clipboard button
- Submit and Cancel actions

Keeps the Squad tab clean; gives the guide room. Dismissible (click outside or Cancel).

**Not chosen:** Inline expansion in Squad tab, dedicated /help/auth page.

### D-04: Clipboard paste button on token input

A paste-from-clipboard button (or icon) auto-fills the token field. Uses the Clipboard API (`navigator.clipboard.readText()`). Reduces friction by one step.

### D-05: Connected state — expiry warning when < 1hr remaining

When authenticated and token expires in < 1 hour: replace the "valid until HH:MM" display with an amber warning (e.g., "Expires soon — valid until HH:MM").

When token has expired (or < 15min remaining): show "Token expired — reconnect →" as a link that re-opens the guide modal. This is the explicit reconnect path.

Normal authenticated state (> 1hr remaining): "FPL connected • valid until HH:MM" (unchanged from current).

**Not chosen:** Team name display (extra API call), no expiry warning (leaves users stranded mid-session).

### Claude's Discretion

- Exact threshold for "expires soon" warning: < 1hr is the decision; exact visual styling (amber color, badge vs inline text) is Claude's call
- Modal styling: should match existing app patterns (Tailwind, dark mode aware) — Claude determines implementation
- Whether to use a dedicated `<dialog>` element or a div-based modal overlay — Claude's call based on what's already in the codebase
- Exact wording of numbered steps (technical accuracy > polish)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-03, AUTH-04 acceptance criteria (§Auth UX section)
- `.planning/ROADMAP.md` — Phase 20 success criteria

### Existing auth implementation (Phase 12)
- `src/app/api/auth/login/route.ts` — accepts `{ token }`, validates JWT, stores as HttpOnly cookie; DO NOT change the token mechanism
- `src/app/api/auth/status/route.ts` — returns `{ authenticated, expiresAt }` 
- `src/app/api/auth/logout/route.ts` — clears session cookie
- `src/app/api/fpl/my-team/route.ts` — uses stored JWT as `x-api-authorization: Bearer <token>`
- `src/lib/fpl-auth.ts` — `extractTokenExpiry(token)` decodes JWT exp
- `src/lib/hooks/useAuthStatus.ts` — exposes `isAuthenticated`, `expiresAt`, `setAuthenticated`, `clearAuthenticated`
- `src/lib/hooks/useMyTeam.ts` — fetches authenticated squad data
- `src/components/transfers/TransferPanel.tsx` — current auth UI entry point (inline form, 1-line instructions, token input)

### Next.js docs
- `node_modules/next/dist/docs/` — read the relevant guide before writing any Route Handler or component code (per CLAUDE.md / AGENTS.md)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAuthStatus()` hook — already exposes `expiresAt` (Unix seconds); the expiry warning logic can be built directly on this
- Existing `showTokenForm` state in TransferPanel — will be replaced/extended by modal open state
- Tailwind dark mode patterns established across the app — modal must follow the same pattern (`dark:bg-zinc-900`, etc.)
- `active:scale-95 transition-transform` is the established button interaction pattern

### Established Patterns
- All FPL API calls are server-side Route Handlers — no changes to auth mechanics
- HttpOnly cookie approach (`fpl_session`) stays unchanged
- TanStack Query is used for all async state — `useAuthStatus` and `useMyTeam` already in place
- `'use client'` + props passed down from `TransferPanel` is the existing data flow pattern

### Integration Points
- `TransferPanel.tsx` owns the auth section — the "Connect FPL account" link and authenticated state display are both here
- The modal trigger and modal component slot in next to the existing auth section
- `expiresAt` from `useAuthStatus()` is already available — no new data fetching needed for the expiry warning

### Key constraint
- FPL's auth is OAuth 2.0 PKCE — no server-side credential exchange. The Bearer token (JWT, 8hr validity) must be obtained from browser DevTools. This is permanent, not a workaround.

</code_context>

<specifics>
## Specific Ideas

- Token expires in < 1hr → amber warning alongside current time display
- Token expired (< 15min remaining is a reasonable "treat as expired" UX threshold) → "Token expired — reconnect →" link reopens modal
- Paste button uses `navigator.clipboard.readText()` — needs to be in a user gesture handler (button click), not auto-triggered
- Modal should be dismissible via backdrop click and a Cancel button
- Numbered guide steps should be accurate for Chrome DevTools (F12 → Network tab → any /api/ request → Headers → x-api-authorization value)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-auth-ux*
*Context gathered: 2026-04-02*
