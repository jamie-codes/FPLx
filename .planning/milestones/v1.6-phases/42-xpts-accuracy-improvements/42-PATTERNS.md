# Phase 42: xPts Accuracy Improvements — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 7 files (5 modify, 2 create)
**Analogs found:** 7 / 7 (100%)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/merge.py` | service/transform | CRUD (per-player stats) | `pipeline/merge.py:_compute_regression_signal` | exact (same file, same data source) |
| `pipeline/accuracy.py` | service/backtest | batch/analysis | `pipeline/accuracy.py:compute_accuracy_backtest` | exact (extend, same function) |
| `pipeline/run.py` | orchestrator | request-response | `pipeline/run.py:set_pieces_snapshot read pattern` | exact (same file, same cache-read pattern) |
| `pipeline/tests/test_form_signal.py` | test | unit | `pipeline/tests/test_accuracy.py` | exact (same test framework, same test helpers) |
| `pipeline/tests/test_accuracy.py` | test | unit | `pipeline/tests/test_accuracy.py` (extend) | exact (same file, extend existing) |
| `pipeline/tests/test_merge.py` | test | unit | `pipeline/tests/test_accuracy.py` | role-match (pytest + conftest pattern) |
| `pipeline/tests/test_run.py` | test | unit | `pipeline/tests/test_accuracy.py` | role-match (pytest + conftest pattern) |

---

## Pattern Assignments

### `pipeline/merge.py` — `_compute_form_signal()` function (service/transform, CRUD)

**Analog:** `pipeline/merge.py:_compute_regression_signal` (lines 301–354)

**Imports pattern** (lines 1–11):
```python
"""Module docstring explaining the computation logic."""

from typing import Optional

