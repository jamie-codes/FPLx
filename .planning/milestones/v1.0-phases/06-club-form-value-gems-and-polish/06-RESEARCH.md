# Phase 6: Club Form, Value Gems and Polish - Research

**Researched:** 2026-03-29
**Domain:** Next.js 16 Route Handlers, TanStack Table v8, React 19, pipeline Python, Tailwind v4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Club Form Table (FFA-03)**
- Rolling window: Last 5 games
- Placement: New "Club Form" tab in main nav
- Stats per row: Wins, Draws, Losses, Goals Scored, Goals Conceded over last 5 finished fixtures — computed server-side from `pipeline/cache/fpl_fixtures.json`
- Route: New `/api/club-form` Route Handler — reads `fpl_fixtures.json` and `fpl_bootstrap.json` from cache, computes rolling form, returns array of ClubForm objects
- Sortable: Yes — TanStack Table, sortable by any column (same pattern as GemTable / DefConTables)

**Value Gems View (VAL-01, VAL-02)**
- Placement: New "Value Gems" tab in main nav
- Sub-filters: Two filter pills — "Cheap (£6m-)" and "Low-owned (<10%)"
  - "Cheap" = `now_cost / 10 <= 6.0`
  - "Low-owned" = `parseFloat(selected_by_percent) < 10`
  - Filters are independent — user can toggle between them (or show players matching either)
- Data source: `usePlayers()` hook already available — no new API needed; `computeAllGemScores` already runs on players data
- Columns: Player name, Position, Team, Price, Ownership %, Recent Points (`total_points`), Gem Score, Price Trend
- Default sort: Gem Score descending within selected filter

**Price Trend (VAL-03)**
- Data fields: `cost_change_event` and `cost_change_start` — both already in FPL bootstrap
- Display format: Arrow + amount: `↑ 0.1m` (green), `↓ 0.1m` (red), `—` (grey)
  - Threshold for stable: `cost_change_event === 0`
  - Show GW change as primary; season-total as secondary sub-text
- Views that show price trend: Gem Ratings table, Value Gems view, Squad & Transfers tab
- Pipeline change needed: `cost_change_event` and `cost_change_start` must be added to `merge.py` output and `MergedPlayer` type

**Fixture Difficulty Badges (UIX-03)**
- Fixtures per row: Next 5 upcoming fixtures
- Badge style: Coloured mini chips — `[OPP H]` or `[OPP A]` using team short name + H/A
  - Colour: green=easy, amber=medium, red=hard (using existing `difficulty_tier`)
- Views that get badges: Gem Ratings table, Value Gems view, Club Form table
- Implementation: Reusable `<FixtureBadges fixtures={player.fixtures.slice(0, 5)} />` in `src/components/fixtures/`

**Last-Updated Timestamp (DAT-02)**
- Source: `last_updated.json` already written by pipeline with ISO timestamp and `stale: boolean`
- Display: Small footer/header line on every data view — "Data as of {date} {time}" — amber/grey if stale
- Route: Already serving from pipeline cache; needs a UI component reading from `/api/fpl/last-updated` or shared hook
- Placement: Visible on all tabs (persistent header or per-tab footer)

### Claude's Discretion

*(None specified — all decisions locked above)*

### Deferred Ideas (OUT OF SCOPE)

