# Phase 98: Post-GW Review Core - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 98 extends the existing Squad > Review tab (Phase 73) to use live data instead of the hardcoded `SETTLED_GWS_PLACEHOLDER`, surfaces the best bench player by name, and adds auto-surface logic that navigates the user to Squad > Review when a new GW settles.

Deliverables:
1. **`useSettledGws` hook** — reads FPL bootstrap `events[]` to derive the last N settled GWs (replacing `SETTLED_GWS_PLACEHOLDER: [33, 34, 35]` in `page.tsx`). Settled = `event.finished === true && event.data_checked === true`.
2. **Best-bench-player fields** — add `best_bench_player_name: string` and `best_bench_player_pts: number` to `GwReview` type and compute them in `/api/gw-review` route (bench = picks with `position > 11`; pick with highest `total_points`).
3. **GwReviewTab bench row** — add a "Best bench: {name} — {pts}pts" info row below the existing 2×4 stat grid, matching the existing "Top scorer" / "Captain" row style.
4. **PGW-04 auto-surface** — `useEffect` in `page.tsx` fires on mount; reads the latest settled GW from `useSettledGws`; compares against `localStorage['pgw-reviewed:GW{N}']`; if unseen, calls `setActiveSection('squad')` + `setActiveSubTab('review')` and writes the flag immediately.

**No new pipeline work.** The FPL picks endpoint (`/entry/{id}/event/{gw}/picks/`) is already called by `/api/gw-review`. Bench player data is already available in the picks response — only the computation and type fields need adding.

**Out of scope:** PGW-03 (top-10k comparison), HIST-01/02/03 (decision history analytics), any Python pipeline changes.

</domain>

<decisions>
## Implementation Decisions

### Auto-surface behavior (PGW-04)
- **D-01:** Auto-navigate mechanism = switch to Squad > Review sub-tab on page load by calling `setActiveSection('squad')` + `setActiveSubTab('review')` inside a `useEffect` in `page.tsx`. No banner or additional UI needed.
- **D-02:** Navigate regardless of squad state. If no squad is loaded, the existing `GwReviewTab` empty-state ("Load your squad to see GW reviews") handles the graceful degradation — no special guard in the auto-surface logic.

### Auto-surface recurrence
- **D-03:** One-time per settled GW. When the auto-navigate fires, immediately write `localStorage['pgw-reviewed:GW{N}']` (where N is the latest settled GW number). On next page load, if the stored GW matches the latest settled GW, skip navigation.
- **D-04:** The "seen" flag is written at the moment of auto-navigation in the `useEffect` — not on component render or user interaction. Simple, no interaction required.
- **D-05:** localStorage key pattern: `pgw-reviewed:GW{N}` (e.g. `pgw-reviewed:GW37`). No TTL — the flag persists indefinitely, which is fine (settled GW data is immutable).

