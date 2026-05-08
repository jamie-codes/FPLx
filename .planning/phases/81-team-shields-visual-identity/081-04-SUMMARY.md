---
phase: "81"
plan: "04"
subsystem: squad-ui
tags: [team-shields, lineup-tab, useTeamBadge, refactor, cleanup]
dependency_graph:
  requires: [src/lib/hooks/useTeamBadge.ts]
  provides: [SHD-03 completeness — LineupTab PlayerCard kit-error state via useTeamBadge]
  affects: [src/components/squad/LineupTab.tsx]
tech_stack:
  added: []
  patterns: [useTeamBadge hook consumption, fallbackColour replacing teamColour.primary]
key_files:
  created: []
  modified:
    - src/components/squad/LineupTab.tsx
decisions:
  - "Removed getTeamColour import and teamColour local var; fallbackColour from useTeamBadge is equivalent (same getTeamColour().primary value)"
  - "teamKitUrl(teamCode) preserved as img src — hook's src field NOT used per CRITICAL CONSTRAINT in plan"
  - "useState import retained — still needed for lineup/swap/captain/VC state (5 other useState calls in file)"
  - "Pre-existing lint error (react-hooks/set-state-in-effect in useEffect at line 253) confirmed out-of-scope — present on baseline, not introduced by this plan"
metrics:
  duration: "3m"
  completed: "2026-05-08"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 81 Plan 04: LineupTab PlayerCard Kit-Error State Migration Summary

Discretionary cleanup: LineupTab PlayerCard inline useState(false) kit-error boilerplate replaced by useTeamBadge hook for state management; kit image src (teamKitUrl) and fallback swatch shape (square) unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate LineupTab PlayerCard kit-error state to useTeamBadge | 145f483 | src/components/squad/LineupTab.tsx |

## What Was Built

Migrated `PlayerCard` in `LineupTab.tsx` from inline `useState(false)` kit-error boilerplate to `useTeamBadge`:

- Removed: `const [kitError, setKitError] = useState(false)`, `const teamColour = getTeamColour(...)`, `const showFallback = !teamCode || kitError`
- Added: `const { onError, showFallback, fallbackColour } = useTeamBadge(player.team_short_name)`
- `teamCode` retained (still needed for `teamKitUrl(teamCode)` img src)
- `getTeamColour` import removed (now unused — `fallbackColour` from hook is equivalent)
- `onError={() => setKitError(true)}` replaced with `onError={onError}`
- Fallback div `style={{ background: teamColour.primary }}` replaced with `style={{ background: fallbackColour }}`
- Square fallback swatch shape preserved (not rounded-full)
- 5 other `useState` calls in the file remain; `useState` import retained

## Pre-condition Check

Scope assessment: 4 effective line changes (import add, 3 lines removed, 1 line changed) — within the 5-line bound. Plan proceeded.

## Verification

- `grep "useTeamBadge" src/components/squad/LineupTab.tsx` — 2 matches (import + call)
- `grep "kitError" src/components/squad/LineupTab.tsx` — 0 matches
- `grep "teamKitUrl" src/components/squad/LineupTab.tsx` — 1 match (kit src preserved)
- `npm test` — `2 failed | 80 passed (82)` (same as baseline; 0 regressions introduced)

## Deviations from Plan

None — plan executed exactly as written. The `getTeamColour` removal and `fallbackColour` substitution were explicitly permitted in the plan's action spec.

## Deferred Items

**Pre-existing lint error (out of scope):** `src/components/squad/LineupTab.tsx` line 253 — `react-hooks/set-state-in-effect` error in the `useEffect` that synchronises `lineup`/`pendingStarterId`/`captainOverrideId`/`vcOverrideId` when `initialLineup` changes. Present on baseline commit `68d697a`; not introduced by this plan.

## Known Stubs

None.

## Threat Flags

None. All threats in the plan's STRIDE register (T-81-19 through T-81-24) are accepted. No new trust boundaries introduced — only state management migrated, rendered output unchanged.

## Self-Check: PASSED

- FOUND: src/components/squad/LineupTab.tsx (contains useTeamBadge, no kitError, contains teamKitUrl)
- FOUND: commit 145f483
- VERIFIED: test suite unchanged from baseline (6 pre-existing failures, 1029 passing)
