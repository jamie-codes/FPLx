# Phase 46: Chip Modes - Research

**Researched:** 2026-04-30
**Domain:** FPL optimiser chip simulation — greedy squad builder, OptimiserPanel integration, Bench Boost view
**Confidence:** HIGH

## Summary

All key source files were read directly from the codebase. The `computeFHResult()` algorithm in `chip-strategy-engine.ts` is fully understood and serves as the exact reference pattern for `buildOptimalSquad()`. The `OptimiserPanel.tsx` (Phase 45 version) is fully read — its state shape, memos, and conditional rendering structure are clear. The test infrastructure (`OptimiserPanel.test.tsx`, `optimise-lineup.test.ts`) is also fully read and the extension patterns for Phase 46 tests are straightforward.

All decisions in `46-CONTEXT.md` are technically sound and consistent with the existing codebase. No architectural conflicts found. The three new files (`chip-modes.ts`, `ChipModeToggle.tsx`, `ChipSquadView.tsx`) and the two types additions (`ChipMode`, `ChipSquadResult`, `ChipSquadPlayer`) are clear from the context. The `bestXI` derivation by calling `optimiseLineup()` on the 15-player WC/FH squad is the only non-trivial integration point — it requires adapting the `MergedPlayer[]` + `SquadPick[]` call shape.

**Primary recommendation:** Implement in three waves: Wave 0 (test stubs + types), Wave 1 (chip-modes.ts engine), Wave 2 (ChipModeToggle + ChipSquadView + OptimiserPanel integration).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chip Mode Toggle**
- D-01: 4-button pill toggle `None | Wildcard | Free Hit | Bench Boost`, below horizon selector, above FT toggle row. Same `role="group"` / `aria-pressed` pattern as `FtToggle.tsx`. Default `'none'`. File: `src/components/optimiser/ChipModeToggle.tsx`.
- D-02: WC/FH active → FT toggle hidden. BB active → FT toggle visible. None → FT toggle visible.
- D-03: WC/FH active → comparison table replaced by `ChipSquadView`. Horizon selector visible; for FH it is greyed out / non-interactive (FH always scores by 1GW, tooltip).
- D-04: Chip mode state in `OptimiserPanel` local state (`useState<ChipMode>('none')`). No persistence.

**Wildcard / Free Hit Engine**
- D-05: New pure-function file `src/lib/chip-modes.ts`. No `'use client'`, no React, no side effects.
- D-06: `buildOptimalSquad({ players, budget, horizon, teamCap? })` → `ChipSquadResult | null` (null when < 15 eligible players). Greedy: sort eligible (status='a') by `HORIZON_FIELD[horizon]` desc, fill slots respecting minSlots/maxSlots per position, teamCap=3 per club, running budget guard.
- D-07: Quotas: exactly 2 GK, 3–5 DEF, 2–5 MID, 1–3 FWD, total=15. Same as `computeFHResult()`. Do NOT import from chip-strategy-engine.ts — redeclare locally.
- D-08: Free Hit always calls `buildOptimalSquad` with `horizon: 1` regardless of user selection.
- D-09: BGW exclusion: exclude players with `xPts_1gw === 0` (exact zero, same as Phase 43 D-15). Applies for all horizons.
- D-10: `ChipSquadResult`: `{ squad: ChipSquadPlayer[], bestXI: number[], formation: string, budgetUsed: number }`. `bestXI` derived by calling `optimiseLineup()` on the 15 returned players. `ChipSquadPlayer`: `{ id, web_name, element_type, team, now_cost, xPts: number }`.

**Budget for WC / FH**
- D-11: Auth: `sum(selling_price per pick) + entry_history.bank` (integer tenths). Unauth: `CHIP_DEFAULT_BUDGET_TENTHS = 1000`.
- D-12: Budget passed as integer tenths into `buildOptimalSquad`. Display as `£X.Xm` (÷10). No user-editable field.

