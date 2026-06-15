# ML Shadow-Model Groundwork (ML-01) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a leakage-free feature-extraction + position-specific xgboost train/eval harness against the 2025/26 archive, run it in shadow vs the formula model on the BT-02 metrics (in-sample, loudly caveated), with nothing wired live and no promotion.

**Architecture:** `pipeline/ml/features.py` (wraps `build_asof_signals` + fixture signals into flat feature rows + a labelled dataset), `pipeline/ml/model.py` (position-specific `xgboost.XGBRegressor`), `pipeline/experiments/exp11_ml_shadow.py` (train GW7-28 → predict GW29-38, score via `compute_metrics`, compare to the formula model, emit json + a loud CAVEAT, no verdict). xgboost added as a pinned dep, imported only in `ml/` + tests.

**Tech Stack:** Python 3.11, numpy (already present), xgboost (NEW pinned dep), pytest. PowerShell; tests `cd pipeline; python -m pytest -q`.

**Spec:** `docs/superpowers/specs/2026-06-15-ml-shadow-groundwork-design.md` (authoritative — read it).

**Verified facts:**
- `build_asof_signals(history, gw, params)` (backtest.py:139) returns a dict with 12 fields: `xg_per90, xa_per90, season_xg90, season_xa90, cum_minutes, xmins, start_prob, mins_60_prob, sub_appear_prob, dc_rate_10, dc_rate_12, saves_per90`; returns `None` when no `round < gw` entries. Strictly leakage-free.
- `run_backtest` row loop (backtest.py:393-413): group `history` by `round`; `sig = build_asof_signals(...)`; gate `sig['cum_minutes'] >= p['min_prior_minutes']` and (deploy) `sig['xmins'] > 0`; `actual_pts = sum(total_points)` over `by_gw[gw]`; `n_fixtures = len(entries)`.
- `compute_metrics(rows)` (backtest.py:274) returns the metrics dict; row schema needs `xpts_pred, actual_pts, element_type, gw, n_fixtures, web_name, player_id, actual_minutes`.
- Fixture signals: `accuracy.build_team_def_form_lookup(fixtures, window)` and `build_team_atf_lookup(fixtures, window)` → `(gw, team_id) -> rate`; FPL difficulty from `fix['team_h_difficulty'/'team_a_difficulty']` normalized `(raw-1)/4`; ODDS-01 `odds_join.build_odds_lookup(rows, archive)` → `(fixture_id, team_id) -> {cs_prob, attack_difficulty, ...}`.
- `element_summaries` history entry fields incl. `round, fixture, opponent_team, was_home, total_points, minutes, starts, expected_goals(str), expected_assists(str)`.
- `DEFAULT_PARAMS` (backtest.py:31) has `min_prior_minutes=270, xmins_window=5, blend_alpha=0, form_window_gws=5, cs_def_form_window_gws=6, atf_window_gws=6`.
- requirements.txt + `.github/workflows/pipeline.yml` pip-install line both list deps; numpy present, no sklearn/xgboost.

**Project rules:** No `Co-Authored-By`. Do NOT push. Commit per task. No live behaviour change.

---

### Task 1: Add the xgboost dependency

**Files:**
- Modify: `pipeline/requirements.txt`
- Modify: `.github/workflows/pipeline.yml` (the `pip install` line)
- Test: `pipeline/tests/test_ml_deps.py`

- [ ] **Step 1: Write the failing test** `pipeline/tests/test_ml_deps.py`:

```python
def test_xgboost_importable_and_numpy_present():
    import numpy  # already a dep
    import xgboost
    from xgboost import XGBRegressor
    assert hasattr(XGBRegressor(), 'fit')
```

- [ ] **Step 2: Run, verify fail.** `cd pipeline; python -m pytest tests/test_ml_deps.py -q` → FAIL (`No module named 'xgboost'`).
- [ ] **Step 3: Add the dependency + install it.**
  - Add to `pipeline/requirements.txt` a line `xgboost>=2.1.0` (or the latest stable resolving against `numpy>=2.2`).
  - Add `xgboost==<pinned>` to the `pip install ...` line in `.github/workflows/pipeline.yml` (match the pinned-version style of the other CI deps; pick the exact stable version you install locally).
  - Install locally: `pip install "xgboost>=2.1.0"` and note the resolved version for the CI pin.
- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_ml_deps.py -q` → PASS.
- [ ] **Step 5: Commit.**
```bash
git add pipeline/requirements.txt .github/workflows/pipeline.yml pipeline/tests/test_ml_deps.py
git commit -m "build(ml-01): add pinned xgboost dependency (requirements + CI)"
```

---

### Task 2: `pipeline/ml/features.py` — leakage-free features + dataset

**Files:**
- Create: `pipeline/ml/__init__.py` (empty)
- Create: `pipeline/ml/features.py`
- Test: `pipeline/tests/test_ml_features.py`

- [ ] **Step 1: Write the failing tests** `pipeline/tests/test_ml_features.py`:

```python
import copy
from capture_season import load_season_archive
from backtest import DEFAULT_PARAMS
from ml.features import build_feature_row, build_dataset, FEATURE_NAMES

_ARCHIVE = load_season_archive()


def _player_with_history():
    for pid, s in _ARCHIVE['summaries'].items():
        if len([e for e in s['history'] if e.get('round', 0) < 20]) >= 6:
            return pid, s['history']
    raise AssertionError('no eligible player')


def test_feature_row_has_all_named_features_numeric():
    pid, hist = _player_with_history()
    ctx = {'was_home': 1, 'n_fixtures': 1, 'norm_concede_rate': 0.5,
           'norm_attack_rate': 0.5, 'difficulty': 0.5, 'odds_cs_prob': 0.3,
           'attack_difficulty': 0.4}
    el = {'now_cost': 75}
    row = build_feature_row(hist, 20, DEFAULT_PARAMS, el, ctx)
    assert row is not None
    assert set(row.keys()) == set(FEATURE_NAMES)
    assert all(isinstance(v, float) for v in row.values())


def test_feature_row_none_when_no_prior():
    row = build_feature_row([{'round': 5, 'minutes': 90}], 1, DEFAULT_PARAMS,
                            {'now_cost': 50}, {'was_home': 1, 'n_fixtures': 1,
                            'norm_concede_rate': 0.5, 'norm_attack_rate': 0.5,
                            'difficulty': 0.5, 'odds_cs_prob': 0.3, 'attack_difficulty': 0.4})
    assert row is None  # no entries with round < 1


def test_feature_row_is_leakage_free():
    pid, hist = _player_with_history()
    el = {'now_cost': 75}
    ctx = {'was_home': 1, 'n_fixtures': 1, 'norm_concede_rate': 0.5,
           'norm_attack_rate': 0.5, 'difficulty': 0.5, 'odds_cs_prob': 0.3,
           'attack_difficulty': 0.4}
    base = build_feature_row(hist, 20, DEFAULT_PARAMS, el, ctx)
    # mutate the FUTURE: inflate every round>=20 entry's stats + append a fake future GW
    poisoned = copy.deepcopy(hist)
    for e in poisoned:
        if e.get('round', 0) >= 20:
            e['minutes'] = 90
            e['expected_goals'] = '9.9'
            e['total_points'] = 99
    poisoned.append({'round': 38, 'minutes': 90, 'expected_goals': '9.9',
                     'expected_assists': '9.9', 'starts': 1, 'total_points': 99})
    after = build_feature_row(poisoned, 20, DEFAULT_PARAMS, el, ctx)
    assert base == after  # future cannot change an as-of-GW20 feature row


def test_build_dataset_rows_match_backtest_gating_and_labels():
    rows, names = build_dataset(_ARCHIVE, DEFAULT_PARAMS, first_gw=7, last_gw=38)
    assert names == FEATURE_NAMES
    assert rows, 'dataset must be non-empty'
    r = rows[0]
    assert set(r.keys()) >= {'features', 'label', 'element_type', 'player_id',
                             'web_name', 'gw', 'actual_minutes', 'n_fixtures'}
    assert isinstance(r['label'], int)
    # spot-check a known (player, gw) label equals sum of total_points that GW
    pid = r['player_id']; gw = r['gw']
    hist = _ARCHIVE['summaries'][pid]['history']
    expected = sum(e.get('total_points', 0) or 0 for e in hist if e.get('round') == gw)
    assert r['label'] == expected
