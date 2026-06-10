# BT-02: Leakage-Free Backtest Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline, leakage-free backtest lab (`pipeline/backtest.py`) that reconstructs model inputs strictly from pre-GW data and evaluates predictions over GWs 7–38 of the archived 2025/26 season.

**Architecture:** One new module with three layers: (1) `build_asof_signals` — point-in-time per-player signal construction; (2) `run_backtest` — prediction loop reusing `merge._compute_xpts_fixture` per fixture (DGW-aware) with two modes; (3) `compute_metrics` — picks-focused metrics. Plus a CLI. Nothing in the live pipeline is modified.

**Tech Stack:** Python 3.11, pytest, stdlib only (no scipy — Spearman implemented inline).

---

## Plan deviation from spec (documented)

The spec listed `accuracy.build_fixture_difficulty_lookup` for reuse. It is keyed `(gw, team_id)` so a DGW's two fixtures collide (last one wins). BT-02 computes difficulty **per fixture** inline instead: `(team_h_difficulty-1)/4` when home, `(team_a_difficulty-1)/4` when away. The two team-form lookups ARE reused (same value for both DGW fixtures is correct — form is as-of-GW).

## File map

| File | Change |
|---|---|
| `pipeline/backtest.py` | Create — signals, prediction loop, metrics, CLI |
| `pipeline/tests/test_backtest.py` | Create — 9 unit tests + 1 real-data smoke test |

Working directory for all commands: `pipeline/`

---

## Task 1: `backtest.py` — as-of-GW signal construction

**Files:**
- Create: `pipeline/backtest.py` (constants + `build_asof_signals`)
- Create: `pipeline/tests/test_backtest.py` (synthetic helpers + 3 tests)

### Step 1: Write the failing tests

Create `pipeline/tests/test_backtest.py`:

```python
"""Tests for backtest.py (BT-02). Synthetic data only — no network, no archive."""
import pytest

import backtest


# ── synthetic archive helpers ─────────────────────────────────────────────── #

def _entry(rnd, fixture_id, minutes=90, xg=0.3, xa=0.1, pts=2, starts=1,
           was_home=True):
    return {
        'round': rnd, 'fixture': fixture_id, 'minutes': minutes,
        'expected_goals': str(xg), 'expected_assists': str(xa),
        'total_points': pts, 'starts': starts, 'was_home': was_home,
        'opponent_team': 2 if was_home else 1,
    }


def _uniform_history(n_gws, minutes=90, xg=0.3, xa=0.1, pts=2):
    """One fixture per GW, fixture id = round number."""
    return [_entry(g, g, minutes=minutes, xg=xg, xa=xa, pts=pts)
            for g in range(1, n_gws + 1)]


def _params(**over):
    p = dict(backtest.DEFAULT_PARAMS)
    p.update(over)
    return p


# ── build_asof_signals ────────────────────────────────────────────────────── #

def test_asof_per90_uses_only_prior_rounds():
    """Cumulative per-90s at GW g must exclude GW g itself (the leak BT-02 fixes)."""
    hist = _uniform_history(10, xg=0.3)
    # Inflate GW 8's xG massively — signals AT GW 8 must not change
    hist_inflated = [dict(e) for e in hist]
    hist_inflated[7]['expected_goals'] = '9.9'
    base = backtest.build_asof_signals(hist, 8, _params())
    infl = backtest.build_asof_signals(hist_inflated, 8, _params())
    assert base['xg_per90'] == infl['xg_per90']
    # ...but signals at GW 9 DO see GW 8
    base9 = backtest.build_asof_signals(hist, 9, _params())
    infl9 = backtest.build_asof_signals(hist_inflated, 9, _params())
    assert infl9['xg_per90'] > base9['xg_per90']


def test_asof_cum_minutes_and_eligibility_threshold():
    """cum_minutes counts only prior rounds; 270-minute threshold is the caller's gate."""
    hist = _uniform_history(4, minutes=90)  # 90,90,90,90
    sig3 = backtest.build_asof_signals(hist, 3, _params())   # prior = GW1-2 = 180
    sig4 = backtest.build_asof_signals(hist, 4, _params())   # prior = GW1-3 = 270
    assert sig3['cum_minutes'] == 180
    assert sig4['cum_minutes'] == 270
    # No prior data at all -> None
    assert backtest.build_asof_signals(hist, 1, _params()) is None


def test_asof_xmins_window_and_probs():
    """Deploy-mode minutes signals come from the last 5 prior entries."""
    # Alternating 90/0: rounds 1..10 -> minutes 90,0,90,0,90,0,90,0,90,0
    hist = []
    for g in range(1, 11):
        m = 90 if g % 2 == 1 else 0
        hist.append(_entry(g, g, minutes=m, starts=1 if m else 0,
                           pts=2 if m else 0))
    sig = backtest.build_asof_signals(hist, 11, _params())
    # last 5 prior entries = rounds 6-10 = minutes 0,90,0,90,0 -> mean 36
    assert sig['xmins'] == pytest.approx(36.0)
    assert sig['start_prob'] == pytest.approx(2 / 5)
    assert sig['mins_60_prob'] == pytest.approx(2 / 5)
    assert sig['sub_appear_prob'] == 0.0  # 0-minute games are absences, not sub cameos
```

