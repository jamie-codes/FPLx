# FPL Analyst

## What This Is

A personal web app for Fantasy Premier League managers that pulls in your squad via FPL Team ID (or login) and surfaces actionable intelligence: which players to target, who to sell, hidden gems, DefCon candidates, form analysis, and transfer suggestions — all grounded in FPL API data plus Understat xG/xA.

## Core Value

Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Team Input & Squad View**
- [ ] Enter FPL Team ID to pull current squad (public API, no login needed)
- [ ] Optional FPL login (email/password) to fetch bank balance and remaining transfers
- [ ] Display squad split by position (GK / DEF / MID / FWD) with price, ownership %, minutes played, and injury/flag status

**Upcoming Gem Rating**
- [ ] Score each player across multiple dimensions and show an "Upcoming Gem" composite rating
- [ ] Displayed as a sortable table, filterable by position (GK / DEF / MID / FWD)
- [ ] Dimensions feeding the score: fixture difficulty, form, xG/xA, ownership %, minutes reliability, set piece role, DefCon likelihood

**Form & Fixture Analysis**
- [ ] Players about to go on a high-scoring run: scored >2 pts last game(s) AND have favourable upcoming fixtures AND show high xG or xA recently
- [ ] Players currently on a high-scoring run: highlight whether upcoming fixtures are easy/hard and home/away
- [ ] Club form table: wins, goals scored, goals conceded over last N weeks
- [ ] Most in-form players: highest points scorer over last N games

**DefCon Analysis**
- [ ] Per-position thresholds: DEF needs 10 defensive contributions, MID/FWD need 12
- [ ] Per player: DefCon hit rate (% of games they achieved +2), average defensive contributions per 90, distance to threshold
- [ ] Hypothesis analysis: do players get more DefCon in tough vs easy fixtures?
- [ ] Separate ranking tables per position — no combined table (thresholds differ)

**Value & Ownership**
- [ ] Cheap gems: relatively cheap players getting disproportionate points
- [ ] Low-owned but high-scoring: players with ownership < X% but strong recent returns
- [ ] Show current price and price change trend for all analysed players

**Player Profile Signals**
- [ ] Penalty taker, set piece taker, corner taker flags
- [ ] Minutes reliability: average minutes per game, consistency indicator
- [ ] xG per 90 and xA per 90 (from Understat)
- [ ] Injury / availability status from FPL flags

**Transfer Suggestions**
- [ ] Suggest who to sell or sub out based on recent performance and upcoming fixtures
- [ ] For each sell candidate: show up to 3 replacement options ranked by Upcoming Gem rating
- [ ] Enforce position rules (MID → MID, FWD → FWD, etc.)
- [ ] Factor in bank balance + sale value: only suggest affordable transfers
- [ ] Suggest multi-transfer combinations if user has available free transfers
- [ ] If no strong transfers available, recommend saving the transfer
- [ ] Show how many free transfers the user has (from login or user input fallback)

**Data & Refresh**
- [ ] Data refreshed once daily (FPL API + Understat)
- [ ] Show "last updated" timestamp on all data views

**UI / UX**
- [ ] Clear, data-forward layout using tabs or cards per section
- [ ] Scannable tables with sort/filter by position
- [ ] Visual indicators for fixture difficulty (colour-coded easy/hard)
- [ ] Home/away clearly distinguished

### Out of Scope

- Live in-match updates — data refreshes daily, not during gameweeks
- Mini-league or head-to-head analysis — focused on squad optimisation only
- Mobile app — web only for v1
- FPL chip strategy (Wildcard, Free Hit, Triple Captain) — out of scope for v1

## Context

- **FPL API**: Official undocumented API at `https://fantasy.premierleague.com/api/` — provides prices, ownership, fixtures, positions, flags, player history, squad data, and (with login) bank/transfers. Reference: https://ukretroaming.co.uk/blogs/blog/a-complete-guide-to-the-fantasy-premier-league-fpl-api
- **Understat**: Python/scraping source for shot-level xG and xA data per player — richer than FPL's built-in expected stats
- **DefCon rule**: Introduced 2025/26 season. DEF threshold = 10 defensive contributions (clearances, blocks, interceptions, recoveries, tackles). MID/FWD threshold = 12. Award = +2 pts. Active CBs/full-backs most likely; box-to-box midfielders more so than attacking 10s; pressing forwards rarely.
- **Transfer rules**: Position-locked (can only swap like-for-like position). Free transfers accumulate up to 2 per week; extra transfers cost 4 pts each.
- **Comparison reference**: https://www.fplcore.com/comparison — example of FPL comparison UI for inspiration

## Constraints

- **Auth**: FPL login uses session-cookie auth (not OAuth) — handle securely, store nothing persistent
- **Data**: Understat scraping may need rate limiting / caching to avoid being blocked
- **API**: FPL API has no official docs and may change; build with adapter layer to isolate breakage
- **Single user**: Personal tool — no multi-tenancy, no user accounts, no DB required for v1
- **Refresh cadence**: Once-daily data pull is sufficient; no real-time requirements

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Understat for xG/xA (not FPL only) | FPL's built-in xG/xA is less granular; Understat provides shot-level data for better DefCon and gem detection | — Pending |
| Daily refresh (not real-time) | FPL data updates once daily post-gameweek; real-time adds complexity with no benefit | — Pending |
| FPL login optional (Team ID primary) | Most useful features work with public data; login unlocks transfer budget/transfer count | — Pending |
| No database for v1 | Single-user tool; cached JSON files or in-memory state sufficient | — Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after initialization*
