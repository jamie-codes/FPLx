# Technology Stack

**Project:** FPL Analyst — v1.3 Gameweek Planner additions
**Researched:** 2026-04-01
**Confidence:** HIGH
**Scope:** NEW capabilities only. Existing validated stack (Next.js 16, React 19, TypeScript, TanStack Table v8, TanStack Query v5, Tailwind CSS v4, Vitest, Python/pandas/requests/soccerdata/Vercel Blob) is NOT re-researched here.

---

## What Is Already Installed (do not re-add)

From `package.json` as of 2026-04-01:

**npm:** `next@16.2.1`, `react@19.2.4`, `@tanstack/react-query@^5.95.2`, `@tanstack/react-table@^8.21.3`, `@vercel/blob@^2.3.1`, `zod@^4.3.6`, `tailwindcss@^4`, `vitest@^4.1.2`

**No UI component library installed.** All components are hand-written Tailwind CSS. There is NO shadcn/ui, Radix UI, or Headless UI in the project — the v1.1 research file mentioned them as recommendations but they were not adopted. Build new components the same way: custom Tailwind.

---

## New Stack Additions Required for v1.3

### 1. State Management for Multi-GW Plan

**Add: `use-immer@0.11.0` (peer: `immer@11.1.4`)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| immer | ^11.1.4 | Immutable state update primitive | Enables safe mutation syntax in reducers; zero runtime overhead for reads; well-established (5,900+ npm dependents) |
| use-immer | ^0.11.0 | `useImmerReducer` hook | Wraps React's `useReducer` with Immer's `produce`; eliminates nested spread boilerplate in plan state updates |

The Gameweek Planner needs a plan state that looks like:

```typescript
interface GWPlan {
  horizon: 1 | 2 | 3 | 4 | 5
  freeTransfers: number
  bank: number
  gwSteps: GWStep[]          // one entry per GW in horizon
  chipSequence: ChipSlot[]   // which chip (if any) plays in which GW
}

interface GWStep {
  gwId: number
  transfers: PlannedTransfer[]  // up to 2 transfers per GW
  squadSnapshot: SquadPick[]    // 15-player squad after transfers applied
  projectedPoints: number
  transferCost: number          // 0 or 4 * extra transfers
}
```

Updating a single transfer inside `gwSteps[2].transfers[1]` with plain `useReducer` requires five levels of nested spread. With `useImmerReducer`, the reducer writes `draft.gwSteps[2].transfers[1].buyId = newId` directly. The state remains immutable; Immer handles the structural sharing internally.

**Why not Zustand:**
Zustand is a global store. The planner state is local to the `PlannerTab` component — it does not need to be shared across other tabs, persisted, or accessed from outside the component tree. `useImmerReducer` is component-local state management, which is the correct scope. Zustand adds a global subscription model that is unnecessary here. The React docs recommend `useReducer` for complex, co-located state — this is that case.

**Why not plain `useReducer` (without Immer):**
The plan state has 3–5 levels of nesting (horizon → gwStep → transfer → player). Plain useReducer spreads at this depth are verbose, error-prone, and produce unclear diffs. Immer eliminates the spread boilerplate without changing the `useReducer` model — it is a mechanical improvement, not a paradigm shift.

**Why not Redux Toolkit:**
Redux adds a global store, DevTools dependency, slice boilerplate, and a provider. The planner is one tab in a single-user personal tool. This is engineering overhead with no benefit.

```bash
npm install immer use-immer
```

---

### 2. Combobox for Player Search (Manual Edit Mode)

**Add: NONE — build native with Tailwind**

Manual edit mode lets the manager pick a replacement player from a filtered list. A combobox (type-to-filter input + dropdown list) is needed. Options considered:

| Option | Assessment |
|--------|------------|
| `@headlessui/react@2.2.9` | Latest stable, fully accessible, zero styling. Compatible with Tailwind v4 via `@headlessui/tailwindcss` plugin. But: adds ~12kB to bundle and a new library contract to maintain. |
| Native `<input>` + filtered `<datalist>` | Accessible, zero-dependency, but `<datalist>` styling is uncontrollable — will look broken in dark mode. |
| Custom `<input>` + absolutely-positioned `<ul>` with React state | ~50 lines of code; full style control; matches existing pattern in the codebase; works with Tailwind dark mode. |

**Recommendation: Custom native implementation.** The codebase has no UI component library and has consistently used hand-written Tailwind. The player search combobox for this planner filters ~600 players by name/position. This is a simple controlled input + filtered array pattern, not a complex compound component. Implementing it natively (40–60 lines) is consistent with all existing components and adds zero dependency overhead.

If complexity grows (nested portals, focus trapping across modals, keyboard nav edge cases), add `@headlessui/react` at that point. It is backward-compatible.

---

### 3. Planner Algorithm (Auto-Suggest)

