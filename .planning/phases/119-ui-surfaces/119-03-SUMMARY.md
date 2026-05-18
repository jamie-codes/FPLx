---
phase: 119
plan: "03"
subsystem: ui-wiring
tags: [decision-summary, lineup-news, team-news-alert, ui-03, ui-04, suggest-transfers]
dependency_graph:
  requires:
    - src/components/shared/StatusLabelBadge.tsx (Phase 119-01)
    - src/lib/hooks/useLineupNews.ts (Phase 118)
    - src/lib/types.ts StatusLabel/LineupNewsPlayer/LineupNews (Phase 117)
    - src/lib/suggest-transfers.ts lineupNewsMap param (Phase 118 ENGN-01)
    - src/components/transfers/OpportunityCostTable.tsx lineupNewsMap prop (Phase 119-02)
  provides:
    - DecisionSummaryTab calls useLineupNews() and stores lineupNewsMap
    - DecisionSummaryTab suggestTransfers call includes lineupNewsMap (UI-04 engine wiring)
    - DecisionSummaryTab OpportunityCostTable receives lineupNewsMap (Plan 02 badge propagation)
    - DecisionSummaryTab Team News Alert section (UI-03) between 2x2 grid and CalibrationHealthIndicator
  affects:
    - src/components/squad/DecisionSummaryTab.tsx
tech_stack:
  added: []
  patterns:
    - Hook-in-consumer (useLineupNews at DecisionSummaryTab function top — shared TanStack Query cache, zero extra fetches)
    - useMemo filter memo (flaggedPlayers — 15 squad picks x lineupNewsMap intersection)
    - Conditional JSX section (Team News Alert — absent when flaggedPlayers empty)
    - Optional prop forward (lineupNewsMap threaded to suggestTransfers and OpportunityCostTable)
key_files:
  created: []
  modified:
    - src/components/squad/DecisionSummaryTab.tsx
  carried_in:
    - src/lib/types.ts (LineupNews/LineupNewsPlayer/StatusLabel types appended from Phase 117)
    - src/lib/hooks/useLineupNews.ts (full hook created from Phase 118)
    - src/components/shared/StatusLabelBadge.tsx (component created from Phase 119-01)
    - src/lib/suggest-transfers.ts (lineupNewsMap param added from Phase 118)
    - src/components/transfers/OpportunityCostTable.tsx (lineupNewsMap prop added from Phase 119-02)
decisions:
  - "lineupNewsMap is declared as a top-level hook call (adjacent to useAccuracy) so it is in scope for both suggestTransfers (UI-04) and flaggedPlayers (UI-03) — single hook call per D-08 spirit"
  - "flaggedPlayers iterates myTeamData.picks (all 15, D-11) rather than just startingXI — bench availability matters"
  - "Team News Alert conditionally absent (flaggedPlayers.length > 0 guard) — no placeholder, no skeleton per D-10"
  - "Phase 117/118/119-01/02 artifacts carried into worktree (Rule 3) — worktree was branched before those phases landed on main"
metrics:
  duration: ~5 min
  completed: 2026-05-18
  tasks_completed: 2
  files_changed: 6
---

# Phase 119 Plan 03: DecisionSummaryTab lineupNews Wiring Summary

Wire `useLineupNews()` into `DecisionSummaryTab` to close UI-03 (Team News Alert section) and UI-04 (engine availability penalty activation) — the final two requirements of Phase 119.

## What Was Built

### Task 1: UI-04 — useLineupNews hook call + suggestTransfers + OpportunityCostTable wiring

**`src/components/squad/DecisionSummaryTab.tsx`** modified (Plan 03 core changes):

1. **New import:** `import { useLineupNews } from '@/lib/hooks/useLineupNews'` added adjacent to `useAccuracy`.

2. **New hook call** after `useAccuracy`:
   ```
   // Phase 119 UI-03 + UI-04: shared map for ocsSuggestions penalty and Team News Alert section
   const { data: lineupNewsMap } = useLineupNews()
   ```
   Single hook call — TanStack Query cache ensures zero additional fetches (hook already called by CandidateRow and TransferPanel per Phase 119-02).

