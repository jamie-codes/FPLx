# Phase 72: Lineup Optimiser - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 6 (2 new lib files, 2 new component files, 2 modified app files)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/lineup-swap.ts` | utility (pure function) | transform | `src/lib/optimise-lineup.ts` | exact — same pure-TS pattern, same type imports, same position-code constants |
| `src/lib/lineup-swap.test.ts` | test | — | `src/lib/optimise-lineup.test.ts` | exact — same `makePlayer`/`makePick`/`makeSquad` factories, same `@vitest-environment node` header |
| `src/components/squad/LineupTab.tsx` | component | request-response | `src/components/optimiser/OptimiserPanel.tsx` | exact — identical data-fetch, memo, empty/loading/error/BGW guards |
| `src/components/squad/LineupTab.test.tsx` | test | — | `src/components/optimiser/OptimiserPanel.test.tsx` | exact — same mock structure, same `makePlayer`/`makeValidSquad` factories |
| `src/app/page.tsx` | config / router | — | `src/app/page.tsx` (self — additive only) | self-modification — 3 additive lines |
| `src/app/page.test.tsx` | test | — | `src/app/page.test.tsx` (self — additive only) | self-modification — extend existing squad nav tests |

---

## Pattern Assignments

### `src/lib/lineup-swap.ts` (utility, transform)

**Analog:** `src/lib/optimise-lineup.ts`

**File-level convention** (lines 1-6):
```typescript
// No 'use client' — pure function, no React, no side effects.
// Mirrors src/lib/optimise-lineup.ts convention: no 'use client', no React, no side effects.
import type { MergedPlayer, OptimisedLineup } from './types'
```

**Position-code constants** (optimise-lineup.ts lines 16-19 — copy verbatim):
```typescript
const GK  = 1
const DEF = 2
const MID = 3
const FWD = 4
```

**Formation validation predicate** (optimise-lineup.ts lines 91-97 — the exact constraint isLegalSwap must mirror):
```typescript
const valid = (
  gkCount === 1 &&
  defCount >= 3 && defCount <= 5 &&
  midCount >= 2 && midCount <= 5 &&
  fwdCount >= 1 && fwdCount <= 3 &&
  (defCount + midCount + fwdCount) === 10
)
```

**captainKey fallback chain** (optimise-lineup.ts lines 57-58 — copy exactly):
```typescript
const captainKey = (p: MergedPlayer): number =>
  p.xPts_90th_1gw ?? p.xPts_1gw ?? 0
```

**Captain sort** (optimise-lineup.ts lines 117-123 — pattern for applySwap captain recomputation):
```typescript
const sortedStartersByCaptainKey = [...bestStarterIds].sort((a, b) => {
  const pa = playerMap.get(a)!
  const pb = playerMap.get(b)!
  return captainKey(pb) - captainKey(pa)
})
const captainId = sortedStartersByCaptainKey[0]
const vcId      = sortedStartersByCaptainKey[1]
```

**Formation string derivation** (optimise-lineup.ts line 146 — pattern for applySwap formation recomputation):
```typescript
const formation = `${bestCounts.def}-${bestCounts.mid}-${bestCounts.fwd}`
```

**Export shape:** Both `isLegalSwap` and `applySwap` are named exports. No default export (matches optimise-lineup.ts pattern — `export function optimiseLineup`, `export function benchOrder`).

**Full function signatures to implement:**
```typescript
export function isLegalSwap(
  lineup: OptimisedLineup,
  starterId: number,
  benchId: number,
  playerMap: Map<number, MergedPlayer>,
): boolean

export function applySwap(
  lineup: OptimisedLineup,
  starterId: number,
  benchId: number,
  playerMap: Map<number, MergedPlayer>,
): OptimisedLineup
```

**Critical rules in isLegalSwap (from RESEARCH.md Pitfall 4 + 5):**
1. GK starter ↔ GK bench only (if either player is GK, both must be GK)
2. Same-position outfield swap is always legal (no formation change)
3. Cross-position outfield swap: simulate new starters, re-validate full formation predicate (DEF 3-5, MID 2-5, FWD 1-3)

**Critical rules in applySwap (from RESEARCH.md Pitfall 2 + 3):**
1. After swap, recompute captainId/vcId by sorting new starters by captainKey
2. After swap, recompute formation string from new starters' element_types

---

### `src/lib/lineup-swap.test.ts` (test, pure function)

**Analog:** `src/lib/optimise-lineup.test.ts`

**File header** (optimise-lineup.test.ts lines 1-8):
```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isLegalSwap, applySwap } from './lineup-swap'
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'
```

