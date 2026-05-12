# Phase 98: Post-GW Review Core - Research

**Researched:** 2026-05-12
**Domain:** Next.js 16 / React 19 / TanStack Query v5 — client hook authoring, localStorage state, FPL bootstrap API
**Confidence:** HIGH

## Summary

Phase 98 is a tightly scoped extension to the existing Squad > Review sub-tab. All infrastructure (the `/api/gw-review` route, `useGwReview` hook, `GwReviewTab` component, and `SETTLED_GWS_PLACEHOLDER` in `page.tsx`) was shipped in Phase 73 and is production-ready. The phase adds three incremental changes on top of that foundation:

1. **`useSettledGws` hook** — replaces the hardcoded `SETTLED_GWS_PLACEHOLDER: number[]` with live data derived from FPL bootstrap `events[]`. This is a pure TanStack Query hook (pattern identical to `useGwReview`), fetching through the existing `/api/fpl/[...proxy]` route.

2. **Bench breakdown fields** — adds `best_bench_player_name` and `best_bench_player_pts` to the `GwReview` type and computes them in `/api/gw-review/route.ts` from bench picks (`position > 11`). The picks array is already fetched; only computation and type extension are needed.

3. **PGW-04 auto-surface** — a `useEffect` in `page.tsx` that fires once on mount, reads the latest settled GW from `useSettledGws`, checks `localStorage['pgw-reviewed:GW{N}']`, and if unset calls `setActiveSection('squad')` + `setSectionMemory(prev => ({ ...prev, squad: 'review' }))` before writing the seen flag.

**Primary recommendation:** Follow the `useGwReview` hook template exactly for `useSettledGws`; extend the existing `FPLEventSchema` in `fpl-adapter.ts` to add `data_checked: z.boolean()` (field confirmed present in FPL API but not yet in schema); use `setSectionMemory` (not a non-existent `setActiveSubTab`) for the sub-tab part of auto-navigation.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Auto-navigate = `setActiveSection('squad')` + `setActiveSubTab('review')` in a `useEffect` in `page.tsx`. No banner or additional UI needed.
- **D-02:** Navigate regardless of squad state; existing GwReviewTab empty-state handles graceful degradation.
- **D-03:** One-time per settled GW. Write `localStorage['pgw-reviewed:GW{N}']` immediately when auto-navigation fires.
- **D-04:** Seen flag written at moment of auto-navigation, not on component render or user interaction.
- **D-05:** localStorage key pattern: `pgw-reviewed:GW{N}` (e.g. `pgw-reviewed:GW37`). No TTL.
- **D-06 (Claude's Discretion):** Settled = `event.finished === true && event.data_checked === true`.
- **D-07:** `useSettledGws` returns the last 3 settled GWs in ascending order (matching existing placeholder `[33, 34, 35]` window).
- **D-08:** Display format: keep existing `bench_pts_left` stat card; add new info row below 2×4 grid: "Best bench: {name} — {pts}pts" using identical style to existing "Top scorer" / "Captain" rows.
- **D-09:** API changes: add `best_bench_player_name: string` and `best_bench_player_pts: number` to `GwReview` in `src/lib/types.ts`; compute in `/api/gw-review/route.ts` as `picks.filter(p => p.position > 11)`.

### Claude's Discretion
- Exact `useSettledGws` stale time (suggest 1 hour)
- Whether `useSettledGws` calls `/api/fpl/[...proxy]` or fetches bootstrap directly (prefer proxy for consistency)
- TDD test coverage scope for the auto-surface `useEffect` (unit test via mocked `useSettledGws` + localStorage)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PGW-01 | User can see a post-GW bench summary — highest-scoring bench player's points highlighted, showing how many points were left on the bench that GW | Implemented by adding `best_bench_player_name` + `best_bench_player_pts` to `GwReview` type and `/api/gw-review/route.ts` computation; UI row added to `GwReviewTab` |
| PGW-02 | User can see captain comparison — actual captain points vs the highest-scoring player in their squad that GW | Already fully implemented in Phase 73 (`captain_delta`, `optimal_captain_name`); Phase 98 adds live `settledGws` from `useSettledGws` hook to replace the placeholder so the data is real |
| PGW-04 | Post-GW review card auto-surfaces when the user visits the app after a GW deadline has passed | Implemented by `useEffect` in `page.tsx` + `useSettledGws` hook + `localStorage['pgw-reviewed:GW{N}']` seen-flag |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Settled GW detection | Frontend (client hook) | FPL API (bootstrap-static via proxy) | `useSettledGws` derives settled list client-side from bootstrap events data; no backend needed beyond the existing proxy route |
| Bench player computation | API / Backend (`/api/gw-review`) | — | Bench picks are only fetched server-side in the gw-review route; computation must live there alongside other team-specific metrics |
| Auto-surface navigation | Browser / Client (`page.tsx`) | localStorage | `useEffect` on mount reads settled GW + localStorage flag; all state mutation is client-side |
| "Best bench" row display | Browser / Client (`GwReviewTab`) | — | Pure rendering from data already fetched by `useGwReview` |
| Type extension (`GwReview`) | Shared types (`src/lib/types.ts`) | — | Adding non-optional fields; no tier boundary |

---

## Standard Stack

### Core (already installed — no new dependencies required)

[VERIFIED: package.json] All libraries are already present in the project.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.95.2 | `useSettledGws` data fetching, caching, stale-time | Already used by every hook in this codebase |
| React | 19.2.4 | `useEffect` for auto-surface, `useState` for sectionMemory | The rendering framework |
| Next.js | 16.2.1 | App Router; `/api/fpl/[...proxy]` already exists | Project framework |
| Zod | ^4.3.6 | Extending `FPLEventSchema` to add `data_checked` | Already used by `fpl-adapter.ts` for schema validation |

**No new npm installs needed.** This phase touches only TypeScript/TSX source files.

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser: page.tsx mount]
        |
        v