- User-adjustable price/ownership sliders
- Club form inline within other tabs (kept as own tab)
- Live price change predictions (requires transfer volume analysis)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FFA-03 | Club form table: wins, goals scored, goals conceded over last N weeks | `fpl_fixtures.json` has 309 finished fixtures with `team_h_score`, `team_a_score`, `team_h`, `team_a`, `event` fields. Goals-scored and wins computable via same rolling-window pattern as existing FDR code in `merge.py`. |
| VAL-01 | Cheap gems: relatively cheap players getting disproportionate points | `usePlayers()` + `computeAllGemScores` already available. Filter `now_cost / 10 <= 6.0`. No new API needed. |
| VAL-02 | Low-owned but high-scoring: players with ownership < X% but strong recent returns | Same data source as VAL-01. Filter `parseFloat(selected_by_percent) < 10`. |
| VAL-03 | Show current price and price change trend for all analysed players | `cost_change_event` and `cost_change_start` confirmed present in `fpl_bootstrap.json`. Need adding to `merge.py` and `MergedPlayer` type. |
| UIX-01 | Clear, data-forward layout using tabs or cards | Existing tab pattern in `page.tsx` extended — same zinc border-b style. |
| UIX-02 | Scannable tables with sort/filter by position | TanStack Table v8 already used; new tables follow same pattern. |
| UIX-03 | Visual indicators for fixture difficulty (colour-coded easy/hard) | `difficulty_tier: 'easy' | 'medium' | 'hard'` already in `FixtureEntry`. New `<FixtureBadges>` component reads this. |
| UIX-04 | Home/away clearly distinguished | `is_home: boolean` already in `FixtureEntry`. Badge shows `H` or `A` suffix. |
| DAT-02 | Show "last updated" timestamp on all data views | `last_updated.json` confirmed in cache with `last_updated` ISO string and `stale: boolean`. |
</phase_requirements>

---

## Summary

Phase 6 completes the app by adding two new data tabs (Club Form, Value Gems), a price trend column across multiple existing views, fixture difficulty badge chips, and a persistent last-updated timestamp. All changes are additive — no existing code is removed or significantly restructured.

The core work is in four areas: (1) extending `merge.py` and `MergedPlayer` to carry `cost_change_event` / `cost_change_start`, (2) building a new `/api/club-form` Route Handler that reads from cached JSON and computes 5-game rolling form stats, (3) two new React components (`ValueGemsTable`, `ClubFormTable`) following the existing TanStack Table pattern in `GemTable` and `DefConTables`, and (4) two shared utility components — `<FixtureBadges>` and `<LastUpdated>` — that can be dropped into any existing tab.

The data layer is already comprehensive. `fpl_fixtures.json` (380 total, 309 finished) has all the fields needed for club form. `fpl_bootstrap.json` already has `cost_change_event` and `cost_change_start` on every element — they just aren't piped through `merge.py` yet. `last_updated.json` is already written by the pipeline and has the correct shape. `FixtureEntry` already has `difficulty_tier`, `difficulty_score`, and `is_home`, so `<FixtureBadges>` needs only a rendering component, not a data change.

**Primary recommendation:** Start with the pipeline/type layer (cost_change fields), then build shared components (`<FixtureBadges>`, `<LastUpdated>`), then the two new tabs in a final wave — each tab is independent once the shared layer exists.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | `^8.21.3` | Sortable data tables | Already used in GemTable, DefConTables; consistent API |
| `@tanstack/react-query` | `^5.95.2` | Server state / data fetching hooks | Already used for usePlayers, useDefCon, useSquad |
| `next` | `16.2.1` | Route Handlers for `/api/club-form` | Already used for all existing API routes |
| `tailwindcss` | `^4` | Styling | Project standard — zinc palette, utility classes |
| `react` | `19.2.4` | Component library | Project standard |
| `typescript` | `^5` | Type safety | Project standard |
| `vitest` | `^4.1.2` | Unit tests for pure functions | Already used for gem-score, defcon, transfer-engine tests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^4.3.6` | Input validation | Only if validating API response shapes; existing pattern avoids Zod on output (per D-08) |
| `fs/promises` | Node built-in | Reading pipeline cache JSON | Used by all existing API routes in dev mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | Custom `<table>` | TanStack already in place — no reason to diverge |
| Inline computation in Route Handler | Separate `club-form.ts` lib file | Library file is testable; inline is not — use lib file |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── app/
│   └── api/
│       └── club-form/
│           └── route.ts          # New: GET handler, reads fixtures+bootstrap cache
├── components/
│   ├── fixtures/
│   │   └── FixtureBadges.tsx     # New: reusable badge chip row
│   ├── club-form/
│   │   ├── ClubFormTable.tsx     # New: TanStack Table, 'use client'
│   │   └── columns.tsx           # New: column defs for ClubForm type
│   └── value-gems/
│       ├── ValueGemsTable.tsx    # New: TanStack Table with filter pills
│       └── columns.tsx           # New: column defs for ScoredPlayer subset
├── lib/
│   ├── types.ts                  # Modified: add cost_change_event/start to MergedPlayer
│   ├── hooks/
│   │   ├── useClubForm.ts        # New: useQuery(['club-form'])
│   │   └── useLastUpdated.ts     # New: useQuery(['last-updated'])
│   └── club-form.ts              # New: pure computeClubForm() function (testable)
pipeline/
└── merge.py                      # Modified: pass cost_change_event/start through
```

