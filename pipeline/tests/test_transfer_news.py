"""Unit tests for pipeline/transfer_news.py (Phase 123 SCR-01, SCR-03, SCR-05).

RED stage: transfer_news.py does not exist yet. Tests are collected successfully
but fail until the implementation module is created in Task 03.

Tests validate:
  - TRANSFER_NEWS_ENABLED env gate (unset → skip; 'false' → skip; 'true' → proceed)
  - Article classification: 5 classes, case-insensitive, uses summary text
  - Non-fatal per-source isolation (one source failure doesn't bail the other)
  - Empty articles guard (never calls save() when articles list is empty)
  - Artifact shape when articles are present
"""

import pytest
from unittest.mock import MagicMock, patch


def _import_tn():
    """Import transfer_news, failing the test with a clear message if not yet implemented."""
    try:
        import transfer_news as tn
        return tn
    except ModuleNotFoundError:
        pytest.fail("transfer_news module not found (implement Task 03)")


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tn():
    return _import_tn()


@pytest.fixture(autouse=True)
def enable_transfer_news_env(monkeypatch):
    """Enable TRANSFER_NEWS_ENABLED for all tests by default."""
    monkeypatch.setenv('TRANSFER_NEWS_ENABLED', 'true')


@pytest.fixture
def mock_save():
    """Patch upload.save to a MagicMock so no real I/O occurs."""
    with patch('transfer_news.save') as mock:
        yield mock


def _make_feed(entries):
    feed = MagicMock()
    feed.entries = entries
    return feed


def _make_empty_feed():
    return _make_feed([])


def _make_entry(title, summary=None, url='https://example.com/article', published=None):
    entry = MagicMock()
    entry.get = lambda key, default=None: {
        'title': title,
        'summary': summary,
        'link': url,
        'published': published,
    }.get(key, default)
    return entry


# ---------------------------------------------------------------------------
# TRANSFER_NEWS_ENABLED gate tests
# ---------------------------------------------------------------------------

def test_scrape_early_returns_when_env_var_unset(tn, monkeypatch, capsys):
    """scrape() should return early and not call save() when env var is unset."""
    monkeypatch.delenv('TRANSFER_NEWS_ENABLED', raising=False)
    with patch('transfer_news.save') as mock_save:
        tn.scrape({})
        captured = capsys.readouterr()
        assert '[transfer_news] TRANSFER_NEWS_ENABLED not set — skipping' in captured.out
        mock_save.assert_not_called()


def test_scrape_early_returns_when_env_var_false(tn, monkeypatch, capsys):
    """scrape() should return early when TRANSFER_NEWS_ENABLED='false'."""
    monkeypatch.setenv('TRANSFER_NEWS_ENABLED', 'false')
    with patch('transfer_news.save') as mock_save:
        tn.scrape({})
        captured = capsys.readouterr()
        assert '[transfer_news] TRANSFER_NEWS_ENABLED not set — skipping' in captured.out
        mock_save.assert_not_called()


# ---------------------------------------------------------------------------
# classify_article tests
# ---------------------------------------------------------------------------

def test_classify_confirmed_signing(tn):
    result = tn.classify_article('Arsenal sign striker', None)
    assert result == 'confirmed_signing', f"Expected 'confirmed_signing', got '{result}'"


def test_classify_rumour(tn):
    result = tn.classify_article('Spurs linked with midfielder', None)
    assert result == 'rumour', f"Expected 'rumour', got '{result}'"


def test_classify_injury_return(tn):
    result = tn.classify_article('Saka returns to fitness', None)
    assert result == 'injury_return', f"Expected 'injury_return', got '{result}'"


def test_classify_rotation_signal(tn):
    result = tn.classify_article('Player rotation expected', None)
    assert result == 'rotation_signal', f"Expected 'rotation_signal', got '{result}'"


def test_classify_general_fallback(tn):
    result = tn.classify_article('Pre-match interview', None)
    assert result == 'general', f"Expected 'general', got '{result}'"


def test_classify_case_insensitive(tn):
    """Classification should be case-insensitive (Pitfall 6 from RESEARCH.md)."""
    result = tn.classify_article('Arsenal SIGNS striker', None)
    assert result == 'confirmed_signing', (
        f"Case-insensitive match failed: expected 'confirmed_signing', got '{result}'"
    )


def test_classify_uses_summary_text(tn):
    """Classifier should also inspect summary text, not just title."""
    result = tn.classify_article('Title text', 'transfer rumour bid')
    assert result == 'rumour', f"Expected 'rumour' from summary text, got '{result}'"


def test_classification_keywords_has_all_five_classes(tn):
    required = {'confirmed_signing', 'rumour', 'injury_return', 'rotation_signal'}
    assert required.issubset(set(tn.CLASSIFICATION_KEYWORDS.keys()))


# ---------------------------------------------------------------------------
# Non-fatal isolation test
# ---------------------------------------------------------------------------

