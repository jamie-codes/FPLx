# Phase 65: Rejection Explainer - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 9 (6 modify, 3 new)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/explain.ts` | utility | transform | `src/lib/sensitivity.ts` | exact — exported constants + pure function, same ScoredPlayer input |
| `src/components/gem-table/GemTable.tsx` | component | request-response | self (GemTable.tsx existing) | self-extension — Fragment sibling row pattern already present |
| `src/components/squad/ExplainPanel.tsx` | component | request-response | self (ExplainPanel.tsx existing) | self-extension — prop addition + section insertion |
| `src/components/squad/SquadView.tsx` | component | request-response | self (SquadView.tsx existing) | self-extension — prop threading pattern; `exactSellPrices` flow is the model |
| `src/components/transfers/TransferPanel.tsx` | component | request-response | self (TransferPanel.tsx existing) | self-extension — useMemo derivation + component insertion above OpportunityCostTable |
| `src/components/transfers/HighOwnershipCallout.tsx` | component | request-response | `src/components/shared/FragilityNote.tsx` | role-match — new display-only component, early-return-null when empty |
| `src/lib/__tests__/rejection.test.ts` | test | — | `src/lib/__tests__/sensitivity.test.ts` | exact — same pure-function test structure, same `makePlayer` fixture factory |
| `src/components/transfers/HighOwnershipCallout.test.tsx` | test | — | `src/components/shared/FragilityNote.test.tsx` | exact — RTL component test, same `render` + `container.querySelector` pattern |
| `src/components/squad/ExplainPanel.test.tsx` | test | — | `src/components/squad/ProseSummaryBlock.test.tsx` | role-match — RTL test for a squad display component with prop variations |

---

## Pattern Assignments

### `src/lib/explain.ts` — add `computeRejection` (utility, transform)

**Analog:** `src/lib/sensitivity.ts` (exact match — same pattern: exported threshold constants + exported interface + exported pure function)

**Existing file header / imports** (`src/lib/explain.ts` lines 1–13):
```typescript
import type { ScoredPlayer } from '@/lib/types'

// Threshold constants (exported for test visibility, matching recommend.ts pattern)
export const FORM_POSITIVE_THRESHOLD = 5.0
export const FORM_NEGATIVE_THRESHOLD = 3.0
export const START_PROB_HIGH = 0.85
export const START_PROB_LOW = 0.65
export const XG_HIGH = 0.30
export const XG_LOW = 0.05
export const XA_HIGH = 0.15
export const DIFFERENTIAL_THRESHOLD = 10.0
export const EASY_FIXTURE_MIN = 2
export const HARD_FIXTURE_MIN = 3
```

**New imports to add** (add after line 1):
```typescript
import { computeFragility } from '@/lib/sensitivity'
import { computePositionAverages } from '@/lib/recommend'
```

**Core function pattern from analog** (`src/lib/sensitivity.ts` lines 11–42):
```typescript
// Exported interface + exported threshold constants + exported pure function
export interface FragilityResult {
  fragile: boolean
  reasons: string[]
}

export function computeFragility(
  player: MergedPlayer,
  isTransfer: boolean,
  xPtsGain?: number,
): FragilityResult {
  const reasons: string[] = []
  if (player.start_prob < 0.70) {
    reasons.push('start_prob < 70%')
  }
  if (player.fixtures.length > 0 && player.fixtures[0].difficulty_tier === 'medium') {
    reasons.push('harder fixture')
  }
  if (isTransfer && xPtsGain !== undefined && xPtsGain < 4.0) {
    reasons.push('taken as a hit (-4pt)')
  }
  return { fragile: reasons.length > 0, reasons }
}
```

**`selected_by_percent` string guard** (`src/lib/explain.ts` line 67):
```typescript
// parseFloat — selected_by_percent is a string in MergedPlayer/ScoredPlayer
const owned = parseFloat(player.selected_by_percent)
```

**New code to add after `computeExplanations`:**

New constants block:
```typescript
export const REJECTION_START_PROB_THRESHOLD = 0.70
export const REJECTION_OWNERSHIP_THRESHOLD = 20.0

const POSITION_CODES: Record<number, string> = {
  1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD',
}

export interface RejectionResult {
  reasons: string[]   // empty array when no rejection signals (adaptive positive framing)
  xPtsRank: number    // 1-based rank within position by xPts_1gw
}
```

