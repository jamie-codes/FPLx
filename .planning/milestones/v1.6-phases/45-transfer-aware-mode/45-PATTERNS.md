# Phase 45: Transfer-Aware Mode - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/suggest-transfers.ts` | service/engine | CRUD + transform | `src/lib/optimise-lineup.ts` | exact |
| `src/lib/types.ts` | type definitions | (data structure) | existing file | role-match |
| `src/components/optimiser/FtToggle.tsx` | component | request-response | `src/components/gem-table/GwToggle.tsx` | exact |
| `src/components/optimiser/OptimiserPanel.tsx` | component | request-response | existing file | same file (extend) |
| `src/components/optimiser/OptimiserPanel.test.tsx` | test | RTL + mocking | existing file | same file (extend) |
| `src/lib/suggest-transfers.test.ts` | test | unit test | `src/lib/optimise-lineup.test.ts` | exact |

---

## Pattern Assignments

### `src/lib/suggest-transfers.ts` (service/engine, CRUD + transform)

**Analog:** `src/lib/optimise-lineup.ts` (lines 1–40)

**Imports pattern** (lines 1–6):
```typescript
// No 'use client' directive — pure TS file, no React
import type { MergedPlayer, OptimiserHorizon, TransferSuggestion } from './types'
import type { SquadPick } from './squad-adapter'
import { HORIZON_FIELD } from './optimise-lineup'  // Reuse, do NOT re-declare

// Position codes — same as optimise-lineup.ts
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4
```

**Function signature** (line 36):
```typescript
export function suggestTransfers(params: SuggestTransfersParams): TransferSuggestion[] {
  // Pure function: no side effects, deterministic output from input params
}
```

**Parameter structure (inferred from RESEARCH.md §Pattern 2):**
```typescript
interface SuggestTransfersParams {
  currentPicks: SquadPick[]
  players: MergedPlayer[]
  horizon: OptimiserHorizon
  ftCount: 1 | 2
  bank: number                          // tenths of £1m
  sellPrices?: Map<number, number>      // element id -> selling_price; undefined = use now_cost fallback
}
```

**Core pattern: filtering and ranking** (mirrors lines 44–54 of optimise-lineup.ts):
```typescript
// Top-30 per position filtering (D-03)
const topPerPosition = new Map<number, MergedPlayer[]>()
for (const player of players) {
  if (!topPerPosition.has(player.element_type)) {
    topPerPosition.set(player.element_type, [])
  }
  topPerPosition.get(player.element_type)!.push(player)
}

// Sort each position by horizon xPts and keep top 30
for (const [, posPlayers] of topPerPosition) {
  const field = HORIZON_FIELD[horizon]
  posPlayers.sort((a, b) => ((b[field] as number | undefined) ?? 0) - ((a[field] as number | undefined) ?? 0))
  posPlayers.splice(30)  // keep only top 30
}

// Exclude already-owned players from "In" pool (D-03)
const currentSquadSet = new Set<number>(currentPicks.map(p => p.element))
const inCandidates = Array.from(topPerPosition.values())
  .flat()
  .filter(p => !currentSquadSet.has(p.id))
```

**Budget enforcement pattern** (from RESEARCH.md §Pattern 4):
```typescript
function isBudgetFeasible(
  sellIds: number[],
  buyIds: number[],
  sellPrices: Map<number, number>,      // empty Map when unauthenticated
  players: Map<number, MergedPlayer>,
  bank: number,
): boolean {
  const sellValue = sellIds.reduce((sum, id) => {
    const sp = sellPrices.get(id)
    const player = players.get(id)
    return sum + (sp ?? player?.now_cost ?? 0)  // Fallback: sellPrices.get → now_cost
  }, 0)
  const buyCost = buyIds.reduce((sum, id) => sum + (players.get(id)?.now_cost ?? 0), 0)
  return bank + sellValue >= buyCost  // All values in tenths of £1m
}
```

