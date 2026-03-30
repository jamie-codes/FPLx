# FPL Analyst

## What This Is

A personal web app for Fantasy Premier League managers that pulls in your squad via FPL Team ID and surfaces actionable intelligence: which players to target, who to sell, hidden gems, DefCon candidates, form analysis, and transfer suggestions — all grounded in FPL API data plus Understat xG/xA.

v1.0 shipped as a complete daily-use tool. The manager enters their Team ID and receives ranked transfer suggestions, a Gem Rating table, DefCon analysis, Club Form, and Value Gems — all from a single daily pipeline run.

## Core Value

Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## Current Milestone: v1.1 Decision Engine

**Goal:** Turn the v1.0 data dashboard into an active decision assistant — projected points + minutes risk + buy/hold/sell + captaincy recommendations per player.

**Target features:**
- Projected Points engine — next 1 / 3 / 5 GW per player, computed in Python pipeline
- xMins / Minutes Risk model — expected minutes, start probability, rotation risk badges
- Buy / Hold / Sell recommendations — squad-level with replacement shortlist and projected delta
- Captaincy rankings — top-5 candidates, safe vs upside, projected captain points
- Explainability panel — "Why this player" reasons + risk flags per recommendation
- FPL login (session-cookie) — exact bank + sell price via `/api/my-team`

---

## Current State (v1.1 — Phase 12 complete — milestone complete)

v1.0 shipped 2026-03-29. Phase 7 complete 2026-03-30 — pipeline computes `proj_pts_1gw/3gw/5gw`, `xmins`, `start_prob`, and `mins_risk` for all 825 players. Phase 8 complete 2026-03-30 — rotation risk badges visible on SquadView, GemTable, and TransferPanel; transfer engine de-prioritises rotation risks. Phase 9 complete 2026-03-30 — GemTable has sortable projected points columns with 1 GW / 3 GW / 5 GW toggle; TransferPanel shows "Proj pts (1 GW): X.X → Y.Y" on every suggestion card. Phase 10 complete — Buy/Hold/Sell recommendations and captaincy rankings engine live. Phase 11 complete 2026-03-30 — Explainability panel (`ExplainPanel.tsx`) wired into SquadView; `computeExplanations` generates natural-language reasons per player; `computeReplacementShortlist` surfaces ranked alternatives for Sell-verdicted players. Phase 12 complete 2026-03-30 — FPL session-cookie auth live: login/logout/status/my-team route handlers, `useAuthStatus`/`useMyTeam` TanStack Query hooks, inline login nudge in TransferPanel, exact sell prices and bank balance in SquadView (AUTH-01, AUTH-02 validated).

**Tech stack:** Next.js 16, React 19, TypeScript, TanStack Table v8, TanStack Query, Tailwind CSS v4, Vitest, Python (requests, pandas, soccerdata), Vercel Blob

**Codebase:** ~6,600 LOC, 166 files

**What's running:**
- `/` — Gem Ratings tab (default), DefCon tab, Squad tab, Club Form tab, Value Gems tab
- `/api/players` — merged FPL+Understat dataset from Vercel Blob
- `/api/defcon` — DefCon stats from pipeline cache
- `/api/club-form` — club form computed from fixtures
- `/api/last-updated` — timestamp of last pipeline run
- `pipeline/run.py` — daily refresh (manual; GitHub Actions cron scaffolded)

**Known gaps carried forward to v1.1:**
- DAT-01: GitHub Actions daily cron not verified as operational

## Requirements

### Validated (v1.0)

**Data Pipeline & API Layer**
- ✓ FPL proxy Route Handler — server-side CORS-free fetches via `/api/fpl/[...proxy]` — v1.0
- ✓ Zod validation adapter — structured failure on field changes, stale-cache fallback — v1.0
- ✓ 825-entry `player_id_map.json` (782 matched, 43 null Understat entries) — v1.0
- ✓ Python pipeline: FPL + Understat xG/xA merged, per-90 normalised, custom FDR — v1.0
- ✓ `GET /api/players` from Vercel Blob, `usePlayers()` with 6h stale time — v1.0
- ✓ `cost_change_event` / `cost_change_start` fields in pipeline and `MergedPlayer` type — v1.0

**Gem Rating Table** — v1.0
- ✓ `computeAllGemScores` scores every player across 7 dimensions with min-max normalisation
- ✓ Null xG/xA excluded from composite (not zero-filled); displayed as em-dash
- ✓ Sortable/filterable TanStack Table at `/`, position filter, component scores per row

**DefCon Analysis** — v1.0
- ✓ Per-match hit rates from `element-summary` (DEF=10, MID/FWD=12 per-match thresholds)
- ✓ `pipeline/defcon.py` + `defcon_stats.json`, two position-split sortable tables

**Squad View & Transfer Suggestions** — v1.0
- ✓ Team ID input → squad split by position (GK/DEF/MID/FWD) with price, own%, mins, flags
- ✓ Transfer engine: position lock, approximate budget, chip guard, save recommendation
- ✓ Ranked by Gem delta; affordable suggestions sorted before unaffordable

