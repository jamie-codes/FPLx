---
phase: 111
status: findings
depth: standard
reviewed_at: 2026-05-15T00:00:00Z
files_reviewed: 12
files_reviewed_list:
  - src/lib/types.ts
  - src/lib/club-form.ts
  - src/lib/club-form.test.ts
  - src/app/api/club-form/route.ts
  - src/components/club-form/FixtureHeatMap.tsx
  - src/components/club-form/FixtureHeatMap.test.tsx
  - src/lib/suggest-transfers.ts
  - src/lib/suggest-transfers.test.ts
  - src/components/transfers/TransferPanel.tsx
  - src/components/optimiser/OptimiserPanel.tsx
  - src/components/squad/DecisionSummaryTab.tsx
  - src/components/rivals/RivalsTab.tsx
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
---

# Phase 111: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 111 introduces two fixes: FIX-01 adds a `current_gw_played` map to show already-played GW fixtures on the heatmap, and FIX-02 adds a defensive guard in `suggestTransfers` against invalid `element_type` values. The `computeClubForm` engine extension and the API route wiring are sound. The TypeScript type for `current_gw_played` is correct (required field, array). The `VALID_ELEMENT_TYPES` guard in `suggest-transfers.ts` is correct in isolation.

Two critical bugs are present. The render branch in `FixtureHeatMap.tsx` has an unhandled case that silently drops played-fixture data during a partially-played DGW (one game played, one still to come in the same GW). The `currentGw` fallback derivation in `club-form.ts` is order-dependent on the FPL API events array and will select the wrong GW if that array is not sorted. Three warnings cover: the `sanePlayers` branch conditional being needlessly redundant, the corrupt-player-as-sell gap (a player in the squad with a bad `element_type` is silently excluded from `currentPlayers` without a warning), and a missing test case for the partially-played DGW render path.

---

## Critical Issues

### CR-01: Partially-played DGW render branch missing — played fixtures silently dropped

**File:** `src/components/club-form/FixtureHeatMap.tsx:86–177`

**Issue:** The render decision tree inside `HeatMapRow` handles four cases: both arrays empty (BGW), `fixtures.length === 0 && playedFixtures.length >= 2` (fully-played DGW), `fixtures.length === 0 && playedFixtures.length === 1` (fully-played single), and `fixtures.length >= 1` (upcoming). It never handles `fixtures.length === 1 && playedFixtures.length >= 1`, which is the realistic state during a mid-GW DGW: one game of the double has been played and one is still upcoming. In this case the code falls through to the final `fixtures[0]` branch (line 166), renders the upcoming fixture only with full opacity, and completely discards the played fixture. The user sees a normal upcoming-cell with no indication a game has already been played.

This is a correctness failure, not an aesthetic one: the "already played" signal is entirely lost for a significant portion of a DGW.

**Fix:** Insert a branch before the `fixtures.length >= 2` check that handles the partially-played case:

```tsx
// Partially-played DGW: one upcoming fixture, one (or more) already played.
if (fixtures.length >= 1 && playedFixtures.length >= 1) {
  // Show upcoming fixture(s) at full opacity, played fixture(s) dimmed.
  // Use the first upcoming fixture as the primary cell render.
  const f = fixtures[0]
  const playedTooltip = playedFixtures
    .map(pf => `${pf.opponent_team} (${pf.is_home ? 'H' : 'A'}) — Played`)
    .join(' / ')
  const upcomingTooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${(mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty).toFixed(2)}`
  return (
    <td
      key={gw}
      className={`relative px-2 py-1 text-center min-w-[48px] h-8 ${TIER_CLASSES[currentTier(f, mode)]}`}
      title={`${upcomingTooltip} | ${playedTooltip}`}
    >
      <span className="text-xs font-mono">{f.opponent_team}</span>
      <span className="absolute top-0 right-0 text-[8px] leading-none text-zinc-500">✓</span>
    </td>
  )
}
```

The exact UX design (indicator style, tooltip format) is at the implementor's discretion; the fix must exist before the `fixtures.length >= 2` branch.

---

### CR-02: `currentGw` fallback is order-dependent — no sort applied to `events` before `slice(-1)`

**File:** `src/lib/club-form.ts:138–141`

**Issue:** When no event has `is_current === true`, the fallback derives the current GW by taking the last element of the finished events array:

```ts
bootstrap.events?.filter(e => e.finished).slice(-1)[0]?.id ??
```

This assumes the `events` array is ordered by GW `id` ascending. If the FPL API (or a cached / mocked version) returns events out of order, `slice(-1)` returns the last element by array position, which may not be the highest-id finished event. The FPL API does historically return events in GW order, but the code makes no defensive sort, violating the principle that safety invariants must be enforced rather than relied upon from an external source.

Concretely: if events arrive as `[GW36-finished, GW34-finished, GW35-finished]` (non-canonical order), `slice(-1)` returns GW35 instead of GW36, and `current_gw_played` shows GW35's fixtures as "currently playing" even though GW36 is the actual last-finished GW.

**Fix:**

```ts
const currentGw: number | null =
  bootstrap.events?.find(e => e.is_current)?.id ??
  bootstrap.events
    ?.filter(e => e.finished)
    .sort((a, b) => a.id - b.id)   // sort by GW id ascending before taking last
    .slice(-1)[0]?.id ??
  null
```

---

## Warnings

### WR-01: `sanePlayers` branch conditional doubles the filter work unnecessarily

**File:** `src/lib/suggest-transfers.ts:105–107`

**Issue:** The code computes `invalidPlayers` (a filtered array), then conditionally re-filters `players` to produce `sanePlayers`:

```ts
const sanePlayers = invalidPlayers.length > 0
  ? players.filter(p => VALID_ELEMENT_TYPES.has(p.element_type as number))
  : players
