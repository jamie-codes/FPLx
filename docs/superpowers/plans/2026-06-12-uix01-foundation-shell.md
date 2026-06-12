# UIX-01: Foundation & Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Slate Pro token system, the 11 UI primitives, and the new 6-group app shell — with all 27 existing tabs rendering unchanged inside it.

**Architecture:** Three layers built bottom-up: (1) tokens/typography in `globals.css` + `layout.tsx`; (2) primitives in `src/components/ui/`; (3) shell (`src/lib/navigation.ts` + `src/components/shell/` + `page.tsx` integration). The binding requirements document is the spec (`docs/superpowers/specs/2026-06-12-uix01-foundation-shell-design.md`) — read it FIRST; where this plan abbreviates, the spec governs. The feature inventory (`2026-06-12-uix01-feature-inventory.md`) is the acceptance checklist.

**Tech Stack:** Next 16.2.1 (App Router, client components), React 19, Tailwind v4 (`@theme` in globals.css), `next/font` (Inter), next/image, Vitest + RTL (`// @vitest-environment jsdom` pragma), Playwright.

**MANDATORY first step for every UI task** (AGENTS.md): read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`; for Task 1 also read `node_modules/next/dist/docs/01-app/03-api-reference/` docs for `next/font` and the image `remotePatterns` config if present (find by name match).

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/app/globals.css` | 1 | Tier-1/2 tokens, type ramp, motion, legacy aliases |
| `src/app/layout.tsx` | 1 | Inter via next/font |
| `next.config.ts` (or `.mjs` — find it) | 1 | `images.remotePatterns` for the 2 asset hosts |
| `src/lib/types.ts` + maybe `pipeline/merge.py` | 1 | `code`/`team_code` passthrough if missing |
| `src/components/ui/*` (11 files + tests) | 2–3 | Primitives |
| `src/lib/navigation.ts` + test | 4 | Nav single source of truth |
| `src/components/shell/*` (4 files + tests) | 4 | Sidebar, TopBar, MobileBar, MoreSheet |
| `src/app/page.tsx` + `page.test.tsx`, `src/components/nav/MobileNav.tsx` | 5 | Integration; SECTIONS removal |
| `e2e/uix-shell.spec.ts` (or the repo's e2e dir — find `playwright.config`) | 6 | 27-tool smoke |

---

## Task 1: tokens, typography, asset config, data fields

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx`, next config; possibly `src/lib/types.ts` + `pipeline/merge.py`.

- [ ] **Step 1**: READ `src/app/globals.css` fully (it has the existing `@theme inline` + CSS vars) and `src/app/layout.tsx` (current fonts). Note every existing var name — they must keep working via aliases.

- [ ] **Step 2**: Append/replace the token layer in `globals.css`. Exact token block (merge with the file's existing structure — `.dark` is the theme switch already in use):

```css
/* ── UIX-01 Slate Pro tokens ─ tier 1 primitives live only in this :root block ── */
:root {
  --sp-surface-0: #f8fafc; --sp-surface-1: #ffffff; --sp-surface-2: #eef1f5;
  --sp-line: #e4e7ec; --sp-ink: #1a1f29; --sp-ink-muted: #667085;
  --sp-accent: #2563eb; --sp-accent-soft: rgba(37, 99, 235, 0.10);
  --sp-positive: #16a34a; --sp-positive-soft: rgba(22, 163, 74, 0.12);
  --sp-warning: #d97706; --sp-warning-soft: rgba(217, 119, 6, 0.14);
  --sp-negative: #dc2626; --sp-negative-soft: rgba(220, 38, 38, 0.12);
  --sp-focus-ring: rgba(37, 99, 235, 0.4);
}
.dark {
  --sp-surface-0: #0f1115; --sp-surface-1: #171a21; --sp-surface-2: #1e232d;
  --sp-line: #262b36; --sp-ink: #e7e9ee; --sp-ink-muted: #8a93a6;
  --sp-accent: #5b8cff; --sp-accent-soft: rgba(91, 140, 255, 0.14);
  --sp-positive: #4ade80; --sp-positive-soft: rgba(74, 222, 128, 0.14);
  --sp-warning: #fbbf24; --sp-warning-soft: rgba(251, 191, 36, 0.16);
  --sp-negative: #f87171; --sp-negative-soft: rgba(248, 113, 113, 0.14);
  --sp-focus-ring: rgba(91, 140, 255, 0.45);
}
@theme inline {
  --color-surface-0: var(--sp-surface-0); --color-surface-1: var(--sp-surface-1);
  --color-surface-2: var(--sp-surface-2); --color-line: var(--sp-line);
  --color-ink: var(--sp-ink); --color-ink-muted: var(--sp-ink-muted);
  --color-accent: var(--sp-accent); --color-accent-soft: var(--sp-accent-soft);
  --color-positive: var(--sp-positive); --color-positive-soft: var(--sp-positive-soft);
  --color-warning: var(--sp-warning); --color-warning-soft: var(--sp-warning-soft);
  --color-negative: var(--sp-negative); --color-negative-soft: var(--sp-negative-soft);
  /* type ramp — 1.2 minor third */
  --text-data: 12.5px; --text-data--line-height: 1.2;
  --text-body: 15px;  --text-body--line-height: 1.45;
  --text-h4: 18px;    --text-h4--line-height: 1.25;
  --text-h3: 21.6px;  --text-h3--line-height: 1.25;
  --text-h2: 26px;    --text-h2--line-height: 1.25;
  --text-display: 31.2px; --text-display--line-height: 1.2;
}
.tabular { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
:focus-visible { outline: 2px solid var(--sp-focus-ring); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

  Then RE-POINT the legacy vars (the file's existing `--surface`, `--surface-elevated`, `--foreground`, `--muted`, `--border`, `--color-positive/warning/negative` etc.) to alias the new `--sp-*` equivalents (e.g. `--surface: var(--sp-surface-0);`) in BOTH `:root` and `.dark` so every unmigrated tab keeps its look. Match each legacy var to its nearest new token by meaning (elevated→surface-1, border→line, muted→ink-muted...). Comment the alias block `/* UIX-01 legacy aliases — removed in UIX-05 */`.

- [ ] **Step 3**: `layout.tsx` — switch to Inter via `next/font/google` (`subsets: ['latin']`, `variable: '--font-inter'`, apply on `<body>` alongside existing class wiring; replace the current font setup; verify against the Next 16 font doc you read). Set `font-family` in globals from the variable.

- [ ] **Step 4**: next config — find `next.config.*`; add:

```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'resources.premierleague.com' },
    { protocol: 'https', hostname: 'fantasy.premierleague.com' },
  ],
},
```

- [ ] **Step 5**: Verify `code`/`team_code` availability: `grep -n "'code'\|\"code\"\|team_code" src/lib/types.ts pipeline/merge.py | head`. If `MergedPlayer` lacks `code: number` (player photo id) and `team_code: number`: add both as optional fields to types.ts AND add the passthrough in `pipeline/merge.py` where the player dict is built from the bootstrap element (`'code': element.get('code')`, `'team_code': <team's code via the teams dict already in scope>`) + one pytest asserting the fields appear in merge output (follow an existing merge_players output-field test's pattern in pipeline/tests/test_merge.py). Run pipeline suite (`cd pipeline && python -m pytest tests/ -q`, baseline 581).

- [ ] **Step 6**: Verify: `npx tsc --noEmit` (no new errors), `npm test` (full vitest green), `npm run dev` + curl `http://localhost:3000` serves (kill after). Visual spot-check is Task 5's job.

- [ ] **Step 7**: Commit `feat(uix-01): Slate Pro token system, Inter, asset config, code/team_code passthrough`

---

## Task 2: primitives batch 1 (Chip, Card, Stat, Button, Tabs, SectionHeader, EmptyState, Skeleton)

**Files:** Create `src/components/ui/{Chip,Card,Stat,Button,Tabs,SectionHeader,EmptyState,Skeleton}.tsx` + `src/components/ui/ui.test.tsx` (one test file for batch 1 is fine).

All components: `'use client'`, props per the spec's API table, styled ONLY with the new token utilities (`bg-surface-1`, `text-ink`, `border-line`, `text-data`, …), radius 6/8 per spec, transitions 150ms. TDD: write the test file first with the assertions below, watch fail, implement, pass.

Reference implementation for the pattern (Chip — the others follow the same shape):

```tsx
'use client'
// UIX-01 primitive: the badge/pill unifier. Styled exclusively from semantic tokens.
const INTENT_CLS = {
  neutral:  'bg-surface-2 text-ink-muted border-line',
  accent:   'bg-accent-soft text-accent border-accent/40',
  positive: 'bg-positive-soft text-positive border-positive/40',
  warning:  'bg-warning-soft text-warning border-warning/40',
  negative: 'bg-negative-soft text-negative border-negative/40',
} as const

export type ChipIntent = keyof typeof INTENT_CLS

export function Chip({ intent = 'neutral', size = 'sm', title, children }: {
  intent?: ChipIntent
  size?: 'sm' | 'md'
  title?: string
  children: React.ReactNode
}) {
  const sizeCls = size === 'sm' ? 'text-data px-2 py-0.5' : 'text-body px-2.5 py-1'
  return (
    <span title={title}
      className={`inline-flex items-center gap-1 rounded-md border whitespace-nowrap ${INTENT_CLS[intent]} ${sizeCls}`}>
      {children}
    </span>
  )
}
```

The other seven, implemented to the spec's API table with these binding details:
- `Card`: `<section>` with optional header row (`title` rendered `text-h4 font-semibold text-ink`, `action` right-aligned); body padding `md`=16px, `sm`=12px, `none`; `bg-surface-1 border border-line rounded-lg`
- `Stat`: value `text-h3 font-bold tabular text-ink` (or intent color), label `text-data text-ink-muted` above, optional `sub` below
- `Button`: variants — primary `bg-accent text-white`, secondary `bg-surface-1 border-line text-ink`, ghost `text-ink-muted hover:bg-surface-2`, danger `bg-negative text-white`; md `min-h-[44px] px-4`, sm `min-h-[32px] px-3 text-data`; `disabled:opacity-50`
- `Tabs`: pill row, active `bg-accent-soft text-accent`, inactive `text-ink-muted hover:bg-surface-2`; `role="tablist"`/`role="tab"` + `aria-selected`; ArrowLeft/ArrowRight move selection (onKeyDown calling onChange)
- `SectionHeader`: `title` `text-h3 font-semibold`, optional `subtitle` `text-body text-ink-muted`, `action` right
- `EmptyState`: centered, `title` `text-h4`, `hint` `text-body text-ink-muted`, optional icon slot
- `Skeleton`: `animate-pulse bg-surface-2 rounded` + caller className

Tests (one `describe` per component; the assertions that pin behaviour):
- Chip: each intent renders its class fragment; title attr passes through
- Card: title/action render; padding none has no p- class on body
- Stat: value+label render; intent applies color class
- Button: each variant class; disabled blocks onClick; md has min-h-[44px]
- Tabs: renders items; click fires onChange(id); ArrowRight from item0 fires onChange(item1.id); aria-selected on active
- SectionHeader/EmptyState/Skeleton: smoke + key class assertions

Verify (`npx vitest run src/components/ui/`, `npx tsc --noEmit`), commit `feat(uix-01): UI primitives batch 1`.

---

## Task 3: primitives batch 2 (TableShell/Th/Td, KitIcon, PlayerCell)

**Files:** Create `src/components/ui/{Table,KitIcon,PlayerCell}.tsx` + `src/components/ui/table-player.test.tsx`.

- `Table.tsx` exports class constants + thin wrappers (a SKIN — no table engine):

```tsx
'use client'
// UIX-01: table chrome. Wraps hand-rolled tables AND TanStack markup (skin only).
export const TABLE_CLS = 'w-full text-data tabular border-collapse'
export const TH_CLS = 'text-left font-medium text-ink-muted pb-1.5 px-2 border-b border-line whitespace-nowrap'
export const TD_CLS = 'py-1.5 px-2 whitespace-nowrap'
export const TR_CLS = 'even:bg-surface-0 hover:bg-surface-2 transition-colors duration-150'

export function TableShell({ children, stickyHeader = false }: {
  children: React.ReactNode; stickyHeader?: boolean
}) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-line bg-surface-1 ${stickyHeader ? 'max-h-[70vh] overflow-y-auto' : ''}`}>
      {children}
    </div>
  )
}
export function Th({ children, className = '', ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`${TH_CLS} ${className}`} {...rest}>{children}</th>
}
export function Td({ children, className = '', ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`${TD_CLS} ${className}`} {...rest}>{children}</td>
}
```

- `KitIcon.tsx`: `next/image` of `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{teamCode}-110.webp`, explicit `width/height` from `size` prop (default 24, height = size*1.33 rounded), `onError` → render nothing (`useState` errored flag), `alt=""` `aria-hidden`.

- `PlayerCell.tsx` (the signature component):

```tsx
'use client'
// UIX-01 signature component: headshot + name + team badge + meta. Zero-CLS:
// explicit dimensions; skeleton until load; initials avatar on photo error.
import Image from 'next/image'
import { useState } from 'react'

const PHOTO = (code: number) =>
  `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`
const BADGE = (teamCode: number) =>
  `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`

function initials(name: string): string {
  return name.split(/[\s.-]+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function PlayerCell({ code, webName, teamCode, teamShort, pos, price, size = 'md' }: {
  code?: number | null
  webName: string
  teamCode?: number | null
  teamShort?: string
  pos?: string
  price?: string
  size?: 'sm' | 'md'
}) {
  const [photoErr, setPhotoErr] = useState(false)
  const [badgeErr, setBadgeErr] = useState(false)
  const img = size === 'md' ? { w: 30, h: 38 } : { w: 24, h: 30 }
  const meta = [pos, teamShort, price].filter(Boolean).join(' · ')
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {code && !photoErr ? (
        <Image src={PHOTO(code)} alt="" width={img.w} height={img.h}
          className="rounded-md bg-surface-2 object-cover shrink-0"
          onError={() => setPhotoErr(true)} unoptimized />
      ) : (
        <span style={{ width: img.w, height: img.h }} aria-hidden
          className="rounded-md bg-surface-2 text-ink-muted text-data font-medium
                     inline-flex items-center justify-center shrink-0">
          {initials(webName)}
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="text-body font-semibold text-ink truncate">{webName}</span>
          {teamCode && !badgeErr && (
            <Image src={BADGE(teamCode)} alt={teamShort ?? ''} width={14} height={14}
              className="shrink-0" onError={() => setBadgeErr(true)} unoptimized />
          )}
        </span>
        {meta && <span className="block text-data text-ink-muted truncate">{meta}</span>}
      </span>
    </span>
  )
}
```

(`unoptimized` because the CDN images are already sized and the optimizer adds latency for a single-user app; remotePatterns still required for next/image. If `next/image` + jsdom tests fight, mocking `next/image` to an `<img>` in the test file via `vi.mock('next/image', ...)` is the established React-testing approach — check whether the repo already has such a mock pattern and reuse.)

Tests: PlayerCell renders name+meta; no `code` → initials avatar with correct text ("Bruno Fernandes"→"BF", "Haaland"→"H"); photo error path → initials (fire error event); badge optional; KitIcon renders img with width; error → renders nothing; Th/Td/TableShell class smoke.

Verify + commit `feat(uix-01): table chrome, KitIcon, PlayerCell with asset fallbacks`.

---

## Task 4: navigation.ts + shell components

**Files:** Create `src/lib/navigation.ts`, `src/lib/navigation.test.ts`, `src/components/shell/{Sidebar,TopBar,MobileBar,MoreSheet}.tsx`, `src/components/shell/shell.test.tsx`.

- [ ] **Step 1** `navigation.ts` — the complete content (this is the contract; the 27 ids must match `src/app/page.tsx`'s current SubTab union EXACTLY — verify by grep before writing):

```ts
// UIX-01: single source of truth for the app's navigation.
// The 27 tool ids are the pre-overhaul SubTab ids — every one must appear
// exactly once (navigation.test.ts enforces against this list).
export type ToolId =
  | 'home'
  | 'picks' | 'decision' | 'lineup' | 'live' | 'review'
  | 'transfers' | 'optimiser' | 'watchlist' | 'rank-sim' | 'rivals'
  | 'gems' | 'value-gems' | 'insights' | 'defcon' | 'set-pieces' | 'club-form' | 'perfect-gw'
  | 'planner' | 'manual-plan' | 'route-tree' | 'wildcard' | 'window' | 'next-season' | 'price-reset' | 'price-changes'
  | 'accuracy' | 'season'

export interface Tool { id: ToolId; label: string; mobileLabel: string }
export interface Group { id: string; label: string; icon: string; tools: Tool[] }

export const GROUPS: Group[] = [
  { id: 'home', label: 'Home', icon: '🏠', tools: [
    { id: 'home', label: 'Home', mobileLabel: 'Home' },
  ]},
  { id: 'this-week', label: 'This Week', icon: '⚡', tools: [
    { id: 'picks',    label: 'Weekly Picks', mobileLabel: 'Picks' },
    { id: 'decision', label: 'Decision',     mobileLabel: 'Decision' },
    { id: 'lineup',   label: 'Lineup',       mobileLabel: 'Lineup' },
    { id: 'live',     label: 'Live',         mobileLabel: 'Live' },
    { id: 'review',   label: 'Review',       mobileLabel: 'Review' },
  ]},
  { id: 'my-squad', label: 'My Squad', icon: '👕', tools: [
    { id: 'transfers', label: 'Transfers', mobileLabel: 'Transfers' },
    { id: 'optimiser', label: 'Optimiser', mobileLabel: 'Optimiser' },
    { id: 'watchlist', label: 'Watchlist', mobileLabel: 'Watchlist' },
    { id: 'rank-sim',  label: 'Rank Sim',  mobileLabel: 'Rank Sim' },
    { id: 'rivals',    label: 'Rivals',    mobileLabel: 'Rivals' },
  ]},
  { id: 'research', label: 'Research', icon: '🔍', tools: [
    { id: 'gems',       label: 'Gem Ratings',     mobileLabel: 'Gems' },
    { id: 'value-gems', label: 'Value Gems',      mobileLabel: 'Values' },
    { id: 'insights',   label: 'Insights',        mobileLabel: 'Insights' },
    { id: 'defcon',     label: 'DefCon Analysis', mobileLabel: 'DefCon' },
    { id: 'set-pieces', label: 'Set Pieces',      mobileLabel: 'SP' },
    { id: 'club-form',  label: 'Club Form',       mobileLabel: 'Form' },
    { id: 'perfect-gw', label: 'Perfect GW',      mobileLabel: 'Perfect' },
  ]},
  { id: 'planning', label: 'Planning', icon: '📅', tools: [
    { id: 'planner',       label: 'Planner',       mobileLabel: 'Planner' },
    { id: 'manual-plan',   label: 'Manual Plan',   mobileLabel: 'Manual' },
    { id: 'route-tree',    label: 'Route Tree',    mobileLabel: 'Routes' },
    { id: 'wildcard',      label: 'Wildcard',      mobileLabel: 'Wildcard' },
    { id: 'window',        label: 'Summer Window', mobileLabel: 'Window' },
    { id: 'next-season',   label: 'Next Season',   mobileLabel: 'Pre-Season' },
    { id: 'price-reset',   label: 'Price Reset',   mobileLabel: 'Resets' },
    { id: 'price-changes', label: 'Price Changes', mobileLabel: 'Prices' },
  ]},
  { id: 'model', label: 'Model', icon: '📊', tools: [
    { id: 'accuracy', label: 'Accuracy', mobileLabel: 'Acc' },
    { id: 'season',   label: 'Season',   mobileLabel: 'Season' },
  ]},
]

export const ALL_TOOL_IDS: ToolId[] = GROUPS.flatMap((g) => g.tools.map((t) => t.id))

export function groupOf(toolId: ToolId): Group {
  return GROUPS.find((g) => g.tools.some((t) => t.id === toolId)) ?? GROUPS[0]
}
```

- [ ] **Step 2** `navigation.test.ts`: asserts (a) ALL_TOOL_IDS has 28 entries (27 legacy + home) with no duplicates (`new Set(...).size === 28`); (b) hardcode the 27 legacy ids in the test (copy the list from the inventory doc) and assert each is present — this is the keep-all-features tripwire; (c) `groupOf('gems').id === 'research'`.

- [ ] **Step 3** Shell components, props designed so `page.tsx` owns the state:
  - `Sidebar({ active, onSelect }: { active: ToolId; onSelect: (t: ToolId) => void })` — desktop only (`hidden lg:flex`), `w-[220px]` fixed full-height `bg-surface-1 border-r border-line`; brand block; per group: label `text-data uppercase tracking-wide text-ink-muted`, then tool buttons (`aria-current='page'` on active; active = `bg-accent-soft text-accent` + 2px accent left bar; inactive `text-ink-muted hover:bg-surface-2`)
  - `TopBar({ children }: { children?: React.ReactNode })` — 56px sticky `bg-surface-1/95 backdrop-blur border-b border-line`; left: mobile brand; right: a `children` slot where `page.tsx` mounts its EXISTING bell/theme/FPL-ID/deadline elements (do NOT recreate them — they are mounted by page.tsx into the slot)
  - `MobileBar({ active, onSelect, onMore }: { active: ToolId; onSelect: (t: ToolId) => void; onMore: () => void })` — `lg:hidden` fixed bottom, 5 buttons: Home, This Week, Squad, Research, More (icon + label, `min-h-[48px]`, `pb-[env(safe-area-inset-bottom)]`); group buttons select the group's remembered/first tool; active group highlighted
  - `MoreSheet({ open, onClose, active, onSelect })` — `lg:hidden` bottom sheet (fixed inset-x-0 bottom-0, radius-12 top corners, e2 shadow, backdrop button that closes) listing Planning + Model groups' tools; 250ms translate-y transition
  - Shell tests: Sidebar renders 6 group labels + 28 tools, click fires onSelect; active styling/aria-current present; MobileBar 5 buttons + onMore; MoreSheet lists planning/model tools when open, backdrop closes

Verify + commit `feat(uix-01): navigation source of truth + shell components`.

---

## Task 5: page.tsx integration

**Files:** Modify `src/app/page.tsx`, `src/app/page.test.tsx`, `src/components/nav/MobileNav.tsx` (likely DELETE), and any other `SECTIONS`/`SubTab` importers.

- [ ] **Step 1**: `grep -rn "from '@/app/page'\|SECTIONS\|SubTab" src/ --include="*.tsx" --include="*.ts" | grep -v test` — list every importer. Known: `MobileNav.tsx`. Plan each repoint before editing.

- [ ] **Step 2**: Rework `page.tsx` state (READ the whole file first):
  - Replace `Section`/`SubTab`/`SECTIONS` with `ToolId`/`GROUPS` from `@/lib/navigation`
  - State: `activeTool: ToolId` (default `'home'`), `groupMemory: Record<string, ToolId>` (port of sectionMemory: selecting a tool records it for its group; selecting a GROUP from MobileBar/Sidebar-group-header jumps to its remembered tool or first tool)
  - URL sync: on mount, read `new URLSearchParams(window.location.search).get('t')` — if a valid ToolId, select it; on every tool change, `window.history.replaceState(null, '', '?t=' + toolId)` (guard `typeof window !== 'undefined'`; it's a client component so mount-effect is fine)
  - Layout: `<div className="lg:pl-[220px]">` content area; `<Sidebar/>` + `<TopBar>` (mount the EXISTING deadline banner/bell/theme-toggle/FPL-ID elements into the TopBar slot — find where they currently render in page.tsx and move the JSX, not recreate) + tool-pill row under TopBar on mobile for the active group's tools (reuse `Tabs` primitive) + `<MobileBar/>` + `<MoreSheet/>`; bottom padding on mobile so content clears the bar
  - The 27 render conditionals: change `{activeSection !== 'squad' && activeSubTab === 'gems' && ...}` style guards to `{activeTool === 'gems' && ...}` — MECHANICAL, do all 27; plus `{activeTool === 'home' && <Card title="Welcome"><p>… home dashboard arrives in UIX-02; jump to <Button onClick={...pick 'picks'}>This Week</Button></p></Card>}` (composed properly with the primitives)
  - Keep ALL existing page-level state/handlers the tabs depend on (gemPreset, compare modal, watchlistIds, submittedId, …) — untouched
  - DELETE the old SECTIONS/desktop-nav/mobile-nav JSX and `MobileNav.tsx` (its role is replaced by MobileBar/MoreSheet); remove the `Section`/`SubTab` exports
- [ ] **Step 3**: Rewrite `page.test.tsx`'s nav-structure tests against GROUPS (the old sub-tab-order test dies with SECTIONS; new test asserts the group pill row renders the active group's tools)
- [ ] **Step 4**: Gauntlet: `npx tsc --noEmit` · `npm run lint` (no NEW errors) · `npm test` (whole suite green — collateral test updates expected wherever tests imported SECTIONS; fix by repointing to navigation.ts, never weaken)
- [ ] **Step 5**: `npm run dev` — click through ALL 28 tools in the browser via curl is impossible; minimum: assert the served HTML contains the sidebar tool labels, then ad-hoc Playwright (Task 6 makes it permanent). Kill server.
- [ ] **Step 6**: Commit `feat(uix-01): new app shell — 6-group nav, URL sync, all 27 tools re-homed`

---

## Task 6: Playwright smoke + acceptance

**Files:** Create the e2e spec where `playwright.config.*` expects (find it; if no config/dir exists, create `playwright.config.ts` with defaults targeting `npm run dev` server + `e2e/` dir — check package.json's `test:e2e` script for hints first).

```ts
import { test, expect } from '@playwright/test'
import { ALL_TOOL_IDS } from '../src/lib/navigation'

for (const viewport of [{ width: 1440, height: 900, name: 'desktop' },
                        { width: 390, height: 844, name: 'mobile' }]) {
  test.describe(`shell smoke — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })
    for (const toolId of ALL_TOOL_IDS) {
      test(`renders ${toolId}`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(String(e)))
        await page.goto(`/?t=${toolId}`)
        await page.waitForLoadState('networkidle')
        expect(errors).toEqual([])
      })
    }
  })
}
```

Run it (`npm run test:e2e` — dev server per config). All 56 pass. Then the **inventory walkthrough**: the final code reviewer (not the implementer) walks `docs/superpowers/specs/2026-06-12-uix01-feature-inventory.md` tab-by-tab in the running app.

Commit `test(uix-01): 28-tool x 2-viewport shell smoke`.

---

## Self-review notes

- Spec coverage: tokens/aliases ✓T1, Inter+tnum ✓T1, remotePatterns ✓T1, code/team_code ✓T1, 11 primitives ✓T2-3 (Card,Stat,Chip,Button,Tabs,Table,PlayerCell,KitIcon,EmptyState,Skeleton,SectionHeader), navigation+completeness test ✓T4, shell desktop/mobile+More sheet ✓T4, URL sync+memory+27 conditionals+chrome relocation ✓T5, Playwright+inventory walkthrough ✓T6, AA contrast — the token pairs were chosen for AA; reviewer verifies ratios for ink-muted-on-surface-0 both themes (the riskiest pairs) in Task 6's review.
- Type consistency: ToolId/GROUPS/ALL_TOOL_IDS defined T4 consumed T5/T6; Chip/Tabs APIs defined T2 reused T5.
- The 27 legacy ids in navigation.ts were copied from page.tsx's live SECTIONS (verified this session) — Task 4 Step 1 re-verifies by grep before writing.
