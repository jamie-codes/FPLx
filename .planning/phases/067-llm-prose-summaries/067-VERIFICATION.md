---
phase: 067-llm-prose-summaries
verified: 2026-05-05T00:00:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to Squad -> Decision tab without loading a squad. Scroll below the four Decision cards."
    expected: "AI Summary block visible. Prose paragraph present. 'Updated GW{N}' timestamp visible. Refresh button (↻) visible but disabled (greyed, ~40% opacity)."
    why_human: "Requires a running dev server with weekly_summary.json present in pipeline/cache/ or Vercel Blob. Programmatic check cannot assert visual rendering or disabled-state opacity."
  - test: "Enter a valid FPL Team ID and click Load Squad. Then click the ↻ button."
    expected: "Button shows ⏳ spinner while in-flight (~10s), then prose paragraph replaces with a new squad-aware paragraph. Button reverts to ↻."
    why_human: "Requires ANTHROPIC_API_KEY set locally, dev server running, and a real POST call to Claude API. Cannot verify live LLM call programmatically."
  - test: "After clicking ↻ and receiving updated prose, reload the page."
    expected: "Prose reverts to the global pipeline summary (D-04 override state lost on unmount)."
    why_human: "Override state is component-local React state — revert on reload requires visual browser confirmation."
---

# Phase 067: LLM Prose Summaries Verification Report

