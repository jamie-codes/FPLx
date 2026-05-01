# Phase 44: Comparison Output - Research

**Researched:** 2026-04-30
**Domain:** React component replacement — pitch layout to comparison table; pure Tailwind v4, no new deps
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The comparison table replaces Phase 43's pitch layout. `OptimiserPanel` no longer renders the green pitch div, player circles, or bench row. The comparison table is the sole output once `optimiseLineup()` returns a result.
- **D-02:** The horizon selector (1GW | 3GW | 5GW pill toggle) is retained — it sits above the headline row, unchanged from Phase 43.
- **D-03:** Table is position-grouped: sections headed GK / DEF / MID / FWD for the starting XI, followed by a Bench section for the 4 bench slots. All 15 player slots shown.
- **D-04:** Each row has four columns: `Current player name | Current xPts | → | Optimised player name | Optimised xPts | delta pill`. Unchanged rows leave the delta cell empty.
- **D-05:** "Current lineup" is derived from `SquadPick.position <= 11` (starting XI) and `position >= 12` (bench). This is the user's FPL-submitted lineup from the `useSquad` hook — no additional computation required.
- **D-06:** Bench row delta shows a Promoted or Dropped badge (not a numeric xPts delta) for changed bench slots. Starting-XI row deltas show numeric `+X.X xPts` pill.
- **D-07:** Headline lives between the horizon selector and the table: `Formation: 4-3-3 │ Changes: N players │ +X.X xPts gain`. Formation is the string from `OptimisedLineup.formation`. Total xPts gain is the sum of per-changed-starter delta (bench excluded from total).
- **D-08:** Changed rows get a green 2px left accent border (`border-l-2 border-green-500`) and a green delta pill (`+X.X xPts` in `text-green-400` with `bg-green-950 rounded px-1`). Unchanged rows are plain.
- **D-09:** On mobile (`< sm`), the two-column layout stacks: current player block above, optimised player block below, within each row card. Changed row cards get the same green left border. Bench section and unchanged rows are visually de-emphasised (`opacity-60` on unchanged mobile cards — Claude's discretion).

### Claude's Discretion
- Exact Tailwind classes for the table layout (`grid` vs `table` vs `flex` columns) — follow existing TanStack Table/Tailwind v4 patterns; do NOT add TanStack Table for this view, plain HTML/Tailwind is sufficient.
- Mobile: whether to show a compact "Changes: N" badge above the stacked list (CMP-03 mentions "Changes badge" — interpret as a count badge in the headline area, not a per-row badge, since per-row highlighting already fulfils the requirement).
- Typography sizing follows 43-UI-SPEC.md spacing scale (xs/sm tokens).
- Bench GK slot is listed as a single row in the Bench section (no visual separator needed — the Bench section header provides context).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Transfer-aware mode (Phase 45) and chip modes (Phase 46) are out of scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMP-01 | User sees current lineup vs optimised lineup side-by-side, with xPts delta shown per slot | Verified: `SquadPick.position` field gives current lineup; `OptimisedLineup.starters` and `.bench` give optimised; delta = `optimisedXPts - currentXPts` per position slot. Full HTML table pattern provided in 44-UI-SPEC.md. |
| CMP-02 | A diff headline summarises the delta: "Changes: N players | +X.X xPts gain" | Verified: `OptimisedLineup.formation` string is available directly; change count = count of positions where `currentPlayerId !== optimisedPlayerId` in XI slots only; xPts gain = sum of positive deltas for changed starters. Headline copy and component pattern specified in 44-UI-SPEC.md. |
| CMP-03 | On mobile (< 640px), current and optimised lineups stack vertically with a Changes badge; only changed rows are highlighted | Verified: Tailwind `sm:hidden` / `hidden sm:table` toggling strategy specified. Mobile card HTML patterns provided in 44-UI-SPEC.md §6. |

</phase_requirements>

---

## Summary

Phase 44 is a surgical replacement of the pitch rendering block in `OptimiserPanel.tsx`. Everything above and around the pitch (horizon selector, empty/loading/error/BGW states, `useSquad`/`usePlayers` hooks, `optimiseLineup()` call, `playerMap` memo) is preserved. The phase removes `PlayerCircle`, the `bg-green-950` pitch div, the FWD/MID/DEF/GK row layout, and the bench row, replacing them with three new elements: a `HeadlineRow` sub-component, a `ComparisonTable` sub-component containing position-grouped `<tbody>` sections, and a mobile stacked-card view toggled by Tailwind breakpoint utilities.

The data contract is already complete from Phase 43: `OptimisedLineup` has `starters[]`, `bench[]`, and `formation`; `SquadPick.position` (1–11 = XI, 12–15 = bench) identifies the current lineup without new computation. Row pairing within each position group uses xPts-descending sort on both current and optimised sides, applied independently per section.

The test file (`OptimiserPanel.test.tsx`) must have all pitch-specific assertions removed and replaced with comparison-table assertions. The 13 Phase 43 tests currently pass and cover empty/loading/error/BGW branches; those branches are unchanged and their tests remain valid. Only the "OPT-01 pitch", "OPT-03 captain/VC", and "OPT-04 bench row" test groups must be replaced with CMP-01/CMP-02/CMP-03 assertions. Horizon toggle tests (OPT-02) need a partial rewrite since the assertion mechanism changes from player-circle presence to comparison-table row content.

**Primary recommendation:** Implement `ComparisonTable`, `HeadlineRow`, and `ComparisonRow` as sub-components local to `OptimiserPanel.tsx` (no new files needed). Use a plain `<table>` with 5 columns and `<tbody>` sections (no `<thead>` sections — section headers are `<tr colSpan={5}>` rows). Render desktop table and mobile card stack with `hidden sm:block` / `sm:hidden` toggles.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Current lineup derivation | Browser / Client | — | SquadPick positions already in React Query cache; filtering `position <= 11` is a client-side transform, no API call needed |
| Row pairing algorithm (current vs optimised) | Browser / Client | — | Pure computation over in-memory arrays; belongs with component or a co-located helper |
| xPts delta calculation | Browser / Client | — | `optimisedXPts - currentXPts` per slot; arithmetic on cached player data |
| Change count / xPts gain aggregation | Browser / Client | — | Derived from paired rows; computed in `useMemo` alongside existing `playerMap`/`lineup` memo |
| Comparison table rendering | Browser / Client | — | Pure presentational JSX, no server state |
| Headline row rendering | Browser / Client | — | Derived data from same memo; single flex row |
| Mobile vs desktop layout toggle | Browser / Client | — | Tailwind responsive utilities at render time |

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (Next.js peer) | Component tree, JSX, hooks | Project-wide [VERIFIED: package.json] |
| Tailwind CSS v4 | (in project) | Utility-first styling; `border-l-2`, `sm:hidden`, etc. | Project-wide convention [VERIFIED: 43-UI-SPEC.md, 44-UI-SPEC.md] |
| Vitest + @testing-library/react | v4.1.2 | Component tests | Project-wide test stack [VERIFIED: vitest.config.ts, test run] |

### No New Dependencies

The 44-UI-SPEC.md and 44-CONTEXT.md explicitly prohibit new npm dependencies. The full implementation uses only HTML `<table>` elements, Tailwind v4 utilities, and React.

**Installation:** None required. All dependencies already present.

---

## Architecture Patterns

### System Architecture Diagram

```
useSquad(teamId) ──→ squadData.picks[]
                              │
                              ▼
                  filter position <= 11 ──→ currentXI (sorted by element_type + xPts desc per group)
                  filter position >= 12 ──→ currentBench (sorted by position asc)
                              │
optimiseLineup()  ──────────→ OptimisedLineup { starters[], bench[], formation }
                              │
                              ▼
                  pairRows() ──→ ComparisonRow[] (currentPlayer, optimisedPlayer, delta, isChanged, isBench)
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
              HeadlineRow        ComparisonTable
           (formation, N,         (desktop <table>
            xPtsGain)              + mobile cards)
```

### Recommended Project Structure

No new files or directories. All additions are sub-components within the existing file:

```
src/components/optimiser/
├── OptimiserPanel.tsx    # Modified — pitch rendering removed; HeadlineRow + ComparisonTable added
└── OptimiserPanel.test.tsx  # Modified — pitch assertions replaced with table assertions
```

### Pattern 1: Row Pairing Algorithm

**What:** Pair current lineup slots with optimised lineup slots within each position section using independent xPts-descending sort.

**When to use:** Inside the `useMemo` that already computes `lineup` and `playerMap`. Produces a `ComparisonRow[]` array consumed by the table renderer.

**Algorithm (from 44-UI-SPEC.md §4):**
- GK section: exactly 1 current GK starter vs 1 optimised GK starter (position 1 player in `picks`)
- DEF section: current DEF starters sorted by xPts desc; optimised DEF starters sorted by xPts desc; pair index-for-index
- MID / FWD sections: same sort-and-pair
- Bench section: current bench[0] (position=12, GK) vs `lineup.bench[0]`; current bench[1–3] (positions 13–15, sorted ascending) vs `lineup.bench[1–3]`

A row `isChanged` when `currentPlayerId !== optimisedPlayerId`.

```typescript
// Source: 44-UI-SPEC.md §4 (pairing algorithm)
function pairSection(
  currentIds: number[],
  optimisedIds: number[],
  playerMap: Map<number, MergedPlayer>,
  horizonField: 'xPts_1gw' | 'xPts_3gw' | 'xPts_5gw',
  isBench: boolean,
): ComparisonRowData[] {
  const score = (id: number) => (playerMap.get(id)?.[horizonField] as number | undefined) ?? 0
  const sortedCurrent = [...currentIds].sort((a, b) => score(b) - score(a))
  const sortedOptimised = [...optimisedIds].sort((a, b) => score(b) - score(a))
  return sortedCurrent.map((currentId, i) => {
    const optimisedId = sortedOptimised[i]
    const isChanged = currentId !== optimisedId
    const delta = isChanged && !isBench
      ? score(optimisedId) - score(currentId)
      : 0
    return { currentId, optimisedId, isChanged, isBench, delta }
  })
}
```

### Pattern 2: Desktop / Mobile Display Toggle

**What:** Render both a `<table>` (desktop) and a card stack (mobile) from the same data, toggled by Tailwind breakpoint utilities.

**When to use:** Always — wrap the `<table>` in `<div className="hidden sm:block">` and the mobile card list in `<div className="sm:hidden">`.

```typescript
// Source: 44-UI-SPEC.md §6
<div className="hidden sm:block">
  <table className="w-full text-sm border-collapse">
    {/* ... desktop table */}
  </table>
</div>
<div className="sm:hidden">
  {/* ... mobile card stack */}
</div>
```

### Pattern 3: Tailwind v4 Left Border on Changed Rows

**What:** Apply a 2px green left accent border to changed rows.

**Critical detail (verified from 44-UI-SPEC.md):** In Tailwind v4 both `border-l-2` (width) AND `border-l-green-500` (color) must be present together on the same element. Using only `border-l-2` renders the default border color (invisible in most themes).

```typescript
// Source: 44-UI-SPEC.md §3
<tr className="border-b border-zinc-100 dark:border-zinc-800 border-l-2 border-l-green-500">
```

### Pattern 4: HeadlineRow Copy

**What:** Singular/plural handling for change count; xPts gain always shows 1 decimal.

```typescript
// Source: 44-UI-SPEC.md §1
<div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 py-2">
  <span><span className="font-semibold">Formation:</span> {formation}</span>
  <span className="text-zinc-400">│</span>
  <span><span className="font-semibold">Changes:</span> {changeCount} {changeCount === 1 ? 'player' : 'players'}</span>
  <span className="text-zinc-400">│</span>
  <span className="font-semibold text-green-600 dark:text-green-400">+{xPtsGain.toFixed(1)} xPts gain</span>
</div>
```

### Pattern 5: isPromoted / isDropped Logic for Bench Badges

**What:** Determines which badge to show for a changed bench slot.

**From 44-UI-SPEC.md §3:**
- `isPromoted = true` when the optimised player for that bench slot exists in `lineup.starters` (i.e. the engine moves that player INTO the XI)
- `isPromoted = false` (Dropped) when `isChanged = true` but the optimised player is NOT in `lineup.starters` (a current starter has been demoted)

```typescript
// Source: 44-UI-SPEC.md §3
const isPromoted = lineup.starters.includes(optimisedPlayerId)
```

### Anti-Patterns to Avoid

- **Adding TanStack Table:** D-03 and 44-UI-SPEC.md explicitly prohibit TanStack Table for this view. Plain HTML `<table>` is the requirement.
- **Using `border-l-2` without `border-l-green-500`:** The border will be invisible — both classes are required simultaneously.
- **Counting bench changes in the `changeCount` and `xPtsGain` totals:** D-07 specifies bench excluded from both the change count headline and xPts gain total.
- **Forgetting `border-collapse` on the table:** Without it, cell borders double up. The UI-SPEC uses `border-collapse` on `<table>`.
- **Using `opacity-60` on desktop unchanged rows:** The opacity-60 de-emphasis is mobile-only (D-09). Desktop unchanged rows are plain (no opacity class).
- **Pairing rows by FPL position number instead of by element_type + xPts sort:** The engine output does NOT preserve the user's FPL submission order. Rows must be paired by position-group sections with independent xPts-desc sort within each group.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive table layout | Custom JS breakpoint listener | Tailwind `sm:hidden` / `hidden sm:block` | Already in project; CSS-only, no JS overhead |
| Sorting within position groups | A generic sort utility | Direct `.sort()` on the in-memory array slice | Single-use; 3–5 elements max per group, no library needed |
| Test mock fixtures | New `makeSquad` factories | Extend/reuse `makeValidSquad()` and `makePlayer()` from existing test file | Already battle-tested for 13 passing tests |

---

## Code Examples

### Complete OptimiserPanel render structure after Phase 44 (from 44-UI-SPEC.md §7)

```typescript
// Source: 44-UI-SPEC.md §7
return (
  <section className="mt-6 space-y-3" data-testid="optimiser-panel">
    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Optimised Lineup</h2>
    {/* BGW soft warning (unchanged from Phase 43) */}
    {eligibleCount < totalPlayersInSquad && eligibleCount >= 11 && (
      <div className="rounded border border-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" data-testid="bgw-banner-soft">...</div>
    )}
    {/* 1. Horizon selector row (GwToggle — right-aligned) */}
    <div className="flex items-center justify-end">
      <GwToggle value={horizon} onChange={setHorizon} />
    </div>
    {/* 2. Headline row */}
    <HeadlineRow formation={lineup.formation} changeCount={changeCount} xPtsGain={xPtsGain} />
    {/* 3. Comparison table (desktop + mobile) */}
    <ComparisonTable rows={comparisonRows} />
  </section>
)
```

### Section header row pattern

```typescript
// Source: 44-UI-SPEC.md §3
<tr>
  <td colSpan={5}
    className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400 pt-3 pb-1 pl-2 bg-zinc-50 dark:bg-zinc-800/40">
    {section}
  </td>
</tr>
```

### Delta pill for changed starter rows

```typescript
// Source: 44-UI-SPEC.md §3
<span className="text-xs font-semibold text-green-400 bg-green-950 rounded px-1 py-0.5">
  +{delta.toFixed(1)} xPts
</span>
```

### Promoted / Dropped badges for bench rows

```typescript
// Source: 44-UI-SPEC.md §3
{isPromoted
  ? <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950 rounded px-1 py-0.5">Promoted</span>
  : <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1 py-0.5">Dropped</span>
}
```

---

## Common Pitfalls

### Pitfall 1: Bench pairing uses FPL position order, not xPts sort

**What goes wrong:** Developer sorts bench slots by xPts like the XI sections, causing wrong current-vs-optimised pairings for bench rows.

**Why it happens:** The XI sections use xPts-desc sort to make "best DEF vs best DEF" comparisons meaningful. But the bench section should pair by slot index: `currentBench[0]` (position=12, GK) vs `lineup.bench[0]`, `currentBench[1]` (position=13) vs `lineup.bench[1]`, etc.

**How to avoid:** Sort `currentBench` by `SquadPick.position` ascending (12→15) before pairing. `lineup.bench` is already in engine order (bench[0]=GK, bench[1–3]=outfield by xPts desc).

**Warning signs:** Tests show "GK" in a non-GK bench slot, or bench change count doesn't match expected.

### Pitfall 2: Formation label removed from the horizon/formation flex row

**What goes wrong:** Phase 43 had `Formation: 4-3-3` in the same flex row as `GwToggle`. Phase 44 moves formation into the headline row. If the old flex row is left intact, formation appears twice.

**How to avoid:** The Phase 43 `<div className="flex items-center justify-between mb-3">` containing both the formation label and `<GwToggle>` must be replaced — the new layout has `<GwToggle>` in a right-aligned row of its own, and the headline row sits below it separately.

**Warning signs:** Two `Formation: X-X-X` strings visible in the rendered output.

### Pitfall 3: Including bench players in changeCount or xPtsGain totals

**What goes wrong:** Counting a bench slot change as part of "N players" in the headline, or adding bench xPts delta to the `+X.X xPts gain` total.

**Why it happens:** The row pairing loop covers all 15 slots; it's easy to let the aggregation run over the full set.

**How to avoid:** Filter `isChanged && !isBench` for both `changeCount` and `xPtsGain` aggregation (D-07 explicit requirement).

**Warning signs:** Headline shows more changes than actual starter swaps; xPts gain inflated when bench also changes.

### Pitfall 4: xPts values read from wrong horizon field

**What goes wrong:** Delta pill shows wrong numeric value; unchanged rows incorrectly flagged as changed.

**Why it happens:** `horizonField` is `'xPts_1gw'`, `'xPts_3gw'`, or `'xPts_5gw'` depending on the toggle — the delta must use the same field that the engine used. `horizonField` is already computed as `HORIZON_FIELD[horizon]` in the existing `OptimiserPanel` memo.

**How to avoid:** Pass `horizonField` down to `ComparisonTable` / `pairRows` and use `player[horizonField]` (with `?? 0` fallback) consistently for both current and optimised xPts reads.

### Pitfall 5: Captain/VC badges removed with `PlayerCircle`

**What goes wrong:** Captain and VC are no longer visually indicated after Phase 44 because the `(C)`/`(VC)` labels were inside `PlayerCircle`.

**Why it matters:** OPT-03 is a Phase 43 requirement still in scope — the comparison table design does not call for C/VC in the table rows per the UI-SPEC. CONTEXT.md D-01 says "the comparison table is the sole output" but does not restore captain display. The phase requirements (CMP-01, CMP-02, CMP-03) do not mention captain/VC in the table.

**Research finding:** 44-UI-SPEC.md and 44-CONTEXT.md do not specify captain/VC display in the comparison table. The existing `captainId` and `vcId` fields on `OptimisedLineup` remain available if needed. This is flagged as an open question — captain display is likely deferred or intentionally omitted in Phase 44.

**How to handle:** Do not add C/VC indicators to the table unless the plan explicitly calls for it. The test contract in 44-UI-SPEC.md §8 does not include captain badge assertions.

### Pitfall 6: Old pitch-specific test assertions left in place

**What goes wrong:** Tests fail because `[data-testid="pitch"]`, `[data-testid="player-circle-*"]`, `[data-testid="bench-row"]`, etc. no longer exist in the DOM.

**How to avoid:** The test rewrite plan in 44-UI-SPEC.md §8 is precise — remove all 5 categories of old assertions, add the 7 new assertion categories (comparison-table, headline-row, section-headers, comparison-row-changed, delta-pill, badge-promoted, badge-dropped).

---

## State of the Art

| Old Approach (Phase 43) | New Approach (Phase 44) | When Changed | Impact |
|-------------------------|-------------------------|--------------|--------|
| Pitch-layout output (green `bg-green-950` div, player circles, bench row) | Position-grouped comparison table (plain HTML, Tailwind v4) | Phase 44 | All pitch rendering code deleted; `PlayerCircle` sub-component deleted |
| Formation label in horizon flex row | Formation in headline row alongside Changes + xPts gain | Phase 44 | `flex items-center justify-between` formation/horizon row replaced with GwToggle-only row |
| Captain/VC shown via (C)/(VC) text in PlayerCircle | Not shown in comparison table (deferred) | Phase 44 | `captainId`/`vcId` fields survive but are not rendered |

---

## Open Questions (RESOLVED)

1. **Captain/VC display in Phase 44**
   - What we know: `OptimisedLineup.captainId` and `vcId` are available; 44-UI-SPEC.md does not include them in the comparison table design; no test assertions cover them
   - What's unclear: Whether OPT-03 satisfaction via Phase 43 pitch rendering is considered complete for v1.6, or whether Phase 44 should carry C/VC forward in the table
   - Recommendation: The planner should explicitly omit C/VC from the table unless the user asks for it — the current phase requirements (CMP-01/02/03) do not reference captain, and adding it would be scope creep

---

## Environment Availability

Step 2.6: SKIPPED — Phase 44 is purely a component replacement (code changes only). No new external tools, CLIs, databases, or services are required. All dependencies (Vitest, React, Tailwind) are already installed and confirmed working (13/13 tests pass). [VERIFIED: npm test run 2026-04-30]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.2 + @testing-library/react |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | Comparison table renders with all 15 slots (GK/DEF/MID/FWD sections + Bench section) | unit | `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx` | Exists — requires rewrite |
| CMP-01 | Changed starter rows have `border-l-2 border-l-green-500` class and delta pill | unit | same | Exists — requires rewrite |
| CMP-01 | Unchanged rows have no border-l-green-500 class and no delta pill | unit | same | Exists — requires rewrite |
| CMP-01 | Bench changed rows show Promoted/Dropped badge, not numeric delta | unit | same | Exists — requires rewrite |
| CMP-02 | Headline row renders with correct Formation/Changes/xPts gain copy | unit | same | Exists — requires rewrite |
| CMP-02 | Change count excludes bench slots; xPts gain excludes bench | unit | same | Exists — requires rewrite |
| CMP-03 | Mobile cards render (hidden sm:block / sm:hidden structure present in DOM) | unit | same | Exists — requires rewrite |

**Retained test groups (no change needed):**
- Empty state (no teamId) — unchanged
- Loading state — unchanged
- Error state (squad error) — unchanged
- No squad data state — unchanged
- BGW critical banner (lineup === null) — unchanged
- BGW soft banner — unchanged
- OPT-02 horizon toggle — requires partial rewrite (assert on table cell content instead of player-circle presence)

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/optimiser/OptimiserPanel.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. `OptimiserPanel.test.tsx` exists and passes (13/13). The file needs test replacement, not creation. [VERIFIED: test run 2026-04-30]

---

## Security Domain

Phase 44 is a pure UI replacement with no new data flows, API routes, authentication, input validation, or cryptographic operations. All data enters via `useSquad` and `usePlayers` hooks (unchanged from Phase 43). No ASVS categories apply to this phase.

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on Phase 44 |
|-----------|--------|-------------------|
| Read `node_modules/next/dist/docs/` before writing any Next.js code | AGENTS.md | OptimiserPanel uses `'use client'` — no new Next.js API surface is introduced; executor must read relevant docs before any page.tsx changes (none expected in Phase 44) |
| Do not add `Co-Authored-By` trailers to git commits | CLAUDE.md | No commit trailers |
| Breaking changes possible — APIs may differ from training data | AGENTS.md | No new Next.js patterns introduced; `'use client'` and React hooks already in use |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Captain/VC display is intentionally omitted from the Phase 44 comparison table (no requirement in CMP-01/02/03 or 44-UI-SPEC.md) | Open Questions | Low — if required, the `captainId`/`vcId` fields are available; only visual indicator needs adding |
| A2 | `xPts_1gw` optional fields on `MergedPlayer` are non-null for squad players in normal operation (non-BGW players have pipeline data) | Architecture Patterns | Low — existing `?? 0` fallback chain already handles undefined; BGW guard already in place |

---

## Sources

### Primary (HIGH confidence)
- `src/components/optimiser/OptimiserPanel.tsx` — Verified: full Phase 43 implementation; pitch block, state, hooks, memo structure all confirmed by direct read
- `src/components/optimiser/OptimiserPanel.test.tsx` — Verified: 13 tests, all pass; exact assertions to remove and replace identified
- `src/lib/optimise-lineup.ts` — Verified: engine output shape (`OptimisedLineup.starters`, `.bench`, `.formation`, `.captainId`, `.vcId`); BGW logic
- `src/lib/types.ts` — Verified: `MergedPlayer` with `xPts_*` optional fields; `OptimisedLineup` shape; `OptimiserHorizon`
- `src/lib/squad-adapter.ts` — Verified: `SquadPick.position` (1–15 integer); positions 1–11 = XI; 12–15 = bench
- `src/lib/hooks/useSquad.ts` — Verified: returns `SquadPicksResponse` with `picks[]`
- `src/components/gem-table/GwToggle.tsx` — Verified: accepts `value: 1|3|5`, `onChange` callback; renders "1 GW" / "3 GW" / "5 GW" button text
- `.planning/phases/44-comparison-output/44-CONTEXT.md` — User decisions D-01 through D-09, all canonical refs
- `.planning/phases/44-comparison-output/44-UI-SPEC.md` — Full HTML patterns, color tokens, typography, test contract
- `vitest.config.ts` — Verified: jsdom environment, `@` alias to `src/`
- `package.json` — Verified: no new deps needed; vitest, React, Tailwind present

### Secondary (MEDIUM confidence)
- `.planning/phases/43-lineup-engine-navigator/43-CONTEXT.md` — Phase 43 decisions referenced for what is being replaced

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and working test run
- Architecture: HIGH — full source code read; data shapes verified; pairing algorithm specified in UI-SPEC
- Pitfalls: HIGH — derived from direct code inspection (PlayerCircle removal, formation label location, bench pairing order)
- Test contract: HIGH — existing tests run and pass; UI-SPEC §8 lists exact testids to add/remove

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable codebase — no fast-moving dependencies)
