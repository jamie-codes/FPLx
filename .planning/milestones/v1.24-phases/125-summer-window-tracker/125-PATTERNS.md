# Phase 125: Summer Window Tracker - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/shared/ConfirmedSigningBadge.tsx` | component | request-response | `src/components/shared/StatusLabelBadge.tsx` | exact |
| `src/components/shared/ConfirmedSigningBadge.test.tsx` | test | — | `src/components/shared/StatusLabelBadge.test.tsx` | exact |
| `src/components/news/SummerWindowTab.tsx` | component | request-response | `src/components/price-changes/PriceChangePanel.tsx` | role-match |
| `src/components/news/SummerWindowTab.test.tsx` | test | — | `src/components/shared/StatusLabelBadge.test.tsx` | role-match |
| `src/app/page.tsx` (modified) | config/routing | request-response | `src/app/page.tsx` lines 57–100, 284 | exact (self-analog) |
| `src/components/gem-table/GemTable.tsx` (modified) | component | request-response | `src/components/gem-table/GemTable.tsx` lines 372–413 | exact (self-analog) |
| `src/components/transfers/OpportunityCostTable.tsx` (modified) | component | request-response | `src/components/transfers/OpportunityCostTable.tsx` lines 141–145 | exact (self-analog) |

---

## Pattern Assignments

### `src/components/shared/ConfirmedSigningBadge.tsx` (component, request-response)

**Analog:** `src/components/shared/StatusLabelBadge.tsx`

**Imports pattern** (StatusLabelBadge.tsx lines 1–6):
```typescript
// Phase NNN: phase comment block with sources of truth
import type { StatusLabel } from '@/lib/types'
```

For ConfirmedSigningBadge:
```typescript
// Phase 125 WIN-02: ConfirmedSigningBadge — confirmed transfer news badge.
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-11, D-15
//   .planning/phases/125-summer-window-tracker/125-UI-SPEC.md §WIN-02
```

**Core badge pattern** (StatusLabelBadge.tsx lines 30–45):
```tsx
export function StatusLabelBadge({
  statusLabel,
}: {
  statusLabel: StatusLabel | undefined
}) {
  const config = statusLabel ? BADGE_MAP[statusLabel] : undefined
  if (!config) return null
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
```

ConfirmedSigningBadge is simpler (single state, no BADGE_MAP needed):
```tsx
export function ConfirmedSigningBadge({ tooltipText }: { tooltipText: string }) {
  return (
    <span
      className="inline-block text-xs font-normal text-green-800 bg-green-100 dark:bg-green-900 dark:text-green-200 rounded px-2 py-1"
      title={tooltipText}
    >
      Confirmed Signing
    </span>
  )
}
```

**Green colour token** (MinsRiskBadge.tsx lines 11–13 — "nailed" config):
```typescript
bg: 'bg-green-100 dark:bg-green-900',
text: 'text-green-800 dark:text-green-200',
```

**Shape contract** (MinsRiskBadge.tsx line 59):
```tsx
<span className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`} title={titleText}>
```

---

### `src/components/shared/ConfirmedSigningBadge.test.tsx` (test)

**Analog:** `src/components/shared/StatusLabelBadge.test.tsx`

**Test file header pattern** (StatusLabelBadge.test.tsx lines 1–6):
```typescript
// @vitest-environment jsdom
// Phase NNN UX-NN / D-NN — ComponentName contract tests
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusLabelBadge } from './StatusLabelBadge'
```

**Core test structure — render + className assertions + title attribute** (StatusLabelBadge.test.tsx lines 23–39):
```typescript
it('renders amber pill with "doubted" label for doubted', () => {
  const { container } = render(<StatusLabelBadge statusLabel="doubted" />)
  const span = container.querySelector('span')
  expect(span).not.toBeNull()
  expect(span?.textContent).toBe('doubted')
  expect(span?.className).toContain('bg-amber-100')
  expect(span?.className).toContain('inline-block')
  expect(span?.className).toContain('text-xs')
  expect(span?.className).toContain('font-normal')
  expect(span?.className).toContain('rounded')
  expect(span?.className).toContain('px-2')
  expect(span?.className).toContain('py-1')
  expect(span?.getAttribute('title')).toBe('...')
})
```

ConfirmedSigningBadge tests must cover:
1. Renders "Confirmed Signing" text
2. Has green classes (`bg-green-100`, `dark:bg-green-900`, `text-green-800`, `dark:text-green-200`)
3. Has shape classes (`inline-block`, `text-xs`, `font-normal`, `rounded`, `px-2`, `py-1`)
4. `title` attribute equals the `tooltipText` prop
5. Renders exactly one `<span>` element

---

### `src/components/news/SummerWindowTab.tsx` (component, request-response)

**Analog:** `src/components/price-changes/PriceChangePanel.tsx`

**Client directive + import pattern** (PriceChangePanel.tsx lines 1–4):
```typescript
'use client'

