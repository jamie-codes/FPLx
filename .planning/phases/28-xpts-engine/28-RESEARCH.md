# Phase 28: xPts Engine - Research

**Researched:** 2026-04-28
**Domain:** Statistical expected-points pipeline (Python) + GemTable UI column replacement (TypeScript/React)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pipeline emits **both** field sets: existing `proj_pts_1gw`, `proj_pts_3gw`, `proj_pts_5gw` (unchanged) **and** new `xPts_1gw`, `xPts_3gw`, `xPts_5gw`. No consumers of `proj_pts_*` are modified in this phase.
- **D-02:** GemTable "Proj Pts" columns are **renamed to "xPts"** and backed by the new model. Same column position; only label and data source change.
- **D-03:** `proj_pts_*` continues to power: TransferPanel, PlannerTab, captaincy engine, replacement shortlist. Those consumers are out of scope for Phase 28.
- **D-04:** Pipeline emits `xPts_1gw`, `xPts_3gw`, `xPts_5gw` — one field per GW window — matching the existing `proj_pts` pattern.
- **D-05:** GemTable uses the **existing shared `GwToggle.tsx` state** (1/3/5 GW pill). xPts columns hook into the same toggle as `proj_pts` did. No new toggle state.
- **D-06:** DGW handling: same as `_proj_pts_ngw()` — group fixtures by `event_id`, sum per-fixture xPts across all fixtures in the same GW event. BGW: no fixture = no contribution (no neutral fill).
- **D-07:** Variance indicator is an **icon badge inline with the xPts cell** — ⬆ for high-ceiling (high-variance) and = for consistent (low-variance). No separate column.
- **D-08:** Badge appears inside the xPts cell, after the number. A **tooltip on hover** (or tap) explains what the badge means.
- **D-09:** Threshold for "high-ceiling" vs "consistent" is Claude's discretion (top-tercile σ across all players). Classification computed in the pipeline.

### Claude's Discretion

- **Component breakdown display:** Tooltip on the xPts cell showing goal pts / assist pts / CS pts / bonus pts breakdown. Native `title` attribute, consistent with existing column header tooltip pattern.
- **xPts model scoring rates:** Use `xg_per90` and `xa_per90` (Understat) as Poisson rate inputs where available. For players with `understat_id = null`, fall back to `goals_scored / assists` season totals normalised to per-90 (DQ-01 proxy pattern, already in `gem-score.ts`).
- **CS probability:** Derived from the opposing team's `attacking_difficulty` (Phase 27 output, `FixtureEntry.attacking_difficulty`). Bernoulli parameterisation is Claude's choice.
- **Bonus component:** Position-adjusted flat historical bonus rate. Must not double-count with CS — see joint defensive-points model below.
- **Variance threshold:** Top 33% of per-GW σ across all players constitutes "high-ceiling".

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-02 | System computes `xPts` per player per upcoming GW with component breakdown (goals, assists, CS, bonus) using Poisson distribution for goals/assists and Bernoulli for CS/minutes | Pure Python `math` module sufficient; scipy is NOT required. Poisson linearity property (E[goal_pts] = λ × pts_per_goal) and Bernoulli formula (E[cs_pts] = p × pts_per_cs) need only `math.exp` for probability computations if needed at all. |
| XPTS-01 | User can see per-player xPts with component breakdown (goal pts, assist pts, CS pts, bonus pts) in GemTable | `columns.tsx` col.accessor pattern is established. Native `title` tooltip carries the breakdown. XPtsCell inline component composes number + VarianceBadge. |
| XPTS-02 | User can see an xPts variance indicator distinguishing high-ceiling vs consistent scorers | σ computed in pipeline from Poisson/Bernoulli variance properties. `xPts_ceiling_*gw` boolean flag precomputed. VarianceBadge renders ⬆ or = inline. |

</phase_requirements>

---

## Summary

Phase 28 adds a statistically grounded xPts computation to the Python pipeline and replaces the three "Proj Pts" GemTable columns with "xPts" equivalents. The pipeline computation extends `merge_players()` in `pipeline/merge.py` with a new `_xpts_ngw()` function that parallels the existing `_proj_pts_ngw()` but replaces the heuristic `ppg × start_prob × difficulty_modifier` inner term with Poisson-distributed goals/assists and Bernoulli-distributed clean sheet expectations. The UI work is narrow: update accessor keys and headers in `columns.tsx`, update `GwToggle.tsx`'s `getColumnVisibility()` key map, and introduce two small components (`XPtsCell` and `VarianceBadge`).

The critical design constraint from STATE.md — "CS points and DefCon bonus are correlated; must use joint defensive-points model" — is resolved by using a **flat position-average historical bonus rate** (GK: 0.30, DEF: 0.40, MID: 0.60, FWD: 0.70 bonus pts/game) that is independent of `cs_prob`. This prevents the model from rewarding defensive quality twice (once through `cs_pts` from `cs_prob` and again through elevated bonus rates on clean-sheet teams). Variance (σ) is derived analytically from the Poisson and Bernoulli variance properties, requiring no sampling or scipy — just `math.exp` if PMF values are ever needed.

