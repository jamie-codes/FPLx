---
phase: 062-mc-rank-simulator-captain-integration
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/app/api/gw-average/route.ts
  - src/app/page.tsx
  - src/components/captaincy/CaptainPicksPanel.tsx
  - src/components/planner/RankSimTab.tsx
  - src/lib/hooks/useEntryRank.ts
  - src/lib/hooks/useGwAverage.ts
  - src/lib/mc-labels.ts
  - src/lib/rank-sim.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 062: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Eight files implementing the Monte Carlo rank simulator and captain-integration features were reviewed. The security posture for URL injection in `useEntryRank` is sound — the `^\d+$` guard is applied at both the `enabled` gate and inside the `queryFn`, preventing path traversal through the FPL proxy. The core normal-CDF math in `rank-sim.ts` matches the Abramowitz & Stegun 7.1.26 polynomial correctly and the variance doubling for the captain is mathematically sound.

Four warnings were found: a conflicting Next.js cache directive that silently disables the intended 30-minute TTL, a label/logic semantic inversion in `mc-labels.ts` (the "Lowest floor" label is assigned to the player with the highest floor), incorrect units in the `computeBeatTheAverageProb` call site (single-GW sigma compared against a single-GW threshold, inconsistent with the function's documented cumulative-only contract), and a silent failure when no captain is found in a non-null picks array.

---

## Warnings

### WR-01: Contradictory `dynamic` and `revalidate` directives — cache TTL silently dropped

**File:** `src/app/api/gw-average/route.ts:16-17`

**Issue:** `export const dynamic = 'force-dynamic'` opts the route out of static generation and **disables ISR entirely**. The immediately following `export const revalidate = 1800` is therefore a no-op — Next.js ignores `revalidate` when `dynamic` is `'force-dynamic'`. The intended 30-minute server-side cache is never applied. Every request hits the filesystem read loop unconditionally, which is harmless for correctness but means the comment "30-min Next.js cache TTL — matches /api/players policy" is incorrect. Downstream, `useGwAverage` sets `staleTime: 1000 * 60 * 30` expecting matching server-side revalidation; that expectation is unmet.

**Fix:** Remove `dynamic = 'force-dynamic'` and rely solely on `revalidate = 1800`. ISR with revalidation already re-runs the route handler on cache miss; `force-dynamic` is unnecessary here and actively undermines the policy.

```ts
// Remove this line:
// export const dynamic = 'force-dynamic'

export const revalidate = 1800  // 30-min ISR — matches /api/players policy
```

If truly every request must re-read the filesystem (e.g. because pipeline output changes within the revalidation window), then remove `revalidate` and accept that the cache comment was aspirational, but document this clearly.

---

### WR-02: "Lowest floor" label logic is inverted — picks the highest floor, not the lowest

**File:** `src/lib/mc-labels.ts:61-68`

**Issue:** The comment on line 61 says "Lowest floor — highest p10_pts (most reliable minimum, per D-16)". The label emitted is `'Lowest floor'` but the winner is the player with the **highest** `p10_pts`. These are antonyms. The label and its tooltip will tell the user this player has the "Lowest floor" when they actually have the best (highest) floor among the remaining candidates.

The intent from the comment is "the player most reliable for a minimum score", which is the **highest** floor. The label should say "Best floor" or "Highest floor" to match what the code computes, or the reduce should find `min` p10_pts and the label stays "Lowest floor".

```ts
// Current (line 64):
(best, c) => (c.p10_pts ?? -Infinity) > (best?.p10_pts ?? -Infinity) ? c : best,

// Option A: fix the label (keep existing logic — picks highest floor):
label: 'Best floor',      // was: 'Lowest floor'
value: `${(floorWinner.p10_pts ?? 0).toFixed(1)} pts`,

// Option B: fix the logic to match the label (find the lowest floor):
(best, c) => (c.p10_pts ?? Infinity) < (best?.p10_pts ?? Infinity) ? c : best,
```

Option A is almost certainly the intent given the D-16 description "most reliable minimum".

---

### WR-03: `computeBeatTheAverageProb` called with per-GW σ, not cumulative σ — violates function contract

**File:** `src/components/planner/RankSimTab.tsx:162-163`

**Issue:** The `computeBeatTheAverageProb` JSDoc states its contract explicitly:

> `P(rank gain) = computeBeatTheAverageProb(cumMean, cumSigma, gwAverage × gwsAhead)`

The call site passes `gwMean` and `gwSigma` — the **per-GW** values from `computeXIPerGwStats` — not the cumulative values. It also passes `gwAvgData.average_score` as the threshold (a single-GW average, not `gwAverage × N`).

In this specific call the two errors cancel out (both sides are GW+1 quantities), making the result numerically correct for N=1. However the function's documented interface is cumulative, and future callers relying on the docstring who pass N>1 quantities as `cumMean`/`cumSigma` would get a correct result, while a caller who uses the code's *example* as a template and passes N=1 values thinking they are cumulative would break silently. The inconsistency also makes it impossible for a reader to verify correctness without tracing the call chain.

**Fix:** Either call the function with explicitly cumulative values for GW+1 (multiply by `Math.sqrt(1)` = no-op but documents intent), or update the function signature/docstring to offer a per-GW overload:

```ts
// Option A: make GW+1 intent explicit at the call site
const pGain = computeBeatTheAverageProb(
  gwMean * 1,          // cumMean for N=1
  gwSigma * Math.sqrt(1),  // cumSigma for N=1
  gwAvgData.average_score * 1,  // threshold for N=1
)

// Option B: add a simpler per-GW helper that wraps the function:
// computeBeatTheAverageProb(gwMean, gwSigma, threshold)
// with docstring noting N=1 use case explicitly
```

---

### WR-04: Silent no-captain fallback when non-null picks array has no captain pick

**File:** `src/components/planner/RankSimTab.tsx:108-111`

**Issue:** `captainId` defaults to `-1` when `picks.find(p => p.is_captain)` returns `undefined`. If the API returns picks with no entry where `is_captain === true` (e.g. mid-season API inconsistency, or a picks array from `useSquad` (the unauthenticated fallback) that lacks captain data), `captainId` will be `-1` and no player in the XI will receive the captain doubling. The `computeXIPerGwStats` function silently omits the captain bonus, producing a trajectory that under-projects the mean by one captain's xPts without any user-visible indication.

The unauthenticated `useSquad` path (`squadData`) is explicitly used as a fallback on line 88: `picks = myTeamData?.picks ?? squadData?.picks`. The `SquadPick` type from `useSquad` must be checked to confirm it carries `is_captain`.

**Fix:** Add a guard and surface the missing-captain state:

```ts
const captainId = useMemo<number>(() => {
  if (!picks) return -1
  const cap = picks.find(p => p.is_captain)
  if (!cap && process.env.NODE_ENV !== 'production') {
    console.warn('[RankSimTab] No captain found in picks — trajectory will undercount by 1× captain xPts')
  }
  return cap?.element ?? -1
}, [picks])
```

Or, more robustly, fall back to the highest-xPts player in the XI as an implicit captain (matching the alt-captain logic already present in `altInfo` computation at line 132–141).

---

## Info

### IN-01: Hardcoded `SETTLED_GWS_PLACEHOLDER` in `page.tsx`

**File:** `src/app/page.tsx:43`

**Issue:** `SETTLED_GWS_PLACEHOLDER = [33, 34, 35]` is hardcoded. The comment acknowledges this is a placeholder but does not flag it as a maintenance hazard. After GW 36+ this value will be stale and `GwReviewTab` will request non-existent cache files. The comment says "A future enhancement may derive this list from a new `useSettledGws` hook" — that future date has not come.

**Fix:** At minimum add a `TODO` comment with the ticket/phase reference so it surfaces in codebase searches for planned work. At best, derive dynamically from `bootstrap.events` (the "deferred" enhancement the comment already describes).

---

### IN-02: `revalidate = 1800` and `staleTime: 1000 * 60 * 30` magic numbers not tied to a shared constant

**File:** `src/app/api/gw-average/route.ts:17`, `src/lib/hooks/useGwAverage.ts:24`

**Issue:** The 30-minute TTL is expressed as two separate literals (`1800` seconds in the route and `1000 * 60 * 30` ms in the hook). If one is changed without the other the cache-consistency claim breaks silently.

**Fix:** Both values cannot share a single import across a server/client boundary easily, but add a co-located comment referencing the counterpart file so changes stay in sync:

```ts
// route.ts
export const revalidate = 1800  // 30 min — keep in sync with useGwAverage staleTime

// useGwAverage.ts
staleTime: 1000 * 60 * 30,  // 30 min — keep in sync with /api/gw-average revalidate
```

---

### IN-03: `TooltipContentProps` type assertion works around Recharts v3 type gap

**File:** `src/components/planner/RankSimTab.tsx:52`

**Issue:** The `CustomTooltip` component casts `payload` as `unknown as Array<{...}>` to work around a type gap in Recharts v3's `TooltipContentProps`. This is a known Recharts issue and the workaround is acceptable, but the double-cast pattern (`as unknown as T`) masks any future type changes in Recharts that would otherwise produce a compile-time error.

**Fix:** Add a comment documenting that this is a Recharts v3 type gap and link to the upstream issue, so the cast is not silently retained if Recharts eventually fixes the type:

```ts
// Recharts v3: TooltipContentProps.payload is typed as unknown[] — cast needed.
// Remove cast if https://github.com/recharts/recharts/issues/XXXX is resolved.
```

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
