# Research Summary - v1.26 Off-Season Intelligence

**Project:** FPL Analyst
**Domain:** FPL analytics web app - off-season feature set
**Researched:** 2026-05-20
**Confidence:** HIGH

---

## Stack additions

Only one new npm dependency for the entire milestone:

- **web-push@3.6.7** + **@types/web-push@3.3.5** - VAPID-based browser push dispatch; Node.js runtime only (no Edge).

All other features are code changes against the existing stack:
- Source reliability scoring: Python stdlib only (math, datetime, email.utils)
- Price reset analysis: new Python script using existing fpl_client and upload.save(); no new libraries
- Auth 502 fix: code change in one route handler - users.premierleague.com credential-login endpoint is dead (FPL migrated to OAuth 2.0 PKCE); return { ok: false, code: ENDPOINT_GONE } immediately
- Pipeline scheduling: existing dense cron + refresh_gate.py is sufficient; widen PIPELINE_DEADLINE_WINDOW_MINUTES from 90 to 360 and add a notify.py dispatch step after run.py

Do NOT add: next-pwa, serwist, Firebase/FCM, any push-as-a-service, nltk/spaCy, or new cron schedules.

---

## Feature table stakes

**Auth 502 fix (P0 - unblocks authenticated testing):**
- POST /api/auth/login must succeed without a 502 in production
- Token-paste flow preserved; no change to user-facing auth UX
- fpl-login/route.ts must return a clean ENDPOINT_GONE error so the UI falls back to manual token entry

**Transfer speculation scoring (P1):**
- Source tier badge (Official / Reliable / Speculative) displayed inline on each Summer Window article card
- confidence_score at scrape time: score = max(0, 1 - age_days/7) * TIER_MULTIPLIER - additive optional fields on existing TransferArticle type, no breaking change
- Sky Sports and BBC are both Reliable tier; Official tier reserved for direct FPL/club feeds
- Off-season decay half-life must be 21 days (not 7) to avoid false staleness during long transfer-window silences
- Do NOT produce a single transfer-probability percentage; tiered badges are the honest display

**Price reset analysis (P2):**
- Show who rose/fell vs season-end baseline once FPL publishes next-season prices (historically mid-to-late July)
- Baseline = now_cost from season_archive_gw38.json - verify archive_season.py captures all 700+ elements, not just squad players (open question 1)
- Price delta as coloured pill (green/red) in +/-X.Xm format; raw API values are integer tenths, always divide by 10
- Completeness heuristic: only surface comparison when more than 50% of players have changed now_cost vs baseline; show partial data warning below that threshold
- Seasonal feature - activate only when _pre_season_predicate is true; empty state otherwise

**Deadline Day mode (P1 - low complexity, high value):**
- Persistent countdown to next GW deadline from events[].deadline_time; displayed in the user local timezone
- Three urgency states: more than 24h (neutral zinc), 2-24h (amber), less than 2h (red/sticky banner)
- Dismissible banner above section nav; dismiss stored per-GW in localStorage - no new tab
- Do NOT confuse FPL gameweek deadlines with the football transfer window closing date

**ALERT-01 push notifications (P3 - highest complexity):**
- Four trigger types: price change (watched/owned), injury status change (owned), deadline reminders (24h and 2h), captain recommendation change
- Pipeline-triggered only - notify.py POSTs to /api/push/send; no client-side polling
- Single Enable notifications toggle; permission prompt gated behind explicit user action, never on page load
- Per-type opt-in stored in localStorage

**REFRESH-01 pre-deadline pipeline (P2):**
- Existing dense cron is sufficient; no new cron entries needed
- notify.py is a standalone post-pipeline GitHub Actions step (does NOT import from run.py)
- Pre-deadline runs skip heavy steps (Understat, Monte Carlo, batch AI); only bootstrap + transfer_news refresh

---

## Architecture highlights

**Build order:**
1. Auth fix - unblocks authenticated testing of all other features
2. Transfer speculation scoring - pipeline-only, no new infrastructure, immediate Summer Window value
3. Price reset analysis - depends on season_archive_gw38.json (available); new PriceResetTab in Analyse section
4. Deadline Day banner - pure frontend, no backend changes, uses existing bootstrap proxy
5. Web push (ALERT-01) - last; requires new VAPID infra, service worker, notify.py, and pipeline wiring