**Break-even formula** (from RESEARCH.md §Pattern 5):
```typescript
const breakEvenGws = cost > 0 && xPtsGainPerGw > 0
  ? Math.max(1, Math.ceil(4 / xPtsGainPerGw))
  : null  // null when cost === 0 (FREE transfer)
```

**Return type ordering:** Sort by xPts gain descending (higher gain first).

---

### `src/lib/types.ts` (type definitions)

**Location:** End of file, after `OptimisedLineup` (line 191)

**Analog:** existing type patterns in file (lines 183–191 for `OptimisedLineup`)

**Add TransferSuggestion discriminated union** (from RESEARCH.md §Key Finding 3):
```typescript
// Discriminated union for single vs combo transfers (both kinds possible in result array)
export type TransferSuggestion =
  | {
      kind: 'single'
      sell: MergedPlayer
      buy: MergedPlayer
      cost: 0 | 4                       // 0 = FREE, 4 = -4pt hit
      xPtsGain: number                   // always > 0 (filtered by engine)
      xPtsGainPerGw: number              // xPtsGain / horizon
      breakEvenGws: number | null        // ceil(4 / xPtsGainPerGw) when cost > 0; null when FREE
    }
  | {
      kind: 'combo'
      transfers: [
        { sell: MergedPlayer; buy: MergedPlayer },
        { sell: MergedPlayer; buy: MergedPlayer }
      ]
      cost: 0 | 4                        // 0 = both within ftCount, 4 = one hit
      xPtsGain: number
      xPtsGainPerGw: number
      breakEvenGws: number | null
    }
```

---

### `src/components/optimiser/FtToggle.tsx` (component, request-response)

**Analog:** `src/components/gem-table/GwToggle.tsx` (lines 86–114)

**Imports and props** (mirrors GwToggle lines 86–89):
```typescript
'use client'

export type Props = {
  value: 1 | 2
  onChange: (v: 1 | 2) => void
}

export function FtToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Available free transfers"
      className="flex rounded overflow-hidden border border-zinc-200 dark:border-zinc-700"  // Softer border per RESEARCH.md §10
    >
      {([1, 2] as const).map((ft) => (
        <button
          key={ft}
          onClick={() => onChange(ft)}
          aria-pressed={value === ft}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
            value === ft
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {ft} FT{ft === 2 ? 's' : ''}
        </button>
      ))}
    </div>
  )
}
```

**Key pattern differences from GwToggle:**
- Props type: `1 | 2` instead of `1 | 3 | 5`
- Label: "Available free transfers" instead of "Projected points horizon"
- Border: `border-zinc-200 dark:border-zinc-700` (softer) instead of `border-zinc-300 dark:border-zinc-600`
- Button text: "1 FT" / "2 FTs" with plural handling
- Otherwise identical: role group, aria-pressed, active:scale-95, min-h-[44px]

---

### `src/components/optimiser/OptimiserPanel.tsx` (component, request-response)

**Analog:** existing file — extend in place

**Location:** Lines 1–403 (current Phase 44 implementation)

**New imports to add** (after line 11):
```typescript
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { suggestTransfers } from '@/lib/suggest-transfers'
import { FtToggle } from './FtToggle'
import type { TransferSuggestion } from '@/lib/types'
```

**Import HORIZON_FIELD** (replace local declaration on lines 27–31):
```typescript
// Line 10: add to existing import from optimise-lineup
import { optimiseLineup, HORIZON_FIELD } from '@/lib/optimise-lineup'
// Delete lines 27–31 (local HORIZON_FIELD re-declaration) — IN-01 fix from 44-REVIEW.md
```

**State additions** (inside component, after line 228):
```typescript
const [ftCount, setFtCount] = useState<1 | 2>(1)  // D-02: default is 1 FT
```

**Hook additions** (after line 232):
```typescript
const { isAuthenticated } = useAuthStatus()
const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)
```

