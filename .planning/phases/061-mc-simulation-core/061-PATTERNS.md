# Phase 61: MC Simulation Core - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/simulate.py` | service | batch/transform | `pipeline/bonus.py` | exact (same post-merge module shape) |
| `pipeline/tests/test_simulate.py` | test | batch | `pipeline/tests/test_bonus.py` | exact (same pytest module, same fixture helper pattern) |
| `pipeline/run.py` | orchestrator | request-response | `pipeline/run.py` lines 19–20, 199–208 | self (3-line insertion into existing orchestration block) |
| `pipeline/requirements.txt` | config | — | `pipeline/requirements.txt` | self (append one line) |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` lines 148–190 | self (follow existing optional-field comment block) |
| `src/components/gem-table/columns.tsx` | component | request-response | `src/components/gem-table/columns.tsx` (XPtsCell, lines 27–122) | self (extend existing component; row insertion pattern from lines 77–115) |

---

## Pattern Assignments

### `pipeline/simulate.py` (service, batch/transform)

**Analog:** `pipeline/bonus.py`

**Module-level docstring + imports pattern** (bonus.py lines 1–19):
```python
"""Compute per-player bonus EV from rolling BPS history (Phase 53 BPS-01).

Mirrors pipeline/xmins.py shape: ...
"""

import statistics

# Module-level constants (all-caps)
POSITION_PRIOR = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}
RECENT_WINDOW = 10
```
simulate.py follows the same structure:
- Module docstring referencing phase requirement (MC-01)
- Imports at top (`import numpy as np`, `from itertools import groupby`)
- All-caps module constants (`N_SIMS = 10_000`, scoring tables)

**Public function signature pattern** (bonus.py lines 30–51):
```python
def compute_bonus_predictions(bootstrap: dict, summaries: dict, finished_gws: int) -> dict:
    """Compute per-player bonus EV from rolling BPS history.

    Args:
        bootstrap: ...
        summaries: ...
        finished_gws: ...

    Returns:
        dict mapping player_id (int) -> {...}
    """
    results = {}
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_bonus_ev(element, summaries.get(player_id))
    return results
```
simulate.py public function is:
```python
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
        p['xPts_90th_1gw'] = sim['p90_pts']  # D-05
        result.append(p)
    return result
```

**Guard + early-return pattern** (bonus.py lines 64–66):
```python
# Guard 1: no element-summary at all
if not summary:
    return {'bonus_ev': prior, 'n_starts': 0, 'source': 'flat_default'}
# Guard 2: insufficient sample
if n_starts < MIN_STARTS_GATE:
    return {'bonus_ev': prior, 'n_starts': n_starts, 'source': 'flat_default'}
```
simulate.py mirrors with BGW short-circuit (D-08):
```python
if xmins <= 0 or start_prob <= 0:
    return {'blank_prob': 1.0, 'haul_prob': 0.0, 'p10_pts': 0.0, 'p90_pts': 0.0}
```

**Private helper extraction pattern** (bonus.py lines 54–95):
- Public function delegates all per-player logic to `_compute_player_bonus_ev(element, summary)`
- simulate.py delegates to `_simulate_player(p, xmins_v2_enabled, rng)`

**Output dict rounding pattern** (bonus.py line 92):
```python
return {
    'bonus_ev': round(bonus_ev, 4),
    'n_starts': n_starts,
    'source': 'learned',
}
```
simulate.py rounds to 3dp (matching existing xPts_* precision per CONTEXT.md §Established Patterns):
```python
return {
    'blank_prob': round(float(np.mean(total_pts <= 2)), 3),
    'haul_prob':  round(float(np.mean(total_pts >= 10)), 3),
    'p10_pts':    round(float(np.percentile(total_pts, 10)), 3),
    'p90_pts':    round(float(np.percentile(total_pts, 90)), 3),
}
```

**_cs_prob formula to re-implement inline** (merge.py lines 141–146):
```python
def _cs_prob(defensive_difficulty: float, xmins: float, mins_60_prob: float | None = None) -> float:
    cs_prob_raw = max(0.10, min(0.65, 0.40 - defensive_difficulty * 0.30))
    if mins_60_prob is not None:
        mins_factor = mins_60_prob
    else:
        mins_factor = min(1.0, xmins / 60.0)
    return cs_prob_raw * mins_factor
