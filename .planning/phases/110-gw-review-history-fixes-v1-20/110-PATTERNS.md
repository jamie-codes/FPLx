# Phase 110: GW Review & History Fixes - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 5 (3 modified, 1 extended test, 1 new test)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/gw-review/route.ts` | API route (backend) | request-response + optional-fetch fan-out | `src/app/api/decision-history/route.ts` | exact — same standalone try/catch SC-5 pattern |
| `src/components/squad/GwReviewTab.tsx` | React component | request-response (hook-driven) | Self — one-line sign flip at line 171 | self-reference |
| `src/app/api/gw-review/route.test.ts` | test (node environment) | unit | `src/app/api/gw-review/route.test.ts` itself | self-extend |
| `src/components/squad/GwReviewTab.test.tsx` | test (jsdom environment) | unit | `src/components/squad/GwReviewTab.test.tsx` itself | self-extend |
| `src/app/api/decision-history/route.test.ts` | test (node environment, CREATE) | unit | `src/app/api/gw-review/route.test.ts` | role-match — same vi.stubGlobal fetch mock pattern |

---

## Pattern Assignments

### `src/app/api/gw-review/route.ts` (FIX-03 + FIX-04)

**Analog:** `src/app/api/gw-review/route.ts` lines 150-169 (existing dream-team fetch block)

**Imports / constants pattern** (lines 1-9):
```typescript
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import type { GwReview } from '@/lib/types'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'
const FPL_BASE = 'https://fantasy.premierleague.com/api'
```

**SC-5 standalone optional-fetch pattern** (lines 150-169 — dream-team block to copy exactly):
```typescript
// Step 4 — standalone try/catch; failure degrades gracefully, does NOT abort route.
// NEVER use Promise.all here — would convert single-fetch failures into route-level 502s.
let dreamTeamPicks: FPLDreamTeamPick[] = []
let useDreamTeamBenchmark = false
try {
  const dtRes = await fetch(`${FPL_BASE}/dream-team/${gw}/`, {
    headers: { 'User-Agent': 'fplx/1.17 (+https://fplx.app)' },
  })
  if (dtRes.ok) {
    const dtJson = (await dtRes.json()) as FPLDreamTeamResponse
    if (Array.isArray(dtJson?.team) && dtJson.team.length > 0) {
      dreamTeamPicks = dtJson.team
      useDreamTeamBenchmark = true
    }
  }
} catch {
  // Degraded — useDreamTeamBenchmark stays false, fallback below
}
```

**New Step 4b — liveMap fetch (copy this pattern, adapt for event/{gw}/live/):**
```typescript
// Step 4b (FIX-03/04): fetch all-player actual points for this GW.
// Standalone try/catch — liveMap stays empty on any failure (SC-5 → pts fall back to 0).
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
  // Degrade silently — liveMap stays empty → top_scorer_pts and best_bench_player_pts fall back to 0
}
```

**Step 5 usage pattern — replace total_points comparisons with liveMap lookups:**
```typescript
// BEFORE (lines 179-184): uses pick.total_points which is 0 for settled GWs
const optimalCaptain = starters.reduce(
  (best, p) => (p.total_points > best.total_points ? p : best),
  starters[0]
)
const topScorer = optimalCaptain

// AFTER (FIX-03/04): use liveMap for actual GW points
const topScorer = starters.reduce(
  (best, p) =>
    (liveMap.get(p.element) ?? 0) > (liveMap.get(best.element) ?? 0) ? p : best,
  starters[0]
)

// Output field lookups (lines 229, 235):
// BEFORE:  top_scorer_pts: topScorer.total_points,
// AFTER:   top_scorer_pts: liveMap.get(topScorer.element) ?? 0,

// BEFORE:  best_bench_player_pts: bestBench?.total_points ?? 0,
// AFTER:   best_bench_player_pts: bestBench != null ? (liveMap.get(bestBench.element) ?? 0) : 0,
```

**Error handling pattern** (existing, unchanged — lines 89-95):
```typescript
} catch (err) {
  const code = (err as NodeJS.ErrnoException)?.code
  if (code === 'ENOENT') {
    return Response.json({ error: 'GW review not available' }, { status: 404 })
  }
  return Response.json({ error: 'Failed to read GW review' }, { status: 500 })
}
```