[useSettledGws hook]
   |-- fetch /api/fpl/bootstrap-static/ (proxy)
   |-- filter events: finished=true AND data_checked=true
   |-- return last 3 GW ids (ascending) as number[]
        |
        v
[useEffect in page.tsx]
   |-- read settledGws[last] (latest settled GW number)
   |-- check localStorage['pgw-reviewed:GW{N}']
   |   |-- key found --> skip
   |   |-- key missing --> setActiveSection('squad')
   |                       setSectionMemory({...prev, squad: 'review'})
   |                       localStorage.setItem('pgw-reviewed:GW{N}', '1')
        |
        v
[GwReviewTab render]
   |-- receives settledGws (now live, not placeholder)
   |-- useGwReview(teamId, selectedGw) --> /api/gw-review?teamId=&gw=N
        |
        v
[/api/gw-review route]
   |-- reads gw_review_gw{N}.json (blob/local)
   |-- fetches FPL picks (position > 11 = bench)
   |-- computes: best_bench_player_name, best_bench_player_pts  [NEW - PGW-01]
   |-- fetches FPL bootstrap for elementMap (web_name lookup)
   |-- returns GwReview (extended with 2 new fields)
        |
        v
[GwReviewTab data-rendered branch]
   |-- existing 2×4 stat grid (bench_pts_left card unchanged)
   |-- existing "Top scorer" row
   |-- existing "Captain" row
   |-- NEW "Best bench: {name} — {pts}pts" row  [PGW-01]
```

### Recommended Project Structure

No new directories needed. All changes are file-level:

```
src/
├── lib/
│   ├── hooks/
│   │   ├── useSettledGws.ts          [NEW — hook for settled GW list]
│   │   └── useGwReview.ts            [unchanged]
│   ├── types.ts                      [extend GwReview interface]
│   └── fpl-adapter.ts                [extend FPLEventSchema with data_checked]
├── components/squad/
│   └── GwReviewTab.tsx               [add "Best bench" row]
└── app/
    ├── page.tsx                      [replace placeholder, add useEffect]
    └── api/gw-review/route.ts        [compute bench fields]
```

### Pattern 1: useSettledGws Hook (mirrors useGwReview exactly)

**What:** TanStack Query hook that fetches bootstrap events and returns the last 3 settled GW IDs.
**When to use:** Called unconditionally in `page.tsx`; provides live replacement for `SETTLED_GWS_PLACEHOLDER`.

```typescript
// Source: mirrors src/lib/hooks/useGwReview.ts [VERIFIED: read from codebase]
import { useQuery } from '@tanstack/react-query'
import { parseFPLBootstrap } from '@/lib/fpl-adapter'

async function fetchSettledGws(): Promise<number[]> {
  const res = await fetch('/api/fpl/bootstrap-static/')
  if (!res.ok) throw new Error(`bootstrap fetch failed: ${res.status}`)
  const raw = await res.json()
  const parsed = parseFPLBootstrap(raw)
  if (!parsed.success) throw new Error('bootstrap parse failed')
  const settled = parsed.data.events
    .filter(e => e.finished && e.data_checked)
    .map(e => e.id)
  // Return last 3 settled GWs in ascending order (D-07)
  return settled.slice(-3)
}

