---
phase: 93
plan: "03"
subsystem: ui/shared-components
tags: [sensitivity, fragility, ui, component, rtl]
dependency_graph:
  requires: [093-02]
  provides: [FragilityBadge component, RTL test suite]
  affects: [093-04]
tech_stack:
  added: []
  patterns: [tristate-presentational-component, RTL-jsdom-testing]
key_files:
  created:
    - src/components/shared/FragilityBadge.tsx
    - src/components/shared/FragilityBadge.test.tsx
  modified: []
decisions:
  - "TIER_CLASSES Record<Exclude<FragilityTier, 'robust'>, string> gives compile-time exhaustiveness for non-robust tiers"
  - "No 'use client' directive — component is purely presentational with no hooks or event handlers"
  - "Reuses exact copy prefix from FragilityNote for API consistency"
metrics:
  duration: "5 minutes"
  completed: "2026-05-10"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 93 Plan 03: FragilityBadge Component and RTL Suite Summary

**One-liner:** Tristate inline fragility indicator (amber/orange/null) with 8-case RTL suite locking the visual contract.

## What Was Built

Created `FragilityBadge` — a presentational extension of the Phase 64 `FragilityNote` pattern that supports three tier states driven by `FragilityTier` from `@/lib/sensitivity`:

| Tier | Renders | Classes |
|------|---------|---------|
| `robust` | `null` | — |
| `fragile` | `<div>` with ⚠ + reasons | `text-xs text-amber-600 dark:text-amber-400` |
| `knife_edge` | `<div>` with ⚠ + reasons | `text-xs text-orange-600 dark:text-orange-400` |

No filled-pill classes (`bg-*`, `rounded`, `inline-block`) per Phase 64 Pitfall 4 — preserves visual distinction from `DangerousToFadeBadge`/`McLabel`/`SeverityBadge MEDIUM`/`RotationRiskBadge`.

## Test Results

- FragilityBadge suite: **8/8 passing** (jsdom)
- Legacy FragilityNote suite: **4/4 passing** (untouched — no regressions)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create FragilityBadge.tsx | 8279fb5 | src/components/shared/FragilityBadge.tsx |
| 2 | Create FragilityBadge.test.tsx | edb1dea | src/components/shared/FragilityBadge.test.tsx |

## RTL Cases Covered

1. `robust` + empty reasons → renders nothing
2. `robust` + non-empty reasons → still renders nothing (D-07)
3. `fragile` + single reason → amber classes + correct copy
4. `fragile` → no filled-pill classes (Pitfall 4 guard)
5. `knife_edge` + multiple reasons → orange classes, comma-joined, not amber
6. `knife_edge` → no filled-pill classes (Pitfall 4 guard)
7. Both rendered tiers → `aria-hidden="true"` ⚠ span present
8. Both rendered tiers → prefix appears exactly once (Pitfall 4 guard)

## Deviations from Plan

None — plan executed exactly as written. `FragilityTier` was confirmed present in the main repo's `src/lib/sensitivity.ts` (shipped by 093-02, already merged to main).

## Known Stubs

None — component is fully wired to its type contract. Wire-up into host surfaces (`GemTable`, `OpportunityCostTable`, `CaptainPicksPanel`) is deferred to 093-04 per plan design.

## Threat Flags

None — pure presentational component. Reason strings rendered as React text children (no `dangerouslySetInnerHTML`). No PII, no network surface, no new trust boundary.

## Self-Check: PASSED

- [x] `src/components/shared/FragilityBadge.tsx` exists
- [x] `src/components/shared/FragilityBadge.test.tsx` exists
- [x] Commit 8279fb5 exists (feat: component)
- [x] Commit edb1dea exists (test: suite)
- [x] 8/8 RTL cases pass
- [x] Legacy FragilityNote suite still passes (4/4)