import { usePriceChanges } from '@/lib/hooks/usePriceChanges'
import type { PriceChangePrediction } from '@/lib/types'
```

For SummerWindowTab:
```typescript
'use client'

import { useState } from 'react'
import { useTransferNews } from '@/lib/hooks/useTransferNews'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import type { TransferClass } from '@/lib/types'
import { ConfirmedSigningBadge } from '@/components/shared/ConfirmedSigningBadge'
```

**Loading / error / empty state guards** (PriceChangePanel.tsx lines 31–58):
```tsx
export function PriceChangePanel() {
  const { data, isLoading, error } = usePriceChanges()

  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
        Loading price change predictions…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400 py-4">
        Failed to load price change data. Check the pipeline output and refresh.
      </p>
    )
  }

  if (!data || !data.predictions || data.predictions.length === 0) {
    return (
      <section className="mt-6 space-y-2" aria-label="...">
        ...
      </section>
    )
  }
  // main render
```

**Filter pills pattern** (AccuracyTab.tsx lines 254–298):
```typescript
type CalibrationPosition = 'all' | '1' | '2' | '3' | '4'

const POSITION_PILLS: ReadonlyArray<{ value: CalibrationPosition; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'GK' },
  // ...
]
```

```tsx
function PositionTabSelector({ value, onChange }) {
  return (
    <div role="tablist" aria-label="..." className="flex flex-wrap gap-2 mb-2">
      {POSITION_PILLS.map((pill) => {
        const active = pill.value === value
        const cls = active
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
        return (
          <button
            key={pill.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(pill.value)}
            className={`min-h-[44px] px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${cls}`}
          >
            {pill.label}
          </button>
        )
      })}
    </div>
  )
}
```

For SummerWindowTab, use `sm:min-h-0` per RESEARCH.md Pattern 6:
```typescript
import type { TransferClass } from '@/lib/types'

const PILLS = [
  { value: 'all' as const,               label: 'All'       },
  { value: 'confirmed_signing' as const, label: 'Confirmed' },
  { value: 'rumour' as const,            label: 'Rumour'    },
  { value: 'injury_return' as const,     label: 'Injury'    },
  { value: 'rotation_signal' as const,   label: 'Rotation'  },
] satisfies ReadonlyArray<{ value: TransferClass | 'all'; label: string }>

const [activeFilter, setActiveFilter] = useState<TransferClass | 'all'>('all')
```

**Stale banner pattern** (LastUpdated.tsx line 19 amber token; adapted per UI-SPEC):
```tsx
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

function StaleBanner({ scrapedAt }: { scrapedAt: string }) {
  const isStale = Date.now() - new Date(scrapedAt).getTime() > STALE_THRESHOLD_MS
  if (!isStale) return null
  return (
    <div className="flex items-center gap-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
      <span aria-hidden="true">⚠</span>
      Feed last updated {formatRelativeTime(scrapedAt)} — may not reflect latest news.
    </div>
  )
}
```

**Article sort** (RESEARCH.md Pattern 8 — spread before sort):
```typescript
const sorted = [...articles].sort((a, b) => {
  const ta = new Date(a.published ?? a.scraped_at).getTime()
  const tb = new Date(b.published ?? b.scraped_at).getTime()
  return tb - ta
})
```

**Empty state per filter** (matches PriceChangePanel empty state structure):
```tsx
if (filtered.length === 0) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
      No {activePillLabel} articles found.
    </div>
  )
}
```

---

### `src/app/page.tsx` (modified — SubTab union + SECTIONS + render condition)

**Analog:** `src/app/page.tsx` — self-analog

**SubTab union** (page.tsx line 57):
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'manual-plan' | 'route-tree' | 'club-form' | 'value-gems' | 'accuracy' | 'season' | 'decision' | 'transfers' | 'optimiser' | 'price-changes' | 'rivals' | 'lineup' | 'review' | 'rank-sim'
```
Add `'window'` to this union.

