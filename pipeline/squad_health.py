"""Budget sweep + greedy health artifact writer (Phase 127 GREEDY-01).

Public API:
  compute_squad_health(bootstrap: dict) -> dict | None
      Sweeps budgets £80m–£120m in £0.5m steps (81 builds) using the greedy
      algorithm (Python port of buildPreSeasonSquad from src/lib/pre-season-squad.ts).
      Writes pre_season_squad_health.json via save().

Helpers:
  _compute_score_map(bootstrap, archive) -> dict[int, float]
      Returns player_id -> ppm for eligible players (total_minutes >= MIN_MINUTES).

  _greedy_build(players, score_map, budget) -> list | None
      Python port of TypeScript buildPreSeasonSquad() greedy builder.
      Returns 15-player list or None when constraints cannot be met.

  _load_archive(bootstrap) -> dict | None
      Loads season_archive_gw38.json from Blob or local cache; returns None if absent.
"""

import sys
import json
import os
from upload import save

# ---------------------------------------------------------------------------
# Constants (locked by CONTEXT.md D-01 / PATTERNS.md)
# ---------------------------------------------------------------------------

MIN_SLOTS = {1: 2, 2: 3, 3: 2, 4: 1}    # GK/DEF/MID/FWD minimum squad slots
MAX_SLOTS = {1: 2, 2: 5, 3: 5, 4: 3}    # GK/DEF/MID/FWD maximum squad slots
TEAM_CAP = 3
MIN_MINUTES = 500                          # D-02: exclude players with < 500 total minutes

BUDGET_MIN = 800    # £80m in FPL cost units (×10)
BUDGET_MAX = 1200   # £120m in FPL cost units (×10)
BUDGET_STEP = 5     # £0.5m steps
SWEEP_COUNT = 81    # (1200 - 800) / 5 + 1


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _compute_score_map(bootstrap: dict, archive: dict) -> dict:
    """Return player_id -> ppm for eligible players.

    Eligibility: player appears in archive AND total_minutes >= MIN_MINUTES (D-02).
    Archive keys may be string IDs (JSON serialisation) — handle both str/int lookups.
    """
    score_map = {}
    for element in bootstrap.get('elements', []):
        pid = element['id']
        player_data = archive.get(str(pid)) or archive.get(pid)
        if player_data is None:
            continue
        history = player_data.get('history', [])
        total_points = sum(gw.get('total_points', 0) for gw in history)
        total_minutes = sum(gw.get('minutes', 0) for gw in history)
        if total_minutes < MIN_MINUTES:
            continue
        ppm = total_points / total_minutes
        score_map[pid] = ppm
    return score_map


def _greedy_build(players: list, score_map: dict, budget: int) -> list | None:
    """Python port of buildPreSeasonSquad() greedy algorithm.

    Eligibility: player id in score_map.
    Sort: score desc; tie-break: lower now_cost wins.
    Constraints: MAX_SLOTS per position, TEAM_CAP players per team, budget guard.
    Returns 15-player list or None when < 15 filled or any MIN_SLOTS unmet.
    """
    eligible = [p for p in players if p['id'] in score_map]
    eligible.sort(key=lambda p: (-score_map[p['id']], p['now_cost']))

    filled: dict = {1: 0, 2: 0, 3: 0, 4: 0}
    team_count: dict = {}
    squad = []
    running_cost = 0

    for p in eligible:
        if len(squad) >= 15:
            break
        pos = p['element_type']
        if filled[pos] >= MAX_SLOTS[pos]:
            continue
        if team_count.get(p['team'], 0) >= TEAM_CAP:
            continue
        if running_cost + p['now_cost'] > budget:
            continue
        squad.append(p)
        filled[pos] += 1
        team_count[p['team']] = team_count.get(p['team'], 0) + 1
        running_cost += p['now_cost']

    if len(squad) < 15:
        return None
    for pos in [1, 2, 3, 4]:
        if filled[pos] < MIN_SLOTS[pos]:
            return None
    return squad


