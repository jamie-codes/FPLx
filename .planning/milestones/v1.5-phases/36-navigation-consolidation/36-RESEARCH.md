# Phase 36: Navigation Consolidation — Research

**Researched:** 2026-04-29
**Domain:** React client-state navigation refactor (Next.js 16 / React 19 / Tailwind CSS)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-tier desktop bar — section row on top (Analyse / Plan / Squad) with `border-b` underline style; clicking a section renders a second row immediately below showing that section's sub-tabs (also `border-b` underline style).
- **D-02:** When Squad is the active section, the sub-tab row is hidden entirely — content renders directly below the section bar with no empty second row.
- **D-03:** Mobile bottom bar shows 3 section buttons. A second fixed row of pills sits immediately above the bottom bar, showing the active section's sub-tabs. Squad section shows no pill row. Both rows are fixed at the bottom of the viewport.
- **D-04:** Sub-tab pill labels use abbreviated names matching the existing MobileNav convention: Analyse → Gems | Insights | DefCon | SP; Plan → Planner | Form | Values.
- **D-05:** Each section remembers the last visited sub-tab within the session. Returning to Analyse after visiting Squad restores the previously active Analyse sub-tab.
- **D-06:** Default landing state is Analyse → Gem Ratings — unchanged from current behaviour.

### Claude's Discretion

- How to model section + sub-tab state internally (flat `activeTab` with lookup vs nested `{ section, subTab }` object) — Claude picks whichever fits cleanest with the existing `page.tsx` pattern.
- Sub-tab pill styling on mobile (active vs inactive colours, border, background) — match existing dark-mode-aware Tailwind tokens already in `MobileNav`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | User can navigate via three top-level section tabs: Analyse, Plan, Squad | State model + section SECTIONS constant; `page.tsx` refactor |
| NAV-02 | Analyse section groups sub-tabs: Gem Ratings, Insights, DefCon Analysis, Set Pieces | SECTIONS data structure; sub-tab row render logic |
| NAV-03 | Plan section groups sub-tabs: Planner, Club Form, Value Gems | SECTIONS data structure; sub-tab row render logic |
| NAV-04 | Squad section shows Squad & Transfers as single view (no sub-tabs) | Conditional sub-tab row hide; `activeSection === 'squad'` guard |
| NAV-05 | Mobile nav reflects 3-section grouping with accessible sub-tab navigation within each section | `MobileNav.tsx` full rewrite; pill row above section bar |
</phase_requirements>

---

## Summary

Phase 36 is a pure navigation restructuring: replace the flat 8-button tab bar (`page.tsx` + `MobileNav.tsx`) with a 3-section hierarchy. No new content components are added or modified. The entire change lives in two files — `src/app/page.tsx` (desktop nav + state) and `src/components/nav/MobileNav.tsx` (mobile nav) — with a single shared `SECTIONS` constant driving both.

The UI-SPEC and CONTEXT decisions are already fully resolved and specify exact component markup, Tailwind class strings, state shape, and copy. The research confirms that the prescribed patterns are correct for Next.js 16 / React 19 / Tailwind v4, and there are no library or framework surprises to plan around.

The one non-trivial task is the atomic `Tab` type rename: both files currently declare `type Tab = '...'`. Both must be updated together in the same plan step (Phase 33 Pitfall 3 precedent from CONTEXT.md canonical refs). The UI-SPEC resolves this by replacing `Tab` with separate `Section` and `SubTab` union types defined in `page.tsx` and imported by `MobileNav`.

**Primary recommendation:** Implement in two tasks — (1) state model + desktop nav in `page.tsx`, (2) MobileNav rewrite. Both must land in the same logical unit because `page.tsx` passes the new props to MobileNav and the old props interface is deleted.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Section / sub-tab state ownership | Browser / Client (`page.tsx`) | — | All tabs are client-rendered; state lives in `useState` in the single page component |
| Desktop section row render | Browser / Client (`page.tsx`) | — | Inline JSX in `page.tsx`; no separate component needed |
| Mobile bottom nav render | Browser / Client (`MobileNav.tsx`) | — | Existing dedicated component; receives props from `page.tsx` |
| Responsive show/hide (desktop vs mobile) | Browser / Client (CSS only) | — | `hidden sm:flex` / `sm:hidden` CSS breakpoints; no JS media query detection |
| Content component switching | Browser / Client (`page.tsx`) | — | Existing conditional render by `activeSubTab`; re-wire from `activeTab` to `activeSubTab` |
| Type definitions (Section, SubTab) | Browser / Client (`page.tsx`) | Consumed by `MobileNav.tsx` | Single source of truth in `page.tsx`; `MobileNav` imports the types |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 (installed) | Client state (`useState`), component rendering | Project runtime — `'use client'` boundary already in both files |
| Next.js | 16.2.1 (installed) | App framework | Project framework — no routing APIs needed for this phase |
| Tailwind CSS | v4 (via `@import "tailwindcss"` in globals.css) | Utility classes for all styling | Existing project convention; all nav classes are Tailwind utilities |

