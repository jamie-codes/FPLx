---
phase: 36-navigation-consolidation
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/app/page.tsx
  - src/components/nav/MobileNav.tsx
  - src/app/page.test.tsx
  - src/components/nav/MobileNav.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-04-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 36 replaces the flat 8-tab model with a 3-section hierarchy (Analyse / Plan / Squad) backed by per-section sub-tab memory. The architecture is sound and the happy-path wiring is correct. However, there is one correctness bug (ghost content rendered while Squad is active), two logic gaps around the non-exhaustive `SubTab` type and the unsafe non-null assertion, and one important test gap around the Squad content-exclusivity invariant.

---

## Critical Issues

### CR-01: Ghost sub-tab content renders simultaneously with Squad content

**File:** `src/app/page.tsx:119-136`

**Issue:** Content panels are gated solely on `activeSubTab`, not on `activeSection`. When `activeSection === 'squad'`, `activeSubTab` still holds the last remembered value for the section that was active before navigating to Squad (e.g. `'gems'`). Because the sub-tab conditionals on lines 120-136 check `activeSubTab` without first verifying `activeSection !== 'squad'`, the `GemTable`, `CaptainPicksPanel`, or whichever panel was last active will be rendered in the DOM at the same time as `TransferPanel`.

Concrete trace:
1. Start: `activeSection='analyse'`, `activeSubTab='gems'` — GemTable renders.
2. Click Squad: `activeSection='squad'`, `activeSubTab` remains `'gems'` (per D-05 memory).
3. Lines 119 and 120-125 both evaluate true → `TransferPanel` **and** `GemTable` + `CaptainPicksPanel` are all mounted simultaneously.

**Fix:** Guard the sub-tab content block so it only renders when `activeSection !== 'squad'`:

```tsx
{activeSection !== 'squad' && (
  <>
    {activeSubTab === 'gems' && (
      <>
        <GemTable />
        <CaptainPicksPanel />
      </>
    )}
    {activeSubTab === 'defcon' && <DefConTables />}
    {activeSubTab === 'club-form' && (
      <>
        <FixtureEaseRankingPanel />
        <ClubFormTable />
      </>
    )}
    {activeSubTab === 'set-pieces' && <SetPieceTakerPanel />}
    {activeSubTab === 'insights' && <InsightsTab />}
    {activeSubTab === 'value-gems' && <ValueGemsTable />}
    {activeSubTab === 'planner' && <PlannerTab />}
  </>
)}
```

---

## Warnings

### WR-01: Non-null assertion on `SECTIONS.find()` is unsafe and will throw if `activeSection` drifts

**File:** `src/app/page.tsx:98` and `src/components/nav/MobileNav.tsx:19`

**Issue:** Both files use `SECTIONS.find(s => s.id === activeSection)!`. The `Section` type and `SECTIONS` array are currently in sync, so this is benign today. However, `activeSection` is typed `Section`, and `SECTIONS` is a `const` array. If a value is ever added to the `Section` union without a matching entry in `SECTIONS` (or vice-versa), the assertion will dereference `undefined` and crash at runtime. The `!` operator also defeats TypeScript's ability to surface this inconsistency at compile time.

**Fix:** Replace with a guarded lookup and throw a descriptive error in the impossible branch, or refactor to use `SECTIONS` as the single source of truth for the union (derive `Section` from `typeof SECTIONS[number]['id']`):

```tsx
// Option A — derive the type, eliminating the divergence entirely
export type Section = typeof SECTIONS[number]['id']

// Option B — safe lookup with invariant guard
const activeSectionDef = SECTIONS.find(s => s.id === activeSection)
if (!activeSectionDef) throw new Error(`Unknown section: ${activeSection}`)
```

---

### WR-02: `SubTab` union is wider than the set of sub-tabs actually registered in `SECTIONS` — no compile-time completeness check

**File:** `src/app/page.tsx:19`

