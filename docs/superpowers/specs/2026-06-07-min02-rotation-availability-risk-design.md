# MIN-02: Fixture-Aware Rotation Risk & Availability Classification

**Feature ID:** MIN-02  
**Date:** 2026-06-07  
**Status:** Approved

---

## Goal

Improve xmins accuracy by applying two per-player, per-gameweek adjustment signals — a fixture-aware rotation risk derived from historical minutes-by-difficulty-band, and an availability risk classified from FPL status and existing news text. Both signals adjust xmins (and therefore xPts) automatically, and are surfaced as visible risk chips in GemTable, OpportunityCostTable, and WildcardBuilderTab.

---

## Architecture

Three layers following the existing pipeline → blob → UI pattern:

```
pipeline/xmins.py          ← rotation risk model (extended)
pipeline/news_classifier.py ← availability classifier (new)
        │
        ▼
players.json blob
  rotation_risk: 'low' | 'medium' | 'high' | 'unknown'
  availability_risk: 'out' | 'doubt' | 'fit' | 'unknown'
        │
        ▼
src/components/shared/RiskChip.tsx      ← new shared component
src/components/gem-table/ MinsRiskBadge  ← extended
src/components/planner/OpportunityCostTable.tsx ← inline chip
src/components/optimiser/WildcardBuilderTab.tsx ← inline chip
```

**New files:**
- `pipeline/news_classifier.py`
- `pipeline/news_classifier.test.py`
- `src/components/shared/RiskChip.tsx`
- `src/components/shared/RiskChip.test.tsx`

**Modified files:**
- `pipeline/xmins.py` — add `compute_rotation_risk()`, apply combined adjustment
- `pipeline/xmins.test.py` — extend with rotation + combined adjustment tests
- `pipeline/merge.py` — pass `xmins_adjusted` instead of `xmins` to `_compute_xpts_fixture()`
- `src/lib/types.ts` — add `rotation_risk?` and `availability_risk?` to `Player`
- `src/components/shared/MinsRiskBadge.tsx` — render both chips
- `src/components/planner/OpportunityCostTable.tsx` — inline `RiskChip`
- `src/components/optimiser/WildcardBuilderTab.tsx` — inline `RiskChip`

---

## Pipeline — Rotation Risk Model

**Function:** `compute_rotation_risk(player_history, fixtures, next_gw_fixture)` in `pipeline/xmins.py`

**Inputs:**
- `player_history`: FPL per-GW history (`element-summary/{id}/`) — minutes, opponent_team, was_home, round
- `fixtures`: fixture FDR from bootstrap (already in pipeline)
- `next_gw_fixture`: the player's next gameweek fixture (opponent FDR, home/away)

**Logic:**

1. Bin each historical game into one of 6 buckets: `{easy, medium, hard} × {home, away}` based on opponent FDR:
   - Easy: FDR 1–2
   - Medium: FDR 3
   - Hard: FDR 4–5

2. Compute average minutes per bucket (minimum 3 games required per bucket; fall back to player unconditional average if sparse)

3. Look up the next GW fixture's bucket → `avg_minutes_for_bucket`

4. Compare to player's unconditional average (`avg_minutes_all`):
   - `ratio = avg_minutes_for_bucket / avg_minutes_all`
   - `ratio ≥ 0.90` → `low`, `rotation_factor = 1.00`
   - `0.75 ≤ ratio < 0.90` → `medium`, `rotation_factor = 0.87`
   - `ratio < 0.75` → `high`, `rotation_factor = 0.75`

5. **Fallback:** Fewer than 5 total historical games → `rotation_risk = 'unknown'`, `rotation_factor = 1.00` (no penalty for new or data-sparse players)

**Output per player:** `rotation_risk_next_gw: str`, `rotation_factor: float`

---

## Pipeline — Availability Classifier

**File:** `pipeline/news_classifier.py` (new, pure functions, no side effects, no API calls)

**Inputs per player:**
- FPL `status`: `'a' | 'd' | 's' | 'u' | 'i'`
- FPL `chance_of_playing_next_round`: `int | None` (0–100)
- News text string from existing `transfer_news` data

**Classification logic (priority order):**

1. `status == 'i'` or `chance == 0` → `out`, factor `0.0`
2. `chance` is set and `> 0`:
   - `chance ≥ 75` → `fit`, factor `1.0`
   - `25 ≤ chance < 75` → `doubt`, factor `0.5`
   - `chance < 25` → `out`, factor `0.0`
3. `chance` is null — keyword scan of news text:
   - **out** keywords: `"ruled out"`, `"unavailable"`, `"will miss"`, `"withdrawn"` → `out`, factor `0.0`
   - **doubt** keywords: `"doubt"`, `"50/50"`, `"fitness test"`, `"assessed"`, `"knock"`, `"slight concern"` → `doubt`, factor `0.5`
   - **fit** keywords: `"fit"`, `"available"`, `"returned to training"`, `"fully fit"` → `fit`, factor `1.0`
   - No match / no news → `unknown`, factor `1.0`

**Key rule:** FPL's `chance_of_playing` always takes priority over keyword inference. Keywords are the fallback for players where FPL hasn't yet updated their status.

**Output per player:** `availability_risk: str`, `availability_factor: float`

---

## xmins Adjustment & Output Fields

**Combined xmins adjustment in `pipeline/xmins.py`:**

```python
xmins_adjusted = xmins_base * rotation_factor * availability_factor
```

