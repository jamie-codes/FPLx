# Phase 124: Season Review — Research

**Researched:** 2026-05-19
**Domain:** Next.js Route Handler + TanStack Query hook + recharts ComposedChart + Tailwind UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Chart primary y-axis = GW points. Primary line = user GW score; overlay line = average manager score per GW. Chip GWs highlighted as data-point markers. Overall rank in tooltip only (no second axis).

**D-02:** Average manager score sourced from FPL bootstrap `events[].average_entry_score` — single call for all 38 GWs. Do NOT read individual `gw_review_gw{N}.json` Blob artifacts.

**D-03:** New `/api/season-review` route. Fetches FPL `/entry/{teamId}/history/` + FPL bootstrap `events[]` in parallel. Returns a new `SeasonReview` type. Follows pattern from `/api/season-analytics`.

**D-04:** Captain EV rate sourced from shared lib function extracted from decision-history computation logic — no HTTP self-call to `/api/decision-history`. Extract into `src/lib/season-review.ts`. Chip ROI positive rate and hit break-even rate sourced from `useSeasonAnalytics` hook client-side. Grade computed client-side after both `useSeasonReview` + `useSeasonAnalytics` resolve.

**D-05:** Grade thresholds (v1): A ≥ 75%, B ≥ 50%, C ≥ 25%, D < 25% of weighted composite. Weights: captain EV rate 40% + hit break-even rate 35% + chip ROI positive rate 25%.

**D-06:** When chip count = 0, chip ROI component excluded; remaining two components renormalized (captain EV rate 53.3%, hit break-even rate 46.7%).

**D-07:** "Season" sub-tab inserted after "Accuracy". New Analyse order: Gems, Insights, DefCon, Set Pieces, Club Form, Accuracy, **Season**, Price Changes.

**D-08:** Unauthenticated empty state: card reading "Enter your FPL Team ID to see your Season Review". Sub-tab always visible. Pattern from AccuracyTab.

### Claude's Discretion

- Exact layout and visual hierarchy within the summary card (REV-01) — stat ordering, responsive grid vs. flex layout
- Tooltip content formatting for the chart (exact copy for rank, points, average shown on hover — copy is actually locked in UI-SPEC)
- Loading/skeleton state design for the `useSeasonReview` hook while data fetches

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REV-01 | Season summary card: total rank, total points, captain hit rate %, transfer net gain/loss, best GW score, worst GW score — aggregated across available GWs | Data sourced from `/entry/{teamId}/history/` `current[]` array. Transfer net from `current[].event_transfers_cost`. FPL history endpoint confirmed to carry these fields (pattern from season-analytics/route.ts). |
| REV-02 | Decision quality A–D grade: captain EV rate (40%) + hit break-even rate (35%) + chip ROI positive rate (25%); methodology note displayed | `captainHitRate` available from `regret.ts` `computeSeasonSummary()`. Hit break-even rate from `useSeasonAnalytics` `hitTracking`. Chip ROI positive rate from `useSeasonAnalytics` `chipRoi`. Grade computed client-side. |
| REV-03 | Season variance chart: GW-by-GW points with avg manager score overlay; chip GWs highlighted | `average_entry_score` available on bootstrap `events[]` per D-02. Chip GWs from `/entry/{teamId}/history/` `chips[]`. recharts `ComposedChart` already in codebase. |
| REV-04 | "Season" sub-tab in the Analyse section, accessible on desktop and MobileNav | `SubTab` union type in `page.tsx:56`, `SECTIONS` array at line 58. Pattern is well-understood from existing Analyse sub-tabs. |
</phase_requirements>

---

## Summary

Phase 124 is a client-side aggregation feature building on two existing data sources: the FPL `/entry/{teamId}/history/` endpoint (already consumed by `season-analytics/route.ts`) and the FPL bootstrap `events[]` array (already fetched in multiple routes). No new pipeline steps are required. The implementation is pure TypeScript/React: a new API route, a new TanStack Query hook, a shared computation lib, and a new tab component.

The decision quality grade (REV-02) is the trickiest computation because it requires data from two hooks — `useSeasonReview` (captain EV rate) and `useSeasonAnalytics` (hit break-even rate + chip ROI positive rate). The CONTEXT.md decision locks the approach: compute these client-side after both hooks resolve, with the grade rendering a `—` placeholder while either is loading. The shared captain EV rate logic is extracted into `src/lib/season-review.ts` from the existing `regret.ts` `computeSeasonSummary()` function, avoiding an HTTP self-call.