**makePick factory** (optimise-lineup.test.ts lines 9-11 — copy verbatim):
```typescript
function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}
```

**makePlayer factory** (optimise-lineup.test.ts lines 13-59 — copy verbatim, including ALL fields):
```typescript
type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(overrides: PlayerOverrides): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    team: 1,
    team_short_name: 'T1',
    now_cost: 50,
    selected_by_percent: '5.0',
    form: '0.0',
    status: 'a',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 2,
    assists: 1,
    expected_goals: 1.5,
    expected_assists: 1.0,
    pts_last3gw: 12,
    pts_last5gw: 20,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 80,
    form_pts_per90: 5.0,
    fixtures: [],
    xmins: 80,
    start_prob: 0.9,
    mins_risk: 'nailed',
    xPts_1gw: 5.0,
    xPts_3gw: 14.0,
    xPts_5gw: 22.0,
    xPts_90th_1gw: 7.0,
    ...overrides,
  } as MergedPlayer
}
```

**Test structure:** Use `describe` blocks per requirement ID (mirroring RESEARCH.md Validation Architecture test map). Required test cases per RESEARCH.md:
- `isLegalSwap`: GK-only swap, same-position swap legal, legal cross-position swap, illegal cross-position (each formation boundary), GK bench cannot swap with outfield
- `applySwap`: starters/bench arrays swap correctly, captain recomputes (Pitfall 2), formation string updates (Pitfall 3)

**How to build a fixture lineup for tests:** Build a `Map<number, MergedPlayer>` and a minimal `OptimisedLineup` literal inline — no need for makeSquad (these are unit tests of the swap helpers, not the full solver):
```typescript
// Minimal lineup fixture pattern for unit tests:
const playerMap = new Map<number, MergedPlayer>([
  [1, makePlayer({ id: 1, element_type: 1 })],   // GK starter
  [2, makePlayer({ id: 2, element_type: 2 })],   // DEF starter
  // ... etc.
])
const lineup: OptimisedLineup = {
  starters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  bench: [12, 13, 14, 15],
  captainId: 8,
  vcId: 9,
  formation: '4-4-2',
}
```

---

### `src/components/squad/LineupTab.tsx` (component, request-response)

**Analog:** `src/components/optimiser/OptimiserPanel.tsx`

**File header — 'use client' is mandatory** (OptimiserPanel.tsx line 1):
```typescript
'use client'
```

**Imports pattern** (OptimiserPanel.tsx lines 7-13, adapted for LineupTab):
```typescript
import { useState, useMemo, useEffect } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { optimiseLineup } from '@/lib/optimise-lineup'
import { isLegalSwap, applySwap } from '@/lib/lineup-swap'
import type { OptimisedLineup, MergedPlayer } from '@/lib/types'
```

**Props interface pattern** (OptimiserPanel.tsx lines 23-26):
```typescript
interface LineupTabProps {
  teamId: string   // submitted id from page.tsx; empty string = no submission
}
```

**submittedId derivation** (OptimiserPanel.tsx line 237 — copy exactly):
```typescript
const submittedId = teamId.trim() === '' ? null : teamId.trim()
```

**Data fetch pattern** (OptimiserPanel.tsx lines 238-239):
```typescript
const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
const { data: playersData, isLoading: playersLoading } = usePlayers()
const isLoading = squadLoading || playersLoading
```

