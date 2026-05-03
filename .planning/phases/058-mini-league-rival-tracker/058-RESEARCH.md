# Phase 58: Mini-League Rival Tracker — Research

**Researched:** 2026-05-03
**Domain:** FPL proxy API calls, TanStack Query hooks, React component patterns, p-limit concurrency, position-median differential logic
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rivals sub-tab lives in the **Plan section** (alongside Planner, Club Form, Value Gems). SubTab ID: `'rivals'`. Both desktop label and mobile label: `'Rivals'`.
- **D-02:** League ID persists via **localStorage** under key `'fplx_mini_league_id'`. Pre-filled on return; user enters once.
- **D-03:** Table columns: Rank | Manager Name | Rank Gap (vs user) | Captain (post-deadline) | Chips Remaining.
- **D-04:** Captain column shows **em-dash `—`** pre-deadline. Column stays visible; em-dash reads as "not yet available".
- **D-05:** Deadline detection server-side in the route handler that hydrates captain picks. If `now < deadline_time`, return `null` for captain; the component renders `—`.
- **D-06:** Rival selection uses a **selected-rival panel** pattern: clicking a row highlights it; a detail panel below the summary table updates for that rival. Only one rival detail visible at a time.
- **D-07:** Rival detail panel contains four stacked sub-sections:
  1. Captain Edge — `xPts_90th_1gw` gap, post-deadline only
  2. Shared with [Rival Name] — players both user and rival own (ML-03)
  3. Your Advantage — players user owns that rival does not (ML-04)
  4. Rival Threats — rival-owned players with `xPts_1gw` above position median (ML-05)
  5. Blocking Transfers — `suggestTransfers()` candidates the rival doesn't own AND above position median `xPts_1gw` (ML-06)
- **D-08:** Rival threats threshold = `xPts_1gw` above position median for GK/DEF/MID/FWD. Consistent with Phase 30 `_compute_differential_flag()`.
- **D-09:** Blocking move source: auto-pull top transfer candidates from `suggestTransfers()`.
- **D-10:** Blocking move qualifier: appears in `suggestTransfers()` AND rival doesn't own AND `xPts_1gw` above position median.
- **D-11:** Blocking move indicator in rival detail panel as fifth sub-section. Not in summary table rows.
- **D-12:** Max 20 rivals fetched; leagues larger than 20 show a note. Batching: 3 concurrent requests using `p-limit ^6.1.0`. Batching lives client-side in `useRivals` hook.

### Claude's Discretion

- Row layout within the summary table (exact column widths, mobile column hiding strategy — follow GemTable mobile patterns).
- Player chip design within each detail panel sub-section (spacing, icon choices).
- Loading/error states for league ID input and batch fetch progress indicator.
- Whether to show a progress indicator during the 3-at-a-time rival fetch.

### Deferred Ideas (OUT OF SCOPE)

- **ML-09:** Pagination for leagues > 20 rivals — deferred to v1.10.
- **ML-10:** Pre-deadline lineup inference for rival captain prediction — deferred.
- Rank swing estimate in places (xPts delta to approximate rank places) — deferred to v1.10.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ML-01 | User can enter a mini-league ID to load rival squad data via the existing FPL proxy | FPL proxy pattern confirmed: `leagues-classic/{id}/standings/` routed through `/api/fpl/[...proxy]` |
| ML-02 | System displays rival summary table: rank, gap, captain pick (post-deadline), chips remaining | Captain post-deadline via `entry/{id}/event/{gw}/picks/` + bootstrap deadline_time gate; chips via `entry/{id}/history/` |
| ML-03 | System identifies shared players owned by both user and a given rival | Player ID set intersection: `ownedIds ∩ rivalOwnedIds` using `SquadPick.element` |
| ML-04 | System flags differential upside: players user owns that rival does not | Set difference: `ownedIds — rivalOwnedIds` |
| ML-05 | System flags rival threats: high-xPts players the rival owns but user does not | `xPts_1gw > positionMedian` filter on `rivalOwnedIds — ownedIds` (Phase 30 pattern) |
| ML-06 | System identifies blocking moves: transfer targets user is considering that block rivals | `suggestTransfers()` output filtered by (a) rival doesn't own AND (b) `xPts_1gw` above position median |
| ML-07 | Rank impact estimate for captain differential using `xPts_90th_1gw` gap | `userCaptainCandidate.xPts_90th_1gw - rival.captainPick.xPts_90th_1gw` — both from `MergedPlayer[]` |
| ML-08 | Max 20 rivals, batches of 3 concurrent requests, note for larger leagues | `p-limit ^6.1.0`; `leagueSize > 20` note; `useRivals` hook with enabled guard |
</phase_requirements>

---

## Summary

