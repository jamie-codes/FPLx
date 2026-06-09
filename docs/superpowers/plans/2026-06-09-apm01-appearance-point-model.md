# APM-01: Appearance Point Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `appearance_pts = start_prob × 2` with `start_prob × (1 + mins_60_prob) + sub_appear_prob` so rotation-risk players and frequent substitutes are correctly priced.

**Architecture:** `xmins.py` computes the new `sub_appear_prob` output; `merge.py` uses it in `_compute_xpts_fixture`; `accuracy.py` mirrors the formula in backtest reconstruction; `tune.py` sweeps `sub_appear_window_gws` as parameter 7; `run.py` reads/passes/writes it using the established TUNE-01 pattern.

**Tech Stack:** Python 3.11, pytest — no new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `pipeline/xmins.py` | `_compute_player_xmins` + `compute_xmins_stats` gain `sub_appear_window_gws`; output gains `sub_appear_prob` |
| `pipeline/merge.py` | `_compute_xpts_fixture` gains `sub_appear_prob`; formula change; `_xpts_ngw` threads it; `merge_players` gains `sub_appear_window_gws` |
| `pipeline/accuracy.py` | `SUB_APPEAR_WINDOW_GWS` constant; `_group_history_by_gw` tracks `sub_appear_n`; new `_compute_sub_appear_prob` helper; `_reconstruct_xpts` and `_reconstruct_xpts_with_form` gain appearance params; `build_per_gw_rows` gains `sub_appear_window_gws` |
| `pipeline/tune.py` | Import `SUB_APPEAR_WINDOW_GWS`; add candidates; extend `_read_prior_params`, `params`, `sweep_order`, both `build_per_gw_rows` calls |
| `pipeline/run.py` | Read/init/pass/write `sub_appear_window_gws_used` |
| `pipeline/tests/test_xmins.py` | 4 new tests |
| `pipeline/tests/test_merge_xpts_components.py` | 3 new tests |
| `pipeline/tests/test_accuracy.py` | 3 new tests for `_compute_sub_appear_prob` + 1 test for sub appearance reconstruction |
| `pipeline/tests/test_tune.py` | 2 new + 3 updated |
| `pipeline/tests/test_run.py` | Extend `_read_tuner_params` + both contract tests |

---

## Task 1: `sub_appear_prob` in `xmins.py`

**Files:**
- Modify: `pipeline/xmins.py`
- Modify: `pipeline/tests/test_xmins.py`

### Scene

`xmins.py`'s `_compute_player_xmins` already computes `mins_60_prob` from `starts_in_recent`. We add `sub_appear_prob` using the same `history` variable that's already fetched at the bottom of the function for rotation risk (line 230: `history = (summary or {}).get('history', [])`). A "sub appearance" is any entry where `0 < minutes < 45`.

The function takes `sub_appear_window_gws: int = 15` (separate, longer window than the 10-GW start window). `compute_xmins_stats` gains the same kwarg and passes it through.

- [ ] **Step 1: Write the 4 failing tests**

Append after the last test in `pipeline/tests/test_xmins.py` (after line 362):

```python
# ── APM-01: sub_appear_prob tests ─────────────────────────────────────────────

def test_sub_appear_prob_in_return_dict():
    """APM-01: _compute_player_xmins must return 'sub_appear_prob' key."""
    history = [_hist(90, 1)] * 10
    result = _compute_player_xmins(_element(), _summary(history), 10)
    assert 'sub_appear_prob' in result


def test_sub_appear_prob_consistent_sub():
    """APM-01: player with 3 sub appearances in 15 entries → sub_appear_prob = 3/15 = 0.2."""
    # 12 full starts + 3 sub appearances (0 < minutes < 45)
    history = [_hist(90, 1)] * 12 + [_hist(30, 0)] * 3
    result = _compute_player_xmins(_element(starts=12, minutes=1080), _summary(history), 15,
                                    sub_appear_window_gws=15)
    assert abs(result['sub_appear_prob'] - 3/15) < 1e-6


def test_sub_appear_prob_full_starters():
    """APM-01: player whose all entries are >= 45 minutes → sub_appear_prob == 0.0."""
    history = [_hist(90, 1)] * 15
    result = _compute_player_xmins(_element(starts=15, minutes=1350), _summary(history), 15,
                                    sub_appear_window_gws=15)
    assert result['sub_appear_prob'] == 0.0


def test_sub_appear_prob_sparse_history():
    """APM-01: player with only 5 history entries, window=15 → denominator = 5 (actual entries)."""
    # 3 full starts + 2 sub appearances in only 5 entries total
    history = [_hist(90, 1)] * 3 + [_hist(25, 0)] * 2
    result = _compute_player_xmins(_element(starts=3, minutes=270), _summary(history), 5,
                                    sub_appear_window_gws=15)
    assert abs(result['sub_appear_prob'] - 2/5) < 1e-6


def test_sub_appear_prob_dgw_counts_two():
    """APM-01: window containing two sub-appearance entries (e.g. from same DGW) counts both."""
    # 10 full starts + 2 sub-appearance entries
    history = [_hist(90, 1)] * 10 + [_hist(20, 0), _hist(30, 0)]
    result = _compute_player_xmins(_element(starts=10, minutes=900), _summary(history), 12,
                                    sub_appear_window_gws=12)
    assert abs(result['sub_appear_prob'] - 2/12) < 1e-6
```