**useMemo pattern for initialLineup** (OptimiserPanel.tsx lines 247-260 — the key structural pattern, adapted for LineupTab's fixed horizon=1):
```typescript
const { initialLineup, playerMap, eligibleCount, totalPlayersInSquad } = useMemo(() => {
  if (!squadData || !playersData) {
    return { initialLineup: null, playerMap: new Map<number, MergedPlayer>(), eligibleCount: 0, totalPlayersInSquad: 0 }
  }
  const map = new Map<number, MergedPlayer>(playersData.map(p => [p.id, p]))
  const eligible = squadData.picks.filter(pick => {
    const p = map.get(pick.element)
    if (!p) return false
    return p.xPts_1gw !== 0   // CRITICAL: exact === 0 only (Pitfall 1 from RESEARCH.md)
  }).length
  const result = optimiseLineup(squadData.picks, playersData, 1)   // horizon always 1 per D-02
  return {
    initialLineup: result,
    playerMap: map,
    eligibleCount: eligible,
    totalPlayersInSquad: squadData.picks.length,
  }
}, [squadData, playersData])
```

**Override state + Reset pattern** (RESEARCH.md Pattern 4):
```typescript
const [lineup, setLineup] = useState<OptimisedLineup | null>(initialLineup)

useEffect(() => {
  setLineup(initialLineup)
}, [initialLineup])

const handleReset = () => setLineup(initialLineup)
```

**Swap state machine** (RESEARCH.md Pattern 5):
```typescript
const [pendingStarterId, setPendingStarterId] = useState<number | null>(null)

function handleStarterTap(id: number) {
  setPendingStarterId(prev => prev === id ? null : id)
}

function handleBenchTap(benchId: number) {
  if (pendingStarterId === null || !lineup) return
  if (!isLegalSwap(lineup, pendingStarterId, benchId, playerMap)) return
  setLineup(applySwap(lineup, pendingStarterId, benchId, playerMap))
  setPendingStarterId(null)
}

function handleBackgroundTap() {
  setPendingStarterId(null)
}
```

**Empty state guard** (OptimiserPanel.tsx lines 301-310 — copy structure, update testid and copy):
```tsx
if (submittedId === null) {
  return (
    <section className="mt-6 space-y-3" data-testid="lineup-tab">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lineup</h2>
      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Enter your FPL Team ID to see your lineup.
      </div>
    </section>
  )
}
```

**Loading state guard** (OptimiserPanel.tsx lines 313-321 — copy structure):
```tsx
if (isLoading) {
  return (
    <section className="mt-6 space-y-3" data-testid="lineup-tab">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lineup</h2>
      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
        Loading squad...
      </div>
    </section>
  )
}
```

**Error state guard** (OptimiserPanel.tsx lines 324-337 — copy structure including error message extraction):
```tsx
if (squadError) {
  const errorMessage = squadError instanceof Error && squadError.message
    ? squadError.message
    : 'Unable to load squad data. Please try again.'
  return (
    <section className="mt-6 space-y-3" data-testid="lineup-tab">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lineup</h2>
      <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
        {errorMessage}
      </div>
    </section>
  )
}
```

**BGW critical banner** (OptimiserPanel.tsx lines 352-371 — copy the amber banner block):
```tsx
if (lineup === null) {
  return (
    <section className="mt-6 space-y-3" data-testid="lineup-tab">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lineup</h2>
      {eligibleCount < 11 ? (
        <div
          className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          data-testid="bgw-banner-critical"
        >
          <span className="font-semibold">Warning:</span>{' '}
          fewer than 11 eligible starters this gameweek.
        </div>
      ) : (
        <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          Unable to optimise lineup. Please try again.
        </div>
      )}
    </section>
  )
}
```

**BGW soft banner** (OptimiserPanel.tsx lines 427-435 — copy inside the happy-path section):
```tsx
{eligibleCount < totalPlayersInSquad && eligibleCount >= 11 && (
  <div
    className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
    data-testid="bgw-banner-soft"
  >
    <span className="font-semibold">Blank gameweek warning:</span>{' '}
    only {eligibleCount} of your {totalPlayersInSquad} players have a fixture this gameweek.
  </div>
)}
```

**Captain/VC badge precedent** (from `src/components/squad/SquadView.tsx` referenced in RESEARCH.md sources — amber-600 for C, zinc-500 for VC):
```tsx
{id === lineup.captainId && <span className="text-amber-600 font-bold">C</span>}
{id === lineup.vcId      && <span className="text-zinc-500">VC</span>}
```

**data-testid convention** (must match test assertions — see test analog below):
- Root section: `data-testid="lineup-tab"`
- BGW banners: `data-testid="bgw-banner-critical"` and `data-testid="bgw-banner-soft"`
- Player cards: `data-testid="pitch-card-{id}"`
- Reset button: `data-testid="reset-button"`

**Event-bubble pitfall mitigation** (RESEARCH.md Pitfall 7 — must include on every card):
```tsx
onClick={(e) => { e.stopPropagation(); onCardTap(id) }}
```

**Export convention** (matches OptimiserPanel.tsx line 231 — named export, not default):
```typescript
export function LineupTab({ teamId }: LineupTabProps) { ... }
```

---

### `src/components/squad/LineupTab.test.tsx` (test, component)

**Analog:** `src/components/optimiser/OptimiserPanel.test.tsx`

**File header** (OptimiserPanel.test.tsx lines 1-5):
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { MergedPlayer } from '@/lib/types'
import type { SquadPick, SquadPicksResponse } from '@/lib/squad-adapter'
```

**Hook mock declarations** (OptimiserPanel.test.tsx lines 11-18 — EXACT pattern, mutable per test):
```typescript
const useSquadMock = vi.fn()
const usePlayersMock = vi.fn()

vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: (id: string | null) => useSquadMock(id),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => usePlayersMock(),
}))
```

**No additional mocks needed:** LineupTab has fewer dependencies than OptimiserPanel (no suggestTransfers, no chip modes, no useAuthStatus, no useMyTeam). Mock only the two hooks above.

**makePick factory** (OptimiserPanel.test.tsx lines 69-71 — copy verbatim):
```typescript
function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}
```

**makePlayer factory** (OptimiserPanel.test.tsx lines 73-118 — copy ALL fields verbatim, including `as MergedPlayer` cast):
```typescript
function makePlayer(overrides: Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    // ... all 40+ fields ...
    ...overrides,
  } as MergedPlayer
}
```

**makeValidSquad factory** (OptimiserPanel.test.tsx lines 120-135 — copy verbatim, this produces a 15-player squad the real optimiser can solve):
```typescript
function makeValidSquad(): { picks: SquadPick[]; players: MergedPlayer[]; squadResp: SquadPicksResponse } {
  const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  const picks: SquadPick[] = []
  const players: MergedPlayer[] = []
  for (let i = 0; i < 15; i++) {
    const id = i + 1
    picks.push(makePick(id, i + 1))
    players.push(makePlayer({ id, element_type: elementTypes[i] }))
  }
  const squadResp: SquadPicksResponse = {
    active_chip: null,
    picks,
    entry_history: { event: 30, bank: 0, event_transfers: 0, event_transfers_cost: 0, value: 1000 },
  }
  return { picks, players, squadResp }
}
```

**beforeEach reset pattern** (OptimiserPanel.test.tsx lines 137-151 — adapt for only two hooks):
```typescript
beforeEach(() => {
  useSquadMock.mockReset()
  usePlayersMock.mockReset()
})
```

**Import-after-mocks rule** (OptimiserPanel.test.tsx line 66 — critical for vi.mock hoisting):
```typescript
// ALL vi.mock() calls MUST appear before this import
import { LineupTab } from './LineupTab'
```

**Empty/loading/error test pattern** (OptimiserPanel.test.tsx lines 155-182 — copy exact mock return shape):
```typescript
// Empty state:
useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: null })
usePlayersMock.mockReturnValue({ data: undefined, isLoading: false })

