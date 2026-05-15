---
phase: 113-transfer-regret-backtester-v1-20
plan: "03"
subsystem: api
tags: [fpl, api, decision-history, transfer-regret, suggest-transfers, security, vercel-blob]

# Dependency graph
requires:
  - phase: 113-01
    provides: SlimPlayer + TransferRegretEntry types; merged_players_slim_gw{N}.json blob writes
  - phase: 113-02
    provides: computeTransferDelta + computeTransferSeasonSummary pure functions
  - phase: 96-captain-decision-backtester
    provides: readSnapshot + readGwPicks patterns; element-summary fan-out; teamId guard

provides:
  - "GET /api/decision-history now returns transferEntries: TransferRegretEntry[] on response payload"
  - "readTransferSlimSnapshot — reads merged_players_slim_gw{N}.json from Vercel Blob per GW"
  - "fetchTransfers — fetches /entry/{teamId}/transfers/ season-aggregate array"
  - "reconstructPreTransferSquad — pure function swapping element_in→element_out to recover pre-transfer state (D-03)"
  - "suggestTransfers post-hoc call per finished GW with bank:9999 simplification"
  - "transferActualPtsMap — separate element-summary fan-out (Promise.allSettled) for transfer player IDs"
  - "All four ASVS L1 security guards present: teamId regex, blob pathname exact-match, SSRF regex, JSON parse try/catch"

affects:
  - 113-04 (BackTab UI — consumes data.transferEntries from useDecisionHistory hook)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "transfer regret pipeline: readTransferSlimSnapshot mirrors readSnapshot exactly (same blob pattern, exact-match guard, local fallback)"
    - "fetchTransfers: copied verbatim from season-analytics/route.ts — flat season-aggregate array, filter by event === gw before use (Pitfall 2)"
    - "reconstructPreTransferSquad: pure function, swap element_in→element_out per gwTransfers entry to recover pre-transfer squad (D-03, Pitfall 1)"
    - "bank: 9999 post-hoc simplification: budget filter bypassed since bank balance at decision time not stored (Pitfall 4)"
    - "try/catch wrapper around entire transfer pipeline block: T-113-13 guard ensures captain response never breaks if transfer side fails"
    - "SSRF guard: !/^\\d+$/.test(String(id)) before each element-summary fetch URL construction (T-113-10)"

key-files:
  created: []
  modified:
    - src/app/api/decision-history/route.ts

key-decisions:
  - "bank: 9999 for post-hoc suggestTransfers — unconstrained budget matches the hindsight orientation of the tool; budget accuracy would require bank balance at decision time which is not stored in slim snapshot"
  - "fetchTransfers called once in the main Promise.all, not per-GW — returns season-aggregate array filtered per GW inside the pipeline loop (Pitfall 2)"
  - "Separate transferActualPtsMap (not merged into captain actualPtsMap) — keeps the two fan-outs independent; avoids accidental key collisions on shared player IDs"
  - "ftCount mirrors user's actual transfer count (gwTransfers.length >= 2 ? 2 : 1) so engine's combo enumeration matches D-07"
  - "Web name lookup: slim snapshot first, then bootstrap elementMap fallback — handles players whose IDs appear in transfers but not in the current-GW snapshot"
  - "Tasks 1 and 2 committed atomically in one feat commit — both modify only route.ts and were implemented in a single pass"

patterns-established:
  - "Pattern: transfer pipeline try/catch wraps the entire Step 4 block; on any error transferEntries = [] and captain data still returns — T-113-13"
  - "Pattern: allTransfers.filter(t => t.event === gw) per-GW before reconstructPreTransferSquad — prevents wrong-season squad corruption (Pitfall 2)"
  - "Pattern: engineOutIds/engineInIds extraction handles both 'single' (sell/buy) and 'combo' (transfers[]) TransferSuggestion shapes"

requirements-completed: [BACK-02]

# Metrics
duration: 8min
completed: 2026-05-15
---

# Phase 113 Plan 03: Transfer Regret API Extension Summary

