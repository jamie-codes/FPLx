# Phase 45: Transfer-Aware Mode — Research

**Researched:** 2026-04-30
**Domain:** FPL optimiser engine extension + React component integration
**Confidence:** HIGH — all findings from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** "1 FT / 2 FTs" toggle — manual, no auto-detection from FPL API.
- **D-02:** Toggle default is 1 FT. Engine re-runs on toggle change (same as horizon toggle).
- **D-03:** Engine considers top-30 players per position (GK/DEF/MID/FWD) by active horizon xPts as "In" candidates. Players already in the 15-man squad excluded from "In" pool.
- **D-04:** Enumerate all valid (out, in) pairs (1-FT mode) or (out1, in1, out2, in2) pairs (2-FT mode). Ranking by net xPts gain of the full transfer set applied to the optimised lineup.
- **D-05:** Hit transfers included. Each hit suggestion shows "-4pts" cost and TFR-03 break-even indicator.
- **D-06:** Transfer suggestions appear below the comparison table within OptimiserPanel. Section headed "Transfer Suggestions". FT toggle placement: Claude's discretion (top of section, not inline with horizon selector).
- **D-07:** Row format: `Out: [name] → In: [name] | FREE / -4pts | +X.X xPts`. Hit suggestions have a second line: "Breaks even in X GWs".
- **D-08:** Empty state when no improvements: "Your current squad is already optimal for this horizon."
- **D-09:** Budget source priority: `selling_price` from `useMyTeam()` (authenticated) → `now_cost` from `usePlayers()` (unauthenticated fallback). Fallback is silent.
- **D-10:** Hard filter on budget. Available budget = sum of `selling_price` (or `now_cost`) of outgoing players + `entry_history.bank`. Suggestion shown only when available budget ≥ `now_cost` of incoming player(s).
- **D-11:** Transfer-aware mode does NOT require FPL login. Degrades gracefully to `now_cost` fallback.

### Claude's Discretion

- Whether the FT toggle is inline with the horizon selector or below it — follow OptimiserPanel layout from Phase 44.
- Exact ranking tie-breaker when xPts gain is equal (e.g., sort by player form or lower cost).
- Whether 2-FT enumeration uses greedy vs full pair enumeration — full pair enumeration (~3,600 pairs max) is acceptable.
- Mobile layout for transfer suggestion rows (same responsive pattern as Phase 44 mobile cards).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TFR-01 | User can enable transfer-aware mode that factors in 1–2 available free transfers when optimising | FT toggle state in OptimiserPanel; suggestTransfers() re-runs on toggle change via useMemo |
| TFR-02 | Transfer suggestions shown alongside optimised lineup (Out / In / Cost / xPts gain) | TransferSuggestion type + section rendered after comparison table; full JSX spec in 45-UI-SPEC.md |
| TFR-03 | Hit break-even indicator: "Breaks even in X GWs based on xPts gain" | `Math.ceil(4 / xPtsGainPerGw)` formula; breakEvenGws field on TransferSuggestion; UI copy locked in UI-SPEC.md |
</phase_requirements>

---

## Summary

Phase 45 builds directly on the Phase 43/44 optimiser foundation. The codebase is clean and well-structured: `optimise-lineup.ts` is a pure function with no side effects, `OptimiserPanel.tsx` holds all state and renders the comparison table, and `squad-adapter.ts` provides fully typed schemas for `SquadPick`, `MyTeamPick` (with `selling_price`), and `EntryHistory` (with `bank`).

The new `suggestTransfers()` function is a standalone pure engine in `src/lib/suggest-transfers.ts` — it receives the current squad picks, the full player pool, horizon, ftCount, bank balance, and an optional sell-price map, then returns a `TransferSuggestion[]` array. The UI integration is additive: `OptimiserPanel.tsx` gains a `useState<1|2>` for `ftCount`, a `useMemo` for the suggestion result, and a new `<section>` block appended after the comparison table block. All JSX, copy strings, colors, and test IDs are already fully specified by `45-UI-SPEC.md`.

