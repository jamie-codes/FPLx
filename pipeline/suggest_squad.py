"""ILP fallback squad builder for pre-season planning (Phase 126 NSP-02).

Public API:
  suggest_squad(bootstrap: dict, archive: dict) -> None
      Reads season_archive_gw38.json player data, applies PuLP ILP solver to find
      an optimal 15-player squad within FPL constraints, then writes
      pre_season_squad.json to Vercel Blob or local cache.

      Non-fatal: errors are logged and the function re-raises so the caller
      (run.py) can catch and continue the pipeline.

Helpers:
  _compute_score_map(bootstrap, archive) -> dict[int, float]
      Returns a mapping of player_id -> ppm (points_per_minute) for eligible players.
      Eligibility: total_minutes >= 500 in archive (D-02).

  _solve_ilp(players, score_map, budget, team_cap) -> list | None
      PuLP ILP solver. Returns list of 15 selected player dicts or None if infeasible.

  _derive_squad_dict(selected, score_map) -> dict
      Splits 15 ILP-selected players into starters (11) and bench (4),
      derives formation string, and builds the PreSeasonSquad-shaped dict.
"""

import sys
from upload import save

# pulp must be in pipeline/requirements.txt: pulp>=2.7.0
import pulp

# ---------------------------------------------------------------------------
# Constants (locked by CONTEXT.md)
# ---------------------------------------------------------------------------

SQUAD_KEY = 'pre_season_squad.json'
BUDGET = 1000             # tenths of GBP 1m = GBP 100m
TEAM_CAP = 3
MIN_MINUTES = 500         # D-02: exclude players with fewer than 500 total minutes

MIN_SLOTS = {1: 2, 2: 3, 3: 2, 4: 1}   # GK/DEF/MID/FWD minimum squad slots
MAX_SLOTS = {1: 2, 2: 5, 3: 5, 4: 3}   # GK/DEF/MID/FWD maximum squad slots

XI_SLOTS = {1: 1, 2: 3, 3: 3, 4: 1}    # Default formation starting positions (1-4-3-3 base)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _compute_score_map(bootstrap: dict, archive: dict) -> dict:
    """Return player_id -> ppm for eligible players.

    Eligibility: player appears in archive AND total_minutes >= MIN_MINUTES (D-02).
    Players with total_minutes == 0 are excluded to avoid division by zero.

    Archive keys may be stored as string IDs (JSON serialisation) — handle both
    str(id) and int(id) lookups.

    Returns:
        dict mapping int player_id -> float ppm
    """
    score_map = {}
    for element in bootstrap.get('elements', []):
        pid = element['id']
        # Archive keys may be string or int — check both
        player_data = archive.get(str(pid)) or archive.get(pid)
        if player_data is None:
            continue

        history = player_data.get('history', [])
        total_points = sum(gw.get('total_points', 0) for gw in history)
        total_minutes = sum(gw.get('minutes', 0) for gw in history)

        if total_minutes < MIN_MINUTES:
            continue  # D-02: exclude ineligible players

        ppm = total_points / total_minutes
        score_map[pid] = ppm

    return score_map


def _solve_ilp(players: list, score_map: dict, budget: int = BUDGET, team_cap: int = TEAM_CAP):
    """Solve the pre-season squad selection ILP using PuLP.

    Objective: maximise sum(ppm * x_i) for selected players.
    Constraints:
      - Budget: sum(now_cost * x_i) <= budget
      - Squad size: sum(x_i) == 15
      - Position quotas: MIN_SLOTS[pos] <= sum(x_i for pos) <= MAX_SLOTS[pos]
      - Team cap: sum(x_i for team) <= team_cap

    Returns:
        List of 15 selected player dicts if status is 'Optimal', else None.
    """
    if not players:
        return None

    prob = pulp.LpProblem("PreSeasonSquad", pulp.LpMaximize)
    x = {p['id']: pulp.LpVariable(f"x_{p['id']}", cat='Binary') for p in players}

    # Objective: maximise total ppm
    prob += pulp.lpSum(score_map.get(p['id'], 0) * x[p['id']] for p in players)

    # Budget constraint (tenths of GBP 1m)
    prob += pulp.lpSum(p['now_cost'] * x[p['id']] for p in players) <= budget

    # Squad size = 15
    prob += pulp.lpSum(x[p['id']] for p in players) == 15

    # Position quotas
    for pos in [1, 2, 3, 4]:
        pos_players = [p for p in players if p['element_type'] == pos]
        prob += pulp.lpSum(x[p['id']] for p in pos_players) >= MIN_SLOTS[pos]
        prob += pulp.lpSum(x[p['id']] for p in pos_players) <= MAX_SLOTS[pos]

    # Team cap
    teams = {p['team'] for p in players}
    for team in teams:
        team_players = [p for p in players if p['team'] == team]
        prob += pulp.lpSum(x[p['id']] for p in team_players) <= team_cap

    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    if pulp.LpStatus[prob.status] != 'Optimal':
        return None

    return [p for p in players if pulp.value(x[p['id']]) is not None and pulp.value(x[p['id']]) > 0.5]


