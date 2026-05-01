# Phase 40: Accuracy Pipeline - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pipeline/accuracy.py` | service | batch / transform | `pipeline/defcon.py` | exact |
| `pipeline/tests/__init__.py` | config | — | none (no tests dir exists) | no-analog |
| `pipeline/tests/test_accuracy.py` | test | batch | none (no pytest tests exist) | no-analog |
| `pipeline/run.py` (modified) | orchestrator | batch | `pipeline/run.py` itself (integration) | self |

---

## Pattern Assignments

### `pipeline/accuracy.py` (service, batch/transform)

**Analog:** `pipeline/defcon.py`

This is the primary new file. It follows the identical pattern to `defcon.py`: a module-level docstring, constants at the top, one or two exported top-level functions receiving `(bootstrap, summaries, ...)`, and purely internal helpers prefixed with `_`. No HTTP calls, no imports from within the function bodies except stdlib.

**Module docstring + constants pattern** (`pipeline/defcon.py` lines 1–3):
```python
"""Compute DefCon stats from FPL element-summary per-match history."""

DEFCON_THRESHOLD = {2: 10, 3: 12, 4: 12}  # position_code -> threshold
```

Apply as:
```python
"""Compute prediction accuracy backtest and prediction snapshots for the pipeline."""

HAULTER_THRESHOLD = 10       # actual_pts >= this to count as a haulter (D-09)
TOP_N_PREDICTED = 10         # rank within this to count as "flagged" (D-10)
BACKTEST_GWS = 5             # number of finished GWs to reconstruct (D-01)
MIN_MINUTES = 10             # skip players below this threshold (Claude's Discretion)
```

**Top-level function signature pattern** (`pipeline/defcon.py` lines 6–20):
```python
def compute_defcon_stats(bootstrap: dict, difficulty_scores: dict, summaries: dict) -> list:
    """
    For each DEF/MID/FWD player with starts > 0, look up element-summary from
    the pre-fetched summaries dict and compute hit rate, avg per90, distance to
    threshold, and fixture correlation.

    Args:
        bootstrap: Full FPL bootstrap-static JSON
        difficulty_scores: dict mapping team_id (int) -> difficulty score (0.0-1.0),
                          computed by merge.py from rolling xGA
        summaries: dict mapping player_id (int) -> element-summary response dict.
                   Pre-fetched by run.py shared cache.
    Returns:
        List of dicts matching DefConPlayer interface shape
    """
```

Apply the same signature convention for the two exported functions:
```python
def compute_accuracy_backtest(
    summaries: dict,
    finished_gws: int,
    bootstrap: dict,
    fixtures: list,
) -> dict:
    """
    Compute pre-aggregated accuracy backtest for the last 5 finished GWs.

    Args:
        summaries: dict mapping player_id (int) -> element-summary dict.
                   Pre-fetched by run.py — ZERO HTTP calls made here.
        finished_gws: count of completed gameweeks (from bootstrap events).
        bootstrap: Full FPL bootstrap-static JSON (elements, teams, events).
        fixtures: list of all fixture dicts from fpl_fixtures.json.
    Returns:
        Dict matching accuracy_backtest.json structure (D-08).
    """

def build_predictions_snapshot(merged: list, current_gw: int) -> dict:
    """
    Build predictions_snapshot.json from the current merged player list (D-11, D-12).

    Args:
        merged: list of merged player dicts (has proj_pts_1gw and xPts_1gw fields).
        current_gw: current gameweek number.
    Returns:
        Dict matching snapshot format: {gw, run_at, players: [{id, proj_pts_1gw, xPts_1gw}]}.
    """
```

**History iteration pattern with guard** (`pipeline/defcon.py` lines 24–43):
```python
for element in bootstrap['elements']:
    pos = element['element_type']
    if pos not in (2, 3, 4):
        continue
    if element.get('starts', 0) == 0:
        continue

    summary = summaries.get(element['id'])
    if summary is None:
        continue

    history = [m for m in summary.get('history', []) if m['minutes'] > 0]
    games_played = len(history)
    if games_played < 5:
        continue
```

Apply this guard pattern in `compute_accuracy_backtest()` when iterating all players. Change the `minutes > 0` filter to `minutes >= MIN_MINUTES` per Claude's Discretion:
```python
summary = summaries.get(element['id'])
if summary is None:
    continue
history = [m for m in summary.get('history', []) if m.get('minutes', 0) >= MIN_MINUTES]
```

