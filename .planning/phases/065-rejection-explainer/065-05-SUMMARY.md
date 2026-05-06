---
phase: 65
plan: 05
subsystem: components
tags: [rejection-explainer, transfer-panel, squad-view, prop-threading, why-02, why-03]
dependency_graph:
  requires:
    - 065-02 (computeVerdicts + Verdict type from recommend.ts)
    - 065-03 (HighOwnershipCallout component + HighOwnershipEntry type; ExplainPanel rejectionReasons prop)
  provides:
    - src/components/transfers/TransferPanel.tsx (WHY-02 callout integration + WHY-03 prop threading to SquadView)
    - src/components/squad/SquadView.tsx (WHY-03 per-player rejection reasons passed through ExplainPanel)
  affects:
    - End-to-end rejection explainer feature: TransferPanel callout + SquadView per-player panel now wired
tech_stack:
  added: []
  patterns:
    - useMemo derivation for highOwnershipAbsent (parseFloat ownership, kind-narrowing, cap at 3)
    - useMemo for verdicts (computeVerdicts delegation to recommend.ts)
    - prop threading: verdicts + captaincyCandidates from TransferPanel -> SquadView -> ExplainPanel
    - in-IIFE rejection-reasons computation inside SquadView expand block
    - captain rejection line with D-09 guard (topCap.player.id !== player.id)
key_files:
  created: []
  modified:
    - src/components/transfers/TransferPanel.tsx
    - src/components/squad/SquadView.tsx
decisions:
  - "verdicts useMemo defaults to new Map() (not undefined) — stable reference even when squadData is null"
  - "highOwnershipAbsent uses startingXiByPos pre-computed map for in-squad rank (RESEARCH Open Q2: starters only at that position, position < 12)"
  - "ScoredPlayer type imported into TransferPanel alongside ClubForm on the same import line from @/lib/types"
  - "captain rejection rank label: capIndex === -1 uses '?' string (defensive path for GKs/injured players not in captaincy list)"
metrics:
  duration: 3m
  completed: 2026-05-06
---

# Phase 65 Plan 05: TransferPanel + SquadView Wire-Up Summary

**One-liner:** TransferPanel derives highOwnershipAbsent and verdicts useMemos and renders WHY-02 callout above OCS table; SquadView threads new props to compute per-player WHY-03 rejection reasons including captain D-09 guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TransferPanel: derive highOwnershipAbsent + verdicts useMemos, render HighOwnershipCallout above OCS, thread props to SquadView | a528019 | src/components/transfers/TransferPanel.tsx |
| 2 | SquadView: accept verdicts + captaincyCandidates, derive per-player rejectionReasons, pass to ExplainPanel | 1c992e0 | src/components/squad/SquadView.tsx |

## TransferPanel Diff Summary (Task 1)

Five edits applied to `src/components/transfers/TransferPanel.tsx`:

**Edit A — New imports (lines 18-19):**
```typescript
import { computeVerdicts } from '@/lib/recommend'
import { HighOwnershipCallout, type HighOwnershipEntry } from '@/components/transfers/HighOwnershipCallout'
```
Also added `ScoredPlayer` to the existing `@/lib/types` import.

**Edit B — verdicts useMemo (after captaincyCandidates):**
```typescript
const verdicts = useMemo(() => {
  if (!squadData || scoredPlayers.length === 0) return new Map()
  return computeVerdicts(squadData.picks, scoredPlayers)
}, [squadData, scoredPlayers])
```

**Edit C — highOwnershipAbsent useMemo (after ocsRows):**
- Filters `scoredPlayers` to `parseFloat(selected_by_percent) > 20`
- Builds `suggestedBuyIds` set from `ocsSuggestions` using kind-narrowing pattern
- Pre-computes `startingXiByPos` (starters only, sorted by xPts_1gw desc)
- Sorts desc by ownership, slices to 3, maps to `HighOwnershipEntry[]` with inSquad + squadRank + posCode

**Edit D — HighOwnershipCallout rendered above OCS card:**
```tsx
<HighOwnershipCallout entries={highOwnershipAbsent} />
<div className="rounded border ...">  {/* OCS section */}
```

