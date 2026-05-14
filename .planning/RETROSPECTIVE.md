# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.19 — AI Quality & Insight Delivery

**Shipped:** 2026-05-14
**Phases:** 4 (106-109) | **Plans:** 7
**Timeline:** 1 day (2026-05-14)
**Files changed:** 42 files, +4,911 / −89 lines

### What Was Built

- WR carry-forward backlog cleared: single `transition-all` on Load Squad button; captain severity `LOW` for `<2 candidates`; NAV-05 extended to all 7 pills — Phase 106
- Anthropic prompt caching plumbing: `system` prompt wrapped as `TextBlockParam[]` with `cache_control: ephemeral` on both Claude call attempts; cache token metrics logged per call — Phase 107
- Batch AI insight pre-generation pipeline: `pipeline/batch_insights.py` generates Claude insights for top-20 players by xPts; `INSIGHT_BATCH_ENABLED` gate in `run.py`; Blob read-before-generate inserted into `/api/player-insight` route (cache hits ~50-150ms, zero Claude spend) — Phase 108
- MC-enabled calibration: `haul_prob` replaces analytical decile-rank proxy as `predicted_rate` in `accuracy.py`; `calibration_mode` written to `accuracy_backtest.json`; teal MC / zinc Analytical mode badge on `CalibrationHealthIndicator`; D-11 `maxDeviation` bug fixed — Phase 109

### What Worked

