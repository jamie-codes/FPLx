# Pitfalls Research — v1.26 Off-Season Intelligence

**Milestone:** v1.26 Off-Season Intelligence (adding ALERT-01 push notifications, REFRESH-01 pre-deadline scheduling, transfer speculation scoring, price reset analysis, and auth 502 fix to existing FPL Analyst)
**Researched:** 2026-05-20
**Scope:** Integration pitfalls specific to this stack: Next.js 16 / Vercel serverless / GitHub Actions / Vercel Blob / Python pipeline. No database. Single user.
**Confidence:** HIGH for areas verified against official docs and known issues; MEDIUM for FPL API behaviour (undocumented); LOW where only community reports available.

---

## How to read each pitfall

Each entry has: **Risk** (High / Medium / Low), **What goes wrong** (description + why this stack is vulnerable), **Prevention** (concrete code guard), **Phase** (which v1.26 phase owns the fix).

---

## Web Push Pitfalls

### WP-01: Service worker scope mismatch blocks push reception entirely (Risk: High)

**What goes wrong:** The service worker file must be served from `/public/sw.js` to get root scope (`/`). If it is placed anywhere else — or served through a Next.js API route without a `Service-Worker-Allowed: /` response header — the browser limits its scope to the path prefix it was loaded from. A service worker at `/api/sw.js` gets scope `/api/`, meaning it will never intercept push events directed at the root origin. The notification simply never arrives; no error is thrown at registration time on modern Chrome.

This stack is vulnerable because Next.js app-router serves files from `src/app/api/` for route handlers and has no native mechanism to serve a `.js` file with arbitrary response headers except through a route handler — which puts you back in the `/api/` scope problem.

**Prevention:**
- Place `sw.js` in `/public/sw.js` (served as a static asset at `/sw.js`).
- Register with explicit scope: `navigator.serviceWorker.register('/sw.js', { scope: '/' })`.
- The `updateViaCache: 'none'` option is mandatory — without it, the browser may serve a stale SW from HTTP cache indefinitely after deployments.
- Do not attempt to serve the service worker through a Route Handler. The scope limitation is not configurable without a server-level `Service-Worker-Allowed` header, which Vercel does not support on serverless responses.

**Phase:** ALERT-01 (service worker setup is the first step before any push subscription code).

---

### WP-02: VAPID private key exposure via environment variable leakage (Risk: High)

**What goes wrong:** VAPID requires two env vars — `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (intentionally client-visible) and `VAPID_PRIVATE_KEY` (must be server-only). The `NEXT_PUBLIC_` prefix convention in Next.js causes any env var with that prefix to be inlined into the client bundle at build time. A developer copying the VAPID generation snippet that names both keys `NEXT_PUBLIC_*` will expose the private key in the JS bundle, permanently compromising all subscriptions signed by that key.

**Prevention:**
- Name the private key `VAPID_PRIVATE_KEY` (no `NEXT_PUBLIC_` prefix). It is only used in the server-side push sender Route Handler.
- Name the public key `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. It is needed in the client service worker for `pushManager.subscribe({ applicationServerKey: ... })`.
- Add a CI check: `grep -r "NEXT_PUBLIC_VAPID_PRIVATE" src/` must return empty. A one-character naming error is catastrophic.
- Generate keys once via `web-push generate-vapid-keys`, store in Vercel environment variables, never regenerate (changing the key invalidates all existing subscriptions).

**Phase:** ALERT-01.

---

### WP-03: iOS/Safari push only works from installed PWA — not browser tab (Risk: High)

**What goes wrong:** Apple requires Web Push to be triggered only when the app is installed as a PWA (Add to Home Screen). When the user opens the site in Safari directly — the most common mode for a personal web tool like this one — `window.Notification` is defined but `navigator.serviceWorker` is not available, and `PushManager` is undefined. Calling `pushManager.subscribe()` throws immediately.

Additionally, on iOS 16.4+, the permission prompt **must** be triggered by a direct user gesture (a button tap). Calling `requestPermission()` from a `useEffect`, `setTimeout`, or on page load is silently rejected — no prompt appears, no error is thrown, `Notification.permission` remains `'default'`.

The existing app has no manifest.json or PWA metadata, meaning iOS push is blocked until a full PWA setup is complete.

**Prevention:**
- Gate the push opt-in UI behind a feature-detection check: `'PushManager' in window && 'serviceWorker' in navigator`. Show a "Push not available in this browser — install the app for alerts" fallback on iOS Safari tab.
- Add a `manifest.json` to `/public/` with `display: "standalone"` — this is required before any iOS push testing is possible.
- Call `Notification.requestPermission()` only from an explicit button click handler, never from lifecycle hooks.
- Scope iOS as explicitly "install-only" in the feature spec and do not block the release on iOS push working in-browser.
- Test matrix: Chrome desktop, Firefox desktop, Chrome Android, Safari iOS (installed PWA). Safari iOS (browser tab) is explicitly a non-target.

