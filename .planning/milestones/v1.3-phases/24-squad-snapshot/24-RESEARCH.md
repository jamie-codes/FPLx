# Phase 24: Squad Snapshot - Research

**Researched:** 2026-04-02
**Domain:** React table accordion, TypeScript type extension, FPL position data
**Confidence:** HIGH

## Summary

Phase 24 is a pure read/display phase — it surfaces data already computed by the planning engine and adds an accordion UI row to `TransferPlanTable`. There are no new algorithms, no new data fetches, and no new dependencies needed.

The two pieces of work are: (1) add `positionsAfter: Record<number, number>` to `PlanStep` in `types.ts` and populate it from the `positionMap` in `planning-engine.ts`; and (2) build a `SquadSnapshotRow` component that renders each accordion below its parent GW row, using the position-grouping and bench-dimming patterns already established in `SquadView.tsx`.

The `TransferPlanTable` already uses `<Fragment>` to emit multi-row groups per step (it does this for the mobile chip row). The accordion row slots cleanly into that same `<Fragment>` pattern. State for open/closed accordions lives as a `Set<number>` in `TransferPlanTable` (keyed by step index), matching how `SquadView` tracks `expandedIds`.

**Primary recommendation:** Add `positionsAfter` to `PlanStep`, emit it from `generatePlan`, then build a focused `SquadSnapshotRow` component that accepts `squadAfter`, `positionsAfter`, `transfersIn`, `chip`, and `playerMap` as props — keeping all accordion display logic isolated from `TransferPlanTable`'s transfer logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Accordion trigger — chevron in GW cell**
A ▶/▼ chevron icon inside the GW cell triggers expand/collapse. The GW cell becomes a clickable button (e.g. `GW33 ▶ DGW`). No extra column added to the table. Collapsed by default per ROADMAP success criteria.

**D-02: Player info density — name + team only**
Each player row shows `web_name` and `team_short_name` only. No price, gem score, or other columns. Clean and scannable in a plan context — not a full squad review.

**D-03: Transfer highlight — green "IN" badge**
The newly transferred-in player (from `step.transfersIn`) gets a small green "IN" badge next to their name in the accordion. No other players are specially marked (the sold player is no longer in `squadAfter`).

**D-04: Bench/starting XI distinction — extend PlanStep with positionsAfter**
Add `positionsAfter: Record<number, number>` to `PlanStep` in `src/lib/types.ts`. The planning engine already tracks a `positionMap` internally — this surfaces it in the output. Bench players (positions 12–15) are shown dimmed (`opacity-50`) with a "bench" label, matching the existing `SquadView` pattern.

**D-05: Bench Boost display**
When `step.chip === 'bboost'`, bench players are shown at full opacity (not dimmed) — all 15 players are prominent. This satisfies ROADMAP success criterion 3.

### Claude's Discretion

- Exact chevron icon/symbol and hover styling
- Whether the accordion animates open/closed or snaps
- Layout of the bench divider (e.g. a horizontal rule or a "— bench —" label)
- Whether the accordion is a `<details>`/`<summary>` element or a React state toggle

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-06 | Output shows a squad snapshot for each gameweek in the plan | positionMap in planning-engine.ts lines 59–64, 161–165 is the data source; SquadView.tsx grouping/bench patterns are the display template |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (already installed) | — | Fragment/state for accordion rows | Already in use throughout the project |
| Tailwind CSS (already installed) | v4 | opacity-50, text coloring, layout | Entire project uses Tailwind v4 class-based styling |

### Supporting

No new packages are required. All display primitives (opacity-50 bench dimming, position group headers, player name rendering) are replicated from `SquadView.tsx` which is already in the project.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React state Set<number> for open rows | `<details>`/`<summary>` HTML | `<details>` is valid but CONTEXT.md marks this as Claude's discretion; React state is consistent with SquadView.tsx expandedIds pattern and works inside a `<table>` DOM tree |
| Inline accordion in TransferPlanTable | Separate SquadSnapshotRow component | Separate component is cleaner; TransferPlanTable is already 160 lines and the accordion is independently testable |

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure

New files:
```
src/components/planner/
├── TransferPlanTable.tsx     # MODIFY: add chevron button + accordion rows
├── SquadSnapshotRow.tsx      # NEW: isolated accordion component
└── plan-helpers.ts           # no changes needed
src/lib/
├── types.ts                  # MODIFY: add positionsAfter to PlanStep
└── planning-engine.ts        # MODIFY: populate positionsAfter in each PlanStep
```

### Pattern 1: positionsAfter Emission

**What:** At the point where each `PlanStep` is constructed in `generatePlan` (line 181 in planning-engine.ts), snapshot the current `positionMap` into a plain `Record<number, number>`.

