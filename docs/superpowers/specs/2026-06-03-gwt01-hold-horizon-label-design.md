# GWT-01 Hold Horizon Label — Design Spec

## Goal

When the Transfer Panel is in Target GW mode, display a small inline chip next to each buy
candidate indicating whether the player is a sustained hold ("GW{N}+") or a short-term
rental ("GW{N} only" / "GW{N} mainly").

## Context

Phase 101 implemented the Target GW dropdown and `computeGwXpts`-based re-ranking in
`suggest-transfers.ts`. The missing piece is a **hold horizon label** that helps managers
decide whether a target-GW buy is worth keeping beyond that week.

---

## Architecture

Minimal footprint — one new exported function, one component tweak. No type changes, no
API changes, no new files.

**Data flow:**

```
computeHoldLabel(buy: MergedPlayer, targetGw: number): string | null
  ↑ exported from src/lib/gw-xpts.ts
  ↓ called in PlayerMoveCell (OpportunityCostTable.tsx)
  ↓ renders as inline chip in the buy-player name row
```

**Files touched:**

| File | Change |
|------|--------|
| `src/lib/gw-xpts.ts` | Add `computeHoldLabel` export |
| `src/lib/gw-xpts.test.ts` | Unit tests for `computeHoldLabel` |
| `src/components/transfers/OpportunityCostTable.tsx` | Thread `targetGw` to `PlayerMoveCell`; render chip |
| `src/components/transfers/OpportunityCostTable.test.tsx` | Component smoke-test for chip rendering |

---

## `computeHoldLabel` Logic

```typescript
// src/lib/gw-xpts.ts

export function computeHoldLabel(player: MergedPlayer, targetGw: number): string | null {
  const gwScore = computeGwXpts(player, targetGw)
  if (gwScore === 0) return null   // BGW or no fixture — no chip shown
  const avg = (computeGwXpts(player, targetGw + 1) + computeGwXpts(player, targetGw + 2)) / 2
  if (avg >= 0.7 * gwScore) return `GW${targetGw}+`
  if (avg > 0)              return `GW${targetGw} mainly`
  return `GW${targetGw} only`
}
```

### Label decision table

| Condition | Label | Meaning |
|-----------|-------|---------|
| `gwScore === 0` | `null` (no chip) | Player has no fixture in target GW |
| `avg >= 0.7 × gwScore` | `"GW{N}+"` | Sustained hold — still good after target GW |
| `0 < avg < 0.7 × gwScore` | `"GW{N} mainly"` | Spike with residual value |
| `avg === 0` | `"GW{N} only"` | Pure rental — sell next week |

Where `avg = (computeGwXpts(player, targetGw+1) + computeGwXpts(player, targetGw+2)) / 2`.

The 70% threshold was chosen to allow for natural fixture-difficulty variation while still
identifying genuinely good holds. A player scoring 8.0 in GW{N} who averages 6.0 in the
next two (75%) is a clear hold; one who averages 4.0 (50%) is a spike.

### Edge cases

- **End of season** — `computeGwXpts` returns 0 for non-existent GWs → `avg = 0` → `"GW{N} only"` ✓
- **DGW at targetGw** — high `gwScore`; N+1/N+2 may be blank if post-DGW schedule is thin → `"GW{N} only"` (correct for cup-exit blanks) ✓
- **BGW at targetGw** — `gwScore = 0` → `null` → no chip shown ✓
- **Same player is buy in multiple suggestions** — label is computed once per render per leg, result is identical ✓

---

## UI Rendering

### `PlayerMoveCell` changes

Add `targetGw?: number` to the component's prop interface.

Inside the buy-player `<div>` flex row (after `MinsRiskBadge`, before `ConfirmedSigningBadge`),
render the chip when `targetGw !== undefined` and `computeHoldLabel` returns non-null:

```tsx
{targetGw !== undefined && (() => {
  const label = computeHoldLabel(t.buy, targetGw)
  if (!label) return null
  const isPlus = label.endsWith('+')
  const isOnly = label.endsWith('only')
  return (
    <span
      data-testid={`hold-label-${t.buy.id}`}
      className={`text-xs font-medium rounded px-1.5 py-0.5 ${
        isPlus
          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
          : isOnly
          ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
      }`}
    >
      {label}
    </span>
  )
})()}
```

**Color coding:**
- Green — `"GW{N}+"` (sustained hold)
- Amber — `"GW{N} mainly"` (spike with residual)
- Zinc/grey — `"GW{N} only"` (pure rental)

The chip sits inline in the existing flex-wrap row. No layout changes needed — the row
already wraps on overflow.

### `OpportunityCostTable` changes

Pass `targetGw` through to `PlayerMoveCell`:

```tsx
<PlayerMoveCell ... targetGw={targetGw} />
```

`targetGw` is already on `OpportunityCostTableProps` (added in Phase 101).

---

## Tests

### Unit tests — `gw-xpts.test.ts`

| Test ID | Input | Expected |
|---------|-------|----------|
| HL-01 | `gwScore=0` (BGW) | `null` |
| HL-02 | `avg >= 0.7 × gwScore` | `"GW{N}+"` |
| HL-03 | `0 < avg < 0.7 × gwScore` | `"GW{N} mainly"` |
| HL-04 | `avg === 0`, `gwScore > 0` | `"GW{N} only"` |
| HL-05 | End-of-season (no fixtures at N+1 or N+2) | `"GW{N} only"` |
| HL-06 | DGW at targetGw (both fixtures), no post-target fixtures | `"GW{N} only"` |
| HL-07 | Sustained player: `gwScore=8`, `avg=6` (75%) | `"GW{N}+"` |
| HL-08 | Spike player: `gwScore=10`, `avg=3` (30%) | `"GW{N} mainly"` |

### Component test — `OpportunityCostTable.test.tsx`

- When `targetGw` is set and buy player has post-target fixtures, `data-testid="hold-label-{id}"` appears in DOM.
- When `targetGw` is undefined, no hold-label chips appear.
- Label text matches expected value for the fixture configuration used.

---

## Out of scope

- Chip in the "Ranked by GW{N} xPts" sub-label (TransferPanel) — that label already exists.
- Combo rows (both legs get their own chip via the existing `transfers.map` loop — no extra work).
- Hold label in horizon mode (`targetGw === undefined`) — not applicable.
