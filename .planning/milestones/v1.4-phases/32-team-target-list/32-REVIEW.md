---
phase: 32-team-target-list
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pipeline/merge.py
  - src/lib/xgi.ts
  - src/lib/types.ts
  - src/components/club-form/FixtureEaseRankingPanel.tsx
  - tests/lib/xgi.test.ts
  - tests/components/club-form/FixtureEaseRankingPanel.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase adds Phase 32 TGT-01/TGT-02 features: a TARGET badge and expandable player
table in `FixtureEaseRankingPanel`, a new `computeXgiInvolvement` function in `xgi.ts`,
and supporting fields in `types.ts` and `merge.py`. The TypeScript code and tests are
generally solid. The critical issue is a pre-existing logic bug in `merge.py` that
makes the Phase 29 regression signal feature non-functional during most of the season.
Three warnings cover a type-safety gap in the TARGET badge, inconsistent fallback
behaviour between two projected-points fields, and a weak test assertion. Two info
items cover a stale comment and a redundant type cast.

---

## Critical Issues

### CR-01: `min_minutes=900` threshold makes regression signal always `None` outside DGW periods

**File:** `pipeline/merge.py:334`
**Issue:** `_compute_regression_signal` sums `minutes` over `played` (history entries
in the last 5 unique GW rounds with minutes > 0) and returns `(None, None)` when
`total_mins < min_minutes` (default 900). In a standard season week without DGWs, the
theoretical maximum across 5 rounds is 5 × 90 = 450 minutes — far below the 900
threshold. This means `total_mins < 900` is always true outside DGW-heavy stretches,
so `regression_signal` and `actual_vs_xg_delta` are never written to any player dict
during normal single-fixture periods. The entire Phase 29 regression signal feature is
silently non-functional for most of the season.

The docstring says "Window = last `window_gws` unique round values" but the threshold
was apparently intended for season-total usage, not a windowed sum. The appropriate
windowed threshold is approximately 450 (5 × 90 min — i.e., played in most of the
5 GWs), or expressed as a percentage of possible minutes. The current value of 900
should be something closer to 270 (3 full games out of 5) to match the spirit of the
feature.

**Fix:**
```python
# Change the default from 900 to a window-appropriate threshold.
# 270 = 3 full appearances out of 5 GWs (3 × 90 min).
def _compute_regression_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,   # was 900 — that only triggers in DGW periods
    threshold: float = 0.5,
) -> tuple:
```
If the intent truly was 900 minutes (e.g., to require DGW activity before signalling),
add a comment explicitly explaining that and ensure callers are aware that signals are
DGW-only. The current code has no such comment and the feature is presented as
general-purpose.

---

## Warnings

### WR-01: TARGET badge reads optional `attacking_difficulty` without undefined guard

