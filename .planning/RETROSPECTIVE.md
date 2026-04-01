# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-29
**Phases:** 6 | **Plans:** 19 (+ 1 gap-closure) | **Commits:** 104
**Timeline:** 3 days (2026-03-27 → 2026-03-29)

### What Was Built

- Next.js + Python pipeline: FPL API + Understat xG/xA merged into `merged_players.json`, served via Vercel Blob, fetched with TanStack Query
- Gem Rating table: 7-dimension composite score with min-max normalisation, sortable/filterable TanStack Table
- DefCon Analysis: per-match contribution hit rates from element-summary history, position-split tables
- Squad View + Transfer Engine: Team ID input, position-locked transfer suggestions ranked by Gem delta with chip guard and save recommendation
- Club Form + Value Gems tabs with filter pills, price trend columns, FixtureBadges, and LastUpdated banner

### What Worked

- **TDD-first execution**: Pure functions (gem scoring, transfer engine, club form, value gems predicates) were written test-first — this caught the `tier()` inversion bug before it reached production and made UAT gaps straightforward to fix
- **Gap closure plan system**: When UAT found 4 issues (tier inversion + NaN price trends), the `--gaps-only` re-execution isolated fixes cleanly without disturbing completed work
- **Wave-based parallelisation**: Parallel agent execution per wave kept execution time low — 19 plans completed across 3 days
- **`USE_BLOB` env routing**: Dev/prod data source switching without credentials made local development fast

### What Was Inefficient

- **ROADMAP.md progress table drift**: The live ROADMAP.md showed Phase 3 as "In Progress" and Phase 6 at "0/3" even after completion — state tracking lagged execution. The archive needed manual correction.
- **STATE.md merge conflict on worktree merge**: Parallel worktree execution caused a conflict that required manual resolution — the stash/merge/pop pattern could be smoother
- **DAT-01 not verified**: The GitHub Actions cron was scaffolded in Phase 1 but never confirmed operational — would have been better to smoke-test it during Phase 1 rather than carry it as a known gap into v1.1

### Patterns Established

- **`merged_players.json` as single source of truth**: All downstream phases imported from this schema; never re-derived from raw FPL data in UI code
- **Adapter layer pattern**: `parseFPLBootstrap` wraps safeParse; callers decide throw vs stale-cache — this isolated FPL API fragility from business logic across all phases
- **Pure function extraction before UI**: Data computations (gem score, club form, transfer engine) were written as tested pure functions before building UI components — made verification straightforward
- **`?? 0` as pipeline field guard**: Any field from `merged_players.json` that could be absent (price trends, xG/xA) should be guarded at render time, not assumed present

### Key Lessons

1. **Verify pipeline cron early**: GitHub Actions scheduling should be smoke-tested in Phase 1, not assumed to work. A 5-minute manual trigger check would have closed DAT-01.
2. **State tracking is a first-class concern**: ROADMAP.md progress table updates should happen atomically with plan completion — stale progress values cause confusion in retrospect reviews
3. **Gap closure is cheaper than getting it right the first time if you have UAT**: The 2-bug gap closure (06-04) was handled cleanly by the GSD gap plan system. Good UAT coverage > perfect first-pass implementation.
4. **TDD pays off in analytics code**: The `tier()` inversion was caught instantly by tests because the scoring logic was extracted as a pure function. Without tests, this would have been a silent bug.

### Cost Observations

- Model: Sonnet 4.6 throughout (executor + verifier)
- Sessions: ~4-5 across 3 days
- Notable: Parallel wave execution made the token spend efficient — most cost was in verification agents, which caught real bugs

---

## Milestone: v1.1 — Decision Engine

**Shipped:** 2026-03-30
**Phases:** 6 (7-12) | **Plans:** 15 | **Timeline:** 1 day (2026-03-30)

### What Was Built

- Pipeline extension: `proj_pts_1gw/3gw/5gw`, `xmins`, `start_prob`, `mins_risk` for all 825 players
- Rotation risk badges (Nailed/Likely Start/Rotation Risk/Cameo) across SquadView, GemTable, TransferPanel
- Projected points columns in GemTable with 1/3/5 GW toggle; proj pts delta in TransferPanel suggestions
- Buy/Hold/Sell recommendation engine + captaincy rankings (top-5, safe vs upside, projected captain pts)
- Explainability panel with natural-language reasons per player + replacement shortlist for Sell candidates
- FPL session-cookie auth: login/logout/status/my-team routes, exact sell prices, bank balance in SquadView

### What Worked

- **Layered data approach**: Adding `xmins`/`proj_pts` to `merged_players.json` without breaking existing downstream code — schema extension was additive
- **Pure function pattern repeated**: `computeExplanations`, `computeReplacementShortlist`, `computeCaptaincyRankings` all written as pure functions with test coverage — UAT was clean
- **Single-query key** `['players']` absorbed all new fields without cache invalidation issues

### What Was Inefficient

- **Stale traceability table**: MOB-TBL-05 (GemTable portion) remained "Pending" in the traceability table despite the requirement being checked off — state drift between requirements and traceability table
- **DAT-01 deferred again**: GitHub Actions cron not confirmed as operational; carried into v1.2

### Patterns Established

- **Additive schema extension**: New pipeline fields go into `merged_players.json` as optional with `?? fallback` guards at render time — never break existing UI code
- **`computeX` naming convention**: All pure computation functions follow `compute{Feature}` naming, extracted before UI integration

### Key Lessons

