# Features Research: v1.22 Lineup Intelligence

**Domain:** Lineup news scraping and player status intelligence for FPL tools
**Researched:** 2026-05-17
**Overall confidence:** HIGH (existing codebase constraints, MEDIUM on scraper technical feasibility)

---

## Table Stakes

Features that FPL managers universally expect from a tool claiming to surface "team news". Missing any of these makes the feature feel half-baked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| FPL official status passthrough | The FPL API already publishes `status`, `chance_of_playing_next_round`, `news`, `news_added` per player. Any tool that ignores these is starting behind. | Low | Already partially wired via NewsBanner. `status` values: `a`/`d`/`i`/`s`/`u`/`n`. `chance_of_playing_next_round` is `null` (healthy), `75`, `50`, `25`, or `0`. |
| Severity colouring for doubts and absences | Red for <=50% chance, amber for 75%, zinc for news-only. Managers cannot absorb raw numbers — they need a fast visual signal. | Low | Already implemented in `computeNewsSeverity()` + `NewsBanner`. |
| Squad-player filtering | Only show news for players the manager actually owns. Nobody wants a full 500-player injury list. | Low | Implied by INTEL-04: Decision Summary card scoped to owned squad. |
| Staleness suppression | Old zinc news (informational, not injury-flagged) should age out. Stale amber/red never disappear until chance_of_playing recovers. | Low | Already shipped: 14-day `isStale` gate in `NewsBanner` (NEWS-01). |
| Transfer suggestion exclusion of absent players | Suggesting a player confirmed absent (chance=0) as a buy is harmful. Engine must downweight or exclude such players. | Medium | INTEL-01. Not yet implemented — `suggestTransfers()` currently uses raw xPts with no news penalty. |
| Captain surface warning | Displaying a captain candidate without flagging their doubt/absence is a significant omission. | Low | INTEL-02. CaptainPicksPanel has `NewsBanner` inline (NEWS-02) but no explicit status badge or ranking adjustment. |
| News recency signal | FPL `news_added` timestamp tells you when the news was set. Managers want to know "was this updated before or after the last press conference?" | Low | Already available on the player object; displayed via NewsBanner. |

---

## Differentiators

Features that distinguish a tool and reward engaged users. Not universally expected, but meaningful to anyone who discovers them.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-source scraping with source-tier labeling | The FPL API news lags reality by hours. Sky Sports / BBC Sport / press-conference aggregators often have news 12-24 hours earlier. Labeling the source ("FPL official" vs "Sky Sports" vs "community report") lets the manager calibrate confidence. | High | SCRAPER-01. Sky Sports injury page uses Datawrapper embedded tables (JS-rendered). BBC Sport injury content is embedded in match preview articles. PL official injury page uses static HTML. All require selector maintenance. |
| Availability confidence tiers from scraped news | Convert free-text to a structured three-tier schema: `confirmed` (press-conference quote), `high` (reputable outlet named source), `low` (community account, rumour). Different tiers warrant different penalty magnitudes in engines. | High | The source tier model proposed in the milestone context. No existing FPL tool in the ecosystem does this systematically — it is genuinely differentiated. |
| benchOrder downweighting for rotation/absence | If `benchOrder()` has no news signal, it ranks a confirmed-absent player ahead of a healthy lower-starter-probability player. Adding a news penalty multiplier (e.g. 0.0 for confirmed absent, 0.5 for doubtful) makes bench advice far more useful. | Medium | INTEL-03. The `evScore` formula `start_prob x xPts x fixtures.length` is the correct insertion point — multiply by `availabilityFactor`. |
| Team News Alert card in Decision Summary | A severity-badged weekly digest card that lists only the manager's squad players with active, non-stale news. Gives managers a one-glance pre-deadline check. | Medium | INTEL-04. Fits the existing layout in DecisionSummaryTab alongside the 4-card grid and CalibrationHealthIndicator. |
| Captain status badge (beyond text news) | A distinct visual status indicator (confirmed-starter green ring, doubt amber ring, absent red cross) is faster to scan than reading news text in a candidate list. | Low | INTEL-02. Complements existing NewsBanner, does not replace it. |
| Scraper timestamp in pipeline output | Recording when each source was last fetched (not just when FPL set the news) lets the UI show "Sky Sports: updated 2h ago" rather than leaving the manager guessing. | Low | A `scraped_at` ISO field per source tier in `lineup_news.json`. |

---

## Anti-Features (Avoid)

