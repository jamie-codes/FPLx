# Phase 36: Navigation Consolidation - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 4 (2 modified source files + 2 new test files)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/page.tsx` | component (page) | event-driven (user interaction) | `src/app/page.tsx` (current state — self-analog) | exact |
| `src/components/nav/MobileNav.tsx` | component (nav) | event-driven (user interaction) | `src/components/nav/MobileNav.tsx` (current state — self-analog) | exact |
| `src/app/page.test.tsx` | test | — | `src/components/insights/InsightsTab.test.tsx` | role-match |
| `src/components/nav/MobileNav.test.tsx` | test | — | `src/components/planner/ChipStrategyPanel.test.tsx` | role-match |

---

## Pattern Assignments

### `src/app/page.tsx` (component/page, event-driven)

**Analog:** `src/app/page.tsx` (current file — full rewrite of state model and desktop nav JSX)

**`'use client'` + imports pattern** (lines 1–17):
```typescript
'use client'

import { useState } from 'react'
import { GemTable } from '@/components/gem-table/GemTable'
import { DefConTables } from '@/components/defcon/DefConTables'
import { TransferPanel } from '@/components/transfers/TransferPanel'
import { ClubFormTable } from '@/components/club-form/ClubFormTable'
import { FixtureEaseRankingPanel } from '@/components/club-form/FixtureEaseRankingPanel'
import { LastUpdated } from '@/components/LastUpdated'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { ValueGemsTable } from '@/components/value-gems/ValueGemsTable'
import { MobileNav } from '@/components/nav/MobileNav'
import { PlannerTab } from '@/components/planner/PlannerTab'
import { SetPieceTakerPanel } from '@/components/set-pieces/SetPieceTakerPanel'
import { CaptainPicksPanel } from '@/components/captaincy/CaptainPicksPanel'
import { InsightsTab } from '@/components/insights/InsightsTab'
```
All 8 content component imports carry forward unchanged. The only import addition is removing `type Tab` (line 18) and replacing with `Section`/`SubTab` types defined in this file.

**Current flat state pattern — being replaced** (lines 18–21):
```typescript
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'set-pieces' | 'insights' | 'value-gems' | 'planner'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('gems')
```
Replace with SECTIONS constant + two-hook state model (see Research Pattern 2).

**Desktop nav container class — preserve this pattern** (line 35):
```typescript
<div className="hidden sm:flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-700">
```
The new section row keeps `hidden sm:flex` for desktop-only display. The `mb-6` moves to the sub-tab row (or conditionally to the section row when Squad is active — see RESEARCH.md Pitfall 3).

**Tab button active/inactive class pattern** (lines 37–41) — copy for BOTH section buttons and sub-tab buttons:
```typescript
className={`pb-2 px-1 text-sm font-medium ${
  activeTab === 'gems'
    ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
}`}
```

**Content render pattern** (lines 119–136):
```typescript
{activeTab === 'gems' && (
  <>
    <GemTable />
    <CaptainPicksPanel />
  </>
)}
{activeTab === 'defcon' && <DefConTables />}
{activeTab === 'squad' && <TransferPanel />}
{activeTab === 'club-form' && (
  <>
    <FixtureEaseRankingPanel />
    <ClubFormTable />
  </>
)}
{activeTab === 'set-pieces' && <SetPieceTakerPanel />}
{activeTab === 'insights' && <InsightsTab />}
{activeTab === 'value-gems' && <ValueGemsTable />}
{activeTab === 'planner' && <PlannerTab />}
```
Re-wire from `activeTab ===` to `activeSubTab ===`. Squad branch changes to `activeSection === 'squad'` (RESEARCH.md Pattern 3).

**MobileNav call site — being updated** (line 138):
```typescript
<MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
```
Replace with new props: `activeSection`, `activeSubTab`, `onSectionChange`, `onSubTabChange` (RESEARCH.md Pattern 4). This is the only call site.

---

### `src/components/nav/MobileNav.tsx` (component/nav, event-driven)

**Analog:** `src/components/nav/MobileNav.tsx` (current file — full rewrite of interface, TABS data, and JSX)

**`'use client'` directive** (line 1) — preserve unchanged.

