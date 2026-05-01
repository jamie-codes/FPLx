# Phase 43: Lineup Engine & Navigator - Research

**Researched:** 2026-04-30
**Domain:** TypeScript enumeration engine, React navigation wiring, Tailwind v4 CSS pitch layout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** OptimiserPanel uses pitch layout — GK at bottom (FPL convention), forwards at top. No SVG.
- **D-02:** Formation label shown above pitch (e.g. "Formation: 4-3-3").
- **D-03:** Captain = (C), VC = (VC) text labels next to player name. No armband icon.
- **D-04:** Bench shown below pitch as horizontal row of 4 slots. GK bench slot isolated at slot 0.
- **D-05:** Squad section default sub-tab = Transfers (muscle memory preserved).
- **D-06:** `SubTab` union gains `'transfers'` and `'optimiser'`; Squad SECTIONS entry gains two sub-tabs with `defaultSubTab: 'transfers'`.
- **D-07:** `sectionMemory` initial state: `squad: null` → `squad: 'transfers'`.
- **D-08:** `activeSection !== 'squad'` guard on the desktop sub-tab row is removed. Squad spacer `<div className="mb-6 hidden sm:block" />` is also removed.
- **D-09:** Content render guards: `activeSection === 'squad' && <TransferPanel />` splits into `activeSection === 'squad' && activeSubTab === 'transfers' && <TransferPanel .../>` and `activeSection === 'squad' && activeSubTab === 'optimiser' && <OptimiserPanel .../>`.
- **D-10:** MobileNav: Squad section shows sub-tab pill row when active (same pattern as Analyse/Plan).
- **D-11:** Team ID state lifted to `page.tsx`. Both TransferPanel and OptimiserPanel receive `teamId` as prop. TransferPanel refactored to accept `teamId`/`onTeamIdChange`/`squadPicks` props.
- **D-12:** Engine file: `src/lib/optimise-lineup.ts` — mirrors chip-strategy-engine.ts pattern.
- **D-13:** Engine input: `optimiseLineup({ picks: SquadPick[], players: MergedPlayer[], horizon: OptimiserHorizon })`.
- **D-14:** Engine output: `OptimisedLineup { starters: number[], bench: number[], captainId: number, vcId: number, formation: string }`.
- **D-15:** BGW exclusion uses `xPts_1gw === 0` as proxy. BGW players hard-excluded from starting XI.
- **D-16:** If eligible starters < 11 after BGW exclusion, show amber info banner above pitch. No pitch shown until ≥ 11 eligible.
- **D-17:** `OptimiserHorizon = 1 | 3 | 5` added to `src/lib/types.ts`. 3-button pill toggle (1GW | 3GW | 5GW) matching GwToggle visual pattern.
- **D-18:** Horizon state lives inside OptimiserPanel (local state). No cross-tab persistence.

### Claude's Discretion
- Exact CSS layout for pitch (CSS Grid or display:grid with named template areas per formation).
- Formation enum: support 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1 (valid FPL formations).
- Player circle diameter, typography, and spacing (follow existing Tailwind v4 patterns).
- No new npm dependencies.

### Deferred Ideas (OUT OF SCOPE)
- Pitch orientation toggle (portrait vs landscape)
- Formation preference picker
- Player locking (must-start pins)
- Captain swap what-if simulation
- CMP-01/02/03 (Phase 44), TFR-01/02/03 (Phase 45), CHIP-01/02/03 (Phase 46)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPT-01 | Best starting 11 + bench order + auto-selected formation from 15-player squad, scored by xPts | Engine D-12/D-13/D-14 — C(15,11)=1,365 subset enumeration with formation validation |
| OPT-02 | 1/3/5 GW horizon selector; scores and ranks by corresponding xPts window | `xPts_1gw`, `xPts_3gw`, `xPts_5gw` all confirmed on MergedPlayer (optional, may be undefined) |
| OPT-03 | Captain = highest xPts_90th_1gw starter; VC = second | `xPts_90th_1gw` confirmed on MergedPlayer (optional); fallback chain needed |
| OPT-04 | Bench order: GK at slot 0; outfield bench ordered by xPts descending | `element_type === 1` is GK; bench = picks with position >= 12 (SquadView confirms this pattern) |
| OPT-05 | BGW players hard-excluded; warning shown if < 11 eligible players | `xPts_1gw === 0` proxy (D-15); amber banner (D-16) |
| NAV-01 | Squad section gains Transfers/Optimiser sub-tabs; MobileNav shows Squad pills | page.tsx + MobileNav wiring (D-06 through D-10) |
</phase_requirements>

