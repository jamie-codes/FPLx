# Phase 90: Monte Carlo Simulation Pipeline - Research

**Researched:** 2026-05-10
**Domain:** Python pipeline extension — Monte Carlo simulation, NumPy vectorized sampling, gate flag plumbing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Gate Scope:** When `mc_enabled=OFF`, the entire `simulate.py` is skipped in `run.py` — all MC fields absent from `merged_players.json`, including both Phase 61 1-GW fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) and the new 5-GW fields (`xPts_5gw_p10/p50/p90`, `rank_trajectory`). One gate controls one module — no partial execution.
- **D-02 Iteration Budget:** `MC_ITERATIONS=1000` is the production default (configurable via env var; minimum enforced in code). `MC_SEED=42` for reproducible CI runs. The Phase 61 hardcoded `N_SIMS=10_000` is replaced.
- **D-03 rank_trajectory Semantics:** `rank_trajectory` is a length-5 float array where `rank_trajectory[i]` = the player's cumulative p50 xPts percentile rank within their same-position pool (1=GK, 2=DEF, 3=MID, 4=FWD) over GWs 1 through i+1. Example: `[0.80, 0.78, 0.75, 0.72, 0.68]` means 80th percentile over 1 GW, falling to 68th over 5 GWs.
- **D-04 Isolation Rule (carried from Phase 61):** `simulate.py` MUST NOT import from `merge.py`. Poisson/Bernoulli math is duplicated as thin inline helpers. Already in place; Phase 90 must not loosen it.
- **D-05 TypeScript Fields (carried from Phase 63):** All four new MC fields on `MergedPlayer` MUST be optional (`?:`). Legacy cache reads must not break when fields are absent.

### Claude's Discretion

None documented.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Frontend display of the new fields (downstream phases) is out of scope. No new HTTP calls. No changes to `merge.py`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MC-01 | Per-player Monte Carlo simulation over 5 GWs — samples `xPts_1gw` distributions (Poisson/Bernoulli parameters from existing pipeline), runs ≥1000 iterations, writes `xPts_5gw_p10/p50/p90` and `rank_trajectory` per player to `merged_players.json`; gated by `mc_enabled` flag in `accuracy_backtest.json` | Existing `simulate.py` scaffold, `merge.py` parameter reference, `run.py` gate pattern, `accuracy.py` flag-preservation pattern — all verified in codebase |
</phase_requirements>

---

## Summary

Phase 90 extends the existing Phase 61 Monte Carlo scaffold in `pipeline/simulate.py` from a 1-GW simulation to a 5-GW cumulative simulation. The codebase investigation reveals that all the hard algorithmic work is already scaffolded — the core loop structure, `_cs_prob_sim` inline helper, BGW short-circuit, and DGW `groupby(event_id)` pattern are all present and proven. Phase 90 is a targeted extension: iterate all 5 GW groups instead of breaking after the first, accumulate per-GW cumulative xPts across iterations, then derive p10/p50/p90 percentiles and a position-relative rank trajectory.

The gate plumbing follows an established pattern used three times previously (xmins_v2_enabled, bonus_predictor_enabled, save_predictor_enabled). The `mc_enabled` flag is read from `accuracy_backtest.json` summary in `run.py` and preserved in `accuracy.py`. The test infrastructure is mature: pytest 8.3.5, conftest.py sys.path injection, 5 existing `test_simulate.py` tests all passing, no CI execution of the test suite (no pytest step in `pipeline.yml`).

The only genuine new algorithmic work is the `rank_trajectory` computation: after the per-player iteration loop completes, sort all players' per-horizon p50 cumulative xPts within their position group and emit a normalized 0–1 percentile rank at each of the 5 horizons.