3. **ocsSuggestions memo** extended:
   - Added `lineupNewsMap,` to the `suggestTransfers({...})` params object (after `sellPrices`)
   - Added `lineupNewsMap` to the `useMemo` deps array: `[squadData, scoredPlayers, derivedFtCount, exactSellPrices, lineupNewsMap]`
   - Activates Phase 118 ENGN-01: confirmed_absent buy candidates get 0.01 floor, doubted candidates get penalty multiplier

4. **`<OpportunityCostTable>`** render extended:
   - Added `lineupNewsMap={lineupNewsMap}` prop after `lifecycleLabels` — surfaces the Phase 119-02 StatusLabelBadge on buy-candidate rows in the Decision Summary OCS table

### Task 2: UI-03 — Team News Alert section

**`src/components/squad/DecisionSummaryTab.tsx`** modified:

1. **New import:** `import { StatusLabelBadge } from '@/components/shared/StatusLabelBadge'`

2. **`StatusLabel` added** to existing `import type { ..., StatusLabel } from '@/lib/types'`

3. **`flaggedPlayers` memo** inserted between `severity` memo and loading guard:
   - Type: `Array<{ player: ScoredPlayer; statusLabel: StatusLabel }>`
   - Inputs: `myTeamData`, `lineupNewsMap`, `scoredPlayers`
   - Returns `[]` immediately when any input is absent (staleness short-circuit)
   - Iterates all 15 `myTeamData.picks` (D-11 — not just starting XI)
   - Filters: `status_label === 'doubted' || status_label === 'confirmed_absent'` (D-12)
   - Player resolved via id-Map from `scoredPlayers` for O(1) lookup
   - Preserves squad-pick order (positions 1–15: starting XI then bench)
   - Deps: `[myTeamData, lineupNewsMap, scoredPlayers]`

4. **Team News Alert JSX section** inserted between `</div>` closing the 2×2 card grid (line ~712) and `{accuracyData && <CalibrationHealthIndicator>}`:
   - Guard: `{flaggedPlayers.length > 0 && (...)}`
   - Container: `<div role="region" aria-label="Team News Alert" data-testid="team-news-alert" className="rounded border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-white dark:bg-zinc-900">`
   - Heading: `<h2 className="text-base font-semibold...">Team News Alert</h2>`
   - List: `<ul className="space-y-2">` with one `<li key={player.id} className="flex items-center justify-between py-1">` per entry
   - Each `<li>` contains: `<span className="text-sm font-medium...">{player.web_name}</span>` and `<StatusLabelBadge statusLabel={statusLabel} />`

### Worktree Carry-In (Deviation — Rule 3)

This worktree was branched before Phases 117/118/119-01/02 landed. Five artifacts were absent:

1. **`src/lib/types.ts`** — `LineupNewsSource`, `StatusLabel`, `LineupNewsPlayer`, `SourceHealth`, `LineupNews` types appended (34 lines)
2. **`src/lib/hooks/useLineupNews.ts`** — full hook file created (Phase 118)
3. **`src/components/shared/StatusLabelBadge.tsx`** — full component created (Phase 119-01, without JSX.Element return type annotation per Plan 02 D-03)
4. **`src/lib/suggest-transfers.ts`** — `LineupNewsPlayer` import, `lineupNewsMap` param in `SuggestTransfersParams`, `availFactor`/`scoreBuyCandidate` functions, and `scoreBuyCandidate` usage in pool sort + xPtsGain calculation (Phase 118 ENGN-01)
5. **`src/components/transfers/OpportunityCostTable.tsx`** — `LineupNewsPlayer` import, `StatusLabelBadge` import, `lineupNewsMap` optional prop in interface + `PlayerMoveCell` + function signature, and `StatusLabelBadge` render in buy-candidate cell (Phase 119-02)

## Requirements Coverage Map

