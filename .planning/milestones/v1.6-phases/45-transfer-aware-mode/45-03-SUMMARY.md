---
phase: 45
plan: "03"
subsystem: optimiser-ui
tags: [transfer-aware-mode, react, rtl, tdd, wave-2]
dependency_graph:
  requires:
    - 45-01
    - 45-02
  provides:
    - FtToggle component
    - Transfer Suggestions section in OptimiserPanel
    - 9 Phase 45 RTL test cases
  affects:
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx
tech_stack:
  added: []
  patterns:
    - useMemo for engine calls (mirrors optimiseLineup memo pattern)
    - useAuthStatus + useMyTeam hook pair (mirrors TransferPanel.tsx)
    - exactSellPrices Map memo (mirrors TransferPanel.tsx lines 65-68)
    - pill toggle component (mirrors GwToggle.tsx)
key_files:
  created:
    - src/components/optimiser/FtToggle.tsx
  modified:
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/optimiser/OptimiserPanel.test.tsx
decisions:
  - "FtToggle is 'use client' to enable onClick handlers — mirrors GwToggle pattern"
  - "exactSellPrices memo uses empty Map when unauthenticated (D-11 fallback to now_cost)"
  - "transferSuggestions memo dep array includes ftCount alongside [squadData, playersData, lineup, horizon, exactSellPrices]"
  - "Transfer Suggestions section uses nested <section> inside OptimiserPanel's outer <section>"
  - "break-even subline uses ml-0 sm:ml-[3.25rem] for mobile reset (UI-SPEC §6)"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-30"
  tasks_completed: 4
  tasks_total: 4
  files_created: 1
  files_modified: 2
---

# Phase 45 Plan 03: Transfer-Aware Mode UI Summary

One-liner: FtToggle pill + Transfer Suggestions section wired into OptimiserPanel via suggestTransfers engine, with 9 RTL tests locking the UI contract.

## What Was Built

### Task 1: FtToggle.tsx (new file)
- Created `src/components/optimiser/FtToggle.tsx` as a `'use client'` component
- Two-button pill toggle: "1 FT" / "2 FTs" with active/inactive Tailwind styling
- Mirrors GwToggle.tsx visual pattern exactly (same active: `bg-zinc-900 dark:bg-white`, inactive: `bg-zinc-100 dark:bg-zinc-800`)
- `min-h-[44px]` touch target on both buttons; `aria-pressed` reflects active state
- data-testids: `ft-toggle` (wrapper), `ft-toggle-1`, `ft-toggle-2`
- Type-checks clean

**Commit:** `5395e01` — `feat(45-03): create FtToggle component (1 FT / 2 FTs pill toggle)`

### Task 2: OptimiserPanel.tsx (extended)
Applied four additive edits:
- **Edit A (imports):** Added `suggestTransfers`, `useMyTeam`, `useAuthStatus`, `FtToggle`, `TransferSuggestion` type
- **Edit B (state + hooks + memos):** Added `ftCount` state (default 1), `useAuthStatus`, `useMyTeam` hooks, `exactSellPrices` useMemo, `transferSuggestions` useMemo
- **Edit C (JSX section):** Added Transfer Suggestions `<section>` after the mobile cards block, before the outer `</section>`. Contains: h3 heading, FtToggle, suggestion list (FREE/hit/combo variants) or empty state
- **Edit D:** No changes to early-return states (Transfer section only renders when lineup !== null)

All 15 Phase 44 tests pass after adding Phase 45 mocks with safe defaults.

**Commit:** `9a6c184` — `feat(45-03): wire FtToggle + transfer engine into OptimiserPanel`

### Task 3: OptimiserPanel.test.tsx (extended)
Three additive edits:
- **Edit A:** Added `useAuthStatusMock`, `useMyTeamMock`, `suggestTransfersMock` vi.fn() mocks with `vi.mock()` registrations
- **Edit B:** Extended `beforeEach` to reset all new mocks and set safe defaults (unauthenticated, empty suggestions) — ensures Phase 44 tests pass unchanged
- **Edit C:** Added `describe('Phase 45: Transfer-aware mode (transfer suggestions)')` with 9 test cases

