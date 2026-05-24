# Phase 135 — notify.py Push Notification Design

**Date:** 2026-05-24  
**Phase:** 135 — Pipeline Push Notifications  
**Milestone:** v1.26 — Modelling & Refinement

---

## Overview

`pipeline/notify.py` is a standalone Python script that runs at the end of the pipeline (called from `run.py`). It reads pipeline output files, determines which push notifications to send based on trigger conditions, and POSTs payloads to the Next.js `/api/push/send` route built in Phase 134. It never imports from `run.py` (isolation pattern — mirrors `refresh_gate.py`).

---

## Architecture

### Isolation contract

- `notify.py` MUST NOT import from `run.py`
- `run.py` calls `notify.py` via a `from notify import run_notify; run_notify()` call, wrapped in try/except so notify failures never fail the pipeline
- `notify.py` MAY import from `upload.py`, `fpl_client.py`, and the standard library

### Integration in run.py

Added at the very end of `run.py`, after all `save()` calls:

```python
# Phase 135: push notifications (non-fatal — never fail the pipeline)
try:
    from notify import run_notify
    run_notify()
except Exception as e:
    print(f"[notify] non-fatal error: {e}", file=sys.stderr)
```

### File reads

`notify.py` reads pipeline artefacts via a `_read_json(filename)` helper:

- **`USE_BLOB=true`** (production): `vercel_blob.list({'prefix': filename, 'limit': 1})` → `requests.get(blob_url).json()`
- **`USE_BLOB` unset / false** (dev): reads from `pipeline/cache/{filename}` directly

### Cross-run state

`notify_state.json` is stored in Vercel Blob (prod) / local cache (dev). Read-modify-write each run.

Schema:

```json
{
  "last_price_sent_at": null,
  "last_injury_sent_at": null,
  "last_captain_sent_at": null,
  "last_captain_id": null,
  "last_known_injuries": {},
  "gw_deadline_state": {}
}
```

Missing file → treat as fresh start (use empty defaults). State is only updated for notifications that receive a `200` response from `/api/push/send`.

### Rate limit

Maximum **3 notifications per run**. All candidates are collected first, then the first 3 are dispatched. Candidates beyond the limit are dropped without updating their state (so they may fire on the next run).

---

## Notification Types

### PUSH-02 — Price alert

| Field | Value |
|-------|-------|
| Input | `price_changes.json` — list of `{direction, confidence_pct, web_name, ...}` per player |
| Trigger | `direction in ('rise', 'fall')` **and** `confidence_pct >= 75` |
| Selection | Highest `confidence_pct` among qualifying players |
| Cooldown | `last_price_sent_at` within 24 h → skip |
| Payload | `type=price`, `title="Price change alert"`, `body="{web_name} likely to {direction} ({confidence_pct:.0f}% confidence)"` |
| State update | `last_price_sent_at = now()` on 200 |

### PUSH-03 — Injury alert

| Field | Value |
|-------|-------|
| Input | `merged_players.json` — list of player dicts with `id`, `web_name`, `status`, `news` |
| Trigger | `status != 'a'` **and** `news != ''` **and** player `id` not in `last_known_injuries` |
| Selection | First new injury player (list order) |
| Cooldown | `last_injury_sent_at` within 24 h → skip |
| Payload | `type=injury`, `title="Injury alert"`, `body="{web_name}: {news}"` |
| State update | `last_injury_sent_at = now()`, `last_known_injuries[id] = news` on 200 |

### PUSH-04 — Deadline reminder

| Field | Value |
|-------|-------|
| Input | `fpl_bootstrap.json` — `events` list, each with `id`, `deadline_time`, `is_next` |
| Trigger (24h) | `23 ≤ hours_until ≤ 25` **and** `gw_deadline_state[gw_id].fired_24h` is False |
| Trigger (2h) | `1 ≤ hours_until ≤ 3` **and** `gw_deadline_state[gw_id].fired_2h` is False |
| Selection | The next future event (`is_next=True` or nearest future deadline) |
| Payload | `type=deadline`, `title="Transfer deadline"`, `body="GW{N} deadline in {h}h"`, `hours_until=24 or 2` |
| State update | `gw_deadline_state[gw_id].fired_24h = True` (or `fired_2h`) on 200 |