---

### `src/components/squad/GwReviewTab.tsx` (FIX-05)

**Analog:** Self — one-line change at line 171.

**Core pattern — sign flip** (line 171):
```typescript
// BEFORE (broken — BUG):
const benchmarkDiff = review.your_score - review.benchmark_score

// AFTER (FIX-05 D-06):
const benchmarkDiff = review.benchmark_score - review.your_score
```

**Sentiment branches after fix** (lines 173-183 — unchanged in structure, now semantically correct):
```typescript
// benchmarkDiff > 0  → dream team beat user → AMBER (was incorrectly green)
// benchmarkDiff < 0  → user beat dream team → GREEN (was incorrectly amber)
// benchmarkDiff === 0 → on par → green (unchanged)
if (benchmarkDiff > 0) {
  benchmarkDeltaLabel = `+${benchmarkDiff} vs you`
  benchmarkSentimentClass = 'text-amber-700 dark:text-amber-300'
} else if (benchmarkDiff === 0) {
  benchmarkDeltaLabel = 'on par'
  benchmarkSentimentClass = 'text-green-600 dark:text-green-400'
} else {
  benchmarkDeltaLabel = `−${Math.abs(benchmarkDiff)} vs you`   // U+2212 not hyphen-minus
  benchmarkSentimentClass = 'text-green-600 dark:text-green-400'
}
```

**No other changes in this file.** Imports, hooks, sub-components, JSX structure are all unchanged.

---

### `src/app/api/gw-review/route.test.ts` (FIX-03 + FIX-04 TDD tests — extend)

**Analog:** `src/app/api/gw-review/route.test.ts` (self-extend)

**Existing mock helper to extend** (lines 25-49):
```typescript
// mockUpstream dispatches by URL substring — add '/live/' branch alongside '/dream-team/'
const fetchMock = vi.fn(async (url: string) => {
  if (url.includes('/picks/')) { /* ... */ }
  if (url.includes('/bootstrap-static/')) { /* ... */ }
  if (url.includes('/dream-team/')) { /* ... */ }
  // NEW: add this branch for FIX-03/04 tests:
  if (url.includes('/live/')) {
    return new Response(JSON.stringify({
      elements: [
        { id: 1, stats: { total_points: 14 } },   // top starter
        { id: 101, stats: { total_points: 9 } },  // bench player
        // ... other elements
      ]
    }), { status: 200 })
  }
  throw new Error(`Unexpected fetch URL: ${url}`)
})
```

**New test describe block pattern** (follows Phase 98 / Phase 99 style):
```typescript
describe('Phase 110 FIX-03/04: /api/gw-review live endpoint for settled GW points', () => {
  it('top_scorer_pts is non-zero (from liveMap) when event/live/ returns points', async () => {
    // RED: write test first. Fails until liveMap lookup is implemented.
    // ...
    expect(body.top_scorer_pts).toBeGreaterThan(0)
  })

  it('best_bench_player_pts is non-zero (from liveMap) when event/live/ returns points', async () => {
    // ...
    expect(body.best_bench_player_pts).toBeGreaterThan(0)
  })

  it('degrades gracefully to 0 when event/live/ fetch returns non-200 (SC-5)', async () => {
    // mock /live/ to return 503
    expect(body.top_scorer_pts).toBe(0)
    expect(body.best_bench_player_pts).toBe(0)
  })
})
```

**Test environment header** (line 1 — keep as-is):
```typescript
// @vitest-environment node
```

**Helper functions to reuse** (lines 55-61, 72-82):
```typescript
function starter(element: number, total_points: number, opts: Partial<Pick> = {}): Pick { /* ... */ }
function bench(element: number, total_points: number): Pick { /* ... */ }
function makeStarters(): Pick[] { /* ... */ }
```

---

### `src/components/squad/GwReviewTab.test.tsx` (FIX-05 TDD tests — extend + update 3 existing assertions)

**Analog:** `src/components/squad/GwReviewTab.test.tsx` (self-extend)

