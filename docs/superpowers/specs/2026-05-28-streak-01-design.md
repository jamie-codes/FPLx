# STREAK-01: Seasonal Streak / Form Run Detector — Design

## Goal

Surface two complementary momentum signals in GemTable: a `Streak` column showing how many consecutive recent starts a player has returned points above a position-specific threshold, and a `ΔForm` column showing whether the player is currently above or below their own seasonal scoring baseline. Together they identify players entering a scoring run versus players whose form is cooling.

## Background

The codebase already has several form-adjacent signals:
- `form_score` — normalised pts/90 over last 5 GWs (a slow-moving composite)
- `rank_trajectory` (SPARK-01) — position-relative percentile sparkline over 5 GWs
- `pts_last3gw` / `pts_last5gw` — raw point sums
- `cons_rate` (FLOOR-01) — % of last 10 starts returning threshold pts (long-window reliability)

STREAK-01 fills a different gap: **current momentum**. `cons_rate` tells you a player is reliable over the season; `Streak` tells you they are on a run *right now*. `ΔForm` tells you whether the last 5 starts are above or below their own baseline — catching players who have genuinely shifted into a higher gear, not just players who were always good.

## Architecture

Four files changed:

| File | Action |
|------|--------|
| `pipeline/merge.py` | Add `_compute_streak()` + `_compute_form_delta()` helpers; write `streak` and `form_delta` to player dict |
| `src/lib/types.ts` | Add `streak?: number \| null` and `form_delta?: number \| null` to `ScoredPlayer` |
| `src/components/gem-table/columns.tsx` | Add `Streak` and `ΔForm` inline accessor columns |
| `src/components/gem-table/GwToggle.tsx` | Hide both on mobile and in compact preset |

### Data flow

```
summaries[fpl_id]['history']
  → _compute_streak(history, element_type)   → streak: int | None
  → _compute_form_delta(history)             → form_delta: float | None
  → player['streak'], player['form_delta']
  → merged_players.json
  → columns.tsx inline renderers
```

Both helpers read the same `history` list already fetched for FLOOR-01 and form signal. No new API calls or data sources.

## Algorithm

### `_compute_streak`

```python
def _compute_streak(history: list, element_type: int) -> int | None:
    """Count of consecutive most-recent starts returning >= position threshold.

    Returns None when no starts exist in history.
    Returns 0 when the most recent start missed the threshold.
    Reuses CONSISTENCY_THRESHOLD from FLOOR-01.
    """
    threshold = CONSISTENCY_THRESHOLD.get(element_type, 5)
    starts = [h for h in history if h.get('starts') == 1]
    if not starts:
        return None
    streak = 0
    for h in reversed(starts):
        if h.get('total_points', 0) >= threshold:
            streak += 1
        else:
            break
    return streak
```

### `_compute_form_delta`

```python
def _compute_form_delta(history: list) -> float | None:
    """Last-5-starts avg pts minus season avg pts per start.

    Positive = currently above own seasonal baseline (hot streak).
    Negative = currently below baseline (cold run).
    Returns None when fewer than 6 starts exist (need at least one
    start outside the last-5 window for a meaningful comparison).
    """
    starts = [h for h in history if h.get('starts') == 1]
    if len(starts) < 6:
        return None
    season_avg = sum(h.get('total_points', 0) for h in starts) / len(starts)
    last5_avg = sum(h.get('total_points', 0) for h in starts[-5:]) / 5
    return round(last5_avg - season_avg, 2)
```

Called in the player-building loop after the consistency rate block:

```python
if summaries and fpl_id in summaries:
    streak_history = summaries[fpl_id].get('history', [])
    streak = _compute_streak(streak_history, element['element_type'])
    form_delta = _compute_form_delta(streak_history)
else:
    streak = None
    form_delta = None
player['streak'] = streak
player['form_delta'] = form_delta
```

### Position thresholds

Reuses `CONSISTENCY_THRESHOLD` from FLOOR-01 — no new constants.

| Position | Code | Threshold |
|----------|------|-----------|
| GK | 1 | ≥ 6 pts |
| DEF | 2 | ≥ 6 pts |
| MID | 3 | ≥ 5 pts |
| FWD | 4 | ≥ 5 pts |

### Edge cases