**Phase:** ALERT-01. The manifest.json and feature-detection gate must be in place before the opt-in UI is designed.

---

### WP-04: Subscription storage in Vercel Blob — concurrent read-modify-write corrupts the list (Risk: High)

**What goes wrong:** This app has no database. The natural choice for persisting push subscriptions is Vercel Blob (already used for pipeline cache). The pattern `read subscriptions.json → append → write back` is a classic read-modify-write race condition: if two browser sessions subscribe simultaneously, both read the same old list, both append their own subscription, and the later write silently overwrites the earlier one — losing a subscription permanently. In a single-user personal tool this is rare, but it happens when the user has push enabled on their phone and their laptop.

Additionally, Vercel Blob is an object store, not a key-value store with atomic update semantics. There is no equivalent of a database transaction or compare-and-swap.

**Prevention:**
- Since this is a single-user personal tool, the subscription list will rarely exceed 2-3 entries (phone, laptop, possibly tablet). Use a simpler pattern: each device writes its subscription to a unique Blob path keyed by a stable device identifier derived from the subscription's `endpoint` URL (e.g., `push_subscriptions/{sha256(endpoint).slice(0,16)}.json`). Never maintain a single aggregated list file.
- The sender Route Handler lists blobs with `list({ prefix: 'push_subscriptions/' })` and sends to all. No read-modify-write needed.
- On subscription expiry (410 response from push service), delete the individual blob file.
- This pattern eliminates the race condition entirely at the cost of a Blob list() call on every send. With 1-3 subscriptions, this is negligible.

**Phase:** ALERT-01.

---

### WP-05: Stale/expired subscriptions cause silent send failures (Risk: Medium)

**What goes wrong:** Browser push subscriptions expire or become invalid when: the user clears browser data, the browser is uninstalled, the VAPID keys change, or the push service rotates the endpoint. When you attempt to send to a stale subscription, the push service returns HTTP 410 Gone (subscription no longer valid) or HTTP 404. The `web-push` library throws an error with `statusCode: 410`.

If the sender swallows this error or only logs it, the dead subscription accumulates in Blob storage and clutters the list. On a personal tool that users might stop using over the summer and resume in August, this is likely.

**Prevention:**
- In the push sender Route Handler, catch the error from `webpush.sendNotification()` and check `err.statusCode`.
- On 410 or 404: delete the corresponding Blob file immediately and log `[push] subscription ${endpoint_fragment} expired — deleted`.
- On 429 (rate limit from push service): back off and do not retry in the same function invocation. Log and surface as a monitoring signal.
- Add the `pushsubscriptionchange` event listener in the service worker to handle browser-initiated subscription renewal: re-register and POST the new subscription to `/api/push/subscribe`.

**Phase:** ALERT-01.

---

### WP-06: Vercel Hobby plan serverless timeout with notification fan-out (Risk: Medium)

**What goes wrong:** The push sender runs as a Vercel serverless function (Node.js Route Handler). Sending to each subscription is a sequential network call to an external push service (FCM, APNs, Mozilla). With 3 subscriptions × ~200ms per call = 600ms — fine. But if the sender is also triggered by the pipeline (GitHub Actions webhook), cold start latency of 100-2000ms can push total execution time over the Hobby plan's 10-second default timeout. The Pro plan extends this to 60 seconds, but the default timeout trap is a common deployment surprise.

**Prevention:**
- Add `export const maxDuration = 30;` to the push sender Route Handler (Pro plan required for >10s; document this as a Pro-plan dependency).
- Use `Promise.allSettled()` to fan out to multiple subscriptions in parallel rather than sequential `await` in a loop.
- Keep the push sender lean: no Python subprocess calls, no Blob reads beyond the subscription list, no FPL API calls inside the sender. Pre-compute the notification payload in the pipeline or in a separate Route Handler call.

**Phase:** ALERT-01.

---

### WP-07: Notification permission UX — asking too early causes permanent deny (Risk: Medium)

**What goes wrong:** Browser permission models are sticky. If the user dismisses or denies the notification permission prompt, re-requesting it does nothing — `Notification.requestPermission()` returns `'denied'` immediately. On Chrome, a denied permission can only be re-enabled through browser settings (three-click sequence most users never find). Once denied, the push feature is effectively dead for that user permanently.

**Prevention:**
- Never call `requestPermission()` on page load or from any automatic trigger.
- Build a two-step opt-in: (1) show a custom in-app prompt explaining the value ("Get notified when your watchlist player has a price change"); (2) only call the browser API when the user clicks "Enable". This is called a "permission request gating pattern."
- After permission is denied, show a persistent contextual message: "Push notifications are disabled — re-enable in browser settings" with a link to instructions.
- Store the user's permission preference in localStorage so the opt-in prompt is not shown repeatedly.

**Phase:** ALERT-01.

