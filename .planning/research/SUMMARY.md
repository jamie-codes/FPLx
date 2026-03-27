# Project Research Summary

**Project:** FPL Analyst
**Domain:** Personal FPL analytics web app (squad optimisation tool)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

FPL Analyst is a personal squad-management tool that merges two data sources — the FPL API (player data, prices, ownership, DefCon stats, squad picks) and Understat (shot-level xG/xA via soccerdata) — into a single ranked view of which players to target and which to sell. The recommended approach is a two-runtime architecture: a Python pipeline (soccerdata + requests + pandas) runs daily via GitHub Actions, writes scored JSON to Vercel Blob, and a Next.js 16 app serves that cached data through Route Handler endpoints to a React/TanStack/shadcn/ui frontend. No database is needed. This is the minimal viable architecture for a single-user analytics tool — adding more infrastructure would be over-engineering.

The recommended stack is sound and well-matched to the constraints. Next.js is the correct choice specifically because the FPL API blocks direct browser requests via CORS — Route Handlers provide a server-side proxy for free. The Python pipeline is justified because no maintained Node.js equivalent exists for Understat scraping. The file-based JSON cache (Vercel Blob) is appropriate for data that refreshes once daily. All major technologies (Next.js 16, Tailwind v4, shadcn/ui, TanStack Query v5, soccerdata 1.8.8) are confirmed stable as of March 2026.

The principal risks are not architectural but data-layer: the FPL/Understat player ID mismatch will silently corrupt xG/xA for roughly 20% of players if not addressed upfront; the sell price logic (50% profit tax, rounded down) will cause transfer budget errors if using `now_cost` instead of `selling_price`; and the custom FDR must be built from scratch — the official FPL FDR is well-documented as unreliable. All three of these must be resolved in the foundation phase, not retrofitted later.

---

## Key Findings

### Recommended Stack

Next.js 16 (App Router) is the full-stack framework. It handles both the React frontend and the FPL proxy — all calls to `fantasy.premierleague.com/api/` go through Next.js Route Handlers server-side, which completely sidesteps the CORS block. Tailwind CSS v4 and shadcn/ui provide the component layer; TanStack Table v8 handles the sortable/filterable data tables that are the core UI pattern; TanStack Query v5 manages client-side caching (staleTime=6h, matching the daily refresh cadence). The Python pipeline is an entirely separate runtime running in GitHub Actions — it is not part of the Next.js deploy.

**Core technologies:**
- Next.js 16 (App Router): full-stack framework + FPL proxy — mandatory to bypass CORS
- Python 3.11 + soccerdata 1.8.8: Understat xG/xA pipeline — no Node.js equivalent exists
- Vercel Blob: persistent JSON cache between pipeline runs — free tier, Vercel-native
- TanStack Table v8 (via shadcn/ui): sortable/filterable tables — core UI pattern for this app
- TanStack Query v5: client data fetching + 6h stale cache — avoids redundant fetches
- Recharts: fixture heatmaps and form trend lines — direct (not Tremor wrapper)
- TypeScript 5.x + Zod: API boundary validation — catches FPL field renames loudly

See `.planning/research/STACK.md` for full rationale and alternatives considered.

### Expected Features

**Must have (table stakes):**
- Player list with price, ownership, form, and injury status
- Fixture difficulty display (custom xG/xGA-based FDR, NOT official FDR)
- Squad view via Team ID input
- Sort/filter by position
- "Last updated" timestamp on all data views

**Should have (differentiators):**
- Gem composite rating — 7-dimension score (fixture difficulty, form per-90, xG/xA, ownership, minutes reliability, set piece role, DefCon likelihood)
- DefCon analysis — per-position hit rate tables (DEF threshold=10, MID/FWD threshold=12); uses per-match `element-summary` history, not season aggregates
- Transfer suggestions — ranked by Gem delta, enforces position-lock, uses `selling_price` (not `now_cost`) for budget
- Club form table — wins, goals scored/conceded over rolling window
- Value/cheap gems — low-owned high-scorers

**Defer to v1.x:**
- FPL login for exact selling prices and transfer count (enhances transfers; not required for core value)
- Multi-transfer combinations (requires Gem scores to exist first)
- DefCon hypothesis analysis (tough vs easy fixture correlation)

**Defer to v2+:**
- Historical season comparison, price prediction, mobile-optimised layout

See `.planning/research/FEATURES.md` for full dependency tree and prioritisation matrix.

### Architecture Approach

