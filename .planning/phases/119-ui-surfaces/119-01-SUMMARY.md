---
phase: 119
plan: "01"
subsystem: ui-shared-components
tags: [badge, presentational, status-label, tdd]
dependency_graph:
  requires: [src/lib/types.ts StatusLabel]
  provides: [StatusLabelBadge]
  affects: [CaptainPicksPanel, OpportunityCostTable, DecisionSummaryTab]
tech_stack:
  added: []
  patterns: [Partial<Record<K, Config>> guard pattern, TDD RED/GREEN cycle]
key_files:
  created:
    - src/components/shared/StatusLabelBadge.tsx
    - src/components/shared/StatusLabelBadge.test.tsx
  modified: []
decisions:
  - "Partial<Record<StatusLabel, Config>> used instead of Record<Exclude<...>, Config> so the single if (!config) return null guard handles all nil cases (undefined / confirmed_start / unknown) cleanly"
  - "Label text encoded statically in BADGE_MAP ('doubted', 'confirmed absent') per D-03 — no runtime underscore replacement"
  - "No data-testid attributes per spec — tests assert on title / className / textContent"
metrics:
  duration: ~5 min
  completed: 2026-05-18
  tasks_completed: 2
  files_changed: 2
---

# Phase 119 Plan 01: StatusLabelBadge Shared Component Summary

Leaf-level presentational badge component providing a single source of truth for the status_label visual treatment. Downstream plans (UI-01, UI-02, UI-03) consume this component to render amber/red pills for doubted and confirmed_absent players in CaptainPicksPanel, OpportunityCostTable, and DecisionSummaryTab.

## What Was Built

**`src/components/shared/StatusLabelBadge.tsx`** — new shared badge following the `MinsRiskBadge` / `LifecycleLabelBadge` pattern:
- Type-only import of `StatusLabel` from `@/lib/types`
- `Partial<Record<StatusLabel, Config>>` map with two entries: `doubted` (amber) and `confirmed_absent` (red)
- Single `if (!config) return null` guard handles `undefined`, `confirmed_start`, and `unknown`
- Single `<span>` output with `inline-block text-xs font-normal {text} {bg} rounded px-2 py-1` className
- Colour literals: `bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200` for doubted; `bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300` for confirmed_absent
- Title strings: `"Doubted: lineup news indicates player may not play"` / `"Confirmed absent: lineup news indicates player will not play"`
- No hooks, no async, no business logic

**`src/components/shared/StatusLabelBadge.test.tsx`** — 6 Vitest tests:
1. Returns null for `undefined`
2. Returns null for `confirmed_start`
3. Returns null for `unknown`
4. Renders amber pill with `"doubted"` text + all className fragments + title for `doubted`
5. Renders red pill with `"confirmed absent"` text (space, no underscore) + className + title for `confirmed_absent`
6. Renders exactly one `<span>` element

## TDD Gate Compliance

- RED: test file written before implementation; failed with module-not-found error
- GREEN: component created; all 6 tests pass
- REFACTOR: not needed — implementation is already clean

## Verification

```
npm test -- --run src/components/shared/StatusLabelBadge.test.tsx
→ 6 passed (6)
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — pure presentational component, no trust boundaries crossed (per plan threat model).

## Self-Check: PASSED

- `src/components/shared/StatusLabelBadge.tsx` — exists (confirmed)
- `src/components/shared/StatusLabelBadge.test.tsx` — exists (confirmed)
- Commit `a331af0` — confirmed in git log
- All 6 tests green — confirmed
