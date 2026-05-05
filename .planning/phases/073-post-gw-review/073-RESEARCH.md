# Phase 73: Post-GW Review — Research

**Researched:** 2026-05-05
**Domain:** FPL picks data fetching, Vercel Blob serving, React sub-tab navigation, TanStack Query hooks
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `pipeline/run.py` writes `gw_review_gw{N}.json` for each of the last 3 settled GWs (where `event['finished'] == True`). Written to local cache + uploaded to Vercel Blob when `USE_BLOB=true`. Fields per file: `{ gw, average_score }`.
- **D-02:** No Phase 69 dependency. Daily cron is sufficient. Phase 73 ships independently.
- **D-03:** `GET /api/gw-review?teamId=&gw=N` API route: reads `gw_review_gw{N}.json` from Blob (or local cache); fetches `entry/{teamId}/event/{gw}/picks/` from FPL proxy on-demand; merges and returns combined `GwReview` object.
- **D-04:** `USE_BLOB` env-var pattern follows Phase 67/54 convention. Local dev: `pipeline/cache/gw_review_gw{N}.json` seed files (require `git add -f` — gitignored directory).
- **D-05:** `your_score` + `bench_pts_left` sourced from `entry_history.points` and `entry_history.points_on_bench` in the `/picks/` response.
- **D-06:** Captain delta: `(optimal_captain_pts × 2) − (your_captain_pts × captain_multiplier)`. Optimal captain = pick with highest `total_points` among starting XI (position <= 11). If delta = 0, you picked correctly.
- **D-07:** Top scorer = pick with highest `total_points` from starting XI (position 1–11). Display as "Player Name — Xpts".
- **D-08:** Benchmark = `average_score` from Blob data. Labelled "FPL average". Not "top-10k".
- **D-09:** GW pill toggle showing last 3 settled GWs. Defaults to most recent. Consistent with 1/3/5 GW horizon toggle pattern.
- **D-10:** Pipeline writes exactly 3 files per run (sliding window). Overwritten each daily run.
- **D-11:** No team ID → "Load your squad to see GW reviews."
- **D-12:** GW not settled / Blob file missing → "GW review will appear once scores finalise."
- **D-13:** 503 on Blob cold start → "Review data unavailable — check back after the next pipeline run." Seed empty JSON files `{ gw: null }` in `pipeline/cache/`.

### Claude's Discretion

- 5th sub-tab label ("Review" or "GW Review") and position in Squad SECTIONS array (after "Lineup")
- `GwReview` TypeScript type shape (fields: `gw`, `your_score`, `bench_pts_left`, `captain_name`, `optimal_captain_name`, `captain_delta`, `top_scorer_name`, `top_scorer_pts`, `average_score`)
- TanStack Query hook name (`useGwReview`) and `staleTime` (suggest 30 min)
- Component name (`GwReviewTab`, `PostGwReview`, etc.)
- Visual layout of the review card (4–5 stats, compact grid or stacked rows)

### Deferred Ideas (OUT OF SCOPE)

- Full season GW history (all GWs, not just last 3)
- Per-team Blob persistence of team-specific review data
- Comparison vs mini-league rivals' GW scores (Phase 58 dependency)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PGW-01 | After each GW settles, user can view a Post-GW Review card: bench pts left, captain vs optimal captain (delta), top scorer, GW score vs FPL average | D-05..D-08 lock the computation; FPL picks endpoint returns all needed fields |
| PGW-02 | Review data written to Vercel Blob by pipeline after GW settles; served via `/api/gw-review`; consumed by TanStack Query hook | D-01..D-04 lock the architecture; Phase 54 pattern is the canonical template |
</phase_requirements>

---

## Summary

Phase 73 adds a 5th "Review" sub-tab to the Squad section. It is a two-layer feature: (1) a Python pipeline block that writes per-GW global data (`average_score`) to Vercel Blob, and (2) an API route that merges that Blob data with on-demand FPL picks data (team-specific: bench pts, captain delta, top scorer). The UI is a stateless display component driven by a TanStack Query hook, with a GW pill toggle letting the user switch between the last 3 settled GWs.