### Pattern 1: Route Handler (server-side JSON computation)

Follows the exact pattern of `src/app/api/defcon/route.ts` — read from `pipeline/cache/`, return raw JSON with cache headers. No USE_BLOB switch needed for club-form (same as defcon — local-only).

```typescript
// src/app/api/club-form/route.ts
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const fixtures = JSON.parse(
      await readFile(join(process.cwd(), 'pipeline', 'cache', 'fpl_fixtures.json'), 'utf-8')
    )
    const bootstrap = JSON.parse(
      await readFile(join(process.cwd(), 'pipeline', 'cache', 'fpl_bootstrap.json'), 'utf-8')
    )
    const data = computeClubForm(bootstrap, fixtures)
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return Response.json({ error: 'Club form data not available' }, { status: 404 })
  }
}
```

### Pattern 2: TanStack Table component

Follows `DefConTables.tsx` exactly — `'use client'`, `useReactTable` with `getCoreRowModel` + `getSortedRowModel`, click-to-sort headers with ▲/▼ indicators, `even:bg-zinc-50 hover:bg-blue-50` row styling.

For ClubFormTable, no position filter is needed (one row per club, 20 rows).

For ValueGemsTable, use client-side state for the filter pills (cheap / low-owned), then derive filtered data with `useMemo` before passing to TanStack. Do not use TanStack's built-in `getFilteredRowModel` for the pill filters — it's simpler to pre-filter the array because the pills are exclusive categories, not column-level filters.

### Pattern 3: Shared hook

Follows `useDefCon.ts` exactly:

```typescript
// src/lib/hooks/useClubForm.ts
import { useQuery } from '@tanstack/react-query'
import type { ClubForm } from '@/lib/types'

export function useClubForm() {
  return useQuery<ClubForm[]>({
    queryKey: ['club-form'],
    queryFn: () => fetch('/api/club-form').then(r => r.json()),
    staleTime: 1000 * 60 * 60 * 6,
  })
}
```

### Pattern 4: Tab extension in page.tsx

`page.tsx` is already `'use client'`. The `Tab` union type must be extended to include `'club-form'` and `'value-gems'`. Each new tab button follows the existing zinc border-b-2 active pattern verbatim.

### Pattern 5: ClubForm computation (pure function in `src/lib/club-form.ts`)

The `fpl_fixtures.json` has per-fixture `stats` arrays with identifiers including `goals_scored`. However, for club-level aggregates (wins/draws/losses/goals scored/goals conceded), the simpler and more reliable approach is to use `team_h_score` / `team_a_score` / `team_h` / `team_a` directly — the same fields already used by `merge.py`.

Algorithm:
1. Filter to finished fixtures, sort by `event` descending
2. For each of the 20 teams, collect the last 5 finished fixtures (look for fixtures where `team_h === teamId` or `team_a === teamId`)
3. Per fixture from team perspective: determine W/D/L, goals scored, goals conceded
4. Aggregate into `{ wins, draws, losses, goals_scored, goals_conceded }`
5. Team name from `fpl_bootstrap.json` `teams` array (`short_name`, `name`)