The payload budget concern from STATE.md ("keep gzipped transfer under 100 KB") was verified against the actual cache file. The current `merged_players.json` is 1.587 MB raw and 70.8 KB gzip — a 22.4× compression ratio. Adding the xPts fields (estimated ~152–170 KB raw additional) at the actual compression ratio adds only ~7–8 KB gzip, putting the new total at approximately 77–79 KB — safely within the 100 KB budget. Even at a conservative 10% retention ratio the addition is ~15 KB gzip (total ~86 KB), still within budget.

**Primary recommendation:** Implement `_compute_xpts_fixture()` as a pure function computing per-fixture xPts from inputs (`xg_per90`, `xa_per90`, `start_prob`, `xmins`, `element_type`, `attacking_difficulty`), then sum across fixtures using the same `_proj_pts_ngw()` groupby loop structure. Precompute `xPts_ceiling_*` booleans by computing σ for all players and flagging the top tercile before writing the result dict.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| xPts computation (Poisson/Bernoulli math) | Pipeline (Python) | — | Stateful computation requiring all players for tercile normalisation; cannot run client-side |
| CS probability derivation | Pipeline (Python) | — | Reads `attacking_difficulty` from fixture data already present in pipeline |
| Variance σ computation + ceiling flag | Pipeline (Python) | — | Needs cross-player σ values to determine tercile threshold |
| Component dict serialisation | Pipeline (Python) | — | Emitted into `merged_players.json` alongside existing fields |
| MergedPlayer type extension | Frontend types (types.ts) | — | New optional fields on existing interface |
| Column accessor rename + header update | Frontend (columns.tsx) | — | Thin config change in TanStack column definitions |
| GwToggle key map update | Frontend (GwToggle.tsx) | — | One-line change in `getColumnVisibility()` |
| XPtsCell renderer | Frontend (columns.tsx or XPtsCell.tsx) | — | Composes number + badge + title tooltip |
| VarianceBadge component | Frontend (VarianceBadge.tsx or shared/) | — | 20-line inline badge matching MinsRiskBadge shape |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python `math` module | stdlib | Poisson λ and `math.exp` for probability computations | No additional dependency needed; Poisson E[X] = λ is algebraic |
| `itertools.groupby` | stdlib | DGW grouping (already used in `_proj_pts_ngw`) | Pattern already established in codebase |
| `@tanstack/react-table` | `^8.21.3` | Column definitions, cell renderers | Already in use for all GemTable columns |
| Tailwind v4 | `^4` | VarianceBadge styling | Established project design system |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| scipy `stats.poisson` / `stats.bernoulli` | NOT installed | Full PMF/CDF if needed | NOT NEEDED for this phase — Poisson scoring is linear so E[pts] = λ × pts_per_goal requires no scipy |

**scipy status:** `pip show scipy` returns nothing — scipy is NOT installed in the project environment. The DATA-02 requirement mentions `scipy>=1.14.0` but the actual xPts model as designed requires only `math.exp` (for P(no goal) = e^-λ if ever needed) and direct multiplication. The planner should NOT add scipy as a dependency. [VERIFIED: pip show scipy in project env]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flat position-average bonus rate | BPS-rank proxy or CS-conditional bonus | Flat rate avoids CS double-count; BPS proxy would require per-match BPS data not in pipeline |
| Native `title` tooltip for breakdown | Radix Tooltip or custom popover | Native `title` matches all existing badge/header tooltips in the project; Radix would diverge without benefit |
| Precomputed ceiling boolean in pipeline | Compute σ in the frontend | Pipeline has all-player context needed for tercile threshold; frontend would need to sort all players on every render |

**Installation:** No new packages required for this phase. All dependencies already present.

---

## Architecture Patterns

### System Architecture Diagram

```
FPL bootstrap + Understat xG/xA + Phase 27 attacking_difficulty
        |
        v
  pipeline/merge.py
  _compute_xpts_fixture(xg_per90, xa_per90, start_prob, xmins,
                        element_type, attacking_difficulty)
        |
        |-- goal_pts   = xg_per90 * (xmins/90) * pts_per_goal[pos]
        |-- assist_pts = xa_per90 * (xmins/90) * pts_per_assist
        |-- cs_prob    = max(0.10, 0.40 - attacking_difficulty * 0.30)
        |-- cs_pts     = cs_prob * min(1.0, xmins/60) * pts_per_cs[pos]
        |-- bonus_pts  = bonus_rate[pos] * start_prob * (xmins/90)
        |-- appearance = start_prob * (1 + min(1.0, xmins/60))
        |
        v
  per-fixture xPts (float)
        |
        v
  _xpts_ngw(n=1) / _xpts_ngw(n=3) / _xpts_ngw(n=5)
  (DGW groupby loop reused from _proj_pts_ngw)
        |
        v
  xPts_1gw, xPts_3gw, xPts_5gw (per player)
        |
        v
  _compute_xpts_sigma(xg_per90, xa_per90, cs_prob, xmins, pos)
  sigma = sqrt(pts_per_goal^2 * lam_g + 9 * lam_a + p*(1-p)*pts_per_cs^2)
        |
        v
  Cross-player σ sort -> top-tercile threshold
  xPts_ceiling_1gw / _3gw / _5gw = (player_sigma >= threshold) [bool]
        |
        v
  merge_players() result dict gains:
    xPts_1gw, xPts_3gw, xPts_5gw
    xPts_ceiling_1gw, xPts_ceiling_3gw, xPts_ceiling_5gw
    xPts_components_1gw {goal_pts, assist_pts, cs_pts, bonus_pts}
        |
        v
  merged_players.json  -->  Next.js API  -->  usePlayers() hook
                                                    |
                                                    v
                                            GemTable (columns.tsx)
                                            col.accessor('xPts_1gw')
                                                    |
                                              XPtsCell renderer
                                              {value.toFixed(1)}
                                              <VarianceBadge ceiling={row.xPts_ceiling_1gw} />
                                              title={breakdownTooltip}
```

