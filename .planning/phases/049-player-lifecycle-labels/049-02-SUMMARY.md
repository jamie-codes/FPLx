---
plan: 049-02
phase: 049-player-lifecycle-labels
status: complete
completed: 2026-05-02
self_check: PASSED
---

# Plan 049-02 Summary: Lifecycle Label UI Wiring

## What Was Built

- **`src/components/shared/LifecycleLabelBadge.tsx`** — New badge component replacing VerdictBadge for the Rec column. Seven Tailwind colour configs per UI-SPEC (emerald/green/orange/amber/red/zinc) with semantic tooltips. Returns null for null label — bench rows render nothing.
- **`src/components/transfers/TransferPanel.tsx`** — Removed `computeVerdicts` import; added `useClubForm()` hook, `clubFormMap` useMemo, `lifecycleLabels` useMemo via `computeLifecycleLabels`. Passes `labels={lifecycleLabels}` to SquadView. ClubForm loads in background — empty map on first render is graceful degradation.
- **`src/components/squad/SquadView.tsx`** — `verdicts` prop replaced with `labels: Map<number, LifecycleLabel>`; VerdictBadge/Verdict imports removed; LifecycleLabelBadge renders in Rec column; replacement shortlist trigger extended to `label === 'sell' || label === 'sell_soon'`.

## Decisions Made

- **D-01**: `computeVerdicts` and `Verdict` exports left intact in `recommend.ts` — Phase 51 (Decision Summary) will reuse them.
- **D-02**: Outer truthy check on `verdicts?.get(...)` removed; LifecycleLabelBadge handles null internally — matches the component contract.
- **D-03**: No `isLoading`/`error` destructured from `useClubForm()` — degraded behaviour (gem-only labels until club form resolves) is acceptable per research Pitfall 6.

## Test Results

- `npx tsc --noEmit`: clean on all phase 49 files (2 pre-existing errors in captain-picks.test.ts and columns.tsx from Phase 48 unrelated to this plan)
- `npm test`: 550/551 pass (1 pre-existing failure in club-form.test.ts — unrelated)
- Human verification: approved — starting-XI labels render correctly, bench rows show no badge, tooltips visible, sell/sell_soon shortlist fires, DevTools console clean

## Key Files

### Created
- `src/components/shared/LifecycleLabelBadge.tsx`

### Modified
- `src/components/transfers/TransferPanel.tsx`
- `src/components/squad/SquadView.tsx`

## Self-Check: PASSED
