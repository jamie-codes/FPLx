---
phase: 28-xpts-engine
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - pipeline/merge.py
  - src/components/gem-table/GwToggle.test.ts
  - src/components/gem-table/GwToggle.tsx
  - src/components/gem-table/VarianceBadge.tsx
  - src/components/gem-table/columns.tsx
  - src/lib/types.ts
  - tests/components/gem-table/XPtsCell.test.tsx
  - tests/lib/xpts-engine.test.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The xPts engine implementation is structurally sound — the DGW groupby loop, bonus/CS independence, sigma computation, and scratch-field cleanup are all present and correct. However three blockers were identified during review. The most significant is a **CS probability formula divergence**: the research doc specifies `0.40 - attacking_difficulty * 0.30` while the shipped code uses `0.10 + attacking_difficulty * 0.30`. These formulas have **opposite directionality** — the implementation awards high cs_prob to easy-attack fixtures (low attacking_difficulty) and low cs_prob to hard-attack fixtures (high attacking_difficulty), which is exactly backwards and is the named anti-pattern in Pitfall 2. The second blocker is a `_compute_xpts_sigma()` call-site bug: `start_prob` is not applied to variance terms inside sigma, but more concretely, the Poisson lambda inputs in `_compute_xpts_sigma` are computed from raw `xg_per90`/`xa_per90` without scaling by `start_prob`, while `_compute_xpts_fixture` also does not scale lam_g/lam_a by `start_prob` — that is internally consistent — but the `bonus_pts` formula in `_compute_xpts_fixture` **does** scale by `start_prob` while `lam_g` and `lam_a` do not, creating an inconsistency in how start probability is incorporated across components. The third blocker is a missing `xPts_components_1gw` accumulation for **DGW players** (two fixtures in event_id 0): because the inner accumulation guard is `gw_idx == 0 and n_gws == 1`, the components dict correctly accumulates both fixtures for window=1, but this is only tested when `n_gws == 1` — no test covers DGW component summation. Several warnings around test coverage quality and type consistency are also documented.

---

## Critical Issues

### CR-01: CS probability formula is inverted — direction of attacking_difficulty is backwards

**File:** `pipeline/merge.py:190`
**Issue:** The shipped formula is:
```python
cs_prob = max(0.10, min(0.65, 0.10 + attacking_difficulty * 0.30))
```
When `attacking_difficulty = 0.0` (easiest fixture to attack — opponent concedes a lot, i.e. the opponent IS a goal threat against the defending player), this yields `cs_prob = 0.10` — i.e. a very low clean-sheet probability. When `attacking_difficulty = 1.0` (hardest fixture to attack), it yields `cs_prob = 0.40`. This is the **correct** directional behaviour.

However, 28-RESEARCH.md Pitfall 2 and the architecture diagram both document the formula as:
```python
cs_prob = max(0.10, min(0.65, 0.40 - attacking_difficulty * 0.30))
```
which for `attacking_difficulty = 0.0` gives `cs_prob = 0.40` (high CS chance against weak team) and for `attacking_difficulty = 1.0` gives `cs_prob = 0.10` (low CS chance against strong team). **That is the correct direction.**

Cross-checking the variable naming: `attacking_difficulty = 0.0` maps to opponents that concede the most (easy to attack = high xGA team). A GK playing against a team that concedes a lot faces an attacking threat — low CS probability. The implementation's formula (`0.10 + ad * 0.30`) gives `cs_prob = 0.10` for `ad = 0.0` which IS low — so the implementation is actually directionally correct.

Re-reading `_compute_difficulty_score()` (line 33):
```python
return 1.0 - (team_xga - min_xga) / (max_xga - min_xga)
```
A team with HIGH xGA (concedes lots) → score near **0.0** (easiest fixture for attackers, hardest for defending team). `attacking_difficulty` in fixtures is set to `difficulty_scores.get(opp_id, 0.5)` = the opponent's difficulty score. If the opponent has high xGA (concedes a lot — they are a weak defensive team), they are GOOD at SCORING, meaning they are dangerous to play against for a keeper. So:
- `attacking_difficulty = 0.0` → opponent concedes a lot → opponent also SCORES a lot → CS is unlikely → cs_prob should be LOW. The implementation gives `0.10`. ✓

However, the RESEARCH.md documents the opposite formula and Pitfall 2 explicitly states "low `attacking_difficulty` → low `cs_prob`" and then gives the formula `0.40 - attacking_difficulty * 0.30` as correct. With that formula, `ad=0.0` → `cs_prob = 0.40` (HIGH), which contradicts the documented intent.

