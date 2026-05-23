# Phase 134: Push Notifications — Research

**Researched:** 2026-05-23
**Domain:** Web Push API, VAPID, service workers, Next.js 16 route handlers, Vercel Blob
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bell icon placed in the header bar immediately adjacent to `ThemeToggle` in both the scroll-away header and the sticky nav `ml-auto` cluster.
- **D-02:** Clicking the bell opens a small popover (not a modal, not a new page). Popover content: enable/disable toggle + one status line. Status values: "Subscribed", "Permission denied", "Not subscribed".
- **D-03:** The browser permission prompt fires only when the user explicitly clicks Enable for the first time. Never on page load, never on app mount (PUSH-01).
- **D-04:** No new settings section or sub-tab. Toggle lives exclusively in the bell popover.
- **D-05:** PUSH-02 price projection alerts scope: owned players only (watchlist dropped for v1.26).
- **D-06:** PUSH-03 injury alerts scope: owned players only.
- **D-07:** Player/squad source: notify.py reads existing squad Blob data (no new FPL API calls).
- **D-08:** PUSH-05 captain recommendation source: notify.py reads captain_snapshots from Blob.
- **D-09:** Push subscription stored as `push_subscription.json` in Vercel Blob. Schema: `{ endpoint, keys: { p256dh, auth }, sent_reminders: { gw: number, fired_24h: boolean, fired_2h: boolean } }`.
- **D-10:** `/api/push/subscribe` uses `allowOverwrite: true` when writing to Blob.
- **D-11:** Deadline reminder deduplication is notify.py's responsibility (Phase 135). Phase 134 only defines the `sent_reminders` schema and ensures `/api/push/send` accepts `deadline_reminder` type.
- **D-12:** Phase 134 does NOT implement deadline proximity logic.
- **D-13:** Phase 134 verification method for PUSH-02 through PUSH-05: `POST /api/push/test-send` with appropriate `type` param.
- **D-14:** `PUSH_TEST_SECRET` env var gates `/api/push/test-send`. Returns 404 in production (`process.env.NODE_ENV !== 'production'` check). Returns 403 if secret missing/wrong.
- **D-15 (Critical):** `VAPID_PRIVATE_KEY` must NOT use `NEXT_PUBLIC_` prefix. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is correct for the public key.
- **D-16:** Service worker registered in `src/app/layout.tsx` via a client component `PushServiceWorkerRegistrar`.

### Claude's Discretion

- Exact notification payload shape for each type — match standard Web Notification API `title` + `body` + optional `icon` pointing to `/favicon.ico` (already specified in UI-SPEC).
- Whether `useSubscription` state is held in React context or a standalone hook.
- Test coverage scope — unit tests for `/api/push/send` with mocked `web-push`; integration test calls `/api/push/test-send`.
- `web-push` npm package is the conventional choice; no need to evaluate alternatives.

### Deferred Ideas (OUT OF SCOPE)

- Watched player sync for PUSH-02 (future phase).
- Per-type notification preferences (future phase).
- iOS PWA push support (out of scope v1.26).
- In-app notification inbox (out of scope v1.26).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUSH-01 | User can enable push notifications via a single toggle — permission prompt gated behind explicit user action, never on page load | Browser Permissions API pattern: call `Notification.requestPermission()` only inside the toggle's click handler, not in `useEffect`/mount |
| PUSH-02 | User receives push when owned player's price projected to change (|delta| >= £0.2m, 24h cooldown, max 3/run) | Phase 134 owns delivery only: `/api/push/send` accepts a `price` notification payload; test-send covers verification |
| PUSH-03 | User receives push when owned player's injury status changes | Phase 134 owns delivery: `/api/push/send` accepts an `injury` payload; test-send covers verification |
| PUSH-04 | User receives deadline reminders 24h and 2h before each FPL GW deadline | Phase 134 owns delivery: `/api/push/send` accepts a `deadline` payload with `hours_until`; `sent_reminders` schema defined in `push_subscription.json` |
| PUSH-05 | User receives push when top captain recommendation changes | Phase 134 owns delivery: `/api/push/send` accepts a `captain` payload; test-send covers verification |

</phase_requirements>

---

## Summary