**Primary recommendation:** Three-plan structure matching ROADMAP.md — Wave 0 (RED tests + TypeScript types), Wave 1 Plan A (`simulate.py` + `run.py`), Wave 1 Plan B (`accuracy.py` gate plumbing). Plans A and B are file-disjoint and parallelizable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MC simulation math | Pipeline (Python) | — | CPU-bound sampling; must not run client-side to avoid page-load latency |
| `mc_enabled` gate read | Pipeline / `run.py` | — | Read from previous `accuracy_backtest.json` summary at pipeline startup |
| `mc_enabled` gate preservation | Pipeline / `accuracy.py` | — | Written into summary dict on each backtest run; mirrors all other gate flags |
| Output serialization | Pipeline (JSON write) | — | Written into `merged_players.json` as optional fields |
| TypeScript field declarations | Frontend / `src/lib/types.ts` | — | Optional fields; consumers degrade gracefully when absent |
| rank_trajectory compute | Pipeline (Python) | — | Cross-player ranking requires the full merged list; cannot be per-player-isolated |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| numpy | 2.2.3 (installed) | Vectorized Poisson/binomial sampling, percentile computation | Already in use in Phase 61; `np.random.default_rng` available [VERIFIED: live env] |
| Python | 3.11.9 (installed) | Runtime | Pipeline baseline [VERIFIED: live env] |
| pytest | 8.3.5 (installed) | Test framework | Existing suite; conftest.py sys.path injection working [VERIFIED: live env] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| itertools.groupby | stdlib | Group fixtures by event_id for DGW handling | Already used in simulate.py and merge.py |
| os.environ | stdlib | Read `MC_ITERATIONS` and `MC_SEED` env vars | Env-var gate pattern follows existing `MC_SEED` specifics from CONTEXT.md |

### Alternatives Considered
None — stack is fully determined by existing codebase constraints.

**Version verification:**
NumPy 2.2.3 is installed and `np.random.default_rng` is confirmed available. [VERIFIED: live env]

---

## Architecture Patterns

### System Architecture Diagram

```
pipeline/run.py (startup)
  └─ read accuracy_backtest.json → mc_enabled flag (False by default)
  └─ merge_players() → merged list (~600 players, each with fixtures[])
  └─ if mc_enabled:
       compute_simulations(merged, xmins_v2_enabled, mc_iterations, rng_seed)
         └─ for each player: _simulate_player_5gw(p, xmins_v2_enabled, rng)
              └─ groupby(event_id) → 5 GW groups (BGW=empty group, DGW=2 fixtures in group)
              └─ per GW group: Poisson(lam_g) + Poisson(lam_a) + Bernoulli(cs_prob) × N_SIMS
              └─ accumulate cumulative xPts across 5 GWs
              └─ write xPts_5gw_p10/p50/p90 to player dict
         └─ rank_trajectory: for each of 5 horizons,
              rank each player's p50 cumulative xPts within position group → [0,1] percentile
         └─ write rank_trajectory[5] to player dict
  └─ save('merged_players.json', merged)

pipeline/accuracy.py (backtest write)
  └─ read prior accuracy_backtest.json → preserve mc_enabled value
  └─ write mc_enabled into summary dict (cold-start fallback: mc_enabled=false)
```

### Recommended Project Structure

No new directories needed. All changes are within:
```
pipeline/
├── simulate.py          # extend (primary implementation file)
├── run.py               # small patch (mc_enabled gate wrapping line 220)
├── accuracy.py          # small patch (mc_enabled flag preservation)
└── tests/
    └── test_simulate.py # extend (6 new test cases)
src/lib/
└── types.ts             # 4 new optional fields on MergedPlayer
```

### Pattern 1: `_simulate_player` 5-GW Extension

The existing `_simulate_player` iterates the first GW group only (`break` after first group). The 5-GW extension removes the `break` and accumulates across all 5 groups.

