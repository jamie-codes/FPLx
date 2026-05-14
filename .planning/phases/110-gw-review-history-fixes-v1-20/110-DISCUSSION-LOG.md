# Phase 110: GW Review & History Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 110-gw-review-history-fixes-v1-20
**Areas discussed:** FIX-06 captain delta source, FIX-03/04 root cause, FIX-05 dream team delta sign, Test strategy

---

## FIX-06: Captain delta source

| Option | Description | Selected |
|--------|-------------|----------|
| Request-time element-summary | For each finished GW with a snapshot, call FPL `element-summary/{ceiling_id}/`. Deduplicate by unique element ID (typically 1–5 calls for a full season). No pipeline changes. | ✓ |
| Pipeline enrichment | Extend `captain_picks_gw{N}.json` to include `actual_pts` field. Pipeline writes it post-GW. Clean long-term but requires pipeline change. | |
| In-picks lookup (partial) | Use `total_points` from picks array if ceiling player is in user's squad. Falls back to null otherwise. | |

**User's choice:** Request-time element-summary lookup
**Notes:** Failure behaviour: graceful null (SC-5) — if element-summary fails, `modelCeilingPts` stays null, regret shows `—`, route never 502s.

---

## FIX-06: Failure behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful null — fall back to dash | Matches existing SC-5 contract. Element-summary failure → `modelCeilingPts: null` for those GWs → regret shows `—`. | ✓ |
| Best-effort from picks array first | Check picks array first; only call element-summary when ceiling player isn't in squad. Reduces calls but adds branching logic. | |
| You decide | Claude picks implementation details. | |

**User's choice:** Graceful null — fall back to dash
**Notes:** Consistent with existing partial-failure handling in the route.

---

## FIX-03/04: Root cause

| Option | Description | Selected |
|--------|-------------|----------|
| Shows 0 for both | `pick.total_points` is 0 for settled GWs from FPL picks endpoint. | |
| Points missing entirely | `top_scorer_pts` / `best_bench_player_pts` not rendering — field missing or undefined. | ✓ |
| Haven't seen it — anticipating | Bug identified from code review / test mocks, not live observation. | |

**User's choice:** Points missing entirely
**Notes:** Confirms `pick.total_points` is the broken source for historical GWs.

---

## FIX-03/04: Per-player actual points source

| Option | Description | Selected |
|--------|-------------|----------|
| Call `event/{gw}/live/` in gw-review route | One extra call, returns actual points for all ~700 players. SC-5 fallback on failure. | ✓ |
| Pipeline writes top scorer + best bench to blob | Extend `gw_review_gw{N}.json` — no request-time API call. Requires pipeline change. | |
| element-summary per pick (15 calls) | Per-player lookup. Consistent with FIX-06 but heavier (15x vs 1x). | |

**User's choice:** Call `event/{gw}/live/` in gw-review route
**Notes:** Parallel call alongside bootstrap. Standalone try/catch so failure degrades gracefully.

---

## FIX-05: Dream team delta sign

| Option | Description | Selected |
|--------|-------------|----------|
| +50 vs you (amber) — flip formula + sentiment | Flip `benchmarkDiff` to `benchmark_score - your_score`. Amber when dream team wins, green when user wins. "+N vs you" label. | ✓ |
| Dream team beat you — +50 | Alternative label format. Same semantics. | |

**User's choice:** +50 vs you (amber)
**Notes:** Example confirmed: dream team=122, user=72 → "+50 vs you" (amber). User beats dream team → "−N vs you" (green).

---

## Test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| TDD RED→GREEN for each fix | Write failing test first, then fix. Mock `event/{gw}/live/` with non-zero pts; mock benchmark_score > your_score; mock element-summary for FIX-06. | ✓ |
| Fix first, add regression tests after | Implement all four fixes, then add tests. Faster but no RED signal. | |
| Route-level tests only | Skip component tests — root causes are in API routes. | |

**User's choice:** TDD RED→GREEN for each fix
**Notes:** Extend existing `route.test.ts` and `GwReviewTab.test.tsx`. Create `decision-history/route.test.ts` if it doesn't exist.

---

## Claude's Discretion

- Exact Promise.allSettled vs Promise.all wiring for the `event/{gw}/live/` call
- Whether `event/{gw}/live/` shares a try/catch with bootstrap or has its own standalone block
- Helper function naming for FIX-06 element-summary map builder
- Exact test fixture shapes for mocked FPL live and element-summary responses

## Deferred Ideas

None — discussion stayed within phase scope.
