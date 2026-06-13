# UIX-05: Closing Phase — Model Tabs, Alias Removal, Final Audit

**Feature ID:** UIX-05 (UI overhaul phase 5/5 — final)
**Date:** 2026-06-13
**Status:** Approved
**Depends on:** UIX-01/02/03/04 (all shipped). Binding precedents: UIX-03 badge policy + 7-step per-tab template; UIX-04 rulings (semantic colours, recharts via CSS vars/`color-mix`, sanctioned exceptions). Inventory contract: `2026-06-12-uix01-feature-inventory.md`.

---

## Goal

Finish the overhaul: migrate the last 12 raw-palette files, remove the legacy CSS alias layer entirely, zero the tsc baseline, clear the parked audit minors, and run the closing a11y/responsive/motion audit. **Definition of done for the WHOLE overhaul:** repo-wide raw-palette grep returns only the sanctioned perfect-gw pitch exception; zero legacy aliases in globals.css; tsc fully clean; all suites + 30 contrast pairs green; closing-audit report committed.

## Survey-corrected premise

The survey's "~80 files use `bg-surface`" is a regex artifact — `bg-surface\b` also matches the NEW `bg-surface-1/2` tokens. True legacy-alias usage is concentrated (InsightsTab is the hub). Aliases `bg-background`, `bg-secondary`, `text-secondary` have **zero** consumers and are deletable immediately.

## Batches (execute in order; UIX-03 7-step template per file; semantic-colour ruling 3 and recharts ruling 5 from UIX-04 apply verbatim)

### Batch 1 — Model + chart files (369 of 491 raw refs)
- `accuracy/AccuracyTab.tsx` (1184 LOC): hand-rolled `AccuracySubTabNav` → `ui/Tabs`; the position-pill row → `ui/SegmentedToggle`; `CalibrationTooltip` zinc literals → tokens; CartesianGrid/ReferenceLine/axis `rgba(161,161,170,0.x)` strokes → `color-mix(in srgb, var(--color-ink-muted) X%, transparent)`; sparkline status dots already tokenized (leave). DataHealthPanel (inline) tokens.
- `accuracy/BackTab.tsx` (691 LOC): `REGRET_RED '#ef4444'`→`var(--color-negative)`, `REGRET_GREEN '#22c55e'`→`var(--color-positive)`, `REGRET_GREY`→muted color-mix, consumed by `regretFill()`/`transferRegretFill()` `<Cell fill>`; ReferenceLine strokes → muted color-mix; table chrome tokens.
- `season-review/SeasonReviewTab.tsx` (417 LOC): highlight dot/legend `#f59e0b`→`var(--color-accent)` (rank-sim precedent); grid `rgba(161,161,170,0.x)`→muted color-mix; keep `currentColor` line/dot.
Commit: `feat(uix-05): migrate Model + chart tabs to tokens (Tabs/SegmentedToggle + recharts)`

### Batch 2 — chrome + widgets (the other 9)
`DeadlineBanner.tsx` (urgency tiers → warning/negative per ruling 3; its 14-assert test → tokens), `captaincy/CaptainPicksPanel.tsx` + `captaincy/CaptaincyPanel.tsx`, `mc/MCDistributionBar.tsx`, `push/BellNotificationButton.tsx`, `shared/PlayerInsightSection.tsx`, `shared/PlayerSearchInput.tsx` (input chrome per template), `shared/VerdictBadge.tsx`, `theme/ThemeToggle.tsx`, plus `LastUpdated.tsx` (legacy-alias consumer; included here for grouping). Commit: `feat(uix-05): migrate remaining chrome widgets to tokens`

### Batch 3 — legacy alias endgame
1. Migrate true-legacy-alias consumers to new tokens: `insights/InsightsTab.tsx` (the hub — `text-muted`→`text-ink-muted`, `text-foreground`→`text-ink`, `border-border`→`border-line`, `bg-primary/text-primary`→appropriate accent/positive per meaning, `bg-surface-elevated`→`bg-surface-2`, bare `bg-surface`→`bg-surface-1`), the `ui/` primitives' own bare `bg-surface`/`text-foreground` references, `app/page.tsx` (1× bg-surface), any LastUpdated remnants. Precise regex (`\bbg-surface\b` NOT `bg-surface-`) to avoid touching the new tokens.
2. Delete the entire legacy-alias block from `app/globals.css` (`--surface`, `--surface-elevated`, `--foreground`, `--muted`, `--border`, `--color-primary/secondary`, `--background`, etc. and their `@theme inline` exposures).
3. Grep gate: `git grep -nE '\b(bg-surface|text-foreground|text-muted|border-border|bg-primary|text-primary|bg-surface-elevated|bg-background|bg-secondary|text-secondary)\b' -- src` (word-boundary, excluding `-1/-2/-soft/-hover` suffixes) → zero.
Commit: `feat(uix-05): remove legacy CSS alias layer (breaking sweep complete)`

### Batch 4 — tsc zero + parked minors + closing audit
1. **tsc to zero**: `api/auth/fpl-login/route.test.ts` — change 5 call sites to `await POST()` (stub takes no args; the dead ENDPOINT_GONE endpoint); `api/decision-history/route.test.ts:218` — one-line mock type assertion. After: `npx tsc --noEmit` exits 0.
2. **Parked minors** (from UIX-01/02 audits): brand mark onto `--text-display` (Sidebar/TopBar arbitrary `text-3xl`); MoreSheet drag-handle/grabber affordance; ActionCards numeric support lines `.tabular`; mobile Home skeleton sized to the loaded squad card; document the 2px sub-grid policy for dense-data UI in a globals.css comment; TopBar right-cluster narrow-phone squeeze check (add `min-w-0`/truncation if it overflows at 360px).
3. **Closing audit** (write findings to `docs/superpowers/specs/2026-06-13-uix05-closing-audit.md`, committed): a11y keyboard pass (tab through shell + one table + one modal; focus visible; aria roles correct); responsive walkthrough at 360/430/768/1440 (no horizontal overflow — the mobile-overflow e2e covers tabs; spot-check Home + Accuracy charts); motion consistency (150/250ms tokens; reduced-motion honoured); fresh `contrast-check` incl. any new pairs; final repo-wide raw-palette grep (only pitch exception remains).
Commit: `feat(uix-05): tsc zero, parked polish minors, closing audit`

## Acceptance (overhaul exit exam)

- Full vitest green; e2e 63 green; `node scripts/contrast-check.mjs` green; **`npx tsc --noEmit` exits 0** (first time in the project)
- `git grep -nE 'zinc-|gray-' -- src` → only `perfect-gw/PerfectGWPitch.tsx` sanctioned lines
- Legacy-alias grep → zero
- Closing-audit doc committed
- Pipeline untouched (583 still green)

## Out of scope

- New features / behavioural change (pure reskin + cleanup)
- TFR-01 (backlogged separately)
- Deeper a11y beyond keyboard/aria/contrast/motion (screen-reader certification, etc.)
