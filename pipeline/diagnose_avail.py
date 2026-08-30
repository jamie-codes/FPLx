"""TEMPORARY diagnostic (2026-08-30): why do AVAIL-01/ODDS-02 return zero?

Probes api-football with several parameter shapes and prints response envelopes
(results/errors/paging counts only — never the key, never player payloads).
Run in CI via the diagnose-avail workflow, then delete both files.
"""
import json
import os
import requests

BASE = 'https://v3.football.api-sports.io'
PL = 39
KEY = os.environ.get('APIFOOTBALL_KEY', '')


def probe(label: str, endpoint: str, params: dict) -> None:
    if not KEY:
        print(f'{label}: NO KEY IN ENV')
        return
    try:
        r = requests.get(f'{BASE}/{endpoint}', params=params,
                         headers={'x-apisports-key': KEY}, timeout=30)
        print(f'{label}: HTTP {r.status_code}')
        d = r.json()
        print(f'  params={params}')
        print(f'  results={d.get("results")} errors={json.dumps(d.get("errors"))[:200]}')
        print(f'  paging={d.get("paging")}')
        resp = d.get('response') or []
        if resp:
            first = resp[0]
            if endpoint == 'injuries':
                print(f'  sample: player={((first.get("player") or {}).get("name"))!r} '
                      f'team={((first.get("team") or {}).get("name"))!r} '
                      f'fixture_id={((first.get("fixture") or {}).get("id"))} '
                      f'date={((first.get("fixture") or {}).get("date"))}')
            elif endpoint == 'fixtures':
                print(f'  sample: id={((first.get("fixture") or {}).get("id"))} '
                      f'date={((first.get("fixture") or {}).get("date"))} '
                      f'teams={((first.get("teams") or {}).get("home") or {}).get("name")!r}')
            else:
                print(f'  sample keys: {list(first.keys())[:8]}')
    except Exception as exc:
        print(f'{label}: EXCEPTION {type(exc).__name__}: {exc}')
    print()


def main() -> None:
    print('=== api-football account status ===')
    probe('status', 'status', {})

    print('=== fixtures: does api-football have PL 2026/27 at all? ===')
    probe('fixtures season=2026 next=5', 'fixtures', {'league': PL, 'season': 2026, 'next': 5})
    probe('fixtures season=2025 last=3', 'fixtures', {'league': PL, 'season': 2025, 'last': 3})

    print('=== injuries: season sweeps ===')
    probe('injuries season=2026', 'injuries', {'league': PL, 'season': 2026})
    probe('injuries season=2025 (known-good)', 'injuries', {'league': PL, 'season': 2025})

    print('=== injuries: date-scoped (the new live path) ===')
    # Upcoming GW3 dates + a recent PAST matchday (GW2) for contrast.
    for d in ('2026-09-05', '2026-09-06', '2026-08-29', '2026-08-30'):
        probe(f'injuries season=2026 date={d}', 'injuries',
              {'league': PL, 'season': 2026, 'date': d})

    print('=== odds: why 0 priced? ===')
    probe('odds season=2026 bet=1 page=1', 'odds',
          {'league': PL, 'season': 2026, 'bet': 1, 'page': 1})
    probe('odds season=2026 (no bet filter)', 'odds', {'league': PL, 'season': 2026})


if __name__ == '__main__':
    main()
