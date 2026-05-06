# Phase 62: MC Rank Simulator & Captain Integration - Research

**Researched:** 2026-05-06
**Domain:** React/Next.js 16, Recharts v3, TanStack Query v5, FPL proxy API, client-side MC analytics
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `useEntryRank(teamId)` hook fetches `GET /api/fpl/entry/${teamId}/` via existing FPL proxy; reads `summary_overall_rank` + `summary_overall_points`. No auth required. 5-min staleTime. Enabled when teamId is defined; degrades to prompt otherwise (SC-05).
- **D-02:** Display: Current rank + P(rank gain) + P(rank drop) as the three primary stats. No P(top-10k).
- **D-03:** Beat-the-average heuristic: P(rank gain) = P(simulated XI score > FPL GW average). P(rank drop) = P(simulated XI score < FPL GW average). Both shown.
- **D-04:** FPL GW average from `events[N].average_entry_score`. If not already in the data path, add `gw_average_pts` as a top-level field in `merged_players.json` via a small `run.py` addition.
- **D-05:** Recharts for the fan chart. `AreaChart` with upper/lower confidence band lines (`<Area>` for confidence band, `<Line>` for mean). No existing chart library in codebase.
- **D-06:** Cumulative projected score over 5 GWs. X-axis: "Start", "GW+1" through "GW+5". Y-axis: cumulative points. Mean line = cumulative sum of XI total xPts_1gw × N.
- **D-07:** Confidence band computed analytically from p10/p90. σ_player = (p90_pts - p10_pts) / 2.56. σ_XI = √(Σ σ_player²). Captain's contribution doubled. After N GWs: band = cumMean ± √N × σ_XI.
- **D-08:** BGW players: p10=0, p90=0 per Phase 61. Their contribution to mean and variance is zero.
- **D-09:** Captain selection uses current captain from squad picks. Double mean and σ contribution.
- **D-10:** Alternative XI = transfer scenario (one player replaced). Not a within-squad swap.
- **D-11:** Two dropdowns: Sell from current squad (position-filtered); Buy from all available players at same position, sorted by xPts_1gw desc, excluding squad players. Affordability flagged.
- **D-12:** One transfer at a time only.
- **D-13:** Both trajectory lines on the same chart. Current XI = solid zinc. Alt XI = dashed amber. Confidence band for current XI only (not alt XI).
- **D-14:** 4th Plan sub-tab: `Planner | Manual Plan | Route Tree | Rank Sim`.
- **D-15:** Sub-tab id `rank-sim`, label `Rank Sim` (both desktop and mobile).
- **D-16:** MC label priority cascade: Best P(haul) > Highest ceiling (p90) > Lowest floor (p10, highest = most reliable). One label per player, three labels max across 5 candidates.
- **D-17:** MC badge: `text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1` — mirrors `DangerousToFadeBadge`. Shows label + value.
- **D-18:** TC callout below EO toggle, above candidate list. Format: "TC: [web_name] — [N]% P(haul)". Hidden when MC fields absent.

### Claude's Discretion

- Whether to show "~" or "estimate" disclaimer on P(rank gain/drop) labels.
- Chart Y-axis label and GW number vs "GW+N" offset labels.
- Whether to show confidence band for alt XI trajectory (opted: current XI only for clarity).
- Exact badge styling for MC labels in `CandidateRow`.

### Deferred Ideas (OUT OF SCOPE)

- P(top-10k): requires modelling full FPL score distribution tails.
- Two-transfer alternative XI comparison.
- 3GW/5GW MC windows (full multi-GW simulation).
- Within-squad lineup swap in rank simulator.
- haul_prob replacing sigma-tercile ceiling badge in CandidateRow.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MC-03 | User can open a 5-GW rank trajectory simulator showing P(rank gain) and P(rank drop) for their current XI vs an alternative XI defined by swapping players | Enabled by Phase 61 MC fields (blank_prob, haul_prob, p10_pts, p90_pts) on MergedPlayer. Implemented as RankSimTab with Recharts AreaChart. useEntryRank hook provides summary_overall_rank. gw_average_pts needed from run.py pipeline addition. |
| MC-04 | Each captain candidate in CaptainPicksPanel shows an augmented MC label ("Highest ceiling", "Lowest floor", or "Best P(haul)") with corresponding simulated value; TC recommendation surfaces player with highest P(haul) | Enabled by haul_prob, p10_pts, p90_pts on MergedPlayer (already typed as optional fields). Implemented as computeMCLabels() pure function + McLabel badge + TC callout in CaptainPicksPanel. |

</phase_requirements>

---

## Summary