Core function structure:
```typescript
export function computeRejection(
  player: ScoredPlayer,
  allPlayers: ScoredPlayer[],
): RejectionResult {
  // 1. Rank within position by xPts_1gw descending (D-05)
  const samePosition = allPlayers
    .filter(p => p.element_type === player.element_type)
    .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
  const xPtsRank = samePosition.findIndex(p => p.id === player.id) + 1

  // 2. Adaptive framing threshold (gem_score >= posAvg AND no fragility AND start_prob >= threshold)
  const positionAverages = computePositionAverages(allPlayers)
  const posAvg = positionAverages.get(player.element_type) ?? 0.5
  const { reasons: fragilityReasons } = computeFragility(player, false)  // isTransfer=false (D-06 / Pitfall 4)

  const isStrong =
    player.gem_score >= posAvg &&
    fragilityReasons.length === 0 &&
    player.start_prob >= REJECTION_START_PROB_THRESHOLD

  if (isStrong) {
    return { reasons: [], xPtsRank }   // positive framing — caller renders "No rejection signals" copy
  }

  const reasons: string[] = []
  const posCode = POSITION_CODES[player.element_type] ?? '??'

  // Signal order: rank, start_prob, fixture, fragility, ownership (D-07)
  reasons.push(`Ranked #${xPtsRank} at ${posCode} by xPts`)
  if (player.start_prob < REJECTION_START_PROB_THRESHOLD) {
    reasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
  }
  if (player.fixtures.length > 0 &&
      (player.fixtures[0].difficulty_tier === 'medium' || player.fixtures[0].difficulty_tier === 'hard')) {
    reasons.push(`Difficult fixture (FDR ${player.fixtures[0].difficulty_tier})`)
  }
  for (const r of fragilityReasons) {
    reasons.push(`Fragile: no longer recommended if: ${r}`)
  }
  // Ownership context — always last (parseFloat per Pitfall 2)
  const owned = Math.round(parseFloat(player.selected_by_percent))
  reasons.push(`Owned by ${owned}% of managers`)

  return { reasons, xPtsRank }
}
```

---

### `src/components/gem-table/GemTable.tsx` — getRowCanExpand + desktop expand row (component, request-response)

**Analog:** Self — the existing mobile expand row at lines 214–259 is the pattern to replicate for desktop.

**Line to change** (`GemTable.tsx` line 114):
```typescript
// BEFORE:
getRowCanExpand: () => isMobile,
// AFTER:
getRowCanExpand: () => true,
```

**onClick change** (`GemTable.tsx` lines 193–199):
```typescript
// BEFORE:
onClick={() => {
  if (isMobile) {
    row.toggleExpanded()
    setActionSheetPlayer(row.original)
  }
}}
// AFTER — desktop toggle expand unconditionally; action-sheet stays mobile-only:
onClick={() => {
  row.toggleExpanded()
  if (isMobile) {
    setActionSheetPlayer(row.original)
  }
}}
```

**tr class pattern** (`GemTable.tsx` line 193):
```typescript
// Make cursor-pointer unconditional (was mobile-only):
className={`even:bg-gray-50 dark:even:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700 cursor-pointer active:bg-blue-100`}
```

**Existing mobile expand row** (`GemTable.tsx` lines 214–259) — preserved unchanged as sibling:
```tsx
{row.getIsExpanded() && (
  <tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">
    <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
      {/* action-sheet buttons */}
      {actionSheetPlayer?.id === row.original.id && (
        <div className="flex gap-2 mt-1 sm:hidden"> ... </div>
      )}
      {/* hidden-column dl — mobile only */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm"> ... </dl>
      {/* WHY-01 rejection panel APPENDED here (D-03) */}
    </td>
  </tr>
)}
```

**New desktop expand row** — sibling after existing mobile row (D-02, Pitfall 5):
```tsx
{/* NEW — desktop expand row: rejection panel only, no hidden column duplication (D-02) */}
{row.getIsExpanded() && (
  <tr className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row">
    <td colSpan={row.getVisibleCells().length} className="px-3 py-3">
      {/* WHY-01 rejection panel — see RejectionPanel markup pattern below */}
    </td>
  </tr>
)}
```

**Fragment structure** (`GemTable.tsx` lines 191–261) — the outer Fragment already wraps both rows; new desktop row slots in as third sibling:
```tsx
<Fragment key={row.id}>
  <tr ...> {/* data row */} </tr>
  {row.getIsExpanded() && (
    <tr className="bg-blue-50 dark:bg-blue-950 sm:hidden"> {/* mobile */} </tr>
  )}
  {row.getIsExpanded() && (
    <tr className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row"> {/* desktop */} </tr>
  )}
</Fragment>
```

**Inline rejection panel markup** (from UI-SPEC and RESEARCH.md Pattern 3) — used inside both expand rows:
```tsx
// Positive framing (reasons array is empty from computeRejection):
<p className="text-xs text-green-700 dark:text-green-200">
  No rejection signals — ranked #{result.xPtsRank} at {posCode} by xPts ({(player.xPts_1gw ?? 0).toFixed(1)} pts projected)
</p>

// Rejection reasons list (reasons array is non-empty):
<div className="mt-2 space-y-1">
  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
  <ul className="space-y-0.5">
    {result.reasons.map((line, i) => (
      <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{line}</li>
    ))}
  </ul>
</div>
```

**Call site** — pass the GemTable's existing `scoredPlayers` useMemo:
```typescript
// At line 60: const scoredPlayers = useMemo(() => computeAllGemScores(data ?? []), [data])
// In the expand row:
const result = computeRejection(row.original, scoredPlayers)
```

---

### `src/components/squad/ExplainPanel.tsx` — add `rejectionReasons` prop + section (component, request-response)

**Analog:** Self — prop addition follows the same optional-prop pattern as `shortlist: ShortlistEntry[] | null`.

**Current props interface** (`ExplainPanel.tsx` lines 5–8):
```typescript
interface ExplainPanelProps {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
}
```

**Modified interface:**
```typescript
interface ExplainPanelProps {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
  rejectionReasons?: string[]   // Phase 65 WHY-03 — renders below positive reasons (D-08)
}
```

**Current render structure** (`ExplainPanel.tsx` lines 12–42) — note render order:
```tsx
<div className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-700 px-3 py-2 space-y-2">
  {/* 1. Positive reasons */}
  <ul className="space-y-0.5">
    {reasons.map((reason, i) => (
      <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{reason}</li>
    ))}
  </ul>
  {/* 2. [NEW] Rejection reasons — insert here, below positive, above shortlist (D-08) */}
  {/* 3. Shortlist section */}
  {shortlist !== null && shortlist.length > 0 && (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Replacement options</p>
      ...
    </div>
  )}
</div>
```

**New rejection section to insert between `</ul>` and `{shortlist`**:
```tsx
{rejectionReasons && rejectionReasons.length > 0 && (
  <div className="space-y-1">
    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why not recommended:</p>
    <ul className="space-y-0.5">
      {rejectionReasons.map((reason, i) => (
        <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">{reason}</li>
      ))}
    </ul>
  </div>
)}
```

**Styling source:** `text-xs font-medium text-zinc-500 dark:text-zinc-400` from `ExplainPanel.tsx` line 25 (shortlist header — identical). `text-xs text-zinc-600 dark:text-zinc-400` from `ExplainPanel.tsx` line 16 (positive reason items — identical).

---

### `src/components/squad/SquadView.tsx` — prop threading + per-player rejection compute (component, request-response)

**Analog:** Self — the `exactSellPrices` prop is the threading precedent. Read RESEARCH.md Pattern 5 for the confirmed interface shape.

**Current SquadViewProps** (`SquadView.tsx` lines 15–22):
```typescript
interface SquadViewProps {
  picks: SquadPick[]
  allPlayers: ScoredPlayer[]
  entryHistory: EntryHistory
  labels?: Map<number, LifecycleLabel>
  exactSellPrices?: Map<number, number>
  isAuthenticated?: boolean
}
```

**Modified interface** — add two props:
```typescript
interface SquadViewProps {
  picks: SquadPick[]
  allPlayers: ScoredPlayer[]
  entryHistory: EntryHistory
  labels?: Map<number, LifecycleLabel>
  exactSellPrices?: Map<number, number>
  isAuthenticated?: boolean
  verdicts?: Map<number, Verdict>                 // Phase 65 WHY-03
  captaincyCandidates?: CaptaincyCandidate[]      // Phase 65 WHY-03
}
```

**New imports to add** (`SquadView.tsx` lines 1–13 — add alongside existing imports):
```typescript
import { computeFragility } from '@/lib/sensitivity'
import { computeRejection } from '@/lib/explain'
import type { Verdict } from '@/lib/recommend'
import type { CaptaincyCandidate } from '@/lib/captaincy-engine'
```

**Existing expand section** (`SquadView.tsx` lines 220–233) — where rejection reasons computation inserts:
```typescript
// Existing (lines 221–229):
const reasons = computeExplanations(player)
const label = labels?.get(pick.element)
const shortlist = (label === 'sell' || label === 'sell_soon')
  ? computeReplacementShortlist(player, allPlayers, squadIds, entryHistory.bank)
  : null
return (
  <tr key={`expand-${pick.element}`}>
    <td colSpan={isMobile ? 4 : 9} className="px-0 py-0">
      <ExplainPanel reasons={reasons} shortlist={shortlist} />
    </td>
  </tr>
)
```

**Modified expand section** — add rejection reason derivation and pass prop:
```typescript
const reasons = computeExplanations(player)
const label = labels?.get(pick.element)
const shortlist = (label === 'sell' || label === 'sell_soon')
  ? computeReplacementShortlist(player, allPlayers, squadIds, entryHistory.bank)
  : null

// Phase 65 WHY-03 — per-player rejection reasons
const rejectionReasons: string[] = []
if (verdicts && captaincyCandidates) {
  const verdict = verdicts.get(player.id)
  if (verdict === 'sell' || verdict === 'hold') {
    if (verdict === 'sell') {
      rejectionReasons.push('Below xPts hold threshold — consider rotating')
    }
    const { reasons: fragReasons } = computeFragility(player, false)
    for (const r of fragReasons) {
      if (r === 'start_prob < 70%') {
        rejectionReasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
      } else if (r === 'harder fixture') {
        rejectionReasons.push('Difficult fixture this gameweek')
      }
    }
    // Captain rejection (D-09) — captaincyCandidates is CaptaincyCandidate[], access .player
    const capIndex = captaincyCandidates.findIndex(c => c.player.id === player.id)
    const topCap = captaincyCandidates[0]
    if (topCap && topCap.player.id !== player.id) {
      const rank = capIndex === -1 ? '?' : String(capIndex + 1)
      rejectionReasons.push(
        `Ranked #${rank} at ${POSITION_LABELS[player.element_type]} by xPts — ${topCap.player.web_name} is the captain pick`
      )
    }
  }
}

return (
  <tr key={`expand-${pick.element}`}>
    <td colSpan={isMobile ? 4 : 9} className="px-0 py-0">
      <ExplainPanel reasons={reasons} shortlist={shortlist} rejectionReasons={rejectionReasons} />
    </td>
  </tr>
)
```

**Existing `POSITION_LABELS` map** (`SquadView.tsx` lines 24–29) — already present, reuse for captain rejection copy:
```typescript
const POSITION_LABELS: Record<number, string> = {
  1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD',
}
```

---

### `src/components/transfers/TransferPanel.tsx` — HighOwnershipCallout insertion + prop threading (component, request-response)

**Analog:** Self — the `exactSellPrices` useMemo + SquadView prop pass at lines 84–87 / 263–270 is the prop-threading model.

**Existing `exactSellPrices` useMemo** (`TransferPanel.tsx` lines 84–87) — copy this pattern for the highOwnershipAbsent derivation:
```typescript
const exactSellPrices = useMemo(() => {
  if (!myTeamData) return new Map<number, number>()
  return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
}, [myTeamData])
```

**`ocsSuggestions` useMemo** (`TransferPanel.tsx` lines 100–110) — this is the "present" set for absence detection:
```typescript
const ocsSuggestions: TransferSuggestion[] = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return []
  return suggestTransfers({ currentPicks: squadData.picks, players: scoredPlayers, ... })
}, [squadData, scoredPlayers, ocsHorizon, ocsFtCount, exactSellPrices])
```

**New `highOwnershipAbsent` useMemo** — add after `ocsSuggestions`:
```typescript
const highOwnershipAbsent = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return []
  const squadIds = new Set(squadData.picks.map(p => p.element))
  const suggestedBuyIds = new Set(
    ocsSuggestions.flatMap(s =>
      // TransferSuggestion shapes: access buy.id per suggest-transfers.ts output
      'buy' in s ? [s.buy.id] : (s.transfers ?? []).map((t: { buy: { id: number } }) => t.buy.id)
    )
  )
  return scoredPlayers
    .filter(p => parseFloat(p.selected_by_percent) > 20)    // Pitfall 2: parseFloat
    .filter(p => !suggestedBuyIds.has(p.id))
    .sort((a, b) => parseFloat(b.selected_by_percent) - parseFloat(a.selected_by_percent))
    .slice(0, 3)   // Cap at 3 (D-13)
    .map(p => {
      const inSquad = squadIds.has(p.id)
      let squadRank: number | undefined
      if (inSquad) {
        const samePos = scoredPlayers
          .filter(x => squadIds.has(x.id) && x.element_type === p.element_type && x.pick?.position < 12)
          .sort((a, b) => (b.xPts_1gw ?? 0) - (a.xPts_1gw ?? 0))
        squadRank = samePos.findIndex(x => x.id === p.id) + 1
      }
      const posCode = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }[p.element_type] ?? '??'
      return { player: p, inSquad, squadRank, posCode }
    })
}, [squadData, scoredPlayers, ocsSuggestions])
```

**Existing SquadView render call** (`TransferPanel.tsx` lines 263–270) — add `verdicts` and `captaincyCandidates` props:
```tsx
// BEFORE:
<SquadView
  picks={squadData.picks}
  allPlayers={scoredPlayers}
  entryHistory={effectiveEntryHistory ?? squadData.entry_history}
  labels={lifecycleLabels}
  exactSellPrices={exactSellPrices}
  isAuthenticated={isAuthenticated}