---

### WP-08: Notification rate limiting / spam — no throttle on price change alerts (Risk: Medium)

**What goes wrong:** The pipeline runs up to 4× daily. If price change notifications are sent on every pipeline run where any price moved, the user will receive up to 4 notifications per day for every player with active price movement. During busy transfer windows (late July–early August when FPL updates prices before season launch), this can mean 20+ notifications per day — the user turns off push and never re-enables it.

**Prevention:**
- Persist a `last_notified_price.json` in Vercel Blob that records `{element_id: last_notified_price}`.
- Only send a notification when `abs(current_price - last_notified_price) >= 0.2` (two price steps), or when a player moves from "no price change" to "rising/falling confirmed".
- Add a minimum cooldown per-player: never notify for the same player twice within 24 hours.
- Limit total notifications per pipeline run to 3 (cap by significance score — biggest changes first).

**Phase:** ALERT-01.

---

## Pipeline Scheduling Pitfalls

### PS-01: GitHub Actions cron has no guaranteed timing — 10-30 minute drift is normal (Risk: High)

**What goes wrong:** GitHub cron schedules are UTC-only and silently delay by 10-30 minutes during peak runner availability. GitHub's documentation states explicitly that scheduled workflows are not guaranteed to run at exact times. This makes "REFRESH-01: run at 2h before GW deadline" unreliable as an absolute time target — if the deadline is 11:30 GMT and the cron fires at 11:02 instead of 09:30, the pre-deadline pipeline window is missed entirely.

Additionally, the minimum cron interval is 5 minutes, but GitHub recommends public repos use no shorter than 15-minute intervals. GitHub will silently fail to run workflows on repos that are inactive for 60 days.

**Prevention:**
- Do not rely on absolute cron timing for deadline-proximate runs. Instead: add a `deadline_proximity` gate in the Python pipeline itself. At the start of `run.py`, compute `minutes_until_deadline = (next_deadline - now).total_seconds() / 60`. Run the full pipeline only if `minutes_until_deadline < REFRESH_THRESHOLD` (e.g., 360 = 6h). This makes any run within the correct window execute the refresh, regardless of which cron schedule triggered it.
- Run the pre-deadline cron every 30 minutes (`*/30 * * * *`) rather than trying to hit exact offsets. The gate logic handles the "is this close enough to deadline?" check.
- Store `last_pre_deadline_run` timestamp in Blob to prevent double-execution if two cron instances overlap.
- Do not use GitHub Actions cron for anything requiring sub-5-minute precision.

**Phase:** REFRESH-01.

---

### PS-02: FPL deadline times are not static — BGW/postponements shift them unpredictably (Risk: High)

**What goes wrong:** FPL GW deadlines are not at a fixed day/time each week. Standard deadlines are typically Saturday 11:30 GMT, but Blank Gameweeks (BGW), Double Gameweeks (DGW), cup ties, and postponed matches cause FPL to adjust deadlines — sometimes with only 48-72 hours notice. A hardcoded cron offset relative to an assumed deadline time will fire at the wrong relative position for irregular gameweeks.

The existing project already handles `IS_OFF_SEASON` and BGW/DGW in transfer scoring. But the pre-deadline pipeline cron schedule in `pipeline.yml` is currently a fixed set of times — it does not know about deadline shifts.

**Prevention:**
- At pipeline startup, fetch `bootstrap-static` and read `events[current_or_next].deadline_time` (ISO 8601 timestamp). Compute how many minutes remain. Use that as the `minutes_until_deadline` gate described in PS-01.
- Never hardcode deadline times in `pipeline.yml` cron expressions. The cron schedule is just a "try running me at these intervals"; the pipeline gate is the actual timing logic.
- Add a `next_deadline` field to `pipeline_meta.json` written to Blob at the end of each run. The UI can display a countdown using this without a separate FPL API call.
- Handle the case where `deadline_time` is in the past (missed deadline): the gate should be `minutes_since_deadline < 60` for post-deadline runs (to capture match-started data), not just pre-deadline.

**Phase:** REFRESH-01.

---

### PS-03: Off-season cron runs waste Actions minutes when there are no deadlines (Risk: Medium)

**What goes wrong:** With REFRESH-01 adding extra cron runs (e.g., every 30 minutes around deadlines), the pipeline.yml schedule grows. Off-season (typically June through early August), there are no GW deadlines and no meaningful FPL data to refresh. But the cron schedule still fires, and each run costs ~2-3 GitHub Actions minutes even if it exits immediately. On the free tier (2,000 minutes/month), a 30-minute interval schedule burns ~1,440 minutes/month — 72% of the free quota — even if the pipeline does nothing.