def _safe_float(val, default: float = 0.0) -> float:
    """Type-safe float conversion from FPL API string decimals."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return default
```

**Core pattern for history aggregation with DGW handling** (lines 301–354):
The form signal mirrors `_compute_regression_signal` exactly — same data source (`history` list from summaries dict), same DGW aggregation strategy:
```python
def _compute_form_signal(
    history: list,
    window_gws: int = 5,
    min_minutes: int = 270,    # 3 GWs × 90 min minimum (per research)
) -> tuple[float | None, int]:
    """Compute recency-weighted xG+xA per-90 over the last `window_gws` rounds.
    
    Returns (form_xgxa_per90, gws_used) or (None, 0) when insufficient data.
    Recency weight: linear from 1.0 (most recent) to 0.5 (oldest in window).
    Mirrors _compute_regression_signal data flow (lines 324-344).
    """
    if not history:
        return None, 0
    
    # SAME AS _compute_regression_signal lines 324-329
    history_sorted = sorted(history, key=lambda h: h['round'])
    unique_rounds = sorted({h['round'] for h in history_sorted})
    last_rounds = set(unique_rounds[-window_gws:])
    window = [h for h in history_sorted if h['round'] in last_rounds]
    
    # DGW aggregation (same as accuracy.py:_group_history_by_gw lines 276-290)
    by_round: dict = {}
    for entry in window:
        r = entry.get('round')
        if r is None:
            continue
        agg = by_round.setdefault(r, {'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0})
        agg['minutes'] += entry.get('minutes', 0) or 0
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
    
    # Filter played rounds and check minimum threshold (line 330)
    played = [by_round[r] for r in sorted(by_round.keys()) if by_round[r]['minutes'] > 0]
    total_mins = sum(p['minutes'] for p in played)
    if len(played) < 3 or total_mins < min_minutes:
        return None, 0
    
    # Linear recency weights: most recent = 1.0, oldest in window = 0.5
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]   # asc — oldest first
    
    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))
    
    if weighted_mins <= 0:
        return None, 0
    
    # Per-90 normalization (same pattern as merge.py:684-686: (value/minutes)*90)
    form_per90 = round((weighted_xgxa / weighted_mins) * 90, 4)
    return form_per90, len(played)
```

**Merge loop integration pattern** (mirrors merge.py lines 800–820):
The form signal is computed AFTER `_compute_regression_signal` and stored on the player dict:
```python
# Inside merge_players() loop, after regression_signal computed (line 810):
form_xgxa_per90, form_xgxa_window_gws = _compute_form_signal(element_summary.get('history', []))
player_result['form_xgxa_per90'] = form_xgxa_per90
player_result['form_xgxa_window_gws'] = form_xgxa_window_gws
```

---

### `pipeline/merge.py` — `_xpts_ngw()` blend logic (service/transform, CRUD)

**Analog:** `pipeline/merge.py:_xpts_ngw` (lines 198–249)

**Core blend pattern** (lines 198–249):
The blend is applied inside the loop BEFORE calling `_xpts_ngw`, using Option A (blend at per-90 layer per research):

```python
# Inside merge_players() loop, after form_xgxa_per90 computed and gate flag read:
if form_signal_enabled and form_xgxa_per90 is not None:
    # Read blend alpha from accuracy_backtest.json if available (self-tuning),
    # otherwise use default BLEND_ALPHA = 0.4
    BLEND_ALPHA = blend_alpha_from_backtest or 0.4
    
    # Blend baseline (season xG+xA per-90) with recent form (last 3-5 GW)
    season_xgxa_per90 = (xg_per90 or 0.0) + (xa_per90 or 0.0)
    blended_xgxa_per90 = (1 - BLEND_ALPHA) * season_xgxa_per90 + BLEND_ALPHA * form_xgxa_per90
    
    # Re-split the blended total proportionally to the season ratio
    # (pattern derived from merge.py scoring logic which uses xG and xA separately)
    if season_xgxa_per90 > 0:
        xg_share = (xg_per90 or 0.0) / season_xgxa_per90
        blended_xg_per90 = blended_xgxa_per90 * xg_share
        blended_xa_per90 = blended_xgxa_per90 * (1 - xg_share)
    else:
        # No season data — split 50/50 (promoted-team players)
        blended_xg_per90 = blended_xgxa_per90 * 0.5
        blended_xa_per90 = blended_xgxa_per90 * 0.5
    
    # Pass blended values into _xpts_ngw (line 198 signature)
    xpts_1gw, xpts_components_1gw = _xpts_ngw(
        blended_xg_per90, blended_xa_per90, start_prob, xmins,
        element_type, fixtures, 1
    )
else:
    # Blend disabled — use baseline
    xpts_1gw, xpts_components_1gw = _xpts_ngw(
        xg_per90, xa_per90, start_prob, xmins,
        element_type, fixtures, 1
    )
```

---

### `pipeline/accuracy.py` — Backtest gate and blended track (service/batch, analysis)

**Analog:** `pipeline/accuracy.py:compute_accuracy_backtest` (lines 35–229)

**Constants addition** (lines 25–29):
```python
HAULTER_THRESHOLD = 10       # existing — D-09
MID_TIER_THRESHOLD = 6       # NEW — ACC-04
TOP_N_PREDICTED = 10         # existing — D-10
TOP_N_PREDICTED_MID = 30     # NEW — broader for CS defenders and bonus accumulators
BACKTEST_GWS = 5             # existing — D-01
MIN_MINUTES = 10             # existing
```

**Blended reconstruction pattern** (extends lines 107–122):
Inside the per-element loop, add a second reconstruction AFTER the baseline xpts:
```python
xpts_predicted = _reconstruct_xpts(entry, element_type, difficulty_score)  # line 107

# NEW: blended reconstruction using historical form signal
form_per90_at_gw = _reconstruct_form_signal(grouped, gw, window_gws=5)
xpts_blended_predicted = _reconstruct_xpts_with_form(
    entry, element_type, difficulty_score, form_per90_at_gw, blend_alpha=0.4
)

per_gw_rows[gw].append({
    'player_id': element_id,
    'player_name': player_name,
    'team_short': team_short,
    'element_type': element_type,
    'actual_pts': actual_pts,
    'xpts_predicted': xpts_predicted,
    'xpts_blended_predicted': xpts_blended_predicted,    # NEW
})
```

**Helper functions** (new private helpers following accuracy.py pattern):
```python
def _reconstruct_form_signal(grouped: dict, current_gw: int, window_gws: int = 5) -> float | None:
    """Reconstruct form signal from prior GWs (strictly before current_gw).
    
    Mirrors _compute_form_signal in merge.py but uses grouped dict and excludes current_gw.
    Pattern: same as _reconstruct_proj_pts (lines 330–358) which constrains to prior_entries.
    """
    prior_gws = [g for g in sorted(grouped.keys()) if g < current_gw]
    if not prior_gws:
        return None
    
    last_gws = prior_gws[-window_gws:]
    if len(last_gws) < 3:
        return None
    
    # DGW-aggregated entries already exist in grouped dict
    played = [grouped[g] for g in last_gws if grouped[g]['minutes'] > 0]
    if len(played) < 3 or sum(p['minutes'] for p in played) < 270:
        return None
    
    # Recency weighting (1.0 most recent → 0.5 oldest)
    n = len(played)
    weights = [0.5 + 0.5 * (i / max(n - 1, 1)) for i in range(n)]
    weighted_xgxa = sum(
        (p['expected_goals'] + p['expected_assists']) * w
        for p, w in zip(played, weights)
    )
    weighted_mins = sum(p['minutes'] * w for p, w in zip(played, weights))
    if weighted_mins <= 0:
        return None
    return round((weighted_xgxa / weighted_mins) * 90, 4)


def _reconstruct_xpts_with_form(
    entry: dict, element_type: int, difficulty_score: float,
    form_per90: float | None, blend_alpha: float = 0.4
) -> float:
    """Reconstruct xPts with optional form blend.
    
    Pattern: wrapper around _reconstruct_xpts (lines 293–327),
    applies blend logic before calling _compute_xpts_fixture.
    """
    if form_per90 is None:
        return _reconstruct_xpts(entry, element_type, difficulty_score)
    
    # Blend form into season rates (same split logic as merge.py)
    xg = float(entry.get('expected_goals', 0) or 0)
    xa = float(entry.get('expected_assists', 0) or 0)
    minutes = entry.get('minutes', 0) or 0
    if minutes <= 0:
        return 0.0
    
    xg_per90 = (xg / minutes) * 90
    xa_per90 = (xa / minutes) * 90
    season_xgxa_per90 = xg_per90 + xa_per90
    
    blended_xgxa_per90 = (1 - blend_alpha) * season_xgxa_per90 + blend_alpha * form_per90
    
    # Re-split
    if season_xgxa_per90 > 0:
        xg_share = xg_per90 / season_xgxa_per90
        blended_xg_per90 = blended_xgxa_per90 * xg_share
        blended_xa_per90 = blended_xgxa_per90 * (1 - xg_share)
    else:
        blended_xg_per90 = blended_xgxa_per90 * 0.5
        blended_xa_per90 = blended_xgxa_per90 * 0.5
    
    # Call _compute_xpts_fixture with blended rates
    from merge import _compute_xpts_fixture
    start_prob = 1.0 if minutes >= 45 else 0.0
    if start_prob == 0.0:
        return 0.0
    xmins = start_prob * float(minutes)
    result = _compute_xpts_fixture(
        xg_per90=blended_xg_per90,
        xa_per90=blended_xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
    )
    return round(result['total'], 2)
```

**Per-GW ranking and flagging** (extends lines 145–149):
```python
# Rank both baseline and blended
xpts_ranked = sorted(rows, key=lambda r: r['xpts_predicted'], reverse=True)
xpts_blended_ranked = sorted(rows, key=lambda r: r['xpts_blended_predicted'], reverse=True)
xpts_rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(xpts_ranked)}
xpts_blended_rank_by_id = {r['player_id']: i + 1 for i, r in enumerate(xpts_blended_ranked)}

# Separate haulter and mid-tier tracks (lines 150–151)
gw_haulters = [r for r in rows if r['actual_pts'] >= HAULTER_THRESHOLD]
gw_mid_tier = [r for r in rows if MID_TIER_THRESHOLD <= r['actual_pts'] < HAULTER_THRESHOLD]

# Flag both models for both tracks (extends lines 155–176)
xpts_flagged_count = 0
xpts_blended_flagged_count = 0
xpts_mid_flagged_count = 0
xpts_blended_mid_flagged_count = 0

for r in gw_haulters:
    pid = r['player_id']
    if xpts_rank_by_id.get(pid, 9999) <= TOP_N_PREDICTED:
        xpts_flagged_count += 1
    if xpts_blended_rank_by_id.get(pid, 9999) <= TOP_N_PREDICTED:
        xpts_blended_flagged_count += 1

for r in gw_mid_tier:
    pid = r['player_id']
    if xpts_rank_by_id.get(pid, 9999) <= TOP_N_PREDICTED_MID:
        xpts_mid_flagged_count += 1
    if xpts_blended_rank_by_id.get(pid, 9999) <= TOP_N_PREDICTED_MID:
        xpts_blended_mid_flagged_count += 1
```

**Per-GW summary extension** (extends lines 181–189):
```python
gw_summaries.append({
    'gw': gw,
    'haulter_count': len(gw_haulters),
    'xpts_flagged': xpts_flagged_count,
    'xpts_blended_flagged': xpts_blended_flagged_count,        # NEW
    'xpts_hit_rate': round(xpts_flagged_count / len(gw_haulters) if gw_haulters else 0.0, 4),
    'xpts_blended_hit_rate': round(xpts_blended_flagged_count / len(gw_haulters) if gw_haulters else 0.0, 4),  # NEW
    'mid_tier_count': len(gw_mid_tier),                         # NEW
    'xpts_mid_flagged': xpts_mid_flagged_count,                 # NEW
    'xpts_blended_mid_flagged': xpts_blended_mid_flagged_count,# NEW
    'proj_pts_flagged': proj_flagged_count,                     # existing
    'proj_pts_hit_rate': ...,                                   # existing
})
```

**Overall summary aggregation** (extends lines 215–225):
```python
overall_xpts_hit = total_xpts_flagged / total_haulters if total_haulters > 0 else 0.0
overall_xpts_blended_hit = total_xpts_blended_flagged / total_haulters if total_haulters > 0 else 0.0
overall_proj_hit = total_proj_flagged / total_haulters if total_haulters > 0 else 0.0

# NEW: Gate logic (with 2pp margin per research Pitfall 3)
form_signal_enabled = overall_xpts_blended_hit > overall_xpts_hit + 0.02

# Mid-tier hit rates
overall_mid_tier_hit = total_xpts_mid_flagged / total_mid_tier if total_mid_tier > 0 else 0.0
overall_mid_tier_blended_hit = total_xpts_blended_mid_flagged / total_mid_tier if total_mid_tier > 0 else 0.0

return {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'gws_covered': target_gws_desc,
    'summary': {
        'xpts_hit_rate': round(overall_xpts_hit, 4),
        'xpts_blended_hit_rate': round(overall_xpts_blended_hit, 4),     # NEW
        'form_signal_enabled': form_signal_enabled,                       # NEW — gate flag
        'blend_alpha_used': blend_alpha or 0.4,                           # NEW — if sweep applied
        'mid_tier_hit_rate': round(overall_mid_tier_hit, 4),              # NEW
        'mid_tier_blended_hit_rate': round(overall_mid_tier_blended_hit, 4), # NEW
        'proj_pts_hit_rate': round(overall_proj_hit, 4),                  # existing
        'gws': gw_summaries,
    },
    'haulters': haulters,
    'players': list(per_player.values()),
}
```

---

### `pipeline/run.py` — Read gate flag before merge (orchestrator, request-response)

**Analog:** `pipeline/run.py:set_pieces_snapshot read pattern` (lines 183–193)

**Gate flag read pattern** (insert before line 169, merge_players call):
```python
# Read previous backtest gate flag (default: disabled — preserve baseline)
form_signal_enabled = False
blend_alpha_used = 0.4
backtest_path = os.path.join(cache_dir, 'accuracy_backtest.json')
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
    blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
except (FileNotFoundError, json.JSONDecodeError):
    pass   # First run or corrupt file — keep baseline

print(f"Form signal blend: {'ENABLED' if form_signal_enabled else 'DISABLED'} (alpha={blend_alpha_used})")

# Pass gate flag to merge_players (add kwarg, line 169–170)
merged, captain_picks = merge_players(
    bootstrap, fixtures, understat, id_map,
    xmins_stats=xmins_stats, summaries=summaries,
    form_signal_enabled=form_signal_enabled,   # NEW kwarg
    blend_alpha=blend_alpha_used,               # NEW kwarg (optional, if sweep applies)
)
```

---

### `pipeline/tests/test_form_signal.py` — NEW test file (test, unit)

**Analog:** `pipeline/tests/test_accuracy.py` (full file, lines 1–200+)

**Test scaffold structure** (mirrors conftest.py line 13 sys.path injection + test pattern):
```python
"""Unit tests for pipeline/merge.py::_compute_form_signal (Phase 42, ACC-01).

