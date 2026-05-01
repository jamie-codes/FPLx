---
phase: 33-insights-tab
verified: 2026-04-28T20:35:00Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open http://localhost:3000, click the Insights tab, and confirm the four-category layout renders with tier badges, tooltip on hover, dark mode theming, and footnote text."
    expected: "Insights tab appears between Set Pieces and Value Gems in desktop nav; four category sections render (Defensive, Attacking, Player-Specific, Captaincy); each card has a tier badge (HIGH/MEDIUM/LOW) with correct colour; hovering shows native tooltip with format 'True in N% of fixtures — n/total matches' (em-dash); footnote 'Patterns shown only when seen in 10 or more fixtures.' is visible; bottom MobileNav shows 8 buttons with 'Insights' between SP and Values."
    why_human: "Visual appearance, tab wiring behaviour, tooltip display, dark mode colour rendering, and MobileNav layout cannot be verified programmatically without running the dev server."
---

# Phase 33: Insights Tab Verification Report

**Phase Goal:** User can browse data-driven pattern statements about this season's FPL data, surfacing non-obvious trends with confidence levels (INS-01, INS-02, INS-03, INS-04)
**Verified:** 2026-04-28T20:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                              | Status        | Evidence                                                                                       |
|----|----------------------------------------------------------------------------------------------------|---------------|-----------------------------------------------------------------------------------------------|
| 1  | User can see an Insights tab in the navigation (INS-01)                                            | ✓ VERIFIED    | `page.tsx` has `setActiveTab('insights')` button, `Tab` union includes `'insights'`, `MobileNav.tsx` TABS array has `{ id: 'insights', label: 'Insights' }` |
| 2  | Each statement displays a confidence weight derived from actual season data (INS-02)               | ✓ VERIFIED    | `insights.json` populated with 12 real insights; `confidence_pct`, `sample_n`, `sample_total` present in every entry; `InsightsTab.tsx` renders tier badge + HTML title tooltip |
| 3  | Statements span defensive, attacking, and player-specific patterns (INS-03)                        | ✓ VERIFIED    | `insights.json` contains all 4 categories: `['attacking', 'captaincy', 'defensive', 'player']`; component renders sections in fixed D-06 order |
| 4  | Trivially obvious statements are excluded from the Insights tab (INS-04)                           | ✓ VERIFIED    | `_TRIVIAL_PATTERN_IDS` frozenset declared in `insights.py`; triviality gate enforced in `compute_insights()`; no trivial IDs found in `insights.json` output; no `import requests` in `insights.py` |
| 5  | Pipeline produces valid insights.json with all six required fields per Insight dict (D-12)         | ✓ VERIFIED    | `insights.json`: 12 entries, all with `id`, `category`, `statement`, `confidence_pct`, `sample_n`, `sample_total`; all `sample_total >= 10`; all `confidence_pct` in [0, 100] |
| 6  | InsightsTab component renders loading/error/empty states with locked UI-SPEC copy                  | ✓ VERIFIED    | `InsightsTab.tsx` contains exact copy strings: `Loading insights…` (U+2026), `No insights available yet`, `Failed to load insights. Check the pipeline output and refresh.`, footnote; 12 component tests pass covering all four states |
| 7  | TypeScript compiles cleanly across all new phase-33 production files                               | ⚠ UNCERTAIN   | `npx tsc --noEmit` emits one TS2352 error in `InsightsTab.test.tsx` line 166 (`data: []` infers as `never[]` rather than `Insight[]` in the cast). The production component, route, hook, and types files compile without error. The test still executes and passes (12/12 via vitest). The 5 pre-existing TS errors in `tests/lib/captain-picks.test.ts` are unrelated to this phase. |
| 8  | Full vitest suite remains green after phase-33 changes                                             | ✓ VERIFIED    | `npx vitest run` exits 0: 29 files passed, 311 passed / 34 skipped                            |
| 9  | Visual/interactive behaviour in browser (nav order, tier badge colours, tooltip, dark mode, MobileNav) | ? NEEDS HUMAN | Cannot verify programmatically without running dev server                                     |

**Score:** 8/9 truths verified (1 needs human)

### Deferred Items

None identified for later phases.

### Required Artifacts