**Bench Boost View**
- D-13: BB calls existing `optimiseLineup()` on current squad (no new engine). Headline changes to: `Bench Boost | Bench xPts: X.X | Start xPts: X.X | Total: X.X`.
- D-14: In BB mode, bench section loses `opacity-60` de-emphasis — full opacity. Changed bench rows still get green accent borders.
- D-15: One-line notice: `"All 15 players score points — bench contributions included above."` Only when BB active.

**Chip Squad View (WC / FH)**
- D-16: New component `src/components/optimiser/ChipSquadView.tsx`. Receives `ChipSquadResult`. Position-grouped sections (GK/DEF/MID/FWD + Bench). Best XI: `border-l-2 border-green-500`; bench: `opacity-60`.
- D-17: Headline: `Wildcard | Formation: 4-3-3 | Budget: £XX.Xm used` or `Free Hit (this GW only) | Formation: 4-3-3 | Budget: £XX.Xm used`.
- D-18: FH notice row: `"This squad is optimised for this GW only. Your actual squad reverts after the gameweek ends."` — `text-amber-600 dark:text-amber-500`.
- D-19: Mobile: same card pattern as existing mobile comparison cards.

### Claude's Discretion
- Exact Tailwind classes for `ChipModeToggle.tsx` — follow `FtToggle.tsx` exactly.
- 4-button row layout (mirrors FtToggle multi-button and GwToggle).
- Tie-break in `buildOptimalSquad`: lower `now_cost` wins when equal xPts.
- Loading/error: if `buildOptimalSquad` returns null (< 15 eligible), show amber warning banner (mirrors Phase 43 D-16 BGW pattern).

### Deferred Ideas (OUT OF SCOPE)
- Formation preference picker for WC/FH — deferred to v1.7.
- Player locking in WC/FH — deferred to v1.7.
- Multi-chip comparison (WC vs FH vs current) — out of scope for Phase 46.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHIP-01 | Wildcard mode: best 15 from all players (budget, formation, 3-per-club cap), best XI highlighted | `buildOptimalSquad()` engine + `optimiseLineup()` call for bestXI derivation (D-06, D-10) |
| CHIP-02 | Free Hit mode: best single-GW squad from full pool, labelled this-GW-only, reversion notice | Same `buildOptimalSquad()` with `horizon: 1` forced (D-08), FH notice (D-18) |
| CHIP-03 | Bench Boost mode: optimised bench order with expected bench xPts as dedicated view | Calls existing `optimiseLineup()` unchanged; modified headline + full-opacity bench (D-13, D-14) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Greedy squad optimisation (WC/FH) | Client-side computation | — | Pure TS function in useMemo; no server round-trip needed; entire player pool is already client-side via usePlayers() |
| Bench Boost scoring | Client-side computation | — | Reuses existing optimiseLineup() already called client-side |
| Budget derivation | Client-side (useMyTeam hook) | Fallback constant | selling_price from authenticated FPL API; integer tenths same as Phase 45 |
| Chip mode state | OptimiserPanel local state | — | Situational; no persistence needed (D-04) |
| ChipSquadView rendering | Client component | — | 'use client' component, mirrors OptimiserPanel pattern |
| ChipModeToggle | Client component | — | Stateless controlled component; state owned by OptimiserPanel |

---

## Standard Stack

### Core (all verified by direct file read)
| Library/File | Version/Source | Purpose | Why Standard |
|---|---|---|---|
| `src/lib/optimise-lineup.ts` | Phase 43 (current) | Best-XI enumeration for bestXI derivation | Already used in OptimiserPanel; call on 15-player WC/FH squad to get formation + bestXI |
| `src/lib/chip-strategy-engine.ts` | Phase 34 (current) | Reference algorithm for `buildOptimalSquad()` — read `computeFHResult()` (line 272–423) | The slot-fill loop, quota constants, budget calc, and team-cap check are the exact pattern to replicate |
| `HORIZON_FIELD` (from `optimise-lineup.ts`) | Exported | Maps `1|3|5` → field name | Import in `chip-modes.ts` for consistent horizon→field resolution |
| `useMyTeam(enabled)` + `useAuthStatus()` | Phase 45 (already in OptimiserPanel) | Budget source for WC/FH | Already wired in OptimiserPanel.tsx lines 231–232 |
| Vitest 4.1.2 + RTL | Current | Test framework | `vitest.config.ts` uses jsdom globally; `@vitest-environment node` override in engine tests |

