# Phase 110: GW Review & History Fixes - Research

**Researched:** 2026-05-14
**Domain:** Next.js 16 API routes + React component logic — FPL API integration, TDD with Vitest 4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FIX-03 + FIX-04: Per-player actual points source**
- D-01: Root cause — `pick.total_points` in the FPL picks endpoint is 0 for settled/historical GWs
- D-02: Fix — add call to `event/{gw}/live/` in `/api/gw-review/route.ts`; build `Map<elementId, actualPts>` from the response
- D-03: Failure behaviour SC-5 — if live endpoint fails, degrade silently to 0; never 502
- D-04: Fetch `event/{gw}/live/` in parallel with existing calls using `Promise.allSettled` or parallel `fetch`
- D-05: FPL live endpoint shape: `{ elements: [{ id, stats: { total_points, ... } }] }`

**FIX-05: Dream team delta sign**
- D-06: Flip `benchmarkDiff` in `GwReviewTab.tsx`: `review.benchmark_score - review.your_score` (was `your_score - benchmark_score`)
- D-07: Sentiment flip — `benchmarkDiff > 0` (dream team beat you) → amber; `benchmarkDiff < 0` (you beat dream team) → green; `=== 0` → green
- D-08: Label format — `+${benchmarkDiff} vs you` when positive (amber); `−${Math.abs(benchmarkDiff)} vs you` when negative (green)

**FIX-06: Captain delta — actual model ceiling points**
- D-09: Replace hardcoded `modelCeilingPts = null` (CR-01 comment) with request-time `element-summary/{ceiling_id}/` lookup
- D-10: Deduplicate element-summary calls by unique ceiling element ID; collect unique IDs, `Promise.allSettled` over them, build `Map<elementId, Map<gwRound, actualPts>>`
- D-11: Failure behaviour SC-5 — if element-summary fails, `modelCeilingPts` stays `null` → regret stays null → column shows `—`; never 502
- D-12: Element-summary endpoint shape: `{ history: [{ element, round, total_points, ... }] }`
- D-13: `userCaptainPts` already computed correctly; `computeRegret` formula unchanged

**Test Strategy**
- D-14: TDD RED→GREEN for each fix. Extend existing `route.test.ts` and `GwReviewTab.test.tsx` files
- D-15: Extend existing test files rather than creating parallel suites

### Claude's Discretion
- Exact `Promise.allSettled` vs parallel `Promise.all` wiring for the FIX-03/04 live endpoint call
- Whether `event/{gw}/live/` is fetched in the same try/catch block as bootstrap or has its own standalone block
- How to structure the `Map<elementId, Map<round, pts>>` builder for FIX-06 (could be a named helper `buildActualPtsMap` or inline)
- Exact test fixture shape for mocked FPL live / element-summary responses

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-03 | GW Review top scorer card displays the player's actual points alongside their name | Route currently uses `pick.total_points` which is 0 for settled GWs; fix via `event/{gw}/live/` lookup confirmed |
| FIX-04 | GW Review best bench card displays actual bench points (not 0) | Same root cause and fix as FIX-03 — same `total_points` field used for bench selection |
| FIX-05 | GW Review dream team delta shows correct sign — positive when dream team outscored the user | Sign bug confirmed at `GwReviewTab.tsx` line 171; existing component tests will break (become RED) which is correct TDD |
| FIX-06 | Decision history captain delta column displays actual points difference per GW instead of dashes | `modelCeilingPts = null` hardcode confirmed at `decision-history/route.ts` line 137; `element-summary/{id}/` lookup is the fix |

</phase_requirements>

---

## Summary

Phase 110 is a focused bug-fix phase with four independent data-accuracy patches across two surfaces: the GW Review tab (`/api/gw-review` + `GwReviewTab.tsx`) and the Decision History backtester (`/api/decision-history` + `BackTab.tsx`). No new routes, no new types, no pipeline changes are required.

