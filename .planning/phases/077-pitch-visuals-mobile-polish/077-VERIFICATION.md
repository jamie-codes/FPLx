---
phase: 077-pitch-visuals-mobile-polish
verified: 2026-05-07T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to the Squad > Lineup tab on a physical or emulated 390–430px mobile device/viewport with a squad loaded, and confirm each PlayerCard shows a team kit shirt image to the left of the player name"
    expected: "A team-coloured shirt image (24px mobile / 28px sm:) appears to the left of every player name; on image load failure a flat-colour swatch (team primary colour) renders in its place with no text inside it"
    why_human: "Kit images are loaded from a third-party CDN (fantasy.premierleague.com); automated grep can confirm the code path exists but cannot verify the image actually renders at the correct size without a live browser"
  - test: "On a narrow desktop viewport (~640–800px wide), navigate to the Decision tab and inspect the captain candidate rows inside the Captain Pick card"
    expected: "Badges and projected points text wrap to a second line rather than overflowing the card boundary; no clipping or overflow indicator appears"
    why_human: "flex-wrap behaviour at sm: breakpoint requires a real browser render to confirm there is no overflow; code inspection confirms the class is present but rendering is a visual truth"
  - test: "Run `npm run test:e2e` locally (or in CI) to confirm all 7 Playwright mobile-overflow tests pass against the development server"
    expected: "7 passed — all tabs (Insights, Plan, Squad, Set Pieces, Accuracy, Rivals, Value Gems) report document.body.scrollWidth <= window.innerWidth at 430x900 viewport"
    why_human: "The Playwright suite requires a live Next.js dev server at localhost:3000; cannot be driven headlessly from within the static verification process without starting the server"
---

# Phase 77: Pitch Visuals & Mobile Polish Verification Report

**Phase Goal:** LineupTab renders player kit art alongside names for faster visual scanning; Decision tab captain card no longer overflows its container; all tabs are verified clean on 390–430px viewport with no truncation, overflow, or undersized tap targets
**Verified:** 2026-05-07
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Each player card on the LineupTab pitch displays a team kit image alongside the player name — a coloured placeholder renders when the image URL is unavailable or fails to load | ✓ VERIFIED | `LineupTab.tsx` PlayerCard renders `<img src={teamKitUrl(teamCode)} alt="${team_short_name} kit" className="w-6 h-6 sm:w-7 sm:h-7 object-contain shrink-0" onError={() => setKitError(true)} />`; fallback `<div role="img" aria-label="${team_short_name} team colour" style={{ background: teamColour.primary }} />` when `showFallback` is true. `teamKitUrl` exported from `fpl-images.ts` returns the documented URL pattern. |
| SC-2 | CaptainPicksPanel on the Decision tab renders entirely within its card container on desktop — no content clips the card boundary | ✓ VERIFIED | `DecisionSummaryTab.tsx` line 509 className contains `sm:flex-row sm:flex-wrap sm:items-center sm:gap-3`; `sm:flex-wrap` insertion confirmed. `CaptainPicksPanel.tsx` line 38 EOModeToggle container has `inline-flex flex-wrap`. |
| SC-3 | GemTable and all sub-tables (Accuracy, Rivals, Value Gems, DefCon) render without horizontal overflow on 390–430px viewport widths | ✓ VERIFIED | All four top-level tables in `AccuracyTab.tsx` are wrapped in `<div className="overflow-x-auto">` (confirmed at lines 110, 360, 532, 630). Playwright suite asserts no horizontal body scroll on each tab at 430px. |
| SC-4 | Every tab verified individually on a 430px viewport: no truncated text, no misaligned cells, no tap targets below 44px — all violations resolved | ✓ VERIFIED (automated portion) | `e2e/mobile-overflow.spec.ts` contains 7 test cases covering all required tabs (Insights, Plan, Squad, Set Pieces, Accuracy, Rivals, Value Gems), each asserting `document.body.scrollWidth <= window.innerWidth` at 430x900. SUMMARY reports all 7 passed. Tap targets: Set C/VC pillBase has `min-h-[44px]`; EOModeToggle buttons have `min-h-[44px]`; Reset button has `min-h-[44px]`. Visual confirmation is a human item (see below). |