No new libraries required. This phase is a pure refactor of existing component code.

**Version verification:** [VERIFIED: package.json + installed node_modules]
- `react` 19.2.4
- `next` 16.2.1
- `tailwindcss` loaded via `@import "tailwindcss"` in globals.css (v4 import syntax) [VERIFIED: globals.css line 1]

### Supporting (test tier)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.2 (installed) | Test runner | All unit/component tests |
| @testing-library/react | 16.3.2 (installed) | JSX render + DOM assertions | Component render tests |
| jsdom | 25.0.1 (installed) | DOM environment | Configured globally in vitest.config.ts |

**Installation:** No new installs required.

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (Client Component)
  │
  ├─ useState: activeSection ('analyse' | 'plan' | 'squad')
  ├─ useState: sectionMemory ({ analyse: SubTab, plan: SubTab, squad: null })
  │   └─ derived: activeSubTab = sectionMemory[activeSection]
  │
  ├─ [sm:flex hidden] Desktop Section Row (NAV-01)
  │   └─ SECTIONS.map → section buttons with active underline
  │
  ├─ [sm:flex hidden] Desktop Sub-tab Row (NAV-02, NAV-03)
  │   └─ hidden when activeSection === 'squad' (NAV-04)
  │   └─ activeSectionDef.subTabs.map → sub-tab buttons
  │
  ├─ Content area: conditional render by activeSubTab
  │   ├─ 'gems'       → <GemTable /> + <CaptainPicksPanel />
  │   ├─ 'insights'   → <InsightsTab />
  │   ├─ 'defcon'     → <DefConTables />
  │   ├─ 'set-pieces' → <SetPieceTakerPanel />
  │   ├─ 'planner'    → <PlannerTab />
  │   ├─ 'club-form'  → <FixtureEaseRankingPanel /> + <ClubFormTable />
  │   ├─ 'value-gems' → <ValueGemsTable />
  │   └─ squad (no subTab) → <TransferPanel />
  │
  └─ <MobileNav
       activeSection={activeSection}
       activeSubTab={activeSubTab}
       onSectionChange={handleSectionChange}
       onSubTabChange={handleSubTabChange}
     />
       │
       └─ [sm:hidden fixed bottom-0]
           ├─ Pill row (hidden when activeSection === 'squad')
           │   └─ activeSectionDef.subTabs.map → pill buttons
           └─ Section bar
               └─ SECTIONS.map → section buttons
```

### Recommended Project Structure

No structural changes. Both files already exist:

```
src/
├── app/
│   └── page.tsx        # Desktop nav + all state lives here
└── components/
    └── nav/
        └── MobileNav.tsx   # Mobile nav — receives props from page.tsx
```

The `SECTIONS` constant (the single source of truth for section/sub-tab definitions) should be defined at the top of `page.tsx` and exported for `MobileNav` to import, OR defined in a shared file such as `src/lib/nav-sections.ts`. The UI-SPEC defines the full `SECTIONS` constant inline in `page.tsx` — placing it in `page.tsx` is simplest and avoids a new file for a phase that is already minimal scope.

### Pattern 1: SECTIONS Constant (Single Source of Truth)

**What:** A `const` array driving both desktop and mobile nav from one place.
**When to use:** Any time the same set of labels/IDs is rendered in two components.

```typescript
// Source: 36-UI-SPEC.md §Component Inventory
type Section = 'analyse' | 'plan' | 'squad'
type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems'

