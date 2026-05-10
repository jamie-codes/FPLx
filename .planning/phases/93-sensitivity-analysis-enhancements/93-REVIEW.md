---
phase: 93
status: has-findings
critical: 1
warnings: 3
info: 2
reviewed_at: 2026-05-10
---

# Phase 93: Code Review — Sensitivity Analysis Enhancements

**Reviewed:** 2026-05-10
**Depth:** standard
**Files Reviewed:** 5
**Status:** has-findings

Files reviewed:
- `src/lib/sensitivity.ts`
- `src/components/shared/FragilityBadge.tsx`
- `src/components/captaincy/CaptainPicksPanel.tsx`
- `src/components/gem-table/GemTable.tsx`
- `src/components/transfers/OpportunityCostTable.tsx`

---

## Summary

Phase 93 introduces a tristate fragility engine (robust/fragile/knife_edge) and wires a `FragilityBadge` into three UI surfaces. The core engine is well-structured with named constants and clean tier mapping. Most of the implementation is sound. However, one Critical defect was found: the fixture-difficulty perturbation silently omits the `easy` tier, meaning players with easy upcoming fixtures are never flagged as fragile due to fixture risk — directly contradicting the user's accepted design decision in `93-CONTEXT.md D-03` and `93-DISCUSSION-LOG.md`. The implementation summary (`093-02-SUMMARY.md`) documents this as a deliberate trade-off to pass 23/24 tests, but the test suite itself contains an irreconcilable contradiction, and the chosen resolution silently breaks the feature for easy-fixture players. Three additional Warnings cover a net-vs-gross argument mismatch in the transfer surface, a redundant null guard producing misleading code, and duplicate computation in GemTable's expanded rows.

---

## Critical Issues

### CR-01: Fixture-difficulty perturbation silently omits `easy` tier

**File:** `src/lib/sensitivity.ts:83-87`

**Issue:** The spec (`93-CONTEXT.md D-03`, `93-DISCUSSION-LOG.md` line 44, `93-UI-SPEC.md` table row for perturbation (c)) explicitly requires both `easy → medium` and `medium → hard` transitions to count as reversals. The implementation only checks `difficulty_tier === 'medium'`, silently leaving `easy`-fixture players with zero fragility signal from this perturbation — regardless of all other risk factors.

The `093-02-SUMMARY.md` documents this as an intentional deviation to achieve 23/24 test passes, attributing the failure to a contradiction between test case 1 (easy fixture, `isTransfer=true`, expects `robust`) and test case 13 (easy fixture, `isTransfer=false`, expects `fragile`). However, the test contradiction should be resolved by fixing the test, not by removing the feature.

Test case 1 was authored for Phase 64 (binary fragile/robust) where `easy` did not trigger; it was not updated when Phase 93 extended the spec to include `easy`. Test case 13 reflects the correct Phase 93 intent. Keeping the Phase 64 behavior means `easy`-fixture players never get a `FRAGILITY_HARDER_FIXTURE` reason, even when they are genuinely fragile on other dimensions. A user holding an easy-fixture player near the `knife_edge` boundary will see `fragile` instead of `knife_edge` because the easy→medium perturbation is dropped.

**Fix:**

```ts
// (c) fixture +1 tier perturbation — BGW guard, hard skip (D-03)
if (
  player.fixtures.length > 0 &&
  (player.fixtures[0].difficulty_tier === 'easy' ||
   player.fixtures[0].difficulty_tier === 'medium')
) {
  reasons.push(FRAGILITY_HARDER_FIXTURE)
}
```

Test case 1 (`easy`, `isTransfer=true`, no other triggers) should be updated from `robust` to `fragile`, reflecting the Phase 93 design intent that `easy → medium` is a reversal regardless of transfer path.

---

## Warnings

### WR-01: `xPtsGainNet` (net) passed where gross `xPtsGain` is required for perturbation (d)

**File:** `src/components/transfers/OpportunityCostTable.tsx:98`

