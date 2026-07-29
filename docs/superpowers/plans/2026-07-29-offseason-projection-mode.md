# Off-Season Projection Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the xPts engine produce sane pre-season projections under `IS_OFF_SEASON` by adding an `off_season` mode that drives projections from the COLD-01 prior instead of untrustworthy pre-season bootstrap fields.

**Architecture:** A single `off_season: bool = False` flag (default = no-op) threaded through `merge_players` and `compute_xmins_stats`. When set, per-90 inputs come purely from the COLD-01 prior (blend weight forced to `w=0`) and expected minutes come from the start-rate prior (bypassing the `finished_gws=0` collapse). `run.py` calls a new `_offseason_merge` helper under `IS_OFF_SEASON`, reusing the entire existing scoring engine.

**Tech Stack:** Python 3.11, pytest, pulp (existing). No new dependencies.

## Global Constraints

- `off_season=False` (default) MUST produce byte-identical in-season behaviour — the flag is a pure no-op when off. Every task carries a no-op regression assertion.
- Reuse the existing scoring engine; do NOT create a parallel projection model.
- Off-season runs use the VALIDATED DEFAULT params from `accuracy.*` (the pre-season backtest is stale, so production already falls back to these).
- Foreign-league / non-FPL xG import is OUT OF SCOPE. New arrivals get the price-band bucket prior.
- Validation is face-validity + cross-checks only (no cross-season backtest — no 2024/25 archive).
- Do NOT add `Co-Authored-By` trailers to commits (CLAUDE.md).
- Tests run from `pipeline/` with bare module imports: `cd pipeline && python -m pytest ...`.
- Work on the existing branch `feat/offseason-projection-mode`.

---

### Task 1: `merge.py` — `off_season` forces pure-prior per-90

**Files:**
- Modify: `pipeline/merge.py` (signature ~line 949-978; cold-start block ~line 1297-1316)
- Test: `pipeline/tests/test_offseason_projection.py` (create)

**Interfaces:**
- Produces: `merge_players(..., off_season: bool = False)` — when True, the COLD-01 per-90 blend uses weight `w=0` (pure prior) regardless of `element['minutes']`.

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/test_offseason_projection.py`:

```python
"""Off-season projection mode: merge/xmins off_season flag + run wiring."""
import pytest
from merge import merge_players


def _offseason_bootstrap(elements):
    return {
        'elements': elements,
        'teams': [
            {'id': 14, 'short_name': 'LIV', 'code': 14},
            {'id': 1, 'short_name': 'ARS', 'code': 3},
        ],
        # off-season: NO event has is_current
        'events': [
            {'id': i, 'finished': False, 'is_current': False, 'is_next': (i == 1),
             'deadline_time': '2026-08-21T17:30:00Z'}
            for i in range(1, 39)
        ],
    }


def _fixtures():
    return [
        {'event': gw, 'team_h': 14, 'team_a': 1,
         'team_h_difficulty': 3, 'team_a_difficulty': 3, 'finished': False}
        for gw in range(1, 6)
    ]


def _element(pid, code, now_cost=70, minutes=2953, starts=34, element_type=3):
    return {
        'id': pid, 'code': code, 'web_name': f'P{pid}', 'element_type': element_type,
        'team': 14, 'now_cost': now_cost, 'selected_by_percent': '5.0', 'form': '0',
        'status': 'a', 'minutes': minutes, 'starts': starts, 'total_points': 150,
        'goals_scored': 20, 'assists': 5, 'expected_goals': '18.0', 'expected_assists': '4.0',
        'cost_change_event': 0, 'cost_change_start': 0, 'penalties_text': '',
        'direct_freekicks_text': '', 'corners_and_indirect_freekicks_text': '', 'news': '',
        'defensive_contribution': None, 'clearances_blocks_interceptions': None,
        'direct_freekicks_order': None, 'penalties_order': None,
        'corners_and_indirect_freekicks_order': None, 'chance_of_playing_next_round': None,
    }


