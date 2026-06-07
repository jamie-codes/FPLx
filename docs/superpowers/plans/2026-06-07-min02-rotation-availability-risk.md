# MIN-02: Rotation Risk & Availability Classification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve xmins accuracy by applying fixture-aware rotation risk and FPL-status-based availability classification, surfacing both signals as visible chips in GemTable, OpportunityCostTable, and WildcardBuilderTab.

**Architecture:** Two new pipeline signals (`rotation_risk`, `availability_risk`) are computed in `pipeline/xmins.py` + new `pipeline/news_classifier.py`, written to `players.json`, then consumed by a new shared `RiskChip` React component rendered inside the existing `MinsRiskBadge` and inline in two optimiser surfaces.

**Tech Stack:** Python (pipeline), TypeScript/React, Vitest, Tailwind CSS.

---

## Codebase orientation (read before starting)

| File | Key facts |
|---|---|
| `pipeline/xmins.py` | `compute_xmins_stats(bootstrap, summaries, finished_gws)` → dict of per-player stats. `_compute_player_xmins(element, summary, finished_gws)` does the work per player. |
| `pipeline/merge.py:1108-1125` | Two blocks read `xmins_stats[fpl_id]`: first reads `xm['xmins']` for `player_xmins`; second writes `mins_risk`, `start_prob`, etc. to the player dict. |
| `pipeline/run.py:180,329` | `fixtures = get_fixtures()` at line 180; `xmins_stats = compute_xmins_stats(...)` at line 329. Fixtures are in scope at the call site. |
| `src/components/shared/MinsRiskBadge.tsx` | Currently returns a `<span>` for the existing `mins_risk`/`sub_risk_label`. Will be extended to also render `RiskChip`. |
| `src/components/transfers/OpportunityCostTable.tsx` | Already imports `MinsRiskBadge`. Extend the existing call sites to pass new props. |
| `src/lib/types.ts` | `MergedPlayer` is the type to extend with `rotation_risk?` and `availability_risk?`. |

**Important:** `pipeline/gw_intel.py` already has `_apply_rotation_risk()` (called in run.py line 395). That function handles European cup rotation — it is separate from the new fixture-difficulty rotation risk added in this plan. Verify after Task 4 that no field names collide.

---

## File map

| Action | File | What changes |
|---|---|---|
| Create | `pipeline/news_classifier.py` | `classify_availability()` pure function |
| Create | `pipeline/news_classifier.test.py` | 11 unit tests |
| Create | `pipeline/xmins.test.py` | 10 tests for new rotation risk functions |
| Modify | `pipeline/xmins.py` | Add `build_next_gw_team_fdr()`, `compute_rotation_risk()`, wire both signals into `_compute_player_xmins()`, extend `compute_xmins_stats()` signature |
| Modify | `pipeline/run.py` | Pass `fixtures` and `next_gw_id` to `compute_xmins_stats` |
| Modify | `pipeline/merge.py` | Use `xmins_adjusted` instead of `xmins`; write `rotation_risk` and `availability_risk` to player dicts |
| Modify | `src/lib/types.ts` | Add `rotation_risk?` and `availability_risk?` to `MergedPlayer` |
| Create | `src/components/shared/RiskChip.tsx` | New shared chip component |
| Create | `src/components/shared/RiskChip.test.tsx` | 7 unit tests |
| Modify | `src/components/shared/MinsRiskBadge.tsx` | Accept + render `RiskChip` |
| Modify | `src/components/shared/MinsRiskBadge.test.tsx` | 4 new tests |
| Modify | `src/components/transfers/OpportunityCostTable.tsx` | Pass new props to existing `MinsRiskBadge` call |
| Modify | `src/components/planner/WildcardBuilderTab.tsx` | Add `RiskChip` to squad player rows |

---

## Task 1: Create `pipeline/news_classifier.py` and tests

**Files:**
- Create: `pipeline/news_classifier.py`
- Create: `pipeline/news_classifier.test.py`

- [ ] **Step 1: Create the test file first**

Create `pipeline/news_classifier.test.py`:

```python
"""Tests for pipeline/news_classifier.py (MIN-02 — availability classifier)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from news_classifier import classify_availability


def test_status_i_returns_out():
    result = classify_availability(status='i', chance=None, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_status_u_returns_out():
    result = classify_availability(status='u', chance=None, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_status_s_returns_out():
    result = classify_availability(status='s', chance=None, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_100_returns_fit():
    result = classify_availability(status='a', chance=100, news_text='')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_chance_75_returns_fit():
    result = classify_availability(status='a', chance=75, news_text='')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_chance_50_returns_doubt():
    result = classify_availability(status='a', chance=50, news_text='')
    assert result['availability_risk'] == 'doubt'
    assert result['availability_factor'] == 0.5


def test_chance_0_returns_out():
    result = classify_availability(status='a', chance=0, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_null_news_ruled_out():
    result = classify_availability(status='a', chance=None, news_text='Player ruled out for six weeks.')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_null_news_doubt():
    result = classify_availability(status='a', chance=None, news_text='Manager says player is a doubt for the weekend.')
    assert result['availability_risk'] == 'doubt'
    assert result['availability_factor'] == 0.5


def test_chance_null_news_fit():
    result = classify_availability(status='a', chance=None, news_text='Fully fit and available for selection.')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_chance_null_no_news_returns_unknown():
    result = classify_availability(status='a', chance=None, news_text='')
    assert result['availability_risk'] == 'unknown'
    assert result['availability_factor'] == 1.0


def test_chance_overrides_contradicting_keyword():
    # chance=100 (fit) but news says "doubt" — chance wins
    result = classify_availability(status='a', chance=100, news_text='Player is a doubt for the next match.')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest news_classifier.test.py -v
```