def test_non_fatal_isolation_sky_failure(tn):
    """If Sky Sports raises, BBC should still succeed; scrape() should not re-raise."""
    bootstrap = {
        'elements': [
            {'id': 99, 'web_name': 'Chelsea', 'second_name': 'Chelsea Player'}
        ]
    }
    bbc_entry = _make_entry(
        'Transfer rumour: Chelsea linked with midfielder',
        summary='Chelsea are reportedly interested',
        url='https://www.bbc.co.uk/sport/football/67890',
        published='2026-05-18T11:00:00Z',
    )

    def mock_parse(url):
        if 'skysports' in url:
            raise ConnectionError("Simulated Sky Sports feed failure")
        return _make_feed([bbc_entry])

    with patch('transfer_news.feedparser.parse', side_effect=mock_parse):
        with patch('transfer_news.save') as mock_save:
            # Should not raise
            tn.scrape(bootstrap)

            if mock_save.called:
                call_args = mock_save.call_args
                payload = call_args[0][1]
                assert payload['source_health']['skysports']['ok'] is False
                assert payload['source_health']['bbc']['ok'] is True


# ---------------------------------------------------------------------------
# Empty articles guard test
# ---------------------------------------------------------------------------

def test_empty_articles_guard(tn, capsys):
    """When both feeds return zero entries, save() must NOT be called."""
    with patch('transfer_news.feedparser.parse', return_value=_make_empty_feed()):
        with patch('transfer_news.save') as mock_save:
            tn.scrape({'elements': []})
            mock_save.assert_not_called()

    captured = capsys.readouterr()
    assert 'articles list empty — skipping save' in captured.out


# ---------------------------------------------------------------------------
# Artifact shape test
# ---------------------------------------------------------------------------

def test_writes_artifact_with_correct_shape(tn):
    """When feeds return entries, save() is called once with the correct payload shape."""
    bootstrap = {
        'elements': [
            {'id': 42, 'web_name': 'Arsenal', 'second_name': 'Arsenal Striker'}
        ]
    }
    sky_entry = _make_entry(
        'Arsenal sign striker from Bundesliga',
        summary='Arsenal complete deal',
        url='https://www.skysports.com/football/news/12345',
        published='2026-05-18T10:30:00Z',
    )
    bbc_entry = _make_entry(
        'Chelsea linked with midfielder',
        summary='Chelsea interested in bid',
        url='https://www.bbc.co.uk/sport/football/67890',
        published='2026-05-18T11:00:00Z',
    )

    def mock_parse(url):
        if 'skysports' in url:
            return _make_feed([sky_entry])
        return _make_feed([bbc_entry])

    with patch('transfer_news.feedparser.parse', side_effect=mock_parse):
        with patch('transfer_news.save') as mock_save:
            tn.scrape(bootstrap)

            mock_save.assert_called_once()
            call_args = mock_save.call_args
            key = call_args[0][0]
            payload = call_args[0][1]

    assert key == 'transfer_news.json', f"Expected 'transfer_news.json', got '{key}'"
    assert 'scraped_at' in payload
    assert 'articles' in payload
    assert 'source_health' in payload
    assert len(payload['articles']) >= 1

    for article in payload['articles']:
        assert 'title' in article
        assert 'summary' in article
        assert 'url' in article
        assert 'published' in article
        assert 'source' in article
        assert 'classification' in article
        assert 'element_id' in article
        assert 'scraped_at' in article
        assert article['classification'] in (
            'confirmed_signing', 'rumour', 'injury_return', 'rotation_signal', 'general'
        )

    sh = payload['source_health']
    assert 'skysports' in sh
    assert 'bbc' in sh
    for source_key in ('skysports', 'bbc'):
        assert 'ok' in sh[source_key]
        assert 'last_success' in sh[source_key]
        assert 'last_error' in sh[source_key]


# ---------------------------------------------------------------------------
# Phase 131: source_tier field tests
# ---------------------------------------------------------------------------

def test_article_dict_contains_source_tier_field(tn):
    """Every article dict must contain a source_tier key (D-03)."""
    bootstrap = {'elements': []}
    sky_entry = _make_entry('Arsenal sign striker', url='https://www.skysports.com/1')
    bbc_entry = _make_entry('Chelsea linked with midfielder', url='https://www.bbc.co.uk/2')

    def mock_parse(url):
        if 'skysports' in url:
            return _make_feed([sky_entry])
        return _make_feed([bbc_entry])

    with patch('transfer_news.feedparser.parse', side_effect=mock_parse):
        with patch('transfer_news.save') as mock_save:
            tn.scrape(bootstrap)
            payload = mock_save.call_args[0][1]

    for article in payload['articles']:
        assert 'source_tier' in article
        assert article['source_tier'] in ('Official', 'Reliable', 'Speculative')


def test_skysports_source_tier_is_reliable(tn):
    assert tn._get_source_tier('skysports') == 'Reliable'


def test_bbc_source_tier_is_reliable(tn):
    assert tn._get_source_tier('bbc') == 'Reliable'


def test_unknown_source_falls_back_to_speculative(tn):
    assert tn._get_source_tier('unknown_tabloid') == 'Speculative'
