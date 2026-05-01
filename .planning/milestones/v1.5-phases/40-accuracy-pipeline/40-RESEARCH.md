# Phase 40: Accuracy Pipeline - Research

**Researched:** 2026-04-29
**Domain:** Python pipeline extension — backtest computation, prediction snapshotting, JSON output
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use both approaches: (1) historical reconstruction using `history[]` for the last 5 completed GWs now; (2) prediction snapshotting — each future pipeline run saves `predictions_snapshot.json` with per-player `proj_pts_1gw` and `xPts_1gw` for the current GW.
- **D-02:** For historical xPts reconstruction, use `expected_goals` and `expected_assists` per-GW fields from element-summary `history[]` as xG/xA inputs. Use `minutes` from the same history entry as actual minutes played.
- **D-03:** For historical fixture difficulty, use the FPL standard `difficulty` field (1–5 scale) from `fpl_fixtures.json`. Convert 1–5 to 0–1 difficulty score using the same normalisation as the current pipeline. Do NOT use FDR++ attacking/defensive split.
- **D-04:** For historical `start_prob`, use a binary proxy: `start_prob = 1.0` if player played ≥45 minutes, `0.0` otherwise.
- **D-05:** Include `proj_pts_1gw` in the backtest. Reconstruct for each past GW N by computing rolling PPG from the 5 history entries immediately before GW N (GWs N-5 to N-1). Apply the FPL standard difficulty modifier for that GW's fixture.
- **D-06:** For historical `proj_pts`, use `total_points / minutes * 90` per history entry to approximate per-90 scoring rate. Average over the prior 5 GW window to get historical PPG.
- **D-07:** Output file is `pipeline/cache/accuracy_backtest.json` (and Vercel Blob in production). Structure is pre-aggregated — pipeline writes both per-GW summary and per-player detail.
- **D-08:** JSON structure as defined in CONTEXT.md (generated_at, gws_covered, summary, haulters, players sections).
- **D-09:** Haulter threshold: 10+ actual points.
- **D-10:** "Ranked highly" threshold: top 10 predicted players for that GW. Hit rate = flagged haulters / total haulters that GW.
- **D-11:** Each pipeline run writes `predictions_snapshot.json` with current GW number and per-player `proj_pts_1gw` and `xPts_1gw`. Backtest computation in future runs uses snapshots when available (preferred over reconstruction).
- **D-12:** Snapshot format: `{ "gw": N, "run_at": "ISO", "players": [{ "id": ..., "proj_pts_1gw": ..., "xPts_1gw": ... }] }`. Stored at `pipeline/cache/predictions_snapshot.json` (overwrites each run). Blob stores one per GW via named prefix (e.g., `predictions_snapshot_gw32.json`).

### Claude's Discretion

- Whether to run backtest computation as a standalone function in `merge.py` or a separate `accuracy.py` module.
- Minimum minutes threshold for including a player in the backtest (e.g., skip players who played 0 minutes that GW).
- Delta convention: `actual - predicted` (positive = surprised haul).
- Handling of DGWs — use summed `total_points` and summed `expected_goals`/`expected_assists` for that GW.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACC-01 | Pipeline computes per-GW actual vs predicted delta for both `proj_pts_1gw` and `xPts_1gw` over the last 5 completed gameweeks using actual points from FPL element-summary history | Fully supported: `history[]` provides `total_points`, `expected_goals`, `expected_assists`, `minutes`, `round`; `fpl_fixtures.json` provides `team_h_difficulty`/`team_a_difficulty` for historical difficulty; `_xpts_ngw()` and `_proj_pts_ngw()` are reusable |

</phase_requirements>

---

## Summary

Phase 40 extends the Python pipeline with two new outputs: `accuracy_backtest.json` and `predictions_snapshot.json`. The backtest file is pre-aggregated at pipeline run time — it contains per-GW haulter detection, hit rates, and per-player prediction deltas for the last 5 finished gameweeks. The snapshot file records current-GW predictions for future backtest use, accumulating a rolling historical record in Vercel Blob.

