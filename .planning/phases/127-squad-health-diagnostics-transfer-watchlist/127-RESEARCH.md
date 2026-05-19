# Phase 127: Squad Health Diagnostics & Transfer Watchlist — Research

**Researched:** 2026-05-19
**Domain:** Python pipeline extension + Next.js 16 / React 19 component authoring
**Confidence:** HIGH — all findings verified against the live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Budget sweep range: £80m–£120m in £0.5m steps = 81 builds. Budget values are FPL cost units (×10): 800 to 1200 inclusive, step 5. Sweep calls the Python equivalent of `buildPreSeasonSquad()` from `src/lib/pre-season-squad.ts` — re-implement inline in `squad_health.py` (do not import from TypeScript).
- **D-02:** `greedy_optimality_gap_avg` is present in the `SquadHealth` type and in `pre_season_squad_health.json` but set to `null` for Phase 127. ILP comparison deferred.
- **D-03:** Player pool source: `fpl_bootstrap.json` (Vercel Blob or `pipeline/cache/fpl_bootstrap.json` locally). Same resolution pattern as `suggest_squad.py`. `squad_health.py` runs **after** `suggest_squad.py` in `pipeline/run.py`.
- **D-04:** No env var gate. `squad_health.py` always runs (greedy sweep is lightweight). Guarded by the same IS_OFF_SEASON block as `suggest_squad.py` in `run.py`.
- **D-05:** Route response evolves from flat `PreSeasonSquad` to a named envelope: `{ squad: PreSeasonSquad | null, health: SquadHealth | null, solver: 'ilp' | 'greedy' | null }`.
- **D-06:** `health` is a side-read: route always attempts `readBlobOrLocal('pre_season_squad_health.json')` and attaches the parsed result. Falls back to `null` silently if the file doesn't exist.
- **D-07:** `solver` is inferred from resolution path inside the route — NOT stored in `pre_season_squad.json`. Resolution 1 (pre_season_squad.json exists) → `'ilp'`; Resolution 2 (greedy fallback) → `'greedy'`; 404/503 → `null`.
- **D-08:** `usePreSeasonSquad` updated: return type changes to `PreSeasonSquadResponse | null`. All existing consumers updated: `NextSeasonPlannerTab` reads `data?.squad`, health indicator reads `data?.health`, solver badge reads `data?.solver`.
- **D-09:** `localStorage['fplx_watchlist']` stores `JSON.stringify(number[])` — a plain array of player element IDs. No timestamp, no metadata. Departed detection: ID in watchlist but not found in `/api/players` response → render "Departed" pill.
- **D-10:** `useWatchlist()` hook manages `watchlistIds: number[]` and `toggleWatchlist(id: number)`. State lives at `page.tsx` level. `watchlistIds` and `toggleWatchlist` passed as props to `GemTable` and `WatchlistTab`.
- **D-11:** `WatchlistTab` calls three data hooks: `usePlayers()`, `useLineupNews()`, `usePreSeasonSquad()`. All three are already stale-cached.
- **D-12:** Squad-overlap dot: compare pinned player IDs against IDs in `data?.squad?.starters` + `data?.squad?.bench`. If `data?.squad` is null, overlap dots never render — graceful degradation.
- **D-13:** 48h amber border: for each pinned player, check `lineup_news` entries where `player_id` matches and `news_added` is within 48h of current time. If any entry matches → apply `border-amber-400 dark:border-amber-500` to the card border.
- **D-14:** Bespoke `WatchlistPlayerCard` component — does NOT reuse `PriceTrendCell` or `NewsBanner`. Card is self-contained with: player name, position badge, price + inline trend arrow (`▲/▼` from `cost_change_event`), ownership %, news amber border, overlap dot, Departed pill.
- **D-15:** New action row added as the **first child** of both mobile and desktop expand rows, before the existing rejection panel / insight section / ConfirmedSigningBadge content.
- **D-16:** Star button text: `⭐ Pin to watchlist` (unpinned) / `⭐ Pinned` (pinned, amber text). Text button style — not icon-only.
- **D-17:** `toggleWatchlist(player.id)` called on click. No confirmation, no toast — immediate toggle.

### Claude's Discretion

- Exact stale time for `useWatchlist` re-reads from localStorage (suggest initialising on mount; no polling — localStorage is synchronous)
- Whether `WatchlistTab` sorts cards by position order or alphabetical (suggest position order: GK → DEF → MID → FWD, matching the squad grid convention)
- TDD test scope for `WatchlistPlayerCard` (suggest: render tests for each visual state — departed, amber border, overlap dot, normal)
- Exact `SquadHealth` TypeScript interface field names and types (align with `pre_season_squad_health.json` Python output)

### Deferred Ideas (OUT OF SCOPE)

