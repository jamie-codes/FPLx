---
phase: 113-transfer-regret-backtester-v1-20
plan: "04"
subsystem: ui
tags: [fpl, ui, backtab, transfer-regret, toggle, recharts, tdd, checkpoint]

# Dependency graph
requires:
  - phase: 113-01
    provides: TransferRegretEntry type, DecisionHistory.transferEntries? extension
  - phase: 113-02
    provides: computeTransferSeasonSummary, computeTransferDelta, TransferSeasonSummary
  - phase: 113-03
    provides: GET /api/decision-history now returns transferEntries array

provides:
  - "Captain|Transfer pill toggle — first visual element in BackTab, default Captain, resets on remount"
  - "TransferRegretView component — empty state + TransferSeasonSummaryHeader + TransferRegretChart + per-GW rows"
  - "transferRegretFill helper — bar chart Cell fill (delta > 0 → red, < 0 → green, null/0 → grey)"
  - "25/25 vitest tests GREEN (16 existing captain + 9 new Phase 113 toggle/TransferRegretView)"

affects:
  - "User-visible BACK-02 delivery — visible in BackTab under Transfer pill"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useState<'captain' | 'transfer'>('captain') placed before all early returns (Rules of Hooks)"
    - "Captain view wrapped in {view === 'captain' && <>...</>} — zero existing code modifications"
    - "TransferRegretView + TransferSeasonSummaryHeader + TransferRegretChart as inline components in BackTab.tsx"
    - "U+2212 MINUS SIGN (not ASCII hyphen) for good-hold delta copy per UI-SPEC §5"
    - "U+2014 EM DASH for null delta copy per UI-SPEC §5"

key-files:
  created: []
  modified:
    - src/components/accuracy/BackTab.tsx
    - src/components/accuracy/BackTab.test.tsx
    - src/lib/regret.ts (Wave 1 sync — computeTransferDelta + computeTransferSeasonSummary)
    - src/lib/types.ts (Wave 1 sync — TransferRegretEntry + SlimPlayer + DecisionHistory.transferEntries?)

key-decisions:
  - "TransferRegretView implemented inline in BackTab.tsx (not extracted to separate file) — smaller scope, tests pass without additional imports"
  - "TransferSeasonSummaryHeader, TransferRegretChart, TransferRegretTooltip all inline in BackTab.tsx — consistent with existing RegretChart/RegretTooltip pattern"
  - "formatTransferCell helper handles both 1-FT and 2-FT leg formatting — joins with ' + ' per D-07 compressed format"
  - "Wave 1 sync (regret.ts + types.ts) committed as separate chore commit — mirrors Plan 03 precedent; worktree forked before Wave 1 landed"

requirements-completed: [BACK-02]

# Metrics
status: checkpoint
checkpoint_type: human-verify
checkpoint_at: Task 3
duration: ~5min
completed: 2026-05-15
---

# Phase 113 Plan 04: BackTab Captain|Transfer Toggle + TransferRegretView Summary

**CHECKPOINT: Awaiting human verification — Tasks 1 + 2 complete (25/25 tests GREEN); Task 3 is human-verify gate confirming dark mode rendering, multi-transfer GW compression, and visual colour correctness in a live dev environment.**

## Performance

- **Duration:** ~5 min (Tasks 1 + 2)
- **Started:** 2026-05-15T20:16:40Z
- **Checkpoint reached:** 2026-05-15T20:21:54Z
- **Tasks:** 2/3 complete (Task 3 is human-verify checkpoint)
- **Files modified:** 4

## Accomplishments

- Task 1 (RED): Extended `BackTab.test.tsx` with `transferEntry()` factory, `describe('BackTab — Phase 113 BACK-02 Transfer Toggle')` (5 tests), and `describe('BackTab — Phase 113 TransferRegretView')` (5 tests). All 9 new tests confirmed failing in RED state.
- Task 2 (GREEN): Implemented Captain|Transfer pill toggle, `TransferRegretView`, `TransferSeasonSummaryHeader`, `TransferRegretChart`, `TransferRegretTooltip`, `transferRegretFill`, and `formatTransferCell` in `BackTab.tsx`. All 25 tests GREEN.
- Wave 1 dependency sync: Copied `regret.ts` and `types.ts` from main repo (Rule 3 — blocking; same deviation pattern as Plan 03).

## Task Commits

