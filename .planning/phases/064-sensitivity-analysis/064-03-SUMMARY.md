---
phase: 064-sensitivity-analysis
plan: "03"
subsystem: ui
tags: [react, fragility, sensitivity, SENS-01, SENS-02, TransferPanel, CaptainPicksPanel]
dependency_graph:
  requires:
    - phase: 064-sensitivity-analysis plan 01
      provides: src/lib/sensitivity.ts — computeFragility pure function
    - phase: 064-sensitivity-analysis plan 02
      provides: src/components/shared/FragilityNote.tsx — shared inline indicator
  provides:
    - TransferPanel.tsx Row 4 fragility injection (single + combo)
    - CaptainPicksPanel.tsx CandidateRow tail fragility injection
  affects:
    - SENS-01 (complete — fragility wired at both render sites)
    - SENS-02 (complete — amber inline text displayed at both render sites)
tech-stack:
  added: []
  patterns:
    - "IIFE conditional render: {(() => { const {...} = compute(); return cond ? <C /> : null })()} — keeps xPtsGain scoped per card without lifting to row-level variable"
    - "isTransfer=true for transfer cards, false for captain picks — enforces D-09 hit-condition gating"
key-files:
  created: []
  modified:
    - src/components/transfers/TransferPanel.tsx
    - src/components/captaincy/CaptainPicksPanel.tsx
decisions:
  - "IIFE pattern used for inline xPtsGain computation — avoids polluting map callback scope per RESEARCH.md Pattern 3"
  - "computeFragility accepts MergedPlayer (not ScoredPlayer) — no cast required for CandidateRow (Plan 01 decision honoured)"
  - "isTransfer=false for captain path — D-09 mandates no hit condition for captains; xPtsGain omitted (undefined)"
metrics:
  duration: "8m"
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_changed: 2
---

# Phase 64 Plan 03: UI Injection (TransferPanel + CaptainPicksPanel) Summary

**One-liner:** FragilityNote wired into TransferPanel (Row 4 single + combo) and CaptainPicksPanel (CandidateRow tail) via computeFragility, with isTransfer correctly gated per D-09 and xPtsGain formula per D-10.

## What Was Built

### Task 1: TransferPanel.tsx injection

Added two imports adjacent to the existing `MinsRiskBadge` import:
```typescript
import { computeFragility } from '@/lib/sensitivity'
import { FragilityNote } from '@/components/shared/FragilityNote'
```

**Single-transfer map (Row 4):** After the closing `</div>` of Row 3 (budget badge), before the card's outer `</div>`, injected:
```jsx
{/* Row 4: fragility note (Phase 64 SENS-01/02) */}
{(() => {
  const xPtsGain = (s.buy.xPts_1gw ?? 0) - (s.sell.xPts_1gw ?? 0)
  const { fragile, reasons } = computeFragility(s.buy, true, xPtsGain)
  return fragile ? <FragilityNote reasons={reasons} /> : null
})()}
```

**2-transfer combo map (after Row 2):** Identical block added immediately after Row 2's `</div>` (combo has no Row 3 per Pitfall 3 in RESEARCH.md):
```jsx
{/* Fragility note (Phase 64 SENS-01/02) — combo cards have no Row 3 budget badge */}
{(() => {
  const xPtsGain = (s.buy.xPts_1gw ?? 0) - (s.sell.xPts_1gw ?? 0)
  const { fragile, reasons } = computeFragility(s.buy, true, xPtsGain)
  return fragile ? <FragilityNote reasons={reasons} /> : null
})()}
```

Injection line counts: 5 lines each (IIFE + xPtsGain + destructure + return + closing). Total: 14 insertions.

### Task 2: CaptainPicksPanel.tsx injection

Added two imports after the existing `MergedPlayer` type import:
```typescript
import { computeFragility } from '@/lib/sensitivity'
import { FragilityNote } from '@/components/shared/FragilityNote'
```

