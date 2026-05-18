---
phase: 119
plan: "02"
subsystem: ui-wiring
tags: [badge, lineup-news, captain-picks, opportunity-cost, transfer-panel, ui-01, ui-02]
dependency_graph:
  requires:
    - src/components/shared/StatusLabelBadge.tsx (Phase 119-01)
    - src/lib/hooks/useLineupNews.ts (Phase 118)
    - src/lib/types.ts StatusLabel/LineupNewsPlayer/LineupNews (Phase 117)
  provides:
    - CaptainPicksPanel CandidateRow renders StatusLabelBadge for doubted/confirmed_absent candidates
    - OpportunityCostTable accepts optional lineupNewsMap and renders StatusLabelBadge for buy candidate
    - TransferPanel wires useLineupNews and forwards lineupNewsMap to OpportunityCostTable
  affects:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
tech_stack:
  added: []
  patterns:
    - Hook-in-component (CandidateRow calls useLineupNews directly — D-08, zero extra fetches via TanStack Query cache)
    - Optional prop backward-compat (lineupNewsMap?: Map<number, LineupNewsPlayer> — D-09)
    - StatusLabelBadge component (Partial<Record<StatusLabel, Config>> nil guard)
key_files:
  created:
    - src/components/shared/StatusLabelBadge.tsx (carried from Phase 119-01 — not in worktree branch point)
    - src/lib/hooks/useLineupNews.ts (carried from Phase 118 — not in worktree branch point)
  modified:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/captaincy/CaptainPicksPanel.test.tsx
    - src/components/transfers/OpportunityCostTable.tsx
    - src/components/transfers/TransferPanel.tsx
    - src/lib/types.ts (LineupNews/LineupNewsPlayer/StatusLabel types appended from Phase 117)
decisions:
  - "StatusLabelBadge placed after McLabel and before NewsBanner in CandidateRow cluster (D-07 — structured signal first)"
  - "StatusLabelBadge placed after RotationRiskBadge and before NewsBanner in PlayerMoveCell buy cluster (UI-SPEC §UI-02)"
  - "TransferPanel's suggestTransfers call intentionally NOT modified — scope boundary: UI-04 in Plan 03 covers DecisionSummaryTab; TransferPanel suggestTransfers wiring is out of scope for Plan 02"
  - "StatusLabelBadge.tsx JSX.Element return type annotation removed — JSX namespace not available without import in react-jsx tsconfig mode; unannotated functions infer the type correctly"
  - "Phase 117/118/119-01 artifacts (types, hook, badge) carried into worktree via manual copy — worktree was branched before those phases landed"
metrics:
  duration: ~6 min
  completed: 2026-05-18
  tasks_completed: 3
  files_changed: 7
---

# Phase 119 Plan 02: useLineupNews UI Wiring Summary

Wire `useLineupNews()` data into two existing surfaces so confirmed-absent and doubted players are visually flagged with a `StatusLabelBadge` pill.

## What Was Built

### Task 1: UI-01 — CaptainPicksPanel CandidateRow

**`src/components/captaincy/CaptainPicksPanel.tsx`** modified:
- Added `useLineupNews` import from `@/lib/hooks/useLineupNews`
- Added `StatusLabelBadge` import from `@/components/shared/StatusLabelBadge`
- `CandidateRow` calls `useLineupNews()` directly at function body top (D-08: hook inside sub-component, cache hit from other consumers — zero additional fetches)
- `statusLabel = lineupNewsMap?.get(candidate.id)?.status_label` derived per candidate
- `<StatusLabelBadge statusLabel={statusLabel} />` inserted in the inline badge cluster:
  - **Order:** McLabel → StatusLabelBadge → NewsBanner (structured signal before free-text news per D-07)
- No prop-drill from `CaptainPicksPanel` into `CandidateRow` (per D-08)

**`src/components/captaincy/CaptainPicksPanel.test.tsx`** modified (deviation Rule 2):
- Added `vi.mock('@/lib/hooks/useLineupNews', ...)` and corresponding default mock in `beforeEach` returning `{ data: undefined }`
- Required because `CandidateRow` now calls the hook; without the mock, tests fail with "No QueryClient set" error

### Task 2: UI-02 — OpportunityCostTable buy-candidate StatusLabelBadge

**`src/components/transfers/OpportunityCostTable.tsx`** modified:
- `LineupNewsPlayer` added to existing `import type { OptimiserHorizon, ScoredPlayer }` from `@/lib/types`
- `StatusLabelBadge` imported from `@/components/shared/StatusLabelBadge`
- `OpportunityCostTableProps` gains optional field (D-09 backward-compat):
  ```
  lineupNewsMap?: Map<number, LineupNewsPlayer>
  ```
- `PlayerMoveCell` signature extended with `lineupNewsMap?: Map<number, LineupNewsPlayer>`
- `<StatusLabelBadge statusLabel={lineupNewsMap?.get(t.buy.id)?.status_label} />` inserted in buy-candidate flex cluster:
  - **Order:** RotationRiskBadge → StatusLabelBadge → NewsBanner (per UI-SPEC §UI-02)
  - Sell candidate: no badge (by design — buy candidate only)
- `OpportunityCostTable` function destructs `lineupNewsMap` and forwards to `<PlayerMoveCell ... lineupNewsMap={lineupNewsMap} />`

### Task 3: UI-02 Wiring — TransferPanel

**`src/components/transfers/TransferPanel.tsx`** modified:
- `useLineupNews` imported from `@/lib/hooks/useLineupNews`
- `const { data: lineupNewsMap } = useLineupNews()` added after `useMyTeam` hook call
- `lineupNewsMap={lineupNewsMap}` prop added to `<OpportunityCostTable>` element between `lifecycleLabels` and `totalsByPosition`
- `suggestTransfers()` call explicitly NOT modified (scope boundary: TransferPanel suggestTransfers wiring is not in Plan 02 scope)

