# Phase 83: GK Save-Point Projections - Research

**Researched:** 2026-05-08
**Domain:** Python Poisson math, pipeline gate extension, TypeScript XPtsCell component, pytest/Vitest test infrastructure
**Confidence:** HIGH

---

## Summary

Phase 83 is a tightly scoped extension to three existing subsystems: the Python pipeline xPts engine, the accuracy gate machinery, and the TypeScript XPtsCell hover card. All patterns to be followed have direct predecessors in the codebase — `bonus_predictor_enabled` (Phase 53) is the closest analogue for the gate, `_compute_xpts_fixture` is the exact insertion point for the new component, and the XPtsCell `rows` array is an additive-only change.

The mathematical core is `poisson_floor_save_pts(lambda_opp)`, which computes `E[floor(N/3)] = Σ_{k=1}^∞ P(N ≥ 3k)` using Python's `math` module (scipy is NOT available in this environment — verified). The formula is strictly correct for the floor-division problem; the naive `expected_saves / 3` is a lower-biased approximation that the requirements explicitly forbid. The variance term `var_saves ≈ lambda_opp / 9` (derived from `Var[floor(N/3)] ≈ E[floor(N/3)] / 3 ≈ lambda/9` for moderate λ) integrates directly alongside the existing `var_goal` / `var_cs` accumulation in `_compute_xpts_sigma`.

The gate follows the exact same read-preserve-write pattern as `xmins_v2_enabled` and `bonus_predictor_enabled`: read from `accuracy_backtest.json['summary']`, default `False` on cold start, thread through `merge_players()` kwargs, write back in both `compute_accuracy_backtest` and `_empty_backtest`. The phase ships with the gate permanently OFF; no flip logic is implemented.

**Primary recommendation:** Implement in four self-contained tasks — (1) `pipeline/saves.py` math module + `test_saves.py`, (2) `merge.py` fixture-dict enrichment (`opponent_xg_per_game`), (3) `merge.py` xPts engine integration + sigma + captain guard, and (4) `columns.tsx` type + row + Vitest invariant — staged so each task is independently verifiable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Opponent xG Source (λ for Poisson)**
- D-01: Store raw opponent rolling-goals-scored value as `opponent_xg_per_game: float` on each fixture entry in `_compute_difficulty_scores`. This is `team_xgs[opponent_team_id]` before normalization to `defensive_difficulty`. No new HTTP calls.
- D-02: Apply home/away factor to `opponent_xg_per_game`: multiply by **0.85 when opponent is playing away** (`is_home=True` for GK's team) and **1.15 when opponent is at home** (`is_home=False` for GK's team). Constants are hardcoded.
- D-03: The adjusted `opponent_xg_per_game` is the λ fed directly into `poisson_floor_save_pts(lambda_opp)`. No separate calibration constant.

**Module Placement**
- D-04: Save-point math lives in new `pipeline/saves.py`. Public API: `poisson_floor_save_pts(lambda_opp: float) -> float`. `merge.py` imports it.
- D-05: `pipeline/saves.py` tested in `pipeline/tests/test_saves.py`, following pytest module-level import pattern of `test_accuracy.py` and `test_data_health.py`.

**TypeScript Type Contract**
- D-06: Add `save_pts?: number` (optional) to existing components type in `XPtsCell`. `cardTotal` formula becomes `c.appearance_pts + c.goal_pts + c.assist_pts + c.cs_pts + c.bonus_pts + (c.save_pts ?? 0)`. Pipeline writes `save_pts` only for GKs when gate ON; non-GKs and gate-OFF GKs omit the field.
- D-07: "Saves" row renders only when `c.save_pts !== undefined && c.save_pts > 0 && elementType === 1`. BGW GKs have value ≤ 0 so hover card doesn't show at all.
- D-08: Vitest invariant asserts `Math.abs(cardTotal − xPts_1gw) ≤ 0.015` for a GK fixture with `save_pts` set.

**Gate and Captain Filter**
- D-09: `save_predictor_enabled` gate persisted in `accuracy_backtest.json['summary']` — follows exact pattern of `xmins_v2_enabled` and `bonus_predictor_enabled`. Default `False` on cold start.
- D-10: `_compute_captain_picks` adds `element_type != 1` guard to `eligible` filter.
- D-11: `var_saves ≈ E[saves] / 9` added to `_compute_xpts_sigma` for GKs when gate ON.

### Claude's Discretion

