---
phase: 77
plan: 02
subsystem: e2e
tags: [playwright, e2e, mobile, viewport, overflow-audit, pol-03]
dependency_graph:
  requires: [077-01]
  provides: [mobile-overflow-e2e-suite, playwright-config]
  affects: [package.json, playwright.config.ts, e2e/mobile-overflow.spec.ts, .gitignore]
tech_stack:
  added: ["@playwright/test 1.59.1", "Chromium 147.0.7727.15 (headless-shell v1217)"]
  patterns: [playwright-webserver-autospawn, mobile-viewport-overflow-assertion]
key_files:
  created:
    - playwright.config.ts
    - e2e/mobile-overflow.spec.ts
  modified:
    - package.json
    - package-lock.json
    - .gitignore
decisions:
  - "Navigation at 430px uses MobileNav (sm:hidden desktop nav is invisible at mobile viewport)"
  - "Sub-tab pill buttons use mobileLabel values from SECTIONS constant: SP, Acc, Values, Insights, Rivals, Lineup"
  - "Settle markers chosen to be stable in both empty-state and data-loaded renders"
  - "Squad tab tested as Lineup sub-tab (data-testid=lineup-tab) in empty state — no team ID submitted"
  - "AccuracyTab settled via calibration-chart or gw-row-* testids (data arrives from API)"
  - "All 7 assertions pass at 430x900 post-Plan-01 baseline"
metrics:
  duration: ~10 minutes
  completed: "2026-05-07"
  tasks: 2
  files: 5
---

# Phase 77 Plan 02: Mobile Overflow Playwright Audit (POL-03) Summary

**One-liner:** Playwright 1.59.1 e2e suite with 7 viewport assertions at 430x900 locking in the mobile-clean baseline from Plan 01; all 7 tabs pass `document.body.scrollWidth <= window.innerWidth`.

## What Was Built

### Task 1: Playwright Installation + Configuration

