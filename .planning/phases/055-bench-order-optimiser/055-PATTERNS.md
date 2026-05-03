# Phase 55: Bench Order Optimiser - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 3 (1 new function in existing file, 1 new test block in existing file, 1 UI addition in existing component)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/optimise-lineup.ts` (add `benchOrder()`) | utility/pure-function | transform | `optimiseLineup()` in same file (lines 36–154) | exact — same file, same pattern family |
| `src/lib/optimise-lineup.test.ts` (add BENCH-01 suite) | test | batch | Existing `describe('OPT-04 bench ordering')` (lines 177–202) | exact — same file, same test style |
| `src/components/optimiser/OptimiserPanel.tsx` (add BB inline note) | component | request-response | Existing BB notice `<p>` at lines 487–494 | exact — same component, same conditional pattern |

---

## Pattern Assignments

### `src/lib/optimise-lineup.ts` — new `benchOrder()` export

**Analog:** `optimiseLineup()` in `src/lib/optimise-lineup.ts` (lines 1–154)

**Imports pattern** — no new imports needed. `benchOrder()` uses only types already imported (lines 1–6):
```typescript
import type { MergedPlayer, OptimiserHorizon, OptimisedLineup } from './types'
import type { SquadPick } from './squad-adapter'
```

**HORIZON_FIELD map** (line 9) — reuse directly inside `benchOrder()`:
```typescript
export const HORIZON_FIELD: Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}
```

**Position constants** (lines 15–19) — already defined file-scope; available to `benchOrder()`:
```typescript
const GK = 1
const DEF = 2
const MID = 3
const FWD = 4
```

**`horizonScore` helper pattern** (line 61–62) — mirror this `?? 0` fallback idiom for the EV score formula inside `benchOrder()`:
```typescript
const horizonScore = (p: MergedPlayer): number =>
  (p[field] as number | undefined) ?? 0
```
In `benchOrder()`, the EV formula is: `player.start_prob * ((player[field] as number | undefined) ?? 0) * player.fixtures.length`

**Formation validation bounds** (lines 90–97) — the exact bounds to reuse for the D-08 formation-legality heuristic:
```typescript
const valid = (
  gkCount === 1 &&
  defCount >= 3 && defCount <= 5 &&
  midCount >= 2 && midCount <= 5 &&
  fwdCount >= 1 && fwdCount <= 3 &&
  (defCount + midCount + fwdCount) === 10
)
```
In `benchOrder()`, apply the outfield subset: given starters' `defCount / midCount / fwdCount`, check whether adding bench candidate's position pushes any count above its ceiling (`DEF > 5`, `MID > 5`, `FWD > 3`). A candidate is formation-valid if their position, when added to starters, does not exceed the ceiling.

**OPT-04 bench assembly block being replaced** (lines 125–142) — this is the exact block `benchOrder()` replaces. After the change, the `.sort(...)` call on line 136 becomes a `benchOrder(benchOutfield, starterPlayers, horizon)` call:
```typescript
// Bench (OPT-04): the 4 picks not in starters.
const starterSet = new Set(bestStarterIds)
const benchPicks = picks
  .filter(pick => !starterSet.has(pick.element))
  .map(pick => playerMap.get(pick.element))
  .filter((p): p is MergedPlayer => p !== undefined)

// bench[0] = non-starting GK.
const benchGk = benchPicks.find(p => p.element_type === GK)
const benchOutfield = benchPicks
  .filter(p => p.element_type !== GK)
  .sort((a, b) => horizonScore(b) - horizonScore(a))  // <-- REPLACE this sort

if (!benchGk) return null
const bench = [benchGk.id, ...benchOutfield.slice(0, 3).map(p => p.id)]
```
The replacement: collect `starterPlayers` from `bestStarterIds.map(id => playerMap.get(id)!)`, then call `benchOrder(benchOutfield, starterPlayers, horizon)`. The result is already reordered; caller prepends `benchGk.id` as before.