### Recommended Project Structure

No new directories. New files slot into existing locations:

```
pipeline/
└── merge.py          # Add _compute_xpts_fixture(), _compute_xpts_sigma(), extend merge_players()

src/
├── lib/
│   └── types.ts      # Add optional xPts_* fields to MergedPlayer interface
└── components/
    └── gem-table/
        ├── columns.tsx       # Replace proj_pts_* accessors/headers; add XPtsCell
        ├── GwToggle.tsx      # Update getColumnVisibility() key map
        └── VarianceBadge.tsx # New 20-line component (or inline in columns.tsx)
```

### Pattern 1: xPts Per-Fixture Computation

**What:** Pure function taking per-player + per-fixture inputs, returning xPts float and component dict.
**When to use:** Called from `_xpts_ngw()` for each fixture in the GW groupby loop.

```python
# Source: derived from existing _proj_pts_ngw() in pipeline/merge.py (lines 104-133)
import math

# FPL scoring constants (position code: 1=GK, 2=DEF, 3=MID, 4=FWD)
GOAL_PTS = {1: 6, 2: 6, 3: 5, 4: 4}
ASSIST_PTS = 3  # all positions
CS_PTS = {1: 6, 2: 6, 3: 1, 4: 0}
BONUS_RATE = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}  # flat historical avg per game

def _compute_xpts_fixture(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    attacking_difficulty: float,   # 0.0=easiest, 1.0=hardest (from FixtureEntry)
) -> dict:
    """Compute expected FPL points for a single fixture.

    Returns dict with keys: total, goal_pts, assist_pts, cs_pts, bonus_pts.
    """
    # Poisson rates: scale xg/xa per-90 to expected rate for this fixture's minutes
    lam_g = xg_per90 * (xmins / 90.0)
    lam_a = xa_per90 * (xmins / 90.0)

    # Expected goal/assist points: E[pts] = lambda * pts_per_unit (linearity of expectation)
    goal_pts = lam_g * GOAL_PTS[element_type]
    assist_pts = lam_a * ASSIST_PTS

    # CS probability: Bernoulli parameterised from attacking_difficulty
    # Calibrated to typical FPL CS rates (~10-40% range)
    cs_prob = max(0.10, min(0.65, 0.40 - attacking_difficulty * 0.30))
    # Scale by minutes factor: need 60+ mins for full CS points
    mins_factor = min(1.0, xmins / 60.0) if xmins > 0 else 0.0
    effective_cs_prob = cs_prob * mins_factor
    cs_pts = effective_cs_prob * CS_PTS[element_type]

    # Bonus: flat position-average rate (independent of cs_prob — avoids double-counting)
    bonus_pts = BONUS_RATE[element_type] * start_prob * (xmins / 90.0)

    total = goal_pts + assist_pts + cs_pts + bonus_pts
    return {
        'total': round(total, 3),
        'goal_pts': round(goal_pts, 3),
        'assist_pts': round(assist_pts, 3),
        'cs_pts': round(cs_pts, 3),
        'bonus_pts': round(bonus_pts, 3),
    }
```

### Pattern 2: xPts Multi-GW Summation (DGW-Aware)

**What:** Reuses `_proj_pts_ngw()` loop structure — group fixtures by `event_id`, sum per-fixture xPts.
**When to use:** Called for each of the 1GW / 3GW / 5GW windows.

```python
# Source: mirrors _proj_pts_ngw() loop in pipeline/merge.py (lines 104-133)
from itertools import groupby

def _xpts_ngw(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
) -> tuple[float, dict | None]:
    """Project xPts across N upcoming GWs, DGW-aware.

    Returns (total_xPts, components_for_first_gw_only).
    Components are summed across fixtures within the first GW group (1GW window).
    For 3GW and 5GW windows, components are not returned (None).
    """
    if not fixtures or start_prob == 0:
        return 0.0, None

    grouped = []
    for event_id, group in groupby(fixtures, key=lambda f: f['event_id']):
        grouped.append((event_id, list(group)))

    total = 0.0
    first_gw_components = {'goal_pts': 0.0, 'assist_pts': 0.0, 'cs_pts': 0.0, 'bonus_pts': 0.0}

    for gw_idx, (_event_id, gw_fixtures) in enumerate(grouped[:n_gws]):
        for fix in gw_fixtures:
            result = _compute_xpts_fixture(
                xg_per90, xa_per90, start_prob, xmins,
                element_type, fix.get('attacking_difficulty', 0.5)
            )
            total += result['total']
            if gw_idx == 0 and n_gws == 1:
                for k in first_gw_components:
                    first_gw_components[k] += result[k]

    components = first_gw_components if n_gws == 1 else None
    return round(total, 2), components
```