export function useSettledGws() {
  return useQuery<number[]>({
    queryKey: ['settled-gws'],
    queryFn: fetchSettledGws,
    staleTime: 60 * 60 * 1000,  // 1 hour — bootstrap changes at most once per GW
    retry: 1,
  })
}
```

### Pattern 2: FPLEventSchema Extension for data_checked

**What:** `data_checked` is a confirmed real FPL bootstrap field but missing from the existing Zod schema and TypeScript interface.
**When to use:** Must be added FIRST (Wave 0 or Wave 1 task 1) so the type is available to `useSettledGws`.

```typescript
// Source: src/lib/fpl-adapter.ts [VERIFIED: read from codebase]
// Current schema (missing data_checked):
export const FPLEventSchema = z.object({
  id:            z.number().int(),
  is_current:    z.boolean(),
  is_next:       z.boolean(),
  finished:      z.boolean(),
  deadline_time: z.string(),
})

// Extended schema (add this field):
export const FPLEventSchema = z.object({
  id:            z.number().int(),
  is_current:    z.boolean(),
  is_next:       z.boolean(),
  finished:      z.boolean(),
  deadline_time: z.string(),
  data_checked:  z.boolean(),   // ADD: confirmed field in FPL bootstrap events
})
```

The `FPLEvent` interface in `src/lib/types.ts` (lines 43-49) must also be extended:
```typescript
export interface FPLEvent {
  id: number
  is_current: boolean
  is_next: boolean
  finished: boolean
  deadline_time: string
  data_checked: boolean  // ADD
}
```

### Pattern 3: PGW-04 Auto-Surface useEffect

**Critical implementation detail:** The CONTEXT.md describes calling `setActiveSubTab('review')` but this function does NOT exist in `page.tsx`. [VERIFIED: read from codebase] The actual state model uses `sectionMemory` (a `Record<Section, SubTab | null>`). The correct implementation uses `setSectionMemory`:

```typescript
// Source: src/app/page.tsx state model [VERIFIED: read from codebase]
// These ARE available in page.tsx:
//   setActiveSection (setter for activeSection: Section)
//   setSectionMemory (setter for sectionMemory: Record<Section, SubTab | null>)
// This does NOT exist:
//   setActiveSubTab (no such function — sub-tab lives in sectionMemory)

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
// Note: setActiveSection and setSectionMemory are stable (setState functions)
// and are NOT required as deps by React's rules-of-hooks — include them for
// correctness if linter requires.
```

### Pattern 4: Bench Computation in /api/gw-review/route.ts

**What:** Bench picks are `picks.filter(p => p.position > 11)`. The best bench player is the one with the highest `total_points` among bench picks. This uses the SAME `elementMap` already available in the route for name lookup.

```typescript
// Source: pattern derived from existing route logic [VERIFIED: read from codebase]
// After const starters = picks.filter((p) => p.position <= 11)
const benchPicks = picks.filter((p) => p.position > 11)
const bestBench = benchPicks.length > 0
  ? benchPicks.reduce((best, p) => (p.total_points > best.total_points ? p : best), benchPicks[0])
  : null

// In the review object:
const review: GwReview = {
  // ...existing fields...
  best_bench_player_name: bestBench
    ? (elementMap.get(bestBench.element) ?? `Player ${bestBench.element}`)
    : '—',
  best_bench_player_pts: bestBench?.total_points ?? 0,
}
```

### Pattern 5: "Best bench" Row in GwReviewTab

Replicate the exact className of the existing "Top scorer" and "Captain" rows (D-08):

```tsx
// Source: src/components/squad/GwReviewTab.tsx lines 174-179 [VERIFIED: read from codebase]
// Existing row (template to copy):
<div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2">
  <span className="text-xs text-zinc-500 dark:text-zinc-400">Top scorer</span>
  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
    {review.top_scorer_name} - {review.top_scorer_pts}pts
  </span>
</div>

// New "Best bench" row (add after Captain row):
<div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2">
  <span className="text-xs text-zinc-500 dark:text-zinc-400">Best bench</span>
  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
    {review.best_bench_player_name} — {review.best_bench_player_pts}pts
  </span>
