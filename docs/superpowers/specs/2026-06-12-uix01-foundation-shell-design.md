# UIX-01: UI Overhaul — Foundation & Shell

**Feature ID:** UIX-01 (phase 1 of 5; see Phasing)
**Date:** 2026-06-12
**Status:** Approved (user: IA option C, Slate Pro language, "10/10 UX, proper design systems, tokens and typographic ratios, holistic")
**Companion docs:** `2026-06-12-uix01-feature-inventory.md` (the keep-all-features contract — 27 tabs, 37 hooks, 33 routes; every item must remain reachable and functional after this phase)

---

## Phasing (approved)

| Phase | Scope |
|---|---|
| **UIX-01 (this spec)** | Token system, primitive components, new app shell + navigation. All 27 tabs re-home unchanged. |
| UIX-02 | Home command centre (squad verdict strip, do-this-week cards, deadline) |
| UIX-03 | This Week + Research content migration onto primitives |
| UIX-04 | My Squad + Planning migration |
| UIX-05 | Model group migration + motion/a11y/responsive polish pass |

Each subsequent phase gets its own spec → plan → execution cycle.

## Design language: Slate Pro

Neutral slate precision + electric blue, both themes first-class, 1.2 minor-third type scale (the densest of the three boards — right for a data app). User picked this over broadcast-dark and editorial-light boards.

### Token architecture (3 tiers, in `src/app/globals.css` via Tailwind v4 `@theme`)

**Tier 1 — primitives** (never used directly by components):

```
Dark surfaces:  slate-d0 #0f1115 · d1 #171a21 · d2 #1e232d · d3(line) #262b36 · d-muted #8a93a6 · d-ink #e7e9ee
Light surfaces: slate-l0 #f8fafc · l1 #ffffff · l2 #eef1f5 · l3(line) #e4e7ec · l-muted #667085 · l-ink #1a1f29
Accent:   blue-600 #2563eb (light) / blue-400 #5b8cff (dark)
Positive: #16a34a / #4ade80   Warning: #d97706 / #fbbf24   Negative: #dc2626 / #f87171
```

**Tier 2 — semantic CSS variables**, themed by the existing `.dark` class mechanism:
`--surface-0` (app bg), `--surface-1` (card), `--surface-2` (raised/hover), `--line`, `--ink`, `--ink-muted`, `--accent`, `--accent-soft` (10–15% alpha fill), `--positive/-soft`, `--warning/-soft`, `--negative/-soft`, `--focus-ring` (accent @ 40%). Exposed as Tailwind utilities (`bg-surface-1`, `text-ink-muted`, `border-line`, …). The existing `--surface/--foreground/...` vars are superseded — UIX-01 keeps them as aliases to the new tokens so unmigrated tabs keep working, with removal scheduled in UIX-05.

**Tier 3 — component tokens** live as the primitives' internal class constants (single place per component).

### Typography

- **Inter** via `next/font` (replaces current fonts in `layout.tsx`), `font-feature-settings: "tnum"` utility (`.tabular`) applied to ALL numeric data cells
- **Ramp (1.2 minor third), px**: `12.5 (data/caption) · 15 (body/UI) · 18 (h4) · 21.6 (h3) · 26 (h2) · 31.2 (h1-display)` — exposed as `text-data`, `text-body`, `text-h4`…`text-display`; line-heights 1.45 body / 1.25 headings / 1.2 data cells
- Weights: 400 body, 500 UI labels, 600 emphasis/names, 700 stats & headings

### Space, radius, elevation, motion

- **4px grid**: gap/padding utilities used in multiples of 4 only (lint by convention, documented in the primitives)
- **Radius**: 6 (controls/chips), 8 (cards/rows), 12 (modals/sheets)
- **Elevation**: e0 = border only; e1 = border + `shadow-sm`; e2 (overlays) = border + layered shadow. Dark theme expresses elevation by surface step (d1→d2), not shadow.
- **Motion**: 150ms ease-out (hover/press/chip), 250ms cubic-bezier(.2,.8,.2,1) (panels/sheets/expansion); everything inside `@media (prefers-reduced-motion: no-preference)`
- **Focus**: visible 2px `--focus-ring` outline on every interactive element (keyboard-only via `:focus-visible`)
- **Contrast**: every semantic ink/surface pair documented ≥ AA (4.5:1 body, 3:1 large/data-bold) — verified in the plan with actual ratios

## Primitive components (`src/components/ui/`)

All `'use client'`, all styled exclusively from semantic tokens, all with vitest coverage:

| Component | API (props) | Notes |
|---|---|---|
| `Card` | `title?, subtitle?, action?, padding?: 'md'\|'sm'\|'none', children` | surface-1, radius-8, e0/e1 |
| `Stat` | `label, value, sub?, intent?: 'accent'\|'positive'\|'warning'\|'negative'\|'neutral'` | big tabular number + caption (confidence-strip style) |
| `Chip` | `intent (5), size?: 'sm'\|'md', title?, children` | THE badge/pill unifier — soft fill + 1px border + matching ink |
| `Button` | `variant: 'primary'\|'secondary'\|'ghost'\|'danger', size?: 'sm'\|'md', icon?, children` | min-h 44px at md (touch) |
| `Tabs` | `items: {id,label}[], value, onChange, size?` | in-page secondary tabs (e.g. Accuracy's inner sub-tabs) |
| `Th`/`Td`/`TableShell` | class-constant helpers + sticky-header wrapper | a SKIN, not an engine — wraps both hand-rolled tables and TanStack markup |
| `PlayerCell` | `code?, webName, teamCode?, teamShort, pos?, price?, size?: 'sm'\|'md'` | headshot (or initials-avatar fallback) + name + badge + meta line — the signature component |
| `KitIcon` | `teamCode, size?` | shirt webp with fallback |
| `EmptyState` | `title, hint?, icon?` | off-season/no-data surfaces |
| `Skeleton` | `className` | shimmer block; photo/table loading |
| `SectionHeader` | `title, subtitle?, action?` | h2/h3 + optional right-side control |

### Official assets

- Photos `https://resources.premierleague.com/premierleague/photos/players/110x140/p{element.code}.png` (250x250 variant for the future Home hero), badges `…/badges/70/t{team.code}.png`, kits `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{team.code}-110.webp` — all verified live (200, correct content-types)
- Served via `next/image` with `images.remotePatterns` for the two hosts in `next.config.*`; explicit width/height everywhere (zero CLS); `onError` → initials avatar (PlayerCell) / plain badge-less render (KitIcon, TeamBadge)
- `MergedPlayer` needs `code` and `team_code` client-side — verify in plan; if absent, the pipeline merge step adds the two passthrough fields (bootstrap has both; additive, types.ts updated)

## App shell

### Navigation model (new single source of truth: `src/lib/navigation.ts`)

6 groups; the 27 existing tool ids re-home (labels unchanged inside tools; every id appears exactly once — enforced by a test against the inventory):

| Group | Tools (existing ids) |
|---|---|
| **Home** | `home` (new id — UIX-01 ships a placeholder Card linking to This Week; UIX-02 replaces it) |
| **This Week** | `picks`, `decision`, `lineup`, `live`, `review` |
| **My Squad** | `transfers`, `optimiser`, `watchlist`, `rank-sim`, `rivals` |
| **Research** | `gems`, `value-gems`, `insights`, `defcon`, `set-pieces`, `club-form`, `perfect-gw` |
| **Planning** | `planner`, `manual-plan`, `route-tree`, `wildcard`, `window`, `next-season`, `price-reset`, `price-changes` |
| **Model** | `accuracy`, `season` |

(5 + 5 + 7 + 8 + 2 = 27 ✓.) `navigation.ts` exports `GROUPS: {id, label, icon, tools: {id, label, mobileLabel}[]}` plus the `ToolId` union. `MobileNav` stops importing from `@/app/page`; both navs read `navigation.ts`.

### Layout

- **Desktop ≥ 1024px**: fixed 220px left sidebar — brand at top, then groups as headed lists of tools; active tool = accent-soft fill + accent left rail. Top bar (56px): current-GW + deadline countdown (reuses the existing deadline-banner data source), right cluster = bell (existing `BellNotificationButton`), theme toggle (existing), FPL-ID chip (existing entry/management relocated, behaviour identical).
- **Mobile < 1024px**: top bar (brand, deadline, bell, theme); bottom tab bar with **Home · This Week · Squad · Research · More** (44px+ targets, safe-area inset) — *More* opens a bottom sheet listing Planning + Model tools (and anything that doesn't fit). Within a group, tools render as a horizontal scrollable pill row under the top bar (the existing sub-tab pattern, restyled).
- **State**: `activeTool: ToolId` + per-group memory (port of the existing `sectionMemory`), synced to `?t=<toolId>` via `history.replaceState` (shareable/bookmarkable; read once on mount; no Next router changes).
- **Rendering**: `page.tsx` keeps the conditional-render chain keyed by tool id — every one of the 27 components renders byte-identically inside the new shell. The old `SECTIONS`/`Section`/`SubTab` exports are deleted after `MobileNav` and consumers are repointed (grep for all importers in the plan).

## Testing & acceptance

- Vitest: every primitive (incl. PlayerCell fallback path, Chip intents, Tabs keyboard arrows); `navigation.ts` completeness test asserting the 27 inventory ids exactly once + home; shell render tests (desktop/mobile nav, group switching, URL sync, per-group memory)
- `npx tsc --noEmit` + lint green; full vitest suite green (existing `page.test.tsx` sub-tab-order test rewritten for groups)
- Playwright (`npm run test:e2e` infra exists): smoke that every tool id renders without error in both viewport classes (one spec iterating ToolIds)
- **Inventory walkthrough**: final review checks all 27 tabs against `2026-06-12-uix01-feature-inventory.md` — features, interactions, gated flows (FPL-ID, auth) intact
- AA contrast table for all token pairs included in the plan and spot-verified

## Out of scope (later phases / never)

- Tab CONTENT redesign (UIX-03/04/05) — UIX-01 changes chrome only
- Home content (UIX-02)
- Removing vestigial items flagged in the inventory (tracked, untouched here)
- New routing architecture (stays an SPA with query-param sync)
- Deleting the legacy CSS variable aliases (UIX-05)
