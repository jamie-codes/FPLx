---
phase: 34-chip-strategy
fixed_at: 2026-04-28T07:44:00Z
review_path: .planning/phases/34-chip-strategy/34-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-04-28T07:44:00Z
**Source review:** .planning/phases/34-chip-strategy/34-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: FH `scores[].ease` values are not normalised to 0–1

**Files modified:** `src/lib/chip-strategy-engine.ts`
**Commit:** e5bdea4
**Applied fix:** Replaced `r.score / Math.max(1, 11)` with `r.score / maxScore` where `maxScore = Math.max(...gwResults.map(r => r.score), 1)`. The best GW in the horizon now maps to 1.0 and all others are proportionally scaled, keeping the field in the 0–1 contract expected by `EaseCellBar`.

---

### WR-01: `startingGw ?? 0` produces GW-0 labels before data loads

**Files modified:** `src/components/planner/ChipStrategyPanel.tsx`
**Commit:** d01b7f4
**Applied fix:** Added an early-return guard (Option A from the review) that renders a "Loading fixture data…" message when `!startingGw || clubForm === undefined`. This prevents the engine from being called with GW 0, eliminating the "GW0", "GW1" glitch in cell titles and aria-labels before real data arrives.

---

### WR-02: `fhResult.bestGw || null` falsily converts GW 0

**Files modified:** `src/components/planner/ChipStrategyPanel.tsx`
**Commit:** d0cbdda
**Applied fix:** Replaced `fhResult.bestGw || null` with `fhResult.bestGw > 0 ? fhResult.bestGw : null`. The strict numeric comparison correctly handles the theoretical GW-0 edge case and makes intent explicit.

---

### WR-03: Empty `currentSquadIds` bypasses `FH_DEFAULT_BUDGET_TENTHS` fallback

**Files modified:** `src/components/planner/ChipStrategyPanel.tsx`
**Commit:** ba676d7
**Applied fix:** Changed `currentSquadIds` memo from `(picks ?? []).map(p => p.element)` to `picks !== null ? picks.map(p => p.element) : undefined`. When `picks` is null the engine now receives `undefined`, triggering the `FH_DEFAULT_BUDGET_TENTHS` (£100m) path instead of treating a zero `bankBalance` as the full squad budget.

---

### WR-04: `fetchChipHistory` does not validate API response shape

**Files modified:** `src/lib/hooks/useChipHistory.ts`
**Commit:** c0c9bc3
**Applied fix:** Added a lightweight runtime check — `if (!raw || typeof raw !== 'object') throw new Error(...)` — before casting to `ChipHistoryResponse`. The final return uses `Array.isArray(data.chips) ? data.chips : []` rather than `data.chips ?? []`, ensuring a non-array value is rejected rather than silently accepted.

---

### WR-05: Non-null assertion `teamId!` inside `queryFn`

**Files modified:** `src/lib/hooks/useChipHistory.ts`
**Commit:** a432f49
**Applied fix:** Replaced the single-expression `() => fetchChipHistory(teamId!)` with an explicit guard: `if (!teamId) throw new Error('teamId is required'); return fetchChipHistory(teamId)`. This removes the `!` assertion and makes the invariant explicit, protecting against future callers that bypass the `enabled` guard.

---

_Fixed: 2026-04-28T07:44:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