</div>
```

Note: CONTEXT.md uses em dash (—) as separator for "Best bench" row vs hyphen (-) used in "Top scorer" row. Confirm the intended separator — em dash is the spec.

### Anti-Patterns to Avoid

- **Calling `setActiveSubTab('review')` directly:** This function does not exist. Sub-tab state lives in `sectionMemory`; use `setSectionMemory(prev => ({ ...prev, squad: 'review' }))`.
- **Fetching bootstrap directly from gw-review route client-side:** The existing pattern fetches bootstrap in server-side routes; the client-side hook uses the proxy (`/api/fpl/bootstrap-static/`).
- **Missing `data_checked` in schema:** Do not write `useSettledGws` using only `e.finished` — D-06 requires both flags; `data_checked` must be added to `FPLEventSchema` first.
- **Adding `best_bench_player_pts` as optional:** The `GwReview` interface should use non-optional fields (matching all other fields in the interface). Handle the no-bench-picks edge case in the route by returning `'—'` / `0`.
- **Writing the seen flag after an async operation:** Write `localStorage.setItem(key, '1')` synchronously inside the same try block as navigation — before any await — to ensure it's written even if navigation causes a re-render.
- **useEffect dep array missing:** If `settledGws` reference changes on every render (e.g., from a fresh `useQuery` returning new array), the effect will fire repeatedly. `useSettledGws` must return the same array reference when data hasn't changed — TanStack Query handles this via its internal cache reference stability.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching with caching | Custom fetch + useState | TanStack Query `useQuery` | Handles loading/error/stale states, retry, deduplication |
| Schema validation of FPL API response | Manual type assertion | Zod `parseFPLBootstrap` (already exists) | FPL API fields can be absent; Zod `.safeParse` protects against shape changes |
| localStorage read/write around navigation | Complex state machine | Simple `try/catch` around `localStorage.getItem/setItem` | localStorage can throw in SSR/private browsing; the try/catch is sufficient |

---

## Common Pitfalls

### Pitfall 1: `setActiveSubTab` Does Not Exist
**What goes wrong:** Planning or implementing the auto-surface effect by calling `setActiveSubTab('review')` — this function is not defined in `page.tsx`. Sub-tab state is inside `sectionMemory: Record<Section, SubTab | null>` updated via `setSectionMemory`.
**Why it happens:** The CONTEXT.md (D-01) says "calls `setActiveSection('squad')` + `setActiveSubTab('review')`" as a conceptual description, but the actual state API differs.
**How to avoid:** Call `setSectionMemory(prev => ({ ...prev, squad: 'review' }))` for the sub-tab, `setActiveSection('squad')` for the section.
**Warning signs:** TypeScript will error immediately at `setActiveSubTab` is not defined.

### Pitfall 2: `data_checked` Missing from FPLEventSchema
**What goes wrong:** `useSettledGws` references `e.data_checked` but the field is not in the current Zod schema or TypeScript `FPLEvent` type, causing a compile error.
**Why it happens:** `FPLEventSchema` in `fpl-adapter.ts` was built in Phase 58 and only included fields needed at that time (`is_current`, `is_next`, `finished`, `deadline_time`). `data_checked` is a real FPL API field [VERIFIED: WebSearch confirmed] but was never needed before.
**How to avoid:** The first task must extend `FPLEventSchema` to add `data_checked: z.boolean()` and extend `FPLEvent` interface accordingly. `useSettledGws` depends on this.
**Warning signs:** TypeScript: `Property 'data_checked' does not exist on type 'FPLEvent'`.

### Pitfall 3: Auto-Surface Effect Firing Every Render
**What goes wrong:** The `useEffect` fires on every render because `settledGws` is a new array reference each time.
**Why it happens:** TanStack Query returns a stable data reference only when the query cache hit is the same object. If `useSettledGws` returns `[]` (initial), then `[33, 34, 35]` (loaded), the effect fires once for each distinct value — which is correct. But if the hook re-renders with a new `[]` reference for "no data" state, the effect may re-fire.
**How to avoid:** The localStorage guard (`if (localStorage.getItem(key)) return`) makes this safe regardless — the effect is idempotent. The early return `if (settledGws.length === 0) return` prevents the navigation attempt when no settled GWs exist.
**Warning signs:** User sees themselves navigated back to Review tab on every page interaction.

### Pitfall 4: `bench_pts_left` vs "best bench player" Confusion
**What goes wrong:** Confusing `entry_history.points_on_bench` (the total bench points field used for `bench_pts_left`) with the individual bench player computation for `best_bench_player_pts`.
**Why it happens:** Both live in the same route, both relate to bench points, but they come from different sources: `bench_pts_left` = `entryHistory.points_on_bench` (already implemented); `best_bench_player_pts` = max `total_points` among `picks.filter(p => p.position > 11)`.
**How to avoid:** Do NOT recompute `bench_pts_left` from bench picks (the existing comment in `types.ts` warns: "do NOT recompute from individual picks"). Keep both computations separate.

### Pitfall 5: Empty Bench Array Edge Case
**What goes wrong:** `benchPicks.reduce(...)` throws if `benchPicks` is empty (which would happen for an unusual FPL entry with fewer than 15 picks).
**Why it happens:** Not guarding against empty bench array before calling `reduce`.
**How to avoid:** Check `benchPicks.length > 0` before reduce; provide a null/fallback when bench is empty (e.g., `best_bench_player_name: '—'`, `best_bench_player_pts: 0`).

---

## Code Examples

### Verified: Existing info-row CSS pattern
```tsx
// Source: src/components/squad/GwReviewTab.tsx lines 174-179, 181-191 [VERIFIED]
// "Top scorer" row:
<div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py2 flex items-baseline gap-2">
// "Captain" row:
<div className="rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex flex-wrap items-baseline gap-2">
```
Note: "Top scorer" row does NOT have `flex-wrap`; "Captain" row does. Use the simpler non-wrapping version for "Best bench" (matches the "Top scorer" style per D-08 spec).

### Verified: useGwReview staleTime decision
```typescript
// Source: src/lib/hooks/useGwReview.ts line 36 [VERIFIED]
staleTime: 1000 * 60 * 30, // 30 min — settled GW scores don't change
// useSettledGws: use 1 hour (3600000ms) — bootstrap events update less frequently
```

### Verified: proxy route URL pattern for bootstrap
```typescript
// Source: src/lib/hooks/useRivals.ts line 55 [VERIFIED]
const bootstrapRes = await fetch('/api/fpl/bootstrap-static/')
// Same pattern to use in useSettledGws (D-07 preference for consistency)
```

### Verified: parseFPLBootstrap usage
```typescript
// Source: src/lib/fpl-adapter.ts line 54; src/lib/hooks/useRivals.ts lines 57-58 [VERIFIED]
const bootstrapParsed = parseFPLBootstrap(bootstrapRaw)
if (!bootstrapParsed.success) throw new Error('...')
const { events } = bootstrapParsed.data
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `SETTLED_GWS_PLACEHOLDER: [33, 34, 35]` | `useSettledGws` hook from live bootstrap | Phase 98 | Review GW pills show real settled GWs; auto-surface works correctly |
| No bench player name in GwReview | `best_bench_player_name` + `best_bench_player_pts` | Phase 98 | PGW-01 bench summary is actionable |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data_checked` is a real boolean field in FPL bootstrap events API | Standard Stack / Pattern 2 | useSettledGws would use only `finished` as a gate; partial mitigation: D-06 can fall back to `finished`-only if data_checked is absent; WebSearch confirms field exists [MEDIUM confidence] |
| A2 | TanStack Query v5 data reference is stable between re-renders when cache is warm | Pitfall 3 | Auto-surface effect could fire multiple times; localStorage guard is sufficient mitigation regardless |

---

## Open Questions

1. **`data_checked` in production bootstrap right now**
   - What we know: Field is documented by multiple FPL API references and confirmed by WebSearch [CITED: Medium FPL API guide]. Missing from codebase schema.
   - What's unclear: Whether FPL sets `data_checked=true` before or after bonus points are finalized (edge case for GW in-progress).
   - Recommendation: Use `finished && data_checked` as D-06 specifies; if `data_checked` is always `false` during the season (only `true` in off-season), fall back to `finished`-only and update D-06 accordingly. Low probability issue.

2. **`setSectionMemory` scope in the PGW-04 useEffect**
   - What we know: `setSectionMemory` is defined inside the `Home` component function and the `useEffect` will be in the same function body. They're in scope.
   - What's unclear: Whether the linter requires `setSectionMemory` and `setActiveSection` in the useEffect dependency array.
   - Recommendation: Include them — React guarantees setState functions are stable, so their inclusion in deps is no-op.

---

## Environment Availability

Step 2.6: SKIPPED (no external tool dependencies — all changes are TypeScript/TSX source file edits; existing Next.js dev server and Vitest test runner already confirmed operational by prior phases).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/hooks/useSettledGws.test.ts src/components/squad/GwReviewTab.test.tsx src/app/page.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PGW-01 | "Best bench" row appears with name and pts when data is present | unit (component) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | Exists — needs new test case |
| PGW-01 | "Best bench" row absent in empty/error states | unit (component) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | Exists — needs new test case |
| PGW-01 | `/api/gw-review` returns `best_bench_player_name` + `best_bench_player_pts` | unit (route) | `npx vitest run src/app/api/gw-review/route.test.ts` | Does NOT exist — Wave 0 gap |
| PGW-02 | Captain comparison still renders correctly after type extension | unit (component) | `npx vitest run src/components/squad/GwReviewTab.test.tsx` | Exists — existing tests cover this; no new case needed |
| PGW-04 | Auto-surface fires when `settledGws` is non-empty and key not in localStorage | unit (hook/page) | `npx vitest run src/lib/hooks/useSettledGws.test.ts` | Does NOT exist — Wave 0 gap |
| PGW-04 | Auto-surface skips when localStorage key already set | unit | `npx vitest run src/lib/hooks/useSettledGws.test.ts` | Does NOT exist — Wave 0 gap |
| PGW-04 | Auto-surface skips when `settledGws` is empty | unit | `npx vitest run src/lib/hooks/useSettledGws.test.ts` | Does NOT exist — Wave 0 gap |
| PGW-04 | `useSettledGws` returns last 3 settled GW IDs ascending | unit (hook) | `npx vitest run src/lib/hooks/useSettledGws.test.ts` | Does NOT exist — Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/squad/GwReviewTab.test.tsx src/lib/hooks/useSettledGws.test.ts src/app/page.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/hooks/useSettledGws.test.ts` — covers PGW-04 (hook contract: disabled when no data, returns last 3, filters by finished+data_checked)
- [ ] `src/app/api/gw-review/route.test.ts` — covers PGW-01 (bench computation: best bench player name/pts, empty bench edge case)
- [ ] New test cases in `src/components/squad/GwReviewTab.test.tsx` — "Best bench" row appears/absent (PGW-01)
- [ ] `src/app/page.test.tsx` needs a mock for `useSettledGws` + auto-surface effect test