### Step 2: Run tests to verify they fail

Run: `cd pipeline && python -m pytest tests/test_backtest.py -v`
Expected: FAIL/ERROR (ModuleNotFoundError: backtest)

### Step 3: Create `backtest.py` with constants and `build_asof_signals`

Create `pipeline/backtest.py`:

```python
"""BT-02: leakage-free full-season backtest harness.

Offline lab over the SA-01 season archive. For each target GW, every model
input is reconstructed strictly from rounds BEFORE that GW — unlike
accuracy.py's backtest, which feeds the target GW's own xG and minutes into
its "prediction" (contemporaneous leakage).

Modes:
  deploy      — minutes predicted from prior rounds (deadline-day reality)
  conditional — target GW's actual minutes (isolates rate-model quality;
                per-90s remain strictly prior)

Usage:
  python backtest.py [--mode deploy|conditional] [--first-gw 7] [--last-gw 38]
                     [--set key=value ...] [--json out.json]

Public API:
  run_backtest(archive=None, params=None, mode='deploy',
               first_gw=7, last_gw=38) -> dict
  build_asof_signals(history, gw, params) -> dict | None
  compute_metrics(rows) -> (metrics: dict, per_gw: list)

Does NOT modify the live pipeline (accuracy.py / tune.py / run.py / merge.py).
"""
import argparse
import json
import math
import sys
from collections import defaultdict

DEFAULT_PARAMS = {
    # Mirrors live-model deployed behaviour (form gate OFF -> blend_alpha 0).
    'blend_alpha': 0.0,
    'form_window_gws': 5,
    'cs_prob_base': 0.40,
    'cs_prob_slope': 0.30,
    'cs_team_form_slope': 0.0,
    'cs_def_form_window_gws': 6,
    'atf_slope': 0.0,
    'atf_window_gws': 6,
    # BT-02-local
    'min_prior_minutes': 270,
    'xmins_window': 5,
}

HAUL_THRESHOLD = 10
TOP_N = 10
TOP_N_CAPTURE = 20
MID_TOP_N = 30
MIN_FORM_MINUTES = 90


def build_asof_signals(history: list, gw: int, params: dict):
    """Point-in-time signals for one player at target GW `gw`.

    Uses ONLY history entries with round < gw. Returns None when there are no
    prior entries. Eligibility (min_prior_minutes) is enforced by the caller
    so tests and experiments can inspect sub-threshold signals.
    """
    prior = [e for e in history if e.get('round', 0) < gw]
    if not prior:
        return None

    cum_minutes = sum(e.get('minutes', 0) or 0 for e in prior)
    cum_xg = sum(float(e.get('expected_goals', 0) or 0) for e in prior)
    cum_xa = sum(float(e.get('expected_assists', 0) or 0) for e in prior)

    if cum_minutes > 0:
        season_xg90 = cum_xg / cum_minutes * 90.0
        season_xa90 = cum_xa / cum_minutes * 90.0
    else:
        season_xg90 = season_xa90 = 0.0

    # Form: last form_window_gws prior entries actually played
    alpha = params['blend_alpha']
    xg_per90, xa_per90 = season_xg90, season_xa90
    if alpha > 0:
        played = [e for e in prior if (e.get('minutes', 0) or 0) > 0]
        window = played[-params['form_window_gws']:]
        form_min = sum(e.get('minutes', 0) or 0 for e in window)
        if form_min >= MIN_FORM_MINUTES:
            form_xg90 = sum(float(e.get('expected_goals', 0) or 0)
                            for e in window) / form_min * 90.0
            form_xa90 = sum(float(e.get('expected_assists', 0) or 0)
                            for e in window) / form_min * 90.0
            xg_per90 = (1 - alpha) * season_xg90 + alpha * form_xg90
            xa_per90 = (1 - alpha) * season_xa90 + alpha * form_xa90

    # Minutes model (deploy mode): last xmins_window prior entries
    last = prior[-params['xmins_window']:]
    n = len(last)
    xmins = sum(e.get('minutes', 0) or 0 for e in last) / n
    start_prob = sum(1 for e in last if (e.get('starts', 0) or 0) >= 1) / n
    mins_60_prob = sum(1 for e in last
                       if (e.get('minutes', 0) or 0) >= 60) / n
    sub_appear_prob = sum(1 for e in last
                          if 0 < (e.get('minutes', 0) or 0) < 45) / n

    return {
        'xg_per90': xg_per90,
        'xa_per90': xa_per90,
        'season_xg90': season_xg90,
        'season_xa90': season_xa90,
        'cum_minutes': cum_minutes,
        'xmins': xmins,
        'start_prob': start_prob,
        'mins_60_prob': mins_60_prob,
        'sub_appear_prob': sub_appear_prob,
    }
```