The chart (REV-03) reuses recharts `ComposedChart` with two `Line` components and a custom `ChipDot` renderer — a pattern already established in `BackTab.tsx` and `AccuracyTab.tsx`. The UI-SPEC is fully approved and provides pixel-precise className strings for every component, so there is no design ambiguity.

**Primary recommendation:** Implement in three waves — (1) API route + types + shared lib, (2) hook + unit tests, (3) UI components + page.tsx wiring. Each wave is independently testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Season stats aggregation (REV-01) | API / Backend | — | FPL upstream data must be fetched server-side to avoid CORS; aggregation is cheap |
| Avg manager score per GW | API / Backend | — | Fetched alongside history in the same route (D-02) |
| Captain EV rate computation | Shared lib (server + client) | — | Extracted to `src/lib/season-review.ts` — pure function callable from route or component |
| Decision quality grade (REV-02) | Browser / Client | — | Requires two async sources to resolve first (D-04); cannot be computed in a single route |
| Points chart (REV-03) | Browser / Client | — | recharts is client-side; data shape prepared by server and delivered via hook |
| Sub-tab navigation (REV-04) | Browser / Client | — | Pure UI wiring in `page.tsx` SECTIONS array + SubTab union type |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | Already installed | ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer | Used in BackTab.tsx and AccuracyTab.tsx; identical import pattern |
| @tanstack/react-query | Already installed | `useQuery` hook for data fetching + caching | Project-wide hook standard; 6h staleTime for settled season data |
| Tailwind CSS | Already installed | All className styling | Project uses Tailwind-only (no shadcn, confirmed by UI-SPEC) |
| lucide-react | Already installed | Icons if needed (none specified in UI-SPEC for this phase) | Project icon library |

[VERIFIED: codebase grep — recharts imported in BackTab.tsx:1-21, AccuracyTab.tsx:19-28]
[VERIFIED: codebase grep — @tanstack/react-query used in all hooks under src/lib/hooks/]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript interfaces | — | `SeasonReview`, `SeasonGwEntry` new types | Add to `src/lib/types.ts` following existing type conventions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts ComposedChart | Separate LineChart | ComposedChart needed for two overlapping Line series; already used in calibration chart |
| Client-side grade | Server-side grade | Server-side grade would require a self-HTTP call to /api/season-analytics (self-calls fail on Vercel serverless — D-04 locked) |

---

## Architecture Patterns

### System Architecture Diagram

```
FPL API upstream
  ├── /entry/{teamId}/history/  ─────────────┐
  └── /bootstrap-static/                     │
       (events[].average_entry_score)         │
                                              ▼
                               /api/season-review (new Route Handler)
                                  Parallel fetch with Promise.all()
                                  Aggregates: total pts, rank, chips, avg score per GW
                                  Returns: SeasonReview type
                                              │
                                              ▼
                               useSeasonReview(teamId) hook
                               (TanStack Query, 6h staleTime)
                                              │
                               ┌──────────────┘
                               │
                               ▼
                           SeasonReviewTab (client component)
                            ├── waits for both:
                            │    ├── useSeasonReview (REV-01 data + captain hits)
                            │    └── useSeasonAnalytics (chip ROI + hit tracking)
                            │
                            ├── REV-01 Summary Card (stat grid)
                            ├── REV-02 Grade Card (client-side composite grade)
                            └── REV-03 Points Chart (ComposedChart)
                                     ├── Line: user GW score
                                     ├── Line: avg manager score (dashed)
                                     └── ChipDot: amber dot on chip GWs
```

### Recommended Project Structure

```
src/
├── app/api/season-review/
│   └── route.ts                    # New: GET /api/season-review?teamId={id}
├── lib/
│   ├── season-review.ts            # New: computeCaptainEVRate(), computeGrade()
│   └── types.ts                    # Add: SeasonReview, SeasonGwEntry interfaces
├── lib/hooks/
│   ├── useSeasonReview.ts          # New: TanStack Query hook
│   └── useSeasonReview.test.ts     # New: hook contract tests
└── components/season-review/
    ├── SeasonReviewTab.tsx          # New: root component (REV-01/02/03)
    └── SeasonReviewTab.test.tsx     # New: render + skeleton + grade tests
```

