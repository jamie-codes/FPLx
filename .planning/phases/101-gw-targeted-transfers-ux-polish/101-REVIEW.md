---
phase: 101-gw-targeted-transfers-ux-polish
reviewed: 2026-05-12T17:48:56Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/gem-table/GwToggle.tsx
  - src/components/optimiser/OptimiserPanel.test.tsx
  - src/components/transfers/OpportunityCostTable.test.tsx
  - src/components/transfers/OpportunityCostTable.tsx
  - src/components/transfers/TransferPanel.tsx
  - src/lib/gw-xpts.test.ts
  - src/lib/gw-xpts.ts
  - src/lib/suggest-transfers.test.ts
  - src/lib/suggest-transfers.ts
  - tests/components/club-form/FixtureEaseRankingPanel.test.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 101: Code Review Report

**Reviewed:** 2026-05-12T17:48:56Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase delivers the GWT-01 (per-gameweek targeted transfers) engine and the UX-01 GwToggle rename. The core logic in `gw-xpts.ts` and `suggest-transfers.ts` is well-structured and the test coverage is thorough. However one critical logic bug was found in `TransferPanel.tsx` where `freeTransfers` values above 2 silently collapse to the same behaviour as 2 without any user feedback, and there are several meaningful quality issues in the surrounding code.

## Critical Issues

### CR-01: `freeTransfers` input accepts 3–5 but `derivedFtCount` silently clamps to 2 — user input is silently discarded

**File:** `src/components/transfers/TransferPanel.tsx:103`

**Issue:** The free-transfers input allows values 1–5 (`min={1} max={5}`), but `derivedFtCount` clamps anything ≥ 2 to exactly 2:

```ts
return (freeTransfers >= 2 ? 2 : 1) as 1 | 2
```

A user who enters 3, 4, or 5 free transfers (which is valid FPL state — Wildcard banked transfers can stack) sees the interface accept the value, then the engine silently ignores anything above 2 and produces suggestions ranked as if only 2 FTs were available. No warning is shown, and the UI shows a bank balance with input accepted. This is silent data loss from the user's perspective.

If the transfer type only ever supports 1 or 2 FTs, the input's `max` should be clamped to 2 to prevent the user from entering a value the engine ignores. If 3+ FTs are a future feature, the input should be disabled with a tooltip explaining the current limit.

**Fix:**
```tsx
// Option A — immediate fix: constrain the input so only valid values are accepted
<input
  id="freeTransfers"
  type="number"
  min={1}
  max={2}   // engine supports 1|2 only; raise when engine supports higher counts
  value={freeTransfers}
  onChange={e => setFreeTransfers(Math.max(1, Math.min(2, Number(e.target.value))))}
  ...
/>
```

## Warnings

### WR-01: `availableGws` computed from `scoredPlayers` fixtures includes past gameweeks — dropdown is not filtered to future GWs

**File:** `src/components/transfers/TransferPanel.tsx:63-69`

**Issue:** The `availableGws` memo collects every distinct `event_id` from every player's `fixtures` array. Player fixture data typically includes already-played gameweeks. When a user opens the Target GW dropdown they will see past GWs mixed in with future ones (e.g. GW28, GW29, GW30 as well as GW33, GW34…). Selecting a past GW would compute `computeGwXpts` for a gameweek that has no future value, returning 0 for all players who have already played (since those fixtures have passed), and producing misleading "all-zero" rankings with no warning.

**Fix:** Filter to GWs that are strictly in the future. The current gameweek is available from `squadData.entry_history.event`. Only include `event_id > currentGw`:

```ts
const availableGws: number[] = useMemo(() => {
  const currentGw = squadData?.entry_history.event ?? 0
  const ids = new Set<number>()
  for (const p of scoredPlayers) {
    for (const f of p.fixtures) {
      if (f.event_id > currentGw) ids.add(f.event_id)
    }
  }
  return Array.from(ids).sort((a, b) => a - b)
}, [scoredPlayers, squadData])
```

### WR-02: `tr` key uses `row.kind` — not unique when two rows have the same `kind` before `i` suffix stabilises

**File:** `src/components/transfers/OpportunityCostTable.tsx:149`

**Issue:** The key is `${row.kind}-${i}` where `i` is the array index. While this produces unique keys in practice (since each `OCSRowKind` appears at most once in a given render), the key is based on a combination of a semantic value and a positional index. If the `rows` array is ever reordered externally (e.g. by a future sort), React will match elements by the incorrect identity, causing missed updates or stale content. A purely positional key would be safer, or the `row.kind` alone would work since `OCSRowKind` values are unique per row.

**Fix:** Use `row.kind` as the key alone — it is already unique per row in the OCS data model:

```tsx
<tr key={row.kind} ...>
```

### WR-03: `csProb` in `gw-xpts.ts` uses player-level `xmins` for the minutes factor — not fixture-level minutes

**File:** `src/lib/gw-xpts.ts:17-20`

