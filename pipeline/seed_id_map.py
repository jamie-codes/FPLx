"""
One-time script to seed pipeline/player_id_map.json.

Downloads FPL-to-Understat ID mapping from ChrisMusson/FPL-ID-Map,
cross-references with current FPL bootstrap-static, and writes
pipeline/player_id_map.json keyed by FPL player id (as string).

Decision D-01: Seed from community CSV source.
Decision D-02: Promoted-team players with no Understat history get understat_id=null.
Decision D-03: Static JSON committed to repo — never falls back to name matching.
"""

import json
import os
import sys

import pandas as pd
import requests


FPL_CSV_URL = 'https://raw.githubusercontent.com/ChrisMusson/FPL-ID-Map/main/Understat.csv'
FPL_API_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/'
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'player_id_map.json')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Origin': 'https://fantasy.premierleague.com',
    'Referer': 'https://fantasy.premierleague.com/',
}


def fetch_understat_csv() -> pd.DataFrame:
    """Download ChrisMusson/FPL-ID-Map Understat.csv.

    Columns: code, first_name, second_name, web_name, understat
    The 'code' column equals FPL bootstrap-static elements[].id (NOT elements[].code).
    """
    print(f"Downloading Understat CSV from: {FPL_CSV_URL}")
    df = pd.read_csv(FPL_CSV_URL)
    print(f"  Downloaded {len(df)} rows from CSV")
    return df


def fetch_fpl_bootstrap() -> list:
    """Fetch current FPL bootstrap-static and return elements list."""
    print(f"Fetching FPL bootstrap-static from: {FPL_API_URL}")
    response = requests.get(FPL_API_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    data = response.json()
    elements = data.get('elements', [])
    print(f"  Fetched {len(elements)} FPL players")
    return elements


def build_id_map(csv_df: pd.DataFrame, fpl_elements: list) -> dict:
    """
    Build mapping dict keyed by str(fpl_id).

    Each value: {fpl_id: int, fpl_web_name: str, understat_id: int|null, understat_name: null}

    CSV 'code' column matches FPL element 'code' (the large player identifier integer,
    NOT elements[].id which is a sequential 1-N index). When understat is NaN,
    understat_id is None. FPL players not in CSV (promoted-team players) get
    understat_id=null per D-02.
    """
    # Build lookup from CSV: fpl_code -> understat_id (or None if NaN)
    csv_lookup: dict[int, int | None] = {}
    for _, row in csv_df.iterrows():
        fpl_code = int(row['code'])
        understat_val = row.get('understat')
        if pd.isna(understat_val):
            understat_id = None
        else:
            understat_id = int(understat_val)
        csv_lookup[fpl_code] = understat_id

    id_map: dict[str, dict] = {}

    for element in fpl_elements:
        fpl_id = int(element['id'])
        fpl_code = int(element['code'])
        web_name = element.get('web_name', '')
        key = str(fpl_id)

        if fpl_code in csv_lookup:
            understat_id = csv_lookup[fpl_code]
        else:
            # Promoted-team player with no Understat history (D-02)
            understat_id = None

        id_map[key] = {
            'fpl_id': fpl_id,
            'fpl_web_name': web_name,
            'understat_id': understat_id,
            'understat_name': None,
        }

    return id_map


def main():
    csv_df = fetch_understat_csv()
    fpl_elements = fetch_fpl_bootstrap()

    id_map = build_id_map(csv_df, fpl_elements)

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(id_map, f, indent=2, ensure_ascii=False)

    total = len(id_map)
    with_understat = sum(1 for v in id_map.values() if v['understat_id'] is not None)
    without_understat = total - with_understat

    print(f"\nSummary:")
    print(f"  Total entries:       {total}")
    print(f"  With Understat ID:   {with_understat}")
    print(f"  Without (null):      {without_understat}")
    print(f"\nWritten to: {OUTPUT_PATH}")


if __name__ == '__main__':
    main()