| Scenario | `streak` | `form_delta` |
|---|---|---|
| No starts in history | `None` → `—` | `None` → `—` |
| Fewer than 6 starts total | count from last start | `None` → `—` |
| Last start missed threshold | `0` | computed normally |
| Long scoring run (e.g. 15 straight) | `15` | computed normally |
| New / promoted player | `None` or small int | `None` |
| All bench entries | `None` | `None` |

## Column Rendering

### `Streak` column

```typescript
col.accessor('streak', {
  header: H('Streak', 'Consecutive starts returning ≥ position threshold (GK/DEF ≥ 6 pts, MID/FWD ≥ 5 pts). 0 = streak broken last start. Blank = no starts on record.'),
  cell: (info) => {
    const v = info.getValue()
    if (v == null) return <span className="text-zinc-400">—</span>
    const cls = v >= 3 ? 'text-emerald-400' : v >= 1 ? 'text-zinc-100' : 'text-zinc-500'
    return <span className={cls}>{v}</span>
  },
  enableSorting: true,
})
```

Colour bands: ≥ 3 emerald (hot run), 1–2 white (active but short), 0 muted grey (streak broken).

### `ΔForm` column

```typescript
col.accessor('form_delta', {
  header: H('ΔForm', 'Last 5 starts avg pts minus season avg pts per start. Positive = currently above own baseline. Blank = fewer than 6 starts on record.'),
  cell: (info) => {
    const v = info.getValue()
    if (v == null) return <span className="text-zinc-400">—</span>
    const cls = v > 0.5 ? 'text-emerald-400' : v < -0.5 ? 'text-red-400' : 'text-zinc-100'
    const sign = v > 0 ? '+' : ''
    return <span className={cls}>{sign}{v.toFixed(1)}</span>
  },
  enableSorting: true,
})
```

Colour bands: > +0.5 emerald (heating up), < −0.5 red (cooling off), within ±0.5 white (on baseline). Sign prefix (`+3.2`, `−1.5`) makes direction immediately readable.

Both columns hidden on mobile and in compact preset via `GwToggle.tsx`.

## Testing

### `pipeline/tests/test_merge_streak.py` (new)

`_compute_streak` unit tests:
- 4 consecutive qualifying starts → `4`
- streak broken on last start → `0`
- mixed run: 3 qualifying, 1 miss, 2 qualifying → `2` (counts from most recent only)
- `element_type=2` (DEF), threshold 6 — a 5-pt start breaks the streak
- `element_type=1` (GK), threshold 6
- no starts in history → `None`
- all bench entries (starts=0) → `None`

`_compute_form_delta` unit tests:
- 10 starts, last 5 avg = 8.0, season avg = 5.0 → `+3.0`
- 10 starts, last 5 avg = 3.0, season avg = 6.0 → `−3.0`
- last 5 = season avg → `0.0`
- fewer than 6 starts → `None`
- exactly 6 starts → computed (not `None`)

### `pipeline/tests/test_merge_streak_integration.py` (new)

- Player with 8 starts all returning threshold → `streak` and `form_delta` written to player dict with correct values
- Player with no summaries → both `streak` and `form_delta` are `None` in player dict

### `src/components/gem-table/columns.test.tsx` (additions)

`Streak` column:
- `streak=5` → `"5"` with `text-emerald-400`
- `streak=1` → `"1"` with `text-zinc-100`
- `streak=0` → `"0"` with `text-zinc-500`
- `streak=null` → `"—"`

`ΔForm` column:
- `form_delta=2.5` → `"+2.5"` with `text-emerald-400`
- `form_delta=-1.8` → `"-1.8"` with `text-red-400`
- `form_delta=0.2` → `"+0.2"` with `text-zinc-100`
- `form_delta=null` → `"—"`

## Files Changed

| File | Action |
|------|--------|
| `pipeline/merge.py` | Modify: add `_compute_streak()` + `_compute_form_delta()` + calls in player loop |
| `pipeline/tests/test_merge_streak.py` | Create: 12 unit tests |
| `pipeline/tests/test_merge_streak_integration.py` | Create: 2 integration tests |
| `src/lib/types.ts` | Modify: add `streak?: number \| null` and `form_delta?: number \| null` |
| `src/components/gem-table/columns.tsx` | Modify: add `Streak` and `ΔForm` columns |
| `src/components/gem-table/GwToggle.tsx` | Modify: hide `streak` and `form_delta` on mobile and compact |
| `src/components/gem-table/columns.test.tsx` | Modify: add 8 column tests |
