# Phase 134: Push Notifications - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 134 delivers the full web push notification infrastructure: VAPID key setup, a service worker at `public/sw.js`, subscribe/unsubscribe flow behind a bell icon in the app header, and the complete `/api/push/subscribe` + `/api/push/send` + `/api/push/test-send` API surface.

Deliverables:
1. **Bell icon in header** — next to `ThemeToggle`, opens a popover with enable/disable toggle + status line. First click triggers the browser permission prompt (never on page load — PUSH-01).
2. **`/api/push/subscribe` route** — stores/removes the Web Push subscription object in Vercel Blob as `push_subscription.json`.
3. **`/api/push/send` route** — receives a typed notification payload and dispatches to the stored subscription via the `web-push` library. This is the endpoint Phase 135's `notify.py` will call.
4. **`/api/push/test-send` route** — dev-only endpoint, gated by `PUSH_TEST_SECRET` env var, accepts `{ type: 'price' | 'injury' | 'deadline' | 'captain' }` and sends a canned push to the stored subscription. Used to verify PUSH-02 through PUSH-05 during development without notify.py.
5. **`public/sw.js`** — service worker that handles `push` events and renders notifications. Scope MUST be `/` (file at `public/sw.js` — wrong path = push events never fire).

**Phase 134 does NOT include:**
- `notify.py` pipeline integration (Phase 135 — PIPE-02, PIPE-03)
- Per-type notification preferences / granular toggle (Future Requirements)
- iOS PWA push support (Out of Scope — no PushManager in mobile Safari without Add-to-Home-Screen)
- In-app notification inbox (Out of Scope)

</domain>

<decisions>
## Implementation Decisions

### Toggle placement (PUSH-01)
- **D-01:** Bell icon (🔔) placed in the header bar immediately adjacent to `ThemeToggle` — both the top-right area of the page header and within the sticky nav's `ml-auto` cluster. Consistent placement in both mobile header and desktop nav.
- **D-02:** Clicking the bell opens a small popover (not a modal, not a new page). Popover content: enable/disable toggle + one status line. Status values: "Subscribed", "Permission denied", "Not subscribed". Nothing else — no per-type chips in v1.26.
- **D-03:** The browser permission prompt fires only when the user explicitly clicks Enable for the first time. Never on page load, never on app mount (PUSH-01 requirement).
- **D-04:** No new settings section or sub-tab is added to the main navigation. Toggle lives exclusively in the bell popover.

### Player scope for alerts (PUSH-02, PUSH-03, PUSH-05)
- **D-05:** PUSH-02 price projection alerts scope: **owned players only**. The "watched" clause in the requirement is dropped for v1.26 — the watchlist is localStorage-only and the pipeline cannot access it. Future phase can add watched-player server sync.
- **D-06:** PUSH-03 injury alerts scope: owned players only, same reasoning as D-05.
- **D-07:** Player/squad source for PUSH-03 and PUSH-05: notify.py reads the existing squad Blob data that the pipeline already writes (the same data used by `/api/squad` and `/api/lineup-news`). No new FPL API calls in notify.py.
- **D-08:** PUSH-05 captain recommendation source: notify.py reads captain_snapshots data from Blob and detects change vs previous run state.

### Subscription persistence
- **D-09:** Push subscription stored as `push_subscription.json` in Vercel Blob. Schema: `{ endpoint, keys: { p256dh, auth }, sent_reminders: { gw: number, fired_24h: boolean, fired_2h: boolean } }`. The `sent_reminders` field is used by notify.py for PUSH-04 deduplication (Phase 135 writes to it).
- **D-10:** `/api/push/subscribe` uses `allowOverwrite: true` when writing to Blob — re-subscribing (e.g., after browser clears push state) always updates the subscription object.

### Deadline reminder mechanism (PUSH-04)
- **D-11:** Deadline reminder deduplication is notify.py's responsibility (Phase 135). Phase 134 only needs to: (a) define the `sent_reminders` schema in `push_subscription.json`, (b) ensure `/api/push/send` accepts a `deadline_reminder` notification type with `{ hours_until: 24 | 2 }` payload shape.
- **D-12:** Phase 134 does NOT implement deadline proximity logic — that lives entirely in notify.py (Phase 135). Phase 134 verifies PUSH-04 by calling `/api/push/test-send` with `type: 'deadline'`.

### Phase 134 vs Phase 135 boundary
- **D-13:** Phase 134 verification method for PUSH-02, PUSH-03, PUSH-04, PUSH-05: call `POST /api/push/test-send` with the appropriate `type` param. The endpoint sends a canned notification to the stored subscription — confirming the full push delivery chain works end-to-end (service worker receives `push` event and renders it).
- **D-14:** `PUSH_TEST_SECRET` env var gates `/api/push/test-send`. Request must include `Authorization: Bearer <PUSH_TEST_SECRET>`. Returns 403 if missing/wrong. Route file returns 404 in production build (guarded by `process.env.NODE_ENV !== 'production'` check or equivalent).

