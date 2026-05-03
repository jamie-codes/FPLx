---
phase: 055-bench-order-optimiser
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/optimise-lineup.ts
  - src/lib/optimise-lineup.test.ts
  - src/components/optimiser/OptimiserPanel.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 055: Code Review Report

**Reviewed:** 2026-05-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 55 added `benchOrder()` as a pure function for EV/BGW/formation-aware bench ordering and integrated it into `optimiseLineup()`. The core logic of `benchOrder()` is sound: the EV formula is correct, the BGW partition is correct, and the formation-flex demotion heuristic is correct. One critical bug exists in the OPT-04 unit test — it silently validates the wrong behaviour because the `makeSquad()` helper defaults all players to `fixtures: []`, causing every bench outfield player to be routed through the BGW sort path. One warning-level issue exists in the production code itself: `benchOrder()` does not guard against `start_prob` being `undefined` (it is optional-adjacent in practice even though typed as required). A second warning covers `computeBenchBoostXPts` being called twice per render in the BB headline. One info item covers a doc/code mismatch in the module header comment.

---

## Critical Issues

### CR-01: OPT-04 "bench\[1..3\] ordered by horizon xPts" test silently validates the wrong code path

**File:** `src/lib/optimise-lineup.test.ts:186`

**Issue:** The `makeSquad()` factory defaults every player to `fixtures: []` (line 49). When `optimiseLineup()` calls `benchOrder()` for the three bench outfield players, `benchOrder()` sees `fixtures.length === 0` for all of them and routes all three into the `bgwSorted` array. The `bgwSorted` path sorts by `xPts_[horizon]` descending — which happens to produce the same order as the old naïve `horizonScore` sort, so the test assertion passes. The test therefore does **not** exercise the `active` EV path at all; it exercises the BGW fallback path and would still pass even if the active-EV sorting were completely broken. A regression in `evScore()` (e.g., the `start_prob` multiply being dropped) would leave OPT-04 green.

The test must give the bench outfield players at least one fixture so `benchOrder()` routes them through the `active` path, where the EV formula actually matters.

**Fix:**
```typescript
it('bench[1..3] are outfield players ordered by horizon xPts descending', () => {
  // Give each player a single fixture so benchOrder() uses the active (EV) path,
  // not the BGW fallback. All have identical start_prob so EV rank == xPts rank.
  const { picks, players } = makeSquad()
  const playersWithFixtures = players.map(p => ({
    ...p,
    fixtures: [{ opponent_team: 'TST', is_home: true, event_id: 30,
                 difficulty_score: 0.5, difficulty_tier: 'medium' as const }],
  }))
  const result = optimiseLineup(picks, playersWithFixtures, 1)
  expect(result).not.toBeNull()
  const playerMap = new Map(playersWithFixtures.map(p => [p.id, p]))
  const outfieldBench = result!.bench.slice(1)
  for (const id of outfieldBench) {
    expect(playerMap.get(id)!.element_type).not.toBe(1)
  }
  const scores = outfieldBench.map(id => playerMap.get(id)!.xPts_1gw ?? 0)
  for (let i = 1; i < scores.length; i++) {
    expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i])
  }
})
```

---

## Warnings

### WR-01: `benchOrder()` passes `start_prob` unguarded to multiplication — will produce `NaN` if the field is absent at runtime

**File:** `src/lib/optimise-lineup.ts:191`

**Issue:** `MergedPlayer.start_prob` is typed as `number` (non-optional) in `types.ts`, but the field is populated by the pipeline and the pipeline marks many player fields as "optional during pipeline rollout" (same convention as `xPts_1gw?`). Other callers in the codebase treat similar numeric fields with `?? 0` fallbacks defensively. In `benchOrder()`, `evScore` is:

```typescript
const evScore = (p: MergedPlayer): number =>
  p.start_prob * ((p[field] as number | undefined) ?? 0) * p.fixtures.length
```

If `start_prob` is `undefined` at runtime (stale or partial pipeline data), the multiplication produces `NaN`. A `NaN` EV score propagates silently into `sort()`, producing an unstable/undefined sort order. It does not crash, but the bench ordering becomes non-deterministic and the test suite will not catch it because `makePlayer()` always supplies `start_prob: 0.9`.

**Fix:**
```typescript
const evScore = (p: MergedPlayer): number =>
  (p.start_prob ?? 0) * ((p[field] as number | undefined) ?? 0) * p.fixtures.length
```

---

### WR-02: `computeBenchBoostXPts` called twice per render in the BB headline block

**File:** `src/components/optimiser/OptimiserPanel.tsx:467,477`

**Issue:** When `chipMode === 'bench-boost'`, the render body calls `computeBenchBoostXPts(lineup.bench, playersData, horizon)` at line 467 (for the "Bench xPts:" span) and again at line 477 (for the "Total:" span). The function is not memoised. If `computeBenchBoostXPts` is ever non-trivial (it iterates the bench array and maps through `playersData`), this is unnecessary duplicated work on every render cycle triggered by any state change (e.g. chipMode toggle, horizon toggle). More importantly, if the function had side effects or returned stochastic results, the two displayed values could diverge. The values are guaranteed consistent here only because the function is pure, but the pattern is fragile.

**Fix:** Extract the result into a local variable before the JSX block:
```typescript
// Inside the render, after the `lineup !== null` guard:
const bbBenchXPts = chipMode === 'bench-boost'
  ? computeBenchBoostXPts(lineup.bench, playersData, horizon)
  : 0

// Then in JSX:
<span className="font-semibold">Bench xPts:</span>{' '}
{bbBenchXPts.toFixed(1)}
// ...
Total: {(bbBenchXPts + startersXPts).toFixed(1)}
```

---

## Info

### IN-01: Module header comment still describes the old naïve bench sort

**File:** `src/lib/optimise-lineup.ts:32`

**Issue:** The JSDoc block for `optimiseLineup()` still reads:

> `bench[1..3] = remaining 3 outfield ordered by horizon xPts desc.`

This was the pre-Phase-55 behaviour. The actual post-Phase-55 behaviour is EV-ordered with BGW demotion and formation-flex demotion, as implemented in `benchOrder()`. The stale comment will mislead future readers about the ordering semantics.

**Fix:**
```typescript
 * Bench: bench[0] = non-starting GK; bench[1..3] = remaining 3 outfield ordered by
 * benchOrder() — EV (start_prob × xPts_horizon × fixtures.length) descending, BGW players
 * forced last, formation-invalid candidates demoted below formation-valid ones.
```

---

_Reviewed: 2026-05-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
