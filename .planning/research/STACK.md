# Stack Research — v1.26 Off-Season Intelligence

**Project:** FPL Analyst
**Researched:** 2026-05-20
**Scope:** New dependencies only. Existing stack (Next.js 16, React 19, TypeScript, TanStack Query, Tailwind CSS v4, Vitest, Vercel Blob, Anthropic SDK, Python pipeline) is validated and out of scope.

---

## New Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `web-push` | `3.6.7` | Server-side VAPID push dispatch | Node.js runtime only; latest release Aug 2023; stable, widely deployed |
| `@types/web-push` | `3.3.5` | TypeScript types for web-push | devDependency |

No other new npm packages needed for v1.26. All other features (price reset, source scoring, pipeline scheduling, auth fix) extend existing stack capabilities with code changes only.

---

## Web Push (ALERT-01)

### Library Decision

Use `web-push` npm library with VAPID keys. This is the standard for provider-free web push in Node.js and is explicitly used in Next.js's official PWA guide (docs last updated 2026-05-19, confirmed current).

**Confidence: HIGH** — official Next.js docs cite this library and pattern directly.

### Architecture

Three components:

**1. `/public/sw.js` — static service worker**
Place in `/public` (not `src/`). Next.js App Router does not bundle files in `/public` — they are served as-is. Handles `push` and `notificationclick` events. Must be registered client-side with `navigator.serviceWorker.register('/sw.js')`.

**2. Node.js Route Handler — subscription management + dispatch**
- `POST /api/push/subscribe` — stores `PushSubscription` object to `push_subscriptions.json` in Vercel Blob
- `POST /api/push/send` — reads subscriptions from Blob, dispatches via `webpush.sendNotification()`; protected by `Authorization: Bearer $DISPATCH_SECRET` header

These must run on the **Node.js runtime, not Edge**. `web-push` uses Node crypto APIs (`crypto.createSign`, `crypto.createECDH`) that are unavailable in the Vercel Edge runtime. The existing auth routes already use Node.js runtime as default.

**3. Pipeline dispatch step**
GitHub Actions pipeline calls `POST /api/push/send` via `curl` after successful pipeline runs, passing the `DISPATCH_SECRET` env var. The Route Handler reads `pending_alerts.json` from Blob (written by the pipeline) and dispatches each alert.

### VAPID Setup

```bash
npx web-push generate-vapid-keys
```

Vercel environment variables:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — exposed to client (used in `pushManager.subscribe()`)
- `VAPID_PRIVATE_KEY` — server-only, never committed

GitHub Actions secret:
- `VAPID_PRIVATE_KEY` — same value, for pipeline-triggered dispatch
- `DISPATCH_SECRET` — random string, shared between pipeline and Route Handler

### Subscription Persistence

Single-user personal tool: store subscriptions as `push_subscriptions.json` in Vercel Blob. Shape: `{ subscriptions: PushSubscription[] }`. Read at dispatch time, write at subscribe time. No database needed.

### Browser Support

| Browser | Support |
|---------|---------|
| Chrome/Chromium | Full |
| Firefox | Full |
| Safari macOS 16+ | Supported (HTTPS required) |
| iOS Safari | Requires "Add to Home Screen" (iOS 16.4+) |

For a desktop-primary personal tool this is sufficient. iOS push is a nice-to-have.

### Service Worker Headers

Add to `next.config.ts` headers config to prevent stale SW caching:
```typescript
{
  source: '/sw.js',
  headers: [
    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
  ],
}
```

### Installation

```bash
npm install web-push@3.6.7
npm install -D @types/web-push@3.3.5
```

---

## Pipeline Scheduling (REFRESH-01)

### Current State (Already Implemented)

`pipeline.yml` already contains:
- Baseline 4x/day cron (`0 6,12,18,0 * * *`)
- Sat/Sun dense 30-min window during FPL deadline hours (`0,30 8-13 * * 6,0`)
- Fri dense 30-min window for early-kick rounds (`0,30 16-20 * * 5`)
- `refresh_gate.py` with `check_deadline_window()` that reads FPL events and gates on proximity to nearest deadline
- `PIPELINE_DEADLINE_WINDOW_MINUTES` env var controls gate window (default 90 minutes)
- Workflow-level concurrency guard to prevent Blob write races

### What REFRESH-01 Actually Needs

The v1.26 requirement is push notification dispatch, not more cron entries. The existing schedule infrastructure is sufficient. The changes needed:

1. **Widen the gate window** by setting `PIPELINE_DEADLINE_WINDOW_MINUTES=360` in the workflow env so the gate fires on dense-cron runs up to 6 hours before deadline
2. **Add a pipeline step** that calls the push dispatch Route Handler after `run.py` succeeds

