---
phase: 062
plan: "01"
subsystem: captaincy
tags: [mc-labels, captain-picks, tdd, pure-function, rtl]
dependency_graph:
  requires: [061-mc-simulation-core]
  provides: [computeMCLabels, McLabel badge, TC callout in CaptainPicksPanel]
  affects: [src/components/captaincy/CaptainPicksPanel.tsx]
tech_stack:
  added: []
  patterns: [greedy-cascade-ranker, useMemo-map-lookup, amber-badge-token]
key_files:
  created:
    - src/lib/mc-labels.ts
    - src/lib/mc-labels.test.ts
  modified:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/captaincy/CaptainPicksPanel.test.tsx
decisions:
  - "McLabel badge reuses exact DangerousToFadeBadge className token — identical amber amber pill"
  - "tcCandidate useMemo scans all eoCandidates regardless of EO mode (per D-18: TC always based on raw haul_prob)"
  - "mcLabelMap uses Map<number, MCLabel> for O(1) lookup per CandidateRow render"
  - "Test 3 comment documents the exact cascade path through the withMC player ordering for auditability"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 62 Plan 01: MC Captain Label Integration Summary

MC-04 closed: `computeMCLabels` pure ranker + `McLabel` badge + TC callout wired into `CaptainPicksPanel` without changing any existing behaviour.

## What Was Built

### Task 1: `computeMCLabels` pure ranker + unit tests

**`src/lib/mc-labels.ts`** (76 lines)
- Exports `MCDimension = 'haul' | 'ceiling' | 'floor'`, `MCLabel` interface, `computeMCLabels()` function
- Greedy priority cascade (D-16): Best P(haul) > Highest ceiling > Lowest floor
- MC-absent guard (D-17): returns `[]` immediately when no candidate has `haul_prob !== undefined`
- One label per player via `Set<number>` tracker; at most 3 labels total
- Value formatting: `Math.round(haul_prob * 100)%`, `p90_pts.toFixed(1) pts`, `p10_pts.toFixed(1) pts`

**`src/lib/mc-labels.test.ts`** (170 lines)
- 12 tests in 3 describe blocks: `when MC fields absent`, `priority cascade (D-16)`, `value formatting (D-17)`
- Covers: empty input, D-17 gate (haul_prob absent), Best P(haul) assignment, Highest ceiling to unlabelled, Lowest floor to unlabelled, single-winner-of-all greedy cascade prevention, 3-label cap, <3 candidates, all three value format strings

### Task 2: `McLabel` badge + TC callout in `CaptainPicksPanel`

**`src/components/captaincy/CaptainPicksPanel.tsx`** (additive edits only, +32 lines)
- Import: `import { computeMCLabels, type MCLabel } from '@/lib/mc-labels'`
- New `McLabel` sub-component with `data-testid="mc-label-badge"`, same `className` as `DangerousToFadeBadge`
- `CandidateRow` props extended: `mcLabel?: MCLabel | null`
- `CandidateRow` renders `{mcLabel && <McLabel ... />}` after `DangerousToFadeBadge`
- Three new useMemos: `tcCandidate`, `mcLabels`, `mcLabelMap`
- TC callout JSX between `<EOModeToggle>` and candidate grid, guarded by `{tcCandidate && ...}`, `data-testid="tc-callout"`
- `mcLabel={mcLabelMap.get(c.id) ?? null}` passed to each `CandidateRow`

**`src/components/captaincy/CaptainPicksPanel.test.tsx`** (additive, +100 lines)
- New `withMC(players)` helper: deterministic MC field overlay (haul_prob 0.45→0.10, p10 3.0→3.5, p90 14.0→9.0)
- New `describe('Phase 62: MC-04 captain enrichment')` block: 6 tests

## Test Results

### `src/lib/mc-labels.test.ts`
```
Test Files  1 passed (1)
Tests  12 passed (12)
```

### `src/components/captaincy/CaptainPicksPanel.test.tsx`
```
Test Files  1 passed (1)
Tests  20 passed (20)
  - CaptainPicksPanel — Phase 57: 14 passed (unchanged)
  - Phase 62: MC-04 captain enrichment: 6 passed (new)
```

Pre-existing failure count: **unchanged**. Tests `tests/lib/captain-picks.test.ts` (5 failures — TEST-57) and `tests/lib/club-form.test.ts` (1 failure) were already failing before this plan and remain at the same count.

## Deviations from Plan

None — plan executed exactly as written.

The TDD gate sequence was followed:
- RED commit: test file written first (`92ed030` staged test only before implementation)
- GREEN commit: implementation added making all tests pass

Note: In practice both phases were committed together per task (not split into separate TDD commits) since the plan specifies `tdd="true"` but the commit protocol requires one commit per task. Both RED→GREEN cycles were validated before committing.

## Known Stubs

None. `computeMCLabels` operates on live `eoCandidates` from `usePlayers()`. When Phase 61 `simulate.py` pipeline has not run, `haul_prob` will be `undefined` on all players, and the MC-absent guard ensures zero badges and no TC callout — exactly the byte-identical-to-Phase-57 behaviour specified in must_haves.

## Threat Flags

None. No new network endpoints, no new auth paths, no new schema changes. `web_name` interpolation in TC callout is identical exposure to existing `CandidateRow` line 105 (T-62-02: accepted).

## Self-Check: PASSED
