---
phase: 111-fixture-heatmap-planner-cross-position-fixes-v1-20
reviewed: 2026-05-15T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/club-form/FixtureHeatMap.tsx
  - src/components/club-form/FixtureHeatMap.test.tsx
  - src/lib/club-form.ts
  - src/lib/club-form.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 111 (Gap-Closure Plan 04): Code Review Report

**Reviewed:** 2026-05-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This review covers the gap-closure plan (Plan 04) for Phase 111: the partially-played DGW cell fix (CR-01 closure) and the fallback GW sort hardening (CR-02 closure).

**CR-01 is closed.** The render tree in `HeatMapRow` now correctly handles `fixtures.length === 1 && playedFixtures.length >= 1` via the final fall-through branch at lines 166–181. That branch builds `playedSuffix` from all played fixtures and appends it to the tooltip (`"OPP (H/A) — 0.dd / MCI (H) — Played"`). Two new tests at lines 501–530 exercise both the single-played and double-played variants of this state. The code and tests are consistent with the expected tooltip format.

**CR-02 is closed.** The fallback derivation at `club-form.ts:140` now applies `.sort((a, b) => a.id - b.id)` before `slice(-1)`, so the highest GW id is picked regardless of FPL API event array ordering. The CR-02 test at line 192 passes a descending-order events array and confirms the correct GW is selected.

Two warnings and two info items remain.

---

## Warnings

### WR-01: DGW-played cell renders only two opponent labels when three fixtures played (TGW all-played)

**File:** `src/components/club-form/FixtureHeatMap.tsx:99-122`

**Issue:** The `fixtures.length === 0 && playedFixtures.length >= 2` branch (fully-played multi-fixture cell) always renders exactly two `<span>` labels — `playedFixtures[0]` and `playedFixtures[1]`. When `playedFixtures.length === 3` (a triple-gameweek where all three fixtures have been played), the gradient at line 104 correctly produces a three-stop stripe referencing `colours[2]`, but the cell body shows no label for the third opponent. This is an asymmetry with the upcoming-DGW branch (lines 137–164), which has an explicit guard at line 158–162 to render the third label when `fixtures.length >= 3`.

In practice a TGW-all-played state is rare but reachable. The third opponent appears correctly in the tooltip (line 105–107 maps all `playedFixtures`) but is absent from the cell body, leaving a visually unlabelled gradient stripe.

**Fix:** Add a third label span inside the DGW-played `<td>` to mirror the upcoming-DGW branch:

```tsx
<td
  key={gw}
  className="relative px-0 py-0 text-center min-w-[48px] h-10 opacity-40"
  style={{ background: gradient }}
  title={tooltip}
>
  <span className="absolute top-0 left-1 text-[10px] font-mono leading-none pt-0.5 text-zinc-900 dark:text-zinc-100">
    {playedFixtures[0].opponent_team}
  </span>
  <span className="absolute bottom-0 right-1 text-[10px] font-mono leading-none pb-0.5 text-zinc-900 dark:text-zinc-100">
    {playedFixtures[1].opponent_team}
  </span>
  {playedFixtures.length >= 3 && (
    <span className="absolute bottom-0 left-1 text-[10px] font-mono leading-none pb-0.5 text-zinc-900 dark:text-zinc-100">
      {playedFixtures[2].opponent_team}
    </span>
  )}
</td>
```

---

### WR-02: Dead null-coalescing guard `(diff ?? 0)` on a required `number` field

**File:** `src/components/club-form/FixtureHeatMap.tsx:168`

**Issue:** `diff` is derived from `f.attacking_difficulty` or `f.defensive_difficulty`, both of which are typed as required `number` on `ClubFormFixture` (see `src/lib/types.ts:489-490`). The expression `(diff ?? 0).toFixed(2)` applies a null-coalescing fallback to a value that can never be `null` or `undefined` per the type contract.

The guard is harmless at runtime, but it signals to future readers that `diff` might be absent — which is false. A developer who later changes `ClubFormFixture.attacking_difficulty` to `number | null` would then get the wrong impression that this code already handles that case, when in fact it would silently suppress a `null` with `0` rather than failing visibly. It also previously appeared as optional (`attacking_difficulty?: number`) in the `FixtureEntry` type and may be a copy-paste remnant from that era; `ClubFormFixture` has always been required.

**Fix:** Remove the fallback:

```ts
// line 167-168 — before:
const diff = mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty
const baseTooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${(diff ?? 0).toFixed(2)}`

// after:
const diff = mode === 'ATT' ? f.attacking_difficulty : f.defensive_difficulty
const baseTooltip = `${f.opponent_team} (${f.is_home ? 'H' : 'A'}) — ${diff.toFixed(2)}`
```

---

## Info

### IN-01: Dead `?? []` guards on `current_gw_played` — field is required on `ClubForm`

**File:** `src/components/club-form/FixtureHeatMap.tsx:228,245`

**Issue:** Two sites use `(t.current_gw_played ?? [])`:

- Line 228: `...data.flatMap(t => (t.current_gw_played ?? []).map(f => f.event_id))`
- Line 245: `for (const f of (t.current_gw_played ?? [])) {`

`ClubForm.current_gw_played` is typed as a required (non-optional) `ClubFormFixture[]` in `src/lib/types.ts:504`. The `?? []` guards are never exercised and mislead readers into thinking the field might be absent or null. This is the same pattern flagged in IN-01 of the prior review — it was likely written before the field was promoted to required.

**Fix:** Remove the `?? []` null-coalescing guards:

```ts
// line 228 — after:
...data.flatMap(t => t.current_gw_played.map(f => f.event_id)),

// line 245 — after:
for (const f of t.current_gw_played) {
```

---

### IN-02: No test coverage for TGW all-played render path (three entries in `playedFixtures`)

**File:** `src/components/club-form/FixtureHeatMap.test.tsx`

**Issue:** The Phase 111 FIX-01 tests cover: single played, BGW, DGW fully-played (two entries), and the partially-played DGW (one upcoming + one or two played). The branch at line 99 is entered when `playedFixtures.length >= 2`, which includes `length === 3`. No test validates the three-entry case — specifically, that `colours[2]` is correctly computed and the gradient renders without a runtime error (no `undefined` access). A future refactor to the tier-map or colour lookup could break this path silently.

**Fix:** Add a test for the TGW-all-played cell:

```tsx
it('FIX-01: TGW all-played cell uses three-stop gradient with opacity-40', () => {
  const data: ClubForm[] = [
    team(1, 'ARS', [], [
      fix({ opp: 'MCI', home: true,  gw: 35, tier: 'easy' }),
      fix({ opp: 'CHE', home: false, gw: 35, tier: 'hard' }),
      fix({ opp: 'LIV', home: true,  gw: 35, tier: 'medium' }),
    ]),
  ]
  mockUseClubForm.mockReturnValue({ data, isLoading: false, error: null })
  const { container } = render(<FixtureHeatMap />)
  const cell = container.querySelector('tbody tr:nth-child(1) td')!
  expect(cell.className).toMatch(/opacity-40/)
  const style = cell.getAttribute('style') ?? ''
  expect(style).toContain('linear-gradient')
  // Three-stop gradient — both 33% stops should appear
  expect(style).toContain('33%')
  // Tooltip should include all three opponents
  const title = cell.getAttribute('title') ?? ''
  expect(title).toContain('MCI')
  expect(title).toContain('CHE')
  expect(title).toContain('LIV')
})
```

---

_Reviewed: 2026-05-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
