---
phase: 102-mc-gate-activation-mcdistributionbar-display
plan: "02"
subsystem: ui
tags:
  - mc
  - ui
  - tailwind
  - hover-card
  - component
dependency_graph:
  requires:
    - "102-01 (mc_enabled gate flip in pipeline)"
  provides:
    - "MCDistributionBar component at src/components/mc/MCDistributionBar.tsx"
    - "XPtsCell hover card renders visual MC bar (replaces text rows)"
  affects:
    - "src/components/gem-table/columns.tsx (XPtsCell showMC block replaced)"
    - "src/components/gem-table/columns.test.tsx (Phase 61 MC-02 describe migrated)"
tech_stack:
  added:
    - "src/components/mc/ — new component directory"
  patterns:
    - "Pure display component (no React import, no use client — Next.js 16 JSX transform)"
    - "Caller-guards pattern — XPtsCell showMC gate unchanged; component performs no guards (D-04)"
    - "Tailwind flex layout for horizontal range bar with conditional amber Haul% row"
key_files:
  created:
    - src/components/mc/MCDistributionBar.tsx
    - src/components/mc/MCDistributionBar.test.tsx
  modified:
    - src/components/gem-table/columns.tsx
    - src/components/gem-table/columns.test.tsx
decisions:
  - "MCDistributionBar is pure display — caller (XPtsCell) retains the showMC guard; component always renders when mounted (D-04)"
  - "Haul% threshold 0.40 and amber token text-amber-600 dark:text-amber-400 reused verbatim from old inline rows"
  - "blankProb prop accepted but silenced via void blankProb (D-01 bar-only design) for future reuse"
  - "Fill strip uses w-full (always fills track) — visual scale encoded by P10/P90 label values"
metrics:
  duration: "~8 min"
  completed: "2026-05-13"
  tasks: 2
  files: 4
---

# Phase 102 Plan 02: MCDistributionBar Component & XPtsCell Wiring Summary

**One-liner:** Visual MC distribution bar replacing inline Blank%/Haul%/Floor/Ceiling text rows in XPtsCell hover card — teal fill track with P10/P90 labels and conditional amber Haul% row.

## What Was Built

### Task 1: MCDistributionBar Component (07a8fe1)

Created `src/components/mc/MCDistributionBar.tsx` — a standalone pure-display component.

**Props:**
```ts
interface MCDistributionBarProps {
  blankProb: number   // 0–1 (accepted; silenced via `void blankProb` — D-01 bar-only)
  haulProb: number    // 0–1
  p10Pts: number      // base points, 1 decimal place
  p90Pts: number      // base points, 1 decimal place
}
```

**Layout structure:**
- Outer: `flex flex-col gap-1 w-full`
- Bar row: `flex items-center gap-1`
  - Left label (P10): `text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums w-6 text-right`
  - Track: `flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-600 relative` with `role="img"` and `aria-label="MC range: {p10} to {p90} pts"`
  - Fill strip: `absolute inset-y-0 left-0 w-full rounded-full bg-teal-500 dark:bg-teal-400`
  - Right label (P90): `text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums w-6 text-left`
- Haul% row (conditional, `haulProb >= 0.40`): `text-xs font-mono text-amber-600 dark:text-amber-400` showing `"Haul {N}%"`

**No `'use client'`; no `import React`** — pure display component following Next.js 16 JSX transform pattern (cf. FragilityBadge.tsx).

**RTL tests:** 10 tests in `src/components/mc/MCDistributionBar.test.tsx` — all GREEN:
1. P10 label formatted to 1 decimal place
2. P90 label formatted to 1 decimal place
3. Track with role=img and correct aria-label
4. Teal fill strip class presence
5. Amber "Haul 42%" row when haulProb=0.42
6. Amber "Haul 40%" at boundary (inclusive >=)
7. No Haul row when haulProb=0.39
8. No Haul row when haulProb=0.0
9. Integer rounding: 0.456 → "Haul 46%"
10. Outer wrapper class check

