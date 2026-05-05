"""Pytest unit tests for pipeline/prose_summary.py (Phase 67 NLP-01).

These tests are RED until Plan 02 implements pipeline/prose_summary.py.
They mock the Anthropic SDK to verify guardrail + retry logic without
real network calls. The Python guardrail must be byte-equivalent to
src/lib/prose-guardrail.ts (Plan 01).
"""

import os
from unittest.mock import patch, MagicMock

import pytest


def _captain_payload():
    return [
        {'name': 'Salah', 'team': 'LIV', 'xPts_1gw': 6.8},
        {'name': 'Haaland', 'team': 'MCI', 'xPts_1gw': 7.2},
        {'name': 'Saka', 'team': 'ARS', 'xPts_1gw': 5.9},
    ]


def _gem_payload():
    return [
        {'name': 'Madueke', 'team': 'CHE', 'xPts_1gw': 4.4},
        {'name': 'Mbeumo', 'team': 'BRE', 'xPts_1gw': 5.1},
        {'name': 'Watkins', 'team': 'AVL', 'xPts_1gw': 5.6},
    ]


def _corpus():
    return ['Salah', 'Haaland', 'Saka', 'Madueke', 'Mbeumo', 'Watkins', 'Palmer', 'Foden']


def _stub_message(text: str) -> MagicMock:
    msg = MagicMock()
    block = MagicMock()
    block.text = text
    msg.content = [block]
    return msg


@pytest.fixture
def with_api_key(monkeypatch):
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'sk-ant-test')


def test_generate_passes(with_api_key):
    from prose_summary import generate_weekly_summary
    with patch('prose_summary.Anthropic') as MockClient:
        client = MockClient.return_value
        client.messages.create.return_value = _stub_message(
            'Salah and Haaland lead this week. Madueke offers a differential angle.'
        )
        out = generate_weekly_summary(
            captains=_captain_payload(),
            gems=_gem_payload(),
            player_corpus=_corpus(),
            gameweek=35,
        )
        assert out is not None
        assert 'prose' in out
        assert out['gw'] == 35
        assert 'generated_at' in out


def test_guardrail_rejects(with_api_key):
    from prose_summary import generate_weekly_summary
    with patch('prose_summary.Anthropic') as MockClient:
        client = MockClient.return_value
        # Both attempts hallucinate 'Palmer' (in corpus, NOT in allowed)
        client.messages.create.return_value = _stub_message(
            'Palmer is the captain pick this week.'
        )
        out = generate_weekly_summary(
            captains=_captain_payload(),
            gems=_gem_payload(),
            player_corpus=_corpus(),
            gameweek=35,
        )
        assert out is None
        # Two attempts (D-14 retry once)
        assert client.messages.create.call_count == 2


def test_retry_then_skip(with_api_key):
    from prose_summary import generate_weekly_summary
    with patch('prose_summary.Anthropic') as MockClient:
        client = MockClient.return_value
        # Attempt 1 fails (Palmer hallucinated), attempt 2 passes (only allowed names)
        client.messages.create.side_effect = [
            _stub_message('Palmer is the captain.'),
            _stub_message('Salah and Haaland lead the week.'),
        ]
        out = generate_weekly_summary(
            captains=_captain_payload(),
            gems=_gem_payload(),
            player_corpus=_corpus(),
            gameweek=35,
        )
        assert out is not None
        assert client.messages.create.call_count == 2


def test_missing_api_key_returns_none(monkeypatch):
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    from prose_summary import generate_weekly_summary
    with patch('prose_summary.Anthropic') as MockClient:
        out = generate_weekly_summary(
            captains=_captain_payload(),
            gems=_gem_payload(),
            player_corpus=_corpus(),
            gameweek=35,
        )
        assert out is None
        MockClient.assert_not_called()