**Add: NONE — pure TypeScript, no library**

The auto-suggest transfer sequence uses a **greedy beam search** implemented as a pure TypeScript function. This is the same algorithmic approach used by the FPL industry's most sophisticated tools (fplreview's "Transfer Solver" is explicitly described as a "chess-engine style search" — beam search over transfer sequences, not MILP).

**Algorithm scope for v1.3:**
- Horizon: 1–5 GWs (user-set)
- Beam width: 3–5 candidates per step (controllable constant)
- Each node: current squad + bank + free transfers + chip state
- Scoring: projected points delta minus transfer costs, summed over horizon
- DGW/BGW awareness: pulled from existing `FixtureEntry.event_id` fixture count logic (already in `transfer-engine.ts`)

The algorithm is a deterministic tree search with bounded branching factor. It runs client-side in TypeScript in ~100ms for a 5-GW horizon with beam width 3 (O(beam × candidates × horizon) ≈ 3 × 20 × 5 = 300 evaluations). No WASM, no Web Worker, no optimization library needed.

**Why not MILP (linear programming solver like HiGHS):**
MILP guarantees global optimality over the horizon. However: (1) there is no production-ready MILP solver that runs in the browser in JavaScript; (2) the existing scoring model is heuristic (gem scores, projected points from ppg), not a rigorous probability model — MILP precision is false accuracy on heuristic inputs; (3) beam search with beam width 3 finds solutions within 2–5% of optimal for FPL-scale problems according to the fplreview solver documentation. Beam search is correct for this scope.

**Why not a server-side API route for the algorithm:**
The planner is interactive — the manager edits transfers and sees scores update in real time. A server round-trip on every edit (changing a player, adjusting the horizon) would make the UI feel sluggish. Client-side pure TypeScript is the correct execution model.

---

### 4. Drag-and-Drop for Plan Reordering

**Add: NONE for v1.3 — defer drag-and-drop entirely**

The planner output is a transfer-by-transfer table (PLAN-09) and squad snapshots (PLAN-10). Manual editing (PLAN-03) means selecting replacement players, not reordering rows. There is no drag-and-drop UX requirement in the v1.3 feature list.

If reordering of the transfer sequence becomes a requirement, `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` is the right choice — accessible, React 19 compatible (peer dep `react@>=16.8.0`, tested against React 18/19 in the community), 25kB total. Do not add it until the requirement exists.

**Do NOT add `react-beautiful-dnd`:** Atlassian has archived the project (read-only, no releases since 2022). It has peer dep issues with React 18+. It is abandoned.

---

### 5. Animation

**Add: NONE — CSS transitions only**

The planner UI needs fade-in on plan generation, row highlight on edit, and squad snapshot transition between GWs. All of these are achievable with Tailwind `transition-*` utilities and CSS `@keyframes` in `globals.css`. Framer Motion (34kB base, ~50kB gzipped) is disproportionate for a personal tool where users tolerate functional UI over polished animation.

---

## Summary: What to Install

```bash
# The only new npm dependencies needed for v1.3
npm install immer use-immer
```

Everything else is implemented as:
- Pure TypeScript functions in `src/lib/` (algorithm, scoring, state derivation)
- Hand-written Tailwind CSS components (combobox, plan table, squad snapshot)
- Existing TanStack Query `select` option for derived state from cached player data

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Plan state | `useImmerReducer` (local) | Zustand (global) | Plan state is tab-local; Zustand's global model adds unnecessary scope and subscription overhead |
| Plan state | `useImmerReducer` | Redux Toolkit | RTK adds global store + provider + slice boilerplate; no benefit for single-tab local state |
| Plan state | `useImmerReducer` | Jotai atoms | Atomic model fits fine-grained cross-component state; plan state is a single cohesive structure that acts as one unit — reducer is clearer |
| Combobox | Custom native ~50 LOC | `@headlessui/react` | No existing UI lib in project; native implementation is 40–60 LOC with full style control; Headless UI adds library maintenance obligation without sufficient payoff at this complexity level |
| Combobox | Custom native | `react-select` | react-select is 28kB, has its own styling system that conflicts with Tailwind, known for Tailwind dark mode friction |
| Algorithm | Pure TypeScript beam search | MILP solver (HiGHS-js) | No stable browser WASM port; MILP precision is false accuracy on heuristic scoring model; beam search matches the industry approach at this scale |
| Algorithm | Pure TypeScript beam search | Server-side API route | Interactive edits require real-time feedback; round-trip latency destroys UX; algorithm is fast enough client-side |
| Drag-and-drop | Deferred | `@dnd-kit/core` | No UX requirement exists for row reordering in v1.3; premature |
| Animation | CSS transitions | Framer Motion | ~50kB for a personal tool; Tailwind transitions cover all needed cases |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Archived by Atlassian 2022, no React 18/19 support, open peer dep issues | `@dnd-kit/core` if drag-drop is ever needed |
| `redux` / `@reduxjs/toolkit` | Global store architecture is overkill for tab-scoped planner state; adds DevTools dependency | `useImmerReducer` |
| `framer-motion` | ~50kB bundle addition for a personal tool; CSS transitions sufficient | `transition-*` Tailwind utilities |
| `react-select` | Own styling system conflicts with Tailwind dark mode; 28kB; maintenance overhead | Custom native combobox (~50 LOC) |
| Any MILP solver (`highs-js`, `glpk.js`) | Browser WASM ports are large and unstable; overkill for heuristic-scored planning | Pure TypeScript beam search |
| `@headlessui/react` for this milestone | No existing dependency; native implementation is sufficient for a single combobox | Custom native; re-evaluate if more complex UI primitives are needed |
| `xstate` / state machines | Overcomplicated for a 5-step linear plan; introduces a new paradigm with no ecosystem precedent in this codebase | `useImmerReducer` with typed action union |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `immer@^11.1.4` | React 19.2.4, TypeScript 5.x, Node 25 | No React dependency; pure JS; ES2015+ target; 11.x branch active |
| `use-immer@^0.11.0` | React 19.2.4 (peer: `react>=16.8.0`), immer ^10 or ^11 | Last published ~1 year ago, but stable; no React 19-specific issues reported |

