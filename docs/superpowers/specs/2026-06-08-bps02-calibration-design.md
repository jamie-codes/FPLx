# BPS-02: BPS Calibration Curve for Bonus EV

**Feature ID:** BPS-02  
**Date:** 2026-06-08  
**Status:** Approved

---

## Goal

Improve bonus point EV accuracy and stability by replacing the direct position-prior shrinkage (on bonus points) with a two-pass approach: shrink per-player average BPS toward a position BPS prior, then project through a global BPS→bonus calibration curve fitted from all qualifying players.

---

## Architecture

The change is entirely inside `pipeline/bonus.py`. No changes to `run.py`, `merge.py` (beyond one new field), or the frontend — `bonus_ev` remains the output field, same type, same units.

Two-pass computation:
- **Pass 1:** `build_bps_calibration(summaries, bootstrap)` → `(slope, intercept) | None`
- **Pass 2:** `_compute_player_bonus_ev(element, summary, calibration)` → `{bonus_ev, avg_bps, n_starts, source}`

New field: `avg_bps` (float) — raw pre-shrinkage average BPS per start, for observability.

**Modified files:**
- `pipeline/bonus.py` — two-pass rewrite
- `pipeline/tests/test_bonus.py` — extended tests
- `pipeline/merge.py` — one new line writing `avg_bps`
- `src/lib/types.ts` — one optional field `avg_bps?: number`

---

## Pass 1 — Calibration Algorithm

`build_bps_calibration(summaries, bootstrap)` collects one data point per player: `(avg_bps_per_start, avg_bonus_per_start)` over all history games where `starts == 1`. Players with fewer than 4 starts are excluded.

**Fit:** Ordinary least squares using `statistics.mean` and a manual covariance/variance pass — no scipy dependency:

```python
slope = Σ((bps_i - bps̄)(bonus_i - bonus̄)) / Σ((bps_i - bps̄)²)
intercept = bonus̄ - slope * bps̄
```

**Fallback:** If fewer than 20 players qualify (early season, sparse data), returns `None`. Per-player function detects `calibration is None` and falls back to position-prior-only shrinkage — identical to current behaviour.

**Output:** `(slope, intercept) | None` — plain tuple, no new class.

---

## Pass 2 — Per-Player Computation

`_compute_player_bonus_ev(element, summary, calibration)`:

**Step 1: compute avg_bps.**  
Scan `summary['history']` for games where `starts == 1`, collect `bps` values. Count as `n_starts`. If `n_starts < 4`, skip to fallback (prior path).

**Step 2: shrink toward BPS position prior.**

```python
BPS_POSITION_PRIOR = {1: 18, 2: 20, 3: 22, 4: 24}  # avg BPS per start by position

w = min(1.0, n_starts / 12)
smoothed_bps = w * avg_bps + (1 - w) * BPS_POSITION_PRIOR[element_type]
```

Same 12-start full-weight schedule as today, applied to BPS instead of bonus points directly.

**Step 3: project through calibration curve.**

```python
if calibration is not None:
    slope, intercept = calibration
    bonus_ev_raw = slope * smoothed_bps + intercept
else:
    # fallback: scale by position prior ratio
    bonus_ev_raw = smoothed_bps * (POSITION_PRIOR[element_type] / BPS_POSITION_PRIOR[element_type])
```

**Step 4: CS residualisation** (unchanged).  
GK/DEF: `bonus_ev = max(0, bonus_ev_raw - 0.5 * cs_rate)`. All other positions: `bonus_ev = bonus_ev_raw`.

**`source` values:**
- `'learned_calibrated'` — calibration available, n_starts ≥ 4
- `'learned_uncalibrated'` — calibration is None, n_starts ≥ 4
- `'prior'` — n_starts < 4

The existing `'learned'` value is retired and replaced by the two new values above. No frontend code reads `source`.

---

## Output & Backward Compatibility

`compute_bonus_ev()` return dict gains one new key:

```python
{
    'bonus_ev': float,   # unchanged
    'n_starts': int,     # unchanged
    'source': str,       # values extended (see above)
    'avg_bps': float | None,  # BPS-02: None for prior-only players
}
```

**`pipeline/merge.py`** — one new line:
```python
player['avg_bps'] = bev.get('avg_bps')  # BPS-02, None for prior-only players
```

**`src/lib/types.ts`** — one optional addition to `MergedPlayer`:
```typescript
avg_bps?: number  // BPS-02 observability field
```

`bonus_ev` continues to flow into `_compute_xpts_fixture()` unchanged. xPts formula untouched.

---

## Testing

All tests in `pipeline/tests/test_bonus.py` (extending the existing file).

### `build_bps_calibration` tests

| Test | Assertion |
|---|---|
| 25 players with known avg_bps/avg_bonus pairs | slope and intercept match manual OLS calculation |
| Fewer than 20 qualifying players | returns `None` |
| Players with < 4 starts excluded from calibration data | only qualifying players contribute to fit |

### `_compute_player_bonus_ev` tests

| Test | Assertion |
|---|---|
| n_starts ≥ 12, calibration available | `source == 'learned_calibrated'`, `bonus_ev` matches expected curve output |
| n_starts = 6 (partial shrinkage) | `smoothed_bps` is between `avg_bps` and `BPS_POSITION_PRIOR[pos]` |
| n_starts < 4 | `source == 'prior'`, `avg_bps` is `None` |
| calibration is `None`, n_starts ≥ 4 | `source == 'learned_uncalibrated'` |
| GK with cs_rate = 0.4 | `bonus_ev` is reduced relative to raw curve output |
| High-BPS player vs low-BPS peer (same position) | higher BPS → higher `bonus_ev` (calibration monotone) |
| `avg_bps` field present in output when n_starts ≥ 4 | observability field populated |

### Regression guard

Existing bonus tests for the position-prior path (`n_starts < 4`) remain passing — the prior branch is functionally identical to the current implementation.
