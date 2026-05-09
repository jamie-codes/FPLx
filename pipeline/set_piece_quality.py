"""Set-piece delivery quality scores for FPL players (Phase 84 SPQ-01/SPQ-02).

Public API:
  run_sp_quality(understat_data: dict, id_map: dict, cache_dir: str) -> int | None
      Scrapes per-team Understat shot pages, filters to FromCorner/DirectFreekick,
      aggregates xG by player_assisted (deliverer -- NOT shooter; RESEARCH Pitfall 1),
      applies Empirical-Bayes shrinkage (k=20), writes sp_quality.json keyed by FPL
      player ID string (D-06). Returns unmatched Understat ID count on success;
      returns None on failure (sp_quality.json NOT overwritten -- D-07).

Module structure mirrors pipeline/bonus.py (single public function with private
helpers) and pipeline/understat_client.py (HTTP + 24h disk cache).
"""

import json
import os
import re
import statistics
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import requests

# ----------------------------------------------------------------- constants

# Adapted from pipeline/understat_client.py lines 9-10: same cache directory,
# different filename per CONTEXT.md Claude's Discretion (single combined file).
SP_SHOTS_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'cache', 'sp_shots_cache.json'
)
SP_QUALITY_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'cache', 'sp_quality.json'
)
CACHE_TTL_HOURS = 24

# Verbatim from pipeline/understat_client.py lines 12-21. Do NOT change User-Agent.
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Connection': 'keep-alive',
}

# Situation filter -- SPQ-01 spec
CORNER_SITUATION = 'FromCorner'
FK_SITUATION = 'DirectFreekick'

# Sample gates -- SPQ-02 spec
CORNER_MIN_N = 5
FK_MIN_N = 3

# EB shrinkage constant -- SPQ-02 spec (NOT k=12 like bonus.py)
SHRINKAGE_K = 20

# Per-team request pacing (CONTEXT.md Claude's Discretion -- 0.5s)
REQUEST_PACING_SECONDS = 0.5


# ----------------------------------------------------------------- HTML parsing

def _parse_shots(html: str) -> list:
    """Extract shotsData JSON from Understat team-page HTML.

    Adapted from pipeline/understat_client.py _parse_players() (lines 64-76):
    same regex+encode/decode pattern with the JS variable name changed to
    'shotsData' and the return type changed from dict to list (shots are an
    array of dicts on team pages, not the keyed dict on the league page).
    """
    for pattern in [
        r"var shotsData\s*=\s*JSON\.parse\('(.+?)'\)",
        r'var shotsData\s*=\s*JSON\.parse\("(.+?)"\)',
    ]:
        match = re.search(pattern, html)
        if match:
            encoded = match.group(1)
            decoded = encoded.encode('raw_unicode_escape').decode('unicode_escape')
            return json.loads(decoded)
    return []


# ----------------------------------------------------------------- aggregation

def _aggregate_shots(shots: list) -> dict:
    """Filter to corner/FK situations and group xG by player_assisted_id (deliverer).

    SPQ-01/SPQ-02 critical invariant: aggregate by 'player_assisted_id' (the
    deliverer), NOT 'player_id' (the shooter). RESEARCH Pitfall 1.

    Args:
        shots: list of Understat shot dicts (each must include 'situation',
               'player_assisted_id', 'xG'). 'xG' may be a string (Understat
               returns numeric strings) -- coerced via float().

    Returns:
        {'corner_shots': {deliverer_id: [xg, ...]},
         'fk_shots':     {deliverer_id: [xg, ...]}}
        Shots with no 'player_assisted_id' (open play with no assist) are skipped.
    """
    corner_shots: dict = defaultdict(list)
    fk_shots: dict = defaultdict(list)
    for shot in shots:
        situation = shot.get('situation')
        # CRITICAL: aggregate by player_assisted_id (deliverer), NOT player_id (shooter).
        deliverer_id = shot.get('player_assisted_id')
        if not deliverer_id:
            continue
        try:
            deliverer_id = int(deliverer_id)
        except (TypeError, ValueError):
            continue
        # V5 Input Validation: coerce xG (string from Understat) to float.
        try:
            xg = float(shot.get('xG', 0) or 0)
        except (TypeError, ValueError):
            xg = 0.0
        if situation == CORNER_SITUATION:
            corner_shots[deliverer_id].append(xg)
        elif situation == FK_SITUATION:
            fk_shots[deliverer_id].append(xg)
    return {'corner_shots': dict(corner_shots), 'fk_shots': dict(fk_shots)}


