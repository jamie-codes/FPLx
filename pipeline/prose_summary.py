"""Generate the weekly LLM prose summary (Phase 67 NLP-01/NLP-02).

Called once per pipeline run from pipeline/run.py AFTER all other outputs
have been written. Uses the Anthropic Python SDK (claude-haiku-4-5) to
generate a 4-5 sentence narrative of this week's top captain picks and
differential gem targets, grounded in structured data passed in as args.

DEVIATION: Unlike pipeline/insights.py and pipeline/defcon.py, this module
makes ONE outbound HTTP call (to api.anthropic.com). The caller in run.py
wraps the call in try/except so a Claude failure cannot poison the rest
of the pipeline (Phase 67 RESEARCH.md Pitfall 8).

Guardrail (D-12/D-13/D-14): exact-match player-name check against the
allowed set (captains + gems). Algorithm is byte-equivalent to
src/lib/prose-guardrail.ts (Plan 01) — both must agree.

On guardrail failure on BOTH attempts, returns None — caller skips the
save() (D-14: no invalid prose is ever persisted).
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

MODEL = 'claude-haiku-4-5'  # D-08
MAX_TOKENS = 512
ALLOWED_RETRIES = 1  # D-14: total attempts = ALLOWED_RETRIES + 1


def _normalize(s: str) -> str:
    return ' '.join(s.lower().split())


def _collect_allowed_names(captains: list, gems: list) -> set:
    out = set()
    for p in list(captains) + list(gems):
        name = p.get('name')
        if name:
            out.add(_normalize(name))
    return out


def _passes_guardrail(prose: str, allowed: set, corpus: list) -> bool:
    """Reject if any corpus name appears in prose AND is NOT in allowed.

    Mirror of src/lib/prose-guardrail.ts::passesGuardrail (Plan 01).
    """
    text = _normalize(prose)
    for name in corpus:
        n = _normalize(name)
        if not n:
            continue
        if n in text and n not in allowed:
            return False
    return True


def _build_player_xml(p: dict) -> str:
    """Build a single player XML line with optional availability attributes."""
    attrs = f'name="{p["name"]}" team="{p["team"]}"'
    cop = p.get('chance_of_playing_next_round')
    if cop is not None and int(cop) < 100:
        attrs += f' chance_of_playing="{cop}"'
    news = p.get('news')
    if news:
        attrs += f' news="{news.replace(chr(34), chr(39))}"'
    return f'  <player {attrs} />'


def _build_user_prompt(
    captains: list,
    gems: list,
    gameweek: Optional[int] = None,
    dgw_teams: Optional[list] = None,
) -> str:
    cap_lines = '\n'.join(_build_player_xml(c) for c in captains)
    gem_lines = '\n'.join(_build_player_xml(g) for g in gems)

    if dgw_teams and gameweek is not None:
        dgw_prefix = f"Note: Gameweek {gameweek} is a double gameweek for: {', '.join(dgw_teams)}.\n\n"
    else:
        dgw_prefix = ''

    return (
        dgw_prefix
        + '<input>\n'
        f'<captains>\n{cap_lines}\n</captains>\n'
        f'<gems>\n{gem_lines}\n</gems>\n'
        '</input>\n\n'
        "Write a concise 4-5 sentence summary of who to consider this gameweek. "
        "Reference only players inside <input>. Quote their names verbatim. "
        "Refer to players qualitatively — do not include statistics, projected points, "
        "or numeric values."
    )


def _build_system_prompt(strict: bool, allowed_display: list) -> str:
    base = (
        "You are an FPL analyst. Write a concise 4-5 sentence summary of this "
        "week's top captain picks and gem targets, using only the data provided "
        "in the <input> XML block. Quote player names exactly as they appear. "
        "Do not mention any player not in the input. Refer to players qualitatively."
    )
    if strict:
        base = base + (
            f"\n\nSTRICT MODE: You may mention only these exact player names: "
            f"{sorted(allowed_display)}."
        )
    return base


def generate_weekly_summary(
    captains: list,
    gems: list,
    player_corpus: list,
    gameweek: Optional[int],
    dgw_teams: Optional[list] = None,
) -> Optional[dict]:
    """Generate the weekly prose summary or return None on failure.

    Args:
        captains: list of dicts with at least `name` and `team` keys
        gems: list of dicts with at least `name` and `team` keys
        player_corpus: full list of PL player web_names for guardrail
        gameweek: int GW number for the summary timestamp
        dgw_teams: optional list of team short names with a double gameweek (D-05)

    Returns:
        {'prose': str, 'gw': int, 'generated_at': iso str} on success
        None on missing API key, SDK import failure, or guardrail failure
    """
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print('[prose_summary] ANTHROPIC_API_KEY missing - skipping prose generation')
        return None
    if Anthropic is None:
        print('[prose_summary] anthropic SDK not installed - skipping prose generation')
        return None

    client = Anthropic(api_key=api_key)
    allowed = _collect_allowed_names(captains, gems)
    allowed_display = [p['name'] for p in list(captains) + list(gems) if p.get('name')]
    user = _build_user_prompt(captains, gems, gameweek=gameweek, dgw_teams=dgw_teams)

    for attempt in range(ALLOWED_RETRIES + 1):
        system = _build_system_prompt(strict=(attempt > 0), allowed_display=allowed_display)
        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{'role': 'user', 'content': user}],
            )
            prose = msg.content[0].text
        except RateLimitError as e:
            print(f'[prose_summary] rate limited on attempt {attempt}: {e}')
            return None
        except APIError as e:
            print(f'[prose_summary] API error on attempt {attempt}: {e}')
            return None
        except Exception as e:
            print(f'[prose_summary] unexpected error on attempt {attempt}: {e}')
            return None

        if not prose or not prose.strip():
            print(f'[prose_summary] empty prose on attempt {attempt + 1}')
            continue

        if _passes_guardrail(prose, allowed, player_corpus):
            return {
                'prose': prose,
                'gw': gameweek,
                'generated_at': datetime.now(timezone.utc).isoformat(),
            }
        print(f'[prose_summary] guardrail rejected attempt {attempt + 1}')

    return None


if __name__ == '__main__':
    print('prose_summary.py - call generate_weekly_summary() from pipeline/run.py')