`xmins_adjusted` replaces `xmins` wherever `merge.py` passes minutes into `_compute_xpts_fixture()`. The xPts formula itself is unchanged — the improvement flows through automatically.

**New fields written to `players.json` per player:**

| Field | Type | Description |
|---|---|---|
| `rotation_risk` | `'low' \| 'medium' \| 'high' \| 'unknown'` | Next-GW fixture-specific rotation risk |
| `availability_risk` | `'out' \| 'doubt' \| 'fit' \| 'unknown'` | Current availability based on FPL status + news |

Both fields are optional (`?`) in `src/lib/types.ts` for backward compatibility — UI components fall back to `'unknown'` when absent.

These fields are **next-GW specific** (recomputed each pipeline run). They complement the existing `Start%` / `60+%` columns, which remain as historical baselines.

**`src/lib/types.ts` addition:**

```typescript
rotation_risk?: 'low' | 'medium' | 'high' | 'unknown'
availability_risk?: 'out' | 'doubt' | 'fit' | 'unknown'
```

---

## UI — Shared `RiskChip` Component

**File:** `src/components/shared/RiskChip.tsx`

**Props:**
```typescript
interface RiskChipProps {
  rotationRisk?: 'low' | 'medium' | 'high' | 'unknown'
  availabilityRisk?: 'out' | 'doubt' | 'fit' | 'unknown'
}
```

**Rendering rules:**
- `rotation_risk = 'high'` → red chip `↻ HIGH`; `'medium'` → amber chip `↻ MED`; `'low'` or `'unknown'` → nothing
- `availability_risk = 'out'` → red chip `✕ OUT`; `'doubt'` → amber chip `⚠ DOUBT`; `'fit'` or `'unknown'` → nothing
- Both absent/low/unknown → renders `null` (no visual noise for clean players)
- Both signals present → stacked vertically

Chips use the existing Tailwind colour conventions: red = `text-red-600 bg-red-50 dark:bg-red-950`, amber = `text-amber-600 bg-amber-50 dark:bg-amber-950`.

---

## UI — GemTable (`MinsRiskBadge`)

The existing `MinsRiskBadge` at `src/components/shared/MinsRiskBadge.tsx` (MIN-01) is extended to render both chips. No new column added — same cell, new content.

**Tooltip (existing `title` attribute pattern):** e.g. *"Rotation risk: HIGH (avg 52 min in easy home fixtures vs 78 min overall). Availability: DOUBT (FPL 50% chance of playing)"*

---

## UI — Transfer & Optimiser Context

**`OpportunityCostTable`** — compact risk chip immediately after player name on the same row, rendered only when `availability_risk` is `'out'` or `'doubt'`, OR `rotation_risk` is `'high'`. Low/medium rotation and fit/unknown availability → no chip.

```
Salah  [ ⚠ DOUBT ]  £13.2m  xPts 7.4  HOLD 3GW
```

**`WildcardBuilderTab`** squad card player rows — icon-only chip with tooltip (denser layout):

```
Salah ⚠  →  hover: "Doubt — 50% chance of playing (FPL)"
Haaland ↻  →  hover: "High rotation risk in easy home fixtures"
```

**No changes to `ManualPlanTab`** — explicit user input, risk signals are noise there.

All three surfaces consume the shared `<RiskChip>` component.

---

## Error Handling

- **Missing `transfer_news` data for a player:** classifier returns `'unknown'`, factor `1.0` — no penalty.
- **Fewer than 5 FPL history games:** rotation risk returns `'unknown'`, factor `1.0`.
- **Missing `rotation_risk` / `availability_risk` in blob** (old pipeline output): UI components treat as `'unknown'`, render nothing.
- **`chance_of_playing` is null and no news text:** returns `'unknown'`, factor `1.0`.

---

## Testing

### `pipeline/news_classifier.test.py`

| Test | Assertion |
|---|---|
| `status='i'` → `out`, factor `0.0` | FPL status priority |
| `chance=75` → `fit`, factor `1.0` | Numeric chance mapping |
| `chance=50` → `doubt`, factor `0.5` | Mid-range |
| `chance=0` → `out`, factor `0.0` | Zero chance |
| `chance=null`, news "ruled out" → `out` | Keyword fallback |
| `chance=null`, news "doubt" → `doubt` | Keyword fallback |
| `chance=null`, news "fit" → `fit` | Keyword fallback |
| `chance=null`, no news → `unknown`, factor `1.0` | No-data fallback |
| `chance=100` + "doubt" news → `fit` | FPL priority over keyword |

### `pipeline/xmins.test.py` (extended)

| Test | Assertion |
|---|---|
| Easy home fixtures → lower avg minutes → `high` | Bucket lookup |
| Fewer than 3 games in bucket → falls back to player average | Sparse bucket fallback |
| Fewer than 5 total games → `unknown`, factor `1.0` | New player fallback |
| `xmins_adjusted = xmins_base × rotation_factor × availability_factor` | Combined formula |
| `availability_factor=0.0` → `xmins_adjusted=0` regardless of rotation | Out player zeroed |

### `src/components/shared/RiskChip.test.tsx`

| Test | Assertion |
|---|---|
| `rotationRisk='high'` → renders `↻ HIGH` | Present |
| `rotationRisk='low'` → renders nothing | No clutter |
| `availabilityRisk='out'` → renders `✕ OUT` | Present |
| Both low/unknown → renders nothing | Clean player |
| Both `'high'` and `'out'` → renders both chips | Stacked |