# ----------------------------------------------------------------- EB shrinkage

def _shrink(empirical: float, prior: float, n: int, k: int = SHRINKAGE_K) -> float:
    """Empirical-Bayes shrinkage: weighted blend toward prior.

    w = n / (n + k); equivalent to bonus.py shrinkage form for large n.
    n=0 -> w=0 -> result == prior (guards null-empirical case).
    """
    w = n / (n + k) if (n + k) > 0 else 0.0
    return w * empirical + (1.0 - w) * prior


def _compute_per_taker_scores(
    corner_shots: dict,
    fk_shots: dict,
    reverse_id_map: dict,
) -> tuple[dict, int]:
    """Apply sample gates, reverse-id-map join, and EB shrinkage to produce sp_quality dict.

    Args:
        corner_shots: {deliverer_understat_id: [xg, ...]}
        fk_shots:     {deliverer_understat_id: [xg, ...]}
        reverse_id_map: {understat_id: fpl_id_string}

    Returns:
        (sp_quality, unmatched_count) where sp_quality is keyed by FPL player ID
        string. Each entry contains corner_danger_score, fk_danger_score,
        delivery_quality_rank, sp_sample_n, understat_id (D-06).
    """
    # Compute prior mean from all takers with n >= 1 in either bucket
    # (RESEARCH Pattern 5; SPQ-02 spec).
    all_means: list = []
    deliverer_ids = set(corner_shots.keys()) | set(fk_shots.keys())
    for did in deliverer_ids:
        c_xgs = corner_shots.get(did, [])
        f_xgs = fk_shots.get(did, [])
        if c_xgs:
            all_means.append(statistics.mean(c_xgs))
        if f_xgs:
            all_means.append(statistics.mean(f_xgs))
    prior_mean = statistics.mean(all_means) if all_means else 0.0

    sp_quality: dict = {}
    unmatched_count = 0
    for did in deliverer_ids:
        c_xgs = corner_shots.get(did, [])
        f_xgs = fk_shots.get(did, [])
        n_corner = len(c_xgs)
        n_fk = len(f_xgs)
        n_total = n_corner + n_fk

        # Sample gates -- SPQ-02
        corner_score = statistics.mean(c_xgs) if n_corner >= CORNER_MIN_N else None
        fk_score = statistics.mean(f_xgs) if n_fk >= FK_MIN_N else None

        # delivery_quality_rank: null if both scores null; else EB-shrunk composite.
        if corner_score is None and fk_score is None:
            rank_score = None
        else:
            shrunk_components: list = []
            if corner_score is not None:
                shrunk_components.append(_shrink(corner_score, prior_mean, n_corner))
            if fk_score is not None:
                shrunk_components.append(_shrink(fk_score, prior_mean, n_fk))
            rank_score = statistics.mean(shrunk_components)

        fpl_id = reverse_id_map.get(did)
        if fpl_id is None:
            unmatched_count += 1
            continue

        sp_quality[fpl_id] = {
            'corner_danger_score': corner_score,
            'fk_danger_score': fk_score,
            'delivery_quality_rank': rank_score,
            'sp_sample_n': n_total,
            'understat_id': did,
        }
    return sp_quality, unmatched_count


# ----------------------------------------------------------------- 24h cache