**Existing mock helper** (lines 36-53 — reuse unchanged):
```typescript
function mockSuccess(data: GwReview = sampleReview) {
  mockUseGwReview.mockReturnValue({ data, isLoading: false, isError: false, error: null })
}

function withReview(overrides: Partial<GwReview> = {}) {
  mockUseGwReview.mockReturnValue({
    data: { ...sampleReview, ...overrides },
    isLoading: false, isError: false, error: null,
  })
}
```

**3 existing tests that need assertion updates after FIX-05 sign flip:**

Line 180-185 — `'renders delta sub-label "+N vs you" when your_score > benchmark_score'`:
- After fix: `your_score: 72, benchmark_score: 60` → `benchmarkDiff = 60 - 72 = -12` → label is `−12 vs you` (user won, green)
- Update test description and assertion: `benchmark_score > your_score` → amber `+N vs you`; `your_score > benchmark_score` → green `−N vs you`

Line 187-195 — `'renders delta sub-label "−N vs you" (U+2212) when your_score < benchmark_score'`:
- After fix: `your_score: 50, benchmark_score: 65` → `benchmarkDiff = 65 - 50 = +15` → label is `+15 vs you` (dream team won, amber)
- This was testing the wrong sign; update to match corrected logic

**New test describe block for FIX-05:**
```typescript
describe('Phase 110 FIX-05: benchmarkDiff sign correction', () => {
  it('shows amber sentiment and "+N vs you" when dream team score > user score', () => {
    // dream team won: benchmark_score=122, your_score=72 → benchmarkDiff=+50 → amber
    withReview({ your_score: 72, benchmark_score: 122, benchmark_label: 'Dream team' })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    expect(card!.textContent).toMatch(/\+50 vs you/)
    // Amber class — check sentimentClass via computed style or class presence
  })

  it('shows green sentiment and "−N vs you" when user score > dream team score', () => {
    // user won: your_score=95, benchmark_score=80 → benchmarkDiff=-15 → green
    withReview({ your_score: 95, benchmark_score: 80, benchmark_label: 'Dream team' })
    const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
    const card = container.querySelector('[data-testid="gw-review-benchmark-card"]')
    expect(card!.textContent).toMatch(/−15 vs you/)
  })
})
```

**Test environment header** (line 2 — keep as-is):
```typescript
// @vitest-environment jsdom
```

---

### `src/app/api/decision-history/route.test.ts` (FIX-06 TDD tests — CREATE)

**Analog:** `src/app/api/gw-review/route.test.ts` — same node-environment, same vi.stubGlobal fetch pattern

**File header pattern** (copy from `route.test.ts` lines 1-10):
```typescript
// @vitest-environment node
// Phase 110 FIX-06: /api/decision-history element-summary lookup for modelCeilingPts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
```

**fs/promises mock** (copy from `gw-review/route.test.ts` lines 12-14):
```typescript
// decision-history/route.ts uses readFile for captain_picks_gw{N}.json
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    // Return a minimal valid CaptainPickSnapshot for a specific gw, or throw ENOENT
    if (path.includes('captain_picks_gw35')) {
      return JSON.stringify({
        gw: 35,
        ceiling: { id: 306, name: 'Salah', xPts_1gw: 8.5 },
      })
    }
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    throw err
  }),
}))
```

**fetch mock pattern** (copy from `gw-review/route.test.ts` mockUpstream structure):
```typescript
function mockUpstream(opts: {
  finishedGws?: number[]
  elementMap?: Array<{ id: number; web_name: string }>
  gwPicks?: Record<number, Array<{ element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean; total_points: number }>>
  elementSummary?: Record<number, Array<{ element: number; round: number; total_points: number }>>
}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/bootstrap-static/')) {
      return new Response(JSON.stringify({
        elements: opts.elementMap ?? [],
        events: (opts.finishedGws ?? [35]).map(id => ({ id, finished: true })),
      }), { status: 200 })
    }
    if (url.includes('/picks/')) {
      const gwMatch = url.match(/event\/(\d+)\/picks/)
      const gw = gwMatch ? Number(gwMatch[1]) : 35
      const picks = opts.gwPicks?.[gw] ?? []
      return new Response(JSON.stringify({
        entry_history: { points: 60, points_on_bench: 4, event: gw },
        picks,
      }), { status: 200 })
    }
    if (url.includes('/element-summary/')) {
      const idMatch = url.match(/element-summary\/(\d+)/)
      const id = idMatch ? Number(idMatch[1]) : 0
      const history = opts.elementSummary?.[id] ?? []
      return new Response(JSON.stringify({ history }), { status: 200 })
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  }))
}
```

