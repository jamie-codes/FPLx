# Design: LIVE-01 — Live GW Score Engine

**Date:** 2026-05-31  
**Status:** Approved  
**Feature:** LIVE-01 — Live GW Score Engine

---

## Context

The official FPL app doesn't update scores until the morning after matches finish. Managers can't see their live score (including provisional bonus), which bench players have been auto-subbed in, whether their vice-captain picked up the ×2 multiplier, or their live rank. This feature fills that gap with a dedicated "Live" sub-tab in the Squad section.

---

## Scope

**In scope:**
- `computeLiveScore()` pure function
- `useLiveGw()` polling hook
- `LiveGwTab` component
- 5th sub-tab wired into Squad section + MobileNav

**Out of scope:**
- Live overall rank (FPL `entry_history.overall_rank` is the previous-run rank, not truly live — omitted to avoid misleading display)
- Head-to-head live score
- Any pipeline or API route changes — both required endpoints already proxied via `/api/fpl/[...proxy]`

---

## FPL API Endpoints Used

Both already proxied — no new route needed.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/fpl/event/{gw}/live/` | Live stats per player (goals, assists, bonus, CS, saves, minutes, total_points) |
| `GET /api/fpl/entry/{teamId}/event/{gw}/picks/` | User picks, `automatic_subs[]`, `active_chip`, `entry_history` |

The `picks/` endpoint is public — no authentication required beyond the team ID.

---

## Data Types (`src/lib/live-gw.ts`)

```typescript
interface LivePlayerStats {
  goals_scored: number
  assists: number
  bonus: number
  clean_sheets: number
  saves: number
  minutes: number
  total_points: number
  yellow_cards: number
  red_cards: number
}

interface LiveXIPlayer {
  element: number           // player id
  position: number          // 1–15 original pick position
  player_name: string       // web_name from bootstrap player map
  team_id: number
  is_captain: boolean       // original captain flag from picks
  is_vice_captain: boolean
  multiplier: number        // effective multiplier after VC promotion logic
  stats: LivePlayerStats
  live_points: number       // stats.total_points × multiplier
  is_subbed_out: boolean    // true when this player was replaced via autosub
  is_subbed_in: boolean     // true when this player came on via autosub
}

interface AutoSubEntry {
  player_out: string        // web_name of player replaced
  player_in: string         // web_name of player brought on
  minutes_played_by_out: number
}

interface LiveScore {
  total_points: number
  xi: LiveXIPlayer[]        // 11 starters (or 15 for BB), sorted by position
  bench: LiveXIPlayer[]     // remaining bench players
  auto_subs: AutoSubEntry[]
  effective_captain_id: number   // actual player with the multiplier (may be VC)
  vc_promoted: boolean           // true when VC received the multiplier
  chip: string | null            // 'bboost' | 'triplechip' | 'freehit' | null
  is_provisional: boolean        // always true — bonus changes until official processing
}
```

---

## Schema Extension: `automatic_subs`

`SquadPicksResponseSchema` in `squad-adapter.ts` was defined for squad management and does **not** include `automatic_subs`. The GW-specific picks endpoint (`entry/{id}/event/{gw}/picks/`) returns this field; the current-squad endpoint does not.

Rather than modifying `SquadPicksResponseSchema` (used throughout the app), `live-gw.ts` defines its own Zod schemas:

```typescript
// Defined in src/lib/live-gw.ts
const AutoSubRecordSchema = z.object({
  entry:       z.number().int(),   // team id
  element_in:  z.number().int(),   // player id coming on
  element_out: z.number().int(),   // player id going off
  event:       z.number().int(),   // GW number
})

const LivePicksResponseSchema = z.object({
  active_chip:    z.string().nullable(),
  picks:          z.array(SquadPickSchema),        // re-uses existing SquadPickSchema
  automatic_subs: z.array(AutoSubRecordSchema).default([]),
})

