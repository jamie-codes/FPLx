# Phase 14: GemTable Mobile - Research

**Researched:** 2026-04-01
**Domain:** TanStack Table v8 column visibility, sticky CSS columns, expandable rows, Tailwind v4 responsive patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from STATE.md decisions)

### Locked Decisions
- CSS-only show/hide (`hidden sm:flex`, `sm:hidden`) for nav — no `useMediaQuery` hook; avoids hydration mismatch
- `sm` breakpoint (640px) chosen for mobile/desktop boundary — phones are <=480px, tablets get full desktop layout
- Tab state stays in page.tsx; MobileNav receives activeTab/onTabChange as props — no new context needed
- Column priority via TanStack Table VisibilityState — extends existing GW toggle pattern in GemTable
- MOB-TBL-05 split across Phase 14 (GemTable) and Phase 15 (SquadView) — same requirement, two components

### Claude's Discretion
- Expanded row panel layout (key-value pairs, grid vs list)
- Exact CSS approach for sticky first column (Tailwind utility vs custom class in globals.css)
- Whether to use `getExpandedRowModel` (TanStack) or simple React state (since subrows are not used)
- Whether expanded state resets when position filter changes
- Touch event disambiguation approach (tap on row body vs sort header)

### Deferred Ideas (OUT OF SCOPE)
- Expandable row detail for SquadView and DefConTables (GemTable priority only for v1.2 Phase 14)
- Column picker UI (user-selectable mobile columns)
- Native-style swipe-between-tabs gesture
- "Show top 50" filter pill for GemTable
- Progressive Web App manifest
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOB-TBL-01 | GemTable shows only Player, Position, Gem score, active Proj Pts column, Risk badge on mobile; remaining columns hidden | TanStack Table VisibilityState merged from GwToggle output + mobile column hide map; responsive via `isMobile` state or Tailwind class-based approach — but LOCKED decision mandates VisibilityState, not CSS class toggling |
| MOB-TBL-05 | Player column is horizontally sticky (locked to left) in GemTable on mobile when scrolling right | CSS `position: sticky; left: 0` on `<th>` and `<td>` in first column; requires `z-index` stacking and `background-color` to prevent bleed-through; the `overflow-x-auto` wrapper on the table already exists |
| MOB-TBL-06 | User taps a GemTable row on mobile to expand an inline key-value detail panel showing all MOB-TBL-01-hidden columns | TanStack Table `getExpandedRowModel` + `ExpandedState`; insert a full-colspan `<tr>` immediately after each expanded row; tap on row body toggles expansion; sort header taps must NOT trigger expansion |
</phase_requirements>

---

## Summary

Phase 14 adds three responsive features to GemTable: mobile column hiding, a sticky Player column, and tap-to-expand row detail. All three are self-contained within the `src/components/gem-table/` directory — no new packages are needed, and desktop behaviour is unchanged.

The column hiding work (MOB-TBL-01) extends the existing `getColumnVisibility`/`VisibilityState` pattern already used for the GW toggle. The function must be expanded to also apply mobile column visibility on top of the GW toggle logic. The critical constraint is that the mobile column map and the GW horizon map must be merged — not replace each other — because the active Proj Pts column must remain visible on mobile while all other non-priority columns are hidden.

The sticky Player column (MOB-TBL-05) is pure CSS: `position: sticky; left: 0` with an opaque background on the first `<th>` and every first `<td>`. The `overflow-x-auto` wrapper already exists in GemTable. The primary risk is z-index stacking with the sticky `<thead>` — the sticky column header cell needs a higher `z-index` than the sticky header row so it doesn't bleed behind the header when scrolling.

The expandable row (MOB-TBL-06) should use TanStack Table's built-in expanding feature (`getExpandedRowModel`, `ExpandedState`, `row.getIsExpanded()`, `row.getToggleExpandedHandler()`). The expansion renders as a full-colspan `<tr>` immediately after the data row containing a key-value grid. The tap target challenge is distinguishing a tap on a row (expand) from a tap on a sort header `<th>` (sort) — solved by putting the `onClick` on `<tr>` body rows only, not on `<thead>` rows.

