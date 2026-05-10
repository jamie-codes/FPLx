# Phase 90: Monte Carlo Simulation Pipeline - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 5
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pipeline/simulate.py` | service | batch/transform | `pipeline/simulate.py` (self — extend in place) | exact |
| `pipeline/tests/test_simulate.py` | test | batch | `pipeline/tests/test_simulate.py` (self — extend in place) | exact |
| `pipeline/run.py` | orchestrator | request-response | `pipeline/run.py` lines 190-220 (self — small patch) | exact |
| `pipeline/accuracy.py` | service | batch/transform | `pipeline/accuracy.py` (self — small patch) | exact |
| `src/lib/types.ts` | model | transform | `src/lib/types.ts` lines 183-190 (self — extend) | exact |

All five files are self-referential: the analog IS the file being modified. Pattern
extraction below focuses on the exact code sections to replicate or extend.

---

## Pattern Assignments

### `pipeline/simulate.py` (service, batch/transform)

**Analog:** `pipeline/simulate.py` — extend in place.

**Imports pattern** (lines 30-35):
```python
from itertools import groupby

import numpy as np

# Phase 61 MC-01 — fixed simulation budget (D-04)
N_SIMS = 10_000
```
Phase 90 replaces the `N_SIMS` constant with the env-var form. Add `import os` and
replace lines 34-35 with:
```python
import os

# Phase 90 MC-01 — configurable simulation budget; minimum 1000 enforced (D-02)
N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))
MC_SEED = int(os.environ.get('MC_SEED', 42))
```

**`_cs_prob_sim` — do not change** (lines 45-53):
```python
def _cs_prob_sim(dd: float, xmins: float, mins_60_prob: float | None) -> float:
    """Bernoulli CS probability per fixture (mirrors merge.py:_cs_prob lines 141-146).

    D-02: inline re-implementation, no import from merge.py.
    D-03: xmins_v2_enabled gate handled by caller (passes mins_60_prob or None).
    """
    cs_prob_raw = max(0.10, min(0.65, 0.40 - dd * 0.30))
    mins_factor = mins_60_prob if mins_60_prob is not None else min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor
```

**BGW short-circuit pattern — carry unchanged** (lines 63-68 and 84-85):
```python
xmins = p.get('xmins', 0.0) or 0.0
start_prob = p.get('start_prob', 0.0) or 0.0

# BGW short-circuit (D-08)
if xmins <= 0 or start_prob <= 0:
    return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}
```
For the 5-GW variant the BGW return dict also needs `xPts_5gw_p10`, `xPts_5gw_p50`,
`xPts_5gw_p90`, and `rank_trajectory` absent (not zero-filled) — return only the 4
existing scalar zeroes; the `rank_trajectory` cross-player step in `compute_simulations`
will skip players with no cumulative data.

**Core 1-GW loop to extend into 5-GW** (lines 78-111):
```python
# Current 1-GW structure (the break exits after first group):
first_gw = []
for _eid, group in groupby(fixtures, key=lambda f: f.get('event_id')):
    first_gw = list(group)
    break

if not first_gw:
    return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}

lam_g = xg * (xmins / 90.0)
lam_a = xa * (xmins / 90.0)
bonus_det = BONUS_RATE[et] * (xmins / 90.0)
appear_det = start_prob * 2

total_pts = np.zeros(N_SIMS)
for fix in first_gw:
    dd = fix.get('defensive_difficulty', 0.5)
    cs_prob = _cs_prob_sim(dd, xmins, m60)
    goals = rng.poisson(lam_g, size=N_SIMS)
    assists = rng.poisson(lam_a, size=N_SIMS)
    cs = rng.binomial(1, cs_prob, size=N_SIMS)
    total_pts += (
        goals * GOAL_PTS[et]
        + assists * ASSIST_PTS
        + cs * CS_PTS[et]
        + bonus_det
        + appear_det
    )

