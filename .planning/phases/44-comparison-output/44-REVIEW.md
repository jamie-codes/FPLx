---
phase: 44-comparison-output
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/components/optimiser/OptimiserPanel.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`OptimiserPanel.tsx` introduces the comparison table UI replacing the Phase 43 pitch block. The component is generally well-structured: non-pitch states are preserved, the `pairSection` helper separates pairing logic cleanly, and `changeCount`/`xPtsGain` correctly use set-difference rather than row-diff counts. However, there are three concrete defects.

The most serious is an out-of-bounds read in `pairSection` that produces silent `undefined` values when the optimised formation has fewer players in a position group than the current XI — a real-world scenario whenever a formation change is recommended. Two further issues are a hardcoded `+` sign that renders garbage (`+-1.0 xPts`) when the sort-based pairing produces a negative row delta, and an `opacity-60` class applied to unchanged mobile cards that inverts the visual intent.

---

## Critical Issues

### CR-01: `pairSection` reads off the end of `sortedOptimised` when formation changes

**File:** `src/components/optimiser/OptimiserPanel.tsx:59`

**Issue:** `sortedOptimised[i]` is accessed without a bounds check. `sortedCurrent` is built from `currentByType(et)` and `sortedOptimised` from `starterXxx` — these have the same length only when the current and optimised formations share the same count for every position group. When the optimiser recommends a formation change (e.g. current is 5-3-2 but optimised is 4-4-2), `currentByType(DEF)` yields 5 IDs while `starterDefs` yields 4. On the 5th iteration `sortedOptimised[4]` is `undefined`.

Downstream consequences:
- `optimisedId` is `undefined` → `playerMap.get(undefined)` → `undefined` → `opt?.web_name ?? ''` renders an empty string in the "Optimised" column. The row shows a blank player name — silently wrong.
- `isChanged = currentId !== undefined` is always `true` for a `number` ID, so the green highlight and delta pill trigger for the ghost row.
- `score(undefined as any)` returns 0 (via the `?? 0` fallback), so `delta = 0 - score(currentId)` — a negative delta rendered as `+-N.N xPts`.
- `isPromoted = optimisedStarterIds.has(currentId)` may fire spuriously, flashing a "Promoted" badge for a player who was never actually moved.

Formation changes are a normal output of the optimiser: any squad where the best XI formation differs from the current one triggers this path.

**Fix:** Guard the access and skip rows where the optimised array is shorter than the current array:

```typescript
function pairSection(
  currentIds: number[],
  optimisedIds: number[],
  playerMap: Map<number, MergedPlayer>,
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw',
  isBench: boolean,
  optimisedStarterIds: Set<number>,
): ComparisonRowData[] {
  const score = (id: number) => (playerMap.get(id)?.[horizonField] as number | undefined) ?? 0
  const sortedCurrent = isBench ? [...currentIds] : [...currentIds].sort((a, b) => score(b) - score(a))
  const sortedOptimised = isBench ? [...optimisedIds] : [...optimisedIds].sort((a, b) => score(b) - score(a))
  // Use the shorter length so we never read past the end of either array.
  const len = Math.min(sortedCurrent.length, sortedOptimised.length)
  return sortedCurrent.slice(0, len).map((currentId, i) => {
    const optimisedId = sortedOptimised[i]
    const isChanged = currentId !== optimisedId
    const delta = isChanged && !isBench ? score(optimisedId) - score(currentId) : 0
    const isPromoted = isBench && isChanged && optimisedStarterIds.has(currentId)
    return { currentId, optimisedId, isChanged, isBench, isPromoted, delta }
  })
}
```

Note: rows present in `currentIds` beyond `len` are silently dropped. A more complete fix also emits "new slot" rows for extra optimised players (i.e. when `optimisedIds.length > currentIds.length`), but even the silent drop is correct enough for a formation-change scenario because the `changeCount` / `xPtsGain` headline values use set-difference and are unaffected.

---

## Warnings

### WR-01: Hardcoded `+` prefix on delta pill renders corrupt text for negative deltas

**File:** `src/components/optimiser/OptimiserPanel.tsx:154` (desktop) and `203` (mobile)

**Issue:** The delta pill always prepends `+` to the formatted value: `+{row.delta.toFixed(1)} xPts`. `row.delta` can be negative. It is computed as `score(optimisedId) - score(currentId)` and is negative whenever sort-order pairing places a lower-xPts optimised player against a higher-xPts current player in the same index slot. This produces output like `+-1.2 xPts` — syntactically wrong and confusing to users.

This is a distinct issue from CR-01: it can occur even when both arrays have the same length, any time the sorted pairing does not correspond 1-to-1 with the actual swap (e.g. current=[A=9, B=5], optimised=[A=9, C=3] where B is swapped for C but C has lower xPts than B).

**Fix:** Conditionally include the sign, or only show the pill when delta is positive:

```tsx
// Option A: conditional sign
<span data-testid="delta-pill">
  {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(1)} xPts
</span>

// Option B: suppress pill entirely when delta <= 0 (cleaner — negative per-row
// deltas are pairing artifacts, not real regressions)
{row.isChanged && !row.isBench && row.delta > 0 && (
  <span data-testid="delta-pill">+{row.delta.toFixed(1)} xPts</span>
)}
```

The same fix must be applied at both line 154 (desktop `ComparisonTable`) and line 203 (mobile `MobileComparisonCards`).

---

### WR-02: `opacity-60` applied to unchanged mobile rows, inverts visual hierarchy

**File:** `src/components/optimiser/OptimiserPanel.tsx:193`

**Issue:** In `MobileComparisonCards`, unchanged rows receive `opacity-60` via:

```tsx
className={`py-2 border-b ...${row.isChanged ? ' border-l-2 border-l-green-500 pl-2' : ' opacity-60'}`}
```

Reducing unchanged rows to 60% opacity makes them harder to read and visually subordinates stable selections. The desktop `ComparisonTable` applies no opacity reduction to unchanged rows — only the green left-border highlight for changed rows. The mobile treatment is inconsistent with desktop and risks making the table unreadable on low-contrast screens. There is no design-spec evidence (from UI-SPEC.md or PATTERNS.md) that this dimming was intentional; it looks like an accidental inversion.

**Fix:** Remove `opacity-60` from the unchanged branch, mirroring the desktop table's approach:

```tsx
className={`py-2 border-b border-zinc-100 dark:border-zinc-800${row.isChanged ? ' border-l-2 border-l-green-500 pl-2' : ''}`}
```

---

## Info

### IN-01: `HORIZON_FIELD` duplicated from the engine — divergence risk

**File:** `src/components/optimiser/OptimiserPanel.tsx:27-31`

**Issue:** `HORIZON_FIELD` is defined again in `OptimiserPanel.tsx` (lines 27-31), duplicating the same constant already exported from `src/lib/optimise-lineup.ts` (line 9). If the engine ever adds a new horizon value the component's local copy will silently diverge.

**Fix:** Import the canonical constant from the engine:

```typescript
import { optimiseLineup, HORIZON_FIELD } from '@/lib/optimise-lineup'
// remove the local const HORIZON_FIELD = { ... } block
```

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
