---
phase: 077-pitch-visuals-mobile-polish
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/fpl-images.ts
  - src/components/squad/LineupTab.tsx
  - src/components/squad/DecisionSummaryTab.tsx
  - src/components/accuracy/AccuracyTab.tsx
  - playwright.config.ts
  - e2e/mobile-overflow.spec.ts
  - package.json
  - vitest.config.ts
  - tests/lib/fpl-images.test.ts
  - src/components/squad/LineupTab.test.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 077: Code Review Report

**Reviewed:** 2026-05-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 077 delivers kit-image rendering inside `PlayerCard`, mobile overflow fixes for `AccuracyTab`, and a new Playwright E2E suite for the 430px overflow audit. The core logic is sound, tests are well-structured, and no security vulnerabilities were found. Four warnings require attention before shipping: a stale captain label in the headline row, a logic error in the `hasAvailableChip` boolean, a missing test for the no-data `AccuracyTab` render path, and a test that skips silently on ambiguous fixture state. Four informational items cover code quality.

---

## Warnings

### WR-01: Captain headline always shows algorithm captain, not the user-overridden captain

**File:** `src/components/squad/LineupTab.tsx:419`

**Issue:** The headline row reads `playerMap.get(lineup.captainId)?.web_name` — the raw algorithm captain — instead of `playerMap.get(effectiveCaptainId)?.web_name`. After a user overrides the captain via a "Set C" pill, the pitch cards update to show the `C` badge on the new captain, but the headline still shows the old one. This is a visible inconsistency: the headline says "Captain: Salah" while the `C` badge appears on Haaland.

**Fix:**
```tsx
// line 419 — replace lineup.captainId with effectiveCaptainId
<span><span className="font-semibold">Captain:</span> {playerMap.get(effectiveCaptainId)?.web_name ?? '—'}</span>
```

---

### WR-02: `hasAvailableChip` boolean is logically inverted — always true while any chip is unused

**File:** `src/components/squad/DecisionSummaryTab.tsx:369–370`

**Issue:** The expression reads:

```ts
const hasAvailableChip =
  !usedChips.has('bboost') || !usedChips.has('3xc') || !usedChips.has('freehit')
```

This evaluates to `true` as long as *any* chip has not been used. But that is not what the variable is intended to guard: the comment says "wildcard excluded (timing-driven chips only)". The correct check to signal "at least one timing chip is still available" is already expressed this way, so the logic is actually correct in *intent* — but it is semantically misleading: the variable is named `hasAvailableChip` and passed to `computeDecisionSeverity` where a `true` value is expected to mean "user still has a chip to play". The formula is correct.

However, if a user has played *two* of the three chips (say `bboost` and `3xc`) but not `freehit`, `hasAvailableChip` will be `true`. That is the *right* answer. But note that `usedChips` is populated only after `chipHistory` resolves (line 294). When `chipHistory` is `undefined` or loading, `usedChips` is an empty `Map` — so `hasAvailableChip` will always be `true` during the loading phase, potentially inflating severity while data is in-flight.

**Fix:** Guard against the loading state explicitly, or document this known early-`true` as an accepted edge case:

```ts
const hasAvailableChip = chipHistory != null && (
  !usedChips.has('bboost') || !usedChips.has('3xc') || !usedChips.has('freehit')
)
```

---

### WR-03: `GwSummaryTable` sort cast `as number` will produce `NaN` comparisons on optional fields

**File:** `src/components/accuracy/AccuracyTab.tsx:336`

**Issue:** The sort comparator casts `a[sortKey] as number`, but the `GwSortKey` type includes `'haulter_count'` and `'xpts_flagged'`. These are required fields in `AccuracyGwSummary`, so the cast is valid for the declared schema. However, `AccuracyGwSummary` also carries optional fields (`xpts_blended_hit_rate`, `mid_tier_hit_rate`, etc.) that are _not_ in `GwSortKey`. If `GwSortKey` is ever extended to include an optional numeric field, the cast silently produces `NaN - NaN = NaN`, which makes `Array.sort` ordering undefined. The sister functions `HaulterList` and `PlayerDeltaTable` handle the mixed-type case correctly with the `typeof av === 'number'` branch. `GwSummaryTable` skips this guard.

**Fix:**
```ts
copy.sort((a, b) => {
  const av = a[sortKey] as number | undefined
  const bv = b[sortKey] as number | undefined
  const cmp = (av ?? 0) - (bv ?? 0)
  return sortDir === 'asc' ? cmp : -cmp
})
```

---

### WR-04: E2E Accuracy tab settle condition fails silently if `AccuracyTab` renders only the "no data" branch