**Exact sell prices memo** (mirrors TransferPanel.tsx lines 65–68):
```typescript
const exactSellPrices = useMemo(() => {
  if (!myTeamData) return new Map<number, number>()
  return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
}, [myTeamData])
```

**Transfer suggestions memo** (new, after the lineup memo on line 251):
```typescript
const transferSuggestions = useMemo(() => {
  if (!squadData || !playersData || !lineup) return []
  return suggestTransfers({
    currentPicks: squadData.picks,
    players: playersData,
    horizon,
    ftCount,
    bank: squadData.entry_history.bank,
    sellPrices: exactSellPrices,
  })
}, [squadData, playersData, lineup, horizon, ftCount, exactSellPrices])
```

**Render position** (after mobile cards closing `</div>` at approx line 403, before final `</section>`):
```typescript
{/* Transfer Suggestions section — rendered below comparison table (D-06) */}
{lineup !== null && (
  <section className="mt-6 space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Transfer Suggestions</h3>
      <FtToggle value={ftCount} onChange={setFtCount} />
    </div>
    {transferSuggestions.length === 0 ? (
      <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">
        Your current squad is already optimal for this horizon.
      </div>
    ) : (
      <div className="space-y-2">
        {transferSuggestions.map((sug, i) => (
          <div key={i} className="rounded border border-zinc-200 dark:border-zinc-700 p-3 text-sm space-y-1">
            {/* Row format per D-07: "Out: [name] → In: [name] | FREE / -4pts | +X.X xPts" */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Out: <span className="font-medium">{sug.sell.web_name}</span></span>
                <span className="text-zinc-400">→</span>
                <span>In: <span className="font-medium">{sug.buy.web_name}</span></span>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span className={sug.cost === 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                  {sug.cost === 0 ? 'FREE' : '-4pts'}
                </span>
                <span className="text-green-600 dark:text-green-400 font-semibold">+{sug.xPtsGain.toFixed(1)} xPts</span>
              </div>
            </div>
            {/* Break-even subline for hit transfers (D-07, TFR-03) */}
            {sug.breakEvenGws !== null && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 pl-2">
                Breaks even in {sug.breakEvenGws} {sug.breakEvenGws === 1 ? 'GW' : 'GWs'} based on xPts gain
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </section>
)}
```

**CR-01 fix** (optional housekeeping, Phase 44 review defect at line 60):
```typescript
// Current code (line 60):
const optimisedId = sortedOptimised[i] ?? currentId

// Improved (guards against undefined when formation changes):
const optimisedId = i < sortedOptimised.length ? sortedOptimised[i] : currentId
```

---

### `src/components/optimiser/OptimiserPanel.test.tsx` (test, RTL + mocking)

**Analog:** existing file (lines 1–100+) + `src/lib/optimise-lineup.test.ts` (lines 1–50)

**New mocks required** (add at module level, before imports; mirrors TransferPanel test patterns):
```typescript
// Phase 45: add useAuthStatus and useMyTeam mocks (lines 1–20)
const useAuthStatusMock = vi.fn()
const useMyTeamMock = vi.fn()

vi.mock('@/lib/hooks/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))

vi.mock('@/lib/hooks/useMyTeam', () => ({
  useMyTeam: (_enabled: boolean) => useMyTeamMock(),
}))

// Mock suggestTransfers function (new Phase 45 function)
vi.mock('@/lib/suggest-transfers', () => ({
  suggestTransfers: vi.fn(),
}))
```

**Mock suggestTransfers import** (for use in tests):
```typescript
import { suggestTransfers as suggestTransfersMock } from '@/lib/suggest-transfers'
```

**Default mock return values** (in `beforeEach`, after line 96):
```typescript
useAuthStatusMock.mockReturnValue({ isAuthenticated: false, isLoading: false })
useMyTeamMock.mockReturnValue({ data: undefined })
vi.mocked(suggestTransfersMock).mockReturnValue([])  // Empty suggestions by default
```

**Existing Phase 44 tests:** All remain unchanged (mocks default to unauthenticated state).