1. **Additive schema changes are safe; breaking changes aren't**: Every v1.1 pipeline field was optional-compatible — nothing broke in v1.0 UI components
2. **Carry-forward items compound**: DAT-01 was deferred from v1.0 → v1.1 → v1.2 before being resolved. One-phase deferrals are fine; multi-milestone carries are a smell.
3. **Fast milestone cadence is possible**: 6 phases in 1 day — parallel execution + good test coverage from v1.0 made v1.1 execution very clean

### Cost Observations

- Model: Sonnet 4.6 throughout
- Sessions: ~2-3 across 1 day
- Notable: v1.1 was the fastest milestone — foundation quality from v1.0 paid off

---

## Milestone: v1.2 — Mobile

**Shipped:** 2026-04-01
**Phases:** 6 (13-18) | **Plans:** 12 | **Timeline:** 1 day (2026-04-01)

### What Was Built

- Fixed bottom tab bar (MobileNav) with CSS-only show/hide, iOS safe area viewport contract, single-column layout at 375px
- Touch compliance: 44px tap targets, 16px input fonts, `active:scale-95` feedback across all interactive elements
- GemTable: 5-column mobile view (Player, Pos, Gem, Proj Pts, Risk), sticky Player column, tap-to-expand rows
- SquadView, DefConTables, ClubFormTable, ValueGemsTable: mobile column hiding via TanStack VisibilityState
- TransferPanel 2-row flex cards, login form vertical stacking, captaincy 2-column grid on mobile
- Sticky GemTable filter bar, back-to-top button for long tables
- DGW-aware transfer engine tier, DGW labels in FixtureBadges/CaptaincyPanel
- GitHub Actions cron confirmed operational; `/api/last-updated` Blob read path live
- Full dark mode: Tailwind v4 `@custom-variant dark`, FOUC-prevention inline script, ThemeToggle, all components

### What Worked

- **CSS-only show/hide for MobileNav**: `sm:hidden` / `hidden sm:flex` avoided hydration mismatch — no `useMediaQuery` needed anywhere in the nav
- **TanStack VisibilityState as the column-hiding mechanism**: Reused existing GemTable GW toggle pattern for all 4 table components — zero new abstraction required
- **`window.innerWidth` resize listener over `useMediaQuery`**: Consistent hydration-safe isMobile detection across all 5 components that needed it
- **Dark mode without next-themes**: Inline script in `<head>` + `suppressHydrationWarning` on `<html>` only — avoided a dependency and a React 19 warning
- **Wave parallelisation on dark mode**: Phases 18-02 and 18-03 ran in parallel — 102 `dark:` instances added across 16 files in one wave with no conflicts

### What Was Inefficient

- **Dark mode test update**: `tests/lib/mins-risk-badge.test.ts` needed updating when dark: classes were added to badge output — test asserted full class strings. Pattern to watch: visual component tests that assert exact className strings break when styling changes.
- **18-02 most expensive plan**: 80k tokens for 7 files — TransferPanel had 50 dark: instances. Complex component theming is a legitimate token sink; could scope more granularly next time.

### Patterns Established

- **`dark:` variant convention**: All dark variants use `dark:bg-zinc-{800,900}` for surfaces, `dark:text-zinc-{100,200,300,400}` for text tiers, `dark:border-zinc-{600,700}` for borders — consistent zinc scale throughout
- **Active state inversion**: Active/selected elements in dark mode invert to white bg with dark text (`dark:bg-white dark:text-zinc-900`) — high contrast, consistent signal
- **Input dark safety**: All inputs need `dark:bg-zinc-800 dark:border-zinc-600` — invisible-input pitfall if missed
- **isMobile dual-gating**: CSS `sm:hidden` + JS `isMobile` state used together for conditional rendering — CSS provides instant visual suppression, JS gates interactive behavior

### Key Lessons

1. **Dark mode is additive work proportional to component complexity**: TransferPanel (50 dark: instances) took ~6× more effort than MobileNav (2 dark: instances). Budget accordingly.
2. **Established patterns compound across phases**: Phases 14-18 all reused the `window.innerWidth` isMobile pattern from Phase 13. Getting Phase 13 right paid dividends 5 phases later.
3. **Test className assertions need updating when styling changes**: Tests that assert exact class strings will break during theming/responsive work. Either use more targeted assertions or accept the maintenance cost.
4. **FOUC is solvable without a library**: The inline script + suppressHydrationWarning approach is clean and avoids the `next-themes` dependency warning in React 19.

### Cost Observations

- Model: Sonnet 4.6 throughout (executor + verifier)
- Sessions: 1 day, ~3 sessions
- Notable: Parallel 18-02/18-03 wave was efficient — two independent component sets themed simultaneously

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 104 | 6 | First milestone — GSD workflow established |
| v1.1 | ~45 | 6 | Additive schema extension pattern; pure functions first |
| v1.2 | ~67 | 6 | CSS-first responsive; TanStack VisibilityState reuse; dark mode without deps |

### Cumulative Quality

| Milestone | Test Files | LOC (TS+Py) | Gap Closures |
|-----------|------------|-------------|--------------|
| v1.0 | ~15 | ~6,600 | 1 (06-04) |
| v1.1 | ~15 | ~6,600 | 0 |
| v1.2 | 16 | ~7,000 | 0 |

### Top Lessons (Verified Across Milestones)

1. TDD-first for pure functions pays back in cheaper UAT and gap closure
2. DAT/infra requirements need operational smoke tests, not just scaffolding — multi-milestone deferral is a smell
3. Established patterns (isMobile detection, column visibility, zinc dark scale) compound across phases — invest in getting Phase 1 of a milestone right
4. CSS-first (no JS for show/hide, no library for dark mode) avoids hydration issues and reduces dependencies

---