**GET /api/decision-history extended with transferEntries: TransferRegretEntry[] — slim snapshot reader, squad reconstructor, suggestTransfers post-hoc call, element-summary fan-out, and computeTransferDelta assembly; all four ASVS L1 security guards present; captain path untouched**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-15T20:02:50Z
- **Completed:** 2026-05-15T20:11:00Z
- **Tasks:** 2 (Tasks 1 and 2 implemented atomically)
- **Files modified:** 1 (src/app/api/decision-history/route.ts) + 10 synced from main repo

## Accomplishments

- Added `readTransferSlimSnapshot(gw)` — mirrors `readSnapshot()` verbatim; reads `merged_players_slim_gw{N}.json` from Vercel Blob with pathname exact-match guard (T-113-11) and try/catch null collapse (T-113-09)
- Added `fetchTransfers(teamId)` — copied from season-analytics/route.ts; fetches season-aggregate transfers array; filter by `event === gw` inside pipeline (Pitfall 2)
- Added `reconstructPreTransferSquad(postTransferPicks, gwTransfers)` — pure function swapping `element_in→element_out` to recover pre-transfer 15-man squad (D-03, Pitfall 1)
- Wired full transfer regret pipeline into GET handler: parallel fan-out (Step 2), suggestTransfers post-hoc (Step 4b), element-summary fan-out (Step 4c), TransferRegretEntry assembly (Step 4d)
- Response payload now includes `transferEntries: TransferRegretEntry[]` alongside existing `entries: RegretEntry[]` (captain path untouched)
- All four ASVS L1 security guards present: teamId regex guard (T-113-08), blob pathname exact-match (T-113-11), SSRF guard `!/^\d+$/.test(String(id))` (T-113-10), JSON parse try/catch (T-113-09)
- Defensive try/catch wrapper around entire transfer pipeline block — T-113-13 ensures captain response never breaks if transfer side fails

## Transfer Response Shape (for Plan 04 UI contract)

Each `TransferRegretEntry` in `transferEntries`:

```typescript
{
  gw: number
  hasSnapshot: boolean           // false = no slim snapshot for this GW
  // Engine recommendation
  engineSell: string[] | null    // web_names of players engine recommended selling
  engineBuy: string[] | null     // web_names of players engine recommended buying
  engineSellPts: number[] | null // actual points scored by engine's sell picks
  engineBuyPts: number[] | null  // actual points scored by engine's buy picks
  // User actual transfer
  isHold: boolean                // true = no transfer made this GW
  userSell: string[] | null      // null when isHold
  userBuy: string[] | null
  userSellPts: number[] | null
  userBuyPts: number[] | null
  // Signed delta (D-06/D-07)
  delta: number | null           // positive = engine better; negative = user better; null = no data
}
```

**Null semantics (critical for Plan 04):**
- `hasSnapshot: false` → all arrays null, `delta: null` (pre-deployment GW)
- `isHold: true` → `userSell/userBuy/userSellPts/userBuyPts` all null; `delta` is counterfactual engine gain
- `engineSell/Buy` null when engine returned no suggestion (budget/pool exhausted)
- `delta: null` when no snapshot or element-summary fetch failed

## Task Commits

Tasks were implemented in a single atomic pass (one file modified):

1. **Wave 1 dependency sync** - `b46277a` (chore: sync types, regret.ts, test fixtures from main)
2. **Tasks 1 + 2: Transfer regret pipeline** - `732836e` (feat: add helpers + wire GET handler)

## Files Created/Modified

- `src/app/api/decision-history/route.ts` — Extended with readTransferSlimSnapshot, fetchTransfers, reconstructPreTransferSquad helpers; GET handler extended with Steps 2/4a-4d; response payload includes transferEntries; all security guards present

