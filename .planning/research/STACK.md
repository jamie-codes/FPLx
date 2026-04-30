# Technology Stack — v1.6 Squad Optimiser

**Project:** FPL Analyst
**Researched:** 2026-04-30
**Confidence:** HIGH
**Scope:** NEW additions for v1.6 Squad Optimiser ONLY.

Existing validated stack (do not re-add): `next@16.2.1`, `react@19.2.4`, `@tanstack/react-query@^5.95.2`, `@tanstack/react-table@^8.21.3`, `@vercel/blob@^2.3.1`, `zod@^4.3.6`, `immer@^11.1.4`, `use-immer@^0.11.0`, `tailwindcss@^4`, `vitest@^4.1.2`; Python: `requests>=2.32.0`, `pandas>=2.2.0`, `numpy>=2.2.0`, `scipy>=1.14.0`, `vercel-blob>=0.4.0`, `python-dotenv>=1.0.0`, `soccerdata==1.8.8`

---

## Brute-Force vs ILP: The Core Question

### Is brute-force feasible?

**Depends on the sub-problem. This matters enormously for the architecture.**

#### Standalone squad builder (600 players → 15)

C(600, 15) ≈ 3 × 10^29 candidates. Brute force is computationally impossible.

This is a canonical Mixed-Integer Linear Program (MILP). Every serious FPL optimiser in the ecosystem uses LP/ILP for this. An ILP solver finds the provably optimal 15-player squad in well under one second at 600 binary variables.

The constraints map cleanly to a MILP formulation:
- **Objective:** Maximise sum(xPts × x_i) for all players i
- **Budget:** sum(cost_i × x_i) ≤ 100.0
- **Squad size:** sum(x_i) = 15
- **Positional:** sum(x_i for GK) = 2; DEF = 5; MID = 5; FWD = 3
- **Club limit:** sum(x_i for club j) ≤ 3 for each j in 1..20
- **All variables binary:** x_i ∈ {0, 1}

This is a true Integer Programming problem because fractional players are meaningless. Relaxing to LP (allowing fractional x_i) gives a loose upper bound but not a valid squad.

#### Best 11 + formation from a known 15-player squad

C(15, 11) = 1,365 total subsets. Formation-validity filter (1 GK, min 3 DEF, max 5 DEF, min 2 MID, max 5 MID, min 1 FWD, max 3 FWD) reduces this to roughly 200–400 valid lineups depending on squad composition. Each candidate scores in O(11) operations.

**Brute-force enumeration is instant here (<1ms). No ILP library needed.**

A TypeScript function that iterates all C(15,11) subsets, checks positional constraints, scores each against xPts, and returns the maximum is 50–80 lines of plain TypeScript. This is the right approach.

#### Transfer-aware optimiser (1–2 free transfers from current 15)

For 1 transfer: 15 sell candidates × ~585 buy candidates per position slot ≈ 8,775 candidate swaps. Greedy scoring of each is fast in TypeScript.

For 2 transfers: ~15 × 14 × 585 × 584 / 2 ≈ 36M pairs in the naïve case. Needs pruning. The existing greedy + 1-level look-ahead engine (`generatePlan()`, Phase 20) already handles this correctly and is already implemented.

**Recommendation: reuse the existing planning engine for transfer-aware mode.** The Squad Optimiser tab reformats the same output into a side-by-side current vs optimised comparison view. No new algorithm is required.

#### Wildcard / Free Hit mode

Identical to standalone squad builder but transfer-cost penalty = 0. Reuse the same ILP formulation with no modifications.

### Summary of approaches per sub-problem

| Sub-problem | Approach | Rationale |
|---|---|---|
| Standalone squad builder (600 → 15, £100m) | MILP via `scipy.optimize.milp` in pipeline | Brute force impossible; ILP solves in <1s |
| Wildcard / Free Hit mode | Reuse squad builder MILP (transfer cost = 0) | Same problem, same solution |
| Best 11 + formation from 15 | Pure TypeScript enumeration | C(15,11)=1365, sub-millisecond, no library needed |
| Captain / VC recommendation | TypeScript sort by xPts_90th_1gw descending | Already computed in pipeline as `xPts_90th_1gw` |
| Bench order | TypeScript sort by xPts_1gw ascending | 4 bench players, trivial sort |
| Transfer-aware 1–2 FT | Reuse existing `generatePlan()` engine | Already implemented; reformatting output is the work |

