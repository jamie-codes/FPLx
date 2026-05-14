# Phase 110: GW Review & History Fixes - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 110 patches four data-accuracy bugs across the GW Review tab and the Decision History back-test surface. All four fixes are isolated to `/api/gw-review`, `/api/decision-history`, `GwReviewTab.tsx`, and `BackTab.tsx`. No new features, no pipeline changes, no new routes.

Deliverables:
1. **FIX-03**: `top_scorer_pts` shows actual GW points (currently 0/missing because `pick.total_points` is unpopulated from the FPL picks endpoint for settled GWs)
2. **FIX-04**: `best_bench_player_pts` shows actual bench player points (same root cause as FIX-03)
3. **FIX-05**: Dream team delta sign corrected in `GwReviewTab.tsx` — positive when dream team outscored user, amber sentiment when dream team wins
4. **FIX-06**: Decision history captain delta column populates with actual regret values instead of dashes — fix the hardcoded `modelCeilingPts = null` via request-time element-summary lookup

</domain>

<decisions>
## Implementation Decisions

### FIX-03 + FIX-04: Per-player actual points source

- **D-01:** Root cause: `pick.total_points` in the FPL picks endpoint (`/entry/{teamId}/event/{gw}/picks/`) is 0 for settled/historical GWs. Actual GW points must come from a different source.
- **D-02:** Fix: add a call to `event/{gw}/live/` in `/api/gw-review/route.ts`. This endpoint returns actual points for all ~700 players in a single call. Build a `Map<elementId, actualPts>` from the response and use it to look up each pick's actual points.
- **D-03:** Failure behaviour: SC-5 graceful fallback. If `event/{gw}/live/` fails (network error, non-200), fall back silently — `top_scorer_pts` and `best_bench_player_pts` degrade to 0, route never 502s. Wrap in a standalone try/catch (same pattern as the dream-team fetch at lines 153–168 of current route.ts).
- **D-04:** The `event/{gw}/live/` call should be made in parallel with the existing FPL bootstrap call (Step 3) using `Promise.allSettled` or parallel `fetch` calls. Do NOT serialize it — it adds latency if sequential.
- **D-05:** The FPL live endpoint response shape: `{ elements: [{ id, stats: { total_points, ... } }] }`. Key is `elements[].id` → `elements[].stats.total_points`.

### FIX-05: Dream team delta sign

- **D-06:** Flip `benchmarkDiff` in `GwReviewTab.tsx`: change `review.your_score - review.benchmark_score` to `review.benchmark_score - review.your_score`.
- **D-07:** Flip sentiment classes accordingly:
  - `benchmarkDiff > 0` (dream team beat you) → **amber** (`text-amber-700 dark:text-amber-300`)
  - `benchmarkDiff < 0` (you beat dream team) → **green** (`text-green-600 dark:text-green-400`)
  - `benchmarkDiff === 0` → green (on par)
- **D-08:** Label format unchanged: `+${benchmarkDiff} vs you` when positive; `−${Math.abs(benchmarkDiff)} vs you` when negative. Example: dream team=122, user=72 → `+50 vs you` (amber).

### FIX-06: Captain delta — actual model ceiling points

- **D-09:** `modelCeilingPts` is hardcoded to `null` in `decision-history/route.ts` (comment CR-01). Fix: request-time FPL `element-summary/{ceiling_id}/` lookup to get per-GW actual points.
- **D-10:** Deduplicate element-summary calls by unique ceiling element ID. A single ceiling player (e.g. Salah) is often the ceiling across many GWs — this means typically 1–5 unique calls for a full season, not 38. Steps:
  1. Collect unique ceiling element IDs from all snapshots
  2. `Promise.allSettled` over `element-summary/{id}/` for each unique ID
  3. Build `Map<elementId, Map<gwRound, actualPts>>` from `history[].round` + `history[].total_points`
  4. Look up each GW's `modelCeilingPts` from this map
- **D-11:** Failure behaviour: SC-5 graceful null. If element-summary fails for an element, `modelCeilingPts` stays `null` for those GWs → `regret` stays `null` → column shows `—`. Route never 502s because of a single element-summary failure.
- **D-12:** The element-summary endpoint shape: `{ history: [{ element, round, total_points, ... }] }`. Key is `round` (GW number) → `total_points` (raw player points, no captain multiplier).
- **D-13:** `userCaptainPts` is already computed correctly: `cap.total_points / cap.multiplier` from picks — raw pts. `modelCeilingPts` from element-summary is also raw pts. The existing `computeRegret` formula doubles both before diffing (D-06 from Phase 96 CONTEXT.md). No formula change needed — just populate the currently-null `modelCeilingPts`.

### Test Strategy

- **D-14:** TDD RED→GREEN for each fix. Write a failing test first, then implement.
  - FIX-03/04: Add tests to `src/app/api/gw-review/route.test.ts` that mock `event/{gw}/live/` with non-zero `total_points` values. Assert `top_scorer_pts` and `best_bench_player_pts` are non-zero and correct.
  - FIX-05: Add/fix tests in `src/components/squad/GwReviewTab.test.tsx` with `benchmark_score > your_score`. Assert delta is positive and sentiment class is amber.
  - FIX-06: Add tests to `src/app/api/decision-history/route.test.ts` (create if needed) mocking `element-summary/{id}/` with realistic history[]. Assert `entries[N].regret` is non-null and mathematically correct.