---

## Summary

Phase 43 delivers three independent deliverables that can be planned in separate waves: (1) the pure TypeScript engine `src/lib/optimise-lineup.ts`, (2) the navigation wiring changes across `page.tsx` and `MobileNav.tsx`, and (3) the `OptimiserPanel` UI component. The engine has no React dependencies and is independently unit-testable before the UI exists.

The C(15,11) = 1,365 subset enumeration is straightforward: iterate all 11-choose combinations from the 15 picks, validate each against FPL formation rules (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD, exactly 11 outfield+GK), score each valid formation by summing the horizon xPts field, and keep the highest-scoring subset. All confirmed fields exist on `MergedPlayer` (xPts_1gw, xPts_3gw, xPts_5gw, xPts_90th_1gw — all typed as optional). BGW exclusion via `xPts_1gw === 0` is consistent with the chip-strategy-engine's BGW handling pattern.

The navigation wiring is surgical: six specific changes to `page.tsx` (SubTab union, SECTIONS constant, sectionMemory init, guard removal, spacer removal, content render guards) plus one change to `MobileNav.tsx` (remove `activeSection !== 'squad'` guard, or more accurately the Squad check) and a parallel test update in both test files. The current tests that assert Squad has no pill row will need to be updated or deleted and replaced.

**Primary recommendation:** Implement in three waves — Wave 1: engine + types + unit tests; Wave 2: navigation wiring + test updates; Wave 3: OptimiserPanel UI + pitch layout.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lineup enumeration / scoring | Browser (client-side lib) | — | Pure TS, no server round-trip; 1,365 iterations in <1ms |
| BGW detection | Browser (engine) | — | `xPts_1gw === 0` check on MergedPlayer data already in client cache |
| Captain / VC selection | Browser (engine) | — | Derived from MergedPlayer.xPts_90th_1gw already in client cache |
| xPts field selection by horizon | Browser (engine) | — | Maps OptimiserHorizon 1/3/5 to field names on MergedPlayer |
| Squad data fetch | API (`/api/squad/[teamId]`) | — | Existing route; no new route needed |
| Team ID persistence | Browser (localStorage) | — | Currently in TransferPanel; lifted to page.tsx in D-11 |
| Section/sub-tab routing | Browser (page.tsx state) | — | Client state machine; no server involvement |
| Pitch layout CSS | Browser (CSS Grid) | — | Tailwind v4 utility classes; no SVG, no server |
| Horizon toggle | Browser (OptimiserPanel local state) | — | D-18: not lifted to page.tsx |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (project) | Engine types and logic | Project language |
| React | (project) | OptimiserPanel component | Project framework |
| Tailwind v4 | (project) | CSS pitch layout, player circles | Project CSS framework |
| @tanstack/react-query | (project) | useSquad hook (already exists) | Established data-fetching pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.2 (confirmed) | Engine unit tests | Already installed; quick run `npx vitest run` |
| @testing-library/react | (project) | Component integration tests | Already installed |

### No new dependencies
[VERIFIED: package.json, node_modules] The engine requires zero new npm packages. Subset enumeration is pure TypeScript. CSS pitch layout is Tailwind-only.

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (client state: activeSection, sectionMemory, teamId, squadData)
    |
    |-- Squad section active + 'transfers' subTab
    |       -> TransferPanel (receives teamId, onTeamIdChange, squadData props)
    |
    |-- Squad section active + 'optimiser' subTab
    |       -> OptimiserPanel (receives teamId, squadData, players props)
    |               |
    |               |-- horizon toggle (local state: 1|3|5)
    |               |-- optimiseLineup(picks, players, horizon)  [pure fn]
    |               |       |-- enumerate C(15,11) subsets
    |               |       |-- validate formation rules
    |               |       |-- BGW filter (xPts_1gw === 0)
    |               |       |-- score by horizon field (xPts_Ngw)
    |               |       |-- select captain (xPts_90th_1gw)
    |               |       `-- return OptimisedLineup
    |               |
    |               `-- render pitch (CSS Grid, GK bottom, FWD top)
    |                       |-- BGW amber banner (if eligible < 11)
    |                       |-- 11 starter circles with (C)/(VC) labels
    |                       `-- 4 bench slots (GK isolated slot 0)
    |
    `-- MobileNav (receives activeSection, activeSubTab, onSectionChange, onSubTabChange)
            `-- Squad active: shows pill row [Transfers | Optimiser]
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── types.ts                        # Add OptimiserHorizon, OptimisedLineup
│   └── optimise-lineup.ts              # New engine (mirrors chip-strategy-engine.ts)
├── lib/optimise-lineup.test.ts         # New engine unit tests
├── components/
│   └── optimiser/
│       └── OptimiserPanel.tsx          # New component
├── app/
│   ├── page.tsx                        # 6 surgical edits (D-06 to D-09, D-11)
│   └── page.test.tsx                   # Updated tests for Squad sub-tabs
└── components/nav/
    ├── MobileNav.tsx                   # Remove activeSection !== 'squad' guard
    └── MobileNav.test.tsx              # Updated tests for Squad pill row
```