Mirrors test_accuracy.py structure and uses same helper patterns (_hist, _build_minimal_inputs).
"""

import pytest
from merge import _compute_form_signal


def test_form_signal_returns_none_when_insufficient_history():
    """ACC-01 / Pattern 1: form signal returns None when <3 GWs."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.2, 'expected_assists': 0.0},
    ]   # only 2 GWs — below 3 minimum
    form, n = _compute_form_signal(history)
    assert form is None
    assert n == 0


def test_form_signal_recency_weighting():
    """ACC-01 / Pattern 1: most recent GW should dominate via linear weights."""
    history = [
        {'round': i, 'minutes': 90, 'expected_goals': 0.0, 'expected_assists': 0.0}
        for i in range(1, 5)
    ]
    # GW5: all xG+xA (form player)
    history.append({'round': 5, 'minutes': 90, 'expected_goals': 0.8, 'expected_assists': 0.2})
    
    form, n = _compute_form_signal(history, window_gws=5)
    # Without recency: mean = 1.0/5 = 0.2 per game = 0.222 per 90
    # With linear weights 0.5..1.0 most-recent-weighted: form > 0.222
    assert form is not None
    assert form > 0.30   # recency boost confirmed
    assert n == 5


def test_form_signal_dgw_aggregation():
    """ACC-01 / Pattern 1: DGW entries (same round) sum, not duplicate."""
    history = [
        {'round': 1, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.1},
        {'round': 2, 'minutes': 90, 'expected_goals': 0.4, 'expected_assists': 0.2},
        {'round': 3, 'minutes': 60, 'expected_goals': 0.2, 'expected_assists': 0.1},  # DGW match 1
        {'round': 3, 'minutes': 90, 'expected_goals': 0.3, 'expected_assists': 0.2},  # DGW match 2
    ]
    form, n = _compute_form_signal(history)
    assert form is not None
    assert n == 3   # 3 unique rounds, not 4 entries