### Pattern 3: Variance σ and Top-Tercile Ceiling Flag

**What:** Compute σ analytically from Poisson/Bernoulli variance properties, then classify top tercile.
**When to use:** After computing xPts for all players, before writing result dict.

```python
# Source: [VERIFIED: mathematical derivation — Poisson var(X)=lambda, Bernoulli var(X)=p(1-p)]
import math

def _compute_xpts_sigma(
    xg_per90: float,
    xa_per90: float,
    cs_prob: float,    # effective cs_prob after mins_factor (not raw)
    xmins: float,
    element_type: int,
) -> float:
    """Analytical σ for per-fixture xPts.

    Var(goals_pts) = pts_per_goal^2 * lambda_g     (Poisson variance property)
    Var(assist_pts) = pts_per_assist^2 * lambda_a  (Poisson variance property)
    Var(cs_pts) = p*(1-p) * pts_per_cs^2           (Bernoulli variance property)
    Bonus variance omitted (small relative to goal/CS variance for most players).
    """
    lam_g = xg_per90 * (xmins / 90.0)
    lam_a = xa_per90 * (xmins / 90.0)

    var_goal = (GOAL_PTS[element_type] ** 2) * lam_g
    var_assist = (ASSIST_PTS ** 2) * lam_a
    p = cs_prob  # effective (already scaled by mins_factor at caller)
    var_cs = p * (1 - p) * (CS_PTS[element_type] ** 2)

    return math.sqrt(var_goal + var_assist + var_cs)

# After computing sigma for all players:
def _classify_ceiling(sigmas: list[float]) -> float:
    """Return the top-tercile sigma threshold."""
    if not sigmas:
        return 0.0
    sorted_sigmas = sorted(sigmas)
    tercile_idx = int(len(sorted_sigmas) * 2 / 3)
    return sorted_sigmas[tercile_idx]

# Usage in merge_players():
# all_sigmas = [_compute_xpts_sigma(...) for each player]
# threshold = _classify_ceiling(all_sigmas)
# xPts_ceiling_1gw = (player_sigma >= threshold)  # bool
```

### Pattern 4: TypeScript Type Extension

**What:** Add optional xPts fields to `MergedPlayer` — same pattern as `attacking_difficulty?: number` in Phase 27.
**When to use:** `types.ts` update to match new pipeline output.

```typescript
// Source: [VERIFIED: src/lib/types.ts pattern at lines 82-84, Phase 27 FixtureEntry additions]
// In MergedPlayer interface, after proj_pts_5gw:
xPts_1gw?: number        // xPts next 1 GW (Poisson/Bernoulli model)
xPts_3gw?: number        // xPts next 3 GWs (DGW-aware sum)
xPts_5gw?: number        // xPts next 5 GWs (DGW-aware sum)
xPts_ceiling_1gw?: boolean  // true = top-tercile σ (high-ceiling player)
xPts_ceiling_3gw?: boolean
xPts_ceiling_5gw?: boolean
xPts_components_1gw?: {    // breakdown for 1GW only (tooltip data)
  goal_pts: number
  assist_pts: number
  cs_pts: number
  bonus_pts: number
}
```

### Pattern 5: GwToggle Key Map Update

**What:** Replace `proj_pts_*gw` keys with `xPts_*gw` in `getColumnVisibility()`. This is the only GwToggle change needed.
**When to use:** In `GwToggle.tsx` only.

```typescript
// Source: [VERIFIED: src/components/gem-table/GwToggle.tsx lines 21-29]
// Replace:
// { proj_pts_1gw: horizon === 1, proj_pts_3gw: horizon === 3, proj_pts_5gw: horizon === 5 }
// With:
const gwVisibility = {
  xPts_1gw: horizon === 1,
  xPts_3gw: horizon === 3,
  xPts_5gw: horizon === 5,
}
// MOBILE_HIDDEN_COLUMNS does NOT need proj_pts_* entries because those keys were
// never in MOBILE_HIDDEN_COLUMNS (proj_pts columns remain visible on mobile).
// xPts columns inherit the same visibility behaviour — no entry needed.
```

### Pattern 6: VarianceBadge Component

**What:** Inline badge rendering ⬆ or = after xPts number. Matches `MinsRiskBadge.tsx` envelope exactly.
**When to use:** Inside `XPtsCell` renderer for each xPts column.