- `greedy_optimality_gap_avg` computation (ILP comparison at sampled budget points) — deferred beyond Phase 127; field present in schema as `null`
- Sort order options for WatchlistTab (alphabetical, by price, by xPts) — deferred; position order is the default
- Watchlist sharing / export — out of scope (personal tool, no multi-user)
- Pinned-at timestamp in localStorage — deferred; plain ID array sufficient for Phase 127
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GREEDY-01 | `pipeline/squad_health.py` sweeps £80–£120m in £0.5m steps, runs Python port of greedy builder, writes `pre_season_squad_health.json` to Vercel Blob | Python greedy algorithm fully readable in `src/lib/pre-season-squad.ts` and `suggest_squad.py`; `upload.py` `save()` function is the write path |
| GREEDY-02 | `diagnoseBuildPreSeasonSquad()` sibling function exported from `src/lib/pre-season-squad.ts` returning structured reason codes; `health` field added to API response schema | Existing `buildPreSeasonSquad()` returns `null` without reason — new function augments it |
| GREEDY-03 | Health indicator in `NextSeasonPlannerTab` below the cost slider; solver badge on squad formation grid | `FormationGrid` and `NextSeasonPlannerTab` are straightforward React additions; component is 153 lines, well structured |
| WATCH-01 | `useWatchlist()` hook backed by localStorage; IDs only; rehydrates from `/api/players` each render; "Departed" pill for removed IDs | `usePlayers()` hook returns full `MergedPlayer[]` including `id`; `loadManualPlan()` localStorage pattern is the precedent |
| WATCH-02 | Watchlist card: price + trend arrow, ownership%, 48h amber border, squad-overlap indicator, ConfirmedSigningBadge | `useLineupNews()` returns `Map<number, LineupNewsPlayer>` with per-player data; `usePreSeasonSquad()` returns `starters` + `bench` arrays; `cost_change_event` is already on `MergedPlayer` |
| WATCH-03 | Pin/unpin toggle in GemTable expand-row action cluster (mobile + desktop); persists to localStorage on toggle | GemTable expand rows at lines 327–437 are identified; both mobile (`sm:hidden`) and desktop (`hidden sm:table-row`) rows confirmed |
| WATCH-04 | Dedicated "Watchlist" sub-tab in Plan section after "Next Season"; 2-col mobile / 3-col desktop card grid; empty state; loading skeleton; error state | `SECTIONS` constant in `page.tsx` line 61; `SubTab` union line 59; render block pattern from existing sub-tabs confirmed |
</phase_requirements>

---

## Summary

Phase 127 delivers two independent features that share no data dependencies at runtime but both build on the Phase 126 pre-season infrastructure.

The **Squad Health Diagnostics** track adds a Python pipeline script (`squad_health.py`) that sweeps 81 budget points through the greedy builder (ported from TypeScript to Python inline), writes a JSON health artifact to Vercel Blob, and threads this data into the existing `/api/pre-season-squad` route via a side-read. The route response envelope changes shape — a breaking change that all existing consumers (`usePreSeasonSquad`, `NextSeasonPlannerTab`) must handle. The TypeScript greedy algorithm is already visible in `src/lib/pre-season-squad.ts` and its Python equivalent is visible in `suggest_squad.py`'s helper functions; porting is mechanical.

The **Transfer Target Watchlist** track adds localStorage-backed state (`fplx_watchlist`) managed by a `useWatchlist()` hook, a star button in every GemTable expand row (both mobile and desktop), and a new "Watchlist" sub-tab in the Plan section. All data comes from three already-stale-cached hooks (`usePlayers`, `useLineupNews`, `usePreSeasonSquad`) so no new API endpoints are needed. The GemTable expand rows are the most complex surgical site — both the `sm:hidden` mobile row and the `hidden sm:table-row` desktop row require identical action-row insertions.

**Primary recommendation:** Implement the five areas strictly in dependency order: (1) Python pipeline + `SquadHealth` type + API envelope, (2) `usePreSeasonSquad` return-type update + consumer fixes, (3) `useWatchlist` hook + `page.tsx` wiring, (4) GemTable star button, (5) `WatchlistTab` + `WatchlistPlayerCard`. Tests for each area can be written wave-by-wave using the established vitest / RTL + pytest patterns already present.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Budget sweep & health computation | Pipeline (Python) | — | CPU-bound; off-season batch job; not suitable for browser or server route |
| Health artifact storage | Vercel Blob | Local cache | Same pattern as every other pipeline output |
| Health data delivery to UI | API / Backend (`/api/pre-season-squad`) | — | Side-read bolted onto existing route; no new endpoint needed |
| Solver inference | API / Backend (route.ts) | — | Inferred from resolution path inside the route (D-07); not stored in the JSON artifact |
| Health + solver display | Frontend (React component) | — | Stateless render of data already delivered by `usePreSeasonSquad` |
| Watchlist persistence | Browser (localStorage) | — | Personal per-device state; no server required |
| Watchlist state management | Frontend (page.tsx state) | — | Same lift pattern as `planHorizon` / `submittedId` (D-10) |
| Watchlist data enrichment | Frontend (TanStack Query cache) | — | All enrichment from hooks that are already stale-cached |
| GemTable star button | Frontend (GemTable.tsx) | — | Purely UI; calls `toggleWatchlist` prop |
| Departed player detection | Frontend (WatchlistTab) | — | Client-side set-difference: watchlist IDs minus IDs in `/api/players` response |

