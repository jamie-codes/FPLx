# BPS-02: BPS Calibration Curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct bonus-point shrinkage estimator with a two-pass approach: shrink per-player average BPS toward a position prior, then project through a global BPS→bonus calibration curve.

**Architecture:** `build_bps_calibration(summaries, bootstrap)` is called once at the top of `compute_bonus_predictions` to fit a league-wide OLS curve; `_compute_player_bonus_ev` is rewritten to shrink `avg_bps` then project through the curve. Source values rename from `'learned'`/`'flat_default'` to `'learned_calibrated'`/`'learned_uncalibrated'`/`'prior'`. New `avg_bps` field added for observability.

**Tech Stack:** Python 3.12, pytest, `statistics` stdlib (no new deps). TypeScript (types.ts field addition only).

---

## File Map

| File | Change |
|---|---|
| `pipeline/bonus.py` | Add `BPS_POSITION_PRIOR` constant; add `build_bps_calibration()`; rewrite `_compute_player_bonus_ev()` to accept `calibration`; update `compute_bonus_predictions()` to call Pass 1 then Pass 2 |
| `pipeline/tests/test_bonus.py` | Update `_hist` helper (add `bps` param); update source-value assertions; rewrite formula tests; add new BPS-path tests; add calibration integration tests |
| `pipeline/merge.py` | Add one line writing `player['avg_bps']` after the existing `player['bonus_source']` assignment (~line 1152) |
| `src/lib/types.ts` | Update `bonus_source` union type; add `avg_bps?: number \| null` |

---

## Context

**`pipeline/bonus.py` current state (read before editing):**

```python
POSITION_PRIOR = {1: 0.30, 2: 0.40, 3: 0.60, 4: 0.70}
RECENT_WINDOW = 10
MIN_STARTS_GATE = 4
SHRINKAGE_K = 12
BONUS_CS_RESIDUAL_FACTOR = 0.5

def compute_bonus_predictions(bootstrap, summaries, finished_gws) -> dict:
    results = {}
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_bonus_ev(element, summaries.get(player_id))
    return results

def _compute_player_bonus_ev(element, summary) -> dict:
    # shrinks bonus (not BPS) toward POSITION_PRIOR; returns {bonus_ev, n_starts, source}
    # source: 'learned' | 'flat_default'
```

**`pipeline/tests/test_bonus.py` current `_hist` helper:**

```python
def _hist(bonus_pts, starts_field=1, minutes=90, clean_sheet=0):
    return {'minutes': minutes, 'starts': starts_field, 'bonus': bonus_pts,
            'clean_sheets': clean_sheet, 'round': 1}
```

**`pipeline/merge.py` bonus block (~lines 1141–1152):**

```python
if bonus_stats and fpl_id in bonus_stats:
    player_bonus_ev = bonus_stats[fpl_id].get('bonus_ev')
    player_bonus_source = bonus_stats[fpl_id].get('source')
else:
    player_bonus_ev = None
    player_bonus_source = None
# BPS-01: persist bonus signal so the frontend can surface it per-player.
player['bonus_ev'] = player_bonus_ev
player['bonus_source'] = player_bonus_source
```

**`src/lib/types.ts` current bonus fields (~lines 220–224):**

```typescript
// bonus_source: 'learned' when calibrated from history; 'flat_default' when prior only (< 4 starts).
bonus_ev?: number | null
bonus_source?: 'learned' | 'flat_default' | null
```

**Run tests with:**
```bash
cd pipeline && python -m pytest tests/test_bonus.py -v
```

---

## Task 1: `build_bps_calibration` — OLS calibration function

**Files:**
- Modify: `pipeline/bonus.py`
- Modify: `pipeline/tests/test_bonus.py`

- [ ] **Step 1: Add failing tests for `build_bps_calibration`**

Add to `pipeline/tests/test_bonus.py` — insert after the imports at the top of the file, after `from bonus import _compute_player_bonus_ev, compute_bonus_predictions`:

```python
from bonus import _compute_player_bonus_ev, compute_bonus_predictions, build_bps_calibration
```

Then add these three test functions at the end of the file:

