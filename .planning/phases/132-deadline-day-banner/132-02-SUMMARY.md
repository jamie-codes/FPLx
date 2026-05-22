---
phase: 132
plan: "02"
subsystem: components
tags: [react, client-component, tailwind, localstorage, countdown, accessibility, tdd]
dependency_graph:
  requires:
    - src/lib/hooks/useNextDeadline.ts (Plan 01 output — hook this component consumes)
    - src/components/LastUpdated.tsx (timer pattern template)
    - src/app/page.tsx (injection point)
  provides:
    - src/components/DeadlineBanner.tsx (DeadlineBanner client component)
    - src/components/DeadlineBanner.test.tsx (Vitest + Testing Library coverage for DL-01/DL-02/DL-03)
  affects:
    - src/app/page.tsx (import + single JSX injection)
tech_stack:
  added: []
  patterns:
    - 'use client' component with setInterval/clearInterval countdown (mirrors LastUpdated.tsx)
    - localStorage try/catch lazy-init useState for per-GW dismiss (mirrors page.tsx PGW-04 pattern)
    - Urgency state Record maps with Tailwind class strings (zinc/amber/red + sticky top-0 z-50)
    - NaN guard via Number.isNaN(new Date(deadline_time).getTime()) for T-132-04 mitigate disposition
key_files:
  created:
    - src/components/DeadlineBanner.tsx
    - src/components/DeadlineBanner.test.tsx
  modified:
    - src/app/page.tsx
    - src/app/page.test.tsx
decisions:
  - "formatCountdown drops '0h' prefix when hours === 0 — renders '45m' not '0h 45m' (UI-SPEC §Copywriting)"
  - "URGENCY_CLASSES uses plan interfaces block values: bg-zinc-50/text-zinc-600 neutral; bg-amber-50/text-amber-700 amber; bg-red-50/text-red-700 red"
  - "page.test.tsx mock added for DeadlineBanner returning null — prevents QueryClient error in existing page tests (Rule 1 bug fix)"
  - "Banner positioned as sibling before sticky nav wrapper (not inside it) — red sticky top-0 z-50 layers above nav z-40"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-22"
  tasks_completed: 3
  files_count: 4
---

# Phase 132 Plan 02: DeadlineBanner Component Summary

One-liner: `DeadlineBanner` client component with 60-second countdown, three-state urgency (zinc/amber/red sticky), per-GW localStorage dismiss, and NaN guard — injected above the sticky nav in `page.tsx`.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/DeadlineBanner.tsx` | 136 | Client component — countdown, urgency states, dismiss, NaN guard, a11y |
| `src/components/DeadlineBanner.test.tsx` | 246 | 16 tests covering DL-01/DL-02/DL-03 + lifecycle + a11y (4 describe blocks) |

## Files Modified

| File | Edit |
|------|------|
| `src/app/page.tsx` | Edit 1: import `DeadlineBanner` after `useSettledGws` import (line 39). Edit 2: inject `<DeadlineBanner />` at line 200, immediately before the sticky nav wrapper comment (line 201). |
| `src/app/page.test.tsx` | Added `vi.mock('@/components/DeadlineBanner', () => ({ DeadlineBanner: () => null }))` — prevents QueryClient error in existing page tests (Rule 1 bug fix). |

## Test Results

**16 passed, 0 failed**

| Describe Block | Tests | Status |
|----------------|-------|--------|
| DL-01 display (A1–A4) | 4 | PASS |
| DL-02 urgency states (B1–B4) | 4 | PASS |
| DL-03 dismiss (C1–C4) | 4 | PASS |
| lifecycle + a11y (D1–D3, E1) | 4 | PASS |

Combined Plan 01 + Plan 02 suite: **20 passed, 0 failed**

Full project suite: **127 test files, 1567 passed, 34 skipped** — no regressions.

TDD cycle: RED (596abc5 — import error) → GREEN (b03922a — 16/16 passing).

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/components/DeadlineBanner.test.tsx` | 16 passed |
| `npx vitest run src/lib/hooks/useNextDeadline.test.ts src/components/DeadlineBanner.test.tsx` | 20 passed |
| `npm test` (full suite) | 127 files, 1567 passed |
| `npx tsc --noEmit` | No errors for DeadlineBanner.tsx or page.tsx |
| `npm run build` | Succeeds |

## Colour Map Decision

The PLAN interfaces block specifies `bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700` for neutral. This differs slightly from the RESEARCH.md Pattern 4 suggestion (`bg-zinc-100 text-zinc-700`). The PLAN interfaces block was followed as the authoritative source — tests assert `bg-zinc-` (any zinc bg), `bg-amber-50`, and `bg-red-50`, so both would pass.

Chosen values:
- `neutral`: `bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400`
- `amber`: `bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300`
- `red`: `bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] page.test.tsx broke when DeadlineBanner was injected into page.tsx**
- **Found during:** Task 3 verification (`npm test`)
- **Issue:** `page.test.tsx` renders `<Home />` without a `QueryClientProvider`. When `DeadlineBanner` was added to the layout, `useNextDeadline` (via `useQuery`) threw "No QueryClient set" — crashing all 17 page tests.
- **Fix:** Added `vi.mock('@/components/DeadlineBanner', () => ({ DeadlineBanner: () => null }))` to `page.test.tsx`, consistent with how all other TanStack Query-dependent components in that file are mocked.
- **Files modified:** `src/app/page.test.tsx`
- **Commit:** `324aea4`

## Open Carry-Forwards

**Open Question 1 (from RESEARCH.md):** Does `--nav-height: 96px` interact with the red sticky banner?

When the red banner is `sticky top-0 z-50` and the sticky nav wrapper is `sticky top-0 z-40`, the effective "nav + banner" height at the top of the viewport when both are sticky exceeds the 96px assumed by `InsightsTab.tsx`'s `top-[var(--nav-height,96px)]` inner sticky row. This could cause the InsightsTab sticky filter row to visually sit behind the red banner on scroll.

Confirmed this was not encountered during implementation testing (no visual regression in unit tests). The interaction would only surface in a live browser with the red urgency state active (< 2h to deadline) and the Insights tab open.

**Recommendation for Phase 133+:** If the Insights tab inner sticky row is observed sitting behind the deadline banner during the deadline rush window, update `--nav-height` in `globals.css` to account for banner height (~40px), or make it dynamic. No action needed for Phase 132.

## Known Stubs

None — all data is live from `useNextDeadline` (bootstrap API). No placeholder text, no hardcoded empty values, no mock data wired to UI.

## Threat Flags

No new security surface beyond what was planned and mitigated in the threat register:
- T-132-04: NaN guard implemented (`Number.isNaN(deadlineMs)`)
- T-132-06: All localStorage reads/writes wrapped in try/catch

## Self-Check: PASSED

- [x] `src/components/DeadlineBanner.tsx` exists (136 lines)
- [x] `src/components/DeadlineBanner.test.tsx` exists (246 lines)
- [x] `src/app/page.tsx` contains `import { DeadlineBanner }` and `<DeadlineBanner />`
- [x] Commit `596abc5` — test(132-02): RED phase — test file, failing due to missing module
- [x] Commit `b03922a` — feat(132-02): GREEN phase — 16/16 tests passing
- [x] Commit `324aea4` — feat(132-02): page.tsx wiring + page.test.tsx fix
- [x] `npx vitest run src/components/DeadlineBanner.test.tsx` — 16 passed
- [x] `npm test` — 127 files, no regressions
- [x] `npx tsc --noEmit` — no errors
- [x] `npm run build` — succeeds