**SECTIONS array entry pattern** (page.tsx lines 70–71 — `season` and `price-changes` entries):
```typescript
{ id: 'season' as SubTab,        label: 'Season',          mobileLabel: 'Season'   },
{ id: 'price-changes' as SubTab, label: 'Price Changes',   mobileLabel: 'Prices'   },
```
Insert between these two:
```typescript
{ id: 'window' as SubTab,        label: 'Summer Window',   mobileLabel: 'Window'   },
```

**Render condition pattern** (page.tsx lines 283–285):
```tsx
{activeSection !== 'squad' && activeSubTab === 'accuracy' && <AccuracyTab teamId={submittedId} />}
{activeSection !== 'squad' && activeSubTab === 'season' && <SeasonReviewTab teamId={submittedId} />}
{activeSection !== 'squad' && activeSubTab === 'price-changes' && <PriceChangePanel />}
```
Add after the `season` render condition (line 284):
```tsx
{activeSection !== 'squad' && activeSubTab === 'window' && <SummerWindowTab />}
```

**Import addition** (page.tsx lines 27–28 — existing component imports):
```typescript
import { SeasonReviewTab } from '@/components/season-review/SeasonReviewTab'
import { PriceChangePanel } from '@/components/price-changes/PriceChangePanel'
```
Add:
```typescript
import { SummerWindowTab } from '@/components/news/SummerWindowTab'
```

---

### `src/components/gem-table/GemTable.tsx` (modified — badge injection in both expanded rows)

**Analog:** `src/components/gem-table/GemTable.tsx` — self-analog

**Hook call at component top** (RESEARCH.md Pattern 3 — mirrors existing `usePlayers()` pattern):
```typescript
// Call unconditionally at top of GemTable function component, alongside existing hooks
const { data: transferNews } = useTransferNews()
```

**Mobile expanded row badge slot** (GemTable.tsx lines 372–373):
```tsx
{/* Phase 93 SENS-01 (D-10): FragilityBadge after RowExpandNewsSection — viewing surface, isTransfer=false */}
{fragility.tier !== 'robust' ? <FragilityBadge tier={fragility.tier} reasons={fragility.reasons} /> : null}
```
Add after FragilityBadge:
```tsx
{/* Phase 125 WIN-02: ConfirmedSigningBadge after FragilityBadge — confirmed transfer news for this player */}
{confirmedArticle && <ConfirmedSigningBadge tooltipText={`${confirmedArticle.title} · ${SOURCE_NAME[confirmedArticle.source]}`} />}
```

**Desktop expanded row badge slot** (GemTable.tsx lines 401–402):
Identical insertion after line 402 (same structure as mobile).

**Per-row match derivation** (inside the row expansion block, per RESEARCH.md Pattern 4):
```typescript
const confirmedArticle = transferNews?.articles
  .filter(a => a.classification === 'confirmed_signing' && a.element_id === row.original.id)
  .sort((a, b) => {
    const ta = new Date(a.published ?? a.scraped_at).getTime()
    const tb = new Date(b.published ?? b.scraped_at).getTime()
    return tb - ta
  })[0]
```

**Source name map** (module-level constant):
```typescript
const SOURCE_NAME: Record<'skysports' | 'bbc', string> = {
  skysports: 'Sky Sports',
  bbc: 'BBC Sport',
}
```

---

### `src/components/transfers/OpportunityCostTable.tsx` (modified — badge in PlayerMoveCell buy cluster)

**Analog:** `src/components/transfers/OpportunityCostTable.tsx` — self-analog

**Existing buy cluster badge order** (OpportunityCostTable.tsx lines 141–151):
```tsx
<RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />
{/* Phase 119 UI-02: StatusLabelBadge for buy candidate (D-09): after RotationRiskBadge, before NewsBanner */}
<StatusLabelBadge statusLabel={lineupNewsMap?.get(t.buy.id)?.status_label} />
{/* Phase 122 POL-04: MinsRiskBadge for buy candidate — minutes confidence signal */}
<MinsRiskBadge minsRisk={t.buy.mins_risk} />
{/* Phase 88 SCRAPER-01: news banner for buy candidate (D-07) */}
<NewsBanner ... />
```