```

- [ ] **Step 2: Run, verify fail.** `cd pipeline; python -m pytest tests/test_ml_features.py -q`.

- [ ] **Step 3: Implement** `pipeline/ml/__init__.py` (empty) and `pipeline/ml/features.py`:

```python
"""ML-01: leakage-free feature extraction for the shadow model.

Wraps backtest.build_asof_signals (12 as-of signals) + fixture-level leakage-free
signals (def_form, atf_form, FPL difficulty, ODDS-01 cs_prob/attack_difficulty) +
static features (price, home, DGW count) into a flat numeric feature row, and
assembles a labelled (player, gw) dataset mirroring run_backtest's gating.
"""
from collections import defaultdict

from backtest import build_asof_signals

# Stable, ordered feature names (the model consumes vectors in this order).
_ASOF_FEATURES = [
    'xg_per90', 'xa_per90', 'season_xg90', 'season_xa90', 'cum_minutes',
    'xmins', 'start_prob', 'mins_60_prob', 'sub_appear_prob',
    'dc_rate_10', 'dc_rate_12', 'saves_per90',
]
_CTX_FEATURES = ['was_home', 'n_fixtures', 'norm_concede_rate', 'norm_attack_rate',
                 'difficulty', 'odds_cs_prob', 'attack_difficulty', 'now_cost']
FEATURE_NAMES = _ASOF_FEATURES + _CTX_FEATURES


def build_feature_row(history, gw, params, element, fixture_ctx):
    """Flat {feature_name: float} for one (player, gw), or None if no prior data.
    `element` supplies now_cost; `fixture_ctx` supplies the per-GW fixture signals."""
    sig = build_asof_signals(history, gw, params)
    if sig is None:
        return None
    row = {f: float(sig[f]) for f in _ASOF_FEATURES}
    row['was_home'] = float(fixture_ctx['was_home'])
    row['n_fixtures'] = float(fixture_ctx['n_fixtures'])
    row['norm_concede_rate'] = float(fixture_ctx['norm_concede_rate'])
    row['norm_attack_rate'] = float(fixture_ctx['norm_attack_rate'])
    row['difficulty'] = float(fixture_ctx['difficulty'])
    row['odds_cs_prob'] = float(fixture_ctx['odds_cs_prob'])
    row['attack_difficulty'] = float(fixture_ctx['attack_difficulty'])
    row['now_cost'] = float(element.get('now_cost', 0) or 0)
    return row


def _fixture_ctx(entries, gw, team_id, fixtures_by_id, def_form, atf_form,
                 odds_lookup):
    """Per-(player,gw) fixture context, averaged over the player's fixtures that GW
    (handles DGW). entries = the player's history rows for this gw."""
    n = len(entries)
    diffs, cs_probs, atk_diffs = [], [], []
    was_home_any = 0
    for e in entries:
        fix = fixtures_by_id.get(e.get('fixture'))
        if fix is None:
            continue
        was_home = bool(e.get('was_home'))
        was_home_any = max(was_home_any, 1 if was_home else 0)
        raw = fix.get('team_h_difficulty', 3) if was_home else fix.get('team_a_difficulty', 3)
        diffs.append((raw - 1) / 4.0)
        if odds_lookup is not None:
            od = odds_lookup.get((fix['id'], team_id))
            if od is not None:
                cs_probs.append(od['cs_prob'])
                atk_diffs.append(od['attack_difficulty'])
    mean = lambda xs, d: (sum(xs) / len(xs)) if xs else d
    return {
        'was_home': was_home_any,
        'n_fixtures': n,
        'norm_concede_rate': def_form.get((gw, team_id), 0.5),
        'norm_attack_rate': atf_form.get((gw, team_id), 0.5),
        'difficulty': mean(diffs, 0.5),
        'odds_cs_prob': mean(cs_probs, 0.0),
        'attack_difficulty': mean(atk_diffs, 0.0),
    }


