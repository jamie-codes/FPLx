# Phase 90: Monte Carlo Simulation Pipeline - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Pipeline adds per-player 5-GW xPts uncertainty bands and rank trajectory to `merged_players.json`. A new `pipeline/simulate.py` (extending the Phase 61 scaffolding) runs ≥1000 Monte Carlo iterations per player over the next 5 GWs using Poisson goal/assist distributions and Bernoulli CS distributions drawn from existing pipeline parameters. Output fields `xPts_5gw_p10`, `xPts_5gw_p50`, `xPts_5gw_p90`, and `rank_trajectory` are written per player. The whole MC stage is gated by `mc_enabled` in `accuracy_backtest.json` (default OFF).

**What ships:**
- `pipeline/simulate.py` — extended with 5-GW cumulative simulation (`compute_simulations`, `_simulate_player`, `_cs_prob_sim` reimplemented per D-02 isolation); `MC_ITERATIONS` env var (default 1000); `MC_SEED` env var (default 42 for determinism)
- `pipeline/tests/test_simulate.py` — 6 pytest cases covering: percentile invariants, BGW zero-fill, DGW combine, iteration-count gate, seed determinism, mc_enabled OFF skip
- `pipeline/run.py` — `mc_enabled` flag read from previous `accuracy_backtest.json` summary; skip `compute_simulations` when OFF; position unchanged (after `merge.py`, before `data_health.py`)
- `pipeline/accuracy.py` — `mc_enabled` gate plumbing; cold-start fallback writes `mc_enabled: false` on first run; gate preserved across backtest runs (mirrors `xmins_v2_enabled` pattern)
- `src/lib/types.ts` — four new optional fields on `MergedPlayer` (`xPts_5gw_p10?`, `xPts_5gw_p50?`, `xPts_5gw_p90?`, `rank_trajectory?`)

**Out of scope:** Frontend display of the new fields (downstream phases); new HTTP calls; any changes to `merge.py`

</domain>

<decisions>
## Implementation Decisions

### Gate Scope
- **D-01:** When `mc_enabled=OFF`, the entire `simulate.py` is skipped in `run.py` — all MC fields absent from `merged_players.json`, including both the Phase 61 1-GW fields (`blank_prob`, `haul_prob`, `p10_pts`, `p90_pts`) and the new 5-GW fields (`xPts_5gw_p10/p50/p90`, `rank_trajectory`). All these fields are already optional on `MergedPlayer` so consumers degrade gracefully. One gate controls one module — no partial execution.

### Iteration Budget
- **D-02:** `MC_ITERATIONS=1000` is the production default (configurable via env var; minimum enforced in code). `MC_SEED=42` for reproducible CI runs. The Phase 61 hardcoded `N_SIMS=10_000` is replaced. 1K iterations is sufficient for statistically stable p10/p50/p90 bands and far more appropriate for a 5-GW pass over ~600 players.

### rank_trajectory Semantics
- **D-03:** `rank_trajectory` is a length-5 float array where `rank_trajectory[i]` = the player's cumulative p50 xPts percentile rank **within their same-position pool** (1=GK, 2=DEF, 3=MID, 4=FWD) over GWs 1 through i+1. Example: `[0.80, 0.78, 0.75, 0.72, 0.68]` means 80th percentile over 1 GW, falling to 68th over 5 GWs. This reveals fading/rising players within their position group and is the natural comparison unit for FPL decisions.

### Isolation Rule (carried from Phase 61 / Phase 63 D-02)
- **D-04:** `simulate.py` MUST NOT import from `merge.py`. Poisson/Bernoulli math is duplicated as thin inline helpers (`_cs_prob_sim`). This is already in place; Phase 90 must not loosen it.

### TypeScript Fields (carried from Phase 63 Pitfall 6)
- **D-05:** All four new MC fields on `MergedPlayer` MUST be optional (`?:`). Legacy cache reads must not break when the fields are absent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 90 — full success criteria (SC-1 through SC-5), plan breakdown, cross-cutting constraints
- `.planning/REQUIREMENTS.md` — MC-01 requirement definition