/>
// AFTER — add verdicts and captaincyCandidates:
<SquadView
  picks={squadData.picks}
  allPlayers={scoredPlayers}
  entryHistory={effectiveEntryHistory ?? squadData.entry_history}
  labels={lifecycleLabels}
  exactSellPrices={exactSellPrices}
  isAuthenticated={isAuthenticated}
  verdicts={transferResult?.verdicts}       // from computeTransferSuggestions result (check type shape)
  captaincyCandidates={captaincyCandidates} // existing useMemo (line 79)
/>
```

**Insertion point for `<HighOwnershipCallout>`** — above OpportunityCostTable, inside the `{squadData && scoredPlayers.length > 0 && (<>` block, at line 302 (start of the OCS section `<div>`):
```tsx
{/* WHY-02 callout — above OpportunityCostTable (D-11) */}
<HighOwnershipCallout entries={highOwnershipAbsent} />

{/* OCS section — existing */}
<div className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
  ...
  <OpportunityCostTable rows={ocsRows} horizon={ocsHorizon} />
</div>
```

**New import to add:**
```typescript
import { HighOwnershipCallout } from '@/components/transfers/HighOwnershipCallout'
import { computeVerdicts } from '@/lib/recommend'
```

**Note on `verdicts` prop source:** `computeTransferSuggestions` returns a typed result object. If `verdicts` is not part of the returned object, compute it separately: `const verdicts = useMemo(() => squadData ? computeVerdicts(squadData.picks, scoredPlayers) : undefined, [squadData, scoredPlayers])`. The `captaincyCandidates` useMemo at line 79 is already computed.

---

### `src/components/transfers/HighOwnershipCallout.tsx` — new component (component, request-response)

**Analog:** `src/components/shared/FragilityNote.tsx` — new display-only component with early-return-null when input is empty; no hooks; pure render.

**FragilityNote pattern** (the whole file — 22 lines in total):
```tsx
'use client'
// props interface + named export function
// if (empty condition) return null
// return <jsx with data-testid>
```

**Full new component to create:**
```tsx
'use client'

import type { ScoredPlayer } from '@/lib/types'

interface HighOwnershipEntry {
  player: ScoredPlayer
  inSquad: boolean
  squadRank?: number
  posCode: string
}

interface HighOwnershipCalloutProps {
  entries: HighOwnershipEntry[]
}

export function HighOwnershipCallout({ entries }: HighOwnershipCalloutProps) {
  if (entries.length === 0) return null
  return (
    <div
      data-testid="high-ownership-callout"
      className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 space-y-1"
    >
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        &#8505;&#65039; Why aren&apos;t these players appearing?
      </p>
      {entries.map(entry => (
        <p key={entry.player.id} className="text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">{entry.player.web_name}</span>
          {' '}({Math.round(parseFloat(entry.player.selected_by_percent))}%):{' '}
          {entry.inSquad
            ? `Already ranked #${entry.squadRank ?? '?'} at ${entry.posCode} in your squad by xPts — no upgrade needed`
            : `xPts gain vs your ${entry.posCode} options is negative — not worth transferring in`}
        </p>
      ))}
    </div>
  )
}
```

**Styling sources:**
- Container: `bg-zinc-50 dark:bg-zinc-800` from `ExplainPanel.tsx` line 12 (same expand-row background)
- Border: `border border-zinc-200 dark:border-zinc-700` from `TransferPanel.tsx` lines 141/302
- Header: `text-sm font-medium text-zinc-700 dark:text-zinc-300` from `TransferPanel.tsx` line 305
- Body: `text-xs text-zinc-600 dark:text-zinc-400` from `ExplainPanel.tsx` line 16

---

## Test Pattern Assignments

### `src/lib/__tests__/rejection.test.ts` — new unit tests (test)

**Analog:** `src/lib/__tests__/sensitivity.test.ts` (exact match)

**File header / environment directive** (`sensitivity.test.ts` lines 1–3):
```typescript
// Phase 64 (SENS-01): computeFragility — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
```

**`makePlayer` fixture factory** (`sensitivity.test.ts` lines 7–62) — copy verbatim, add `gem_score` field needed for `computeRejection`:
```typescript
type PlayerOverrides = Partial<MergedPlayer> & {
  id: number
  element_type: 1 | 2 | 3 | 4
}

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
    haul_prob: undefined,
    p10_pts: undefined,
    p90_pts: undefined,
    blank_prob: undefined,
    ...overrides,
  } as MergedPlayer
}
```

**Note for `rejection.test.ts`:** `computeRejection` takes `ScoredPlayer[]`, not `MergedPlayer[]`. Use the same factory but cast or use a `makeScoredPlayer` variant that adds `gem_score` (a `ScoredPlayer`-only field). The `sensitivity.test.ts` factory works for `MergedPlayer`; for `ScoredPlayer` add `gem_score: 0.5` to the defaults.

**Fixture objects** (`sensitivity.test.ts` lines 64–78):
```typescript
const easyFixture: FixtureEntry = {
  opponent_team: 'BUR', is_home: true, event_id: 28,
  difficulty_score: 0.3, difficulty_tier: 'easy',
}
const mediumFixture: FixtureEntry = {
  opponent_team: 'ARS', is_home: false, event_id: 28,
  difficulty_score: 0.5, difficulty_tier: 'medium',
}
```

**Test structure** (`sensitivity.test.ts` lines 80–123):
```typescript
describe('computeRejection — Phase 65 WHY-01', () => {
  it('case 1: strong player returns empty reasons + correct rank', ...)
  it('case 2: below-average player gets rank reason', ...)
  it('case 3: rotation risk — start_prob below 0.70', ...)
  it('case 4: difficult fixture — medium tier included', ...)
  it('case 5: positive framing when gem_score >= posAvg AND no fragility AND start_prob >= 0.70', ...)
  it('case 6: selected_by_percent parsed as float (string "12.5" not raw string compare)', ...)
  it('case 7: BGW guard — empty fixtures array does not throw', ...)
})
```

---

### `src/components/transfers/HighOwnershipCallout.test.tsx` — new RTL tests (test)

**Analog:** `src/components/shared/FragilityNote.test.tsx` (exact match — same pattern: `@vitest-environment jsdom`, RTL `render`, `container.querySelector('[data-testid]')`)

**File header** (`FragilityNote.test.tsx` lines 1–5):
```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FragilityNote } from './FragilityNote'
```

**Adapted for HighOwnershipCallout:**
```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HighOwnershipCallout } from './HighOwnershipCallout'
```

**Test structure pattern** (`FragilityNote.test.tsx` lines 23–47 — empty state + content tests):
```typescript
it('renders nothing when empty', () => {
  const { container } = render(<FragilityNote reasons={[]} />)
  expect(container.firstChild).toBeNull()
  expect(container.querySelector('[data-testid="fragility-note"]')).toBeNull()
})
```

**Tests to write for HighOwnershipCallout:**
```typescript
describe('HighOwnershipCallout — Phase 65 WHY-02', () => {
  it('renders nothing when entries is empty', ...)
  it('renders callout header with info icon when entries present', ...)
  it('renders in-squad variant copy correctly', ...)
  it('renders not-in-squad variant copy correctly', ...)
  it('caps at 3 entries (caller responsibility, but renders all provided)', ...)
  it('parseFloat ownership displayed as rounded integer', ...)
})
```

---

### `src/components/squad/ExplainPanel.test.tsx` — new RTL tests (test)

**Analog:** `src/components/squad/ProseSummaryBlock.test.tsx` — RTL test for a squad display component with prop variations and conditional rendering.

**File header** (`ProseSummaryBlock.test.tsx` lines 1–3):
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
```