Phase 134 implements the complete Web Push notification infrastructure for this Next.js 16 / React 19 app. The phase covers: VAPID key setup, a service worker at `public/sw.js`, a bell icon + popover in the page header, three API routes (`/api/push/subscribe`, `/api/push/send`, `/api/push/test-send`), and the Vercel Blob persistence layer for the subscription object. Phase 135 (notify.py) will consume `/api/push/send` to trigger actual alerts — Phase 134 only needs to ensure the delivery chain works end-to-end.

The `web-push` npm library (v3.6.7, Node.js only) is the conventional choice for server-side VAPID push dispatch. It is not currently installed and must be added to `dependencies`. Because it uses Node.js `https` and `url` built-ins, it must be added to `serverExternalPackages` in `next.config.ts` to prevent Next.js from attempting to bundle it for the edge/browser. TypeScript types are available as `@types/web-push` (v3.6.4, covers TS 5.x).

The most critical risk is service worker scope: `public/sw.js` is the only valid path. A service worker at any other path (e.g., `src/sw.js`) will not have the `/` scope required for the `push` event to fire. The second critical risk is VAPID key exposure: `VAPID_PRIVATE_KEY` must never carry the `NEXT_PUBLIC_` prefix.

**Primary recommendation:** Follow the locked decisions verbatim. Install `web-push` + `@types/web-push`, add `serverExternalPackages`, implement the three API routes, place `sw.js` at `public/sw.js`, and register the service worker via a client component in `layout.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser permission prompt | Browser / Client | — | `Notification.requestPermission()` is a browser API, called from a React click handler |
| Service worker registration | Browser / Client | — | `navigator.serviceWorker.register()` runs in the browser; client component in layout.tsx |
| Push event handling + OS notification rendering | Browser / Client (SW) | — | Service worker `push` event is browser-side; `self.registration.showNotification()` is SW API |
| Subscribe/unsubscribe PushSubscription | Browser / Client → API | — | `PushManager.subscribe()` runs in browser; resulting subscription object POSTed to /api/push/subscribe |
| Subscription persistence (push_subscription.json) | API / Backend | Vercel Blob | Server route reads/writes Blob; never touches browser |
| Push dispatch (sendNotification) | API / Backend | — | `web-push.sendNotification()` is Node.js only; lives in /api/push/send route handler |
| VAPID key management | API / Backend | — | Private key is server-only env var; public key exposed via NEXT_PUBLIC_ for browser subscription |
| Bell icon + popover UI | Browser / Client | — | Pure client component; no SSR needed |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| web-push | 3.6.7 | Server-side VAPID push dispatch | The canonical Node.js Web Push library; used by the ecosystem; explicitly chosen in CONTEXT.md |
| @types/web-push | 3.6.4 | TypeScript definitions for web-push | DefinitelyTyped package covering TS 5.x; matches installed TypeScript ^5 |
| @vercel/blob | 2.4.0 (already installed) | Persist push_subscription.json | Already used throughout the codebase for `list` and `put`; project standard |

**Version verification:** [VERIFIED: npm registry — `npm view web-push version` returned 3.6.7, published 2024-01-16. `npm view @types/web-push version` returned 3.6.4. `npm view @vercel/blob version` returned 2.4.0 (already installed at 2.3.1 in package.json — acceptable, `^2.3.1` resolves to 2.4.0).]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser Push API | native | `PushManager.subscribe()`, `PushSubscription` | Used directly in client component; no npm package |
| Service Worker API | native | `push` event, `showNotification()` | Used directly in `public/sw.js`; no npm package |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| web-push | @web-push/server or custom VAPID | web-push is the de facto standard; alternatives add complexity for no gain |
| Vercel Blob | DB / KV store | Blob is already the project's persistence layer; no additional infrastructure needed |

**Installation:**
```bash
npm install web-push @types/web-push
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (user clicks Enable toggle)
  └─► Notification.requestPermission()
        └─► [granted] PushManager.subscribe({ applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY })
              └─► PushSubscription { endpoint, keys: { p256dh, auth } }
                    └─► POST /api/push/subscribe
                          └─► Vercel Blob: put('push_subscription.json', { endpoint, keys, sent_reminders })