**Prevention:**
- Add an early-exit guard at the top of `run.py` for off-season cron runs: if `IS_OFF_SEASON` and `minutes_until_deadline` is undefined (no upcoming deadline), write a brief log and exit 0 within 5 seconds.
- Use GitHub Actions `if:` conditions on step groups to skip expensive steps (Understat scraping, MC simulation) when not needed.
- Consider reducing the dense pre-deadline cron schedule to active only during the season (September–May) via a date-range conditional in the workflow.
- The existing `IS_OFF_SEASON` gate in `run.py` (which wraps 12 GW-dependent steps) is already a good model. Extend it to also skip the cron-expensive operations.

**Phase:** REFRESH-01. The gate logic must be specified before the cron schedule is designed.

---

### PS-04: Rate limiting from FPL API on more frequent pipeline requests (Risk: Medium)

**What goes wrong:** The FPL API is undocumented and rate-limited by IP. The existing daily pipeline runs fine because GitHub Actions Azure datacenter IPs are not individually rate-limited at once-daily frequency. At 30-minute intervals, the pipeline fetches `bootstrap-static` + `fixtures` + `element-summary` for all players = ~100-600 HTTP requests per run. At 48 runs/day, this could trigger FPL's IP-level throttling — returning 429 or 503 responses.

The existing pipeline uses `requests` with no retry logic for FPL API calls. A 429 at the start of the pipeline will silently produce a stale `merged_players.json` or crash entirely depending on which step fails.

**Prevention:**
- REFRESH-01's pre-deadline runs should **not** re-run the full pipeline. They should only run the "light" steps: fetch bootstrap, check deadlines, maybe update `transfer_news.py`. Full merge/Understat/MC runs remain on the existing daily schedule.
- Add `retry` with exponential backoff to all FPL API calls in `run.py`: catch 429/503, wait `min(2^attempt * 5, 60)` seconds, retry up to 3 times.
- Add `time.sleep(0.5)` between element-summary requests (already needed for Understat; apply consistently to FPL API calls too).
- The `TRANSFER_NEWS_ENABLED` gate pattern (already in `run.py`) is a good model: only run expensive steps when they're needed. Apply the same gating to pre-deadline runs.

**Phase:** REFRESH-01.

---

## Source Scoring Pitfalls

### SS-01: Source tier conflation — same domain publishes both reliable and tabloid content (Risk: High)

**What goes wrong:** The existing `transfer_news.py` classifies articles by source domain into reliability tiers (Official / Reliable / Tabloid). However, the same domain can publish both types of content: Sky Sports runs both "Confirmed: club signs player" (official/reliable) and "EXCLUSIVE: sources say player wants move" (tabloid speculation). Using a fixed source-tier mapping per domain assigns the same confidence to all articles from that domain regardless of article type.

Additionally, BBC Sport and Sky Sports have different sub-brands (Sky Sports News, Sky Sports Football, etc.) sharing the same RSS domain. An article from `skysports.com/football/transfer` has a different signal weight than one from `skysports.com/football/news`.

**Prevention:**
- Source tier is a prior; article-level signals should override it. The confidence score formula should be: `confidence = source_prior_weight × article_signal_multiplier`.
- Article signals: presence of "confirmed", "signs", "official", "announced" → multiply confidence up; presence of "could", "might", "interested in", "linked", "considering" → multiply down; presence of tabloid intensifiers ("SHOCK", "EXCLUSIVE", "sensational") → multiply down further.
- The 5-class classifier already in `transfer_news.py` (`Confirmed / Likely / Possible / Rumour / Noise`) is the right axis for confidence scoring — use class as the primary signal, source tier as a secondary prior.
- Test: run the classifier against a fixture set of 20 real articles including known tabloid speculation (The Sun, Daily Star) and known official confirmations (club announcements). Assert class assignments match ground truth.

**Phase:** Transfer speculation scoring phase. The classifier test corpus is the key deliverable.

---

### SS-02: Confidence decay too aggressive during off-season long silences (Risk: Medium)

**What goes wrong:** Time-based confidence decay is correct in-season (a 3-week-old transfer rumour is stale). In the off-season, however, the transfer window can have legitimate silences of 2-4 weeks between credible reports. If the decay function halves confidence every 7 days, a reliable article from 3 weeks ago scores near-zero even though no contradicting news has emerged.

A separate problem: the decay clock should reset when a corroborating source picks up the same story. If Sky Sports reports "Player X to Club Y" on June 1, and BBC picks it up on June 15, the June 15 article should re-anchor the confidence — not be treated as a new independent signal.

**Prevention:**
- Use a slower decay curve in off-season mode: half-life of 21 days rather than 7 days when `IS_OFF_SEASON` is true.
- Implement story deduplication: group articles by `(player_name, destination_club)` using the existing `rapidfuzz` fuzzy-match utility (already in `player_matching.py`). When two articles match the same story, use the **most recent** publication date as the anchor, not the original.
- The confidence score surfaced to the UI should include both the raw score and the `age_days` so the user can judge staleness themselves.
- Never decay a "Confirmed" article — once a transfer is confirmed, the fact doesn't decay regardless of time.