All required data is available from existing infrastructure. The FPL `entry/{teamId}/event/{gw}/picks/` endpoint is public (no auth required for past GWs) and is already proxied through `src/app/api/fpl/[...proxy]/route.ts`. The pipeline already fetches `bootstrap['events']` via `get_bootstrap_static()` — detecting finished GWs is a single list comprehension. The API route pattern is a direct copy of `src/app/api/insights/route.ts` with a `?gw=` query parameter and secondary FPL proxy fetch added.

The primary complexity is the API route's dual-fetch logic (Blob + FPL proxy) and the captain-delta computation in the route handler. The pipeline block is trivially simple. The UI is straightforward — simpler than `LineupTab` which it structurally mirrors.

**Primary recommendation:** Implement in 3 sequential plans: (1) pipeline block + seed files, (2) TypeScript types + API route + `useGwReview` hook, (3) `GwReviewTab` component + `page.tsx` wiring + MobileNav test update.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect finished GWs + write average_score | Pipeline (Python) | Vercel Blob | Bootstrap data is global; pipeline has it at run time |
| Serve merged GW review | API / Backend (Next.js route) | FPL proxy | Merges static Blob data with on-demand FPL picks |
| Fetch & cache GW review | Frontend (TanStack Query hook) | — | Standard hook pattern; stale data is safe (GW settled) |
| GW pill toggle state | Browser / Client | — | Session-only UI state; no persistence needed |
| Display review card | Browser / Client | — | Stateless render of `GwReview` type |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.95.2 | Data fetching + caching for `useGwReview` | Already in use; `staleTime` pattern established |
| `@vercel/blob` | ^2.3.1 | `list()` + `fetch()` in API route | Already used in insights, prose-summary, price-changes routes |
| Next.js API route | 16.2.1 | `GET /api/gw-review` | All blob-backed routes are Next.js API routes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Validate `?gw=` and `?teamId=` query params | Used in prose-summary POST; use for input validation in gw-review GET |

No new dependencies required. [VERIFIED: package.json]

**Version verification:** All packages are already installed — no `npm install` step needed.

---

## Architecture Patterns

### System Architecture Diagram

```
Pipeline run.py
  ├── bootstrap['events'] → filter finished == True → last 3
  └── for each finished GW:
        { gw, average_score: event['average_entry_score'] }
        → save('gw_review_gw{N}.json', data)
              ├── [USE_BLOB=false] pipeline/cache/gw_review_gw{N}.json
              └── [USE_BLOB=true]  Vercel Blob: gw_review_gw{N}.json

GET /api/gw-review?teamId=123&gw=34
  ├── Step 1: Read gw_review_gw{N}.json
  │     ├── [USE_BLOB=true]  list(prefix='gw_review_gw{N}.json') → fetch blob URL
  │     └── [USE_BLOB=false] readFile(pipeline/cache/gw_review_gw{N}.json)
  ├── Step 2: Fetch FPL picks on-demand
  │     └── /api/fpl/entry/{teamId}/event/{gw}/picks/
  │           → entry_history: { points, points_on_bench }
  │           → picks: [{ element, position, multiplier, is_captain, total_points }]
  ├── Step 3: Compute team-specific metrics
  │     ├── your_score = entry_history.points
  │     ├── bench_pts_left = entry_history.points_on_bench
  │     ├── captain_delta = (optimal_captain_pts × 2) − (your_captain_pts × multiplier)
  │     └── top_scorer = max(picks where position <= 11, by total_points)
  └── Return: GwReview JSON (merged)

useGwReview(teamId, gw)  →  GET /api/gw-review?teamId=&gw=
  └── GwReviewTab renders review card + GW pill toggle
```

### Recommended Project Structure

```
pipeline/
├── run.py                        # NEW: gw_review writer block (after price_changes block)
├── cache/
│   ├── gw_review_gw{N}.json     # NEW: seed files × 3 (git add -f)

src/
├── lib/
│   ├── types.ts                  # NEW: GwReview interface
│   └── hooks/
│       └── useGwReview.ts        # NEW: TanStack Query hook
├── app/
│   ├── page.tsx                  # MODIFIED: SubTab union + SECTIONS entry + render guard
│   └── api/
│       └── gw-review/
│           └── route.ts          # NEW: GET handler
└── components/
    └── squad/
        └── GwReviewTab.tsx       # NEW: Review tab component
        └── GwReviewTab.test.tsx  # NEW: RTL tests
```

