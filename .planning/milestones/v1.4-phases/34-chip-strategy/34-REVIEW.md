---
phase: 34-chip-strategy
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/chip-strategy-engine.ts
  - src/lib/chip-strategy-engine.test.ts
  - src/lib/hooks/useChipHistory.ts
  - src/components/planner/ChipStrategyPanel.tsx
  - src/components/planner/ChipStrategyPanel.test.tsx
  - src/components/planner/PlannerTab.tsx
findings:
  critical: 1
  warning: 5
  info: 0
  total: 6
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The chip-strategy engine logic for BB (CHIP-01) and TC (CHIP-02) is sound. The greedy
FH squad builder (CHIP-03) is also structurally correct. One blocker was found: the
`GWEaseScore.ease` values emitted for FH are not in the 0–1 range, which means the
`EaseCellBar` component renders incorrect tooltip text and incorrect colour fills for
the Free Hit row. Five warnings cover edge-case incorrectness in the UI, a missing
API-response validation, and a non-null assertion.

---

## Critical Issues

### CR-01: FH `scores[].ease` values are not normalised to 0–1

**File:** `src/lib/chip-strategy-engine.ts:413`

**Issue:** `computeFHResult` builds its `scores` array using:

```ts
ease: horizonGws.length > 0 ? r.score / Math.max(1, 11) : 0,
```

`r.score` is the sum of weighted xPts across the top-11 players (roughly 11 × 5 × 0.7
≈ 38 in a typical season). Dividing by 11 yields values around 3–7, **not** a 0–1
ease fraction. The `GWEaseScore.ease` field is defined — and consumed — as "0.0
hardest, 1.0 easiest". Downstream effects:

- `EaseCellBar` renders `(s.ease * 100).toFixed(0)%` — FH cells show "380%", "520%"
  etc. in tooltips and aria-labels.
- `easeFill()` uses thresholds at 0.75, 0.55, 0.40, 0.25 — since all FH ease values
  exceed 0.75, every FH cell is always rendered green regardless of fixture quality.
- `isBest` selection in `computeFHResult` itself is unaffected (it compares raw scores,
  not the normalised ease field), but the per-GW visual signal shown to users is
  completely wrong.

**Fix:** Normalise the score to [0, 1] before storing. Divide by a meaningful maximum
(e.g. the highest GW score in the horizon so the best GW always renders at 1.0):

```ts
const maxScore = Math.max(...gwResults.map(r => r.score), 1)

const scores: GWEaseScore[] = gwResults.map((r, i) => ({
  gw: r.gw,
  ease: r.score / maxScore,          // 0.0–1.0: best GW = 1.0
  isBest: i === bestIdx ? true : undefined,
}))
```

This preserves relative ordering, keeps the `ease` field in-contract for all
consumers, and requires no change to `EaseCellBar` or the colour thresholds.

---

## Warnings

### WR-01: `startingGw ?? 0` produces GW-0 labels before data loads

**File:** `src/components/planner/ChipStrategyPanel.tsx:235-239`

**Issue:** `computeBBScore` and `computeTCScore` are called with `startingGw ?? 0`
when `startingGw` is `null` (squad not yet loaded). If `clubFormMap` is also empty at
that point (data still loading), the engine's defensive return path emits
`[{gw:0}, {gw:1}, {gw:2}, {gw:3}, {gw:4}]`. The component renders these as "GW0",
"GW1"… in cell titles and aria-labels before real data arrives, which is a visible
glitch and an accessibility issue (screen readers announce incorrect gameweek numbers).

**Fix:** Pass `undefined` instead of `0` and guard in the engine, or short-circuit
rendering when `startingGw` is null:

```tsx
// Option A — guard rendering before scores are meaningful
if (!startingGw || clubForm === undefined) {
  return (
    <section aria-label="Chip Strategy" ... >
      <p className="text-sm text-zinc-500 ...">Loading fixture data…</p>
    </section>
  )
}

// Option B — pass undefined so deriveHorizonGws uses real GW numbers from clubFormMap
const bbScores = useMemo(
  () => computeBBScore(benchPicks, scoredPlayers, clubFormMap, startingGw ?? undefined!),
  ...
)
```

Option A is cleaner because it avoids rendering stale state entirely.

---

### WR-02: `fhResult.bestGw || null` falsily converts GW 0