```
Re-implement in simulate.py as `_cs_prob_sim` — same 3 lines, no import from merge.py (D-02).

**xPts_90th_1gw field written by merge.py** (merge.py lines 1122–1125):
```python
for p in result:
    p['xPts_90th_1gw'] = round(
        (p.get('xPts_1gw') or 0.0) + 1.28 * (p.get('_sigma_1gw') or 0.0), 3
    )
```
simulate.py overwrites this field after merge returns (D-05). Sigma fields are already stripped by merge.py before returning — no ordering conflict.

---

### `pipeline/tests/test_simulate.py` (test, batch)

**Analog:** `pipeline/tests/test_bonus.py`

**File header pattern** (test_bonus.py line 1):
```python
"""Pytest unit tests for compute_bonus_predictions and _compute_player_bonus_ev (Phase 53 BPS-01)."""
```
test_simulate.py:
```python
"""Pytest unit tests for compute_simulations and _simulate_player (Phase 61 MC-01)."""
```

**Import pattern** (test_bonus.py lines 3–5):
```python
import pytest

from bonus import _compute_player_bonus_ev, compute_bonus_predictions
```
test_simulate.py:
```python
import pytest
import numpy as np

from simulate import compute_simulations, _simulate_player
```
Bare import works because `conftest.py` inserts `pipeline/` into `sys.path` (conftest.py lines 12–15).

**Fixture helper builder pattern** (test_bonus.py lines 8–26):
```python
def _element(element_type=3, player_id=1):
    return {'id': player_id, 'element_type': element_type}

def _hist(bonus_pts, starts_field=1, minutes=90, clean_sheet=0):
    """One element-summary history row."""
    return {'minutes': minutes, 'starts': starts_field, 'bonus': bonus_pts, ...}

def _summary(entries):
    return {'history': entries}
```
test_simulate.py uses the same pattern:
```python
def _player(element_type=3, xmins=60.0, start_prob=0.85, xg_per90=0.1, xa_per90=0.1,
            fixtures=None, mins_60_prob=None):
    """Minimal merged player dict for simulation tests."""
    return {
        'element_type': element_type,
        'xmins': xmins,
        'start_prob': start_prob,
        'xg_per90': xg_per90,
        'xa_per90': xa_per90,
        'fixtures': fixtures or [_fix()],
        'mins_60_prob': mins_60_prob,
        'xPts_90th_1gw': 5.0,  # pre-existing value to test overwrite
    }

def _fix(defensive_difficulty=0.5, event_id=38):
    return {'defensive_difficulty': defensive_difficulty, 'event_id': event_id}
```

**Guard test pattern** (test_bonus.py lines 40–46):
```python
def test_missing_summary_falls_back():
    """No element-summary -> flat position prior, source='flat_default'."""
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), None)
        assert result['bonus_ev'] == prior
        assert result['source'] == 'flat_default'
```
test_simulate.py BGW short-circuit test:
```python
def test_bgw_shortcircuit():
    """xmins <= 0 -> blank_prob=1.0, haul_prob=0.0, p10=0.0, p90=0.0."""
    p = _player(xmins=0.0)
    result = compute_simulations([p], xmins_v2_enabled=False)
    assert result[0]['blank_prob'] == 1.0
    assert result[0]['haul_prob'] == 0.0
    assert result[0]['p10_pts'] == 0.0
    assert result[0]['p90_pts'] == 0.0