```yaml
# In pipeline.yml env block:
PIPELINE_DEADLINE_WINDOW_MINUTES: '360'
DISPATCH_SECRET: ${{ secrets.DISPATCH_SECRET }}

# New step after run-pipeline:
- name: Dispatch push alerts
  if: steps.run-pipeline.outcome == 'success'
  run: |
    curl -sS -f -X POST "${{ vars.APP_URL }}/api/push/send" \
      -H "Authorization: Bearer $DISPATCH_SECRET" \
      -H "Content-Type: application/json" \
      -d '{"source":"pipeline"}'
```

### Scheduling Constraints

- GitHub Actions cron is UTC-only
- Minimum interval: 5 minutes
- Real-world delay: 5–30 minutes typical (documented)
- "6h, 2h, 30m before deadline" cannot be achieved with exact precision using GitHub cron — but ±30 minutes is acceptable for push alerts

No new pipeline scheduling infrastructure needed. No new Python dependencies.

---

## Source Reliability Scoring

### Current State

`transfer_news.py` already has:
- 5-class keyword classifier (`confirmed_signing`, `rumour`, `injury_return`, `rotation_signal`, `general`)
- Per-source isolation (`skysports`, `bbc`)
- `scraped_at` timestamp per article
- `published` field from RSS feed entries

### Implementation (No New Libraries)

**Tier assignment** — static dict, added to `transfer_news.py`:

```python
SOURCE_RELIABILITY_TIER = {
    'skysports': 'Reliable',
    'bbc':       'Reliable',
    # Future: 'thesun', 'dailymail' -> 'Tabloid'
}
```

**Confidence decay** — exponential half-life function using stdlib `math` and `datetime`:

```python
import math
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

def confidence_decay(published: str | None, half_life_hours: float = 48.0) -> float:
    if not published:
        return 0.5
    try:
        # RSS uses RFC 2822 format; parsedate_to_datetime handles it
        pub = parsedate_to_datetime(published)
        age_hours = (datetime.now(timezone.utc) - pub).total_seconds() / 3600
        return round(math.exp(-math.log(2) * age_hours / half_life_hours), 3)
    except Exception:
        return 0.5

TIER_BASE_CONFIDENCE = {'Official': 1.0, 'Reliable': 0.75, 'Tabloid': 0.45}

def article_confidence(article: dict) -> float:
    tier = article.get('reliability_tier', 'Reliable')
    base = TIER_BASE_CONFIDENCE.get(tier, 0.5)
    return round(base * confidence_decay(article.get('published')), 3)
```

**Schema addition** — add two fields to each article dict in `_scrape_rss_sky` and `_scrape_rss_bbc`:
- `reliability_tier`: `'Official' | 'Reliable' | 'Tabloid'`
- `confidence_score`: float 0.0–1.0

Both fields are additive to the existing `transfer_news.json` schema. The `/api/transfer-news` Route Handler and `useTransferNews()` hook pass data through; TypeScript types just need two new optional fields.

### Libraries Needed

None. `math`, `datetime`, `email.utils` are all Python stdlib.

---

## FPL Price Data

### Endpoint

`GET https://fantasy.premierleague.com/api/bootstrap-static/`

Already used by `fpl_client.get_bootstrap_static()`. The `elements` array contains the relevant price fields:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | int | FPL element ID (stable across seasons for existing players) |
| `now_cost` | int | Current price in tenths of a pound (130 = £13.0m) |
| `cost_change_start` | int | Change from season-start price (tenths; negative = fallen) |
| `cost_change_start_fall` | int | Magnitude of fall from season start |
| `web_name` | str | Short display name |
| `team` | int | Team ID |
| `element_type` | int | 1=GK, 2=DEF, 3=MID, 4=FWD |

**Confidence: HIGH** — these fields are in the existing pipeline and used by `price_changes.py`.

### Price Reset Implementation

New `pipeline/price_reset.py` script:

1. Reads `season_archive.json` from Vercel Blob (written by `archive_season.py` at GW38). Contains previous-season player data including `now_cost`.
2. Fetches current `bootstrap-static`. When FPL publishes next-season data, player IDs remain stable for returning players; new signings appear with new IDs.
3. Match players by `id`. Compute `price_delta = new_now_cost - archived_now_cost`.
4. Classify: rises (+), falls (-), unchanged (0). New players (no archive match) flagged separately.
5. Write `price_reset.json` to Blob.

### Gate Condition

Run only when new-season bootstrap is detected. Heuristic: compare the `season` string in bootstrap events against the archived `season`. When they differ, price reset analysis is relevant. Gate in `run.py` as `IS_PRICE_RESET_SEASON` similar to `IS_OFF_SEASON`.

### Output Schema