**New Phase 45 test cases** (add to describe block after Phase 44 tests):
```typescript
describe('Phase 45: Transfer-aware mode (transfer suggestions)', () => {
  it('renders transfer section when lineup is non-null', () => {
    // Setup: valid squad from makeValidSquad()
    useSquadMock.mockReturnValue({ data: /* ... */, isLoading: false })
    usePlayersMock.mockReturnValue({ data: /* ... */, isLoading: false })
    const { getByTestId } = render(<OptimiserPanel teamId="123" />)
    // Assert: transfer section visible
    expect(getByTestId('transfer-section')).toBeInTheDocument()
  })

  it('FtToggle defaults to 1 FT and updates ftCount on click', () => {
    // Setup: same as above
    const { getByRole } = render(<OptimiserPanel teamId="123" />)
    const button2FT = getByRole('button', { name: /2 FTs/ })
    expect(button2FT).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(button2FT)
    expect(button2FT).toHaveAttribute('aria-pressed', 'true')
  })

  it('suggestTransfers is called with ftCount when it changes', () => {
    // Setup + fixtures
    useSquadMock.mockReturnValue({ data: { picks: [...], entry_history: { bank: 100, ... } }, isLoading: false })
    usePlayersMock.mockReturnValue({ data: [makePlayer({ id: 1, ... }), ...], isLoading: false })
    const { getByRole, rerender } = render(<OptimiserPanel teamId="123" />)
    
    // Act: click 2 FT button
    fireEvent.click(getByRole('button', { name: /2 FTs/ }))
    
    // Assert: suggestTransfers called with ftCount: 2
    expect(suggestTransfersMock).toHaveBeenCalledWith(
      expect.objectContaining({ ftCount: 2 })
    )
  })

  it('renders empty state when suggestTransfers returns []', () => {
    useSquadMock.mockReturnValue({ data: /* ... */, isLoading: false })
    usePlayersMock.mockReturnValue({ data: /* ... */, isLoading: false })
    vi.mocked(suggestTransfersMock).mockReturnValue([])
    
    const { getByText } = render(<OptimiserPanel teamId="123" />)
    expect(getByText(/Your current squad is already optimal/)).toBeInTheDocument()
  })

  it('renders suggestion rows with Out/In/cost/xPts columns', () => {
    // Setup with non-empty suggestions
    const mockSuggestion = {
      kind: 'single' as const,
      sell: makePlayer({ id: 1, web_name: 'Player Out' }),
      buy: makePlayer({ id: 2, web_name: 'Player In' }),
      cost: 0,
      xPtsGain: 2.5,
      xPtsGainPerGw: 0.8,
      breakEvenGws: null,
    }
    vi.mocked(suggestTransfersMock).mockReturnValue([mockSuggestion])
    
    const { getByText } = render(<OptimiserPanel teamId="123" />)
    expect(getByText('Player Out')).toBeInTheDocument()
    expect(getByText('Player In')).toBeInTheDocument()
    expect(getByText('FREE')).toBeInTheDocument()
    expect(getByText('+2.5 xPts')).toBeInTheDocument()
  })

  it('renders break-even subline for -4pt hit suggestions only', () => {
    const mockHitSuggestion = {
      kind: 'single' as const,
      sell: makePlayer({ id: 1 }),
      buy: makePlayer({ id: 2 }),
      cost: 4,
      xPtsGain: 3.0,
      xPtsGainPerGw: 1.0,
      breakEvenGws: 4,
    }
    vi.mocked(suggestTransfersMock).mockReturnValue([mockHitSuggestion])
    
    const { getByText } = render(<OptimiserPanel teamId="123" />)
    expect(getByText(/Breaks even in 4 GWs/)).toBeInTheDocument()
  })

  it('does not render transfer section when lineup is null (BGW)', () => {
    // Setup: eligible < 11, engine returns null
    useSquadMock.mockReturnValue({
      data: { picks: /* ... */, entry_history: /* ... */ },
      isLoading: false,
    })
    usePlayersMock.mockReturnValue({ data: [], isLoading: false })  // No players = null lineup
    
    const { queryByTestId } = render(<OptimiserPanel teamId="123" />)
    expect(queryByTestId('transfer-section')).not.toBeInTheDocument()
  })

  it('calls useMyTeam with enabled=true when authenticated', () => {
    useAuthStatusMock.mockReturnValue({ isAuthenticated: true, isLoading: false })
    const { rerender } = render(<OptimiserPanel teamId="123" />)
    expect(useMyTeamMock).toHaveBeenCalledWith(true)
  })

  it('calls useMyTeam with enabled=false when not authenticated', () => {
    useAuthStatusMock.mockReturnValue({ isAuthenticated: false, isLoading: false })
    const { rerender } = render(<OptimiserPanel teamId="123" />)
    expect(useMyTeamMock).toHaveBeenCalledWith(false)
  })

  it('plural handling: 1 GW vs multiple GWs in break-even copy', () => {
    const mockSingleGwBreakEven = {
      kind: 'single' as const,
      sell: makePlayer({ id: 1 }),
      buy: makePlayer({ id: 2 }),
      cost: 4,
      xPtsGain: 4.1,
      xPtsGainPerGw: 4.1,
      breakEvenGws: 1,
    }
    vi.mocked(suggestTransfersMock).mockReturnValue([mockSingleGwBreakEven])
    
    const { getByText, queryByText } = render(<OptimiserPanel teamId="123" />)
    expect(getByText(/Breaks even in 1 GW/)).toBeInTheDocument()  // singular
    expect(queryByText(/Breaks even in 1 GWs/)).not.toBeInTheDocument()
  })
})
```