### Pattern 1: Engine Structure (mirrors chip-strategy-engine.ts)

**What:** Pure TypeScript functions, no React imports, no side effects, typed I/O, exported for testing.
**When to use:** All engine logic in `src/lib/optimise-lineup.ts`.

```typescript
// Source: src/lib/chip-strategy-engine.ts (project pattern)
// No 'use client', no React imports, no side effects
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'

export type OptimiserHorizon = 1 | 3 | 5

export interface OptimisedLineup {
  starters: number[]     // FPL element IDs, length 11
  bench: number[]        // FPL element IDs, length 4; bench[0] = GK
  captainId: number
  vcId: number
  formation: string      // e.g. '4-3-3'
}

export function optimiseLineup(
  picks: SquadPick[],
  players: MergedPlayer[],
  horizon: OptimiserHorizon,
): OptimisedLineup | null  // null when < 11 eligible players
```

### Pattern 2: C(15,11) Subset Enumeration

**What:** Enumerate all 11-player combinations from 15 picks, validate formation, score by horizon xPts.
**When to use:** Inside `optimiseLineup`.

Key implementation notes:
- Generate all C(15,11) = 1,365 index combinations iteratively (no recursion needed; 4 nested loops or a generic combinations generator).
- For each 11-subset: count GKs, DEFs, MIDs, FWDs. Valid if: GK=1, DEF∈[3,5], MID∈[2,5], FWD∈[1,3], total=11, (DEF+MID+FWD)=10.
- BGW exclusion BEFORE enumeration: filter `picks` to remove players where the corresponding MergedPlayer has `xPts_1gw === 0` (or xPts_1gw is undefined/null). This reduces the pool.
- Score = sum of `player[xPts_field]` for the 11 starters. The xPts field selection:
  - `horizon === 1` → `xPts_1gw ?? 0`
  - `horizon === 3` → `xPts_3gw ?? 0`
  - `horizon === 5` → `xPts_5gw ?? 0`
- Track the highest-scoring valid subset.

[VERIFIED: src/lib/types.ts] All three fields confirmed optional (`xPts_1gw?: number`, `xPts_3gw?: number`, `xPts_5gw?: number`). Use `?? 0` fallback.

### Pattern 3: Captain Selection (D-03 / OPT-03)

**What:** Captain = highest `xPts_90th_1gw` among starters; VC = second highest. The ceiling metric is used regardless of horizon (it is always the 1GW 90th percentile — a risk-adjusted captain signal, not a cumulative metric).
**Fallback chain:** `xPts_90th_1gw ?? xPts_1gw ?? 0` — mirrors the TC candidate ranking in chip-strategy-engine.ts line 208.

[VERIFIED: src/lib/types.ts line 169] `xPts_90th_1gw?: number` — optional, may be undefined. Fallback is mandatory.

### Pattern 4: Bench Ordering (OPT-04)

**What:** Bench is the remaining 4 players (15 - 11 starters). bench[0] = the non-starting GK (identified by `element_type === 1`). bench[1..3] = the 3 non-starting outfield players ordered by horizon xPts descending.
**GK identification:** `picks` contains `element` (player ID); cross-reference with `MergedPlayer.element_type`. The bench GK is `element_type === 1` in the bench set. FPL squads always have exactly 2 GKs, so exactly 1 non-starting GK always exists.

[VERIFIED: src/lib/squad-adapter.ts] `SquadPick.element` is the player ID (integer). Cross-reference with MergedPlayer via playerMap.

[VERIFIED: src/lib/types.ts] `MergedPlayer.element_type: PositionCode` where `1 = GK`.

### Pattern 5: TransferPanel State Lifting (D-11)

**What:** TransferPanel currently owns `teamId`, `submittedId`, localStorage read/write. These move to `page.tsx`. TransferPanel becomes controlled.

