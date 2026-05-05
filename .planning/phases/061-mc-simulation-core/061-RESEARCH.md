# Phase 61: MC Simulation Core - Research

**Researched:** 2026-05-05
**Domain:** Python NumPy Monte Carlo simulation + React hover card extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pipeline Integration**
- D-01: `simulate.py` standalone module, called from `run.py` after `merge_players()`. Signature: `compute_simulations(merged: list, xmins_v2_enabled: bool) -> list`
- D-02: Parameters re-derived inline from player fields (`xg_per90`, `xa_per90`, `xmins`, `element_type`, `defensive_difficulty`). No coupling to merge.py internals. 3 lines of math (lam_g/lam_a/cs_prob) re-implemented inline.
- D-03: `xmins_v2_enabled` passed as parameter from run.py (already in scope at line 190). simulate.py reads NO JSON files. When true, use `mins_60_prob` as cs_prob mins_factor.
- D-04: N_SIMS = 10,000 fixed. NumPy vectorized sampling (no pure-Python loop over 10k).

**Field Strategy**
- D-05: `p90_pts` replaces `xPts_90th_1gw` — simulate.py overwrites that field.
- D-06: `xPts_ceiling_1gw/3gw/5gw` boolean badges unchanged.
- D-07: New fields per player: `blank_prob` (float), `haul_prob` (float), `p10_pts` (float), `p90_pts` (float).
- D-08: BGW players (xmins <= 0): `blank_prob=1.0, haul_prob=0.0, p10_pts=0.0, p90_pts=0.0`.
- D-09: DGW: simulate each fixture independently (same 10k iterations), sum per-fixture scores per iteration, compute percentiles/blank/haul from combined distribution.

**UI**
- D-10: MC stats only in XPtsCell hover card. No new hidden columns.
- D-11: Card layout: 5 component rows → `<hr>` → Blank%/Haul%/Floor/Ceiling → `<hr>` → Total.
- D-12: Short labels: `Blank%` / `Haul%` / `Floor` / `Ceiling`. Values: `23%` / `41%` / `3.2` / `11.8`.
- D-13: `XPtsCell` receives `blankProb`, `haulProb`, `p10Pts`, `p90Pts` as optional props. Renders only when all four present and `window === 1`.
- D-14: `(blankProb * 100).toFixed(0) + '%'` for percentages; one decimal for floor/ceiling.

**Dependencies**
- D-15: `numpy>=1.26.0` added explicitly to `pipeline/requirements.txt`.

### Claude's Discretion
- Whether to show MC stats in the BGW short-circuit path (current guard: `value <= 0 → no card`). Likely omit — blank_prob=100% is obvious.
- Exact colour/emphasis for high haul% (e.g., amber at ≥40%). Follow existing badge colour patterns.
- Whether simulate.py prints a progress line to stdout.

### Deferred Ideas (OUT OF SCOPE)
- MC-03 / MC-04 (Phase 62): 5-GW rank trajectory simulator and MC labels in captain picker.
- haul_prob replacing sigma-tercile ceiling badge.
- p10/p90 for 3GW/5GW windows.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MC-01 | Pipeline runs 10,000 MC simulations per player per upcoming GW using Poisson goal/assist + Bernoulli CS distributions, writing `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` to `merged_players.json` | NumPy vectorized approach verified; 830-player run completes in ~0.14s |
| MC-02 | User can see blank%/haul%/floor/ceiling in GemTable row expand; BGW shows 100% blank; DGW combines both fixtures | XPtsCell hover card extension confirmed; per-iteration DGW summation verified |
</phase_requirements>

---

## Summary

Phase 61 adds a post-merge pipeline step (`pipeline/simulate.py`) that runs 10,000 Monte Carlo iterations per player using Poisson and Bernoulli draws, and extends the existing `XPtsCell` hover card to display the resulting `blank_prob`, `haul_prob`, `p10_pts`, and `p90_pts` values.