**When to use:** Required for every step so the accordion always knows which IDs are on bench (positions 12–15) vs. starting XI (1–11).

**Example:**
```typescript
// In generatePlan, when constructing each step (after positionMap is updated):
const positionsAfter: Record<number, number> = {}
for (const [id, pos] of positionMap.entries()) {
  positionsAfter[id] = pos
}

const step: PlanStep = {
  // ...existing fields...
  squadAfter: [...simulatedSquadIds],
  positionsAfter,          // NEW
  unconfirmedFixtures,
}
```

### Pattern 2: Accordion in a Table via Fragment

**What:** `TransferPlanTable` already uses `<Fragment key={...}>` to emit multiple `<tr>` elements per step. The accordion row is an additional `<tr>` conditionally rendered inside that same Fragment.

**When to use:** Whenever the step's index is in the `openSteps: Set<number>` state.

**Example (structural):**
```tsx
// Source: existing pattern in TransferPlanTable.tsx (mobile chip row, line 144)
<Fragment key={`step-${i}`}>
  <tr ...>{/* transfer row */}</tr>
  <tr ...>{/* mobile chip row */}</tr>
  {openSteps.has(i) && (
    <tr>
      <td colSpan={6} className="px-0 py-0">
        <SquadSnapshotRow
          squadAfter={step.squadAfter}
          positionsAfter={step.positionsAfter}
          transfersIn={step.transfersIn}
          chip={step.chip}
          playerMap={playerMap}
        />
      </td>
    </tr>
  )}
</Fragment>
```

Note: the table has 6 columns (GW | Chip | Out | In | Hit | Gain) — `colSpan={6}` spans the full row.

### Pattern 3: SquadSnapshotRow Position Grouping

**What:** Group `squadAfter` IDs by position, sort by position number within each group, then render GK/DEF/MID/FWD sections. Bench players (position >= 12) are rendered dimmed unless `chip === 'bboost'`.

**Reuses:** Exact same logic as `SquadView.tsx` lines 89–99 (groupByPosition, sort by position).

**Example:**
```tsx
// Source: SquadView.tsx lines 89-99 (adapted — no pick.position, use positionsAfter[id] instead)
const POSITION_LABELS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

const grouped: Record<number, Array<{ id: number; pos: number }>> = { 1: [], 2: [], 3: [], 4: [] }
for (const id of squadAfter) {
  const player = playerMap.get(id)
  if (!player) continue
  const pos = positionsAfter[id]
  const et = player.element_type
  grouped[et].push({ id, pos })
}
for (const et of [1, 2, 3, 4]) {
  grouped[et].sort((a, b) => a.pos - b.pos)
}
```

### Pattern 4: Bench Dimming and "IN" Badge

**What:** Apply `opacity-50` to bench player rows (position >= 12) unless `chip === 'bboost'`. Append a green "IN" badge when the player's id is in `transfersIn`.

**Source:** `SquadView.tsx` line 148: `${isBench ? 'opacity-50' : ''}`. "bench" label pattern at line 168.

```tsx
const isBench = positionsAfter[id] >= 12
const isBboost = chip === 'bboost'
const isTransferIn = transfersIn.includes(id)

<tr className={`... ${isBench && !isBboost ? 'opacity-50' : ''}`}>
  <td>
    {player.web_name}
    {isTransferIn && (
      <span className="ml-1 text-xs font-semibold text-green-600 dark:text-green-400">IN</span>
    )}
    {isBench && (
      <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">bench</span>
    )}
  </td>
  <td>{player.team_short_name}</td>
</tr>
```

### Pattern 5: Chevron in GW Cell

**What:** The GW cell content becomes a `<button>` that toggles the accordion. Chevron uses the same Unicode characters as `SquadView.tsx` (`▶` / `▼`, lines 157).

**Source:** `SquadView.tsx` line 157: `'\u25BC'` (down) / `'\u25B6'` (right).

```tsx
// Replace current GW cell content in TransferPlanTable.tsx:
<td className="px-2 py-2 sm:px-4 ...">
  <button
    onClick={() => toggleStep(i)}
    className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-400"
    aria-expanded={openSteps.has(i)}
    aria-label={`${openSteps.has(i) ? 'Collapse' : 'Expand'} squad for GW${step.gw}`}
  >
    <span className="text-xs">{openSteps.has(i) ? '\u25BC' : '\u25B6'}</span>
    <span>GW{step.gw}</span>
  </button>
  {isDgw && <span ...>DGW</span>}
  {isBgw && <span ...>BGW</span>}
</td>
```

### Anti-Patterns to Avoid