**Pure-function style** (file header comment, line 2):
```
// Mirrors src/lib/chip-strategy-engine.ts pattern: no 'use client', no React, no side effects.
```
`benchOrder()` must follow identical constraints — no imports from React, no side effects, `?? 0` fallback on all optional fields.

**`benchOrder()` signature** (from D-02):
```typescript
export function benchOrder(
  benchOutfield: MergedPlayer[],
  starters: MergedPlayer[],
  horizon: OptimiserHorizon,
): MergedPlayer[]
```

---

### `src/lib/optimise-lineup.test.ts` — new `describe('BENCH-01 benchOrder()')` suite

**Analog:** `describe('OPT-04 bench ordering')` (lines 177–202) — same file, same test scaffolding

**Test file header** (lines 1–7) — `benchOrder` must be added to the import on line 5:
```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { optimiseLineup } from './optimise-lineup'  // add benchOrder here
import type { MergedPlayer } from './types'
import type { SquadPick } from './squad-adapter'
```

**`makePlayer()` factory** (lines 13–59) — reuse exactly as-is. Key defaults that are critical for `benchOrder()` tests:
```typescript
fixtures: [],        // empty = BGW player (fixtures.length === 0)
start_prob: 0.9,     // D-03: affects EV score directly
xPts_1gw: 5.0,
xPts_3gw: 14.0,
xPts_5gw: 22.0,
```
Override `fixtures` with an array of length 1 (single GW) or 2 (DGW) for test cases. A `FixtureEntry` mock needs: `{ opponent_team: 'TST', is_home: true, event_id: 1, difficulty_score: 0.5, difficulty_tier: 'medium' }`.

**`makeSquad()` factory** (lines 64–77) — reuse for the integration test that calls `optimiseLineup()` and inspects `result.bench`. For unit tests of `benchOrder()` directly, construct `benchOutfield` and `starters` arrays inline using `makePlayer()`.

**OPT-04 test pattern** (lines 177–202) — mirror structure for BENCH-01 suite:
```typescript
describe('BENCH-01 benchOrder()', () => {
  it('BGW player (fixtures.length === 0) is sorted to slot 2 (bench[3]) regardless of EV', () => { ... })
  it('DGW player (fixtures.length === 2) ranks higher than identical single-fixture player', () => { ... })
  it('formation-invalid candidate (would exceed DEF ceiling) ranks after formation-valid candidates', () => { ... })
  it('formation-invalid is a demotion not an exclusion — still appears in returned array', () => { ... })
  it('optimiseLineup() bench[0] is still GK and bench[1..3] respect benchOrder ranking', () => { ... })
})
```

**Existing OPT-04 bench[1..3] test** (lines 186–201) — this test currently validates the naïve `horizonScore` sort. After Phase 55 it should still pass (EV-ordered bench with no BGW or formation-conflict players behaves identically to old sort). Do not delete it; `benchOrder()` is a superset of the old behavior.

---

### `src/components/optimiser/OptimiserPanel.tsx` — BB inline note in Bench section header

**Analog 1 — existing BB notice `<p>`** (lines 487–494) — identical pattern: a `<p>` conditioned on `chipMode === 'bench-boost'`:
```tsx
{chipMode === 'bench-boost' && (
  <p
    className="text-xs text-zinc-500 dark:text-zinc-400 italic"
    data-testid="bb-notice"
  >
    All 15 players score points — bench contributions included above.
  </p>
)}
```
The new bench-order note follows the same element type (`<p>`), same Tailwind class string (`text-xs text-zinc-500 dark:text-zinc-400 italic`), and same `chipMode === 'bench-boost'` guard. Use a distinct `data-testid` (e.g. `"bb-bench-order-note"`).