Phase 62 is a pure frontend UI phase with one minimal pipeline addition. It consumes Monte Carlo fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) written to `merged_players.json` by Phase 61's `simulate.py`, and builds two distinct deliverables: (1) a new Plan sub-tab with a Recharts fan chart showing 5-GW rank trajectory for current XI vs a 1-transfer alternative, and (2) MC-derived label badges and a TC callout in `CaptainPicksPanel`.

The codebase is well-prepared for both deliverables. `MergedPlayer` already declares all four MC fields as optional. `CaptainPicksPanel`'s `CandidateRow` and `DangerousToFadeBadge` are the exact templates to follow for MC badge styling. The FPL proxy pattern (`/api/fpl/[...proxy]/route.ts`) and `useRivals.ts` are the canonical references for building `useEntryRank`. `page.tsx` SECTIONS array and RouteTreeTab prop shape define exactly what integration edits are required.

The one pipeline addition needed (D-04): `events[N].average_entry_score` is already present in `fpl_bootstrap.json` with non-zero values for finished GWs — verified in the local cache (GW34 = 36, GW33 = 66, etc.). The next GW's value is 0 (pre-GW). Run.py needs to write `gw_average_pts` as a top-level field in `merged_players.json` from the bootstrap's next/current event — or alternatively, hardcode the last finished GW's average from the already-saved `gw_review_gw{N}.json` files (written by run.py's PGW-02 step). The gw_review files already contain `average_score` — this is a simpler, zero-pipeline-addition path.

**Primary recommendation:** Use the existing `gw_review_gw{N}.json` cache files (already contain `average_score` per GW) via a new `/api/gw-average` route or by adding `gw_average_pts` as a top-level field in `merged_players.json`. Reading from the `gw_review` files avoids touching `run.py` (lower risk) but requires a new small API route. Adding to `run.py` is 3 lines and matches D-04 verbatim.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 5-GW trajectory math (mean, σ, band) | Browser/Client | — | Pure TypeScript computation over MergedPlayer arrays; no server round-trip needed |
| MC labels (computeMCLabels) | Browser/Client | — | Pure function over MergedPlayer[] — same pattern as computeEOCandidates in eo-candidates.ts |
| Current rank fetch | Frontend (hook) | API (FPL proxy) | useEntryRank reads /api/fpl/entry/{id}/ via existing bare proxy — no new API route needed |
| GW average score | API/Pipeline | Browser/Client | Must come from bootstrap or gw_review files; not computable client-side without a fetch |
| Squad picks (current XI) | Browser/Client (hook) | — | useSquad(submittedId) + useMyTeam(isAuthenticated) already cached via TanStack Query |
| Player pool (buy dropdown) | Browser/Client (hook) | — | usePlayers() already cached |
| Fan chart render | Browser/Client | — | Recharts AreaChart + Line, client-side SVG |
| Alternative XI computation | Browser/Client | — | Filter + replace in squad array; pure TypeScript |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 (install) | Fan chart (AreaChart, Area, Line) | Locked by D-05; React-native SVG charts; bundles own TypeScript types |
| @tanstack/react-query | ^5.95.2 (existing) | useEntryRank hook data fetching | Already the project standard for all API hooks |
| TypeScript | ^5 (existing) | computeMCLabels pure function | Project standard |
| Tailwind v4 | ^4 (existing) | Styling badges, tabs, dropdowns | Project standard; no shadcn |
| Vitest ^4.1.2 | (existing) | Unit tests for pure functions | Project standard test runner |
| @testing-library/react | ^16.3.2 (existing) | RTL tests for RankSimTab, CaptainPicksPanel | Project standard for component tests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-is | ^19.0.0 (via recharts peerDep) | Recharts peer dep | Required by recharts — check if already satisfied by React 19 install |
| zod | ^4.3.6 (existing) | Entry rank API response validation | Use for parsing /api/fpl/entry/{id}/ response shape |

**Version verification:**
- recharts latest: `3.8.1` [VERIFIED: npm registry]
- recharts ships its own TypeScript types (`types/index.d.ts`) [VERIFIED: npm view recharts@3.8.1 types]
- `@types/recharts` (version 2.0.1 on npm) is for Recharts v1 only — do NOT install it [VERIFIED: npm registry check]

**Installation:**
```bash
npm install recharts
```

Recharts v3 peer deps: `react ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`, `react-dom`, `react-is`. The project runs React 19.2.4 — fully compatible. [VERIFIED: npm view recharts@3.8.1 peerDependencies]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | D3 direct | D3 requires manual SVG management; Recharts wraps D3 in React components — simpler for this use case |
| Recharts | Victory | Less popular, worse TypeScript story; Recharts is the ecosystem standard |
| Native `<select>` dropdowns | React Select / Combobox | Native select matches existing project pattern (TransferPanel uses native elements); avoids extra dependency |

