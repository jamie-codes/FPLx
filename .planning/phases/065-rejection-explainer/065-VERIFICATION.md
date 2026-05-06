---
phase: 065-rejection-explainer
verified: 2026-05-06T14:03:49Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "WHY-01 GemTable row expand — desktop and mobile"
    expected: "Clicking any row in the Gem Ratings table expands a blue-tinted row below. On desktop (>=640px) the panel shows either a green 'No rejection signals — ranked #X at POS by xPts (Y.Y pts projected)' line or a 'Why not recommended:' header with one or more rejection reasons. On mobile (<640px) the panel shows action-sheet (Compare/Dismiss) first, then the hidden-column dl, then the rejection panel below."
    why_human: "Desktop expand row uses hidden sm:table-row CSS — whether display:table-row renders correctly requires a real browser render. TanStack expand state machine not covered by existing vitest tests."
  - test: "WHY-02 TransferPanel high-ownership callout"
    expected: "After loading a squad with >20%-owned players absent from OCS suggestions, a zinc-bordered info card titled 'ℹ️ Why aren't these players appearing?' appears above the Transfer Opportunity Cost section. Each entry shows '[Name] (X%): Already ranked #N at POS in your squad by xPts — no upgrade needed' (in-squad) or '[Name] (X%): xPts gain vs your POS options is negative — not worth transferring in' (not in squad). Em-dashes render as — not as -- or &mdash;."
    why_human: "Callout conditional render requires live squad data with qualifying players. Whether it correctly disappears when all >20% players are in OCS suggestions cannot be verified without a real squad."
  - test: "WHY-03 SquadView rejection reasons — sell/hold player expand"
    expected: "Expanding a starting-XI player with verdict='sell' or verdict='hold' shows in order: positive reasons ul, 'Why not recommended:' header, rejection reasons ul (including 'Below xPts hold threshold — consider rotating', rotation risk, fixture, and captain rejection line), then replacement shortlist if applicable. The top captain candidate has no captain rejection line (D-09 guard). Bench players show no expand panel."
    why_human: "Per-player rejection logic depends on live verdicts Map and captaincyCandidates derived from a real squad. The D-09 captain guard and bench exclusion require visual inspection in the running app with real data."
---

# Phase 65: Rejection Explainer — Verification Report

**Phase Goal:** Users can understand why any player they are curious about did not surface as a transfer target or captain recommendation — turning opaque ranking into an auditable, trust-building explanation
**Verified:** 2026-05-06T14:03:49Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can expand any GemTable row and read a natural-language "why not?" explanation covering: ownership%, xPts ranking, start probability, fixture difficulty, and any active fragility flag | ? HUMAN NEEDED | `computeRejection` is fully implemented and wired into GemTable via IIFE. All five signal types present in the function. `getRowCanExpand: () => true` enables all rows. Desktop row uses `hidden sm:table-row`. Browser render required to verify CSS expand behaviour. |
| 2 | TransferPanel shows a dedicated callout for any player with >20% ownership absent from transfer candidates — naming the player and giving a one-sentence reason | ? HUMAN NEEDED | `highOwnershipAbsent` useMemo exists and is wired. `HighOwnershipCallout` component renders correct copy. Live squad data required to verify conditional render and copy accuracy. |
| 3 | Squad view row expand for an owned player explains why they are not recommended to hold or captain — distinguishing between "below xPts threshold", "rotation risk", "difficult fixture", and "fragile recommendation" | ? HUMAN NEEDED | SquadView derives `rejectionReasons` per-player and passes to ExplainPanel. All four copy strings implemented. D-09 captain guard implemented. Live squad required. |
| 4 | All three surfaces are computed client-side over existing data — no additional network request | ✓ VERIFIED | `explain.ts`, `ExplainPanel.tsx`, `HighOwnershipCallout.tsx` have zero fetch/axios/network calls. All data flows from `scoredPlayers` useMemo (already fetched), `squadData`, `captaincyCandidates`, and `verdicts` — all existing in-memory data. |
| 5 | Explanations use plain English with specific values — not generic phrases | ✓ VERIFIED | `computeRejection` emits: `Ranked #${xPtsRank} at ${posCode} by xPts`, `Rotation risk — start probability ${startPct}%`, `Difficult fixture (FDR medium/hard)`, `Owned by ${owned}% of managers`. GemTable positive framing: `No rejection signals — ranked #X at POS by xPts (Y.Y pts projected)`. All specific and numeric. |