---

## Standard Stack

### Core (all already installed)

[VERIFIED: package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI components | Project standard |
| Next.js | 16.2.1 | App router, API routes | Project standard |
| @tanstack/react-query | ^5.95.2 | Server state / cache | All hooks use this pattern |
| @tanstack/react-table | ^8.21.3 | GemTable backbone | GemTable.tsx is built on this |
| Tailwind CSS | ^4 | Styling | Project standard (all components) |
| vitest | (devDependency) | JS/TS tests | vitest.config.ts present |
| @testing-library/react | (devDependency) | RTL component tests | All component tests use this |
| pulp | >=2.7.0 | ILP solver (pipeline) | Already in pipeline/requirements.txt |
| python-dotenv | >=1.0.0 | Env loading (pipeline) | Already in pipeline/requirements.txt |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | (pipeline test runner) | Python unit tests | pipeline/tests/ directory; use for squad_health.py tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage (plain) | `useSyncExternalStore` + storage event | REQUIREMENTS.md WATCH-01 specifies `useSyncExternalStore`; CONTEXT.md D-09/D-10 locks plain `useState` + lazy init. Use CONTEXT.md pattern — it's locked. Cross-tab sync deferred to v1.26. |
| Inline trend arrow (▲/▼) | Reuse `PriceTrendCell` | D-14 explicitly forbids reuse — `WatchlistPlayerCard` is self-contained |

---

## Architecture Patterns

### System Architecture Diagram

```
Pipeline (squad_health.py)
  ├── read fpl_bootstrap.json (Blob / local cache)
  ├── loop budget 800..1200 step 5 (81 iterations)
  │   └── greedy_build(players, score_map, budget) → squad | None
  ├── compute greedy_null_rate, min_feasible_budget_greedy
  └── save('pre_season_squad_health.json', health_dict)

/api/pre-season-squad (route.ts)
  ├── readBlobOrLocal('pre_season_squad.json')   → squad | null, solver='ilp'
  │   OR
  ├── readBlobOrLocal('season_archive_gw38.json') → greedy build → solver='greedy'
  ├── readBlobOrLocal('pre_season_squad_health.json') → health | null  [SIDE-READ]
  └── return { squad, health, solver }

Browser
  ├── usePreSeasonSquad()       → PreSeasonSquadResponse | null
  │   ├── NextSeasonPlannerTab reads data?.squad, data?.health, data?.solver
  │   └── WatchlistTab reads data?.squad for overlap dot
  ├── useWatchlist()            → { watchlistIds, toggleWatchlist }
  │   ├── init from localStorage['fplx_watchlist'] on mount
  │   └── write to localStorage on every toggle
  ├── usePlayers()              → MergedPlayer[] (enrichment for WatchlistTab)
  └── useLineupNews()           → Map<id, LineupNewsPlayer> | undefined

page.tsx
  ├── holds watchlistIds: number[] + toggleWatchlist: (id) => void
  ├── passes to GemTable (star button) and WatchlistTab (card rendering)
  └── SubTab union includes 'watchlist'; SECTIONS Plan array extended
```

### Recommended Project Structure

New files for this phase:

```
pipeline/
├── squad_health.py              # NEW — budget sweep + health artifact writer
src/
├── lib/
│   ├── types.ts                 # ADD: SquadHealth, PreSeasonSquadResponse interfaces
│   └── hooks/
│       ├── usePreSeasonSquad.ts # MODIFY: return type to PreSeasonSquadResponse | null
│       └── useWatchlist.ts      # NEW — localStorage-backed hook
├── components/
│   ├── gem-table/
│   │   └── GemTable.tsx         # MODIFY: add watchlistIds + toggleWatchlist props; insert action row
│   ├── next-season/
│   │   └── NextSeasonPlannerTab.tsx  # MODIFY: read data?.squad; add health indicator + solver badge
│   └── watchlist/
│       ├── WatchlistTab.tsx     # NEW — sub-tab shell with grid + empty/loading/error states
│       └── WatchlistPlayerCard.tsx  # NEW — card component for a single pinned player
└── app/
    ├── page.tsx                 # MODIFY: SubTab union, SECTIONS, useWatchlist state, WatchlistTab render
    └── api/
        └── pre-season-squad/
            └── route.ts         # MODIFY: envelope shape, health side-read, solver inference
```

### Pattern 1: Python Greedy Build (squad_health.py)

The greedy algorithm in TypeScript (`src/lib/pre-season-squad.ts`) must be ported to Python for the sweep. The Python equivalent already exists in `suggest_squad.py`'s helper functions (`_compute_score_map`), but the greedy selection loop itself is the TypeScript version. Port it inline.

[VERIFIED: src/lib/pre-season-squad.ts]

```python
# squad_health.py — greedy port
MIN_SLOTS = {1: 2, 2: 3, 3: 2, 4: 1}
MAX_SLOTS = {1: 2, 2: 5, 3: 5, 4: 3}
TEAM_CAP = 3

def _greedy_build(players: list, score_map: dict, budget: int) -> list | None:
    """Python port of buildPreSeasonSquad() from src/lib/pre-season-squad.ts.
    Returns list of 15 selected players or None if squad infeasible.
    """
    eligible = [p for p in players if p['id'] in score_map]
    # Sort: score desc; tie-break: cheaper wins
    eligible.sort(key=lambda p: (-score_map[p['id']], p['now_cost']))

    filled = {1: 0, 2: 0, 3: 0, 4: 0}
    team_count: dict = {}
    squad = []
    running_cost = 0

    for p in eligible:
        if len(squad) >= 15:
            break
        pos = p['element_type']
        if filled[pos] >= MAX_SLOTS[pos]:
            continue
        if team_count.get(p['team'], 0) >= TEAM_CAP:
            continue
        if running_cost + p['now_cost'] > budget:
            continue
        squad.append(p)
        filled[pos] += 1
        team_count[p['team']] = team_count.get(p['team'], 0) + 1
        running_cost += p['now_cost']

    if len(squad) < 15:
        return None
    for pos in [1, 2, 3, 4]:
        if filled[pos] < MIN_SLOTS[pos]:
            return None
    return squad
```

### Pattern 2: API Envelope Shape (route.ts)

[VERIFIED: src/app/api/pre-season-squad/route.ts]

The existing `readBlobOrLocal` helper is already available at line 14 of `route.ts`. The health side-read is a parallel read — not a new resolution step.

```typescript
// Inside GET() handler in route.ts
const [preComputedData, healthData] = await Promise.all([
  readBlobOrLocal('pre_season_squad.json'),
  readBlobOrLocal('pre_season_squad_health.json'),  // side-read: null if absent
])

const health: SquadHealth | null = healthData ? JSON.parse(healthData) : null
```

Resolution path then determines `solver`. Response shape:

```typescript
return Response.json({ squad, health, solver }, { status: 200, headers: { ... } })
```

### Pattern 3: useWatchlist Hook

[VERIFIED: src/components/planner/ManualPlanTab.tsx lines 38-42 — localStorage lazy init pattern]

```typescript
// src/lib/hooks/useWatchlist.ts
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'fplx_watchlist'

function loadWatchlist(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'number') : []
  } catch {
    return []
  }
}

export function useWatchlist() {
  const [watchlistIds, setWatchlistIds] = useState<number[]>(() => loadWatchlist())

  const toggleWatchlist = useCallback((id: number) => {
    setWatchlistIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { watchlistIds, toggleWatchlist }
}
```

### Pattern 4: GemTable Star Button Insertion

[VERIFIED: src/components/gem-table/GemTable.tsx lines 317–437 — both expand rows confirmed]

The star button must be inserted as the **first child** of both expand row `<td>` bodies (line 328 mobile, line 404 desktop). The existing pattern for buttons in the mobile row is the action sheet buttons (lines 330–353 with `text-xs` `bg-zinc-100` rounded buttons). The star button uses a `text-button` style consistent with `ComparisonSearch`.

Key: `GemTableProps` interface at line 134 must gain `watchlistIds?: number[]` and `toggleWatchlist?: (id: number) => void`. Callers in `page.tsx` pass these from the `useWatchlist()` state.

### Pattern 5: page.tsx Wiring

[VERIFIED: src/app/page.tsx lines 59, 88, 279–311]

Three surgical edits to `page.tsx`:

1. `SubTab` union (line 59): add `'watchlist'`
2. `SECTIONS` Plan subTabs array (lines 82–89): add `{ id: 'watchlist', label: 'Watchlist', mobileLabel: 'Watchlist' }` after the `'next-season'` entry
3. Render block: add `{activeSection === 'plan' && activeSubTab === 'watchlist' && <WatchlistTab ... />}` after the `next-season` render block

### Pattern 6: useLineupNews — 48h Check

[VERIFIED: src/lib/hooks/useLineupNews.ts]

`useLineupNews()` returns `Map<number, LineupNewsPlayer> | undefined` (via the `lineupNewsSelect` transform). `undefined` = stale (>48h old at the whole-file level). For the amber border, the check is:

```typescript
// Per player in WatchlistTab
const newsEntry = lineupNewsMap?.get(player.id)
// lineupNewsMap is undefined when scraped_at is >48h old — border never shows
// If present, check news_added on individual player entry
const hasRecentNews = newsEntry != null
  && newsEntry.news_headline != null
  && isWithin48h(newsEntry.scraped_at)
```

Note: `lineupNewsSelect` already gates the entire map on whole-file staleness (48h from `data.scraped_at`). Individual `LineupNewsPlayer` entries have `scraped_at` (the pipeline run timestamp, shared with the root) but NOT a per-player `news_added`. The CONTEXT.md D-13 says "check `lineup_news` entries where `player_id` matches and `news_added` is within 48h". However `LineupNewsPlayer` in `types.ts` does NOT have a `news_added` field — it has `scraped_at` at the root level.

**Resolution:** The `lineupNewsSelect` 48h gate on `data.scraped_at` already satisfies the 48h requirement — if the map is not `undefined`, the data is fresh. Use the presence of a matching entry with a non-null `news_headline` as the amber border trigger. No per-player timestamp calculation needed.

### Anti-Patterns to Avoid

- **Do not add a `news_added` check inside `WatchlistTab` on `LineupNewsPlayer`** — that field does not exist on the type. The whole-map staleness gate in `lineupNewsSelect` is the correct 48h guard.
- **Do not import from TypeScript in `squad_health.py`** — D-01 is explicit: port the greedy logic inline in Python.
- **Do not lift `useLineupNews()` or `usePlayers()` to `page.tsx`** — D-11 says these are called inside `WatchlistTab` directly (they are already stale-cached at the TanStack Query level; no re-fetch on tab switch).
- **Do not store timestamps or metadata in `localStorage['fplx_watchlist']`** — D-09 locks format to `JSON.stringify(number[])` (plain ID array). Note: REQUIREMENTS.md WATCH-01 specifies `{version: 1, ids: number[], added: Record<string, string>}` — this conflicts with CONTEXT.md D-09. **CONTEXT.md (locked decision D-09) takes precedence**: use `number[]` only.
- **Do not break the IS_GW38 block in `run.py`** — `squad_health.py` runs inside IS_GW38 (same block as `suggest_squad.py`), NOT inside IS_OFF_SEASON. The context says "gated to pre-season only via `PRE_SEASON_ACTIVE`" in REQUIREMENTS.md GREEDY-01, but CONTEXT.md D-04 locks it to the IS_OFF_SEASON block pattern. Follow CONTEXT.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blob read/write | Custom fetch logic | `readBlobOrLocal()` in route.ts; `save()` in upload.py | Already handles USE_BLOB env var, ENOENT, list+fetch pattern |
| TanStack Query caching | Manual cache | `useQuery` with `staleTime` | All other hooks use this; 6h staleTime is the project standard |
| localStorage safe-read | Unguarded `localStorage.getItem` | Try/catch pattern from `ManualPlanTab` lines 38-42 | Throws in SSR / private browsing |
| Greedy builder in Python | New ILP call | Port of `buildPreSeasonSquad()` | ILP is expensive; sweep is 81 greedy calls, fast enough |
| Player departed detection | DB lookup | Client-side: watchlistIds.filter(id => !playerMap.has(id)) | All player data is in the `usePlayers()` cache |
| Position-order sort | Custom comparator | `[1,2,3,4].indexOf(element_type)` | GK→DEF→MID→FWD matches squad grid convention |

---

## Runtime State Inventory

This phase does not rename or refactor any identifiers — greenfield additions only. No runtime state migration needed.

**Nothing found in any category** — Phase 127 adds new files and new localStorage keys; it does not rename existing ones.

---

## Common Pitfalls

### Pitfall 1: REQUIREMENTS.md vs CONTEXT.md conflict on localStorage shape

**What goes wrong:** REQUIREMENTS.md WATCH-01 specifies `{version: 1, ids: number[], added: Record<string, string>}`. CONTEXT.md D-09 locks `JSON.stringify(number[])` (plain array). Building the REQUIREMENTS.md shape breaks D-09 and creates a migration problem for future phases.

**Why it happens:** REQUIREMENTS.md was written before the discuss-phase locked decisions.

**How to avoid:** CONTEXT.md decisions are locked. Use `number[]` only. If a future phase adds timestamps, it will handle migration at that time.

**Warning signs:** Any code writing an object with `version`, `ids`, or `added` keys to `fplx_watchlist`.

### Pitfall 2: Breaking existing usePreSeasonSquad consumers

**What goes wrong:** `usePreSeasonSquad` currently returns `PreSeasonSquad | null`. After D-05, it returns `PreSeasonSquadResponse | null`. Any code that reads `data.starters`, `data.bench`, `data.formation`, or `data.budgetUsed` directly (without `data?.squad.`) will have TypeScript errors or runtime crashes.

**Why it happens:** `NextSeasonPlannerTab` (line 109: `squadSection = <FormationGrid squad={data} />`) passes `data` directly to `FormationGrid`. After the change, it must pass `data?.squad`.

**How to avoid:** Search for all references to `usePreSeasonSquad` before and after the change. Update every consumer in the same plan wave.

**Warning signs:** TypeScript compiler errors on `data.starters` / `data.bench` after the hook return type changes.

### Pitfall 3: squad_health.py runs in the wrong pipeline block

**What goes wrong:** CONTEXT.md D-03/D-04 say `squad_health.py` runs after `suggest_squad.py` in `run.py`, gated by the same IS_OFF_SEASON guard. But `suggest_squad.py` actually runs inside the **IS_GW38** block (lines 205–236 of `run.py`), not the IS_OFF_SEASON else-block.

**Why it happens:** CONTEXT.md uses the phrase "same IS_OFF_SEASON block" loosely — looking at `run.py`, `suggest_squad.py` is in IS_GW38.

**How to avoid:** Wire `squad_health.py` inside the IS_GW38 block, after `suggest_squad.py`, not in the IS_OFF_SEASON else block. [VERIFIED: pipeline/run.py lines 205–236]

**Warning signs:** `pre_season_squad_health.json` never being written because the code is in a block that only runs off-season (after GW38 rollover when IS_OFF_SEASON=True).

### Pitfall 4: 48h amber border logic misread

**What goes wrong:** Checking `lineup_news.player.news_added` (which doesn't exist on `LineupNewsPlayer`) instead of using the whole-map staleness gate from `lineupNewsSelect`.

**Why it happens:** `MergedPlayer` has `news_added?: string` but `LineupNewsPlayer` does not. They look similar.

**How to avoid:** Use the fact that `useLineupNews()` returns `undefined` when the map is >48h old. If the map is defined and contains the player ID, the data is fresh — show the amber border.

**Warning signs:** TypeScript error accessing `newsEntry.news_added` on a `LineupNewsPlayer`.

### Pitfall 5: GemTable expand row — mobile/desktop duality

**What goes wrong:** Adding the star button only to the mobile expand row (line 327) and missing the desktop expand row (line 404), or vice versa.

**Why it happens:** The two rows look similar and the `hidden sm:table-row` / `sm:hidden` Tailwind classes are easy to confuse.

**How to avoid:** D-15 is explicit: "added to BOTH". Always edit both the `sm:hidden` mobile row and the `hidden sm:table-row` desktop row.

**Warning signs:** Star button visible on mobile but not desktop (or vice versa).

### Pitfall 6: `useWatchlist` reading localStorage on every render

**What goes wrong:** Calling `localStorage.getItem` inside the component body (not via useState lazy init) causes a read on every re-render.

**Why it happens:** Forgetting the lazy initialiser pattern.

**How to avoid:** Use `useState<number[]>(() => loadWatchlist())` — the initialiser arrow runs once on mount only.

### Pitfall 7: `greedy_null_rate` precision / edge cases

**What goes wrong:** If all 81 builds succeed, `greedy_null_rate = 0.0`. If all fail, `min_feasible_budget_greedy` has no valid value — the Python code must handle this (e.g., emit `null`).

**How to avoid:** In `squad_health.py`, collect the set of budgets where greedy returns non-None. `min_feasible_budget_greedy` = min of that set (in £m = divide by 10), or `null` if the set is empty. `greedy_null_rate` = count(None results) / 81.

---

## Code Examples

### Existing readBlobOrLocal (reuse directly for health side-read)

[VERIFIED: src/app/api/pre-season-squad/route.ts lines 14–32]

```typescript
async function readBlobOrLocal(filename: string): Promise<string | null> {
  try {
    if (USE_BLOB) {
      const { blobs } = await list({ prefix: filename, limit: 1 })
      if (!blobs.length) return null
      const res = await fetch(blobs[0].url)
      if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
      return await res.text()
    } else {
      const cachePath = join(process.cwd(), 'pipeline', 'cache', filename)
      return await readFile(cachePath, 'utf-8')
    }
  } catch (err) {
    const isNotFound =
      err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) return null
    throw err
  }
}
```

### Existing localStorage lazy init (mirror in useWatchlist)

[VERIFIED: src/app/page.tsx lines 140–145]

```typescript
const [teamId, setTeamId] = useState<string>(() => {
  try { return localStorage.getItem('fpl_team_id') ?? '' } catch { return '' }
})
```

### Existing sub-tab render block pattern (mirror for WatchlistTab)

[VERIFIED: src/app/page.tsx lines 294–297]

```tsx
{activeSection === 'plan' && activeSubTab === 'next-season' && (
  <NextSeasonPlannerTab />
)}
```

### Existing Python save() usage (reuse in squad_health.py)

[VERIFIED: pipeline/suggest_squad.py line 331]

```python
save(SQUAD_KEY, squad_dict)
```

### Existing IS_GW38 pipeline block structure (wire squad_health.py here)

[VERIFIED: pipeline/run.py lines 205–236]

```python
if IS_GW38:
    try:
        from archive_season import archive_season
        archive_season(bootstrap)
    except Exception as arc_exc:
        print(f"[archive_season] non-fatal error: {arc_exc}", file=sys.stderr)

    try:
        from suggest_squad import suggest_squad
        # ... (archive loading logic)
        suggest_squad(bootstrap, _archive)
    except Exception as sq_exc:
        print(f"[suggest_squad] non-fatal error: {sq_exc}", file=sys.stderr)

    # squad_health.py runs HERE — after suggest_squad, inside IS_GW38
    try:
        from squad_health import compute_squad_health
        compute_squad_health(bootstrap)
    except Exception as sh_exc:
        print(f"[squad_health] non-fatal error: {sh_exc}", file=sys.stderr)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `usePreSeasonSquad()` returns `PreSeasonSquad \| null` | Returns `PreSeasonSquadResponse \| null` (D-05) | Phase 127 | Breaking change to return type; all consumers must be updated in the same wave |
| `/api/pre-season-squad` returns flat squad | Returns `{ squad, health, solver }` envelope | Phase 127 | Phase 128 and 129 consume this envelope without further breaking change |
| No `SquadHealth` type in `types.ts` | `SquadHealth`, `PreSeasonSquadResponse` added | Phase 127 | New types; `greedy_optimality_gap_avg` intentionally `null` until Phase 128+ |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lineupNewsSelect` 48h gate on `data.scraped_at` satisfies the amber-border requirement without per-player `news_added` check | Pitfall 4, Pattern 6 | If per-player staleness is needed, a new field must be added to `LineupNewsPlayer` type and pipeline output — medium refactor |
| A2 | `squad_health.py` belongs in the IS_GW38 block (not IS_OFF_SEASON) based on reading run.py | Pitfall 3, Code Examples | If it needs to run year-round or only off-season, the wiring point changes — low risk since D-04 says "same block as suggest_squad.py" |

---

## Open Questions

1. **`diagnoseBuildPreSeasonSquad()` in GREEDY-02**
   - What we know: CONTEXT.md mentions it as a sibling function in `src/lib/pre-season-squad.ts`; REQUIREMENTS.md specifies reason codes `incomplete_squad | unmet_min_slots | no_eligible_players`
   - What's unclear: Whether this function is used anywhere in the actual UI (the CONTEXT.md says `health` field is added to the API response, but no UI consumption is mentioned for the diagnose output beyond the already-specified health indicator)
   - Recommendation: Implement `diagnoseBuildPreSeasonSquad()` returning `{ reason: 'incomplete_squad' | 'unmet_min_slots' | 'no_eligible_players' } | null` — the function is needed for GREEDY-02 compliance but UI consumption may be limited to the health indicator text

2. **WatchlistPlayerCard position badge style**
   - What we know: Bespoke component (D-14); position badge mentioned but styling is Claude's discretion
   - What's unclear: Whether to reuse any existing position badge component
   - Recommendation: Simple inline span matching the existing `POSITION_LABELS` convention (`GK / DEF / MID / FWD`) with a muted zinc background

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python + pulp | squad_health.py pipeline | Assumed available | In requirements.txt | — |
| Vercel Blob (USE_BLOB=true) | Production write path | Assumed available | — | Local cache (`pipeline/cache/`) |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (JS/TS) + pytest (Python) |
| Config file | `vitest.config.ts` (JS), `pipeline/tests/conftest.py` (Python) |
| Quick run command | `npx vitest run --reporter=verbose` (JS); `python -m pytest pipeline/tests/test_squad_health.py -x` (Python) |
| Full suite command | `npx vitest run` + `python -m pytest pipeline/tests/ -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GREEDY-01 | `squad_health.py` sweep computes correct null_rate and min_feasible_budget | unit (Python) | `python -m pytest pipeline/tests/test_squad_health.py -x` | Wave 0 |
| GREEDY-02 | `diagnoseBuildPreSeasonSquad()` returns correct reason codes | unit (TS) | `npx vitest run src/lib/pre-season-squad.test.ts` | Wave 0 (file exists for pre-season-squad) |
| GREEDY-03 | `NextSeasonPlannerTab` renders health indicator and solver badge from mock data | unit (RTL) | `npx vitest run src/components/next-season/NextSeasonPlannerTab.test.tsx` | Exists (needs new test cases) |
| WATCH-01 | `useWatchlist()` init from localStorage; toggle adds/removes IDs; persists | unit (TS) | `npx vitest run src/lib/hooks/useWatchlist.test.ts` | Wave 0 |
| WATCH-02 | `WatchlistPlayerCard` renders departed pill, amber border, overlap dot, normal state | unit (RTL) | `npx vitest run src/components/watchlist/WatchlistPlayerCard.test.tsx` | Wave 0 |
| WATCH-03 | GemTable star button visible; calls `toggleWatchlist` on click | unit (RTL) | `npx vitest run src/components/gem-table/GemTable.test.tsx` | Needs check |
| WATCH-04 | `WatchlistTab` renders empty state, loading skeleton, error state | unit (RTL) | `npx vitest run src/components/watchlist/WatchlistTab.test.tsx` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run` (full JS suite, <30s)
- **Per wave merge:** `npx vitest run` + `python -m pytest pipeline/tests/ -x`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pipeline/tests/test_squad_health.py` — covers GREEDY-01 (budget sweep, null_rate, min_feasible_budget)
- [ ] `src/lib/hooks/useWatchlist.test.ts` — covers WATCH-01 (localStorage init, toggle, persist)
- [ ] `src/components/watchlist/WatchlistPlayerCard.test.tsx` — covers WATCH-02 visual states
- [ ] `src/components/watchlist/WatchlistTab.test.tsx` — covers WATCH-04 empty/loading/error states
- [ ] New test cases in `src/components/next-season/NextSeasonPlannerTab.test.tsx` — covers GREEDY-03 (health indicator, solver badge; existing file has Phase 126 tests only)

---

## Security Domain

This phase adds no authentication, no external API calls, no user-uploaded content, and no new server-side data paths beyond extending an existing route. The new route behaviour (`readBlobOrLocal` side-read) follows the same trust model as the existing blob reads (server-side only, no user input).

- **V5 Input Validation:** The `watchlistIds` array is read from localStorage and used only as a filter set against the already-validated `/api/players` response. No user-supplied IDs are ever sent to an API endpoint. Risk: low.
- **localStorage tampering:** A user can modify `fplx_watchlist` to contain arbitrary numbers. These are only used to filter the player list client-side — no security boundary crossed.

No additional ASVS controls required for this phase.

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/pre-season-squad/route.ts` — existing route; resolution order, `readBlobOrLocal`, response shape
- `src/lib/pre-season-squad.ts` — TypeScript greedy builder (Python port source)
- `pipeline/suggest_squad.py` — Python `_compute_score_map`, `_solve_ilp`, `_derive_squad_dict` patterns
- `pipeline/run.py` — IS_GW38 block wiring (lines 205–236)
- `pipeline/upload.py` — `save()` function
- `src/lib/types.ts` — `PreSeasonPlayer`, `PreSeasonSquad`, `LineupNewsPlayer`, `MergedPlayer`
- `src/lib/hooks/usePreSeasonSquad.ts` — current return type, staleTime
- `src/lib/hooks/useLineupNews.ts` — `lineupNewsSelect` 48h gate behaviour
- `src/lib/hooks/usePlayers.ts` — `usePlayers` return type, staleTime
- `src/app/page.tsx` — `SubTab`, `SECTIONS`, localStorage lazy init patterns, render block pattern
- `src/components/gem-table/GemTable.tsx` — expand row structure (lines 317–437), `GemTableProps`
- `src/components/next-season/NextSeasonPlannerTab.tsx` — `FormationGrid`, consumer structure
- `src/components/next-season/NextSeasonPlannerTab.test.tsx` — existing test patterns (RTL, vi.mock)
- `pipeline/requirements.txt` — pulp>=2.7.0 confirmed present
- `vitest.config.ts` — test environment (jsdom), alias, exclude patterns
- `.planning/config.json` — `nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — cross-referenced with CONTEXT.md; CONTEXT.md locked decisions take precedence where they conflict

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and requirements.txt
- Architecture: HIGH — all patterns traced to actual source files
- Pitfalls: HIGH — all identified from direct code inspection, not speculation
- Python port accuracy: HIGH — TypeScript source and Python patterns are both readable

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable codebase; 30-day estimate)