**Fixture difficulty lookup pattern** (`pipeline/defcon.py` lines 70–78):
```python
def _compute_fixture_correlation(history: list, difficulty_scores: dict, threshold: int) -> dict:
    easy_games = [m for m in history if difficulty_scores.get(m.get('opponent_team'), 0.5) < 0.4]
    hard_games = [m for m in history if difficulty_scores.get(m.get('opponent_team'), 0.5) > 0.6]
```

This shows `opponent_team` (integer team ID) used directly as a lookup key in a difficulty dict. The `accuracy.py` fixture lookup should use `(gw, player_team_id)` — NOT `opponent_team` — because the player's own team_id determines which side of the fixture they played on (see Research Pitfall 1). Build a `fixture_difficulty` lookup at module level in `compute_accuracy_backtest()`:
```python
# Build (event, team_id) -> difficulty_score lookup — used for historical reconstruction
fixture_difficulty: dict[tuple[int, int], float] = {}
for fix in fixtures:
    gw = fix.get('event')
    if gw is None:
        continue
    fixture_difficulty[(gw, fix['team_h'])] = (fix.get('team_h_difficulty', 3) - 1) / 4.0
    fixture_difficulty[(gw, fix['team_a'])] = (fix.get('team_a_difficulty', 3) - 1) / 4.0
```

**xPts formula import pattern** (`pipeline/merge.py` lines 166–225) — import and call site:
```python
from merge import _compute_xpts_fixture, _cs_prob
```

Call signature for historical reconstruction:
```python
result = _compute_xpts_fixture(
    xg_per90=xg_per90,
    xa_per90=xa_per90,
    start_prob=start_prob,       # 1.0 or 0.0 (D-04 binary proxy)
    xmins=float(minutes),        # actual minutes as xmins (start_prob=1.0, so xmins=minutes)
    element_type=element_type,
    defensive_difficulty=difficulty_score,
)
xpts_predicted = result['total']
```

**proj_pts difficulty modifier pattern** (`pipeline/merge.py` line 142):
```python
difficulty_modifier = 1.0 - (fix['difficulty_score'] * 0.5)
```

Apply identically in historical proj_pts reconstruction:
```python
difficulty_modifier = 1.0 - (difficulty_score * 0.5)
proj_pts_predicted = round(ppg * start_prob * difficulty_modifier, 2)
```

**Timestamp pattern** (`pipeline/run.py` lines 205–206):
```python
from datetime import datetime, timezone
timestamp = datetime.now(timezone.utc).isoformat()
```

Use this exact pattern for `generated_at` and `run_at` fields in both output files.

**DGW aggregation** — no existing analog. Use `collections.defaultdict` to group `history[]` by `round`, summing `minutes`, `total_points`, `expected_goals`, `expected_assists`:
```python
from collections import defaultdict

def _group_history_by_gw(history: list) -> dict[int, dict]:
    """Aggregate DGW entries (same round value) into a single entry per GW."""
    by_round: dict = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
        'team': None,
    })
    for entry in history:
        r = entry.get('round')
        if r is None:
            continue
        agg = by_round[r]
        agg['round'] = r
        agg['minutes'] += entry.get('minutes', 0)
        agg['total_points'] += entry.get('total_points', 0)
        agg['expected_goals'] += float(entry.get('expected_goals', 0) or 0)
        agg['expected_assists'] += float(entry.get('expected_assists', 0) or 0)
        if agg['team'] is None:
            agg['team'] = entry.get('team')  # player's own team_id (for fixture lookup)
    return dict(by_round)
```