| Artifact                                          | Expected                                             | Status      | Details                                                                   |
|---------------------------------------------------|------------------------------------------------------|-------------|---------------------------------------------------------------------------|
| `pipeline/insights.py`                            | compute_insights() + 4 category helpers + gates      | ✓ VERIFIED  | 431 lines; all 5 public/private functions present; MIN_SAMPLE_TOTAL=10; _TRIVIAL_PATTERN_IDS frozenset; no HTTP imports |
| `pipeline/run.py`                                 | imports compute_insights; calls save('insights.json') | ✓ VERIFIED  | Line 19: `from insights import compute_insights`; line 154: `save('insights.json', insights)` inside try block |
| `pipeline/cache/insights.json`                    | Valid JSON array, all 4 categories, gates passed     | ✓ VERIFIED  | 12 entries; all sample_total >= 10; all 4 categories present; sorted by (category asc, confidence_pct desc) |
| `src/lib/types.ts`                                | Exported `Insight` interface (six fields per D-12)   | ✓ VERIFIED  | `export interface Insight` appended at bottom; all 6 fields present      |
| `src/app/api/insights/route.ts`                   | GET handler with USE_BLOB toggle, reads insights.json | ✓ VERIFIED  | Named `export async function GET()`; no default export; `insights.json` referenced twice (Blob + local path) |
| `src/lib/hooks/useInsights.ts`                    | useQuery<Insight[]>, queryKey ['insights'], 6h staleTime | ✓ VERIFIED | `queryKey: ['insights']`; `staleTime: 6 * 60 * 60 * 1000`; `fetch('/api/insights')` |
| `src/components/insights/InsightsTab.tsx`         | Named export InsightsTab, four category sections, tier badge | ✓ VERIFIED | `export function InsightsTab()`; `InsightCard` helper; TIER_CLASSES const; all locked Tailwind classes + copy strings present |
| `src/app/page.tsx`                                | 'insights' in Tab union; nav button; content branch  | ✓ VERIFIED  | Tab union updated; `setActiveTab('insights')` button between Set Pieces and Value Gems; `{activeTab === 'insights' && <InsightsTab />}` |
| `src/components/nav/MobileNav.tsx`                | 'insights' in Tab union; TABS array 8 entries        | ✓ VERIFIED  | Tab union updated; `{ id: 'insights', label: 'Insights' }` between set-pieces and value-gems; 8 entries total |
| `src/components/insights/InsightsTab.test.tsx`    | 12 tests covering 4 states, tier badges, tooltip      | ✓ VERIFIED  | 12 tests pass (11 component + 1 Wave 0 placeholder); all tier badge colour/text assertions pass |

### Key Link Verification

| From                              | To                                     | Via                                           | Status        | Details                                                              |
|-----------------------------------|----------------------------------------|-----------------------------------------------|---------------|----------------------------------------------------------------------|
| `InsightsTab.tsx`                 | `/api/insights`                        | `useInsights()` -> `fetch('/api/insights')`   | ✓ WIRED       | `useInsights.ts` imports from `@tanstack/react-query`, fetches `/api/insights`; `InsightsTab.tsx` imports and calls `useInsights()` |
| `src/app/api/insights/route.ts`   | `pipeline/cache/insights.json`         | `readFile(join(process.cwd(), 'pipeline', 'cache', 'insights.json'), 'utf-8')` | ✓ WIRED | Hard-coded path present; `insights.json` referenced twice (Blob prefix + local path) |
| `src/app/page.tsx`                | `<InsightsTab />`                      | imported from `@/components/insights/InsightsTab`; mounted when `activeTab === 'insights'` | ✓ WIRED | Import on line 16; content branch on line 134 |
| `MobileNav.tsx` TABS              | `src/app/page.tsx` Tab union           | Both files independently declare `'insights'` in Tab type | ✓ WIRED | Both Tab unions have identical ordering; TypeScript `satisfies` clause enforces sync |
| `pipeline/run.py`                 | `pipeline/insights.py compute_insights()` | `from insights import compute_insights`      | ✓ WIRED       | Line 19; called on line 153 with correct args                        |
| `pipeline/run.py`                 | `pipeline/cache/insights.json`         | `save('insights.json', insights)`             | ✓ WIRED       | Line 154; inside try block after captain_picks.json save             |

### Data-Flow Trace (Level 4)

| Artifact                            | Data Variable         | Source                                      | Produces Real Data | Status       |
|-------------------------------------|-----------------------|---------------------------------------------|--------------------|--------------|
| `InsightsTab.tsx`                   | `data` (Insight[])    | `useInsights()` -> `fetch('/api/insights')` -> `readFile('insights.json')` | Yes — 12 insights from real pipeline run | ✓ FLOWING  |
| `src/app/api/insights/route.ts`     | file content          | `pipeline/cache/insights.json` (12 entries) | Yes                | ✓ FLOWING    |

### Behavioral Spot-Checks