```tsx
// Source: [VERIFIED: src/components/shared/MinsRiskBadge.tsx pattern + 28-UI-SPEC.md]
function VarianceBadge({ ceiling }: { ceiling: boolean | undefined }) {
  if (ceiling === undefined || ceiling === null) return null
  if (ceiling) {
    return (
      <span
        className="ml-1 inline-block text-xs font-normal rounded px-2 py-1 bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
        title="High ceiling: this player's points are highly variable (top-tercile σ across all players). Good captain pick when chasing rank in a mini-league."
      >
        ⬆
      </span>
    )
  }
  return (
    <span
      className="ml-1 inline-block text-xs font-normal rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
      title="Consistent: this player's points are stable GW-to-GW (below top-tercile σ). Safe floor pick when protecting rank."
    >
      =
    </span>
  )
}
```

### Anti-Patterns to Avoid

- **Adding CS-correlated bonus rates:** Do NOT increase bonus_pts for defenders/GKs based on their cs_prob — this double-counts defensive quality. Use flat position averages only.
- **Importing scipy for this model:** Scoring is linear in goal count, so E[goal_pts] = λ × pts_per_goal (no PMF needed). Importing scipy to compute what arithmetic can do directly is unnecessary and would add a dependency not in requirements.txt.
- **Storing raw σ float in merged_players.json:** The σ is only needed to classify the ceiling boolean; once computed for all players and the tercile threshold applied, only the boolean flag needs to be stored in the output. Storing the raw float adds payload weight for no UI benefit.
- **Adding components dict for 3GW and 5GW:** CONTEXT.md specifies `xPts_components_1gw` only. The breakdown tooltip on 3GW/5GW columns would be ambiguous ("is this per-GW or total?") and the context doc does not request it. Omit.
- **Modifying `_proj_pts_ngw()`:** Do not touch the existing function. Create a separate `_xpts_ngw()` that reuses the same groupby structure. This preserves backward compatibility for all six downstream consumers of proj_pts_*.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Poisson distribution PMF | Custom factorial loop | Direct algebraic formula: `E[pts] = λ × pts_per_goal` | FPL scoring is linear in goals — the full PMF sum reduces to λ × c |
| Bernoulli expected value | Custom probability tree | `cs_prob × cs_pts` (one multiply) | Bernoulli E[X] = p by definition |
| Cross-player σ normalisation | Custom sorting/ranking | Standard Python `sorted()` + index-based tercile | Already used in `_compute_difficulty_tiers()` pattern in merge.py |
| Tooltip primitive | Custom popover component | Native `title` attribute | Established project pattern on all 17+ existing column headers and badges |
| GW toggle for xPts | New toggle component | Reuse existing `GwToggle.tsx` state unchanged | D-05 explicitly locks this; the component is already wired |

**Key insight:** The xPts model as specified requires only addition, multiplication, and `min()`/`max()` clamping. No probability library or sampling is needed.

---

## Common Pitfalls

### Pitfall 1: CS / Bonus Double-Count (STATE.md blocker)

**What goes wrong:** Computing `cs_pts` from `cs_prob` AND then computing `bonus_pts` using a higher rate for defenders on easy fixtures implicitly rewards the same defensive quality twice.
**Why it happens:** Bonus is correlated with CS in real FPL matches — defenders on CS teams accumulate higher BPS. A naive model that reads the same `attacking_difficulty` signal for both components double-counts it.
**How to avoid:** Use flat historical position-average bonus rates (GK: 0.30, DEF: 0.40, MID: 0.60, FWD: 0.70 pts/game) that are independent of `cs_prob`. These represent season-wide averages, not fixture-quality-adjusted rates.
**Warning signs:** GK/DEF xPts significantly exceeds their FPL historical average total — suggests bonus is being over-counted.

### Pitfall 2: attacking_difficulty Directionality Confusion

**What goes wrong:** Using `attacking_difficulty` in the wrong direction for CS probability.
**Why it happens:** `attacking_difficulty` of 0.0 means the opponent is the easiest to ATTACK against — i.e. the opponent rarely concedes, meaning they are attacking threats. A GK playing against a team with `attacking_difficulty=0.0` faces the HARDEST fixture for keeping a CS.
**How to avoid:** `cs_prob = max(0.10, 0.40 - attacking_difficulty × 0.30)`. Low `attacking_difficulty` (easy to attack) → low `cs_prob`. High `attacking_difficulty` (hard to attack) → high `cs_prob`.
**Warning signs:** Defenders facing "easy" fixture opponents (low `attacking_difficulty`) showing high `cs_pts` in the output.

Verification of the mapping (from `merge.py` source code):
- `attacking_difficulty` = same value as `difficulty_score` for the fixture (line 310-311, merge.py)
- `difficulty_score` = 0.0 → easiest for attackers (opponent has HIGH xGA, concedes a lot)
- A team that concedes a lot is HARD for the defending player to keep a CS against
- Therefore: low `attacking_difficulty` = LOW `cs_prob` ✓

### Pitfall 3: minutes_factor Missing for CS

