# Phase 56: FT Engine Fix - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 4 (2 modified source, 1 modified component, 1 modified test)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/free-transfer-engine.ts` | utility | transform | `src/lib/free-transfer-engine.ts` (FH path, lines 13–16) | exact — same function, fix mirrors existing branch |
| `src/lib/planning-engine.ts` | service | transform | `src/lib/planning-engine.ts` (line 203, existing call site) | exact — same call site, assess null chip argument |
| `src/components/planner/PlannerTab.tsx` | component | request-response | `src/components/transfers/TransferPanel.tsx` (lines 87–92) | role-match — same derived-FT-count pattern |
| `tests/lib/free-transfer-engine.test.ts` | test | — | `tests/lib/free-transfer-engine.test.ts` (existing file) | exact — extend existing describe blocks |

---

## Pattern Assignments

### `src/lib/free-transfer-engine.ts` — Wildcard path fix (lines 8–11)

**Analog:** Free Hit path in the same function (lines 13–16).

**Bug site** (lines 7–11 — current broken code):
```typescript
// Wildcard: resets bank to 1 next GW
if (chip === 'wildcard') {
  return { available: 1, banked: 0 }
}
```

**Fix pattern — copy Free Hit formula verbatim** (lines 12–17 of current file):
```typescript
// Free Hit: bank passes through unchanged (as if GW didn't happen for FT purposes)
if (chip === 'freehit') {
  const banked = Math.min(1, currentAvailable - 1)
  const nextAvailable = 1 + banked
  return { available: nextAvailable, banked }
}
```

**Apply to Wildcard branch:**
```typescript
// Wildcard: bank preserved (same rule as Free Hit — chip does not reset FTs)
if (chip === 'wildcard') {
  const banked = Math.min(1, currentAvailable - 1)
  const nextAvailable = 1 + banked
  return { available: nextAvailable, banked }
}
```

Comment replacement: change "resets bank to 1 next GW" to "bank preserved (same rule as Free Hit — chip does not reset FTs)".

**Imports pattern** (line 1 — no changes needed):
```typescript
import type { PlannerChip, FTState } from './types'
```

---

### `src/lib/planning-engine.ts` — D-07 null chip at line 203

**Analog:** The same call site and surrounding loop context (lines 190–203).

**Current call site** (line 203):
```typescript
currentFT = computeNextFTState(currentFT.available, transfersUsed, null)
```

**Assessment:** D-07 states this is intentional — AI-generated plans never auto-select chips; chip handling flows only through `handleChipEdit` in PlannerTab. The `null` chip causes `computeNextFTState` to take the normal-GW branch, which is the correct behaviour for AI-generated steps. **No change required.** Planner should mark this as a no-op confirm rather than a code change.

**Context** (lines 190–204 — surroundings of the call site):
```typescript
    steps.push(step)

    // Advance FT state for the next step
    currentFT = computeNextFTState(currentFT.available, transfersUsed, null)
  }

  return {
    steps,
    originalSteps: [],
    horizon,
    startingGw,
  }
}
```

---

### `src/components/planner/PlannerTab.tsx` — `initialFTState` fix (line 55)

**Analog:** `src/components/transfers/TransferPanel.tsx` lines 87–92 (`derivedFtCount` useMemo).

**Bug site** (line 55 — current hardcoded const):
```typescript
// Conservative default FT state when exact count is unknown
const initialFTState: FTState = { available: 1, banked: 0 }
```

**Pattern to replicate** (`TransferPanel.tsx` lines 87–92):
```typescript
const derivedFtCount: 1 | 2 = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return 1
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return 1
  return myTeamData.entry_history.event_transfers === 0 ? 2 : 1
}, [isAuthenticated, myTeamData, squadData])
```

**Apply to PlannerTab — replace const with useMemo:**
```typescript
const initialFTState: FTState = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return { available: 1, banked: 0 }
  const chip = squadData?.active_chip
  if (chip === 'wildcard' || chip === 'freehit') return { available: 1, banked: 0 }
  const available: 1 | 2 = myTeamData.entry_history.event_transfers === 0 ? 2 : 1
  const banked: 0 | 1 = available === 2 ? 1 : 0
  return { available, banked }
}, [isAuthenticated, myTeamData, squadData])
```

**Imports — `useMemo` is already imported** (line 3):
```typescript
import { useState, useMemo } from 'react'
```

All hooks (`useAuthStatus`, `useMyTeam`, `useSquad`) are already imported and their data already available as `isAuthenticated`, `myTeamData`, `squadData` at the point of use. No new imports required.

**Dependency rationale:** `isAuthenticated` from line 29, `myTeamData` from line 34, `squadData` from line 33 — all already in scope before line 55.

---

### `tests/lib/free-transfer-engine.test.ts` — Wildcard tests (D-08)

**Analog:** Existing file — extend the `'wildcard chip'` describe block (lines 38–48) and the end-to-end sequence (lines 163–190).

**Existing test file imports** (lines 1–2 — no changes needed):
```typescript
import { describe, it, expect } from 'vitest'
import { computeNextFTState, computeHitCost, snapshotSquad } from '@/lib/free-transfer-engine'
```

