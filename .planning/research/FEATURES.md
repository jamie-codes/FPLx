# Features Research — v1.26 Off-Season Intelligence

**Domain:** FPL analytics web app — off-season intelligence features
**Researched:** 2026-05-20
**Confidence:** HIGH (FPL ecosystem well-documented; push notification patterns well-established)

---

## Feature Categories

### Transfer Speculation Scoring

**Table stakes:**
- Display source tier on each Summer Window article card as a distinct badge alongside the existing [SKY]/[BBC] source badge
- Three-tier reliability classification: Official (FPL/club/Premier League announcement) / Reliable (Sky Sports, BBC, The Athletic) / Speculative (Mirror, Sun, Express, Daily Star, TEAMtalk, TalkSport)
- Confidence decay — articles older than ~3 weeks should show lower confidence than fresh ones; a rumour from 5 days ago carries more weight than one from 25 days ago
- Speculative articles older than 30 days suppressed from default view (show via "Show older" toggle)

**Differentiators:**
- Tier is computed deterministically from the RSS source domain at scrape time — no NLP, no per-journalist lookup, just a static domain → tier map
- Confidence decay formula: `confidence = base_tier_score * exp(-age_days / half_life)` where `half_life ≈ 7 days` for Speculative/Reliable tiers; confirmed official articles do not decay (they are facts, not predictions)
- Per-player confidence aggregation: if Sky AND BBC both report the same player rumour independently, aggregate confidence is higher than one source alone (sum of individual decayed scores, capped)
- Sort Summer Window articles by `confidence_score` descending as the default; recency sort available as an option
- Watchlist integration: if a watched player has a high-confidence speculation article, surface a badge on their WatchlistPlayerCard

**Anti-features:**
- Do NOT attempt NLP source extraction from article text — too fragile; Sky Sports RSS already self-identifies via its feed URL
- Do NOT assign reliability to individual journalists — they change outlets; domain-level mapping is stable
- Do NOT produce a single "transfer probability %" number — it implies false precision that the data cannot support; tiered badges are more honest
- Do NOT hide Speculative/Tabloid articles by default — show them labelled; users want to know what's being reported even if unreliable; suppression erodes trust
- Do NOT use complex ML confidence scoring — the domain and age of an article is enough signal for off-season planning

**Complexity:** Medium overall; individual components are Low
- Domain → tier map: Low (static lookup table, ~20 entries)
- Decay calculation at scrape time: Low (pure math, add `confidence_score` field to `TransferNewsArticle` type)
- Per-player aggregation: Low (group by fuzzy-matched player name, already have `player_matching.py`)
- UI tier badge on article card: Low (extend existing `SummerWindowTab` article card)
- Watchlist integration badge: Low (add conditional badge to `WatchlistPlayerCard` if `transfer_news` data includes the player)

**Dependencies on existing features:**
- `transfer_news.py` — already scrapes Sky Sports + BBC RSS; source domain available at scrape time; add `tier` and `confidence_score` fields to output
- `player_matching.py` — fuzzy player name matching already built and in use
- `SummerWindowTab` — article cards already render [SKY]/[BBC] badges; extend with tier pill and confidence bar/score
- `WatchlistTab` + `WatchlistPlayerCard` — v1.25 feature; tier confidence badge slots naturally here
- `IS_OFF_SEASON` gate — already controls when `transfer_news.py` runs

**Source reliability tier map (HIGH confidence — football transfer community consensus, multiple sources):**
```
Official:  premierleague.com, club official sites, fplofficial
Reliable:  skysports.com, bbc.co.uk, bbc.com, theathletic.com, theguardian.com/sport (specialist correspondents noted)
Speculative: mirror.co.uk, dailymail.co.uk, express.co.uk, dailystar.co.uk, the-sun.co.uk, givemesport.com, teamtalk.com, talksport.co.uk
```

---

### Price Reset Analysis

**Table stakes:**
- When FPL publishes pre-season prices (historically mid-to-late July — 2025/26 launched 20 July 2025; 2024/25 launched 11-18 July 2024), surface who rose and who fell in price vs their season-end price
- Price delta displayed as a coloured pill: green for rise, red for fall, with the £amount
- Contextualise the change: rising price = FPL rewarding last season's output; falling price = FPL penalising poor output or transfer
- Flag "value targets": players whose price fell but who still have strong underlying performance stats (price dropped but quality held)
- Flag "risk buys": players whose price rose significantly but whose performance may not justify the new cost

