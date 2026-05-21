# Architecture Research — v1.26 Off-Season Intelligence

**Researched:** 2026-05-20
**Overall confidence:** HIGH — built from direct code inspection + verified Next.js 16 official docs (lastUpdated 2026-05-19)

---

## Integration Map

### New Files

**Pipeline (Python)**
- `pipeline/price_reset.py` — compares `now_cost` vs season_archive_gw38.json baseline, outputs `price_reset.json`
- `pipeline/notify.py` — thin script called from GitHub Actions after run.py; detects trigger conditions (price change, injury, deadline); POSTs to `/api/push/send`

**Next.js API Routes**
- `src/app/api/price-reset/route.ts` — serves `price_reset.json` from Vercel Blob (mirrors `price-changes` route pattern exactly)
- `src/app/api/push/subscribe/route.ts` — POST: accept PushSubscription JSON, write to Blob as `push_subscription.json`
- `src/app/api/push/unsubscribe/route.ts` — DELETE: remove/null subscription from Blob
- `src/app/api/push/send/route.ts` — POST: internal endpoint; validates PIPELINE_NOTIFY_SECRET; reads subscription from Blob; calls `webpush.sendNotification`

**Next.js Lib**
- `src/lib/hooks/usePriceReset.ts` — TanStack Query hook, 6h staleTime, mirrors `usePriceChanges` pattern
- `src/lib/push-utils.ts` — `urlBase64ToUint8Array` helper + subscription serialisation, shared across push components

**Next.js Components**
- `src/components/push/PushNotificationToggle.tsx` — client component: checks serviceWorker support, handles subscribe/unsubscribe, renders enable/disable button + permission status
- `src/components/deadline/DeadlineDayBanner.tsx` — dismissible amber banner that renders when `hoursToDeadline < 24`; localStorage-dismissed per GW
- `src/components/price-reset/PriceResetTab.tsx` — table showing players whose FPL price rose/fell vs pre-season baseline, sortable by delta

**Service Worker**
- `public/sw.js` — push event listener (`self.addEventListener('push', ...)`) + notificationclick handler; ~25 lines

### Modified Files

**Pipeline**
- `pipeline/transfer_news.py` — add `SOURCE_TIERS` dict mapping source names to tiers; add `_decay_confidence(published_at, tier)` function; apply `source_tier` + `confidence_score` to each article (additive to existing schema)
- `pipeline/run.py` — add `price_reset` call inside `IS_OFF_SEASON and _pre_season_predicate` block; the push notify trigger lives in `notify.py` (separate step, not in run.py)

**GitHub Actions**
- `.github/workflows/pipeline.yml` — add `PIPELINE_NOTIFY_SECRET` + `VERCEL_PRODUCTION_URL` env vars; add `Send push notifications` step after `Run pipeline` that runs `python pipeline/notify.py`

**Next.js App**
- `src/app/page.tsx` — add `DeadlineDayBanner` above section nav; add `price-reset` sub-tab to Analyse section SECTIONS constant; extend `SubTab` union type; wire `PushNotificationToggle` into Squad section or a settings area
- `src/app/api/auth/fpl-login/route.ts` — guard against dead `users.premierleague.com` endpoint; return `{ ok: false, code: 'ENDPOINT_GONE' }` instead of propagating a 502 (see Auth 502 Fix section)

---

## Data Flows

### Transfer Speculation Scoring
```
transfer_news.py (RSS scrape, runs year-round)
  → per article: classify_article() → classification (existing 5-class)
  → NEW: SOURCE_TIERS dict lookup → tier: 'official'|'reliable'|'tabloid'
  → NEW: _decay_confidence(published_at, tier) → confidence_score: float 0.0–1.0
         formula: base = max(0, 1 - (age_days / 7))
                  score = base * TIER_MULTIPLIERS[tier]
                  TIER_MULTIPLIERS = { official: 1.0, reliable: 0.8, tabloid: 0.5 }
  → artifact: transfer_news.json.articles[*] gains { source_tier, confidence_score }
    (additive — existing consumers unchanged)
  → /api/transfer-news returns enriched articles
  → SummerWindowTab renders confidence bar + tier badge alongside existing classification pill
```