Current internal state to lift:
- `teamId: string` — controlled input value
- `submittedId: string | null` — triggers `useSquad` query
- `handleSubmit` logic (localStorage write)
- `squadData` — passed down as prop to OptimiserPanel

Minimum props for refactored TransferPanel:
```typescript
interface TransferPanelProps {
  teamId: string
  onTeamIdChange: (id: string) => void
  submittedId: string | null
  onSubmit: () => void
  squadData: SquadPicksResponse | undefined
}
```

[VERIFIED: src/components/transfers/TransferPanel.tsx] All state confirmed local; hooks (`useSquad`, `useMyTeam`) are called inside TransferPanel with the local `submittedId`. The squad data fetch itself (`useSquad`) can remain inside TransferPanel or lift to page.tsx — both work. Lifting `squadData` to page.tsx is simpler for sharing with OptimiserPanel. However, `useMyTeam`, `useAuthStatus`, transfer computations can all remain in TransferPanel since OptimiserPanel does not need them.

**Simpler approach:** Lift only `teamId`/`submittedId` to page.tsx; let TransferPanel call `useSquad(submittedId)` internally; pass the result up via a callback or re-fetch in OptimiserPanel with the same `submittedId`. Since TanStack Query caches by key `['squad', teamId]`, both components calling `useSquad(submittedId)` will share the same cached response with zero extra network requests.

[VERIFIED: src/lib/hooks/useSquad.ts] Query key is `['squad', teamId]`; staleTime 5 minutes. Two components calling `useSquad` with the same teamId will share the cache.

### Pattern 6: SubTab Union Extension (D-06)

**What:** Add `'transfers'` and `'optimiser'` to the `SubTab` union type in `page.tsx`.