def build_dataset(archive, params, first_gw=7, last_gw=38, odds_lookup=None):
    """Labelled (player, gw) rows mirroring run_backtest gating. Returns (rows, FEATURE_NAMES)."""
    from accuracy import build_team_def_form_lookup, build_team_atf_lookup

    fixtures = archive['fixtures']
    fixtures_by_id = {f['id']: f for f in fixtures}
    def_form = build_team_def_form_lookup(fixtures, params['cs_def_form_window_gws'])
    atf_form = build_team_atf_lookup(fixtures, params['atf_window_gws'])
    elements_by_id = {e['id']: e for e in archive['bootstrap']['elements']}

    rows = []
    for pid, summary in archive['summaries'].items():
        el = elements_by_id.get(pid)
        if el is None:
            continue
        team_id = el['team']
        history = summary.get('history', [])
        by_gw = defaultdict(list)
        for e in history:
            by_gw[e.get('round')].append(e)

        for gw in range(first_gw, last_gw + 1):
            entries = by_gw.get(gw)
            if not entries:
                continue
            sig = build_asof_signals(history, gw, params)
            if sig is None or sig['cum_minutes'] < params['min_prior_minutes']:
                continue
            if sig['xmins'] <= 0:   # deploy-mode gate (mirror run_backtest)
                continue
            ctx = _fixture_ctx(entries, gw, team_id, fixtures_by_id,
                               def_form, atf_form, odds_lookup)
            features = build_feature_row(history, gw, params, el, ctx)
            if features is None:
                continue
            rows.append({
                'features': features,
                'label': sum(e.get('total_points', 0) or 0 for e in entries),
                'element_type': el['element_type'],
                'player_id': pid,
                'web_name': el.get('web_name', str(pid)),
                'gw': gw,
                'actual_minutes': sum(e.get('minutes', 0) or 0 for e in entries),
                'n_fixtures': len(entries),
            })
    return rows, FEATURE_NAMES
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_ml_features.py -q`.
- [ ] **Step 5: Commit.**
```bash
git add pipeline/ml/__init__.py pipeline/ml/features.py pipeline/tests/test_ml_features.py
git commit -m "feat(ml-01): leakage-free feature extraction + labelled dataset"
```

---

### Task 3: `pipeline/ml/model.py` — position-specific xgboost

**Files:**
- Create: `pipeline/ml/model.py`
- Test: `pipeline/tests/test_ml_model.py`

- [ ] **Step 1: Write the failing tests** `pipeline/tests/test_ml_model.py`:

```python
from ml.model import rows_to_matrix, train_position_models, predict

_NAMES = ['a', 'b']


def _rows(et, n, base):
    # label correlates with feature 'a' so the model has something to learn
    return [{'features': {'a': float(i), 'b': 1.0}, 'label': base + i,
             'element_type': et} for i in range(n)]


def test_rows_to_matrix_orders_by_feature_names():
    import numpy as np
    m = rows_to_matrix([{'features': {'a': 1.0, 'b': 2.0}}], _NAMES)
    assert isinstance(m, np.ndarray)
    assert m.shape == (1, 2)
    assert list(m[0]) == [1.0, 2.0]


def test_train_and_predict_returns_finite_per_row():
    import math
    train = _rows(1, 60, 2) + _rows(2, 60, 5)
    models = train_position_models(train, _NAMES, seed=42)
    assert set(models) == {1, 2}
    preds = predict(models, _rows(1, 10, 2), _NAMES)
    assert len(preds) == 10
    assert all(math.isfinite(p) for p in preds)


def test_position_routing_uses_matching_model():
    train = _rows(1, 60, 2) + _rows(4, 60, 50)  # GK low, FWD high
    models = train_position_models(train, _NAMES, seed=42)
    gk_pred = predict(models, [{'features': {'a': 5.0, 'b': 1.0}, 'element_type': 1}], _NAMES)[0]
    fwd_pred = predict(models, [{'features': {'a': 5.0, 'b': 1.0}, 'element_type': 4}], _NAMES)[0]
    assert fwd_pred > gk_pred  # routed to different position models


def test_determinism_same_seed_same_preds():
    train = _rows(3, 80, 4)
    p1 = predict(train_position_models(train, _NAMES, seed=7), _rows(3, 5, 4), _NAMES)
    p2 = predict(train_position_models(train, _NAMES, seed=7), _rows(3, 5, 4), _NAMES)
    assert p1 == p2
```

- [ ] **Step 2: Run, verify fail.** `cd pipeline; python -m pytest tests/test_ml_model.py -q`.

- [ ] **Step 3: Implement** `pipeline/ml/model.py`:

```python
"""ML-01: position-specific xgboost regressors over the leakage-free features.

One XGBRegressor per element_type (1=GK,2=DEF,3=MID,4=FWD). Deterministic
(fixed seed). Target = actual points for the (player, gw) row.
"""
from collections import defaultdict

import numpy as np
from xgboost import XGBRegressor

