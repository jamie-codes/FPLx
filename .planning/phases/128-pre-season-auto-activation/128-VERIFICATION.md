---
phase: 128-pre-season-auto-activation
verified: 2026-05-20T09:00:00Z
status: human_needed
score: 16/16
overrides_applied: 0
human_verification:
  - test: "Awaiting state — zinc pill renders as first element"
    expected: "With pipeline/cache/pre_season_active.json absent: navigate Plan > Next Season tab; zinc-coloured pill reading 'Awaiting' appears as FIRST element above the 'Pre-Season Squad' heading; no banner present; rest of tab renders normally"
    why_human: "Visual rendering and DOM order cannot be confirmed by static analysis"
  - test: "Live state — green pill + activation banner"
    expected: "Create pipeline/cache/pre_season_active.json with {activated_at, season_id: '2526'}; clear localStorage; restart dev server; green 'Live' pill renders; green-bordered banner appears between pill and 'Pre-Season Squad' h3 with copy '🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices.' and × dismiss button on the right"
    why_human: "Visual rendering, banner positioning, and copy accuracy cannot be confirmed by static analysis"
  - test: "Banner dismiss persistence"
    expected: "Click × on banner; banner disappears immediately; DevTools > Application > Local Storage shows fplx_nsp_activation_seen_2526='true'; F5 reload: pill still shows 'Live', banner does NOT return"
    why_human: "localStorage write behaviour and persistence across page reload require browser interaction"
  - test: "Accessibility — dismiss button"
    expected: "Tab to × button via keyboard: focus ring visible; inspect element: aria-label='Dismiss activation banner' present; dismiss button is at least 44×44 px"
    why_human: "Focus ring visibility, touch-target dimensions, and keyboard navigability require browser inspection"
  - test: "Cleanup — tab reverts to Awaiting"
    expected: "Delete pipeline/cache/pre_season_active.json; clear fplx_nsp_activation_seen_2526 from localStorage; tab reverts to zinc 'Awaiting' pill on next render/reload"
    why_human: "State reversion after artifact removal requires live browser verification"
---

# Phase 128: Pre-Season Auto-Activation Verification Report

