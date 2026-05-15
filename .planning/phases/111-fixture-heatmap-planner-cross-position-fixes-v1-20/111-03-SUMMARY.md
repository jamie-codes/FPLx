---
phase: 111-fixture-heatmap-planner-cross-position-fixes-v1-20
plan: "03"
subsystem: testing
tags: [fpl, transfers, engine, audit, tdd, suggest-transfers, fix-02, regression-tests]

requires:
  - phase: 45-squad-optimiser-v1-6
    provides: suggestTransfers engine (src/lib/suggest-transfers.ts) and TransferSuggestion type

provides:
  - FIX-02 regression tests locking position-lock invariant (single + combo + guard — 3 new it() blocks)
  - VALID_ELEMENT_TYPES guard in suggestTransfers filtering corrupt element_type players at engine entry
  - FIX-02 call-site annotations on all 4 suggestTransfers consumers

affects: [112-optimiser-on-demand-transfer-cap, gsd-verify-work]

tech-stack:
  added: []
  patterns:
    - "vi.spyOn(console, 'warn') with try/finally restore for testing side-effect guards"
    - "VALID_ELEMENT_TYPES = new Set([1,2,3,4]) constant with O(N) filter before pool build"
    - "sanePlayers binding pattern: guard-filtered array replaces raw params arg for downstream use"

key-files:
  created: []
  modified:
    - src/lib/suggest-transfers.test.ts
    - src/lib/suggest-transfers.ts
    - src/components/transfers/TransferPanel.tsx
    - src/components/optimiser/OptimiserPanel.tsx
    - src/components/squad/DecisionSummaryTab.tsx
    - src/components/rivals/RivalsTab.tsx

key-decisions:
  - "FIX-02 characterization tests are GREEN-at-write: the engine was already correct; tests lock existing correct behaviour rather than fixing a bug"
  - "VALID_ELEMENT_TYPES guard uses Set.has() for O(1) per-player lookup; single console.warn per invocation (not per bad player) to avoid log spam"
  - "sanePlayers replaces raw players param only for playerById and inPoolByPosition; the guard comment explains that position-lock is belt-and-braces given the engine's own pos filter at line ~135"
  - "Call-site annotations use documentation-as-code pattern: the FIX-02 comment explicitly forbids pre-filtering, making the engine-contract self-evident at every consumption site"
  - "Pre-existing tsc error in decision-history/route.test.ts (Buffer<ArrayBufferLike> type mismatch) is out-of-scope — not caused by this plan's changes"

patterns-established:
  - "TDD RED-GREEN cycle for defensive guards: write spy-based failing test first, then add guard, verify all tests pass"
  - "Engine-level invariant documentation: characterization tests that lock already-correct behaviour (not fixing bugs)"

requirements-completed:
  - FIX-02
---

# Phase 111 Plan 03: FIX-02 Engine Guard + Audit Summary

**Engine-level position-lock provably enforced by 3 regression tests, defensive element_type guard (VALID_ELEMENT_TYPES) filtering corrupt players with console.warn, and FIX-02 call-site annotations on all 4 suggestTransfers consumers**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-15T10:45:00Z
- **Completed:** 2026-05-15T10:51:00Z
- **Tasks:** 3 (TDD — 4 commits: characterization, RED guard test, GREEN guard impl, call-site docs)
- **Files modified:** 6

## Accomplishments

- Locked the position-lock invariant with 3 FIX-02 regression tests (single, combo, guard) in `suggest-transfers.test.ts` — all 26 tests green (23 pre-existing + 3 new)
- Added `VALID_ELEMENT_TYPES = new Set([1,2,3,4])` constant and `sanePlayers` guard at the top of `suggestTransfers` — filters corrupt `element_type` players before pool/playerById construction and emits `[FIX-02]` console.warn with bad player ids
- Annotated all 4 call sites (TransferPanel, OptimiserPanel, DecisionSummaryTab, RivalsTab) with the canonical FIX-02 comment confirming engine position-lock contract and explicitly forbidding pre-filtering

## Task Commits

1. **Task 1: Add FIX-02 position-lock characterization tests (single + combo)** - `7527640` (test)
2. **Task 2 RED: Add failing test for engine element_type guard** - `833d88c` (test)
3. **Task 2 GREEN: Add defensive element_type guard to suggestTransfers** - `7f66a5f` (feat)
4. **Task 3: Annotate call sites with FIX-02 position-lock contract** - `4d9e594` (docs)

## Files Created/Modified

- `src/lib/suggest-transfers.test.ts` — Added `vi` to imports; added 3 FIX-02 `it()` blocks under `describe('Phase 111 FIX-02: Position lock invariants')`: single-position-lock characterization test, combo-position-lock characterization test, and guard test (console.warn spy + id=99 corrupt player)
- `src/lib/suggest-transfers.ts` — Added `VALID_ELEMENT_TYPES = new Set([1,2,3,4])` constant; added FIX-02 D-09 guard between empty-array early-return and `HORIZON_FIELD` lookup; replaced `players` with `sanePlayers` in `playerById` map build and `inPoolByPosition` filter
- `src/components/transfers/TransferPanel.tsx` — FIX-02 (Phase 111 D-08) comment above `return suggestTransfers(` in `ocsSuggestions` useMemo
- `src/components/optimiser/OptimiserPanel.tsx` — FIX-02 comment above `return suggestTransfers(` in `transferSuggestions` useMemo
- `src/components/squad/DecisionSummaryTab.tsx` — FIX-02 comment above `return suggestTransfers(` in `ocsSuggestions` useMemo
- `src/components/rivals/RivalsTab.tsx` — FIX-02 comment above `return suggestTransfers(` in `transferSuggestions` useMemo