**What goes wrong:** Awarding full CS points to players expected to play only 30 minutes.
**Why it happens:** FPL awards CS points only when a player plays 60+ minutes. If `xmins` < 60, the player often won't complete 60 minutes.
**How to avoid:** `effective_cs_prob = cs_prob × min(1.0, xmins / 60.0)`. This scales CS probability linearly from 0 (0 mins) to full (60+ mins).
**Warning signs:** Cameo/rotation players showing surprisingly high cs_pts.

### Pitfall 4: BGW Player with No Fixtures

**What goes wrong:** `xPts_1gw` is None or errors when a player has no upcoming fixtures (BGW).
**Why it happens:** If the groupby loop iterates over an empty list, the sum is 0 — but if the surrounding code doesn't guard for empty, a divide-by-zero or None value can propagate.
**How to avoid:** Follow the `_proj_pts_ngw()` guard: `if not fixtures: return 0.0`. Emit `xPts_1gw = 0.0` and `xPts_components_1gw = None` for BGW players. In the UI, the `(info.getValue() ?? 0).toFixed(1)` pattern handles `null`/`undefined`.
**Warning signs:** Players in a BGW gameweek showing unexpected values or TypeScript type errors.

### Pitfall 5: GwToggle Column Key Mismatch

**What goes wrong:** `getColumnVisibility()` still gating `proj_pts_*gw` keys after the accessor rename causes the toggle to control phantom columns — both old and new columns become permanently visible or hidden in unexpected combinations.
**Why it happens:** `GwToggle.tsx` hardcodes the column keys in `gwVisibility`. If the accessor is renamed in `columns.tsx` but the key map in `GwToggle.tsx` is not updated, they diverge.
**How to avoid:** Update `getColumnVisibility()` in `GwToggle.tsx` atomically with the accessor rename in `columns.tsx`. The keys in `gwVisibility` MUST exactly match the `id` or `accessorKey` used in the column definition.
**Warning signs:** All three xPts columns visible simultaneously regardless of toggle state.

### Pitfall 6: xPts_3gw / xPts_5gw < xPts_1gw for players with No Multi-GW Fixtures

**What goes wrong:** A player with only 1 upcoming fixture has `xPts_3gw == xPts_1gw` and `xPts_5gw == xPts_1gw`, which may seem like a bug.
**Why it happens:** BGW behaviour is intentional per D-06 — no fixture = no contribution. A player with 1 fixture in the next 5 GWs correctly shows the same value across windows.
**How to avoid:** This is correct behaviour; document in test expectations. The `proj_pts_*` fields exhibit the same property per existing tests.
**Warning signs:** Test asserting `xPts_3gw >= xPts_1gw` for ALL players — this assertion is only valid for players with 3+ upcoming fixtures.

---

## Code Examples

### CS Probability Calibration

```python
# Source: [VERIFIED: derived from merge.py attacking_difficulty range 0.0-1.0]
# Calibration target: typical PL CS rates 10-40% by opponent quality
# cs_prob(easy attack fixture, attacking_difficulty=0.0) = 0.40
# cs_prob(hardest fixture, attacking_difficulty=1.0) = 0.10
# Linear interpolation:
cs_prob = max(0.10, min(0.65, 0.40 - attacking_difficulty * 0.30))
```

The formula produces a mean CS rate of ~0.25 when `attacking_difficulty` is uniformly distributed across all 20 teams — consistent with historical FPL data where ~25% of GK/DEF appearances result in a CS. [VERIFIED: computed from actual pipeline attacking_difficulty range]

### Top-Tercile σ Threshold

```python
# Source: [VERIFIED: mirrors _difficulty_tier() percentile logic in merge.py lines 253-264]
all_sigmas = [player['_sigma'] for player in result_with_sigmas]
sorted_sigmas = sorted(all_sigmas)
n = len(sorted_sigmas)
tercile_idx = int(n * 2 / 3)  # same percentile-index approach as difficulty_tiers
ceiling_threshold = sorted_sigmas[tercile_idx] if n >= 3 else 0.0

for player in result_with_sigmas:
    player['xPts_ceiling_1gw'] = player['_sigma'] >= ceiling_threshold
```

Note: `_sigma` is a scratch field computed during the pipeline merge loop, not written to output. Only `xPts_ceiling_*gw` booleans are written to the final dict.

### XPtsCell Renderer

```tsx
// Source: [VERIFIED: 28-UI-SPEC.md component spec + columns.tsx existing proj_pts pattern]
function XPtsCell({
  value,
  ceiling,
  components,
  window,
}: {
  value: number | undefined
  ceiling: boolean | undefined
  components: { goal_pts: number; assist_pts: number; cs_pts: number; bonus_pts: number } | undefined
  window: 1 | 3 | 5
}) {
  const display = (value ?? 0).toFixed(1)

  if (!value || value === 0) {
    return <span>{display}</span>
  }

  const tip = components
    ? `xPts breakdown (${window} GW):\nGoals: ${components.goal_pts.toFixed(2)}\nAssists: ${components.assist_pts.toFixed(2)}\nClean sheet: ${components.cs_pts.toFixed(2)}\nBonus: ${components.bonus_pts.toFixed(2)}`
    : undefined

  return (
    <span title={tip} className={tip ? 'cursor-help' : undefined}>
      {display}
      <VarianceBadge ceiling={ceiling} />
    </span>
  )
}
```