Expected: `ModuleNotFoundError: No module named 'news_classifier'`

- [ ] **Step 3: Create `pipeline/news_classifier.py`**

```python
"""
MIN-02: Availability classifier for FPL players.

Priority order:
  1. FPL status codes ('i', 'u', 's') → out immediately.
  2. FPL chance_of_playing_next_round (numeric) → fit / doubt / out.
  3. Keyword scan of FPL news text (fallback when chance is null).

Pure functions, no side effects, no API calls.
"""

_OUT_KEYWORDS = ['ruled out', 'unavailable', 'will miss', 'withdrawn']
_DOUBT_KEYWORDS = ['doubt', '50/50', 'fitness test', 'assessed', 'knock', 'slight concern']
_FIT_KEYWORDS = ['fit', 'available', 'returned to training', 'fully fit']


def classify_availability(
    status: str,
    chance: int | None,
    news_text: str = '',
) -> dict:
    """Classify a player's availability risk.

    Args:
        status:    FPL status code ('a', 'd', 'i', 's', 'u', 'n').
        chance:    FPL chance_of_playing_next_round (0–100) or None.
        news_text: FPL news text from bootstrap element['news'].

    Returns dict with keys:
        availability_risk:   'out' | 'doubt' | 'fit' | 'unknown'
        availability_factor: float  (0.0, 0.5, or 1.0)
    """
    # Priority 1: status codes that definitively mean unavailable.
    if status in ('i', 'u', 's'):
        return {'availability_risk': 'out', 'availability_factor': 0.0}

    # Priority 2: FPL chance_of_playing (most authoritative signal).
    if chance is not None:
        if chance == 0:
            return {'availability_risk': 'out', 'availability_factor': 0.0}
        if chance >= 75:
            return {'availability_risk': 'fit', 'availability_factor': 1.0}
        if chance >= 25:
            return {'availability_risk': 'doubt', 'availability_factor': 0.5}
        # chance > 0 but < 25 — very unlikely to play
        return {'availability_risk': 'out', 'availability_factor': 0.0}

    # Priority 3: keyword scan of news text (first match wins).
    lower = (news_text or '').lower()
    for kw in _OUT_KEYWORDS:
        if kw in lower:
            return {'availability_risk': 'out', 'availability_factor': 0.0}
    for kw in _DOUBT_KEYWORDS:
        if kw in lower:
            return {'availability_risk': 'doubt', 'availability_factor': 0.5}
    for kw in _FIT_KEYWORDS:
        if kw in lower:
            return {'availability_risk': 'fit', 'availability_factor': 1.0}

    return {'availability_risk': 'unknown', 'availability_factor': 1.0}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd pipeline && python -m pytest news_classifier.test.py -v
```

Expected: `12 passed`

- [ ] **Step 5: Commit**

```
git add pipeline/news_classifier.py pipeline/news_classifier.test.py
git commit -m "feat(min-02): news_classifier — availability classifier with FPL status + keyword fallback"
```

---

## Task 2: Add rotation risk functions to `pipeline/xmins.py` and create `pipeline/xmins.test.py`

**Files:**
- Modify: `pipeline/xmins.py`
- Create: `pipeline/xmins.test.py`

**Note:** The design spec called for 6 buckets (difficulty × home/away). This plan uses 3 difficulty buckets only — home/away splits would average only ~3 games per bucket per season, hitting the 3-game minimum constantly. The home/away dimension can be added when multi-season history is available.

- [ ] **Step 1: Create the test file**

Create `pipeline/xmins.test.py`:

```python
"""Tests for pipeline/xmins.py — rotation risk functions (MIN-02)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from xmins import compute_rotation_risk, build_next_gw_team_fdr


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_history(difficulties: list, minutes: list) -> list:
    """Build minimal history list from parallel difficulty/minutes lists."""
    return [
        {'difficulty': d, 'minutes': m, 'was_home': True, 'opponent_team': 1}
        for d, m in zip(difficulties, minutes)
    ]


# ---------------------------------------------------------------------------
# compute_rotation_risk
# ---------------------------------------------------------------------------

class TestComputeRotationRisk:
    def test_high_risk_for_easy_fixtures_when_historically_rested(self):
        # Easy bucket avg=30, hard bucket avg=80 → overall avg=55
        # ratio = 30/55 ≈ 0.545 < 0.75 → high
        history = (
            make_history([1, 1, 1, 1, 1], [30, 30, 30, 30, 30]) +
            make_history([5, 5, 5, 5, 5], [80, 80, 80, 80, 80])
        )
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'high'
        assert result['rotation_factor'] == 0.75

    def test_low_risk_when_minutes_consistent_across_difficulty(self):
        # All difficulty=1, all 90 min → avg_bucket = avg_all = 90 → ratio=1.0 → low
        history = make_history([1] * 10, [90] * 10)
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'low'
        assert result['rotation_factor'] == 1.0

    def test_medium_risk_when_ratio_in_0_75_to_0_90(self):
        # Easy avg=70, hard avg=90 → overall avg=80
        # ratio = 70/80 = 0.875 → 0.75 ≤ ratio < 0.90 → medium
        history = (
            make_history([1, 1, 1, 1, 1], [70, 70, 70, 70, 70]) +
            make_history([5, 5, 5, 5, 5], [90, 90, 90, 90, 90])
        )
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'medium'
        assert result['rotation_factor'] == 0.87

    def test_fewer_than_5_total_games_returns_unknown(self):
        history = make_history([1, 1, 2], [90, 90, 90])  # only 3 games
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0

    def test_fewer_than_3_games_in_bucket_falls_back_to_unknown(self):
        # Only 2 easy fixtures — sparse bucket → unknown
        history = (
            make_history([1, 1], [30, 30]) +
            make_history([5, 5, 5, 5, 5], [90, 90, 90, 90, 90])
        )
        result = compute_rotation_risk(history, next_fixture_difficulty=1)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0

    def test_no_next_fixture_returns_unknown(self):
        history = make_history([1] * 10, [90] * 10)
        result = compute_rotation_risk(history, next_fixture_difficulty=None)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0

    def test_empty_history_returns_unknown(self):
        result = compute_rotation_risk([], next_fixture_difficulty=3)
        assert result['rotation_risk'] == 'unknown'
        assert result['rotation_factor'] == 1.0


# ---------------------------------------------------------------------------
# build_next_gw_team_fdr
# ---------------------------------------------------------------------------

class TestBuildNextGwTeamFdr:
    def test_returns_correct_difficulties_for_target_gw(self):
        fixtures = [
            {'event': 38, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 4},
            {'event': 38, 'team_h': 3, 'team_a': 4, 'team_h_difficulty': 2, 'team_a_difficulty': 5},
            {'event': 37, 'team_h': 5, 'team_a': 6, 'team_h_difficulty': 1, 'team_a_difficulty': 1},
        ]
        result = build_next_gw_team_fdr(fixtures, next_gw_id=38)
        assert result[1] == 3   # team 1 home difficulty
        assert result[2] == 4   # team 2 away difficulty
        assert result[3] == 2   # team 3 home difficulty
        assert result[4] == 5   # team 4 away difficulty
        assert 5 not in result  # GW37 not included
        assert 6 not in result  # GW37 not included

    def test_empty_fixtures_returns_empty_dict(self):
        assert build_next_gw_team_fdr([], next_gw_id=38) == {}

    def test_no_fixtures_for_target_gw_returns_empty_dict(self):
        fixtures = [
            {'event': 37, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 3, 'team_a_difficulty': 4},
        ]
        assert build_next_gw_team_fdr(fixtures, next_gw_id=38) == {}
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd pipeline && python -m pytest xmins.test.py -v
```

Expected: `ImportError` — `compute_rotation_risk` and `build_next_gw_team_fdr` not yet defined.

- [ ] **Step 3: Add the two new functions to `pipeline/xmins.py`**

Add this import at the top of `pipeline/xmins.py` (after the existing `import statistics` line):

```python
from news_classifier import classify_availability
```

Then add these two functions **after** the existing `POSITION_PRIOR` constant and **before** `compute_xmins_stats`:

