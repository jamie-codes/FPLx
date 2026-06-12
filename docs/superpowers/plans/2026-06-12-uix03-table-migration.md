# UIX-03: Table Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five player-table surfaces migrated onto the UIX-01 primitives (PlayerCell/TableShell/Chip/SegmentedToggle), token-pure, with zero behavioural change.

**Architecture:** Stage 0 builds the three primitive extensions; then five tab migrations easiest→hardest, each gated by the per-tab acceptance checklist before the next starts. **The spec `docs/superpowers/specs/2026-06-12-uix03-table-migration-design.md` is BINDING** — its sticky-column contract, badge-mapping table, per-tab scope, named Gem-Ratings hazards, and acceptance gates govern wherever this plan abbreviates. The feature inventory (`2026-06-12-uix01-feature-inventory.md`) sections for each tab are the behavioural contract.

**Tech Stack:** React 19, UIX-01 tokens/primitives, TanStack table (engines untouched), Vitest + RTL, Playwright.

**MANDATORY pre-reading per task:** the spec (whole); `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`; the target tab's current files IN FULL before editing; `src/components/ui/` primitive APIs.

---

## Task 0: primitive extensions (TDD each)

**Files:** Modify `src/components/ui/Table.tsx`, `Chip.tsx`, `src/app/globals.css`, `scripts/contrast-check.mjs`; Create `src/components/ui/SegmentedToggle.tsx`; tests in `src/components/ui/ui.test.tsx` + `table-player.test.tsx`.