```python
# Source: pipeline/simulate.py (verified) — current 1-GW structure to extend
def _simulate_player(p: dict, xmins_v2_enabled: bool, rng) -> dict:
    # ... BGW short-circuit unchanged ...
    total_pts_by_gw = []
    for _eid, group in groupby(fixtures, key=lambda f: f.get('event_id')):
        gw_pts = np.zeros(N_SIMS)
        for fix in list(group):
            dd = fix.get('defensive_difficulty', 0.5)
            cs_prob = _cs_prob_sim(dd, xmins, m60)
            goals = rng.poisson(lam_g, size=N_SIMS)
            assists = rng.poisson(lam_a, size=N_SIMS)
            cs = rng.binomial(1, cs_prob, size=N_SIMS)
            gw_pts += goals * GOAL_PTS[et] + assists * ASSIST_PTS + cs * CS_PTS[et] + bonus_det + appear_det
        total_pts_by_gw.append(gw_pts)
        if len(total_pts_by_gw) >= 5:
            break
    # cumulative sum across GWs
    # ... pad BGW gaps (no group) with zeros ...
    cumulative = np.cumsum(np.column_stack(total_pts_by_gw_padded), axis=1)
    cumulative_5gw = cumulative[:, -1]
    return {
        # existing 1-GW fields ...
        'xPts_5gw_p10': round(float(np.percentile(cumulative_5gw, 10)), 3),
        'xPts_5gw_p50': round(float(np.percentile(cumulative_5gw, 50)), 3),
        'xPts_5gw_p90': round(float(np.percentile(cumulative_5gw, 90)), 3),
        '_cumulative_by_gw': cumulative,  # scratch field, stripped before return
    }
```

**BGW GW handling:** When a player has fewer than 5 GW groups in their `fixtures` list (BGW — no fixture for that GW), those GWs contribute zero to cumulative xPts. The existing fixture list is already 5-GW-capable when populated by `merge.py`.

### Pattern 2: `rank_trajectory` Computation

`rank_trajectory` is computed in `compute_simulations` after all players' p50 values are known — it is a cross-player ranking step and cannot be computed per-player in isolation.

```python
# Source: CONTEXT.md D-03 + Specifics section (design decision, not verified code)
# After the per-player loop:
for horizon in range(5):  # horizons 0-4 = GW1-through-GW{h+1} cumulative
    pool_by_pos = defaultdict(list)
    for player_result in results:
        pos = player_result['element_type']
        pool_by_pos[pos].append((player_result['_p50_by_horizon'][horizon], player_result))
    for pos, pool in pool_by_pos.items():
        pool.sort(key=lambda x: x[0])
        n = len(pool)
        for rank_idx, (_, player_result) in enumerate(pool):
            player_result['_rank_trajectory'][horizon] = rank_idx / max(n - 1, 1)
```

### Pattern 3: `mc_enabled` Gate in `run.py`

Template from the `xmins_v2_enabled` gate (lines 190–220 of `run.py`, verified):

```python
# Source: pipeline/run.py lines 190-220 (verified)
# Current state (no mc_enabled yet):
xmins_v2_enabled = False
# ... read from accuracy_backtest.json ...
xmins_v2_enabled = prev_backtest.get('summary', {}).get('xmins_v2_enabled', False)
# ...
merged = compute_simulations(merged, xmins_v2_enabled)  # line 220 — always called

# Phase 90 target state:
mc_enabled = False  # default OFF per D-01
# ... in the try block reading accuracy_backtest.json ...
mc_enabled = prev_backtest.get('summary', {}).get('mc_enabled', False)
# ...
print(f"MC simulation: {'ENABLED' if mc_enabled else 'DISABLED'}")
if mc_enabled:
    merged = compute_simulations(merged, xmins_v2_enabled)
# If mc_enabled=False: line 220 is skipped entirely; merged dict unchanged
```

### Pattern 4: `mc_enabled` Preservation in `accuracy.py`

Template from `_read_existing_xmins_v2_flag` / `_read_existing_bonus_predictor_flag` (lines 40–88 of `accuracy.py`, verified):

```python
# Source: pipeline/accuracy.py lines 368-406 (verified)
# Pattern for the summary dict write — add mc_enabled alongside existing flags:
mc_enabled = bool(prior_cache.get('summary', {}).get('mc_enabled', False))
# Written into summary:
'mc_enabled': mc_enabled,  # Phase 90 — gate for 5-GW MC simulation; preserved across runs
```