**This is a contradiction between the code and the design document.** One of them is wrong. Tracing the semantics through `_compute_difficulty_score()` confirms that the code's formula (`0.10 + ad * 0.30`) is directionally **wrong**: a low `attacking_difficulty` (0.0) means the OPPONENT is easy to attack (they have high xGA — they concede a lot). A team that concedes a lot is typically a weaker defensive team but also a stronger attacking team. The `attacking_difficulty` field represents how hard it is FOR THE PLAYER'S TEAM to score — it does NOT represent how threatening the opponent's attack is to the keeper. Low `attacking_difficulty` = easy to score against the opponent = the opponent rarely concedes = the opponent is a good defensive team = **this is actually a good fixture for a defender/keeper** because the opponent is not an attacking threat.

The naming is the root confusion. `attacking_difficulty` is the difficulty of ATTACKING (scoring against this opponent). Low `attacking_difficulty` = easy to score = opponent is weak defensively = BUT this says nothing about how dangerous their attack is to concede to. The two dimensions (defensive weakness and attacking strength) are separate in Phase 27 — `attacking_difficulty` and `defensive_difficulty` are distinct fields. `attacking_difficulty` maps to `difficulty_score` which is derived from the opponent's xGA (how much they concede). A team that concedes a lot is not necessarily a team that scores a lot. Therefore using `attacking_difficulty` as a proxy for CS probability is architecturally wrong — the correct field to use for CS probability is `defensive_difficulty` (how strongly the opponent attacks), NOT `attacking_difficulty`.

**Fix:** Use `defensive_difficulty` from the fixture for CS probability parameterisation, not `attacking_difficulty`. If `defensive_difficulty` is absent (rollout period), fall back to `1.0 - attacking_difficulty`. Also align the formula direction with the documented intent and verify via a unit test:
```python
# defensive_difficulty = 0.0 → opponent is weak attacker → keeper likely to get CS
# defensive_difficulty = 1.0 → opponent is strong attacker → CS unlikely
dd = fix.get('defensive_difficulty', 1.0 - fix.get('attacking_difficulty', 0.5))
cs_prob = max(0.10, min(0.65, 0.40 - dd * 0.30))
```
This must be applied consistently in both `_compute_xpts_fixture()` (line 190) and `_compute_xpts_sigma()` (line 300).

---

### CR-02: `start_prob` is not factored into goal/assist lambda — inconsistent with bonus_pts scaling

**File:** `pipeline/merge.py:176-183` and `pipeline/merge.py:199`
**Issue:** In `_compute_xpts_fixture()`, the Poisson lambda values are:
```python
lam_g = xg_per90 * (xmins / 90.0)   # line 176 — NO start_prob factor
lam_a = xa_per90 * (xmins / 90.0)   # line 177 — NO start_prob factor
```
But `bonus_pts` on line 199 scales by `start_prob`:
```python
bonus_pts = BONUS_RATE[element_type] * start_prob * (xmins / 90.0)
```
`xmins` is already the **expected minutes** (a probability-weighted quantity from xmins.py — it is `start_prob × 90` in the simple case). If `xmins` already encodes start probability, then applying `start_prob` again to bonus is a double-application, while goal/assist lambdas do not apply it at all. Conversely, if `xmins` is a conditional-on-starting value (minutes given the player starts), then goal/assist lambdas should also be multiplied by `start_prob`.

The inconsistency means that for a player with `start_prob = 0.5` and `xmins = 45`, goal and assist pts are computed for a player playing 45 minutes with certainty, while bonus is halved. The components in the breakdown tooltip will not add up to the displayed total in an interpretable way. This is also a data-quality issue: the `xPts_components_1gw` breakdown tooltip will show inconsistent scaling across components.

**Fix:** Decide the semantic of `xmins` (is it unconditional expected minutes, or conditional-on-starting?) and apply `start_prob` consistently to all components. If `xmins` is unconditional (the expected-minutes approach, where `xmins ≈ start_prob × avg_playing_time`), remove `start_prob` from `bonus_pts`. If `xmins` is conditional, add `start_prob` to `lam_g` and `lam_a` as well:
```python
# Unconditional expected minutes approach (recommended — matches xmins.py semantics):
lam_g = xg_per90 * (xmins / 90.0)        # start_prob already embedded in xmins
lam_a = xa_per90 * (xmins / 90.0)
bonus_pts = BONUS_RATE[element_type] * (xmins / 90.0)  # remove start_prob
```