**Phase Goal:** Tri-state PRE_SEASON_ACTIVE gate + pre_season_active.json artifact + suggest_squad.py force=True; usePreSeasonActive() hook + NextSeasonPlannerTab status pill + first-activation banner.
**Verified:** 2026-05-20T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `suggest_squad(bootstrap, archive, force=True)` bypasses idempotency and proceeds to ILP solve | VERIFIED | `pipeline/suggest_squad.py` line 276: `if not force:` wraps both Blob and local guards; `force: bool = False` signature at line 253 |
| 2 | `suggest_squad(bootstrap, archive)` (no force) preserves existing skip-if-exists behaviour | VERIFIED | Both Blob path (`vercel_blob.list` + early return) and local path (`os.path.exists` + early return) sit inside the single `if not force:` block |
| 3 | Phase 128 activation predicate (tri-state) is locked under regression tests | VERIFIED | `pipeline/tests/test_run_offseason.py`: `_evaluate_activation_predicate` replica + 7 tests covering 38-events happy path, 39-events DGW, any-finished false, len<38 false, deadline_time absent/None, empty list (no IndexError) |
| 4 | When off-season AND predicate True AND pre_season_active.json absent: run.py writes the artifact AND calls suggest_squad(force=True) | VERIFIED | `pipeline/run.py` lines 260-295: `_active_key = 'pre_season_active.json'`; `save(_active_key, {...})` on first activation; `suggest_squad(bootstrap, _arch, force=True)` immediately after |
| 5 | When pre_season_active.json already exists, activation block is a silent no-op | VERIFIED | `pipeline/run.py` line 300: `print("[pipeline] Pre-season already activated — skipping.")` in the `_active_exists` branch; no further writes |
| 6 | When activation predicate is False, the activation block does not fire | VERIFIED | `pipeline/run.py` line 257: `if _pre_season_predicate:` guards the entire inner try block |
| 7 | When archive is unavailable on first activation, pre_season_active.json is still written and squad recompute is skipped with a non-fatal log | VERIFIED | `pipeline/run.py` lines 297-298: `print("[pipeline] Pre-season activation: archive not available — squad recompute skipped.", file=sys.stderr)` in the `_arch is None` branch; `save()` is called before the archive load attempt |
| 8 | Unhandled exceptions inside the activation block are caught and logged non-fatally | VERIFIED | `pipeline/run.py` lines 301-302: `except Exception as _pa_exc: print(f"[pipeline] Pre-season activation non-fatal error: {_pa_exc}", file=sys.stderr)` |
| 9 | `src/lib/types.ts` exports `PreSeasonActiveResponse` with `activated_at: string` and `season_id: string` | VERIFIED | `src/lib/types.ts` lines 1146-1149: exact interface present immediately after `PreSeasonSquadResponse` |
| 10 | GET /api/pre-season-active returns 404 with `{ error: 'Pre-season not yet activated' }` when artifact absent | VERIFIED | `src/app/api/pre-season-active/route.ts` line 37: `return Response.json({ error: 'Pre-season not yet activated' }, { status: 404 })` |
| 11 | GET /api/pre-season-active returns 200 with parsed payload when artifact present | VERIFIED | `src/app/api/pre-season-active/route.ts` lines 39-43: `JSON.parse(data) as PreSeasonActiveResponse`; `Response.json(payload, { status: 200, headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } })` |
| 12 | Route uses `Response.json()` not `NextResponse.json()` | VERIFIED | No `NextResponse` import in `route.ts`; all three response paths use `Response.json()` |
| 13 | `usePreSeasonActive()` returns null for 404 and parsed payload for 200 | VERIFIED | `src/lib/hooks/usePreSeasonActive.ts` lines 14-16: `if (res.status === 404) return null`; `if (!res.ok) return null`; `return res.json()` on 200; 4 vitest tests confirm all branches |
| 14 | Status pill renders nothing while loading; zinc 'Awaiting' when null; green 'Live' when non-null | VERIFIED (code) | `NextSeasonPlannerTab.tsx` lines 194-204: `{activeData !== undefined && (...)}` guard; conditional Tailwind class; `{isActive ? 'Live' : 'Awaiting'}` text | NEEDS HUMAN for visual rendering |
| 15 | First-activation banner renders with exact copy, dismiss button, localStorage suppression, and SSR guard | VERIFIED (code) | Lines 210-225: condition chain with `typeof window !== 'undefined'` + `localStorage.getItem(fplx_nsp_activation_seen_${seasonId}) !== 'true'`; exact copy `🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices.`; `aria-label="Dismiss activation banner"`; onClick writes localStorage and sets `dismissed=true` | NEEDS HUMAN for interactive behaviour |
| 16 | Banner dismiss persists — clicking × writes localStorage and banner does not return on reload | VERIFIED (code) | `setDismissed(true)` + `localStorage.setItem` in onClick; banner condition re-reads localStorage each render so a `'true'` value prevents re-render | NEEDS HUMAN for browser confirmation |