`hours_until` is computed as `(deadline_utc - utcnow).total_seconds() / 3600`.

### PUSH-05 — Captain update

| Field | Value |
|-------|-------|
| Input | `captain_picks.json` — `{gameweek, ceiling: {id, name, team, ...}}` |
| Trigger | `ceiling.id != last_captain_id` in state |
| Cooldown | `last_captain_sent_at` within 24 h → skip |
| Payload | `type=captain`, `title="Captain update"`, `body="{name} ({team}) recommended"` |
| State update | `last_captain_sent_at = now()`, `last_captain_id = ceiling.id` on 200 |

---

## API Call

```python
BASE_URL = os.environ['NEXT_PUBLIC_SITE_URL']  # e.g. https://fplx.vercel.app
requests.post(
    f"{BASE_URL}/api/push/send",
    json=payload,
    timeout=15,
)
```

`NEXT_PUBLIC_SITE_URL` is already set in the pipeline environment (Vercel / GitHub Actions).

---

## Error Handling

| Error | Behaviour |
|-------|-----------|
| 404 from `/api/push/send` | No subscriber stored — skip silently, do NOT update state |
| 410 from `/api/push/send` | Subscriber gone — skip silently, do NOT update state |
| 502 / 503 from `/api/push/send` | Transient error — log warning, do NOT update state (retries on next run) |
| Missing pipeline file | Log warning, skip that notification type, continue with others |
| `notify_state.json` absent | Use empty defaults (fresh start) |
| Rate limit exceeded | Drop remaining candidates without updating their state |
| Any unhandled exception | Caught by run.py wrapper; logged to stderr; pipeline continues |

---

## Testing

**Location:** `pipeline/tests/test_notify.py`

**Test environment:** pytest; `notify.py`'s `_read_json` is patched via monkeypatch/mock; `requests.post` is mocked to return controlled responses.

### Test cases

| Test | What it verifies |
|------|-----------------|
| `test_price_fires_above_threshold` | Price notification sent when `confidence_pct >= 75` |
| `test_price_skips_below_threshold` | No notification when `confidence_pct < 75` |
| `test_price_skips_within_cooldown` | No notification when `last_price_sent_at` is within 24 h |
| `test_injury_fires_on_new_player` | Injury notification sent for player not in `last_known_injuries` |
| `test_injury_skips_known_player` | No notification when player already in `last_known_injuries` |
| `test_injury_skips_within_cooldown` | No notification when `last_injury_sent_at` within 24 h |
| `test_deadline_fires_24h_window` | Deadline notification sent when `hours_until ≈ 24`, flag flipped |
| `test_deadline_fires_2h_window` | Deadline notification sent when `hours_until ≈ 2`, flag flipped |
| `test_deadline_not_fired_twice` | 24h notification not re-sent when `fired_24h=True` |
| `test_captain_fires_on_id_change` | Captain notification sent when `ceiling.id` differs from state |
| `test_captain_skips_same_id` | No notification when captain unchanged |
| `test_captain_skips_within_cooldown` | No notification when `last_captain_sent_at` within 24 h |
| `test_rate_limit_caps_at_3` | 4 candidates → only 3 POSTs made |
| `test_404_does_not_update_state` | State unchanged when send returns 404 |
| `test_missing_file_skips_type` | Missing `price_changes.json` → injury/deadline/captain still checked |

---

## Files Created / Modified

| File | Action |
|------|--------|
| `pipeline/notify.py` | **Create** — standalone notify script |
| `pipeline/tests/test_notify.py` | **Create** — pytest suite (TDD: stubs first, then real tests) |
| `pipeline/run.py` | **Modify** — add `run_notify()` call at end (wrapped try/except) |

No new env vars beyond what already exists (`USE_BLOB`, `NEXT_PUBLIC_SITE_URL`, `BLOB_READ_WRITE_TOKEN`).
