# Phase 5: Squad View + Transfer Suggestions - Research

**Researched:** 2026-03-28
**Domain:** FPL squad fetch (public API), transfer engine algorithm, chip detection, position-locked suggestions ranked by Gem delta
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIS-01 | Enter FPL Team ID to pull current squad (public API, no login needed) | `/api/entry/{id}/event/{gw}/picks/` is public; current GW from bootstrap events array |
| TIS-02 | Optional FPL login (email/password) to fetch bank balance and remaining transfers | Designed for in Phase 5 UI; full session-cookie auth is v1.x — Phase 5 labels budget approximate when unauthenticated |
| TIS-03 | Display squad split by position (GK/DEF/MID/FWD) with price, ownership %, minutes played, injury flag | `picks[].element` cross-referenced with bootstrap `elements[]`; `element_type` integer drives split |
| TRF-01 | Suggest who to sell/sub out based on recent performance and upcoming fixtures | transfer-engine.ts iterates squad, ranks by lowest gem_score as sell candidates |
| TRF-02 | For each sell candidate: up to 3 replacement options ranked by Gem rating | transfer-engine.ts filters allPlayers by same element_type + affordable + not in squad, top 3 by gem_score delta |
| TRF-03 | Enforce position rules (MID → MID, FWD → FWD, etc.) | Compare `element_type` integers — never string labels |
| TRF-04 | Factor in bank balance + sale value: only suggest affordable transfers | Unauthenticated: available_budget = now_cost (approx). Labels all prices "approx" |
| TRF-05 | Suggest multi-transfer combinations if user has available free transfers | if free_transfers >= 2, compute ranked 2-player swap pairs |
| TRF-06 | If no strong transfers available, recommend saving the transfer | if all gem_delta <= 0, return SAVE recommendation instead of suggestions |
| TRF-07 | Show how many free transfers the user has (from login or user input fallback) | Unauthenticated: user inputs free transfer count (default 1); entry_history.event_transfers present but needs GW context |
</phase_requirements>

---

## Summary

Phase 5 adds the personalised layer: the manager enters their FPL Team ID, the app fetches their current squad via the public picks endpoint, and a client-side transfer engine recommends which player to sell and who to buy — ranked by Gem score improvement delta. This phase depends entirely on Phase 3 being complete (ScoredPlayer/gem_score available) and builds on the existing FPL proxy Route Handler established in Phase 1.

The public squad fetch requires knowing the current gameweek number — this is already available from the `bootstrap-static` events array (`is_current: true`). The transfer engine runs client-side in TypeScript as a pure function (`transfer-engine.ts`), consuming the already-fetched `ScoredPlayer[]` from `usePlayers` plus the squad picks. No new pipeline work is needed for Phase 5.

The two major complexity points are: (1) chip detection — when `active_chip == "freehit"` or `"wildcard"` is detected, the panel shows a warning instead of suggestions; and (2) the "save the transfer" recommendation when no gem_delta is positive. Budget enforcement in unauthenticated mode uses `now_cost / 10` labelled as approximate, since the exact sell price requires authentication.

**Primary recommendation:** Build transfer-engine.ts as a pure function `(squad: SquadPick[], allPlayers: ScoredPlayer[], budget: number, freeTransfers: number) => TransferResult`. Wrap it in a `useTransferSuggestions` hook. Keep all chip-state guards at the top of the function before any suggestion logic runs.

---

## Standard Stack

All libraries are already installed. No new npm packages required for Phase 5.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | Route Handler for squad proxy endpoint | Existing pattern from Phase 1 proxy |
| TanStack Query v5 | ^5.95.2 | `useSquad` hook — same pattern as `usePlayers` | Established in Phase 2, used by all data hooks |
| TanStack Table v8 | ^8.21.3 | SquadView position-split tables | Existing pattern from GemTable and DefConTables |
| Zod v4 | ^4.3.6 | Validate picks endpoint response shape | Established adapter pattern from Phase 1 |
| TypeScript 5 | ^5 | transfer-engine.ts pure function + types | All lib code is TypeScript |
| Tailwind CSS v4 | ^4 | TransferPanel and SquadView styling | Project-wide styling |