**Differentiators:**
- Cross-reference price delta with existing xPts engine: a player with `price_rose AND xPts_1gw < position_median` gets a "risk: overpriced" flag; a player with `price_fell AND xPts_1gw > position_median` gets a "value target" badge — this is actionable language
- Surface in WatchlistTab: a watched player with a notable price reset shows a delta badge ("−£0.5m from last season") on their WatchlistPlayerCard without requiring the user to navigate away
- Surface in NextSeasonPlannerTab: show price-reset badges alongside planned squad players so the manager immediately sees which selections are now more/less affordable
- "Value targets" section at the top of price reset view, sorted by price-fell-but-quality-held score — the single highest-value output of this feature for pre-season planning

**Anti-features:**
- Do NOT build a separate tab for price reset analysis — surface it within NextSeasonPlannerTab and WatchlistTab; a dedicated tab adds navigation friction for what is a seasonal feature active for ~6 weeks
- Do NOT compare against mid-season prices — the comparison must be: season-end `now_cost` (from archive) vs new season start `now_cost` (from bootstrap); any other comparison is confusing
- Do NOT attempt to predict future in-season price changes from the pre-season reset — different mechanism entirely
- Do NOT show this feature year-round — it is only meaningful during the ~6-week pre-season window after FPL publishes new prices

**Complexity:** Low-Medium
- Data availability: `archive_season.py` already saves season-end player data including `now_cost`; the new season's bootstrap provides new `now_cost`; delta is subtraction
- Detection blocker: FPL does not announce a webhook when new prices go live; the pipeline must detect new-season data by comparing bootstrap season IDs or checking `events[0].id` vs archived season ID
- The `cost_change_start` FPL API field tracks delta from the *current* season start, not from last season — for cross-season comparison the app must use the season archive snapshot, not the API field (MEDIUM confidence — confirmed from fpl.readthedocs.io)
- UI additions are lightweight: delta badge component + "value targets" section in existing tabs

**Dependencies on existing features:**
- `archive_season.py` — must archive `now_cost` per player at season end (verify this is captured)
- `pre_season_active.json` — the pre-season activation flag (v1.25); price reset analysis activates in the same window
- `WatchlistTab` + `WatchlistPlayerCard` — v1.25; add price delta badge
- `NextSeasonPlannerTab` — add price-reset column/badge to the squad grid
- xPts engine data (`xPts_1gw`, position median) — already in `merged_players.json` / `MergedPlayer` type

---

### Deadline Day Mode

**Table stakes:**
- Persistent countdown timer showing time to the next FPL transfer deadline, sourced from `events[].deadline_time` in the FPL bootstrap API
- Timer displayed in the user's local browser timezone (not UTC/GMT — the FPL official app's UTC-only display is a known UX pain point in the community)
- Three urgency states with distinct visual treatment:
  - Normal (>24h): subtle zinc display in header area
  - Warning (2-24h): amber, more prominent
  - Critical (<2h): red, sticky/persistent across all tabs
- Timer does not appear during off-season when no upcoming deadline exists

**Differentiators:**
- In Critical state (<2h), auto-sort Summer Window articles by recency descending — last-minute injuries and signings are more relevant than confidence-scored articles near the deadline
- Surface watchlist player injury/doubt flags prominently during the deadline window: "2 of your watched players are DOUBTFUL. GW deadline in 90 mins." — aggregated summary, not per-player individual alerts
- Show pipeline freshness relative to deadline: "Data is 4h old. Next refresh: GW deadline −30m" — pairs with REFRESH-01 to explain when data will next update
- Countdown uses `Intl.DateTimeFormat` for locale-aware display; UTC offset shown in tooltip for power users

**Anti-features:**
- Do NOT build a standalone "Deadline Day" tab — this is a mode overlay, not a navigation destination; it enhances existing tabs contextually
- Do NOT animate aggressively or use pulsing/blinking UI — FPL deadline pressure is inherently stressful; visual noise makes it worse
- Do NOT play audio alerts — browser push notifications (ALERT-01) handle proactive alerting; the on-page countdown is ambient/informational
- Do NOT show the countdown on every single UI element — one persistent location (header or sticky banner below nav) is sufficient
- Do NOT show "Transfer Deadline Day" (football window deadline) — this feature is about FPL gameweek transfer deadlines, which are different from summer/January transfer window closing dates