const SECTIONS = [
  {
    id: 'analyse' as Section,
    label: 'Analyse',
    subTabs: [
      { id: 'gems' as SubTab,       label: 'Gem Ratings',     mobileLabel: 'Gems'     },
      { id: 'insights' as SubTab,   label: 'Insights',        mobileLabel: 'Insights' },
      { id: 'defcon' as SubTab,     label: 'DefCon Analysis', mobileLabel: 'DefCon'   },
      { id: 'set-pieces' as SubTab, label: 'Set Pieces',      mobileLabel: 'SP'       },
    ],
    defaultSubTab: 'gems' as SubTab,
  },
  {
    id: 'plan' as Section,
    label: 'Plan',
    subTabs: [
      { id: 'planner' as SubTab,   label: 'Planner',    mobileLabel: 'Planner' },
      { id: 'club-form' as SubTab, label: 'Club Form',  mobileLabel: 'Form'    },
      { id: 'value-gems' as SubTab,label: 'Value Gems', mobileLabel: 'Values'  },
    ],
    defaultSubTab: 'planner' as SubTab,
  },
  {
    id: 'squad' as Section,
    label: 'Squad',
    subTabs: [],
    defaultSubTab: null,
  },
] as const
```

[VERIFIED: 36-UI-SPEC.md §Component Inventory — Section + Sub-tab Data Map]

### Pattern 2: Nested State Model

**What:** Two `useState` hooks — `activeSection` and `sectionMemory` — replace the flat `activeTab`.
**When to use:** When a UI has independent memory per section (D-05).

```typescript
// Source: 36-UI-SPEC.md §State Model
const [activeSection, setActiveSection] = useState<Section>('analyse')
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems',
  plan: 'planner',
  squad: null,
})

const activeSubTab = sectionMemory[activeSection]

function handleSectionChange(section: Section) {
  setActiveSection(section)
  // sectionMemory already holds last sub-tab for this section — no reset (D-05)
}

function handleSubTabChange(subTab: SubTab) {
  setSectionMemory(prev => ({ ...prev, [activeSection]: subTab }))
}
```

[VERIFIED: 36-UI-SPEC.md §State Model]

### Pattern 3: Squad Content Render (No Sub-tab Key)

**What:** When `activeSection === 'squad'`, `activeSubTab` is `null`. The content switch must handle `null` as the squad branch.
**When to use:** Any time the section has no sub-tabs (Squad only).

```typescript
// Content area — squad branch uses activeSection, not activeSubTab
{activeSection === 'squad' && <TransferPanel />}
{activeSubTab === 'gems' && <> <GemTable /> <CaptainPicksPanel /> </>}
{activeSubTab === 'defcon' && <DefConTables />}
{activeSubTab === 'set-pieces' && <SetPieceTakerPanel />}
{activeSubTab === 'insights' && <InsightsTab />}
{activeSubTab === 'planner' && <PlannerTab />}
{activeSubTab === 'club-form' && <> <FixtureEaseRankingPanel /> <ClubFormTable /> </>}
{activeSubTab === 'value-gems' && <ValueGemsTable />}
```

[ASSUMED] — derived from current `page.tsx` content render pattern; squad guard uses `activeSection` not `activeSubTab`.

### Pattern 4: MobileNav Props Change

**What:** `MobileNav` props interface changes from `{ activeTab, onTabChange }` to `{ activeSection, activeSubTab, onSectionChange, onSubTabChange }`.
**When to use:** Only one call site (`page.tsx` line 138) — both must be updated atomically.

```typescript
// New MobileNav interface
interface MobileNavProps {
  activeSection: Section
  activeSubTab: SubTab | null
  onSectionChange: (section: Section) => void
  onSubTabChange: (subTab: SubTab) => void
}
```

[VERIFIED: 36-UI-SPEC.md §State Model + existing MobileNav.tsx]

### Anti-Patterns to Avoid

- **Separate Section and SubTab state files:** Splitting `SECTIONS` across multiple files adds indirection with zero benefit for a two-file refactor. Keep it in `page.tsx`.
- **JS media-query detection for responsive breakpoints:** The project uses `hidden sm:flex` / `sm:hidden` CSS-only breakpoints. Do not add `useMediaQuery` hooks or window resize listeners.
- **Updating Tab type without updating both files atomically:** Phase 33 Pitfall 3 — `type Tab` is declared in BOTH `page.tsx` and `MobileNav.tsx`. The rename to `Section`/`SubTab` must update both files in the same task to avoid TypeScript errors during intermediate states.
- **Adding an empty sub-tab row for Squad:** D-02 and D-03 explicitly prohibit rendering an empty second row when Squad is active. The conditional must be `{activeSection !== 'squad' && <...sub-tab row...>}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active tab underline highlight | Custom CSS animation or JS class toggle | Tailwind conditional class string (`border-b-2 border-zinc-900`) | Already the established pattern in `page.tsx` lines 38–40; no new logic needed |
| Dark mode colour switching | Manual `window.matchMedia` detection | `dark:` Tailwind prefix | Already the project convention; `@custom-variant dark` declared in globals.css |
| Safe-area bottom padding (iOS) | JS safe-area calculation | `nav-safe-bottom` CSS class + `env(safe-area-inset-bottom)` | Already defined in globals.css and applied to `MobileNav`'s `<nav>` wrapper |
| Per-section last-tab memory | localStorage or URL param | `useState` with `sectionMemory` object | D-05 requires session-only memory; `useState` is sufficient and simpler |

