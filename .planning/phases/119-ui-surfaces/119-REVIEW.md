---
phase: 119-ui-surfaces
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/components/captaincy/CaptainPicksPanel.test.tsx
  - src/components/captaincy/CaptainPicksPanel.tsx
  - src/components/shared/StatusLabelBadge.test.tsx
  - src/components/shared/StatusLabelBadge.tsx
  - src/components/squad/DecisionSummaryTab.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/TransferPanel.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 119: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 119 adds three UI surfaces: `StatusLabelBadge` (new shared component), lineup-news badges in `CaptainPicksPanel` candidate rows, and a Team News Alert section plus buy-candidate status badges in `DecisionSummaryTab` / `OpportunityCostTable`.

`StatusLabelBadge` itself is clean — correct null-return semantics, well-tested, no issues.

The critical finding is a wiring gap in `TransferPanel`: the Phase 118 availability penalty (`lineupNewsMap` → `suggestTransfers`) was connected in `DecisionSummaryTab` but silently omitted in `TransferPanel`. The two panels show transfer suggestions computed by different rules — `TransferPanel` will recommend doubted/absent players that `DecisionSummaryTab` correctly penalizes.

There are also three warnings: `CandidateRow` calls `useLineupNews()` per row instance rather than hoisting it to the parent; `DecisionSummaryTab.derivedFtCount` comments claim to be "verbatim from TransferPanel" but the unauthenticated path differs in a user-visible way; and the `OpportunityCostTable` uses `row.kind` as a React list key relying on an implicit engine uniqueness contract.

---

## Critical Issues

### CR-01: `TransferPanel` omits `lineupNewsMap` from `suggestTransfers`, bypassing Phase 118 availability penalties

**File:** `src/components/transfers/TransferPanel.tsx:133-141`

**Issue:** `TransferPanel` fetches `lineupNewsMap` (line 56) and passes it to `OpportunityCostTable` for display, but does NOT pass it to `suggestTransfers`. The Phase 118 `ENGN-01` availability penalty (`doubted` → 0.75x factor, `confirmed_absent` → near-zero) is never applied in `TransferPanel`'s OCS engine. By contrast, `DecisionSummaryTab` correctly passes `lineupNewsMap` to `suggestTransfers` (line 246).

Result: the Transfer tab suggests buying doubted or confirmed-absent players at full score. The Decision Summary tab penalizes those same players. Users get contradictory recommendations from the two surfaces.

**Fix:**
```typescript
const raw = suggestTransfers({
  currentPicks: squadData.picks,
  players: scoredPlayers,
  horizon: ocsHorizon,
  ftCount: derivedFtCount,
  bank: Math.round(manualBank * 10),
  sellPrices: exactSellPrices,
  targetGw: targetGw ?? undefined,
  lineupNewsMap,   // ← add this
})
```

Also add `lineupNewsMap` to the `useMemo` dependency array at line 144:
```typescript
}, [squadData, scoredPlayers, ocsHorizon, derivedFtCount, manualBank, exactSellPrices, targetGw, lineupNewsMap])
```

---

## Warnings

### WR-01: `CandidateRow` calls `useLineupNews()` per-instance — N subscriptions for the same query key

**File:** `src/components/captaincy/CaptainPicksPanel.tsx:103`

**Issue:** `CandidateRow` is a non-exported inner component rendered up to 5 times in a loop. Each instance calls `useLineupNews()` independently, creating 5 React Query subscriptions to `['lineup-news']`. React Query deduplicates the network request, but the `select` transform runs per-subscriber, and each instance holds a separate subscription that will re-render its row on any cache update. The idiomatic pattern is to hoist the hook to `CaptainPicksPanel` and pass the result down as a prop, which also keeps the data flow explicit and avoids a hook dependency that can't be seen from the parent.

**Fix:** Hoist `useLineupNews()` into `CaptainPicksPanel` and thread the map down:

```typescript
// In CaptainPicksPanel:
const { data: lineupNewsMap } = useLineupNews()

// Pass to CandidateRow:
<CandidateRow
  ...
  lineupNewsMap={lineupNewsMap}
/>

// CandidateRow signature — remove the hook call, add prop:
function CandidateRow({
  candidate,
  rank,
  mode,
  isAuthenticated,
  myTeamPickIds,
  mcLabel,
  lineupNewsMap,
}: {
  ...
  lineupNewsMap: Map<number, LineupNewsPlayer> | undefined
}) {
  const statusLabel = lineupNewsMap?.get(candidate.id)?.status_label
  // no useLineupNews() here
```

### WR-02: `DecisionSummaryTab.derivedFtCount` claims to be "verbatim from TransferPanel" but the unauthenticated path differs

**File:** `src/components/squad/DecisionSummaryTab.tsx:224-229`

**Issue:** The comment at line 223 states "verbatim from TransferPanel.tsx lines 87-92". But `TransferPanel`'s unauthenticated path reads the manual `freeTransfers` state input (TransferPanel line 109-110: `return (freeTransfers >= 2 ? 2 : 1) as 1 | 2`). `DecisionSummaryTab` has no such input and always returns `1` when not authenticated. This means:
- The Transfer tab respects the user's manually entered free-transfer count when unauthenticated.
- The Decision Summary tab always uses 1 FT when unauthenticated, even if the user would have entered 2 in the Transfer tab.

The comment is incorrect and misleads future maintainers about the two paths being equivalent. The divergence is likely intentional (the DST has no FT input widget) but should be documented explicitly rather than claiming verbatim parity.

**Fix:** Update the comment to document the intentional divergence:
```typescript
// derivedFtCount — simplified variant of TransferPanel.derivedFtCount.
// Unauthenticated path always returns 1 (no manual FT input on this tab — D-06).
// Authenticated path: same logic as TransferPanel (chip-state aware).
const derivedFtCount: 1 | 2 = useMemo(() => {
  if (!isAuthenticated || !myTeamData) return 1
```

### WR-03: `OpportunityCostTable` uses `row.kind` as React list key — silently breaks on duplicate kinds

**File:** `src/components/transfers/OpportunityCostTable.tsx:201`

**Issue:** `key={row.kind}` works today because `computeOpportunityCostRows` emits at most one row per `OCSRowKind`. However, this is an implicit contract. If the engine ever emits two rows with the same `kind` (e.g., two `single-free` rows in a future multi-leg extension), React will silently render only one and produce incorrect diffs. Using an index key is more defensive here, since the rows array is derived and the order is stable within a single render.

**Fix:**
```typescript
{rows.map((row, idx) => {
  const badge = badgeFor(row)
  const isDisabled = !row.isAffordable
  return (
    <tr
      key={idx}
      ...
    >
```

---

## Info

### IN-01: `DecisionSummaryTab` — misaligned JSX indentation

**File:** `src/components/squad/DecisionSummaryTab.tsx:512`

**Issue:** The `{isAuthenticated && (` block is over-indented by 2 spaces relative to its sibling JSX within the surrounding `<div>`. Not a functional defect but it signals the block was added at a different time and may confuse future edits.

**Fix:** Align to match sibling elements (2-space indent relative to the `<form>` above):
```tsx
        {isAuthenticated && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            FPL account connected — exact sell prices will be used.
          </p>
        )}
```

### IN-02: `StatusLabelBadge` test — `confirmed_absent` render does not assert `font-normal` class

**File:** `src/components/shared/StatusLabelBadge.test.tsx:41-51`

**Issue:** The `doubted` test case (lines 24-39) exhaustively checks all classes including `font-normal`. The `confirmed_absent` test case (lines 41-51) checks colour tokens and `title` but omits the structural classes (`inline-block`, `text-xs`, `font-normal`, `rounded`, `px-2`, `py-1`). If the component ever renders `confirmed_absent` with a different structural class (e.g., `font-semibold`), the test will not catch it.

**Fix:** Add the missing class assertions to the `confirmed_absent` test:
```typescript
expect(span?.className).toContain('inline-block')
expect(span?.className).toContain('text-xs')
expect(span?.className).toContain('font-normal')
expect(span?.className).toContain('rounded')
expect(span?.className).toContain('px-2')
expect(span?.className).toContain('py-1')
```

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