_XGB_PARAMS = dict(
    n_estimators=300, max_depth=4, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, objective='reg:squarederror',
)


def rows_to_matrix(rows, feature_names):
    """Stack each row's features in feature_names order into an (n, k) float array."""
    return np.array([[r['features'][f] for f in feature_names] for r in rows],
                    dtype=float)


def train_position_models(train_rows, feature_names, seed=42):
    """Train one XGBRegressor per element_type present. Returns {element_type: model}."""
    by_pos = defaultdict(list)
    for r in train_rows:
        by_pos[r['element_type']].append(r)
    models = {}
    for et, rows in by_pos.items():
        X = rows_to_matrix(rows, feature_names)
        y = np.array([r['label'] for r in rows], dtype=float)
        model = XGBRegressor(random_state=seed, **_XGB_PARAMS)
        model.fit(X, y)
        models[et] = model
        if len(rows) < 50:
            print(f"ML-01 warning: position {et} trained on only {len(rows)} rows")
    return models


def predict(models, rows, feature_names):
    """Predict per row, routing each to its element_type's model. Returns list[float].
    Rows whose position has no trained model get 0.0 (logged)."""
    preds = [0.0] * len(rows)
    by_pos = defaultdict(list)
    for i, r in enumerate(rows):
        by_pos[r['element_type']].append(i)
    for et, idxs in by_pos.items():
        model = models.get(et)
        if model is None:
            print(f"ML-01 warning: no model for position {et}; predicting 0.0")
            continue
        X = rows_to_matrix([rows[i] for i in idxs], feature_names)
        out = model.predict(X)
        for j, i in enumerate(idxs):
            preds[i] = float(out[j])
    return preds
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_ml_model.py -q`.
- [ ] **Step 5: Commit.**
```bash
git add pipeline/ml/model.py pipeline/tests/test_ml_model.py
git commit -m "feat(ml-01): position-specific xgboost regressors"
```

---

### Task 4: `pipeline/experiments/exp11_ml_shadow.py` — shadow comparison (no verdict)

**Files:**
- Create: `pipeline/experiments/exp11_ml_shadow.py`
- Create (output): `pipeline/experiments/exp11_ml_shadow.json`
- Test: `pipeline/tests/test_exp11_ml_shadow.py`

- [ ] **Step 1: Write the failing test** `pipeline/tests/test_exp11_ml_shadow.py`:

```python
def test_exp11_runs_produces_ml_and_formula_metrics_and_caveat():
    from experiments import exp11_ml_shadow
    result = exp11_ml_shadow.run()
    assert 'ml_metrics' in result and 'formula_metrics' in result
    for m in (result['ml_metrics'], result['formula_metrics']):
        assert m['top10_mean_pts'] is not None
        assert m['rmse'] is not None
    assert 'feature_importances' in result
    assert 'caveat' in result and 'NOT a promotion signal' in result['caveat']
    assert 'verdict' not in result  # groundwork: deliberately no verdict
```

- [ ] **Step 2: Run, verify fail.** `cd pipeline; python -m pytest tests/test_exp11_ml_shadow.py -q`.

- [ ] **Step 3: Implement** `pipeline/experiments/exp11_ml_shadow.py`:

```python
"""ML-01 / exp11: ML shadow model vs the formula model on the 2025/26 archive.

Run:  cd pipeline; python -m experiments.exp11_ml_shadow

GROUNDWORK ONLY — in-sample, one season. Train/test share players across halves,
so the model memorizes player-level scoring and the numbers OVERSTATE true edge.
This is a harness sanity check, NOT a promotion signal. No SHIP/NO_SHIP verdict.
Real validation is gated on a cold 2026/27 cross-season test.
"""
import json
import os

from capture_season import load_season_archive
from backtest import run_backtest, compute_metrics, DEFAULT_PARAMS
from ml.features import build_dataset, FEATURE_NAMES
from ml.model import train_position_models, predict

_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exp11_ml_shadow.json')
_TRAIN_LAST = 28   # train GW7-28
_TEST_FIRST = 29   # test GW29-38

CAVEAT = ("IN-SAMPLE shadow over one season — train/test share players across halves, "
          "so the model memorizes player-level scoring and these numbers OVERSTATE true "
          "edge. Harness sanity check, NOT a promotion signal. Promotion is gated on a "
          "cold 2026/27 cross-season test (train 2025/26 -> predict 2026/27 unseen).")