### Pattern 1: Route Handler (mirrors season-analytics/route.ts)

**What:** New route fetches FPL history + bootstrap in parallel, aggregates, returns typed JSON.
**When to use:** All FPL upstream fetches — never self-call `/api/*` from a route.

```typescript
// Source: src/app/api/season-analytics/route.ts (verified pattern)
const FPL_BASE = 'https://fantasy.premierleague.com/api'
const FPL_UA = 'fplx/1.X (+https://fplx.app)'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamIdParam = searchParams.get('teamId')
  if (!teamIdParam || !/^\d+$/.test(teamIdParam)) {
    return Response.json({ error: 'Invalid teamId parameter' }, { status: 400 })
  }

  const [history, bootstrap] = await Promise.all([
    fetchHistory(teamIdParam),
    fetchBootstrap(),
  ])

  if (history === null) {
    return Response.json({ error: 'FPL history fetch failed' }, { status: 502 })
  }
  // ... aggregate and return
}
```

### Pattern 2: FPLHistoryCurrent interface extension

**What:** The `FPLHistoryCurrent` interface in `season-analytics/route.ts` omits `overall_rank`. The new route's local interface must add it.
**Critical note from CONTEXT.md specifics:** `overall_rank` IS present in the FPL `/entry/{teamId}/history/` `current[]` response — it is simply not captured by the existing interface. The new route defines its own local interface including this field.

```typescript
// New local interface in /api/season-review/route.ts
interface FPLHistoryCurrent {
  event: number
  points: number
  event_transfers_cost: number
  overall_rank: number           // NOT in existing season-analytics interface
}
```

[VERIFIED: season-analytics/route.ts line 19 — `FPLHistoryCurrent` only has `event`, `points`, `event_transfers_cost`]
[ASSUMED: `overall_rank` is present in the FPL history API response — cross-referenced with CONTEXT.md `specifics` section which confirms this field exists but is not currently captured]

### Pattern 3: TanStack Query v5 Hook (mirrors useSeasonAnalytics.ts)

**What:** Minimal hook with 6h staleTime, numeric teamId guard, no localStorage ring-buffer (in-memory cache only — settled season data).

```typescript
// Source: src/lib/hooks/useSeasonAnalytics.ts (verified pattern)
export function useSeasonReview(teamId: string | null) {
  return useQuery<SeasonReview>({
    queryKey: ['season-review', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('teamId is required')
      return fetchSeasonReview(teamId)
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })
}
```

### Pattern 4: Captain EV Rate Extraction

**What:** `computeSeasonSummary()` in `regret.ts` already computes `captainHitRate`. The new `season-review.ts` shared lib must derive the captain EV rate from the `/entry/{teamId}/history/` data without requiring a Blob read (Blob reads are only in `decision-history/route.ts`). The rate in REV-01 is the **captain hit rate** (percentage of GWs where captain score met or beat the model ceiling) — but REV-01 just calls it "Captain Hit Rate" and REV-02 calls it "captain EV rate" (same metric with different framing).

**Key insight from CONTEXT.md D-04:** The captain EV rate for the grade is sourced from a shared lib function extractable from `decision-history/route.ts`. However, computing it server-side requires captain pick data per GW from `/entry/{teamId}/event/{gw}/picks/` — which is expensive (38 picks calls). The route should NOT replicate the full decision-history logic.

**Resolution:** The `/api/season-review` route does NOT compute captain EV rate server-side. Instead:
1. The route returns raw history data (points, rank, chips, avg manager scores).
2. The client-side hook `useSeasonReview` returns this data.
3. The `SeasonReviewTab` component reads `captainHitRate` from `useDecisionHistory` (already fetched by `BackTab` in the same session via TanStack cache) OR computes it from `DecisionHistory` entries.
4. **Actually per D-04:** The shared lib function is callable by both routes — the captain EV rate is computed from the `RegretEntry[]` array (which can be passed in from cached decision history). The `computeSeasonSummary()` function in `regret.ts` already does this computation. `SeasonReviewTab` can call `useDecisionHistory(teamId)` for the captain rate, then combine with `useSeasonAnalytics` for the grade.

[VERIFIED: regret.ts:51-70 — `computeSeasonSummary(entries)` computes `captainHitRate = captainHits / gwsWithData`]

### Pattern 5: Grade Computation (client-side, two-hook dependency)