**Edit E — SquadView props extended:**
```tsx
<SquadView
  ...
  verdicts={verdicts}
  captaincyCandidates={captaincyCandidates}
/>
```

## SquadView Diff Summary (Task 2)

Four edits applied to `src/components/squad/SquadView.tsx`:

**Edit A — New imports (after ExplainPanel import):**
```typescript
import { computeFragility } from '@/lib/sensitivity'
import type { Verdict } from '@/lib/recommend'
import type { CaptaincyCandidate } from '@/lib/captaincy-engine'
```

**Edit B — SquadViewProps extended:**
```typescript
verdicts?: Map<number, Verdict>               // Phase 65 WHY-03 (D-10)
captaincyCandidates?: CaptaincyCandidate[]    // Phase 65 WHY-03 (D-10)
```

**Edit C — Function signature destructuring:** Added `verdicts, captaincyCandidates` to destructuring.

**Edit D — Expand IIFE rejection-reasons derivation:**
```typescript
const rejectionReasons: string[] = []
if (verdicts && captaincyCandidates) {
  const verdict = verdicts.get(player.id)
  if (verdict === 'sell' || verdict === 'hold') {
    if (verdict === 'sell') {
      rejectionReasons.push('Below xPts hold threshold — consider rotating')
    }
    const { reasons: fragReasons } = computeFragility(player, false)
    for (const r of fragReasons) {
      if (r === 'start_prob < 70%') {
        rejectionReasons.push(`Rotation risk — start probability ${Math.round(player.start_prob * 100)}%`)
      } else if (r === 'harder fixture') {
        rejectionReasons.push('Difficult fixture this gameweek')
      }
    }
    // Captain rejection (D-09)
    const capIndex = captaincyCandidates.findIndex(c => c.player.id === player.id)
    const topCap = captaincyCandidates[0]
    if (topCap && topCap.player.id !== player.id) {
      const rank = capIndex === -1 ? '?' : String(capIndex + 1)
      rejectionReasons.push(
        `Ranked #${rank} at ${POSITION_LABELS[player.element_type]} by xPts — ${topCap.player.web_name} is the captain pick`
      )
    }
  }
}
// ExplainPanel called with rejectionReasons passed
```

## Test Run Output

```
Wave 0 contract tests (all three suites):
 Test Files  3 passed (3)
      Tests  28 passed (28)
   Duration  609ms

Adjacent regression scan (src/components/squad/ + src/components/transfers/):
 Test Files  5 passed (5)
      Tests  35 passed (35)
   Duration  832ms
```

TypeScript: `npx tsc --noEmit` — zero errors.

## Manual UAT (Task 3)

This plan requires manual UAT (12 verification steps in Task 3 checkpoint). Implementation tasks
1 and 2 are complete. Verification requires starting the dev server with a real FPL Team ID
and checking:
- WHY-02 callout appears above Transfer Opportunity Cost card with correct in-squad / not-in-squad copy
- WHY-03 SquadView expand shows rejection section in correct DOM order for sell-verdicted players
- D-09 captain guard: top captain candidate has no captain rejection line
- Bench player guard: no expand chevron / no rejection section for bench players

## Deviations from Plan

None — plan executed exactly as written. All five TransferPanel edits and four SquadView edits
applied per plan specification. All acceptance criteria verified.

## Known Stubs

None — TransferPanel callout and SquadView rejection reasons are fully wired. The only remaining
integration gap is manual UAT confirmation (Task 3 checkpoint).

## Threat Flags

None — pure UI integration over trusted in-memory data. T-65-06 and T-65-07 from plan threat
model are satisfied by React automatic JSX text-node escaping (web_name interpolated into
string array items rendered as `<li>{reason}</li>` text nodes, no dangerouslySetInnerHTML).

## Self-Check: PASSED

Files exist:
- src/components/transfers/TransferPanel.tsx: FOUND (modified)
- src/components/squad/SquadView.tsx: FOUND (modified)

Commits exist:
- a528019: FOUND (feat(065-05): wire WHY-02 callout + WHY-03 prop threading in TransferPanel)
- 1c992e0: FOUND (feat(065-05): extend SquadView with verdicts+captaincyCandidates props + WHY-03 rejection reasons)