- **D-15:** Extend existing test files rather than creating parallel suites. Each new test case targets the specific regression that each fix addresses.

### Claude's Discretion

- Exact `Promise.allSettled` vs parallel `Promise.all` wiring for the FIX-03/04 live endpoint call
- Whether `event/{gw}/live/` is fetched in the same try/catch block as bootstrap or has its own standalone block
- How to structure the `Map<elementId, Map<round, pts>>` builder for FIX-06 (could be a named helper `buildActualPtsMap` or inline)
- Exact test fixture shape for mocked FPL live / element-summary responses

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GW Review surface (FIX-03, FIX-04, FIX-05)
- `src/app/api/gw-review/route.ts` — API route to fix; add `event/{gw}/live/` call (D-02); fix `benchmarkDiff` sign not needed here (it's in component)
- `src/components/squad/GwReviewTab.tsx` — component to fix; flip `benchmarkDiff` calculation (D-06, D-07, D-08)
- `src/app/api/gw-review/route.test.ts` — existing test suite; extend with FIX-03/04 TDD tests (D-14)
- `src/components/squad/GwReviewTab.test.tsx` — existing test suite; extend with FIX-05 TDD tests (D-14)

### Decision History surface (FIX-06)
- `src/app/api/decision-history/route.ts` — API route to fix; replace hardcoded `modelCeilingPts = null` with element-summary lookup (D-09..D-13); comment CR-01 is the starting point
- `src/components/accuracy/BackTab.tsx` — UI rendering of regret; no changes needed (renders null correctly as `—`)
- `src/lib/regret.ts` (if exists) — `computeRegret` formula; verify it handles `modelCeilingPts` correctly before fixing

### Prior phase context
- `.planning/phases/96-captain-decision-backtester/96-CONTEXT.md` — D-06 (regret formula), D-08 (ceiling = xPts_90th_1gw pick), D-09 (`captain_picks_gw{N}.json` schema), CR-01 origin (why modelCeilingPts was null)
- `.planning/phases/98-post-gw-review-core/98-CONTEXT.md` — D-09 (bench player computation from picks), D-06 (settled GW detection)

### FPL API endpoints used in this phase
- `event/{gw}/live/` — returns `{ elements: [{ id, stats: { total_points, ... } }] }` for all players in a GW; source for FIX-03/04
- `element-summary/{id}/` — returns `{ history: [{ round, total_points, ... }] }` for full season history of one player; source for FIX-06
- **NOTE:** Exact response field names must be verified during research — the FPL API is undocumented. The researcher should confirm `elements[].stats.total_points` for live endpoint and `history[].total_points` + `history[].round` for element-summary.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dream-team standalone try/catch in `gw-review/route.ts` lines 153–168 — exact pattern to copy for the `event/{gw}/live/` call (standalone block, failure sets a flag, never aborts route)
- `computeRegret` in `src/lib/regret.ts` — accepts `(modelCeilingPts: number | null, userCaptainPts: number | null)` and returns null when either is null; requires no changes once `modelCeilingPts` is non-null
- `readGwPicks` in `decision-history/route.ts` — per-GW picks fetch pattern; element-summary lookup follows same shape (fetch, JSON parse, null on error)

### Established Patterns
- SC-5 graceful degradation: any partial failure produces null fields, never a 502. All four fixes must preserve this. See existing standalone try/catch blocks in `gw-review/route.ts`.
- FPL direct calls (not through `/api/fpl/[...proxy]`) — the pitfall comment in both routes explains why: relative self-fetch fails on Vercel serverless. New calls to `event/{gw}/live/` and `element-summary/{id}/` must also call FPL directly.
- TDD RED→GREEN: every phase since v1.6 has used this pattern. Extend existing `*.test.ts` files for each fix.

### Integration Points
- `/api/gw-review` receives one new parallel FPL call (`event/{gw}/live/`); `GwReview` type's `top_scorer_pts` and `best_bench_player_pts` already exist and are typed correctly — values just need to be non-zero
- `/api/decision-history` receives element-summary lookups post-snapshot-read; `RegretEntry.modelCeilingPts` is already `number | null` — just needs to be populated from lookup instead of hardcoded null

</code_context>

<specifics>
## Specific Ideas

- FIX-05: Example from success criteria — user=72, dream team=122 → delta label `+50 vs you`, amber sentiment. When user wins: user=95, dream team=80 → `−15 vs you`, green sentiment.
- FIX-06: The ceiling pick is typically the same top player (Salah, Haaland) across many consecutive GWs. Deduplication by element ID makes this 1–5 unique `element-summary` calls rather than 38 — a meaningful optimization worth implementing explicitly.
- FIX-03/04: The `event/{gw}/live/` endpoint is already fetched by other FPL tools. Same `User-Agent` header pattern as other FPL calls in the route.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 110-gw-review-history-fixes-v1-20*
*Context gathered: 2026-05-14*
