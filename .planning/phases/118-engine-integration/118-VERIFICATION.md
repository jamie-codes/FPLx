---
phase: 118-engine-integration
verified: 2026-05-17T21:55:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 118: Engine Integration Verification Report

**Phase Goal:** `suggestTransfers()` and `optimiseLineup()`/`benchOrder()` accept optional `lineupNewsMap` and apply lineup-news availability penalties per ENGN-01 and ENGN-02.
**Verified:** 2026-05-17T21:55:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | useLineupNews returns `undefined` when `scraped_at` is older than 48 hours | VERIFIED | `lineupNewsSelect` at line 10 of `useLineupNews.ts`: `if (ageMs > 48 * 60 * 60 * 1000) return undefined`; test passes (49h-stale case) |
| 2 | useLineupNews returns `Map<number, LineupNewsPlayer>` keyed by player id when data is fresh | VERIFIED | `return new Map(data.players.map(p => [p.id, p]))` at line 11; test cases pass for fresh and exactly-48h boundary |
| 3 | useLineupNews preserves existing 6h staleTime and queryKey/queryFn behaviour | VERIFIED | Lines 16–23 of `useLineupNews.ts` show `queryKey: ['lineup-news']`, `staleTime: 6 * 60 * 60 * 1000`, `queryFn` unchanged |
| 4 | Confirmed-absent buy candidate's xPtsGain is multiplied by 0.01 floor — player sinks to bottom of position bucket | VERIFIED | `availFactor` closure at line 120–126: `Math.max(0.01, entry.availability_factor)`; ENGN-01 Test A passes (absent MID filtered out by negative gain; healthy 6.0 still appears) |
| 5 | Doubted buy candidate (0.25–0.75) is ranked below an equally-rated healthy candidate | VERIFIED | `scoreBuyCandidate = scorePlayer * availFactor`; ENGN-01 Test B passes (doubted DEF 8.0×0.5=4.0 < healthy 7.0×1.0=7.0) |
| 6 | lineupNewsMap=undefined OR player absent from map OR availability_factor=null produces identical output to pre-Phase-118 call | VERIFIED | ENGN-01 Tests C and D pass; `!lineupNewsMap` guard returns 1.0; `null` factor returns 1.0 (D-03) |
| 7 | Sell-side scoring is NOT penalised | VERIFIED | Lines 173, 224, 231 of `suggest-transfers.ts` use `scorePlayer(sell/sell1/sell2)` (not `scoreBuyCandidate`); ENGN-01 Test E passes |
| 8 | Confirmed-absent starter candidate is excluded from C(15,11) enumeration — never appears in `starters[]` | VERIFIED | `eligible` filter at lines 56–59 of `optimise-lineup.ts`; ENGN-02 Test A passes |
| 9 | Excluding confirmed-absent players drops eligible below 11 → `optimiseLineup()` returns null | VERIFIED | Reuses existing `if (eligible.length < 11) return null` at line 63; ENGN-02 Test C passes (5 absent players → null) |
| 10 | Doubted players (0.25–0.75) are NOT excluded from starter enumeration and NOT zeroed in benchOrder | VERIFIED | Filter only checks `status_label === 'confirmed_absent'`; ENGN-02 Tests B and F pass |
| 11 | Confirmed-absent bench outfield player's evScore is set to 0 — sorts to end of bench partition | VERIFIED | `evScore` early-return at line 208: `if (lineupNewsMap?.get(p.id)?.status_label === 'confirmed_absent') return 0`; ENGN-02 Test E passes |
| 12 | lineupNewsMap=undefined produces identical output from optimiseLineup/benchOrder vs pre-Phase-118 forms | VERIFIED | ENGN-02 Test D passes; optional param default behaviour unchanged |
| 13 | optimiseLineup threads lineupNewsMap through to internal benchOrder call | VERIFIED | Line 151: `benchOrder(benchOutfieldRaw, starterPlayers, horizon, lineupNewsMap)` |
| 14 | 48h staleness gate enforced at hook boundary so engines stay timestamp-unaware | VERIFIED | `lineupNewsSelect` named export provides gate; engines receive `Map | undefined` with no timestamp logic needed internally |