---

## New Python Dependency

### `scipy.optimize.milp` (already installed)

`scipy` is already in `pipeline/requirements.txt` (added in v1.4 for `scipy.stats` distributions). The `milp` function was added in scipy 1.9 (2022) and uses HiGHS as its solver backend.

**No new dependency to install.** Just import `scipy.optimize.milp` in the new `optimiser.py` module.

```python
from scipy.optimize import milp, LinearConstraint, Bounds
import numpy as np
```

HiGHS is bundled in every scipy wheel (Linux, macOS, Windows). No PATH configuration needed in GitHub Actions.

**Verify the installed version provides milp:**

```bash
pip show scipy  # must be >= 1.9.0; current pipeline has >= 1.14.0
```

The pin in requirements.txt is `scipy>=1.14.0`, which guarantees milp availability.

### Why not PuLP or python-mip

| Library | Version | Why not |
|---|---|---|
| PuLP | 3.3.0 (Sept 2025) | Excellent modelling API but requires `pip install pulp[cbc]` or `pulp[highs]` for solver binaries — extra dependency for no gain over scipy.milp which already has HiGHS bundled |
| python-mip | 1.17.6 (Mar 2026) | Ships CBC; HiGHS support exists but had reported Windows issues in Jan 2025. More expressive API but overkill for this problem size |
| scipy.optimize.linprog | in scipy | LP relaxation only — cannot enforce integer (binary) variables |

---

## New TypeScript / npm Dependencies

**None.**

The frontend work for v1.6 consists of:

| Feature | How implemented | Why no new package |
|---|---|---|
| Best 11 + formation enumeration | Pure TypeScript function, ~60 lines | C(15,11) enumeration with position constraints is trivial |
| Captain / VC display | Sort existing `xPts_90th_1gw` field | Already on `MergedPlayer`; no computation needed |
| Bench order display | Sort existing `xPts_1gw` field | Already available |
| Side-by-side comparison | Two TanStack Table instances or flex layout | Existing table primitives |
| Wildcard/FH toggle | `useState` boolean, reuses existing chip-toggle pattern | Existing UI pattern from `ChipStrategyPanel` |
| Squad builder form | Input + TanStack Query fetch | Existing patterns |

### Browser-side ILP: not needed and not recommended

If wildcard/squad-builder mode were to run client-side, the candidate library would be `glpk.js` (v5.0.0, Dec 2025) — a WASM port of GLPK for browser and Node.js with a JSON interface for LP/MILP.

**Why this is not the right choice for this project:**

1. **WASM file-not-found in Next.js serverless** — glpk.js is a known pain point in Next.js Route Handlers and Vercel deployments. The WASM file must be explicitly included via `experimental.outputFileTracingIncludes` in `next.config.js`. Client-side usage (`'use client'`) avoids this, but then the WASM (~1MB) adds meaningfully to the first-load JS bundle.

2. **Architecture fit** — The standalone squad builder runs over all ~600 players, which is natural pipeline territory. Every other data computation in this app runs in the Python pipeline and is served via Vercel Blob. Deviating from this pattern for one feature adds complexity without benefit.