def test_offseason_forces_pure_prior_per90():
    """off_season=True must use the modest prior per-90 (w=0), not the high residual."""
    el = _element(1, code=100, minutes=2953, starts=34)  # residual per90 ~0.55
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    prior = {100: {'xg_per90': 0.20, 'xa_per90': 0.05, 'total_minutes': 3000,
                   'start_rate': 0.9, 'mins_per_start': 85}}
    buckets = {(3, 1): {'xg_per90': 0.15, 'xa_per90': 0.05}}
    id_map = {'1': {'understat_id': None}}
    xmins = {1: {'xmins': 80.0, 'start_prob': 0.9, 'mins_risk': 'nailed'}}
    common = dict(xmins_stats=xmins, summaries=None, prior_lookup=prior, bucket_priors=buckets)

    on, _ = merge_players(bs, fx, {}, id_map, off_season=True, **common)
    off, _ = merge_players(bs, fx, {}, id_map, off_season=False, **common)
    p_on = next(p for p in on if p['id'] == 1)
    p_off = next(p for p in off if p['id'] == 1)

    assert p_on['xPts_5gw'] > 0
    assert p_on['xPts_5gw'] < p_off['xPts_5gw']  # pure prior 0.20 < residual ~0.55
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py::test_offseason_forces_pure_prior_per90 -v`
Expected: FAIL with `TypeError: merge_players() got an unexpected keyword argument 'off_season'`

- [ ] **Step 3: Add the `off_season` param to the signature**

In `pipeline/merge.py`, in the `merge_players(...)` signature (after `odds_cs_weight: float = 0.0,` ~line 977), add:

```python
    off_season: bool = False,               # OFFSEASON-01: pure-prior per-90 + prior xMins
```

- [ ] **Step 4: Force `w=0` in the cold-start block**

In `pipeline/merge.py`, replace the block at ~line 1304-1306:

```python
            cur_minutes = element.get('minutes', 0)
            w = max(0.0, min(1.0, cur_minutes / SEED_MINUTES)) if SEED_MINUTES > 0 else 1.0
            if prior is not None and w < 1.0:
```

with:

```python
            cur_minutes = element.get('minutes', 0)
            if off_season:
                w = 0.0   # OFFSEASON-01: ignore residual/zeroed current-season minutes
            else:
                w = max(0.0, min(1.0, cur_minutes / SEED_MINUTES)) if SEED_MINUTES > 0 else 1.0
            if prior is not None and w < 1.0:
```

Then add a no-prior guard so off-season players with no prior don't leak residual per-90. It MUST sit at 12-space indent — INSIDE the `if prior_lookup is not None or bucket_priors is not None:` block (so `prior` is in scope), as the last statement in that block, immediately after `xa_per90 = round(blended_total * (1 - share), 4)` (~line 1316) and before the blank line at 1317. The result reads:

```python
            if prior is not None and w < 1.0:
                prior_xg90 = prior.get('xg_per90', 0.0)
                prior_xa90 = prior.get('xa_per90', 0.0)
                cur_total = (xg_per90 or 0.0) + (xa_per90 or 0.0)
                prior_total = prior_xg90 + prior_xa90
                blended_total = (1 - w) * prior_total + w * cur_total
                prior_share = prior_xg90 / prior_total if prior_total > 0 else 0.5
                cur_share = (xg_per90 or 0.0) / cur_total if cur_total > 0 else prior_share
                share = (1 - w) * prior_share + w * cur_share
                xg_per90 = round(blended_total * share, 4)
                xa_per90 = round(blended_total * (1 - share), 4)
            if off_season and prior is None:
                xg_per90 = 0.0   # OFFSEASON-01: no prior -> no trustworthy per-90 signal
                xa_per90 = 0.0
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py::test_offseason_forces_pure_prior_per90 -v`
Expected: PASS

- [ ] **Step 6: Add + run the no-op regression test**

Append to `pipeline/tests/test_offseason_projection.py`:

```python
def test_offseason_flag_off_is_noop():
    """Default off_season=False must match not passing the flag at all."""
    el = _element(1, code=100, minutes=2953, starts=34)
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    prior = {100: {'xg_per90': 0.20, 'xa_per90': 0.05, 'total_minutes': 3000,
                   'start_rate': 0.9, 'mins_per_start': 85}}
    buckets = {(3, 1): {'xg_per90': 0.15, 'xa_per90': 0.05}}
    id_map = {'1': {'understat_id': None}}
    xmins = {1: {'xmins': 80.0, 'start_prob': 0.9, 'mins_risk': 'nailed'}}
    common = dict(xmins_stats=xmins, summaries=None, prior_lookup=prior, bucket_priors=buckets)

    a, _ = merge_players(bs, fx, {}, id_map, **common)
    b, _ = merge_players(bs, fx, {}, id_map, off_season=False, **common)
    pa = next(p for p in a if p['id'] == 1)
    pb = next(p for p in b if p['id'] == 1)
    assert pa['xPts_5gw'] == pb['xPts_5gw']