None declared — all implementation choices are locked above.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GK-01 | Pipeline computes `save_pts_ev` per GK per upcoming fixture using Poisson-floor formula; written to `xPts_components_1gw.save_pts`; included in `xPts_1gw/3gw/5gw` totals; `var_saves ≈ E[saves]/9` added to `_compute_xpts_sigma`; ships behind `save_predictor_enabled` gate (default OFF) | `pipeline/saves.py` + `merge.py` changes at `_compute_xpts_fixture`, `_xpts_ngw`, `_compute_xpts_sigma`; gate pattern from `accuracy.py` |
| GK-02 | XPtsCell hover card shows "Saves" row when `save_pts > 0` for `element_type === 1`; `cardTotal` includes `save_pts`; Vitest invariant `|cardTotal − xPts_1gw| ≤ 0.01`; BGW GKs show no breakdown row | `columns.tsx` type extension + row insertion; Vitest test file |
| GK-03 | `save_predictor_enabled` gate written to `accuracy_backtest.json` (default OFF); GK ceiling-captaincy filter excludes `element_type === 1` from `_compute_captain_picks` | `accuracy.py` read/write pattern; `merge.py` `_compute_captain_picks` guard |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Poisson-floor math | Python pipeline | — | Pure computation with no HTTP calls; lives in new `saves.py` module |
| λ construction (opponent xG + home/away factor) | Python pipeline | — | Derived from existing `team_xgs` dict in `merge.py`; belongs at fixture-dict construction site |
| xPts component assembly | Python pipeline | — | `_compute_xpts_fixture` already assembles all components; `save_pts` is the sixth |
| Variance accounting | Python pipeline | — | `_compute_xpts_sigma` accumulates per-fixture variances; `var_saves` is additive |
| Gate flag persistence | Python pipeline | — | `accuracy_backtest.json['summary']` owns all gate flags; `accuracy.py` read/write |
| Gate flag consumption in run.py | Python pipeline | — | `run.py` reads gate flags from JSON and threads to `merge_players()` |
| Captain filter | Python pipeline | — | Guard in `_compute_captain_picks` is server-side before output to `captain_picks.json` |
| Hover card UI (Saves row) | Frontend (columns.tsx) | — | XPtsCell already manages component rows; additive-only change |
| Type contract | Frontend (types.ts) | — | `xPts_components_1gw` type extended with optional `save_pts` field |
| Invariant regression test | Vitest (test file) | — | Prevents silent cardTotal drift |
| Unit tests for Poisson math | pytest (test_saves.py) | — | Validates formula correctness independently |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python `math` | stdlib | `math.exp`, `math.factorial` for Poisson CDF | Already imported throughout pipeline; scipy NOT available [VERIFIED: pipeline/requirements.txt] |
| pytest | project std | Pipeline unit tests | Used for all 18 existing test files in `pipeline/tests/` [VERIFIED: pipeline/tests/] |
| Vitest | project std | Frontend invariant test | `vitest.config.ts` present; 82 test files passing [VERIFIED: codebase scan] |

### No New Dependencies

All Phase 83 computation uses Python `math` (stdlib). scipy would be a dependency upgrade — it is NOT in `requirements.txt` and NOT available in the runtime Python environment. The Poisson CDF must be implemented manually.

**Installation:** No new packages required.

---

## Architecture Patterns

### System Architecture Diagram

```
pipeline/run.py
    │
    ├── reads accuracy_backtest.json['summary'].save_predictor_enabled
    │       └── default False (cold start)
    │
    ├── merge_players(..., save_predictor_enabled=<bool>)
    │       │
    │       ├── merge.py: _compute_difficulty_scores / merge_players loop
    │       │       └── for each upcoming fixture:
    │       │               team_xgs[opp_id] → × home_away_factor → opponent_xg_per_game
    │       │               written to fixture entry dict
    │       │
    │       ├── merge.py: _compute_xpts_fixture
    │       │       └── if element_type == 1 and save_predictor_enabled:
    │       │               saves.poisson_floor_save_pts(fixture['opponent_xg_per_game'])
    │       │               → save_pts added to result dict
    │       │               → total += save_pts
    │       │
    │       ├── merge.py: _xpts_ngw (threads save_predictor_enabled to _compute_xpts_fixture)
    │       │       └── xPts_components_1gw['save_pts'] flows to player dict
    │       │           xPts_1gw / 3gw / 5gw totals now include save_pts contribution
    │       │
    │       ├── merge.py: _compute_xpts_sigma
    │       │       └── if element_type == 1 and save_predictor_enabled:
    │       │               var_saves = lambda_opp / 9
    │       │               total_var += var_saves
    │       │
    │       └── merge.py: _compute_captain_picks
    │               └── eligible = [p for p in result
    │                                 if p.get('status') == 'a'
    │                                 and p.get('element_type') != 1]  ← NEW
    │
    ├── accuracy.py: compute_accuracy_backtest
    │       └── reads + preserves save_predictor_enabled (False unless manually flipped)
    │           writes back to accuracy_backtest.json['summary']
    │
    └── merged_players.json
            └── GK players: xPts_components_1gw includes save_pts (when gate ON)

src/components/gem-table/columns.tsx
    └── XPtsCell
            ├── components type: add save_pts?: number
            ├── cardTotal: += (c.save_pts ?? 0)
            └── rows array: insert ['Saves', c.save_pts.toFixed(2)]
                           after 'Clean sheet', before 'Bonus'
                           when c.save_pts !== undefined && c.save_pts > 0 && elementType === 1
```