---

## Architecture Patterns

### System Architecture Diagram

```
usePlayers() ──────────────────────────────────────────────┐
useSquad(submittedId) ─────────────────────────────────────┤
useMyTeam(isAuthenticated) ────────────────────────────────┤
                                                           ↓
                                                   RankSimTab
                                                  /          \
                               computeXITrajectory()    Transfer dropdowns
                               (pure TypeScript)         (sell/buy <select>)
                                        |
                                  ChartPoint[6]  ←── D-07 math
                                        |
                                   Recharts AreaChart
                                  (fan chart + alt line)
                                        |
                                   SVG render

useEntryRank(teamId) ──────────────────────────────────────┐
                                                           ↓
                                                  Rank context header
                                                  (rank | P(gain) | P(drop))

/api/fpl/entry/{id}/ ──────────────────────────────────────┘
  (existing [...proxy] route)

usePlayers() ─────────────────────────────────────────────┐
computeEOCandidates() ────────────────────────────────────┤
                                                          ↓
                                               CaptainPicksPanel
                                              /                  \
                               computeMCLabels()          TC callout
                               (pure TypeScript,          (haul_prob winner)
                               greedy cascade)
                                        |
                                 McLabel badges on
                                 CandidateRow (up to 3)
```

### Recommended Project Structure

```
src/
├── components/planner/
│   ├── RankSimTab.tsx          # New: 4th Plan sub-tab
│   └── RankSimTab.test.tsx     # New: RTL tests (no-squad, squad-loaded, alt-XI states)
├── components/captaincy/
│   ├── CaptainPicksPanel.tsx   # Modified: add TC callout + McLabel badge
│   └── CaptainPicksPanel.test.tsx  # Modified: add MC label + TC callout tests
├── lib/
│   ├── mc-labels.ts            # New: computeMCLabels() pure function
│   ├── mc-labels.test.ts       # New: unit tests for label priority cascade
│   └── hooks/
│       └── useEntryRank.ts     # New: ~15-line hook, FPL entry endpoint
└── app/
    └── page.tsx                # Modified: add 'rank-sim' to SECTIONS + SubTab + render
```

### Pattern 1: useEntryRank Hook (~15 lines)

Follows `useRivals.ts` pattern exactly: TanStack Query, FPL proxy, staleTime 5 min, enabled guard.

```typescript
// Source: mirrors src/lib/hooks/useRivals.ts pattern (VERIFIED: codebase grep)
'use client'
import { useQuery } from '@tanstack/react-query'

interface EntryRankData {
  summary_overall_rank: number
  summary_overall_points: number
}

export function useEntryRank(teamId: string | null) {
  return useQuery<EntryRankData>({
    queryKey: ['entry-rank', teamId],
    queryFn: async () => {
      const res = await fetch(`/api/fpl/entry/${teamId}/`)
      if (!res.ok) throw new Error(`Entry fetch failed: ${res.status}`)
      const data = await res.json()
      return {
        summary_overall_rank: data.summary_overall_rank,
        summary_overall_points: data.summary_overall_points,
      }
    },
    enabled: !!teamId && /^\d+$/.test(teamId),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}
```

The FPL entry endpoint `GET /fantasy.premierleague.com/api/entry/{id}/` returns `summary_overall_rank` and `summary_overall_points` at the top level. The existing `[...proxy]/route.ts` proxies this without modification.

### Pattern 2: computeMCLabels Pure Function

Follows `computeEOCandidates` pattern from `eo-candidates.ts` — pure function, exported, testable.

```typescript
// Source: pattern mirrors src/lib/eo-candidates.ts (VERIFIED: codebase grep)
import type { MergedPlayer } from '@/lib/types'

export type MCDimension = 'haul' | 'ceiling' | 'floor'

export interface MCLabel {
  playerId: number
  dimension: MCDimension
  label: string  // "Best P(haul)" | "Highest ceiling" | "Lowest floor"
  value: string  // "41%" | "14.2 pts" | "4.8 pts"
}

export function computeMCLabels(candidates: MergedPlayer[]): MCLabel[] {
  // Priority cascade: haul_prob > p90_pts > p10_pts (D-16)
  // One label per player; greedy assignment
  const labelled = new Set<number>()
  const result: MCLabel[] = []

  // Only operate when MC fields present
  const hasMC = candidates.some(c => c.haul_prob !== undefined)
  if (!hasMC) return []

  // 1. Best P(haul) — highest haul_prob
  // 2. Highest ceiling — highest p90_pts (among unlabelled)
  // 3. Lowest floor — highest p10_pts (i.e. most reliable minimum, among unlabelled)
  // ...
  return result
}
```

