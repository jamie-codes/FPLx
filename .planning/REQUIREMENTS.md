# Requirements: FPL Analyst

**Defined:** 2026-03-27
**Core Value:** Give the manager a clear, prioritised view of who to buy and who to sell this week — backed by data, not gut feel.

## v1.3 Requirements

### Data Quality

- [x] **DQ-01**: Players without Understat xG/xA data use FPL goals/assists as a proxy in the Gem score computation
- [x] **DQ-02**: DefCon table shows computed stats where data exists; "Insufficient data" is reserved for genuine edge cases only; minimum games threshold raised

### Auth UX

- [x] **AUTH-03**: User can log in to FPL directly via email + password in the app (server-side cookie extraction — no manual cookie hunting)
- [x] **AUTH-04**: Manual cookie entry is supported with a step-by-step browser guide (Chrome/Firefox/Safari) as fallback

### Value Gems

- [x] **VG-01**: Pipeline computes pts_last3gw and pts_last5gw per player from FPL element-summary history
- [x] **VG-02**: Value Gems table shows three points columns: Total Pts, Pts (last 5 GW), Pts (last 3 GW)

### Gameweek Planner

- [x] **PLAN-01**: User can set a planning horizon of 1–5 gameweeks
- [x] **PLAN-02**: System auto-suggests an optimal transfer sequence for the chosen horizon
- [x] **PLAN-03**: Transfer sequence scoring accounts for projected points delta, fixture difficulty, DGW/BGW awareness, and -4pt hit cost
- [x] **PLAN-04**: User can manually edit the suggested sequence (swap players in/out per GW step)
- [x] **PLAN-05**: Output shows a transfer-by-transfer table (GW | Out | In | Cost | Projected gain)
- [x] **PLAN-06**: Output shows a squad snapshot for each gameweek in the plan
- [x] **PLAN-07**: Chip timing (Wildcard, Free Hit, Triple Captain, Bench Boost) is visible and configurable in the plan
- [x] **PLAN-08**: Planner is accessible via a new "Planner" tab in the navigation bar

## Future Requirements

### Gameweek Planner (v2+)

- **PLAN-09**: Planner supports full-season horizon beyond 5 GWs (deferred — fixture data unreliable beyond ~3 GWs)
- **PLAN-10**: Automated transfer execution via FPL API write endpoints (deferred — undocumented write API; high breakage risk)
- **PLAN-11**: LP/MILP solver for globally optimal sequences (deferred — greedy is sufficient for personal use)

### Data Quality (v2+)

- **DQ-03**: Historical xG/xA backfill for players who joined mid-season

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live in-match updates | Data refreshes daily — not during gameweeks |
| Mini-league / head-to-head analysis | Squad optimisation focus only |
| Mobile app | Responsive web covers the mobile use case |
| Autonomous chip recommendations | Chip visibility in plan is in-scope; auto-timing recommendations are out |
| Offline mode | Daily refresh is sufficient |
| Automated transfer execution | FPL write API is undocumented; breakage risk too high |
| Full-season planner (GW38) | Fixture data unreliable beyond ~3 GWs ahead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DQ-01 | Phase 19 | Complete |
| DQ-02 | Phase 19 | Complete |
| VG-01 | Phase 19 | Complete |
| VG-02 | Phase 19 | Complete |
| AUTH-03 | Phase 20 | Complete |
| AUTH-04 | Phase 20 | Complete |
| PLAN-01 | Phase 21 | Complete |
| PLAN-08 | Phase 21 | Complete |
| PLAN-02 | Phase 22 | Complete |
| PLAN-03 | Phase 22 | Complete |
| PLAN-05 | Phase 23 | Complete |
| PLAN-07 | Phase 23 | Complete |
| PLAN-06 | Phase 24 | Complete |
| PLAN-04 | Phase 25 | Complete |

**Coverage:**
- v1.3 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---

## Previously Validated

### v1.0 (MVP)

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

### v1.1 (Decision Engine)

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

### v1.2 (Mobile)

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

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-04-01 — v1.3 traceability complete (14/14 requirements mapped)*
