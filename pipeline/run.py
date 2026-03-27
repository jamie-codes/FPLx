"""Pipeline entry point: fetches FPL data and writes to cache or Blob."""

import os
import sys
import json

# Allow running from project root: python pipeline/run.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from fpl_client import get_bootstrap_static, get_fixtures
from upload import save


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
        }
        save('last_updated.json', last_updated)

        print(f"Pipeline complete: {player_count} players, {team_count} teams, {fixture_count} fixtures")

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