The system has a clean separation between an async data pipeline and a synchronous web app. The pipeline writes to Vercel Blob; the Next.js app reads from it. They never communicate directly. The key architectural boundaries are: (1) a `lib/fpl-adapter.ts` module that is the sole owner of raw FPL field names — downstream code uses internal domain types only; (2) scoring logic lives in `pipeline/scoring.py` (pre-computed at pipeline time) with a TypeScript port for client-side re-ranking; (3) Route Handlers do not call the FPL API directly on each request — they serve from Blob.

**Major components:**
1. `pipeline/` (Python) — fetch FPL + Understat, merge on `player_id_map.json`, compute scores, upload JSON to Blob
2. `src/app/api/` (Next.js Route Handlers) — serve cached JSON from Blob; proxy live FPL calls (squad/picks endpoint)
3. `src/components/` (React) — GemTable, DefConTable, TransferPanel, SquadView via TanStack Query hooks
4. `src/lib/fpl-adapter.ts` — isolates all FPL API field names; Zod schema validates at ingestion boundary
5. GitHub Actions cron — triggers `pipeline/run.py` daily

See `.planning/research/ARCHITECTURE.md` for data flow diagrams and anti-patterns.

### Critical Pitfalls

1. **CORS blocks all browser-to-FPL-API calls** — Build the Next.js Route Handler proxy in Phase 1 and never prototype with direct browser fetches. Recovery after the fact is a medium-effort refactor.

2. **Understat player names do not match FPL names** — Build `player_id_map.json` (FPL ID to Understat ID) before any xG/xA feature. String-match joins silently drop ~20% of players. This gates the Gem score and all Understat-dependent features.

3. **Sell price is NOT the current buy price** — Use `selling_price` from the authenticated `my-team/{id}/` endpoint. Using `now_cost` overestimates available budget by up to £0.2m per player. For unauthenticated mode, label estimates as approximate.

4. **DGW/BGW distorts form metrics** — Normalise all stats per 90 minutes, not per gameweek. A player in a Double Gameweek plays twice in one "gameweek" slot; raw gameweek totals make them look twice as hot. This must be designed into the form calculation from the start.

5. **Official FPL FDR is unreliable** — Compute a custom FDR from rolling xG/xGA (available from FPL stats or Understat). The official `team_h_difficulty` / `team_a_difficulty` fields do not separate attacking vs defensive difficulty and do not update dynamically. Using raw FDR corrupts Gem ratings.

6. **FPL API field names change without notice** — Route all FPL field access through `lib/fpl-adapter.ts` and validate with Zod at the ingestion boundary. Silent `undefined` propagation through scoring produces NaN Gem scores with no error.

See `.planning/research/PITFALLS.md` for all 13 pitfalls, phase mapping, and a "looks done but isn't" checklist.

---

## Implications for Roadmap

The feature dependency tree from FEATURES.md maps cleanly onto a 6-phase build. The pipeline must come before any UI; the Gem score must come before transfer suggestions; DefCon can be built in parallel with the Gem work since it is FPL-native and does not depend on Understat.

### Phase 1: Data Foundation

**Rationale:** Every feature is blocked until this exists. The CORS proxy, FPL adapter, Blob cache, and player ID mapping must be in place before any UI work begins. Pitfalls 1, 6, 7, 11 all point here.

**Delivers:**
- Next.js scaffold with Route Handler FPL proxy (bypasses CORS)
- Python pipeline: FPL bootstrap-static + fixtures + element-summary fetched and written to Blob
- `lib/fpl-adapter.ts` with Zod schema validation — the only place that knows FPL field names
- `player_id_map.json` — manual one-time mapping of FPL player IDs to Understat IDs
- `last_updated.json` — pipeline staleness tracking

**Must avoid:** Calling FPL API from browser (Pitfall 1), string-matching player names (Pitfall 6), hardcoding FPL field names without an adapter (Pitfall 7)

**Research flag:** Standard patterns — no additional research needed.

---

### Phase 2: Understat Pipeline + Merged Data API

**Rationale:** Once the FPL fetch is stable and the ID mapping exists, add the Understat leg and produce the merged player dataset. This unlocks all downstream features. Custom FDR also belongs here.

**Delivers:**
- `pipeline/understat_client.py` using soccerdata 1.8.8 — fetches xG/xA per player
- `pipeline/merge.py` — joins FPL and Understat on `player_id_map.json`; promotes-team players get null xG (not zero)
- Custom FDR computed from rolling xGA (not official FDR integers)
- `merged_players.json` written to Blob
- `/api/players` Route Handler serving the merged dataset
- `usePlayers()` TanStack Query hook