**Score:** 5/5 truths supported by codebase evidence. 3 require human verification for browser render / live data.

### Requirement ID Coverage

| Requirement | REQUIREMENTS.md Definition | Plans | Status | Evidence |
|-------------|---------------------------|-------|--------|----------|
| WHY-01 | User can expand any GemTable row and read a natural-language "why not?" explanation covering ownership%, xPts ranking, start probability, fixture difficulty, and any active fragility flag | Plans 01, 02, 04 | ✓ VERIFIED (automated) + ? HUMAN (browser render) | `computeRejection` exported from `explain.ts` with all five signals. GemTable wired: `getRowCanExpand: () => true`, desktop row `hidden sm:table-row`, mobile row `sm:hidden`, IIFE pattern. 14/14 unit tests pass. |
| WHY-02 | TransferPanel shows a dedicated callout for any player with >20% ownership absent from transfer candidates — naming the player and giving a one-sentence reason | Plans 01, 03, 05 | ✓ VERIFIED (automated) + ? HUMAN (live data) | `HighOwnershipCallout` component exists with `data-testid`, in-squad/not-in-squad copy, `parseFloat` ownership. `TransferPanel.tsx` wires `highOwnershipAbsent` useMemo. 7/7 component tests pass. |
| WHY-03 | Squad view row expand for an owned player explains why they are not recommended to hold or captain — distinguishing between "below xPts threshold", "rotation risk", "difficult fixture", and "fragile recommendation" | Plans 01, 03, 05 | ✓ VERIFIED (automated) + ? HUMAN (live data) | `ExplainPanel` accepts `rejectionReasons?: string[]` and renders "Why not recommended:" section in correct DOM order. `SquadView` derives all four copy strings, D-09 captain guard, bench exclusion. 7/7 component tests pass. |

No orphaned requirements — all three WHY-* requirements are claimed by plan frontmatter and have corresponding implementation.

### Required Artifacts