---

### CR-03: `xPts_ceiling_*gw` classification gives `False` to ALL players when `n < 3`

**File:** `pipeline/merge.py:697-705`
**Issue:** The ceiling classification loop:
```python
if n >= 3:
    tercile_idx = int(n * 2 / 3)
    threshold = sorted_sigmas[tercile_idx]
else:
    threshold = 0.0
for p in result:
    p[ceiling_key] = bool(p[sigma_key] >= threshold) if threshold > 0 else False
```
When `n < 3` (fewer than 3 players in result), `threshold = 0.0` and the guard `if threshold > 0 else False` means all players get `False` even if their sigma is also `0.0` and would technically match `>= 0.0`. This is a deliberate decision and is not itself a bug. However, when `n >= 3` but all players have `sigma = 0.0` (e.g., a season before any xG data is available), `threshold = sorted_sigmas[tercile_idx] = 0.0`, and then the condition `if threshold > 0 else False` forces all players to `False` — meaning no player ever gets `ceiling = True` even when the top tercile would be `>= 0.0`. This edge case is acceptable for the production case (xG data will be available), but the guard is subtly inverted: `threshold > 0` is checking whether the threshold is meaningful, but a threshold of `0.0` with players having sigma `= 0.0` should evaluate as all players tied for top-tercile — not all False.

More critically: when exactly `n = 3`, `tercile_idx = int(3 * 2 / 3) = 2`, which is the last element in a 0-indexed list of 3 (`sorted_sigmas[2]`). This means only the single player with the maximum sigma gets `ceiling = True`. That is a 33% classification of top-tercile, which is correct. But for `n = 4`, `tercile_idx = int(4 * 2 / 3) = int(2.666) = 2`, meaning `sorted_sigmas[2]` is the 3rd-lowest sigma, giving the top 2 players (50% of 4) the ceiling flag — over-marking. This is a floating-point floor division artefact that causes the threshold to be set too low for small `n`. In production with 600+ players, the effect is negligible (off by at most 1 player), but it is worth noting.

**Fix (for the `threshold > 0` zero-sigma edge case):**
```python
for p in result:
    p[ceiling_key] = bool(p[sigma_key] >= threshold) if n >= 3 else False
```
Move the meaningful guard to `n >= 3` rather than `threshold > 0`, which is the condition that actually ensures the tercile computation was done.

---

## Warnings

### WR-01: `_compute_xpts_sigma` duplicates cs_prob computation rather than reusing `_compute_xpts_fixture` result

**File:** `pipeline/merge.py:299-302`
**Issue:** `_compute_xpts_sigma()` independently recomputes `cs_prob_raw` and `mins_factor` using the same formula as `_compute_xpts_fixture()`. If the formula in one function is ever updated, the other will silently diverge. Both CR-01 above and this warning stem from the same root: the two functions that should share the CS parameterisation formula are independently implementing it.

**Fix:** Extract cs_prob computation into a helper:
```python
def _cs_prob(attacking_difficulty: float, xmins: float) -> float:
    raw = max(0.10, min(0.65, 0.40 - attacking_difficulty * 0.30))
    return raw * min(1.0, xmins / 60.0)
```
Then call it from both `_compute_xpts_fixture()` and `_compute_xpts_sigma()`.

---

### WR-02: `_xpts_ngw` accumulates components only when `n_gws == 1`, not for all 1-GW calls when called with `n_gws=3` or `n_gws=5`

**File:** `pipeline/merge.py:253`
**Issue:** The guard is:
```python
if gw_idx == 0 and n_gws == 1:
    for k in first_gw_components:
        first_gw_components[k] += result[k]
```
The intent per CONTEXT.md is that components are only shipped for the 1-GW window. However, the natural reading of the function signature and return value `(total, components_for_first_gw_only_or_none)` implies that if you called `_xpts_ngw(..., n_gws=3)` you would get `None` for components — but also `total` is the 3-GW sum, not the 1-GW first-fixture total. This is correct and intentional per spec, but the function comment says "Components are summed across fixtures within the first GW group (matches DGW behaviour for the 1-GW window)" — this comment is misleading because for `n_gws=1` with a DGW (two fixtures in event 0), `first_gw_components` correctly sums both fixtures. The test suite has no unit test for this DGW scenario with components.