```

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py -v`
Expected: PASS (both tests)

- [ ] **Step 7: Commit**

```bash
git add pipeline/merge.py pipeline/tests/test_offseason_projection.py
git commit -m "feat(offseason): merge off_season flag forces pure-prior per-90"
```

---

### Task 2: `xmins.py` — `off_season` seeds minutes from prior, bypassing the finished_gws=0 collapse

**Files:**
- Modify: `pipeline/xmins.py` (`compute_xmins_stats` sig ~line 106-115 + call ~149; `_compute_player_xmins` sig ~line 159-167 + body ~169-228)
- Test: `pipeline/tests/test_offseason_projection.py` (append)

**Interfaces:**
- Consumes: `POSITION_PRIOR` (module const in xmins.py), `season_prior.price_band` (existing).
- Produces: `compute_xmins_stats(..., off_season: bool = False)` and `_compute_player_xmins(..., off_season: bool = False)`. When True, `start_prob`/`avg_mins_started` come from `prior_start` or a price-band default; `xmins = round(avg_mins_started * start_prob, 1)` is non-zero for established players despite `finished_gws=0`.

- [ ] **Step 1: Write the failing tests**

Append to `pipeline/tests/test_offseason_projection.py`:

```python
from xmins import _compute_player_xmins


def test_offseason_established_not_zeroed():
    """Residual starts>=3 + finished_gws=0 must NOT zero xmins in off_season mode."""
    el = _element(1, code=100, minutes=2953, starts=34)
    prior_start = {'start_rate': 0.9, 'mins_per_start': 85}
    r = _compute_player_xmins(el, None, finished_gws=0, prior_start=prior_start, off_season=True)
    assert r['start_prob'] > 0.5
    assert r['xmins'] > 50
    # Document the in-season bug this fixes: same inputs, off_season=False -> collapses to 0
    r_bug = _compute_player_xmins(el, None, finished_gws=0, prior_start=prior_start, off_season=False)
    assert r_bug['xmins'] == 0.0


def test_offseason_no_prior_uses_price_band():
    """No prior: premium price band gets higher start_prob/xmins than budget."""
    prem = _element(2, code=0, now_cost=95, minutes=0, starts=0)
    budg = _element(3, code=0, now_cost=45, minutes=0, starts=0)
    rp = _compute_player_xmins(prem, None, 0, prior_start=None, off_season=True)
    rb = _compute_player_xmins(budg, None, 0, prior_start=None, off_season=True)
    assert rp['start_prob'] > rb['start_prob']
    assert rp['xmins'] > rb['xmins']
```

