---
phase: 058-mini-league-rival-tracker
plan: 03
subsystem: ui-components
tags: [ui, react, rivals, rival-summary-table, rival-detail-panel, rivals-tab]

# Dependency graph
requires:
  - phase: 058-01
    provides: "RivalEntry, RivalPick, RivalLeagueResult types; useRivals hook; rivals-adapter"
  - phase: 058-02
    provides: "six pure rival-intel functions: computeShared, computeUserAdvantage, computePositionMedians, computeRivalThreats, computeBlockingMoves, computeCaptainEdge"
provides:
  - src/components/rivals/RivalsTab.tsx: Entry-point container with form, useRivals consumer, layout
  - src/components/rivals/RivalSummaryTable.tsx: Ranked rival table with row selection
  - src/components/rivals/RivalDetailPanel.tsx: Five-stack differential intelligence panel
  - src/components/rivals/RivalSummaryTable.test.tsx: 8 tests (ML-02, interaction, sign formatting)
  - src/components/rivals/RivalDetailPanel.test.tsx: 11 tests (ML-03/04/05/06/07 + section ordering + empty copy)
affects: [058-04-page-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RivalsTab: useMemo for playerById, playerNameById, posMedians, userPickIds, transferSuggestions, userCaptainCandidate, selectedRival — prevents recompute per rival row selection"
    - "useRivals(submittedLeagueId, submittedId) wiring: submittedId (user team ID from page.tsx) passed as userTeamId — hook derives userRank from standings response; rankGap = rival.rank - userRank"
    - "RivalSummaryTable: rankGap sign flip — display = -gap (negative gap = user better rank = green +N)"
    - "RivalDetailPanel: blocking moves deduped by buy.id across all suggestions to prevent duplicate chips"
    - "CaptainEdge: edge.toFixed(1) then Number() before sign check — avoids -0.0 sign issues"
    - "localStorage reads wrapped in try/catch (SSR safety pattern mirroring page.tsx)"

key-files:
  created:
    - src/components/rivals/RivalsTab.tsx
    - src/components/rivals/RivalSummaryTable.tsx
    - src/components/rivals/RivalDetailPanel.tsx
    - src/components/rivals/RivalSummaryTable.test.tsx
    - src/components/rivals/RivalDetailPanel.test.tsx
  modified: []

key-decisions:
  - "rankGap sign convention: RivalEntry.rankGap = rival.rank - userRank (negative = user better). Display flips: display = -gap, so user ahead → +N green, rival ahead → −N red. Consistent with UI-SPEC D-06."
  - "computeEOCandidates(playersData, 'max_xpts', 1) for userCaptainCandidate — mirrors RESEARCH.md A2 assumption; top-xPts player from full pool as captain candidate when squad not loaded"
  - "Blocking players list deduped by buy.id across all matching suggestions — prevents same player appearing twice when two transfer suggestions share a buy"
  - "suggestTransfers called once with ftCount=1, bank=squadData.entry_history.bank, empty sellPrices — matches D-09 and falls back to now_cost when unauthenticated per suggest-transfers.ts L63-66"

requirements-completed: [ML-01, ML-02, ML-03, ML-04, ML-05, ML-06, ML-07, ML-08]

# Metrics
duration: 4min
completed: 2026-05-04
---

# Phase 58 Plan 03: Mini-League Rival Tracker — UI Components Summary

**Three React components (RivalsTab container, RivalSummaryTable, RivalDetailPanel) with 19 tests covering all five differential intelligence sections and ML-02 through ML-08 requirements**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-04T07:49:55Z
- **Completed:** 2026-05-04T07:53:55Z
- **Tasks:** 3
- **Files modified:** 5 (5 created, 0 modified)

## Accomplishments

- Created `src/components/rivals/RivalSummaryTable.tsx`: 5-column ranked table (Rank, Manager Name, Rank Gap, Captain, Chips Remaining); em-dash pre-deadline; selected-row highlight (`bg-zinc-100 dark:bg-zinc-800`); Captain and Chips Remaining columns hidden on mobile (`hidden sm:table-cell`); rank gap sign flip (user ahead = +N green, rival ahead = −N red)
- Created `src/components/rivals/RivalSummaryTable.test.tsx`: 8 tests covering all column headers, ML-02 em-dash, post-deadline captain name, None remaining / comma-join chips, click→onSelect, selected-row class, rank gap sign formatting
- Created `src/components/rivals/RivalDetailPanel.tsx`: Five stacked sections in spec order — Captain Edge, Shared with [Rival], Your Advantage, Rival Threats, Blocking Transfers; player chip pattern (web_name + xPts label); signed captain edge (+/−X.X xPts vs [name]); section-specific empty copy; blocking moves deduped by buy.id
- Created `src/components/rivals/RivalDetailPanel.test.tsx`: 11 tests covering placeholder (null rival), section order, ML-07 pre/post-deadline captain edge (positive and negative), ML-03 shared, ML-04 advantage, ML-05 threats (hit and empty), ML-06 blocking (hit and empty)
- Created `src/components/rivals/RivalsTab.tsx`: integrating container; localStorage key `fplx_mini_league_id`; numeric input guard; `useRivals(submittedLeagueId, submittedId)` wiring (ML-02 rankGap fix); 7 memoized derived values; `suggestTransfers` called once; `computeEOCandidates` for captain candidate; leagueTruncated note; loading/error states; 48px touch target

## Task Commits

1. **Task 1: RivalSummaryTable + 8 tests** — `039a439` (feat)
2. **Task 2: RivalDetailPanel + 11 tests** — `45fe057` (feat)
3. **Task 3: RivalsTab container** — `c2570b8` (feat)

## Files Created/Modified

- `src/components/rivals/RivalSummaryTable.tsx` — 5-column table, mobile hiding, rank-gap sign flip, selected-row highlight
- `src/components/rivals/RivalSummaryTable.test.tsx` — 8 tests: ML-02, interaction, sign formatting
- `src/components/rivals/RivalDetailPanel.tsx` — five sections, captain edge, player chips, empty copy
- `src/components/rivals/RivalDetailPanel.test.tsx` — 11 tests: ML-03/04/05/06/07 + section order + placeholder
- `src/components/rivals/RivalsTab.tsx` — container: form, hooks, memos, layout

## Exported Function Signatures

```typescript
// RivalSummaryTable.tsx
export function RivalSummaryTable({
  rivals: RivalEntry[]
  selectedRivalId: number | null
  onSelect: (entryId: number) => void
  playerNameById: Map<number, string>
}: RivalSummaryTableProps): JSX.Element

// RivalDetailPanel.tsx
export function RivalDetailPanel({
  rival: RivalEntry | null
  userPickIds: Set<number>
  playerById: Map<number, MergedPlayer>
  posMedians: Map<PositionCode, number>
  userCaptainCandidate: MergedPlayer | null
  transferSuggestions: TransferSuggestion[]
}: RivalDetailPanelProps): JSX.Element

// RivalsTab.tsx
export function RivalsTab({ submittedId: string | null }: RivalsTabProps): JSX.Element
```

## Decisions Made

- **rankGap sign flip for display:** `RivalEntry.rankGap = rival.rank - userRank` (negative = user better ranked). UI-SPEC says green = user ahead. Display formula: `display = -gap` — positive display means user ahead, shown as +N green. Equal to 0 shown as zinc.
- **userCaptainCandidate via computeEOCandidates:** When no squad is loaded, the captain edge section falls back to null (the `computeCaptainEdge` function handles it). When squad IS loaded, the user's top-xPts player is used as the captain candidate (RESEARCH.md A2 assumption — the plan does not require wiring the actual captain pick from the squad data for Wave 3).
- **Blocking moves deduplication:** A single buy player may appear across multiple transfer suggestions. Deduping by `buy.id` prevents the same chip appearing multiple times in the Blocking Transfers section.

## Deviations from Plan

None — plan executed exactly as written. All three components match the plan's code examples. All acceptance criteria verified.

## Known Stubs

None — all data flows wired. `suggestTransfers` uses `bank: squadData.entry_history.bank` (real bank balance when squad is loaded). `computeEOCandidates` receives real `playersData`. No placeholder values.

## Threat Flags

No new threat surface beyond the plan's threat model. T-58-08 through T-58-11 all mitigated:
- T-58-08: `/^\d+$/.test(trimmed)` in `isValidLeagueId`; submit disabled when invalid
- T-58-09: leagueId is public FPL data; localStorage key namespaced `fplx_mini_league_id`
- T-58-10: 7 `useMemo` wraps in RivalsTab prevent recomputation on rival row selection
- T-58-11: `playerById` derived from Zod-validated `/api/players` — no untrusted input path

## Self-Check

- `src/components/rivals/RivalSummaryTable.tsx` exists: FOUND
- `src/components/rivals/RivalDetailPanel.tsx` exists: FOUND
- `src/components/rivals/RivalsTab.tsx` exists: FOUND
- `src/components/rivals/RivalSummaryTable.test.tsx` exists: FOUND
- `src/components/rivals/RivalDetailPanel.test.tsx` exists: FOUND
- Task 1 commit `039a439`: FOUND
- Task 2 commit `45fe057`: FOUND
- Task 3 commit `c2570b8`: FOUND
- RivalSummaryTable test count: 8 (≥8 required)
- RivalDetailPanel test count: 11 (≥11 required)
- Full Phase 58 suite: 52 tests passing (0 failures)
- TypeScript `--noEmit`: exits 0

## Self-Check: PASSED

---
*Phase: 058-mini-league-rival-tracker*
*Completed: 2026-05-04*
