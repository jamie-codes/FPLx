# UIX-05 Closing Audit — UI Overhaul Exit Exam (UIX-01 → UIX-05)

**Date:** 2026-06-13
**Auditor role:** Closing auditor for the entire 5-phase UI overhaul
**Scope:** UIX-05 commits `58fa595` (Batch 1 Model/charts), `570da3d` (Batch 2 widgets), `6adb322` (Batch 3 alias removal), `0c33370` (Batch 4 tsc + minors), audited against `docs/superpowers/specs/2026-06-13-uix05-closing-phase-design.md` and its plan.
**Design system under test:** "Slate Pro" tokens in `C:\Users\jamie\fplx\src\app\globals.css`; primitives in `C:\Users\jamie\fplx\src\components\ui\`; contrast enforced by `C:\Users\jamie\fplx\scripts\contrast-check.mjs`.

---

## 1. Exit-exam gate results

| # | Gate | Command | Expected | Actual | Verdict |
|---|------|---------|----------|--------|---------|
| 1 | Unit/component tests | `npx vitest run` | 1979 passed / 163 files | `Test Files 163 passed (163)` · `Tests 1979 passed \| 34 skipped (2013)` · exit 0 | PASS |
| 2 | E2E | `npx playwright test --workers=1` (port 3000 freed first) | 63 passed | `63 passed (1.3m)` · exit 0 | PASS |
| 3 | Contrast | `node scripts/contrast-check.mjs` | 30 pairs PASS, exit 0 | 30 lines all `PASS` (16 light + 14 dark) · `EXIT_CODE=0` | PASS |
| 4 | Type check | `npx tsc --noEmit` | exit 0 | `TSC_EXIT_CODE=0` | PASS |
| 5 | Pipeline | `cd pipeline && python -m pytest tests/ -q` | 584 passed | `584 passed in 6.90s` · exit 0 | PASS |
| 6 | Raw-palette grep | `git grep -nE 'zinc-\|gray-' -- src` | only sanctioned pitch lines | 0 sanctioned-pitch matches (`PerfectGWPitch.tsx` is now fully clean); **1 stale test literal** in `AccuracyTab.test.tsx:552` | PASS WITH NOTE |
| 7 | Legacy-alias grep | word-boundary check excl. `-1/-2/-soft/-hover` | zero | zero matches in `src`; globals.css defines none of the legacy vars | PASS |

### Gate 1 — real output
```
 Test Files  163 passed (163)
      Tests  1979 passed | 34 skipped (2013)
VITEST_EXIT=0
```

### Gate 2 — real output
```
  ok 63 [mobile-chromium-430] › e2e\uix-shell.spec.ts:19:11 › shell smoke — mobile › renders season (882ms)
  63 passed (1.3m)