1. **Task 1: RED tests** - `9208764` (test)
2. **Wave 1 dependency sync** - `d78cd8b` (chore)
3. **Task 2: GREEN implementation** - `ad919de` (feat)

## Files Created/Modified

- `src/components/accuracy/BackTab.tsx` — Captain|Transfer pill toggle as first element; TransferRegretView + sub-components inline; transferRegretFill helper; useState before early returns; captain view wrapped in conditional
- `src/components/accuracy/BackTab.test.tsx` — transferEntry() factory; 2 new describe blocks with 10 test cases total; fireEvent/screen imported
- `src/lib/regret.ts` — Wave 1 sync: computeTransferDelta + computeTransferSeasonSummary + TransferSeasonSummary interface
- `src/lib/types.ts` — Wave 1 sync: TransferRegretEntry + SlimPlayer + DecisionHistory.transferEntries?

## Component Structure Chosen (inline)

All new components are inline in `BackTab.tsx`:
- `TransferRegretView({ entries })` — top-level transfer view; handles empty state
- `TransferSeasonSummaryHeader({ entries })` — season summary with D-13 copy
- `TransferRegretChart({ entries })` — recharts bar chart (delta dataKey, transferRegretFill)
- `TransferRegretTooltip` — recharts tooltip for transfer entries
- `formatTransferCell(sell, buy, sellPts, buyPts)` — 1-FT + 2-FT leg formatter

No deviations from UI-SPEC copy contract. All exact string literals match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced Wave 1 regret.ts + types.ts from main repo**
- **Found during:** Task 2 setup (GREEN implementation would fail — computeTransferSeasonSummary missing)
- **Issue:** Worktree forked before Wave 1 (Plans 01+02) changes landed in main. `regret.ts` lacked `computeTransferDelta`/`computeTransferSeasonSummary`; `types.ts` lacked `TransferRegretEntry`/`SlimPlayer`.
- **Fix:** Copied both files from main repo HEAD (same files Plan 03 synced, but in a different worktree).
- **Files modified:** `src/lib/regret.ts`, `src/lib/types.ts`
- **Committed in:** `d78cd8b` (chore — Wave 1 sync)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking dependency)

## Plan-Level Verification (Tasks 1 + 2)

- [x] `npx vitest run src/components/accuracy/BackTab.test.tsx` exits 0 (25/25 pass)
- [x] `grep -c "dangerouslySetInnerHTML" src/components/accuracy/BackTab.tsx` returns 0
- [x] `grep -c "aria-label=\"Backtester view\"" src/components/accuracy/BackTab.tsx` returns 1
- [x] `grep -c "aria-label=\"Transfer regret per gameweek\"" src/components/accuracy/BackTab.tsx` returns 1
- [ ] Manual checkpoint (Task 3) — awaiting human verification

## Checkpoint Status

**Checkpoint:** Task 3 — human-verify (blocking gate)

The following items require live dev environment verification per `113-VALIDATION.md` Manual-Only Verifications:
1. Bar chart renders correctly in dark mode (red/green/grey bars)
2. Multi-transfer GW row shows compressed `Sell X buy Y + Sell A buy B` format
3. Delta positive: `+N pts (engine better)` text + red colour

The orchestrator will present the 9-step verification checklist to the user.

## Next Phase Readiness

After human verification (Task 3 approved):
- Plan 04 is complete; BACK-02 requirement fully delivered
- Phase 113 wave 3 is the final wave

## Self-Check: PASSED

- FOUND: src/components/accuracy/BackTab.tsx
- FOUND: src/components/accuracy/BackTab.test.tsx
- FOUND commit: 9208764 (test — RED tests)
- FOUND commit: d78cd8b (chore — Wave 1 sync)
- FOUND commit: ad919de (feat — GREEN implementation)
- VERIFIED: 25/25 vitest tests pass
- VERIFIED: 0 dangerouslySetInnerHTML occurrences
- VERIFIED: aria-label="Backtester view" present (1 occurrence)
- VERIFIED: aria-label="Transfer regret per gameweek" present (1 occurrence)
- VERIFIED: U+2212 MINUS SIGN in both test file and implementation
- Pre-existing tsc errors (5) confirmed identical to post-Plan-03 worktree state

---
*Phase: 113-transfer-regret-backtester-v1-20*
*Status: Checkpoint — awaiting human verification (Task 3)*
*Completed: 2026-05-15*
