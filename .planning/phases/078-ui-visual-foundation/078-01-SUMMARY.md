---
phase: 078-ui-visual-foundation
plan: "01"
subsystem: css-tokens
tags: [tokens, css, tailwind, design-system, visual-foundation]
dependency_graph:
  requires: []
  provides: [bg-surface, text-muted, border-border, bg-surface-elevated, text-foreground, bg-primary, bg-secondary, bg-positive, bg-warning, bg-negative, bg-background]
  affects: [src/app/globals.css]
tech_stack:
  added: []
  patterns: [tailwind-v4-theme-inline, css-custom-properties]
key_files:
  created: []
  modified:
    - src/app/globals.css
decisions:
  - "Placed .tabular-nums, [data-numeric] rule after body rule (before nav-safe-bottom) — placement has no effect on CSS behaviour, kept adjacent to typography rules for readability"
metrics:
  duration: "< 1 minute"
  completed: "2026-05-08T07:08:27Z"
  tasks_completed: 1
  files_changed: 1
---

# Phase 078 Plan 01: CSS Token Foundation Summary

**One-liner:** Complete CSS custom property token set (11 tokens each in :root/.dark, 13-entry @theme inline) enabling first-class Tailwind utility classes bg-surface, text-muted, border-border; Geist Sans activated by removing Arial override; tabular-nums rule added.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace token set in globals.css and remove Arial | e9de7f0 | src/app/globals.css |

## What Was Built

`src/app/globals.css` now contains:

**:root block (11 properties):**
- `--background: #F7F8FC` (light page background, softened from #ffffff)
- `--surface: #ffffff` (card/nav background)
- `--surface-elevated: #f3f4f6` (raised card surfaces)
- `--foreground: #171717` (primary text)
- `--muted: #6b7280` (supporting/secondary text)
- `--border: #e5e7eb` (card borders, nav dividers)
- `--color-primary: #22c55e` (green accent)
- `--color-secondary: #3b82f6` (blue accent)
- `--color-positive: #22c55e`
- `--color-warning: #f59e0b`
- `--color-negative: #ef4444`

**`.dark` block (11 properties):**
- `--background: #0a0a0a` (dark page background)
- `--surface: #111827` (dark card/nav)
- `--surface-elevated: #1f2937`
- Foreground, muted, border, accent tokens at appropriate dark values

**`@theme inline` (13 entries):**
All 11 color tokens wired as `--color-{name}: var(--{name})` plus `--font-sans` and `--font-mono`.

**Body rule:** `font-family: Arial, Helvetica, sans-serif` removed. Geist Sans now active via `--font-sans` → `--font-geist-sans` mapping.

**New rule:** `.tabular-nums, [data-numeric] { font-variant-numeric: tabular-nums; }`

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All automated checks passed:
- `grep -c '--surface: #ffffff' src/app/globals.css` → 1
- `grep -c '--surface: #111827' src/app/globals.css` → 1
- `grep -c '--color-surface: var(--surface)' src/app/globals.css` → 1
- `grep -c 'Arial' src/app/globals.css` → 0
- `grep -c 'font-variant-numeric: tabular-nums' src/app/globals.css` → 1
- All 11 new semantic token properties present in both :root and .dark

## Known Stubs

None. This plan is a pure CSS globals change with no data rendering or UI components.

## Threat Flags

No new security surface introduced. Color tokens are static strings in a CSS file.

## Self-Check: PASSED

- [x] `src/app/globals.css` exists and contains all required tokens
- [x] Commit e9de7f0 exists: `feat(078-01): establish full CSS token set in globals.css`
- [x] Arial not present in globals.css
- [x] All 13 @theme inline entries present
- [x] tabular-nums rule present
