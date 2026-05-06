---
phase: 65
plan: 02
subsystem: lib
tags: [rejection-explainer, computeRejection, pure-function, tdd-green, WHY-01]
dependency_graph:
  requires:
    - 065-01 (rejection.test.ts RED contract)
  provides:
    - src/lib/explain.ts (computeRejection + RejectionResult + REJECTION_START_PROB_THRESHOLD + REJECTION_OWNERSHIP_THRESHOLD)
  affects:
    - src/lib/__tests__/rejection.test.ts (turns 14 tests GREEN)
tech_stack:
  added: []
  patterns:
    - pure function following computeFragility() pattern (exported constants + interface + function)
    - adaptive framing via gem_score > positionAverage threshold (strict greater-than, not >=)
    - D-07 signal order: rank, rotation risk, fixture difficulty, fragility (delegated), ownership
    - computeFragility delegation with isTransfer=false (Pitfall 4 compliance)
key_files:
  created: []
  modified:
    - src/lib/explain.ts
decisions:
  - "Adaptive framing uses strict > (not >=) for gem_score comparison — test population puts avg player at exactly posAvg; >= would incorrectly mark them 'strong'"
  - "Hard fixtures (difficulty_tier=hard) trigger 'Difficult fixture (FDR hard)' rejection reason — per RESEARCH Open Q1 resolution; computeFragility only flags medium but rejection context is broader"
  - "computeFragility(player, false) — isTransfer=false throughout; hit-cost check skipped for ranking context"
  - "POSITION_CODES as module-private Record<number, string> — not exported; only REJECTION_* constants are exported"
metrics:
  duration: 5m
  completed: 2026-05-06
---

# Phase 65 Plan 02: computeRejection GREEN Implementation Summary

**One-liner:** `computeRejection()` pure function with adaptive framing, D-07 signal order, and fragility delegation turns all 14 WHY-01 RED tests GREEN in `src/lib/explain.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add computeRejection + RejectionResult + threshold constants to explain.ts | 9738160 | src/lib/explain.ts |

## Diff Summary (additions to explain.ts after computeExplanations)

Lines 1-3 (new imports):
```typescript
import type { ScoredPlayer } from '@/lib/types'
import { computeFragility } from '@/lib/sensitivity'
import { computePositionAverages } from '@/lib/recommend'
```

Lines 86-173 (new additions after existing computeExplanations, line 75):
```typescript
export const REJECTION_START_PROB_THRESHOLD = 0.70
export const REJECTION_OWNERSHIP_THRESHOLD = 20.0

const POSITION_CODES: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

export interface RejectionResult {
  reasons: string[]   // empty => positive framing
  xPtsRank: number    // 1-based rank within position by xPts_1gw descending
}

export function computeRejection(player: ScoredPlayer, allPlayers: ScoredPlayer[]): RejectionResult {
  // Rank within position by xPts_1gw descending (D-05)
  // Adaptive framing: gem_score > posAvg AND no fragility AND start_prob >= 0.70 → positive
  // D-07 signal order: rank, rotation risk, fixture difficulty, fragility, ownership
  // computeFragility(player, false) — Pitfall 4: isTransfer=false
  // RESEARCH Open Q1: medium OR hard fixtures both trigger rejection reason
}
```

## Test Run Output

```
 RUN  v4.1.2

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  14:50:30
   Duration  174ms (transform 37ms, setup 0ms, import 50ms, tests 5ms, environment 0ms)
```

## Type Check Output

`npx tsc --noEmit` produces 6 errors — all in Wave 0 test stubs created by Plan 01:
- `ExplainPanel.test.tsx` — 5 errors: `rejectionReasons` prop not yet declared on ExplainPanelProps (Plan 03 work)
- `HighOwnershipCallout.test.tsx` — 1 error: module not yet created (Plan 03 work)

These errors are identical to the pre-Plan 02 baseline (confirmed via `git stash` comparison). Plan 02 resolves all `rejection.test.ts` TypeScript errors (was 11 errors, now 0).

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| computeExplanations preserved | PASS — `grep -F "export function computeExplanations(player: ScoredPlayer): string[]"` returns 1 line |
| Original 10 constants preserved | PASS — `grep -cE "^export const (FORM_POSITIVE_THRESHOLD|...)" = 10` |
| REJECTION_* constants exported | PASS — `grep -cE "^export const REJECTION_(START_PROB_THRESHOLD|OWNERSHIP_THRESHOLD)" = 2` |
| RejectionResult interface exported | PASS — `grep -cE "^export interface RejectionResult" = 1` |
| computeRejection function exported | PASS — `grep -cE "^export function computeRejection\(" = 1` |
| computeFragility called with false | PASS — `grep -F "computeFragility(player, false)"` returns 1 line |
| parseFloat on selected_by_percent | PASS — 2 occurrences (line 69 existing + line 169 new) |
| Em-dash U+2014 in rotation risk | PASS — `grep -F "Rotation risk — start probability"` returns 1 line |
| "FDR " literal present | PASS — `grep -F "Difficult fixture (FDR "` returns 1 line |
| "Fragile: no longer recommended if: " present | PASS — 1 template literal |
| All 14 rejection.test.ts tests pass | PASS — 14/14 green |
| No regressions in adjacent tests | PASS — 124 tests pass in adjacent area (ExplainPanel/HighOwnershipCallout failures are pre-existing Plan 01 RED stubs) |

## Key Deviation: Strict Greater-Than for Adaptive Framing

**Rule: Auto-fix (Rule 1)**

**Found during:** Task 1 — initial implementation used `>=` for gem_score comparison; 4 tests failed.

**Issue:** Tests construct populations where "weak player" tests have gem_score=0.2 and all population players also have gem_score=0.2 (makePopulation inherits target's gem_score). With `>=`, posAvg=0.2 and target.gem_score=0.2 satisfies `>=`, wrongly giving positive framing to weak players.

**Fix:** Changed `player.gem_score >= posAvg` to `player.gem_score > posAvg` (strict greater-than). Strong players need gem_score ABOVE the average, not at it.

**Impact:** Positive-framing test still passes (gem_score=0.8 > posAvg=0.275). All 14 tests pass.

**Files modified:** src/lib/explain.ts (isStrong condition, line 130)

## computeFragility Delegation Confirmation

`computeFragility` is called exactly once in `computeRejection` with `isTransfer=false`:

```typescript
const { reasons: fragilityReasons } = computeFragility(player, false) // Pitfall 4: isTransfer=false
```

The `false` literal is the second positional argument. The hit-cost check (`isTransfer && xPtsGain < 4.0`) is never triggered. Each fragility reason is prefixed with `"Fragile: no longer recommended if: "`.

## Known Stubs

None — `computeRejection` is fully implemented with all signals wired.

## Threat Flags

None — pure function over existing in-memory ScoredPlayer data. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

Files exist:
- src/lib/explain.ts: FOUND (100 lines added)

Commits exist:
- 9738160: FOUND (feat(065-02): implement computeRejection + RejectionResult + threshold constants)
