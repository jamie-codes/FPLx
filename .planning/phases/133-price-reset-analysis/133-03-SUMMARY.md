---
phase: 133
plan: "03"
subsystem: ui
tags:
  - react
  - tab
  - price-reset
  - tdd
dependency_graph:
  requires:
    - 133-02  # usePriceReset hook, PriceResetRow/ValueTargetRow/PriceResetResponse types
  provides:
    - PriceResetTab component
    - price-reset sub-tab registered in Analyse section
  affects:
    - src/app/page.tsx
tech_stack:
  added: []
  patterns:
    - TDD Red/Green with Vitest + RTL
    - Client component with usePriceReset TanStack Query hook
    - Delta pill colour convention (green rise, red fall) matching PriceChangePanel
key_files:
  created:
    - src/components/price-reset/PriceResetTab.tsx
    - src/components/price-reset/PriceResetTab.test.tsx
  modified:
    - src/app/page.tsx
decisions:
  - Used template literal for ValueTargetRow metadata to produce single text node, enabling reliable RTL text assertions
  - Unicode minus U+2212 declared as top-level MINUS constant, used in formatDeltaPounds
  - Component renders API order (no client-side sort) — Plan 02 guarantees sort

requirements-completed:
  - PRST-02
  - PRST-03
  - PRST-04

metrics:
  duration: "~4 minutes"
  completed: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 133 Plan 03: PriceResetTab UI Component Summary

PriceResetTab client component with loading/error/empty/populated states, delta pills using Unicode minus for falls and colour-coded bg classes, ValueTargetRow with `#N POS` rank label, and three-location page.tsx registration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing vitest+RTL contract (RED) | 6a4f9fb | src/components/price-reset/PriceResetTab.test.tsx |
| 2 | Implement PriceResetTab + page.tsx edits (GREEN) | a50523a | src/components/price-reset/PriceResetTab.tsx, src/app/page.tsx |
| 3 | Manual UI verification of Price Reset tab states | approved | human-verify checkpoint |

## Task 3: Human Verification — APPROVED

User approved all six verification steps confirming:

- Price Reset tab is correctly positioned: Window → Price Reset → Price Changes.
- The verbatim D-09 empty-state copy renders when prices are not yet published.
- Rise pill is green with ASCII `+` prefix; fall pill is red with Unicode minus `−` (U+2212).
- `#N POS` rank format appears on Value Target rows.
- No console errors reported.

## Component Details

**File:** `src/components/price-reset/PriceResetTab.tsx`
**Export:** `export function PriceResetTab()`
**First line:** `'use client'`

### State branches

| State | Trigger | Output |
|-------|---------|--------|
| Loading | `isLoading === true` | `<p>Loading price reset data…</p>` |
| Error | `error !== null` | `<p>Failed to load price reset data. Check the pipeline output and refresh.</p>` |
| Empty | `!data || !data.published` | Heading `Prices not yet published` + D-09 body |
| Populated | `data.published === true` | Price Reset section + optional Value Targets section |

### Unicode minus

The file contains the literal Unicode minus character U+2212 (`−`) at line 10:
```
const MINUS = '−'
```
Confirmed via `grep -n "−" src/components/price-reset/PriceResetTab.tsx` → line 10 match.

## Test Results

**6/6 passing** — `npx vitest run src/components/price-reset/PriceResetTab.test.tsx`

| Test | Description |
|------|-------------|
| `renders_loading_state_while_fetching` | Asserts loading text verbatim |
| `renders_error_state_on_fetch_failure` | Asserts error text verbatim |
| `renders_empty_state_when_published_false` | Asserts D-09 copy + no Price Reset/Value Targets headings |
| `renders_price_reset_section_with_rise_and_fall_pills` | Asserts bg-green-100 rise, bg-red-100 fall, Unicode minus, aria-label |
| `renders_value_target_row_with_rank_label` | Asserts `LIV · £12.0m · #3 MID` metadata, aria-label |
| `value_targets_section_omitted_when_array_empty` | Asserts no Value Targets heading when array empty |

## page.tsx Edits

Three-location update verified by `grep -c "'price-reset'" src/app/page.tsx` → 3 matches.

| Location | Line | Change |
|----------|------|--------|
| Import | 30 | `import { PriceResetTab } from '@/components/price-reset/PriceResetTab'` |
| SubTab union | 63 | `'price-reset'` inserted before `'price-changes'` |
| subTabs array | 78 | `{ id: 'price-reset', label: 'Price Reset', mobileLabel: 'Resets' }` between window (77) and price-changes (79) |
| Conditional render | 301 | `{activeSection !== 'squad' && activeSubTab === 'price-reset' && <PriceResetTab />}` between window (300) and price-changes (302) |

Tab ordering confirmed: window (line 77) → price-reset (line 78) → price-changes (line 79).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed metadata text-node splitting in ValueTargetRowView**

- **Found during:** Task 2 (GREEN phase, first test run)
- **Issue:** JSX interpolation `{row.team} · £{...}m · #{row.position_rank} {row.position_label}` produces multiple React text nodes. `screen.getByText('#3 MID')` and `screen.getByText(/LIV · £12.0m · #3 MID/)` failed because RTL matches against individual element text content, not assembled concatenation.
- **Fix:** Changed ValueTargetRowView metadata to a template literal `const metadata = \`...\`` assigned as a single text node `{metadata}`. Updated test assertions to use regex patterns matching the full metadata string.
- **Files modified:** PriceResetTab.tsx, PriceResetTab.test.tsx
- **Commit:** a50523a

## TypeScript / ESLint

- No new TS errors in price-reset files or page.tsx (`npx tsc --noEmit 2>&1 | grep "price-reset"` → empty)
- No ESLint errors in new files (`npx eslint src/components/price-reset/` → exit 0)
- Pre-existing ESLint error in page.tsx line 136 (`react-hooks/set-state-in-effect`) is out of scope — existed before this plan

## Known Stubs

None — all rendered data flows from the `usePriceReset` hook. No hardcoded placeholder values.

## Threat Flags

No new network endpoints, auth paths, or trust boundary changes introduced. PriceResetTab is a read-only consumer of the existing `/api/price-reset` endpoint delivered in Plan 02.

## Self-Check: PASSED

- [x] `src/components/price-reset/PriceResetTab.tsx` exists
- [x] `src/components/price-reset/PriceResetTab.test.tsx` exists
- [x] Commit 6a4f9fb exists (test RED phase)
- [x] Commit a50523a exists (feat GREEN phase)
- [x] `'price-reset'` appears 3 times in src/app/page.tsx
- [x] Unicode minus U+2212 present in PriceResetTab.tsx line 10
- [x] 6/6 tests passing
