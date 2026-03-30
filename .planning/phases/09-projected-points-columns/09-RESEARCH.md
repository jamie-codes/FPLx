# Phase 9: Projected Points Columns - Research

**Researched:** 2026-03-30
**Domain:** TanStack Table v8 column visibility, React state management, Tailwind v4 button groups
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-04 | User can view projected points columns in GemTable and Transfer Panel UI | `proj_pts_1gw/3gw/5gw` are non-nullable `number` fields already on every `ScoredPlayer`; TanStack Table v8 `columnVisibility` state enables show/hide driven by `gwHorizon`; UI-SPEC provides complete class-level specification for all surfaces |

</phase_requirements>

---

## Summary

Phase 9 is a pure frontend phase. All data infrastructure is already complete: `MergedPlayer` (and therefore `ScoredPlayer`) carries `proj_pts_1gw`, `proj_pts_3gw`, and `proj_pts_5gw` as non-nullable `number` fields written by the Phase 7 pipeline. No new API routes, no new Python work, and no TypeScript type changes are required.

The work is two independent surfaces. First, GemTable gains three new sortable `col.accessor` columns plus a new `GwToggle` component that drives `columnVisibility` state to show exactly one of those three columns at a time. Second, TransferPanel gains a one-line projected-points display in each suggestion card's existing metadata row. Both `SingleTransfer.sell` and `SingleTransfer.buy` are already typed as `ScoredPlayer`, so `s.sell.proj_pts_1gw` and `s.buy.proj_pts_1gw` are immediately accessible with no interface changes.

The key technical mechanism is TanStack Table v8's built-in `columnVisibility` state (`VisibilityState = Record<string, boolean>`), passed through `state.columnVisibility` in `useReactTable`. The render loop already calls `row.getVisibleCells()` — no loop changes are needed. The UI-SPEC is fully prescriptive: exact class names, exact component structure, exact copy, exact accessibility attributes.

**Primary recommendation:** Two-plan structure. Plan 01: GwToggle component + three projected points columns in columns.tsx + GemTable wiring. Plan 02: TransferPanel metadata row extension (both single and combo rows) + Vitest test for derived visibility logic.

---

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` delegates to `AGENTS.md`:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Implications for Phase 9:** Phase 9 is client-component-only work. No new Next.js pages, API routes, server components, or middleware are introduced. All new code goes into existing `'use client'` components (`GemTable.tsx`, `TransferPanel.tsx`) or a new client component (`GwToggle.tsx`). These use React hooks (`useState`) only — not Next.js-specific APIs. Risk: LOW. If any Next.js API is unexpectedly needed, the implementer must read `node_modules/next/dist/docs/` first.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 (installed, current) | Table state including `columnVisibility` | Already the table library for GemTable — built-in feature |
| React (useState) | 19.2.4 (installed) | Local state for `gwHorizon: 1 | 3 | 5` | Already used throughout components |
| Tailwind v4 | ^4 (installed) | All visual styling — joined button group, table cells | Project-wide standard, no shadcn |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.2 (installed, current) | Unit test for derived visibility logic | nyquist_validation is enabled |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack `columnVisibility` state | CSS `hidden` / `display:none` per column | TanStack approach keeps hidden columns out of DOM, out of sort/filter state, correct semantics |
| Single `gwHorizon: 1\|3\|5` state | Three separate boolean `useState` | Single union value is the source of truth per UI-SPEC — no synchronisation risk |

**Installation:** No new packages needed. All required libraries are installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── gem-table/
│   │   ├── GemTable.tsx          # modified: add gwHorizon state + columnVisibility + GwToggle render
│   │   ├── columns.tsx           # modified: add 3 proj_pts accessor columns
│   │   └── GwToggle.tsx          # NEW: 1GW/3GW/5GW toggle component
│   └── transfers/
│       └── TransferPanel.tsx     # modified: extend metadata row in both suggestion loops
src/tests/
│   └── lib/
│       └── gw-toggle.test.ts     # NEW: Vitest unit test for visibility derivation
```

### Pattern 1: TanStack Table v8 Column Visibility (Controlled)

**What:** Pass `columnVisibility` as a derived `Record<string, boolean>` in `state`. No `onColumnVisibilityChange` needed when visibility is fully controlled by external state.

**When to use:** When column visibility is toggled by external UI (not a built-in column picker).