```python
def build_next_gw_team_fdr(fixtures: list, next_gw_id: int) -> dict:
    """Build a mapping of team_id → fixture_difficulty for the given gameweek.

    Args:
        fixtures:    FPL fixture dicts from /fixtures/ endpoint. Each must have
                     'event', 'team_h', 'team_a', 'team_h_difficulty', 'team_a_difficulty'.
        next_gw_id:  FPL event id (gameweek number) to look up.

    Returns:
        dict mapping team_id (int) → difficulty (int 1–5).
        Teams with a blank GW are absent from the dict.
    """
    team_fdr: dict = {}
    for fixture in fixtures:
        if fixture.get('event') != next_gw_id:
            continue
        home_team = fixture.get('team_h')
        away_team = fixture.get('team_a')
        home_diff = fixture.get('team_h_difficulty')
        away_diff = fixture.get('team_a_difficulty')
        if home_team and home_diff:
            team_fdr[int(home_team)] = int(home_diff)
        if away_team and away_diff:
            team_fdr[int(away_team)] = int(away_diff)
    return team_fdr


def compute_rotation_risk(history: list, next_fixture_difficulty: int | None) -> dict:
    """Compute fixture-difficulty-aware rotation risk for a player.

    Bins historical games into easy (FDR 1–2) / medium (FDR 3) / hard (FDR 4–5)
    using the 'difficulty' field from element-summary history. Computes average
    minutes per bucket vs. player unconditional average, then classifies the next
    fixture's bucket as low / medium / high rotation risk.

    Args:
        history:                  Per-GW history list from element-summary/{id}/,
                                  each dict with 'minutes' (int) and 'difficulty' (int 1–5).
        next_fixture_difficulty:  FPL difficulty (1–5) for next GW fixture;
                                  None when player has a blank GW or data is unavailable.

    Returns:
        dict with keys:
            rotation_risk:   'low' | 'medium' | 'high' | 'unknown'
            rotation_factor: float  (1.0, 0.87, or 0.75)
    """
    UNKNOWN = {'rotation_risk': 'unknown', 'rotation_factor': 1.0}

    if not history or next_fixture_difficulty is None or len(history) < 5:
        return UNKNOWN

    def _bucket(diff: int) -> str:
        if diff <= 2:
            return 'easy'
        if diff == 3:
            return 'medium'
        return 'hard'

    next_bucket = _bucket(int(next_fixture_difficulty))

    bucket_minutes: dict[str, list] = {'easy': [], 'medium': [], 'hard': []}
    all_minutes: list = []

    for game in history:
        diff = game.get('difficulty')
        mins = int(game.get('minutes', 0))
        all_minutes.append(mins)
        if diff is not None:
            bucket_minutes[_bucket(int(diff))].append(mins)

    if not all_minutes:
        return UNKNOWN

    avg_all = sum(all_minutes) / len(all_minutes)
    if avg_all == 0:
        return UNKNOWN

    bucket_games = bucket_minutes.get(next_bucket, [])
    if len(bucket_games) < 3:
        return UNKNOWN  # sparse bucket — no reliable signal

    avg_bucket = sum(bucket_games) / len(bucket_games)
    ratio = avg_bucket / avg_all

    if ratio >= 0.90:
        return {'rotation_risk': 'low', 'rotation_factor': 1.0}
    if ratio >= 0.75:
        return {'rotation_risk': 'medium', 'rotation_factor': 0.87}
    return {'rotation_risk': 'high', 'rotation_factor': 0.75}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd pipeline && python -m pytest xmins.test.py -v
```

Expected: `10 passed`

- [ ] **Step 5: Commit**

```
git add pipeline/xmins.py pipeline/xmins.test.py
git commit -m "feat(min-02): add compute_rotation_risk and build_next_gw_team_fdr to xmins.py"
```

---

## Task 3: Wire both signals into `_compute_player_xmins` and extend `compute_xmins_stats`

**Files:**
- Modify: `pipeline/xmins.py`
- Modify: `pipeline/xmins.test.py`

- [ ] **Step 1: Write the failing tests**

Append these tests to `pipeline/xmins.test.py`:

```python
# ---------------------------------------------------------------------------
# _compute_player_xmins integration (via compute_xmins_stats)
# ---------------------------------------------------------------------------
from xmins import compute_xmins_stats


def _make_bootstrap_element(player_id=1, team=1, status='a', chance=None, news=''):
    return {
        'id': player_id,
        'team': team,
        'element_type': 3,
        'status': status,
        'news': news,
        'chance_of_playing_next_round': chance,
        'starts': 10,
        'minutes': 800,
    }


def _make_bootstrap(elements):
    return {'elements': elements}


def test_xmins_adjusted_equals_xmins_times_both_factors():
    """xmins_adjusted = xmins_base * rotation_factor * availability_factor."""
    # Player has status='a', no chance set, no news → availability_factor=1.0
    # history: 10 hard games @ 90 min each → next easy fixture → high rotation risk → factor=0.75
    history_data = make_history([5] * 10, [90] * 10)
    summaries = {1: {'history': history_data}}
    bootstrap = _make_bootstrap([_make_bootstrap_element(player_id=1, team=1)])
    # next GW fixture has difficulty=1 (easy) for team 1
    fixtures = [
        {'event': 38, 'team_h': 1, 'team_a': 2, 'team_h_difficulty': 1, 'team_a_difficulty': 3},
    ]
    result = compute_xmins_stats(bootstrap, summaries, finished_gws=10, fixtures=fixtures, next_gw_id=38)
    player = result[1]
    expected_adjusted = round(player['xmins'] * player['rotation_factor'] * 1.0, 1)
    assert player['xmins_adjusted'] == expected_adjusted
    assert player['rotation_risk'] == 'high'
    assert player['availability_risk'] == 'unknown'


def test_availability_factor_zero_gives_zero_xmins_adjusted():
    """An injured player (status='i') has xmins_adjusted=0 regardless of rotation."""
    history_data = make_history([3] * 10, [90] * 10)
    summaries = {1: {'history': history_data}}
    bootstrap = _make_bootstrap([_make_bootstrap_element(player_id=1, status='i')])
    result = compute_xmins_stats(bootstrap, summaries, finished_gws=10)
    player = result[1]
    assert player['xmins_adjusted'] == 0.0
    assert player['availability_risk'] == 'out'


def test_no_fixtures_passed_gives_unknown_rotation_risk():
    """When fixtures/next_gw_id are not provided, rotation_risk defaults to unknown."""
    summaries = {1: {'history': make_history([1] * 10, [90] * 10)}}
    bootstrap = _make_bootstrap([_make_bootstrap_element(player_id=1)])
    result = compute_xmins_stats(bootstrap, summaries, finished_gws=10)
    assert result[1]['rotation_risk'] == 'unknown'
    assert result[1]['rotation_factor'] == 1.0
```