**Key insight:** Every building block for this phase already exists in the codebase. The work is re-wiring, not building new primitives.

---

## Common Pitfalls

### Pitfall 1: Forgetting the `Tab` Type Duplication (Phase 33 Precedent)

**What goes wrong:** Updating `type Tab` in `page.tsx` but leaving the old declaration in `MobileNav.tsx` (or vice versa) causes TypeScript to infer incompatible prop types. The app compiles but throws a type error on the `<MobileNav>` call site.
**Why it happens:** Both files currently declare `type Tab` independently (confirmed: `page.tsx` line 18, `MobileNav.tsx` line 3 both declare identical `type Tab = '...'`).
**How to avoid:** Replace both declarations in the same task. Define `Section` and `SubTab` in `page.tsx`; export them; import in `MobileNav.tsx`. Do not leave both files half-migrated between tasks.
**Warning signs:** TypeScript error on `<MobileNav activeSection=... />` props.

### Pitfall 2: Squad Sub-tab State (null vs undefined)

**What goes wrong:** `sectionMemory.squad` is typed as `SubTab | null`. If code checks `activeSubTab === undefined` instead of `activeSubTab === null`, Squad content never renders.
**Why it happens:** `useState` initialises `sectionMemory.squad` to `null` (explicit), not `undefined`.
**How to avoid:** Squad content branch guards on `activeSection === 'squad'`, not on `activeSubTab`. Content components for other tabs guard on `activeSubTab === '<id>'` which is always a non-null `SubTab` when `activeSection !== 'squad'`.

### Pitfall 3: Sub-tab Row mb-6 Placement

**What goes wrong:** Placing `mb-6` on the section row (not the sub-tab row) creates a visual gap between the section row and sub-tab row.
**Why it happens:** Current `page.tsx` has a single nav `<div>` with `mb-6`. The two-tier layout splits this — `mb-0` on the section row, `mb-6` on the sub-tab row (or on the section row when Squad is active).
**How to avoid:** Follow UI-SPEC exactly: section row container uses `mb-0`; sub-tab row container uses `mb-6`. When Squad is active and the sub-tab row is absent, apply `mb-6` as a class on the section row instead (or wrap both rows in a container with conditional margin).
**Warning signs:** Visual gap between the two nav rows, or no gap between nav and content.

### Pitfall 4: Mobile Pill Row Z-index / Overlap

**What goes wrong:** The pill row and section bar are both `fixed bottom-0`. The pill row must sit above (visually) the section bar, not behind it.
**Why it happens:** Both are children of the same `<nav>` — the pill row renders first (above), section bar renders second (below). This is correct stacking within the flex column. However, if `z-50` is applied to the wrong child instead of the parent `<nav>`, overlap with content may occur.
**How to avoid:** `z-50` stays on the `<nav>` wrapper only (as in existing `MobileNav`). Pill row and section bar are flex children inside the same `<nav>` — no individual z-index needed.

### Pitfall 5: Missing `aria-current` on Sub-tab Buttons

**What goes wrong:** Screen reader announces navigation but does not indicate which sub-tab is current.
**Why it happens:** Developers add `aria-current="page"` on section buttons but forget it on sub-tab buttons and mobile pills.
**How to avoid:** Apply `aria-current={activeSubTab === subTab.id ? 'page' : undefined}` on every sub-tab button, including mobile pills. Follow the UI-SPEC accessibility contract.

