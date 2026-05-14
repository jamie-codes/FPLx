"""Pytest unit tests for pipeline/batch_insights.py (Phase 108 NLP-BATCH-01).

These tests are RED until Task 2 implements pipeline/batch_insights.py.
They mock the Anthropic SDK and upload.save to verify per-player generation,
guardrail + retry logic, error handling, and cache_control wiring without
real network calls.
"""

import os
from unittest.mock import patch, MagicMock, call

import pytest


def _player(id=1, name='Salah', et=3, haul=0.18, blank=0.55, p10=2.0, p90=9.0):
    return {
        'id': id,
        'web_name': name,
        'element_type': et,
        'haul_prob': haul,
        'blank_prob': blank,
        'p10_pts': p10,
        'p90_pts': p90,
        'xPts_1gw': 6.8,
    }


def _corpus():
    return ['Salah', 'Haaland', 'Saka', 'Madueke', 'Mbeumo', 'Watkins', 'Palmer', 'Foden']


def _stub_message(text: str) -> MagicMock:
    msg = MagicMock()
    block = MagicMock()
    block.text = text
    msg.content = [block]
    msg.usage = MagicMock()
    msg.usage.cache_creation_input_tokens = 0
    msg.usage.cache_read_input_tokens = 0
    return msg


@pytest.fixture
def with_api_key(monkeypatch):
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'sk-ant-test')


def test_returns_zero_when_api_key_missing(monkeypatch):
    """With ANTHROPIC_API_KEY unset, returns {'written': 0, 'skipped': N} and never instantiates Anthropic."""
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    from batch_insights import generate_batch_insights
    with patch('batch_insights.Anthropic') as MockClient:
        result = generate_batch_insights(
            players=[_player(1, 'Salah'), _player(2, 'Haaland')],
            corpus=_corpus(),
            gameweek=35,
        )
        assert result == {'written': 0, 'skipped': 2}
        MockClient.assert_not_called()


def test_returns_zero_when_sdk_missing(with_api_key):
    """When batch_insights.Anthropic is None, returns {'written': 0, 'skipped': N} without calling save()."""
    from batch_insights import generate_batch_insights
    with patch('batch_insights.Anthropic', None), \
         patch('batch_insights.save') as mock_save:
        result = generate_batch_insights(
            players=[_player(1, 'Salah'), _player(2, 'Haaland'), _player(3, 'Saka')],
            corpus=_corpus(),
            gameweek=35,
        )
        assert result == {'written': 0, 'skipped': 3}
        mock_save.assert_not_called()


def test_writes_blob_per_successful_player(with_api_key):
    """With API key + mocked SDK returning clean prose, save() is called once per player with correct key and payload."""
    from batch_insights import generate_batch_insights
    players = [_player(1, 'Salah'), _player(2, 'Haaland')]
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save') as mock_save:
        client = MockClient.return_value
        client.messages.create.return_value = _stub_message(
            'Salah is a solid captain pick this week with a great fixture.'
        )
        result = generate_batch_insights(players=players, corpus=_corpus(), gameweek=35)
        assert result == {'written': 2, 'skipped': 0}
        assert mock_save.call_count == 2
        # Check first call key contains correct player info
        first_call_args = mock_save.call_args_list[0]
        assert first_call_args[0][0] == 'player_insights/gw35/element_1.json'
        payload = first_call_args[0][1]
        assert set(payload.keys()) == {'prose', 'player_id', 'gw', 'generated_at'}
        assert payload['player_id'] == 1
        assert payload['gw'] == 35
        # Check second call
        second_call_args = mock_save.call_args_list[1]
        assert second_call_args[0][0] == 'player_insights/gw35/element_2.json'


def test_skips_player_on_guardrail_failure_both_attempts(with_api_key):
    """When SDK returns guardrail-failing prose on BOTH attempts for player A but passing prose for B,
    returns {'written': 1, 'skipped': 1} and save() called once for B."""
    from batch_insights import generate_batch_insights
    player_a = _player(1, 'Salah')
    player_b = _player(2, 'Haaland')

    def side_effect(**kwargs):
        # Check the user content to determine which player is being queried
        content = kwargs.get('messages', [{}])[0].get('content', '')
        if 'Salah' in str(kwargs.get('system', '')) or 'Salah' in content:
            # Return prose mentioning Palmer (corpus name not in allowed for Salah)
            return _stub_message('Palmer is having a great season alongside Salah.')
        else:
            return _stub_message('Haaland is the standout captain this week.')

    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save') as mock_save:
        client = MockClient.return_value
        client.messages.create.side_effect = side_effect
        result = generate_batch_insights(players=[player_a, player_b], corpus=_corpus(), gameweek=35)
        assert result == {'written': 1, 'skipped': 1}
        assert mock_save.call_count == 1
        saved_key = mock_save.call_args_list[0][0][0]
        assert 'element_2' in saved_key  # player B (Haaland, id=2) was saved


