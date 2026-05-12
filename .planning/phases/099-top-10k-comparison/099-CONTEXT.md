# Phase 99: Top-10k Comparison - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 99 extends the existing `GwReviewTab` (shipped in Phase 73/98) with two new pieces of information:

1. **Benchmark score comparison** — replaces the existing "FPL average" StatCard with a better benchmark: top-10k average if a single-request endpoint is found, otherwise the dream team total (sum of `dream-team/{gw}/` XI points). The StatCard shows the benchmark score plus a delta vs the user's GW score.

2. **Template player misses** — a compact info row below "Best bench" listing up to 3 dream team players the user didn't own that GW, sorted by points scored descending. Omitted entirely when the user owned all dream team players.

**Single new API endpoint used:** `https://fantasy.premierleague.com/api/dream-team/{gw}/` (via existing `/api/fpl/[...proxy]` internal proxy). Researcher must also confirm whether any single-request top-10k average endpoint exists.

**No pipeline changes.** All data is client-fetched via the existing FPL proxy pattern.

**Out of scope:** HIST-01/02/03 (decision history analytics), any Python pipeline changes, phase 100/101 features.

</domain>

<decisions>
## Implementation Decisions

### Benchmark data source (D-01 to D-03)
- **D-01:** Researcher investigates whether a single-request FPL endpoint for top-10k average score exists (e.g., a GW stats endpoint, leaderboard summary, or any other documented/undocumented path). If found and returns top-10k average in ≤2 API calls: use it, label the StatCard "Top 10k avg". If not found: fall back to `dream-team/{gw}/` endpoint.
- **D-02 (fallback):** Dream team fallback score = **sum of the 11 dream team players' individual GW points** from the `dream-team/{gw}/` response. Label the StatCard "Dream team".
- **D-03:** Hard constraint — single-request-only. Pagination through league standings or iterating entries is out of scope. No approach that requires >2 API calls per GW.

### Template players (D-04 to D-06)
- **D-04:** Template players = **dream team players not in the user's 15-player squad** for that GW. The dream team endpoint is always called regardless of whether a top-10k avg endpoint is found (because the template player list is independent of which benchmark score is used).
- **D-05:** Show **top 3 misses**, sorted by GW points scored descending (highest-impact miss first).
- **D-06:** When the user owned all dream team players (zero misses) → **omit the "Missed" row entirely** (no "you owned all" message).

### UI placement (D-07 to D-09)
- **D-07:** **Replace** the existing "FPL average" StatCard (4th card in the 2×4 stat grid) with the benchmark card. The grid remains 2×4. The label switches between "Top 10k avg" and "Dream team" depending on what data is available. The delta (user score minus benchmark) is surfaced as part of the card — exact rendering (sub-label, sentiment colour, secondary line) is Claude's discretion, but the grid card itself is the placement.
- **D-08:** Template misses appear as a **new info row below "Best bench"**, matching the existing info row style (`rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2`). Compact format: label "Missed" + names with points in parens: `Salah (14), Haaland (12), Saka (10)`.
- **D-09:** When the top-10k or dream-team data is loading or unavailable, degrade gracefully — the existing "FPL average" value is shown unchanged (no regression), and the "Missed" row is simply omitted.

### Claude's Discretion
- Exact StatCard delta rendering: whether delta appears as a second value line ("−66 vs you"), in the label ("Dream team −66"), or via sentiment colour on the score. Keep it compact — the StatCard is small.
- Whether to extend the existing `/api/gw-review` route to include dream team data (single server call for everything), or fetch dream team separately client-side via `useQuery`. Extending the route is preferred for consistency (all GW review data in one place).
- `GwReview` type extension: add `benchmark_score: number`, `benchmark_label: string`, `missed_players: { name: string; pts: number }[]` — or equivalent field names that are descriptive. Both non-optional (empty array for missed_players when no misses).
- Dream team players: the `element` field is a player ID. Cross-reference against the user's squad picks to determine "not owned". Use `web_name` from the existing `/api/players` data or from the FPL picks response already available in the route.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 99 integration targets
- `src/components/squad/GwReviewTab.tsx` — component to extend; StatCard grid + info rows; D-07/D-08 placement
- `src/lib/types.ts` GwReview interface (lines ~873–896) — needs benchmark + missed_players fields added
- `src/app/api/gw-review/route.ts` — API route to extend with dream-team call; already has FPL picks + elementMap

### FPL proxy and data patterns
- `src/app/api/fpl/[...proxy]/route.ts` — internal FPL proxy; use for `dream-team/{gw}/` call
- `src/lib/fpl-adapter.ts` — FPLBootstrapSchema; pattern for any new Zod schema additions

### Prior phase context
- `.planning/phases/98-post-gw-review-core/98-CONTEXT.md` — Phase 98 decisions (info row style, GwReview type history, auto-surface pattern); D-08 row style is defined here
- `.planning/phases/98-post-gw-review-core/98-02-SUMMARY.md` — what was shipped in the route extension

### FPL API shape to research
- `https://fantasy.premierleague.com/api/dream-team/{gw}/` — researcher must document the response shape (fields, types, whether it includes per-player points or just element IDs)
- Any single-request top-10k average endpoint the researcher discovers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatCard` sub-component in `GwReviewTab.tsx` — accepts `label`, `value`, `sentimentClass`; may need minor extension for delta sub-label (D-07)
- Info row pattern (`rounded border px-3 py-2 flex items-baseline gap-2`) — reuse verbatim for "Missed" row (D-08)
- `/api/fpl/[...proxy]` — already handles FPL calls; `dream-team/{gw}/` just needs a new path passed through
- `useGwReview` hook — TanStack Query pattern to follow for any new hook; or extend the route to include dream team data

### Established Patterns
- The existing `/api/gw-review` route already: fetches FPL picks, builds `elementMap` (player ID → web_name), has access to the squad. Adding `dream-team/{gw}/` as a parallel fetch in the same route is the lowest-friction approach.
- `gw_review_gw{N}.json` pipeline cache provides `average_score` (FPL average from `average_entry_score`). The new benchmark replaces this in the UI — but the pipeline cache file doesn't need updating (the new data comes from runtime FPL calls, not pipeline).
- Selected_by_percent is available on MergedPlayer but NOT used for template definition in Phase 99 (dream team approach was chosen instead).

### Integration Points
- `GwReview` type: the `/api/gw-review` route response must include the new benchmark fields; `GwReviewTab` reads them for rendering
- Player ID matching: dream team returns `element` (FPL player ID); the route already has `elementMap` built from picks; need to check against squad picks (position 1–15) to determine "not owned"
- The 4th StatCard slot (currently "FPL average") is the exact slot to replace (D-07)

</code_context>

<specifics>
## Specific Ideas

- StatCard label toggle: "Top 10k avg" (if top-10k endpoint found) vs "Dream team" (fallback)
- Missed row label: "Missed" (terse, matching "Best bench" / "Top scorer" style)
- Missed row format: `Salah (14), Haaland (12), Saka (10)` — name + parens + pts
- Delta sentiment: green when user score ≥ benchmark, red/amber when below (same logic as existing `scoreBeatsAverage` check for GW Score card)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 099-top-10k-comparison*
*Context gathered: 2026-05-12*