**CandidateRow tail:** After the closing `</span>` of the xPts (C) span, before the outer container's `</div>`:
```jsx
{/* Fragility note (Phase 64 SENS-01/02) — captain has no hit condition (D-09) */}
{(() => {
  const { fragile, reasons } = computeFragility(candidate, false)
  return fragile ? <FragilityNote reasons={reasons} /> : null
})()}
```

Total: 7 insertions. No type cast required — `candidate: MergedPlayer` matches `computeFragility(player: MergedPlayer)` directly (Plan 01 widened the parameter type).

## Vitest Pass/Fail Delta

Pre-Phase-64 baseline (from Plan 01 SUMMARY): 6 failures | 903 passed | 34 skipped

Post-Plan-03 full suite: 6 failures | 907 passed | 34 skipped

Net change: +4 tests passed (FragilityNote test coverage runs once more, no new failures). The 6 persistent failures are all pre-existing:
- 5 in `tests/lib/captain-picks.test.ts` (TEST-57, pre-Phase-64 deferral)
- 1 in `tests/lib/club-form.test.ts` (pre-Phase-64 deferral)

Zero new failures introduced by this plan.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 21ee3f9 | feat(064-03): inject FragilityNote into TransferPanel single + combo |
| 2 | 4a4f02c | feat(064-03): inject FragilityNote into CaptainPicksPanel CandidateRow |

## Phase-Wide Verification

- `npx tsc --noEmit` — exits 0 (clean)
- `grep -rn "computeFragility" src/components/` — exactly 3 call sites: 2 in TransferPanel.tsx (single + combo), 1 in CaptainPicksPanel.tsx
- `grep -c "computeFragility(.*, true" src/components/transfers/TransferPanel.tsx` — returns 2
- `grep -c "computeFragility(.*, false" src/components/captaincy/CaptainPicksPanel.tsx` — returns 1
- `grep -c "computeFragility(candidate, true" src/components/captaincy/CaptainPicksPanel.tsx` — returns 0 (D-09 enforced)

## Manual Verification (Pending)

The following visual checks require the running app (not automated):
- Fragility note appears as inline amber text (no pill background) when `start_prob < 0.70` OR `fixtures[0].difficulty_tier === 'medium'` OR transfer xPtsGain < 4.0
- No ⚠ symbol appears for robust transfers (start_prob >= 0.70, easy/hard fixture, gain >= 4)
- Visual distinction between FragilityNote (inline amber text) and filled amber pill badges (DangerousToFadeBadge, McLabel, SeverityBadge MEDIUM)

## Deviations from Plan

None — plan executed exactly as written. Both IIFE patterns, import placement, comment text, and isTransfer flags match the plan's action steps verbatim.

## Known Stubs

None — both injection points call the fully-implemented `computeFragility` from Plan 01 and render the fully-implemented `FragilityNote` from Plan 02. No hardcoded values or placeholder text.

## Threat Flags

None — pure display-layer change. No new network endpoints, auth paths, file access patterns, or schema changes. All inputs are pre-computed `MergedPlayer` fields from existing pipeline data.

## Self-Check: PASSED

- [x] src/components/transfers/TransferPanel.tsx exists and contains both injections: CONFIRMED
- [x] src/components/captaincy/CaptainPicksPanel.tsx exists and contains tail injection: CONFIRMED
- [x] Commit 21ee3f9 exists: CONFIRMED
- [x] Commit 4a4f02c exists: CONFIRMED
- [x] `npx tsc --noEmit` exits 0: CONFIRMED
- [x] 6 failures in full suite = pre-existing only (0 new regressions): CONFIRMED
- [x] computeFragility call count in src/components/: 3 (2 TransferPanel + 1 CaptainPicksPanel): CONFIRMED
- [x] isTransfer=true count in TransferPanel: 2: CONFIRMED
- [x] isTransfer=false count in CaptainPicksPanel: 1: CONFIRMED
- [x] isTransfer=true count in CaptainPicksPanel: 0 (D-09 enforced): CONFIRMED
