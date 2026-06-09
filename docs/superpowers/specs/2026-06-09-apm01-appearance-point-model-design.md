# APM-01: Appearance Point Model

**Feature ID:** APM-01  
**Date:** 2026-06-09  
**Status:** Approved

---

## Goal

Replace the current `appearance_pts = start_prob × 2` formula with a two-component model that correctly accounts for (a) the probability of playing ≥60 minutes and (b) substitute appearances:

```
appearance_pts = start_prob × (1 + mins_60_prob) + sub_appear_prob
```

The current formula implicitly assumes every starter plays ≥60 minutes and earns the full 2 points. Rotation-risk players and frequent substitutes are systematically mis-priced. The improved formula uses `mins_60_prob` (already computed by `xmins.py`) and a new `sub_appear_prob` (probability of coming on as a substitute in any given fixture).

---

## Component Breakdown

| Component | What it models | FPL points earned |
|---|---|---|
| `start_prob × mins_60_prob` | P(starts AND plays ≥60 min) | 2 pts |
| `start_prob × (1 − mins_60_prob)` | P(starts but subbed off before 60 min) | 1 pt |
| `sub_appear_prob` | P(comes on as a substitute) | 1 pt |

**Combined:** `start_prob × (1 + mins_60_prob) + sub_appear_prob × 1`

---

## Architecture

Pipeline-only change. No new output fields, no `types.ts` changes, no UI changes. `xPts_1gw`, `xPts_3gw`, `xPts_5gw` continue to carry the (now more accurate) appearance contribution. `xPts_components_1gw['appearance_pts']` reflects the new value.

`sub_appear_prob` is computed in `xmins.py` over a configurable `sub_appear_window_gws` window (default 15). This window is **TUNE-01 parameter 7**, tuned via coordinate descent.

**"Sub appearance" definition:** A history entry where `0 < minutes < 45`. This reuses the existing 45-minute "started" proxy used in `accuracy.py`. Entries are counted at the individual fixture level (not GW-aggregated rounds), so a DGW where a player subbed in for both fixtures counts as 2 sub appearances.

**`sub_appear_prob` is not difficulty-adjusted** — substitute role is a squad-selection decision independent of opponent strength.

**Backward compatibility:** For a player who reliably plays 90 minutes (`mins_60_prob ≈ 1.0`, `sub_appear_prob ≈ 0.0`): `appearance_pts ≈ start_prob × 2` (equivalent to the old formula). The change is unconditional — unlike FRM-01/FRM-02 there is no `gamma=0.0` no-op default. This is intentional: `mins_60_prob` was already computed but unused for appearance points; applying it is a correction, not a new behaviour mode.

**Modified files:**
- `pipeline/xmins.py` — `compute_xmins_stats` gains `sub_appear_window_gws` param; outputs `sub_appear_prob`
- `pipeline/merge.py` — formula change in `_compute_xpts_fixture`; `merge_players` gains `sub_appear_window_gws`
- `pipeline/accuracy.py` — `SUB_APPEAR_WINDOW_GWS` constant; `_group_history_by_gw` tracks `sub_appear_n`; new `_compute_sub_appear_prob` helper; `_reconstruct_xpts` and `build_per_gw_rows` extended
- `pipeline/tune.py` — `SUB_APPEAR_WINDOW_GWS` as parameter 7 in coordinate descent
- `pipeline/run.py` — read/init/pass/write `sub_appear_window_gws_used`
- `pipeline/tests/test_xmins.py` — 4 new tests
- `pipeline/tests/test_merge_xpts_components.py` — 3 new/updated tests
- `pipeline/tests/test_accuracy.py` — 3 new tests
- `pipeline/tests/test_tune.py` — 2 new + 3 updated
- `pipeline/tests/test_run.py` — extend `_read_tuner_params` + both contract tests

---

## `xmins.py` changes

`compute_xmins_stats` gains `sub_appear_window_gws: int = 15`.

```python
# Sub appearance probability (APM-01)
# A "sub appearance" is any history entry where 0 < minutes < 45.
# Computed over the last sub_appear_window_gws entries (at entry level, not GW level).
recent = history[-sub_appear_window_gws:]
sub_n = sum(1 for e in recent if 0 < (e.get('minutes') or 0) < 45)
sub_appear_prob = sub_n / max(len(recent), 1)
```

`sub_appear_prob` is added to the returned dict. No existing keys change.

### `test_xmins.py` tests (4 new)

| Test | Assertion |
|---|---|
| `test_sub_appear_prob_consistent_sub` | Player with 3 sub appearances in last 15 GWs → `sub_appear_prob = 3/15` |
| `test_sub_appear_prob_full_starters` | Player with all entries ≥ 45 minutes → `sub_appear_prob == 0.0` |
| `test_sub_appear_prob_sparse_history` | Player with only 5 history entries → denominator = 5 (actual entries), not 15 |
| `test_sub_appear_prob_dgw_counts_two` | DGW: two entries both with 0 < minutes < 45 → counts as 2 sub appearances |

---

## `merge.py` changes

`_compute_xpts_fixture` gains `sub_appear_prob: float = 0.0`:

```python
# Old
appearance_pts = start_prob * 2

# New (APM-01)
appearance_pts = start_prob * (1 + mins_60_prob) + sub_appear_prob
```

`merge_players` gains `sub_appear_window_gws: int = 15` kwarg, passed to `compute_xmins_stats`. The `sub_appear_prob` value from `xmins_stats` is passed to `_compute_xpts_fixture`:

```python
sub_appear_prob=xmins_stats.get('sub_appear_prob', 0.0),  # APM-01
```

The `.get()` default of `0.0` is safe for old test fixtures that predate this field.

### `test_merge_xpts_components.py` tests (3 new/updated)