Server (notify.py or /api/push/test-send triggers delivery)
  └─► POST /api/push/send { type, payload }
        └─► Blob: get('push_subscription.json') → subscription
              └─► web-push.sendNotification(subscription, JSON.stringify(notification))
                    └─► Push Service (FCM / Mozilla Push / Safari WebPush)
                          └─► Browser Service Worker receives 'push' event
                                └─► self.registration.showNotification(title, { body, icon })
```

### Recommended Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Add PushServiceWorkerRegistrar client component
│   ├── page.tsx                      # Add BellNotificationButton to ml-auto clusters (lines 197-199, 217-220)
│   └── api/
│       └── push/
│           ├── subscribe/route.ts    # POST (store) + DELETE (remove) subscription
│           ├── send/route.ts         # POST — dispatches typed notification via web-push
│           └── test-send/route.ts    # POST — dev-only, canned payloads by type
├── components/
│   └── push/
│       ├── PushServiceWorkerRegistrar.tsx  # 'use client', registers sw on mount
│       ├── BellNotificationButton.tsx      # 'use client', bell + popover
│       └── usePushSubscription.ts          # hook: permission state, subscribe/unsubscribe
└── lib/
    └── types.ts                      # Add PushSubscriptionRecord, PushNotificationPayload types

public/
└── sw.js                             # Service worker — MUST be at this exact path

next.config.ts                        # Add serverExternalPackages: ['web-push']
```

### Pattern 1: Service Worker Registration (client component, runs once on mount)

**What:** A minimal `'use client'` component that calls `navigator.serviceWorker.register('/sw.js')` in a `useEffect`. Placed in `layout.tsx` so it runs on every page.
**When to use:** Registration must happen independent of the push subscription state — the SW handles `push` events even before the user subscribes.

```typescript
// src/components/push/PushServiceWorkerRegistrar.tsx
// Source: MDN Web Docs — Service Worker API
'use client'
import { useEffect } from 'react'

export function PushServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[push] SW registration failed:', err)
    })
  }, [])
  return null
}
```

### Pattern 2: VAPID Public Key Conversion (Uint8Array for PushManager.subscribe)

**What:** `PushManager.subscribe` requires `applicationServerKey` as a `Uint8Array`, not a base64 string. The `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var is base64url-encoded — it must be decoded before use.
**When to use:** Inside the subscribe flow in the client component/hook.

```typescript
// Source: web-push README, MDN PushManager.subscribe() docs
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)))
}
```

### Pattern 3: web-push Server Dispatch

**What:** Server-side route handler that reads the stored subscription and dispatches via `web-push`.
**When to use:** `/api/push/send` and `/api/push/test-send`.

```typescript
// Source: web-push README (github.com/web-push-libs/web-push)
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:user.invalid@gmail.com',   // subject — use project contact email
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

await webpush.sendNotification(
  subscription,  // { endpoint, keys: { p256dh, auth } }
  JSON.stringify({ title, body, icon: '/favicon.ico', data: { url: '/' } }),
)
```

### Pattern 4: Vercel Blob — Read Subscription

**What:** Reading `push_subscription.json` follows the established `list` + `fetch` pattern already used by all other route handlers in this codebase.
**When to use:** In `/api/push/send` before dispatching.

```typescript
// Source: existing codebase pattern (src/app/api/price-reset/route.ts)
import { list, put } from '@vercel/blob'

