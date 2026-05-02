---
phase: "050"
plan: "01"
subsystem: opportunity-cost
tags: [tdd, pure-function, transfer-engine, ocs]
dependency_graph:
  requires: [suggest-transfers, types]
  provides: [computeOpportunityCostRows, OCSRow, OCSRowKind, MARGINAL_THRESHOLD]
  affects: []
tech_stack:
  added: []
  patterns: [pure-mapping-function, discriminated-union-narrowing]
key_files:
  created:
    - src/lib/opportunity-cost.ts
    - src/lib/__tests__/opportunity-cost.test.ts
  modified: []
decisions:
  - "_ftCount parameter accepted for API symmetry; engine emission rules already gate row presence, so the parameter is intentionally unused."
  - "MARGINAL_THRESHOLD=1.0 applied only to combo-free rows per spec; single rows carry no isMarginal field."
metrics:
  duration: "~10 minutes"
  completed: "2026-05-02"
---

# Phase 50 Plan 01: Opportunity-Cost Mapper Summary

Pure TypeScript opportunity-cost mapper (computeOpportunityCostRows) with 16-test Vitest RED/GREEN TDD cycle.

## Public Exports

```typescript
// src/lib/opportunity-cost.ts

export type OCSRowKind = 'roll' | 'single-free' | 'single-hit' | 'combo-free' | 'combo-hit'

export const MARGINAL_THRESHOLD = 1.0

export interface OCSRow {
  kind: OCSRowKind
  label: string
  xPtsGain: number
  xPtsGainNet: number
  xPtsGainPerGw: number
  breakEvenGws: number | null
  cost: 0 | 4
  transfers?: Array<{ sell: MergedPlayer; buy: MergedPlayer }>
  isMarginal?: boolean
}

export function computeOpportunityCostRows(
  suggestions: TransferSuggestion[],
  _ftCount: 1 | 2,
): OCSRow[]
```

## Test Results

- **Count:** 16 passing, 0 failing
- **Command:** `npx vitest run src/lib/__tests__/opportunity-cost.test.ts`
- **Output:** `Test Files 1 passed (1) | Tests 16 passed (16)`

## TDD Gate Compliance

- RED commit: `2cfa8d7` — `test(050-01): RED — opportunity-cost suite (16 cases) for OCS-01/02/04/05`
- GREEN commit: `e60bc61` — `feat(050-01): GREEN — implement computeOpportunityCostRows for OCS-01/02/04/05`
- No REFACTOR phase needed — implementation was clean as written.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `src/lib/opportunity-cost.ts` — FOUND
- `src/lib/__tests__/opportunity-cost.test.ts` — FOUND
- RED commit `2cfa8d7` — FOUND
- GREEN commit `e60bc61` — FOUND
- 16/16 tests passing — CONFIRMED
- No `'use client'` directive — CONFIRMED
- Imports use `from './types'` (relative) — CONFIRMED
