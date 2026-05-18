"""Shared fuzzy player-name → element_id utility (Phase 123 SCR-02).

Provides a shared name-matching utility used by both transfer_news.py and
lineup_news.py, replacing duplicated difflib-based implementations.

Public API:
  build_name_lookup(elements: list) -> dict[str, int]
      Build a lowercased web_name/second_name → element_id (int) dict from
      FPL bootstrap elements. Deduplicates when web_name and second_name
      are equal (case-insensitive).

  match_player(text: str, name_lookup: dict, cutoff: int = FUZZY_CUTOFF) -> int | None
      Return element_id when the best rapidfuzz token_sort_ratio of text
      against any key in name_lookup is >= cutoff. Returns None otherwise.

Decision lock:
  D-01: rapidfuzz token_sort_ratio is used (not difflib). Threshold is the
        integer 85 on a 0-100 scale. This is the FUZZY_CUTOFF constant below.

  Pitfall 1 (scale confusion): rapidfuzz.fuzz.token_sort_ratio returns 0-100 (int),
  NOT 0.0-1.0 like difflib.SequenceMatcher. The threshold is >= 85, not >= 0.85.

  Pitfall 8 (short-name false positives): Words shorter than 4 characters are
  skipped in the per-word matching loop to avoid spurious matches (e.g. 'Son'
  matching 'Jonson' or 'Wilson' via partial token scoring).
"""

from rapidfuzz import fuzz

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# rapidfuzz token_sort_ratio scale is 0-100; threshold is >=85, NOT >=0.85
# — see Pitfall 1. Do NOT change this to 0.85.
FUZZY_CUTOFF = 85  # int; rapidfuzz 0-100 scale — do NOT change to 0.85


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def build_name_lookup(elements: list) -> dict[str, int]:
    """Build lowercased web_name/second_name → element_id lookup from bootstrap elements.

    Mirrors pipeline/lineup_news.py _build_name_lookup but stores element_id (int)
    as the value rather than the full element dict, because callers only need the id.

    Args:
        elements: List of FPL bootstrap element dicts; each must have 'id',
                  'web_name', and 'second_name' keys.

    Returns:
        dict mapping lowercased player names to integer element_id values.
        Deduplicates second_name when it is equal to web_name (case-insensitive).
    """
    lookup: dict[str, int] = {}
    for element in elements:
        web_name = element.get('web_name', '')
        second_name = element.get('second_name', '')
        element_id = element.get('id')
        if element_id is None:
            continue
        if web_name:
            lookup[web_name.lower()] = int(element_id)
        if second_name and second_name.lower() != web_name.lower():
            lookup[second_name.lower()] = int(element_id)
    return lookup


def match_player(text: str, name_lookup: dict, cutoff: int = FUZZY_CUTOFF) -> int | None:
    """Return FPL element_id (int) when text fuzzy-matches a player name above cutoff.

    Strategy (mirrors lineup_news.py _match_player but uses rapidfuzz not difflib):
      1. Early-return None if text is empty or None.
      2. Lowercase and strip the query.
      3. Direct exact-match lookup first (fast path).
      4. Per-word loop: for each word with len >= 4, compute token_sort_ratio against
         all lookup keys; track best score and corresponding element_id.
      5. Full-string fallback: compute token_sort_ratio of the full query against all
         lookup keys; update best if higher.
      6. Return best_id if best_score >= cutoff, else None.

    Args:
        text:        Article or headline text to search for a player name in.
        name_lookup: dict produced by build_name_lookup().
        cutoff:      Minimum rapidfuzz token_sort_ratio score (0-100 scale) to
                     count as a match. Default is FUZZY_CUTOFF (85).

    Returns:
        Integer element_id, or None if no match above cutoff.
    """
    if not text:
        return None

    query = text.lower().strip()

    # Fast path: direct exact match (token_sort_ratio would score 100 anyway)
    if query in name_lookup:
        return name_lookup[query]

    best_score: float = 0.0
    best_id: int | None = None

    # Per-word matching — skip tokens shorter than 4 chars (Pitfall 8)
    for word in query.split():
        if len(word) < 4:
            continue
        for name, element_id in name_lookup.items():
            score = fuzz.token_sort_ratio(word, name)
            if score > best_score:
                best_score = score
                best_id = element_id

    # Full-string fallback — catches multi-token names like 'Mohamed Salah'
    for name, element_id in name_lookup.items():
        score = fuzz.token_sort_ratio(query, name)
        if score > best_score:
            best_score = score
            best_id = element_id

    return best_id if best_score >= cutoff else None