- [ ] **Step 2: Run to verify failure**

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py::test_offseason_established_not_zeroed -v`
Expected: FAIL with `TypeError: _compute_player_xmins() got an unexpected keyword argument 'off_season'`

- [ ] **Step 3: Add the price-band estimate helper**

In `pipeline/xmins.py`, near the top-level constants (after `POSITION_PRIOR` is defined), add:

```python
# OFFSEASON-01: price-band start/minutes defaults for players with no COLD-01 prior.
_OFFSEASON_BAND_START = {2: 0.90, 1: 0.62, 0: 0.30}   # premium / mid / budget
_OFFSEASON_BAND_MINS = {2: 85.0, 1: 78.0, 0: 68.0}


def _offseason_start_estimate(element: dict, prior_start: dict | None, availability: float):
    """Return (start_prob, avg_mins_started) for off-season from prior or price band."""
    from season_prior import price_band
    et = element.get('element_type', 3)
    if prior_start is not None:
        band = price_band(element.get('now_cost', 0))
        sr = prior_start.get('start_rate', POSITION_PRIOR.get(et, 0.65))
        mps = prior_start.get('mins_per_start', 0.0) or _OFFSEASON_BAND_MINS[band]
        return round(sr * availability, 4), mps
    band = price_band(element.get('now_cost', 0))
    return round(_OFFSEASON_BAND_START[band] * availability, 4), _OFFSEASON_BAND_MINS[band]
```

- [ ] **Step 4: Thread `off_season` through both functions**

In `compute_xmins_stats` signature (~line 113-114), add after `start_seed`:

```python
    off_season: bool = False,          # OFFSEASON-01: prior-driven minutes, ignore in-season evidence
```

In the `_compute_player_xmins(...)` call inside `compute_xmins_stats` (~line 149-154), add `off_season=off_season,`:

```python
        results[player_id] = _compute_player_xmins(
            element, summaries.get(player_id), finished_gws, next_fixture_difficulty,
            sub_appear_window_gws=sub_appear_window_gws,
            prior_start=prior_start,
            injury_lookup=injury_lookup,
            off_season=off_season,                          # OFFSEASON-01
        )
```

In `_compute_player_xmins` signature (~line 165-166), add after `prior_start`:

```python
    off_season: bool = False,                     # OFFSEASON-01
```

- [ ] **Step 5: Add the off-season branch in `_compute_player_xmins`**

In `pipeline/xmins.py`, the body currently begins (~line 169-175):

```python
    starts = element.get('starts', 0)
    minutes = element.get('minutes', 0)
    chance = element.get('chance_of_playing_next_round')
    availability = (chance / 100.0) if chance is not None else 1.0

    # Per-match data from element-summary (preferred when available)
    if summary and starts > 0:
```

Insert an off-season branch so the residual/`finished_gws` paths are skipped. Replace the `if summary and starts > 0:` line with:

```python
    if off_season:
        # OFFSEASON-01: drive minutes from the COLD-01 prior (or price band), not
        # residual last-season starts / finished_gws (which collapses to 0 pre-season).
        start_prob, avg_mins_started = _offseason_start_estimate(element, prior_start, availability)
        mins_60_prob = 0.0
    elif summary and starts > 0:
```

(The existing `else:` bootstrap-fallback branch remains unchanged and now handles only the non-off-season path.)

- [ ] **Step 6: Run tests to verify pass**

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py -v`
Expected: PASS (all tests)

- [ ] **Step 7: Guard existing xmins tests still pass (no-op check)**

Run: `cd pipeline && python -m pytest tests/test_xmins.py -v`
Expected: PASS (unchanged — off_season defaults False)

- [ ] **Step 8: Commit**

```bash
git add pipeline/xmins.py pipeline/tests/test_offseason_projection.py
git commit -m "feat(offseason): xmins off_season seeds minutes from prior, no finished_gws collapse"
```

---

### Task 3: `run.py` — `_offseason_merge` helper + off-season branch + kill switch