Features that seem tempting but cause more harm than value for this single-user personal tool.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Twitter/X scraping via DIY token reversal | X Terms of Service explicitly prohibit automated access. Guest tokens expire every 2-4 hours, `doc_id` values rotate every 2-4 weeks, datacenter IPs are blocked instantly. Maintenance cost is approximately 10-15 hours per month. Legal exposure from X Corp. v. Bright Data (2024) precedent. The paid API starts at $42,000/year. | Use Sky Sports / BBC Sport / premierleague.com as sources. The same news propagates from press conferences to all outlets within hours. Exclude Twitter/X entirely from SCRAPER-01 scope. |
| Full predicted lineup scraping | Predicting starting 11s requires formation analysis, manager tendencies, and opponent context — a separate, higher-complexity problem. It is not the same as injury/availability news and adds a full new scraping surface. | Scope to injury/doubt/absence status only. Predicted lineups are a future feature if ever needed. |
| Real-time scraping during match day | This is a personal tool with once-daily pipeline refresh via GitHub Actions cron. Real-time scraping requires a separate trigger mechanism, rate-limit handling, and UI push notifications — infrastructure that does not exist. | Run the scraper as part of the daily pipeline. A pre-deadline cron trigger (e.g. 30 minutes before each Friday 18:30 BST deadline) is the correct extension if freshness becomes a problem later. |
| Per-player confidence scoring from LLM | Parsing free-text injury reports with Claude to assign numerical confidence values adds Anthropic API cost to the pipeline (not just the UI route). The existing controls (INSIGHT_BATCH_ENABLED gate, Anthropic Console cap) were designed to prevent uncontrolled pipeline spend. | Use rule-based source-tier confidence: FPL API = highest, reputable sports outlet = high. No LLM needed in the scraper. |
| Storing raw scraped HTML/text in Blob | Blob storage costs money per byte and per read. Raw scraped content from multiple sources per GW is wasteful and has no downstream consumer. | Write only the final `lineup_news.json` (one entry per player, merged from all sources, with source_tier and confidence). |
| Showing news for non-owned players in Decision Summary | The Decision Summary is a squad-player-centric view. Surfacing injury news for 500 players the manager does not own creates noise and obscures actionable signals. | Scope the Team News Alert card to owned squad only. Transfer suggestions already surface news inline via existing NewsBanner on OpportunityCostTable. |
| Changing captain pick ranking based on news | Managers often want to see who the best captain would be if a doubtful player returns. Removing or demoting a candidate from the list obscures useful information. | Add visual status badges (INTEL-02) without altering ranking. The `chance_of_playing_next_round` value already appears in `computeNewsSeverity`; let the manager decide. |

---

## Player Status Schema

This is the contract that all five features (SCRAPER-01, INTEL-01 through INTEL-04) must share. Existing fields from FPL API are carried through already; new fields are additions.

### Existing FPL API Fields (already in MergedPlayer / types.ts)

| Field | Type | Values | Source |
|-------|------|--------|--------|
| `status` | `PlayerStatus` | `'a'` `'d'` `'i'` `'s'` `'u'` `'n'` | FPL API bootstrap-static |
| `chance_of_playing_next_round` | `number or null` | `null` (healthy), `0`, `25`, `50`, `75` | FPL API bootstrap-static |
| `news` | `string` | Free-text from FPL (e.g. "Hamstring injury - 50% chance of playing") | FPL API bootstrap-static |
| `news_added` | `string or undefined` | ISO 8601 timestamp | FPL API bootstrap-static |

### Existing Derived Signals (already in codebase)

| Field | Logic | Where Used |
|-------|-------|-----------|
| `NewsSeverity` | `'red'` (<=50%), `'amber'` (75%), `'zinc'` (news only), `'none'` | `computeNewsSeverity()` in `src/lib/newsSeverity.ts` feeds `NewsBanner` |
| `isStale` | `news_added` > 14 days old, suppress zinc badges | `NewsBanner` NEWS-01 (Phase 115) |

### New Fields from SCRAPER-01 (lineup_news.json)

These fields are written by the Python pipeline scraper and merged into `MergedPlayer` at pipeline run time. They augment (do not replace) the FPL native fields.

```
PlayerNewsEntry {
  element_id: number          // FPL player ID — join key to MergedPlayer
  source_tier: 'official' | 'reputable' | 'community'
  source_name: string         // e.g. "FPL API", "Sky Sports", "BBC Sport", "PL Official"
  scraped_at: string          // ISO 8601 UTC — when this entry was last fetched
  availability: 'confirmed' | 'doubt' | 'absent' | 'unknown'
  availability_factor: number // 1.0=healthy, 0.75=doubt-75, 0.5=doubt-50, 0.25=doubt-25, 0.0=absent
  scraped_news_text: string   // supplementary display text (empty if only FPL official available)
}
```

