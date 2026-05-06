---
phase: 65
plan: 01
subsystem: testing
tags: [rejection-explainer, tdd-wave-0, vitest, rtl, red-tests]
dependency_graph:
  requires: []
  provides:
    - src/lib/__tests__/rejection.test.ts (WHY-01 RED contract)
    - src/components/transfers/HighOwnershipCallout.test.tsx (WHY-02 RED contract)
    - src/components/squad/ExplainPanel.test.tsx (WHY-03 RED contract)
  affects:
    - src/lib/explain.ts (Plan 02 must export computeRejection, REJECTION_START_PROB_THRESHOLD, REJECTION_OWNERSHIP_THRESHOLD, RejectionResult)
    - src/components/transfers/HighOwnershipCallout.tsx (Plan 03 must create)
    - src/components/squad/ExplainPanel.tsx (Plan 03 must add rejectionReasons prop)
tech_stack:
  added: []
  patterns:
    - vitest node environment for pure function tests (matches sensitivity.test.ts)
    - vitest jsdom environment for RTL component tests (matches FragilityNote.test.tsx)
    - makePlayer factory with gem_score extension for ScoredPlayer cast
    - makePopulation helper for deterministic rank testing
key_files:
  created:
    - src/lib/__tests__/rejection.test.ts
    - src/components/transfers/HighOwnershipCallout.test.tsx
    - src/components/squad/ExplainPanel.test.tsx
  modified: []
decisions:
  - "makePlayer factory copies sensitivity.test.ts verbatim and adds gem_score: 0.5 default (ScoredPlayer-only field)"
  - "makePopulation helper creates deterministic rank populations by monotonically adjusting xPts_1gw"
  - "ExplainPanel tests: 4 tests pass (backward-compat) and 3 fail (rejectionReasons section) — correct RED split since TypeScript allows unknown props in JSX at test time"
  - "hardFixture added to rejection.test.ts per RESEARCH Open Q1 resolution (medium+hard both trigger fixture rejection)"
metrics:
  duration: 3m
  completed: 2026-05-06
---

# Phase 65 Plan 01: Rejection Explainer Wave 0 RED Tests Summary

**One-liner:** Three RED test stubs codifying WHY-01/WHY-02/WHY-03 contracts (computeRejection unit tests, HighOwnershipCallout RTL, ExplainPanel rejectionReasons prop) — all failing as expected; Wave 1 plans 02/03 will turn them GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create rejection.test.ts (WHY-01 unit contract) | 6ea326b | src/lib/__tests__/rejection.test.ts |
| 2 | Create HighOwnershipCallout.test.tsx (WHY-02 RTL contract) | dd9cc82 | src/components/transfers/HighOwnershipCallout.test.tsx |
| 3 | Create ExplainPanel.test.tsx (WHY-03 RTL contract) | 070a020 | src/components/squad/ExplainPanel.test.tsx |

## Test Files Created