TypeScript type change (additive):
```typescript
interface TransferArticle {
  // ... existing fields ...
  source_tier?: 'official' | 'reliable' | 'tabloid'  // optional for backward compat
  confidence_score?: number                             // 0.0–1.0
}
```

### Price Reset Analysis
```
pipeline/price_reset.py (IS_OFF_SEASON and _pre_season_predicate only)
  → reads bootstrap.elements[].now_cost (current prices)
  → reads Vercel Blob: season_archive_gw38.json → players[].now_cost (GW38 baseline)
  → per element_id: delta = now_cost - archived_now_cost
  → writes price_reset.json:
      { generated_at, players: [{ id, name, team, baseline_cost, current_cost, delta, pct_change }] }

/api/price-reset/route.ts (verbatim copy of /api/price-changes/route.ts, different blob key)
  → reads price_reset.json from Blob
  → returns JSON with Cache-Control: public, s-maxage=3600

usePriceReset() hook
  → queryKey: ['price-reset']
  → staleTime: 6h (prices only change once/day)
  → 404 → null (graceful: archive absent until GW38 archived)

PriceResetTab
  → sorted by |delta| desc (largest moves first)
  → green pill for rises, red pill for falls
  → shows absolute delta (0.1m units) + % change
  → empty state: "Price reset data not yet available — check back when FPL publishes next season prices"
```

Placement in `run.py`: call inside the `if IS_OFF_SEASON:` block after the existing `_pre_season_predicate` check, alongside the pre-season squad recompute.

### Deadline Day Mode
```
Client-side computation only — no new API route.

useDeadline() hook (or inline in page.tsx)
  → reads from usePlayers() hook OR a dedicated fetch of bootstrap events
  → recommended: thin hook fetching /api/fpl/bootstrap-static proxy (already exists)
    OR read deadlines from the existing last_updated.json enriched with next_deadline_time

page.tsx
  → compute hoursToDeadline = (nearest_future_deadline - now) / 3600000
  → if hoursToDeadline < 24: render DeadlineDayBanner
  → DeadlineDayBanner stores dismiss state in localStorage key: 'deadline-dismissed:{gwId}'
  → auto-re-shows when gwId changes (new GW's deadline)
  → banner shows: countdown timer, links to Squad > Transfers, watchlist alert if any
    watched players have recent injury news
```

Simplest data source: FPL bootstrap already cached by `usePlayers()`. Add `events` pass-through from the API route or create a `useBootstrapEvents()` hook that fetches `bootstrap-static` lightweight (events only).

### Web Push (ALERT-01)
```
Browser (first visit / settings):
  PushNotificationToggle.tsx
    → navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    → requestPermission()
    → pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })
    → POST /api/push/subscribe { subscription: serialized PushSubscription JSON }
      → route writes push_subscription.json to Vercel Blob (allowOverwrite: true)
      → returns { ok: true }

GitHub Actions (post-pipeline step, via notify.py):
  → Detects one or more trigger conditions:
      1. Price change: compare bootstrap elements to prev_pc_snapshot (already computed)
      2. Injury flag: compare 'news' or 'chance_of_playing' to prev merged_players.json
      3. Deadline alert: check_deadline_window() with PIPELINE_NOTIFY_SECRET window = 360 (6h), 120 (2h), 30 (30m)
  → POST https://{VERCEL_PRODUCTION_URL}/api/push/send
      { secret: PIPELINE_NOTIFY_SECRET, type, data }
  → /api/push/send route:
      validates secret, reads push_subscription.json from Blob
      calls webpush.sendNotification(subscription, JSON.stringify({ title, body, icon, type }))
      returns { sent: true } or { sent: false, reason: 'no_subscription' }

Service Worker (public/sw.js):
  self.addEventListener('push', (event) => {
    const data = event.data.json()
    event.waitUntil(self.registration.showNotification(data.title, {
      body: data.body, icon: '/icon.png', badge: '/badge.png',
      data: { url: data.url || '/' }
    }))
  })
  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(clients.openWindow(event.notification.data.url))
  })
```

---

## Web Push Architecture (ALERT-01)

