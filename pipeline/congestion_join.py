"""EUR-01: join the midweek-congestion calendar to archive fixtures, producing a
set of (team_id, gw) where the team played a midweek match 1-4 days before its
PL gameweek fixture."""
import datetime


def build_congestion_lookup(calendar: dict[int, list[str]], fixtures: list) -> set:
    """calendar: {team_id: [ISO date str]}. fixtures: archive fixtures with
    'event', 'team_h', 'team_a', 'kickoff_time'. Returns {(team_id, gw), ...}.
    A clash = a congestion date d with 1 <= (pl_date - d).days <= 4."""
    # Pre-parse calendar dates once.
    parsed = {tid: [datetime.date.fromisoformat(d) for d in ds]
              for tid, ds in calendar.items()}
    clashes = set()
    for fix in fixtures:
        ko = fix.get('kickoff_time')
        gw = fix.get('event')
        if not ko or gw is None:
            continue
        pl_date = datetime.date.fromisoformat(ko[:10])
        for team_id in (fix.get('team_h'), fix.get('team_a')):
            for d in parsed.get(team_id, []):
                gap = (pl_date - d).days
                if 1 <= gap <= 4:
                    clashes.add((team_id, gw))
                    break
    return clashes