PLAYWRIGHT_EXIT=0
```
(Stale port-3000 listener PID 82632 was killed before the run; executed serially with `--workers=1`.)

### Gate 3 — real output (head + tail)
```
PASS   5.45  (min 4.5)  L ink-muted / surface-0
...
PASS   5.12  (min 4.5)  D chip violet / violet-soft∘surface-1
EXIT_CODE=0
```
30 pairs, all PASS, exit 0.

### Gate 4 — real output
```
TSC_EXIT_CODE=0
```
First fully-clean `tsc --noEmit` in the project, per the overhaul's definition of done.

### Gate 5 — real output
```
584 passed in 6.90s
PYTEST_EXIT=0
```
Pipeline untouched by UIX-05 (the design spec's acceptance line said "583 still green"; current head is 584 — matches the exit-exam target of 584 and confirms no regressions).

### Gate 6 — raw-palette grep (the one note)
```
$ git grep -nE 'zinc-|gray-' -- src
src/components/accuracy/AccuracyTab.test.tsx:552:    const hasTooltipWrapper = /bg-white[^"]*dark:bg-zinc-900/.test(html)
```
- `PerfectGWPitch.tsx` — the sanctioned exception — returns **zero** matches. It is cleaner than the spec anticipated; no pitch exception lines remain.
- The single match is a **stale test-only literal**: a regex inside `AccuracyTab.test.tsx` that probes for an old `bg-white dark:bg-zinc-900` tooltip wrapper signature. The component it tests (`SparklineTooltip`, `AccuracyTab.tsx:923`) was migrated in Batch 1 and now renders `bg-surface-1 border-line text-ink text-ink-muted` — it can no longer emit `dark:bg-zinc-900`. The assertion is an `OR` that short-circuits on the live status label, so the dead branch never fails the suite. This is a no-runtime-impact cleanup item, not a palette leak in shipped UI. Ranked **Minor** below.

### Gate 7 — legacy-alias grep
```
$ git grep -nE '\b(bg-surface|text-foreground|text-muted|border-border|bg-primary|text-primary|bg-surface-elevated|bg-background|bg-secondary|text-secondary)\b' -- src \
    | grep -vE 'bg-surface-[0-9]|bg-surface-soft|bg-surface-hover'
(zero matches)
```
And in `globals.css`:
```
$ git grep -nE '--(surface|surface-elevated|foreground|muted|border|background|color-primary|color-secondary)\b' -- src/app/globals.css
(zero matches)
```
The entire legacy CSS alias layer is gone from `globals.css`; no bare legacy alias survives in `src`. Batch 3 is complete.

---

## 2. Audit dimensions A–E

Method: seeded `localStorage` (`theme=dark`, `pgw-reviewed:GW35..38`), drove a real Chromium via Playwright against a dev server on port 3100, captured screenshots, and probed computed styles + body scroll width. Code read for token purity and a11y semantics.

### A. Charts in dark mode — VERDICT: PASS (the Batch-1 risk is retired)
- `?t=accuracy` in dark theme: the Calibration Reliability chart and the data-health sparkline render with **24 chart elements**, all strokes computed as `color(srgb 0.541 0.576 0.651 / 0.3–0.4)` — i.e. `--color-ink-muted` resolved through `color-mix(...)`. Clearly visible slate grid/lines on the dark surface; no black-on-black, no transparent/invisible series. The dashed "Perfect calibration (y=x)" diagonal and the white "Actual haul rate" line with dots are distinct. Screenshot: `C:\Users\jamie\fplx\.uix05_audit\A-accuracy-dark-1440.png`.
- Recharts colour resolution confirmed from CSS vars, exactly per UIX-04 ruling 5. In `AccuracyTab.tsx`, `BackTab.tsx`, `SeasonReviewTab.tsx` the only chart colours are `var(--color-negative/positive/accent/ink-muted)`, `color-mix(in srgb, var(--color-ink-muted) X%, transparent)`, and `currentColor` — no hex/rgba literals remain.
- `?t=season` in dark theme rendered the legitimate empty state ("Enter your FPL Team ID to see your Season Review") because no team ID was seeded — token-pure card, not a broken/black chart. Screenshot: `C:\Users\jamie\fplx\.uix05_audit\A-season-dark-1440.png`. The regret charts in `BackTab.tsx` use the same `var(--color-*)`/`color-mix` pattern, so the same resolution holds there.

### B. Keyboard / a11y — VERDICT: PASS
- **Global focus ring:** `globals.css:90` — `:focus-visible { outline: 2px solid var(--sp-focus-ring); outline-offset: 1px; }` gives every focusable element a token-driven visible ring; no per-component overrides suppress it.
- **Shell:** Sidebar/MobileBar items are real `<a>`/`<button>` with `transition-colors duration-150`; the brand mark uses `text-display`. Tab order is natural DOM order.
- **Tabs primitive** (`ui/Tabs.tsx`): correct WAI-ARIA tablist — `role=tablist`/`role=tab`, `aria-selected`, roving `tabIndex={active ? 0 : -1}`, and arrow-key handling (ArrowLeft/Right wrap, Home/End jump) that moves focus via `tabRefs.current[next]?.focus()`. Also honours reduced-motion for its `scrollIntoView` behavior.
- **SegmentedToggle** uses `role=group` + `aria-pressed` (distinct from Tabs — correct, see Dimension E).
- **MoreSheet** (`shell/MoreSheet.tsx`, mobile width): `role=dialog` + `aria-modal`, focus moves to the first tool on open, **Escape closes**, focus **returns to the trigger** on unmount, Tab is **trapped** (wraps first↔last focusable), body scroll locked. The drag-handle grabber (`h-1 w-9 rounded-full bg-line`) is the parked-minor affordance. No trap leak or missing focus stop found.

### C. Responsive — VERDICT: PASS
Body scroll width measured at 360 / 430 / 768 / 1440 for Home, Accuracy, and Gems: **zero horizontal overflow** in all 12 cases (`scrollWidth === innerWidth` exactly). The 430px overflow of all 27 tabs is additionally covered by `e2e/mobile-overflow.spec.ts` (in the green gate-2 run). TopBar right-cluster (`shell/TopBar.tsx`: `ml-auto flex items-center gap-2 min-w-0`) does not overflow at 360px — the "Updated …" pill, bell, and theme toggle fit alongside the brand mark (screenshot `C:\Users\jamie\fplx\.uix05_audit\C-home-360.png`). Gem table at 360 fits with its "rotate to landscape" hint and token chips (`C:\Users\jamie\fplx\.uix05_audit\C-gems-360.png`).

### D. Motion — VERDICT: PASS
- All interactive transitions across `src/components/ui` + `src/components/shell` are uniformly `transition-colors duration-150 ease-out` (Button, Tabs, SegmentedToggle, Table TR, Sidebar, MobileBar, MoreSheet items). No stray duration utilities.
- The MoreSheet entrance is the single 250ms motion (`globals.css:89` `sheet-enter` keyframe), matching the 150/250ms token policy.
- `prefers-reduced-motion: reduce` block (`globals.css:91–93`) collapses every animation/transition to `0.01ms !important`; `Tabs.tsx` additionally degrades smooth scroll to `auto` under reduced motion. Honoured.

### E. Batch-1 deviation (AccuracyTab PositionTabSelector) — VERDICT: PASS, sound
`AccuracyTab.tsx:266–302` keeps the position-pill row as a **bespoke token-classed tablist** rather than `SegmentedToggle`. Justification is sound and documented inline: the row needs `role=tablist`/`role=tab`/`aria-selected` semantics that test CAL-02 pins, whereas `SegmentedToggle` deliberately exposes `role=group` + `aria-pressed`. The bespoke control is **token-pure** — `bg-ink`/`text-surface-1` (active), `bg-surface-2`/`text-ink-muted` (inactive), `hover:text-ink`, `min-h-[44px]` touch target — with no raw palette. Keeping it preserves the pinned a11y contract without forking the primitive.

---

## 3. Residual issues (ranked)

No **Critical** issues. (As expected.)

**Important:** none.

**Minor:**
1. **Stale test literal — `AccuracyTab.test.tsx:552`.** The `/bg-white[^"]*dark:bg-zinc-900/` regex probes a tooltip-wrapper signature the migrated `SparklineTooltip` no longer emits. The assertion is an `OR` short-circuited by the live status-label branch, so the suite stays green and there is no shipped-UI palette leak. It is the sole reason gate 6's grep is non-empty. Recommend simplifying the assertion to check only the live status label (drop the dead `hasTooltipWrapper` branch) so the repo-wide raw-palette grep returns truly empty. Non-blocking.
2. **Dead `hover:bg-surface-2` on the inactive PositionTabSelector pill** (`AccuracyTab.tsx:286`): the inactive base bg is already `bg-surface-2`, so the hover bg is a no-op; only `hover:text-ink` is observable. Cosmetic; not a defect.

---

## 4. Overall overhaul (UIX-01 → UIX-05) completeness

All seven exit-exam gates pass (gate 6 with a single documented test-only note that has zero shipped-UI impact). Every audit dimension A–E passes. The "Slate Pro" token system is the sole source of colour across the shell, primitives, tables, widgets, and charts; the legacy CSS alias layer is fully removed; recharts colours resolve from CSS vars and render correctly in dark mode; keyboard a11y (focus ring, roving tablist, modal trap/escape/focus-return) and reduced-motion are in place; no horizontal overflow at any audited width; and `tsc --noEmit` is clean for the first time. Pipeline (584 tests) is unregressed.

The whole UI overhaul is complete. The one Minor residual (a stale test regex) is a cleanup nicety, not a blocker.

---

## VERDICT: OVERHAUL COMPLETE