**Score:** 4/4 roadmap success criteria verified (automated evidence)

### Plan Must-Have Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PlayerCard renders kit `<img>` to the left of name/xPts/start% text column | ✓ VERIFIED | `LineupTab.tsx` lines 76–109: horizontal flex container `flex flex-row items-center gap-2 w-full` wraps kit element and text column |
| 2 | When kit image fails to load, coloured div using team's TEAM_COLOURS.primary renders with role='img' and aria-label including team short name | ✓ VERIFIED | Lines 78–85: `<div role="img" aria-label="${player.team_short_name} team colour" className="w-6 h-6 sm:w-7 sm:h-7 rounded shrink-0" style={{ background: teamColour.primary }} />` |
| 3 | DecisionSummaryTab captain candidate row uses flex-wrap so badges and points wrap at narrow desktop widths | ✓ VERIFIED | Line 509: `sm:flex-row sm:flex-wrap sm:items-center sm:gap-3` confirmed |
| 4 | CaptainPicksPanel EOModeToggle has flex-wrap on the inline-flex button group | ✓ VERIFIED | Line 38: `className="inline-flex flex-wrap rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700"` |
| 5 | AccuracyTab tables wrapped in `<div className="overflow-x-auto">` | ✓ VERIFIED | 4 occurrences found at lines 110, 360, 532, 630 — each immediately preceding `<table className={TABLE_CLS}>` |
| 6 | Set C / Set VC pills, EOModeToggle buttons, and Reset button retain min-h-[44px] | ✓ VERIFIED | `pillBase` in `LineupTab.tsx` line 58 has `min-h-[44px]`; Reset button line 400 has `min-h-[44px]`; EOModeToggle buttons line 47 have `min-h-[44px]` |

### Plan Must-Have Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Playwright installed as devDependency (@playwright/test ^1.49.0 or newer) | ✓ VERIFIED | `package.json` devDependencies: `"@playwright/test": "^1.59.1"` (exceeds floor) |
| 8 | playwright.config.ts exists at repo root configuring single Chromium project at 430x900 with baseURL | ✓ VERIFIED | File exists; `viewport: { width: 430, height: 900 }` in both `use` and `projects`; `baseURL: 'http://localhost:3000'`; `webServer` block present |
| 9 | e2e/mobile-overflow.spec.ts covers 7 tabs with scrollWidth <= innerWidth assertion | ✓ VERIFIED | 7 TABS entries confirmed (Insights, Plan, Squad, Set Pieces, Accuracy, Rivals, Value Gems); `document.body.scrollWidth` and `window.innerWidth` present; `expect(...).toBeLessThanOrEqual(overflow.innerWidth)`; `test.describe('POL-03 — 430px mobile overflow audit')`; no `test.skip` calls |
| 10 | npm script `test:e2e` exists | ✓ VERIFIED | `package.json` scripts: `"test:e2e": "playwright test"` |
| 11 | .gitignore excludes Playwright artefacts | ✓ VERIFIED | `/test-results/`, `/playwright-report/`, `/blob-report/`, `/playwright/.cache/` all present in `.gitignore` |

