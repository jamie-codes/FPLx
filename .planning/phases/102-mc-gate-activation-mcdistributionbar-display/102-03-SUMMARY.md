---
phase: 102-mc-gate-activation-mcdistributionbar-display
plan: "03"
subsystem: ui
tags: [mc, captaincy, react, tailwind, vitest, typescript]

requires:
  - phase: 102-01
    provides: mc_enabled gate activation in pipeline (p10_pts/p90_pts written to merged_players.json)
  - phase: 102-02
    provides: MCDistributionBar component in XPtsCell hover card

provides:
  - CandidateRow inline P10/P90 range span after pts (C) display in CaptainPicksPanel

affects:
  - captaincy
  - captain picks panel

tech-stack:
  added: []
  patterns:
    - "Conditional inline span after main data span using !== undefined guard (BGW-safe: 0.0 passes)"
    - "Raw pipeline values (not doubled) for range display; captain doubling stays on pts (C) only"

key-files:
  created: []
  modified:
    - src/components/captaincy/CaptainPicksPanel.tsx
    - src/components/captaincy/CaptainPicksPanel.test.tsx

key-decisions:
  - "Raw P10/P90 (not doubled) in range span per D-09 — pts (C) stays doubled; range clarifies base distribution"
  - "!== undefined guard (not falsy) ensures p10_pts=0.0 BGW edge case still renders"
  - "Silent gate-off: when either p10_pts or p90_pts is undefined, only pts (C) shows (no fallback text)"

patterns-established:
  - "Phase 102 MC-02 inline range: conditional JSX sibling span, guard before render, raw values, muted text-xs styling"

requirements-completed:
  - MC-02

duration: 8min
completed: 2026-05-13
---

# Phase 102 Plan 03: MC Gate Activation — CaptainPicksPanel P10/P90 Range Summary

**Inline P10/P90 base-points range added to CandidateRow after pts (C), formatted as ' · 4.1–18.1' with muted text-xs zinc-400 styling and strict !== undefined BGW-safe gate**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-13T12:45:00Z
- **Completed:** 2026-05-13T12:53:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added conditional span immediately after the pts (C) span in `CandidateRow`: renders `' · {p10}–{p90}'` when both `candidate.p10_pts !== undefined` and `candidate.p90_pts !== undefined`
- Separator is U+00B7 middle dot (`{' · '}`) and range uses U+2013 en-dash (`{'–'}`), both as explicit JSX string literals per plan spec
- Values formatted to 1 decimal place via `.toFixed(1)`; no `* 2` multiplication (raw pipeline base points per D-09)
- Classes exactly: `text-xs text-zinc-400 dark:text-zinc-500 tabular-nums` — visually subordinate to the `text-sm` pts (C) display
- 6 new tests in `Phase 102 MC-02: CandidateRow P10/P90 inline range` describe block; all 26 tests (20 existing + 6 new) pass

## Diff Applied to CandidateRow

The edit inserts a single conditional span after the closing `</span>` of the pts (C) span and before the FragilityBadge IIFE comment:

```tsx
// Before:
<span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
  {((candidate.xPts_1gw ?? 0) * 2).toFixed(1)} pts (C)
</span>
{/* Fragility badge (Phase 93 SENS-01) ... */}

// After:
<span className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
  {((candidate.xPts_1gw ?? 0) * 2).toFixed(1)} pts (C)
</span>
{candidate.p10_pts !== undefined && candidate.p90_pts !== undefined && (
  <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
    {' · '}{candidate.p10_pts.toFixed(1)}{'–'}{candidate.p90_pts.toFixed(1)}
  </span>
)}
{/* Fragility badge (Phase 93 SENS-01) ... */}
```

## Raw P10/P90 (not doubled) — Intentional per D-09

The pts (C) span continues to multiply by 2 (`* 2`) to represent the captain doubling. The P10/P90 range span uses the raw pipeline values from `merged_players.json` — no multiplication. This is deliberate: the range clarifies the **base distribution** (what the player scores as a non-captain), allowing users to compare spread (e.g. `8.2 pts (C) · 4.1–18.1` high-ceiling vs `8.2 pts (C) · 6.0–10.5` tight-band) independently of the captain doubling effect.

## Gate-off Path Confirmed

When either `p10_pts` or `p90_pts` is `undefined` (no MC data, or MC gate off):
- The conditional expression evaluates to `false` — the range span is not rendered
- Only `"X.X pts (C)"` shows — identical to pre-Phase 102 behaviour
- No fallback text, no empty span, no visible change to the UI

The `!== undefined` guard (not a falsy check) means `p10_pts = 0.0` (BGW) still renders `' · 0.0–0.0'` — a deliberate and tested edge case.

## Task Commits

1. **Task 1: Add inline P10/P90 range to CandidateRow and write tests** - `9ec73fe` (feat)

## Files Created/Modified

- `src/components/captaincy/CaptainPicksPanel.tsx` — CandidateRow gets conditional P10/P90 range span after pts (C) (5 lines inserted)
- `src/components/captaincy/CaptainPicksPanel.test.tsx` — 6 new tests in Phase 102 MC-02 describe block appended at end of file

## Decisions Made

- Raw P10/P90 values (not doubled) per D-09 — consistent with MCDistributionBar in XPtsCell hover card and with pipeline output
- `!== undefined` guard (not `&&` falsy) — BGW produces `p10_pts: 0.0` which is a valid and displayable value
- Silent omission (no fallback text) on gate-off — pts (C) span unchanged, zero visual regression

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Changes are display-only, gate-off safe.

## Next Phase Readiness

- MC-02 UI deliverable complete
- Plan 01 (pipeline gate flip) is the remaining prerequisite for MC fields to be non-undefined in production
- After Plan 01 daily pipeline run, captain cards will display `"X.X pts (C) · Y.Y–Z.Z"` for each candidate
- Until Plan 01 ships, MC fields are undefined → only `"X.X pts (C)"` shows (silent gate-off, no regression)

## Self-Check

- [x] `src/components/captaincy/CaptainPicksPanel.tsx` exists and contains the P10/P90 conditional span
- [x] `src/components/captaincy/CaptainPicksPanel.test.tsx` exists and contains the Phase 102 MC-02 describe block
- [x] Commit `9ec73fe` exists (feat(102-03))
- [x] All 26 tests pass; TypeScript clean; ESLint clean

## Self-Check: PASSED

---
*Phase: 102-mc-gate-activation-mcdistributionbar-display*
*Completed: 2026-05-13*