### Derived availability_factor Mapping

| Source Tier | Availability | availability_factor |
|-------------|-------------|---------------------|
| Any | `confirmed` | `1.0` |
| Any | `unknown` | `1.0` (no penalty without evidence) |
| `official` | derived from `chance_of_playing_next_round` | `0.75` / `0.5` / `0.25` / `0.0` per FPL value |
| `reputable` | `doubt` | `0.75` (unless FPL official has a more specific value) |
| `reputable` | `absent` | `0.0` |

The canonical source is the highest-priority tier for a player. `official` overrides `reputable`. When tiers conflict, the more pessimistic availability wins if the source tier is equal; the higher tier wins if tiers differ.

### MergedPlayer Extension

These fields are added to `merged_players.json` by `pipeline/merge.py` after `lineup_news.json` is loaded.

```
availability_factor?: number      // 0.0-1.0; absent means undefined, treat as 1.0 in engines
scraped_news_text?: string        // supplementary display text beyond FPL native `news`
scraped_source?: string           // e.g. "Sky Sports" for UI attribution
scraped_at?: string               // ISO 8601 of when scraper last checked this player
```

---

## Source Tier Model

### Tier Definitions

| Tier | Sources | Confidence Basis | Scraping Approach |
|------|---------|-----------------|-------------------|
| `official` | FPL API bootstrap-static | Updated by Premier League/FPL directly. Structured numeric chance values. | Existing `fpl_client.get_bootstrap_static()` — no new scraping needed |
| `reputable` | premierleague.com/en/latest-player-injuries, Sky Sports injury article, BBC Sport match previews | Named journalist/club sources. Press-conference quotes. Typically 12-24h ahead of FPL updates. | `requests` + `BeautifulSoup`. PL official is most reliable (same data pipeline as FPL). Sky Sports static article URL preferred over the Datawrapper-rendered interactive table. |
| `community` | (Explicitly de-scoped — Twitter/X excluded from v1.22) | n/a | n/a |

### Scraping Strategy per Source

**FPL API (official, already implemented):** `fpl_client.get_bootstrap_static()` provides all player objects. This is the primary source. Scraped sources are supplements only.

**premierleague.com/en/latest-player-injuries (reputable, highest priority within tier):** Static HTML updated with the same information that feeds the FPL API — often hours earlier. Per-club sections with player name, injury type, expected return. Use `requests` with a standard browser `User-Agent` header. This is the most structurally stable source.

**Sky Sports injury tracker (reputable):** The interactive version embeds Datawrapper charts (JS-rendered, not scrapable via `requests`). However Sky Sports also publishes a static prose article with club-by-club injury sections as HTML paragraphs. Use the article URL and extract player names and doubt/absent language from prose. Parsing is heuristic — players are mentioned by surname in free text. Flag extracted entries as `confidence: 'medium'` to reflect parsing uncertainty.

**BBC Sport (reputable, lowest priority):** Injury/availability content is embedded in match preview articles rather than a dedicated injury page. Less reliably structured than PL official or Sky Sports. Treat as a supplementary signal to confirm existing data, not a primary source.

**Fallback rule:** If Sky Sports or BBC scraping fails (network error, Cloudflare block, selector mismatch), the pipeline must still write `lineup_news.json` using FPL API data alone. Scraping failures are non-fatal and must be logged but not raise exceptions.

### Penalty Application in Existing Engines

| Engine | Integration Point | Penalty Logic |
|--------|-----------------|---------------|
| `suggestTransfers()` in `suggest-transfers.ts` (INTEL-01) | `scorePlayer()` function, line ~111 | `score = horizonScore(p) * (p.availability_factor ?? 1.0)`. Players with `availability_factor === 0.0` score 0 and never enter the buy pool (already filtered by `xPtsGain <= 0` check). |
| `benchOrder()` in `optimise-lineup.ts` (INTEL-03) | `evScore` arrow function, line ~190 | `evScore = start_prob * xPts * fixtures.length * (p.availability_factor ?? 1.0)`. Confirmed-absent bench player scores 0 and sinks to last slot (consistent with BGW treatment). |
| `CaptainPicksPanel` / `CandidateRow` (INTEL-02) | Visual badge only, no ranking change | Add `StatusBadge` component: green ring for `confirmed`, amber for `doubt`, red cross for `absent`. Renders adjacent to existing `NewsBanner`. |
| `DecisionSummaryTab` (INTEL-04) | New "Team News Alert" card | Filters `currentSquad` for players where `computeNewsSeverity(p.chance_of_playing_next_round, p.news) !== 'none'` and `!isStale(p.news_added)`. Severity-sorted list with player name, team, and news text. |

