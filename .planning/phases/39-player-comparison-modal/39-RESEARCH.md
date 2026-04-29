# Phase 39: Player Comparison Modal - Research

**Researched:** 2026-04-29
**Domain:** React UI — native dialog modal, TanStack Table row interaction, Tailwind responsive layout
**Confidence:** HIGH

## Summary

Phase 39 adds a player comparison modal to the GemTable. All data exists on the `ScoredPlayer` type already; all badge components already exist and are drop-in reusable. The work is purely client-side UI composition — no new API routes, no new hooks, no pipeline changes. The most complex decisions are the row-level trigger mechanism (hover-reveal on desktop, tap action-sheet on mobile) and the two-column vs stacked layout split across breakpoints.

The canonical pattern for this phase is `PlayerPickerModal.tsx` — a native `<dialog>` with `useRef<HTMLDialogElement>`, `showModal()`/`close()`, backdrop click via `e.target === ref.current`, and Escape key sync via the `close` event listener. The comparison modal extends this shell with static Player A data and a live-updating Player B search field. All reusable pieces (badges, `FixtureBadges`, `XPtsCell`, `fmtScore`) already exist and require zero modification.

The integration touch points are: (a) the `web_name` cell renderer in `columns.tsx` gains an `onCompare` callback-driven hover icon, (b) `GemTable.tsx` threads an `onCompare` prop through to columns, (c) `page.tsx` holds `comparePlayer` state and renders the new `PlayerComparisonModal`.

**Primary recommendation:** One plan (two waves) — Wave 1: modal shell + player B search + four data sections. Wave 2: row trigger (hover icon + mobile action sheet) + page.tsx wiring + tests.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Compare icon is hover-revealed on the Player name cell on desktop — small icon appears on row hover. No extra column. No permanent layout shift.
- **D-02:** On mobile (no hover), tapping the player name reveals a mini action sheet with a "Compare" option.
- **D-03:** Player B selected via search field inside the comparison modal — modal opens with Player A data and a search input. Reuses name-search pattern from `PlayerPickerModal`.
- **D-04:** Player B search shows all players, no position filter.
- **D-05:** Desktop layout: two columns side by side (A | B). Each data section spans full modal width with Player A left, Player B right.
- **D-06:** Mobile layout: single scrollable column — Player A block then Player B block stacked vertically.
- **D-07:** Modal uses native `<dialog>` element (same as `PlayerPickerModal`) — `useRef<HTMLDialogElement>`, `showModal()`/`close()`, backdrop click to dismiss, Escape key sync via `close` event listener.
- **D-08:** Section order: xPts Projection → Gem Scores → Fixtures → Signals.
- **D-09:** No winner highlighting — raw numbers only.
- **D-10:** xPts section shows: `xPts_1gw`, `xPts_3gw`, `xPts_5gw`, and `xPts_90th_1gw` (ceiling) for each player. `VarianceBadge` reused to show ceiling flag.
- **D-11:** Gem section shows: composite `gem_score` plus all 7 component scores (`fdr_score`, `form_score`, `xg_score`, `xa_score`, `ownership_score`, `minutes_score`, `set_piece_score`). Displayed as 0–100 integers (same `fmtScore` convention as GemTable columns).
- **D-12:** Fixtures section reuses existing `FixtureBadges` component to render next-5 fixtures.
- **D-13:** Signals section reuses `RegressionSignalBadge`, `DifferentialBadge`, and `MinsRiskBadge`.

### Claude's Discretion