**What:** Grade is a client-side computation depending on two hooks resolving.

```typescript
// Grade computation in SeasonReviewTab (client-side, post-hook-resolution)
function computeGrade(
  captainEVRate: number,        // from useDecisionHistory / computeSeasonSummary
  hitBreakEvenRate: number,     // from useSeasonAnalytics hitTracking
  chipROIPositiveRate: number,  // from useSeasonAnalytics chipRoi
  chipCount: number,
): 'A' | 'B' | 'C' | 'D' {
  let score: number
  if (chipCount === 0) {
    // D-06: renormalize without chip component
    score = captainEVRate * 0.533 + hitBreakEvenRate * 0.467
  } else {
    score = captainEVRate * 0.40 + hitBreakEvenRate * 0.35 + chipROIPositiveRate * 0.25
  }
  if (score >= 0.75) return 'A'
  if (score >= 0.50) return 'B'
  if (score >= 0.25) return 'C'
  return 'D'
}
```

### Pattern 6: ChipDot custom dot renderer

**What:** recharts allows custom dot renderers. The `ChipDot` component in the UI-SPEC replaces the default dot on the user-score Line.

```tsx
// From UI-SPEC (approved 2026-05-19)
function ChipDot(props: any) {
  const { cx, cy, payload } = props
  if (!payload?.chipPlayed) return <circle cx={cx} cy={cy} r={3} fill="currentColor" stroke="none" />
  return <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="none" />
}
// Usage: <Line dot={<ChipDot />} ... />
```

### Pattern 7: Sub-tab wiring (page.tsx)

**What:** Two edits: (1) add `'season'` to `SubTab` union type, (2) add entry to Analyse `subTabs` array.

```typescript
// page.tsx line 56 — SubTab union type (add 'season')
export type SubTab = 'gems' | ... | 'accuracy' | 'season' | 'price-changes' | ...

// SECTIONS Analyse subTabs array — insert after accuracy, before price-changes:
{ id: 'season' as SubTab, label: 'Season', mobileLabel: 'Season' },

// Content render condition:
{activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}
```

[VERIFIED: page.tsx lines 56-70 — SubTab union and SECTIONS array confirmed; insertion point after accuracy (line 68), before price-changes (line 69)]

### Anti-Patterns to Avoid

- **Self-calling API routes:** Never call `/api/season-analytics` or `/api/decision-history` from `/api/season-review`. Self-calls fail on Vercel serverless (documented in gw-review/route.ts comments).
- **Reading Blob artifacts for avg score:** D-02 locks bootstrap `events[].average_entry_score` as the source. Do not read `gw_review_gw{N}.json` Blob files.
- **38 sequential picks fetches for captain rate:** The captain rate must come from existing data structures, not from fetching 38 GW picks endpoints in the route.
- **Using deprecated TanStack Query v4 options:** No `onSuccess`, no `onError` in query options. Use `useEffect` on `query.isSuccess` for side effects.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Captain EV rate | Custom fetch + computation in route | `computeSeasonSummary()` from `regret.ts` applied to `useDecisionHistory` data | Already exists, tested, handles null entries gracefully |
| Hit break-even rate | Re-implement hit tracking | `useSeasonAnalytics` `hitTracking` array | Route already computes this; `brokeEven` field is populated |
| Chip ROI positive rate | Re-implement chip ROI | `useSeasonAnalytics` `chipRoi` array | `delta > 0` filter gives positive rate |
| Chart tooltip | recharts default tooltip | Custom `SeasonChartTooltip` component | Default tooltip has no chip name or rank; custom is already specced in UI-SPEC |
| Loading state | Spinner | Skeleton pulse (3 cards, animate-pulse) | UI-SPEC specifies exact skeleton structure; consistent with app pattern |

**Key insight:** The full data pipeline for the grade already exists. The work is wiring it together, not building new computation logic.

---

## Common Pitfalls

### Pitfall 1: `overall_rank` field not in existing FPL interfaces
**What goes wrong:** Copy-pasting `FPLHistoryCurrent` from `season-analytics/route.ts` omits `overall_rank`, causing the route to return null/undefined for rank in chart tooltips.
**Why it happens:** The existing interface only captures fields that route needed. `overall_rank` is confirmed present in the FPL response but not in the existing interface.
**How to avoid:** Define a new local `FPLHistoryCurrent` interface in `season-review/route.ts` that explicitly includes `overall_rank: number`.
**Warning signs:** Chart tooltip shows "Overall rank: undefined" or 0 in all GWs.