**Phase:** Transfer speculation scoring phase.

---

### SS-03: False positives from tabloid hyperbolic language in non-transfer contexts (Risk: Medium)

**What goes wrong:** The 5-class keyword classifier in `transfer_news.py` currently uses keyword matching. Sports tabloids routinely use transfer-sounding language in non-transfer contexts: "United WANT Bellingham" in a match preview, "Arsenal KEEN on winning the title", "Liverpool LINKED to Champions League glory". These fire transfer keywords but describe no actual transfer.

The `player_matching.py` rapidfuzz gate (threshold ≥85) helps filter out non-player mentions, but fuzzy matching on short player name fragments is error-prone: "Wood" matches both Chris Wood (player) and Harry Wood (no one). The existing `token_sort_ratio ≥85` threshold is reasonable but not perfect for two-word names.

**Prevention:**
- Add a negative context filter: require that a transfer-class article also contains a destination club name within 50 tokens of the player name. Pure "wants" or "keen" language without a club destination is noise.
- Raise the fuzzy match threshold to ≥88 for short names (≤8 characters) to reduce false entity matches. Keep ≥85 for full names (>12 characters).
- Add a `min_article_length` filter: articles under 100 words are typically breaking news bullets or metadata stubs — exclude them from classification.
- Monitor the false positive rate by sampling 20 classified articles per week and manually verifying. Target: <10% false positive rate on Confirmed/Likely classes.

**Phase:** Transfer speculation scoring phase.

---

### SS-04: Player name matching fails on new signings not yet in FPL bootstrap (Risk: Low)

**What goes wrong:** `player_matching.py` matches article player names against the FPL player pool from `bootstrap-static`. Pre-season, players who have signed for a PL club but are not yet in FPL's bootstrap (because FPL hasn't published next-season data) will fail to match. This means early pre-season signing articles get discarded or classified as noise.

**Prevention:**
- Maintain a secondary lookup `known_transfers.json` in Blob that records confirmed signings from previous articles — even before they appear in FPL bootstrap. When an article mentions a player not in FPL, check this secondary list before discarding.
- Accept unmatched player articles as `class=Confirmed`, `player=None`, `raw_name=article_name` — surface them in the Summer Window tab with a "Not yet in FPL" badge rather than dropping them.
- This is a low-risk item because the FPL data gap is typically 2-4 weeks in July; the Summer Window tracker already shows articles without strict player matching.

**Phase:** Transfer speculation scoring phase (minor extension to existing scraper).

---

## Price Reset Pitfalls

### PR-01: FPL does not publish historical prices — baseline snapshot must be captured at the right moment (Risk: High)

**What goes wrong:** The FPL API `bootstrap-static` response includes `now_cost` (current price) and `cost_change_start` (change since season start). When a new season begins, `cost_change_start` resets to 0 for all players and `now_cost` reflects the new season's starting prices. There is no API endpoint for "what was this player's price last season" or "what was this player's price when last season ended."

If the baseline snapshot is not captured **before** FPL transitions to the new season (typically the moment GW1 of the new season goes live), the price comparison is impossible — the old prices are gone from the API.

The `archive_season.py` (already shipped in v1.24) captures a GW38 archive, but it stores player data for last-season squad analysis, not a comprehensive price baseline for all 700+ players.

**Prevention:**
- In the pipeline's off-season path, write a dedicated `price_baseline.json` blob at the **first off-season run** after GW38 completes. This captures `{element_id: now_cost}` for all elements in `bootstrap-static` — the end-of-season prices.
- The write must be idempotent: check if `price_baseline.json` already exists; if so, do not overwrite (to preserve the GW38 snapshot, not a June or July snapshot after prices may have moved).
- When next-season prices land in bootstrap (detected by AUTO-01 / NEXT_SEASON_DATA_AVAILABLE gate), compute `{element_id: (new_price, old_price, delta)}` and write `price_reset_analysis.json`.
- If `price_baseline.json` does not exist when next-season prices land (pipeline was inactive at GW38), surface a "Price comparison unavailable — season baseline not captured" warning instead of showing incorrect deltas.

**Phase:** Price reset analysis phase. The snapshot capture must be in the pipeline *before* next-season data lands, so it should be added to the v1.26 pipeline work as an early step.

---

### PR-02: Pre-season price announcement timing is unpredictable — analysis fires prematurely (Risk: High)

**What goes wrong:** FPL typically releases player prices in batches over several weeks in July (historically: first batch mid-July, full set ~1 week before game launch). Each batch updates `now_cost` for a subset of players. If the price reset analysis runs after the first batch, it will show changes only for that batch — not the full picture. A user might act on "Saka price fell from 10.5 to 10.0" when only forward prices have been published and the comparison is incomplete.