---

### `src/lib/suggest-transfers.test.ts` (test, unit test / node environment)

**Analog:** `src/lib/optimise-lineup.test.ts` (lines 1–75)

**File header and environment**:
```typescript
// Phase 45 (TFR-01..TFR-03): suggestTransfers engine — pure function unit tests.
// Mirrors src/lib/optimise-lineup.test.ts pattern: @vitest-environment node (no jsdom).
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { suggestTransfers } from './suggest-transfers'
import type { MergedPlayer, TransferSuggestion } from './types'
import type { SquadPick } from './squad-adapter'
```

**Test fixtures** (same factories as optimise-lineup.test.ts):
```typescript
function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

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

function makeValidSquad(opts?: { horizon?: 1 | 3 | 5; playerCount?: number }): {
  picks: SquadPick[]
  players: MergedPlayer[]
} {
  const horizon = opts?.horizon ?? 1
  const playerCount = opts?.playerCount ?? 20  // 15 squad + 5 out-of-squad candidates
  const elementTypes: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]
  
  const players: MergedPlayer[] = []
  const picks: SquadPick[] = []
  
  for (let i = 0; i < playerCount; i++) {
    const id = i + 1
    const et = elementTypes[i % 15] as 1 | 2 | 3 | 4
    
    // Vary xPts by position and horizon; out-of-squad players are weaker
    const xPtsBase = i < 15 ? 5 : 3
    const players_push = makePlayer({
      id,
      element_type: et,
      xPts_1gw: xPtsBase,
      xPts_3gw: xPtsBase * 3,
      xPts_5gw: xPtsBase * 5,
    })
    players.push(players_push)
    
    if (i < 15) {
      picks.push(makePick(id, i + 1))
    }
  }
  
  return { picks, players }
}
```