After `MinsRiskBadge` and before `NewsBanner`, add:
```tsx
{/* Phase 125 WIN-02: ConfirmedSigningBadge for buy candidate — confirmed transfer news */}
{(() => {
  const art = transferNews?.articles
    .filter(a => a.classification === 'confirmed_signing' && a.element_id === t.buy.id)
    .sort((a, b) => new Date(b.published ?? b.scraped_at).getTime() - new Date(a.published ?? a.scraped_at).getTime())[0]
  return art ? <ConfirmedSigningBadge tooltipText={`${art.title} · ${SOURCE_NAME[art.source]}`} /> : null
})()}
```

**Hook call placement** (mirrors rules-of-hooks pattern — call unconditionally at top of `PlayerMoveCell`):
```typescript
function PlayerMoveCell({ row, gw, allPlayers, lifecycleLabels, lineupNewsMap }: { ... }) {
  const { data: transferNews } = useTransferNews()
  // ... rest of component
```

`PlayerMoveCell` is already `'use client'` (OpportunityCostTable.tsx line 1). No directive change needed.

---

## Shared Patterns

### Badge shape contract
**Source:** `src/components/shared/MinsRiskBadge.tsx` line 59, `src/components/shared/StatusLabelBadge.tsx` lines 38–44
**Apply to:** `ConfirmedSigningBadge.tsx`
```tsx
<span className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`} title={titleText}>
  {label}
</span>
```
All shared badges in this codebase use this identical shape contract.

### Green colour token
**Source:** `src/components/shared/MinsRiskBadge.tsx` lines 12–13
**Apply to:** `ConfirmedSigningBadge.tsx`
```typescript
bg: 'bg-green-100 dark:bg-green-900',
text: 'text-green-800 dark:text-green-200',
```

### TanStack Query hook usage (rules-of-hooks)
**Source:** `src/lib/hooks/useTransferNews.ts` lines 4–14
**Apply to:** `SummerWindowTab.tsx`, `GemTable.tsx` (modified), `PlayerMoveCell` in `OpportunityCostTable.tsx` (modified)
```typescript
// Always call unconditionally at top of component function:
const { data: transferNews, isLoading, isError } = useTransferNews()
// Gate data access via optional chaining or isSuccess:
transferNews?.articles.filter(...)
```
Cache key `['transfer-news']` deduplicates — calling in multiple components does not trigger multiple network requests.

### Phase comment header
**Source:** `src/components/shared/StatusLabelBadge.tsx` lines 1–5, `src/components/news/NewsBanner.tsx` lines 1–6
**Apply to:** All new files
```typescript
// Phase 125 WIN-NN: ComponentName — one-line description.
// Sources of truth:
//   .planning/phases/125-summer-window-tracker/125-CONTEXT.md §D-NN
//   .planning/phases/125-summer-window-tracker/125-UI-SPEC.md §Section
```

### Article date sort with null-safe fallback
**Source:** RESEARCH.md Pattern 8 (derived from `types.ts` line 1076 — `published: string | null`)
**Apply to:** `SummerWindowTab.tsx`, `GemTable.tsx`, `PlayerMoveCell`
```typescript
.sort((a, b) => {
  const ta = new Date(a.published ?? a.scraped_at).getTime()
  const tb = new Date(b.published ?? b.scraped_at).getTime()
  return tb - ta
})
```
Always spread before sort: `[...articles].sort(...)` to avoid mutating the TanStack Query cache.

### Test file header
**Source:** `src/components/shared/StatusLabelBadge.test.tsx` lines 1–3
**Apply to:** All new test files
```typescript
// @vitest-environment jsdom
// Phase 125 WIN-NN / D-NN — ComponentName contract tests
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
```

---

## No Analog Found

All files have close analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `src/components/shared/`, `src/components/news/`, `src/components/price-changes/`, `src/components/transfers/`, `src/components/gem-table/`, `src/components/accuracy/`, `src/app/`, `src/lib/hooks/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-05-19