Note: `src/app/page.test.tsx` already exists and mocks most child components. It will need `vi.mock('@/lib/hooks/useSettledGws', ...)` added to test PGW-04 auto-surface behavior.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `gw` and `teamId` params already validated with `/^\d+$/` regex in `/api/gw-review/route.ts` |
| V6 Cryptography | no | — |

No new security surface introduced. `useSettledGws` is public (no auth required — bootstrap is public FPL API). The `pgw-reviewed:GW{N}` localStorage key stores only the integer GW number — no PII, no sensitive data.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/hooks/useGwReview.ts` — pattern template for `useSettledGws` [VERIFIED: read from codebase]
- `src/app/api/gw-review/route.ts` — bench picks computation target [VERIFIED: read from codebase]
- `src/lib/fpl-adapter.ts` — `FPLEventSchema` missing `data_checked` [VERIFIED: read from codebase]
- `src/app/page.tsx` — confirms `setActiveSubTab` does NOT exist; `setSectionMemory` is the correct API [VERIFIED: read from codebase]
- `src/lib/types.ts` lines 874-885 — `GwReview` interface current state [VERIFIED: read from codebase]
- `src/components/squad/GwReviewTab.tsx` — row CSS class pattern [VERIFIED: read from codebase]
- `src/lib/hooks/useDecisionHistory.ts` — localStorage pattern reference [VERIFIED: read from codebase]
- `vitest.config.ts` + `package.json` — test framework and commands [VERIFIED: read from codebase]

### Secondary (MEDIUM confidence)
- [CITED: https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19] — confirms `data_checked` field exists in FPL bootstrap events
- [CITED: https://fpl.readthedocs.io/en/latest/classes/gameweek.html] — documents `finished` and `data_checked` as gameweek status booleans

### Tertiary (LOW confidence)
- None — all claims verified from codebase or cited from external sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json; no new deps
- Architecture: HIGH — all integration points verified by reading actual source files
- Pitfalls: HIGH — Pitfall 1 (setActiveSubTab) verified directly in page.tsx; Pitfall 2 (data_checked schema gap) verified in fpl-adapter.ts
- Test gaps: HIGH — confirmed which test files exist and which don't via codebase glob

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable stack; bootstrap field shape changes rarely)
