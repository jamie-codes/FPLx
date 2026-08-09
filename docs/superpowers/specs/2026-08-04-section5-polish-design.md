# §5 Visual Polish — Logo Badge · Mobile-Tab Fill · Deadline Card · ChartTheme — Design

**Date:** 2026-08-04
**Status:** Approved (design), pending implementation plan
**Part of:** the Matchday Fintech redesign (`handoff/HANDOFF.md` §5, tokens §1–§2, mockups
`cockpit-dark-2a.png` / `cockpit-mobile-dark-2a.png`).

## Problem

Four remaining polish items from the redesign handoff, none data-blocked:

1. **Logo** — currently a bare `FPLx` wordmark in the decorative `--font-honk`, duplicated in
   `Sidebar` (top) and `TopBar` (mobile). The mock shows a volt rounded-square **"Fx"** badge +
   a plain-sans **"FPLx"**.
2. **Mobile tabs** — the active tab is only `text-accent`, which in light mode is volt-as-text
   and fails contrast. The mock shows a **volt fill** behind the active tab.
3. **Deadline** — no sidebar countdown card exists. The mock pins a card at the sidebar bottom
   (`GW1 deadline` / `21d 23:33:07`, volt mono) and shows a mobile GW+countdown pill top-right.
4. **Charts** — the 4 Recharts tabs already read CSS vars inline but each repeats the same
   grid/axis/tick literals; the audit item is to route them through one shared ChartTheme.

This is a **restyle + DRY pass, not a rebuild**: no engine, data, or tab-shell changes. The
keep-all-features (UIX-01) contract holds — every existing element and behaviour survives.

## Key constraint (token separation)

`--sp-accent` is theme-adaptive: volt `#c8f542` in dark, pitch-green `#3f6d1d` in light, with
`--sp-on-accent` = dark ink in dark but **white** in light. HANDOFF §1 states the logo mark and
mobile tab are **volt fill + dark ink in *both* themes** (volt fails as text on white, so it is
fill-only). Therefore `bg-accent`/`text-on-accent` is wrong for these — it yields pitch-green +
white in light. They need a dedicated always-volt fill pair, separate from the semantic accent.

The desktop sidebar active nav pill (already shipped in Phase 1 as `bg-accent-soft text-accent
border-accent`, accessible in both themes) is **out of scope** — this pass does not re-open it.

## Design

Five isolated units. Each has one responsibility and is independently testable.

### 1. Tokens (`src/app/globals.css`)

Add to both theme blocks (light `:root`, dark `.dark`) and the `@theme inline` map:

- `--sp-volt: #c8f542` and `--sp-on-volt: #0c0e0d` — **identical in both themes** (fill-only volt
  + dark ink). Map to `--color-volt` / `--color-on-volt` → utilities `bg-volt` / `text-on-volt`.
- `--sp-deadline-bg` — dark `#12150f`, light `#eef4e6`. Map to `--color-deadline-bg` → `bg-deadline-bg`.
- `--sp-deadline-border` — dark `#2b331f`, light `#e2e7de`. Map to `--color-deadline-border` → `border-deadline-border`.

Deadline-card *text* uses the existing `text-accent` (volt in dark, pitch-green in light — both
pass 4.5:1 on their card bg). No new text token needed.

Contrast: on-volt `#0c0e0d` on volt `#c8f542` is ~16:1 (near-black on bright volt), far above 4.5.
Note `scripts/contrast-check.mjs` is a stale throwaway — it hardcodes the pre-redesign Slate-Pro
blue primitives, not the current tokens — so it is **not** the gate here; verify the pair with a
direct WCAG computation instead (the plan includes a self-contained one-liner).

### 2. `Brand` component (`src/components/shell/Brand.tsx`, new)

A single shared brand lockup used at both mount points:

```
[Fx]  FPLx
```

- Badge: `bg-volt text-on-volt` rounded square, `font-bold`, letters "Fx".
- Wordmark: "FPLx" in Inter semibold (`font-semibold text-ink`) — retires `--font-honk` on the
  logo (the font itself stays defined; only these two usages drop it).
- Replaces the honk `<span>` in `Sidebar.tsx` (lines 15–17) and `TopBar.tsx` (lines 8–10).
- Props: `{ className?: string }` only — one size; the two sites style spacing via wrapper.

### 3. Mobile active-tab fill (`src/components/shell/MobileBar.tsx`, modify)

Keep the current 5-item icon-over-label structure. Change only the active treatment:

- Active group item: wrap the icon in a `bg-volt text-on-volt rounded-lg` pill (small padding);
  label below in `text-ink`.
- Inactive item: unchanged — `text-ink-muted`, no pill.
- "More" button: same volt-pill treatment when `moreActive` (a sheet-group is active).

This is a pure recolour of the active state; no structural, routing, or a11y change
(`aria-current` / `aria-haspopup` semantics preserved).

### 4. Deadline countdown (shared)

**4a. `formatDeadlineCountdown(ms: number, showSeconds: boolean): string`** — pure, new file
`src/lib/deadline-format.ts`. Leaves `DeadlineBanner`'s existing `formatCountdown` (minute-only)
untouched.

- `ms >= 1 day`: `"{d}d {hh}:{mm}:{ss}"` when `showSeconds`, else `"{d}d {hh}:{mm}"`.
- `ms < 1 day`: `"{hh}:{mm}:{ss}"` when `showSeconds`, else `"{hh}:{mm}"`.
- `hh`/`mm`/`ss` zero-padded to 2 digits; days not padded.
- `ms <= 0` → floored to 0; since 0 is sub-day the day part is dropped → `"00:00:00"` / `"00:00"`
  (components render-gate on `ms > 0`, so this defensive floor is never actually shown).

