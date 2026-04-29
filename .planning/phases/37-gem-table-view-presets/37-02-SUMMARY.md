---
phase: 37-gem-table-view-presets
plan: 02
subsystem: ui
tags: [react, tanstack-table, column-visibility, typescript, tailwind]

# Dependency graph
requires:
  - phase: 37-gem-table-view-presets
    plan: 01
    provides: ViewPreset type, PRESET_COLUMN_VISIBILITY, extended getColumnVisibility from GwToggle.tsx
provides:
  - PresetToggle component (desktop-only segmented toggle)
  - GemTable accepting preset/onPresetChange props
  - gemPreset state lifted to page.tsx, surviving tab switches
affects:
  - page.tsx render tree (new prop path page → GemTable → PresetToggle)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Desktop-only toggle using hidden sm:flex wrapper — no mobile touch target sizing needed"
    - "Prop drilling with safe no-op fallback: onPresetChange ?? (() => {})"
    - "Mobile bypass in getColumnVisibility call: isMobile ? 'default' : preset"
    - "useState at page level above conditional render preserves state across sub-tab switches"

key-files:
  created:
    - src/components/gem-table/PresetToggle.tsx
  modified:
    - src/components/gem-table/GemTable.tsx
    - src/app/page.tsx

key-decisions:
  - "gemPreset state lives in page.tsx (not GemTable) so it survives the conditional render that unmounts GemTable on tab switches"
  - "onPresetChange ?? (() => {}) no-op fallback preserves backward compat when GemTable is used without props"
  - "Mobile preset is hard-coded to 'default' in getColumnVisibility call — mobile already uses MOBILE_HIDDEN_COLUMNS; injecting preset would conflict with D-07 invariant"
  - "PresetToggle copies GwToggle segmented button pattern exactly per D-06 — no new button abstraction introduced"

requirements-completed: [GEM-01, GEM-02, GEM-03, GEM-04]

# Metrics
duration: ~20min
completed: 2026-04-29
---

# Phase 37 Plan 02: GemTable View Preset Wiring Summary

**PresetToggle.tsx created; GemTable.tsx and page.tsx wired with preset props; three-button Default / Compact / Analysis toggle visible on desktop, hidden on mobile, with session-persistent state**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-04-29
- **Tasks:** 2 (+ 1 human-verify checkpoint)
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

- Created `PresetToggle.tsx` — segmented three-button toggle (Default / Compact / Analysis) matching UI-SPEC D-06 pattern. Desktop-only via `hidden sm:flex` wrapper. `aria-pressed` on each button. Active state: `bg-zinc-900 dark:bg-white`; inactive: `bg-white dark:bg-zinc-800`.
- Updated `GemTable.tsx` with `GemTableProps` interface (`preset?: ViewPreset`, `onPresetChange?`), wired `getColumnVisibility(gwHorizon, isMobile, isMobile ? 'default' : preset)`, and rendered `PresetToggle` left of `GwToggle` in the sticky controls bar inside a `flex items-center gap-2` wrapper.
- Updated `page.tsx` to lift `gemPreset` state via `useState<ViewPreset>('default')` and pass `preset={gemPreset} onPresetChange={setGemPreset}` to `GemTable`.
- Human verify checkpoint passed: all 9 checks confirmed — toggle visible on desktop, hidden on mobile, Compact/Analysis column sets correct, session persistence across tab switches confirmed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PresetToggle component (TDD RED)** — `df4ed64` (test)
2. **Task 1: Create PresetToggle component (TDD GREEN)** — `20b60f2` (feat)
3. **Task 2: Wire GemTable.tsx and page.tsx with preset props** — `25e4d81` (feat)

## Files Created/Modified

- `src/components/gem-table/PresetToggle.tsx` — NEW. Segmented button group for preset selection. `'use client'`, imports `ViewPreset` from `./GwToggle`, maps `(['default', 'compact', 'analysis'] as const)` to buttons with `aria-pressed`.
- `src/components/gem-table/GemTable.tsx` — MODIFIED. Added `GemTableProps` interface and updated function signature, wired preset into `getColumnVisibility` call, rendered `PresetToggle` in sticky bar.
- `src/app/page.tsx` — MODIFIED. Added `ViewPreset` import, added `gemPreset` state, passed `preset` and `onPresetChange` props to `GemTable`.

## Human Verify Checkpoint

**Checkpoint:** `checkpoint:human-verify` (blocking gate before plan completion)
**Outcome:** APPROVED — all 9 checks passed:
1. Toggle visible on desktop (>= 640px), left of GW horizon toggle
2. "Default" button shows active state (filled background)
3. Compact preset: only Player, Pos, Gem, xPts, Risk visible
4. Analysis preset: Default columns plus xG/90 and xA/90
5. Default preset: standard view restored
6. Switching sub-tabs and returning preserves last-selected preset (no reset to Default)
7. GW horizon toggle works correctly alongside any preset
8. Mobile: preset toggle not rendered (hidden sm:flex)
9. GW toggle continues working on mobile

## Decisions Made

- `gemPreset` state lifted to `page.tsx` rather than kept inside `GemTable` — the conditional render `{activeSection !== 'squad' && activeSubTab === 'gems' && ...}` unmounts GemTable on tab switch; state inside GemTable would reset. Lifting to page level is the correct fix per D-08/D-09.
- Mobile preset hard-coded to `'default'` in the `getColumnVisibility` call — mobile already receives `MOBILE_HIDDEN_COLUMNS` behavior when `isMobile=true`; passing preset there would conflict with the D-07 invariant established in Plan 01.
- `onPresetChange ?? (() => {})` fallback — keeps GemTable backward-compatible for standalone use (e.g., future tests without page context).

## Deviations from Plan

None — plan executed exactly as written. All four edits to GemTable.tsx and three edits to page.tsx matched the plan's action blocks precisely.

## Known Stubs

None — all three preset column sets are fully wired to `PRESET_COLUMN_VISIBILITY` data defined in Plan 01. No placeholder data or hardcoded empty values.

## Threat Flags

None — all threats were pre-registered in the plan's threat model (T-37-04 through T-37-07). No new network endpoints, auth paths, file access patterns, or schema changes introduced. All state is in-memory React `useState`.

---

## Self-Check: PASSED

- `src/components/gem-table/PresetToggle.tsx` exists: FOUND
- `src/components/gem-table/GemTable.tsx` modified: FOUND
- `src/app/page.tsx` modified: FOUND
- Commit `df4ed64` (test — TDD RED): FOUND
- Commit `20b60f2` (feat — TDD GREEN): FOUND
- Commit `25e4d81` (feat — wiring): FOUND

---
*Phase: 37-gem-table-view-presets*
*Completed: 2026-04-29*