// Loading state:
useSquadMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
usePlayersMock.mockReturnValue({ data: undefined, isLoading: false })

// Error state:
useSquadMock.mockReturnValue({ data: undefined, isLoading: false, error: new Error('message') })
usePlayersMock.mockReturnValue({ data: [], isLoading: false })
```

**Happy-path mock pattern** (OptimiserPanel.test.tsx lines 479-490 — the `setupValidLineup` helper idiom):
```typescript
function setupValidLineup() {
  const { players, squadResp } = makeValidSquad()
  useSquadMock.mockReturnValue({ data: squadResp, isLoading: false, error: null })
  usePlayersMock.mockReturnValue({ data: players, isLoading: false })
}
```

**Interaction test pattern with fireEvent** (OptimiserPanel.test.tsx lines 213-216):
```typescript
const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Reset')
fireEvent.click(btn!)
```

---

### `src/app/page.tsx` (config, additive modification)

**What to change:** Three additive insertions, no deletions.

**Change 1 — SubTab union** (page.tsx line 55, current value):
```typescript
// CURRENT (line 55):
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals' | 'fixture-heat-map'

// AFTER (add 'lineup' to the union):
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals' | 'fixture-heat-map' | 'lineup'
```

**Change 2 — SECTIONS Squad subTabs** (page.tsx lines 88-93, current Squad entry):
```typescript
// CURRENT (lines 88-93):
{
  id: 'squad' as Section,
  label: 'Squad',
  subTabs: [
    { id: 'decision' as SubTab,  label: 'Decision',  mobileLabel: 'Decision'  },
    { id: 'transfers' as SubTab, label: 'Transfers', mobileLabel: 'Transfers' },
    { id: 'optimiser' as SubTab, label: 'Optimiser', mobileLabel: 'Optimiser' },
  ],
  defaultSubTab: 'decision' as SubTab,
}

// AFTER (add lineup as 4th entry):
{
  id: 'squad' as Section,
  label: 'Squad',
  subTabs: [
    { id: 'decision' as SubTab,  label: 'Decision',  mobileLabel: 'Decision'  },
    { id: 'transfers' as SubTab, label: 'Transfers', mobileLabel: 'Transfers' },
    { id: 'optimiser' as SubTab, label: 'Optimiser', mobileLabel: 'Optimiser' },
    { id: 'lineup' as SubTab,    label: 'Lineup',    mobileLabel: 'Lineup'    },
  ],
  defaultSubTab: 'decision' as SubTab,
}
```

**Change 3 — render guard** (insert after line 231 — the optimiser guard — using exact same pattern):
```typescript
// CURRENT (lines 230-232):
{activeSection === 'squad' && activeSubTab === 'optimiser' && (
  <OptimiserPanel teamId={submittedId ?? ''} />
)}