**File:** `src/components/planner/ChipStrategyPanel.tsx:294`

**Issue:**

```tsx
bestGw={fhResult.bestGw || null}
```

The `||` operator converts the value `0` to `null`, causing the FH row to display
`—` instead of "Best: GW0". GW 0 is not a valid FPL gameweek in production, but the
engine's defensive-zero path returns `bestGw: resolvedStartGw` which resolves to
`Math.min(...allGws)` — and if the map is unexpectedly empty it defaults to `1`, not
`0`. However, the `||` idiom is semantically wrong and masks intent. If GW numbering
ever changes or the engine returns 0 in a new error path, the bug becomes visible.

**Fix:** Use strict null comparison:

```tsx
bestGw={fhResult.bestGw !== 0 ? fhResult.bestGw : null}
// Or, since bestGw is always a number and never undefined/null from the engine:
bestGw={fhResult.bestGw > 0 ? fhResult.bestGw : null}
```

---

### WR-03: Empty `currentSquadIds` bypasses `FH_DEFAULT_BUDGET_TENTHS` fallback

**File:** `src/components/planner/ChipStrategyPanel.tsx:232` and
`src/lib/chip-strategy-engine.ts:302-307`

**Issue:** `ChipStrategyPanel` always passes `currentSquadIds`:

```ts
const currentSquadIds = useMemo(() => (picks ?? []).map(p => p.element), [picks])
// ...
computeFHResult(scoredPlayers, clubFormMap, bankBalance, sellPrices, currentSquadIds, ...)
```

When `picks` is `null` (squad not yet fetched), `currentSquadIds` is `[]` — not
`undefined`. The budget branch in the engine is:

```ts
const budget = currentSquadIds !== undefined
  ? bankBalance + currentSquadIds.reduce(...)   // → bankBalance + 0 = bankBalance
  : FH_DEFAULT_BUDGET_TENTHS
```

`[] !== undefined` is always true, so the engine uses `bankBalance` (often `0` before
data loads) as the entire squad budget. `FH_DEFAULT_BUDGET_TENTHS` (£100m) is never
used when called from the component. A `bankBalance` of 0 means the FH greedy builder
can pick no players at all (every `now_cost > 0`), returning an empty squad.

**Fix:** Pass `undefined` when `picks` is null so the engine uses the sensible default:

```tsx
const currentSquadIds = useMemo(
  () => picks !== null ? picks.map(p => p.element) : undefined,
  [picks],
)
```

---

### WR-04: `fetchChipHistory` does not validate API response shape

**File:** `src/lib/hooks/useChipHistory.ts:18-21`

**Issue:**

```ts
const data: ChipHistoryResponse = await res.json()
return data.chips ?? []
```

The response body is cast directly to `ChipHistoryResponse` with no runtime
validation. If the FPL API returns an unexpected shape (changed key, type mismatch,
error envelope), `data.chips` is `undefined` and the function silently returns `[]`.
The caller in `ChipStrategyPanel` has no way to distinguish "no chips used" from "API
returned a malformed response", so a broken API silently shows all chips as available.

**Fix:** Add a lightweight runtime check before accepting the payload:

```ts
const raw = await res.json()
if (!raw || typeof raw !== 'object') {
  throw new Error('Chip history: unexpected response shape')
}
const data = raw as ChipHistoryResponse
return Array.isArray(data.chips) ? data.chips : []
```

For stronger guarantees, parse with a Zod schema consistent with the rest of the
codebase.

---

### WR-05: Non-null assertion `teamId!` inside `queryFn`

**File:** `src/lib/hooks/useChipHistory.ts:34`

**Issue:**

```ts
queryFn: () => fetchChipHistory(teamId!),
enabled: !!teamId && /^\d+$/.test(teamId),
```

The `!` non-null assertion bypasses TypeScript's safety check. The `enabled` guard
makes this safe in practice (React Query only calls `queryFn` when `enabled` is true),
but the assertion is a maintenance hazard: any future refactor that calls
`refetch()` directly or disables the guard could silently invoke
`fetchChipHistory(null as unknown as string)`, producing a URL of
`/api/fpl/entry/null/history/` and a confusing 404.

**Fix:** Add an explicit guard inside `queryFn`:

```ts
queryFn: () => {
  if (!teamId) throw new Error('teamId is required')
  return fetchChipHistory(teamId)
},
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