**Files:**
- Modify: `pipeline/run.py` (add helper near `_build_cold_start_prior` ~line 208; replace off-season `else` skip block ~line 947-960)
- Test: `pipeline/tests/test_offseason_projection.py` (append)

**Interfaces:**
- Consumes: `compute_xmins_stats(off_season=True)`, `merge_players(off_season=True)` (Tasks 1-2), `accuracy.*` default constants, `_build_cold_start_prior()` (existing, returns `(prior_lookup, bucket_priors, start_seed)`).
- Produces: `_offseason_merge(bootstrap, fixtures, id_map, prior_lookup, bucket_priors, start_seed) -> (merged, captain_picks)`.

- [ ] **Step 1: Write the failing test**

Append to `pipeline/tests/test_offseason_projection.py`:

```python
def test_offseason_merge_produces_nonzero_xpts():
    from run import _offseason_merge
    el = _element(1, code=100, minutes=2953, starts=34)  # now_cost 70 -> band 1
    bs, fx = _offseason_bootstrap([el]), _fixtures()
    prior = {100: {'xg_per90': 0.5, 'xa_per90': 0.1, 'total_minutes': 3000,
                   'start_rate': 0.9, 'mins_per_start': 85}}
    buckets = {(3, 1): {'xg_per90': 0.15, 'xa_per90': 0.05}}
    start_seed = {100: {'start_rate': 0.9, 'mins_per_start': 85}}
    id_map = {'1': {'understat_id': None}}

    merged, caps = _offseason_merge(bs, fx, id_map, prior, buckets, start_seed)
    p = next(p for p in merged if p['id'] == 1)
    assert p['xPts_5gw'] > 0
```

- [ ] **Step 2: Run to verify failure**

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py::test_offseason_merge_produces_nonzero_xpts -v`
Expected: FAIL with `ImportError: cannot import name '_offseason_merge' from 'run'`

- [ ] **Step 3: Add the `_offseason_merge` helper**

In `pipeline/run.py`, immediately after the `_build_cold_start_prior()` function (after its `return` ~line 233), add:

```python
def _offseason_merge(bootstrap, fixtures, id_map, prior_lookup, bucket_priors, start_seed):
    """OFFSEASON-01: run xmins + merge in off_season mode with validated default params.

    Returns (merged_players, captain_picks). Pre-season backtest is stale, so we use
    the accuracy.* defaults exactly as run.py's stale-summary fallback does.
    """
    import accuracy
    events = bootstrap.get('events', [])
    next_gw_id = next((e['id'] for e in events if e.get('is_next')), None)
    xmins_stats = compute_xmins_stats(
        bootstrap, {}, 0, fixtures=fixtures, next_gw_id=next_gw_id,
        sub_appear_window_gws=accuracy.SUB_APPEAR_WINDOW_GWS,
        start_seed=start_seed, injury_lookup=None, off_season=True,
    )
    merged, captain_picks = merge_players(
        bootstrap, fixtures, {}, id_map,
        xmins_stats=xmins_stats, summaries=None,
        form_signal_enabled=False, blend_alpha=accuracy.BLEND_ALPHA,
        cs_prob_base=0.40, cs_prob_slope=0.30,
        form_window_gws=accuracy.FORM_WINDOW_GWS,
        form_actual_beta=accuracy.FORM_ACTUAL_BETA,
        form_difficulty_gamma=accuracy.FORM_DIFFICULTY_GAMMA,
        sub_appear_window_gws=accuracy.SUB_APPEAR_WINDOW_GWS,
        cs_team_form_slope=accuracy.CS_TEAM_FORM_SLOPE,
        cs_def_form_window_gws=accuracy.CS_DEF_FORM_WINDOW_GWS,
        atf_slope=accuracy.ATF_SLOPE, atf_window_gws=accuracy.ATF_WINDOW_GWS,
        fas_slope=accuracy.FAS_SLOPE, defcon_scale=accuracy.DEFCON_SCALE,
        prior_lookup=prior_lookup, bucket_priors=bucket_priors,
        odds_lookup=None, odds_cs_weight=0.0, off_season=True,
    )
    return merged, captain_picks
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd pipeline && python -m pytest tests/test_offseason_projection.py::test_offseason_merge_produces_nonzero_xpts -v`
Expected: PASS

- [ ] **Step 5: Wire the off-season branch into `run()`**

In `pipeline/run.py`, the off-season skip block is the `else`/bottom branch at ~line 947-960 that prints `skipping xmins`/`skipping merge` etc. Replace the three lines:

```python
            print("[pipeline] IS_OFF_SEASON: skipping xmins")
            print("[pipeline] IS_OFF_SEASON: skipping bonus")
            print("[pipeline] IS_OFF_SEASON: skipping merge")
