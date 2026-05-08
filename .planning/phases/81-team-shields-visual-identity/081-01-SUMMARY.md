---
phase: "81"
plan: "01"
subsystem: hooks
tags: [team-shields, hooks, tdd, vitest]
dependency_graph:
  requires: [src/lib/fpl-images.ts, src/lib/team-colours.ts]
  provides: [src/lib/hooks/useTeamBadge.ts]
  affects: []
tech_stack:
  added: []
  patterns: [useState hook, TDD RED-GREEN]
key_files:
  created:
    - src/lib/hooks/useTeamBadge.ts
    - src/lib/hooks/useTeamBadge.test.ts
  modified: []
decisions:
  - "D-07 UseTeamBadgeResult interface: src|null, onError, showFallback, fallbackColour, initial — locked contract for downstream plans 02/03"
  - "Direct TEAM_BADGE_CODE[shortName] map lookup (not via getTeamBadgeCode wrapper) per plan verification requirement"
metrics:
  duration: "1m"
  completed: "2026-05-08T14:11:59Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Phase 81 Plan 01: useTeamBadge Hook Summary

useTeamBadge hook implementing PL CDN crest URL resolution, image-load error state, and fallback styling via TEAM_BADGE_CODE map lookup and getTeamColour().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useTeamBadge hook with unit tests (RED→GREEN) | 6a974da | src/lib/hooks/useTeamBadge.ts, src/lib/hooks/useTeamBadge.test.ts |

## What Was Built

`useTeamBadge(shortName)` — a pure `useState` React hook that:
- Returns `src` as the full PL CDN badge URL (`https://resources.premierleague.com/premierleague/badges/t{code}.png`) for known shortNames, or `null` for unknown
- Tracks an `imgError` flag via `onError()` callback; when flipped, forces `showFallback` to `true`
- Exposes `showFallback` (true when `src === null` OR `imgError === true`)
- Exposes `fallbackColour` from `getTeamColour(shortName).primary` (returns `#71717A` safe default for unknown teams)
- Exposes `initial` as `shortName[0] ?? '?'`

## TDD Gate Compliance

- RED: test file written first, ran and failed (import error — module did not exist)
- GREEN: hook implemented, all 5 tests pass (`vitest run` exit 0)
- REFACTOR: not required — implementation was already clean

## Verification

- `npx vitest run src/lib/hooks/useTeamBadge.test.ts` — 5/5 tests pass
- `npm run lint` — clean on both files
- `useTeamBadge.ts` line 1: `'use client'`
- `useTeamBadge.ts` contains `TEAM_BADGE_CODE[shortName]` direct lookup
- Zero modifications to existing files (purely additive)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All threats in the plan's STRIDE register are accepted (public CDN URLs, no auth logic, no API routes, no data writes). No new surface introduced beyond what the plan accounts for.

## Self-Check: PASSED

- FOUND: src/lib/hooks/useTeamBadge.ts
- FOUND: src/lib/hooks/useTeamBadge.test.ts
- FOUND: commit 6a974da