export type AutoSubRecord = z.infer<typeof AutoSubRecordSchema>
export type LivePicksResponse = z.infer<typeof LivePicksResponseSchema>
```

`SquadPickSchema` is imported from `squad-adapter.ts` — no duplication of pick field definitions.

---

## Pure Function: `computeLiveScore`

**Signature:**
```typescript
function computeLiveScore(
  picks: SquadPick[],                        // from LivePicksResponse.picks
  automaticSubs: AutoSubRecord[],            // from LivePicksResponse.automatic_subs
  activeChip: string | null,
  liveStatsMap: Map<number, LivePlayerStats>, // keyed by player id
  playerNameMap: Map<number, { web_name: string; team: number }>,
): LiveScore
```

**Algorithm:**

1. Build base XV — one `LiveXIPlayer` per pick, populating stats from `liveStatsMap` (all zeros if player id absent — handles BGW/pre-kick players)

2. **Captain / VC promotion:**
   - Find pick where `is_captain === true` → check `stats.minutes`
   - If captain `minutes === 0` AND VC pick exists → VC gets multiplier: `2` normally, `3` if `activeChip === 'triplechip'`
   - If VC also `minutes === 0` → multiplier = 1 for both (no doubling applied)
   - Record `effective_captain_id` and `vc_promoted` flag

3. **Bench Boost:** if `activeChip === 'bboost'` → `xi` = all 15, `bench` = [], `auto_subs` = [] (skip autosub step entirely)

4. **Autosubs** (standard chip or no chip):
   - For each entry in `automaticSubs`: mark `element_out` as `is_subbed_out`, mark `element_in` as `is_subbed_in`
   - `xi` = picks with `position <= 11` where not subbed-out, plus any subbed-in players
   - `bench` = remaining players
   - Build `AutoSubEntry` list from `automaticSubs`

5. **live_points:** `stats.total_points × multiplier` for each player in XI; bench players get `multiplier = 1` but are not counted in total

6. **Total:** sum of `live_points` across `xi` only

7. Return `LiveScore` with `is_provisional: true` always

**Edge cases:**
- `liveStatsMap` empty (pre-kick, BGW) → all stats zero, total = 0
- `automaticSubs` empty → no sub markers, xi = starting 11
- Captain and VC both played 0 min → no multiplier applied to either (multiplier = 1)
- DGW: live endpoint aggregates both fixtures — no special handling needed in client code

---

## Hook: `useLiveGw`

**File:** `src/hooks/useLiveGw.ts`

```typescript
function useLiveGw(
  teamId: number | null,
  currentGw: number | null,
  isLive: boolean,
): {
  liveStats: Map<number, LivePlayerStats> | null
  picksData: FplPicksResponse | null
  isLoading: boolean
  isError: boolean
}
```

- Uses TanStack Query `useQueries` to parallel-fetch both endpoints
- `enabled`: both queries skip when `!teamId || !currentGw`
- `refetchInterval: isLive ? 60_000 : false` — polling only during live fixtures
- `staleTime: 30_000` — avoids redundant re-fetches within a 30s window
- Returns parsed data or `null` when not yet loaded

**`isLive` derivation** (in `LiveGwTab`, from `useBootstrap`):
```typescript
const currentEvent = bootstrap?.events.find(e => e.is_current)
const isLive = currentEvent != null && currentEvent.finished === false
const currentGw = currentEvent?.id ?? null
```

---

## Component: `LiveGwTab`

**File:** `src/components/squad/LiveGwTab.tsx`

**Props:** `{ teamId: number | null }`

### Layout

```
┌─────────────────────────────────┐
│  GW38 • LIVE   [Bench Boost]    │
│  142 pts                        │
│  ⚠ Bonus points are provisional │
└─────────────────────────────────┘

Starting XI  (11)
────────────────────────────────
  Raya                      2 pts
    🛡 CS
  Alexander-Arnold  C×2    16 pts
    🅰 ×2 assists
  ...

Bench
────────────────────────────────
  Flekken (GK)         [↓ subbed off]
  ...

Auto-subs
────────────────────────────────
  Salah (0 min) → Jota (auto-sub)