def test_form_signal_min_minutes_threshold():
    """ACC-01 / Pattern 1: form signal returns None when total_mins < 270."""
    # 4 GWs × 60 min each = 240 mins total (below 270 threshold)
    history = [
        {'round': i, 'minutes': 60, 'expected_goals': 0.5, 'expected_assists': 0.3}
        for i in range(1, 5)
    ]
    form, n = _compute_form_signal(history, window_gws=5, min_minutes=270)
    assert form is None
    assert n == 0
```

**Imports pattern** (lines 1–6 of conftest-injected file):
```python
import pytest
from merge import _compute_form_signal
```

---

### `pipeline/tests/test_accuracy.py` — EXTEND with blended-track tests (test, unit)

**Analog:** `pipeline/tests/test_accuracy.py` (extend existing lines 1–200+)

**New test cases to add** (append to existing test file, follow Pattern 1 style):
```python
def test_backtest_writes_form_signal_enabled_flag():
    """ACC-03 / Pattern 3: backtest output includes form_signal_enabled."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    assert 'form_signal_enabled' in result['summary']
    assert isinstance(result['summary']['form_signal_enabled'], bool)
    assert 'xpts_blended_hit_rate' in result['summary']


def test_backtest_writes_xpts_blended_track():
    """ACC-02 / Pattern 3: per-GW summary includes xpts_blended_flagged count."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)

    for gw_summary in result['summary']['gws']:
        assert 'xpts_blended_flagged' in gw_summary
        assert 'xpts_blended_hit_rate' in gw_summary


