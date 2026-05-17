---
phase: 118-engine-integration
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/hooks/useLineupNews.ts
  - src/lib/hooks/useLineupNews.test.ts
  - src/lib/suggest-transfers.ts
  - src/lib/suggest-transfers.test.ts
  - src/lib/optimise-lineup.ts
  - src/lib/optimise-lineup.test.ts
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 118: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files reviewed: two new engine hook files (`useLineupNews.ts`, `useLineupNews.test.ts`) and four existing engine files extended for Phase 118 (`suggest-transfers.ts`, `suggest-transfers.test.ts`, `optimise-lineup.ts`, `optimise-lineup.test.ts`).

The Phase 118 ENGN-01/ENGN-02 integration (availability factor for buy candidates; confirmed_absent exclusion from starters and bench) is logically coherent. The two critical findings concern a type-safety hole where a TypeScript-typed `null` passes through an `=== null` runtime guard silently in the `availFactor` function, and a data-loss edge case in `optimise-lineup.ts` where the bench GK lookup ignores the `lineupNewsMap` — confirmed-absent bench GKs are returned in position bench[0] rather than being demoted. Two warnings concern a missing boundary condition in `lineupNewsSelect` (the `undefined` error surface is widened by a broken `Date` parse) and a xPtsGain inconsistency in the combo path when the `lineupNewsMap` absent-floor raises the effective buy score above the `xPtsGain > 0` filter but the stored `xPtsGain` still reflects the penalised value. The info items are minor quality issues.

---

## Critical Issues

### CR-01: `availFactor` null guard is unreachable — `null` slips through and coerces to `0`

**File:** `src/lib/suggest-transfers.ts:122-124`

**Issue:** The function reads `lineupNewsMap.get(p.id)?.availability_factor ?? 1.0` and then checks `if (af === null) return 1.0`. The `??` operator already replaces `null` and `undefined` with `1.0`, so `af` can **never** be `null` inside the body. The guard on line 123 is dead.

The real hazard is the opposite direction: `LineupNewsPlayer.availability_factor` is typed as `1.0 | 0.75 | 0.5 | 0.25 | 0.0 | null`, and the intent (documented in the D-03 comment above) is that a `null` factor means "unknown → treat as 1.0 (no penalty)". Because `??` converts `null` → `1.0` before the guard is reached the intent is accidentally satisfied, but only by luck. If a developer later changes the expression to optional chaining without `??` (e.g. `lineupNewsMap.get(p.id)?.availability_factor`), `null` propagates to `Math.max(0.01, null)` which evaluates to `0.01` — applying the absent-player floor to every unknown-status player and silently corrupting all transfer suggestions.

**Fix:** Make the null-guard explicit and move it before `Math.max`, removing the accidental reliance on `??`:

```typescript
const availFactor = (p: MergedPlayer): number => {
  if (!lineupNewsMap) return 1.0
  const entry = lineupNewsMap.get(p.id)
  if (!entry) return 1.0
  if (entry.availability_factor === null) return 1.0   // unknown status → no penalty (D-03)
  return Math.max(0.01, entry.availability_factor)
}
```

---

### CR-02: `optimiseLineup` bench GK slot ignores `lineupNewsMap` — a confirmed-absent bench GK is returned as `bench[0]`

**File:** `src/lib/optimise-lineup.ts:136-151`

**Issue:** The `confirmed_absent` exclusion is applied to the `eligible` filter (line 52–61), which correctly prevents absent players from being selected as starters. However, the bench is built from `picks` that are **not** in `starterSet` (line 137):

```typescript
const benchPicks = picks
  .filter(pick => !starterSet.has(pick.element))
  .map(pick => playerMap.get(pick.element))
  .filter((p): p is MergedPlayer => p !== undefined)
```

