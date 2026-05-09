---
phase: 85-set-piece-threat-assisted-ui
plan: 02
subsystem: ui
tags: [react, tailwind, vitest, set-pieces, badges, spq]

# Dependency graph
requires:
  - phase: 85-01
    provides: "Extended SetPieceTaker type with sp_quality fields; /api/set-pieces returning sp_tier per taker"
provides:
  - "SP_TIER_CLASSES colour map in SetPieceTakerPanel (Elite=green, Good=zinc, Weak=amber, D-05)"
  - "DeliveryQualityBadge subcomponent with D-04 tooltip wording and null-safe title omission"
  - "showQualityBadge prop on TakerRow — wired to FK and Corner rows only (D-01)"
  - "5 Vitest cases for SPQ-03: SC-2 tooltip, SC-4 missing-quality-map, D-01 penalty exclusion, D-05 colour, D-05 dash class"
affects: [phase-85-checkpoint, set-piece-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SP_TIER_CLASSES constant pattern for component-local tier colour maps (mirrors AccuracyTab TIER_CLASSES shape but uses different keys)"
    - "DeliveryQualityBadge renders null title when sp_tier is null/undefined (D-06 graceful fallback)"
    - "showQualityBadge boolean prop to conditionally render inline badge on selected TakerRow invocations"

key-files:
  created: []
  modified:
    - src/components/set-pieces/SetPieceTakerPanel.tsx
    - src/components/set-pieces/SetPieceTakerPanel.test.tsx

key-decisions:
  - "D-01: showQualityBadge prop omitted entirely from Penalty TakerRow invocation (not false) to match locked decision verbatim"
  - "D-04: title attribute omitted (not empty string) when sp_tier is null — verified by hasAttribute('title') in Vitest"
  - "D-05: 'Changed' badge and Weak badge use identical class tokens but in different string order — amber count stays at 1 for the exact D-05 string (existing Changed badge has different token order)"

patterns-established:
  - "Inline badge after player name: ml-2 text-xs font-normal rounded px-2 py-1 + tier class — consistent with Changed badge"
  - "Component-local tier class constants avoid cross-component coupling"

requirements-completed: [SPQ-03]

# Metrics
duration: ~15min
completed: 2026-05-09
---

# Phase 85 Plan 02: Set-Piece Threat Assisted UI Summary

**DeliveryQualityBadge with Elite/Good/Weak tier colours and D-04 tooltip wording added to FK and Corner rows in SetPieceTakerPanel; 5 Vitest cases covering SC-2 tooltip, SC-4 missing-map fallback, and D-05 colour assertions**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-09T16:05:00Z
- **Completed:** 2026-05-09T16:12:00Z
- **Tasks:** 3 of 3 complete (Task 3 human-verify approved 2026-05-09)
- **Files modified:** 2

## Accomplishments
- SP_TIER_CLASSES and SP_TIER_INSUFFICIENT_CLASS constants defined in SetPieceTakerPanel.tsx with exact D-05 class strings
- DeliveryQualityBadge renders tier span with title attribute (D-04 exact wording, sp_sample_n substituted) when sp_tier is non-null; omits title entirely when null
- FK and Corner TakerRow invocations pass showQualityBadge; Penalty invocation deliberately omits it (D-01)
- 5 new Vitest cases covering SPQ-03 SC-2, SC-4, D-01, D-05 colour assertions, D-05 dash class
- All 3 existing SHD-01 ghost-watermark tests preserved and passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SP_TIER_CLASSES, DeliveryQualityBadge, showQualityBadge prop** - `310fd7d` (feat)
2. **Task 2: Add 5 Vitest cases for SPQ-03** - `801f133` (test)

## Files Created/Modified
- `src/components/set-pieces/SetPieceTakerPanel.tsx` — Added SP_TIER_CLASSES, SP_TIER_INSUFFICIENT_CLASS, buildSpQualityTooltip(), DeliveryQualityBadge component, showQualityBadge prop on TakerRow, FK/Corner invocations updated
- `src/components/set-pieces/SetPieceTakerPanel.test.tsx` — Added 5-test SPQ-03 describe block (SC-2, SC-4, D-01, D-05 colour, D-05 dash class)

## Decisions Made
- D-01 enforced by omitting `showQualityBadge` prop entirely from Penalty row (not `showQualityBadge={false}`)
- D-04 title omission verified by `hasAttribute('title')` returning false — no empty string, no undefined attribute
- Worktree was rebased onto main to pick up Plan 01's sp_tier type extension before implementing Task 1

## Deviations from Plan

None — plan executed exactly as written. One process adjustment: rebased worktree branch onto main (via `git rebase main`) to obtain Plan 01's `SetPieceTaker` sp_quality fields before starting Task 1. This is normal wave-2 continuation behaviour, not a deviation.

## Issues Encountered
- Worktree branch was created before Plan 01 wave 1 committed to main. Resolved with `git rebase main` (clean, no conflicts).

## Checkpoint: Task 3 — Mobile Layout Audit (SPQ-03 SC-5)

**Status:** APPROVED by user 2026-05-09

**Type:** checkpoint:human-verify
**Blocking:** Yes (SC-5 visual confirmation required before plan can close)

### What was built (for verifier)
- `/api/set-pieces` route now merges `sp_quality.json` and computes `sp_tier` server-side (Plan 01 — wave 1)
- `SetPieceTakerPanel` renders Elite / Good / Weak / "—" badges in FK and Corner rows (D-01: penalty row has no badge)
- Tooltip wording per D-04 with sp_sample_n substituted (e.g. "n=14 shots")
- 5 new Vitest cases for SPQ-03 all passing; 8/8 tests green in this file

### How to verify (SC-5 mobile audit)
1. Run `npm run dev` from the project root.
2. In a Chromium-based browser, open Developer Tools, toggle the device toolbar, and select a 390×844 viewport (e.g. iPhone 12 Pro).
3. Navigate to the Set-Pieces tab (or whichever tab hosts SetPieceTakerPanel — currently the "Set Pieces" nav tab).
4. Verify visually:
   - Each team card shows three rows: Penalties, Direct FK, Corners
   - FK and Corner rows show a colour-coded badge (green/zinc/amber) with text "Elite", "Good", "Weak", or "—"
   - Penalty row shows NO badge (D-01)
   - Hovering (or long-pressing on touch) a non-"—" badge shows the tooltip wording from D-04 with the actual `n=` value
   - The badge text does NOT cause horizontal overflow in the card
   - The card does not push existing fields (player names, "Changed" badge when present) out of view
5. Resize the device toolbar to 430px wide and re-verify step 4.
6. (Optional) Check at desktop breakpoint (1280px) — badges should render inline alongside the player name with no visual regression.
7. If `sp_quality.json` is not present locally, all badges will show "—" (graceful fallback per D-06) — this is acceptable.

### Resume signal
Type "approved" if mobile layout is clean at 390px and 430px; otherwise describe the overflow / wrapping issue and which row/team triggered it.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Tasks 1 and 2 complete; SP_TIER_CLASSES, DeliveryQualityBadge, and 8 Vitest tests all green
- SC-5 mobile layout audit (Task 3) pending user verification
- Once Task 3 is approved, plan 02 closes and phase 85 is complete

---
*Phase: 85-set-piece-threat-assisted-ui*
*Completed: 2026-05-09 (all 3 tasks complete; SC-5 mobile audit approved)*