- [ ] **Step 2: Run to confirm the new tests fail**

```
cd pipeline && python -m pytest xmins.test.py::test_xmins_adjusted_equals_xmins_times_both_factors xmins.test.py::test_availability_factor_zero_gives_zero_xmins_adjusted xmins.test.py::test_no_fixtures_passed_gives_unknown_rotation_risk -v
```

Expected: `AttributeError` or `KeyError` — `xmins_adjusted` not yet in the return dict.

- [ ] **Step 3: Update `compute_xmins_stats` signature**

In `pipeline/xmins.py`, replace the `compute_xmins_stats` function signature:

```python
def compute_xmins_stats(bootstrap: dict, summaries: dict, finished_gws: int) -> dict:
```

with:

```python
def compute_xmins_stats(
    bootstrap: dict,
    summaries: dict,
    finished_gws: int,
    fixtures: list | None = None,    # MIN-02: for rotation risk (optional, backward-compat)
    next_gw_id: int | None = None,   # MIN-02: for rotation risk (optional, backward-compat)
) -> dict:
```

And inside `compute_xmins_stats`, add this block immediately after the docstring (before the `results = {}` line):

```python
    # Build next-GW team FDR map for rotation risk computation (MIN-02).
    # Empty dict when fixtures/next_gw_id not provided — rotation risk defaults to unknown.
    team_fdr: dict = {}
    if fixtures and next_gw_id:
        team_fdr = build_next_gw_team_fdr(fixtures, next_gw_id)
```

And change the per-player call from:

```python
        results[player_id] = _compute_player_xmins(element, summaries.get(player_id), finished_gws)
```

to:

```python
        next_fixture_difficulty = team_fdr.get(element.get('team'))
        results[player_id] = _compute_player_xmins(
            element, summaries.get(player_id), finished_gws, next_fixture_difficulty,
        )
```

- [ ] **Step 4: Update `_compute_player_xmins` signature and return dict**

Replace the `_compute_player_xmins` function signature:

```python
def _compute_player_xmins(element: dict, summary: dict | None, finished_gws: int) -> dict:
```

with:

```python
def _compute_player_xmins(
    element: dict,
    summary: dict | None,
    finished_gws: int,
    next_fixture_difficulty: int | None = None,   # MIN-02: for rotation risk
) -> dict:
```

At the **end** of `_compute_player_xmins`, just before the `return` statement, add:

```python
    # MIN-02: Rotation risk (fixture-difficulty-aware).
    history = (summary or {}).get('history', [])
    rotation_result = compute_rotation_risk(history, next_fixture_difficulty)

    # MIN-02: Availability classification (FPL status → chance → keyword fallback).
    availability_result = classify_availability(
        status=element.get('status', 'a'),
        chance=element.get('chance_of_playing_next_round'),
        news_text=element.get('news', ''),
    )

    # Combined xmins adjustment.
    xmins_adjusted = round(
        xmins * rotation_result['rotation_factor'] * availability_result['availability_factor'],
        1,
    )
```

And change the existing `return` statement to include the new fields:

```python
    return {
        'xmins': xmins,
        'xmins_adjusted': xmins_adjusted,                               # MIN-02
        'start_prob': start_prob,
        'mins_risk': mins_risk,
        'mins_60_prob': mins_60_prob,
        'sub_risk_label': sub_risk_label,
        'rotation_risk': rotation_result['rotation_risk'],              # MIN-02
        'rotation_factor': rotation_result['rotation_factor'],          # MIN-02
        'availability_risk': availability_result['availability_risk'],  # MIN-02
        'availability_factor': availability_result['availability_factor'],  # MIN-02
    }
```

- [ ] **Step 5: Run all xmins tests**

```
cd pipeline && python -m pytest xmins.test.py -v
```

Expected: `13 passed`

- [ ] **Step 6: Commit**

```
git add pipeline/xmins.py pipeline/xmins.test.py
git commit -m "feat(min-02): wire rotation_risk and availability_risk into _compute_player_xmins"
```

---

## Task 4: Update `pipeline/run.py` and `pipeline/merge.py`

**Files:**
- Modify: `pipeline/run.py:329`
- Modify: `pipeline/merge.py:1110,1124`

- [ ] **Step 1: Update `run.py` to pass fixtures and next_gw_id**

In `pipeline/run.py`, find line 329 (the `compute_xmins_stats` call):