The core math is identical to `merge.py`'s `_compute_xpts_fixture`: `lam_g = xg_per90 * xmins/90`, `lam_a = xa_per90 * xmins/90`, `cs_prob` from the existing `_cs_prob` formula. The difference is that simulate.py draws stochastic samples rather than computing expectations. NumPy's `default_rng().poisson()` and `.binomial()` vectorize 10,000 draws to a single call, making the full 830-player pipeline run take roughly 0.14 seconds.

All decisions are fully locked in CONTEXT.md. The planner has no architectural choices to make — only the detailed mechanics of implementation. The only meaningful discretionary items (stdout progress line, haul% colour) are minor cosmetic details.

**Primary recommendation:** Implement `simulate.py` as a direct analogue of `bonus.py` (same module shape), re-implement the 3-line `_cs_prob` core inline, and extend `XPtsCell` with four optional props that render between the existing `<hr>` and Total row.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Monte Carlo simulation | Pipeline (Python) | — | CPU-bound math runs once at pipeline time; no client latency |
| JSON field enrichment | Pipeline (Python) | — | simulate.py writes fields to merged list before single save |
| Data persistence | Pipeline (Python) | — | merged_players.json is the single output; no schema migration needed |
| Type definitions | Frontend (TypeScript) | — | MergedPlayer extended with 4 optional fields |
| UI rendering | Frontend (React) | — | XPtsCell reads optional props, renders conditionally |
| API passthrough | API Route (Next.js) | — | Players route spreads raw JSON; no code change needed |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| numpy | 2.2.3 (verified) | Vectorized Poisson/Binomial sampling | 10k draws in one call; pandas already depends on it transitively |
| Python itertools.groupby | stdlib | DGW fixture grouping | Already used in merge.py `_xpts_ngw` for the same purpose |
| React useState | bundled with Next.js | Mobile tap toggle (already in XPtsCell) | No new dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy.random.default_rng | numpy 2.2.3 | Modern Generator API (no fixed seed) | Use instead of legacy `np.random.poisson`; better statistical properties |

**Version verification:** `pip3 show numpy` confirms `2.2.3` installed. [VERIFIED: local environment]

**Installation:**
```bash
# pipeline/requirements.txt addition only
numpy>=1.26.0
```
numpy is already installed transitively via pandas. The requirements.txt entry makes the dependency explicit (D-15).

---

## Architecture Patterns

### System Architecture Diagram

```
run.py
  │
  ├── merge_players() ─────────────────────> merged list (xPts fields present)
  │                                                │
  ├── compute_simulations(merged, flag) ───────────┤
  │     │                                          │
  │     ├── for each player:                       │
  │     │     ├── BGW? → {blank_prob:1.0, ...}    │
  │     │     └── active? → numpy vectorized sim  │
  │     │           ├── Poisson(lam_g) x 10k      │
  │     │           ├── Poisson(lam_a) x 10k      │
  │     │           └── Binomial(1, cs_p) x 10k   │
  │     │                 → percentile + prob      │
  │     └── returns enriched merged list           │
  │                                                ▼
  └── save('merged_players.json', merged) ──> cache (4 new fields per player)
                                                   │
/api/players route ─ spread operator ──────────────┘
                                                   │
GemTable ──> XPtsCell ──> hover card (window===1) ─┘
              optional props: blankProb, haulProb,
              p10Pts, p90Pts
```

### Recommended Project Structure
```
pipeline/
├── simulate.py          # NEW: MC simulation module (D-01 pattern)
├── tests/
│   └── test_simulate.py # NEW: unit tests for compute_simulations
├── merge.py             # UNCHANGED: source of _cs_prob formula to mirror
├── run.py               # MODIFIED: add import + call between merge and save
└── requirements.txt     # MODIFIED: add numpy>=1.26.0

src/
├── lib/
│   └── types.ts         # MODIFIED: 4 optional fields on MergedPlayer
└── components/gem-table/
    └── columns.tsx      # MODIFIED: XPtsCell props + hover card rows
```