Current union:
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy'
```

New union (D-06):
```typescript
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy' | 'transfers' | 'optimiser'
```

[VERIFIED: src/app/page.tsx lines 22-23] Confirmed exact current union. Two additions needed.

### Pattern 7: MobileNav Guard Change (D-10)

**What:** MobileNav currently guards the pill row with `activeSection !== 'squad'`. Remove this guard — Squad now also shows pills.

[VERIFIED: src/components/nav/MobileNav.tsx line 18] The guard is `{activeSection !== 'squad' && (() => {...})()}`. This must be changed to render the pill row for all sections when `subTabs.length > 0`.

After Squad gains subTabs in SECTIONS, the pill row condition becomes: render pill row when `activeSectionDef.subTabs.length > 0`. Squad will have 2 sub-tabs, so the pill row appears automatically — the guard just needs to stop excluding Squad.

### Pattern 8: GwToggle Reuse for Horizon Selector

**What:** The 3-button horizon toggle in OptimiserPanel reuses GwToggle's visual pattern.
[VERIFIED: src/components/gem-table/GwToggle.tsx] `GwToggle` accepts `value: 1 | 3 | 5` and `onChange: (v: 1 | 3 | 5) => void`. Can be imported directly — the type `1 | 3 | 5` matches `OptimiserHorizon`.

### Pattern 9: Pitch CSS Layout

**What:** CSS Grid pitch layout, no SVG, Tailwind v4 utilities.

Approach (Claude's discretion):
- Outer container: `bg-emerald-950` or `bg-green-950` with rounded corners, relative positioning.
- Per-formation row layout using CSS Grid: each row is a `flex justify-center gap-x-4` row.
- Rows from bottom to top: GK row (1 player), DEF row (3-5 players), MID row (2-5 players), FWD row (1-3 players).
- Player "circles": `w-16 h-16` (or similar) `rounded-full bg-white/10` with player `web_name` text and xPts below.
- (C) and (VC) rendered as `<span className="text-xs font-bold text-amber-400">(C)</span>` next to web_name.
- Formation label and horizon toggle rendered in a flex row above the pitch.
- Bench row: `flex gap-2 mt-4 justify-center` with a visual separator between slot 0 (GK) and slots 1-3.

**Valid FPL formations** (3-DEF, 3-MID, 3-FWD counts for DEF-MID-FWD):
- 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1
- Formation string derived from starters: `${defCount}-${midCount}-${fwdCount}`

### Anti-Patterns to Avoid

- **Don't import React in the engine:** `optimise-lineup.ts` must have zero React imports (chip-strategy-engine.ts pattern).
- **Don't mutate SubTab checks without updating all guards:** `activeSection !== 'squad'` guards appear on the desktop sub-tab row (line 110) and in content render guards (lines 133-151). Both must be updated atomically.
- **Don't forget the spacer:** Line 129 in page.tsx (`{activeSection === 'squad' && <div className="mb-6 hidden sm:block" />}`) must be removed when D-08 is applied.
- **Don't use `>=` for tie-breaking in score selection:** chip-strategy-engine.ts uses `>` (first-found wins ties) — mirror this for consistency.
- **Don't assume xPts fields are always present:** All xPts fields are typed `?: number` — always use `?? 0` fallback.
- **Don't hardcode the TransferPanel check:** The content guard `activeSection === 'squad' && <TransferPanel />` (page.tsx line 132) must split into two guarded renders (D-09).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 3-button toggle UI | Custom pill toggle | `GwToggle` from `@/components/gem-table/GwToggle` | Already exists, typed `1|3|5`, correct visual pattern |
| Combination generator | Recursive permutation function | Iterative 4-nested-loops or a standard combinations helper | C(15,11) is small enough for simple nested iteration; no library needed |
| Squad data caching | Additional fetch/store logic | TanStack Query `useSquad(submittedId)` called in both panels | Query key deduplication provides zero-cost sharing |
| xPts field mapping | Switch/if chains per horizon | Object map `{ 1: 'xPts_1gw', 3: 'xPts_3gw', 5: 'xPts_5gw' }` | Cleaner and easier to extend |

**Key insight:** The FPL domain is small enough that brute-force enumeration beats any solver. C(15,11) = 1,365 is trivially fast; never introduce WASM solvers (explicitly ruled out in REQUIREMENTS.md).

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield feature addition, not a rename/refactor phase. No existing data stored under new names.

---

## Environment Availability

Step 2.6: All dependencies are already confirmed present.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Build, test | Yes | (project) | — |
| vitest | Engine unit tests | Yes | 4.1.2 (confirmed) | — |
| @testing-library/react | UI tests | Yes | (project) | — |
| Tailwind v4 | CSS pitch layout | Yes | (project) | — |
| TanStack Query | useSquad hook | Yes | (project) | — |

**Missing dependencies with no fallback:** None.

---

## Common Pitfalls

### Pitfall 1: Optional xPts Fields Are Undefined, Not Zero

**What goes wrong:** `xPts_1gw` is typed `?: number` (optional). If a player lacks pipeline data, the field is `undefined`, not `0`. Checking `xPts_1gw === 0` for BGW exclusion would incorrectly allow undefined players into the starting XI.

**Why it happens:** MergedPlayer uses optional fields for progressive pipeline rollout. Undefined means "no data" not "no expected points".

**How to avoid:** BGW exclusion check must be: `(player.xPts_1gw ?? -1) === 0` — treat undefined as non-zero (eligible) so the engine does not penalise players with missing data. Alternatively, exclude players where `xPts_1gw` is `undefined` or `null` as a separate pre-filter, but the CONTEXT decision says only `=== 0` is the BGW proxy.

**Correct interpretation of D-15:** `xPts_1gw === 0` means the field is present and equals exactly zero (BGW: pipeline ran but player has no fixture). `xPts_1gw === undefined` means the field is absent (pipeline not yet run for this player) — these players should NOT be excluded by the BGW filter.

**Warning signs:** Engine excludes more than 2-3 players from a normal squad; BGW banner fires when no BGW is expected.

### Pitfall 2: Captain Fallback Chain Must Cover xPts_90th_1gw = undefined

**What goes wrong:** `xPts_90th_1gw` is typed `?: number` and may be absent for some players (early pipeline runs). Captain selection that doesn't handle undefined will select undefined as "highest" or crash.

**How to avoid:** Use `(player.xPts_90th_1gw ?? player.xPts_1gw ?? 0)` for ranking. Mirror the TC fallback chain from chip-strategy-engine.ts line 208.

### Pitfall 3: Stale MobileNav Test for Squad Pill Absence

**What goes wrong:** `MobileNav.test.tsx` line 70-81 explicitly asserts that Squad active renders ONLY 3 section buttons (no pill row). After D-10, this assertion must be inverted — Squad active shows 2 pills (Transfers, Optimiser).

**How to avoid:** Rewrite the NAV-04 test to assert the Squad pill row IS present with 2 pills and correct labels. Do not merely delete the test — replace it with the new assertion.

[VERIFIED: src/components/nav/MobileNav.test.tsx lines 70-81] The test currently reads: `expect(allButtons).toHaveLength(3)` and asserts `textContent` does not contain Gems, Form, Planner, SP. After Phase 43, Squad shows 2 pills, so `allButtons` will be 5 (3 section + 2 Squad pills).

### Pitfall 4: page.test.tsx Squad Test Will Break

**What goes wrong:** `page.test.tsx` test "Squad section renders only TransferPanel — no sub-tab content visible (CR-01)" at line 116 navigates to Squad and asserts `transfer-panel` is visible. After D-09, Squad shows TransferPanel only when `activeSubTab === 'transfers'`. The initial Squad activeSubTab (D-07) will be `'transfers'`, so the test behaviour is preserved — TransferPanel appears immediately. But if the test also checks for absent sub-tab nav, the behaviour changes (Squad now HAS a desktop sub-tab row).

**How to avoid:** Update the test description and assertions to reflect that Squad now shows a sub-tab row AND TransferPanel is visible when Transfers is the active sub-tab. Verify the desktop sub-tab row is now visible for Squad.

### Pitfall 5: Formation String Derivation — Always Outfield Only

**What goes wrong:** Formation string `'4-3-3'` counts DEF-MID-FWD from the 10 outfield starters. The GK is NOT counted. If you accidentally count all 11, you get `'1-4-3-3'`.

**How to avoid:** Formation = `${starters.filter(isDefender).length}-${starters.filter(isMid).length}-${starters.filter(isFwd).length}` where starters excludes the GK starter.

### Pitfall 6: TransferPanel Refactor Scope Creep

**What goes wrong:** D-11 says lift `teamId` state to `page.tsx`. TransferPanel also owns `freeTransfers`, `isModalOpen`, auth state — these should NOT be lifted. Only the minimum state needed for sharing between panels lifts: `teamId` (input value), `submittedId` (submitted ID that triggers fetch).

**How to avoid:** Use the TanStack Query cache deduplication approach — both panels call `useSquad(submittedId)` independently. Only `teamId`/`submittedId` (and their setter/handler) lift to page.tsx. All auth, modal, transfer computation state stays in TransferPanel.

### Pitfall 7: Desktop Sub-tab Row `activeSection !== 'squad'` Guard

**What goes wrong:** Page.tsx line 110 wraps the entire desktop sub-tab `<nav>` in `{activeSection !== 'squad' && (() => {...})()}`. After D-08, this guard must be removed. But removing it naively shows an empty nav bar for Squad before D-06 adds sub-tabs to SECTIONS. These two changes are atomic — D-06 (add subTabs to Squad SECTIONS) and D-08 (remove guard) must be applied together.

---

## Code Examples

### Engine Skeleton (mirrors chip-strategy-engine.ts)

```typescript
// src/lib/optimise-lineup.ts — Source: chip-strategy-engine.ts pattern (project)
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'

