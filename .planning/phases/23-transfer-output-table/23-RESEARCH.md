# Phase 23: Transfer Output Table — Research

**Researched:** 2026-04-02
**Domain:** React component UI — PlanResult display, chip toggle controls, Tailwind v4 styling
**Confidence:** HIGH

## Summary

Phase 23 takes the `PlanResult` already computed by `generatePlan()` and stored in `PlannerTab`'s `planResult` state and renders it as a readable transfer table. No new data fetching or engine logic is required — this is a pure display phase.

The `PlanResult` shape is fully stable after Phase 22. Each `PlanStep` contains: `gw` (number), `chip` (PlannerChip — initially always `null` from the engine), `transfersIn`/`transfersOut` (player ID arrays), `hitCost` (0 or -4n), `freeTransfersAvailable`, `scoredTransfers` (top 5 candidates with `netGain`), `squadAfter`, and `unconfirmedFixtures`. Player lookups (names, prices) require resolving IDs against the `allPlayers` / `scoredPlayers` array that is already in scope in `PlannerTab`.

The two requirements to deliver are PLAN-05 (the transfer table itself) and PLAN-07 (chip visibility and toggleability per GW row). A "Plan value" headline (total net gain) must appear above the table. DGW/BGW labels go on rows where `fixtureCountForGw(buyPlayer, gw) >= 2` or `=== 0`. Chip state is stored per step — the engine always emits `chip: null`; user toggles override this in `PlannerTab` state via `immer` (already installed).

**Primary recommendation:** Build a `TransferPlanTable` component in `src/components/planner/` that receives `planResult` and `scoredPlayers` as props, derives player names/costs by ID lookup, and renders the table plus chip toggles. Chip toggle state is managed in `PlannerTab` via `useImmer` (already installed).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-05 | Output shows a transfer-by-transfer table (GW \| Out \| In \| Cost \| Projected gain) | `PlanStep.transfersOut/In` IDs → name lookup; `hitCost` and `netGain` from `ScoredTransfer` |
| PLAN-07 | Chip timing (Wildcard, Free Hit, Triple Captain, Bench Boost) is visible and configurable in the plan | `PlanStep.chip: PlannerChip` field exists; engine always emits `null`; user overrides stored in PlannerTab via immer update on the steps array |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md → AGENTS.md)

**AGENTS.md directive:** "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

Verified from `node_modules/next/dist/docs/`:
- Next.js version in use: **16.2.1** (confirmed via `package.json`)
- React version: **19.2.4**
- `'use client'` directive is the correct boundary marker for interactive components (confirmed — `/docs/01-app/03-api-reference/01-directives/use-client.md`)
- All new interactive components must carry `'use client'` at top of file
- No server-component patterns permitted inside the planner UI subtree (it is already client-bounded by `PlannerTab.tsx`)

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering, state | Already in use throughout |
| Tailwind CSS | v4 (project-configured) | Styling | All existing components use it; dark mode is class-based |
| immer / use-immer | installed (Phase 21) | Immutable state updates for chip toggle on steps array | Already installed per Phase 21 roadmap decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | already configured | Unit tests for pure helper functions | Any pure formatter or chip-toggle logic extracted from the component |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useImmer` for chip toggle state | plain `useState` + spread | Plain state is fine for the simple case where chip is one field per step; immer avoids nested spread bugs but is optional here since the array is at most 5 elements |

**Installation:** No new packages required. Everything is already present.

---

## Architecture Patterns

### Recommended Project Structure

```
src/components/planner/
├── HorizonSelector.tsx        # existing
├── PlannerTab.tsx             # existing — owns planResult state + chip overrides
├── TransferPlanTable.tsx      # NEW: pure display component
└── ChipToggle.tsx             # NEW (or inline): per-GW chip selector buttons
```

### Pattern 1: Props-down display component

**What:** `TransferPlanTable` receives `planResult: PlanResult`, `scoredPlayers: ScoredPlayer[]`, and `onChipToggle: (gwIndex: number, chip: PlannerChip) => void`. It never touches hooks or state — pure props-in, JSX-out.

**When to use:** This matches every existing panel in the project (`CaptaincyPanel`, `FixtureBadges` etc.) — all are pure display with callbacks for mutations.

**Example (existing reference pattern from CaptaincyPanel.tsx):**
```tsx
// Source: src/components/captaincy/CaptaincyPanel.tsx
interface CaptaincyPanelProps {
  candidates: CaptaincyCandidate[]
  nextGw: number
}
export function CaptaincyPanel({ candidates, nextGw }: CaptaincyPanelProps) { ... }
```

### Pattern 2: Player ID → name lookup inside the table component

The `PlanStep` stores only player IDs. Names and prices must be resolved from `scoredPlayers`. The standard pattern used elsewhere is a `Map` built once in a `useMemo` or passed as a pre-built lookup:

```tsx
// Build once in PlannerTab (or inside TransferPlanTable via useMemo)
const playerMap = useMemo(
  () => new Map(scoredPlayers.map(p => [p.id, p])),
  [scoredPlayers]
)
```

### Pattern 3: DGW / BGW label per row

Derived at render time using `fixtureCountForGw` (already exported from `planning-engine.ts`):

```tsx
// Source: src/lib/planning-engine.ts (exported)
const buyFixtures = fixtureCountForGw(buyPlayer, step.gw)
// buyFixtures === 2 → DGW badge (violet, matches FixtureBadges.tsx pattern)
// buyFixtures === 0 → BGW badge
// buyFixtures === 1 → no label
```

DGW badge colour convention from existing components:
```
text-violet-700 dark:text-violet-400  (DGW)
```

BGW has no existing badge convention — use amber or zinc as appropriate (LOW confidence on exact colour — planner's discretion).

### Pattern 4: Chip toggle — `useImmer` on the steps array in PlannerTab

The engine always emits `chip: null`. Phase 23 must let the user toggle a chip per GW. `useImmer` is the installed pattern for this kind of nested array mutation:

```tsx
// In PlannerTab
import { useImmer } from 'use-immer'
// Replace: const [planResult, setPlanResult] = useState<PlanResult | null>(null)
// With:
const [planResult, updatePlanResult] = useImmer<PlanResult | null>(null)