**Score:** 16/16 truths verified in code. 5 items require human browser verification for visual/interactive behaviour.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pipeline/suggest_squad.py` | `force: bool = False` signature; both idempotency branches in `if not force:` | VERIFIED | Line 253 signature; line 276 single `if not force:` block; lines 277-290 both Blob and local paths nested inside |
| `pipeline/tests/test_suggest_squad.py` | 6 replica-function contract tests for force param (AUTO-02 D-03/D-04) | VERIFIED | 6 tests present: 2 force=False+blob, 2 force=False+local, 2 force=True bypass; `_should_skip_due_to_idempotency` replica function |
| `pipeline/tests/test_run_offseason.py` | `_evaluate_activation_predicate` replica + 6+ new tests | VERIFIED | 7 new tests present (38-events happy path, 39-events DGW, any-finished, len<38, deadline_time absent, deadline_time None, empty list); replica function matches D-02 clause ordering |
| `pipeline/run.py` | Activation block: IS_OFF_SEASON-guarded predicate + artifact write + force=True call | VERIFIED | Lines 247-302; positioned after IS_GW38 (line 245) and before `if not IS_OFF_SEASON:` (line 310) |
| `src/lib/types.ts` | `PreSeasonActiveResponse` interface with `activated_at: string` and `season_id: string` | VERIFIED | Lines 1146-1149; appended immediately after `PreSeasonSquadResponse` |
| `src/app/api/pre-season-active/route.ts` | GET handler with 404/200/500 responses; `readBlobOrLocal` helper; no `NextResponse` | VERIFIED | 48-line file; verbatim `readBlobOrLocal` helper; exact error strings; `s-maxage=300` (not 3600); `PreSeasonActiveResponse` type import via `@/lib/types` |
| `src/lib/hooks/usePreSeasonActive.ts` | TanStack Query hook: `queryKey: ['pre-season-active']`, `staleTime: 60_000`, 404→null, !ok→null | VERIFIED | Lines 10-19; `queryKey: ['pre-season-active']`; `staleTime: 60_000`; no `throw new Error` (grep returns 0) |
| `src/lib/hooks/usePreSeasonActive.test.ts` | Vitest tests: 404→null, 200→data, 500→null silent fallback | VERIFIED | 4 tests: 404→null, 200→payload deep-equals, 500→null (isError=false), staleTime freshness |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | Status pill + banner integrated above `<h3>Pre-Season Squad</h3>` | VERIFIED (code) | Lines 192-225 in return block; pill before banner, both before Section A `<div>`; `usePreSeasonActive` imported and called |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline/suggest_squad.py` | `force` parameter | `force: bool = False` default kwarg; `if not force:` wrapping both branches | VERIFIED | Line 253 signature; line 276 single guard |
| `pipeline/run.py` activation block | `pipeline/upload.py save()` | `save('pre_season_active.json', {...})` | VERIFIED | Line 274: `save(_active_key, {'activated_at': ..., 'season_id': ...})` |
| `pipeline/run.py` activation block | `pipeline/suggest_squad.py` | `from suggest_squad import suggest_squad` inside try; `suggest_squad(bootstrap, _arch, force=True)` | VERIFIED | Lines 294-295; import inside try block per plan convention |
| `pipeline/run.py` activation block | Vercel Blob + local path existence check | `vercel_blob.list({'prefix': _active_key, 'limit': 1})` + `os.path.exists` fallback | VERIFIED | Lines 262-267: dual-path pattern mirrors IS_GW38 |
| `src/app/api/pre-season-active/route.ts` | `src/lib/types.ts` | `import type { PreSeasonActiveResponse } from '@/lib/types'` | VERIFIED | Line 9 of route.ts |
| `src/app/api/pre-season-active/route.ts` | `pipeline/cache/pre_season_active.json` | `readBlobOrLocal('pre_season_active.json')` | VERIFIED | Line 35 |
| `src/lib/hooks/usePreSeasonActive.ts` | `/api/pre-season-active` | `fetch('/api/pre-season-active')` inside TanStack Query `queryFn` | VERIFIED | Line 13 |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | `usePreSeasonActive` hook | `import { usePreSeasonActive } from '@/lib/hooks/usePreSeasonActive'` + `const { data: activeData } = usePreSeasonActive()` | VERIFIED | Lines 15 and 128 |
| `src/components/next-season/NextSeasonPlannerTab.tsx` | localStorage banner suppression | `fplx_nsp_activation_seen_${seasonId}` getItem (line 211) + setItem (line 216) | VERIFIED | Both read and write present |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NextSeasonPlannerTab.tsx` | `activeData` | `usePreSeasonActive()` → `fetch('/api/pre-season-active')` → `readBlobOrLocal('pre_season_active.json')` → `pipeline/run.py` `save(_active_key, {...})` | Yes — pipeline writes real `{activated_at, season_id}` on first activation | FLOWING |
| `src/app/api/pre-season-active/route.ts` | `data` | `readBlobOrLocal('pre_season_active.json')` reads actual file from Blob or `pipeline/cache/` | Yes — ENOENT returns null (→ 404); real JSON returns payload | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Skipped for frontend components (React/Next.js routes require running server). Pipeline Python code spot-checked via grep pattern analysis above.

| Behavior | Evidence | Status |
|----------|----------|--------|
| `suggest_squad` accepts `force=True` without TypeError | `force: bool = False` in signature; `if not force:` guard | PASS |
| Activation block guarded by `IS_OFF_SEASON` | `if IS_OFF_SEASON:` at line 251 wraps the predicate eval and try block | PASS |
| `pre_season_active.json` key referenced in `_active_key` variable | Line 260: `_active_key = 'pre_season_active.json'` | PASS |
| `force=True` appears exactly once in `run.py` | Line 295: `suggest_squad(bootstrap, _arch, force=True)` — single occurrence | PASS |
| `Response.json()` used (not `NextResponse`) in route | No `NextResponse` import found in `route.ts` | PASS |
| No `throw new Error` in `usePreSeasonActive.ts` | Grep returns 0 occurrences | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| AUTO-01 | 128-01, 128-02 | Tri-state gate detects next-season bootstrap; pipeline writes artifact on first detection | SATISFIED | Predicate in `run.py` lines 252-256; locked by 7 regression tests in `test_run_offseason.py` |
| AUTO-02 | 128-01, 128-02 | `pre_season_active.json` Blob artifact written on first detection; `suggest_squad.py` gains `force=False`; re-runs ILP against fresh bootstrap on activation | SATISFIED | `suggest_squad.py` `force: bool = False` + `if not force:` guard; `run.py` `save(_active_key, {...})` + `suggest_squad(..., force=True)` |
| AUTO-03 | 128-03, 128-04 | `usePreSeasonActive()` hook + `/api/pre-season-active` route; Awaiting→Live pill + dismissible banner | SATISFIED (code) / NEEDS HUMAN (visual+interactive) | Route verified; hook verified; pill+banner code verified; Task 3 human checkpoint pending |

**Orphaned requirements check:** REQUIREMENTS.md maps AUTO-01, AUTO-02, AUTO-03 to Phase 128. All three are claimed in plan frontmatter and verified above. No orphaned requirements.

**REQUIREMENTS.md localStorage key note:** AUTO-03 states `nsp_activation_seen_{seasonId}` but the implementation and plan must_haves both specify `fplx_nsp_activation_seen_{seasonId}`. The plan explicitly documents this deviation as intentional alignment with the project's `fplx_` prefix convention (128-04-PLAN Step D, RESEARCH.md Pitfall 5). The semantic intent of the requirement is satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `NextSeasonPlannerTab.tsx` | 172 | `const nextSeasonFixtures: unknown[] = []` with TODO comment | Info | Intentional deferred item (GW1-8-FIXTURES); not a Phase 128 scope item; empty array has a data-fetching path noted in the TODO |

No blockers found. The `nextSeasonFixtures` empty array is a pre-existing deferred condition documented in the Phase 126/127 context, not introduced by Phase 128.

---

### Human Verification Required

Phase 128 Plan 04 Task 3 is a `checkpoint:human-verify` gate. The automated code review confirms all implementation is present and correctly wired, but the following visual and interactive behaviours require browser confirmation:

#### 1. Awaiting State — Zinc Pill

**Test:** With `pipeline/cache/pre_season_active.json` absent, start dev server (`npm run dev`), navigate to Plan > Next Season tab.
**Expected:** Zinc-coloured pill reading "Awaiting" appears as the FIRST element of the tab content above the "Pre-Season Squad" heading. No banner visible. Rest of tab (squad empty state, GW1-8 heatmap empty state) renders normally below the pill.
**Why human:** Pill visual styling and DOM order cannot be confirmed by static analysis.

#### 2. Live State — Green Pill + Banner

**Test:** Create `pipeline/cache/pre_season_active.json` with `{"activated_at": "2026-08-01T04:12:33Z", "season_id": "2526"}`. Clear localStorage. Restart `npm run dev`. Navigate to Next Season tab.
**Expected:** Green "Live" pill renders. Green-bordered banner appears between the pill and the "Pre-Season Squad" heading with the exact copy "🏆 Pre-season is live — your squad has been re-optimised against the new FPL prices." and a × dismiss button on the right.
**Why human:** Visual rendering and banner positioning relative to other elements require browser inspection.

#### 3. Banner Dismiss Persistence

**Test:** Click the × button on the banner.
**Expected:** Banner disappears immediately. DevTools > Application > Local Storage shows `fplx_nsp_activation_seen_2526 = 'true'`. F5 reload: pill still shows "Live"; banner does NOT return.
**Why human:** localStorage write persistence across page reload requires browser interaction to confirm.

#### 4. Accessibility — Dismiss Button

**Test:** Tab to the × button using keyboard; inspect the element in DevTools.
**Expected:** Focus ring visible when button receives keyboard focus. `aria-label="Dismiss activation banner"` present on the button element. Button is at least 44×44 px (confirm via DevTools hover dimensions).
**Why human:** Focus ring visibility and touch target dimensions require browser inspection.

#### 5. Cleanup — Tab Reverts to Awaiting

**Test:** Delete `pipeline/cache/pre_season_active.json`. Clear the `fplx_nsp_activation_seen_2526` key from localStorage. Reload the page.
**Expected:** Tab reverts to zinc "Awaiting" pill. No banner.
**Why human:** State reversion after artifact removal requires live browser verification.

**Resume signal:** Type "approved" once all five steps pass, or describe any visual/interaction issues.

---

### Gaps Summary

No gaps. All 16 must-have truths are verified in the codebase. The `human_needed` status reflects the outstanding Plan 04 Task 3 human verification checkpoint for visual/interactive UX behaviour — this is a planned checkpoint, not a code deficiency.

**Note on season_id derivation:** Plan 02 SUMMARY documents a corrected formula (`f"{str(_year-1)[-2:]}{str(_year)[-2:]}"`) replacing the plan's draft formula that would have produced `"202526"`. The actual implementation uses the corrected formula and produces `"2526"` for 2026. This is an auto-fixed bug per the SUMMARY's Rule 1 deviation record and is verified correct in code (line 273 of run.py).

---

_Verified: 2026-05-20T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