**Prevention:**
- Add a `price_release_completeness` heuristic: only surface the price reset analysis when `len(elements with new now_cost != baseline now_cost) / total_elements > 0.5`. If fewer than half the players have changed, show "Prices not fully released yet — showing partial data (X/700 players updated)".
- Track `price_publish_date` in `price_reset_analysis.json` and display it prominently in the UI.
- Do not trigger push notifications for price reset changes until completeness > 0.8 (80% of players updated), to avoid alert fatigue for partial data.

**Phase:** Price reset analysis phase.

---

### PR-03: Players who left or joined the PL have no comparable price (Risk: Medium)

**What goes wrong:** Players who left Premier League clubs (transferred abroad, retired, or relegated from PL) will appear in the GW38 baseline but not in the new-season bootstrap. Players who newly joined PL clubs (promoted teams, new signings) will appear in the new-season bootstrap with no baseline entry. Attempting to compute a price delta for either case will produce `undefined` or `null` in the comparison.

**Prevention:**
- New-season players with no baseline: show as "New to FPL — no price comparison available".
- Baseline players not in new season: mark as `status: 'departed'` in the analysis output; do not include them in any "biggest fallers" ranking.
- Test: construct a fixture with 3 "new" players and 2 "departed" players; assert the comparison component handles both edge cases without crashing or showing incorrect deltas.

**Phase:** Price reset analysis phase.

---

### PR-04: FPL cost fields use integer tenths of millions (Risk: Low)

**What goes wrong:** FPL stores prices as integers: `now_cost: 95 = £9.5m`. If the delta computation uses naive subtraction without scaling, display will show "£0" for a one-step change (95 - 94 = 1 → displayed as £1 instead of £0.1m). This is a cosmetic bug but makes the entire feature look broken.

**Prevention:**
- All price display must divide by 10: `displayPrice = (now_cost / 10).toFixed(1) + 'm'`.
- The existing codebase already has this pattern (search `now_cost` in `GemTable` column definitions) — follow the same convention.
- Delta display: `(new_cost - old_cost) / 10`, formatted as `+£0.5m` or `-£0.5m` with sign.

**Phase:** Price reset analysis phase.

---

## Auth Fix Pitfalls

### AF-01: `redirect: 'manual'` with undici returns opaque response — body is unreadable (Risk: High)

**What goes wrong:** The POST `/api/auth/login` 502 bug was diagnosed as a `redirect: manual` issue in Node.js's native fetch (backed by undici). The FPL login endpoint returns an HTTP 302 redirect after successful authentication. The intent of `redirect: 'manual'` was to capture the `Set-Cookie` header from that 302 response before the redirect is followed.

The problem: in undici (the Node.js 18+ fetch implementation), `redirect: 'manual'` historically returned an opaque response with no readable body, no status code, and no headers accessible. Undici issue #1193 documents this behaviour; it was partially fixed but behaviour varies across undici/Node.js versions.

In Node.js 25 (current environment), undici has been updated to return the actual response headers when `redirect: 'manual'` is used, but the response `body` stream may still be locked or unavailable for an opaque-redirect typed response. Attempting to call `response.json()` or `response.text()` on the opaque redirect response throws `TypeError: body used already` or returns an empty body.

**Prevention:**
- Do not use `redirect: 'manual'` with `fetch()`. Instead, use `redirect: 'follow'` (the default) and intercept cookies from the final response's `Set-Cookie` header. If the redirect destination does not re-send the cookies, use a cookie jar approach.
- Alternative: use the `undici` library directly (not the global `fetch`) with its `RedirectHandler` which provides access to intermediate response headers. This is more verbose but explicit.
- Alternative: use `node-fetch` v2 (CommonJS, not ESM) which has stable `redirect: 'manual'` support and accessible response headers for 302 responses. However, node-fetch v3 is ESM-only and the v2 cookie behaviour differs.
- Most reliable for this use case: make the FPL login request with `redirect: 'follow'`, then check the final URL and response headers for `set-cookie`. Extract the `pl_profile` cookie from the cookie string.
- Test: mock the FPL login endpoint to return a 302 with a `Set-Cookie` header; assert the Route Handler successfully extracts the cookie value.

**Phase:** Auth fix phase.

---

### AF-02: Node.js 25 native fetch drops `Set-Cookie` headers as a "forbidden header" (Risk: High)

**What goes wrong:** The WHATWG Fetch specification classifies `Set-Cookie` as a "forbidden response header name" in certain contexts. Undici (Node.js native fetch backend) has historically filtered `Set-Cookie` from response headers in some scenarios, even on server-side code where there is no browser security model reason to do so.

GitHub issue nodejs/node#52163 documents this: "document differences between Node.js fetch() implementations and the standard." The `set-cookie` header may be present in the raw HTTP response but absent from the `Response.headers` object returned by `fetch()`.

The FPL login flow relies entirely on capturing the `pl_profile` session cookie from the 302 redirect response. If `Set-Cookie` is silently dropped, the login appears to succeed (HTTP 200 or 302) but `response.headers.get('set-cookie')` returns `null`.