### VAPID configuration
- **D-15 (Critical):** `VAPID_PRIVATE_KEY` must NOT use `NEXT_PUBLIC_` prefix — that would expose the private key in the client bundle. Server-only env var. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is correct for the public key (needed in browser to subscribe).
- **D-16:** Service worker registered in `src/app/layout.tsx` via a client component `PushServiceWorkerRegistrar` (or inline `useEffect`). Registration happens once on mount, independent of whether the user has subscribed.

### Claude's Discretion
- Exact notification payload shape for each type (price, injury, deadline, captain) — match standard Web Notification API `title` + `body` + optional `icon` pointing to `/favicon.ico`
- Whether `useSubscription` state is held in React context or a standalone hook
- Test coverage scope — unit tests for `/api/push/send` with mocked `web-push`; integration test calls `/api/push/test-send` to verify real push delivery
- `web-push` npm package is the conventional choice for VAPID; no need to evaluate alternatives

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Push Notifications — PUSH-01 through PUSH-05 with full acceptance criteria

### Research Flags (from STATE.md — critical constraints already discovered)
- `.planning/STATE.md` §Research Flags to Heed — two HIGH-severity flags for this phase: service worker scope (`public/sw.js` only) and VAPID private key prefix

### Existing Pipeline Patterns
- `pipeline/refresh_gate.py` — isolation pattern: standalone utility that MUST NOT import from `run.py`; notify.py (Phase 135) follows the same rule
- `pipeline/upload.py` — Vercel Blob write pattern (`upload_json` with `allowOverwrite: True`); push_subscription.json follows the same write pattern

### Existing UI Patterns
- `src/app/page.tsx` lines 195–220 — header structure; bell icon placement in the `ml-auto flex items-center gap-2` cluster next to `ThemeToggle`
- `src/components/theme/ThemeToggle.tsx` — placement anchor; bell popover should match ThemeToggle's visual weight and sizing
- `src/components/DeadlineBanner.tsx` lines 56–110 — localStorage per-GW state pattern (`deadline-dismissed:GW{N}`); same pattern for any client-side push state

### Watchlist (deliberately NOT server-side)
- `src/lib/hooks/useWatchlist.ts` — localStorage-only watchlist hook; confirms why "watched" scope is dropped for v1.26 (D-05)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/theme/ThemeToggle.tsx` — visual pattern for small header icon buttons; bell icon component should match its size/padding/hover style
- `pipeline/upload.py` — `upload_json(pathname, data)` and `save(pathname, data)` for Blob writes; push_subscription.json uses the same interface
- `src/components/DeadlineBanner.tsx` — localStorage gating pattern reusable for tracking push permission state client-side

### Established Patterns
- All pipeline utilities are standalone modules that never import from `run.py` (refresh_gate.py isolation pattern) — notify.py in Phase 135 must follow this; `/api/push/send` is the clean boundary
- Vercel Blob uses `allowOverwrite: true` for idempotent writes — applies to push_subscription.json
- Env vars: `NEXT_PUBLIC_*` for client-safe values only; server secrets use bare names (e.g., `VAPID_PRIVATE_KEY`, `BLOB_READ_WRITE_TOKEN`)

### Integration Points
- `src/app/layout.tsx` — service worker registration goes here (client component, runs once on mount)
- `src/app/page.tsx` header cluster (lines 195–220) — bell icon added to existing `flex items-center gap-2` alongside ThemeToggle
- `src/app/api/` — new routes: `push/subscribe/route.ts`, `push/send/route.ts`, `push/test-send/route.ts`

</code_context>

<specifics>
## Specific Ideas

- Bell icon placement: immediately adjacent to ThemeToggle in the `ml-auto` cluster — both in the mobile header (`lines 195–200`) and the sticky desktop nav (`lines 217–220`)
- Popover content: just toggle + one-line status. No per-type preferences in v1.26.
- Test endpoint: `POST /api/push/test-send` with `Authorization: Bearer <PUSH_TEST_SECRET>` header + `{ type: 'price' | 'injury' | 'deadline' | 'captain' }` body
- `push_subscription.json` schema includes `sent_reminders` from the start so Phase 135 doesn't need a schema migration
- PUSH-02 price threshold (|delta| ≥ £0.2m) and 24h per-player cooldown tracking both live in notify.py (Phase 135), not in Phase 134's API routes

</specifics>

<deferred>
## Deferred Ideas

- **Watched player sync for PUSH-02** — Adding a `/api/watchlist` server-side endpoint so the pipeline can know the user's watched players. Dropped for v1.26 (PUSH-02 scoped to owned players only). Future phase.
- **Per-type notification preferences** — Granular enable/disable per notification type (price, injury, deadline, captain). Explicitly in REQUIREMENTS.md Future Requirements. Future phase.
- **iOS PWA push support** — Requires PWA manifest + Add-to-Home-Screen installation. Out of scope for v1.26. Future phase.
- **In-app notification inbox** — Push + badge count is sufficient for v1.26. Future phase.

</deferred>

---

*Phase: 134-Push-Notifications*
*Context gathered: 2026-05-22*