def _load_archive(bootstrap: dict) -> dict | None:
    """Load season_archive_gw38.json from Blob or local cache.

    Mirrors the resolution pattern used by suggest_squad.py and run.py.
    Returns None if the archive is not available.
    """
    cache_dir = 'pipeline/cache'
    archive_filename = 'season_archive_gw38.json'

    if os.getenv('USE_BLOB', '').lower() == 'true':
        try:
            import vercel_blob
            import requests as _requests
            blob_list = vercel_blob.list({'prefix': archive_filename, 'limit': 1})
            blobs = blob_list.get('blobs', [])
            if not blobs:
                return None
            url = blobs[0].get('url', '')
            if not url:
                return None
            return _requests.get(url, timeout=30).json()
        except Exception as exc:
            print(f"[squad_health] archive Blob read failed: {exc}", file=sys.stderr)
            return None
    else:
        archive_path = os.path.join(cache_dir, archive_filename)
        if not os.path.exists(archive_path):
            return None
        try:
            with open(archive_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as exc:
            print(f"[squad_health] archive local read failed: {exc}", file=sys.stderr)
            return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_squad_health(bootstrap: dict) -> dict | None:
    """Sweep budgets £80m–£120m and write pre_season_squad_health.json.

    Budget range: 800..1200 inclusive, step 5 (81 iterations).
    For each budget, calls _greedy_build() with the season archive score_map.
    Computes:
      - greedy_null_rate: fraction of 81 sweeps that returned None
      - min_feasible_budget_greedy: lowest successful budget in £m (divided by 10), or None

    Writes the SquadHealth envelope via save() and returns the dict.
    Returns None if the archive is unavailable.
    """
    archive = _load_archive(bootstrap)
    if archive is None:
        print("[squad_health] season archive not available — skipping health sweep.", file=sys.stderr)
        return None

    score_map = _compute_score_map(bootstrap, archive)
    if not score_map:
        print("[squad_health] no eligible players in archive — skipping health sweep.", file=sys.stderr)
        return None

    # Build candidate player list (same shape as suggest_squad.py)
    teams_by_id = {t['id']: t.get('short_name', '') for t in bootstrap.get('teams', [])}
    players = []
    for element in bootstrap.get('elements', []):
        pid = element['id']
        if pid not in score_map:
            continue
        players.append({
            'id': pid,
            'web_name': element.get('web_name', ''),
            'element_type': element['element_type'],
            'team': element['team'],
            'team_short_name': teams_by_id.get(element['team'], ''),
            'now_cost': element.get('now_cost', 0),
        })

    if not players:
        print("[squad_health] no candidate players after filtering — skipping.", file=sys.stderr)
        return None

    # Budget sweep: 800 to 1200 inclusive, step 5 = 81 iterations
    budgets = list(range(BUDGET_MIN, BUDGET_MAX + BUDGET_STEP, BUDGET_STEP))
    assert len(budgets) == SWEEP_COUNT, f"Expected {SWEEP_COUNT} sweep steps, got {len(budgets)}"

    results = {b: _greedy_build(players, score_map, b) for b in budgets}

    successes = [b for b in budgets if results[b] is not None]
    null_count = SWEEP_COUNT - len(successes)
    greedy_null_rate = null_count / SWEEP_COUNT
    min_feasible_budget_greedy = min(successes) / 10.0 if successes else None

    health_dict = {
        'greedy_null_rate': greedy_null_rate,
        'min_feasible_budget_greedy': min_feasible_budget_greedy,
        'greedy_optimality_gap_avg': None,   # deferred (D-02)
        'budget_sweep_min': BUDGET_MIN / 10.0,
        'budget_sweep_max': BUDGET_MAX / 10.0,
        'budget_sweep_step': BUDGET_STEP / 10.0,
        'sweep_count': SWEEP_COUNT,
    }

    save('pre_season_squad_health.json', health_dict)
    return health_dict
