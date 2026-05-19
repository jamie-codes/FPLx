# Phase 124: Season Review - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a Season Review feature: a summary stats card (REV-01), decision quality A–D grade (REV-02), a GW-by-GW points chart with average manager score overlay and chip markers (REV-03), surfaced as a new "Season" sub-tab in the Analyse section (REV-04). All computation is client-side aggregation from FPL API data — no new pipeline steps. Requires teamId (empty state when absent).

</domain>

<decisions>
## Implementation Decisions

### Chart (REV-03)
- **D-01:** Points on the primary y-axis, not rank. Primary line = user's GW score; overlay line = average manager score per GW. Chip GWs highlighted as data-point markers. Overall rank shown in tooltip only (no second axis).
- **D-02:** Average manager score sourced from FPL bootstrap `events[].average_entry_score` — single call, all 38 GWs available. Do NOT read individual `gw_review_gw{N}.json` Blob artifacts for this (up to 38 reads — too expensive).

### API Route Architecture (REV-01, REV-03)
- **D-03:** New `/api/season-review` route. Fetches FPL `/entry/{teamId}/history/` (per-GW points + overall_rank + chips used) + FPL bootstrap `events[]` (per-GW average_entry_score) in a single server call. Returns a new `SeasonReview` type. Follows the established route pattern from `/api/season-analytics`.
- **D-04:** Captain hit rate for the grade (REV-02) is sourced via a shared lib function extracted from the decision-history computation logic — no HTTP self-call to `/api/decision-history`. Pattern: extract the captain EV rate logic into `src/lib/season-review.ts` (or similar shared module), callable by both routes. Chip ROI positive rate and hit break-even rate sourced from `useSeasonAnalytics` (existing hook) on the client side; grade computed client-side after both `useSeasonReview` + `useSeasonAnalytics` resolve.

### Decision Quality Grade (REV-02)
- **D-05:** Grade thresholds (v1, methodology note required): A ≥ 75%, B ≥ 50%, C ≥ 25%, D < 25% of the weighted composite score. Weights: captain EV rate 40% + hit break-even rate 35% + chip ROI positive rate 25%.
- **D-06:** When no chip was played (chip count = 0), the chip ROI component is excluded from the weighted calculation and the remaining two components are renormalized to 100% (captain EV rate 53.3%, hit break-even rate 46.7%). This avoids penalizing chip-saving as a strategy.

### Sub-tab Placement (REV-04)
- **D-07:** "Season" sub-tab inserted after "Accuracy" in the Analyse section list. New order: Gems, Insights, DefCon, Set Pieces, Club Form, Accuracy, **Season**, Price Changes.
- **D-08:** Unauthenticated empty state: display a card reading "Enter your FPL Team ID to see your Season Review". Consistent with AccuracyTab pattern (`AccuracyTab` receives `teamId` prop and renders a prompt when it's null/empty). Sub-tab always visible in the list (does not hide when unauthenticated).

### Claude's Discretion
- Exact layout and visual hierarchy within the summary card (REV-01) — stat ordering, responsive grid vs. flex layout
- Tooltip content formatting for the chart (exact copy for rank, points, average shown on hover)
- Loading/skeleton state design for the `useSeasonReview` hook while data fetches

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Analog Routes (primary pattern sources)
- `src/app/api/season-analytics/route.ts` — canonical pattern for fetching FPL history endpoint + computing per-GW analytics; new `/api/season-review` route follows this structure
- `src/app/api/decision-history/route.ts` — captain hit rate computation logic; shared lib function is extracted from here
- `src/app/api/gw-review/route.ts` — how `average_score` per GW is used from Blob data; for REV-03 we instead use bootstrap `events[].average_entry_score`

### Analog Hooks & Components
- `src/lib/hooks/useDecisionHistory.ts` — canonical TanStack Query hook pattern (6h staleTime, localStorage cache, placeholderData)
- `src/components/accuracy/AccuracyTab.tsx` — AccuracyTab receives `teamId` prop, renders empty-state when null; sub-tab nav pattern inside AccuracyTab is a close analog for Season sub-structure if needed
- `src/components/accuracy/BackTab.tsx` — recharts ComposedChart/LineChart usage (Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer) — use same chart library and component imports

### Type Definitions
- `src/lib/types.ts` — `SeasonAnalytics`, `ChipRoiEntry`, `HitTrackingEntry`, `DecisionHistory`, `RegretEntry` (read before defining `SeasonReview` type to avoid duplication)

### Navigation Integration
- `src/app/page.tsx` — `SubTab` union type (line 56), `SECTIONS` array with Analyse sub-tabs (lines 62–70), content render switch (lines ~272–282). New `'season'` sub-tab value and `SeasonReviewTab` render block go here.
- `src/components/nav/MobileNav.tsx` — sub-tab rendering; no changes needed if page.tsx SECTIONS is updated correctly

### Requirements
- `.planning/REQUIREMENTS.md` — REV-01, REV-02, REV-03, REV-04 requirement text (exact acceptance criteria)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSeasonAnalytics` hook (if it exists — check `src/lib/hooks/`) — chip ROI and hit break-even data already computed; grade consumes this client-side
- `recharts` — already installed; `ComposedChart`, `Line`, `ReferenceLine`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` are all in use in `AccuracyTab.tsx` and `BackTab.tsx`
- FPL UA header pattern: `'fplx/1.X (+https://fplx.app)'` — use in new route's fetch calls
- `SubTab` union type in `page.tsx:56` — add `'season'` value here

### Established Patterns
- Route Handler pattern: fetch FPL upstream directly (NOT via `/api/fpl/[...proxy]`) — self-fetch fails on Vercel serverless (see comment in `gw-review/route.ts`)
- TanStack Query hook: `staleTime: 6 * 60 * 60 * 1000` (6h) — settled season data is immutable
- teamId guard: `!!teamId && /^\d+$/.test(teamId)` before enabling queries
- Non-fatal fetch: wrap each upstream call in try/catch; return null/empty on failure

### Integration Points
- `src/app/page.tsx`: add `'season' as SubTab` to Analyse subTabs array (after `accuracy`), add `SeasonReviewTab` import, add render condition `{activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}`
- `src/lib/types.ts`: new `SeasonReview` type and `SeasonGwEntry` type needed
- `useSeasonAnalytics` hook (or equivalent): verify it exists and accepts `teamId`; the grade computation depends on it

</code_context>

<specifics>
## Specific Ideas

- The "xPts expectation overlay" in REV-03 is re-interpreted as **average manager score** (not the pipeline's forward-looking xPts engine). The label in the UI should say "Avg manager score" not "xPts" to avoid confusion.
- Grade methodology note on the card is a hard requirement (locked from STATE.md v1.24 decision): display a small note explaining the grade formula (captain EV rate 40% + hit break-even 35% + chip ROI 25%) and that thresholds are v1.
- `overall_rank` per GW: the FPL `/entry/{teamId}/history/` response's `current[]` array includes `overall_rank` — confirm this field exists in the API response and add it to the `FPLHistoryCurrent` interface in the new route (it is NOT currently captured in the existing `season-analytics/route.ts` interface).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 124-Season Review*
*Context gathered: 2026-05-19*
