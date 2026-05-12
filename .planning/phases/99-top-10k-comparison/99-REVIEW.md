---
phase: 99-top-10k-comparison
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/api/gw-review/route.ts
  - src/app/api/gw-review/route.test.ts
  - src/components/squad/GwReviewTab.tsx
  - src/components/squad/GwReviewTab.test.tsx
  - src/lib/types.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 99: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed implementing Phase 99 PGW-03: the dream-team benchmark comparison and missed-players feature. The route-level logic and type definitions are structurally sound. Three issues warrant attention: a semantic inversion in the benchmark delta label that makes the UI misleading (and is confirmed by an inconsistent test assertion), a position-based filter in the route that relies on an FPL-documented but undocumented-in-code invariant that is fragile, and a missing input cap on `gw` that allows arbitrarily large integers to be interpolated into a filesystem path.

---

## Warnings

### WR-01: Benchmark delta label is semantically inverted — card says "+N vs you" when user beat the benchmark

**File:** `src/components/squad/GwReviewTab.tsx:174-176`

**Issue:** `benchmarkDiff` is computed as `your_score − benchmark_score`. When `benchmarkDiff > 0` the user outscored the dream team; the component labels this `+${benchmarkDiff} vs you`. Rendered on the benchmark card this means "the benchmark scored +N relative to you" — the opposite of what happened. A user who scored 72 with a dream-team total of 60 sees "+12 vs you" in green, which reads as the benchmark being +12 ahead of them. The amber/negative path (`−N vs you` when user lost) is correct in isolation, but the positive path is misleading.

The corresponding test at `GwReviewTab.test.tsx:181-185` asserts `card!.textContent.toMatch(/\+12 vs you/)` for `your_score=72, benchmark_score=60`, confirming the test was written to match the inverted label rather than catching it.

**Fix:** Invert the sign perspective so the sub-label reflects the **benchmark's** score gap relative to the user (consistent with what the card is about):

```tsx
// benchmarkDiff = your_score - benchmark_score
// When user beats benchmark (diff > 0): benchmark was behind → show "−N vs you" (amber)
// When user loses to benchmark (diff < 0): benchmark was ahead → show "+N vs you" (amber)
if (benchmarkDiff > 0) {
  benchmarkDeltaLabel = `−${benchmarkDiff} vs you`   // benchmark trailed you
  benchmarkSentimentClass = 'text-green-600 dark:text-green-400'
} else if (benchmarkDiff === 0) {
  benchmarkDeltaLabel = 'on par'
  benchmarkSentimentClass = 'text-green-600 dark:text-green-400'
} else {
  benchmarkDeltaLabel = `+${Math.abs(benchmarkDiff)} vs you`  // benchmark beat you
  benchmarkSentimentClass = 'text-amber-700 dark:text-amber-300'
}
```

Update the test assertions in `GwReviewTab.test.tsx` lines 181-195 to match.

---

### WR-02: `gw` query parameter is only validated as numeric — no upper-bound cap leaves the filesystem path construction open to unusually large values

**File:** `src/app/api/gw-review/route.ts:61-70`

**Issue:** The route validates `gw` matches `/^\d+$/` (numeric) but sets no upper bound. `Number(gwParam)` is then interpolated into a filename: `` `gw_review_gw${gw}.json` ``. An attacker (or misconfigured client) can pass `gw=999999999`, causing the server to attempt to read `pipeline/cache/gw_review_gw999999999.json`. While the path is not user-controlled beyond the number (path traversal is correctly blocked by the regex), the unbounded number results in unnecessary filesystem probing and ENOENT 404 responses for every value outside the valid season range (1-38 for a standard FPL season; 46 for Cup). A simple range check eliminates this:

```typescript
const gw = Number(gwParam)
if (!Number.isInteger(gw) || gw < 1 || gw > 50) {
  return Response.json({ error: 'Invalid gw parameter' }, { status: 400 })
}
```

This also makes the validation self-documenting and removes any risk from future changes to the filename template.

---

### WR-03: `picks.filter(p => p.position <= 11)` conflates FPL lineup slot with squad position — comment or assertion needed

**File:** `src/app/api/gw-review/route.ts:172`

**Issue:** The filter `picks.filter((p) => p.position <= 11)` relies on the FPL picks API returning `position` as the lineup slot (1..15, where 1-11 = starters, 12-15 = bench). This is a well-known FPL API convention, but the field name `position` in `FPLPick` is ambiguous — it also names the player's positional role (GK/DEF/MID/FWD = 1-4) in the bootstrap elements response. If a future refactor merges or renames these structs, or if the API contract changes, the silent wrong-filter bug will be hard to spot.

There is no validation that `picks` contains any entry with `position` outside 1-11 (which would confirm the interpretation). If the upstream ever changes its field name or semantics this code will silently classify all picks as starters and return incorrect results.

**Fix:** Add an inline comment tying the filter to the documented API contract, and add a defensive assertion:

```typescript
// FPL picks API: position = lineup slot 1-11 (starters) or 12-15 (bench).
// NOT the element_type (1=GK, 2=DEF, 3=MID, 4=FWD) from bootstrap.
const starters = picks.filter((p) => p.position >= 1 && p.position <= 11)
const benchPicks = picks.filter((p) => p.position >= 12 && p.position <= 15)
```

Adding the lower-bound `>= 1` and upper-bound `<= 15` to both filters makes the intent explicit and would catch any malformed picks payload at the cost of zero extra overhead.

---

## Info

### IN-01: `dreamTeamPayload` test helper discards its own `element` field when constructing `top_player`

**File:** `src/app/api/gw-review/route.test.ts:65-70`

**Issue:** The `dreamTeamPayload` helper sets `top_player.id` to `picks[0]?.element ?? 999`. The route ignores `top_player` entirely (it only uses `dtJson.team`), so this is inert today. However the helper is misleading — it implies a relationship between the first team entry and `top_player` that isn't always true (the top player need not be the first entry in the team array). Future tests relying on `top_player` semantics would get wrong data silently.

**Fix:** Either document that `top_player` is ignored by the route and set it to a sentinel:

```typescript
function dreamTeamPayload(picks: Array<...>) {
  return {
    top_player: { id: 0, points: 0 },  // not used by route; kept for API shape completeness
    team: picks,
  }
}
```

Or remove the dependency on `picks[0]` entirely.

---

### IN-02: `benchmarkDeltaLabel` is computed unconditionally even when `benchmark_label === 'FPL average'` (where it is never rendered)

**File:** `src/components/squad/GwReviewTab.tsx:170-183`

**Issue:** The benchmark delta computation runs for every render regardless of `review.benchmark_label`. The computed `benchmarkDeltaLabel` is then gated by `delta={review.benchmark_label === 'FPL average' ? undefined : benchmarkDeltaLabel}`. This is harmless in practice but wastes two string allocations per render when the fallback path is active, and it means `benchmarkSentimentClass` is always set even though it has no effect in the degraded case (because `StatCard` still receives and applies it as the value colour). 

**Fix:** Hoist the conditional to compute these values only when needed:

```tsx
const isDreamTeam = review.benchmark_label !== 'FPL average'
const benchmarkDeltaLabel = isDreamTeam ? computeDelta(benchmarkDiff) : undefined
const benchmarkSentimentClass = isDreamTeam ? computeSentiment(benchmarkDiff) : undefined
```

This makes the rendering intent clearer and avoids computing strings that are discarded.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