- Modal max width/height — follow `PlayerPickerModal` convention (`max-w-md`, `max-h-[70vh]`) but can be wider for more content (`max-w-2xl` or similar).
- Whether to animate Player B update (fade/slide) when user selects a second player, or update instantly.
- Exact heading structure within each section (section dividers, label alignment).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMP-01 | User can open a player comparison modal from any GemTable row via a compare icon on that row | Hover-reveal icon on `web_name` cell (D-01); mobile action sheet on tap (D-02); `onCompare` callback from `columns.tsx` |
| CMP-02 | Comparison modal lets user pick a second player to compare against (search from full player list) | Search field inside modal mirroring `PlayerPickerModal` pattern (D-03/D-04); `ScoredPlayer[]` passed from `page.tsx` |
| CMP-03 | Comparison modal shows xPts projection (1GW / 3GW / 5GW + 90th-percentile ceiling) side by side | `xPts_1gw`, `xPts_3gw`, `xPts_5gw`, `xPts_90th_1gw` from `ScoredPlayer`; reuse `VarianceBadge` + `fmtScore` (D-10) |
| CMP-04 | Comparison modal shows Gem score breakdown (all 7 component scores) for each player side by side | `gem_score` + 7 component scores on `ScoredPlayer`; `fmtScore` helper from `columns.tsx` (D-11) |
| CMP-05 | Comparison modal shows next 5 fixtures with colour-coded difficulty for each player | `FixtureBadges` component drop-in reuse; `fixtures.slice(0,5)` from `ScoredPlayer` (D-12) |
| CMP-06 | Comparison modal shows BUY/SELL regression signal, DIFF/TRAP flag, and rotation risk badge for each player | `RegressionSignalBadge`, `DifferentialBadge`, `MinsRiskBadge` — all drop-in reusable (D-13) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modal state (open/comparePlayer) | Frontend (page.tsx) | — | Same pattern as `gemPreset` state — lifted to page so modal overlays entire app, not just GemTable |
| Compare icon trigger (desktop hover) | Frontend (columns.tsx) | GemTable.tsx (callback threading) | Icon lives in `web_name` cell renderer; callback props flow up |
| Mobile action sheet trigger | Frontend (GemTable.tsx row onClick) | columns.tsx | Row-level tap already handled in GemTable; action sheet is a conditional overlay |
| Player B search + filtering | Frontend (PlayerComparisonModal.tsx) | — | Client-side filter of `ScoredPlayer[]` prop; no server call |
| Data display sections | Frontend (PlayerComparisonModal.tsx) | Reusable badge components | All data on `ScoredPlayer`; badges are purely presentational |
| Player data source | Existing hook (usePlayers + computeAllGemScores) | — | TanStack Query deduplicates; `ScoredPlayer[]` passed as prop from page.tsx |

---

## Standard Stack

### Core (all already installed) [VERIFIED: package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | `useState`, `useRef`, `useEffect` for modal lifecycle | Project-wide |
| Next.js | 16.2.1 | App Router; `'use client'` directive required for interactive components | Project framework |
| Tailwind CSS | ^4 | All styling; dark mode via `dark:` variants | Project-wide, no inline styles except `fontSize: '16px'` on inputs |
| @tanstack/react-table | ^8.21.3 | Column definition for `web_name` cell renderer customisation | Existing GemTable infrastructure |
| @tanstack/react-query | ^5.95.2 | `usePlayers()` — TanStack Query deduplicates if modal calls it directly | Existing data layer |
| Vitest | ^4.1.2 | Unit/component tests | Project-wide |
| @testing-library/react | ^16.3.2 | RTL component tests | Project-wide |

### No New Dependencies

This phase introduces zero new npm packages. All needed UI primitives are built-in (native `<dialog>`) or already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx
  ├── [comparePlayer state: ScoredPlayer | null]
  ├── [compareOpen state: boolean]
  ├── GemTable (preset, onPresetChange, onCompare)
  │     ├── columns.tsx (web_name cell)
  │     │     └── hover → compare icon → onCompare(player) callback
  │     └── row onClick (mobile) → action sheet → onCompare(player)
  └── PlayerComparisonModal
        ├── open, playerA: ScoredPlayer, scoredPlayers: ScoredPlayer[]
        ├── [search state]  [playerB state: ScoredPlayer | null]
        ├── <dialog ref> showModal() / close() / backdrop / Escape
        ├── Search input (auto-focus, filters scoredPlayers)
        ├── Section: xPts (playerA | playerB)  [D-10]
        ├── Section: Gem Scores (playerA | playerB)  [D-11]
        ├── Section: Fixtures (playerA | playerB)  [D-12]
        └── Section: Signals (playerA | playerB)  [D-13]