### No new npm dependencies
The phase requires zero new npm/pip packages. All needed libraries are already installed. [VERIFIED: direct codebase read]

---

## Architecture Patterns

### System Architecture Diagram

```
OptimiserPanel (useState<ChipMode>)
  │
  ├── chipMode === 'none' | 'bench-boost'
  │     └── existing comparison table + HeadlineRow
  │           (BB: modified headline, full-opacity bench, BB notice)
  │
  ├── chipMode === 'wildcard' | 'free-hit'
  │     └── chipSquad memo → buildOptimalSquad(players, budget, horizon)
  │           │
  │           ├── eligible filter (status='a', xPts_1gw !== 0)
  │           ├── greedy slot-fill (sort by HORIZON_FIELD[horizon] desc)
  │           │     ├── position quota check (minSlots/maxSlots)
  │           │     ├── team cap check (≤ 3 per team)
  │           │     └── budget guard (runningCost + now_cost ≤ budget)
  │           ├── → 15-player squad (or null if < 15 eligible)
  │           └── optimiseLineup(syntheticPicks, squad15, horizon)
  │                 └── → bestXI + formation string
  │
  ├── ChipModeToggle (None|Wildcard|Free Hit|Bench Boost)
  │     └── controls chipMode state
  │
  └── ChipSquadView (WC/FH only)
        ├── Headline row (chip label | formation | budget used)
        ├── FH notice (amber, italic)
        └── Position-grouped rows (GK/DEF/MID/FWD + Bench)
              ├── bestXI rows: border-l-2 border-green-500
              └── bench rows: opacity-60
```

### Recommended Project Structure (new files only)
```
src/
├── lib/
│   └── chip-modes.ts            # Pure engine: buildOptimalSquad + computeBenchBoostXPts
│                                #   No 'use client', no React
├── components/optimiser/
│   ├── ChipModeToggle.tsx       # 4-button pill toggle (None|WC|FH|BB)
│   └── ChipSquadView.tsx        # WC/FH squad display (position-grouped)
```

Modified files:
```
src/lib/types.ts                 # Add ChipMode, ChipSquadPlayer, ChipSquadResult
src/components/optimiser/
  OptimiserPanel.tsx             # Add chipMode state, ChipModeToggle, chipSquad memo, conditional render
```

Test files (Wave 0):
```
src/lib/chip-modes.test.ts       # @vitest-environment node; engine unit tests
src/components/optimiser/
  OptimiserPanel.test.tsx        # Extend with Phase 46 describe block
```

### Pattern 1: buildOptimalSquad — Greedy Slot-Fill

The exact algorithm used in `computeFHResult()` (chip-strategy-engine.ts lines 319–399), adapted for `chip-modes.ts`:

```typescript
// Source: chip-strategy-engine.ts lines 332–372 (verified by direct read)
const minSlots: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 1 }
const maxSlots: Record<number, number> = { 1: 2, 2: 5, 3: 5, 4: 3 }
const filledSlots: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
const teamCount = new Map<number, number>()
let runningCost = 0
const squad: ChipSquadPlayer[] = []

// Sort eligible by horizon score desc (+ tie-break: lower now_cost wins per Claude's Discretion)
eligible.sort((a, b) => {
  const scoreDiff = horizonScore(b) - horizonScore(a)
  if (scoreDiff !== 0) return scoreDiff
  return a.now_cost - b.now_cost  // cheaper player preferred on tie
})

for (const player of eligible) {
  if (squad.length >= 15) break
  const pos = player.element_type
  if ((filledSlots[pos] ?? 0) >= maxSlots[pos]) continue
  if ((teamCount.get(player.team) ?? 0) >= 3) continue      // FH_TEAM_CAP
  if (runningCost + player.now_cost > budget) continue
  squad.push({ id: player.id, web_name: player.web_name, element_type: pos, team: player.team, now_cost: player.now_cost, xPts: horizonScore(player) })
  filledSlots[pos]++
  teamCount.set(player.team, (teamCount.get(player.team) ?? 0) + 1)
  runningCost += player.now_cost
}

if (squad.length < 15) return null  // D-06: null when < 15 eligible
```