Phase 58 adds a "Rivals" sub-tab to the Plan section. The feature is entirely client-driven: a `useRivals` hook fetches the mini-league standings (1 call) then fetches each rival's picks and chip history (up to 20 rivals, 2 calls each = up to 40 calls) with p-limit capping concurrency at 3. All FPL calls route through the existing `/api/fpl/[...proxy]` catch-all — zero changes to that route. The differential intelligence (shared players, user advantage, rival threats, blocking moves) is computed client-side in pure TypeScript over `MergedPlayer[]` from `usePlayers()`. Position-median logic mirrors Phase 30's `_compute_differential_flag()` Python pattern.

The biggest integration decisions are already locked by CONTEXT.md: p-limit ^6.1.0 for batching, position-median for the threat/blocking threshold, and `suggestTransfers()` as the source of blocking move candidates. The main implementation concerns are: (1) p-limit being ESM-only and the correct install strategy, (2) correctly threading `suggestTransfers()` output into `RivalDetailPanel` without re-invoking it per rival, and (3) the captain deadline-gate logic staying server-side.

**Primary recommendation:** Build in three clean waves — hook + types (Wave 1), pure-logic differential engine with tests (Wave 2), UI components + page.tsx wiring (Wave 3).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FPL API data fetch (league standings, picks, history) | API / Next.js server proxy | — | All FPL calls must go through `/api/fpl/[...proxy]`; no direct browser-to-FPL |
| Deadline detection for captain gate | API / Next.js server proxy | — | D-05: `deadline_time` check must be server-side (bootstrap fetch happens in the picks route handler) |
| Rival data batching (p-limit) | Browser / Client | — | Batching logic lives in `useRivals` hook (client-side TanStack Query) |
| Position-median computation | Browser / Client | — | Replicated client-side from `MergedPlayer[]` provided by `usePlayers()` |
| Differential set operations (shared/advantage/threats/blocking) | Browser / Client | — | Pure TypeScript over already-loaded player arrays; no additional API needed |
| Captain edge estimate (`xPts_90th_1gw` gap) | Browser / Client | — | Both user captain candidates and rival captain `xPts_90th_1gw` are in `MergedPlayer[]` |
| Sub-tab navigation (adding 'rivals' to Plan section) | Browser / Client | — | `SubTab` union + `SECTIONS` constant in `src/app/page.tsx` |
| localStorage persistence (league ID) | Browser / Client | — | Mirrors team ID pattern already in `page.tsx` lines 99–110 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| p-limit | ^6.1.0 (install; not yet in package.json) | Cap concurrent FPL API requests at 3 | CONTEXT.md D-12 locked this; prevents hitting FPL rate limits with 40 unthrottled calls |
| @tanstack/react-query | ^5.95.2 (installed) | Async data fetching, caching, staleTime | Already the project standard for all API hooks |
| zod | ^4.3.6 (installed) | Runtime validation of FPL API responses | Already used in `squad-adapter.ts`, `fpl-adapter.ts` |

[VERIFIED: npm registry — p-limit@6.1.0 exists; p-limit@7.3.0 is latest but CONTEXT.md specifies ^6.1.0]
[VERIFIED: package.json — @tanstack/react-query ^5.95.2, zod ^4.3.6 already installed]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-limit v3.1.0 (already in node_modules) | 3.1.0 | CJS concurrency limiter | Already installed as a transitive dep — BUT this is CJS, not ESM. Do NOT use this; install ^6.1.0 as a direct dep |

[VERIFIED: node_modules/p-limit/package.json — v3.1.0 is a transitive dep, type: "commonjs"]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| p-limit ^6.1.0 | p-limit ^7.3.0 (latest) | 7.x is also ESM-only; CONTEXT.md specifies ^6.1.0; 6.x has same API shape. Use 6.x to stay within spec. |
| p-limit ^6.1.0 | Custom promise-pool | p-limit has well-tested edge cases for queue draining; hand-rolling is the anti-pattern |

**Installation:**
```bash
npm install p-limit@^6.1.0
```

**Version verification:** `npm view p-limit@6.1.0 version` — confirmed `6.1.0` exists. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
User enters league ID
        |
        v