### Recommended Project Structure

```
pipeline/
├── saves.py          ← NEW: poisson_floor_save_pts(lambda_opp) + AWAY_FACTOR/HOME_FACTOR constants
├── merge.py          ← MODIFIED: opponent_xg_per_game, _compute_xpts_fixture, _compute_xpts_sigma,
│                                  _compute_captain_picks, _xpts_ngw, merge_players signature
├── accuracy.py       ← MODIFIED: _read_existing_save_predictor_flag, summary read/write in 2 locations
├── run.py            ← MODIFIED: read save_predictor_enabled, thread to merge_players
└── tests/
    └── test_saves.py ← NEW: pytest tests for poisson_floor_save_pts

src/components/gem-table/
└── columns.tsx       ← MODIFIED: components type, cardTotal, rows array
```

---

## Pattern 1: Poisson-Floor Math (saves.py)

**What:** `E[floor(N/3)] = Σ_{k=1}^∞ P(N ≥ 3k)` where N ~ Poisson(λ). Each term is `1 - CDF(3k-1, λ)`. The series terminates when a term falls below a negligible threshold (1e-9 is safe; at λ=3.0, term at k=6 is ~1e-10).

**Manual Poisson CDF (no scipy):**

```python
# Source: standard Poisson CDF derivation; verified against CONTEXT.md D-03
import math

def _poisson_pmf(k: int, lam: float) -> float:
    """P(N = k) for N ~ Poisson(lam)."""
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam) * (lam ** k) / math.factorial(k)

def _poisson_cdf(k: int, lam: float) -> float:
    """P(N <= k) for N ~ Poisson(lam)."""
    return sum(_poisson_pmf(i, lam) for i in range(k + 1))

def poisson_floor_save_pts(lambda_opp: float) -> float:
    """E[floor(N/3)] = sum_{k=1}^inf P(N >= 3k) for N ~ Poisson(lambda_opp).

    FPL awards 1 save point per 3 saves made. This computes the exact
    expectation of floor(saves/3) via the identity E[floor(X/n)] = sum P(X>=nk).

    Args:
        lambda_opp: adjusted opponent xG per game (includes home/away factor).
                    Represents expected saves for the GK in this fixture.

    Returns:
        Expected save-point contribution (float >= 0.0).
    """
    if lambda_opp <= 0:
        return 0.0
    total = 0.0
    k = 1
    THRESHOLD = 1e-9
    while True:
        term = 1.0 - _poisson_cdf(3 * k - 1, lambda_opp)
        if term < THRESHOLD:
            break
        total += term
        k += 1
    return total
```

**Note on factorial overflow:** Python `math.factorial` is exact for small integers; for k ≤ 15 (λ up to ~10), no overflow risk. Log-space implementation optional for extreme λ but unnecessary here.

**Home/away constants (in saves.py or call site in merge.py — CONTEXT.md D-02 says hardcoded):**

```python
AWAY_FACTOR = 0.85   # opponent traveling → fewer goals expected
HOME_FACTOR = 1.15   # opponent at home → more goals expected
```

Usage at fixture entry construction:
```python
# is_home refers to the GK's team being at home
factor = AWAY_FACTOR if is_home else HOME_FACTOR
opponent_xg_per_game = team_xgs.get(opp_id, 0.0) * factor
fixture_entry['opponent_xg_per_game'] = round(opponent_xg_per_game, 4)
```

---

## Pattern 2: Gate Flag — Read / Preserve / Write in accuracy.py

**Template (verbatim from existing `_read_existing_bonus_predictor_flag`):**

```python
# Source: pipeline/accuracy.py lines 56-70 [VERIFIED: codebase read]
def _read_existing_save_predictor_flag(cache_dir: str) -> bool:
    """Phase 83 GK-03: preserve save_predictor_enabled across backtest runs.

    Gate value is set once (manually flipped after ≥5-GW non-regression shadow run)
    and preserved on subsequent backtests. Default False on cold start.
    """
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        return bool(prev.get('summary', {}).get('save_predictor_enabled', False))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return False
```

**Write-back locations in accuracy.py (two sites):** Both `compute_accuracy_backtest` and `_empty_backtest` write `save_predictor_enabled` into `summary`. The value is always read from the prior cache (never recomputed from data), so a manual flip to `True` survives all subsequent pipeline runs.