**Test cases pattern** (TDD RED first):
```typescript
describe('Phase 110 FIX-06: /api/decision-history modelCeilingPts from element-summary', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('entries[N].regret is non-null when snapshot + element-summary both available', async () => {
    // Salah (id=306) scored 14pts in GW35; user captain scored 6pts (multiplier=2, total=12)
    // regret = 14*2 - 6*2 = 16
    mockUpstream({
      finishedGws: [35],
      elementMap: [{ id: 306, web_name: 'Salah' }, { id: 1, web_name: 'Trent' }],
      gwPicks: { 35: [
        { element: 1, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false, total_points: 12 },
      ]},
      elementSummary: { 306: [{ element: 306, round: 35, total_points: 14 }] },
    })
    const req = new NextRequest('http://localhost/api/decision-history?teamId=12345')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { entries: Array<{ regret: number | null; modelCeilingPts: number | null }> }
    expect(body.entries[0].modelCeilingPts).toBe(14)
    expect(body.entries[0].regret).toBe(16)
  })

  it('entries[N].regret stays null when element-summary fetch fails (SC-5)', async () => {
    // element-summary returns 503 → modelCeilingPts stays null → regret stays null
    // ...
    expect(body.entries[0].modelCeilingPts).toBeNull()
    expect(body.entries[0].regret).toBeNull()
  })

  it('deduplicates element-summary calls — single ceiling player across multiple GWs calls FPL once per unique ID', async () => {
    // Salah (id=306) is ceiling in both GW35 and GW36
    // element-summary/{306}/ should be called exactly once (not twice)
    // ...
  })
})
```

---

### `src/app/api/decision-history/route.ts` (FIX-06)

**Analog:** `src/app/api/decision-history/route.ts` (self-modify — `readGwPicks` and CR-01 block)

**Imports / constants** (lines 1-17 — unchanged):
```typescript
const FPL_BASE = 'https://fantasy.premierleague.com/api'
const FPL_UA = 'fplx/1.11 (+https://fplx.app)'
```

**`readGwPicks` pattern** (lines 54-66) — shape to mirror for element-summary helper:
```typescript
async function readGwPicks(teamId: string, gw: number): Promise<FPLPick[] | null> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${teamId}/event/${gw}/picks/`, {
      headers: { 'User-Agent': FPL_UA },
    })
    if (!res.ok) return null
    const json = (await res.json()) as FPLPicksResponse
    if (!json || !Array.isArray(json.picks)) return null
    return json.picks
  } catch {
    return null
  }
}
```

**CR-01 block to replace** (lines 133-137 — the target of FIX-06):
```typescript
// BEFORE — hardcoded null (CR-01):
// CR-01: Until the snapshot schema stores actual_pts, set to null so regret is null
const modelCeilingPts: number | null = null

// AFTER — insert Step 2b between Step 2 and Step 3, then replace the null assignment:
const modelCeilingPts: number | null =
  modelCeilingId !== null
    ? (actualPtsMap.get(modelCeilingId)?.get(gw) ?? null)
    : null
