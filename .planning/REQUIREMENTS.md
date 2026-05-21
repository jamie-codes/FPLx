# Requirements — v1.26 Off-Season Intelligence

**Milestone:** v1.26 Off-Season Intelligence
**Status:** Active
**Last updated:** 2026-05-21

---

## v1.26 Requirements

### Auth Fix

- [ ] **AUTH-05**: FPL login route handler returns a clean `ENDPOINT_GONE` response immediately when the credential endpoint is unavailable, eliminating 502 errors
- [ ] **AUTH-06**: User always sees the token-paste flow without being blocked by credential endpoint failure — clear fallback UI message shown

### Transfer Speculation Scoring

- [ ] **SPEC-01**: User can see a source reliability tier badge (Official / Reliable / Speculative) on each Summer Window article card
- [ ] **SPEC-02**: Article confidence decays over time using a 21-day off-season half-life so stale rumours surface their age visually
- [ ] **SPEC-03**: User can filter Summer Window articles by source tier (tier pill added to existing 5-pill classification filter row)

### Price Reset Analysis

- [ ] **PRST-01**: Pipeline captures a price baseline (`now_cost` per player, all 700+ bootstrap elements) before season-end and stores it as `price_baseline.json` in Vercel Blob — idempotent, write-once
- [ ] **PRST-02**: User can see a Price Reset tab in the Analyse section showing who rose/fell vs the season-end baseline when FPL publishes next-season prices
- [ ] **PRST-03**: Price changes display as coloured delta pills (+X.Xm / −X.Xm); a "Value Targets" section highlights players whose price fell but xPts still rates above position median
- [ ] **PRST-04**: Price Reset tab shows an appropriate empty state before FPL publishes next-season prices, with an estimated availability note

### Deadline Day Banner

- [ ] **DL-01**: User sees a persistent countdown banner to the next FPL gameweek deadline displayed in their local timezone
- [ ] **DL-02**: Banner shifts visual urgency through three states: neutral zinc (> 24h), amber (2–24h), red sticky (< 2h)
- [ ] **DL-03**: User can dismiss the deadline banner per-gameweek (dismiss state stored in localStorage, resets on new GW)

### Push Notifications (ALERT-01)

- [ ] **PUSH-01**: User can enable browser push notifications via a single toggle in settings — permission prompt is gated behind explicit user action, never on page load
- [ ] **PUSH-02**: User receives a push notification when a watched or owned player's price is projected to change (|delta| ≥ £0.2m threshold, 24h per-player cooldown, max 3 notifications per pipeline run)
- [ ] **PUSH-03**: User receives a push notification when an owned player's injury status changes (new or updated injury/doubt flag)
- [ ] **PUSH-04**: User receives deadline reminder push notifications 24h and 2h before each FPL gameweek deadline
- [ ] **PUSH-05**: User receives a push notification when the top captain recommendation changes for the upcoming gameweek

### Pre-Deadline Pipeline (REFRESH-01)

- [ ] **PIPE-01**: Pipeline runs in fast mode (bootstrap + lineup news only, skip Understat/MC/AI batch) within 360 minutes of each GW deadline — reduces pre-deadline run time and API cost
- [ ] **PIPE-02**: `notify.py` runs as an isolated post-pipeline step (never importing from `run.py`) and POSTs change events to `/api/push/send`, following the `refresh_gate.py` isolation pattern
- [ ] **PIPE-03**: `notify.py` compares current pipeline output against previous Blob state to detect price projection changes and injury flag changes before dispatching notifications

---

## Future Requirements

### Push / Notifications
- iOS push support — requires PWA `manifest.json` and "Add to Home Screen" (iOS 16.4+)
- In-app notification history / inbox
- Email notification channel
- Per-type granular notification preferences beyond basic enable/disable toggle

### Price Intelligence
- Multi-season price history (requires storing baselines across multiple seasons)
- Price prediction for newly promoted teams (no baseline to compare against)
- Squad value trajectory chart (total squad cost over time)

### Off-Season Content
- Transfer window deadline countdown (separate from GW deadlines — opening/closing of the registration window)
- Pre-season fixture difficulty analysis once Premier League publishes next season's schedule (expected August 2026)
- New signing FPL tier scoring (price + expected minutes + xPts estimate for new arrivals)

---

## Out of Scope (v1.26)

| Feature | Reason |
|---------|--------|
| iOS push notifications | Requires PWA manifest + Add-to-Home-Screen installation; Safari in-browser has no `PushManager` |
| In-app notification inbox | Extra persistence layer; push + badge count is sufficient for v1.26 |
| Email/SMS notifications | No email infrastructure; web push covers the use case |
| Transfer window close countdown | Different data source; FPL game deadlines are the primary FPL UX concern |
| Pre-season fixtures tab | Fixture data not published until August 2026; defer to v1.27 |
| Multi-season accuracy trends | Historical data retention not yet in place |

---

## Traceability

_(Filled by roadmapper)_

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-05 | Phase 130 | Pending |
| AUTH-06 | Phase 130 | Pending |
| SPEC-01 | Phase 131 | Pending |
| SPEC-02 | Phase 131 | Pending |
| SPEC-03 | Phase 131 | Pending |
| PRST-01 | Phase 133 | Pending |
| PRST-02 | Phase 133 | Pending |
| PRST-03 | Phase 133 | Pending |
| PRST-04 | Phase 133 | Pending |
| DL-01 | Phase 132 | Pending |
| DL-02 | Phase 132 | Pending |
| DL-03 | Phase 132 | Pending |
| PUSH-01 | Phase 134 | Pending |
| PUSH-02 | Phase 134 | Pending |
| PUSH-03 | Phase 134 | Pending |
| PUSH-04 | Phase 134 | Pending |
| PUSH-05 | Phase 134 | Pending |
| PIPE-01 | Phase 135 | Pending |
| PIPE-02 | Phase 135 | Pending |
| PIPE-03 | Phase 135 | Pending |