The implementation is pure Python with no new external dependencies. All required data is already fetched by `run.py` during its existing element-summary sweep — the `summaries` dict passed to existing functions like `compute_defcon_stats()` is the same dict needed here. The new computation function receives `summaries`, `finished_gws`, `bootstrap`, and `fixtures` as inputs, mirroring the existing `compute_defcon_stats()` pattern exactly.

Historical reconstruction uses approximations by design (D-02 through D-06). These are documented approximations, not model replays. The xPts reconstruction uses per-GW `expected_goals`/`expected_assists` from `history[]` as xG/xA inputs, a binary `start_prob` proxy, and FPL standard difficulty (1–5) converted to a 0–1 score. The proj_pts reconstruction uses per-90 scoring rate averaged over the prior 5 GW window.

**Primary recommendation:** Implement as a separate `accuracy.py` module (not inline in `merge.py`) to keep concerns separated. The module exposes two top-level functions: `compute_accuracy_backtest()` and `build_predictions_snapshot()`. Both are called from `run.py` after `merge_players()` completes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Backtest computation | Python pipeline (run.py + accuracy.py) | — | Pure data aggregation, no UI involvement |
| Historical reconstruction (xPts) | Python pipeline (accuracy.py) | — | Calls existing `_compute_xpts_fixture()` formula with reconstructed inputs |
| Historical reconstruction (proj_pts) | Python pipeline (accuracy.py) | — | Calls existing `_proj_pts_ngw()` logic with reconstructed PPG |
| Haulter detection | Python pipeline (accuracy.py) | — | Threshold comparison on `total_points`, no UI logic |
| Hit rate computation | Python pipeline (accuracy.py) | — | Aggregation; pre-computed so Phase 41 UI does zero computation |
| Prediction snapshotting | Python pipeline (run.py + accuracy.py) | Vercel Blob | Local overwrites; Blob accumulates per-GW via named prefix |
| File persistence | upload.py `save()` | Vercel Blob | Existing pattern — no changes to upload.py needed |
| UI consumption | Phase 41 (deferred) | — | Out of scope for this phase |

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib | 3.11 | json, os, datetime | No new deps needed |
| pipeline/upload.py | existing | `save()` routing to Blob or local | Established pattern |
| pipeline/fpl_client.py | existing | element-summary fetching | Already called in `run.py` |
| pipeline/merge.py | existing | `_compute_xpts_fixture()`, `_cs_prob()`, `_proj_pts_ngw()` | Core formulas; reused directly |

### No New Dependencies
The entire phase requires zero new `pip install` operations. All computation uses:
- Python stdlib: `json`, `os`, `datetime`, `statistics`
- Already-loaded data: `summaries` dict, `fpl_fixtures.json`, `fpl_bootstrap.json`
- Already-imported formulas from `merge.py`

---

## Architecture Patterns

### System Architecture Diagram

```
run.py
  │
  ├─ [existing] summaries dict ─────────────────────────────────────┐
  │   (element_id → {history: [{round, minutes, total_points,        │
  │    expected_goals, expected_assists, ...}]})                      │
  │                                                                   ▼
  ├─ [existing] bootstrap, fixtures ────────────────────┐    accuracy.py
  │                                                     │      compute_accuracy_backtest(
  │                                                     └────►   summaries, finished_gws,
  │                                                              bootstrap, fixtures)
  │                                                               │
  │                    ┌────────────────────────────────────────┐│
  │                    │  For each of last 5 finished GWs:      ││
  │                    │  1. For each player in summaries:       ││
  │                    │     a. Find history entry for that GW   ││
  │                    │     b. Reconstruct xPts (D-02,D-03,D-04)││
  │                    │     c. Reconstruct proj_pts (D-05,D-06) ││
  │                    │  2. Rank players by predicted score      ││
  │                    │  3. Detect haulters (≥10 actual pts)     ││
  │                    │  4. Flag if haulter was top-10 predicted ││
  │                    │  5. Compute hit rate                     ││
  │                    └─────────────────┬──────────────────────┘│
  │                                      │                        │
  │                                      ▼                        │
  │                    accuracy_backtest.json ◄───────────────────┘
  │                    (pre-aggregated: summary + haulters + players)
  │
  ├─ [existing] merged (list of player dicts with xPts_1gw, proj_pts_1gw)
  │                                      │
  │                    accuracy.py        │
  │                    build_predictions_snapshot(merged, current_gw)
  │                                      │
  │                    predictions_snapshot.json (overwrites each run)
  │                    Blob: predictions_snapshot_gw{N}.json (accumulates)
  │
  └─ save('accuracy_backtest.json', backtest_data)
     save('predictions_snapshot.json', snapshot_data)
     [Blob: vercel_blob.put('predictions_snapshot_gw{N}.json', ...)]
```