**Wave 1 dependency files synced (pre-existing changes from main branch):**
- `src/lib/types.ts` — SlimPlayer + TransferRegretEntry types (from Plans 01+02)
- `src/lib/regret.ts` — computeTransferDelta + computeTransferSeasonSummary (from Plan 02)
- `src/lib/regret.test.ts` — 25 tests for transfer delta math (from Plan 02)
- `src/app/api/decision-history/route.test.ts` — pre-existing test file (from main HEAD)
- `src/lib/club-form.ts` + test files — current_gw_played field (from Phase 111)

## Decisions Made

- `bank: 9999` for post-hoc `suggestTransfers` call — budget accuracy would require bank balance at decision time which is not stored in the slim snapshot; `9999` is the documented post-hoc simplification per RESEARCH.md Pitfall 4
- `fetchTransfers` called once in the parallel fan-out (not per-GW) — returns season-aggregate array, filtered by `event === gw` inside the pipeline loop per Pitfall 2
- Separate `transferActualPtsMap` from the captain `actualPtsMap` — keeps the two element-summary fan-outs independent to avoid shared-player key collisions
- `ftCount` mirrors user's actual transfer count (`gwTransfers.length >= 2 ? 2 : 1`) — makes the engine's combo enumeration consistent with what the user actually had available
- Web name lookup: slim snapshot first, then bootstrap `elementMap` fallback — handles players whose IDs appear in transfers but not in the current-GW snapshot

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced Wave 1 files from main repo into worktree**
- **Found during:** Pre-execution setup
- **Issue:** Worktree was forked before Wave 1 (Plans 01+02) changes landed in main. `types.ts` lacked `TransferRegretEntry`/`SlimPlayer`; `regret.ts` lacked `computeTransferDelta`; Phase 111 club-form test fixtures were stale. TypeScript compilation would have failed immediately.
- **Fix:** Copied `types.ts`, `regret.ts`, `regret.test.ts`, `club-form.ts`, and stale test fixtures from main repo HEAD into the worktree before beginning Plan 03 implementation.
- **Files modified:** 10 files (see list above)
- **Verification:** `npx tsc --noEmit` 0 errors (one pre-existing `route.test.ts` Buffer type error exists in main repo; not introduced by this plan)
- **Committed in:** `b46277a` (Wave 1 dependency sync commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking dependency)
**Impact on plan:** Necessary to make Plan 03 compile. Wave 1 files are semantically identical to what Plans 01+02 produced — no behavioral difference.

## Issues Encountered

- Pre-existing tsc error in `src/app/api/decision-history/route.test.ts` line 218 (`Buffer<ArrayBufferLike>` type incompatibility) — confirmed pre-exists in main repo; out-of-scope
- Pre-existing vitest failures (25 tests in captain-picks, club-form, useRivals, MobileNav) — confirmed identical failures in main repo; none caused by this plan

## Next Phase Readiness

- Plan 04 (BackTab UI + TransferRegretView) can begin immediately
- `data.transferEntries` is now on the `useDecisionHistory` hook payload (via `DecisionHistory.transferEntries?`)
- Response shape documented above is the API contract for Plan 04's tests
- No blockers

## Self-Check: PASSED

- FOUND: src/app/api/decision-history/route.ts (modified, 355 lines)
- FOUND: .planning/phases/113-transfer-regret-backtester-v1-20/113-03-SUMMARY.md
- FOUND commit: b46277a (chore — Wave 1 sync)
- FOUND commit: 732836e (feat — transfer regret pipeline)
- VERIFIED: `merged_players_slim_gw${gw}.json` template literal present
- VERIFIED: `blobs[0].pathname !== filename` exact-match guard present (3 occurrences)
- VERIFIED: `if (!/^\d+$/.test(String(id))) return null` SSRF guard present
- VERIFIED: `transferEntries = []` fallback present in try/catch
- VERIFIED: teamId guard `!/^\d+$/.test(teamIdParam)` present (1 occurrence)
- tsc --noEmit: 0 errors (pre-existing route.test.ts Buffer error exists in main repo; not introduced here)
- vitest: 25 pre-existing failures identical to main repo; 0 new failures introduced by this plan

---
*Phase: 113-transfer-regret-backtester-v1-20*
*Completed: 2026-05-15*