### Pattern 1: Blob-backed GET API Route

Exact pattern from `src/app/api/insights/route.ts` — copy verbatim and add `?gw=` query parameter handling. [VERIFIED: codebase read]

```typescript
// Source: src/app/api/insights/route.ts (adapted)
import { list } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { NextRequest } from 'next/server'

const USE_BLOB = process.env.USE_BLOB?.toLowerCase() === 'true'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gw = searchParams.get('gw')
  const teamId = searchParams.get('teamId')

  // Validate inputs before touching Blob or FPL proxy
  if (!gw || !/^\d+$/.test(gw)) {
    return Response.json({ error: 'Invalid gw parameter' }, { status: 400 })
  }
  if (!teamId || !/^\d+$/.test(teamId)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }

  const filename = `gw_review_gw${gw}.json`
  let blobData: string

  if (USE_BLOB) {
    const { blobs } = await list({ prefix: filename, limit: 1 })
    if (!blobs.length) {
      return Response.json({ error: 'GW review not available' }, { status: 404 })
    }
    const res = await fetch(blobs[0].url)
    if (!res.ok) {
      return Response.json({ error: `Blob fetch failed: ${res.status}` }, { status: 502 })
    }
    blobData = await res.text()
  } else {
    const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
    blobData = await readFile(cachePath, 'utf-8')
  }

  const reviewBase = JSON.parse(blobData)
  if (reviewBase.gw === null) {
    return Response.json({ error: 'GW not yet settled' }, { status: 503 })
  }

  // Fetch FPL picks on-demand
  const picksRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/fpl/entry/${teamId}/event/${gw}/picks/`
  )
  // ... merge and return
}
```

### Pattern 2: TanStack Query Hook with teamId + GW state

```typescript
// Source: pattern derived from src/lib/hooks/useChipHistory.ts + useSquad.ts
import { useQuery } from '@tanstack/react-query'
import type { GwReview } from '../types'

export function useGwReview(teamId: string | null, gw: number | null) {
  return useQuery<GwReview>({
    queryKey: ['gw-review', teamId, gw],
    queryFn: async () => {
      const res = await fetch(`/api/gw-review?teamId=${teamId}&gw=${gw}`)
      if (!res.ok) throw new Error(`GW review fetch failed: ${res.status}`)
      return res.json()
    },
    enabled: !!teamId && /^\d+$/.test(teamId) && gw !== null,
    staleTime: 1000 * 60 * 30,  // 30 min — settled GW scores don't change
    retry: 1,
  })
}
```

### Pattern 3: Pipeline Writer Block

```python
# Source: pipeline/run.py pattern (after price_changes block — mirrors price_changes writer)
# D-10: Sliding window of last 3 finished GWs
finished_events = [e for e in bootstrap.get('events', []) if e.get('finished')]
last_3_gws = sorted(finished_events, key=lambda e: e['id'])[-3:]
for event in last_3_gws:
    gw_data = {
        'gw': event['id'],
        'average_score': event.get('average_entry_score', 0),
    }
    save(f'gw_review_gw{event["id"]}.json', gw_data)