**Issue:** `csProb(defensiveDifficulty, xmins)` receives the player's overall `xmins` (expected minutes across all fixtures in the horizon, probability-weighted). For a DGW player this value could exceed 90. The `minsFactor = Math.min(1.0, xmins / 60.0)` clamp prevents it from exceeding 1.0, so it does not crash, but the semantics are wrong: `xmins` is a multi-fixture aggregate, not a per-fixture minutes expectation. For a player with `xmins=80` (high single-fixture confidence), `minsFactor = min(1, 80/60) = 1.0`. This happens to produce the correct behaviour for most cases, but when a player has `xmins=35` (rotation risk), the CS prob is reduced by `35/60 ≈ 0.58` — a plausible approximation but not the same as using per-fixture expected minutes. The docstring claims it is `[VERIFIED: pipeline/merge.py _cs_prob()]` but the Python function's second argument is the per-fixture expected minutes, not the aggregate `xmins`. This discrepancy should be documented or corrected.

**Fix:** At minimum, add a clarifying comment that `xmins` is used as a per-fixture proxy (since fixture-level expected minutes are not stored in `FixtureEntry`). If the pipeline provides per-fixture `xmins`, thread it through `FixtureEntry` and use it here:

```ts
/** CS probability for a single fixture.
 * NOTE: xmins is the player-level aggregate (probability-weighted across all fixtures
 * in the horizon window). Used as a per-fixture proxy since FixtureEntry does not
 * carry per-fixture expected minutes. For DGW players this may overstate CS probability
 * on the second fixture. */
function csProb(defensiveDifficulty: number, xmins: number): number {
```

### WR-04: `GwToggle` disabled state uses `pointer-events-none` only — keyboard focus still active

**File:** `src/components/gem-table/GwToggle.tsx:98`

**Issue:** When `disabled={true}` (set in `TransferPanel` when `targetGw` is active), the wrapper div gets `pointer-events-none opacity-50`. This visually signals disabled state and blocks mouse clicks, but keyboard users can still tab-focus individual buttons inside the group and activate them with Space/Enter, bypassing the disabled intent. The buttons themselves are not `disabled` and have no `aria-disabled` attribute.

**Fix:** Apply `disabled` and `aria-disabled` on the buttons, or use `tabIndex={-1}` on each when the group is disabled:

```tsx
{([1, 3, 5] as const).map((gw) => (
  <button
    key={gw}
    onClick={() => onChange(gw)}
    disabled={disabled}
    aria-pressed={value === gw}
    aria-disabled={disabled}
    tabIndex={disabled ? -1 : undefined}
    ...
  >
```

## Info

### IN-01: Test fixture `makeRollRow()` uses `as unknown as OCSRow` cast — hides missing required field

**File:** `src/components/transfers/OpportunityCostTable.test.tsx:8-21`

**Issue:** `makeRollRow()` returns a partial object cast to `OCSRow` via `as unknown as OCSRow`. The `bankAfter: 0` and `isAffordable: true` fields are provided, but the cast bypasses TypeScript's exhaustiveness check. If new required fields are added to `OCSRow`, this fixture silently remains incomplete and the tests will pass while the component potentially receives `undefined` for new required properties. This is a minor maintainability gap, but the test still exercises the render path correctly since the relevant new field (`targetGw`) is a prop not an `OCSRow` field.

**Fix:** Explicitly type the object and omit the cast, or ensure all required fields of `OCSRow` are provided. Alternatively, document the intentional incompleteness:

```ts
// Explicitly provide all OCSRow fields to prevent drift:
function makeRollRow(): OCSRow {
  return {
    kind: 'roll',
    label: 'Roll FT',
    transfers: [],
    xPtsGain: 0,
    xPtsGainNet: 0,
    xPtsGainPerGw: 0,
    breakEvenGws: null,
    cost: 0,
    bankAfter: 0,
    isAffordable: true,
    // isMarginal, disabledReason: intentionally omitted (optional fields)
  }
}
```

### IN-02: GWT-01 test uses `as any` for fixture data in `suggest-transfers.test.ts`

**File:** `src/lib/suggest-transfers.test.ts:507-510,534-537`

**Issue:** The Phase 101 GWT-01 tests inline fixture arrays cast as `any` to bypass `FixtureEntry` type checking:

```ts
fixtures: [
  { opponent_team: 'NEW', is_home: true, event_id: 33,
    difficulty_score: 0.2, difficulty_tier: 'easy', defensive_difficulty: 0.1 }
] as any,
```

This is the same test file already has a `makeFixture()` helper in `gw-xpts.test.ts` that constructs properly typed `FixtureEntry` objects. The `suggest-transfers.test.ts` tests for the same feature should use a typed fixture helper rather than `as any`, which would catch any future `FixtureEntry` field changes at compile time.

**Fix:** Extract a shared `makeFixtureEntry()` test helper (or reuse the pattern from `gw-xpts.test.ts`) and use it in both test files to avoid the `as any` escape hatch.

---

_Reviewed: 2026-05-12T17:48:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
