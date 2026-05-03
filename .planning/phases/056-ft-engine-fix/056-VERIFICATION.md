---
phase: 056-ft-engine-fix
verified: 2026-05-03T18:02:00Z
status: human_needed
score: 6/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Authenticated user with event_transfers === 0 sees GW1 FT count = 2 in the multi-GW planner"
    expected: "GW1 row of TransferPlanTable shows freeTransfersAvailable = 2; a 2-transfer GW1 step computes hitCost = 0"
    why_human: "The useMemo logic and its wiring are verified programmatically, but the end-to-end authenticated UI path — real myTeamData flowing through the new useMemo and rendering in TransferPlanTable — can only be confirmed by a human with a live FPL account where event_transfers === 0. No unit test exists for this React component path."
  - test: "Unauthenticated user still sees GW1 FT count = 1 (safe default preserved)"
    expected: "Signed-out path returns { available: 1, banked: 0 } as initial state; GW1 FT cell shows 1"
    why_human: "Same reasoning — the component render path requires a browser session. The code branch is verified in source, but live rendering is not programmtically testable here."
---

# Phase 056: FT Engine Fix Verification Report

**Phase Goal:** Fix the FT engine Wildcard branch bug (FTX-02) and make PlannerTab seed the correct initial FT state from authenticated user data (FTX-01).
**Verified:** 2026-05-03T18:02:00Z
**Status:** HUMAN_NEEDED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `computeNextFTState(2, 5, 'wildcard')` returns `{ available: 2, banked: 1 }` — Wildcard preserves bank when entering with 2 FTs | VERIFIED | `free-transfer-engine.ts` lines 9-13: wildcard branch uses `Math.min(1, currentAvailable - 1)` formula; test at line 40-42 asserts `{ available: 2, banked: 1 }`; 38/38 tests pass |
| 2 | `computeNextFTState(1, 5, 'wildcard')` returns `{ available: 1, banked: 0 }` — Wildcard with 1 FT entering yields 1 FT next GW | VERIFIED | Test at line 44-46 asserts `{ available: 1, banked: 0 }` for `(1, 5, 'wildcard')`; formula `Math.min(1, 1-1) = 0` → `nextAvailable = 1`; passes |
| 3 | `computeNextFTState(2, 0, 'wildcard')` returns `{ available: 2, banked: 1 }` — bank preserved regardless of transfersUsed | VERIFIED | Test at line 49-52 asserts `{ available: 2, banked: 1 }` for `(2, 0, 'wildcard')`; transfersUsed is not used in wildcard branch; passes |
| 4 | `computeNextFTState(1, 0, null)` returns `{ available: 2, banked: 1 }` — rolling 1 FT yields 2 next GW | VERIFIED | Test at line 84-87 (D-08 regression block); also covered by normal-GW describe at line 10-13; passes |
| 5 | Two consecutive rolls `(1,0,null)` → `(2,0,null)` yield `{ available: 2, banked: 1 }` — cap of 2 respected | VERIFIED | D-08 regression test "rolling 2 GWs → still 2 (cap respected)" at lines 89-93 chains two calls and asserts cap; passes |
| 6 | Free Hit branch unchanged: `computeNextFTState(2, 5, 'freehit')` still returns `{ available: 2, banked: 1 }` | VERIFIED | `free-transfer-engine.ts` lines 15-19: freehit branch unchanged with same formula; test at line 57-60 asserts `{ available: 2, banked: 1 }`; passes |
| 7 | Authenticated user with `event_transfers === 0` and no active chip sees `initialFTState = { available: 2, banked: 1 }` in PlannerTab; unauthenticated path falls back to `{ available: 1, banked: 0 }` | HUMAN NEEDED | Code is verified: `PlannerTab.tsx` lines 58-65 implement the correct useMemo with four branches. Wiring to `generatePlan` (line 78) and two `ftStateAfterStepIndex` calls (lines 120, 217) is confirmed. However, the live rendering of the FT count in TransferPlanTable requires a browser session with real authenticated FPL data. |