Cold-start path (in `_empty_backtest`): same read-and-preserve pattern; defaults to `False` when file absent.

### Pattern 5: `N_SIMS` → env-var configurable

Current code has `N_SIMS = 10_000` as a module-level constant. Phase 90 replaces this with:

```python
# Source: CONTEXT.md Specifics (design decision)
import os
N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))
MC_SEED = int(os.environ.get('MC_SEED', 42))
```

The `rng` is seeded in `compute_simulations` and passed through (not re-seeded per player):

```python
# Source: CONTEXT.md Specifics (design decision)
rng = np.random.default_rng(seed=MC_SEED)
```

### Pattern 6: `compute_simulations` Signature Extension

Current signature (line 115 of `simulate.py`, verified):
```python
def compute_simulations(merged: list, xmins_v2_enabled: bool) -> list:
    rng = np.random.default_rng()  # unseeded — not reproducible
```

Phase 90 target signature:
```python
def compute_simulations(
    merged: list,
    xmins_v2_enabled: bool,
) -> list:
    rng = np.random.default_rng(seed=MC_SEED)  # module-level constant
```

`MC_ITERATIONS` and `MC_SEED` are module-level constants (read at import time from env), not parameters. This keeps the `run.py` call site unchanged: `merged = compute_simulations(merged, xmins_v2_enabled)`.

### Anti-Patterns to Avoid

- **Importing from merge.py:** D-04 prohibits this. The `_cs_prob_sim` inline helper already exists in `simulate.py` — do not replace it with an import.
- **Zero-filling absent GWs in output:** When `mc_enabled=OFF`, fields must be *absent* from the player dict, not zero-filled. Zero-filled fields would break the graceful-degrade semantic (D-01).
- **Re-seeding the RNG per player:** The RNG instance is created once in `compute_simulations` and passed to `_simulate_player`. Re-creating per player destroys reproducibility across the full player set.
- **Storing full iteration arrays per player:** Storing `N_SIMS × 5` float arrays across ~600 players would require ~600 × 1000 × 5 × 8 bytes ≈ 24 MB in memory. Compute percentiles and p50-by-horizon arrays in `_simulate_player` and discard raw arrays before returning.
- **Computing rank_trajectory inside `_simulate_player`:** Ranking is a cross-player operation. It cannot be done inside the per-player loop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Poisson sampling | Custom inverse-CDF | `rng.poisson(lam, size=N_SIMS)` | NumPy vectorized; already used in Phase 61 |
| Bernoulli sampling | Custom coin flip | `rng.binomial(1, p, size=N_SIMS)` | NumPy vectorized; already used in Phase 61 |
| Percentile computation | Sort + index math | `np.percentile(arr, [10, 50, 90])` | Vectorized; handles edge cases |
| CS probability formula | New derivation | `_cs_prob_sim()` — already in simulate.py | Avoid merge.py dependency while reusing proven formula |
| Rank normalization | Custom sort + divide | `scipy.stats.percentileofscore` or manual (n-1 denominator) | Manual is fine; no scipy dependency needed |

**Key insight:** The algorithmic complexity is low. NumPy's vectorized ops mean 1000 iterations over ~600 players is fast (sub-second). The main engineering concern is correctness of the groupby-across-5-GWs logic and the cross-player ranking step.

---

## Common Pitfalls

### Pitfall 1: BGW Gap — Player Has Fewer Than 5 Fixture Groups

**What goes wrong:** A player may have only 2 fixture groups in their `fixtures` list if the remaining 5-GW window contains BGWs. Naively iterating 5 groups will run off the end of the groupby iterator or produce a cumulative that pads with the same GW rather than zero.

**Why it happens:** `fixtures` only contains fixtures that exist — BGW players have no entry for that GW. `_xpts_ngw` in `merge.py` handles this correctly at line 311 with `grouped[:n_gws]`, which simply produces fewer than n_gws groups when players have fewer fixtures.