**Example:**
```typescript
// Source: node_modules/@tanstack/table-core/build/lib/features/ColumnVisibility.d.ts
// Verified: VisibilityState = Record<string, boolean>
import { type VisibilityState } from '@tanstack/react-table'

const [gwHorizon, setGwHorizon] = useState<1 | 3 | 5>(1)

const columnVisibility: VisibilityState = {
  proj_pts_1gw: gwHorizon === 1,
  proj_pts_3gw: gwHorizon === 3,
  proj_pts_5gw: gwHorizon === 5,
}

const table = useReactTable({
  data: scoredPlayers,
  columns,
  state: { sorting, columnFilters, columnVisibility },  // add columnVisibility here
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  // No onColumnVisibilityChange — driven by gwHorizon, table reads state on each render
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
```

**Key detail:** The `row.getVisibleCells()` call in the existing render loop already respects `columnVisibility` — no change to the render loop is needed.

### Pattern 2: Accessor Column for Numeric Proj Pts Fields

**What:** `col.accessor('proj_pts_1gw', { header, cell, enableSorting })` where the accessor key exactly matches the `ScoredPlayer` field name. TanStack derives the column `id` from the accessor key — this becomes the key used in `columnVisibility`.

**When to use:** Sortable numeric data columns.

**Example:**
```typescript
// Source: consistent with existing columns.tsx pattern, validated against ScoredPlayer type
col.accessor('proj_pts_1gw', {
  header: 'Proj Pts',
  cell: (info) => info.getValue().toFixed(1),
  enableSorting: true,
}),
col.accessor('proj_pts_3gw', {
  header: 'Proj Pts (3)',
  cell: (info) => info.getValue().toFixed(1),
  enableSorting: true,
}),
col.accessor('proj_pts_5gw', {
  header: 'Proj Pts (5)',
  cell: (info) => info.getValue().toFixed(1),
  enableSorting: true,
}),
```

Column position in the `columns` array: insert after the `col.display({ id: 'mins_risk', ... })` entry, before the `col.display({ id: 'trend', ... })` entry (per UI-SPEC).

`info.getValue()` returns `number` (non-nullable per Phase 07-02 locked decision). `.toFixed(1)` is always safe — no null guard needed, no em-dash fallback.

### Pattern 3: GwToggle Component — Joined Button Group

**What:** Three `<button>` elements in a `flex rounded overflow-hidden border border-zinc-300` container. Active button: `bg-zinc-900 text-white`. Inactive: `bg-white text-zinc-700 hover:bg-zinc-50`.

**Example (from UI-SPEC):**
```tsx
// Source: 09-UI-SPEC.md — approved design contract
<div
  role="group"
  aria-label="Projected points horizon"
  className="flex rounded overflow-hidden border border-zinc-300"
>
  {([1, 3, 5] as const).map((gw) => (
    <button
      key={gw}
      onClick={() => onChange(gw)}
      aria-pressed={value === gw}
      className={`px-3 py-1 text-sm font-medium transition-colors ${
        value === gw
          ? 'bg-zinc-900 text-white'
          : 'bg-white text-zinc-700 hover:bg-zinc-50'
      }`}
    >
      {gw} GW
    </button>
  ))}
</div>
```

**Props:** `{ value: 1 | 3 | 5; onChange: (v: 1 | 3 | 5) => void }`
**File:** `src/components/gem-table/GwToggle.tsx`

### Pattern 4: GemTable Layout — PositionFilter + GwToggle Row

**What:** Replace standalone `<PositionFilter />` with a flex row that holds both PositionFilter and GwToggle.

**Current (GemTable.tsx line 65):**
```tsx
<PositionFilter active={activePosition} onChange={handlePositionChange} />
```

**After Phase 9:**
```tsx
<div className="flex justify-between items-center mb-2">
  <PositionFilter active={activePosition} onChange={handlePositionChange} />
  <GwToggle value={gwHorizon} onChange={setGwHorizon} />
</div>
```

Note: `PositionFilter` has `className="flex gap-2 mb-4"` on its root div internally. The wrapper provides the bottom margin (`mb-2`). Verify during implementation that the spacing is correct — may need to suppress PositionFilter's own `mb-4` if double-margin occurs.

### Pattern 5: TransferPanel Metadata Row Extension

**What:** Append `| Proj pts (1 GW): X.X → Y.Y` to the existing `text-xs text-zinc-500` metadata div. Apply to **both** the `suggestions` loop (lines ~153-210) and the `two_transfer_combo` loop (lines ~217-262) — both render identical card structure.

**Example (from UI-SPEC):**
```tsx
// Source: 09-UI-SPEC.md — approved design contract
// s: SingleTransfer — s.sell and s.buy are ScoredPlayer with proj_pts_1gw: number
{' '}| Proj pts (1 GW):{' '}
<span className="text-zinc-700">{s.sell.proj_pts_1gw.toFixed(1)}</span>
{' '}&rarr;{' '}
<span className="text-zinc-700">{s.buy.proj_pts_1gw.toFixed(1)}</span>
```