**Key detail:** Fixtures are per-match, not per-GW. A team may have 0 or 2 fixtures in a single GW (blanks/doubles). The 5-game window means last 5 *fixtures*, not last 5 *gameweeks*. This is consistent with the CONTEXT.md decision ("last 5 finished fixtures").

### Pattern 6: `<FixtureBadges>` component

```typescript
// src/components/fixtures/FixtureBadges.tsx
'use client'
import type { FixtureEntry } from '@/lib/types'

const TIER_COLOURS: Record<string, string> = {
  easy:   'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  hard:   'bg-red-100 text-red-800 border-red-300',
}

export function FixtureBadges({ fixtures }: { fixtures: FixtureEntry[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {fixtures.map((f, i) => (
        <span
          key={i}
          className={`text-xs border rounded px-1 py-0.5 font-mono ${TIER_COLOURS[f.difficulty_tier]}`}
        >
          {f.opponent_team} {f.is_home ? 'H' : 'A'}
        </span>
      ))}
    </div>
  )
}
```

This component is used in:
- `GemTable` columns — add a `fixtures` column to `src/components/gem-table/columns.tsx`
- `ValueGemsTable` columns
- `ClubFormTable` columns (upcoming fixtures for the club)

For Club Form, the `FixtureBadges` takes club-level upcoming fixture data, not player-level. The club-form route handler must also include next-5 upcoming fixtures per club (same `team_fixtures` computation already in `merge.py`).

### Pattern 7: `<LastUpdated>` component and hook

```typescript
// src/lib/hooks/useLastUpdated.ts
export function useLastUpdated() {
  return useQuery({
    queryKey: ['last-updated'],
    queryFn: () => fetch('/api/fpl/last-updated').then(r => r.json()),
    staleTime: 1000 * 60 * 60,
  })
}
```

**Critical:** There is currently no `/api/fpl/last-updated` route — the `/api/fpl/[...proxy]` catch-all handles FPL API proxying. A dedicated `/api/fpl/last-updated/route.ts` will conflict with the catch-all unless it is placed at a path the catch-all does not capture. In Next.js 16, a static route handler at `/api/fpl/last-updated/route.ts` takes precedence over the `[...proxy]` catch-all — this is standard Next.js routing behaviour. Verified against Next.js docs: static segments have higher priority than dynamic/catch-all segments.

Alternatively, the simpler approach is to add a `/api/last-updated/route.ts` route outside the `/api/fpl/` namespace. This avoids any priority edge-case concern entirely.

The `last_updated.json` cache file shape (confirmed):
```json
{
  "last_updated": "2026-03-29T11:32:08.202263+00:00",
  "stale": false,
  "source": "local",
  "player_count": 825,
  "team_count": 20,
  "fixture_count": 380,
  "merged_count": 825
}
```

### Anti-Patterns to Avoid

- **Do not add `cost_change_event` to `FPLElement` Zod schema in fpl-adapter**: The CONTEXT.md decision is to add these to `merge.py` output (Python side) and `MergedPlayer` TypeScript type only. `FPLElement` is for the parsed FPL bootstrap element — it could be added there too, but the minimum change is merge.py → MergedPlayer.
- **Do not use `team_h_difficulty` from fixtures for club form FDR**: Per D-02 decision (STATE.md), official FPL difficulty is never used as primary signal.
- **Do not compute club form in the browser**: Route Handler computes it server-side (reduces client payload, consistent with defcon pattern).
- **Do not create a new `useQuery` with a 0 staleTime for last-updated**: 1-hour staleTime matches the data's daily refresh cadence without causing excessive refetches.
- **Do not hand-roll a filter/sort table from scratch**: TanStack Table is already imported and used — adding a new table is 40 lines following an existing file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table | Custom `<table>` with sort state | TanStack Table v8 (`useReactTable`) | Already in project; handles sort indicators, column defs, filtered rows |
| Server state with cache | `useState` + `useEffect` + manual fetch | `useQuery` from TanStack Query | Already in project; handles loading/error states, staleTime, deduplication |
| Colour-coded badges | Custom CSS classes | Tailwind utility classes with tier-keyed map | Already used throughout; four-line approach shown above |
| Date formatting | `toLocaleDateString` with manual locale strings | `new Date(iso).toLocaleString('en-GB', { ... })` | Built-in, no library needed; consistent with project approach |