print(f"GW review files written: {[e['id'] for e in last_3_gws]}")
```

### Pattern 4: page.tsx Wiring

Follows the exact 4-change pattern from Phase 72 (`lineup` sub-tab): [VERIFIED: codebase read]

1. Add `'review'` to `SubTab` union type
2. Add `{ id: 'review' as SubTab, label: 'Review', mobileLabel: 'Review' }` to Squad's `subTabs` array after `'lineup'`
3. Add render guard: `{activeSection === 'squad' && activeSubTab === 'review' && (<GwReviewTab teamId={submittedId ?? ''} />)}`
4. Add import for `GwReviewTab`

### Pattern 5: Seed Files (Cold Start)

```
pipeline/cache/gw_review_gw33.json  →  { "gw": null }
pipeline/cache/gw_review_gw34.json  →  { "gw": null }
pipeline/cache/gw_review_gw35.json  →  { "gw": null }
```

Requires `git add -f pipeline/cache/gw_review_gw*.json` because `pipeline/cache/` is in `.gitignore` (line 44). [VERIFIED: .gitignore read]

### Anti-Patterns to Avoid

- **Fetching picks in the pipeline:** Picks data is team-specific; pipeline is global. Never write team-specific data to Blob (see D-01, deferred items).
- **Re-computing bench_pts from individual player totals:** FPL provides `entry_history.points_on_bench` directly. Use it. (D-05)
- **Calling `/api/fpl/` internally with a relative URL in production:** Next.js API routes cannot call themselves with relative URLs in some deployment contexts. Use `process.env.NEXT_PUBLIC_BASE_URL` or pass the internal URL as an absolute URL, OR call the FPL base directly from within the route handler (skipping the proxy layer).
- **Using a dynamic Tailwind class for the delta color:** Use inline style or a conditional class string. Tailwind JIT does not generate classes for dynamic values.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob listing + fetch | Custom blob client | `@vercel/blob` `list()` | Pattern already in 3 routes; edge cases handled |
| FPL data fetching | Direct FPL HTTP in route | Existing `/api/fpl/[...proxy]` | User-Agent headers, error normalisation already there |
| Data caching on client | Custom cache | TanStack Query `staleTime` | Cache invalidation, loading/error states free |
| Input validation | Custom regex-only | Zod schema on query params | Already used in prose-summary; consistent pattern |

**Key insight:** Every building block for this phase already exists in the codebase. The implementation task is assembly, not invention.

---

## Common Pitfalls

### Pitfall 1: Internal self-fetch in API route
**What goes wrong:** `GET /api/gw-review` calls `fetch('/api/fpl/...')` with a relative URL. This works in dev but fails in some serverless deployment environments where there is no loopback listener.
**Why it happens:** Next.js docs recommend absolute URLs for server-side fetch. [ASSUMED]
**How to avoid:** Two safe options: (a) fetch the FPL upstream directly in the route handler (copy the base URL + headers pattern from `pipeline/fpl_client.py`), or (b) use `process.env.NEXT_PUBLIC_BASE_URL` to build an absolute URL. Option (a) is simpler and avoids a second Next.js function invocation.
**Warning signs:** Works in `next dev`, fails on Vercel deployment.

### Pitfall 2: `list()` prefix exact match vs prefix match
**What goes wrong:** `list({ prefix: 'gw_review_gw34.json' })` matches `gw_review_gw34.json` AND any blob whose name starts with that string (e.g., `gw_review_gw340.json` if GW 340 ever existed).
**Why it happens:** Vercel Blob `list()` does prefix matching, not exact matching. [VERIFIED: insights route uses `limit: 1`]
**How to avoid:** Use `limit: 1` (already the convention) and verify `blobs[0].pathname === filename` as a safety check, or name files with a trailing delimiter (e.g., use GW IDs that won't collide in practice — GW numbers are 1-38).

### Pitfall 3: Captain multiplier vs points doubling
**What goes wrong:** Triple Captain chip sets `multiplier: 3`. The captain delta formula must use `captain_multiplier` (the actual pick multiplier), not hardcode `2`.
**Why it happens:** D-06 says `your_captain_pts × captain_multiplier` — the multiplier comes from the picks response, not a constant.
**How to avoid:** Use `pick.multiplier` where `pick.is_captain === true`. [VERIFIED: D-06 in CONTEXT.md]

### Pitfall 4: MobileNav test fails after adding 5th Squad sub-tab
**What goes wrong:** `MobileNav.test.tsx` line 70 explicitly asserts "4 pills" and checks for exactly `Decision`, `Transfers`, `Optimiser`, `Lineup`. Adding `Review` makes the count assertion fail.
**Why it happens:** Every previous Squad sub-tab addition (Phase 72) updated this test. Phase 73 must do the same.
**How to avoid:** Update the MobileNav test in the same plan/commit as the `page.tsx` SECTIONS change. The test description string "4 pills" must become "5 pills" and the filter array must include `'Review'`.

### Pitfall 5: seed files need `git add -f`
**What goes wrong:** `pipeline/cache/` is gitignored (`.gitignore` line 44). Seed files committed without `-f` are silently not tracked, so fresh checkouts get 500 on cold start.
**Why it happens:** gitignore applies even to `git add`.
**How to avoid:** All seed file additions use `git add -f pipeline/cache/gw_review_gw*.json`. This is documented in D-04 and established precedent from Phase 54. [VERIFIED: Phase 54 notes + .gitignore]

### Pitfall 6: `save()` in pipeline writes single-filename blobs — no accumulation
**What goes wrong:** Calling `save('gw_review_gw34.json', data)` overwrites any previous `gw_review_gw34.json` blob. This is the intended behaviour (D-10: overwritten each run), but it means there is no history accumulation.
**Why it happens:** `upload.py` uses `allowOverwrite: True`. [VERIFIED: upload.py]
**How to avoid:** This is correct by design. No action needed. Document it so a future developer doesn't "fix" it.

---

## Code Examples

### FPL Picks Response Shape

```typescript
// Source: D-05, D-06, D-07 in CONTEXT.md + FPL API observation [ASSUMED: field names]
interface FPLPicksResponse {
  entry_history: {
    points: number              // your GW score
    points_on_bench: number     // bench pts left (FPL computes directly)
    event: number               // GW number
  }
  picks: Array<{
    element: number             // player ID
    position: number            // 1-11 = starting XI, 12-15 = bench
    multiplier: number          // 1 = normal, 2 = captain, 3 = triple captain
    is_captain: boolean
    is_vice_captain: boolean
    total_points: number        // actual GW points (settled score)
  }>
}
```

### GwReview TypeScript Type

```typescript
// Discretion-area type: planner may adjust field names
export interface GwReview {
  gw: number
  your_score: number
  bench_pts_left: number
  captain_name: string
  optimal_captain_name: string
  captain_delta: number       // positive = you missed points; 0 = optimal pick
  top_scorer_name: string
  top_scorer_pts: number
  average_score: number       // "FPL average" label; from Blob
}
```

### Captain Delta Computation

```typescript
// Source: D-06 in CONTEXT.md
const starters = picks.filter(p => p.position <= 11)
const yourCaptain = starters.find(p => p.is_captain)!
const optimalCaptain = starters.reduce((best, p) =>
  p.total_points > best.total_points ? p : best
)
const captainDelta =
  (optimalCaptain.total_points * 2) -
  (yourCaptain.total_points * yourCaptain.multiplier)