// On chip toggle:
function handleChipToggle(stepIndex: number, chip: PlannerChip) {
  updatePlanResult(draft => {
    if (!draft) return
    const step = draft.steps[stepIndex]
    // Toggle: clicking same chip again clears it
    step.chip = step.chip === chip ? null : chip
  })
}
```

**Note:** `planResult` is currently `useState` in Phase 22. Phase 23 must migrate it to `useImmer` to enable chip mutation. This is the only change to `PlannerTab`'s hook signature.

### Pattern 5: "Plan value" headline

Total net projected gain = sum of `step.scoredTransfers[0]?.netGain ?? 0` across all steps where a transfer was made. More precisely: sum of `step.hitCost + (step.scoredTransfers[0]?.totalScore ?? 0)` per step. Display above the table as a single headline number with sign formatting.

### Anti-Patterns to Avoid

- **Deriving player names inline without memoisation:** Calling `scoredPlayers.find(p => p.id === id)` inside each render row is O(n) per cell — use a `Map` built once.
- **Mutating `PlanResult` steps directly with `useState`:** Use `useImmer` — spread bugs in nested arrays are subtle and break equality checks.
- **Storing chip state separately from `PlanResult`:** Chip belongs on `PlanStep.chip` (it's already typed there). Parallel state causes desync.
- **Custom chip toggle logic:** `PlannerChip` is already `'wildcard' | 'freehit' | 'bboost' | '3xc' | null` — just toggle the existing field.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Immutable nested array update | Custom spread/clone logic | `useImmer` (already installed) | Spread errors on `steps[i].chip` are subtle; immer's structural sharing is correct-by-construction |
| DGW detection | Custom fixture counting | `fixtureCountForGw(player, gw)` from `planning-engine.ts` | Already tested, exported, handles BGW(0)/normal(1)/DGW(2) |
| Chip display labels | Custom string map | Inline map constant in `ChipToggle` component | Simple 4-entry map — no library needed, but don't leave it implicit |

**Key insight:** All data is already computed — Phase 23 is a rendering problem, not an algorithm problem.

---

## Common Pitfalls

### Pitfall 1: `netGain` is on `ScoredTransfer`, not `PlanStep` directly

**What goes wrong:** Developer looks at `PlanStep` and doesn't see a `netGain` field, so they re-derive it.
**Why it happens:** `PlanStep.hitCost` is the step hit cost, but the per-transfer `netGain` lives on `step.scoredTransfers[0].netGain`.
**How to avoid:** For the "projected gain" column, use `step.scoredTransfers[0]?.netGain ?? 0`. For "hit cost" column, use `step.hitCost`.
**Warning signs:** If gain + hit columns both read from `hitCost`, something is wrong.

### Pitfall 2: Steps with no transfer

**What goes wrong:** `step.transfersIn` is `[]` (engine found no profitable transfer) — rendering code crashes trying to look up `transfersIn[0]`.
**Why it happens:** Phase 22 engine only populates transfers when `netGain > 0`. Hold weeks produce empty arrays.
**How to avoid:** Guard every ID lookup: `step.transfersIn[0] ?? null`. Render a "Hold" row when both arrays are empty.

### Pitfall 3: `useImmer` migration of `planResult` in PlannerTab

**What goes wrong:** Phase 22 shipped `useState<PlanResult | null>(null)`. Phase 23 must change this to `useImmer`. If Phase 23 forgets to update the `setPlanResult(result)` call in `handleGeneratePlan` to an `updatePlanResult(() => result)` call, type errors or stale state occur.
**How to avoid:** When migrating to `useImmer`, replace: `setPlanResult(result)` → `updatePlanResult(() => result)` (functional form to replace the entire value).

### Pitfall 4: Chip display for Bench Boost and Triple Captain

**What goes wrong:** Chip code is `'bboost'` and `'3xc'` — display labels must be human-readable ("Bench Boost", "Triple Captain"). Using the raw codes in the UI looks broken.
**How to avoid:** Define a `CHIP_LABELS` constant map in the chip toggle component.

### Pitfall 5: `unconfirmedFixtures` flag

**What goes wrong:** Rows for GWs without fixture data show projected gain as if fixtures are confirmed, misleading the user.
**Why it happens:** `PlanStep.unconfirmedFixtures === true` when `fixtureCountForGw` returned 0 across all players for that GW.
**How to avoid:** Show a visual warning (e.g., grey italic text, asterisk) next to the gain value when `step.unconfirmedFixtures` is true. This flag is already set by the engine.

### Pitfall 6: Dark mode colour classes

**What goes wrong:** Using hard-coded `text-black` or `bg-white` instead of `text-zinc-900 dark:text-zinc-100` breaks dark mode.
**Why it happens:** Tailwind v4 dark mode is class-based in this project (confirmed via `STATE.md` decision: "Tailwind v4 class-based dark mode").
**How to avoid:** Follow the existing component colour patterns — zinc scale for text/backgrounds, with explicit `dark:` variants.

---

## Code Examples

Verified patterns from project source:

### Player ID → name resolution (to use in TransferPlanTable)
```tsx
// Pattern from planning-engine.ts (same playerMap approach)
const playerMap = useMemo(
  () => new Map(scoredPlayers.map(p => [p.id, p])),
  [scoredPlayers]
)
// Usage:
const buyPlayer = playerMap.get(step.transfersIn[0])
const sellPlayer = playerMap.get(step.transfersOut[0])
```

### DGW badge (matches FixtureBadges.tsx and CaptaincyPanel.tsx conventions)
```tsx
// Source: src/components/fixtures/FixtureBadges.tsx line 24
// DGW = violet, existing project convention
{fixtureCount >= 2 && (
  <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">DGW</span>
)}
```

### Chip toggle — useImmer pattern
```tsx
// Source: immer docs + Phase 21 decision in STATE.md
// In PlannerTab — migrate from useState to useImmer:
import { useImmer } from 'use-immer'
const [planResult, updatePlanResult] = useImmer<PlanResult | null>(null)