### Settled GW detection
- **D-06 (Claude's discretion):** Settled = `event.finished === true && event.data_checked === true`. Using both flags ensures the pipeline has confirmed the data before the review is surfaced. `data_checked` is the stricter gate — avoids surfacing when scores are processing but not confirmed.
- **D-07:** `useSettledGws` returns the last 3 settled GWs (matching the existing `SETTLED_GWS_PLACEHOLDER` window). This feeds both the `GwReviewTab` pill toggle and the auto-surface detection.

### Bench breakdown (PGW-01)
- **D-08:** Display format: `bench_pts_left` stat card (existing) is kept. Add a new info row below the 2×4 stat grid: "Best bench: {best_bench_player_name} — {best_bench_player_pts}pts". Same row style as the existing "Top scorer" and "Captain" rows (`rounded border px-3 py-2 flex items-baseline gap-2`).
- **D-09:** API changes: add `best_bench_player_name: string` and `best_bench_player_pts: number` to `GwReview` in `src/lib/types.ts`. Compute in `/api/gw-review/route.ts`: `benchPicks = picks.filter(p => p.position > 11)`, find the one with highest `total_points`.

### Claude's Discretion
- Exact `useSettledGws` stale time (suggest 1 hour — bootstrap events data changes at most once per GW)
- Whether `useSettledGws` calls the internal `/api/fpl/[...proxy]` route or fetches bootstrap directly (prefer proxy for consistency with existing patterns)
- TDD test coverage scope for the auto-surface `useEffect` (unit test via mocked `useSettledGws` + localStorage)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Phase 98 Infrastructure
- `src/components/squad/GwReviewTab.tsx` — existing Review tab component; renders bench_pts_left + captain comparison; will be extended with best bench row (D-08)
- `src/lib/hooks/useGwReview.ts` — existing data hook for `/api/gw-review`; pattern for `useSettledGws` to follow
- `src/app/api/gw-review/route.ts` — existing API route; will be extended to compute `best_bench_player_name` + `best_bench_player_pts` from bench picks (D-09)
- `src/lib/types.ts` lines 874–885 — `GwReview` interface; needs two new fields added

### Auto-surface Integration Point
- `src/app/page.tsx` lines 38–40 — `SETTLED_GWS_PLACEHOLDER` constant; replaced by `useSettledGws` hook (D-07)
- `src/app/page.tsx` line 255–257 — `GwReviewTab` render block; `settledGws` prop switches from placeholder to live hook output
- `src/app/page.tsx` lines 62–63 — `SubTab` union type and `Section` type; `setActiveSection` + `setActiveSubTab` are the nav mutation APIs for D-01

### Established Toggle/Hook Patterns
- `src/lib/hooks/useDecisionHistory.ts` — localStorage + TanStack Query cache-first pattern; reference for `useSettledGws` structure
- `src/components/squad/GwReviewTab.tsx` — existing row style (`rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-baseline gap-2`) used for "Top scorer" and "Captain" rows; replicate for "Best bench" row (D-08)

### FPL Bootstrap Events Shape
- FPL bootstrap: `events[].finished` (bool), `events[].data_checked` (bool), `events[].deadline_time` (ISO string), `events[].id` (GW number) — used by `useSettledGws` to compute settled GW list
- `/api/fpl/[...proxy]` — internal proxy route; use for bootstrap fetch (consistent with existing patterns)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGwReview` hook: exact pattern to mirror for `useSettledGws` (TanStack Query, numeric teamId guard, staleTime)
- `/api/gw-review/route.ts` `picks` array: already fetches `entry/{id}/event/{gw}/picks/` — bench picks (`position > 11`) are available; just add computation of `best_bench_player_name` + `best_bench_player_pts`
- `GwReviewTab` info rows: the "Top scorer" and "Captain" rows use an identical `flex items-baseline gap-2` pattern — add "Best bench" as a third row

### Established Patterns
- `SETTLED_GWS_PLACEHOLDER: number[]` in page.tsx is the direct replacement target; `useSettledGws` returns `number[]` so the type signature is unchanged
- localStorage key pattern used in the codebase: `decisionHistory:teamId:{id}` (Phase 96) — use `pgw-reviewed:GW{N}` as the analogous namespace for auto-surface seen-state (D-05)
- `setActiveSection` + `setActiveSubTab` are the existing state setters in `page.tsx`; they're the correct mechanism for programmatic navigation (D-01)

### Integration Points
- `page.tsx` needs: `import { useSettledGws } from '@/lib/hooks/useSettledGws'`; replace `SETTLED_GWS_PLACEHOLDER` with `useSettledGws()` output; add PGW-04 `useEffect` for auto-navigate
- `GwReview` type: two new non-optional fields (`best_bench_player_name: string`, `best_bench_player_pts: number`)
- `/api/gw-review/route.ts`: existing `picks` + `elementMap` already available; bench picks = `picks.filter(p => p.position > 11)`

</code_context>

<specifics>
## Specific Ideas

- Auto-surface localStorage key: `pgw-reviewed:GW{N}` where N is the GW number integer (e.g. `pgw-reviewed:GW37`)
- "Best bench" row label: `"Best bench"` (matching terse style of existing "Top scorer" / "Captain" labels)
- `useSettledGws` returns the last 3 settled GWs in ascending order (same as the current placeholder `[33, 34, 35]`), matching the GwPillToggle expectations in GwReviewTab

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 98-post-gw-review-core*
*Context gathered: 2026-05-12*