**Prevention:**
- Switch to `undici.request()` (the lower-level undici API, not the WHATWG-compatible `fetch`) which does not apply the forbidden-header filtering. `undici.request()` returns raw headers including all `Set-Cookie` entries.
- Or use the `fetch-cookie` npm package wrapping undici, which specifically handles cookie jar management and the forbidden-header workaround.
- In the Route Handler, add explicit logging of **all** response headers on a failed login attempt: `console.log('[auth] response headers:', Object.fromEntries(response.headers.entries()))`. This makes future debugging immediate instead of requiring a local repro.
- Test: assert that a `set-cookie` header present in a mocked FPL response is accessible in the Route Handler's response processing. If this test fails, the forbidden-header filter is active and the API must switch to `undici.request()`.

**Phase:** Auth fix phase.

---

### AF-03: FPL session cookie has 7-day expiry — silent 401 after expiry (Risk: Medium)

**What goes wrong:** The FPL `pl_profile` cookie expires after approximately 7 days. The app stores this cookie in the browser's localStorage (current auth pattern). After expiry, FPL API calls that require authentication return 401 or redirect to login. The current codebase has no explicit expiry detection — the user will see generic 500 errors or stale data until they notice and re-login.

**Prevention:**
- Store the cookie acquisition timestamp in localStorage alongside the cookie value: `{ cookie: '...', acquired_at: ISO_timestamp }`.
- On each authenticated request, check `(Date.now() - acquired_at) > 6 * 24 * 60 * 60 * 1000` (6 days). If close to expiry, show an amber banner: "Your FPL session expires soon — re-login to maintain exact prices."
- On 401 response from any authenticated FPL API call, clear the stored cookie and show the re-login modal immediately (do not silently retry).

**Phase:** Auth fix phase.

---

### AF-04: Server-side FPL API proxy forwards cookies incorrectly in Next.js 16 (Risk: Medium)

**What goes wrong:** The existing `/api/fpl/[...proxy]` route handler proxies FPL API calls server-side. In Next.js 16, `request.headers.get('cookie')` in a Route Handler returns the browser's cookies sent to the Next.js app, not the FPL session cookies. The FPL session cookie stored in localStorage is not automatically attached to server-side fetch calls — it must be explicitly extracted from localStorage on the client and sent as a request header to the Next.js proxy, which then forwards it to FPL.

If the proxy implementation was written assuming cookies flow automatically (a common mental model from browser-to-server cookie semantics), authenticated FPL calls will succeed in development (where the developer may be testing with their own FPL cookies in their browser) but fail in production for users whose cookies are stored in localStorage rather than httpOnly browser cookies.

**Prevention:**
- The client must explicitly read the `pl_profile` cookie from localStorage and include it in the request to the Next.js proxy: `fetch('/api/fpl/...', { headers: { 'x-fpl-cookie': storedCookie } })`.
- The proxy Route Handler reads `request.headers.get('x-fpl-cookie')` and forwards it as `Cookie: ${fplCookie}` to the FPL API.
- Never attempt to auto-forward `request.headers.get('cookie')` from the browser — it contains Next.js internal cookies (e.g., `__Next_router_state_tree`), not the FPL session cookie.
- Add a test: mock the proxy handler and assert that when `x-fpl-cookie` is present, it is included in the upstream FPL fetch request.

**Phase:** Auth fix phase.

---

## Mitigation Strategies

### Cross-cutting: Test these specific scenarios before writing feature code

The following test fixtures should be commissioned before any v1.26 feature implementation. Each converts a "unknown behaviour" into a CI-caught regression:

1. **Push subscription lifecycle** — mock a browser-side `PushManager.subscribe()` call; assert the subscription endpoint is stored in the correct Blob path; assert a 410 response deletes the correct Blob file.
2. **VAPID key environment variable leakage check** — CI script: `grep -r "NEXT_PUBLIC_VAPID_PRIVATE" src/` must exit non-zero (return empty). Gates the build if the private key is accidentally made public.
3. **FPL deadline proximity gate** — unit test for the `minutes_until_deadline` function with fixtures: deadline in past (post-deadline run), deadline in 3h (pre-deadline run), no upcoming deadline (off-season). Assert correct `run_light_pipeline` / `run_full_pipeline` / `exit_early` decisions.
4. **Price baseline idempotency** — pipeline fixture where `price_baseline.json` already exists; assert the pipeline does not overwrite it on a second run.
5. **Auth cookie extraction** — mock the FPL login endpoint returning 302 with `Set-Cookie: pl_profile=xyz`; assert the Route Handler captures `xyz` correctly using whichever undici approach is selected.

### Cross-cutting: Vercel Blob as a concurrency boundary