```python
            xmins_stats = compute_xmins_stats(bootstrap, summaries, finished_gws)
```

Replace with:

```python
            # MIN-02: pass fixtures and next GW id for fixture-aware rotation risk.
            _next_gw_id = next(
                (e['id'] for e in bootstrap.get('events', []) if e.get('is_next')),
                None,
            )
            xmins_stats = compute_xmins_stats(
                bootstrap, summaries, finished_gws,
                fixtures=fixtures,
                next_gw_id=_next_gw_id,
            )
```

(`fixtures` is already in scope at line 329 — it was fetched at line 180 via `get_fixtures()`.)

- [ ] **Step 2: Update `merge.py` to use `xmins_adjusted`**

In `pipeline/merge.py`, find the block around line 1110:

```python
        if xmins_stats and fpl_id in xmins_stats:
            xm = xmins_stats[fpl_id]
            player_xmins = xm['xmins']
```

Change `xm['xmins']` to use the adjusted value with a backward-compat fallback:

```python
        if xmins_stats and fpl_id in xmins_stats:
            xm = xmins_stats[fpl_id]
            # MIN-02: use xmins_adjusted (rotation + availability factors applied).
            # Fallback to xmins for backward compat if running against old cache.
            player_xmins = xm.get('xmins_adjusted', xm['xmins'])
```

- [ ] **Step 3: Write `rotation_risk` and `availability_risk` to the player dict**

In `pipeline/merge.py`, find the second `if xmins_stats and fpl_id in xmins_stats:` block (around line 1124) where `mins_risk`, `start_prob`, etc. are written to the player dict. Add two lines at the end of that block:

```python
            player['rotation_risk'] = xm.get('rotation_risk', 'unknown')        # MIN-02
            player['availability_risk'] = xm.get('availability_risk', 'unknown')  # MIN-02
```

**Verification note:** After this change, search `pipeline/gw_intel.py` for any existing `rotation_risk` field writes. The `_apply_rotation_risk` function in gw_intel must NOT overwrite the new `rotation_risk` field — confirm it uses a different field name (e.g. `european_rotation_risk` or similar). If it does overwrite the same field name, rename the gw_intel field and update its consumers before proceeding.

- [ ] **Step 4: Smoke-test the pipeline locally**

```
cd pipeline && python -c "
import json
from fpl_client import get_bootstrap_static, get_fixtures, get_element_summary
# Quick structural check — no actual write
print('imports OK')
"
```

Expected: `imports OK` (no import errors). Full pipeline integration tested in CI.

- [ ] **Step 5: Commit**

```
git add pipeline/run.py pipeline/merge.py
git commit -m "feat(min-02): thread xmins_adjusted through merge; write rotation_risk and availability_risk"
```

---

## Task 5: Add `rotation_risk` and `availability_risk` to `MergedPlayer` in `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Find `MergedPlayer` in types.ts**

Search for `export interface MergedPlayer` in `src/lib/types.ts`. The interface starts around line 97.

- [ ] **Step 2: Add the two new optional fields**

Find the block of xmins-related fields in `MergedPlayer` (look for `xmins`, `mins_risk`, `sub_risk_label`, `start_prob`). Add the two new fields directly after that group:

```typescript
  rotation_risk?: 'low' | 'medium' | 'high' | 'unknown'    // MIN-02: next-GW fixture-specific
  availability_risk?: 'out' | 'doubt' | 'fit' | 'unknown'  // MIN-02: FPL status + news
```

Fields are `?` (optional) for backward compatibility — UI components treat `undefined` as `'unknown'`.

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no new errors related to `rotation_risk` or `availability_risk`.

- [ ] **Step 4: Commit**

```
git add src/lib/types.ts
git commit -m "feat(min-02): add rotation_risk and availability_risk optional fields to MergedPlayer"
```

---

## Task 6: Create `src/components/shared/RiskChip.tsx` and tests

**Files:**
- Create: `src/components/shared/RiskChip.tsx`
- Create: `src/components/shared/RiskChip.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/shared/RiskChip.test.tsx`:

```typescript
// @vitest-environment jsdom
// MIN-02: RiskChip — rotation risk + availability risk chips
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RiskChip } from './RiskChip'

describe('RiskChip', () => {
  it('renders ↻ HIGH chip when rotationRisk is high', () => {
    const { container } = render(<RiskChip rotationRisk="high" />)
    expect(container.textContent).toContain('↻ HIGH')
  })

  it('renders ↻ MED chip when rotationRisk is medium', () => {
    const { container } = render(<RiskChip rotationRisk="medium" />)
    expect(container.textContent).toContain('↻ MED')
  })

  it('renders nothing when rotationRisk is low', () => {
    const { container } = render(<RiskChip rotationRisk="low" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders ✕ OUT chip when availabilityRisk is out', () => {
    const { container } = render(<RiskChip availabilityRisk="out" />)
    expect(container.textContent).toContain('✕ OUT')
  })

  it('renders ⚠ DOUBT chip when availabilityRisk is doubt', () => {
    const { container } = render(<RiskChip availabilityRisk="doubt" />)
    expect(container.textContent).toContain('⚠ DOUBT')
  })

  it('renders nothing when both are low and unknown', () => {
    const { container } = render(
      <RiskChip rotationRisk="low" availabilityRisk="unknown" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders both chips when rotationRisk is high and availabilityRisk is out', () => {
    const { container } = render(
      <RiskChip rotationRisk="high" availabilityRisk="out" />
    )
    expect(container.textContent).toContain('↻ HIGH')
    expect(container.textContent).toContain('✕ OUT')
  })
})
```