| Artifact | Plan | Status | Evidence |
|----------|------|--------|----------|
| `src/lib/__tests__/rejection.test.ts` | 01 | ✓ VERIFIED | 347 lines, 14 `it()` blocks, imports `computeRejection` + 2 constants from `'../explain'`, all exact UI-SPEC strings present, `@vitest-environment node` |
| `src/components/transfers/HighOwnershipCallout.test.tsx` | 01 | ✓ VERIFIED | 109 lines, 7 `it()` blocks, imports from `'./HighOwnershipCallout'`, `@vitest-environment jsdom`, data-testid asserted |
| `src/components/squad/ExplainPanel.test.tsx` | 01 | ✓ VERIFIED | 95 lines, 7 `it()` blocks, `rejectionReasons=` prop used, DOM order asserted, `@vitest-environment jsdom` |
| `src/lib/explain.ts` | 02 | ✓ VERIFIED | Exports: `computeRejection`, `REJECTION_START_PROB_THRESHOLD`, `REJECTION_OWNERSHIP_THRESHOLD`, `RejectionResult`. All 10 original constants preserved. `POSITION_CODES` module-private. `computeFragility(player, false)` called correctly. |
| `src/components/squad/ExplainPanel.tsx` | 03 | ✓ VERIFIED | `rejectionReasons?: string[]` prop added. Conditional render `rejectionReasons && rejectionReasons.length > 0`. "Why not recommended:" header literal. Section positioned between positive reasons `</ul>` and shortlist block. |
| `src/components/transfers/HighOwnershipCallout.tsx` | 03 | ✓ VERIFIED | `'use client'` directive, 55 lines (>=25), exports both `HighOwnershipCallout` and `HighOwnershipEntry`, `data-testid="high-ownership-callout"`, `&#8505;&#65039;` HTML entities, early-return-null, `Math.round(parseFloat(...))` ownership. |
| `src/components/gem-table/GemTable.tsx` | 04 | ✓ VERIFIED | Imports `computeRejection`. `getRowCanExpand: () => true`. `POSITION_CODES_LABEL` const. `RejectionPanelInline` function. Desktop row `hidden sm:table-row`. Mobile row `sm:hidden`. IIFE computes rejection once. `cursor-pointer` unconditional. |
| `src/components/transfers/TransferPanel.tsx` | 05 | ✓ VERIFIED | Imports `computeVerdicts` and `HighOwnershipCallout`. `verdicts` useMemo. `highOwnershipAbsent` useMemo with `parseFloat > 20`, kind-narrowing, `.slice(0, 3)`. `<HighOwnershipCallout entries={highOwnershipAbsent} />` above OCS card. `verdicts={verdicts}` and `captaincyCandidates={captaincyCandidates}` passed to SquadView. |
| `src/components/squad/SquadView.tsx` | 05 | ✓ VERIFIED | Imports `computeFragility`, `Verdict`, `CaptaincyCandidate`. Props `verdicts?: Map<number, Verdict>` and `captaincyCandidates?: CaptaincyCandidate[]`. All four rejection copy strings. D-09 captain guard. `computeFragility(player, false)`. `rejectionReasons={rejectionReasons}` passed to ExplainPanel. `POSITION_LABELS` reused (1 declaration). |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `rejection.test.ts` | `explain.ts (computeRejection)` | `import { computeRejection } from '../explain'` | ✓ WIRED | Import on line 4-9 of rejection.test.ts; export on line 115 of explain.ts |
| `HighOwnershipCallout.test.tsx` | `HighOwnershipCallout.tsx` | `import { HighOwnershipCallout } from './HighOwnershipCallout'` | ✓ WIRED | Import present; component file exists; 7/7 tests pass |
| `ExplainPanel.test.tsx` | `ExplainPanel.tsx (rejectionReasons prop)` | `<ExplainPanel rejectionReasons={[...]} />` | ✓ WIRED | `rejectionReasons=` JSX present in test; prop declared in interface; 7/7 tests pass |
| `explain.ts` | `sensitivity.ts (computeFragility)` | `computeFragility(player, false)` | ✓ WIRED | Line 128 of explain.ts: `const { reasons: fragilityReasons } = computeFragility(player, false)` |
| `explain.ts` | `recommend.ts (computePositionAverages)` | `computePositionAverages(allPlayers)` | ✓ WIRED | Line 3 import, line 126 call in computeRejection |
| `GemTable.tsx` | `explain.ts (computeRejection)` | `import { computeRejection } from '@/lib/explain'` | ✓ WIRED | Line 25 of GemTable.tsx; called line 260 as `computeRejection(row.original, scoredPlayers)` |
| `GemTable.tsx` | `RejectionPanelInline (render)` | IIFE renders both desktop and mobile expand rows | ✓ WIRED | Lines 309-325 of GemTable.tsx — both `<RejectionPanelInline>` instances rendered |
| `TransferPanel.tsx` | `HighOwnershipCallout.tsx` | `import { HighOwnershipCallout, type HighOwnershipEntry }` | ✓ WIRED | Line 19; rendered line 358 as `<HighOwnershipCallout entries={highOwnershipAbsent} />` |
| `TransferPanel.tsx` | `SquadView.tsx (verdicts + captaincyCandidates)` | `verdicts={verdicts} captaincyCandidates={captaincyCandidates}` | ✓ WIRED | Lines 324-325 of TransferPanel.tsx |
| `SquadView.tsx` | `ExplainPanel.tsx (rejectionReasons prop)` | `<ExplainPanel ... rejectionReasons={rejectionReasons} />` | ✓ WIRED | Line 265 of SquadView.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GemTable.tsx / RejectionPanelInline` | `rejection` (reasons, xPtsRank) | `computeRejection(row.original, scoredPlayers)` where `scoredPlayers` = `computeAllGemScores(data ?? [])` from `usePlayers()` hook | Yes — real player data from API | ✓ FLOWING |
| `HighOwnershipCallout.tsx` | `entries` (HighOwnershipEntry[]) | `highOwnershipAbsent` useMemo in TransferPanel — filters `scoredPlayers`, derives from `ocsSuggestions` | Yes — real scored players filtered on live OCS output | ✓ FLOWING |
| `ExplainPanel.tsx` (rejection section) | `rejectionReasons` | Derived inline in SquadView expand IIFE from `verdicts.get(player.id)`, `computeFragility(player, false)`, `captaincyCandidates` | Yes — all three sources are real computed values from squad data | ✓ FLOWING |

No static/hardcoded data returns found in any explainer path.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 28 phase test cases pass | `npx vitest run rejection.test.ts HighOwnershipCallout.test.tsx ExplainPanel.test.tsx` | `Tests 28 passed (28)` | ✓ PASS |
| computeRejection exported from explain.ts | `grep -cE "^export function computeRejection"` | 1 | ✓ PASS |
| REJECTION constants exported | `grep -cE "^export const REJECTION_"` | 2 | ✓ PASS |
| getRowCanExpand: () => true (not isMobile) | `grep -F "getRowCanExpand: () => true"` / `grep -c "getRowCanExpand: () => isMobile"` | found / 0 | ✓ PASS |
| Desktop expand row class present | `grep -F 'hidden sm:table-row'` | 1 match | ✓ PASS |
| TypeScript clean (0 errors) | `npx tsc --noEmit` (per SUMMARY 05) | 0 errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WHY-01 | 01, 02, 04 | GemTable row expand with natural-language "why not?" covering 5 signal types | ✓ SATISFIED | computeRejection unit-tested 14/14 green; GemTable wired for all rows, desktop + mobile expand rows implemented |
| WHY-02 | 01, 03, 05 | TransferPanel callout for >20%-owned players absent from transfer list | ✓ SATISFIED | HighOwnershipCallout 7/7 tests; TransferPanel useMemo + render wired |
| WHY-03 | 01, 03, 05 | SquadView expand explains hold/captain rejection | ✓ SATISFIED | ExplainPanel 7/7 tests; SquadView rejection derivation wired with all four copy variants |

No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TransferPanel.tsx` | ~208 | `placeholder="e.g. 1234567"` | Info | HTML input placeholder attribute — not a code stub. No impact. |
| `HighOwnershipCallout.tsx` | 28 | `if (entries.length === 0) return null` | Info | Correct early-return-null pattern per plan specification. No impact. |

