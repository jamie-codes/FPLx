# UIX-04: Remaining-Tab Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All 20 remaining tools token-pure on the design system, in four batch tasks, zero behavioural change.

**Architecture:** Mechanical retokenization batches following the proven UIX-03 process. **Two binding documents govern everything**: the UIX-04 spec (`docs/superpowers/specs/2026-06-12-uix04-remaining-tabs-design.md` — batch composition, the five policy rulings, acceptance) and the UIX-03 spec's badge policy + 7-step per-tab template (`2026-06-12-uix03-table-migration-design.md` + the template in `docs/superpowers/plans/2026-06-12-uix03-table-migration.md`). Where this plan abbreviates, those govern.

**Tech Stack:** React 19, UIX-01 tokens/primitives, recharts (rank-sim only), Vitest + RTL, Playwright.

---

## The per-tab template (identical to UIX-03's — applies to every tab in every batch)

1. Read the tab's files in full + its feature-inventory section + the spec's batch row + applicable policy rulings.
2. List existing tests with class-level assertions (the spec's survey flagged the heavy ones: FixtureHeatMap 42, NewsBanner 17, OptimiserPanel 9, ProseSummaryBlock 8, WildcardBuilderTab 8, WatchlistPlayerCard 7).
3. Migrate: raw palette → semantic tokens; cards/panels → `Card` where structure fits naturally (do NOT force; a token-pure `<div>` is acceptable when Card's header/padding model doesn't fit); inputs/selects → `border-line bg-surface-1 text-ink rounded-md min-h-[44px]` with the global focus-visible ring; semantic colours per ruling 3; sanctioned exceptions marked with the spec's comment.
4. Grep gate per dir: `git grep -nE 'zinc-|gray-|#[0-9a-fA-F]{3,6}' -- <dir>` → only comments/test-data/sanctioned-exception lines remain (justify each survivor in the report).
5. Full vitest + tsc + contrast-check after each TAB; e2e once per BATCH (63 expected).
6. Inventory walkthrough of the batch's tabs in a real browser (seed `pgw-reviewed:GW*`; kill stale port-3000 first).
7. One commit per batch: `feat(uix-04): migrate batch <X> (<tools>) to tokens`.

### Task 1: Batch A — quick wins
`insights/` (VERIFY only: grep gate + walkthrough, no edits expected), `price-reset/`, `price-changes/`, `watchlist/`, `news/SummerWindowTab.tsx` + `news/NewsBanner*` (its 17-assert test updates to tokens), `rivals/` (3 files). Price rise/fall → `text-positive`/`text-negative` (ruling 3). NOTE: `SummerWindowTab.test.tsx` is one of the 4 known tsc-error files — since you're updating its class assertions anyway, ALSO fix its pre-existing type errors (sanctioned by the spec's acceptance section); after this batch the known-error file count drops to 3 — report the new tsc baseline.

### Task 2: Batch B — This Week
`squad/DecisionSummaryTab.tsx` (742 LOC — the bulk), `squad/LineupTab.tsx` (pitch/bench layout: pitch greens = sanctioned exception, chrome around it tokenizes), `squad/LiveGwTab.tsx` (playing/benched states → positive/warning/neutral; its test is another known tsc-error file — same sanction as Batch A: fix while touching; report new baseline, expect 2 remaining), `squad/GwReviewTab.tsx` (hit/miss → positive/negative). Shared `squad/` helpers (SquadView, CalibrationHealthIndicator, ProseSummaryBlock, NoSquadPlaceholder etc.) migrate WITH this batch when imported by these four tabs.

### Task 3: Batch C — Planning
`planner/PlannerTab.tsx` + `planner/TransferPlanTable.tsx` + `planner/ChipStrategyPanel.tsx`, `planner/ManualPlanTab.tsx` + `planner/PlayerPickerModal.tsx` (modal overlay → `bg-ink/40` backdrop + surface-1 panel, e2 elevation), `planner/RouteTreeTab.tsx` (tree connectors → `border-line`, active branch → accent), `planner/WildcardBuilderTab.tsx` (budget validity → positive/negative), `planner/RankSimTab.tsx` (recharts ruling 5: `#f59e0b`→`var(--color-accent)` on the alt line + legend swatch; the two `rgba(161,161,170,…)` strokes → rgba built on the muted token — e.g. `color-mix(in srgb, var(--color-ink-muted) 30%, transparent)`; keep existing currentColor/var(--background) patterns and the file's dark-mode pitfall comments). TransferPlanTable + PlayerPickerModal are shared by planner AND manual-plan — migrate once, walkthrough BOTH tabs.

### Task 4: Batch D — My Squad + fixture visuals (the two named risks)
`transfers/TransferPanel.tsx` + `transfers/OpportunityCostTable.tsx` (form chrome per template; AuthModal only if it has raw palette — check), `optimiser/` (3 tables + ChipSquadView; TableShell/Th/Td where they're plain tables; 9-assert test), `club-form/` (8 files; **FixtureHeatMap per ruling 1**: tiers → positive-soft/warning-soft/negative-soft matching FixtureBadges' UIX-03 mapping; its 42 class assertions → token equivalents, behaviour assertions untouched), `perfect-gw/` (5 files; pitch gradient = sanctioned exception; TopScorersTable → TableShell). Walkthrough must exercise: club-form view toggle + heat map tiers visibly distinct in both themes; optimiser run on each mode; transfers form + OCS table; perfect-gw pitch render.

---

## Final acceptance (after Task 4)

- Suites: full vitest, e2e 63, contrast 30 pairs, tsc (expected: only `api/auth/fpl-login/route.test.ts` + `api/decision-history/route.test.ts` remain — report actual)
- Repo grep: `git grep -lE 'zinc-|gray-'` -- src/components → only files outside UIX-04 scope (accuracy/, season/, shared modals not imported by batch tabs — list them; they're UIX-05's sweep) + sanctioned exceptions
- Controller updates roadmap/memory.

## Self-review

- Spec coverage: 4 batches ✓ Tasks 1-4; 5 rulings ✓ (1→T4 club-form, 2→T2 lineup + T4 perfect-gw, 3→T1/T2/T3 semantics, 4→no PlayerCell anywhere, 5→T3 rank-sim); shared-component single-migration ✓ T3; tsc-error-file fixes sanctioned ✓ T1/T2; gates ✓ template + final.
- No placeholders: every batch lists exact dirs/files + specific colour rulings; "check AuthModal" has a defined condition.
- Consistency: template references UIX-03 docs that exist; token utilities referenced all exist post-UIX-03.