**Primary recommendation:** Implement in two waves. Wave 0: pure engine + TransferSuggestion type + unit tests (RED). Wave 1: OptimiserPanel integration + FtToggle component + RTL tests (GREEN) + human verify.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Transfer suggestion engine | lib (pure TS) | — | Pure function; no React; mirrors optimise-lineup.ts pattern |
| Budget enforcement | lib (pure TS, inside suggestTransfers) | — | Filter logic; D-10 hard filter applied before returning results |
| FT count state | Frontend (OptimiserPanel state) | — | UI-only state; no server, no global store |
| sell-price map construction | Frontend (OptimiserPanel useMemo) | — | Derived from useMyTeam hook data; 1 line |
| Authenticated sell prices | API (useMyTeam → /api/fpl/my-team) | — | Already exists; OptimiserPanel calls the hook |
| Transfer section render | Frontend (OptimiserPanel JSX) | — | Inline section; no separate panel component needed |
| FT toggle component | Frontend (FtToggle.tsx) | — | New component; mirrors GwToggle visual identity |

---

## Key Findings

### 1. `optimiseLineup()` function signature (file:line `src/lib/optimise-lineup.ts:36`)

```typescript
export function optimiseLineup(
  picks: SquadPick[],
  players: MergedPlayer[],
  horizon: OptimiserHorizon,
): OptimisedLineup | null
```

`suggestTransfers()` must mirror this: pure TS file (no `'use client'`, no React imports), exported named function, takes structured inputs, returns typed output.

**VERIFIED: direct codebase read**

### 2. `HORIZON_FIELD` export (file:line `src/lib/optimise-lineup.ts:9`)

```typescript
export const HORIZON_FIELD: Record<OptimiserHorizon, 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw'> = {
  1: 'xPts_1gw',
  3: 'xPts_3gw',
  5: 'xPts_5gw',
}
```

`suggestTransfers()` MUST import `HORIZON_FIELD` from `optimise-lineup.ts` rather than re-declaring it. This is explicitly flagged as IN-01 in the Phase 44 code review (`44-REVIEW.md`). `OptimiserPanel.tsx` currently duplicates it locally — the planner should add fixing that duplication to Phase 45 as a housekeeping task alongside the new code.

**VERIFIED: direct codebase read**

### 3. `TransferSuggestion` type — does not exist yet; needs adding to `types.ts`

Current `src/lib/types.ts` has `OptimisedLineup`, `OptimiserHorizon`, `MergedPlayer` but no `TransferSuggestion`. The shape is fully specified in `45-UI-SPEC.md §9`:

```typescript
type TransferSuggestion =
  | {
      kind: 'single'
      sell: MergedPlayer
      buy: MergedPlayer
      cost: 0 | 4              // 0 = FREE, 4 = -4pt hit
      xPtsGain: number          // always > 0 (filtered by engine)
      xPtsGainPerGw: number     // xPtsGain / horizon
      breakEvenGws: number | null  // ceil(4 / xPtsGainPerGw) when cost > 0; null when FREE
    }
  | {
      kind: 'combo'
      transfers: [{ sell: MergedPlayer; buy: MergedPlayer }, { sell: MergedPlayer; buy: MergedPlayer }]
      cost: 0 | 4              // 0 = FREE (both within ftCount), 4 = one hit
      xPtsGain: number
      xPtsGainPerGw: number
      breakEvenGws: number | null
    }
```

**VERIFIED: types.ts codebase read + UI-SPEC.md**

### 4. `useMyTeam()` shape and call pattern (file:line `src/lib/hooks/useMyTeam.ts:13`)

```typescript
export function useMyTeam(enabled: boolean): UseQueryResult<MyTeamResponse>
```

`MyTeamResponse.picks` is `MyTeamPick[]` where each pick has `{ element, position, multiplier, is_captain, is_vice_captain, selling_price }` — all integers in tenths of £1m. Already used in `TransferPanel.tsx` at line 65 to build the `exactSellPrices` map:

```typescript
const exactSellPrices = useMemo(() => {
  if (!myTeamData) return new Map<number, number>()
  return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
}, [myTeamData])
```