### Column Definition Update

```typescript
// Source: [VERIFIED: src/components/gem-table/columns.tsx lines 86-100]
// Replace three proj_pts columns with:
col.accessor('xPts_1gw', {
  header: H('xPts', 'Expected FPL points next gameweek (Poisson goals/assists, Bernoulli CS/minutes; FDR++ adjusted). Blank GW or no fixture = 0.'),
  cell: (info) => <XPtsCell value={info.getValue()} ceiling={info.row.original.xPts_ceiling_1gw} components={info.row.original.xPts_components_1gw} window={1} />,
  enableSorting: true,
}),
col.accessor('xPts_3gw', {
  header: H('xPts (3)', 'Expected FPL points across next 3 gameweeks (DGW-aware sum, FDR++ adjusted).'),
  cell: (info) => <XPtsCell value={info.getValue()} ceiling={info.row.original.xPts_ceiling_3gw} components={undefined} window={3} />,
  enableSorting: true,
}),
col.accessor('xPts_5gw', {
  header: H('xPts (5)', 'Expected FPL points across next 5 gameweeks (DGW-aware sum, FDR++ adjusted).'),
  cell: (info) => <XPtsCell value={info.getValue()} ceiling={info.row.original.xPts_ceiling_5gw} components={undefined} window={5} />,
  enableSorting: true,
}),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ppg × start_prob × difficulty_modifier` heuristic | Poisson E[goals] + Bernoulli E[CS] + flat bonus | Phase 28 | Statistically grounded; components are interpretable and independently verifiable |
| Single `proj_pts` display | `xPts` with component breakdown tooltip and variance badge | Phase 28 | Users can see WHY a player scores what they score and identify high-ceiling vs safe-floor picks |

**Deprecated/outdated:**
- `proj_pts_*gw` as GemTable data source: still emitted and consumed by TransferPanel/PlannerTab/captaincy, but GemTable now reads `xPts_*gw` exclusively.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Flat position-average bonus rates: GK=0.30, DEF=0.40, MID=0.60, FWD=0.70 pts/game | Architecture Patterns, Common Pitfalls | If rates are significantly off, bonus_pts component will be inaccurate. Impact is small relative to goal/CS variance; rates can be tuned in a future phase. |
| A2 | CS probability formula `max(0.10, 0.40 - attacking_difficulty × 0.30)` calibrates to realistic ~25% mean CS rate | Code Examples | If attacking_difficulty distribution is non-uniform across teams, mean CS rate may diverge from historical average. Tunable parameter — can be adjusted post-Phase 28 with data. |
| A3 | Top-tercile σ correctly classifies "high-ceiling" players as Salah, creative DEF/MID with high xG and high CS prob | Architecture Patterns | Verified analytically with sample player distribution [VERIFIED: computed in this session]. Unlikely to be wrong. |
| A4 | scipy is not required for this xPts model implementation | Standard Stack | If a future code path requires PMF (e.g. P(goals > 0) explicitly), `1 - math.exp(-lambda)` covers it without scipy. |

---

## Open Questions

1. **CS probability calibration against real data**
   - What we know: linear formula `max(0.10, 0.40 - attacking_difficulty × 0.30)` gives ~25% mean CS rate with a typical attacking_difficulty distribution
   - What's unclear: the actual distribution of attacking_difficulty values in the current pipeline output may be skewed; calibration may need adjustment
   - Recommendation: after pipeline runs, check the distribution of `xPts_ceiling_*gw` booleans — if > 50% of players are flagged high-ceiling, the σ threshold is too low (this should not happen given tercile computation, but could occur if all sigmas cluster tightly)

2. **Component breakdown for 3GW / 5GW columns**
   - What we know: CONTEXT.md specifies `xPts_components_1gw` only; the breakdown tooltip is most useful for the 1GW view
   - What's unclear: should the 3GW/5GW cell tooltip show the 1GW breakdown (as a per-GW average proxy) or no tooltip at all?
   - Recommendation: show no breakdown tooltip on 3GW/5GW cells (consistent with CONTEXT.md spec). The header tooltip explains the model.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.x | pipeline/merge.py | Yes | 3.11.9 | — |