```python
# ── Task 1: build_bps_calibration ──────────────────────────────────────────


def _calibration_data(n_players: int, slope: float = 0.05, intercept: float = 0.10) -> tuple:
    """Generate (summaries, bootstrap) where avg_bonus = slope * avg_bps + intercept exactly."""
    elements = []
    summaries: dict = {}
    for i in range(1, n_players + 1):
        avg_bps = 15.0 + i * 0.5          # spread: 15.5, 16.0, 16.5, …
        avg_bonus = slope * avg_bps + intercept
        history = [
            {'starts': 1, 'bps': avg_bps, 'bonus': avg_bonus, 'minutes': 90, 'clean_sheets': 0}
            for _ in range(4)              # exactly MIN_STARTS_GATE starts each
        ]
        summaries[i] = {'history': history}
        elements.append({'id': i, 'element_type': 3})
    return summaries, {'elements': elements}


def test_build_bps_calibration_ols():
    """25 players with exact linear BPS→bonus → slope and intercept match OLS."""
    slope_true, intercept_true = 0.05, 0.10
    summaries, bootstrap = _calibration_data(25, slope=slope_true, intercept=intercept_true)
    result = build_bps_calibration(summaries, bootstrap)
    assert result is not None
    slope, intercept = result
    assert slope == pytest.approx(slope_true, rel=1e-6)
    assert intercept == pytest.approx(intercept_true, rel=1e-6)


def test_build_bps_calibration_fewer_than_20_returns_none():
    """Fewer than 20 qualifying players → returns None."""
    summaries, bootstrap = _calibration_data(15)
    assert build_bps_calibration(summaries, bootstrap) is None


def test_build_bps_calibration_excludes_low_starts():
    """Players with < MIN_STARTS_GATE (4) starts do not count toward the 20-player threshold.

    19 qualifying players + 10 with only 3 starts each = 29 total elements.
    Because only 19 qualify, the function must return None (below 20 threshold).
    """
    elements = []
    summaries: dict = {}
    for i in range(1, 30):
        n_starts = 4 if i <= 19 else 3
        avg_bps = 15.0 + i * 0.5
        avg_bonus = 0.05 * avg_bps + 0.10
        history = [
            {'starts': 1, 'bps': avg_bps, 'bonus': avg_bonus, 'minutes': 90, 'clean_sheets': 0}
        ] * n_starts
        summaries[i] = {'history': history}
        elements.append({'id': i, 'element_type': 3})
    bootstrap = {'elements': elements}
    assert build_bps_calibration(summaries, bootstrap) is None
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd pipeline && python -m pytest tests/test_bonus.py::test_build_bps_calibration_ols tests/test_bonus.py::test_build_bps_calibration_fewer_than_20_returns_none tests/test_bonus.py::test_build_bps_calibration_excludes_low_starts -v
```

Expected: all three FAIL with `ImportError: cannot import name 'build_bps_calibration'`.

- [ ] **Step 3: Add `BPS_POSITION_PRIOR` constant and `build_bps_calibration` to `bonus.py`**

In `pipeline/bonus.py`, after the existing `BONUS_CS_RESIDUAL_FACTOR = 0.5` line, add:

```python
# BPS-02: position-prior average BPS per start (empirical, used for BPS shrinkage)
BPS_POSITION_PRIOR = {1: 18, 2: 20, 3: 22, 4: 24}
```

Then add this function after the existing `BONUS_CS_RESIDUAL_FACTOR` constant block and before `compute_bonus_predictions`:

```python
def build_bps_calibration(summaries: dict, bootstrap: dict) -> tuple | None:
    """Fit a global BPS→bonus OLS calibration curve from all qualifying players.

    Collects one (avg_bps, avg_bonus) data point per player with ≥ MIN_STARTS_GATE
    starts across their full history. Uses ALL history entries (not the recent window)
    to maximise calibration data.

    Args:
        summaries: dict mapping player_id (int) → element-summary dict.
        bootstrap: FPL bootstrap-static JSON (elements list).

    Returns:
        (slope, intercept) tuple such that bonus_ev ≈ slope * bps + intercept,
        or None when fewer than 20 players qualify (early season / sparse data).
    """
    data_points: list[tuple[float, float]] = []
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        summary = summaries.get(player_id)
        if not summary:
            continue
        history = summary.get('history', [])
        starts = [m for m in history if m.get('starts') == 1]
        if len(starts) < MIN_STARTS_GATE:
            continue
        avg_bps = statistics.mean(m.get('bps', 0) for m in starts)
        avg_bonus = statistics.mean(m.get('bonus', 0) for m in starts)
        data_points.append((avg_bps, avg_bonus))

    if len(data_points) < 20:
        return None

    bps_vals = [p[0] for p in data_points]
    bonus_vals = [p[1] for p in data_points]
    bps_mean = statistics.mean(bps_vals)
    bonus_mean = statistics.mean(bonus_vals)

    numerator = sum(
        (b - bps_mean) * (bn - bonus_mean) for b, bn in zip(bps_vals, bonus_vals)
    )
    denominator = sum((b - bps_mean) ** 2 for b in bps_vals)

    if denominator == 0:
        return None

    slope = numerator / denominator
    intercept = bonus_mean - slope * bps_mean
    return (slope, intercept)
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd pipeline && python -m pytest tests/test_bonus.py::test_build_bps_calibration_ols tests/test_bonus.py::test_build_bps_calibration_fewer_than_20_returns_none tests/test_bonus.py::test_build_bps_calibration_excludes_low_starts -v
```