- **Gap closure pattern**: Phase 108 needed a third plan (Plan 03) to close NLP-BATCH-03 — the original two plans left the UI route not reading from Blob. Recognising the gap during VERIFICATION.md review and inserting Plan 03 as a targeted TDD RED→GREEN cycle was clean and fast (~3 min)
- **Auto-deviation discipline**: Phase 108 Plan 03 auto-deviated from spec (cache block inserted before Anthropic constructor, not after userMsg) to satisfy the test contract — the deviation was justified, documented, and committed without escalation. Good example of Rule 1 (auto-fix to satisfy plan's own test contract)
- **Single-day milestone**: 4 phases across a single day with no blocking dependencies — achievable because MC_ENABLED had been live since Phase 102 and the blob namespace was established in Phase 105
- **TDD RED→GREEN on every plan**: All 7 plans used TDD; GREEN gates confirmed on every commit. 1,261 suite tests passing at close with no new regressions

### What Was Inefficient

- **REQUIREMENTS.md not updated during execution (again)**: NLP-BATCH-01/02/03 and MC-CAL-01/02 traceability rows stayed "Pending" after Phases 108 and 109 completed; Phase 108 checkbox was also left `[ ]` in ROADMAP.md. Required manual correction at milestone close. This is a recurring pattern across multiple milestones
- **STATE.md v1.19 phase sequence out of sync**: STATE.md still showed `[ ]` for Phases 108 and 109 even after they completed, while the Progress table in ROADMAP.md was correct. Two sources of truth drifted

### Patterns Established

- **Blob read-before-generate pattern**: Cache check inserted before Anthropic client construction to guarantee zero-constructor-calls on hit — reusable in any future on-demand + batch hybrid route
- **`calibration_mode` discriminated union on AccuracySummary**: `'mc' | 'analytical'` field drives badge rendering via Record lookup — same pattern as TIER_BADGE_CLASSES; reusable for any future mode-discriminated UI

### Key Lessons

1. **REQUIREMENTS.md maintenance requires a post-SUMMARY step, not end-of-milestone**: Four milestones in a row with stale requirements at close. The fix is to update REQUIREMENTS.md checkboxes and traceability rows as part of each plan's SUMMARY commit — not deferred to milestone close
2. **NLP-BATCH-03 gap was architectural, not incidental**: The plan spec allocated NLP-BATCH-03 to "existing two-tier cache" but the route was never updated to read from the batch blob namespace. Verification caught it; a plan-phase gap analysis step before execution would have caught it earlier
3. **Single-day milestones are achievable when dependencies are pre-resolved**: v1.19 shipped in one day because Phase 102 (MC) and Phase 105 (NLP-02 blob namespace) did the heavy lifting in v1.18 — v1.19 was integration and surface work on established foundations

### Cost Observations

- Model: Sonnet 4.6 (executor); Opus used for planning phases
- Sessions: 1 day, ~4 sessions
- Notable: Phase 108 Plan 03 was the shortest plan in the milestone (~3 min) despite closing the most critical gap — TDD-first made the implementation scope obvious

---

## Milestone: v1.6 — Squad Optimiser

**Shipped:** 2026-05-01
**Phases:** 5 (42-46) | **Plans:** 12 | **Commits:** 87
**Timeline:** 4 days (2026-04-28 → 2026-05-01)
**Files changed:** 68 files, +17,511 / −646 lines

### What Was Built

- Form signal in xPts pipeline: recency-weighted xG+xA per-90 (BLEND_ALPHA=0.4, 5-GW window) with accuracy gate written to `accuracy_backtest.json` — Phase 42
- Pure TS lineup optimiser `optimiseLineup()`: C(15,11)=1,365 subset enumeration, captain/VC selection via `xPts_90th_1gw`, configurable 1/3/5 GW horizon, BGW exclusion — Phase 43
- Squad sub-tabs (Transfers | Optimiser) with `teamId` lifted to `page.tsx`, MobileNav pill row, pitch UI — Phase 43
- Comparison table: `HeadlineRow` + `ComparisonTable` with xPts delta pills, Promoted/Dropped bench badges, set-difference change count — Phase 44
- Transfer-aware mode: `suggestTransfers()` pure engine (position-keyed Map, top-30 pool, FREE+HIT variants), `FtToggle` pill, break-even GW indicator — Phase 45
- Chip modes: `buildOptimalSquad()` greedy engine (100m budget, 3-per-club cap), `ChipModeToggle` 4-button pill, `ChipSquadView` position-grouped display — Phase 46

### What Worked

- **TDD Wave 0 pattern solidified**: Every phase used Wave 0 (RED tests first), Wave 1 (implementation GREEN), Wave 2 (UI integration) — this structure prevented scope creep within phases and produced clean handoffs between plans
- **`optimiseLineup` never forked**: Extending via `chipMode` param rather than copying the function kept chip modes consistent and testable. All three chip variants (WC/FH/BB) resolved through one entry point
- **Plan spec bugs caught in execution**: `isPromoted` inversion and `changeCount` overcounting were both spec errors caught by running TDD tests before shipping — not found in UAT
- **Controlled component pattern**: `teamId`/`submittedId` state lifted to `page.tsx` in Phase 43-02 meant Phase 45 could wire `useAuthStatus` + `useMyTeam` without state duplication across OptimiserPanel and TransferPanel

### What Was Inefficient

- **REQUIREMENTS.md never updated during execution**: All v1.6 requirements shipped but checkboxes were never checked — this is the third milestone in a row where this happened. Requirements archive required manual checkbox-ticking at close
- **Phase 44 spec had two errors**: `isPromoted` inversion and `changeCount` definition were both wrong in the plan spec — caught by TDD but required deviation records and re-work on assertions

### Patterns Established

- **Wave 0/1/2 three-wave structure**: Now the default for complex phases (types/stubs → engine → UI) — established in v1.3, hardened in v1.6 across all 5 phases
- **`useMemo` for pure engine calls in React**: `optimiseLineup`, `suggestTransfers`, `buildOptimalSquad` all wrapped in `useMemo` — same pattern, same deps array shape
- **Greedy slot-fill with quota guards**: `buildOptimalSquad()` pattern (sort by score, filledSlots quota per position, teamCap, budgetCap) is reusable for any future budget-constrained squad builder
- **`disabled` prop on shared pill toggles**: `GwToggle` extended with `disabled` prop for FH mode — low-friction extension pattern for contextual UI constraints

### Key Lessons

1. **Plan spec errors are a recurring risk for complex UI logic**: Two spec errors in Phase 44 both involved index/ID semantics (`currentId` vs `optimisedId`, row count vs set-difference). More explicit type-annotated pseudocode in plan specs would prevent this
2. **REQUIREMENTS.md maintenance needs a hook or automation**: Three milestones in a row with unchecked requirements at close — either auto-check during SUMMARY commits or accept requirements archive as the canonical record
3. **TDD wave structure scales well to 3-plan phases**: Phase 43, 45, and 46 each ran 3 plans (Wave 0 → Wave 1 → Wave 2) with zero rework between plans. The interface contracts from Wave 0 types made Wave 2 UI integration straightforward
4. **C(15,11) enumeration is fast enough to not need caching**: 1,365 subsets evaluated synchronously in <1ms — `useMemo` is sufficient, no worker thread needed even for the chip mode greedy build over 650 players

### Cost Observations

- Model: Sonnet 4.6 throughout (executor + verifier)
- Sessions: 4 days, ~3-4 sessions
- Notable: Phase 42 pipeline work was faster than UI phases; Phase 46 (3 sub-components + engine) was the most work per plan

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

## Milestone: v1.3 — Gameweek Planner

**Shipped:** 2026-04-03
**Phases:** 7 (19-25) | **Plans:** 14 | **Timeline:** 2 days (2026-04-02 → 2026-04-03)

### What Was Built

- Data quality: xG proxy for all unmatched players, DefCon threshold raised to 5 games, pts_last3gw/5gw pipeline fields
- Auth UX: native `<dialog>` AuthModal with step-by-step Chrome DevTools guide, clipboard paste, three-state expiry display
- Planner tab shell: foundational type system + free transfer engine (31 TDD tests), navigation wiring, HorizonSelector
- Planning engine: `generatePlan()` pure function with greedy + 1-level look-ahead, DGW/BGW fixture scoring, hit threshold
- Transfer Output Table: semantic table with chip toggles, DGW/BGW badges, plan value headline, useImmer state
- Squad Snapshot: `positionsAfter` on PlanStep + `SquadSnapshotRow` accordion — 15-player per-GW view with transfer highlighting
- Manual Edit Mode: `generatePlanFrom()` re-scoring, `PlayerPickerModal` (native dialog), pencil/undo icons per row

### What Worked

- **Pure function first, UI second**: Phases 21 (free transfer engine), 22 (planning engine), 23 (plan helpers) all built as TDD pure functions before UI wiring — verification was clean with no rework
- **Native dialog pattern reuse**: `AuthModal` established the `<dialog>` pattern in Phase 20; `PlayerPickerModal` in Phase 25 followed it exactly — zero new concepts
- **useImmer for nested state**: Chip toggle and `planResult` mutations benefited from Immer — no manual spread-copy needed
- **Architecture separation**: Engine (Phase 22) → output table (Phase 23) → squad view (Phase 24) → edit mode (Phase 25) had clean interfaces — phases didn't bleed into each other

### What Was Inefficient

- **STATE.md progress counter stale**: Showed 0% / 0 phases despite all 7 phases completing — the percent field wasn't being updated by the executor
- **Two commits per re-execution on Phase 25-02**: Re-checking required an additional commit cycle — slight overhead

### Patterns Established

- **`generatePlanFrom()` entry point**: Mid-plan re-scoring via `(picksAfterStep, allPlayers, remainingHorizon, startingGw, ftStateAfterStep, bankAfterStep)` — reusable for any future override feature
- **Always-in-DOM native dialog**: `useRef<HTMLDialogElement>` + `useEffect([open])` → `showModal()/close()` — no null-ref, no conditional rendering
- **Immer + structuredClone for plan baseline**: `originalSteps` frozen once on generate, Immer mutations are forward-only — never touch the baseline

### Key Lessons

1. **Layered architecture pays off in complex features**: Engine → table → snapshot → edit mode was a clean 4-phase decomposition — each phase had clear acceptance criteria and no ambiguity about what was in scope
2. **TDD catches IEEE 754 surprises**: `-0 vs 0` in `computeHitCost` and an engine test assumption failure were caught immediately by TDD — would have been silent production bugs without it
3. **1-level look-ahead is sufficient for personal-use planners**: `LOOK_AHEAD_DISCOUNT=0.8` with GW+1 evaluation is fast enough and produces useful plans — no need for deeper recursion
4. **`readonly` modifier for Immer protection**: Adding `readonly` to `PlanResult.originalSteps` provides compile-time mutation protection — worth using on any Immer-adjacent baseline field

### Cost Observations

- Model: Sonnet 4.6 throughout (executor + verifier)
- Sessions: 2 days, ~4-5 sessions
- Notable: Planning engine phases (21-22) took longest (~8-12min per plan) due to TDD + complex type system; later phases (23-25) were faster once types were stable

---

## Milestone: v1.9 — Competitive Intelligence

**Shipped:** 2026-05-04
**Phases:** 5 (56-60) | **Plans:** 13 | **Timeline:** 2 days (2026-05-03 → 2026-05-04)
**Files changed:** 121 files, +27,865 / −1,388 lines

### What Was Built

- FT Engine Fix (Phase 56): Wildcard branch `Math.min(1, currentAvailable - 1)` formula; `initialFTState` useMemo in PlannerTab — corrects FT bank across all planning features downstream
- Effective Ownership Mode (Phase 57): `computeEOCandidates` (4 modes), `EOModeToggle`, ranked top-5 captain panel with EO%, Dangerous-to-fade badge — complete CaptainPicksPanel rewrite
- Mini-League Rival Tracker (Phase 58): `useRivals` hook with `p-limit(3)` concurrent batching; `rival-intel.ts` differential engine (shared/advantage/threats/blocking/captain edge); `RivalsTab` with league table + squad cards
- Manual Transfer Planner (Phase 59): `manual-plan.ts` engine (deriveStepStates, computeManualPlanSummary); `ManualPlanTab` with GW step cards, player picker, localStorage persistence; reused Phase 56 FT engine verbatim
- Transfer Route Tree (Phase 60): `buildTransferRouteTree` pure-TS greedy multi-branch engine (top-3 sell roots, position-matched continuation); `RouteTreeTab` expandable summary table; "Load into Manual Planner" bridge
- D-07 Section-Level Horizon Lift: `planHorizon` lifted to `page.tsx`; single `<HorizonSelector>` above Plan nav drives PlannerTab + ManualPlanTab + RouteTreeTab simultaneously

### What Worked

- **Phase 56 reuse chain**: `computeNextFTState` from Phase 56 was imported verbatim into Phase 59 (`manual-plan.ts`) and Phase 60 (`RouteTreeTab` bridge) — zero duplication; fixing the Wildcard bug once fixed it everywhere downstream
- **Pure engine first pattern**: `buildTransferRouteTree` (31 tests, 430 lines) and `manual-plan.ts` (17 tests) were fully tested before any UI work started — both integration layers were clean first-pass
- **D-07 horizon lift**: Lifting `planHorizon` to `page.tsx` was the right call even though it required touching 5 files — eliminated all cross-tab horizon drift that would otherwise have recurred as tech debt
- **TRT-05 bridge design**: Inline confirm only when plan has existing transfers; silent overwrite for empty plans — correct default behaviour from day one

### What Was Inefficient

- **Phase 60 VERIFICATION.md not created**: The verifier step was skipped for Phase 60 — UAT was recorded in STATE.md (14/14) but no VERIFICATION.md was produced. This caused the audit to flag gaps_found even though all requirements were met. The gap was documentation-only but visible at milestone close.
- **REQUIREMENTS.md checkboxes stale (again)**: This is the 4th+ milestone where most requirements ship with `[ ]` unchecked — only MTP-01..08 were correctly marked. Archive required manual review of all 29 requirements.
- **captain-picks.test.ts left failing**: Phase 57 rewrote CaptainPicksPanel but the pre-existing captain-picks test suite (5 failures) was not updated — carried forward as known technical debt rather than addressed during execution.

### Patterns Established

- **Section-level state lift for shared controls**: When 3+ sub-tabs need the same control value, lift to the section (page.tsx) owner — not each component. D-07 pattern reusable for future shared Plan controls.
- **`persistManualPlan` as bridge contract**: Serialising a `ManualPlan` to localStorage and switching sub-tabs is a reusable pattern for any future "load into Manual Planner" integration.
- **`p-limit` for FPL API batching**: `p-limit(3)` in `useRivals` is the correct pattern for concurrent FPL API requests — prevents 429s; reuse for any future multi-entry fetching.

### Key Lessons

1. **Create VERIFICATION.md during execute-phase, not after**: Phase 60 skipped the verifier step — 14/14 UAT tests passed but the documentation gap caused `gaps_found` at audit. VERIFICATION.md should be a mandatory execute-phase deliverable, not optional.
2. **REQUIREMENTS.md stale checkbox pattern is structural**: 4+ milestones in a row. The requirement is tracked in SUMMARY.md (via requirements mapping) and verified in VERIFICATION.md — the REQUIREMENTS.md checkbox is a redundant maintenance burden. Consider deprecating it as a live document; archive-only going forward.
3. **Small pre-existing test failures compound**: The 5 captain-picks failures from Phase 57's CaptainPicksPanel rewrite were accepted as known debt but created noise in every subsequent test run for the rest of the milestone. Fix test regressions in the same phase that causes them.
4. **D-07 pattern: lift state when ≥2 sub-tabs share it**: The local `useState<PlannerHorizon>` per sub-tab was the original design — it worked until Phase 60 added a third consumer. Lift earlier when ≥2 consumers are known at design time.

### Cost Observations

- Model: Sonnet 4.6 throughout (executor + verifier)
- Sessions: 2 days, ~6-8 sessions
- Notable: Phase 58 (4 plans) was the most work-intensive; Phase 60 Plan 02 was the most complex single plan (5 files modified, D-07 lift + 21 new tests)

---

## Milestone: v1.18 — Forecast Transparency & AI Intelligence

**Shipped:** 2026-05-14
**Phases:** 4 (102-105) | **Plans:** 9 | **Commits:** 79
**Timeline:** 1 day (2026-05-13 → 2026-05-14)
**Files changed:** 69 files, +10,321 / −1,123 lines

### What Was Built
- MC gate activation: 10k-sim MC fields live in production; MCDistributionBar in XPtsCell hover card; P10/P90 on captain picks (MC-01, MC-02)
- Calibration health: position-aware sparse-bucket thresholds; CalibrationHealthIndicator on Decision Summary (CAL-01, CAL-02)
- Transfer trust signals: computeRejection on sell-side OCS rows; fragility badges on buy candidates (WHY-01, SENS-01)
- NLP-02: per-player LLM insight via Claude Haiku — on-demand, two-tier cache, name-whitelist guardrail (NLP-02)

### What Worked
- All 5 major features had complete logic pre-shipped; v1.18 was entirely wiring + gating — execution was fast and predictable
- TDD wave structure (Wave 0 RED → Wave 1 → Wave 2) for Phase 105 gave clean RED→GREEN cycle with no regressions
- Sequencing rationale (MC first to unblock downstream, LLM last as cost-risk phase) held up exactly as planned

### What Was Inefficient
- REQUIREMENTS.md MC-01/MC-02 checkboxes not updated after Phase 102 executed — required manual fix at close
- ROADMAP.md Progress table for Phase 102 showed "0/3 Not started" at close — stale from before execution

### Key Lessons
- For LLM integration: on-demand trigger + two-tier cache + spending cap = sustainable cost model; `useMutation` not `useQuery` is the right primitive
- Named constants for permanent gate flips (`MC_ENABLED = True`) are cleaner than sticky-read overrides
- Python as the single authority for data quality gates (calibration thresholds) avoids TS/Python double-filtering confusion
- Cost-explosion risk from `useEffect` on expensive operations is non-obvious; document the invariant at the call site

### Cost Observations
- Model mix: Sonnet for planning/execution agents
- Sessions: ~1 day of execution
- Notable: Phase 105 (LLM integration) was sequenced last specifically because it's the only phase where a bug can spend money — this was the right call

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 104 | 6 | First milestone — GSD workflow established |
| v1.1 | ~45 | 6 | Additive schema extension pattern; pure functions first |
| v1.2 | ~67 | 6 | CSS-first responsive; TanStack VisibilityState reuse; dark mode without deps |
| v1.3 | ~55 | 7 | Complex feature architecture (engine → table → snapshot → edit); native dialog pattern; useImmer |
| v1.6 | 87 | 5 | Wave 0/1/2 TDD structure hardened; `chipMode` param extension over fork; spec errors caught by TDD |
| v1.7 | 88 | 5 | Compositor milestone — 5 independent engines composed into Decision Summary; all pure-function first |
| v1.8 | ~60 | 4 | Predictive model upgrades; flag-gated rollout (`xmins_v2_enabled`, `bonus_predictor_enabled`); benchOrder pure-TS |
| v1.9 | ~75 | 5 | Cross-component state lift (D-07); reuse chain (Phase 56 FT engine → 59 → 60); p-limit API batching |

### Cumulative Quality

| Milestone | Test Files | LOC (TS+Py) | Gap Closures |
|-----------|------------|-------------|--------------|
| v1.0 | ~15 | ~6,600 | 1 (06-04) |
| v1.1 | ~15 | ~6,600 | 0 |
| v1.2 | 16 | ~7,000 | 0 |
| v1.3 | ~20 | ~11,300 | 0 |
| v1.6 | ~30 | ~17,774 | 0 |
| v1.7 | ~40 | ~19,500 | 0 |
| v1.8 | ~45 | ~22,000 | 0 |
| v1.9 | ~55 | ~28,000 | 0 |

### Top Lessons (Verified Across Milestones)

1. TDD-first for pure functions pays back in cheaper UAT and gap closure — confirmed across v1.0, v1.1, v1.3, v1.6, v1.7, v1.9
2. DAT/infra requirements need operational smoke tests, not just scaffolding — multi-milestone deferral is a smell (DAT-01 v1.0→v1.1→v1.2 before resolution)
3. Established patterns compound across phases — getting Phase 1 of a milestone right (isMobile, zinc dark scale, native dialog, TDD wave structure) pays forward 4+ phases later
4. CSS-first (no JS for show/hide, no library for dark mode) avoids hydration issues and reduces dependencies
5. Clean architectural layering pays off in complex features — engine → output → visualization → edit mode with clear interfaces means no rework between phases
6. Extending a shared function via param (chipMode, blend_alpha) is safer than forking — one test suite, one call site, consistent behaviour
7. REQUIREMENTS.md maintenance is a recurring gap — 4+ milestones with stale checkboxes; treat archive as canonical going forward; deprecate REQUIREMENTS.md as a live document
8. VERIFICATION.md must be created during execute-phase — skipping it (Phase 60) causes gaps_found at audit even when all requirements are met; documentation gaps are not free
9. Phase engine reuse chains are high-leverage — Phase 56 FT engine fix propagated correctly to Phase 59 and Phase 60 at zero incremental cost; fix once, benefit everywhere downstream

---