```

### Recommended Project Structure

```
src/
├── components/
│   └── gem-table/
│       ├── PlayerComparisonModal.tsx   # NEW — native <dialog> modal
│       ├── columns.tsx                 # MODIFIED — hover icon in web_name cell
│       └── GemTable.tsx               # MODIFIED — onCompare prop threading
└── app/
    └── page.tsx                        # MODIFIED — comparePlayer state + modal mount
```

### Pattern 1: Native `<dialog>` Modal Shell (mirror of PlayerPickerModal)

**What:** Use the browser's native `<dialog>` element with React `useRef`. Control open/close imperatively via `showModal()`/`close()`. Sync React state from native Escape key via the `close` DOM event.

**When to use:** Any modal in this codebase. Do not introduce Radix Dialog, Headless UI, or any other modal library. [VERIFIED: PlayerPickerModal.tsx canonical pattern; CONTEXT.md § Code Context]

**Example (from PlayerPickerModal.tsx):**

```tsx
// Source: src/components/planner/PlayerPickerModal.tsx
const dialogRef = useRef<HTMLDialogElement>(null)

// Open/close
useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  if (open) { if (!el.open) el.showModal() }
  else { if (el.open) el.close() }
}, [open])

// Auto-focus input on open
useEffect(() => {
  if (open) {
    const timer = setTimeout(() => { searchRef.current?.focus() }, 50)
    return () => clearTimeout(timer)
  }
}, [open])

// Reset search on close
useEffect(() => {
  if (!open) setSearch('')
}, [open])

// Escape key sync
useEffect(() => {
  const el = dialogRef.current
  if (!el) return
  const handleClose = () => onClose()
  el.addEventListener('close', handleClose)
  return () => el.removeEventListener('close', handleClose)
}, [onClose])

// Backdrop click to dismiss
const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
  if (e.target === dialogRef.current) onClose()
}

return (
  <dialog
    ref={dialogRef}
    onClick={handleDialogClick}
    className="rounded-lg bg-white dark:bg-zinc-900 p-4 max-w-md w-full max-h-[70vh] flex flex-col ..."
  >
    ...
  </dialog>
)
```

### Pattern 2: Hover-Reveal Icon in TanStack Table Cell

**What:** The `web_name` column cell renderer renders the player name with an absolutely-positioned or `opacity-0 group-hover:opacity-100` compare icon. The icon's click fires `onCompare(player)` without propagating to the row's sort/expand handlers.

**When to use:** Desktop compare trigger. Icon must not cause layout shift (D-01). Use CSS `group` hover on the `<td>` parent or a wrapper `<div>`.

**Constraint:** TanStack column definitions in `columns.tsx` are currently static — they don't accept callbacks. The `onCompare` callback must be threaded through. Two approaches:

- **Option A (prop drilling):** Export `createColumns(onCompare)` factory from `columns.tsx`. `GemTable` calls it with the callback. This is the simplest approach and matches how `PlayerPickerModal` gets `onPick`.
- **Option B (React context):** Create a `GemTableContext` and provide `onCompare` through context. More indirection but avoids touching column creation call sites.

**Recommendation (Claude's discretion):** Option A — factory function. Simpler, explicit, zero new context infrastructure. [ASSUMED — either works; Option A is lower complexity]

**Example:**

```tsx
// columns.tsx
export function createColumns(onCompare: (player: ScoredPlayer) => void) {
  return [
    col.display({
      id: 'web_name',
      header: 'Player',
      cell: ({ row }) => (
        <div className="relative group/name flex items-center gap-1">
          <span>{row.original.web_name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCompare(row.original) }}
            className="opacity-0 group-hover/name:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1 text-xs cursor-pointer"
            aria-label={`Compare ${row.original.web_name}`}
          >
            ⊞
          </button>
        </div>
      ),
    }),
    // ... rest of columns
  ]
}
```

**Critical Pitfall:** `col.accessor('web_name', ...)` currently sorts by the accessor key. Converting to `col.display` loses the TanStack auto-accessor sort. Solution: keep `enableSorting: true` and provide a manual `sortingFn` or convert the column to `col.accessor` with a custom `cell` renderer while keeping the accessor. [VERIFIED: TanStack Table v8 allows custom `cell` on `accessor` columns]

```tsx
col.accessor('web_name', {
  header: 'Player',
  enableSorting: true,
  cell: ({ row }) => (
    <div className="relative group/name flex items-center gap-1">
      <span>{row.original.web_name}</span>
      <button type="button" onClick={...} className="opacity-0 group-hover/name:opacity-100 ...">⊞</button>
    </div>
  ),
})
```

### Pattern 3: Mobile Action Sheet (tap player name)

**What:** On mobile, the row's `onClick` already calls `row.toggleExpanded()`. The action sheet is a conditional element inside the expanded row panel OR a separate `useState`-controlled overlay triggered from a tap on the player name cell.

**Recommended approach:** The player name cell on mobile gets a `<button>` tap target that calls a new `onMobileCompare` prop (or the same `onCompare`). This shows a small action sheet `<div>` positioned below the row with "Compare" as the primary action. The action sheet is controlled by local `useState` in GemTable.

**Constraint:** The existing mobile `onClick` on `<tr>` toggles expanded state. The player name tap must `e.stopPropagation()` to prevent the row from expanding when the user means to compare.

**Alternative:** Replace `row.toggleExpanded()` on mobile with a proper action sheet that includes both "Expand details" and "Compare" options. This is a UX improvement but is more scope than D-02 specifies — keep it simple per D-02: "Compare" as the primary action, dismiss on outside tap.

### Pattern 4: Two-Column / Stacked Responsive Layout

**What:** The comparison modal uses CSS Grid with `sm:grid-cols-2` for desktop (two columns side by side) and single-column stacking on mobile. Each data section has a full-width label row and then Player A and Player B values in their respective columns.

**Example structure:**

```tsx
{/* Section header — full width */}
<h3 className="col-span-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b ...">
  xPts Projection