**Primary recommendation:** Merge mobile visibility into the existing `getColumnVisibility` function by accepting an `isMobile` parameter. Implement sticky column entirely in CSS classes. Use TanStack Table's native expanding feature — do not build a parallel React state for expanded rows.

---

## Standard Stack

### Core (no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 | VisibilityState, ExpandedState, getExpandedRowModel | Already in project; v8 has native expanding feature |
| tailwindcss | 4.2.2 | `sm:` breakpoints, `sticky`, `z-index`, `left-0` utilities | Already in project; v4 |
| React | 19.2.4 | useState for expanded state wired to TanStack | Already in project |

### No new packages required

All three requirements (column hiding, sticky column, expandable row) are implementable with existing dependencies.

**Do not install** any third-party table plugin or sticky-column helper library — CSS `position: sticky` is the native browser approach and has no dependency cost.

---

## Architecture Patterns

### Recommended File Changes
```
src/components/gem-table/
├── GwToggle.tsx          # getColumnVisibility extended to accept isMobile param
├── GemTable.tsx          # useReactTable: add expanded state, getExpandedRowModel,
│                         #   getRowCanExpand; render expansion <tr>; wire isMobile
├── columns.tsx           # No changes needed — column IDs stay the same
└── PositionFilter.tsx    # No changes needed
src/app/globals.css       # Possibly: .gem-table-sticky-col class if Tailwind utility
                          #   insufficient for z-index stacking
```

### Pattern 1: Merged VisibilityState for Mobile + GW Toggle

The existing `getColumnVisibility` returns only the three Proj Pts columns. To add mobile hiding, extend it to accept an `isMobile` boolean and merge a mobile column map:

```typescript
// Source: verified from GwToggle.tsx (project code) + TanStack Table VisibilityState docs
const MOBILE_HIDDEN_COLUMNS: Record<string, boolean> = {
  team_short_name: false,
  now_cost: false,
  fdr_score: false,
  form_score: false,
  xg_per90: false,
  xa_per90: false,
  xg_score: false,
  xa_score: false,
  ownership_score: false,
  minutes_score: false,
  set_piece_score: false,
  selected_by_percent: false,
  status: false,
  trend: false,
  fixtures: false,
}

// Columns always visible on mobile (regardless of GW toggle):
// web_name (Player), element_type (Pos), gem_score (Gem), mins_risk (Risk)
// + whichever proj_pts_Ngw is active (controlled by GW toggle)

export function getColumnVisibility(
  horizon: 1 | 3 | 5,
  isMobile: boolean
): VisibilityState {
  const gwVisibility = {
    proj_pts_1gw: horizon === 1,
    proj_pts_3gw: horizon === 3,
    proj_pts_5gw: horizon === 5,
  }
  if (!isMobile) return gwVisibility
  return { ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }
}
```

**Important:** The GW toggle state still controls which Proj Pts column is shown. On mobile, all three Proj Pts columns are in `MOBILE_HIDDEN_COLUMNS` as `false`, but the `gwVisibility` spread overrides the active one to `true`. This merge is the key correctness point.

**How to detect mobile:** Do NOT use `useMediaQuery` (locked decision: hydration mismatch risk). Use `useState(false)` with a `useEffect` that checks `window.innerWidth < 640` and/or listens to a `resize` event. Because `columnVisibility` is a derived value (not stored in state), this is safe — the component re-renders when `isMobile` changes and the table recalculates visibility.

Alternatively, expose column IDs from all hidden columns and use Tailwind `hidden sm:table-cell` on `<td>` elements — but this conflicts with the VisibilityState approach (locked decision) and would require changes to `columns.tsx` cell renderers. The `useEffect` + state approach is cleaner.

### Pattern 2: Sticky First Column (CSS-only)

The `overflow-x-auto` wrapper already exists in `GemTable.tsx`. Sticky column is achieved with CSS classes on the first `<th>` and all first `<td>` cells:

```tsx
// Source: MDN position:sticky specification, verified in CSS Working Group spec
// Apply to first <th>:
className="sticky left-0 z-20 bg-white ..."

// Apply to first <td> in each data row:
className="sticky left-0 z-10 bg-white ..."

// Apply to first <th> in sticky thead row:
// thead is sticky top-0 (z-index needs to be >= z-10 for header row)
// The first-column th in the sticky header needs z-30 so it floats above
// both the sticky header row and the sticky column cells
className="sticky left-0 top-0 z-30 bg-white ..."
```