return {
    'blank_prob': round(float(np.mean(total_pts <= 2)), 3),
    'haul_prob':  round(float(np.mean(total_pts >= 10)), 3),
    'p10_pts':    round(float(np.percentile(total_pts, 10)), 3),
    'p90_pts':    round(float(np.percentile(total_pts, 90)), 3),
}
```
The 5-GW extension:
- Collect all groupby results into a list first: `groups = [(eid, list(g)) for eid, g in groupby(fixtures, key=lambda f: f.get('event_id'))][:5]`
- Iterate `groups` (not `first_gw`) accumulating `gw_pts` arrays into `total_pts_by_gw`
- BGW gap = fewer than 5 groups → pad `total_pts_by_gw` with `np.zeros(N_SIMS)` to reach length 5
- `cumulative = np.cumsum(np.column_stack(total_pts_by_gw), axis=1)` — shape `(N_SIMS, 5)`
- Return existing 4 fields unchanged PLUS:
  - `'xPts_5gw_p10': round(float(np.percentile(cumulative[:, -1], 10)), 3)`
  - `'xPts_5gw_p50': round(float(np.percentile(cumulative[:, -1], 50)), 3)`
  - `'xPts_5gw_p90': round(float(np.percentile(cumulative[:, -1], 90)), 3)`
  - `'_p50_by_horizon': [round(float(np.percentile(cumulative[:, h], 50)), 3) for h in range(5)]`
    (scratch field, stripped in `compute_simulations` before appending to result)

**`compute_simulations` signature and RNG seeding** (lines 115-146):
```python
def compute_simulations(merged: list, xmins_v2_enabled: bool) -> list:
    rng = np.random.default_rng()   # Phase 61 — unseeded
    result = []
    active_count = 0
    for player in merged:
        p = dict(player)
        sim = _simulate_player(p, xmins_v2_enabled, rng)
        p.update(sim)
        # D-05: overwrite analytical sigma-derived ceiling with MC-derived p90
        p['xPts_90th_1gw'] = sim['p90_pts']
        if sim['blank_prob'] != 1.0:
            active_count += 1
        result.append(p)
    print(f"MC simulations: {active_count} active players ({N_SIMS:,} sims each)")
    return result
```
Phase 90 changes:
- Replace `np.random.default_rng()` with `np.random.default_rng(seed=MC_SEED)` — seeded from module constant
- Signature stays `(merged: list, xmins_v2_enabled: bool) -> list` — call site in `run.py` is unchanged
- After the per-player loop, add the `rank_trajectory` cross-player computation block
- Strip `_p50_by_horizon` scratch field with `p.pop('_p50_by_horizon', None)` before `result.append(p)`

**`rank_trajectory` cross-player computation** — insert after the per-player loop in `compute_simulations`:
```python
# rank_trajectory: for each of 5 GW horizons, rank each player's p50 cumulative xPts
# within their position group (1=GK, 2=DEF, 3=MID, 4=FWD), normalize to [0,1].
# D-03: rank_trajectory[i] = percentile rank at GW i+1 cumulative horizon.
from collections import defaultdict
pools = [defaultdict(list) for _ in range(5)]  # one dict per horizon
for p in result:
    for h in range(5):
        pos = p.get('element_type', 3)
        val = p.get('_p50_by_horizon', [0.0] * 5)[h] if '_p50_by_horizon' in p else 0.0
        pools[h][pos].append((val, p))
for h in range(5):
    for pos, pool in pools[h].items():
        pool.sort(key=lambda x: x[0])
        n = len(pool)
        for rank_idx, (_, p) in enumerate(pool):
            if '_rank_trajectory' not in p:
                p['_rank_trajectory'] = [0.0] * 5
            p['_rank_trajectory'][h] = rank_idx / max(n - 1, 1)
# Write rank_trajectory and strip scratch fields
for p in result:
    if '_rank_trajectory' in p:
        p['rank_trajectory'] = p.pop('_rank_trajectory')
    p.pop('_p50_by_horizon', None)
```

---

### `pipeline/tests/test_simulate.py` (test, batch)

**Analog:** `pipeline/tests/test_simulate.py` — extend in place.

**Import pattern** (lines 1-6):
```python
"""Pytest unit tests for compute_simulations and _simulate_player (Phase 61 MC-01)."""

import pytest

# Bare import (conftest.py injects pipeline/ into sys.path)
from simulate import compute_simulations, _simulate_player
```

**`_fix` and `_player` fixture helpers** (lines 9-33) — extend `_player` with 5 GW fixtures:
```python
def _fix(defensive_difficulty=0.5, event_id=38):
    return {'defensive_difficulty': defensive_difficulty, 'event_id': event_id}