Note: there are now 5 tests (not 4) — `test_sub_appear_prob_in_return_dict` is a quick smoke test, plus the 4 substantive ones. Keep all 5.

- [ ] **Step 2: Run tests to confirm they fail**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_xmins.py -k "sub_appear" -v
```

Expected: `TypeError: _compute_player_xmins() got an unexpected keyword argument 'sub_appear_window_gws'` or AttributeError.

- [ ] **Step 3: Add `sub_appear_window_gws` to `_compute_player_xmins`**

Find `def _compute_player_xmins(` (line 149). Add `sub_appear_window_gws: int = 15` after `next_fixture_difficulty`:

```python
def _compute_player_xmins(
    element: dict,
    summary: dict | None,
    finished_gws: int,
    next_fixture_difficulty: int | None = None,   # MIN-02: for rotation risk
    sub_appear_window_gws: int = 15,              # APM-01: sub appearance history window
) -> dict:
```

- [ ] **Step 4: Compute `sub_appear_prob` after the rotation risk fetch**

Find line 230: `history = (summary or {}).get('history', [])`. Add the sub_appear computation immediately after the `rotation_result` line:

```python
    history = (summary or {}).get('history', [])
    rotation_result = compute_rotation_risk(history, next_fixture_difficulty)

    # APM-01: sub appearance probability — P(0 < minutes < 45) in last sub_appear_window_gws entries
    _sub_window = history[-sub_appear_window_gws:]
    _sub_n = sum(1 for e in _sub_window if 0 < (e.get('minutes') or 0) < 45)
    sub_appear_prob = _sub_n / max(len(_sub_window), 1)
```

- [ ] **Step 5: Add `sub_appear_prob` to the return dict**

Find the `return {` at the bottom of `_compute_player_xmins`. Add after `'availability_factor'`:

```python
    return {
        'xmins': xmins,
        'xmins_adjusted': xmins_adjusted,
        'start_prob': start_prob,
        'mins_risk': mins_risk,
        'mins_60_prob': mins_60_prob,
        'sub_risk_label': sub_risk_label,
        'difficulty_rotation_risk': rotation_result['rotation_risk'],
        'difficulty_rotation_factor': rotation_result['rotation_factor'],
        'availability_risk': availability_result['availability_risk'],
        'availability_factor': availability_result['availability_factor'],
        'sub_appear_prob': round(sub_appear_prob, 4),   # APM-01
    }
```

- [ ] **Step 6: Add `sub_appear_window_gws` to `compute_xmins_stats`**

Find `def compute_xmins_stats(` (line 106). Add parameter after `next_gw_id`:

```python
def compute_xmins_stats(
    bootstrap: dict,
    summaries: dict,
    finished_gws: int,
    fixtures: list | None = None,
    next_gw_id: int | None = None,
    sub_appear_window_gws: int = 15,   # APM-01: sub appearance history window
) -> dict:
```

Also update the docstring's Returns line to add `sub_appear_prob` to the listed keys:

```
            xmins, xmins_adjusted, start_prob, mins_risk, mins_60_prob, sub_risk_label,
            difficulty_rotation_risk, difficulty_rotation_factor, availability_risk, availability_factor,
            sub_appear_prob.
```

- [ ] **Step 7: Thread `sub_appear_window_gws` to `_compute_player_xmins`**

Find the `_compute_player_xmins` call inside `compute_xmins_stats` (currently `results[player_id] = _compute_player_xmins(...)`). Add the kwarg:

```python
        results[player_id] = _compute_player_xmins(
            element, summaries.get(player_id), finished_gws, next_fixture_difficulty,
            sub_appear_window_gws=sub_appear_window_gws,   # APM-01
        )
```

- [ ] **Step 8: Run all xmins tests**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_xmins.py -v
```

Expected: all pass (existing tests + 5 new APM-01 tests).

- [ ] **Step 9: Commit**

```
git -C C:\Users\jamie\fplx add pipeline/xmins.py pipeline/tests/test_xmins.py
git -C C:\Users\jamie\fplx commit -m "feat(apm-01): add sub_appear_prob to xmins compute_xmins_stats"
```

---

## Task 2: Formula change in `merge.py`

**Files:**
- Modify: `pipeline/merge.py`
- Modify: `pipeline/tests/test_merge_xpts_components.py`

### Scene

`_compute_xpts_fixture` (line 257) gains `sub_appear_prob: float = 0.0`. The `appearance_pts` line changes from `start_prob * 2` to use the two-component formula. When `mins_60_prob is None` (existing default), it falls back to 1.0, giving `start_prob × 2` (backward-compatible).

`_xpts_ngw` (line 349) also gains `sub_appear_prob` and passes it to every `_compute_xpts_fixture` call inside its fixture loop.

`merge_players` gains `sub_appear_window_gws: int = 15`, passes it to `compute_xmins_stats`, extracts `player_sub_appear_prob` from `xmins_stats`, and passes it to the three `_xpts_ngw` calls (1gw, 3gw, 5gw).

- [ ] **Step 1: Write the 3 failing tests**

Append after `test_merge_players_writes_xpts_components_1gw` in `pipeline/tests/test_merge_xpts_components.py`:

```python
# ── APM-01: appearance point model tests ──────────────────────────────────────

def test_appearance_pts_full_game_equivalence():
    """APM-01: mins_60_prob=1.0, sub_appear_prob=0.0 → appearance_pts = start_prob × 2 (old formula)."""
    result = _compute_xpts_fixture(
        xg_per90=0.0,
        xa_per90=0.0,
        start_prob=0.8,
        xmins=72.0,
        element_type=3,
        defensive_difficulty=0.5,
        mins_60_prob=1.0,
        sub_appear_prob=0.0,
    )
    assert result['appearance_pts'] == pytest.approx(0.8 * 2, abs=0.001)


def test_appearance_pts_partial_game():
    """APM-01: mins_60_prob=0.5 → appearance_pts = start_prob × (1 + 0.5) = 1.5."""
    result = _compute_xpts_fixture(
        xg_per90=0.0,
        xa_per90=0.0,
        start_prob=1.0,
        xmins=90.0,
        element_type=3,
        defensive_difficulty=0.5,
        mins_60_prob=0.5,
        sub_appear_prob=0.0,
    )
    assert result['appearance_pts'] == pytest.approx(1.5, abs=0.001)


def test_appearance_pts_sub_contribution():
    """APM-01: sub_appear_prob=0.3, start_prob=0.0 → appearance_pts = 0.3 (sub-only contribution)."""
    # xmins > 0 required to avoid the guard; use a tiny positive value
    result = _compute_xpts_fixture(
        xg_per90=0.0,
        xa_per90=0.0,
        start_prob=0.1,
        xmins=9.0,
        element_type=3,
        defensive_difficulty=0.5,
        mins_60_prob=0.0,
        sub_appear_prob=0.3,
    )
    # start contribution: 0.1 × (1 + 0.0) = 0.1; sub contribution: 0.3
    assert result['appearance_pts'] == pytest.approx(0.1 + 0.3, abs=0.001)
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_merge_xpts_components.py -k "apm" -v
```

Expected: failures — `_compute_xpts_fixture` does not yet accept `sub_appear_prob`.

- [ ] **Step 3: Add `sub_appear_prob` to `_compute_xpts_fixture` and change the formula**

Find `def _compute_xpts_fixture(` (line 257). Add `sub_appear_prob: float = 0.0` after `cs_prob_slope`:

```python
def _compute_xpts_fixture(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    defensive_difficulty: float,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,
    opponent_xg_per_game: float = 0.0,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
    sub_appear_prob: float = 0.0,    # APM-01: P(sub appearance); adds 1pt contribution
) -> dict:
```

Find the appearance_pts line (line 328):

```python
    # Appearance: FPL awards 2pts for starting; D-01 Phase 48. NOT scaled by xmins/90 —
    # appearance points are per game started, not per minute.
    appearance_pts = start_prob * 2
```

Replace with:

```python
    # Appearance: APM-01. FPL awards 2pts for ≥60 min, 1pt for <60 min, 1pt for sub appearance.
    # mins_60_prob=None defaults to 1.0 (backward-compatible: start_prob × 2).
    _mins_60 = mins_60_prob if mins_60_prob is not None else 1.0
    appearance_pts = start_prob * (1 + _mins_60) + sub_appear_prob
```

- [ ] **Step 4: Add `sub_appear_prob` to `_xpts_ngw` and thread it through**

Find `def _xpts_ngw(` (line 349). Add `sub_appear_prob: float = 0.0` after `cs_prob_slope`:

```python
def _xpts_ngw(
    xg_per90: float,
    xa_per90: float,
    start_prob: float,
    xmins: float,
    element_type: int,
    fixtures: list,
    n_gws: int,
    xmins_v2_enabled: bool = False,
    mins_60_prob: float | None = None,
    bonus_predictor_enabled: bool = False,
    bonus_ev: float | None = None,
    save_predictor_enabled: bool = False,
    cs_prob_base: float = 0.40,
    cs_prob_slope: float = 0.30,
    sub_appear_prob: float = 0.0,    # APM-01
) -> tuple:
```

Find the `_compute_xpts_fixture(` call inside `_xpts_ngw` (line 389). Add `sub_appear_prob=sub_appear_prob` at the end:

```python
            result = _compute_xpts_fixture(
                xg_per90 if xg_per90 is not None else 0.0,
                xa_per90 if xa_per90 is not None else 0.0,
                start_prob,
                xmins,
                element_type,
                fix.get('defensive_difficulty', 0.5),
                xmins_v2_enabled=xmins_v2_enabled,
                mins_60_prob=mins_60_prob,
                bonus_predictor_enabled=bonus_predictor_enabled,
                bonus_ev=bonus_ev,
                save_predictor_enabled=save_predictor_enabled,
                opponent_xg_per_game=fix.get('opponent_xg_per_game', 0.0),
                cs_prob_base=cs_prob_base,
                cs_prob_slope=cs_prob_slope,
                sub_appear_prob=sub_appear_prob,   # APM-01
            )
```

- [ ] **Step 5: Add `sub_appear_window_gws` to `merge_players`**

Find `def merge_players(` (line 822). Add `sub_appear_window_gws: int = 15` after `form_difficulty_gamma`:

```python
    form_actual_beta: float = 0.0,          # FRM-01
    form_difficulty_gamma: float = 0.0,     # FRM-02
    sub_appear_window_gws: int = 15,        # APM-01: sub appearance history window, tunable via TUNE-01
```

Also add a docstring entry for the new param.

- [ ] **Step 6: Pass `sub_appear_window_gws` to `compute_xmins_stats` inside `merge_players`**

Find the `compute_xmins_stats(` call inside `merge_players` (around line 334):

```python
            xmins_stats = compute_xmins_stats(
                bootstrap, summaries, finished_gws,
                fixtures=fixtures,
                next_gw_id=_next_gw_id,
            )
```

Add the new kwarg:

```python
            xmins_stats = compute_xmins_stats(
                bootstrap, summaries, finished_gws,
                fixtures=fixtures,
                next_gw_id=_next_gw_id,
                sub_appear_window_gws=sub_appear_window_gws,   # APM-01
            )
```

- [ ] **Step 7: Extract `player_sub_appear_prob` from `xmins_stats` and pass to `_xpts_ngw` calls**

Inside `merge_players`, find where `player_mins_60_prob` is extracted from `player_xmins_data` (search for `player_mins_60_prob`). Add the line immediately after it:

```python
player_sub_appear_prob = player_xmins_data.get('sub_appear_prob', 0.0)   # APM-01
```

Then find ALL three `_xpts_ngw(` calls (for 1gw, 3gw, 5gw) and add `sub_appear_prob=player_sub_appear_prob` to each. The call currently ends with `cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,`. Add after:

```python
                sub_appear_prob=player_sub_appear_prob,    # APM-01
```

There may also be `_xpts_per_gw` calls — apply the same treatment to any function that calls `_compute_xpts_fixture` with `start_prob` and `mins_60_prob`.

- [ ] **Step 8: Run all merge xpts tests**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_merge_xpts_components.py -v
```

Expected: all pass. Existing `test_appearance_pts_formula` (which calls without `mins_60_prob`) should still pass because `mins_60_prob=None → _mins_60=1.0 → start_prob × 2`.

- [ ] **Step 9: Run full suite**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/ -q 2>&1 | Select-Object -Last 5
```

Expected: all pass.

- [ ] **Step 10: Commit**

```
git -C C:\Users\jamie\fplx add pipeline/merge.py pipeline/tests/test_merge_xpts_components.py
git -C C:\Users\jamie\fplx commit -m "feat(apm-01): appearance_pts formula uses mins_60_prob and sub_appear_prob"
```

---

## Task 3: Mirror in `accuracy.py`

**Files:**
- Modify: `pipeline/accuracy.py`
- Modify: `pipeline/tests/test_accuracy.py`

### Scene

Three accuracy.py functions need updating to match the new appearance formula:

1. `_group_history_by_gw` — tracks `sub_appear_n` (count of entries with 0 < minutes < 45) per round.
2. `_compute_sub_appear_prob` — new helper: computes sub_appear_prob from grouped data before `current_gw`.
3. `_reconstruct_xpts` — gains `mins_60_prob` and `sub_appear_prob`; sub appearances return `sub_appear_prob` instead of 0.0.
4. `_reconstruct_xpts_with_form` — gains the same params; threads through.
5. `build_per_gw_rows` — gains `sub_appear_window_gws`; computes both probabilities and passes them.

The `_compute_sub_appear_prob` helper uses `difficulty_n` (added by FRM-02) as the total-entries-per-round counter. The denominator is actual entries seen (not fixed window_gws), matching xmins.py.

- [ ] **Step 1: Add the `SUB_APPEAR_WINDOW_GWS` constant**

Find the constants block at the top of `accuracy.py` (around line 39). Add after `FORM_DIFFICULTY_GAMMA`:

```python
FORM_DIFFICULTY_GAMMA = 0.0  # FRM-02: difficulty weight scaling (default 0.0 = no-op)
SUB_APPEAR_WINDOW_GWS = 15   # APM-01: sub appearance history window (default)
```

- [ ] **Step 2: Run existing accuracy tests to establish baseline**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_accuracy.py -q 2>&1 | Select-Object -Last 5
```

Note the count.

- [ ] **Step 3: Add `sub_appear_n` to `_group_history_by_gw`**

Find `_group_history_by_gw` (line 786). In the `defaultdict` lambda, add `'sub_appear_n': 0` after `'difficulty_n': 0`:

```python
    by_round: dict = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
        'goals_scored': 0, 'assists': 0,           # FRM-01
        'difficulty_sum': 0.0, 'difficulty_n': 0,  # FRM-02
        'sub_appear_n': 0,                          # APM-01
    })
```

In the loop body, after `agg['difficulty_n'] += 1`, add:

```python
        raw_mins = entry.get('minutes') or 0
        if 0 < raw_mins < 45:
            agg['sub_appear_n'] += 1   # APM-01
```

- [ ] **Step 4: Write the 4 failing tests for `_compute_sub_appear_prob` and sub appearance reconstruction**

Append after the last test in `pipeline/tests/test_accuracy.py`:

```python
# ── APM-01: sub appearance tests ──────────────────────────────────────────────

class TestComputeSubAppearProb:
    """Tests for _compute_sub_appear_prob helper."""

    def _make_grouped(self, rounds_data):
        """Build a minimal grouped dict. rounds_data: list of (round, minutes, sub_appear_n, difficulty_n)."""
        from collections import defaultdict
        grouped = {}
        for r, mins, sub_n, diff_n in rounds_data:
            grouped[r] = {
                'round': r, 'minutes': mins, 'total_points': 0,
                'expected_goals': 0.0, 'expected_assists': 0.0,
                'goals_scored': 0, 'assists': 0,
                'difficulty_sum': 3.0 * diff_n, 'difficulty_n': diff_n,
                'sub_appear_n': sub_n,
            }
        return grouped

    def test_basic(self):
        """2 sub appearances across 10 entries (SGW rounds), window=15 → 2/10 = 0.2."""
        from accuracy import _compute_sub_appear_prob
        grouped = self._make_grouped(
            [(r, 90, 0, 1) for r in range(1, 9)]   # 8 starts, no subs
            + [(9, 30, 1, 1), (10, 25, 1, 1)]       # 2 sub appearances
        )
        # current_gw=11 → all 10 rounds are prior
        result = _compute_sub_appear_prob(grouped, current_gw=11, window_gws=15)
        assert abs(result - 2/10) < 1e-6

    def test_empty_history(self):
        """No rounds before current_gw → 0.0."""
        from accuracy import _compute_sub_appear_prob
        grouped = self._make_grouped([(5, 90, 0, 1)])
        result = _compute_sub_appear_prob(grouped, current_gw=3, window_gws=15)
        assert result == 0.0

    def test_window_cap(self):
        """Only 5 rounds before current_gw, window=15 → uses those 5, denominator = 5."""
        from accuracy import _compute_sub_appear_prob
        grouped = self._make_grouped(
            [(r, 90, 0, 1) for r in range(1, 4)]   # 3 starts
            + [(4, 20, 1, 1), (5, 35, 1, 1)]        # 2 sub appearances
        )
        result = _compute_sub_appear_prob(grouped, current_gw=6, window_gws=15)
        assert abs(result - 2/5) < 1e-6

    def test_reconstruct_xpts_sub_appearance_returns_sub_appear_prob(self):
        """APM-01: entry with minutes=30 (< 45) → _reconstruct_xpts returns sub_appear_prob."""
        from accuracy import _reconstruct_xpts
        entry = {'minutes': 30, 'total_points': 1,
                 'expected_goals': 0.0, 'expected_assists': 0.0}
        result = _reconstruct_xpts(entry, element_type=3, difficulty_score=0.5,
                                    sub_appear_prob=0.25)
        assert abs(result - 0.25) < 0.001
```

- [ ] **Step 5: Run the new tests to confirm they fail**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_accuracy.py::TestComputeSubAppearProb -v
```

Expected: `ImportError` — `_compute_sub_appear_prob` not yet defined.

- [ ] **Step 6: Add `_compute_sub_appear_prob` helper to `accuracy.py`**

Insert immediately after `_group_history_by_gw` (after line 812):

```python
def _compute_sub_appear_prob(
    grouped: dict,
    current_gw: int,
    window_gws: int = SUB_APPEAR_WINDOW_GWS,
) -> float:
    """APM-01: compute sub appearance probability from grouped history before current_gw.

    Counts entries where 0 < minutes < 45 (tracked in sub_appear_n) across the most
    recent window_gws fixture entries before current_gw. Uses difficulty_n (FRM-02)
    as the total-entries-per-round counter (handles DGW correctly).
    Denominator = actual entries seen — matches xmins.py computation.
    Returns 0.0 if no prior history.
    """
    prior_rounds = sorted((r for r in grouped if r < current_gw), reverse=True)
    total_entries = 0
    sub_n = 0
    for r in prior_rounds:
        if total_entries >= window_gws:
            break
        agg = grouped[r]
        n = agg.get('difficulty_n', 1)
        sub_n += agg.get('sub_appear_n', 0)
        total_entries += n
    if total_entries == 0:
        return 0.0
    return sub_n / total_entries
```

- [ ] **Step 7: Extend `_reconstruct_xpts` with `mins_60_prob` and `sub_appear_prob`**

Find `def _reconstruct_xpts(` (line 815). Change the signature to:

```python
def _reconstruct_xpts(entry: dict, element_type: int, difficulty_score: float,
                       cs_prob_base: float = CS_PROB_BASE, cs_prob_slope: float = CS_PROB_SLOPE,
                       mins_60_prob: float | None = None,   # APM-01
                       sub_appear_prob: float = 0.0,        # APM-01
                       ) -> float:
```

Find the early return for sub appearances (currently `if start_prob == 0.0: return 0.0`). Change to:

```python
    start_prob = 1.0 if minutes >= 45 else 0.0
    if start_prob == 0.0:
        # APM-01: sub appearance — return the prior prediction for this scenario
        return round(sub_appear_prob, 2)
```

Find the `_compute_xpts_fixture(` call. Add `mins_60_prob=mins_60_prob` and keep `sub_appear_prob=0.0` (starter already captured by `start_prob`):

```python
    result = _compute_xpts_fixture(
        xg_per90=xg_per90,
        xa_per90=xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
        mins_60_prob=mins_60_prob,   # APM-01: use prior mins_60_prob for appearance formula
    )
```

- [ ] **Step 8: Extend `_reconstruct_xpts_with_form` with `mins_60_prob` and `sub_appear_prob`**

Find `def _reconstruct_xpts_with_form(` (line 915). Change signature:

```python
def _reconstruct_xpts_with_form(
    entry: dict,
    element_type: int,
    difficulty_score: float,
    form_per90: 'float | None',
    blend_alpha: float = BLEND_ALPHA,
    cs_prob_base: float = CS_PROB_BASE,
    cs_prob_slope: float = CS_PROB_SLOPE,
    mins_60_prob: float | None = None,   # APM-01
    sub_appear_prob: float = 0.0,        # APM-01
) -> float:
```

Find the `if form_per90 is None:` fallback (currently delegates to `_reconstruct_xpts`). Thread the new params:

```python
    if form_per90 is None:
        return _reconstruct_xpts(entry, element_type, difficulty_score,
                                  cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
                                  mins_60_prob=mins_60_prob,        # APM-01
                                  sub_appear_prob=sub_appear_prob)  # APM-01
```

Find the `if start_prob == 0.0: return 0.0` (line 944). Change to:

```python
    if start_prob == 0.0:
        return round(sub_appear_prob, 2)   # APM-01
```

Find the `_compute_xpts_fixture(` call (line 963). Add `mins_60_prob=mins_60_prob`:

```python
    result = _compute_xpts_fixture(
        xg_per90=blended_xg_per90,
        xa_per90=blended_xa_per90,
        start_prob=start_prob,
        xmins=xmins,
        element_type=element_type,
        defensive_difficulty=difficulty_score,
        cs_prob_base=cs_prob_base,
        cs_prob_slope=cs_prob_slope,
        mins_60_prob=mins_60_prob,   # APM-01
    )
```

- [ ] **Step 9: Extend `build_per_gw_rows` with `sub_appear_window_gws`**

Find `def build_per_gw_rows(` (line 128). Add parameter after `form_difficulty_gamma`:

```python
    form_difficulty_gamma: float = FORM_DIFFICULTY_GAMMA,   # FRM-02
    sub_appear_window_gws: int = SUB_APPEAR_WINDOW_GWS,     # APM-01
```

Also add to the docstring Args block:
```
        sub_appear_window_gws: sub appearance history window (APM-01).
```

Inside the `for gw in target_gws:` loop, before the `xpts_predicted = _reconstruct_xpts(...)` call, add the sub_appear_prob and mins_60_prob computation:

```python
            # APM-01: compute sub appearance prob from prior history
            sub_appear_prob_at_gw = _compute_sub_appear_prob(grouped, gw, sub_appear_window_gws)

            # APM-01: compute mins_60_prob from prior starts
            prior_starts = sorted(
                [agg for r, agg in grouped.items() if r < gw and agg['minutes'] >= 45],
                key=lambda a: a['round'],
            )
            recent_starts = prior_starts[-10:]
            if recent_starts:
                mins_60_prob_at_gw: float | None = (
                    sum(1 for a in recent_starts if a['minutes'] >= 60) / len(recent_starts)
                )
            else:
                mins_60_prob_at_gw = None   # no prior starts → _reconstruct_xpts defaults to 1.0
```

Then update BOTH reconstruction calls to pass the new params:

```python
            xpts_predicted = _reconstruct_xpts(
                entry, element_type, difficulty_score,
                cs_prob_base=cs_prob_base, cs_prob_slope=cs_prob_slope,
                mins_60_prob=mins_60_prob_at_gw,          # APM-01
                sub_appear_prob=sub_appear_prob_at_gw,    # APM-01
            )
```

```python
            xpts_blended_predicted = _reconstruct_xpts_with_form(
                entry, element_type, difficulty_score, form_per90_at_gw,
                blend_alpha=blend_alpha,
                cs_prob_base=cs_prob_base,
                cs_prob_slope=cs_prob_slope,
                mins_60_prob=mins_60_prob_at_gw,          # APM-01
                sub_appear_prob=sub_appear_prob_at_gw,    # APM-01
            )
```

- [ ] **Step 10: Run all accuracy tests**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_accuracy.py -v 2>&1 | Select-Object -Last 20
```

Expected: all pass (baseline count + 4 new APM-01 tests).

- [ ] **Step 11: Run full suite**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/ -q 2>&1 | Select-Object -Last 5
```

Expected: all pass.

- [ ] **Step 12: Commit**

```
git -C C:\Users\jamie\fplx add pipeline/accuracy.py pipeline/tests/test_accuracy.py
git -C C:\Users\jamie\fplx commit -m "feat(apm-01): mirror sub appearance model in accuracy.py reconstruction"
```

---

## Task 4: Add `SUB_APPEAR_WINDOW_GWS` to TUNE-01

**Files:**
- Modify: `pipeline/tune.py`
- Modify: `pipeline/tests/test_tune.py`

### Scene

Identical pattern to FRM-02's `form_difficulty_gamma` (parameter 6). `SUB_APPEAR_WINDOW_GWS` becomes parameter 7. The candidates are `[10, 12, 15, 18, 20]` (5 values). Total sweep evaluations: 47 + 5 = **52 per run**.

- [ ] **Step 1: Write the new failing tests in `test_tune.py`**

**a) Update imports.** Find the `from tune import (...)` block. Add after `FORM_DIFFICULTY_GAMMA_CANDIDATES`:

```python
    FORM_DIFFICULTY_GAMMA_CANDIDATES,
    SUB_APPEAR_WINDOW_CANDIDATES,   # APM-01
```

Find the `from accuracy import ...` line. Add `SUB_APPEAR_WINDOW_GWS` after `FORM_DIFFICULTY_GAMMA`:

```python
from accuracy import build_fixture_difficulty_lookup, FORM_ACTUAL_BETA, FORM_DIFFICULTY_GAMMA, SUB_APPEAR_WINDOW_GWS  # APM-01
```

**b) Update ALL `params` dicts in `TestSweepParam`.** Find both dicts ending in `'form_difficulty_gamma': 0.0`. Add `'sub_appear_window_gws': 15` to each:

```python
        params = {'blend_alpha': 0.4, 'form_window_gws': 5,
                  'cs_prob_base': 0.40, 'cs_prob_slope': 0.30,
                  'form_actual_beta': 0.0, 'form_difficulty_gamma': 0.0,
                  'sub_appear_window_gws': 15}
```

**c) In `TestReadPriorParams`, add:**

```python
    def test_sub_appear_window_default_in_read_prior_params(self, tmp_path):
        """Missing sub_appear_window_gws_used in summary → returns SUB_APPEAR_WINDOW_GWS (15)."""
        data = {'summary': {}}
        (tmp_path / 'accuracy_backtest.json').write_text(json.dumps(data))
        params = _read_prior_params(str(tmp_path))
        assert params['sub_appear_window_gws'] == SUB_APPEAR_WINDOW_GWS
```