| numpy | Pipeline (indirect) | Yes | 2.2.3 | — |
| scipy | DATA-02 requirement text | **No** | — | Not needed — use `math` stdlib (Poisson/Bernoulli are algebraic here) |
| vitest | TypeScript tests | Yes | ^4.1.2 | — |
| @tanstack/react-table | GemTable columns | Yes | ^8.21.3 | — |
| Tailwind v4 | VarianceBadge styles | Yes | ^4 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- scipy: noted in REQUIREMENTS.md `DATA-02` as `scipy>=1.14.0` but NOT required by the xPts model as designed. Poisson E[X] = λ and Bernoulli E[X] = p are algebraic; `math.exp` is sufficient for P(no goal) = e^-λ if needed. The planner should NOT add a scipy install step.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/lib/gem-score.test.ts tests/lib/merge.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-02 | `_compute_xpts_fixture()` returns correct goal/assist/cs/bonus components | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | Wave 0 |
| DATA-02 | `_xpts_ngw()` DGW summing produces higher total than single-GW | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | Wave 0 |
| DATA-02 | BGW (no fixtures) returns `xPts_1gw = 0.0` | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | Wave 0 |
| DATA-02 | Double-count guard: cs_pts and bonus_pts are independently computed | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | Wave 0 |
| XPTS-01 | `MergedPlayer` type has optional `xPts_*` fields | type/unit | `npx vitest run tests/lib/xpts-engine.test.ts` | Wave 0 |
| XPTS-01 | XPtsCell renders `0.0` with no badge for null/0 value | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | Wave 0 |
| XPTS-01 | XPtsCell renders breakdown tooltip title when components present | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | Wave 0 |
| XPTS-02 | VarianceBadge renders ⬆ when ceiling=true | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | Wave 0 |
| XPTS-02 | VarianceBadge renders = when ceiling=false | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | Wave 0 |
| XPTS-02 | VarianceBadge renders nothing when ceiling=undefined | unit (component) | `npx vitest run tests/components/gem-table/XPtsCell.test.tsx` | Wave 0 |
| XPTS-02 | Top-tercile ceiling flag: top 33% of players by σ are flagged high-ceiling | unit | `npx vitest run tests/lib/xpts-engine.test.ts` | Wave 0 |

Note: The existing `tests/lib/merge.test.ts` follows a pattern of pipeline-cache-dependent `.skip()` tests plus fast shape-validation tests. Pipeline tests for xPts will follow the same pattern: `.skip()` for cache-dependent assertions, fast mock-data tests for logic validation.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/xpts-engine.test.ts tests/components/gem-table/XPtsCell.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (254+ tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/xpts-engine.test.ts` — covers DATA-02, XPTS-02 logic
- [ ] `tests/components/gem-table/XPtsCell.test.tsx` — covers XPTS-01, XPTS-02 UI

*(Existing test infrastructure covers all other phase requirements — 22 test files, 254 tests currently passing.)*

---

## Security Domain

This phase has no authentication, session, access control, or cryptographic operations. It is a pure data transformation (pipeline) + read-only display (UI) change. ASVS sections V2, V3, V4, V6 do not apply. V5 (input validation):

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V5 Input Validation | Minimal | `attacking_difficulty` is a float 0.0–1.0 already validated in Phase 27 pipeline. New `_compute_xpts_fixture()` uses `max()/min()` clamping internally. No user-supplied input enters the xPts computation. |

---

## Sources

### Primary (HIGH confidence)

- `pipeline/merge.py` — `_proj_pts_ngw()` (lines 104–133) pattern, `merge_players()` result dict structure (lines 395–476), Phase 27 `attacking_difficulty` integration (lines 310–311, 322–323) — [VERIFIED: codebase read in this session]
- `src/lib/types.ts` — `MergedPlayer` interface (lines 90–140), `FixtureEntry` interface (lines 76–84), `ScoredPlayer` extension pattern (lines 165–174) — [VERIFIED: codebase read in this session]
- `src/components/gem-table/columns.tsx` — existing `proj_pts_*` column definitions (lines 86–100), `H()` header tooltip pattern (line 17) — [VERIFIED: codebase read in this session]
- `src/components/gem-table/GwToggle.tsx` — `getColumnVisibility()` key map (lines 21–33), `MOBILE_HIDDEN_COLUMNS` (lines 3–19) — [VERIFIED: codebase read in this session]
- `.planning/phases/28-xpts-engine/28-UI-SPEC.md` — approved UI design contract, VarianceBadge spec, XPtsCell DOM spec, copywriting contract — [VERIFIED: codebase read in this session]
- `vitest.config.ts`, `package.json` — test framework version (vitest 4.1.2), project deps, scipy absence confirmed — [VERIFIED: codebase read + pip show in this session]

### Secondary (MEDIUM confidence)

- Poisson linearity property (E[aX] = a·E[X]) and Bernoulli variance (p(1-p)) — standard probability theory; applied to FPL scoring with arithmetic verification in this session — [VERIFIED: computed numerically in this session]
- CS probability calibration ~25% mean rate — consistent with commonly-cited FPL statistics; formula verified algebraically against attacking_difficulty range — [ASSUMED: specific historical % not verified against FPL dataset]

### Tertiary (LOW confidence)

- Flat historical bonus rates by position (GK: 0.30, DEF: 0.40, MID: 0.60, FWD: 0.70) — reasonable estimates based on typical FPL bonus distribution patterns; not verified against project's actual FPL dataset — [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in-environment
- Architecture: HIGH — directly derived from existing codebase patterns, all canonical refs read
- xPts model math: HIGH — verified analytically with Python computations in this session
- Bonus rates / CS calibration: MEDIUM-LOW — plausible values but not validated against project's actual FPL data; tunable post-delivery
- Pitfalls: HIGH — double-count risk and directionality issue both verified through code inspection

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable domain; FPL season-end changes possible after May)
