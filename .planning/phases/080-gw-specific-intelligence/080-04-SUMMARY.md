---
phase: "080"
plan: "04"
subsystem: frontend
tags: [frontend, badge, set-pieces, transfers, integration, gw-intel]
dependency_graph:
  requires:
    - phase: "080-02"
      provides: [RotationRiskBadge component, MergedPlayer.rotation_risk field, usePlayers hook]
  provides:
    - SetPieceTakerPanel team headers showing RotationRiskBadge per team (GWI-01 D-16)
    - OpportunityCostTable buy-player rows showing RotationRiskBadge adjacent to web_name (GWI-01 D-17)
  affects: []
tech-stack:
  added: []
  patterns:
    - "useMemo aggregates player-level rotation_risk to team-level boolean map (team_id -> any-player-flagged)"
    - "RotationRiskBadge returns null when false — no layout shift, no extra whitespace beyond existing gap-x-2"
    - "Badge added inline in flex row after existing label text — gap-2 on SetPieceTakerPanel p, gap-x-2 on OCS transfer row"
key-files:
  created: []
  modified:
    - src/components/set-pieces/SetPieceTakerPanel.tsx
    - src/components/transfers/OpportunityCostTable.tsx
key-decisions:
  - "rotationRiskByTeam memo aggregates player-level flag to team-level: any player on team with rotation_risk=true sets team flag"
  - "Badge attaches only to BUY player in OpportunityCostTable, not SELL — per D-17 spec (candidate = incoming player)"
  - "usePlayers() call in SetPieceTakerPanel deduplicates via React Query cache (same queryKey ['players'] as other components)"
  - "playersData ?? [] short-circuits gracefully when players data is loading — no team shows badge until data resolves"
requirements-completed: [GWI-01]
duration: ~3min
completed: "2026-05-08"
---

# Phase 080 Plan 04: RotationRiskBadge Integration in SetPieceTakerPanel + OpportunityCostTable Summary

**RotationRiskBadge surfaced in two decision-facing UIs — SetPieceTakerPanel team headers (D-16) and OpportunityCostTable buy-player rows (D-17) — completing GWI-01 end-to-end from pipeline flag to visible warning**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-05-08
- **Tasks:** 2/2
- **Files modified:** 2 (both modified)

## Accomplishments

- Added `useMemo`, `usePlayers`, `RotationRiskBadge` imports to `SetPieceTakerPanel.tsx`
- Derived `rotationRiskByTeam: Record<number, boolean>` memo — aggregates `any-player-on-team` rotation risk to team-level boolean
- Team header `<p>` converted to flex row: `{team.team_short_name}` + `<RotationRiskBadge rotationRisk={rotationRiskByTeam[team.team_id] ?? false} />`
- Added `RotationRiskBadge` import to `OpportunityCostTable.tsx`
- Badge rendered after `{t.buy.web_name}` span in `PlayerMoveCell` — `<RotationRiskBadge rotationRisk={t.buy.rotation_risk ?? false} />`
- Sell player NOT decorated — buy candidate only (per D-17)
- All 7 transfer tests pass; 4 RotationRiskBadge tests pass; tsc exits 0

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add RotationRiskBadge to SetPieceTakerPanel team headers | cf86980 | src/components/set-pieces/SetPieceTakerPanel.tsx |
| 2 | Add RotationRiskBadge to OpportunityCostTable buy-player rows | bffe4b0 | src/components/transfers/OpportunityCostTable.tsx |

## Visual Changes

### SetPieceTakerPanel

- Team section header `<p>` is now `flex items-center gap-2` containing a `<span>` for the short name and the badge
- When a team has any player with `rotation_risk=true`, the ⚡ Rotation risk warning pill appears inline after the team name
- When no player on the team is flagged, badge returns null — no visual change from pre-Plan-04 state

### OpportunityCostTable

- Each non-roll transfer row's buy-player now shows the badge inline after the player name
- Parent `flex flex-wrap items-center gap-x-2` already provides correct spacing — no CSS changes required
- Badge is only rendered when `t.buy.rotation_risk` is truthy; null return when false/undefined produces no layout shift

## Deviations from Plan

None — plan executed exactly as written. The acceptance criterion `grep -c "rotationRiskByTeam" >= 3` in Task 1 was noted as unreachable with correct code (the variable naturally appears twice: declaration + JSX usage); the plan comment "return-from-memo" refers to `return map` inside the callback, not a third occurrence of `rotationRiskByTeam`. All other acceptance criteria passed exactly.

## Known Stubs

None — both components render live data-driven output. Badge appears only when `rotation_risk=true` in `merged_players.json`; silent null return otherwise.

## Threat Flags

No new threat surface beyond plan's threat model:
- T-080-21: XSS — accept (static string literals only in badge, boolean prop)
- T-080-22: Information Disclosure — accept (public FPL data, no PII)
- T-080-23: DoS via large players iteration — mitigate (useMemo, ~700 iterations <1ms)

## Open Visual Checkpoints (Developer)

1. **Set Pieces tab**: With pipeline-run `merged_players.json` containing at least one team flagged `rotation_risk=true`, navigate to Set Pieces tab — that team's section header should show ⚡ Rotation risk badge inline after team name.
2. **Plan → Transfers tab (OCS table)**: With at least one buy candidate from a rotation-risk team, the OCS row for that candidate should show ⚡ Rotation risk badge inline after the player name in the Player Move column.
3. **No badge on unflagged teams**: Teams without any `rotation_risk=true` player should show clean headers with no badge.
4. **Sell player clean**: The sell player's name in OCS rows should never show the badge.

## GWI-01 Completion

Plan 01 wrote `rotation_risk` to `merged_players.json` (pipeline).
Plan 02 added `MergedPlayer.rotation_risk?: boolean` (types), created `RotationRiskBadge` component.
Plan 04 (this plan) surfaces the flag in the two decision-facing UIs where it matters.
GWI-01 is fully met end-to-end.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/components/set-pieces/SetPieceTakerPanel.tsx modified | FOUND |
| src/components/transfers/OpportunityCostTable.tsx modified | FOUND |
| commit cf86980 (Task 1) | FOUND |
| commit bffe4b0 (Task 2) | FOUND |
| 7/7 transfer tests pass | PASS |
| 4/4 RotationRiskBadge tests pass | PASS |
| tsc --noEmit exits 0 | PASS |
| import RotationRiskBadge in SetPieceTakerPanel | PASS |
| import RotationRiskBadge in OpportunityCostTable | PASS |
| rotationRiskByTeam memo present | PASS |
| Badge on BUY only (not SELL) | PASS |