**Render + assertion pattern** (`ProseSummaryBlock.test.tsx` lines 39–44):
```typescript
it('renders prose when summary exists', () => {
  mockSummary({ prose: 'Salah leads.', gw: 35, generated_at: '...' })
  mockRefresh({})
  const { getByText } = render(<ProseSummaryBlock payload={SAMPLE_PAYLOAD} />)
  expect(getByText('Salah leads.')).toBeTruthy()
})
```

**Note:** `ExplainPanel` has no hooks to mock — use direct render with props. No `vi.mock` required.

**Tests to write for ExplainPanel:**
```typescript
describe('ExplainPanel — Phase 65 WHY-03', () => {
  it('renders positive reasons list', ...)
  it('renders rejection section when rejectionReasons is non-empty', ...)
  it('rejection section header reads "Why not recommended:"', ...)
  it('does not render rejection section when rejectionReasons is empty array', ...)
  it('does not render rejection section when rejectionReasons is undefined', ...)
  it('renders rejection section BELOW positive reasons (DOM order)', ...)
  it('renders replacement shortlist section last (below rejection)', ...)
})
```

**DOM order assertion pattern** — use `container.children` index comparison:
```typescript
it('renders rejection section below positive reasons', () => {
  const { container } = render(
    <ExplainPanel
      reasons={['Projected 6.5 pts next GW']}
      shortlist={null}
      rejectionReasons={['Ranked #5 at MID by xPts']}
    />
  )
  const sections = container.querySelectorAll('ul, div.space-y-1')
  // positive reasons <ul> must precede rejection <div>
  // ...
})
```

