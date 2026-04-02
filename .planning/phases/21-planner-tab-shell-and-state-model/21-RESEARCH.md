# Phase 21: Planner Tab Shell and State Model — Research

**Researched:** 2026-04-02
**Domain:** React component architecture, TypeScript state modeling, FPL transfer rules, Vitest unit testing
**Confidence:** HIGH

## Summary

Phase 21 is a pure TypeScript/React phase with no new external service dependencies. The work divides into four distinct parts: (1) navigation wiring — adding a sixth tab to both `page.tsx` desktop tabs and `MobileNav.tsx`; (2) a `PlannerTab` component shell with horizon selector and disabled generate button; (3) new planner types in `src/lib/types.ts`; (4) a `free-transfer-engine.ts` module with unit tests covering the FPL 2025/26 transfer banking rules.

The codebase already has working patterns for every piece of UI this phase needs. `GwToggle.tsx` provides the exact segmented button group pattern for the horizon selector (including dark mode, 44px tap targets, and `aria-pressed`). `MobileNav.tsx` is a 40-line file with a typed `TABS` constant — adding a sixth entry is a three-line change. The `Tab` type appears in two places (page.tsx and MobileNav.tsx) and D-05 explicitly accepts that duplication.

The most critical correctness concern is the free transfer accumulation logic. CONTEXT.md captures the complete 2025/26 FPL rules with an example sequence — this is the source of truth for unit tests. The key distinction that must be correct: Free Hit does NOT change the FT bank (carry through unchanged); Wildcard resets the FT bank to 1 the following GW. STATE.md flags a conflict in earlier docs (cap reported as both 5 and 2) — the correct cap is **2** banked FTs per the canonical FPL rules, and the CONTEXT.md example sequence confirms this.