useRivals(leagueId, currentGw, userTeamId)
        |
        |-- [1 call] GET /api/fpl/leagues-classic/{leagueId}/standings/
        |       -> returns standings[] with entry IDs, ranks, manager names
        |
        |-- slice top 20 rivals (ML-08 cap)
        |
        |-- p-limit(3) concurrent batches:
        |    for each rival:
        |    |-- GET /api/fpl/entry/{entryId}/event/{gw}/picks/  -> picks (incl. captain)
        |    |-- GET /api/fpl/entry/{entryId}/history/           -> chips array
        |    +-- deadline gate: server-side in a thin wrapper route OR client checks bootstrap
        |
        v
      RivalEntry[] (rank, gap, name, captainPlayerId|null, chipsRemaining, picks[])
        |
        v
   RivalsTab
     |-- RivalSummaryTable (selectedRivalId state)
     |       rows: rank | name | gap | captain (—pre-deadline) | chips remaining
     |
     +-- RivalDetailPanel (props: selectedRival, userPicks, allPlayers, suggestTransfersOutput)
             |-- Captain Edge row (post-deadline, uses xPts_90th_1gw gap)
             |-- Shared with [Rival] (set intersection)
             |-- Your Advantage (set difference: user owns, rival doesn't)
             |-- Rival Threats (rival owns, user doesn't, xPts_1gw > posMedian)
             +-- Blocking Transfers (suggestTransfers buy-targets rival doesn't own, above median)
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── hooks/
│   │   └── useRivals.ts          # TanStack Query hook; p-limit batching; RivalEntry[]
│   ├── rival-intel.ts            # Pure-function differential engine (shared/advantage/threats/blocking)
│   └── types.ts                  # Extend with RivalEntry, RivalPick, RivalDetail types
└── components/
    └── rivals/
        ├── RivalsTab.tsx          # Entry point: league ID input + summary table + detail panel
        ├── RivalSummaryTable.tsx  # Table with selected-row highlighting
        └── RivalDetailPanel.tsx   # Five stacked sub-sections
```

### Pattern 1: useRivals Hook (TanStack Query + p-limit batching)

```typescript
// Source: mirrors useSquad.ts and useChipHistory.ts patterns [VERIFIED: codebase]
// p-limit v6 is ESM — import with standard ES import in a 'use client' module (webpack handles ESM)
import pLimit from 'p-limit'
import { useQuery } from '@tanstack/react-query'
import type { RivalEntry } from '@/lib/types'

const MAX_RIVALS = 20
const CONCURRENCY = 3

export function useRivals(leagueId: string | null, currentGw: number | null) {
  return useQuery<RivalEntry[]>({
    queryKey: ['rivals', leagueId, currentGw],
    queryFn: async () => {
      if (!leagueId || !currentGw) throw new Error('leagueId and currentGw required')
      // Step 1: fetch standings
      const standingsRes = await fetch(`/api/fpl/leagues-classic/${leagueId}/standings/`)
      if (!standingsRes.ok) throw new Error(`standings fetch failed: ${standingsRes.status}`)
      const standings = await standingsRes.json()
      const entries: Array<{ id: number; entry_name: string; player_name: string; rank: number }> =
        standings.standings?.results ?? []
      const capped = entries.slice(0, MAX_RIVALS)
      // Step 2: fetch picks + history concurrently, capped at 3
      const limit = pLimit(CONCURRENCY)
      const results = await Promise.all(
        capped.map(entry =>
          limit(async () => {
            const [picksRes, historyRes] = await Promise.all([
              fetch(`/api/fpl/entry/${entry.id}/event/${currentGw}/picks/`),
              fetch(`/api/fpl/entry/${entry.id}/history/`),
            ])
            // ... parse and return RivalEntry
          })
        )
      )
      return results
    },
    enabled: !!leagueId && !!currentGw && /^\d+$/.test(leagueId),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}
```

[VERIFIED: codebase — useSquad.ts, useChipHistory.ts patterns; p-limit ESM import confirmed compatible with webpack bundler]

### Pattern 2: Position-Median Computation (client-side replica of Phase 30)

```typescript
// Source: pipeline/merge.py lines 1077-1086 _compute_differential_flag context [VERIFIED: codebase]
// Replicated client-side in rival-intel.ts for ML-05 and ML-06

function computePositionMedians(players: MergedPlayer[]): Map<PositionCode, number> {
  const byPos: Map<PositionCode, number[]> = new Map([[1,[]], [2,[]], [3,[]], [4,[]]])
  for (const p of players) {
    const xpts = p.xPts_1gw
    if (xpts && xpts > 0) {
      byPos.get(p.element_type)!.push(xpts)
    }
  }
  const medians = new Map<PositionCode, number>()
  for (const [pos, vals] of byPos) {
    if (vals.length === 0) { medians.set(pos, 0); continue }
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
    medians.set(pos, median)
  }
  return medians
}
```

[VERIFIED: codebase — pipeline/merge.py lines 1077-1097 for the Python original]

### Pattern 3: page.tsx Navigation Wiring

```typescript
// Source: src/app/page.tsx lines 48 and 67-73 [VERIFIED: codebase]

// 1. Extend SubTab union type (line 48):
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' |
  'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser' |
  'price-changes' | 'rivals'   // ADD 'rivals'

// 2. Add to Plan section subTabs array (after value-gems entry, lines 67-73):
{ id: 'plan' as Section, label: 'Plan', subTabs: [
  { id: 'planner' as SubTab,    label: 'Planner',    mobileLabel: 'Planner' },
  { id: 'club-form' as SubTab,  label: 'Club Form',  mobileLabel: 'Form'    },
  { id: 'value-gems' as SubTab, label: 'Value Gems', mobileLabel: 'Values'  },
  { id: 'rivals' as SubTab,     label: 'Rivals',     mobileLabel: 'Rivals'  }, // ADD
], defaultSubTab: 'planner' as SubTab }

// 3. Render conditional (alongside other activeSection !== 'squad' guards):
{activeSection !== 'squad' && activeSubTab === 'rivals' && (
  <RivalsTab submittedId={submittedId} />
)}
```

[VERIFIED: codebase — page.tsx lines 48-83, pattern confirmed from PriceChangePanel wiring at line 210]

### Pattern 4: localStorage League ID Persistence

```typescript
// Source: src/app/page.tsx lines 99-110 (team ID pattern) [VERIFIED: codebase]
// Mirror exactly, using key 'fplx_mini_league_id' (D-02)

const [leagueId, setLeagueId] = useState<string>(() => {
  try { return localStorage.getItem('fplx_mini_league_id') ?? '' } catch { return '' }
})
const [submittedLeagueId, setSubmittedLeagueId] = useState<string | null>(() => {
  try { return localStorage.getItem('fplx_mini_league_id') } catch { return null }
})
const handleLeagueIdSubmit = useCallback(() => {
  if (leagueId.trim()) {
    setSubmittedLeagueId(leagueId.trim())
    try { localStorage.setItem('fplx_mini_league_id', leagueId.trim()) } catch {}
  }
}, [leagueId])
```

[VERIFIED: codebase — page.tsx lines 99-110]

### Pattern 5: Selected-Row Highlight

```typescript
// Source: GemTable.tsx line 193 (even/hover pattern); MinsRiskBadge.tsx (zinc tones) [VERIFIED]
// For selected row in RivalSummaryTable:
className={`cursor-pointer ${
  selectedRivalId === rival.entryId
    ? 'bg-zinc-100 dark:bg-zinc-800'
    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
}`}
```

### Anti-Patterns to Avoid

- **Re-invoking `suggestTransfers()` per rival in RivalDetailPanel:** Blocking moves need `suggestTransfers()` output — call it once in the parent (or re-use if already called by `TransferPanel`) and pass the result down as a prop. Do not re-compute inside the detail panel on every rival selection.
- **Direct browser-to-FPL calls:** All FPL calls MUST go through `/api/fpl/[...proxy]`. The proxy handles the `User-Agent` header and 502 error wrapping.
- **Client-side deadline detection:** D-05 is explicit: deadline check must be server-side. If implementing a thin picks route, the deadline check lives there. If routing through the bare proxy (simplest approach), the `useRivals` hook receives picks data and applies deadline logic against the `bootstrapData` event's `deadline_time` field loaded separately.
- **Passing all 500+ `MergedPlayer[]` to per-rival detail without memoization:** The position-median computation should be memoized at the tab level, not recomputed on every rival selection.
- **Hardcoding a concurrency limit inline:** The `pLimit(3)` call should be inside the `queryFn` closure (not module-level) — a module-level limiter would persist across re-fetches and incorrectly restrict concurrent queries from other hooks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent request throttling | Custom promise pool / manual counter | `p-limit ^6.1.0` | p-limit handles queue draining, cancellation, and edge cases correctly |
| Set intersection / difference | Nested loops over player arrays | `Set` operations (`new Set(rivalIds)` then `.has()` filter) | O(n) vs O(n²); already the pattern in `suggest-transfers.ts` with `ownedIds` |
| Async data validation | Ad-hoc JSON field checks | Zod schemas (extend `SquadPicksResponseSchema`) | Project standard; catches malformed FPL responses early |
| Position median computation | Custom sort+index arithmetic | Reuse the exact algorithm from `computePositionMedians()` (see Pattern 2) | Already tested implicitly via Phase 30's pipeline output; same semantics |

**Key insight:** The differential logic (shared/advantage/threats/blocking) is 4 pure set operations over arrays — the entire `rival-intel.ts` module can be a single test-covered pure function file, similar to `suggest-transfers.ts` or `eo-candidates.ts`.

---

## Common Pitfalls

### Pitfall 1: p-limit ESM Import in Next.js

**What goes wrong:** `import pLimit from 'p-limit'` fails with "Cannot find module" or "SyntaxError: require of ES Module" when the hook file is processed by something expecting CJS.
**Why it happens:** p-limit v6+ has `"type": "module"` — it is ESM-only. If the hook runs server-side (e.g., in a route handler), Node.js CJS interop fails.
**How to avoid:** The `useRivals` hook is a `'use client'` hook — it runs in the browser via webpack bundling. Webpack's bundler handles ESM packages fine (tsconfig has `"moduleResolution": "bundler"`). Standard `import pLimit from 'p-limit'` works in `'use client'` files. If for any reason the import fails at build time, the escape hatch is `next.config.ts` `transpilePackages: ['p-limit']`.
**Warning signs:** TypeScript error "Could not find module 'p-limit'" at compile time means p-limit is not yet installed (run `npm install p-limit@^6.1.0`). Runtime ESM error means p-limit was inadvertently imported in a server context.

[VERIFIED: tsconfig.json — "moduleResolution": "bundler"; next.config.ts — transpilePackages not set, can add if needed; CLAUDE.md — read next.config docs before writing code]

### Pitfall 2: FPL `deadline_time` Not in Existing Zod Schema

**What goes wrong:** `FPLEventSchema` in `fpl-adapter.ts` does not include `deadline_time`. Accessing `event.deadline_time` returns `undefined`.
**Why it happens:** The existing schema only validates `id`, `is_current`, `is_next`, `finished` — the fields the project needed up to Phase 57. `deadline_time` is a real FPL field but it was not previously consumed.
**How to avoid:** Two options — (a) extend `FPLEventSchema` to add `deadline_time: z.string()`, or (b) skip Zod for the deadline check by using a plain type assertion on the raw bootstrap JSON fetched in `useRivals`. Option (a) is cleaner. The `deadline_time` field is an ISO 8601 string in FPL's API.
**Warning signs:** `event.deadline_time === undefined` when checking captain post-deadline gate.

[VERIFIED: codebase — fpl-adapter.ts FPLEventSchema lines 32-37; types.ts FPLEvent interface lines 40-45]

### Pitfall 3: `leagues-classic` Standings Response Shape

**What goes wrong:** Accessing `standings.results` directly on the response fails because the actual shape is `standings.standings.results`.
**Why it happens:** FPL wraps results in a nested `standings` key: `{ standings: { results: [...], has_next: bool, page: int } }`. Flat access to `standings.results` returns `undefined`.
**How to avoid:** Access as `response.standings.results`. Validate with Zod: `z.object({ standings: z.object({ results: z.array(...) }) })`.
**Warning signs:** `entries` array is undefined → league table never renders.

[ASSUMED — based on known FPL API structure; should be verified with a live API call during implementation]

### Pitfall 4: Captain Identification Requires Comparing Rival Picks Against `MergedPlayer[]`

**What goes wrong:** The rival picks response gives only `element` IDs (same shape as `SquadPicksResponse`). The captain column needs a player name. If the display code tries to look up the player ID in the local `MergedPlayer[]` before `usePlayers()` has loaded, it renders nothing or crashes.
**Why it happens:** Rival picks are a list of `SquadPick` objects (`{ element, is_captain, position, multiplier, is_vice_captain }`). Player name mapping requires the `MergedPlayer[]` from `usePlayers()`.
**How to avoid:** Gate `RivalsTab` rendering on `!!playersData` in addition to `!!rivalsData`. The `RivalDetailPanel` enrichment (rival threat xPts, captain edge) also needs `playersData`.

[VERIFIED: codebase — squad-adapter.ts SquadPickSchema confirms `element` is just a number ID]

### Pitfall 5: `suggestTransfers()` Requires Auth Context It Doesn't Have in Rivals Context

**What goes wrong:** `suggestTransfers()` takes `currentPicks`, `players`, `horizon`, `ftCount`, `bank`, and optionally `sellPrices` (from the authenticated my-team endpoint). In the Rivals tab, the user's authenticated sell prices may not be available.
**Why it happens:** The `RivalDetailPanel` needs blocking moves, which needs `suggestTransfers()` output. But the Rivals tab might render before TransferPanel has been loaded, and `sellPrices` (from `useMyTeam`) may be empty.
**How to avoid:** `suggestTransfers()` gracefully falls back to `now_cost` when `sellPrices` is an empty/undefined map (see `suggest-transfers.ts` line 63-66). Call `suggestTransfers()` in `RivalsTab` using `squadData` from `useSquad(submittedId)`, `scoredPlayers` from `usePlayers()`, and an empty `sellPrices` map when unauthenticated. The result will be slightly approximate (uses `now_cost` as sell price) but functionally correct.

[VERIFIED: codebase — suggest-transfers.ts lines 59-66, `sellValueFor()` fallback logic]

### Pitfall 6: Rival Captain `xPts_90th_1gw` Not Available Without Player Lookup

**What goes wrong:** The Captain Edge row (ML-07) shows `±X xPts` by comparing user's captain candidate's `xPts_90th_1gw` against the rival's captain pick's `xPts_90th_1gw`. The rival's captain pick response only has the `element` ID — not the xPts field.
**Why it happens:** `entry/{id}/event/{gw}/picks/` gives `element` IDs; `xPts_90th_1gw` lives in `MergedPlayer` (the pipeline output). A lookup into `MergedPlayer[]` by the rival captain's `element` ID is required.
**How to avoid:** In `RivalDetailPanel`, look up `rivalCaptainId` in a `Map<number, MergedPlayer>` built from `allPlayers`. If the player isn't found (e.g., pipeline not run), render `—`. This is the same enrichment pattern used in `TransferPanel`'s `computeCaptaincyCandidates()` call.

[VERIFIED: codebase — types.ts MergedPlayer.xPts_90th_1gw line 174; squad-adapter.ts SquadPick has only `element` number]

### Pitfall 7: `page.tsx` Test Coverage — Must Update the Mock List

**What goes wrong:** After adding `<RivalsTab />` to `page.tsx`, `page.test.tsx` fails because it does not mock `@/components/rivals/RivalsTab`.
**Why it happens:** `page.test.tsx` explicitly mocks every rendered component (lines 6-32). Any new component imported and rendered in `page.tsx` must be added to this mock list.
**How to avoid:** When adding the Rivals render conditional to `page.tsx`, simultaneously add the mock in `page.test.tsx`. The pattern is: `vi.mock('@/components/rivals/RivalsTab', () => ({ RivalsTab: (_props: any) => <div data-testid="rivals-tab" /> }))`.

[VERIFIED: codebase — page.test.tsx lines 6-32 mock pattern; all rendered components are mocked]

---

## Code Examples

### FPL Proxy Call Pattern (No Changes to Route)

```typescript
// Source: src/app/api/fpl/[...proxy]/route.ts [VERIFIED: codebase]
// League standings: GET /api/fpl/leagues-classic/{leagueId}/standings/
// Rival picks: GET /api/fpl/entry/{entryId}/event/{gw}/picks/
// Rival history: GET /api/fpl/entry/${entryId}/history/
// Bootstrap: GET /api/fpl/bootstrap-static/
// All handled by the same catch-all proxy — no modifications needed.
const res = await fetch(`/api/fpl/leagues-classic/${leagueId}/standings/`)
```

### Chip History Parsing (Already a Pattern in useChipHistory.ts)

```typescript
// Source: src/lib/hooks/useChipHistory.ts lines 3-26 [VERIFIED: codebase]
// ChipHistoryEntry: { name: string, time: string, event: number }
// chips: ChipHistoryEntry[] is the array from history response
// Chips remaining = ['bboost','3xc','freehit','wildcard'].filter(c => !usedChips.includes(c))
const data = raw as { chips?: ChipHistoryEntry[] }
const usedChips = Array.isArray(data.chips) ? data.chips.map(c => c.name) : []
const CHIP_NAMES = ['bboost', '3xc', 'freehit', 'wildcard']
const chipsRemaining = CHIP_NAMES.filter(c => !usedChips.includes(c))
```

### Differential Set Operations (rival-intel.ts pure functions)

```typescript
// [ASSUMED] — pattern derived from eo-candidates.ts and suggest-transfers.ts
export function computeShared(userIds: Set<number>, rivalIds: Set<number>): number[] {
  return [...userIds].filter(id => rivalIds.has(id))
}
export function computeUserAdvantage(userIds: Set<number>, rivalIds: Set<number>): number[] {
  return [...userIds].filter(id => !rivalIds.has(id))
}
export function computeRivalThreats(
  rivalIds: Set<number>,
  userIds: Set<number>,
  playerById: Map<number, MergedPlayer>,
  posMedians: Map<PositionCode, number>,
): MergedPlayer[] {
  return [...rivalIds]
    .filter(id => !userIds.has(id))
    .map(id => playerById.get(id))
    .filter((p): p is MergedPlayer => p != null && (p.xPts_1gw ?? 0) > (posMedians.get(p.element_type) ?? 0))
}
```

### Captain Edge Estimate (ML-07)

```typescript
// [ASSUMED] — derived from CONTEXT.md D-07, D-08 + types.ts xPts_90th_1gw field
// userCaptainCandidate: the top-ranked captain candidate from computeEOCandidates()
// rivalCaptainPlayer: looked up from playerById map using rival captain element ID
const captainEdge =
  (userCaptainCandidate?.xPts_90th_1gw ?? null) !== null &&
  (rivalCaptainPlayer?.xPts_90th_1gw ?? null) !== null
    ? (userCaptainCandidate!.xPts_90th_1gw! - rivalCaptainPlayer!.xPts_90th_1gw!).toFixed(1)
    : null
// Render: captainEdge !== null ? `Captain edge: ${captainEdge >= 0 ? '+' : ''}${captainEdge} xPts vs [Rival]` : '—'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global concurrency (no limit) | p-limit(3) concurrency cap | Phase 58 (new) | Prevents FPL rate-limiting on leagues with 20 rivals (40 calls) |
| All differential flags pre-computed in pipeline | Client-side position-median for live rival data | Phase 58 (new) | Pipeline cannot pre-compute data for a given user's rivals — must be client-side |

**Deprecated/outdated:**
- `p-limit@3.1.0` (CJS, already in node_modules as transitive dep): Do not use directly. Install `p-limit@^6.1.0` as a direct dependency with the correct ESM module.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FPL standings response shape is `{ standings: { results: [...] } }` | Pitfall 3, useRivals pattern | Rival list never loads; can be fixed on first API call during implementation |
| A2 | Captain edge uses `xPts_90th_1gw` from the user's top EO-mode candidate (from `computeEOCandidates('max_xpts')`) | Code Examples — Captain Edge | Displayed edge estimate could mismatch user's intended captain if they use a different EO mode |
| A3 | `rival-intel.ts` pure function exports cover all 4 differential operations cleanly | Code Examples | Minor refactor if the function signatures don't compose cleanly with RivalDetailPanel props |
| A4 | `leagues-classic` standings always include `entry` (entry ID), `rank`, `player_name`, `entry_name` fields | useRivals pattern | Field rename by FPL would break the standings table |

**If this table is empty:** All claims were verified. Table is NOT empty — A1 and A4 depend on live FPL API shape.

---

## Open Questions

1. **Deadline detection: proxy-side or client-side bootstrap lookup?**
   - What we know: D-05 specifies deadline check "server-side in the route handler". The bare proxy (`/api/fpl/[...proxy]`) does zero interpretation — it just forwards.
   - What's unclear: Should we add a thin dedicated route (`/api/rivals/picks/[entryId]`) that checks deadline and returns `captainPlayerId: null | number`? Or does the `useRivals` hook fetch `bootstrap-static` separately (through the proxy) and apply the deadline gate client-side?
   - Recommendation: Add a thin wrapper route `/api/rivals/picks/[entryId]` that (1) fetches bootstrap to get deadline_time for current event, (2) fetches the rival's picks, and (3) returns `{ captainPlayerId: null | number, picks: SquadPick[] }` — this keeps deadline logic server-side per D-05 without changing the bare proxy. Alternatively, the `useRivals` hook can fetch bootstrap once and check `deadline_time` client-side — simpler but technically violates D-05 wording.

2. **Where does `suggestTransfers()` get called for blocking moves?**
   - What we know: `suggestTransfers()` needs `currentPicks`, `players`, `horizon`, `ftCount`, `bank`. The Rivals tab receives `submittedId` prop (from page.tsx) and can call `useSquad(submittedId)`.
   - What's unclear: Whether the planner should re-invoke `suggestTransfers()` in `RivalsTab` or have page.tsx pass down the already-computed `transferSuggestions` from `TransferPanel`.
   - Recommendation: Re-invoke `suggestTransfers()` in `RivalsTab` with a fixed `horizon=1`, `ftCount=1` (simplest, no auth requirement). The same suggestion data in `TransferPanel` uses user-configured horizon and ftCount — those differ. A fresh call with horizon=1 is the right choice for blocking move intent.

---

## Environment Availability

Step 2.6: SKIPPED for most tooling — phase is client-side TypeScript with one npm install.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| p-limit ^6.1.0 | ML-08 batching in useRivals | Not installed (6.x) | v3.1.0 as transitive dep only | None — must install; blocked until `npm install p-limit@^6.1.0` |
| Node.js | Build | Available | v25.8.1 | — |
| Next.js | Build | Available | 16.2.1 | — |

**Missing dependencies with no fallback:**
- `p-limit@^6.1.0` — must be installed before Wave 1 implementation begins.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/rival-intel.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ML-01 | `useRivals` calls leagues-classic endpoint with leagueId | unit (hook mock) | `npx vitest run src/lib/hooks/useRivals.test.ts` | Wave 0 |
| ML-02 | Captain column shows `—` when `captainPlayerId` is `null` | unit RTL | `npx vitest run src/components/rivals/RivalSummaryTable.test.tsx` | Wave 0 |
| ML-03 | `computeShared()` returns intersection of user and rival player IDs | unit | `npx vitest run src/lib/rival-intel.test.ts` | Wave 0 |
| ML-04 | `computeUserAdvantage()` returns set-difference (user owns, rival doesn't) | unit | `npx vitest run src/lib/rival-intel.test.ts` | Wave 0 |
| ML-05 | `computeRivalThreats()` filters by `xPts_1gw > posMedian` | unit | `npx vitest run src/lib/rival-intel.test.ts` | Wave 0 |
| ML-06 | `computeBlockingMoves()` returns `suggestTransfers()` candidates above posMedian that rival doesn't own | unit | `npx vitest run src/lib/rival-intel.test.ts` | Wave 0 |
| ML-07 | Captain edge shows `±X xPts` when post-deadline, `—` when pre-deadline | unit RTL | `npx vitest run src/components/rivals/RivalDetailPanel.test.tsx` | Wave 0 |
| ML-08 | League > 20 rivals: shows note, fetches only first 20; concurrency cap = 3 | unit (mock fetch counter) | `npx vitest run src/lib/hooks/useRivals.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/rival-intel.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/rival-intel.test.ts` — covers ML-03, ML-04, ML-05, ML-06 pure function tests
- [ ] `src/lib/hooks/useRivals.test.ts` — covers ML-01, ML-08 hook tests
- [ ] `src/components/rivals/RivalSummaryTable.test.tsx` — covers ML-02 captain em-dash
- [ ] `src/components/rivals/RivalDetailPanel.test.tsx` — covers ML-07 captain edge display

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Feature is read-only public FPL data (rival squads are public) |
| V3 Session Management | No | No session state for rival data |
| V4 Access Control | No | Any user can look up any league ID (same as FPL public API) |
| V5 Input Validation | Yes | League ID and entry IDs must be validated as numeric before proxy calls |
| V6 Cryptography | No | No secret data; rival squads are public FPL data |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via leagueId/entryId into `/api/fpl/[...proxy]` path segments | Tampering | `/^\d+$/.test(leagueId)` guard in `useRivals` — same pattern as `useChipHistory.ts` line 42 [VERIFIED: codebase] |
| Unbounded parallel requests overloading FPL API | DoS (self) | p-limit(3) concurrency cap (ML-08 D-12) |

[VERIFIED: codebase — useChipHistory.ts line 42: `/^\d+$/.test(teamId)` guard pattern]

---

## Project Constraints (from CLAUDE.md)

- **AGENTS.md:** "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code." Confirmed: read `transpilePackages.md` during research. Next.js 16.2.1 supports `transpilePackages` since v13; not needed for client-side ESM but available as escape hatch.
- **No `Co-Authored-By` trailers in git commits** (CLAUDE.md direct).
- **No test bypasses:** All Vitest tests must remain green; no `--no-verify`.

---

## Sources

### Primary (HIGH confidence)
- `src/app/page.tsx` — SubTab union, SECTIONS constant, team ID localStorage pattern, render conditionals [VERIFIED: codebase]
- `src/app/api/fpl/[...proxy]/route.ts` — proxy architecture (zero change needed) [VERIFIED: codebase]
- `src/lib/hooks/useSquad.ts`, `useMyTeam.ts`, `useChipHistory.ts` — TanStack Query patterns to mirror [VERIFIED: codebase]
- `src/lib/suggest-transfers.ts` — `suggestTransfers()` function signature and return shape [VERIFIED: codebase]
- `src/lib/types.ts` — `MergedPlayer` all fields including `xPts_1gw`, `xPts_90th_1gw`, `element_type`, `selected_by_percent` [VERIFIED: codebase]
- `src/lib/squad-adapter.ts` — `SquadPick` shape (element ID only, no player name) [VERIFIED: codebase]
- `pipeline/merge.py` lines 1073-1097 — position-median computation for differential flag [VERIFIED: codebase]
- `src/app/page.test.tsx` — mock pattern for page-level tests; all rendered components must be mocked [VERIFIED: codebase]
- npm registry — `p-limit@6.1.0` confirmed available; `p-limit@7.3.0` is latest; both ESM [VERIFIED: npm view]
- `node_modules/p-limit/package.json` — v3.1.0 already installed as transitive dep (CJS) [VERIFIED: codebase]
- `tsconfig.json` — `"moduleResolution": "bundler"` (handles ESM packages in client code) [VERIFIED: codebase]
- `vitest.config.ts` — test framework, environment: jsdom [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/transpilePackages.md` — `transpilePackages` available since Next.js v13 as ESM escape hatch [VERIFIED: docs file]
- `src/app/api/squad/[teamId]/route.ts` — deadline_time not in current FPLEventSchema; schema extension pattern confirmed [VERIFIED: codebase]

### Tertiary (LOW confidence)
- FPL `leagues-classic/{id}/standings/` response shape with `standings.standings.results` nesting — documented in multiple community sources but not verified against live API in this session [ASSUMED: A1]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry and codebase
- Architecture: HIGH — all patterns verified against existing hooks, components, and route handlers
- Pitfalls: HIGH (pitfalls 1-2, 4-7) / MEDIUM (pitfall 3 — FPL API shape not live-verified)
- FPL API endpoint shapes: MEDIUM — proxy pattern verified; response structure assumed from training knowledge (A1, A4)

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (FPL API shapes may change between seasons; p-limit versions stable)