</h3>
{/* Player A column */}
<div className="...">
  {/* A values */}
</div>
{/* Player B column */}
<div className="...">
  {/* B values — or placeholder */}
</div>
```

**Tailwind classes for responsive two-column:**

```
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

Section dividers span both columns using `col-span-2` (or `sm:col-span-2` if using CSS grid).

### Pattern 5: `fmtScore` Helper

**What:** Converts 0.0–1.0 score to a 0–100 integer string. Currently defined in `columns.tsx` as a module-private const.

```tsx
const fmtScore = (v: number) => (v * 100).toFixed(0)
const fmtScoreNull = (v: number | null) => (v === null ? '—' : (v * 100).toFixed(0))
```

**Decision:** Either export `fmtScore` from `columns.tsx` and import it in the comparison modal, or copy it as a local const in the modal file. Exporting is cleaner — the comparison modal is within the same `gem-table/` directory.

### Anti-Patterns to Avoid

- **Introducing a modal library:** No Radix Dialog, no Headless UI. Native `<dialog>` only.
- **Putting `comparePlayer` state in GemTable:** State must live in `page.tsx` so the modal overlays the full app. GemTable only receives `onCompare` callback.
- **Calling `usePlayers()` inside the modal to get `scoredPlayers`:** While TanStack Query deduplicates, the cleaner pattern is to receive `scoredPlayers` as a prop passed from `page.tsx` (which already has it from the `<GemTable>` render chain). [ASSUMED — either works, prop preferred for explicit data flow]
- **Position-filtering Player B search:** D-04 explicitly requires no position filter.
- **Adding winner highlighting:** D-09 prohibits bold/badge/row-highlight for "winning" values.
- **Creating an extra column for the compare icon:** D-01 prohibits this. The icon lives in the `web_name` cell, revealed on hover.
- **Using CSS `hover:` on `<tr>` for icon reveal:** `group-hover` on the `<td>` or cell wrapper `<div>` is more reliable in tables; `<tr>` hover can cause issues with sticky columns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal trap/escape | Custom key handler | Native `<dialog>` `showModal()` | Browser handles focus trap, Escape key, backdrop natively |
| Fixture colour-coding | Custom badge | `FixtureBadges` component | Already implements DGW detection, difficulty tier colouring |
| Buy/sell signal badge | Custom pill | `RegressionSignalBadge` | Consistent visual language, tooltips already wired |
| Diff/trap flag badge | Custom pill | `DifferentialBadge` | Consistent visual language, ownership tooltip wired |
| Rotation risk badge | Custom pill | `MinsRiskBadge` | Consistent visual language, four-tier classification |
| Score formatting | Custom formatter | `fmtScore` from `columns.tsx` | 0–100 integer convention already established |
| xPts with ceiling badge | Custom cell | `XPtsCell` from `columns.tsx` | Already handles undefined/null/negative, variance badge, tooltip |
| Player data | New API route | `usePlayers()` + `computeAllGemScores()` | All data exists; TanStack Query caches it |