---

## Code Examples

### Desktop Section Row

```tsx
// Source: 36-UI-SPEC.md §Component Inventory — Desktop Two-Tier Nav
<nav aria-label="Section navigation" className="hidden sm:flex gap-4 border-b border-zinc-200 dark:border-zinc-700 mb-0">
  {SECTIONS.map((section) => (
    <button
      key={section.id}
      className={`pb-2 px-1 text-sm font-medium ${
        activeSection === section.id
          ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
      }`}
      onClick={() => handleSectionChange(section.id)}
      aria-current={activeSection === section.id ? 'page' : undefined}
    >
      {section.label}
    </button>
  ))}
</nav>
```

### Desktop Sub-tab Row (hidden for Squad)

```tsx
// Source: 36-UI-SPEC.md §Component Inventory — Desktop Two-Tier Nav
{activeSection !== 'squad' && (() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  return (
    <nav aria-label={`${activeSectionDef.label} sub-tabs`} className="hidden sm:flex gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-700">
      {activeSectionDef.subTabs.map((sub) => (
        <button
          key={sub.id}
          className={`pb-2 px-1 text-sm font-medium ${
            activeSubTab === sub.id
              ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
          onClick={() => handleSubTabChange(sub.id)}
          aria-current={activeSubTab === sub.id ? 'page' : undefined}
        >
          {sub.label}
        </button>
      ))}
    </nav>
  )
})()}
```

### Mobile Pill Row

```tsx
// Source: 36-UI-SPEC.md §Component Inventory — Mobile Two-Row Nav
{activeSection !== 'squad' && (() => {
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection)!
  return (
    <div className="flex gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
      {activeSectionDef.subTabs.map((sub) => (
        <button
          key={sub.id}
          className={`px-3 py-1 text-xs font-medium rounded-full active:scale-95 transition-transform ${
            activeSubTab === sub.id
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
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

### Mobile Section Bar

```tsx
// Source: 36-UI-SPEC.md §Component Inventory — Mobile Two-Row Nav
<div className="flex">
  {SECTIONS.map((section) => (
    <button
      key={section.id}
      className={`flex-1 flex flex-col items-center justify-center min-h-[44px] py-2 text-xs font-medium cursor-pointer active:scale-95 transition-transform ${
        activeSection === section.id
          ? 'text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-400 dark:text-zinc-500'
      }`}
      onClick={() => onSectionChange(section.id)}
      aria-current={activeSection === section.id ? 'page' : undefined}
    >
      {section.label}
    </button>
  ))}
</div>
```

---

## Runtime State Inventory

> This is a refactor phase. Checked all 5 categories.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — navigation state is session-only `useState`; nothing persists to localStorage, database, or cookies | None |
| Live service config | None — no external services reference tab names | None |
| OS-registered state | None — no OS-level registrations | None |
| Secrets/env vars | None — no env vars reference tab names | None |
| Build artifacts | None — the `Tab` type rename is TypeScript-only; no compiled artefacts embed the type string | None |

**Nothing found in any category** — verified by codebase inspection. Tab names appear only in `page.tsx` and `MobileNav.tsx` as TypeScript types and JSX string literals.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat 8-tab nav string (`activeTab`) | Section + sub-tab nested state (`activeSection` + `sectionMemory`) | This phase | Cleaner, supports per-section memory without lookup tables |
| `type Tab` duplicated in two files | `Section` / `SubTab` types exported from `page.tsx`, imported by `MobileNav` | This phase | Eliminates Phase 33 Pitfall 3 risk going forward |
| `MobileNav` props: `{ activeTab, onTabChange }` | `MobileNav` props: `{ activeSection, activeSubTab, onSectionChange, onSubTabChange }` | This phase | Props now reflect the two-tier navigation model |

**Note on Next.js 16 `<Activity>` component:** Next.js 16 introduces a `<Activity>` primitive (React 19 feature) for keeping hidden content mounted with `display: none`. This phase does NOT use `<Activity>` — the existing pattern of conditional `{activeTab === 'x' && <Component />}` unmounts inactive content, and there is no requirement to preserve scroll position or form state across tab switches. Using `<Activity>` would add complexity without user-visible benefit here. [VERIFIED: node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md — `cacheComponents: true` required, not set in `next.config.ts`]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Squad content branch guards on `activeSection === 'squad'` (not `activeSubTab === null`) in the content render area | Architecture Patterns §Pattern 3 | If guarded on `activeSubTab` instead, TransferPanel might not render when squad is active — low risk, trivially corrected |

**All other claims** in this research were verified against source files in the working directory or the UI-SPEC/CONTEXT documents.

---

## Open Questions

None. The CONTEXT.md, UI-SPEC, and existing codebase inspection fully resolve all planning decisions.

---

## Environment Availability

> Skipped — this phase has no external dependencies. It is a code-only refactor of two TypeScript/JSX files.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NAV-01 | Three section buttons render with correct labels | unit (component) | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ Wave 0 |
| NAV-02 | Analyse sub-tab row shows 4 correct sub-tabs | unit (component) | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ Wave 0 |
| NAV-03 | Plan sub-tab row shows 3 correct sub-tabs | unit (component) | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ Wave 0 |
| NAV-04 | Squad active: sub-tab row absent; Squad inactive: sub-tab row present | unit (component) | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ Wave 0 |
| NAV-05 | Mobile pill row renders abbreviated labels; pill row hidden for Squad | unit (component) | `npm test -- src/components/nav/MobileNav.test.tsx` | ❌ Wave 0 |
| D-05 | Section memory restores last sub-tab on return (e.g. Insights → Squad → Analyse restores Insights) | unit (component) | `npm test -- src/app/page.test.tsx` | ❌ Wave 0 |
| D-06 | Default landing state is Analyse → Gems | unit (component) | `npm test -- src/app/page.test.tsx` | ❌ Wave 0 |

**Note on test scope:** `page.tsx` is a Next.js page — rendering it in jsdom requires mocking all 8 child components. An alternative approach (validated by InsightsTab.test.tsx precedent) is to extract the SECTIONS constant and state logic into a separate testable function/hook. However, since all decisions are locked and the phase is small, the simplest approach is to test MobileNav in isolation (receives props; no async) and test page-level state with shallow mocks.

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/nav/MobileNav.test.tsx` — covers NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
- [ ] `src/app/page.test.tsx` — covers D-05, D-06 (section memory + default landing)

*(Existing test infrastructure — vitest + @testing-library/react + jsdom — covers all phase requirements. Only test files themselves are missing.)*

---

## Security Domain

> This phase touches only client-side navigation state (no API routes, no authentication, no input validation, no data persistence). No ASVS categories apply. All ASVS categories are N/A.

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on Phase |
|-----------|--------|-----------------|
| Read `node_modules/next/dist/docs/` before writing any code; heed deprecation notices | AGENTS.md | Confirmed: Next.js 16 introduces `<Activity>` / Cache Components but this phase does not need them; no deprecated APIs used |
| Do not add `Co-Authored-By` trailers to git commits | CLAUDE.md | Apply to all commits in this phase |

---

## Sources

### Primary (HIGH confidence)

- `src/app/page.tsx` — full current implementation read; tab type, state, render pattern confirmed
- `src/components/nav/MobileNav.tsx` — full current implementation read; props interface, class patterns confirmed
- `.planning/phases/36-navigation-consolidation/36-UI-SPEC.md` — authoritative design contract; all Tailwind classes, state shape, copy, and accessibility requirements
- `.planning/phases/36-navigation-consolidation/36-CONTEXT.md` — all locked decisions D-01 through D-06
- `src/app/globals.css` — `nav-safe-bottom` class, `@custom-variant dark` confirmed
- `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` — confirmed `<Activity>` is opt-in via `cacheComponents: true` (not set); does not affect this phase
- `vitest.config.ts` — test framework confirmed as Vitest 4.1.2, jsdom global environment
- `package.json` + node_modules — all library versions verified

### Secondary (MEDIUM confidence)

None required — all findings verified from primary sources.

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed from installed node_modules and package.json
- Architecture: HIGH — entire pattern derived from existing code + UI-SPEC; no external dependencies
- Pitfalls: HIGH — Pitfall 1 verified from Phase 33 CONTEXT.md canonical refs; others derived directly from existing code inspection

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable — pure client-side refactor with no external API dependencies)