### Pattern 3: Fan Chart Data Computation

```typescript
// Source: CONTEXT.md D-06, D-07 (CITED: 062-CONTEXT.md)
interface ChartPoint {
  gw: string      // "Start" | "GW+1" | ... | "GW+5"
  mean: number    // cumulative mean score for current XI
  p10: number     // cumulative p10 floor
  p90: number     // cumulative p90 ceiling
  altMean?: number // cumulative mean for alt XI
}

function computeXITrajectory(
  squadPickIds: number[],  // 11 starting pick element IDs
  captainId: number,
  playerMap: Map<number, MergedPlayer>,
): ChartPoint[] {
  // σ_player = (p90_pts - p10_pts) / 2.56
  // σ_XI = √(Σ σ_player²) with captain σ doubled
  // After N GWs: mean = N × gwMean; band = cumMean ± √N × σ_XI
  // Origin: { gw: 'Start', mean: 0, p10: 0, p90: 0 }
  // GW+1..GW+5: { gw: 'GW+N', mean: N*gwMean, p10: N*gwMean - √N*σ, p90: N*gwMean + √N*σ }
}
```

### Pattern 4: page.tsx Integration (Additive Edits Only)

```typescript
// Source: VERIFIED src/app/page.tsx (codebase read)
// 4 additive edits:
// 1. Add 'rank-sim' to SubTab union type
export type SubTab = '...' | 'route-tree' | 'rank-sim'

// 2. Add to Plan section SECTIONS array
{ id: 'rank-sim' as SubTab, label: 'Rank Simulator', mobileLabel: 'Rank Sim' }

// 3. Import RankSimTab
import { RankSimTab } from '@/components/planner/RankSimTab'

// 4. Add render conditional (same pattern as RouteTreeTab)
{activeSection === 'plan' && activeSubTab === 'rank-sim' && (
  <RankSimTab submittedId={submittedId} teamId={submittedId} horizon={planHorizon} bank={bankBalance} />
)}
```

**Note on RouteTreeTab prop shape:** RouteTreeTab uses `{ submittedId, horizon, onSwitchSubTab }` — NOT `teamId` or `bank`. RankSimTab should define its own prop shape matching what page.tsx can provide: `submittedId` and `teamId` (same value), `planHorizon`. The `bank` prop is NOT in page.tsx's scope at the plan section render site; bank comes from `useSquad`/`useMyTeam` inside the component itself.

### Pattern 5: Recharts AreaChart + ComposedChart for Fan Chart

The UI-SPEC uses `AreaChart` with `Area` stacking for the confidence band and `Line` for mean lines. In Recharts v3, mixing `Area` and `Line` in a single `AreaChart` requires using `ComposedChart` instead.

```tsx
// Source: Recharts v3 ComposedChart pattern (CITED: recharts.github.io)
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

<ResponsiveContainer width="100%" height={256}>
  <ComposedChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.3)" />
    <XAxis dataKey="gw" tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} width={32} />
    <Tooltip content={<CustomTooltip />} />
    {/* Confidence band: fill p90 area, then erase below p10 */}
    <Area type="monotone" dataKey="p90" stroke="none" fill="rgba(161,161,170,0.25)" fillOpacity={1} legendType="none" activeDot={false} isAnimationActive={false} hide />
    <Area type="monotone" dataKey="p10" stroke="none" fill="var(--background)" fillOpacity={1} legendType="none" activeDot={false} isAnimationActive={false} hide />
    {/* Current XI mean — solid zinc */}
    <Line type="monotone" dataKey="mean" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
    {/* Alt XI mean — dashed amber (conditional) */}
    {altXIComputed && (
      <Line type="monotone" dataKey="altMean" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
    )}
  </ComposedChart>
</ResponsiveContainer>
```

**CRITICAL Recharts v3 pitfall:** In v3, `tooltipType="none"` was an old v2 prop. In v3, use `hide={true}` on `Area` components you want excluded from the Tooltip. With `includeHidden={false}` (Tooltip default), hidden series are invisible in tooltips. [VERIFIED: recharts.github.io/en-US/api/Tooltip/ + v3 migration guide]

**CRITICAL: `AreaChart` vs `ComposedChart`:** The UI-SPEC uses `AreaChart` with `Line` components. In Recharts v3, `AreaChart` does not support `Line` children directly — use `ComposedChart` when mixing `Area` and `Line` in the same chart. [ASSUMED — verify by reading Recharts v3 source/docs before implementing]

### Anti-Patterns to Avoid

