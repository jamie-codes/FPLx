---
phase: 064-sensitivity-analysis
plan: "02"
subsystem: ui
tags: [react, tailwind, vitest, rtl, tdd, amber-indicator, fragility, accessibility]

# Dependency graph
requires:
  - phase: 064-sensitivity-analysis plan 01
    provides: sensitivity.ts computeFragility pure function (SENS-01)
provides:
  - FragilityNote shared React component — inline amber ⚠ indicator with no filled-pill background
  - RTL test coverage for FragilityNote (4 cases, jsdom environment)
  - SENS-02 visual contract fulfilled — visually distinct from DangerousToFadeBadge/McLabel/SeverityBadge ecosystem
affects:
  - 064-sensitivity-analysis plan 03 (consumes FragilityNote in TransferPanel + CaptainPicksPanel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared inline indicator: block div with text-xs text-amber-600 dark:text-amber-400, no background fill — distinct from filled-pill ecosystem"
    - "aria-hidden on decorative Unicode symbol — screen reader skips ⚠, reads reason text"
    - "Short fragment reasons array, single prefix prepended by component (avoids Pitfall 4 double-prefix)"

key-files:
  created:
    - src/components/shared/FragilityNote.tsx
    - src/components/shared/FragilityNote.test.tsx
  modified: []

key-decisions:
  - "Reasons stored as short fragments (e.g. 'start_prob < 70%'); FragilityNote prepends 'no longer recommended if: ' once — avoids RESEARCH.md Pitfall 4 double-prefix when joining multiple conditions"
  - "Block div (not inline-block) chosen per UI-SPEC — visually distinct from all existing filled amber pill badges"
  - "data-testid='fragility-note' on outer div — follows project pattern (mc-label-badge, eo-candidate-row) for deterministic RTL assertions"

patterns-established:
  - "FragilityNote pattern: shared small indicator in src/components/shared/ following MinsRiskBadge convention but without filled-pill classes"

requirements-completed:
  - SENS-02

# Metrics
duration: 3min
completed: 2026-05-06
---

# Phase 64 Plan 02: Sensitivity Analysis Summary

**Shared inline amber fragility indicator (`FragilityNote`) with RTL test coverage — ⚠ + amber text block-element, no filled pill, aria-hidden symbol, 4/4 tests GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-06T10:51:28Z
- **Completed:** 2026-05-06T10:54:10Z
- **Tasks:** 2 (RED + GREEN TDD)
- **Files modified:** 2

## Accomplishments

- Stub component created with correct interface so test imports resolve
- 4 RTL test cases written covering single reason, empty reasons, aria-hidden, and multi-reason joining
- Full implementation of `FragilityNote` passes all 4 tests GREEN
- TypeScript clean (tsc --noEmit exits 0)
- No forbidden classes (`bg-amber-100`, `bg-amber-900`, `inline-block`, `rounded`) in implementation
- Pre-existing failures (TEST-57 in captain-picks, club-form.test.ts) confirmed unrelated to this plan

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for FragilityNote** - `80f98e2` (test)
2. **Task 2: GREEN — Implement FragilityNote to pass all tests** - `3e5e6df` (feat)

**Plan metadata:** (final docs commit below)

_TDD plan: test → feat, two commits per plan specification_

## Files Created/Modified

- `src/components/shared/FragilityNote.tsx` - Shared inline amber ⚠ indicator component; returns null for empty reasons; renders block div with text-xs text-amber-600 dark:text-amber-400 and aria-hidden warning symbol
- `src/components/shared/FragilityNote.test.tsx` - 4 RTL component tests under @vitest-environment jsdom covering single reason rendering, empty reasons, aria-hidden, and multi-reason comma-joining with Pitfall 4 guard

## Decisions Made

- **Reasons as short fragments**: Per RESEARCH.md recommendation and to avoid Pitfall 4, reasons are stored as `'start_prob < 70%'` (not full sentences). `FragilityNote` prepends `'no longer recommended if: '` once then joins with `', '`.
- **Block div**: UI-SPEC specifies block element (not `inline-block`) to distinguish from existing filled-pill badge ecosystem.
- **data-testid on outer div**: Added per project pattern (following `mc-label-badge`, `eo-candidate-row`) for deterministic RTL test assertions without relying on text content.

## Deviations from Plan

None - plan executed exactly as written. Implementation matches the exact code provided in the plan's `<action>` block.

## Issues Encountered

- Pre-existing test failures (6 total): 5 in `tests/lib/captain-picks.test.ts` (documented as TEST-57 in STATE.md) and 1 in `tests/lib/club-form.test.ts`. These pre-date this plan and were not caused by FragilityNote changes. Confirmed by checking `git status --short` after implementation (only FragilityNote.tsx modified).

## Next Phase Readiness

- `FragilityNote` is ready for consumption by Plan 03 — it's importable from `@/components/shared/FragilityNote`
- Plan 03 will inject `FragilityNote` into `TransferPanel.tsx` (Row 4) and `CaptainPicksPanel.tsx` (CandidateRow tail), using `computeFragility` from Plan 01
- No blockers

## Known Stubs

None — FragilityNote renders real content from its `reasons` prop. No hardcoded empty values or placeholder text.

## Threat Flags

None — pure display component with no network access, no authentication, no untrusted input processing, no file I/O.

---
*Phase: 064-sensitivity-analysis*
*Completed: 2026-05-06*

## Self-Check: PASSED

- FOUND: src/components/shared/FragilityNote.tsx
- FOUND: src/components/shared/FragilityNote.test.tsx
- FOUND: .planning/phases/064-sensitivity-analysis/064-02-SUMMARY.md
- FOUND: commit 80f98e2 (RED - test)
- FOUND: commit 3e5e6df (GREEN - feat)