All 9 test cases GREEN. All 15 Phase 44 tests still GREEN. Total: 24 tests, all passing.

**Commit:** `f0c5e0f` — `test(45-03): add 9 Phase 45 RTL tests for transfer suggestions UI`

## Test Results

```
Test Files  1 passed (1)
     Tests  24 passed (24)
  Start at  22:34:49
  Duration  845ms
```

Phase 44 describe blocks all present and unchanged:
- `Empty / loading / error states` (4 tests)
- `OPT-02 horizon toggle re-optimises` (1 test)
- `CMP-01 comparison table renders` (4 tests)
- `CMP-02 headline row` (3 tests)
- `CMP-03 mobile layout structure` (1 test)
- `OPT-05 BGW critical banner` (2 tests)

Phase 45 describe block (9 tests):
1. renders transfer-suggestions-section when lineup is non-null — PASS
2. FtToggle defaults to "1 FT" with aria-pressed=true on button 1 — PASS
3. clicking "2 FTs" updates aria-pressed and re-invokes suggestTransfers with ftCount=2 — PASS
4. renders empty state with locked copy when suggestTransfers returns [] — PASS
5. renders FREE single suggestion row with Out/In names, FREE pill, and +X.X xPts; no break-even subline — PASS
6. renders -4pts hit single suggestion with break-even subline (plural "GWs" when N > 1) — PASS
7. uses singular "GW" copy when breakEvenGws === 1 — PASS
8. does not render transfer-suggestions-section when lineup is null (BGW critical state) — PASS
9. passes empty Map for sellPrices when unauthenticated (D-11 fallback) — PASS

## Deviations from Plan

### Auto-fixed Issues

**[Rule 1 - Bug] Phase 44 tests failed without Phase 45 mocks**
- **Found during:** Task 2 verification
- **Issue:** Adding `useAuthStatus()` and `useMyTeam()` calls to OptimiserPanel caused Phase 44 tests to fail with "No QueryClient set" because those hooks use `useQueryClient()` internally and the test environment has no `QueryClientProvider`.
- **Fix:** Plan already anticipated this — Task 3's Edit A+B add the necessary mocks and defaults. Phase 44 tests only pass after Task 3 is complete. Proceeded to Task 3 without modifying the commit sequence.
- **Files modified:** `src/components/optimiser/OptimiserPanel.test.tsx`
- **Commit:** `f0c5e0f`

None beyond the above. Plan structure (task ordering) handled this correctly — Task 3 was always needed to make Task 2 testable.

## Known Stubs

None. All data flows are wired: suggestTransfers is mocked at the test layer; in production it receives real data from useSquad + usePlayers + useMyTeam.

## Threat Flags

None. Phase 45 introduces no new network endpoints, no new auth paths, no new persistent storage. All new data flows are read-only from already-authenticated existing endpoints (per plan threat model — mitigations T-45-12 confirmed: stable dep arrays [squadData, playersData, lineup, horizon, ftCount, exactSellPrices]).

## Task 4: Human Verification (APPROVED)

Visual verification completed by user. Confirmed:
- Transfer Suggestions section visible below comparison table
- FtToggle renders correctly (1 FT active by default)
- Toggle interaction re-runs engine
- FREE / -4pts / empty state variants render correctly
- Dark mode tokens correct
- Mobile responsive layout correct

Status: APPROVED 2026-04-30

## Self-Check: PASSED

- FOUND: src/components/optimiser/FtToggle.tsx
- FOUND: src/components/optimiser/OptimiserPanel.tsx
- FOUND: src/components/optimiser/OptimiserPanel.test.tsx
- FOUND commit: 5395e01 (FtToggle component)
- FOUND commit: 9a6c184 (OptimiserPanel wiring)
- FOUND commit: f0c5e0f (Phase 45 tests)