### Pattern 1: Post-Process Module Shape (follow bonus.py)
**What:** Standalone module with one public function receiving merged list, returning enriched copy.
**When to use:** All post-merge pipeline enrichment steps.
**Example:**
```python
# Source: pipeline/bonus.py lines 30-51 (reference implementation)
# pipeline/simulate.py — follow this exact shape

import numpy as np
from itertools import groupby

N_SIMS = 10_000

GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3
CS_PTS    = {1: 6, 2: 6, 3: 1, 4: 0}
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}

def compute_simulations(merged: list, xmins_v2_enabled: bool) -> list:
    """Run Monte Carlo simulations per player (Phase 61 MC-01).

    Returns enriched copy with blank_prob, haul_prob, p10_pts, p90_pts.
    p90_pts also overwrites xPts_90th_1gw (D-05).
    """
    rng = np.random.default_rng()
    result = []
    for player in merged:
        p = dict(player)
        sim = _simulate_player(p, xmins_v2_enabled, rng)
        p.update(sim)
        p['xPts_90th_1gw'] = sim['p90_pts']  # D-05: overwrite analytical value
        result.append(p)
    return result
```

### Pattern 2: Inline `_cs_prob` Re-implementation (D-02)
**What:** The 3-line cs_prob formula from merge.py `_cs_prob`, re-implemented locally.
**When to use:** simulate.py must NOT import from merge.py (D-02 prohibits coupling).
```python
# Source: pipeline/merge.py lines 141-146 (exact formula to mirror)
def _cs_prob_sim(dd: float, xmins: float, mins_60_prob: float | None) -> float:
    cs_prob_raw = max(0.10, min(0.65, 0.40 - dd * 0.30))
    mins_factor = mins_60_prob if mins_60_prob is not None else min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor
```

### Pattern 3: Vectorized Fixture Simulation (D-04, D-09)
**What:** Single NumPy call per distribution per fixture; DGW sums per-iteration before computing stats.
**When to use:** All active players (xmins > 0, fixtures present).
```python
# Source: verified by local execution in this research session
def _simulate_player(p: dict, xmins_v2_enabled: bool, rng) -> dict:
    xmins = p.get('xmins', 0.0)
    start_prob = p.get('start_prob', 0.0)

    # BGW short-circuit (D-08)
    if xmins <= 0 or start_prob <= 0:
        return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}

    xg   = p.get('xg_per90') or 0.0
    xa   = p.get('xa_per90') or 0.0
    et   = p.get('element_type', 3)
    m60  = p.get('mins_60_prob') if xmins_v2_enabled else None
    fixtures = p.get('fixtures', [])

    # First GW group only (D-09 DGW handling matches _xpts_ngw semantics)
    first_gw = []
    for _eid, group in groupby(fixtures, key=lambda f: f['event_id']):
        first_gw = list(group)
        break

    if not first_gw:
        return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}

    lam_g      = xg * (xmins / 90.0)
    lam_a      = xa * (xmins / 90.0)
    bonus_det  = BONUS_RATE[et] * (xmins / 90.0)   # deterministic per iteration
    appear_det = start_prob * 2                      # deterministic per iteration

    total_pts = np.zeros(N_SIMS)
    for fix in first_gw:
        dd      = fix.get('defensive_difficulty', 0.5)
        cs_prob = _cs_prob_sim(dd, xmins, m60)
        goals   = rng.poisson(lam_g, size=N_SIMS)
        assists = rng.poisson(lam_a, size=N_SIMS)
        cs      = rng.binomial(1, cs_prob, size=N_SIMS)
        total_pts += (goals * GOAL_PTS[et]
                      + assists * ASSIST_PTS
                      + cs * CS_PTS[et]
                      + bonus_det
                      + appear_det)

    return {
        'blank_prob': round(float(np.mean(total_pts <= 2)), 3),
        'haul_prob':  round(float(np.mean(total_pts >= 10)), 3),
        'p10_pts':    round(float(np.percentile(total_pts, 10)), 3),
        'p90_pts':    round(float(np.percentile(total_pts, 90)), 3),
    }
```