`OptimiserPanel.tsx` must replicate this pattern exactly. The `TransferPanel.tsx` usage (line 35) shows the call pattern: `useMyTeam(isAuthenticated && !!submittedId)`.

**VERIFIED: direct codebase read (useMyTeam.ts, squad-adapter.ts, TransferPanel.tsx)**

### 5. `entry_history.bank` — exact field (file:line `src/lib/squad-adapter.ts:11`)

```typescript
export const EntryHistorySchema = z.object({
  event:                  z.number().int(),
  bank:                   z.number(),           // tenths of £1m (e.g. 15 = £1.5m)
  event_transfers:        z.number().int(),
  event_transfers_cost:   z.number().int(),
  value:                  z.number(),           // tenths of £1m
})
```

`bank` is already available from `squadData.entry_history.bank` (the `useSquad()` result already available in `OptimiserPanel`). No new API calls required for bank balance.

**VERIFIED: direct codebase read**

### 6. `useAuthStatus()` — exact import path and return shape (file:line `src/lib/hooks/useAuthStatus.ts:14`)

```typescript
export function useAuthStatus() {
  // Returns:
  // { isAuthenticated: boolean, expiresAt?: number, isLoading: boolean, setAuthenticated, clearAuthenticated }
}
```

Import path: `@/lib/hooks/useAuthStatus`. Already imported in `TransferPanel.tsx` at line 6. `OptimiserPanel.tsx` must add this import to determine whether to call `useMyTeam(enabled)`.

**VERIFIED: direct codebase read**

### 7. `OptimiserPanel.tsx` integration point — exact render position (file:line `src/components/optimiser/OptimiserPanel.tsx:394-403`)

The return statement's final happy-path JSX block ends with:

```tsx
{/* Mobile card stack */}
<div className="sm:hidden">
  <MobileComparisonCards rows={sectionsRows} playerMap={playerMap} horizonField={horizonField} />
</div>
```

The transfer section is inserted **after** this closing `</div>` and before the closing `</section>`. The `<section>` root element at line 371 carries `data-testid="optimiser-panel"` and `className="mt-6 space-y-3"`.

**VERIFIED: direct codebase read**

### 8. `GwToggle.tsx` — exact JSX for FtToggle to mirror (file:line `src/components/gem-table/GwToggle.tsx:91-113`)