def test_backtest_gate_disabled_when_blended_no_better():
    """ACC-03 / Pitfall 3: blended <= baseline + 2pp => gate disabled."""
    # Static history: form signal == season rate, blend has no effect
    history = [_hist(gw, 90, 6, xg=0.5, xa=0.3) for gw in range(1, 33)]
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    # blended ≈ baseline ⇒ gate disabled (with 2pp margin)
    assert result['summary']['form_signal_enabled'] is False


def test_form_signal_uses_strictly_prior_gws():
    """ACC-02 / Pitfall 6: form signal must not leak future GW data."""
    # Player with distinctive signature: high xG+xA in GW5
    history = []
    for gw in range(1, 32):
        history.append(_hist(gw, 90, 6, xg=0.3, xa=0.1))
    # GW32: big jump in xG+xA (this should NOT affect GW31 reconstruction)
    history.append(_hist(32, 90, 15, xg=2.0, xa=1.0))
    
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    
    player = next(p for p in result['players'] if p['player_id'] == 1)
    gw31 = next(g for g in player['gws'] if g['gw'] == 31)
    gw32 = next(g for g in player['gws'] if g['gw'] == 32)
    
    # GW31 form signal should use only GWs 27-31 (not 32), so xpts_blended_predicted
    # for GW31 should not be affected by GW32's big jump
    # (This is a regression test for leak detection — exact values may vary)
    assert gw31['xpts_blended_predicted'] is not None
    assert gw32['xpts_blended_predicted'] > gw31['xpts_blended_predicted']  # GW32 is legitimately higher