def test_retries_with_strict_mode_then_passes(with_api_key):
    """SDK first returns guardrail-failing prose, second call returns clean prose; player counted as written; create called 2 times."""
    from batch_insights import generate_batch_insights
    player = _player(1, 'Salah')
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save') as mock_save:
        client = MockClient.return_value
        client.messages.create.side_effect = [
            _stub_message('Palmer is looking great alongside Salah.'),  # attempt 0 - fails guardrail
            _stub_message('Salah is the top captain pick with a home game.'),  # attempt 1 - passes
        ]
        result = generate_batch_insights(players=[player], corpus=_corpus(), gameweek=35)
        assert result == {'written': 1, 'skipped': 0}
        assert client.messages.create.call_count == 2
        assert mock_save.call_count == 1


def test_skips_player_on_rate_limit(with_api_key):
    """RateLimitError raised on first attempt for player A causes skip (no retry for that player); player B still processed."""
    from batch_insights import generate_batch_insights
    import batch_insights as bi
    player_a = _player(1, 'Salah')
    player_b = _player(2, 'Haaland')
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save') as mock_save:
        client = MockClient.return_value
        # First call raises RateLimitError, second call returns clean prose for player_b
        client.messages.create.side_effect = [
            bi.RateLimitError('rate limit'),
            _stub_message('Haaland is the captain pick this week.'),
        ]
        result = generate_batch_insights(players=[player_a, player_b], corpus=_corpus(), gameweek=35)
        assert result == {'written': 1, 'skipped': 1}
        assert mock_save.call_count == 1
        saved_key = mock_save.call_args_list[0][0][0]
        assert 'element_2' in saved_key


def test_skips_player_on_api_error(with_api_key):
    """APIError raised causes player to be skipped; loop continues."""
    from batch_insights import generate_batch_insights
    import batch_insights as bi
    player_a = _player(1, 'Salah')
    player_b = _player(2, 'Haaland')
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save') as mock_save:
        client = MockClient.return_value
        client.messages.create.side_effect = [
            bi.APIError('api error'),
            _stub_message('Haaland looks good this week.'),
        ]
        result = generate_batch_insights(players=[player_a, player_b], corpus=_corpus(), gameweek=35)
        assert result == {'written': 1, 'skipped': 1}
        assert mock_save.call_count == 1


def test_system_uses_cache_control_ephemeral(with_api_key):
    """The system keyword passed to messages.create is a list with type=='text' and cache_control=={'type': 'ephemeral'}."""
    from batch_insights import generate_batch_insights
    player = _player(1, 'Salah')
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save'):
        client = MockClient.return_value
        client.messages.create.return_value = _stub_message('Salah is a great pick this week.')
        generate_batch_insights(players=[player], corpus=_corpus(), gameweek=35)
        assert client.messages.create.call_count >= 1
        call_kwargs = client.messages.create.call_args_list[0][1]
        system = call_kwargs.get('system')
        assert isinstance(system, list), f"Expected system to be a list, got {type(system)}"
        assert len(system) >= 1
        first_block = system[0]
        assert first_block.get('type') == 'text'
        assert first_block.get('cache_control') == {'type': 'ephemeral'}


def test_xml_context_omits_none_mc_fields(with_api_key):
    """When player haul_prob is None but blank_prob is 0.2, user message contains blank_prob but NOT haul_prob."""
    from batch_insights import generate_batch_insights
    player = _player(1, 'Salah', haul=None, blank=0.2, p10=None, p90=None)
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save'):
        client = MockClient.return_value
        client.messages.create.return_value = _stub_message('Salah is a great pick this week.')
        generate_batch_insights(players=[player], corpus=_corpus(), gameweek=35)
        assert client.messages.create.call_count >= 1
        call_kwargs = client.messages.create.call_args_list[0][1]
        messages = call_kwargs.get('messages', [])
        user_content = messages[0].get('content', '') if messages else ''
        assert 'blank_prob="0.2"' in user_content, f"Expected blank_prob in user content: {user_content}"
        assert 'haul_prob=' not in user_content, f"Expected haul_prob omitted from user content: {user_content}"


def test_writes_use_save_function(with_api_key):
    """batch_insights.save (not upload_json directly) is the call site — satisfies USE_BLOB gate transparency."""
    from batch_insights import generate_batch_insights
    player = _player(1, 'Salah')
    with patch('batch_insights.Anthropic') as MockClient, \
         patch('batch_insights.save') as mock_save:
        client = MockClient.return_value
        client.messages.create.return_value = _stub_message('Salah is a top pick this week.')
        generate_batch_insights(players=[player], corpus=_corpus(), gameweek=35)
        # save() must be called (not upload_json directly)
        mock_save.assert_called_once()
        # Verify the key passed to save()
        call_args = mock_save.call_args_list[0]
        key = call_args[0][0]
        assert key.startswith('player_insights/gw')
        assert 'element_' in key