```

with:

```python
            _off_enabled = os.getenv('OFFSEASON_PROJECTION_ENABLED', 'true').lower() in ('1', 'true', 'yes')
            _pl, _bp, _ss = _build_cold_start_prior()
            if _off_enabled and _pl:
                print("[pipeline] IS_OFF_SEASON: cold-start projection ENABLED")
                merged, captain_picks = _offseason_merge(bootstrap, fixtures, id_map, _pl, _bp, _ss)
                save('merged_players.json', merged)
                timestamps['merged_players.json'] = _dt_dh.now(_tz_dh.utc).isoformat()
                save('captain_picks.json', captain_picks)
                print(f"[pipeline] off-season projection: {len(merged)} players merged")
            else:
                print("[pipeline] IS_OFF_SEASON: skipping merge (cold-start disabled or no archive)")
```

(Leave the remaining `skipping mc_simulations` … `skipping dgw_bgw` prints unchanged — those steps stay off.)

- [ ] **Step 6: Verify the full off-season pipeline writes a real projection**

Run: `cd pipeline && USE_BLOB=false python run.py 2>&1 | grep -E "cold-start|merged"`
Expected: prints `cold-start projection ENABLED` and `off-season projection: <N> players merged` (N ~500+), NOT `0 merged`.

- [ ] **Step 7: Commit**

```bash
git add pipeline/run.py pipeline/tests/test_offseason_projection.py
git commit -m "feat(offseason): run.py off-season branch runs cold-start merge behind kill switch"
```

---

### Task 4: Face-validity gate — `offseason_validate.py`

**Files:**
- Create: `pipeline/offseason_validate.py`

**Interfaces:**
- Consumes: `_offseason_merge` (Task 3), `capture_season.load_season_archive`, `season_prior.build_prior_lookup`/`build_bucket_priors`, `fpl_client.get_bootstrap_static`/`get_fixtures`.
- Produces: a manual acceptance script; exits 0 on PASS, 1 on FAIL.

- [ ] **Step 1: Write the validation script**

Create `pipeline/offseason_validate.py`:

```python
"""OFFSEASON-01 face-validity gate. Run from pipeline/:  python offseason_validate.py

Builds COLD-01 priors from the committed archive, fetches live bootstrap+fixtures,
runs the off-season projection, and asserts face-validity checks. Exit 0=PASS, 1=FAIL.
"""
import json
import os
import sys
from capture_season import load_season_archive
from season_prior import build_prior_lookup, build_bucket_priors
from fpl_client import get_bootstrap_static, get_fixtures
from run import _offseason_merge


def _spearman(xs, ys):
    """Rank-correlation without scipy."""
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0] * len(v)
        for pos, i in enumerate(order):
            r[i] = pos
        return r
    rx, ry = rank(xs), rank(ys)
    n = len(xs)
    if n == 0:
        return 0.0
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    den = (sum((rx[i] - mx) ** 2 for i in range(n)) * sum((ry[i] - my) ** 2 for i in range(n))) ** 0.5
    return num / den if den else 0.0


