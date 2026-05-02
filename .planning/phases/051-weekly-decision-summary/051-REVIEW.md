---
phase: 051-weekly-decision-summary
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/app/page.test.tsx
  - src/app/page.tsx
  - src/components/nav/MobileNav.test.tsx
  - src/components/squad/DecisionSummaryTab.tsx
  - src/lib/__tests__/decision-severity.test.ts
  - src/lib/decision-severity.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 051: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files covering the Weekly Decision Summary tab were reviewed: the root page component and its test, MobileNav and its test, `DecisionSummaryTab`, and `decision-severity.ts` with its unit test suite.

The logic in `decision-severity.ts` is clean and well-tested. The `computeDecisionSeverity` tests are thorough — all boundary conditions for captain, transfer/risk, and chip severity are covered. The `DecisionSummaryTab` component wires the data pipeline correctly and the `riskRows` urgency-sort is sound.

Four warnings were found: a Tailwind duplicate-transition class that silently kills the hover animation on the Load Squad button, a `captain` severity that can never be `LOW` (always at least `MEDIUM`, misleading when no data is present), a stale test description in `MobileNav.test.tsx` that claims 4 Analyse pills when there are now 5, and an incomplete test assertion that lets the new `Acc` pill go completely untested. Three info-level items are noted below.

No critical (data loss, security, crash) issues were found.

---

## Warnings

### WR-01: Duplicate Tailwind transition utility silently drops hover-color animation

**File:** `src/components/squad/DecisionSummaryTab.tsx:418`

**Issue:** The "Load Squad" submit button has both `transition-colors` and `transition-transform` in its `className`. In Tailwind v3 both utilities expand to the same CSS property (`transition-property`, `transition-duration`, `transition-timing-function`). The last declaration in the generated stylesheet wins — `transition-transform` overrides `transition-colors`, so the hover background-colour transition (`hover:bg-zinc-700`) does not animate. The `active:scale-95` animation works, but the colour change is instant instead of smooth.

**Fix:** Remove `transition-colors`; keep `transition-transform` — or use `transition-all` if both animations are desired:

```tsx
// Before
className="... hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors cursor-pointer active:scale-95 transition-transform ..."

// After — keep one
className="... hover:bg-zinc-700 dark:hover:bg-zinc-200 cursor-pointer active:scale-95 transition-transform ..."

// Or to animate both colour and scale
className="... hover:bg-zinc-700 dark:hover:bg-zinc-200 cursor-pointer active:scale-95 transition-all ..."
```

---

### WR-02: `captain` severity is incapable of returning `LOW` — misleading badge when no data

**File:** `src/lib/decision-severity.ts:47`

**Issue:** The captain severity rule is `top2 > 0 && top1 >= 2 * top2 ? 'HIGH' : 'MEDIUM'`. When candidates is empty (no squad loaded, players still loading, or network error cleared), `top1` and `top2` are both `0`, so `top2 > 0` is false and the result is `MEDIUM`. The Captain card in `DecisionSummaryTab` therefore shows a yellow `MEDIUM` badge even before the user has entered a team ID, implying medium urgency when there is in fact no information. `LOW` is a defined `SeverityLevel` value but is structurally unreachable for the captain dimension.

This is a design-level bug: a severity badge should not signal urgency in the absence of data.

**Fix:** Treat the no-candidates case as `LOW` (no information, no urgency):

```ts
// src/lib/decision-severity.ts
const top1 = args.candidates[0]?.projected_captain_pts ?? 0
const top2 = args.candidates[1]?.projected_captain_pts ?? 0
const captain: SeverityLevel =
  args.candidates.length < 2
    ? 'LOW'                             // not enough data to classify
    : top2 > 0 && top1 >= 2 * top2
      ? 'HIGH'
      : 'MEDIUM'
```

Note: Test 4 and Test 5 in `decision-severity.test.ts` would need updating — they currently assert `MEDIUM` for empty/single-candidate cases. Their descriptions acknowledge the current behaviour ("never HIGH") but do not capture the semantic intent.

---

### WR-03: MobileNav `NAV-02` test description is stale — claims 4 Analyse pills, there are now 5

**File:** `src/components/nav/MobileNav.test.tsx:40`