The root cause investigation reveals two distinct root causes spanning all four bugs. FIX-03 and FIX-04 share a single root: `pick.total_points` from the FPL picks endpoint (`/entry/{teamId}/event/{gw}/picks/`) returns 0 for settled gameweeks — FPL does not backfill this field. The correct source for post-GW actual points is `event/{gw}/live/` which returns live stats for all ~700 players in one call. FIX-05 is an isolated sign-convention error in the component — the difference calculation subtracts in the wrong order, making "dream team beats user" display green instead of amber. FIX-06 has its own root cause documented in CR-01: `modelCeilingPts` was intentionally set to `null` when Phase 96 shipped because no actual-points source existed in the snapshot; the fix is a request-time lookup against `element-summary/{ceiling_id}/` which carries full season history.

**Primary recommendation:** Implement as four sequential TDD passes in wave order: FIX-05 (UI only, no fetch) → FIX-03/04 (together, one new fetch) → FIX-06 (new deduped fetch set). This ordering minimises test complexity and lets the simplest fix (sign flip) prove the TDD pattern before tackling the network changes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Actual per-player GW points (FIX-03/04) | API / Backend | — | Route is the data-assembly layer; component receives already-resolved values |
| Dream team delta sign + sentiment (FIX-05) | Frontend (React component) | — | Pure presentation logic; API already provides correct `benchmark_score` and `your_score` |
| Captain regret actual points (FIX-06) | API / Backend | — | The null is in the route; `computeRegret` and BackTab render correctly once data is non-null |
| SC-5 graceful degradation | API / Backend | — | All fallbacks live in try/catch blocks in the routes, not in UI |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.2 | Test runner | Already in use; `// @vitest-environment node` for route tests, `// @vitest-environment jsdom` for component tests [VERIFIED: package.json] |
| @testing-library/react | installed | Component rendering | Used in all existing `*.test.tsx` files [VERIFIED: GwReviewTab.test.tsx] |
| TypeScript | project standard | Types | All files are `.ts`/`.tsx` [VERIFIED: codebase] |

### No new packages required

All four fixes are implemented by modifying existing files. No `npm install` step needed.

---

## Architecture Patterns

### System Architecture Diagram

```
FIX-03/04 data flow:
  GET /api/gw-review?teamId=&gw=
    ├─ Step 2: fetch picks endpoint → total_points = 0 (historical bug)
    ├─ Step 3: fetch bootstrap → elementMap (unchanged)
    ├─ Step 4: fetch dream-team → standalone try/catch (unchanged)
    ├─ [NEW] Step 4b: fetch event/{gw}/live/ → liveMap<id, pts>
    │     (standalone try/catch, parallel with Step 3 or after Step 4)
    └─ Step 5: compute metrics using liveMap.get(element) ?? 0
                  → top_scorer_pts, best_bench_player_pts now non-zero

FIX-05 data flow:
  GwReviewTab.tsx (client component)
    ├─ receives review.your_score, review.benchmark_score from hook
    ├─ [BEFORE] benchmarkDiff = your_score - benchmark_score   ← BUG
    ├─ [AFTER]  benchmarkDiff = benchmark_score - your_score   ← FIX
    └─ benchmarkDiff > 0 → amber (dream team won), < 0 → green (user won)

FIX-06 data flow:
  GET /api/decision-history?teamId=
    ├─ Step 1: bootstrap → finishedGws, elementMap (unchanged)
    ├─ Step 2: parallel snapshot reads + picks fetches (unchanged)
    ├─ [NEW] Step 2b: collect unique ceiling IDs from snapshots
    │         Promise.allSettled(element-summary/{id}/ for each unique ID)
    │         build Map<elementId, Map<round, actualPts>>
    └─ Step 3: assemble RegretEntry using actualPtsMap.get(id)?.get(gw) ?? null
                  → modelCeilingPts now non-null → regret computed
```

### Recommended Project Structure

No structural changes. All edits are within existing files:

```
src/
├─ app/api/gw-review/
│   ├─ route.ts          ← FIX-03 + FIX-04 (add live endpoint call)
│   └─ route.test.ts     ← extend with FIX-03/04 TDD tests
├─ app/api/decision-history/
│   ├─ route.ts          ← FIX-06 (replace null with element-summary lookup)
│   └─ route.test.ts     ← CREATE (no test file exists yet)
└─ components/squad/
    ├─ GwReviewTab.tsx    ← FIX-05 (flip benchmarkDiff sign)
    └─ GwReviewTab.test.tsx ← extend with FIX-05 TDD tests
```