// Replace all: setPlanResult(result)
// With:        updatePlanResult(() => result)

// Chip toggle handler:
function handleChipToggle(stepIndex: number, chip: PlannerChip) {
  updatePlanResult(draft => {
    if (!draft) return
    draft.steps[stepIndex].chip = draft.steps[stepIndex].chip === chip ? null : chip
  })
}
```

### Hold row guard
```tsx
const hasTransfer = step.transfersIn.length > 0
// If !hasTransfer: render a "Hold (no profitable transfer)" row
```

### Plan value headline
```tsx
// Sum netGain from best transfer per step
const totalNetGain = planResult.steps.reduce((sum, step) => {
  return sum + (step.scoredTransfers[0]?.netGain ?? 0)
}, 0)
// Display: "+12.4 pts" or "−2.0 pts"
```

---

## Validation Architecture

**nyquist_validation is enabled** (config.json does not set it to false).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in vitest.config.ts) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-05 | TransferPlanTable renders one row per PlanStep with GW, Out, In, Cost, Gain columns | unit (component render) | `npx vitest run tests/components/planner/` | No — Wave 0 gap |
| PLAN-05 | "Hold" row renders when transfersIn is empty | unit | same | No — Wave 0 gap |
| PLAN-05 | Player names resolved correctly from scoredPlayers | unit | same | No — Wave 0 gap |
| PLAN-07 | Chip toggle changes step.chip in planResult state | unit | same | No — Wave 0 gap |
| PLAN-07 | Clicking same chip again clears it (toggle off) | unit | same | No — Wave 0 gap |
| PLAN-07 | Chip labels map correctly (bboost → "Bench Boost", 3xc → "Triple Captain") | unit | same | No — Wave 0 gap |

**Note:** These are component tests. The existing vitest environment is `node` (not `jsdom`). Component render tests require either:
- (a) `jsdom` environment for vitest, or
- (b) Testing pure helper functions extracted from the component (preferred — matches existing project test pattern)

The existing pattern in this project is to test pure functions (see `planning-engine.test.ts`, `transfer-engine.test.ts`). Component render testing is not yet in the test suite. **Recommendation:** Extract any pure logic (e.g., `computePlanValue(steps)`, `resolvePlayerName(id, playerMap)`, `chipLabel(chip)`) as standalone functions and test those. Visual layout is verified by human review (matching the existing pattern in Phase 22).

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (currently 222 tests, 0 failures) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extract and test pure helpers: `computePlanValue`, `chipLabel` — these are small and testable
- [ ] Consider `tests/components/planner/TransferPlanTable.test.ts` if vitest jsdom is added; otherwise use pure function tests only

*(Vitest jsdom environment not configured — adding it would require `vitest.config.ts` change and `@testing-library/react` install, which is out of scope for this phase. Pure function tests are sufficient.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useState` for `planResult` | `useImmer` for `planResult` | Phase 23 (this phase) | Enables in-place chip toggle without spread bugs |
| Plain text plan output | Structured table with chip column | Phase 23 | Delivers PLAN-05, PLAN-07 |