### Pitfall 2: Grade renders before both hooks resolve
**What goes wrong:** Grade shows 'D' (lowest) because one hook hasn't loaded yet, making `captainEVRate` or `hitBreakEvenRate` appear as 0.
**Why it happens:** Hooks resolve at different times; if grade computed before both ready, inputs are undefined/0.
**How to avoid:** Only compute and display the grade when `useSeasonReview.isSuccess && useSeasonAnalytics.isSuccess && useDecisionHistory.isSuccess` (or equivalent). Render `—` in the grade badge until all are resolved.
**Warning signs:** Grade flickers from D to a higher grade as data loads.

### Pitfall 3: Chip ROI positive rate division by zero
**What goes wrong:** `chipROIPositiveRate` computed as 0/0 = NaN when no chips played, breaking the composite score.
**Why it happens:** `chipRoi.length === 0` means no denominator.
**How to avoid:** Apply D-06 — when `chipRoi.length === 0` (chipCount = 0), exclude the chip component from the weighted average and renormalize. Guard: `chipCount === 0` before the grade calculation.
**Warning signs:** Grade returns 'D' or NaN for managers who saved all chips.

### Pitfall 4: Hit break-even rate with no hits
**What goes wrong:** `hitBreakEvenRate` is NaN when `hitTracking.length === 0` (no hits taken all season).
**Why it happens:** `hitTracking.filter(h => h.brokeEven).length / 0 = NaN`.
**How to avoid:** Guard: if `hitTracking.length === 0`, treat hit break-even rate as 1.0 (all 0 hits broke even — vacuously true; rewarding clean transfer play is appropriate).
**Warning signs:** Grade computes incorrectly for managers who never took a hit.

### Pitfall 5: SeasonGwEntry chipPlayed vs chip name display
**What goes wrong:** Chart tooltip shows `chipPlayed: "bboost"` but UI-SPEC specifies display name "Bench Boost".
**Why it happens:** FPL API returns chip slugs; display requires a mapping step.
**How to avoid:** Include the chip-name display map in `SeasonReviewTab` (same map used in `BackTab.tsx` — `CHIP_DISPLAY_NAME`).
**Warning signs:** Tooltip shows raw slug like "3xc" instead of "Triple Captain".

### Pitfall 6: `average_entry_score` field name
**What goes wrong:** Bootstrap `events[]` field accessed as wrong name, returning undefined.
**Why it happens:** Field name is `average_entry_score` (not `average_score` or `avg_score`).
**How to avoid:** Verify field name in the local `FPLBootstrapEvent` interface matches exactly. The CONTEXT.md D-02 explicitly names `events[].average_entry_score`.
**Warning signs:** Avg manager line in chart is always 0 or flatlined.

### Pitfall 7: useDecisionHistory loading state for captain rate
**What goes wrong:** Captain hit rate shows as 0% until `useDecisionHistory` resolves, even though summary card already has data from `useSeasonReview`.
**Why it happens:** `useDecisionHistory` fetches captain picks data (can be slower due to Blob reads for snapshots).
**How to avoid:** For REV-01 "Captain Hit Rate", display `—` while `useDecisionHistory` is loading; show value only on success. This is consistent with the grade loading pattern.

---

## Code Examples

### Type definitions to add to `src/lib/types.ts`

```typescript
// New types for Phase 124 — SeasonReview

/** One GW entry in the season-review chart and tooltip */
export interface SeasonGwEntry {
  gw: number
  points: number             // user's actual GW score
  avgManagerScore: number    // FPL events[].average_entry_score for this GW
  overallRank: number        // user's overall rank after this GW
  chipPlayed: string | null  // chip slug ('bboost'|'3xc'|'freehit'|'wildcard') or null
}

/** Full response from GET /api/season-review?teamId={id} */
export interface SeasonReview {
  totalPoints: number
  finalRank: number          // overall_rank from the last current[] entry
  bestGw: { gw: number; points: number }
  worstGw: { gw: number; points: number }
  transferNetPoints: number  // sum of -(event_transfers_cost) across all GWs
  captainHits: number        // GWs where user captain score >= model ceiling (requires decision-history data — may be null)
  captainGwsWithData: number // GWs where captain comparison data existed
  gwData: SeasonGwEntry[]    // ordered GW1..GW38 (only GWs that have played)
}
```