Expected: all three PASS.

- [ ] **Step 5: Verify no existing tests broken**

```bash
cd pipeline && python -m pytest tests/test_bonus.py -v
```

Expected: the 9 pre-existing tests all pass; 3 new tests also pass.

- [ ] **Step 6: Commit**

```bash
git add pipeline/bonus.py pipeline/tests/test_bonus.py
git commit -m "feat(bps-02): add build_bps_calibration OLS function"
```

---

## Task 2: Rewrite `_compute_player_bonus_ev` with BPS shrinkage path

**Files:**
- Modify: `pipeline/bonus.py`
- Modify: `pipeline/tests/test_bonus.py`

This task rewrites the per-player function to shrink `avg_bps` (not `avg_bonus`) toward `BPS_POSITION_PRIOR`, then project through the calibration curve. Source values are renamed. Existing tests that verify formula values are updated; new tests cover the BPS path and the `avg_bps` field.

- [ ] **Step 1: Update `_hist` helper — add `bps` parameter**

In `pipeline/tests/test_bonus.py`, replace the existing `_hist` function:

```python
def _hist(bonus_pts, starts_field=1, minutes=90, clean_sheet=0, bps=20):
    """One element-summary history row.

    bonus_pts: 0/1/2/3
    starts_field: 0 or 1 (history[i].starts)
    minutes: ignored by bonus.py but required by schema
    clean_sheet: 0 or 1 (history[i].clean_sheets) — used for GK/DEF residualisation only
    bps: raw BPS score — used by BPS-02 calibration path (default 20)
    """
    return {
        'minutes': minutes,
        'starts': starts_field,
        'bonus': bonus_pts,
        'clean_sheets': clean_sheet,
        'bps': bps,
        'round': 1,
    }
```

- [ ] **Step 2: Update existing tests to use new source values and BPS formula**

Replace all 10 pre-existing test functions with the updated versions below. The key changes:
- `'flat_default'` → `'prior'` everywhere
- `'learned'` → `'learned_uncalibrated'` everywhere (these tests call `_compute_player_bonus_ev` without `calibration`)
- `avg_bps` added to key-set assertions
- Formula tests rewritten to use BPS shrinkage (not bonus shrinkage)