### Existing Pipeline Code
- `pipeline/simulate.py` — Phase 61 baseline; functions to extend (`compute_simulations`, `_simulate_player`, `_cs_prob_sim`); D-02 isolation already in place; D-05 `xPts_90th_1gw` overwrite pattern
- `pipeline/merge.py` — `_compute_xpts_fixture` (lines 187+), `_xpts_ngw` (line 275), `_xpts_per_gw` (line 339), `_cs_prob` (lines 141-146) — reference these for the Poisson/Bernoulli constants; do NOT import them
- `pipeline/run.py` — lines 190–220; `xmins_v2_enabled` gate pattern (lines 190-206) is the exact template for `mc_enabled` gate wiring; `compute_simulations` call at line 220
- `pipeline/accuracy.py` — `_read_existing_xmins_v2_flag` (line 40) is the template for the `mc_enabled` gate preservation pattern; cold-start fallback pattern (line 95)

### TypeScript Types
- `src/lib/types.ts` — lines 185-190: existing Phase 61 MC fields; extend with 4 new optional fields below line 190

### Prior Phase Context
- `.planning/phases/89-event-aware-pipeline-scheduling/89-CONTEXT.md` — most recent context; pipeline.yml and concurrency patterns
- `.planning/STATE.md` — D-02 isolation rule note for Phase 61

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline/simulate.py:45` — `_cs_prob_sim()`: already implements D-02-compliant inline Bernoulli CS probability; extend rather than rewrite
- `pipeline/simulate.py:56` — `_simulate_player()`: currently 1-GW only (uses `first_gw` with `break`); extend to iterate all 5 GW groups from `fixtures` using the same `groupby(event_id)` pattern
- `pipeline/simulate.py:115` — `compute_simulations()`: receives `merged` list and `xmins_v2_enabled`; Phase 90 adds `mc_iterations` and `rng` seed parameters
- `pipeline/merge.py:275` — `_xpts_ngw(fixtures, n_gws)`: reference for groupby semantics across multiple GWs; `fixtures` is already a 5-GW-capable list ordered by event_id
- `pipeline/accuracy.py:40` — `_read_existing_xmins_v2_flag()`: exact pattern for `mc_enabled` gate read-and-preserve

### Established Patterns
- **Gate read pattern:** `accuracy_backtest.json` → `summary.xmins_v2_enabled` → passed to `compute_simulations`. `mc_enabled` follows this same two-step: read from previous backtest summary in `run.py`, pass as parameter; preserve in accuracy.py write.
- **BGW short-circuit:** `xmins <= 0 OR start_prob <= 0 → skip simulation, write zero/null fields` (already in `_simulate_player` line 67)
- **DGW combine:** `groupby(event_id)` from fixtures; DGW = multiple fixtures sharing same event_id in first group; sum per-iteration across both fixtures
- **Optional fields with graceful degrade:** All MC fields are `?:` on `MergedPlayer`; consumers must check presence before rendering

### Integration Points
- `pipeline/run.py:220` — `merged = compute_simulations(...)` call; add `mc_enabled` guard wrapping this line
- `pipeline/accuracy.py` — add `mc_enabled` to the summary dict written at the end of `compute_accuracy_backtest()`; add cold-start fallback that writes `mc_enabled: false` when no prior backtest exists
- `src/lib/types.ts:190` — add four new optional fields after existing Phase 61 fields

</code_context>

<specifics>
## Specific Ideas

- `rank_trajectory` algorithm: per iteration, accumulate cumulative xPts per player per GW; after all iterations, compute p50 cumulative xPts at each horizon; rank each player's p50 within their position group; normalize to [0, 1] percentile. Emit as `[rank_1gw, rank_2gw, rank_3gw, rank_4gw, rank_5gw]`.
- Seed pattern: `np.random.default_rng(seed=MC_SEED)` where `MC_SEED = int(os.environ.get('MC_SEED', 42))`. Same RNG instance passed through for the entire run.
- `MC_ITERATIONS` env var: `N_SIMS = max(1000, int(os.environ.get('MC_ITERATIONS', 1000)))` — minimum enforcement in code, not just docs.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 90-monte-carlo-simulation-pipeline*
*Context gathered: 2026-05-10*