**Key insight:** Phase 6 is almost entirely composition of existing patterns. The new code is thin: one Python dict extension, one pure TypeScript function, two column definition files, two table components, two hooks, and two small utility components.

---

## Common Pitfalls

### Pitfall 1: Club Form — DGW/BGW teams have != 5 entries in last 5 GWs

**What goes wrong:** A team with a Double Gameweek has 2 fixtures in one GW; a team with a Blank Gameweek has 0. Collecting "last 5 fixtures" correctly means sorting all finished fixtures by kickoff order (event + fixture id) and taking the last 5 per team — NOT filtering `event IN last_5_event_ids`.

**Why it happens:** Naive approach groups by GW number rather than individual fixture.

**How to avoid:** Iterate finished fixtures in order per team, collecting until count=5 (same approach as `team_fixtures` building in `merge.py`).

**Warning signs:** A team showing only 3 or 4 rows in the form window despite having played 30+ games.

### Pitfall 2: Price trend column in GemTable — MergedPlayer type change is a cascade

**What goes wrong:** Adding `cost_change_event` and `cost_change_start` to `MergedPlayer` breaks the existing `makeMergedPlayer` factory in `tests/lib/gem-score.test.ts` (TypeScript strict mode requires all fields).

**Why it happens:** The test factory function creates a minimal `MergedPlayer` — adding required fields to the type causes TypeScript compilation errors in the test.

**How to avoid:** When adding fields to `MergedPlayer`, update the `makeMergedPlayer` test factory at the same time. The fields can be optional (`cost_change_event?: number`) or the factory gets default values (0).

**Warning signs:** `vitest` run fails with "Property 'cost_change_event' is missing" errors.

### Pitfall 3: `/api/fpl/last-updated` vs catch-all conflict

**What goes wrong:** Creating `src/app/api/fpl/last-updated/route.ts` may shadow or conflict with `src/app/api/fpl/[...proxy]/route.ts` if the developer is uncertain about Next.js 16 routing priority.

**Why it happens:** Developers unfamiliar with the routing precedence assume catch-alls override static segments.

**How to avoid:** Use `/api/last-updated/route.ts` — place it at the top level of `/api/`, outside the `/fpl/` namespace. Cleanest solution, no ambiguity.

**Warning signs:** 404 or wrong data returned when fetching `/api/fpl/last-updated`.

### Pitfall 4: Value Gems filter pills — "either" vs "both" semantics

**What goes wrong:** The CONTEXT.md says filters are independent and user can "toggle between them (or show players matching either)". This needs a clear UI decision: are the pills mutually exclusive radio buttons, or additive checkboxes?

**Why it happens:** "Independent" and "toggle between them" suggest mutual exclusion (radio), but "show players matching either" suggests OR logic (checkbox).

**How to avoid:** Implement as radio-style pills (one active at a time): "Cheap", "Low-Owned", or "All". This is the simplest interpretation and avoids an empty intersection for some GWs. Default to "Cheap" active.

**Warning signs:** Users confused by both filters active simultaneously with a small result set.

### Pitfall 5: Fixture badges on GemTable — column width blowout

