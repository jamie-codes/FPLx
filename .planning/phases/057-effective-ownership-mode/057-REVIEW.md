---
phase: 057-effective-ownership-mode
reviewed: 2026-05-03T19:42:21Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/page.tsx
  - src/components/captaincy/CaptainPicksPanel.test.tsx
  - src/components/captaincy/CaptainPicksPanel.tsx
  - src/lib/eo-candidates.test.ts
  - src/lib/eo-candidates.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 057: Code Review Report

**Reviewed:** 2026-05-03T19:42:21Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files reviewed: the EO candidates pure function (`eo-candidates.ts`), its unit tests, the `CaptainPicksPanel` component and its RTL tests, and the root `page.tsx` which mounts the panel.

The core sort engine is well-structured and the test coverage is thorough. However, there are four warnings that affect correctness or robustness: a semantic contract contradiction between the panel description and the implementation's median filter, a missing eligibility gate for `chase_rank` (players without `xPts_90th_1gw` silently appear ranked at 0), an unguarded `parseFloat`/`Math.round` on a pipeline string field, and a misleading test description. Two informational issues round out the review.

## Warnings

### WR-01: `differential_aggressive` uses `>= median` but panel copy says "above-median xPts only"

**File:** `src/lib/eo-candidates.ts:61`

**Issue:** The eligibility filter in `differential_aggressive` mode is:

```ts
.filter(p => (p.xPts_1gw ?? 0) >= median)
```

The `>=` operator includes players whose `xPts_1gw` equals the median exactly. But the panel description (rendered to the user) at `CaptainPicksPanel.tsx:178` reads _"Differential filters to above-median xPts only"_, and the test at `eo-candidates.test.ts:133` describes the behaviour as "filters to xPts_1gw >= median". The test matches the code; the user-visible description does not.

With an odd-count eligible pool the median is the exact middle value, so the "at-median" player will appear in the differential list even though the UI claims to show only _above_-median players. This is a user-facing correctness contradiction.

**Fix:** Either change the filter to strict `>` to match the displayed copy:

```ts
.filter(p => (p.xPts_1gw ?? 0) > median)
```

Or update the panel description to "above or equal to median xPts". Choose whichever behaviour is intended; the other artifact must be updated to match.

---

### WR-02: `chase_rank` mode does not exclude players with missing `xPts_90th_1gw`

**File:** `src/lib/eo-candidates.ts:41-45`

**Issue:** `xPts_90th_1gw` is typed `optional` on `MergedPlayer` (types.ts line 174). The eligibility filter only checks `xPts_1gw`. In `chase_rank`, any eligible player whose `xPts_90th_1gw` is absent will receive an implicit score of `0` via the `?? 0` fallback, causing them to sink to the bottom of the ranking. If many players lack this field (e.g. early in a pipeline rollout where the ceiling hasn't been computed yet), the top-5 results could be dominated by players with `undefined` ceiling rather than the players with the highest actual ceiling.

The existing modes treat their sort key as the definitive signal, so a missing key should exclude the player from that mode's results — not silently floor their score.

**Fix:**

```ts
if (mode === 'chase_rank') {
  return eligible
    .filter(p => p.xPts_90th_1gw != null)   // add this guard
    .slice()
    .sort((a, b) => (b.xPts_90th_1gw ?? 0) - (a.xPts_90th_1gw ?? 0))
    .slice(0, topN)
}
```

---

### WR-03: `parseFloat(candidate.selected_by_percent)` is unguarded — can render `NaN%`

**File:** `src/components/captaincy/CaptainPicksPanel.tsx:83`

**Issue:** `selected_by_percent` is typed as `string` on `MergedPlayer`. `parseFloat` returns `NaN` when the string is empty, `'N/A'`, or otherwise non-numeric. `Math.round(NaN)` also returns `NaN`, and the rendered text becomes `~NaN%`. The same raw string is parsed again at line 88 for the dangerous-to-fade badge threshold comparison: `parseFloat(...) > 30` — `NaN > 30` evaluates to `false`, so the badge is suppressed silently, which is less bad but still wrong.

The pipeline schema (`selected_by_percent: string` in `FPLElement`, line 14 of types.ts) provides no runtime guarantee of a numeric string at this component boundary.

**Fix:** Add a fallback:

```ts
const rawEo = parseFloat(candidate.selected_by_percent)
const eoPercent = Number.isFinite(rawEo) ? Math.round(rawEo) : 0

// and for the badge condition:
const eoValue = Number.isFinite(rawEo) ? rawEo : 0
const showDangerBadge =
  mode === 'protect_rank' &&
  isAuthenticated &&
  myTeamPickIds.size > 0 &&
  eoValue > 30 &&
  !myTeamPickIds.has(candidate.id)
```

---

### WR-04: Test description contradicts the assertion — misleading regression label

**File:** `src/lib/eo-candidates.test.ts:172`

**Issue:** The `it` description reads _"returns empty array when no players pass median filter"_ but the test body and inline comment explicitly assert `toHaveLength(1)`:

```ts
it('returns empty array when no players pass median filter', () => {
  // Single eligible player with xPts_1gw=5; median=5; filter >=5 admits it; length 1
  ...
  expect(result).toHaveLength(1)
})
```

The assertion is logically correct for the current `>=` filter (a single player at exactly the median is included). The description is wrong. Anyone relying on the description when diagnosing a future regression will be misled.

**Fix:** Rename the test to match the actual assertion:

```ts
it('single player at exactly the median is included (>= filter, not strict >)', () => {
```

---

## Info

### IN-01: Non-null assertion on `SECTIONS.find()` is technically unsafe

**File:** `src/app/page.tsx:156`

**Issue:** `SECTIONS.find(s => s.id === activeSection)!` uses a non-null assertion. TypeScript cannot narrow `find()` to non-undefined here because it doesn't model exhaustiveness of `Section` against the `SECTIONS` constant. In practice this can never be `undefined` because `activeSection` is always set to a value present in `SECTIONS`. However if `SECTIONS` or the `Section` type is ever extended out-of-sync, this assertion will cause a runtime `TypeError: Cannot read properties of undefined`.

**Fix:** Replace the assertion with a guard:

```ts
const activeSectionDef = SECTIONS.find(s => s.id === activeSection)
if (!activeSectionDef) return null
```

---

### IN-02: `captainData` from `useCaptainPicks` is fetched but its `ceiling`/`eo_adjusted` fields are entirely unused

**File:** `src/components/captaincy/CaptainPicksPanel.tsx:140`

**Issue:** `useCaptainPicks` returns a `CaptainPicks` object with `ceiling` and `eo_adjusted` fields (typed in `types.ts` lines 526-531). The panel only consumes `captainData?.gameweek` for the section heading. The hook is still invoked and will trigger a network fetch for `/api/captain-picks` on every panel mount, loading data that is never used.

Per the Phase 57 comment at line 3 (_"Replaces the prior 2-card Ceiling+EO-Adjusted panel"_), this is intentional architectural drift, but the hook call is now dead weight. It also introduces an unnecessary loading/error boundary concern that is silently ignored (`error` from `useCaptainPicks` is destructured but never checked).

**Fix:** Either remove the `useCaptainPicks` call entirely and source `gameweek` from `playersData` (if available) or from a lighter dedicated endpoint, or at minimum add a comment explaining why the hook is retained despite most of its payload being discarded. If the gameweek is needed purely for the heading, consider whether it can be obtained without a separate fetch.

---

_Reviewed: 2026-05-03T19:42:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