**Must avoid:** Using official FDR as primary signal (Pitfall 8), DGW form distortion (Pitfall 4), treating null Understat as zero (Pitfall 12)

**Research flag:** soccerdata usage is well-documented (STACK.md). No additional research needed.

---

### Phase 3: Gem Rating Table

**Rationale:** The Gem composite score is the core differentiator and a prerequisite for transfer suggestions. It depends on merged data (Phase 2 output). The scoring module belongs in the pipeline.

**Delivers:**
- `pipeline/scoring.py` — Gem composite rating (fixture difficulty via custom FDR, form per-90, xG/xA, ownership, minutes reliability, DefCon likelihood, set piece role)
- Gem scores included in `merged_players.json`
- `GemTable` React component — sortable/filterable by position using TanStack Table
- Per-90 normalisation throughout (not per-gameweek)

**Must avoid:** Scoring logic in React components (Architecture anti-pattern 2), using raw gameweek counts for form (Pitfall 4)

**Research flag:** No additional research needed — scoring dimensions are fully specified in PROJECT.md.

---

### Phase 4: DefCon Analysis

**Rationale:** DefCon is independent of Understat (FPL-native fields) so it can be built once the FPL data pipeline is stable. It does NOT depend on Phase 2 Understat merge — it can proceed in parallel with Phase 3 if capacity allows.

**Delivers:**
- DefCon hit rate per player — from per-match `element-summary` history (not season aggregate)
- Position-split tables: DEF (threshold=10) and MID/FWD (threshold=12) — never combined
- Distance-to-threshold metric per player
- `DefConTable` component

**Must avoid:** Using season-aggregate `defensive_contributions` divided by games (wrong — threshold is per-match, Pitfall 5), using `clearances_blocks_interceptions` for MID/FWD (wrong field, Pitfall 5)

**Research flag:** No additional research needed — DefCon field semantics are confirmed in PITFALLS.md and FEATURES.md.

---

### Phase 5: Squad View + Transfer Suggestions

**Rationale:** Transfer suggestions are the highest-complexity feature — they require Gem scores (Phase 3), squad data (live FPL proxy), and correct budget logic (sell price, not buy price). This phase comes last in the core v1 build.

**Delivers:**
- Team ID input → `useSquad()` hook → `/api/squad/[teamId]` proxy → `entry/{id}/event/{gw}/picks/`
- `SquadView` component — squad by position with prices, flags, Gem scores
- `lib/transfer-engine.ts` — pure function: (squad, allPlayers, budget) → ranked suggestions
- Sell price using `selling_price` from `my-team` when authenticated; `now_cost` labelled as approximate when not
- Position-lock enforcement (element_type matching, not string labels)
- Chip state detection: Free Hit and Wildcard surface warnings, not broken suggestions

**Must avoid:** Using `now_cost` as sell price without labelling it approximate (Pitfall 3), cross-position transfer suggestions (Pitfall 11), ignoring chip state (Pitfalls 9, 10)

**Research flag:** FPL auth cookie flow (Pitfall 2) — if adding optional login in this phase, test the dual-domain `sessionid` cookie requirement. Well-documented in PITFALLS.md but worth a focused implementation spike.

---

### Phase 6: Polish + Club Form

**Rationale:** Supporting features (club form table, value gems, price staleness display) add analytical context but do not block core usage. Polish work (fixture difficulty badges, home/away distinction, last-updated display) is deferred until the core tables are working.

**Delivers:**
- Club form table (wins, goals, conceded over rolling N-game window)
- Value/cheap gems view (low-owned, high-scoring)
- Fixture difficulty colour badges (using custom FDR, not official)
- "Last updated" timestamp on all views
- Manual refresh trigger
- Price staleness handling (refresh after ~8am UK time when FPL prices settle)

**Must avoid:** Showing official FDR colours directly (Pitfall 8), displaying 0 points for a BGW player as if it means poor form

**Research flag:** Standard patterns — no additional research needed.

---

### Phase Ordering Rationale

- Phases 1-2 are strictly sequential: pipeline must exist before UI; Understat must be merged before Gem scoring can use it.
- Phase 3 (Gem) and Phase 4 (DefCon) can proceed in parallel — DefCon uses only FPL data and does not depend on xG/xA.
- Phase 5 (transfers) must come after Phase 3 — it ranks suggestions by Gem delta.
- Phase 6 is parallelisable with Phases 4-5 for non-blocking polish items.
- FPL optional login (exact selling prices, transfer count) is a Phase 5 enhancement and can be a follow-on v1.x task — it is not on the critical path for core transfer suggestions (unauthenticated mode using labelled approximate budgets is acceptable for v1).