This appends inside the existing `<div className="text-xs text-zinc-500">` that currently ends after the `(approx)` span.

### Anti-Patterns to Avoid

- **Using CSS `display:none` instead of `columnVisibility`:** TanStack still renders hidden cells — wastes DOM nodes and causes sort indicator issues.
- **Three separate boolean `useState` hooks for visibility:** Creates synchronisation risk. Use a single `gwHorizon: 1 | 3 | 5`.
- **Applying `normalise()` to proj_pts before display:** Locked v1.1 roadmap decision. Absolute FPL points only — `toFixed(1)` display only.
- **Showing `—` em-dash for 0.0 proj_pts:** UI-SPEC: "proj_pts value is 0.0 renders '0.0' (never em-dash)". All projected fields are non-null.
- **Updating only the single-transfer rows in TransferPanel:** Both the `suggestions` loop and the `two_transfer_combo` loop must be updated identically.
- **Importing `ColumnVisibilityState`:** The correct exported type name is `VisibilityState`, not `ColumnVisibilityState`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column show/hide based on toggle | Conditional rendering per column in JSX | TanStack `columnVisibility` state | Built-in, handles sort indicators and header groups correctly |
| Exclusive multi-option toggle | Complex state machine | Single `1 | 3 | 5` union state | TypeScript narrows it; impossible to have two options "active" simultaneously |

**Key insight:** `row.getVisibleCells()` already filters cells by `columnVisibility`. The render loop in GemTable needs zero changes — adding `columnVisibility` to `state` is the entire mechanical modification.

---

## Common Pitfalls

### Pitfall 1: `onColumnVisibilityChange` causing visibility reset

**What goes wrong:** Adding `onColumnVisibilityChange` that calls `setColumnVisibility` overwrites the derived state on re-render, causing columns to re-appear after being hidden.

**Why it happens:** TanStack v8 docs show a controlled pattern with `onColumnVisibilityChange`. When visibility is fully derived from external state (not managed inside the table), this handler is unnecessary.

**How to avoid:** Do not add `onColumnVisibilityChange`. The derived `columnVisibility` object is recomputed from `gwHorizon` on every render and passed fresh to `state`.

**Warning signs:** Column visibility flickering or reverting to default after user interactions (sort, filter).

### Pitfall 2: Column ID mismatch in `columnVisibility` map

**What goes wrong:** All three columns show simultaneously or never show — visibility map keys do not match column IDs.

**Why it happens:** For `col.accessor('proj_pts_1gw', ...)`, TanStack derives the column id as `'proj_pts_1gw'`. The `columnVisibility` map must use this exact string. Typos or abbreviated names silently fail.

**How to avoid:** Keys in the visibility object must be `'proj_pts_1gw'`, `'proj_pts_3gw'`, `'proj_pts_5gw'` — matching the accessor argument exactly.

**Warning signs:** All three proj_pts columns visible at once, or none visible.

### Pitfall 3: Missing `transition-colors` on GwToggle buttons

**What goes wrong:** Active/inactive state transitions look abrupt.

**Why it happens:** Easy to omit when copying from a non-transitioning button pattern.

**How to avoid:** Include `transition-colors` in the button className per UI-SPEC. The `MinsRiskBadge` pattern does not include transition — don't copy from there.

### Pitfall 4: TransferPanel combo rows missing proj_pts

**What goes wrong:** Proj pts line appears on single-transfer suggestions but not on 2-transfer combo suggestions.

**Why it happens:** TransferPanel.tsx has two independent map loops that render visually identical card HTML. The combo loop currently omits the budget badge — this could be mistaken for "combo cards have a different structure".

**How to avoid:** Add the proj_pts extension to both loops. `s.sell` and `s.buy` are `ScoredPlayer` in both loops — `proj_pts_1gw` is accessible everywhere.

### Pitfall 5: PositionFilter `mb-4` double-margin

**What goes wrong:** Extra vertical space appears between the toggle row and the player count paragraph.

**Why it happens:** `PositionFilter.tsx` has `mb-4` on its root div. When wrapped in `mb-2`, both margins apply.

**How to avoid:** Verify visually during implementation. If double-margin occurs, the wrapper `mb-2` is sufficient — remove or override `mb-4` on PositionFilter. This is a one-line change to PositionFilter.tsx.

---

## Code Examples

### GemTable.tsx — final state block

```typescript
// Source: GemTable.tsx existing pattern + TanStack ColumnVisibility.d.ts
const [sorting, setSorting] = useState<SortingState>([
  { id: 'gem_score', desc: true },
])
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
const [activePosition, setActivePosition] = useState<PositionCode | null>(null)
const [gwHorizon, setGwHorizon] = useState<1 | 3 | 5>(1)   // NEW

const columnVisibility = {   // NEW — derived from gwHorizon
  proj_pts_1gw: gwHorizon === 1,
  proj_pts_3gw: gwHorizon === 3,
  proj_pts_5gw: gwHorizon === 5,
}
```

