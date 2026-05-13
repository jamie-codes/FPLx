---
phase: 105-nlp-02-per-player-llm-insight-route-hook-ui
verified: 2026-05-13T23:45:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify ANTHROPIC_API_KEY is present in Vercel Production environment (not NEXT_PUBLIC_ANTHROPIC_API_KEY)"
    expected: "ANTHROPIC_API_KEY exists in Production env; no NEXT_PUBLIC_ variant present"
    why_human: "External system — Vercel dashboard or CLI required; cannot verify programmatically from codebase"
  - test: "Verify Anthropic Console monthly spending cap is configured"
    expected: "A monthly spending limit (recommended USD 50/month) is set in Anthropic Console -> Usage -> Monthly Limit"
    why_human: "External system — requires Anthropic Console login; no in-codebase artifact to verify"
  - test: "Smoke-test the 'Get AI insight' button in a running dev environment (optional but recommended)"
    expected: "Button appears in GemTable expand row and TransferPanel buy-candidate row. Zero /api/player-insight requests fire on row expand (DevTools Network). One POST fires on button click. Button shows 'Generating...' then prose appears. Collapse + re-expand returns cached prose with zero network requests."
    why_human: "Requires running app and real ANTHROPIC_API_KEY; cannot verify from static code analysis"
---

# Phase 105: NLP-02 Per-Player LLM Insight Verification Report