### Service Worker (`public/sw.js`)
Standard Web Push API pattern per Next.js 16 official docs (confirmed current, lastUpdated 2026-05-19). File placed in `public/` is served as a static asset at `/sw.js`. Registration via `useEffect` in `PushNotificationToggle` (dedicated client component, not inline in page.tsx).

`updateViaCache: 'none'` is critical — prevents browser serving stale service worker. Add corresponding header in `next.config.ts`:
```javascript
{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }
```

### Subscription Storage Decision: Vercel Blob, not KV

Vercel KV (Redis) was deprecated and sunset December 2024. The Upstash Redis replacement requires a separate paid integration and new credentials. For a single-user app storing one subscription object, Vercel Blob with `allowOverwrite: true` is the correct choice:
- `BLOB_READ_WRITE_TOKEN` is already wired in production (Vercel env var) and GitHub Actions secrets
- Pattern is used throughout the existing codebase (`save()` function in `upload.py`)
- Single JSON file at `push_subscription.json` — no concurrent write risk (one user)
- `list({ prefix: 'push_subscription.json', limit: 1 })` → `fetch(url)` follows the exact pattern in every existing route handler

No new storage credentials. No new infrastructure.

### VAPID Keys
Generate once: `npx web-push generate-vapid-keys`

New environment variables (add to Vercel dashboard + GitHub Actions secrets):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — exposed to browser (required for subscription)
- `VAPID_PRIVATE_KEY` — server-side only, signs notifications
- `PIPELINE_NOTIFY_SECRET` — shared secret validating pipeline → `/api/push/send` calls
- `VERCEL_PRODUCTION_URL` — the production Vercel URL for pipeline notify.py to POST to

### Route Handler Runtime: Node.js (not Edge)
`/api/push/send` must declare `export const runtime = 'nodejs'`. The `web-push` npm package uses Node.js crypto APIs that fail on the Edge runtime. This is the same constraint as `/api/player-insight` (documented in PROJECT.md Key Decisions).

### Notification Trigger Types

| Trigger | Detection location | When fires |
|---------|-------------------|------------|
| Price change | `notify.py` comparing pc_predictions with previous run's snapshot | Any player price change |
| Injury flag | `notify.py` reading new vs old bootstrap `news` fields for squad players | `chance_of_playing_next_round` drops for watched/squad players |
| Deadline reminder | `notify.py` calling `check_deadline_window()` with 360/120/30 min windows | 6h, 2h, 30m before each GW deadline |

The `notify.py` module runs as a GitHub Actions step after `run.py` and has access to the full bootstrap data from the run. It's a standalone thin script (like `refresh_gate.py`) — does NOT import from `run.py` to avoid syntax-error coupling.

---

## Pipeline Scheduling Architecture (REFRESH-01)

### What Already Exists (Phase 89, shipped)
The `pipeline.yml` already has event-aware scheduling:
- Baseline 4x daily: `0 6,12,18,0 * * *`
- Sat/Sun dense: `0,30 8-13 * * 6,0` (every 30 min, covers FPL weekend deadlines)
- Fri dense: `0,30 16-20 * * 5` (every 30 min, covers Friday early-kick/Cup deadlines)
- `pipeline/refresh_gate.py` gates each dense run against a 90-min deadline window

**REFRESH-01 in v1.26 is not a scheduling re-architecture.** The schedule is comprehensive. The missing piece is the push notification trigger for deadline reminders, price changes, and injury alerts.

### What REFRESH-01 Actually Means in v1.26
Add a `notify.py` pipeline step that runs after each `run.py` completion and dispatches push notifications based on what changed. This reuses the existing scheduling infrastructure.

The 6h/2h/30m notification cadence mentioned in the milestone refers to what the notifications fire at (not new cron entries). `notify.py` reads bootstrap deadlines and determines if a push is warranted:
```python
# In notify.py:
if check_deadline_window(events, window_minutes=360):
    send_push(type='deadline_6h', data={...})
elif check_deadline_window(events, window_minutes=120):
    send_push(type='deadline_2h', data={...})
elif check_deadline_window(events, window_minutes=30):
    send_push(type='deadline_30m', data={...})
```