| Behavior                                             | Command                                                                                                   | Result                                           | Status   |
|------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|--------------------------------------------------|----------|
| insights.py importable with correct API              | `cd pipeline && python -c "import insights; assert callable(insights.compute_insights)..."`               | "insights.py importable and shape OK"            | ✓ PASS   |
| insights.json has all 4 categories, all gates pass   | `python -c "import json; d=json.load(...); assert cats.issuperset({'defensive','attacking','player','captaincy'})..."` | "All 4 categories present"; "All gate checks pass" | ✓ PASS |
| No trivial IDs in output                             | `python -c "... assert not overlap ..."`                                                                  | "Trivial IDs in output: set()"                   | ✓ PASS   |
| Output sorted by (category asc, confidence_pct desc) | Python sort-order check                                                                                   | "Sort order correct: True"                       | ✓ PASS   |
| run.py wiring (import + save call)                   | `grep -c "from insights import compute_insights" pipeline/run.py` etc.                                    | 1, 1, 1                                          | ✓ PASS   |
| InsightsTab vitest suite (12 tests)                  | `npx vitest run src/components/insights/InsightsTab.test.tsx`                                             | "12 passed"                                      | ✓ PASS   |
| Full vitest suite (no regressions)                   | `npx vitest run`                                                                                          | "311 passed, 29 files"                           | ✓ PASS   |
| TypeScript compile (production files)                | `npx tsc --noEmit`                                                                                        | 1 TS error in test file (see below); 0 in production files | ⚠ WARN |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                    | Status          | Evidence                                                                            |
|-------------|------------|--------------------------------------------------------------------------------|-----------------|-------------------------------------------------------------------------------------|
| INS-01      | 33-02      | User can see an Insights tab with data-driven statements                        | ✓ SATISFIED     | Insights tab added to page.tsx Tab union, desktop nav button, MobileNav TABS; InsightsTab component renders statements from hook data |
| INS-02      | 33-01, 33-02 | Each statement displays a confidence weight from actual season data           | ✓ SATISFIED     | `confidence_pct`, `sample_n`, `sample_total` in every Insight dict; tier badge + HTML title tooltip render these values |
| INS-03      | 33-01, 33-02 | Statements span defensive, attacking, player-specific patterns                 | ✓ SATISFIED     | All 4 categories present in insights.json; component renders four sections in fixed CATEGORY_ORDER |
| INS-04      | 33-01      | Trivially obvious statements excluded                                           | ✓ SATISFIED     | `_TRIVIAL_PATTERN_IDS` frozenset at module top; gate applied in `compute_insights()`; no trivial IDs in live output |

### Anti-Patterns Found

| File                                              | Line | Pattern                                                               | Severity | Impact                                                                                   |
|---------------------------------------------------|------|-----------------------------------------------------------------------|----------|------------------------------------------------------------------------------------------|
| `src/components/insights/InsightsTab.test.tsx`    | 166  | `data: []` infers as `never[]`, cast to `UseQueryResult<Insight[], Error>` fails TS2352 | WARNING | Test runs and passes at runtime (vitest); only `tsc --noEmit` emits this error. Does not affect production bundle. |

Note: The 5 TypeScript errors in `tests/lib/captain-picks.test.ts` are pre-existing (confirmed by the SUMMARY) and out of scope for this phase.

### Human Verification Required

#### 1. Full browser integration test

**Test:** Start dev server (`npm run dev`), open `http://localhost:3000`, and perform the 15-step verification listed in Plan 02 Task 6:
1. Confirm desktop tab order: Gem Ratings | DefCon Analysis | Squad & Transfers | Club Form | Set Pieces | **Insights** | Value Gems | Planner
2. Click the Insights tab — verify four category sections render (Defensive Patterns, Attacking Patterns, Player-Specific Patterns, Captaincy Patterns) each with insight cards
3. Each card: statement text (text-sm) + coloured tier badge (HIGH = green, MEDIUM = amber, LOW = zinc)
4. Hover a tier badge — native browser tooltip shows `True in N% of fixtures — n/total matches` (em-dash U+2014)
5. Footnote `Patterns shown only when seen in 10 or more fixtures.` visible at bottom
6. Mobile view (< 640px): bottom MobileNav shows 8 buttons, 'Insights' between SP and Values; tap activates the tab
7. Dark mode toggle: card backgrounds switch to `dark:bg-zinc-900`; badge colours change per TIER_CLASSES dark variants
8. Tab-switch cache: switching away and back does NOT re-fetch within 6h staleTime (Network tab: no second GET /api/insights)

**Expected:** All 8 checks pass with no visual deviations from the locked 33-UI-SPEC.md

**Why human:** Visual appearance, tier badge colour rendering, tooltip display, dark mode, tab-switch caching behaviour, and MobileNav layout cannot be verified without running the application.

---

## Gaps Summary

No hard blockers. All pipeline logic, API route, hook, component, nav wiring, and tests are implemented and verified programmatically.

One warning-level issue identified: `InsightsTab.test.tsx` line 166 has a TypeScript cast error (`data: []` infers `never[]`). The fix is to type the literal as `data: [] as Insight[]` or change the cast to `as unknown as ReturnType<typeof useInsights>`. This does not affect runtime — vitest passes 12/12 — but `tsc --noEmit` fails on this file. All production files (route, hook, component, types) compile cleanly.

The phase is waiting on the human-verify checkpoint (Plan 02 Task 6) which is a blocking gate per the plan. No automated check can substitute for the browser visual verification.

---

_Verified: 2026-04-28T20:35:00Z_
_Verifier: Claude (gsd-verifier)_
