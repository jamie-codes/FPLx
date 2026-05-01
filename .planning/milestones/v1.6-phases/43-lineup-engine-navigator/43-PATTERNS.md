# Phase 43: Lineup Engine & Navigator - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 10
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/optimise-lineup.ts` | utility/engine | transform | `src/lib/chip-strategy-engine.ts` | exact |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` (self — additive) | exact |
| `src/lib/squad-adapter.ts` | model | — | `src/lib/squad-adapter.ts` (self — read-only ref) | exact |
| `src/components/optimiser/OptimiserPanel.tsx` | component | request-response | `src/components/captaincy/CaptainPicksPanel.tsx` | role-match |
| `src/app/page.tsx` | controller | request-response | `src/app/page.tsx` (self — surgical edits) | exact |
| `src/components/nav/MobileNav.tsx` | component | event-driven | `src/components/nav/MobileNav.tsx` (self — guard removal) | exact |
| `src/components/transfers/TransferPanel.tsx` | component | request-response | `src/components/transfers/TransferPanel.tsx` (self — controlled refactor) | exact |
| `src/app/page.test.tsx` | test | — | `src/app/page.test.tsx` (self — update Squad assertions) | exact |
| `src/components/nav/MobileNav.test.tsx` | test | — | `src/components/nav/MobileNav.test.tsx` (self — update NAV-04) | exact |
| `src/lib/optimise-lineup.test.ts` | test | — | `src/lib/chip-strategy-engine.test.ts` | exact |
| `src/components/optimiser/OptimiserPanel.test.tsx` | test | — | `src/app/page.test.tsx` (mock/stub pattern) | role-match |

---

## Pattern Assignments

### `src/lib/optimise-lineup.ts` (utility/engine, transform)

**Analog:** `src/lib/chip-strategy-engine.ts`

**Imports pattern** (lines 1-2):
```typescript
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'
```
No `'use client'`. No React. No side effects. Only `import type` from project internals.

**Constants pattern** (lines 8-12):
```typescript
export const BGW_NEUTRAL_EASE = 0.5
export const TC_CANDIDATE_COUNT = 3
// mirror: define engine constants as named exports at top of file
```

**Exported types pattern** (lines 18-39 of analog):
```typescript
export interface OptimisedLineup {
  starters: number[]    // FPL element IDs, length 11
  bench: number[]       // FPL element IDs, length 4; bench[0] = GK
  captainId: number
  vcId: number
  formation: string     // 'DEF-MID-FWD' e.g. '4-3-3'
}

export type OptimiserHorizon = 1 | 3 | 5
```
(OptimiserHorizon and OptimisedLineup also added to `src/lib/types.ts` — see below.)

