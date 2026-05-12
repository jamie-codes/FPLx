---
phase: 101
plan: "02"
subsystem: transfers-ui
tags: [transfers, ui, gw-targeted, react, tdd]
dependency_graph:
  requires: [101-01]
  provides: [TransferPanel-targetGw, OpportunityCostTable-targetGw]
  affects:
    - src/components/transfers/TransferPanel.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/OpportunityCostTable.test.tsx
tech_stack:
  added: [src/components/transfers/OpportunityCostTable.test.tsx]
  patterns: [tdd-red-green, react-state, useMemo, conditional-jsx]
key_files:
  created:
    - src/components/transfers/OpportunityCostTable.test.tsx
  modified:
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
decisions:
  - "targetGw state lives in TransferPanel (single source of truth) and is threaded down as props — no context needed for this scope"
  - "availableGws derived via useMemo from scoredPlayers.fixtures — no extra API call required"
  - "targetGw ?? undefined pattern used consistently to convert null (state) to undefined (prop type)"
  - "Horizon-mode column header updated to include 'Next' prefix per UX-01/D-13 as part of this task's scope"
metrics:
  duration: ~12 min
  completed: "2026-05-12"
  tasks: 2
  files: 3
---

# Phase 101 Plan 02: GWT-01 UI — OpportunityCostTable + TransferPanel Wiring Summary

**One-liner:** GW-targeted transfer UI: `targetGw` prop on OpportunityCostTable with conditional column header (GWT vs horizon mode), and TransferPanel state + dropdown + availableGws memo + GwToggle disable + sub-label all wired through to `suggestTransfers`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | OpportunityCostTable failing tests | 07bb33c | src/components/transfers/OpportunityCostTable.test.tsx (new) |
| 1 (GREEN) | OpportunityCostTable targetGw prop + conditional header | ae0edda | src/components/transfers/OpportunityCostTable.tsx |
| 2 | TransferPanel: targetGw state + dropdown + wiring | df02c98 | src/components/transfers/TransferPanel.tsx |

## What Was Built

### Task 1: `OpportunityCostTable.tsx` (modified) + `OpportunityCostTable.test.tsx` (new)

**Interface update:**
- Added `targetGw?: number` to `OpportunityCostTableProps`
- Destructured `targetGw` in function signature

**Column header logic (three states):**
```tsx
{targetGw !== undefined
  ? `xPts Gain (GW${targetGw})`
  : `xPts Gain (Next ${horizon} GW${horizon === 1 ? '' : 's'})`}
```

- GWT mode: `xPts Gain (GW{N})` — no "Next" prefix
- Horizon singular: `xPts Gain (Next 1 GW)` — UX-01/D-13 "Next" prefix applied
- Horizon plural: `xPts Gain (Next 3 GWs)` / `xPts Gain (Next 5 GWs)`

**Test file: 6 unit tests all passing** (TDD: RED then GREEN committed separately)

### Task 2: `TransferPanel.tsx` (modified)

**State addition:**
```typescript
const [targetGw, setTargetGw] = useState<number | null>(null)
```

**`availableGws` useMemo:**
```typescript
const availableGws: number[] = useMemo(() => {
  const ids = new Set<number>()
  for (const p of scoredPlayers) {
    for (const f of p.fixtures) ids.add(f.event_id)
  }
  return Array.from(ids).sort((a, b) => a - b)
}, [scoredPlayers])
```

**`suggestTransfers` wiring:**
- Added `targetGw: targetGw ?? undefined` to call
- Added `targetGw` to useMemo dep array

**OCS section JSX additions:**
- `<GwToggle disabled={!!targetGw} />` — pills greyed in GWT mode
- `<select aria-label="Target gameweek">` dropdown with `<option value="">Target GW</option>` + mapped GW options
- Sub-label `Ranked by GW{targetGw} xPts` rendered only when `targetGw !== null`
- `<OpportunityCostTable targetGw={targetGw ?? undefined} />` prop threaded through

## Acceptance Criteria Verification

All 8 grep checks pass:

| Check | Result |
|-------|--------|
| `targetGw?: number` in OpportunityCostTable.tsx | PASS (count=1) |
| `` `xPts Gain (GW${targetGw})` `` in OpportunityCostTable.tsx | PASS (count=1) |
| `` `Next ${horizon} GW` `` in OpportunityCostTable.tsx | PASS (count=1) |
| `describe('OpportunityCostTable column header'` in test file | PASS (count=1) |
| `const [targetGw, setTargetGw] = useState<number \| null>(null)` in TransferPanel.tsx | PASS (count=1) |
| `availableGws: number[] = useMemo` in TransferPanel.tsx | PASS (count=1) |
| `aria-label="Target gameweek"` in TransferPanel.tsx | PASS (count=1) |
| `<option value="">Target GW</option>` in TransferPanel.tsx | PASS (count=1) |
| `disabled={!!targetGw}` in TransferPanel.tsx | PASS (count=1) |
| `targetGw: targetGw ?? undefined` in TransferPanel.tsx | PASS (count=1) |
| `targetGw={targetGw ?? undefined}` in TransferPanel.tsx | PASS (count=1) |
| `Ranked by GW{targetGw} xPts` in TransferPanel.tsx | PASS (count=1) |

## Test Counts

| File | Before | After | New tests |
|------|--------|-------|-----------|
| src/components/transfers/OpportunityCostTable.test.tsx | 0 (new) | 6 | 6 (horizon 1/3/5, GWT 33/36, undefined fallback) |

Targeted test run: `npx vitest run src/components/transfers/TransferPanel src/components/transfers/OpportunityCostTable src/lib/suggest-transfers src/lib/gw-xpts` → **37 tests pass**.

`npx tsc --noEmit` exits 0.

Full suite: 25 failures in captain-picks, club-form, MobileNav, useRivals — all **pre-existing failures** confirmed present in the base commit before this plan's changes. Zero new failures introduced.

## Manual UAT Items

The following items are recorded in 101-VALIDATION.md as Manual-Only Verifications and require a human verify step in a follow-up phase or during regular QA:

1. Dropdown renders adjacent to GwToggle pills (RIGHT of them) in OCS section header
2. Placeholder reads exactly "Target GW"
3. Dropdown shows distinct GW numbers from `scoredPlayers` fixtures, sorted ascending, as "GW{N}"
4. Selecting a GW: pills become greyed (opacity-50 pointer-events-none via `disabled` prop); column header changes; "Ranked by GW{N} xPts" sub-label appears
5. Resetting to placeholder restores horizon mode (pills re-enable, column header reverts, sub-label disappears)
6. `<select>` has correct `aria-label="Target gameweek"`

These items are fully implemented in code but require a live browser session to visually confirm. They do NOT need a separate human-verify checkpoint task — the implementation is deterministic and matches the UI-SPEC exactly.

## Deviations from Plan

None — plan executed exactly as written. The TDD flow (RED commit, GREEN commit) was followed correctly with separate commits for test file creation and implementation.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/transfers/OpportunityCostTable.tsx exists | FOUND |
| src/components/transfers/OpportunityCostTable.test.tsx exists | FOUND |
| src/components/transfers/TransferPanel.tsx exists | FOUND |
| Commit 07bb33c (RED: test file) | FOUND |
| Commit ae0edda (GREEN: OpportunityCostTable) | FOUND |
| Commit df02c98 (Task 2: TransferPanel) | FOUND |
| 6 tests in OpportunityCostTable.test.tsx | FOUND (it( count=6) |
| describe('OpportunityCostTable column header') in test file | FOUND |