### Pattern 1: Standalone try/catch for optional FPL calls (SC-5)

The established pattern from `gw-review/route.ts` lines 153-168 (dream-team fetch):

```typescript
// Source: src/app/api/gw-review/route.ts lines 153-168 [VERIFIED: codebase]
let liveMap: Map<number, number> = new Map()
try {
  const liveRes = await fetch(`${FPL_BASE}/event/${gw}/live/`, {
    headers: { 'User-Agent': 'fplx/1.17 (+https://fplx.app)' },
  })
  if (liveRes.ok) {
    const liveJson = (await liveRes.json()) as { elements?: Array<{ id: number; stats: { total_points: number } }> }
    if (Array.isArray(liveJson?.elements)) {
      liveMap = new Map(liveJson.elements.map((e) => [e.id, e.stats.total_points]))
    }
  }
} catch {
  // Degrade silently — liveMap stays empty, top_scorer_pts and best_bench_player_pts fall back to 0
}
```

**Key constraint:** The pitfall comment in the route explicitly warns against `Promise.all` for graceful-degradation calls — it converts individual fetch failures into route-level 502s. Each optional FPL call needs its OWN standalone try/catch block. [VERIFIED: route.ts lines 151-153 comment]

### Pattern 2: FPL direct call (not through internal proxy)

```typescript
// Source: src/app/api/gw-review/route.ts line 9 [VERIFIED: codebase]
const FPL_BASE = 'https://fantasy.premierleague.com/api'
```

Both route files use this constant. All new FPL calls in this phase must also use direct FPL calls, not the `/api/fpl/[...proxy]` internal route. The pitfall comment explains why: relative-URL self-fetch fails on Vercel serverless deployments. [VERIFIED: route.ts lines 8-9]

### Pattern 3: Element-summary deduplication for FIX-06

```typescript
// Source: CONTEXT.md D-10 [VERIFIED: 110-CONTEXT.md]
// Step 2b in decision-history/route.ts
const uniqueCeilingIds = new Set(
  snapshots
    .filter((s): s is CaptainPickSnapshot => s !== null && s.ceiling !== null)
    .map((s) => s.ceiling.id)
)

const summaryResults = await Promise.allSettled(
  [...uniqueCeilingIds].map(async (id) => {
    const res = await fetch(`${FPL_BASE}/element-summary/${id}/`, { headers: { 'User-Agent': FPL_UA } })
    if (!res.ok) return null
    const json = (await res.json()) as { history?: Array<{ element: number; round: number; total_points: number }> }
    return { id, history: json.history ?? [] }
  })
)

// Build Map<elementId, Map<gwRound, actualPts>>
const actualPtsMap = new Map<number, Map<number, number>>()
for (const result of summaryResults) {
  if (result.status === 'fulfilled' && result.value) {
    const { id, history } = result.value
    actualPtsMap.set(id, new Map(history.map((h) => [h.round, h.total_points])))
  }
}

// Usage in Step 3:
const modelCeilingPts = modelCeilingId !== null
  ? (actualPtsMap.get(modelCeilingId)?.get(gw) ?? null)
  : null
```

### Pattern 4: TDD mock helpers for node-environment route tests

The existing `route.test.ts` pattern uses `vi.stubGlobal('fetch', fetchMock)` to intercept FPL calls by URL pattern. The new `event/{gw}/live/` mock must be added to the `mockUpstream` helper:

```typescript
// Source: src/app/api/gw-review/route.test.ts lines 26-48 [VERIFIED: codebase]
if (url.includes('/live/')) {
  return new Response(JSON.stringify({
    elements: [
      { id: 1, stats: { total_points: 14 } },
      { id: 101, stats: { total_points: 9 } },
      // ...
    ]
  }), { status: 200 })
}
```

### Pattern 5: FIX-05 sign flip — exact change