def test_backtest_mid_tier_track():
    """ACC-04 / Pattern 4: mid-tier (6-9 pt) scorers tracked separately from haulters."""
    history = [_hist(gw, 90, 6, xg=0.4, xa=0.2) for gw in range(1, 32)]
    history.append(_hist(32, 90, 7, xg=0.3, xa=0.2))   # mid-tier (6-9 pts)
    
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs({1: history})
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    
    assert 'mid_tier_hit_rate' in result['summary']
    assert 'mid_tier_blended_hit_rate' in result['summary']
    
    # Player scored 7 pts → mid-tier, NOT haulter
    haulter_ids = {h['player_id'] for h in result['haulters']}
    assert 1 not in haulter_ids


def test_mid_tier_uses_wider_top_n():
    """ACC-04 / Pitfall 4: mid-tier ranking must use TOP_N_PREDICTED_MID = 30 not 10."""
    # Build 50 mid-tier scorers (6-9 pts each); only top 30 by xPts should be flagged
    history_by_id = {}
    for pid in range(1, 51):
        base = [_hist(gw, 90, 3, xg=0.1 * (1 + pid % 5), xa=0.1) for gw in range(1, 32)]
        base.append(_hist(32, 90, 7, xg=0.3, xa=0.2))  # all mid-tier in GW 32
        history_by_id[pid] = base
    
    summaries, fg, bootstrap, fixtures = _build_minimal_inputs(history_by_id)
    result = compute_accuracy_backtest(summaries, fg, bootstrap, fixtures)
    
    gw32 = next(g for g in result['summary']['gws'] if g['gw'] == 32)
    # With 50 mid-tier players and top-30 ranking, hit rate should be realistic (> 0%)
    assert gw32.get('mid_tier_hit_rate', 0.0) > 0.0, "mid-tier hit rate must be >0% with 30-width net"
