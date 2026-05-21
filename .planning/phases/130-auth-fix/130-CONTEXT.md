# Phase 130: Auth Fix - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the dead FPL credential endpoint so it returns `ENDPOINT_GONE` immediately instead of proxying a broken OAuth flow, and remove the now-dead credentials UI from `AuthModal` so users always land directly on the working token-paste flow.

</domain>

<decisions>
## Implementation Decisions

### Backend — fpl-login route
- **D-01:** Replace the entire body of `src/app/api/auth/fpl-login/route.ts` with an immediate stub that returns `{ ok: false, code: "ENDPOINT_GONE" }` with HTTP 200. No proxying, no try/catch, no credential validation — just the stub.

### Frontend — AuthModal
- **D-02:** Remove the credentials form entirely. Delete: the `Mode` type, `mode` state, mode-tab buttons, credential form state (`email`, `password`, `credLoading`, `credError`), `handleCredentialsLogin` callback, and the credentials form JSX block.
- **D-03:** Remove the mode-tab strip entirely. The modal opens directly showing the token-paste form with no tabs and no explanatory note about why the email/password option is gone.
- **D-04:** The `manual` form remains exactly as-is — layout, copy, clipboard paste button, and error handling are all unchanged.

### Claude's Discretion
- Test coverage: update or remove any existing tests that exercise the credentials form or mode switching. The researcher/planner should check `src/components/transfers/AuthModal.test.tsx` (or equivalent) for affected tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-05 (ENDPOINT_GONE backend stub) and AUTH-06 (UI falls back to token-paste) definitions

### Files to modify
- `src/app/api/auth/fpl-login/route.ts` — dead credential proxy; replace body with ENDPOINT_GONE stub
- `src/components/transfers/AuthModal.tsx` — remove credentials tab, mode tabs, and all credential state

### Files NOT to modify
- `src/app/api/auth/login/route.ts` — working token-paste endpoint; must not be touched

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/auth/login/route.ts`: already correctly handles Bearer token paste → HttpOnly cookie; no changes needed
- `extractTokenExpiry` from `@/lib/fpl-auth`: used by the working login route; irrelevant to fpl-login stub

### Established Patterns
- Soft-failure response shape: `Response.json({ ok: false, code: '...' }, { status: 200 })` — already used for `NO_TOKEN`; use the same shape for `ENDPOINT_GONE`
- `AuthModal` currently handles `NO_TOKEN` with `setCredError` + `setMode('manual')` — this pattern disappears with D-02/D-03

### Integration Points
- `AuthModal` is only consumed by `src/components/transfers/TransferPanel.tsx` via `open`/`onClose`/`onSuccess` props — those props are unchanged; no TransferPanel changes needed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the stub response shape is locked by success criteria: `{ ok: false, code: "ENDPOINT_GONE" }` on HTTP 200.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 130-Auth Fix*
*Context gathered: 2026-05-21*