### No New Dependencies Needed

The full capability required for Phase 5 (data fetching, tables, type safety, styling) is already present. Do NOT add new packages.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
src/
├── app/
│   └── api/
│       └── squad/
│           └── [teamId]/
│               └── route.ts          # NEW: proxies entry/{id}/event/{gw}/picks/
├── lib/
│   ├── transfer-engine.ts            # NEW: pure function, position lock, gem delta
│   ├── squad-adapter.ts              # NEW: Zod schema for picks endpoint response
│   └── types.ts                      # EXTEND: SquadPick, TransferSuggestion types
├── components/
│   ├── squad/
│   │   └── SquadView.tsx             # NEW: position-split squad display
│   └── transfers/
│       └── TransferPanel.tsx         # NEW: team ID input + suggestions display
└── lib/
    └── hooks/
        └── useSquad.ts               # NEW: TanStack Query hook for squad fetch
```

The new tab "Squad & Transfers" is added to `page.tsx` alongside the existing "Gem Ratings" and "DefCon Analysis" tabs.

### Pattern 1: Squad Fetch Route Handler

**What:** A Next.js Route Handler at `/api/squad/[teamId]` fetches the current gameweek picks from FPL via the existing proxy infrastructure.

**When to use:** User submits a Team ID — the browser calls this Route Handler, which calls FPL server-side (no CORS).

**How to get current gameweek:** Bootstrap events array has `is_current: true` on the active GW. The route handler must fetch bootstrap first (or read from cache) to resolve the GW number before calling picks.

**Critical:** The picks endpoint is `entry/{id}/event/{gw}/picks/` — you must know `gw`. Use the `is_next: true` gameweek if `is_current` is between gameweeks.

```typescript
// src/app/api/squad/[teamId]/route.ts
import type { NextRequest } from 'next/server'

const FPL_BASE = 'https://fantasy.premierleague.com/api'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params

  // Step 1: resolve current GW from bootstrap events
  const bootstrapRes = await fetch(`${FPL_BASE}/bootstrap-static/`, {
    headers: { 'User-Agent': 'fplx/1.0' },
    next: { revalidate: 3600 },
  })
  const bootstrap = await bootstrapRes.json()
  const currentEvent = bootstrap.events.find(
    (e: { is_current: boolean; is_next: boolean }) => e.is_current || e.is_next
  )
  if (!currentEvent) {
    return Response.json({ error: 'No active gameweek found' }, { status: 404 })
  }

  // Step 2: fetch picks for current GW
  const picksRes = await fetch(
    `${FPL_BASE}/entry/${teamId}/event/${currentEvent.id}/picks/`,
    { headers: { 'User-Agent': 'fplx/1.0' }, next: { revalidate: 0 } }
  )
  if (!picksRes.ok) {
    return Response.json({ error: 'Team not found or picks unavailable', status: picksRes.status }, { status: picksRes.status })
  }
  const data = await picksRes.json()
  return Response.json(data)
}
```

### Pattern 2: Squad Adapter (Zod)

**What:** Zod schema validates the picks endpoint response shape at the Route Handler boundary.

**Picks endpoint response fields (MEDIUM confidence — community-sourced):**
```
{
  active_chip: string | null,         // "freehit", "wildcard", "bboost", "3xc", or null
  automatic_subs: [...],
  entry_history: {
    event: number,                    // gameweek number
    bank: number,                     // bank balance in tenths of £1m (e.g. 15 = £1.5m)
    event_transfers: number,          // transfers made this GW
    event_transfers_cost: number,     // cost in points (4 per extra transfer)
    value: number,                    // total team value in tenths of £1m
  },
  picks: [
    {
      element: number,                // FPL player ID — cross-reference bootstrap elements[]
      position: number,               // 1-11 = starting XI, 12-15 = bench
      multiplier: number,             // 0=bench, 1=regular, 2=captain, 3=triple captain
      is_captain: boolean,
      is_vice_captain: boolean,
      // NOTE: selling_price and purchase_price are NOT present on the public picks endpoint
      // They only appear on the authenticated /api/my-team/{id}/ endpoint
    }
  ]
}
```

**Important:** `selling_price` is NOT available in the public picks endpoint. This confirms the design decision to label budget as approximate when unauthenticated — use `now_cost` from bootstrap as the proxy for sell value.

```typescript
// src/lib/squad-adapter.ts
import { z } from 'zod'

