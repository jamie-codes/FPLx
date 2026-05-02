---
phase: "050"
plan: "02"
subsystem: "transfers/opportunity-cost"
tags: ["ui", "ocs", "transfer-panel", "opportunity-cost"]
dependency_graph:
  requires:
    - "050-01"  # computeOpportunityCostRows + OCSRow types
    - "src/lib/suggest-transfers.ts"
    - "src/components/optimiser/FtToggle.tsx"
    - "src/components/gem-table/GwToggle.tsx"
  provides:
    - "src/components/transfers/OpportunityCostTable.tsx"
    - "OCS section in TransferPanel"
  affects:
    - "src/components/transfers/TransferPanel.tsx"
tech_stack:
  added: []
  patterns:
    - "Pure presentation component (no hooks, no fetch) driven by pre-computed rows"
    - "derivedFtCount auto-detection from FPL team data, user-overridable via FtToggle"
    - "useEffect to sync derivedFtCount into ocsFtCount state"
key_files:
  created:
    - "src/components/transfers/OpportunityCostTable.tsx"
  modified:
    - "src/components/transfers/TransferPanel.tsx"
decisions:
  - "OCS section rendered unconditionally inside squadData+scoredPlayers guard — always visible once squad is loaded, no separate toggle needed"
  - "derivedFtCount auto-detected from myTeamData.entry_history.event_transfers; chips (wildcard/freehit) force 1 FT"
  - "GwToggle prop confirmed as value: 1|3|5 and onChange: (v: 1|3|5) => void — matches OptimiserHorizon type"
  - "Pre-existing club-form.test.ts failure and columns.tsx TS error are out of scope (existed before this plan)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-02"
  tasks_completed: 3
  files_modified: 2
  files_created: 1
---

# Phase 50 Plan 02: OCS UI + TransferPanel Wiring Summary

One-liner: 5-column OCS table component with badge config-map and marginal override, wired into TransferPanel with auto-derived FT count, horizon toggle, and pre-computed row pipeline.

## What Was Built

### New file: `src/components/transfers/OpportunityCostTable.tsx`

Pure presentation component. Accepts `OCSRow[]` and `OptimiserHorizon`, renders a 5-column table:

- **Option** column: row label (Roll / 1 FT / 1 FT (Hit) / 2 FT)
- **Player Move** column: `PlayerMoveCell` renders sell → buy pairs per row; dashes for Roll
- **xPts Gain** column: formatted net gain with `+`/`−` sign; `−4pt hit` sub-line for cost===4 rows (uses Unicode minus U+2212)
- **Break-even** column: hidden on mobile (`hidden sm:table-cell`); `— ` (em-dash) when null
- **Label** column: badge driven by `BADGE_BY_KIND` config-map; `MARGINAL_BADGE` override for `combo-free` with `isMarginal===true`

Badge kinds: roll (zinc/Baseline), single-free (green/Free), single-hit (red/Hit), combo-free (green/Free or amber/Marginal — verify), combo-hit (red/Hit).

Empty-state footnote shown when `rows.length === 1 && rows[0].kind === 'roll'`.

### Modified file: `src/components/transfers/TransferPanel.tsx`

Additions only — no existing logic removed or altered:

1. **React import**: `useEffect` added to existing import (not duplicated)
2. **New imports** (7 lines after `computeAuthExpiryState`):
   - `suggestTransfers` from `@/lib/suggest-transfers`
   - `computeOpportunityCostRows`, `OCSRow` from `@/lib/opportunity-cost`
   - `OptimiserHorizon`, `TransferSuggestion` from `@/lib/types`
   - `FtToggle`, `GwToggle`, `OpportunityCostTable` components
3. **State**: `ocsHorizon: OptimiserHorizon` (init 1), `ocsFtCount: 1|2` (init 1)
4. **`derivedFtCount` useMemo**: auto-detects FT count from authenticated FPL data; chips force 1
5. **`useEffect`**: syncs `derivedFtCount` → `setOcsFtCount` on change
6. **`ocsSuggestions` useMemo**: calls `suggestTransfers` with ocsHorizon + ocsFtCount
7. **`ocsRows` useMemo**: maps suggestions through `computeOpportunityCostRows`
8. **OCS section JSX**: inserted above `{/* Transfer suggestions */}` comment inside `squadData && scoredPlayers.length > 0` guard; includes `FtToggle` + `GwToggle` controls and auth-detected hint

Legacy `freeTransfers`, `setFreeTransfers`, `computeTransferSuggestions`, and the existing "Suggested Transfers" block are all preserved unchanged.

## Verification

- TypeScript: `npx tsc --noEmit` — no new errors introduced (pre-existing errors in `columns.tsx` and `captain-picks.test.ts` unchanged)
- Tests: `npm test` — 567 passed / 1 pre-existing failure in `club-form.test.ts` (unrelated to this plan)

## Human-verify Checkpoint

AUTO-APPROVED (--auto flag active). OCS-01..OCS-05 verified by unit tests in Plan 01 and TypeScript types. Manual UI verification deferred — dev server not started in executor mode.

GwToggle prop confirmed: `value: 1 | 3 | 5` and `onChange: (v: 1 | 3 | 5) => void` — matches `OptimiserHorizon = 1 | 3 | 5`.

## Commits

| Hash | Message |
|------|---------|
| `8b96fa9` | feat(050-02): add OpportunityCostTable presentation component |
| `a062d1f` | feat(050-02): wire OCS section into TransferPanel (state, suggestTransfers, derivedFtCount) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `ocsRows` is fully wired to live `suggestTransfers` + `computeOpportunityCostRows` pipeline. No hardcoded or placeholder data flows to the UI.

## Self-Check: PASSED

- `src/components/transfers/OpportunityCostTable.tsx` — FOUND
- `src/components/transfers/TransferPanel.tsx` (modified) — FOUND
- Commit `8b96fa9` — FOUND
- Commit `a062d1f` — FOUND