### Pattern 2: bestXI Derivation from WC/FH Squad (D-10)

`optimiseLineup()` requires `SquadPick[]` (with `position` field) and `MergedPlayer[]`. For the 15-player chip squad, synthetic picks must be created:

```typescript
// Source: optimise-lineup.ts signature (verified by direct read)
// optimiseLineup(picks: SquadPick[], players: MergedPlayer[], horizon: OptimiserHorizon)
//
// For WC/FH: create synthetic picks from the 15-player squad
// position 1-15 is arbitrary (engine only uses .element); multiplier=1, is_captain/vc=false
const syntheticPicks: SquadPick[] = squad.map((p, i) => ({
  element: p.id,
  position: i + 1,
  multiplier: 1,
  is_captain: false,
  is_vice_captain: false,
}))
// Then call: optimiseLineup(syntheticPicks, fullPlayers, horizon)
// Returns OptimisedLineup | null — extract .starters as bestXI, .formation
```

**Key gotcha:** `optimiseLineup()` uses `picks` for iteration but looks up each pick's player data from `players: MergedPlayer[]`. So pass the full `MergedPlayer[]` pool (the same `players` parameter already in `buildOptimalSquad`), not just the 15 chip squad players — the engine uses `playerMap.get(pick.element)` which needs the full pool to resolve each pick.

Actually, after re-reading `optimise-lineup.ts` lines 41–51: the engine builds `playerMap` from `players` (the second arg) and then looks up each pick via `playerMap.get(pick.element)`. So passing only the 15 chip squad players as the `players` arg will work correctly (and is more efficient), as long as all 15 `squad` player IDs are resolvable. Since `buildOptimalSquad` receives `MergedPlayer[]` directly, you can pass the full pool — the engine will only use the 15 picks.

### Pattern 3: Budget Calculation (mirrors Phase 45 / computeFHResult)

```typescript
// Source: chip-strategy-engine.ts lines 302–307 (verified by direct read)
// Authenticated path:
const budget = bankBalance + currentSquadIds.reduce(
  (sum, id) => sum + (sellPrices?.get(id) ?? playerById.get(id)?.now_cost ?? 0),
  0
)
// Unauthenticated:
const CHIP_DEFAULT_BUDGET_TENTHS = 1000  // £100m; redeclared locally in chip-modes.ts (D-07)
```

In `OptimiserPanel`, the budget calculation mirrors the Phase 45 `exactSellPrices` pattern already on lines 255–258:
```typescript
// Source: OptimiserPanel.tsx lines 255–258 (verified by direct read)
const exactSellPrices = useMemo(() => {
  if (!myTeamData) return new Map<number, number>()
  return new Map<number, number>(myTeamData.picks.map(p => [p.element, p.selling_price]))
}, [myTeamData])
```
For WC/FH budget: `squadData.entry_history.bank + sum(exactSellPrices.get(pick.element) ?? playerMap.get(pick.element)?.now_cost ?? 0)`.

### Pattern 4: ChipModeToggle — direct copy of FtToggle pattern

```typescript
// Source: FtToggle.tsx (verified by direct read) — adapt for 4 options
// Same: role="group", aria-pressed, min-h-[44px], px-3, text-xs font-semibold
// Same active: bg-zinc-900 dark:bg-white text-white dark:text-zinc-900
// Same inactive: bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:*
const OPTIONS: { value: ChipMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'wildcard', label: 'Wildcard' },
  { value: 'free-hit', label: 'Free Hit' },
  { value: 'bench-boost', label: 'Bench Boost' },
]
```

