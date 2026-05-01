---
phase: 27-fdr-plus-plus-pipeline
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - pipeline/merge.py
  - src/lib/types.ts
  - src/lib/club-form.ts
  - tests/lib/club-form.test.ts
  - vitest.config.ts
  - src/components/club-form/EaseBar.tsx
  - src/components/club-form/AttDefToggle.tsx
  - src/components/club-form/FixtureEaseRankingPanel.tsx
  - tests/components/club-form/FixtureEaseRankingPanel.test.tsx
  - src/app/page.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase ships the FDR++ pipeline: a parallel `defensive_difficulty` metric (3-game goals-scored rolling window) alongside the existing `attacking_difficulty` (6-game xGA proxy), with per-team ease aggregates (`_ease_Ngw` fields) and a new `FixtureEaseRankingPanel` UI. The logic in the Python pipeline (`merge.py`) and the TypeScript computation (`club-form.ts`) are broadly consistent in algorithm design. No security or data-loss issues were found.

Three warnings were identified: a semantic mismatch between fixture-count slicing and GW-count labelling in DGW scenarios (affects all ease aggregate fields), a `NaN` safety gap in `EaseBar`, and a misleading `mins_risk` default that mislabels all players as 'injured' when `xmins_stats` is absent. Three informational items cover a redundant CSS transition utility, a redundant per-file environment directive in the test, and a confusingly named tier-threshold variable.

---

## Warnings

### WR-01: `meanEase` slices by fixture count, not gameweek count — DGW results are wrong

**File:** `src/lib/club-form.ts:8`
**Issue:** `meanEase` computes `fixtures.slice(0, n)` where `n` is the GW window (1, 3, or 5). For a team with a Double Gameweek (DGW), `teamUpcoming` stores individual fixtures ordered chronologically — `[GW30a, GW30b, GW31, GW32, GW33]`. `slice(0, 3)` therefore covers GWs 30 and 31 only (3 individual fixtures, but only 2 GWs). The fields `attacking_ease_3gw` and `attacking_ease_5gw` are labelled as GW-based windows but are calculated as fixture-count windows, so the values are wrong for any DGW team.

By contrast, the Python `_proj_pts_ngw` function explicitly groups by `event_id` before slicing `grouped[:n_gws]`, making it DGW-correct. The TypeScript logic does not.

**Fix:** Group upcoming fixtures by `event_id` before slicing:
```ts
function meanEase(
  fixtures: ClubFormFixture[],
  n: number,
  key: 'attacking_difficulty' | 'defensive_difficulty'
): number | null {
  // Group by event_id so DGW teams are counted by GW, not fixture count.
  const byEvent = new Map<number, ClubFormFixture[]>()
  for (const f of fixtures) {
    const group = byEvent.get(f.event_id) ?? []
    group.push(f)
    byEvent.set(f.event_id, group)
  }
  const events = [...byEvent.values()].slice(0, n) // first N GWs
  const allFixtures = events.flat()
  const present = allFixtures.filter(f => typeof f[key] === 'number')
  if (present.length === 0) return null
  const meanDifficulty = present.reduce((acc, f) => acc + (f[key] as number), 0) / present.length
  return 1 - meanDifficulty
}
```

---

### WR-02: `EaseBar` does not guard against `NaN` — renders invalid CSS

**File:** `src/components/club-form/EaseBar.tsx:25`
**Issue:** `Math.max(0, Math.min(1, ease))` returns `NaN` when `ease` is `NaN`, because `Math.min(1, NaN) === NaN` and `Math.max(0, NaN) === NaN`. If `NaN` reaches the component, `style={{ width: 'NaN%' }}` produces an invalid CSS value and the bar renders at zero width with no visible indication of the problem. While the caller (`FixtureEaseRankingPanel`) filters out `null` values, a `NaN` from a corrupted pipeline response would pass the `typeof t[key] === 'number'` guard (since `typeof NaN === 'number'`).

**Fix:**
```ts
export function EaseBar({ ease }: Props) {
  const safe = Number.isFinite(ease) ? ease : 0
  const clamped = Math.max(0, Math.min(1, safe))
  // ...
}
```

---

### WR-03: Absent `xmins_stats` causes all players to show `mins_risk = 'injured'`

**File:** `pipeline/merge.py:466`
**Issue:** When `xmins_stats` is `None` (or a player is absent from it), the fallback sets `player_mins_risk = 'injured'`. This is the wrong default — a player with no xmins data is not necessarily injured. Any consumer showing the `mins_risk` field without `xmins_stats` would display every player as injured, which is incorrect and misleading.

```python
else:
    player_xmins = 0.0
    player_start_prob = 0.0
    player_mins_risk = 'injured'   # <-- misleads callers when xmins_stats is None
```

**Fix:** Use a neutral sentinel that is actually defined in `MinsRisk`:
```python
else:
    player_xmins = 0.0
    player_start_prob = 0.0
    player_mins_risk = 'rotation_risk'  # or add 'unknown' to MinsRisk type
```
If the intent is "no data available", the correct fix is to add `'unknown'` to the `MinsRisk` union in `src/lib/types.ts` and use it here.

---

## Info

### IN-01: Duplicate `transition-*` utilities in `AttDefToggle` — only one takes effect

**File:** `src/components/club-form/AttDefToggle.tsx:20`
**Issue:** The button class list includes both `transition-colors` and `transition-transform`. In Tailwind CSS, each `transition-*` utility sets the `transition` CSS property to a specific subset of properties. When both are present the last one wins (Tailwind's class order is insertion-order). The `active:scale-95` transform animation will silently lose the colour transition, or vice versa, depending on Tailwind's output ordering.

**Fix:** Replace both with the catch-all `transition` utility:
```
transition cursor-pointer active:scale-95
```
(Same pattern already used correctly in `GwToggle.tsx`.)

---

### IN-02: Redundant per-file `@vitest-environment jsdom` directive

**File:** `tests/components/club-form/FixtureEaseRankingPanel.test.tsx:1`
**Issue:** `vitest.config.ts` already sets `environment: 'jsdom'` globally for the entire test suite. The `// @vitest-environment jsdom` comment at line 1 is therefore a no-op and adds noise.

**Fix:** Remove line 1 from the test file.

---

### IN-03: Misleadingly named tier-threshold variables in `club-form.ts`

**File:** `src/lib/club-form.ts:76-80`
**Issue:** `easyThreshScore` and `hardThreshScore` are named as if they are the score values for the easy/hard category boundaries, but their values are counter-intuitive because `diffScore` is the *inverse* of xGA normalisation (low score = easy fixture). The result is that `hardThreshScore` (≈0.67) is the *lower* boundary for hard, and `easyThreshScore` (≈0.33) is the *upper* boundary for easy. The logic is correct but the naming will mislead any future maintainer who reads `if (score >= hardThreshScore) return 'hard'` without tracing the full derivation.

**Fix:** Rename to express their role as boundary scores:
```ts
const easyUpperBound = ...   // scores at or below this are 'easy'
const hardLowerBound = ...   // scores at or above this are 'hard'
const tier = (score: number): DifficultyTier => {
  if (score >= hardLowerBound) return 'hard'
  if (score <= easyUpperBound) return 'easy'
  return 'medium'
}
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