def _player(
    element_type=3,
    xmins=70.0,
    start_prob=0.85,
    xg_per90=0.5,
    xa_per90=0.4,
    fixtures=None,
    mins_60_prob=None,
    xPts_90th_1gw=5.0,
):
    """Minimal merged player dict for simulation tests."""
    return {
        'element_type': element_type,
        'xmins': xmins,
        'start_prob': start_prob,
        'xg_per90': xg_per90,
        'xa_per90': xa_per90,
        'fixtures': fixtures if fixtures is not None else [_fix()],
        'mins_60_prob': mins_60_prob,
        'xPts_90th_1gw': xPts_90th_1gw,
    }
```
For 5-GW test cases, construct fixtures with distinct event_ids. Example:
```python
def _five_gw_fixtures(dd=0.5):
    return [_fix(dd, eid) for eid in [38, 39, 40, 41, 42]]
```

**Existing test shape to replicate** (lines 36-43, 52-66, 69-79):
```python
def test_bgw_shortcircuit():
    p = _player(xmins=0.0)
    result = compute_simulations([p], xmins_v2_enabled=False)
    assert result[0]['blank_prob'] == 1.0
    assert result[0]['haul_prob'] == 0.0
    assert result[0]['p10_pts'] == 0.0
    assert result[0]['p90_pts'] == 0.0
```

**Pattern for new test cases** — copy the shape above exactly. The 6 new cases:
1. `test_5gw_percentile_invariants` — assert `r['xPts_5gw_p10'] <= r['xPts_5gw_p50'] <= r['xPts_5gw_p90']` and p50 within 5% of deterministic `xPts_5gw`
2. `test_5gw_bgw_zero_fill` — player with 3 fixture groups (BGWs at GW 4,5); assert `xPts_5gw_p50 < full_5gw_player['xPts_5gw_p50']`
3. `test_5gw_dgw_combine` — two fixtures with same event_id in GW 1; assert DGW p50 > single fixture p50
4. `test_iteration_count_gate` — set env var `MC_ITERATIONS=500`, reimport or monkeypatch `N_SIMS`; assert iteration count respects minimum (≥1000)
5. `test_seed_determinism` — call `compute_simulations` twice with `MC_SEED=42`; assert identical `xPts_5gw_p50`
6. `test_mc_enabled_off_skip` — use `unittest.mock.patch('run.compute_simulations')` to assert function is not called when `mc_enabled=False`

**conftest.py sys.path pattern** (lines 1-15 of `pipeline/tests/conftest.py`):
```python
import os
import sys

PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
```
No changes needed; new test cases benefit automatically.

---

### `pipeline/run.py` (orchestrator, request-response — small patch)

**Analog:** `pipeline/run.py` lines 188-220 — the `xmins_v2_enabled` gate pattern.

**Gate initialization pattern** (lines 188-192):
```python
form_signal_enabled = False
blend_alpha_used = 0.4
xmins_v2_enabled = False  # Phase 52 D-02 — default OFF
bonus_predictor_enabled = False  # Phase 53 BPS-01 — default OFF
save_predictor_enabled = False  # Phase 83 GK-03 — default OFF
```
Add `mc_enabled = False  # Phase 90 MC-01 — default OFF (D-01)` in this block.

**Gate read from `accuracy_backtest.json`** (lines 194-203):
```python
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
    blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
    xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
    bonus_predictor_enabled = prev_backtest.get('summary', {}).get('bonus_predictor_enabled', False)
    save_predictor_enabled = prev_backtest.get('summary', {}).get('save_predictor_enabled', False)
except (FileNotFoundError, json.JSONDecodeError):
    pass
```
Add inside the `try` block:
```python
mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)
```

**Print pattern** (lines 205-208):
```python
print(f"Form signal blend: {'ENABLED' if form_signal_enabled else 'DISABLED'} (alpha={blend_alpha_used})")
print(f"xMins v2 (mins_60_prob in _cs_prob): {'ENABLED' if xmins_v2_enabled else 'DISABLED'}")
print(f"Bonus predictor (per-player EV): {'ENABLED' if bonus_predictor_enabled else 'DISABLED'}")
print(f"Save predictor (GK Poisson-floor): {'ENABLED' if save_predictor_enabled else 'DISABLED'}")
```
Add: `print(f"MC simulation (5-GW uncertainty bands): {'ENABLED' if mc_enabled else 'DISABLED'}")`