**What goes wrong:** Adding 5 fixture badge chips to the GemTable (already wide) makes the row too wide for comfortable scanning, causing horizontal scroll on normal screens.

**Why it happens:** Each badge is roughly 50-60px wide; 5 badges = 300px of new column.

**How to avoid:** Make the fixtures column narrower by abbreviating to 3-letter opponent short names (already the case — short_name is e.g. "ARS") and keeping badge padding minimal. The existing `overflow-x-auto` wrapper handles overflow. Consider placing the fixtures column last.

---

## Code Examples

Verified patterns from existing codebase:

### Club Form data shape (new type to add to types.ts)
```typescript
// src/lib/types.ts — add ClubForm interface
export interface ClubFormFixture {
  opponent_team: string       // short_name
  is_home: boolean
  event_id: number
  difficulty_score: number
  difficulty_tier: DifficultyTier
}

export interface ClubForm {
  team_id: number
  team_name: string
  team_short_name: string
  wins: number
  draws: number
  losses: number
  goals_scored: number
  goals_conceded: number
  upcoming_fixtures: ClubFormFixture[]   // next 5
}
```

### MergedPlayer extension (add to existing interface)
```typescript
// src/lib/types.ts — inside MergedPlayer interface
cost_change_event: number        // tenths of £1m, this GW (0 = no change)
cost_change_start: number        // tenths of £1m, since season start
```

These are `number` (not `number | null`) because the FPL API confirmed both fields are always present (value `0` for no change).

### merge.py addition (in the player dict construction, step 7)
```python
# Add alongside other FPL core fields
'cost_change_event': element.get('cost_change_event', 0),
'cost_change_start': element.get('cost_change_start', 0),
```

### Price trend cell renderer (for columns.tsx files)
```typescript
// Reusable cell renderer — no separate component needed
col.accessor('cost_change_event', {
  header: 'Trend',
  cell: (info) => {
    const v = info.getValue()
    if (v > 0) return <span className="text-green-600">↑ {(v / 10).toFixed(1)}m</span>
    if (v < 0) return <span className="text-red-600">↓ {(Math.abs(v) / 10).toFixed(1)}m</span>
    return <span className="text-zinc-400">—</span>
  },
})
```