async function getSubscription(): Promise<PushSubscriptionRecord | null> {
  const { blobs } = await list({ prefix: 'push_subscription.json', limit: 1 })
  if (!blobs.length) return null
  const res = await fetch(blobs[0].url)
  if (!res.ok) return null
  return res.json() as Promise<PushSubscriptionRecord>
}
```

### Pattern 5: Service Worker push event handler

**What:** `public/sw.js` listens for `push` events and calls `showNotification`. Must call `event.waitUntil()` to keep the SW alive during async ops.
**When to use:** This is the entire `public/sw.js` implementation.

```javascript
// Source: MDN Web Docs — Push API / Service Worker API
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      data: data.data || {},
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})
```

### Anti-Patterns to Avoid

- **Calling `requestPermission()` on page load or in `useEffect` with no user gesture:** Browsers will auto-deny and permanently suppress future prompts. Permission must be requested only inside a user-initiated click handler.
- **Placing sw.js anywhere other than `public/sw.js`:** Next.js does NOT serve files from `src/` as static assets. `public/sw.js` is the only path where the service worker will have `/` scope.
- **Using `NEXT_PUBLIC_` prefix on `VAPID_PRIVATE_KEY`:** This embeds the private key in the client JavaScript bundle. Server-only env vars must use bare names.
- **Importing `web-push` in a client component or any file that may be bundled for the browser:** web-push uses Node.js `https` and `url` modules; it will fail at bundle time. It must only be imported in route handlers that run on the server.
- **Missing `serverExternalPackages: ['web-push']` in next.config.ts:** Without this, Next.js may attempt to bundle web-push through the webpack bundler where Node.js core modules are unavailable. web-push is not in Next.js's automatic opt-out list.
- **Not calling `event.waitUntil()` in the service worker `push` handler:** Without it, the browser may kill the service worker before `showNotification()` completes.
- **Storing the raw subscription without `sent_reminders`:** Even if Phase 135 writes `sent_reminders`, Phase 134 must initialise the field in the stored schema so Phase 135 doesn't need a migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VAPID key signing and payload encryption | Custom ECDH/AES-GCM implementation | `web-push` | Message Encryption for Web Push (RFC 8291) + VAPID (RFC 8292) involves elliptic-curve key exchange and AES-128-GCM encryption — getting this wrong produces silent delivery failures or security vulnerabilities |
| Base64url → Uint8Array conversion | Custom atob + charCodeAt loop | The `urlBase64ToUint8Array` utility (10-line snippet) | This specific transform is needed for `applicationServerKey` and is not in any standard library — implement it once as a utility, don't scatter ad-hoc conversions |
| Push endpoint routing (FCM vs Mozilla vs Safari WebPush) | Custom push dispatcher | `web-push` | `sendNotification` handles endpoint detection and appropriate auth headers per push service |

**Key insight:** The Web Push encryption and VAPID signing specs are complex enough that even small bugs produce silent failures (the push service returns 201 but no notification appears). Use `web-push` and test against a real browser subscription.

---

## Common Pitfalls

### Pitfall 1: Service Worker Scope Mismatch

**What goes wrong:** Push notifications are silently never delivered even though the push service returns 201 OK.
**Why it happens:** The service worker scope determines which pages it controls. A SW registered from `/sw.js` has scope `/`, but a SW file placed in `src/` or `src/app/` gets served (if at all) from a sub-path, giving a narrower scope that doesn't cover `push` events for the origin.
**How to avoid:** `public/sw.js` only. Verify with DevTools > Application > Service Workers that the scope shows `/`.
**Warning signs:** Push arrives in DevTools > Application > Background Services > Push Messaging but no notification appears; SW registered scope shows a path like `/app/`.

### Pitfall 2: VAPID Private Key in Client Bundle

**What goes wrong:** Security breach — the private key appears in `window.__NEXT_DATA__` or in a client JS chunk.
**Why it happens:** Any env var with `NEXT_PUBLIC_` prefix is inlined into the client bundle at build time.
**How to avoid:** Name it `VAPID_PRIVATE_KEY` (no prefix). Only reference it in server-only files (route handlers). `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is the correct name for the public key.
**Warning signs:** `next build` produces a warning about exposing sensitive env vars; searching the built JS for the key value finds it.

### Pitfall 3: Permission Prompt on Mount

**What goes wrong:** Browser auto-denies the permission (Chrome silently dismisses, Firefox shows a "blocked" badge). Future attempts to request permission are permanently suppressed. PUSH-01 is violated.
**Why it happens:** `Notification.requestPermission()` called in a `useEffect` on mount or during a non-interactive event.
**How to avoid:** Call `requestPermission()` only inside the onClick handler of the Enable toggle, after the user has explicitly interacted. Check `Notification.permission` first — if it's already `'granted'`, skip the prompt entirely.
**Warning signs:** On first load the permission dialog appears or is auto-denied before any user interaction.

### Pitfall 4: Missing `serverExternalPackages` for web-push