---

## Shared Patterns

### Tailwind Dark-Mode Pattern
**Source:** `src/components/squad/ExplainPanel.tsx` throughout; `src/components/gem-table/GemTable.tsx` line 215
**Apply to:** All new JSX in this phase
```
bg-zinc-50 dark:bg-zinc-800         — expand row / callout card background
border-zinc-200 dark:border-zinc-700 — card borders
text-zinc-600 dark:text-zinc-400     — body text (rejection lines)
text-zinc-500 dark:text-zinc-400     — muted section headers
text-zinc-700 dark:text-zinc-300     — callout header / heavier labels
bg-blue-50 dark:bg-blue-950          — GemTable expand row background (existing)
text-green-700 dark:text-green-200   — positive-framing "No rejection signals" text
```

### `parseFloat(player.selected_by_percent)` Guard
**Source:** `src/lib/explain.ts` line 67; `src/lib/recommend.ts` Pitfall comment
**Apply to:** Every comparison against `selected_by_percent` in `computeRejection`, `highOwnershipAbsent` useMemo, and `HighOwnershipCallout` display rendering
```typescript
const owned = parseFloat(player.selected_by_percent)   // NOT player.selected_by_percent > 20
```

### `computeFragility(player, false)` Call Convention
**Source:** `src/lib/sensitivity.ts` line 37; RESEARCH.md Pitfall 4
**Apply to:** All calls to `computeFragility` inside `computeRejection` and the SquadView WHY-03 rejection computation
```typescript
// isTransfer=false for ranking/ownership context — skips the hit-cost check
const { reasons: fragilityReasons } = computeFragility(player, false)
```

### `data-testid` on Component Root
**Source:** `src/components/shared/FragilityNote.test.tsx` line 12 (`[data-testid="fragility-note"]`)
**Apply to:** `HighOwnershipCallout` root `<div>` — add `data-testid="high-ownership-callout"` for test querying

### Optional Prop + Conditional Render
**Source:** `src/components/squad/ExplainPanel.tsx` lines 23–39 (shortlist conditional):
```tsx
{shortlist !== null && shortlist.length > 0 && (
  <div className="space-y-1">...</div>
)}
```
**Apply to:** `rejectionReasons` section in ExplainPanel; `HighOwnershipCallout` early-return-null

---

## No Analog Found

No files in this phase are without an analog. All 9 files have either an exact match or a strong role-match in the existing codebase.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/squad/`, `src/components/transfers/`, `src/components/gem-table/`, `src/components/shared/`, `src/lib/__tests__/`
**Files scanned:** 14 source files + 3 test files read in full
**Pattern extraction date:** 2026-05-06