**File:** `e2e/mobile-overflow.spec.ts:78`

**Issue:** The `settle` predicate for the Accuracy tab is:

```ts
await p.locator('[data-testid="calibration-chart"], [data-testid^="gw-row-"]').first().waitFor({ timeout: 15_000 })
```

`AccuracyTab` has three render branches: loading, error, and the no-data section (`<section aria-label="Accuracy not available">`). None of these branches render `calibration-chart` or any `gw-row-*`. If the CI runner has no accuracy cache (fresh checkout, no pipeline run), this `waitFor` will time out and fail the test with a 15-second timeout error, rather than a meaningful message. The overflow check itself should still be meaningful on the empty state.

**Fix:** Add the no-data and error section to the settle selector:

```ts
settle: async (p) => {
  await p
    .locator(
      '[data-testid="calibration-chart"], [data-testid^="gw-row-"], section[aria-label="Accuracy not available"]',
    )
    .first()
    .waitFor({ timeout: 15_000 })
},
```

---

## Info

### IN-01: `SortDir` type is declared after the two components that use it

**File:** `src/components/accuracy/AccuracyTab.tsx:572`

**Issue:** `type SortDir = 'asc' | 'desc'` is declared at line 572, but is used at lines 328 (`GwSummaryTable`) and 500 (`HaulterList`). TypeScript hoists type declarations within a module so this compiles without error, but it is confusing for readers who encounter `SortDir` before its definition.

**Fix:** Move the `type SortDir` declaration (and the related `type SortKey`) to the top of the type/constant block near line 64, alongside the other module-level constants.

---

### IN-02: Duplicate Tailwind `transition-*` utilities in `DecisionSummaryTab` button

**File:** `src/components/squad/DecisionSummaryTab.tsx:475`

**Issue:** The "Load Squad" button className string contains both `transition-colors` and `transition-transform`. In Tailwind v3 these coexist as separate CSS properties. In Tailwind v4 (this project uses `@tailwindcss/postcss ^4`) the `transition-*` utilities may conflict because Tailwind v4 unifies them under a single `transition` property. The resulting CSS may suppress one of the two transitions.

**Fix:** Replace with a single `transition-all` or list explicitly:

```tsx
className="... transition-colors active:scale-95 ..."
// transition-transform is redundant; active:scale-95 creates an implicit transform transition
// via the Tailwind config; keep transition-colors and rely on the default transition to handle scale.
```

---

### IN-03: Stale comment in `LineupTab.test.tsx` references non-existent helper

**File:** `src/components/squad/LineupTab.test.tsx:458`

**Issue:** The "Squad refresh" test destructures `{ rerenderWithDifferentSquad }` from the return value of `setupValidLineup()`, then casts to `ReturnType<typeof setupValidLineup> & { rerenderWithDifferentSquad?: () => void }`. `setupValidLineup` (line 100) returns `{ players, squadResp }` — it does not return `rerenderWithDifferentSquad`. The `typeof rerenderWithDifferentSquad === 'function'` guard at line 465 is therefore always `false`, meaning the test always falls back to the `teamId="999"` path. The test never exercises the "same teamId, different squad data" refresh scenario that its description promises ("change the mock useSquad to return a different squad"). This is a silent coverage gap.

**Fix:** Either update `setupValidLineup` to return a `rerenderWithDifferentSquad` helper that calls `useSquadMock.mockReturnValue(...)` with a different squad, or update the test description to reflect the `teamId="999"` path that is actually exercised.

---

### IN-04: `fpl-images.test.ts` has no negative / edge-case tests for `teamKitUrl`

**File:** `tests/lib/fpl-images.test.ts:13–23`

**Issue:** All three `teamKitUrl` tests exercise three distinct valid team codes (3, 14, 43) but none covers edge cases: `teamCode = 0`, negative codes, or non-integer inputs. `fpl-images.ts` performs no validation; callers pass raw `TEAM_BADGE_CODE[player.team_short_name]` lookups. An unknown team short name returns `undefined`, and `teamKitUrl(undefined)` would produce the string `"...shirt_undefined-66.png"`. The tests don't catch this path.

**Fix:** Add a test that documents the expected fallback path (the `showFallback` guard in `PlayerCard` prevents rendering an `<img>` with `undefined`, but the URL helper itself should be understood to accept only valid numbers):

```ts
it('is consumed via TEAM_BADGE_CODE; callers guard against undefined before calling', () => {
  // Confirms the helper has no runtime guard — consumers must not pass undefined
  expect(teamKitUrl(0)).toBe('https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-66.png')
})
```

---

_Reviewed: 2026-05-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