- **Dynamic Tailwind classes:** Do NOT write `style={{ width: `${value}px` }}` using template literals in className — use `style={{ width: ... }}` inline (project-established Pitfall 4 from Phase 54).
- **Recharts height as Tailwind class:** `<ResponsiveContainer>` `height` prop takes a number, not a Tailwind class. Use `height={256}` (mobile) and JS/media query logic if needed.
- **`tooltipType="none"` (v2 prop):** Use `hide={true}` on Area components instead for v3.
- **`@types/recharts` installation:** The v2 `@types/recharts` package is incompatible with v3. Recharts v3 ships its own types in `types/index.d.ts` — do NOT install `@types/recharts`.
- **Module-level `pLimit` (from useRivals.ts comment):** pLimit in hooks must be inside queryFn closure, not module-level. Not applicable here (no concurrency needed for useEntryRank), but note for future reference.
- **Mixing `AreaChart` and `Line`:** Use `ComposedChart` for mixed chart types.
- **p10 erase-fill in dark mode:** The `fill="var(--background)"` trick for the p10 erase area must use the CSS variable (`--background` = `#0a0a0a` in dark, `#ffffff` in light). Verify the project's `globals.css` defines `--background` before implementing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG fan chart | Recharts ComposedChart | D3 stacking, scaling, axis, responsive container — all handled |
| Data fetching + caching | Custom fetch + useState | TanStack Query useQuery | Dedup, stale-while-revalidate, retry, error state all handled |
| Squad picks | Re-fetch FPL directly | useSquad / useMyTeam hooks | Already cached in TanStack Query; avoids duplicate requests |
| Input validation (teamId) | Custom regex | `/^\d+$/.test(teamId)` guard | Established pattern from useRivals.ts (T-58-01 mitigation) |

**Key insight:** The MC math (σ derivation, cumulative trajectory) is the correct hand-roll candidate because it's specific to this phase's analytical model — no library handles this exact formula.

---

## Common Pitfalls

### Pitfall 1: Recharts `AreaChart` Does Not Accept `Line` Children

**What goes wrong:** Executor uses `<AreaChart>` per UI-SPEC reference and tries to add `<Line>` for the alt XI mean. The component silently ignores `Line` children inside `AreaChart` in some Recharts versions, or renders incorrectly.
**Why it happens:** UI-SPEC mentions `AreaChart` and `Line` but the correct Recharts v3 component for mixing `Area` + `Line` is `ComposedChart`.
**How to avoid:** Use `ComposedChart` as the root chart element when combining `Area` and `Line` series.
**Warning signs:** Alt XI line doesn't appear in chart; TypeScript props may or may not complain depending on version.

### Pitfall 2: Confidence Band Erase-Fill Color in Dark Mode

**What goes wrong:** The p10 `fill="rgba(255,255,255,1)"` (white erase) is visible as a white band in dark mode against the dark background.
**Why it happens:** The erase technique requires matching the canvas background. Dark mode uses `#0a0a0a` / `bg-zinc-900`.
**How to avoid:** Use `fill="var(--background)"` where `--background` is a CSS custom property set by `globals.css` for both light and dark themes. Verify `globals.css` declares `--background`.
**Warning signs:** White horizontal band visible in the lower portion of the chart in dark mode.

### Pitfall 3: `gw_average_pts` Not Available for the Next (Upcoming) GW

**What goes wrong:** `average_entry_score` is 0 for the next GW (the API only populates this after a GW finishes). P(rank gain/drop) computation divides by 0 or compares against 0.
**Why it happens:** FPL API only sets `average_entry_score` on finished GWs. [VERIFIED: fpl_bootstrap.json — next GW = 36 has average_entry_score: 0].
**How to avoid:** Use the most recently finished GW's average score as the "FPL average" baseline. The `gw_review_gw{N}.json` files (already written by run.py PGW-02) contain `average_score` per finished GW. Fetch the most recent non-zero value. Document this as "last completed GW average" in the UI.
**Warning signs:** P(rank gain) = P(rank drop) = 50% always (when comparing against 0).

### Pitfall 4: Selling the Captain — Alt XI Captain Logic

**What goes wrong:** If the sold player is the current captain, the alt XI has no captain. Mean computation doubles 0 instead of the best remaining player.
**Why it happens:** Captain ID comes from `picks.find(p => p.is_captain).element`; if that player is sold, no captain is set for alt XI.
**How to avoid:** When `sell.id === captainId`, assign the highest-`xPts_1gw` player in the alt XI squad as the new captain. Apply the 2× multiplier to that player's contribution. Show "Alt XI (new captain: [web_name])" in the chart legend.
**Warning signs:** Alt XI mean line shows lower than expected values; altMean < mean even when buying a better player.

