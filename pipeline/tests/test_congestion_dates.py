import datetime
from congestion_dates import MIDWEEK_FIXTURE_DATES, TOTAL_DATES


def test_keys_are_valid_team_ids():
    assert MIDWEEK_FIXTURE_DATES, "calendar must not be empty"
    for tid in MIDWEEK_FIXTURE_DATES:
        assert isinstance(tid, int) and 1 <= tid <= 20, f"bad team_id {tid}"


def test_values_are_iso_dates_in_season_window():
    for tid, dates in MIDWEEK_FIXTURE_DATES.items():
        assert isinstance(dates, list)
        for d in dates:
            parsed = datetime.date.fromisoformat(d)  # raises if not ISO YYYY-MM-DD
            # 2025/26 season window (Aug 2025 .. Jun 2026)
            assert datetime.date(2025, 7, 1) <= parsed <= datetime.date(2026, 7, 1), (tid, d)


def test_no_duplicate_dates_per_team():
    for tid, dates in MIDWEEK_FIXTURE_DATES.items():
        assert len(dates) == len(set(dates)), f"duplicate date for team {tid}"


def test_total_count_matches_constant():
    assert TOTAL_DATES == sum(len(v) for v in MIDWEEK_FIXTURE_DATES.values())
    # Sanity floor: the season had many midweek cup/euro rounds across ~8 European
    # clubs + all 20 in domestic cups; a real calendar has well over 60 dates.
    assert TOTAL_DATES >= 60, f"calendar suspiciously small ({TOTAL_DATES}) — research incomplete"