**Issue:** `computeFragility(t.buy, true, row.xPtsGainNet)` passes the **net** expected gain (after hit deduction) as the `xPtsGain` argument. Perturbation (d) in `sensitivity.ts` checks `xPtsGain < COST_HIT_XPTS_THRESHOLD` (5.0) to decide whether adding a £0.5m cost premium would reverse the recommendation. The threshold is a gross-gain check — it asks "is the raw transfer improvement worth the price?". Passing the net value double-counts the hit penalty.

Example: a single-hit row with `xPtsGain=7.0`, `xPtsGainNet=3.0` (after -4pt deduction). Passing `3.0` triggers `3.0 < 5.0 → true`, flagging the transfer as fragile on cost grounds. But the gross gain of 7.0 comfortably clears the 5.0 threshold — the cost perturbation should not fire. The result is false-positive fragility on all hit rows with gross gain between 5.0 and 9.0.

Note: `93-CONTEXT.md D-11` specifies `row.xPtsGainNet` explicitly. The implementation faithfully follows the spec, but the spec is incorrect. This finding is directed at the spec and implementation together.

**Fix:**
```tsx
// Pass gross xPtsGain, not net-of-hit xPtsGainNet.
const { tier, reasons } = computeFragility(t.buy, true, row.xPtsGain)
```

Update `93-CONTEXT.md D-11` to read `row.xPtsGain` and add a comment clarifying that the threshold is a gross-gain check, independent of any hit cost already baked into `xPtsGainNet`.

---

### WR-02: Redundant `?? 100` fallback is unreachable after `!== undefined` guard

**File:** `src/lib/sensitivity.ts:100-101`

**Issue:**
```ts
if (player.chance_of_playing_next_round !== undefined) {
  const currentChance = player.chance_of_playing_next_round ?? 100
```

After the `!== undefined` guard on line 100, `player.chance_of_playing_next_round` is `number | null` inside the block. The `?? 100` on line 101 does execute for `null` values (null passes `!== undefined`), so it is not technically dead code. However, the `null` case represents a healthy player and should **fire** the perturbation (null → treat as 100 → `100 > 50` → counts as a reversal). The `?? 100` accidentally makes this correct, but the intent is unclear.

The real concern is that the outer guard says "only applies when explicitly set", yet `null` is a meaningful value (`null` = healthy, per Phase 88 SCRAPER-01 field comment) and should be treated as 100 — which the `?? 100` achieves. The guard comment ("skip when already doubtful or undefined") is misleading because `null` is neither undefined nor doubtful but still passes the guard.

**Fix:** Clarify the logic and guard to make intent explicit:
```ts
// (e) news flips to "doubt" — skip when field is absent (undefined) or already doubtful (≤50).
// null = healthy (100%); 75 = lightly flagged — both are above DOUBT_CEILING and trigger the perturbation.
if (player.chance_of_playing_next_round !== undefined) {
  const currentChance = player.chance_of_playing_next_round ?? 100  // null = healthy
  if (currentChance > NEWS_DOUBT_CEILING) {
    reasons.push(FRAGILITY_NEWS_DOUBT)
  }
}
```

The fix is documentation-only (updating the comment). The runtime behavior is correct.

---

### WR-03: `computeFragility` called twice for the same row in `GemTable` expand section

**File:** `src/components/gem-table/GemTable.tsx:362-364` and `383-385`

**Issue:** When a row is expanded, `GemTable` renders two `<tr>` elements — one visible on mobile (`sm:hidden`) and one on desktop (`hidden sm:table-row`). Each independently calls `computeFragility(row.original, false)`. Since `computeFragility` is a pure function, this produces no incorrect behavior, but it runs the calculation twice per expanded row. More importantly, the JSX pattern uses an IIFE (`(() => { ... })()`) in each branch — if the calculation grows more expensive or the component needs to share the result (e.g., for an accessibility attribute), having two separate call sites will diverge.