If a player was excluded from `eligible` by the `confirmed_absent` check, they are not in starters, so they land in `benchPicks`. The bench GK is then selected from `benchPicks.find(p => p.element_type === GK)` at line 142 — no news-map check. If both GKs are in the squad and the non-starting GK is confirmed absent, that absent GK is returned as `bench[0]`.

This is a data-correctness bug: the returned lineup tells autosub to deploy a GK who cannot play.

**Fix:** Mirror the absent-exclusion in the bench GK selection:

```typescript
const benchGk = benchPicks.find(p =>
  p.element_type === GK &&
  lineupNewsMap?.get(p.id)?.status_label !== 'confirmed_absent'
)
```

Note: if the absent-exclusion causes there to be no valid bench GK (both GKs absent), the existing `if (!benchGk) return null` guard (line 151) already handles the fallback correctly — no further change required.

---

## Warnings

### WR-01: `lineupNewsSelect` does not guard against invalid `scraped_at` — `NaN` comparison silently widens the staleness window

**File:** `src/lib/hooks/useLineupNews.ts:7-8`

**Issue:** `new Date(data.scraped_at).getTime()` returns `NaN` when `scraped_at` is not a valid ISO string. `Date.now() - NaN` is `NaN`, and `NaN > 48 * 60 * 60 * 1000` is `false`, so the function returns the player Map as if the data were fresh. A malformed timestamp on the server-side artifact causes stale data to be served indefinitely without any signal to the engines.

The API route does not validate this field before reaching `lineupNewsSelect`, and the type is `string` (not a branded ISO type), so corrupt data can arrive.

**Fix:**

```typescript
export const lineupNewsSelect = (data: LineupNews): Map<number, LineupNewsPlayer> | undefined => {
  const ts = new Date(data.scraped_at).getTime()
  if (isNaN(ts)) return undefined  // malformed timestamp → treat as stale
  const ageMs = Date.now() - ts
  if (ageMs > 48 * 60 * 60 * 1000) return undefined
  return new Map(data.players.map(p => [p.id, p]))
}
```

---

### WR-02: `scoreBuyCandidate` / `sellScore` asymmetry causes `xPtsGain` to be inconsistent with what is stored in the suggestion

**File:** `src/lib/suggest-transfers.ts:172-174`

**Issue:** In the single-transfer enumeration:

```typescript
const sellScore = scorePlayer(sell)
for (const buy of pool) {
  const xPtsGain = scoreBuyCandidate(buy) - sellScore
```

`scoreBuyCandidate(buy)` applies the availability factor; `scorePlayer(sell)` does not. The stored `xPtsGain` therefore represents `(rawBuyScore × availFactor) - rawSellScore`, not a pure xPts delta. The comment on the `TransferSuggestion` type says `xPtsGain > 0` is an engine invariant; the UI renders this as expected points improvement. But the number actually mixes penalised-buy EV with unpenalised-sell EV, which is the intended design per D-04.

The real issue is that the `> 0` filter at line 175 compares the penalised buy score against the raw sell score. For a player with `availability_factor = 0.01` (confirmed absent, 0.01 floor), a very strong buy candidate (raw 8.0) scores `8.0 × 0.01 = 0.08`. If the squad player being sold scores, say, `5.0`, the gain is `0.08 - 5.0 = -4.92` → filtered out (correct). But for the in-pool sort (line 152), the same candidate also scores 0.08, so it ranks last and may be outside the top-30, meaning it never enters the pool at all. This is correct, but there is no test asserting that a confirmed-absent candidate with very high raw xPts is excluded from the in-pool top-30. The existing test "absent buy candidate appears at bottom" (line 696 of the test file) comments that the score is negative and the player "is filtered out or appears at bottom" — it does not assert the absent player is absent from results. If the absent player's raw score is just strong enough that after the 0.01 floor it still beats sell score (e.g. sell score is 0.01), the suggestion would appear with a near-zero `xPtsGain`. This is a fringe case but the test coverage gap leaves it untested.

