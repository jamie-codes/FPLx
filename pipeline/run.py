"""Pipeline entry point: fetches FPL data and writes to cache or Blob."""

import os
import sys
import json

# Allow running from project root: python pipeline/run.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from fpl_client import get_bootstrap_static, get_fixtures, get_element_summary
from upload import save
from understat_client import get_understat_players
from merge import merge_players
from defcon import compute_defcon_stats
from xmins import compute_xmins_stats


def _get_cache_dir() -> str:
    """Return the local cache directory path (mirroring save_local logic)."""
    return 'pipeline/cache'


def _get_source() -> str:
    """Return 'blob' or 'local' based on USE_BLOB env var."""
    return 'blob' if os.getenv('USE_BLOB', '').lower() == 'true' else 'local'


def run(dry_run: bool = False):
    """Fetch FPL data and write to cache. On failure, write stale last_updated.json."""
    if dry_run:
        source = _get_source()
        print(f"Dry run complete — USE_BLOB={os.getenv('USE_BLOB', 'false')}, source={source}")
        return

    cache_dir = _get_cache_dir()
    source = _get_source()

    try:
        # Test hook: simulate failure before fetching (for testing stale-cache path)
        if os.getenv('MOCK_FAIL_VALIDATION', '').lower() == 'true':
            raise RuntimeError("Mock validation failure for testing")

        # Fetch and save bootstrap-static (players, teams, events)
        bootstrap = get_bootstrap_static()
        save('fpl_bootstrap.json', bootstrap)

        # Fetch and save fixtures
        fixtures = get_fixtures()
        save('fpl_fixtures.json', fixtures)

        # Fetch Understat data (uses 24h cache per D-07)
        understat = get_understat_players()

        # Load player ID map for FPL<->Understat join
        import json as _json
        id_map_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'player_id_map.json')
        with open(id_map_path, 'r', encoding='utf-8') as f:
            id_map = _json.load(f)

        # Shared element-summary cache (Phase 7) — fetched once, used by defcon + xmins
        print("Fetching element summaries...")
        import time as _time
        summaries: dict[int, dict] = {}
        for element in bootstrap['elements']:
            if element.get('starts', 0) == 0:
                continue
            try:
                summaries[element['id']] = get_element_summary(element['id'])
            except Exception as exc:
                print(f"  Warning: skipping id={element['id']}: {exc}")
            _time.sleep(0.1)
        print(f"Element summaries fetched: {len(summaries)} players")

        # Count finished gameweeks for xmins start_rate fallback
        finished_gws = sum(1 for e in bootstrap.get('events', []) if e.get('finished'))

        # Compute xmins stats (Phase 7 — MINS-01)
        print("Computing xmins stats...")
        xmins_stats = compute_xmins_stats(bootstrap, summaries, finished_gws)
        print(f"xmins stats: {len(xmins_stats)} players")

        # Merge FPL + Understat data (per-90 normalisation, custom FDR, fixtures)
        merged = merge_players(bootstrap, fixtures, understat, id_map, xmins_stats=xmins_stats, summaries=summaries)
        save('merged_players.json', merged)

        # Compute DefCon stats from element-summary history (Phase 4)
        print("Computing DefCon stats...")
        from merge import _compute_difficulty_scores
        difficulty_scores = _compute_difficulty_scores(bootstrap, fixtures)
        defcon_stats = compute_defcon_stats(bootstrap, difficulty_scores, summaries)
        save('defcon_stats.json', defcon_stats)
        print(f"DefCon stats: {len(defcon_stats)} players analysed")

        # Write last_updated.json with success metadata
        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat()

        player_count = len(bootstrap.get('elements', []))
        team_count = len(bootstrap.get('teams', []))
        fixture_count = len(fixtures)

        last_updated = {
            'last_updated': timestamp,
            'stale': False,
            'source': source,
            'player_count': player_count,
            'team_count': team_count,
            'fixture_count': fixture_count,
            'merged_count': len(merged),
        }
        save('last_updated.json', last_updated)

        print(f"Pipeline complete: {player_count} players, {team_count} teams, {fixture_count} fixtures, {len(merged)} merged")

    except Exception as exc:
        # Stale-cache fallback (per D-06): preserve prior cache, mark as stale
        print(f"Pipeline error: {exc}", file=sys.stderr)

        from datetime import datetime, timezone
        timestamp = datetime.now(timezone.utc).isoformat()

        last_updated_path = os.path.join(cache_dir, 'last_updated.json')

        if os.path.exists(last_updated_path):
            # Read existing last_updated.json and overwrite stale fields
            try:
                with open(last_updated_path, 'r', encoding='utf-8') as f:
                    last_updated = json.load(f)
            except Exception:
                last_updated = {'last_updated': timestamp, 'source': source}

            last_updated['stale'] = True
            last_updated['error_message'] = str(exc)
        else:
            # First-ever run failed — write minimal stale record
            last_updated = {
                'last_updated': timestamp,
                'stale': True,
                'source': source,
                'error_message': str(exc),
            }

        # Always write stale record locally (Blob may be unavailable)
        os.makedirs(cache_dir, exist_ok=True)
        with open(last_updated_path, 'w', encoding='utf-8') as f:
            json.dump(last_updated, f, indent=2, ensure_ascii=False)

        sys.exit(1)


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    run(dry_run=dry_run)