**@playwright/test 1.59.1** installed as devDependency (npm installed 1.59.1 — exceeds the plan's ^1.49.0 floor).

Chromium browser binary: `Chrome Headless Shell 147.0.7727.15 (playwright chromium-headless-shell v1217)` downloaded to `%AppData%\Local\ms-playwright\chromium_headless_shell-1217`.

**playwright.config.ts** created at repo root:
- `testDir: './e2e'`
- `viewport: { width: 430, height: 900 }` (both global `use` and `mobile-chromium-430` project)
- `baseURL: 'http://localhost:3000'`
- `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 120_000 }`
- Single Chromium project `mobile-chromium-430`
- `reporter: [['list']]` — compact terminal output

**package.json** updated: `"test:e2e": "playwright test"` added after existing `test` script.

**.gitignore** updated with Playwright artefact patterns:
```
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
```

### Task 2: 7-Tab Mobile Overflow Spec

**e2e/mobile-overflow.spec.ts** — 126 lines, one `test.describe('POL-03 — 430px mobile overflow audit')` block with 7 test cases.

#### Navigation Discovery

The app uses a 3-section hierarchy (`analyse | plan | squad`) with sub-tabs. At 430px viewport the desktop nav (`hidden sm:flex`) is invisible; the `MobileNav` component (`sm:hidden`) is active. Navigation requires clicking:
1. A bottom section bar button ("Analyse", "Plan", or "Squad")
2. A sub-tab pill button using the `mobileLabel` value from the `SECTIONS` constant

#### Tab Inventory

| Tab Name | Section | Sub-tab mobileLabel | Navigate selector | Settle selector | State |
|----------|---------|---------------------|-------------------|-----------------|-------|
| Insights | analyse | Insights | button[name="Analyse"] + button[name="Insights"] | `section[aria-label="Season pattern insights"]` or `section[aria-label="Insights not available"]` | Empty state (no cache) |
| Plan | plan | (default: Planner) | button[name="Plan"] | `[data-testid="chip-strategy-panel"]` | Empty state — ChipStrategyPanel always renders |
| Squad | squad | Lineup | button[name="Squad"] + button[name="Lineup"] | `[data-testid="lineup-tab"]` | Empty state — no team ID submitted |
| Set Pieces | analyse | SP | button[name="Analyse"] + button[name="SP"] | `heading[name="Set-Piece Takers"]` | Data-loaded (from API cache) |
| Accuracy | analyse | Acc | button[name="Analyse"] + button[name="Acc"] | `[data-testid="calibration-chart"]` or `[data-testid^="gw-row-"]` | Data-loaded (from API cache) |
| Rivals | plan | Rivals | button[name="Plan"] + button[name="Rivals"] | `heading[name="Track your mini-league rivals"]` | Empty state — no league ID |
| Value Gems | plan | Values | button[name="Plan"] + button[name="Values"] | `heading[name="Value Gems"]` | Data-loaded (from API cache) |

#### Assertion Pattern

Each test runs the same overflow assertion (inverted for a meaningful failure message):

```typescript
const overflow = await page.evaluate(() => ({
  scrollWidth: document.body.scrollWidth,
  innerWidth: window.innerWidth,
}))
expect(overflow.scrollWidth, `${tab.name} tab: body.scrollWidth (${overflow.scrollWidth}px) > ...`).toBeLessThanOrEqual(overflow.innerWidth)
```

#### Selector Adaptations vs Skeleton

| Tab | Plan skeleton | Actual selector used | Reason |
|-----|---------------|---------------------|--------|
| Plan | `getByRole('tab', { name: /^Plan$/ })` | `getByRole('button', { name: 'Plan', exact: true })` | No role=tab elements — buttons in MobileNav are plain `<button>` |
| Squad | `getByTestId('lineup-tab')` | Same, but navigate to section=squad + subTab=Lineup first | Correct testid, but navigation required section + sub-tab clicks |
| Set Pieces | `getByTestId('set-pieces-tab')` | `getByRole('heading', { name: 'Set-Piece Takers' })` | No data-testid on SetPieceTakerPanel — heading used instead |
| Accuracy | `section[aria-label*="accuracy"]` | `[data-testid="calibration-chart"], [data-testid^="gw-row-"]` | AccuracyTab has no outer aria-label; testids found in component |
| Rivals | `getByTestId('rivals-tab')` | `getByRole('heading', { name: 'Track your mini-league rivals' })` | No data-testid on RivalsTab outer — heading used instead |
| Value Gems | `getByTestId('value-gems-tab')` | `getByRole('heading', { name: 'Value Gems' })` | No data-testid on ValueGemsTable outer — heading used instead |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 1e6e8af | chore(077-02): install Playwright + configure 430x900 Chromium-only mobile audit |
| 2 | 65859e9 | feat(077-02): add 7-tab mobile overflow Playwright spec (POL-03) |

## Test Results

```
Running 7 tests using 7 workers

  ok 1 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Plan tab does not overflow 430px viewport horizontally (2.8s)
  ok 2 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Set Pieces tab does not overflow 430px viewport horizontally (2.8s)
  ok 3 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Insights tab does not overflow 430px viewport horizontally (2.8s)
  ok 4 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Accuracy tab does not overflow 430px viewport horizontally (2.8s)
  ok 5 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Squad tab does not overflow 430px viewport horizontally (2.8s)
  ok 6 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Rivals tab does not overflow 430px viewport horizontally (2.8s)
  ok 7 [mobile-chromium-430] › POL-03 — 430px mobile overflow audit › Value Gems tab does not overflow 430px viewport horizontally (2.8s)

  7 passed (5.8s)
```

No tab overflows at 430px. Viewport was never changed from 430x900. No test was skipped. All 7 assertions are active.

## Phase 77 Closure

With Plan 01 (OPT-02, POL-01, POL-02) and Plan 02 (POL-03) complete, all four Phase 77 requirements are satisfied:

| Requirement | Description | Status |
|-------------|-------------|--------|
| OPT-02 | Pitch visual with player kit art | verified by Plan 01 |
| POL-01 | Decision tab captain overflow fix (flex-wrap) | verified by Plan 01 |
| POL-02 | AccuracyTab overflow-x-auto wrappers on 4 tables | verified by Plan 01 |
| POL-03 | Full mobile layout audit at 430px — 7 tabs, all passing | verified by this plan |

## Deviations from Plan

None — plan executed as written.

Navigation selectors adapted from the skeleton (role=tab → role=button) because the app uses plain `<button>` elements without ARIA tab roles, but this is expected behaviour that the plan documented as "Executor adapts based on Step 1 findings". No overflow was found; no assertion was relaxed; no viewport was widened.

## Known Stubs

None.

## Threat Flags

None — T-077-06 through T-077-10 all addressed as documented in the plan threat model. Playwright artefacts excluded from git via .gitignore.

## Self-Check: PASSED

Files confirmed present:
- playwright.config.ts: contains `viewport: { width: 430`
- e2e/mobile-overflow.spec.ts: contains `document.body.scrollWidth`, `window.innerWidth`, `test.describe('POL-03`
- package.json: contains `"test:e2e": "playwright test"` and `"@playwright/test"`
- .gitignore: contains `playwright-report` and `test-results`

Commits confirmed:
- 1e6e8af chore(077-02): install Playwright + configure 430x900 Chromium-only mobile audit
- 65859e9 feat(077-02): add 7-tab mobile overflow Playwright spec (POL-03)

npm run test:e2e: exits 0, 7 passed