No blockers or warnings found.

### Human Verification Required

The three items below were confirmed as UAT-approved by the user for Plans 04 (GemTable) and 05 (TransferPanel + SquadView). This report records them for traceability but they are already resolved.

#### 1. WHY-01 GemTable Row Expand (Plans 04 — UAT Approved)

**Test:** Open `http://localhost:3000` at desktop width. Navigate to Analyse → Gem Ratings. Click any row.
**Expected:** Blue-tinted expand row appears with positive framing (green text) or "Why not recommended:" list. On mobile: action-sheet + hidden columns dl + rejection panel below.
**Why human:** Desktop `hidden sm:table-row` CSS and TanStack expand state machine require browser render.
**Status:** User approved (stated in prompt).

#### 2. WHY-02 TransferPanel Callout (Plan 05 — UAT Approved)

**Test:** Load a squad with >20% ownership players absent from OCS suggestions.
**Expected:** `ℹ️ Why aren't these players appearing?` card above Transfer Opportunity Cost with correct in-squad / not-in-squad copy variants.
**Why human:** Conditional render requires live squad data. Cannot verify absence vs presence of callout without real FPL team.
**Status:** User approved (stated in prompt).

#### 3. WHY-03 SquadView Rejection Section (Plan 05 — UAT Approved)

**Test:** Load squad. Expand a sell-verdicted starting XI player.
**Expected:** Panel shows: positive reasons, "Why not recommended:" header, rejection reasons (sell threshold + fragility translations + captain rejection), replacement shortlist. Top captain has no captain rejection line (D-09). Bench players have no expand.
**Why human:** Verdict derivation and D-09 guard require live squad data and visual verification of DOM order.
**Status:** User approved (stated in prompt).

### Gaps Summary

No gaps found. All must-haves verified against actual codebase:

- `computeRejection` is fully implemented (not a stub) with all five signal types, correct signal order (D-07), adaptive framing (D-04), `computeFragility(player, false)` delegation (Pitfall 4), `parseFloat` ownership (Pitfall 2), and 14/14 unit tests green.
- `HighOwnershipCallout` is fully implemented with correct copy variants, `data-testid`, early-return-null, and 7/7 RTL tests green.
- `ExplainPanel` correctly renders the rejection section between positive reasons and shortlist (D-08), with 7/7 RTL tests green.
- `GemTable.tsx` wires all rows expandable (`getRowCanExpand: () => true`), desktop-only rejection panel (`hidden sm:table-row`), mobile preserves action-sheet + hidden columns and appends rejection panel below.
- `TransferPanel.tsx` derives `highOwnershipAbsent` and `verdicts` useMemos correctly, renders callout above OCS, threads props to SquadView.
- `SquadView.tsx` derives per-player `rejectionReasons` with D-09 captain guard, bench exclusion, and `computeFragility(player, false)`.
- All computation is client-side over existing in-memory data — zero new network calls.
- TypeScript: 0 errors (per Plan 05 SUMMARY).
- All 28 automated tests pass (verified by running test suite directly).
- All commit hashes from SUMMARY files verified in git log.

---

_Verified: 2026-05-06T14:03:49Z_
_Verifier: Claude (gsd-verifier)_