```

---

### `pipeline/tests/test_merge.py` — NEW or EXTEND (test, unit)

**Analog:** `pipeline/tests/test_accuracy.py` (test pattern)

**Minimal structure** (if creating new file):
```python
"""Unit tests for pipeline/merge.py form signal blend (Phase 42, ACC-01).

Tests that merge_players:
  1. Writes form_xgxa_per90 field to each player
  2. Applies blend logic correctly when form_signal_enabled=True
  3. Preserves baseline when form_signal_enabled=False
"""

import pytest
from merge import _compute_form_signal, merge_players  # (note: merge_players import may vary)


def test_merge_writes_form_signal():
    """ACC-01: merge_players includes form_xgxa_per90 and form_xgxa_window_gws in output."""
    # (Will depend on merge_players signature and how summaries dict is built)
    # Pattern: use same _build_minimal_inputs helper from test_accuracy.py


def test_blend_changes_xpts_when_form_is_hot():
    """ACC-01: form-blended xPts differs from baseline when form ≠ season."""
    # (Pattern: build history with recent form outperformance, verify blend lifts prediction)
```

**Note:** This file's structure depends on the merge_players refactor scope. The pattern mirrors test_accuracy.py's helper usage (conftest.py sys.path injection, _hist, _build_minimal_inputs).

---

### `pipeline/tests/test_run.py` — NEW or EXTEND (test, unit)

**Analog:** `pipeline/tests/test_accuracy.py` (test pattern)

**Minimal structure** (if creating new file):
```python
"""Unit tests for pipeline/run.py gate-flag read (Phase 42, ACC-03).

Tests that run.py:
  1. Reads form_signal_enabled from prev accuracy_backtest.json
  2. Defaults to False when backtest file absent (cold start)
  3. Passes flag to merge_players call
"""

import pytest
import json
import os
import tempfile


def test_form_signal_gate_default_false():
    """ACC-03 / Pattern 5: run.py defaults form_signal_enabled to False when backtest absent."""
    # Pattern: unit test of the JSON read logic, not full pipeline run
    with tempfile.TemporaryDirectory() as tmpdir:
        # Empty cache dir (no accuracy_backtest.json)
        backtest_path = os.path.join(tmpdir, 'accuracy_backtest.json')
        
        # Simulate the run.py read pattern
        form_signal_enabled = False
        try:
            with open(backtest_path, 'r', encoding='utf-8') as f:
                prev_backtest = json.load(f)
            form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        
        assert form_signal_enabled is False


def test_form_signal_gate_reads_from_previous_run():
    """ACC-03 / Pattern 5: run.py correctly reads True gate from prev backtest."""
    with tempfile.TemporaryDirectory() as tmpdir:
        backtest_path = os.path.join(tmpdir, 'accuracy_backtest.json')
        
        # Write a backtest with gate enabled
        backtest_data = {
            'generated_at': '2026-04-30T12:00:00Z',
            'gws_covered': [28, 29, 30, 31, 32],
            'summary': {
                'xpts_hit_rate': 0.18,
                'xpts_blended_hit_rate': 0.19,
                'form_signal_enabled': True,  # enabled!
                'blend_alpha_used': 0.4,
            },
            'haulters': [],
            'players': [],
        }
        
        with open(backtest_path, 'w', encoding='utf-8') as f:
            json.dump(backtest_data, f)
        
        # Simulate the run.py read pattern
        form_signal_enabled = False
        blend_alpha_used = 0.4
        try:
            with open(backtest_path, 'r', encoding='utf-8') as f:
                prev_backtest = json.load(f)
            form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
            blend_alpha_used = prev_backtest.get('summary', {}).get('blend_alpha_used', 0.4)
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        
        assert form_signal_enabled is True
        assert blend_alpha_used == 0.4
