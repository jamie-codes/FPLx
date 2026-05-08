---
phase: "81"
plan: "02"
subsystem: set-pieces
tags: [team-shields, ghost-watermark, tdd, vitest, react-hooks]
dependency_graph:
  requires: [src/lib/hooks/useTeamBadge.ts, src/lib/types.ts]
  provides: [SetPieceTakerCard sub-component with SHD-01 ghost watermark]
  affects: [src/components/set-pieces/SetPieceTakerPanel.tsx]
tech_stack:
  added: []
  patterns: [useState hook via useTeamBadge, sub-component extraction for hooks compliance, TDD RED-GREEN]
key_files:
  created:
    - src/components/set-pieces/SetPieceTakerPanel.test.tsx
  modified:
    - src/components/set-pieces/SetPieceTakerPanel.tsx
decisions:
  - "SetPieceTeam named type from types.ts used in SetPieceTakerCard props (not inline object type)"
  - "Ghost rendered with !showFallback && src double-guard — both CDN URL unknown and image-load error suppress ghost"
  - "No fallback swatch at ghost position per D-09 and UI-SPEC §4"
metrics:
  duration: "3m"
  completed: "2026-05-08T15:17:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 81 Plan 02: SetPieceTakerPanel Ghost Watermark Summary

Ghost crest watermark (56px, opacity-10, absolute bottom-right) added to each team card in SetPieceTakerPanel via extracted SetPieceTakerCard sub-component with useTeamBadge hook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SetPieceTakerPanel.test.tsx with failing SHD-01 tests | 3716744 | src/components/set-pieces/SetPieceTakerPanel.test.tsx |
| 2 | Extract SetPieceTakerCard + add ghost watermark (GREEN) | 2907631 | src/components/set-pieces/SetPieceTakerPanel.tsx |

## What Was Built

`SetPieceTakerCard` — a new sub-component extracted from `SetPieceTakerPanel`'s inline `.map()` body that:
- Calls `useTeamBadge(team.team_short_name)` at component top level (react-hooks/rules-of-hooks compliance)
- Renders a ghost `<img>` with `absolute bottom-0 right-0 w-14 h-14 opacity-10 pointer-events-none object-contain aria-hidden="true" alt=""` when `!showFallback && src`
- Suppresses the ghost entirely when `showFallback` is true (unknown team code or CDN image-load error) — no fallback swatch
- Card div carries `relative overflow-hidden` so the crest cannot bleed beyond rounded corners

`SetPieceTakerPanel.test.tsx` — 3 integration tests covering:
1. Card has `relative` and `overflow-hidden` classes
2. Ghost `<img>` renders with all required attributes for known team (ARS)
3. Unknown team (XYZ) renders no `<img>` and no `.rounded-full` swatch

## TDD Gate Compliance

- RED: test file written first, 2/3 tests failed (ghost elements absent), 1/3 passed (unknown team no-img — correct pre-condition)
- GREEN: implementation complete, all 3/3 tests pass

## Verification

- `npx vitest run src/components/set-pieces/SetPieceTakerPanel.test.tsx` — 3/3 tests pass (exit 0)
- `npm run lint src/components/set-pieces/SetPieceTakerPanel.tsx` — clean
- `grep "SetPieceTakerCard"` — 2 matches (definition + usage)
- `grep "useTeamBadge"` — 2 matches (import + call)
- `grep "relative overflow-hidden"` — 1 match
- `grep "eslint-disable-next-line @next/next/no-img-element"` — 1 match
- `pointer-events-none` non-comment count — 1

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All threats in the plan's STRIDE register (T-81-07 through T-81-12) are accepted. No new security surface introduced beyond what the plan accounts for.

## Self-Check: PASSED

- FOUND: src/components/set-pieces/SetPieceTakerPanel.test.tsx
- FOUND: src/components/set-pieces/SetPieceTakerPanel.tsx (modified)
- FOUND: commit 3716744
- FOUND: commit 2907631
