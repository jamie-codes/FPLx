---
phase: 112
plan: "01"
subsystem: transfers
tags: [fpl, transfers, utility, pure-function, tdd, cap, position-bucket]
dependency_graph:
  requires: []
  provides:
    - "src/lib/cap-transfer-suggestions.ts (capByPosition pure function + CappedSuggestions type)"
  affects:
    - "src/components/optimiser/OptimiserPanel.tsx (Plan 02 consumer)"
    - "src/components/transfers/TransferPanel.tsx (Plan 03 consumer)"
tech_stack:
  added: []
  patterns:
    - "Pure function with Map bucketing (Map<number, TransferSuggestion[]>)"
    - "Discriminated union narrowing via sug.kind === 'single' guard"
    - "TDD RED→GREEN: test first, implement to pass"
key_files:
  created:
    - src/lib/cap-transfer-suggestions.ts
    - src/lib/cap-transfer-suggestions.test.ts
  modified: []
decisions:
  - "capByPosition placed in src/lib/ as pure function, not inlined — DRY across Plan 02 and Plan 03 consumers (D-05)"
  - "totalsByPosition Map uses pre-cap counts so UI footnote can detect truncation without re-counting (D-07)"
  - "combo bucketing reads transfers[0].buy.element_type per Phase 111 FIX-02 invariant that both legs are same element_type"
  - "Final sort by xPtsGain desc, cost asc preserves cross-bucket ordering for rendered list"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-05-15"
  tasks: 2
  files_created: 2
  lines: 278
---

# Phase 112 Plan 01: capByPosition Pure Utility (TFR-02 D-05) Summary

**One-liner:** Pure `capByPosition(suggestions, limit)` function buckets TransferSuggestion[] by element_type and caps each bucket at `limit`, returning `{ suggestions, totalsByPosition }` for truncation footnote rendering.

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `src/lib/cap-transfer-suggestions.ts` | 62 | Pure function + CappedSuggestions interface |
| `src/lib/cap-transfer-suggestions.test.ts` | 216 | 8 vitest unit tests (@vitest-environment node) |

## 8 Test Cases (RED→GREEN)

1. **returns empty result when given an empty array** — `[]` input → `suggestions: [], totalsByPosition.size === 0`
2. **buckets single-kind suggestions by buy.element_type and caps at limit** — 4 MID + 2 DEF with limit=3 → 5 kept; totalsByPosition Map correct
3. **buckets combo-kind suggestions by transfers[0].buy.element_type** — 5 FWD combos with limit=3 → 3 kept; totalsByPosition.get(4)===5
4. **preserves input order within a bucket** — 4 MID sorted desc by xPtsGain; after cap limit=3, xPtsGain values are [10.0, 8.0, 6.0]
5. **when every bucket has length <= limit, output length equals input length** — 2 GK, 3 DEF, 1 MID, 2 FWD all ≤ limit 3; all 8 kept
6. **mixed singles and combos in the same bucket are both counted toward the cap** — 2 single MIDs + 2 combo MIDs; limit=3 → 3 kept, totalsByPosition.get(3)===4
7. **output suggestions are sorted across buckets by xPtsGain desc, tie-broken by cost asc** — interleaved MID/DEF/FWD; output monotonically non-increasing xPtsGain
8. **limit=0 yields zero kept suggestions but totalsByPosition still reflects pre-cap counts** — 5 MID with limit=0 → suggestions.length===0, totalsByPosition.get(3)===5

## Implementation Steps in capByPosition

1. Build `byPosition: Map<number, TransferSuggestion[]>` — for each suggestion derive `pos` via `sug.kind === 'single' ? sug.buy.element_type : sug.transfers[0].buy.element_type`; push into bucket preserving insertion order.
2. Build `totalsByPosition: Map<number, number>` recording each bucket's length BEFORE slicing.
3. Concatenate `bucket.slice(0, limit)` for each bucket into `capped`.
4. Sort `capped` in place: `(b.xPtsGain - a.xPtsGain)`; tie-break `(a.cost - b.cost)`.
5. Return `{ suggestions: capped, totalsByPosition }`.

## TDD Gate Compliance

| Gate | Commit | Subject |
|------|--------|---------|
| RED | 801c2aa | `test(112-01): add failing tests for capByPosition utility` |
| GREEN | 3829bdb | `feat(112-01): implement capByPosition pure utility (TFR-02 D-05)` |

RED confirmed: module-not-found error on all 8 tests before implementation.
GREEN confirmed: all 8 tests pass after implementation.

## Engine Non-Modification Confirmation

`src/lib/suggest-transfers.ts` was NOT modified (D-05 invariant preserved). The cap is applied post-filter in consumers' `useMemo` blocks — the engine remains untouched.

## Note for Downstream Plans (02 and 03)

Import signature:
```typescript
import { capByPosition, type CappedSuggestions } from '@/lib/cap-transfer-suggestions'
// Usage:
const { suggestions: capped, totalsByPosition } = capByPosition(rawSuggestions, 3)
```

- `suggestions`: capped and cross-bucket sorted TransferSuggestion[]
- `totalsByPosition`: `Map<number, number>` — element_type → pre-cap count; use `totalsByPosition.get(et) > 3` to show truncation footnote per D-07

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — this is a pure function with no network surface, no new endpoints, and no schema changes.

## Self-Check: PASSED

- `src/lib/cap-transfer-suggestions.ts` exists: FOUND
- `src/lib/cap-transfer-suggestions.test.ts` exists: FOUND
- Commit 801c2aa (test/RED): FOUND
- Commit 3829bdb (feat/GREEN): FOUND
- All 8 tests pass: CONFIRMED
- `suggest-transfers.ts` unmodified: CONFIRMED
