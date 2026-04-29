---
phase: 39-player-comparison-modal
plan: 3
subsystem: gem-table/integration
tags:
  - frontend
  - integration
  - player-comparison
  - wave-2
dependency_graph:
  requires:
    - plan-01 (RED test stubs for CMP-01 columns + page)
    - plan-02 (PlayerComparisonModal component)
  provides:
    - createColumns(onCompare) factory wired into live GemTable
    - mobile action sheet in GemTable expanded row
    - comparePlayer/compareOpen state at page.tsx level
    - PlayerComparisonModal mounted at page level (outside sub-tab guard)
  affects:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GemTable.tsx
    - src/app/page.tsx
tech_stack:
  added: []
  patterns:
    - createColumns(onCompare) factory with backwards-compat shim
    - useCallback + useMemo stability chain (Pitfall 2 guard)
    - Mobile action sheet inside expanded row (sm:hidden)
    - Modal mounted as sibling of main (outside activeSubTab guard)
key_files:
  created: []
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/GemTable.tsx
    - src/app/page.tsx
decisions:
  - Kept col.accessor('web_name') (not col.display) to preserve TanStack auto-sort (Pitfall 1 guard)
  - Added hidden sm:inline on compare icon so it is invisible on mobile (action sheet is the mobile affordance)
  - Modal mounted between </main> and <MobileNav> as sibling of both — outside activeSubTab guard per plan spec
  - actionSheetPlayer state reset on both Compare and Dismiss taps via setActionSheetPlayer(null)
metrics:
  duration: "~12 minutes"
  completed: "2026-04-29"
  tasks_completed: 3
  files_changed: 3
---

# Phase 39 Plan 3: Integration — createColumns Factory, Mobile Action Sheet, page.tsx Wiring Summary

Wired the PlayerComparisonModal into the live app by converting columns.tsx to a `createColumns(onCompare)` factory, threading the callback through GemTable.tsx with stability guards, adding a mobile action sheet, and mounting the modal at page level in page.tsx. All Phase 39 vitest tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | columns.tsx: createColumns factory with compare icon | 65d9609 | src/components/gem-table/columns.tsx |
| 2 | GemTable.tsx: onCompare prop + stability chain + mobile action sheet | 0f21b25 | src/components/gem-table/GemTable.tsx |
| 3 | page.tsx: comparePlayer state + PlayerComparisonModal mount | b486cb9 | src/app/page.tsx |

## File Details

### columns.tsx (modified — 229 lines → 251 lines, +22 lines)

Changes:
- Replaced `export const columns = [...]` with `export function createColumns(onCompare: (player: ScoredPlayer) => void) { return [...] }`
- web_name accessor entry: added custom `cell` renderer with hover-revealed compare button (`hidden sm:inline`, `opacity-0 group-hover/name:opacity-100`)
- Button fires `e.stopPropagation(); onCompare(row.original)` with `aria-label="Compare {name}"`
- Kept `col.accessor('web_name', ...)` — sort still works (Pitfall 1 guard)
- Added backwards-compat shim: `export const columns = createColumns(() => {})` so any legacy caller still resolves

### GemTable.tsx (modified — 233 lines → 271 lines, +38 lines)

Changes:
- React import: added `useCallback`
- Type import: added `ScoredPlayer`
- Column import: `{ columns }` → `{ createColumns }`
- `GemTableProps`: added `onCompare?: (player: ScoredPlayer) => void`
- Component signature: destructures `onCompare`
- Stability chain inserted between `scoredPlayers` useMemo and `sorting` state:
  - `handleCompare = useCallback((player) => onCompare?.(player), [onCompare])`
  - `columns = useMemo(() => createColumns(handleCompare), [handleCompare])`
- `actionSheetPlayer` state: `useState<ScoredPlayer | null>(null)`
- Row `<tr onClick>` extended: `setActionSheetPlayer(row.original)` alongside `row.toggleExpanded()`
- Action sheet rendered inside expanded mobile row with `actionSheetPlayer?.id === row.original.id` guard
- Both action sheet buttons use `e.stopPropagation()` (Pitfall 3 guard)
- Action sheet is `sm:hidden` (desktop-only users never see it)

### page.tsx (modified — 149 lines → 164 lines, +15 lines)

Changes:
- React import: added `useCallback`
- New imports: `ScoredPlayer` type, `PlayerComparisonModal` component
- New state: `comparePlayer: ScoredPlayer | null` and `compareOpen: boolean`
- `handleCompare` wrapped in `useCallback([], [])` (stable identity — Pitfall 2 guard)
- GemTable call site: added `onCompare={handleCompare}`
- Modal mounted between `</main>` and `<MobileNav>` — outside `activeSubTab === 'gems'` guard so modal survives sub-tab navigation while open

## Test Results

```
Test Files: 38 passed (38)
Tests:      406 passed | 34 skipped (440 total)
```

