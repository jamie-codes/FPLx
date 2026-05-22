# Phase 134: Push Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 134-push-notifications
**Areas discussed:** Toggle placement, Watched player scope, Deadline reminder trigger, Phase 134 vs 135 boundary

---

## Toggle placement

| Option | Description | Selected |
|--------|-------------|----------|
| Bell icon in header | Bell 🔔 next to ThemeToggle, opens popover with toggle + status | ✓ |
| New Settings sub-tab | Add 'Settings' sub-tab to an existing section (e.g., Squad) | |
| Inline at page bottom | Compact panel always visible at page bottom | |

**User's choice:** Bell icon in header

---

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle + status only | Enable/disable + one status line only | ✓ |
| Toggle + status + notification types | Also shows read-only chips for active notification types | |
| You decide | Claude picks minimal option | |

**User's choice:** Toggle + status only

---

## Watched player scope

| Option | Description | Selected |
|--------|-------------|----------|
| Owned players only | Drop "watched" from PUSH-02 for v1.26; only squad players | ✓ |
| Snapshot watchlist at subscribe time | POST current watchlistIds at subscribe time; stale if watchlist changes | |
| Server-side watchlist sync | New /api/watchlist endpoint; heavier lift | |

**User's choice:** Owned players only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Read from stored squad in Blob | notify.py reads existing squad Blob data for PUSH-03 and PUSH-05 | ✓ |
| Store team ID in subscription payload | POST team ID at subscribe time; notify.py calls FPL picks endpoint | |
| You decide | Claude picks simpler option | |

**User's choice:** Read from stored squad in Blob

---

## Deadline reminder trigger

| Option | Description | Selected |
|--------|-------------|----------|
| notify.py checks deadline proximity | Phase 135 reads bootstrap deadline_time, computes time-until, dedup in Blob | ✓ |
| Vercel Cron Job | Dedicated /api/cron/deadline-reminder, runs every 30 min | |
| Service worker self-schedule | Local timer in SW; only fires while browser open | |

**User's choice:** notify.py checks deadline proximity (Phase 135 concern)

---

| Option | Description | Selected |
|--------|-------------|----------|
| push_subscription.json in Blob | sent_reminders field in existing subscription Blob file | ✓ |
| Separate blob file | push_reminder_state.json — keeps subscription data clean | |
| You decide | Claude picks simpler option | |

**User's choice:** push_subscription.json in Blob (sent_reminders field)

---

## Phase 134 vs 135 boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 134 builds full send API; triggers are Phase 135 | VAPID + SW + subscribe + send + test-send; Phase 135 wires notify.py | ✓ |
| Phase 134 owns everything end-to-end | Phase 134 also implements notify.py change detection logic | |
| Phase 134 only proves PUSH-01 | Defer PUSH-02 through PUSH-05 entirely to Phase 135 | |

**User's choice:** Phase 134 builds the full send API; triggers are Phase 135

---

| Option | Description | Selected |
|--------|-------------|----------|
| POST /api/push/test-send with type param | Dev-only, gated by PUSH_TEST_SECRET, sends canned push per type | ✓ |
| Unit tests only | No test endpoint; verify via vitest with mocked web-push | |
| You decide | Claude picks whatever makes manual verification simplest | |

**User's choice:** POST /api/push/test-send with type param

---

## Claude's Discretion

- Exact notification payload shape (title, body, icon) for each notification type
- Whether subscription state is held in React context or a standalone hook
- Test coverage scope for API routes
- `web-push` npm package selection (conventional choice, no evaluation needed)

## Deferred Ideas

- Watched player sync for PUSH-02 — server-side watchlist endpoint so pipeline can target watched players
- Per-type notification preferences — granular enable/disable per type (explicitly in Future Requirements)
- iOS PWA push support — requires PWA manifest + Add-to-Home-Screen
- In-app notification inbox — push + badge sufficient for v1.26