**Z-index stacking requirement (critical):**
- Regular sticky column `<td>` cells: `z-10`
- Sticky header `<th>` (non-first-column): `z-20` (existing `sticky top-0`)
- First-column sticky header `<th>` (sticky in BOTH x and y): `z-30`

Without `z-30` on the first header cell, scrolling right will show data cells bleeding behind the header. Without `z-10` on `<td>` cells, row content scrolling left will bleed over the sticky Player column.

**Background requirement:** The sticky cells must have an opaque background (`bg-white` or equivalent). Without it, table content scrolling horizontally is visible through the cell. On even rows (`even:bg-gray-50`), the sticky `<td>` needs to match — either repeat the even/odd class logic or use `bg-inherit` with an explicit background on the `<tr>`.

**Applying to the first column only:** In TanStack Table v8, when iterating `row.getVisibleCells()`, the first visible cell corresponds to the first visible column. Since `web_name` (Player) is always the first column in `columns.tsx` and is never hidden, `cell.column.id === 'web_name'` is a safe conditional for applying sticky classes.

### Pattern 3: Expandable Row with TanStack Table v8

TanStack Table's native expanding feature manages expand/collapse state. The expanded state is stored in `GemTable` component state and fed back into `useReactTable`.

```typescript
// Source: node_modules/@tanstack/table-core/build/lib/features/RowExpanding.d.ts (verified)
import {
  getExpandedRowModel,
  type ExpandedState,
} from '@tanstack/react-table'

// In GemTable component:
const [expanded, setExpanded] = useState<ExpandedState>({})

const table = useReactTable({
  // ... existing options
  state: { sorting, columnFilters, columnVisibility, expanded },
  onExpandedChange: setExpanded,
  getExpandedRowModel: getExpandedRowModel(),
  getRowCanExpand: () => true,  // all rows expandable
})
```

**Rendering the expanded row:**

```tsx
// Source: TanStack Table v8 expand guide pattern
{table.getRowModel().rows.map((row) => (
  <Fragment key={row.id}>
    <tr
      onClick={() => row.toggleExpanded()}
      className="even:bg-gray-50 hover:bg-blue-50 sm:cursor-default cursor-pointer"
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} ...>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
    {row.getIsExpanded() && (
      <tr className="sm:hidden bg-blue-50">
        <td colSpan={row.getVisibleCells().length} className="px-3 py-2">
          {/* Key-value grid of hidden columns */}
        </td>
      </tr>
    )}
  </Fragment>
))}
```

**The `sm:hidden` on the expansion `<tr>` ensures the expanded detail row never renders on desktop** — addressing the "Desktop GemTable behaviour unchanged" success criterion without any conditional logic in React.

**Fragment key requirement:** Import `Fragment` from React and use `<Fragment key={row.id}>` wrapping both the data row and the expansion row. This is the same pattern already validated in Phase 13 (SquadView key prop fix).

### Pattern 4: Tap-to-Expand vs Sort Header Disambiguation

The `onClick={row.toggleExpanded()}` is placed on `<tr>` in `<tbody>`. Sort headers live in `<thead>`. These are separate DOM elements — there is no accidental conflict. The sort header `onClick` is on `<th>` elements in `<thead>`, and the row expand `onClick` is on `<tr>` elements in `<tbody>`.

**One edge case to handle:** If a user taps a `<td>` cell that contains an interactive element (e.g., future badge, link), the `onClick` will bubble up to the `<tr>` and trigger expansion. For Phase 14, all GemTable cells are read-only rendered values — no interactive children — so bubbling is safe.

**Mobile-only expansion:** Add `sm:cursor-default sm:pointer-events-none` to the `<tr>` to disable the tap handler on desktop, OR check `!isMobile` inside `onClick`. The `sm:pointer-events-none` Tailwind class is cleaner since it requires no JavaScript branching.

### Anti-Patterns to Avoid