```python
def test_returns_per_player_dict():
    """Return dict has keys {'bonus_ev', 'avg_bps', 'n_starts', 'source'}."""
    history = [_hist(1, bps=22)] * 10
    result = _compute_player_bonus_ev(_element(), _summary(history))
    assert set(result.keys()) == {'bonus_ev', 'avg_bps', 'n_starts', 'source'}


def test_missing_summary_falls_back():
    """No element-summary -> flat position prior, source='prior', avg_bps=None."""
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), None)
        assert result['bonus_ev'] == prior, f"element_type={element_type} expected {prior}, got {result['bonus_ev']}"
        assert result['n_starts'] == 0
        assert result['source'] == 'prior'
        assert result['avg_bps'] is None


def test_low_sample_falls_back():
    """n_starts < 4 in recent[-10:] -> flat position prior, source='prior', avg_bps=None."""
    history = [_hist(1, bps=22)] * 3 + [_hist(0, starts_field=0)] * 7
    for element_type, prior in [(1, 0.30), (2, 0.40), (3, 0.60), (4, 0.70)]:
        result = _compute_player_bonus_ev(_element(element_type=element_type), _summary(history))
        assert result['bonus_ev'] == prior, f"element_type={element_type} expected {prior}, got {result['bonus_ev']}"
        assert result['source'] == 'prior'
        assert result['n_starts'] == 3
        assert result['avg_bps'] is None


def test_sufficient_sample_bps_shrinkage():
    """n_starts=10, MID, bps=25, calibration=None -> uncalibrated BPS shrinkage formula."""
    # BPS_POSITION_PRIOR[3]=22, POSITION_PRIOR[3]=0.60
    # w = 10/12; smoothed_bps = w*25 + (1-w)*22
    # bonus_ev = smoothed_bps * (0.60 / 22)
    bps_val = 25
    history = [_hist(1, bps=bps_val)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = min(1.0, 10 / 12.0)
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_uncalibrated'
    assert result['n_starts'] == 10
    assert result['avg_bps'] == pytest.approx(float(bps_val), abs=0.01)


def test_shrinkage_formula_at_gate_boundary():
    """n_starts=4 (gate boundary), MID, bps=20.0, calibration=None -> w=4/12."""
    bps_val = 20
    history = [_hist(1, bps=bps_val)] * 4 + [_hist(0, starts_field=0)] * 6
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = 4 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_uncalibrated'
    assert result['n_starts'] == 4


def test_shrinkage_uses_recent_10_window():
    """n_starts=12 → only last 10 contribute (window=10); w = 10/12."""
    bps_val = 30
    history = [_hist(2, bps=bps_val)] * 12
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    # last 10 all have bps=30; avg_bps=30; w=10/12
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)


def test_window_uses_recent_10_only():
    """15 history entries: first 5 have bps=40, last 10 have bps=15 — only last 10 used."""
    history = [_hist(3, bps=40)] * 5 + [_hist(0, bps=15)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    # avg_bps from last 10 = 15.0 (all starts=1 by default)
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * 15.0 + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)


def test_defender_bonus_residualised_against_cs():
    """GK/DEF: BPS-based bonus_ev_raw reduced by 0.5 * cs_rate, floored at 0."""
    # GK (element_type=1): 10 starts, 8 with CS, bps=25
    # BPS_PRIOR[1]=18, POSITION_PRIOR[1]=0.30
    # cs_rate = 8/10 = 0.8
    # w=10/12; smoothed_bps=(10/12)*25+(2/12)*18
    # bonus_ev_raw = smoothed_bps * (0.30/18)
    # bonus_ev = max(0, bonus_ev_raw - 0.5*0.8)
    bps_val = 25
    history = [_hist(1, clean_sheet=1, bps=bps_val)] * 8 + [_hist(1, clean_sheet=0, bps=bps_val)] * 2
    result = _compute_player_bonus_ev(_element(element_type=1), _summary(history))
    bps_prior = 18
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    bonus_ev_raw = smoothed_bps * (0.30 / bps_prior)
    expected = max(0.0, bonus_ev_raw - 0.5 * 0.8)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_uncalibrated'


def test_attacker_bonus_not_residualised():
    """MID (element_type=3): no residualisation even with high CS rate."""
    bps_val = 22
    history = [_hist(1, clean_sheet=1, bps=bps_val)] * 10
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = smoothed_bps * (0.60 / bps_prior)
    # Plain BPS shrinkage value, NOT reduced by CS penalty
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001), \
        "MID/FWD must NOT be residualised against CS — only GK (1) and DEF (2)."


def test_top_level_returns_dict_keyed_by_player_id():
    """compute_bonus_predictions returns dict[player_id] -> per-player dict.
    2-player bootstrap: only 1 qualifying player → calibration=None → learned_uncalibrated.
    """
    bootstrap = {
        'elements': [
            {'id': 100, 'element_type': 3},
            {'id': 200, 'element_type': 4},
        ],
    }
    summaries = {
        100: _summary([_hist(2, bps=22)] * 10),
        # 200 absent — should fall back to prior
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=10)
    assert set(result.keys()) == {100, 200}
    # Player 100: learned path, calibration=None (only 1 qualifying player < 20 threshold)
    assert result[100]['source'] == 'learned_uncalibrated'
    assert result[100]['avg_bps'] == pytest.approx(22.0, abs=0.01)
    # Player 200: no summary → FWD prior 0.70
    assert result[200]['bonus_ev'] == 0.70
    assert result[200]['source'] == 'prior'
    assert result[200]['avg_bps'] is None
```

- [ ] **Step 3: Add new tests for BPS-specific behaviours**