- **Mutating positionMap after snapshotting:** The snapshot for `positionsAfter` must be taken after the transfer is applied (lines 158–165 in planning-engine.ts) so positions are accurate for that step's squad state.
- **Rendering SquadSnapshotRow outside the table `<tbody>`:** The accordion `<tr>` must stay inside `<tbody>` or the DOM structure will be invalid. The `colSpan={6}` `<td>` approach is correct.
- **Looking up `positionsAfter` on IDs that left the squad:** Only IDs present in `squadAfter` will have entries in `positionsAfter` after the update. Never iterate `positionsAfter` directly; iterate `squadAfter` and look up.
- **Assuming transfersIn.includes() is fast:** With a max of 5 horizon steps and 1 transfer each, `transfersIn` has at most 1 element per step. No performance concern; no need for a Set.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Position grouping | Custom grouping logic | Copy groupByPosition pattern from SquadView.tsx | Already tested in production, handles all 4 position types |
| Bench detection | Custom position threshold | `positionsAfter[id] >= 12` (FPL convention: positions 12–15 = bench) | Same rule used throughout planning-engine.ts |
| Bench boost opacity | Custom chip-aware styling | `isBench && !isBboost ? 'opacity-50' : ''` | Matches existing SquadView pattern |

**Key insight:** This phase is 90% data plumbing and 10% UI. The display patterns all exist in `SquadView.tsx` and the accordion-in-table pattern exists in `TransferPlanTable.tsx`. No new patterns need to be invented.

## Common Pitfalls

### Pitfall 1: positionsAfter Snapshot Timing

**What goes wrong:** Snapshot `positionMap` before applying the transfer — bench/starter distinction is wrong for the transferred-in player.
**Why it happens:** The positionMap mutation (lines 162–165) updates the buy player's position to the sell player's former position. If snapshotted before this update, the buy player appears to have no position entry.
**How to avoid:** Snapshot positionMap into `positionsAfter` after the `if (bestTransfer !== null)` block closes and before constructing the `PlanStep` object.
**Warning signs:** The "IN" badge player renders without a bench/starter distinction in the accordion.

### Pitfall 2: colSpan Must Match Column Count

**What goes wrong:** `colSpan={5}` on the accordion `<td>` clips content on the right, or `colSpan={7}` causes visual overflow.
**Why it happens:** The table has exactly 6 columns: GW | Chip (hidden on mobile) | Out | In | Hit | Gain. Mobile hides Chip column but still has 6 `<th>` elements.
**How to avoid:** Use `colSpan={6}` always. Responsive column hiding via CSS does not change the DOM column count for colSpan purposes.
**Warning signs:** Accordion content visually misaligns with table edge.

### Pitfall 3: Hold Steps Have Empty transfersIn

**What goes wrong:** Accessing `step.transfersIn[0]` for the "IN" badge check when transfersIn is `[]` — no crash, but important to verify `transfersIn.length > 0` before any per-element logic.
**Why it happens:** Hold steps have `transfersIn: []` and `transfersOut: []` by design.
**How to avoid:** Use `new Set(step.transfersIn)` or check `.includes(id)` directly — both return false for empty arrays. No special guard needed, but be aware the accordion still renders for hold steps (showing the unchanged squad).
**Warning signs:** — (no crash risk, just clarifying the data shape)

### Pitfall 4: TypeScript — positionsAfter Missing from PlanStep Before Types.ts Is Updated

**What goes wrong:** Implementation agents write `step.positionsAfter` in planning-engine.ts before the type is added to `PlanStep` in types.ts — TypeScript build error.
**Why it happens:** Types.ts must be updated first or in the same task.
**How to avoid:** Plan Wave 0 task: update types.ts first, then planning-engine.ts, then the UI component. Or update types.ts and planning-engine.ts in the same task.

### Pitfall 5: Dark Mode on Accordion Background

**What goes wrong:** The accordion `<td>` has the table's default transparent background, so it appears white in light mode and correct in dark mode — or vice versa.
**Why it happens:** The accordion renders inside a table row. In `SquadView.tsx`, the expand panel uses `ExplainPanel` which has its own background. The new accordion has no wrapper background by default.
**How to avoid:** Apply `bg-zinc-50 dark:bg-zinc-800/50` to the accordion `<td>` so it's visually distinct from the transfer rows above/below it.

## Code Examples

Verified patterns from project source:

### positionsAfter Snapshot (planning-engine.ts)

```typescript
// Source: planning-engine.ts — after line 168 (simulatedBank update), before line 181 (PlanStep construction)
const positionsAfter: Record<number, number> = {}
for (const [id, pos] of positionMap.entries()) {
  positionsAfter[id] = pos
}
```

### PlanStep Type Extension (types.ts)

