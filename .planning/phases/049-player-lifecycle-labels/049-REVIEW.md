---
phase: 049-player-lifecycle-labels
reviewed: 2026-05-01T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/lifecycle-label.ts
  - src/lib/__tests__/lifecycle-label.test.ts
  - src/components/shared/LifecycleLabelBadge.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/components/squad/SquadView.tsx
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 049: Code Review Report

**Reviewed:** 2026-05-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the lifecycle-label engine (`computeLifecycleLabel` / `computeLifecycleLabels`), its badge component, and the two consumer components that wire it into the UI. The core cascade logic is mostly sound: priority ordering is correctly implemented, null clubForm degrades gracefully, and the bench exclusion mirror matches `computeVerdicts`. Two behavioural gaps were found — one in the priority cascade (a `regression_signal` guard that was applied to priority 3 but silently omitted from priority 4), and one in test coverage (no test exercises the affected code path). One cosmetic CSS issue is noted.

## Warnings

### WR-01: `regression_signal='sell'` guard missing from `hold_one_more` (Priority 4)

**File:** `src/lib/lifecycle-label.ts:131-138`

**Issue:** `buy_next_week` (priority 3) has an explicit guard `player.regression_signal !== 'sell'` on line 123. `hold_one_more` (priority 4) has no equivalent guard. As a result, a player with `regression_signal = 'sell'` and a weak `swing_1gw` (below SWING_THRESHOLD) but strong `swing_3gw` (>= SWING_THRESHOLD) will be labelled `hold_one_more`, advising the manager to hold for fixture improvement — directly contradicting the regression sell signal. The two labels carry opposing advice.

Concrete path that hits the bug:
- `gem = posAvg * 0.95` (hold band)
- `regression_signal = 'sell'`
- `swing_1gw = 0.05` (below threshold — priority 3 skipped)
- `swing_3gw = 0.30` (>= threshold — priority 4 fires, returns `hold_one_more`)

**Fix:**
```ts
// Priority 4: Hold One More
if (
  gem >= posAvg * SELL_SOON_THRESHOLD &&
  gem <= posAvg &&
  clubForm !== null &&
  (clubForm.swing_3gw ?? 0) >= SWING_THRESHOLD &&
  player.regression_signal !== 'sell'   // add this guard to match priority 3
) {
  return 'hold_one_more'
}
```

### WR-02: No test covers `regression_signal='sell'` blocking `hold_one_more`

**File:** `src/lib/__tests__/lifecycle-label.test.ts:227-324`

**Issue:** Test 8 verifies that `regression_signal = 'sell'` blocks `buy_next_week` and falls back to `hold` (because `swing_3gw` is null in that test). There is no test that passes `regression_signal = 'sell'` with a qualifying `swing_3gw` (>= SWING_THRESHOLD) and a non-qualifying `swing_1gw`. That path is the exact gap described in WR-01, and the missing test is why the bug was not caught.

**Fix:** Add a test adjacent to "Test 8":

```ts
it('Hold One More blocked by regression_signal=sell — returns hold', () => {
  const player = makePlayer({
    gem_score: posAvg * 0.95, // in hold band
    regression_signal: 'sell',
  })
  const form = makeClubForm({ swing_1gw: 0.05, swing_3gw: 0.30 })
  expect(computeLifecycleLabel(player, posAvg, form)).toBe('hold')
})
```

This test will fail until WR-01 is also fixed.

## Info

### IN-01: Duplicate `transition-` utilities on submit button suppress color hover animation

**File:** `src/components/transfers/TransferPanel.tsx:144`

**Issue:** The "Load Squad" button has both `transition-colors` and `transition-transform` in its className. In Tailwind both compile to a `transition` CSS property; the last one in the cascade (`transition-transform`) overrides the first, meaning the `hover:bg-zinc-700` color transition will not animate. Only the `active:scale-95` transform will animate. This pattern appears in other buttons in the codebase so is not introduced by this phase, but it does appear on the submit button which is the primary action.

**Fix:** Replace the two separate utilities with a single `transition-all` (or use `transition` with both properties listed explicitly via Tailwind's `transition` utility with `duration` configured):

```tsx
className="... transition-all cursor-pointer active:scale-95 w-full sm:w-auto"
```

---

_Reviewed: 2026-05-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