```typescript
// BEFORE (src/components/squad/GwReviewTab.tsx line 171) [VERIFIED: codebase]
const benchmarkDiff = review.your_score - review.benchmark_score

// AFTER (D-06 from CONTEXT.md)
const benchmarkDiff = review.benchmark_score - review.your_score
```

Sentinel cases after fix:
- `benchmarkDiff > 0` → dream team beat you → amber (`text-amber-700 dark:text-amber-300`), label: `+${benchmarkDiff} vs you`
- `benchmarkDiff === 0` → on par → green, label: `on par`
- `benchmarkDiff < 0` → user beat dream team → green (`text-green-600 dark:text-green-400`), label: `−${Math.abs(benchmarkDiff)} vs you`

### Anti-Patterns to Avoid

- **Promise.all for optional FPL calls:** Combining dream-team, live endpoint, or element-summary into a `Promise.all` converts individual failures into route-level 502s. Use standalone try/catch blocks for every optional call. [VERIFIED: route.ts pitfall comment lines 151-153]
- **Using `pick.total_points` for settled GW points:** This field is 0 for historical GWs. Always look up actual points from `event/{gw}/live/` in the liveMap. [VERIFIED: CONTEXT.md D-01]
- **Calling `/api/fpl/[...proxy]` from route files:** Relative self-fetch fails on Vercel serverless. Always use `FPL_BASE` constant directly. [VERIFIED: route.ts lines 8-9]
- **Amending existing snapshot schema:** `captain_picks_gw{N}.json` has no `actual_pts` field. The fix is a request-time lookup — not a schema change. [VERIFIED: CONTEXT.md D-09, pipeline/cache/captain_picks.json]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| All-player actual points for a settled GW | Custom computation from picks | `event/{gw}/live/` FPL endpoint | Returns all ~700 players in one call; picks endpoint `total_points` is 0 for historical GWs |
| Per-player season history | Custom storage | `element-summary/{id}/` FPL endpoint | Full `history[]` array with `round` + `total_points` per GW |
| Regret computation | Custom formula | `computeRegret()` from `src/lib/regret.ts` | Already implemented, tested, handles null, applies float-rounding (WR-01) |

**Key insight:** Both new FPL endpoints (`event/{gw}/live/` and `element-summary/{id}/`) are already used elsewhere in the FPL ecosystem and follow the same authentication-free, direct-call pattern. No new auth or proxy layer required.

---

## Common Pitfalls

### Pitfall 1: `pick.total_points` is always 0 for settled GWs

**What goes wrong:** `topScorer.total_points` and `bestBench.total_points` return 0 because the FPL picks endpoint backfills this field as 0 for settled GWs. Currently `top_scorer_pts: topScorer.total_points` at route.ts line 229 and `best_bench_player_pts: bestBench?.total_points ?? 0` at line 235. [VERIFIED: codebase]

**Why it happens:** FPL `/entry/{teamId}/event/{gw}/picks/` is a team-picks-at-deadline snapshot; it does not carry post-GW stats. Post-GW actual points live in `event/{gw}/live/`.

**How to avoid:** Build `liveMap` from `event/{gw}/live/`, then use `liveMap.get(element) ?? 0` in Step 5 when selecting top scorer and best bench player — compare by live points, and use live points for `top_scorer_pts` and `best_bench_player_pts`.

**Warning signs:** `top_scorer_pts === 0` and `best_bench_player_pts === 0` in the rendered UI for any settled GW.

### Pitfall 2: FIX-05 existing tests become RED before fix — this is intentional TDD

**What goes wrong:** The test `renders delta sub-label "+N vs you" when your_score > benchmark_score` (GwReviewTab.test.tsx line 180) currently uses `your_score: 72, benchmark_score: 60`. This test was written against the broken sign logic. After the sign fix, this test's expectation may need updating: `+12 vs you` should become `−12 vs you` (user won, so negative `benchmarkDiff`).

**Why it happens:** Existing tests were written to match the currently-shipped (broken) behaviour.