export type OptimiserHorizon = 1 | 3 | 5

export interface OptimisedLineup {
  starters: number[]    // element IDs, length 11
  bench: number[]       // element IDs, length 4; [0] = GK
  captainId: number
  vcId: number
  formation: string     // 'DEF-MID-FWD' e.g. '4-3-3'
}

const HORIZON_FIELD: Record<OptimiserHorizon, keyof MergedPlayer> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}

export function optimiseLineup(
  picks: SquadPick[],
  players: MergedPlayer[],
  horizon: OptimiserHorizon,
): OptimisedLineup | null {
  const playerMap = new Map<number, MergedPlayer>(players.map(p => [p.id, p]))
  const field = HORIZON_FIELD[horizon]

  // BGW filter: exclude picks where xPts_1gw === 0 (not undefined)
  const eligible = picks.filter(pick => {
    const p = playerMap.get(pick.element)
    if (!p) return false
    return p.xPts_1gw !== 0  // undefined passes (no data != BGW)
  })

  if (eligible.length < 11) return null

  // enumerate C(n,11) and score...
  // [full implementation omitted from research — see pattern above]
}
```

### SubTab Union Extension (page.tsx D-06)

```typescript
// Source: src/app/page.tsx (verified current state)
// BEFORE:
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy'

// AFTER (D-06):
export type SubTab = 'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems' | 'accuracy' | 'transfers' | 'optimiser'
```

### SECTIONS Squad Entry (D-06)

```typescript
// BEFORE:
{ id: 'squad' as Section, label: 'Squad', subTabs: [], defaultSubTab: null }

// AFTER:
{
  id: 'squad' as Section,
  label: 'Squad',
  subTabs: [
    { id: 'transfers' as SubTab, label: 'Transfers', mobileLabel: 'Transfers' },
    { id: 'optimiser' as SubTab, label: 'Optimiser', mobileLabel: 'Optimiser' },
  ],
  defaultSubTab: 'transfers' as SubTab,
}
```

### sectionMemory Init (D-07)

```typescript
// BEFORE:
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems', plan: 'planner', squad: null,
})