**Current TABS data pattern — being replaced** (lines 5–14):
```typescript
const TABS = [
  { id: 'gems',        label: 'Gems' },
  { id: 'defcon',      label: 'DefCon' },
  { id: 'squad',       label: 'Squad' },
  { id: 'club-form',   label: 'Form' },
  { id: 'set-pieces',  label: 'SP' },
  { id: 'insights',    label: 'Insights' },
  { id: 'value-gems',  label: 'Values' },
  { id: 'planner',     label: 'Plan' },
] as const satisfies ReadonlyArray<{ id: Tab; label: string }>
```
Replace with import of `SECTIONS` from `page.tsx`. Remove `type Tab` declaration (line 3) — import `Section` and `SubTab` from `page.tsx` instead.

**Current props interface — being replaced** (lines 16–19):
```typescript
interface MobileNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}
```
Replace with the four-prop interface defined in RESEARCH.md Pattern 4.

**`<nav>` wrapper classes — preserve exactly** (lines 23–26):
```typescript
<nav
  className="sm:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 nav-safe-bottom z-50"
  aria-label="Mobile navigation"
>
```
`sm:hidden` hides on desktop. `nav-safe-bottom` is the iOS safe-area class from globals.css. `z-50` stays on the `<nav>` wrapper only (RESEARCH.md Pitfall 4).

**Section button class pattern — reuse from existing button** (lines 31–34):
```typescript
className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-2 text-xs font-medium cursor-pointer active:scale-95 transition-transform ${
  activeTab === tab.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'
}`}
```
Copy verbatim for the new section buttons (3 buttons replacing 8). Active/inactive colour tokens are the same.

**`aria-current` accessibility pattern** (line 35):
```typescript
aria-current={activeTab === tab.id ? 'page' : undefined}
```
Apply to both section buttons AND sub-tab pill buttons (RESEARCH.md Pitfall 5).

---

### `src/app/page.test.tsx` (test, —)

**Analog:** `src/components/insights/InsightsTab.test.tsx`

**Test file header + environment directive** (lines 1–6):
```typescript
// Phase 36: page.tsx state — section memory + default landing
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
```

**vi.mock pattern for child components** — mock all 8 content components to isolate page state:
```typescript
vi.mock('@/components/gem-table/GemTable', () => ({ GemTable: () => <div data-testid="gem-table" /> }))
vi.mock('@/components/defcon/DefConTables', () => ({ DefConTables: () => <div data-testid="defcon" /> }))
// ... repeat for all 8 content components + LastUpdated + ThemeToggle
```
Pattern derived from InsightsTab.test.tsx lines 8–14 (`vi.mock` at top of file before imports).

**`beforeEach` reset pattern** (lines 19–21 of InsightsTab.test.tsx):
```typescript
beforeEach(() => {
  mockedUseInsights.mockReset()
})
```
For page.test.tsx there are no hooks to reset — `beforeEach` can be omitted or used to clear any mocks.

**`container.textContent` + `fireEvent.click` assertion pattern** (InsightsTab.test.tsx lines 58–68 and ChipStrategyPanel.test.tsx lines 151–159):
```typescript
const { container } = render(<Home />)
// Text assertions
expect(container.textContent).toContain('Analyse')
// Click interaction
const btn = container.querySelector('button[aria-current="page"]') as HTMLElement
fireEvent.click(btn)
```

**describe block structure** (InsightsTab.test.tsx lines 18–20):
```typescript
describe('Phase 36: page.tsx state', () => {
  it('default landing state is Analyse → Gems (D-06)', () => { ... })
  it('section memory restores last sub-tab on return (D-05)', () => { ... })
})
```

---

### `src/components/nav/MobileNav.test.tsx` (test, —)

**Analog:** `src/components/planner/ChipStrategyPanel.test.tsx` (closest: component that receives props, no async hooks to mock)

**Test file header** (ChipStrategyPanel.test.tsx lines 1–4):
```typescript
// Phase 36: MobileNav component tests
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
```

**Import pattern** (ChipStrategyPanel.test.tsx lines 12–13):
```typescript
import { MobileNav } from '@/components/nav/MobileNav'
```
MobileNav is a pure presentational component receiving props — no mocks needed.

**Props helper pattern** (ChipStrategyPanel.test.tsx lines 57–92 `makeProps`):
```typescript
function makeProps(overrides?: Partial<Parameters<typeof MobileNav>[0]>) {
  return {
    activeSection: 'analyse' as Section,
    activeSubTab: 'gems' as SubTab,
    onSectionChange: vi.fn(),
    onSubTabChange: vi.fn(),
    ...overrides,
  }
}
```

**fireEvent.click + aria-current assertion pattern** (ChipStrategyPanel.test.tsx lines 151–160):
```typescript
const { container } = render(<MobileNav {...makeProps()} />)
const buttons = container.querySelectorAll('button')
// ...
fireEvent.click(buttons[0])
expect(makeProps().onSectionChange).toHaveBeenCalledWith('analyse')
```
Note: use `vi.fn()` captured in a variable so `toHaveBeenCalledWith` works.

**describe block structure** (ChipStrategyPanel.test.tsx line 94):
```typescript
describe('Phase 36: MobileNav component', () => {
  it('renders 3 section buttons with correct labels (NAV-01)', () => { ... })
  it('Analyse active: renders 4 sub-tab pills with mobile labels (NAV-02)', () => { ... })
  it('Plan active: renders 3 sub-tab pills (NAV-03)', () => { ... })
  it('Squad active: pill row is absent (NAV-04)', () => { ... })
  it('aria-current is "page" on active section button (NAV-01)', () => { ... })
  it('aria-current is "page" on active sub-tab pill (NAV-02)', () => { ... })
})
```

---

## Shared Patterns

### `'use client'` Directive
**Source:** `src/app/page.tsx` line 1, `src/components/nav/MobileNav.tsx` line 1
**Apply to:** Both modified files — unchanged, both are client components.
```typescript
'use client'
```

### Desktop/Mobile CSS-only Breakpoint Split
**Source:** `src/app/page.tsx` line 35, `src/components/nav/MobileNav.tsx` line 24
**Apply to:** All nav elements in both files.
```typescript
// Desktop only (hidden on mobile):
className="hidden sm:flex ..."
// Mobile only (hidden on desktop):
className="sm:hidden fixed bottom-0 ..."
```
Do NOT add JS `useMediaQuery` or `window.innerWidth` checks.

### Active Tab Underline Styling (Desktop)
**Source:** `src/app/page.tsx` lines 37–41
**Apply to:** Section row buttons AND sub-tab row buttons in the new desktop nav.
```typescript
activeTab === id
  ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
