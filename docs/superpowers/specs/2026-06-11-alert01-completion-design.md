# ALERT-01: Alert System Completion

**Feature ID:** ALERT-01 (completion — Phases 134/135 built the infrastructure)
**Date:** 2026-06-11
**Status:** Approved (push-only; email explicitly descoped by user)

---

## Context

The backlog entry says "currently no notification infrastructure" — stale. Phases 134/135 shipped: bell subscribe UI (`BellNotificationButton`, mounted in the page header), service worker (`public/sw.js`), `/api/push/subscribe` + `/api/push/send` routes (single-subscription Blob storage, VAPID), and the pipeline dispatcher `pipeline/notify.py` (4 collectors: price ≥75% confidence, injury, deadline 24h/2h, captain change; 24h cooldowns; `MAX_PER_RUN = 3`; state in `notify_state.json`).

It is dormant because **`web-push` is declared in package.json/package-lock.json but absent from node_modules** — `npm install` was never re-run. That is also the source of the `/api/push/send` tsc errors.

## Scope (3 pieces)

### 1. Unblock the infrastructure

- Run `npm install`; verify `node_modules/web-push/` and `node_modules/@types/web-push/` exist
- Verify the push route tsc errors are gone (`npx tsc --noEmit` — the `send/route.ts` web-push errors disappear; the unrelated pre-existing errors in `SummerWindowTab.test.tsx`/`LiveGwTab.test.tsx` are out of scope)
- Existing push route vitest tests pass

### 2. Two new collectors in `pipeline/notify.py`

Both follow the existing collector pattern exactly (pure function over cache artefacts + state dict; returns candidate dict or None; state mutations for dedupe; non-fatal).

**PUSH-06 — set-piece taker change**
- Input: the set-piece changes artefact the pipeline already writes (`set_piece_changes.json` — read its real shape at plan time)
- Fire when a change entry exists whose identity (stable hash of player + change description, or the artefact's own id/timestamp field if present) is not in `state['seen_setpiece_changes']`
- Payload: `{type: 'setpiece', title: 'Set-piece update', body: '{web_name}: {change description}'}`
- State: append the seen identity; cap the stored list at the most recent 50 to bound state growth
- Cooldown: the standard 24h per-type cooldown applies (same mechanism as the other types)

**PUSH-07 — prominent player lineup doubt** *(amended after artefact inspection: `lineup_news.json` is a flat per-player availability feed — `{id, availability_factor 0..1, status_label, news_headline}` — with no XI/bench/opponent/GW representation; the spirit of "benched in predicted lineups" maps to: FPL says available but scraped lineup news says doubt)*
- Input: `lineup_news.json` + `merged_players.json` (ownership, name, FPL status) + `fpl_bootstrap.json` (next-GW id for the state key)
- Fire when a player with `selected_by_percent > 20` AND FPL `status == 'a'` (not already injury-flagged — avoids overlap with PUSH-03) has `availability_factor` non-null and ≤ 0.5, and `state['benched_fired']` lacks the `"{gw}:{player_id}"` key
- Payload: `{type: 'benched', title: 'Lineup alert', body: '{web_name}: lineup doubt ({status_label})'}` — appends `' — {news_headline}'` when a headline is present
- State: `benched_fired` dict keyed `"{gw}:{player_id}"`; entries for other GWs pruned on write
- Cooldown: standard 24h per-type cooldown

### 3. Priority + bookkeeping

- Candidate collection order (= priority under `MAX_PER_RUN = 3`): deadline, injury, price, captain, **setpiece, benched** (new types appended last; existing behaviour unchanged)
- Update `.planning/notes/feature-backlog.md` ALERT-01 entry: mark Complete, note push-only + the Phase 134/135 provenance and this completion
- (Memory note about ALERT-01 needing infra is corrected outside the repo)

## Testing

`pipeline/tests/test_notify.py` additions, mirroring its existing per-collector test style (read it first):
- setpiece: fires on unseen change; does not refire on seen identity; respects type cooldown; state list capped at 50
- benched: fires for >20% owned predicted-benched player; not for 19.9%; not twice for same (gw, player); prunes past-GW state keys
- priority: with 7 candidates available, exactly 3 sent in the documented order
- Existing 4 collectors' tests untouched

UI side: no new tests needed (no UI change); `npm test` + `npx tsc --noEmit` confirm the install fix.

## Out of scope

- Email channel (user descoped)
- Multi-subscriber support (single-user app; existing single-blob design retained)
- New alert types beyond the backlog's six
- Fixing the unrelated pre-existing tsc errors in SummerWindowTab/LiveGwTab tests