**Key insight:** Every data field and every display component already exists. This phase is composition only.

---

## Common Pitfalls

### Pitfall 1: `col.accessor` vs `col.display` — sorting regression

**What goes wrong:** Converting the `web_name` column from `col.accessor('web_name', ...)` to `col.display(...)` in order to add the icon would break TanStack Table's automatic sorting by `web_name`.

**Why it happens:** `col.display` columns have no accessor, so `enableSorting` doesn't know what value to sort on.

**How to avoid:** Keep `col.accessor('web_name', ...)` and add a custom `cell` renderer. The accessor still provides the sort value; the cell renders whatever JSX you want.

**Warning signs:** Sort arrow disappears or clicking the Player column header does nothing.

### Pitfall 2: `onCompare` callback identity and `useMemo` / `useCallback`

**What goes wrong:** If `onCompare` is defined as an inline arrow function in `page.tsx`, a new function reference is created on every render, causing `columns` (from `createColumns(onCompare)`) to be recreated on every render, which defeats TanStack Table's column memoisation.

**Why it happens:** `createColumns(onCompare)` called in `useMemo` will depend on `onCompare` — if `onCompare` is not stable, the columns array rebuilds every render.

**How to avoid:** Wrap `onCompare` in `useCallback` in `page.tsx`. Wrap `createColumns(onCompare)` in `useMemo([onCompare])` in `GemTable`.

**Warning signs:** Table re-renders on every keystroke in an unrelated input.

### Pitfall 3: `e.stopPropagation()` on mobile — conflicting with row expand

**What goes wrong:** On mobile, `<tr onClick={() => row.toggleExpanded()}>` handles row taps. If the compare button inside the player name cell does not `stopPropagation`, clicking Compare also expands the row, causing unexpected UX.

**Why it happens:** Click events bubble from the inner button up to the `<tr>` onClick handler.

**How to avoid:** Always `e.stopPropagation()` on the compare button/icon click handler.

**Warning signs:** Row expands when user taps the compare icon; expanded detail panel appears below the row unexpectedly.

### Pitfall 4: `<dialog>` double-open guard

**What goes wrong:** Calling `el.showModal()` when the dialog is already open throws a `DOMException`. Similarly, `el.close()` when not open throws.

**Why it happens:** The `useEffect` may run multiple times if `open` prop toggles rapidly or if the component remounts.

**How to avoid:** Guard with `if (!el.open) el.showModal()` and `if (el.open) el.close()` — as done in `PlayerPickerModal.tsx`. [VERIFIED: PlayerPickerModal.tsx lines 40-44]

**Warning signs:** `DOMException: Failed to execute 'showModal' on 'HTMLDialogElement': The element is already open.` in console.

### Pitfall 5: iOS zoom on search input

**What goes wrong:** iOS Safari zooms the page when a text input has `font-size` smaller than 16px.

**Why it happens:** iOS auto-zoom trigger is `font-size < 16px`.

**How to avoid:** Add `style={{ fontSize: '16px' }}` inline on the search `<input>`. Tailwind `text-sm` (14px) is too small. [VERIFIED: PlayerPickerModal.tsx line 134 — same fix already applied]

### Pitfall 6: Player B placeholder when no selection

**What goes wrong:** Rendering the right column in an empty/undefined state without a placeholder causes blank space that looks broken.

**Why it happens:** Player B is `null` until the user picks.