**Fix:** Hoist the computation above the two-row fragment so both branches share a single result:
```tsx
{row.getIsExpanded() && (() => {
  const rejection = computeRejection(row.original, scoredPlayers)
  const posCodeLabel = POSITION_CODES_LABEL[row.original.element_type] ?? '??'
  const fragility = computeFragility(row.original, false)  // hoist here
  return (
    <>
      <tr className="bg-blue-50 dark:bg-blue-950 sm:hidden">
        <td ...>
          ...
          {fragility.tier !== 'robust' && <FragilityBadge tier={fragility.tier} reasons={fragility.reasons} />}
        </td>
      </tr>
      <tr className="bg-blue-50 dark:bg-blue-950 hidden sm:table-row">
        <td ...>
          ...
          {fragility.tier !== 'robust' && <FragilityBadge tier={fragility.tier} reasons={fragility.reasons} />}
        </td>
      </tr>
    </>
  )
})()}
```

---

## Info

### IN-01: `FragilityBadge` missing accessible label on the warning icon

**File:** `src/components/shared/FragilityBadge.tsx:28`

**Issue:**
```tsx
<span aria-hidden="true">⚠ </span>
{`no longer recommended if: ${reasons.join(', ')}`}
```

The `aria-hidden="true"` on the icon is correct. However, the surrounding `<div>` has no `role` or accessible name to announce its nature to screen readers. The text content starts mid-sentence ("no longer recommended if: ...") without a heading or label identifying this as a fragility warning. A screen reader user who encounters this badge in a captain picks list or a table expand section gets the text content but no contextual label to distinguish it from rejection reasons or news sections.

**Fix:** Add a visually-hidden label or group role:
```tsx
<div
  className={TIER_CLASSES[tier]}
  data-testid="fragility-badge"
  role="note"
  aria-label={`Fragility warning: ${reasons.join(', ')}`}
>
  <span aria-hidden="true">⚠ </span>
  {`no longer recommended if: ${reasons.join(', ')}`}
</div>
```

---

### IN-02: `PERTURB_NEWS_DOUBT` constant value is unused

**File:** `src/lib/sensitivity.ts:37`

**Issue:**
```ts
export const PERTURB_NEWS_DOUBT = 50     // simulated chance_of_playing_next_round value
```

`PERTURB_NEWS_DOUBT` is exported but never referenced in the perturbation (e) logic. The constant is declared with the intended simulated value (50), but the comparison on line 102 uses `NEWS_DOUBT_CEILING = 50` (the internal threshold) directly. The perturbation logic compares the player's **current** `chance_of_playing_next_round` against the ceiling, not the simulated value. The export suggests it was intended to be used in the reversal check (e.g., `computeNewsSeverity(PERTURB_NEWS_DOUBT, player.news) === 'red'` as mentioned in D-05), but it was never wired in.

This is not a correctness bug — the current check `currentChance > NEWS_DOUBT_CEILING` correctly implements D-05's intent. But the exported dead constant is misleading: it implies the perturbation checks the **simulated doubt level** (50) rather than the **current level** (which is what the code actually does).

**Fix:** Either use the constant in the check to make intent explicit:
```ts
// Direct comparison: simulates flipping to PERTURB_NEWS_DOUBT and checks if that crosses the ceiling.
// currentChance > NEWS_DOUBT_CEILING means current is already above 50, so simulating 50 is a downgrade.
if (currentChance > PERTURB_NEWS_DOUBT) {
  reasons.push(FRAGILITY_NEWS_DOUBT)
}
```
(This replaces `NEWS_DOUBT_CEILING` with `PERTURB_NEWS_DOUBT` since both equal 50 — but using `PERTURB_NEWS_DOUBT` is semantically correct: "skip if already at or below the perturbed value")

Or remove `PERTURB_NEWS_DOUBT` from exports if `NEWS_DOUBT_CEILING` is considered sufficient.

---

_Reviewed: 2026-05-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
