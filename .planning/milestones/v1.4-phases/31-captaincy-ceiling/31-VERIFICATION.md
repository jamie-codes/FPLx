---
phase: 31-captaincy-ceiling
verified: 2026-04-28T16:03:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to Gems tab and visually confirm two-card captain picks section appears below GemTable with correct UI-SPEC styling"
    expected: "Section headed 'Captain Picks — GW {N}' (em-dash) with Ceiling + EO-Adjusted cards side-by-side at ≥640px; tagline 'Ceiling = chase rank. EO-Adjusted = protect rank.'; tooltips on hover; mobile stacks vertically; no hue accents"
    why_human: "Tailwind class rendering, responsive breakpoints, native title tooltip behaviour, dark mode, and visual accuracy against UI-SPEC cannot be verified programmatically without a running browser"
---

# Phase 31: Captaincy Ceiling Verification Report

**Phase Goal:** User gets distribution-aware captain picks — a ceiling pick for when chasing rank and an EO-adjusted pick for protecting rank
**Verified:** 2026-04-28T16:03:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can see a ceiling captain recommendation showing the highest 90th-percentile xPts player (CAP-03) | ✓ VERIFIED | `CaptainPicksPanel` renders `data.ceiling`; `_compute_captain_picks` selects `max(eligible, key=xPts_90th_1gw)` among `status='a'` players; smoke test confirmed |
| 2 | User can see an EO-adjusted captain recommendation that accounts for ownership concentration (CAP-04) | ✓ VERIFIED | Panel renders `data.eo_adjusted`; helper uses `_safe_float(selected_by_percent) < threshold` with 25%→35%→ceiling fallback ladder; smoke test confirmed threshold=35.0 fallback works correctly |
| 3 | Test stub file exists with 8 it.skip integration stubs + 1 placeholder (Wave 0 Nyquist rule) | ✓ VERIFIED | `tests/lib/captain-picks.test.ts` — `grep -c "it.skip("` = 8; vitest: 6 passed + 8 skipped |
| 4 | `_compute_captain_picks(result, gameweek)` helper exists in `pipeline/merge.py` and returns D-09 schema dict | ✓ VERIFIED | `def _compute_captain_picks(result: list, gameweek: int \| None = None) -> dict:` at line 415; smoke test returns all required keys: `ceiling`, `eo_adjusted`, `gameweek`, `generated_at` |
| 5 | xPts_90th_1gw written per player BEFORE sigma strip block (T-31-06 ordering invariant) | ✓ VERIFIED | Line 926 writes `xPts_90th_1gw = round(xPts_1gw + 1.28 * _sigma_1gw, 3)`; line 931 calls `_compute_captain_picks`; line 935 begins sigma strip — correct ordering confirmed |
| 6 | `merge_players()` returns `tuple[list, dict]` and `run.py` unpacks and saves `captain_picks.json` | ✓ VERIFIED | `-> tuple[list, dict]:` at line 500 of `merge.py`; `return result, captain_picks_payload` at line 939; `run.py` line 147: `merged, captain_picks = merge_players(...)`; line 149: `save('captain_picks.json', captain_picks)` |
| 7 | Gems tab shows `<CaptainPicksPanel />` mounted below `<GemTable />` in a React fragment | ✓ VERIFIED | `src/app/page.tsx` lines 108-113: fragment wraps `<GemTable />` then `<CaptainPicksPanel />`; import at line 15 |
| 8 | API route, hook, and types are fully wired: `/api/captain-picks` → `useCaptainPicks` → `CaptainPicksPanel` | ✓ VERIFIED | Route reads `pipeline/cache/captain_picks.json` (local) or Blob (USE_BLOB); hook fetches `/api/captain-picks` with `staleTime: 6h`; panel calls `useCaptainPicks()` and renders `data.ceiling` + `data.eo_adjusted` |
| 9 | 5 active component tests pass (loading, error, ceiling card, EO card, same-player note) + full suite green | ✓ VERIFIED | `npx vitest run tests/lib/captain-picks.test.ts`: 6 passed, 8 skipped; `npm test`: 284 passed, 34 skipped — no regressions |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/lib/captain-picks.test.ts` | Wave 0 stub: 8 it.skip + 1 placeholder + 5 component tests | ✓ VERIFIED | 14 tests total; 6 active pass, 8 skipped; `describe('Phase 31: CaptainPicksPanel component'` block present |
| `pipeline/merge.py` | `_compute_captain_picks` helper + per-player xPts_90th_1gw write + post-loop call + tuple return | ✓ VERIFIED | All 4 mutations confirmed at lines 415, 926, 931, 939 |
| `pipeline/run.py` | Tuple unpack of merge_players() + parallel `save('captain_picks.json', captain_picks)` | ✓ VERIFIED | Lines 147, 149; comment references CAP-03/CAP-04 |
| `src/lib/types.ts` | `xPts_90th_1gw?: number` on MergedPlayer; `CaptainPick` + `CaptainPicks` interfaces | ✓ VERIFIED | Line 168 (MergedPlayer); lines 323-340 (new interfaces); all required fields present including `eo_threshold_used?: number` and nullable ceiling/eo_adjusted |
| `src/app/api/captain-picks/route.ts` | App Router GET handler with USE_BLOB toggle | ✓ VERIFIED | 34-line file; `export async function GET()` only; reads `captain_picks.json` via readFile or Blob; correct 404/500 messages |
| `src/lib/hooks/useCaptainPicks.ts` | React Query hook with `['captain-picks']` queryKey and 6h staleTime | ✓ VERIFIED | `queryKey: ['captain-picks']`; `staleTime: 6 * 60 * 60 * 1000`; typed as `CaptainPicks`; fetches `/api/captain-picks` (not filesystem path) |
| `src/components/captaincy/CaptainPicksPanel.tsx` | Two-card panel per UI-SPEC with PickCard helper, loading/error/null/same-player states | ✓ VERIFIED | `'use client'`; `export function CaptainPicksPanel()`; `function PickCard()`; all locked Tailwind classes and copy strings present; no forbidden hue accents |
| `src/app/page.tsx` | `<CaptainPicksPanel />` mounted in Gems branch after `<GemTable />` | ✓ VERIFIED | Fragment at lines 108-113; import at line 15 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CaptainPicksPanel.tsx` | `/api/captain-picks` | `useCaptainPicks()` → `useQuery` → `fetch('/api/captain-picks')` | ✓ WIRED | `useCaptainPicks.ts` line 8: `fetch('/api/captain-picks')` |
| `src/app/api/captain-picks/route.ts` | `pipeline/cache/captain_picks.json` | `readFile(join(process.cwd(), 'pipeline', 'cache', 'captain_picks.json'), 'utf-8')` | ✓ WIRED | Route line 19-20; file read path hard-coded |
| `src/app/page.tsx` Gems branch | `<CaptainPicksPanel />` | Imported from `@/components/captaincy/CaptainPicksPanel`; rendered inside Gems branch fragment | ✓ WIRED | `page.tsx` lines 15, 108-113 |
| `pipeline/merge.py merge_players()` | `_compute_captain_picks(result, gameweek=current_gw)` | Called after xPts ceiling tercile block and BEFORE sigma strip | ✓ WIRED | Lines 931 (call), 933 (sigma strip comment) — correct order confirmed |
| `pipeline/run.py` | `merge_players()` returning tuple | `merged, captain_picks = merge_players(...)` | ✓ WIRED | `run.py` line 147 |
| `_compute_captain_picks` ownership gate | `_safe_float(p.get('selected_by_percent'), 0.0)` | EO threshold comparison uses safe cast (FPL returns string) | ✓ WIRED | `merge.py` line 472; grep confirmed 1 occurrence |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CaptainPicksPanel.tsx` | `data` (CaptainPicks) | `useCaptainPicks()` → React Query → `fetch('/api/captain-picks')` → route reads `captain_picks.json` written by `pipeline/run.py` | Yes — pipeline computes from real FPL + Understat data via `_compute_captain_picks` | ✓ FLOWING |
| `pipeline/merge.py` per-player | `xPts_90th_1gw` | `round((xPts_1gw or 0.0) + 1.28 * (_sigma_1gw or 0.0), 3)` where `_sigma_1gw` is computed by Phase 28 `_compute_xpts_sigma()` | Yes — real Poisson sigma derived from Understat xG data | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `_compute_captain_picks` returns correct D-09 schema keys | `python -c "from merge import _compute_captain_picks; r = _compute_captain_picks([...], gameweek=30); print(sorted(r.keys()))"` | `['ceiling', 'eo_adjusted', 'gameweek', 'generated_at']` | ✓ PASS |
| Ceiling = max xPts_90th_1gw among status='a' (injured excluded) | Python smoke test with injured player having highest xPts | `ceiling: HighOwned` (status='a' with xPts_90th_1gw=8.0) | ✓ PASS |
| EO threshold ladder: 25%→35%→ceiling fallback | Python smoke test: no player <25%, one player <35% | `eo_adjusted: Lowowned`, `threshold_used: 35.0` | ✓ PASS |
| Captain picks test file: 6 passed, 8 skipped | `npx vitest run tests/lib/captain-picks.test.ts` | `6 passed \| 8 skipped (14)` | ✓ PASS |
| Full test suite green (no regressions) | `npm test` | `284 passed \| 34 skipped (318)` | ✓ PASS |
| Python files syntactically valid | `python -c "import ast; ast.parse(...)"` | `SYNTAX OK` for both `merge.py` and `run.py` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CAP-03 | 31-01, 31-02 | User can see a ceiling captain recommendation showing the highest 90th-percentile xPts player | ✓ SATISFIED | `_compute_captain_picks` computes ceiling; `xPts_90th_1gw` written per player; `CaptainPicksPanel` renders Ceiling card; component test asserts player name and xPts displayed |
| CAP-04 | 31-01, 31-02 | User can see an EO-adjusted captain recommendation that accounts for ownership concentration | ✓ SATISFIED | EO threshold ladder (25%→35%→fallback) in `_compute_captain_picks`; `_safe_float` for string ownership; `CaptainPicksPanel` renders EO-Adjusted card; component test asserts ownership display |

No orphaned requirements. Both plan-declared requirements (CAP-03, CAP-04) are present in REQUIREMENTS.md and mapped to Phase 31.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CaptainPicksPanel.tsx` | 70 | `return null` | ℹ Info | Legitimate null guard: only when `!data` (not loading, no error, data simply absent). Component has full rendering code; not a stub. |

No blockers. No stubs. No hardcoded empty data in production code paths.

### Human Verification Required

All automated checks pass. One item requires human verification — visual rendering in a live browser.

#### 1. Gems Tab Captain Picks Panel Visual Verification

**Test:** Start the dev server (`npm run dev`), open `http://localhost:3000`, navigate to the Gems tab (default active), and scroll below the GemTable.

**Expected:**
- A section appears titled `Captain Picks — GW {N}` (em-dash U+2014, not hyphen) with tagline `Ceiling = chase rank. EO-Adjusted = protect rank.`
- Two cards appear side-by-side at ≥640px viewport: left card labelled `Ceiling`, right card labelled `EO-Adjusted`
- Each card shows player name, position chip (top-right, muted text), meta line `{TEAM} · £X.Xm · X.X% owned` (middle-dot U+00B7), and xPts line `xPts: X.X (90th pct: X.X)`
- Hovering the `Ceiling` heading shows native browser tooltip: `Highest 90th-percentile xPts. Captain when chasing rank — accepts higher variance for upside.`
- Hovering the `EO-Adjusted` heading shows: `Highest 90th-percentile xPts among players with under 25% ownership. Reduces rank variance vs the template.`
- At <640px (mobile emulation) the two cards stack vertically into a single column
- Dark mode toggle produces `dark:bg-zinc-900` card backgrounds with `dark:border-zinc-700` borders
- No hue accents (no green/blue/amber/violet backgrounds) on pick cards; red only appears in error state

**Note:** First run `cd pipeline && python run.py` to populate `pipeline/cache/captain_picks.json` if the cache file is absent.

**Why human:** Tailwind responsive breakpoints, native `title` tooltip visibility, dark mode visual appearance, and UI-SPEC exact styling cannot be verified without a live browser rendering engine.

**Prior approval:** Task 6 human-verify checkpoint was recorded as approved on 2026-04-28 in `31-02-SUMMARY.md`. This human verification item is carried forward per protocol — the approval status should be confirmed before marking Phase 31 passed.

### Gaps Summary

No automated gaps found. All 9 must-haves verified. All artifacts are substantive, wired, and data-flowing. The only outstanding item is the human verification checkpoint for visual accuracy — which the SUMMARY records as already approved on 2026-04-28.

If the Task 6 approval (recorded in `31-02-SUMMARY.md`) is accepted as evidence, the effective status is **passed**. If independent human confirmation is required before marking the phase complete, status remains **human_needed**.

---

_Verified: 2026-04-28T16:03:00Z_
_Verifier: Claude (gsd-verifier)_