### Recommended Module Structure
```
pipeline/
├── accuracy.py          # NEW: compute_accuracy_backtest(), build_predictions_snapshot()
├── run.py               # MODIFIED: import accuracy, call two new functions, two new save()
├── merge.py             # UNCHANGED: _compute_xpts_fixture(), _cs_prob() reused via import
├── upload.py            # UNCHANGED: save() already handles Blob vs local routing
└── cache/
    ├── accuracy_backtest.json     # NEW output
    └── predictions_snapshot.json  # NEW output (overwrites each run)
```

### Pattern 1: Matching Player to Historical Fixture Difficulty

The key lookup challenge is: for player P who played for team T in GW N, what was the FPL difficulty of that fixture?

**Data available:**
- `history[]` entry: `{ "round": N, "opponent_team": T_id, "minutes": M, ... }` [VERIFIED: used in `defcon.py` line 77 — `m.get('opponent_team')`]
- `fpl_fixtures.json` entry: `{ "event": N, "team_h": X, "team_a": Y, "team_h_difficulty": D1, "team_a_difficulty": D2 }` [VERIFIED: confirmed by cache inspection]

**Note on `team_h_difficulty` / `team_a_difficulty`:** These are the FPL standard 1–5 difficulty fields (D-03). They appear directly on each fixture object. `team_h_difficulty` = difficulty for the home team in that fixture (the away team's strength), `team_a_difficulty` = difficulty for the away team (the home team's strength).