**Complexity:** Low-Medium
- Countdown timer component: Low — pure client-side, reads `next_deadline_time` from bootstrap data, `setInterval` every second
- Urgency state transitions: Low — threshold comparisons on milliseconds remaining
- Sticky/global urgency banner: Medium — needs layout-level placement (portal or layout component); must not disrupt tab navigation or keyboard flow
- Deadline Day feed sort override: Low — add a `deadlineMode` boolean prop to `SummerWindowTab` that flips the sort order; derive from `hoursToDeadline < 24`
- Pipeline freshness display: Low — reuse existing `LastUpdated` component; add deadline-relative formatting

**Dependencies on existing features:**
- FPL bootstrap `events[].deadline_time` — already fetched; next deadline derivable from first future event
- `SummerWindowTab` — conditional sort override when deadline mode is active
- `WatchlistTab` — prominent injury/doubt surface during deadline window
- `LastUpdated` component — extend to show deadline-relative context
- REFRESH-01 (REFRESH-01 pre-deadline pipeline) — the "next refresh" messaging depends on REFRESH-01 being implemented

---

### ALERT-01 Push Notifications

**Table stakes:**
- Browser Web Push API with VAPID keys — no email, no Firebase, no third-party service; self-hosted via the `web-push` npm package
- Service worker at `/public/sw.js` handles `push` events and `notificationclick` deep-links
- Four notification types:
  1. Price change for owned or watched players (rise or fall by ≥£0.1m)
  2. Injury status change for owned players (status changes to 'd', 'i', or 's')
  3. Deadline reminders (24h before and 2h before GW deadline)
  4. Captain recommendation change (different player recommended vs previous pipeline run)
- Single "Enable notifications" toggle — not buried in settings, contextually prompted when user adds a player to watchlist or views the countdown
- Granular per-type opt-in: user can keep deadline reminders but disable captain changes (stored in `localStorage`)