// If you held TC and optimal was also your captain, delta = total_points*2 - total_points*3 = negative
// Clamp to 0 if optimal == your captain (delta should be 0 in that case, but floating point safety)
```

### GW Pill Toggle (React)

```tsx
// Pattern: consistent with GwToggle.tsx 1/3/5 toggle (adapt for GW numbers)
const [selectedGw, setSelectedGw] = useState<number>(settledGws[settledGws.length - 1])

<div className="flex gap-1">
  {settledGws.map(gw => (
    <button
      key={gw}
      onClick={() => setSelectedGw(gw)}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors
        ${selectedGw === gw
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
        }`}
    >
      GW{gw}
    </button>
  ))}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded stale GW numbers | Detect last 3 finished via `bootstrap['events']` | D-01 (this phase) | Always current without manual update |
| Single-GW display | 3-GW sliding window with pill toggle | D-09 (this phase) | Retrospective learning across recent GWs |

---

## Open Questions

1. **Internal self-call vs direct FPL fetch in API route**
   - What we know: Relative-URL self-calls can fail in serverless
   - What's unclear: Whether the existing squad/picks API routes use self-call internally
   - Recommendation: Check `src/app/api/squad/` route pattern; if it calls `/api/fpl/` via absolute URL, follow that. Otherwise call FPL upstream directly in the gw-review route.

2. **GW numbers in seed files**
   - What we know: GW 33/34/35 are referenced in CONTEXT.md as examples
   - What's unclear: Exact current finished GW numbers at planning time
   - Recommendation: Seed files can use placeholder GW numbers (e.g., 33, 34, 35). They are overwritten on first pipeline run. The important thing is that 3 seed files exist with `{ gw: null }`.

3. **`average_entry_score` field presence in bootstrap events**
   - What we know: D-08 says it equals `bootstrap.events[gw].average_entry_score` [ASSUMED]
   - What's unclear: Whether the field is `null` or `0` for unsettled GWs
   - Recommendation: Guard with `event.get('average_entry_score') or 0` in Python.

---

## Environment Availability

Step 2.6: No new external dependencies introduced. All tools, runtimes, and services required for this phase are already available in the project environment.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@vercel/blob` | API route Blob reads | Yes | ^2.3.1 | Local cache path |
| `@tanstack/react-query` | `useGwReview` hook | Yes | ^5.95.2 | — |
| FPL public API | Picks endpoint | Yes (proxied) | Public | — |
| Python `run.py` | Pipeline writer block | Yes | — | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/squad/GwReviewTab.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PGW-01 | Review card renders your_score, bench_pts_left, captain_delta, top_scorer, average_score | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | No — Wave 0 |
| PGW-01 | No-squad empty state renders "Load your squad" message | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | No — Wave 0 |
| PGW-01 | Unsettled GW renders "GW review will appear once scores finalise" | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | No — Wave 0 |
| PGW-01 | GW pill toggle switches active GW and triggers new query | unit (RTL) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | No — Wave 0 |
| PGW-02 | MobileNav shows 5 Squad pills including "Review" | unit (RTL) | `npx vitest run src/components/nav/MobileNav.test.tsx` | Exists — needs update |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/squad/GwReviewTab.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/squad/GwReviewTab.test.tsx` — covers PGW-01 (4 test cases)
- [ ] `src/lib/hooks/useGwReview.ts` — created in Wave 1 (not a test gap, a file gap)
- MobileNav.test.tsx exists but must be updated to expect 5 Squad pills

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Past GW picks are public — no auth required |
| V3 Session Management | No | Stateless GET route |
| V4 Access Control | No | teamId is not a secret; any teamId can view any past GW |
| V5 Input Validation | Yes | Numeric guard on `teamId` and `gw` query params (T-34-01 mitigation) |
| V6 Cryptography | No | No secrets involved |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via teamId in proxy path | Tampering | `/^\d+$/.test(teamId)` guard — same as T-34-01 in useChipHistory.ts |
| Path traversal via gw param | Tampering | `/^\d+$/.test(gw)` guard prevents `../` sequences |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bootstrap.events[*].average_entry_score` is the field name for FPL average score | Pipeline pattern, Code Examples | Pipeline writes wrong field; API returns 0 for average_score |
| A2 | Past GW picks (`entry/{teamId}/event/{gw}/picks/`) are fully public (no auth) | Architecture, Security | API route gets 403; would need auth token handling |
| A3 | Internal self-fetch (relative URL) may fail in serverless | Pitfall 1 | Only a deployment concern; dev works fine |
| A4 | FPL `picks` response `total_points` is populated for settled GWs | Code Examples | Captain delta / top scorer always returns 0 |

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/insights/route.ts` — canonical USE_BLOB pattern [VERIFIED: codebase read]
- `src/app/api/prose-summary/route.ts` — Phase 67 Blob GET pattern [VERIFIED: codebase read]
- `src/lib/hooks/useChipHistory.ts` — T-34-01 numeric guard pattern [VERIFIED: codebase read]
- `src/app/page.tsx` — SECTIONS constant, SubTab union, render guard pattern [VERIFIED: codebase read]
- `src/components/squad/LineupTab.tsx` — structural template for Squad sub-tabs [VERIFIED: codebase read]
- `pipeline/run.py` — pipeline writer block insertion point, save() pattern [VERIFIED: codebase read]
- `pipeline/upload.py` — save() routing logic, allowOverwrite behavior [VERIFIED: codebase read]
- `.gitignore` line 44 — confirms `pipeline/cache/` is gitignored [VERIFIED: codebase read]
- `src/components/nav/MobileNav.test.tsx` — confirms Squad pill count assertion must be updated [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- FPL API `entry/{teamId}/event/{gw}/picks/` field names — derived from CONTEXT.md D-05/D-06/D-07 + project history patterns

### Tertiary (LOW confidence / ASSUMED)

- `average_entry_score` exact field name in `bootstrap.events` (A1) — needs verification against live bootstrap response

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies already in package.json
- Architecture: HIGH — exact templates exist in codebase for every layer
- Pitfalls: HIGH — derived from verified codebase patterns and Phase 54/72 precedents
- FPL API field names: MEDIUM — derived from CONTEXT.md decisions, not live API inspection

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable stack; only risk is FPL API field name change — LOW probability)