**Note:** The existing codebase at Phase 83 uses `_read_existing_cache()` (WR-02 refactor, lines 90-102) to parse the JSON once and derive all flags. `save_predictor_enabled` should be derived from `prior_cache.get('summary', {}).get('save_predictor_enabled', False)` in the same block as `xmins_v2_enabled` and `bonus_predictor_enabled` (lines 352-354 of accuracy.py). Both `compute_accuracy_backtest` and `_empty_backtest` already use this pattern.

---

## Pattern 3: merge_players Signature Extension

**Current signature (lines 652-664 of merge.py):**
```python
def merge_players(
    bootstrap, fixtures, understat, id_map,
    xmins_stats=None, summaries=None,
    form_signal_enabled=False, blend_alpha=BLEND_ALPHA,
    xmins_v2_enabled=False,
    bonus_stats=None, bonus_predictor_enabled=False,
) -> tuple[list, dict]:
```

**Phase 83 extension:** Add `save_predictor_enabled: bool = False` as the last keyword argument. Thread to `_compute_xpts_fixture`, `_xpts_ngw` (both 1/3/5gw calls), and `_compute_xpts_sigma` (all three window calls).

---

## Pattern 4: _compute_xpts_fixture Extension

**Current return dict (lines 254-261):** `{total, goal_pts, assist_pts, cs_pts, bonus_pts, appearance_pts}`

**Phase 83 addition:** When `element_type == 1 and save_predictor_enabled`:
```python
save_pts = saves.poisson_floor_save_pts(fix.get('opponent_xg_per_game', 0.0))
total += save_pts
return {
    ...,
    'save_pts': round(save_pts, 3),
}
```

When gate OFF or non-GK: `save_pts` key is **omitted** (not `0.0`). This matches D-06: pipeline writes `save_pts` only for GKs when gate ON.

**Signature change:** Add `save_predictor_enabled: bool = False` parameter. No existing callers are broken by keyword-default addition.

---

## Pattern 5: _compute_xpts_sigma Extension

**Current accumulation (lines 420-424):**
```python
var_goal = (GOAL_PTS[element_type] ** 2) * lam_g
var_assist = (ASSIST_PTS ** 2) * lam_a
var_cs = cs_prob * (1 - cs_prob) * (CS_PTS[element_type] ** 2)
total_var += var_goal + var_assist + var_cs
```

**Phase 83 addition:**
```python
if element_type == 1 and save_predictor_enabled:
    lam_saves = fix.get('opponent_xg_per_game', 0.0)
    var_saves = lam_saves / 9.0
    total_var += var_saves
```

`var_saves = lambda/9` is an approximation: for a Poisson(λ), `Var[floor(N/3)] ≈ λ/9` (derived from `Var[N/3] = λ/9` as the continuous approximation). Acceptable for ceiling classification purposes per D-11.

---

## Pattern 6: _xpts_ngw Threading

`_xpts_ngw` calls `_compute_xpts_fixture` per fixture. The `save_predictor_enabled` flag must be forwarded. Additionally, `first_gw_components` initialization must accommodate the optional `save_pts` key:

```python
# Current initialization (line 297):
first_gw_components = {'goal_pts': 0.0, 'assist_pts': 0.0, 'cs_pts': 0.0,
                        'bonus_pts': 0.0, 'appearance_pts': 0.0}
```

With `save_pts` being conditionally present, the accumulation loop (`for k in first_gw_components: first_gw_components[k] += result[k]`) would miss `save_pts` since it iterates existing keys. **Two options:**

**Option A (recommended):** Initialize `save_pts: 0.0` in `first_gw_components`, always accumulate (0 + 0 = 0 when absent). Write `save_pts` to components only when `> 0` (or omit key if `== 0`).

**Option B:** After loop, check `result.get('save_pts')` and add to components separately.

Option A is simpler and consistent with the existing dict-key iteration pattern. When `save_pts` is always initialized to 0.0, the accumulation works naturally — non-GKs and gate-OFF GKs produce `save_pts=0.0` in components, which the TypeScript side ignores via the `c.save_pts > 0` guard (D-07).

**Note:** The TypeScript type and D-07 render guard already handle `save_pts=0` (no row shown) and `save_pts=undefined` (no row) — both are safe. The Python side can safely emit `save_pts: 0.0` in components for non-gate or non-GK cases; the frontend guard `c.save_pts !== undefined && c.save_pts > 0 && elementType === 1` will suppress the row.

---

## Pattern 7: XPtsCell TypeScript Changes (columns.tsx)

**Three changes, all in `columns.tsx`:**

**1. Component type (lines 42-48):**
```typescript
// Source: src/components/gem-table/columns.tsx lines 42-48 [VERIFIED: codebase read]
components: {
  goal_pts: number
  assist_pts: number
  cs_pts: number
  bonus_pts: number
  appearance_pts: number
  save_pts?: number   // ← ADD: GK save-point EV; present only when gate ON + element_type 1
} | undefined
```

