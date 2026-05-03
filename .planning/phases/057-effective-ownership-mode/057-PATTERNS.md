# Phase 57: Effective Ownership Mode - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 5 (2 rewritten, 1 new lib, 1 new test, 1 new component test)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/captaincy/CaptainPicksPanel.tsx` | component (rewrite) | request-response + event-driven | `src/components/captaincy/CaptaincyPanel.tsx` | role-match (same captaincy domain, same row pattern) |
| `src/lib/eo-candidates.ts` | utility (new) | transform | `src/lib/gem-score.ts` / `src/lib/captaincy-engine.ts` | role-match (pure MergedPlayer[] transform) |
| `src/lib/eo-candidates.test.ts` | test (new) | — | `src/lib/suggest-transfers.test.ts` | exact (pure lib unit test pattern) |
| `src/components/captaincy/CaptainPicksPanel.test.tsx` | test (new) | — | `src/components/optimiser/ChipModeToggle.test.tsx` | exact (RTL component test pattern) |
| `src/app/page.tsx` | config / mount (edit) | request-response | self — add `submittedId` prop to `<CaptainPicksPanel />` | surgical edit only |

---

## Pattern Assignments

### `src/components/captaincy/CaptainPicksPanel.tsx` (component, rewrite)

**Primary analog:** `src/components/captaincy/CaptaincyPanel.tsx`
**Secondary analog:** `src/components/optimiser/ChipModeToggle.tsx` (for the EOModeToggle sub-component)
**Tertiary analog:** `src/components/transfers/TransferPanel.tsx` lines 87–92 (for auth-gated useMemo)

**Imports pattern** — from current `CaptainPicksPanel.tsx` lines 1–4 + new hooks:
```typescript
'use client'

import { useState, useMemo } from 'react'
import { useCaptainPicks } from '@/lib/hooks/useCaptainPicks'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { useAuthStatus } from '@/lib/hooks/useAuthStatus'
import { useMyTeam } from '@/lib/hooks/useMyTeam'
import { computeEOCandidates } from '@/lib/eo-candidates'
import type { MergedPlayer } from '@/lib/types'
```

**Props interface** — new (replacing zero-prop signature at line 51):
```typescript
interface CaptainPicksPanelProps {
  submittedId?: string | null  // optional — badge gracefully hidden when absent
}
```

**EOMode type + toggle config** — copy pattern from `ChipModeToggle.tsx` lines 5–17:
```typescript
// ChipModeToggle.tsx lines 5–17 (copy structure, swap values)
type EOMode = 'max_xpts' | 'protect_rank' | 'chase_rank' | 'differential_aggressive'

const EO_MODES: { value: EOMode; label: string; testId: string }[] = [
  { value: 'max_xpts',                label: 'Max xPts',     testId: 'eo-toggle-max-xpts' },
  { value: 'protect_rank',            label: 'Protect Rank', testId: 'eo-toggle-protect-rank' },
  { value: 'chase_rank',              label: 'Chase Rank',   testId: 'eo-toggle-chase-rank' },
  { value: 'differential_aggressive', label: 'Differential', testId: 'eo-toggle-differential' },
]
```

**EOModeToggle sub-component** — copy verbatim from `ChipModeToggle.tsx` lines 19–48, adapting type and props:
```typescript
// ChipModeToggle.tsx lines 19–48 — exact structural copy:
function EOModeToggle({ value, onChange }: { value: EOMode; onChange: (v: EOMode) => void }) {
  return (
    <div className="flex items-center gap-2" data-testid="eo-mode-toggle">
      <div
        role="group"
        aria-label="Captain ranking mode"
        className="inline-flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
      >
        {EO_MODES.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={
              `min-h-[44px] px-3 text-xs font-semibold transition-colors ` +
              (value === opt.value
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700')
            }
            data-testid={opt.testId}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Auth-gated useMemo pattern** — from `TransferPanel.tsx` lines 87–92:
```typescript
// TransferPanel.tsx lines 87–92: derivedFtCount useMemo — mirror this exactly
const { isAuthenticated } = useAuthStatus()
const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)