**Club Form, Value Gems & Polish** — v1.0
- ✓ `computeClubForm()` rolling 5-game window, DGW-safe
- ✓ `isCheapGem` / `isLowOwned` filter predicates; Value Gems tab with filter pills
- ✓ `PriceTrendCell` on GemTable, ValueGemsTable, TransferPanel (NaN guards: `?? 0`)
- ✓ `FixtureBadges` (next 5, colour-coded H/A) on Club Form + Gem Ratings
- ✓ `LastUpdated` component (amber when stale), `tier()` inversion fixed

### Active (v1.1)

- [x] PROJ-01: Projected points next GW per player (Python pipeline) — Validated in Phase 7: Pipeline Schema Extension
- [x] PROJ-02: Projected points next 3 GW per player (Python pipeline) — Validated in Phase 7: Pipeline Schema Extension
- [x] PROJ-03: Projected points next 5 GW per player (Python pipeline) — Validated in Phase 7: Pipeline Schema Extension
- [x] MINS-01: Expected minutes and start probability per player — Validated in Phase 7: Pipeline Schema Extension
- [x] MINS-02: Minutes risk badge (Nailed / Likely start / Rotation risk / Cameo risk) — Validated in Phase 8: Minutes Risk UI + Transfer Integration
- [x] MINS-03: Transfer suggestions de-prioritise rotation-risk buy candidates — Validated in Phase 8: Minutes Risk UI + Transfer Integration
- [x] PROJ-04: Projected points columns in GemTable (sortable, 1/3/5 GW toggle) and TransferPanel — Validated in Phase 9: Projected Points Columns
- [ ] REC-01: Buy / Hold / Sell recommendation per squad player
- [ ] REC-02: Replacement shortlist with projected points delta per transfer suggestion
- [ ] CAP-01: Captaincy rankings — top-5 candidates for next GW
- [ ] CAP-02: Safe vs upside captain split, projected captain points
- [ ] EXP-01: Explainability panel — "Why this player" reasons per recommendation
- [ ] EXP-02: Risk flags per player (rotation concern, fixture swing, regression risk, etc.)
- [ ] AUTH-01: Optional FPL login (session-cookie) for exact bank balance and sell price
- [ ] AUTH-02: `selling_price` from `my-team` endpoint for exact sell price display

### Active (carry-forward, deferred)

- [ ] DAT-01: Verified automated daily refresh — GitHub Actions cron confirmed operational

### Out of Scope

- Live in-match updates — data refreshes daily, not during gameweeks
- Mini-league or head-to-head analysis — squad optimisation focus only
- Mobile app — web only
- FPL chip strategy (Wildcard, Free Hit, Triple Captain) — out of scope for v1
- Offline mode — daily refresh is sufficient

## Context

- **FPL API**: Official undocumented API at `https://fantasy.premierleague.com/api/`
- **Understat**: Shot-level xG/xA via soccerdata Python library
- **DefCon rule**: 2025/26 season. DEF threshold=10 defensive contributions, MID/FWD threshold=12. Award=+2 pts.
- **Transfer rules**: Position-locked. Free transfers accumulate to 2/week; extra cost 4 pts each.
- **Auth**: Session-cookie auth (not OAuth). v1 uses Team ID only (public API).

## Constraints

- **Auth**: FPL login uses session-cookie auth — handle securely, nothing persistent
- **Data**: Understat scraping needs rate limiting / caching
- **API**: FPL API undocumented — adapter layer isolates breakage
- **Single user**: Personal tool — no multi-tenancy, no DB required
- **Refresh**: Once-daily sufficient; no real-time requirements

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Custom FDR from rolling xGA (not official integers) | Official FDR doesn't reflect actual team strength | ✓ Good — produces meaningful difficulty tiers |
| `merged_players.json` as single source of truth | One schema for all downstream UI phases | ✓ Good — prevented type drift across 6 phases |
| No database for v1 | Single-user tool; cached JSON sufficient | ✓ Good — no infra overhead |
| Zod 4 unknown-field stripping | Zod 4 strips by default — no `.strip()` needed | ✓ Good — simpler adapter code |
| `parseFPLBootstrap` wraps `safeParse` | Callers decide throw-vs-stale-cache | ✓ Good — flexible error handling per context |
| USE_BLOB env var for Blob vs local cache routing | Dev/prod parity without Blob credentials locally | ✓ Good — smooth dev workflow |
| `usePlayers` single query key `['players']` with 6h stale | Prevents duplicate fetches across tabs | ✓ Good — single request per session |
| Page.tsx as client component (Phase 4) | Both GemTable and DefConTables are client components; server wrapper adds no benefit | ✓ Good — simpler tab state management |
| Transfer sort: affordable before unaffordable, then gem_delta desc | Actionable suggestions first | ✓ Good — user sees what they can actually do |
| `tier()` return-value swap (Phase 6 gap) | Thresholds were correct; only return labels were swapped | ✓ Fixed — Man City now shows red (hard) |
| `?? 0` guards for `cost_change_event/start` | Fields absent from older cached data; Math.abs(undefined)=NaN | ✓ Fixed — price trend never shows NaN |
| FPL login is v1.x (not v1) | Session-cookie auth complexity deferred | — v1.1 candidate |
| Daily refresh cadence | FPL data updates post-gameweek; real-time adds complexity | — Accepted constraint |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 — Phase 9 complete, projected points columns + GW toggle*
