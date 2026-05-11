---
phase: 94-rejection-explainer-enhancements
plan: "02"
subsystem: ui
tags: [react, typescript, autocomplete, tailwind, rejection-explainer, transfer-panel]

requires:
  - phase: 94-rejection-explainer-enhancements-01
    provides: [computeRejection-8-predicates, RejectionResult, 3rd-required-param-lifecycleLabels]

provides:
  - PlayerSearchInput shared autocomplete component (text-sm / text-xs configurable)
  - RejectionSearchCallout TransferPanel entry point for WHY-01-A
  - TransferPanel always-visible rejection search above OCS (D-07)

affects:
  - src/components/shared/PlayerSearchInput.tsx (Plan 03 will import this)
  - src/components/transfers/RejectionSearchCallout.tsx
  - src/components/transfers/TransferPanel.tsx

tech-stack:
  added: []
  patterns:
    - Shared reusable autocomplete with inline debounce (no custom hook needed)
    - onMouseDown vs onClick for dropdown selection before onBlur fires
    - iOS zoom guard via style={{ fontSize: '16px' }} on input
    - computeRejection mounted in component via useMemo (same pattern as GemTable row-expand)
    - Outside-squadData-guard placement pattern for pre-load UI elements

key-files:
  created:
    - src/components/shared/PlayerSearchInput.tsx
    - src/components/transfers/RejectionSearchCallout.tsx
  modified:
    - src/components/transfers/TransferPanel.tsx

key-decisions:
  - "PlayerSearchInput matches web_name only — first_name/second_name not on ScoredPlayer (confirmed via grep); acceptable per RESEARCH Q1"
  - "scoredPlayers.length > 0 guard on RejectionSearchCallout mount prevents empty search list during brief pre-usePlayers-resolve window"
  - "RejectionSearchCallout uses posCodeLabel derived from POSITION_CODES_LABEL map for rank copy to match UI-SPEC verbatim"
  - "Pre-existing test failures (MobileNav, CaptainPicksPanel, club-form) are unrelated to Plan 02 changes — documented as out-of-scope"

patterns-established:
  - "PlayerSearchInput accepts inputClassName prop for text-sm (TransferPanel) vs text-xs (GemTable) sizing — Plan 03 uses text-xs"
  - "RejectionSearchCallout header uses &#8505;&#65039; (U+2139 + U+FE0F) matching HighOwnershipCallout pattern"

requirements-completed: [WHY-01]
duration: 15min
completed: 2026-05-11
---

# Phase 94 Plan 02: TransferPanel WHY-01-A Entry Point (PlayerSearchInput + RejectionSearchCallout) Summary

**Shared `PlayerSearchInput` autocomplete and `RejectionSearchCallout` always-visible WHY-01-A entry point mounted in TransferPanel above the OCS, outside the squadData guard, reusing the Plan 01 `computeRejection` engine verbatim.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T08:45:00Z
- **Completed:** 2026-05-11T08:50:30Z
- **Tasks:** 2 (plus checkpoint Task 3 — awaiting UAT)
- **Files modified:** 3

## Accomplishments

- `PlayerSearchInput` shared component shipped: 150ms debounce, 2-char min, 6 suggestions max, web_name match, iOS-zoom guard, onMouseDown dropdown, z-50, dark mode, aria-label support
- `RejectionSearchCallout` ships the WHY-01-A UX: always-visible ℹ️ header + search field, callout between search and OCS (never hides OCS per D-08), positive framing or reasons list matching GemTable structure, × dismiss button
- TransferPanel now mounts `<RejectionSearchCallout>` at line 347 — before the squadData guard (line 354) so it renders pre-squad-load per D-07; lifecycle reasons silently absent when squad not loaded (D-05)
- TypeScript: zero errors; all 1093 passing tests remain green

## Task Commits

1. **Task 1: PlayerSearchInput** - `7a5ccca` (feat)
2. **Task 2: RejectionSearchCallout + TransferPanel mount** - `93cf4fb` (feat)
3. **Task 3: Manual UAT checkpoint** — AWAITING USER VERIFICATION