**Existing wildcard describe block to extend** (lines 38–48):
```typescript
describe('wildcard chip', () => {
  it('resets FT bank to 1 next GW regardless of transfers used', () => {
    const result = computeNextFTState(2, 5, 'wildcard')
    expect(result).toEqual({ available: 1, banked: 0 })
  })

  it('resets FT bank even with 0 transfers used', () => {
    const result = computeNextFTState(2, 0, 'wildcard')
    expect(result).toEqual({ available: 1, banked: 0 })
  })
})
```

**New test cases to add** (replace/extend both existing wildcard cases — expected values change after the fix):
```typescript
describe('wildcard chip', () => {
  it('preserves bank when entering with 2 available (banked 1) → next GW also 2', () => {
    const result = computeNextFTState(2, 5, 'wildcard')
    expect(result).toEqual({ available: 2, banked: 1 })
  })

  it('preserves bank when entering with 1 available (banked 0) → next GW stays 1', () => {
    const result = computeNextFTState(1, 5, 'wildcard')
    expect(result).toEqual({ available: 1, banked: 0 })
  })

  it('preserves bank with 0 transfers used and 2 available', () => {
    const result = computeNextFTState(2, 0, 'wildcard')
    expect(result).toEqual({ available: 2, banked: 1 })
  })
})
```

**End-to-end sequence — GW4 wildcard step needs updating** (lines 176–180 current, expected values change):
```typescript
// GW4: wildcard (had 1 available → banked 0 → next still 1)
expect(computeHitCost(gw4.available, 5, 'wildcard')).toBe(0)
const gw5 = computeNextFTState(gw4.available, 5, 'wildcard')
expect(gw5).toEqual({ available: 1, banked: 0 })   // unchanged — gw4 had available:1
```

**D-08 regression scenarios** (new describe block):
```typescript
describe('D-08 regression: multi-GW FT banking sequences', () => {
  it('rolling 1 FT → 2 available next GW', () => {
    const next = computeNextFTState(1, 0, null)
    expect(next).toEqual({ available: 2, banked: 1 })
  })

  it('rolling 2 GWs → still 2 (cap respected)', () => {
    const after1 = computeNextFTState(1, 0, null)   // { available: 2, banked: 1 }
    const after2 = computeNextFTState(after1.available, 0, null)
    expect(after2).toEqual({ available: 2, banked: 1 })
  })

  it('Wildcard mid-plan preserves bank when entering with 2 available', () => {
    const afterWC = computeNextFTState(2, 11, 'wildcard')
    expect(afterWC).toEqual({ available: 2, banked: 1 })
  })

  it('Wildcard mid-plan preserves bank when entering with 1 available', () => {
    const afterWC = computeNextFTState(1, 11, 'wildcard')
    expect(afterWC).toEqual({ available: 1, banked: 0 })
  })

  it('FH mid-plan preserves bank when entering with 2 available', () => {
    const afterFH = computeNextFTState(2, 11, 'freehit')
    expect(afterFH).toEqual({ available: 2, banked: 1 })
  })

  it('FH mid-plan preserves bank when entering with 1 available', () => {
    const afterFH = computeNextFTState(1, 11, 'freehit')
    expect(afterFH).toEqual({ available: 1, banked: 0 })
  })
})
```

---

## Shared Patterns

### Pure functional transform (no side effects)
**Source:** `src/lib/free-transfer-engine.ts` (all exports)
**Apply to:** All engine changes
All functions are pure — no imports of React, no state, no I/O. Keep it that way.

### useMemo for derived reactive state
**Source:** `src/components/transfers/TransferPanel.tsx` lines 87–92; `src/components/planner/PlannerTab.tsx` lines 38–41
**Apply to:** `initialFTState` in PlannerTab
```typescript
const derivedValue = useMemo(() => {
  if (!guard1 || !guard2) return safeDefault
  // ... derive from data
}, [guard1, guard2, dep3])
```
Pattern: null-guard at the top of the memo, return safe default, then derive from real data.

### Test describe structure
**Source:** `tests/lib/free-transfer-engine.test.ts`
**Apply to:** All new/modified test cases
```typescript
describe('computeNextFTState', () => {
  describe('<scenario label>', () => {
    it('<specific behaviour in plain English>', () => {
      const result = computeNextFTState(available, used, chip)
      expect(result).toEqual({ available: N, banked: N })
    })
  })
})
```
Use `toEqual` (not `toBe`) for object comparisons. Describe labels are plain English, not code. No `beforeEach` for these pure-function tests.

---

## No Analog Found

None — all four files have direct analogs or self-analog patterns within the codebase.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/planner/`, `src/components/transfers/`, `tests/lib/`
**Files read:** 7 (`free-transfer-engine.ts`, `planning-engine.ts` ×2 ranges, `PlannerTab.tsx`, `TransferPanel.tsx`, `types.ts`, `free-transfer-engine.test.ts`, `planning-engine-rescore.test.ts`)
**Pattern extraction date:** 2026-05-03