**How to avoid:** When `playerB === null`, render a placeholder prompt in the B column: "Search for a player to compare" in a muted style. All data rows in the B column render `—` or empty.

### Pitfall 7: `xPts_90th_1gw` — optional field

**What goes wrong:** `xPts_90th_1gw` is typed `?: number` on `MergedPlayer` (optional). Rendering it without a null guard causes a runtime error.

**Why it happens:** The field is absent for players where the pipeline didn't compute a 90th-percentile value.

**How to avoid:** Use `player.xPts_90th_1gw?.toFixed(1) ?? '—'`. Do not assume it is always present.

**Warning signs:** `Cannot read properties of undefined (reading 'toFixed')`.

### Pitfall 8: `xg_score` / `xa_score` are `number | null`

**What goes wrong:** These are `null` for promoted-team players without Understat data. Direct `fmtScore(player.xg_score)` throws.

**Why it happens:** `xg_score` is typed `number | null` on `ScoredPlayer`.

**How to avoid:** Use `fmtScoreNull(player.xg_score)` (the null-safe variant from `columns.tsx`) in the Gem section.

---

## Code Examples

### Verified: PlayerPickerModal dialog class attribute [VERIFIED: PlayerPickerModal.tsx line 107]

```tsx
className="rounded-lg bg-white dark:bg-zinc-900 p-4 max-w-md w-full max-h-[70vh] flex flex-col border border-zinc-200 dark:border-zinc-700 shadow-lg"
```

For the comparison modal, `max-w-md` should be widened to `max-w-2xl` or `max-w-3xl` given the two-column layout.

### Verified: Close button pattern [VERIFIED: PlayerPickerModal.tsx lines 115-120]

```tsx
<button
  type="button"
  onClick={onClose}
  className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer active:scale-95 transition-transform"
  aria-label="Close"
>
  ✕
</button>
```

### Verified: Badge component props [VERIFIED: component source files]

```tsx
// RegressionSignalBadge — null-safe
<RegressionSignalBadge signal={player.regression_signal} delta={player.actual_vs_xg_delta} />

// DifferentialBadge — null-safe
<DifferentialBadge flag={player.differential_flag} ownership={parseFloat(player.selected_by_percent ?? '0')} />

// MinsRiskBadge — returns null for 'injured'
<MinsRiskBadge minsRisk={player.mins_risk} />

// FixtureBadges — slice to 5
<FixtureBadges fixtures={player.fixtures.slice(0, 5)} />

// VarianceBadge — for xPts_1gw ceiling
<VarianceBadge ceiling={player.xPts_ceiling_1gw} />
```

### Verified: fmtScore and fmtScoreNull [VERIFIED: columns.tsx lines 15-16]

```tsx
const fmtScore = (v: number) => (v * 100).toFixed(0)           // for non-null scores
const fmtScoreNull = (v: number | null) => v === null ? '—' : (v * 100).toFixed(0)  // for xg_score/xa_score
```

### Verified: page.tsx state pattern (gemPreset model) [VERIFIED: page.tsx lines 59, 124]

```tsx
// page.tsx — add comparePlayer state alongside gemPreset:
const [comparePlayer, setComparePlayer] = useState<ScoredPlayer | null>(null)
const [compareOpen, setCompareOpen] = useState(false)

// Open modal from GemTable callback:
function handleCompare(player: ScoredPlayer) {
  setComparePlayer(player)
  setCompareOpen(true)
}

// Modal mount — alongside GemTable in the 'gems' sub-tab:
{activeSection !== 'squad' && activeSubTab === 'gems' && (
  <>
    <GemTable preset={gemPreset} onPresetChange={setGemPreset} onCompare={handleCompare} />
    <CaptainPicksPanel />
  </>
)}

// Modal rendered at page level (not inside GemTable):
{comparePlayer && (
  <PlayerComparisonModal
    open={compareOpen}
    playerA={comparePlayer}
    scoredPlayers={scoredPlayers}  // needs to be available at page.tsx level — see note
    onClose={() => setCompareOpen(false)}
  />
)}
```