const myTeamPickIds = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return new Set<number>()
  return new Set(myTeamData.picks.map(p => p.element))
}, [isAuthenticated, myTeamData])
```

**eoCandidates useMemo** — call `computeEOCandidates` from lib (do not inline logic):
```typescript
const { data: playersData } = usePlayers()
const { data: captainData } = useCaptainPicks()  // gameweek number only

const eoCandidates = useMemo(() => {
  if (!playersData) return []
  return computeEOCandidates(playersData, mode, 5)
}, [playersData, mode])
```

**CandidateRow sub-component** — copy row layout from `CaptaincyPanel.tsx` lines 51–89, add `~EO%` span and badge:
```typescript
// CaptaincyPanel.tsx lines 51–89 — row skeleton:
<div className="rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
  {/* Rank + player name row */}
  <div className="flex items-center gap-1.5">
    <span className="text-sm text-zinc-400 w-4 shrink-0">{rank}</span>
    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{candidate.web_name}</span>
    {/* EO% inline — D-05 / D-06 */}
    <span
      className="text-sm text-zinc-500 dark:text-zinc-400"
      title="Approximate effective ownership based on FPL selected_by_percent data."
    >
      ~{Math.round(parseFloat(candidate.selected_by_percent))}%
    </span>
    {/* Dangerous to fade badge — D-08 / D-09 / D-10 */}
    {showDangerBadge && (
      <span
        className="inline-block text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1"
        title="High ownership player not in your squad — fading risks rank damage."
      >
        Dangerous to fade
      </span>
    )}
  </div>
  {/* Fixture row — pattern from CaptaincyPanel.tsx lines 61–77 */}
  ...
</div>
```

**Badge trigger condition** (apply in CandidateRow or parent, per D-08 through D-11):
```typescript
const showDangerBadge =
  mode === 'protect_rank' &&
  isAuthenticated &&
  myTeamPickIds.size > 0 &&
  parseFloat(candidate.selected_by_percent) > 30 &&
  !myTeamPickIds.has(candidate.id)
```

**Loading / error states** — copy from existing `CaptainPicksPanel.tsx` lines 54–70:
```typescript
// CaptainPicksPanel.tsx lines 54–70 — exact pattern:
if (isLoading) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
      Loading captain picks…
    </p>
  )
}
if (error) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400 py-4">
      Failed to load captain picks. Check the pipeline output and refresh.
    </p>
  )
}
```

**Section wrapper + heading** — copy from `CaptainPicksPanel.tsx` lines 76–81:
```typescript
// CaptainPicksPanel.tsx lines 76–81 — section container pattern:
<section className="mt-6 space-y-3">
  <div className="space-y-1">
    <h2 className="text-lg font-semibold">Captain Picks — GW {captainData?.gameweek ?? '—'}</h2>
  </div>
  {/* EOModeToggle goes here, above the candidate list */}
  ...
</section>
```

**Badge styling** — copy from `CaptaincyPanel.tsx` lines 28–38 (CaptainTypeBadge amber variant):
```typescript
// CaptaincyPanel.tsx lines 28–38 — amber badge pattern:
className="inline-block text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1"
```

---

### `src/lib/eo-candidates.ts` (utility, transform — new file)

**Analog:** `src/lib/gem-score.ts` (pure MergedPlayer[] transform) + eligibility filter from `src/lib/captaincy-engine.ts` lines 70–78

**Imports pattern** — from `gem-score.ts` line 1:
```typescript
import type { MergedPlayer } from '@/lib/types'
```

**Eligibility filter** — from `captaincy-engine.ts` lines 70–78:
```typescript
// captaincy-engine.ts lines 70–78 — eligibility checks to replicate:
if (player.element_type === 1) continue          // exclude GKs
if (!player.xPts_1gw || player.xPts_1gw <= 0) continue  // exclude zero-projection
// For eo-candidates, also check status === 'a'
```

**Pure function export pattern** — from `gem-score.ts` (exported named function, no default export, no class):
```typescript
export type EOMode = 'max_xpts' | 'protect_rank' | 'chase_rank' | 'differential_aggressive'

