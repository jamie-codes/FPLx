# pipeline/tests/test_odds_client.py
import pytest
from odds_client import parse_odds_csv

_HEADER = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,AvgCH,AvgCD,AvgCA,AvgC>2.5,AvgC<2.5,B365H,B365D,B365A,B365>2.5,B365<2.5"

def _row(home, away, fthg, ftag, avgch, avgcd, avgca, avgo, avgu,
         b365h="", b365d="", b365a="", b365o="", b365u=""):
    return (f"E0,15/08/2025,20:00,{home},{away},{fthg},{ftag},H,"
            f"{avgch},{avgcd},{avgca},{avgo},{avgu},{b365h},{b365d},{b365a},{b365o},{b365u}")


def test_parse_basic_row():
    text = _HEADER + "\n" + _row("Liverpool", "Bournemouth", 4, 2, 1.29, 6.02, 8.68, 1.36, 3.05)
    rows = parse_odds_csv(text)
    assert len(rows) == 1
    r = rows[0]
    assert r['home'] == 'Liverpool' and r['away'] == 'Bournemouth'
    assert r['fthg'] == 4 and r['ftag'] == 2
    assert r['odds_1x2'] == (1.29, 6.02, 8.68)
    assert r['odds_ou25'] == (1.36, 3.05)


def test_blank_closing_falls_back_to_b365():
    text = _HEADER + "\n" + _row("Arsenal", "Wolves", 1, 0, "", "", "", "", "",
                                 b365h="1.40", b365d="4.5", b365a="8.0",
                                 b365o="1.50", b365u="2.6")
    rows = parse_odds_csv(text)
    assert rows[0]['odds_1x2'] == (1.40, 4.5, 8.0)
    assert rows[0]['odds_ou25'] == (1.50, 2.6)


def test_row_missing_both_sources_is_skipped():
    text = _HEADER + "\n" + _row("X", "Y", 0, 0, "", "", "", "", "")
    rows = parse_odds_csv(text)
    assert rows == []


def test_bom_header_handled():
    text = "﻿" + _HEADER + "\n" + _row("Chelsea", "Fulham", 2, 0, 1.5, 4.0, 6.0, 1.7, 2.1)
    rows = parse_odds_csv(text)
    assert rows[0]['home'] == 'Chelsea'