**Analog 2 — `TransferPanel.tsx` muted italic** (`src/components/transfers/TransferPanel.tsx` line 311):
```tsx
<p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
```
Confirms the `text-xs ... italic` pattern is the project-standard for muted informational copy. (CONTEXT.md D-11 suggests `text-zinc-400 dark:text-zinc-500` — pick either; both exist in the codebase. The existing `bb-notice` at line 489 uses `text-zinc-500 dark:text-zinc-400`, so match that for visual consistency within OptimiserPanel.)

**Bench section header location** (line 401) — the `Bench` section entry in `sectionsRows`:
```tsx
{ section: 'Bench', items: pairSection(currentBenchSorted, lineup.bench, playerMap, horizonField, true, optimisedStarterSet) },
```
The section header is rendered inside `ComparisonTable` (lines 121–129) as a `<td colSpan={5}>` containing `{section}`. The inline BB note is NOT inside that `<td>`; it is a sibling `<p>` rendered in the main `OptimiserPanel` return between the `bb-notice` block and the `<div className="hidden sm:block">` desktop table wrapper (currently lines 496–504). Place it immediately after the existing `bb-notice` `<p>` (after line 494), conditioned on the same `chipMode === 'bench-boost'`.

**`chipMode` state and detection** (lines 234, 458, 487) — `chipMode` is already in component state; no new prop or hook needed:
```tsx
const [chipMode, setChipMode] = useState<ChipMode>('none')
// ...
{chipMode === 'bench-boost' && ( /* existing bb-notice */ )}
// New note goes here, same guard:
{chipMode === 'bench-boost' && (
  <p
    className="text-xs text-zinc-500 dark:text-zinc-400 italic"
    data-testid="bb-bench-order-note"
  >
    Bench order doesn&apos;t affect score with Bench Boost active
  </p>
)}
```

---

## Shared Patterns

### Pure-function style (no React, no side effects)
**Source:** `src/lib/optimise-lineup.ts` lines 1–4 (file header comment)
**Apply to:** `benchOrder()` in same file
The file-level comment documents the constraint. `benchOrder()` must conform: TypeScript-only, no imports added beyond what the file already has, `?? 0` on every optional `MergedPlayer` field access.

### `?? 0` fallback on optional xPts fields
**Source:** `src/lib/optimise-lineup.ts` line 61–62 (`horizonScore` helper); line 55 (`score` in `pairSection`); line 134 (`curXPts` in `ComparisonTable`)
**Apply to:** EV formula inside `benchOrder()`
Pattern: `(p[field] as number | undefined) ?? 0`

### Bench array convention (GK at index 0)
**Source:** `src/lib/optimise-lineup.ts` lines 133–142
**Apply to:** Integration point in `optimiseLineup()` after calling `benchOrder()`
`bench = [benchGk.id, ...benchOutfield.slice(0, 3).map(p => p.id)]` — `benchOrder()` returns only the outfield slice; caller prepends the GK id.

### `chipMode === 'bench-boost'` conditional render
**Source:** `src/components/optimiser/OptimiserPanel.tsx` lines 458 and 487
**Apply to:** New BB bench-order note in `OptimiserPanel.tsx`
Two existing conditionals on `chipMode === 'bench-boost'` in the same JSX block. The new note is a third, immediately after line 494.

### Muted italic informational note style
**Source:** `src/components/optimiser/OptimiserPanel.tsx` lines 488–493 (`bb-notice`)
**Apply to:** New BB bench-order note
Class string: `"text-xs text-zinc-500 dark:text-zinc-400 italic"`
Element: `<p>` with `data-testid` attribute.

---

## No Analog Found

None. All three modification sites have direct analogs within their own files.

---

## Metadata

**Analog search scope:** `src/lib/optimise-lineup.ts`, `src/lib/optimise-lineup.test.ts`, `src/components/optimiser/OptimiserPanel.tsx`, `src/lib/types.ts`, `src/lib/chip-modes.ts`, `src/components/transfers/TransferPanel.tsx`
**Files scanned:** 6
**Pattern extraction date:** 2026-05-03