**Note on `scoredPlayers` at page.tsx level:** `page.tsx` currently does not call `usePlayers()` or `computeAllGemScores()` directly — that happens inside `GemTable`. Two options: (a) lift `usePlayers()` + `computeAllGemScores()` to `page.tsx` and pass `scoredPlayers` down to `GemTable`, or (b) call `usePlayers()` inside `PlayerComparisonModal` directly — TanStack Query deduplicates the fetch. Option (b) is simpler and avoids refactoring GemTable. [ASSUMED — both work; option (b) preferred for minimal diff]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix/Headless modal | Native `<dialog>` | Phase 21 (PlayerPickerModal) | No third-party modal dependency; browser handles focus trap + Escape |
| Inline column definitions | `createColumnHelper` typed columns | Phase 1 | Typed column access; custom cell renderers with `col.accessor` |
| Global `usePlayers` in page | Per-component `usePlayers` with TanStack dedup | Phase 3 | Each component fetches independently; cache prevents duplicate HTTP |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createColumns(onCompare)` factory (Option A) is preferred over React context (Option B) for threading the callback | Architecture Patterns § Pattern 2 | Low — either works; context would require adding a provider wrapper |
| A2 | `scoredPlayers` prop to `PlayerComparisonModal` sourced from `usePlayers()` inside the modal (not lifted to `page.tsx`) | Code Examples § page.tsx pattern | Low — TanStack Query deduplicates; if page-level lift is preferred, GemTable also needs refactoring |
| A3 | `comparePlayer` state lives at `page.tsx` level (not inside GemTable) | Architectural Responsibility Map | LOW risk — CONTEXT.md explicitly states this |
| A4 | `VarianceBadge` used in xPts section to show ceiling flag (not `XPtsCell` directly) | Pitfall / Code Examples | Low — `XPtsCell` can also be imported; `VarianceBadge` is the relevant sub-component |

---

## Open Questions (RESOLVED)

1. **`scoredPlayers` source for Player B search — lift or hook inside modal?**
   - What we know: `GemTable` calls `usePlayers()` + `computeAllGemScores()` internally. `page.tsx` does not have `scoredPlayers`.
   - What's unclear: Whether the planner prefers a prop-threading approach (lift to page.tsx) or the simpler hook-inside-modal approach.
   - RESOLVED: Call `usePlayers()` + `computeAllGemScores()` inside `PlayerComparisonModal` — TanStack Query cache makes it free. This is a single extra hook call with zero HTTP overhead. Implemented in Plan 02 Task 2.

2. **Column factory vs context for `onCompare` threading**
   - What we know: `columns.tsx` exports `columns` as a static array. To pass a callback, it needs to become a function or use context.
   - What's unclear: Whether the planner wants to maintain the simpler static export pattern.
   - RESOLVED: Export `createColumns(onCompare)` from `columns.tsx` with a backwards-compat `export const columns = createColumns(() => {})` shim. Update the single call site in `GemTable.tsx`. Implemented in Plan 03 Task 1.

3. **Mobile action sheet — inline row panel or floating overlay?**
   - What we know: D-02 says "mini action sheet with a Compare option, dismiss on outside tap."
   - What's unclear: Whether this is a floating `<div>` positioned above/below the row or a simple inline element inside the row.
   - RESOLVED: Inline element inside the player name cell on mobile — a small `<div className="sm:hidden">` that appears below the name when the cell is tapped, with a "Compare" button and an "✕" dismiss. Implemented in Plan 03 Task 2.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely client-side UI composition with no external tool dependencies. All required packages are already installed (verified in package.json). No CLI tools, databases, or services beyond the existing dev server are needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (jsdom environment, `@` alias) |
| Quick run command | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | Compare icon renders in web_name cell and fires onCompare callback | unit (RTL) | `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx` | ❌ Wave 0 |
| CMP-02 | Search field filters player list; selecting a player sets playerB | unit (RTL) | same | ❌ Wave 0 |
| CMP-03 | xPts section renders 1gw/3gw/5gw/90th values for both players | unit (RTL) | same | ❌ Wave 0 |
| CMP-04 | Gem section renders gem_score + 7 components as 0–100 integers | unit (RTL) | same | ❌ Wave 0 |
| CMP-05 | FixtureBadges renders for both players | unit (RTL) | same | ❌ Wave 0 |
| CMP-06 | Signal badges render for both players | unit (RTL) | same | ❌ Wave 0 |
| CMP-01 (row trigger) | columns.tsx web_name cell renders compare icon on hover | unit (RTL) | `npx vitest run src/components/gem-table/columns.test.tsx` | ❌ Wave 0 |
| page.tsx integration | comparePlayer state wires GemTable onCompare to modal open | unit (RTL) | `npx vitest run src/app/page.test.tsx` | ✅ exists (needs new case) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/gem-table/PlayerComparisonModal.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/gem-table/PlayerComparisonModal.test.tsx` — covers CMP-01 through CMP-06
- [ ] `src/components/gem-table/columns.test.tsx` — covers compare icon render in web_name cell (CMP-01)
- [ ] `src/app/page.test.tsx` — add mock for `PlayerComparisonModal` + test that `onCompare` prop opens modal (new case in existing file)

