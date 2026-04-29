---
phase: 39-player-comparison-modal
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/app/page.tsx
  - src/app/page.test.tsx
  - src/components/gem-table/GemTable.tsx
  - src/components/gem-table/PlayerComparisonModal.tsx
  - src/components/gem-table/PlayerComparisonModal.test.tsx
  - src/components/gem-table/columns.tsx
  - src/components/gem-table/columns.test.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 39 adds a `PlayerComparisonModal` component wired from `GemTable` via `columns.tsx` and surfaced in `page.tsx`. The core data flow is sound: TanStack Query dedup is leveraged for the internal player fetch, the dialog open/close lifecycle is correctly guarded with a double-open check, backdrop-click dismiss works, and the reset `useEffect` correctly clears internal state when `open` transitions to `false`.

Three quality/correctness issues are identified:

1. A stale internal state bug when the modal is re-triggered for a different player without being closed first.
2. An incorrect NaN guard in `XPtsCell` that was explicitly commented as handling NaN but does not.
3. A logical dead code path in `GemTable` that wraps `onCompare` with an unnecessary closure.

---

## Warnings

### WR-01: Stale modal state when compare is triggered for a new player while already open

**File:** `src/app/page.tsx:65-68`, `src/components/gem-table/PlayerComparisonModal.tsx:43-45`

**Issue:** The reset effect in `PlayerComparisonModal` clears `search` and `playerB` only when `open` transitions to `false`:

```tsx
useEffect(() => {
  if (!open) { setSearch(''); setPlayerB(null) }
}, [open])
```

If the modal is already open (`compareOpen === true`) and the user clicks compare on a second player, `handleCompare` in `page.tsx` calls `setComparePlayer(newPlayer)` and `setCompareOpen(true)`. Because `open` does not change (it was already `true`), the reset `useEffect` never fires. The new `playerA` is rendered, but the old `playerB` selection and search text from the previous comparison remain visible.

This is reproducible by: opening a comparison for Player A, selecting Player B, then clicking compare on Player C without closing the modal — Player B remains shown in the comparison column next to Player C.

**Fix:** In `page.tsx`, always set `compareOpen` to `false` before setting a new player, or (simpler) reset state in the modal when `playerA.id` changes:

```tsx
// In PlayerComparisonModal.tsx — add a second reset effect keyed on playerA identity
useEffect(() => {
  setSearch('')
  setPlayerB(null)
}, [playerA.id])
```

This fires whenever a new player is passed as `playerA`, regardless of the `open` state transition.

---

### WR-02: NaN passes through XPtsCell guard despite comment claiming it is handled

**File:** `src/components/gem-table/columns.tsx:39`

**Issue:** The comment on line 37 states "Explicit guards handle NaN and negative values." However, the actual guard is:

```tsx
if (value === undefined || value === null || value <= 0) {
  return <span>{display}</span>
}
```

In JavaScript, `NaN <= 0` evaluates to `false`, so a `NaN` value passes through this guard. The `display` variable computed on line 34 as `(value ?? 0).toFixed(1)` also does not catch NaN because `NaN ?? 0` returns `NaN` (the nullish coalescing operator only catches `null`/`undefined`, not `NaN`), so `NaN.toFixed(1)` produces the string `"NaN"` which is rendered in the cell and passed to `VarianceBadge`.

This can occur during partial pipeline failures or BGW cache serves — the exact scenario mentioned in the comment.

**Fix:** Add an explicit NaN check:

```tsx
if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) {
  return <span>{display}</span>
}
```

And fix the display calculation to handle NaN before the guard:

```tsx
const display = (value != null && Number.isFinite(value) && value > 0)
  ? value.toFixed(1)
  : '—'
```

---

### WR-03: `handleCompare` in GemTable is a redundant one-liner wrapper — misses the real stale-closure risk

**File:** `src/components/gem-table/GemTable.tsx:56-60`

**Issue:** `handleCompare` wraps `onCompare` with no transformation:

```tsx
const handleCompare = useCallback((player: ScoredPlayer) => {
  onCompare?.(player)
}, [onCompare])
```

This `useCallback` is then passed to `createColumns`, which is itself memoized with `[handleCompare]` as dependency. This adds an extra layer of indirection with no benefit. More importantly, on mobile (lines 216-219), `onCompare` is called directly without going through `handleCompare`:

```tsx
onClick={(e) => {
  e.stopPropagation()
  onCompare?.(row.original)   // bypasses handleCompare entirely
  setActionSheetPlayer(null)
}}
```

This inconsistency means the desktop and mobile code paths call different references (`handleCompare` via columns vs. `onCompare` directly). While functionally equivalent here, it signals that `handleCompare` provides no encapsulation and just creates confusion about which path is "authoritative." If any logic were added to `handleCompare` in future, the mobile path would silently miss it.

**Fix:** Remove `handleCompare` entirely. Pass `onCompare` directly to `createColumns` and use it directly on mobile too:

```tsx
const columns = useMemo(() => createColumns(onCompare ?? (() => {})), [onCompare])
```

And on the mobile action sheet button:
```tsx
onClick={(e) => {
  e.stopPropagation()
  onCompare?.(row.original)
  setActionSheetPlayer(null)
}}
```

(No change needed for mobile; the inconsistency is resolved by removing the intermediate `handleCompare`.)

---

## Info

### IN-01: `columns.test.tsx` comment header is stale — describes pre-implementation state

**File:** `src/components/gem-table/columns.test.tsx:1-12`

**Issue:** Lines 5-9 of the test file contain a block comment stating:

```
// Today `columns.tsx` exports a static `columns` array.
// Plan 03 will replace it with a `createColumns(onCompare)` factory...
// This test is intentionally RED until Plan 03 ships...
```

`createColumns` has shipped — the test is green. The comment is a pre-implementation stub description that was never removed and is now misleading to any reader of the file.

**Fix:** Remove or update the stale comment block (lines 5-9) to reflect current state.

---

### IN-02: `onCompare` prop in `GemTable.tsx` has no default no-op, but `PresetToggle` fallback pattern exists for `onPresetChange`

**File:** `src/components/gem-table/GemTable.tsx:140-145`

**Issue:** `onPresetChange` has a defensive fallback that logs a warning in non-production environments when not provided (lines 140-145). `onCompare`, which is called from both the columns cell renderer and the mobile action sheet, has no such fallback — it is simply called as `onCompare?.(...)` with optional chaining. While optional chaining is safe for the call, the asymmetry in defensive behaviour is inconsistent. If `onCompare` is omitted, compare buttons silently do nothing with no developer-facing signal.

**Fix:** Add a dev-mode warning for missing `onCompare`, mirroring the existing pattern:

```tsx
const effectiveOnCompare = onCompare ?? ((p: ScoredPlayer) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('GemTable: onCompare not provided; compare action ignored', p)
  }
})
const columns = useMemo(() => createColumns(effectiveOnCompare), [effectiveOnCompare])
```

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