```

**Step 2b — element-summary deduplication block (insert after line 123, before Step 3):**
```typescript
// Step 2b (FIX-06): element-summary lookups for unique ceiling IDs.
// Deduplication: Salah as ceiling across 3 GWs = 1 element-summary call, not 3.
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
// actualPtsMap is now available for Step 3 lookups.
// SC-5: if all element-summary calls fail, actualPtsMap is empty → all modelCeilingPts = null.
```

**Note on Promise.allSettled vs Promise.all:** Use `Promise.allSettled` (not `Promise.all`) for element-summary calls — individual failures must not abort the others. The existing `Promise.all` at line 119-122 for `readSnapshot`/`readGwPicks` is acceptable because those helpers already return `null` on error. For direct `fetch` calls, `Promise.allSettled` is mandatory.

---

## Shared Patterns

### SC-5 Graceful Degradation
**Source:** `src/app/api/gw-review/route.ts` lines 150-169 (dream-team block)
**Apply to:** FIX-03/04 `event/{gw}/live/` fetch; FIX-06 `element-summary/{id}/` fetches
```typescript
// Pattern: standalone try/catch, never Promise.all wrapping optional calls.
// Failure initialises to empty state (empty Map / null), never throws to caller.
let optionalData = new Map<number, number>()
try {
  const res = await fetch(`${FPL_BASE}/...`, { headers: { 'User-Agent': 'fplx/1.17 (+https://fplx.app)' } })
  if (res.ok) {
    const json = await res.json() as { ... }
    if (Array.isArray(json?.relevantArray)) {
      optionalData = new Map(json.relevantArray.map((e) => [e.id, e.relevantField]))
    }
  }
} catch {
  // Degrade silently
}
```

### Direct FPL API Calls (no internal proxy)
**Source:** `src/app/api/gw-review/route.ts` line 9; `src/app/api/decision-history/route.ts` line 16
**Apply to:** All new FPL fetch calls in FIX-03/04/06
```typescript
const FPL_BASE = 'https://fantasy.premierleague.com/api'
// Always call FPL_BASE directly. Never use /api/fpl/[...proxy] from route files.
// Reason: relative-URL self-fetch fails on Vercel serverless deployments.
```

### Input Validation
**Source:** `src/app/api/gw-review/route.ts` lines 61-66; `src/app/api/decision-history/route.ts` lines 80-83
**Apply to:** No new parameters — existing validation unchanged
```typescript
if (!gwParam || !/^\d+$/.test(gwParam)) {
  return Response.json({ error: 'Invalid gw parameter' }, { status: 400 })
}
```

### Test Mock Cleanup
**Source:** `src/app/api/gw-review/route.test.ts` lines 85-88
**Apply to:** `decision-history/route.test.ts` afterEach block
```typescript
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
```

### Component Test Hook Mocking (jsdom)
**Source:** `src/components/squad/GwReviewTab.test.tsx` lines 8-12
**Apply to:** FIX-05 test additions in the same file
```typescript
const mockUseGwReview = vi.fn()
vi.mock('@/lib/hooks/useGwReview', () => ({
  useGwReview: (...args: unknown[]) => mockUseGwReview(...args),
}))
```

---

## No Analog Found

All files have clear analogs. No new patterns required from RESEARCH.md only.

---

## TDD Wave Order (from RESEARCH.md)

1. **FIX-05 first** — UI-only, no new fetches. Simplest RED→GREEN cycle. Update 3 broken assertions, add 2 correct new tests.
2. **FIX-03 + FIX-04 together** — one new `event/{gw}/live/` fetch, one `liveMap` used in two output fields.
3. **FIX-06 last** — most complex: new test file, element-summary deduplication, `Promise.allSettled` fan-out, `actualPtsMap` lookup.

---

## Key Constraints Confirmed in Source

| Constraint | Verified Location |
|------------|-------------------|
| `pick.total_points` is 0 for settled GWs | `gw-review/route.ts` lines 179, 189 — uses this field directly |
| `modelCeilingPts = null` hardcode | `decision-history/route.ts` line 137 — CR-01 comment |
| Sign error location | `GwReviewTab.tsx` line 171 — `your_score - benchmark_score` |
| SC-5 standalone try/catch pattern | `gw-review/route.ts` lines 150-169 (dream-team block) |
| `Promise.allSettled` not `Promise.all` for optional calls | RESEARCH.md Pattern 1 + route.ts pitfall comment lines 151-153 |
| Direct FPL_BASE, not internal proxy | `gw-review/route.ts` line 9, `decision-history/route.ts` line 16 |
| `computeRegret` accepts `null`, returns `null` | `src/lib/regret.ts` lines 26-34 — no changes needed |
| Test baseline: 21/21 passing pre-Phase 110 | RESEARCH.md Validation Architecture |

---

## Metadata

**Analog search scope:** `src/app/api/gw-review/`, `src/app/api/decision-history/`, `src/components/squad/`, `src/lib/`
**Files read:** 6 source files (route.ts ×2, route.test.ts ×1, GwReviewTab.tsx, GwReviewTab.test.tsx, regret.ts)
**Pattern extraction date:** 2026-05-14