export const SquadPickSchema = z.object({
  element: z.number().int(),
  position: z.number().int(),
  multiplier: z.number().int(),
  is_captain: z.boolean(),
  is_vice_captain: z.boolean(),
})

export const EntryHistorySchema = z.object({
  event: z.number().int(),
  bank: z.number(),                    // tenths of £1m
  event_transfers: z.number().int(),
  event_transfers_cost: z.number().int(),
  value: z.number(),                   // tenths of £1m
})

export const SquadPicksResponseSchema = z.object({
  active_chip: z.string().nullable(),
  picks: z.array(SquadPickSchema),
  entry_history: EntryHistorySchema,
})

export type SquadPicksResponse = z.infer<typeof SquadPicksResponseSchema>
export type SquadPick = z.infer<typeof SquadPickSchema>
```

### Pattern 3: Transfer Engine (Pure Function)

**What:** `transfer-engine.ts` is a pure TypeScript function. It takes the user's squad + all scored players + approximate budget and returns ranked transfer suggestions (or a SAVE recommendation).

**When to use:** Called inside `TransferPanel` after both `usePlayers` and `useSquad` have resolved.

**Algorithm:**

```
computeTransferSuggestions(squad, allPlayers, budget, freeTransfers):

  0. Guard: if active_chip is "freehit" or "wildcard" → return CHIP_WARNING result

  1. Build squadMap: element_id → ScoredPlayer (for fast lookup)

  2. For each starting XI player (position 1-11):
     - Find candidates: allPlayers where:
       a. element_type === player.element_type  (POSITION LOCK)
       b. id not in squad (avoid duplicates)
       c. now_cost/10 <= budget + player.now_cost/10  (affordable — approx)
     - Sort candidates by gem_score desc
     - Take top 3 candidates
     - gem_delta = candidate.gem_score - player.gem_score
     - Record SingleTransfer{ sell: player, buy: candidate, gem_delta, approx_cost }

  3. Sort all SingleTransfer suggestions by gem_delta desc

  4. If no suggestion has gem_delta > 0:
     return { type: 'SAVE', message: 'No transfer improves your squad — save your transfer' }

  5. If freeTransfers >= 2:
     Compute top 2-transfer combo: top suggestion + next best suggestion for different position
     Return suggestions ordered: best single, best 2-combo (if applicable)

  6. Return top suggestions (capped at freeTransfers * 3 suggestions)
```

**Budget calculation (unauthenticated):**
```
available_budget = entry_history.bank / 10  (£Xm in bank)
sell_approx = player.now_cost / 10          (current price, NOT actual sell price)
max_spend = available_budget + sell_approx  (label as "approx")
```

### Pattern 4: useSquad Hook

**What:** TanStack Query hook, same pattern as `usePlayers`.

```typescript
// src/lib/hooks/useSquad.ts
import { useQuery } from '@tanstack/react-query'
import type { SquadPicksResponse } from '@/lib/squad-adapter'

async function fetchSquad(teamId: string): Promise<SquadPicksResponse> {
  const res = await fetch(`/api/squad/${teamId}`)
  if (!res.ok) throw new Error(`Squad fetch failed: ${res.status}`)
  return res.json()
}