- **Using CSS `display: none` on `<td>` cells to hide columns:** This bypasses TanStack Table's `getVisibleCells()` model and causes column count mismatches when computing `colSpan` for the expanded detail row. Always use VisibilityState.
- **Using `useMediaQuery` for `isMobile`:** Locked decision against this (hydration mismatch). Use `useEffect` + `useState`.
- **Setting `background: transparent` on sticky cells:** Defeats the purpose — scrolled content will bleed through. Always set an opaque background.
- **Forgetting `z-index` layers on the sticky corner cell (first-column header):** Causes visual corruption where the header row and sticky column overlap with no clear winner.
- **Putting `onClick` on `<thead> <tr>` as well as `<tbody> <tr>`:** Would trigger expand on header tap. Only `<tbody>` rows get the expand handler.
- **Mutating `MOBILE_HIDDEN_COLUMNS` object at runtime:** It is a static constant. The merge via spread `{ ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }` creates a new object each call — this is correct and intentional.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expand/collapse state tracking | Custom `expandedRows: Set<string>` in useState | TanStack Table `ExpandedState` + `onExpandedChange` | TanStack handles reset on data change, filter change, and provides `row.getIsExpanded()`, `row.toggleExpanded()` for free |
| Column count for `colSpan` | Manually counting visible columns | `row.getVisibleCells().length` | TanStack already knows how many columns are visible after VisibilityState is applied |
| Media query detection | `useMediaQuery` hook | `useEffect` + `useState` checking `window.innerWidth` | Locked decision — useMediaQuery causes hydration mismatch |
| Sticky column scroll detection | JavaScript `scroll` event + manual offset tracking | CSS `position: sticky; left: 0` | Pure CSS handles all scroll positions without JS overhead |

---

## Common Pitfalls

### Pitfall 1: Z-index Collision Between Sticky Header Row and Sticky First Column

**What goes wrong:** The `<thead>` row uses `sticky top-0`. The first column `<th>` uses `sticky left-0`. When the user scrolls both horizontally and vertically, the corner cell is "sticky in two axes" — if z-index is not explicitly higher than both the header row and the column cells, one will bleed through the other.

**Why it happens:** `position: sticky` creates a new stacking context. The browser computes z-index within the table's stacking context. Without explicit z-index, the DOM order determines which paints on top.

**How to avoid:** Apply `z-30` to the corner cell (first `<th>` in the sticky header), `z-20` to all other sticky header `<th>` cells, `z-10` to sticky column `<td>` cells.

**Warning signs:** At large screen + many columns, you see header text from non-sticky columns showing through the Player column cell as you scroll right.

### Pitfall 2: Background Color Mismatch on Sticky Column Cells

**What goes wrong:** GemTable uses `even:bg-gray-50` on `<tr>`. Sticky `<td>` cells inherit the row background. But if the sticky `<td>` has `bg-white` hardcoded, even rows will show a white sticky cell against a gray row background.

**Why it happens:** CSS class specificity — an explicit `bg-white` on `<td>` overrides the `even:bg-gray-50` on `<tr>`.

**How to avoid:** Do NOT add a static `bg-white` to all sticky `<td>` cells. Instead, make the background adaptive: add `even:bg-gray-50 bg-white` to the sticky `<td>` itself (so it mirrors the row pattern), or use CSS variable / `bg-inherit` with a known parent background. The simplest reliable approach is to explicitly replicate the row's background logic on the sticky cell: `className="... bg-white even:bg-gray-50"` — but the `even:` pseudo-class applies to the `<tr>`, not the `<td>`, so this won't work directly. The working pattern is to use JS to conditionally apply the background based on row index parity, or use a CSS approach like `background: inherit` on the `<td>` and ensure the parent `<tr>` has `background-color` set (not just a class).

**Pragmatic solution:** Give the sticky `<td>` a `bg-white` class AND give the expanded `<tr>` (detail row) its own explicit background. Accept that even-row sticky cells will be white instead of gray — this is a minor visual inconsistency, not a defect.

**Warning signs:** The Player column cell color doesn't match the rest of its row on alternating rows.

### Pitfall 3: `getColumnVisibility` Merge Overwrites Active Proj Pts Column

**What goes wrong:** If the mobile column map includes `proj_pts_1gw: false`, `proj_pts_3gw: false`, `proj_pts_5gw: false` AND the spread order is wrong (`{ ...gwVisibility, ...MOBILE_HIDDEN_COLUMNS }`), the active Proj Pts column gets hidden on mobile even though it should be visible.