export function computeEOCandidates(
  players: MergedPlayer[],
  mode: EOMode,
  topN = 5,
): MergedPlayer[] {
  const eligible = players.filter(
    p => p.status === 'a' &&
         p.element_type !== 1 &&
         p.xPts_1gw != null && p.xPts_1gw > 0
  )
  // ... sort/filter per mode (see RESEARCH.md Pattern 2)
}
```

**Median computation** — inline array sort + mid-index, no external library (per RESEARCH.md "Don't Hand-Roll"):
```typescript
const xptsValues = eligible.map(p => p.xPts_1gw ?? 0).sort((a, b) => a - b)
const mid = Math.floor(xptsValues.length / 2)
const median = xptsValues.length % 2 !== 0
  ? xptsValues[mid]
  : (xptsValues[mid - 1] + xptsValues[mid]) / 2
```

---

### `src/lib/eo-candidates.test.ts` (test, new file)

**Analog:** `src/lib/suggest-transfers.test.ts` (exact — pure lib unit test with vitest)

**File header + environment directive** — from `suggest-transfers.test.ts` lines 1–4:
```typescript
// Phase 57 (EO-01..EO-03): computeEOCandidates — pure-function unit tests.
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeEOCandidates } from './eo-candidates'
import type { MergedPlayer } from './types'
```

**makePlayer factory** — copy directly from `suggest-transfers.test.ts` lines 9–59 (full MergedPlayer shape):
```typescript
// suggest-transfers.test.ts lines 9–59 — factory to copy verbatim, adjust id/overrides typing:
type PlayerOverrides = Partial<MergedPlayer> & { id: number; element_type: 1 | 2 | 3 | 4 }
function makePlayer(overrides: PlayerOverrides): MergedPlayer {
  return {
    web_name: `P${overrides.id}`,
    selected_by_percent: '5.0',
    status: 'a',
    xPts_1gw: 5.0,
    xPts_90th_1gw: 7.0,
    // ... full shape from suggest-transfers.test.ts lines 14–58
    ...overrides,
  } as MergedPlayer
}
```

**Test structure** — from `suggest-transfers.test.ts` lines 75+:
```typescript
describe('Phase 57: computeEOCandidates', () => {
  describe('max_xpts mode', () => {
    it('sorts by xPts_1gw descending', () => { ... })
    it('returns at most 5 candidates', () => { ... })
  })
  describe('protect_rank mode', () => {
    it('sorts by selected_by_percent descending', () => { ... })
  })
  describe('chase_rank mode', () => {
    it('sorts by xPts_90th_1gw descending', () => { ... })
  })
  describe('differential_aggressive mode', () => {
    it('filters to above-median xPts then sorts by EO ascending', () => { ... })
    it('computes median from FULL eligible pool not the top-5 slice', () => { ... })
  })
  describe('eligibility filter', () => {
    it('excludes goalkeepers (element_type === 1)', () => { ... })
    it('excludes players with status !== "a"', () => { ... })
    it('excludes players with xPts_1gw <= 0 or null', () => { ... })
  })
})
```

---

### `src/components/captaincy/CaptainPicksPanel.test.tsx` (test, new file)

**Analog:** `src/components/optimiser/ChipModeToggle.test.tsx` (exact — RTL component test for a toggle component)

**File header + environment + imports** — from `ChipModeToggle.test.tsx` lines 1–7:
```typescript
// Phase 57 (EO-01..EO-04): CaptainPicksPanel RTL tests — RED in Wave 0, GREEN in Wave 2.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CaptainPicksPanel } from './CaptainPicksPanel'
```

**Mock pattern** — vi.mock for hooks (standard for RTL tests that call useQuery):
```typescript
vi.mock('@/lib/hooks/usePlayers', () => ({ usePlayers: vi.fn() }))
vi.mock('@/lib/hooks/useCaptainPicks', () => ({ useCaptainPicks: vi.fn() }))
vi.mock('@/lib/hooks/useAuthStatus', () => ({ useAuthStatus: vi.fn() }))
vi.mock('@/lib/hooks/useMyTeam', () => ({ useMyTeam: vi.fn() }))
```

**Test structure** — from `ChipModeToggle.test.tsx` lines 8–71:
```typescript
describe('CaptainPicksPanel — Wave 0 (RED)', () => {
  it('file exists and CaptainPicksPanel is exported', () => { ... })
  it('renders 4 toggle buttons with correct testIds', () => { ... })
  it('aria-pressed is true on active mode button', () => { ... })
  it('clicking a mode button updates active mode', () => { ... })
  it('displays ~XX% inline next to player name', () => { ... })
  it('"Dangerous to fade" badge visible when: protect_rank + auth + EO>30% + not in squad', () => { ... })
  it('"Dangerous to fade" badge hidden when unauthenticated', () => { ... })
  it('"Dangerous to fade" badge hidden when mode is not protect_rank', () => { ... })
})
```

---

### `src/app/page.tsx` (surgical edit only)

**Analog:** Self — pattern already established at lines 186–191 (TransferPanel with submittedId)

**Change is one line** — from page.tsx line 215:
```typescript
// BEFORE (page.tsx line 215):
<CaptainPicksPanel />