### Last-updated display (inline in each tab component)
```typescript
// Simple inline — no separate component strictly needed
function LastUpdatedBanner({ timestamp, stale }: { timestamp: string; stale: boolean }) {
  const d = new Date(timestamp)
  const label = d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
  return (
    <p className={`text-xs mt-1 ${stale ? 'text-amber-600' : 'text-zinc-400'}`}>
      Data as of {label}{stale ? ' (stale)' : ''}
    </p>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| TanStack Table v7 | TanStack Table v8 (in use) | `useReactTable` API, no `useTable` |
| Next.js pages router | Next.js 16 app router (in use) | Route Handlers in `app/api/`, not `pages/api/` |
| Tailwind v3 `@layer` | Tailwind v4 (in use) | Config via CSS, not `tailwind.config.js` |
| React 18 | React 19 (in use) | `'use client'` boundary still required for hooks/state |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Not applicable — app router only
- `pages/api/` routes: Not used — app router Route Handlers only
- `Response.json()` with Next.js `NextResponse`: Standard `Response.json()` used (confirmed in all existing route files)

---

## Open Questions

1. **Last-updated route placement**
   - What we know: `/api/fpl/[...proxy]` catch-all exists; static segments take precedence in Next.js routing
   - What's unclear: Whether the team has a preference for keeping all FPL-adjacent routes under `/api/fpl/`
   - Recommendation: Use `/api/last-updated/route.ts` — simpler, zero routing ambiguity

2. **Price trend in Squad & Transfers tab**
   - What we know: CONTEXT.md says price trend should appear in Squad & Transfers, but `SquadView` and `TransferPanel` display player data via `SquadPick` + `ScoredPlayer`
   - What's unclear: Whether to add the trend column to the squad display table or to the transfer suggestions panel
   - Recommendation: Add to transfer suggestions panel (candidates and replacements) — most actionable location for the user

3. **Club Form: upcoming fixtures for clubs with 0 remaining fixtures**
   - What we know: 71 unplayed fixtures remain (380 total - 309 finished); the season may be near completion
   - What's unclear: Whether any teams have 0 upcoming fixtures at time of execution
   - Recommendation: Handle gracefully — empty `upcoming_fixtures: []` renders as empty badges cell, no crash

---

## Environment Availability

Step 2.6: Environment audit — this phase is primarily code/config changes. All dependencies are already installed. No new external services, CLIs, or runtimes are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| Node.js / npm | Next.js, vitest | ✓ | project running | — |
| Python 3 | merge.py modification | ✓ | 3.11 (confirmed by earlier run) | — |
| `pipeline/cache/fpl_fixtures.json` | `/api/club-form` | ✓ | 309 finished fixtures | 404 response |
| `pipeline/cache/fpl_bootstrap.json` | `/api/club-form`, merge.py | ✓ | confirmed present | — |
| `pipeline/cache/last_updated.json` | `/api/last-updated` | ✓ | confirmed present with correct shape | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest `^4.1.2` |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FFA-03 | `computeClubForm()` returns correct W/D/L/GS/GC for 5-game window | unit | `npx vitest run tests/lib/club-form.test.ts` | ❌ Wave 0 |
| FFA-03 | DGW team gets 5 fixture entries not 5 GW entries | unit | `npx vitest run tests/lib/club-form.test.ts` | ❌ Wave 0 |
| VAL-03 | `cost_change_event` / `cost_change_start` present in merged player output | unit | `npx vitest run tests/lib/` | ❌ Wave 0 (extend gem-score test factory) |
| VAL-01/02 | Value Gems filter logic: cheap threshold and low-owned threshold correct | unit | `npx vitest run tests/lib/value-gems.test.ts` | ❌ Wave 0 |
| UIX-03 | `<FixtureBadges>` renders correct colour class for each tier | manual | visual inspection | — |
| DAT-02 | `useLastUpdated` hook fetches from correct endpoint | manual | browser DevTools | — |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/club-form.test.ts` — covers FFA-03 (pure function unit tests)
- [ ] `tests/lib/value-gems.test.ts` — covers VAL-01/02 filter logic (if extracted to pure function)
- [ ] Update `tests/lib/gem-score.test.ts` `makeMergedPlayer` factory to include `cost_change_event: 0, cost_change_start: 0` — required when `MergedPlayer` gains these fields

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection — `src/lib/types.ts`, `pipeline/merge.py`, `src/components/gem-table/GemTable.tsx`, `src/components/defcon/DefConTables.tsx`, `src/app/page.tsx`, all API route files
- `pipeline/cache/fpl_fixtures.json` — confirmed shape: `team_h`, `team_a`, `team_h_score`, `team_a_score`, `event`, `finished`, `stats[].identifier` including `goals_scored`
- `pipeline/cache/fpl_bootstrap.json` — confirmed `cost_change_event`, `cost_change_start`, `cost_change_event_fall`, `cost_change_start_fall` present on all elements
- `pipeline/cache/last_updated.json` — confirmed shape with `last_updated` ISO string and `stale: boolean`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API (this version of Next.js)
- `package.json` — confirmed all dependency versions

### Secondary (MEDIUM confidence)

- Next.js 16 routing precedence (static over catch-all) — confirmed by local docs structure; no explicit test run

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from `package.json`; no new packages needed
- Architecture: HIGH — all patterns derived directly from existing codebase files
- Pitfalls: HIGH — derived from concrete code inspection (test factory, fixture data shape, existing route structure)
- Data availability: HIGH — all cache files confirmed present and inspected

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable stack; FPL fixture data changes with each pipeline run)