- [ ] **0a — violet token pair**: globals.css gains `--sp-violet` light `#7c3aed` / dark `#a78bfa` + `--sp-violet-soft` light `rgba(124,58,237,0.10)` / dark `rgba(167,139,250,0.14)`, exposed as `--color-violet`/`--color-violet-soft`. Add the two violet-on-soft∘surface-1 pairs to `scripts/contrast-check.mjs`; run it — if a pair is < 4.5, darken light / lighten dark violet until both pass and RECORD the final hex in a code comment. Commit `feat(uix-03): violet token pair (AA-verified)`.
- [ ] **0b — Chip**: `intent` union gains `'violet'` (`bg-violet-soft text-violet border-violet/40`); new `variant?: 'solid' | 'outline'` (default `'solid'`; outline = `bg-transparent` + intent border/ink). Tests: violet renders its classes; outline drops the soft bg and keeps border/ink. Commit `feat(uix-03): Chip violet intent + outline variant`.
- [ ] **0c — sticky column**: `TableShell` gains `stickyFirstCol?: boolean` (purely documentation/no-op wrapper-level — the mechanics live on cells); `Th`/`Td` gain `sticky?: boolean` → exactly per the spec contract: Th `sticky left-0 z-30 bg-surface-1`, Td `sticky left-0 z-10 bg-surface-1`; when `TableShell stickyHeader` is used, non-sticky `Th` keep `z-20` via a documented `className="z-20"` passthrough at the call site (note this in Table.tsx's comment with the full z-tier table from the spec). Tests: sticky Th/Td render the positional+bg classes; non-sticky unchanged. Commit `feat(uix-03): sticky-first-column support in table chrome`.
- [ ] **0d — SegmentedToggle**: per the spec signature (`options/value/onChange/size/ariaLabel`); active `bg-ink text-surface-1`, inactive `text-ink-muted hover:bg-surface-2`; container `inline-flex rounded-md border border-line overflow-hidden`; buttons `aria-pressed`, sm `min-h-[32px] px-3 text-data` / md `min-h-[44px] px-4 text-body`. Tests: renders options, onChange fires, aria-pressed on active, group `role="group" aria-label`. Commit `feat(uix-03): SegmentedToggle primitive`.

Gauntlet after Task 0: full vitest (baseline 1957/162 + new), tsc (4 known files only), `node scripts/contrast-check.mjs`.

## Tasks 1–5: tab migrations (one task per tab, IN ORDER; the spec's per-tab scope section is the work order)

Identical step template per tab — repeated here once in full; EVERY tab task follows ALL steps:

- [ ] **Step 1**: Read the tab's files in full + its feature-inventory section + the spec's entry for it.
- [ ] **Step 2**: If the tab's existing tests assert raw classes (zinc etc.), list them; you will update class assertions to token equivalents (behavioural assertions untouched).
- [ ] **Step 3**: Migrate per the spec: chrome → TableShell/Th/Td (delete local TABLE_CLS-style constants); raw palette → tokens; badges per the spec's badge-policy table (Chip for the clean 8, retokenized internals for MinsRisk/Fragility/RoutePills/FixtureBadges when they appear in this tab); segmented controls → SegmentedToggle; identity columns → PlayerCell where the spec says so.
- [ ] **Step 4**: Grep gate: `grep -rn "zinc-\|gray-\|#[0-9a-fA-F]\{3,6\}" <tab dir>` → zero hits in the migrated files (hex in comments OK).
- [ ] **Step 5**: Full vitest + tsc + e2e 63 + contrast-check — all green; fix collaterals without weakening behaviour assertions.
- [ ] **Step 6**: Inventory walkthrough of THIS tab (run dev server, exercise the interactions listed in the inventory for it; report what you verified).
- [ ] **Step 7**: Commit `feat(uix-03): migrate <tab> to primitives/tokens`.

### Task 1: DefCon (`src/components/defcon/`)
Specifics: both tables via the shared `renderTable` helper → TableShell/Th/Td once; `text-green-600/text-red-600` distance colouring → `text-positive`/`text-negative`; PlayerCell: check whether defcon rows carry `code`/`team_code` or can join `usePlayers()` by id cheaply at render (a `Map<id, MergedPlayer>` memo) — if yes adopt PlayerCell sm, if not retokenize the text cells and RECORD the reason. LandscapeTip retokenize.

### Task 2: Value Gems (`src/components/value-gems/`)
Specifics: filter pills → SegmentedToggle (`cheap/low-owned/all` options); identity → PlayerCell sm (MergedPlayer has code/team_code); UNIFY PriceTrendCell with GemTable's trend cell into ONE shared `src/components/shared/PriceTrendCell.tsx` consumed by both (this task creates it + repoints value-gems; Task 5 repoints GemTable — leave a comment); keep the `pts_lastNgw` asterisk/tooltip.

### Task 3: Weekly Picks (`src/components/weekly-picks/`)
Specifics: delete local TABLE_CLS/TH_CLS/TR_CLS/TD_CLS, use TableShell/Th/Td + TR_CLS from ui/Table; rows → PlayerCell sm (replaces manual name+pos/team spans; keep the ⚠ → `Chip intent="warning" size="sm"` with title); preserve the conditional Haul column + colSpan logic and ExpandedPanel exactly; ConfidenceStrip/UnderTheRadar already token-pure (UIX-02 era) — verify, don't touch unless raw classes found.

### Task 4: Set Pieces (`src/components/set-pieces/`)
Specifics: league table → TableShell + tokens, KEEP the responsive `hidden sm/md/lg:table-cell` column classes verbatim; taker cards → `Card` primitive; DeliveryQualityBadge/"Changed" pill → Chip per mapping; RotationRiskBadge → Chip warning; SetPieceViewToggle → SegmentedToggle; TeamCrest stays. NO PlayerCell (team-level surface — spec).

### Task 5: Gem Ratings (`src/components/gem-table/` — flagship, LAST)
Specifics: TanStack engine, sortingFns, getColumnVisibility, presets, watchlist, compare, action sheet — ALL untouched. Chrome: wrapper → `TableShell stickyFirstCol stickyHeader`; th/td class blobs → `Th`/`Td` (+`sticky` on web_name cells; non-sticky th get `className="z-20"`); columns.tsx tokens throughout. Identity column → `PlayerCell` sm INSIDE the existing cell renderer (the hover ⊞ compare button and the cell's current structure/stopPropagation stay wrapped around it). Badges: status pill/Differential/Regression/Variance/ConfirmedSigning → Chip per mapping; MinsRisk/Fragility/RoutePills/FixtureBadges → retokenized internals per spec. Repoint trend cell to the shared PriceTrendCell from Task 2.
**The spec's five named hazards are the review checklist for this task — verify each explicitly after migration** (z-tiers + XPtsCell hover card visible above sticky cells; dual expand rows + colSpan; row onClick vs stopPropagation; visibility matrix; custom sorts). The inventory walkthrough for this tab must exercise: sort 3 columns, switch all 3 presets, all 3 horizons, position filter, expand a row on both viewport widths, watchlist star, compare flow, XPts hover card over a scrolled table.

---

## Final acceptance (after Task 5)

- Full suites: vitest, e2e (63), pipeline untouched, contrast-check, tsc (4 known files only)
- Repo-wide grep: `grep -rln "zinc-\|gray-" src/components/{defcon,value-gems,weekly-picks,set-pieces,gem-table}` → empty
- Roadmap + memory updated (controller does this)

## Self-review

- Spec coverage: Stage-0 trio ✓T0, order+per-tab scope ✓T1-5, badge policy ✓ (template Step 3 + per-tab specifics), sticky contract ✓0c+T5, PriceTrendCell unification ✓T2/T5, hazards checklist ✓T5, acceptance gates ✓ template Steps 4-6 + final.
- No placeholders: per-tab specifics carry the decisions; verify-on-read items (defcon code join) have defined fallbacks.
- Type consistency: SegmentedToggle/Chip APIs defined T0, consumed T2/T4/T5; PriceTrendCell created T2, consumed T5.