### Research Flags

Phases with standard, well-documented patterns (skip research-phase during roadmap planning):
- Phase 1: Next.js App Router scaffold, Route Handlers, Vercel Blob — all confirmed in STACK.md
- Phase 2: soccerdata Understat usage confirmed in STACK.md; merge logic is straightforward
- Phase 3: Scoring dimensions fully specified in PROJECT.md and FEATURES.md
- Phase 4: DefCon field semantics confirmed in PITFALLS.md
- Phase 6: Standard UI patterns

Phase that may benefit from a focused implementation spike:
- Phase 5 (FPL auth, if optional login is included): The dual-domain session cookie flow is documented but finicky. Recommend a short spike to validate `requests.Session()` cookie handling against a live FPL account before building the UI around it.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major technologies confirmed stable at current versions; FPL CORS constraint is a hard documented fact; soccerdata v1.8.8 verified on PyPI January 2026 |
| Features | HIGH | FPL API fields confirmed present; DefCon fields verified via Premier League official 2025/26 docs; set piece flag limitation confirmed (text field only, no structured boolean) |
| Architecture | HIGH | Architecture derived directly from confirmed stack decisions; patterns (proxy, Blob cache, adapter layer) are standard and well-documented |
| Pitfalls | HIGH | 13 pitfalls researched with primary sources; sell price formula from FPL docs; DGW normalisation from FPL history endpoint structure; Understat name mismatch from community sources |

**Overall confidence:** HIGH

### Gaps to Address

- **Set piece structured flag**: No boolean `is_penalty_taker` field exists in the FPL API. Set piece role is text-only in the `news` field. For v1 this means approximate text parsing; a structured flag would require a manual community data source (e.g. Fantasy Football Scout). Decision: parse `news` field with documented limitations for v1; log which players have ambiguous set piece status.

- **Vercel Blob free tier limits**: Free tier confirmed to exist but exact storage/bandwidth limits not verified. The daily JSON payload is approximately 2 MB — well within typical free tier limits. Validate on first deploy; fall back to committing JSON to git repo if needed.

- **Understat early-season data**: For newly-promoted clubs or early in the 2025/26 season, Understat xG/xA may be sparse. The pipeline must handle null xG/xA gracefully (treat as missing, not zero) from day one. Gem scoring must weight xG/xA conditionally on data availability.

- **FPL auth cookie expiry**: The session-cookie flow (Pitfall 2) is community-documented but FPL may change it without notice. Optional login is v1.x anyway — but if included in Phase 5, plan a validation step against a live account before building the UI.

- **soccerdata scraping fragility**: soccerdata relies on scraping Understat HTML. If Understat changes its embedded JS variable structure, the library breaks. Mitigation: pin to `soccerdata==1.8.8`, test at each new FPL season start, and ensure the pipeline logs scraping failures loudly.

---

## Sources

### Primary (HIGH confidence)
- [Premier League official DefCon rule](https://www.premierleague.com/en/news/4361991/whats-new-in-202526-fantasy-defensive-contributions) — DefCon fields, per-position thresholds, point cap
- [soccerdata 1.8.8 — PyPI](https://pypi.org/project/soccerdata/) — version confirmation, Understat support
- [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) — CORS constraint, endpoint reference
- [Next.js 16 — nextjs.org](https://nextjs.org/blog/next-16-1) — version confirmation
- [shadcn/ui changelog](https://ui.shadcn.com/docs/changelog) — React 19 + Tailwind v4 compatibility
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) — bandwidth and function invocation limits

### Secondary (MEDIUM confidence)
- [FPL API Authentication Guide — Medium](https://medium.com/@bram.vanherle1/fantasy-premier-league-api-authentication-guide-2f7aeb2382e4) — session cookie auth flow
- [FPL price changes — FPL Dashboard](https://fpl.page/article/how-fpl-price-changes-work-tool-predictor) — sell price formula
- [FPL Blank and Double Gameweeks — Fantasy Football Scout](https://www.fantasyfootballscout.co.uk/2026/03/19/when-are-the-fpl-blank-and-double-gameweeks-in-2025-26) — DGW/BGW schedule

### Tertiary (supporting)
- [Getting data from FPL and Understat — Stateastic](https://stateastic.home.blog/2022/08/02/getting-data-from-fpl-and-understat-to-do-analysis/) — player ID mapping approach
- [soccerdata Understat docs — DeepWiki](https://deepwiki.com/probberechts/soccerdata/3.5-understat-and-sofascore-scrapers) — API usage

---

*Research completed: 2026-03-26*
*Ready for roadmap: yes*
