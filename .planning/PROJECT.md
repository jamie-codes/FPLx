# FPL Analyst

## What This Is

A personal web app for Fantasy Premier League managers that pulls in your squad via FPL Team ID and surfaces actionable intelligence: which players to target, who to sell, hidden gems, DefCon candidates, form analysis, and transfer suggestions — all grounded in FPL API data plus Understat xG/xA.

v1.2 shipped as a fully mobile-responsive, dark-mode-aware daily-use tool. The manager enters their Team ID and receives ranked transfer suggestions, a Gem Rating table, DefCon analysis, Club Form, and Value Gems — all responsive on any screen size, with dark mode toggle and automated daily pipeline refresh.

v1.3 added a Gameweek Planner: the manager can generate a 1–5 GW transfer plan with auto-suggested sequences, fixture-aware scoring, chip timing, per-GW squad snapshots, and manual edit mode to override any step.

## Core Value

Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## Current State (v1.3 Gameweek Planner — shipped 2026-04-03)

v1.3 complete — Full Gameweek Planner shipped: "Planner" tab in nav, 1–5 GW horizon selector, `generatePlan()` greedy + look-ahead engine, `TransferPlanTable` with chip toggles and DGW/BGW badges, per-GW `SquadSnapshotRow` accordion, and manual edit mode via `PlayerPickerModal` + `generatePlanFrom()` re-scoring. All 14 v1.3 requirements satisfied across 7 phases, 14 plans.

**Tech stack:** Next.js 16, React 19, TypeScript, TanStack Table v8, TanStack Query, Tailwind CSS v4, Vitest, immer/use-immer, Python (requests, pandas, soccerdata), Vercel Blob

**Codebase:** ~11,300 LOC (v1.3 adds ~4,276 lines), ~200+ files

**What's running:**
- `/` — Gem Ratings tab (default), DefCon tab, Squad tab, Club Form tab, Value Gems tab
- `/api/players` — merged FPL+Understat dataset from Vercel Blob
- `/api/defcon` — DefCon stats from pipeline cache
- `/api/club-form` — club form computed from fixtures
- `/api/last-updated` — timestamp of last pipeline run
- `pipeline/run.py` — daily refresh via GitHub Actions cron (confirmed operational)

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

### Validated (v1.1)

- ✓ PROJ-01/02/03: Projected points next 1/3/5 GW per player (Python pipeline) — v1.1
- ✓ MINS-01: Expected minutes and start probability per player — v1.1
- ✓ MINS-02: Rotation risk badge (Nailed / Likely start / Rotation risk / Cameo) — v1.1
- ✓ MINS-03: Transfer suggestions de-prioritise rotation-risk buy candidates — v1.1
- ✓ PROJ-04: Projected points columns in GemTable (sortable, 1/3/5 GW toggle) + TransferPanel — v1.1
- ✓ REC-01: Buy / Hold / Sell recommendation per squad player — v1.1
- ✓ REC-02: Replacement shortlist with projected points delta for Sell candidates — v1.1
- ✓ CAP-01/02: Captaincy rankings — top-5, safe vs upside, projected captain points — v1.1
- ✓ EXP-01/02: Explainability panel with natural-language reasons + risk flags — v1.1
- ✓ AUTH-01/02: Optional FPL session-cookie login, exact sell prices and bank balance — v1.1

### Validated (v1.2)

- ✓ MOB-NAV-01/02/03: Fixed bottom tab bar on mobile (5 tabs, CSS-only show/hide, iOS safe area) — v1.2
- ✓ MOB-LAY-01/02: Single-column layout at 375px, no horizontal overflow on any tab — v1.2
- ✓ MOB-TOUCH-01/02/03: 44px tap targets, 16px input fonts, active:scale-95 feedback — v1.2
- ✓ MOB-TBL-01: GemTable 5-column mobile view (Player, Pos, Gem, Proj Pts, Risk) — v1.2
- ✓ MOB-TBL-02/03/04: DefConTables, ClubFormTable, ValueGemsTable column hiding on mobile — v1.2
- ✓ MOB-TBL-05: Sticky Player column in GemTable and SquadView on mobile — v1.2
- ✓ MOB-TBL-06: Tap-to-expand row detail panel in GemTable — v1.2
- ✓ MOB-COMP-01/02/03: Transfer cards 2-row layout, login form stacking, captaincy 2-col grid — v1.2
- ✓ MOB-POL-01/02: Sticky GemTable filter bar, back-to-top button — v1.2
- ✓ DAT-01: GitHub Actions cron confirmed operational, /api/last-updated Blob read path live — v1.2
- ✓ DGW-01/02: DGW-aware transfer engine tier, DGW labels in FixtureBadges/CaptaincyPanel — v1.2
- ✓ DARK-01/02/03: Tailwind v4 class-based dark mode, FOUC prevention, ThemeToggle, all components — v1.2