```

### Active Button Colouring (Mobile)
**Source:** `src/components/nav/MobileNav.tsx` lines 31–34
**Apply to:** Section buttons in the new mobile section bar.
```typescript
activeTab === tab.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'
```

### `aria-current` Accessibility Pattern
**Source:** `src/components/nav/MobileNav.tsx` line 35
**Apply to:** Every interactive button in both nav tiers — section buttons, sub-tab buttons, mobile pills.
```typescript
aria-current={activeId === item.id ? 'page' : undefined}
```

### Mobile Tap Feedback
**Source:** `src/components/nav/MobileNav.tsx` line 31
**Apply to:** All mobile nav buttons (section buttons in new section bar; pill buttons in pill row).
```typescript
active:scale-95 transition-transform
```

### Safe-Area Bottom Padding
**Source:** `src/components/nav/MobileNav.tsx` line 24 (`nav-safe-bottom` class)
**Apply to:** The `<nav>` wrapper in the updated MobileNav — keep `nav-safe-bottom` on the outermost `<nav>` unchanged.

### `@vitest-environment jsdom` Directive
**Source:** `src/components/insights/InsightsTab.test.tsx` line 3
**Apply to:** Both new test files (`page.test.tsx`, `MobileNav.test.tsx`).
```typescript
// @vitest-environment jsdom
```

---

## No Analog Found

None. Both source files are self-analogs (they already exist and are being rewritten). Both test files have strong role-match analogs in the existing test suite.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/nav/`, `src/**/*.test.{ts,tsx}`
**Files scanned:** 6 (page.tsx, MobileNav.tsx, InsightsTab.test.tsx, ChipStrategyPanel.test.tsx, vitest.config.ts, globals.css referenced in research)
**Pattern extraction date:** 2026-04-29

### Critical Atomicity Constraint
`type Tab` is declared independently in BOTH `src/app/page.tsx` line 18 AND `src/components/nav/MobileNav.tsx` line 3. Both declarations must be removed and replaced with exported `Section`/`SubTab` types from `page.tsx` in the **same task**. Leaving either file half-migrated causes TypeScript to reject the `<MobileNav>` call site in `page.tsx` (Phase 33 Pitfall 3).