**Primary recommendation:** Follow the locked decisions exactly. Use `structuredClone` for squad snapshot deep-copy (Claude's discretion — fastest, native, no dependency). Install `immer` and `use-immer` in this phase per roadmap decision, even though Phase 21 doesn't use them yet.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Planner shell content in Phase 21**
The Planner tab shows:
- A "Planning Horizon" heading
- A segmented button group: [1 GW] [2 GW] [3 GW] [4 GW] [5 GW]
- A disabled "Generate Plan" button below the selector

The disabled button establishes the layout shape so Phase 22 can activate it without restructuring. No placeholder output table or empty-state message in this phase.

**D-02: Mobile nav — "Plan" label, 6-tab compression**
The mobile bottom nav adds "Plan" as the 6th tab (short label for narrow fit). All 6 buttons remain `flex-1`; each gets ~62px on a 375px screen. The 44px min-height tap target is preserved. No scroll, no hiding of existing tabs.

Desktop tab label: "Planner" (full label, more room on desktop).

**D-03: Horizon selector — segmented button group**
Five toggle buttons in a horizontal row: `[1 GW] [2 GW] [3 GW] [4 GW] [5 GW]`. Matches the existing position filter pills and projected-points GW toggles (1/3/5 toggle). Default selection: 3 GWs (Claude's discretion on default).

Active button uses the same active style as existing filter pills in the app.

**D-04: State architecture — co-located in PlannerTab component**
All planner state lives inside a self-contained `PlannerTab` component. `page.tsx` renders `{activeTab === 'planner' && <PlannerTab />}` — no new state added to `page.tsx`.

```
page.tsx
  └ activeTab state (unchanged, adds 'planner' to Tab union)
  └ {activeTab === 'planner' && <PlannerTab />}

PlannerTab.tsx
  └ horizon: number (useState, default 3)
  └ planResult state (Phase 22+)
  └ <HorizonSelector />
  └ <PlannerOutput /> (Phase 22+)
```

State can be lifted to a PlannerContext in a later phase if cross-tree access is needed (e.g. Phase 24 squad snapshots reading planner state from outside PlannerTab). Do not pre-emptively create Context in Phase 21.

**D-05: Tab type — extend in both files**
The `Tab` type in `page.tsx` and the `TABS` array in `MobileNav.tsx` are currently duplicated. Add `'planner'` to both. No refactor to extract a shared TABS constant in this phase — Claude's discretion.

### Claude's Discretion

- Default horizon value (3 GWs recommended — middle of range, typical planning window)
- Free transfer unit test file location (alongside or near `transfer-engine.ts`)
- Squad snapshot deep-copy implementation (structuredClone vs JSON round-trip vs spread)
- Exact styling of disabled Generate Plan button (opacity, cursor-not-allowed)
- Whether to add a small icon to the Planner tab buttons (not required)

### Deferred Ideas (OUT OF SCOPE)

- PlannerContext — do not pre-emptively create in Phase 21
- Output table or empty-state message on the Planner tab
- Shared TABS constant extracted from page.tsx / MobileNav.tsx
- Phases 22–25 features (planning engine, output table, squad snapshots, manual edit)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-01 | User can set a planning horizon of 1–5 gameweeks | HorizonSelector component with segmented button group (1/2/3/4/5 GW). GwToggle.tsx pattern provides exact implementation template. |
| PLAN-08 | Planner is accessible via a new "Planner" tab in the navigation bar | Extend Tab union in page.tsx, add desktop tab button, extend TABS in MobileNav.tsx. Both files confirmed in codebase. |
</phase_requirements>

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component state with `useState` | Project standard |
| TypeScript | ^5 | Type definitions for planner model | Project standard |
| Vitest | ^4.1.2 | Unit tests for free transfer logic | Project standard — `npm test` runs `vitest run` |
| Tailwind CSS | ^4 | Styling for tab button and horizon selector | Project standard |

### To Install in This Phase
| Library | Version | Purpose | Why Now |
|---------|---------|---------|---------|
| immer | 11.1.4 | Immutable state updates for multi-GW plan steps | Roadmap decision: install in Phase 21, use from Phase 22 |
| use-immer | 0.11.0 | React hooks wrapping immer | Roadmap decision: install in Phase 21, use from Phase 22 |

**Installation:**
```bash
npm install immer use-immer
```

**Version verification:** Confirmed via npm registry on 2026-04-02.
- `immer`: 11.1.4 (current)
- `use-immer`: 0.11.0 (current)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| structuredClone (deep copy) | JSON.parse(JSON.stringify()) | structuredClone is native, handles more types, no string encoding overhead. JSON round-trip works for plain objects but fails on undefined/Date/Map values. |
| structuredClone (deep copy) | Lodash cloneDeep | Would add a dependency. structuredClone is sufficient and native in Node 17+ / all modern browsers. |
| immer (phase 22+) | useReducer + manual spread | immer makes multi-level state updates readable; useReducer would work but produces verbose action types for squad edits |

---

## Architecture Patterns

### Recommended Project Structure (new files this phase)

```
src/
├── app/
│   └── page.tsx                         # MODIFY: add 'planner' to Tab union + desktop tab button
├── components/
│   └── nav/
│       └── MobileNav.tsx                # MODIFY: add 'Plan' to TABS + extend Tab type
│   └── planner/
│       ├── PlannerTab.tsx               # NEW: shell component with horizon state
│       └── HorizonSelector.tsx          # NEW: segmented button group (1–5 GW)
├── lib/
│   ├── types.ts                         # MODIFY: add PlannerTypes section
│   └── free-transfer-engine.ts          # NEW: FT accumulation pure functions
tests/
└── lib/
    └── free-transfer-engine.test.ts     # NEW: unit tests for FT logic
```

### Pattern 1: Segmented Button Group (HorizonSelector)

**What:** Five toggle buttons in a bordered row, one active at a time.
**When to use:** Discrete selector with 3–7 options where all options fit on screen.
**Based on:** `GwToggle.tsx` — confirmed pattern in this codebase (verified in source).

```typescript
// Source: src/components/gem-table/GwToggle.tsx (existing codebase pattern)
// Adapted for HorizonSelector — 5 options instead of 3

'use client'

const HORIZONS = [1, 2, 3, 4, 5] as const
export type Horizon = (typeof HORIZONS)[number]

interface Props {
  value: Horizon
  onChange: (v: Horizon) => void
}

export function HorizonSelector({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Planning horizon"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600"
    >
      {HORIZONS.map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ${
            value === gw
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
```

**Key styling details from GwToggle.tsx (verified):**
- Active: `bg-zinc-900 dark:bg-white text-white dark:text-zinc-900`
- Inactive: `bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700`
- Container: `flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600`
- Touch target: `min-h-[44px] py-2.5 sm:py-1` (mobile 44px, desktop compact)
- Accessibility: `role="group"`, `aria-pressed` per button

### Pattern 2: MobileNav Tab Extension

**What:** Add a sixth entry to the typed TABS constant and extend the Tab type.
**Based on:** Existing MobileNav.tsx (verified 40-line file, confirmed structure).

```typescript
// Source: src/components/nav/MobileNav.tsx (existing — extend this)
type Tab = 'gems' | 'defcon' | 'squad' | 'club-form' | 'value-gems' | 'planner'

const TABS = [
  { id: 'gems',       label: 'Gems' },
  { id: 'defcon',     label: 'DefCon' },
  { id: 'squad',      label: 'Squad' },
  { id: 'club-form',  label: 'Form' },
  { id: 'value-gems', label: 'Values' },
  { id: 'planner',    label: 'Plan' },   // NEW — short label per D-02
] as const satisfies ReadonlyArray<{ id: Tab; label: string }>
```

**Width math (verified per D-02):** 6 × flex-1 on 375px = ~62px per button. At `text-xs font-medium`, "Plan" fits comfortably. The four-letter labels ("Gems", "Form") already demonstrate this works.

### Pattern 3: Free Transfer Accumulation (pure functions)

**What:** Stateless TypeScript functions that compute FT state transitions per GW.
**Why pure:** Easier to unit test; no side effects; matches existing transfer-engine.ts style.

```typescript
// Source: CONTEXT.md free_transfer_rules section (authoritative FPL 2025/26 rules)

export type ChipName = 'wildcard' | 'freehit' | 'bboost' | '3xc' | null

export interface FTState {
  available: number    // FTs available to use this GW (1 or 2)
  banked: number       // FTs banked coming into this GW (0 or 1, before adding the new GW's FT)
}

/**
 * Compute FT state for the NEXT gameweek given what happened this GW.
 *
 * @param currentAvailable  FTs available this GW (1 or 2)
 * @param transfersUsed     How many transfers were made this GW
 * @param chip              Chip played this GW, or null
 */
export function computeNextFTState(
  currentAvailable: number,
  transfersUsed: number,
  chip: ChipName,
): FTState {
  // Wildcard: resets bank to 1 next GW
  if (chip === 'wildcard') {
    return { available: 1, banked: 0 }
  }
  // Free Hit: bank passes through unchanged (as if GW didn't happen for FT purposes)
  if (chip === 'freehit') {
    // available next GW = min(currentAvailable + 1, 2) — bank is unchanged
    const nextAvailable = Math.min(currentAvailable + 1, 2)
    return { available: nextAvailable, banked: nextAvailable - 1 }
  }
  // Normal GW
  const unused = Math.max(0, currentAvailable - transfersUsed)
  const banked = Math.min(1, unused)           // cap: carry at most 1 unused FT forward
  const nextAvailable = 1 + banked             // next GW gets 1 new FT + banked
  return { available: nextAvailable, banked }
}

/**
 * Compute hit cost for extra transfers in a GW.
 * Returns a negative number (points deducted).
 */
export function computeHitCost(
  available: number,
  transfersUsed: number,
  chip: ChipName,
): number {
  if (chip === 'wildcard' || chip === 'freehit') return 0
  const hits = Math.max(0, transfersUsed - available)
  return hits * -4
}
```

### Pattern 4: Squad Snapshot Deep-Copy

**What:** `structuredClone` for deep-copying squad arrays.
**Why structuredClone over alternatives:**
- Native (Node 17+, all modern browsers — Next.js 16/React 19 target audience has 100% coverage)
- Handles `undefined`, typed arrays, `Date` — more correct than JSON round-trip
- No dependency (vs lodash cloneDeep)
- Faster than JSON round-trip for typical 15-player squad arrays

```typescript
// Pattern for snapshot isolation — prevents cross-GW mutation
function snapshotSquad(squad: SquadPlayer[]): SquadPlayer[] {
  return structuredClone(squad)
}
```

**Verification test (what the unit test should confirm):**
```typescript
it('editing a snapshot does not affect the original', () => {
  const original: SquadPlayer[] = [{ id: 1, name: 'Player A' }]
  const copy = structuredClone(original)
  copy[0].name = 'Modified'
  expect(original[0].name).toBe('Player A')  // original unchanged
})
```

### Pattern 5: Planner Types in types.ts

Add a clearly delimited planner types section at the bottom of `src/lib/types.ts`:

```typescript
// ---------------------------------------------------------------------------
// Planner types (Phase 21+)
// ---------------------------------------------------------------------------

export type PlannerHorizon = 1 | 2 | 3 | 4 | 5

export type PlannerChip = 'wildcard' | 'freehit' | 'bboost' | '3xc' | null

/** One gameweek step in the multi-GW plan */
export interface GWStep {
  gw: number                  // gameweek number
  chip: PlannerChip
  transfersIn: number[]       // player IDs being brought in
  transfersOut: number[]      // player IDs being sold
  freeTransfersAvailable: number
  hitCost: number             // 0 or negative (multiples of -4)
}

/** Top-level planner state (Phase 22+ will populate planSteps) */
export interface PlannerState {
  horizon: PlannerHorizon
  planSteps: GWStep[]         // length === horizon; empty in Phase 21
}
```

### Anti-Patterns to Avoid

- **Mutating plan steps directly:** Each GW step must be a separate object (structuredClone on read). Directly mutating `planSteps[0].transfersIn.push(id)` will corrupt shared reference if not cloned first.
- **Pre-creating PlannerContext in Phase 21:** D-04 locks against this. State lives in PlannerTab only.
- **Adding planResult or generatePlan logic:** These are Phase 22 concerns. PlannerTab in Phase 21 has only `horizon` state.
- **Using JSON.parse(JSON.stringify()) for deep copy:** Drops `undefined` values and fails silently on complex types. Use `structuredClone`.
- **Tab type drift:** Tab type in page.tsx and MobileNav.tsx must both be updated. D-05 accepts duplication but requires consistency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep object cloning | Custom recursive clone | `structuredClone` (native) | Handles edge cases, native, zero-dependency |
| Segmented toggle buttons | Custom stateful button group | Extend `GwToggle.tsx` pattern | Already tested, dark-mode aware, 44px touch targets |
| Immutable multi-step plan edits (Phase 22+) | Manual spread operators across nested GWStep arrays | `immer` / `use-immer` | Install now, use Phase 22 — prevents reference bugs in nested state |

**Key insight:** The FT accumulation logic has no library equivalent — this is genuinely custom domain logic. But the surrounding infrastructure (test framework, component patterns, deep copy) all have standard solutions already in use.

---

## Free Transfer Rules Reference (2025/26)

These rules are from CONTEXT.md (canonical source — do not re-research):

| Situation | FT Count Next GW | Hit Cost |
|-----------|-----------------|----------|
| Use 0 of N FTs | min(N+1, 2) | 0 |
| Use all N FTs | 1 | 0 |
| Use N+k FTs (k hits) | 1 | -4k |
| Wildcard played | 1 (resets) | 0 |
| Free Hit played | Unchanged (carry through) | 0 |
| TC / Bench Boost | Unchanged | 0 |

**Cap:** Maximum 2 FTs can be banked at any time. Bank 1 unused FT forward — never more.

**Example sequence (from CONTEXT.md) — unit tests MUST match this:**
- GW1: 1 FT available, use 0 → bank 1 → GW2 has 2 FTs
- GW2: 2 FTs available, use 2 → GW3 has 1 FT (cap resets)
- GW3: 1 FT available, use 3 → cost = -8 pts (2 hits), GW4 has 1 FT
- GW4: Wildcard → 0 hit, GW5 has 1 FT (resets)
- GW5: 1 FT available, use 0 → bank 1 → GW6 has 2 FTs
- GW6: Free Hit → 0 hit, GW7 has 2 FTs (bank unchanged from GW5 carry)

**Blocker resolution (STATE.md):** Free transfer cap conflict (5 vs 2 in earlier docs) — the correct answer is **2**. The CONTEXT.md example sequence demonstrates this unambiguously (GW1: 1 FT + 1 banked = cap at 2).

---

## Common Pitfalls

### Pitfall 1: Free Hit FT Threading
**What goes wrong:** Treating Free Hit like Wildcard and resetting the bank to 1 after.
**Why it happens:** Both chips make all transfers free that GW, so they look identical.
**How to avoid:** Free Hit = bank passes through as if the GW didn't happen for FT purposes. Wildcard = bank resets to 1 next GW.
**Warning signs:** Unit test for GW6/GW7 Free Hit case fails; GW7 shows 1 FT instead of 2.

### Pitfall 2: FT Cap Off-by-One
**What goes wrong:** Allowing 3 banked FTs (e.g., `Math.min(2, unused)` instead of `Math.min(1, unused)`).
**Why it happens:** Confusing "maximum available" (2) with "maximum banked" (1). You bank 1 unused, then add 1 new FT = 2 available.
**How to avoid:** The bank accumulation formula is: `banked = Math.min(1, unused)`, then `nextAvailable = 1 + banked`. Maximum available is always ≤ 2.

### Pitfall 3: Tab Type Mismatch
**What goes wrong:** Adding `'planner'` to page.tsx Tab type but forgetting MobileNav.tsx (or vice versa), causing TypeScript to reject `onTabChange('planner')` call at the MobileNav boundary.
**Why it happens:** The Tab type is duplicated across two files (D-05 accepts this).
**How to avoid:** Update both files in the same task. The MobileNav interface `onTabChange: (tab: Tab) => void` must accept `'planner'`.

### Pitfall 4: structuredClone on Non-Plain Objects
**What goes wrong:** Using structuredClone on objects containing functions, class instances, or Proxy objects — throws DataCloneError.
**Why it happens:** structuredClone uses the structured clone algorithm (same as postMessage).
**How to avoid:** GWStep and SquadPlayer types must only contain plain data (numbers, strings, arrays, plain objects). No function properties. This is already the project pattern.

### Pitfall 5: Disabled Button Styling
**What goes wrong:** Disabled Generate Plan button is visually identical to an enabled button, or has no `disabled` attribute set (causing it to still receive click events).
**Why it happens:** Forgetting the HTML `disabled` attribute when only adding Tailwind classes.
**How to avoid:** Use `<button disabled className="... opacity-50 cursor-not-allowed">`. The `disabled` HTML attribute suppresses click events; Tailwind classes handle visual feedback.

---

## Code Examples

### Desktop Tab Button (page.tsx pattern — extend the existing series)
```typescript
// Source: src/app/page.tsx (existing pattern — add one more button matching the others)
<button
  className={`pb-2 px-1 text-sm font-medium ${
    activeTab === 'planner'
      ? 'border-b-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
  }`}
  onClick={() => setActiveTab('planner')}
>
  Planner
</button>
```

### PlannerTab Shell
```typescript
// src/components/planner/PlannerTab.tsx
'use client'

import { useState } from 'react'
import { HorizonSelector } from './HorizonSelector'
import type { PlannerHorizon } from '@/lib/types'

export function PlannerTab() {
  const [horizon, setHorizon] = useState<PlannerHorizon>(3)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Planning Horizon
        </h2>
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </div>
      <button
        disabled
        className="px-4 py-2 rounded text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 opacity-40 cursor-not-allowed"
      >
        Generate Plan
      </button>
    </div>
  )
}
```

### Unit Test Structure (free-transfer-engine.test.ts)
```typescript
// Source: tests/lib/free-transfer-engine.test.ts (NEW — mirrors transfer-engine.test.ts structure)
import { describe, it, expect } from 'vitest'
import { computeNextFTState, computeHitCost } from '@/lib/free-transfer-engine'

describe('computeNextFTState — normal GW', () => {
  it('banking: 1 FT available, use 0 → GW2 has 2 FTs', () => {
    const next = computeNextFTState(1, 0, null)
    expect(next.available).toBe(2)
  })
  // ... full example sequence from CONTEXT.md
})

describe('computeNextFTState — Wildcard', () => {
  it('resets bank to 1 regardless of current state', () => {
    const next = computeNextFTState(2, 5, 'wildcard')
    expect(next.available).toBe(1)
  })
})

describe('computeNextFTState — Free Hit', () => {
  it('bank passes through unchanged: 2 FTs in → 2 FTs out', () => {
    const next = computeNextFTState(2, 5, 'freehit')
    expect(next.available).toBe(2)
  })
})
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is purely code/config changes. No external services, databases, or CLI tools required beyond the project's existing Node.js/npm stack (already confirmed operational).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root — verified) |
| Quick run command | `npx vitest run tests/lib/free-transfer-engine.test.ts` |
| Full suite command | `npm test` (`vitest run`) |

**Vitest config (verified):**
- `globals: true`
- `environment: 'node'`
- `exclude: ['**/node_modules/**', '**/dist/**', '.claude/**']`
- Path alias `@` → `./src`

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | Horizon selector renders with 5 options, default is 3 | unit (component) | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | FT banking: use 0 of 1 → 2 available next GW | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | FT cap: can never accumulate more than 2 available FTs | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | Hit cost: 2 extra transfers = -8 pts | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | Wildcard: all transfers free, bank resets to 1 next GW | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | Free Hit: bank unchanged after chip GW | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | Full example sequence from CONTEXT.md passes end-to-end | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-01 | Squad snapshot: editing copy does not mutate original | unit | `npx vitest run tests/lib/free-transfer-engine.test.ts` | ❌ Wave 0 |
| PLAN-08 | Planner tab renders without error (navigation integration) | smoke (manual) | visual check | manual-only |

**Note:** PLAN-08 (navigation rendering) is a visual/runtime check — not automatable with Vitest node environment. It requires `npm run dev` and browser inspection.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/free-transfer-engine.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/free-transfer-engine.test.ts` — covers PLAN-01 FT logic + snapshot isolation
- [ ] `src/lib/free-transfer-engine.ts` — the module under test (must exist before test can run)

*(No gaps in existing infrastructure — vitest.config.ts, node environment, and `@` alias all confirmed present)*

---

## Open Questions

1. **immer peer dependency compatibility with React 19 / Next.js 16**
   - What we know: immer 11.x supports React 19 (pure TS library, no React peer dep). use-immer 0.11.0 lists React 16+ as peer dep.
   - What's unclear: Whether use-immer 0.11.0 has any issues with React 19.2.4 (no explicit test found).
   - Recommendation: Install and run `npm test` after install to catch any breakage. immer itself has no React dependency — only use-immer wraps hooks.

2. **Free Hit FT carry-through: starting FT count**
   - What we know: CONTEXT.md states "FT bank is unchanged (carry through as if Free Hit GW didn't happen)."
   - What's unclear: Whether "unchanged" means the bank value entering the chip GW, or the value after computing what would have happened without the chip.
   - Recommendation: The CONTEXT.md example (GW6 Free Hit → GW7 has 2 FTs, inherited from GW5's bank of 1+1=2) confirms it means the bank entering the chip GW passes through. Implement and test this exact example.

---

## Sources

### Primary (HIGH confidence)
- `src/components/gem-table/GwToggle.tsx` — segmented button group pattern, exact Tailwind classes, dark mode, aria attributes
- `src/components/gem-table/PositionFilter.tsx` — filter pill styling reference
- `src/components/nav/MobileNav.tsx` — existing nav structure (40 lines, confirmed)
- `src/app/page.tsx` — existing Tab type and desktop tab rendering (confirmed)
- `src/lib/types.ts` — existing type conventions
- `src/lib/transfer-engine.ts` — pure function module pattern to follow
- `tests/lib/transfer-engine.test.ts` — test file structure pattern (makeScoredPlayer factory, describe/it hierarchy)
- `vitest.config.ts` — confirmed test runner config
- `.planning/phases/21-planner-tab-shell-and-state-model/21-CONTEXT.md` — canonical FPL 2025/26 FT rules with example sequence
- `.planning/STATE.md` — roadmap decision: immer + use-immer install in Phase 21

### Secondary (MEDIUM confidence)
- npm registry (2026-04-02): immer@11.1.4, use-immer@0.11.0 — current versions confirmed

### Tertiary (LOW confidence)
- None — all claims verified against codebase source files or CONTEXT.md.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against registry; existing packages confirmed in package.json
- Architecture: HIGH — all patterns sourced from existing codebase files read directly
- FT logic: HIGH — rules sourced from CONTEXT.md with example sequence; blocker from STATE.md resolved
- Test infrastructure: HIGH — vitest.config.ts and tests/ directory structure confirmed
- Pitfalls: HIGH — sourced from code inspection and locked decisions in CONTEXT.md

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable — no fast-moving dependencies)