Since the dense schedule already fires every 30 minutes before a deadline, these checks will naturally catch each window as the pipeline runs.

### Workflow Addition to `pipeline.yml`
```yaml
- name: Send push notifications
  if: |
    github.event_name == 'workflow_dispatch' ||
    (github.event_name == 'schedule' && github.event.schedule == '0 6,12,18,0 * * *') ||
    steps.gate.outputs.run == 'true'
  env:
    PIPELINE_NOTIFY_SECRET: ${{ secrets.PIPELINE_NOTIFY_SECRET }}
    VERCEL_PRODUCTION_URL: ${{ secrets.VERCEL_PRODUCTION_URL }}
    BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  run: python pipeline/notify.py
```

The `BLOB_READ_WRITE_TOKEN` is needed so `notify.py` can read bootstrap data from Blob to detect injury flag changes.

---

## Auth 502 Fix

**Root cause (from memory + code inspection):** The 502 originates from `/api/auth/fpl-login/route.ts` (the credential-path route at line 31) which still attempts `fetch('https://users.premierleague.com/accounts/login/')`. FPL migrated to OAuth 2.0 PKCE via `account.premierleague.com` — the `users.premierleague.com` form-post endpoint no longer exists and returns a connection error which propagates as a 502.

The active/working token-paste route is `/api/auth/login/route.ts` — this accepts a JWT Bearer token directly, validates it, and stores it as a cookie. This route is correct and working.

**Fix:** In `/api/auth/fpl-login/route.ts`, wrap the `fetch(users.premierleague.com)` call with a guard or replace the try/catch to return `{ ok: false, code: 'ENDPOINT_GONE', message: 'FPL credential login no longer supported — use the manual token paste flow' }` with status 200 (not 502). The UI already has a manual token-paste fallback. The fpl-login route should be treated as a deprecated dead code path.

Alternative (cleaner): delete the fpl-login route entirely and ensure the AuthModal always shows the manual token-paste flow. Check `src/components/auth/AuthModal.tsx` to confirm the credential form is only shown when fpl-login is available.

---

## Suggested Build Order

### Phase A: Auth 502 Fix (no dependencies, unblocks testing)
1. Fix `/api/auth/fpl-login/route.ts` — replace dead endpoint call with immediate `{ ok: false, code: 'ENDPOINT_GONE' }` response
2. Verify `/api/auth/login/route.ts` (token-paste path) is working in production
3. Confirm AuthModal correctly falls back to manual token-paste UI on `ENDPOINT_GONE` response

### Phase B: Transfer Speculation Scoring (pipeline-only, no new infrastructure)
1. Add `SOURCE_TIERS` dict and `_decay_confidence()` function to `transfer_news.py`
2. Apply `source_tier` + `confidence_score` to each article in both `_scrape_rss_sky` and `_scrape_rss_bbc`
3. Update TypeScript `TransferArticle` type (additive optional fields — no breaking change)
4. Update `SummerWindowTab.tsx` to render confidence bar + tier badge
5. Write pytest tests for tier assignment and confidence decay formula

### Phase C: Price Reset Analysis (depends on: season_archive_gw38.json from v1.24)
1. Write `pipeline/price_reset.py` — reads bootstrap + archive, computes deltas per element
2. Add call in `run.py` inside `IS_OFF_SEASON and _pre_season_predicate` block
3. Write `src/app/api/price-reset/route.ts` (copy of `price-changes/route.ts`, different blob key + filename)
4. Write `src/lib/hooks/usePriceReset.ts` (copy of `usePriceChanges.ts`, different query key)
5. Write `PriceResetTab` component with rise/fall table
6. Wire `price-reset` SubTab into `page.tsx` Analyse section SECTIONS constant

### Phase D: Deadline Day Banner (no backend dependencies, pure frontend)
1. Determine data source — `useBootstrapEvents()` hook fetching bootstrap-static via existing proxy OR enrich `last_updated.json` with `next_deadline_time` in pipeline
2. Write `useDeadline()` hook or inline deadline computation
3. Write `DeadlineDayBanner` component with localStorage dismiss per GW
4. Wire into `page.tsx` above section nav