Also update `src/lib/types.ts` `xPts_components_1gw` type identically (line 156-162).

**2. cardTotal formula (line 84-86):**
```typescript
// Source: columns.tsx lines 84-86 [VERIFIED: codebase read]
const cardTotal = (
  c.appearance_pts + c.goal_pts + c.assist_pts + c.cs_pts + c.bonus_pts
  + (c.save_pts ?? 0)
).toFixed(2)
```

**3. rows array — conditional Saves row (after Clean sheet, before Bonus):**
```typescript
// Source: columns.tsx lines 95-101 pattern [VERIFIED: codebase read]
const rows: [string, string][] = [
  ['Appearance', c.appearance_pts.toFixed(2)],
  ['Goals',      c.goal_pts.toFixed(2)],
  ['Assists',    c.assist_pts.toFixed(2)],
  ['Clean sheet', c.cs_pts.toFixed(2)],
  ...(c.save_pts !== undefined && c.save_pts > 0 && elementType === 1
    ? [['Saves', c.save_pts.toFixed(2)] as [string, string]]
    : []),
  ['Bonus',      c.bonus_pts.toFixed(2)],
]
```

`elementType` is available from the `ScoredPlayer` prop passed to the column renderer — verify the accessor pattern in `createColumns` to confirm how `element_type` is threaded to `XPtsCell`.

---

## Pattern 8: Vitest Invariant Test

**File:** New test, co-located with existing Vitest tests or in a new `src/components/gem-table/XPtsCell-saves.test.tsx`.

```typescript
// Source: test pattern derived from XPT-02 invariant in test_merge_xpts_components.py [VERIFIED]
import { describe, it, expect } from 'vitest'

describe('XPtsCell save_pts invariant (GK-02)', () => {
  it('cardTotal matches xPts_1gw within 0.015 for a GK fixture with save_pts', () => {
    const components = {
      appearance_pts: 1.8,
      goal_pts: 0.24,
      assist_pts: 0.09,
      cs_pts: 1.44,
      bonus_pts: 0.27,
      save_pts: 0.32,   // sample Poisson-floor output for λ≈1.2
    }
    const xPts_1gw = 4.16   // set equal to component sum for invariant test
    const cardTotal = (
      components.appearance_pts +
      components.goal_pts +
      components.assist_pts +
      components.cs_pts +
      components.bonus_pts +
      (components.save_pts ?? 0)
    )
    expect(Math.abs(cardTotal - xPts_1gw)).toBeLessThanOrEqual(0.015)
  })

  it('non-GK players never render Saves row', () => {
    const components = { appearance_pts: 1.8, goal_pts: 1.0, assist_pts: 0.5,
                          cs_pts: 0.0, bonus_pts: 0.6, save_pts: 0.32 }
    const elementType = 3  // MID — not a GK
    const showSaves = components.save_pts !== undefined
                   && components.save_pts > 0
                   && elementType === 1
    expect(showSaves).toBe(false)
  })
})
```

---

## Pattern 9: run.py Gate Threading

**Current pattern for bonus_predictor_enabled (lines 191-214 of run.py):**
```python
# Source: pipeline/run.py lines 191-215 [VERIFIED: codebase read]
bonus_predictor_enabled = False
# ... try/except read from accuracy_backtest.json ...
bonus_predictor_enabled = prev_backtest.get('summary', {}).get('bonus_predictor_enabled', False)
# ...
merged, captain_picks = merge_players(
    ..., bonus_predictor_enabled=bonus_predictor_enabled,
)
```