**Fix:** Add an explicit test asserting that a confirmed-absent candidate with raw `xPts_1gw = 8.0` and all squad sellers at `5.0` (the default) produces **no** suggestion buying that candidate. The inline comment at line 719-721 suggests this is the expectation but the `if (absentSuggestion && healthySuggestion)` guard means the test passes vacuously if the suggestion is simply absent.

---

### WR-03: `optimise-lineup.ts` bench outfield ordering ignores confirmed-absent players in the BGW branch

**File:** `src/lib/optimise-lineup.ts:219-241`

**Issue:** `benchOrder` partitions bench outfield into `bgw` (fixtures.length === 0) and `active` (fixtures.length > 0). The `evScore` function at line 202–205 correctly zero-scores confirmed-absent active players (D-06), sinking them to last in the active group. However, a confirmed-absent player who also has no fixtures (e.g. a BGW where the player is also ruled out) ends up in the `bgw` array and is sorted by `horizon xPts desc` (line 235). If such a player has high xPts they will appear above other BGW players and above absent active players in the bench ordering, violating the stated invariant that `confirmed_absent` sorts to last regardless of xPts.

**Fix:** Apply the absent check before partitioning, not just inside `evScore`:

```typescript
const evScore = (p: MergedPlayer): number => {
  if (lineupNewsMap?.get(p.id)?.status_label === 'confirmed_absent') return 0
  return (p.start_prob ?? 0) * ((p[field] as number | undefined) ?? 0) * p.fixtures.length
}

// Partition: BGW (fixtures.length === 0) vs active — AFTER zeroing absent players.
const bgw: MergedPlayer[] = []
const active: MergedPlayer[] = []
for (const p of benchOutfield) {
  // Confirmed-absent players with no fixtures are also sunk to active-last via evScore=0.
  // Place them in active (not bgw) so the zero-EV sort keeps them below real BGW players.
  if (p.fixtures.length === 0 && lineupNewsMap?.get(p.id)?.status_label !== 'confirmed_absent') {
    bgw.push(p)
  } else {
    active.push(p)
  }
}
```

Alternatively, give the bgw sort a secondary confirmed-absent penalty consistent with `evScore`.

---

## Info

### IN-01: Stale-time comment is inaccurate — `useLineupNews` uses 6h stale-time but lineup news is scraped more frequently

**File:** `src/lib/hooks/useLineupNews.ts:20`

**Issue:** The comment reads `// 6 hours — D-07, matches useGWIntel/useSetPieces`. The staleness window in `lineupNewsSelect` is 48 hours, but the TanStack Query `staleTime` is 6 hours, meaning the cache will refetch every 6 hours even though data up to 48 hours old is accepted by the select. This is not a bug, but the comment is misleading: it implies the stale-time is a design choice derived from a domain requirement, when it is just a cache-refresh frequency setting. A reader unfamiliar with the 48h/6h two-tier design could misread this as defining the staleness boundary.

**Fix:** Clarify the comment:

```typescript
staleTime: 6 * 60 * 60 * 1000, // 6h refetch cadence; staleness gate (48h) lives in lineupNewsSelect
```

---

### IN-02: Redundant double-pass over `players` when invalid element_types are present

**File:** `src/lib/suggest-transfers.ts:100-108`

**Issue:** When `invalidPlayers.length > 0`, the code filters `players` twice: once to get `invalidPlayers`, and once to get `sanePlayers`. This is O(2n) when a single filter would do. Not a correctness issue, but the pattern is unnecessarily verbose.

**Fix:**

```typescript
const sanePlayers = players.filter(p => {
  const valid = VALID_ELEMENT_TYPES.has(p.element_type as number)
  if (!valid) invalidIds.push(p.id)
  return valid
})
if (invalidIds.length > 0) {
  console.warn(`[FIX-02] suggestTransfers: dropping ${invalidIds.length} player(s) with invalid element_type: ids=${invalidIds.join(',')}`)
}
```

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