Append these additional tests after the updated ones:

```python
# ── Task 2 new tests ────────────────────────────────────────────────────────


def test_calibrated_path_uses_curve():
    """When calibration=(slope, intercept), bonus_ev = slope*smoothed_bps + intercept."""
    bps_val = 22
    history = [_hist(1, bps=bps_val)] * 10
    slope, intercept = 0.05, 0.10
    result = _compute_player_bonus_ev(
        _element(element_type=3), _summary(history), calibration=(slope, intercept)
    )
    bps_prior = 22
    w = 10 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior
    expected = slope * smoothed_bps + intercept
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    assert result['source'] == 'learned_calibrated'


def test_partial_shrinkage_smoothed_bps_between_extremes():
    """n_starts=6 → smoothed_bps is between avg_bps and BPS_PRIOR (w=0.5)."""
    bps_val = 30          # above BPS_PRIOR[3]=22
    history = [_hist(1, bps=bps_val)] * 6 + [_hist(0, starts_field=0)] * 4
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    bps_prior = 22
    w = 6 / 12.0
    smoothed_bps = w * bps_val + (1.0 - w) * bps_prior   # = 26.0
    expected = smoothed_bps * (0.60 / bps_prior)
    assert result['bonus_ev'] == pytest.approx(round(expected, 4), abs=0.0001)
    # smoothed_bps lies strictly between avg_bps and BPS_PRIOR
    assert bps_prior < smoothed_bps < bps_val


def test_avg_bps_populated_for_learned_players():
    """avg_bps field is populated (not None) when n_starts >= MIN_STARTS_GATE."""
    history = [_hist(1, bps=24)] * 8
    result = _compute_player_bonus_ev(_element(element_type=3), _summary(history))
    assert result['avg_bps'] is not None
    assert result['avg_bps'] == pytest.approx(24.0, abs=0.01)


def test_high_bps_player_higher_bonus_ev():
    """Higher avg BPS → higher bonus_ev (monotone calibration-curve behaviour)."""
    history_high = [_hist(1, bps=35)] * 10
    history_low  = [_hist(1, bps=15)] * 10
    result_high = _compute_player_bonus_ev(_element(element_type=3), _summary(history_high))
    result_low  = _compute_player_bonus_ev(_element(element_type=3), _summary(history_low))
    assert result_high['bonus_ev'] > result_low['bonus_ev']
```

- [ ] **Step 4: Run updated tests — verify they fail**

```bash
cd pipeline && python -m pytest tests/test_bonus.py -v -k "not build_bps_calibration"
```

Expected: the 9 updated pre-existing tests and 4 new tests FAIL (source values still `'learned'`/`'flat_default'`, no `avg_bps` key, old formula).

- [ ] **Step 5: Rewrite `_compute_player_bonus_ev` in `bonus.py`**

Replace the existing `_compute_player_bonus_ev` function entirely with:

```python
def _compute_player_bonus_ev(
    element: dict,
    summary: dict | None,
    calibration: tuple | None = None,
) -> dict:
    """Compute bonus EV for a single player using BPS-calibrated shrinkage.

    Two-pass algorithm (BPS-02):
      1. Shrink per-player avg BPS toward BPS_POSITION_PRIOR.
      2. Project smoothed BPS through the calibration curve (or ratio fallback).

    Args:
        element:     FPL element dict (needs 'element_type').
        summary:     element-summary dict with 'history' list; None for no-data players.
        calibration: (slope, intercept) tuple from build_bps_calibration(), or None when
                     fewer than 20 qualifying players exist (early season).

    Returns:
        dict with keys: bonus_ev (float, 4dp), avg_bps (float|None), n_starts (int),
        source ('learned_calibrated' | 'learned_uncalibrated' | 'prior').
    """
    element_type = element.get('element_type', 3)
    prior = POSITION_PRIOR[element_type]
    bps_prior = BPS_POSITION_PRIOR[element_type]

    # Guard 1: no element-summary at all (e.g. promoted-team player, 0 starts)
    if not summary:
        return {'bonus_ev': prior, 'avg_bps': None, 'n_starts': 0, 'source': 'prior'}

    history = summary.get('history', [])
    recent = history[-RECENT_WINDOW:]
    starts_in_recent = [m for m in recent if m.get('starts') == 1]
    n_starts = len(starts_in_recent)

    # Guard 2: insufficient sample → flat fallback
    if n_starts < MIN_STARTS_GATE:
        return {'bonus_ev': prior, 'avg_bps': None, 'n_starts': n_starts, 'source': 'prior'}

    # BPS-based shrinkage estimator
    avg_bps = statistics.mean(m.get('bps', 0) for m in starts_in_recent)
    w = min(1.0, n_starts / SHRINKAGE_K)
    smoothed_bps = w * avg_bps + (1.0 - w) * bps_prior

    # Calibration curve or uncalibrated ratio fallback
    if calibration is not None:
        slope, intercept = calibration
        bonus_ev_raw = slope * smoothed_bps + intercept
        source = 'learned_calibrated'
    else:
        bonus_ev_raw = smoothed_bps * (prior / bps_prior)
        source = 'learned_uncalibrated'

    # BPS-CS double-counting mitigation for GK/DEF only (Pitfall M3).
    if element_type in (1, 2):
        cs_count = sum(1 for m in starts_in_recent if m.get('clean_sheets', 0) == 1)
        cs_rate = cs_count / n_starts
        bonus_ev = max(0.0, bonus_ev_raw - BONUS_CS_RESIDUAL_FACTOR * cs_rate)
    else:
        bonus_ev = bonus_ev_raw

    return {
        'bonus_ev': round(bonus_ev, 4),
        'avg_bps': round(avg_bps, 2),
        'n_starts': n_starts,
        'source': source,
    }
```

