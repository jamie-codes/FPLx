---
phase: 064-sensitivity-analysis
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/sensitivity.ts
  - src/lib/__tests__/sensitivity.test.ts
  - src/components/shared/FragilityNote.tsx
  - src/components/shared/FragilityNote.test.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/components/captaincy/CaptainPicksPanel.tsx
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 064: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 64 sensitivity analysis implementation: `computeFragility` pure function, `FragilityNote` shared component, and integration into `TransferPanel` and `CaptainPicksPanel`. The core logic and its unit tests are consistent with the locked decisions in `064-CONTEXT.md`. No security vulnerabilities or data-loss risks were found.

Three substantive warnings are raised: a logic gap where `'hard'`-tier fixtures never trigger the fragility flag (despite being more dangerous than `'medium'` — which is the only tier checked), a missing accessible text node on `FragilityNote` (the warning is conveyed only via `aria-hidden` symbol and visual text, with no `role` or live region for screen readers), and a hit-condition comment mismatch that contradicts the spec's wording.

---

## Warnings

### WR-01: `'hard'` fixture tier silently passes the fragility check

**File:** `src/lib/sensitivity.ts:31`

**Issue:** The fixture fragility condition is `player.fixtures[0].difficulty_tier === 'medium'`. The `DifficultyTier` union is `'easy' | 'medium' | 'hard'`. A player whose next fixture is rated `'hard'` (the worst tier — attDiff >= 0.6 per `club-form.ts:62`) receives **no fragility warning at all** on the fixture dimension. This is a strictly harder scenario than a `'medium'` fixture and yet produces zero signal for the user. The intent in D-04 is "a medium fixture worsening to hard would likely reverse the recommendation", but the risk is not only about future worsening — a currently hard fixture means the recommendation may already be marginal on fixture quality. The transfer engine's gem-score ranking can produce a player with a hard fixture as the top suggestion (hard fixtures reduce xPts but may still rank above alternatives). When that happens, `computeFragility` silently returns `{ fragile: false, reasons: [] }` on the fixture dimension, giving users false confidence.

**Fix:** Include both medium and hard tiers, or at minimum flag hard fixtures independently with a distinct reason string (e.g. `'hard fixture'`):

```typescript
// Option A — flag both medium and hard
if (
  player.fixtures.length > 0 &&
  (player.fixtures[0].difficulty_tier === 'medium' ||
   player.fixtures[0].difficulty_tier === 'hard')
) {
  reasons.push('harder fixture')
}

// Option B — differentiate reason strings
if (player.fixtures.length > 0) {
  const tier = player.fixtures[0].difficulty_tier
  if (tier === 'medium') reasons.push('harder fixture')
  if (tier === 'hard')   reasons.push('tough fixture')
}
```

The companion test in `sensitivity.test.ts` also has no test case for `difficulty_tier: 'hard'` — adding one would surface the gap. The current test suite only covers `'easy'` and `'medium'`.

---

### WR-02: `FragilityNote` conveys warning only visually — no accessible text role

**File:** `src/components/shared/FragilityNote.tsx:11-21`

**Issue:** The outer `<div>` carries no `role` or `aria-live` attribute. The `⚠` symbol is `aria-hidden="true"`, which is correct, but the surrounding text node ("no longer recommended if: …") is contained in a plain `<div>` with no semantic role. Screen readers will read the text when the element is encountered in document order, but because these notes are conditionally rendered inside dynamic `map()` output after squad load, they will not be announced to AT users who are already past that section in the reading order. Comparable live-region patterns exist elsewhere in the project (`DecisionSummaryTab.tsx:402` and `TransferPlanTable.tsx:61` both use `aria-live="polite"`).

**Fix:** Add `role="note"` (static indicator, always present when rendered) or `aria-live="polite"` (if dynamically inserted after initial load):

```tsx
<div
  role="note"
  className="text-xs text-amber-600 dark:text-amber-400"
  data-testid="fragility-note"
>
  <span aria-hidden="true">⚠ </span>
  {`no longer recommended if: ${reasons.join(', ')}`}
</div>
```

`role="note"` is the semantically appropriate landmark for supplementary information associated with a parent element. If live announcement on dynamic insert is required, use `aria-live="polite"` instead.

---

### WR-03: Hit-condition comment in `sensitivity.ts` contradicts the spec wording for the reason string

**File:** `src/lib/sensitivity.ts:7-8`

**Issue:** The header comment block reads:

```
//   - isTransfer && xPtsGain < 4.0               → 'taken as a hit (-4pt)'
```

But per `064-CONTEXT.md` D-11, the explanation text is `"no longer recommended if: taken as a hit (-4pt)"` — the prefix comes from `FragilityNote`, while the reasons array entry is only `'taken as a hit (-4pt)'`. The comment accurately reflects the reasons array value, so the comment itself is not wrong in isolation. However, the comment on line 8 reads:

```
//   - isTransfer && xPtsGain < 4.0               → 'taken as a hit (-4pt)'
```

and `xPtsGain !== undefined` is also required (line 37) — the comment omits the `!== undefined` guard. When `isTransfer` is true but `xPtsGain` is not passed (e.g. a future caller passes only two args), the condition silently does nothing rather than using a default. The comment implies the condition is purely `isTransfer && xPtsGain < 4.0`, which would mislead a future editor into thinking the guard is sufficient without the undefined check.

**Fix:** Update the comment to reflect the full condition:

```typescript
// D-09, D-10: hit cost — transfer candidates only; xPtsGain must be provided
if (isTransfer && xPtsGain !== undefined && xPtsGain < 4.0) {
```

Change the comment at line 8 to:

```
//   - isTransfer && xPtsGain !== undefined && xPtsGain < 4.0  → 'taken as a hit (-4pt)'
```

---

## Info

### IN-01: Inline IIFE pattern in JSX is repeated across two call sites

**File:** `src/components/transfers/TransferPanel.tsx:393-397`, `src/components/transfers/TransferPanel.tsx:459-463`, `src/components/captaincy/CaptainPicksPanel.tsx:153-156`

**Issue:** The fragility computation is wrapped in an IIFE (`(() => { … })()`) directly inside JSX at three call sites. This is unconventional in React — the pattern works correctly but reduces readability and prevents the computation from being tested or memoized independently. Inline IIFEs in JSX are not idiomatic React and will confuse future editors.

**Fix:** Extract to a small helper or perform the computation in a variable before the `return` statement. In `CandidateRow` and the transfer card `map` callback, a local `const`:

```tsx
// In TransferPanel map callback:
const xPtsGain = (s.buy.xPts_1gw ?? 0) - (s.sell.xPts_1gw ?? 0)
const fragilityResult = computeFragility(s.buy, true, xPtsGain)

// In JSX:
{fragilityResult.fragile && <FragilityNote reasons={fragilityResult.reasons} />}
```

This is a style issue — no runtime impact.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