### Validated (v1.3)

- ✓ DQ-01: Players without Understat xG/xA use FPL goals/assists as proxy in Gem score — v1.3
- ✓ DQ-02: DefCon threshold raised to 5 games; "Insufficient data" reserved for genuine edge cases — v1.3
- ✓ VG-01: Pipeline computes pts_last3gw and pts_last5gw per player from FPL element-summary history — v1.3
- ✓ VG-02: Value Gems table shows Total Pts, Pts (last 5 GW), Pts (last 3 GW) columns — v1.3
- ✓ AUTH-03: User can log in to FPL via modal-based guided token entry with step-by-step Chrome DevTools guide — v1.3
- ✓ AUTH-04: Manual cookie entry supported with clipboard paste button as friction reducer — v1.3
- ✓ PLAN-01: User can set a planning horizon of 1–5 gameweeks — v1.3
- ✓ PLAN-02: System auto-suggests an optimal transfer sequence for the chosen horizon — v1.3
- ✓ PLAN-03: Transfer sequence scored by projected pts delta, fixture difficulty, DGW/BGW awareness, -4pt hit cost — v1.3
- ✓ PLAN-04: User can manually edit the suggested sequence (swap players in/out per GW step) — v1.3
- ✓ PLAN-05: Output shows a transfer-by-transfer table (GW | Out | In | Cost | Projected gain) — v1.3
- ✓ PLAN-06: Output shows a squad snapshot for each gameweek in the plan — v1.3
- ✓ PLAN-07: Chip timing (Wildcard, Free Hit, TC, BB) is visible and configurable in the plan — v1.3
- ✓ PLAN-08: Planner accessible via "Planner" tab in the navigation bar — v1.3

### Active

*(None — v1.4 requirements to be defined via `/gsd:new-milestone`)*

### Out of Scope

- Live in-match updates — data refreshes daily, not during gameweeks
- Mini-league or head-to-head analysis — squad optimisation focus only
- Mobile app — web only (responsive web covers the mobile use case)
- Automated chip timing recommendations — chip visibility in plan is in-scope; auto-timing is out
- Offline mode — daily refresh is sufficient

## Context

- **FPL API**: Official undocumented API at `https://fantasy.premierleague.com/api/`
- **Understat**: Shot-level xG/xA via soccerdata Python library
- **DefCon rule**: 2025/26 season. DEF threshold=10 defensive contributions, MID/FWD threshold=12. Award=+2 pts.
- **Transfer rules**: Position-locked. Free transfers accumulate to 2/week; extra cost 4 pts each.
- **Auth**: Session-cookie auth (not OAuth). Team ID only for public API; optional login for exact prices.
- **Dark mode**: Tailwind v4 `@custom-variant dark` with `.dark` class on `<html>`; localStorage persistence; FOUC prevented by inline script in `<head>`.

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
| CSS-only mobile nav show/hide (`sm:hidden` / `hidden sm:flex`) | No JS state for nav visibility — CSS media query is simpler and avoids hydration issues | ✓ Good — zero flash on resize |
| TanStack `columnVisibility` for mobile column hiding | Reuses existing TanStack Table state; no new abstraction needed | ✓ Good — consistent pattern across 4 tables |
| Tailwind v4 `@custom-variant dark` with `.dark` class (not media query) | Manual toggle requires class-based switching; v4 `@custom-variant` is the correct primitive | ✓ Good — FOUC prevention script works cleanly |
| FOUC prevention: inline script in `<head>` with `suppressHydrationWarning` | Must run before first paint; React hydration ignores HTML/body attribute mismatch | ✓ Good — no white flash even on slow connections |
| AuthModal always in DOM (not conditionally rendered) | Prevents `showModal()` null ref on first open; native dialog pitfall | ✓ Good — consistent pattern reused in PlayerPickerModal |
| `dialog::backdrop` via globals.css (not Tailwind `backdrop:` prefix) | Tailwind v4 `backdrop:` support unverified in this config; CSS rule is guaranteed | ✓ Good — works across Chrome, Firefox, Safari |
| Greedy + 1-level look-ahead (LOOK_AHEAD_DISCOUNT=0.8) for planning engine | Sufficient for personal-use planning; no deep recursion needed | ✓ Good — fast and produces sensible plans |
| `positionsAfter: Record<number, number>` (not Map) on PlanStep | Keeps PlanStep JSON-serializable for any future persistence | ✓ Good — plain object passed cleanly through Immer |
| `readonly originalSteps: PlanStep[]` frozen via `structuredClone` | Compile-time protection against Immer accidentally mutating the plan baseline | ✓ Good — caught mutation bugs at the type level |
| useImmer for PlannerTab chip toggle + planResult state | Safe nested mutation without manual spread-copy for complex nested state | ✓ Good — `updatePlanResult` recipe pattern reused across handlers |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-03 after v1.3 milestone — Gameweek Planner shipped*
