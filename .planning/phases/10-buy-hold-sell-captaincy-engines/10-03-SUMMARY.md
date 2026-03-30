---
phase: 10-buy-hold-sell-captaincy-engines
plan: 03
subsystem: ui
tags: [react, tailwind, verdict-badge, captaincy-panel, squad-view, transfer-panel]

# Dependency graph
requires:
  - phase: 10-01
    provides: computeVerdicts, Verdict type from recommend.ts
  - phase: 10-02
    provides: computeCaptaincyCandidates, CaptaincyCandidate from captaincy-engine.ts

provides:
  - VerdictBadge component (Buy/Hold/Sell semantic badge)
  - CaptaincyPanel component with inline CaptainTypeBadge
  - SquadView Rec column wired to verdict map
  - TransferPanel wired with computeVerdicts and computeCaptaincyCandidates useMemo blocks

affects: [transfers, squad-view, captaincy, verdict-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Badge components follow MinsRiskBadge.tsx pattern: config map + span with inline-block text-xs font-normal"
    - "Optional verdicts prop on SquadView: Map<number, Verdict> keyed by player element id"
    - "useMemo for verdicts and captaincyCandidates in TransferPanel alongside existing transferResult"
    - "nextGw derived as entry_history.event + 1 in TransferPanel"

key-files:
  created:
    - src/components/shared/VerdictBadge.tsx
    - src/components/captaincy/CaptaincyPanel.tsx
  modified:
    - src/components/squad/SquadView.tsx
    - src/components/transfers/TransferPanel.tsx

key-decisions:
  - "CaptainTypeBadge is inline in CaptaincyPanel.tsx (not a separate file) — co-location reduces indirection for a component only used there"
  - "VerdictBadge returns null for null verdict — empty Rec cell for bench players handled at SquadView row level"
  - "captaincyCandidates.length > 0 guard prevents CaptaincyPanel render when no squad is loaded or no candidates exist"

patterns-established:
  - "Badge config map pattern: Record<verdict/type, {bg, text, label, title}> — reusable, DRY, matches MinsRiskBadge"
  - "Optional Map prop for SquadView: parent computes, child reads — no recomputation inside SquadView"

requirements-completed: [REC-01, CAP-01, CAP-02]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 10 Plan 03: Buy/Hold/Sell + Captaincy UI Summary

**VerdictBadge and CaptaincyPanel surfaced to user in TransferPanel — Buy/Hold/Sell badges in SquadView Rec column, ranked captaincy picks with projected captain pts, safe/upside type, and mins risk below squad.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-30T14:10:00Z
- **Completed:** 2026-03-30T14:17:50Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint — awaiting user confirmation)
- **Files modified:** 4

## Accomplishments

- Created VerdictBadge (Buy=green-100, Hold=zinc-100, Sell=red-100) following MinsRiskBadge badge pattern
- Created CaptaincyPanel with inline CaptainTypeBadge (Safe=blue-100, Upside=amber-100), rendering ranked candidates with projected pts, type badge, and MinsRisk badge
- Extended SquadView with optional `verdicts` prop and new "Rec" column — starting-XI shows badge, bench shows empty cell
- Wired TransferPanel with two useMemo blocks (verdicts, captaincyCandidates), nextGw derivation, and CaptaincyPanel render below squad

## Task Commits

1. **Task 1: Create VerdictBadge and CaptaincyPanel components** - `b520aeb` (feat)
2. **Task 2: Wire verdicts and captaincy into SquadView and TransferPanel** - `0a5c1ca` (feat)
3. **Task 3: Verify Buy/Hold/Sell + Captaincy UI** - PENDING (checkpoint:human-verify)

## Files Created/Modified

- `src/components/shared/VerdictBadge.tsx` - Buy/Hold/Sell badge component, renders null for bench/missing
- `src/components/captaincy/CaptaincyPanel.tsx` - Captaincy ranking panel with inline CaptainTypeBadge and MinsRiskBadge
- `src/components/squad/SquadView.tsx` - Added Rec column header + cell, verdicts optional prop, VerdictBadge import
- `src/components/transfers/TransferPanel.tsx` - Added computeVerdicts/computeCaptaincyCandidates useMemo, nextGw, CaptaincyPanel render

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript error in tests/lib/captaincy-engine.test.ts (line 225, duplicate object key from Plan 02 test) was out of scope and not caused by this plan's changes.

## Known Stubs

None. All data flows are wired: computeVerdicts and computeCaptaincyCandidates are called with live scoredPlayers and squadData; VerdictBadge and CaptaincyPanel render real engine output.

## Self-Check: PASSED

- src/components/shared/VerdictBadge.tsx: FOUND
- src/components/captaincy/CaptaincyPanel.tsx: FOUND
- src/components/squad/SquadView.tsx: FOUND (modified)
- src/components/transfers/TransferPanel.tsx: FOUND (modified)
- Commit b520aeb: FOUND
- Commit 0a5c1ca: FOUND
- All 125 Vitest tests pass