**Issue:** `SubTab` is declared as a hand-written string union (`'gems' | 'insights' | 'defcon' | 'set-pieces' | 'planner' | 'club-form' | 'value-gems'`). The content-switch on lines 120-136 uses the same identifiers. These two lists are maintained manually. There is no compile-time guarantee that every `SubTab` value has a matching content branch, or that every content branch maps to a `SubTab` that belongs to an actual section in `SECTIONS`. Adding a new tab requires updating three separate places; omitting any one silently produces either a dead button or an unreachable content block.

**Fix:** Derive `SubTab` from `SECTIONS` so it cannot diverge:

```ts
// Derives SubTab from SECTIONS at compile time — no manual union to maintain
export type SubTab = typeof SECTIONS[number]['subTabs'][number]['id']
```

---

### WR-03: The test suite does not assert that Squad section renders no sub-tab content panels

**File:** `src/app/page.test.tsx` (no single line — entire file)

**Issue:** `page.test.tsx` tests D-05 sub-tab memory and D-06 default landing, but it does not contain a test case verifying that navigating to Squad hides all sub-tab content (GemTable, InsightsTab, etc.). Given that CR-01 above is a real bug — sub-tab panels are rendered concurrently with TransferPanel when Squad is active — the test suite gives a false green on this invariant. After CR-01 is fixed, the missing test is needed to prevent regression.

**Fix:** Add a test case to `page.test.tsx`:

```tsx
it('Squad section renders TransferPanel only — no sub-tab content panels', () => {
  const { container } = render(<Home />)
  // Default is Analyse/gems — GemTable is visible
  expect(container.querySelector('[data-testid="gem-table"]')).not.toBeNull()
  // Navigate to Squad
  const squadBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Squad')
  fireEvent.click(squadBtn!)
  expect(container.querySelector('[data-testid="transfer-panel"]')).not.toBeNull()
  // Sub-tab content must be absent
  expect(container.querySelector('[data-testid="gem-table"]')).toBeNull()
  expect(container.querySelector('[data-testid="captain-picks"]')).toBeNull()
  expect(container.querySelector('[data-testid="insights"]')).toBeNull()
  expect(container.querySelector('[data-testid="planner"]')).toBeNull()
})
```

---

## Info

### IN-01: Circular-import coupling — component imports types from the page module

**File:** `src/components/nav/MobileNav.tsx:3`

**Issue:** `MobileNav` imports `SECTIONS`, `Section`, and `SubTab` directly from `@/app/page`. This creates a coupling from a reusable component into the application entry point. While Next.js handles this without a circular-import error today (MobileNav is consumed by page, not the other way around), it makes the component impossible to reuse outside of `page.tsx` and complicates any future extraction. It also means a change to `page.tsx`'s module boundary could introduce a true circular dependency if page ever ends up importing anything MobileNav re-exports.

**Fix:** Extract `Section`, `SubTab`, and `SECTIONS` into a shared module such as `src/lib/nav-config.ts` and import from there in both `page.tsx` and `MobileNav.tsx`.

---

### IN-02: IIFE pattern in JSX is unconventional and adds cognitive overhead

**File:** `src/app/page.tsx:97-113` and `src/components/nav/MobileNav.tsx:18-34`

**Issue:** The immediately-invoked function expression `{activeSection !== 'squad' && (() => { ... })()}` is used in both files to compute `activeSectionDef` inside JSX. This is valid JavaScript but is an unusual pattern in React codebases; the idiomatic equivalent is to compute `activeSectionDef` before the `return` statement and conditionally render it. The IIFE pattern makes the render tree harder to read and will confuse contributors unfamiliar with it.

**Fix:** Move the lookup above the `return`:

```tsx
const activeSectionDef = activeSection !== 'squad'
  ? SECTIONS.find(s => s.id === activeSection) ?? null
  : null

// Then in JSX:
{activeSectionDef && (
  <nav aria-label={`${activeSectionDef.label} sub-tabs`} ...>
    ...
  </nav>
)}
```

---

_Reviewed: 2026-04-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
