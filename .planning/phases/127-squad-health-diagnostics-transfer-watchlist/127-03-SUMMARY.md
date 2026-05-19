---
phase: 127
plan: 03
subsystem: watchlist components
tags:
  - components
  - watchlist
  - ui
dependency_graph:
  requires:
    - "127-01: PreSeasonSquadResponse + SquadHealth types"
    - "127-02: useWatchlist hook (consumed by page.tsx in Plan 04)"
  provides:
    - "src/components/watchlist/WatchlistPlayerCard.tsx: single pinned-player card"
    - "src/components/watchlist/WatchlistTab.tsx: Plan section Watchlist sub-tab shell"
  affects:
    - "Plan 04 (imports WatchlistTab from @/components/watchlist/WatchlistTab)"
tech_stack:
  added: []
  patterns:
    - "four-guard component pattern (loading/error/empty/populated)"
    - "extractSquad helper for pre-Plan-04/post-Plan-04 shape compatibility"
    - "useMemo unconditional placement above guard returns (rules-of-hooks)"
    - "set-difference for departed player detection"
key_files:
  created:
    - src/components/watchlist/WatchlistPlayerCard.tsx
    - src/components/watchlist/WatchlistPlayerCard.test.tsx
    - src/components/watchlist/WatchlistTab.tsx
    - src/components/watchlist/WatchlistTab.test.tsx
decisions:
  - "All useMemo hooks placed unconditionally above guard returns to satisfy rules-of-hooks"
  - "extractSquad handles legacy (PreSeasonSquad|null) and envelope (PreSeasonSquadResponse) shapes; deleted in Plan 04 once usePreSeasonSquad updates"
  - "void toggleWatchlist satisfies noUnusedParameters; prop reserved for Phase 128+ unpin UX"
  - "D-13 48h amber border delivered via lineupNewsSelect whole-map gate (RESEARCH.md Pitfall 4) — LineupNewsPlayer has no per-player news_added"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 127 Plan 03: WatchlistPlayerCard + WatchlistTab Components Summary

Plan 03 delivers the WatchlistTab sub-tab UI: bespoke WatchlistPlayerCard component and the WatchlistTab shell that fetches data through four stale-cached hooks, sorts cards by position, and handles all visual states.

## What Was Built

**Task 1 — WatchlistPlayerCard**

Created `src/components/watchlist/WatchlistPlayerCard.tsx`:
- `POSITION_LABELS` map: `{ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }`
- `WatchlistPlayerCardProps` exported interface with `player: MergedPlayer | { id: number }`, `departed`, `hasNews`, `inSquad`, `confirmedSigningTooltip?`
- Departed branch: renders id + Departed pill with opacity-50
- Non-departed branch: position badge, optional squad-overlap dot (`aria-label="In your pre-season squad"`), player name, `ConfirmedSigningBadge` (before price line, per WATCH-02), price + inline trend arrow, ownership %
- Border composition: zinc (normal) / amber (hasNews) / zinc + opacity-50 (departed)
- D-14 compliance: does NOT import `PriceTrendCell` or `NewsBanner`; DOES import `ConfirmedSigningBadge`

10/10 tests pass (departed, amber border, overlap dot, trend arrows, normal state, badge renders/not-renders, departed-wins rule).

**Task 2 — WatchlistTab**

Created `src/components/watchlist/WatchlistTab.tsx`:
- Calls four hooks: `usePlayers()`, `useLineupNews()`, `usePreSeasonSquad()`, `useTransferNews()`
- All `useMemo` hooks called unconditionally before guard returns (rules-of-hooks)
- `confirmedSigningMap` built via `buildConfirmedSigningMap(transferNewsFeed?.articles ?? [])` (mirrors GemTable.tsx)
- `playerMap` → `departedIds` → `squadIds` (via `extractSquad` helper) → `sortedPresentPlayers` → `sortedDepartedIds`
- Loading: `aria-busy="true"` skeleton grid
- Error: "Failed to load player data." copy
- Empty: "No players pinned yet. Tap ⭐..." copy
- Grid: `grid grid-cols-2 sm:grid-cols-3 gap-3` with present cards then departed stub cards
- Inline D-13 comment explaining RESEARCH.md Pitfall 4 whole-map gate semantics

9/9 WatchlistTab tests pass; 10/10 WatchlistPlayerCard tests pass (19 total).

## Verification

- `npx vitest run src/components/watchlist/` — 19/19 pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `extractSquad` is intentionally forward-compatible: it handles the legacy `PreSeasonSquad | null` return from the pre-Plan-04 hook AND the envelope `PreSeasonSquadResponse` shape delivered by Plan 04. This is a documented two-plan migration pattern, not a stub.

## Threat Flags

None. T-127-10 through T-127-13 per plan (ID exposure accepted, lineupNewsMap undefined → no border, stale gate deliberate).

## Self-Check: PASSED

Files exist:
- FOUND: src/components/watchlist/WatchlistPlayerCard.tsx
- FOUND: src/components/watchlist/WatchlistPlayerCard.test.tsx
- FOUND: src/components/watchlist/WatchlistTab.tsx
- FOUND: src/components/watchlist/WatchlistTab.test.tsx

Commit exists: 5fd060e