**Why it happens:** Spread order — the last spread wins. The GW visibility (`proj_pts_1gw: true`) must be spread AFTER the mobile hidden map so it overrides the `false` value.

**How to avoid:** Always merge as `{ ...MOBILE_HIDDEN_COLUMNS, ...gwVisibility }` — GW visibility wins over the mobile defaults.

**Warning signs:** On mobile, none of the Proj Pts columns appear even when a GW horizon is selected.

### Pitfall 4: `colSpan` Mismatch in Expanded Detail Row

**What goes wrong:** If `colSpan` is hardcoded to a fixed number (e.g., 21 for "all columns"), and the GW toggle changes which Proj Pts column is visible (changing visible column count), the expanded row doesn't span the full table width. Or on mobile where only 5 columns are visible, `colSpan=21` causes layout issues.

**How to avoid:** Use `row.getVisibleCells().length` as the `colSpan` value — it reflects the current visible column count after VisibilityState is applied.

### Pitfall 5: GwToggle Tests Break After Signature Change

**What goes wrong:** `GwToggle.test.ts` imports `getColumnVisibility` and tests it with `(horizon)` — one argument. After extending the signature to `(horizon, isMobile)`, the existing tests will still pass (second arg defaults to `false` or is `undefined`) only if the function handles the missing second arg gracefully.

**How to avoid:** Give `isMobile` a default value of `false` in the function signature: `function getColumnVisibility(horizon: 1 | 3 | 5, isMobile = false)`. Existing tests continue to work. Add new tests for the mobile=true case.

---

## Code Examples

### Full Column ID Reference (from columns.tsx — verified)

Columns that must be VISIBLE on mobile (MOB-TBL-01):
- `web_name` — Player name
- `element_type` — Position
- `gem_score` — Gem score
- `mins_risk` — Risk badge (display column, id: `'mins_risk'`)
- `proj_pts_1gw` / `proj_pts_3gw` / `proj_pts_5gw` — one active (controlled by GW toggle)

Columns that must be HIDDEN on mobile (MOB-TBL-01):
- `team_short_name`, `now_cost`, `fdr_score`, `form_score`
- `xg_per90`, `xa_per90`, `xg_score`, `xa_score`
- `ownership_score`, `minutes_score`, `set_piece_score`, `selected_by_percent`
- `status`, `trend`, `fixtures`

These hidden columns are the "all columns hidden by MOB-TBL-01" that must appear in the MOB-TBL-06 expanded detail panel.

### Detect isMobile Without useMediaQuery

```typescript
// Source: React docs useEffect pattern; avoids SSR/hydration mismatch
// (verified: locked decision prohibits useMediaQuery)
const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 640)
  check()
  window.addEventListener('resize', check)
  return () => window.removeEventListener('resize', check)
}, [])
```

This initialises to `false` (desktop) on the server, then corrects to the actual value after hydration. Because VisibilityState is a derived value (not persisted), the table re-renders correctly once `isMobile` is set.

### Key-Value Detail Panel Layout

```tsx
// Source: pattern synthesised from project conventions
// The detail panel shows columns hidden by MOB-TBL-01 as labelled key-value pairs
const HIDDEN_COLUMN_LABELS: Record<string, string> = {
  team_short_name: 'Team',
  now_cost: 'Price',
  fdr_score: 'FDR',
  form_score: 'Form',
  xg_per90: 'xG/90',
  xa_per90: 'xA/90',
  xg_score: 'xG Score',
  xa_score: 'xA Score',
  ownership_score: 'Own Score',
  minutes_score: 'Minutes',
  set_piece_score: 'Set Piece',
  selected_by_percent: 'Owned %',
  status: 'Status',
  trend: 'Price Trend',
  fixtures: 'Next 5',
}

// In the expanded <tr>:
<td colSpan={row.getVisibleCells().length} className="px-3 py-3">
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
    {row.getAllCells()
      .filter(cell => HIDDEN_COLUMN_LABELS[cell.column.id])
      .map(cell => (
        <div key={cell.column.id} className="flex gap-1">
          <dt className="text-gray-500 shrink-0">
            {HIDDEN_COLUMN_LABELS[cell.column.id]}:
          </dt>
          <dd className="font-medium">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </dd>
        </div>
      ))
    }
  </dl>
</td>
```