**4b. `useDeadlineCountdown(): { id: number; ms: number } | null`** — hook, new file
`src/lib/hooks/useDeadlineCountdown.ts`.

- Wraps `useNextDeadline()`; parses `deadline_time` to ms-from-now.
- `setInterval` tick every 1000ms; cleared on unmount / `deadline_time` change.
- Returns `null` when data is missing, `deadline_time` unparseable, or `id` null.

**4c. `SidebarDeadlineCard` (`src/components/shell/SidebarDeadlineCard.tsx`, new)**

- Pinned at the sidebar bottom as a `shrink-0` block after `</nav>`, with padding matching the
  sidebar gutter.
- `bg-deadline-bg border border-deadline-border rounded-lg` card:
  - label `"GW{id} deadline"` — `text-data text-ink-muted`.
  - countdown — `text-accent font-mono tabular` (h4-ish), `formatDeadlineCountdown(ms, true)`.
- Returns `null` when `useDeadlineCountdown()` is null or `ms <= 0`.
- Mounted inside `Sidebar.tsx` (the `<aside>` is already `hidden lg:flex`, so it is desktop-only
  by construction).

**4d. `MobileDeadlinePill` (`src/components/shell/MobileDeadlinePill.tsx`, new)**

- `lg:hidden` pill: `border border-accent text-accent rounded-full px-2 py-0.5 text-data
  font-mono tabular` → `"GW{id} · " + formatDeadlineCountdown(ms, false)`.
- Returns `null` when `useDeadlineCountdown()` is null or `ms <= 0`.
- Mounted in the top-bar right cluster (the `TopBar` children slot owned by `page.tsx`), before
  the existing chrome (`DeadlineBanner`/`LastUpdated`/bell/theme). Coexists with the existing
  `DeadlineBanner` (a separate dismissible urgency banner); the pill is the always-on GW clock.

### 5. ChartTheme (`src/lib/chart-theme.ts`, new)

Extract the repeated Recharts literals into shared constants read once, referenced by all 4 tabs:

- `CHART_GRID_STROKE` = `'color-mix(in srgb, var(--color-ink-muted) 30%, transparent)'`
- `CHART_GRID_DASH` = `'3 3'`
- `CHART_AXIS_STROKE` = `'color-mix(in srgb, var(--color-ink-muted) 50%, transparent)'`
- `CHART_TICK_FILL` = `'var(--color-ink-muted)'`
- `CHART_REF_STROKE` = `'color-mix(in srgb, var(--color-ink-muted) 40%, transparent)'`

(Exact strings to be reconciled against each tab's current literals during implementation — the
constant's value is whatever the tabs already use; where a tab differs, the shared value is the
common one and any intentional divergence stays inline with a comment.)

Refactor `AccuracyTab`, `SeasonReviewTab`, `BackTab`, `RankSimTab` to import these for their
`CartesianGrid` / `XAxis` / `YAxis` / `ReferenceLine` styling. Series/domain-specific colours
(e.g. haul-bar green, per-series strokes) stay in the tabs — only the chrome literals move.

This is behaviour-preserving. The tabs' existing render tests are the regression guard; a
constant-equality unit test would be tautological and is intentionally omitted.

## Testing

- **`deadline-format.test.ts`** — boundaries: multi-day with/without seconds, exactly 24h, sub-day
  (day part dropped), single-digit h/m/s zero-padding, `ms = 0` and negative flooring, seconds
  toggle.
- **`useDeadlineCountdown.test.ts`** — fake timers: returns null on missing/invalid data; returns
  `{id, ms}`; ms decreases on tick; interval cleared on unmount.
- **`Brand.test.tsx`** — renders "Fx" and "FPLx"; badge carries `bg-volt`/`text-on-volt`.
- **`SidebarDeadlineCard.test.tsx`** — renders label + formatted countdown when a deadline exists;
  renders nothing when the hook returns null.
- **`MobileDeadlinePill.test.tsx`** — renders `GW{id} · {countdown}`; nothing when null.
- **Existing suites stay green:** `shell.test.tsx` (Sidebar/MobileBar/TopBar), and the 4 chart
  tabs' tests (`AccuracyTab`, `SeasonReviewTab`, `RankSimTab`; add a render smoke for `BackTab`
  only if it has none). `npx tsc --noEmit` = 0 errors.

## Files

- **Modify:** `src/app/globals.css`, `src/components/shell/Sidebar.tsx`,
  `src/components/shell/TopBar.tsx`, `src/components/shell/MobileBar.tsx`, `src/app/page.tsx`
  (mount `MobileDeadlinePill`), and the 4 chart tabs.
- **Create:** `src/components/shell/Brand.tsx` (+ test),
  `src/components/shell/SidebarDeadlineCard.tsx` (+ test),
  `src/components/shell/MobileDeadlinePill.tsx` (+ test),
  `src/lib/deadline-format.ts` (+ test), `src/lib/hooks/useDeadlineCountdown.ts` (+ test),
  `src/lib/chart-theme.ts`.

## Out of scope

- The desktop sidebar active nav pill (already shipped, accessible — not re-opened).
- Chip-timeline bars (data-blocked; separate pipeline task).
- Any font-package swap (Geist Mono stays; IBM Plex Mono deferred per HANDOFF's "reads fine either
  way").
- Any change to `DeadlineBanner` or its dismiss logic.