**Score:** 6/7 truths verified (1 requires human confirmation of UI rendering)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/free-transfer-engine.ts` | Wildcard branch using bank-preservation formula | VERIFIED | Lines 9-13: `if (chip === 'wildcard')` branch with `Math.min(1, currentAvailable - 1)` formula; FTX-02 comment marker at line 8 |
| `tests/lib/free-transfer-engine.test.ts` | Updated wildcard expectations + D-08 regression describe block | VERIFIED | Lines 38-53: updated wildcard chip describe (3 bank-preservation cases); lines 83-114: D-08 regression describe with 6 test cases |
| `src/lib/planning-engine.ts` | D-07 comment at the null chip call site | VERIFIED | Lines 203-205: 2-line comment "D-07: AI-generated plans never auto-select chips..." prepends unchanged `computeNextFTState(..., null)` call |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/planner/PlannerTab.tsx` | `useMemo<FTState>` replacing hardcoded const | VERIFIED | Lines 58-65: `const initialFTState: FTState = useMemo(...)` with dependency array `[isAuthenticated, myTeamData, squadData]`; four-branch logic present |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/lib/free-transfer-engine.test.ts` | `src/lib/free-transfer-engine.ts` | `import { computeNextFTState } from '@/lib/free-transfer-engine'` | VERIFIED | Import at line 2; `computeNextFTState` called in 38 test cases |
| `free-transfer-engine.ts` wildcard branch | `free-transfer-engine.ts` freehit branch | identical formula: `Math.min(1, currentAvailable - 1)` | VERIFIED | Both branches contain identical formula body; `grep -c "Math.min(1, currentAvailable - 1)"` returns 2 |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PlannerTab.initialFTState (useMemo)` | `useAuthStatus`, `useMyTeam`, `useSquad` | deps array `[isAuthenticated, myTeamData, squadData]` | VERIFIED | Line 65: dependency array confirmed; all three hooks destructured at lines 29-34 before the useMemo |
| `PlannerTab.initialFTState` | `generatePlan` + `ftStateAfterStepIndex` | passed as FTState arg at lines 78, 120, 216-217 | VERIFIED | 5 total references to `initialFTState`: 1 declaration + 4 consumer usages (line 78 in `handleGeneratePlan`, line 120 in `handleManualEdit`, lines 216-217 in `handleChipToggle`) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlannerTab.tsx` initialFTState | `myTeamData.entry_history.event_transfers` | `useMyTeam(isAuthenticated)` hook → `/api/fpl/[...proxy]` → FPL API | Yes — reads real field from authenticated FPL my-team response | WIRED (programmatic portion confirmed; live UI path is the human-verify item) |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 38 free-transfer-engine tests pass including D-08 regression and updated wildcard block | `npx vitest run tests/lib/free-transfer-engine.test.ts` | 38 passed (0 failed) | PASS |
| Old wrong wildcard assertion `{ available: 1, banked: 0 }` is gone from wildcard(2,5) call | `grep -A 5 "computeNextFTState(2, 5, 'wildcard')" ... | grep "available: 1, banked: 0"` | No output (0 matches) | PASS |
| Old hardcoded const is gone from PlannerTab | `grep -F "const initialFTState: FTState = { available: 1, banked: 0 }" PlannerTab.tsx` | No output (0 matches) | PASS |
| `Math.min(1, currentAvailable - 1)` appears exactly twice in engine (once per chip path) | `grep -c "Math.min(1, currentAvailable - 1)" free-transfer-engine.ts` | 2 | PASS |
| D-08 regression describe block exists exactly once | `grep -c "D-08 regression" free-transfer-engine.test.ts` | 1 | PASS |
| Wildcard branch no longer returns static `{ available: 1, banked: 0 }` literal | `grep -c "return { available: 1, banked: 0 }" free-transfer-engine.ts` | 0 | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| FTX-01 | 056-02-PLAN.md | System correctly banks unused free transfers; planner seeds correct initial FT state from authenticated user data | PARTIALLY VERIFIED | Code implementation confirmed: `useMemo` with 4-branch logic; downstream wiring confirmed. Live UI rendering of `freeTransfersAvailable: 2` for authenticated rolled-FT path requires human verification. |
| FTX-02 | 056-01-PLAN.md | Wildcard chip activations preserve the banked FT count rather than resetting it | VERIFIED | Engine fix confirmed in `free-transfer-engine.ts`; 38/38 tests pass including updated wildcard assertions and D-08 regression block |

**REQUIREMENTS.md traceability:** Both FTX-01 and FTX-02 are mapped to Phase 56 in the traceability table. Both plans claim these IDs. No orphaned requirements — the only Phase 56 requirements are FTX-01 and FTX-02 and both are accounted for.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, placeholders, empty implementations, or stub patterns found in any of the three modified files. The wildcard branch is a complete formula implementation (not a placeholder), and the `useMemo` contains real branching logic with real data dependency.

---

## Human Verification Required

### 1. Authenticated rolled-FT path renders freeTransfersAvailable = 2 at GW1

**Test:** Sign in to the FPL app. Confirm via DevTools Network that `/api/fpl/my-team/...` response has `entry_history.event_transfers === 0` (i.e. no transfer made this GW). Navigate to the Planner section and click "Generate Plan". Inspect the GW1 row of the TransferPlanTable — the FT count cell must show 2 (not 1). Also confirm that a 2-transfer GW1 step does not incur a -4 hit.

**Expected:** GW1 FT cell shows `freeTransfersAvailable: 2`; no hit penalty for using 2 transfers when `event_transfers === 0`.

**Why human:** The `useMemo` logic is verified in source code. The dependency array, branch conditions, and downstream consumption at `generatePlan` and `ftStateAfterStepIndex` are all confirmed wired. However, confirming that real authenticated `myTeamData` flows through the React render cycle and produces the correct visible cell value in `TransferPlanTable` requires a live browser session with a real FPL account.

### 2. Unauthenticated path still shows freeTransfersAvailable = 1

**Test:** Sign out (clear cookies) or use an incognito session. Navigate to the Planner section. Click "Generate Plan". Inspect the GW1 row of TransferPlanTable — the FT count cell must show 1 (the safe default).

**Expected:** GW1 FT cell shows `freeTransfersAvailable: 1`; the unauthenticated branch in the useMemo (`!isAuthenticated || !myTeamData`) returns `{ available: 1, banked: 0 }`.

**Why human:** Same reasoning — the unauthenticated branch is verified in source (line 59 of PlannerTab.tsx) but its rendering output cannot be confirmed without a browser session.

---

## Gaps Summary

No blocking gaps found. The two human verification items are confirmations of correct UI rendering — the underlying logic is fully implemented and wired. Phase 056 goal is achieved at the code level for both FTX-01 (engine and consumer) and FTX-02 (engine fix with tests). Human sign-off on the live UI paths closes the phase.

---

_Verified: 2026-05-03T18:02:00Z_
_Verifier: Claude (gsd-verifier)_
