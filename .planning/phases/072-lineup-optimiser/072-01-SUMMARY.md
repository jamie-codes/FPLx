---
phase: 072-lineup-optimiser
plan: "01"
subsystem: lib/lineup-swap
tags: [lineup, swap, pure-function, formation-rules, tdd]
dependency_graph:
  requires:
    - src/lib/types.ts (OptimisedLineup, MergedPlayer types)
    - src/lib/optimise-lineup.ts (captain key fallback, formation predicate patterns)
  provides:
    - src/lib/lineup-swap.ts (isLegalSwap, applySwap exports)
  affects:
    - src/components/squad/LineupTab.tsx (Plan 02 — consumes isLegalSwap and applySwap)
tech_stack:
  added: []
  patterns:
    - Pure TypeScript function module (no React, no side effects, mirrors optimise-lineup.ts)
    - TDD RED→GREEN commit sequence (test(072-01) before feat(072-01))
key_files:
  created:
    - src/lib/lineup-swap.ts
    - src/lib/lineup-swap.test.ts
  modified: []
decisions:
  - "Formation predicate copied verbatim from optimise-lineup.ts:91-97 (DEF 3-5, MID 2-5, FWD 1-3) — ensures consistency with solver and prevents isLegalSwap from accepting lineups the solver would reject"
  - "captainKey fallback chain copied verbatim from optimise-lineup.ts:57-58 (xPts_90th_1gw ?? xPts_1gw ?? 0) — captain recomputation uses same ranking as initial optimise call"
  - "No 'use client' directive — pure node-compatible module; Plan 02 component imports without directive pollution"
metrics:
  duration: "2m 22s"
  completed: "2026-05-05T13:29:18Z"
  tasks_completed: 2
  files_created: 2
  tests_added: 10
requirements_satisfied: [LINEUP-01]
---

# Phase 72 Plan 01: Lineup Swap Pure Helpers Summary

Pure TypeScript swap helper library with GK-only rule, formation-predicate legality gate, and immutable captain/formation recomputation — all covered by 10 vitest unit tests matching VALIDATION.md substrings.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing tests for isLegalSwap and applySwap | ccf5d5e | src/lib/lineup-swap.test.ts |
| GREEN | Implement isLegalSwap and applySwap pure helpers | e1bb051 | src/lib/lineup-swap.ts |

## Files Created

### `src/lib/lineup-swap.ts`
Two named exports, no default export, no `'use client'` directive:

- **`isLegalSwap(lineup, starterId, benchId, playerMap)`** — Returns `boolean`. Enforces:
  1. GK rule (D-07): if either player is GK, both must be GK.
  2. Same-position outfield swap: always `true` (no formation change possible).
  3. Cross-position outfield swap: simulates new starters array, counts DEF/MID/FWD, validates formation predicate (DEF 3–5, MID 2–5, FWD 1–3). Mirrors `src/lib/optimise-lineup.ts:91-97` verbatim.
  4. Defensive guard: returns `false` if either id is missing from `playerMap`.

- **`applySwap(lineup, starterId, benchId, playerMap)`** — Returns new `OptimisedLineup`. Implements:
  1. Immutable swap: new starters/bench arrays via `.map()` (no in-place mutation).
  2. Captain recompute: sorts new starters by `captainKey = p.xPts_90th_1gw ?? p.xPts_1gw ?? 0` (mirrors `optimise-lineup.ts:57-58` verbatim).
  3. Formation string recompute: counts DEF/MID/FWD from new starters, derives `"${def}-${mid}-${fwd}"`.

### `src/lib/lineup-swap.test.ts`
10 unit tests in `// @vitest-environment node` (no jsdom overhead):
- `makePlayer` factory copied verbatim from `optimise-lineup.test.ts` (all 40+ fields, same `as MergedPlayer` cast)
- `buildFixture` helper creates a 4-3-3 lineup with standard 15-player playerMap (ids 1-15)

## Test Coverage

| VALIDATION Row | Test Name | Status |
|---------------|-----------|--------|
| 72-01-01 | `rejects illegal formation cross-position swap` | PASS |
| 72-01-02 | `GK only swaps with GK` | PASS |
| 72-01-03 | `applySwap recomputes captain after swap` | PASS |
| 72-01-04 | `formation string update after cross-position swap` | PASS |

Additional tests (non-VALIDATION-row coverage):
- `accepts same-position outfield swap unconditionally`
- `accepts legal cross-position swap (4-3-3 → 3-4-3)`
- `rejects swap when starter or bench id missing from playerMap`
- `does not mutate the input lineup`
- `swaps starter and bench ids at correct indices (same-position)`
- `formation string unchanged on same-position swap`

## Pattern Verification

- **Captain key fallback chain** matches `src/lib/optimise-lineup.ts:57-58` verbatim:
  `p.xPts_90th_1gw ?? p.xPts_1gw ?? 0`

- **Formation predicate** matches `src/lib/optimise-lineup.ts:91-97` verbatim:
  `def >= 3 && def <= 5 && mid >= 2 && mid <= 5 && fwd >= 1 && fwd <= 3`

- **No `'use client'` directive** — comment in file header mentions the absence explicitly; no directive line present.

## Threat Model Coverage

All STRIDE mitigations from the plan's threat register are implemented and tested:

| Threat | Mitigation | Test |
|--------|-----------|------|
| T-072-01: isLegalSwap accepting illegal cross-position swap | Formation predicate validated after simulating swap | 72-01-01 |
| T-072-02: applySwap returning captainId pointing to benched player | Captain recomputed from new starters | 72-01-03 |
| T-072-03: applySwap returning stale formation string | Formation recomputed from new starters element_types | 72-01-04 |
| T-072-04: applySwap mutating input lineup | .starters.map() and .bench.map() produce new arrays | `does not mutate the input lineup` |

## Deviations from Plan

None — plan executed exactly as written. Both function bodies match the plan's `<action>` code blocks verbatim. RESEARCH.md §Code Examples were followed without modification.

## Known Stubs

None.

## Threat Flags

None — pure in-memory function module; no network endpoints, no file access, no auth paths, no schema changes.

## TDD Gate Compliance

- RED gate: `test(072-01)` commit ccf5d5e (failing tests for non-existent module)
- GREEN gate: `feat(072-01)` commit e1bb051 (implementation making all 10 tests pass)

## Self-Check: PASSED

- `src/lib/lineup-swap.ts` exists: FOUND
- `src/lib/lineup-swap.test.ts` exists: FOUND
- RED commit ccf5d5e: FOUND
- GREEN commit e1bb051: FOUND
- `npm test -- src/lib/lineup-swap.test.ts` exits 0 with 10 tests passing: CONFIRMED
- `npx tsc --noEmit` passes with zero errors: CONFIRMED