**Score: 14/14 truths verified**

---

### Required Artifacts

| Artifact | Expected | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `src/lib/hooks/useLineupNews.ts` | TanStack Query hook with 48h staleness select transform producing `Map<number, LineupNewsPlayer> \| undefined` | Yes | Yes — `lineupNewsSelect`, `useQuery` generic, `select:` | Yes — `select: lineupNewsSelect` wired into hook | VERIFIED |
| `src/lib/hooks/useLineupNews.test.ts` | Vitest coverage for fresh/stale/boundary/identity cases | Yes | Yes — 4 test cases in describe block | Yes — tests import and call `lineupNewsSelect` directly | VERIFIED |
| `src/lib/suggest-transfers.ts` | `suggestTransfers()` with optional `lineupNewsMap` param, `scoreBuyCandidate` closure, sell side unchanged | Yes | Yes — `lineupNewsMap?` in interface, `availFactor`, `scoreBuyCandidate` closures, 4 buy-side substitutions | Yes — wired into `SuggestTransfersParams`, `availFactor` called in `scoreBuyCandidate`, applied at all 4 buy-side sites | VERIFIED |
| `src/lib/suggest-transfers.test.ts` | Vitest coverage for 6 ENGN-01 cases | Yes | Yes — `describe('Phase 118 ENGN-01: lineupNewsMap availability penalty')` with 6 `it()` blocks | Yes — tests pass `lineupNewsMap` to `suggestTransfers()` | VERIFIED |
| `src/lib/optimise-lineup.ts` | `optimiseLineup()` and `benchOrder()` with optional `lineupNewsMap` param; eligible filter, evScore, internal benchOrder call | Yes | Yes — both function signatures extended; eligible filter extended; evScore early-return; internal call threads map | Yes — all connections present and tested | VERIFIED |
| `src/lib/optimise-lineup.test.ts` | Vitest coverage for 6 ENGN-02 cases (two describe blocks) | Yes | Yes — `describe('Phase 118 ENGN-02: lineupNewsMap absent-player exclusion')` and `describe('Phase 118 ENGN-02: benchOrder absent-player zero EV')` with 6 `it()` blocks | Yes — tests call `optimiseLineup` and `benchOrder` with 4-arg signatures | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useLineupNews.ts` | `src/lib/types.ts` | `import type { LineupNews, LineupNewsPlayer }` | WIRED | Line 2 of `useLineupNews.ts` |
| `useLineupNews.ts` | useQuery return type | `select: lineupNewsSelect` (select transform) | WIRED | `useQuery<LineupNews, Error, Map<number, LineupNewsPlayer> \| undefined>` with `select:` at line 23 |
| `suggest-transfers.ts` | `src/lib/types.ts` | `import type { ..., LineupNewsPlayer }` | WIRED | Line 27: `import type { MergedPlayer, OptimiserHorizon, TransferSuggestion, LineupNewsPlayer }` |
| `suggest-transfers.ts` `SuggestTransfersParams` | `lineupNewsMap` field | `lineupNewsMap?: Map<number, LineupNewsPlayer>` | WIRED | Line 55 of `suggest-transfers.ts` |
| `scoreBuyCandidate` closure | in-pool sort + 1-FT gain + 2-FT gains | Replaces `scorePlayer` at exactly 4 buy-side call sites | WIRED | Lines 153, 175, 235, 239 confirmed; sell-side lines 173, 224, 231 use `scorePlayer` unchanged |
| `optimise-lineup.ts` | `src/lib/types.ts` | `import type { ..., LineupNewsPlayer }` | WIRED | Line 5: `import type { MergedPlayer, OptimiserHorizon, OptimisedLineup, LineupNewsPlayer }` |
| `optimiseLineup` eligible filter | `lineupNewsMap.get(pick.element)?.status_label === 'confirmed_absent'` | Extended filter excludes `confirmed_absent` | WIRED | Lines 56–59 of `optimise-lineup.ts` |
| `benchOrder` `evScore` | returns 0 when player is `confirmed_absent` | Early-return 0 before existing formula | WIRED | Line 208 of `optimise-lineup.ts` |
| `optimiseLineup` internal `benchOrder` call | `benchOrder(..., lineupNewsMap)` | 4th argument threads the map | WIRED | Line 151: `benchOrder(benchOutfieldRaw, starterPlayers, horizon, lineupNewsMap)` |

---

### Data-Flow Trace (Level 4)

Not applicable — all three modified files are pure TypeScript engine functions. No React rendering, no UI data binding, no state rendering paths to trace. The engines produce computed return values (not rendered state), which are fully exercised by the Vitest test suite.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `useLineupNews` 4-test suite (fresh/stale/boundary/identity) | `npx vitest run src/lib/hooks/useLineupNews.test.ts` | 4/4 passed | PASS |
| `suggestTransfers` full suite (32 tests, incl. 6 ENGN-01) | `npx vitest run src/lib/suggest-transfers.test.ts` | 32/32 passed | PASS |
| `optimiseLineup`/`benchOrder` full suite (23 tests, incl. 6 ENGN-02) | `npx vitest run src/lib/optimise-lineup.test.ts` | 23/23 passed | PASS |
| TypeScript compile (phase 118 files) | `npx tsc --noEmit` (files: useLineupNews.ts, suggest-transfers.ts, optimise-lineup.ts) | 0 errors in phase 118 files (pre-existing unrelated error in `api/decision-history/route.test.ts` only) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-02 | Plan 01 | Engine consumers treat `scraped_at` older than 48h as neutral — no penalty when stale | SATISFIED | `lineupNewsSelect` returns `undefined` when `ageMs > 48 * 60 * 60 * 1000`; strict `>` boundary (exactly 48h = Map); tested with 3 cases |
| ENGN-01 | Plan 02 | Transfer suggestions penalise doubted and confirmed-absent buy candidates via optional `lineupNewsMap` in `suggestTransfers()` | SATISFIED | `lineupNewsMap?` in `SuggestTransfersParams`; `availFactor` closure; `scoreBuyCandidate` at 4 buy-side sites; sell-side unaffected; 6 TDD tests all pass |
| ENGN-02 | Plan 03 | Bench order and lineup optimiser treat confirmed-absent players as 0 EV — sink to last bench slot | SATISFIED | `optimiseLineup()` eligible filter excludes `confirmed_absent`; `benchOrder()` `evScore` early-returns 0 for `confirmed_absent`; internal benchOrder call threads map; 6 TDD tests all pass |

**Requirement wording note (non-blocking):** REQUIREMENTS.md §ENGN-01 mentions `×0.70` as the doubted multiplier. The implementation uses `availability_factor` directly as the multiplier (design decision D-01 per 118-CONTEXT.md), which is more accurate than a fixed `×0.70` value. The CONTEXT.md explicitly overrides the REQUIREMENTS.md wording. This deviation is intentional, documented, and strictly superior to the alternative. No action required.

---

### Anti-Patterns Found

Scan of all six Phase 118 files:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No TODO/FIXME/placeholder comments, no empty implementations (`return null`, `return {}`, `return []`), no stub handlers. All return values carry real computed data.

---

### Human Verification Required

None. All phase deliverables are pure TypeScript engine functions with deterministic unit test coverage. No UI rendering, no external service integration, no visual appearance, no real-time behaviour.

---

## Gaps Summary

No gaps found. All 14 must-haves are verified, all tests pass, TypeScript compiles without errors in phase 118 files, and no anti-patterns were detected.

---

_Verified: 2026-05-17T21:55:00Z_
_Verifier: Claude (gsd-verifier)_