### Pattern 5: OptimiserPanel Integration — conditional rendering structure

The Phase 45 `OptimiserPanel.tsx` renders:
1. Horizon selector (`GwToggle`) — line 407
2. `HeadlineRow` — line 412
3. Desktop comparison table — line 415
4. Mobile cards — line 420
5. Transfer suggestions section — lines 424–518

Phase 46 inserts `ChipModeToggle` AFTER the horizon selector (line 407) and BEFORE `HeadlineRow`. Then wraps the comparison table + mobile cards in a conditional:

```typescript
// Structure after Phase 46 changes:
// 1. GwToggle (always visible; disabled appearance when FH active)
// 2. ChipModeToggle (new — always visible once squad loaded)
// 3. FtToggle section — hidden when chipMode === 'wildcard' | 'free-hit'
// 4a. chipMode === 'none' | 'bench-boost': existing comparison table (modified for BB)
// 4b. chipMode === 'wildcard' | 'free-hit': ChipSquadView
```

### Anti-Patterns to Avoid

- **Importing from chip-strategy-engine.ts in chip-modes.ts:** D-07 explicitly forbids this. Redeclare `minSlots`/`maxSlots`/`CHIP_DEFAULT_BUDGET_TENTHS` locally.
- **Using `now_cost` instead of `selling_price` for budget:** Phase 45 D-09 established that authenticated users must use `selling_price` from `useMyTeam`. Phase 46 follows the same rule.
- **Treating `xPts_1gw === undefined` as BGW:** Only `=== 0` triggers BGW exclusion (Phase 43 D-15 Pitfall 1). Undefined means no pipeline data — still eligible.
- **Forgetting to add `chipMode` to useMemo dependency arrays:** Both the existing `lineup` memo and the new `chipSquad` memo must declare `chipMode` as a dependency where relevant.
- **Calling optimiseLineup on < 11 players:** If `buildOptimalSquad` returns a squad of fewer than 15 (returns null), do not call `optimiseLineup`. The null guard handles this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Best-XI from 15-player chip squad | Custom XI selector | `optimiseLineup(syntheticPicks, players, horizon)` | Already handles formation enumeration, captain/VC, bench ordering — C(15,11)=1,365 subsets in <1ms |
| Budget calculation | Re-derive from scratch | Reuse `exactSellPrices` Map already computed in OptimiserPanel lines 255–258 | Exact selling_price already fetched from useMyTeam; same pattern as Phase 45 |
| Horizon field name lookup | `if horizon === 1 ... else` | `HORIZON_FIELD[horizon]` exported from `optimise-lineup.ts` | Already exported; consistent across all engine files |

---

## Common Pitfalls