### Task 2: Wire into XPtsCell + Migrate Tests (c47a932)

**`src/components/gem-table/columns.tsx` diff (2 edits):**

1. Import added after line 11 (TeamBadge import):
   ```tsx
   import { MCDistributionBar } from '@/components/mc/MCDistributionBar'
   ```

2. Lines 141–163 (the old Blank%/Haul%/Floor/Ceiling block) replaced with:
   ```tsx
   {showMC && (
     <>
       <MCDistributionBar
         blankProb={blankProb!}
         haulProb={haulProb!}
         p10Pts={p10Pts!}
         p90Pts={p90Pts!}
       />
       <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
     </>
   )}
   ```

The `showMC` guard at lines 93–98 is **unchanged** (all four `!== undefined` checks preserved). The `<hr>` separator stays in the caller per UI-SPEC.md.

**`src/components/gem-table/columns.test.tsx` migration:**

Phase 61 MC-02 describe (asserting Blank%/Haul%/Floor/Ceiling text labels) replaced with Phase 102 MC-01 describe (5 tests):
1. MCDistributionBar renders with correct aria-label and Haul% row when MC props present and window===1
2. No Haul% row when haulProb < 0.40 (bar still renders)
3. MCDistributionBar omitted when window===3
4. MCDistributionBar omitted when window===5
5. MCDistributionBar omitted when any MC prop is undefined (gate-off degradation)

## Verification Results

```
src/components/mc/MCDistributionBar.test.tsx:   10/10 tests PASS
src/components/gem-table/columns.test.tsx:       17/17 tests PASS
All mc + gem-table tests:                        58/58 PASS
npx tsc --noEmit:                                EXIT 0 (no errors)
```

## Acceptance Criteria Verified

- [x] `src/components/mc/MCDistributionBar.tsx` exists with exported `MCDistributionBar`
- [x] `grep -c "export function MCDistributionBar"` returns 1
- [x] `grep -c 'role="img"'` returns 1
- [x] `grep -c "MC range:"` returns 1 (aria-label template literal)
- [x] `grep -c "bg-teal-500 dark:bg-teal-400"` returns 1
- [x] `grep -c "haulProb >= 0.40"` returns 1
- [x] `grep -c "text-amber-600 dark:text-amber-400"` returns 1
- [x] `grep -c "'use client'"` returns 0 (pure display — no client directive)
- [x] `grep -c "import React"` returns 0 (Next.js 16 JSX transform)
- [x] `grep -c "<MCDistributionBar"` in columns.tsx returns 1
- [x] `grep -c "Blank%"` in columns.tsx returns 0 (removed)
- [x] `grep -c '"Floor"'` in columns.tsx returns 0 (removed)
- [x] `grep -c '"Ceiling"'` in columns.tsx returns 0 (removed)
- [x] Phase 61 MC-02 describe replaced with Phase 102 MC-01 describe

## Gate-Off Path

When `mc_enabled=false` (before Plan 01 pipeline flip), all MC props on `MergedPlayer` are `undefined`. The `showMC` guard (`blankProb !== undefined && haulProb !== undefined && p10Pts !== undefined && p90Pts !== undefined`) evaluates `false`. `MCDistributionBar` is NOT rendered. No fallback text. Silent omission — confirmed by test 5 in the Phase 102 MC-01 describe.

## Known Stubs

None — MCDistributionBar renders only when MC fields are present from the pipeline. Gate-off is silent omission, not a stub.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced. Component is pure synchronous display logic. T-102-07 through T-102-12 dispositions in threat model (all accept/mitigate per plan) satisfied by the implementation.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/components/mc/MCDistributionBar.tsx` exists
- [x] `src/components/mc/MCDistributionBar.test.tsx` exists
- [x] Task 1 commit `07a8fe1` exists in git log
- [x] Task 2 commit `c47a932` exists in git log
- [x] All tests pass (58/58)
- [x] TypeScript compile passes

## Self-Check: PASSED