def _is_sp_cache_fresh() -> bool:
    """Return True if sp_shots_cache.json exists with a _cached_at < 24h old.

    Adapted from pipeline/understat_client.py _is_cache_fresh() (lines 33-47).
    Always uses encoding='utf-8' (Pitfall 3 -- Windows cp1252 cannot decode UTF-8).
    """
    if not os.path.exists(SP_SHOTS_CACHE_PATH):
        return False
    try:
        with open(SP_SHOTS_CACHE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        cached_at_str = data.get('_cached_at')
        if not cached_at_str:
            return False
        cached_at = datetime.fromisoformat(cached_at_str)
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - cached_at < timedelta(hours=CACHE_TTL_HOURS)
    except Exception:
        return False


def _load_sp_cache() -> list:
    """Load shots list from sp_shots_cache.json (assumes _is_sp_cache_fresh() True)."""
    with open(SP_SHOTS_CACHE_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('shots', [])


def _write_sp_cache(shots: list) -> None:
    """Atomically write the full shots list with _cached_at sentinel.

    Pitfall 4: only call this AFTER all teams have been scraped successfully --
    never write incrementally.
    """
    os.makedirs(os.path.dirname(SP_SHOTS_CACHE_PATH), exist_ok=True)
    payload = {
        'shots': shots,
        '_cached_at': datetime.now(timezone.utc).isoformat(),
    }
    with open(SP_SHOTS_CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)


# ----------------------------------------------------------------- HTTP scrape

def _scrape_all_teams(team_names: list) -> list:
    """Fetch shots from each team's Understat page; collect into a single list.

    Per CONTEXT.md D-01: URL = https://understat.com/team/{name.replace(' ', '_')}/2025
    Per CONTEXT.md Claude's Discretion: 0.5s sleep between requests.
    Pitfall 4: build full list in memory; caller writes cache only after success.

    Raises:
        Exception: any HTTP failure (caller's try/except handles it -- D-07).
    """
    all_shots: list = []
    for team in sorted(team_names):
        url = f"https://understat.com/team/{team.replace(' ', '_')}/2025"
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        team_shots = _parse_shots(resp.text)
        if team_shots:
            all_shots.extend(team_shots)
        time.sleep(REQUEST_PACING_SECONDS)
    return all_shots


# ----------------------------------------------------------------- public API

def run_sp_quality(understat_data: dict, id_map: dict, cache_dir: str) -> int | None:
    """Scrape Understat shot pages and write sp_quality.json.

    Args:
        understat_data: understat_current.json dict (keyed by Understat player ID
                        string + '_cached_at' sentinel). Used to extract the set
                        of unique team names via the 'team' field on each entry.
        id_map: player_id_map.json dict -- keys are FPL player ID strings ('233'),
                values include 'understat_id' (int or null).
        cache_dir: path to pipeline/cache/ for sp_quality.json output. Accepted
                   for parity with compute_data_health(); the actual write goes
                   through upload.save() which routes by USE_BLOB env var.

    Returns:
        int: count of unmatched Understat player_assisted IDs (no FPL mapping).
        None: scrape failed; sp_quality.json NOT overwritten (D-07).
    """
    try:
        # Extract unique team names from understat_data (D-01).
        teams = {
            v['team']
            for k, v in understat_data.items()
            if k != '_cached_at' and isinstance(v, dict) and v.get('team')
        }
        if not teams:
            print("[set_piece_quality] no teams extracted from understat_data; aborting",
                  file=sys.stderr)
            return None

        # Use 24h cache when fresh; otherwise scrape all teams.
        if _is_sp_cache_fresh():
            print("Set-piece quality: using cached shot data (< 24h old)")
            all_shots = _load_sp_cache()
        else:
            print(f"Set-piece quality: scraping {len(teams)} Understat team pages...")
            all_shots = _scrape_all_teams(list(teams))
            _write_sp_cache(all_shots)
            print(f"Set-piece quality: cached {len(all_shots)} shots")

        # Build reverse id_map for Understat -> FPL ID join.
        reverse_id_map = {
            v['understat_id']: k
            for k, v in id_map.items()
            if isinstance(v, dict) and v.get('understat_id') is not None
        }

        # Aggregate, score, write.
        agg = _aggregate_shots(all_shots)
        sp_quality, unmatched_count = _compute_per_taker_scores(
            agg['corner_shots'], agg['fk_shots'], reverse_id_map
        )

        # Local import keeps module testable without USE_BLOB env var
        # (mirrors pipeline/data_health.py lines 141-143).
        from upload import save  # noqa: PLC0415
        save('sp_quality.json', sp_quality)
        return unmatched_count
    except Exception as exc:
        # D-07: do NOT overwrite sp_quality.json on failure; stale file preserved.
        print(f"[set_piece_quality] non-fatal error: {exc}", file=sys.stderr)
        return None
