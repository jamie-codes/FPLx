"""Tests for pipeline/news_classifier.py (MIN-02 — availability classifier)."""
import pytest
from news_classifier import classify_availability


def test_status_i_returns_out():
    result = classify_availability(status='i', chance=None, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_status_u_returns_out():
    result = classify_availability(status='u', chance=None, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_status_s_returns_out():
    result = classify_availability(status='s', chance=None, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_100_returns_fit():
    result = classify_availability(status='a', chance=100, news_text='')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_chance_75_returns_fit():
    result = classify_availability(status='a', chance=75, news_text='')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_chance_50_returns_doubt():
    result = classify_availability(status='a', chance=50, news_text='')
    assert result['availability_risk'] == 'doubt'
    assert result['availability_factor'] == 0.5


def test_chance_0_returns_out():
    result = classify_availability(status='a', chance=0, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_low_returns_out():
    # chance > 0 but < 25 — too low to expect meaningful minutes
    result = classify_availability(status='a', chance=10, news_text='')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_null_news_ruled_out():
    result = classify_availability(status='a', chance=None, news_text='Player ruled out for six weeks.')
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_chance_null_news_doubt():
    result = classify_availability(status='a', chance=None, news_text='Manager says player is a doubt for the weekend.')
    assert result['availability_risk'] == 'doubt'
    assert result['availability_factor'] == 0.5


def test_chance_null_news_fit():
    result = classify_availability(status='a', chance=None, news_text='Fully fit and available for selection.')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_chance_null_no_news_returns_unknown():
    result = classify_availability(status='a', chance=None, news_text='')
    assert result['availability_risk'] == 'unknown'
    assert result['availability_factor'] == 1.0


def test_chance_overrides_contradicting_keyword():
    # chance=100 (fit) but news says "doubt" — chance wins
    result = classify_availability(status='a', chance=100, news_text='Player is a doubt for the next match.')
    assert result['availability_risk'] == 'fit'
    assert result['availability_factor'] == 1.0


def test_injury_fires_in_gap_bucket_out():
    result = classify_availability(status='a', chance=None, news_text='',
                                   injury={'risk': 'out', 'reason': 'knee'})
    assert result['availability_risk'] == 'out'
    assert result['availability_factor'] == 0.0


def test_injury_fires_in_gap_bucket_doubt():
    result = classify_availability(status='a', chance=None, news_text='',
                                   injury={'risk': 'doubt', 'reason': 'knock'})
    assert result['availability_risk'] == 'doubt'
    assert result['availability_factor'] == 0.5


def test_injury_does_not_override_fpl_status():
    result = classify_availability(status='i', chance=None, news_text='',
                                   injury={'risk': 'doubt', 'reason': 'x'})
    assert result['availability_risk'] == 'out'  # P1 wins, injury ignored


def test_injury_does_not_override_fpl_chance():
    result = classify_availability(status='a', chance=100, news_text='',
                                   injury={'risk': 'out', 'reason': 'x'})
    assert result['availability_risk'] == 'fit'  # P2 wins, injury ignored


def test_injury_unknown_or_empty_falls_through_to_keyword_scan():
    # A malformed/unknown injury dict must NOT classify; it falls through to the
    # keyword scan (here 'ruled out' -> out), and an empty dict -> unknown.
    out_via_news = classify_availability(status='a', chance=None,
                                         news_text='Player ruled out for six weeks.',
                                         injury={'risk': 'unknown'})
    assert out_via_news['availability_risk'] == 'out'
    empty = classify_availability(status='a', chance=None, news_text='', injury={})
    assert empty['availability_risk'] == 'unknown'


def test_injury_takes_priority_over_news_keywords():
    result = classify_availability(status='a', chance=None,
                                   news_text='fully fit and available',
                                   injury={'risk': 'out', 'reason': 'x'})
    assert result['availability_risk'] == 'out'  # P3 before P4 keyword scan


def test_no_injury_reproduces_legacy_behavior():
    result = classify_availability(status='a', chance=None, news_text='', injury=None)
    assert result['availability_risk'] == 'unknown'
    assert result['availability_factor'] == 1.0
