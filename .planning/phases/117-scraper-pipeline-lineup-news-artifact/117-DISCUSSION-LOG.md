# Phase 117: Scraper Pipeline & Lineup News Artifact - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 117-scraper-pipeline-lineup-news-artifact
**Areas discussed:** Pipeline integration point, Scraper merge semantics, Refresh schedule, FPL status → availability_factor mapping

---

## Pipeline Integration Point

| Option | Description | Selected |
|--------|-------------|----------|
| Inside run.py (Recommended) | Follows set_piece_quality pattern — wrapped in its own try/except, same daily cron, consistent with every other enrichment module | ✓ |
| Standalone script, own cron | Separate pipeline/lineup_news.py on its own Vercel cron. More isolated but duplicates bootstrap fetch logic and complicates deployment | |

**User's choice:** Inside run.py

---

| Option | Description | Selected |
|--------|-------------|----------|
| Right after bootstrap fetch (Recommended) | lineup_news only needs bootstrap — run early so scrapers fire while rest of pipeline computes xmins/bonus/defcon | ✓ |
| After merged_players is written | Runs late in pipeline. Safer sequencing but adds latency | |

**User's choice:** Right after bootstrap fetch

---

## Scraper Merge Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| News text only — never change factor (Recommended) | Scrapers add news_headline / news_source field per player. availability_factor stays FPL-derived. No conflict resolution needed | ✓ |
| Scrapers can downgrade confidence | If reputable source reports player as 'out' but FPL shows 75%, scrapers lower availability_factor. Requires conflict resolution + scraped_factor vs fpl_factor distinction | |
| Player-matching only — no output | Scrapers just confirm which players have active news (boolean flag). No text, no factor changes | |

**User's choice:** News text only — never change factor

---

| Option | Description | Selected |
|--------|-------------|----------|
| Web name fuzzy match (Recommended) | Match scraped player names against FPL web_name / second_name using difflib. Unmatched logged but non-fatal | ✓ |
| Exact web_name match only | Fast but brittle — 'Salah' vs 'M.Salah' would miss | |
| No per-player matching — store raw text | Don't match to FPL IDs. Store raw scraped headlines in top-level news_articles[]. Phase 119 does matching at display time | |

**User's choice:** Web name fuzzy match

---

| Option | Description | Selected |
|--------|-------------|----------|
| news_headline + news_source (Recommended) | { id, availability_factor, status_label, news_headline: string\|null, news_source: enum\|null, scraped_at: ISO string } | ✓ |
| news_snippets[] array | Multiple snippets per player from multiple sources. Richer but more complex for Phase 119 | |
| news_text only (flat) | Just news_text: string\|null. Simplest but loses source attribution | |

**User's choice:** news_headline + news_source

---

## Refresh Schedule

| Option | Description | Selected |
|--------|-------------|----------|
| Daily — same as main pipeline | lineup_news refreshes once per day | |
| run.py is already running multiple times/day | lineup_news gets existing cadence automatically at no extra cost | ✓ |
| Need to increase run.py frequency | Currently daily but premierleague.com being 'hours earlier' suggests more frequent runs | |

**User's choice:** run.py is already running multiple times/day

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, 6h matches INFRA-01 (Recommended) | Consistent with useGWIntel and useSetPieces | ✓ |
| Shorter — 1h or 2h | Pipeline runs more than once per day so client should poll more aggressively | |

**User's choice:** Yes, 6h staleTime confirmed

---

## FPL Status → availability_factor Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| chance_of_playing as primary, status as fallback (Recommended) | null+status='a' → 1.0 \| 75 → 0.75 \| 50 → 0.5 \| 25 → 0.25 \| 0 → 0.0 \| status='i'/'s'/'u' → 0.0 \| null+status='d' → 0.5 | ✓ |
| Status field primary, chance as tiebreaker | status='a' → 1.0 \| status='d' uses chance_of_playing for sub-value. Identical outcomes, different priority ordering | |

**User's choice:** chance_of_playing as primary, status as fallback

---

| Option | Description | Selected |
|--------|-------------|----------|
| chance_of_playing wins regardless (Recommended) | If FPL sets chance_of_playing to 75, treat as 0.75 doubted even if status is 'a'. Avoids false confirmed_start signals | ✓ |
| status='a' always means confirmed_start | Force availability_factor=1.0 if status='a'. Simpler but could surface false confirmed_start for briefly-injured players | |

**User's choice:** chance_of_playing wins regardless

---

| Option | Description | Selected |
|--------|-------------|----------|
| 0.0 confirmed_absent for 'n', unknown label for rest (Recommended) | status='n' → 0.0 confirmed_absent. Unrecognised status → availability_factor=null, status_label='unknown'. Defensive and forward-compatible | ✓ |
| All unknown → 1.0 unknown | Assume available to avoid penalising players with data gaps. Risk: engine incorrectly recommends unavailable players | |

**User's choice:** 0.0 confirmed_absent for 'n', unknown for unrecognised status codes

---

## Claude's Discretion

- Fuzzy match threshold for player name matching: difflib cutoff to be determined by researcher (suggested ~0.7)

## Deferred Ideas

None.