- [ ] **Step 2: Run to confirm the tests fail**

```
npx vitest run src/components/shared/RiskChip.test.tsx
```

Expected: `Cannot find module './RiskChip'`

- [ ] **Step 3: Create `src/components/shared/RiskChip.tsx`**

```typescript
// MIN-02: RiskChip — compact risk indicator for rotation risk and availability risk.
// Renders nothing when both signals are low/unknown (no visual noise for clean players).
// Used by MinsRiskBadge, OpportunityCostTable, and WildcardBuilderTab.

type RotationRisk = 'low' | 'medium' | 'high' | 'unknown'
type AvailabilityRisk = 'out' | 'doubt' | 'fit' | 'unknown'

export interface RiskChipProps {
  rotationRisk?: RotationRisk
  availabilityRisk?: AvailabilityRisk
}

export function RiskChip({ rotationRisk, availabilityRisk }: RiskChipProps) {
  const showRotation = rotationRisk === 'high' || rotationRisk === 'medium'
  const showAvailability = availabilityRisk === 'out' || availabilityRisk === 'doubt'

  if (!showRotation && !showAvailability) return null

  return (
    <div className="inline-flex flex-col gap-0.5 items-start">
      {showRotation && (
        <span
          className={`inline-block text-xs font-normal rounded px-2 py-1 ${
            rotationRisk === 'high'
              ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
              : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950'
          }`}
          title={`Rotation risk: ${rotationRisk!.toUpperCase()} — fewer minutes expected in this fixture type`}
        >
          {rotationRisk === 'high' ? '↻ HIGH' : '↻ MED'}
        </span>
      )}
      {showAvailability && (
        <span
          className={`inline-block text-xs font-normal rounded px-2 py-1 ${
            availabilityRisk === 'out'
              ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
              : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950'
          }`}
          title={
            availabilityRisk === 'out'
              ? 'Availability: OUT — player is unavailable'
              : 'Availability: DOUBT — player has a fitness concern'
          }
        >
          {availabilityRisk === 'out' ? '✕ OUT' : '⚠ DOUBT'}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run src/components/shared/RiskChip.test.tsx
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```
git add src/components/shared/RiskChip.tsx src/components/shared/RiskChip.test.tsx
git commit -m "feat(min-02): RiskChip component — rotation and availability risk chips"
```

---

## Task 7: Extend `MinsRiskBadge` and wire into `OpportunityCostTable` and `WildcardBuilderTab`

**Files:**
- Modify: `src/components/shared/MinsRiskBadge.tsx`
- Modify: `src/components/shared/MinsRiskBadge.test.tsx`
- Modify: `src/components/transfers/OpportunityCostTable.tsx`
- Modify: `src/components/planner/WildcardBuilderTab.tsx`

- [ ] **Step 1: Write failing tests for extended `MinsRiskBadge`**

Append these tests to `src/components/shared/MinsRiskBadge.test.tsx` inside a new `describe` block at the end of the file:

```typescript
// MIN-02: RiskChip integration inside MinsRiskBadge
import { RiskChip } from './RiskChip'  // import for type reference only

