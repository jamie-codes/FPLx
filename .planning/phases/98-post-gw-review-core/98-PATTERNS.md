# Phase 98: Post-GW Review Core - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 7 (5 modified, 1 new source file, 1 new test file + 2 new test cases in existing files)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/hooks/useSettledGws.ts` | hook | request-response | `src/lib/hooks/useGwReview.ts` | exact |
| `src/lib/fpl-adapter.ts` | schema/utility | transform | `src/lib/fpl-adapter.ts` itself (field extension) | self |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` itself (interface extension) | self |
| `src/app/api/gw-review/route.ts` | API route handler | request-response + CRUD | `src/app/api/gw-review/route.ts` itself (extension) | self |
| `src/components/squad/GwReviewTab.tsx` | component | request-response | `src/components/squad/GwReviewTab.tsx` itself (row addition) | self |
| `src/app/page.tsx` | page / orchestrator | event-driven | `src/app/page.tsx` itself (hook swap + useEffect) | self |
| `src/lib/hooks/useSettledGws.test.ts` | test | — | `src/lib/hooks/useDecisionHistory.test.ts` | exact |
| `src/app/api/gw-review/route.test.ts` | test | — | `src/components/squad/GwReviewTab.test.tsx` (mock + assert pattern) | role-match |

---

## Pattern Assignments

### `src/lib/hooks/useSettledGws.ts` (hook, request-response) [NEW FILE]

**Analog:** `src/lib/hooks/useGwReview.ts` (lines 1–39) — exact structural match.

**Imports pattern** (analog lines 1–2):
```typescript
import { useQuery } from '@tanstack/react-query'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'
```

**Fetch function pattern** (analog lines 14–25, adapted):
```typescript
async function fetchSettledGws(): Promise<number[]> {
  const res = await fetch('/api/fpl/bootstrap-static/')
  if (!res.ok) {
    const err = new Error(`bootstrap fetch failed: ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const raw = await res.json()
  const parsed = parseFPLBootstrap(raw)
  if (!parsed.success) throw new Error('bootstrap parse failed')
  const settled = parsed.data.events
    .filter(e => e.finished && e.data_checked)
    .map(e => e.id)
  return settled.slice(-3) // last 3 settled GWs ascending (D-07)
}
```

**Hook export pattern** (analog lines 27–39, adapted):
```typescript
export function useSettledGws() {
  return useQuery<number[]>({
    queryKey: ['settled-gws'],
    queryFn: fetchSettledGws,
    staleTime: 60 * 60 * 1000,  // 1 hour — bootstrap changes at most once per GW
    retry: 1,
  })
}
```

Key differences from `useGwReview`:
- No `enabled` guard (called unconditionally in `page.tsx` — no teamId dependency)
- No `queryKey` params beyond the static key (no teamId/gw pair)
- Returns `number[]` not a complex type
- `staleTime` = 1 hour (vs 30 min in `useGwReview` — bootstrap is slower-moving than picks data)

**Proxy URL source** (`src/lib/hooks/useRivals.ts` line 55, verified):
```typescript
const bootstrapRes = await fetch('/api/fpl/bootstrap-static/')
```

**parseFPLBootstrap usage** (`src/lib/fpl-adapter.ts` line 54 + `useRivals.ts` lines 57–58, verified):
```typescript
const bootstrapParsed = parseFPLBootstrap(bootstrapRaw)
if (!bootstrapParsed.success) throw new Error('...')
const { events } = bootstrapParsed.data
```

---

### `src/lib/fpl-adapter.ts` (schema/utility, transform) [MODIFIED — field extension]

**Analog:** The file itself. Add one field to the existing `FPLEventSchema` object literal and the `FPLEvent` inferred type propagates automatically.

**Existing schema** (lines 33–39):
```typescript
export const FPLEventSchema = z.object({
  id:            z.number().int(),
  is_current:    z.boolean(),
  is_next:       z.boolean(),
  finished:      z.boolean(),
  deadline_time: z.string(),  // ISO 8601 — added Phase 58 D-05 for rival captain deadline gate
})
```

**Extended schema** (add `data_checked` — must be Wave 0 / first task because `useSettledGws` depends on it):
```typescript
export const FPLEventSchema = z.object({
  id:            z.number().int(),
  is_current:    z.boolean(),
  is_next:       z.boolean(),
  finished:      z.boolean(),
  deadline_time: z.string(),
  data_checked:  z.boolean(),  // Phase 98 D-06: confirmed field in FPL bootstrap events
})
```

`FPLBootstrap` (line 47) and `parseFPLBootstrap` (line 54) require no changes — they use `FPLBootstrapSchema` which already includes `events: z.array(FPLEventSchema)`.

**CRITICAL:** Add `data_checked` BEFORE writing `useSettledGws`, or TypeScript will error on `e.data_checked` (`Property 'data_checked' does not exist on type 'FPLEvent'`).

---

### `src/lib/types.ts` (model) [MODIFIED — interface extension]

**Location of `GwReview`:** lines 875–885.

**Existing interface** (lines 875–885):
```typescript
export interface GwReview {
  gw: number
  your_score: number
  bench_pts_left: number           // do NOT recompute from individual picks
  captain_name: string
  optimal_captain_name: string
  captain_delta: number
  top_scorer_name: string
  top_scorer_pts: number
  average_score: number
}
```

**Extended interface** (add two non-optional fields — matching existing field style):
```typescript
export interface GwReview {
  gw: number
  your_score: number
  bench_pts_left: number
  captain_name: string
  optimal_captain_name: string
  captain_delta: number
  top_scorer_name: string
  top_scorer_pts: number
  average_score: number
  best_bench_player_name: string   // Phase 98 PGW-01: web_name of highest-scoring bench pick
  best_bench_player_pts: number    // Phase 98 PGW-01: that pick's total_points
}
```

**Non-optional convention** confirmed: all existing `GwReview` fields are non-optional. Edge cases handled in the route (fallback to `'—'` / `0`) not in the type. Also add `data_checked: boolean` to `FPLEvent` interface (lines 43–49):

```typescript
export interface FPLEvent {
  id: number
  is_current: boolean
  is_next: boolean
  finished: boolean
  deadline_time: string
  data_checked: boolean  // Phase 98 D-06: gate for settled GW detection
}
```

---

### `src/app/api/gw-review/route.ts` (API route, request-response + CRUD) [MODIFIED]

**Analog:** The file itself. The existing Step 4 block (lines 138–170) is the template.

**Existing starters computation** (lines 139–151, template to follow for bench):
```typescript
const starters = picks.filter((p) => p.position <= 11)
// ...
const optimalCaptain = starters.reduce(
  (best, p) => (p.total_points > best.total_points ? p : best),
  starters[0]
)
```

**New bench computation** (insert after starters block, before `const review`):
```typescript
const benchPicks = picks.filter((p) => p.position > 11)
const bestBench = benchPicks.length > 0
  ? benchPicks.reduce((best, p) => (p.total_points > best.total_points ? p : best), benchPicks[0])
  : null
```

**Existing `review` object** (lines 160–170 — add two fields):
```typescript
const review: GwReview = {
  gw,
  your_score: entryHistory.points,
  bench_pts_left: entryHistory.points_on_bench,
  captain_name: elementMap.get(yourCaptain.element) ?? `Player ${yourCaptain.element}`,
  optimal_captain_name: elementMap.get(optimalCaptain.element) ?? `Player ${optimalCaptain.element}`,
  captain_delta: captainDelta,
  top_scorer_name: elementMap.get(topScorer.element) ?? `Player ${topScorer.element}`,
  top_scorer_pts: topScorer.total_points,
  average_score: averageScore,
  // ADD:
  best_bench_player_name: bestBench
    ? (elementMap.get(bestBench.element) ?? `Player ${bestBench.element}`)
    : '—',
  best_bench_player_pts: bestBench?.total_points ?? 0,
}
```

**Error handling pattern** (lines 77–83, already established — copy for bench guard is not needed since `benchPicks.length > 0` check handles empty case):
```typescript
} catch (err) {
  const code = (err as NodeJS.ErrnoException)?.code
  if (code === 'ENOENT') {
    return Response.json({ error: 'GW review not available' }, { status: 404 })
  }
  return Response.json({ error: 'Failed to read GW review' }, { status: 500 })
}
```

**PITFALL:** Do NOT recompute `bench_pts_left` from bench picks. `bench_pts_left = entryHistory.points_on_bench` is unchanged. `best_bench_player_pts` is a separate field derived from individual bench pick `total_points`.

---

### `src/components/squad/GwReviewTab.tsx` (component, request-response) [MODIFIED]

**Analog:** The file itself. Add a third info row below the existing "Top scorer" (line 174) and "Captain" (line 181) rows.

**Existing "Top scorer" row** (lines 174–179 — exact template for "Best bench"):
```tsx
<div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2">
  <span className="text-xs text-zinc-500 dark:text-zinc-400">Top scorer</span>
  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
    {review.top_scorer_name} - {review.top_scorer_pts}pts
  </span>
</div>
```

**New "Best bench" row** (insert after "Captain" row closing `</div>` at line 191):
```tsx
<div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2">
  <span className="text-xs text-zinc-500 dark:text-zinc-400">Best bench</span>
  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
    {review.best_bench_player_name} — {review.best_bench_player_pts}pts
  </span>
</div>
```

**Key style note:** Use the simpler non-wrapping class (`flex items-baseline gap-2`) matching "Top scorer", not the `flex flex-wrap items-baseline gap-2` used by "Captain". Separator for "Best bench" is em dash (—), not hyphen (-) used in "Top scorer" — matches D-08 spec.

**sampleReview in test file** (line 15–25 of `GwReviewTab.test.tsx`) will need `best_bench_player_name` and `best_bench_player_pts` added when adding new test cases for PGW-01.

---

### `src/app/page.tsx` (page/orchestrator, event-driven) [MODIFIED]

**Import addition** (after line 32, following existing hook import pattern):
```typescript
import { useSettledGws } from '@/lib/hooks/useSettledGws'
```

**Placeholder removal and hook invocation** (replace line 40, inside `Home()` component body — after the `useState` declarations):
```typescript
// Replace: const SETTLED_GWS_PLACEHOLDER: number[] = [33, 34, 35]
// With (inside Home() function, near other hooks):
const { data: settledGws = [] } = useSettledGws()
```

**GwReviewTab prop update** (line 256 — swap constant for live data):
```typescript
// Before:
<GwReviewTab teamId={submittedId ?? ''} settledGws={SETTLED_GWS_PLACEHOLDER} />
// After:
<GwReviewTab teamId={submittedId ?? ''} settledGws={settledGws} />
```

**PGW-04 auto-surface useEffect** (insert after state declarations, inside `Home()` — pattern from `useDecisionHistory.ts` lines 53–59):
```typescript
useEffect(() => {
  if (settledGws.length === 0) return
  const latestGw = settledGws[settledGws.length - 1]
  const key = `pgw-reviewed:GW${latestGw}`
  try {
    if (localStorage.getItem(key)) return
    setActiveSection('squad')
    setSectionMemory(prev => ({ ...prev, squad: 'review' }))
    localStorage.setItem(key, '1')
  } catch {
    // localStorage unavailable (SSR / private browsing) — skip silently
  }
}, [settledGws])
```

**State setter patterns** (lines 108–113 — confirmed names in scope):
```typescript
const [activeSection, setActiveSection] = useState<Section>('analyse')
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems',
  plan: 'planner',
  squad: 'decision',
})
```

**CRITICAL PITFALL:** `setActiveSubTab` does NOT exist. Sub-tab navigation is `setSectionMemory(prev => ({ ...prev, squad: 'review' }))`. TypeScript will error immediately if `setActiveSubTab` is used.

**Import: add `useEffect`** to the React import on line 3:
```typescript
import { useState, useCallback, Component, useEffect } from 'react'
```

---

### `src/lib/hooks/useSettledGws.test.ts` (test) [NEW FILE]

**Analog:** `src/lib/hooks/useDecisionHistory.test.ts` (lines 1–97) — exact structural match.

**Test file header and imports** (analog lines 1–14):
```typescript
// @vitest-environment jsdom
// Phase 98 PGW-04 — useSettledGws hook contract.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useSettledGws } from './useSettledGws'
```

**QueryClient wrapper factory** (analog lines 16–19):
```typescript
function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}
```

**Bootstrap payload factory** (adapt from `useRivals.test.ts` lines 17–25):
```typescript
function bootstrapPayload(events: Array<{ id: number; finished: boolean; data_checked: boolean }>) {
  return {
    elements: [],
    teams: [],
    events: events.map(e => ({
      ...e,
      is_current: false,
      is_next: false,
      deadline_time: '2026-01-01T11:00:00Z',
    })),
  }
}
```

**Fetch mock pattern** (analog lines 32–38 — `vi.stubGlobal` + `vi.unstubAllGlobals`):
```typescript
beforeEach(() => { window.localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); window.localStorage.clear() })
```

**Test cases to cover** (PGW-04 per RESEARCH.md Validation Architecture):
1. Returns empty array when no settled GWs exist (both flags false on all events)
2. Filters correctly — only `finished === true && data_checked === true`
3. Returns last 3 GWs in ascending order when >3 settled exist (D-07)
4. Fetch disabled when bootstrap returns non-ok status (error thrown)

---

### `src/app/api/gw-review/route.test.ts` (test) [NEW FILE]

**Analog:** `src/components/squad/GwReviewTab.test.tsx` (mock + assert structure).

This is an API route test (Next.js route handler), not a React component test. Pattern differs: call the exported `GET` function with a mocked `NextRequest`.

**Imports and mock setup**:
```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'
```

**Mock `fetch` for upstream FPL calls:**
```typescript
// Mock global fetch to return picks + bootstrap payloads
vi.stubGlobal('fetch', vi.fn())
```

**Request factory pattern** (NextRequest with query params):
```typescript
function makeRequest(teamId: string, gw: string) {
  return new NextRequest(`http://localhost/api/gw-review?teamId=${teamId}&gw=${gw}`)
}
```

**Test cases** (PGW-01 per RESEARCH.md Validation Architecture):
1. Returns `best_bench_player_name` and `best_bench_player_pts` from bench picks (position > 11)
2. Returns `'—'` and `0` when bench picks array is empty (Pitfall 5 edge case)
3. Identifies the highest-scoring bench player (not simply the first in position order)

---

### New test cases in `src/components/squad/GwReviewTab.test.tsx` (MODIFIED)

**Analog:** Existing tests in the file (lines 59–77 — `mockSuccess` + render + `container.textContent` assertions).

**Extend `sampleReview`** (line 15–25 — add two fields):
```typescript
const sampleReview: GwReview = {
  // ...existing fields...
  best_bench_player_name: 'Watkins',
  best_bench_player_pts: 9,
}
```

**New test cases** (add inside existing `describe` block):
```typescript
it('renders "Best bench" row with name and pts when data present (PGW-01)', () => {
  mockSuccess()
  const { container } = render(<GwReviewTab teamId="12345" settledGws={[33, 34, 35]} />)
  expect(container.textContent).toContain('Best bench')
  expect(container.textContent).toContain('Watkins')
  expect(container.textContent).toContain('9pts')
})

it('"Best bench" row absent in empty/error state (PGW-01)', () => {
  // empty state
  const { container } = render(<GwReviewTab teamId="" settledGws={[33, 34, 35]} />)
  expect(container.textContent).not.toContain('Best bench')
})
```

**`page.test.tsx` additions** (add `vi.mock` for `useSettledGws` and an auto-surface test):
```typescript
// At top with other vi.mock calls:
vi.mock('@/lib/hooks/useSettledGws', () => ({
  useSettledGws: () => ({ data: [33, 34, 35] }),
}))
vi.mock('@/components/squad/GwReviewTab', () => ({
  GwReviewTab: (_props: { teamId: string; settledGws: number[] }) => <div data-testid="gw-review-tab-mock" />,
}))
```

---

## Shared Patterns

### TanStack Query hook structure
**Source:** `src/lib/hooks/useGwReview.ts` lines 1–39
**Apply to:** `useSettledGws`
```typescript
// Named export, not default. useQuery with queryKey array, queryFn async function,
// staleTime for caching, retry: 1.
export function useHookName() {
  return useQuery<ReturnType>({
    queryKey: ['key'],
    queryFn: fetchFunction,
    staleTime: N,
    retry: 1,
  })
}
```

### localStorage try/catch pattern
**Source:** `src/app/page.tsx` lines 121–124 (teamId init)
**Apply to:** PGW-04 `useEffect` in `page.tsx`
```typescript
try { return localStorage.getItem('key') ?? '' } catch { return '' }
```
For the useEffect: wrap the entire `localStorage.getItem` + `setItem` block in a single try/catch that silently swallows errors (SSR / private browsing).

### Error response formatting in route handlers
**Source:** `src/app/api/gw-review/route.ts` lines 49–54
**Apply to:** `route.test.ts` assertions
```typescript
return Response.json({ error: 'message' }, { status: NNN })
```

### Test hook wrapper factory
**Source:** `src/lib/hooks/useDecisionHistory.test.ts` lines 16–19
**Apply to:** `useSettledGws.test.ts`
```typescript
function makeWrapper(retries = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: retries, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}
```

### Component test mock hook pattern
**Source:** `src/components/squad/GwReviewTab.test.tsx` lines 8–11
**Apply to:** `page.test.tsx` (mock `useSettledGws`)
```typescript
const mockUseX = vi.fn()
vi.mock('@/lib/hooks/useX', () => ({
  useX: (...args: unknown[]) => mockUseX(...args),
}))
```

---

## No Analog Found

All files in this phase have direct analogs or are self-extensions of existing files.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

---

## Metadata

**Analog search scope:** `src/lib/hooks/`, `src/app/api/gw-review/`, `src/components/squad/`, `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/fpl-adapter.ts`
**Files scanned:** 9 source files read in full
**Pattern extraction date:** 2026-05-12