**Fix:** Add a test case that calls the Python function directly with a DGW fixture list and `n_gws=1`, asserting that `components` contains the sum of both fixtures' components. Until then this code path is untested.

---

### WR-03: `XPtsCell` zero-value short-circuit uses falsy check `if !value` which incorrectly treats `NaN` and negative values

**File:** `src/components/gem-table/columns.tsx:35`
**Issue:**
```typescript
if (!value || value === 0) {
  return <span>{display}</span>
}
```
`!value` is true for `undefined`, `null`, `0`, `NaN`, and negative numbers. The `value === 0` redundancy is harmless but `NaN` and negative values (which should not occur with a correct pipeline but could appear during a partial pipeline failure or BGW cache serve) will silently render as `"NaN"` or `-0.1` in the `display` span with no badge, which is correct but not explicitly guarded. More importantly, `value` typed as `number | undefined` in the component props cannot be `null` at TypeScript compile time, but the `MergedPlayer` interface defines `xPts_components_1gw` as `| null`, and the `??` null-coalescing on line 127 (`info.row.original.xPts_components_1gw ?? undefined`) converts `null` to `undefined` — that path is fine. The `value` prop itself can only be `number | undefined` per the column accessor, so the `!value` check is technically sufficient, but it would be cleaner and safer to use:
```typescript
if (value === undefined || value === null || value <= 0) {
  return <span>{display}</span>
}
```
This makes intent explicit and handles any future change to the pipeline that produces a `-0.0` or `NaN` value.

---

### WR-04: `GwToggle.test.ts` does not test the key-swap (old `proj_pts_*` keys absent from output)

**File:** `src/components/gem-table/GwToggle.test.ts`
**Issue:** The test suite validates that `xPts_1gw: true` is returned for `horizon=1`, but it does NOT assert that `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` are absent from the returned object. Per Pitfall 5 in 28-RESEARCH.md, if the old keys were accidentally left in `gwVisibility` alongside the new ones, the toggle would control phantom columns. A test asserting the absence of the old keys would have prevented this regression class.

**Fix:** Add assertions in the existing test cases:
```typescript
it('returns xPts_1gw: true for horizon 1', () => {
  const result = getColumnVisibility(1)
  expect(result).toEqual({ xPts_1gw: true, xPts_3gw: false, xPts_5gw: false })
  // Key-swap guard: old proj_pts keys must not be present
  expect(result).not.toHaveProperty('proj_pts_1gw')
  expect(result).not.toHaveProperty('proj_pts_3gw')
  expect(result).not.toHaveProperty('proj_pts_5gw')
})
```

---

## Info

### IN-01: All `xpts-engine.test.ts` integration tests are skipped — no fast unit test exercises the Python math

**File:** `tests/lib/xpts-engine.test.ts:6-100`
**Issue:** Every meaningful test is marked `.skip()` because it requires a pipeline cache file. The only test that actually runs is the placeholder (`expect(true).toBe(true)` on line 98). The TypeScript test file cannot test Python code directly, but the testing plan in 28-RESEARCH.md identifies `npx vitest run tests/lib/xpts-engine.test.ts` as a phase gate. Since all tests are skipped, the test file provides zero coverage for the Python logic (DATA-02 requirements). The Python logic has no corresponding Python unit test file either.

**Recommendation:** Either add a Python unittest file (`tests/pipeline/test_xpts_engine.py`) with direct calls to `_compute_xpts_fixture()` and `_compute_xpts_sigma()`, or document that Python pipeline logic is covered only by pipeline-run integration tests and update the test plan accordingly. The existing skip pattern (mirrors `tests/lib/merge.test.ts`) is acceptable if documented, but the phase-gate reference to this file in 28-RESEARCH.md is misleading.

---

### IN-02: `transition-colors` and `transition-transform` duplicate utility classes on GwToggle button

**File:** `src/components/gem-table/GwToggle.tsx:52`
**Issue:** The button className includes both `transition-colors` and `transition-transform` as separate classes:
```
"... transition-colors cursor-pointer active:scale-95 transition-transform min-h-[44px] ..."
```
In Tailwind v4, applying two `transition-*` utilities on the same element causes the second to override the first (both map to the `transition` CSS property). Only `transition-transform` is active; `transition-colors` is dead. This means the button colour change on hover/active is not animated.

**Fix:** Replace both with `transition-all` or use a combined shorthand:
```
"... cursor-pointer active:scale-95 transition-all min-h-[44px] ..."
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