// AFTER:
<CaptainPicksPanel submittedId={submittedId} />
```

No structural change to the surrounding JSX fragment (lines 212–217). `submittedId` state already declared at line 102.

---

## Shared Patterns

### Dark-mode Colour Classes
**Source:** `src/components/captaincy/CaptainPicksPanel.tsx` lines 24, 32, 38; `CaptaincyPanel.tsx` lines 47, 53
**Apply to:** All new JSX in `CaptainPicksPanel.tsx`
```typescript
// Panel/card containers:
"rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4"
// Row containers:
"rounded border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2"
// Muted text:
"text-zinc-500 dark:text-zinc-400"
// Primary text:
"text-zinc-900 dark:text-zinc-100"
```

### Tooltip Convention
**Source:** `src/components/captaincy/CaptainPicksPanel.tsx` lines 25, 34 (TOOLTIPS pattern); `CaptaincyPanel.tsx` line 34
**Apply to:** EO% span (D-06) and any badge element
```typescript
// Always use title= attribute directly on the element — no custom tooltip component:
<span title="Approximate effective ownership based on FPL selected_by_percent data.">
  ~{Math.round(parseFloat(candidate.selected_by_percent))}%
</span>
```

### Toggle Segmented Control (aria pattern)
**Source:** `src/components/optimiser/ChipModeToggle.tsx` lines 19–48
**Apply to:** `EOModeToggle` sub-component inside `CaptainPicksPanel.tsx`
```typescript
// role="group" + aria-label wrapper; aria-pressed on each button; data-testid for tests
<div role="group" aria-label="Captain ranking mode" className="inline-flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700">
  {EO_MODES.map(opt => (
    <button aria-pressed={mode === opt.value} data-testid={opt.testId} ...>
```

### Auth-Gated useMemo
**Source:** `src/components/transfers/TransferPanel.tsx` lines 87–92
**Apply to:** `myTeamPickIds` derivation in `CaptainPicksPanel.tsx`
```typescript
const derivedX = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return <safe_default>
  return <computation using myTeamData>
}, [isAuthenticated, myTeamData])
```

### Pure Lib Function Shape
**Source:** `src/lib/gem-score.ts` line 1; `src/lib/suggest-transfers.ts` export pattern
**Apply to:** `src/lib/eo-candidates.ts`
```typescript
// No default export. Named export only. No class. Import only types from @/lib/types.
import type { MergedPlayer } from '@/lib/types'
export type EOMode = ...
export function computeEOCandidates(...): MergedPlayer[] { ... }
```

### Inline Badge Chip
**Source:** `src/components/captaincy/CaptaincyPanel.tsx` lines 28–37 (CaptainTypeBadge amber variant)
**Apply to:** `DangerousToFadeBadge` rendering in `CandidateRow`
```typescript
// Amber variant (upside badge) from CaptaincyPanel.tsx:
className="inline-block text-xs font-normal text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900 rounded px-2 py-1"
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/captaincy/`, `src/components/optimiser/`, `src/components/transfers/`, `src/lib/`, `src/app/`, `src/lib/hooks/`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-03