---

## Security Domain

This phase adds no authentication, no new API routes, no data persistence, no cryptographic operations, and no user-generated content rendered as HTML. The comparison modal reads and displays data already present on the `ScoredPlayer` type. ASVS categories V2 (Authentication), V3 (Session), V4 (Access Control), V6 (Cryptography) do not apply.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes (minimal) | Player B search input filters a client-side array — no XSS risk since player names are data from our own pipeline, not user-controlled HTML |
| V6 Cryptography | No | — |

No threat patterns apply — this is a read-only UI component displaying pre-computed data.

---

## Project Constraints (from CLAUDE.md)

1. **Read Next.js docs before writing any code** — `node_modules/next/dist/docs/`. Next.js version is 16.2.1. Key relevant rules: `'use client'` directive required on components using `useState`/`useEffect`/`useRef`. Server Components are default; Client Components are opt-in.
2. **Do not add `Co-Authored-By` trailers to git commits** — enforced by CLAUDE.md.
3. **No inline styles except `fontSize: '16px'` on inputs** — all other styling via Tailwind `dark:` variants.
4. **No modal library** — native `<dialog>` only (enforced by CONTEXT.md code context).
5. **Tailwind only** — no CSS modules, no styled-components.

---

## Sources

### Primary (HIGH confidence)

- `src/components/planner/PlayerPickerModal.tsx` — canonical dialog modal pattern, all hook patterns verified in source
- `src/lib/types.ts` — `ScoredPlayer` interface, all field types verified
- `src/components/gem-table/columns.tsx` — `fmtScore`, `fmtScoreNull`, `XPtsCell`, column definitions verified
- `src/components/gem-table/GemTable.tsx` — integration point verified; `isMobile`, row expand pattern verified
- `src/app/page.tsx` — state pattern (`gemPreset`), modal mount location verified
- `src/lib/hooks/usePlayers.ts` — hook signature and TanStack Query config verified
- `.planning/REQUIREMENTS.md` — CMP-01 through CMP-06 verified
- `.planning/phases/39-player-comparison-modal/39-CONTEXT.md` — all decisions D-01 through D-13 verified
- `vitest.config.ts` — test framework config verified
- `node_modules/next/dist/docs/` — Next.js 16.2.1 docs verified; `use client` directive, lazy loading

### Secondary (MEDIUM confidence)

- `package.json` — dependency versions verified (React 19.2.4, Next.js 16.2.1, Tailwind ^4, Vitest ^4.1.2)
- All badge components (`RegressionSignalBadge`, `DifferentialBadge`, `VarianceBadge`, `MinsRiskBadge`, `FixtureBadges`) — prop interfaces verified in source

### Tertiary (LOW confidence)

- None — all claims are verified from source code.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified from `package.json`; all component interfaces verified from source
- Architecture: HIGH — verified from `PlayerPickerModal.tsx`, `GemTable.tsx`, `page.tsx`, `columns.tsx`
- Pitfalls: HIGH — most pitfalls derived from reading actual code (double-open guard already implemented in PlayerPickerModal, iOS font-size fix already applied)

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable dependencies; no fast-moving ecosystem concerns)
