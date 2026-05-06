---
phase: "074"
plan: "01"
subsystem: transfer-engine
tags: [types, testing, wave-0, scaffold]
dependency_graph:
  requires: []
  provides:
    - "TransferSuggestion combo variant with cost: 0 | 4 | 8 in type system"
    - "src/lib/opportunity-cost.test.ts Wave 0 scaffold for TFX-03 and TFX-04"
  affects:
    - "src/lib/suggest-transfers.ts (Plan 02 will reference cost: 8 combo type)"
    - "src/lib/opportunity-cost.ts (Plan 03 will fill in it.todo blocks)"
tech_stack:
  added: []
  patterns:
    - "Discriminated union extension (narrow to single variant only)"
    - "@vitest-environment node test scaffold with it.todo placeholders"
key_files:
  created:
    - path: src/lib/opportunity-cost.test.ts
      purpose: "Wave 0 test scaffold — 1 passing placeholder + 15 it.todo blocks for Plan 03"
  modified:
    - path: src/lib/types.ts
      change: "TransferSuggestion combo variant cost: 0 | 4 → cost: 0 | 4 | 8 (line 240)"
decisions:
  - "Removed explicit id: overrides.id from makePlayer factory — spread handles it; prevents TS2783 duplicate property error"
  - "selling_price and purchase_price removed from factory defaults — not on MergedPlayer type"
metrics:
  duration: "2 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_changed: 2
---

# Phase 074 Plan 01: Wave 0 — Type Extension and Test Scaffold Summary

Wave 0 foundation for the Transfer Engine Overhaul: extended `TransferSuggestion` combo variant cost union and created the `opportunity-cost.test.ts` Wave 0 scaffold with 1 passing it() and 15 it.todo() blocks.

## Tasks Completed

### Task 01-01: Extend TransferSuggestion combo cost union to 0 | 4 | 8

**Commit:** 71ad556

**Change in `src/lib/types.ts`:**

- Line before (240): `cost: 0 | 4              // 0 = FREE (both within ftCount), 4 = one hit`
- Line after (240): `cost: 0 | 4 | 8          // 0 = FREE (both within ftCount), 4 = one hit, 8 = two simultaneous hits (−8pts)`

**Single-transfer variant unchanged:** Line 229 still reads `cost: 0 | 4  // 0 = FREE, 4 = -4pt hit`.

**tsc errors confined to suggest-transfers.ts:** Running `npx tsc --noEmit` after the change produced zero errors. The `breakEven()` helper in `suggest-transfers.ts` was not typed `cost: 0 | 4` in a way that caused errors — tsc passed cleanly. Plan 02 will widen the `breakEven()` signature preemptively.

### Task 01-02: Create opportunity-cost.test.ts scaffold

**Commits:** bbef074 (create), b8ac656 (fix)

**File created:** `src/lib/opportunity-cost.test.ts`

**Structure:**
- `@vitest-environment node` directive (line 3) — importable in pure node context
- `makePlayer` factory mirroring `suggest-transfers.test.ts` pattern
- `describe('Phase 74: computeOpportunityCostRows', ...)` outer block
- Nested describes:
  - `'Always returns Roll row'` — 1 it.todo
  - `'TFX-03: always returns 5 rows when suggestions exist'` — 2 it.todo
  - `'TFX-04: bankAfter and isAffordable'` — 7 it.todo
  - `'−8 Hit row (combo-hit-8)'` — 5 it.todo
- 1 passing `it('scaffold loads', () => expect(true).toBe(true))`

**Vitest result:** 1 passed | 15 todo (16 total) — exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2783 duplicate 'id' property in makePlayer factory**
- **Found during:** Task 01-02 (post-commit tsc check)
- **Issue:** The scaffold pattern in the plan specified `id: overrides.id` as an explicit property followed by `...overrides` which also spreads `id`. TypeScript reports TS2783 "specified more than once so this usage will be overwritten"
- **Fix:** Removed the explicit `id: overrides.id` line; the `...overrides` spread already handles it. Also removed `selling_price` and `purchase_price` which are not fields on `MergedPlayer`
- **Files modified:** `src/lib/opportunity-cost.test.ts`
- **Commit:** b8ac656

## Threat Flags

None — pure type and test-scaffold work; no I/O, no user input, no network, no auth surface.

## Known Stubs

None — this is a scaffold plan. The `it.todo()` blocks are intentional placeholders for Plan 03 to fill in once `computeOpportunityCostRows` gains `bankAfter`/`isAffordable`/`disabledReason`.

## Self-Check

Checking created files and commits...

## Self-Check: PASSED

- FOUND: src/lib/types.ts
- FOUND: src/lib/opportunity-cost.test.ts
- FOUND: .planning/phases/074-transfer-engine-overhaul/074-01-SUMMARY.md
- FOUND: commit 71ad556 (feat: extend TransferSuggestion combo cost union)
- FOUND: commit bbef074 (test: create opportunity-cost.test.ts scaffold)
- FOUND: commit b8ac656 (fix: remove duplicate id property)