### Step 4: Run tests to verify they pass

Run: `cd pipeline && python -m pytest tests/test_backtest.py -v`
Expected: 3 PASSED

### Step 5: Commit

```bash
git add pipeline/backtest.py pipeline/tests/test_backtest.py
git commit -m "feat(bt-02): as-of-GW signal construction for leakage-free backtest"
```

---

## Task 2: `backtest.py` — prediction loop + metrics + `run_backtest`

**Files:**
- Modify: `pipeline/backtest.py` (append `_spearman`, `compute_metrics`, `run_backtest`)
- Modify: `pipeline/tests/test_backtest.py` (add synthetic-archive builder + 5 tests)

### Step 1: Write the failing tests

Append to `pipeline/tests/test_backtest.py`:

```python
# ── synthetic archive for run_backtest ────────────────────────────────────── #

def _make_archive(n_gws=12, dgw_gw=None, players=None):
    """Two teams (1, 2) playing each other every GW. fixture id = 100+gw
    (and 200+gw for the second DGW fixture). players: list of dicts with
    id, element_type, team, history-overrides."""
    fixtures = []
    for g in range(1, n_gws + 1):
        fixtures.append({
            'id': 100 + g, 'event': g, 'team_h': 1, 'team_a': 2,
            'team_h_score': 1, 'team_a_score': 1, 'finished': True,
            'team_h_difficulty': 3, 'team_a_difficulty': 3,
        })
        if dgw_gw is not None and g == dgw_gw:
            fixtures.append({
                'id': 200 + g, 'event': g, 'team_h': 2, 'team_a': 1,
                'team_h_score': 1, 'team_a_score': 1, 'finished': True,
                'team_h_difficulty': 3, 'team_a_difficulty': 3,
            })
    players = players or []
    elements = [{'id': p['id'], 'element_type': p.get('element_type', 4),
                 'team': p.get('team', 1), 'web_name': f"P{p['id']}"}
                for p in players]
    summaries = {p['id']: {'history': p['history']} for p in players}
    return {
        'bootstrap': {'elements': elements,
                      'events': [{'id': g, 'finished': True}
                                 for g in range(1, n_gws + 1)]},
        'fixtures': fixtures,
        'understat': {},
        'summaries': summaries,
        'manifest': {'season': 'synthetic'},
    }


def _std_player(pid, n_gws=12, **entry_over):
    hist = []
    for g in range(1, n_gws + 1):
        e = _entry(g, 100 + g, was_home=True)
        e.update(entry_over)
        e['round'] = g
        e['fixture'] = 100 + g
        hist.append(e)
    return {'id': pid, 'history': hist}


def test_run_backtest_no_leakage_end_to_end():
    """Inflating a player's GW-8 xG must not change his GW-8 prediction."""
    base_arch = _make_archive(players=[_std_player(1)])
    infl = _make_archive(players=[_std_player(1)])
    for e in infl['summaries'][1]['history']:
        if e['round'] == 8:
            e['expected_goals'] = '9.9'
    r_base = backtest.run_backtest(archive=base_arch, first_gw=8, last_gw=8)
    r_infl = backtest.run_backtest(archive=infl, first_gw=8, last_gw=8)
    assert r_base['rows'][0]['xpts_pred'] == r_infl['rows'][0]['xpts_pred']


def test_run_backtest_eligibility_gate():
    """Player with <270 prior minutes produces no row."""
    p = _std_player(1)
    for e in p['history']:
        e['minutes'] = 60  # 60*6 prior at GW7 = 360 OK; at GW5 = 240 not OK
    arch = _make_archive(players=[p])
    r5 = backtest.run_backtest(archive=arch, first_gw=5, last_gw=5)
    r7 = backtest.run_backtest(archive=arch, first_gw=7, last_gw=7)
    assert len(r5['rows']) == 0
    assert len(r7['rows']) == 1


def test_dgw_sums_two_fixtures():
    """GW with two fixtures -> predicted equals 2x the single-fixture prediction
    (symmetric synthetic world) and actual sums both entries."""
    p = _std_player(1)
    # add second GW-8 entry (away fixture 208)
    e2 = _entry(8, 208, was_home=False, pts=5)
    p['history'].append(e2)
    p['history'].sort(key=lambda e: (e['round'], e['fixture']))
    arch = _make_archive(dgw_gw=8, players=[p])
    single = _make_archive(players=[_std_player(1)])
    r_dgw = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8)
    r_one = backtest.run_backtest(archive=single, first_gw=8, last_gw=8)
    assert r_dgw['rows'][0]['xpts_pred'] == pytest.approx(
        2 * r_one['rows'][0]['xpts_pred'])
    assert r_dgw['rows'][0]['actual_pts'] == 2 + 5


def test_modes_differ_on_minutes():
    """Rotation player: deploy uses predicted xmins; conditional uses actual."""
    p = _std_player(1)
    for e in p['history']:
        m = 90 if e['round'] % 2 == 1 else 0
        e['minutes'] = m
        e['starts'] = 1 if m else 0
    arch = _make_archive(players=[p])
    # GW 11 is odd -> played 90 that GW
    dep = backtest.run_backtest(archive=arch, mode='deploy',
                                first_gw=11, last_gw=11)
    con = backtest.run_backtest(archive=arch, mode='conditional',
                                first_gw=11, last_gw=11)
    assert len(dep['rows']) == 1 and len(con['rows']) == 1
    # conditional (actual 90 min) must predict more than deploy (xmins 36)
    assert con['rows'][0]['xpts_pred'] > dep['rows'][0]['xpts_pred']


def test_param_override_changes_predictions():
    """atf_slope with non-neutral attack form shifts predictions."""
    # Team 1 scores 3/game, team 2 scores 0 -> team 1 attack form -> 1.0
    arch = _make_archive(players=[_std_player(1)])
    for f in arch['fixtures']:
        f['team_h_score'] = 3
        f['team_a_score'] = 0
    base = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8)
    boosted = backtest.run_backtest(archive=arch, first_gw=8, last_gw=8,
                                    params={'atf_slope': 0.4})
    assert boosted['rows'][0]['xpts_pred'] > base['rows'][0]['xpts_pred']


# ── metrics ───────────────────────────────────────────────────────────────── #

def _row(pid, gw, pred, actual, et=4):
    return {'player_id': pid, 'web_name': f'P{pid}', 'element_type': et,
            'gw': gw, 'xpts_pred': pred, 'actual_pts': actual}


def test_haul_hit_rate_computation():
    # GW1: 12 players; haulers are pids 1 (pred rank 1) and 12 (pred rank 12).
    rows = [_row(i, 1, pred=13 - i, actual=(12 if i in (1, 12) else 3))
            for i in range(1, 13)]
    metrics, per_gw = backtest.compute_metrics(rows)
    assert metrics['haul_hit_rate'] == pytest.approx(0.5)      # 1 of 2 in top-10
    assert metrics['haul_capture_20'] == pytest.approx(1.0)    # both in top-20 (only 12 rows)
    assert metrics['captain_hit_rate'] == 1.0                  # rank-1 pid 1 scored max 12
    assert metrics['captain_return_rate'] == 1.0               # >= 6
    assert per_gw[0]['n_haulers'] == 2
    assert metrics['top10_mean_pts'] == pytest.approx(
        (12 + 3 * 9) / 10)


def test_spearman_perfect_and_inverted():
    rows_perfect = [_row(i, 1, pred=10 - i, actual=10 - i) for i in range(5)]
    rows_inverted = [_row(i, 1, pred=10 - i, actual=i) for i in range(5)]
    m1, _ = backtest.compute_metrics(rows_perfect)
    m2, _ = backtest.compute_metrics(rows_inverted)
    assert m1['spearman'] == pytest.approx(1.0)
    assert m2['spearman'] == pytest.approx(-1.0)
```