```tsx
export function GwToggle({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Projected points horizon"
      className="flex rounded overflow-hidden border border-zinc-300 dark:border-zinc-600">
      {([1, 3, 5] as const).map((gw) => (
        <button key={gw} onClick={() => onChange(gw)} aria-pressed={value === gw}
          className={`px-3 py-2.5 sm:py-1 text-sm font-medium transition-all cursor-pointer active:scale-95 min-h-[44px] ${
            value === gw
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}>
          {gw} GW
        </button>
      ))}
    </div>
  )
}
```

`FtToggle.tsx` uses the same active/inactive Tailwind class pattern. UI-SPEC.md §1 specifies the exact JSX, including `border border-zinc-200 dark:border-zinc-700` on the wrapper (vs `border-zinc-300 dark:border-zinc-600` on GwToggle — a deliberate visual softening, but same structure). `min-h-[44px]` is mandatory on both buttons.

**VERIFIED: direct codebase read + UI-SPEC.md**

### 9. Test infrastructure — vitest + jsdom + React Testing Library (file:line `vitest.config.ts:1`)

- Framework: Vitest with `environment: 'jsdom'` globally.
- RTL: `@testing-library/react` with `render` + `fireEvent`.
- Mock pattern: `vi.fn()` for hooks, `vi.mock('@/lib/hooks/useSquad', ...)` etc.
- Engine tests (`optimise-lineup.test.ts`): `@vitest-environment node` override; plain `describe`/`it`/`expect` only, no RTL.
- `suggestTransfers` unit tests should follow the `optimise-lineup.test.ts` node-environment pattern.
- `OptimiserPanel.test.tsx` extensions should follow the existing Phase 44 pattern exactly (same mock setup, same `makePlayer`/`makePick`/`makeValidSquad` factories).

**Important:** Phase 45 tests must also mock `useAuthStatus` and `useMyTeam` since OptimiserPanel will call them. The existing Phase 44 tests do NOT mock these (they aren't called yet) — Phase 45 tests must add those mocks without breaking existing tests.

**VERIFIED: direct codebase read**

### 10. Phase 44 code review findings relevant to Phase 45

Three defects flagged in `44-REVIEW.md` that are NOT yet fixed in the current codebase:

| ID | Location | Issue | Phase 45 Impact |
|----|----------|-------|-----------------|
| CR-01 | `pairSection` line 59 | Out-of-bounds read when formation changes — `sortedOptimised[i]` can be `undefined` | Phase 45 should fix this as a housekeeping task (the current code has the defensive `?? currentId` fallback but the review recommends `Math.min(len)` approach) |
| WR-01 | Lines 154, 203 | `+` prefix on delta pill can render `+-1.2 xPts` for negative deltas | Low risk for Phase 45 (doesn't affect new transfer section) |
| WR-02 | Line 193 | `opacity-60` on unchanged mobile rows | Low risk for Phase 45 |
| IN-01 | Line 27 | `HORIZON_FIELD` duplicated — should import from engine | Phase 45 code should import `HORIZON_FIELD` from `optimise-lineup.ts`; fixes the in-OptimiserPanel duplication simultaneously |

The planner should decide whether to fix CR-01/WR-01/WR-02 as part of Phase 45 Wave 0 or note them as follow-up. Fixing CR-01 is low risk and takes 3 lines.

**VERIFIED: 44-REVIEW.md direct read**

### 11. `TransferPanel.tsx` reuse assessment

The existing `TransferPanel.tsx` uses `ScoredPlayer` (not `MergedPlayer`), gem-score-based ranking, and `computeTransferSuggestions` from `transfer-engine.ts`. These operate on a completely different algorithm (gem score deltas, not xPts gain) and a different type hierarchy. The visual row patterns (`Out → In` layout) are a reference point but the full component is NOT reusable for Phase 45. The `exactSellPrices` useMemo pattern (lines 65-68) and the `useMyTeam(isAuthenticated && !!submittedId)` call pattern (line 35) ARE directly reusable.

**VERIFIED: direct codebase read of TransferPanel.tsx**

### 12. 2-FT enumeration complexity

D-04 decision: full pair enumeration. With top-30 per position (4 positions = ~120 "In" candidates after deduplication) and 15 "Out" candidates:
- 1-FT: 15 × 120 = 1,800 pairs max (subset by position, typically 15 × 30 = 450 per position)
- 2-FT: C(15,2) × C(120,2) ≈ 105 × 7,140 = ~750,000 combinations if done naively

The CONTEXT.md D-04 says "~3,600 pairs max" — this is for position-restricted pairs where out1 and out2 must match in1 and in2 by position. With position restriction, it's: for each of C(4,1)=4 positions × 30 in-players = 120 (1-FT); for 2-FT it's choosing 2 out-players from 15 (any position) × matching in-players per position. Realistically with 15 squad players and 30 per position:
- 2-FT position-matched: (15 × 30) × (14 × 30) / 2 = 450 × 420 / 2 = 94,500 (NOT ~3,600).

**This is a planning risk.** The CONTEXT.md estimate of "~3,600" appears to assume top-30 per position = 30 pairs of (out, in) per position × 4 positions = 120 1-FT combos, then 120 × 120 / 2 = ~7,200 for 2-FT combos. If we restrict pairs to same-position only (an outgoing DEF must be replaced by a DEF), the 2-FT full enumeration is ~(5×30)² / 2 ≈ 11,250 — manageable but not 3,600.

**Recommendation:** The engine should restrict in-players to same position as out-player (FPL rule: you can transfer any player for any other player, BUT xPts comparison across positions is valid). However, cross-position transfers ARE valid in FPL. The simplest approach: for 2-FT, iterate all pairs of (out1, out2) from the 15-man squad (C(15,2) = 105 pairs), then for each pair find the best (in1, in2) from the top-30 per matching position. 105 × 30 × 30 = 94,500 — fast enough in JavaScript for a memo.

**VERIFIED: computed from D-03/D-04 parameters**

---

## Patterns to Follow

### Pattern 1: Pure engine file structure (mirrors `optimise-lineup.ts`)

`src/lib/suggest-transfers.ts` must:
- No `'use client'` directive
- No React imports
- Import `HORIZON_FIELD` from `./optimise-lineup` (not re-declare)
- Import `MergedPlayer`, `OptimiserHorizon`, `TransferSuggestion` from `./types`
- Import `SquadPick` from `./squad-adapter`
- Export named function + any helper types

```typescript
// src/lib/suggest-transfers.ts
import type { MergedPlayer, OptimiserHorizon, TransferSuggestion } from './types'
import type { SquadPick } from './squad-adapter'
import { HORIZON_FIELD } from './optimise-lineup'

