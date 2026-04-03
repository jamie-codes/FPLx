# Phase 20: Auth UX — Research

**Researched:** 2026-04-02
**Domain:** React modal UX, Clipboard API, token expiry state, Tailwind dark-mode patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: AUTH-03 reinterpretation — guided flow replaces email/password**
AUTH-03 "email + password login" is infeasible because FPL uses OAuth 2.0 PKCE with no credential exchange API. Reinterpreted as: make the DevTools token extraction so smooth that non-technical users can follow it. Both AUTH-03 and AUTH-04 are satisfied by the same polished guided experience.
Not chosen: OAuth redirect flow (FPL hasn't published a redirect URI whitelist — too fragile), or dropping AUTH-03 entirely.

**D-02: Guide format — plain numbered steps, Chrome-focused**
The step-by-step instructions use a plain numbered list. No browser-specific tabs — Chrome DevTools steps are assumed (most common). Clear, concise, minimal markup.
Not chosen: Tabbed by browser (extra complexity), browser callouts inline (harder to scan).

**D-03: Guide placement — modal/dialog**
Clicking "Connect FPL account →" opens a modal. The modal contains:
- The step-by-step numbered guide
- The token input field with paste-from-clipboard button
- Submit and Cancel actions
Keeps the Squad tab clean; gives the guide room. Dismissible (click outside or Cancel).
Not chosen: Inline expansion in Squad tab, dedicated /help/auth page.

**D-04: Clipboard paste button on token input**
A paste-from-clipboard button (or icon) auto-fills the token field. Uses the Clipboard API (`navigator.clipboard.readText()`). Reduces friction by one step.

**D-05: Connected state — expiry warning when < 1hr remaining**
- When token expires in < 1 hour: amber warning "Expires soon — valid until HH:MM"
- When token has expired (or < 15min remaining): "Token expired — reconnect →" link re-opens the guide modal
- Normal authenticated state (> 1hr remaining): "FPL connected • valid until HH:MM" (unchanged)
Not chosen: Team name display (extra API call), no expiry warning (leaves users stranded mid-session).

### Claude's Discretion

- Exact visual styling for amber warning (color, badge vs inline text)
- Modal implementation choice: native `<dialog>` element or div-based overlay
- Modal Tailwind styling — must match existing app patterns (dark mode aware)
- Exact wording of numbered steps (technical accuracy > polish)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-03 | User can authenticate with FPL in the app without manual cookie hunting | Satisfied by polished modal guide (D-01 reinterpretation). Token paste flow + Chrome DevTools steps removes all friction. |
| AUTH-04 | Manual token entry supported with step-by-step browser guide as fallback | The modal IS the guide. Numbered Chrome DevTools steps + clipboard paste button. AUTH-03 and AUTH-04 converge into one deliverable. |
</phase_requirements>

---

## Summary

Phase 20 is a pure UI-layer change to `TransferPanel.tsx`. The token mechanism (POST `/api/auth/login`, HttpOnly cookie, `useAuthStatus`, `useMyTeam`) is already complete and must not be modified. The phase wraps that mechanism in a modal-based guided flow and adds expiry-awareness to the connected state display.

No new Route Handlers, no new server-side logic, no new TanStack Query keys. All deliverables are React components and one small hook addition (expiry threshold computation).

The scope is tightly bounded: one new component (`AuthModal` or similar), modifications to the auth section of `TransferPanel.tsx`, and addition of expiry-state logic using the already-available `expiresAt` value from `useAuthStatus()`.

**Primary recommendation:** Build a `<dialog>`-based modal component (`AuthModal.tsx`) that encapsulates the guide steps, token input, clipboard paste button, and form submission. Replace `showTokenForm` inline form in `TransferPanel` with modal open/close state. Add expiry thresholding directly in `TransferPanel`'s auth section using `expiresAt` from `useAuthStatus()`.

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component model, `useState`, `useCallback`, `useRef` | Already in project |
| Tailwind CSS v4 | (project-installed) | Styling with `dark:` variant | Established pattern across all components |
| TanStack Query | (project-installed) | Auth state via `useAuthStatus()` | Already used for all async state |
| Next.js | 16.2.1 | `'use client'` directive for browser components | Already used in `TransferPanel` |

### Browser APIs (no install)

| API | Purpose | Notes |
|-----|---------|-------|
| `navigator.clipboard.readText()` | Paste token from clipboard | Requires user gesture (button click) and HTTPS or localhost |
| `HTMLDialogElement` / `<dialog>` | Native modal with backdrop | Supported in all modern browsers; has built-in focus trap |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<dialog>` | Div + fixed overlay | `<dialog>` is simpler, has built-in accessibility (focus trap, `Escape` key, `::backdrop`), no additional JS for dismiss. Project has no existing modal infrastructure — `<dialog>` is the right choice to introduce here. |
| `navigator.clipboard.readText()` | Manual input only | Clipboard paste removes one copy-paste step. Low risk: already wrapped in button click (user gesture). |

**Installation:** None required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── transfers/
│       ├── TransferPanel.tsx       # Modified — replaces inline form with modal trigger + expiry state
│       └── AuthModal.tsx           # New — modal component with guide + token form
└── lib/
    └── hooks/
        └── useAuthStatus.ts        # Unchanged — expiresAt already available
```

### Pattern 1: Native `<dialog>` Modal

**What:** Use the HTML `<dialog>` element with `ref.current.showModal()` / `.close()`. Provides built-in focus trap, `Escape` to dismiss, and `::backdrop` for the overlay.

**When to use:** Any modal that needs to be accessible and work without an external library. Well-suited here because no animation requirements are locked, and the project has no existing modal component.

**Example:**
```typescript
// 'use client'
import { useRef, useEffect } from 'react'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      el.showModal()
    } else {
      el.close()
    }
  }, [open])

  // Sync close when Escape key dismisses the dialog natively
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handleClose = () => onClose()
    el.addEventListener('close', handleClose)
    return () => el.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 w-full max-w-lg shadow-lg backdrop:bg-black/50"
    >
      {/* content */}
    </dialog>
  )
}
```

**Backdrop click to dismiss** — the `<dialog>` element does not close on backdrop click by default. Handle via `onClick` on the dialog element itself, checking `e.target === dialogRef.current`.

### Pattern 2: Expiry Threshold Computation

**What:** Derive expiry state from `expiresAt` (Unix seconds) already in `useAuthStatus()`.

**When to use:** Whenever the auth section renders while authenticated.

**Example:**
```typescript
// Inside TransferPanel auth section render logic
const nowSeconds = Math.floor(Date.now() / 1000)
const secondsRemaining = expiresAt ? expiresAt - nowSeconds : null
const isExpiredOrAlmostGone = secondsRemaining !== null && secondsRemaining < 15 * 60   // < 15min
const isExpiringSoon = secondsRemaining !== null && secondsRemaining >= 15 * 60 && secondsRemaining < 60 * 60  // 15min–1hr
```

**Note:** `useAuthStatus` has a 5-minute stale time. A token can expire between polls. The `isExpiredOrAlmostGone` path handles the UX — the user clicks "reconnect" which re-opens the modal. The server-side check in `GET /api/auth/status` is the authoritative source; a React re-render after TanStack Query refetch will update the display. No polling timer needed.

### Pattern 3: Clipboard Paste Button

**What:** Button that calls `navigator.clipboard.readText()` and sets state.

**When to use:** Inside a user gesture handler (button click) — required by the Permissions API.

**Example:**
```typescript
const handlePaste = useCallback(async () => {
  try {
    const text = await navigator.clipboard.readText()
    setTokenInput(text.trim())
  } catch {
    // Permission denied or not supported — do nothing; user can still type
  }
}, [])
```

**HTTPS requirement:** `navigator.clipboard` is only available in secure contexts (HTTPS or `localhost`). For local dev this is fine. Vercel deployment is HTTPS. Fail silently on clipboard denial.

### Anti-Patterns to Avoid

- **Polling for expiry:** Do not set a `setInterval` to recheck expiry every second. TanStack Query's `staleTime: 5min` is sufficient. Expiry warning is informational; it triggers on next render after the 5-minute poll, not real-time.
- **Modifying auth Route Handlers:** The login/status/logout routes are complete — do not touch them. CONTEXT.md explicitly calls this out.
- **Animating the modal open/close:** Not in scope. The `<dialog>` element with no CSS animation is the baseline — leave it.
- **Auto-reading clipboard on modal open:** `navigator.clipboard.readText()` MUST be in a button click handler. Calling it outside a user gesture will throw a permissions error.
- **Using `createPortal` for the modal:** Not needed. `<dialog>` natively renders above the stacking context without a portal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap in modal | Custom focus management with `tabIndex` manipulation | Native `<dialog>` element | `showModal()` automatically traps focus within the dialog |
| Escape-key dismiss | `useEffect` + `keydown` listener | Native `<dialog>` + `close` event listener | `<dialog>` handles `Escape` natively; just sync React state via the `close` event |
| Backdrop overlay | Fixed `<div>` with `bg-black/50` | `<dialog>::backdrop` CSS | Native `::backdrop` pseudoelement; style with Tailwind `backdrop:` prefix |
| Auth library | NextAuth, Clerk, Auth.js | Nothing — custom token flow is already complete | FPL's auth is non-standard; a generic auth library adds complexity without benefit |

**Key insight:** The `<dialog>` element eliminates 80% of the complexity of a modal — focus trap, Escape key, backdrop, and screen-reader role are all handled natively.

## Common Pitfalls

### Pitfall 1: Dialog close event not syncing React state

**What goes wrong:** The dialog closes (via Escape key or native `.close()`) but `isModalOpen` state remains `true`. Next open call does nothing because `showModal()` called on already-closed dialog throws.

**Why it happens:** `<dialog>` fires a `close` event when closed by any means, including native `Escape`. React state is not automatically updated.

**How to avoid:** Always attach a `close` event listener on the dialog element and call `onClose()` from it. See Pattern 1 code above.

**Warning signs:** Modal appears to "reopen" instantly, or button click does nothing after pressing Escape.

### Pitfall 2: Backdrop click dismiss requires explicit handling

**What goes wrong:** Clicking outside the dialog content area does nothing (expected by users to close the modal).

**Why it happens:** `<dialog>` does not implement backdrop-click dismissal by default.

**How to avoid:** Add `onClick` handler on the `<dialog>` element. Check `e.target === dialogRef.current` to distinguish backdrop clicks from clicks on modal content.

```typescript
const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
  if (e.target === dialogRef.current) onClose()
}
```

**Warning signs:** Users report modal not dismissible without clicking Cancel.

### Pitfall 3: Clipboard API fails silently in some browser configs

**What goes wrong:** `navigator.clipboard.readText()` throws `NotAllowedError` even after a button click.

**Why it happens:** Firefox and Safari require the clipboard-read permission to be explicitly granted. Some browser privacy settings block it. Secure context (HTTPS) required.

**How to avoid:** Wrap in try/catch and fail gracefully. The token input field is still available for manual paste. Never show an error to the user for clipboard denial.

**Warning signs:** Paste button does nothing in Firefox without explicit permissions.

### Pitfall 4: `showModal()` called before element mounts

**What goes wrong:** `Cannot read properties of null (reading 'showModal')` on first render.

**Why it happens:** `useEffect` runs after mount, but if the component conditionally renders the `<dialog>` (i.e., not in the DOM until `isModalOpen` is true), the ref is null when `open` first flips to true.

**How to avoid:** Keep the `<dialog>` element always in the DOM (rendered regardless of `open`) but controlled via `showModal()`/`close()`. Do not conditionally render the `<dialog>` element itself.

### Pitfall 5: Token expiry display stale due to TanStack Query stale time

**What goes wrong:** Token expires, but the UI still shows "FPL connected" because `useAuthStatus` hasn't refetched yet (5-min stale time).

**Why it happens:** The auth status is polled every 5 minutes, not continuously. A token could expire between polls.

**How to avoid:** The client-side threshold computation (D-05) catches the "< 15min remaining" case by computing against `expiresAt` directly rather than waiting for a server round-trip. This is sufficient — the server check on the next API call will return 401 if truly expired, which `useMyTeam` already handles by calling `clearAuthenticated()`.

**Warning signs:** User reports "connected" display after token should have expired.

### Pitfall 6: Token input `type="text"` on mobile triggers wrong keyboard

**What goes wrong:** Tapping the token input on mobile shows alphabetic keyboard, making JWT paste awkward.

**Why it happens:** `type="text"` is the default keyboard for iOS/Android.

**How to avoid:** Use `type="text"` but ensure the paste button is prominent — the clipboard path is primary. The existing pattern in `TransferPanel` uses `font-mono` class which is fine. Token is a long JWT — users will always paste, not type.

## Code Examples

Verified patterns from existing codebase:

### Established Button Style (from TransferPanel.tsx)
```typescript
// Active scale feedback — used for all interactive buttons in the project
className="... active:scale-95 transition-transform cursor-pointer"
```

### Established Dark Mode Tailwind Pattern (from TransferPanel.tsx)
```typescript
// Container pattern
className="rounded border border-zinc-200 dark:border-zinc-700 p-4"
// Text in containers
className="text-zinc-900 dark:text-zinc-100"
// Subdued text
className="text-zinc-600 dark:text-zinc-400"
// Input field
className="border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
```

### Tailwind v4 Dark Mode Variant (from globals.css)
```css
/* Tailwind v4 uses class-based dark mode via custom variant */
@custom-variant dark (&:where(.dark, .dark *));
/* Usage: dark:bg-zinc-900 — applies when ancestor has class="dark" */
```

### Amber Warning Pattern (inferred from project's existing amber use in chip warnings)
```typescript
// Project uses amber-50/amber-800/amber-950/amber-200 for warnings
// For inline text warning (not a box), amber-600 dark:amber-400 is appropriate
className="text-amber-600 dark:text-amber-400"
```

### Existing Expiry Display (current TransferPanel.tsx lines 208-213)
```typescript
{expiresAt && (
  <span className="text-zinc-400 ml-1">
    &bull; valid until{' '}
    {new Date(expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </span>
)}
```
This is the baseline to build the three-state expiry display on top of.

### TanStack Query Cache Invalidation (from useAuthStatus.ts)
```typescript
// After successful login — triggers refetch so expiresAt populates
function setAuthenticated() {
  queryClient.invalidateQueries({ queryKey: ['auth-status'] })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline expand (showTokenForm) | Modal/dialog | Phase 20 | Gives guide room; keeps Squad tab clean |
| Single "valid until" display | Three-state expiry (normal / expiring soon / expired) | Phase 20 | Users know when to reconnect |
| No clipboard assistance | Paste button | Phase 20 | Reduces friction by one step |
| 1-sentence inline instructions | Full numbered guide in modal | Phase 20 | Non-technical users can follow without help |

**Deprecated/outdated:**
- `showTokenForm` state in TransferPanel: replaced by `isModalOpen` state that controls `AuthModal`
- Inline `<form>` for token in TransferPanel: moves into `AuthModal` component

## Open Questions

1. **`<dialog>` Tailwind backdrop styling**
   - What we know: Tailwind v4 supports `backdrop:` prefix for `<dialog>::backdrop`
   - What's unclear: Whether the project's Tailwind v4 config compiles `backdrop:bg-black/50` correctly without explicit plugin config
   - Recommendation: Test in a Wave 0 task. If not supported, use an inline `style` attribute as fallback: `style={{ '--tw-backdrop-opacity': '0.5' }}` is not needed — just use `<dialog style={{ }}>` with regular CSS for the backdrop via a `<style>` block or a Tailwind `@layer` rule. Lowest-risk fallback: `::backdrop { background: rgba(0,0,0,0.5); }` in `globals.css`.

2. **`useAuthStatus` stale time during modal open**
   - What we know: staleTime is 5 minutes; auth status will not re-poll while modal is open
   - What's unclear: Is there a scenario where a user opens the modal after their token expires, submits a new token, and `setAuthenticated()` (which invalidates the cache) fails to update the UI?
   - Recommendation: No issue — `setAuthenticated()` calls `invalidateQueries` which forces a refetch. The 5-min stale time only delays background refetches, not explicit invalidations.

## Environment Availability

Step 2.6: SKIPPED — this phase is purely UI component changes with no external tool dependencies. All required runtimes (Node.js 25.8.1, npm) and frameworks (Next.js 16, React 19, Tailwind v4, Vitest 4) are already verified present from prior phases.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `/vitest.config.ts` (node environment) |
| Quick run command | `npx vitest run tests/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-03 | Modal opens on "Connect FPL account" click; numbered guide renders | manual-only | — | N/A — browser interaction |
| AUTH-03 | Token submitted successfully → `setAuthenticated()` called → auth state updates | manual-only | — | N/A — requires browser + cookie |
| AUTH-03 | Clipboard paste button fills token input | manual-only | — | N/A — requires browser Clipboard API |
| AUTH-04 | Guide steps are accurate (Chrome DevTools path to x-api-authorization) | manual-only | — | N/A — content verification |
| AUTH-04 | Modal dismisses on Cancel, backdrop click, and Escape key | manual-only | — | N/A — browser interaction |
| D-05 | Expiry threshold computation: < 15min → "expired" state | unit | `npx vitest run tests/lib/auth-expiry.test.ts` | ❌ Wave 0 |
| D-05 | Expiry threshold computation: 15min–1hr → "expiring soon" state | unit | `npx vitest run tests/lib/auth-expiry.test.ts` | ❌ Wave 0 |
| D-05 | Expiry threshold computation: > 1hr → normal state | unit | `npx vitest run tests/lib/auth-expiry.test.ts` | ❌ Wave 0 |

**Manual-only justification:** AUTH-03/04 require real browser interaction (Clipboard API, dialog element, cookie setting). The Vitest environment is `node` — no DOM. Component-level testing would require `jsdom` + React Testing Library, which is not installed and not in scope to add.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/auth-expiry.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/auth-expiry.test.ts` — covers D-05 expiry threshold logic (unit-testable pure function)

The expiry threshold logic should be extracted to a pure function (e.g., `computeAuthExpiryState(expiresAt: number | undefined, nowSeconds: number): 'normal' | 'expiring-soon' | 'expired'`) so it can be unit-tested independently of the component.

*(All other phase requirements are manual-only — no additional test files needed)*

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md, which contains one directive:

> "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Relevant to this phase:**
- The `<dialog>` element and Clipboard API are browser/React concerns, not Next.js-specific. No Next.js Route Handler changes are needed.
- The `'use client'` directive is required on `AuthModal.tsx` (uses `useState`, `useRef`, `useEffect`, browser APIs).
- Confirmed Next.js 16.2.1 with React 19.2.4 — no `useActionState` or Server Actions needed (token submission is a plain `fetch` to `/api/auth/login`).

## Sources

### Primary (HIGH confidence)

- Existing codebase — `TransferPanel.tsx`, `useAuthStatus.ts`, `useMyTeam.ts`, `fpl-auth.ts`, `route.ts` files — direct inspection, not inferred
- `globals.css` — confirmed Tailwind v4 `@custom-variant dark` pattern
- `vitest.config.ts` — confirmed `node` environment, no jsdom
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — confirmed `'use client'` requirements
- `package.json` — confirmed Next.js 16.2.1, React 19.2.4, Vitest 4.1.2

### Secondary (MEDIUM confidence)

- MDN `<dialog>` element behavior (focus trap, Escape key, `close` event) — widely documented, stable browser standard
- `navigator.clipboard.readText()` Permissions API requirement — HTTPS/localhost only, user gesture required

### Tertiary (LOW confidence)

- Tailwind v4 `backdrop:` prefix support for `<dialog>::backdrop` — not verified in this specific project config; flagged as Wave 0 validation item

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already present and in use; no new dependencies
- Architecture: HIGH — `<dialog>` is a well-understood browser standard; all integration points directly read from codebase
- Pitfalls: HIGH — dialog/clipboard pitfalls are well-documented browser behavior; expiry staleness pitfall derived from direct reading of `useAuthStatus` stale time
- Test strategy: HIGH — `node` environment confirmed, manual-only rationale is sound

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable browser APIs, no fast-moving dependencies)