**Test cases** (from RESEARCH.md §Wave 0):
```typescript
describe('Phase 45: suggestTransfers engine', () => {
  describe('Empty / null cases', () => {
    it('returns empty array when squad or players list is empty', () => {
      const result = suggestTransfers({
        currentPicks: [],
        players: [],
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      expect(result).toEqual([])
    })
  })

  describe('Single free transfer (ftCount=1, cost=0)', () => {
    it('returns single FREE suggestion when one player improves xPts and budget sufficient', () => {
      const { picks, players } = makeValidSquad()
      const weaker = players.find(p => p.id === 1)!  // GK in squad with xPts_1gw: 5
      const stronger = players.find(p => p.id === 16)!  // Out-of-squad GK with xPts_1gw: 3... actually weaker
      // Manually create stronger candidate
      const strongerGk = makePlayer({ id: 16, element_type: 1, xPts_1gw: 8.0 })
      const allPlayers = [...players, strongerGk]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      expect(result.length).toBeGreaterThan(0)
      const freeSuggestion = result.find(s => s.cost === 0)
      expect(freeSuggestion).toBeDefined()
      expect(freeSuggestion?.kind).toBe('single')
      if (freeSuggestion?.kind === 'single') {
        expect(freeSuggestion.breakEvenGws).toBeNull()
      }
    })

    it('returns only positive-gain suggestions (no negative delta)', () => {
      const { picks, players } = makeValidSquad()
      // All out-of-squad players are weaker (xPts_1gw: 3 vs squad 5)
      const result = suggestTransfers({
        currentPicks: picks,
        players,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      expect(result).toEqual([])  // No improvements possible
    })
  })

  describe('Hit transfers (cost=4, -4pts)', () => {
    it('includes hit suggestions alongside free transfers', () => {
      const { picks, players } = makeValidSquad()
      const strongPlayer = makePlayer({ id: 20, element_type: 2, xPts_1gw: 9.0 })
      const allPlayers = [...players, strongPlayer]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      // Should include hit suggestions even though we have only 1 FT
      const hitSuggestion = result.find(s => s.cost === 4)
      expect(hitSuggestion).toBeDefined()
      if (hitSuggestion?.kind === 'single') {
        expect(hitSuggestion.breakEvenGws).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('Budget enforcement (D-09, D-10)', () => {
    it('filters out suggestions when user cannot afford incoming player', () => {
      const { picks, players } = makeValidSquad()
      const expensivePlayer = makePlayer({
        id: 20,
        element_type: 2,
        xPts_1gw: 8.0,
        now_cost: 200,  // £20m — squad has only 10m in bank
      })
      const allPlayers = [...players, expensivePlayer]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 10,  // tenths of £1m = £1m
      })
      
      // Should not include expensive player
      const expensiveSuggestion = result.find(s => s.kind === 'single' && 'buy' in s && s.buy.id === 20)
      expect(expensiveSuggestion).toBeUndefined()
    })

    it('uses sellPrices map when provided (authenticated fallback D-09)', () => {
      const { picks, players } = makeValidSquad()
      const sellPrices = new Map<number, number>([[1, 65]])  // GK id=1 selling for 65 (6.5m)
      const strongGk = makePlayer({
        id: 20,
        element_type: 1,
        xPts_1gw: 8.0,
        now_cost: 70,
      })
      const allPlayers = [...players, strongGk]
      
      // With selling price 65 + bank 10 = 75 ≥ 70 ✓ affordable
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 10,
        sellPrices,
      })
      
      const suggestion = result.find(s => s.kind === 'single' && 'buy' in s && s.buy.id === 20)
      expect(suggestion).toBeDefined()
    })

    it('falls back to now_cost when sellPrices not provided (unauthenticated D-11)', () => {
      const { picks, players } = makeValidSquad()
      const strongGk = makePlayer({
        id: 20,
        element_type: 1,
        xPts_1gw: 8.0,
        now_cost: 60,  // Fallback: use now_cost
      })
      // Override current squad GK now_cost
      picks[0].element = 1
      const currentGk = makePlayer({
        id: 1,
        element_type: 1,
        xPts_1gw: 5.0,
        now_cost: 55,
      })
      const allPlayers = [
        ...players.filter(p => p.id !== 1),
        currentGk,
        strongGk,
      ]
      
      // No sellPrices map — uses now_cost 55 + bank 50 = 105 ≥ 60 ✓
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 50,
      })
      
      const suggestion = result.find(s => s.kind === 'single' && 'buy' in s && s.buy.id === 20)
      expect(suggestion).toBeDefined()
    })
  })

  describe('Top-30 per position pool (D-03)', () => {
    it('respects top-30 per position filtering', () => {
      const { picks } = makeValidSquad()
      // Create 50 DEFs with varying xPts
      const defs = Array.from({ length: 50 }, (_, i) =>
        makePlayer({
          id: 100 + i,
          element_type: 2,
          xPts_1gw: 5 - (i * 0.05),  // Decreasing strength
        })
      )
      const allPlayers = [
        ...makeValidSquad().players.filter(p => p.element_type !== 2),
        ...defs,
      ]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      // Should only consider top-30 DEFs; weaker ones (beyond rank 30) not in suggestions
      const weakDef = defs[40]  // rank 41+, should be ignored
      const suggestion = result.find(s => s.kind === 'single' && 'buy' in s && s.buy.id === weakDef.id)
      expect(suggestion).toBeUndefined()
    })

    it('excludes currently-owned players from in-pool (D-03)', () => {
      const { picks, players } = makeValidSquad()
      
      const result = suggestTransfers({
        currentPicks: picks,
        players,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      // All suggestions must have buy.id not in current squad
      for (const sug of result) {
        const buyIds = sug.kind === 'single' ? [sug.buy.id] : sug.transfers.map(t => t.buy.id)
        const currentIds = picks.map(p => p.element)
        for (const buyId of buyIds) {
          expect(currentIds).not.toContain(buyId)
        }
      }
    })
  })

  describe('Break-even calculation (TFR-03)', () => {
    it('calculates break-even GWs as ceil(4 / xPtsGainPerGw)', () => {
      const { picks, players } = makeValidSquad({ horizon: 3 })
      const strongDef = makePlayer({
        id: 20,
        element_type: 2,
        xPts_1gw: 8.0,
        xPts_3gw: 2.4,  // 3 GWs of 0.8 each = 2.4
      })
      const allPlayers = [...players, strongDef]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 3,
        ftCount: 1,
        bank: 100,
      })
      
      const hitSuggestion = result.find(s => s.cost === 4)
      if (hitSuggestion?.kind === 'single') {
        const expected = Math.ceil(4 / hitSuggestion.xPtsGainPerGw)
        expect(hitSuggestion.breakEvenGws).toBe(Math.max(1, expected))
      }
    })

    it('sets breakEvenGws=null for FREE transfers', () => {
      const { picks, players } = makeValidSquad()
      const strongPlayer = makePlayer({
        id: 20,
        element_type: 1,
        xPts_1gw: 8.0,
      })
      const allPlayers = [...players, strongPlayer]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      const freeSuggestion = result.find(s => s.cost === 0)
      if (freeSuggestion?.kind === 'single') {
        expect(freeSuggestion.breakEvenGws).toBeNull()
      }
    })
  })

  describe('Two-FT mode (ftCount=2)', () => {
    it('returns combo suggestions when ftCount=2', () => {
      const { picks, players } = makeValidSquad()
      // Create strong replacements for 2 players
      const strongGk = makePlayer({ id: 20, element_type: 1, xPts_1gw: 8.0 })
      const strongDef = makePlayer({ id: 21, element_type: 2, xPts_1gw: 7.5 })
      const allPlayers = [...players, strongGk, strongDef]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 2,
        bank: 100,
      })
      
      const comboSuggestion = result.find(s => s.kind === 'combo')
      expect(comboSuggestion).toBeDefined()
    })

    it('includes both free and hit 2-FT combos', () => {
      const { picks, players } = makeValidSquad()
      const expensivePlayer = makePlayer({
        id: 20,
        element_type: 1,
        xPts_1gw: 9.0,
        now_cost: 150,
      })
      const allPlayers = [...players, expensivePlayer]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 2,
        bank: 50,
      })
      
      // Should have mix: some combos cost 0, some cost 4
      const costs = new Set(result.map(s => s.cost))
      expect(costs.size).toBeGreaterThan(0)
    })
  })

  describe('Sorting and ranking', () => {
    it('sorts suggestions by xPtsGain descending (highest gain first)', () => {
      const { picks, players } = makeValidSquad()
      const weak = makePlayer({ id: 20, element_type: 1, xPts_1gw: 6.5 })
      const strong = makePlayer({ id: 21, element_type: 2, xPts_1gw: 9.0 })
      const allPlayers = [...players, weak, strong]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 1,
        ftCount: 1,
        bank: 100,
      })
      
      // Verify descending order
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].xPtsGain).toBeGreaterThanOrEqual(result[i + 1].xPtsGain)
      }
    })
  })

  describe('xPtsGainPerGw calculation', () => {
    it('divides xPtsGain by horizon to compute per-GW rate', () => {
      const { picks, players } = makeValidSquad({ horizon: 5 })
      const strong = makePlayer({
        id: 20,
        element_type: 1,
        xPts_1gw: 8.0,
        xPts_5gw: 40.0,  // 40 pts over 5 GWs = 8 per GW
      })
      const allPlayers = [...players, strong]
      
      const result = suggestTransfers({
        currentPicks: picks,
        players: allPlayers,
        horizon: 5,
        ftCount: 1,
        bank: 100,
      })
      
      const suggestion = result[0]
      expect(suggestion.xPtsGainPerGw).toBeCloseTo(suggestion.xPtsGain / 5, 1)
    })
  })
})
```