- [ ] **Step 6: Run all bonus tests — verify they pass**

```bash
cd pipeline && python -m pytest tests/test_bonus.py -v
```

Expected: all tests pass (10 updated pre-existing + 4 new Task 2 tests + 3 Task 1 tests = 17 total).

- [ ] **Step 7: Commit**

```bash
git add pipeline/bonus.py pipeline/tests/test_bonus.py
git commit -m "feat(bps-02): rewrite _compute_player_bonus_ev with BPS shrinkage path"
```

---

## Task 3: Wire `build_bps_calibration` into `compute_bonus_predictions`

**Files:**
- Modify: `pipeline/bonus.py`
- Modify: `pipeline/tests/test_bonus.py`

- [ ] **Step 1: Add failing integration tests**

Append to `pipeline/tests/test_bonus.py`:

```python
# ── Task 3: compute_bonus_predictions wiring ───────────────────────────────


def test_compute_bonus_predictions_calibrated_when_enough_players():
    """≥ 20 qualifying players → calibration built → source='learned_calibrated'."""
    bootstrap = {'elements': [{'id': i, 'element_type': 3} for i in range(1, 26)]}
    summaries = {
        i: {'history': [
            {'starts': 1, 'bps': 18.0 + i * 0.5, 'bonus': 1.0, 'minutes': 90, 'clean_sheets': 0}
        ] * 10}
        for i in range(1, 26)
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=25)
    for player_id in range(1, 26):
        assert result[player_id]['source'] == 'learned_calibrated', \
            f"player {player_id}: expected learned_calibrated, got {result[player_id]['source']}"


def test_compute_bonus_predictions_uncalibrated_when_few_players():
    """< 20 qualifying players → calibration=None → learned players get source='learned_uncalibrated'."""
    bootstrap = {'elements': [{'id': i, 'element_type': 3} for i in range(1, 6)]}
    summaries = {
        i: {'history': [
            {'starts': 1, 'bps': 20.0, 'bonus': 1.0, 'minutes': 90, 'clean_sheets': 0}
        ] * 10}
        for i in range(1, 6)
    }
    result = compute_bonus_predictions(bootstrap, summaries, finished_gws=5)
    for player_id in range(1, 6):
        assert result[player_id]['source'] == 'learned_uncalibrated'
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
cd pipeline && python -m pytest tests/test_bonus.py::test_compute_bonus_predictions_calibrated_when_enough_players tests/test_bonus.py::test_compute_bonus_predictions_uncalibrated_when_few_players -v
```

Expected: both tests FAIL — `source` will be `'learned_uncalibrated'` for all because `compute_bonus_predictions` doesn't yet call `build_bps_calibration`.

- [ ] **Step 3: Update `compute_bonus_predictions` to call Pass 1 then Pass 2**

Replace the existing `compute_bonus_predictions` function in `pipeline/bonus.py` with:

```python
def compute_bonus_predictions(bootstrap: dict, summaries: dict, finished_gws: int) -> dict:
    """Compute per-player bonus EV from rolling BPS history.

    Args:
        bootstrap:    FPL bootstrap-static JSON (elements list).
        summaries:    dict mapping player_id (int) -> element-summary dict.
                      Pre-fetched by run.py shared cache. Players absent from this dict
                      (e.g. 0-starts promoted-team players) receive the flat position prior.
        finished_gws: Accepted for signature parity with compute_xmins_stats (unused here —
                      bonus EV is derived from the recent window of element-summary history).

    Returns:
        dict mapping player_id (int) -> {bonus_ev: float (4dp), avg_bps: float|None,
        n_starts: int, source: 'learned_calibrated'|'learned_uncalibrated'|'prior'}.
        Every player in bootstrap['elements'] gets an entry.
    """
    # BPS-02 Pass 1: fit global calibration curve once. Returns None early in the season
    # when fewer than 20 players have enough history.
    calibration = build_bps_calibration(summaries, bootstrap)

    results = {}
    for element in bootstrap.get('elements', []):
        player_id = element['id']
        results[player_id] = _compute_player_bonus_ev(
            element, summaries.get(player_id), calibration
        )
    return results
```

- [ ] **Step 4: Run all bonus tests — verify they all pass**

```bash
cd pipeline && python -m pytest tests/test_bonus.py -v
```

Expected: all 19 tests pass (17 from Tasks 1–2 + 2 new integration tests).

- [ ] **Step 5: Commit**

```bash
git add pipeline/bonus.py pipeline/tests/test_bonus.py
git commit -m "feat(bps-02): wire build_bps_calibration into compute_bonus_predictions"
```

---

## Task 4: Pipeline integration — `merge.py` and `types.ts`

**Files:**
- Modify: `pipeline/merge.py`
- Modify: `src/lib/types.ts`

No new tests needed — the `bonus_stats` dict shape change is backward compatible (extra key `avg_bps` is ignored by all existing merge logic except the new write line).

- [ ] **Step 1: Add `avg_bps` write to `merge.py`**

Find the block in `pipeline/merge.py` around line 1150–1152 (search for `player['bonus_source']`):

```python
        # BPS-01: persist bonus signal so the frontend can surface it per-player.
        player['bonus_ev'] = player_bonus_ev
        player['bonus_source'] = player_bonus_source
```

Add one line immediately after `player['bonus_source'] = player_bonus_source`:

```python
        player['avg_bps'] = bonus_stats[fpl_id].get('avg_bps') if bonus_stats and fpl_id in bonus_stats else None  # BPS-02
```

The block should now read:

```python
        # BPS-01: persist bonus signal so the frontend can surface it per-player.
        player['bonus_ev'] = player_bonus_ev
        player['bonus_source'] = player_bonus_source
        player['avg_bps'] = bonus_stats[fpl_id].get('avg_bps') if bonus_stats and fpl_id in bonus_stats else None  # BPS-02
```

- [ ] **Step 2: Update `bonus_source` union type and add `avg_bps` to `types.ts`**

In `src/lib/types.ts`, find the bonus fields block (~line 220–224):

```typescript
  // bonus_source: 'learned' when calibrated from history; 'flat_default' when prior only (< 4 starts).
  bonus_ev?: number | null
  bonus_source?: 'learned' | 'flat_default' | null
```

Replace with:

```typescript
  // bonus_source: source of the bonus EV estimate (BPS-02).
  // 'learned_calibrated': BPS shrinkage + global calibration curve applied.
  // 'learned_uncalibrated': BPS shrinkage only (early season, < 20 qualifying players).
  // 'prior': position-prior only (< 4 starts in recent window).
  bonus_ev?: number | null
  bonus_source?: 'learned_calibrated' | 'learned_uncalibrated' | 'prior' | null
  avg_bps?: number | null  // BPS-02: raw avg BPS per start (pre-shrinkage), null for prior-path players
```

- [ ] **Step 3: Run full pipeline test suite**

```bash
cd pipeline && python -m pytest tests/ -v
```

Expected: all tests pass. Verify the bonus test count shows 19 passing.

- [ ] **Step 4: TypeScript compile check**

```bash
cd C:\Users\jamie\fplx && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add pipeline/merge.py src/lib/types.ts
git commit -m "feat(bps-02): write avg_bps to players.json; update types.ts"
```