def _derive_squad_dict(selected: list, score_map: dict) -> dict:
    """Split 15 selected players into starters (11) and bench (4).

    Formation is derived greedily: fill XI positions starting with exactly 1 GK,
    then aim for a balanced formation. Bench: GK first, then remaining field players
    sorted by ppm descending.

    Returns dict matching PreSeasonSquad shape:
      { starters: [...], bench: [...], formation: str, budgetUsed: int }
    """
    by_pos = {pos: [] for pos in [1, 2, 3, 4]}
    for p in selected:
        by_pos[p['element_type']].append(p)

    # Sort each position group by ppm descending
    for pos in by_pos:
        by_pos[pos].sort(key=lambda p: score_map.get(p['id'], 0), reverse=True)

    # Build starting XI: 1 GK + up to formation slots for field positions
    # Remaining field players go to bench; 1 GK goes to bench
    gks = by_pos[1]
    defs = by_pos[2]
    mids = by_pos[3]
    fwds = by_pos[4]

    # Starters: 1 GK + determine DEF/MID/FWD split from available
    starter_gks = gks[:1]
    bench_gks = gks[1:]

    # Total field starters = 10; distribute remaining spots
    n_def = len(defs)
    n_mid = len(mids)
    n_fwd = len(fwds)

    # Aim to pick exactly 10 field starters from the available field players
    # Constraints: DEF 3-5, MID 2-5, FWD 1-3 (FPL valid XI formation)
    # Strategy: greedily take top ppm players per position within valid bounds
    # Start with minimum per position, then fill remaining with highest-ppm players

    DEF_MIN_XI, DEF_MAX_XI = 3, 5
    MID_MIN_XI, MID_MAX_XI = 2, 5
    FWD_MIN_XI, FWD_MAX_XI = 1, 3

    def_starters = n_def if n_def <= DEF_MAX_XI else DEF_MAX_XI
    mid_starters = n_mid if n_mid <= MID_MAX_XI else MID_MAX_XI
    fwd_starters = n_fwd if n_fwd <= FWD_MAX_XI else FWD_MAX_XI

    # Enforce minimums
    def_starters = max(def_starters, min(DEF_MIN_XI, n_def))
    mid_starters = max(mid_starters, min(MID_MIN_XI, n_mid))
    fwd_starters = max(fwd_starters, min(FWD_MIN_XI, n_fwd))

    # Adjust to exactly 10 field starters
    total_field = def_starters + mid_starters + fwd_starters
    if total_field != 10:
        # Trim excess from the most-populated position
        while total_field > 10:
            if def_starters > DEF_MIN_XI and def_starters >= mid_starters and def_starters >= fwd_starters:
                def_starters -= 1
            elif mid_starters > MID_MIN_XI and mid_starters >= fwd_starters:
                mid_starters -= 1
            elif fwd_starters > FWD_MIN_XI:
                fwd_starters -= 1
            else:
                break
            total_field -= 1

        # Add to under-filled positions
        while total_field < 10:
            if def_starters < DEF_MAX_XI and def_starters <= mid_starters and def_starters <= fwd_starters:
                def_starters += 1
            elif mid_starters < MID_MAX_XI and mid_starters <= fwd_starters:
                mid_starters += 1
            elif fwd_starters < FWD_MAX_XI:
                fwd_starters += 1
            else:
                break
            total_field += 1

    starter_defs = defs[:def_starters]
    starter_mids = mids[:mid_starters]
    starter_fwds = fwds[:fwd_starters]

    bench_defs = defs[def_starters:]
    bench_mids = mids[mid_starters:]
    bench_fwds = fwds[fwd_starters:]

    starters = starter_gks + starter_defs + starter_mids + starter_fwds

    # Bench: GK first, then remaining field players sorted by ppm desc
    field_bench = bench_defs + bench_mids + bench_fwds
    field_bench.sort(key=lambda p: score_map.get(p['id'], 0), reverse=True)
    bench = bench_gks + field_bench

    formation = f"{def_starters}-{mid_starters}-{fwd_starters}"
    budget_used = sum(p['now_cost'] for p in selected)

    # Convert players to dict with ppm injected
    def _player_dict(p: dict) -> dict:
        return {
            'id': p['id'],
            'web_name': p.get('web_name', ''),
            'element_type': p['element_type'],
            'team': p['team'],
            'team_short_name': p.get('team_short_name', ''),
            'now_cost': p['now_cost'],
            'total_points': p.get('total_points', 0),
            'ppm': round(score_map.get(p['id'], 0), 4),
        }

    return {
        'starters': [_player_dict(p) for p in starters],
        'bench': [_player_dict(p) for p in bench],
        'formation': formation,
        'budgetUsed': budget_used,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def suggest_squad(bootstrap: dict, archive: dict, force: bool = False) -> None:
    """Compute and write an ILP-optimal pre-season squad to Blob.

    Reads player data from bootstrap (for now_cost, element_type, team, web_name)
    and archive (for ppm computation via total_points / total_minutes).

    Args:
        bootstrap: FPL bootstrap-static API response dict.
        archive: Season archive dict (season_archive_gw38.json) keyed by player id.
        force: If True, bypasses the idempotency check and re-runs the ILP solver
               against the current bootstrap prices, overriding any previously cached
               pre_season_squad.json. Used by the Phase 128 activation block in run.py
               when next-season data is first published. Default False preserves the
               existing skip-if-exists behaviour for the GW38 caller.

    Writes pre_season_squad.json via save(). Non-fatal outer wrapper in run.py
    catches any exception from this function.
    """
    import os as _os
    if not force:
        # Idempotency check: skip if pre_season_squad.json already exists.
        # Mirrors the _blob_exists pattern in archive_season.py.
        if _os.getenv('USE_BLOB', '').lower() == 'true':
            try:
                import vercel_blob
                result = vercel_blob.list({'prefix': SQUAD_KEY, 'limit': 1})
                if len(result.get('blobs', [])) > 0:
                    print("[suggest_squad] already exists — skipping.")
                    return
            except Exception as _exc:
                print(f"[suggest_squad] _blob_exists check failed ({_exc}); assuming not present.", file=sys.stderr)
        else:
            local_path = _os.path.join('pipeline', 'cache', SQUAD_KEY)
            if _os.path.exists(local_path):
                print("[suggest_squad] already exists — skipping.")
                return

    try:
        # Build candidate list from bootstrap + archive
        score_map = _compute_score_map(bootstrap, archive)

        if not score_map:
            print("[suggest_squad] no eligible players (all below 500 min threshold) — skipping.", file=sys.stderr)
            return

        # Build team short name lookup from elements
        teams_by_id = {t['id']: t.get('short_name', '') for t in bootstrap.get('teams', [])}

        # Build ppm lookup from archive for total_points (display field)
        def _archive_total_points(pid: int) -> int:
            player_data = archive.get(str(pid)) or archive.get(pid)
            if not player_data:
                return 0
            return sum(gw.get('total_points', 0) for gw in player_data.get('history', []))

        # Candidate players: eligible by score_map (>= 500 min)
        players = []
        for element in bootstrap.get('elements', []):
            pid = element['id']
            if pid not in score_map:
                continue  # ineligible (< 500 min or missing from archive)
            players.append({
                'id': pid,
                'web_name': element.get('web_name', ''),
                'element_type': element['element_type'],
                'team': element['team'],
                'team_short_name': teams_by_id.get(element['team'], ''),
                'now_cost': element.get('now_cost', 0),
                'total_points': _archive_total_points(pid),
            })

        if not players:
            print("[suggest_squad] no candidate players after filtering — skipping.", file=sys.stderr)
            return

        # Run ILP solver
        selected = _solve_ilp(players, score_map, budget=BUDGET, team_cap=TEAM_CAP)

        if selected is None:
            print("[suggest_squad] ILP returned no optimal solution — skipping Blob write.", file=sys.stderr)
            return

        if len(selected) != 15:
            print(f"[suggest_squad] ILP returned {len(selected)} players (expected 15) — skipping.", file=sys.stderr)
            return

        # Derive squad shape and write
        squad_dict = _derive_squad_dict(selected, score_map)
        save(SQUAD_KEY, squad_dict)
        print(f"Pre-season squad written: {len(squad_dict['starters'])} starters, {len(squad_dict['bench'])} bench, formation {squad_dict['formation']}.")

    except Exception as exc:
        print(f"[suggest_squad] error: {exc}", file=sys.stderr)
        raise