### Grade computation (pure function for `src/lib/season-review.ts`)

```typescript
// Source: derived from CONTEXT.md D-05/D-06 (locked decisions)
export type GradeLabel = 'A' | 'B' | 'C' | 'D'

export function computeDecisionGrade(
  captainEVRate: number,
  hitBreakEvenRate: number,
  chipROIPositiveRate: number,
  chipCount: number,
): GradeLabel {
  const score = chipCount === 0
    ? captainEVRate * (40 / 75) + hitBreakEvenRate * (35 / 75)  // renormalized to 100%
    : captainEVRate * 0.40 + hitBreakEvenRate * 0.35 + chipROIPositiveRate * 0.25
  if (score >= 0.75) return 'A'
  if (score >= 0.50) return 'B'
  if (score >= 0.25) return 'C'
  return 'D'
}
```

### Cache-Control header (matches season-analytics pattern)

```typescript
// Source: src/app/api/season-analytics/route.ts line 210
headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' }
```

---

## Runtime State Inventory

> Greenfield sub-feature addition — no rename/refactor/migration involved. Section skipped.

---

## Environment Availability

> Phase is purely TypeScript/React code changes. No new external runtime dependencies.
> All required libraries (recharts, @tanstack/react-query, Tailwind) are already installed.

**Step 2.6: SKIPPED — no new external dependencies. All libraries already present in node_modules.**

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 `onSuccess` option | `useEffect` on `query.isSuccess` | TanStack Query v5 | `onSuccess` removed in v5; use effect pattern is required |
| recharts default tooltip | Custom tooltip component | Long-standing best practice in this codebase | Custom tooltips needed for chip name + rank display |

**Deprecated/outdated:**
- `onSuccess`/`onError` in `useQuery` options: removed in TanStack Query v5. All hooks in this codebase already use the `useEffect` pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `overall_rank` field is present in FPL `/entry/{teamId}/history/` `current[]` API response | Pattern 2, Pitfall 1 | Chart tooltip would show undefined rank for all GWs; fix requires a new FPL API investigation |
| A2 | `average_entry_score` field name in bootstrap `events[]` is accurate | Pitfall 6 | Avg manager line would be all-zero; confirmed by CONTEXT.md D-02 naming |

**Note:** A1 is flagged in CONTEXT.md `specifics` section explicitly: "confirm this field exists in the API response". CONTEXT.md says it IS present but is not currently captured. Planner should include a verification step (read one FPL history response) in Wave 0 or Wave 1 of the plan.

---

## Open Questions (RESOLVED)

1. **Captain hit rate data source for REV-01 summary card**
   - RESOLVED: `SeasonReviewTab` calls `useDecisionHistory(teamId)` alongside `useSeasonReview(teamId)` and runs `computeSeasonSummary(historyQuery.data.entries).captainHitRate` client-side. TanStack cache means no double-fetch if Back tab was already visited. While `useDecisionHistory` is loading the cell renders `—`; no route self-calls required.
   - What we know: CONTEXT.md D-04 says captain EV rate is sourced via shared lib from decision-history logic. `computeSeasonSummary()` in `regret.ts` derives it from `RegretEntry[]`.
   - What was unclear: `RegretEntry[]` requires Blob snapshot reads (captain_picks_gw{N}.json), which are done in `decision-history/route.ts`. The `SeasonReviewTab` could call `useDecisionHistory(teamId)` — this hook is already in the codebase and may already be warm in TanStack cache if the user has visited the Back tab.
   - Recommendation (locked): `SeasonReviewTab` calls both `useSeasonReview(teamId)` AND `useDecisionHistory(teamId)`. TanStack cache means no double-fetch if Back tab was already visited. Display `—` for captain hit rate while `useDecisionHistory` is loading. This is the cleanest approach without route self-calls.