### Step 2: Run tests to verify they fail

Run: `cd pipeline && python -m pytest tests/test_backtest.py -v`
Expected: 3 PASSED (Task 1), 7 FAILED (AttributeError: no run_backtest / compute_metrics)

### Step 3: Append the engine to `backtest.py`

Append to `pipeline/backtest.py`:

```python
def _spearman(xs: list, ys: list) -> float:
    """Spearman rank correlation with average ranks for ties. Stdlib only."""
    def _rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        ranks = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                ranks[order[k]] = avg
            i = j + 1
        return ranks

    if len(xs) < 2:
        return 0.0
    rx, ry = _rank(xs), _rank(ys)
    n = len(xs)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx)
                    * sum((b - my) ** 2 for b in ry))
    return num / den if den > 0 else 0.0


def compute_metrics(rows: list):
    """Aggregate picks-focused metrics. Returns (metrics, per_gw)."""
    by_gw = defaultdict(list)
    for r in rows:
        by_gw[r['gw']].append(r)

    per_gw = []
    total_haulers = total_haul_hits = total_haul_hits20 = 0
    total_mid = total_mid_hits = 0
    captain_hits = captain_returns = 0
    spearmans = []
    top10_means = []

    for gw in sorted(by_gw):
        rws = sorted(by_gw[gw], key=lambda r: -r['xpts_pred'])
        top10_ids = {r['player_id'] for r in rws[:TOP_N]}
        top20_ids = {r['player_id'] for r in rws[:TOP_N_CAPTURE]}
        top30_ids = {r['player_id'] for r in rws[:MID_TOP_N]}

        haulers = [r for r in rws if r['actual_pts'] >= HAUL_THRESHOLD]
        hits = sum(1 for r in haulers if r['player_id'] in top10_ids)
        hits20 = sum(1 for r in haulers if r['player_id'] in top20_ids)
        mid = [r for r in rws if 6 <= r['actual_pts'] <= 9]
        mid_hits = sum(1 for r in mid if r['player_id'] in top30_ids)

        max_actual = max(r['actual_pts'] for r in rws)
        cap = rws[0]
        cap_hit = 1 if cap['actual_pts'] == max_actual else 0
        cap_ret = 1 if cap['actual_pts'] >= 6 else 0

        sp = _spearman([r['xpts_pred'] for r in rws],
                       [r['actual_pts'] for r in rws])
        t10_mean = (sum(r['actual_pts'] for r in rws[:TOP_N])
                    / min(TOP_N, len(rws)))

        total_haulers += len(haulers)
        total_haul_hits += hits
        total_haul_hits20 += hits20
        total_mid += len(mid)
        total_mid_hits += mid_hits
        captain_hits += cap_hit
        captain_returns += cap_ret
        spearmans.append(sp)
        top10_means.append(t10_mean)

        per_gw.append({
            'gw': gw, 'n_rows': len(rws), 'n_haulers': len(haulers),
            'haul_hits': hits, 'haul_hit_rate':
                hits / len(haulers) if haulers else None,
            'captain_actual': cap['actual_pts'], 'captain_name':
                cap.get('web_name', ''),
            'spearman': round(sp, 4), 'top10_mean_pts': round(t10_mean, 2),
        })

    n_gws = len(per_gw)
    sq_err = [(r['xpts_pred'] - r['actual_pts']) ** 2 for r in rows]
    abs_err = [abs(r['xpts_pred'] - r['actual_pts']) for r in rows]

    by_pos = {}
    for et, name in [(1, 'GKP'), (2, 'DEF'), (3, 'MID'), (4, 'FWD')]:
        pr = [r for r in rows if r['element_type'] == et]
        if not pr:
            continue
        pe = [(r['xpts_pred'] - r['actual_pts']) ** 2 for r in pr]
        by_pos[name] = {
            'n': len(pr),
            'rmse': round(math.sqrt(sum(pe) / len(pe)), 4),
            'n_haulers': sum(1 for r in pr
                             if r['actual_pts'] >= HAUL_THRESHOLD),
        }

    metrics = {
        'n_rows': len(rows),
        'n_gws': n_gws,
        'haul_hit_rate': (total_haul_hits / total_haulers
                          if total_haulers else None),
        'haul_capture_20': (total_haul_hits20 / total_haulers
                            if total_haulers else None),
        'mid_tier_hit_rate': (total_mid_hits / total_mid
                              if total_mid else None),
        'captain_hit_rate': captain_hits / n_gws if n_gws else None,
        'captain_return_rate': captain_returns / n_gws if n_gws else None,
        'top10_mean_pts': (sum(top10_means) / n_gws if n_gws else None),
        'rmse': (round(math.sqrt(sum(sq_err) / len(sq_err)), 4)
                 if rows else None),
        'mae': (round(sum(abs_err) / len(abs_err), 4) if rows else None),
        'spearman': (round(sum(spearmans) / n_gws, 4) if n_gws else None),
        'by_position': by_pos,
        'n_haulers_total': total_haulers,
    }
    return metrics, per_gw


def run_backtest(archive: dict | None = None, params: dict | None = None,
                 mode: str = 'deploy', first_gw: int = 7,
                 last_gw: int = 38) -> dict:
    """Leakage-free backtest over the season archive. See module docstring."""
    from accuracy import build_team_def_form_lookup, build_team_atf_lookup
    from merge import _compute_xpts_fixture

    if archive is None:
        from capture_season import load_season_archive
        archive = load_season_archive()
    p = dict(DEFAULT_PARAMS)
    p.update(params or {})

    fixtures = archive['fixtures']
    fixtures_by_id = {f['id']: f for f in fixtures}
    def_form = build_team_def_form_lookup(fixtures, p['cs_def_form_window_gws'])
    atf_form = build_team_atf_lookup(fixtures, p['atf_window_gws'])
    elements_by_id = {e['id']: e for e in archive['bootstrap']['elements']}

    rows = []
    for pid, summary in archive['summaries'].items():
        el = elements_by_id.get(pid)
        if el is None:
            continue
        et = el['element_type']
        history = summary.get('history', [])
        by_gw = defaultdict(list)
        for e in history:
            by_gw[e.get('round')].append(e)

        for gw in range(first_gw, last_gw + 1):
            entries = by_gw.get(gw)
            if not entries:
                continue  # blank GW or not registered
            sig = build_asof_signals(history, gw, p)
            if sig is None or sig['cum_minutes'] < p['min_prior_minutes']:
                continue

            actual_pts = sum(e.get('total_points', 0) or 0 for e in entries)
            actual_minutes = sum(e.get('minutes', 0) or 0 for e in entries)

            if mode == 'deploy':
                if sig['xmins'] <= 0:
                    continue
            else:
                if actual_minutes < 10:
                    continue

            pred = 0.0
            for e in entries:
                fix = fixtures_by_id.get(e.get('fixture'))
                if fix is None:
                    continue
                was_home = bool(e.get('was_home'))
                team_id = fix['team_h'] if was_home else fix['team_a']
                diff_raw = (fix.get('team_h_difficulty', 3) if was_home
                            else fix.get('team_a_difficulty', 3))
                difficulty = (diff_raw - 1) / 4.0
                ncr = def_form.get((gw, team_id), 0.5)
                nar = atf_form.get((gw, team_id), 0.5)

                if mode == 'deploy':
                    # DGW note: same predicted xmins per fixture — a player
                    # genuinely can play full minutes twice in a DGW; refining
                    # per-fixture minutes is future work.
                    xm, sp_ = sig['xmins'], sig['start_prob']
                else:
                    m = e.get('minutes', 0) or 0
                    if m < 45:
                        # sub cameo / DNP scenario — prior-derived sub value
                        pred += sig['sub_appear_prob'] if m > 0 else 0.0
                        continue
                    xm, sp_ = float(m), 1.0

                result = _compute_xpts_fixture(
                    xg_per90=sig['xg_per90'],
                    xa_per90=sig['xa_per90'],
                    start_prob=sp_,
                    xmins=xm,
                    element_type=et,
                    defensive_difficulty=difficulty,
                    mins_60_prob=sig['mins_60_prob'],
                    sub_appear_prob=sig['sub_appear_prob'],
                    cs_prob_base=p['cs_prob_base'],
                    cs_prob_slope=p['cs_prob_slope'],
                    norm_concede_rate=ncr,
                    cs_team_form_slope=p['cs_team_form_slope'],
                    norm_attack_rate=nar,
                    atf_slope=p['atf_slope'],
                )
                pred += result['total']

            rows.append({
                'player_id': pid,
                'web_name': el.get('web_name', str(pid)),
                'element_type': et,
                'gw': gw,
                'xpts_pred': round(pred, 3),
                'actual_pts': actual_pts,
                'actual_minutes': actual_minutes,
                'xmins_used': round(sig['xmins'], 1),
                'xg_per90': round(sig['xg_per90'], 3),
                'xa_per90': round(sig['xa_per90'], 3),
                'n_fixtures': len(entries),
            })

    metrics, per_gw = compute_metrics(rows)
    return {
        'metrics': metrics,
        'per_gw': per_gw,
        'rows': rows,
        'config': {'mode': mode, 'first_gw': first_gw, 'last_gw': last_gw,
                   'params': p},
    }
```