def run():
    archive = load_season_archive()
    params = dict(DEFAULT_PARAMS)
    rows, names = build_dataset(archive, params, first_gw=7, last_gw=38)

    train = [r for r in rows if r['gw'] <= _TRAIN_LAST]
    test = [r for r in rows if r['gw'] >= _TEST_FIRST]
    models = train_position_models(train, names, seed=42)
    preds = predict(models, test, names)

    # assemble ML rows in the run_backtest schema, score with the shared yardstick
    ml_rows = []
    for r, p in zip(test, preds):
        ml_rows.append({
            'player_id': r['player_id'], 'web_name': r['web_name'],
            'element_type': r['element_type'], 'gw': r['gw'],
            'xpts_pred': round(p, 3), 'actual_pts': r['label'],
            'actual_minutes': r['actual_minutes'],
            'xmins_used': 0.0, 'xg_per90': 0.0, 'xa_per90': 0.0,
            'n_fixtures': r['n_fixtures'], 'congestion_clash': False,
        })
    ml_metrics, _ = compute_metrics(ml_rows)

    # formula model on the same GW29-38 window
    formula = run_backtest(archive, mode='deploy', first_gw=_TEST_FIRST, last_gw=38)
    formula_metrics = formula['metrics']

    importances = {}
    for et, model in sorted(models.items()):
        imp = model.feature_importances_
        importances[et] = {names[i]: round(float(imp[i]), 4) for i in range(len(names))}

    result = {
        'ml_metrics': ml_metrics,
        'formula_metrics': formula_metrics,
        'feature_importances': importances,
        'caveat': CAVEAT,
        'config': {'train_gw': [7, _TRAIN_LAST], 'test_gw': [_TEST_FIRST, 38],
                   'n_train': len(train), 'n_test': len(test), 'seed': 42},
    }
    with open(_OUT, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2)
    return result


def _print(result):
    keys = ['top10_mean_pts', 'haul_hit_rate', 'haul_capture_20', 'captain_return_rate',
            'rmse', 'mae', 'spearman']
    print('=== ML shadow vs formula (GW29-38, IN-SAMPLE) ===')
    print(f"{'metric':22} {'ML':>10} {'formula':>10}")
    for k in keys:
        ml = result['ml_metrics'].get(k)
        fo = result['formula_metrics'].get(k)
        print(f"{k:22} {ml!s:>10} {fo!s:>10}")
    print('\n!!! CAVEAT:', result['caveat'])


if __name__ == '__main__':
    r = run()
    _print(r)
```

- [ ] **Step 4: Run, verify pass.** `cd pipeline; python -m pytest tests/test_exp11_ml_shadow.py -q`. (If slow, acceptable; optionally mark with `@pytest.mark.slow` if the repo uses that marker — check, else leave.)
- [ ] **Step 5: Run for real + commit.**
```powershell
python -m experiments.exp11_ml_shadow
```
Report the printed ML-vs-formula table + CAVEAT verbatim. Commit:
```bash
git add pipeline/experiments/exp11_ml_shadow.py pipeline/experiments/exp11_ml_shadow.json pipeline/tests/test_exp11_ml_shadow.py
git commit -m "exp(ml-01): ML shadow vs formula comparison (in-sample, no verdict)"
```

---

### Task 5: Full-suite verification + isolation check

- [ ] **Step 1:** Run the full suite: `cd pipeline; python -m pytest -q`. All green.
- [ ] **Step 2:** Verify xgboost is NOT imported by the production path: `grep -rn "import xgboost\|from xgboost\|import ml\.\|from ml" pipeline/run.py pipeline/merge.py pipeline/accuracy.py` returns nothing (the ml harness is lab-only). Report the result.
- [ ] **Step 3:** Report the exp11 ML-vs-formula table + CAVEAT to the controller. Emphasize: no verdict, in-sample, groundwork. Do NOT wire anything live.
- [ ] **Step 4:** Commit any fixups.

---

## Out of scope (do NOT build here)
- Any live wiring (`ml_xpts`/`ensemble_xpts`/`model_disagreement` in merged_players, run.py import of ml/). Post-validation.
- Promotion / live default change.
- The cold 2026/27 cross-season validation (gated on that season).
- Hyperparameter tuning, ensembling, per-component targets, model persistence.
- Any UI change.