### GemTable.tsx — useReactTable with columnVisibility

```typescript
const table = useReactTable({
  data: scoredPlayers,
  columns,
  state: { sorting, columnFilters, columnVisibility },  // added columnVisibility
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
```

### GwToggle.tsx — complete component

```tsx
// File: src/components/gem-table/GwToggle.tsx
'use client'   // not strictly required (no hooks inside), but consistent with project pattern

interface Props {
  value: 1 | 3 | 5
  onChange: (v: 1 | 3 | 5) => void
}

export function GwToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Projected points horizon"
      className="flex rounded overflow-hidden border border-zinc-300"
    >
      {([1, 3, 5] as const).map((gw) => (
        <button
          key={gw}
          onClick={() => onChange(gw)}
          aria-pressed={value === gw}
          className={`px-3 py-1 text-sm font-medium transition-colors ${
            value === gw
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {gw} GW
        </button>
      ))}
    </div>
  )
}
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 has no external dependencies. All libraries are installed. No new npm packages, CLI tools, or external services are needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root — exists) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

**Environment note:** `vitest.config.ts` specifies `environment: 'node'`. This means full React component rendering tests (requiring DOM) are not the project pattern. The existing convention (see Phase 8 — `getMinsRiskConfig` as a pure function test) is to extract testable logic into exported pure functions and test those.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-04 | `columnVisibility` correctly shows only the active horizon column | unit (pure fn) | `npx vitest run` | ❌ Wave 0 |
| PROJ-04 | `GwToggle` props contract: value/onChange type correctness | type check (tsc) | `npx tsc --noEmit` | N/A |
| PROJ-04 | TransferPanel renders proj_pts_1gw for suggestions | manual smoke | Load squad in browser | N/A |

**Recommended test approach:** Export a helper `getColumnVisibility(horizon: 1 | 3 | 5): Record<string, boolean>` from GwToggle.tsx (or a dedicated utility) and test it with three cases. This matches the project's established pattern of testing pure logic extracted from components.

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/gem-table/GwToggle.test.ts` — unit tests for `getColumnVisibility` helper (PROJ-04)

*(vitest.config.ts exists, Vitest 4.1.2 installed, `@` alias configured — no framework setup gap.)*

---

## Open Questions

1. **`getColumnVisibility` — module location**
   - What we know: The derivation logic `{ proj_pts_1gw: horizon === 1, ... }` is three lines. It can live inline in GemTable.tsx, in GwToggle.tsx as an exported pure function, or in a separate utility file.
   - What's unclear: Whether the planner should prefer colocation with GwToggle.tsx or a separate lib file.
   - Recommendation: Export from `GwToggle.tsx` as a named export — colocation keeps the toggle and its derived state logic together, and matches how `getMinsRiskConfig` is colocated with `MinsRiskBadge`.

---

## Sources

### Primary (HIGH confidence)

- `node_modules/@tanstack/table-core/build/lib/features/ColumnVisibility.d.ts` — `VisibilityState` type definition, `columnVisibility` state key, `onColumnVisibilityChange` option signature
- `src/lib/types.ts` — `MergedPlayer` and `ScoredPlayer` confirming `proj_pts_1gw/3gw/5gw` are `number` (non-nullable)
- `src/components/gem-table/GemTable.tsx` — current `useReactTable` wiring, existing state shape
- `src/components/gem-table/columns.tsx` — current column array, insertion point for new columns
- `src/components/transfers/TransferPanel.tsx` — both suggestion loops confirmed, `SingleTransfer` type access
- `src/lib/transfer-engine.ts` — `SingleTransfer` interface confirming `.sell` and `.buy` are `ScoredPlayer`
- `.planning/phases/09-projected-points-columns/09-UI-SPEC.md` — approved design contract with verbatim class strings, copy, and accessibility requirements

### Secondary (MEDIUM confidence)

- `package.json` + `npm view @tanstack/react-table version` — confirmed 8.21.3 installed and current
- `vitest.config.ts` — confirmed `environment: 'node'`, informs test strategy

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from installed node_modules and npm registry
- Architecture: HIGH — UI-SPEC is prescriptive; patterns confirmed from source file inspection
- Pitfalls: HIGH — derived from reading actual code (not general knowledge)
- Validation: HIGH — vitest.config.ts and package.json confirmed; test strategy follows established project pattern

**Research date:** 2026-03-30
**Valid until:** 2026-04-30