### Pitfall 1: optimiseLineup requires MergedPlayer[], not ChipSquadPlayer[]
**What goes wrong:** `ChipSquadPlayer` is a slimmer type. `optimiseLineup` needs `MergedPlayer[]` (for `xPts_1gw`, `xPts_3gw`, `xPts_5gw`, `element_type`, `xPts_90th_1gw` for captain selection, etc.).
**Why it happens:** `buildOptimalSquad` receives and works with `MergedPlayer[]`. The chip squad output is `ChipSquadPlayer[]` (slimmer). When calling `optimiseLineup` for bestXI, pass the original `MergedPlayer[]` pool (or a sub-map of the 15 players' full data).
**How to avoid:** In `chip-modes.ts`, after building the 15-player squad, call `optimiseLineup(syntheticPicks, players.filter(p => squadIds.has(p.id)), horizon)` — this passes the full `MergedPlayer` data for just the 15 squad members.

### Pitfall 2: FH horizon lock — OptimiserPanel must pass `horizon: 1` to buildOptimalSquad when FH active
**What goes wrong:** If `chipSquad` memo uses the user-selected `horizon` state directly, FH will score players by 3GW or 5GW xPts when the user has that horizon selected.
**Why it happens:** D-08 requires FH always uses `horizon: 1`, but the `horizon` state controls the GwToggle.
**How to avoid:** In the `chipSquad` memo: `const effectiveHorizon = chipMode === 'free-hit' ? 1 : horizon`. Pass `effectiveHorizon` to `buildOptimalSquad`.

### Pitfall 3: FT toggle visibility — show/hide via conditional render, not CSS
**What goes wrong:** Using a CSS class to hide the FT toggle when WC/FH active may cause the FT state to reset unexpectedly or fail ARIA tests.
**Why it happens:** React state persists even when elements are hidden; but test selectors may still find hidden elements.
**How to avoid:** Use `{(chipMode === 'none' || chipMode === 'bench-boost') && <FtToggle ... />}` — do not render the FT toggle when WC/FH is active (D-02).

### Pitfall 4: minSlots constraint not enforced after maxSlots fill
**What goes wrong:** Greedy slot-fill may successfully reach 15 players without satisfying minimum position quotas (e.g., only 1 FWD if FWDs are expensive).
**Why it happens:** The greedy algorithm only enforces `maxSlots` (skip if over max). It does not backtrack to ensure `minSlots` are met.
**How to avoid:** After the greedy loop, check `filledSlots[pos] >= minSlots[pos]` for all positions. If any position is under-filled, return null (cannot form a valid squad). The `computeFHResult()` reference (line 375) notes this but does not throw — it returns what it has. For Phase 46, returning null is cleaner (< 15 valid squad case).

Actually, re-reading `computeFHResult()` lines 374–375: the comment says "Check if minimum formation met; if not, we still return what we got (defensive: never throw)." For `buildOptimalSquad`, D-06 says return null when < 15 eligible players. The minSlots check can be combined: if after the loop `squad.length < 15`, return null.

### Pitfall 5: BB headline requires bench xPts sum — source field depends on horizon
**What goes wrong:** Summing bench xPts at a fixed 1GW field when user has 3GW or 5GW horizon selected.
**Why it happens:** D-13 says "Bench xPts: X.X" — this should use the active `horizon` field for consistency with the comparison table.
**How to avoid:** Use `HORIZON_FIELD[horizon]` to look up bench xPts in the BB headline, same as the comparison table uses `horizonField`. The existing `playerMap` already has this data.

### Pitfall 6: Bench rows in BB mode — targeted opacity removal
**What goes wrong:** The comparison table bench rows currently use `opacity-80` for changed bench rows (line 131: `row.isBench ? ' opacity-80' : ''`). In BB mode, ALL bench rows should be full opacity (not just changed ones).
**Why it happens:** D-14 says bench loses `opacity-60` de-emphasis. But in the current comparison table, bench rows have a different class pattern than the mobile stack (which uses `opacity-60` for unchanged rows, line 192).
**How to avoid:** Pass a `isBenchBoost: boolean` prop to `ComparisonTable` and `MobileComparisonCards`, and suppress the opacity class when true.

---

## Code Examples

### ChipModeToggle skeleton (from FtToggle.tsx pattern)
```typescript
// Source: FtToggle.tsx (verified by direct read) — direct adaptation
'use client'
import type { ChipMode } from '@/lib/types'

interface ChipModeToggleProps {
  value: ChipMode
  onChange: (value: ChipMode) => void
}

export function ChipModeToggle({ value, onChange }: ChipModeToggleProps) {
  const OPTIONS: { value: ChipMode; label: string; testId: string }[] = [
    { value: 'none', label: 'None', testId: 'chip-toggle-none' },
    { value: 'wildcard', label: 'Wildcard', testId: 'chip-toggle-wildcard' },
    { value: 'free-hit', label: 'Free Hit', testId: 'chip-toggle-freehit' },
    { value: 'bench-boost', label: 'Bench Boost', testId: 'chip-toggle-benchboost' },
  ]
  return (
    <div className="flex items-center gap-2" data-testid="chip-mode-toggle">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Chip:</span>
      <div
        role="group"
        aria-label="Chip mode"
        className="inline-flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"
      >
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={
              `min-h-[44px] px-3 text-xs font-semibold transition-colors ` +
              (value === opt.value
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700')
            }
            data-testid={opt.testId}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Types to add to src/lib/types.ts
```typescript
// Source: 46-CONTEXT.md D-10 (verified design decision)
export type ChipMode = 'none' | 'wildcard' | 'free-hit' | 'bench-boost'

export interface ChipSquadPlayer {
  id: number
  web_name: string
  element_type: PositionCode
  team: number
  now_cost: number      // tenths of £1m
  xPts: number          // scored by the active horizon at build time
}

export interface ChipSquadResult {
  squad: ChipSquadPlayer[]  // all 15 players
  bestXI: number[]          // 11 element IDs (from optimiseLineup call)
  formation: string         // e.g. '4-3-3'
  budgetUsed: number        // tenths of £1m (sum of now_cost of 15 players)
}
```

### BB headline bench xPts computation
```typescript
// In OptimiserPanel, when chipMode === 'bench-boost' and lineup is non-null:
// Source: informed by optimise-lineup.ts bench structure (verified by direct read)
const benchXPts = lineup.bench.reduce(
  (sum, id) => sum + ((playerMap.get(id)?.[horizonField] as number | undefined) ?? 0),
  0
)
const starterXPts = lineup.starters.reduce(
  (sum, id) => sum + ((playerMap.get(id)?.[horizonField] as number | undefined) ?? 0),
  0
)
// Render: `Bench Boost | Bench xPts: ${benchXPts.toFixed(1)} | Start xPts: ${starterXPts.toFixed(1)} | Total: ${(benchXPts + starterXPts).toFixed(1)}`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No chip simulation in optimiser | Wildcard/FH greedy squad + BB bench view integrated into OptimiserPanel | Phase 46 | User can evaluate chip value without leaving the optimiser |
| FH greedy squad in chip-strategy-engine.ts (scores GWs for Planner) | New `buildOptimalSquad` in chip-modes.ts (scores by horizon for Optimiser) | Phase 46 | Decoupled: Planner chip strategy ≠ Optimiser chip simulation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `optimiseLineup` with synthetic picks (position=1..15) produces correct results for WC/FH bestXI | Code Examples (Pattern 2) | If engine uses `position` field for something, synthetic picks may give wrong results — but reading the engine shows `position` is not used (only `element` is) |

**A1 verification:** Reading `optimise-lineup.ts` lines 41–154 confirms `SquadPick.position` is never accessed inside `optimiseLineup()`. The engine iterates `picks` only for `pick.element` lookups into `playerMap`. Synthetic picks with arbitrary `position` values are safe. [VERIFIED: direct file read]

**If this table is effectively empty:** A1 is self-verified above. No unresolved assumptions remain.

---

## Open Questions (RESOLVED)

1. **GwToggle disabled appearance for FH mode (D-03)**
   - What we know: D-03 says horizon selector is "greyed out / non-interactive" when FH active. GwToggle does not currently support a `disabled` prop.
   - What's unclear: Should `GwToggle` grow a `disabled` prop, or should `ChipModeToggle` render a visual overlay, or should OptimizerPanel simply not call `setHorizon` from a wrapper?
   - Recommendation: Add a `disabled?: boolean` prop to `GwToggle` that adds `pointer-events-none opacity-50` to the wrapper div. This is a 3-line change, keeps GwToggle self-contained, and avoids wrapper complexity. Planner should specify this as a Wave 2 sub-task.

2. **ChipSquadView "Bench" section — which players are bench?**
   - What we know: `bestXI` contains 11 player IDs. The remaining 4 in `squad` are bench.
   - What's unclear: Position within the bench (GK bench first per OPT-04 convention).
   - Recommendation: In `ChipSquadView`, sort bench players with GK first, then by `xPts` desc — mirrors `optimiseLineup` bench ordering already applied when computing `bestXI` via `optimiseLineup`. The `bestXI` derivation can also expose the `OptimisedLineup.bench` array which already has GK-first ordering.

---

## Environment Availability

Step 2.6: All dependencies are client-side TypeScript / React with no external service calls. No new tools or services required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next.js | ✓ | v25.8.1 | — |
| Vitest | Tests | ✓ | 4.1.2 | — |
| React Testing Library | UI tests | ✓ | (installed, used by Phase 44/45 tests) | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + React Testing Library |
| Config file | `vitest.config.ts` (jsdom global; `@vitest-environment node` override per file) |
| Quick run command | `npx vitest run src/lib/chip-modes.test.ts src/components/optimiser/OptimiserPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHIP-01 | `buildOptimalSquad` respects budget/formation/team-cap, returns 15-player squad | unit | `npx vitest run src/lib/chip-modes.test.ts` | ❌ Wave 0 |
| CHIP-01 | `bestXI` derivation via `optimiseLineup` call — 11 IDs in returned result | unit | `npx vitest run src/lib/chip-modes.test.ts` | ❌ Wave 0 |
| CHIP-01 | `ChipModeToggle` activates WC mode; FT toggle hidden; `ChipSquadView` renders | RTL | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ❌ Wave 0 (extend existing file) |
| CHIP-02 | FH always uses `horizon: 1` regardless of user horizon selection | unit | `npx vitest run src/lib/chip-modes.test.ts` | ❌ Wave 0 |
| CHIP-02 | FH notice (amber) and reversion copy renders in `ChipSquadView` | RTL | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ❌ Wave 0 |
| CHIP-03 | BB mode: comparison table renders with full-opacity bench and BB headline | RTL | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/chip-modes.test.ts src/components/optimiser/OptimiserPanel.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/chip-modes.test.ts` — unit tests for `buildOptimalSquad` (budget/formation/team-cap/BGW exclusion/null-when-< 15) + FH horizon lock
- [ ] `src/components/optimiser/OptimiserPanel.test.tsx` — add Phase 46 describe block with ChipModeToggle interactions, FT toggle hide/show, ChipSquadView rendering, BB headline + bench opacity

---

## Security Domain

Phase 46 is pure client-side computation with no new API routes, no new server actions, no new data ingestion, and no authentication changes. No new ASVS attack surface introduced.

| ASVS Category | Applies | Note |
|---------------|---------|------|
| V2 Authentication | No | No auth changes |
| V3 Session Management | No | Chip mode is local state, no persistence |
| V4 Access Control | No | No new endpoints |
| V5 Input Validation | No | All inputs are typed enums / typed numbers from existing validated data |
| V6 Cryptography | No | No crypto |

---

## Sources

### Primary (HIGH confidence — all verified by direct codebase read)
- `src/lib/chip-strategy-engine.ts` — `computeFHResult()` greedy algorithm, slot quotas, budget constants, team cap pattern
- `src/lib/optimise-lineup.ts` — `optimiseLineup()` signature, BGW exclusion logic, HORIZON_FIELD export, synthetic picks compatibility
- `src/lib/suggest-transfers.ts` — pure engine pattern reference (SuggestTransfersParams shape, sellPrices Map pattern)
- `src/lib/types.ts` — existing types; confirmed no ChipMode/ChipSquadResult types yet exist
- `src/components/optimiser/OptimiserPanel.tsx` — Phase 45 full implementation; state shape, memo dependencies, conditional rendering structure
- `src/components/optimiser/FtToggle.tsx` — direct visual template for ChipModeToggle
- `src/components/optimiser/OptimiserPanel.test.tsx` — existing test structure, mock pattern, fixture factories
- `src/lib/squad-adapter.ts` — SquadPick schema (confirmed `position` not used in optimiseLineup), MyTeamPickSchema.selling_price
- `.planning/phases/46-chip-modes/46-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — CHIP-01/02/03 requirement text verified
- `vitest.config.ts` — jsdom environment, exclude patterns confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly, no external dependencies
- Architecture: HIGH — computeFHResult reference algorithm fully read and understood
- Pitfalls: HIGH — all pitfalls derived from direct code inspection
- Test structure: HIGH — existing test file read in full; extension pattern clear

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable codebase; no fast-moving external deps)
