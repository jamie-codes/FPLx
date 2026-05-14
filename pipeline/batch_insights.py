"""Batch AI insight pre-generation module (Phase 108 NLP-BATCH-01).

Generates a 2-3 sentence Claude insight per player for a given list of
players and writes each result to Vercel Blob at the same key namespace
that the on-demand /api/player-insight route reads from:

    player_insights/gw{N}/element_{id}.json

This eliminates perceived insight latency for the top-20 players:
the existing two-tier cache (localStorage -> Blob -> live API) in
usePlayerInsight finds a Blob hit on first interaction (~50-150ms)
rather than waiting for a live API call (~2-6s).

Called from pipeline/run.py after accuracy_backtest.json is written,
guarded by the caller's env var gate (see pipeline/run.py) --
this module does not read any batch-enable gate env var.

Structure mirrors pipeline/prose_summary.py: SDK import guard, API key
guard, _normalize, _passes_guardrail, 2-attempt strict-retry loop.
"""

import os
from datetime import datetime, timezone
from typing import Optional

try:
    from anthropic import Anthropic, APIError, RateLimitError  # type: ignore
except ImportError:
    Anthropic = None  # type: ignore
    APIError = Exception  # type: ignore
    RateLimitError = Exception  # type: ignore

from upload import save

MODEL = 'claude-haiku-4-5-20251001'
MAX_TOKENS = 300
ALLOWED_RETRIES = 1  # total attempts = ALLOWED_RETRIES + 1
POSITION_LABELS = {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}


def _normalize(s: str) -> str:
    return ' '.join(s.lower().split())


def _passes_guardrail(prose: str, allowed: set, corpus: list) -> bool:
    """Reject if any corpus name appears in prose AND is NOT in allowed.

    Mirror of prose_summary.py::_passes_guardrail (verbatim copy).
    """
    text = _normalize(prose)
    for name in corpus:
        n = _normalize(name)
        if not n:
            continue
        if n in text and n not in allowed:
            return False
    return True


def _xml_escape(s: str) -> str:
    """Escape characters that are invalid in XML attribute values."""
    return (
        s.replace('&', '&amp;')
         .replace('"', '&quot;')
         .replace('<', '&lt;')
         .replace('>', '&gt;')
    )


def _build_xml_context(player: dict) -> str:
    """Build a simplified XML context block for a single player.

    Omits <fragility> and <reasons> (no data source in Python pipeline).
    Only includes mc attributes whose value is not None (mirrors the
    mcAttr logic in route.ts buildXmlContext()).
    """
    pos = POSITION_LABELS.get(player.get('element_type'), 'UNK')
    mc_parts = []
    for attr in ('haul_prob', 'blank_prob', 'p10_pts', 'p90_pts'):
        val = player.get(attr)
        if val is not None:
            mc_parts.append(f' {attr}="{val}"')
    mc_attr = ''.join(mc_parts)
    lines = [f'<player name="{_xml_escape(player["web_name"])}" position="{pos}">']
    if mc_attr:
        lines.append(f'  <mc{mc_attr}/>')
    lines.append('</player>')
    return '\n'.join(lines)


def _build_system_prompt(strict: bool, player_web_name: str) -> str:
    """Build the system prompt for a single-player insight.

    Port of route.ts buildSystemPrompt() (lines 119-133).
    """
    base = (
        "You are an FPL analyst. Explain qualitatively whether this player is worth targeting this GW. "
        "Reference form, fixture, rotation risk, and haul/blank outlook. "
        "2–3 sentences. Do not include statistics or numeric values. "
        "Refer to the player by the exact name in <player name=…>."
    )
    if strict:
        return (
            base
            + f'\n\nSTRICT MODE: You may mention ONLY this exact player name: "{player_web_name}". '
            + 'Do not reference any other player by name.'
        )
    return base


def _generate_one(client, player: dict, corpus: list, gameweek: int) -> Optional[dict]:
    """Generate a single-player insight with a 2-attempt guardrail retry loop.

    Returns a dict {prose, player_id, gw, generated_at} on success, or None
    on API error or guardrail failure on both attempts.
    """
    allowed = {_normalize(player['web_name'])}
    xml_context = _build_xml_context(player)
    user_msg = f"{xml_context}\n\nProvide a 2–3 sentence qualitative insight for this player."

    for attempt in range(ALLOWED_RETRIES + 1):
        system_text = _build_system_prompt(strict=(attempt > 0), player_web_name=player['web_name'])
        system = [{"type": "text", "text": system_text, "cache_control": {"type": "ephemeral"}}]
        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{'role': 'user', 'content': user_msg}],
            )
            cache_creation = getattr(msg.usage, 'cache_creation_input_tokens', 0) or 0
            cache_read = getattr(msg.usage, 'cache_read_input_tokens', 0) or 0
            print(
                f'[batch_insights] cache player_id={player["id"]} attempt={attempt} '
                f'cache_creation={cache_creation} cache_read={cache_read}'
            )
            prose = msg.content[0].text
        except RateLimitError as e:
            print(f'[batch_insights] rate limited player_id={player["id"]} attempt={attempt}: {e}')
            return None
        except APIError as e:
            print(f'[batch_insights] API error player_id={player["id"]} attempt={attempt}: {e}')
            return None
        except Exception as e:
            print(f'[batch_insights] unexpected error player_id={player["id"]} attempt={attempt}: {e}')
            return None

        if not prose or not prose.strip():
            print(f'[batch_insights] empty prose player_id={player["id"]} attempt={attempt + 1}')
            continue

        if _passes_guardrail(prose, allowed, corpus):
            return {
                'prose': prose,
                'player_id': player['id'],
                'gw': gameweek,
                'generated_at': datetime.now(timezone.utc).isoformat(),
            }
        print(f'[batch_insights] guardrail rejected player_id={player["id"]} attempt={attempt}')

    return None


def generate_batch_insights(players: list, corpus: list, gameweek: int) -> dict:
    """Generate Claude insights for `players` and write each to Blob.

    Args:
        players: list of player dicts from merged_players.json (top 20 by xPts_1gw)
        corpus: full list of web_name strings for guardrail
        gameweek: current GW number (finished_gws + 1)

    Returns:
        {'written': int, 'skipped': int} where written + skipped == len(players)
    """
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print('[batch_insights] API key missing - skipping batch')
        return {'written': 0, 'skipped': len(players)}
    if Anthropic is None:
        print('[batch_insights] anthropic SDK not installed - skipping batch')
        return {'written': 0, 'skipped': len(players)}

    client = Anthropic(api_key=api_key)
    written = 0
    skipped = 0

    for player in players:
        result = _generate_one(client, player, corpus, int(gameweek))
        if result is None:
            skipped += 1
            continue
        blob_key = f'player_insights/gw{int(gameweek)}/element_{int(player["id"])}.json'
        save(blob_key, result)
        written += 1

    return {'written': written, 'skipped': skipped}


if __name__ == '__main__':
    print('batch_insights.py - call generate_batch_insights(players, corpus, gameweek) from pipeline/run.py')