**How to avoid:** Collect groupby results into a list first, then iterate `groups[:5]`, yielding per-GW arrays of length equal to number of groups found. Pad cumulative array with zeros up to 5 GWs before computing percentiles.

**Warning signs:** A BGW player's `xPts_5gw_p50` equals their `xPts_3gw` (3-GW sum) — indicates GW 4 and 5 were counted as duplicates of GW 3 rather than zero.

### Pitfall 2: `rank_trajectory` Cross-Player Scratch Field Cleanup

**What goes wrong:** If `_simulate_player` stores scratch fields like `_cumulative_by_gw` or `_p50_by_horizon` on the player dict, and `compute_simulations` doesn't remove them, they will be serialized into `merged_players.json`.

**Why it happens:** Python dicts are mutable; it's easy to forget to strip helper keys.

**How to avoid:** Either compute all per-horizon p50 values inside `_simulate_player` and return them as a list (not stored on `p`), or explicitly `del p['_scratch_key']` before appending to result.

### Pitfall 3: N_SIMS Module Constant vs Phase 61 Hardcode

**What goes wrong:** Phase 61 hardcoded `N_SIMS = 10_000` at module level. Phase 90 replaces this with `N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))`. If the replacement is missed or partially applied, production runs will still use 10,000 iterations.

**Why it happens:** Simple oversight when refactoring the constant.

**How to avoid:** Remove the hardcoded `N_SIMS = 10_000` line entirely and replace with the env-var form. The test for iteration-count gate (`MC_ITERATIONS` env var) will catch this.

### Pitfall 4: `compute_simulations` Call Site in `run.py` — Always Executes Today

**What goes wrong:** Currently line 220 of `run.py` calls `merged = compute_simulations(merged, xmins_v2_enabled)` unconditionally. Adding `mc_enabled` means wrapping this in an `if mc_enabled:` guard. Without the guard, the function always runs.

**Why it happens:** The gate changes must be coordinated between the `run.py` patch (Plan 02) and the `accuracy.py` patch (Plan 03).

**How to avoid:** Plan 02 must add both the flag read and the `if mc_enabled:` guard in the same commit. The existing test `test_bgw_shortcircuit` passes with or without the gate — add an explicit `mc_enabled=OFF` skip test (one of the 6 required test cases).

### Pitfall 5: `xPts_5gw_p50` vs `xPts_5gw` Drift

**What goes wrong:** `xPts_5gw` (deterministic from merge.py) and `xPts_5gw_p50` (MC 50th percentile) should be approximately equal. The ROADMAP cross-cutting constraint says "within 5% sample tolerance at iter=1000". If the simulation parameters diverge from merge.py's deterministic formula, this invariant will fail.

**Why it happens:** The deterministic formula uses `E[Poisson(lam)] = lam` (linearity of expectation). The MC p50 should converge to this at large N. At N=1000 the convergence is not exact (median ≠ mean for non-symmetric distributions) — the 5% tolerance accounts for this.

**How to avoid:** The pytest invariant case is sufficient. Do not tighten the tolerance below 5% for N=1000.

### Pitfall 6: `rank_trajectory` Position Group with 1 Player

**What goes wrong:** If a position group has only 1 player (degenerate case), the normalization `rank / (n - 1)` divides by zero.

**Why it happens:** Rare but possible (e.g., test fixtures with 1 player per position).

**How to avoid:** Use `max(n - 1, 1)` as the denominator; a single-player pool returns `0.0` (or `1.0` — pick consistently).

---

## Code Examples

Verified patterns from the codebase:

### `_cs_prob_sim` — Already in `simulate.py` (verified, do not change)
```python
# Source: pipeline/simulate.py lines 45-53 (verified)
def _cs_prob_sim(dd: float, xmins: float, mins_60_prob: float | None) -> float:
    cs_prob_raw = max(0.10, min(0.65, 0.40 - dd * 0.30))
    mins_factor = mins_60_prob if mins_60_prob is not None else min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor
```