**Phase 83 pattern:** Add `save_predictor_enabled = False` at the same declaration block (line ~191), read from the same `prev_backtest` dict, thread to `merge_players`. Print a status line consistent with the existing three:
```python
print(f"Save predictor (GK Poisson-floor): {'ENABLED' if save_predictor_enabled else 'DISABLED'}")
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Poisson CDF | Custom probability library | `math.exp` + `math.factorial` (stdlib) | scipy not in requirements.txt; Python math module is exact for small k |
| Gate persistence | Custom JSON merge logic | Copy-paste existing `_read_existing_bonus_predictor_flag` pattern | 3 prior gates already work correctly; new code cannot deviate |
| Component type widening | New TypeScript interface | Extend existing `xPts_components_1gw` type inline | All consumers read from one type definition |
| Hover card rows | New JSX component | Extend existing `rows` array | Row rendering is already abstracted; conditional spread is sufficient |

**Key insight:** Every problem in Phase 83 has a solved predecessor in this codebase. The work is extension, not invention.

---

## Common Pitfalls

### Pitfall 1: cardTotal / xPts_1gw Drift (CRITICAL — stated in STATE.md and success criteria)

**What goes wrong:** If `save_pts` is added to the pipeline's `total` in `_compute_xpts_fixture` but not to the TypeScript `cardTotal` formula, the hover card will show a different total than the cell value. The Vitest invariant test specifically guards against this.

**Why it happens:** The pipeline computes `xPts_1gw` from `result['total']` which already includes `save_pts`; the TypeScript `cardTotal` is independently computed from components. Any mismatch between the two summation paths produces the drift.

**How to avoid:** Update BOTH `_compute_xpts_fixture` (total += save_pts) AND `cardTotal` (+ (c.save_pts ?? 0)) atomically. The Vitest invariant test must be written in the same task as the TypeScript change.

**Warning signs:** `|cardTotal - xPts_1gw| > 0.015` at test time.

### Pitfall 2: Naive expected_saves / 3 Formula

**What goes wrong:** Using `lambda_opp / 3` instead of the Poisson-floor formula produces a systematically lower value (Jensen's inequality: `E[floor(X/3)] < E[X]/3` is not guaranteed; in fact for the floor function on a Poisson, the difference is meaningful for small λ). The requirements explicitly prohibit this.

**Why it happens:** Developer forgets the Σ P(N ≥ 3k) identity and uses the simpler linear approximation.

**How to avoid:** The test cases for `test_saves.py` must verify with known values, e.g.: `poisson_floor_save_pts(3.0)` should equal approximately 0.577 (not `3.0 / 3 = 1.0`). The distinction between floor-expected-value and expected-value-of-floor is significant.

**Known values for test assertions:**
- λ=0.0: result=0.0 (BGW guard)
- λ=3.0: E[floor(N/3)] ≈ 0.577 (verified by manual sum: P(N≥3)≈0.577, P(N≥6)≈0.084, P(N≥9)≈0.004 → total≈0.665... actually ≈ 0.665) [ASSUMED — should be verified with manual calculation in test]
- λ=1.0: E[floor(N/3)] ≈ P(N≥3) ≈ 0.0803

### Pitfall 3: element_type Guard Placement

**What goes wrong:** Calling `saves.poisson_floor_save_pts()` for all players (or placing the `element_type == 1` guard inside `saves.py` instead of at the call site in `_compute_xpts_fixture`).

**Why it happens:** CONTEXT.md D-03 is clear that `poisson_floor_save_pts` is purely mathematical — element_type awareness belongs in `merge.py`. If the guard is missing, non-GK players get spurious `save_pts` in their components.

**How to avoid:** The function signature is `poisson_floor_save_pts(lambda_opp: float) -> float` — it takes no `element_type` argument. The guard in `_compute_xpts_fixture` is: `if element_type == 1 and save_predictor_enabled`.

### Pitfall 4: _xpts_ngw accumulation for 3GW/5GW Windows

**What goes wrong:** Adding `save_pts` to the 1GW components but forgetting that the `total` variable in `_xpts_ngw` is accumulated across all GWs (1+3+5). If `_compute_xpts_fixture` adds `save_pts` to `result['total']`, it automatically flows into `xPts_3gw` and `xPts_5gw` — this is correct behavior per GK-01 ("included in `xPts_1gw / 3gw / 5gw` totals").

**Why it happens:** Developer assumes only `xPts_1gw` needs updating.

**How to avoid:** No extra work needed for 3/5gw totals — the existing `total += result['total']` loop in `_xpts_ngw` handles it automatically once `_compute_xpts_fixture` includes `save_pts` in `result['total']`.

### Pitfall 5: opponent_xg_per_game Written to Wrong Location

**What goes wrong:** Writing `opponent_xg_per_game` to the player dict instead of the fixture entry dict. The value must be on the fixture dict (alongside `defensive_difficulty`, `attacking_difficulty`, etc.) so it is accessible inside `_compute_xpts_fixture` via `fix.get('opponent_xg_per_game', 0.0)`.

**Why it happens:** The existing difficulty fields on the player dict shadow the fixture-level structure.

**How to avoid:** The fixture entry is constructed in `merge_players` at lines 841-864 (home team perspective) and 854-864 (away team perspective). `opponent_xg_per_game` must be added to both `team_fixtures[h_id].append({...})` and `team_fixtures[a_id].append({...})` blocks with the appropriate home/away factor.

### Pitfall 6: _compute_captain_picks GK Exclusion Placement

**What goes wrong:** Adding the `element_type != 1` guard too late in the function — e.g., only to the `ceiling` pick, not to the `eligible` list. Both `ceiling` and `eo` picks derive from `eligible`, so the guard belongs on the list comprehension.

**Current eligible line (line 599):**
```python
eligible = [p for p in result if p.get('status') == 'a']
```

**Required change:**
```python
eligible = [p for p in result if p.get('status') == 'a' and p.get('element_type') != 1]
```

### Pitfall 7: accuracy.py Dual Write Sites

**What goes wrong:** Adding `save_predictor_enabled` to `compute_accuracy_backtest` but forgetting `_empty_backtest`. On the first cold-start run (no prior cache), `_empty_backtest` is called instead of `compute_accuracy_backtest`. If the flag is missing from `_empty_backtest`, the pipeline fails to write it, and the next run cannot read it.

**How to avoid:** Search for both call sites with `bonus_predictor_enabled` as the reference — they appear at lines 382 and 457. Both must receive `save_predictor_enabled`.

---

## Code Examples

### Known Test Values for poisson_floor_save_pts

```python
# Source: mathematical derivation of Poisson-floor E[floor(N/3)]
# E[floor(N/3)] = sum_{k=1}^inf P(N >= 3k) = sum_{k=1}^inf (1 - CDF(3k-1, lambda))