### Pitfall 5: Phase 61 MC Fields Not Yet in Cache

**What goes wrong:** `merged_players.json` in the local cache does not yet have `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` fields because the Phase 61 `simulate.py` pipeline hasn't been re-run since Phase 61 was shipped.
**Why it happens:** The local cache (`pipeline/cache/merged_players.json`) shows 0 players with MC fields — Phase 61 code is in `simulate.py` but the pipeline hasn't been triggered. [VERIFIED: checked cache directly].
**How to avoid:** The frontend guards against missing MC fields (`haul_prob !== undefined`). TC callout and MC badges are hidden when MC fields are absent. Testing must either mock MC fields or trigger a pipeline run.
**Warning signs:** No TC callout or MC badges visible in development — this is expected until pipeline is re-run.

### Pitfall 6: `tooltipType="none"` is a v2 Prop

**What goes wrong:** Using `tooltipType="none"` on confidence band `<Area>` components (as documented in UI-SPEC) causes TypeScript errors or no-ops in Recharts v3.
**Why it happens:** Recharts v3 removed/deprecated `tooltipType` in favour of the `hide` prop combined with `includeHidden={false}` on `<Tooltip>`.
**How to avoid:** Use `hide={true}` on `<Area>` components for the confidence band. Default `<Tooltip includeHidden={false}>` (which is the default) excludes hidden series from tooltip display.
**Warning signs:** TypeScript error on `tooltipType` prop; confidence band values leaking into tooltip.

### Pitfall 7: RouteTreeTab Props Don't Include `bank`

**What goes wrong:** Executor passes `bank` prop to `RankSimTab` from `page.tsx` but `bank` is not available at that scope without additional state lifting.
**Why it happens:** Looking at `page.tsx`, `bank`/`bankBalance` is not extracted at the page level — it lives inside `useSquad`/`useMyTeam` hooks inside individual tab components. `RouteTreeTab` does NOT receive `bank` as a prop.
**How to avoid:** `RankSimTab` should read bank from `useSquad`/`useMyTeam` internally, same pattern as `RouteTreeTab`. The `page.tsx` integration only passes `submittedId`, `horizon`; the component fetches bank itself.
**Warning signs:** TypeScript error on `bank` prop in page.tsx; undefined bank causing affordability check failures.

---

## Code Examples

### CandidateRow MC Badge Extension

```tsx
// Source: mirrors DangerousToFadeBadge in CaptainPicksPanel.tsx (VERIFIED: codebase read)
function McLabel({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-block text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1">
      {label} — {value}
    </span>
  )
}
```

### TC Callout in CaptainPicksPanel

```tsx
// Source: CONTEXT.md D-18 + UI-SPEC (CITED: 062-CONTEXT.md, 062-UI-SPEC.md)
// Inserted between <EOModeToggle> and the candidates <div className="grid grid-cols-1 gap-2">
{tcCandidate && (
  <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2">
    <p className="text-sm text-zinc-700 dark:text-zinc-300">
      <span className="font-semibold">TC:</span>{' '}
      {tcCandidate.web_name} — {Math.round((tcCandidate.haul_prob ?? 0) * 100)}% P(haul)
    </p>
  </div>
)}
```

`tcCandidate` = `eoCandidates.reduce((best, c) => (c.haul_prob ?? 0) > (best?.haul_prob ?? 0) ? c : best, null as MergedPlayer | null)`. Only rendered when at least one candidate has `haul_prob !== undefined`.

### useEntryRank Minimal Shape

```typescript
// Source: pattern from useRivals.ts (VERIFIED: codebase read)
// FPL entry endpoint: https://fantasy.premierleague.com/api/entry/{id}/
// Proxied via: /api/fpl/entry/{id}/  (existing [...proxy] route handles this)
// Response shape (relevant fields):
// { summary_overall_rank: number, summary_overall_points: number, ... }
```

### No-Squad Degradation Pattern

```tsx
// Source: mirrors RouteTreeTab + OptimiserPanel SC-05 pattern (VERIFIED: codebase structure)
if (!picks) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Load your squad to run the rank simulator
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
        Go to the Squad tab and enter your FPL Team ID to get started.
      </p>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xPts_90th_1gw` (sigma-derived) as ceiling field | `p90_pts` from 10k MC simulations; `xPts_90th_1gw` overwritten with `p90_pts` (D-05) | Phase 61 | `chase_rank` mode already sorts by `xPts_90th_1gw` which now IS the MC ceiling |