**d) In `test_run_tuner_sweep_covers_all_parameters`, add:**

```python
        assert 'sub_appear_window_gws' in sweep
```

**e) In `test_run_tuner_promoted_params_contains_all_params`, add:**

```python
        assert 'sub_appear_window_gws' in pp
```

**f) In `test_coordinate_locking_uses_prior_sweep_value`, add (after the form_difficulty_gamma assertion):**

```python
        assert result['promoted_params']['sub_appear_window_gws'] == result['sweep']['sub_appear_window_gws']['best']
```

Also update docstring from "six sweeps" to "seven sweeps".

**g) In `TestRunTunerFull`, add:**

```python
    def test_sub_appear_window_in_promoted_params(self, tmp_path):
        """promoted_params dict contains sub_appear_window_gws key with value in [10, 20]."""
        summaries, bootstrap, fixtures = _make_summaries_and_bootstrap(n_gws=20)
        result = run_tuner(summaries, 20, bootstrap, fixtures, str(tmp_path))
        pp = result['promoted_params']
        assert 'sub_appear_window_gws' in pp
        assert pp['sub_appear_window_gws'] in [10, 12, 15, 18, 20]
```

- [ ] **Step 2: Run new tests to confirm they fail**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_tune.py -k "sub_appear" -v
```

Expected: ImportError — `SUB_APPEAR_WINDOW_CANDIDATES` not in tune.py yet.

- [ ] **Step 3: Update `tune.py` imports from accuracy**

Find the `from accuracy import (...)` block. Add `SUB_APPEAR_WINDOW_GWS` after `FORM_DIFFICULTY_GAMMA`:

```python
    FORM_DIFFICULTY_GAMMA,   # FRM-02
    SUB_APPEAR_WINDOW_GWS,   # APM-01