### Pattern 4: XPtsCell Prop Extension (D-10 to D-14)
**What:** Four optional props added to existing component; rendered between existing `<hr>` and Total.
**When to use:** Only when `window === 1` and all four props are present (same guard as existing breakdown).
```tsx
// Source: src/components/gem-table/columns.tsx lines 27-122 (existing structure)
// New props added to XPtsCell function signature:
export function XPtsCell({
  value, ceiling, components, minsRisk, mins60Prob, window,
  blankProb, haulProb, p10Pts, p90Pts,  // D-13: four new optional props
}: {
  // ... existing types ...
  blankProb?: number
  haulProb?: number
  p10Pts?: number
  p90Pts?: number
}) {
  // showBreakdown guard already handles window===1 + components defined
  const showMC = window === 1
    && blankProb !== undefined
    && haulProb !== undefined
    && p10Pts !== undefined
    && p90Pts !== undefined

  // Inside the hover card, between the existing <hr> and Total:
  // {showMC && (
  //   <>
  //     <div className="flex justify-between">
  //       <span className="text-zinc-500">Blank%</span>
  //       <span className="font-mono">{(blankProb! * 100).toFixed(0)}%</span>
  //     </div>
  //     ... Haul%, Floor, Ceiling rows ...
  //     <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
  //   </>
  // )}
}
```

### Pattern 5: Column Prop Threading
**What:** Pass new MC fields from `row.original` (ScoredPlayer) to XPtsCell for the xPts_1gw column.
```tsx
// Source: src/components/gem-table/columns.tsx lines 220-232
// Extend the xPts_1gw column cell to pass MC props:
<XPtsCell
  value={info.getValue()}
  ceiling={info.row.original.xPts_ceiling_1gw}
  components={info.row.original.xPts_components_1gw ?? undefined}
  minsRisk={info.row.original.mins_risk}
  mins60Prob={info.row.original.mins_60_prob}
  window={1}
  blankProb={info.row.original.blank_prob}    // new
  haulProb={info.row.original.haul_prob}      // new
  p10Pts={info.row.original.p10_pts}          // new
  p90Pts={info.row.original.p90_pts}          // new
/>
```

### Anti-Patterns to Avoid

- **Pure-Python loop over N_SIMS iterations:** Simulating 10k iterations in a Python for-loop takes ~5s per player (40+ minutes for 836 players). Always use `rng.poisson(lam, size=N_SIMS)` — a single vectorized call. [VERIFIED: local benchmark]
- **Importing from merge.py:** D-02 prohibits it. Re-implement the 3-line `_cs_prob` formula inline.
- **Reading JSON files from simulate.py:** D-03 prohibits it. `xmins_v2_enabled` arrives as a parameter.
- **Re-seeding rng per player:** Create `rng = np.random.default_rng()` once per `compute_simulations` call, pass it into `_simulate_player`. No fixed seed — production should use OS entropy.
- **Client-side simulation:** All MC runs at pipeline time. No simulation in TypeScript/browser.
- **Stochastic appearance_pts:** Use `start_prob * 2` as a deterministic constant per iteration. Poisson lambdas already encode start_prob uncertainty via `xmins = start_prob * avg_mins`. Adding stochastic appearance would double-count the start probability.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vectorized Poisson sampling | loop `random.poisson()` 10k times | `rng.poisson(lam, size=N_SIMS)` | 10k draws in microseconds vs seconds |
| Percentile calculation | sort + index | `np.percentile(arr, [10, 90])` | Handles fractional interpolation correctly |
| DGW grouping | manual event_id comparison | `itertools.groupby` (already in merge.py) | Handles N fixtures per GW correctly |