## Files Created/Modified

- `src/components/shared/PlayerSearchInput.tsx` (87 lines) — Shared autocomplete; exports `PlayerSearchInput` and `PlayerSearchInputProps`; importable at `@/components/shared/PlayerSearchInput`
- `src/components/transfers/RejectionSearchCallout.tsx` (95 lines) — WHY-01-A container; calls `computeRejection(selectedPlayer, players, lifecycleLabels)`
- `src/components/transfers/TransferPanel.tsx` — Added import + JSX mount at line 347 (before squadData guard at line 354)

## PlayerSearchInputProps Interface (for Plan 03)

```typescript
export interface PlayerSearchInputProps {
  players: ScoredPlayer[]
  onSelect: (player: ScoredPlayer | null) => void
  placeholder?: string
  /** text-sm (TransferPanel default) vs text-xs (GemTable row-expand) */
  inputClassName?: string
  'aria-label'?: string
}
```

Import path for Plan 03: `import { PlayerSearchInput } from '@/components/shared/PlayerSearchInput'`

## TransferPanel Placement Details

- `<RejectionSearchCallout` JSX inserted at **line 347** in `src/components/transfers/TransferPanel.tsx`
- `{squadData && scoredPlayers.length > 0 && (` guard is at **line 354**
- Placement verified: callout (347) < squadData guard (354) — always renders above squad-conditional content

## Decisions Made

- Matched web_name only in autocomplete — first_name/second_name not present on ScoredPlayer (verified)
- Used `scoredPlayers.length > 0` as outer guard (not `scoredPlayers` truthy) to mirror existing TransferPanel patterns and prevent empty search list during data loading
- Positive framing copy includes position code (e.g. "at MID") via POSITION_CODES_LABEL lookup — matches UI-SPEC §Copywriting Contract

## Deviations from Plan

None — plan executed exactly as written. Component bodies match plan-provided code verbatim.

## Issues Encountered

Pre-existing test failures (16 tests in MobileNav.test.tsx, captain-picks.test.ts, club-form.test.ts) are unrelated to Plan 02 changes. Confirmed: none reference PlayerSearchInput or RejectionSearchCallout. Logged as out-of-scope per deviation scope boundary rules.

## Manual UAT Outcome

AWAITING — Task 3 is a `checkpoint:human-verify` gate. User must:
1. Visit Transfers tab without squad — verify ℹ️ search card visible above all other content
2. Type "sal" — verify dropdown with ≤6 matches (web_name + team)
3. Select player — verify callout with rejection reasons or positive framing
4. Click × — verify callout clears, search remains
5. Load squad — verify lifecycle reasons appear for sell/sell_soon players
6. Confirm OCS table below never disappears

## Next Phase Readiness

- `PlayerSearchInput` at `@/components/shared/PlayerSearchInput` is ready for Plan 03 (ComparisonSearch in GemTable row-expand)
- `PlayerSearchInputProps` interface documented above for Plan 03 consumption
- WHY-01-A entry point complete pending UAT approval

## Known Stubs

None — all data flows are wired: `scoredPlayers` from existing `computeAllGemScores`, `lifecycleLabels` from existing useMemo, `computeRejection` from Plan 01 engine.

## Self-Check

- [x] `src/components/shared/PlayerSearchInput.tsx` exists (87 lines, exports PlayerSearchInput + PlayerSearchInputProps)
- [x] `src/components/transfers/RejectionSearchCallout.tsx` exists (95 lines, exports RejectionSearchCallout)
- [x] `src/components/transfers/TransferPanel.tsx` imports and mounts RejectionSearchCallout
- [x] Task 1 commit `7a5ccca` exists
- [x] Task 2 commit `93cf4fb` exists
- [x] TypeScript: zero errors
- [x] Pre-existing test suite: 1093/1093 passing tests remain green (16 pre-existing failures unrelated)

## Self-Check: PASSED