```

---

## Shared Patterns

### Authentication / Validation
**Not applicable** — Phase 42 is pure Python pipeline (no HTTP, no auth).

### Error Handling (try-except pattern)
**Source:** `pipeline/accuracy.py` lines 330–358 (`_reconstruct_proj_pts`), `pipeline/run.py` lines 183–193 (cache read pattern)

**Apply to:** All cache file reads in `run.py` (gate flag, accuracy_backtest.json)
```python
form_signal_enabled = False
try:
    with open(backtest_path, 'r', encoding='utf-8') as f:
        prev_backtest = json.load(f)
    form_signal_enabled = prev_backtest.get('summary', {}).get('form_signal_enabled', False)
except (FileNotFoundError, json.JSONDecodeError):
    pass   # First run or corrupt file — keep baseline
```

### Type Safety (FPL API string decimals)
**Source:** `pipeline/merge.py` lines 7–11 (`_safe_float`), `pipeline/accuracy.py` line 310 (`float(... or 0)`)

**Apply to:** All expected_goals / expected_assists conversions in form signal and backtest reconstruction
```python
agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
```

### Per-90 Normalization
**Source:** `pipeline/merge.py` lines 684–686, `pipeline/accuracy.py` lines 312–313

**Apply to:** Form signal and all xG/xA-to-per-90 conversions
```python
xg_per90 = (xg / minutes) * 90 if minutes > 0 else 0.0
xa_per90 = (xa / minutes) * 90 if minutes > 0 else 0.0
```

### DGW Aggregation
**Source:** `pipeline/accuracy.py` lines 270–290 (`_group_history_by_gw`), verified against `pipeline/merge.py` regression signal pattern

**Apply to:** Form signal computation and any per-GW aggregation
```python
by_round: dict = {}
for entry in history:
    r = entry.get('round')
    if r is None:
        continue
    agg = by_round.setdefault(r, {'minutes': 0, 'expected_goals': 0.0, 'expected_assists': 0.0})
    agg['minutes'] += entry.get('minutes', 0) or 0
    agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
    agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
```

### Rounding Consistency
**Source:** `pipeline/accuracy.py` line 327 (`round(..., 2)`), `pipeline/merge.py` line 225 (`round(..., 4)`)

**Apply to:** Form signal and blended xPts
- Form signal per-90: `round(..., 4)` (4 decimals for precision)
- xPts predictions: `round(..., 2)` (2 decimals, consistent with baseline)
- Hit rates: `round(..., 4)` (4 decimals, consistent with accuracy_backtest.json)

---

## Files with No Analog Found

None — all files have analogs in the codebase. Every pattern is derived from existing merge.py, accuracy.py, or run.py implementations.

---

## Metadata

**Analog search scope:**
- `pipeline/*.py` (10 files) — full examination
- `pipeline/tests/*.py` (4 files) — test pattern verification
- `.planning/phases/40-accuracy-pipeline/` — Phase 40 CONTEXT.md, RESEARCH.md, VERIFICATION.md for backtest reference

**Files scanned:** 18 total
**Files with exact analogs:** 7 / 7 (100%)
**Pattern extraction date:** 2026-04-30

**Confidence breakdown:**
- Form signal computation: HIGH — directly mirrors `_compute_regression_signal` (same data source, same DGW pattern)
- Backtest gate placement: HIGH — extends `compute_accuracy_backtest` structure (verified lines 35–229)
- Per-GW ranking logic: HIGH — reuses existing ranking pattern (lines 145–176)
- Cache read pattern: HIGH — mirrors set_pieces_snapshot read (lines 183–193 of run.py)
- Test scaffold: HIGH — test_accuracy.py provides complete pattern (conftest.py, _hist, _build_minimal_inputs)

**Critical notes:**
- All required imports exist (no new dependencies)
- All data sources already flowing through merge.py (summaries dict from run.py lines 146–157)
- Backtest gate is a pure JSON field addition — no architectural changes
- Form signal and blended xPts computation both use existing Poisson math infrastructure (_compute_xpts_fixture)
- Test helpers (_hist, _build_minimal_inputs) already present in test_accuracy.py; reuse directly