### src/lib/__tests__/rejection.test.ts (WHY-01)
- **Line count:** 347 lines (minimum: 120)
- **Test count:** 14 `it()` blocks
- **Environment:** `@vitest-environment node`
- **Imports:** `computeRejection`, `REJECTION_START_PROB_THRESHOLD`, `REJECTION_OWNERSHIP_THRESHOLD`, type `RejectionResult` from `'../explain'`
- **RED failure:** `TypeError: computeRejection is not a function` — export not yet present in explain.ts
- **Key assertions:** rank (#2 at MID by xPts), positive framing (empty reasons), rotation risk em-dash copy, FDR medium/hard fixture strings, fragility prefix, ownership rounding (12.5→13), BGW empty-fixtures guard, D-07 signal order, POSITION_CODES map, constant values

### src/components/transfers/HighOwnershipCallout.test.tsx (WHY-02)
- **Line count:** 109 lines (minimum: 60)
- **Test count:** 7 `it()` blocks
- **Environment:** `@vitest-environment jsdom`
- **Imports:** `HighOwnershipCallout` from `'./HighOwnershipCallout'`
- **RED failure:** `Error: Failed to resolve import "./HighOwnershipCallout"` — component file does not exist yet
- **Key assertions:** null render on empty entries, data-testid root, ℹ️ header text, in-squad copy (Already ranked #N at POS in your squad by xPts — no upgrade needed), not-in-squad copy (xPts gain vs your POS options is negative — not worth transferring in), Math.round(parseFloat("12.5"))=13, 4 paragraphs for 3 entries

### src/components/squad/ExplainPanel.test.tsx (WHY-03)
- **Line count:** 95 lines (minimum: 60)
- **Test count:** 7 `it()` blocks
- **Environment:** `@vitest-environment jsdom`
- **Imports:** `ExplainPanel` from `'./ExplainPanel'`, `ShortlistEntry` from `'@/lib/replacement-shortlist'`
- **RED failure:** 3 tests fail because `rejectionReasons` prop is not yet declared on `ExplainPanelProps` (4 backward-compat tests pass correctly)
- **Key assertions:** positive reasons always render, no rejection section when prop omitted or empty array, header "Why not recommended:", text-xs text-zinc-600 li styling, DOM order (positive < rejection < shortlist using innerHTML.indexOf), "Replacement options" as trailing landmark

## RED State Confirmation

```
Test Files  3 failed (3)
     Tests  17 failed | 4 passed (21)
```

Combined `npx vitest run` command exits non-zero. Each failure message:
- rejection.test.ts: `TypeError: computeRejection is not a function`
- HighOwnershipCallout.test.tsx: `Error: Failed to resolve import "./HighOwnershipCallout"`
- ExplainPanel.test.tsx: `AssertionError: expected -1 to be greater than N` (rejection section not rendered)

## Symbols Wave 1 Plans Must Export to Turn Each Test File GREEN

### Plan 02 — turns rejection.test.ts GREEN (src/lib/explain.ts additions)
```typescript
export const REJECTION_START_PROB_THRESHOLD = 0.70
export const REJECTION_OWNERSHIP_THRESHOLD = 20.0

export interface RejectionResult {
  reasons: string[]   // empty => positive framing
  xPtsRank: number    // 1-based rank within position by xPts_1gw
}

export function computeRejection(
  player: ScoredPlayer,
  allPlayers: ScoredPlayer[],
): RejectionResult
```

### Plan 03 — turns HighOwnershipCallout.test.tsx GREEN (new file)
```typescript
// src/components/transfers/HighOwnershipCallout.tsx
interface HighOwnershipEntry {
  player: ScoredPlayer
  inSquad: boolean
  squadRank?: number
  posCode: string
}
interface HighOwnershipCalloutProps {
  entries: HighOwnershipEntry[]
}
export function HighOwnershipCallout({ entries }: HighOwnershipCalloutProps): JSX.Element | null
```

### Plan 03 — turns ExplainPanel.test.tsx GREEN (src/components/squad/ExplainPanel.tsx modification)
```typescript
interface ExplainPanelProps {
  reasons: string[]
  shortlist: ShortlistEntry[] | null
  rejectionReasons?: string[]   // Phase 65 WHY-03 addition
}
// Plus new rejection section rendered between positive reasons and shortlist
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates test files only; no implementation stubs.

## Threat Flags

None — test files only; no new network endpoints, auth paths, or data flows introduced.

## Self-Check: PASSED

Files exist:
- src/lib/__tests__/rejection.test.ts: FOUND
- src/components/transfers/HighOwnershipCallout.test.tsx: FOUND
- src/components/squad/ExplainPanel.test.tsx: FOUND

Commits exist:
- 6ea326b (Task 1): FOUND
- dd9cc82 (Task 2): FOUND
- 070a020 (Task 3): FOUND