| `tooltipType="none"` (Recharts v2) | `hide={true}` + `<Tooltip includeHidden={false}>` (Recharts v3) | Recharts v3.0.0 | Breaking change — must use v3 pattern |
| AreaChart for all area+line charts | ComposedChart for mixed Area+Line | Recharts v3.x | AreaChart does not support Line children |

**Deprecated/outdated:**
- `@types/recharts` (v2.0.1 npm package): for Recharts v1 only — do not install with Recharts v3.
- `tooltipType` prop on Area/Line: removed/noop in Recharts v3.
- `CategoricalChartState` in event handlers: removed in Recharts v3.0.

---

## Open Questions

1. **`AreaChart` vs `ComposedChart` for mixing Area + Line in Recharts v3.8.1**
   - What we know: UI-SPEC references `AreaChart` with `Line` children; Recharts convention says `ComposedChart` for mixed types
   - What's unclear: Whether Recharts v3.8.1 `AreaChart` silently accepts `Line` children or requires `ComposedChart`
   - Recommendation: Executor should use `ComposedChart` to be safe; it's a drop-in replacement.

2. **FPL entry endpoint response shape**
   - What we know: `summary_overall_rank` and `summary_overall_points` exist per CONTEXT.md D-01 and FPL API convention
   - What's unclear: Whether the endpoint returns these fields before any GW is played (season start)
   - Recommendation: Add a null guard in useEntryRank; return `null` if either field is missing.

3. **`gw_average_pts` sourcing strategy**
   - What we know: Option A = add top-level field to `merged_players.json` via 3-line `run.py` change reading next GW's bootstrap event (but next GW value is 0 until finished). Option B = read from existing `gw_review_gw{N}.json` which has `average_score` for finished GWs.
   - Recommendation: Use Option B for simplicity — add a small `/api/gw-average` route (or extend `/api/players` response) that reads the most recent non-zero `average_score` from the gw_review JSON files. No pipeline change needed.

4. **`--background` CSS variable in globals.css**
   - What we know: The erase-fill technique for p10 band needs `fill="var(--background)"` in dark mode
   - What's unclear: Whether `globals.css` declares `--background` or uses Tailwind's semantic variables
   - Recommendation: Executor must read `globals.css` and verify the correct CSS variable name before implementing. Fallback: use separate light/dark `fill` values via `useTheme()` hook pattern if CSS var is unavailable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install recharts | ✓ | Inferred from project | — |
| recharts | RankSimTab fan chart | ✗ (not yet installed) | 3.8.1 available | None — must install |
| FPL API /entry/{id}/ | useEntryRank | ✓ | Proxied via [...proxy] route | Show `—` on fetch error |
| pipeline/cache/gw_review_gw*.json | GW average score | ✓ | Present (run.py PGW-02 writes these) | Fall back to hardcoded 50 with disclaimer |

**Missing dependencies with no fallback:**
- `recharts` — must run `npm install recharts` before any chart code is written.

