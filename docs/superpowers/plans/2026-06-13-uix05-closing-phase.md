# UIX-05: Closing Phase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the UI overhaul — migrate the last 12 raw-palette files, delete the legacy CSS alias layer, zero the tsc baseline, clear parked minors, run the closing audit.

**Architecture:** Four batch tasks following the proven UIX-03/04 process (per-tab/file 7-step template, semantic-colour ruling 3, recharts ruling 5). **Binding docs**: the UIX-05 spec (`docs/superpowers/specs/2026-06-13-uix05-closing-phase-design.md`), UIX-03 spec (badge policy + template), UIX-04 spec (rulings). Where this plan abbreviates, those govern.

**Tech Stack:** React 19, UIX-01 tokens/primitives, recharts, Vitest + RTL, Playwright.

**MANDATORY pre-reading per task:** the UIX-05 spec; `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`; the files in full before editing; `src/components/ui/` (Tabs, SegmentedToggle, Chip APIs).

---

## The per-file template (identical to UIX-03/04)

1. Read the file in full + its inventory section + the spec's batch entry + applicable rulings.
2. List existing tests with class-level assertions (spec/survey flagged: DeadlineBanner 14, AccuracyTab 0, CaptainPicksPanel 0).
3. Migrate: raw palette → semantic tokens; recharts hex/rgba → CSS vars / `color-mix(in srgb, var(--color-ink-muted) X%, transparent)`; hand-rolled pill navs → `ui/Tabs` or `ui/SegmentedToggle`; inputs → `border-line bg-surface-1 text-ink rounded-md min-h-[44px]` + global focus ring; semantic colours per ruling 3.
4. Grep gate per file: `git grep -nE 'zinc-|gray-|#[0-9a-fA-F]{3,6}' -- <file>` → zero (comments/test-data excepted, justify survivors).
5. Full vitest + tsc + contrast-check after each file/cluster; e2e 63 once per BATCH.
6. Inventory walkthrough of the batch's surfaces in a real browser (seed `pgw-reviewed:GW*`; kill stale port-3000 first; charts checked in BOTH themes).
7. One commit per batch with the spec's message.

### Task 1: Batch 1 — Model + chart files
`accuracy/AccuracyTab.tsx`, `accuracy/BackTab.tsx`, `season-review/SeasonReviewTab.tsx` per the spec's Batch-1 specifics. AccuracyTab: `AccuracySubTabNav` (the `role="tab"` button row, active `bg-zinc-900 text-white dark:bg-zinc-100…`) → `ui/Tabs`; the position-pill row → `ui/SegmentedToggle`; calibration `data-testid` values (`calibration-chart`, `calibration-xpts-chart`) PRESERVED (e2e/tests depend on them). BackTab regret hex constants → CSS-var equivalents in the `<Cell fill>` functions. SeasonReview `#f59e0b`→accent. Verify each chart renders in light AND dark (screenshot). Commit: `feat(uix-05): migrate Model + chart tabs to tokens (Tabs/SegmentedToggle + recharts)`.

### Task 2: Batch 2 — chrome + widgets
`DeadlineBanner.tsx` (+ its 14-assert test → tokens; urgency tiers per ruling 3), `captaincy/CaptainPicksPanel.tsx`, `captaincy/CaptaincyPanel.tsx`, `mc/MCDistributionBar.tsx`, `push/BellNotificationButton.tsx`, `shared/PlayerInsightSection.tsx`, `shared/PlayerSearchInput.tsx`, `shared/VerdictBadge.tsx`, `theme/ThemeToggle.tsx`, `LastUpdated.tsx`. Commit: `feat(uix-05): migrate remaining chrome widgets to tokens`.