**Issue:** The test title reads "renders **4** pills with mobile labels Gems/Insights/DefCon/SP in order". The `analyse` section in `SECTIONS` (page.tsx lines 33–38) has five sub-tabs: `gems`, `insights`, `defcon`, `set-pieces`, and `accuracy`. The MobileNav will render five pills when `activeSection === 'analyse'`. The test filter on four strings passes without error, but the description is actively wrong and will mislead future developers about the expected pill count.

**Fix:** Update the test description and assertion to reflect all five pills including the new `Acc` pill (see also WR-04):

```tsx
it('Analyse active: renders 5 pills with mobile labels Gems/Insights/DefCon/SP/Acc in order (NAV-02)', () => {
  ...
  const pillButtons = allButtons.filter(b =>
    ['Gems', 'Insights', 'DefCon', 'SP', 'Acc'].includes(b.textContent ?? '')
  )
  expect(pillButtons).toHaveLength(5)
  expect(pillButtons[4].textContent).toBe('Acc')
})
```

---

### WR-04: `Acc` pill presence and click-callback never tested in MobileNav tests

**File:** `src/components/nav/MobileNav.test.tsx:40–48` and `src/components/nav/MobileNav.test.tsx:101–114`

**Issue:** The `accuracy` sub-tab (`mobileLabel: 'Acc'`) was added to the Analyse section (page.tsx line 37) but neither the pill-order test (NAV-02, line 40) nor the click-callback test (NAV-05, line 101) includes `Acc`/`accuracy`. The click-callback test asserts four interactions — Gems/Insights/DefCon/SP — and the `accuracy` pill is entirely absent. If the 5th pill's `onClick` were wired incorrectly, no test would catch it.

**Fix:** Extend both tests to include the 5th pill:

```tsx
// In the pill-order test: add 'Acc' to the filter and assert pillButtons[4].textContent === 'Acc'

// In the click-callback test (NAV-05):
const pillButtons = allButtons.filter(b =>
  ['Gems', 'Insights', 'DefCon', 'SP', 'Acc'].includes(b.textContent ?? '')
)
fireEvent.click(pillButtons[4])
expect(onSubTabChange).toHaveBeenCalledWith('accuracy')
```

---

## Info

### IN-01: Misaligned indentation on conditional block in DecisionSummaryTab JSX

**File:** `src/components/squad/DecisionSummaryTab.tsx:424–428`

**Issue:** The `{isAuthenticated && ( ... )}` block has inconsistent indentation — the opening `{isAuthenticated` starts at 10 spaces while the surrounding form and closing `</div>` are at 8 spaces. The closing `)}` is back at 8 spaces. This is cosmetically inconsistent with the rest of the component and suggests a copy-paste that was not cleaned up.

**Fix:** Normalise to 8-space indentation to match the containing `<div>`:

```tsx
        {isAuthenticated && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            FPL account connected — exact sell prices will be used.
          </p>
        )}
```

---

### IN-02: `decision-severity.ts` header comment omits that `captain` can never be `LOW`

**File:** `src/lib/decision-severity.ts:7`

**Issue:** The header comment documents: "Captain: HIGH when top1 >= 2*top2 (with top2 > 0 guard); else MEDIUM." The omission of `LOW` is deliberate per current design but is undocumented. Anyone reading this file would reasonably expect `LOW` to be reachable for all four dimensions since `SeverityLevel` includes it. The asymmetry is a latent maintenance hazard (see WR-02 for the broader argument).

**Fix:** Explicitly note that `LOW` is not reachable for captain in the comment, or address the design gap as described in WR-02:

```ts
//   - Captain: HIGH when top1 >= 2*top2 (with top2 > 0 guard); MEDIUM otherwise (LOW never emitted).
```

---

### IN-03: `page.test.tsx` mock for `AccuracyTab` is absent — coverage gap

**File:** `src/app/page.test.tsx:1–34`

**Issue:** The `page.test.tsx` file mocks every component imported by `page.tsx` except `AccuracyTab`. If `AccuracyTab` makes any network call or uses a hook that requires a provider, the test suite will either fail or emit unhandled promise rejection warnings. The `accuracy` sub-tab is also never exercised by any test in `page.test.tsx`.

**Fix:** Add a mock and a test that navigates to the Accuracy sub-tab:

```tsx
vi.mock('@/components/accuracy/AccuracyTab', () => ({ AccuracyTab: () => <div data-testid="accuracy-tab" /> }))
```

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