**How to avoid:** The TDD RED step writes the NEW correct test first (dream team beats user → positive delta → amber). Then fix the component. Then update existing tests that were written against the broken behaviour so they match the corrected sign convention.

**Warning signs:** ALL existing PGW-03 benchmark tests pass after the fix — they should not all pass unchanged because the sign logic affects existing test expectations.

### Pitfall 3: Parallel `Promise.allSettled` placement for FIX-03/04

**What goes wrong:** Adding `event/{gw}/live/` inside the same try/catch as `bootstrap-static/` causes the live endpoint failure to abort the bootstrap step and return 502.

**Why it happens:** Mixing critical and optional fetches in one try/catch block.

**How to avoid:** Mirror the dream-team pattern exactly — standalone try/catch after Step 3 completes. The live endpoint is logically independent.

### Pitfall 4: Off-by-one in element-summary history[] lookup for FIX-06

**What goes wrong:** Looking up `history[].round` without confirming it matches the FPL GW number. If `round` is 1-indexed (GW1=1, GW38=38), the map key must be the GW number directly.

**Why it happens:** FPL API field naming is undocumented; `round` could theoretically be the position in the array rather than GW number.

**How to avoid:** CONTEXT.md D-12 states `{ history: [{ element, round, total_points, ... }] }` where `round` is the GW number. Trust this — it matches FPL's documented pattern for other endpoints. The `Map<elementId, Map<gwRound, actualPts>>` keyed by `round` is correct.

### Pitfall 5: `captain_picks_gw{N}.json` files do not exist for most GWs

**What goes wrong:** `readSnapshot(gw)` returns `null` for most GWs because the Phase 96 side-write only deployed at GW35+. When `snap === null`, `ceiling === null`, `modelCeilingId === null` — and the element-summary lookup set will be empty for those GWs. This is correct SC-5 behaviour, not a bug.

**Why it happens:** Historical GWs before Phase 96 deployment have no snapshot. The element-summary lookup only fires for GWs where `snap?.ceiling?.id` is non-null.

**How to avoid:** Filter before collecting `uniqueCeilingIds`: only include IDs from non-null snapshots. FIX-06 will show `—` for pre-deployment GWs regardless of the element-summary lookup, which is the intended behaviour.

---

## Code Examples

### FIX-03/04: Adding the live endpoint call to gw-review/route.ts

```typescript
// Source: pattern from src/app/api/gw-review/route.ts lines 153-168 [VERIFIED: codebase]
// Insert as new Step 4b, after Step 4 (dream-team fetch), before Step 5:

let liveMap: Map<number, number> = new Map()
try {
  const liveRes = await fetch(`${FPL_BASE}/event/${gw}/live/`, {
    headers: { 'User-Agent': 'fplx/1.17 (+https://fplx.app)' },
  })
  if (liveRes.ok) {
    const liveJson = (await liveRes.json()) as {
      elements?: Array<{ id: number; stats: { total_points: number } }>
    }
    if (Array.isArray(liveJson?.elements)) {
      liveMap = new Map(liveJson.elements.map((e) => [e.id, e.stats.total_points]))
    }
  }
} catch {
  // Degrade silently — liveMap stays empty → pts fall back to 0 (SC-5)
}

// In Step 5, change picks comparisons to use liveMap:
// BEFORE: const topScorer = starters.reduce((best, p) => (p.total_points > best.total_points ? p : best), starters[0])
// AFTER:
const topScorer = starters.reduce(
  (best, p) =>
    (liveMap.get(p.element) ?? 0) > (liveMap.get(best.element) ?? 0) ? p : best,
  starters[0]
)
// Similarly for benchPicks comparison and for top_scorer_pts / best_bench_player_pts output fields
```

### FIX-06: element-summary lookup structure in decision-history/route.ts