**Lookup algorithm:**
```python
# Build fixture lookup indexed by (event, team) -> difficulty
fixture_difficulty: dict[tuple[int, int], int] = {}
for fix in fixtures:
    gw = fix.get('event')
    if gw is None:
        continue
    # Home team faces away team's difficulty
    fixture_difficulty[(gw, fix['team_h'])] = fix['team_h_difficulty']
    # Away team faces home team's difficulty
    fixture_difficulty[(gw, fix['team_a'])] = fix['team_a_difficulty']

# Convert FPL 1-5 scale to 0.0-1.0 (D-03)
# FPL difficulty 1=easiest, 5=hardest -> 0.0 to 1.0
def fpl_difficulty_to_score(d: int) -> float:
    return (d - 1) / 4.0  # maps 1->0.0, 5->1.0
```
[ASSUMED — the exact normalisation of 1–5 to 0–1 needs to match `_compute_difficulty_score()` semantics. The context says "use the same normalisation as the current pipeline". Since the pipeline's FDR++ uses xGA rolling average, not the 1–5 scale, a simple linear map `(d-1)/4.0` is the reasonable proxy. Planner should validate this direction matches the difficulty_modifier formula in `_proj_pts_ngw()`.]

### Pattern 2: Historical xPts Reconstruction

```python
# Source: merge.py _compute_xpts_fixture() — called with reconstructed historical inputs
from merge import _compute_xpts_fixture, _cs_prob

def reconstruct_xpts_for_gw(history_entry: dict, element_type: int, difficulty_score: float) -> float:
    """Reconstruct xPts for a single GW history entry (D-02, D-03, D-04)."""
    minutes = history_entry.get('minutes', 0)
    if minutes == 0:
        return 0.0
    
    # D-04: binary start_prob proxy
    start_prob = 1.0 if minutes >= 45 else 0.0
    if start_prob == 0.0:
        return 0.0
    
    # D-02: use per-GW xG/xA from element-summary history
    xg = float(history_entry.get('expected_goals', 0) or 0)
    xa = float(history_entry.get('expected_assists', 0) or 0)
    
    # Convert to per-90 rates using actual minutes played
    xg_per90 = (xg / minutes) * 90 if minutes > 0 else 0.0
    xa_per90 = (xa / minutes) * 90 if minutes > 0 else 0.0
    
    # xmins = start_prob * minutes (binary proxy: if started, xmins = actual minutes)
    xmins = minutes  # since start_prob = 1.0, xmins = minutes
    
    # D-03: difficulty_score is already converted from FPL 1-5 scale
    # Use as defensive_difficulty (opponent's attacking threat proxy)
    result = _compute_xpts_fixture(xg_per90, xa_per90, start_prob, xmins, element_type, difficulty_score)
    return result['total']
```
[VERIFIED: `_compute_xpts_fixture()` signature and behaviour confirmed from merge.py lines 166-225]

### Pattern 3: Historical proj_pts Reconstruction

```python
# Source: merge.py _proj_pts_ngw() logic — adapted for historical PPG window
def reconstruct_proj_pts_for_gw(
    history_before_gw: list,  # entries from GWs N-5 to N-1 (up to 5)
    history_entry: dict,       # entry for GW N (the target GW)
    difficulty_score: float,
) -> float:
    """Reconstruct proj_pts for GW N (D-05, D-06)."""
    minutes = history_entry.get('minutes', 0)
    if minutes == 0:
        return 0.0
    
    # D-06: compute rolling PPG from prior window
    # Only include entries with minutes > 0 (DNP entries excluded)
    played_entries = [h for h in history_before_gw if h.get('minutes', 0) > 0]
    if not played_entries:
        return 0.0
    
    # D-06: per-90 scoring rate as proxy for form_pts_per90
    per90_scores = []
    for h in played_entries:
        m = h.get('minutes', 0)
        pts = h.get('total_points', 0)
        if m > 0:
            per90_scores.append((pts / m) * 90)
    
    ppg = sum(per90_scores) / len(per90_scores) if per90_scores else 0.0
    
    # D-04: binary start_prob
    start_prob = 1.0 if minutes >= 45 else 0.0
    
    # D-03: difficulty_modifier mirrors _proj_pts_ngw formula
    difficulty_modifier = 1.0 - (difficulty_score * 0.5)
    
    return round(ppg * start_prob * difficulty_modifier, 2)
```
[VERIFIED: `_proj_pts_ngw()` difficulty_modifier formula confirmed from merge.py line 142: `difficulty_modifier = 1.0 - (fix['difficulty_score'] * 0.5)`]

### Pattern 4: DGW Handling (Claude's Discretion)

For players who have two `history[]` entries for the same `round` (DGW):

```python
# Group history entries by round, summing where multiple entries exist
from collections import defaultdict

def group_history_by_gw(history: list) -> dict[int, dict]:
    """Sum DGW entries into a single aggregated entry per round."""
    by_round = defaultdict(lambda: {
        'round': 0, 'minutes': 0, 'total_points': 0,
        'expected_goals': 0.0, 'expected_assists': 0.0,
        'opponent_team': None,  # first opponent (arbitrary for DGW)
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
        if agg['opponent_team'] is None:
            agg['opponent_team'] = entry.get('opponent_team')
    return dict(by_round)
```
[ASSUMED — FPL element-summary history has one entry per fixture played; DGW produces two entries for the same `round` value. The summing approach matches the context's D-04 note "use summed `total_points` and summed `expected_goals`/`expected_assists`".]

### Pattern 5: Integration with run.py

```python
# In run.py — after merged players are computed, before save() calls
# Source: 40-CONTEXT.md Integration Points (line ~136-139)

from accuracy import compute_accuracy_backtest, build_predictions_snapshot

# Backtest: uses summaries already fetched, no new API calls
backtest_data = compute_accuracy_backtest(summaries, finished_gws, bootstrap, fixtures)
save('accuracy_backtest.json', backtest_data)

# Snapshot: uses merged player list (has xPts_1gw and proj_pts_1gw already computed)
snapshot_data = build_predictions_snapshot(merged, finished_gws, bootstrap)
save('predictions_snapshot.json', snapshot_data)

# For Blob accumulation: write per-GW named snapshot
current_gw_num = snapshot_data['gw']
if os.getenv('USE_BLOB', '').lower() == 'true':
    from upload import upload_json
    upload_json(f'predictions_snapshot_gw{current_gw_num}.json', snapshot_data)
```
[VERIFIED: `save()` function signature confirmed from upload.py; `finished_gws` variable confirmed from run.py line 160]

### Pattern 6: Snapshot File Format (D-12)

```python
def build_predictions_snapshot(merged: list, current_gw: int, bootstrap: dict) -> dict:
    """Build predictions_snapshot.json for the current pipeline run (D-11, D-12)."""
    from datetime import datetime, timezone
    
    return {
        'gw': current_gw,
        'run_at': datetime.now(timezone.utc).isoformat(),
        'players': [
            {
                'id': p['id'],
                'proj_pts_1gw': p.get('proj_pts_1gw', 0.0),
                'xPts_1gw': p.get('xPts_1gw', 0.0),
            }
            for p in merged
        ],
    }
```
[VERIFIED: `merged` list has `proj_pts_1gw` (merge.py line 829) and `xPts_1gw` (merge.py line 849) fields]

### Anti-Patterns to Avoid

- **Do not call `get_element_summary()` again in accuracy.py.** The `summaries` dict is passed in — re-fetching would add hundreds of HTTP calls and ~30 seconds to pipeline runtime. [VERIFIED: run.py already fetches all summaries in lines 146-157]
- **Do not put reconstruction logic inside `merge.py`.** That module is already complex. A standalone `accuracy.py` matches the defcon/xmins/insights pattern.
- **Do not include players with 0 minutes in backtest per-player entries.** These produce meaningless deltas (actual=0, predicted=N) that pollute accuracy analysis.
- **Do not use `ep_next` for historical proj_pts reconstruction.** The `ep_next` field is "expected points next GW" — a forward-looking field that changes each GW and is not stored in history. Use rolling PPG per D-06.
- **Do not use the rolling xGA difficulty score from merge.py for historical reconstruction.** That score reflects the current season's form. For past GWs, use the FPL static `team_h_difficulty`/`team_a_difficulty` per D-03.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| xPts formula | Custom expected-points calculator | `merge._compute_xpts_fixture()` | Existing vetted formula with correct CS probability, Poisson scaling, and per-position weights |
| CS probability | Custom clean-sheet model | `merge._cs_prob()` | Already handles difficulty scaling and minutes threshold |
| proj_pts difficulty modifier | Custom normalisation | Same `1.0 - (difficulty_score * 0.5)` formula from `_proj_pts_ngw()` | Ensures historical reconstruction matches live model semantics |
| File routing | Direct `open()` writes | `upload.save()` | Handles USE_BLOB env var; ensures prod/dev parity |
| Timestamp generation | `time.time()` etc | `datetime.now(timezone.utc).isoformat()` | Matches all other pipeline outputs (last_updated.json, captain_picks.json) |

---

## Common Pitfalls

### Pitfall 1: history[] `opponent_team` is a Team ID (int), not Short Name
**What goes wrong:** Looking up fixture difficulty using `opponent_team` as a team name fails because `opponent_team` in history[] is the team ID (integer), while teams dict is keyed by ID.
**Why it happens:** `defcon.py` uses `difficulty_scores.get(m.get('opponent_team'))` where `difficulty_scores` is keyed by team_id (int). The `opponent_team` field in history[] is the integer team ID from FPL.
**How to avoid:** Build `fixture_difficulty` dict keyed by `(gw: int, team_id: int)` -> difficulty. Look up using `(history_entry['round'], player_team_id)` where `player_team_id` comes from `bootstrap['elements']`, not from the history entry itself.
**Warning signs:** All difficulty scores returning 0.5 (default) regardless of fixture.

### Pitfall 2: Missing element-summary entries (players with starts=0)
**What goes wrong:** Not all 825 elements have a summaries entry — `run.py` skips elements with `starts == 0` (line 151: `if element.get('starts', 0) == 0: continue`).
**Why it happens:** Zero-start players have no history to backtest against. The summaries dict only contains players who have started at least one game.
**How to avoid:** Always guard with `if player_id not in summaries: continue` in the backtest loop.
**Warning signs:** KeyError or empty backtest output.

### Pitfall 3: history[] entries may use `round` not matching `event` in fixtures
**What goes wrong:** `history[]['round']` is the GW number. `fpl_fixtures[]` uses `event` for the same concept. Both are integers and should match, but ensure the lookup uses the same field name.
**Why it happens:** FPL API uses different field names in different endpoints.
**How to avoid:** Confirm that `history_entry['round'] == fixture['event']` for the same gameweek. [VERIFIED: `merge.py` line 354 uses `h['round']`, `fpl_fixtures.json` inspection confirms `fixture['event']` is the GW number.]

### Pitfall 4: Ranking computation needs complete player set per GW
**What goes wrong:** If you only process players who have history for GW N, the top-10 ranking may be incomplete if some players were skipped (no summary, 0 starts).
**Why it happens:** The "top 10 predicted" threshold (D-10) requires ranking across all players who had predictions for that GW, not just haulters.
**How to avoid:** Build a `gw_rankings` dict that maps GW -> sorted list of (player_id, predicted_score) for ALL players with history in that GW, then determine haulter rank from the full list.
**Warning signs:** Hit rates appearing artificially high because the ranking pool is too small.

### Pitfall 5: proj_pts window underrun in early GWs
**What goes wrong:** For GW 5 (the 5th gameweek), reconstructing proj_pts requires GWs N-5 to N-1 (GWs 0–4), but GW 0 doesn't exist.
**Why it happens:** D-05 says "5 history entries immediately before GW N" — early-season GWs have fewer than 5 prior entries.
**How to avoid:** Use `min(5, available_entries)` — if fewer than 5 prior GW entries exist, average over what's available. Since we're covering GWs 27–31, each player should have 22+ prior entries, so this is not a risk for the current season's backtest window.
**Warning signs:** Division by zero or `statistics.mean([])` error.

### Pitfall 6: Confusion between `proj_pts_1gw` (live) and historical proj_pts reconstruction
**What goes wrong:** The `proj_pts_1gw` in `merged_players.json` uses `ep_next * availability` (lines 801–804 in merge.py), NOT the `_proj_pts_ngw()` formula. The historical reconstruction uses rolling PPG, which is a different calculation. Both are labelled `proj_pts` in the output.
**Why it happens:** The live model uses `ep_next` (FPL's own points projection); the historical reconstruction cannot access historical `ep_next` values so D-06 approximates it with rolling PPG per-90.
**How to avoid:** Label clearly in output — use `proj_pts_predicted` in backtest JSON (as per D-08) to distinguish from live `proj_pts_1gw`. The `xpts_predicted` field uses the formula-reconstructed value.
**Warning signs:** Backtest proj_pts values looking very different from live values — this is expected and should be noted in Phase 41 UI.

---

## Code Examples

### Verified: history[] fields available for backtest

From `merge.py` `_compute_regression_signal()` (lines 348–383) and `xmins.py`:
- `h['round']` — GW number [VERIFIED: merge.py line 354]
- `h.get('minutes', 0)` — minutes played that GW [VERIFIED: merge.py line 362]
- `h.get('goals_scored', 0)` — goals scored [VERIFIED: merge.py line 370]
- `h.get('assists', 0)` — assists [VERIFIED: merge.py line 370]
- `h.get('expected_goals', 0)` — StatsBomb xG that GW [VERIFIED: merge.py line 372]
- `h.get('expected_assists', 0)` — StatsBomb xA that GW [VERIFIED: merge.py line 372]
- `h.get('total_points', 0)` — actual FPL points that GW [VERIFIED: merge.py line 740-741, `pts_last3gw` uses this field]
- `h.get('starts', 0)` — 1 if started, 0 if sub [VERIFIED: xmins.py line 41]
- `m.get('opponent_team')` — team ID of opponent [VERIFIED: defcon.py line 77]

### Verified: fixture difficulty fields

```python
# From fpl_fixtures.json cache inspection (2026-04-29):
# fixture = {
#   'event': 27,           # GW number (matches history[]['round'])
#   'team_h': 2,           # home team ID
#   'team_a': 11,          # away team ID
#   'team_h_difficulty': 2,  # difficulty for home team (FPL 1-5 scale)
#   'team_a_difficulty': 4,  # difficulty for away team (FPL 1-5 scale)
#   'finished': True,
# }
```
[VERIFIED: direct cache inspection of `pipeline/cache/fpl_fixtures.json`]

### Verified: Blob upload pattern for named per-GW files

```python
# From upload.py:
def upload_json(pathname: str, data: list | dict):
    """Upload JSON data to Vercel Blob storage."""
    import vercel_blob
    payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
    vercel_blob.put(pathname, payload, {'allowOverwrite': True, 'contentType': 'application/json'})
```
[VERIFIED: upload.py lines 7-11]

For per-GW snapshot accumulation, call `upload_json(f'predictions_snapshot_gw{gw}.json', snapshot_data)` directly (bypassing `save()` which uses a fixed pathname).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FPL `ep_next` for proj_pts | Rolling PPG reconstruction for historical (D-06) | Phase 40 (new) | Historical `ep_next` not stored; reconstruction is approximation |
| No historical records | Prediction snapshotting going forward (D-11) | Phase 40 (new) | Enables true model replay after 5+ GWs |
| No accuracy data | Pre-aggregated `accuracy_backtest.json` | Phase 40 (new) | Phase 41 UI is pure consumption, no computation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FPL 1–5 difficulty `(d-1)/4.0` maps correctly to the 0–1 `difficulty_score` used in `difficulty_modifier = 1.0 - (score * 0.5)` | Pattern 1, Pattern 3 | Historical proj_pts values would be slightly mis-scaled, but directionally correct. Low impact on hit rate detection. |
| A2 | `history[]['opponent_team']` is the integer team ID (not short name string) | Pitfall 1, Pattern 1 | Fixture difficulty lookup would return all defaults (0.5), making reconstruction inaccurate. HIGH impact — verify before relying on it. |
| A3 | DGW history entries have the same `round` value for both fixtures | Pattern 4 | DGW aggregation would fail silently if rounds differ. Verify by checking a known DGW player's history. |
| A4 | The `finished_gws` variable in `run.py` correctly counts completed GWs (matches `sum(1 for e in events if e.get('finished'))`) | Integration | If off-by-one, the last 5 GW window selection would be wrong. Currently 31 finished GWs confirmed by cache inspection. |

---

## Open Questions

1. **Normalising FPL 1–5 difficulty to 0–1 for D-03**
   - What we know: D-03 says "convert the 1–5 scale to a 0–1 difficulty score using the same normalisation as the current pipeline." The current pipeline uses xGA rolling average, not the 1–5 scale.
   - What's unclear: "Same normalisation" likely means `(d-1)/4.0` (linear) since the pipeline's `_compute_difficulty_score()` produces 0–1 output. The context explicitly says NOT to use FDR++ for historical reconstruction.
   - Recommendation: Use `(d - 1) / 4.0` — simple linear map. This preserves the direction (1=easiest→0.0, 5=hardest→1.0) and plugs into `difficulty_modifier = 1.0 - (score * 0.5)` correctly.

2. **Minimum minutes threshold (Claude's Discretion)**
   - What we know: Context says "skip players who played 0 minutes that GW." Players with `minutes > 0` are the sensible inclusion set.
   - What's unclear: Should players with 1–10 minutes (late subs) be included? They inflate backtest noise.
   - Recommendation: Minimum 10 minutes — filters genuine DNP entries but includes late subs who could score (e.g., penalty scored in 89th min). This is a Claude's Discretion item and should be noted in the output.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | accuracy.py | ✓ | 3.11 | — |
| pytest | Unit tests | ✓ | 8.3.5 | — |
| pipeline/cache/fpl_fixtures.json | Fixture difficulty lookup | ✓ | Current (GW31) | Re-run pipeline |
| pipeline/cache/fpl_bootstrap.json | Team/event data | ✓ | Current (GW31) | Re-run pipeline |
| pipeline summaries dict | Backtest computation | Computed at runtime | — | — |
| vercel_blob | Blob upload (prod only) | [ASSUMED] | — | Local save() |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3.5 (Python unit tests) + vitest (TypeScript tests, existing) |
| Config file | None (no pytest.ini) — run from project root with `python -m pytest pipeline/tests/` |
| Quick run command | `python -m pytest pipeline/tests/test_accuracy.py -x` |
| Full suite command | `npx vitest run` (TypeScript) + `python -m pytest pipeline/tests/ -x` (Python) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACC-01 | `compute_accuracy_backtest()` returns correct JSON structure | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_backtest_structure -x` | ❌ Wave 0 |
| ACC-01 | Haulter detection: players with ≥10 actual pts flagged | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_haulter_detection -x` | ❌ Wave 0 |
| ACC-01 | Hit rate computation: correct ratio flagged/total haulters | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_hit_rate_computation -x` | ❌ Wave 0 |
| ACC-01 | xPts reconstruction: correct formula call with historical inputs | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_xpts_reconstruction -x` | ❌ Wave 0 |
| ACC-01 | proj_pts reconstruction: rolling PPG from prior 5 GWs | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_proj_pts_reconstruction -x` | ❌ Wave 0 |
| ACC-01 | Snapshot: `build_predictions_snapshot()` produces correct D-12 format | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_snapshot_format -x` | ❌ Wave 0 |
| ACC-01 | DGW aggregation: summed total_points and xG/xA | unit | `python -m pytest pipeline/tests/test_accuracy.py::test_dgw_aggregation -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest pipeline/tests/test_accuracy.py -x`
- **Per wave merge:** `python -m pytest pipeline/tests/ -x && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pipeline/tests/__init__.py` — make tests discoverable as package
- [ ] `pipeline/tests/test_accuracy.py` — unit tests for `compute_accuracy_backtest()` and `build_predictions_snapshot()`
- [ ] Framework install: None needed — pytest 8.3.5 already available

---

## Security Domain

> No authentication, user data, or external inputs in this phase. All computation is internal pipeline logic over already-fetched FPL data. No ASVS categories apply.

---

## Sources

### Primary (HIGH confidence)
- `pipeline/run.py` — Integration points, `summaries` dict pattern, `finished_gws` variable, `save()` call pattern [VERIFIED: direct file read]
- `pipeline/merge.py` — `_compute_xpts_fixture()`, `_cs_prob()`, `_proj_pts_ngw()` signatures and formulas [VERIFIED: direct file read]
- `pipeline/defcon.py` — Module structure pattern, `summaries` dict usage, `history[]` field access [VERIFIED: direct file read]
- `pipeline/upload.py` — `save()` and `upload_json()` signatures [VERIFIED: direct file read]
- `pipeline/cache/fpl_fixtures.json` — Fixture schema with `team_h_difficulty`, `team_a_difficulty`, `event` fields [VERIFIED: direct cache inspection]
- `pipeline/cache/fpl_bootstrap.json` — 31 finished GWs confirmed, last 5 = GWs 27–31 [VERIFIED: direct cache inspection]

### Secondary (MEDIUM confidence)
- `pipeline/xmins.py` — `history[]['starts']` field and module structure pattern [VERIFIED: direct file read]
- `.planning/phases/40-accuracy-pipeline/40-CONTEXT.md` — All locked decisions D-01 through D-12 [SOURCE: user decisions]

### Tertiary (LOW confidence / Assumed)
- FPL element-summary `history[]['opponent_team']` is integer team ID — inferred from `defcon.py` usage but not directly tested against live API response

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing modules confirmed
- Architecture: HIGH — integration points pinpointed in run.py, existing module pattern is unambiguous
- Formulas: HIGH — `_compute_xpts_fixture()` and `_proj_pts_ngw()` code directly verified
- Fixture difficulty lookup: MEDIUM — field names confirmed, semantic interpretation (team_h_difficulty direction) assumed correct
- Pitfalls: HIGH — all identified from direct code inspection

**Research date:** 2026-04-29
**Valid until:** 2026-05-30 (pipeline architecture is stable; FPL fixture data refreshes daily but schema is stable)