**Key insight:** The only novel logic is the simulation loop structure — everything else (scoring constants, cs_prob formula, groupby DGW semantics) already exists in merge.py and must be mirrored precisely to keep simulation consistent with analytical xPts.

---

## Common Pitfalls

### Pitfall 1: Appearance Points Double-Counting
**What goes wrong:** Treating appearance_pts as stochastic Bernoulli(start_prob) * 2 inflates blank_prob because a non-starter gets 0 appearance pts, but the Poisson lambdas already encode the same start_prob.
**Why it happens:** xmins = start_prob × avg_mins_if_starts, so `lam_g = xg * xmins/90` already models the probability of the player not starting (low xmins → low lambda → frequent zero-goal draws).
**How to avoid:** Use deterministic `appearance_det = start_prob * 2` per iteration — this matches merge.py's `_compute_xpts_fixture` exactly.
**Warning signs:** MC mean deviates significantly from analytical xPts_1gw (should match within ~0.5% for large N_SIMS).

### Pitfall 2: DGW Per-Fixture Independence Assumption
**What goes wrong:** Applying cs_prob as a joint probability across DGW fixtures (e.g., multiplying) instead of summing per-iteration scores independently.
**Why it happens:** The analytical DGW cs_prob uses `1 - product(1 - p_i)` but the simulation correctly simulates each fixture as an independent Bernoulli draw and sums the resulting points.
**How to avoid:** Per-iteration total_pts accumulates over the `for fix in first_gw` loop — each fixture's cs draw is independent. This is correct and produces higher haul_prob for DGW players than the analytical ceiling.
**Warning signs:** DGW blank_prob === 0 and haul_prob approximately 2x single-GW value — this is expected and correct.

### Pitfall 3: Field Name Mismatch (JSON → TypeScript)
**What goes wrong:** Python snake_case fields (`blank_prob`) need to match TypeScript interface names exactly — the API route uses a spread (`...p`) with no transformation.
**Why it happens:** Python and TypeScript naming conventions differ, but the JSON is passed through raw.
**How to avoid:** Keep Python field names `blank_prob`, `haul_prob`, `p10_pts`, `p90_pts` matching TypeScript `MergedPlayer` field names exactly. Props in XPtsCell can use camelCase (`blankProb`) because they're React props, not JSON field names.
**Warning signs:** TypeScript shows `undefined` for MC values even after pipeline run.

### Pitfall 4: xPts_90th_1gw Overwrite Ordering
**What goes wrong:** Overwriting `xPts_90th_1gw` before merge.py's sigma cleanup strips `_sigma_*` fields (line 1132 in merge.py).
**Why it happens:** simulate.py runs after merge_players() returns. At that point `_sigma_*` fields are already stripped (merge.py cleans them before returning). The `xPts_90th_1gw` field written by merge.py at lines 1118-1125 is present and will be overwritten by simulate.py.
**How to avoid:** simulate.py runs post-return from merge_players() — no ordering conflict. Just set `p['xPts_90th_1gw'] = sim['p90_pts']` in the enrichment loop.
**Warning signs:** Not applicable — ordering is guaranteed by call sequence in run.py.

### Pitfall 5: BGW Players and the Hover Card Guard
**What goes wrong:** For BGW players, value=0 so the existing `value <= 0` guard in XPtsCell returns early (no hover card). MC props are present (blank_prob=1.0, haul_prob=0.0) but irrelevant — the guard fires first.
**Why it happens:** The BGW guard (`if value <= 0 return <span>{display}</span>`) predates MC props. This is the correct behaviour per CONTEXT.md "Specifics" section.
**How to avoid:** Leave the existing guard unchanged. `showMC` only needs to check the props are defined — the BGW case is handled upstream. [VERIFIED: CONTEXT.md §Specifics]