### Scoring constants — Already in `simulate.py` (verified, do not change)
```python
# Source: pipeline/simulate.py lines 39-42 (verified)
GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
CS_PTS = {1: 6, 2: 6, 3: 1, 4: 0}
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}
```

### `_xpts_ngw` groupby semantics (merge.py reference, do NOT import)
```python
# Source: pipeline/merge.py lines 299-311 (verified)
# Pattern: collect groups, iterate up to n_gws
for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
    grouped.append((event_id, list(group)))
for gw_idx, (_event_id, gw_fixtures) in enumerate(grouped[:n_gws]):
    for fix in gw_fixtures:
        ...
```

### Existing player dict fields available in `compute_simulations` (verified from test_simulate.py `_player()` helper)
```python
# Source: pipeline/tests/test_simulate.py lines 13-33 (verified)
# Fields already present on each merged player dict:
{
    'element_type': 1|2|3|4,       # position code
    'xmins': float,                  # unconditional expected minutes
    'start_prob': float,             # probability of starting
    'xg_per90': float,               # xG rate per 90
    'xa_per90': float,               # xA rate per 90
    'fixtures': [                    # 5-GW-capable ordered by event_id
        {'defensive_difficulty': float, 'event_id': int, ...}
    ],
    'mins_60_prob': float | None,    # cs_prob mins_factor (xmins_v2 path)
    'xPts_90th_1gw': float,         # overwritten by p90_pts (D-05)
}
```

### `accuracy.py` summary dict write (verified — add `mc_enabled` alongside existing flags)
```python
# Source: pipeline/accuracy.py lines 396-406 (verified — location to add mc_enabled)
'summary': {
    'xpts_hit_rate': ...,
    'xmins_v2_enabled': xmins_v2_enabled,
    'bonus_predictor_enabled': bonus_predictor_enabled,
    'save_predictor_enabled': save_predictor_enabled,
    'news_flag_enabled': True,
    # ADD:
    'mc_enabled': mc_enabled,  # Phase 90 — preserved across runs, default False
    ...
}
```

### TypeScript fields to add (verified — insert after line 190 of `src/lib/types.ts`)
```typescript
// Source: src/lib/types.ts line 190 (verified — insert after existing MC fields)
// Phase 90 MC-01: 5-GW uncertainty bands and rank trajectory
// Written by pipeline/simulate.py when mc_enabled=true. Absent when mc_enabled=false.
xPts_5gw_p10?: number        // 10th percentile cumulative 5-GW xPts (floor)
xPts_5gw_p50?: number        // 50th percentile cumulative 5-GW xPts (≈ xPts_5gw)
xPts_5gw_p90?: number        // 90th percentile cumulative 5-GW xPts (ceiling)
rank_trajectory?: number[]   // length-5 position-relative percentile rank per GW horizon
```

---

## Test Infrastructure

### Existing Setup (verified)
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 |
| Config | No `pytest.ini` — pytest discovers from `rootdir: C:\Users\jamie\fplx` |
| conftest.py | `pipeline/tests/conftest.py` — injects `pipeline/` dir onto `sys.path` |
| Import style | Bare: `from simulate import compute_simulations` |
| Quick run | `python -m pytest pipeline/tests/test_simulate.py -v` |
| Full suite | `python -m pytest pipeline/tests/ -v` |
| Existing passing tests | 5 tests in `test_simulate.py` — all GREEN [VERIFIED: live env] |

### Existing `test_simulate.py` Tests (must remain passing)
1. `test_bgw_shortcircuit` — xmins=0 or start_prob=0 → blank_prob=1.0
2. `test_mc_mean_matches_analytical` — active player lands in valid range
3. `test_dgw_sums_fixtures` — DGW has higher p90 and haul_prob than single
4. `test_p90_overwrites_ceiling` — p90_pts overwrites xPts_90th_1gw (D-05)
5. `test_output_value_ranges` — all 4 MC fields in expected ranges

### 6 New Test Cases Required (per CONTEXT.md and ROADMAP.md)

