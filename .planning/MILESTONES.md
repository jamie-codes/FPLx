# Milestones

## v1.3 Gameweek Planner (Shipped: 2026-04-03)

**Phases completed:** 7 phases, 14 plans, 19 tasks
**Timeline:** 2026-04-02 → 2026-04-03 (2 days)
**Files changed:** 32 files, +4,276 / −44 lines

**Key accomplishments:**

1. xG/xA proxy from FPL goals/assists for all unmatched players, DefCon threshold raised to 5 games, pts_last3gw/pts_last5gw pipeline fields — all v1.3 data quality gaps closed
2. Native `<dialog>` AuthModal with step-by-step Chrome DevTools guide, clipboard paste button, and three-state expiry display (normal/expiring-soon/expired) — replaces inline token form
3. Foundational planner type system and pure free transfer engine (31 TDD tests covering banking, wildcard reset, free hit, hit costs) — "Planner" tab wired into desktop and mobile nav with HorizonSelector
4. `generatePlan()` pure function with greedy + 1-level look-ahead (LOOK_AHEAD_DISCOUNT=0.8), DGW/BGW fixture scoring, hit cost threshold — PLAN-02 and PLAN-03 satisfied with 17-test TDD suite
5. `TransferPlanTable` with chip toggles, DGW/BGW badges, plan value headline — wired into PlannerTab via useImmer state management
6. `positionsAfter: Record<number, number>` on PlanStep + `SquadSnapshotRow` accordion — 15-player per-GW squad view with position grouping and transfer highlighting
7. `generatePlanFrom()` re-scoring engine, `PlayerPickerModal` (native dialog, position-filtered), pencil/undo icons — full manual edit mode with per-row overrides and forward re-scoring

---

## v1.2 Mobile (Shipped: 2026-04-01)

**Phases completed:** 6 phases, 12 plans, 20 tasks

**Key accomplishments:**

- Fixed bottom tab bar (MobileNav) with CSS-only show/hide pattern, iOS safe area viewport contract, and single-column layout guarantee at 375px
- 44px tap targets, 16px mobile input fonts, and active:scale-95 feedback applied to PositionFilter, GwToggle, GemTable headers, and TransferPanel — completing Phase 13 mobile touch compliance with visual checkpoint approved
- GemTable mobile-responsive: 5-column view on phones with sticky Player column and tap-to-expand row detail panel showing all 15 hidden columns as labelled key-value pairs
- SquadView reduced to 4-column mobile layout (Player, Price, Risk, Rec) with sticky Player column and dynamic ExplainPanel colSpan, matching Phase 14 isMobile pattern
- DefConTables, ClubFormTable, and ValueGemsTable reduced to 4-5 priority columns on mobile via TanStack VisibilityState, matching the GemTable pattern from Phase 14
- One-liner:
- One-liner:
- Blob-aware /api/last-updated route using @vercel/blob list() pattern, mirroring /api/players for production timestamp freshness — GitHub Actions cron confirmed operational
- Transfer engine (DGW-01):
- Tailwind v4 @custom-variant dark + FOUC-prevention inline script + ThemeToggle button wired to localStorage and .dark class on <html>
- One-liner:
- MinsRiskBadge.tsx

---

## v1.1 Decision Engine (Shipped: 2026-03-31)

**Phases completed:** 6 phases, 15 plans, 18 tasks

**Key accomplishments:**

- defcon.py refactored as pure computation module accepting pre-fetched summaries dict; new xmins.py computes xmins/start_prob/mins_risk for all players using locked status-gated classification
- One-liner:
- VerdictBadge and CaptaincyPanel surfaced to user in TransferPanel — Buy/Hold/Sell badges in SquadView Rec column, ranked captaincy picks with projected captain pts, safe/upside type, and mins risk below squad.
- Pure `computeExplanations(player: ScoredPlayer): string[]` function mapping all D-03 signals to natural-language reasons with 20 Vitest tests green
- Expandable player rows in SquadView showing natural-language reasons and replacement shortlist for Sell players, with per-player chevron toggle and bench exclusion
- One-liner:
- Inline FPL login form with TanStack Query auth hooks delivering exact sell prices (£X.Xm) and tilde-prefixed approximate prices (~£X.Xm) toggled by auth state, without gating any squad features

---

## v1.0 MVP (Shipped: 2026-03-29)

**Phases completed:** 6 phases, 19 plans (+ 1 gap-closure)
**Timeline:** 2026-03-27 → 2026-03-29 (3 days)
**Codebase:** ~6,600 LOC (TypeScript + Python), 166 files changed

**Key accomplishments:**

1. Next.js scaffold with FPL proxy Route Handler, Zod validation adapter, Vercel Blob caching, and 825-entry FPL-to-Understat player ID map
2. Python pipeline combining FPL API + Understat xG/xA with custom FDR (rolling xGA), per-90 normalisation, and GitHub Actions daily cron
3. Composite Gem Rating engine (7 dimensions) with min-max normalisation — sortable/filterable TanStack table at `/`
4. DefCon Analysis: per-match hit rates from element-summary history, position-split tables (DEF=10, MID/FWD=12 thresholds)
5. Squad View with Team ID input and Transfer Engine (position lock, budget enforcement, chip guard, save-transfer recommendation)
6. Club Form tab, Value Gems tab with filter pills, price trend columns, FixtureBadges, and LastUpdated banner

**Known Gaps:**

- DAT-01: Automated daily pipeline refresh — `pipeline/run.py` exists and GitHub Actions workflow is scaffolded but daily scheduling was not verified as operational for v1. Candidate for v1.1.

---