| Requirement | Plan | Task | Status |
|-------------|------|------|--------|
| UI-01: CaptainPicksPanel CandidateRow StatusLabelBadge | 02 | Task 1 | Done (Phase 119-02) |
| UI-02: OpportunityCostTable buy-candidate StatusLabelBadge | 02 | Tasks 2+3 | Done (Phase 119-02) |
| UI-03: DecisionSummaryTab Team News Alert section | 03 | Task 2 | Done (this plan) |
| UI-04: DecisionSummaryTab suggestTransfers + OCS lineupNewsMap forward | 03 | Task 1 | Done (this plan) |

## Backward-Compatibility

- `useLineupNews()` returns `undefined` until the 48h-fresh lineup-news data is available; when `undefined`:
  - `suggestTransfers` receives `lineupNewsMap: undefined` → `availFactor` returns 1.0 for all players (no penalty, identical to pre-Phase-119 behavior)
  - `flaggedPlayers` returns `[]` → Team News Alert section absent from DOM
  - `OpportunityCostTable` receives `lineupNewsMap: undefined` → `StatusLabelBadge` returns null for all rows
- All pre-existing DecisionSummaryTab behavior is preserved byte-for-byte when lineup news is stale/absent.

## Deviations from Plan

### Auto-fixed (Rule 3): Phase 117/118/119-01/02 artifacts absent from worktree branch point

**Found during:** Task 1 setup  
**Issue:** The worktree was branched before Phases 117/118/119-01/02 landed on main. Five artifacts (`types.ts` additions, `useLineupNews.ts`, `StatusLabelBadge.tsx`, `suggest-transfers.ts` Phase 118 additions, `OpportunityCostTable.tsx` Phase 119-02 additions) were missing, blocking import resolution.  
**Fix:** Carried in all five artifacts matching main repo state. `StatusLabelBadge.tsx` omits the explicit `JSX.Element | null` return type annotation (pre-existing worktree-specific fix from Plan 02 — avoids `error TS2503: Cannot find namespace 'JSX'` under `"jsx": "react-jsx"` tsconfig).  
**Files modified/created:** `src/lib/types.ts`, `src/lib/hooks/useLineupNews.ts`, `src/components/shared/StatusLabelBadge.tsx`, `src/lib/suggest-transfers.ts`, `src/components/transfers/OpportunityCostTable.tsx`  
**Commit:** 66e63fe

## Verification

```
grep -c "useLineupNews" src/components/squad/DecisionSummaryTab.tsx
→ 2 (import + call)

grep -c "lineupNewsMap" src/components/squad/DecisionSummaryTab.tsx
→ 8 (declaration, suggestTransfers field, useMemo dep, OpportunityCostTable prop, flaggedPlayers body)

grep -c 'data-testid="team-news-alert"' src/components/squad/DecisionSummaryTab.tsx
→ 1

grep -c "<StatusLabelBadge" src/components/squad/DecisionSummaryTab.tsx
→ 1

npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "DecisionSummaryTab"
→ 0 (no TypeScript errors)

npm test -- --run 2>&1 → 25 failed | 1353 passed | 34 skipped
  (25 failures are pre-existing: captain-picks.test.ts x5, club-form.test.ts x1,
   MobileNav.test.tsx x10, useRivals.test.ts x9 — none caused by this plan)
```

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All data flows through the existing `useLineupNews` hook boundary (already assessed in Phase 118/119-01/02 threat models). Team News Alert renders only `myTeamData.picks` (owned squad) ∩ `lineupNewsMap` (public lineup news) — consistent with T-119-03-03 disposition (accept: user already knows their own players).

## Known Stubs

None — `lineupNewsMap` is fully wired end-to-end: hook → `suggestTransfers` engine → OCS table badge, and hook → `flaggedPlayers` memo → Team News Alert section. No placeholder data paths.

## Self-Check: PASSED

Files exist:
- `src/components/squad/DecisionSummaryTab.tsx` — FOUND (modified)
- `src/lib/hooks/useLineupNews.ts` — FOUND (created/carried)
- `src/components/shared/StatusLabelBadge.tsx` — FOUND (created/carried)

Commits in git log:
- 66e63fe — Task 1 (UI-04 engine wiring + carry-ins) — FOUND
- bf18b9d — Task 2 (UI-03 Team News Alert) — FOUND