**Missing dependencies with fallback:**
- `gw_review_gw*.json` for GW average: if absent, fall back to `avg = 50` with UI disclaimer "Average data unavailable".

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (jsdom environment, `@` alias) |
| Quick run command | `npx vitest run src/lib/mc-labels.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-03 | computeXITrajectory returns 6 ChartPoints with correct cumulative math | unit | `npx vitest run src/lib/mc-labels.test.ts` | ❌ Wave 0 |
| MC-03 | computeXITrajectory doubles captain's mean and σ | unit | `npx vitest run src/lib/mc-labels.test.ts` | ❌ Wave 0 |
| MC-03 | RankSimTab renders no-squad state when picks === null | unit (RTL) | `npx vitest run src/components/planner/RankSimTab.test.tsx` | ❌ Wave 0 |
| MC-03 | RankSimTab renders chart area when squad loaded | unit (RTL) | `npx vitest run src/components/planner/RankSimTab.test.tsx` | ❌ Wave 0 |
| MC-03 | useEntryRank is enabled when teamId provided, disabled when null | unit | `npx vitest run src/lib/hooks/useEntryRank.test.ts` | ❌ Wave 0 |
| MC-03 | Buy dropdown disabled until sell player selected | unit (RTL) | `npx vitest run src/components/planner/RankSimTab.test.tsx` | ❌ Wave 0 |
| MC-04 | computeMCLabels assigns "Best P(haul)" to highest haul_prob player | unit | `npx vitest run src/lib/mc-labels.test.ts` | ❌ Wave 0 |
| MC-04 | computeMCLabels assigns at most one label per player (greedy cascade) | unit | `npx vitest run src/lib/mc-labels.test.ts` | ❌ Wave 0 |
| MC-04 | computeMCLabels returns [] when no MC fields present | unit | `npx vitest run src/lib/mc-labels.test.ts` | ❌ Wave 0 |
| MC-04 | CaptainPicksPanel renders TC callout when haul_prob present | unit (RTL) | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ✅ (extend) |
| MC-04 | CaptainPicksPanel hides TC callout when haul_prob absent | unit (RTL) | `npx vitest run src/components/captaincy/CaptainPicksPanel.test.tsx` | ✅ (extend) |

**Note:** `CaptainPicksPanel.test.tsx` already exists (5 pre-existing failures flagged in STATE.md from Phase 57 rewrite). Phase 62 tests must be additive and must not worsen the pre-existing failure count.

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/mc-labels.test.ts` (for pure function tasks)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (less the 5 pre-existing CaptainPicksPanel failures from Phase 57) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/mc-labels.test.ts` — covers computeMCLabels priority cascade (MC-04)
- [ ] `src/lib/hooks/useEntryRank.test.ts` — covers enabled/disabled states (MC-03)
- [ ] `src/components/planner/RankSimTab.test.tsx` — covers no-squad, squad-loaded, dropdown states (MC-03)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | FPL entry endpoint is public — no auth needed |
| V3 Session Management | No | Read-only data display |
| V4 Access Control | No | No write operations |
| V5 Input Validation | Yes | teamId must be numeric — `/^\d+$/.test(teamId)` guard (established pattern from useRivals.ts T-58-01 mitigation) |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via teamId in FPL proxy path | Tampering | `/^\d+$/.test(teamId)` guard in useEntryRank (mirrors T-58-01 from useRivals.ts) |
| Excessive FPL API calls | Denial of Service | staleTime: 5 min in useEntryRank; TanStack Query dedup prevents duplicate requests |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AreaChart` does not support `Line` children in Recharts v3 — `ComposedChart` required for mixed Area+Line | Architecture Patterns, Common Pitfalls | If wrong, `ComposedChart` is still compatible and correct; no downside to using it |
| A2 | FPL entry endpoint `GET /api/entry/{id}/` returns `summary_overall_rank` at top level | useEntryRank Pattern | If field name differs, hook returns undefined rank — UI shows `—` gracefully |
| A3 | `--background` CSS variable is declared in `globals.css` for the p10 erase-fill technique | Common Pitfalls | If absent, need alternative dark-mode approach for erase fill |

---

## Sources

### Primary (HIGH confidence)

- `src/components/captaincy/CaptainPicksPanel.tsx` — CandidateRow structure, DangerousToFadeBadge template (VERIFIED: codebase read)
- `src/lib/types.ts` — MergedPlayer with MC fields at lines 177–183 (VERIFIED: codebase read)
- `src/lib/hooks/useRivals.ts` — FPL proxy hook pattern, staleTime, enabled guard (VERIFIED: codebase read)
- `src/app/page.tsx` — SECTIONS, SubTab union, Plan section render conditionals (VERIFIED: codebase read)
- `src/components/planner/RouteTreeTab.tsx` — Plan sub-tab component pattern and prop shape (VERIFIED: codebase read)
- `pipeline/simulate.py` — MC field definitions, BGW behavior, DGW handling (VERIFIED: codebase read)
- `pipeline/cache/merged_players.json` — confirmed MC fields absent (Phase 61 pipeline not yet re-run) (VERIFIED: direct check)
- `pipeline/cache/fpl_bootstrap.json` — confirmed `average_entry_score` present for finished GWs, 0 for next GW (VERIFIED: direct check)
- `package.json` — confirmed recharts not installed; React 19.2.4 (VERIFIED: codebase read)
- npm registry: recharts 3.8.1, peerDeps React 16–19, ships own types (VERIFIED: npm view)

### Secondary (MEDIUM confidence)

- Recharts v3.0.0 migration guide (GitHub wiki) — breaking changes: CategoricalChartState removed, `hide` prop vs `tooltipType` (CITED: github.com/recharts/recharts/wiki/3.0-migration-guide)
- recharts.github.io/en-US/api/Tooltip — `includeHidden` prop behavior with `hide` (CITED: recharts.github.io)

### Tertiary (LOW confidence)

- A1: `AreaChart` + `Line` incompatibility in v3 — inferred from ComposedChart convention, not explicitly tested against v3.8.1

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json, npm registry
- Architecture: HIGH — verified from codebase reads of all referenced files
- Recharts API pitfalls: MEDIUM — verified migration guide; some specifics (tooltipType removal) from docs
- Pipeline GW average: HIGH — verified from bootstrap cache and run.py PGW-02 code
- Pitfalls: HIGH (codebase) / MEDIUM (Recharts-specific)

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days; Recharts and Next.js are stable)