### Step 4: Run tests to verify they pass

Run: `cd pipeline && python -m pytest tests/test_backtest.py -v`
Expected: 10 PASSED

### Step 5: Run full test suite

Run: `cd pipeline && python -m pytest tests/ -q 2>&1 | tail -5`
Expected: 514 passed (504 + 10 new), 0 failed

### Step 6: Commit

```bash
git add pipeline/backtest.py pipeline/tests/test_backtest.py
git commit -m "feat(bt-02): prediction loop, metrics, run_backtest over season archive"
```

---

## Task 3: CLI + real-data smoke test

**Files:**
- Modify: `pipeline/backtest.py` (append CLI)
- Modify: `pipeline/tests/test_backtest.py` (add 2 tests)

### Step 1: Write the failing tests

Append to `pipeline/tests/test_backtest.py`:

```python
import os


def test_cli_set_parsing():
    args = backtest._parse_args(['--mode', 'conditional', '--first-gw', '10',
                                 '--set', 'atf_slope=0.2',
                                 '--set', 'form_window_gws=4'])
    overrides = backtest._parse_overrides(args.set)
    assert args.mode == 'conditional'
    assert args.first_gw == 10
    assert overrides == {'atf_slope': 0.2, 'form_window_gws': 4}


ARCHIVE_EXISTS = os.path.exists(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'season_2025_26',
                 'manifest.json'))


@pytest.mark.skipif(not ARCHIVE_EXISTS, reason='season archive not present')
def test_real_archive_smoke():
    from capture_season import load_season_archive
    archive = load_season_archive(base_dir=os.path.join(
        os.path.dirname(__file__), '..', 'data', 'season_2025_26'))
    result = backtest.run_backtest(archive=archive, first_gw=35, last_gw=38)
    m = result['metrics']
    assert m['n_gws'] == 4
    assert m['n_rows'] > 800            # >= ~200 eligible players per GW
    assert 0.0 <= m['haul_hit_rate'] <= 1.0
    assert m['rmse'] > 0
```