| # | Test Name | What It Checks | Type |
|---|-----------|---------------|------|
| 1 | `test_5gw_percentile_invariants` | `p10 <= p50 <= p90` for cumulative 5-GW output; p50 ≈ xPts_5gw within 5% for active player | unit |
| 2 | `test_5gw_bgw_zero_fill` | BGW (no fixture group for GW 3 of 5) contributes zero to cumulative; `xPts_5gw_p50` < full-5-GW player | unit |
| 3 | `test_5gw_dgw_combine` | DGW in GW 1 (two fixtures, same event_id) produces higher cumulative p50 than single-fixture equivalent | unit |
| 4 | `test_iteration_count_gate` | `MC_ITERATIONS` env var sets N_SIMS; assert iteration count ≥ 1000 (configurable) | unit |
| 5 | `test_seed_determinism` | Two calls with `MC_SEED=42` produce identical `xPts_5gw_p50` output for same player | unit |
| 6 | `test_mc_enabled_off_skip` | When `mc_enabled=False` in `run.py`, `compute_simulations` is NOT called; MC fields absent from merged dict | integration |

**Notes on test 6:** This tests the `run.py` gate logic, not `simulate.py` directly. Options: (a) mock `compute_simulations` and assert it wasn't called when `mc_enabled=False`, or (b) treat as a `run.py`-level test in a different file. Given conftest.py injects the pipeline dir, mocking is feasible via `unittest.mock.patch`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 |
| Config file | none — rootdir discovery |
| Quick run command | `python -m pytest pipeline/tests/test_simulate.py -v` |
| Full suite command | `python -m pytest pipeline/tests/ -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-01 | ≥1000 iterations, p10/p50/p90 written | unit | `python -m pytest pipeline/tests/test_simulate.py -v` | ✅ exists; 6 cases to add (Wave 0) |
| MC-01 | BGW contributes zero | unit | same | ❌ Wave 0 |
| MC-01 | DGW combines fixtures | unit | same | ❌ Wave 0 |
| MC-01 | Seed determinism | unit | same | ❌ Wave 0 |
| MC-01 | `mc_enabled=OFF` skip | integration | `python -m pytest pipeline/tests/test_simulate.py -v` | ❌ Wave 0 |
| MC-01 | rank_trajectory length-5 array | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest pipeline/tests/test_simulate.py -v`
- **Per wave merge:** `python -m pytest pipeline/tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] 6 new test cases in `pipeline/tests/test_simulate.py` — covers all MC-01 requirements
- [ ] 4 new optional fields in `src/lib/types.ts` — TypeScript type completeness

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | Pipeline runtime | ✓ | 3.11.9 | — |
| numpy | Vectorized sampling | ✓ | 2.2.3 | — |
| np.random.default_rng | Seeded RNG | ✓ | (part of numpy 2.2.3) | — |
| pytest | Test suite | ✓ | 8.3.5 | — |

No missing dependencies. Phase 90 requires nothing not already installed. [VERIFIED: live env]

---

## State of the Art

| Old Approach (Phase 61) | Phase 90 Approach | Rationale |
|------------------------|-------------------|-----------|
| `N_SIMS = 10_000` hardcoded | `max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))` | 1K sufficient for p10/p50/p90 stability over 5-GW horizon; 10K over-budget for 600 players × 5 GWs |
| `rng = np.random.default_rng()` (unseeded) | `rng = np.random.default_rng(seed=MC_SEED)` | Reproducible CI output |
| 1-GW simulation (`break` after first group) | 5-GW cumulative simulation (all groups up to 5) | New requirement for uncertainty bands across planning horizon |
| Returns 4 scalar fields | Returns 4 scalar fields + 4 new fields (p10/p50/p90/rank_trajectory) | Extends output, preserves backward compatibility |
| `compute_simulations` always called | `compute_simulations` gated by `mc_enabled` | D-01 gate requirement; ON/OFF controls entire module |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fixtures` list on each merged player dict contains up to 5 GW groups ordered by `event_id` when populated by `merge.py` | Architecture Patterns | If fixtures are not pre-ordered by event_id, groupby will produce incorrect groups; verify by inspecting a live `merged_players.json` fixture ordering |
| A2 | No CI/CD pytest step exists in `pipeline.yml` — tests are local-only | Test Infrastructure | If CI runs tests, a test import failure would break CI; low risk as tests currently pass |
| A3 | `xPts_5gw_p50 ≈ xPts_5gw` within 5% at N=1000 — the ROADMAP cross-cutting constraint | Pitfall 5 | At N=1000 with asymmetric distributions (Poisson), median can deviate from mean; 5% tolerance should be sufficient |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. Three assumptions are noted above; all are LOW-risk.