**Score:** 9/9 must-have truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/fpl-images.ts` | `export function teamKitUrl(teamCode: number): string` | ✓ VERIFIED | Function present at line 9; returns `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png` |
| `src/components/squad/LineupTab.tsx` | PlayerCard with kit image + onError fallback; imports `teamKitUrl` | ✓ VERIFIED | Import at line 9; `teamKitUrl(teamCode)` used at line 89; fallback div at lines 78–85; all data-testids preserved |
| `src/components/squad/DecisionSummaryTab.tsx` | Captain candidate row with flex-wrap | ✓ VERIFIED | Line 509: `sm:flex-wrap` confirmed present |
| `src/components/accuracy/AccuracyTab.tsx` | All four top-level tables in overflow-x-auto | ✓ VERIFIED | 4 occurrences; no fourth table outside wrapper |
| `tests/lib/fpl-images.test.ts` | 5 test cases covering teamKitUrl + existing helpers | ✓ VERIFIED | File exists; 5 test cases confirmed |
| `playwright.config.ts` | 430x900 Chromium config with webServer | ✓ VERIFIED | File exists; correct viewport and webServer block |
| `e2e/mobile-overflow.spec.ts` | 7-tab mobile overflow spec | ✓ VERIFIED | File exists; 7 entries; correct assertion pattern |
| `package.json` | `@playwright/test` + `test:e2e` script | ✓ VERIFIED | Both present |
| `.gitignore` | Playwright artefact exclusions | ✓ VERIFIED | All 4 patterns present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `LineupTab.tsx` PlayerCard | `fpl-images.ts teamKitUrl` | `import { teamKitUrl } from '@/lib/fpl-images'` | ✓ WIRED | Import at line 9; used in `src={teamKitUrl(teamCode)}` at line 89 |
| `LineupTab.tsx` PlayerCard fallback | `team-colours.ts TEAM_COLOURS` | `import { TEAM_BADGE_CODE, getTeamColour } from '@/lib/team-colours'` | ✓ WIRED | Import at line 10; `TEAM_BADGE_CODE[player.team_short_name]` and `getTeamColour(player.team_short_name)` used |
| `playwright.config.ts` | next dev server port 3000 | `webServer: { command: 'npm run dev', url: 'http://localhost:3000' }` | ✓ WIRED | Confirmed in config |
| `e2e/mobile-overflow.spec.ts` | app at localhost:3000 | `page.goto('/')` | ✓ WIRED | All 7 test cases call `page.goto('/')` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `LineupTab.tsx` PlayerCard kit image | `teamCode = TEAM_BADGE_CODE[player.team_short_name]` | Hardcoded lookup table in `team-colours.ts` (static, correct) | Yes — known team codes are static data, not user input | ✓ FLOWING |
| `LineupTab.tsx` PlayerCard fallback colour | `teamColour = getTeamColour(player.team_short_name)` | `team-colours.ts TEAM_COLOURS` record with safe default | Yes — default fallback for unknown teams returns `{ primary: '#71717A', ... }` | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `teamKitUrl(3)` returns correct URL | Static analysis of `fpl-images.ts` | Returns `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_3-66.png` | ✓ PASS |
| No `next/image` import in LineupTab | `grep -c "next/image" src/components/squad/LineupTab.tsx` | 0 | ✓ PASS |
| 4 overflow-x-auto wrappers in AccuracyTab | grep count | 4 | ✓ PASS |
| sm:flex-wrap in DecisionSummaryTab | grep | Line 509 confirmed | ✓ PASS |
| inline-flex flex-wrap in CaptainPicksPanel | grep | Line 38 confirmed | ✓ PASS |
| No test.skip in e2e spec | grep count | 0 | ✓ PASS |
| Playwright e2e runner execution | SKIP — requires live dev server | N/A | ? SKIP (see human verification) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OPT-02 | 077-01-PLAN.md | LineupTab pitch renders player kit art alongside player name; graceful fallback to coloured placeholder if image unavailable | ✓ SATISFIED | `teamKitUrl` function implemented; PlayerCard renders kit `<img>` with `onError` fallback to team-colour `<div>`; `role="img"` and `aria-label` present |
| POL-01 | 077-01-PLAN.md | Decision tab CaptainPicksPanel renders within its containing card — no content overflow | ✓ SATISFIED | `sm:flex-wrap` on DecisionSummaryTab captain candidate row (line 509); `inline-flex flex-wrap` already present on EOModeToggle (CaptainPicksPanel line 38) |
| POL-02 | 077-01-PLAN.md | GemTable and all sub-tables render without edge overflow on 390–430px viewport widths | ✓ SATISFIED | 4 AccuracyTab top-level tables wrapped in `overflow-x-auto`; POL-02 definition in REQUIREMENTS.md focuses on GemTable — note: GemTable overflow handling was addressed in prior phases; the AccuracyTab tables are the new addition |
| POL-03 | 077-02-PLAN.md | Full mobile layout audit across all tabs on Galaxy S26+ (≈430px) — truncated text, misaligned cells, tap-target violations resolved | ✓ SATISFIED (automated evidence) | Playwright suite exists with 7 tests; SUMMARY reports all 7 passed; code confirms no test was skipped and assertion was not weakened; live run is a human verification item |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No blockers found | — | — | — | — |

Checked files: `src/lib/fpl-images.ts`, `src/components/squad/LineupTab.tsx`, `src/components/squad/DecisionSummaryTab.tsx`, `src/components/captaincy/CaptainPicksPanel.tsx`, `src/components/accuracy/AccuracyTab.tsx`, `playwright.config.ts`, `e2e/mobile-overflow.spec.ts`

Notable negatives confirmed:
- No `next/image` import in LineupTab (anti-pattern avoided)
- No initials text inside fallback div (only flat colour swatch)
- No `return null` or empty handler stubs
- No hardcoded empty data arrays in rendering path
- Kit URL uses only type-safe public team code from `TEAM_BADGE_CODE` (no user input in URL)
- `onError` handler uses `useState` flag — no retry loop risk

---

### Human Verification Required

#### 1. Kit Image Visual Render at 390–430px

**Test:** With a valid FPL team ID submitted on the Transfers tab, navigate to Squad > Lineup. View the pitch on a device or browser DevTools emulated at 390px and 430px width.

**Expected:** Each PlayerCard shows a team shirt image (24px wide on mobile) to the left of the player name. The image is contained within the card without overflow. If the CDN image fails to load, a flat coloured swatch in the team's primary colour appears instead — no text inside the swatch, no broken image icon.

**Why human:** Kit images are fetched from `fantasy.premierleague.com` at runtime; automated static analysis confirms the code path is correct but cannot verify the CDN responds with a valid image or that the layout renders without overflow at a real mobile viewport.

#### 2. Decision Tab Captain Row Overflow at Narrow Desktop

**Test:** On the Decision tab at a desktop viewport narrowed to approximately 640–900px width, inspect the Captain Pick card containing candidate rows.

**Expected:** The rank + name, team + fixture, pts, and badge elements in each candidate row wrap to a second line rather than overflowing or clipping the card boundary. The card expands vertically to accommodate the wrapped content.

**Why human:** `sm:flex-wrap` enables wrapping at the Tailwind `sm:` breakpoint (≥640px) but the visual absence of overflow at the exact card boundary requires a browser render to confirm.

#### 3. Playwright E2E Suite Passes (7/7)

**Test:** From the repo root, with no existing dev server running, execute `npm run test:e2e`.

**Expected:** Playwright spawns the Next.js dev server, runs 7 test cases (one per tab), all report `ok`, final output reads `7 passed`. No test is skipped. No assertion is widened.

**Why human:** The suite requires a live Next.js dev server; verifier cannot start it. SUMMARY reports `7 passed (5.8s)` but this must be confirmed on a current working tree build given the commits landed after the SUMMARY was written.

---

### Gaps Summary

No gaps identified. All must-haves are VERIFIED by static analysis. The three human verification items are confirmations of visual/runtime behaviour that cannot be asserted without a live browser — they are not blockers in the sense that code evidence clearly supports the implementation, but the phase goal includes "verified clean on 390–430px viewport" which is a runtime truth requiring human or CI confirmation.

---

## Requirements Traceability Update

The REQUIREMENTS.md traceability table shows OPT-02, POL-01, POL-02, POL-03 as `pending`. After human verification confirms the three items above, these four requirements should be updated to `verified` with reference to `077-VERIFICATION.md`.

---

_Verified: 2026-05-07_
_Verifier: Claude (gsd-verifier)_