**What goes wrong:** Build fails with `Module not found: Can't resolve 'https'` or `Module not found: Can't resolve 'url'` during `next build`.
**Why it happens:** Next.js bundles server components and route handlers by default. web-push imports Node.js `https` and `url` modules, which are not available in the webpack browser runtime.
**How to avoid:** Add `serverExternalPackages: ['web-push']` to `next.config.ts` before running `next build`.
**Warning signs:** `next build` errors mentioning `https`, `url`, or `asn1.js` module resolution failures.

### Pitfall 5: Subscription Object Mismatch Between Browser and Server

**What goes wrong:** `sendNotification` throws `WebPushError: 400 Bad Request` or `410 Gone`.
**Why it happens:** The `PushSubscription.toJSON()` shape from the browser must be stored verbatim — `{ endpoint, keys: { p256dh, auth } }`. If keys are stored as raw buffers, decoded incorrectly, or the endpoint is stale (user cleared push data), delivery fails.
**How to avoid:** Store `subscription.toJSON()` directly. Use `allowOverwrite: true` so re-subscribing always updates stale data. Handle `410 Gone` by deleting `push_subscription.json` from Blob.
**Warning signs:** `sendNotification` returning 410 (subscription expired) or 400 (malformed subscription).

### Pitfall 6: `application/json` Content-Type Not Set on Blob PUT

**What goes wrong:** `push_subscription.json` is stored but fetched back as `text/plain`, causing silent JSON parse failure in subsequent reads.
**Why it happens:** The `put()` call from `@vercel/blob` requires explicit `contentType` to set the MIME type.
**How to avoid:** Pass `contentType: 'application/json'` in the options object (consistent with `pipeline/upload.py` which passes `'contentType': 'application/json'`).
**Warning signs:** `Content-Type: text/plain` response header when fetching the stored blob URL.

### Pitfall 7: test-send Route Leaking to Production

**What goes wrong:** `/api/push/test-send` is accessible in production, allowing anyone with the `PUSH_TEST_SECRET` to spam notifications.
**Why it happens:** The NODE_ENV guard is omitted or incorrectly implemented.
**How to avoid:** Guard with `if (process.env.NODE_ENV === 'production') return Response.json({ error: 'Not found' }, { status: 404 })` at the top of the route handler.
**Warning signs:** `curl https://fplx.vercel.app/api/push/test-send` returns something other than 404.

---

## Code Examples

Verified patterns from official sources and the existing codebase:

### Blob write pattern (consistent with existing routes)

```typescript
// Source: src/app/api/player-insight/route.ts (existing codebase)
import { put } from '@vercel/blob'

await put('push_subscription.json', JSON.stringify(subscriptionRecord), {
  addRandomSuffix: false,
  allowOverwrite: true,
  access: 'public',
  contentType: 'application/json',
})
```

### Request body parsing pattern (consistent with existing routes)

```typescript
// Source: src/app/api/player-insight/route.ts (existing codebase)
import { z } from 'zod'

const SubscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = SubscribeBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body', detail: parsed.error.message }, { status: 400 })
  }
  // ...
}
```

### Route handler test pattern (consistent with existing tests)

```typescript
// Source: src/app/api/price-reset/route.test.ts (existing codebase)
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}))
vi.mock('@vercel/blob', () => ({ list: vi.fn(), put: vi.fn() }))
```

### Notification payload type definition