**Phase Goal:** Deliver NLP-02 per-player LLM insight — POST route, usePlayerInsight hook, PlayerInsightSection component, wired into GemTable and TransferPanel surfaces with gameweek-keyed caching.
**Verified:** 2026-05-13T23:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/player-insight exists, runs on Node.js (not Edge), exports maxDuration=30, handles 400/503/502/422/200 with two-attempt guardrail and blob write | VERIFIED | `src/app/api/player-insight/route.ts` exists, 209 lines, no `runtime='edge'`, `export const maxDuration = 30` at line 15, all status codes confirmed in code |
| 2 | usePlayerInsight hook exists with mutationKey, GUARDRAIL_FAILED sentinel, localStorage cache, no useEffect-triggered mutate | VERIFIED | `src/lib/hooks/usePlayerInsight.ts` exists, `mutationKey: ['playerInsight', playerId, gw]` at line 59, `throw new Error('GUARDRAIL_FAILED')` at line 38, localStorage write in `onSuccess` callback, zero functional `useEffect` calls |
| 3 | PlayerInsightSection component renders all 5 states (idle, loading, success, cache-hit, hard-error, guardrail-fallback) without calling mutate from useEffect | VERIFIED | `src/components/shared/PlayerInsightSection.tsx` exists, all 6 UI states confirmed in code, cache-hit via `useState` initializer (not `useEffect`), `mutate` only called from `handleGetInsight()` onClick handler |
| 4 | PlayerInsightSection wired into GemTable (mobile + desktop expand rows) and TransferPanel (via OCT PlayerMoveCell, buy-candidate rows only), with gameweek prop threaded correctly | VERIFIED | GemTable: 2 `<PlayerInsightSection>` insertions with `gw={insightGw}` (lines 378-383, 407-412); OCT: 1 `<PlayerInsightSection>` inside PlayerMoveCell after early-return guard for roll rows; TransferPanel passes `gw={nextGw}` to OCT (line 434); DecisionSummaryTab also fixed with `gw={nextGw ?? 0}` |
| 5 | ANTHROPIC_API_KEY present in Vercel Production env and Anthropic Console monthly spending cap configured | UNCERTAIN (human needed) | SC5 explicitly marked PENDING in 105-03-SUMMARY.md; the code-side guard (503 when key absent) is verified, but external system state requires human confirmation |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/player-insight/route.ts` | POST handler, Node.js, maxDuration=30, two-attempt guardrail, blob write | VERIFIED | 209 lines, fully substantive, no stubs |
| `src/lib/hooks/usePlayerInsight.ts` | useMutation hook + readCachedInsight + cacheKey | VERIFIED | 70 lines, exports `usePlayerInsight` and `readCachedInsight`, `mutationKey` includes playerId+gw |
| `src/components/shared/PlayerInsightSection.tsx` | All 5 visible states, no useEffect mutate trigger | VERIFIED | 131 lines, `useState` initializer for cache hit, `mutate` in onClick only |
| `src/lib/types.ts` | `PlayerInsightRequest` and `PlayerInsightResponse` exported | VERIFIED | Both interfaces at lines 918 and 935 |
| `src/components/transfers/TransferPanel.tsx` | `gw={nextGw}` passed to OCT | VERIFIED | Line 434: `gw={nextGw}` present |
| `src/components/transfers/OpportunityCostTable.tsx` | `gw: number` in props + PlayerMoveCell + `<PlayerInsightSection>` rendered | VERIFIED | Import at line 16, `gw: number` in both interface (line 22) and PlayerMoveCell (line 105), `<PlayerInsightSection>` at line 149 |
| `src/components/gem-table/GemTable.tsx` | `insightGw` const + 2 `<PlayerInsightSection>` insertions | VERIFIED | `const insightGw` at line 149, mobile at line 378, desktop at line 407 |
| `src/app/api/player-insight/route.test.ts` | 11 test stubs covering all status codes | VERIFIED | File exists, 43 total tests pass across 5 test files |
| `src/lib/hooks/usePlayerInsight.test.ts` | 8 test stubs for hook behavior | VERIFIED | File exists, passes |
| `src/components/shared/PlayerInsightSection.test.tsx` | 8 test stubs + no-useEffect-mutate invariant | VERIFIED | File exists, passes |
| `src/components/gem-table/GemTable.test.tsx` | 3 tests for expand-row integration | VERIFIED | File exists, passes |
| `src/components/transfers/OpportunityCostTable.test.tsx` | Phase 105 NLP-02 nested describe with 3 tests | VERIFIED | "Phase 105 NLP-02 integration" describe present, passes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TransferPanel.tsx` | `OpportunityCostTable.tsx` | `<OpportunityCostTable ... gw={nextGw} />` | WIRED | Line 434 of TransferPanel.tsx |
| `OpportunityCostTable.tsx` | `PlayerInsightSection.tsx` | `<PlayerInsightSection player={t.buy} gw={gw} ...>` inside PlayerMoveCell | WIRED | Line 149-154; roll rows return early at line 109 |
| `GemTable.tsx` | `PlayerInsightSection.tsx` | Two insertions after `<ComparisonSearch />` | WIRED | Lines 378-383 (mobile) and 407-412 (desktop) with `gw={insightGw}` |
| `route.ts` | `prose-guardrail.ts` | `passesGuardrail(prose, allowed, corpus)` | WIRED | Lines 182 and 157; import at line 6 |
| `route.ts` | `@vercel/blob` | `put(blobKey, ..., { allowOverwrite: true, ... })` | WIRED | Lines 193-201; `allowOverwrite: true` confirmed |
| `usePlayerInsight.ts` | `/api/player-insight` | `fetch('/api/player-insight', { method: 'POST', ... })` | WIRED | Line 31 of hook |
| `PlayerInsightSection.tsx` | `usePlayerInsight.ts` | `import { usePlayerInsight, readCachedInsight }` | WIRED | Line 11 of component |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlayerInsightSection.tsx` | `insight` state | `readCachedInsight()` on mount OR `mutation.mutate()` `onSuccess` callback | Yes — localStorage read on mount; `postInsight()` fetches `/api/player-insight` which calls Anthropic SDK | FLOWING |
| `route.ts` | `prose` | `client.messages.create({ model: 'claude-haiku-4-5-20251001', ... })` | Yes — real Anthropic SDK call with XML player context; guarded by `passesGuardrail` | FLOWING |
| `usePlayerInsight.ts` | `PlayerInsightResponse` | `postInsight()` → fetch to `/api/player-insight` | Yes — real fetch to route handler; localStorage write in `onSuccess` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 43 NLP-02 tests pass | `npx vitest run` on 5 test files | `5 passed (5), Tests 43 passed (43)` | PASS |
| No Edge runtime in route | `grep -c "runtime = 'edge'" route.ts` | 0 | PASS |
| No NEXT_PUBLIC_ANTHROPIC leak | `grep -rn "NEXT_PUBLIC_ANTHROPIC" src/` | empty | PASS |
| allowOverwrite: true in blob put | `grep -c "allowOverwrite: true" route.ts` | 1 | PASS |
| PlayerInsightSection count in GemTable | `grep -c "<PlayerInsightSection" GemTable.tsx` | 2 | PASS |
| PlayerInsightSection count in OCT | `grep -c "<PlayerInsightSection" OpportunityCostTable.tsx` | 1 | PASS |
| gw={nextGw} in TransferPanel | `grep -c "gw={nextGw}" TransferPanel.tsx` | 1 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NLP-02 | 105-01, 105-02, 105-03 | User can request on-demand AI-generated insight from GemTable or TransferPanel via explicit button; grounded in structured player data; cached in localStorage + Vercel Blob; never auto-generated; two-attempt name-whitelist guardrail | PARTIALLY SATISFIED | All automated criteria verified; SC5 (deployment env + spending cap) pending human confirmation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/player-insight/route.ts` | 157-182 | `readPlayerCorpus()` returns `[]` on any failure; `passesGuardrail(prose, allowed, [])` always returns `true` when corpus is empty — guardrail silently disabled on cold-start/blob-failure path | Warning | On the degraded path (blob not yet populated, pipeline failure), any player name passes the guardrail. Identified in 105-REVIEW.md CR-01. Not a stub — route is functional — but hallucinates on empty corpus. |
| `src/components/gem-table/GemTable.tsx` | 149 | `insightGw = (lastGwActualGwN ?? 0) + 1` falls back to `gw=1` when accuracy data unavailable — wrong cache key during loading | Warning | Cache entries written as `gw=1` during accuracy-hook loading transient; stale cache hit possible after real GW loads. Identified in 105-REVIEW.md WR-01. |
| `src/components/shared/PlayerInsightSection.tsx` | 16-21 | `PlayerInsightSectionProps` accepts `ScoredPlayer` but call sites cast `MergedPlayer` with `as unknown as ScoredPlayer` | Info | Type safety bypass; runtime safe today because only `MergedPlayer` fields are accessed inside the component. Identified in 105-REVIEW.md WR-03. |
| `src/components/shared/PlayerInsightSection.tsx` | N/A | `lifecycle_label` field defined in API schema and `PlayerInsightRequest` type but never threaded from call sites — dead prompt field | Info | LLM loses lifecycle context that could improve response quality. Identified in 105-REVIEW.md WR-02. Not a blocker for phase goal. |