```

**Numerical tolerance pattern** (test_bonus.py line 68):
```python
assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
```
test_simulate.py uses wider tolerance for stochastic results:
```python
assert result[0]['p10_pts'] == pytest.approx(expected_mean, rel=0.05)
```

**Top-level function test pattern** (test_bonus.py lines 136–157):
```python
def test_top_level_returns_dict_keyed_by_player_id():
    bootstrap = {'elements': [{'id': 100, ...}, {'id': 200, ...}]}
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=10)
    assert set(result.keys()) == {100, 200}
```
test_simulate.py tests the list-in/list-out contract:
```python
def test_p90_overwrites_ceiling():
    """p90_pts must overwrite xPts_90th_1gw in the returned player dict (D-05)."""
    p = _player(xPts_90th_1gw=5.0)
    result = compute_simulations([p], xmins_v2_enabled=False)
    assert result[0]['xPts_90th_1gw'] == result[0]['p90_pts']
```

---

### `pipeline/run.py` (modification — 3-line insertion)

**Analog:** `pipeline/run.py` itself (existing import block lines 13–22; integration block lines 199–208)

**Import block pattern** (run.py lines 13–22):
```python
from fpl_client import get_bootstrap_static, get_fixtures, get_element_summary
from upload import save
from understat_client import get_understat_players
from merge import merge_players
from defcon import compute_defcon_stats
from xmins import compute_xmins_stats
from bonus import compute_bonus_predictions
from price_changes import compute_price_change_predictions
from insights import compute_insights
from accuracy import compute_accuracy_backtest, build_predictions_snapshot
```
Add at line 20 (after `bonus` import, before `price_changes`):
```python
from simulate import compute_simulations
```

**Integration call pattern** (run.py lines 199–208):
```python
        merged, captain_picks = merge_players(
            bootstrap, fixtures, understat, id_map,
            xmins_stats=xmins_stats, summaries=summaries,
            form_signal_enabled=form_signal_enabled,
            blend_alpha=blend_alpha_used,
            xmins_v2_enabled=xmins_v2_enabled,
            bonus_stats=bonus_stats,
            bonus_predictor_enabled=bonus_predictor_enabled,
        )
        save('merged_players.json', merged)
```
Insert one line between `merge_players()` call and `save()`:
```python
        merged = compute_simulations(merged, xmins_v2_enabled)
```
`xmins_v2_enabled` is already in scope (loaded at line 190).

---

### `pipeline/requirements.txt` (config modification)

**Analog:** `pipeline/requirements.txt` (self — existing 6-line file)

**Current file** (requirements.txt lines 1–6):
```
requests>=2.32.0
pandas>=2.2.0
vercel-blob>=0.4.0
python-dotenv>=1.0.0
soccerdata==1.8.8
anthropic>=0.98.1
```
Append:
```
numpy>=1.26.0
```
numpy 2.2.3 is already installed transitively via pandas; this entry makes the direct dependency explicit per D-15.

---

### `src/lib/types.ts` (model modification)

**Analog:** `src/lib/types.ts` itself — follow the optional-field comment block pattern at lines 161–190

**Existing optional field comment block pattern** (types.ts lines 173–190):
```typescript
  // Captaincy ceiling (Phase 31 CAP-03 D-11). 90th-percentile xPts (xPts_1gw + 1.28*sigma_1gw)
  // computed in pipeline; persisted per-player to enable future GemTable sort.
  xPts_90th_1gw?: number
  // ACC-05 (Phase 41 D-11): last GW actual points, joined into the player row by /api/players
  // from accuracy_backtest.json. Optional — null when player has no backtest entry; absent
  // before Phase 40 pipeline has run. NOT computed by pipeline/merge.py.
  last_gw_actual_pts?: number | null
  // Form signal (Phase 42 ACC-01): recency-weighted xG+xA per 90 over last 3-5 GWs.
  // Optional/nullable — null when player has fewer than 3 played GWs or fewer than 270 min in window.
  // Source: pipeline/merge.py:_compute_form_signal; written by merge_players when summaries dict is provided.
  form_xgxa_per90?: number | null
  form_xgxa_window_gws?: number