```typescript
// src/lib/types.ts addition
export type PushNotificationType = 'price' | 'injury' | 'deadline' | 'captain'

export interface PushNotificationPayload {
  type: PushNotificationType
  title: string
  body: string
  icon: string
  data: { url: string }
  // deadline only:
  hours_until?: 24 | 2
}

export interface PushSubscriptionRecord {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  sent_reminders: {
    gw: number
    fired_24h: boolean
    fired_2h: boolean
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `serverComponentsExternalPackages` | `serverExternalPackages` | Next.js v15.0.0 | Config key renamed; `next.config.ts` must use the new name |
| Calling `Notification.requestPermission()` with a callback | Returns a Promise | Modern browsers | Use `await Notification.requestPermission()` pattern |

**Deprecated/outdated:**
- `serverComponentsExternalPackages`: Renamed to `serverExternalPackages` in Next.js 15. This project is on Next.js 16.2.1 — use `serverExternalPackages`. [VERIFIED: node_modules/next/dist/docs — serverExternalPackages.md confirms rename at v15.0.0]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `web-push` requires `serverExternalPackages` in next.config.ts | Pitfall 4, Standard Stack | If Next.js bundles it successfully without the flag, the config addition is harmless but unnecessary. If the flag is missing and bundling fails, build breaks. Low risk — safe to add regardless. |
| A2 | `public/sw.js` as a plain `.js` file (not `.ts`) is the correct format | Architecture Patterns | Next.js does not transpile files in `public/`. TypeScript is not supported there. If this assumption is wrong, the SW simply won't be served. Risk: LOW — this is a fundamental fact about how `public/` works. |

**If this table is empty:** Not empty — two low-risk assumptions documented above.

---

## Open Questions

1. **VAPID key generation command**
   - What we know: `webpush.generateVAPIDKeys()` generates the key pair; the two keys must be stored as env vars before deployment.
   - What's unclear: The exact `node -e` or `npx web-push generate-vapid-keys` command to use during Wave 0 setup.
   - Recommendation: Document both in Wave 0 tasks: `npx web-push generate-vapid-keys` outputs both keys; add them to `.env.local` and Vercel project settings.

2. **DELETE handler for unsubscribe**
   - What we know: D-02 says disable toggle calls `DELETE /api/push/subscribe` (or POST with unsubscribe flag). CONTEXT.md UI-SPEC says "Call `DELETE /api/push/subscribe`".
   - What's unclear: Whether to delete the Blob entirely or store `{ subscribed: false }` tombstone.
   - Recommendation: Delete the Blob entry on unsubscribe. There is no tombstone use case — if the entry is absent, `sendNotification` is skipped.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | web-push (>= 16) | Yes | v25.8.1 | — |
| npm | Package install | Yes | bundled | — |
| web-push | /api/push/send, test-send | Not installed | — | Must install: `npm install web-push @types/web-push` |
| @vercel/blob | /api/push/subscribe, send | Yes (v2.3.1 installed) | 2.3.1 | — |
| Vitest | Test suite | Yes (v4.1.2) | 4.1.2 | — |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | Client subscription | Not set | — | Must generate + add to .env.local |
| VAPID_PRIVATE_KEY | Server dispatch | Not set | — | Must generate + add to .env.local |
| PUSH_TEST_SECRET | /api/push/test-send auth | Not set | — | Must add to .env.local (any value works in dev) |

**Missing dependencies with no fallback:**
- `web-push` npm package — must be installed before any route handler can be tested
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — must be generated via `npx web-push generate-vapid-keys` and stored in `.env.local`; without them, `setVapidDetails()` throws at import time

**Missing dependencies with fallback:**
- `PUSH_TEST_SECRET` — any string value works; generate with `openssl rand -hex 16` or any random value

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUSH-01 | Permission prompt fires only on explicit click, never on mount | unit | `npm test -- src/components/push/BellNotificationButton.test.tsx` | No — Wave 0 |
| PUSH-01 | Toggle shows correct status text per permission state | unit | `npm test -- src/components/push/BellNotificationButton.test.tsx` | No — Wave 0 |
| PUSH-02 | `/api/push/send` with `type: 'price'` dispatches via web-push mock | unit | `npm test -- src/app/api/push/send/route.test.ts` | No — Wave 0 |
| PUSH-03 | `/api/push/send` with `type: 'injury'` dispatches via web-push mock | unit | `npm test -- src/app/api/push/send/route.test.ts` | No — Wave 0 |
| PUSH-04 | `/api/push/send` with `type: 'deadline'` dispatches; payload includes `hours_until` | unit | `npm test -- src/app/api/push/send/route.test.ts` | No — Wave 0 |
| PUSH-05 | `/api/push/send` with `type: 'captain'` dispatches via web-push mock | unit | `npm test -- src/app/api/push/send/route.test.ts` | No — Wave 0 |
| PUSH-01 | `/api/push/subscribe` POST stores subscription with correct schema | unit | `npm test -- src/app/api/push/subscribe/route.test.ts` | No — Wave 0 |
| PUSH-01 | `/api/push/subscribe` DELETE removes subscription from Blob | unit | `npm test -- src/app/api/push/subscribe/route.test.ts` | No — Wave 0 |
| PUSH-02–05 | `/api/push/test-send` sends canned payload, returns 404 in prod | unit | `npm test -- src/app/api/push/test-send/route.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --reporter=dot`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- `src/app/api/push/send/route.test.ts` — covers PUSH-02, PUSH-03, PUSH-04, PUSH-05 (mocked web-push)
- `src/app/api/push/subscribe/route.test.ts` — covers PUSH-01 subscribe/unsubscribe contract
- `src/app/api/push/test-send/route.test.ts` — covers dev-only endpoint + production 404 gate
- `src/components/push/BellNotificationButton.test.tsx` — covers PUSH-01 permission gating behaviour

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable — push is a background channel, not an auth flow |
| V3 Session Management | No | No session is established via push |
| V4 Access Control | Yes (test-send) | `Authorization: Bearer <PUSH_TEST_SECRET>` header; 403 without it; 404 in production |
| V5 Input Validation | Yes | Zod schemas on POST bodies for `/api/push/subscribe` and `/api/push/send` |
| V6 Cryptography | Yes | VAPID private key is server-only env var; web-push handles all signing/encryption |

### Known Threat Patterns for Web Push + Next.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| VAPID private key exposure via NEXT_PUBLIC_ env var | Information Disclosure | Never use NEXT_PUBLIC_ prefix for private key (D-15, locked) |
| Unrestricted test-send endpoint in production | Elevation of Privilege | NODE_ENV check returns 404 in production (D-14, locked) |
| Missing Authorization header on test-send | Spoofing | Bearer token check against PUSH_TEST_SECRET; 403 without it |
| Storing unvalidated subscription objects in Blob | Tampering | Zod schema validation before Blob write |
| Push to stale/unowned subscription (410 Gone) | Denial of Service | Handle 410 by deleting push_subscription.json from Blob |

---

## Project Constraints (from CLAUDE.md)

The following directives apply from `CLAUDE.md` and `AGENTS.md`:

1. **Read Next.js docs before writing code:** `node_modules/next/dist/docs/` is the canonical reference. This research verified: Route Handlers (01-app/01-getting-started/15-route-handlers.md) and serverExternalPackages (01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md).
2. **Heed deprecation notices:** `serverComponentsExternalPackages` is deprecated; the current name is `serverExternalPackages` (confirmed in the local Next.js docs).
3. **No `Co-Authored-By` trailers in git commits.**
4. **Icon library:** None — icons as Unicode/emoji literals matching ThemeToggle pattern (bell emoji `🔔`). [VERIFIED: 134-UI-SPEC.md]

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `src/app/api/player-insight/route.ts`, `src/app/api/price-reset/route.ts` — verified Blob `put`/`list` patterns, route handler structure, Zod validation pattern
- Existing codebase — `src/components/theme/ThemeToggle.tsx` — verified button className pattern
- Existing codebase — `src/app/page.tsx` lines 195–220 — verified header structure and ml-auto cluster
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Route Handlers API, caching behaviour, supported HTTP methods
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — serverExternalPackages config, automatic opt-out list (web-push not in list), v15 rename
- npm registry — `web-push` v3.6.7 verified, `@types/web-push` v3.6.4 verified, `@vercel/blob` 2.4.0 verified

### Secondary (MEDIUM confidence)

- `github.com/web-push-libs/web-push/blob/master/README.md` — VAPID key generation, setVapidDetails usage, sendNotification signature, subscription object shape, Safari localhost gotcha [CITED: web-push GitHub README]
- `github.com/web-push-libs/web-push/blob/master/src/web-push-lib.js` — Node.js https/url imports confirmed; validates serverExternalPackages requirement [CITED: web-push source]

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — web-push version verified via npm registry; @vercel/blob already installed; @types/web-push version verified
- Architecture: HIGH — patterns verified against existing codebase; service worker scope and VAPID constraints verified against locked decisions in CONTEXT.md
- Pitfalls: HIGH — service worker scope and VAPID key prefix are documented as HIGH-severity flags in STATE.md Research Flags; other pitfalls verified against web-push source code and Next.js docs

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (web-push is stable; Next.js 16 docs are stable)