### Step 2: Run to verify failure

Run: `cd pipeline && python -m pytest tests/test_backtest.py::test_cli_set_parsing -v`
Expected: FAIL (AttributeError: _parse_args)

### Step 3: Append the CLI to `backtest.py`

```python
def _parse_args(argv):
    ap = argparse.ArgumentParser(description='BT-02 leakage-free backtest')
    ap.add_argument('--mode', choices=['deploy', 'conditional'],
                    default='deploy')
    ap.add_argument('--first-gw', type=int, default=7)
    ap.add_argument('--last-gw', type=int, default=38)
    ap.add_argument('--set', action='append', default=[],
                    metavar='KEY=VALUE', help='override a param (repeatable)')
    ap.add_argument('--json', default=None,
                    help='write full result (metrics+per_gw+rows) to file')
    return ap.parse_args(argv)


def _parse_overrides(pairs: list) -> dict:
    out = {}
    for pair in pairs:
        key, _, val = pair.partition('=')
        if not _:
            raise SystemExit(f'bad --set (expected KEY=VALUE): {pair}')
        default = DEFAULT_PARAMS.get(key)
        if isinstance(default, int) and not isinstance(default, bool):
            out[key] = int(val)
        else:
            out[key] = float(val)
    return out


def main(argv=None):
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    overrides = _parse_overrides(args.set)
    result = run_backtest(params=overrides, mode=args.mode,
                          first_gw=args.first_gw, last_gw=args.last_gw)
    m = result['metrics']
    print(f"BT-02 backtest  mode={args.mode}  GW{args.first_gw}-{args.last_gw}"
          f"  rows={m['n_rows']}  haulers={m['n_haulers_total']}")
    if overrides:
        print(f"overrides: {overrides}")
    for k in ['haul_hit_rate', 'haul_capture_20', 'mid_tier_hit_rate',
              'captain_hit_rate', 'captain_return_rate', 'top10_mean_pts',
              'rmse', 'mae', 'spearman']:
        v = m[k]
        print(f"  {k:22s} {v:.4f}" if isinstance(v, float)
              else f"  {k:22s} {v}")
    for pos, d in m['by_position'].items():
        print(f"  {pos}: n={d['n']} rmse={d['rmse']} haulers={d['n_haulers']}")
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump(result, f)
        print(f"written: {args.json}")


if __name__ == '__main__':
    main()
```

