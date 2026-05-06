---
phase: 065-rejection-explainer
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/explain.ts
  - src/components/transfers/HighOwnershipCallout.tsx
  - src/components/squad/ExplainPanel.tsx
  - src/components/gem-table/GemTable.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/components/squad/SquadView.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: fixed
---

# Phase 065: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase adds a "rejection explainer" feature: a `computeRejection` engine in `explain.ts`, a `HighOwnershipCallout` component, and integration into `GemTable`, `ExplainPanel`, `SquadView`, and `TransferPanel`. The core logic is mostly well-structured and the design decisions are consistently followed.

Two critical bugs were found: `computeRejection` can return `xPtsRank = 0` when the player is not present in `allPlayers`, and the `HighOwnershipCallout` in `TransferPanel` silently includes bench players in "in-squad rank" calculations because the bench boundary check uses `>= 12` (wrong for FPL's 11-player starting XI where position 12 is the first bench slot — that boundary is actually correct) — however a separate bench-exclusion gap applies to bench players who are entirely absent from `startingXiByPos` while still being `inSquad = true`, producing a rendered `squadRank` of `undefined` shown as `'?'` to the user. There are also five warnings covering incorrect adaptive-framing comparison, a missing null guard, fragility-reason mismatch with upstream constants, silent `NaN` risk, and a display inconsistency.

---

## Critical Issues

### CR-01: `xPtsRank` is 0 when player not found in `allPlayers`

**File:** `src/lib/explain.ts:123`

**Issue:** `findIndex` returns `-1` when the target player's `id` is absent from `samePosition` (i.e. `allPlayers` does not include the player being explained — possible when `allPlayers` is a filtered subset or the player data is stale). Adding 1 to `-1` yields `0`, which is never a valid 1-based rank. Every caller renders this as "Ranked #0 at POS by xPts" or "No rejection signals — ranked #0 at POS by xPts (…)", which is nonsensical user-facing copy and a data-correctness bug.

**Fix:**
```ts
const rawIndex = samePosition.findIndex(p => p.id === player.id)
const xPtsRank = rawIndex === -1 ? samePosition.length + 1 : rawIndex + 1
// OR surface as an explicit sentinel and guard in callers:
// const xPtsRank = rawIndex === -1 ? null : rawIndex + 1
```
At minimum add a guard so rank 0 is never returned. Falling back to `samePosition.length + 1` (last place) is safe — it is logically consistent because if the player is absent they cannot be ranked above anyone.

---

### CR-02: Bench player shown as "in-squad ranked #?" in `HighOwnershipCallout`

**File:** `src/components/transfers/TransferPanel.tsx:159-165`

**Issue:** `inSquad` is derived from `squadIds` (all 15 picks), but `squadRank` is derived from `startingXiByPos` (only picks with `position < 12`). When a high-ownership player is on the bench (`pick.position >= 12`), `inSquad` is `true` but `list.findIndex(x => x.id === p.id)` returns `-1` and `squadRank` is set to `undefined`. `HighOwnershipCallout` renders this as:

> Salah (32%): Already ranked #? at MID in your squad by xPts — no upgrade needed

The `#?` copy is user-visible and misleading — the copy implies the player is already well-ranked, when actually they are on the bench and the rank is unknown. The in-squad copy variant was written for starting-XI members; bench players should fall through to the not-in-squad variant or display distinct copy.

**Fix:**
```ts
// Derive inSquad only from starting XI, not full 15:
const startingIds = new Set(
  squadData.picks.filter(p => p.position < 12).map(p => p.element)
)
// ...
const inSquad = startingIds.has(p.id)
```
This ensures bench players are never given the in-squad copy variant, which prevents the `#?` rendering.

---

## Warnings

### WR-01: Adaptive-framing threshold uses `>` instead of `>=` — asymmetric with `computeVerdicts`

**File:** `src/lib/explain.ts:131`

**Issue:** The "strong player" gate in `computeRejection` is:
```ts
const isStrong = player.gem_score > posAvg && ...
```
`computeVerdicts` in `recommend.ts` uses `gem_score > positionAvg` for Buy (strictly above), `gem_score < positionAvg * SELL_THRESHOLD` for Sell, and everything else is Hold. A player exactly at the position average (`gem_score === posAvg`) therefore gets a `hold` verdict from `computeVerdicts` but `isStrong = false` in `computeRejection`, so they receive a rejection reasons list in GemTable's panel while their SquadView panel says nothing alarming. This inconsistency is minor but the intent of D-04 ("gem_score >= positionAverage") as stated in the JSDoc is `>=`, which differs from the code (`>`). If the JSDoc accurately captures the design intent, the code has an off-by-one boundary error.

**Fix:**
```ts
const isStrong =
  player.gem_score >= posAvg &&   // match JSDoc intent: "gem_score >= positionAverage"
  fragilityReasons.length === 0 &&
  player.start_prob >= REJECTION_START_PROB_THRESHOLD
```

---

### WR-02: `computeFragility` fragility-reason string `'harder fixture'` is checked against wrong constant in `SquadView`

**File:** `src/components/squad/SquadView.tsx:247`

**Issue:** `SquadView` manually inspects fragility reason strings to translate them into user-facing copy:
```ts
} else if (r === 'harder fixture') {
  rejectionReasons.push('Difficult fixture this gameweek')
}
```
The fragility reason string `'harder fixture'` is a hardcoded literal in `sensitivity.ts` line 32. If it ever changes (e.g. to `'hard fixture'` or `'medium fixture'`), the `SquadView` branch silently fails to fire — the raw internal string is never shown (it is just skipped), so the rotation-risk message is silently dropped. There is no shared constant for this string.

**Fix:** Export the fragility reason literals as constants from `sensitivity.ts` and import them in `SquadView`:
```ts
// sensitivity.ts
export const FRAGILITY_HARDER_FIXTURE = 'harder fixture'
export const FRAGILITY_START_PROB = 'start_prob < 70%'

// SquadView.tsx
import { FRAGILITY_HARDER_FIXTURE, FRAGILITY_START_PROB } from '@/lib/sensitivity'
// ...
if (r === FRAGILITY_START_PROB) { ... }
else if (r === FRAGILITY_HARDER_FIXTURE) { ... }
```

---

### WR-03: `computeFragility` also triggers on `difficulty_tier === 'medium'` but `computeRejection` checks `fixtures[0]` with both medium and hard — double-reporting fragility

**File:** `src/lib/explain.ts:154-159` and `src/lib/explain.ts:164-167`

**Issue:** `computeRejection` step 3c adds a "Difficult fixture" reason when `fixtures[0].difficulty_tier === 'medium' || 'hard'`. Then step 3d appends fragility reasons, which also includes `'harder fixture'` (triggered by `difficulty_tier === 'medium'` only). When a player has a medium fixture, the rejection panel will show:

1. "Difficult fixture (FDR medium)" — from step 3c
2. "Fragile: no longer recommended if: harder fixture" — from step 3d

These are semantically redundant for medium fixtures. For hard fixtures only step 3c fires (because `computeFragility` only flags medium, not hard). This asymmetry means medium-fixture players get two fixture messages while hard-fixture players get one.

**Fix:** Either gate step 3c to `hard` only (matching `computeFragility`'s threshold for medium), or gate step 3d to suppress the fixture fragility reason when step 3c already emitted a fixture message:
```ts
// Option A: restrict step 3c to hard only (aligns with fragility semantics)
if (
  player.fixtures.length > 0 &&
  player.fixtures[0].difficulty_tier === 'hard'
) {
  reasons.push(`Difficult fixture (FDR hard)`)
}
// computeFragility already handles 'medium' via step 3d
```

---

### WR-04: `parseFloat` on `selected_by_percent` can silently produce `NaN` if the field is empty string

**File:** `src/lib/explain.ts:69`, `src/lib/explain.ts:169`, `src/components/transfers/HighOwnershipCallout.tsx:40`, `src/components/transfers/TransferPanel.tsx:154`

**Issue:** `selected_by_percent` is typed as `string` in `MergedPlayer`. If the FPL API or pipeline emits an empty string `""` or a non-numeric string, `parseFloat("")` returns `NaN`. `NaN < DIFFERENTIAL_THRESHOLD` is `false`, `NaN > 20` is `false`, and `Math.round(NaN)` is `NaN`, which renders as `"NaN%"` in the UI. `NaN.toFixed(1)` throws a `TypeError` in some environments. The code comments acknowledge the string-to-float pitfall (Pitfall 2) but only guard against the property being numeric-typed — not against malformed values.

**Fix:** Add a fallback for the parse result in shared usage:
```ts
const owned = parseFloat(player.selected_by_percent)
if (!isNaN(owned) && owned < DIFFERENTIAL_THRESHOLD) { ... }
```
The same pattern should be applied in `HighOwnershipCallout` and `TransferPanel` filter/sort chains.

---

### WR-05: `SquadView` ignores `hold` verdict players for captaincy rejection message — captain rejection only fires for `sell`

**File:** `src/components/squad/SquadView.tsx:234-259`

**Issue:** The outer guard at line 234–235 is:
```ts
if (verdict === 'sell' || verdict === 'hold') {
```
But the captain-rejection message at lines 251–258 is inside this block and fires for both `sell` and `hold` verdicts. A `hold` player who is not the top captain pick will always receive a captain-ranking message, even if they are otherwise healthy. This means every "Hold"-verdicted player who is not the top captain shows a rejection reason, which inflates the panel for players the engine is satisfied with. The design intent from D-09 is "include only when player is NOT the top candidate" — but D-08/D-09 do not specify that captain rejection should appear for Hold players, only for Sell. This is likely unintentional scope creep.

**Fix:**
```ts
// Only add captain rejection for sell-verdicted players, not hold:
if (topCap && topCap.player.id !== player.id && verdict === 'sell') {
  const rank = capIndex === -1 ? '?' : String(capIndex + 1)
  rejectionReasons.push(
    `Ranked #${rank} at ${POSITION_LABELS[player.element_type]} by xPts — ${topCap.player.web_name} is the captain pick`
  )
}
```

---

## Info

### IN-01: `POSITION_CODES` duplicated between `explain.ts` and `GemTable.tsx`

**File:** `src/lib/explain.ts:89-94`, `src/components/gem-table/GemTable.tsx:28-33`

**Issue:** `POSITION_CODES` and `POSITION_CODES_LABEL` are identical `Record<number, string>` objects with the same four entries. `SquadView.tsx` and `TransferPanel.tsx` also define local `POSITION_LABELS` records with identical contents. The same constant exists in at least four places.

**Fix:** Export one canonical `POSITION_LABELS` constant from `src/lib/types.ts` or a shared `src/lib/constants.ts` and import it everywhere.

---

### IN-02: `ExplainPanel` uses index as React `key` in `rejectionReasons` list

**File:** `src/components/squad/ExplainPanel.tsx:28-31`

**Issue:** Both the positive `reasons` list and the `rejectionReasons` list use `key={i}` (array index). This is acceptable when the list is static and never reordered, but index-as-key can cause incorrect reconciliation if reasons are added/removed between renders (e.g. when a player is expanded and then data refreshes). The same pattern is used in the existing `reasons` list (pre-Phase 65 code), so this is not a regression.

**Fix:** Use the reason string as key (it is unique within a single player's panel):
```tsx
{rejectionReasons.map((reason) => (
  <li key={reason} className="text-xs text-zinc-600 dark:text-zinc-400">
    {reason}
  </li>
))}
```

---

### IN-03: `console.warn` left in production-gated path in `GemTable.tsx`

**File:** `src/components/gem-table/GemTable.tsx:193-195`

**Issue:**
```ts
if (process.env.NODE_ENV !== 'production') {
  console.warn('GemTable: onPresetChange not provided; preset change ignored', p)
}
```
This is pre-existing code (not introduced in Phase 65) but is within one of the reviewed files. The `NODE_ENV` guard means it won't appear in production, but it is technically a debug artifact in the reviewed file set.

**Fix:** This is a pre-Phase-65 pattern — acceptable to leave as-is given the production guard. No action required unless the project convention forbids all `console.*` calls.

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