3. **The pipeline already pre-computes optimal squads** — There is no interactive constraint (e.g. the manager's exact current squad value) that prevents pre-computation. The wildcard result is the same for any manager who wants to know "best squad available today at £100m".

**Decision: all optimisation runs in the Python pipeline. The client receives pre-computed JSON.**

---

## New Pipeline JSON Artifacts

| File | Content | Consumer |
|---|---|---|
| `optimal_squad.json` | `{standalone_15: [...player_ids], lineup_11: [...], bench_order: [...], captain_id, vice_captain_id, formation: string}` | `/api/optimal-squad` Route Handler |

The optimal squad is computed once per daily pipeline run. The manager views the pre-computed result.

For transfer-aware mode, the existing `/api/players` data is used client-side via the existing greedy `generatePlan()` engine — no new pipeline artifact needed.

---

## Integration Architecture

```
GitHub Actions cron (daily)
└── pipeline/run.py
    ├── [existing] merge.py → merged_players.json
    ├── [NEW] optimiser.py → optimal_squad.json
    │       Uses scipy.optimize.milp
    │       Inputs: merged_players.json (xPts_1gw, now_cost, element_type, team)
    │       Outputs: optimal 15-player squad + lineup + captain/VC
    └── upload.py → Vercel Blob (adds optimal_squad.json)

Next.js Route Handler: /api/optimal-squad
└── reads Vercel Blob → returns optimal_squad.json

React client (TypeScript)
└── useOptimalSquad() TanStack Query hook (6h staleTime, same pattern as usePlayers)
    └── OptimiserTab component
        ├── Pre-computed optimal squad from pipeline (wildcard/standalone)
        ├── lineup = enumerateBest11(currentSquad)  ← pure TS, no library
        │   scores all C(15,11)=1365 subsets with positional constraints
        ├── captain = squad.captain_id (from pipeline)
        ├── bench = squad.bench_order (from pipeline)
        └── Transfer-aware mode: reuses generatePlan() engine from PlannerTab
```

---

## What NOT to Add

| Item | Reason |
|---|---|
| `glpk.js` or any WASM LP solver on the client | Architecture mismatch; pipeline-side ILP is already the right pattern; WASM bundle cost and Next.js serverless WASM issues not worth it |
| PuLP or python-mip | scipy.milp with HiGHS already bundled; zero net gain from adding a separate library |
| Custom genetic algorithm or simulated annealing | ILP finds the provably optimal solution faster and with less code; heuristics add complexity without accuracy |
| Real-time per-user optimisation server | Personal tool; pre-computed daily result is sufficient; no need for on-demand compute |
| Gurobi / CPLEX | Commercial solvers; overkill and not free for a personal tool |
| `mathjs` or any browser stats library | All scoring uses pre-computed pipeline xPts values; no browser-side distribution math |

---

## Confirmed Versions (verified 2026-04-30)

| Library | Version | Source | Role |
|---|---|---|---|
| scipy (Python) | current `1.15.x`–`1.17.x`; `milp` stable since 1.9 | pypi.org/project/scipy | ILP solver backend (HiGHS via scipy.optimize.milp) |
| numpy (Python) | current `2.4.x` | pypi.org/project/numpy | Array construction for milp constraint matrices |
| PuLP (Python, not recommended) | 3.3.0 (Sept 2025) | pypi.org/project/PuLP | Evaluated; not chosen |
| python-mip (Python, not recommended) | 1.17.6 (Mar 2026) | pypi.org/project/mip | Evaluated; not chosen |
| glpk.js (TS, not recommended) | 5.0.0 (Dec 2025) | npm show glpk.js | Evaluated; not chosen |

---

## Sources

- SciPy MILP docs: https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html
- HiGHS solver: https://highs.dev/
- FPL as ILP (Geek Culture): https://medium.com/geekculture/linearly-optimising-teams-for-pl-fantasy-league-11931aed18b7
- FPL brute-force infeasibility: https://medium.com/@vedantmodani/optimising-fantasy-premier-league-a-decision-science-approach-part-1-26c103763427
- FPL dynamic programming (Eirikur 2024): https://eirikur.dev/blog/2024-08-05-fpl-and-dp/
- PuLP PyPI: https://pypi.org/project/PuLP/
- python-mip PyPI: https://pypi.org/project/mip/
- python-mip installation / bundled CBC: https://python-mip.readthedocs.io/en/latest/install.html
- glpk.js GitHub: https://github.com/jvail/glpk.js/
- WASM in Next.js serverless issue: https://github.com/vercel/next.js/issues/54395
- FPL Review MILP transfer solver: https://docs.fplreview.com/the-model/solvers/solver-comparison/

---

*Stack research for: FPL Analyst v1.6 Squad Optimiser*
*Researched: 2026-04-30*
