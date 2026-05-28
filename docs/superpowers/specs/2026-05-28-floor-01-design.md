# FLOOR-01: Consistent Scorer Profile — Design

## Goal

Surface two complementary "safe bet" signals in GemTable: a historical consistency rate (`Cons%`) showing what fraction of recent starts a player returned points above a position-specific threshold, and a forward-looking simulated floor (`Floor`) from the existing MC p10_pts field. Together they let managers quickly identify players who are reliably safe picks rather than boom-or-bust assets.

## Background

`p10_pts` (10th-percentile simulated points) already exists from Phase 102 MC-01 but is only visible in the xPts hover card. FLOOR-01 promotes it to a dedicated sortable column and pairs it with a new historical consistency rate that `p10_pts` cannot capture — a player's actual track record of returning points in real matches.

## Architecture

Four files changed:

| File | Action |
|------|--------|
| `pipeline/merge.py` | Add `_compute_consistency_rate()` helper + write `cons_rate` to player dict |
| `src/lib/types.ts` | Add `cons_rate?: number \| null` to `ScoredPlayer` |
| `src/components/gem-table/columns.tsx` | Add `Cons%` and `Floor` columns (inline renderers) |
| `src/components/gem-table/GwToggle.tsx` | Hide both on mobile and in compact preset |

### Data flow

```
merge.py: _compute_consistency_rate(history, element_type, window=10)
  → cons_rate: float | None written to player dict
  → p10_pts already in player dict (MC simulation, Phase 102)
frontend types: cons_rate?: number | null
columns.tsx: Cons% inline renderer + Floor inline renderer
```

## Consistency Rate Algorithm

```python
CONSISTENCY_THRESHOLD = {1: 6, 2: 6, 3: 5, 4: 5}  # pts needed to "return", by position
CONSISTENCY_MIN_STARTS = 4   # minimum starts required to report a rate (< 4 → None)
CONSISTENCY_WINDOW = 10      # look back over last N starts

def _compute_consistency_rate(
    history: list,
    element_type: int,
    window: int = CONSISTENCY_WINDOW,
) -> float | None:
    """% of recent starts where player returned ≥ position threshold points.

    Returns None when fewer than CONSISTENCY_MIN_STARTS starts exist in window.
    """
    threshold = CONSISTENCY_THRESHOLD.get(element_type, 5)
    starts = [h for h in history if h.get('starts') == 1][-window:]
    if len(starts) < CONSISTENCY_MIN_STARTS:
        return None
    qualifying = sum(1 for h in starts if h.get('total_points', 0) >= threshold)
    return qualifying / len(starts)
```

Called in the player-building loop (alongside `_compute_form_signal`):

```python
if summaries and fpl_id in summaries:
    history = summaries[fpl_id].get('history', [])
    cons_rate = _compute_consistency_rate(history, element['element_type'])
else:
    cons_rate = None
player['cons_rate'] = cons_rate
```

### Position thresholds

| Position | Code | Threshold | Rationale |
|----------|------|-----------|-----------|
| GK | 1 | ≥ 6 pts | CS or multiple saves — meaningful contribution |
| DEF | 2 | ≥ 6 pts | CS-level return — not just appearance points |
| MID | 3 | ≥ 5 pts | Goal or strong assist — breakeven return |
| FWD | 4 | ≥ 5 pts | Goal + something — meaningful contribution |

### Edge cases

| Scenario | Behaviour |
|----------|-----------|
| Fewer than 4 starts in last 10 GWs | `cons_rate = None` → `—` in UI |
| New player / promoted-team player | Same — `None` |
| All history entries have `starts=0` | `None` (no qualifying starts in window) |
| Empty history | `None` |
| Player always returns threshold pts | `1.0` → `100%` |
| Player never returns threshold pts | `0.0` → `0%` |

## Column Rendering

### `Cons%` column

```typescript
col.accessor('cons_rate', {
  header: H('Cons%', 'Consistency rate: % of last 10 starts returning ≥ position threshold (GK/DEF ≥ 6 pts, MID/FWD ≥ 5 pts). Blank = fewer than 4 starts on record.'),
  cell: (info) => {
    const v = info.getValue()
    if (v == null) return <span className="text-zinc-400">—</span>
    const pct = Math.round(v * 100)
    const cls = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-zinc-100' : 'text-zinc-500'
    return <span className={cls}>{pct}%</span>
  },
  enableSorting: true,
})
```

Colour bands: ≥ 70% emerald (reliable), 40–69% normal white, < 40% muted grey.

### `Floor` column

```typescript
col.accessor('p10_pts', {
  header: H('Floor', 'Simulated points floor: 10th-percentile outcome from 10,000 season simulations. Low floor = boom-or-bust; high floor = reliable scorer.'),
  cell: (info) => {
    const v = info.getValue()
    if (v == null) return <span className="text-zinc-400">—</span>
    return <span className="text-zinc-100">{v.toFixed(1)}</span>
  },
  enableSorting: true,
})
```

No colour coding — raw number is self-interpreting (higher = safer). Both columns hidden on mobile and in the compact preset via `GwToggle.tsx`.

## Testing

### `pipeline/tests/test_merge_consistency.py` (new)

- `element_type=3` (MID), 10 starts all ≥ 5 pts → `cons_rate = 1.0`
- `element_type=3`, 6 of 10 starts ≥ 5 pts → `cons_rate = 0.6`
- `element_type=2` (DEF), threshold 6 — a 5-pt start counted as miss
- Fewer than 4 starts in window → `None`
- 15 starts in history → only last 10 counted
- `element_type=1` (GK), threshold 6
- `element_type=4` (FWD), threshold 5
- All history entries have `starts=0` → `None`
- Empty history → `None`

### `pipeline/tests/test_merge_consistency_integration.py` (new)

- Player with 10 starts all returning ≥ threshold → `cons_rate` written to player dict
- Player with no summaries → `cons_rate = None` in player dict

### `src/components/gem-table/columns.test.tsx` (addition)

- `cons_rate=0.75` → renders `75%` with `text-emerald-400`
- `cons_rate=0.50` → renders `50%` with `text-zinc-100`
- `cons_rate=0.30` → renders `30%` with `text-zinc-500`
- `cons_rate=null` → renders `—`
- `p10_pts=4.8` → renders `4.8`
- `p10_pts=null` → renders `—`

## Files Changed

| File | Action |
|------|--------|
| `pipeline/merge.py` | Modify: add `_compute_consistency_rate()` function + call in player loop |
| `pipeline/tests/test_merge_consistency.py` | Create: 9 unit tests for `_compute_consistency_rate` |
| `pipeline/tests/test_merge_consistency_integration.py` | Create: 2 integration tests via `merge_players` |
| `src/lib/types.ts` | Modify: add `cons_rate?: number \| null` to `ScoredPlayer` (note: `p10_pts` already exists) |
| `src/components/gem-table/columns.tsx` | Modify: add `Cons%` and `Floor` columns |
| `src/components/gem-table/columns.test.tsx` | Modify: add 6 column tests |
| `src/components/gem-table/GwToggle.tsx` | Modify: hide `cons_rate` and `p10_pts` on mobile and compact |
