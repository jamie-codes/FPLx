# Phase 100: Decision History Analytics - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 100 extends the existing Back tab (AccuracyTab) with three season-level analytics features derived from FPL data:

1. **HIST-01**: Captain hit rate headline metric — added inline to the existing `SeasonSummaryHeader`
2. **HIST-02**: Chip ROI — new section below the existing `RegretChart` in Back tab
3. **HIST-03**: Hit break-even tracking — new section below HIST-02 in Back tab

All three features live in the existing Back tab. No new AccuracyTab sub-tab. The Back tab already has `SeasonSummaryHeader → RegretChart → per-GW table` (Phase 96); Phase 100 extends that layout.

**No new pipeline work.** Data comes entirely from FPL API endpoints.

**Out of scope:** New AccuracyTab sub-tabs, BACK-02 (transfer regret backtester), any Python pipeline changes, Wildcard chip ROI.

</domain>

<decisions>
## Implementation Decisions

### UI Placement
- **D-01:** All three HIST features live in the existing **Back tab**. No new sub-tab added to AccuracyTab. HIST-01 extends `SeasonSummaryHeader`; HIST-02 and HIST-03 are new sections rendered below the existing `RegretChart` and above the per-GW table (or below it — Claude's discretion on ordering).

### HIST-01: Captain Hit Rate
- **D-02:** Hit rate definition = **% of GWs where `regret ≤ 0`** (user's captain scored ≥ model ceiling pick). Computed purely from existing `RegretEntry` data in `useDecisionHistory`. No new API calls, no pipeline work.
  - `hitRate = entries.filter(e => e.regret !== null && e.regret <= 0).length / entries.filter(e => e.regret !== null).length`
  - Only GWs with non-null regret count (both user pick and model snapshot available).
- **D-03:** Display format: appended **inline to `SeasonSummaryHeader`** alongside the existing "Model better / You won / Tied" row — e.g. `Captain hit rate: 4/12 GWs (33%)`. Minimal new markup; one additional stat in the existing layout.

### HIST-02: Chip ROI
- **D-04:** Chips shown: **BB (`bboost`), TC (`3xc`), FH (`freehit`) only** — Wildcard excluded (no meaningful single-GW point swing comparison).
- **D-05:** Comparison metric: **actual GW score vs manager's season average GW score** — e.g. "Bench Boost GW29: 74pts vs your 52-pt avg → +22pts".
- **D-06:** Data assembled server-side in new `/api/season-analytics` route (see D-08).

### HIST-03: Hit Break-Even Tracking
- **D-07:** Break-even window = **rest of season** (cumulative from transfer GW onwards). Hit broke even if `sum(element_in_pts, gw_transfer..38) > sum(element_out_pts, gw_transfer..38) + 4`.
  - Show outcome as ✓ (broke even) or ✗ (didn't) per hit, with the net points gain/loss.
- **D-08 (hit identification):** Cross-reference `entry_history[].event_transfers_cost > 0` (from `/entry/{id}/history/`) with `/entry/{id}/transfers/`. GWs with `event_transfers_cost > 0` are hit GWs; transfers in those GWs are hit transfers.
- **D-09:** Data assembled server-side in `/api/season-analytics` (see D-10).

### Data Assembly — New `/api/season-analytics` Route
- **D-10:** New server-side API route `GET /api/season-analytics?teamId={id}`. Fetches in sequence/parallel:
  1. `/entry/{teamId}/history/` — chips array + entry_history (per-GW scores + event_transfers_cost)
  2. `/entry/{teamId}/transfers/` — full transfer list
  3. `/element-summary/{id}/` per hit player (element_in + element_out for each hit) — fetched in parallel; ~10–20 calls per season
  - Returns ready-to-render `{ chipRoi: ChipRoiEntry[], hitTracking: HitTrackingEntry[] }`.
  - Mirrors `/api/decision-history` pattern (blob reads + FPL API joins).
- **D-11:** New client hook **`useSeasonAnalytics(teamId)`** — TanStack Query, disabled when teamId is null, staleTime 6 hours (season data rarely changes). Follows `useDecisionHistory` and `useChipHistory` patterns.
- **D-12 (auth guard):** When `teamId` is null/missing, HIST-02 and HIST-03 sections render a "Load your squad to see chip ROI / hit tracking" prompt — same graceful degradation as BackTab empty state. HIST-01 always renders (derives from `useDecisionHistory` which is already guarded).

### Claude's Discretion
- Exact section ordering within Back tab (HIST-02 vs HIST-03 first, or interleaved with per-GW table)
- `ChipRoiEntry` and `HitTrackingEntry` type shapes in `src/lib/types.ts`
- Whether `useSeasonAnalytics` caches to localStorage (ring buffer like `useDecisionHistory`) or is fetch-only
- Column layout for HIST-03 hit tracking rows (GW, player in, player out, net pts, broke even badge)
- Shared loading/error state for HIST-02 + HIST-03 (one `useSeasonAnalytics` query feeds both sections)
- `computeSeasonSummary()` extension vs separate helper for HIST-01 hit rate computation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Back Tab (Extend — MUST READ)
- `src/components/accuracy/BackTab.tsx` — full Back tab component; `SeasonSummaryHeader` (HIST-01 target), `RegretChart`, per-GW table; Phase 100 adds HIST-02 and HIST-03 sections
- `src/components/accuracy/AccuracyTab.tsx` lines 41–46, 1084–1100 — sub-tab nav + render blocks; Phase 100 only touches the `subTab === 'back'` branch

### Existing Hooks (Pattern + Extension)
- `src/lib/hooks/useDecisionHistory.ts` — provides `RegretEntry[]` for HIST-01; HIST-01 computation is a derived metric on this data
- `src/lib/hooks/useChipHistory.ts` — existing hook calling `/api/fpl/entry/{teamId}/history/`; `useSeasonAnalytics` calls the same endpoint but needs `entry_history` too (currently stripped by this hook)
- `src/lib/regret.ts` — `computeSeasonSummary()` and `computeRegret()` utilities; HIST-01 extends season summary

### API Route Pattern (Mirror)
- `src/app/api/decision-history/route.ts` — direct pattern for new `/api/season-analytics` route (FPL API fetch, error handling, response shape)
- `src/app/api/gw-review/route.ts` — secondary pattern for FPL authenticated endpoint usage

### Types
- `src/lib/types.ts` lines 675–703 — `RegretEntry`, `DecisionHistory`; new `ChipRoiEntry`, `HitTrackingEntry`, `SeasonAnalytics` types go here

### Requirements
- `.planning/REQUIREMENTS.md` §HIST-01, §HIST-02, §HIST-03 — requirement text and traceability
- `.planning/ROADMAP.md` §"Phase 100: Decision History Analytics" — success criteria 1–4 (including auth guard SC-4)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BackTab.tsx` — `SeasonSummaryHeader` component (extend with captain hit rate stat, D-03); `RegretChart` + per-GW table stay unchanged
- `computeSeasonSummary()` in `src/lib/regret.ts` — already computes total regret, modelBetter, userWon, tied counts; extend to include `captainHitRate` (D-02)
- `useDecisionHistory(teamId)` — already returns `RegretEntry[]`; no changes needed to the hook itself; HIST-01 computed in component from the same data
- `useChipHistory(teamId)` — same endpoint as needed by `useSeasonAnalytics`; both call `/api/fpl/entry/{teamId}/history/` through the internal proxy; `useSeasonAnalytics` is a superset

### Established Patterns
- **TDD** — write failing tests first (consistent across v1.17)
- **TanStack Query hook** — `queryKey`, `queryFn`, `enabled`, `staleTime: 6h`, `retry: 1`; disabled when `teamId` is null
- **Dark mode** — `.dark:` variants on all new Tailwind classes
- **Loading / error / empty state** — three-guard pattern at top of render (see BackTab lines 100–130); `useSeasonAnalytics` section follows the same guard
- **localStorage try/catch** — all localStorage reads wrapped in try/catch (established pattern throughout)

### Integration Points
- `BackTab.tsx` — add `useSeasonAnalytics(teamId)` call; render HIST-02 + HIST-03 sections conditionally on teamId
- `src/lib/regret.ts` — extend or add helper to compute `captainHitRate` from `entries`
- `src/lib/types.ts` — add `ChipRoiEntry`, `HitTrackingEntry`, `SeasonAnalytics` types
- `src/app/api/season-analytics/route.ts` — new file, follows `decision-history/route.ts` structure
- `src/lib/hooks/useSeasonAnalytics.ts` — new file, follows `useDecisionHistory.ts` structure

</code_context>

<specifics>
## Specific Ideas

- HIST-01 format: `Captain hit rate: 4/12 GWs (33%)` — fraction + percentage in parentheses, inline in SeasonSummaryHeader
- HIST-02 example: `Bench Boost GW29: 74pts vs your 52-pt avg → +22pts ✓` / `Triple Captain GW22: 48pts vs your 52-pt avg → -4pts ✗`
- HIST-03 example: `GW31 hit: Salah in, Haaland out | Remaining: +12pts gain → ✓ broke even`
- FPL element-summary endpoint for player points: `GET /api/fpl/element-summary/{id}/` → response has `history: [{ round, total_points }]`; filter to rounds ≥ transfer event
- FPL transfers endpoint: `GET /api/fpl/entry/{teamId}/transfers/` → `[{ element_in, element_out, event, time }]`
- FPL entry history endpoint: `GET /api/fpl/entry/{teamId}/history/` → `{ chips: [{name, event}], current: [{event, points, event_transfers_cost}] }` — note field is `current` not `entry_history` in the raw FPL response

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 100-decision-history-analytics*
*Context gathered: 2026-05-12*