### Step 4: Run all backtest tests

Run: `cd pipeline && python -m pytest tests/test_backtest.py -v`
Expected: 12 PASSED (incl. the real-archive smoke test — archive exists)

### Step 5: Run the CLI for real (sanity)

Run: `cd pipeline && python backtest.py --first-gw 35 --last-gw 38`
Expected: metrics table prints; haul_hit_rate in [0,1]; completes in < 60s.

### Step 6: Full suite + commit

Run: `cd pipeline && python -m pytest tests/ -q 2>&1 | tail -5`
Expected: 516 passed, 0 failed

```bash
git add pipeline/backtest.py pipeline/tests/test_backtest.py
git commit -m "feat(bt-02): CLI with param overrides + real-archive smoke test"
```

---

## Self-review notes

- Spec coverage: as-of signals ✓ (Task 1), two modes ✓, DGW summing ✓, strict-prior team form reuse ✓, per-fixture difficulty (documented deviation) ✓, metrics incl. spearman/top10_mean_pts ✓, CLI with --set ✓, no-leakage test ✓, smoke test ✓, live pipeline untouched ✓.
- The spec's "rotation player ≈45" test-table figure is refined to the exact synthetic value (36.0) in Task 1 Step 1 — alternating 90/0 with a 5-entry window gives mean 36 when the last 5 are 0,90,0,90,0.
- Type consistency: `build_asof_signals` returns the dict consumed by `run_backtest`; `compute_metrics(rows)` consumes exactly the row shape `run_backtest` builds; CLI helpers `_parse_args`/`_parse_overrides` match the test names.