```

- [ ] **Step 4: Add candidates constant**

Find `FORM_DIFFICULTY_GAMMA_CANDIDATES = [...]`. Add immediately after:

```python
FORM_DIFFICULTY_GAMMA_CANDIDATES = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]  # FRM-02
SUB_APPEAR_WINDOW_CANDIDATES = [10, 12, 15, 18, 20]                  # APM-01
```

- [ ] **Step 5: Update `_read_prior_params` — BOTH return paths**

Find the try-block return. Add after `'form_difficulty_gamma': ...`:

```python
            'sub_appear_window_gws':  int(summary.get('sub_appear_window_gws_used', SUB_APPEAR_WINDOW_GWS)),  # APM-01
```

Find the except-block return. Add after `'form_difficulty_gamma': FORM_DIFFICULTY_GAMMA`:

```python
            'sub_appear_window_gws': SUB_APPEAR_WINDOW_GWS,   # APM-01
```

- [ ] **Step 6: Update `params` dict in `run_tuner`**

Find the `params = {` block. Add after `'form_difficulty_gamma': ...`:

```python
        'sub_appear_window_gws': prior['sub_appear_window_gws'],   # APM-01
```

- [ ] **Step 7: Add 7th entry to `sweep_order`**

Find `sweep_order = [`. Add after the `form_difficulty_gamma` entry:

```python
        ('sub_appear_window_gws', SUB_APPEAR_WINDOW_CANDIDATES, prior['sub_appear_window_gws']),  # APM-01
```

- [ ] **Step 8: Add `sub_appear_window_gws` to BOTH `build_per_gw_rows` calls in `_sweep_param`**

Find the baseline `build_per_gw_rows(` call. Add after `form_difficulty_gamma=params['form_difficulty_gamma']`:

```python
        form_difficulty_gamma=params['form_difficulty_gamma'],
        sub_appear_window_gws=params['sub_appear_window_gws'],   # APM-01
```

Find the candidate `build_per_gw_rows(` call. Add similarly:

```python
            form_difficulty_gamma=candidate_params['form_difficulty_gamma'],
            sub_appear_window_gws=candidate_params['sub_appear_window_gws'],   # APM-01
```

- [ ] **Step 9: Update `_read_prior_params` docstring**

Find the docstring for `_read_prior_params`. Update the list of keys to include `sub_appear_window_gws`.

- [ ] **Step 10: Run all tune tests**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/test_tune.py -v 2>&1 | Select-Object -Last 25
```

Expected: all pass.

- [ ] **Step 11: Commit**

```
git -C C:\Users\jamie\fplx add pipeline/tune.py pipeline/tests/test_tune.py
git -C C:\Users\jamie\fplx commit -m "feat(apm-01): add SUB_APPEAR_WINDOW_GWS as parameter 7 in tune.py coordinate descent"
```

---

## Task 5: Wire `sub_appear_window_gws` through `run.py`

**Files:**
- Modify: `pipeline/run.py`
- Modify: `pipeline/tests/test_run.py`

### Scene

Identical read/init/pass/write pattern to all previous TUNE-01 parameters. Four changes in `run.py` + two print-line updates. `test_run.py`'s `_read_tuner_params` helper and both contract tests get extended.

- [ ] **Step 1: Initialise `sub_appear_window_gws_used` before the try block**

Find the line:

```python
            form_difficulty_gamma_used = accuracy.FORM_DIFFICULTY_GAMMA  # FRM-02: default
```

Add immediately after:

```python
            sub_appear_window_gws_used = accuracy.SUB_APPEAR_WINDOW_GWS  # APM-01: default
```

- [ ] **Step 2: Read from prior summary inside the try block**

Find:

```python
                form_difficulty_gamma_used = float(prev_backtest.get('summary', {}).get('form_difficulty_gamma_used', accuracy.FORM_DIFFICULTY_GAMMA))  # FRM-02
```

Add immediately after:

```python
                sub_appear_window_gws_used = int(prev_backtest.get('summary', {}).get('sub_appear_window_gws_used', accuracy.SUB_APPEAR_WINDOW_GWS))  # APM-01
```

- [ ] **Step 3: Update the TUNE-01 print line**

Find the print that includes `form_difficulty_gamma={form_difficulty_gamma_used}`. Extend it:

```python
            print(f"TUNE-01 params: ..., form_difficulty_gamma={form_difficulty_gamma_used}, sub_appear_window_gws={sub_appear_window_gws_used}")
```

(Keep all existing params in the print, just append the new one.)

- [ ] **Step 4: Pass to `merge_players`**

Find the `merge_players(...)` call. After `form_difficulty_gamma=form_difficulty_gamma_used`, add:

```python
                form_difficulty_gamma=form_difficulty_gamma_used, # FRM-02
                sub_appear_window_gws=sub_appear_window_gws_used, # APM-01
```

- [ ] **Step 5: Write promoted value back to summary**

Find:

```python
                    backtest_data['summary']['form_difficulty_gamma_used'] = pp['form_difficulty_gamma']  # FRM-02
```

Add immediately after:

```python
                    backtest_data['summary']['sub_appear_window_gws_used'] = pp['sub_appear_window_gws']  # APM-01
```

- [ ] **Step 6: Update the `[tune]` print line**

Find the print that includes `form_difficulty_gamma={pp['form_difficulty_gamma']}`. Extend it to also include `sub_appear_window_gws={pp['sub_appear_window_gws']}`.

- [ ] **Step 7: Update `test_run.py` — `_read_tuner_params` helper**

Find `def _read_tuner_params(cache_dir: str) -> dict:`. Make three changes:

**a)** Add `sub_appear_window_gws_used = 15` after `form_difficulty_gamma_used = 0.0`:

```python
    form_difficulty_gamma_used = 0.0
    sub_appear_window_gws_used = 15   # APM-01
```

**b)** After the `form_difficulty_gamma_used = float(summary.get(...))` read line, add:

```python
        form_difficulty_gamma_used = float(summary.get('form_difficulty_gamma_used', 0.0))
        sub_appear_window_gws_used = int(summary.get('sub_appear_window_gws_used', 15))   # APM-01
```

**c)** Add to the returned dict:

```python
    return {
        'form_window_gws_used': form_window_gws_used,
        'cs_prob_base_used':    cs_prob_base_used,
        'cs_prob_slope_used':   cs_prob_slope_used,
        'form_actual_beta_used': form_actual_beta_used,
        'form_difficulty_gamma_used': form_difficulty_gamma_used,
        'sub_appear_window_gws_used': sub_appear_window_gws_used,   # APM-01
    }
```

- [ ] **Step 8: Update both contract tests**

In `test_read_tuner_params_defaults_on_missing_file`, add:

```python
        assert params['sub_appear_window_gws_used'] == 15
```

In `test_read_tuner_params_reads_promoted_values`, add `'sub_appear_window_gws_used': 12` to the data dict:

```python
        data = {'summary': {
            'form_window_gws_used': 4,
            'cs_prob_base_used': 0.45,
            'cs_prob_slope_used': 0.25,
            'form_actual_beta_used': 0.3,
            'form_difficulty_gamma_used': 0.4,
            'sub_appear_window_gws_used': 12,   # APM-01
        }}
```

And add the assertion:

```python
        assert params['sub_appear_window_gws_used'] == 12
```

- [ ] **Step 9: Run all pipeline tests**

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/ -q 2>&1 | Select-Object -Last 5
```

Expected: all pass.

- [ ] **Step 10: Commit**

```
git -C C:\Users\jamie\fplx add pipeline/run.py pipeline/tests/test_run.py
git -C C:\Users\jamie\fplx commit -m "feat(apm-01): wire sub_appear_window_gws through run.py (read/pass/write)"
```

---

## Self-Review Checklist

After all 5 tasks are complete, run the full test suite one final time:

```
cd C:\Users\jamie\fplx\pipeline && python -m pytest tests/ -v 2>&1 | Select-Object -Last 20
```

Confirm:
- All tests pass
- `test_appearance_pts_formula` (old test, no `mins_60_prob`) still passes — backward compat with `None → 1.0`
- `test_sub_appear_prob_sparse_history` passes — denominator is actual entries
- `test_reconstruct_xpts_sub_appearance_returns_sub_appear_prob` passes — sub appearances return sub_appear_prob
- `test_coordinate_locking_uses_prior_sweep_value` passes — 7th sweep param verified