```python
{
  "generated_at": "<ISO>",
  "season_from": "2024/25",
  "season_to": "2025/26",
  "players": [
    {
      "element_id": 123,
      "web_name": "Salah",
      "team_id": 14,
      "element_type": 3,
      "old_price": 130,
      "new_price": 125,
      "price_delta": -5,        # tenths of pound; negative = cut
      "price_delta_display": "-0.5"  # formatted for UI
    }
  ],
  "new_players": [  # players with no archive match (new signings)
    { "element_id": 999, "web_name": "NewSigning", ... }
  ]
}
```

### Libraries Needed

None new. `fpl_client`, `upload.save()`, stdlib `json`.

---

## Auth 502 Fix

### Root Cause

Known Next.js bug tracked at `vercel/next.js#90826`. Next.js's internal `patch-fetch` attempts to clone or re-read a `Request` object body after the network stream is consumed. On Node.js >= 24.14.0 (confirmed affects Node 25), undici enforces strict stream locking — the second read throws `TypeError: expected non-null body source`.

**Confidence: HIGH** — exact error and root cause documented in open Next.js GitHub issue.

### Current Code Audit

`/api/auth/fpl-login/route.ts` already uses `fetch(url, init)` pattern (not `fetch(new Request(url, init))`), which should be safe. The 502 may stem from either:

a) The upstream FPL server returning a `redirect: 'follow'` chain where an intermediate response contains the important cookies — `redirect: 'follow'` silently discards intermediate `Set-Cookie` headers, causing the session extraction logic to fail and route to a 502 branch
b) The `await loginRes.text()` body never being consumed when `!loginRes.ok`, which can leave the stream locked and confuse subsequent operations

### Fix

Replace `redirect: 'follow'` with `redirect: 'manual'` and consume the body unconditionally:

```typescript
const loginRes = await fetch('https://users.premierleague.com/accounts/login/', {
  method: 'POST',
  headers: { /* ... */ },
  body: new URLSearchParams({ /* ... */ }).toString(),
  redirect: 'manual',  // capture redirect response WITH its Set-Cookie headers
})

// Always consume body to release the stream (prevents lock on Node 25+)
const _rawBody = await loginRes.text().catch(() => '')

// FPL returns 302 → cookies are on THIS response, not the destination
const isRedirect = loginRes.status >= 300 && loginRes.status < 400
const setCookies = loginRes.headers.getSetCookie?.() ?? []
```

The key insight: FPL's credential login responds with a 302 redirect, and the session cookies are in the `Set-Cookie` headers of the **302 response itself**, not the final destination page. `redirect: 'follow'` follows to the destination but does not expose intermediate headers. Using `redirect: 'manual'` intercepts the redirect and gives access to those cookies.

### Additional Hardening

For any Route Handler that makes outbound `fetch` calls to FPL:
- Always `await response.text()` or `await response.json()` before returning, even on error paths
- Use `fetch(url, init)` pattern (not `fetch(new Request(...))`) everywhere
- Add `export const runtime = 'nodejs'` explicitly to auth route files

### `/api/auth/login` Route

This route (token-based, no outbound fetch) should not be affected by the fetch body bug. If it is throwing 502, check whether Next.js middleware is consuming `request.body` before the Route Handler runs — middleware body consumption can cause the same stream-locked error.

### No New Dependencies

Auth fix is code changes only.

---

## Recommendations

### Install

```bash
npm install web-push@3.6.7
npm install -D @types/web-push@3.3.5
```

This is the only new npm dependency for the entire v1.26 milestone.

### What NOT to Add

| Candidate | Reason to Skip |
|-----------|---------------|
| `next-pwa` / `@ducanh2912/next-pwa` | Adds webpack/workbox complexity for a single `sw.js` file; official Next.js docs use manual approach |
| `serwist` | Full offline PWA framework; project only needs push, not offline caching |
| Firebase Admin / FCM | Adds Google dependency; VAPID is provider-free and sufficient |
| OneSignal / Pusher / Ably | Third-party push services; unnecessary for single-user personal tool |
| `nltk`, `spaCy`, `transformers` | ML overkill for source tier scoring; static dict + decay formula covers it |
| New GitHub Actions cron schedules | Existing dense cron + gate already sufficient; widen `PIPELINE_DEADLINE_WINDOW_MINUTES` |
| Any scheduling microservice / cron-as-a-service | Same — existing infrastructure covers the requirement |

### Summary Matrix

| Feature | New Dependency | Change Type |
|---------|---------------|------------|
| ALERT-01 Web Push | `web-push` npm | New library + new files |
| REFRESH-01 Pipeline scheduling | None | Config + YAML change |
| Source reliability scoring | None | Python logic addition |
| Price reset analysis | None | New Python script |
| Auth 502 fix | None | Code fix in existing route |
