# UIX-04: Remaining-Tab Migration

**Feature ID:** UIX-04 (UI overhaul phase 4/5)
**Date:** 2026-06-12
**Status:** Approved
**Depends on:** UIX-01/02/03 (shipped). **The UIX-03 spec's badge policy, acceptance gates, and grep rules apply verbatim** (`2026-06-12-uix03-table-migration-design.md`). Inventory contract: `2026-06-12-uix01-feature-inventory.md`.

---

## Goal

Migrate the 20 remaining tools onto the design system (tokens + primitives), in four batches, zero behavioural change. After this phase the only raw palette classes in `src/components/` are the sanctioned exceptions below — UIX-05 sweeps the rest of `src/`.

## Policy rulings (extends UIX-03 policy)

1. **FDR/difficulty scales are data, not chrome**: FixtureHeatMap (club-form) maps its green/amber/red tiers to the SAME positive-soft/warning-soft/negative-soft tiers FixtureBadges adopted in UIX-03. Information encoding preserved; its 42 class assertions update to token classes (behaviour assertions untouched).
2. **Representational visuals are sanctioned exceptions**: the football-pitch green gradients + white/20 line overlays (perfect-gw pitch, lineup pitch/bench layout) stay, each marked `/* UIX-04 sanctioned exception: representational pitch visual */`.
3. **Price/result semantics** (rise/fall, hit/miss, playing/benched, budget validity): map to positive/negative/warning tokens — never flatten to accent.
4. **No PlayerCell adoption** this phase: no remaining tab is a player table; bespoke rows/cards are retokenized in place (optional refactors are out of scope).
5. **Recharts theming** (rank-sim only): replace hardcoded `#f59e0b` (alt-scenario line + legend swatch) with `var(--color-accent)`; `rgba(161,161,170,...)` grid/confidence-band strokes with color-mix or token-based rgba on `--color-ink-muted`; keep the existing `currentColor`/`var(--background)` patterns (they're already correct — see the file's dark-mode pitfall comments).

## Batches (execute in order; each batch = one task with the UIX-03 7-step template per tab)

| Batch | Tools → files | Key specifics |
|---|---|---|
| **A — quick wins** | insights (`insights/InsightsTab.tsx`, already token-pure — VERIFY + grep only), price-reset (`price-reset/PriceResetTab.tsx`), price-changes (`price-changes/PriceChangePanel.tsx`), watchlist (`watchlist/` — PriceTrendCell already done), window (`news/SummerWindowTab.tsx` + NewsBanner), rivals (`rivals/` 3 files) | NewsBanner test has 17 class asserts; WatchlistPlayerCard 7 |
| **B — This Week** | decision (`squad/DecisionSummaryTab.tsx` 742 LOC), lineup (`squad/LineupTab.tsx`), live (`squad/LiveGwTab.tsx`), review (`squad/GwReviewTab.tsx`) | Shared `squad/` helpers (SquadView, StatusLabelBadge/LifecycleLabelBadge/MinsRiskBadge already token-pure); pitch exception applies to lineup; live-state colors per ruling 3 |
| **C — Planning** | planner (`planner/PlannerTab.tsx` + TransferPlanTable + ChipStrategyPanel), manual-plan (`planner/ManualPlanTab.tsx` + PlayerPickerModal), route-tree (`planner/RouteTreeTab.tsx`), wildcard (`planner/WildcardBuilderTab.tsx`), rank-sim (`planner/RankSimTab.tsx` + recharts ruling 5) | TransferPlanTable/PlayerPickerModal are SHARED between planner+manual-plan — migrate once, verify both tabs; tree-connector colors → line/accent tokens |
| **D — My Squad + fixture visuals** | transfers (`transfers/TransferPanel.tsx` + OpportunityCostTable), optimiser (`optimiser/` 3 tables + ChipSquadView), club-form (`club-form/` 8 files incl. FixtureHeatMap ruling 1), perfect-gw (`perfect-gw/` 5 files, pitch exception) | The two riskiest reskins (FixtureHeatMap 42-assert test; optimiser 9); form chrome (inputs/selects) → `border-line bg-surface-1 text-ink focus-visible` ring tokens |

## Acceptance (per batch, per the UIX-03 gates)

Grep gate on each migrated dir (zinc-|gray-|raw hex, comments/test-data/sanctioned exceptions excluded); full vitest + tsc (4 known pre-existing error files only — note SummerWindowTab.test and LiveGwTab.test are IN this phase's scope: fixing their pre-existing type errors is now sanctioned IF touched for class assertions anyway, report either way); e2e 63; contrast-check; per-tab inventory walkthrough in a real browser (seed pgw-reviewed flags; kill stale port-3000 servers first).

## Out of scope

- accuracy + season tabs (Model group → UIX-05 along with the polish sweep)
- shared non-tab components not listed (modals/banners outside these dirs unless imported by a batch tab)
- Legacy CSS alias removal (UIX-05)
- Behavioural changes, PlayerCell refactors