// ADD AFTER (same `activeSection === 'squad'` guard pattern):
{activeSection === 'squad' && activeSubTab === 'lineup' && (
  <LineupTab teamId={submittedId ?? ''} />
)}
```

**Change 4 — import** (add after line 32, alongside other squad component imports):
```typescript
import { LineupTab } from '@/components/squad/LineupTab'
```

---

### `src/app/page.test.tsx` (test, additive modification)

**What to change:** Add mock + two test cases. No existing tests should be touched.

**New mock to add** (after existing OptimiserPanel mock at line 17 — copy its exact shape):
```typescript
// CURRENT (line 17):
vi.mock('@/components/optimiser/OptimiserPanel', () => ({ OptimiserPanel: (_props: { teamId: string }) => <div data-testid="optimiser-panel" /> }))

// ADD AFTER (same shape, different testid):
vi.mock('@/components/squad/LineupTab', () => ({ LineupTab: (_props: { teamId: string }) => <div data-testid="lineup-tab" /> }))
```

**Extend the Squad sub-tab nav test** (page.test.tsx lines 151-155 — the assertion that checks button order must be updated):
```typescript
// CURRENT (line 154):
expect(subTabBtns).toEqual(['Decision', 'Transfers', 'Optimiser'])

// AFTER:
expect(subTabBtns).toEqual(['Decision', 'Transfers', 'Optimiser', 'Lineup'])
```

**New test case to add** (mirrors page.test.tsx lines 157-165 for Optimiser — same structure):
```typescript
it('Squad Lineup sub-tab shows LineupTab and hides OptimiserPanel', () => {
  const { container } = render(<Home />)
  const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
  fireEvent.click(squadBtn!)
  const lineupBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Lineup')
  fireEvent.click(lineupBtn!)
  expect(container.querySelector('[data-testid="lineup-tab"]')).not.toBeNull()
  expect(container.querySelector('[data-testid="optimiser-panel"]')).toBeNull()
})
```

---

## Shared Patterns

### 'use client' directive
**Source:** `src/components/optimiser/OptimiserPanel.tsx` line 1; `src/components/squad/DecisionSummaryTab.tsx` line 1
**Apply to:** `LineupTab.tsx` only (lineup-swap.ts is a pure function — no directive)
```typescript
'use client'
```

### BGW eligibility filter
**Source:** `src/components/optimiser/OptimiserPanel.tsx` lines 253-257; `src/lib/optimise-lineup.ts` lines 48-52
**Apply to:** `LineupTab.tsx` useMemo block
```typescript
return p.xPts_1gw !== 0   // CRITICAL: exact === 0 only; undefined means no pipeline data, NOT BGW
```

### Path alias convention
**Source:** `src/components/optimiser/OptimiserPanel.tsx` lines 8-14
**Apply to:** All new files' imports
```typescript
import { useSquad }   from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { optimiseLineup } from '@/lib/optimise-lineup'
import type { OptimisedLineup, MergedPlayer } from '@/lib/types'
```
The `@/` alias maps to `src/`. Relative imports (`./`, `../`) are NOT used from component files.

### Captain/VC badge styling
**Source:** `src/components/squad/SquadView.tsx` (referenced in RESEARCH.md sources)
**Apply to:** Player cards in `LineupTab.tsx`
- Captain: `text-amber-600 font-bold` with text "C"
- VC: `text-zinc-500` with text "VC"

### Error message extraction
**Source:** `src/components/optimiser/OptimiserPanel.tsx` lines 326-329
**Apply to:** `LineupTab.tsx` error state
```typescript
const errorMessage = squadError instanceof Error && squadError.message
  ? squadError.message
  : 'Unable to load squad data. Please try again.'
```

### data-testid naming convention
**Source:** `src/components/optimiser/OptimiserPanel.tsx` — `data-testid="optimiser-panel"` on root section
**Apply to:** `LineupTab.tsx` root section element must use `data-testid="lineup-tab"` (matches the mock in page.test.tsx)

---

## No Analog Found

None — all 6 files have close analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/optimiser/`, `src/components/squad/`, `src/app/`
**Files scanned:** 8 (optimise-lineup.ts, optimise-lineup.test.ts, OptimiserPanel.tsx, OptimiserPanel.test.tsx, page.tsx, page.test.tsx, types.ts, SquadView.tsx ref)
**Pattern extraction date:** 2026-05-05