**Note:** Use `row.getAllCells()` (not `row.getVisibleCells()`) to access the currently hidden cells for rendering in the detail panel.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS-based sticky columns (scroll listeners, absolute positioning) | CSS `position: sticky` | CSS WG 2017, broad browser support by 2019 | No JavaScript needed for sticky columns |
| Custom expand state (`useState<Set<string>>`) | TanStack Table `ExpandedState` + `getExpandedRowModel` | TanStack Table v8 (2022) | Expand state integrates with row model lifecycle |
| Separate mobile component | Responsive CSS on single component | Phase 13 locked decision | Simpler, no duplication, same URL |

---

## Open Questions

1. **Should expanded state reset when the position filter changes?**
   - What we know: TanStack Table has `autoResetExpanded` option (defaults behavior depends on version)
   - What's unclear: Whether a player expanded in "All" position view should stay expanded when filtering to "MID"
   - Recommendation: Set `autoResetExpanded: false` — the user explicitly tapped to expand; respect that intent. The expanded row will simply not appear if filtered out.

2. **Should only one row be expanded at a time (accordion), or can multiple rows be expanded simultaneously?**
   - What we know: TanStack Table's `ExpandedState` supports any number of expanded rows simultaneously
   - What's unclear: UX preference not specified in requirements
   - Recommendation: Allow multiple expanded rows — simpler implementation, no extra logic. Users comparing two players can expand both.

3. **Expand arrow/chevron indicator on mobile rows**
   - What we know: Requirements don't mention a visual indicator; they say "tapping a row"
   - What's unclear: Whether a chevron or "+" indicator should be added to the row for discoverability
   - Recommendation: Add a simple `▾`/`▸` indicator as the last visible cell on mobile only (could be a display column with `sm:hidden`). This makes the expandable behaviour discoverable.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is code/CSS changes only within the existing project stack).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (verified from vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOB-TBL-01 | `getColumnVisibility(1, true)` hides all non-priority columns and keeps `proj_pts_1gw` visible | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | ✅ (extend existing) |
| MOB-TBL-01 | `getColumnVisibility(3, true)` hides all non-priority columns and keeps `proj_pts_3gw` visible | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | ✅ (extend existing) |
| MOB-TBL-01 | `getColumnVisibility(1, false)` returns unchanged desktop behaviour (same as current tests) | unit | `npx vitest run src/components/gem-table/GwToggle.test.ts` | ✅ (existing, must not break) |
| MOB-TBL-05 | Sticky CSS classes applied — visual only | manual-only | n/a | n/a — CSS correctness requires browser |
| MOB-TBL-06 | Expand state toggling — UI behaviour | manual-only | n/a | n/a — requires browser/JSDOM |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- None — the existing `GwToggle.test.ts` covers MOB-TBL-01's unit-testable logic. New test cases for `isMobile=true` should be added to the existing file, not a new file.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@tanstack/table-core/build/lib/features/RowExpanding.d.ts` — complete ExpandedState, ExpandedRow, ExpandedOptions, ExpandedInstance types verified directly
- `src/components/gem-table/GemTable.tsx` — existing component structure verified directly
- `src/components/gem-table/columns.tsx` — all 21 column IDs and definitions verified directly
- `src/components/gem-table/GwToggle.tsx` — existing `getColumnVisibility` signature and pattern verified directly
- `src/components/gem-table/GwToggle.test.ts` — existing test structure verified directly
- `vitest.config.ts` — test framework and config verified directly
- `.planning/phases/13-navigation-layout-foundations/13-02-SUMMARY.md` — Phase 13 outcomes, patterns established, decisions made

### Secondary (MEDIUM confidence)
- MDN CSS position:sticky specification — z-index stacking behaviour for sticky table headers/columns is well-documented browser behaviour; cross-referenced against known pitfalls

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified directly from node_modules and source files
- Architecture: HIGH — column IDs, TanStack API, and existing patterns all verified from source
- Pitfalls: HIGH — z-index stacking and background colour issues are well-known CSS sticky column gotchas, background colour merge issue verified by reading actual code
- Test map: HIGH — vitest config and existing test file verified directly

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable — TanStack Table v8 and Tailwind v4, no breaking changes expected within 30 days)