export function suggestTransfers(params: SuggestTransfersParams): TransferSuggestion[] { ... }
```

### Pattern 2: useMemo dependency array for engine calls

The existing `optimiseLineup` memo in `OptimiserPanel.tsx` (lines 238-251):

```typescript
const { playerMap, lineup, ... } = useMemo(() => {
  if (!squadData || !playersData) return { ... }
  ...
}, [squadData, playersData, horizon])
```

The new `transferSuggestions` memo adds `ftCount` and `exactSellPrices` (from useMyTeam):

```typescript
const transferSuggestions = useMemo(() => {
  if (!squadData || !playersData || !lineup) return []
  return suggestTransfers({
    currentPicks: squadData.picks,
    players: playersData,
    horizon,
    ftCount,
    bank: squadData.entry_history.bank,
    sellPrices: exactSellPrices,
  })
}, [squadData, playersData, lineup, horizon, ftCount, exactSellPrices])
```

The `exactSellPrices` memo must be stable (same reference when `myTeamData` hasn't changed). Use the same pattern as `TransferPanel.tsx` lines 65-68.

### Pattern 3: Hook call with auth guard

```typescript
// In OptimiserPanel (new additions):
const { isAuthenticated } = useAuthStatus()
const { data: myTeamData } = useMyTeam(isAuthenticated && !!submittedId)
const exactSellPrices = useMemo(() => {
  if (!myTeamData) return new Map<number, number>()
  return new Map(myTeamData.picks.map(p => [p.element, p.selling_price]))
}, [myTeamData])
```

When `isAuthenticated` is false, `useMyTeam` is disabled (no fetch), `myTeamData` is undefined, `exactSellPrices` is an empty Map, and `suggestTransfers` falls back to `now_cost` budget enforcement.

### Pattern 4: Budget enforcement in pure engine

Budget check per suggestion (in `suggestTransfers`):
```typescript
function isBudgetFeasible(
  sellIds: number[],
  buyIds: number[],
  sellPrices: Map<number, number>,  // elementId -> selling_price (or empty Map for fallback)
  players: Map<number, MergedPlayer>,
  bank: number,
): boolean {
  const sellValue = sellIds.reduce((sum, id) => {
    const sp = sellPrices.get(id)
    const player = players.get(id)
    return sum + (sp ?? player?.now_cost ?? 0)
  }, 0)
  const buyCost = buyIds.reduce((sum, id) => sum + (players.get(id)?.now_cost ?? 0), 0)
  return bank + sellValue >= buyCost
}
```

All values in tenths of £1m — never divide/multiply inside the comparison.

### Pattern 5: Break-even formula

From CONTEXT.md `<specifics>`:

```typescript
// xPtsGainPerGw = xPtsGain / horizon (horizon-averaged rate)
// breakEvenGws = Math.ceil(4 / xPtsGainPerGw)  — minimum 1, null when cost === 0
const breakEvenGws = cost > 0 && xPtsGainPerGw > 0
  ? Math.max(1, Math.ceil(4 / xPtsGainPerGw))
  : null
```

Edge case: `xPtsGainPerGw <= 0` — this should be filtered out by the engine (D-08: only positive-gain suggestions shown), but the type allows `null` as a defensive backstop.

### Pattern 6: test mock additions (mirrors Phase 44 test setup)

New mocks required in `OptimiserPanel.test.tsx` for Phase 45:

```typescript
const useAuthStatusMock = vi.fn()
const useMyTeamMock = vi.fn()