```
Add after `xPts_90th_1gw?: number` (line 175), following the same comment style:
```typescript
  // Phase 61 MC-01/MC-02: Monte Carlo simulation outputs (10,000 sims per player per GW).
  // Written by pipeline/simulate.py after merge_players(). Optional — absent on first
  // pipeline run before simulate.py is deployed. BGW players: blank_prob=1.0, haul_prob=0.0.
  // p90_pts also overwrites xPts_90th_1gw (D-05).
  blank_prob?: number     // P(total_pts <= 2) across 10k simulations; 1.0 for BGW
  haul_prob?: number      // P(total_pts >= 10) across 10k simulations; 0.0 for BGW
  p10_pts?: number        // 10th percentile simulated points (floor); 0.0 for BGW
  p90_pts?: number        // 90th percentile simulated points (ceiling); overwrites xPts_90th_1gw
```

---

### `src/components/gem-table/columns.tsx` (component modification)

**Analog:** `src/components/gem-table/columns.tsx` (self — extend XPtsCell at lines 27–122)

**Existing prop destructuring pattern** (columns.tsx lines 27–46):
```typescript
export function XPtsCell({
  value,
  ceiling,
  components,
  minsRisk,
  mins60Prob,
  window,
}: {
  value: number | undefined
  ceiling: boolean | undefined
  components: {
    goal_pts: number
    assist_pts: number
    cs_pts: number
    bonus_pts: number
    appearance_pts: number
  } | undefined
  minsRisk?: MinsRisk
  mins60Prob?: number
  window: 1 | 3 | 5
}) {
```
Extend with four optional props (D-13):
```typescript
export function XPtsCell({
  value,
  ceiling,
  components,
  minsRisk,
  mins60Prob,
  window,
  blankProb,
  haulProb,
  p10Pts,
  p90Pts,
}: {
  // ... all existing types unchanged ...
  blankProb?: number
  haulProb?: number
  p10Pts?: number
  p90Pts?: number
}) {
```

**BGW early-return guard to leave unchanged** (columns.tsx lines 54–56):
```typescript
if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) {
  return <span>{display}</span>
}
```
Leave this guard exactly as-is. BGW players fire this guard before MC props are evaluated.

**showBreakdown guard pattern** (columns.tsx lines 60–68):
```typescript
const showBreakdown = window === 1 && components !== undefined && components !== null

if (!showBreakdown) {
  return (
    <span>
      {display}
      <VarianceBadge ceiling={ceiling} />
    </span>
  )
}
```
Add parallel guard after `showBreakdown`:
```typescript
const showMC = window === 1
  && blankProb !== undefined
  && haulProb !== undefined
  && p10Pts !== undefined
  && p90Pts !== undefined
```

**Hover card row rendering pattern** (columns.tsx lines 77–115):
```typescript
const rows: [string, string][] = [
  ['Appearance', c.appearance_pts.toFixed(2)],
  ['Goals',      c.goal_pts.toFixed(2)],
  ['Assists',    c.assist_pts.toFixed(2)],
  ['Clean sheet', c.cs_pts.toFixed(2)],
  ['Bonus',      c.bonus_pts.toFixed(2)],
]

// ...
{rows.map(([label, val]) => (
  <div key={label} className="flex justify-between">
    <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
    <span className="font-mono">{val}</span>
  </div>
))}
<hr className="my-1 border-zinc-200 dark:border-zinc-600" />
<div className="flex justify-between font-semibold">
  <span>Total</span>
  <span className="font-mono">{cardTotal}</span>
</div>
```
Insert MC rows between the existing `<hr>` and the Total block (D-11):
```typescript
{showMC && (
  <>
    {[
      ['Blank%',  `${(blankProb! * 100).toFixed(0)}%`],
      ['Haul%',   `${(haulProb!  * 100).toFixed(0)}%`],
      ['Floor',   p10Pts!.toFixed(1)],
      ['Ceiling', p90Pts!.toFixed(1)],
    ].map(([label, val]) => (
      <div key={label} className="flex justify-between">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="font-mono">{val}</span>
      </div>
    ))}
    <hr className="my-1 border-zinc-200 dark:border-zinc-600" />
  </>
)}
```

**Column prop threading pattern — xPts_1gw column** (columns.tsx lines 220–232):
```typescript
col.accessor('xPts_1gw', {
  header: H('xPts', '...'),
  cell: (info) => (
    <XPtsCell
      value={info.getValue()}
      ceiling={info.row.original.xPts_ceiling_1gw}
      components={info.row.original.xPts_components_1gw ?? undefined}
      minsRisk={info.row.original.mins_risk}
      mins60Prob={info.row.original.mins_60_prob}
      window={1}
    />
  ),
  enableSorting: true,
}),
```
Extend with four new props:
```typescript
    <XPtsCell
      value={info.getValue()}
      ceiling={info.row.original.xPts_ceiling_1gw}
      components={info.row.original.xPts_components_1gw ?? undefined}
      minsRisk={info.row.original.mins_risk}
      mins60Prob={info.row.original.mins_60_prob}
      window={1}
      blankProb={info.row.original.blank_prob}
      haulProb={info.row.original.haul_prob}
      p10Pts={info.row.original.p10_pts}
      p90Pts={info.row.original.p90_pts}
    />
```

---

## Shared Patterns

### Post-Process Module Shape
**Source:** `pipeline/bonus.py` (entire file, 96 lines)
**Apply to:** `pipeline/simulate.py`
- Module docstring referencing phase requirement
- All-caps module-level constants
- One public function `compute_X(input_list, flag) -> output_list`
- Private `_compute_X_per_item()` helper for per-element logic
- Guard clauses return early dict with zero/default values
- Round numeric outputs before return

### Pytest Test Structure
**Source:** `pipeline/tests/test_bonus.py` (entire file)
**Apply to:** `pipeline/tests/test_simulate.py`
- Bare import from module name (no `pipeline.` prefix) — conftest.py handles sys.path
- `_helper()` builder functions that produce minimal valid dicts
- One `assert` cluster per behaviour, not per line
- `pytest.approx(..., rel=...)` for stochastic/float comparisons

### conftest.py sys.path injection
**Source:** `pipeline/tests/conftest.py` lines 12–15
**Apply to:** All pipeline tests (already present, no action needed)
```python
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
```

### Optional Field Block in MergedPlayer
**Source:** `src/lib/types.ts` lines 144–190
**Apply to:** New MC fields in `src/lib/types.ts`
- Each optional field group preceded by a block comment: `// Phase N FEAT-ID: description`
- Optional fields use `?: type` syntax
- Trailing comment on each field line explaining range/BGW behaviour

### Hover Card Row Rendering
**Source:** `src/components/gem-table/columns.tsx` lines 77–115
**Apply to:** MC stat rows in XPtsCell
- Row data as `[string, string][]` tuples
- `.map(([label, val]) => ...)` rendering
- `className="flex justify-between"` on each row div
- Label: `text-zinc-500 dark:text-zinc-400`; value: `font-mono`
- `<hr className="my-1 border-zinc-200 dark:border-zinc-600" />` as section divider

---

## No Analog Found

All 6 files have strong analogs. No files require RESEARCH.md patterns as a substitute.

---

## Metadata

**Analog search scope:** `pipeline/`, `pipeline/tests/`, `src/lib/`, `src/components/gem-table/`
**Files scanned:** 8 source files read (bonus.py, run.py lines 1–30 + 180–218, merge.py lines 120–150 + 186–215 + 1115–1134, requirements.txt, types.ts lines 85–204, columns.tsx lines 1–122 + 215–264, test_bonus.py, conftest.py, test_price_changes.py lines 1–60)
**Pattern extraction date:** 2026-05-05
