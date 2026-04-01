# Milestones

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