## The 3 FIX-02 Test Cases

1. **Guard test** — builds valid squad + corrupt player (id=99, element_type=0), spies on console.warn, calls suggestTransfers, asserts warn was called with 'FIX-02' and '99', asserts id=99 not in any suggestion sell/buy
2. **Single position-lock** — strong candidates (ids 20-23, one per position), asserts every single suggestion has `sell.element_type === buy.element_type`
3. **Combo position-lock** — same setup, asserts every combo leg has `leg.sell.element_type === leg.buy.element_type` (skips if no combos returned with ftCount=1)

## Defensive Guard Location and Trigger Conditions

**Location:** `src/lib/suggest-transfers.ts`, after `if (currentPicks.length === 0 || players.length === 0) return []` and before `const field = HORIZON_FIELD[horizon]`

**Trigger:** `p.element_type as number` not in `{1, 2, 3, 4}` — fires on any player whose position code is outside the FPL-valid set

**Output:** Single `console.warn('[FIX-02] suggestTransfers: dropping N player(s) with invalid element_type: ids=...')` per invocation (not per-player, avoids log spam)

**Effect:** `sanePlayers` array (post-filter) feeds `playerById` Map and `inPoolByPosition` Set — corrupt players never enter either lookup

## The 4 Call Sites Annotated

All 4 use the canonical comment text:

```
// FIX-02 (Phase 111 D-08): position lock is enforced inside suggestTransfers — engine guarantees sell.element_type === buy.element_type per leg. Do NOT pre-filter players by position; the engine builds top-30-per-position pools internally.
```

| File | useMemo var | Line (approx) |
|------|-------------|---------------|
| TransferPanel.tsx | ocsSuggestions | 124 |
| OptimiserPanel.tsx | transferSuggestions | 273 |
| DecisionSummaryTab.tsx | ocsSuggestions | 233 |
| RivalsTab.tsx | transferSuggestions | 84 |

## No Call Site Needed a Pre-filter Fix

Per RESEARCH.md A1: the engine position filter (`inPoolByPosition.get(sell.element_type)`) was already correct. Each call site correctly passes the full `scoredPlayers`/`playersData` pool — the engine builds top-30-per-position internally. No call site was pre-filtering or passing wrong arguments. The annotations document this as explicit contract for future editors.

## Deviations from Plan

None — plan executed exactly as written. The TDD RED-GREEN-docs sequence completed in the specified order. All acceptance criteria met.

## Issues Encountered

- **Pre-existing tsc error:** `src/app/api/decision-history/route.test.ts` has a `Buffer<ArrayBufferLike>` type mismatch. This is unrelated to this plan's changes (confirmed: only `suggest-transfers.ts` and `suggest-transfers.test.ts` were staged at tsc run time; the error was pre-existing). Logged as out-of-scope, not fixed.
- **Pre-existing test failures:** `captain-picks.test.ts` (5 failures), `MobileNav.test.tsx` (10 failures), `useRivals.test.ts` (9 failures), `club-form.test.ts` (1 failure) — all pre-existing, confirmed in STATE.md deferred items. No action taken.

## Note for /gsd-verify-work

FIX-02 is engine-contract-verified. User-perceptible test: open Transfers / Optimiser / Decision Summary / Rivals tabs and confirm every Sell-Buy pair in the OCS table shares element_type (GK-for-GK, DEF-for-DEF, etc.). If any future cache corruption introduces a bad element_type, a `[FIX-02]` warn fires in the browser console on the next suggestTransfers invocation.

## Next Phase Readiness

- FIX-02 engine guard live; position-lock contract locked by tests and annotated at all call sites
- Plan 01 (FIX-01 data layer) and Plan 02 (FIX-01 render) run in parallel in Wave 1 — no dependencies on this plan
- Phase 112 (Optimiser On-Demand + Transfer Cap) can proceed once Phase 111 wave merge completes

---
*Phase: 111-fixture-heatmap-planner-cross-position-fixes-v1-20*
*Completed: 2026-05-15*

## Self-Check: PASSED

Files verified:
- `src/lib/suggest-transfers.test.ts` — FOUND
- `src/lib/suggest-transfers.ts` — FOUND
- `src/components/transfers/TransferPanel.tsx` — FOUND (contains FIX-02)
- `src/components/optimiser/OptimiserPanel.tsx` — FOUND (contains FIX-02)
- `src/components/squad/DecisionSummaryTab.tsx` — FOUND (contains FIX-02)
- `src/components/rivals/RivalsTab.tsx` — FOUND (contains FIX-02)

Commits verified:
- `7527640` test(111-03): add FIX-02 position-lock characterization tests — FOUND
- `833d88c` test(111-03): add failing test for engine element_type guard — FOUND
- `7f66a5f` feat(111-03): add defensive element_type guard to suggestTransfers (FIX-02 D-09) — FOUND
- `4d9e594` docs(111-03): annotate suggestTransfers call sites with FIX-02 position-lock contract — FOUND