```typescript
// Source: CONTEXT.md D-10, D-12 [VERIFIED: 110-CONTEXT.md]
// Insert between Step 2 and Step 3:

// Step 2b: element-summary lookups for unique ceiling IDs
const uniqueCeilingIds = new Set<number>()
for (const snap of snapshots) {
  if (snap?.ceiling?.id != null) uniqueCeilingIds.add(snap.ceiling.id)
}

const actualPtsMap = new Map<number, Map<number, number>>()
if (uniqueCeilingIds.size > 0) {
  const summaryResults = await Promise.allSettled(
    [...uniqueCeilingIds].map(async (id) => {
      const res = await fetch(`${FPL_BASE}/element-summary/${id}/`, {
        headers: { 'User-Agent': FPL_UA },
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        history?: Array<{ element: number; round: number; total_points: number }>
      }
      return { id, history: json.history ?? [] }
    })
  )
  for (const result of summaryResults) {
    if (result.status === 'fulfilled' && result.value) {
      const { id, history } = result.value
      actualPtsMap.set(id, new Map(history.map((h) => [h.round, h.total_points])))
    }
  }
}

// In Step 3 RegretEntry assembly, replace the hardcoded null:
// BEFORE: const modelCeilingPts: number | null = null
// AFTER:
const modelCeilingPts: number | null =
  modelCeilingId !== null
    ? (actualPtsMap.get(modelCeilingId)?.get(gw) ?? null)
    : null
```

### FIX-05: Sign flip in GwReviewTab.tsx

```typescript
// Source: src/components/squad/GwReviewTab.tsx line 171 [VERIFIED: codebase]
// BEFORE:
const benchmarkDiff = review.your_score - review.benchmark_score

// AFTER (D-06):
const benchmarkDiff = review.benchmark_score - review.your_score

// Sentiment + label branches remain at the same positions — only the sign of benchmarkDiff changes
// which causes the if-else to branch correctly:
if (benchmarkDiff > 0) {
  // dream team won → amber
  benchmarkDeltaLabel = `+${benchmarkDiff} vs you`
  benchmarkSentimentClass = 'text-amber-700 dark:text-amber-300'
} else if (benchmarkDiff === 0) {
  // tied → green
  benchmarkDeltaLabel = 'on par'
  benchmarkSentimentClass = 'text-green-600 dark:text-green-400'
} else {
  // user won → green, U+2212 minus sign
  benchmarkDeltaLabel = `−${Math.abs(benchmarkDiff)} vs you`
  benchmarkSentimentClass = 'text-green-600 dark:text-green-400'
}
```

---

## Cross-Bug Root Cause Analysis

Per the phase description, a cross-bug correlation investigation is required before treating the four bugs as isolated patches.

**Finding: Two distinct root causes, no single shared field name error.**

1. **FIX-03 + FIX-04 share root cause A:** `pick.total_points = 0` for settled GWs in FPL picks endpoint. Both use this field in Step 5 of `gw-review/route.ts` lines 179 (`optimalCaptain.total_points`) and 183-189 (`benchPicks` reduce on `total_points`). Same fix (`liveMap` lookup) resolves both. [VERIFIED: route.ts]

2. **FIX-05 is isolated root cause B:** Sign error in `GwReviewTab.tsx` line 171 — subtraction operands reversed. No relation to FIX-03/04 data source or FIX-06 null. [VERIFIED: GwReviewTab.tsx]

3. **FIX-06 is isolated root cause C:** Intentional `null` placeholder (CR-01) in `decision-history/route.ts` line 137 — documented technical debt from Phase 96 (`// Until the snapshot schema stores actual_pts, set to null`). Not a field name typo; it was an explicit deferral. [VERIFIED: decision-history/route.ts]

4. **No shared field name mis-typing in `gw_review_gw{N}.json`:** The blob base files only carry `{ gw, average_score }`. [VERIFIED: pipeline/cache/gw_review_gw35.json] No per-player data lives in these files.

5. **No sign convention drift between pipeline writer and UI reader:** FIX-05 is purely a UI sign error; the API correctly provides `benchmark_score` and `your_score` as unsigned totals.