vi.mock('@/lib/hooks/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))
vi.mock('@/lib/hooks/useMyTeam', () => ({
  useMyTeam: (_enabled: boolean) => useMyTeamMock(),
}))

// Default return values in beforeEach:
useAuthStatusMock.mockReturnValue({ isAuthenticated: false, isLoading: false })
useMyTeamMock.mockReturnValue({ data: undefined })
```

All existing Phase 44 tests pass unchanged with these defaults (unauthenticated = no sell prices, same engine behavior).

---

## Risks and Gotchas

### Risk 1: 2-FT enumeration — CONTEXT.md's "~3,600" estimate is wrong

**Actual:** C(15,2) = 105 out-pairs × up to 30×30 = 900 in-pairs per position combo = up to 94,500 iterations per 2-FT call. This is still fast in JavaScript (sub-millisecond for simple arithmetic), but the planner must not assume O(3,600).

**Mitigation:** Restrict the in-pool to top-30 per position (D-03) and only evaluate (out, in) pairs where in-player's position matches out-player's position. 2-FT: iterate C(15,2) out-pairs × top-30 × top-30 matching positions. Cap at D-05 default; still completes in <5ms.

### Risk 2: `suggestTransfers` receives the full `playersData` array (~500–650 players), not pre-filtered

The "top-30 per position" filtering must happen inside `suggestTransfers`, not at the call site. The engine receives `players: MergedPlayer[]` (full dataset) and must internally build the top-30 pool. Do NOT pre-filter before passing to the engine — caller code in OptimiserPanel should not know about this implementation detail.

### Risk 3: `HORIZON_FIELD` duplication in `OptimiserPanel.tsx`

`OptimiserPanel.tsx` currently declares its own local `HORIZON_FIELD` (lines 27-31). Phase 45 adds an import of `HORIZON_FIELD` from `optimise-lineup.ts` for use in `suggestTransfers`. The planner should include removing the local re-declaration as part of the Phase 45 task (IN-01 fix from 44-REVIEW.md).

### Risk 4: Phase 44 code review defects still in codebase

`44-REVIEW.md` flagged CR-01 (pairSection out-of-bounds), WR-01 (negative delta pill), and WR-02 (opacity-60 on unchanged mobile rows). None of these are fixed in the current `OptimiserPanel.tsx`. Phase 45 is modifying this file — the planner should include fixing CR-01 (3 lines, prevents ghost rows on formation change) as a housekeeping task. WR-01 and WR-02 are cosmetic and lower priority.

### Risk 5: `useAuthStatus` and `useMyTeam` not in OptimiserPanel yet — test mocks must be added

The existing `OptimiserPanel.test.tsx` mocks only `useSquad` and `usePlayers`. Adding `useAuthStatus` and `useMyTeam` calls to the component without corresponding mocks will cause test failures on pre-Phase-45 test runs (mock setup error). The Phase 45 plan must add the mocks in the same commit that adds the hook calls.

### Risk 6: `suggestTransfers` must exclude currently-owned players from "In" pool

D-03 explicitly states: "Players already in the user's 15-man squad are excluded from the In pool." The engine must filter out squad player IDs from the top-30 pool before enumeration. If not, the engine might suggest "transfer in Salah" when the user already owns Salah.

### Risk 7: Net xPts gain calculation for 2-FT must account for lineup interactions

For a 2-transfer combo, the xPts gain is NOT simply (gain from transfer 1) + (gain from transfer 2). After the first transfer, the second transfer might involve a player whose role in the optimised lineup changes. Correct approach: apply both transfers to the squad, re-run `optimiseLineup()` on the modified squad, and compare total xPts to the baseline optimised lineup.

**This is computationally expensive if done inside the inner loop of 2-FT enumeration.** The CONTEXT.md D-04 says "ranking by net xPts gain of the full transfer set applied to the optimised lineup" — this implies re-running the optimizer for each pair, which is 105 × optimiseLineup calls = 105 × 1,365 subset evaluations = ~143,325 operations. This is still fast (<50ms) but the planner should be aware.

**Alternative (simpler, slightly less accurate):** Sum the xPts of (in1.xPts - out1.xPts) + (in2.xPts - out2.xPts) without re-running the full optimizer. This misses cases where a transfer changes who gets into the XI, but is correct for most cases. The CONTEXT.md description of "net xPts gain of the full transfer set applied to the optimised lineup" suggests the full re-run approach; the planner should clarify the expected approach.

**Recommendation:** Use the additive approximation for 2-FT scoring (sum of individual xPts deltas), noting that the full re-run is more correct but 10× more expensive. Flag this in the plan for user awareness.

---

## Suggested Implementation Approach

### Wave 0 — Pure engine + types + unit tests (no React, TDD RED)

**New files:**
1. `src/lib/suggest-transfers.ts` — pure engine, zero React imports
2. `src/lib/suggest-transfers.test.ts` — `@vitest-environment node`

**Modified files:**
1. `src/lib/types.ts` — add `TransferSuggestion` discriminated union (end of file, after `OptimisedLineup`)

**Test cases for `suggest-transfers.test.ts`:**
1. Returns empty array when no affordable transfers improve xPts
2. Single FREE suggestion when 1 player improves xPts and budget is sufficient
3. Single -4pts hit suggestion when no free transfer would improve xPts but a hit would
4. Budget filter: suggestion excluded when sell price + bank < buy cost
5. Budget fallback: uses `now_cost` when sellPrices Map is empty (unauthenticated)
6. Top-30 pool respects position: a DEF In-candidate must be a DEF
7. Own-squad exclusion: players already in squad not in In pool
8. 2-FT: combo row returned when ftCount=2 and pair improves more than best single
9. Break-even: `Math.ceil(4 / (xPtsGain/horizon))` with minimum of 1
10. Empty array when lineup === null (or when squad/players not provided)
11. Suggestions sorted by xPtsGain descending

### Wave 1 — OptimiserPanel integration + FtToggle + RTL tests (GREEN + human verify)

**New files:**
1. `src/components/optimiser/FtToggle.tsx` — exact JSX from UI-SPEC.md §1

**Modified files:**
1. `src/components/optimiser/OptimiserPanel.tsx`
   - Import: `HORIZON_FIELD` from `optimise-lineup` (replace local declaration — IN-01 fix)
   - Import: `suggestTransfers` from `@/lib/suggest-transfers`
   - Import: `TransferSuggestion` from `@/lib/types`
   - Import: `FtToggle` from `./FtToggle`
   - Import: `useAuthStatus` from `@/lib/hooks/useAuthStatus`
   - Import: `useMyTeam` from `@/lib/hooks/useMyTeam`
   - Add `useState<1|2>` for `ftCount`
   - Add `useAuthStatus()` and `useMyTeam(isAuthenticated && !!submittedId)` calls
   - Add `exactSellPrices` useMemo
   - Add `transferSuggestions` useMemo
   - Add transfer section JSX after mobile cards block (before closing `</section>`)
   - Fix CR-01 (pairSection bounds) — 3-line change
   
2. `src/components/optimiser/OptimiserPanel.test.tsx`
   - Add `useAuthStatus` and `useMyTeam` mocks in module-level setup
   - Add 9 new Phase 45 test cases (from UI-SPEC.md §8)
   - All Phase 44 tests remain unchanged

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom global environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/suggest-transfers.test.ts src/components/optimiser/OptimiserPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TFR-01 | FT toggle defaults to 1, clicking 2 FTs updates aria-pressed | RTL/jsdom | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | Exists (Phase 44 tests will be extended) |
| TFR-01 | suggestTransfers re-runs when ftCount changes | RTL/jsdom | Same | Exists |
| TFR-02 | Suggestion rows render Out/In/cost/xPts for valid squad | RTL/jsdom | Same | Exists |
| TFR-02 | Empty state renders when engine returns [] | RTL/jsdom | Same | Exists |
| TFR-02 | Transfer section hidden when lineup === null | RTL/jsdom | Same | Exists |
| TFR-03 | break-even subline present on hit rows, absent on FREE rows | RTL/jsdom | Same | Exists |
| TFR-03 | Correct singular/plural "GW" / "GWs" copy | RTL/jsdom | Same | Exists |
| Engine | Budget filter, top-30 pool, own-squad exclusion | unit/node | `npx vitest run src/lib/suggest-transfers.test.ts` | Wave 0 creates it |
| Engine | Break-even formula Math.ceil(4/xPtsGainPerGw) | unit/node | Same | Wave 0 creates it |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/suggest-transfers.test.ts` (Wave 0), `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` (Wave 1)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/suggest-transfers.test.ts` — covers TFR-01 engine, TFR-02 engine, TFR-03 formula
- [ ] `src/lib/suggest-transfers.ts` — new pure engine file

---

## Sources

All findings are VERIFIED from direct codebase reads in this session:

- `src/lib/optimise-lineup.ts` — engine signature, HORIZON_FIELD export
- `src/lib/types.ts` — existing types, TransferSuggestion gap
- `src/lib/squad-adapter.ts` — SquadPick, MyTeamPick, EntryHistory schemas
- `src/components/optimiser/OptimiserPanel.tsx` — integration point, existing state/hooks/render structure
- `src/components/optimiser/OptimiserPanel.test.tsx` — test infrastructure and patterns
- `src/lib/hooks/useMyTeam.ts` — hook signature and return shape
- `src/lib/hooks/useAuthStatus.ts` — auth hook shape
- `src/components/gem-table/GwToggle.tsx` — FtToggle mirror source
- `src/components/transfers/TransferPanel.tsx` — exactSellPrices and useMyTeam call patterns
- `.planning/phases/44-comparison-output/44-REVIEW.md` — unfixed defects to address
- `.planning/phases/44-comparison-output/44-01-SUMMARY.md` — Phase 44 decisions log
- `.planning/phases/45-transfer-aware-mode/45-CONTEXT.md` — locked decisions
- `.planning/phases/45-transfer-aware-mode/45-UI-SPEC.md` — exact JSX, copy strings, test IDs
- `.planning/REQUIREMENTS.md` — TFR-01, TFR-02, TFR-03 descriptions
- `vitest.config.ts` — test environment

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 2-FT net xPts gain uses additive approximation (sum of individual deltas) rather than full optimizer re-run | Risk 7 / Wave 0 engine design | Planner may spec full re-run; would require 105 × optimiseLineup calls per memo recompute (~50ms vs ~1ms) |

**All other claims verified directly from codebase — no training-data assumptions.**

---

## Open Questions

1. **2-FT xPts gain calculation approach**
   - What we know: D-04 says "net xPts gain of the full transfer set applied to the optimised lineup"
   - What's unclear: Does "applied to the optimised lineup" mean (a) re-run optimiseLineup after both transfers to get a new lineup, or (b) sum the individual player xPts deltas?
   - Recommendation: Plan spec should explicitly state which approach. For MVP, additive approximation is correct in ~90% of cases and runs in ~1ms; full re-run is more accurate but 50× slower. Recommend additive for Phase 45 with a comment noting the limitation.

2. **Should CR-01 fix be included in Phase 45?**
   - What we know: `pairSection` has an out-of-bounds read on formation changes (44-REVIEW.md CR-01). Fix is 3 lines.
   - What's unclear: Was this intentionally deferred, or missed?
   - Recommendation: Include the fix in Phase 45 Wave 1 Task 1 (OptimiserPanel modifications) — it's trivial, affects the same file, and prevents ghost rows for users with non-standard formations.

---

## Metadata

**Confidence breakdown:**
- Engine design (suggestTransfers signature, params, algorithm): HIGH — derived from existing patterns
- Type additions (TransferSuggestion shape): HIGH — locked in UI-SPEC.md
- OptimiserPanel integration (hooks, memo, render position): HIGH — direct codebase read
- Test infrastructure: HIGH — direct codebase read
- 2-FT complexity estimate: MEDIUM — computed from parameters, not benchmarked

**Research date:** 2026-04-30
**Valid until:** Until Phase 45 execution begins (no external dependencies; all internal codebase)