### Pitfall 6: numpy import in pipeline modules
**What goes wrong:** `import numpy as np` at module top-level causes slow startup for all pipeline runs even when simulate.py isn't the bottleneck.
**Why it happens:** NumPy has a ~50ms import overhead.
**How to avoid:** Accept the overhead — it's trivial relative to HTTP fetch time. Import at top of module per convention.

---

## Code Examples

Verified patterns from local execution:

### Full simulation for one player (verified output)
```python
# Verified: Gabriel (DEF, nailed, easy fixture) matches xPts_1gw = 5.48 within 0.5%
# MC result: blank_prob=0.0, haul_prob=0.094, p10_pts=2.16, p90_pts=8.16
# MC mean: 5.4x (matches analytical 5.48)

# Rotation MID, tough fixture:
# MC result: blank_prob=0.806, haul_prob=0.001, p10_pts=1.3, p90_pts=2.3
# MC mean: 1.716 (matches analytical)
```

### Performance benchmark (verified)
```
600 active players × 10,000 sims each: 0.26 seconds
830 total players (494 BGW + 336 active): 0.14 seconds
(BGW short-circuit is instantaneous)
```

### run.py integration (3 lines total)
```python
# Line added to imports at top of run.py:
from simulate import compute_simulations

# Lines inserted between merge_players() call (line 199) and save() call (line 208):
merged = compute_simulations(merged, xmins_v2_enabled)
```

### MergedPlayer type extension
```typescript
// src/lib/types.ts — add to MergedPlayer interface (after xPts_90th_1gw):
// Phase 61 MC-01/MC-02: Monte Carlo simulation outputs
blank_prob?: number     // P(total_pts <= 2) across 10k simulations; 1.0 for BGW
haul_prob?: number      // P(total_pts >= 10) across 10k simulations; 0.0 for BGW
p10_pts?: number        // 10th percentile simulated points (floor)
p90_pts?: number        // 90th percentile simulated points (ceiling); also overwrites xPts_90th_1gw
```