### Phase E: Web Push Notifications (depends on B and C for useful notification content)
1. Generate VAPID keys; add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PIPELINE_NOTIFY_SECRET`, `VERCEL_PRODUCTION_URL` to Vercel env vars and GitHub Actions secrets
2. Write `public/sw.js` service worker (~25 lines)
3. Add `Cache-Control: no-cache` header for `/sw.js` in `next.config.ts` headers
4. Write `/api/push/subscribe/route.ts` and `/api/push/unsubscribe/route.ts`
5. Write `/api/push/send/route.ts` (Node.js runtime, secret validation, webpush.sendNotification)
6. Write `src/lib/push-utils.ts` utility module
7. Write `PushNotificationToggle` client component
8. Write `pipeline/notify.py` — detects price/injury/deadline triggers, POSTs to `/api/push/send`
9. Add `Send push notifications` step to `pipeline.yml`
10. Wire `PushNotificationToggle` into UI (Squad section header or dedicated Settings area)

**Rationale for order:**
- Auth fix first: unblocks authenticated testing (squad load etc.) without touching other features
- Transfer scoring second: pipeline-only, no new infrastructure, immediate value for the Summer Window tab
- Price reset third: needs the archived GW38 prices (available), new UI tab, no infrastructure beyond existing Blob
- Deadline banner fourth: pure frontend, quick win, uses existing data
- Push last: requires new VAPID infrastructure, new pipeline step, most moving parts; benefits from B and C giving meaningful notification triggers

---

## Key Decisions

### 1. Vercel Blob for push subscription storage (not KV/Upstash)
**Decision:** Store `push_subscription.json` in Vercel Blob with `allowOverwrite: true`.
**Rationale:** Vercel KV deprecated and sunset December 2024 (confirmed by search). Upstash Redis replacement requires a separate paid integration and new credentials. This is a single-user app — one subscription JSON blob is the right granularity. The `BLOB_READ_WRITE_TOKEN` is already wired in both production (Vercel env var) and GitHub Actions secrets. Zero new infrastructure. Pattern matches every existing route handler in the codebase.

### 2. Pipeline-triggered push notifications via HTTP POST (not SSE or WebSocket)
**Decision:** GitHub Actions `notify.py` POSTs to `/api/push/send` after each pipeline run.
**Rationale:** Vercel serverless functions are stateless — SSE/WebSocket require a persistent connection incompatible with the serverless model. The pipeline already runs in GitHub Actions with outbound HTTP access. HTTP POST from the pipeline to the Vercel route is stateless, consistent with how all other data flows work. Push delivery to the browser happens via the Web Push API (FCM/APNS infrastructure), not a direct socket.

### 3. Service worker in `public/sw.js` (not next-pwa/serwist)
**Decision:** Hand-rolled `public/sw.js` with only push event handlers, no offline caching.
**Rationale:** next-pwa requires webpack configuration and has known App Router compatibility issues. Serwist adds substantial complexity. The project's constraint is "once-daily refresh is sufficient; no offline requirements." A 25-line service worker with push event listeners and notificationclick handler is the entire requirement. The official Next.js 16 docs (verified current, lastUpdated 2026-05-19) use exactly this pattern.

### 4. `confidence_score` decay formula for transfer news
**Decision:** `score = max(0, 1 - age_days/7) * TIER_MULTIPLIERS[tier]` where `TIER_MULTIPLIERS = { official: 1.0, reliable: 0.8, tabloid: 0.5 }`.
**Rationale:** Simple, deterministic, zero dependencies. A reliable-tier article at day 0 scores 0.8; at day 3 scores 0.46; expired at day 7. A tabloid article at day 0 scores 0.5; at day 1 scores 0.43. More useful than raw classification alone. Published in the existing artifact schema as optional additive fields — existing `SummerWindowTab` consumers are unaffected.

### 5. Source tier mapping (Sky Sports and BBC both 'reliable')
**Decision:** `SOURCE_TIERS = { 'skysports': 'reliable', 'bbc': 'reliable' }`. 'official' tier reserved for future direct FPL/club announcement feeds. 'tabloid' reserved for Mirror, Sun, etc. if added.
**Rationale:** Sky Sports and BBC are the two existing sources. Neither publishes official club or FPL announcements — they are reliable mainstream sports outlets. No immediate need to distinguish between them.

### 6. Price reset baseline = season_archive_gw38.json now_cost
**Decision:** Use `now_cost` from `season_archive_gw38.json` (already written by `archive_season.py` at GW38) as the price baseline.
**Rationale:** This artifact already exists from Phase 126 and contains player prices at the end of last season. Comparing vs current bootstrap `now_cost` gives the exact pre-season price change FPL managers care about (who got cheaper, who got more expensive). The calculation only runs when `_pre_season_predicate` is true (FPL published next-season data). If the archive is absent, `price_reset.py` returns an empty payload gracefully (same empty-guard pattern as `transfer_news.py` SCRP-05).

### 7. Deadline Day Banner data source: existing bootstrap proxy
**Decision:** Derive `hoursToDeadline` client-side from `events[]` fetched via the existing `/api/fpl/[...proxy]` route (or cached in `usePlayers()` metadata), not a new API endpoint.
**Rationale:** The proxy route already exists and is used for team/squad fetches. Adding a lightweight bootstrap-static fetch (events only, ~2KB) to a `useDeadline()` hook reuses established infrastructure. The math follows `refresh_gate.py`'s `check_deadline_window()` which is already tested.

### 8. `notify.py` is standalone (does NOT import from `run.py`)
**Decision:** `pipeline/notify.py` is a thin standalone script, following the same isolation pattern as `refresh_gate.py`.
**Rationale:** `refresh_gate.py` documentation explicitly states "this module MUST NOT import from pipeline/run.py — a syntax error in run.py cannot break gating." The same reasoning applies: `notify.py` must not fail if `run.py` has an error. It accesses the FPL bootstrap and Blob directly for the data it needs.

### 9. Auth 502 Fix: deprecate credential path, not fix it
**Decision:** Return `{ ok: false, code: 'ENDPOINT_GONE' }` from `/api/auth/fpl-login/route.ts` immediately, without attempting the dead FPL endpoint.
**Rationale:** FPL migrated to OAuth 2.0 PKCE via `account.premierleague.com`. The `users.premierleague.com` form-post endpoint no longer exists. The v1.24 memory note confirms the current working auth is the JWT token-paste flow (`/api/auth/login/route.ts`). Attempting to fix the credential-login flow is architectural dead-end — FPL's OAuth 2.0 PKCE flow requires client-side JS to complete the token exchange (documented in `fpl-login/route.ts` Step 4 comment: "FPL's OAuth flow requires client-side JS to complete the token exchange"). The correct fix is to surface the manual token-paste UI always.

---

## Component Boundary Summary

| Component | Type | Communicates With |
|-----------|------|-------------------|
| `public/sw.js` | Service Worker | Browser Web Push API, shows OS notification |
| `PushNotificationToggle` | React client component | `/api/push/subscribe`, `/api/push/unsubscribe`, SW registration |
| `/api/push/subscribe` | Route Handler (Node.js) | Vercel Blob (write `push_subscription.json`) |
| `/api/push/unsubscribe` | Route Handler (Node.js) | Vercel Blob (delete/null `push_subscription.json`) |
| `/api/push/send` | Route Handler (Node.js) | Vercel Blob (read subscription), `web-push` npm |
| `pipeline/notify.py` | Python script (GitHub Actions) | FPL bootstrap, Vercel Blob (read prev data), POST to `/api/push/send` |
| `DeadlineDayBanner` | React client component | `useDeadline()` hook, `localStorage` for dismiss state |
| `PriceResetTab` | React client component | `usePriceReset()` hook |
| `usePriceReset` | TanStack Query hook | `/api/price-reset` |
| `/api/price-reset` | Route Handler | Vercel Blob (read `price_reset.json`) |
| `pipeline/price_reset.py` | Python module | bootstrap dict + Blob-read `season_archive_gw38.json` |
| `transfer_news.py` (extended) | Python module | RSS feeds (existing), writes enriched `transfer_news.json` |
| `SummerWindowTab` (extended) | React client component | `useTransferNews()` (unchanged), renders new `source_tier` + `confidence_score` fields |