2. **Transfer net points formula**
   - RESOLVED: `transferNetPoints = -(sum of event_transfers_cost across all current[] entries)`. Free-transfer GWs contribute 0. A displayed value of 0 = no hits taken; -4 = one hit; -8 = two hits; rendered with the U+2212 minus sign per UI-SPEC §Copywriting.
   - What we know: `event_transfers_cost` in `current[]` is the points penalty (positive number, e.g. 4 for one hit). Net gain = -(sum of transfer costs).
   - What was unclear: Whether to include free-transfer GWs in the "net" display (free transfers have `event_transfers_cost = 0`).
   - Recommendation (locked): Transfer net = -(sum of all `event_transfers_cost` values). This gives the total points cost from hits. A value of 0 means no hits taken. A value of -8 means two hits taken (displayed as "−8" per UI-SPEC).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/season-review` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | `/api/season-review` returns correct aggregated stats | unit | `npx vitest run src/app/api/season-review` | ❌ Wave 0 |
| REV-02 | `computeDecisionGrade()` returns correct grade for all threshold boundaries | unit | `npx vitest run src/lib/season-review` | ❌ Wave 0 |
| REV-02 | D-06: chip count=0 renormalizes weights correctly | unit | `npx vitest run src/lib/season-review` | ❌ Wave 0 |
| REV-02 | D-06: zero hits vacuously returns 1.0 break-even rate (no division by zero) | unit | `npx vitest run src/lib/season-review` | ❌ Wave 0 |
| REV-03 | `useSeasonReview` hook disables when teamId is null/non-numeric | unit | `npx vitest run src/lib/hooks/useSeasonReview` | ❌ Wave 0 |
| REV-03 | `useSeasonReview` hook fetches correct URL | unit | `npx vitest run src/lib/hooks/useSeasonReview` | ❌ Wave 0 |
| REV-04 | `SeasonReviewTab` renders empty state when teamId is null | unit | `npx vitest run src/components/season-review` | ❌ Wave 0 |
| REV-04 | `SeasonReviewTab` renders skeleton while loading | unit | `npx vitest run src/components/season-review` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/season-review src/lib/hooks/useSeasonReview`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/season-review.ts` — pure functions for grade computation (REV-02); also needed before route can import
- [ ] `src/lib/season-review.test.ts` — unit tests for `computeDecisionGrade()` boundary conditions
- [ ] `src/lib/hooks/useSeasonReview.ts` + `useSeasonReview.test.ts` — hook contract
- [ ] `src/components/season-review/SeasonReviewTab.tsx` — root component (skeleton first)
- [ ] `src/app/api/season-review/route.ts` — new route handler

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth required — team ID is public |
| V3 Session Management | no | No session tokens in this route |
| V4 Access Control | no | Public FPL data; no user-specific protected data |
| V5 Input Validation | yes | `teamId` validated with `/^\d+$/.test()` before constructing FPL URL (SSRF guard) |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via teamId URL injection | Tampering | `!/^\d+$/.test(teamIdParam)` → 400 before URL construction (established pattern in all existing routes) |
| Response injection from FPL upstream | Tampering | TypeScript interface cast; malformed JSON caught in try/catch returning null |

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/season-analytics/route.ts` — canonical route pattern; `FPLHistoryCurrent` interface; `Promise.all` parallel fetch; `Cache-Control` header
- `src/lib/regret.ts` — `computeSeasonSummary()` confirmed as the captain hit rate computation
- `src/lib/hooks/useSeasonAnalytics.ts` — canonical TanStack Query v5 hook pattern for this codebase
- `src/lib/types.ts` — confirmed `SeasonAnalytics`, `ChipRoiEntry`, `HitTrackingEntry` type shapes
- `src/app/page.tsx` — confirmed `SubTab` union type (line 56), `SECTIONS` Analyse subTabs (lines 62–70), render pattern (lines 272–282)
- `src/components/accuracy/AccuracyTab.tsx` — confirmed empty state pattern, AccuracySubTabNav pattern
- `.planning/phases/124-season-review/124-CONTEXT.md` — all locked decisions D-01 through D-08
- `.planning/phases/124-season-review/124-UI-SPEC.md` — approved UI contract with exact className strings

### Secondary (MEDIUM confidence)

- `src/components/accuracy/BackTab.tsx` — recharts ComposedChart import pattern; chip display name map
- `vitest.config.ts` — confirmed Vitest jsdom environment, exclude patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use
- Architecture: HIGH — all patterns exist in codebase; no novel patterns required
- Pitfalls: HIGH — derived from reading actual route code and type definitions
- Type definitions: HIGH — existing types confirmed; new types are additive
- FPL API field `overall_rank`: ASSUMED (confirmed by CONTEXT.md specifics but not independently verified via live API call)

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (FPL API is stable between seasons; 30-day window is safe)