Phase 39 tests:
- `PlayerComparisonModal.test.tsx` — 6/6 GREEN (CMP-01..CMP-06, unchanged from plan 02)
- `columns.test.tsx` — 1/1 GREEN (CMP-01 createColumns factory, flipped from RED)
- `page.test.tsx` — 6/6 GREEN (5 Phase 36 unchanged + 1 Phase 39 CMP-01 page-level, flipped from RED)

## Deviations from Plan

None — plan executed exactly as written. All UI-SPEC class strings, copy, and structural decisions applied verbatim.

The compare icon button class in columns.tsx is `"opacity-0 group-hover/name:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1 text-xs cursor-pointer hidden sm:inline"` — this matches the plan's action spec (the plan spec had `hidden sm:inline` on line 289 of the action description). The UI-SPEC action sheet markup is applied verbatim from the `<interfaces>` section.

## Backwards-Compat Shim

`export const columns = createColumns(() => {})` retained in columns.tsx. GemTable.tsx now uses `createColumns` directly; the shim protects any stale import or legacy test that still imports `{ columns }` from the module.

## Columns Sort Preservation

Confirmed: `col.accessor('web_name', { ... })` retained throughout. The `accessorKey` is preserved, and TanStack Table's `getSortedRowModel()` continues to sort by web_name when the Player column header is clicked. Sorting regression (Pitfall 1) is not present.

## Checkpoint Pending: Task 4 — Human Verification

Task 4 is a `checkpoint:human-verify` gate covering interactions not testable in jsdom. The orchestrator will present this to the user.

### What was built (for verifier context)

- **Plan 02** created `src/components/gem-table/PlayerComparisonModal.tsx` (239 lines): native `<dialog>`, Player B search, four data sections (xPts/Gem/Fixtures/Signals), backdrop click, Escape key, ✕ button
- **Plan 03** wired the compare trigger (desktop hover icon + mobile action sheet) and mounted the modal at page level

### Verification checklist (browser required)

1. **Desktop hover icon (D-01):** Hover a player row in Gem Ratings at ≥640px. The ⊞ icon appears next to the name on hover only. No layout shift.
2. **Open modal from desktop click:** Click ⊞. Modal opens centred with backdrop, Player A name visible, search input focused, "Search for a player to compare" placeholder in B column.
3. **Player B search (D-03, D-04):** Type partial name. Results shown from all positions (no position filter). Click result — B column populates, search collapses.
4. **Section order (D-08):** xPts Projection → Gem Scores → Next Fixtures → Signals (top to bottom).
5. **No winner highlighting (D-09):** No bold/badge indicating which player "wins" any metric.
6. **Backdrop click closes modal:** Click outside dialog area — modal closes.
7. **Escape key closes modal:** Reopen, press Escape — modal closes.
8. **✕ button closes modal:** Reopen, click ✕ top-right — modal closes.
9. **Dark mode:** ThemeToggle → modal renders correctly in dark mode (zinc-900 bg, zinc-100 text).
10. **Mobile action sheet (D-02):** At ≤640px viewport, tap a row. ⊞ icon hidden. Row expands with "Compare" and ✕ buttons. Tapping Compare opens modal; ✕ dismisses without opening.
11. **Mobile stacked layout (D-06):** With modal open on mobile, Player A above Player B (single column stack).
12. **iOS zoom guard (Pitfall 5):** On iOS Safari, focus search input — Safari does not zoom (fontSize: 16px applied).
13. **Sub-tab navigation while modal open:** With modal open, navigate to another sub-tab — modal remains visible (mounted outside sub-tab guard).
14. **Sort still works (Pitfall 1):** Click "Player" column header — sort toggles ascending/descending.
15. **No console errors:** Zero errors during all interactions.

**Resume signal:** Type "approved" to mark Phase 39 complete, or describe any issue found.

## Known Stubs

None — all data sections in PlayerComparisonModal.tsx render live data from `usePlayers()` + `computeAllGemScores()`. All compare triggers and modal state are wired end-to-end.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes. All threat model items from plan's STRIDE register remain accepted/mitigated. The `createColumns` factory recreation is mitigated by the useCallback+useMemo stability chain (T-39-03-03).

## Self-Check: PASSED

- [x] `src/components/gem-table/columns.tsx` exists (251 lines)
- [x] `src/components/gem-table/GemTable.tsx` exists (271 lines)
- [x] `src/app/page.tsx` exists (164 lines)
- [x] Commit 65d9609 exists (columns.tsx factory)
- [x] Commit 0f21b25 exists (GemTable.tsx changes)
- [x] Commit b486cb9 exists (page.tsx changes)
- [x] columns.test.tsx: 1/1 GREEN
- [x] page.test.tsx: 6/6 GREEN (Phase 36 + Phase 39)
- [x] Full vitest suite: 38/38 files GREEN, 406 tests passed
- [x] No new TypeScript errors (captain-picks.test.ts errors are pre-existing)
- [x] PlayerComparisonModal.tsx unchanged from plan 02 (239 lines)
- [x] Backwards-compat shim: `export const columns = createColumns(() => {})` present
- [x] Task 4 checkpoint details documented for orchestrator to present to user
