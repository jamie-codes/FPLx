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


def test_retry_then_pass(with_api_key):
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


# ---- Phase 116 PROSE-02 tests (Task 1) ----

def test_build_user_prompt_includes_dgw_note(with_api_key):
    from prose_summary import _build_user_prompt
    result = _build_user_prompt(
        captains=_captain_payload(),
        gems=_gem_payload(),
        gameweek=33,
        dgw_teams=['MCI', 'ARS'],
    )
    assert 'Note: Gameweek 33 is a double gameweek for: MCI, ARS.' in result
    # DGW note must appear BEFORE <input>
    dgw_pos = result.index('Note: Gameweek 33')
    input_pos = result.index('<input>')
    assert dgw_pos < input_pos


def test_build_user_prompt_omits_dgw_note_when_empty(with_api_key):
    from prose_summary import _build_user_prompt
    result_none = _build_user_prompt(
        captains=_captain_payload(),
        gems=_gem_payload(),
        gameweek=33,
        dgw_teams=None,
    )
    assert 'double gameweek' not in result_none

    result_empty = _build_user_prompt(
        captains=_captain_payload(),
        gems=_gem_payload(),
        gameweek=33,
        dgw_teams=[],
    )
    assert 'double gameweek' not in result_empty


def test_build_user_prompt_includes_chance_of_playing(with_api_key):
    from prose_summary import _build_user_prompt
    caps_with_doubt = [
        {'name': 'SalahDoubt', 'team': 'LIV', 'xPts_1gw': 6.8, 'chance_of_playing_next_round': 75},
        {'name': 'HaalandFit', 'team': 'MCI', 'xPts_1gw': 7.2, 'chance_of_playing_next_round': 100},
        {'name': 'SakaMissing', 'team': 'ARS', 'xPts_1gw': 5.9},
    ]
    result = _build_user_prompt(captains=caps_with_doubt, gems=_gem_payload())
    # Player with chance 75 should have chance_of_playing attribute
    assert 'chance_of_playing="75"' in result
    # Player with chance 100 should NOT have chance_of_playing attribute
    # Find the SalahDoubt and HaalandFit lines and check separately
    lines = result.split('\n')
    haaland_lines = [l for l in lines if 'HaalandFit' in l]
    assert len(haaland_lines) == 1
    assert 'chance_of_playing=' not in haaland_lines[0]
    # Player without the key should NOT have chance_of_playing attribute
    saka_lines = [l for l in lines if 'SakaMissing' in l]
    assert len(saka_lines) == 1
    assert 'chance_of_playing=' not in saka_lines[0]


def test_build_user_prompt_includes_news_attribute(with_api_key):
    from prose_summary import _build_user_prompt
    caps_with_news = [
        {'name': 'SalahNews', 'team': 'LIV', 'xPts_1gw': 6.8, 'news': 'Doubtful for GW'},
        {'name': 'HaalandNoNews', 'team': 'MCI', 'xPts_1gw': 7.2, 'news': ''},
    ]
    result = _build_user_prompt(captains=caps_with_news, gems=_gem_payload())
    # Player with news should have news attribute
    assert 'news="Doubtful for GW"' in result
    # Player with empty news should NOT have news attribute
    lines = result.split('\n')
    haaland_lines = [l for l in lines if 'HaalandNoNews' in l]
    assert len(haaland_lines) == 1
    assert 'news=' not in haaland_lines[0]


def test_generate_weekly_summary_accepts_dgw_teams_kwarg(with_api_key):
    from prose_summary import generate_weekly_summary
    with patch('prose_summary.Anthropic') as MockClient:
        client = MockClient.return_value
        client.messages.create.return_value = _stub_message(
            'Salah and Haaland lead this week. Madueke offers value.'
        )
        out = generate_weekly_summary(
            captains=_captain_payload(),
            gems=_gem_payload(),
            player_corpus=_corpus(),
            gameweek=33,
            dgw_teams=['MCI'],
        )
        assert out is not None
        assert out['gw'] == 33
        assert 'prose' in out
        assert 'generated_at' in out
        # Inspect user prompt content passed to the mock
        call_args = client.messages.create.call_args
        messages = call_args[1].get('messages') or call_args[0][0] if call_args[0] else call_args[1]['messages']
        # Find the user message
        user_content = None
        for m in messages:
            if m.get('role') == 'user':
                user_content = m['content']
                break
        assert user_content is not None
        assert 'Note: Gameweek 33 is a double gameweek for: MCI.' in user_content