**Differentiators:**
- Notifications triggered server-side by diffing pipeline run output vs previous run — not client-side polling; this means they fire even when the browser tab is closed
- For a single-user personal app, push subscription stored in a small Vercel Blob file (`push_subscription.json`) — no database required; same pattern as other blob-backed features
- Deep-link on notification click: price change notification opens to WatchlistTab for the affected player; injury notification opens to the affected player in GemTable/Squad; deadline notification opens to the Transfer panel
- Off-season suppression: price change notifications suppressed during off-season (in-season dynamic prices don't fluctuate off-season); deadline reminders only fire when an actual upcoming deadline exists
- Notification debounce: captain recommendation change fires at most once per pipeline run (not once per flip-flop); 24h deadline reminder fires only if 24h reminder hasn't already been sent for that GW

**Anti-features:**
- Do NOT implement email notifications — adds SMTP/SendGrid complexity and privacy surface; out of scope per brief
- Do NOT use Firebase Cloud Messaging — unnecessary Google dependency; `web-push` with VAPID is self-sufficient and provider-free (HIGH confidence — confirmed from Designly blog and npm web-push docs)
- Do NOT trigger push from the client side — all pushes originate from the server-side pipeline; client-side polling with notifications is unreliable and drains battery
- Do NOT show a browser system permission prompt on first page load — request permission only after the user has seen a value explanation (pre-permission screen); this follows best-practice UX that improves opt-in rates by up to 20%
- Do NOT suppress all notifications when the page is focused — just suppress the browser native notification toast; the in-app badge/indicator can still appear

**Complexity:** High
- VAPID key generation + service worker registration: Medium (well-documented, ~2-3 hours one-time setup)
- Subscription storage in Vercel Blob: Low (same blob read/write pattern as existing features)
- Push trigger from Python pipeline: Medium — `web-push` is a Node.js library; Python pipeline calls `POST /api/notify` Route Handler which sends the browser push; alternatively `pywebpush` Python library exists but adds a Python dependency
- Diff logic per notification type: Medium — price change needs prev/curr price comparison (price predictor already tracks this); injury status change needs prev/curr status comparison (new snapshot required); captain change needs prev/curr recommendation snapshot
- Pre-permission screen UX: Low (~30 LOC React component)
- Per-type preference storage in localStorage: Low

**Architecture recommendation:** Python pipeline → `POST /api/notify?type=price&playerIds=...` → Next.js Route Handler → `web-push.sendNotification(subscription, payload)` → browser service worker. The Route Handler reads the subscription from Vercel Blob and sends the push. This keeps push logic in TypeScript (familiar pattern) and avoids adding `pywebpush` to Python dependencies.

**Browser support (HIGH confidence):** Chrome/Edge/Firefox all support Web Push + VAPID. Safari on macOS 13+ and iOS 16.4+ (PWA installed to home screen required on iOS). For a personal tool used primarily on desktop/Chrome, iOS PWA restriction is not a material blocker.

**Vercel serverless compatibility (HIGH confidence):** `web-push` npm package works correctly in Vercel serverless Route Handlers; VAPID signing is CPU-only with no persistent process requirement.

**Dependencies on existing features:**
- `web-push` npm package (new dependency) + VAPID keys in env vars
- Service worker at `/public/sw.js` (new file)
- `POST /api/notify` Route Handler (new route)
- Vercel Blob — stores push subscription endpoint and user type preferences
- Python `pipeline/run.py` — add notify step at the end of each run
- `useWatchlist` hook — provides owned/watched player IDs for diff filtering
- Price change predictor data (v1.8) — `cost_change_event` already tracked; prev/curr diff needed
- `WatchlistPlayerCard` — show notification bell icon to surface notification opt-in contextually

---

### REFRESH-01 Pre-Deadline Pipeline

**Table stakes:**
- Additional GitHub Actions pipeline runs at approximately 6h, 2h, and 30m before each GW deadline
- Source deadline times from `events[].deadline_time` in the FPL bootstrap API — do NOT hardcode GW dates in the YAML (they change with fixture reschedules)
- Pipeline is idempotent — double-running with the same underlying data produces the same output without errors (already true by design)
- Only runs during the season; IS_OFF_SEASON gate already handles suppression

**Differentiators:**
- Dynamic deadline detection: a lightweight Python script (`check_deadline.py`) runs on a frequent cron (every 30-60 minutes), checks `time_to_next_deadline`, and writes a flag file if within threshold; the main pipeline workflow is triggered conditionally
- Fast-mode flag (`IS_PRE_DEADLINE=true`): pre-deadline runs skip heavy non-urgent steps (Understat scraping, Monte Carlo 10k sims, batch AI insights) — only FPL bootstrap + `transfer_news.py` + lineup news need refreshing pre-deadline
- Pairs with ALERT-01: the notify step fires after each pre-deadline run, surfacing last-minute changes to the user

**Anti-features:**
- Do NOT use a cron for every minute near deadline — GitHub Actions has a minimum 5-minute cron interval and queuing delays make sub-5-minute precision unreliable anyway
- Do NOT hardcode GW deadline dates in the workflow YAML — fixture reschedules and cup competitions make these dates unstable
- Do NOT run the full pipeline (including Understat scraping) at every pre-deadline interval — Understat is slow (~90s), irrelevant pre-deadline, and rate-limited; only FPL data matters in the last hours before a GW
- Do NOT run this during off-season — the existing IS_OFF_SEASON gate handles this; ensure REFRESH-01 respects it

**Complexity:** Medium
- Dynamic deadline detection script: Low (~30 LOC Python; reads bootstrap, computes timedelta, exits with code)
- Conditional workflow triggering: Medium — GitHub Actions `repository_dispatch` or `workflow_dispatch` with PAT for cross-workflow triggers is supported but requires auth token management; alternative is a single workflow with a conditional job that reads the deadline check output
- Fast-mode gate in `run.py`: Low — `IS_PRE_DEADLINE` env var gates heavy steps, mirrors IS_OFF_SEASON pattern already in place
- Idempotency: already satisfied by existing pipeline design

**Dependencies on existing features:**
- FPL bootstrap `events[].deadline_time` — primary data source for deadline timing
- `pipeline/run.py` IS_OFF_SEASON gate pattern — extend with `IS_PRE_DEADLINE` fast-mode flag
- GitHub Actions YAML — new workflow file (`pre-deadline.yml`); or extend existing `pipeline.yml` with a conditional step
- `transfer_news.py` — highest priority step to re-run pre-deadline (lineup news, late injury reports)
- ALERT-01 notify step — runs after each pre-deadline pipeline pass

---

### Auth 502 Fix

**Table stakes:**
- `POST /api/auth/login` succeeds in production (Vercel) without throwing 502
- Session-cookie flow preserved: user provides FPL session token, app makes server-side FPL API request using that cookie
- Fix does not require changing user-facing auth UX (the existing modal + guided token entry flow)
- Exact sell prices and bank balance continue to work when authenticated

**Anti-features:**
- Do NOT store FPL session cookies server-side — this is a personal tool; user provides their own cookie per session, nothing is persisted
- Do NOT introduce NextAuth or any OAuth framework — FPL session-cookie auth is bespoke, not OAuth

**Root cause analysis (MEDIUM confidence — based on Next.js 16 behaviour and the FPL auth flow):**
The FPL auth endpoint (`https://users.premierleague.com/accounts/login/`) returns a 302 redirect after successful login. The session cookie is set on the 302 response, not the final destination. A server-side `fetch()` with `redirect: 'manual'` captures the 302 and its `Set-Cookie` header before the redirect is followed. In Next.js 16 / Node 25, if `redirect: 'manual'` returns a `Response` with `type: 'opaqueredirect'`, accessing response properties (status, headers) on it may throw or return unexpected values, causing an unhandled exception in the Route Handler which Vercel surfaces as a 502.

**Fix approaches (MEDIUM confidence):**
1. Wrap `redirect: 'manual'` fetch in try/catch that explicitly handles `opaqueredirect` response type; extract `Set-Cookie` header using `response.headers.get('set-cookie')` before any other reads
2. Add `AbortController` with explicit 10s timeout to prevent 502 from Vercel function timeout
3. If `redirect: 'manual'` is fundamentally broken in the deployed runtime, fall back to `redirect: 'follow'` and extract the session cookie from the final response's headers (the cookie should still propagate if not stripped by intermediate redirects)

**Complexity:** Low — targeted fix in one Route Handler file (`/api/auth/login/route.ts`)

**Dependencies on existing features:**
- `/api/auth/login` Route Handler (existing)
- Node.js `fetch` API in Next.js 16 App Router runtime
- FPL auth endpoint at `https://users.premierleague.com/accounts/login/`

---

## Feature Priority Matrix

| Feature | User Value | Complexity | Priority | Rationale |
|---------|-----------|------------|----------|-----------|
| Auth 502 Fix | High — blocks core squad load for session users | Low | P0 | Bug fix; unblocks existing functionality; ship first in isolation |
| Transfer Speculation Scoring | High — turns raw RSS into trust-graded signal | Medium | P1 | Builds directly on existing Summer Window tab; high leverage, bounded scope |
| Deadline Day Mode | High — time-sensitive; users need it before each GW | Low-Medium | P1 | Low complexity, high value; countdown is a single client-side component |
| Price Reset Analysis | Medium-High — highly seasonal but very actionable in July | Low-Medium | P2 | Data exists in archive; UI is extension of existing tabs; seasonal activation |
| REFRESH-01 Pre-Deadline Pipeline | Medium — improves data freshness at the critical window | Medium | P2 | Operational improvement; pairs with Deadline Day mode to show "next refresh" |
| ALERT-01 Push Notifications | High — proactive signals vs reactive checking | High | P3 | Most complex; service worker + VAPID + Python pipeline changes; depends on watchlist (v1.25) |

---

## UX Patterns

### How the FPL Off-Season Tool Ecosystem Handles These Features

**Transfer news tiering (from Fantasy Football Scout, the community standard):**
FFS's approach is binary: confirmed signings on the main page, rumours on a separate sister site. No explicit source tier labels are shown. This is the minimum users expect. The differentiator for this app is surfacing the tier *inline* on each article so users don't need to navigate away to judge reliability. The FPL community broadly uses a 4-tier journalist/outlet trust system (Tier 1: Ornstein/Stone; Tier 2: Telegraph/Sky Sports specialist; Tier 3: Guardian/ESPN generic; Tier 4: tabloids), but for an automated tool, domain-level classification (Official/Reliable/Speculative) is the right granularity.

**Price change alerts (from Fantasy Football Fix, LiveFPL, FPL Dashboard):**
All major FPL tools offer price change tracking. Fantasy Football Fix's app has push notifications for price changes for tracked players — this is the established UX expectation. The differentiator here is that notifications fire for *owned* players (from squad) AND *watched* players (from watchlist), not just a generic "all players" tracker.

**Countdown timers:**
Dedicated FPL countdown apps exist (e.g. fpl-countdown-clock.lovable.app). The UX convention is clear: show DD:HH:MM:SS format, display in user's local time, use urgency color progression. The novel element in this app is integrating the countdown into the app's own header (not a separate site) and coupling it to data freshness context.

### Push Notification Permission UX (from web.dev, Pushwoosh, UX research)

The key finding is that asking for push permission on page load yields very low opt-in rates. The high-performance pattern for sports apps:
1. User performs an action that clearly benefits from notifications (adds to watchlist, views countdown showing 2h to deadline)
2. An inline non-blocking prompt appears: "Get notified when [player name]'s price changes?" or "Get deadline reminders?" — explains the value before the system prompt
3. Only on affirmative → browser system permission prompt fires
4. "Don't ask again" stored in `localStorage` to avoid repeated pestering
5. iOS requires the app to be installed as a PWA (home screen) for push to work — show a one-time install banner for iOS users

Single-notification-type prompts tied to user context (adding to watchlist → price alert prompt) outperform generic "enable notifications" settings pages.

### Notification Content Patterns

Based on sports app conventions and FPL community norms, short and actionable beats long and descriptive:
- Price rise: "Salah has risen to £13.1m. You own him." (not: "Alexander-Arnold's price has increased by £0.1 million...")
- Injury: "Haaland is DOUBTFUL (knock). Deadline in 18h." (status label + urgency context)
- Deadline: "GW36 deadline in 2 hours. 2 owned players have injury doubts." (aggregated — one notification, not N)
- Captain change: "Captain pick changed: Salah → Haaland (fixture swing). GW36." (one per GW max)

### Deadline Day Color Progression

Based on UX research and FPL community tool patterns:
- >24h: zinc/neutral — informational, not alarming; shows in corner/header
- 2-24h: amber — elevated but not urgent; more prominent positioning
- <2h: red — critical; sticky banner or persistent header treatment
- <30min: deep red + "DEADLINE IMMINENT" copy — last chance to act
- At deadline: timer stops or shows "DEADLINE PASSED — GW live"

This mirrors e-commerce "sale ends in" countdown UX, which is the closest analogue with well-studied user behaviour.

---

## Sources

- [Fantasy Football Scout — Confirmed Summer Signings](https://www.fantasyfootballscout.co.uk/fpl-2025-26-transfer-news-confirmed-summer-signings) — FFS binary confirmed/rumour model; HIGH confidence
- [Premier League — 2025/26 Price Reveals](https://www.premierleague.com/en/news/4362323/price-reveals-for-202526-fantasy) — pre-season price timing and format; HIGH confidence (official PL)
- [The False 9 — Transfer Source Reliability Guide](https://thefalse9.com/2020/08/football-transfer-sources-rumours-website-reliability.html) — 5-tier journalist/outlet system; MEDIUM confidence (2020 article, core tiers stable)
- [FPL Player docs — fpl.readthedocs.io](https://fpl.readthedocs.io/en/latest/classes/player.html) — `now_cost`, `cost_change_start`, `cost_change_start_fall` fields confirmed; HIGH confidence
- [Designly Blog — Next.js web-push provider-free](https://blog.designly.biz/push-notifications-in-next-js-with-web-push-a-provider-free-solution) — VAPID + web-push + Next.js implementation pattern; HIGH confidence
- [web.dev — Push Notifications Permissions UX](https://web.dev/articles/push-notifications-permissions-ux) — pre-permission screen pattern; HIGH confidence (Google developer docs)
- [Pushwoosh — Increase push notification opt-in rate](https://www.pushwoosh.com/blog/increase-push-notifications-opt-in/) — opt-in UX patterns; MEDIUM confidence
- [Fantasy Football Fix App Store](https://apps.apple.com/gb/app/fantasy-football-fix-for-fpl/id1051805085) — price change push notification for tracked players confirmed; HIGH confidence (competitor evidence)
- [LiveFPL Prices](https://www.livefpl.net/prices) — price change tracking + watchlist pattern; HIGH confidence (competitor)
- [FPL Countdown Clock](https://fpl-countdown-clock.lovable.app/) — standalone countdown app; HIGH confidence (competitor)
- [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — browser support confirmation; HIGH confidence
- [npm web-push](https://www.npmjs.com/package/web-push) — VAPID key generation, Vercel serverless compatibility; HIGH confidence
- [GitHub Actions cron scheduling guide](https://oneuptime.com/blog/post/2025-12-20-scheduled-workflows-cron-github-actions/view) — 5-minute minimum interval confirmed; HIGH confidence