describe('MinsRiskBadge — MIN-02 RiskChip integration', () => {
  it('renders ↻ HIGH chip when rotationRisk=high', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" rotationRisk="high" />
    )
    expect(container.textContent).toContain('↻ HIGH')
  })

  it('renders ⚠ DOUBT chip when availabilityRisk=doubt', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" availabilityRisk="doubt" />
    )
    expect(container.textContent).toContain('⚠ DOUBT')
  })

  it('does not render risk chips when both are low and fit', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk="nailed" rotationRisk="low" availabilityRisk="fit" />
    )
    expect(container.textContent).not.toContain('↻')
    expect(container.textContent).not.toContain('⚠')
    expect(container.textContent).not.toContain('✕')
  })

  it('renders nothing when minsRisk is undefined and both risk signals are low/unknown', () => {
    const { container } = render(
      <MinsRiskBadge minsRisk={undefined} rotationRisk="low" availabilityRisk="unknown" />
    )
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm the 4 new tests fail**

```
npx vitest run src/components/shared/MinsRiskBadge.test.tsx
```

Expected: existing tests pass, 4 new tests fail (props not yet accepted).

- [ ] **Step 3: Extend `MinsRiskBadge.tsx`**

Add the `RiskChip` import at the top of `src/components/shared/MinsRiskBadge.tsx`:

```typescript
import { RiskChip } from './RiskChip'
import type { RiskChipProps } from './RiskChip'
```

Replace the `MinsRiskBadge` function signature:

```typescript
export function MinsRiskBadge({
  minsRisk,
  mins60Prob,
}: {
  minsRisk: MinsRisk | SubRiskLabel | undefined
  mins60Prob?: number
}) {
```

with:

```typescript
export function MinsRiskBadge({
  minsRisk,
  mins60Prob,
  rotationRisk,
  availabilityRisk,
}: {
  minsRisk: MinsRisk | SubRiskLabel | undefined
  mins60Prob?: number
  rotationRisk?: RiskChipProps['rotationRisk']
  availabilityRisk?: RiskChipProps['availabilityRisk']
}) {
```

Replace the early-return guard:

```typescript
  const config = getMinsRiskConfig(minsRisk)
  if (!config) return null
```

with:

```typescript
  const config = getMinsRiskConfig(minsRisk)
  const hasRiskChip =
    (rotationRisk === 'high' || rotationRisk === 'medium') ||
    (availabilityRisk === 'out' || availabilityRisk === 'doubt')
  if (!config && !hasRiskChip) return null
```

Replace the existing `return` statement:

```typescript
  return (
    <span
      className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
      title={titleText}
    >
      {config.label}
    </span>
  )
```

with:

```typescript
  return (
    <div className="inline-flex flex-col gap-1 items-start">
      {config && (
        <span
          className={`inline-block text-xs font-normal ${config.text} ${config.bg} rounded px-2 py-1`}
          title={titleText}
        >
          {config.label}
        </span>
      )}
      <RiskChip rotationRisk={rotationRisk} availabilityRisk={availabilityRisk} />
    </div>
  )
```

- [ ] **Step 4: Run MinsRiskBadge tests to confirm all pass**

```
npx vitest run src/components/shared/MinsRiskBadge.test.tsx
```

Expected: all tests pass (existing + 4 new). The `container.querySelector('span')` calls in existing tests still work because `<span>` elements remain inside the new wrapper `<div>`.

- [ ] **Step 5: Wire into `OpportunityCostTable.tsx`**

Read `src/components/transfers/OpportunityCostTable.tsx` and search for all `<MinsRiskBadge` call sites. For each call site where a player's `minsRisk` is passed, add the two new props:

```typescript
<MinsRiskBadge
  minsRisk={player.mins_risk /* or sub_risk_label — match the existing prop */}
  mins60Prob={player.mins_60_prob}
  rotationRisk={player.rotation_risk}          // MIN-02
  availabilityRisk={player.availability_risk}  // MIN-02
/>
```

The exact prop name for `minsRisk` at each call site may vary (`mins_risk`, `sub_risk_label`) — match what is already there; only add the two new `rotationRisk` / `availabilityRisk` props.

- [ ] **Step 6: Wire into `WildcardBuilderTab.tsx`**

Read `src/components/planner/WildcardBuilderTab.tsx` and find where individual player rows are rendered inside position groups. Import `RiskChip` at the top:

```typescript
import { RiskChip } from '@/components/shared/RiskChip'
```

Add `RiskChip` after the player name in each row:

```typescript
<div key={p.id} className="flex items-center gap-2 ...">
  <span className="...">{p.web_name}</span>
  <RiskChip
    rotationRisk={p.rotation_risk}
    availabilityRisk={p.availability_risk}
  />
  {/* existing cost / position chips */}
</div>
```

- [ ] **Step 7: Run full test suite**

```
npx vitest run
```

Expected: all tests pass. If any existing OpportunityCostTable or WildcardBuilderTab tests fail due to the new chips rendering unexpectedly, update the test mocks to include `rotation_risk: 'low'` and `availability_risk: 'fit'` (so RiskChip renders nothing and existing assertions are unaffected).

- [ ] **Step 8: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```
git add src/components/shared/MinsRiskBadge.tsx src/components/shared/MinsRiskBadge.test.tsx \
        src/components/transfers/OpportunityCostTable.tsx \
        src/components/planner/WildcardBuilderTab.tsx
git commit -m "feat(min-02): wire RiskChip into MinsRiskBadge, OpportunityCostTable, WildcardBuilderTab"
```

---

## Self-review checklist (for implementer)

- [ ] `classify_availability` — FPL `chance` always overrides keyword inference
- [ ] `compute_rotation_risk` — returns `unknown` for sparse bucket (<3 games) and <5 total games
- [ ] `xmins_adjusted` in return dict of `_compute_player_xmins` — uses both factors
- [ ] `merge.py` — `xmins.get('xmins_adjusted', xm['xmins'])` backward-compat fallback present
- [ ] `gw_intel._apply_rotation_risk` does not overwrite the new `rotation_risk` player field
- [ ] `RiskChip` renders `null` when both signals are low/unknown (no noise for clean players)
- [ ] `MinsRiskBadge` still returns `null` when `minsRisk` is `undefined` AND no risk chips
- [ ] `npx vitest run` — all tests green
- [ ] `npx tsc --noEmit` — no errors