This app uses Vercel Blob as a poor-man's database. Blob is eventually consistent and has no atomic update semantics. For v1.26:
- Push subscriptions: use per-device individual files (WP-04) — never a single aggregated list.
- Price baseline: write-once, idempotent (PR-01) — first write wins.
- Pipeline meta (last run time, next deadline): accept last-write-wins semantics; collisions are rare and consequence is minor (stale timestamp by one run).
- Never use Blob for anything requiring transactions. If v1.27+ adds multi-user features, replace Blob with Vercel KV or a proper database.

### Cross-cutting: Feature flag all v1.26 features

Each v1.26 feature should be gated by an env var (following the existing `TRANSFER_NEWS_ENABLED`, `INSIGHT_BATCH_ENABLED`, `MC_ENABLED` pattern):
- `PUSH_NOTIFICATIONS_ENABLED` — gates ALERT-01 opt-in UI and sender
- `PRICE_RESET_ENABLED` — gates price reset analysis display
- `SPECULATION_SCORING_ENABLED` — gates confidence scoring in Summer Window tab

This allows partial deployment (e.g., deploy auth fix and price reset without push notifications) and rollback without code changes.

### Cross-cutting: iOS push is a "nice-to-have" — do not block release

iOS Safari push requires: (1) PWA installation, (2) iOS 16.4+, (3) permission via user gesture. This is a fundamentally different UX flow than desktop Chrome. Do not design the push opt-in flow primarily around iOS, and do not block the ALERT-01 release on iOS support. Ship desktop Chrome/Firefox first; iOS support is an enhancement.

---

## Phase-Specific Warning Summary

| Phase | Likely Pitfalls | Most Critical Guard |
|-------|-----------------|---------------------|
| **ALERT-01** Web Push | WP-01, WP-02, WP-03, WP-04, WP-05, WP-07, WP-08 | Service worker in `/public/sw.js` at root scope. VAPID private key never `NEXT_PUBLIC_*`. Per-device Blob files, never a single subscription list. |
| **REFRESH-01** Pre-deadline pipeline | PS-01, PS-02, PS-03, PS-04 | Deadline proximity gate in Python (not cron timing). Light pipeline on pre-deadline runs only. Off-season early-exit guard. |
| **Transfer speculation scoring** | SS-01, SS-02, SS-03, SS-04 | Source tier is a prior; article class overrides it. Slower decay (21-day half-life) off-season. Negative context filter (require destination club). |
| **Price reset analysis** | PR-01, PR-02, PR-03, PR-04 | Capture `price_baseline.json` at GW38 run — before next-season data arrives. Completeness heuristic (50% threshold) before surfacing comparison. |
| **Auth 502 fix** | AF-01, AF-02, AF-03, AF-04 | Do not use `redirect: 'manual'` with native fetch. Use `undici.request()` for cookie capture. Log all response headers on login failure. |

---

## Sources

**Official documentation (HIGH confidence):**
- [Next.js PWA Guide — service worker registration](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js environment variables — NEXT_PUBLIC_ prefix](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [web-push npm library](https://www.npmjs.com/package/web-push) — VAPID key generation and send API
- [Vercel Blob documentation](https://vercel.com/docs/vercel-blob)
- [Vercel serverless function timeout limits](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [GitHub Actions cron schedule documentation and limitations](https://cronbuilder.dev/blog/github-actions-cron-schedule.html)
- [GitHub Actions scheduled workflow delays — community discussion](https://github.com/orgs/community/discussions/156282)

**Bug reports and known issues (MEDIUM confidence):**
- [undici issue #1193 — redirect:manual opaque response](https://github.com/nodejs/undici/issues/1193) — `redirect: 'manual'` behaviour with undici
- [nodejs/node#52163 — Set-Cookie forbidden header in Node.js fetch](https://github.com/nodejs/node/issues/52163)
- [Web Push Error 410 — expired subscription handling](https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed)
- [Next.js service worker scope issue #545](https://github.com/vercel/next.js/issues/545)

**Community and ecosystem (MEDIUM confidence):**
- [iOS Safari web push PWA requirements — Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)
- [PWA iOS limitations 2025 — Magicbell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Push notifications in Safari iOS PWAs](https://iwritecodesometimes.net/2024/04/23/push-notifications-in-safari-progressive-web-apps/)
- [FPL price announcements timing — Fantasy Football Fix](https://www.fantasyfootballfix.com/blog-index/fpl-2025-26-player-price-revealed-update/)
- [FPL API endpoints guide — Frenzel Timothy](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19)

**Existing codebase (HIGH confidence — direct code read):**
- `pipeline/run.py` — IS_OFF_SEASON gate, TRANSFER_NEWS_ENABLED pattern
- `pipeline/transfer_news.py` — 5-class classifier, player_matching integration
- `pipeline/player_matching.py` — rapidfuzz token_sort_ratio ≥85
- `.github/workflows/pipeline.yml` — current cron schedule
- `src/app/api/auth/login/route.ts` (if exists) — existing auth implementation