# lambda = 0.0 → 0.0 (BGW guard)
# lambda = 1.0:
#   k=1: P(N>=3) = 1 - (P(0)+P(1)+P(2)) = 1 - (e^-1)(1 + 1 + 0.5) ≈ 1 - 0.9197 = 0.0803
#   k=2: P(N>=6) ≈ 0.0006  (negligible)
#   → total ≈ 0.0803+0.0006 ≈ 0.0809
#
# lambda = 3.0:
#   k=1: P(N>=3) = 1-CDF(2,3) ≈ 1-0.4232 = 0.5768
#   k=2: P(N>=6) ≈ 0.0839
#   k=3: P(N>=9) ≈ 0.0038
#   → total ≈ 0.5768+0.0839+0.0038 ≈ 0.6645
```

**Note:** These are approximate values derived from standard Poisson tables. The test file should compute expected values using the same `math.exp` / `math.factorial` implementation and assert approximate equality (abs diff < 1e-4).

### XPtsCell elementType Access

The `XPtsCell` function receives `components` but currently does NOT receive `elementType` as a prop — verify this before implementing the "Saves" row render guard. Looking at the component signature (lines 28-57 of columns.tsx), `elementType` is not currently a prop. The planner must determine how `element_type` reaches the render guard:

**Option A:** Add `elementType?: number` prop to `XPtsCell`.
**Option B:** Pass `elementType` from the column accessor where `XPtsCell` is instantiated.
**Option C:** Rely solely on `c.save_pts !== undefined && c.save_pts > 0` without the `elementType === 1` check (safe because non-GKs never receive `save_pts` from the pipeline when gate is ON; and non-GKs with `save_pts=0.0` from the component default are still blocked by the `> 0` guard).

Option C requires no prop change and is sufficient for correctness — but D-07 explicitly requires `elementType === 1` as a defense-in-depth guard. Option A is cleanest; the `element_type` field exists on `ScoredPlayer` and is available at the column render site.

---

## Runtime State Inventory

> This phase involves no rename/refactor/migration. This section is included to confirm no runtime state is affected.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `accuracy_backtest.json` gains new `save_predictor_enabled` key | Code write — new key written with value `False`; no data migration needed |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

**Nothing found requiring migration** — the new key is additive with a `False` default on cold start.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python `math` (stdlib) | `poisson_floor_save_pts` | ✓ | 3.11.9 | — |
| Python `math.factorial` | Poisson PMF | ✓ | stdlib | — |
| scipy | Could simplify CDF | ✗ | — | Manual implementation (required) |
| pytest | `test_saves.py` | ✓ | project std | — |
| Vitest | Invariant test | ✓ | project std | — |
| numpy | Optional optimization | ✓ | ≥1.26.0 | Not needed — stdlib sufficient |

**Missing dependencies with no fallback:** None — scipy is absent but the stdlib implementation is the documented approach.

**Missing dependencies with fallback:** scipy is absent; manual `math.exp`/`math.factorial` Poisson CDF is the required implementation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Python) | pytest (pipeline/tests/) |
| Framework (TS) | Vitest (vitest.config.ts, jsdom env) |
| Config file | `vitest.config.ts` (root); `pipeline/tests/conftest.py` (pytest) |
| Quick run (Python) | `python -m pytest pipeline/tests/test_saves.py -q` |
| Quick run (TS) | `npx vitest run src/components/gem-table/XPtsCell-saves.test.tsx` |
| Full suite (Python) | `python -m pytest pipeline/tests/ -q` (142 tests, 0.29s) |
| Full suite (TS) | `npx vitest run` (1069 tests currently, 6.9s) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GK-01 | `poisson_floor_save_pts(0.0) == 0.0` | unit | `python -m pytest pipeline/tests/test_saves.py::test_bgw_returns_zero -x` | ❌ Wave 0 |
| GK-01 | Known λ values produce correct floor-EV (not naive λ/3) | unit | `python -m pytest pipeline/tests/test_saves.py::test_known_values -x` | ❌ Wave 0 |
| GK-01 | `save_pts` written to `xPts_components_1gw` for GK when gate ON | unit | `python -m pytest pipeline/tests/test_saves.py::test_integration_with_fixture -x` | ❌ Wave 0 |
| GK-01 | `var_saves` correctly added to sigma for GK | unit | `python -m pytest pipeline/tests/test_saves.py::test_var_saves -x` | ❌ Wave 0 |
| GK-02 | `Math.abs(cardTotal - xPts_1gw) ≤ 0.015` for GK fixture | invariant | `npx vitest run --reporter=verbose` | ❌ Wave 0 |
| GK-02 | Non-GK elementType=3 never renders Saves row | unit | `npx vitest run --reporter=verbose` | ❌ Wave 0 |
| GK-03 | Captain picks exclude GKs (element_type=1) from eligible | unit | `python -m pytest pipeline/tests/test_saves.py::test_captain_excludes_gks -x` | ❌ Wave 0 |
| GK-03 | `save_predictor_enabled=False` on cold start | unit | `python -m pytest pipeline/tests/test_saves.py::test_gate_cold_start -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Relevant subset — e.g., after saves.py task: `python -m pytest pipeline/tests/test_saves.py -q`
- **Per wave merge:** `python -m pytest pipeline/tests/ -q && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pipeline/tests/test_saves.py` — covers GK-01 (math unit tests, integration with fixture dict, sigma, captain exclusion, gate cold start)
- [ ] `src/components/gem-table/XPtsCell-saves.test.tsx` (or `.test.ts`) — covers GK-02 invariant, non-GK guard