None of the above are STUB patterns. The route, hook, and component are fully implemented. The warnings are real defects identified in code review — they affect quality and correctness on edge-case paths but do not prevent the core feature from functioning.

### Human Verification Required

#### 1. ANTHROPIC_API_KEY in Vercel Production Environment

**Test:** Open Vercel Dashboard for this project → Project Settings → Environment Variables. Confirm `ANTHROPIC_API_KEY` exists in the `Production` environment. Confirm there is NO `NEXT_PUBLIC_ANTHROPIC_API_KEY`.
**Expected:** `ANTHROPIC_API_KEY` present server-side; no client-side public variant.
**Why human:** External Vercel system; no codebase artifact can confirm deployment environment state.

#### 2. Anthropic Console Monthly Spending Cap

**Test:** Log into Anthropic Console (console.anthropic.com) → Usage → Monthly Limit. Confirm a spending cap is configured (recommended: USD 50/month).
**Expected:** Monthly spending cap is set and active.
**Why human:** External Anthropic system; no codebase artifact can confirm billing configuration.

#### 3. End-to-End Smoke Test (Recommended)

**Test:** Run `npm run dev`, navigate to GemTable, expand any player row. Check DevTools Network → confirm ZERO requests to `/api/player-insight` fire on expand. Click "Get AI insight" button. Confirm exactly ONE POST request fires, button shows "Generating…" (disabled), prose appears within ~5s. Collapse and re-expand — confirm prose appears instantly (zero network requests = localStorage cache hit). Repeat in TransferPanel → buy candidate row.
**Expected:** Feature works end-to-end; cost-explosion safeguard confirmed in live app.
**Why human:** Requires running app + real `ANTHROPIC_API_KEY`; smoke-test behavior cannot be verified from static code analysis.

### Gaps Summary

No automated gaps found. All 4/5 verifiable must-haves are VERIFIED with strong evidence:

- POST route is substantive, wired, and data-flowing
- Hook is substantive, wired, no useEffect-triggered mutate
- Component renders all required states, no useEffect-triggered mutate
- Surface wiring is complete (GemTable x2, TransferPanel/OCT x1, DecisionSummaryTab gw fix included)

SC5 (ANTHROPIC_API_KEY + spending cap) is structurally unverifiable from code alone — it requires human confirmation of external system state. This is the only blocker for status: `passed`.

Two code-quality warnings from 105-REVIEW.md are noted:
- **CR-01** (guardrail silent-disable on empty corpus) is a correctness concern on the degraded path but does not prevent the feature from working when the blob is populated. It does not block the phase goal, but should be resolved before production load.
- **WR-01** (GemTable gw=1 fallback) is a cache-key correctness issue during accuracy-hook loading. Does not block phase goal.

Neither is a phase-goal blocker per the ROADMAP success criteria, which focus on the on-demand LLM flow being wired and protected — both of which are true.

---

_Verified: 2026-05-13T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