**Phase Goal:** Integrate an LLM (Claude Haiku) to generate a weekly prose narrative summarising captain picks and differential targets; display it below the Decision cards; allow the user to regenerate it mid-week using their current squad state.
**Verified:** 2026-05-05
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Shared TS guardrail rejects prose mentioning corpus names not in allowed set, exposed via passesGuardrail/findHallucinatedNames | VERIFIED | `src/lib/prose-guardrail.ts` lines 12-36: both functions exported, algorithm correctly implemented; test file has 7 passing tests |
| 2 | ProseSummary and ProseRefreshPayload interfaces exist in src/lib/types.ts | VERIFIED | `grep` confirmed `export interface ProseSummary` at line 604 and `export interface ProseRefreshPayload` at line 610 |
| 3 | Pipeline calls Anthropic Claude (claude-haiku-4-5) once per run, persists weekly_summary.json on guardrail PASS | VERIFIED | `pipeline/prose_summary.py` line 32: `MODEL = 'claude-haiku-4-5'`; `pipeline/run.py` calls `generate_weekly_summary()` at line 282/310; `save('weekly_summary.json', summary)` at line 317 |
| 4 | When ANTHROPIC_API_KEY missing OR guardrail fails on both attempts, no weekly_summary.json written | VERIFIED | `prose_summary.py` lines 119-125: returns None when key missing; lines 132-158: retry-once with None on both fails; `run.py` only calls `save()` when `summary is not None` |
| 5 | GET /api/prose-summary serves weekly_summary.json from Blob or cache, returning 404 when missing | VERIFIED | `route.ts` lines 16-53: full USE_BLOB pattern; ENOENT → 404; Cache-Control header `public, s-maxage=3600, stale-while-revalidate=86400` |
| 6 | useProseSummary hook fetches GET endpoint and returns null on 404 (D-13 silent hide) | VERIFIED | `useProseSummary.ts` line 9: `if (res.status === 404) return null`; queryKey `['prose-summary']`; staleTime `6 * 60 * 60 * 1000` |
| 7 | ProseSummaryBlock renders below the four Decision cards, shows prose + 'Updated GW{N}' timestamp + ↻ button | VERIFIED | `ProseSummaryBlock.tsx` lines 55-60: prose `<p>` and `Updated GW{displayed.gw}` rendered; `DecisionSummaryTab.tsx` line 677: `<ProseSummaryBlock payload={proseRefreshPayload} />` placed after four-card grid |
| 8 | Refresh button click triggers POST /api/prose-summary with serialised Decision Summary state | VERIFIED | `ProseSummaryBlock.tsx` lines 23-31: `handleRefresh` calls `refresh.mutate(payload, ...)`; `useProseRefresh.ts` lines 6-19: `postRefresh` does `fetch('/api/prose-summary', { method: 'POST', ... })` |
| 9 | Server-side POST validates body with zod, calls Claude, returns 422 on guardrail failure, 400 on bad body, 200 on success | VERIFIED | `route.ts` lines 58-89: full zod schema; lines 165-221: POST handler with 400/503/422/200 responses; all 3 POST tests present and verified by SUMMARY |
| 10 | Server reads merged_players.json server-side for corpus — no corpus in body | VERIFIED | `route.ts` lines 93-111: `readPlayerCorpus()` function reads `merged_players.json` via USE_BLOB switch; body schema has no corpus field |
| 11 | On 200 response, useProseRefresh.mutate.onSuccess sets override state in ProseSummaryBlock | VERIFIED | `ProseSummaryBlock.tsx` line 26: `onSuccess: (data) => setOverride(data)`; override replaces global in rendered prose |
| 12 | On 422 response, useProseRefresh throws GUARDRAIL_FAILED sentinel; prose block silently hides | VERIFIED | `useProseRefresh.ts` lines 12-14: `if (res.status === 422) throw new Error('GUARDRAIL_FAILED')`; `ProseSummaryBlock.tsx` line 28: `if (e.message === 'GUARDRAIL_FAILED') setOverride(null)` |
| 13 | Page reload reverts to global prose — override is component state (D-04) | VERIFIED (with human gate) | `ProseSummaryBlock.tsx` line 15: `useState<ProseSummary | null>(null)` — component-local state, lost on unmount; verified by 5th component test ("reload reverts") passing; live UX approved per SUMMARY-03 checkpoint |
| 14 | Refresh button disabled when no squad loaded (payload null) | VERIFIED | `ProseSummaryBlock.tsx` line 48: `disabled={refresh.isPending \|\| !payload}` |
| 15 | POST route exports maxDuration=30 (Vercel Hobby timeout mitigation) | VERIFIED | `route.ts` line 12: `export const maxDuration = 30` |
| 16 | ANTHROPIC_API_KEY wired in pipeline.yml; anthropic included in pip install | VERIFIED | `pipeline.yml` line 15: `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`; line 28: `pip install requests pandas vercel-blob python-dotenv anthropic` |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types.ts` | ProseSummary + ProseRefreshPayload interfaces | VERIFIED | Both interfaces at lines 604/610; ReadonlyArray fix applied for `as const` compatibility |
| `src/lib/prose-guardrail.ts` | passesGuardrail + findHallucinatedNames exports | VERIFIED | 37 lines; both functions exported; no React/fetch/SDK imports |
| `src/lib/prose-guardrail.test.ts` | 7 Vitest unit tests, all GREEN | VERIFIED | 7 tests covering all specified cases including "rejects unknown" |
| `pipeline/tests/test_prose_summary.py` | 4 pytest tests for Python guardrail + generate_weekly_summary | VERIFIED | `grep -cE "^def test_"` returns 4 |
| `src/app/api/prose-summary/route.test.ts` | GET and POST describe blocks; 5 tests | VERIFIED | 5 tests (2 GET, 3 POST); constructor mock fix applied |
| `src/components/squad/ProseSummaryBlock.test.tsx` | 5 jsdom component tests | VERIFIED | `// @vitest-environment jsdom` at line 1; all 5 named tests present |
| `pipeline/requirements.txt` | anthropic>=0.98.1 | VERIFIED | Line 6: `anthropic>=0.98.1` |
| `package.json` | @anthropic-ai/sdk@^0.93.0 | VERIFIED | Line 13 of dependencies block |
| `pipeline/prose_summary.py` | generate_weekly_summary + 4 internal helpers | VERIFIED | 165 lines; `generate_weekly_summary`, `_passes_guardrail`, `_collect_allowed_names`, `_normalize`, `_build_user_prompt` all present |
| `pipeline/run.py` | generate_weekly_summary call + save('weekly_summary.json') | VERIFIED | Call at line 282; save at line 317 |
| `.github/workflows/pipeline.yml` | ANTHROPIC_API_KEY env + anthropic in pip install | VERIFIED | Both lines confirmed |
| `src/app/api/prose-summary/route.ts` | GET + POST + maxDuration | VERIFIED | 221 lines; `export const maxDuration = 30`; both handlers exported |
| `src/lib/hooks/useProseSummary.ts` | TanStack Query hook, null on 404 | VERIFIED | 15 lines; queryKey, staleTime 6h, 404 → null |
| `src/lib/hooks/useProseRefresh.ts` | Real useMutation, GUARDRAIL_FAILED on 422 | VERIFIED | 27 lines; `useMutation` at line 23; GUARDRAIL_FAILED sentinel at line 14 (NOT a stub) |
| `src/components/squad/ProseSummaryBlock.tsx` | Component with prose, timestamp, ↻ button | VERIFIED | 64 lines; `'use client'`; both hooks consumed; returns null when no prose |
| `src/components/squad/DecisionSummaryTab.tsx` | proseRefreshPayload useMemo + ProseSummaryBlock mounted with real payload | VERIFIED | `proseRefreshPayload` useMemo at line 314; `<ProseSummaryBlock payload={proseRefreshPayload} />` at line 677 (not null) |
| `node_modules/@anthropic-ai/sdk/package.json` | SDK installed | VERIFIED | File present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prose-guardrail.test.ts` | `prose-guardrail.ts` | `import { passesGuardrail, findHallucinatedNames }` | WIRED | Import confirmed at test file line 2 |
| `ProseSummaryBlock.tsx` | `src/lib/types.ts` | `import type { ProseSummary, ProseRefreshPayload }` | WIRED | Line 6 of component |
| `pipeline/run.py` | `pipeline/prose_summary.py` | `from prose_summary import generate_weekly_summary` | WIRED | Confirmed at run.py line 282 |
| `route.ts (GET)` | `weekly_summary.json` | USE_BLOB switch — list+fetch OR readFile | WIRED | Both paths present; `'weekly_summary.json'` referenced twice |
| `useProseSummary.ts` | `/api/prose-summary` | `fetch('/api/prose-summary')` | WIRED | Line 8 of hook |
| `ProseSummaryBlock.tsx` | `useProseSummary.ts` | `useProseSummary()` | WIRED | Line 13 of component |
| `DecisionSummaryTab.tsx` | `ProseSummaryBlock.tsx` | `<ProseSummaryBlock payload={proseRefreshPayload} />` | WIRED | Line 677 — real payload, not null |
| `useProseRefresh.ts` | `/api/prose-summary` | `fetch('/api/prose-summary', { method: 'POST' })` | WIRED | Lines 7-11 of hook |
| `route.ts (POST)` | `@anthropic-ai/sdk` | `new Anthropic({ apiKey }); client.messages.create(...)` | WIRED | Lines 189-201 |
| `route.ts (POST)` | `prose-guardrail.ts` | `import { passesGuardrail }` + call at line 208 | WIRED | Line 6 import; line 208 usage |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ProseSummaryBlock.tsx` | `displayed.prose` | `useProseSummary()` → GET `/api/prose-summary` → `readFile('weekly_summary.json')` or Blob | Yes — real file read or Blob fetch | FLOWING |
| `ProseSummaryBlock.tsx` | `override` (after refresh) | `useProseRefresh.mutate()` → POST `/api/prose-summary` → Anthropic SDK | Yes — real SDK response, guardrail-validated | FLOWING |
| `route.ts POST` | `corpus` | `readPlayerCorpus()` → `merged_players.json` server-side | Yes — reads real player file | FLOWING |
| `DecisionSummaryTab.tsx` | `proseRefreshPayload` | `captaincyCandidates`, `ocsRows`, `riskRows`, `bbScores`, `tcScores`, `fhResult` | Yes — derived from existing component state; null when `!submittedId` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| guardrail exports both functions | `grep -cE "^export function" src/lib/prose-guardrail.ts` | 2 | PASS |
| prose-guardrail test count | `grep -c "it('" src/lib/prose-guardrail.test.ts` | 7 | PASS |
| Python test count | `grep -cE "^def test_" pipeline/tests/test_prose_summary.py` | 4 | PASS |
| route exports GET and POST | `grep -cE "^export async function (GET\|POST)" route.ts` | 2 | PASS |
| maxDuration present | `grep "^export const maxDuration = 30" route.ts` | match | PASS |
| useMutation in useProseRefresh | `grep -c "useMutation" useProseRefresh.ts` | 1 (not stub) | PASS |
| GUARDRAIL_FAILED sentinel | `grep -c "GUARDRAIL_FAILED" useProseRefresh.ts` | 1 | PASS |
| proseRefreshPayload wired | `grep "ProseSummaryBlock payload={proseRefreshPayload}" DecisionSummaryTab.tsx` | match | PASS |
| payload={null} placeholder gone | `grep -c "ProseSummaryBlock payload={null}" DecisionSummaryTab.tsx` | 0 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NLP-01 | Plans 01, 02 | User can read a weekly plain-English prose summary generated by Claude API; no hallucinated player data | SATISFIED | Pipeline generates summary via claude-haiku-4-5 with retry-once guardrail; GET route serves it; component renders below Decision cards |
| NLP-02 | Plans 02, 03 | User can regenerate prose mid-week via Refresh button; summary also updates automatically on each pipeline run | SATISFIED | POST handler with zod + guardrail; useProseRefresh real mutation; pipeline auto-updates each run; human-verify checkpoint approved per 067-03-SUMMARY |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/hooks/useProseRefresh.ts` | 1 | `'use client'` directive on a hooks file | Info | Unusual (hooks files typically don't have 'use client') but functional — file exports a React hook that uses useMutation, client-only by nature |

No blockers or stubs found. The Plan 02 `useProseRefresh` stub has been fully replaced with a real `useMutation` implementation in Plan 03.

---

### Human Verification Required

The automated code-level checks are all VERIFIED. Three UX behaviors require live confirmation because they depend on a running dev server, the ANTHROPIC_API_KEY environment variable, and pipeline cache data.

#### 1. Global prose display (no squad)

**Test:** Start dev server (`npm run dev`). Navigate to Squad -> Decision tab without loading a Team ID. Scroll below the four Decision cards.
**Expected:** AI Summary block visible with prose paragraph and "Updated GW{N}" timestamp. The ↻ (refresh) button is visible but DISABLED (greyed out, ~40% opacity) because no payload is available.
**Why human:** Requires `pipeline/cache/weekly_summary.json` to exist (either run `python pipeline/run.py` first with ANTHROPIC_API_KEY set, or place a stub file). Visual disabled-state rendering cannot be asserted without a browser.

#### 2. Squad-aware Refresh flow

**Test:** Load a valid FPL Team ID. Verify ↻ button becomes enabled. Click ↻.
**Expected:** Button immediately shows ⏳ spinner and becomes disabled. Within ~10 seconds, the prose paragraph replaces with a new squad-aware paragraph. Button reverts to ↻.
**Why human:** Requires `ANTHROPIC_API_KEY` set in `.env.local`, a real POST call to `api.anthropic.com`, and browser observation of the in-flight loading state.

#### 3. Page-reload reverts to global prose (D-04)

**Test:** After clicking ↻ and observing the squad-aware prose, reload the page (Cmd-R / F5).
**Expected:** Prose reverts to the original pipeline-generated paragraph from `weekly_summary.json` — the override state is lost on unmount.
**Why human:** Component-local React state revert on page reload requires visual confirmation in a browser. The code correctly uses `useState` (not persisted state), but only human observation can confirm the session-boundary behavior end-to-end.

> Note: Per 067-03-SUMMARY, these steps were previously approved by the developer during the Plan 03 human-verify checkpoint. The approval is recorded in the SUMMARY. If the developer is the same person and is satisfied with the SUMMARY record, this gate may be waived.

---

### Gaps Summary

No gaps. All 16 must-haves from Plans 01–03 are VERIFIED against the actual codebase:

- Plan 01 foundation: types, guardrail module, test scaffolds, dependency declarations — all present and substantive.
- Plan 02 pipeline and read path: `prose_summary.py` with retry-once guardrail, `run.py` integration, `pipeline.yml` wiring, GET route, `useProseSummary` hook, `ProseSummaryBlock` component with null-hide — all present and wired.
- Plan 03 refresh path: POST handler (zod + Anthropic SDK + guardrail + maxDuration), real `useProseRefresh` mutation with GUARDRAIL_FAILED sentinel, `proseRefreshPayload` useMemo in DecisionSummaryTab passing real payload — all present and wired.

The only remaining item is a human-verify gate for the live UX (visual rendering, in-flight spinner, page-reload revert). Automated evidence and the Plan 03 SUMMARY approval record both support PASS. A human confirm is required before the phase can be officially closed.

---

_Verified: 2026-05-05_
_Verifier: Claude (gsd-verifier)_
