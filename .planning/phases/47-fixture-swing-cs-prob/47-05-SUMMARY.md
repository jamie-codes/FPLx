---
plan: 47-05
phase: 47
status: complete
type: execute
wave: 3
human_verified: true
completed: 2026-05-01
---

# Plan 47-05: FixtureSwingDetector Component + Mount

## Objective

Build the `FixtureSwingDetector` panel and mount it on the Club Form tab — the user-visible delivery of SWG-01..SWG-04.

## What Was Built

### New Files
- `src/components/club-form/FixtureSwingDetector.tsx` (258 lines) — new panel component

### Modified Files
- `src/app/page.tsx` — added import + `<FixtureSwingDetector />` mount between `FixtureEaseRankingPanel` and `ClubFormTable`
- `src/app/page.test.tsx` — added `vi.mock` for `FixtureSwingDetector` (parallel to existing `FixtureEaseRankingPanel` mock)

## Implementation Details

**Component structure** (near-1:1 copy of `FixtureEaseRankingPanel` with Phase 47 diffs):
- `SWING_THRESHOLD = 0.20` (D-01 — 20% ease delta threshold)
- `ROW_CAP = 4` (D-02 — cap at 4 improving + 4 worsening)
- Two sections: Improving (green heading) and Worsening (amber heading), each sorted by absolute delta descending
- Window selector: `swingValue(team, win)` reads `swing_1gw/3gw/5gw` per the active GwToggle state (1/3/5)
- Past window fixed at 3 GW per D-04 — no AttDefToggle (D-04 specifies attacking ease only)
- BGW teams (null swing) silently excluded by `.filter(row => row.swing !== null && row.ease !== null)`
- Empty-state copy renders when no teams qualify in a direction

**Squad personalisation (SWG-04 / D-07):**
- `useTeamIdFromStorage()` helper reads `fpl-team-id` from localStorage (mirrors OptimiserPanel pattern)
- `useSquad(teamId)` provides squad picks
- `ownedTeamIds: Set<number>` — computed from squad picks + players data
- `ownedByTeam: Map<number, MergedPlayer[]>` — grouped for expand rows
- "You own N" badge appears only when the user has ≥1 player from that team
- Click/Enter/Space toggles expand; only one row open at a time (`expandedTeamId` state)

**Expanded sub-row:** Shows owned players as an inline mini-table (Player / Pos / xPts / Signal / Diff), not top-3 by xGI (plan spec difference vs. analog)

## Commits

- `bf31248`: feat(47-05): build FixtureSwingDetector component
- `7a116c3`: feat(47-05): mount FixtureSwingDetector on Club Form tab

## Deviations

None from plan spec. Executor correctly excluded `AttDefToggle`, `getTopPlayers`, and `xgiMap` (analog-only patterns).

## Self-Check: PASSED

- `npx tsc --noEmit` → exits 0 (only pre-existing `captain-picks.test.ts` errors)
- `npx vitest run src/app/page.test.tsx` → 7/7 pass
- `npm run build` → exits 0
- Human verification → approved (all UI flow steps 1–9 satisfied)

## Key Files

### key-files.created
- src/components/club-form/FixtureSwingDetector.tsx

### key-files.modified
- src/app/page.tsx
- src/app/page.test.tsx

## Requirements Covered

- SWG-01: Improving/worsening panel with 0.20 threshold ✓
- SWG-02: 4-team cap each direction, ranked by delta ✓
- SWG-03: 1/3/5 GW window toggle ✓
- SWG-04: "You own N" badge + expand interaction ✓
- CS-03: GemTable CS% column visible in Analysis preset (delivered by Plan 04, verified here) ✓