```typescript
// Source: types.ts line 236 — add to PlanStep interface
export interface PlanStep extends GWStep {
  scoredTransfers: ScoredTransfer[]
  squadAfter: number[]
  positionsAfter: Record<number, number>   // NEW: player ID → FPL position (1-11 starting, 12-15 bench)
  unconfirmedFixtures: boolean
}
```

### openSteps State in TransferPlanTable

```typescript
// New state at top of TransferPlanTable function body (mirrors SquadView.tsx expandedIds pattern)
const [openSteps, setOpenSteps] = useState<Set<number>>(new Set())
function toggleStep(i: number) {
  setOpenSteps(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })
}
```

### SquadSnapshotRow Props Interface

```typescript
interface SquadSnapshotRowProps {
  squadAfter: number[]
  positionsAfter: Record<number, number>
  transfersIn: number[]
  chip: PlannerChip
  playerMap: Map<number, ScoredPlayer>
}
```

### Bench Divider

```tsx
// Between starting XI and bench players within a position group (or as a standalone separator):
<tr>
  <td colSpan={2} className="px-2 py-1 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
    — bench —
  </td>
</tr>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| positionMap only internal to generatePlan | positionsAfter exposed on PlanStep | Phase 24 (this phase) | Downstream components can distinguish bench from starters without re-deriving |

**No deprecated patterns to avoid in this phase.** The `<details>`/`<summary>` HTML element is a valid choice for the accordion (CONTEXT.md marks this as Claude's discretion), but the project convention from `SquadView.tsx` uses React state + conditional render. Either works inside a table row via the colSpan `<td>` wrapper.

## Open Questions

1. **Bench divider placement**
   - What we know: CONTEXT.md leaves bench divider layout to Claude's discretion
   - What's unclear: Should the divider appear once per position group that has bench players, or as a global separator after all 11 starters?
   - Recommendation: One global "— bench —" separator row after position group 4 (FWD) is simplest; bench players are always positions 12–15 regardless of element_type. A horizontal rule `<tr>` with `colSpan={2}` at that boundary is clean.

2. **Animation preference**
   - What we know: CONTEXT.md leaves animate vs. snap to Claude's discretion
   - What's unclear: Tailwind v4 `transition-all` on a table row's height is unreliable across browsers
   - Recommendation: Snap (no animation). Conditional render is instant and avoids the known pitfall of animating `display: table-row` / `height: auto` in CSS.

## Environment Availability

Step 2.6: SKIPPED — this phase makes no new external tool, service, or runtime calls. All data flows from `generatePlan` (already working) through existing props.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts, globals: true, environment: node) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/planning-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-06 | `positionsAfter` emitted correctly per step (starting XI 1–11, bench 12–15) | unit | `npx vitest run src/lib/planning-engine.test.ts` | Wave 0 gap |
| PLAN-06 | `positionsAfter` updated after a transfer (buy player inherits sell player's position) | unit | `npx vitest run src/lib/planning-engine.test.ts` | Wave 0 gap |
| PLAN-06 | Hold step emits `positionsAfter` with all 15 players | unit | `npx vitest run src/lib/planning-engine.test.ts` | Wave 0 gap |

SquadSnapshotRow is a React component (visual). Testing it with Vitest node environment is not practical — verify via browser smoke test during Phase 24 execution.

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/planning-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/planning-engine.test.ts` — covers PLAN-06 (positionsAfter unit tests)

*(No existing test file for planning-engine.ts — must be created in Wave 0)*

## Sources

### Primary (HIGH confidence)

- `src/lib/planning-engine.ts` — full source, positionMap lines 59–64, 161–165, step construction lines 181–191
- `src/lib/types.ts` — PlanStep interface (line 236), GWStep interface (line 208)
- `src/components/planner/TransferPlanTable.tsx` — Fragment pattern, column structure (6 columns), mobile chip row pattern
- `src/components/squad/SquadView.tsx` — POSITION_LABELS, expandedIds pattern, isBench check (position >= 12), opacity-50 convention, bench label, chevron Unicode
- `.planning/phases/24-squad-snapshot/24-CONTEXT.md` — all locked decisions D-01 through D-05

### Secondary (MEDIUM confidence)

- `src/components/planner/plan-helpers.ts` — existing chip labels, formatGain pattern
- `src/components/planner/ChipToggle.tsx` — button styling conventions in this component family
- `vitest.config.ts` — confirmed Vitest setup (globals, node environment, @/ alias)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns sourced from existing project files
- Architecture: HIGH — positionMap flow is fully traceable in planning-engine.ts; accordion slot is confirmed via Fragment pattern in TransferPlanTable.tsx
- Pitfalls: HIGH — each pitfall sourced from direct code inspection

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable internal codebase — no external API dependencies)