**Key integration points:**
- public/sw.js must be served from the root (not src/app/api/) to get root scope for push events
- /api/push/send must declare export const runtime = nodejs - web-push uses Node crypto APIs unavailable on Edge
- Push subscriptions: per-device individual Blob files keyed by hash of endpoint URL - never a single aggregated list (eliminates read-modify-write races)
- notify.py reads FPL bootstrap and Blob directly; never imports from run.py (mirrors refresh_gate.py isolation pattern)
- Price reset data flow: price_reset.py writes price_reset.json to Blob -> /api/price-reset route (clone of price-changes route) -> usePriceReset() hook -> PriceResetTab
- Deadline countdown: client-side only from existing bootstrap proxy; no new API route needed
- transfer_news.py enrichment is additive - source_tier and confidence_score are optional fields; existing consumers unaffected

**New env vars required (Vercel dashboard + GitHub Actions secrets):**
- NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PIPELINE_NOTIFY_SECRET, VERCEL_PRODUCTION_URL

---

## Watch Out For

**1. Service worker scope (WP-01, Risk: High)**
Place sw.js in /public/sw.js only. Register with scope / and updateViaCache: none.
A SW served from /api/sw.js gets scope /api/ and will never receive push events.
Add Cache-Control: no-cache header for /sw.js in next.config.ts.

**2. VAPID private key naming (WP-02, Risk: High)**
The private key must be VAPID_PRIVATE_KEY with no NEXT_PUBLIC_ prefix. Any NEXT_PUBLIC_ variable is inlined into the client bundle at build time. Add CI guard: grep -r NEXT_PUBLIC_VAPID_PRIVATE src/ must return empty.

**3. Price baseline capture timing (PR-01, Risk: High)**
FPL resets cost_change_start to 0 when a new season launches. The cross-season price delta depends entirely on the season_archive_gw38.json snapshot taken before FPL overwrites prices. Write must be idempotent - check for existence before writing so re-runs do not overwrite with later prices.

**4. Auth 502 - do not use redirect: manual with native fetch (AF-01/AF-02, Risk: High)**
Node.js 25 undici returns an opaque response for redirect: manual and may silently filter Set-Cookie as a forbidden header. The correct fix is to deprecate the fpl-login credential path entirely (the endpoint is dead), return ENDPOINT_GONE immediately, and always show the token-paste flow.

**5. Notification rate limiting (WP-08, Risk: Medium)**
The pipeline runs up to 4x daily. Without throttling, users receive 20+ notifications per day during busy transfer windows. Store last_notified_price.json in Blob; only notify when |delta| >= 0.2; enforce a 24h per-player cooldown; cap total notifications per pipeline run at 3.

**Bonus: FPL deadline timing is not static (PS-01/PS-02)**
Never hardcode deadline times in pipeline.yml. BGWs, DGWs, and postponements shift deadlines with little notice. The deadline proximity gate must read events[next].deadline_time from bootstrap at runtime.

---

## Open questions

1. **Does archive_season.py capture all 700+ bootstrap elements or only squad players?**
   Price reset analysis requires a full-player baseline. Highest-priority question before starting the price reset phase.

2. **iOS push in scope?** The app has no manifest.json; iOS 16.4+ requires PWA installation for push.
   Decision: add a minimal PWA manifest in v1.26, or scope iOS push as a post-v1.26 enhancement.

3. **Notification deduplication** - Does notify.py need to track which deadline reminders have already fired for a given GW? A sent_notifications.json Blob file is likely; schema needs to be decided before implementation.

4. **price_reset.py gate condition** - Confirm the exact _pre_season_predicate expression in run.py before writing price_reset.py to avoid double-triggering on FPL incremental price-batch releases.

5. **Auth: undici.request() vs redirect: follow** - Research gives two viable approaches for capturing the FPL session cookie. Inspect actual 302 behaviour in the current deployment before committing to either.

---

*Research completed: 2026-05-20*
*Ready for roadmap: yes*