**File:** `src/components/club-form/FixtureEaseRankingPanel.tsx:83`
**Issue:** The TARGET badge condition is:
```typescript
const isTarget = team.upcoming_fixtures
  .slice(0, 5)
  .filter((f) => f.attacking_difficulty < 0.5).length >= 4
```
`team.upcoming_fixtures` is `ClubFormFixture[]` and `ClubFormFixture.attacking_difficulty`
is `number` (required), so there is no runtime undefined risk today. However, the
source fixture data flows through `FixtureEntry` elsewhere in the codebase where
`attacking_difficulty` is typed `number | undefined` (optional — "Phase 27 pipeline
rollout"). If future code paths supply `FixtureEntry[]` instead of `ClubFormFixture[]`
to this panel (e.g., if the data shape ever regresses), every fixture would fail the
`< 0.5` comparison silently and no team would ever get a TARGET badge.

The comparison `undefined < 0.5` evaluates to `false` in JavaScript without throwing,
making this a silent failure mode with no observable error.

**Fix:**
Add an explicit guard, making the intended required-ness clear and resilient to future
type drift:
```typescript
const isTarget = team.upcoming_fixtures
  .slice(0, 5)
  .filter((f) => (f.attacking_difficulty ?? 1) < 0.5).length >= 4
```
Alternatively, widen `ClubFormFixture.attacking_difficulty` intent is already required —
confirm that and add a lint rule or runtime assertion to catch the mismatch early.

---

### WR-02: Inconsistent fallback `start_prob` used for `proj_pts` vs. xPts when `xmins_stats` absent

**File:** `pipeline/merge.py:810-828`
**Issue:** When `xmins_stats` is not provided, two different fallback values are used:
- `sp = (starts / current_gw)` for `proj_pts_3gw` / `proj_pts_5gw` (lines 814, 816-817)
- `player_start_prob = 0.0` for `xPts_3gw` / `xPts_5gw` (line 827)

A player with 20 starts over 25 GWs would get `proj_pts_3gw ≈ ppg * 0.8 * ...` but
`xPts_3gw = 0.0`. These two "next 3 GW projected points" fields will show contradictory
values in the output JSON (one non-zero, one zero) without any signal to the consumer
that they differ because of a missing dependency.

The `xmins_stats` argument is documented as optional for backward compatibility, but
this divergence makes the fallback semantics unreliable.

**Fix:**
Either use the same `sp` estimate for both paths when `xmins_stats` is absent:
```python
# ---- Minutes risk fields (MINS-01) ----
if xmins_stats and fpl_id in xmins_stats:
    xm = xmins_stats[fpl_id]
    player_xmins = xm['xmins']
    player_start_prob = xm['start_prob']
    player_mins_risk = xm['mins_risk']
else:
    player_xmins = sp * 90.0   # derive xmins from the same sp estimate
    player_start_prob = sp     # was 0.0 — inconsistent with proj_pts fallback
    player_mins_risk = 'injured'
```
Or document the divergence explicitly in the `merge_players` docstring with a note that
xPts fields will all be 0.0 when `xmins_stats` is absent.

---

### WR-03: xgi.test.ts multi-team test uses symmetric player contributions — asymmetric case untested

**File:** `tests/lib/xgi.test.ts:41-51`
**Issue:** The "isolates each player's share to their own team total" test uses two
team-20 players where both happen to have identical xGI values (player 2: xg=1, xa=1
→ xgi=2; player 3: xg=2, xa=0 → xgi=2). The assertions `expect(result.get(2)).toBeCloseTo(0.5)` and `expect(result.get(3)).toBeCloseTo(0.5)` are both correct, but the test never validates that asymmetric shares (e.g., 0.25 / 0.75) are correctly isolated between teams. The comment reads "team 20 total = 4, share = 0.5" identically for both players, hiding that the xgi contributions happen to be equal by coincidence, not by design.

A bug where the denominator used global-team total instead of per-team total could
still produce passing results in this symmetric case.

**Fix:**
Add (or modify) the test to use clearly asymmetric contributions:
```typescript
it('isolates each player\'s share to their own team total (multi-team, asymmetric)', () => {
  const players = [
    makePlayer({ id: 1, team: 10, xg: 5, xa: 5 }),  // team 10 total = 10, share = 1.0
    makePlayer({ id: 2, team: 20, xg: 1, xa: 0 }),  // team 20 total = 4, share = 0.25
    makePlayer({ id: 3, team: 20, xg: 3, xa: 0 }),  // team 20 total = 4, share = 0.75
  ]
  const result = computeXgiInvolvement(players)
  expect(result.get(1)).toBeCloseTo(1.0, 5)
  expect(result.get(2)).toBeCloseTo(0.25, 5)
  expect(result.get(3)).toBeCloseTo(0.75, 5)
})
```

---

## Info

### IN-01: Stale line-number reference in `_xpts_ngw` docstring

**File:** `pipeline/merge.py:245`
**Issue:** The docstring says "Mirrors `_proj_pts_ngw()` loop structure (lines 104-133)."
`_proj_pts_ngw` actually starts at line 115, not line 104. Line 104 is inside
`_compute_difficulty_scores`. The reference is stale.

**Fix:** Update the comment:
```python
    Mirrors _proj_pts_ngw() loop structure (lines 115-144).
```

---

### IN-02: `easeKey` uses `as keyof ClubForm` type assertion to bypass compile-time safety

**File:** `src/components/club-form/FixtureEaseRankingPanel.tsx:35`
**Issue:** The `easeKey` function returns `` `${prefix}_ease_${win}gw` as keyof ClubForm ``.
The cast suppresses TypeScript's ability to verify the generated key is a valid
`ClubForm` property. While the 6 valid combinations (`attacking_ease_1gw`, etc.) are
all present on `ClubForm`, the cast means a future rename or typo in the template
string would compile cleanly and only fail at runtime.

**Fix:**
Replace the assertion with an explicit lookup table, which is both type-safe and
readable:
```typescript
const EASE_KEYS: Record<Mode, Record<Win, keyof ClubForm>> = {
  ATT: { 1: 'attacking_ease_1gw', 3: 'attacking_ease_3gw', 5: 'attacking_ease_5gw' },
  DEF: { 1: 'defensive_ease_1gw', 3: 'defensive_ease_3gw', 5: 'defensive_ease_5gw' },
}

function easeKey(mode: Mode, win: Win): keyof ClubForm {
  return EASE_KEYS[mode][win]
}
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
