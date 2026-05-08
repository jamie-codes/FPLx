# Phase 78: UI Visual Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 78-UI-Visual-Foundation
**Areas discussed:** Token system integration, Pill nav scope & active state, Sticky nav extent, Freshness badge placement & shape

---

## Token system integration

| Option | Description | Selected |
|--------|-------------|----------|
| Extend @theme (Recommended) | Add tokens to @theme inline so they become Tailwind utility classes (bg-surface, text-muted, border-border). Consistent with existing font-geist-sans wiring. | ✓ |
| CSS vars only | Keep tokens in :root/.dark; components use bg-[var(--surface)] arbitrary values. No @theme changes. | |

**User's choice:** Extend @theme (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Core layout + card shells only (Recommended) | Replace hardcoded hex in page.tsx, MobileNav, globals.css only. Tab content components migrate in a follow-on phase. | ✓ |
| All components in src/ | Full token sweep across the entire codebase in one phase. | |

**User's choice:** Core layout + card shells only

| Option | Description | Selected |
|--------|-------------|----------|
| Green primary, amber warning, red negative (Recommended) | Primary: #22c55e, secondary: #3b82f6, warning: #f59e0b, negative: #ef4444. Matches existing gem/signal colours. | ✓ |
| Blue primary (analytics feel) | Primary: #3b82f6, secondary: #8b5cf6. Leans more analytics/dashboard. | |
| You decide | Claude picks accent tokens. | |

**User's choice:** Green primary, amber warning, red negative

---

## Pill nav scope & active state

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pills on desktop too (Recommended) | Both section tabs AND sub-tabs become rounded-full filled pills on desktop. Removes underline pattern entirely. | ✓ |
| Sub-tabs pills, section tabs keep styling | Section tabs get larger/bordered pill; sub-tabs get smaller filled pill. | |

**User's choice:** Yes — pills on desktop too

| Option | Description | Selected |
|--------|-------------|----------|
| Solid fill (Recommended) | bg-zinc-900 text-white / dark:bg-white dark:text-zinc-900. Matches existing MobileNav active pill. | ✓ |
| Outlined ring | ring-2 ring-zinc-900 rounded-full active state. | |
| You decide | Claude picks. | |

**User's choice:** Solid fill

| Option | Description | Selected |
|--------|-------------|----------|
| Update mobile to match new tokens (Recommended) | Update MobileNav pills to use semantic token classes. Small diff. | ✓ |
| Leave mobile as-is | Don't touch MobileNav in Phase 78. | |

**User's choice:** Update mobile to match new tokens

---

## Sticky nav extent

| Option | Description | Selected |
|--------|-------------|----------|
| Section tabs + sub-tabs only (Recommended) | Only the two nav rows stick. FPLx header scrolls away. Saves vertical space. | ✓ |
| Full header + nav rows all stick | Entire top bar sticks as a compact unit. Always-visible freshness badge but taller sticky zone. | |

**User's choice:** Section tabs + sub-tabs only

| Option | Description | Selected |
|--------|-------------|----------|
| bg-surface with border-bottom (Recommended) | sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-border. Frosted glass. | ✓ |
| Solid background only | bg-surface border-b border-border, no blur. | |
| You decide | Claude picks. | |

**User's choice:** bg-surface with border-bottom (frosted glass)

---

## Freshness badge placement & shape

| Option | Description | Selected |
|--------|-------------|----------|
| Move to sticky nav row (Recommended) | Place badge in sticky section-tabs row (right side). Always visible. | ✓ |
| Keep in header, enhance styling | Style existing header position as pill badge. | |
| Duplicate: header + sticky nav | Show badge in both places. | |

**User's choice:** Move to sticky nav row

| Option | Description | Selected |
|--------|-------------|----------|
| Pill badge with dot indicator (Recommended) | Rounded pill + ● dot + relative time text. Normal: muted. Stale: amber bg + amber text. | ✓ |
| Text only (no pill) | Styled text with dot prefix, no background. | |
| You decide | Claude picks badge style. | |

**User's choice:** Pill badge with dot indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor in place (Recommended) | Update LastUpdated.tsx render output; keep useLastUpdated hook and stale logic. | ✓ |
| Keep current, add new FreshnessBadge | New FreshnessBadge.tsx wrapping useLastUpdated; leave LastUpdated for backward compat. | |

**User's choice:** Refactor in place

---

## Claude's Discretion

- Exact semantic token names for the full set (surface, surface-elevated, border, muted, etc.)
- Whether to use bg-surface/95 opacity shorthand or a separate --surface-sticky token
- Exact padding/gap values for pill nav rows
- Whether tabular-nums is a global CSS rule or per-component utility
- ThemeToggle placement: stays in scrolling header or moves to sticky nav

## Deferred Ideas

None — discussion stayed within phase scope.