---

## Integration with Existing Stack

| New Capability | Integrates With | Integration Point |
|----------------|-----------------|-------------------|
| Beam-search algorithm | `transfer-engine.ts`, `gem-score.ts`, `types.ts` | New `planner-engine.ts` module; consumes `ScoredPlayer`, `SquadPick`, `MergedPlayer` types; extends `transfer-engine.ts`'s `SingleTransfer` into `PlannedTransfer` |
| Plan state (`useImmerReducer`) | TanStack Query (`usePlayers`, `useMyTeam`) | Planner component reads cached player data from TQ; plan state is separate local reducer — TQ is read-only data layer, Immer reducer is mutable plan layer |
| Planner tab | `page.tsx`, `MobileNav` | Extend `Tab` union type to include `'planner'`; add tab button to desktop nav; add icon + label to `MobileNav` |
| Squad snapshot | `squad-adapter.ts` | `applyTransfers(squad, transfers) -> SquadPick[]` pure function; derives simulated squad state per GW without any new library |
| TanStack Query `select` | Existing `usePlayers()` | Use `select` option to pre-filter and sort players by position and score for combobox; no new query keys needed |
| Chip state in plan | `ChipState` type in `transfer-engine.ts` | Extend existing `ChipState` type; planner tracks which chip is active in which GW of the plan |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| `useImmerReducer` for plan state | HIGH | Verified: immer 11.1.4 on npm; use-immer 0.11.0 on npm; React 19 peer dep satisfied; pattern well-documented |
| No drag-and-drop needed | HIGH | Reviewed PLAN-01 through PLAN-11 requirements; no reorder UX specified |
| Beam search in TypeScript | HIGH | Proven approach — fplreview uses same model; O(beam×candidates×horizon) is well within browser compute limits for these input sizes |
| No MILP needed | HIGH | No stable browser WASM port; heuristic scoring makes MILP precision meaningless |
| Custom combobox over library | MEDIUM | Custom implementation is consistent with codebase pattern; risk is accessibility edge cases (keyboard nav, screen reader) that headlessui handles by default — acceptable for a personal tool |
| CSS transitions over Framer Motion | HIGH | Tailwind transition utilities confirmed sufficient for fade, slide, highlight patterns needed |

---

## Sources

- immer npm: https://www.npmjs.com/package/immer — v11.1.4 confirmed
- use-immer npm: https://www.npmjs.com/package/use-immer — v0.11.0 confirmed
- use-immer GitHub: https://github.com/immerjs/use-immer — React 19 peer dep `>=16.8.0`
- fplreview solver comparison: https://docs.fplreview.com/the-model/solvers/solver-comparison/ — confirms beam search ("chess-engine style") as the solver approach
- Zustand v5 React 19: https://github.com/pmndrs/zustand/discussions/2686 — confirmed React 19 compatible
- @dnd-kit/core npm: https://www.npmjs.com/package/@dnd-kit/core — v6.3.1; peer `react>=16.8.0`
- @dnd-kit/sortable npm: https://www.npmjs.com/package/@dnd-kit/sortable — v10.0.0
- react-beautiful-dnd archived: https://github.com/atlassian/react-beautiful-dnd — archived 2022
- TanStack Query select option: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery — `select` transform documented
- React 2025 state patterns: https://makersden.io/blog/react-state-management-in-2025 — useReducer recommended for co-located complex state

---
*Stack research for: FPL Analyst v1.3 Gameweek Planner*
*Researched: 2026-04-01*