**Horizon field map pattern** (object-map over if/switch, from RESEARCH §Don't Hand-Roll):
```typescript
const HORIZON_FIELD: Record<OptimiserHorizon, keyof MergedPlayer> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}
```

**Core function signature pattern** (lines 114-119 of analog, adapted):
```typescript
export function optimiseLineup(
  picks: SquadPick[],
  players: MergedPlayer[],
  horizon: OptimiserHorizon,
): OptimisedLineup | null {
  // null when < 11 eligible players after BGW exclusion
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const field = HORIZON_FIELD[horizon]
  ...
}
```

**BGW filter pattern** (mirrors chip-strategy-engine.ts lines 202-204, player filter idiom):
```typescript
// BGW filter: exclude picks where xPts_1gw === 0 (not undefined — A1)
const eligible = picks.filter(pick => {
  const p = playerMap.get(pick.element)
  if (!p) return false
  return p.xPts_1gw !== 0  // undefined passes (no data != BGW)
})
if (eligible.length < 11) return null
```

**Tie-break / best-selection pattern** (chip-strategy-engine.ts lines 160-167):
```typescript
// Use `>` not `>=` — first-found wins ties (chip-strategy-engine convention)
let bestIdx = 0
for (let i = 1; i < candidates.length; i++) {
  if (candidates[i].score > candidates[bestIdx].score) {
    bestIdx = i
  }
}
```

**Captain fallback chain** (chip-strategy-engine.ts line 208):
```typescript
// TC fallback chain (Pitfall 3): xPts_90th_1gw ?? xPts_1gw ?? 0
const rankingKey = (p: MergedPlayer): number =>
  p.xPts_90th_1gw ?? p.xPts_1gw ?? 0
```

**Defensive zero-data return** (chip-strategy-engine.ts lines 121-124):
```typescript
// Always return null defensively when data is insufficient — never throw
if (eligible.length < 11) return null
```

**Bench ordering pattern** (from SquadView isBench check + OPT-04):
```typescript
// bench[0] = non-starting GK (element_type === 1)
// bench[1..3] = outfield bench sorted by horizon xPts descending
const benchSet = new Set(allIds.filter(id => !starterIds.has(id)))
const benchGk = [...benchSet].find(id => playerMap.get(id)?.element_type === 1)!
const benchOutfield = [...benchSet]
  .filter(id => playerMap.get(id)?.element_type !== 1)
  .sort((a, b) => (playerMap.get(b)?.[field] ?? 0) - (playerMap.get(a)?.[field] ?? 0))
```

**Formation string derivation** (OPT-01, Pitfall 5 — outfield only):
```typescript
// Formation counts DEF/MID/FWD only — GK is NOT counted
const defCount = starters.filter(id => playerMap.get(id)?.element_type === 2).length
const midCount = starters.filter(id => playerMap.get(id)?.element_type === 3).length
const fwdCount = starters.filter(id => playerMap.get(id)?.element_type === 4).length
const formation = `${defCount}-${midCount}-${fwdCount}`
```

---

### `src/lib/types.ts` (model — additive only)

**Analog:** `src/lib/types.ts` (self)

**Addition location:** After `MinsRisk` type (line 87) or after `MergedPlayer` interface (line 180), before `DefConPlayer`. Insert:
```typescript
// Optimiser types (Phase 43 OPT-01..OPT-05)
export type OptimiserHorizon = 1 | 3 | 5

export interface OptimisedLineup {
  starters: number[]    // FPL element IDs, length 11
  bench: number[]       // FPL element IDs, length 4; bench[0] = non-starting GK
  captainId: number
  vcId: number
  formation: string     // 'DEF-MID-FWD' e.g. '4-3-3'
}
```

**Confirmed existing fields on MergedPlayer** (lines 143-169):
```typescript
xPts_1gw?: number           // line 143
xPts_3gw?: number           // line 144
xPts_5gw?: number           // line 145
xPts_90th_1gw?: number      // line 169
element_type: PositionCode  // line 95 (1=GK, 2=DEF, 3=MID, 4=FWD)
```
All three xPts fields are `?: number` — always use `?? 0` fallback in engine.

---

### `src/components/optimiser/OptimiserPanel.tsx` (component, request-response)

**Analog:** `src/components/captaincy/CaptainPicksPanel.tsx`

**File header pattern** (CaptainPicksPanel.tsx line 1):
```typescript
'use client'
```

**Imports pattern** (CaptainPicksPanel.tsx lines 3-4):
```typescript
import { useState } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { GwToggle } from '@/components/gem-table/GwToggle'
import { optimiseLineup } from '@/lib/optimise-lineup'
import type { OptimisedLineup, OptimiserHorizon } from '@/lib/types'
import type { SquadPicksResponse } from '@/lib/squad-adapter'
```

**Props interface pattern** (for controlled component receiving teamId from page.tsx — D-11):
```typescript
interface OptimiserPanelProps {
  submittedId: string | null   // triggers useSquad; null = not yet submitted
}
```
(OptimiserPanel calls `useSquad(submittedId)` internally — TanStack Query cache deduplication; no prop-drilling of squadData needed.)

**Local horizon state pattern** (D-18):
```typescript
const [horizon, setHorizon] = useState<OptimiserHorizon>(1)
```

**Loading / error / null guard pattern** (CaptainPicksPanel.tsx lines 53-70):
```typescript
if (isLoading) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
      Loading squad...
    </p>
  )
}
if (error) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400 py-4">
      Failed to load squad.
    </p>
  )
}
if (!squadData) return null
```

**Amber BGW banner pattern** (TransferPanel.tsx line 237, D-16):
```typescript
{eligibleCount < 11 && (
  <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200">
    <span className="font-semibold">BGW warning</span> — fewer than 11 eligible players
    after blank gameweek exclusion. Optimiser needs at least 11 available starters.
  </div>
)}
```

**Section container pattern** (CaptainPicksPanel.tsx line 76):
```typescript
<section className="mt-6 space-y-3">
  <div className="space-y-1">
    <h2 className="text-lg font-semibold">Optimised Lineup</h2>
  </div>
  {/* Formation label + GwToggle in flex row above pitch */}
  {/* Pitch grid */}
  {/* Bench row */}
</section>
```

**GwToggle reuse pattern** (GwToggle.tsx lines 86-114 — already typed `1|3|5`, matches OptimiserHorizon):
```typescript
<GwToggle value={horizon} onChange={setHorizon} />
```

**Player (C)/(VC) label pattern** (SquadView.tsx lines 161-165):
```typescript
{/* Captain / VC inline text labels — exact styling from SquadView */}
{isCaptain && (
  <span className="ml-1 text-xs font-bold text-amber-600 dark:text-amber-400">(C)</span>
)}
{isVc && (
  <span className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">(VC)</span>
)}
```

**Player position grouping cross-reference pattern** (SquadView.tsx lines 79-99):
```typescript
// Build playerMap by id; cross-reference SquadPick.element with MergedPlayer.id
const playerMap = new Map(allPlayers.map(p => [p.id, p]))
// Bench = pick.position >= 12 (SquadView line 144)
const isBench = pick.position >= 12
```

**Pitch layout (Claude's discretion — CSS Grid, Tailwind v4):**
```tsx
{/* Outer pitch container */}
<div className="relative rounded-lg bg-emerald-950 p-4 space-y-2">
  {/* Rows from top (FWD) to bottom (GK) for visual FPL convention */}
  {/* Each row: flex justify-center gap-x-4 */}
  {/* Player circle: w-16 h-16 rounded-full bg-white/10 flex flex-col items-center justify-center */}
  {/* web_name: text-xs font-medium text-white truncate */}
  {/* xPts: text-[10px] text-white/70 */}
</div>
{/* Bench row below pitch */}
<div className="flex gap-2 mt-4 justify-center">
  {/* bench[0] GK slot visually separated by border-r or gap */}
  {/* bench[1..3] outfield bench */}
</div>
```

---

### `src/app/page.tsx` (controller — surgical edits)

**Analog:** `src/app/page.tsx` (self)

**SubTab union — current (line 23):**
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy'
```
**After D-06 (add two values):**
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy' | 'transfers' | 'optimiser'
```

**SECTIONS Squad entry — current (lines 48-53):**
```typescript
{
  id: 'squad' as Section,
  label: 'Squad',
  subTabs: [],
  defaultSubTab: null,
},
```
**After D-06:**
```typescript
{
  id: 'squad' as Section,
  label: 'Squad',
  subTabs: [
    { id: 'transfers' as SubTab, label: 'Transfers', mobileLabel: 'Transfers' },
    { id: 'optimiser' as SubTab, label: 'Optimiser', mobileLabel: 'Optimiser' },
  ],
  defaultSubTab: 'transfers' as SubTab,
},
```

**sectionMemory initial state — current (lines 58-62):**
```typescript
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems',
  plan: 'planner',
  squad: null,
})
```
**After D-07:**
```typescript
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems',
  plan: 'planner',
  squad: 'transfers',
})
```

**teamId / submittedId state to add (D-11) — after existing state declarations (line 65):**
```typescript
const [teamId, setTeamId] = useState<string>(() =>
  typeof window !== 'undefined' ? (localStorage.getItem('fpl_team_id') ?? '') : ''
)
const [submittedId, setSubmittedId] = useState<string | null>(() =>
  typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null
)
const handleTeamIdSubmit = () => {
  if (teamId.trim()) {
    setSubmittedId(teamId.trim())
    localStorage.setItem('fpl_team_id', teamId.trim())
  }
}
```

**Desktop sub-tab guard — current (lines 109-126):**
```typescript
{activeSection !== 'squad' && (() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  return (
    <nav aria-label={`${activeSectionDef.label} sub-tabs`} ...>
      ...
    </nav>
  )
})()}
```
**After D-08 — remove the `activeSection !== 'squad'` guard; let `subTabs.length > 0` drive rendering:**
```typescript
{(() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  if (activeSectionDef.subTabs.length === 0) return null
  return (
    <nav aria-label={`${activeSectionDef.label} sub-tabs`} className="hidden sm:flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-700">
      {activeSectionDef.subTabs.map((sub) => (
        <button key={sub.id} ... onClick={() => handleSubTabChange(sub.id)}>
          {sub.label}
        </button>
      ))}
    </nav>
  )
})()}
```

**Squad spacer to REMOVE (line 129):**
```typescript
{/* DELETE this line: */}
{activeSection === 'squad' && <div className="mb-6 hidden sm:block" />}
```

**Content render guards — current (line 132):**
```typescript
{activeSection === 'squad' && <TransferPanel />}
```
**After D-09 + D-11:**
```typescript
{activeSection === 'squad' && activeSubTab === 'transfers' && (
  <TransferPanel
    teamId={teamId}
    onTeamIdChange={setTeamId}
    submittedId={submittedId}
    onSubmit={handleTeamIdSubmit}
  />
)}
{activeSection === 'squad' && activeSubTab === 'optimiser' && (
  <OptimiserPanel submittedId={submittedId} />
)}
```

**Other content guards pattern — unchanged shape (lines 133-152):**
```typescript
{activeSection !== 'squad' && activeSubTab === 'gems' && ( ... )}
{activeSection !== 'squad' && activeSubTab === 'defcon' && <DefConTables />}
// etc. — these guards are unchanged; the 'squad' exclusion remains correct for non-squad content
```

---

### `src/components/nav/MobileNav.tsx` (component, event-driven — guard removal)

**Analog:** `src/components/nav/MobileNav.tsx` (self)

**Current pill-row guard (line 18):**
```typescript
{activeSection !== 'squad' && (() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  return (
    <div className="flex gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
      {activeSectionDef.subTabs.map((sub) => (
        <button
          key={sub.id}
          className={`px-3 py-1 text-xs font-medium rounded-full active:scale-95 transition-transform ${activeSubTab === sub.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
          onClick={() => onSubTabChange(sub.id)}
          aria-current={activeSubTab === sub.id ? 'page' : undefined}
        >
          {sub.mobileLabel}
        </button>
      ))}
    </div>
  )
})()}
```
**After D-10 — remove `activeSection !== 'squad'` guard; use `subTabs.length > 0`:**
```typescript
{(() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  if (activeSectionDef.subTabs.length === 0) return null
  return (
    <div className="flex gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
      {activeSectionDef.subTabs.map((sub) => (
        <button
          key={sub.id}
          className={`px-3 py-1 text-xs font-medium rounded-full active:scale-95 transition-transform ${activeSubTab === sub.id ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
          onClick={() => onSubTabChange(sub.id)}
          aria-current={activeSubTab === sub.id ? 'page' : undefined}
        >
          {sub.mobileLabel}
        </button>
      ))}
    </div>
  )
})()}
```

**Section button row is unchanged** (lines 35-46 of MobileNav.tsx — no modification).

---

### `src/components/transfers/TransferPanel.tsx` (component — controlled refactor, D-11)

**Analog:** `src/components/transfers/TransferPanel.tsx` (self)

**Current state to lift (lines 19-26):**
```typescript
const [teamId, setTeamId] = useState<string>(() =>
  typeof window !== 'undefined' ? (localStorage.getItem('fpl_team_id') ?? '') : ''
)
const [submittedId, setSubmittedId] = useState<string | null>(() =>
  typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null
)
```

**State that stays in TransferPanel (do NOT lift):**
```typescript
const [freeTransfers, setFreeTransfers] = useState<number>(1)
const [isModalOpen, setIsModalOpen] = useState(false)
```

**Props interface to add:**
```typescript
interface TransferPanelProps {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
}
```

**handleSubmit to remove from TransferPanel (line 84-90) — replaced by `onSubmit` prop:**
```typescript
// REMOVE from TransferPanel:
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  if (teamId.trim()) {
    setSubmittedId(teamId.trim())
    localStorage.setItem('fpl_team_id', teamId.trim())
  }
}
// REPLACE form onSubmit with: onSubmit() call (parent handles localStorage + state)
```

**useSquad call stays in TransferPanel** (line 28) — uses the now-prop `submittedId`:
```typescript
const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
```

**Input binding change** (line 109-110):
```typescript
// BEFORE: value={teamId} onChange={e => setTeamId(e.target.value)}
// AFTER:  value={teamId} onChange={e => onTeamIdChange(e.target.value)}
```

---

### `src/app/page.test.tsx` (test — update Squad assertions)

**Analog:** `src/app/page.test.tsx` (self)

**Mock to add** (after existing vi.mock calls, before `import Home`):
```typescript
vi.mock('@/components/optimiser/OptimiserPanel', () => ({
  OptimiserPanel: () => <div data-testid="optimiser-panel" />,
}))
```

**TransferPanel mock signature update** (line 16 — mock must accept new props):
```typescript
// BEFORE:
vi.mock('@/components/transfers/TransferPanel', () => ({ TransferPanel: () => <div data-testid="transfer-panel" /> }))
// AFTER (props accepted but ignored in mock — same render):
vi.mock('@/components/transfers/TransferPanel', () => ({ TransferPanel: (_props: any) => <div data-testid="transfer-panel" /> }))
```

**Test "Squad section renders only TransferPanel" update** (lines 116-128):
```typescript
// Test description update: Squad shows Transfers sub-tab by default
it('Squad section default sub-tab is Transfers; TransferPanel visible, OptimiserPanel hidden (D-05, D-07)', () => {
  const { container } = render(<Home />)
  const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
  fireEvent.click(squadBtn!)
  // TransferPanel visible (default sub-tab = 'transfers')
  expect(container.querySelector('[data-testid="transfer-panel"]')).not.toBeNull()
  // OptimiserPanel NOT visible until Optimiser sub-tab is clicked
  expect(container.querySelector('[data-testid="optimiser-panel"]')).toBeNull()
  // Squad sub-tab nav IS now present (D-08)
  expect(container.querySelector('nav[aria-label="Squad sub-tabs"]')).not.toBeNull()
})
```

**New test for Optimiser sub-tab (NAV-01):**
```typescript
it('Squad Optimiser sub-tab shows OptimiserPanel, hides TransferPanel (NAV-01, D-09)', () => {
  const { container } = render(<Home />)
  const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
  fireEvent.click(squadBtn!)
  const optimiserBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Optimiser')
  fireEvent.click(optimiserBtn!)
  expect(container.querySelector('[data-testid="optimiser-panel"]')).not.toBeNull()
  expect(container.querySelector('[data-testid="transfer-panel"]')).toBeNull()
})
```

**Existing test checks for `nav[aria-label="Analyse sub-tabs"]` being null when Squad is active** (line 54):
```typescript
// This assertion remains valid — Squad sub-tab nav uses aria-label="Squad sub-tabs",
// so Analyse sub-tabs nav is still absent when Squad is active. No change needed here.
```

---

### `src/components/nav/MobileNav.test.tsx` (test — update NAV-04)

**Analog:** `src/components/nav/MobileNav.test.tsx` (self)

**NAV-04 test to REPLACE** (lines 70-80 — currently asserts Squad has NO pill row):
```typescript
// BEFORE (delete this entire test):
it('Squad active: pill row is absent, only 3 section buttons remain in DOM (NAV-04)', () => {
  const { container } = render(<MobileNav {...makeProps({ activeSection: 'squad' as Section, activeSubTab: null })} />)
  const allButtons = container.querySelectorAll('button')
  expect(allButtons).toHaveLength(3)
  ...
})

// AFTER (replace with):
it('Squad active: pill row shows 2 pills Transfers and Optimiser (NAV-04)', () => {
  const { container } = render(
    <MobileNav {...makeProps({ activeSection: 'squad' as Section, activeSubTab: 'transfers' as SubTab })} />
  )
  const allButtons = Array.from(container.querySelectorAll('button'))
  const pillButtons = allButtons.filter(b => ['Transfers', 'Optimiser'].includes(b.textContent ?? ''))
  expect(pillButtons).toHaveLength(2)
  expect(pillButtons[0].textContent).toBe('Transfers')
  expect(pillButtons[1].textContent).toBe('Optimiser')
  // Transfers pill has aria-current (it is the active sub-tab)
  expect(pillButtons[0].getAttribute('aria-current')).toBe('page')
  expect(pillButtons[1].getAttribute('aria-current')).not.toBe('page')
  // 3 section buttons + 2 Squad pills = 5 total
  expect(allButtons).toHaveLength(5)
})
```

**makeProps helper — no change needed** (lines 8-16): accepts `SubTab | null`, Squad can pass `'transfers' as SubTab`.

---

### `src/lib/optimise-lineup.test.ts` (test — new file)

**Analog:** `src/lib/chip-strategy-engine.test.ts`

**File header pattern** (chip-strategy-engine.test.ts lines 1-12):
```typescript
// Phase 43: optimise-lineup engine — pure function unit tests
import { describe, it, expect } from 'vitest'
import { optimiseLineup } from './optimise-lineup'
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'
```

**Player factory function pattern** (chip-strategy-engine.test.ts lines 38-92):
```typescript
function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

function makePlayer(overrides: Partial<MergedPlayer> & { id: number; element_type: 1|2|3|4 }): MergedPlayer {
  const base: MergedPlayer = {
    id: overrides.id,
    web_name: `P${overrides.id}`,
    element_type: overrides.element_type,
    team: 1,
    team_short_name: 'T1',
    now_cost: 50,
    status: 'a',
    xPts_1gw: 5.0,
    xPts_3gw: 14.0,
    xPts_5gw: 22.0,
    xPts_90th_1gw: 7.0,
    // ... all required MergedPlayer fields with sensible defaults
  }
  return { ...base, ...overrides } as MergedPlayer
}
```

**Describe block structure** (chip-strategy-engine.test.ts lines 98-111):
```typescript
describe('Phase 43: optimise-lineup', () => {
  describe('optimiseLineup — basic (OPT-01)', () => {
    it('returns starters of length 11 and bench of length 4 from a valid 15-player squad', () => { ... })
    it('returns a valid FPL formation string (e.g. 4-3-3)', () => { ... })
  })
  describe('horizon scoring (OPT-02)', () => { ... })
  describe('captain / VC selection (OPT-03)', () => { ... })
  describe('bench ordering (OPT-04)', () => { ... })
  describe('BGW exclusion (OPT-05)', () => { ... })
})
```

**Null-safe assertion for optional fields** (chip-strategy-engine.test.ts line 49):
```typescript
xPts_90th_1gw: undefined,  // test optional field absence
```

---

### `src/components/optimiser/OptimiserPanel.test.tsx` (test — new stub file)

**Analog:** `src/app/page.test.tsx` (mock + render pattern)

**File header and mock pattern:**
```typescript
// Phase 43: OptimiserPanel — Wave 0 stub tests
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/hooks/useSquad', () => ({
  useSquad: () => ({ data: undefined, isLoading: false, error: null }),
}))
vi.mock('@/lib/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: [], isLoading: false }),
}))

import { OptimiserPanel } from '@/components/optimiser/OptimiserPanel'
```

**Wave 0 stub test** (minimal — just verifies component renders without crash):
```typescript
describe('Phase 43: OptimiserPanel (Wave 0 stubs)', () => {
  it('renders without error when no squad loaded (submittedId null)', () => {
    const { container } = render(<OptimiserPanel submittedId={null} />)
    expect(container).not.toBeNull()
  })
})
```

---

## Shared Patterns

### Authentication / localStorage Init
**Source:** `src/components/transfers/TransferPanel.tsx` lines 19-26
**Apply to:** `page.tsx` (when lifting teamId/submittedId state)
```typescript
const [teamId, setTeamId] = useState<string>(() =>
  typeof window !== 'undefined' ? (localStorage.getItem('fpl_team_id') ?? '') : ''
)
const [submittedId, setSubmittedId] = useState<string | null>(() =>
  typeof window !== 'undefined' ? localStorage.getItem('fpl_team_id') : null
)
```

### Error Banner (Red)
**Source:** `src/components/transfers/TransferPanel.tsx` lines 207-210
**Apply to:** `OptimiserPanel.tsx` error state
```typescript
<div className="rounded border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
  {error instanceof Error ? error.message : String(error)}
</div>
```

### Amber Warning Banner (BGW)
**Source:** `src/components/transfers/TransferPanel.tsx` lines 237-240
**Apply to:** `OptimiserPanel.tsx` BGW warning (D-16, OPT-05)
```typescript
<div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200">
  <span className="font-semibold">BGW warning</span> — fewer than 11 eligible players...
</div>
```

### Loading State
**Source:** `src/components/transfers/TransferPanel.tsx` lines 200-204
**Apply to:** `OptimiserPanel.tsx` loading state
```typescript
{isLoading && submittedId && (
  <div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
    Loading squad...
  </div>
)}
```

### TanStack Query hook with 5-min stale time
**Source:** `src/lib/hooks/useSquad.ts` lines 13-21
**Apply to:** `OptimiserPanel.tsx` (calls `useSquad(submittedId)` directly — cache is shared)
```typescript
// No new hook needed. Call useSquad(submittedId) in OptimiserPanel.
// Query key ['squad', teamId] deduplicates with TransferPanel's identical call.
const { data: squadData, isLoading, error } = useSquad(submittedId)
```

### Sub-tab navigation IIFE render pattern
**Source:** `src/app/page.tsx` lines 109-126 and `src/components/nav/MobileNav.tsx` lines 18-34
**Apply to:** Both files during D-08 / D-10 guard removal
```typescript
// IIFE pattern: used in both files to scope activeSectionDef
{(() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  if (activeSectionDef.subTabs.length === 0) return null
  return ( ... )
})()}
```

### Bench pick detection
**Source:** `src/components/squad/SquadView.tsx` line 144
**Apply to:** `src/lib/optimise-lineup.ts` (derive bench from initial picks)
```typescript
const isBench = pick.position >= 12  // positions 12-15 = bench (FPL convention)
```

### Captain / VC text labels
**Source:** `src/components/squad/SquadView.tsx` lines 161-165
**Apply to:** `src/components/optimiser/OptimiserPanel.tsx` player circles on pitch
```typescript
<span className="ml-1 text-xs font-bold text-amber-600 dark:text-amber-400">(C)</span>
<span className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">(VC)</span>
```

### Pure engine no-React discipline
**Source:** `src/lib/chip-strategy-engine.ts` (entire file — no 'use client', no React imports)
**Apply to:** `src/lib/optimise-lineup.ts`
Rule: zero React imports, zero side effects, all functions pure and independently testable.

---

## No Analog Found

All files have direct analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/app/`
**Files scanned:** 12 (chip-strategy-engine.ts, chip-strategy-engine.test.ts, types.ts, squad-adapter.ts, page.tsx, page.test.tsx, MobileNav.tsx, MobileNav.test.tsx, TransferPanel.tsx, GwToggle.tsx, SquadView.tsx, CaptainPicksPanel.tsx, useSquad.ts)
**Pattern extraction date:** 2026-04-30