| Test | Assertion |
|---|---|
| `test_appearance_pts_full_game_equivalence` | `mins_60_prob=1.0`, `sub_appear_prob=0.0` → `appearance_pts = start_prob × 2` (numerical equality with old formula) |
| `test_appearance_pts_partial_game` | `start_prob=1.0`, `mins_60_prob=0.5`, `sub_appear_prob=0.0` → `appearance_pts = 1.5` |
| `test_appearance_pts_sub_contribution` | `start_prob=0.0`, `sub_appear_prob=0.3` → `appearance_pts = 0.3` |

---

## `accuracy.py` changes

**New constant** (alongside existing form constants):
```python
SUB_APPEAR_WINDOW_GWS = 15  # APM-01: sub appearance history window (default)
```

**`_group_history_by_gw`** gains one new field:
```python
by_round: dict = defaultdict(lambda: {
    ...,
    'sub_appear_n': 0,   # APM-01: entries where 0 < minutes < 45
})
# in the loop (after existing accumulations):
raw_mins = entry.get('minutes') or 0
if 0 < raw_mins < 45:
    agg['sub_appear_n'] += 1
```

**New helper `_compute_sub_appear_prob`:**
```python
def _compute_sub_appear_prob(
    grouped: dict,
    current_gw: int,
    window_gws: int = SUB_APPEAR_WINDOW_GWS,
) -> float:
    """APM-01: compute sub appearance probability from grouped history before current_gw.

    Counts entries where 0 < minutes < 45 across the most recent window_gws
    fixture entries (using difficulty_n from FRM-02 as total-entries-per-round counter).
    Denominator = actual entries seen (not fixed window_gws), matching xmins.py.
    Returns 0.0 if no history.
    """
    prior_rounds = sorted((r for r in grouped if r < current_gw), reverse=True)
    total_entries = 0
    sub_n = 0
    for r in prior_rounds:
        if total_entries >= window_gws:
            break
        agg = grouped[r]
        n = agg.get('difficulty_n', 1)   # entries in this round (1 for SGW, 2 for DGW)
        sub_n += agg.get('sub_appear_n', 0)
        total_entries += n
    if total_entries == 0:
        return 0.0
    return sub_n / total_entries   # actual entries seen — matches xmins.py
```

**`_reconstruct_xpts`** gains `sub_appear_prob: float = 0.0` and applies the same formula change as `merge.py`.

**`build_per_gw_rows`** gains `sub_appear_window_gws: int = SUB_APPEAR_WINDOW_GWS`. For each player per GW, calls `_compute_sub_appear_prob(grouped, gw, sub_appear_window_gws)` and passes the result to `_reconstruct_xpts`.

### `test_accuracy.py` tests (3 new)

| Test | Assertion |
|---|---|
| `test_compute_sub_appear_prob_basic` | 2 sub appearances in 10 entries (window=15) → `2 / 10` (actual entries) |
| `test_compute_sub_appear_prob_empty` | No history before current_gw → `0.0` |
| `test_compute_sub_appear_prob_window_cap` | Only 5 rounds (5 entries) before current_gw → `sub_n / 5` (not `sub_n / 15`) |

---

## `tune.py` changes

```python
from accuracy import (..., SUB_APPEAR_WINDOW_GWS)

SUB_APPEAR_WINDOW_CANDIDATES = [10, 12, 15, 18, 20]  # APM-01
```

`_read_prior_params` both branches gain:
```python
'sub_appear_window_gws': int(summary.get('sub_appear_window_gws_used', SUB_APPEAR_WINDOW_GWS)),
```

`params` dict and `sweep_order` gain the 7th entry:
```python
('sub_appear_window_gws', SUB_APPEAR_WINDOW_CANDIDATES, prior['sub_appear_window_gws']),
```

Both `build_per_gw_rows` calls in `_sweep_param` gain `sub_appear_window_gws=params['sub_appear_window_gws']` / `candidate_params['sub_appear_window_gws']`.

**Total sweep evaluations:** 47 per run (42 existing + 5 new). Expected CI time remains 2–5 seconds.

### `test_tune.py` tests (2 new, 3 updated)

| Test | Change |
|---|---|
| `test_sub_appear_window_default_in_read_prior_params` | New — missing key → returns `SUB_APPEAR_WINDOW_GWS` |
| `test_sub_appear_window_in_promoted_params` | New — `run_tuner` output contains key, value in [10, 20] |
| `test_run_tuner_sweep_covers_all_parameters` | Add `assert 'sub_appear_window_gws' in sweep` |
| `test_run_tuner_promoted_params_contains_all_params` | Add `assert 'sub_appear_window_gws' in pp` |
| `test_coordinate_locking_uses_prior_sweep_value` | Add `sub_appear_window_gws` assertion (7th param); update docstring to "seven sweeps" |

---

## `run.py` changes

Identical read/pass/write pattern to all previous tunable parameters:

```python
sub_appear_window_gws_used = accuracy.SUB_APPEAR_WINDOW_GWS  # APM-01: default before try

# inside try:
sub_appear_window_gws_used = int(
    prev_backtest.get('summary', {}).get('sub_appear_window_gws_used', accuracy.SUB_APPEAR_WINDOW_GWS)
)

# merge_players call:
merge.merge_players(..., sub_appear_window_gws=sub_appear_window_gws_used)

# after run_tuner:
backtest_data['summary']['sub_appear_window_gws_used'] = pp['sub_appear_window_gws']
```

Print lines updated to include `sub_appear_window_gws` in both the startup and `[tune]` output.

### `test_run.py` changes

Extend `_read_tuner_params` helper with `sub_appear_window_gws_used`. Update both contract tests to include `sub_appear_window_gws_used` (default 15, read value 12 in the promoted-values test).