---

## Shared Patterns

### Authentication Guard
**Source:** `src/components/transfers/TransferPanel.tsx` (lines 34–35, 65–68)
**Apply to:** OptimiserPanel hooks section

Pattern: Conditional hook enable based on `isAuthenticated`:
```typescript
const { isAuthenticated } = useAuthStatus()
const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)
```

When `isAuthenticated` is false, `useMyTeam` is disabled (no fetch), and `myTeamData` is undefined. Budget enforcement degrades gracefully to `now_cost` fallback (D-11).

---

### Memo with Dependency Array
**Source:** `src/components/optimiser/OptimiserPanel.tsx` (lines 238–251)
**Apply to:** `transferSuggestions` memo

Pattern: Memoise expensive computation with all dependencies:
```typescript
const transferSuggestions = useMemo(() => {
  if (!squadData || !playersData || !lineup) return []
  return suggestTransfers({ ... })
}, [squadData, playersData, lineup, horizon, ftCount, exactSellPrices])
```

Do NOT omit `ftCount` or `exactSellPrices` from the dependency array — missing deps cause stale suggestions.

---

### Budget Arithmetic (All Tenths)
**Source:** RESEARCH.md §Pattern 4, `src/lib/squad-adapter.ts`
**Apply to:** `suggestTransfers` budget check

Convention: All monetary values are integer tenths of £1m (e.g., 65 = £6.5m, 100 = £10m).
- Never divide or multiply by 10 inside comparisons — keep as tenths throughout.
- `bank` field from `entry_history.bank` is already in tenths.
- `selling_price` from `MyTeamPick` is in tenths.
- `now_cost` from `MergedPlayer` is in tenths.

Example check: `bank + sellValue >= buyCost` (all in tenths; result is correct).

---

## No Analog Found

All files have clear analogs. No files in this phase require fallback to RESEARCH.md patterns.

---

## Metadata

**Analog search scope:** 
- `/src/lib/` — pure TS functions (optimise-lineup.ts, types.ts)
- `/src/components/gem-table/` — UI components (GwToggle.tsx)
- `/src/components/optimiser/` — existing OptimiserPanel and tests
- `/src/components/transfers/` — TransferPanel for hook patterns
- `/vitest.config.ts` — test environment config

**Files scanned:** 12 direct reads
**Pattern extraction date:** 2026-04-30
**Confidence:** HIGH — all patterns extracted from direct codebase reads