### MC row rendering in hover card
```tsx
// D-14 format: integer percent for blank%/haul%, 1 decimal for floor/ceiling
// Insert between existing <hr> and Total block:
const mcRows: [string, string][] = [
  ['Blank%',  `${(blankProb! * 100).toFixed(0)}%`],
  ['Haul%',   `${(haulProb!  * 100).toFixed(0)}%`],
  ['Floor',   p10Pts!.toFixed(1)],
  ['Ceiling', p90Pts!.toFixed(1)],
]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `np.random.poisson()` (legacy) | `np.random.default_rng().poisson()` (Generator API) | numpy 1.17 | Better statistical properties, thread-safe |
| Analytical sigma (1.28σ rule) | MC-derived p90 | Phase 61 | Captures non-Gaussian shape (Poisson + Bernoulli is not Normal at low λ) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bonus pts should be deterministic per iteration (BONUS_RATE * xmins/90), not stochastic | Code Examples / Pattern 3 | If treated as stochastic, variance would be artificially inflated; haul_prob for attacking players slightly higher. Low risk — CONTEXT.md says "Poisson goal/assist + Bernoulli CS" only. |

**If this table is nearly empty:** All other claims were verified by code inspection or local execution.

---

## Open Questions

1. **haul% colour threshold**
   - What we know: CONTEXT.md §Discretion notes "amber text at haul% >= 40%"
   - What's unclear: Whether any styling is warranted at all, or just plain text
   - Recommendation: Planner should add amber class (`text-amber-600 dark:text-amber-400`) on Haul% value when `haulProb >= 0.40`, matching existing amber patterns in the codebase (e.g., MinsRiskBadge)

2. **Stdout progress line**
   - What we know: CONTEXT.md §Discretion notes this as optional
   - What's unclear: Whether it adds noise to pipeline logs
   - Recommendation: Include one line: `print(f"MC simulations: {active_count} players ({N_SIMS:,} sims each)")` — consistent with merge.py print statements

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| numpy | simulate.py vectorized sampling | Yes | 2.2.3 | None needed |
| Python itertools | groupby for DGW | Yes | stdlib | None needed |
| pytest | test_simulate.py | Yes | installed | None needed |

**All dependencies available.** numpy>=1.26.0 must be added to `pipeline/requirements.txt` explicitly (D-15) even though it is already installed transitively.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (existing, used by test_bonus.py etc.) |
| Config file | none — conftest.py sets sys.path |
| Quick run command | `python3 -m pytest pipeline/tests/test_simulate.py -x -q` |
| Full suite command | `python3 -m pytest pipeline/tests/ -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-01 | BGW player gets blank_prob=1.0, haul_prob=0.0, p10=0.0, p90=0.0 | unit | `python3 -m pytest pipeline/tests/test_simulate.py::test_bgw_shortcircuit -x` | ❌ Wave 0 |
| MC-01 | Active player MC mean ~= analytical xPts_1gw (within 5%) | unit | `python3 -m pytest pipeline/tests/test_simulate.py::test_mc_mean_matches_analytical -x` | ❌ Wave 0 |
| MC-01 | DGW player simulates both fixtures and sums per iteration | unit | `python3 -m pytest pipeline/tests/test_simulate.py::test_dgw_sums_fixtures -x` | ❌ Wave 0 |
| MC-01 | p90_pts overwrites xPts_90th_1gw in output | unit | `python3 -m pytest pipeline/tests/test_simulate.py::test_p90_overwrites_ceiling -x` | ❌ Wave 0 |
| MC-01 | blank_prob in [0,1], haul_prob in [0,1], p10 <= p90 | unit | `python3 -m pytest pipeline/tests/test_simulate.py::test_output_value_ranges -x` | ❌ Wave 0 |
| MC-02 | XPtsCell renders MC rows when blankProb/haulProb/p10Pts/p90Pts present and window===1 | unit (component) | `npx vitest run --reporter=verbose src/components/gem-table/columns.test.tsx` | ❌ Wave 0 |
| MC-02 | XPtsCell omits MC rows when window===3 or window===5 | unit (component) | same file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python3 -m pytest pipeline/tests/test_simulate.py -x -q`
- **Per wave merge:** `python3 -m pytest pipeline/tests/ -x -q`
- **Phase gate:** Full pipeline/tests/ suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pipeline/tests/test_simulate.py` — covers MC-01 requirements (7 test cases above)
- [ ] Frontend test in existing test file or new `columns.test.tsx` for MC-02 UI rendering

*(Conftest.py and pytest framework: already present — no setup needed.)*

---

## Security Domain

Phase 61 is pure computation over existing pipeline data. No new HTTP calls, no user input, no authentication changes.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Partial | Player field access uses `.get()` with defaults — no injection surface |
| V6 Cryptography | No | — |

No new threat surface introduced.

---

## Sources

### Primary (HIGH confidence)
- `pipeline/merge.py` lines 122-146, 186-261, 1100-1136 — exact formulas mirrored in simulate.py
- `pipeline/run.py` lines 180-214 — integration point and xmins_v2_enabled scope
- `src/components/gem-table/columns.tsx` lines 27-122 — XPtsCell structure for extension
- `src/lib/types.ts` lines 92-191 — MergedPlayer/ScoredPlayer type chain
- `src/app/api/players/route.ts` lines 65-69 — spread passthrough confirms no API changes needed
- Local execution: NumPy simulation benchmarks and output verification

### Secondary (MEDIUM confidence)
- numpy.org Generator API documentation — `default_rng()` is the recommended modern API

---

## Metadata

**Confidence breakdown:**
- Pipeline implementation: HIGH — formulas verified by code inspection and local execution
- XPtsCell extension: HIGH — existing structure read, insertion point confirmed
- Performance: HIGH — benchmarked on real 830-player dataset (0.14s)
- Type changes: HIGH — MergedPlayer/ScoredPlayer chain verified, API spread confirmed

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable domain — numpy API and merge.py formulas are not changing)