**Gate call site** (line 220 — currently unconditional):
```python
merged = compute_simulations(merged, xmins_v2_enabled)   # line 220 — always called today
```
Phase 90 wraps this with the guard (D-01):
```python
if mc_enabled:
    merged = compute_simulations(merged, xmins_v2_enabled)
```

---

### `pipeline/accuracy.py` (service, batch/transform — small patch)

**Analog:** `pipeline/accuracy.py` — three distinct sections to patch.

**`_read_existing_*_flag` pattern** (lines 40-88) — used three times, all identical shape:
```python
def _read_existing_xmins_v2_flag(cache_dir: str) -> bool:
    """Phase 52 D-02: preserve xmins_v2_enabled across backtest runs.
    ...
    """
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        return bool(prev.get('summary', {}).get('xmins_v2_enabled', False))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return False
```
Add `_read_existing_mc_enabled_flag` by copying this exactly, changing the key to `'mc_enabled'` and the docstring phase reference to `Phase 90 MC-01`.

**Summary dict write** (lines 394-413):
```python
return {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'gws_covered': target_gws_desc,
    'summary': {
        'xpts_hit_rate': round(overall_xpts_hit, 4),
        'xpts_blended_hit_rate': round(overall_xpts_blended_hit, 4),
        'form_signal_enabled': form_signal_enabled,
        'xmins_v2_enabled': xmins_v2_enabled,
        'bonus_predictor_enabled': bonus_predictor_enabled,
        'save_predictor_enabled': save_predictor_enabled,
        'news_flag_enabled': True,
        'blend_alpha_used': BLEND_ALPHA,
        'mid_tier_hit_rate': round(overall_mid_tier_hit, 4),
        'mid_tier_blended_hit_rate': round(overall_mid_tier_blended_hit, 4),
        'gws': gw_summaries,
    },
    ...
}
```
Add `'mc_enabled': mc_enabled,  # Phase 90 MC-01: gate for 5-GW MC simulation; preserved across runs` after `save_predictor_enabled` line.

**`_empty_backtest` cold-start pattern** (lines 444-493):
```python
def _empty_backtest(cache_dir: str = '') -> dict:
    prior_cache = _read_existing_cache(cache_dir)
    xmins_v2_enabled = bool(prior_cache.get('summary', {}).get('xmins_v2_enabled', False))
    bonus_predictor_enabled = bool(prior_cache.get('summary', {}).get('bonus_predictor_enabled', False))
    save_predictor_enabled = bool(prior_cache.get('summary', {}).get('save_predictor_enabled', False))
    ...
    return {
        ...
        'summary': {
            ...
            'xmins_v2_enabled': xmins_v2_enabled,
            'bonus_predictor_enabled': bonus_predictor_enabled,
            'save_predictor_enabled': save_predictor_enabled,
            'news_flag_enabled': True,
            ...
        },
        ...
    }
```
Phase 90 adds to both the read block and the returned summary dict:
```python
mc_enabled = bool(prior_cache.get('summary', {}).get('mc_enabled', False))
# ... in summary dict:
'mc_enabled': mc_enabled,  # Phase 90 MC-01
```
Also add to the `gate_flags` dict inside the `_empty_backtest` version record (lines 465-470) for parity with the main write path.

---

### `src/lib/types.ts` (model, transform — small extend)

**Analog:** `src/lib/types.ts` lines 183-190 — existing Phase 61 MC fields immediately above insertion point.

**Existing MC fields block** (lines 183-190 — do not change):
```typescript
// Phase 61 MC-01/MC-02: Monte Carlo simulation outputs (10,000 sims per player per GW).
// Written by pipeline/simulate.py after merge_players(). Optional — absent on first
// pipeline run before simulate.py is deployed. BGW players: blank_prob=1.0, haul_prob=0.0,
// p10_pts=0.0, p90_pts=0.0. p90_pts also overwrites xPts_90th_1gw (D-05).
blank_prob?: number     // P(total_pts <= 2) across 10k simulations; 1.0 for BGW
haul_prob?: number      // P(total_pts >= 10) across 10k simulations; 0.0 for BGW
p10_pts?: number        // 10th percentile simulated points (floor); 0.0 for BGW
p90_pts?: number        // 90th percentile simulated points (ceiling); overwrites xPts_90th_1gw
```