### Task 3: Batch 3 — legacy alias endgame
- [ ] **3a** Migrate true-legacy-alias consumers (PRECISE word-boundary regex — `\bbg-surface\b` NOT `bg-surface-1/2`): `insights/InsightsTab.tsx` (the hub: `text-muted`→`text-ink-muted`, `text-foreground`→`text-ink`, `border-border`→`border-line`, `bg-surface-elevated`→`bg-surface-2`, bare `bg-surface`→`bg-surface-1`, `bg-primary`/`text-primary`→accent or positive by meaning — read each in context), the `ui/` primitives' own bare-alias refs, `app/page.tsx` (1× bg-surface), `LastUpdated.tsx` remnants.
- [ ] **3b** Delete the legacy-alias block from `app/globals.css` (the `--surface`, `--surface-elevated`, `--foreground`, `--muted`, `--border`, `--color-primary`, `--color-secondary`, `--background` vars + their `@theme inline` exposures). Keep the `--sp-*` tokens and their `--color-*` mappings.
- [ ] **3c** Grep gate: `git grep -nE '\b(bg-surface|text-foreground|text-muted|border-border|bg-primary|text-primary|bg-surface-elevated|bg-background|bg-secondary|text-secondary)\b' -- src` (these bare names; the `-1/-2/-soft/-hover/-ink` suffixed tokens are fine) → ZERO. Full vitest + tsc + contrast + e2e 63; browser pass in BOTH themes confirming nothing lost its surface/text colour. Commit: `feat(uix-05): remove legacy CSS alias layer (breaking sweep complete)`.

### Task 4: Batch 4 — tsc zero + parked minors + closing audit
- [ ] **4a tsc zero**: `api/auth/fpl-login/route.test.ts` — 5 call sites `await POST(req)` → `await POST()` (stub takes no args). `api/decision-history/route.test.ts:218` — one-line mock type assertion (`vi.mocked(fsMod.readFile as unknown as (p: unknown) => Promise<Buffer>)` or annotate the param). Run `npx tsc --noEmit` → exits 0. Commit allowed standalone or folded into 4-final.
- [ ] **4b parked minors**: brand mark → `text-display` token (Sidebar + TopBar, replacing arbitrary `text-3xl`); MoreSheet drag-handle grabber (a centered `h-1 w-9 rounded-full bg-line` at sheet top); ActionCards numeric support lines get `.tabular`; mobile Home loading skeleton sized ~`h-[28rem]` to match the loaded squad card; globals.css comment documenting the 2px sub-grid policy for dense data; TopBar right-cluster `min-w-0` + truncation verified at 360px.
- [ ] **4c closing audit**: write `docs/superpowers/specs/2026-06-13-uix05-closing-audit.md` (committed) covering — a11y (keyboard tab through shell + gem table + MoreSheet; focus-visible present; aria roles correct), responsive (360/430/768/1440 — Home + Accuracy charts no overflow; the mobile-overflow e2e already covers the 27 tabs), motion (150/250ms tokens consistent; `prefers-reduced-motion` honoured), `contrast-check` green, final `git grep -nE 'zinc-|gray-' -- src` → only `perfect-gw/PerfectGWPitch.tsx` sanctioned lines.
- Commit: `feat(uix-05): tsc zero, parked polish minors, closing audit`.

---

## Final acceptance (overhaul exit exam)

- vitest green; e2e 63 green; contrast 30 pairs green; **`npx tsc --noEmit` exits 0**
- `git grep -nE 'zinc-|gray-' -- src` → only PerfectGWPitch sanctioned lines
- legacy-alias grep → zero
- closing-audit doc committed; pipeline 583 still green
- Controller updates roadmap/memory + marks the overhaul COMPLETE

## Self-review

- Spec coverage: Batch 1 charts+Tabs/SegmentedToggle ✓T1; 9 widgets ✓T2; alias migrate+delete+gate ✓T3; tsc zero ✓4a; all parked minors enumerated ✓4b; audit doc ✓4c; exit exam ✓final.
- No placeholders: every file named; recharts mappings explicit; tsc fixes are exact edits; minors each have a concrete change.
- Consistency: Tabs/SegmentedToggle/Chip referenced exist (UIX-01/03); `calibration-chart` testid preservation called out (regression guard); precise alias regex avoids touching new tokens.