def main():
    archive = load_season_archive()
    prior_lookup = build_prior_lookup(archive)
    bucket_priors = build_bucket_priors(archive)
    start_seed = {c: {'start_rate': p['start_rate'], 'mins_per_start': p['mins_per_start']}
                  for c, p in prior_lookup.items()}
    bs = get_bootstrap_static()
    fx = get_fixtures()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'player_id_map.json'),
              encoding='utf-8') as f:
        id_map = json.load(f)

    merged, _ = _offseason_merge(bs, fx, id_map, prior_lookup, bucket_priors, start_seed)
    by_id = {e['id']: e for e in bs['elements']}
    ranked = sorted(merged, key=lambda p: -float(p.get('xPts_5gw') or 0))
    top20 = ranked[:20]
    fails = []

    # A. Haaland (clear #1) must land in the top 5
    top5_names = {p['web_name'] for p in ranked[:5]}
    if 'Haaland' not in top5_names:
        fails.append(f"Haaland not in top5: {sorted(top5_names)}")

    # B. no <500-min (last season) cameo in the top 20
    for p in top20:
        mins = by_id.get(p['id'], {}).get('minutes', 0)
        if mins < 500:
            fails.append(f"cameo in top20: {p['web_name']} ({mins} min, x5={p.get('xPts_5gw')})")

    # C. at least 6 of the top 20 are mid-premium (now_cost >= 75)
    n_premium = sum(1 for p in top20 if by_id.get(p['id'], {}).get('now_cost', 0) >= 75)
    if n_premium < 6:
        fails.append(f"only {n_premium}/20 top players priced >= 7.5")

    # D. positive rank-correlation vs FPL ep_next and last-season points
    xs, en, lp = [], [], []
    for p in merged:
        e = by_id.get(p['id'])
        if not e:
            continue
        xs.append(float(p.get('xPts_5gw') or 0))
        en.append(float(e.get('ep_next') or 0))
        lp.append(float(e.get('total_points') or 0))
    corr_ep, corr_lp = _spearman(xs, en), _spearman(xs, lp)
    if corr_ep < 0.3:
        fails.append(f"low corr vs ep_next: {corr_ep:.2f}")
    if corr_lp < 0.3:
        fails.append(f"low corr vs last-season pts: {corr_lp:.2f}")

    print(f"corr(xPts5, ep_next)={corr_ep:.2f}  corr(xPts5, last_pts)={corr_lp:.2f}")
    print("TOP 10:", [(p['web_name'], round(float(p.get('xPts_5gw') or 0), 1)) for p in ranked[:10]])
    if fails:
        print("FACE-VALIDITY FAIL:")
        for msg in fails:
            print("  -", msg)
        sys.exit(1)
    print("FACE-VALIDITY PASS")
    sys.exit(0)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run the acceptance gate**

Run: `cd pipeline && python offseason_validate.py`
Expected: prints correlations + TOP 10 dominated by real elites (Haaland in top 5, no cameos), ends with `FACE-VALIDITY PASS`.

If it FAILs, the message identifies which check broke (cameo leak → revisit Task 1 Step 4 no-prior guard or Task 2 band defaults; elite low → revisit Task 2 prior seeding). Fix and re-run before committing.

- [ ] **Step 3: Commit**

```bash
git add pipeline/offseason_validate.py
git commit -m "feat(offseason): face-validity acceptance gate script"
```

---

## Notes for the implementer

- `_element` in the test helper sets residual last-season stats (`minutes=2953, starts=34`) deliberately — that's the exact state (State A) that triggers the bugs; the tests would silently pass on zeroed inputs.
- `fixtures` and `id_map` are already in scope in `run()` at the off-season branch (used by the in-season path above it); no new fetch is needed.
- Do NOT re-enable MC sims / insights / gw_intel / defcon-as-separate-step in off-season — they need a live gameweek and are intentionally skipped.