### Worktree Carry-In (Deviation — Rule 3)

This worktree was branched at a point before Phase 117/118/119-01 landed. Three Phase 117/118/119-01 artifacts were absent and had to be carried in:

1. **`src/lib/types.ts`** — `LineupNewsSource`, `StatusLabel`, `LineupNewsPlayer`, `SourceHealth`, `LineupNews` types appended (34 lines from Phase 117)
2. **`src/lib/hooks/useLineupNews.ts`** — full hook file created (matches Phase 118 output)
3. **`src/components/shared/StatusLabelBadge.tsx`** — full component file created (matches Phase 119-01 output, with JSX.Element return type annotation removed to fix tsc error)

## Badge Cluster Ordering Decisions

**UI-01 (CaptainPicksPanel CandidateRow):**
```
rank · name · EO% · [DangerousToFade?] · [McLabel?] · [StatusLabelBadge?] · [NewsBanner?]
```
Rationale: structured status signal (StatusLabelBadge) precedes free-text news (NewsBanner) per D-07.

**UI-02 (OpportunityCostTable PlayerMoveCell, buy row):**
```
Sell {name} → Buy {name} · [RotationRiskBadge?] · [StatusLabelBadge?] · [NewsBanner?]
```
Rationale: availability-impacting signals grouped together; StatusLabelBadge sits between the rotation risk indicator and free-text injury news per UI-SPEC §UI-02.

## Backward-Compatibility

- `lineupNewsMap` is optional in `OpportunityCostTableProps` and `PlayerMoveCell`
- When `lineupNewsMap` is `undefined` (all pre-119 call sites), `lineupNewsMap?.get(...)?.status_label` evaluates to `undefined`, and `StatusLabelBadge` returns `null`
- All 18 existing `OpportunityCostTable.test.tsx` tests pass without modification

## Deviations from Plan

### Auto-fixed (Rule 2): CaptainPicksPanel.test.tsx missing useLineupNews mock

**Found during:** Task 1
**Issue:** CandidateRow now calls `useLineupNews()` directly, but the test file had no mock. This caused a "No QueryClient set" failure for all 28 captaincy tests.
**Fix:** Added `vi.mock('@/lib/hooks/useLineupNews', ...)` and `vi.mocked(useLineupNews).mockReturnValue({ data: undefined })` in `beforeEach`.
**Files modified:** `src/components/captaincy/CaptainPicksPanel.test.tsx`
**Commit:** 9e27eb7

### Auto-fixed (Rule 3): Phase 117/118/119-01 artifacts absent from worktree branch point

**Found during:** Task 1
**Issue:** The worktree was branched before Phase 117/118/119-01 landed on main. `useLineupNews.ts`, `StatusLabelBadge.tsx`, and the `LineupNews*` types were missing, blocking import resolution.
**Fix:** Carried in the three artifacts from main (types appended to `types.ts`, hook and badge component created verbatim).
**Files modified/created:** `src/lib/types.ts`, `src/lib/hooks/useLineupNews.ts`, `src/components/shared/StatusLabelBadge.tsx`
**Commit:** 9e27eb7

### Auto-fixed (Rule 1): JSX.Element return type causes tsc error

**Found during:** Task 1 (when checking tsc after carry-in)
**Issue:** `StatusLabelBadge.tsx` in main repo uses `: JSX.Element | null` return type annotation, but with `"jsx": "react-jsx"` tsconfig and no `import React`, the `JSX` namespace is not available, causing `error TS2503: Cannot find namespace 'JSX'`.
**Fix:** Removed the explicit return type annotation. TypeScript infers `span | null` correctly; other shared badge components (`FragilityBadge`, `RotationRiskBadge`) follow the same unannotated pattern.
**Files modified:** `src/components/shared/StatusLabelBadge.tsx`
**Commit:** 9e27eb7

## Verification

```
npm test -- --run src/components/captaincy
→ 28 passed (28)

npm test -- --run src/components/transfers
→ 25 passed (25)

npx tsc --noEmit -p tsconfig.json
→ 0 errors (CaptainPicksPanel, OpportunityCostTable, TransferPanel all clean)
```

## Threat Flags

None — this plan only wires existing typed data (Phase 118 `useLineupNews` hook output) into read-only rendering via `StatusLabelBadge`. All trust boundaries were assessed in plan threat model (T-119-02-01 through T-119-02-05) and dispositions applied:
- T-119-02-01 (XSS): mitigated by closed `StatusLabel` union + `BADGE_MAP` static literal guard
- T-119-02-02 (info disclosure): accepted — lineup news is public-domain data
- T-119-02-03 (DoS via large map): accepted — O(1) Map.get, ~700 player cap
- T-119-02-04 (privilege bypass): mitigated — optional prop defaults to undefined (safe)
- T-119-02-05 (repudiation): accepted — read-only rendering, no mutation

## Self-Check: PASSED

Files exist:
- `src/components/captaincy/CaptainPicksPanel.tsx` — FOUND (modified)
- `src/components/transfers/OpportunityCostTable.tsx` — FOUND (modified)
- `src/components/transfers/TransferPanel.tsx` — FOUND (modified)
- `src/components/shared/StatusLabelBadge.tsx` — FOUND (created/carried)
- `src/lib/hooks/useLineupNews.ts` — FOUND (created/carried)

Commits in git log:
- 9e27eb7 — Task 1 (UI-01 CaptainPicksPanel) — FOUND
- 1236006 — Task 2 (UI-02 OpportunityCostTable) — FOUND
- 6421801 — Task 3 (UI-02 wiring TransferPanel) — FOUND