Note: use `entry.get('team')` (player's own team), NOT `entry.get('opponent_team')`, for the fixture_difficulty lookup key.

---

### `pipeline/run.py` — modification only

**Analog:** `pipeline/run.py` itself — existing integration pattern.

**Import pattern** (`pipeline/run.py` lines 13–19):
```python
from fpl_client import get_bootstrap_static, get_fixtures, get_element_summary
from upload import save
from understat_client import get_understat_players
from merge import merge_players
from defcon import compute_defcon_stats
from xmins import compute_xmins_stats
from insights import compute_insights
```

Add two more imports following the same style:
```python
from accuracy import compute_accuracy_backtest, build_predictions_snapshot
```

**Integration point — after defcon, before last_updated** (`pipeline/run.py` lines 196–204):
```python
# Compute DefCon stats from element-summary history (Phase 4)
print("Computing DefCon stats...")
from merge import _compute_difficulty_scores
difficulty_scores = _compute_difficulty_scores(bootstrap, fixtures)
defcon_stats = compute_defcon_stats(bootstrap, difficulty_scores, summaries)
save('defcon_stats.json', defcon_stats)
print(f"DefCon stats: {len(defcon_stats)} players analysed")

# Write last_updated.json with success metadata
from datetime import datetime, timezone
timestamp = datetime.now(timezone.utc).isoformat()
```

Insert the accuracy block between defcon and last_updated — following the exact same `print / compute / save / print` pattern:
```python
# Phase 40: Compute accuracy backtest and prediction snapshot
print("Computing accuracy backtest...")
backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures)
save('accuracy_backtest.json', backtest_data)
print(f"Accuracy backtest: {len(backtest_data.get('gws_covered', []))} GWs covered, "
      f"{len(backtest_data.get('haulters', []))} haulter entries")

print("Writing predictions snapshot...")
snapshot_data = build_predictions_snapshot(merged, finished_gws)
save('predictions_snapshot.json', snapshot_data)
# Blob accumulation: per-GW named copy (does not overwrite prior GW snapshots)
current_gw_num = snapshot_data['gw']
if os.getenv('USE_BLOB', '').lower() == 'true':
    from upload import upload_json
    upload_json(f'predictions_snapshot_gw{current_gw_num}.json', snapshot_data)
print(f"Predictions snapshot written for GW {current_gw_num}")
```

**`finished_gws` variable** (`pipeline/run.py` line 160):
```python
finished_gws = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))
```

This is already computed. Pass it as-is to both new functions.

---

### `pipeline/tests/__init__.py` (config)

**Analog:** None — no `tests/` directory currently exists.

This file is a zero-byte Python package marker. Create as an empty file so pytest discovers `pipeline/tests/` as a package:
```python
# (empty — marks pipeline/tests as a Python package for pytest discovery)
```

---

### `pipeline/tests/test_accuracy.py` (test, batch)

**Analog:** None — no existing pytest tests in the project.

**Test file structure to follow** (standard pytest conventions, matching Research Validation Architecture):

```python
"""Unit tests for pipeline/accuracy.py (ACC-01)."""

import pytest
from accuracy import compute_accuracy_backtest, build_predictions_snapshot


# ---------------------------------------------------------------------------
# Fixtures: minimal synthetic data
# ---------------------------------------------------------------------------

def _make_history_entry(round_: int, minutes: int, total_points: int,
                        expected_goals: float = 0.0, expected_assists: float = 0.0,
                        team: int = 1) -> dict:
    return {
        'round': round_,
        'minutes': minutes,
        'total_points': total_points,
        'expected_goals': expected_goals,
        'expected_assists': expected_assists,
        'team': team,
    }


@pytest.fixture
def minimal_bootstrap():
    return {
        'elements': [
            {'id': 1, 'web_name': 'Salah', 'element_type': 3, 'team': 14, 'starts': 10},
        ],
        'teams': [{'id': 14, 'short_name': 'LIV'}],
        'events': [{'id': i, 'finished': True} for i in range(1, 33)],
    }


@pytest.fixture
def minimal_fixtures():
    # One fixture per GW for team 14
    result = []
    for gw in range(1, 33):
        result.append({
            'event': gw,
            'team_h': 14,
            'team_a': 1,
            'team_h_difficulty': 3,
            'team_a_difficulty': 3,
            'finished': True,
        })
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_backtest_structure(minimal_bootstrap, minimal_fixtures):
    """ACC-01: output has required top-level keys."""
    ...

def test_haulter_detection(minimal_bootstrap, minimal_fixtures):
    """ACC-01: players with >= 10 actual pts are haulters."""
    ...

def test_hit_rate_computation(minimal_bootstrap, minimal_fixtures):
    """ACC-01: hit_rate = flagged_haulters / total_haulters."""
    ...

def test_xpts_reconstruction(minimal_bootstrap, minimal_fixtures):
    """ACC-01: xPts reconstruction calls formula with historical inputs."""
    ...

def test_proj_pts_reconstruction(minimal_bootstrap, minimal_fixtures):
    """ACC-01: proj_pts reconstruction uses rolling PPG from prior 5 GWs."""
    ...

def test_snapshot_format():
    """ACC-01: build_predictions_snapshot returns D-12 format."""
    merged = [{'id': 1, 'proj_pts_1gw': 6.5, 'xPts_1gw': 7.2}]
    result = build_predictions_snapshot(merged, current_gw=32)
    assert result['gw'] == 32
    assert 'run_at' in result
    assert result['players'][0] == {'id': 1, 'proj_pts_1gw': 6.5, 'xPts_1gw': 7.2}

def test_dgw_aggregation(minimal_bootstrap, minimal_fixtures):
    """ACC-01: DGW history entries (same round) are summed."""
    ...
```

The test file imports `accuracy` using a bare module name (same directory as run.py). The pytest `conftest.py` or `sys.path` setup should match how `run.py` adds its directory to `sys.path` (line 8: `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))`). For the test file, add the same `sys.path` manipulation at the top before the `accuracy` import, or use a `conftest.py`.

---

## Shared Patterns

### File save pattern
**Source:** `pipeline/upload.py` lines 25–30 and `pipeline/run.py` line 130
**Apply to:** All new cache file writes in `run.py`
```python
def save(pathname: str, data):
    """Route save to Blob or local depending on USE_BLOB env var."""
    if os.getenv('USE_BLOB', '').lower() == 'true':
        upload_json(pathname, data)
    else:
        save_local(pathname, data)
```
Call: `save('accuracy_backtest.json', backtest_data)` — never write files directly with `open()`.

### Blob named-upload pattern (for per-GW snapshot accumulation)
**Source:** `pipeline/upload.py` lines 7–12
**Apply to:** Per-GW snapshot Blob write in `run.py` (D-12)
```python
def upload_json(pathname: str, data: list | dict):
    """Upload JSON data to Vercel Blob storage."""
    import vercel_blob
    payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
    vercel_blob.put(pathname, payload, {'allowOverwrite': True, 'contentType': 'application/json'})
```
Call: `upload_json(f'predictions_snapshot_gw{current_gw_num}.json', snapshot_data)`

### Timestamp pattern
**Source:** `pipeline/run.py` lines 205–206
**Apply to:** `generated_at` in `accuracy_backtest.json` and `run_at` in `predictions_snapshot.json`
```python
from datetime import datetime, timezone
timestamp = datetime.now(timezone.utc).isoformat()
```

### history[] field access pattern
**Source:** `pipeline/merge.py` lines 354–382 (verified field names)
**Apply to:** All history iteration in `accuracy.py`
```python
h['round']                          # GW number (int)
h.get('minutes', 0)                 # minutes played
h.get('total_points', 0)            # actual FPL points
h.get('expected_goals', 0)          # xG (may be None — use `or 0`)
h.get('expected_assists', 0)        # xA (may be None — use `or 0`)
h.get('team')                       # player's own team_id (int) — for fixture lookup
```

### summaries dict guard pattern
**Source:** `pipeline/defcon.py` lines 33–36
**Apply to:** Every player loop in `accuracy.py`
```python
summary = summaries.get(element['id'])
if summary is None:
    continue
```

### xPts formula import
**Source:** `pipeline/merge.py` — functions at lines 147 and 166
**Apply to:** `accuracy.py` module-level imports
```python
from merge import _compute_xpts_fixture, _cs_prob
```
These are private helpers (underscore prefix) but are imported cross-module in the existing codebase (e.g., `run.py` line 198 imports `_compute_difficulty_scores` from merge). Cross-module private imports are an established pattern.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `pipeline/tests/__init__.py` | config | — | No `tests/` directory exists; no Python test infrastructure in the project |
| `pipeline/tests/test_accuracy.py` | test | batch | No existing pytest tests anywhere in the project |

For these files, the planner should use the standard pytest conventions from RESEARCH.md (test framework: pytest 8.3.5, run with `python -m pytest pipeline/tests/test_accuracy.py -x`).

---

## Metadata

**Analog search scope:** `pipeline/` directory (all `.py` files)
**Files scanned:** `defcon.py`, `run.py`, `merge.py`, `upload.py`, `xmins.py`, `insights.py`
**Pattern extraction date:** 2026-04-29