```

This short-circuit (`invalidPlayers.length > 0`) is intended as an optimisation: avoid filtering when all players are valid. However, it introduces an implicit semantic coupling — `invalidPlayers` and the `sanePlayers` filter must remain in sync. A future maintainer who changes the `invalidPlayers` predicate but forgets to update the `sanePlayers` filter introduces a silent divergence. The hot path (no invalid players) also has negligible cost difference from always filtering. Prefer a single unconditional expression:

```ts
const sanePlayers = players.filter(p => VALID_ELEMENT_TYPES.has(p.element_type as number))
```

Keep the `invalidPlayers` array only for the `console.warn` log:

```ts
const sanePlayers = players.filter(p => VALID_ELEMENT_TYPES.has(p.element_type as number))
const droppedCount = players.length - sanePlayers.length
if (droppedCount > 0) {
  const droppedIds = players
    .filter(p => !VALID_ELEMENT_TYPES.has(p.element_type as number))
    .map(p => p.id).join(',')
  console.warn(`[FIX-02] suggestTransfers: dropping ${droppedCount} player(s) with invalid element_type: ids=${droppedIds}`)
}
```

---

### WR-02: Squad player with invalid `element_type` is silently excluded from sell-side without a warning

**File:** `src/lib/suggest-transfers.ts:143–148`

**Issue:** `playerById` is built from `sanePlayers` (which excludes invalid-element-type players). When `currentPlayers` is built from `currentPicks` via `playerById.get(pick.element)`, any squad pick whose player has an invalid `element_type` will return `undefined` from the map and be silently dropped:

```ts
const currentPlayers: MergedPlayer[] = []
for (const pick of currentPicks) {
  const p = playerById.get(pick.element)
  if (p) currentPlayers.push(p)
}
```

This means a squad player with a corrupt `element_type` is quietly removed from the sell-side pool with no log message. The guard at line 99–104 only warns about players in the `players` array, not about the secondary consequence of those same players being absent from the owned-squad sell pool. The existing FIX-02 test at line 563 only checks that the corrupt player doesn't appear in buy/sell results — it doesn't verify that the `currentPicks` squad resolution path also logs correctly when the corrupt player is in the squad.

**Fix:** After building `currentPlayers`, log a warning if any pick was dropped:

```ts
const currentPlayers: MergedPlayer[] = []
const droppedPickIds: number[] = []
for (const pick of currentPicks) {
  const p = playerById.get(pick.element)
  if (p) currentPlayers.push(p)
  else droppedPickIds.push(pick.element)
}
if (droppedPickIds.length > 0) {
  console.warn(`[suggestTransfers] ${droppedPickIds.length} squad pick(s) not found in player map (invalid element_type or missing from players array): ids=${droppedPickIds.join(',')}`)
}
```

---

### WR-03: No test coverage for partially-played DGW render path (the missing branch in CR-01)

**File:** `src/components/club-form/FixtureHeatMap.test.tsx`

**Issue:** The Phase 111 FIX-01 tests cover: single played cell, BGW cell, DGW fully-played cell, and `allEventIds` including played GW event_id. They do not cover the case where `fixtures.length >= 1 && playedFixtures.length >= 1` for the same GW (partially-played DGW during live GW). This means the bug in CR-01 has no test that would catch it. Even after CR-01 is fixed, the render branch for this state needs a dedicated test to prevent regression.

**Fix:** Add a test case:

```tsx
it('FIX-01: partially-played DGW — one upcoming fixture rendered at full opacity, played game indicated', () => {
  const data: ClubForm[] = [
    team(1, 'ARS', [
      fix({ opp: 'CHE', home: false, gw: 35, tier: 'hard' }),   // still upcoming
    ], [
      fix({ opp: 'MCI', home: true, gw: 35, tier: 'easy' }),    // already played
    ]),
    team(2, 'CHE', [fix({ opp: 'ARS', home: true, gw: 35, tier: 'medium' })]),
  ]
  mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
  const { container } = render(<FixtureHeatMap />)
  const arsCell = container.querySelector('tbody tr:nth-child(1) td')!
  // Must not be a BGW cell
  expect(arsCell.className).not.toMatch(/bg-zinc-50/)
  expect(arsCell.getAttribute('title')).not.toBe('No fixture (BGW)')
  // Must not silently discard the played fixture (title or content should reference both)
  const title = arsCell.getAttribute('title') ?? ''
  expect(title).toContain('Played')
})
```

---

## Info

### IN-01: `current_gw_played` is a required field on `ClubForm` — older API consumers that rely on spread/copy must be updated

**File:** `src/lib/types.ts:504`

**Issue:** `current_gw_played: ClubFormFixture[]` is typed as a required field (no `?`). This is the correct decision given the feature is being shipped as non-optional. However, `FixtureHeatMap.tsx` still uses `(t.current_gw_played ?? [])` on line 224 and 241, which is a dead null-coalescing guard since the type guarantees the field is never undefined or null. The guard is harmless but misleading — it implies the field might be absent, which contradicts the type.

The `??` guard was appropriate during development (before the field became required) but should be cleaned up. Leaving it creates a maintenance signal that `current_gw_played` might be optional, which could lead a future developer to revert it to optional `?` form unnecessarily.

**Fix:** Remove the `?? []` guards on lines 224 and 241 since the TypeScript type guarantees the array is always present:

```ts
// line 224 — before:
...data.flatMap(t => (t.current_gw_played ?? []).map(f => f.event_id)),
// after:
...data.flatMap(t => t.current_gw_played.map(f => f.event_id)),

// line 241 — before:
for (const f of (t.current_gw_played ?? [])) {
// after:
for (const f of t.current_gw_played) {
```

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
