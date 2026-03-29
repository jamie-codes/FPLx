---
phase: 05-squad-view-transfer-suggestions
plan: 03
subsystem: squad-ui-layer
tags: [react, tailwind, use-client, squad-view, transfer-panel, tab-navigation]
dependency_graph:
  requires: [05-01, 05-02, src/lib/hooks/useSquad.ts, src/lib/hooks/usePlayers.ts, src/lib/transfer-engine.ts, src/lib/gem-score.ts]
  provides: [src/components/squad/SquadView.tsx, src/components/transfers/TransferPanel.tsx]
  affects: [src/app/page.tsx]
tech_stack:
  added: []
  patterns: [use-client, useMemo-for-pure-compute, controlled-form-inputs, conditional-render-by-result-type]
key_files:
  created:
    - src/components/squad/SquadView.tsx
    - src/components/transfers/TransferPanel.tsx
  modified:
    - src/app/page.tsx
decisions:
  - "SquadView receives allPlayers as ScoredPlayer[] so gem_score is available for display — no re-scoring inside the component"
  - "TransferPanel manages submittedId separately from teamId input so squad does not reload on every keystroke"
  - "Bench detection uses pick.position >= 12 — consistent with transfer engine's starting XI filter (positions 1-11)"
metrics:
  duration_seconds: 745
  completed_date: "2026-03-29"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 5 Plan 3: Squad View & Transfer Suggestions UI Summary

**One-liner:** `SquadView` component renders 15 players split GK/DEF/MID/FWD with approx prices, status badges, captain markers; `TransferPanel` wires `useSquad` + `usePlayers` + `computeTransferSuggestions` into Team ID input, chip warnings, save recommendation, and ranked transfer suggestions — surfaced via new "Squad & Transfers" tab in `page.tsx`.

## What Was Built

Three files form the complete user-facing squad and transfer suggestions layer:

1. **`src/components/squad/SquadView.tsx`** — `'use client'` component receiving `picks`, `allPlayers`, and `entryHistory`. Cross-references picks by `element` id to get full `ScoredPlayer` data. Groups by `element_type` integer (1/2/3/4), sorts within each group by `pick.position`. Renders: name, team_short_name, price as `now_cost/10` with `(approx)` label, `selected_by_percent`, `minutes`, `gem_score`. Status badge (green/amber/red) with injury `news` as `title` tooltip. Captain `(C)` and vice-captain `(VC)` markers. Bench players (`position >= 12`) dimmed with `opacity-50`. Budget summary bar shows `entryHistory.bank / 10` and `entryHistory.value / 10` both labelled `(approx)`.

2. **`src/components/transfers/TransferPanel.tsx`** — `'use client'` component managing `teamId` (input), `submittedId` (submitted), and `freeTransfers` (default 1). Calls `useSquad(submittedId)` and `usePlayers()`. Computes `scoredPlayers` and `transferResult` via `useMemo`. Renders: loading state, error banner, `<SquadView>`, chip warning boxes (amber for Free Hit, blue for Wildcard), green save recommendation, and ranked suggestions list with sell→buy arrows, gem_delta, approx cost, and affordable/over-budget badges. 2-transfer combo section when applicable. Approx disclaimer note.

3. **`src/app/page.tsx`** (modified) — Added `TransferPanel` import, extended `Tab` type to `'gems' | 'defcon' | 'squad'`, added "Squad & Transfers" tab button with matching active-state styling, and `{activeTab === 'squad' && <TransferPanel />}` conditional render.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SquadView component | e166c2d | src/components/squad/SquadView.tsx |
| 2 | Create TransferPanel component | 3cc282e | src/components/transfers/TransferPanel.tsx |
| 3 | Wire TransferPanel into page.tsx | a44181b | src/app/page.tsx |

## Verification Results

- `npx next build` — builds without errors after each task
- `npx vitest run` — full suite 69/69 tests pass (no regressions)
- Build output confirms static `/` route and dynamic `/api/squad/[teamId]` route intact

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows through real hooks and the transfer engine. No hardcoded empty values, placeholder text, or mock data.

## Self-Check: PASSED

Files exist:
- FOUND: src/components/squad/SquadView.tsx
- FOUND: src/components/transfers/TransferPanel.tsx
- FOUND: src/app/page.tsx (contains Squad & Transfers tab)

Commits exist:
- FOUND: e166c2d (SquadView component)
- FOUND: 3cc282e (TransferPanel component)
- FOUND: a44181b (page.tsx tab update)