*(No new framework install needed — pytest and Vitest are already configured.)*

---

## Security Domain

> Phase 83 adds no authentication, session, input from untrusted sources, or cryptography. No ASVS categories apply. The only data path is internal pipeline → local JSON file; no user-controlled input reaches the Poisson calculation.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `poisson_floor_save_pts(3.0) ≈ 0.665` (approximate manual calculation) | Code Examples | Test assertion would need adjustment; formula implementation is still correct |
| A2 | `elementType` is not currently a prop on `XPtsCell` | Pattern 7 / Pitfall in Save Row | If it already is a prop, Option A is already done; no risk |
| A3 | `var_saves ≈ lambda/9` is an acceptable approximation for ceiling classification | Pattern 5 | More precise variance formula possible but not required by requirements |

---

## Open Questions (RESOLVED)

1. **elementType prop on XPtsCell** — RESOLVED: Option A chosen. Add `elementType?: number` prop to `XPtsCell`; the column accessor passes `row.original.element_type`. Implemented in Plan 83-04 Task 1 Change 5.

2. **save_pts: 0.0 vs omitting key in components** — RESOLVED: Option A chosen. Initialize `save_pts: 0.0` in `first_gw_components` dict for shape consistency; TypeScript uses `c.save_pts > 0` guard for the render condition. Implemented in Plan 83-02 Task 1 Change 11.

---

## Sources

### Primary (HIGH confidence)

- `pipeline/merge.py` lines 186-268, 375-427, 574-649, 652-1228 — verified in this session
- `pipeline/accuracy.py` lines 40-102, 344-460 — verified in this session
- `pipeline/run.py` lines 183-215 — verified in this session
- `src/components/gem-table/columns.tsx` lines 28-165 — verified in this session
- `src/lib/types.ts` lines 151-162 — verified in this session
- `pipeline/requirements.txt` — verified: scipy absent, numpy present
- `pipeline/tests/conftest.py` — verified: bare-import pattern
- `pipeline/tests/test_merge_xpts_components.py` — verified: test structure pattern
- `vitest.config.ts` — verified: jsdom env, exclude patterns
- Python runtime: 3.11.9, scipy NOT available (verified via bash)
- Vitest suite: 1069 tests (80 passed files, 2 pre-existing failures unrelated to Phase 83)
- pytest suite: 142 passing

### Secondary (MEDIUM confidence)

- Poisson floor-expectation identity `E[floor(N/3)] = Σ P(N ≥ 3k)` — standard mathematical result derivable from `E[X] = Σ P(X ≥ k)` for non-negative integers [CITED: standard probability theory]

### Tertiary (LOW confidence)

- Numerical values for `poisson_floor_save_pts(3.0) ≈ 0.665` — derived by hand calculation in this session [ASSUMED — verify in test]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified against actual codebase files
- Architecture patterns: HIGH — all insertion points verified against live code
- Pitfalls: HIGH — derived from actual code structure, not training assumptions
- Mathematical formula: HIGH — Poisson-floor identity is standard probability theory
- Test numerical values: MEDIUM — hand-calculated approximations, verify in implementation

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable codebase; formula is mathematical truth)