### Update Frequency

The scraper runs as part of the daily GitHub Actions pipeline. The `scraped_at` field allows the UI to display "Sky Sports checked Xh ago". Given once-daily updates:

- Pre-deadline window (typically Thursday/Friday before 18:30 BST deadline): scraper should run at least once after Thursday press conferences have concluded.
- FPL API `news_added` is the gold standard for staleness; `scraped_at` is informational for reputable tier data.
- A missing `scraped_at` (scraper failed) should degrade to FPL official data without breaking the UI.

---

## Feature Dependencies on Existing v1.21 Engines

| v1.22 Feature | Depends On | Risk if Dependency Changes |
|---------------|-----------|---------------------------|
| INTEL-01 (suggestTransfers penalty) | `suggestTransfers()` `scorePlayer()` inner function (lines 111-113 in suggest-transfers.ts) | Low — named helper with a clear extension point |
| INTEL-03 (benchOrder penalty) | `benchOrder()` `evScore` anonymous arrow function (line ~190 in optimise-lineup.ts) | Low — single insertion point, formula is documented |
| INTEL-02 (captain badge) | `CaptainPicksPanel` `CandidateRow` sub-component | Low — `NewsBanner` wiring (NEWS-02) establishes the prop-threading pattern |
| INTEL-04 (Decision Summary card) | `DecisionSummaryTab` layout, existing 4-card grid + CalibrationHealthIndicator | Medium — grid is at capacity; fifth element needs layout consideration |
| All INTEL features | `lineup_news.json` being written to Blob by SCRAPER-01 | High — if scraper fails silently, `availability_factor` is absent. Engines must treat `undefined` as `1.0` (no penalty) to degrade gracefully. |

---

## UX Behavior Expectations

**Confirmed-absent in transfer suggestions:** A player with `availability_factor === 0.0` will have their xPts multiplied to zero, so they will naturally never appear in the buy pool (the `xPtsGain <= 0` guard in `suggestTransfers` will filter them). No explicit exclusion logic needed — the penalty formula handles it.

**Doubtful in buy pool:** A player with `availability_factor === 0.5` will appear ranked lower than an equivalent player without news. The existing `NewsBanner` on `OpportunityCostTable` provides the visual warning. No additional suppression needed.

**Captain picks ranking vs news:** Do not adjust ranking order of captain candidates based on news. The status badge (INTEL-02) provides the warning signal without removing information the manager may want (e.g. "who would I captain if Salah returns?").

**Bench order and confirmed absence:** A bench player with `availability_factor === 0.0` will score 0 in `evScore`, sinking them to the last bench slot. This is consistent with how BGW players (fixtures.length === 0) already work.

**Team News Alert card trigger:** Render the card only when at least one owned player has active, non-stale news (severity !== 'none'). If no squad players have active news, do not render the card. An empty card is worse than no card.

**Source attribution:** Show "FPL" or "Sky Sports" as a small muted label next to the news text only when source differs from FPL native. Do not show attribution for `official` tier — it is the baseline.

---

## Complexity Assessment

| Feature | Effort Estimate | Primary Risk |
|---------|----------------|-------------|
| SCRAPER-01 (pipeline scraper) | High — 2-3 days | Sky Sports Datawrapper embed requires finding the static article URL; HTML structure changes without notice; Cloudflare can block `requests` on some targets; name extraction from prose is heuristic |
| INTEL-01 (suggestTransfers penalty) | Low — 2-4 hours | Clean insertion point in `scorePlayer()`; requires `availability_factor` field to be present in `MergedPlayer` |
| INTEL-02 (captain badge) | Low — 2-4 hours | Prop-threading pattern established by NEWS-02; new `StatusBadge` component is minimal |
| INTEL-03 (benchOrder penalty) | Low — 2-4 hours | Single `evScore` insertion point; TDD tests will need updating |
| INTEL-04 (Decision Summary card) | Medium — 4-6 hours | Layout within existing DecisionSummaryTab, filtering logic, severity sorting, empty-state handling |

SCRAPER-01 is the hard dependency for all INTEL features. It must be built first. INTEL-01 through INTEL-04 can proceed in parallel once `lineup_news.json` is being emitted (even if the scraped content initially only reflects FPL official data).