---

## Open Questions

1. **`mc_enabled=OFF` blocks the existing Phase 61 1-GW fields too (D-01)**
   - What we know: D-01 says one gate controls one module — all MC fields absent when OFF, including `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`
   - What's unclear: Do any existing consumers of the 1-GW fields (`GemTable`, `CaptainPicksPanel`) break gracefully when these 4 fields are absent? They should — all fields are `?:` on `MergedPlayer`
   - Recommendation: The Phase 90 plan does not need to audit UI consumers (frontend display is out of scope). Trust the `?:` optional typing.

2. **No `pytest` step in `pipeline.yml`**
   - What we know: `.github/workflows/pipeline.yml` has no `pytest` command — tests are not run in CI [VERIFIED: grep found no pytest in workflow]
   - What's unclear: Whether adding pytest to CI is desired for Phase 90
   - Recommendation: Out of scope for Phase 90 — do not add CI test step unless CONTEXT.md mentions it.

---

## Security Domain

Phase 90 is a pure Python pipeline computation with no network calls, no user input, no authentication, and no HTTP endpoints. ASVS controls are not applicable. `security_enforcement` is not explicitly set to `false` in `config.json`, but there is no attack surface to assess.

| ASVS Category | Applies | Rationale |
|---------------|---------|-----------|
| V2 Authentication | No | No auth; internal pipeline module |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No access control surface |
| V5 Input Validation | Partial | `max(1000, int(...))` env-var parsing is the only user-controlled input; already guarded |
| V6 Cryptography | No | RNG is for statistical sampling, not security |

---

## Sources

### Primary (HIGH confidence)
- `pipeline/simulate.py` — full file read; Phase 61 baseline functions, signatures, constants [VERIFIED: codebase]
- `pipeline/merge.py` lines 138-390 — `_cs_prob`, `_xpts_ngw`, `_xpts_per_gw`, `_compute_xpts_fixture` verified [VERIFIED: codebase]
- `pipeline/run.py` lines 185-228 — `xmins_v2_enabled` gate pattern, `compute_simulations` call site [VERIFIED: codebase]
- `pipeline/accuracy.py` lines 1-494 — all flag read/preserve/write patterns [VERIFIED: codebase]
- `pipeline/tests/test_simulate.py` — 5 existing tests, all passing [VERIFIED: live env `pytest` run]
- `pipeline/tests/conftest.py` — sys.path injection pattern [VERIFIED: codebase]
- `src/lib/types.ts` lines 180-213 — existing MC fields, insertion point [VERIFIED: codebase]
- `numpy 2.2.3` + `np.random.default_rng` — available [VERIFIED: live env Python execution]

### Secondary (MEDIUM confidence)
- `.planning/phases/90-monte-carlo-simulation-pipeline/90-CONTEXT.md` — locked decisions D-01 through D-05, code insights, specifics [CITED: project file]
- `.planning/ROADMAP.md` §Phase 90 — success criteria SC-1 through SC-5, plan breakdown [CITED: project file]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified against live environment
- Architecture: HIGH — all patterns verified against existing codebase; rank_trajectory algorithm from CONTEXT.md (design decision, not ambiguous)
- Pitfalls: HIGH — derived from reading actual code and flag patterns used 3 times previously
- Test infrastructure: HIGH — live pytest run confirmed

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable Python/NumPy stack; pipeline conventions established)