**Insert after line 190** (D-05 — all four fields must be optional):
```typescript
// Phase 90 MC-01: 5-GW cumulative uncertainty bands and position-relative rank trajectory.
// Written by pipeline/simulate.py when mc_enabled=true. Absent when mc_enabled=false (D-01).
xPts_5gw_p10?: number     // 10th percentile cumulative 5-GW xPts (floor)
xPts_5gw_p50?: number     // 50th percentile cumulative 5-GW xPts (≈ xPts_5gw deterministic)
xPts_5gw_p90?: number     // 90th percentile cumulative 5-GW xPts (ceiling)
rank_trajectory?: number[] // length-5 position-relative percentile rank [0,1] per GW horizon (D-03)
```

---

## Shared Patterns

### Gate flag read-and-preserve
**Source:** `pipeline/accuracy.py` lines 40-88 (`_read_existing_xmins_v2_flag`, `_read_existing_bonus_predictor_flag`, `_read_existing_save_predictor_flag`)
**Apply to:** `pipeline/accuracy.py` (new `_read_existing_mc_enabled_flag` function)
```python
def _read_existing_mc_enabled_flag(cache_dir: str) -> bool:
    try:
        path = os.path.join(cache_dir, 'accuracy_backtest.json')
        with open(path, 'r', encoding='utf-8') as f:
            prev = json.load(f)
        return bool(prev.get('summary', {}).get('mc_enabled', False))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return False
```

### Gate initialization + read from backtest + print + conditional call
**Source:** `pipeline/run.py` lines 190-220
**Apply to:** `pipeline/run.py` (patch for `mc_enabled`)
- Initialize to `False` in the variable block (line 190 region)
- Read inside `try` block with `.get('mc_enabled', False)` (line 199 region)
- `print(f"MC simulation ...: {'ENABLED' if mc_enabled else 'DISABLED'}")` (line 208 region)
- `if mc_enabled: merged = compute_simulations(...)` (replaces unconditional line 220)

### Optional field convention (TypeScript)
**Source:** `src/lib/types.ts` lines 183-190
**Apply to:** `src/lib/types.ts` 4 new fields
- All four new fields MUST use `?:` syntax (D-05)
- JSDoc comment block identifies the phase, gate condition, and absent-when semantics

### NumPy vectorized sampling pattern
**Source:** `pipeline/simulate.py` lines 92-105
**Apply to:** `pipeline/simulate.py` 5-GW loop extension
```python
goals = rng.poisson(lam_g, size=N_SIMS)
assists = rng.poisson(lam_a, size=N_SIMS)
cs = rng.binomial(1, cs_prob, size=N_SIMS)
total_pts += goals * GOAL_PTS[et] + assists * ASSIST_PTS + cs * CS_PTS[et] + bonus_det + appear_det
```
Same pattern per GW group; accumulate into `total_pts_by_gw` list.

### `groupby(event_id)` fixture iteration
**Source:** `pipeline/simulate.py` lines 78-82 (1-GW); `pipeline/merge.py` lines 299-311 (n-GW reference)
**Apply to:** `pipeline/simulate.py` 5-GW extension
```python
# merge.py reference (do NOT import — replicate the semantic):
for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
    grouped.append((event_id, list(group)))
for gw_idx, (_event_id, gw_fixtures) in enumerate(grouped[:n_gws]):
    for fix in gw_fixtures:
        ...
```
Phase 90 collects into list then slices `[:5]` — handles BGW gaps by simply producing
fewer than 5 entries; pad with `np.zeros(N_SIMS)` to reach length 5.

---

## No Analog Found

None. All 5 files are modifications to existing files with directly readable patterns.

---

## Metadata

**Analog search scope:** `pipeline/simulate.py`, `pipeline/run.py`, `pipeline/accuracy.py`, `pipeline/tests/test_simulate.py`, `pipeline/tests/conftest.py`, `src/lib/types.ts`
**Files read:** 7 files across pipeline and frontend
**Pattern extraction date:** 2026-05-10