// AFTER (D-07):
const [sectionMemory, setSectionMemory] = useState<Record<Section, SubTab | null>>({
  analyse: 'gems', plan: 'planner', squad: 'transfers',
})
```

### Content Render Guards (D-09)

```typescript
// BEFORE (page.tsx line 132):
{activeSection === 'squad' && <TransferPanel />}

// AFTER (D-09) — teamId props shown conceptually:
{activeSection === 'squad' && activeSubTab === 'transfers' && (
  <TransferPanel teamId={teamId} onTeamIdChange={setTeamId} submittedId={submittedId} onSubmit={handleTeamIdSubmit} />
)}
{activeSection === 'squad' && activeSubTab === 'optimiser' && (
  <OptimiserPanel teamId={submittedId} />
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Squad has no sub-tabs (single TransferPanel) | Squad gains Transfers + Optimiser sub-tabs | Phase 43 | MobileNav guard must be relaxed |
| TransferPanel owns teamId state | teamId state in page.tsx, shared via props | Phase 43 | Both panels share squad data via TanStack Query cache |
| `activeSection !== 'squad'` guards sub-tab row | Guard removed; Squad shows sub-tab row | Phase 43 | Squad spacer div also removed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `undefined` xPts_1gw should NOT trigger BGW exclusion (only exact `=== 0` should) | Engine Pitfalls | If wrong, players with missing pipeline data would be excluded; engine would return null for many squads |
| A2 | TanStack Query cache deduplication means both TransferPanel and OptimiserPanel can call `useSquad(submittedId)` independently without double-fetching | Architecture | If wrong, two network requests would be made for the same squad; still correct but wasteful |
| A3 | The GwToggle component from `gem-table/GwToggle` can be imported directly into OptimiserPanel with `value: 1|3|5` and `onChange` — the prop types already match OptimiserHorizon | Code Reuse | If wrong, a thin wrapper or separate component is needed; minor effort |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
*(Table is not empty — three low-risk assumptions documented above.)*

---

## Open Questions (RESOLVED)

1. **TransferPanel prop refactor scope**
   - What we know: D-11 says lift teamId to page.tsx. TransferPanel has many internal hooks.
   - What's unclear: Whether `squadData` also lifts (cleaner for OptimiserPanel) vs. OptimiserPanel calls `useSquad` independently (simpler TransferPanel refactor).
   - RESOLVED: Use TanStack Query cache sharing — lift only `teamId`/`submittedId` to page.tsx. Both panels call `useSquad(submittedId)` independently. This minimizes TransferPanel changes and avoids prop-drilling squadData. Plans implement this approach.

2. **`AccuracyTab` mock in page.test.tsx**
   - What we know: page.test.tsx does not mock `AccuracyTab`. The Analyse section has 5 sub-tabs (Gems, Insights, DefCon, SP, Accuracy). The MobileNav test asserts only 4 Analyse pills.
   - What's unclear: The MobileNav test at line 40-49 passes currently (it checks for 4 specific pills using `filter`, not `toHaveLength(4)` on all buttons). The `toHaveLength(4)` at line 47 only counts matching label buttons — the Acc pill exists but is filtered out.
   - RESOLVED: No action needed for the MobileNav test discrepancy. The Phase 43 Squad pill update is the only MobileNav test concern. Plans reflect this.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/optimise-lineup.test.ts` |
| Full suite command | `npx vitest run` |
| Estimated runtime | ~3-4 seconds |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPT-01 | Engine returns valid starting 11 + bench from 15 picks | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-01 | Formation string is valid FPL formation (e.g. '4-3-3') | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-02 | Horizon 1 scores by xPts_1gw; horizon 3 by xPts_3gw; horizon 5 by xPts_5gw | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-03 | captainId = element with highest xPts_90th_1gw among starters | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-03 | vcId = element with second-highest xPts_90th_1gw among starters | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-04 | bench[0] is always the non-starting GK | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-04 | bench[1..3] ordered by horizon xPts descending | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-05 | Returns null when < 11 eligible players (BGW exclusion reduces pool) | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-05 | BGW exclusion: player with xPts_1gw === 0 excluded from starters | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| OPT-05 | player with xPts_1gw undefined NOT excluded by BGW filter | unit | `npx vitest run src/lib/optimise-lineup.test.ts` | Wave 0 |
| NAV-01 | Squad section shows 'Transfers' and 'Optimiser' sub-tab buttons when Squad active | integration | `npx vitest run src/app/page.test.tsx` | Update existing |
| NAV-01 | MobileNav Squad active: pill row shows 2 pills (Transfers, Optimiser) | integration | `npx vitest run src/components/nav/MobileNav.test.tsx` | Update existing |
| NAV-01 | Squad default sub-tab is Transfers; TransferPanel visible on first load | integration | `npx vitest run src/app/page.test.tsx` | Update existing |
| NAV-01 | Navigating to Optimiser sub-tab shows OptimiserPanel, not TransferPanel | integration | `npx vitest run src/app/page.test.tsx` | Update existing |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/optimise-lineup.test.ts` (engine tasks) or `npx vitest run src/app/page.test.tsx src/components/nav/MobileNav.test.tsx` (nav tasks)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/optimise-lineup.test.ts` — engine unit tests (new file; covers OPT-01 through OPT-05)
- [ ] `src/components/optimiser/OptimiserPanel.tsx` — component stub (needed for page.test.tsx mock)

Existing test infrastructure updates required (not Wave 0 gaps, but Wave 1/2 changes):
- [ ] `src/app/page.test.tsx` — update Squad mock and NAV-01 assertions (Squad sub-tab behavior)
- [ ] `src/components/nav/MobileNav.test.tsx` — update NAV-04 test (Squad now shows 2 pills)

---

## Security Domain

The optimiser is a pure client-side computation over already-fetched data. No new API routes, no new user inputs processed server-side, no authentication changes. The existing `/api/squad/[teamId]` route validates teamId as numeric (already implemented). No ASVS categories apply to the engine itself.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No (engine is client-only, no new API inputs) | — |
| V6 Cryptography | No | — |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/chip-strategy-engine.ts` [VERIFIED] — structural pattern for engine; BGW handling, pure function discipline, typed exports
- `src/lib/types.ts` [VERIFIED] — MergedPlayer fields: xPts_1gw (optional), xPts_3gw (optional), xPts_5gw (optional), xPts_90th_1gw (optional)
- `src/app/page.tsx` [VERIFIED] — exact current SubTab union, SECTIONS constant, sectionMemory state, Squad special-casing, content guards
- `src/components/nav/MobileNav.tsx` [VERIFIED] — exact guard pattern `activeSection !== 'squad'`
- `src/lib/squad-adapter.ts` [VERIFIED] — SquadPick.element is player ID; position >= 12 is bench
- `src/components/transfers/TransferPanel.tsx` [VERIFIED] — all state local; hooks called internally; teamId/submittedId are the only fields needed by OptimiserPanel
- `src/app/page.test.tsx` [VERIFIED] — 6 tests; Squad test expects TransferPanel visible and no sub-tab nav
- `src/components/nav/MobileNav.test.tsx` [VERIFIED] — 9 tests; NAV-04 expects 3 buttons only when Squad active
- `src/lib/hooks/useSquad.ts` [VERIFIED] — query key `['squad', teamId]`; staleTime 5 min; TanStack Query cache sharing confirmed
- `src/components/gem-table/GwToggle.tsx` [VERIFIED] — accepts `value: 1|3|5`, reusable for OptimiserHorizon selector
- `vitest.config.ts` + `package.json` [VERIFIED] — vitest 4.1.2, jsdom environment, `npx vitest run`

### Secondary (MEDIUM confidence)
- `src/components/squad/SquadView.tsx` [VERIFIED] — POSITION_LABELS, StatusBadge patterns; position >= 12 = bench confirmed
- `src/components/accuracy/AccuracyTab.tsx` [VERIFIED] — Tailwind v4 amber banner pattern for BGW warning reference

---

## Metadata

**Confidence breakdown:**
- Engine algorithm: HIGH — combinatorics verified, field names confirmed in types.ts
- BGW exclusion logic: HIGH — D-15 explicitly states `xPts_1gw === 0`; Pitfall 1 documents the undefined edge case
- Captain selection: HIGH — `xPts_90th_1gw` confirmed on MergedPlayer; fallback chain from chip-strategy-engine.ts is direct precedent
- Navigation wiring: HIGH — every line that changes is read and confirmed
- Test impact: HIGH — both test files read; specific tests that break are identified by line number
- Pitch CSS approach: MEDIUM — Claude's discretion; Tailwind v4 patterns confirmed from existing components

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable TypeScript/React codebase; xPts fields may change if pipeline schema changes)