```

### Header card
- GW number + `LIVE` pill (green) when `isLive`; `Final` pill (zinc) when `currentEvent.finished`
- Live total points (large, tabular-nums)
- Active chip badge if non-null (`bboost` → "Bench Boost", `triplechip` → "Triple Captain", etc.)
- Provisional disclaimer: always shown — `"⚠ Bonus points are provisional"`

### Player rows (Starting XI + Bench)
Each row:
- **Left:** `web_name` — normal weight
- **Right:** `live_points` — bold, tabular-nums
- **Second line (non-zero stats only):** compact icon + count pills
  - ⚽ goals, 🅰 assists, 🛡 CS, 🧤 saves (≥3 saves), 🟨 yellow card, 🟥 red card
- **Captain badge:** `C×2` / `C×3` on effective captain; `VC×2` / `VC×3` when VC was promoted (`vc_promoted === true`), with a note "(captain didn't play)"
- **Subbed-in:** small green `↑` prefix on player name
- **Bench subbed-out players:** muted row, `↓ subbed off` label right-aligned

### Auto-subs log
- Only rendered when `auto_subs.length > 0`
- Section header: "Auto-subs"
- Each entry: `"[player_out] ([N] min) → [player_in] (auto-sub)"`

### States

| State | Display |
|-------|---------|
| No team ID | "Load your squad to see your live score" (same prompt as other Squad tabs) |
| No current GW | "No active gameweek — check back on a matchday" |
| Loading | Skeleton rows (3 placeholder rows per section) |
| Error | "Couldn't load live data — will retry" (with retry button that calls `refetch()`) |
| GW finished + settled | Show final score with "Final" badge, provisional disclaimer removed |

---

## Navigation

`LiveGwTab` is wired as the **5th sub-tab** in the Squad section:

```
Decision | Optimiser | Lineup | Review | Live
```

Changes required in `page.tsx`:
- Add `'live'` to `SquadSubTab` union
- Add entry to `SECTIONS` Squad sub-tabs array with label `"Live"`
- Add `LiveGwTab` render conditional

`MobileNav` pill count increases to 5 for Squad — `MobileNav.test.tsx` updated accordingly.

---

## Tests

### `live-gw.test.ts` (pure function — `@vitest-environment node`)

| # | Case |
|---|------|
| 1 | Captain played → correct ×2 multiplier, total reflects doubled points |
| 2 | Captain 0 min, VC played → VC gets ×2, `vc_promoted = true` |
| 3 | Captain and VC both 0 min → multiplier = 1 for both, `vc_promoted = false` |
| 4 | TC chip + captain 0 min → VC gets ×3 |
| 5 | Bench Boost → all 15 in XI, no subs, total = sum of all 15 |
| 6 | Autosub applied → subbed-out player not counted, subbed-in player counted |
| 7 | Empty liveStatsMap → all stats zero, total = 0 (no crash) |
| 8 | `auto_subs` log correctly lists player_out name and minutes |

### `LiveGwTab.test.tsx` (RTL — `@vitest-environment jsdom`)

| # | Case |
|---|------|
| 1 | Renders "no team ID" empty state when `teamId = null` |
| 2 | Renders live total from fixture data |
| 3 | "LIVE" badge present when `isLive = true` |
| 4 | "Final" badge present when GW `finished = true` |
| 5 | VC promotion: "VC×2" label rendered, captain did not play note present |
| 6 | Auto-subs section rendered when `auto_subs` non-empty |
| 7 | Provisional bonus disclaimer always rendered |
| 8 | Loading state renders skeleton (no player names) |

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/live-gw.ts` | New: `computeLiveScore`, `LivePicksResponseSchema`, `AutoSubRecordSchema`, all live types |
| `src/lib/live-gw.test.ts` | New: 8 pure function tests |
| `src/hooks/useLiveGw.ts` | New: polling hook |
| `src/components/squad/LiveGwTab.tsx` | New: component + co-located RTL tests |
| `src/app/page.tsx` | Add `'live'` to SubTab union, SECTIONS entry, render conditional |
| `src/app/page.test.tsx` | Add `vi.mock` for `LiveGwTab`, Live sub-tab nav test |
| `src/components/nav/MobileNav.test.tsx` | Update expected Squad pill count to 5 |

---

## Non-Goals

- Live overall rank (omitted — `entry_history.overall_rank` is not live enough to be trustworthy)
- Head-to-head scoring
- Any backend / pipeline changes
- Pre-generating lineups before kick-off (data comes entirely from FPL live endpoint)