**Conclusion:** Four patches are appropriate. FIX-03 and FIX-04 can be implemented in a single code change (one new fetch, one shared liveMap). FIX-05 and FIX-06 are independent.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pick.total_points` for settled GW scoring | `event/{gw}/live/` via liveMap | This phase | FIX-03/04 resolved |
| `modelCeilingPts = null` hardcode | `element-summary/{id}/` lookup | This phase | FIX-06 resolved |
| `your_score - benchmark_score` | `benchmark_score - your_score` | This phase | FIX-05 resolved |

**Deprecated/outdated:**

- `pick.total_points` for actual GW points in settled GWs: field is unreliable (0) for historical GWs; use `event/{gw}/live/` instead.

---

## Runtime State Inventory

> Step 2.5: This is NOT a rename/refactor/migration phase. Section included for completeness.

**Not applicable** — phase makes no identifier changes, no renames, no data migrations.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All route tests (`@vitest-environment node`) | Yes | Project runtime | — |
| vitest | Test runner | Yes | 4.1.2 | — |
| @testing-library/react | GwReviewTab.test.tsx | Yes | installed | — |
| FPL API (event/live, element-summary) | FIX-03/04/06 routes (production) | Not verified at test time | N/A | Unit tests mock fetch; no live FPL call in tests |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** FPL API calls are mocked in all tests via `vi.stubGlobal('fetch', ...)` — no live network required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/app/api/gw-review/route.test.ts src/components/squad/GwReviewTab.test.tsx src/app/api/decision-history/route.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-03 | `top_scorer_pts` non-zero for settled GW | unit | `npx vitest run src/app/api/gw-review/route.test.ts` | Yes (extend) |
| FIX-04 | `best_bench_player_pts` non-zero for settled GW | unit | `npx vitest run src/app/api/gw-review/route.test.ts` | Yes (extend) |
| FIX-05 | `benchmarkDiff > 0` (dream team wins) → amber sentiment, positive label | unit | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | Yes (extend + fix existing) |
| FIX-06 | `entries[N].regret` non-null when snapshot + element-summary available | unit | `npx vitest run src/app/api/decision-history/route.test.ts` | No — Wave 0 creates this file |

### Sampling Rate

- **Per task commit:** `npx vitest run src/app/api/gw-review/route.test.ts src/components/squad/GwReviewTab.test.tsx src/app/api/decision-history/route.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/decision-history/route.test.ts` — covers FIX-06 (RED tests first, then GREEN after implementation)

**Existing infrastructure covers all other requirements** — `route.test.ts` and `GwReviewTab.test.tsx` both exist and are all-green at baseline (21/21 tests passing). [VERIFIED: vitest run output]

### Baseline Test Status

Current state before any Phase 110 changes:
- `src/app/api/gw-review/route.test.ts`: 7/7 passing
- `src/components/squad/GwReviewTab.test.tsx`: 14/14 passing (but 3 PGW-03 tests test AGAINST the broken sign convention — they will need updating)
- `src/app/api/decision-history/route.test.ts`: does not exist

[VERIFIED: `npx vitest run src/app/api/gw-review/route.test.ts src/components/squad/GwReviewTab.test.tsx` → 21 passed]

---

## Security Domain

> `security_enforcement` not set to false in config.json — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth flows |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | Existing teamId numeric validation unchanged |
| V5 Input Validation | Yes (existing) | `gwParam` and `teamIdParam` validated with `/^\d+$/` regex — unchanged; no new input parameters |
| V6 Cryptography | No | No crypto changes |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `gw` or `teamId` | Tampering | `/^\d+$/` regex validation already present in both routes (unchanged) |
| SSRF via constructed FPL URL | Tampering | FPL_BASE is a hardcoded constant; `gw` and `id` values are numeric-validated before use in URL strings |

**No new security surface added by this phase.** All new fetch URLs are constructed from `FPL_BASE` (constant) + numeric-validated parameters. No new query parameters introduced.

---

## Project Constraints (from CLAUDE.md)

1. **Do not add `Co-Authored-By` trailers to git commits** — from CLAUDE.md directly.
2. **Read `node_modules/next/dist/docs/` before writing Next.js code** — from AGENTS.md. This phase touches Next.js 16 route handlers; the executor must check the relevant guide before writing route code.
3. **Heed deprecation notices** — from AGENTS.md.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FPL `event/{gw}/live/` response shape is `{ elements: [{ id, stats: { total_points, ... } }] }` as stated in CONTEXT.md D-05 | FIX-03/04 code examples | If field names differ, `liveMap` builds empty — degrades to 0 (SC-5), not a 502. Low risk. |
| A2 | FPL `element-summary/{id}/` response shape is `{ history: [{ round, total_points, ... }] }` as stated in CONTEXT.md D-12 | FIX-06 code examples | If `round` is not the GW number, the map lookup returns null — degrades to null regret (SC-5). Low risk. |
| A3 | `captain_picks_gw{N}.json` files only exist for GW35+ (Phase 96 deployment boundary) | Pitfall 5 | If more snapshots exist, FIX-06 would populate more GWs correctly — net positive, not a regression. |

**All three assumptions have SC-5 graceful degradation as fallback — wrong assumptions produce null/0 values, not errors.**

---

## Open Questions

1. **FPL `event/{gw}/live/` field name verification**
   - What we know: CONTEXT.md D-05 states `elements[].stats.total_points`
   - What's unclear: FPL API is undocumented; field names could differ at runtime
   - Recommendation: Mock with the D-05 shape in tests; add a defensive check `Array.isArray(liveJson?.elements)` before building the map (already in the pattern)

2. **Existing PGW-03 component tests need updating for FIX-05**
   - What we know: The test at GwReviewTab.test.tsx line 180-185 (`renders delta sub-label "+N vs you" when your_score > benchmark_score`) tests the WRONG sign convention. After the fix, when `your_score > benchmark_score`, `benchmarkDiff` will be negative — so this test either needs a new scenario description or new assertion values.
   - What's unclear: Whether the planner treats updating existing test assertions as a separate task or folds it into the FIX-05 TDD task.
   - Recommendation: Fold the existing test assertion updates into the FIX-05 TDD task. TDD RED: write the correct new test. Implementation: flip the sign. Cleanup: update the 3 existing PGW-03 assertions that were written against the broken convention.

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/gw-review/route.ts` — full file read; confirmed root causes for FIX-03/04/05 [VERIFIED: codebase]
- `src/app/api/decision-history/route.ts` — full file read; confirmed CR-01 null hardcode for FIX-06 [VERIFIED: codebase]
- `src/components/squad/GwReviewTab.tsx` — full file read; confirmed sign error at line 171 for FIX-05 [VERIFIED: codebase]
- `src/app/api/gw-review/route.test.ts` — full file read; 7/7 tests baseline [VERIFIED: codebase]
- `src/components/squad/GwReviewTab.test.tsx` — full file read; 14/14 tests baseline [VERIFIED: codebase]
- `src/lib/regret.ts` — full file read; confirmed `computeRegret` formula and null-handling [VERIFIED: codebase]
- `src/lib/types.ts` — GwReview, RegretEntry, DecisionHistory interfaces [VERIFIED: codebase]
- `pipeline/cache/gw_review_gw35.json` — confirmed blob shape is `{ gw, average_score }` only [VERIFIED: codebase]
- `pipeline/cache/captain_picks.json` — confirmed snapshot schema (no `actual_pts` field) [VERIFIED: codebase]
- `vitest.config.ts` — test environment config [VERIFIED: codebase]
- `.planning/phases/110-gw-review-history-fixes-v1-20/110-CONTEXT.md` — locked decisions [VERIFIED]
- `npx vitest run` output — 21/21 tests passing for phase-relevant files [VERIFIED: executed]

### Secondary (MEDIUM confidence)
- `.planning/phases/96-captain-decision-backtester/96-CONTEXT.md` — CR-01 origin and regret formula [CITED: codebase]
- `.planning/phases/98-post-gw-review-core/98-CONTEXT.md` — bench player computation pattern [CITED: codebase]

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing test files
- Architecture: HIGH — all files read and confirmed; root causes verified in source
- Pitfalls: HIGH — verified from actual source code, not assumed
- FPL API field names: MEDIUM — stated in CONTEXT.md but FPL is undocumented; SC-5 degradation mitigates risk

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable codebase; FPL API field names are stable within a season)