**Not deprecated in this phase:**
- `generatePlan` function — unchanged, stable output
- `PlanResult`/`PlanStep`/`ScoredTransfer` types — stable, no changes needed

---

## Open Questions

1. **BGW label colour**
   - What we know: DGW uses `text-violet-700 dark:text-violet-400` (established convention)
   - What's unclear: No BGW label exists yet anywhere in the codebase
   - Recommendation: Use `text-amber-600 dark:text-amber-400` (amber = warning = blank = bad) — planner's discretion

2. **"Plan value" calculation basis**
   - What we know: `ScoredTransfer.netGain` = `totalScore + hitCost` (from planning-engine.ts)
   - What's unclear: Should the headline reflect `netGain` of the best transfer only, or of all top-5 scored transfers?
   - Recommendation: Use `step.scoredTransfers[0]?.netGain ?? 0` (the chosen best transfer per step) — this is the value the engine actually commits to

3. **Multiple transfers per GW (future PLAN-04)**
   - What we know: Phase 22 engine only ever does 0 or 1 transfer per step (single-transfer greedy)
   - What's unclear: Phase 24 and 25 may introduce 2-transfer steps
   - Recommendation: Design `TransferPlanTable` rows to support `transfersIn.length > 1` even if unused now — map over the array rather than taking `[0]` only

---

## Environment Availability

Step 2.6: SKIPPED — Phase 23 is a pure UI component change with no external dependencies beyond the project's existing Node/npm stack. No CLI tools, databases, or external services are needed.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/types.ts` — PlanResult, PlanStep, ScoredTransfer, PlannerChip interfaces (read directly)
- `src/lib/planning-engine.ts` — generatePlan, fixtureCountForGw exports (read directly)
- `src/components/planner/PlannerTab.tsx` — current planResult state location, hook wiring (read directly)
- `src/components/fixtures/FixtureBadges.tsx` — DGW badge colour convention (read directly)
- `src/components/captaincy/CaptaincyPanel.tsx` — component pattern reference (read directly)
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` — use client directive (read directly)

### Secondary (MEDIUM confidence)
- `.planning/phases/22-planning-engine/22-01-SUMMARY.md` — confirms PlanResult/PlanStep types stable, no stubs
- `.planning/STATE.md` — immer/use-immer installed, Tailwind v4 dark mode class-based
- `vitest.config.ts` — test environment is node, no jsdom configured

### Tertiary (LOW confidence)
- BGW label colour recommendation (amber) — derived from project colour conventions, no precedent in codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed and in use
- Architecture: HIGH — component patterns directly observed from codebase
- PlanResult types: HIGH — read directly from types.ts and planning-engine.ts
- Chip toggle pattern: HIGH — useImmer is installed and the PlanStep.chip field exists
- Pitfalls: HIGH — derived from direct code inspection, not guesswork
- BGW label colour: LOW — no existing convention to follow

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable project — no fast-moving dependencies)