export function useSquad(teamId: string | null) {
  return useQuery<SquadPicksResponse>({
    queryKey: ['squad', teamId],
    queryFn: () => fetchSquad(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5,   // 5 minutes — squad can change
    retry: 1,
  })
}
```

### Pattern 5: SquadView Component

**What:** Displays 15 players split into 4 position groups. Each player row shows: name, team, price (labelled "approx"), ownership %, minutes, injury badge.

**Structure:**
```typescript
// Position groups: filter squad by element_type from bootstrap cross-reference
const byPosition = {
  GK:  squadPlayers.filter(p => p.element_type === 1),  // 2 players
  DEF: squadPlayers.filter(p => p.element_type === 2),  // 5 players
  MID: squadPlayers.filter(p => p.element_type === 3),  // 5 players
  FWD: squadPlayers.filter(p => p.element_type === 4),  // 3 players
}
// Each group renders as a sub-table within the SquadView card
```

**Injury flag:** Use `status !== 'a'` from `FPLElement`. Status codes: `'d'`=doubtful, `'i'`=injured, `'s'`=suspended, `'u'`=unavailable. Display the `news` field as tooltip or badge text.

### Anti-Patterns to Avoid

- **Comparing position by string label:** Never `player.position === 'MID'` — always compare `element_type` integers (1/2/3/4).
- **Using `now_cost` as sell price without label:** Always mark prices "approx" when unauthenticated. Document this in the UI.
- **Running transfer engine on bench players:** The starting XI is positions 1-11. Bench (positions 12-15) should be displayed but excluded from sell-candidate analysis.
- **Forcing a suggestion when gem_delta <= 0:** Return SAVE recommendation explicitly. Do not surface a negative-delta suggestion.
- **Fetching bootstrap inside Route Handler on every squad request:** The bootstrap fetch should use `next: { revalidate: 3600 }` to cache at the CDN layer. Otherwise each Team ID lookup fetches bootstrap fresh.
- **Chip state detection after suggestion logic:** Guard for `active_chip` at the very start of `computeTransferSuggestions`. Never compute suggestions when a chip is active.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side data caching and loading states | Manual useState+useEffect fetch pattern | TanStack Query `useQuery` | Handles stale, loading, error, background refresh; established in existing hooks |
| Position-split table layout | Custom CSS grid/flex layout from scratch | TanStack Table v8 (same pattern as GemTable/DefConTables) | Already implemented and tested; column definitions follow existing pattern |
| Zod schema for picks response | Manual field validation | `SquadPicksResponseSchema` with z.object() | Adapter pattern established in Phase 1 — all FPL responses go through Zod |
| Budget arithmetic | Float arithmetic on now_cost | Divide `now_cost` by 10; divide `bank` by 10 | FPL stores all prices as tenths of £1m integers. Arithmetic on raw integers avoids float imprecision. |

**Key insight:** Phase 5 assembles existing primitives. The gems data (`usePlayers` → `ScoredPlayer[]`), the FPL proxy Route Handler, the Zod adapter pattern, and TanStack Table are all already built. The new work is: squad Route Handler + Zod schema, transfer engine algorithm, and two new UI components.

---

## Common Pitfalls

### Pitfall 1: Current Gameweek Resolution Edge Cases

**What goes wrong:** The picks endpoint URL requires an explicit GW number. During pre-season (before GW1 kicks off) or between seasons, `is_current` may be `false` for all events. Picking the wrong GW returns an empty or error response.

**Why it happens:** Developers assume `is_current: true` always exists. At season boundaries, all events may have `finished: false` and `is_current: false`.

**How to avoid:**
1. Check `is_current: true` first.
2. Fall back to `is_next: true` if no current GW found.
3. If neither exists, return a graceful error: "No active gameweek — try again when the season is underway".

**Warning signs:** Route Handler returns 404 or empty picks despite valid Team ID.

### Pitfall 2: Sell Price Is Now_Cost, Not Actual Sell Value

**What goes wrong:** Budget arithmetic using `now_cost` as the player's sell value overestimates the available budget. Real sell price = purchase_price + floor((price_rise / 2)). Without authentication, the actual sell price is unknown.

**Why it happens:** The public picks endpoint does NOT include `selling_price`. Only the authenticated `/api/my-team/{id}/` endpoint returns the real sell price.

**How to avoid:** Label ALL budget figures as "approx" in the UI when unauthenticated. Document in the TransferPanel: "Prices shown are approximate (based on current market price, not your actual sell price)." Never display a budget figure without the "approx" label.

**Warning signs:** Suggestions show as "affordable" but FPL rejects them as over budget.

### Pitfall 3: Free Hit Squad Is Temporary

**What goes wrong:** When `active_chip == "freehit"`, the picks endpoint returns the Free Hit squad — a temporary lineup that reverts after the GW ends. Computing transfer suggestions on this squad is meaningless because these players will leave.

**Why it happens:** The picks endpoint always returns the current squad, whether permanent or chip-temporary.

**How to avoid:** At the top of `computeTransferSuggestions`, check `active_chip`. If `"freehit"`: return `{ type: 'CHIP_WARNING', chip: 'freehit' }` immediately. The UI renders: "Free Hit chip active — this squad is temporary. Transfer suggestions are not shown." Same pattern for `"wildcard"`.

### Pitfall 4: Position Lock Uses Integer Codes, Not Strings

**What goes wrong:** A MID is suggested as replacement for a DEF. This fails FPL's position rule silently in the engine and produces invalid suggestions.

**Why it happens:** Developer uses position label strings ("MID") instead of `element_type` integer codes. Labels are display only.

**How to avoid:** The transfer engine exclusively compares `element_type` integers. Never compare position labels. Test this explicitly: run the engine on a DEF sell candidate and assert that no MID, FWD, or GK appears in replacement candidates.

### Pitfall 5: Duplicate Players in Suggestions

**What goes wrong:** A replacement suggestion includes a player already in the squad — squad member recommended to buy themselves.

**Why it happens:** The engine filters `allPlayers` but forgets to exclude current squad members.

**How to avoid:** Build a `Set<number>` of all squad element IDs before filtering. Filter: `!squadIds.has(candidate.id)`.

### Pitfall 6: Multi-Transfer Combo Recommends Same Player Twice

**What goes wrong:** When computing 2-transfer combinations, the best swap for position A and the best swap for position B might involve the same buy target.

**Why it happens:** The engine independently picks the top replacement for two different sell candidates without checking for overlap.

**How to avoid:** When building 2-transfer combos, after selecting the first buy candidate, exclude that player's ID from the candidate pool for the second swap.

### Pitfall 7: `entry_history.bank` Requires Division by 10

**What goes wrong:** Budget displayed as £150m instead of £1.5m because `bank` is stored as an integer in tenths of £1m (e.g. `15` = £1.5m).

**Why it happens:** Same convention as `now_cost` — all FPL money values are tenths of £1m.

**How to avoid:** Always divide `bank` by 10 before display or arithmetic. Same for `now_cost`, `value`, and any price field from the FPL API.

---

## Code Examples

### Transfer Engine Signature

```typescript
// src/lib/transfer-engine.ts

export type ChipState = 'freehit' | 'wildcard' | 'bboost' | '3xc' | null

export interface SingleTransfer {
  sell: ScoredPlayer
  buy: ScoredPlayer
  gem_delta: number           // buy.gem_score - sell.gem_score
  approx_cost: number         // buy.now_cost/10 - sell.now_cost/10 (positive = costs more)
  available_budget: number    // bank/10 + sell.now_cost/10 (approx)
  budget_sufficient: boolean  // buy.now_cost/10 <= available_budget
}

export interface TransferResult {
  type: 'SUGGESTIONS' | 'SAVE' | 'CHIP_WARNING'
  chip?: ChipState             // populated when type === 'CHIP_WARNING'
  suggestions?: SingleTransfer[]
  two_transfer_combo?: [SingleTransfer, SingleTransfer]  // if freeTransfers >= 2
  message?: string
}

export function computeTransferSuggestions(
  picks: SquadPick[],           // from picks endpoint
  allPlayers: ScoredPlayer[],   // from usePlayers()
  bankBalance: number,          // entry_history.bank (raw tenths)
  freeTransfers: number,        // user input or entry_history-derived
  activeChip: ChipState,
): TransferResult
```

### TIS-03: Squad Display Fields

Displayed for each squad player (cross-reference `picks[].element` with `allPlayers` by `id`):

```typescript
interface SquadPlayerDisplay {
  web_name: string
  team_short_name: string
  now_cost: number          // display as (now_cost / 10).toFixed(1) + "m (approx)"
  selected_by_percent: string  // display as selected_by_percent + "%"
  minutes: number           // season total minutes
  status: PlayerStatus      // badge: red for 'i'/'s'/'u', amber for 'd', green for 'a'
  news: string              // tooltip text on status badge
  gem_score: number         // show as context — helps user understand sell decisions
}
```

### Chip Warning Render Logic

```typescript
// In TransferPanel component
if (squadData.active_chip === 'freehit') {
  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <strong>Free Hit active</strong> — your squad is temporary this gameweek.
      Transfer suggestions are paused.
    </div>
  )
}
if (squadData.active_chip === 'wildcard') {
  return (
    <div className="rounded border border-blue-300 bg-blue-50 p-4 text-blue-900">
      <strong>Wildcard active</strong> — unlimited transfers available.
      Suggestions show best overall squad improvements.
    </div>
  )
}
```

### Save-the-Transfer Recommendation

```typescript
// In computeTransferSuggestions — final guard before returning suggestions
const positiveSuggestions = suggestions.filter(s => s.gem_delta > 0)
if (positiveSuggestions.length === 0) {
  return {
    type: 'SAVE',
    message: 'No transfer improves your squad Gem rating. Save your transfer and bank it for next week.',
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Query v4 | TanStack Query v5 | 2023 | New API (data/error destructuring stable); project already uses v5 |
| Custom FDR only | Custom FDR (rolling xGA) | Established in Phase 2 | Transfer engine uses gem_score which already embeds custom FDR |
| No DefCon dimension in gem | DefCon likelihood deferred | Phase 3 decision | gem_score currently uses 7 dimensions; DefCon likelihood dimension not yet integrated. Transfer delta is based on current gem_score — this is correct for Phase 5 |

**Not yet available:**
- DefCon likelihood dimension in gem_score: deferred from Phase 3. Transfer suggestions are based on the 6-dimension gem_score currently implemented. This is intentional — do not wait for this dimension.
- Authenticated sell price (`selling_price` from `/api/my-team/{id}/`): v1.x enhancement. Phase 5 uses `now_cost` labelled as approximate.

---

## Open Questions

1. **Current GW resolution when season hasn't started**
   - What we know: `is_current` and `is_next` on events array
   - What's unclear: Edge behaviour before GW1 deadline
   - Recommendation: Handle with explicit 404 message "No active gameweek" — do not block Phase 5 on this edge case

2. **FPL API: does picks endpoint return `is_captain`/`is_vice_captain` as booleans or must they be inferred from multiplier?**
   - What we know: Community sources confirm `is_captain` boolean exists
   - What's unclear: Whether both fields or just multiplier is reliable
   - Recommendation: Parse both; use `is_captain` for display but fall back to `multiplier === 2` check

3. **Transfer count when Free Hit has been used earlier in the season**
   - What we know: `entry_history.event_transfers` is the count for THIS GW
   - What's unclear: Free transfer accumulation rules vs. what `event_transfers` shows
   - Recommendation: For unauthenticated mode, show a user input field for free transfer count (default 1). This sidesteps the API ambiguity entirely for v1.

---

## Environment Availability

All tools already available — no new dependencies required. Step 2.6: SKIPPED (no new external dependencies; existing Route Handler, TanStack Query, TanStack Table, Zod, Tailwind all confirmed operational from Phases 1-4).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root, `test.exclude` already set) |
| Quick run command | `npx vitest run tests/lib/transfer-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRF-01 | Sell candidates are lowest gem_score starting XI players | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ Wave 0 |
| TRF-02 | Top 3 replacements per sell candidate sorted by gem_score | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ Wave 0 |
| TRF-03 | Position lock: no cross-position suggestions | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ Wave 0 |
| TRF-04 | Budget enforcement: suggestions with approx_cost > available_budget marked budget_sufficient=false | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ Wave 0 |
| TRF-05 | 2-transfer combo returned when freeTransfers >= 2; combo uses distinct buy targets | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ Wave 0 |
| TRF-06 | Returns type:'SAVE' when all gem_delta <= 0 | unit | `npx vitest run tests/lib/transfer-engine.test.ts` | ❌ Wave 0 |
| TIS-01 | Squad Route Handler returns picks + entry_history for valid Team ID | smoke | manual browser test (Route Handler) | ❌ Wave 0 infra |
| TIS-03 | SquadView renders all 4 position groups | smoke | visual verification | manual-only |

**Why TIS-01 is smoke/manual:** Route Handlers require a running Next.js server or msw mock setup. The project does not currently mock fetch in tests. Testing the pure transfer engine in isolation (TRF-01 through TRF-07) is the primary automated validation surface.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/transfer-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/transfer-engine.test.ts` — covers TRF-01 through TRF-06 (unit tests for pure function)
- [ ] `src/lib/transfer-engine.ts` — pure function (no test without this)
- [ ] `src/lib/squad-adapter.ts` — Zod schema for picks endpoint

*(Existing `tests/lib/gem-score.test.ts` pattern is the reference for how to structure `transfer-engine.test.ts`.)*

---

## Sources

### Primary (HIGH confidence)
- Existing codebase (`src/lib/types.ts`, `src/lib/gem-score.ts`, `src/lib/hooks/usePlayers.ts`, `src/app/api/fpl/[...proxy]/route.ts`) — confirmed patterns for proxy, hooks, Zod adapter, TanStack Query
- `.planning/research/PITFALLS.md` — Pitfall 3 (sell price), Pitfall 9 (Free Hit), Pitfall 10 (Wildcard), Pitfall 11 (position integer codes) all directly relevant to Phase 5
- `.planning/research/STACK.md` — FPL API endpoints table: `/api/entry/{team_id}/`, `/api/entry/{team_id}/event/{gw}/picks/`
- `.planning/research/ARCHITECTURE.md` — Transfer Suggestion Flow diagram; `transfer-engine.ts` architecture already planned

### Secondary (MEDIUM confidence)
- PITFALLS.md citing [FPL API Authentication Guide — Medium](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) — session cookie flow, `my-team` vs `picks` endpoint distinction
- [Fantasy Premier League API Endpoints — Frenzel Timothy, Medium](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) — picks endpoint structure, multiplier field meaning
- [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — picks endpoint field overview

### Tertiary (LOW confidence — validate against live API before coding)
- `entry_history.bank` field name and tenths-of-£1m encoding — consistent with how `now_cost` works throughout the API; community-confirmed but not official documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json; no new installs
- Transfer engine algorithm: HIGH — pure function, well-defined inputs from existing types
- FPL picks endpoint fields: MEDIUM — community-documented; `active_chip`, `picks[]`, `entry_history.bank` widely reported
- `selling_price` absence from public endpoint: HIGH — confirmed design decision in PITFALLS.md Pitfall 3
- Chip detection logic: HIGH — `active_chip` field confirmed in PITFALLS.md Pitfalls 9 and 10

**Research date:** 2026-03-28
**Valid until:** 2026-06-01 (stable; FPL API only changes significantly at season start)

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md. AGENTS.md states:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Implications for Phase 5:**
- Before writing Route Handler code, read `node_modules/next/dist/docs/` for current Route Handler conventions (params are now `Promise<{...}>` — already established in Phase 1 proxy: `{ params }: { params: Promise<{ proxy: string[] }> }`)
- The Phase 1 proxy Route Handler already demonstrates the current pattern: `const { proxy } = await params` (params is awaited as a Promise). Follow this exact pattern in the new squad Route Handler.
- Do not assume Next.js 16 Route Handler param access matches any prior knowledge — use the Phase 1 implementation as the canonical reference.
